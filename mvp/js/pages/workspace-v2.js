// The Workspace (#/workspace): Plan Studio in one view (chosen at the top left), with the Workspace's own tools, Rhino-style panels on the
// right (Properties, Layers, Versions; additional views under View tools) and the status bar.
// The command bar is outside the viewport; long panel lists scroll without pagination.
//   Plan        = Plan Studio's 2D (emb/modeler.html?ws=plan): its wall, room, door, window and furniture tools, handles, toolbars and clearance.
//   Perspective = Plan Studio's 3D (?ws=persp): its gumball, Bird / Walkthrough / Explode, plus a Ghosted / Wireframe display switch.
//   (Shaded     = the earlier solid view (viewport2.js); since 2026-10-25 not shown: imported meshes and the site are in Plan Studio's
//                 model, so Perspective draws them. It is kept, hidden and not drawn, so the code that still talks to it keeps working.)
// One model: the project's draft keeps the Plan Studio model (draft.studio) and, next to it, one component per Plan Studio object
// (ids "ps:<kind>:<id>") so layers, versions, exports and simulations keep working. Imported meshes and the site stay ordinary components.
// The earlier Workspace is kept unchanged as an archive (pages/workspace.js, #/workspace-archive). Same project data (store.js), same import code (viewport.js).
import * as S from '../store.js';
import {mountWorkbenchShell} from '../workbench-shell.js?v=center-building-20261027-1';
import { LAYER_COLORS,SIMS } from '../data.js';
import { $, $$, esc, when, toast, currentProject, setCurrent, setCurrentVersion } from '../app.js';
import { importModel } from '../viewport.js';
import { createViewport2,levelsOf } from '../viewport2.js';
import { FORMATS, make as makeExport } from '../export3d.js';
import { MODELS, GROUPS } from '../../../furniture/models.js?v=furniture-detail-20261027-1';   // Plan Studio's parametric furniture: the same ids Plan Studio places
import { TOOL_ICONS } from '../tool-icons.js?v=library-icons-20261027-1';
import { toStudio } from '../studio-convert.js';

// as in the archived Workspace
const TYPES = ['wall', 'slab', 'roof', 'window', 'room', 'mass', 'terrain', 'furniture', 'imported'];
const MATS = ['Concrete', 'Plaster', 'Gypsum', 'Glass', 'Timber', 'Carpet', 'Acoustic panel', 'Grass', 'Context', 'Imported'];

