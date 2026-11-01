// Daylight (2026-11-01): the analysis of the Daylight study (the former emb/daylight.html, retired 2026-11-01), unchanged, for the
// Workspace: climate-based daylight on the work plane over a year of hours (project weather, or a generic year), sky in 145
// patches, the sun, reflections inside and outside; spatial daylight autonomy sDA300/50%, annual sun exposure ASE1000/250 h,
// daylight factor and the LEED v4.1 option 2 illuminance check (9:00 and 15:00 at the equinox).
import { clamp } from '../../../emb/lib/plansim.js?v=1';
let SC = null, TGT = 0, EYE = 1.07, HEAD = 2.4, CEIL = 2.7, WP = 0.8, TAU = 0.6, RF = 0.2, RW = 0.5, RC = 0.8, NORTH = 0, OCC = [8, 18], EXCL = [];
const window = { __isoCmin: 0, __isoCells: 350000 };   // the page's tuning hooks, at their defaults
// ================= geometry (shared with Isovist Safety) =================
const NR = 720, DA = 2 * Math.PI / NR;
function obstacles() {
  const S = [];
  for (const w of SC.walls) { if (!(w.h > 0) && !w.glass) continue; const full = !w.glass && !w.furnline && w.h >= 2.0; S.push({ ax: w.a[0], ay: w.a[1], bx: w.b[0], by: w.b[1], h: full ? Math.max(w.h, 2.7) : w.h, room: w.glass || full, glass: !!w.glass, full }); }
  for (const f of SC.furn) { if (!(f.h > 0)) continue; const P = [[f.x, f.y], [f.x + f.w, f.y], [f.x + f.w, f.y + f.d], [f.x, f.y + f.d]]; for (let i = 0; i < 4; i++) { const a = P[i], b = P[(i + 1) % 4]; S.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], h: f.h, room: false, glass: false, full: false }); } }
  return S;
}
function rayHit(ox, oy, dx, dy, s) {   // distance along the ray to segment s, or -1
  const ex = s.bx - s.ax, ey = s.by - s.ay, den = dx * ey - dy * ex; if (Math.abs(den) < 1e-12) return -1;
  const qx = s.ax - ox, qy = s.ay - oy, t = (qx * ey - qy * ex) / den, u = (qx * dy - qy * dx) / den;
  return u >= -1e-9 && u <= 1 + 1e-9 && t > 1e-7 ? t : -1;
}
function boxExit(ox, oy, dx, dy, B) { let t = Infinity; if (dx > 1e-12) t = Math.min(t, (B.w - ox) / dx); if (dx < -1e-12) t = Math.min(t, -ox / dx); if (dy > 1e-12) t = Math.min(t, (B.h - oy) / dy); if (dy < -1e-12) t = Math.min(t, -oy / dy); return Math.max(0, t); }
function castRays(S, v, E) {
  const rays = new Array(NR), hits = [];
  for (let k = 0; k < NR; k++) {
    const th = k * DA, dx = Math.cos(th), dy = Math.sin(th); let end = boxExit(v[0], v[1], dx, dy, SC.bounds); hits.length = 0;
    for (const s of S) { const d = rayHit(v[0], v[1], dx, dy, s); if (d < 0) continue; if (s.h >= E) { if (d < end) end = d; } else hits.push(d, s.h); }
    const low = []; if (SC.hm) end = marchHM(SC.hm, v, dx, dy, end, E, low);
    const hid = [];
    for (let i = 0; i < hits.length; i += 2) { const d = hits[i], h = hits[i + 1]; if (d >= end || h <= TGT) continue; hid.push([d, Math.min(end, d * (E - TGT) / (E - h))]); }
    for (const [d0, d1, h] of low) { if (d0 >= end) continue; hid.push([d0, Math.min(end, d1 * (E - TGT) / (E - h))]); }
    hid.sort((p, q) => p[0] - q[0]); const m = []; for (const iv of hid) { const l = m[m.length - 1]; if (l && iv[0] <= l[1] + 1e-9) l[1] = Math.max(l[1], iv[1]); else m.push(iv.slice()); }
    rays[k] = { end, hid: m };
  }
  return rays;
}
// Imported models are a height map: per cell, the highest geometry between the floor and 2 m (255 = reaches 2 m: a wall).
// A ray walks the cells it crosses (Amanatides–Woo) with the same rule: a cell as high as the eye stops it, a lower one hides
// from where the ray enters it to where the sightline over its far edge comes down to the height looked for.
function cellWalk(M, v, dx, dy, maxD, cb) {
  const { c, W, H } = M; let ix = Math.floor(v[0] / c), iy = Math.floor(v[1] / c); const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const adx = Math.abs(dx), ady = Math.abs(dy), tdx = adx > 1e-12 ? c / adx : Infinity, tdy = ady > 1e-12 ? c / ady : Infinity;
  let tx = adx > 1e-12 ? (dx > 0 ? (ix + 1) * c - v[0] : v[0] - ix * c) / adx : Infinity, ty = ady > 1e-12 ? (dy > 0 ? (iy + 1) * c - v[1] : v[1] - iy * c) / ady : Infinity;
  for (let n = 0; n < 1e6; n++) {
    let d; if (tx < ty) { d = tx; tx += tdx; ix += sx; } else { d = ty; ty += tdy; iy += sy; }
    if (d >= maxD || ix < 0 || iy < 0 || ix >= W || iy >= H) return;
    const val = M.h[iy * W + ix]; if (val && cb(d, Math.min(tx, ty, maxD), val)) return;
  }
}
const hmH = (val) => (val === 255 ? 9 : val / 100);
function marchHM(M, v, dx, dy, end, E, out) {
  let stop = end; cellWalk(M, v, dx, dy, end, (d, dn, val) => { const h = hmH(val); if (h >= E) { stop = d; return true; } if (h > TGT && h > 0.05) out.push([d, dn, h]); return false; }); return stop;
}
// raster: cell c meters; solid = any obstacle line or furniture footprint (not floor), room = walls that enclose a room
function buildGrid(S) {
  const B = SC.bounds, c = Math.max(window.__isoCmin || 0.05, Math.sqrt(B.w * B.h / (window.__isoCells || 350000))), W = Math.ceil(B.w / c), H = Math.ceil(B.h / c), solid = new Uint8Array(W * H), room = new Uint8Array(W * H);
  const line = (m, ax, ay, bx, by) => { const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (c / 3))); for (let i = 0; i <= n; i++) { const x = Math.floor((ax + (bx - ax) * i / n) / c), y = Math.floor((ay + (by - ay) * i / n) / c); if (x >= 0 && y >= 0 && x < W && y < H) m[y * W + x] = 1; } };
  for (const s of S) { line(solid, s.ax, s.ay, s.bx, s.by); if (s.room) line(room, s.ax, s.ay, s.bx, s.by); }
  for (const f of SC.furn) { const x0 = clamp(Math.floor(f.x / c), 0, W), x1 = clamp(Math.ceil((f.x + f.w) / c), 0, W), y0 = clamp(Math.floor(f.y / c), 0, H), y1 = clamp(Math.ceil((f.y + f.d) / c), 0, H); for (let y = y0; y < y1; y++) solid.fill(1, y * W + x0, y * W + x1); }
  const M = SC.hm; if (M && M.W === W && M.H === H) for (let i = 0; i < W * H; i++) { const v = M.h[i]; if (v > 5) solid[i] = 1; if (v === 255 || (M.g && M.g[i])) room[i] = 1; }
  return { c, W, H, solid, room };
}
// The occupied floor: everything inside the walls (doorways up to ~1.1 m bridged), less furniture; `out` is the outdoors.
function floorRegion(G) {
  const { W, H, room, solid, c } = G, N = W * H, INF = 1e9, D = new Float32Array(N), R = Math.max(2, Math.round(0.55 / c)), r2 = Math.SQRT2;
  for (let i = 0; i < N; i++) D[i] = room[i] ? 0 : INF;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; let d = D[i]; if (!d) continue; if (x) d = Math.min(d, D[i - 1] + 1); if (y) { d = Math.min(d, D[i - W] + 1); if (x) d = Math.min(d, D[i - W - 1] + r2); if (x < W - 1) d = Math.min(d, D[i - W + 1] + r2); } D[i] = d; }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; let d = D[i]; if (!d) continue; if (x < W - 1) d = Math.min(d, D[i + 1] + 1); if (y < H - 1) { d = Math.min(d, D[i + W] + 1); if (x < W - 1) d = Math.min(d, D[i + W + 1] + r2); if (x) d = Math.min(d, D[i + W - 1] + r2); } D[i] = d; }
  const out = new Uint8Array(N), st = [], open = (i) => !room[i] && D[i] > R;
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { const i = y * W + x; if (open(i) && !out[i]) { out[i] = 1; st.push(i); } }
  for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { const i = y * W + x; if (open(i) && !out[i]) { out[i] = 1; st.push(i); } }
  while (st.length) { const i = st.pop(), x = i % W, y = (i / W) | 0; for (const j of [x ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && !out[j] && open(j)) { out[j] = 1; st.push(j); } }
  let front = []; for (let i = 0; i < N; i++) if (out[i]) front.push(i);
  for (let step = 0; step <= R && front.length; step++) { const nx = []; for (const i of front) { const x = i % W, y = (i / W) | 0; for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const xx = x + k, yy = y + j; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = yy * W + xx; if (!out[q] && !room[q]) { out[q] = 1; nx.push(q); } } } front = nx; }
  const reg = new Uint8Array(N); let n = 0, approx = false; for (let i = 0; i < N; i++) if (!out[i] && !solid[i]) reg[i] = 1;
  const lab = new Uint8Array(N), thin = 0.17 / c;
  for (let s0 = 0; s0 < N; s0++) { if (!reg[s0] || lab[s0]) continue; const comp = [s0]; lab[s0] = 1; let mx = 0;
    for (let q = 0; q < comp.length; q++) { const i = comp[q], x = i % W, y = (i / W) | 0; if (D[i] > mx) mx = D[i]; for (const j of [x ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && reg[j] && !lab[j]) { lab[j] = 1; comp.push(j); } }
    if (mx <= thin) for (const i of comp) reg[i] = 0; else n += comp.length; }
  if (n < N * 0.02) { approx = true; n = 0; for (let i = 0; i < N; i++) { reg[i] = solid[i] ? 0 : 1; n += reg[i]; } }
  // rooms: the floor away from the walls (doorways closed), each piece grown back to the walls
  const room2 = new Int16Array(N).fill(-1), core = (i) => reg[i] && D[i] > R; let nr = 0; const q = [];
  for (let s0 = 0; s0 < N; s0++) { if (!core(s0) || room2[s0] >= 0) continue; const st2 = [s0]; room2[s0] = nr; while (st2.length) { const i = st2.pop(), x = i % W, y = (i / W) | 0; for (const j of [x ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && room2[j] < 0 && core(j)) { room2[j] = nr; st2.push(j); } } nr++; }
  for (let i = 0; i < N; i++) if (room2[i] >= 0) q.push(i);
  for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, y = (i / W) | 0; for (const j of [x ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && reg[j] && room2[j] < 0) { room2[j] = room2[i]; q.push(j); } }
  const areas = new Array(nr).fill(0); for (let i = 0; i < N; i++) if (reg[i] && room2[i] >= 0) areas[room2[i]]++;
  const order = areas.map((a, k) => k).sort((p, r) => areas[r] - areas[p]), remap = new Int16Array(nr).fill(-1); let kept = 0; for (const k of order) if (areas[k] * c * c >= 2) remap[k] = kept++;
  for (let i = 0; i < N; i++) room2[i] = room2[i] >= 0 ? remap[room2[i]] : -1;
  return { reg, out, approx, area: n * c * c, D, room: room2, nRooms: kept };
}

// ================= climate: sun, sky and a year of hours =================
const D2R = Math.PI / 180;
const cityOpts = (list) => { let g = null, h = ''; list.forEach((c, i) => { if (c[5] !== g) { if (g !== null) h += '</optgroup>'; h += `<optgroup label="${c[5]}">`; g = c[5]; } h += `<option value="${i}">${c[0]}</option>`; }); return h + '</optgroup>'; };
const CITIES = [["Vancouver", 49.28, -123.12, -8, 1, "Canada"], ["Victoria", 48.43, -123.37, -8, 1, "Canada"], ["Whitehorse", 60.72, -135.05, -7, 0, "Canada"], ["Calgary", 51.05, -114.07, -7, 1, "Canada"], ["Edmonton", 53.55, -113.49, -7, 1, "Canada"], ["Yellowknife", 62.45, -114.37, -7, 1, "Canada"], ["Regina", 50.45, -104.62, -6, 0, "Canada"], ["Winnipeg", 49.9, -97.14, -6, 1, "Canada"], ["Toronto", 43.65, -79.38, -5, 1, "Canada"], ["Ottawa", 45.42, -75.7, -5, 1, "Canada"], ["Montréal", 45.5, -73.57, -5, 1, "Canada"], ["Québec City", 46.81, -71.21, -5, 1, "Canada"], ["Iqaluit", 63.75, -68.52, -5, 1, "Canada"], ["Halifax", 44.65, -63.57, -4, 1, "Canada"], ["St. John's", 47.56, -52.71, -3.5, 1, "Canada"], ["New York", 40.71, -74.01, -5, 1, "United States"], ["Boston", 42.36, -71.06, -5, 1, "United States"], ["Washington, DC", 38.91, -77.04, -5, 1, "United States"], ["Miami", 25.76, -80.19, -5, 1, "United States"], ["Chicago", 41.88, -87.63, -6, 1, "United States"], ["Houston", 29.76, -95.37, -6, 1, "United States"], ["Denver", 39.74, -104.99, -7, 1, "United States"], ["Phoenix", 33.45, -112.07, -7, 0, "United States"], ["Los Angeles", 34.05, -118.24, -8, 1, "United States"], ["San Francisco", 37.77, -122.42, -8, 1, "United States"], ["Seattle", 47.61, -122.33, -8, 1, "United States"], ["Anchorage", 61.22, -149.9, -9, 1, "United States"], ["Honolulu", 21.31, -157.86, -10, 0, "United States"], ["Mexico City", 19.43, -99.13, -6, 0, "Latin America"], ["Panama City", 8.98, -79.52, -5, 0, "Latin America"], ["Bogotá", 4.71, -74.07, -5, 0, "Latin America"], ["Lima", -12.05, -77.04, -5, 0, "Latin America"], ["Quito", -0.18, -78.47, -5, 0, "Latin America"], ["Santiago", -33.45, -70.67, -4, 0, "Latin America"], ["Buenos Aires", -34.6, -58.38, -3, 0, "Latin America"], ["São Paulo", -23.55, -46.63, -3, 0, "Latin America"], ["Reykjavík", 64.15, -21.94, 0, 0, "Europe"], ["London", 51.51, -0.13, 0, 2, "Europe"], ["Dublin", 53.35, -6.26, 0, 2, "Europe"], ["Lisbon", 38.72, -9.14, 0, 2, "Europe"], ["Madrid", 40.42, -3.7, 1, 2, "Europe"], ["Paris", 48.86, 2.35, 1, 2, "Europe"], ["Amsterdam", 52.37, 4.9, 1, 2, "Europe"], ["Berlin", 52.52, 13.4, 1, 2, "Europe"], ["Zürich", 47.38, 8.54, 1, 2, "Europe"], ["Vienna", 48.21, 16.37, 1, 2, "Europe"], ["Rome", 41.9, 12.5, 1, 2, "Europe"], ["Copenhagen", 55.68, 12.57, 1, 2, "Europe"], ["Oslo", 59.91, 10.75, 1, 2, "Europe"], ["Stockholm", 59.33, 18.07, 1, 2, "Europe"], ["Warsaw", 52.23, 21.01, 1, 2, "Europe"], ["Helsinki", 60.17, 24.94, 2, 2, "Europe"], ["Athens", 37.98, 23.73, 2, 2, "Europe"], ["Istanbul", 41.01, 28.98, 3, 0, "Europe"], ["Moscow", 55.76, 37.62, 3, 0, "Europe"], ["Casablanca", 33.57, -7.59, 1, 0, "Africa"], ["Accra", 5.6, -0.19, 0, 0, "Africa"], ["Lagos", 6.52, 3.38, 1, 0, "Africa"], ["Cairo", 30.04, 31.24, 2, 0, "Africa"], ["Johannesburg", -26.2, 28.05, 2, 0, "Africa"], ["Nairobi", -1.29, 36.82, 3, 0, "Africa"], ["Addis Ababa", 9.03, 38.74, 3, 0, "Africa"], ["Tel Aviv", 32.09, 34.78, 2, 0, "Middle East"], ["Riyadh", 24.71, 46.68, 3, 0, "Middle East"], ["Doha", 25.29, 51.53, 3, 0, "Middle East"], ["Dubai", 25.2, 55.27, 4, 0, "Middle East"], ["Tehran", 35.69, 51.39, 3.5, 0, "Middle East"], ["Karachi", 24.86, 67.01, 5, 0, "Asia"], ["Delhi", 28.61, 77.21, 5.5, 0, "Asia"], ["Mumbai", 19.08, 72.88, 5.5, 0, "Asia"], ["Bengaluru", 12.97, 77.59, 5.5, 0, "Asia"], ["Kathmandu", 27.72, 85.32, 5.75, 0, "Asia"], ["Dhaka", 23.81, 90.41, 6, 0, "Asia"], ["Bangkok", 13.76, 100.5, 7, 0, "Asia"], ["Ho Chi Minh City", 10.82, 106.63, 7, 0, "Asia"], ["Jakarta", -6.21, 106.85, 7, 0, "Asia"], ["Singapore", 1.35, 103.82, 8, 0, "Asia"], ["Kuala Lumpur", 3.14, 101.69, 8, 0, "Asia"], ["Manila", 14.6, 120.98, 8, 0, "Asia"], ["Hong Kong", 22.3, 114.17, 8, 0, "Asia"], ["Shenzhen", 22.54, 114.06, 8, 0, "Asia"], ["Guangzhou", 23.13, 113.26, 8, 0, "Asia"], ["Shanghai", 31.23, 121.47, 8, 0, "Asia"], ["Beijing", 39.9, 116.4, 8, 0, "Asia"], ["Chengdu", 30.66, 104.07, 8, 0, "Asia"], ["Taipei", 25.03, 121.57, 8, 0, "Asia"], ["Seoul", 37.57, 126.98, 9, 0, "Asia"], ["Tokyo", 35.68, 139.69, 9, 0, "Asia"], ["Osaka", 34.69, 135.5, 9, 0, "Asia"], ["Perth", -31.95, 115.86, 8, 0, "Oceania"], ["Brisbane", -27.47, 153.03, 10, 0, "Oceania"], ["Sydney", -33.87, 151.21, 10, 3, "Oceania"], ["Melbourne", -37.81, 144.96, 10, 3, "Oceania"], ["Auckland", -36.85, 174.76, 12, 4, "Oceania"]];
const LOC = { name: 'Vancouver', lat: 49.28, lon: -123.12, tz: -8 };
function julian0(y, m, d) { if (m <= 2) { y -= 1; m += 12; } const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4); return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5; }
function sunPos(y, m, d, hourStd, lat, lon, tz) {   // NOAA, the same as Sun hours: altitude and azimuth (from north, clockwise) in degrees
  const T = (julian0(y, m, d) + (hourStd - tz) / 24 - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360, M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * D2R) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * D2R) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * D2R) * 0.000289;
  const om = 125.04 - 1934.136 * T, lam = L0 + C - 0.00569 - 0.00478 * Math.sin(om * D2R);
  const eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(om * D2R);
  const decl = Math.asin(Math.sin(eps * D2R) * Math.sin(lam * D2R)), yv = Math.tan(eps * D2R / 2) ** 2;
  const eot = 4 / D2R * (yv * Math.sin(2 * L0 * D2R) - 2 * e * Math.sin(M * D2R) + 4 * e * yv * Math.sin(M * D2R) * Math.cos(2 * L0 * D2R) - 0.5 * yv * yv * Math.sin(4 * L0 * D2R) - 1.25 * e * e * Math.sin(2 * M * D2R));
  let tst = (hourStd * 60 + eot + 4 * lon - 60 * tz) % 1440; if (tst < 0) tst += 1440;
  const ha = (tst / 4 - 180) * D2R, la = lat * D2R;
  const cz = Math.min(1, Math.max(-1, Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(ha)));
  return { alt: 90 - Math.acos(cz) / D2R, az: ((Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(la) - Math.tan(decl) * Math.cos(la)) / D2R) + 540) % 360 };
}
const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayMD = (dd) => { let m = 0; while (dd >= MDAYS[m]) { dd -= MDAYS[m]; m++; } return [m + 1, dd + 1]; };
// clear and overcast skies (IES / CIE): illuminance in lux from the sun's altitude
function clearSky(alt) { const s = Math.sin(alt * D2R), m = 1 / (s + 0.50572 * Math.pow(alt + 6.07995, -1.6364)); return { Eb: 127500 * Math.exp(-0.21 * m), Ed: 1000 * (0.8 + 15.5 * Math.sqrt(s)) }; }
const overcastSky = (alt) => ({ Eb: 0, Ed: 1000 * (0.3 + 21 * Math.sin(alt * D2R)) });
const EPW = { name: '', rows: null };
let YEAR = null;   // per hour: sun alt/az, direct normal and diffuse horizontal illuminance (lux)
function buildYear() {
  const alt = new Float32Array(8760), az = new Float32Array(8760), Eb = new Float32Array(8760), Ed = new Float32Array(8760); let rng = 12345; const rnd = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let cloud = 0.5;
  for (let dd = 0; dd < 365; dd++) { const [m, d] = dayMD(dd); if (!EPW.rows) cloud = clamp(0.55 * cloud + 0.45 * rnd() * 1.05, 0, 1);
    for (let h = 0; h < 24; h++) { const i = dd * 24 + h, sp = sunPos(2026, m, d, h + 0.5, LOC.lat, LOC.lon, LOC.tz); alt[i] = sp.alt; az[i] = sp.az; if (sp.alt <= 0.5) continue;
      if (EPW.rows) { const r = EPW.rows[i]; Eb[i] = r.dni > 0 ? r.dni : 0; Ed[i] = r.dhi > 0 ? r.dhi : 0; continue; }
      const cs = clearSky(sp.alt), oc = overcastSky(sp.alt); Eb[i] = (1 - cloud) ** 1.4 * cs.Eb; Ed[i] = (1 - cloud) * cs.Ed + cloud * oc.Ed; } }
  YEAR = { alt, az, Eb, Ed, epw: !!EPW.rows };
}
// ---- the sky in 145 patches (Tregenza): luminance shares from a clear-to-overcast blend ----
const PATCH = (() => { const bands = [[0, 12, 30], [12, 24, 30], [24, 36, 24], [36, 48, 24], [48, 60, 18], [60, 72, 12], [72, 84, 6], [84, 90, 1]], P = [];
  for (const [a0, a1, n] of bands) for (let k = 0; k < n; k++) { const w = 360 / n, z0 = n === 1 ? 0 : k * w - w / 2, z1 = n === 1 ? 360 : z0 + w; P.push({ a0: a0 * D2R, a1: a1 * D2R, z0, z1, alt: (a0 + a1) / 2 * D2R, az: n === 1 ? 0 : k * w, om: (Math.sin(a1 * D2R) - Math.sin(a0 * D2R)) * (z1 - z0) * D2R }); }
  return P; })();
