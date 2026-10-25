// Climate from an hourly weather file, shared by Sun hours (solar radiation, outdoor thermal comfort) and Wind Flow
// (pedestrian wind comfort). Pure functions, no DOM: the engines import it, and tests/validation runs it in Node.
// Directions are east-north-up unit vectors (x east, y north, z up); each engine turns them into its own model frame.
//
// Sources: EPW field order (EnergyPlus Auxiliary Programs, "EnergyPlus Weather File Data Dictionary"); sky in 145 patches
// (Tregenza 1987); diffuse sky by Perez et al. (1990), Solar Energy 44(5), coefficients as pvlib;
// UTCI as the 6th-order polynomial of the official UTCI program (Bröde et al. 2012, utci.org, UTCI_a002.f90), transcribed
// from pythermalcomfort (MIT); solar gain on a person by SolarCal (ASHRAE 55-2020 Appendix C; Arens et al. 2015);
// wind comfort by the City of London Lawson criteria (City of London, Wind Microclimate Guidelines, 2019).

export const D2R = Math.PI / 180, SIGMA = 5.670374419e-8;
const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dayOfYear = (m, d) => { let n = 0; for (let i = 0; i < m - 1; i++) n += MDAYS[i]; return n + d - 1; };
export const monthDay = (doy) => { let m = 0; while (doy >= MDAYS[m]) { doy -= MDAYS[m]; m++; } return [m + 1, doy + 1]; };

// ---- EPW: 8 header lines, then one row per hour; hour h covers (h − 1):00 to h:00 local standard time
export function parseEPW(text, name = '') {
  const lines = String(text || '').split(/\r?\n/), head = (lines[0] || '').split(',');
  if (head[0] !== 'LOCATION') throw new Error('This is not an EPW weather file (no LOCATION line).');
  const N = 8760, num = (v, bad) => { const x = +v; return Number.isFinite(x) && !(x >= bad) ? x : NaN; };
  const T = new Float32Array(N), Tdp = new Float32Array(N), RH = new Float32Array(N), IR = new Float32Array(N), GHR = new Float32Array(N), DNR = new Float32Array(N), DHR = new Float32Array(N), WD = new Float32Array(N), WS = new Float32Array(N);
  const seen = new Uint8Array(N); let n = 0, fixed = 0;
  for (let i = 8; i < lines.length; i++) {
    const c = lines[i].split(','); if (c.length < 22) continue;
    const m = +c[1], d = +c[2], h = +c[3]; if (!(m >= 1 && m <= 12 && d >= 1 && h >= 1 && h <= 24)) continue;
    if (m === 2 && d === 29) continue;   // leap day: a typical year has 365 days
    if (d > MDAYS[m - 1]) continue;
    const k = dayOfYear(m, d) * 24 + h - 1; if (seen[k]) continue; seen[k] = 1; n++;
    T[k] = num(c[6], 99.9); Tdp[k] = num(c[7], 99.9); RH[k] = num(c[8], 999); IR[k] = num(c[12], 9999);
    GHR[k] = num(c[13], 9999); DNR[k] = num(c[14], 9999); DHR[k] = num(c[15], 9999); WD[k] = num(c[20], 999); WS[k] = num(c[21], 999);
  }
  if (n < N) throw new Error(`Expected 8,760 hours, found ${n.toLocaleString('en-CA')}.`);
  // short gaps (missing codes) are filled from the hours either side; radiation at night is zero
  for (const A of [T, Tdp, RH, WD, WS]) for (let k = 0; k < N; k++) if (Number.isNaN(A[k])) { let a = k - 1, b = k + 1; while (a >= 0 && Number.isNaN(A[a])) a--; while (b < N && Number.isNaN(A[b])) b++; const va = a >= 0 ? A[a] : A[b], vb = b < N ? A[b] : va; A[k] = Number.isFinite(va) && Number.isFinite(vb) ? (va + vb) / 2 : 0; fixed++; }
  for (const A of [GHR, DNR, DHR]) for (let k = 0; k < N; k++) if (!(A[k] >= 0)) { A[k] = 0; fixed++; }
  for (let k = 0; k < N; k++) { if (RH[k] > 100) RH[k] = 100; if (RH[k] < 0) RH[k] = 0; if (WS[k] < 0) WS[k] = 0; }
  const lat = +head[6], lon = +head[7], tz = +head[8];
  return { name: name || head[1] || 'Weather file', station: [head[1], head[2], head[3]].filter((s) => s && s !== '-').join(', ').replace(/_/g, ' '), lat, lon, tz, elev: +head[9] || 0, T, Tdp, RH, IR, GHR, DNR, DHR, WD, WS, filled: fixed };
}

