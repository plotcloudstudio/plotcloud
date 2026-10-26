import {inspectStudy} from '../study-readiness.js';
import {climateFile} from '../project-climate.js';
import {canUse, renderGate} from '../beta-access.js';
// One simulation page for every PlotCloud engine: the engine file the classic site runs (emb/<file>.html), in the page shell.
// One implementation: nothing here computes or draws a result. This page only
//   hands the engine the version's model in the engine's own input format (the scene Plan Studio's Send to Simulation
//   makes, the masses scene Sun hours and Wind read, the level as DXF, or the model as OBJ),
//   prefills the engine's site and climate inputs from Account (still editable in the engine's left column),
//   hides the engine's own Model / file section and its wall, window, door and furniture drawing tools (the model is
//   edited only in the Workspace), keeps the engine's views and its results column, makes the left sections collapsible,
//   and saves the engine's own figures to the version.
import * as S from '../store.js';
import {applyProjectClimate} from '../project-climate.js';
import { $, esc, toast, currentProject, setCurrent, currentVersion, setCurrentVersion, simBack, LIVE, route } from '../app.js';
import { sunScene, tzInfo } from '../sunscene.js';
import { studioScene, studioDXF } from '../studio-bridge.js';
import { windFrom } from '../studio-convert.js';
import { obj } from '../export3d.js';
import { levelsOf } from '../viewport2.js';
import { installSimulationFit } from '../../../ui/simulation-fit.js?v=unified-20261025-5';
// Engine HTML must change cache keys with the host module, not just its nested JS.
const ENGINE_RELEASE=new URL(import.meta.url).searchParams.get('v')||'unified-20261025-5';

