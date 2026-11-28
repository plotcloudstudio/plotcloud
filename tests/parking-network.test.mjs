// The parking layout as a working lot (2026-11-28), mvp/js/parking.js, no browser:
// 1 the North American preset: Toronto Zoning By-law 569-2013 sizes and aisle widths by angle;
// 2 every aisle reached, a dead-end aisle ends in a turnaround that no stall sits on (or is allowed and counted);
// 3 one-way: neighbouring aisles run opposite ways, cross aisles at both ends close the loops, angled stalls lean the way traffic goes;
// 4 islands at the row ends and every 10 stalls, no stall on one;
// 5 accessible spaces raised to ADA 208.2 (vans 208.2.4) for the lot found, pairs sharing one access aisle, nearest the building door;
// 6 every stall numbered once (row letter + number), the schedule lists them all;
// 7 a car can drive from the entrance to the far end of the lot between the stalls and islands (route-plan.js).
import assert from 'node:assert/strict';
import * as P from '../mvp/js/parking.js';
import * as G from '../mvp/js/geom2d.js';
import * as RP from '../mvp/js/route-plan.js';
import * as V from '../mvp/js/vehicles.js';
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const overlap = (A, B) => !P.disjoint(A, B);

// 1 · presets
{ const c = P.categoriesFor('na'), st = c.find((x) => x.id === 'standard'), ac = c.find((x) => x.id === 'accessible');
  assert.deepEqual([st.w, st.l], [2.6, 5.6]); assert.equal(ac.accessAisle, 1.5);
  assert.deepEqual([90, 75, 60, 45, 30].map((a) => P.aisleFor(a, true, 'na')), [6.0, 6.0, 5.5, 4.0, 4.0]); assert.equal(P.aisleFor(60, false, 'na'), 6.0);
  assert.match(P.STANDARDS.na.src, /569-2013/);
  console.log('PASS the North American preset: 2.6 × 5.6 m stalls, aisles 6.0 / 5.5 / 4.0 m by angle (one-way), accessible aisle 1.5 m (Toronto 569-2013, Ch. 200)'); }

// 2 · the network: a 75 × 48 m lot, entrance on the west edge
const lot = { outer: rect(0, 0, 75, 48) }, ent = [[0, 24]];
{ const r = P.generate({ region: lot, entrances: ent, standard: 'na', angle: 90, quality: 'standard', seed: 1 }); assert(r.ok, r.error); const b = r.best;
  const ok = b.stalls.filter((s) => s.valid), T = b.turnarounds;
  assert(ok.length > 60, 'stalls: ' + ok.length); assert.equal(b.unreachedAisles, 0, 'every aisle reached');
  for (const s of ok) for (const t of T) assert(!overlap(s.footprint, t), 'no stall on a turnaround');
  for (const s of ok) for (const a of b.aisles) assert(!overlap(s.footprint, a.poly), 'no stall on an aisle');
  const allow = P.generate({ region: lot, entrances: ent, standard: 'na', angle: 90, deadEnds: 'allow', fixed: { angle: b.angle, offset: b.offset } }).best;
  assert(T.length === 0 || allow.total >= b.total, 'a turnaround costs stalls, never adds');
  console.log(`PASS the network: ${ok.length} stalls (North American sizes), every aisle reached, ${T.length} turnaround${T.length === 1 ? '' : 's'} with no stall on ${T.length === 1 ? 'it' : 'them'} (dead ends allowed: ${allow.total} stalls, ${allow.deadEnds} dead ends)`); }

// 2b · an L-shaped lot: rows forced north–south leave a dead end, which gets a turnaround; the free search finds a layout without
{ const L = { outer: [[0, 0], [80, 0], [80, 30], [35, 30], [35, 60], [0, 60]] }, o = { region: L, entrances: [[0, 15]], standard: 'na', angle: 90 };
  const t = P.generate({ ...o, fixed: { angle: 90, offset: 0 } }).best, a = P.generate({ ...o, fixed: { angle: 90, offset: 0 }, deadEnds: 'allow' }).best, f = P.generate(o).best;
  assert(t.turnarounds.length >= 1 && t.deadEnds >= 1, 'a dead end with a turnaround'); for (const s of t.stalls.filter((x) => x.valid)) for (const T of t.turnarounds) assert(!overlap(s.footprint, T));
  assert(a.total > t.total && a.deadEnds === t.deadEnds, 'allowing it keeps the stalls the turnaround takes'); assert(f.total >= t.total && f.deadEnds <= t.deadEnds, 'the free search prefers no dead end');
  console.log(`PASS an L-shaped lot north–south: ${t.deadEnds} dead end with a turnaround (${t.total} stalls; allowed without one: ${a.total}); the free search: ${f.total} stalls, ${f.deadEnds} dead ends at ${f.angle.toFixed(0)}°`); }

