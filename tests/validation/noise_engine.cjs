// Outdoor noise engine (emb/noise.html) against closed-form acoustics, using the engine's own functions as they ship:
//   1. a road as a line source in free field: the exact integral of a finite incoherent line (cylindrical spreading)
//   2. screening by a thin wall and by a building: ISO 9613-2:1996 eq. 14, Dz = 10 lg(3 + C2·C3·N) with N = 2δ/λ, C2 = 20,
//      C3 = 1 for one edge, [1 + (5λ/e)²] / [1/3 + (5λ/e)²] for two edges e apart; Dz at most 20 dB (one edge) or 25 dB (two).
// The engine uses one wavelength (λ = 0.68 m, 500 Hz) for traffic noise, as ISO 9613-2's single-frequency simplification allows.
// Usage: node tests/validation/noise_engine.cjs [engine.html] — writes noise_engine.out.json; exit 1 when a tolerance is missed.
const path = require('path'), fs = require('fs'), engineFns = require('./engine_fn.cjs');
const page = process.argv[2] || path.join(__dirname, '../../emb/noise.html'), lib = path.join(path.dirname(page), 'lib/plansim.js');
const P = engineFns(lib, ['segCross', 'inPoly']); globalThis.__P = P;
const make = (roads) => { globalThis.__ROADS = roads; return engineFns(page, ['shield', 'elements', 'level', 'groundAtt'], 'const segCross = globalThis.__P.segCross, inPoly = globalThis.__P.inPoly, dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), clamp = (v, a, b) => Math.max(a, Math.min(b, v)); const LAMBDA = 0.68, HS = 0.5; let ROADS = globalThis.__ROADS;'); };
const LAM = 0.68, HS = 0.5, out = { free: [], barrier: [], ground: [] }; let fail = 0;
// 1 · free field: a straight road 4 km long, level 70 dB at 10 m (the engine's road level), receivers 1.5 m high
{ const L = 70, half = 2000, E = make([{ L, pts: [[-half, 0], [half, 0]] }]), el = E.elements(1.25), k = 10 * Math.pow(10, L / 10) / Math.PI;
  for (const d of [5, 10, 20, 50, 100, 200]) { const h = Math.hypot(d, 1.5 - HS), ref = 10 * Math.log10(k / h * 2 * Math.atan(half / h)), got = E.level([], el, [0, d], 1.5), ok = Math.abs(got - ref) <= 0.1;
    if (!ok) fail++; out.free.push({ d, engine: +got.toFixed(3), exact: +ref.toFixed(3), diff: +(got - ref).toFixed(3), ok }); } }
// 2 · screening on the perpendicular path, source 0.5 m high on the road, receiver 1.5 m high
{ const E = make([]), slab = (y, t, H, len = 2000) => { const Pp = [[-len, y], [len, y], [len, y + t], [-len, y + t]]; return { P: Pp, base: 0, top: H, b: { x0: -len, x1: len, y0: y, y1: y + t }, hull: Pp, role: 'context' }; };
  const cases = [['thin wall, 3 m, 5 m from the road, receiver at 15 m', 5, 0.2, 3, 15], ['thin wall, 2 m, close receiver', 3, 0.2, 2, 6], ['thin wall, 5 m, receiver at 30 m', 5, 0.2, 5, 30], ['thin wall, 10 m (limit)', 5, 0.2, 10, 15],
    ['building 12 m deep, 9 m high, receiver at 40 m', 10, 12, 9, 40], ['building 8 m deep, 6 m high, receiver at 30 m', 10, 8, 6, 30], ['building 15 m deep, 4 m high, receiver at 45 m', 12, 15, 4, 45]];
  for (const [name, yb, t, H, yr] of cases) { const got = E.shield([slab(yb, t, H)], [0, 0], [0, yr], 1.5);
    const dss = Math.hypot(yb, H - HS), dsr = Math.hypot(yr - yb - t, H - 1.5), d = Math.hypot(yr, 1.5 - HS), delta = dss + t + dsr - d, two = t >= 1, C3 = (1 + (5 * LAM / t) ** 2) / (1 / 3 + (5 * LAM / t) ** 2);
    const iso = Math.min(10 * Math.log10(3 + 20 * C3 * 2 * delta / LAM), two ? 25 : 20), ok = Math.abs(got - iso) <= 0.1; if (!ok) fail++;
    out.barrier.push({ name, delta: +delta.toFixed(3), e: t, C3: +C3.toFixed(3), engine: +got.toFixed(2), iso: +iso.toFixed(2), diff: +(got - iso).toFixed(2), ok }); } }