const PLAN_EDIT = '.sec:has(#h-draw) :is([data-tool="wall"], [data-tool="glass"], [data-tool="win"], [data-tool="door"], [data-tool="furn"], #clear)';
const num = (s) => { const m = String(s ?? '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? +m[0] : NaN; };
const r1 = (v) => Math.round(v * 10) / 10;
// the engine inputs Account fills in, with their names and units (other prefilled inputs come from the model)
const ACCT = { lat: ['Latitude', '°'], lon: ['Longitude', '°'], tz: ['UTC offset', 'h'], north: ['North', '°'], dir: ['Wind from', '°'], wdir: ['Wind from', '°'],
  speed: ['Wind speed', 'm/s'], wspd: ['Wind speed', 'm/s'], wp: ['Work plane', 'm'], occ0: ['Occupied from', ':00'], occ1: ['Occupied until', ':00'], eye: ['Eye height', 'm'],
  rain: ['Design storm', 'mm/h'], duration: ['Storm duration', 'min'], band: ['Band', ''], 'q-loc': ['Location', ''], '@day': ['Sun study date', ''] };
const BANDS = ['125 Hz', '250 Hz', '500 Hz', '1 kHz', '2 kHz', '4 kHz'];
const DAY = { equinox: '03-20', 'summer solstice': '06-21', 'winter solstice': '12-21' };
// Structural analysis climate locations (NBC 2020 table values in the engine): the nearest within 25 km of the site, else "anywhere else"
const QLOC = [['vancouver-ch', 49.2609, -123.1139], ['vancouver-41', 49.2337, -123.1162], ['surrey', 49.1645, -122.7735], ['victoria', 48.4284, -123.3656],
  ['kelowna', 49.888, -119.496], ['prince-george', 53.9171, -122.7497], ['whistler', 50.1163, -122.9574]];
const QNAME = { 'vancouver-ch': 'Vancouver (City Hall)', 'vancouver-41': 'Vancouver (Granville & 41 Ave)', surrey: 'Surrey', victoria: 'Victoria', kelowna: 'Kelowna', 'prince-george': 'Prince George', whistler: 'Whistler', custom: 'Anywhere else (enter site values)' };
// an Account value as people read it
const shown = (id, v) => id === 'band' ? BANDS[v] : id === '@day' ? ({ '03-20': 'Mar 20', '06-21': 'Jun 21', '12-21': 'Dec 21' })[v] || v : id === 'q-loc' ? QNAME[v] || v
  : `${v}${ACCT[id]?.[1] ? (ACCT[id][1].startsWith(':') ? ACCT[id][1] : ' ' + ACCT[id][1]) : ''}`;
function qloc(site) { if (!Number.isFinite(site?.lat)) return 'custom'; const km = (a, b) => Math.hypot((a[0] - b[0]) * 111, (a[1] - b[1]) * 111 * Math.cos(a[0] * Math.PI / 180));
  const best = QLOC.map(([id, la, lo]) => [id, km([site.lat, site.lon], [la, lo])]).sort((a, b) => a[1] - b[1])[0]; return best[1] <= 25 ? best[0] : 'custom'; }

// the building's plan extent and the clear spans of its rooms, from the version's model
function extent(model) {
  const C = model.components.filter((c) => c.type === 'wall' || c.type === 'slab'), rooms = model.components.filter((c) => c.type === 'room');
  if (!C.length) return null;
  const x0 = Math.min(...C.map((c) => c.g.x)), y0 = Math.min(...C.map((c) => c.g.y)), x1 = Math.max(...C.map((c) => c.g.x + c.g.w)), y1 = Math.max(...C.map((c) => c.g.y + c.g.d));
  const lv = levelsOf(model), walls = model.components.filter((c) => c.type === 'wall'), h = walls.length ? Math.max(...walls.map((c) => c.g.h)) : 3;
  return { w: x1 - x0, d: y1 - y0, storeys: Math.max(1, lv.length), h, span: rooms.length ? Math.max(...rooms.map((r) => Math.min(r.g.w, r.g.d))) : Math.min(x1 - x0, y1 - y0) };
}

// per engine: file, what it reads, what it hides, what Account fills in
const CFG = {
  sunhours: { input: 'masses', hide: ['.sec:has(#h-model)', '.sec:has(#h-site)', '#measureRow'], prefill: ({ A }) => ({ measure: 'hours', '@day': DAY[String(A.period || '').toLowerCase()] || '03-20' }) },
  // the same engine measuring with the project's climate file (2026-10-25)
  radiation: { file: 'sunhours', input: 'masses', hide: ['.sec:has(#h-model)', '.sec:has(#h-site)', '#measureRow'], prefill: () => ({ measure: 'radiation' }) },
  utci: { file: 'sunhours', input: 'masses', hide: ['.sec:has(#h-model)', '.sec:has(#h-site)', '#measureRow'], prefill: ({ site }) => ({ measure: 'utci', utciTerrain: { open: '0.14', suburban: '0.22', city: '0.33' }[site?.terrain || 'suburban'] || '0.22' }) },
  wind: { input: 'masses', hide: ['.sec:has(#h-model)'],
    prefill: ({ site }) => ({ dir: windFrom(site), dirR: windFrom(site), speed: Number.isFinite(site?.wind) ? site.wind : null }) },
  daylight: { input: 'studio', hide: ['.sec:has(#h-scene)', PLAN_EDIT],
    prefill: ({ site, A, t }) => ({ north: site?.north || 0, lat: site?.lat, lon: site?.lon, tz: t.tz, wp: A.plane, occ0: A.occStart, occ1: A.occEnd }) },
  vent: { input: 'studio', hide: ['.sec:has(#h-scene)', PLAN_EDIT],
    prefill: ({ site, level }) => ({ wdir: windFrom(site), wspd: Number.isFinite(site?.wind) ? site.wind : null, north: site?.north || 0, floorZ: level?.z }) },
  spacesyntax: { input: 'studio', hide: ['.sec:has(#h-scene)', PLAN_EDIT] },
  movementdepth: { file: 'spacesyntax', input: 'studio', hide: ['.sec:has(#h-scene)', PLAN_EDIT] },
  isovist: { input: 'studio', hide: ['.sec:has(#h-scene)', PLAN_EDIT], prefill: ({ A }) => ({ eye: A.eye }) },
  views: { input: 'studio', hide: ['.sec:has(#h-scene)', PLAN_EDIT] },
  cameras: { input: 'studio', hide: ['.sec:has(#h-scene)', PLAN_EDIT] },
  wayfinding: { input: 'studio', hide: ['.sec:has(#h-scene)'] },
  privacy: { input: 'studio', hide: ['.sec:has(#h-scene)'] },
  noise: { input: 'masses', hide: ['.sec:has(#h-scene)'] },
  acoustics: { file: 'roomacoustics', input: 'studio', hide: ['.sec:has(#h-scene)'], prefill: ({ A }) => ({ band: Math.max(0, BANDS.indexOf(A.band)) }) },
  evac: { input: 'dxf', hide: ['.sec:has(#h-plan) :is(#drop, #pick, #sample, #sampleFlat, div:has(> #pick), div:has(> #sample))'] },
  structure: { input: 'none', hide: [],
    prefill: ({ x, site }) => x && ({ 'q-loc': qloc(site), 'q-storeys': x.storeys, 'q-h': r1(x.h), 'q-nx': Math.max(1, Math.min(8, Math.round(x.w / 6))), 'q-sx': r1(x.w / Math.max(1, Math.min(8, Math.round(x.w / 6)))), 'q-ny': Math.max(1, Math.min(8, Math.round(x.d / 6))), 'q-sy': r1(x.d / Math.max(1, Math.min(8, Math.round(x.d / 6)))) }) },
  stormwater: { input: 'obj', hide: [], prefill: ({ A }) => ({ rain: A.rain, duration: A.duration }) },   // applied in its Imported model tab (feedFile)
};

// ---- what a result keeps for Results: a small picture of the engine's own view, and its per-point values where the engine
// has them (plan metres, the same frame for every version, so two versions can be compared point by point)
function thumbOf(D) {
  try {
    const docs = [D, D.getElementById('modelWorkspace')?.contentDocument, D.getElementById('gridWorkspace')?.contentDocument].filter(Boolean);
    const cvs = docs.flatMap((d) => [...d.querySelectorAll('canvas')]).filter((c) => c.offsetParent && c.width > 80 && c.height > 60);
    const cv = cvs.find((c) => c.id === 'cv') || cvs.sort((a, b) => b.width * b.height - a.width * a.height)[0]; if (!cv) return null;
    const k = Math.min(1,800/cv.width,640/cv.height), c2 = document.createElement('canvas'); c2.width = Math.max(1,Math.round(cv.width*k)); c2.height = Math.max(1,Math.round(cv.height*k)); const g = c2.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c2.width, c2.height); g.drawImage(cv, 0, 0, c2.width, c2.height); return c2.toDataURL('image/jpeg', 0.85);
  } catch (e) { return null; }
}
const r2 = (v) => Math.round(v * 100) / 100;
// points of a plan engine (RES.pts in scene metres) moved back to the model's frame with the scene's origin
function ptsField(R, val, label, unit, origin, n) {
  if (!R?.pts?.length) return null; const [ox, oy] = origin || [0, 0], out = [];
  for (let i = 0; i < R.pts.length; i++) { const v = val(i); if (!Number.isFinite(v)) continue; out.push(r2(R.pts[i].x + ox), r2(R.pts[i].y + oy), r2(v)); }
  return out.length ? { label, unit, step: r2(R.spacing || 0.5), pts: out, n: n || out.length / 3 } : null;
}
const PSIM = (w) => w.__psim?.field?.() || null;   // the plan engines built on emb/lib/plansim.js give their field in model metres
const FIELDS = {
  wayfinding: PSIM, privacy: PSIM, noise: PSIM, acoustics: PSIM,
  daylight: (w, sc) => ptsField(w.__day?.RES, (i) => w.__day.RES.ev[i]?.df, 'Daylight factor', '%', sc?.origin),
  views: (w, sc) => ptsField(w.__views?.RES, (i) => (w.__views.RES.ev[i]?.F ?? NaN) * 100, 'Outward view (share of a 90° cone)', '%', sc?.origin),
  spacesyntax: (w, sc) => ptsField(w.__ss?.RES, (i) => w.__ss.RES.integ?.[i], 'Integration', '', sc?.origin),
  movementdepth: (w, sc) => ptsField(w.__ss?.RES, (i) => w.__ss.RES.integ?.[i], 'Integration', '', sc?.origin),
  // Sun hours: hours on the ground, averaged in square cells; the engine centres the model, so its offset is found from
  // the masses it was given (the scene) and its own copy of them
  sunhours: (w, sc) => sunField(w, sc, 'Sun hours on the ground', 'h'),
  radiation: (w, sc) => sunField(w, sc, 'Solar radiation on the ground', 'kWh/m²'),
  utci: (w, sc) => sunField(w, sc, 'Hours without thermal stress (UTCI 9–26 °C)', '%'),
};
function sunField(w, sc, label, unit) {
    const S0 = w.__sun?.S, R = S0?.lastR || S0?.result?.R, P = R?.prep, pos = S0?.model?.pos; if (!R?.hours || !P?.smpP || !pos || !sc?.masses?.length) return null;
    const vals = R.mode === 'utci' ? R.vals.comfort : R.hours;
    let ex = Infinity, ey = Infinity; for (let i = 0; i < pos.length; i += 3) { if (pos[i] < ex) ex = pos[i]; if (pos[i + 1] < ey) ey = pos[i + 1]; }
    const mx = Math.min(...sc.masses.flatMap((m) => m.outer.map((q) => q[0]))), my = Math.min(...sc.masses.flatMap((m) => m.outer.map((q) => q[1]))), dx = ex - mx, dy = ey - my;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const K = P.smpK, SP = P.smpP;
    for (let k = 0; k < R.hours.length; k++) if (K[k] === 0 && Number.isFinite(vals[k])) { const x = SP[3 * k] - dx, y = SP[3 * k + 1] - dy; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (!Number.isFinite(x0)) return null; const cs = Math.max(0.5, Math.sqrt((x1 - x0) * (y1 - y0) / 2400)), nx = Math.ceil((x1 - x0) / cs) + 1, ny = Math.ceil((y1 - y0) / cs) + 1, sum = new Float64Array(nx * ny), cnt = new Uint32Array(nx * ny);
    for (let k = 0; k < R.hours.length; k++) if (K[k] === 0 && Number.isFinite(vals[k])) { const i = Math.floor((SP[3 * k] - dx - x0) / cs), j = Math.floor((SP[3 * k + 1] - dy - y0) / cs), q = j * nx + i; sum[q] += vals[k]; cnt[q]++; }
    const out = []; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = j * nx + i; if (cnt[q]) out.push(r2(x0 + (i + 0.5) * cs), r2(y0 + (j + 0.5) * cs), r2(sum[q] / cnt[q])); }
    return { label, unit, step: r2(cs), pts: out };
}
const SUN = ['sunhours', 'radiation', 'utci'], WEATHER = ['vent', 'daylight', 'radiation', 'utci', 'wind'];

export async function render(app, sim, params = new URLSearchParams(),context={}) {
  if (!canUse(sim.id)) {
    renderGate(app, sim.name);
    if (params.get('batch')) window.parent.postMessage({pcBatch:params.get('batch'),ok:false,why:'Paid beta access required.'},location.origin);
    return;
  }
  // batch: Results runs this page in a hidden frame for one simulation of a batch (#/batch-run?…): the project, version,
  // level, room and parameter changes come in the address, the engine runs on its own and the result goes back to Results
  const batch = params.get('batch'), pilot=S.isSharedPilot(sim.id), cfg = pilot&&SUN.includes(sim.id)?{...CFG[sim.id],hide:['.sec:has(#h-model)','#measureRow']}:CFG[sim.id], p = batch ? S.project(params.get('project')) : currentProject();
  const tell = (m) => { if (batch) try { window.parent.postMessage({ pcBatch: batch, sim: sim.id, ...m }, location.origin); } catch (e) { } };
  if (!p) { app.innerHTML = '<div class="wrap"><p>No project. <a href="#/">Create one on Home.</a></p></div>'; tell({ ok: false, why: 'No project.' }); return; }
  if (!batch) setCurrent(p);
  const shared=pilot||sim.id==='vent'?S.clone(S.conditionsOf(p)):null;
  const v = batch ? S.version(p, params.get('version')) : currentVersion(p), site = shared?shared.site:S.siteOf(p), A = shared?shared.defaults:S.account().defaults, t = tzInfo(site), file = cfg.file || sim.id;
  const readiness=inspectStudy(p,v,sim.id,{site,defaults:A});
  if(site?.climate?.hash&&WEATHER.includes(sim.id)){
    try{if(!await climateFile(site.climate.hash))readiness.errors.push({title:'Restore the project weather file',detail:'The EPW reference exists, but its contents are missing from this browser. Upload the original file again.',href:'#/project-settings/'+p.id});}catch{readiness.errors.push({title:'Weather storage is unavailable',detail:'Allow browser storage or re-upload the project EPW before running.',href:'#/project-settings/'+p.id});}
  }
  if(context.isCurrent&&!context.isCurrent())return;
  const reviewRows=checks=>checks.map(c=>`<li style="margin:12px 0"><b>${esc(c.title)}</b><br><span class="note">${esc(c.detail)}</span>${c.href?` · <a href="${esc(c.href)}">Review input</a>`:''}</li>`).join('');
  if(readiness.errors.length){
    app.innerHTML=`<div class="wrap"><span class="eyebrow">${esc(sim.name)} · Input check</span><h1 class="display md">Complete these inputs first.</h1><p class="lede">Your existing model and results are kept. Resolve the items below, then reopen the study.</p><ul>${reviewRows(readiness.errors)}</ul><a class="btn" href="#/workspace/${esc(p.id)}">Open Workspace</a> <a class="btn" href="#/project-settings/${esc(p.id)}">Project conditions</a> <button type="button" class="btn" id="retryReadiness">Check again</button>${!v&&p.draft?'<button type="button" class="btn accent" id="saveFirstVersion">Save draft as a version and recheck</button>':''}<p style="margin-top:24px"><a href="#/start-study">Try a guided example</a> · <a href="#/simulations">All studies</a></p></div>`;
    $('#retryReadiness',app).onclick=()=>route();$('#saveFirstVersion',app)?.addEventListener('click',()=>{const saved=S.saveVersion(p,'Saved for '+sim.name);setCurrentVersion(p,saved.id);route();});tell({ok:false,why:readiness.errors.map(c=>c.title+': '+c.detail).join(' ')});return;
  }
  const levels = v ? levelsOf(v.model) : [], lvKey = `pc-sim-level:${p.id}`, lvPick = batch ? params.get('level') : (() => { try { return sessionStorage.getItem(lvKey); } catch (e) { return null; } })();
  const lvIx = Math.max(0, Math.min(levels.length - 1, levels.findIndex((L) => 'L' + L.n === lvPick))), level = levels[lvIx] ? { id: 'L' + levels[lvIx].n, z: levels[lvIx].z } : null;
  const perLevel = cfg.input === 'studio' || cfg.input === 'dxf';
  // an engine with input 'room' studies one closed room, which goes in as its own wall loop (none does at the moment: Indoor acoustics takes the whole level)
  const rooms = v && cfg.input === 'room' ? v.model.components.filter((c) => c.type === 'room') : [], rmKey = `pc-sim-room:${p.id}`, rmPick = (() => { try { return sessionStorage.getItem(rmKey); } catch (e) { return null; } })();
  const room = rooms.find((c) => c.id === (batch ? params.get('room') : rmPick)) || rooms[0] || null;
  app.innerHTML = `<div class="shx" style="position:relative">
    <div class="shbar" role="region" aria-label="Simulation">
      <a class="btn sm ghost" href="${simBack()}">← Back</a>
      <b class="shname">${esc(sim.name)}</b>${LIVE}
      <label class="shsel">Project<select id="proj">${S.projects().map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label class="shsel">Version<select id="ver">${p.versions.slice().reverse().map((x) => `<option value="${x.id}" ${x === v ? 'selected' : ''}>v${x.n} — ${esc(x.note)}</option>`).join('') || '<option>No saved versions</option>'}</select></label>
      ${perLevel && levels.length > 1 ? `<label class="shsel">Level<select id="lvl">${levels.map((L, i) => `<option value="L${L.n}" ${i === lvIx ? 'selected' : ''}>Level ${L.n}</option>`).join('')}</select></label>` : ''}
      ${rooms.length ? `<label class="shsel">Room<select id="room">${rooms.map((c) => `<option value="${c.id}" ${c === room ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>` : ''}
      <a class="shsite" href="${pilot?'#/project-settings/'+p.id+'?return='+sim.id:'#/account'}">${pilot?`${esc((site?.label||'Site').split(',')[0])} · Shared r${shared.revision} ↗`:`${esc((site?.label || '—').split(',').slice(0, 2).join(','))}${site?.sample ? ' (sample)' : ''} · north ${site?.north ?? 0}° · UTC${t.tz >= 0 ? '+' : ''}${t.tz}${t.dst ? ' with DST' : ''}`}</a>
      <button type="button" class="btn sm" id="reviewInputs">Review inputs${readiness.warnings.length?' ('+readiness.warnings.length+')':''}</button>
      <span class="sp"></span>
      <span class="note" id="shmsg" role="status" aria-live="polite"></span>
      <button class="btn sm primary" id="save" disabled>Save result${v ? ` to v${v.n}` : ''}</button>
    </div>
    ${v ? `<iframe id="eng" data-emb="${sim.id}" title="${esc(sim.name)}" style="visibility:hidden" src="../emb/${file}.html?layout=unified&v=${encodeURIComponent(ENGINE_RELEASE)}${pilot?'&pilot=shared':''}"></iframe><div id="engineLoading" role="status" style="position:absolute;inset:80px 0 0;display:grid;place-items:center;background:var(--bg);z-index:2">Loading saved model and current Settings…</div>` : `<div class="wrap"><p class="note">Save a model version first: <a href="#/workspace">open the Workspace</a>.</p></div>`}
  </div>`;
  const review=document.createElement('dialog');review.setAttribute('aria-label','Study input review');review.style.cssText='max-width:720px;max-height:85vh;overflow:auto;background:var(--card);color:var(--ink);border:1px solid var(--line2);border-radius:12px;padding:24px';review.innerHTML=`<h2>${esc(sim.name)} · v${v.n}</h2><p>Review these inputs before calculating. Model preparation in the engine still checks the selected level and closed rooms.</p><ul>${reviewRows(readiness.checks)}</ul><h3>Next steps</h3><ol><li>Run the analysis using the study’s Calculate or Run button.</li><li>Use Save result above to keep the actual result on v${v.n}.</li><li>Edit one design variable in Workspace and save a new version.</li><li>Run the same study with matching conditions, then compare in Results.</li></ol><button type="button" class="btn accent" id="closeReview">Continue to study</button>`;app.querySelector('.shx').append(review);$('#reviewInputs',app).onclick=()=>review.showModal();$('#closeReview',app).onclick=()=>review.close();
  $('#proj', app).onchange = (e) => { setCurrent(S.project(e.target.value)); route(); };
  if(sim.id==='vent'){$('.shsite',app).href='#/project-settings/'+p.id+'?return=vent';$('.shsite',app).textContent=`${site.label||'Site'} · Shared r${shared.revision} ↗`;}
  $('#ver', app).onchange = (e) => { setCurrentVersion(p, e.target.value); route(); };
  const lvSel = $('#lvl', app); if (lvSel) lvSel.onchange = (e) => { try { sessionStorage.setItem(lvKey, e.target.value); } catch (er) { } route(); };
  const rmSel = $('#room', app); if (rmSel) rmSel.onchange = (e) => { try { sessionStorage.setItem(rmKey, e.target.value); } catch (er) { } route(); };
  if (!v) { tell({ ok: false, why: 'No saved version.' }); return; }

  const fr = $('#eng', app), msg = $('#shmsg', app), saveBtn = $('#save', app), name = `${p.name} · v${v.n}`, x = extent(v.model);
  $('#engineLoading',app).style.top=$('.shbar',app).offsetHeight+'px';
  const ctx = { site, A, t, level, x, room }, filled = {};
  // what this simulation takes from Account, shown in the bar (site, north and time zone are always there)
  const linked = Object.entries(cfg.prefill?.(ctx) || {}).filter(([id, val]) => ACCT[id] && val != null && val !== '' && !(typeof val === 'number' && !Number.isFinite(val)));
  { const chip = $('.shsite', app), more = linked.filter(([id]) => !['lat', 'lon', 'tz', 'north'].includes(id) && !(id === 'wdir' && linked.some(([k]) => k === 'dir')));
    if (more.length&&!pilot) chip.insertAdjacentHTML('beforeend', more.map(([id, val]) => ` · ${esc(ACCT[id][0])} ${esc(shown(id, val))}`).join(''));
    chip.title = `Linked to Account${p.siteLinked === false ? ' (this project keeps its own site)' : ''}: change a value there and this simulation uses it the next time it opens. Values changed here are recorded with the result.\n`
      + [`Site ${site?.label || '—'}`, ...linked.map(([id, val]) => `${ACCT[id][0]} ${shown(id, val)}`)].join('\n'); }
  if(pilot)$('.shsite',app).title='Frozen project conditions · edit once for Sun Hours and Daylight. Account changes do not update this project.';
  let alive = true, loaded = false, sentScene = null, done = false, batchNoResult = false, pilotRunSnapshot=null; const ovApply = {};
  const doc = () => { try { return fr.contentDocument; } catch (e) { return null; } };
  const say = (h, warn) => { msg.innerHTML = h; msg.classList.toggle('warn', !!warn); };
  let revealing=false;
  function revealEngine(){
    if(revealing||fr.dataset.pcVisibleReady==='true')return;revealing=true;
    const loading=$('#engineLoading',app),started=Date.now();
    const probe=()=>{
      if(!alive||!fr.isConnected)return;
      const D=doc(),documents=D?[D,...[...D.querySelectorAll('iframe')].filter(f=>!f.hidden&&f.getBoundingClientRect().width).map(f=>{try{return f.contentDocument;}catch{return null;}}).filter(Boolean)]:[];
      if(fr.dataset.pcSettingsReady==='true'&&documents.some(d=>d.querySelector('.app[data-pc-unified=true]'))&&!documents.some(d=>d.body?.dataset.pcSharedWeatherLoading)){
        fr.style.visibility='visible';fr.dataset.pcVisibleReady='true';loading?.remove();return;
      }
      if(loading){loading.style.top=$('.shbar',app).offsetHeight+'px';if(Date.now()-started>15000)loading.textContent='Still preparing the selected model and Settings. Please wait…';}
      setTimeout(probe,50);
    };requestAnimationFrame(probe);
  }

  // the engine's own input, made from the version
  const input = (() => {
    // a project with a site or masses in its Plan Studio model: Sun hours reads Plan Studio's own scene (masses, the site's buildings standing on the terrain, location)
    // Outdoor noise reads the same scene with the site's roads, green and water areas added (2026-10-25)
    if (cfg.input === 'masses' && (SUN.includes(sim.id) || sim.id === 'noise') && v.model.studio && v.model.studio.v === 2 && ((v.model.studio.masses || []).length || v.model.studio.site))
      return studioScene(v, site, p.name, SUN.includes(sim.id) ? 'sunhours' : sim.id).then((r) => { if (!r.ok) return r; const sc = JSON.parse(r.scene); return { ...r, info: `${sc.masses.filter((m) => m.role === 'proposed').length} blocks, ${sc.masses.filter((m) => m.role === 'context').length} neighbours${sc.roads ? `, ${sc.roads.length} road${sc.roads.length === 1 ? '' : 's'}` : ''}${sc.terrain ? ', terrain' : ''}` }; });
    if (cfg.input === 'masses') { const sc = sunScene(v.model, site, { name, project: p.id, version: v.id }); return Promise.resolve({ ok: true, scene: JSON.stringify(sc), info: `${sc.masses.filter((m) => m.role === 'proposed').length} blocks, ${sc.masses.filter((m) => m.role === 'context').length} neighbours` }); }
    if (cfg.input === 'studio') return studioScene(v, site, p.name, sim.id === 'movementdepth' ? 'movementdepth' : sim.id, level?.id);
    if (cfg.input === 'dxf') return studioDXF(v, site, p.name, level?.id);
    if (cfg.input === 'room') { if (!room) return Promise.resolve({ ok: false, why: ['Draw a room in the Workspace first.'] });
      const g = room.g, q = [[g.x, g.y], [g.x + g.w, g.y], [g.x + g.w, g.y + g.d], [g.x, g.y + g.d]].map((pt) => pt.map((n) => +n.toFixed(3)));
      return Promise.resolve({ ok: true, info: room.name, scene: JSON.stringify({ name: room.name, walls: q.map((a, i) => ({ a, b: q[(i + 1) % 4], h: +g.h.toFixed(3) })), source: { app: 'plotcloud-workspace', project: p.id, version: v.id, room: room.id } }) }); }
    return Promise.resolve({ ok: true });
  })();
  input.catch(() => null).then((r) => { if (!alive || !r) return; if (!r.ok && /no closed rooms/i.test((r.why || []).join(' ')) && ((v.model.studio && v.model.studio.masses) || []).length) r.why = [...(r.why || []), 'This version has masses but no rooms yet: in the Workspace, select a mass and use Make floors in its panel.'];
    if (!r.ok) { const loading=$('#engineLoading',app);if(loading)loading.innerHTML=`<div style="padding:24px;max-width:650px"><h2>Review the model for this study</h2><p>${esc((r.why||[]).join(' '))}</p><a class="btn accent" href="#/workspace/${esc(p.id)}">Open Workspace</a> <a class="btn" href="#/start-study">Try an example</a></div>`;say(`This version can't run here yet: ${esc((r.why || []).join(' '))} <a href="#/workspace">Open the Workspace</a>`, true); tell({ ok: false, why: `This version can't run here yet: ${(r.why || []).join(' ')}` }); } });
  input.catch((e) => { if (alive) { const loading=$('#engineLoading',app);if(loading)loading.textContent=e.message||'The model could not be prepared.';say(esc(e.message || 'The model could not be prepared.'), true); tell({ ok: false, why: e.message || 'The model could not be prepared.' }); } });

  // the engine asks for the model at once (it is waiting for this page) instead of after its demo analysis
  window.__pcHO = { tool: sim.id };
  const onMsg = async (e) => {
    if (e.source !== fr.contentWindow || !e.data?.pc) return; const d = e.data;
    if (d.t === 'hello' && (cfg.input === 'masses' || cfg.input === 'studio' || cfg.input === 'room')) {
      const r = await input.catch(() => null); if (!alive || !r?.ok) return;
      try { sentScene = JSON.parse(r.scene); } catch (er) { sentScene = null; }
      fr.contentWindow.postMessage({ pc: 1, t: 'project', scene: r.scene, name, source: { app: 'plotcloud-workspace', project: p.id, version: v.id, level: level?.id || 'all', ...(room ? { room: room.id } : {}) } }, '*');
      loaded = true; say(`Model: ${esc(name)}${r.info ? ' · ' + esc(r.info) : level && levels.length > 1 ? ' · Level ' + level.id.slice(1) : ''}`); setTimeout(prefill, 900); if (batch) setTimeout(autoRun, 1500);
    }
    if (d.t === 'save') {
      store(Array.isArray(d.kpis) ? d.kpis : [], d.analysis);
    }
  };
  addEventListener('message', onMsg);

  // Account values into the engine's own inputs (each stays editable there)
  const OV = (() => { try { return JSON.parse(params.get('ov') || '{}'); } catch (e) { return {}; } })();   // values changed in the batch panel
  let weatherTask=null,weatherFailure=null;
  function prefill(skipDate=false) {
    const D = doc(), vals = Object.assign({}, pilot?{city:'custom',lat:site.lat,lon:site.lon,tz:t.tz,north:site.north??0}: {}, cfg.prefill?.(ctx) || {}); if (!alive || !D) return;
    if (batch) for (const [id, val] of Object.entries(OV)) if (val != null && val !== '') { if (!(id in vals)) vals[id] = val; else ovApply[id] = val; }
    for (const [id, val] of Object.entries(vals)) { if (id === '@day') {if(skipDate)continue; const b = D.querySelector(`#daySeg [data-d="${val}"]`); if (b) { b.click(); filled[id] = val; } continue; }
      const el = D.getElementById(id); if (!el || val == null || (typeof val === 'number' && !Number.isFinite(val))) continue;
      el.value = String(val); filled[id] = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
    if(p.guidedStudy?.simId===sim.id&&!D.body.dataset.pcGuidedQuality){const draft=D.querySelector('#lvlSeg [data-l="draft"],#lvSeg [data-l="draft"]');if(draft){draft.click();D.body.dataset.pcGuidedQuality='true';}}
    // Distinguish the engine's startup sample from the project's applied model/settings.
    if(pilot)bindPilot();else fr.dataset.pcSettingsReady = 'true';
    if(WEATHER.includes(sim.id)&&!weatherTask){weatherTask=applyProjectClimate(fr,shared?site:{...site,climate:S.conditionsOf(p).site.climate},sim.id,()=>{location.hash='#/project-settings/'+p.id+'?return='+sim.id;});weatherTask.then(()=>fr.contentWindow.PlotCloudSimulationFit?.refresh()).catch(error=>{if(sim.id!=='wind')weatherFailure=error;say(esc(error.message),true);fr.contentWindow.PlotCloudSimulationFit?.refresh();});}
    fr.contentWindow.PlotCloudSimulationFit?.refresh();
    revealEngine();
    for(const child of D.querySelectorAll('iframe'))try{child.contentWindow.PlotCloudSimulationFit?.refresh();}catch{}
  }
  function bindPilot(){
    const D=doc(),box=D?.getElementById('pilotSharedSummary');if(!box){if(alive)setTimeout(bindPilot,100);return;}
    box.innerHTML=`<b>From project · revision ${shared.revision}</b><br>${esc((site.label||'Site').split(',')[0])} · north ${site.north??0}° · UTC${t.tz>=0?'+':''}${t.tz}${sim.id==='daylight'?`<br>Work plane ${A.plane} m · occupied ${A.occStart}:00–${A.occEnd}:00`:''}<br><a id="pilotEditProject" href="#">Edit shared conditions ↗</a><p id="pilotOverrideStatus" role="status">Using project values</p>`;
    D.getElementById('pilotEditProject').onclick=e=>{e.preventDefault();location.hash='#/project-settings/'+p.id+'?return='+sim.id;};
    fr.dataset.pcSettingsReady='true';if(D.body.dataset.pcPilotBound)return;D.body.dataset.pcPilotBound='1';
    if(sim.id==='daylight'&&!fr.contentWindow.__pcAnalysisState?.().ready){const note=D.getElementById('runMsg');if(note){note.textContent='Workspace model and project inputs applied. Run this study to calculate current results.';note.className='msg';}}
    const enabled=D.getElementById('pilotOverrideEnabled'),fields=D.getElementById('pilotSharedFields'),status=()=>{D.getElementById('pilotOverrideStatus').textContent=enabled.checked?'Study-only overrides enabled · project unchanged':'Using project values';};
    enabled.onchange=()=>{fields.disabled=!enabled.checked;if(!enabled.checked)prefill(true);status();};
    D.getElementById('pilotResetShared').onclick=()=>{enabled.checked=false;fields.disabled=true;prefill(true);status();};
    const capture=()=>{pilotRunSnapshot={revision:shared.revision,signature:S.conditionsSignature({sharedConditions:shared},sim.id),site:S.clone(site),defaults:S.clone(A),studyOnlyOverrides:enabled.checked,effective:fr.contentWindow.__pcAnalysisState?.().conditions||{}};};
    for(const id of ['run','longGo','lvStart'])D.getElementById(id)?.addEventListener('click',capture,true);
    D.getElementById('epwF')?.addEventListener('change',()=>{if(D.body.dataset.pcSharedWeatherLoading)return;enabled.checked=true;fields.disabled=false;status();});
  }
  // file-based inputs (DXF plan, OBJ site) go into the engine's own file picker, as if the person had opened the file
  const giveFile = (input, text, fname, type) => { const dt = new DataTransfer(); dt.items.add(new File([text], fname, { type })); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); };
  async function feedFile() {
    const D = doc(); if (!D) return;
    if (cfg.input === 'dxf') { const r = await input.catch(() => null); if (!alive || !r?.ok) return; const f = D.getElementById('file'); if (!f) return;
      giveFile(f, r.text, `${p.name}-v${v.n}-${level?.id || 'L1'}.dxf`.replace(/[^\w.-]+/g, '-'), 'application/dxf'); await D.defaultView.__pcInputReady;if(!alive)return;loaded = true; say(`Model: ${esc(name)} · ${level ? 'Level ' + level.id.slice(1) : 'plan'} as DXF`); }
    if (cfg.input === 'obj') {
      const g = D.getElementById('gridWorkspace'), gw = g?.contentDocument; const imp = [...(gw?.querySelectorAll('button') || [])].find((b) => b.textContent.trim() === 'Imported model'); if (!imp) return;
      imp.click(); let m = null; for (let i = 0; i < 60 && alive; i++) { m = D.getElementById('modelWorkspace')?.contentDocument; if (m?.getElementById('file') && m.getElementById('rain')) break; await new Promise((r) => setTimeout(r, 150)); }
      if (!m?.getElementById('file')) return;
      const site3d = { ...v.model, components: v.model.components.filter((c) => ['wall', 'slab', 'roof', 'mass', 'terrain', 'imported'].includes(c.type)) };
      const set = (id, val) => { const el = m.getElementById(id); if (el && val != null) { el.value = String(val); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); filled[id] = val; } };
      set('units', [...(m.getElementById('units')?.options || [])].find((o) => /met/i.test(o.textContent))?.value); set('axis', [...(m.getElementById('axis')?.options || [])].find((o) => /y up/i.test(o.textContent))?.value);
      giveFile(m.getElementById('file'), await obj(site3d).text(), `${p.name}-v${v.n}.obj`.replace(/[^\w.-]+/g, '-'), 'text/plain');
      setTimeout(() => { set('rain', A.rain); set('duration', A.duration); }, 600);
      loaded = true; say(`Model: ${esc(name)} as OBJ · design storm ${A.rain} mm/h for ${A.duration} min from Account`);
    }
    if (cfg.input === 'none') { prefill(); loaded = true; say(`Model: ${esc(name)} · ${x ? `${x.storeys} storey${x.storeys > 1 ? 's' : ''}, ${r1(x.w)} × ${r1(x.d)} m` : 'no walls yet'}`); }
    else if(loaded)prefill();
  }

  // the engine's own figures for this run
  function kpisNow() {
    const D = doc(); if (!D) return [];
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
    if (sim.id === 'stormwater') { const m = D.getElementById('modelWorkspace'); const W = m && !m.hidden ? m.contentDocument : D.getElementById('gridWorkspace')?.contentDocument; if (!W) return [];
      return [...W.querySelectorAll('.kp4 > div')].map((el) => [txt(el.querySelector(':scope > small')), txt(el.querySelector(':scope > b'))]).filter(([k, s]) => k && s && !/^—/.test(s)); }
    return [];
  }
  function store(kpis, analysis = null) {
    if((WEATHER.includes(sim.id)&&sim.id!=='wind'&&!weatherTask)||weatherFailure||doc()?.body.dataset.pcSharedWeatherLoading){say('Project weather is not ready. Resolve the shared EPW before saving.',true);return;}
    if(pilot){const ready=SUN.includes(sim.id)?!!fr.contentWindow.__sun?.S.lastR&&!fr.contentWindow.__sun.S.busy:fr.contentWindow.__pcAnalysisState?.().ready;
      if(!ready||!pilotRunSnapshot){say('Run the current Workspace model and settings before saving.',true);if(batch)batchNoResult=true;return;}}
    let K = kpis.map(([k, s]) => [String(k), String(s ?? '').trim()]).filter(([, s]) => s && !/^[—–-]+(\s|$)/.test(s));
    const D = doc();
    if (SUN.includes(sim.id)) { const stats = [...(D?.querySelectorAll('#stats dt') || [])].map((dt) => [dt.textContent.trim(), (dt.nextElementSibling?.textContent || '').trim()]); K = K.concat(stats.filter(([k]) => !/window|extent/i.test(k))); }
    if (!K.some(([, s]) => /\d/.test(s))) { say('Run the analysis first; then save its result.', true); if (batch) batchNoResult = true; return; }
    const results = { kpis: K };
    const th = thumbOf(D); if (th) results.thumb = th;
    try { const f = FIELDS[sim.id]?.(fr.contentWindow, sentScene); if (f && f.pts.length) results.field = f; } catch (e) { }
    for (const [k, , , , re] of sim.metrics) { const hit = re && K.find(([l]) => re.test(l)); if (hit) results[k] = num(hit[1]); }
    // the Account values this run used, and any changed in the engine before it ran
    const cur = (id) => { if (id === '@day') return D?.querySelector('#daySeg [aria-pressed="true"]')?.dataset.d;
      const W = sim.id === 'stormwater' ? D?.getElementById('modelWorkspace')?.contentDocument : D, el = W?.getElementById(id); return el ? el.value : undefined; };
    const fromAccount = {}, changed = [], model = {};
    for (const [id, val] of Object.entries(filled)) { if (!ACCT[id]) { model[id] = val; continue; }
      const k = ACCT[id][0], now = cur(id); fromAccount[k] = shown(id, val);
      if (now != null && String(now) !== String(val) && !(now !== '' && Number(now) === Number(val))) changed.push(`${k} ${shown(id, now)} (Account ${shown(id, val)})`); }
    const settings = { site: site?.label, ...(perLevel && level ? { level: level.id } : {}), ...(room ? { room: room.name } : {}), ...fromAccount, ...(changed.length ? { 'changed here': changed.join('; ') } : {}), ...model };
    if(pilot){settings.sharedConditions=S.clone(pilotRunSnapshot);settings.sharedConditions.effective=S.clone(SUN.includes(sim.id)?{...fr.contentWindow.__sun.S.loc,north:fr.contentWindow.__sun.S.north}:fr.contentWindow.__pcAnalysisState?.().conditions||{});settings.inheritedFrom='Project shared conditions';}
    if(sim.id==='vent'){settings.sharedConditions={revision:shared.revision,signature:S.conditionsSignature({sharedConditions:shared},'vent'),site:S.clone(site),effective:S.clone(fr.contentWindow.__vent?.S||{})};settings.inheritedFrom='Project shared conditions';}
    if(SUN.includes(sim.id)&&fr.contentWindow.__sun?.S?.lastR?.mode){const s=fr.contentWindow.__sun.S,r=s.lastR,c=fr.contentWindow.__sunClimate?.CLIM?.E;settings.analysisPeriod={hours:r.clim.period,count:r.clim.hoursN};settings.climateFile=c?{name:c.name,station:c.station,lat:c.lat,lon:c.lon}:null;settings.grid=r.prep.s;settings.method=r.mode==='radiation'?'Perez sky, 145 patches, sun in 3° groups':'UTCI with SolarCal MRT';if(r.mode==='utci')settings.utci={hoursCounted:r.clim.counted,sunUpOnly:r.clim.day,windExposure:r.clim.alpha};settings.units=r.mode==='radiation'?'kWh/m²':'% of counted hours';}
    else if(sim.id==='sunhours'){const s=fr.contentWindow.__sun?.S,r=s?.lastR;if(r){settings.analysisPeriod=r.period||{start:r.ds,end:r.ds,days:1,t0:s.t0,t1:s.t1};settings.grid=r.prep.s;settings.timeStep=s.step;settings.timeZone={...s.loc};settings.units=r.period?'cumulative sunlight hours':'sunlight hours';}}
    settings.provenance={schema:1,engine:sim.id,engineRelease:ENGINE_RELEASE,versionId:v.id,recordedAt:new Date().toISOString(),site:{label:site?.label,lat:site?.lat,lon:site?.lon,north:site?.north??0,tz:site?.tz},note:'Host context at save time; study overrides and effective run settings are recorded separately.'};
    if (batch) { done = true; tell({ ok: true, settings, results }); say('Done · handed to Results'); return; }
    try { S.addRun(p, v.id, sim.id, settings, results, 'full-tool'); } catch (error) { say('This result could not be saved: ' + esc(error.message || 'storage unavailable'), true); try { fr.contentWindow.postMessage({ pc: 1, t: 'error', msg: 'Project save failed. Export JSON to keep this result.' }, '*'); } catch {} return; }
    try { fr.contentWindow.postMessage({ pc: 1, t: 'saved', count: p.runs.filter((r) => r.versionId === v.id && r.simId === sim.id).length }, '*'); } catch (e) { }
    toast(`Saved to v${v.n}`); say(p.versions.length<2?`Saved to v${v.n} · <a href="#/workspace/${p.id}">Edit one design change →</a>`:`Saved to v${v.n} · <a href="#/results/${p.id}?sim=${sim.id}">Compare versions →</a>`);
  }
  // batch: run the engine the way a person would (its own Run button, its own Start confirmation for long runs), wait until it
  // is idle with figures that came from this run, then save through the same path as "Save result"
  const domK = (D) => [...D.querySelectorAll('.kpis > div, .kp4 > div, #stats dt')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).join('|');
  const busyNow = (D) => { const vis = (el) => el && !el.hidden && el.offsetParent !== null; return vis(D.getElementById('prog')) || vis(D.getElementById('runPill')) || vis(D.getElementById('stopRun')) || !!D.getElementById('run')?.disabled; };
  async function autoRun() {
    try{await weatherTask;}catch(error){tell({ok:false,why:error.message});return;}
    if (!alive || done) return; const D = doc(); if (!D) { tell({ ok: false, why: 'The engine did not load.' }); return; }
    tell({ stage: 'running' });
    for (const [id, val] of Object.entries(ovApply)) { if (id === '@day') { const b = D.querySelector(`#daySeg [data-d="${val}"]`); if (b) b.click(); continue; }
      const el = D.getElementById(id); if (el) { el.value = String(val); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } }
    const before = domK(D), t0 = Date.now(); let sawBusy = false, calm = 0, tries = 0;
    const run = D.getElementById('run'); if (run && !run.disabled) run.click();
    await new Promise((r) => setTimeout(r, 700)); const lg = D.getElementById('longGo'); if (lg && lg.offsetParent !== null && !lg.disabled) lg.click();
    const limit = sim.id === 'vent' || sim.id === 'wind' ? 600000 : 240000;
    while (alive && !done) {
      await new Promise((r) => setTimeout(r, 500)); const D2 = doc(); if (!D2) break;
      if (busyNow(D2)) { sawBusy = true; calm = 0; } else calm++;
      const fresh = sawBusy || domK(D2) !== before || Date.now() - t0 > 12000 || !run;
      if (calm >= 3 && fresh && Date.now() - t0 > 2000) { batchNoResult = false; saveBtn.onclick(); await new Promise((r) => setTimeout(r, 900)); if (done) return; if (batchNoResult && ++tries > 6) { tell({ ok: false, why: msg.textContent || 'The engine gave no figures.' }); return; } calm = 0; }
      if (Date.now() - t0 > limit) { tell({ ok: false, why: `No result after ${Math.round(limit / 1000)} s.` }); return; }
    }
  }
  saveBtn.onclick = () => {
    const D = doc(); if (!D) return;
    const own = cfg.save ? D.querySelector(cfg.save) : D.getElementById('pcAdd');
    if (own && !own.disabled) { own.click(); return; }
    store(kpisNow());
  };

  // the page shell around the engine: style only
  const CSS = `
    ${cfg.hide.join(', ')}${cfg.hide.length ? ', ' : ''}.pcproj { display: none !important; }
    #panelL, #panelL > .colIn, #panelR, #panelR > .colIn { overflow: hidden !important; }
    .col > .colIn { transform: none !important; width: auto !important; }
    .sec.pc-col > :not(h2) { display: none !important; }
    .sec > h2.pc-tog { cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: space-between; }
    .sec > h2.pc-tog::after { content: '–'; font: 600 14px ui-monospace, monospace; color: #8a8f98; }
    .sec.pc-col > h2.pc-tog::after { content: '+'; }
    `;
  let tries = 0;
  const shell = () => {
    const D = doc(); if (!alive) return;
    const ready = D && D.readyState !== 'loading' && D.body && (sim.id === 'stormwater' ? D.getElementById('gridWorkspace')?.contentDocument?.querySelector('h2') : D.querySelector('.sec h2'));
    if (!ready) { if (tries++ < 200) setTimeout(shell, 100); return; }
    if (!D.getElementById('pc-shell')) { const st = D.createElement('style'); st.id = 'pc-shell'; st.textContent = CSS; D.head.appendChild(st); }
    installSimulationFit(D);
    // every row the engine reports stays visible: its shell trims rows to fit a short window, here the columns scroll instead
    const unfit = () => D.querySelectorAll('[data-fit]').forEach((el) => el.removeAttribute('data-fit'));
    if (!D.body.dataset.pcUnfit) { D.body.dataset.pcUnfit = '1'; new MutationObserver(unfit).observe(D.body, { subtree: true, attributes: true, attributeFilter: ['data-fit'] }); unfit(); }
    // the left column stays open in every view (the engine's own shell folds it into numbered buttons outside Plan + chart)
    const appEl = D.querySelector('.app'); if (appEl && !appEl.dataset.pcOpen) { appEl.dataset.pcOpen = '1';
      const unrail = () => { if (appEl.classList.contains('railL') || appEl.classList.contains('peek')) { appEl.classList.remove('railL', 'peek'); D.defaultView.dispatchEvent(new Event('resize')); } };
      new MutationObserver(unrail).observe(appEl, { attributes: true, attributeFilter: ['class'] }); unrail(); }
    for (const sec of D.querySelectorAll('#panelL .sec, .app > .col:first-child .sec')) { const h = sec.querySelector(':scope > h2'); if (!h || h.classList.contains('pc-tog')) continue; const k = `pc-sim-col:${sim.id}:` + h.textContent.trim();
      h.classList.add('pc-tog'); h.tabIndex = 0; h.setAttribute('role', 'button'); try { if (localStorage.getItem(k) === '1') sec.classList.add('pc-col'); } catch (e) { }
      h.setAttribute('aria-expanded', String(!sec.classList.contains('pc-col')));
      const tog = () => { sec.classList.toggle('pc-col'); h.setAttribute('aria-expanded', String(!sec.classList.contains('pc-col'))); try { localStorage.setItem(k, sec.classList.contains('pc-col') ? '1' : '0'); } catch (e) { } };
      h.addEventListener('click', tog); h.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(); } }); }
    saveBtn.disabled = false;
    D.defaultView.dispatchEvent(new Event('resize'));
    if (!loaded && (cfg.input === 'dxf' || cfg.input === 'obj' || cfg.input === 'none')) setTimeout(async () => { await feedFile(); if (batch && loaded) setTimeout(autoRun, cfg.input === 'obj' ? 2500 : 1500); }, cfg.input === 'none' ? 300 : 1200);
  };
  fr.addEventListener('load', () => { tries = 0; loaded = false; shell(); }); shell();
  return () => { alive = false; removeEventListener('message', onMsg); delete window.__pcHO; };
}