// 3 · one-way with 60° stalls
{ const r = P.generate({ region: lot, entrances: ent, standard: 'na', angle: 60, oneWay: true, fixed: { angle: 0, offset: 0 } }); assert(r.ok, r.error); const b = r.best;
  const lines = b.aisles.filter((a) => a.kind === 'aisle'), flows = [...new Set(lines.map((a) => a.flow))].sort();
  assert.deepEqual(flows, [-1, 1], 'neighbouring aisles run opposite ways'); assert.equal(b.oneWayOpen, 0, 'every pair of lines joined at both ends: loops');
  assert(b.aisles.filter((a) => a.kind === 'cross').every((a) => a.flow === 1 || a.flow === -1), 'cross aisles carry a direction');
  // lean: along x (angle 0), the far edge of an angled stall is shifted the way the row's traffic goes
  let checked = 0; for (const s of b.stalls.filter((x) => x.valid)) { const ys = s.poly.map((q) => q[1]), mid = (Math.max(...ys) + Math.min(...ys)) / 2, near = s.poly.filter((q) => Math.abs(q[1] - (s.rowKey % 2 ? Math.min(...ys) : Math.max(...ys))) < 1e-6), far = s.poly.filter((q) => !near.includes(q));
    if (near.length !== 2 || far.length !== 2) continue; const dx = (far[0][0] + far[1][0]) / 2 - (near[0][0] + near[1][0]) / 2; void mid; assert.equal(Math.sign(dx), s.lean, `stall ${s.no} leans with the traffic`); checked++; }
  assert(checked > 20, 'stalls checked: ' + checked);
  console.log(`PASS one-way at 60°: aisles alternate (${lines.length} lines), cross aisles at both ends close the loops, ${checked} stalls lean the way the traffic goes`); }

// 4 · islands
{ const r = P.generate({ region: lot, entrances: ent, standard: 'na', angle: 90, islands: { ends: true, every: 10 }, fixed: { angle: 0, offset: 0 } }); assert(r.ok, r.error); const b = r.best, ok = b.stalls.filter((s) => s.valid);
  assert(b.islands.filter((i) => i.kind === 'end').length >= 4 && b.islands.some((i) => i.kind === 'interior'), 'end and interior islands');
  for (const s of ok) for (const i of b.islands) assert(!overlap(s.footprint, i.poly), 'no stall on an island');
  const runs = new Map(); for (const s of ok) { const k = s.rowKey + ':' + s.rowAt[0]; runs.set(k, (runs.get(k) || 0) + 1); } assert(Math.max(...runs.values()) <= 10, 'at most 10 stalls between islands');
  console.log(`PASS islands: ${b.islands.filter((i) => i.kind === 'end').length} at row ends, ${b.islands.filter((i) => i.kind === 'interior').length} between every 10 stalls; ${ok.length} stalls, none on an island`); }

// 5 · accessible: ADA counts for the lot found, shared aisles, nearest the door
{ const door = [75, 46], r = P.generate({ region: lot, entrances: ent, doors: [door], standard: 'na', angle: 90, adaAuto: true, quality: 'standard' }); assert(r.ok, r.error); const b = r.best, ok = b.stalls.filter((s) => s.valid);
  const need = P.adaRequired(b.total), acc = ok.filter((s) => s.cat === 'accessible' || s.cat === 'van'), vans = ok.filter((s) => s.cat === 'van');
  assert(acc.length >= need.accessible && vans.length >= need.van, `ADA: ${acc.length} accessible (${vans.length} van) for ${b.total}; needs ${need.accessible} (${need.van})`);
  assert(ok.some((s) => s.sharedWith), 'a pair sharing one access aisle');
  const d = (s) => G.dist(G.centroid(s.poly), door), dAcc = acc.reduce((m, s) => m + d(s), 0) / acc.length, dAll = ok.reduce((m, s) => m + d(s), 0) / ok.length; assert(dAcc < dAll * 0.6, 'nearest the door');
  console.log(`PASS accessible: ${acc.length} placed (${vans.length} van) for ${b.total} stalls, ADA 208.2 asks ${need.accessible} (${need.van} van); pairs share an aisle; ${dAcc.toFixed(0)} m from the door on average (all stalls ${dAll.toFixed(0)} m)`); }

// 6 · numbers and the schedule; 7 · a car drives to the far corner
{ const r = P.generate({ region: lot, entrances: ent, standard: 'na', angle: 90, islands: { ends: true }, adaAuto: true }); const b = r.best, ok = b.stalls.filter((s) => s.valid), nos = ok.map((s) => s.no);
  assert.equal(new Set(nos).size, ok.length, 'each stall numbered once'); assert(nos.every((x) => /^[A-Z]+\d+$/.test(x))); assert.equal(b.schedule.length, b.total);
  const obs = [...ok.map((s, i) => ({ id: 's' + i, poly: s.footprint })), ...b.islands.map((x, i) => ({ id: 'i' + i, poly: x.poly }))], far = b.aisles.filter((a) => a.kind === 'aisle').map((a) => G.centroid(a.poly)).sort((p, q) => G.dist(q, ent[0]) - G.dist(p, ent[0]))[0];
  const pl = RP.planAround(V.byId('car'), { pts: [[1.5, 24], far] }, obs, { clearance: 0.2, startHeading: 0 });
  assert(pl.ok, 'a car reaches the far aisle: ' + pl.error);
  console.log(`PASS ${ok.length} stalls numbered ${nos[0]}…${nos.at(-1)}, the schedule lists ${b.schedule.length}; a car drives ${pl.length.toFixed(0)} m from the entrance to the far aisle between the stalls and islands`); }