const NP = PATCH.length;
const Lof = (i) => { if (!YEAR.L) YEAR.L = []; return YEAR.L[i] || (YEAR.L[i] = skyLum(YEAR.alt[i], YEAR.az[i], YEAR.Eb[i], YEAR.Ed[i], new Float32Array(NP))); };
function skyLum(alt, az, Eb, Ed, out) {   // luminance (cd/m²) of each patch so that the sky gives Ed on the ground
  const Z = (90 - alt) * D2R, eps = Ed > 1 ? ((Ed + Eb) / Ed + 1.041 * Z ** 3) / (1 + 1.041 * Z ** 3) : 1, wc = clamp((eps - 1) / 5.2, 0, 1);
  const sx = Math.cos(alt * D2R) * Math.sin(az * D2R), sy = Math.cos(alt * D2R) * Math.cos(az * D2R), sz = Math.sin(alt * D2R), fz = (0.91 + 10 * Math.exp(-3 * Z) + 0.45 * Math.cos(Z) ** 2) * (1 - Math.exp(-0.32));
  let sc = 0, so = 0; const cl = new Float64Array(NP), ov = new Float64Array(NP);
  for (let p = 0; p < NP; p++) { const P = PATCH[p], ca = Math.cos(P.alt), px = ca * Math.sin(P.az * D2R), py = ca * Math.cos(P.az * D2R), pz = Math.sin(P.alt), g = Math.acos(clamp(px * sx + py * sy + pz * sz, -1, 1)), zeta = Math.PI / 2 - P.alt;
    cl[p] = (0.91 + 10 * Math.exp(-3 * g) + 0.45 * Math.cos(g) ** 2) * (1 - Math.exp(-0.32 / Math.max(0.05, Math.cos(zeta)))) / fz; ov[p] = (1 + 2 * pz) / 3; sc += cl[p] * P.om * pz; so += ov[p] * P.om * pz; }
  for (let p = 0; p < NP; p++) out[p] = Ed * (wc * cl[p] / sc + (1 - wc) * ov[p] / so);
  return out;
}

