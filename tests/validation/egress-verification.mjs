// Verification and sensitivity experiments for the fire evacuation engine (mvp/js/interior/egress.js), for the research note
// "How accurate is the fire evacuation simulation?" (PlotCloud blog, 2026-11-10). Writes mvp/research/egress-verification.json.
// The tests follow the structure of IMO MSC.1/Circ.1533 Annex 3 (component tests 1, 2, 4, 5, 6, 7, 10) and the verification
// categories of NIST TN 1822 / ISO 20414: each compares the engine with an analytical (hand) result for a case simple enough to
// have one. They verify that the model does what its equations say; they do not validate it against real evacuations.
// Run: node tests/validation/egress-verification.mjs   (about a minute)
import * as E from '../../mvp/js/interior/egress.js';
import { writeFileSync } from 'node:fs';

// ---- geometry helpers: a level is { sc: { bounds, origin, walls, open, rooms, furn } } ------------------------------------------
const level = (i, w, h, build) => { const walls = [], open = [], rooms = [], furn = [];
  const wall = (a, b) => walls.push({ a, b, h: 3, t: 0.2 }), door = (id, a, b, ext = false) => open.push({ id, a, b, kind: 'door', ext }), room = (id, name, rects) => rooms.push({ id, name, rects });
  build({ wall, door, room, furn }); return { id: 'L' + i, name: 'Level ' + (i + 1), z: i * 4, h: 4, sc: { bounds: { w, h }, origin: [0, 0], walls, open, rooms, furn } }; };
