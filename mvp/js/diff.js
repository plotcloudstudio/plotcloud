// What changed between two versions, component by component — the one data layer Results' compare draws from:
// the colours in both views, the change list, the counts that must match, and (with the saved results) the simulation deltas.
//   Plan Studio objects are matched by their Plan Studio id (walls, doors / windows / openings, furniture, slabs, floor
//   openings, fences, lights, ceiling items); anything else in the model (imported meshes, site, older components) by its id.
//   Rooms, automatic floors and the roof are made by Plan Studio from the walls, so they follow the walls and are not listed.
// Each version's model comes from Plan Studio itself (studio-bridge: the version's own Plan Studio model, or an older version
// converted), so the ids and the geometry are the ones Plan Studio draws.
import { studioMeshes } from './studio-bridge.js';
import { MODELS } from '../../furniture/models.js';
import { LAYER_COLORS } from './data.js';

export const PS = /^ps:([a-z]+):(.*)$/;
const ARR = { wall: 'walls', op: 'ops', furn: 'furn', floor: 'floors', void: 'voids', fence: 'fences', light: 'lights', ceil: 'ceil' };
const KLAYER = { wall: 'Walls', fence: 'Walls', op: 'Glazing', floor: 'Structure', void: 'Structure', stair: 'Structure', furn: 'Furniture', room: 'Rooms', light: 'Lighting', ceil: 'Lighting', roof: 'Roof', misc: 'Structure' };
const KTYPE = { wall: 'wall', fence: 'wall', op: 'window', floor: 'slab', void: 'slab', stair: 'slab', furn: 'furniture', light: 'furniture', ceil: 'furniture', roof: 'roof', misc: 'imported' };
const DOORS = { ext: 'Exterior door', int: 'Interior door', exit: 'Exit door', acc: 'Accessible door', win: 'Window' };
const CONV = new Set(['wall', 'window', 'slab', 'room', 'furniture', 'roof']);   // what an older version gave to Plan Studio
const len = (w) => Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
export function nameOf(k, o) {
  if (!o) return k;
  if (k === 'wall') return `Wall ${len(o).toFixed(2)} m`;
  if (k === 'op') return o.hole ? 'Wall opening' : DOORS[o.gen?.id] || (o.kind === 'door' ? 'Door' : 'Window');
  if (k === 'furn') return (o.gen && MODELS.find((m) => m.id === o.gen.id)?.en) || o.label || o.name || 'Furniture';
  return { floor: 'Floor slab', void: 'Floor opening', fence: 'Fence', light: 'Light', ceil: 'Ceiling item' }[k] || k;
}
// the objects a person made in Plan Studio (what the diff lists)
function authored(st) {
  const out = new Map();
  for (const [k, arr] of Object.entries(ARR)) for (const o of st[arr] || []) { if (k === 'floor' && o.auto) continue; out.set(`ps:${k}:${o.id}`, { k, o }); }
  return out;
}
const natives = (model) => model.components.filter((c) => !PS.test(c.id) && (model.studio ? true : (c.mesh || !CONV.has(c.type))));

// ---- comparing two objects: which kinds of property differ
const IGN = new Set(['semanticCategory', 'semanticSource', 'semantic', 'layer', 'id', 'mid', 'locked']);
const GROUP = { a: 'position', b: 'position', x: 'position', y: 'position', z: 'position', pos: 'position', wall: 'position', points: 'position', lv: 'level',
  w: 'size', d: 'size', h: 'size', t: 'size', sill: 'size', head: 'size', thickness: 'size', rot: 'rotation', mirror: 'rotation', kind: 'category', type: 'category', object_type: 'category', hole: 'category' };