// ================= what each spot sees of the sky =================
// From the work plane, one horizontal ray per compass bearing runs through the plan. Walls of 2 m or more stop it; glass
// lets it through between its sill and the window head. Past the outermost pane, buildings outside cut the bottom of the
// sky off. Each bearing keeps the altitudes it can see sky through ([lo, hi]); the 145 patches are summed from those.
let GC = { key: '' };
function hmEvents(p, dx, dy, maxD, ev) {   // an imported model: cells reaching 2 m block, glass cells are panes
  const M = SC.hm; if (!M) return; const { c, W, H } = M; let ix = Math.floor(p[0] / c), iy = Math.floor(p[1] / c); const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, adx = Math.abs(dx), ady = Math.abs(dy);
  const tdx = adx > 1e-12 ? c / adx : Infinity, tdy = ady > 1e-12 ? c / ady : Infinity; let tx = adx > 1e-12 ? (dx > 0 ? (ix + 1) * c - p[0] : p[0] - ix * c) / adx : Infinity, ty = ady > 1e-12 ? (dy > 0 ? (iy + 1) * c - p[1] : p[1] - iy * c) / ady : Infinity, inG = false;
  for (let n = 0; n < 1e6; n++) { let d; if (tx < ty) { d = tx; tx += tdx; ix += sx; } else { d = ty; ty += tdy; iy += sy; } if (d >= maxD || ix < 0 || iy < 0 || ix >= W || iy >= H) return;
    const i = iy * W + ix; if (M.g && M.g[i]) { if (!inG) ev.push([d, 2, 0.75]); inG = true; continue; } inG = false; const v = M.h[i]; if (v > 5) { const h = v === 255 ? 9 : hmH(v); if (h >= 2) { ev.push([d, 1, 9]); return; } if (h > WP + 0.05) ev.push([d, 1, h]); } }
}
const plDir = (azDeg) => { const a = NORTH * D2R, z = azDeg * D2R; return [Math.sin(a) * Math.cos(z) + Math.cos(a) * Math.sin(z), Math.cos(a) * Math.cos(z) - Math.sin(a) * Math.sin(z)]; };   // compass bearing → plan direction
function spotSky(p, nb, S) {
  const G = GC.G, out = GC.R.out, B = SC.bounds, gcos = new Float32Array(nb).fill(1), lo = new Float32Array(nb).fill(9), hi = new Float32Array(nb).fill(-9), olo = new Float32Array(nb).fill(9), ohi = new Float32Array(nb).fill(-9), ev = [], dist = new Float32Array(nb).fill(-1);
  const isOut = (x, y) => { const cx = Math.floor(x / G.c), cy = Math.floor(y / G.c); if (cx < 0 || cy < 0 || cx >= G.W || cy >= G.H) return true; return !!out[cy * G.W + cx]; };
  const H = Math.min(HEAD, CEIL) - WP;
  for (let j = 0; j < nb; j++) {
    const [dx, dy] = plDir((j + 0.5) * 360 / nb), end = boxExit(p[0], p[1], dx, dy, B); ev.length = 0;
    for (const s of S) { const d = rayHit(p[0], p[1], dx, dy, s); if (d < 0 || d > end) continue; if (s.glass) ev.push([d, 2, s.h, s]); else if (s.h >= WP + 0.05) ev.push([d, 1, s.h]); }
    hmEvents(p, dx, dy, end, ev);
    ev.sort((a, b) => a[0] - b[0]); let wl = -9, wh = 9;
    for (let e = 0; e < ev.length; e++) {
      const [d, t, h] = ev[e]; if (t === 1) { if (h >= CEIL - 0.05 || h >= 2) break; wl = Math.max(wl, Math.atan2(h - WP, d)); continue; }   // a low wall or high furniture trims the bottom
      wl = Math.max(wl, Math.atan2(h - WP, d)); wh = Math.min(wh, Math.atan2(H, d));
      if (isOut(p[0] + dx * (d + 0.3), p[1] + dy * (d + 0.3))) {
        let ob = -9; for (let f = e + 1; f < ev.length; f++) if (ev[f][1] === 1) { ob = Math.max(ob, Math.atan2(ev[f][2] - WP, ev[f][0])); if (ev[f][2] >= 2) break; }
        const gs = ev[e][3]; if (gs) { const L = Math.hypot(gs.bx - gs.ax, gs.by - gs.ay) || 1; gcos[j] = Math.abs(dx * (gs.by - gs.ay) - dy * (gs.bx - gs.ax)) / L; }   // the ray against the pane's normal, in plan
        const l0 = Math.max(0, wl), skyLo = Math.max(l0, ob); if (wh > skyLo) { lo[j] = skyLo; hi[j] = wh; } if (ob > l0) { olo[j] = l0; ohi[j] = Math.min(ob, wh); } dist[j] = d; break;
      }
    }
  }
  // daylight coefficients: horizontal illuminance per unit luminance of each patch, ∫∫ sin·cos over what shows
  const dc = new Float32Array(NP), da = 2 * Math.PI / nb; let erc = 0;
  for (let j = 0; j < nb; j++) { const az = (j + 0.5) * 360 / nb;
    if (olo[j] < ohi[j]) erc += da * 0.25 * (Math.cos(2 * olo[j]) - Math.cos(2 * ohi[j]));
    if (lo[j] >= hi[j]) continue;
    for (let q = 0; q < NP; q++) { const P = PATCH[q]; let z = az; if (z < P.z0) z += 360; if (z >= P.z1) continue; const a = Math.max(lo[j], P.a0), b = Math.min(hi[j], P.a1); if (b > a) { const m = Math.max(1, Math.ceil((b - a) / (2 * D2R))), st = (b - a) / m; let v = 0; for (let t = 0; t < m; t++) { const al = a + (t + 0.5) * st; v += Math.sin(al) * Math.cos(al) * glassAng(Math.cos(al) * gcos[j]); } dc[q] += da * v * st; } } }
  const idx = [], val = []; for (let q = 0; q < NP; q++) if (dc[q] > 1e-7) { idx.push(q); val.push(dc[q] * TAU); }
  // sun: the visible altitude range per degree of bearing, packed as half-degrees
  const sun = new Uint8Array(720), sunc = new Uint8Array(360); for (let k = 0; k < 360; k++) { const j = Math.floor(k * nb / 360); sunc[k] = Math.round(gcos[j] * 255); sun[2 * k] = lo[j] < hi[j] ? Math.round(lo[j] / D2R * 2) : 255; sun[2 * k + 1] = lo[j] < hi[j] ? Math.round(hi[j] / D2R * 2) : 0; }
  return { idx: Uint8Array.from(idx), val: Float32Array.from(val), erc: erc * TAU, sun, sunc, lo, hi, dist };
}
// clear glass (n = 1.52) at an angle: Fresnel reflection at both faces, multiple reflections and the longer path inside,
// as Radiance's glass; scaled so it is TAU at normal incidence. glassAng(cos of incidence) is the share of TAU passed.
const GLASS = { tau: -1, tab: null };
function glassAng(c) {
  if (GLASS.tau !== TAU) { const n = 1.52, r0 = ((n - 1) / (n + 1)) ** 2, A = r0 * r0 * TAU, Bq = (1 - r0) ** 2, t0 = Math.min(1, (-Bq + Math.sqrt(Bq * Bq + 4 * A * TAU)) / (2 * A)), tab = new Float32Array(201);
    const T = (ci) => { const si = Math.sqrt(Math.max(0, 1 - ci * ci)), ct = Math.sqrt(Math.max(0, 1 - (si / n) ** 2)), rs = ((ci - n * ct) / (ci + n * ct)) ** 2, rp = ((n * ci - ct) / (n * ci + ct)) ** 2, tt = Math.pow(t0, 1 / Math.max(ct, 1e-3));
      return 0.5 * ((1 - rs) ** 2 * tt / (1 - rs * rs * tt * tt) + (1 - rp) ** 2 * tt / (1 - rp * rp * tt * tt)); };
    const T0 = T(1); for (let i = 0; i <= 200; i++) tab[i] = i ? T(i / 200) / T0 : 0; GLASS.tau = TAU; GLASS.tab = tab; }
  const x = Math.max(0, Math.min(1, c)) * 200, i = Math.floor(x); return i >= 200 ? 1 : GLASS.tab[i] + (GLASS.tab[i + 1] - GLASS.tab[i]) * (x - i);
}
// the sun through the glass at its own angle of incidence
const sunGlass = (sk, alt, az) => sk.sunc ? glassAng(Math.cos(alt * D2R) * sk.sunc[Math.floor(((az % 360) + 360) % 360)] / 255) : 1;
const sunSeen = (sk, alt, az) => { const k = Math.floor(((az % 360) + 360) % 360) * 2, a = alt * 2; return sk.sun[k] !== 255 && a >= sk.sun[k] && a <= sk.sun[k + 1]; };
// light reflected inside each room (BRE split flux), as a share of the outdoor horizontal illuminance
function roomIRC() {
  const G = GC.G, R = GC.R, N = R.nRooms, c = G.c, F = new Float64Array(N), P = new Float64Array(N), Wg = new Float64Array(N), ob = new Float64Array(N), nob = new Float64Array(N);
  for (let i = 0; i < R.room.length; i++) { const k = R.room[i]; if (k < 0) continue; F[k] += c * c; const x = i % G.W, y = (i / G.W) | 0; for (const j of [x ? i - 1 : -1, x < G.W - 1 ? i + 1 : -1, y ? i - G.W : -1, y < G.H - 1 ? i + G.W : -1]) if (j < 0 || R.room[j] !== k) { P[k] += c; break; } }
  const cell = (x, y) => { const cx = Math.floor(x / c), cy = Math.floor(y / c); return cx < 0 || cy < 0 || cx >= G.W || cy >= G.H ? -2 : R.out[cy * G.W + cx] ? -1 : R.room[cy * G.W + cx]; };
  for (const w of SC.walls) { if (!w.glass) continue; const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]); if (L < 0.05) continue; const nx = -(w.b[1] - w.a[1]) / L, ny = (w.b[0] - w.a[0]) / L, mx = (w.a[0] + w.b[0]) / 2, my = (w.a[1] + w.b[1]) / 2;
    const s1 = cell(mx + nx * 0.35, my + ny * 0.35), s2 = cell(mx - nx * 0.35, my - ny * 0.35), area = L * Math.max(0, Math.min(HEAD, CEIL) - w.h);
    for (const [k, o, sg] of [[s1, s2, -1], [s2, s1, 1]]) { if (k < 0 || o >= 0) continue; Wg[k] += area;   // a pane between a room and the outdoors
      const dx = nx * sg, dy = ny * sg, end = boxExit(mx, my, dx, dy, SC.bounds); let a = 0; for (const s of GC.S) { if (s.glass || s.h < 2) continue; const d = rayHit(mx + dx * 0.1, my + dy * 0.1, dx, dy, s); if (d > 0 && d < end) a = Math.max(a, Math.atan2(s.h - (w.h + HEAD) / 2, d)); } ob[k] += a * area; nob[k] += area; } }
  const CT = [39, 35, 31, 25, 20, 14, 10, 7, 5], out = new Float32Array(N);
  for (let k = 0; k < N; k++) { if (!Wg[k] || !F[k]) continue; const hm = (0.75 + HEAD) / 2, A = 2 * F[k] + P[k] * CEIL, Rm = (F[k] * RF + F[k] * RC + P[k] * CEIL * RW) / A;
    const Rfw = (F[k] * RF + P[k] * hm * RW) / (F[k] + P[k] * hm), Rcw = (F[k] * RC + P[k] * (CEIL - hm) * RW) / (F[k] + P[k] * (CEIL - hm)), oa = nob[k] ? ob[k] / nob[k] / D2R : 0, ci = clamp(oa / 10, 0, 8), Cc = CT[Math.floor(ci)] + (CT[Math.min(8, Math.floor(ci) + 1)] - CT[Math.floor(ci)]) * (ci - Math.floor(ci));
    out[k] = TAU * Wg[k] / (A * (1 - Rm)) * (Cc * Rfw + 5 * Rcw) / 100; }
  return out;
}

