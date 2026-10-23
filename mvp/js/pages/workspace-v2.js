// Workspace v2 (TEMP, for review): the merged Workspace skeleton with a Rhino-like layout.
// The archived Workspace (pages/workspace.js, #/workspace) is not changed. Same project data (store.js), same import code (viewport.js).
// One page store (UI below, saved in this browser) holds view, display mode, panel, selection and the status-bar settings;
// hide / lock live on the project's layers, exactly as in the archived Workspace, so versions keep them.
import * as S from '../store.js';
import { LAYER_COLORS, PAGE, FULL } from '../data.js';
import { $, $$, esc, when, toast, currentProject, setCurrent } from '../app.js';
import { importModel } from '../viewport.js';
import { createViewport2, levelsOf, EYE, CUT } from '../viewport2.js';

// as in the archived Workspace
const TYPES = ['wall', 'slab', 'roof', 'window', 'room', 'mass', 'terrain', 'furniture', 'imported'];
const MATS = ['Concrete', 'Plaster', 'Gypsum', 'Glass', 'Timber', 'Carpet', 'Acoustic panel', 'Grass', 'Context', 'Imported'];
const NEW = {
  mass: { name: 'Massing block', type: 'mass', layer: 'Context', g: { x: 0, y: -6, z: 0, w: 6, d: 4, h: 6 }, mat: 'Context' },
  wall: { name: 'Wall', type: 'wall', layer: 'Walls', g: { x: 0, y: 0, z: 0, w: 4, d: 0.2, h: 3 }, mat: 'Plaster' },
  window: { name: 'Window', type: 'window', layer: 'Glazing', g: { x: 1, y: -0.02, z: 0.9, w: 1.5, d: 0.3, h: 1.4 }, mat: 'Glass' },
  room: { name: 'Room', type: 'room', layer: 'Rooms', g: { x: 0, y: 0, z: 0, w: 5, d: 4, h: 3 }, mat: 'Room', room: { floor: 'Timber', ceiling: 'Gypsum' } },
  slab: { name: 'Slab', type: 'slab', layer: 'Structure', g: { x: 0, y: 0, z: -0.2, w: 6, d: 6, h: 0.2 }, mat: 'Concrete' },
};

// Tool lists, names exactly as in the current Plan Studio (emb/modeler.html). Placement is Step 2.
const I = (d) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const TOOLS = {
  draw: { label: 'Draw room', icon: I('<rect x="4" y="4" width="16" height="16"/><path d="M4 12h7v8"/>'), sections: [
    ['Draw rooms', ['Straight wall', 'Rectangle room', 'Arc wall', 'Floor', 'Fence']],
    ['Add structure', ['Straight stair', 'L-shaped stair', 'U-shaped stair', 'Spiral stair', 'Accessible ramp', 'Floor opening']]] },
  door: { label: 'Door', icon: I('<path d="M5 20h14"/><path d="M7 20V5h7v15"/><path d="M14 5a9 9 0 0 1 6 8.5"/><circle cx="12" cy="13" r=".6" fill="currentColor"/>'), sections: [
    ['Doors', ['Exterior door', 'Interior door', 'Exit door', 'Accessible door']]] },
  window: { label: 'Window', icon: I('<rect x="4" y="5" width="16" height="14"/><path d="M12 5v14M4 12h16"/>'), sections: [
    ['Windows & openings', ['Window', 'Wall opening']]] },
  furniture: { label: 'Furniture', icon: I('<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 12a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z"/><path d="M5 17v2M19 17v2"/>'), sections: [
    ['Bedroom', ['Bed', 'Nightstand', 'Wardrobe', 'Dresser']], ['Living', ['Sofa', 'Sectional sofa', 'Armchair', 'Coffee table', 'Side table', 'TV stand', 'Bookshelf']],
    ['Dining & Office', ['Dining table', 'Dining chair', 'Computer desk', 'Office chair']], ['Kitchen', ['Kitchen cabinets', 'Kitchen island', 'Refrigerator', 'Range', 'Washer / dryer']],
    ['Bathroom', ['Toilet', 'Bathroom vanity', 'Bathtub', 'Shower']], ['Outdoor & Fence', ['Balcony railing', 'Backyard fence']], ['People', ['Adult', 'Elderly', 'Child', 'Wheelchair user']],
    ['Pets', ['Cat', 'Dog']], ['Vehicles', ['Car', 'Bicycle']], ['Decor', ['Picture frame', 'Mirror']], ['Plants', ['Potted plant', 'Tree']], ['Entry', ['Shoe cabinet']]] },
  light: { label: 'Light', icon: I('<path d="M12 3v5"/><path d="M7 13a5 5 0 0 1 10 0z"/><path d="M10 16.5h4M12 13v1"/><path d="M8 20l1-2M16 20l-1-2M12 21v-2"/>'), sections: [
    ['Lights', ['Recessed downlight', 'Flush mount', 'Pendant', 'Track spot', 'Wall sconce', 'LED strip']]] },
};
const PROJECT_ICON = I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>');
const EYE_ON = I('<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>');
const EYE_OFF = I('<path d="M3 3l18 18"/><path d="M10.6 6.1A10 10 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3 3.6M6.4 7.4C3.8 9.1 2 12 2 12s3.6 6 10 6a9.6 9.6 0 0 0 4-.9"/>');
const LOCK_ON = I('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>');
const LOCK_OFF = I('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>');

