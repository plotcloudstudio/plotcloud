// The Workspace (#/workspace): Plan Studio in three panes side by side, with the Workspace's own tools, layers, versions and status bar.
//   Plan        = Plan Studio's 2D (emb/modeler.html?ws=plan): its wall, room, door, window and furniture tools, handles, toolbars and clearance.
//   Perspective = Plan Studio's 3D (?ws=persp): its gumball, Bird / Walkthrough / Explode, plus a Ghosted / Wireframe display switch.
//   Shaded      = a solid shaded 3D view (viewport2.js), view only: Plan Studio's geometry plus anything imported and the site.
// One model: the project's draft keeps the Plan Studio model (draft.studio) and, next to it, one component per Plan Studio object
// (ids "ps:<kind>:<id>") so layers, versions, exports and simulations keep working. Imported meshes and the site stay ordinary components.
// The earlier Workspace is kept unchanged as an archive (pages/workspace.js, #/workspace-archive). Same project data (store.js), same import code (viewport.js).
import * as S from '../store.js';
import { LAYER_COLORS, PAGE } from '../data.js';
import { $, $$, esc, when, toast, currentProject, setCurrent, setCurrentVersion } from '../app.js';
import { importModel } from '../viewport.js';
import { createViewport2 } from '../viewport2.js';
import { FORMATS, make as makeExport } from '../export3d.js';
import { MODELS, GROUPS } from '../../../furniture/models.js';   // Plan Studio's parametric furniture: the same ids Plan Studio places
import { TOOL_ICONS } from '../tool-icons.js';
import { toStudio } from '../studio-convert.js';

// as in the archived Workspace
const TYPES = ['wall', 'slab', 'roof', 'window', 'room', 'mass', 'terrain', 'furniture', 'imported'];
const MATS = ['Concrete', 'Plaster', 'Gypsum', 'Glass', 'Timber', 'Carpet', 'Acoustic panel', 'Grass', 'Context', 'Imported'];

// Tool lists, names exactly as in Plan Studio (emb/modeler.html). Each one starts Plan Studio's own tool in the Plan pane.
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
// what each tile starts in Plan Studio (its own tool keys, door models and stair models)
const TMAP = { 'Straight wall': { tool: 'wall', key: 'W' }, 'Rectangle room': { tool: 'room', key: 'R' }, 'Arc wall': { tool: 'arc', key: 'H' }, Floor: { tool: 'floor', key: 'F' }, Fence: { tool: 'fence' },
  'Straight stair': { stair: 'straight' }, 'L-shaped stair': { stair: 'lshape' }, 'U-shaped stair': { stair: 'ushape' }, 'Spiral stair': { stair: 'spiral' }, 'Accessible ramp': { stair: 'ramp' }, 'Floor opening': { tool: 'void', key: 'O' },
  'Exterior door': { tool: 'door', opm: 'ext' }, 'Interior door': { tool: 'door', opm: 'int', key: 'D' }, 'Exit door': { tool: 'door', opm: 'exit' }, 'Accessible door': { tool: 'door', opm: 'acc' },
  Window: { tool: 'win', opm: 'win', key: 'N' }, 'Wall opening': { tool: 'hole', key: 'E' } };
const ON_WALL = new Set(['door', 'win', 'hole']);
const FURN_BY_NAME = new Map(MODELS.map((m) => [m.en, m]));