// ================= the year over the floor =================
let RES = null, STOP = false;
function analyse() {
  const S = obstacles(), gkey = JSON.stringify([SC.hm ? SC.hm.id : 0, SC.bounds, SC.walls.map((w) => [w.a, w.b, w.h, w.glass, w.furnline]), SC.furn.map((f) => [f.x, f.y, f.w, f.d, f.h])]);
  if (GC.key !== gkey) { const G = buildGrid(S); GC = { key: gkey, G, S, R: floorRegion(G) }; }
}
let wfWeatherRows=null,wfWeatherHash='';
function weatherIdentity(){if(wfWeatherRows!==EPW.rows){wfWeatherRows=EPW.rows;const text=JSON.stringify(EPW.rows);let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}wfWeatherHash=(h>>>0).toString(16);}return wfWeatherHash;}
const setKey = () => JSON.stringify([GC.key, LOC, EPW.name, weatherIdentity(), NORTH, TAU, RF, RW, RC, WP, HEAD, CEIL, OCC]);
const tick = () => new Promise((r) => setTimeout(r, 0));
const occ = (h) => h >= OCC[0] && h < OCC[1];
function hourLux(sk, irc, L, i) {   // illuminance on the work plane at hour i (lux): sky + sun + outside reflections + inside reflections
  if (!YEAR) return [0, 0];   // the model changed while this was running
  const Eb = YEAR.Eb[i], Ed = YEAR.Ed[i], alt = YEAR.alt[i]; if (alt <= 0.5 || Ed + Eb < 1) return [0, 0];
  let e = 0; for (let q = 0; q < sk.idx.length; q++) e += sk.val[q] * L[sk.idx[q]];
  const Eo = Ed + Eb * Math.sin(alt * D2R), sun = sunSeen(sk, alt, YEAR.az[i]) ? Eb * Math.sin(alt * D2R) * TAU * sunGlass(sk, alt, YEAR.az[i]) : 0;
  return [e + sun + sk.erc * 0.15 * Eo / Math.PI + irc * Eo, sun];
}
async function compute(spacing, nb, onProg) {
  analyse(); const runInputKey = setKey();
  analyse(); if (!YEAR) buildYear(); const G = GC.G, reg = GC.R.reg, B = SC.bounds, PW = Math.ceil(B.w / spacing), PH = Math.ceil(B.h / spacing), pts = [];
  for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) { const x = (i + 0.5) * spacing, y = (j + 0.5) * spacing, cx = Math.floor(x / G.c), cy = Math.floor(y / G.c); if (cx >= G.W || cy >= G.H) continue; const ci = cy * G.W + cx; if (reg[ci]) pts.push({ i, j, x, y, ci }); }
  const irc = roomIRC(), Lh = new Array(8760), hours = []; for (let i = 0; i < 8760; i++) if (YEAR.alt[i] > 0.5 && YEAR.Ed[i] + YEAR.Eb[i] >= 1) { Lh[i] = Lof(i); hours.push(i); }
  const nOcc = 365 * (OCC[1] - OCC[0]), over = new Uint32Array(8760), ov = new Float32Array(NP); skyLum(45, 180, 0, 1, ov);   // overcast sky giving 1 lux on the ground
  const opt2 = [[3, 21, 9], [3, 21, 15], [9, 21, 9], [9, 21, 15]].map(([m, d, h]) => { const sp = sunPos(2026, m, d, h, LOC.lat, LOC.lon, LOC.tz), cs = sp.alt > 0.5 ? clearSky(sp.alt) : { Eb: 0, Ed: 0 }; return { alt: sp.alt, az: sp.az, Eb: cs.Eb, Ed: cs.Ed, L: skyLum(Math.max(sp.alt, 0.6), sp.az, cs.Eb, Math.max(cs.Ed, 1), new Float32Array(NP)) }; });
  const ev = new Array(pts.length); let t0 = performance.now();
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k], sk = spotSky([p.x, p.y], nb, GC.S), rk = GC.R.room[p.ci], ir = rk >= 0 ? irc[rk] : 0; let lit = 0, sunH = 0, sum = 0;
    for (const i of hours) { const [e, s] = hourLux(sk, ir, Lh[i], i), h = i % 24; if (e >= 300) over[i]++; if (occ(h)) { if (e >= 300) lit++; if (s >= 1000) sunH++; sum += e; } }
    let df = 0; for (let q = 0; q < sk.idx.length; q++) df += sk.val[q] * ov[sk.idx[q]]; df = 100 * (df + sk.erc * 0.15 / Math.PI + ir);
    const o2 = opt2.map((o) => { if (o.alt <= 0.5) return 0; let e = 0; for (let q = 0; q < sk.idx.length; q++) e += sk.val[q] * o.L[sk.idx[q]]; const Eo = o.Ed + o.Eb * Math.sin(o.alt * D2R); return e + (sunSeen(sk, o.alt, o.az) ? o.Eb * Math.sin(o.alt * D2R) * TAU * sunGlass(sk, o.alt, o.az) : 0) + sk.erc * 0.15 * Eo / Math.PI + ir * Eo; });
    const am = (o2[0] + o2[2]) / 2, pm = (o2[1] + o2[3]) / 2, inR = (v) => v >= 300 && v <= 3000;
    delete sk.lo; delete sk.hi; delete sk.dist;
    ev[k] = { da: lit / nOcc, ase: sunH, sda: lit / nOcc >= 0.5, aseOver: sunH > 250, df, mean: sum / nOcc, o2: [am, pm], o2ok: inR(am) && inR(pm), sk, ir };
    if (performance.now() - t0 > 60) { onProg((k + 1) / pts.length); await tick(); t0 = performance.now(); if (STOP) return null; }
  }
  return { key: runInputKey, spacing, nb, PW, PH, pts, ev, over, irc, img: null };
}
function summary() {
  if (!RES) return null; const R = GC.R, nR = R.nRooms, rooms = Array.from({ length: nR }, (_, k) => ({ k, n: 0, sda: 0, ase: 0, o2: 0, df: 0, x: 0, y: 0, out: false }));
  const ex = new Set(EXCL.map((p) => roomAt(p)).filter((k) => k >= 0)); rooms.forEach((r) => (r.out = ex.has(r.k)));
  const t = { n: 0, sda: 0, ase: 0, o2: 0, df: 0 };
  RES.pts.forEach((p, k) => { const e = RES.ev[k], rk = R.room[p.ci], r = rk >= 0 ? rooms[rk] : null; if (r) { r.n++; r.x += p.x; r.y += p.y; r.sda += e.sda; r.ase += e.aseOver; r.o2 += e.o2ok; r.df += e.df; if (r.out) return; } t.n++; t.sda += e.sda; t.ase += e.aseOver; t.o2 += e.o2ok; t.df += e.df; });
  rooms.forEach((r) => { if (r.n) { r.x /= r.n; r.y /= r.n; } r.area = r.n * RES.spacing * RES.spacing; });
  const f = (v) => (t.n ? v / t.n : 0), sda = f(t.sda), ase = f(t.ase), o2 = f(t.o2);
  return { rooms: rooms.filter((r) => r.n), sda, ase, o2, df: f(t.df), area: t.n * RES.spacing * RES.spacing, pts1: sda >= 0.75 ? 3 : sda >= 0.55 ? 2 : 0, pts2: o2 >= 0.9 ? 2 : o2 >= 0.75 ? 1 : 0 };
}
function roomAt(p) { const G = GC.G, cx = Math.floor(p[0] / G.c), cy = Math.floor(p[1] / G.c); if (cx < 0 || cy < 0 || cx >= G.W || cy >= G.H) return -1; return GC.R.room[cy * G.W + cx]; }
function luxAt(e, i) { if (!YEAR) buildYear(); if (YEAR.alt[i] <= 0.5) return 0; const L = Lof(i); return hourLux(e.sk, e.ir, L, i)[0]; }
export const LEVELS = {
  draft: { name: 'Draft', T: 15, cand: [[0.5, 180], [0.75, 144], [1, 120]] },
  standard: { name: 'Standard', T: 180, cand: [[0.2, 360], [0.25, 360], [0.3, 360], [0.4, 240], [0.5, 180]] },
  fine: { name: 'Fine', T: 480, cand: [[0.1, 720], [0.12, 720], [0.15, 540], [0.2, 360], [0.3, 360], [0.5, 180]] },
};
const RATEK = 'pc-day-rate', rate = () => { try { return +localStorage.getItem(RATEK) || 3e-7; } catch (e) { return 3e-7; } };
// the project weather as the page read an EPW file: illuminance (lux), or irradiance × luminous efficacy where it is missing
export function epwRows(text) { const lines = String(text || '').split(/\r?\n/), rows = [];
  for (let i = 8; i < lines.length; i++) { const c = lines[i].split(','); if (c.length < 19) continue; const dni = +c[17], dhi = +c[18], dnr = +c[14], dhr = +c[15]; rows.push({ dni: dni > 0 && dni < 999990 ? dni : dnr > 0 ? dnr * 93 : 0, dhi: dhi > 0 && dhi < 999990 ? dhi : dhr > 0 ? dhr * 120 : 0 }); }
  return rows.length >= 8760 ? rows.slice(0, 8760) : null; }