// Tool lists, names exactly as in Plan Studio (emb/modeler.html). Each one starts Plan Studio's own tool in the Plan pane.
const I = (d) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const TOOLS = {
  mass: { label: 'Massing', icon: I('<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>'), sections: [
    ['Massing', ['Mass outline', 'Rectangle mass']], ['Surroundings', ['Neighbour building']]] },
  draw: { label: 'Draw room', icon: I('<rect x="4" y="4" width="16" height="16"/><path d="M4 12h7v8"/>'), sections: [
    ['Draw rooms', ['Straight wall', 'Rectangle room', 'Arc wall', 'Floor']],
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
// what each tile starts in Plan Studio (its own tool keys, door models and stair models)
const TMAP = { 'Mass outline': { tool: 'mass' }, 'Rectangle mass': { tool: 'massrect' }, 'Neighbour building': { tool: 'ctxadd' }, 'Straight wall': { tool: 'wall', key: 'W' }, 'Rectangle room': { tool: 'room', key: 'R' }, 'Arc wall': { tool: 'arc', key: 'H' }, Floor: { tool: 'floor', key: 'F' }, Fence: { tool: 'fence' },
  'Straight stair': { stair: 'straight' }, 'L-shaped stair': { stair: 'lshape' }, 'U-shaped stair': { stair: 'ushape' }, 'Spiral stair': { stair: 'spiral' }, 'Accessible ramp': { stair: 'ramp' }, 'Floor opening': { tool: 'void', key: 'O' },
  'Exterior door': { tool: 'door', opm: 'ext' }, 'Interior door': { tool: 'door', opm: 'int', key: 'D' }, 'Exit door': { tool: 'door', opm: 'exit' }, 'Accessible door': { tool: 'door', opm: 'acc' },
  Window: { tool: 'win', opm: 'win', key: 'N' }, 'Wall opening': { tool: 'hole', key: 'E' } };
const ON_WALL = new Set(['door', 'win', 'hole']);
const FURN_BY_NAME = new Map(MODELS.map((m) => [m.en, m]));

// Plan Studio objects ↔ Workspace layers. A Workspace layer's eye and lock act on these Plan Studio layers in every pane.
const KLAYER = { imp: 'Imported', mass: 'Masses', wall: 'Walls', fence: 'Walls', op: 'Glazing', floor: 'Structure', void: 'Structure', stair: 'Structure', furn: 'Furniture', room: 'Rooms', light: 'Lighting', ceil: 'Lighting', roof: 'Roof' };
const LMAP = { Walls: ['parts.walls'], Glazing: ['parts.openings'], Structure: ['parts.floors'], Furniture: ['soft', 'custom'], Rooms: ['roomNames', 'roomArea'], Lighting: ['lighting', 'lighting.fix', 'ceiling', 'ceiling.lights', 'ceiling.panels', 'ceiling.vents'], Site: ['ref.site'], Masses: ['mass'] };
const KTYPE = { imp: 'imported', mass: 'mass', wall: 'wall', fence: 'wall', floor: 'slab', void: 'slab', stair: 'slab', furn: 'furniture', room: 'room', light: 'furniture', ceil: 'furniture', roof: 'roof' };
const KMAT = { imp: 'Imported', mass: 'Concrete', wall: 'Plaster', fence: 'Timber', floor: 'Concrete', void: 'Concrete', stair: 'Concrete', furn: 'Timber', light: 'Imported', ceil: 'Gypsum', roof: 'Concrete' };
const PS = /^ps:([a-z]+):(.*)$/;
const psId = (s) => `ps:${s.k === 'end' ? 'wall' : s.k}:${s.id}`;
const psSel = (id) => { const m = PS.exec(id || ''); return m ? { k: m[1], id: m[2] } : null; };

const GEAR = I('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>');
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
// a box as triangles, local to its corner (x, y, z up), for the earlier Workspace's boxes
function boxMesh(w, d, h) { const P = [[0, 0, 0], [w, 0, 0], [w, d, 0], [0, d, 0], [0, 0, h], [w, 0, h], [w, d, h], [0, d, h]], F = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  return F.flatMap((t) => t.flatMap((i) => P[i].map((v) => +v.toFixed(3)))); }
function classify(c) { const k = CLASSES.find(([re]) => re.test(c.name)); if (k) Object.assign(c, { type: k[1], layer: k[2], mat: k[3] }); return c; }

const UKEY = 'pc-mvp-ws2';
const DEF_UI = { panel: 'project', snap: { End: true, Near: true, Mid: true, Cen: false }, gumball: true, clearance: false, sels: [], selProject: null, open: [], split: [1, 1, 1], disp: 'shaded', view: 'plan', tabs: ['layers', 'versions', 'explode', 'walk', 'elev'], tab: 'layers', acc: {}, pacc: 'project' };
function readUI() {
  try { const u = JSON.parse(localStorage.getItem(UKEY) || 'null'); if (!u) return { ...DEF_UI };
    if (!u.sels) u.sels = u.sel ? [u.sel] : []; if (!u.ws3) { u.gumball = true; u.ws3 = 1; }   // the gumball works now: on once, then as the person leaves it
    const s = Array.isArray(u.split) && u.split.length === 3 && u.split.every((x) => x > 0.05) ? u.split : DEF_UI.split;
    return { ...DEF_UI, ...u, split: s, snap: { ...DEF_UI.snap, ...(u.snap || {}) } }; } catch (e) { return { ...DEF_UI }; }
}

// a draft made before the panes (Workspace boxes) becomes a Plan Studio model once; imported meshes and the site stay as they are
function ensureStudio(p) {
  const d = p.draft; if (d.studio && d.studio.v === 2 && Array.isArray(d.studio.walls)) return false;
  const src = { ...d, layers: d.layers.map((l) => ({ ...l, visible: true })), components: d.components.filter((c) => !c.mesh && !PS.test(c.id)) };
  d.studio = toStudio(src, S.siteOf(p), { name: p.name, id: 'ws-' + p.id });
  const CONV = new Set(['wall', 'window', 'slab', 'room', 'furniture', 'roof']);   // Plan Studio makes its own roof over the top level
  d.components = d.components.filter((c) => c.mesh || !CONV.has(c.type));
  return true;
}

export function render(app, [pid]) {
  const p = (pid && S.project(pid)) || currentProject();
  if (!p) { app.innerHTML = '<div class="wrap"><p>No project yet. <a href="#/">Create one on Home.</a></p></div>'; return; }
  setCurrent(p);
  const converted = ensureStudio(p);
  if (!p.draft.layers.find((l) => l.name === 'Masses')) {   // massing (2026-10-25): every project has the layer; a saved draft stays saved
    const lv = p.versions.at(-1), clean = lv && JSON.stringify(lv.model) === JSON.stringify(p.draft), add = (m) => m.layers.splice(Math.max(0, m.layers.findIndex((l) => l.name === 'Site') + 1), 0, { name: 'Masses', color: LAYER_COLORS.Masses, visible: true, locked: false });
    add(p.draft); if (clean) add(lv.model); }
  // one model (2026-10-25): imported meshes move into Plan Studio's model (studio.imports, what can be moved) with their triangles beside it
  // (draft.meshes, kept out of undo and the sync between panes); a saved draft stays saved
  // (the earlier Workspace's boxes, such as the sample's ground and neighbouring blocks, come along as box meshes)
  { const own = (c) => !PS.test(c.id) && c.g && (c.mesh || ['mass', 'terrain', 'imported'].includes(c.type));
    const toImp = (m) => { const ims = (m.components || []).filter(own); if (!ims.length || !m.studio) return false; m.meshes = m.meshes || {};
      m.studio.imports = (m.studio.imports || []).concat(ims.map((c) => { const mesh = c.mesh || boxMesh(c.g.w, c.g.d, c.g.h); m.meshes[c.id] = mesh; return { id: c.id, name: c.name, layer: c.layer || 'Imported', type: c.type || 'imported', mat: c.mat || 'Imported', tris: Math.round(mesh.length / 9), g: { ...c.g } }; }));
      m.components = m.components.filter((c) => !own(c)); return true; };
    const lv = p.versions.at(-1), clean = lv && JSON.stringify(lv.model) === JSON.stringify(p.draft); if (toImp(p.draft) && clean) toImp(lv.model);
    if (p.draft.meshes && p.draft.studio) { const keep = new Set((p.draft.studio.imports || []).map((o) => o.ref || o.id)); for (const k of Object.keys(p.draft.meshes)) if (!keep.has(k)) delete p.draft.meshes[k]; } }
  const M = () => p.draft, comp = (id) => M().components.find((c) => c.id === id);
  const layerOf = (c) => M().layers.find((l) => l.name === c?.layer);
  const last = () => p.versions.at(-1), dirty = () => !last() || JSON.stringify(last().model) !== JSON.stringify(p.draft);
  const UI = readUI(); const saveUI = () => { try { localStorage.setItem(UKEY, JSON.stringify(UI)); } catch (e) { } };
  const open = new Set((UI.open || []).slice(-1));   // one layer open at a time, so the list fits without scrolling
  const openOnly = (n) => { open.clear(); if (n) open.add(n); UI.open = [...open]; };
  let showParams = false, OBJ = [], HIDDEN = new Set(), MESH = new Map(), CLR = [], SNAP = JSON.stringify(p.draft.studio), dead = false;
  const primary = () => UI.sels.at(-1) || null, isSel = (id) => UI.sels.includes(id);

  // ---- the one selection (a list; the last one picked is the primary); every region subscribes to it
  const subs = [];
  const selectable = (id) => { const c = comp(id), l = layerOf(c); return !!(c && l && !l.locked && l.visible !== false); };
  function setSel(ids, { params = true, from = null } = {}) {
    ids = [...new Set((Array.isArray(ids) ? ids : [ids]).filter((id) => id && selectable(id)))];
    UI.sels = ids; UI.selProject = p.id; if (ids.length) openOnly(comp(ids.at(-1)).layer); saveUI();
    showParams = ids.length > 0 && params;
    const s = ids.length === 1 ? psSel(ids[0]) : null;   // Plan Studio selects one object: the panes follow a single Plan Studio pick
    for (const [r, I2] of Object.entries(INST)) if (I2.ready) { if (r !== from) I2.ws.select(s); I2.ws.selectMany?.(ids.map(psSel).filter(Boolean)); }
    for (const f of subs) f(ids);
  }
  // Rhino: Shift adds, Ctrl (or Cmd) removes, plain click or box replaces
  function pick(id, { add, remove } = {}) {
    if (remove) return setSel(UI.sels.filter((x) => x !== id));
    if (add) return id ? setSel(isSel(id) ? UI.sels : [...UI.sels, id]) : undefined;
    setSel(id ? [id] : []);
  }
  function boxPick(ids, { add, remove }) { if (remove) setSel(UI.sels.filter((x) => !ids.includes(x))); else if (add) setSel([...UI.sels, ...ids]); else setSel(ids); }

  const fsrc = (role) => `../emb/modeler.html?ws=${role}&v=furniture-detail-20261027-1`;
  app.innerHTML = `<div class="w2 w3">
  <nav class="w2-rail" aria-label="Tools">
    ${Object.entries(TOOLS).map(([k, t]) => `<button type="button" data-panel="${k}" title="${t.label}" aria-label="${t.label}">${t.icon}</button>`).join('')}
    <span class="sp"></span>
    <button type="button" data-panel="project" title="Project" aria-label="Project">${PROJECT_ICON}</button>
  </nav>
  <aside class="w2-panel" id="panel" aria-label="Panel">
    <div id="panelBody"></div>
    <div class="w3-props" id="propsWrap" data-off="true"><div class="pane w3-ph2"><h2>Parameters <button class="btn sm" id="pDone">Done</button></h2><p class="note" id="pWhat"></p></div>
      <iframe id="fProps" title="Parameters of the selection (Plan Studio)" src="${fsrc('props')}"></iframe></div>
  </aside>
  <section class="stage w2-stage w3-stage" aria-label="Model view">
    <div class="w3-pane" data-pane="plan"><iframe id="fPlan" title="Plan (Plan Studio 2D)" src="${fsrc('plan')}"></iframe></div>
    <div class="w3-pane" data-pane="persp"><iframe id="fPersp" title="Perspective (Plan Studio 3D)" src="${fsrc('persp')}"></iframe></div>
    <div class="w3-pane" data-pane="shaded"><div class="w3-body"><div class="vp" id="vp"></div><div class="hint" id="hint"></div></div></div>
    <div class="w2-cap" id="cap">
      <div style="display:flex;align-items:center"><button type="button" id="levelBtn" aria-haspopup="menu" aria-expanded="false" disabled>Level ▾</button><button type="button" id="addLevel" title="Add level above" aria-label="Add level above" disabled>+</button><button type="button" id="removeLevel" title="Delete current level" aria-label="Delete current level" disabled>−</button><div class="w2-menu" id="levelMenu" role="menu" aria-label="Levels" hidden></div></div>
      <span class="w2-sep" aria-hidden="true"></span>
      <div><button type="button" id="vBtn" aria-haspopup="true" aria-expanded="false"></button><div class="w2-menu" id="vMenu" role="menu" hidden></div></div>
      <span class="w2-sep" aria-hidden="true"></span>
      <div><button type="button" id="dBtn" aria-haspopup="true" aria-expanded="false"></button><div class="w2-menu" id="dMenu" role="menu" hidden></div></div>
    </div>
    <div class="w2-tr"><button class="btn accent sm" id="sendSim">Send to Simulation</button><button class="btn sm" id="editSite">Edit site</button><button class="btn sm" id="fit">Fit</button></div>
  </section>
  <aside class="w2-right" aria-label="Panels">
    <div class="w3-tabs"><div class="w3-tlist" role="tablist" id="tabList" aria-label="Panels"></div>
      <div class="w3-gearw"><button type="button" class="w3-gear" id="tabGear" title="Choose which panels show here" aria-label="Choose panels" aria-haspopup="true" aria-expanded="false">${GEAR}</button><div class="w2-menu w3-tabmenu" id="tabMenu" hidden></div></div></div>
    <div class="w3-tbody">
      <section class="pane w3-tp" data-tab="layers" role="tabpanel"><h2>Layers <button class="btn sm" id="addLayer">+ Layer</button></h2>
        <div class="w2-lhead" aria-hidden="true"><span></span><span>Layer</span><span>#</span><span>Show</span><span>Lock</span></div>
        <div id="layers" class="w3-fit"></div></section>
      <section class="pane w3-tp" data-tab="versions" role="tabpanel"><h2>Versions</h2>
        <p id="dirty" class="dirty"></p>
        <label class="f">Describe this version<input id="note" placeholder="e.g. Larger south windows"></label>
        <button class="btn primary" id="saveV">Save version</button>
        <div id="versions" class="w3-fit"></div>
        <a class="btn accent" id="toSim" href="#/simulations">Choose a simulation</a><p class="note">Simulations run on a saved version, so each result stays linked to the exact model it came from.</p></section>
      <section class="pane w3-tp" data-tab="explode" role="tabpanel"><h2>Explode</h2>
        <p class="note">Pulls the storeys apart in the Perspective view, so each level reads on its own.</p>
        <p class="w3-stat" id="xStat" role="status"></p><button type="button" class="btn primary" id="xGo"></button>
        <label class="f"><span class="w3-lrow">Spacing between storeys <output id="xSpv">1500 mm</output></span><input type="range" id="xSp" min="0" max="5000" step="50" value="1500"></label>
        <label class="w3-ck"><input type="checkbox" id="xLb" checked> Storey labels</label>
        <div class="grid g2"><button type="button" class="btn sm" id="xRs">Reset spacing</button><span></span><button type="button" class="btn sm" id="xPngB">Save PNG 1920</button><button type="button" class="btn sm" id="xSvgB">Save SVG</button></div>
        <p class="note">Display only: selecting, moving and deleting are off while the storeys are apart.</p></section>
      <section class="pane w3-tp" data-tab="walk" role="tabpanel"><h2>Walkthrough</h2>
        <p class="note">Walk through the model at eye height, 1600 mm, in the Perspective view.</p>
        <p class="w3-stat" id="wStat" role="status"></p><div class="w3-btns" id="wBtns"></div>
        <ul class="w3-keys"><li><b>W A S D</b> or arrows: move</li><li><b>Drag</b>: look around</li><li><b>Shift</b>: walk faster</li><li><b>Esc</b>: back to the bird view</li></ul>
        <p class="note">Walls and windows stop you; doors let you through; you can walk through furniture.</p></section>
      <section class="pane w3-tp" data-tab="elev" role="tabpanel"><h2>Interior elevation</h2>
        <p class="note">Looks straight at one wall from inside the room: its doors and windows, the furniture against it and the lights. View only.</p>
        <p class="w3-stat" id="eStat" role="status"></p><div class="w3-btns" id="eBtns"></div>
        <label class="w3-ck"><input type="checkbox" id="eLb" checked> Labels</label></section>
    </div>
    <div class="pane w3-selp" id="selp"></div>
  </aside>
  <footer class="w2-status" aria-label="Status bar">
    ${Object.keys(DEF_UI.snap).map((k) => `<label title="${{ End: 'Wall ends', Near: 'Wall bodies and faces', Mid: 'Wall midpoints', Cen: 'Centres: arc walls, furniture, rooms' }[k]} — for drawing in Plan and for the gumball in Perspective"><input type="checkbox" data-snap="${k}" ${UI.snap[k] ? 'checked' : ''}> ${k}</label>`).join('')}
    <span class="w2-div" aria-hidden="true"></span>
    <button type="button" class="w2-sw" role="switch" data-sw="gumball" aria-checked="${UI.gumball}" title="Move or rotate the selected object in Perspective. Hosted objects keep their constraints.">Gumball</button>
    <button type="button" class="w2-sw" role="switch" data-sw="clearance" aria-checked="${UI.clearance}" title="Show the free space each piece wants round it (front, back and sides), from its own size and clearances. A hint only: walls block the piece, not its clearance.">Clearance</button>
    <span class="sp"></span><span class="w2-state" id="state"></span>
  </footer></div>`;

  // ---- the panes: Plan Studio instances that call window.__wsHub; they are told the model, layers, locks, snaps and selection
  const propertyPanel=document.createElement('section');propertyPanel.className='pane w3-tp wb-properties';propertyPanel.dataset.tab='properties';propertyPanel.setAttribute('role','tabpanel');
  propertyPanel.innerHTML='<div id="propertyBody"><h2>Properties</h2><p class="note">Select an object in the viewport or Layers to inspect its properties.</p></div>';
  propertyPanel.append($('#propsWrap',app));$('.w3-tbody',app).prepend(propertyPanel);
  const INST = { plan: { el: $('#fPlan', app) }, persp: { el: $('#fPersp', app) }, props: { el: $('#fProps', app) } };
  const ready = () => Object.values(INST).filter((x) => x.ready);
  const activePane = () => INST[UI.view === 'persp' ? 'persp' : 'plan'];
  const any = () => INST.plan.ready ? INST.plan.ws : INST.persp.ready ? INST.persp.ws : INST.props.ready ? INST.props.ws : null;
  const layerVis = () => { const map = { parts: true, ref: true }; for (const [L, ids] of Object.entries(LMAP)) { const l = M().layers.find((x) => x.name === L), on = l ? l.visible !== false : true; for (const id of ids) map[id] = on; } return map; };
  const lockList = () => M().layers.filter((l) => l.locked).map((l) => l.name);
  const offLayers = () => M().layers.filter((l) => l.visible === false).map((l) => l.name);
  function tell(I2) { const w = I2.ws; if (w.importMeshes) { w.importMeshes(M().meshes || {}); w.impOff(offLayers()); } w.layers(layerVis()); w.setLocks(lockList()); w.snaps(UI.snap); w.clearance(UI.clearance); w.gumball(UI.gumball); w.display(UI.disp);
    const s = UI.sels.length === 1 ? psSel(UI.sels[0]) : null; w.select(s);w.selectMany?.(UI.sels.map(psSel).filter(Boolean)); }
  const hub = {
    ready(role, win) {
      if (dead || !INST[role]) return; const I2 = INST[role]; I2.win = win; I2.ws = win.__ws; I2.ready = true;
      const back = I2.ws.load(SNAP); if (role === 'plan' && back !== SNAP) hub.change('plan', back, false);   // Plan Studio tidies a model it opens: that is the one model from now on
      tell(I2); if (role === 'plan' || !OBJ.length) derive(false);
      paneUI(); if (role === 'plan') { levelUI(); if (converted) toast('This project now uses Plan Studio’s model in every view. Imported meshes and the site are kept as they were.'); }
    },
    change(role, snap, live) {
      if (dead || (snap === SNAP && live)) return; SNAP = snap;   // the same model again, not live: a drag was let go, so it is kept now
      for (const [r, I2] of Object.entries(INST)) if (r !== role && I2.ready) I2.ws.apply(snap, live);
      // A newly added level must exist in each model before its selection is forwarded.
      if (!live && INST[role]?.ready) { const lv = INST[role].ws.state().lv; for (const [r, I2] of Object.entries(INST)) if (r !== role && I2.ready) I2.ws.level(lv); }
      for (const I2 of ready()) I2.ws.histUI();
      if (!live) { p.draft.studio = JSON.parse(snap); levelUI(); }
      derive(live);
    },
    say(role, t) { if (INST.plan.ready) INST.plan.ws.flash(t); if (role === 'props') toast(t); },
    pushUndo(before) { if (INST.plan.ready) INST.plan.ws.pushUndo(before); },
    undo() { if (INST.plan.ready) INST.plan.ws.undo(); }, redo() { if (INST.plan.ready) INST.plan.ws.redo(); },
    hist() { return INST.plan.ready ? INST.plan.ws.hist() : { u: 0, r: 0 }; },
    command(action){if(action==='delete'&&UI.sels.length)delIds([...UI.sels]);else if(action==='selectAll')activePane().ws.selectAll?.();},
    box(role, items, mods) { boxPick(items.map(psId), mods); },
    select(role, s, mods = {}) { if (mods.add || mods.remove) { pick(s ? psId(s) : null, mods); return; } if (dead) return; const id = s ? psId(s) : null;
      if (!id) { if (UI.sels.some((x) => PS.test(x))) setSel([], { from: role }); return; }   // empty space in a pane clears a Plan Studio pick; an imported mesh picked in Shaded stays
      if (UI.sels.length === 1 && UI.sels[0] === id) return;
      if (comp(id)) setSel([id], { from: role }); else pendSel = { id, role }; },   // just made (placed, drawn): selected once it is listed
    level(role, lv) { if (dead) return; for (const [r, I2] of Object.entries(INST)) if (r !== role && I2.ready) I2.ws.level(lv); levelUI(); },
  };
  window.__wsHub = hub;

  // ---- derived components and the Shaded pane: one component per Plan Studio object (with its meshes in this page only)
  let dT = 0, dRun = false, dAgain = null, dLive = true, pendSel = null;
  function derive(live) {
    if (dRun) { dAgain = dAgain === null ? live : dAgain && live; return; }
    if (dT) { dLive = dLive && live; return; } dLive = live;
    dT = requestAnimationFrame(async () => { dT = 0; const lv = dLive; dRun = true; try { await deriveNow(lv); } catch (e) { console.warn(e); } dRun = false; if (dAgain !== null) { const a = dAgain; dAgain = null; derive(a); } });
  }
  async function deriveNow(live) {
    const src = INST.persp.ready ? INST.persp.ws : any(); if (!src || dead) return;
    const ms = await src.meshes(), objs = src.objects(), lvl = src.levels().list; if (dead) return;
    OBJ = objs; HIDDEN = new Set(src.hidden()); CLR = src.clearances();
    const lvZ = new Map(lvl.map((l) => [l.id, l])), by = new Map(ms.map((m) => [m.k + ':' + m.id, m])), out = [];
    MESH = new Map();
    const put = (id, base, m) => {   // a component from a Plan Studio object; its geometry (local to g) is kept here for the Shaded pane, never saved
      let g = base.g;
      if (m && m.pos.length) { let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity; const P = m.pos;
        for (let i = 0; i < P.length; i += 3) { const x = P[i], y = P[i + 1], z = P[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
        g = { x: +x0.toFixed(3), y: +y0.toFixed(3), z: +z0.toFixed(3), w: +Math.max(0.01, x1 - x0).toFixed(3), d: +Math.max(0.01, y1 - y0).toFixed(3), h: +Math.max(0.01, z1 - z0).toFixed(3) };
        const loc = new Float32Array(P.length); for (let i = 0; i < P.length; i += 3) { loc[i] = P[i] - g.x; loc[i + 1] = P[i + 1] - g.y; loc[i + 2] = P[i + 2] - g.z; }
        let h = P.length; for (let i = 0; i < P.length; i += 97) h = (h * 31 + Math.round(P[i] * 1000)) | 0;
        MESH.set(id, { mesh: loc, meshCol: m.col, glass: m.glass, sig: h + ':' + P.length }); }
      if (!g) return; out.push({ ...base, id, g, ps: 1 }); };
    for (const o of objs) {
      const L = lvZ.get(o.lv), k = o.k === 'furn' && o.stair ? 'stair' : o.k, m = by.get(o.k + ':' + o.id); by.delete(o.k + ':' + o.id);
      const base = { name: o.name, type: o.k === 'op' ? (o.kind === 'door' ? 'door' : 'window') : KTYPE[k] || 'furniture', layer: o.layer || KLAYER[k] || 'Imported', mat: o.mat || (o.k === 'op' ? (o.kind === 'door' ? 'Timber' : 'Glass') : KMAT[k] || 'Imported') };
      if (o.k === 'room') { base.g = { x: +o.bb[0].toFixed(3), y: +o.bb[1].toFixed(3), z: +(o.z0 ?? (L ? L.z : 0)).toFixed(3), w: +(o.bb[2] - o.bb[0]).toFixed(3), d: +(o.bb[3] - o.bb[1]).toFixed(3), h: +(o.h || (L ? L.h : 2.7)).toFixed(3) }; base.room = { floor: 'Timber', ceiling: 'Gypsum' }; put(psId(o), base, null); continue; }
      put(psId(o), base, HIDDEN.has(o.id) ? null : m);
      if (!out.find((c) => c.id === psId(o)) && L) out.push({ ...base, id: psId(o), ps: 1, g: { x: 0, y: 0, z: L.z, w: 0.01, d: 0.01, h: 0.01 } });   // hidden: listed, not drawn
    }
    for (const [key, m] of by) { if (!m.pos.length) continue; const k = m.id === 'roof' ? 'roof' : m.id === 'stair' ? 'stair' : 'misc';   // Plan Studio parts with no object of their own (the roof, stair flights)
      put(`ps:${k}:${m.id}`, { name: m.id === 'roof' ? 'Roof' : m.id === 'stair' ? 'Stairs' : key, type: KTYPE[k] || 'imported', layer: KLAYER[k] || 'Structure', mat: KMAT[k] || 'Concrete' }, m); }
    const native = M().components.filter((c) => !PS.test(c.id));
    M().components = [...native, ...out];
    for (const c of out) if (!M().layers.find((l) => l.name === c.layer)) M().layers.push({ name: c.layer, color: LAYER_COLORS[c.layer] || '#cfcac0', visible: true, locked: false });
    if (UI.sels.some((id) => !comp(id))) { UI.sels = UI.sels.filter((id) => comp(id)); saveUI(); }
    drawShaded(!vpFitted); vpFitted = true;
    if (pendSel && comp(pendSel.id)) { const q = pendSel; pendSel = null; setSel([q.id], { from: q.role }); }
    if (!live) { S.save(); state(); layers(); selPane(); toolUI(); rail(); }
  }
  // the Shaded pane draws the project's components; Plan Studio's ones with the meshes made above
  let vpFitted = false;
  const renderModel = () => ({ ...M(), components: M().components.map((c) => { const m = MESH.get(c.id); return m ? { ...c, ...m } : PS.test(c.id) ? null : c; }).filter(Boolean) });
  function drawShaded(refit) { if (UI.view !== 'shaded') return; vp.setModel(renderModel(), { refit }); vp.select(UI.sels); clearance(); }   // no longer shown (see the top)

  let tabInfo = null;
  const vp = createViewport2($('#vp', app), { onPick: pick, onBox: boxPick, onHover: (h) => { tabInfo = h; hint(); } });
  vp.setDisplay('shaded'); vp.setView({ kind: 'persp' });
  const clearance = () => { const vis = M().layers.find((l) => l.name === 'Furniture')?.visible !== false; vp.setClearance(UI.clearance && vis ? CLR.filter((r) => !HIDDEN.has(r.id)).map((r) => ({ id: r.id, z: r.z, pts: r.pts })) : []); };
  const persist = () => { S.save(); state(); };
  const SELHELP = 'Click to select · drag a box: left→right inside, right→left touching · Shift adds, Ctrl removes · Tab cycles what is under the cursor';
  function hint() { const h = $('#hint', app); h.title = SELHELP; h.textContent = tabInfo ? `${tabInfo.name} — ${tabInfo.index + 1} of ${tabInfo.count} under the cursor${tabInfo.count > 1 ? ' · Tab for the next one' : ''} · click to select` : 'View only · right-drag orbits · Shift+right-drag pans · scroll zooms · click or box to select'; }
  $('#addLevel', app).onclick = () => { const pane = activePane(); if (!pane.ready) return; pane.ws.addLevel('above'); pane.el.focus(); };
  $('#removeLevel',app).onclick=()=>{const pane=activePane();if(!pane.ready)return;pane.ws.removeLevel();setSel([], {params:false});menus();pane.el.focus();};
  $('#fit', app).onclick = () => { if (UI.view === 'shaded') vp.fit(); else if (UI.view === 'plan' && INST.plan.ready) INST.plan.win.document.getElementById('fitBtn')?.click(); else if (INST.persp.ready) INST.persp.win.document.getElementById('fitBtn')?.click(); };
  hint();

  // ---- one view, chosen at the top left (as before): Plan (Plan Studio 2D) per level, its ceiling plan and interior
  // elevation; Perspective (Plan Studio 3D) with Walkthrough and Explode, which also draws the imports and the site.
  // The three stay loaded on top of each other, so switching is instant and every edit reaches all of them.
  const DISPLAYS = [['shaded', 'Shaded'], ['ghosted', 'Ghosted'], ['wire', 'Wireframe']];
  if (UI.view === 'shaded') UI.view = 'persp';   // the Shaded view is gone (2026-10-25): Perspective draws the imports and the site
  if (!['plan', 'persp'].includes(UI.view)) UI.view = 'plan';
  function showView(v) { const previous = activePane(), st = previous.ready ? previous.ws.state() : null; UI.view = v; const next = activePane(); if (st && next.ready && next !== previous) { if (st.importSpec) next.ws.placeImport(st.importSpec); else next.ws.tool(st.light ? { light: st.light } : (st.tool === 'place' || st.tool === 'fence') && st.pick ? { furn: st.pick } : { tool: st.tool === 'orbit' ? 'select' : st.tool, opm: st.opm }); } toolUI(); saveUI(); $$('.w3-pane', app).forEach((el) => el.classList.toggle('on', el.dataset.pane === v)); if (v === 'shaded') vp.fit(); menus(); }
  function viewName() {
    const st = INST.plan.ready ? INST.plan.ws.state() : null;
    return UI.view === 'plan' ? (st?.view2d === 'ceiling' ? 'Ceiling plan' : 'Plan') : 'Perspective';
  }
  function menus() {
    const L = (INST.plan.ready ? INST.plan.ws : any())?.levels(), a = INST.plan.ready ? INST.plan.ws.state() : null, b = INST.persp.ready ? INST.persp.ws.state() : null;
    const it = (attrs, on, label, small = '') => `<button role="menuitemradio" ${attrs} aria-checked="${on}">${label}${small ? `<small>${small}</small>` : ''}</button>`;
    $('#vBtn', app).textContent = viewName() + ' ▾';
    const current = L?.list.find(l => l.id === L.lv);
    $('#levelBtn', app).textContent = current ? `Level · ${current.short} ▾` : 'Level ▾';
    $('#levelBtn', app).title = current ? `${current.name} · ${current.z.toFixed(2)} m` : 'Choose level';
    $('#levelBtn', app).disabled = !L;
    $('#levelMenu', app).innerHTML = L ? L.list.slice().reverse().map(l => it(`data-level="${esc(l.id)}"`, l.id === L.lv, `${esc(l.short)} · ${esc(l.name)}`, `${l.z.toFixed(2)} m`)).join('') : '';
    if(L){$('#levelMenu',app).insertAdjacentHTML('beforeend',`<hr><button type="button" role="menuitem" data-level-action="rename">Rename current level…</button><button type="button" role="menuitem" data-level-action="below">Add level below</button><button type="button" role="menuitem" data-level-action="remove" ${L.list.length<2?'disabled title="Keep at least one level"':''}>Delete current level…</button>`);
    $$('[data-level-action]',app).forEach(button=>button.onclick=()=>{closeMenus();const pane=activePane();if(!pane.ready)return;if(button.dataset.levelAction==='rename'){const name=prompt('Level name',current?.name||'');if(name!==null)pane.ws.renameLevel(name);}else if(button.dataset.levelAction==='below')pane.ws.addLevel('below');else pane.ws.removeLevel();menus();});}
    $('#removeLevel',app).disabled=!L||L.list.length<2;
    $('#removeLevel',app).title=L?.list.length<2?'Keep at least one level':'Delete current level';
    $$('#levelMenu [data-level]', app).forEach(x => x.onclick = () => { closeMenus(); setSel([], { params: false }); for (const pane of ready()) pane.ws.level(x.dataset.level); menus(); });
    $('#vMenu', app).innerHTML = it('data-view="plan"', UI.view === 'plan' && a?.view2d !== 'ceiling', 'Plan')
      + it('data-view="ceiling"', UI.view === 'plan' && a?.view2d === 'ceiling', 'Ceiling plan')
      + it('data-view="persp"', UI.view === 'persp', 'Perspective');
    const plan = UI.view === 'plan', cur = UI.view === 'shaded' ? vp.display : (b?.disp || UI.disp);
    $('#dBtn', app).textContent = plan ? 'Plan drawing' : (DISPLAYS.find(([k]) => k === cur) || DISPLAYS[0])[1] + ' ▾'; $('#dBtn', app).disabled = plan;$('#dBtn',app).parentElement.hidden=plan;
    $('#dMenu', app).innerHTML = DISPLAYS.map(([k, n]) => it(`data-disp="${k}"`, cur === k, n)).join('');
    $$('#vMenu [data-view]', app).forEach((x) => x.onclick = async () => { closeMenus(); const v = x.dataset.view;
      if (v === 'plan' || v === 'ceiling' || v === 'elev') { showView('plan'); if (x.dataset.level) for (const I2 of ready()) I2.ws.level(x.dataset.level); if (INST.plan.ready) await INST.plan.ws.view(v === 'ceiling' ? 'ceiling' : v === 'elev' ? 'elev' : 'plan'); }
      else if (v === 'persp' || v === 'walk' || v === 'explode') { showView('persp'); if (INST.persp.ready) { const st = INST.persp.ws.state(); if (v === 'persp') await INST.persp.ws.view('bird'); else if (v === 'walk' && !st.walking && !st.walkpick) await INST.persp.ws.view('walk'); else if (v === 'explode' && !st.explode) await INST.persp.ws.view('explode'); } }
      else showView('shaded');
      menus(); });
    $$('#dMenu [data-disp]', app).forEach((x) => x.onclick = () => { closeMenus(); const d = x.dataset.disp; if (UI.view === 'shaded') vp.setDisplay(d); else { UI.disp = d; saveUI(); if (INST.persp.ready) INST.persp.ws.display(d); } menus(); });
  }
  const closeMenus = () => { for (const [b, m] of [['levelBtn', 'levelMenu'], ['vBtn', 'vMenu'], ['dBtn', 'dMenu']]) { $('#' + m, app).hidden = true; $('#' + b, app).setAttribute('aria-expanded', 'false'); } };
  for (const [b, m] of [['levelBtn', 'levelMenu'], ['vBtn', 'vMenu'], ['dBtn', 'dMenu']]) $('#' + b, app).onclick = (e) => { e.stopPropagation(); const was = !$('#' + m, app).hidden; closeMenus(); if (!was) { menus(); $('#' + m, app).hidden = false; $('#' + b, app).setAttribute('aria-expanded', 'true'); } };
  const outside = (e) => { if (!e.target.closest('#cap')) closeMenus(); if (!e.target.closest('.w3-gearw')) gearMenu(false); }; document.addEventListener('click', outside);
  const away = () => { closeMenus(); gearMenu(false); }; addEventListener('blur', away);   // a click in a view (an iframe) closes the menus too
  // the panes' own buttons (Explode in the toolbar, Esc out of a walkthrough, the level) change the name in the pill too
  const levelUI = () => menus(), paneUI = () => { if (['levelMenu', 'vMenu', 'dMenu'].every(id => $('#' + id, app).hidden)) menus(); tabState(); };
  const paneT = setInterval(paneUI, 700);


  // Continuous lists retain their entries and native scroll position on resize.
  function fit(box, items, key) {
    box.querySelectorAll('.w3-pager').forEach(e=>e.remove());items.forEach(e=>e.classList.remove('w3-pghide'));
  }

  // ---- right: Rhino-style panels. The gear chooses which ones show; Layers always does.
  const PANELS = [['properties','Properties',I('<path d="M5 5h14M5 12h14M5 19h14"/>')],['layers', 'Layers', I('<path d="M12 4l8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 16l8 4 8-4"/>')],
    ['versions', 'Versions', I('<circle cx="6" cy="5.5" r="2"/><circle cx="6" cy="18.5" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7.5v9M18 10c0 4.5-6.5 3.5-10.6 7"/>')],
    ['explode', 'Explode', I('<path d="M4 7l8-3.5L20 7l-8 3.5z"/><path d="M4 17l8-3.5 8 3.5-8 3.5z"/><path d="M12 11.5v1.5" stroke-dasharray="1 1.5"/>')],
    ['walk', 'Walkthrough', I('<circle cx="13" cy="4.5" r="1.8"/><path d="M10.5 21l2-6 3 3v3M8.5 12.5l2.5-5 4 1.2 2 3.8M12.8 8.5l-1.3 5"/>')],
    ['elev', 'Interior elevation', I('<rect x="3" y="4" width="18" height="16"/><path d="M6.5 20v-9h4v9M13.5 9h4.5v5h-4.5z"/>')]];
  let lastMode = null;
  function tabsUI() {
    UI.tabs = PANELS.map(([k])=>k);if(!UI.tabs.includes(UI.tab))UI.tab='layers';
    $('#tabList', app).innerHTML = PANELS.filter(([k]) => ['layers','properties','versions',UI.tab].includes(k)).map(([k, n]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === UI.tab}" title="${n}" aria-label="${n}">${n}</button>`).join('');
    $$('#tabList [data-tab]', app).forEach((b) => b.onclick = () => { UI.tab = b.dataset.tab; saveUI(); tabsUI(); });
    $$('.w3-tp', app).forEach((el) => el.hidden = el.dataset.tab !== UI.tab);
    $('#tabMenu', app).innerHTML = '<p class="w2-mnote">View tools</p>' + PANELS.filter(([k])=>!['layers','properties','versions'].includes(k)).map(([k,n])=>`<button type="button" data-view-panel="${k}">${n}</button>`).join('');
    $$('[data-view-panel]',app).forEach(b=>b.onclick=()=>{UI.tab=b.dataset.viewPanel;saveUI();gearMenu(false);tabsUI();});
    tabState(true);
  }
  const gearMenu = (on) => { $('#tabMenu', app).hidden = !on; $('#tabGear', app).setAttribute('aria-expanded', String(on)); };
  $('#tabGear', app).onclick = (e) => { e.stopPropagation(); gearMenu($('#tabMenu', app).hidden); };
  const doc = (I2) => { try { return I2.ready ? I2.win.document : null; } catch (e) { return null; } };
  const tap = (I2, id) => doc(I2)?.getElementById(id)?.click();
  const BTNS = {};   // a panel's buttons are drawn again only when its state changes, so a click is never lost
  const btns = (id, key, list) => { if (BTNS[id] === key) return; BTNS[id] = key; const host = $('#' + id, app);
    host.innerHTML = list.map(([k, label, cls]) => `<button type="button" class="btn ${cls || ''}" data-act="${k}">${label}</button>`).join('');
    $$('[data-act]', host).forEach((b) => b.onclick = () => ACT[b.dataset.act]()); };
  const persp3 = async (v) => { showView('persp'); if (INST.persp.ready) await INST.persp.ws.view(v); menus(); tabState(true); };
  const ACT = {
    walk: () => persp3('walk'), walkGo: () => { tap(INST.persp, 'wmGo'); setTimeout(() => tabState(true), 300); }, walkX: () => { tap(INST.persp, 'wmX'); tap(INST.persp, 'walkX'); setTimeout(() => tabState(true), 300); },
    elev: async () => { showView('plan'); if (INST.plan.ready) await INST.plan.ws.view('elev'); menus(); setTimeout(() => tabState(true), 100); }, elevRe: () => { tap(INST.plan, 'elvRe'); setTimeout(() => tabState(true), 200); },
    elevX: async () => { const dl = doc(INST.plan)?.getElementById('elvDlg'); if (dl && !dl.hidden) tap(INST.plan, 'wpX'); else if (INST.plan.ready) await INST.plan.ws.view('plan'); menus(); tabState(true); },
  };
  $('#xGo', app).onclick = () => persp3(INST.persp.ready && INST.persp.ws.state().explode ? 'bird' : 'explode');
  $('#xSp', app).oninput = (e) => { const r = doc(INST.persp)?.getElementById('xD'); if (!r) return; r.value = e.target.value; r.dispatchEvent(new Event('input', { bubbles: true })); tabState(true); };
  $('#xLb', app).onchange = (e) => { const c = doc(INST.persp)?.getElementById('xLab'); if (!c) return; c.checked = e.target.checked; c.dispatchEvent(new Event('change', { bubbles: true })); };
  $('#xRs', app).onclick = () => { tap(INST.persp, 'xReset'); tabState(true); };
  $('#xPngB', app).onclick = () => tap(INST.persp, 'xPng'); $('#xSvgB', app).onclick = () => tap(INST.persp, 'xSvg');
  $('#eLb', app).onchange = (e) => { const c = doc(INST.plan)?.getElementById('elvLab'); if (!c) return; c.checked = e.target.checked; c.dispatchEvent(new Event('change', { bubbles: true })); };
  function tabState(force) {
    const a = INST.plan.ready ? INST.plan.ws.state() : null, b = INST.persp.ready ? INST.persp.ws.state() : null, pd = doc(INST.persp), qd = doc(INST.plan);
    if (pd && !pd.getElementById('wsHideX')) { const st = pd.createElement('style'); st.id = 'wsHideX'; st.textContent = '#xPanel{display:none!important}'; pd.head.appendChild(st); }   // its controls are the Explode panel now
    // started somewhere else (the 3D toolbar's Explode, the Plan's own menu): its panel comes to the front
    const dlg = qd?.getElementById('elvDlg'), ev = qd?.getElementById('elvView'), picking = !!dlg && !dlg.hidden, picked = !!ev && !ev.hidden, eon = picking || picked;   // Plan Studio: a wall-picker box, then the elevation
    const mode = b?.explode ? 'explode' : b?.walking || b?.walkpick ? 'walk' : eon ? 'elev' : null;
    if (mode !== lastMode) { lastMode = mode; if (mode && UI.tabs.includes(mode) && UI.tab !== mode) { UI.tab = mode; saveUI(); return tabsUI(); } }
    if (['layers','properties','versions'].includes(UI.tab)) return;
    const xon = !!b?.explode;
    $('#xStat', app).textContent = !b ? 'The Perspective view is still starting.' : xon ? 'Exploded: the storeys are apart in Perspective.' : 'Off.';
    $('#xGo', app).textContent = xon ? 'Put the storeys back' : 'Explode the storeys'; $('#xGo', app).disabled = !b;
    for (const id of ['xSp', 'xLb', 'xRs', 'xPngB', 'xSvgB']) $('#' + id, app).disabled = !xon;
    const xd = pd?.getElementById('xD'); if (xd && document.activeElement !== $('#xSp', app)) $('#xSp', app).value = xd.value;
    if (pd?.getElementById('xDv')) $('#xSpv', app).textContent = pd.getElementById('xDv').textContent; if (pd?.getElementById('xLab')) $('#xLb', app).checked = pd.getElementById('xLab').checked;
    const w = b?.walking ? 'on' : b?.walkpick ? 'pick' : 'off';
    $('#wStat', app).textContent = !b ? 'The Perspective view is still starting.' : w === 'on' ? 'Walking. Click the view first if the keys do nothing.' : w === 'pick' ? 'Where do you start? Drag the figure in the view to move it, drag its arrow to turn it.' : 'Off.';
    btns('wBtns', w + !!b, w === 'on' ? [['walkX', 'Exit walkthrough']] : w === 'pick' ? [['walkGo', 'Start walking', 'primary'], ['walkX', 'Cancel']] : [['walk', 'Choose where to start', 'primary']]);
    $$('#wBtns button', app).forEach((x) => x.disabled = !b);
    $('#eStat', app).textContent = !a ? 'The Plan view is still starting.' : picked ? (qd.getElementById('elvTitle')?.textContent || 'Elevation') : picking ? 'Click a wall in the box over the view, on the side you want to look at.' : 'Off.';
    btns('eBtns', `${picking}${picked}${!!a}`, picked ? [['elevRe', 'Pick another wall'], ['elevX', 'Back to plan']] : picking ? [['elevX', 'Cancel']] : [['elev', 'Pick a wall', 'primary']]);
    $$('#eBtns button', app).forEach((x) => x.disabled = !a); $('#eLb', app).disabled = !picked;
    if (qd?.getElementById('elvLab')) $('#eLb', app).checked = qd.getElementById('elvLab').checked;
  }

  // ---- left: rail + panel (project / tool group / parameters of the selection)
  let LIGHTS = null;
  function rail() { const k = UI.panel; $$('[data-panel]', app).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.panel === k)));
    // the next step, from what the model has (2026-10-25): an empty model starts with Massing; masses and no walls go on to Make floors
    const st = M().studio || {}, walls = (st.walls || []).length, ms = (st.masses || []).length, next = !walls && !ms ? 'mass' : !walls ? 'draw' : null;
    $$('.w2-rail [data-panel]', app).forEach((b) => { const t = TOOLS[b.dataset.panel]; b.classList.toggle('w2-next', b.dataset.panel === next); if (t) b.title = b.dataset.panel === next ? (next === 'mass' ? `${t.label} · start here: draw masses on the site` : `${t.label} · next: select a mass and use Make floors in its panel, or draw rooms`) : t.label; }); }
  $$('[data-panel]', app).forEach((b) => b.onclick = () => { UI.panel = b.dataset.panel; saveUI(); showParams = false; rail(); panel(); });
  const propsOn = (on) => { $('#propsWrap', app).dataset.off = String(!on); $('#propertyBody',app).hidden=on; };
  function panel() {
    const host = $('#panelBody', app); propsOn(false);
    const propertyHost=$('#propertyBody',app);
    if(showParams&&UI.sels.length){UI.tab='properties';tabsUI();}
    if (showParams && UI.sels.length > 1) return multi(propertyHost);
    const c = comp(primary());
    if (showParams && c && PS.test(c.id)) { propsOn(true); $('#pWhat', app).textContent = `${c.name} · ${c.layer}. Plan Studio’s own parameters; changes show in all three panes.`; return; }
    if (showParams && c) return params(propertyHost, c);
    propertyHost.innerHTML='<h2>Properties</h2><p class="note">Select an object in the viewport or Layers to inspect its properties.</p>';
    if (UI.panel === 'project') return projectPanel(host);
    const t0 = TOOLS[UI.panel], mine = UI.panel === 'furniture' ? myFurn() : null;
    const t = mine ? { ...t0, sections: [['My furniture', ['\u0000import', ...mine.map((x) => '\u0000' + x.id)]], ...t0.sections] } : t0;   // your own pieces first (2026-10-25)
    const tile = (n) => { if (n === '\u0000import') return `<button type="button" class="w2-card w3-impf" data-tool="Import furniture" data-impfurn="1" aria-pressed="false" title="Import a piece of furniture (.obj, .glb, .stl, .3dm): it joins My furniture and can be placed like the others"><span class="im"><svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 28v-6a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v6"/><path d="M10 30a3 3 0 0 1 6 0v4h16v-4a3 3 0 0 1 6 0v8H10z"/><path d="M24 4v10M19 9l5 5 5-5"/></svg></span><span>Import furniture</span></button>`;
      if (n[0] === '\u0000') { const x = mine.find((q) => '\u0000' + q.id === n); return `<button type="button" class="w2-card" data-tool="${esc(x.name)}" data-myfurn="${x.id}" aria-pressed="false" title="${esc(x.name)} · ${x.w} × ${x.d} × ${x.h} m: click it, then click in the current view to place it (R turns it)"><span class="im"><img src="${x.thumb || ''}" alt="" loading="lazy"></span><span>${esc(x.name)}<i class="w3-mfx" data-myfx="${x.id}" role="button" tabindex="0" title="Remove ${esc(x.name)} from My furniture" aria-label="Remove ${esc(x.name)} from My furniture">×</i></span></button>`; } if (t.cards) { const m = FURN_BY_NAME.get(n); return `<button type="button" class="w2-card" data-tool="${esc(n)}" data-furn="${m.id}" aria-pressed="false" title="${esc(n)}: click it, then click in the current view to place it"><span class="im"><img src="img/furniture/${m.id}.png?v=furniture-detail-20261027-1" alt="" loading="lazy"></span><span>${esc(n)}</span></button>`; }
      const ic = TOOL_ICONS[n], k = TMAP[n]?.key; return `<button type="button" class="w2-tile" data-tool="${esc(n)}" aria-pressed="false" title="${esc(n)}${k ? ` (${k})` : ''}"><span class="im">${ic?.img ? `<img src="${ic.img}" alt="">` : ic?.svg || ''}</span><span>${esc(n)}${k ? ` <em>(${k})</em>` : ''}</span></button>`; };
    const many = t.sections.length > 1, oi = Math.min(UI.acc[UI.panel] ?? (mine&&!mine.length?1:0), t.sections.length - 1);
    host.innerHTML = `<div class="pane w2-tools"><h2>${t.label}</h2>${t.sections.map(([h, items], i) => `<div class="w2-sec${i === oi ? ' w3-fit' : ''}">${many ? `<button type="button" class="w3-acc" data-acc="${i}" aria-expanded="${i === oi}"><span>${i === oi ? '▾' : '▸'} ${esc(h)}</span><small>${items.length}</small></button>` : `<h3>${esc(h)}</h3>`}${i === oi ? `<div class="w2-grid">${items.map(tile).join('')}</div>` : ''}</div>`).join('')}
      <p class="note" id="toolMsg" role="status" aria-live="polite"></p></div>`;
    host.dataset.library=UI.panel;
    if(t.cards){const controls=document.createElement('div');controls.innerHTML=`<label class="f">Category<select id="furnitureCategory">${t.sections.map(([name],i)=>`<option value="${i}" ${i===oi?'selected':''}>${esc(name)}</option>`).join('')}</select></label><input class="wb-library-search" type="search" id="furnitureSearch" aria-label="Search this category" placeholder="Search this category"><p class="note" id="furnitureMatch" role="status"></p>`;host.querySelector('h2').after(controls);controls.querySelector('select').onchange=e=>{UI.acc.furniture=+e.target.value;saveUI();panel();};controls.querySelector('input').oninput=e=>{const q=e.target.value.trim().toLowerCase(),buttons=$$('[data-tool]',host);let n=0;for(const b of buttons){b.hidden=!b.dataset.tool.toLowerCase().includes(q);if(!b.hidden)n++;}controls.querySelector('#furnitureMatch').textContent=n?n+' items':'No matching furniture in this category.';};}
    $$('[data-tool]', host).forEach((b) => b.onclick = (e) => { const fx = e.target.closest('[data-myfx]'); if (fx) { e.stopPropagation(); return dropMyFurn(fx.dataset.myfx); } startTool(b); });
    $$('[data-tool]', host).forEach(b => b.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('[data-myfx]') || b.dataset.impfurn) return;
      e.preventDefault();
      const x = e.clientX, y = e.clientY; let moved = false;
      b.setPointerCapture(e.pointerId);
      const move = ev => { if (Math.hypot(ev.clientX-x, ev.clientY-y)>5) moved = true; };
      const end = ev => { b.removeEventListener('pointermove', move); b.removeEventListener('pointerup', end); b.removeEventListener('pointercancel', cancel); if (!moved) return;
        const pane = activePane(), r = pane.el.getBoundingClientRect();
        if (!pane.ready || ev.clientX<r.left || ev.clientX>r.right || ev.clientY<r.top || ev.clientY>r.bottom) return;
        b.setAttribute('aria-pressed','false'); startTool(b);
        const w = pane.win, cv = w.document.getElementById('cv'), init = {clientX:ev.clientX-r.left,clientY:ev.clientY-r.top,button:0,bubbles:true,pointerId:1};
        for (const type of ['pointermove','pointerdown','pointerup']) cv.dispatchEvent(new w.PointerEvent(type, init));
        // Pointer capture retargets the generated click to the card; suppress its toggle.
        b.addEventListener('click', ev => { ev.stopImmediatePropagation(); ev.preventDefault(); }, {once:true,capture:true});
      };
      const cancel = () => { b.removeEventListener('pointermove',move); b.removeEventListener('pointerup',end); b.removeEventListener('pointercancel',cancel); };
      b.addEventListener('pointermove',move); b.addEventListener('pointerup',end); b.addEventListener('pointercancel',cancel);
    }));
    if (mine) host.insertAdjacentHTML('beforeend', '<input type="file" id="furnFile" accept=".obj,.glb,.gltf,.stl,.3dm" hidden>');
    const ff = $('#furnFile', host); if (ff) ff.onchange = (e) => { const f = e.target.files[0]; if (f) importFurn(f); e.target.value = ''; };
    $$('[data-acc]', host).forEach((b) => b.onclick = () => { UI.acc[UI.panel] = +b.dataset.acc; saveUI(); panel(); });
    toolUI(); const box = $('.w3-fit', host); if (box) fit(box, $$('[data-tool]', box), 'tools:' + UI.panel + ':' + oi);
  }
  // ---- My furniture (2026-10-25): pieces you import, kept in your account (this browser) for every project, with a picture made by Plan Studio
  // in the same light and view as the library's. One piece = one file, merged into one mesh standing on the floor, front towards −y.
  function myFurn() { const A = S.account(); return A.furniture || (A.furniture = []); }
  function dropMyFurn(id) { const x = myFurn().find((q) => q.id === id); if (!x || !confirm(`Remove ${x.name} from My furniture? Pieces already placed in projects stay.`)) return; S.account().furniture = myFurn().filter((q) => q !== x); S.save(); panel(); }
  async function importFurn(file) { const msg = $('#toolMsg', app); if (msg) msg.textContent = `Reading ${file.name}…`;
    try { if (!INST.plan.ready) throw Error('The Plan pane is still starting. Try again in a moment.');
      const r = await importModel(file, { unit: 1, up: 'auto' }), all = []; for (const c of r.components) for (let i = 0; i < c.mesh.length; i += 3) all.push(c.mesh[i] + c.g.x, c.mesh[i + 1] + c.g.y, c.mesh[i + 2] + c.g.z);
      let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < all.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], all[i + k]); mx[k] = Math.max(mx[k], all[i + k]); }
      // furniture files come in metres, centimetres or millimetres: read by the size (a piece is 0.1–8 m); a .3dm says its own units
      const big = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]), k = /\.3dm$/i.test(file.name) ? 1 : big > 80 ? 0.001 : big > 8 ? 0.01 : 1, unit = k === 0.001 ? 'millimetres' : k === 0.01 ? 'centimetres' : 'metres';
      const mesh = all.map((v, i) => +((v - mn[i % 3]) * k).toFixed(4)), w = +((mx[0] - mn[0]) * k).toFixed(3), d = +((mx[1] - mn[1]) * k).toFixed(3), h = +((mx[2] - mn[2]) * k).toFixed(3);
      if (Math.max(w, d, h) > 12) throw Error(`That is ${Math.max(w, d, h).toFixed(1)} m across: too big for a piece of furniture. Use Project › Import model for buildings and sites.`);
      const thumb = await INST.plan.ws.thumbMesh(mesh), name = (file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'My piece').slice(0, 40);
      const x = { id: S.uid('mf'), name: name[0].toUpperCase() + name.slice(1), w, d, h, tris: Math.round(mesh.length / 9), mesh, thumb, file: file.name, unit, at: new Date().toISOString() };
      myFurn().unshift(x); S.save(); UI.acc.furniture = 0; saveUI(); panel();
      const m2 = $('#toolMsg', app); if (m2) m2.textContent = `${x.name}: ${w} × ${d} × ${h} m (read as ${unit}), ${x.tris.toLocaleString('en')} triangles. Click it, then click in the current view to place it.`; }
    catch (e) { if (msg) msg.textContent = e.message || 'This file could not be read.'; } }
  function startTool(b) {
    const pane = activePane(), w = pane.ready ? pane.ws : null, msg = $('#toolMsg', app), n = b.dataset.tool; if (!w) { if (msg) msg.textContent = 'The view is still starting. Try again in a moment.'; return; }
    const st = w.state(), on = b.getAttribute('aria-pressed') === 'true';
    if (on) { w.tool({ tool: 'select' }); toolUI(); return; }   // a second click puts the tool down
    if (b.dataset.impfurn) { $('#furnFile', app).click(); return; }
    if (b.dataset.myfurn) { const x = myFurn().find((q) => q.id === b.dataset.myfurn); if (!x) return;
      M().meshes = M().meshes || {}; if (!M().meshes[x.id]) { M().meshes[x.id] = x.mesh; for (const I2 of ready()) if (I2.ws.importMeshes) I2.ws.importMeshes(M().meshes); }   // the project keeps the mesh once; every piece placed shares it
      w.placeImport({ ref: x.id, name: x.name, w: x.w, d: x.d, h: x.h, tris: x.tris, layer: 'Furniture' }); pane.el.focus(); try { pane.win.document.getElementById('cv').focus({ preventScroll: true }); } catch (e) { }
      if (msg) msg.textContent = `Click in the current view to place the ${x.name}; R turns it, Esc stops.`; toolUI(); return; }
    let spec = b.dataset.furn ? { furn: b.dataset.furn } : TMAP[n] || null;
    if (!spec && UI.panel === 'light') { const k = (LIGHTS || []).find(([, nm]) => nm === n); spec = k ? { light: k[0] } : null; }
    if (!spec) return; void st;

    for (const other of ready()) if (other !== pane && other !== INST.props) other.ws.tool(spec);
    const okk = w.tool(spec); pane.el.focus(); try { pane.win.document.getElementById('cv').focus({ preventScroll: true }); } catch (e) { }
    if (msg) msg.textContent = !okk ? 'This tool could not start: see the message in the current view pane.' : spec.furn ? `Click in the current view to place the ${n}. Esc to stop.` : ON_WALL.has(spec.tool) ? `Click on a wall in the current view to place the ${n.toLowerCase()}. It cuts its own opening and moves with the wall.` : spec.stair ? `Click in the current view to place the ${n.toLowerCase()}.` : spec.light ? `Click in the current view to place the ${n.toLowerCase()}.` : `${n}: draw in the current view. ${spec.tool === 'wall' ? 'Click corner to corner, double-click to finish.' : ['room','floor','void','massrect'].includes(spec.tool) ? 'Drag a rectangle.' : spec.tool === 'arc' ? 'Click the start, the end, then the bend.' : 'Click the points, double-click to finish.'}`;
    toolUI();
  }
  function toolUI() {   // which tile is on: the active Plan Studio view's tool
    $('#addLevel', app).disabled = !activePane().ready;
    const pane = activePane(), w = pane.ready ? pane.ws : null; if (!w) return; const st = w.state();
    $$('#panelBody [data-tool]', app).forEach((b) => { const n = b.dataset.tool, s = b.dataset.furn ? { furn: b.dataset.furn } : TMAP[n]; let on = false;
      if (b.dataset.myfurn) on = st.impPend === b.dataset.myfurn; else if (b.dataset.furn) on = (st.tool === 'place' || st.tool === 'fence') && st.pick === b.dataset.furn; else if (s?.stair) on = st.tool === 'place' && st.pick === s.stair; else if (s?.tool) on = st.tool === s.tool && (!s.opm || st.opm == null || st.opm === s.opm); else if (UI.panel === 'light') { const k = (LIGHTS || []).find(([, nm]) => nm === n); on = !!k && st.light === k[0]; }
      b.setAttribute('aria-pressed', String(on)); });
  }
  const toolT = setInterval(() => { if (!document.hidden) toolUI(); }, 500);
  $('#pDone', app).onclick = () => { showParams = false; rail(); panel(); };
  function projectPanel(host) {
    host.innerHTML = `<div class="pane w3-accp${UI.pacc === 'project' ? ' on' : ''}"><h2><button type="button" class="w3-acc" data-pacc="project" aria-expanded="${UI.pacc === 'project'}"><span>${UI.pacc === 'project' ? '▾' : '▸'} Project</span></button></h2><div class="w3-accb">
      <select class="inp" id="proj" aria-label="Project">${S.projects().map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <p class="note">Site: ${esc(S.siteOf(p)?.label || '—')}${S.siteOf(p)?.sample ? ' (sample)' : ''} · north ${S.siteOf(p)?.north ?? 0}° · ${p.siteLinked === false ? 'this project\'s own site' : '<a href="#/account">from Account</a>'}</p><p class="note">${p.sample ? 'Sample project with mock results. Edits are kept in this browser.' : 'Stored in this browser.'}</p>
      <p class="note">Plan and Perspective show the one model (Plan Studio’s): walls, masses, the site and imported meshes. Edit here, then run simulations on a saved version.</p></div></div>
    <div class="pane w3-accp${UI.pacc === 'import' ? ' on' : ''}"><h2><button type="button" class="w3-acc" data-pacc="import" aria-expanded="${UI.pacc === 'import'}"><span>${UI.pacc === 'import' ? '▾' : '▸'} Import model</span></button></h2><div class="w3-accb">
      <div class="drop" id="drop"><button class="btn sm" id="pick">Import .obj · .stl · .glb · .3dm</button><div style="margin-top:6px">or drop a file here · read locally</div></div>
      <input type="file" id="file" accept=".obj,.stl,.glb,.gltf,.3dm" hidden>
      <button type="button" class="btn sm" id="importAsNew">Import as new model</button><input type="file" id="newModelFile" accept=".obj,.stl,.glb,.gltf,.3dm" hidden><p class="note">Import as new model starts a separate project without the sample or current geometry.</p>
      <div class="grid g2"><label class="f">Units<select id="unit"><option value="1">Metres</option><option value="0.001">Millimetres</option><option value="0.01">Centimetres</option><option value="0.3048">Feet</option></select></label>
        <label class="f">Up axis<select id="up"><option value="auto">File default</option><option value="z">Z up</option><option value="y">Y up</option></select></label></div>
      <p class="msg note" id="impMsg" role="status"></p>
      ${M().importAudit?`<p class="note">Last Rhino import: ${M().importAudit.meshObjects} placed surface objects · ${Number(M().importAudit.triangles).toLocaleString('en-CA')} triangles · converted to metres. ${M().importAudit.definitionObjects} block-definition objects were excluded from the scene unless placed as instances.</p>`:''}
      <p class="note">Meshes named like walls go to Walls, furniture to Furniture, windows to Glazing, slabs to Structure, roofs to Roof; the rest to Imported. Imported meshes become part of the model: an outline in Plan, the mesh in Perspective; drag one to move it.</p></div></div>
    <div class="pane w3-accp${UI.pacc === 'site' ? ' on' : ''}"><h2><button type="button" class="w3-acc" data-pacc="site" aria-expanded="${UI.pacc === 'site'}"><span>${UI.pacc === 'site' ? '▾' : '▸'} Site</span></button></h2><div class="w3-accb">
      <p class="note">${M().studio?.site ? `${esc((M().studio.site.origin.label || "").split(",")[0] || "Site")}: ${M().studio.site.buildings.filter((b) => !b.excluded).length} buildings, ${(M().studio.site.roads || []).length} roads${M().studio.site.terrain ? `, ground ${M().studio.site.terrain.relief} m` : ""} · ${esc(M().studio.site.sources?.[0]?.attribution || "")}` : "No site yet."}</p><a class="btn sm" id="siteBtn" href="#/new-site?project=${p.id}">${M().studio?.site ? "Choose another site on the map" : "Choose the site on the map"}</a>
      <p class="note">The surroundings are on the Site layer, locked; the eye in Layers shows or hides them. Unlock it to change a building’s height, leave one out or draw a missing neighbour (Massing › Neighbour building). Masses go on the Masses layer.</p>
      <p class="note" id="siteMsg" role="status" aria-live="polite"></p></div></div>
    <div class="pane w3-accp${UI.pacc === 'export' ? ' on' : ''}"><h2><button type="button" class="w3-acc" data-pacc="export" aria-expanded="${UI.pacc === 'export'}"><span>${UI.pacc === 'export' ? '▾' : '▸'} Export</span></button></h2><div class="w3-accb">
      <div class="w2-exp">${FORMATS.map(([k, n, d]) => `<button type="button" class="btn sm" data-exp="${k}" title="${esc(d)}">${esc(n)}</button>`).join('')}</div>
      <p class="note">Exports what is visible, in metres; hidden layers are left out. SketchUp's own .skp can only be written by SketchUp, so use the .dae, which SketchUp opens directly.</p>
      <p class="note" id="expMsg" role="status" aria-live="polite"></p></div></div>`;
    $$('[data-pacc]', host).forEach((b) => b.onclick = () => { UI.pacc = b.dataset.pacc; saveUI(); panel(); });
    $('#proj', host).onchange = (e) => { location.hash = '#/workspace/' + e.target.value; };
    $$('[data-exp]', host).forEach((b) => b.onclick = async () => {
      const k = b.dataset.exp, f = FORMATS.find((x) => x[0] === k), msg = $('#expMsg', host), base = p.name.replace(/\W+/g, '-').replace(/^-|-$/g, '');
      const save = (href, name) => { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
      if (k === 'png') { const w = INST.persp.ready && INST.persp.win; if (!w || !w.S3 || !w.S3.png) { msg.textContent = 'The Perspective view is still opening; try again in a moment.'; return; } save(w.S3.png(), `${base}.png`); msg.textContent = 'Saved the Perspective view as PNG.'; return; }
      msg.textContent = `Writing ${f[1]}…`; b.disabled = true;
      try { const blob = await makeExport(k, renderModel(), p.name), url = URL.createObjectURL(blob); save(url, `${base}.${k}`); setTimeout(() => URL.revokeObjectURL(url), 4000);
        msg.textContent = `Saved ${base}.${k} (${(blob.size / 1024).toFixed(0)} KB).`; }
      catch (e) { msg.textContent = e.message || 'The file could not be written.'; } finally { b.disabled = false; }
    });
    const doImport = async (f,asNew=false) => { const msg = $('#impMsg', host); msg.textContent = 'Reading ' + f.name + '…';
      try { const r = await importModel(f, { unit: +$('#unit', host).value, up: $('#up', host).value }), by = {};
        if (!INST.plan.ready) throw Error('Wait a moment for the Plan pane to open, then import again.');
        const list = r.components.map(({ srcLayer, ...c }) => ({ id: S.uid('c'), ...classify(c),...(srcLayer?{layer:srcLayer}:{}) }));
        if(asNew){const layers=[...new Set(list.map(c=>c.layer))].map(name=>({name,color:LAYER_COLORS[name]||'#cfcac0',visible:true,locked:false})),next=S.createProject(f.name.replace(/\.[^.]+$/,''),{units:'m',layers,components:list,...(r.audit?{importAudit:{...r.audit,triangles:r.triangles,fileName:f.name}}:{})});setCurrent(next);location.hash='#/workspace/'+next.id;return;}
        M().meshes = M().meshes || {};for (const c of list) { by[c.layer] = (by[c.layer] || 0) + 1; M().meshes[c.id] = c.mesh; open.add(c.layer); if (!M().layers.find((l) => l.name === c.layer)) M().layers.push({ name: c.layer, color: LAYER_COLORS[c.layer] || '#cfcac0', visible: true, locked: false }); }
        for (const I2 of ready()) if (I2.ws.importMeshes) I2.ws.importMeshes(M().meshes);
        INST.plan.ws.addImports(list.map(({ mesh, ...c }) => ({ ...c, tris: Math.round(mesh.length / 9) })));   // Plan Studio keeps it; the sync brings it to the other panes and the project
        if(r.audit)p.draft.importAudit={...r.audit,triangles:r.triangles,fileName:f.name};
        UI.open = [...open]; saveUI(); persist(); refresh(true);
        msg.textContent = `${f.name}: ${r.components.length} component${r.components.length > 1 ? 's' : ''}, ${r.triangles.toLocaleString('en-CA')} triangles. ${Object.entries(by).map(([l, n]) => `${n} on ${l}`).join(', ')}.${S.persistent() ? '' : ' Browser storage is unavailable; save will not persist.'}`; }
      catch (e) { msg.textContent = e.message; } };
    $('#pick', host).onclick = () => $('#file', host).click();
    $('#importAsNew',host).onclick=()=>$('#newModelFile',host).click();$('#newModelFile',host).onchange=e=>{const f=e.target.files[0];if(f)doImport(f,true);e.target.value='';};
    $('#file', host).onchange = (e) => { const f = e.target.files[0]; if (f) doImport(f); e.target.value = ''; };
    const drop = $('#drop', host);
    ['dragenter', 'dragover'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.remove('over'); if (n === 'drop' && e.dataTransfer.files[0]) doImport(e.dataTransfer.files[0]); }));
  }
  const ch = () => { persist(); drawShaded(false); layers(); selPane(); };
  // Plan Studio objects are deleted / duplicated by Plan Studio (so undo, wall openings and the other panes follow); the rest here
  const psDel = (ids) => { const w = INST.plan.ready ? INST.plan.ws : null;if(!w)return;const items=ids.map(psSel).filter(s=>s&&!['room','roof','stair','misc'].includes(s.k));if(w.delMany)w.delMany(items);else for(const s of items)w.del(s); };
  function delIds(ids) { const ps = ids.filter((id) => PS.test(id)), nat = new Set(ids.filter((id) => !PS.test(id))); if (nat.size) { M().components = M().components.filter((x) => !nat.has(x.id)); persist(); drawShaded(false); } psDel(ps); setSel([]); }
  // several selected: what they share, move them to a layer, delete them
  function multi(host) {
    const list = UI.sels.map(comp).filter(Boolean), byL = {}; for (const c of list) byL[c.layer] = (byL[c.layer] || 0) + 1;
    const nat = list.filter((c) => !PS.test(c.id));
    host.innerHTML = `<div class="pane"><h2>${list.length} selected <button class="btn sm" id="pBack">Done</button></h2>
      <p class="note">${Object.entries(byL).map(([l, n]) => `${n} on ${esc(l)}`).join(' · ')}</p>
      <div class="w2-mlist">${list.map((c) => `<button type="button" data-one="${c.id}" title="Edit only this one">${esc(c.name)}<small>${esc(c.layer)}</small></button>`).join('')}</div>
      ${nat.length ? `<label class="f">Move ${nat.length < list.length ? `the ${nat.length} imported` : 'all'} to layer<select id="mLayer"><option value="">Choose…</option>${M().layers.filter((l) => !l.locked).map((l) => `<option>${esc(l.name)}</option>`).join('')}</select></label>` : '<p class="note">Plan Studio objects keep their layers (walls on Walls, doors and windows on Glazing…).</p>'}
      <button class="btn danger" id="mDel">Delete</button></div>`;
    $('#pBack', host).onclick = () => { showParams = false; rail(); panel(); };
    $$('[data-one]', host).forEach((b) => b.onclick = () => setSel([b.dataset.one]));
    $('#mLayer', host)?.addEventListener('change', (e) => { if (!e.target.value) return; for (const c of nat) c.layer = e.target.value; openOnly(e.target.value); ch(); setTimeout(panel, 0); });
    $('#mDel', host).onclick = () => { if (!confirm(`Delete ${list.length} components?`)) return; delIds(list.map((c) => c.id)); };
  }
  // parameters of an imported mesh or a site component: the fields it has in the project data
  function params(host, c) {
    const isMesh = !!c.mesh, num = (k, label) => `<label class="f">${label}<input type="number" step="0.05" data-g="${k}" value="${c.g[k]}" ${isMesh && 'wdh'.includes(k) ? 'disabled title="Imported meshes keep their size"' : ''}></label>`;
    host.innerHTML = `<div class="pane"><h2>Parameters <button class="btn sm" id="pBack">Done</button></h2>
      <label class="f">Name<input id="pName" value="${esc(c.name)}"></label>
      <div class="grid g2"><label class="f">Layer<select id="pLayer">${M().layers.map((l) => `<option ${l.name === c.layer ? 'selected' : ''} ${l.locked && l.name !== c.layer ? 'disabled' : ''}>${esc(l.name)}</option>`).join('')}</select></label>
        <label class="f">Type<select id="pType">${TYPES.map((t) => `<option ${t === c.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
      <label class="f">Material<select id="pMat">${MATS.map((m) => `<option ${m === c.mat ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
      <span class="note">Position (m)</span><div class="dims">${num('x', 'x')}${num('y', 'y')}${num('z', 'z')}</div>
      <span class="note">Size (m)</span><div class="dims">${num('w', 'Width')}${num('d', 'Depth')}${num('h', 'Height')}</div>
      <p class="note">${c.mesh ? 'Imported mesh: position can change, size stays as imported.' : 'A component kept from the earlier Workspace: it is listed and exported; Plan and Perspective draw Plan Studio’s model.'}</p></div>`;
    $('#pBack', host).onclick = () => { showParams = false; rail(); panel(); };
    $('#pName', host).onchange = (e) => { c.name = e.target.value.trim() || c.name; ch(); };
    $('#pLayer', host).onchange = (e) => { c.layer = e.target.value; open.add(c.layer); ch(); };
    $('#pType', host).onchange = (e) => { c.type = e.target.value; ch(); };
    $('#pMat', host).onchange = (e) => { c.mat = e.target.value; ch(); };
    $$('[data-g]', host).forEach((i) => i.onchange = () => { const v = parseFloat(i.value); if (!Number.isFinite(v) || ('wdh'.includes(i.dataset.g) && v <= 0)) { i.value = c.g[i.dataset.g]; return; } c.g[i.dataset.g] = v; ch(); });
  }

  // ---- right: layers (Rhino-style rows), selection, versions, next
  function layers() {
    const siteLayer = M().layers.find(l => l.name === 'Site');
    $('#editSite', app).textContent = siteLayer?.locked === false ? 'Finish site editing' : 'Edit site';
    const host = $('#layers', app), comps = M().components;
    for (const c of comps) if (!M().layers.find((l) => l.name === c.layer)) M().layers.push({ name: c.layer, color: LAYER_COLORS[c.layer] || '#ccc', visible: true, locked: false });
    const hid = (c) => { const s = psSel(c.id); return !!s && HIDDEN.has(s.id); };
    host.innerHTML = M().layers.map((l, i) => { const list = comps.filter((c) => c.layer === l.name), o = open.has(l.name), nh = list.filter(hid).length; return `<div class="w2-layer ${l.visible ? '' : 'off'} ${l.locked ? 'locked' : ''}">
      <div class="w2-lrow"><span class="sw" style="background:${l.color}"></span><button class="nm" data-open="${i}" aria-expanded="${o}">${o ? '▾' : '▸'} ${esc(l.name)}${nh ? ` <small class="w3-hidn">${nh} hidden</small>` : ''}</button><span class="cnt">${list.length}</span>
      <button class="ic" data-vis="${i}" title="${l.visible ? 'Hide' : 'Show'} ${esc(l.name)}" aria-label="${l.visible ? 'Hide' : 'Show'} ${esc(l.name)}" aria-pressed="${!l.visible}">${l.visible ? EYE_ON : EYE_OFF}</button>
      <button class="ic" data-lock="${i}" title="${l.locked ? 'Unlock' : 'Lock'} ${esc(l.name)}" aria-label="${l.locked ? 'Unlock' : 'Lock'} ${esc(l.name)}" aria-pressed="${l.locked}">${l.locked ? LOCK_ON : LOCK_OFF}</button>${!Object.hasOwn(LAYER_COLORS,l.name)?`<button type="button" class="ic" data-remove-layer="${i}" ${list.length||l.locked?'disabled':''} title="${list.length?'Move or delete the layer’s objects first':l.locked?'Unlock this layer first':'Remove empty layer'}" aria-label="Remove empty layer ${esc(l.name)}">×</button>`:''}</div>
      ${o ? `<div class="comps">${list.map((c) => { const h = hid(c), dis = l.locked || !l.visible || h; return `<div class="w3-crow${h ? ' hid' : ''}"><button data-sel="${c.id}" aria-current="${isSel(c.id)}" ${dis ? `aria-disabled="true" title="${h ? 'Hidden piece: show it with the eye' : l.locked ? 'Locked layer: unlock it to select' : 'Hidden layer: show it to select'}"` : 'title="Shift-click adds, Ctrl-click removes"'}>${esc(c.name)}</button>${psSel(c.id)?.k === 'furn' ? `<button class="ic sm" data-pshide="${esc(c.id)}" aria-pressed="${h}" title="${h ? 'Show this piece again' : 'Hide this piece'}" aria-label="${h ? 'Show' : 'Hide'} ${esc(c.name)}">${h ? EYE_OFF : EYE_ON}</button>` : ''}</div>`; }).join('') || '<span class="note">Empty</span>'}</div>` : ''}</div>`; }).join('');
    fit(host, $$('.w2-lrow, .comps > *', host), 'layers');   // the tree, line by line: layers and the open layer's components
    $$('[data-remove-layer]',host).forEach(button=>button.onclick=()=>{const i=+button.dataset.removeLayer,l=M().layers[i];if(!l||l.locked||Object.hasOwn(LAYER_COLORS,l.name)||M().components.some(c=>c.layer===l.name))return;M().layers.splice(i,1);open.delete(l.name);saveUI();persist();layers();toast('Empty layer removed');});
    $$('[data-open]', host).forEach((b) => b.onclick = () => { const n = M().layers[b.dataset.open].name; openOnly(open.has(n) ? null : n); saveUI(); layers(); });
    $$('[data-vis]', host).forEach((b) => b.onclick = () => { const l = M().layers[b.dataset.vis]; l.visible = !l.visible; persist(); const map = layerVis(), off = offLayers(); for (const I2 of ready()) { I2.ws.layers(map); if (I2.ws.impOff) I2.ws.impOff(off); } drawShaded(false);
      if (!l.visible && UI.sels.some((id) => comp(id)?.layer === l.name)) setSel(UI.sels.filter((id) => comp(id)?.layer !== l.name)); else { vp.select(UI.sels); layers(); } });
    $$('[data-lock]', host).forEach((b) => b.onclick = () => { const l = M().layers[b.dataset.lock]; l.locked = !l.locked; persist(); const lk = lockList(); for (const I2 of ready()) I2.ws.setLocks(lk);
      if (l.locked && UI.sels.some((id) => comp(id)?.layer === l.name)) setSel(UI.sels.filter((id) => comp(id)?.layer !== l.name)); else layers(); });
    $$('[data-sel]', host).forEach((b) => b.onclick = (e) => { if (b.getAttribute('aria-disabled') === 'true') return; pick(b.dataset.sel, { add: e.shiftKey, remove: e.ctrlKey || e.metaKey }); });
    $$('[data-pshide]', host).forEach((b) => b.onclick = () => { const s = psSel(b.dataset.pshide), w = INST.plan.ready ? INST.plan.ws : null; if (!s || !w) return; w.hide(s.id, !HIDDEN.has(s.id)); });
  }
  function selPane() {
    const host = $('#selp', app), list = UI.sels.map(comp).filter(Boolean), c = list.at(-1);
    if (!c) { host.innerHTML = `<h2>Selection</h2><p class="note">Nothing selected: click an object in the view or a name in Layers.</p>`; return; }
    if (list.length > 1) {
      host.innerHTML = `<h2>Selection <button class="btn sm" id="desel">Clear</button></h2><p style="font-weight:600">${list.length} components</p><p class="note">${esc(list.map((x) => x.name).slice(0, 4).join(', '))}${list.length > 4 ? ` and ${list.length - 4} more` : ''}</p>
        <button class="btn sm" id="edit">Edit selection</button><button class="btn danger" id="del">Delete</button>`;
      $('#desel', host).onclick = () => setSel([]); $('#edit', host).onclick = () => { showParams = true; rail(); panel(); };
      $('#del', host).onclick = () => { if (!confirm(`Delete ${list.length} components?`)) return; delIds(list.map((x) => x.id)); };
      return;
    }
    const s = psSel(c.id), fixed = s && (s.k === 'room' || s.k === 'roof' || s.k === 'stair' || s.k === 'misc');
    host.innerHTML = `<h2>Selection <button class="btn sm" id="desel">Clear</button></h2>
      <p style="font-weight:600">${esc(c.name)}</p><p class="note">${esc(c.layer)} · ${esc(c.type)} · ${c.g.w} × ${c.g.d} × ${c.g.h} m${s ? ' · Plan Studio object' : ''}</p>
      <button class="btn sm" id="edit">Edit parameters</button>
      ${fixed ? `<p class="note">${s.k === 'room' ? 'A room is the space between walls: move or delete its walls to change it.' : 'Made by Plan Studio from other objects.'}</p>` : '<div class="grid g2"><button class="btn" id="dup">Duplicate</button><button class="btn danger" id="del">Delete</button></div>'}`;
    $('#desel', host).onclick = () => setSel([]);
    $('#edit', host).onclick = () => { showParams = true; rail(); panel(); };
    $('#dup', host)?.addEventListener('click', () => { if (s) { if (INST.plan.ready && !INST.plan.ws.dup(s)) toast('Plan Studio does not duplicate this kind of object.'); return; } const n = S.clone(c); n.id = S.uid('c'); n.name = c.name + ' copy'; n.g.x += 1; M().components.push(n); persist(); drawShaded(false); setSel([n.id]); });
    $('#del', host)?.addEventListener('click', () => delIds([c.id]));
  }
  function state() {
    const v = last(), d = dirty();
    $('#state', app).innerHTML = `${p.sample ? 'Sample project with mock results. Edits are kept in this browser.' : 'Edits are kept in this browser.'} · ${esc(p.name)} · ${v ? 'v' + v.n : 'no version yet'}${d ? ' · <span class="dirty">unsaved changes</span>' : ''}`;
    $('#dirty', app).textContent = d ? (v ? `Changes since v${v.n} are not saved.` : 'Save the first version to run simulations.') : `Up to date with v${v.n}.`;
    $('#versions', app).innerHTML = p.versions.slice().reverse().map((x) => `<div class="vrow ${x === v && !d ? 'cur' : ''}"><span class="vn">v${x.n}</span><div><div>${esc(x.note)}</div><div class="vmeta">${when(x.created)} · ${p.runs.filter((r) => r.versionId === x.id).length} results</div></div>
      <div style="display:grid;gap:4px"><button class="btn sm" data-load="${x.id}">Open</button><a class="btn sm" href="#/simulations" data-simv="${x.id}">Simulate</a></div></div>`).join('') || '<p class="note">No versions yet.</p>';
    fit($('#versions', app), $$('#versions .vrow', app), 'versions');
    $$('[data-load]', app).forEach((b) => b.onclick = () => { if (dirty() && !confirm('Discard unsaved changes and open this version?')) return; p.draft = S.clone(S.version(p, b.dataset.load).model); const conv = ensureStudio(p); persist(); loadAll(); setSel([]); toast(conv ? 'Version opened (converted to Plan Studio’s model)' : 'Version opened'); });
    $$('[data-simv]', app).forEach((a) => a.onclick = () => setCurrentVersion(p, a.dataset.simv));
    $('#toSim', app).href = '#/simulations'; $('#toSim', app).onclick = () => { if (last()) setCurrentVersion(p, last().id); };
  }
  function loadAll() { SNAP = JSON.stringify(p.draft.studio); for (const I2 of ready()) { const back = I2.ws.load(SNAP); if (I2 === INST.plan && back !== SNAP) { SNAP = back; p.draft.studio = JSON.parse(back); } tell(I2); } vpFitted = false; derive(false); levelUI(); refresh(true); }
  const studyChoice=document.createElement('select');studyChoice.id='workspaceStudy';studyChoice.setAttribute('aria-label','Simulation study');studyChoice.innerHTML=SIMS.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
  try{const saved=localStorage.getItem('pc-workspace-study');if(SIMS.some(s=>s.id===saved))studyChoice.value=saved;}catch{}
  $('#sendSim',app).before(studyChoice);studyChoice.onchange=()=>{try{localStorage.setItem('pc-workspace-study',studyChoice.value);}catch{}};
  $('#sendSim', app).onclick = async () => {
    const button=$('#sendSim',app),pane=activePane(),shell=$('.wb-shell',app);if(!pane.ready){toast('The model is still loading.');return;}button.disabled=true;shell.inert=true;shell.setAttribute('aria-busy','true');
    try{
      // Flush the active model and its derived geometry before freezing the version.
      const snapshot=pane.ws.model();p.draft.studio=JSON.parse(snapshot);SNAP=snapshot;
      for(const i of ready())if(i!==pane)i.ws.apply(snapshot,false);
      if(dT){cancelAnimationFrame(dT);dT=0;}while(dRun&&!dead)await new Promise(r=>setTimeout(r,20));if(dead)return;
      await deriveNow(false);if(dead)return;
      const v=dirty()||!last()?S.saveVersion(p,'Sent from Workspace'):last();setCurrent(p);setCurrentVersion(p,v.id);
      const levels=pane.ws.levels(),selected=levels.list.find(l=>l.id===levels.lv),level=levelsOf(v.model).find(l=>Math.abs(l.z-(selected?.z??0))<.001);
      if(level)sessionStorage.setItem('pc-sim-level:'+p.id,'L'+level.n);
      location.hash='#/simulations/'+studyChoice.value+'?autorun=workspace';
    }catch(error){toast('The current model could not be sent: '+(error.message||'storage unavailable'));button.disabled=false;shell.inert=false;shell.removeAttribute('aria-busy');}
  };
  $('#editSite', app).onclick = () => { const l = M().layers.find(l => l.name === 'Site'); if (!l) return; l.locked = !l.locked; $('#editSite', app).textContent = l.locked ? 'Edit site' : 'Finish site editing'; persist(); for (const i of ready()) i.ws.setLocks(lockList()); layers(); };
  $('#addLayer', app).onclick = () => { const name = prompt('Layer name'); if(name===null)return;if(!name.trim()){toast('Enter a layer name.');return;}if(M().layers.find(l=>l.name.toLowerCase()===name.trim().toLowerCase())){toast('A layer with that name already exists.');return;} M().layers.push({ name: name.trim(), color: '#cfcac0', visible: true, locked: false }); openOnly(name.trim()); saveUI(); persist(); layers(); };
  $('#saveV', app).onclick = () => { if (!dirty() && last()) { toast('No changes since v' + last().n); return; } const v = S.saveVersion(p, $('#note', app).value.trim()); $('#note', app).value = ''; state(); toast(`Saved v${v.n}`); };

  // ---- status bar: snaps for the Plan pane's drawing and the gumball, the gumball itself, clearance in Plan and Shaded
  $$('[data-snap]', app).forEach((i) => i.onchange = () => { UI.snap[i.dataset.snap] = i.checked; saveUI(); for (const I2 of ready()) I2.ws.snaps(UI.snap); });
  $$('[data-sw]', app).forEach((b) => b.onclick = () => { const k = b.dataset.sw; UI[k] = !UI[k]; b.setAttribute('aria-checked', String(UI[k])); saveUI();
    for (const I2 of ready()) { if (k === 'clearance') I2.ws.clearance(UI.clearance); if (k === 'gumball') I2.ws.gumball(UI.gumball); }
    if (k === 'clearance') clearance(); });
  // Esc clears the selection (not while typing)
  const onKey = (e) => { if (e.target.closest?.('input,select,textarea,[contenteditable=true]')) return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();const pane=activePane();if(pane.ready)pane.ws.selectAll?.();}
    if(e.key==='Escape'){const open=['levelMenu','vMenu','dMenu','tabMenu'].some(id=>!$('#'+id,app).hidden);if(open){e.preventDefault();closeMenus();gearMenu(false);return;}if(UI.sels.length)setSel([]);const pane=activePane();if(pane.ready)pane.win.document.dispatchEvent(new pane.win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));}
    if((e.key==='Delete'||e.key==='Backspace')&&UI.sels.length){e.preventDefault();delIds([...UI.sels]);}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)hub.redo();else hub.undo();}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();hub.redo();}
  };
  addEventListener('keydown', onKey);

  subs.push((ids) => vp.select(ids), () => layers(), () => selPane(), () => { rail(); panel(); });
  function refresh(refit) { drawShaded(refit); layers(); selPane(); state(); }

  const disposeShell=mountWorkbenchShell(app,{activePane,deleteSelection:()=>{if(!UI.sels.length)return false;delIds([...UI.sels]);return true;},fit:()=>$('#fit',app).click(),center:async()=>{
    const pane=activePane(),shell=$('.wb-shell',app);if(!pane.ready)return;shell.inert=true;shell.setAttribute('aria-busy','true');
    try{const result=await pane.ws.centerToOrigin();toast(result.moved?'Centered '+result.count+' imported building objects. Furniture was not moved. Undo restores the previous position.':'The imported building is already centered at the origin.');}
    catch(error){toast(error.message||'The model could not be centered.');}
    finally{shell.inert=false;shell.removeAttribute('aria-busy');}
  }});
  // first paint: whatever the draft has (imported meshes, site); the panes add Plan Studio's objects as soon as they start
  drawShaded(true); showView(UI.view);
  state(); layers(); selPane(); rail(); panel(); tabsUI();
  setSel(UI.selProject === p.id ? UI.sels.filter((id) => comp(id)) : [], { params: false });
  // read-only hook for the browser checks in tests
  window.__ws2 = { vp, UI, sel: () => primary(), sels: () => [...UI.sels], model: () => p.draft, inst: INST, objects: () => OBJ, hub, renderModel, ready: () => INST.plan.ready && INST.persp.ready && INST.props.ready && OBJ.length > 0 };
  (async () => { for (let i = 0; i < 60 && !LIGHTS; i++) { if (INST.plan.ready) LIGHTS = INST.plan.ws.lights(); else await new Promise((r) => setTimeout(r, 250)); } })();
  return () => { dead = true; disposeShell();document.removeEventListener('click', outside); removeEventListener('blur', away); clearInterval(paneT); clearInterval(toolT); removeEventListener('keydown', onKey); vp.dispose(); if (window.__wsHub === hub) delete window.__wsHub; delete window.__ws2; };
}
