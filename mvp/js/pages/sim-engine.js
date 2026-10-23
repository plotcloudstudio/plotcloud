// One simulation page for every PlotCloud engine: the engine file the classic site runs (emb/<file>.html), in the page shell.
// One implementation: nothing here computes or draws a result. This page only
//   hands the engine the version's model in the engine's own input format (the scene Plan Studio's Send to Simulation
//   makes, the masses scene Sun hours and Wind read, the level as DXF, or the model as OBJ),
//   prefills the engine's site and climate inputs from Account (still editable in the engine's left column),
//   hides the engine's own Model / file section and its wall, window, door and furniture drawing tools (the model is
//   edited only in the Workspace), keeps the engine's views and its results column, makes the left sections collapsible,
//   and saves the engine's own figures to the version.
import * as S from '../store.js';
import { $, esc, toast, currentProject, setCurrent, currentVersion, setCurrentVersion, simBack, LIVE } from '../app.js';
import { sunScene, tzInfo } from '../sunscene.js';
import { studioScene, studioDXF } from '../studio-bridge.js';
import { windFrom } from '../studio-convert.js';
import { obj } from '../export3d.js';
import { levelsOf } from '../viewport2.js';

const PLAN_EDIT = '.sec:has(#h-draw) :is([data-tool="wall"], [data-tool="glass"], [data-tool="win"], [data-tool="door"], [data-tool="furn"], #clear)';
const num = (s) => { const m = String(s ?? '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? +m[0] : NaN; };
const r1 = (v) => Math.round(v * 10) / 10;
// Workspace finishes → the acoustics engine's own materials (Plaster has no match there, so the engine keeps its default)
const ACOUSTIC = { Concrete: 'concrete', Gypsum: 'gypsum', Glass: 'glass', Timber: 'wood', Carpet: 'carpet', 'Acoustic panel': 'panel' };

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
  sunhours: { input: 'masses', hide: ['.sec:has(#h-model)', '.sec:has(#h-site)'] },
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
  acoustics: { input: 'room', hide: [], save: '#add',
    prefill: ({ room }) => room?.room && ({ floorMat: ACOUSTIC[room.room.floor], ceilingMat: ACOUSTIC[room.room.ceiling] }) },
  evac: { input: 'dxf', hide: ['.sec:has(#h-plan) :is(#drop, #pick, #sample, #sampleFlat, div:has(> #pick), div:has(> #sample))'] },
  structure: { input: 'none', hide: [],
    prefill: ({ x }) => x && ({ 'q-storeys': x.storeys, 'q-h': r1(x.h), 'q-nx': Math.max(1, Math.min(8, Math.round(x.w / 6))), 'q-sx': r1(x.w / Math.max(1, Math.min(8, Math.round(x.w / 6)))), 'q-ny': Math.max(1, Math.min(8, Math.round(x.d / 6))), 'q-sy': r1(x.d / Math.max(1, Math.min(8, Math.round(x.d / 6)))) }) },
  stormwater: { input: 'obj', hide: [] },
  span: { input: 'none', hide: [], prefill: ({ x }) => x && ({ span: r1(x.span), spanR: r1(x.span), storeys: x.storeys }) },
};

export function render(app, sim, params = new URLSearchParams()) {
  const p = currentProject(), cfg = CFG[sim.id];
  if (!p) { app.innerHTML = '<div class="wrap"><p>No project. <a href="#/">Create one on Home.</a></p></div>'; return; }
  setCurrent(p);
  const v = currentVersion(p), site = p.site || S.account().site, A = S.account().defaults, t = tzInfo(site), file = cfg.file || sim.id;
  const levels = v ? levelsOf(v.model) : [], lvKey = `pc-sim-level:${p.id}`, lvPick = (() => { try { return sessionStorage.getItem(lvKey); } catch (e) { return null; } })();
  const lvIx = Math.max(0, Math.min(levels.length - 1, levels.findIndex((L) => 'L' + L.n === lvPick))), level = levels[lvIx] ? { id: 'L' + levels[lvIx].n, z: levels[lvIx].z } : null;
  const perLevel = cfg.input === 'studio' || cfg.input === 'dxf';
  // Indoor acoustics studies one closed room: the room picked here goes in as its own wall loop
  const rooms = v && cfg.input === 'room' ? v.model.components.filter((c) => c.type === 'room') : [], rmKey = `pc-sim-room:${p.id}`, rmPick = (() => { try { return sessionStorage.getItem(rmKey); } catch (e) { return null; } })();
  const room = rooms.find((c) => c.id === rmPick) || rooms[0] || null;
  app.innerHTML = `<div class="shx">
    <div class="shbar" role="region" aria-label="Simulation">
      <a class="btn sm ghost" href="${simBack()}">← Back</a>
      <b class="shname">${esc(sim.name)}</b>${LIVE}
      <label class="shsel">Project<select id="proj">${S.projects().map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label class="shsel">Version<select id="ver">${p.versions.slice().reverse().map((x) => `<option value="${x.id}" ${x === v ? 'selected' : ''}>v${x.n} — ${esc(x.note)}</option>`).join('') || '<option>No saved versions</option>'}</select></label>
      ${perLevel && levels.length > 1 ? `<label class="shsel">Level<select id="lvl">${levels.map((L, i) => `<option value="L${L.n}" ${i === lvIx ? 'selected' : ''}>Level ${L.n}</option>`).join('')}</select></label>` : ''}
      ${rooms.length ? `<label class="shsel">Room<select id="room">${rooms.map((c) => `<option value="${c.id}" ${c === room ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>` : ''}
      <a class="shsite" href="#/account" title="Site, north, time zone and climate come from Account">${esc((site?.label || '—').split(',').slice(0, 2).join(','))}${site?.sample ? ' (sample)' : ''} · north ${site?.north ?? 0}° · UTC${t.tz >= 0 ? '+' : ''}${t.tz}${t.dst ? ' with DST' : ''}</a>
      <span class="sp"></span>
      <span class="note" id="shmsg" role="status" aria-live="polite"></span>
      <button class="btn sm primary" id="save" disabled>Save result${v ? ` to v${v.n}` : ''}</button>
    </div>
    ${v ? `<iframe id="eng" data-emb="${sim.id}" title="${esc(sim.name)}" src="../emb/${file}.html${sim.id === 'acoustics' ? '?v=wire-20261023-1' : ''}"></iframe>` : `<div class="wrap"><p class="note">Save a model version first: <a href="#/workspace">open the Workspace</a>.</p></div>`}
  </div>`;
  $('#proj', app).onchange = (e) => { setCurrent(S.project(e.target.value)); render(app, sim, params); };
  $('#ver', app).onchange = (e) => { setCurrentVersion(p, e.target.value); render(app, sim, params); };
  const lvSel = $('#lvl', app); if (lvSel) lvSel.onchange = (e) => { try { sessionStorage.setItem(lvKey, e.target.value); } catch (er) { } render(app, sim, params); };
  const rmSel = $('#room', app); if (rmSel) rmSel.onchange = (e) => { try { sessionStorage.setItem(rmKey, e.target.value); } catch (er) { } render(app, sim, params); };
  if (!v) return;

  const fr = $('#eng', app), msg = $('#shmsg', app), saveBtn = $('#save', app), name = `${p.name} · v${v.n}`, x = extent(v.model);
  const ctx = { site, A, t, level, x, room }, filled = {};
  let alive = true, loaded = false;
  const doc = () => { try { return fr.contentDocument; } catch (e) { return null; } };
  const say = (h, warn) => { msg.innerHTML = h; msg.classList.toggle('warn', !!warn); };

  // the engine's own input, made from the version
  const input = (() => {
    if (cfg.input === 'masses') { const sc = sunScene(v.model, site, { name, project: p.id, version: v.id }); return Promise.resolve({ ok: true, scene: JSON.stringify(sc), info: `${sc.masses.filter((m) => m.role === 'proposed').length} blocks, ${sc.masses.filter((m) => m.role === 'context').length} neighbours` }); }
    if (cfg.input === 'studio') return studioScene(v, site, p.name, sim.id === 'movementdepth' ? 'movementdepth' : sim.id, level?.id);
    if (cfg.input === 'dxf') return studioDXF(v, site, p.name, level?.id);
    if (cfg.input === 'room') { if (!room) return Promise.resolve({ ok: false, why: ['Draw a room in the Workspace first.'] });
      const g = room.g, q = [[g.x, g.y], [g.x + g.w, g.y], [g.x + g.w, g.y + g.d], [g.x, g.y + g.d]].map((pt) => pt.map((n) => +n.toFixed(3)));
      return Promise.resolve({ ok: true, info: room.name, scene: JSON.stringify({ name: room.name, walls: q.map((a, i) => ({ a, b: q[(i + 1) % 4], h: +g.h.toFixed(3) })), source: { app: 'plotcloud-workspace', project: p.id, version: v.id, room: room.id } }) }); }
    return Promise.resolve({ ok: true });
  })();
  input.catch(() => null).then((r) => { if (!alive || !r) return; if (!r.ok) say(`This version can't run here yet: ${esc((r.why || []).join(' '))} <a href="#/workspace">Open the Workspace</a>`, true); });
  input.catch((e) => { if (alive) say(esc(e.message || 'The model could not be prepared.'), true); });

  // the engine asks for the model at once (it is waiting for this page) instead of after its demo analysis
  window.__pcHO = { tool: sim.id };
  const onMsg = async (e) => {
    if (e.source !== fr.contentWindow || !e.data?.pc) return; const d = e.data;
    if (d.t === 'hello' && (cfg.input === 'masses' || cfg.input === 'studio' || cfg.input === 'room')) {
      const r = await input.catch(() => null); if (!alive || !r?.ok) return;
      fr.contentWindow.postMessage({ pc: 1, t: 'project', scene: r.scene, name, source: { app: 'plotcloud-workspace', project: p.id, version: v.id, level: level?.id || 'all', ...(room ? { room: room.id } : {}) } }, '*');
      loaded = true; say(`Model: ${esc(name)}${r.info ? ' · ' + esc(r.info) : level && levels.length > 1 ? ' · Level ' + level.id.slice(1) : ''}`); setTimeout(prefill, 900);
    }
    if (d.t === 'save') {
      if (sim.id === 'acoustics' && (d.source?.project !== p.id || d.source?.version !== v.id || d.source?.room !== room?.id)) { say('This result belongs to another project version or room. Run the current room before saving.', true); return; }
      store(Array.isArray(d.kpis) ? d.kpis : [], d.analysis);
    }
  };
  addEventListener('message', onMsg);

  // Account values into the engine's own inputs (each stays editable there)
  function prefill() {
    const D = doc(), vals = cfg.prefill?.(ctx); if (!D || !vals) return;
    for (const [id, val] of Object.entries(vals)) { const el = D.getElementById(id); if (!el || val == null || (typeof val === 'number' && !Number.isFinite(val))) continue;
      el.value = String(val); filled[id] = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
  }
  // file-based inputs (DXF plan, OBJ site) go into the engine's own file picker, as if the person had opened the file
  const giveFile = (input, text, fname, type) => { const dt = new DataTransfer(); dt.items.add(new File([text], fname, { type })); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); };
  async function feedFile() {
    const D = doc(); if (!D) return;
    if (cfg.input === 'dxf') { const r = await input.catch(() => null); if (!alive || !r?.ok) return; const f = D.getElementById('file'); if (!f) return;
      giveFile(f, r.text, `${p.name}-v${v.n}-${level?.id || 'L1'}.dxf`.replace(/[^\w.-]+/g, '-'), 'application/dxf'); loaded = true; say(`Model: ${esc(name)} · ${level ? 'Level ' + level.id.slice(1) : 'plan'} as DXF`); }
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
  }

  // the engine's own figures for this run
  function kpisNow() {
    const D = doc(); if (!D) return [];
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
    if (sim.id === 'span') return [['Depth', `${txt(D.getElementById('ansDepth'))} ${txt(D.getElementById('ansWhat'))}`.trim()], ...[...D.querySelectorAll('#colOut dt')].map((dt) => [txt(dt), txt(dt.nextElementSibling)])].filter(([, s]) => s && s !== '—');
    if (sim.id === 'stormwater') { const m = D.getElementById('modelWorkspace'); const W = m && !m.hidden ? m.contentDocument : D.getElementById('gridWorkspace')?.contentDocument; if (!W) return [];
      return [...W.querySelectorAll('.kp4 > div')].map((el) => [txt(el.querySelector(':scope > small')), txt(el.querySelector(':scope > b'))]).filter(([k, s]) => k && s && !/^—/.test(s)); }
    return [];
  }
  function store(kpis, analysis = null) {
    let K = kpis.map(([k, s]) => [String(k), String(s ?? '').trim()]).filter(([, s]) => s && !/^[—–-]+(\s|$)/.test(s));
    const D = doc();
    if (sim.id === 'sunhours') { const stats = [...(D?.querySelectorAll('#stats dt') || [])].map((dt) => [dt.textContent.trim(), (dt.nextElementSibling?.textContent || '').trim()]); K = K.concat(stats.filter(([k]) => !/window|extent/i.test(k))); }
    if (sim.id === 'acoustics' && !fr.contentWindow.AcousticStudy?.canSaveFor?.({ project: p.id, version: v.id, room: room?.id })) { say('The engine is showing its sample room, not this room. Reload the page to send the room again.', true); return; }
    if (!K.some(([, s]) => /\d/.test(s))) { say('Run the analysis first; then save its result.', true); return; }
    const results = { kpis: K };
    if (sim.id === 'acoustics' && analysis?.engine === 'deterministic-ray-accumulation-v2') results.analysis = analysis;
    for (const [k, , , , re] of sim.metrics) { const hit = re && K.find(([l]) => re.test(l)); if (hit) results[k] = num(hit[1]); }
    const settings = { site: site?.label, ...(perLevel && level ? { level: level.id } : {}), ...(room ? { room: room.name } : {}), ...filled };
    try { S.addRun(p, v.id, sim.id, settings, results, 'full-tool'); } catch (error) { say('This result could not be saved: ' + esc(error.message || 'storage unavailable'), true); try { fr.contentWindow.postMessage({ pc: 1, t: 'error', msg: 'Project save failed. Export JSON to keep this result.' }, '*'); } catch {} return; }
    try { fr.contentWindow.postMessage({ pc: 1, t: 'saved', count: p.runs.filter((r) => r.versionId === v.id && r.simId === sim.id).length }, '*'); } catch (e) { }
    toast(`Saved to v${v.n}`); say(`Saved to v${v.n} · <a href="#/results/${p.id}?sim=${sim.id}">Compare versions →</a>`);
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
    #panelL, #panelL > .colIn, #panelR, #panelR > .colIn { overflow-y: auto !important; }
    .col > .colIn { transform: none !important; width: auto !important; }
    .sec.pc-col > :not(h2) { display: none !important; }
    .sec > h2.pc-tog { cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: space-between; }
    .sec > h2.pc-tog::after { content: '–'; font: 600 14px ui-monospace, monospace; color: #8a8f98; }
    .sec.pc-col > h2.pc-tog::after { content: '+'; }
    ${sim.id === 'span' ? '.app > aside.panel { order: -1; } .app { grid-template-columns: minmax(280px, 340px) minmax(0, 1fr) !important; }' : ''}`;
  let tries = 0;
  const shell = () => {
    const D = doc(); if (!alive) return;
    const ready = D && D.readyState !== 'loading' && D.body && (sim.id === 'stormwater' ? D.getElementById('gridWorkspace')?.contentDocument?.querySelector('h2') : sim.id === 'span' ? D.getElementById('span') : D.querySelector('.sec h2'));
    if (!ready) { if (tries++ < 200) setTimeout(shell, 100); return; }
    if (!D.getElementById('pc-shell')) { const st = D.createElement('style'); st.id = 'pc-shell'; st.textContent = CSS; D.head.appendChild(st); }
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
    if (!loaded && (cfg.input === 'dxf' || cfg.input === 'obj' || cfg.input === 'none')) setTimeout(feedFile, cfg.input === 'none' ? 300 : 1200);
  };
  fr.addEventListener('load', () => { tries = 0; loaded = false; shell(); }); shell();
  return () => { alive = false; removeEventListener('message', onMsg); delete window.__pcHO; };
}
