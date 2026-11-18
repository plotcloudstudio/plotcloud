// Vehicle swept path (2026-11-18), no browser: the engine (mvp/js/swept-path.js) against hand values.
// 1 a car on a circle: the rear axle stays on it within 1 cm; the outer front corner sweeps √((R+w/2)² + (wb+fo)²) and the inner side
//   R − w/2, within 2 cm, and so does the envelope (within its cell); 2 a straight run: the envelope is the vehicle's width;
// 3 a corner tighter than the minimum radius: infeasible on that corner's stations; the same corner rounded as drawn: fine;
// 4 a semi-trailer in a steady turn: the trailer axle on √(R² − Lt²) within 2 cm; an articulation limit enforced;
// 5 a box beside the route: the least clearance is the hand value; under 0.30 m flagged; overlapping: the collision stretch is the
//   hand interval; 6 a reversing segment (a cusp); 7 two vehicles meeting at the same time, or only in their envelopes; 8 the same
//   input gives the same output. Also geom2d and vehicles checks.
const assert = require('node:assert/strict'), path = require('node:path');
(async () => {
  const G = await import(path.join(__dirname, '../mvp/js/geom2d.js')), V = await import(path.join(__dirname, '../mvp/js/vehicles.js')), S = await import(path.join(__dirname, '../mvp/js/swept-path.js'));
  // geom2d: area, clean, overlap, gap, clip, raster union
  const sq = [[0, 0], [4, 0], [4, 3], [0, 3]]; assert.equal(G.area(sq), 12); assert.equal(G.area(G.clean([[0, 0], [0, 3], [4, 3], [4, 0], [2, 0], [2, 0.0001]].slice(0, 5))), 12);
  assert(G.overlap(sq, G.rect([4, 1.5], 0, 1, 1))); assert.equal(G.gap(sq, [[6, 0], [7, 0], [7, 1], [6, 1]]).d, 2); assert(Math.abs(G.overlapArea(sq, [[2, 1], [6, 1], [6, 5], [2, 5]]) - 4) < 1e-9);
  const U = G.rasterUnion([sq, [[2, 2], [6, 2], [6, 5], [2, 5]]], 0.05); assert(Math.abs(U.area - (12 + 12 - 2)) < 0.3, 'union area ' + U.area); assert.equal(U.loops.length, 1);
  // vehicles: the radii, the checks
  const car = V.byId('car'), semi = V.byId('semi'); assert(Math.abs(V.rMin(car) - 2.9 / Math.tan(35 * Math.PI / 180)) < 1e-12); assert.deepEqual(V.check(car), []); assert.match(V.check({ ...car, track: 3 }).join(), /Track cannot be wider/);
  console.log(`PASS geom2d and vehicles: car R_min ${V.rMin(car).toFixed(2)} m, outer front ${V.rOuter(car).toFixed(2)} m; semi R_min ${V.rMin(semi).toFixed(2)} m`);

  // 1. a car on three quarters of a circle of 10 m (720 points: the corners are rounded to arcs of about the circle's radius)
  const R = 10, arc = (r, n, a1 = 1.5 * Math.PI) => Array.from({ length: n + 1 }, (_, i) => { const t = -Math.PI / 2 + a1 * i / n; return [r * Math.cos(t), r * Math.sin(t)]; });
  const c1 = S.simulate(car, { pts: arc(R, 540) }, { quality: 'refined' }); assert(c1.ok, c1.error);
  const steady = c1.poses.filter((p) => p.s > 8 && p.s < c1.length - 3);
  const onC = Math.max(...steady.map((p) => Math.abs(Math.hypot(p.x, p.y) - R))); assert(onC < 0.01, 'rear axle off the circle by ' + onC);
  const outer = Math.hypot(R + car.width / 2, car.wheelbase + car.frontOverhang), inner = R - car.width / 2;
  const rad = steady.map((p) => { const B = S.shapesAt(car, p).bodies[0]; return { out: Math.max(...B.map((q) => Math.hypot(q[0], q[1]))), in: Math.min(...B.map((q, i) => G.segDist([0, 0], q, B[(i + 1) % 4]).d)) }; });
  const eOut = Math.max(...rad.map((x) => Math.abs(x.out - outer))), eIn = Math.max(...rad.map((x) => Math.abs(x.in - inner))); assert(eOut < 0.02 && eIn < 0.02, `outer ${eOut}, inner ${eIn}`);
  // the envelope over the steady part of the turn (angles from −60° to 150°, clear of the start and end)
  const env = c1.envelope.loops.flat().filter((q) => { const a = Math.atan2(q[1], q[0]) * 180 / Math.PI; return a > -40 && a < 150; }).map((q) => Math.hypot(q[0], q[1]));
  assert(Math.abs(Math.max(...env) - outer) < 2 * c1.cell && Math.abs(Math.min(...env) - inner) < 2 * c1.cell, `envelope ${Math.min(...env).toFixed(3)}–${Math.max(...env).toFixed(3)} vs ${inner.toFixed(3)}–${outer.toFixed(3)}`);
  assert(Math.abs(c1.rReached - R) < 0.05, 'radius reached ' + c1.rReached);
  console.log(`PASS 1 car on R ${R} m: rear axle within ${(onC * 1000).toFixed(1)} mm; outer front corner ${outer.toFixed(3)} m (±${(eOut * 1000).toFixed(1)} mm), inner side ${inner.toFixed(3)} m (±${(eIn * 1000).toFixed(1)} mm); swept width ${(outer - inner).toFixed(2)} m; the envelope matches within its ${c1.cell} m cell`);

  // 2. straight, 30 m: the band is the vehicle's width, and its area the width times (30 m + the length)
  const c2 = S.simulate(car, { pts: [[0, 0], [30, 0]] }, { quality: 'standard' }); const ys = c2.envelope.loops.flat().map((q) => q[1]);
  assert(Math.abs(Math.max(...ys) - Math.min(...ys) - car.width) <= 2 * c2.cell + 1e-9, 'band ' + (Math.max(...ys) - Math.min(...ys)));
  const L0 = car.frontOverhang + car.wheelbase + car.rearOverhang; assert(Math.abs(c2.swept - car.width * (c2.length + L0)) < 2 * c2.cell * (2 * (c2.length + L0) + 2 * car.width), `area ${c2.swept} vs ${car.width * (c2.length + L0)}`);
  assert.equal(c2.status, 'unverified'); assert.match(c2.unverifiedWhy, /no obstacles/);
  console.log(`PASS 2 straight 30 m: band ${(Math.max(...ys) - Math.min(...ys)).toFixed(2)} m wide (car ${car.width} m), area ${c2.swept.toFixed(1)} m²; with nothing to check against: "Not verified"`);

  // 3. a right-angle corner with a 2 m radius (under the car's 4.14 m): infeasible on the corner; the same corner as drawn (auto): fine
  const L3 = { pts: [[0, 0], [20, 0], [20, 20]], radii: [null, 2, null] }, c3 = S.simulate(car, L3, { quality: 'standard' }), cor = c3.ref.corners[0];
  assert.equal(c3.status, 'infeasible'); const hit = c3.infeasible.find((x) => x.why === 'corner'); assert(hit && hit.s0 <= cor.s0 + 0.1 && hit.s1 >= cor.s1 - 0.1, JSON.stringify({ hit, cor: [cor.s0, cor.s1] }));
  assert(c3.reasons.some((r) => /tighter than the vehicle's minimum radius/.test(r)));
  const c3b = S.simulate(car, { pts: L3.pts }, { quality: 'standard' }); assert.equal(c3b.infeasible.length, 0, JSON.stringify(c3b.infeasible)); assert(c3b.ref.corners[0].auto && c3b.ref.corners[0].r >= V.rMin(car));
  console.log(`PASS 3 a corner of R 2 m: infeasible at ${hit.s0.toFixed(1)}–${hit.s1.toFixed(1)} m (the arc ${cor.s0.toFixed(1)}–${cor.s1.toFixed(1)} m); drawn without a radius it is rounded to ${c3b.ref.corners[0].r.toFixed(1)} m and driven`);

  // 4. the semi-trailer on 3/4 of a 30 m circle: the trailer axle settles on √(R² − Lt²)
  const R4 = 30, c4 = S.simulate(semi, { pts: arc(R4, 720) }, { quality: 'standard' }); assert(c4.ok, c4.error); const Lt = semi.trailer.wheelbase, want = Math.sqrt(R4 * R4 - Lt * Lt);
  const tail = c4.poses.filter((p) => p.s > c4.length - 20 && p.s < c4.length - 3).map((p) => { const w = S.shapesAt(semi, p).wheels; return Math.hypot((w.TL[0] + w.TR[0]) / 2, (w.TL[1] + w.TR[1]) / 2); });
  const e4 = Math.max(...tail.map((r) => Math.abs(r - want))); assert(e4 < 0.02, `trailer axle radius off by ${e4}`);
  const lim = S.simulate({ ...semi, trailer: { ...semi.trailer, maxArticulation: 10 } }, { pts: arc(R4, 720) }, { quality: 'draft' }); assert(lim.infeasible.some((x) => x.why === 'articulation'), 'articulation limit');
  console.log(`PASS 4 semi-trailer on R ${R4} m: trailer axle on ${want.toFixed(3)} m (±${(e4 * 1000).toFixed(1)} mm), off-tracking ${(R4 - want).toFixed(2)} m; a 10° articulation limit is flagged`);

  // 5. a box beside a straight route (the car's side at y = ±0.925)
  const box = (y0, y1) => [{ id: 'b', kind: 'building', name: 'Box', poly: [[10, y0], [12, y0], [12, y1], [10, y1]] }];
  const c5 = S.simulate(car, { pts: [[0, 0], [30, 0]] }, { obstacles: box(1.5, 3) }); assert(Math.abs(c5.minClear.d - (1.5 - car.width / 2)) < 1e-6, 'clearance ' + c5.minClear.d); assert.equal(c5.status, 'feasible');
  const c5b = S.simulate(car, { pts: [[0, 0], [30, 0]] }, { obstacles: box(1.1, 3) }); assert.equal(c5b.status, 'infeasible'); assert(c5b.tooNear.length && /under the 0.30 m clearance/.test(c5b.reasons.join()));
  const c5c = S.simulate(car, { pts: [[0, 0], [30, 0]] }, { obstacles: box(0.5, 3) }), col = c5c.collisions[0]; const h0 = 10 - (car.wheelbase + car.frontOverhang), h1 = 12 + car.rearOverhang;
  assert(col && Math.abs(col.s0 - h0) <= c5c.ds + 1e-6 && Math.abs(col.s1 - h1) <= c5c.ds + 1e-6, JSON.stringify(col));
  console.log(`PASS 5 a box: clearance ${c5.minClear.d.toFixed(3)} m (feasible); at 0.175 m flagged under 0.30 m; overlapping: collision ${col.s0.toFixed(2)}–${col.s1.toFixed(2)} m (hand ${h0.toFixed(2)}–${h1.toFixed(2)})`);

  // 6. forward 20 m, then reversing back 10 m and round a corner into a bay (a 3-point manoeuvre): a cusp, one reversing stretch, the end
  // reached and the route followed; a cusp with the reverse leg at 41° to the car (a turn of no radius) cannot be followed, and says so
  const c6 = S.simulate(car, { pts: [[0, 0], [20, 0], [10, 0], [10, -12]], reverse: [false, true, true] }, {}); assert.equal(c6.infeasible.length, 0, JSON.stringify(c6.infeasible));
  const c6b = S.simulate(car, { pts: [[0, 0], [15, 0], [8, 6]], reverse: [false, true] }, {}); assert(c6b.infeasible.some((x) => x.why === 'track')); assert.equal(c6.cusps, 1); assert.equal(c6.reversing, 1); assert(!c6.infeasible.some((x) => x.why === 'end'), JSON.stringify(c6.infeasible));
  assert(c6.poses.some((p) => p.dir < 0)); console.log(`PASS 6 forward then reversing: ${c6.cusps} cusp, ${c6.reversing} reversing manoeuvre, ${c6.length.toFixed(1)} m driven`);

  // 7. two cars on crossing routes: at the same moment they meet; one started 20 s later they do not, though the envelopes cross
  const a = S.simulate(car, { pts: [[-20, 0], [20, 0]] }, {}), b = S.simulate(car, { pts: [[0, -20], [0, 20]] }, {}), b2 = S.simulate(car, { pts: [[0, -20], [0, 20]] }, { delay: 40 });
  const k1 = S.pairConflict(a, b), k2 = S.pairConflict(a, b2); assert(k1.simultaneous.length >= 1 && k1.envelopesMeet); assert(!k2.simultaneous.length && k2.envelopesMeet);
  console.log(`PASS 7 two cars crossing: they meet at ${k1.simultaneous[0].t0.toFixed(1)} s; with a 40 s delay only their envelopes cross`);

  // 8. the same input, the same output
  const j = (r) => JSON.stringify([r.poses.map((p) => [p.x, p.y, p.th]), r.swept, r.reasons]); assert.equal(j(S.simulate(car, L3, {})), j(S.simulate(car, L3, {})));
  console.log('PASS 8 the same input gives the same output');
})().catch((e) => { console.error(e); process.exit(1); });