// 3 · soft ground and air (2026-10-25): ISO 9613-2 eq. 10, A_gr = 4.8 − (2 h_m / d)(17 + 300 / d) ≥ 0, applied to each piece of the road
//     and integrated independently here (0.05 m pieces); air 1.9 dB/km (ISO 9613-1 at 500 Hz, 10 °C, 70 %: ISO 9613-2 Table 2);
//     behind a building, the larger of screening and ground counts (eq. 12: A_bar = D_z − A_gr ≥ 0, so A_gr + A_bar = max).
{ const L = 70, half = 2000, E = make([{ L, pts: [[-half, 0], [half, 0]] }]), el = E.elements(1.25), k = 10 * Math.pow(10, L / 10) / Math.PI, AIR = 1.9e-3;
  const agr = (d, hm) => Math.max(0, 4.8 - (2 * hm / d) * (17 + 300 / d));
  for (const [d, soft, air] of [[10, 1, 0], [30, 1, 0], [100, 1, 0], [200, 1, 0], [30, 0.5, 0], [100, 0, AIR], [200, 1, AIR]]) {
    let I = 0; const st = 0.05; for (let x = -half + st / 2; x < half; x += st) { const hd = Math.hypot(x, d), d3 = Math.hypot(hd, 1.5 - HS); I += k * st / (d3 * d3) * Math.pow(10, -(soft * agr(Math.max(1, d3), (HS + 1.5) / 2) + AIR * 0 + air * d3) / 10); }
    const ref = 10 * Math.log10(I), got = E.level([], el, [0, d], 1.5, { G: () => soft, air }), ok = Math.abs(got - ref) <= 0.1; if (!ok) fail++;
    out.ground.push({ case: `${d} m, soft ${soft * 100} %${air ? ', air' : ''}`, engine: +got.toFixed(3), reference: +ref.toFixed(3), diff: +(got - ref).toFixed(3), ok }); }
  // eq. 12 behind a 3 m wall 5 m from the road, receiver at 15 m on soft ground: the larger of the two
  const wall = [{ P: [[-2000, 5], [2000, 5], [2000, 5.2], [-2000, 5.2]], base: 0, top: 3, b: { x0: -2000, x1: 2000, y0: 5, y1: 5.2 }, hull: [[-2000, 5], [2000, 5], [2000, 5.2], [-2000, 5.2]], role: 'context' }];
  const one = [{ p: [0, 0], w: 1 }], Dz = E.shield(wall, [0, 0], [0, 15], 1.5), Ag = E.groundAtt(Math.hypot(15, 1), 1), got = -(E.level(wall, one, [0, 15], 1.5, { G: () => 1 }) + 10 * Math.log10(15 ** 2 + (1.5 - HS) ** 2));   // one source of unit weight: L = 10 lg(1/d²) − A
  const ok = Math.abs(got - Math.max(Dz, Ag)) <= 0.01; if (!ok) fail++; out.ground.push({ case: 'behind a 3 m wall on soft ground: max(screening, ground)', engine: +got.toFixed(3), reference: +Math.max(Dz, Ag).toFixed(3), diff: +(got - Math.max(Dz, Ag)).toFixed(3), ok }); }
console.log('Free field (road as a line source):'); for (const r of out.free) console.log(`  ${String(r.d).padStart(4)} m  engine ${r.engine.toFixed(2)} dB  exact ${r.exact.toFixed(2)} dB  ${r.diff >= 0 ? '+' : ''}${r.diff.toFixed(3)}  ${r.ok ? 'ok' : 'FAILED'}`);
console.log('Screening (ISO 9613-2 eq. 14):'); for (const r of out.barrier) console.log(`  ${r.name.padEnd(48)} δ ${r.delta.toFixed(2)} m  engine ${r.engine.toFixed(2)} dB  ISO ${r.iso.toFixed(2)} dB  ${r.diff >= 0 ? '+' : ''}${r.diff.toFixed(2)}  ${r.ok ? 'ok' : 'FAILED'}`);
console.log('Ground and air (ISO 9613-2 eq. 10 and 12, ISO 9613-1):'); for (const r of out.ground) console.log(`  ${r.case.padEnd(56)} engine ${r.engine.toFixed(2)} dB  reference ${r.reference.toFixed(2)} dB  ${r.diff >= 0 ? '+' : ''}${r.diff.toFixed(2)}  ${r.ok ? 'ok' : 'FAIL'}`);
fs.writeFileSync(path.join(__dirname, 'noise_engine.out.json'), JSON.stringify(out, null, 1));
console.log(fail ? `${fail} outside the tolerance (0.1 dB)` : 'All within 0.1 dB.'); process.exitCode = fail ? 1 : 0;
