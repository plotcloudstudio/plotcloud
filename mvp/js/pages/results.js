// Projects & Results.
//   Run simulations: tick any number of simulations, adjust each one's inputs, and run them all on the latest saved version
//   (batch.js runs each simulation page in a hidden frame; a version is saved first when the Workspace has unsaved changes).
//   Results by version: one card per simulation run on a version. The matrix and the log of every saved result stay.
//   Compare versions: Version A / B, Scope (whole model in 3D, one level in plan, one simulation), display mode, Sync cameras.
//   Everything shown in Compare comes from one diff (diff.js) by component id, and from the saved results of the two versions.
import * as S from '../store.js';
import { SIMS } from '../data.js';
import { $, $$, esc, fmt, when, toast, currentProject, setCurrent, MOCK, LIVE } from '../app.js';
import { createViewport2, levelsOf } from '../viewport2.js';
import { createBatch } from '../batch.js';
import { versionScene, diff as diffOf, COLORS, figureRows, fieldDiff } from '../diff.js';

// simulations that need points a person places in the engine (an observer, destinations): they run on their own page
const HANDS = { isovist: 'needs an observer you place in the plan', evac: 'needs destinations you place in the plan' };
const CKEY = 'pc-mvp-cmp';
const DEF_C = { mode: 'solid', sync: true, scope: 'model', level: 1, sim: null, thr: {}, only: false, pct: false, pic: false };
const readC = () => { try { return { ...DEF_C, ...(JSON.parse(localStorage.getItem(CKEY) || 'null') || {}) }; } catch (e) { return { ...DEF_C }; } };
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const STATUS = { queued: 'Queued', running: 'Running', done: 'Done', failed: 'Failed' };

