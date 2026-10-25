// Indoor acoustics engine (emb/roomacoustics.html), using the engine's own functions as they ship:
//   1. air absorption against ISO 9613-1:1993 Table 1 values (as reprinted in ISO 9613-2 Table 2), six conditions, 63 Hz–4 kHz bands used
//   2. reverberation time against an independent stochastic ray tracing of the room's energy decay (shoeboxes, Lambert-diffuse walls,
//      air absorption on the paths), T30 fitted from −5 to −35 dB. Uniform absorption: Eyring within 10 %. Uneven absorption (an
//      absorbing ceiling over hard walls) is where diffuse-field formulas are known to fail; it is reported, not judged.
// Usage: node tests/validation/room_acoustics.cjs [engine.html] — writes room_acoustics.out.json; exit 1 when a tolerance is missed.
const path = require('path'), fs = require('fs'), engineFns = require('./engine_fn.cjs');
const page = process.argv[2] || path.join(__dirname, '../../emb/roomacoustics.html');
const E = engineFns(page, ['airM', 'roomRT', 'dinTarget', 'stiRev'], 'const STI_W = [0.13, 0.14, 0.11, 0.12, 0.19, 0.17, 0.14];');
const BANDS = [125, 250, 500, 1000, 2000, 4000], out = { air: [], rt: [], uneven: [] }; let fail = 0;
const dBkm = (f, t, rh) => E.airM(f, t, rh) * 10 * Math.LOG10E * 1000;

// 1 · ISO 9613 table (dB/km) at 125 Hz … 4 kHz
const ISO = [[10, 70, [0.4, 1.0, 1.9, 3.7, 9.7, 32.8]], [20, 70, [0.3, 1.1, 2.8, 5.0, 9.0, 22.9]], [30, 70, [0.3, 1.0, 3.1, 7.4, 12.7, 23.1]],
  [15, 20, [0.6, 1.2, 2.7, 8.2, 28.2, 88.8]], [15, 50, [0.5, 1.2, 2.2, 4.2, 10.8, 36.2]], [15, 80, [0.3, 1.1, 2.4, 4.1, 8.3, 23.7]]];
for (const [t, rh, ref] of ISO) BANDS.forEach((f, i) => { const got = dBkm(f, t, rh), ok = Math.abs(got - ref[i]) <= Math.max(0.06, 0.03 * ref[i]); if (!ok) fail++;
  out.air.push({ t, rh, f, engine: +got.toFixed(2), iso: ref[i], ok }); });

// 2 · the reference: rays from the centre, each reflection diffuse (Lambert) and losing α of its energy; the room's energy at time t
// is the sum over rays. Deterministic (seeded), so a run is repeatable.
let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function trace(L, W, H, alpha, m, c, N = 3000) {   // alpha(face) for faces 0..5 = x0, x1, y0, y1, z0 (floor), z1 (ceiling)
  const dt = 0.002, tMax = 6, bins = new Float64Array(Math.ceil(tMax / dt));
  for (let n = 0; n < N; n++) {
    let p = [L / 2 + 0.11, W / 2 + 0.07, H / 2 + 0.03], u = 2 * rnd() - 1, ph = 2 * Math.PI * rnd(), s = Math.sqrt(1 - u * u), d = [s * Math.cos(ph), s * Math.sin(ph), u], e = 1, t = 0;
    while (e > 1e-5 && t < tMax) {
      let best = Infinity, face = -1; const B = [L, W, H];
      for (let k = 0; k < 3; k++) { if (d[k] > 1e-12) { const q = (B[k] - p[k]) / d[k]; if (q < best) { best = q; face = 2 * k + 1; } } else if (d[k] < -1e-12) { const q = -p[k] / d[k]; if (q < best) { best = q; face = 2 * k; } } }
      const t1 = t + best / c; for (let b = Math.floor(t / dt); b < Math.min(bins.length, Math.ceil(t1 / dt)); b++) { const tm = Math.max(t, Math.min(t1, (b + 0.5) * dt)); bins[b] += e * Math.exp(-m * c * (tm - t)); }
      e *= Math.exp(-m * best); t = t1; p = p.map((v, k) => v + d[k] * best); e *= 1 - alpha[face];
      // Lambert: cosine-weighted about the inward normal
      const k = face >> 1, sg = face & 1 ? -1 : 1, r1 = rnd(), r2 = rnd(), cz = Math.sqrt(1 - r1), sz = Math.sqrt(r1), a = 2 * Math.PI * r2, o = [(k + 1) % 3, (k + 2) % 3];
      d = [0, 0, 0]; d[k] = sg * cz; d[o[0]] = sz * Math.cos(a); d[o[1]] = sz * Math.sin(a);
    }
  }
  const E0 = bins.reduce((a, b) => Math.max(a, b), 0), dB = [...bins].map((v) => 10 * Math.log10(v / E0 + 1e-30));
  let i0 = dB.findIndex((v) => v <= -5), i1 = dB.findIndex((v) => v <= -35); if (i0 < 0 || i1 < 0) return NaN;
  let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0; for (let i = i0; i <= i1; i++) { const x = i * dt; sx += x; sy += dB[i]; sxx += x * x; sxy += x * dB[i]; n++; }
  return -60 / ((n * sxy - sx * sy) / (n * sxx - sx * sx));
}
const tC = 20, c = 331.3 * Math.sqrt(1 + tC / 273.15);
const box = (L, W, H, al) => { const A = [W * H, W * H, L * H, L * H, L * W, L * W]; return { vol: L * W * H, surf: A.map((area, i) => ({ area, a: Array(6).fill(al[i]) })), extra: Array(6).fill(0) }; };
const cases = [['Bedroom 4 × 3.5 × 2.7, α 0.10', 4, 3.5, 2.7, 0.10, 500], ['Office 5 × 4 × 2.7, α 0.20', 5, 4, 2.7, 0.20, 1000], ['Classroom 9 × 7 × 3, α 0.30', 9, 7, 3, 0.30, 1000],
  ['Hall 20 × 15 × 6, α 0.15, 4 kHz (air counts)', 20, 15, 6, 0.15, 4000], ['Studio 6 × 6 × 3, α 0.05', 6, 6, 3, 0.05, 500]];
