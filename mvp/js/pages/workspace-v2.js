// Workspace v2 (TEMP, for review): the merged Workspace skeleton with a Rhino-like layout.
// The archived Workspace (pages/workspace.js, #/workspace) is not changed. Same project data (store.js), same import code (viewport.js).
// One page store (UI below, saved in this browser) holds view, display mode, panel, selection and the status-bar settings;
// hide / lock live on the project's layers, exactly as in the archived Workspace, so versions keep them.
import * as S from '../store.js';
import { LAYER_COLORS, PAGE, FULL } from '../data.js';
import { $, $$, esc, when, toast, currentProject, setCurrent } from '../app.js';
import { importModel } from '../viewport.js';
import { createViewport2, levelsOf, wallFrame, EYE, CUT } from '../viewport2.js';
import { FORMATS, make as makeExport } from '../export3d.js';
import { MODELS, GROUPS } from '../../../furniture/models.js';   // Plan Studio's parametric furniture: names, groups and clearance rules
import { TOOL_ICONS } from '../tool-icons.js';
import { newFurniture, fitBox, paramsOf, label as fl, paramVisible } from '../furn3d.js';
import { drawPlan, measure, wallFaces, clampGap, gapMove, footprint, boxOf } from '../plan2d.js';

// as in the archived Workspace
const TYPES = ['wall', 'slab', 'roof', 'window', 'room', 'mass', 'terrain', 'furniture', 'imported'];
const MATS = ['Concrete', 'Plaster', 'Gypsum', 'Glass', 'Timber', 'Carpet', 'Acoustic panel', 'Grass', 'Context', 'Imported'];

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
  furniture: { label: 'Furniture', icon: I('<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 12a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z"/><path d="M5 17v2M19 17v2"/>'), cards: true,
    sections: GROUPS.map((g) => [g, MODELS.filter((m) => m.group === g).map((m) => m.en)]).filter(([, l]) => l.length) },
  light: { label: 'Light', icon: I('<path d="M12 3v5"/><path d="M7 13a5 5 0 0 1 10 0z"/><path d="M10 16.5h4M12 13v1"/><path d="M8 20l1-2M16 20l-1-2M12 21v-2"/>'), sections: [
    ['Lights', ['Recessed downlight', 'Flush mount', 'Pendant', 'Track spot', 'Wall sconce', 'LED strip']]] },
};
const FURN_BY_NAME = new Map(MODELS.map((m) => [m.en, m]));
// a piece without a stored kind gets one guessed from its name, and the panel says it was guessed
const GUESS = [[/desk|workstation/i, 'desk'], [/dining|table/i, 'dining'], [/sofa|couch/i, 'sofa'], [/\bbed\b/i, 'bed'], [/office chair/i, 'office'], [/chair/i, 'chair'], [/wardrobe/i, 'wardrobe'], [/shelf|bookcase/i, 'bookshelf'], [/cabinet/i, 'kitchen']];
function furnKind(c) {
  if (c.furn) return { m: MODELS.find((x) => x.id === c.furn), guessed: false };
  const g = GUESS.find(([re]) => re.test(c.name)) || null, m = g ? MODELS.find((x) => x.id === g[1]) : MODELS.find((x) => c.name.toLowerCase().includes(x.en.toLowerCase()));
  return { m: m || null, guessed: true };
}
function clearanceRects(model) {
  const vis = new Set(model.layers.filter((l) => l.visible).map((l) => l.name)), out = [];
  for (const c of model.components) { if (c.type !== 'furniture' || !vis.has(c.layer)) continue; const r = furnKind(c).m?.clearance; if (!r) continue;
    out.push({ id: c.id, z: c.g.z, x0: c.g.x - r.left, x1: c.g.x + c.g.w + r.right, y0: c.g.y - r.front, y1: c.g.y + c.g.d + r.back }); }   // front faces -y, as in Plan Studio's models
  return out;
}
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
const DEF_UI = { panel: 'project', view: 'persp', level: 1, wall: null, side: 1, display: 'shaded', snap: { End: true, Near: true, Mid: true, Cen: false }, gumball: false, clearance: false, sels: [], selProject: null, open: ['Walls', 'Glazing', 'Rooms', 'Imported'], xd: 1.5, xlabels: true };
function readUI() { try { const u = JSON.parse(localStorage.getItem(UKEY) || 'null'); if (!u) return { ...DEF_UI }; if (!u.sels) u.sels = u.sel ? [u.sel] : []; return { ...DEF_UI, ...u, snap: { ...DEF_UI.snap, ...(u.snap || {}) } }; } catch (e) { return { ...DEF_UI }; } }
const IEL_ICON = I('<rect x="3" y="4" width="18" height="16"/><path d="M3 16h18M8 16v-5h4v5"/>');

