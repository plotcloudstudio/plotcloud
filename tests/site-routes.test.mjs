// Routes without drawing (2026-11-25): site-routes.js gives the start and the end from the roads and a door; route-plan.js drives
// between them, ending facing the way asked and keeping to the roads; vehicle-mesh.js builds a vehicle whose footprint is the one
// the swept path checks. Pure modules, a made-up site: a building 40 × 20 m about the origin, an east–west street 30 m south of it,
// a north–south street 40 m east of it, a door in the middle of the south wall.
import assert from 'node:assert/strict';
import * as SR from '../mvp/js/site-routes.js';
import * as RP from '../mvp/js/route-plan.js';
import * as SP from '../mvp/js/swept-path.js';
import * as V from '../mvp/js/vehicles.js';
import * as VM from '../mvp/js/vehicle-mesh.js';
const bld = { id: 'b', kind: 'building', name: 'the building', poly: [[-20, -10], [20, -10], [20, 10], [-20, 10]] };
const roads = [{ id: 'ew', name: 'South St', pts: [[-120, -40], [120, -40]], width: 10 }, { id: 'ns', name: 'East Av', pts: [[60, -120], [60, 120]], width: 10 }];
const door = { p: [0, -10], n: [0, -1], w: 2 }, truck = V.byId('box'), deg = (r) => r * 180 / Math.PI, angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
// 1 · the junction of the two streets, and its four arms
const J = SR.junctions(roads); assert.equal(J.length, 1, 'one junction'); assert(Math.hypot(J[0].p[0] - 60, J[0].p[1] + 40) < 0.01, 'at (60, −40)');
assert.equal(SR.arms(roads, J[0]).length, 4, 'four arms');
console.log('PASS junction found at (60, −40) with four arms');
// 2 · to the entrance: start in the eastbound lane (right-hand traffic: south of the centreline), end beside the door, parallel to the wall
const E = SR.entranceTask(roads, door, truck); assert(!E.error, E.error);
assert(Math.abs(E.start.p[1] - (-42.5)) < 0.01, 'start in the right-hand lane, y = −42.5: ' + E.start.p); assert(angDiff(E.start.heading, 0) < 1e-6, 'heading east');
assert(angDiff(E.end.heading, 0) < 1e-6, 'ends parallel to the wall, facing east'); const midX = E.end.p[0] + (truck.wheelbase + truck.frontOverhang - truck.rearOverhang) / 2; assert(Math.abs(midX) < 0.01, 'the truck’s middle at the door: ' + midX);
assert(Math.abs(E.end.p[1] - (-10 - truck.width / 2 - 1)) < 0.01, 'stands 1 m clear of the wall');
const pl = RP.planAround(truck, { pts: [E.start.p, E.end.p] }, [bld], { clearance: 0.3, startHeading: E.start.heading, goalHeading: E.end.heading, roads });
assert(pl.ok, 'planned: ' + pl.error); assert(angDiff(pl.endHeading, E.end.heading) <= 0.2 + 1e-9, 'ends facing the wall’s way, within 11°: ' + deg(pl.endHeading).toFixed(1));
const run = SP.simulate(truck, { pts: [E.start.p, E.end.p], planned: pl.path }, { obstacles: [bld], clearance: 0.3, complete: true }); assert(run.ok && run.collisions.length === 0, 'driven without hitting the building');
console.log(`PASS to the entrance: ${pl.length.toFixed(1)} m from the street to the door, ends ${deg(angDiff(pl.endHeading, E.end.heading)).toFixed(1)}° off the wall, no collision, least gap ${run.minClear.d.toFixed(2)} m`);
// 3 · a right turn at the junction, kept on the roads
const A = SR.arms(roads, J[0]), west = A.findIndex((a) => a.dir[0] < -0.9), north = A.findIndex((a) => a.dir[1] > 0.9), south = A.findIndex((a) => a.dir[1] < -0.9);
const T1 = SR.turnTask(roads, J[0], west, south, truck); assert.equal(T1.kind, 'right turn', 'coming from the west, south is a right turn');
const T2 = SR.turnTask(roads, J[0], west, north, truck); assert.equal(T2.kind, 'left turn');
const pt = RP.planAround(truck, { pts: [T1.start.p, T1.end.p] }, [bld], { startHeading: T1.start.heading, goalHeading: T1.end.heading, roads }); assert(pt.ok, pt.error);
assert(pt.onRoad >= 0.9, 'the turn keeps to the roads: ' + pt.onRoad);
console.log(`PASS right turn at the junction: ${pt.length.toFixed(1)} m, ${(pt.onRoad * 100).toFixed(0)} % on the roads`);
// 4 · through the site: the same street, from west to east, on the road
const Th = SR.throughTask(roads, [-100, -38], [100, -38]); const pth = RP.planAround(truck, { pts: [Th.start.p, Th.end.p] }, [bld], { startHeading: Th.start.heading, goalHeading: Th.end.heading, roads }); assert(pth.ok && pth.onRoad >= 0.9, 'through, on the road: ' + pth.onRoad);
console.log(`PASS through the site along the street: ${(pth.onRoad * 100).toFixed(0)} % on the road`);
// 5 · a goal heading that cannot be met says why and where it got to
const blocked = RP.planAround(truck, { pts: [[-60, -42.5], [-30, -42.5]] }, [bld, { id: 'w', poly: [[-45, -50], [-44, -50], [-44, -30], [-45, -30]] }], { startHeading: 0, roads, maxExpand: 8000 });
assert(!blocked.ok && blocked.closest, 'fails with the closest point: ' + JSON.stringify(blocked).slice(0, 120));
console.log(`PASS a wall across the street: "${blocked.error}", got to within ${blocked.gap.toFixed(1)} m`);
// 6 · the 3D model's footprint is the swept path's body, for every preset; front wheels steer, at the axles
for (const v of V.PRESETS) { const P = VM.vehicleParts(v), f = VM.footprint(P, 'tractor');
  assert(Math.abs(f.x0 + v.rearOverhang) < 0.01 && Math.abs(f.x1 - (v.wheelbase + v.frontOverhang)) < 0.01 && Math.abs(f.y1 - v.width / 2) < 0.02, `${v.id}: tractor footprint ${JSON.stringify(f)}`);
  if (v.kind === 'artic') { const t = VM.footprint(P, 'trailer'), T = v.trailer; assert(Math.abs(t.x0 + T.wheelbase + T.rearOverhang) < 0.01 && Math.abs(t.x1 - T.frontOverhang) < 0.01, `${v.id}: trailer footprint`); }
  const S = SP.shapesAt(v, { x: 0, y: 0, th: 0, phi: 0, delta: 0 }); const fl = P.wheels.find((w) => w.steer && w.y > 0); assert(Math.abs(fl.x - S.wheels.FL[0]) < 1e-9 && Math.abs(fl.y - S.wheels.FL[1]) < 1e-9, `${v.id}: front-left wheel at the axle`);
  assert(P.height > 1 && P.heightSrc, `${v.id}: a height and its source`); }