// sky temperature (°C) from the hour's downwelling long-wave radiation; without it, clear-sky emissivity from the dew point (Berdahl & Martin 1984)
export function skyTemp(E, k) {
  const ir = E.IR[k]; if (ir > 0 && Number.isFinite(ir)) return Math.pow(ir / SIGMA, 0.25) - 273.15;
  const eps = Math.min(1, Math.max(0.5, 0.787 + 0.764 * Math.log((E.Tdp[k] + 273.15) / 273)));
  return Math.pow(eps, 0.25) * (E.T[k] + 273.15) - 273.15;
}

// ---- the sky in 145 patches (Tregenza): band altitudes and counts; each patch's centre direction and solid angle
export const PATCH = (() => { const bands = [[0, 12, 30], [12, 24, 30], [24, 36, 24], [36, 48, 24], [48, 60, 18], [60, 72, 12], [72, 84, 6], [84, 90, 1]], P = [];
  for (const [a0, a1, n] of bands) for (let k = 0; k < n; k++) { const w = 360 / n, z0 = n === 1 ? 0 : k * w - w / 2, z1 = n === 1 ? 360 : z0 + w, alt = n === 1 ? 90 : (a0 + a1) / 2, az = n === 1 ? 0 : k * w, ca = Math.cos(alt * D2R);
    P.push({ alt, az, v: [ca * Math.sin(az * D2R), ca * Math.cos(az * D2R), Math.sin(alt * D2R)], om: (Math.sin(a1 * D2R) - Math.sin(a0 * D2R)) * (z1 - z0) * D2R }); }
  return P; })();
export const NP = PATCH.length;
export const enu = (alt, az) => { const ca = Math.cos(alt * D2R); return [ca * Math.sin(az * D2R), ca * Math.cos(az * D2R), Math.sin(alt * D2R)]; };

// Perez (1990) diffuse sky: an isotropic dome, a circumsolar disc that travels with the sun and a band at the horizon, weighted by
// the hour's clearness and brightness (coefficients "allsitescomposite1990", as pvlib and Radiance gendaymtx)
const PF1 = [[-0.008, 0.588, -0.062], [0.13, 0.683, -0.151], [0.33, 0.487, -0.221], [0.568, 0.187, -0.295], [0.873, -0.392, -0.362], [1.132, -1.237, -0.412], [1.06, -1.6, -0.359], [0.678, -0.327, -0.25]];
const PF2 = [[-0.06, 0.072, -0.022], [-0.019, 0.066, -0.029], [0.055, -0.064, -0.026], [0.109, -0.152, -0.014], [0.226, -0.462, 0.001], [0.288, -0.823, 0.056], [0.264, -1.127, 0.131], [0.156, -1.377, 0.251]];
const EPS_BINS = [1.065, 1.23, 1.5, 1.95, 2.8, 4.5, 6.2];
export function extraRadiation(doy) { const B = 2 * Math.PI * doy / 365; return 1366.1 * (1.00011 + 0.034221 * Math.cos(B) + 0.00128 * Math.sin(B) + 0.000719 * Math.cos(2 * B) + 7.7e-5 * Math.sin(2 * B)); }   // Spencer (1971), doy 0-based
export const airmass = (zen) => 1 / (Math.cos(zen * D2R) + 0.50572 * Math.pow(6.07995 + 90 - zen, -1.6364));   // Kasten & Young (1989)
export function perez(alt, doy, dni, dhi) {
  if (!(dhi > 0)) return { F1: 0, F2: 0 };
  const zen = Math.min(90, 90 - alt), z = zen * D2R, eps = ((dhi + dni) / dhi + 1.041 * z ** 3) / (1 + 1.041 * z ** 3), delta = dhi * airmass(zen) / extraRadiation(doy);
  let b = 0; while (b < 7 && eps >= EPS_BINS[b]) b++;
  return { F1: Math.max(0, PF1[b][0] + PF1[b][1] * delta + PF1[b][2] * z), F2: PF2[b][0] + PF2[b][1] * delta + PF2[b][2] * z };
}
const HORIZON = PATCH.map((P, p) => (P.alt === 6 ? p : -1)).filter((p) => p >= 0);   // the lowest band holds the horizon brightening