const same = (a, b) => (typeof a === 'number' && typeof b === 'number') ? Math.abs(a - b) < 1e-4 : JSON.stringify(a) === JSON.stringify(b);
const show = (v) => typeof v === 'number' ? (+v.toFixed(3)).toString() : Array.isArray(v) ? (v.length <= 2 && v.every((x) => typeof x === 'number') ? v.map((x) => +x.toFixed(2)).join(', ') : `${v.length} points`) : v == null ? '—' : String(v);
function objDiff(A, B) {
  const what = [];
  for (const key of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (IGN.has(key)) continue;
    if (key === 'gen') { const ga = A.gen || {}, gb = B.gen || {}; if (ga.id !== gb.id) what.push({ g: 'category', t: `kind ${ga.id || '—'} → ${gb.id || '—'}` });
      else for (const k of new Set([...Object.keys(ga.vals || {}), ...Object.keys(gb.vals || {})])) if (!same(ga.vals?.[k], gb.vals?.[k])) what.push({ g: 'parameter', t: `${k} ${show(ga.vals?.[k])} → ${show(gb.vals?.[k])}` }); continue; }
    if (!same(A[key], B[key])) what.push({ g: GROUP[key] || 'parameter', t: `${key} ${show(A[key])} → ${show(B[key])}` });
  }
  return what;
}
function compDiff(A, B) {
  const what = [];
  for (const k of ['x', 'y', 'z']) if (!same(A.g[k], B.g[k])) what.push({ g: 'position', t: `${k} ${show(A.g[k])} → ${show(B.g[k])} m` });
  for (const k of ['w', 'd', 'h']) if (!same(A.g[k], B.g[k])) what.push({ g: 'size', t: `${k} ${show(A.g[k])} → ${show(B.g[k])} m` });
  if (A.type !== B.type) what.push({ g: 'category', t: `type ${A.type} → ${B.type}` });
  if (A.layer !== B.layer) what.push({ g: 'layer', t: `layer ${A.layer} → ${B.layer}` });
  for (const k of ['mat', 'furn']) if (!same(A[k], B[k])) what.push({ g: 'parameter', t: `${k} ${show(A[k])} → ${show(B[k])}` });
  for (const k of ['params', 'room']) if (!same(A[k], B[k])) what.push({ g: 'parameter', t: `${k} changed` });
  return what;
}

// ---- a version as Plan Studio draws it: components with meshes (local to their box), plus the version's other components
export async function versionScene(version, site, name) {
  const { studio, meshes } = await studioMeshes(version, site, name), comps = [];
  for (const m of meshes) {
    if (!m.pos.length) continue; const k = ARR[m.k] ? m.k : m.id === 'roof' ? 'roof' : m.id === 'stair' ? 'stair' : 'misc', P = m.pos;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < P.length; i += 3) { if (P[i] < x0) x0 = P[i]; if (P[i] > x1) x1 = P[i]; if (P[i + 1] < y0) y0 = P[i + 1]; if (P[i + 1] > y1) y1 = P[i + 1]; if (P[i + 2] < z0) z0 = P[i + 2]; if (P[i + 2] > z1) z1 = P[i + 2]; }
    const loc = new Float32Array(P.length); for (let i = 0; i < P.length; i += 3) { loc[i] = P[i] - x0; loc[i + 1] = P[i + 1] - y0; loc[i + 2] = P[i + 2] - z0; }
    const obj = ARR[m.k] ? (studio[ARR[m.k]] || []).find((o) => String(o.id) === m.id) : null;
    comps.push({ id: ARR[m.k] ? `ps:${m.k}:${m.id}` : `ps:${k}:${m.id}`, name: ARR[m.k] ? nameOf(m.k, obj) : m.id === 'roof' ? 'Roof' : m.id === 'stair' ? 'Stairs' : m.id,
      type: m.k === 'op' ? (obj?.kind === 'door' ? 'door' : 'window') : KTYPE[k] || 'imported', layer: KLAYER[k] || 'Structure', mat: k === 'wall' ? 'Plaster' : 'Concrete',
      g: { x: x0, y: y0, z: z0, w: Math.max(0.01, x1 - x0), d: Math.max(0.01, y1 - y0), h: Math.max(0.01, z1 - z0) }, mesh: loc, meshCol: m.col, glass: m.glass });
  }
  const nat = natives(version.model), layers = version.model.layers.map((l) => ({ ...l }));
  for (const c of [...comps, ...nat]) if (!layers.find((l) => l.name === c.layer)) layers.push({ name: c.layer, color: LAYER_COLORS[c.layer] || '#cfcac0', visible: true, locked: false });
  return { studio, model: { units: 'm', layers, components: [...nat, ...comps] } };
}