console.log(`PASS 3D models of all ${V.PRESETS.length} presets: footprints match the swept-path bodies within 2 cm, wheels at the axles, heights with sources`);
// 7 · reversing (2026-11-25): a box truck backed up to the door by way of a staging point: one change of direction, the last move
// backwards, driven as planned (no tracking error), ending within 1 m and 17° of the stop; an articulated vehicle is not reversed
{ const B = SR.entranceTask(roads, door, truck, { back: true }); assert(B.via && B.end.back, 'a staging point and a backed-up stop');
  const pb = RP.planAround(truck, { pts: [B.start.p, B.via, B.end.p] }, [bld], { clearance: 0.3, startHeading: B.start.heading, goalHeading: B.end.heading, goalTol: 0.3, roads, reverse: true, maxExpand: 150000 });
  assert(pb.ok, 'backed up: ' + pb.error); assert(pb.cusps >= 1 && pb.path.at(-1).dir === -1, 'the last move is backwards');
  const rb = SP.simulate(truck, { pts: [B.start.p, B.end.p], planned: pb.path, heading0: pb.heading0 }, { obstacles: [bld], clearance: 0.3, complete: true });
  const lp = rb.poses.at(-1), gap = Math.hypot(lp.x - B.end.p[0], lp.y - B.end.p[1]); assert(rb.status === 'feasible' && rb.collisions.length === 0, 'driven clear: ' + rb.reasons.join('; '));
  assert(Math.max(...rb.poses.map((p) => p.err)) < 0.05 && gap < 1.0 && angDiff(lp.th, B.end.heading) <= 0.3 + 1e-9, `driven as planned, ends ${gap.toFixed(2)} m from the stop`);
  assert(rb.moves === pb.cusps + 1 && rb.reverseLength > 1, 'moves and metres reversing counted');
  console.log(`PASS backed up to the door: ${rb.moves} moves, ${rb.reverseLength.toFixed(1)} m reversing, driven as planned, ends ${gap.toFixed(2)} m and ${deg(angDiff(lp.th, B.end.heading)).toFixed(0)}° from the stop; no collision`); }