// ---- the hours of a study and the sun in them
// sunPos(y, m, d, hourStd, lat, lon, tz) → { alt, az } is the engine's own (NOAA); hours is a list of hour indices (0–8759)
export function hourSet(kind, opt = {}) {
  const out = [], add = (d0, d1) => { for (let d = d0; d <= d1; d++) for (let h = 0; h < 24; h++) out.push(d * 24 + h); };
  if (kind === 'summer') add(dayOfYear(6, 1), dayOfYear(8, 31));
  else if (kind === 'winter') { add(0, dayOfYear(2, 28)); add(dayOfYear(12, 1), 364); }
  else if (kind === 'dates' && opt.start && opt.end) { const a = dayOfYear(opt.start[0], opt.start[1]), b = dayOfYear(opt.end[0], opt.end[1]); if (a <= b) add(a, b); else { add(a, 364); add(0, b); } }
  else add(0, 364);
  return out;
}
export function sunHours(E, hours, { lat, lon, sunPos, year = 2026 }) {
  const alt = new Float32Array(hours.length), az = new Float32Array(hours.length);
  hours.forEach((k, i) => { const [m, d] = monthDay(Math.floor(k / 24)), p = sunPos(year, m, d, (k % 24) + 0.5, lat, lon, E.tz); alt[i] = p.alt; az[i] = p.az; });
  return { alt, az };
}
// Beam hours grouped into sun positions about `deg` apart, so one sightline per group stands for its hours.
// Each group keeps the beam energy as a vector (Σ DNI·s, Wh/m²); hourBin says which group an hour's sun is in (−1: no beam).
// The circumsolar part of the diffuse sky goes with the sun's group (c: Σ DHI·F1/max(cos 85°, cos z)·s), so buildings shade it as they shade the sun.
export function sunGroups(E, hours, sun, deg = 3) {
  const map = new Map(), G = [], hourBin = new Int32Array(hours.length).fill(-1);
  for (let i = 0; i < hours.length; i++) { const k = hours[i], a = sun.alt[i], dn = E.DNR[k] > 0 ? E.DNR[k] : 0; if (!(a > 0.5)) continue;
    const cs = E.DHR[k] > 0 ? E.DHR[k] * perez(a, Math.floor(k / 24), dn, E.DHR[k]).F1 / Math.max(Math.cos(85 * D2R), Math.sin(a * D2R)) : 0; if (!(dn > 0) && !(cs > 0)) continue;
    const row = Math.floor(a / deg), ca = Math.cos((row + 0.5) * deg * D2R), nAz = Math.max(1, Math.round(360 * ca / deg)), col = Math.floor(((sun.az[i] % 360) + 360) % 360 / 360 * nAz) % nAz, key = row * 1000 + col;
    let g = map.get(key); if (!g) { g = { i: G.length, v: [0, 0, 0], e: [0, 0, 0], c: [0, 0, 0], dnr: 0, n: 0 }; map.set(key, g); G.push(g); }
    const s = enu(a, sun.az[i]); for (let j = 0; j < 3; j++) { g.v[j] += (dn + cs) * s[j]; g.e[j] += dn * s[j]; g.c[j] += cs * s[j]; } g.dnr += dn; g.n++; if (dn > 0) hourBin[i] = g.i; }
  for (const g of G) { const L = Math.hypot(...g.v); g.v = g.v.map((x) => x / L); }
  return { groups: G, hourBin };
}
// the rest of the diffuse sky summed over the hours: isotropic radiance (Wh/m²·sr, the same in every patch) and the horizon band's
// strength (Σ DHI·F2, Wh/m²: a vertical face sees all of it), with the unobstructed horizontal totals (Wh/m²)
export function skySum(E, hours, sun) {
  let iso = 0, hor = 0, ghr = 0, dhr = 0, beamH = 0;
  for (let i = 0; i < hours.length; i++) { const k = hours[i], dh = E.DHR[k] > 0 ? E.DHR[k] : 0, dn = E.DNR[k] > 0 ? E.DNR[k] : 0; ghr += E.GHR[k] > 0 ? E.GHR[k] : 0;
    if (sun.alt[i] > 0.5) beamH += dn * Math.sin(sun.alt[i] * D2R); if (!dh) continue; dhr += dh;
    const f = perez(Math.max(0, sun.alt[i]), Math.floor(k / 24), dn, dh); iso += dh * (1 - f.F1) / Math.PI; hor += dh * f.F2; }
  return { iso, hor, ghr, dhr, beamH };
}
// Irradiation (Wh/m²) on a surface with normal n: beam and circumsolar from the visible sun groups, the isotropic dome and the horizon
// band through the visible sky patches, and ground-reflected light from the lower half of the view at albedo rho (isotropic, unobstructed)
export function irradiation(n, sunVis, skyVis, G, sky, rho = 0.2) {
  let e = 0;
  for (let b = 0; b < G.length; b++) if (sunVis(b)) { const g = G[b], d = n[0] * (g.e[0] + g.c[0]) + n[1] * (g.e[1] + g.c[1]) + n[2] * (g.e[2] + g.c[2]); if (d > 0) e += d; }
  for (let p = 0; p < NP; p++) if (skyVis(p)) { const P = PATCH[p], c = n[0] * P.v[0] + n[1] * P.v[1] + n[2] * P.v[2]; if (c > 0) e += sky.iso * P.om * c; }
  const dAz = 2 * Math.PI / HORIZON.length;
  for (const p of HORIZON) if (skyVis(p)) { const az = PATCH[p].az * D2R, c = n[0] * Math.sin(az) + n[1] * Math.cos(az); if (c > 0) e += sky.hor / 2 * dAz * c; }
  return Math.max(0, e) + rho * (sky.beamH + sky.dhr) * (1 - n[2]) / 2;
}

