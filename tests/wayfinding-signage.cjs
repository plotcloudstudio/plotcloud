// Wayfinding for signs (2026-11-18), on test floors (tests/fixtures/wayfinding-floor.cjs), no browser. The twelve cases of the brief:
// 1 lift lobby to one room; 2 stair to one room; 3 lift to several groups (group names with number ranges); 4 a corridor with a T;
// 5 a crossing; 6 a destination hidden behind a wall; 7 an existing sign at a junction; 8 a sign facing away; 9 two floors joined
// by a lift and a stair; 10 a room reachable only through a staff room; 11 a sign behind a wall; 12 a sign moved and the rerun. Also:
// room centres are never starts, and the same input gives the same output.
const assert = require('node:assert/strict'), path = require('node:path'), floor = require('./fixtures/wayfinding-floor.cjs');
(async () => {
  const W = await import(path.join(__dirname, '../mvp/js/interior/wayfinding-signage.js'));
  const B = (sc, more = []) => ({ levels: [{ id: 'L1', name: 'Level 1', z: 0, h: 3, sc }, ...more], stairs: [] });
  const run = (o = {}, sc = floor()) => W.analyse(B(sc), { level: 'L1', ...o });
  const route = (r, room, kind) => r.routes.find((x) => x.room.name === room && (!kind || x.start.kind === kind));
  // starts: the lift lobby and the stair landing (the test floor has no door to outside); no room centre anywhere
  let r = run(); const kinds = r.starts.map((s) => s.kind).sort(); assert.deepEqual(kinds, ['lift', 'stair']);
  for (const s of r.starts) { assert(!r.F.rooms.some((x) => !x.circ && Math.hypot(x.label[0] - s.p[0], x.label[1] - s.p[1]) < 0.3), 'a start at a room centre: ' + s.name); }
  assert.match(r.starts.find((s) => s.kind === 'lift').name, /Elevator lobby · Bed elevators/);
  console.log('PASS starts: ' + r.starts.map((s) => s.name).join(', ') + ' (no room centres)');
  // 1. lift to one room: through real doorways; the length matches the hand value (lift door at x 2, along the corridor to x 21, up to Rehabilitation's door)
  const one = run({ starts: [r.starts.find((s) => s.kind === 'lift').id], dest: { mode: 'rooms', rooms: ['Rehabilitation'] } }), rr = route(one, 'Rehabilitation');
  assert(!rr.noRoute); const hand = Math.hypot(20.75 - 2.8, 12 - 11); assert(Math.abs(rr.len - hand) < 1.0, `length ${rr.len.toFixed(2)} vs about ${hand.toFixed(2)}`);
  assert.deepEqual(rr.door.m, [20.75, 12]);
  console.log(`PASS 1 lift lobby → Rehabilitation: ${rr.len.toFixed(1)} m to its door at (20.75, 12), through the corridor`);
  // 2. stair to one room
  const two = run({ starts: [r.starts.find((s) => s.kind === 'stair').id], dest: { mode: 'rooms', rooms: ['Patient room 310'] } }), r2 = route(two, 'Patient room 310');
  const hand2 = Math.hypot(61.2 - 51.8, 11 - 12.2) + Math.hypot(51.8 - 52, 12.2 - 16.5); assert(!r2.noRoute && Math.abs(r2.len - hand2) < 1.0, `stair route ${r2.len.toFixed(2)} vs about ${hand2.toFixed(2)} (round the corner of the north arm)`); console.log(`PASS 2 stair landing → Patient room 310: ${r2.len.toFixed(1)} m`);
  // 3. lift to several groups; a group's label with its number range
  const three = run({ starts: 'all', dest: { mode: 'groups', groups: ['Patient room', 'Imaging'] } });
  assert.equal(three.groups['Patient room'].label, 'Patient rooms 301–311'); assert(three.routes.filter((x) => !x.noRoute).every((x) => /Patient room|Imaging/.test(x.room.name)));
  console.log(`PASS 3 lift and stair → Patient rooms and Imaging: ${three.routes.length} routes; group label "${three.groups['Patient room'].label}"`);
  // 4 and 5. the T at x 51 (3 ways) and the crossing at x 31 (4 ways, complexity 1), found from the corridor network
  r = run(); const at = (x) => r.nodes.find((n) => n.br.length >= 3 && Math.abs(n.p[0] - x) < 1.5 && Math.abs(n.p[1] - 11) < 1.5);
  const T = at(51), X = at(31); assert(T && T.br.length === 3, 'the T'); assert(X && X.br.length === 4 && X.factors.A === 1, 'the crossing');
  console.log(`PASS 4 the T junction: 3 ways, score ${T.score} (${T.cls}); 5 the crossing: 4 ways, complexity 1, score ${X.score} (${X.cls})`);
  // the directions are the walker's: arriving from the lift (heading east), Reception is up the north arm, to the Left
  const fromLift = run({ starts: [r.starts.find((q) => q.kind === 'lift').id] }), XL = fromLift.nodes.find((n) => n.br.length === 4);
  const wy = XL.ways.find((w) => w.to.some((t) => /Reception/.test(t))); assert.equal(wy.rel, 'Left', JSON.stringify(XL.ways));
  assert(XL.ways.some((w) => w.rel === 'Ahead' && w.to.some((t) => /Patient rooms 310–311/.test(t))), JSON.stringify(XL.ways)); assert(X.reason.length > 10);
  const fromStair = run({ starts: [r.starts.find((q) => q.kind === 'stair').id] }), XS = fromStair.nodes.find((n) => n.br.length === 4); assert.equal(XS.ways.find((w) => w.to.some((t) => /Reception/.test(t))).rel, 'Right');
  console.log(`PASS directions at the crossing, for a walker from the lift: ${XL.ways.map((w) => `${w.rel}: ${w.to.join(', ')}`).join(' | ')}; from the stair Reception is to the Right`);
  // 6. a destination round a corner: from 5 m before the crossing (from the lift) Reception's arm is hidden by Rehabilitation's corner
  const liftId = r.starts.find((q) => q.kind === 'lift').id, L6 = run({ starts: [liftId] }), X6 = L6.nodes.find((n) => n.br.length === 4);
  assert(X6.factors.C > 0 && X6.meta.hidden.includes('Reception'), JSON.stringify(X6.meta.hidden)); assert.match(X6.reason, /out of sight[^.]*Reception/);
  console.log(`PASS 6 a destination round a corner: visibility factor ${X6.factors.C}; the reason names it: "${X6.reason}"`);
  // 7. an existing sign at the crossing, facing people from the lift (it faces west): the point is covered, its score drops to 0
  const at4 = (res) => res.nodes.find((n) => Math.abs(n.p[0] - 31) < 1.5 && n.br.length === 4);
  const s7 = run({ starts: [liftId], signs: [{ p: [29.5, 11.8], face: 180 }] }), X7 = at4(s7);
  assert.equal(X7.factors.E, 1); assert.equal(X7.score, 0); assert(!X7.recommended); assert.match(X7.reason, /Covered by/); console.log(`PASS 7 an existing sign at the crossing facing the lift: covered, score ${X6.score} → 0`);
  // 8. the same sign facing away (east): not counted
  const s8 = run({ starts: [liftId], signs: [{ p: [29.5, 11.8], face: 0 }] }), X8 = at4(s8); assert.equal(X8.factors.E, 0); assert.equal(X8.score, X6.score);
  console.log('PASS 8 a sign facing away from the approach does not count');
  // 9. two floors: Level 2 with the lift and the stair in the same places; to its rooms by the lift (accessible) or the shorter way
  const sc2 = floor({ name: 'L2' }); sc2.rooms.filter((x) => /Patient room 30/.test(x.name)).forEach((x, i) => { x.name = 'Ward ' + (501 + i); });
  const two2 = W.analyse({ levels: [{ id: 'L1', name: 'Level 1', z: 0, h: 3, sc: floor() }, { id: 'L2', name: 'Level 2', z: 3, h: 3, sc: sc2 }], stairs: [] }, { level: 'L1', starts: 'all', dest: { mode: 'rooms', rooms: ['Ward 503'], otherFloors: true } });
  const up = two2.routes.find((x) => x.room.name === 'Ward 503' && x.start.kind === 'lift'); assert(up && !up.noRoute && up.floor === 'Level 2' && up.upPts.length > 1, JSON.stringify(up && { noRoute: up.noRoute, reason: up.reason }));
  const acc = W.analyse({ levels: [{ id: 'L1', name: 'Level 1', z: 0, h: 3, sc: floor() }, { id: 'L2', name: 'Level 2', z: 3, h: 3, sc: sc2 }], stairs: [] }, { level: 'L1', starts: 'all', accessible: true, dest: { mode: 'rooms', rooms: ['Ward 503'], otherFloors: true } });
  assert(acc.routes.filter((x) => !x.noRoute).every((x) => x.viaKind === 'lift'), 'accessible: by the lift only');
  console.log(`PASS 9 to Ward 503 on Level 2: by the ${up.viaKind} (${up.len.toFixed(0)} m equivalent); accessible routes all by the lift`);
  // 10. Records lies behind the clean utility (no public access): no valid route, and why
  const rec = route(r, 'Records'); assert(rec.noRoute); assert.match(rec.reason, /only through rooms with no public access/); console.log(`PASS 10 Records: "No valid route": ${rec.reason}`);
  // 11. a sign behind a wall is not counted: inside Patient room 306, behind its corridor wall, 4 m from the crossing; the same sign in the corridor covers
  const s11 = run({ starts: [liftId], signs: [{ p: [27.5, 9.4], face: 180 }] }), X11 = at4(s11); assert.equal(X11.factors.E, 0, 'a sign behind a wall does not cover');
  const s11b = run({ starts: [liftId], signs: [{ p: [27.5, 10.7], face: 180 }] }); assert.equal(at4(s11b).factors.E, 1, 'the same sign in the corridor covers');
  console.log('PASS 11 a sign behind a wall does not cover the point; the same sign in the corridor does');
  // 12. moving the sign away (20 m) and running again: the point is uncovered and scores again
  const s12 = run({ starts: [liftId], signs: [{ p: [10, 11.8], face: 180 }] }), X12 = at4(s12); assert.equal(X12.factors.E, 0); assert.equal(X12.score, X6.score);
  console.log('PASS 12 the sign moved 20 m away: the crossing is uncovered again on the rerun');
  // the same input, the same output
  const a1 = JSON.stringify(run().nodes.map((n) => [n.p, n.score, n.factors])), a2 = JSON.stringify(run().nodes.map((n) => [n.p, n.score, n.factors])); assert.equal(a1, a2);
  // the entrance of a destination: seen from how far back, similar doors near
  const e = r.entrances.find((x) => x.room === 'Patient room 303'); assert(e && e.similar >= 2 && e.seenFrom > 0, JSON.stringify(e)); console.log(`PASS entrance of Patient room 303: in sight ${e.seenFrom} m before, ${e.similar} similar doors within 8 m: ${e.verdict}`);
  console.log(`PASS the same input gives the same output; ${r.stats.points} candidate points, ${r.stats.recommended} recommended, coverage ${(r.stats.coverage * 100).toFixed(0)} %`);
})().catch((e) => { console.error(e); process.exit(1); });