const box = (wall, x0, y0, x1, y1) => { wall([x0, y0], [x1, y0]); wall([x1, y0], [x1, y1]); wall([x1, y1], [x0, y1]); wall([x0, y1], [x0, y0]); };
const person = (B, li, x, y, roomName = 'Office') => { const L = B.levels[li], k = B.cellAt(x, y); return { li, room: L.room[k], roomName, k }; };
const QUIET = { use: 'office', detect: 0, fire: 'none', incidents: false, slow: 0 };
const pct = (a, q) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length, sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const r2 = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const out = { generated: new Date().toISOString().slice(0, 10), engine: 'mvp/js/interior/egress.js', move: E.MOVE, tests: [], experiments: {} };
const report = (id, name, ref, expected, measured, unit, pass, note = '') => { const err = Number.isFinite(expected) && expected ? r2(100 * (measured - expected) / expected, 1) : null;
  out.tests.push({ id, name, ref, expected: r2(expected), measured: r2(measured), unit, errorPct: err, pass, note }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${name}: expected ${r2(expected)} ${unit}, measured ${r2(measured)} ${unit}${err != null ? ` (${err} %)` : ''}${note ? ' · ' + note : ''}`); };

// ---- V1 · speed in a corridor (IMO test 1): 40 m, 1 m/s, no pre-movement → 40 s. The engine counts a person out on reaching the
// doorway cells, so the expected time is the distance from the start to the first doorway cell
for (const cell of [0.5, 0.25]) {
  const b = { levels: [level(0, 44, 4, ({ wall, door, room }) => { box(wall, 1, 1, 42, 3); door('exit', [42, 1.2], [42, 2.8], true); room('c', 'Office', [[1, 1, 41, 2]]); })], stairs: [] };
  const B = E.prepare(b, { cell }), p = person(B, 0, 2.0, 2.0), x = E.simulateAll(B, [p], 1, { ...QUIET, v0: 1, pre: 0 });
  const exp = Math.min(...B.doors[0].cells.map((k) => B.ctr(k)[0])) - B.ctr(p.k)[0]; report('V1' + (cell === 0.5 ? '' : 'b'), `Speed in a corridor, ${cell} m grid`, 'IMO MSC.1/Circ.1533 test 1', exp, x.people[0].tOut, 's', Math.abs(x.people[0].tOut - exp) <= 0.5 + 1e-9, 'tolerance: one time step (0.5 s)');
}

// ---- V2 · speed on a stair (IMO tests 2-3): one flight at a fixed stair speed; each flight is drawn ±15 % at random (mean 1) -------
{ const lv = (i) => level(i, 20, 8, ({ wall, door, room }) => { box(wall, 1, 1, 18, 7); wall([12, 1], [12, 7]); door('sd' + i, [12, 3.3], [12, 4.7]); if (!i) door('exit', [1, 3.2], [1, 4.8], true); room('o' + i, 'Office', [[1, 1, 11, 6]]); room('s' + i, 'Stair', [[12, 1, 6, 6]]); });
  const b = { levels: [lv(0), lv(1)], stairs: [{ id: 'S', lv: 'L0', top: 'L1', corners: [[13, 2], [17, 2], [17, 6], [13, 6]], w: 4, d: 1.4, name: 'Stair' }] };
  const B = E.prepare(b), S = B.stairs[0], ts = []; for (let s = 1; s <= 200; s++) ts.push(E.simulateAll(B, [person(B, 1, 11, 4)], s, { ...QUIET, v0: 1, vs: 0.5, pre: 0 }).people[0].stairS);
  report('V2', 'Speed on a stair (one flight, 0.5 m/s)', 'IMO MSC.1/Circ.1533 tests 2-3', S.len / 0.5, mean(ts), 's', Math.abs(mean(ts) - S.len / 0.5) / (S.len / 0.5) < 0.05, `flight length ${r2(S.len)} m (the rise × 1.75); mean of 200 runs, range ${r2(Math.min(...ts))}-${r2(Math.max(...ts))} s`); }

// ---- V3 · flow through a door (IMO test 4): 100 people, 1 m door → at most 1.33 p/s; SFPE: 1.32 × (1 − 2 × 0.15) = 0.92 p/s ------
for (const [dw, cell] of [[1, 0.5], [2, 0.5], [1, 0.25]]) {
  const b = { levels: [level(0, 14, 12, ({ wall, door, room }) => { box(wall, 1, 1, 13, 11); door('exit', [13, 6 - dw / 2], [13, 6 + dw / 2], true); room('r', 'Office', [[1, 1, 12, 10]]); })], stairs: [] };
  const B = E.prepare(b, { cell }), ppl = []; for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) ppl.push(person(B, 0, 2 + i * 0.8, 2 + j * 0.8));
  const x = E.simulateAll(B, ppl, 1, { ...QUIET, v0: 1, pre: 0 }), t = x.people.map((q) => q.tOut).sort((a, c) => a - c), flow = (t.length - 1) / (t[t.length - 1] - t[0]), exp = E.MOVE.doorFs * (dw - 2 * E.MOVE.layer);
  report('V3' + (dw === 2 ? 'b' : cell === 0.25 ? 'c' : ''), `Flow through a ${dw} m door, 100 people, ${cell} m grid`, 'IMO test 4; SFPE specific flow', exp, flow, 'p/s', flow <= 1.33 * dw + 1e-9 && Math.abs(flow - exp) / exp < 0.1, `IMO limit ${r2(1.33 * dw)} p/s; ${x.unfinished} not out`);
}

// ---- V4 · pre-movement times (IMO test 5): the lognormal of the building use through its 1st and 99th percentiles -------------------
{ const b = { levels: [level(0, 34, 34, ({ wall, door, room }) => { box(wall, 1, 1, 33, 33); door('exit', [33, 15], [33, 19], true); room('r', 'Office', [[1, 1, 32, 32]]); })], stairs: [] };
  const B = E.prepare(b), pre = []; for (let s = 1; s <= 20; s++) { const ppl = []; for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) ppl.push(person(B, 0, 3 + i * 3, 3 + j * 3)); const x = E.simulateAll(B, ppl, s, { ...QUIET, use: 'office', v0: 1.2 }); pre.push(...x.people.map((q) => q.pre)); }
  const U = E.USES.office; report('V4a', 'Pre-movement, 1st percentile (office)', 'IMO test 5; PD 7974-6', U.p1, pct(pre, 0.01), 's', Math.abs(pct(pre, 0.01) - U.p1) / U.p1 < 0.15, `${pre.length} people`);
  report('V4b', 'Pre-movement, median (office)', 'IMO test 5; PD 7974-6', Math.sqrt(U.p1 * U.p99), pct(pre, 0.5), 's', Math.abs(pct(pre, 0.5) - Math.sqrt(U.p1 * U.p99)) / Math.sqrt(U.p1 * U.p99) < 0.1);
  report('V4c', 'Pre-movement, 99th percentile (office)', 'IMO test 5; PD 7974-6', U.p99, pct(pre, 0.99), 's', Math.abs(pct(pre, 0.99) - U.p99) / U.p99 < 0.15); }

// ---- V5 · rounding a corner (IMO test 6): 20 people round an L-shaped corridor, nobody through the walls ----------------------------
{ const b = { levels: [level(0, 16, 16, ({ wall, door, room }) => { wall([1, 1], [13, 1]); wall([13, 1], [13, 15]); wall([13, 15], [11, 15]); wall([11, 15], [11, 3]); wall([11, 3], [1, 3]); wall([1, 3], [1, 1]); door('exit', [11.2, 15], [12.8, 15], true); room('c', 'Office', [[1, 1, 12, 2], [11, 1, 2, 14]]); })], stairs: [] };
  const B = E.prepare(b), ppl = []; for (let i = 0; i < 10; i++) for (const y of [1.6, 2.4]) { const p = person(B, 0, 1.6 + i * 0.5, y); if (B.levels[0].walk[p.k]) ppl.push(p); }
  const x = E.simulateAll(B, ppl, 1, { ...QUIET, v0: 1, pre: 0 }), minPath = Math.min(...x.people.map((q) => q.dist)), geo = Math.min(...ppl.map((p) => { const [px, py] = B.ctr(p.k); return Math.max(0, 11.25 - px) + Math.hypot(0.75, py - 2.25) * 0 + (15 - py) - 0.75; }));
  report('V5', `Rounding a corner, ${ppl.length} people`, 'IMO test 6', 0, x.unfinished + x.stuck, 'people not out', x.unfinished === 0 && x.stuck === 0 && minPath >= geo - 1, `shortest walk ${r2(minPath)} m against the corner-hugging path ${r2(geo)} m`); }

// ---- G1 · what the grid keeps of a corridor: walkable width of a 2 m corridor (walls 0.2 m on the centre lines) ------------------
for (const cell of [0.5, 0.25]) { const b = { levels: [level(0, 12, 6, ({ wall, room }) => { wall([1, 1], [11, 1]); wall([1, 3], [11, 3]); room('c', 'Corridor', [[1, 1, 10, 2]]); })], stairs: [] }, B = E.prepare(b, { cell }); let n = 0; const i = Math.round(6 / cell); for (let j = 0; j < B.H; j++) if (B.levels[0].walk[j * B.W + i]) n++;
  report('G1' + (cell === 0.5 ? '' : 'b'), `Walkable width of a 2 m corridor (1.8 m clear), ${cell} m grid`, 'discretisation', 1.8, n * cell, 'm', true, 'reported, not a pass/fail test'); }

// ---- V6 · demographics (IMO test 7): sampled walking speeds against the input distribution ------------------------------------------
{ const b = { levels: [level(0, 34, 34, ({ wall, door, room }) => { box(wall, 1, 1, 33, 33); door('exit', [33, 15], [33, 19], true); room('r', 'Office', [[1, 1, 32, 32]]); })], stairs: [] };
  const B = E.prepare(b), v = [], vi = []; for (let s = 1; s <= 20; s++) { const ppl = []; for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) ppl.push(person(B, 0, 3 + i * 3, 3 + j * 3)); const x = E.simulateAll(B, ppl, s, { use: 'office', detect: 0, fire: 'none', incidents: false, slow: 0.04, horizon: 1 }); for (const q of x.people) (q.kind === 'imp' ? vi : v).push(q.v0); }
  report('V6a', 'Walking speed, mean (adults)', 'IMO test 7; SFPE 1.19 m/s', E.MOVE.vLevel, mean(v), 'm/s', Math.abs(mean(v) - E.MOVE.vLevel) < 0.02, `SD ${r2(sd(v))} m/s (input 0.2, truncated 0.6-1.6); ${v.length} people`);
  report('V6b', 'Walking speed, mean (walking aids)', 'IMO test 7; Boyce et al. 1999', E.MOVE.vAid, mean(vi), 'm/s', Math.abs(mean(vi) - E.MOVE.vAid) < 0.05, `${vi.length} people, share ${r2(100 * vi.length / (v.length + vi.length), 1)} % (input 4 %)`); }

// ---- V7 · exit route allocation (IMO test 10): one person per room in a corridor block with an exit at each end ----------------------
{ const b = { levels: [level(0, 44, 14, ({ wall, door, room }) => { box(wall, 1, 1, 43, 13); wall([1, 6], [43, 6]); wall([1, 8], [43, 8]); door('w', [1, 6.2], [1, 7.8], true); door('e', [43, 6.2], [43, 7.8], true); room('cw', 'Corridor', [[1, 6, 42, 2]]);
    for (let k = 0; k < 6; k++) { const x0 = 1 + k * 7; wall([x0 + 7, 1], [x0 + 7, 6]); room('r' + k, 'Office ' + k, [[x0, 1, 7, 5]]); door('d' + k, [x0 + 2.9, 6], [x0 + 4.1, 6]); } })], stairs: [] };
  const B = E.prepare(b), ppl = []; for (let k = 0; k < 6; k++) ppl.push(person(B, 0, 1 + k * 7 + 3.5, 3.5, 'Office ' + k));
  const x = E.simulateAll(B, ppl, 1, { ...QUIET, v0: 1, pre: 0 }), west = B.doors.find((d) => d.id === 'w').di, ok = x.people.filter((q, i) => (i < 3 ? q.exit === west : q.exit !== west)).length;
  report('V7', 'Nearest exit taken (uncongested)', 'IMO test 10', 6, ok, 'of 6 people', ok === 6);
  // V8 · a blocked exit: nobody leaves by it, everyone by the other
  const y = E.simulateAll(B, ppl, 1, { ...QUIET, v0: 1, pre: 0, incidents: true, blockExit: 'w', childShare: 0, fallScale: 0 });
  report('V8', 'An exit found blocked: all use the other', 'model feature', 6, y.people.filter((q) => q.exit !== west && Number.isFinite(q.tOut)).length, 'of 6 people', y.people.every((q) => q.exit !== west && Number.isFinite(q.tOut)));
  // V9 · the room of fire origin is not passed through: the short way from the west office runs through the meeting room; with the
  // fire there the person takes the corridor (a longer walk), and the meeting room's own occupant still gets out
  const b2 = { levels: [level(0, 30, 12, ({ wall, door, room }) => { box(wall, 1, 1, 29, 11); wall([1, 6], [20, 6]); wall([20, 1], [20, 11]); wall([10, 6], [10, 11]); door('x', [29, 5.2], [29, 6.8], true); door('a', [20, 2.8], [20, 4.2]); door('t1', [10, 8.2], [10, 9.6]); door('t2', [20, 8.3], [20, 9.7]); door('p', [4.3, 6], [5.7, 6]);
    room('cr', 'Corridor', [[1, 1, 19, 5]]); room('h', 'Office west', [[1, 6, 9, 5]]); room('t', 'Meeting', [[10, 6, 10, 5]]); room('e', 'Office east', [[20, 1, 9, 10]]); })], stairs: [] };
  const B2 = E.prepare(b2), w0 = person(B2, 0, 5, 9, 'Office west'), m0 = person(B2, 0, 15, 9, 'Meeting'), free = E.simulateAll(B2, [w0, m0], 1, { ...QUIET, v0: 1, pre: 0 }), fire = E.simulateAll(B2, [w0, m0], 1, { ...QUIET, v0: 1, pre: 0, fire: { li: 0, room: m0.room } });
  report('V9', 'Not through the room of fire origin', 'model feature', free.people[0].dist, fire.people[0].dist, 'm walked', fire.people[0].dist > free.people[0].dist + 2 && fire.unfinished === 0, `${r2(free.people[0].dist)} m through the meeting room without the fire, ${r2(fire.people[0].dist)} m round by the corridor with it; its own occupant out in ${r2(fire.people[1].tOut)} s`); }

// ---- V10 · against an SFPE hydraulic hand calculation: a three-storey office block (one stair, one exit) --------------------------
const block = (n, roomName = 'Office') => { const lv = (i) => level(i, 38, 14, ({ wall, door, room, furn }) => { box(wall, 1, 1, 37, 13); wall([1, 6], [33, 6]); wall([1, 8], [33, 8]); wall([33, 1], [33, 13]); wall([17, 6], [17, 8]);
    for (const x of [9, 17, 25]) { wall([x, 1], [x, 6]); wall([x, 8], [x, 13]); } room('cw' + i, 'Corridor', [[1, 6, 32, 2]]); room('st' + i, 'Stair', [[33, 1, 4, 12]]);
    for (const [k, x] of [1, 9, 17, 25].entries()) { room(`s${i}${k}`, `${roomName} ${i + 1}S${k + 1}`, [[x, 1, 8, 5]]); room(`n${i}${k}`, `${roomName} ${i + 1}N${k + 1}`, [[x, 8, 8, 5]]); door(`ds${i}${k}`, [x + 3.4, 6], [x + 4.6, 6]); door(`dn${i}${k}`, [x + 3.4, 8], [x + 4.6, 8]);
      if (roomName === 'Ward') for (const bx of [x + 1, x + 5.5]) { furn.push({ id: `b${i}${k}s${bx}`, x: bx, y: 2, w: 1, d: 2.1, h: 0.6, name: 'Bed' }, { id: `b${i}${k}n${bx}`, x: bx, y: 10, w: 1, d: 2.1, h: 0.6, name: 'Bed' }); } }
    door('smoke' + i, [17, 6.2], [17, 7.8]); door('stair' + i, [33, 6.3], [33, 7.7]); if (!i) door('exit', [1, 6.2], [1, 7.8], true); });
  const levels = Array.from({ length: n }, (_, i) => lv(i)), stairs = []; for (let i = 0; i < n - 1; i++) stairs.push({ id: 'S' + i, lv: 'L' + i, top: 'L' + (i + 1), corners: [[34, 3], [35.4, 3], [35.4, 11], [34, 11]], w: 1.4, d: 8, name: 'Stair' }); return { levels, stairs }; };
{ const B = E.prepare(block(3)), ppl = E.occupants(B), x = E.simulateAll(B, ppl, 1, { ...QUIET, v0: E.MOVE.vLevel, vs: E.MOVE.vStair, pre: 0 }), S = B.stairs[0];
  const nAbove = ppl.filter((p) => p.li > 0).length, fStair = E.MOVE.stairFs * (S.width - 2 * E.MOVE.layer), fExit = E.MOVE.doorFs * (1.6 - 2 * E.MOVE.layer);
  const fD = B.field('down', 1, B.stairs.filter((s) => s.hi === 1).flatMap((s) => s.acc[1]), false), first = Math.min(...ppl.filter((p) => p.li === 1).map((p) => fD[p.k])) * B.c / E.MOVE.vLevel;
  const fE = B.field('exit', 0, B.doors.filter((d) => d.ext).flatMap((d) => d.cells), false), foot = Math.min(...S.acc[0].map((k) => fE[k])) * B.c / E.MOVE.vLevel;
  // hand: the first person from level 2 reaches the stair, the flight to level 1 is the controlling component (people from level 3 merge), then the walk to the exit
  const hand = first + S.len / E.MOVE.vStair + nAbove / fStair + foot, ctrl = nAbove / fStair > ppl.length / fExit ? 'stair' : 'exit';
  report('V10', 'Three-storey office block against an SFPE hand calculation', 'SFPE hydraulic method (Gwynne & Rosenbaum 2016)', hand, x.t, 's', Math.abs(x.t - hand) / hand < 0.2, `${ppl.length} people, ${nAbove} on the upper floors; controlling: ${ctrl} (${r2(fStair)} p/s on the stair, ${r2(fExit)} p/s at the exit)`); }

// ---- E1 · Monte Carlo convergence (after Ronchi, Reneke & Peacock 2014): how many runs until the mean and P90 settle ---------------
{ const B = E.prepare(block(3, 'Waiting')), ppl = E.occupants(B), ts = [];
  for (let s = 1; s <= 300; s++) { for (const d of B.doors) d.tokens = 0; ts.push(E.simulateAll(B, ppl, s * 7919, { use: 'retail', detect: 60 }).t); }
  const runMean = ts.map((_, i) => mean(ts.slice(0, i + 1))), runP90 = ts.map((_, i) => pct(ts.slice(0, i + 1), 0.9));
  const settle = (a, tol, w = 20) => { for (let i = w; i < a.length; i++) { let ok = true; for (let j = i; j < a.length && j < i + w; j++) if (Math.abs(a[j] - a[j - 1]) / a[j - 1] > tol) ok = false; if (ok && a.slice(i, i + w).length === w) return i; } return null; };
  out.experiments.convergence = { building: 'three-storey block of waiting rooms, everyone out, alarm 60 s, shop or assembly pre-movement, incidents on', people: ppl.length, runs: ts.length,
    mean: r2(mean(ts), 1), sd: r2(sd(ts), 1), p10: r2(pct(ts, 0.1), 1), p50: r2(pct(ts, 0.5), 1), p90: r2(pct(ts, 0.9), 1), min: r2(Math.min(...ts), 1), max: r2(Math.max(...ts), 1),
    runsMean1pct: settle(runMean, 0.01), runsP90_1pct: settle(runP90, 0.01), runsMean0_5pct: settle(runMean, 0.005), ci95: r2(1.96 * sd(ts) / Math.sqrt(ts.length), 1),
    at: [10, 20, 50, 100, 300].map((n) => ({ n, mean: r2(runMean[n - 1], 1), p90: r2(runP90[n - 1], 1), ci95: r2(1.96 * sd(ts.slice(0, n)) / Math.sqrt(n), 1) })) };
  console.log('E1 convergence', JSON.stringify(out.experiments.convergence)); }

// ---- E2 · sensitivity to the incidents (everyone out, the same block, 100 runs each) -----------------------------------------------
{ const B = E.prepare(block(3, 'Waiting')), ppl = E.occupants(B), set = (o) => { const ts = []; for (let s = 1; s <= 100; s++) { for (const d of B.doors) d.tokens = 0; ts.push(E.simulateAll(B, ppl, s * 7919, { use: 'retail', detect: 60, ...o }).t); } return { p50: r2(pct(ts, 0.5), 1), p90: r2(pct(ts, 0.9), 1), mean: r2(mean(ts), 1) }; };
  out.experiments.incidents = [['No incidents', { incidents: false }], ['Default incidents', {}], ['Falls twice as likely', { fallScale: 2 }], ['No falls', { fallScale: 0 }], ['Twice the children', { childShare: 0.3 }], ['A third of people slow (walking aids)', { slow: 0.33 }]].map(([name, o]) => ({ name, ...set(o) }));
  console.log('E2 incidents', JSON.stringify(out.experiments.incidents)); }

// ---- E3 · the hospital strategy on a three-storey ward block: staffing, preparation times (50 runs each) -------------------------
{ const b = block(3, 'Ward'), set = async (o) => { const r = await E.run(b, { strategy: 'down', runs: 50, seed: 3, ...o }); return { p10: r2(r.p10 / 60, 1), p50: r2(r.med / 60, 1), p90: r2(r.p90 / 60, 1), stage1: r2(pct(r.runs.map((x) => x.t1), 0.5) / 60, 1), unfinished: r.runs.reduce((s, x) => s + x.unfinished, 0) }; };
  out.experiments.hospital = [];
  for (const [name, o] of [['Day staffing 1:4, preparation times on', {}], ['Day staffing, no preparation times (the model before)', { prep: false }], ['Night staffing 1:8', { ratio: 8 }], ['More dependent patients (20 % walk, 40 % helped, 40 % bed)', { mix: { amb: 0.2, asst: 0.4, bed: 0.4 } }], ['No incidents', { incidents: false }]]) out.experiments.hospital.push({ name, ...(await set(o)) });
  console.log('E3 hospital', JSON.stringify(out.experiments.hospital)); }

out.summary = { tests: out.tests.length, passed: out.tests.filter((t) => t.pass).length };
writeFileSync(new URL('../../mvp/research/egress-verification.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`${out.summary.passed} of ${out.summary.tests} verification tests pass; written mvp/research/egress-verification.json`);
if (out.summary.passed < out.summary.tests) process.exitCode = 1;