function setup(sc, o = {}) { const k = JSON.stringify([sc.bounds, sc.walls?.length, sc.furn?.length]); if (!SC || SC.__k !== k) { SC = { bounds: { ...sc.bounds }, walls: (sc.walls || []).map((w) => ({ ...w })), furn: (sc.furn || []).map((f) => ({ ...f })), hm: null, __k: k }; GC = { key: '' }; }
  for (const [key, set] of [['tau', (v) => (TAU = v)], ['rf', (v) => (RF = v)], ['rw', (v) => (RW = v)], ['rc', (v) => (RC = v)], ['head', (v) => (HEAD = v)], ['ceil', (v) => (CEIL = v)], ['wp', (v) => (WP = v)], ['north', (v) => (NORTH = v)]]) if (Number.isFinite(+o[key])) set(+o[key]);
  if (o.occ) OCC = o.occ.slice(); if (o.loc) Object.assign(LOC, o.loc);
  if (o.epw !== undefined) { const rows = o.epw ? epwRows(o.epw) : null; if (rows !== EPW.rows || (!rows && EPW.rows)) { EPW.rows = rows; EPW.name = rows ? o.epwName || 'project weather' : ''; YEAR = null; } } }
export function plan(sc, o) { setup(sc, o); analyse(); const A = GC.R.area || 1, nS = Math.max(8, GC.S.length), L = LEVELS[o.level] || LEVELS.draft, VR = rate(); let best = null;
  for (const [sp, nb] of L.cand) { const n = A / (sp * sp), work = n * (nb * nS * 0.02 + 4400 * 0.12), est = VR * work + 0.3; best = { sp, nb, n, est, work }; if (est <= L.T) return best; } return best; }