export function render(app, [pid]) {
  const p = (pid && S.project(pid)) || currentProject();
  if (!p) { app.innerHTML = '<div class="wrap"><p>No project yet. <a href="#/">Create one on Home.</a></p></div>'; return; }
  setCurrent(p);
  const M = () => p.draft, comp = (id) => M().components.find((c) => c.id === id);
  const layerOf = (c) => M().layers.find((l) => l.name === c?.layer);
  const last = () => p.versions.at(-1), dirty = () => !last() || JSON.stringify(last().model) !== JSON.stringify(p.draft);
  const UI = readUI(); const saveUI = () => { try { localStorage.setItem(UKEY, JSON.stringify(UI)); } catch (e) { } };
  const open = new Set(UI.open);
  let showParams = false, xplOn = false;
  const primary = () => UI.sels.at(-1) || null, isSel = (id) => UI.sels.includes(id);

  // ---- the one selection (a list; the last one picked is the primary); every region subscribes to it
  const subs = [];
  const selectable = (id) => { const c = comp(id), l = layerOf(c); return !!(c && l && !l.locked && l.visible !== false); };
  function setSel(ids, { params = true } = {}) {
    ids = [...new Set((Array.isArray(ids) ? ids : [ids]).filter((id) => id && selectable(id)))];
    UI.sels = ids; UI.selProject = p.id; for (const id of ids) open.add(comp(id).layer); UI.open = [...open]; saveUI();
    showParams = ids.length > 0 && params;
    for (const f of subs) f(ids);
  }
  // Rhino: Shift adds, Ctrl (or Cmd) removes, plain click or box replaces
  function pick(id, { add, remove } = {}) {
    if (remove) return setSel(UI.sels.filter((x) => x !== id));
    if (add) return id ? setSel(isSel(id) ? UI.sels : [...UI.sels, id]) : undefined;
    setSel(id ? [id] : []);
  }
  function boxPick(ids, { add, remove }) { if (remove) setSel(UI.sels.filter((x) => !ids.includes(x))); else if (add) setSel([...UI.sels, ...ids]); else setSel(ids); }

  app.innerHTML = `<div class="w2">
  <nav class="w2-rail" aria-label="Tools">
    ${Object.entries(TOOLS).map(([k, t]) => `<button type="button" data-panel="${k}" title="${t.label}" aria-label="${t.label}">${t.icon}</button>`).join('')}
    <span class="sp"></span>
    <button type="button" data-panel="project" title="Project" aria-label="Project">${PROJECT_ICON}</button>
  </nav>
  <aside class="w2-panel" id="panel" aria-label="Panel"></aside>
  <section class="stage w2-stage" aria-label="3D model">
    <div class="vp" id="vp"></div>
    <svg class="w2-annot" id="annot" aria-label="Distances of the selected piece to the walls"></svg><input class="w2-inl" id="inl" type="number" hidden aria-label="Distance in millimetres">
    <div class="w2-cap" id="cap">
      <div><button type="button" id="vBtn" aria-haspopup="true" aria-expanded="false"></button><div class="w2-menu" id="vMenu" role="menu" hidden></div></div>
      <span class="w2-sep" aria-hidden="true"></span>
      <div><button type="button" id="dBtn" aria-haspopup="true" aria-expanded="false"></button><div class="w2-menu" id="dMenu" role="menu" hidden></div></div>
    </div>
    <div class="w2-tr"><button class="btn sm" id="fit">Fit</button></div>
    <div class="w2-xpanel" id="xPanel" hidden role="group" aria-label="Exploded view">
      <b>Exploded view</b><label>Gap between storeys <output id="xDv"></output><input type="range" id="xD" min="0" max="4000" step="100"></label>
      <label class="ck"><input type="checkbox" id="xLab"> Storey labels</label>
      <div class="row"><button class="btn sm" id="xReset">Reset gap</button><button class="btn sm primary" id="xClose">Close</button></div>
      <p class="note">Display only. Selection is off while exploded.</p></div>
    <div class="w2-dlg" id="elvDlg" hidden role="dialog" aria-modal="true" aria-labelledby="elvH">
      <div class="w2-dlg-in"><div class="hd"><b id="elvH">Interior elevation</b><button class="btn sm ghost" id="wpX" aria-label="Close">✕</button></div>
        <p class="note">Hover a wall, then click it on the side you want to look at.</p>
        <svg id="wpSvg" role="group" aria-label="Walls on this level"></svg>
        <p class="note" id="wpInfo" role="status"></p>
        <div class="row"><button class="btn sm" id="wpCancel">Cancel</button><button class="btn sm primary" id="wpGo" disabled>Show elevation</button></div></div></div>
    <div class="hint" id="hint"></div>
  </section>
  <aside class="w2-right" aria-label="Layers, selection and versions">
    <div class="w2-mini"><button type="button" class="btn sm" id="tElev" aria-pressed="false" title="Choose a wall on a plan map and look at it from inside the room">Interior elevation</button><button type="button" class="btn sm" id="tXpl" aria-pressed="false" title="Pull the storeys apart">Explode</button><button type="button" class="btn sm" id="tWalk" aria-pressed="false">Walkthrough</button></div>
    <div class="pane"><h2>Layers <button class="btn sm" id="addLayer">+ Layer</button></h2>
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
    <button type="button" class="w2-sw" role="switch" data-sw="clearance" aria-checked="${UI.clearance}" title="Show the free space each piece wants around it (front, back and sides). A hint only: nothing is blocked or snapped.">Clearance</button>
    <span class="sp"></span><span class="w2-state" id="state"></span>
  </footer></div>`;

  let tabInfo = null;
  let overlay = () => {};
  const vp = createViewport2($('#vp', app), { onPick: pick, onBox: boxPick, onHover: (h) => { tabInfo = h; hint(); }, onPlace: (pt) => place(placingId, pt), onFrame: () => overlay(),
    canDrag: (id) => { const c = comp(id); return !!c && c.type === 'furniture' && selectable(id); }, onDrag: (id, x, y, phase) => dragPiece(id, x, y, phase) });
  const clearance = () => vp.setClearance(UI.clearance && vp.view.kind !== 'plan' ? clearanceRects(M()) : []);   // in plan views the overlay draws it, as Plan Studio does
  const persist = () => { S.save(); state(); clearance(); overlay(); };

  // ---- viewport menu: view list (perspective, one plan per real level, front elevation) and display modes
  const DISPLAYS = [['shaded', 'Shaded'], ['ghosted', 'Ghosted'], ['wire', 'Wireframe']];
  const SELHELP = 'Click to select · drag a box: left→right inside, right→left touching · Shift adds, Ctrl removes · Tab cycles what is under the cursor';
  const viewName = () => { const v = vp.view; if (v.kind === 'ielev') { const w = comp(v.wall); return `Interior elevation · ${w ? w.name : 'wall'}`; } return v.kind === 'plan' ? `Plan · Level ${v.level}` : v.kind === 'elev' ? 'Elevation · Front' : v.kind === 'walk' ? 'Walkthrough' : 'Perspective'; };
  function hint() {
    const v = vp.view, lv = levelsOf(M()).find((x) => x.n === v.level), h = $('#hint', app);
    if (placingId) { h.textContent = `Placing ${FURN_BY_NAME_ID(placingId)} · click on the floor to place it · Esc to stop`; return; }
    if (xplOn) { h.textContent = 'Exploded view · right-drag to orbit · Shift+right-drag to pan · scroll to zoom'; return; }
    if (tabInfo) { h.textContent = `${tabInfo.name} — ${tabInfo.index + 1} of ${tabInfo.count} under the cursor${tabInfo.count > 1 ? ' · Tab for the next one' : ''} · click to select`; return; }
    h.textContent = v.kind === 'plan' ? `Plan · Level ${v.level} at ${lv ? lv.z.toFixed(2) : '0.00'} m, cut ${CUT} m above · right-drag to pan · scroll to zoom · ${SELHELP}`
      : v.kind === 'elev' ? `Front elevation, looking north · right-drag to pan · scroll to zoom · ${SELHELP}`
        : v.kind === 'ielev' ? `Interior elevation${v.frame?.from ? ` from ${v.frame.from}` : ''} · right-drag to pan · scroll to zoom · ${SELHELP}`
          : v.kind === 'walk' ? `Walkthrough at ${EYE} m eye height · drag to look around · scroll to move forward or back · click to select`
            : `Right-drag to orbit · Shift+right-drag to pan · scroll to zoom · ${SELHELP}`;
  }
  function menus() {
    const lv = levelsOf(M()), v = vp.view;
    $('#vBtn', app).textContent = viewName() + ' ▾'; $('#dBtn', app).textContent = DISPLAYS.find(([k]) => k === vp.display)[1] + ' ▾';
    $('#vMenu', app).innerHTML = `<button role="menuitemradio" data-view="persp" aria-checked="${v.kind === 'persp'}">Perspective</button>` + lv.map((l) => `<button role="menuitemradio" data-view="plan" data-level="${l.n}" aria-checked="${v.kind === 'plan' && v.level === l.n}">Plan · Level ${l.n}<small>${l.z.toFixed(2)} m</small></button>`).join('')
      + `<button role="menuitemradio" data-view="elev" aria-checked="${v.kind === 'elev'}">Elevation · Front<small>exterior</small></button>`
      + `<p class="w2-mnote">${lv[0].from === 'slab' ? `${lv.length} level${lv.length > 1 ? 's' : ''} from the slabs in this model.` : 'No slab in this model, so one level at 0.00 m.'}</p>`;
    $('#dMenu', app).innerHTML = DISPLAYS.map(([k, n]) => `<button role="menuitemradio" data-disp="${k}" aria-checked="${vp.display === k}">${n}</button>`).join('');
    $('#tElev', app).setAttribute('aria-pressed', String(v.kind === 'ielev')); $('#tWalk', app).setAttribute('aria-pressed', String(v.kind === 'walk')); $('#tXpl', app).setAttribute('aria-pressed', String(xplOn));
    $$('[data-view]', app).forEach((b) => b.onclick = () => go({ kind: b.dataset.view, level: +(b.dataset.level || v.level) }));
    $$('[data-disp]', app).forEach((b) => b.onclick = () => { vp.setDisplay(b.dataset.disp); UI.display = b.dataset.disp; saveUI(); closeMenus(); menus(); });
    hint();
  }
  function go(v) { if (xplOn) explode(false); vp.setView(v); clearance(); UI.view = vp.view.kind; UI.level = vp.view.level; UI.wall = vp.view.wall || null; UI.side = vp.view.side || 1; saveUI(); closeMenus(); menus(); }
  const closeMenus = () => { for (const [b, m] of [['vBtn', 'vMenu'], ['dBtn', 'dMenu']]) { $('#' + m, app).hidden = true; $('#' + b, app).setAttribute('aria-expanded', 'false'); } };
  for (const [b, m] of [['vBtn', 'vMenu'], ['dBtn', 'dMenu']]) $('#' + b, app).onclick = (e) => { e.stopPropagation(); const was = !$('#' + m, app).hidden; closeMenus(); if (!was) { $('#' + m, app).hidden = false; $('#' + b, app).setAttribute('aria-expanded', 'true'); } };
  const outside = (e) => { if (!e.target.closest('#cap')) closeMenus(); }; document.addEventListener('click', outside);
  $('#tWalk', app).onclick = () => go({ kind: vp.view.kind === 'walk' ? 'persp' : 'walk' });
  $('#fit', app).onclick = () => vp.fit();

  // ---- interior elevation: a plan map of this level's walls (as in Plan Studio); click a wall on the side to look at
  let WP = null;
  const levelWalls = () => { const v = vp.view, lv = levelsOf(M()), L = lv.find((x) => x.n === v.level) || lv[0], next = lv.find((x) => x.z > L.z);
    return M().components.filter((c) => c.type === 'wall' && layerOf(c)?.visible !== false && c.g.z >= L.z - 0.3 && (!next || c.g.z < next.z - 0.3)); };
  function openPicker() {
    if (xplOn) explode(false);
    const walls = levelWalls(), svg = $('#wpSvg', app);
    if (!walls.length) { toast('This level has no walls.'); return; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const w of walls) { x0 = Math.min(x0, w.g.x); y0 = Math.min(y0, w.g.y); x1 = Math.max(x1, w.g.x + w.g.w); y1 = Math.max(y1, w.g.y + w.g.d); }
    const Wd = 560, Hd = 360, pad = 28, k = Math.min((Wd - 2 * pad) / Math.max(1, x1 - x0), (Hd - 2 * pad) / Math.max(1, y1 - y0)), ox = (Wd - (x1 - x0) * k) / 2 - x0 * k, oy = (Hd + (y1 - y0) * k) / 2 + y0 * k;
    const P = (x, y) => [+(ox + x * k).toFixed(2), +(oy - y * k).toFixed(2)], rect = (g, cls, extra = '') => { const a = P(g.x, g.y + g.d); return `<rect class="${cls}" x="${a[0]}" y="${a[1]}" width="${+(g.w * k).toFixed(2)}" height="${+(g.d * k).toFixed(2)}" ${extra}/>`; };
    const rooms = M().components.filter((c) => c.type === 'room' && walls.some((w) => Math.abs(w.g.z - c.g.z) < 0.6));
    svg.setAttribute('viewBox', `0 0 ${Wd} ${Hd}`);
    svg.innerHTML = `<defs><marker id="wpArr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#1f6fd1"/></marker></defs><rect width="${Wd}" height="${Hd}" fill="#fff"/>`
      + rooms.map((r) => rect(r.g, 'wp-room') + `<text class="wp-rn" x="${P(r.g.x + r.g.w / 2, 0)[0]}" y="${P(0, r.g.y + r.g.d / 2)[1]}">${esc(r.name)}</text>`).join('')
      + walls.map((w) => { const hg = w.g.w >= w.g.d ? { x: w.g.x, y: w.g.y - 0.3, w: w.g.w, d: w.g.d + 0.6 } : { x: w.g.x - 0.3, y: w.g.y, w: w.g.w + 0.6, d: w.g.d }; return `<g class="wp-wall" data-wall="${w.id}" tabindex="0" role="button" aria-label="${esc(w.name)}">${rect(hg, 'wp-hit')}${rect(w.g, 'wp-solid')}</g>`; }).join('') + '<g id="wpSide"></g>';
    WP = { wall: null, side: 1, k, ox, oy, P }; $('#wpGo', app).disabled = true; $('#wpInfo', app).textContent = ''; $('#elvDlg', app).hidden = false; setTimeout(() => $('#wpX', app).focus(), 0);
  }
  function wpPick(id, cx, cy) {
    const w = comp(id); if (!w) return; const svg = $('#wpSvg', app), r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    const alongX = w.g.w >= w.g.d, mid = alongX ? w.g.y + w.g.d / 2 : w.g.x + w.g.w / 2;
    let side;
    if (cx != null) { const sx = (cx - r.left) * vb.width / r.width, sy = (cy - r.top) * vb.height / r.height, px = (sx - WP.ox) / WP.k, py = (WP.oy - sy) / WP.k; side = (alongX ? py : px) >= mid ? 1 : -1; }
    else side = wallFrame(M(), w, 1).room ? 1 : -1;
    WP.wall = id; WP.side = side; $$('.wp-wall', svg).forEach((g) => g.classList.toggle('sel', g.dataset.wall === id));
    const F = wallFrame(M(), w, side), cu = (F.u0 + F.u1) / 2, cuW = alongX ? (w.g.x + w.g.w / 2) : (w.g.y + w.g.d / 2), at = (o) => alongX ? WP.P(cuW, F.face + side * o) : WP.P(F.face + side * o, cuW); void cu;
    const A = at(0.9), B = at(0.15);
    $('#wpSide', app).innerHTML = `<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="#1f6fd1" stroke-width="2.5" marker-end="url(#wpArr)"/><circle cx="${A[0]}" cy="${A[1]}" r="4.5" fill="#1f6fd1"/>`;
    $('#wpInfo', app).textContent = `${w.name} · ${Math.max(w.g.w, w.g.d).toFixed(2)} m · seen from ${F.room ? F.room.name : 'outside the rooms'}.`; $('#wpGo', app).disabled = false;
  }
  $('#wpSvg', app).addEventListener('click', (e) => { const g = e.target.closest('.wp-wall'); if (g) wpPick(g.dataset.wall, e.clientX, e.clientY); });
  $('#wpSvg', app).addEventListener('keydown', (e) => { const g = e.target.closest('.wp-wall'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); wpPick(g.dataset.wall); } });
  const closePicker = () => { $('#elvDlg', app).hidden = true; };
  $('#wpX', app).onclick = closePicker; $('#wpCancel', app).onclick = closePicker;
  $('#elvDlg', app).addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closePicker(); } });
  $('#wpGo', app).onclick = () => { if (!WP?.wall) return; closePicker(); go({ kind: 'ielev', wall: WP.wall, side: WP.side }); };
  $('#tElev', app).onclick = openPicker;

  // ---- exploded view (Plan Studio): storeys pulled apart along Z, display only
  function explode(on) {
    xplOn = on; $('#xPanel', app).hidden = !on;
    if (on) { if (vp.view.kind !== 'persp') vp.setView({ kind: 'persp' }); setSel([]); $('#xD', app).value = Math.round(UI.xd * 1000); $('#xDv', app).textContent = Math.round(UI.xd * 1000) + ' mm'; $('#xLab', app).checked = UI.xlabels; }
    vp.setExplode({ on, d: UI.xd, labels: UI.xlabels }); menus();
  }
  $('#tXpl', app).onclick = () => explode(!xplOn);
  $('#xD', app).oninput = (e) => { UI.xd = +e.target.value / 1000; $('#xDv', app).textContent = e.target.value + ' mm'; saveUI(); vp.setExplode({ d: UI.xd }); };
  $('#xLab', app).onchange = (e) => { UI.xlabels = e.target.checked; saveUI(); vp.setExplode({ labels: UI.xlabels }); };
  $('#xReset', app).onclick = () => { UI.xd = 1.5; saveUI(); $('#xD', app).value = 1500; $('#xDv', app).textContent = '1500 mm'; vp.setExplode({ d: 1.5 }); };
  $('#xClose', app).onclick = () => explode(false);

  // ---- plan views work like Plan Studio: drag a piece to move it, distances to the walls, clearance outlines
  const annot = $('#annot', app), inl = $('#inl', app);
  const levelZ = () => { const lv = levelsOf(M()); return (lv.find((x) => x.n === vp.view.level) || lv[0]).z; };
  const levelFurniture = () => { const z = levelZ(); return M().components.filter((c) => c.type === 'furniture' && layerOf(c)?.visible !== false && Math.abs(c.g.z - z) < 0.6); };
  overlay = () => {
    if (vp.view.kind !== 'plan' || xplOn) { if (annot.innerHTML) annot.innerHTML = ''; return; }
    const z = levelZ(), one = UI.sels.length === 1 ? comp(UI.sels[0]) : null, sel = one && one.type === 'furniture' && Math.abs(one.g.z - z) < 0.6 ? one : null;
    drawPlan(annot, { S: (x, y) => vp.toScreen(x, y, z), ppm: vp.pxPerMetre() || 40, sel, walls: levelWalls(), furniture: levelFurniture(), showClearance: UI.clearance, clearanceOf: (c) => furnKind(c).m?.clearance || null });
  };
  let dragged = false;
  function dragPiece(id, x, y, phase) {
    const c = comp(id); if (!c) return;
    if (phase === 'move') { if (!isSel(id) || UI.sels.length !== 1) setSel([id], { params: showParams }); c.g.x = x; c.g.y = y; dragged = true; vp.moveObject(id, x, y); return; }
    if (dragged) { dragged = false; persist(); selPane(); if (showParams) setTimeout(panel, 0); }
  }
  function setGap(side, mm) {
    const c = comp(UI.sels[0]); if (!c) return; const F = footprint(c), res = measure(boxOf(F.corners), wallFaces(levelWalls())); if (!isFinite(res[side].d)) return;
    const k = clampGap(side, mm, res); if (!k.ok) { toast('Type a distance in millimetres.'); return; }
    if (k.clamped) toast(k.mm === 0 ? 'A distance cannot be below 0 mm, so it is set to 0 mm.' : `Limited to ${Math.round(k.mm)} mm, the most this side allows (wall to the opposite wall, minus the piece).`);
    const mv = gapMove(side, k.mm, res); c.g.x = +(c.g.x + mv[0]).toFixed(3); c.g.y = +(c.g.y + mv[1]).toFixed(3); ch(); if (showParams) setTimeout(panel, 0);
  }
  annot.addEventListener('click', (e) => { const l = e.target.closest('.pl-lab'); if (!l) return; const r = l.getBoundingClientRect(), h = $('#vp', app).getBoundingClientRect();
    Object.assign(inl.style, { left: (r.left - h.left + r.width / 2 - 42) + 'px', top: (r.top - h.top + r.height / 2 - 14) + 'px' }); inl.value = l.parentNode.dataset.mm; inl.dataset.side = l.dataset.side; inl.hidden = false; inl.focus(); inl.select(); });
  annot.addEventListener('keydown', (e) => { const l = e.target.closest('.pl-lab'); if (l && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); l.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  inl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const v = inl.value, sd = inl.dataset.side; inl.hidden = true; setGap(sd, v === '' ? NaN : +v); } else if (e.key === 'Escape') { e.stopPropagation(); inl.hidden = true; } });
  inl.addEventListener('blur', () => { inl.hidden = true; });
  // turn handle: drag to rotate about the centre, snaps to 5° on release
  annot.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.pl-rot')) return; const c = comp(UI.sels[0]); if (!c?.furn) return; e.preventDefault(); e.stopPropagation(); annot.setPointerCapture(e.pointerId);
    const ctr = { x: c.g.x + c.g.w / 2, y: c.g.y + c.g.d / 2 };
    const mv = (ev) => { const f = vp.floorAt(ev.clientX, ev.clientY, 0); if (!f) return; const deg = Math.atan2(f.y - ctr.y, f.x - ctr.x) * 180 / Math.PI - 90; c.rot = +(((deg % 360) + 360) % 360).toFixed(1); fitBox(c, ctr); vp.setModel(M()); vp.select(UI.sels); };
    const up = () => { annot.removeEventListener('pointermove', mv); annot.removeEventListener('pointerup', up); c.rot = (Math.round(c.rot / 5) * 5) % 360; fitBox(c, ctr); ch(); if (showParams) setTimeout(panel, 0); };
    annot.addEventListener('pointermove', mv); annot.addEventListener('pointerup', up);
  });

  // ---- placing furniture (as in Plan Studio): drag a card onto the model, or click a card and then click in the model
  let placingId = null;
  const FURN_BY_NAME_ID = (id) => MODELS.find((m) => m.id === id)?.en || 'piece';
  const furnLayerReady = () => { const l = M().layers.find((x) => x.name === 'Furniture'); if (!l) return true; if (l.locked || l.visible === false) { toast(`The Furniture layer is ${l.locked ? 'locked' : 'hidden'}. ${l.locked ? 'Unlock' : 'Show'} it in Layers to place furniture.`); return false; } return true; };
  function startPlacing(id) {
    if (id && !furnLayerReady()) id = null;
    placingId = id; if (id) { if (xplOn) explode(false); const probe = newFurniture(id, { x: 0, y: 0, z: 0 }, 'probe'); vp.setPlacing({ w: probe.g.w, d: probe.g.d, h: probe.g.h }); } else vp.setPlacing(null);
    $$('[data-furn]', app).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.furn === id)));
    const tm = $('#toolMsg', app); if (tm && UI.panel === 'furniture') tm.textContent = id ? `Click in the model to place the ${FURN_BY_NAME_ID(id)}. Esc to stop.` : 'Drag a piece onto the model, or click it and then click in the model.';
    hint();
  }
  function place(id, pt) {
    if (!id || !pt || !furnLayerReady()) return;
    const c = newFurniture(id, pt, S.uid('c')); M().components.push(c); open.add('Furniture');
    if (!M().layers.find((l) => l.name === 'Furniture')) M().layers.push({ name: 'Furniture', color: LAYER_COLORS.Furniture, visible: true, locked: false });
    persist(); vp.setModel(M()); startPlacing(null); setSel([c.id]); toast(`${c.name} placed on Furniture`);
  }
  const vpHost = $('#vp', app);
  vpHost.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('text/x-plotcloud-furn')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  vpHost.addEventListener('drop', (e) => { const id = e.dataTransfer.getData('text/x-plotcloud-furn'); if (!id) return; e.preventDefault(); const pt = vp.floorAt(e.clientX, e.clientY); if (!pt) { toast('Drop the piece on the floor of the model.'); return; } place(id, pt); });

  // ---- left: rail + panel (project / tool group / parameters of the selection)
  function rail() { const k = showParams && UI.sels.length ? null : UI.panel; $$('[data-panel]', app).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.panel === k))); }
  $$('[data-panel]', app).forEach((b) => b.onclick = () => { UI.panel = b.dataset.panel; saveUI(); showParams = false; rail(); panel(); });
  function panel() {
    const host = $('#panel', app);
    if (showParams && UI.sels.length > 1) return multi(host);
    const c = comp(primary()); if (showParams && c) return params(host, c);
    if (UI.panel === 'project') return projectPanel(host);
    const t = TOOLS[UI.panel];
    const tile = (n) => { if (t.cards) { const m = FURN_BY_NAME.get(n); return `<button type="button" class="w2-card" data-tool="${esc(n)}" data-furn="${m.id}" draggable="true" aria-pressed="${placingId === m.id}" title="${esc(n)}: drag onto the model, or click it and then click in the model"><span class="im"><img src="img/furniture/${m.id}.png" alt="" loading="lazy"></span><span>${esc(n)}</span></button>`; }
      const ic = TOOL_ICONS[n]; return `<button type="button" class="w2-tile" data-tool="${esc(n)}" title="${esc(n)}"><span class="im">${ic?.img ? `<img src="${ic.img}" alt="">` : ic?.svg || ''}</span><span>${esc(n)}</span></button>`; };
    host.innerHTML = `<div class="pane w2-tools"><h2>${t.label}</h2>${t.sections.map(([h, items]) => `<div class="w2-sec"><h3>${esc(h)}</h3><div class="w2-grid">${items.map(tile).join('')}</div></div>`).join('')}
      <p class="note" id="toolMsg" role="status" aria-live="polite"></p></div>`;
    $$('[data-tool]', host).forEach((b) => b.onclick = () => {
      if (b.dataset.furn) { startPlacing(placingId === b.dataset.furn ? null : b.dataset.furn); return; }
      $('#toolMsg', host).textContent = 'Placement of this item arrives in Step 2. Furniture can be placed now.'; });
    $$('[data-furn]', host).forEach((b) => b.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-plotcloud-furn', b.dataset.furn); e.dataTransfer.effectAllowed = 'copy'; if (placingId) startPlacing(null); }));
    if (t.cards) $('#toolMsg', host).textContent = placingId ? `Click in the model to place the ${FURN_BY_NAME_ID(placingId)}. Esc to stop.` : 'Drag a piece onto the model, or click it and then click in the model.';
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
      <p class="note" id="siteMsg" role="status" aria-live="polite"></p></div>
    <div class="pane"><h2>Export</h2>
      <div class="w2-exp">${FORMATS.map(([k, n, d]) => `<button type="button" class="btn sm" data-exp="${k}" title="${esc(d)}">${esc(n)}</button>`).join('')}</div>
      <p class="note">Exports what is visible, in metres; hidden layers are left out. SketchUp's own .skp can only be written by SketchUp, so use the .dae, which SketchUp opens directly.</p>
      <p class="note" id="expMsg" role="status" aria-live="polite"></p></div>`;
    $('#proj', host).onchange = (e) => { location.hash = '#/workspace-v2/' + e.target.value; };
    $('#siteBtn', host).onclick = () => { $('#siteMsg', host).textContent = 'Site import arrives in Step 2'; };
    $$('[data-exp]', host).forEach((b) => b.onclick = async () => {
      const k = b.dataset.exp, f = FORMATS.find((x) => x[0] === k), msg = $('#expMsg', host), base = p.name.replace(/\W+/g, '-').replace(/^-|-$/g, '');
      const save = (href, name) => { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
      if (k === 'png') { save(vp.png(), `${base}.png`); msg.textContent = 'Saved the current view as PNG.'; return; }
      msg.textContent = `Writing ${f[1]}…`; b.disabled = true;
      try { const blob = await makeExport(k, M(), p.name), url = URL.createObjectURL(blob); save(url, `${base}.${k}`); setTimeout(() => URL.revokeObjectURL(url), 4000);
        msg.textContent = `Saved ${base}.${k} (${(blob.size / 1024).toFixed(0)} KB).`; }
      catch (e) { msg.textContent = e.message || 'The file could not be written.'; } finally { b.disabled = false; }
    });
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
  const ch = () => { persist(); vp.setModel(M()); vp.select(UI.sels); layers(); selPane(); };
  // several selected: what they share, move them to a layer, delete them
  function multi(host) {
    const list = UI.sels.map(comp).filter(Boolean), byL = {}; for (const c of list) byL[c.layer] = (byL[c.layer] || 0) + 1;
    host.innerHTML = `<div class="pane"><h2>${list.length} selected <button class="btn sm" id="pBack">Done</button></h2>
      <p class="note">${Object.entries(byL).map(([l, n]) => `${n} on ${esc(l)}`).join(' · ')}</p>
      <div class="w2-mlist">${list.map((c) => `<button type="button" data-one="${c.id}" title="Edit only this one">${esc(c.name)}<small>${esc(c.layer)}</small></button>`).join('')}</div>
      <label class="f">Move all to layer<select id="mLayer"><option value="">Choose…</option>${M().layers.filter((l) => !l.locked).map((l) => `<option>${esc(l.name)}</option>`).join('')}</select></label>
      <button class="btn danger" id="mDel">Delete ${list.length}</button></div>`;
    $('#pBack', host).onclick = () => { showParams = false; rail(); panel(); };
    $$('[data-one]', host).forEach((b) => b.onclick = () => setSel([b.dataset.one]));
    $('#mLayer', host).onchange = (e) => { if (!e.target.value) return; for (const c of list) c.layer = e.target.value; open.add(e.target.value); ch(); setTimeout(panel, 0); };
    $('#mDel', host).onclick = () => { if (!confirm(`Delete ${list.length} components?`)) return; const ids = new Set(UI.sels); M().components = M().components.filter((x) => !ids.has(x.id)); persist(); vp.setModel(M()); setSel([]); };
  }
  // parameters: the fields this component already has in the project data; edits write back to the same draft
  function params(host, c) {
    const isMesh = !!c.mesh || !!c.furn, num = (k, label) => `<label class="f">${label}<input type="number" step="0.05" data-g="${k}" value="${c.g[k]}" ${isMesh && 'wdh'.includes(k) ? `disabled title="${c.furn ? 'Set the size with the parameters above' : 'Imported meshes keep their size'}"` : ''}></label>`;
    host.innerHTML = `<div class="pane"><h2>Parameters <button class="btn sm" id="pBack">Done</button></h2>
      <label class="f">Name<input id="pName" value="${esc(c.name)}"></label>
      <div class="grid g2"><label class="f">Layer<select id="pLayer">${M().layers.map((l) => `<option ${l.name === c.layer ? 'selected' : ''} ${l.locked && l.name !== c.layer ? 'disabled' : ''}>${esc(l.name)}</option>`).join('')}</select></label>
        <label class="f">Type<select id="pType">${TYPES.map((t) => `<option ${t === c.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
      ${c.type === 'room' ? `<div class="grid g2"><label class="f">Floor finish<select data-room="floor">${MATS.map((m) => `<option ${m === c.room?.floor ? 'selected' : ''}>${m}</option>`).join('')}</select></label><label class="f">Ceiling finish<select data-room="ceiling">${MATS.map((m) => `<option ${m === c.room?.ceiling ? 'selected' : ''}>${m}</option>`).join('')}</select></label></div>`
        : `<label class="f">Material<select id="pMat">${MATS.map((m) => `<option ${m === c.mat ? 'selected' : ''}>${m}</option>`).join('')}</select></label>`}
      ${c.furn ? (() => { const P = paramsOf(c); if (!P) return ''; const r = P.model.clearance; return `<div class="w2-fp"><span class="note">${esc(P.model.en)} · Plan Studio parameters</span>${P.model.params.filter((q) => paramVisible(q, P.values)).map((q) => {
          const v = P.values[q.k], lab = esc(fl(q.label));
          if (q.type === 'select') return `<label class="f">${lab}<select data-fp="${q.k}">${q.options.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(fl(ol))}</option>`).join('')}</select></label>`;
          if (q.type === 'bool') return `<label class="f ck"><input type="checkbox" data-fp="${q.k}" ${v ? 'checked' : ''}> ${lab}</label>`;
          if (q.type === 'color') return '';
          return `<label class="f">${lab}${q.type === 'int' ? '' : ' (mm)'}<input type="number" data-fp="${q.k}" value="${v}" min="${q.min ?? ''}" max="${q.max ?? ''}" step="${q.step ?? 1}"></label>`; }).join('')}
          <div class="w2-rot"><span class="note">Rotation ${c.rot || 0}°</span><button class="btn sm" data-rot="-90" title="Rotate 90° anticlockwise">⟲ 90°</button><button class="btn sm" data-rot="90" title="Rotate 90° clockwise">⟳ 90°</button></div>
          <p class="note">${r ? `Clearance: front ${r.front} m, back ${r.back} m, sides ${r.left} / ${r.right} m (Plan Studio rule).` : 'This kind has no clearance in Plan Studio.'}</p></div>`; })() : ''}
      ${c.type === 'furniture' && !c.furn ? (() => { const k = furnKind(c), r = k.m?.clearance; return `<label class="f">Furniture kind<select id="pFurn"><option value="">Not set</option>${GROUPS.map((g) => `<optgroup label="${esc(g)}">${MODELS.filter((m) => m.group === g).map((m) => `<option value="${m.id}" ${k.m?.id === m.id ? 'selected' : ''}>${esc(m.en)}</option>`).join('')}</optgroup>`).join('')}</select></label>
        <p class="note">${k.m ? (k.guessed ? `Guessed from the name “${esc(c.name)}”. Change it if it is wrong. ` : '') + (r ? `Clearance: front ${r.front} m, back ${r.back} m, sides ${r.left} / ${r.right} m (Plan Studio rule).` : 'This kind has no clearance in Plan Studio.') : 'Choose a kind to show its clearance.'}</p>`; })() : ''}
      <span class="note">Position (m)</span><div class="dims">${num('x', 'x')}${num('y', 'y')}${num('z', 'z')}</div>
      <span class="note">Size (m)</span><div class="dims">${num('w', 'Width')}${num('d', 'Depth')}${num('h', 'Height')}</div>
      ${c.mesh ? '<p class="note">Imported mesh: position can change, size stays as imported.</p>' : ''}</div>`;
    $('#pBack', host).onclick = () => { showParams = false; rail(); panel(); };
    $('#pName', host).onchange = (e) => { c.name = e.target.value.trim() || c.name; ch(); };
    $('#pLayer', host).onchange = (e) => { c.layer = e.target.value; open.add(c.layer); ch(); };
    $('#pType', host).onchange = (e) => { c.type = e.target.value; if (c.type === 'room' && !c.room) c.room = { floor: 'Timber', ceiling: 'Gypsum' }; ch(); setTimeout(panel, 0); };
    $('#pMat', host)?.addEventListener('change', (e) => { c.mat = e.target.value; ch(); });
    $$('[data-fp]', host).forEach((i) => i.onchange = () => { const P = paramsOf(c), q = P.model.params.find((x) => x.k === i.dataset.fp); let v = i.type === 'checkbox' ? i.checked : q.type === 'select' ? (typeof q.def === 'number' ? +i.value : i.value) : +i.value;
      if (typeof v === 'number') { if (!Number.isFinite(v)) { i.value = P.values[q.k]; return; } if (q.min != null) v = Math.max(q.min, v); if (q.max != null) v = Math.min(q.max, v); }
      c.params = { ...(c.params || {}), [q.k]: v }; fitBox(c); ch(); setTimeout(panel, 0); });
    $$('[data-rot]', host).forEach((b) => b.onclick = () => { c.rot = (((c.rot || 0) + +b.dataset.rot) % 360 + 360) % 360; fitBox(c); ch(); setTimeout(panel, 0); });
    $('#pFurn', host)?.addEventListener('change', (e) => { if (e.target.value) c.furn = e.target.value; else delete c.furn; ch(); setTimeout(panel, 0); });
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
      ${o ? `<div class="comps">${list.map((c) => `<button data-sel="${c.id}" aria-current="${isSel(c.id)}" ${l.locked || !l.visible ? `aria-disabled="true" title="${l.locked ? 'Locked layer: unlock it to select' : 'Hidden layer: show it to select'}"` : 'title="Shift-click adds, Ctrl-click removes"'}>${esc(c.name)}</button>`).join('') || '<span class="note">Empty</span>'}</div>` : ''}</div>`; }).join('');
    $$('[data-open]', host).forEach((b) => b.onclick = () => { const n = M().layers[b.dataset.open].name; open.has(n) ? open.delete(n) : open.add(n); UI.open = [...open]; saveUI(); layers(); });
    $$('[data-vis]', host).forEach((b) => b.onclick = () => { const l = M().layers[b.dataset.vis]; l.visible = !l.visible; persist(); vp.setModel(M()); if (!l.visible && UI.sels.some((id) => comp(id)?.layer === l.name)) setSel(UI.sels.filter((id) => comp(id)?.layer !== l.name)); else { vp.select(UI.sels); layers(); } });
    $$('[data-lock]', host).forEach((b) => b.onclick = () => { const l = M().layers[b.dataset.lock]; l.locked = !l.locked; persist(); if (l.locked && UI.sels.some((id) => comp(id)?.layer === l.name)) setSel(UI.sels.filter((id) => comp(id)?.layer !== l.name)); else layers(); });
    $$('[data-sel]', host).forEach((b) => b.onclick = (e) => { if (b.getAttribute('aria-disabled') === 'true') return; pick(b.dataset.sel, { add: e.shiftKey, remove: e.ctrlKey || e.metaKey }); });
  }
  function selPane() {
    const host = $('#selp', app), list = UI.sels.map(comp).filter(Boolean), c = list.at(-1);
    if (!c) { host.innerHTML = `<h2>Selection</h2><p class="note">Click a component in the model or in the layer list, or drag a box in the view. ${M().components.length} components on ${M().layers.length} layers.</p>`; return; }
    if (list.length > 1) {
      host.innerHTML = `<h2>Selection <button class="btn sm" id="desel">Clear</button></h2><p style="font-weight:600">${list.length} components</p><p class="note">${esc(list.map((x) => x.name).slice(0, 4).join(', '))}${list.length > 4 ? ` and ${list.length - 4} more` : ''}</p>
        <button class="btn sm" id="edit">Edit selection</button><button class="btn danger" id="del">Delete ${list.length}</button>`;
      $('#desel', host).onclick = () => setSel([]); $('#edit', host).onclick = () => { showParams = true; rail(); panel(); };
      $('#del', host).onclick = () => { if (!confirm(`Delete ${list.length} components?`)) return; const ids = new Set(UI.sels); M().components = M().components.filter((x) => !ids.has(x.id)); persist(); vp.setModel(M()); setSel([]); };
      return;
    }
    host.innerHTML = `<h2>Selection <button class="btn sm" id="desel">Clear</button></h2>
      <p style="font-weight:600">${esc(c.name)}</p><p class="note">${esc(c.layer)} · ${esc(c.type)} · ${c.g.w} × ${c.g.d} × ${c.g.h} m</p>
      <button class="btn sm" id="edit">Edit parameters</button>
      <div class="grid g2"><button class="btn" id="dup">Duplicate</button><button class="btn danger" id="del">Delete</button></div>`;
    $('#desel', host).onclick = () => setSel([]);
    $('#edit', host).onclick = () => { showParams = true; rail(); panel(); };
    $('#dup', host).onclick = () => { const n = S.clone(c); n.id = S.uid('c'); n.name = c.name + ' copy'; n.g.x += 1; M().components.push(n); persist(); vp.setModel(M()); setSel([n.id]); };
    $('#del', host).onclick = () => { M().components = M().components.filter((x) => x.id !== c.id); persist(); vp.setModel(M()); setSel([]); };
  }
  function state() {
    const v = last(), d = dirty();
    $('#state', app).innerHTML = `${p.sample ? 'Sample project with mock results. Edits are kept in this browser.' : 'Edits are kept in this browser.'} · ${esc(p.name)} · ${v ? 'v' + v.n : 'no version yet'}${d ? ' · <span class="dirty">unsaved changes</span>' : ''}`;
    $('#dirty', app).textContent = d ? (v ? `Changes since v${v.n} are not saved.` : 'Save the first version to run simulations.') : `Up to date with v${v.n}.`;
    $('#versions', app).innerHTML = p.versions.slice().reverse().map((x) => `<div class="vrow ${x === v && !d ? 'cur' : ''}"><span class="vn">v${x.n}</span><div><div>${esc(x.note)}</div><div class="vmeta">${when(x.created)} · ${p.runs.filter((r) => r.versionId === x.id).length} results</div></div>
      <div style="display:grid;gap:4px"><button class="btn sm" data-load="${x.id}">Open</button><a class="btn sm" href="#/simulations?project=${p.id}&version=${x.id}">Simulate</a></div></div>`).join('') || '<p class="note">No versions yet.</p>';
    $$('[data-load]', app).forEach((b) => b.onclick = () => { if (dirty() && !confirm('Discard unsaved changes and open this version?')) return; p.draft = S.clone(S.version(p, b.dataset.load).model); persist(); refresh(true); setSel([]); toast('Version opened'); });
    $('#toSim', app).href = v ? `#/simulations?project=${p.id}&version=${v.id}` : '#/simulations';
  }
  $('#addLayer', app).onclick = () => { const name = prompt('Layer name'); if (!name || M().layers.find((l) => l.name === name.trim())) return; M().layers.push({ name: name.trim(), color: '#cfcac0', visible: true, locked: false }); open.add(name.trim()); persist(); layers(); };
  $('#saveV', app).onclick = () => { if (!dirty() && last()) { toast('No changes since v' + last().n); return; } const v = S.saveVersion(p, $('#note', app).value.trim()); $('#note', app).value = ''; state(); toast(`Saved v${v.n}`); };

  // ---- status bar
  $$('[data-snap]', app).forEach((i) => i.onchange = () => { UI.snap[i.dataset.snap] = i.checked; saveUI(); });
  $$('[data-sw]', app).forEach((b) => b.onclick = () => { const k = b.dataset.sw; UI[k] = !UI[k]; b.setAttribute('aria-checked', String(UI[k])); saveUI(); if (k === 'clearance') { clearance(); overlay(); } });
  // Esc clears the selection, Delete removes it (not while typing)
  const onKey = (e) => { if (e.target.closest?.('input,select,textarea') || !$('#elvDlg', app).hidden) return; if (e.key === 'Escape') { if (placingId) startPlacing(null); else if (UI.sels.length) setSel([]); } };
  addEventListener('keydown', onKey);

  subs.push((ids) => vp.select(ids), () => layers(), () => selPane(), () => { rail(); panel(); }, () => overlay());
  function refresh(refit) { vp.setModel(M(), { refit }); layers(); selPane(); state(); menus(); clearance(); }

  // restore: display, view (a plan level or wall that no longer exists falls back), selection on this project
  vp.setModel(M(), { refit: true });
  vp.setDisplay(UI.display);
  const lv = levelsOf(M()), lvl = lv.some((l) => l.n === UI.level) ? UI.level : 1;
  vp.setView(UI.view === 'ielev' && comp(UI.wall) ? { kind: 'ielev', wall: UI.wall, side: UI.side, level: lvl } : { kind: UI.view === 'ielev' ? 'persp' : UI.view, level: lvl });
  state(); menus(); clearance();
  setSel(UI.selProject === p.id ? UI.sels : [], { params: false });
  window.__ws2 = { vp, UI, sel: () => primary(), sels: () => [...UI.sels], model: () => p.draft };   // read-only hook for the browser checks in tests
  return () => { document.removeEventListener('click', outside); removeEventListener('keydown', onKey); vp.dispose(); delete window.__ws2; };
}
