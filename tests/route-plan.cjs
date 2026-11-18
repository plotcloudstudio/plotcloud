// Driving round obstacles (2026-11-18), no browser: mvp/js/route-plan.js with the swept-path engine.
// 1 a box truck drawn straight through a 6 × 6 m block: the drawn route is blocked; the planned path goes round it, every point
//   at least half the truck's width plus the clearance from it, and the simulated drive along it has no collision;
// 2 the same with a route of three points (a turn after the block): through the middle point, round the block, no collision;
// 3 a semi-trailer round a block: tractor and trailer clear of it;
// 4 a wall across the whole way: no path, said so (the drawn route is not silently driven through);
// 5 a route already clear: not blocked, so it is driven as drawn.
const assert = require('node:assert/strict'), path = require('node:path');
(async () => {
  const V = await import(path.join(__dirname, '../mvp/js/vehicles.js')), S = await import(path.join(__dirname, '../mvp/js/swept-path.js')), RP = await import(path.join(__dirname, '../mvp/js/route-plan.js')), G = await import(path.join(__dirname, '../mvp/js/geom2d.js'));
  const veh = (id) => V.PRESETS.find((v) => v.id === id), sq = (cx, cy, h) => [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]];
  const minGap = (pl, obs) => Math.min(...pl.map((x) => Math.min(...obs.map((o) => G.inPoly(x.p, o.poly) ? -1 : Math.min(...o.poly.map((a, i) => G.segDist(x.p, a, o.poly[(i + 1) % o.poly.length]).d))))));
  // 1. straight through a block
  const box = veh('box'), block = [{ id: 'b', kind: 'building', name: 'block', poly: sq(25, 0, 3) }], route = { pts: [[0, 0], [50, 0]] };
  assert(RP.drawnBlocked(box, route, block, 0.3), 'the drawn route runs into the block');
  let t = Date.now(); const pl = RP.planAround(box, route, block, { clearance: 0.3 }); const ms = Date.now() - t; assert(pl.ok, pl.error);
  const g1 = minGap(pl.path, block); assert(g1 >= box.width / 2 + 0.3 - 0.2, 'the reference point keeps away from the block: ' + g1.toFixed(2));
  const end = pl.path.at(-1).p; assert(Math.hypot(end[0] - 50, end[1]) < 0.3, 'it ends at the drawn end');
  const run = S.simulate(box, { pts: route.pts, planned: pl.path }, { obstacles: block, clearance: 0.3 }); assert(run.ok && run.collisions.length === 0, JSON.stringify(run.reasons));
  console.log(`PASS 1 box truck through a 6 m block: planned round it in ${ms} ms, ${pl.length.toFixed(1)} m (drawn 50 m); the drive: no collision, least gap ${run.minClear.d.toFixed(2)} m, ${run.status}`);
  // 2. three points, the middle one past the block
  const r2 = { pts: [[0, 0], [40, 0], [40, 30]] }, pl2 = RP.planAround(box, r2, block, { clearance: 0.3 }); assert(pl2.ok, pl2.error);
  assert(pl2.path.some((x) => Math.hypot(x.p[0] - 40, x.p[1]) < 1.6), 'through the middle point'); assert(Math.hypot(pl2.path.at(-1).p[0] - 40, pl2.path.at(-1).p[1] - 30) < 1.6, 'to the end');
  const run2 = S.simulate(box, { pts: r2.pts, planned: pl2.path }, { obstacles: block, clearance: 0.3 }); assert(run2.collisions.length === 0, JSON.stringify(run2.reasons));
  console.log(`PASS 2 three points with a turn: round the block and through the middle point, ${pl2.length.toFixed(1)} m, no collision`);
  // 3. a semi-trailer
  const semi = veh('semi'), big = [{ id: 'c', kind: 'building', name: 'block', poly: sq(40, 0, 4) }], r3 = { pts: [[0, 0], [90, 0]] }, pl3 = RP.planAround(semi, r3, big, { clearance: 0.3 }); assert(pl3.ok, pl3.error);
  const run3 = S.simulate(semi, { pts: r3.pts, planned: pl3.path }, { obstacles: big, clearance: 0.3 }); assert(run3.collisions.length === 0, JSON.stringify(run3.reasons));
  console.log(`PASS 3 semi-trailer round an 8 m block: ${pl3.length.toFixed(1)} m, tractor and trailer clear (least gap ${run3.minClear.d.toFixed(2)} m)`);
  // 4. a wall across the whole searched area: no way round
  const wall = [{ id: 'w', kind: 'drawn', name: 'wall', poly: [[24, -200], [26, -200], [26, 200], [24, 200]] }], pl4 = RP.planAround(box, route, wall, { clearance: 0.3, maxExpand: 20000 });
  assert(!pl4.ok && /no way round/.test(pl4.error), JSON.stringify(pl4)); console.log('PASS 4 a wall across the way: "' + pl4.error + '"');
  // 5. a clear route
  assert.equal(RP.drawnBlocked(box, { pts: [[0, 10], [50, 10]] }, block, 0.3), null); console.log('PASS 5 a route 10 m from the block is not blocked: driven as drawn');
})().catch((e) => { console.error(e); process.exit(1); });