// imported meshes go to a layer by what their name says; anything unrecognised stays on Imported
const CLASSES = [
  [/wall|墙/i, 'wall', 'Walls', 'Plaster'], [/window|glaz|glass|窗/i, 'window', 'Glazing', 'Glass'],
  [/furn|chair|table|desk|sofa|couch|bed|cabinet|shelf|stool|bench|wardrobe|家具|椅|桌|床|柜/i, 'furniture', 'Furniture', 'Timber'],
  [/slab|floor|楼板/i, 'slab', 'Structure', 'Concrete'], [/roof|屋顶/i, 'roof', 'Roof', 'Concrete'],
];
function classify(c) { const k = CLASSES.find(([re]) => re.test(c.name)); if (k) Object.assign(c, { type: k[1], layer: k[2], mat: k[3] }); return c; }

const UKEY = 'pc-mvp-ws2';
const DEF_UI = { panel: 'project', view: 'persp', level: 1, display: 'shaded', snap: { End: true, Near: true, Mid: true, Cen: false }, gumball: false, clearance: false, sel: null, selProject: null, open: ['Walls', 'Glazing', 'Rooms', 'Imported'] };
function readUI() { try { const u = JSON.parse(localStorage.getItem(UKEY) || 'null'); return u ? { ...DEF_UI, ...u, snap: { ...DEF_UI.snap, ...(u.snap || {}) } } : { ...DEF_UI }; } catch (e) { return { ...DEF_UI }; } }