for (const [name, L, W, H, al, f] of cases) { const m = E.airM(f, tC, 50), b = BANDS.indexOf(f), R = E.roomRT(box(L, W, H, Array(6).fill(al)), BANDS.map((x) => E.airM(x, tC, 50)), tC)[b];
  const ref = trace(L, W, H, Array(6).fill(al), m, c), dev = (R.eyring - ref) / ref, ok = Math.abs(dev) <= 0.10; if (!ok) fail++;
  out.rt.push({ name, f, rays: +ref.toFixed(3), eyring: +R.eyring.toFixed(3), sabine: +R.sabine.toFixed(3), devEyring: +(dev * 100).toFixed(1), devSabine: +((R.sabine - ref) / ref * 100).toFixed(1), ok }); }
for (const [name, L, W, H, al] of [['Office with an absorbing ceiling (α 0.03 walls and floor, 0.80 ceiling)', 6, 5, 2.7, [0.03, 0.03, 0.03, 0.03, 0.03, 0.80]], ['Living room, carpet floor (α 0.03, floor 0.40)', 6, 4, 2.7, [0.03, 0.03, 0.03, 0.03, 0.40, 0.03]]]) {
  const R = E.roomRT(box(L, W, H, al), Array(6).fill(0), tC)[2], ref = trace(L, W, H, al, 0, c);
  out.uneven.push({ name, rays: +ref.toFixed(3), eyring: +R.eyring.toFixed(3), sabine: +R.sabine.toFixed(3), devEyring: +((R.eyring - ref) / ref * 100).toFixed(1), devSabine: +((R.sabine - ref) / ref * 100).toFixed(1) }); }
// 3 · sanity: STI 1 with no reverberation and falling as it grows; DIN 18041 A3 at 200 m³ is 0.57 s
const st = [0.01, 0.5, 1, 2, 4].map((t) => E.stiRev(Array(6).fill(t))), stOk = st[0] > 0.99 && st.every((v, i) => !i || v < st[i - 1]); if (!stOk) fail++;
const dinOk = Math.abs(E.dinTarget('A3', 200) - (0.32 * Math.log10(200) - 0.17)) < 1e-12 && E.dinTarget('A4', 600) === null; if (!dinOk) fail++;
out.sti = { T: [0.01, 0.5, 1, 2, 4], sti: st.map((v) => +v.toFixed(3)), ok: stOk }; out.din = { ok: dinOk };

console.log('Air absorption (ISO 9613-1), dB/km:'); for (const t of ISO) console.log(`  ${t[0]} °C ${t[1]} %  ` + out.air.filter((r) => r.t === t[0] && r.rh === t[1]).map((r) => `${r.engine}/${r.iso}${r.ok ? '' : '!'}`).join('  '));
console.log('Reverberation time against ray tracing (T30):'); for (const r of out.rt) console.log(`  ${r.name.padEnd(46)} rays ${r.rays.toFixed(2)} s  Eyring ${r.eyring.toFixed(2)} s (${r.devEyring >= 0 ? '+' : ''}${r.devEyring} %)  Sabine ${r.sabine.toFixed(2)} s (${r.devSabine >= 0 ? '+' : ''}${r.devSabine} %)${r.ok ? '' : '  FAIL'}`);
console.log('Uneven absorption (reported, not judged):'); for (const r of out.uneven) console.log(`  ${r.name}: rays ${r.rays.toFixed(2)} s, Eyring ${r.eyring.toFixed(2)} s (${r.devEyring} %), Sabine ${r.sabine.toFixed(2)} s (${r.devSabine} %)`);
console.log(`STI from reverberation: ${out.sti.sti.join(', ')} for T ${out.sti.T.join(', ')} s${stOk ? '' : '  FAIL'}; DIN 18041 targets ${dinOk ? 'ok' : 'FAIL'}`);
fs.writeFileSync(path.join(__dirname, 'room_acoustics.out.json'), JSON.stringify(out, null, 1));
console.log(fail ? `${fail} outside the tolerance` : 'All within tolerance.'); process.exitCode = fail ? 1 : 0;
