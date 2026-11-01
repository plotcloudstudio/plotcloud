// Camera coverage (2026-11-01): the analysis of the Camera coverage study (the former emb/cameras.html, retired 2026-11-01),
// unchanged, for the Workspace: DORI pixel densities (IEC 62676-4) give each camera type a range at the chosen level; sight lines
// from the camera height to the watched height; candidate positions on the walls (dome, bullet: 16 directions) and the ceiling
// (fisheye); greedy picks plus swaps find the cameras that cover the most floor, for a number of cameras or a coverage target.
import { clamp } from '../../../emb/lib/plansim.js?v=1';
const SC = { bounds: { w: 16, h: 12 }, walls: [], furn: [], cams: [], hm: null };
const window = { __isoCmin: 0, __isoCells: 350000 };   // the page's tuning hooks, at their defaults
let STOP = false;
// ================= cameras =================
// DORI pixel densities (IEC 62676-4): pixels per meter across the scene needed to detect, observe, recognize or identify a person.
const LEVELS = { detect: { name: 'Detect', ppm: 25, note: 'see that someone is there' }, observe: { name: 'Observe', ppm: 62.5, note: 'see what someone is doing' }, recognise: { name: 'Recognize', ppm: 125, note: 'tell who a person you know is' }, identify: { name: 'Identify', ppm: 250, note: 'identify a stranger beyond doubt' } };
const TYPES = [
  { k: 'dome', name: 'Dome', fov: 100, px: 2560, price: 169.99, use: true },
  { k: 'bullet', name: 'Bullet', fov: 85, px: 2560, price: 199.99, use: true },
  { k: 'fish', name: 'Fisheye 360°', fov: 360, px: 2560, price: 589.99, use: true },
];
const TY = (k) => TYPES.find((t) => t.k === k) || TYPES[0];
const isFish = (T) => T.fov >= 360;
let CAMH = 2.7, TGT = 1.0, LEVEL = 'recognise', TOOL = 'select', SEL = null, SHOW = 'count', MODE = 'budget';
// horizontal distance at which the camera still gives the pixels per meter of the chosen level, at the watched height
function rangeOf(T) {
  const ppm = LEVELS[LEVEL].ppm, dz = Math.max(0, CAMH - TGT);
  const slant = isFish(T) ? T.px / (Math.PI * ppm) : T.px / (2 * Math.tan(clamp(T.fov, 10, 179) / 2 * Math.PI / 180) * ppm);   // fisheye: pixels spread over 180°
  return slant > dz ? Math.sqrt(slant * slant - dz * dz) : 0;
}
const CAMCOL = ['#2563eb', '#d97706', '#059669', '#db2777', '#7c3aed', '#0891b2', '#65a30d', '#dc2626', '#4f46e5', '#ca8a04', '#0d9488', '#c026d3'];
const camCol = (i) => CAMCOL[i % CAMCOL.length];
const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const money = (v) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ================= sightlines =================
// The same ray model as Isovist Safety, from the camera's mounting height: walls of 2 m or more stop the view (they are
// taken to reach the ceiling); lower pieces hide the strip behind them down to the watched height.
const NR = 720, DA = 2 * Math.PI / NR;
function obstacles() {
  const S = [];
  for (const w of SC.walls) { if (!(w.h > 0) && !w.glass) continue; const full = !w.glass && !w.furnline && w.h >= 2.0; S.push({ ax: w.a[0], ay: w.a[1], bx: w.b[0], by: w.b[1], h: full ? 99 : w.h, room: w.glass || full }); }
  for (const f of SC.furn) { if (!(f.h > 0)) continue; const P = [[f.x, f.y], [f.x + f.w, f.y], [f.x + f.w, f.y + f.d], [f.x, f.y + f.d]]; for (let i = 0; i < 4; i++) { const a = P[i], b = P[(i + 1) % 4]; S.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], h: f.h, room: false }); } }
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
// The floor to watch: everything inside the walls (doorways up to ~1.1 m are bridged), less furniture. If the walls do not
// close, the whole canvas counts and the result is marked approximate.
function coverRegion(G) {
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
  // pockets no wider than a wall (the hollow between a model wall's two faces) are not floor
  const lab = new Uint8Array(N), thin = 0.17 / c;
  for (let s0 = 0; s0 < N; s0++) { if (!reg[s0] || lab[s0]) continue; const comp = [s0]; lab[s0] = 1; let mx = 0;
    for (let q = 0; q < comp.length; q++) { const i = comp[q], x = i % W, y = (i / W) | 0; if (D[i] > mx) mx = D[i]; for (const j of [x ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && reg[j] && !lab[j]) { lab[j] = 1; comp.push(j); } }
    if (mx <= thin) for (const i of comp) reg[i] = 0; else n += comp.length; }
  if (n < N * 0.02) { approx = true; n = 0; for (let i = 0; i < N; i++) { reg[i] = solid[i] ? 0 : 1; n += reg[i]; } }
  return { reg, approx, area: n * c * c, D };
}
const angDiff = (a, b) => { let d = (a - b) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
function rayOK(rays, r, a) { const ray = rays[Math.round(a / DA) % NR]; if (r > ray.end) return false; for (const iv of ray.hid) { if (r < iv[0]) break; if (r <= iv[1]) return false; } return true; }
// floor cells one camera covers, on the analysis grid
const MASKS = new Map();
function clipOut(p, th, r) {   // stop an outline ray where it leaves the floor being watched (through glass, out of a door)
  const G = GC.G, reg = GC.R.reg, solid = G.solid, dx = Math.cos(th), dy = Math.sin(th), st = G.c * 0.5;
  for (let t = st; t < r; t += st) { const x = Math.floor((p[0] + dx * t) / G.c), y = Math.floor((p[1] + dy * t) / G.c); if (x < 0 || y < 0 || x >= G.W || y >= G.H) return t; const i = y * G.W + x; if (!reg[i] && !solid[i]) return t; }
  return r;
}
function camMask(cam) {
  const T = TY(cam.type), key = [GC.key, CAMH, TGT, LEVEL, cam.x, cam.y, cam.dir, T.fov, T.px, isFish(T)].join('|'); if (MASKS.has(key)) return MASKS.get(key);
  const G = GC.G, reg = GC.R.reg, { W, H, c } = G, p = [cam.x, cam.y], rays = castRays(GC.S, p, CAMH), R = rangeOf(T), half = isFish(T) ? 9 : T.fov / 2 * Math.PI / 180 + 1e-6, dir = cam.dir * Math.PI / 180, out = [];
  const x0 = clamp(Math.floor((p[0] - R) / c), 0, W - 1), x1 = clamp(Math.ceil((p[0] + R) / c), 0, W - 1), y0 = clamp(Math.floor((p[1] - R) / c), 0, H - 1), y1 = clamp(Math.ceil((p[1] + R) / c), 0, H - 1);
  for (let y = y0; y <= y1; y++) { const dy = (y + 0.5) * c - p[1]; for (let x = x0; x <= x1; x++) { const i = y * W + x; if (!reg[i]) continue; const dx = (x + 0.5) * c - p[0], r = Math.hypot(dx, dy); if (r > R) continue; let a = Math.atan2(dy, dx); if (a < 0) a += 2 * Math.PI; if (half < Math.PI && angDiff(a, dir) > half) continue; if (r < 1e-9 || rayOK(rays, r, a)) out.push(i); } }
  const m = Uint32Array.from(out), poly = []; if (half < Math.PI) poly.push(p.slice());   // the outline of what it sees: walls and range cut it
  const n = half < Math.PI ? Math.max(2, Math.round(2 * half / DA)) : NR; for (let k = 0; k <= n; k++) { const th = half < Math.PI ? dir - half + 2 * half * k / n : k * DA, q = Math.round((((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / DA) % NR, r = clipOut(p, th, Math.min(rays[q].end, R)); poly.push([p[0] + Math.cos(th) * r, p[1] + Math.sin(th) * r]); }
  m.poly = poly; if (MASKS.size > 2000) MASKS.clear(); MASKS.set(key, m); return m;
}
// ================= analysis =================
let GC = { key: '' }, COV = null;
function analyse() {
  const S = obstacles(), gkey = JSON.stringify([SC.hm ? SC.hm.id : 0, SC.bounds, SC.walls.map((w) => [w.a, w.b, w.h, w.glass, w.furnline]), SC.furn.map((f) => [f.x, f.y, f.w, f.d, f.h])]);
  if (GC.key !== gkey) { const G = buildGrid(S); GC = { key: gkey, G, S, R: coverRegion(G) }; MASKS.clear(); }
  coverage();
}
function coverage() {
  const G = GC.G, N = G.W * G.H, cnt = new Uint8Array(N), own = new Int16Array(N).fill(-1), od = new Float32Array(N), reg = GC.R.reg, c = G.c, a2 = c * c;
  const masks = SC.cams.map(camMask);
  masks.forEach((m, k) => { const cam = SC.cams[k]; for (const i of m) { if (cnt[i] < 255) cnt[i]++; const d = Math.hypot(((i % G.W) + 0.5) * c - cam.x, (((i / G.W) | 0) + 0.5) * c - cam.y); if (own[i] < 0 || d < od[i]) { own[i] = k; od[i] = d; } } });
  const per = masks.map((m) => { let u = 0; for (const i of m) if (cnt[i] === 1) u++; return { area: m.length * a2, uniq: u * a2 }; });
  let cov = 0, tot = 0; const ov = [0, 0, 0, 0]; for (let i = 0; i < N; i++) if (reg[i]) { tot++; if (cnt[i]) cov++; ov[Math.min(3, cnt[i])]++; }
  COV = { cnt, own, per, masks, cov: cov * a2, area: tot * a2, frac: tot ? cov / tot : 0, ov: ov.map((v) => v * a2), cost: SC.cams.reduce((s, q) => s + (+TY(q.type).price || 0), 0) };
}

// ================= optimization =================
// Candidates: points 0.15–0.35 m inside the walls about every 0.8 m (dome and bullet, 16 directions each) and a 1.25 m grid on the
// ceiling (360°). Each candidate's coverage is listed on a coarse grid of watch points; then greedy picks plus swaps find the set
// of n cameras that covers the most, for every n up to full coverage.
let OPT = null, CAND = null, BUSY = false;
const DENS = { cc: 0.25, wsp: 0.8, fsp: 1.25, dirs: 16 };
const setKey = () => JSON.stringify([GC.key, CAMH, TGT, LEVEL, TYPES.map((t) => [t.use, t.fov, t.px]), DENS]);
const tick = () => new Promise((r) => setTimeout(r, 0));
async function candidates(prog) {
  const key = setKey(); if (CAND && CAND.key === key) return CAND;
  const G = GC.G, { W, H, c } = G, reg = GC.R.reg, D = GC.R.D, cc = Math.max(DENS.cc, Math.sqrt(GC.R.area / 400000));
  const tx = [], ty = [];
  for (let y = cc / 2; y < SC.bounds.h; y += cc) for (let x = cc / 2; x < SC.bounds.w; x += cc) { const i = Math.floor(y / c) * W + Math.floor(x / c); if (reg[i]) { tx.push(x); ty.push(y); } }
  const Tn = tx.length, used = TYPES.filter((t) => t.use), wallT = used.filter((t) => !isFish(t)), fishT = used.filter(isFish);
  const pts = []; const near = (x, y, sp) => pts.some((p) => p.w === (sp < 1 ? 1 : 0) && Math.hypot(p.x - x, p.y - y) < sp);
  if (wallT.length) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!reg[i]) continue; const d = D[i] * c; if (d < 0.15 || d > 0.35) continue; const px = (x + 0.5) * c, py = (y + 0.5) * c; if (!near(px, py, DENS.wsp)) pts.push({ x: px, y: py, w: 1 }); }
  if (fishT.length) for (let y = 0.6; y < SC.bounds.h; y += DENS.fsp) for (let x = 0.6; x < SC.bounds.w; x += DENS.fsp) { const i = Math.floor(y / c) * W + Math.floor(x / c); if (reg[i] && D[i] * c >= 0.4) pts.push({ x, y, w: 0 }); }
  const maxR = Math.max(0.1, ...used.map(rangeOf)), list = [];
  for (let q = 0; q < pts.length; q++) {
    const P = pts[q], rays = castRays(GC.S, [P.x, P.y], CAMH), vis = [];
    for (let t = 0; t < Tn; t++) { const dx = tx[t] - P.x, dy = ty[t] - P.y, r = Math.hypot(dx, dy); if (r > maxR) continue; let a = Math.atan2(dy, dx); if (a < 0) a += 2 * Math.PI; if (r < 1e-9 || rayOK(rays, r, a)) vis.push(t, r, a); }
    for (const T of P.w ? wallT : fishT) { const R = rangeOf(T), half = isFish(T) ? 9 : T.fov / 2 * Math.PI / 180 + 1e-6;
      for (let k = 0; k < (isFish(T) ? 1 : DENS.dirs); k++) { const dir = k * 2 * Math.PI / DENS.dirs, l = []; for (let j = 0; j < vis.length; j += 3) if (vis[j + 1] <= R && (half > Math.PI || angDiff(vis[j + 2], dir) <= half)) l.push(vis[j]); if (l.length >= 2) list.push({ x: P.x, y: P.y, dir: +(k * 360 / DENS.dirs).toFixed(4), type: T.k, price: +T.price || 0, l: Int32Array.from(l) }); } }
    if (prog && q % 8 === 0) { prog(0.3 * q / pts.length); await tick(); }
  }
  const any = new Uint8Array(Tn); for (const C of list) for (const t of C.l) any[t] = 1; let reach = 0; for (let t = 0; t < Tn; t++) reach += any[t];
  CAND = { key, Tn, tx, ty, cc, list, reach, pts: pts.length }; return CAND;
}
function lockedList(cam) { const m = camMask(cam), G = GC.G, C = CAND, l = new Set(); for (const i of m) { const x = ((i % G.W) + 0.5) * G.c, y = (((i / G.W) | 0) + 0.5) * G.c, t = Math.floor(y / C.cc) * Math.ceil(SC.bounds.w / C.cc) + Math.floor(x / C.cc); l.add(t); } return l; }
// one more camera on top of a set, then swaps until no single swap covers more
const covCnt = (cnt) => { let c = 0; for (let t = 0; t < cnt.length; t++) if (cnt[t]) c++; return c / cnt.length; };
function grow(C, cnt, sel, log) {
  const L = C.list, top = []; let best = -1, bg = 0, bp = Infinity;
  for (let j = 0; j < L.length; j++) { if (sel.includes(j)) continue; let g = 0; for (const t of L[j].l) if (!cnt[t]) g++; if (g > bg || (g === bg && g > 0 && L[j].price < bp)) { bg = g; best = j; bp = L[j].price; } if (log && g > 0) { top.push([g, j]); if (top.length > 60) { top.sort((a, b) => b[0] - a[0]); top.length = 30; } } }
  if (best < 0) return false; sel.push(best); for (const t of L[best].l) cnt[t]++;
  if (log) {   // a few strong runners-up at other spots, weakest first, so the replay ends on the winner
    top.sort((a, b) => b[0] - a[0]); const key = (j) => L[j].x.toFixed(1) + ',' + L[j].y.toFixed(1), seen = new Set([key(best)]), tries = [];
    for (const [, j] of top) { if (seen.has(key(j))) continue; seen.add(key(j)); tries.push(j); if (tries.length >= 5) break; }
    log.push({ type: 'add', tries: tries.reverse(), pick: best, slot: sel.length - 1, cov: covCnt(cnt) }); }
  return true;
}
function swaps(C, cnt, sel, log) {
  const L = C.list;
  for (let pass = 0; pass < 6; pass++) { let imp = false;
    for (let k = 0; k < sel.length; k++) { const i = sel[k]; for (const t of L[i].l) cnt[t]--; let loss = 0; for (const t of L[i].l) if (!cnt[t]) loss++;
      let best = i, bg = loss; for (let j = 0; j < L.length; j++) { if (j === i || sel.includes(j)) continue; let g = 0; for (const t of L[j].l) if (!cnt[t]) g++; if (g > bg) { bg = g; best = j; } }
      if (best !== i) { sel[k] = best; imp = true; } for (const t of L[sel[k]].l) cnt[t]++; if (best !== i && log) log.push({ type: 'swap', slot: k, from: i, to: best, cov: covCnt(cnt) }); }
    if (!imp) break; }
}
export function stop() { STOP = true; }
// o: { camh, tgt, level: detect|observe|recognise|identify, mode: budget|all, n, want, types: { dome, bullet, fish } }
export async function run(sc, o, onProg = () => {}) {
  STOP = false; SC.bounds = { ...sc.bounds }; SC.walls = (sc.walls || []).map((w) => ({ ...w })); SC.furn = (sc.furn || []).map((f) => ({ ...f })); SC.cams = []; SC.hm = null;
  CAMH = +o.camh || 2.7; TGT = +o.tgt || 0; LEVEL = LEVELS[o.level] ? o.level : 'recognise'; for (const T of TYPES) T.use = o.types ? !!o.types[T.k] : true;
  if (!TYPES.some((t) => t.use)) throw Error('Tick at least one camera type.');
  GC = { key: '' }; MASKS.clear(); CAND = null; analyse();
  const prog = (f) => { if (STOP) throw Error('Stopped.'); onProg(f); };
  const C = await candidates(prog); if (!C.list.length) throw Error('No place on the walls sees any floor: draw closed walls, or check the model.');
  const cnt = new Uint16Array(C.Tn), sel = [], curve = [], N = Math.max(1, Math.round(+o.n || 4)), want = +o.want || 0.95, covOf = () => { let s = 0; for (let t = 0; t < C.Tn; t++) if (cnt[t]) s++; return s / C.Tn; };
  for (let n = 1; n <= 30; n++) { if (!grow(C, cnt, sel, null)) break; swaps(C, cnt, sel, null); const cov = covOf(); curve.push({ n, cov, sel: sel.slice(), cost: sel.reduce((s, j) => s + C.list[j].price, 0) });
    prog(0.3 + 0.7 * Math.min(1, o.mode === 'all' ? cov / want : n / N)); await tick(); if (cov >= C.reach / C.Tn - 1e-9) break; if (o.mode !== 'all' && n >= N) break; if (o.mode === 'all' && cov >= want - 1e-9) break; }
  const pick = o.mode === 'all' ? curve.find((p) => p.cov >= want - 1e-9) || curve[curve.length - 1] : curve.find((p) => p.n === N) || curve[curve.length - 1], L = C.list;
  SC.cams = pick.sel.map((j) => ({ x: +L[j].x.toFixed(3), y: +L[j].y.toFixed(3), dir: L[j].dir, type: L[j].type })); coverage();
  return { COV, cams: SC.cams.map((q, k) => ({ ...q, col: camCol(k), poly: COV.masks[k].poly, name: TY(q.type).name, range: rangeOf(TY(q.type)) })), G: GC.G, R: GC.R, curve, pick, reach: C.reach / C.Tn, want, N };
}
export { LEVELS, TYPES, BLUES_, CAMCOL };
const BLUES_ = [[198, 219, 239], [107, 174, 214], [33, 113, 181], [8, 48, 107]];   // the page's How many see it colours