// ---- UTCI (°C) from air temperature, mean radiant temperature (°C), wind speed 10 m above ground (m/s) and relative humidity (%)
export const UTCI_LIMITS = { ta: [-50, 50], dtr: [-30, 70], va: [0.5, 17], pa: [0, 5] };
export function vapourPressure(ta, rh) {   // kPa, saturation over water (Hardy 1998 ITS-90, as the UTCI program) times RH
  const g = [-2836.5744, -6028.076559, 19.54263612, -0.02737830188, 0.000016261698, 7.0229056e-10, -1.8680009e-13], tk = ta + 273.15;
  let es = 2.7150305 * Math.log(tk); for (let i = 0; i < 7; i++) es += g[i] * Math.pow(tk, i - 2);
  return Math.exp(es) * 0.01 * rh / 100 / 10;
}
export function utci(ta, tr, va, rh) { return utciPoly(ta, Math.min(17, Math.max(0.5, va)), tr - ta, vapourPressure(ta, rh)); }
export const UTCI_STRESS = [[-40, 'Extreme cold stress'], [-27, 'Very strong cold stress'], [-13, 'Strong cold stress'], [0, 'Moderate cold stress'], [9, 'Slight cold stress'], [26, 'No thermal stress'], [32, 'Moderate heat stress'], [38, 'Strong heat stress'], [46, 'Very strong heat stress'], [Infinity, 'Extreme heat stress']];
export const utciStress = (u) => UTCI_STRESS.find(([t]) => u < t)[1];
function utciPoly(tdb, v, d, pa) {
  return tdb
    + 0.607562052
    + (-0.0227712343) * tdb
    + 8.06470249e-4 * tdb * tdb
    + -1.54271372e-4 * tdb * tdb * tdb
    + -3.24651735e-6 * tdb * tdb * tdb * tdb
    + 7.32602852e-8 * tdb * tdb * tdb * tdb * tdb
    + 1.35959073e-9 * tdb * tdb * tdb * tdb * tdb * tdb
    + (-2.25836520) * v
    + 0.0880326035 * tdb * v
    + 0.00216844454 * tdb * tdb * v
    + -1.53347087e-5 * tdb * tdb * tdb * v
    + -5.72983704e-7 * tdb * tdb * tdb * tdb * v
    + -2.55090145e-9 * tdb * tdb * tdb * tdb * tdb * v
    + (-0.751269505) * v * v
    + (-0.00408350271) * tdb * v * v
    + -5.21670675e-5 * tdb * tdb * v * v
    + 1.94544667e-6 * tdb * tdb * tdb * v * v
    + 1.14099531e-8 * tdb * tdb * tdb * tdb * v * v
    + 0.158137256 * v * v * v
    + -6.57263143e-5 * tdb * v * v * v
    + 2.22697524e-7 * tdb * tdb * v * v * v
    + -4.16117031e-8 * tdb * tdb * tdb * v * v * v
    + (-0.0127762753) * v * v * v * v
    + 9.66891875e-6 * tdb * v * v * v * v
    + 2.52785852e-9 * tdb * tdb * v * v * v * v
    + 4.56306672e-4 * v * v * v * v * v
    + -1.74202546e-7 * tdb * v * v * v * v * v
    + -5.91491269e-6 * v * v * v * v * v * v
    + 0.398374029 * d
    + 1.83945314e-4 * tdb * d
    + -1.73754510e-4 * tdb * tdb * d
    + -7.60781159e-7 * tdb * tdb * tdb * d
    + 3.77830287e-8 * tdb * tdb * tdb * tdb * d
    + 5.43079673e-10 * tdb * tdb * tdb * tdb * tdb * d
    + (-0.0200518269) * v * d
    + 8.92859837e-4 * tdb * v * d
    + 3.45433048e-6 * tdb * tdb * v * d
    + -3.77925774e-7 * tdb * tdb * tdb * v * d
    + -1.69699377e-9 * tdb * tdb * tdb * tdb * v * d
    + 1.69992415e-4 * v * v * d
    + -4.99204314e-5 * tdb * v * v * d
    + 2.47417178e-7 * tdb * tdb * v * v * d
    + 1.07596466e-8 * tdb * tdb * tdb * v * v * d
    + 8.49242932e-5 * v * v * v * d
    + 1.35191328e-6 * tdb * v * v * v * d
    + -6.21531254e-9 * tdb * tdb * v * v * v * d
    + -4.99410301e-6 * v * v * v * v * d
    + -1.89489258e-8 * tdb * v * v * v * v * d
    + 8.15300114e-8 * v * v * v * v * v * d
    + 7.55043090e-4 * d * d
    + -5.65095215e-5 * tdb * d * d
    + -4.52166564e-7 * tdb * tdb * d * d
    + 2.46688878e-8 * tdb * tdb * tdb * d * d
    + 2.42674348e-10 * tdb * tdb * tdb * tdb * d * d
    + 1.54547250e-4 * v * d * d
    + 5.24110970e-6 * tdb * v * d * d
    + -8.75874982e-8 * tdb * tdb * v * d * d
    + -1.50743064e-9 * tdb * tdb * tdb * v * d * d
    + -1.56236307e-5 * v * v * d * d
    + -1.33895614e-7 * tdb * v * v * d * d
    + 2.49709824e-9 * tdb * tdb * v * v * d * d
    + 6.51711721e-7 * v * v * v * d * d
    + 1.94960053e-9 * tdb * v * v * v * d * d
    + -1.00361113e-8 * v * v * v * v * d * d
    + -1.21206673e-5 * d * d * d
    + -2.18203660e-7 * tdb * d * d * d
    + 7.51269482e-9 * tdb * tdb * d * d * d
    + 9.79063848e-11
    * tdb
    * tdb
    * tdb
    * d
    * d
    * d
    + 1.25006734e-6 * v * d * d * d
    + -1.81584736e-9 * tdb * v * d * d * d
    + -3.52197671e-10
    * tdb
    * tdb
    * v
    * d
    * d
    * d
    + -3.36514630e-8 * v * v * d * d * d
    + 1.35908359e-10
    * tdb
    * v
    * v
    * d
    * d
    * d
    + 4.17032620e-10
    * v
    * v
    * v
    * d
    * d
    * d
    + -1.30369025e-9
    * d
    * d
    * d
    * d
    + 4.13908461e-10
    * tdb
    * d
    * d
    * d
    * d
    + 9.22652254e-12
    * tdb
    * tdb
    * d
    * d
    * d
    * d
    + -5.08220384e-9
    * v
    * d
    * d
    * d
    * d
    + -2.24730961e-11
    * tdb
    * v
    * d
    * d
    * d
    * d
    + 1.17139133e-10
    * v
    * v
    * d
    * d
    * d
    * d
    + 6.62154879e-10
    * d
    * d
    * d
    * d
    * d
    + 4.03863260e-13
    * tdb
    * d
    * d
    * d
    * d
    * d
    + 1.95087203e-12
    * v
    * d
    * d
    * d
    * d
    * d
    + -4.73602469e-12
    * d
    * d
    * d
    * d
    * d
    * d
    + 5.12733497 * pa
    + (-0.312788561) * tdb * pa
    + (-0.0196701861) * tdb * tdb * pa
    + 9.99690870e-4 * tdb * tdb * tdb * pa
    + 9.51738512e-6 * tdb * tdb * tdb * tdb * pa
    + -4.66426341e-7 * tdb * tdb * tdb * tdb * tdb * pa
    + 0.548050612 * v * pa
    + (-0.00330552823) * tdb * v * pa
    + (-0.00164119440) * tdb * tdb * v * pa
    + -5.16670694e-6 * tdb * tdb * tdb * v * pa
    + 9.52692432e-7 * tdb * tdb * tdb * tdb * v * pa
    + (-0.0429223622) * v * v * pa
    + 0.00500845667 * tdb * v * v * pa
    + 1.00601257e-6 * tdb * tdb * v * v * pa
    + -1.81748644e-6 * tdb * tdb * tdb * v * v * pa
    + -1.25813502e-3 * v * v * v * pa
    + -1.79330391e-4 * tdb * v * v * v * pa
    + 2.34994441e-6 * tdb * tdb * v * v * v * pa
    + 1.29735808e-4 * v * v * v * v * pa
    + 1.29064870e-6 * tdb * v * v * v * v * pa
    + -2.28558686e-6 * v * v * v * v * v * pa
    + (-0.0369476348) * d * pa
    + 0.00162325322 * tdb * d * pa
    + -3.14279680e-5 * tdb * tdb * d * pa
    + 2.59835559e-6 * tdb * tdb * tdb * d * pa
    + -4.77136523e-8 * tdb * tdb * tdb * tdb * d * pa
    + 8.64203390e-3 * v * d * pa
    + -6.87405181e-4 * tdb * v * d * pa
    + -9.13863872e-6 * tdb * tdb * v * d * pa
    + 5.15916806e-7 * tdb * tdb * tdb * v * d * pa
    + -3.59217476e-5 * v * v * d * pa
    + 3.28696511e-5 * tdb * v * v * d * pa
    + -7.10542454e-7 * tdb * tdb * v * v * d * pa
    + -1.24382300e-5 * v * v * v * d * pa
    + -7.38584400e-9 * tdb * v * v * v * d * pa
    + 2.20609296e-7 * v * v * v * v * d * pa
    + -7.32469180e-4 * d * d * pa
    + -1.87381964e-5 * tdb * d * d * pa
    + 4.80925239e-6 * tdb * tdb * d * d * pa
    + -8.75492040e-8 * tdb * tdb * tdb * d * d * pa
    + 2.77862930e-5 * v * d * d * pa
    + -5.06004592e-6 * tdb * v * d * d * pa
    + 1.14325367e-7 * tdb * tdb * v * d * d * pa
    + 2.53016723e-6 * v * v * d * d * pa
    + -1.72857035e-8 * tdb * v * v * d * d * pa
    + -3.95079398e-8 * v * v * v * d * d * pa
    + -3.59413173e-7 * d * d * d * pa
    + 7.04388046e-7 * tdb * d * d * d * pa
    + -1.89309167e-8
    * tdb
    * tdb
    * d
    * d
    * d
    * pa
    + -4.79768731e-7 * v * d * d * d * pa
    + 7.96079978e-9
    * tdb
    * v
    * d
    * d
    * d
    * pa
    + 1.62897058e-9
    * v
    * v
    * d
    * d
    * d
    * pa
    + 3.94367674e-8
    * d
    * d
    * d
    * d
    * pa
    + -1.18566247e-9
    * tdb
    * d
    * d
    * d
    * d
    * pa
    + 3.34678041e-10
    * v
    * d
    * d
    * d
    * d
    * pa
    + -1.15606447e-10
    * d
    * d
    * d
    * d
    * d
    * pa
    + (-2.80626406) * pa * pa
    + 0.548712484 * tdb * pa * pa
    + (-0.00399428410) * tdb * tdb * pa * pa
    + -9.54009191e-4 * tdb * tdb * tdb * pa * pa
    + 1.93090978e-5 * tdb * tdb * tdb * tdb * pa * pa
    + (-0.308806365) * v * pa * pa
    + 0.0116952364 * tdb * v * pa * pa
    + 4.95271903e-4 * tdb * tdb * v * pa * pa
    + -1.90710882e-5 * tdb * tdb * tdb * v * pa * pa
    + 0.00210787756 * v * v * pa * pa
    + -6.98445738e-4 * tdb * v * v * pa * pa
    + 2.30109073e-5 * tdb * tdb * v * v * pa * pa
    + 4.17856590e-4 * v * v * v * pa * pa
    + -1.27043871e-5 * tdb * v * v * v * pa * pa
    + -3.04620472e-6 * v * v * v * v * pa * pa
    + 0.0514507424 * d * pa * pa
    + (-0.00432510997) * tdb * d * pa * pa
    + 8.99281156e-5 * tdb * tdb * d * pa * pa
    + -7.14663943e-7 * tdb * tdb * tdb * d * pa * pa
    + -2.66016305e-4 * v * d * pa * pa
    + 2.63789586e-4 * tdb * v * d * pa * pa
    + -7.01199003e-6 * tdb * tdb * v * d * pa * pa
    + -1.06823306e-4 * v * v * d * pa * pa
    + 3.61341136e-6 * tdb * v * v * d * pa * pa
    + 2.29748967e-7 * v * v * v * d * pa * pa
    + 3.04788893e-4 * d * d * pa * pa
    + -6.42070836e-5 * tdb * d * d * pa * pa
    + 1.16257971e-6 * tdb * tdb * d * d * pa * pa
    + 7.68023384e-6 * v * d * d * pa * pa
    + -5.47446896e-7 * tdb * v * d * d * pa * pa
    + -3.59937910e-8 * v * v * d * d * pa * pa
    + -4.36497725e-6 * d * d * d * pa * pa
    + 1.68737969e-7
    * tdb
    * d
    * d
    * d
    * pa
    * pa
    + 2.67489271e-8
    * v
    * d
    * d
    * d
    * pa
    * pa
    + 3.23926897e-9
    * d
    * d
    * d
    * d
    * pa
    * pa
    + (-0.0353874123) * pa * pa * pa
    + (-0.221201190) * tdb * pa * pa * pa
    + 0.0155126038 * tdb * tdb * pa * pa * pa
    + -2.63917279e-4 * tdb * tdb * tdb * pa * pa * pa
    + 0.0453433455 * v * pa * pa * pa
    + (-0.00432943862) * tdb * v * pa * pa * pa
    + 1.45389826e-4 * tdb * tdb * v * pa * pa * pa
    + 2.17508610e-4 * v * v * pa * pa * pa
    + -6.66724702e-5 * tdb * v * v * pa * pa * pa
    + 3.33217140e-5 * v * v * v * pa * pa * pa
    + (-0.00226921615) * d * pa * pa * pa
    + 3.80261982e-4 * tdb * d * pa * pa * pa
    + -5.45314314e-9 * tdb * tdb * d * pa * pa * pa
    + -7.96355448e-4 * v * d * pa * pa * pa
    + 2.53458034e-5 * tdb * v * d * pa * pa * pa
    + -6.31223658e-6 * v * v * d * pa * pa * pa
    + 3.02122035e-4 * d * d * pa * pa * pa
    + -4.77403547e-6 * tdb * d * d * pa * pa * pa
    + 1.73825715e-6 * v * d * d * pa * pa * pa
    + -4.09087898e-7
    * d
    * d
    * d
    * pa
    * pa
    * pa
    + 0.614155345 * pa * pa * pa * pa
    + (-0.0616755931) * tdb * pa * pa * pa * pa
    + 0.00133374846 * tdb * tdb * pa * pa * pa * pa
    + 0.00355375387 * v * pa * pa * pa * pa
    + -5.13027851e-4 * tdb * v * pa * pa * pa * pa
    + 1.02449757e-4 * v * v * pa * pa * pa * pa
    + (-0.00148526421) * d * pa * pa * pa * pa
    + -4.11469183e-5 * tdb * d * pa * pa * pa * pa
    + -6.80434415e-6 * v * d * pa * pa * pa * pa
    + -9.77675906e-6 * d * d * pa * pa * pa * pa
    + 0.0882773108 * pa * pa * pa * pa * pa
    + (-0.00301859306) * tdb * pa * pa * pa * pa * pa
    + 0.00104452989 * v * pa * pa * pa * pa * pa
    + 2.47090539e-4 * d * pa * pa * pa * pa * pa
    + 0.00148348065 * pa * pa * pa * pa * pa * pa;
}