// Plan Studio objects ↔ Workspace layers. A Workspace layer's eye and lock act on these Plan Studio layers in every pane.
const KLAYER = { wall: 'Walls', fence: 'Walls', op: 'Glazing', floor: 'Structure', void: 'Structure', stair: 'Structure', furn: 'Furniture', room: 'Rooms', light: 'Lighting', ceil: 'Lighting', roof: 'Roof' };
const LMAP = { Walls: ['parts.walls'], Glazing: ['parts.openings'], Structure: ['parts.floors'], Furniture: ['soft', 'custom'], Rooms: ['roomNames', 'roomArea'], Lighting: ['lighting', 'lighting.fix', 'ceiling', 'ceiling.lights', 'ceiling.panels', 'ceiling.vents'], Site: ['ref.site'] };
const KTYPE = { wall: 'wall', fence: 'wall', floor: 'slab', void: 'slab', stair: 'slab', furn: 'furniture', room: 'room', light: 'furniture', ceil: 'furniture', roof: 'roof' };
const KMAT = { wall: 'Plaster', fence: 'Timber', floor: 'Concrete', void: 'Concrete', stair: 'Concrete', furn: 'Timber', light: 'Imported', ceil: 'Gypsum', roof: 'Concrete' };
const PS = /^ps:([a-z]+):(.*)$/;
const psId = (s) => `ps:${s.k === 'end' ? 'wall' : s.k}:${s.id}`;
const psSel = (id) => { const m = PS.exec(id || ''); return m ? { k: m[1], id: m[2] } : null; };

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
const DEF_UI = { panel: 'project', snap: { End: true, Near: true, Mid: true, Cen: false }, gumball: true, clearance: false, sels: [], selProject: null, open: ['Walls', 'Glazing', 'Rooms', 'Imported'], split: [1, 1, 1], disp: 'shaded', view: 'plan' };
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
  const M = () => p.draft, comp = (id) => M().components.find((c) => c.id === id);
  const layerOf = (c) => M().layers.find((l) => l.name === c?.layer);
  const last = () => p.versions.at(-1), dirty = () => !last() || JSON.stringify(last().model) !== JSON.stringify(p.draft);
  const UI = readUI(); const saveUI = () => { try { localStorage.setItem(UKEY, JSON.stringify(UI)); } catch (e) { } };
  const open = new Set(UI.open);
  let showParams = false, OBJ = [], HIDDEN = new Set(), MESH = new Map(), CLR = [], SNAP = JSON.stringify(p.draft.studio), dead = false;
  const primary = () => UI.sels.at(-1) || null, isSel = (id) => UI.sels.includes(id);

  // ---- the one selection (a list; the last one picked is the primary); every region subscribes to it
  const subs = [];
  const selectable = (id) => { const c = comp(id), l = layerOf(c); return !!(c && l && !l.locked && l.visible !== false); };
  function setSel(ids, { params = true, from = null } = {}) {
    ids = [...new Set((Array.isArray(ids) ? ids : [ids]).filter((id) => id && selectable(id)))];
    UI.sels = ids; UI.selProject = p.id; for (const id of ids) open.add(comp(id).layer); UI.open = [...open]; saveUI();
    showParams = ids.length > 0 && params;
    const s = ids.length === 1 ? psSel(ids[0]) : null;   // Plan Studio selects one object: the panes follow a single Plan Studio pick
    for (const [r, I2] of Object.entries(INST)) if (r !== from && I2.ready) I2.ws.select(s);
    for (const f of subs) f(ids);
  }
  // Rhino: Shift adds, Ctrl (or Cmd) removes, plain click or box replaces
  function pick(id, { add, remove } = {}) {
    if (remove) return setSel(UI.sels.filter((x) => x !== id));
    if (add) return id ? setSel(isSel(id) ? UI.sels : [...UI.sels, id]) : undefined;
    setSel(id ? [id] : []);
  }
  function boxPick(ids, { add, remove }) { if (remove) setSel(UI.sels.filter((x) => !ids.includes(x))); else if (add) setSel([...UI.sels, ...ids]); else setSel(ids); }

  const fsrc = (role) => `../emb/modeler.html?ws=${role}&v=ws3-20261024`;
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
      <div><button type="button" id="vBtn" aria-haspopup="true" aria-expanded="false"></button><div class="w2-menu" id="vMenu" role="menu" hidden></div></div>
      <span class="w2-sep" aria-hidden="true"></span>
      <div><button type="button" id="dBtn" aria-haspopup="true" aria-expanded="false"></button><div class="w2-menu" id="dMenu" role="menu" hidden></div></div>
    </div>
    <div class="w2-tr"><button class="btn sm" id="fit">Fit</button></div>
  </section>
  <aside class="w2-right" aria-label="Layers, selection and versions">
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
    ${Object.keys(DEF_UI.snap).map((k) => `<label title="${{ End: 'Wall ends', Near: 'Wall bodies and faces', Mid: 'Wall midpoints', Cen: 'Centres: arc walls, furniture, rooms' }[k]} — for drawing in Plan and for the gumball in Perspective"><input type="checkbox" data-snap="${k}" ${UI.snap[k] ? 'checked' : ''}> ${k}</label>`).join('')}
    <span class="w2-div" aria-hidden="true"></span>
    <button type="button" class="w2-sw" role="switch" data-sw="gumball" aria-checked="${UI.gumball}" title="Plan Studio's gumball on the selected piece in Perspective: yellow and green arrows move it, the blue arc turns it">Gumball</button>
    <button type="button" class="w2-sw" role="switch" data-sw="clearance" aria-checked="${UI.clearance}" title="Show the free space each piece wants round it (front, back and sides), from its own size and clearances. A hint only: walls block the piece, not its clearance.">Clearance</button>
    <span class="sp"></span><span class="w2-state" id="state"></span>
  </footer></div>`;

  // ---- the panes: Plan Studio instances that call window.__wsHub; they are told the model, layers, locks, snaps and selection
  const INST = { plan: { el: $('#fPlan', app) }, persp: { el: $('#fPersp', app) }, props: { el: $('#fProps', app) } };
  const ready = () => Object.values(INST).filter((x) => x.ready);
  const any = () => INST.plan.ready ? INST.plan.ws : INST.persp.ready ? INST.persp.ws : INST.props.ready ? INST.props.ws : null;
  const layerVis = () => { const map = { parts: true, ref: true }; for (const [L, ids] of Object.entries(LMAP)) { const l = M().layers.find((x) => x.name === L), on = l ? l.visible !== false : true; for (const id of ids) map[id] = on; } return map; };
  const lockList = () => M().layers.filter((l) => l.locked).map((l) => l.name);
  function tell(I2) { const w = I2.ws; w.layers(layerVis()); w.setLocks(lockList()); w.snaps(UI.snap); w.clearance(UI.clearance); w.gumball(UI.gumball); w.display(UI.disp);
    const s = UI.sels.length === 1 ? psSel(UI.sels[0]) : null; w.select(s); }
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
      for (const I2 of ready()) I2.ws.histUI();
      if (!live) { p.draft.studio = JSON.parse(snap); levelUI(); }
      derive(live);
    },
    say(role, t) { if (INST.plan.ready) INST.plan.ws.flash(t); if (role === 'props') toast(t); },
    pushUndo(before) { if (INST.plan.ready) INST.plan.ws.pushUndo(before); },
    undo() { if (INST.plan.ready) INST.plan.ws.undo(); }, redo() { if (INST.plan.ready) INST.plan.ws.redo(); },
    hist() { return INST.plan.ready ? INST.plan.ws.hist() : { u: 0, r: 0 }; },
    select(role, s) { if (dead) return; const id = s ? psId(s) : null;
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
      const base = { name: o.name, type: o.k === 'op' ? (o.kind === 'door' ? 'door' : 'window') : KTYPE[k] || 'furniture', layer: KLAYER[k] || 'Imported', mat: o.k === 'op' ? (o.kind === 'door' ? 'Timber' : 'Glass') : KMAT[k] || 'Imported' };
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
    if (!live) { S.save(); state(); layers(); selPane(); toolUI(); }
  }
  // the Shaded pane draws the project's components; Plan Studio's ones with the meshes made above
  let vpFitted = false;
  const renderModel = () => ({ ...M(), components: M().components.map((c) => { const m = MESH.get(c.id); return m ? { ...c, ...m } : PS.test(c.id) ? null : c; }).filter(Boolean) });
  function drawShaded(refit) { vp.setModel(renderModel(), { refit }); vp.select(UI.sels); clearance(); }

  let tabInfo = null;
  const vp = createViewport2($('#vp', app), { onPick: pick, onBox: boxPick, onHover: (h) => { tabInfo = h; hint(); } });
  vp.setDisplay('shaded'); vp.setView({ kind: 'persp' });
  const clearance = () => { const vis = M().layers.find((l) => l.name === 'Furniture')?.visible !== false; vp.setClearance(UI.clearance && vis ? CLR.filter((r) => !HIDDEN.has(r.id)).map((r) => ({ id: r.id, z: r.z, pts: r.pts })) : []); };
  const persist = () => { S.save(); state(); };
  const SELHELP = 'Click to select · drag a box: left→right inside, right→left touching · Shift adds, Ctrl removes · Tab cycles what is under the cursor';
  function hint() { const h = $('#hint', app); h.title = SELHELP; h.textContent = tabInfo ? `${tabInfo.name} — ${tabInfo.index + 1} of ${tabInfo.count} under the cursor${tabInfo.count > 1 ? ' · Tab for the next one' : ''} · click to select` : 'View only · right-drag orbits · Shift+right-drag pans · scroll zooms · click or box to select'; }
  $('#fit', app).onclick = () => { if (UI.view === 'shaded') vp.fit(); else if (UI.view === 'plan' && INST.plan.ready) INST.plan.win.document.getElementById('fitBtn')?.click(); else if (INST.persp.ready) INST.persp.win.document.getElementById('fitBtn')?.click(); };
  hint();

  // ---- one view, chosen at the top left (as before): Plan (Plan Studio 2D) per level, its ceiling plan and interior
  // elevation; Perspective (Plan Studio 3D) with Walkthrough and Explode; and the Shaded model with imports and the site.
  // The three stay loaded on top of each other, so switching is instant and every edit reaches all of them.
  const DISPLAYS = [['shaded', 'Shaded'], ['ghosted', 'Ghosted'], ['wire', 'Wireframe']];
  if (!['plan', 'persp', 'shaded'].includes(UI.view)) UI.view = 'plan';
  function showView(v) { UI.view = v; saveUI(); $$('.w3-pane', app).forEach((el) => el.classList.toggle('on', el.dataset.pane === v)); if (v === 'shaded') vp.fit(); menus(); }
  function viewName() {
    const a = INST.plan.ready ? INST.plan.ws.state() : null, b = INST.persp.ready ? INST.persp.ws.state() : null, L = (INST.plan.ready ? INST.plan.ws : any())?.levels();
    const lv = L ? L.list.find((l) => l.id === L.lv) : null;
    if (UI.view === 'plan') return a?.view2d === 'ceiling' ? `Ceiling plan · ${lv?.short || ''}` : a?.view2d === 'elev' ? 'Interior elevation' : `Plan · ${lv ? `${lv.short} ${lv.name}` : 'Level 1'}`;
    if (UI.view === 'persp') return b?.walking || b?.walkpick ? 'Walkthrough' : b?.explode ? 'Exploded view' : 'Perspective';
    return 'Shaded model · imports & site';
  }
  function menus() {
    const L = (INST.plan.ready ? INST.plan.ws : any())?.levels(), a = INST.plan.ready ? INST.plan.ws.state() : null, b = INST.persp.ready ? INST.persp.ws.state() : null;
    const it = (attrs, on, label, small = '') => `<button role="menuitemradio" ${attrs} aria-checked="${on}">${label}${small ? `<small>${small}</small>` : ''}</button>`;
    $('#vBtn', app).textContent = viewName() + ' ▾';
    $('#vMenu', app).innerHTML = (L ? L.list.slice().reverse().map((l) => it(`data-view="plan" data-level="${esc(l.id)}"`, UI.view === 'plan' && a?.view2d === 'plan' && l.id === L.lv, `Plan · ${esc(l.short)} ${esc(l.name)}`, `${l.z.toFixed(2)} m`)).join('') : it('data-view="plan"', UI.view === 'plan', 'Plan'))
      + it('data-view="ceiling"', UI.view === 'plan' && a?.view2d === 'ceiling', 'Ceiling plan') + it('data-view="elev"', UI.view === 'plan' && a?.view2d === 'elev', 'Interior elevation', 'pick a wall')
      + it('data-view="persp"', UI.view === 'persp' && !b?.walking && !b?.walkpick && !b?.explode, 'Perspective', 'Plan Studio 3D') + it('data-view="walk"', UI.view === 'persp' && !!(b?.walking || b?.walkpick), 'Walkthrough') + it('data-view="explode"', UI.view === 'persp' && !!b?.explode, 'Explode')
      + it('data-view="shaded"', UI.view === 'shaded', 'Shaded model', 'with imports & site') + '<p class="w2-mnote">Every view shows the same model; an edit in one is in all of them.</p>';
    const plan = UI.view === 'plan', cur = UI.view === 'shaded' ? vp.display : (b?.disp || UI.disp);
    $('#dBtn', app).textContent = plan ? 'Plan drawing' : (DISPLAYS.find(([k]) => k === cur) || DISPLAYS[0])[1] + ' ▾'; $('#dBtn', app).disabled = plan;
    $('#dMenu', app).innerHTML = DISPLAYS.map(([k, n]) => it(`data-disp="${k}"`, cur === k, n)).join('');
    $$('#vMenu [data-view]', app).forEach((x) => x.onclick = async () => { closeMenus(); const v = x.dataset.view;
      if (v === 'plan' || v === 'ceiling' || v === 'elev') { showView('plan'); if (x.dataset.level) for (const I2 of ready()) I2.ws.level(x.dataset.level); if (INST.plan.ready) await INST.plan.ws.view(v === 'ceiling' ? 'ceiling' : v === 'elev' ? 'elev' : 'plan'); }
      else if (v === 'persp' || v === 'walk' || v === 'explode') { showView('persp'); if (INST.persp.ready) { const st = INST.persp.ws.state(); if (v === 'persp') await INST.persp.ws.view('bird'); else if (v === 'walk' && !st.walking && !st.walkpick) await INST.persp.ws.view('walk'); else if (v === 'explode' && !st.explode) await INST.persp.ws.view('explode'); } }
      else showView('shaded');
      menus(); });
    $$('#dMenu [data-disp]', app).forEach((x) => x.onclick = () => { closeMenus(); const d = x.dataset.disp; if (UI.view === 'shaded') vp.setDisplay(d); else { UI.disp = d; saveUI(); if (INST.persp.ready) INST.persp.ws.display(d); } menus(); });
  }
  const closeMenus = () => { for (const [b, m] of [['vBtn', 'vMenu'], ['dBtn', 'dMenu']]) { $('#' + m, app).hidden = true; $('#' + b, app).setAttribute('aria-expanded', 'false'); } };
  for (const [b, m] of [['vBtn', 'vMenu'], ['dBtn', 'dMenu']]) $('#' + b, app).onclick = (e) => { e.stopPropagation(); const was = !$('#' + m, app).hidden; closeMenus(); if (!was) { menus(); $('#' + m, app).hidden = false; $('#' + b, app).setAttribute('aria-expanded', 'true'); } };
  const outside = (e) => { if (!e.target.closest('#cap')) closeMenus(); }; document.addEventListener('click', outside);
  // the panes' own buttons (Explode in the toolbar, Esc out of a walkthrough, the level) change the name in the pill too
  const levelUI = () => menus(), paneUI = () => { if ($('#vMenu', app).hidden) menus(); };
  const paneT = setInterval(paneUI, 700);

  // ---- left: rail + panel (project / tool group / parameters of the selection)
  let LIGHTS = null;
  function rail() { const k = showParams && UI.sels.length ? null : UI.panel; $$('[data-panel]', app).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.panel === k))); }
  $$('[data-panel]', app).forEach((b) => b.onclick = () => { UI.panel = b.dataset.panel; saveUI(); showParams = false; rail(); panel(); });
  const propsOn = (on) => { $('#propsWrap', app).dataset.off = String(!on); $('#panelBody', app).hidden = on; };
  function panel() {
    const host = $('#panelBody', app); propsOn(false);
    if (showParams && UI.sels.length > 1) return multi(host);
    const c = comp(primary());
    if (showParams && c && PS.test(c.id)) { propsOn(true); $('#pWhat', app).textContent = `${c.name} · ${c.layer}. Plan Studio’s own parameters; changes show in all three panes.`; return; }
    if (showParams && c) return params(host, c);
    if (UI.panel === 'project') return projectPanel(host);
    const t = TOOLS[UI.panel];
    const tile = (n) => { if (t.cards) { const m = FURN_BY_NAME.get(n); return `<button type="button" class="w2-card" data-tool="${esc(n)}" data-furn="${m.id}" aria-pressed="false" title="${esc(n)}: click it, then click in the Plan to place it"><span class="im"><img src="img/furniture/${m.id}.png" alt="" loading="lazy"></span><span>${esc(n)}</span></button>`; }
      const ic = TOOL_ICONS[n], k = TMAP[n]?.key; return `<button type="button" class="w2-tile" data-tool="${esc(n)}" aria-pressed="false" title="${esc(n)}${k ? ` (${k})` : ''}"><span class="im">${ic?.img ? `<img src="${ic.img}" alt="">` : ic?.svg || ''}</span><span>${esc(n)}${k ? ` <em>(${k})</em>` : ''}</span></button>`; };
    host.innerHTML = `<div class="pane w2-tools"><h2>${t.label}</h2>${t.sections.map(([h, items]) => `<div class="w2-sec"><h3>${esc(h)}</h3><div class="w2-grid">${items.map(tile).join('')}</div></div>`).join('')}
      <p class="note" id="toolMsg" role="status" aria-live="polite"></p></div>`;
    $$('[data-tool]', host).forEach((b) => b.onclick = () => startTool(b));
    toolUI();
  }
  function startTool(b) {
    const w = INST.plan.ready ? INST.plan.ws : null, msg = $('#toolMsg', app), n = b.dataset.tool; if (!w) { if (msg) msg.textContent = 'The Plan pane is still starting. Try again in a moment.'; return; }
    const st = w.state(), on = b.getAttribute('aria-pressed') === 'true';
    if (on) { w.tool({ tool: 'select' }); toolUI(); return; }   // a second click puts the tool down
    let spec = b.dataset.furn ? { furn: b.dataset.furn } : TMAP[n] || null;
    if (!spec && UI.panel === 'light') { const k = (LIGHTS || []).find(([, nm]) => nm === n); spec = k ? { light: k[0] } : null; }
    if (!spec) return; void st;
    if (UI.view !== 'plan') showView('plan');
    const okk = w.tool(spec); INST.plan.el.focus(); try { INST.plan.win.document.getElementById('cv').focus({ preventScroll: true }); } catch (e) { }
    if (msg) msg.textContent = !okk ? 'This tool could not start: see the message in the Plan pane.' : spec.furn ? `Click in the Plan to place the ${n}. Esc to stop.` : ON_WALL.has(spec.tool) ? `Click on a wall in the Plan to place the ${n.toLowerCase()}. It cuts its own opening and moves with the wall.` : spec.stair ? `Click in the Plan to place the ${n.toLowerCase()}.` : spec.light ? `Click in the Plan to place the ${n.toLowerCase()}.` : `${n}: draw in the Plan. ${spec.tool === 'wall' ? 'Click corner to corner, double-click to finish.' : spec.tool === 'room' || spec.tool === 'floor' || spec.tool === 'void' ? 'Drag a rectangle.' : spec.tool === 'arc' ? 'Click the start, the end, then the bend.' : 'Click the points, double-click to finish.'}`;
    toolUI();
  }
  function toolUI() {   // which tile is on: the Plan pane's own tool
    const w = INST.plan.ready ? INST.plan.ws : null; if (!w) return; const st = w.state();
    $$('#panelBody [data-tool]', app).forEach((b) => { const n = b.dataset.tool, s = b.dataset.furn ? { furn: b.dataset.furn } : TMAP[n]; let on = false;
      if (b.dataset.furn) on = st.tool === 'place' && st.pick === b.dataset.furn; else if (s?.stair) on = st.tool === 'place' && st.pick === s.stair; else if (s?.tool) on = st.tool === s.tool && (!s.opm || st.opm == null || st.opm === s.opm); else if (UI.panel === 'light') { const k = (LIGHTS || []).find(([, nm]) => nm === n); on = !!k && st.light === k[0]; }
      b.setAttribute('aria-pressed', String(on)); });
  }
  const toolT = setInterval(() => { if (!document.hidden) toolUI(); }, 500);
  $('#pDone', app).onclick = () => { showParams = false; rail(); panel(); };
  function projectPanel(host) {
    host.innerHTML = `<div class="pane"><h2>Project</h2>
      <select class="inp" id="proj" aria-label="Project">${S.projects().map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <p class="note">Site: ${esc(S.siteOf(p)?.label || '—')}${S.siteOf(p)?.sample ? ' (sample)' : ''} · north ${S.siteOf(p)?.north ?? 0}° · ${p.siteLinked === false ? 'this project\'s own site' : '<a href="#/account">from Account</a>'}</p><p class="note">${p.sample ? 'Sample project with mock results. Edits are kept in this browser.' : 'Stored in this browser.'}</p><div class="pc-ui-workspace-links"><a class="btn sm" href="#/workspace/${p.id}">Standard workspace</a><a class="btn sm" href="workspace.html">Plan Studio</a></div>
      <p class="note">Every view is Plan Studio (or the Shaded model). The full Plan Studio, with its own files and send-to-tool, still opens on its own: <a href="${PAGE('studio')}" target="_blank" rel="noopener">Plan Studio ↗</a></p></div>
    <div class="pane"><h2>Import model</h2>
      <div class="drop" id="drop"><button class="btn sm" id="pick">Import .obj · .stl · .glb</button><div style="margin-top:6px">or drop a file here · read locally</div></div>
      <input type="file" id="file" accept=".obj,.stl,.glb,.gltf" hidden>
      <div class="grid g2"><label class="f">Units<select id="unit"><option value="1">Metres</option><option value="0.001">Millimetres</option><option value="0.01">Centimetres</option><option value="0.3048">Feet</option></select></label>
        <label class="f">Up axis<select id="up"><option value="auto">File default</option><option value="z">Z up</option><option value="y">Y up</option></select></label></div>
      <p class="msg note" id="impMsg" role="status"></p>
      <p class="note">Meshes named like walls go to Walls, furniture to Furniture, windows to Glazing, slabs to Structure, roofs to Roof; the rest to Imported. Imported meshes show in the Shaded model view.</p></div>
    <div class="pane"><h2>Import site</h2>
      <button class="btn sm" id="siteBtn">Import site</button>
      <p class="note">Site geometry always goes on the Site layer, locked. Unlock it in Layers to edit.</p>
      <p class="note" id="siteMsg" role="status" aria-live="polite"></p></div>
    <div class="pane"><h2>Export</h2>
      <div class="w2-exp">${FORMATS.map(([k, n, d]) => `<button type="button" class="btn sm" data-exp="${k}" title="${esc(d)}">${esc(n)}</button>`).join('')}</div>
      <p class="note">Exports what is visible, in metres; hidden layers are left out. SketchUp's own .skp can only be written by SketchUp, so use the .dae, which SketchUp opens directly.</p>
      <p class="note" id="expMsg" role="status" aria-live="polite"></p></div>`;
    $('#proj', host).onchange = (e) => { location.hash = '#/workspace/' + e.target.value; };
    $('#siteBtn', host).onclick = () => { $('#siteMsg', host).textContent = 'Site import arrives in Step 2'; };
    $$('[data-exp]', host).forEach((b) => b.onclick = async () => {
      const k = b.dataset.exp, f = FORMATS.find((x) => x[0] === k), msg = $('#expMsg', host), base = p.name.replace(/\W+/g, '-').replace(/^-|-$/g, '');
      const save = (href, name) => { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
      if (k === 'png') { save(vp.png(), `${base}.png`); msg.textContent = 'Saved the Shaded view as PNG.'; return; }
      msg.textContent = `Writing ${f[1]}…`; b.disabled = true;
      try { const blob = await makeExport(k, renderModel(), p.name), url = URL.createObjectURL(blob); save(url, `${base}.${k}`); setTimeout(() => URL.revokeObjectURL(url), 4000);
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
  const ch = () => { persist(); drawShaded(false); layers(); selPane(); };
  // Plan Studio objects are deleted / duplicated by Plan Studio (so undo, wall openings and the other panes follow); the rest here
  const psDel = (ids) => { const w = INST.plan.ready ? INST.plan.ws : null; for (const id of ids) { const s = psSel(id); if (s && w && s.k !== 'room' && s.k !== 'roof' && s.k !== 'stair' && s.k !== 'misc') w.del(s); } };
  function delIds(ids) { const ps = ids.filter((id) => PS.test(id)), nat = new Set(ids.filter((id) => !PS.test(id))); if (nat.size) { M().components = M().components.filter((x) => !nat.has(x.id)); persist(); drawShaded(false); } psDel(ps); setSel([]); }
  // several selected: what they share, move them to a layer, delete them
  function multi(host) {
    const list = UI.sels.map(comp).filter(Boolean), byL = {}; for (const c of list) byL[c.layer] = (byL[c.layer] || 0) + 1;
    const nat = list.filter((c) => !PS.test(c.id));
    host.innerHTML = `<div class="pane"><h2>${list.length} selected <button class="btn sm" id="pBack">Done</button></h2>
      <p class="note">${Object.entries(byL).map(([l, n]) => `${n} on ${esc(l)}`).join(' · ')}</p>
      <div class="w2-mlist">${list.map((c) => `<button type="button" data-one="${c.id}" title="Edit only this one">${esc(c.name)}<small>${esc(c.layer)}</small></button>`).join('')}</div>
      ${nat.length ? `<label class="f">Move ${nat.length < list.length ? `the ${nat.length} imported` : 'all'} to layer<select id="mLayer"><option value="">Choose…</option>${M().layers.filter((l) => !l.locked).map((l) => `<option>${esc(l.name)}</option>`).join('')}</select></label>` : '<p class="note">Plan Studio objects keep their layers (walls on Walls, doors and windows on Glazing…).</p>'}
      <button class="btn danger" id="mDel">Delete ${list.length}</button></div>`;
    $('#pBack', host).onclick = () => { showParams = false; rail(); panel(); };
    $$('[data-one]', host).forEach((b) => b.onclick = () => setSel([b.dataset.one]));
    $('#mLayer', host)?.addEventListener('change', (e) => { if (!e.target.value) return; for (const c of nat) c.layer = e.target.value; open.add(e.target.value); ch(); setTimeout(panel, 0); });
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
      <p class="note">${c.mesh ? 'Imported mesh: position can change, size stays as imported. It shows in the Shaded pane; Plan Studio’s panes draw Plan Studio objects.' : 'A component kept from the earlier Workspace: it shows in the Shaded pane.'}</p></div>`;
    $('#pBack', host).onclick = () => { showParams = false; rail(); panel(); };
    $('#pName', host).onchange = (e) => { c.name = e.target.value.trim() || c.name; ch(); };
    $('#pLayer', host).onchange = (e) => { c.layer = e.target.value; open.add(c.layer); ch(); };
    $('#pType', host).onchange = (e) => { c.type = e.target.value; ch(); };
    $('#pMat', host).onchange = (e) => { c.mat = e.target.value; ch(); };
    $$('[data-g]', host).forEach((i) => i.onchange = () => { const v = parseFloat(i.value); if (!Number.isFinite(v) || ('wdh'.includes(i.dataset.g) && v <= 0)) { i.value = c.g[i.dataset.g]; return; } c.g[i.dataset.g] = v; ch(); });
  }

  // ---- right: layers (Rhino-style rows), selection, versions, next
  function layers() {
    const host = $('#layers', app), comps = M().components;
    for (const c of comps) if (!M().layers.find((l) => l.name === c.layer)) M().layers.push({ name: c.layer, color: LAYER_COLORS[c.layer] || '#ccc', visible: true, locked: false });
    const hid = (c) => { const s = psSel(c.id); return !!s && HIDDEN.has(s.id); };
    host.innerHTML = M().layers.map((l, i) => { const list = comps.filter((c) => c.layer === l.name), o = open.has(l.name), nh = list.filter(hid).length; return `<div class="w2-layer ${l.visible ? '' : 'off'} ${l.locked ? 'locked' : ''}">
      <div class="w2-lrow"><span class="sw" style="background:${l.color}"></span><button class="nm" data-open="${i}" aria-expanded="${o}">${o ? '▾' : '▸'} ${esc(l.name)}${nh ? ` <small class="w3-hidn">${nh} hidden</small>` : ''}</button><span class="cnt">${list.length}</span>
      <button class="ic" data-vis="${i}" title="${l.visible ? 'Hide' : 'Show'} ${esc(l.name)}" aria-label="${l.visible ? 'Hide' : 'Show'} ${esc(l.name)}" aria-pressed="${!l.visible}">${l.visible ? EYE_ON : EYE_OFF}</button>
      <button class="ic" data-lock="${i}" title="${l.locked ? 'Unlock' : 'Lock'} ${esc(l.name)}" aria-label="${l.locked ? 'Unlock' : 'Lock'} ${esc(l.name)}" aria-pressed="${l.locked}">${l.locked ? LOCK_ON : LOCK_OFF}</button></div>
      ${o ? `<div class="comps">${list.map((c) => { const h = hid(c), dis = l.locked || !l.visible || h; return `<div class="w3-crow${h ? ' hid' : ''}"><button data-sel="${c.id}" aria-current="${isSel(c.id)}" ${dis ? `aria-disabled="true" title="${h ? 'Hidden piece: show it with the eye' : l.locked ? 'Locked layer: unlock it to select' : 'Hidden layer: show it to select'}"` : 'title="Shift-click adds, Ctrl-click removes"'}>${esc(c.name)}</button>${psSel(c.id)?.k === 'furn' ? `<button class="ic sm" data-pshide="${esc(c.id)}" aria-pressed="${h}" title="${h ? 'Show this piece again' : 'Hide this piece'}" aria-label="${h ? 'Show' : 'Hide'} ${esc(c.name)}">${h ? EYE_OFF : EYE_ON}</button>` : ''}</div>`; }).join('') || '<span class="note">Empty</span>'}</div>` : ''}</div>`; }).join('');
    $$('[data-open]', host).forEach((b) => b.onclick = () => { const n = M().layers[b.dataset.open].name; open.has(n) ? open.delete(n) : open.add(n); UI.open = [...open]; saveUI(); layers(); });
    $$('[data-vis]', host).forEach((b) => b.onclick = () => { const l = M().layers[b.dataset.vis]; l.visible = !l.visible; persist(); const map = layerVis(); for (const I2 of ready()) I2.ws.layers(map); drawShaded(false);
      if (!l.visible && UI.sels.some((id) => comp(id)?.layer === l.name)) setSel(UI.sels.filter((id) => comp(id)?.layer !== l.name)); else { vp.select(UI.sels); layers(); } });
    $$('[data-lock]', host).forEach((b) => b.onclick = () => { const l = M().layers[b.dataset.lock]; l.locked = !l.locked; persist(); const lk = lockList(); for (const I2 of ready()) I2.ws.setLocks(lk);
      if (l.locked && UI.sels.some((id) => comp(id)?.layer === l.name)) setSel(UI.sels.filter((id) => comp(id)?.layer !== l.name)); else layers(); });
    $$('[data-sel]', host).forEach((b) => b.onclick = (e) => { if (b.getAttribute('aria-disabled') === 'true') return; pick(b.dataset.sel, { add: e.shiftKey, remove: e.ctrlKey || e.metaKey }); });
    $$('[data-pshide]', host).forEach((b) => b.onclick = () => { const s = psSel(b.dataset.pshide), w = INST.plan.ready ? INST.plan.ws : null; if (!s || !w) return; w.hide(s.id, !HIDDEN.has(s.id)); });
  }
  function selPane() {
    const host = $('#selp', app), list = UI.sels.map(comp).filter(Boolean), c = list.at(-1);
    if (!c) { host.innerHTML = `<h2>Selection</h2><p class="note">Click an object in any pane or in the layer list, or drag a box in the Shaded view. ${M().components.length} components on ${M().layers.length} layers.</p>`; return; }
    if (list.length > 1) {
      host.innerHTML = `<h2>Selection <button class="btn sm" id="desel">Clear</button></h2><p style="font-weight:600">${list.length} components</p><p class="note">${esc(list.map((x) => x.name).slice(0, 4).join(', '))}${list.length > 4 ? ` and ${list.length - 4} more` : ''}</p>
        <button class="btn sm" id="edit">Edit selection</button><button class="btn danger" id="del">Delete ${list.length}</button>`;
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
    $$('[data-load]', app).forEach((b) => b.onclick = () => { if (dirty() && !confirm('Discard unsaved changes and open this version?')) return; p.draft = S.clone(S.version(p, b.dataset.load).model); const conv = ensureStudio(p); persist(); loadAll(); setSel([]); toast(conv ? 'Version opened (converted to Plan Studio’s model)' : 'Version opened'); });
    $$('[data-simv]', app).forEach((a) => a.onclick = () => setCurrentVersion(p, a.dataset.simv));
    $('#toSim', app).href = '#/simulations'; $('#toSim', app).onclick = () => { if (last()) setCurrentVersion(p, last().id); };
  }
  function loadAll() { SNAP = JSON.stringify(p.draft.studio); for (const I2 of ready()) { const back = I2.ws.load(SNAP); if (I2 === INST.plan && back !== SNAP) { SNAP = back; p.draft.studio = JSON.parse(back); } tell(I2); } vpFitted = false; derive(false); levelUI(); refresh(true); }
  $('#addLayer', app).onclick = () => { const name = prompt('Layer name'); if (!name || M().layers.find((l) => l.name === name.trim())) return; M().layers.push({ name: name.trim(), color: '#cfcac0', visible: true, locked: false }); open.add(name.trim()); persist(); layers(); };
  $('#saveV', app).onclick = () => { if (!dirty() && last()) { toast('No changes since v' + last().n); return; } const v = S.saveVersion(p, $('#note', app).value.trim()); $('#note', app).value = ''; state(); toast(`Saved v${v.n}`); };

  // ---- status bar: snaps for the Plan pane's drawing and the gumball, the gumball itself, clearance in Plan and Shaded
  $$('[data-snap]', app).forEach((i) => i.onchange = () => { UI.snap[i.dataset.snap] = i.checked; saveUI(); for (const I2 of ready()) I2.ws.snaps(UI.snap); });
  $$('[data-sw]', app).forEach((b) => b.onclick = () => { const k = b.dataset.sw; UI[k] = !UI[k]; b.setAttribute('aria-checked', String(UI[k])); saveUI();
    for (const I2 of ready()) { if (k === 'clearance') I2.ws.clearance(UI.clearance); if (k === 'gumball') I2.ws.gumball(UI.gumball); }
    if (k === 'clearance') clearance(); });
  // Esc clears the selection (not while typing)
  const onKey = (e) => { if (e.target.closest?.('input,select,textarea')) return; if (e.key === 'Escape' && UI.sels.length) setSel([]); };
  addEventListener('keydown', onKey);

  subs.push((ids) => vp.select(ids), () => layers(), () => selPane(), () => { rail(); panel(); });
  function refresh(refit) { drawShaded(refit); layers(); selPane(); state(); }

  // first paint: whatever the draft has (imported meshes, site); the panes add Plan Studio's objects as soon as they start
  drawShaded(true); showView(UI.view);
  state(); layers(); selPane(); rail(); panel();
  setSel(UI.selProject === p.id ? UI.sels.filter((id) => comp(id)) : [], { params: false });
  // read-only hook for the browser checks in tests
  window.__ws2 = { vp, UI, sel: () => primary(), sels: () => [...UI.sels], model: () => p.draft, inst: INST, objects: () => OBJ, hub, renderModel, ready: () => INST.plan.ready && INST.persp.ready && INST.props.ready && OBJ.length > 0 };
  (async () => { for (let i = 0; i < 60 && !LIGHTS; i++) { if (INST.plan.ready) LIGHTS = INST.plan.ws.lights(); else await new Promise((r) => setTimeout(r, 250)); } })();
  return () => { dead = true; document.removeEventListener('click', outside); clearInterval(paneT); clearInterval(toolT); removeEventListener('keydown', onKey); vp.dispose(); if (window.__wsHub === hub) delete window.__wsHub; delete window.__ws2; };
}