// 8 · turning round within a 12 m road: a box truck makes a three-point turn (two changes of direction), every move within the road
{ const lane = [{ id: 'l', name: 'Lane', pts: [[-60, 100], [60, 100]], width: 12 }], T = SR.turnRoundTask(lane, [0, 100], [10, 100]);
  const pt2 = RP.planAround(truck, { pts: [T.start.p, T.end.p] }, [], { startHeading: T.start.heading, goalHeading: T.end.heading, goalTol: 0.3, roads: lane, roadsOnly: true, reverse: true, clearance: 0.3, maxExpand: 150000 });
  assert(pt2.ok && pt2.cusps >= 2, 'a three-point turn or more: ' + (pt2.error || pt2.cusps));
  const rt = SP.simulate(truck, { pts: [T.start.p, T.end.p], planned: pt2.path, heading0: pt2.heading0 }, { obstacles: [], clearance: 0.3 }); assert(rt.infeasible.length === 0, 'driven as planned');
  let worst = 0; for (const q of rt.poses) for (const B of SP.shapesAt(truck, q).bodies) for (const c of B) worst = Math.max(worst, Math.abs(c[1] - 100)); assert(worst <= 6 - 0.25, 'the body stays within the 12 m road, clearance kept: ' + worst.toFixed(2));
  console.log(`PASS turning round in a 12 m road: ${rt.moves} moves (a three-point turn), ${rt.reverseLength.toFixed(1)} m reversing, the body within ${worst.toFixed(2)} m of the centreline (6 m to the edge)`); }
// 9 · a semi-trailer backed up to the door (2026-11-26): planned as a pull-out from the door driven the other way; the last move is
// backwards, the trailer within 0.6 x its articulation limit when reversing, the replay on the plan (tracking < 0.1 m, the trailer's
// angle at the door within 2° of square), no collision; a drawn route that reverses an articulated vehicle is still refused
{ const semi = V.byId('semi'), B = SR.entranceTask(roads, door, semi, { back: true }); assert(B.vias && B.vias.length >= 2, 'staging poses on the road and in the yard');
  const t0 = Date.now(), ps = RP.planBackIn(semi, B, [bld], { clearance: 0.3, roads }); assert(ps.ok, 'semi backed up: ' + ps.error);
  assert(ps.cusps >= 1 && ps.path.at(-1).dir === -1 && ps.reverseLength > 10, 'the last move is backwards, ' + ps.reverseLength.toFixed(1) + ' m');
  const rs = SP.simulate(semi, { pts: [B.start.p, B.end.p], planned: ps.path, heading0: ps.heading0 }, { obstacles: [bld], clearance: 0.3, complete: true });
  assert(rs.status === 'feasible' && rs.collisions.length === 0, 'driven clear: ' + rs.reasons.join('; '));
  const lim = 0.6 * semi.trailer.maxArticulation, art = Math.max(...rs.poses.filter((q) => q.dir < 0).map((q) => deg(angDiff(q.th, q.phi)))), lp = rs.poses.at(-1);
  assert(art <= lim + 0.5, `articulation reversing ${art.toFixed(1)}° within ${lim}°`); assert(Math.max(...rs.poses.map((q) => q.err)) < 0.1, 'on the plan');
  assert(Math.hypot(lp.x - B.end.p[0], lp.y - B.end.p[1]) < 0.5 && deg(angDiff(lp.phi, B.end.heading)) < 2 && deg(angDiff(lp.th, B.end.heading)) < 2, 'square to the door: ' + JSON.stringify(lp).slice(0, 120));
  const dr = SP.simulate(semi, { pts: [[0, -60], [0, -30]], reverse: [true, true] }, { obstacles: [] }); assert(!dr.ok && /drawn route cannot reverse an articulated/.test(dr.error), 'a drawn reverse refused: ' + dr.error);
  console.log(`PASS a semi-trailer backed up to the door: ${rs.moves} moves, ${rs.reverseLength.toFixed(1)} m reversing, trailer at most ${art.toFixed(1)}° (limit ${lim}°), square to the door, no collision (${Date.now() - t0} ms); a drawn reverse still refused`); }