// ---- mean radiant temperature of a standing person outdoors (°C)
// Long-wave: the sky (its share is half the sky view, the upper half of the body) at the sky temperature; the ground and the
// surroundings at air temperature (sunlit paving runs warmer: not modelled). Short-wave: SolarCal, with the projected-area
// factor averaged over the directions a person may face, absorptivity 0.7, long-wave emissivity 0.95, h_r 6 W/m²K.
const FP_ALT = [0, 15, 30, 45, 60, 75, 90], FP = [0.299, 0.299, 0.2683, 0.2194, 0.1739, 0.122, 0.082];   // ASHRAE 55 standing table, mean over azimuth
export function projectedArea(alt) { const a = Math.min(90, Math.max(0, alt)), i = Math.min(5, Math.floor(a / 15)); return FP[i] + (FP[i + 1] - FP[i]) * (a - FP_ALT[i]) / 15; }
export function mrtOutdoor({ ta, tsky, svf, sunlit, alt, dnr, dhr, rho = 0.2, asw = 0.7 }) {
  const fsky = 0.5 * svf, tk = ta + 273.15, sk = tsky + 273.15, lw = Math.pow(fsky * sk ** 4 + (1 - fsky) * tk ** 4, 0.25) - 273.15;
  const feff = 0.725, sinA = Math.max(0, Math.sin(alt * D2R)), beam = sunlit && alt > 0 ? dnr : 0;
  const ith = beam * sinA + dhr * svf;   // horizontal light reaching the ground around the person
  const e = 0.5 * feff * svf * dhr + feff * projectedArea(alt) * beam + 0.5 * feff * ith * rho;
  return lw + e * (asw / 0.95) / (6 * feff);
}