export function render(app, [pid]) {
  const p = (pid && S.project(pid)) || currentProject();
  if (!p) { app.innerHTML = '<div class="wrap"><p>No project yet. <a href="#/">Create one on Home.</a></p></div>'; return; }
  setCurrent(p);
  const M = () => p.draft, comp = (id) => M().components.find((c) => c.id === id);
  const layerOf = (c) => M().layers.find((l) => l.name === c?.layer);
  const last = () => p.versions.at(-1), dirty = () => !last() || JSON.stringify(last().model) !== JSON.stringify(p.draft);
  const UI = readUI(); const saveUI = () => { try { localStorage.setItem(UKEY, JSON.stringify(UI)); } catch (e) { } };
  const open = new Set(UI.open);
  let showParams = false;

  // ---- the one selection; every region subscribes to it
  const subs = [];
  function setSel(id, { params = true } = {}) {
    const c = comp(id), l = layerOf(c);
    if (!c || !l || l.locked || l.visible === false) id = null;
    UI.sel = id; UI.selProject = p.id; if (c && id) open.add(c.layer); UI.open = [...open]; saveUI();
    showParams = !!id && params;
    for (const f of subs) f(id);
  }

  app.innerHTML = `<div class="w2">
  <nav class="w2-rail" aria-label="Tools">
    ${Object.entries(TOOLS).map(([k, t]) => `<button type="button" data-panel="${k}" title="${t.label}" aria-label="${t.label}">${t.icon}</button>`).join('')}
    <span class="sp"></span>
    <button type="button" data-panel="project" title="Project" aria-label="Project">${PROJECT_ICON}</button>
  </nav>
  <aside class="w2-panel" id="panel" aria-label="Panel"></aside>
  <section class="stage w2-stage" aria-label="3D model">
    <div class="vp" id="vp"></div>
    <div class="w2-cap" id="cap">
      <div><button type="button" id="vBtn" aria-haspopup="true" aria-expanded="false"></button><div class="w2-menu" id="vMenu" role="menu" hidden></div></div>
      <span class="w2-sep" aria-hidden="true"></span>
      <div><button type="button" id="dBtn" aria-haspopup="true" aria-expanded="false"></button><div class="w2-menu" id="dMenu" role="menu" hidden></div></div>
    </div>
    <div class="w2-tr"><button class="btn sm" id="fit">Fit</button><button class="btn sm" id="png">PNG</button></div>
    <div class="hint" id="hint"></div>
  </section>
  <aside class="w2-right" aria-label="Layers, selection and versions">
    <div class="w2-mini"><button type="button" class="btn sm" id="tElev" aria-pressed="false">Elevation</button><button type="button" class="btn sm" id="tWalk" aria-pressed="false">Walkthrough</button></div>
    <div class="pane"><h2>Layers <button class="btn sm" id="addLayer">+ Layer</button></h2>
      <label class="f">Add a component<select id="add"><option value="">Choose…</option><option value="mass">Massing block</option><option value="wall">Wall</option><option value="window">Window</option><option value="room">Room (for acoustics, daylight)</option><option value="slab">Slab</option></select></label>
      <div class="w2-lhead" aria-hidden="true"><span></span><span>Layer</span><span>#</span><span>Show</span><span>Lock</span></div>
      <div id="layers"></div></div>
    <div class="pane" id="selp"></div>
    <div class="pane"><h2>Versions</h2>
      <p id="dirty" class="dirty"></p>
      <label class="f">Describe this version<input id="note" placeholder="e.g. Larger south windows"></label>
      <button class="btn primary" id="saveV">Save version</button>
      <div id="versions"></div>
    </div>
    <div class="pane"><h2>Next</h2><a class="btn accent" id="toSim" href="#/simulations">Choose a simulation</a><p class="note">Simulations run on a saved version, so each result stays linked to the exact model it came from.</p></div>
  </aside>
  <footer class="w2-status" aria-label="Status bar">
    ${Object.keys(DEF_UI.snap).map((k) => `<label title="Saved preference. Object snaps arrive in Step 6."><input type="checkbox" data-snap="${k}" ${UI.snap[k] ? 'checked' : ''}> ${k}</label>`).join('')}
    <span class="w2-div" aria-hidden="true"></span>
    <button type="button" class="w2-sw" role="switch" data-sw="gumball" aria-checked="${UI.gumball}" title="Saved preference. The gumball arrives in Step 6.">Gumball</button>
    <button type="button" class="w2-sw" role="switch" data-sw="clearance" aria-checked="${UI.clearance}" title="Saved preference. Clearance display arrives in Step 6.">Clearance</button>
    <span class="sp"></span><span class="w2-state" id="state"></span>
  </footer></div>`;

  const vp = createViewport2($('#vp', app), { onPick: (id) => setSel(id) });
  const persist = () => { S.save(); state(); };

  // ---- viewport menu: view list (perspective + one plan per real level) and display modes
  const DISPLAYS = [['shaded', 'Shaded'], ['ghosted', 'Ghosted'], ['wire', 'Wireframe']];
  const viewName = () => { const v = vp.view; return v.kind === 'plan' ? `Plan · Level ${v.level}` : v.kind === 'elev' ? 'Elevation · Front' : v.kind === 'walk' ? 'Walkthrough' : 'Perspective'; };
  function hint() {
    const v = vp.view, lv = levelsOf(M()).find((x) => x.n === v.level);
    $('#hint', app).textContent = v.kind === 'plan' ? `Plan · Level ${v.level} at ${lv ? lv.z.toFixed(2) : '0.00'} m, cut ${CUT} m above · drag to pan · scroll to zoom · click to select`
      : v.kind === 'elev' ? 'Front elevation, looking north · drag to pan · scroll to zoom · click to select'
        : v.kind === 'walk' ? `Walkthrough at ${EYE} m eye height · drag to look around · scroll to move forward or back · click to select`
          : 'Drag to orbit · right-drag to pan · scroll to zoom · click to select';
  }
  function menus() {
    const lv = levelsOf(M()), v = vp.view;
    $('#vBtn', app).textContent = viewName() + ' ▾'; $('#dBtn', app).textContent = DISPLAYS.find(([k]) => k === vp.display)[1] + ' ▾';
    $('#vMenu', app).innerHTML = `<button role="menuitemradio" data-view="persp" aria-checked="${v.kind === 'persp'}">Perspective</button>` + lv.map((l) => `<button role="menuitemradio" data-view="plan" data-level="${l.n}" aria-checked="${v.kind === 'plan' && v.level === l.n}">Plan · Level ${l.n}<small>${l.z.toFixed(2)} m</small></button>`).join('')
      + `<p class="w2-mnote">${lv[0].from === 'slab' ? `${lv.length} level${lv.length > 1 ? 's' : ''} from the slabs in this model.` : 'No slab in this model, so one level at 0.00 m.'}</p>`;
    $('#dMenu', app).innerHTML = DISPLAYS.map(([k, n]) => `<button role="menuitemradio" data-disp="${k}" aria-checked="${vp.display === k}">${n}</button>`).join('');
    $('#tElev', app).setAttribute('aria-pressed', String(v.kind === 'elev')); $('#tWalk', app).setAttribute('aria-pressed', String(v.kind === 'walk'));
    $$('[data-view]', app).forEach((b) => b.onclick = () => go({ kind: b.dataset.view, level: +(b.dataset.level || v.level) }));
    $$('[data-disp]', app).forEach((b) => b.onclick = () => { vp.setDisplay(b.dataset.disp); UI.display = b.dataset.disp; saveUI(); closeMenus(); menus(); });
    hint();
  }
  function go(v) { vp.setView(v); UI.view = vp.view.kind; UI.level = vp.view.level; saveUI(); closeMenus(); menus(); }
  const closeMenus = () => { for (const [b, m] of [['vBtn', 'vMenu'], ['dBtn', 'dMenu']]) { $('#' + m, app).hidden = true; $('#' + b, app).setAttribute('aria-expanded', 'false'); } };
  for (const [b, m] of [['vBtn', 'vMenu'], ['dBtn', 'dMenu']]) $('#' + b, app).onclick = (e) => { e.stopPropagation(); const was = !$('#' + m, app).hidden; closeMenus(); if (!was) { $('#' + m, app).hidden = false; $('#' + b, app).setAttribute('aria-expanded', 'true'); } };
  const outside = (e) => { if (!e.target.closest('#cap')) closeMenus(); }; document.addEventListener('click', outside);
  $('#tElev', app).onclick = () => go({ kind: vp.view.kind === 'elev' ? 'persp' : 'elev' });
  $('#tWalk', app).onclick = () => go({ kind: vp.view.kind === 'walk' ? 'persp' : 'walk' });
  $('#fit', app).onclick = () => vp.fit();
  $('#png', app).onclick = () => { const a = document.createElement('a'); a.href = vp.png(); a.download = `${p.name.replace(/\W+/g, '-')}.png`; a.click(); };

  // ---- left: rail + panel (project / tool group / parameters of the selection)
  function rail() { const k = showParams && UI.sel ? null : UI.panel; $$('[data-panel]', app).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.panel === k))); }
  $$('[data-panel]', app).forEach((b) => b.onclick = () => { UI.panel = b.dataset.panel; saveUI(); showParams = false; rail(); panel(); });
  function panel() {
    const host = $('#panel', app), c = comp(UI.sel);
    if (showParams && c) return params(host, c);
    if (UI.panel === 'project') return projectPanel(host);
    const t = TOOLS[UI.panel];
    host.innerHTML = `<div class="pane w2-tools"><h2>${t.label}</h2>${t.sections.map(([h, items]) => `<div class="w2-sec"><h3>${esc(h)}</h3>${items.map((n) => `<button type="button" class="w2-item" data-tool="${esc(n)}">${esc(n)}</button>`).join('')}</div>`).join('')}
      <p class="note" id="toolMsg" role="status" aria-live="polite"></p></div>`;
    $$('[data-tool]', host).forEach((b) => b.onclick = () => { $('#toolMsg', host).textContent = 'Placement arrives in Step 2'; });
  }
  function projectPanel(host) {
    host.innerHTML = `<div class="pane"><h2>Project</h2>
      <select class="inp" id="proj" aria-label="Project">${S.projects().map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <p class="note">Site: ${esc(p.site?.label || '—')}${p.site?.sample ? ' (sample)' : ''} · north ${p.site?.north ?? 0}°</p><p class="note">${p.sample ? 'Sample project with mock results. Edits are kept in this browser.' : 'Stored in this browser.'}</p>
      <p class="note">Detailed modelling still opens in the existing tools: <a href="${PAGE('studio')}" target="_blank" rel="noopener">Plan Studio ↗</a> · <a href="${PAGE('site')}" target="_blank" rel="noopener">Site Planner ↗</a> · <a href="${FULL('tracer')}" target="_blank" rel="noopener">Plan tracer ↗</a></p></div>
    <div class="pane"><h2>Import model</h2>
      <div class="drop" id="drop"><button class="btn sm" id="pick">Import .obj · .stl · .glb</button><div style="margin-top:6px">or drop a file here · read locally</div></div>
      <input type="file" id="file" accept=".obj,.stl,.glb,.gltf" hidden>
      <div class="grid g2"><label class="f">Units<select id="unit"><option value="1">Metres</option><option value="0.001">Millimetres</option><option value="0.01">Centimetres</option><option value="0.3048">Feet</option></select></label>
        <label class="f">Up axis<select id="up"><option value="auto">File default</option><option value="z">Z up</option><option value="y">Y up</option></select></label></div>
      <p class="msg note" id="impMsg" role="status"></p>
      <p class="note">Meshes named like walls go to Walls, furniture to Furniture, windows to Glazing, slabs to Structure, roofs to Roof; the rest to Imported.</p></div>
    <div class="pane"><h2>Import site</h2>
      <button class="btn sm" id="siteBtn">Import site</button>
      <p class="note">Site geometry always goes on the Site layer, locked. Unlock it in Layers to edit.</p>
      <p class="note" id="siteMsg" role="status" aria-live="polite"></p></div>`;
    $('#proj', host).onchange = (e) => { location.hash = '#/workspace-v2/' + e.target.value; };
    $('#siteBtn', host).onclick = () => { $('#siteMsg', host).textContent = 'Site import arrives in Step 2'; };
    const doImport = async (f) => { const msg = $('#impMsg', host); msg.textContent = 'Reading ' + f.name + '…';
      try { const r = await importModel(f, { unit: +$('#unit', host).value, up: $('#up', host).value }), by = {};
        for (const c of r.components) { classify(c); by[c.layer] = (by[c.layer] || 0) + 1; M().components.push({ id: S.uid('c'), ...c }); open.add(c.layer); }
        UI.open = [...open]; saveUI(); persist(); refresh(true);
        msg.textContent = `${f.name}: ${r.components.length} component${r.components.length > 1 ? 's' : ''}, ${r.triangles.toLocaleString('en-CA')} triangles. ${Object.entries(by).map(([l, n]) => `${n} on ${l}`).join(', ')}.${S.persistent() ? '' : ' Browser storage is unavailable; save will not persist.'}`; }
      catch (e) { msg.textContent = e.message; } };
    $('#pick', host).onclick = () => $('#file', host).click();
    $('#file', host).onchange = (e) => { const f = e.target.files[0]; if (f) doImport(f); e.target.value = ''; };
    const drop = $('#drop', host);
    ['dragenter', 'dragover'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.remove('over'); if (n === 'drop' && e.dataTransfer.files[0]) doImport(e.dataTransfer.files[0]); }));
  }
  // parameters: the fields this component already has in the project data; edits write back to the same draft
  function params(host, c) {
    const isMesh = !!c.mesh, num = (k, label) => `<label class="f">${label}<input type="number" step="0.05" data-g="${k}" value="${c.g[k]}" ${isMesh && 'wdh'.includes(k) ? 'disabled title="Imported meshes keep their size"' : ''}></label>`;
    host.innerHTML = `<div class="pane"><h2>Parameters <button class="btn sm" id="pBack">Done</button></h2>
      <label class="f">Name<input id="pName" value="${esc(c.name)}"></label>
      <div class="grid g2"><label class="f">Layer<select id="pLayer">${M().layers.map((l) => `<option ${l.name === c.layer ? 'selected' : ''} ${l.locked && l.name !== c.layer ? 'disabled' : ''}>${esc(l.name)}</option>`).join('')}</select></label>
        <label class="f">Type<select id="pType">${TYPES.map((t) => `<option ${t === c.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
      ${c.type === 'room' ? `<div class="grid g2"><label class="f">Floor finish<select data-room="floor">${MATS.map((m) => `<option ${m === c.room?.floor ? 'selected' : ''}>${m}</option>`).join('')}</select></label><label class="f">Ceiling finish<select data-room="ceiling">${MATS.map((m) => `<option ${m === c.room?.ceiling ? 'selected' : ''}>${m}</option>`).join('')}</select></label></div>`
        : `<label class="f">Material<select id="pMat">${MATS.map((m) => `<option ${m === c.mat ? 'selected' : ''}>${m}</option>`).join('')}</select></label>`}
      <span class="note">Position (m)</span><div class="dims">${num('x', 'x')}${num('y', 'y')}${num('z', 'z')}</div>
      <span class="note">Size (m)</span><div class="dims">${num('w', 'Width')}${num('d', 'Depth')}${num('h', 'Height')}</div>
      ${isMesh ? '<p class="note">Imported mesh: position can change, size stays as imported.</p>' : ''}</div>`;
    const ch = () => { persist(); vp.setModel(M()); vp.select(UI.sel); layers(); selPane(); };
    $('#pBack', host).onclick = () => { showParams = false; rail(); panel(); };
    $('#pName', host).onchange = (e) => { c.name = e.target.value.trim() || c.name; ch(); };
    $('#pLayer', host).onchange = (e) => { c.layer = e.target.value; open.add(c.layer); ch(); };
    $('#pType', host).onchange = (e) => { c.type = e.target.value; if (c.type === 'room' && !c.room) c.room = { floor: 'Timber', ceiling: 'Gypsum' }; ch(); panel(); };
    $('#pMat', host)?.addEventListener('change', (e) => { c.mat = e.target.value; ch(); });
    $$('[data-room]', host).forEach((s) => s.onchange = () => { c.room = { ...c.room, [s.dataset.room]: s.value }; ch(); });
    $$('[data-g]', host).forEach((i) => i.onchange = () => { const v = parseFloat(i.value); if (!Number.isFinite(v) || ('wdh'.includes(i.dataset.g) && v <= 0)) { i.value = c.g[i.dataset.g]; return; } c.g[i.dataset.g] = v; ch(); });
  }

  // ---- right: layers (Rhino-style rows), selection, versions, next
  function layers() {
    const host = $('#layers', app), comps = M().components;
    for (const c of comps) if (!M().layers.find((l) => l.name === c.layer)) M().layers.push({ name: c.layer, color: LAYER_COLORS[c.layer] || '#ccc', visible: true, locked: false });
    host.innerHTML = M().layers.map((l, i) => { const list = comps.filter((c) => c.layer === l.name), o = open.has(l.name); return `<div class="w2-layer ${l.visible ? '' : 'off'} ${l.locked ? 'locked' : ''}">
      <div class="w2-lrow"><span class="sw" style="background:${l.color}"></span><button class="nm" data-open="${i}" aria-expanded="${o}">${o ? '▾' : '▸'} ${esc(l.name)}</button><span class="cnt">${list.length}</span>
      <button class="ic" data-vis="${i}" title="${l.visible ? 'Hide' : 'Show'} ${esc(l.name)}" aria-label="${l.visible ? 'Hide' : 'Show'} ${esc(l.name)}" aria-pressed="${!l.visible}">${l.visible ? EYE_ON : EYE_OFF}</button>
      <button class="ic" data-lock="${i}" title="${l.locked ? 'Unlock' : 'Lock'} ${esc(l.name)}" aria-label="${l.locked ? 'Unlock' : 'Lock'} ${esc(l.name)}" aria-pressed="${l.locked}">${l.locked ? LOCK_ON : LOCK_OFF}</button></div>
      ${o ? `<div class="comps">${list.map((c) => `<button data-sel="${c.id}" aria-current="${c.id === UI.sel}" ${l.locked || !l.visible ? `aria-disabled="true" title="${l.locked ? 'Locked layer: unlock it to select' : 'Hidden layer: show it to select'}"` : ''}>${esc(c.name)}</button>`).join('') || '<span class="note">Empty</span>'}</div>` : ''}</div>`; }).join('');
    $$('[data-open]', host).forEach((b) => b.onclick = () => { const n = M().layers[b.dataset.open].name; open.has(n) ? open.delete(n) : open.add(n); UI.open = [...open]; saveUI(); layers(); });
    $$('[data-vis]', host).forEach((b) => b.onclick = () => { const l = M().layers[b.dataset.vis]; l.visible = !l.visible; persist(); vp.setModel(M()); if (!l.visible && comp(UI.sel)?.layer === l.name) setSel(null); else { vp.select(UI.sel); layers(); } });
    $$('[data-lock]', host).forEach((b) => b.onclick = () => { const l = M().layers[b.dataset.lock]; l.locked = !l.locked; persist(); if (l.locked && comp(UI.sel)?.layer === l.name) setSel(null); else layers(); });
    $$('[data-sel]', host).forEach((b) => b.onclick = () => { if (b.getAttribute('aria-disabled') === 'true') return; setSel(b.dataset.sel); });
  }
  function selPane() {
    const host = $('#selp', app), c = comp(UI.sel);
    if (!c) { host.innerHTML = `<h2>Selection</h2><p class="note">Click a component in the model or in the layer list. ${M().components.length} components on ${M().layers.length} layers.</p>`; return; }
    host.innerHTML = `<h2>Selection <button class="btn sm" id="desel">Clear</button></h2>
      <p style="font-weight:600">${esc(c.name)}</p><p class="note">${esc(c.layer)} · ${esc(c.type)} · ${c.g.w} × ${c.g.d} × ${c.g.h} m</p>
      <button class="btn sm" id="edit">Edit parameters</button>
      <div class="grid g2"><button class="btn" id="dup">Duplicate</button><button class="btn danger" id="del">Delete</button></div>`;
    $('#desel', host).onclick = () => setSel(null);
    $('#edit', host).onclick = () => { showParams = true; rail(); panel(); };
    $('#dup', host).onclick = () => { const n = S.clone(c); n.id = S.uid('c'); n.name = c.name + ' copy'; n.g.x += 1; M().components.push(n); persist(); vp.setModel(M()); setSel(n.id); };
    $('#del', host).onclick = () => { M().components = M().components.filter((x) => x.id !== c.id); persist(); vp.setModel(M()); setSel(null); };
  }
  function state() {
    const v = last(), d = dirty();
    $('#state', app).innerHTML = `${p.sample ? 'Sample project with mock results. Edits are kept in this browser.' : 'Edits are kept in this browser.'} · ${esc(p.name)} · ${v ? 'v' + v.n : 'no version yet'}${d ? ' · <span class="dirty">unsaved changes</span>' : ''}`;
    $('#dirty', app).textContent = d ? (v ? `Changes since v${v.n} are not saved.` : 'Save the first version to run simulations.') : `Up to date with v${v.n}.`;
    $('#versions', app).innerHTML = p.versions.slice().reverse().map((x) => `<div class="vrow ${x === v && !d ? 'cur' : ''}"><span class="vn">v${x.n}</span><div><div>${esc(x.note)}</div><div class="vmeta">${when(x.created)} · ${p.runs.filter((r) => r.versionId === x.id).length} results</div></div>
      <div style="display:grid;gap:4px"><button class="btn sm" data-load="${x.id}">Open</button><a class="btn sm" href="#/simulations?project=${p.id}&version=${x.id}">Simulate</a></div></div>`).join('') || '<p class="note">No versions yet.</p>';
    $$('[data-load]', app).forEach((b) => b.onclick = () => { if (dirty() && !confirm('Discard unsaved changes and open this version?')) return; p.draft = S.clone(S.version(p, b.dataset.load).model); persist(); refresh(true); setSel(null); toast('Version opened'); });
    $('#toSim', app).href = v ? `#/simulations?project=${p.id}&version=${v.id}` : '#/simulations';
  }
  $('#add', app).onchange = (e) => { const k = e.target.value; if (!k) return; const n = { id: S.uid('c'), ...S.clone(NEW[k]) }; M().components.push(n); e.target.value = ''; open.add(n.layer); persist(); vp.setModel(M()); layers();
    if (layerOf(n)?.locked) toast(`${n.name} added on ${n.layer} (locked layer)`); else { setSel(n.id); toast(`${n.name} added on ${n.layer}`); } };
  $('#addLayer', app).onclick = () => { const name = prompt('Layer name'); if (!name || M().layers.find((l) => l.name === name.trim())) return; M().layers.push({ name: name.trim(), color: '#cfcac0', visible: true, locked: false }); open.add(name.trim()); persist(); layers(); };
  $('#saveV', app).onclick = () => { if (!dirty() && last()) { toast('No changes since v' + last().n); return; } const v = S.saveVersion(p, $('#note', app).value.trim()); $('#note', app).value = ''; state(); toast(`Saved v${v.n}`); };

  // ---- status bar: saved settings only in this step
  $$('[data-snap]', app).forEach((i) => i.onchange = () => { UI.snap[i.dataset.snap] = i.checked; saveUI(); });
  $$('[data-sw]', app).forEach((b) => b.onclick = () => { const k = b.dataset.sw; UI[k] = !UI[k]; b.setAttribute('aria-checked', String(UI[k])); saveUI(); });

  subs.push((id) => vp.select(id), () => layers(), () => selPane(), () => { rail(); panel(); });
  function refresh(refit) { vp.setModel(M(), { refit }); layers(); selPane(); state(); menus(); }

  // restore: display, view (a plan level that no longer exists falls back to Level 1), selection on this project
  vp.setModel(M(), { refit: true });
  vp.setDisplay(UI.display);
  const lv = levelsOf(M()); vp.setView({ kind: UI.view, level: lv.some((l) => l.n === UI.level) ? UI.level : 1 });
  state(); menus();
  setSel(UI.selProject === p.id ? UI.sel : null, { params: false });
  window.__ws2 = { vp, UI, sel: () => UI.sel };   // read-only hook for the browser checks in tests
  return () => { document.removeEventListener('click', outside); vp.dispose(); delete window.__ws2; };
}