// ---- the diff: one item per changed component, the same list for the views, the change list and the counts
export function diff(a, b) {
  const items = [], A = authored(a.studio), B = authored(b.studio);
  for (const [id, x] of B) { const y = A.get(id); if (!y) { items.push({ id, change: 'added', name: nameOf(x.k, x.o), layer: KLAYER[x.k], what: [] }); continue; }
    const what = objDiff(y.o, x.o); if (what.length) items.push({ id, change: 'modified', name: nameOf(x.k, x.o), layer: KLAYER[x.k], what }); }
  for (const [id, y] of A) if (!B.has(id)) items.push({ id, change: 'removed', name: nameOf(y.k, y.o), layer: KLAYER[y.k], what: [] });
  const NA = new Map(natives(a.model).map((c) => [c.id, c])), NB = new Map(natives(b.model).map((c) => [c.id, c]));
  for (const [id, c] of NB) { const o = NA.get(id); if (!o) items.push({ id, change: 'added', name: c.name, layer: c.layer, what: [] }); else { const what = compDiff(o, c); if (what.length) items.push({ id, change: 'modified', name: c.name, layer: c.layer, what }); } }
  for (const [id, c] of NA) if (!NB.has(id)) items.push({ id, change: 'removed', name: c.name, layer: c.layer, what: [] });
  const order = { modified: 0, added: 1, removed: 2 }; items.sort((p, q) => order[p.change] - order[q.change] || p.name.localeCompare(q.name));
  return items;
}
export const COLORS = { modified: 0xf2c200, added: 0x2fa84f, removed: 0xd8402a };

// ---- simulation results of two versions, value by value (the figures) and point by point (the result field)
const num = (s) => { const m = String(s ?? '').replace(/,(?=\d{3}\b)/g, '').match(/-?\d+(\.\d+)?/); return m ? +m[0] : NaN; };
export function figureRows(sim, ra, rb) {
  const rows = [], seen = new Set();
  for (const [k, label, unit, d] of sim.metrics) { seen.add(label.toLowerCase()); rows.push({ label, unit, d, a: ra?.results?.[k], b: rb?.results?.[k] }); }
  const kp = (r) => new Map((r?.results?.kpis || []).map(([l, v]) => [l, v]));
  const KA = kp(ra), KB = kp(rb);
  for (const l of new Set([...KA.keys(), ...KB.keys()])) { if (seen.has(l.toLowerCase())) continue; const a = num(KA.get(l)), b = num(KB.get(l)); if (!Number.isFinite(a) && !Number.isFinite(b)) continue;
    const u = String(KA.get(l) ?? KB.get(l) ?? '').replace(/^[^\d-]*-?\d+(\.\d+)?\s*/, '').slice(0, 10); rows.push({ label: l, unit: u, d: 2, a, b }); }
  return rows;
}
// for each point of B, the nearest point of A within a cell: the delta, and whether it passes the threshold
export function fieldDiff(fa, fb, { threshold = 0, pct = false } = {}) {
  if (!fa?.pts?.length || !fb?.pts?.length) return null;
  const step = Math.max(fa.step || 0.5, fb.step || 0.5), key = (x, y) => Math.round(x / step) + ',' + Math.round(y / step), grid = new Map();
  for (let i = 0; i < fa.pts.length; i += 3) grid.set(key(fa.pts[i], fa.pts[i + 1]), i);
  const cells = [], usedA = new Set(); let changed = 0, matched = 0;
  for (let i = 0; i < fb.pts.length; i += 3) {
    const x = fb.pts[i], y = fb.pts[i + 1], vb = fb.pts[i + 2]; let j = grid.get(key(x, y));
    if (j == null) { let best = Infinity; const kx = Math.round(x / step), ky = Math.round(y / step); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const q = grid.get((kx + dx) + ',' + (ky + dy)); if (q != null) { const d = Math.hypot(fa.pts[q] - x, fa.pts[q + 1] - y); if (d < best) { best = d; j = q; } } } }
    if (j == null) { cells.push({ x, y, a: NaN, b: vb, d: NaN, on: true, onlyB: true }); changed++; continue; }
    usedA.add(j); const va = fa.pts[j + 2], d = vb - va, rel = Math.abs(va) > 1e-9 ? d / Math.abs(va) * 100 : (d ? Infinity : 0); matched++;
    const on = (pct ? Math.abs(rel) : Math.abs(d)) >= threshold && Math.abs(d) > 1e-9; if (on) changed++;
    cells.push({ x, y, a: va, b: vb, d, rel, on });
  }
  // points with a result in A only (the area is no longer analysed in B, e.g. a room that is no longer closed) count as changed too
  for (let i = 0; i < fa.pts.length; i += 3) if (!usedA.has(i)) { cells.push({ x: fa.pts[i], y: fa.pts[i + 1], a: fa.pts[i + 2], b: NaN, d: NaN, on: true, onlyA: true }); changed++; }
  return { cells, changed, matched, step };
}
