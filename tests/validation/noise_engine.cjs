// Outdoor noise engine (emb/noise.html) against closed-form acoustics, using the engine's own functions as they ship:
//   1. a road as a line source in free field: the exact integral of a finite incoherent line (cylindrical spreading)
//   2. screening by a thin wall and by a building: ISO 9613-2:1996 eq. 14, Dz = 10 lg(3 + C2·C3·N) with N = 2δ/λ, C2 = 20,
//      C3 = 1 for one edge, [1 + (5λ/e)²] / [1/3 + (5λ/e)²] for two edges e apart; Dz at most 20 dB (one edge) or 25 dB (two).
// The engine uses one wavelength (λ = 0.68 m, 500 Hz) for traffic noise, as ISO 9613-2's single-frequency simplification allows.
// Usage: node tests/validation/noise_engine.cjs [engine.html] — writes noise_engine.out.json; exit 1 when a tolerance is missed.
const path = require('path'), fs = require('fs'), engineFns = require('./engine_fn.cjs');
const page = process.argv[2] || path.join(__dirname, '../../emb/noise.html'), lib = path.join(path.dirname(page), 'lib/plansim.js');
const P = engineFns(lib, ['segCross', 'inPoly']); globalThis.__P = P;
const make = (roads) => { globalThis.__ROADS = roads; return engineFns(page, ['shield', 'elements', 'level'], 'const segCross = globalThis.__P.segCross, inPoly = globalThis.__P.inPoly, dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), clamp = (v, a, b) => Math.max(a, Math.min(b, v)); const LAMBDA = 0.68, HS = 0.5; let ROADS = globalThis.__ROADS;'); };
const LAM = 0.68, HS = 0.5, out = { free: [], barrier: [] }; let fail = 0;
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
console.log('Free field (road as a line source):'); for (const r of out.free) console.log(`  ${String(r.d).padStart(4)} m  engine ${r.engine.toFixed(2)} dB  exact ${r.exact.toFixed(2)} dB  ${r.diff >= 0 ? '+' : ''}${r.diff.toFixed(3)}  ${r.ok ? 'ok' : 'FAILED'}`);
console.log('Screening (ISO 9613-2 eq. 14):'); for (const r of out.barrier) console.log(`  ${r.name.padEnd(48)} δ ${r.delta.toFixed(2)} m  engine ${r.engine.toFixed(2)} dB  ISO ${r.iso.toFixed(2)} dB  ${r.diff >= 0 ? '+' : ''}${r.diff.toFixed(2)}  ${r.ok ? 'ok' : 'FAILED'}`);
fs.writeFileSync(path.join(__dirname, 'noise_engine.out.json'), JSON.stringify(out, null, 1));
console.log(fail ? `${fail} outside the tolerance (0.1 dB)` : 'All within 0.1 dB.'); process.exitCode = fail ? 1 : 0;