export function stop() { STOP = true; }
// o: { level, tau, rf, rw, rc, head, ceil, wp, north, occ: [h0, h1], loc: { lat, lon, tz, name }, epw: text or null, epwName }
export async function run(sc, o, onProg) { STOP = false; YEAR = null; const p = plan(sc, o), t0 = performance.now(); RES = await compute(p.sp, p.nb, onProg || (() => {})); if (!RES) throw Error('Stopped.');
  const secs = (performance.now() - t0) / 1000; try { localStorage.setItem(RATEK, String(Math.max(1e-13, (secs - 0.3) / Math.max(1, p.work)))); } catch (e) { }
  return { RES, sm: summary(), R: GC.R, G: GC.G, epw: !!(YEAR && YEAR.epw), plan: p }; }
// the page's colours: daylight autonomy and daylight factor (night blue to warm white), sun exposure (sand to red)
const SRAMP = [[0, [44, 54, 92]], [0.25, [70, 104, 168]], [0.5, [246, 214, 104]], [0.75, [248, 176, 64]], [1, [255, 244, 214]]];
const ARAMP = [[0, [236, 233, 226]], [0.2, [250, 214, 150]], [0.6, [236, 120, 60]], [1, [178, 36, 30]]];
export const RAMPS = { SRAMP, ARAMP };
