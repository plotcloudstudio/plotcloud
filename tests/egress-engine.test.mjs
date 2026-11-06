// Hospital evacuation engine (mvp/js/interior/egress.js) on a synthetic three-floor ward block: a central corridor with one
// cross-corridor smoke door, four two-bed wards on each side, a stair at the east end, the exit on the ground floor.
import test from 'node:test'; import assert from 'node:assert/strict';
import * as E from '../mvp/js/interior/egress.js';
export function wardBlock(n = 3) {
  const lv = (i) => { const walls = [], open = [], rooms = [], furn = [], wall = (a, b) => walls.push({ a, b, h: 3, t: 0.2 }), door = (id, a, b, ext = false) => open.push({ id, a, b, kind: 'door', ext });
    wall([1, 1], [37, 1]); wall([37, 1], [37, 13]); wall([37, 13], [1, 13]); wall([1, 13], [1, 1]); wall([1, 6], [33, 6]); wall([1, 8], [33, 8]); wall([33, 1], [33, 13]); wall([17, 6], [17, 8]);
    for (const x of [9, 17, 25]) { wall([x, 1], [x, 6]); wall([x, 8], [x, 13]); }
    rooms.push({ id: 'cw' + i, name: 'Corridor', rects: [[1, 6, 32, 2]] }, { id: 'st' + i, name: 'Stair', rects: [[33, 1, 4, 12]] });
    for (const [k, x] of [1, 9, 17, 25].entries()) { rooms.push({ id: `ws${i}${k}`, name: `Ward ${i + 1}S${k + 1}`, rects: [[x, 1, 8, 5]] }, { id: `wn${i}${k}`, name: `Ward ${i + 1}N${k + 1}`, rects: [[x, 8, 8, 5]] });
      door(`ds${i}${k}`, [x + 3.4, 6], [x + 4.6, 6]); door(`dn${i}${k}`, [x + 3.4, 8], [x + 4.6, 8]);
      for (const bx of [x + 1, x + 5.5]) { furn.push({ id: `b${i}${k}s${bx}`, x: bx, y: 2, w: 1, d: 2.1, h: 0.6, name: 'Bed' }, { id: `b${i}${k}n${bx}`, x: bx, y: 10, w: 1, d: 2.1, h: 0.6, name: 'Bed' }); } }
    door('smoke' + i, [17, 6.2], [17, 7.8]); door('stair' + i, [33, 6.3], [33, 7.7]); if (!i) door('exit', [1, 6.2], [1, 7.8], true);
    return { id: 'L' + i, name: 'Level ' + (i + 1), z: i * 4, h: 4, sc: { bounds: { w: 38, h: 14 }, origin: [0, 0], walls, open, rooms, furn } }; };
  const levels = Array.from({ length: n }, (_, i) => lv(i)), stairs = [];
  for (let i = 0; i < n - 1; i++) stairs.push({ id: 'S' + i, lv: 'L' + i, top: 'L' + (i + 1), corners: [[34, 3], [35.4, 3], [35.4, 11], [34, 11]], w: 1.4, d: 8, name: 'Stair' });
  return { levels, stairs };
}
test('the ward block: compartments, stairs and the population are found', () => {
  const B = E.prepare(wardBlock()), pop = E.population(B);
  assert.deepEqual(B.levels.map((L) => L.nComp), [2, 2, 2], 'the smoke door splits each floor in two');
  assert.equal(B.stairs.length, 2); assert.equal(B.exitLv, 0); assert(B.stairs.every((s) => s.acc[s.lo].length && s.acc[s.hi].length));
  assert.equal(pop.pats.length, 3 * 8 * 2, 'two beds in each of 24 wards'); assert.equal(pop.staff.length, 3 * 4);
});
test('horizontal relocation: the fire compartment moves through the smoke door, repeatably', () => {
  const B = E.prepare(wardBlock()), pop = E.population(B), a = E.simulate(B, pop, 11, { strategy: 'horizontal' });
  for (const d of B.doors) d.tokens = 0; const b = E.simulate(B, pop, 11, { strategy: 'horizontal' });
  assert(a.fire.horiz && Number.isFinite(a.t1) && a.t1 > 60 && a.t1 < 3000, JSON.stringify({ t1: a.t1, fire: a.fire })); assert.equal(a.unfinished, 0); assert.equal(a.stuck, 0);
  assert.equal(a.t1, b.t1, 'the same seed gives the same run');
  const moved = a.pats.filter((p) => p.moved); assert.equal(moved.length, 8, 'the eight patients of one compartment move'); assert(moved.every((p) => p.li === a.fire.li));
});
test('then down the stairs: the fire floor and those above leave by the stair and the exit', async () => {
  const out = await E.run(wardBlock(), { strategy: 'down', runs: 4, seed: 3 });
  for (const x of out.runs) { assert.equal(x.unfinished, 0, JSON.stringify(x.fire)); assert(x.t2 > x.t1, `${x.t2} > ${x.t1}`); }
  assert(out.runs.some((x) => x.stairMax.some((q) => q > 0)), 'people queue for the stair');
  assert(out.rep.frames.length > 50 && out.rep.frames[0].length === (out.rep.nPat + out.rep.nStaff) * 5);
  console.log(`down: P50 ${out.med.toFixed(0)} s, P90 ${out.p90.toFixed(0)} s; stage 1 ${out.runs.map((x) => x.t1.toFixed(0)).join('/')} s`);
});