// ---- wind: weather-station speed (10 m, open country) to the approaching wind on the site at height h, for a power-law
// exponent alpha (0.14 open, 0.22 suburban, 0.33 city); boundary-layer depths from ASHRAE Fundamentals (2021) ch. 24, table 1
export const layerDepth = (alpha) => (alpha <= 0.16 ? 270 : alpha <= 0.26 ? 370 : 460);
export const siteWind = (u10met, h, alpha) => u10met * Math.pow(270 / 10, 0.14) * Math.pow(Math.max(0.5, h) / layerDepth(alpha), alpha);

// City of London Lawson criteria (2019): the speed exceeded 5 % of the time sets comfort; 15 m/s exceeded more than 0.022 % of the
// time (about 2 hours a year) is unsafe for all.
export const LAWSON = [[2.5, 'Frequent sitting', [61, 133, 198]], [4, 'Occasional sitting', [78, 176, 160]], [6, 'Standing', [156, 201, 90]], [8, 'Walking', [236, 201, 75]], [Infinity, 'Uncomfortable', [217, 72, 44]]];
export const LAWSON_SAFE = { speed: 15, share: 0.00022 };
// speeds: the hourly local speeds at one spot (m/s). Returns the comfort class index, the 95th-percentile speed and the unsafe share.
export function lawsonClass(speeds) {
  const n = speeds.length; if (!n) return { cls: -1, u95: NaN, unsafe: 0 };
  const s = Float32Array.from(speeds).sort(), u95 = s[Math.min(n - 1, Math.floor(0.95 * n))];
  let over = 0; for (let i = n - 1; i >= 0 && s[i] > LAWSON_SAFE.speed; i--) over++;
  return { cls: LAWSON.findIndex(([t]) => u95 <= t), u95, unsafe: over / n };
}
