// A Workspace version as a Plan Studio model (emb/modeler.html, model format v2), so Plan Studio can produce the exact
// scene each simulation engine reads (its own STC.planScene, the same as Send to Simulation).
//   walls   → wall centre lines with their thickness (a box becomes a wall along its long side)
//   windows → openings on the wall they sit in (centre along the wall, sill and head above the level)
//   rooms   → room names at their centres (Plan Studio finds rooms from the walls)
//   slabs   → floors;  furniture → furniture (Plan Studio pieces keep their kind and parameters)
//   site   → north, and the prevailing wind (direction and mean speed) from Account as the model's climate
// Doors: the Workspace has no door tool yet; an opening named "door", or one that starts at the floor, goes as a door.
import { levelsOf } from './viewport2.js';

const r3 = (v) => +(+v).toFixed(3);
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const windFrom = (site) => { const k = COMPASS.indexOf(String(site?.windDir || '').toUpperCase()); return k < 0 ? 225 : k * 22.5; };
export function toStudio(model, site, { name = 'Project', id = 'ws' } = {}) {
  const vis = new Set(model.layers.filter((l) => l.visible !== false).map((l) => l.name)), C = model.components.filter((c) => vis.has(c.layer));
  const lv = levelsOf(model), wallsC = C.filter((c) => c.type === 'wall');
  const levelOf = (z) => { let k = 0; lv.forEach((L, i) => { if (z >= L.z - 0.3) k = i; }); return k; };
  const levels = lv.map((L, i) => { const top = lv[i + 1]?.z, ws = wallsC.filter((w) => levelOf(w.g.z) === i), h = top != null ? top - L.z : ws.length ? Math.max(...ws.map((w) => w.g.z + w.g.h)) - L.z : 3;
    return { id: 'L' + (i + 1), name: `Level ${i + 1}`, z: r3(L.z), h: r3(Math.max(2.2, h)) }; });
  const walls = wallsC.map((c) => { const g = c.g, alongX = g.w >= g.d, t = alongX ? g.d : g.w, L = levels[levelOf(g.z)];
    const a = alongX ? [g.x + t / 2, g.y + g.d / 2] : [g.x + g.w / 2, g.y + t / 2], b = alongX ? [g.x + g.w - t / 2, g.y + g.d / 2] : [g.x + g.w / 2, g.y + g.d - t / 2];
    return { id: c.id, lv: L.id, a: a.map(r3), b: b.map(r3), t: r3(t), h: r3(g.z + g.h - L.z), object_type: 'wall', layer: 'Wall', name: c.name }; });
  // boxes meet at their faces, centre lines don't: an end that runs into a crossing wall moves onto that wall's centre line,
  // so corners and T-junctions close (Plan Studio and the engines find rooms from connected centre lines)
  const horiz = (w) => Math.abs(w.b[1] - w.a[1]) < 1e-6;
  for (const w of walls) for (const k of ['a', 'b']) {
    const P = w[k], hw = horiz(w), i = hw ? 0 : 1, j = 1 - i;   // i: the axis the wall runs along
    let best = null;
    for (const v of walls) { if (v === w || v.lv !== w.lv || horiz(v) === hw) continue;
      const c = v.a[i], lo = Math.min(v.a[j], v.b[j]) - v.t / 2 - 1e-6, hi = Math.max(v.a[j], v.b[j]) + v.t / 2 + 1e-6, d = Math.abs(P[i] - c);
      if (P[j] >= lo && P[j] <= hi && d <= (w.t + v.t) / 2 + 0.05 && (!best || d < best.d)) best = { d, c }; }
    if (best) P[i] = r3(best.c);
  }
  // each window goes on the wall whose footprint it overlaps most
  const ops = [];
  for (const c of C.filter((x) => x.type === 'window')) {
    const g = c.g, ov = (w) => { const W = wallsC.find((x) => x.id === w.id).g; return Math.max(0, Math.min(g.x + g.w, W.x + W.w) - Math.max(g.x, W.x)) * Math.max(0, Math.min(g.y + g.d, W.y + W.d) - Math.max(g.y, W.y)); };
    const host = walls.map((w) => [w, ov(w)]).filter(([, a]) => a > 0).sort((p, q) => q[1] - p[1])[0]?.[0]; if (!host) continue;
    const L = levels.find((l) => l.id === host.lv), dx = host.b[0] - host.a[0], dy = host.b[1] - host.a[1], len = Math.hypot(dx, dy), cx = g.x + g.w / 2, cy = g.y + g.d / 2;
    const pos = ((cx - host.a[0]) * dx + (cy - host.a[1]) * dy) / (len || 1), w = Math.abs(dx) >= Math.abs(dy) ? g.w : g.d;
    const door = /door/i.test(c.name) || g.z - L.z < 0.05;
    ops.push({ id: c.id, wall: host.id, pos: r3(Math.max(w / 2, Math.min(len - w / 2, pos))), w: r3(Math.min(w, len)), kind: door ? 'door' : 'win', sill: door ? 0 : r3(g.z - L.z), head: r3(g.z + g.h - L.z), open: 0.5, flip: 1, object_type: door ? 'door' : 'window', layer: 'Wall', name: c.name });
  }
  const floors = C.filter((c) => c.type === 'slab').map((c) => { const L = levels[levelOf(c.g.z + c.g.h)]; return { id: c.id, lv: L.id, x: r3(c.g.x), y: r3(c.g.y), w: r3(c.g.w), d: r3(c.g.d), object_type: 'floor', layer: 'Floor' }; });
  const names = C.filter((c) => c.type === 'room').map((c) => ({ lv: levels[levelOf(c.g.z)].id, x: r3(c.g.x + c.g.w / 2), y: r3(c.g.y + c.g.d / 2), name: c.name }));
  const furn = C.filter((c) => c.type === 'furniture').map((c) => { const L = levels[levelOf(c.g.z)];
    return { id: c.id, lv: L.id, type: c.furn || 'box', x: r3(c.g.x + c.g.w / 2), y: r3(c.g.y + c.g.d / 2), w: r3(c.g.w), d: r3(c.g.d), h: r3(c.g.h), rot: 0, object_type: 'furniture', layer: 'Furniture', name: c.name, ...(c.furn ? { gen: { id: c.furn, vals: c.params || {} } } : {}) }; });
  return { v: 2, units: 'm', version: 0, id, name, north: site?.north || 0,
    climate: { from: windFrom(site), U10: Number.isFinite(site?.wind) ? site.wind : 3.5, terrain: 'suburban', Tout: 18, Tin: 24 }, targets: { ach: 5, df: 2, view: 0.75 },
    levels, walls, fences: [], ops, floors, voids: [], furn, names, ceil: [], notes: [], hiddenIds: [], lights: [] };
}