// ---- for the batch panel in Results: the inputs this engine takes from Account (the ones its own left column prefills),
// with the value the page would put in them, and how to show them; changes there go to the engine the same way
const OPTS = { band: BANDS.map((b, i) => [i, b]), '@day': [['03-20', 'Mar 20 (equinox)'], ['06-21', 'Jun 21 (summer solstice)'], ['12-21', 'Dec 21 (winter solstice)']], 'q-loc': Object.entries(QNAME) };
export function batchInfo(simId, p, v) {
  const cfg = CFG[simId]; if (!cfg) return null; const shared=S.isSharedPilot(simId)?S.conditionsOf(p):null,site = shared?shared.site:S.siteOf(p), A = shared?shared.defaults:S.account().defaults, t = tzInfo(site), levels = v ? levelsOf(v.model) : [];
  const rooms = v && cfg.input === 'room' ? v.model.components.filter((c) => c.type === 'room') : [];
  const ctx = { site, A, t, level: levels[0] ? { id: 'L' + levels[0].n, z: levels[0].z } : null, x: v ? extent(v.model) : null, room: rooms[0] || null };
  const fields = Object.entries(cfg.prefill?.(ctx) || {}).filter(([id, val]) => ACCT[id] && val != null && !(typeof val === 'number' && !Number.isFinite(val)) && !(id === 'wdir' && false))
    .map(([id, val]) => ({ id, label: ACCT[id][0], unit: ACCT[id][1].startsWith(':') ? '' : ACCT[id][1], value: val, options: OPTS[id] || null }));
  return { fields, perLevel: cfg.input === 'studio' || cfg.input === 'dxf', levels: levels.map((L) => ({ id: 'L' + L.n, name: `Level ${L.n}` })), rooms: rooms.map((c) => ({ id: c.id, name: c.name })), input: cfg.input };
}