export async function render(app, [pid], params) {
  const p = (pid && S.project(pid)) || currentProject();
  if (!p) { app.innerHTML = '<div class="wrap"><p>No project yet. <a href="#/">Create one on Home.</a></p></div>'; return; }
  setCurrent(p);
  const site = S.siteOf(p), C = readC(); const saveC = () => { try { localStorage.setItem(CKEY, JSON.stringify(C)); } catch (e) { } };
  const last = () => p.versions.at(-1), dirty = () => !last() || JSON.stringify(last().model) !== JSON.stringify(p.draft);
  if (!p.batch) p.batch = { sel: [], cfg: {} };
  let A = p.versions.at(-2) || p.versions[0], B = p.versions.at(-1), cardV = B;
  if (params.get('sim')) { C.scope = 'sim'; C.sim = params.get('sim'); }
  const { batchInfo } = await import('./sim-engine.js');
  let dead = false;

  app.innerHTML = `<div class="wrap">
    <div class="sec-h" style="margin-top:0;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:end"><div><span class="eyebrow">Results · ${esc(p.name)} · ${esc((site?.label || '').split(',')[0])}</span><h1 class="display" style="margin-top:16px">Change the design.<br><span>See what it did.</span></h1></div>
      <select class="inp" id="proj" style="max-width:280px" aria-label="Project">${S.projects().map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
    <p class="muted">Every saved result is tied to the model version it ran on, with its settings.</p>

    <div class="sec-h rs-h"><h2 class="display sm">Run simulations</h2><span class="note" id="runOn"></span></div>
    <div class="card bt"><div class="bt-top"><label class="ck"><input type="checkbox" id="btAll"> All</label><span class="note">Tick the studies to run. Open one to change its inputs: the same inputs its own page takes from Account.</span><span class="sp"></span><button class="btn primary" id="btRun" disabled>Run selected (0)</button></div>
      <div class="bt-prog" id="btProg" hidden><div class="bar"><i id="btBar"></i></div><span id="btTxt" class="note"></span></div>
      <div id="btList"></div>
      <p class="note">Each study runs its own PlotCloud engine, one after another, exactly as its page would; keep this page open while they run. One that fails does not stop the others and can be run again.</p></div>
    <div id="btFrames" aria-hidden="true"></div>

    <div class="sec-h rs-h"><h2 class="display sm">Results by version</h2><label class="f inline">Version <select id="cardV" class="inp"></select></label></div>
    <div class="rcards" id="cards"></div>

    <div class="sec-h rs-h"><h2 class="display sm">Versions × simulations</h2><span class="note">latest saved result per cell</span></div>
    <div style="overflow-x:auto" id="matrix"></div>

    <div class="sec-h rs-h"><h2 class="display sm">Compare versions</h2></div>
    ${p.versions.length < 2 ? '<p class="note">Save at least two versions in the workspace to compare them.</p>' : `
    <div class="cw" id="cw">
      <div class="cw-bar">
        <label class="f" id="simW">Simulation<select id="simSel">${SIMS.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>
        <label class="f">Version A<select id="va"></select></label><label class="f">Version B<select id="vb"></select></label>
        <label class="f">Scope<select id="scope"><option value="model">Whole model</option><option value="level">One level</option><option value="sim">One simulation</option></select></label>
        <label class="f" id="lvW">Level<select id="lvSel"></select></label>
        <div class="f" id="modeW"><span>Display</span><div class="seg" role="group" aria-label="Display"><button type="button" data-mode="solid">Solid colour</button><button type="button" data-mode="ghost">Ghosted overlay</button><button type="button" data-mode="hl">Highlight only</button></div></div>
        <label class="ck" id="syncW"><input type="checkbox" id="sync"> Sync cameras</label>
      </div>
      <div class="cw-views"><div class="cw-v"><span class="lab" id="la"></span><div class="vp" id="vpa"></div><div class="cw-miss" id="ma" hidden></div></div><div class="cw-v"><span class="lab" id="lb"></span><div class="vp" id="vpb"></div><div class="cw-miss" id="mb" hidden></div></div></div>
      <div class="cw-cards">
        <section class="card cw-card" aria-labelledby="simH"><div class="cw-ch"><button type="button" class="btn sm cw-copy" data-copy="sim" title="Copy this text">Copy</button><h3 id="simH">Simulation</h3></div><div id="simTxt" class="cw-txt"></div><div id="simCtl"></div></section>
        <section class="card cw-card" aria-labelledby="modH"><div class="cw-ch"><button type="button" class="btn sm cw-copy" data-copy="model" title="Copy this text">Copy</button><h3 id="modH">Model changes</h3></div><div id="side" class="cw-side"></div></section>
      </div>
      <p class="note" id="cwNote"></p>
    </div>
    <div class="card" id="trend" style="margin-top:14px"></div>`}

    <div class="sec-h rs-h"><h2 class="display sm">All saved results</h2><span class="note" id="nRuns"></span></div>
    <div style="overflow-x:auto"><table class="t"><thead><tr><th>When</th><th>Version</th><th>Simulation</th><th>Settings</th><th>Result</th><th>Source</th><th></th></tr></thead><tbody id="log"></tbody></table></div>
  </div>`;
  $('#proj', app).onchange = (e) => { location.hash = '#/results/' + e.target.value; };

  // ================= §1 · batch =================
  const batch = createBatch($('#btFrames', app), { onChange: () => { if (!dead) { batchUI(); afterRuns(); } } });
  const open = new Set();
  const runVersion = () => last();
  function batchList() {
    const v = runVersion(), sel = new Set(p.batch.sel), items = new Map(batch.items().filter((x) => x.versionId === v?.id || x.status === 'running' || x.status === 'queued').map((x) => [x.simId, x]));
    $('#btList', app).innerHTML = SIMS.map((s) => {
      const hand = HANDS[s.id], cfg = p.batch.cfg[s.id] || {}, it = items.get(s.id), info = v ? batchInfo(s.id, p, v) : null, o = open.has(s.id);
      const st = it ? `<span class="st st-${it.status}" data-st="${s.id}">${STATUS[it.status]}${it.status === 'running' ? ` <span class="spin"></span>` : ''}</span>${it.status === 'failed' ? `<button type="button" class="btn sm" data-retry="${esc(it.key)}">Retry</button>` : ''}` : (v && S.lastRun(p, v.id, s.id) ? `<span class="note">saved on v${v.n}</span>` : '');
      const fields = info ? `${info.perLevel && info.levels.length > 1 ? `<label class="f">Level<select data-lv="${s.id}">${info.levels.map((L) => `<option value="${L.id}" ${cfg.level === L.id ? 'selected' : ''}>${L.name}</option>`).join('')}</select></label>` : ''}
        ${info.rooms.length ? `<label class="f">Room<select data-rm="${s.id}">${info.rooms.map((r) => `<option value="${r.id}" ${cfg.room === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>` : ''}
        ${info.fields.map((f) => { const val = cfg.ov?.[f.id] ?? f.value; return `<label class="f">${esc(f.label)}${f.unit ? ` (${esc(f.unit)})` : ''}${f.options ? `<select data-ov="${s.id}" data-id="${f.id}">${f.options.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(val) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>` : `<input data-ov="${s.id}" data-id="${f.id}" value="${esc(val)}" ${typeof f.value === 'number' ? 'type="number" step="any"' : ''}>`}${cfg.ov?.[f.id] != null ? `<small>Account: ${esc(f.value)}</small>` : ''}</label>`; }).join('') || '<p class="note">This study takes its inputs from the model only.</p>'}` : '';
      return `<div class="bt-row${hand ? ' hand' : ''}" data-row="${s.id}"><div class="bt-line">
        <label class="ck"><input type="checkbox" data-pick="${s.id}" ${sel.has(s.id) && !hand ? 'checked' : ''} ${hand ? 'disabled' : ''}> ${esc(s.name)}</label><span class="note">${esc(s.group)}</span>
        ${hand ? `<span class="note">Not in batches: ${hand}. <a href="#/simulations/${s.id}?project=${p.id}${v ? '&version=' + v.id : ''}">Open it</a></span>` : `<button type="button" class="btn sm ghost" data-open="${s.id}" aria-expanded="${o}">${o ? 'Hide inputs' : 'Inputs'}</button>`}
        <span class="sp"></span>${st}</div>
        ${it?.status === 'failed' ? `<p class="bt-why" role="alert">${esc(it.why)}</p>` : ''}
        ${o && !hand ? `<div class="bt-fields">${fields}</div>` : ''}</div>`; }).join('');
    $$('[data-pick]', app).forEach((c) => c.onchange = () => { const s = new Set(p.batch.sel); c.checked ? s.add(c.dataset.pick) : s.delete(c.dataset.pick); p.batch.sel = [...s]; S.save(); batchUI(); });
    $$('[data-open]', app).forEach((b) => b.onclick = () => { open.has(b.dataset.open) ? open.delete(b.dataset.open) : open.add(b.dataset.open); batchList(); });
    $$('[data-retry]', app).forEach((b) => b.onclick = () => batch.retry(b.dataset.retry));
    const cf = (id) => (p.batch.cfg[id] = p.batch.cfg[id] || { ov: {} });
    $$('[data-ov]', app).forEach((el) => el.onchange = () => { const c = cf(el.dataset.ov); c.ov = c.ov || {}; const f = batchInfo(el.dataset.ov, p, runVersion()).fields.find((x) => x.id === el.dataset.id);
      let val = el.value; if (typeof f.value === 'number') val = +val; if (String(val) === String(f.value) || el.value === '') delete c.ov[el.dataset.id]; else c.ov[el.dataset.id] = val; S.save(); batchList(); });
    $$('[data-lv]', app).forEach((el) => el.onchange = () => { cf(el.dataset.lv).level = el.value; S.save(); });
    $$('[data-rm]', app).forEach((el) => el.onchange = () => { cf(el.dataset.rm).room = el.value; S.save(); });
  }
  function batchUI() {
    const n = p.batch.sel.filter((id) => !HANDS[id]).length, its = batch.items(), act = its.filter((x) => x.status === 'queued' || x.status === 'running');
    $('#btRun', app).textContent = `Run selected (${n})`; $('#btRun', app).disabled = !n || act.length > 0 || !last();
    $('#btAll', app).checked = n === SIMS.length - Object.keys(HANDS).length;
    const v = runVersion(); $('#runOn', app).textContent = v ? `Runs on v${v.n}${dirty() ? ' — the Workspace has unsaved changes: they are saved as a new version first' : ' (latest saved)'}` : 'Save a version in the Workspace first';
    const doneN = its.filter((x) => x.status === 'done').length, failN = its.filter((x) => x.status === 'failed').length;
    $('#btProg', app).hidden = !its.length; if (its.length) { $('#btBar', app).style.width = ((doneN + failN) / its.length * 100) + '%';
      $('#btTxt', app).textContent = `${doneN + failN} of ${its.length} finished · ${doneN} done${failN ? ` · ${failN} failed` : ''}${act.length ? ` · running ${SIMS.find((s) => s.id === act.find((x) => x.status === 'running')?.simId)?.name || '…'}` : ''}`; }
    batchList();
  }
  $('#btAll', app).onchange = (e) => { p.batch.sel = e.target.checked ? SIMS.filter((s) => !HANDS[s.id]).map((s) => s.id) : []; S.save(); batchUI(); };
  $('#btRun', app).onclick = () => {
    if (dirty() && p.draft) { const v = S.saveVersion(p, 'Saved before a batch run'); toast(`The Workspace's unsaved changes were saved as v${v.n}`); }
    const v = last(); if (!v) return; cardV = v; B = v; refreshVersions();
    batch.add(p.batch.sel.filter((id) => !HANDS[id]).map((id) => ({ simId: id, projectId: p.id, versionId: v.id, level: p.batch.cfg[id]?.level, room: p.batch.cfg[id]?.room, ov: { ...(p.batch.cfg[id]?.ov || {}) } })));
    cardsUI();
  };
  let lastDone = 0;
  function afterRuns() { const n = batch.items().filter((x) => x.status === 'done' || x.status === 'failed').length; if (n === lastDone) return; lastDone = n; cardsUI(); matrix(); log(); if (cmpReady && C.scope === 'sim') compare(); else trend(); }

  // ================= results by version, matrix, log =================
  function refreshVersions() {
    $('#cardV', app).innerHTML = p.versions.slice().reverse().map((v) => `<option value="${v.id}" ${v === cardV ? 'selected' : ''}>v${v.n} — ${esc(v.note)}</option>`).join('');
    if ($('#va', app)) for (const [id, cur] of [['#va', A], ['#vb', B]]) $(id, app).innerHTML = p.versions.map((v) => `<option value="${v.id}" ${v === cur ? 'selected' : ''}>v${v.n} — ${esc(v.note)}</option>`).join('');
  }
  $('#cardV', app).onchange = (e) => { cardV = S.version(p, e.target.value); cardsUI(); };
  function cardsUI() {
    const v = cardV; if (!v) { $('#cards', app).innerHTML = '<p class="note">No saved version yet.</p>'; return; }
    const runs = SIMS.map((s) => [s, S.lastRun(p, v.id, s.id)]).filter(([, r]) => r);
    $('#cards', app).innerHTML = runs.map(([s, r]) => `<article class="rcard" data-card="${s.id}">${r.results.thumb ? `<img src="${r.results.thumb}" alt="${esc(s.name)} on v${v.n}">` : '<div class="ph">No picture kept</div>'}
      <div class="rc-b"><h3>${esc(s.name)}</h3>${S.runConditionsStatus(p,r)?`<p class="notice warn" data-conditions-stale>${esc(S.runConditionsStatus(p,r))}</p>`:''}<p class="note">${when(r.created)} · ${r.source === 'batch' ? 'batch run' : 'saved from its page'}</p>
      <dl>${(r.results.kpis || []).slice(0, 3).map(([k, x]) => `<dt>${esc(k)}</dt><dd>${esc(x)}</dd>`).join('')}</dl>
      <a class="btn sm primary" href="#/simulations/${s.id}?project=${p.id}&version=${v.id}">Enter</a></div></article>`).join('') || `<p class="note">Nothing run on v${v.n} yet. Tick studies above and Run selected.</p>`;
  }
  function matrix() {
    const used = SIMS.filter((s) => p.runs.some((r) => r.simId === s.id));
    $('#matrix', app).innerHTML = used.length ? `<table class="t matrix"><thead><tr><th>Version</th>${used.map((s) => `<th>${esc(s.name)}<br><span style="text-transform:none">${esc(s.metrics[0][1])}${s.metrics[0][2] ? ' · ' + s.metrics[0][2] : ''}</span></th>`).join('')}<th></th></tr></thead>
      <tbody>${p.versions.slice().reverse().map((v) => `<tr><td><b class="mono">v${v.n}</b> ${esc(v.note)}<br><span class="note">${when(v.created)}</span></td>${used.map((s) => { const r = S.lastRun(p, v.id, s.id); return `<td class="n">${r ? fmt(r.results[s.metrics[0][0]], s.metrics[0][3]) : `<a class="note" href="#/simulations/${s.id}?project=${p.id}&version=${v.id}">run</a>`}</td>`; }).join('')}<td><a class="btn sm" href="#/simulations?project=${p.id}&version=${v.id}">Simulate</a></td></tr>`).join('')}</tbody></table>` : '<p class="note">No saved results yet. Run simulations above.</p>';
  }
  function log() {
    $('#nRuns', app).textContent = p.runs.length;
    $('#log', app).innerHTML = p.runs.slice().sort((a, b) => b.created.localeCompare(a.created)).map((r) => { const s = SIMS.find((x) => x.id === r.simId), v = S.version(p, r.versionId);
      return `<tr><td>${when(r.created)}</td><td class="mono">v${v?.n ?? '?'}</td><td>${esc(s?.name)}</td><td class="small">${Object.entries(r.settings).filter(([k, x]) => x != null && x !== '').map(([k, x]) => k === 'sharedConditions' ? esc('Project conditions r'+x.revision+(x.studyOnlyOverrides?' · study override':'')) : k === 'site' ? esc(x) : `${esc(k)} ${esc(x)}`).join(' · ')}${r.results.roomName ? ' · ' + esc(r.results.roomName) : ''}</td>
      <td class="small mono">${r.results.kpis ? r.results.kpis.slice(0, 4).map(([k, x]) => `${esc(k)} ${esc(x)}`).join(' · ') : s.metrics.map(([k, l, u, d]) => `${fmt(r.results[k], d)}${u ? ' ' + u : ''}`).join(' · ')}</td><td>${r.source === 'prototype-mock' ? MOCK : LIVE}${r.source === 'batch' ? ' <span class="note">batch</span>' : ''}</td><td><button class="btn sm danger" data-del="${r.id}">Delete</button></td></tr>`; }).join('') || '<tr><td colspan="7" class="note">Nothing saved yet.</td></tr>';
    $$('[data-del]', app).forEach((b) => b.onclick = () => { if (!confirm('Delete this saved result?')) return; S.deleteRun(p, b.dataset.del); toast('Result deleted'); log(); cardsUI(); matrix(); if (cmpReady && C.scope === 'sim') compare(); });
  }

  // ================= §2–§4 · compare =================
  let cmpReady = false, vpa = null, vpb = null, SC = { a: null, b: null }, ITEMS = [], picked = null, syncing = false, token = 0;
  const cmpEl = $('#cw', app);
  function views() {
    if (vpa) return;
    const mk = (el, me, other) => createViewport2(el, { onPick: (id) => pickFromView(id), onBox: () => {}, onHover: () => {},
      onCam: () => { if (!C.sync || syncing) return; const o = other(), m = me(); if (!o || !m) return; syncing = true; try { o.setCam(m.getCam()); } finally { syncing = false; } } });   // one camera drives both, in the same frame
    vpa = mk($('#vpa', app), () => vpa, () => vpb); vpb = mk($('#vpb', app), () => vpb, () => vpa);
  }
  async function compare() {
    if (!cmpEl) return; cmpReady = true; const my = ++token;
    $('#la', app).textContent = `A · v${A.n}`; $('#lb', app).textContent = `B · v${B.n}`;
    $('#scope', app).value = C.scope; $('#simSel', app).value = C.sim || SIMS[0].id; $('#sync', app).checked = !!C.sync;
    $$('[data-mode]', app).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === C.mode)));
    $('#lvW', app).hidden = C.scope !== 'level'; $('#simW', app).hidden = false; $('#modeW', app).hidden = C.scope === 'sim'; $('#syncW', app).hidden = C.scope === 'sim';
    cmpEl.dataset.scope = C.scope;
    simCompare();
    if (C.scope !== 'sim') { $('#ma', app).hidden = true; $('#mb', app).hidden = true; $('#cwNote', app).textContent = ''; views(); }
    $('#side', app).innerHTML = '<p class="note">Preparing both versions in Plan Studio…</p>'; $('#modH', app).textContent = `Model changes v${A.n} → v${B.n}`;
    let a, b; try { [a, b] = await Promise.all([versionScene(A, site, p.name), versionScene(B, site, p.name)]); } catch (e) { if (my === token) $('#side', app).innerHTML = `<p class="notice warn">${esc(e.message || 'The versions could not be prepared.')}</p>`; return; }
    if (my !== token || dead) return; SC = { a, b };
    ITEMS = diffOf(a, b);
    const lv = [...new Map([...levelsOf(a.model), ...levelsOf(b.model)].map((l) => [l.n, l])).values()].sort((x, y) => x.n - y.n);
    if (!lv.some((l) => l.n === C.level)) C.level = lv[0]?.n || 1;
    $('#lvSel', app).innerHTML = lv.map((l) => `<option value="${l.n}" ${l.n === C.level ? 'selected' : ''}>Level ${l.n} · ${l.z.toFixed(2)} m</option>`).join('');
    if (C.scope !== 'sim') paintViews(true); sideList(); trend();
  }
  // the colours: in A, modified (yellow) and removed (red); in B, modified and added (green), and what was removed as a red outline where it stood
  function paintViews(refit) {
    const a = SC.a, b = SC.b; if (!a || !b) return;
    const inA = new Map(a.model.components.map((c) => [c.id, c])), inB = new Map(b.model.components.map((c) => [c.id, c]));
    const tA = {}, tB = {}, ghostA = [], ghostB = []; let lit = 0;
    for (const it of ITEMS) { let on = false;
      if (it.change === 'modified') { if (inA.has(it.id)) { tA[it.id] = COLORS.modified; on = true; } if (inB.has(it.id)) { tB[it.id] = COLORS.modified; on = true; } }
      if (it.change === 'added' && inB.has(it.id)) { tB[it.id] = COLORS.added; ghostA.push({ ...inB.get(it.id), id: 'ghost:' + it.id, ghostWire: COLORS.added }); on = true; }
      if (it.change === 'removed' && inA.has(it.id)) { tA[it.id] = COLORS.removed; ghostB.push({ ...inA.get(it.id), id: 'ghost:' + it.id, ghostWire: COLORS.removed }); on = true; }
      it.lit = on; if (on) lit++; }
    ITEMS.lit = lit;
    const disp = C.mode === 'ghost' ? 'ghosted' : 'shaded', neutral = C.mode === 'hl';
    const view = C.scope === 'level' ? { kind: 'plan', level: C.level } : { kind: 'persp' };
    // the roof stays off, as in Plan Studio's own 3D, so the rooms and what changed in them can be seen
    const open = (m, extra) => ({ ...m, layers: m.layers.map((l) => l.name === 'Roof' ? { ...l, visible: false } : l), components: [...m.components, ...extra] });
    vpa.setModel(open(a.model, ghostA), { refit }); vpb.setModel(open(b.model, ghostB), { refit });
    for (const v of [vpa, vpb]) { v.setDisplay(disp); v.setView(view); }
    vpa.setTint(tA, { neutral }); vpb.setTint(tB, { neutral });
    if (refit) { vpa.fit(); if (C.sync) vpb.setCam(vpa.getCam()); else vpb.fit(); }
    const sel = picked ? [picked, 'ghost:' + picked] : []; vpa.select(sel); vpb.select(sel);
  }
  let PLAIN = { sim: '', model: '' };
  function sideList() {
    const by = (k) => ITEMS.filter((x) => x.change === k), lab = { modified: 'Modified', added: 'Added', removed: 'Removed' }, head = { modified: 'Changed', added: 'Added', removed: 'Removed' };
    const sentence = (it) => it.change === 'modified' ? `${it.name} (${it.layer}): ${it.what.map((w) => w.t).join(', ')}.` : `${it.name} (${it.layer}) ${it.change === 'added' ? `added in v${B.n}` : `removed in v${B.n}`}.`;
    PLAIN.model = [`Model changes v${A.n} → v${B.n}`, ...(ITEMS.length ? ['modified', 'added', 'removed'].filter((k) => by(k).length).flatMap((k) => [`${head[k]} (${by(k).length})`, ...by(k).map((it) => '- ' + sentence(it))]) : ['No changes between these versions.'])].join('\n');
    $('#side', app).innerHTML = `${ITEMS.length ? ['modified', 'added', 'removed'].filter((k) => by(k).length).map((k) => `<h4 class="cw-gh">${head[k]} (${by(k).length})</h4><ul class="cw-words">${by(k).map((it) => `<li><button type="button" data-item="${esc(it.id)}" aria-current="${picked === it.id}"><i style="background:${hex(COLORS[k])}"></i>${esc(sentence(it))}</button></li>`).join('')}</ul>`).join('') : `<p>No changes between v${A.n} and v${B.n}.</p>`}
      <p class="cw-count" id="cwCount" data-items="${ITEMS.length}" data-lit="${ITEMS.lit}">${ITEMS.length} change${ITEMS.length === 1 ? '' : 's'} · ${ITEMS.lit} highlighted${ITEMS.length !== ITEMS.lit ? ` · ${ITEMS.length - ITEMS.lit} have no geometry in either view` : ''}</p>
      <p class="note">Compared object by object: position, size, kind, layer and parameters. Rooms, automatic floors and the roof follow the walls and are not listed. Click a line to find it in the views; click a coloured part to find its line.</p>`;
    $$('[data-item]', app).forEach((b) => b.onclick = () => pickItem(b.dataset.item, true));
  }
  function pickItem(id, focus) {
    picked = id; $$('[data-item]', app).forEach((b) => b.setAttribute('aria-current', String(b.dataset.item === id)));
    const row = $(`[data-item="${CSS.escape(id)}"]`, app); if (row) row.scrollIntoView({ block: 'nearest' });
    const sel = [id, 'ghost:' + id]; vpa.select(sel); vpb.select(sel);
    if (focus) { const okB = vpb.focusOn(id) || vpb.focusOn('ghost:' + id); if (!C.sync || !okB) vpa.focusOn(id) || vpa.focusOn('ghost:' + id); }
    for (const v of [vpa, vpb]) { v.flash(id); v.flash('ghost:' + id); }
  }
  function pickFromView(id) {   // a click on a view: the change under the cursor (a change wins over an unchanged part in front of it)
    const under = [id, ...(vpa?.candidates() || []), ...(vpb?.candidates() || [])].filter(Boolean).map((x) => String(x).replace(/^ghost:/, ''));
    const hit = under.find((x) => ITEMS.some((i) => i.id === x)); if (hit) pickItem(hit, false); }

  // ---- one simulation: both versions' results side by side, the figures with B − A, and the result field point by point
  function simCompare() {
    const sim = SIMS.find((s) => s.id === C.sim) || SIMS.find((s) => p.runs.some((r) => r.simId === s.id && (r.versionId === A.id || r.versionId === B.id))) || SIMS[0]; C.sim = sim.id; $('#simSel', app).value = sim.id;
    const ra = S.lastRun(p, A.id, sim.id), rb = S.lastRun(p, B.id, sim.id), fa = ra?.results?.field, fb = rb?.results?.field, both = fa && fb;
    const thr = C.thr[sim.id + (C.pct ? '%' : '')] ?? (C.pct ? 10 : sim.id === 'sunhours' ? 0.5 : both ? defThr(fa, fb) : 0);
    const D = both ? fieldDiff(fa, fb, { threshold: thr, pct: C.pct }) : null;
    const running = (v) => batch.items().find((x) => x.simId === sim.id && x.versionId === v.id && (x.status === 'queued' || x.status === 'running'));
    simWords(sim, ra, rb, D, thr, fa || fb);
    if (C.scope !== 'sim') { $('#simCtl', app).innerHTML = ''; return; }
    for (const [v, r, f, el, side] of [[A, ra, fa, $('#ma', app), 'a'], [B, rb, fb, $('#mb', app), 'b']]) {
      el.hidden = false; const it = batch.items().find((x) => x.simId === sim.id && x.versionId === v.id), run = running(v);
      if (!r) { el.innerHTML = `<div class="miss" data-miss="${v.id}"><b>Not run on v${v.n}</b><p class="note">${HANDS[sim.id] ? `This study ${HANDS[sim.id]}, so it runs on its own page.` : 'Run it now: it uses the same inputs as the batch above.'}</p>${HANDS[sim.id] ? `<a class="btn sm" href="#/simulations/${sim.id}?project=${p.id}&version=${v.id}">Open it</a>` : `<button class="btn sm primary" data-runnow="${v.id}" ${run ? 'disabled' : ''}>${run ? STATUS[run.status] + '…' : 'Run it now'}</button>`}${it?.status === 'failed' ? `<p class="bt-why">${esc(it.why)}</p>` : ''}</div>`; continue; }
      if (f && !C.pic) el.innerHTML = `<canvas class="fcv" data-side="${side}" aria-label="${esc(f.label)} on v${v.n}"></canvas><span class="fleg" data-leg="${side}"></span>`;
      else if (r.results.thumb) el.innerHTML = `<img class="fimg" src="${r.results.thumb}" alt="${esc(sim.name)} on v${v.n}">`;
      else el.innerHTML = `<div class="miss"><b>No picture kept for this result</b><p class="note">Run it again to keep its picture and values.</p><button class="btn sm" data-runnow="${v.id}">Run it now</button></div>`;
    }
    $$('[data-runnow]', app).forEach((b) => b.onclick = () => { b.disabled = true; b.textContent = 'Queued…'; batch.add([{ simId: sim.id, projectId: p.id, versionId: b.dataset.runnow, level: p.batch.cfg[sim.id]?.level, room: p.batch.cfg[sim.id]?.room, ov: { ...(p.batch.cfg[sim.id]?.ov || {}) } }]); });
    // the figures: A, B and B − A (absolute or %), changed cells highlighted
    const rows = figureRows(sim, ra, rb), cell = (v, d) => Number.isFinite(v) ? fmt(v, d) : '—';
    const unitOf = fa?.unit || fb?.unit || '', mx = both ? maxDelta(fa, fb) : 1, fl = both ? fb.label.toLowerCase() : '';
    const cnt = (n, of, t) => `${n} of ${of} points of ${esc(fl)} changed${C.pct ? ` by ≥ ${t} %` : ` by ≥ ${t} ${esc(unitOf)}`}`;
    $('#simCtl', app).innerHTML = `${both ? `<div class="cw-ctl"><label class="f">Highlight when the change is at least <output id="thrO">${C.pct ? `${thr} %` : `${thr} ${esc(unitOf)}`}</output>
        <input type="range" id="thr" min="0" max="${C.pct ? 100 : +(mx || 1).toPrecision(3)}" step="${C.pct ? 1 : +((mx || 1) / 100).toPrecision(2)}" value="${thr}"></label>
        <label class="ck"><input type="checkbox" id="only" ${C.only ? 'checked' : ''}> Only changed areas</label>
        <div class="seg" role="group" aria-label="Difference as"><button type="button" data-pct="0" aria-pressed="${!C.pct}">Absolute</button><button type="button" data-pct="1" aria-pressed="${!!C.pct}">Percent</button></div>
        <label class="ck"><input type="checkbox" id="pic" ${C.pic ? 'checked' : ''}> Engine pictures</label>
        <p class="cw-count" id="fCount" data-changed="${D.changed}">${cnt(D.changed, D.cells.length, thr)}</p></div>`
      : (ra && rb ? `<div class="cw-ctl"><div class="seg" role="group" aria-label="Difference as"><button type="button" data-pct="0" aria-pressed="${!C.pct}">Absolute</button><button type="button" data-pct="1" aria-pressed="${!!C.pct}">Percent</button></div><p class="note">${fa || fb ? 'One of the two results was saved before results kept their values: run it again to compare the maps point by point.' : 'This engine keeps no values point by point, so its pictures are shown and its figures compared.'}</p></div>` : '')}
      <table class="t cw-tab"><thead><tr><th>Measure</th><th>v${A.n}</th><th>v${B.n}</th><th>${C.pct ? 'B − A %' : 'B − A'}</th></tr></thead><tbody>${rows.map((r) => { const d = Number.isFinite(r.a) && Number.isFinite(r.b) ? r.b - r.a : NaN, pc = Number.isFinite(d) && Math.abs(r.a) > 1e-9 ? d / Math.abs(r.a) * 100 : NaN, ch = Number.isFinite(d) && Math.abs(d) > 1e-9;
        return `<tr><td>${esc(r.label)}${r.unit ? ` <span class="note">${esc(r.unit)}</span>` : ''}</td><td class="n">${ra ? cell(r.a, r.d) : '<span class="note">not run</span>'}</td><td class="n">${rb ? cell(r.b, r.d) : '<span class="note">not run</span>'}</td><td class="n${ch ? ' chg' : ''}" ${ch ? 'data-chg="1"' : ''}>${!Number.isFinite(d) ? '—' : C.pct ? (Number.isFinite(pc) ? (pc > 0 ? '+' : '') + fmt(pc, 1) + ' %' : '—') : (d > 0 ? '+' : '') + fmt(d, r.d)}</td></tr>`; }).join('')}</tbody></table>
      ${[ra,rb].filter(Boolean).map(r=>S.runConditionsStatus(p,r)?`<p class="notice warn">v${S.version(p,r.versionId)?.n}: ${esc(S.runConditionsStatus(p,r))}</p>`:'').join('')}
      ${ra && rb && JSON.stringify({ ...ra.settings, room: undefined }) !== JSON.stringify({ ...rb.settings, room: undefined }) ? `<p class="notice warn">Settings differ (${Object.keys({ ...ra.settings, ...rb.settings }).filter((k) => k !== 'room' && String(ra.settings[k]) !== String(rb.settings[k])).map((k) => `${esc(k)}: ${esc(ra.settings[k] ?? '—')} → ${esc(rb.settings[k] ?? '—')}`).join(', ')}): part of the difference comes from them.</p>` : ''}`;
    if (both) {
      $('#thr', app).oninput = (e) => { const t = +e.target.value; C.thr[sim.id + (C.pct ? '%' : '')] = t; saveC(); const D2 = fieldDiff(fa, fb, { threshold: t, pct: C.pct }); if (!C.pic) drawFields(fa, fb, D2); $('#thrO', app).textContent = C.pct ? `${t} %` : `${t} ${unitOf}`; const fc = $('#fCount', app); fc.dataset.changed = D2.changed; fc.innerHTML = cnt(D2.changed, D2.cells.length, t); simWords(sim, ra, rb, D2, t, fa || fb); };
      $('#only', app).onchange = (e) => { C.only = e.target.checked; saveC(); if (!C.pic) drawFields(fa, fb, fieldDiff(fa, fb, { threshold: +$('#thr', app).value, pct: C.pct })); };
      $('#pic', app).onchange = (e) => { C.pic = e.target.checked; saveC(); simCompare(); };
      if (!C.pic) drawFields(fa, fb, D);
    }
    $$('[data-pct]', app).forEach((b) => b.onclick = () => { C.pct = b.dataset.pct === '1'; saveC(); simCompare(); });
    $('#cwNote', app).textContent = both ? `Both maps use one colour scale; a yellow outline marks each point whose ${fl} changed at least as much as the threshold. The threshold works on the saved values: nothing is run again.` : '';
  }
  // the comparison of one simulation, in words (the same text the Copy button gives)
  function simWords(sim, ra, rb, D, thr, field) {
    $('#simH', app).textContent = `${sim.name} · v${A.n} → v${B.n}`;
    const L = [];
    if (!ra && !rb) L.push(`${sim.name} has not been run on v${A.n} or v${B.n} yet. Run it in Run simulations above, or choose One simulation and Run it now.`);
    else if (!ra || !rb) L.push(`${sim.name} has been run on v${(ra ? A : B).n} but not on v${(ra ? B : A).n}, so there is nothing to compare yet. Choose One simulation and Run it now on v${(ra ? B : A).n}.`);
    else {
      for (const r of figureRows(sim, ra, rb)) { if (!Number.isFinite(r.a) || !Number.isFinite(r.b)) continue; const d = r.b - r.a, u = r.unit ? (r.unit === '%' ? ' %' : ' ' + r.unit) : '', pc = Math.abs(r.a) > 1e-9 ? d / Math.abs(r.a) * 100 : NaN;
        L.push(Math.abs(d) < 1e-9 ? `${r.label} stayed at ${fmt(r.a, r.d)}${u}.` : `${r.label} ${d > 0 ? 'rose' : 'fell'} from ${fmt(r.a, r.d)}${u} to ${fmt(r.b, r.d)}${u} (${d > 0 ? '+' : '−'}${fmt(Math.abs(d), r.d)}${Number.isFinite(pc) ? `, ${pc > 0 ? '+' : '−'}${fmt(Math.abs(pc), 0)} %` : ''}).`); }
      if (D) L.push(`Point by point, ${D.changed} of ${D.cells.length} points of ${field.label.toLowerCase()} changed by at least ${thr}${C.pct ? ' %' : field.unit ? ' ' + field.unit : ''} (including areas analysed in one version only).`);
      const diffK = Object.keys({ ...ra.settings, ...rb.settings }).filter((k) => k !== 'room' && String(ra.settings[k]) !== String(rb.settings[k]));
      L.push(diffK.length ? `The settings differ (${diffK.map((k) => `${k}: ${ra.settings[k] ?? '—'} → ${rb.settings[k] ?? '—'}`).join('; ')}), so part of the difference comes from them.` : 'Both runs used the same settings, so the difference comes from the model.');
    }
    PLAIN.sim = [`${sim.name} · v${A.n} → v${B.n}`, ...L].join('\n');
    $('#simTxt', app).innerHTML = L.map((x) => `<p>${esc(x)}</p>`).join('');
  }
  const maxDelta = (fa, fb) => { const D = fieldDiff(fa, fb, { threshold: 0 }); let m = 0; for (const c of D.cells) if (Number.isFinite(c.d)) m = Math.max(m, Math.abs(c.d)); return m || 1; };
  const defThr = (fa, fb) => +(maxDelta(fa, fb) * 0.1).toPrecision(2);
  // the result maps: one colour scale for both, the walls of each version over them, changed points outlined
  let drawT = 0;
  async function drawFields(fa, fb, D) {
    const my = ++drawT, a = await versionScene(A, site, p.name).catch(() => null), b = await versionScene(B, site, p.name).catch(() => null); if (dead || my !== drawT) return;
    let lo = Infinity, hi = -Infinity, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const f of [fa, fb]) for (let i = 0; i < f.pts.length; i += 3) { const x = f.pts[i], y = f.pts[i + 1], v = f.pts[i + 2]; lo = Math.min(lo, v); hi = Math.max(hi, v); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const step = Math.max(fa.step || 0.5, fb.step || 0.5); x0 -= step; y0 -= step; x1 += step; y1 += step;
    const ramp = (t) => { t = Math.max(0, Math.min(1, t)); const s = [[38, 70, 140], [70, 160, 190], [240, 220, 120], [230, 120, 60], [170, 30, 40]], k = Math.min(3.999, t * 4), i = Math.floor(k), f = k - i; return `rgb(${s[i].map((c, j) => Math.round(c + (s[i + 1][j] - c) * f)).join(',')})`; };
    const changed = new Set(D.cells.filter((c) => c.on).map((c) => Math.round(c.x / step) + ',' + Math.round(c.y / step)));
    for (const [f, sc, side] of [[fa, a, 'a'], [fb, b, 'b']]) {
      const cv = $(`.fcv[data-side="${side}"]`, app); if (!cv) continue; const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.max(10, r.width * dpr); cv.height = Math.max(10, r.height * dpr);
      const g = cv.getContext('2d'), k = Math.min(cv.width / (x1 - x0), cv.height / (y1 - y0)), ox = (cv.width - (x1 - x0) * k) / 2, oy = (cv.height + (y1 - y0) * k) / 2, P = (x, y) => [ox + (x - x0) * k, oy - (y - y0) * k];
      g.fillStyle = '#f4f3ef'; g.fillRect(0, 0, cv.width, cv.height); const sz = step * k;
      for (let i = 0; i < f.pts.length; i += 3) { const key = Math.round(f.pts[i] / step) + ',' + Math.round(f.pts[i + 1] / step), on = changed.has(key); g.globalAlpha = C.only && !on ? 0.12 : 1; g.fillStyle = ramp((f.pts[i + 2] - lo) / ((hi - lo) || 1)); const [px, py] = P(f.pts[i], f.pts[i + 1]); g.fillRect(px - sz / 2, py - sz / 2, sz + 0.6, sz + 0.6); }
      g.globalAlpha = 1;
      if (sc) { g.strokeStyle = '#1d2129'; g.lineWidth = Math.max(1.5, 0.18 * k); g.lineCap = 'round'; const L0 = sc.studio.levels?.slice().sort((p1, p2) => p1.z - p2.z)[0]?.id; for (const w of sc.studio.walls || []) { if (w.lv !== L0) continue; const [ax, ay] = P(w.a[0], w.a[1]), [bx, by] = P(w.b[0], w.b[1]); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); } }
      g.strokeStyle = '#f2c200'; g.lineWidth = Math.max(1.5, dpr * 1.6);
      for (const c of D.cells) if (c.on) { const [px, py] = P(c.x, c.y); g.strokeRect(px - sz / 2, py - sz / 2, sz, sz); }
      cv.dataset.lit = D.changed;
      const leg = $(`[data-leg="${side}"]`, app); if (leg) leg.innerHTML = `<i style="background:linear-gradient(90deg,${[0, .25, .5, .75, 1].map(ramp).join(',')})"></i>${fmt(lo, 1)} – ${fmt(hi, 1)} ${esc(f.unit || '')} · <span class="chgk">▢ changed, or in one version only</span>`;
    }
  }
  function trend() {
    const el = $('#trend', app); if (!el) return; const sim = C.scope === 'sim' ? SIMS.find((s) => s.id === C.sim) : SIMS.find((s) => p.runs.some((r) => r.simId === s.id)); el.hidden = !sim; if (!sim) { el.innerHTML = ''; return; }
    const [k, label, u, dd] = sim.metrics[0], rows = p.versions.map((v) => [v, S.lastRun(p, v.id, sim.id)?.results[k]]), max = Math.max(1e-9, ...rows.map(([, x]) => (Number.isFinite(x) ? Math.abs(x) : 0)));
    el.innerHTML = `<h3 style="font-size:15px;margin-bottom:10px">${esc(sim.name)} · ${esc(label)} across versions</h3><div class="bars">${rows.map(([v, x]) => `<div class="b ${v === B ? 'v2' : ''}"><span>v${v.n}</span>${Number.isFinite(x) ? `<i style="width:${Math.abs(x) / max * 100}%"></i>` : '<span class="note">not run</span>'}<span style="text-align:right">${Number.isFinite(x) ? fmt(x, dd) + (u ? ' ' + u : '') : ''}</span></div>`).join('')}</div>`;
  }
  if (cmpEl) {
    $$('[data-copy]', app).forEach((b) => b.onclick = async () => { const t = PLAIN[b.dataset.copy] || ''; let ok2 = false;
      try { await navigator.clipboard.writeText(t); ok2 = true; } catch (e) { const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select(); try { ok2 = document.execCommand('copy'); } catch (er) { } ta.remove(); }
      window.__copied = t; toast(ok2 ? 'Copied' : 'Could not copy: select the text instead'); b.textContent = ok2 ? 'Copied' : 'Copy'; setTimeout(() => { b.textContent = 'Copy'; }, 1500); });
    $('#va', app).onchange = (e) => { A = S.version(p, e.target.value); picked = null; compare(); };
    $('#vb', app).onchange = (e) => { B = S.version(p, e.target.value); picked = null; compare(); };
    $('#scope', app).onchange = (e) => { C.scope = e.target.value; saveC(); compare(); };
    $('#lvSel', app).onchange = (e) => { C.level = +e.target.value; saveC(); paintViews(true); };
    $('#simSel', app).onchange = (e) => { C.sim = e.target.value; saveC(); compare(); };
    $$('[data-mode]', app).forEach((b) => b.onclick = () => { C.mode = b.dataset.mode; saveC(); $$('[data-mode]', app).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); paintViews(false); });
    $('#sync', app).onchange = (e) => { C.sync = e.target.checked; saveC(); if (C.sync && vpa && vpb) vpb.setCam(vpa.getCam()); };
  }

  refreshVersions(); batchUI(); cardsUI(); matrix(); log();
  if (cmpEl) compare();
  window.__res = { batch, C, items: () => ITEMS, views: () => [vpa, vpb], pick: pickItem, compare, scenes: () => SC, setAB: (a, b) => { A = S.version(p, a); B = S.version(p, b); refreshVersions(); return compare(); } };   // hook for the browser checks
  return () => { dead = true; batch.dispose(); vpa?.dispose(); vpb?.dispose(); delete window.__res; };
}
