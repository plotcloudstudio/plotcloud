// Arc walls (2026-11-07): one wall bent by its bulge. The engine gives its length along the arc and points on it, places openings
// on it, and the studies see it as short straight walls (a room closed by it has the area of the true shape).
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const html = fs.readFileSync(new URL('../emb/modeler.html', import.meta.url), 'utf8'), start = html.indexOf('const STC = (() => {'), end = html.indexOf('\n})();', start) + 6, STC = Function(html.slice(start, end) + ';return STC;')();
// a 6 × 4 m room whose south side is a half circle of radius 3 m bulging out (a bulge of 1 = a half circle)
const model = () => ({ units: 'm', north: 0, levels: [{ id: 'L1', name: 'L1', z: 0, h: 3 }], walls: [
  { id: 'n', lv: 'L1', a: [6, 4], b: [0, 4], t: 0.2 }, { id: 'w', lv: 'L1', a: [0, 4], b: [0, 0], t: 0.2 }, { id: 'e', lv: 'L1', a: [6, 0], b: [6, 4], t: 0.2 },
  { id: 'arc', lv: 'L1', a: [0, 0], b: [6, 0], t: 0.2, bulge: 1 }],
  ops: [{ id: 'win', wall: 'arc', pos: 4.712, w: 1.2, kind: 'win', sill: 0.9, head: 2.1, open: 0.5 }], floors: [], voids: [], furn: [], names: [{ lv: 'L1', name: 'Round room', x: 3, y: 2 }], masses: [], fences: [], ceil: [], lights: [] });
test('the arc: centre, radius, length, points and the window on it', () => {
  const M = model(), w = M.walls[3], A = STC.arcOf(w);
  assert(Math.abs(A.r - 3) < 1e-9 && Math.abs(A.c[0] - 3) < 1e-9 && Math.abs(A.c[1]) < 1e-9, JSON.stringify(A));
  assert(Math.abs(STC.wallLen(w) - 3 * Math.PI) < 1e-9, 'length along the arc');
  const mid = STC.arcAt(w, STC.wallLen(w) / 2); assert(Math.abs(mid[0] - 3) < 1e-9 && Math.abs(mid[1] + 3) < 1e-9, 'a bulge above 0 bends to the right of a → b (south here): ' + mid);
  const p = STC.opPoint(w, M.ops[0]); assert(Math.abs(Math.hypot(p[0] - 3, p[1]) - 3) < 1e-9, 'the window sits on the arc');
  const h = STC.wallAt(M, 'L1', [3.05, -2.95]); assert.equal(h.w.id, 'arc'); assert(Math.abs(h.pos - 3 * Math.PI / 2) < 0.1, 'a click near the middle of the arc');
});
test('the studies see short straight walls; the room has the area of the true shape', () => {
  const M = STC.migrate(model()), v = STC.validate(M); assert.deepEqual(v.errors, []);
  const room = v.S.rooms.find((r) => r.name === 'Round room'); assert(room, JSON.stringify(v.S.rooms.map((r) => r.name)));
  const exact = (6 - 0.2) * (4 - 0.2) + Math.PI * (3 - 0.1) ** 2 / 2;   // inside the walls' faces
  assert(Math.abs(room.area - exact) / exact < 0.03, `area ${room.area.toFixed(2)} m² against ${exact.toFixed(2)} m²`);
  const N = STC.expandArcs(M), pieces = N.walls.filter((w) => w.parent === 'arc'), win = N.ops.find((o) => o.id === 'win'), host = N.walls.find((w) => w.id === win.wall);
  assert(pieces.length >= 18 && host.parent === 'arc', 'about 0.5 m pieces'); assert(Math.abs(STC.wallLen(host) - 1.2) < 0.02, 'the window keeps one straight piece of its own width');
  assert.equal(M.walls.length, 4, 'the model itself keeps one arc wall');
  const d = STC.daylight(M, v.S, { step: 0.5, wp: 0.8, tau: 0.7 }), south = d.pts.filter((q) => q.y < -1.5); assert(south.length > 10, 'the daylight grid fills the curved part of the room');
});
