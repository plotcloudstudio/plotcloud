// Isovist safety (2026-11-01): the analysis of the Isovist safety study (the former emb/isovist.html, retired 2026-11-01), unchanged,
// for the Workspace: from a viewpoint at an eye height, which floor (or a child at 0.6 or 1.0 m) is seen and which is a blind spot,
// within the room around the viewpoint; the same for a child (1.0 m), a wheelchair user (1.2 m) and an adult (1.6 m); hazards seen.
import { clamp } from '../../../emb/lib/plansim.js?v=1';
let SC = null, EYE = 1.0, TGT = 0.6;
const window = { __isoCmin: 0, __isoCells: 350000 };   // the page's tuning hooks, at their defaults
// ================= analysis =================
// Obstacles are 2D segments with a height. One ray loop does all the height logic (720 rays):
//  - a piece taller than the eye (h >= E) stops the ray: nothing behind it is seen;
//  - a lower piece at distance d lets the eye see over it but hides the floor from d to d·E/(E − h),
//    where the sightline over its top comes back down to the floor.
// That is for the floor; looking for something at height z (a seated child's head, 0.6 m), the strip ends at d·(E − z)/(E − h),
// and pieces lower than z hide nothing. A 0.9 m shelf 3 m away hides 9 m behind it from a 1.0 m eye but 1.3 m from a 1.6 m eye.
const NR = 720, DA = 2 * Math.PI / NR;
function obstacles() {
  const S = [];
  for (const w of SC.walls) { if (!(w.h > 0) && !w.glass) continue; S.push({ ax: w.a[0], ay: w.a[1], bx: w.b[0], by: w.b[1], h: w.h, room: w.glass || (!w.furnline && w.h >= 2.0) }); }
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
// the room the viewer stands in: walls of 2 m or more and glazing close it; doorways up to ~1.1 m are bridged
// (closing with a 0.55 m disc), then grown back. If the floor still runs out to the canvas edge, the walls do not
// close and the whole canvas counts (an approximation, marked as such).
function roomRegion(G, v) {
  const { W, H, room, solid } = G, N = W * H, INF = 1e9, D = new Float32Array(N), R = Math.max(2, Math.round(0.55 / G.c));
  for (let i = 0; i < N; i++) D[i] = room[i] ? 0 : INF;
  const r2 = Math.SQRT2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; let d = D[i]; if (!d) continue; if (x) d = Math.min(d, D[i - 1] + 1); if (y) { d = Math.min(d, D[i - W] + 1); if (x) d = Math.min(d, D[i - W - 1] + r2); if (x < W - 1) d = Math.min(d, D[i - W + 1] + r2); } D[i] = d; }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; let d = D[i]; if (!d) continue; if (x < W - 1) d = Math.min(d, D[i + 1] + 1); if (y < H - 1) { d = Math.min(d, D[i + W] + 1); if (x < W - 1) d = Math.min(d, D[i + W + 1] + r2); if (x) d = Math.min(d, D[i + W - 1] + r2); } D[i] = d; }
  let sx = clamp(Math.floor(v[0] / G.c), 0, W - 1), sy = clamp(Math.floor(v[1] / G.c), 0, H - 1);
  let open = (i) => !room[i] && D[i] > R;
  if (!open(sy * W + sx)) { let best = -1, bd = Infinity; for (let j = -R - 3; j <= R + 3; j++) for (let i = -R - 3; i <= R + 3; i++) { const x = sx + i, y = sy + j; if (x < 0 || y < 0 || x >= W || y >= H) continue; const q = y * W + x; if (open(q) && i * i + j * j < bd) { bd = i * i + j * j; best = q; } } if (best >= 0) { sx = best % W; sy = (best / W) | 0; } else open = (i) => !room[i]; }
  const F = new Uint8Array(N), st = [sy * W + sx]; F[st[0]] = 1; let touch = false;
  while (st.length) { const i = st.pop(), x = i % W, y = (i / W) | 0; if (!x || !y || x === W - 1 || y === H - 1) touch = true; for (const j of [x ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && !F[j] && open(j)) { F[j] = 1; st.push(j); } }
  const reg = new Uint8Array(N);
  if (touch) { for (let i = 0; i < N; i++) reg[i] = solid[i] ? 0 : 1; return { reg, approx: true }; }
  // grow back by R through cells that are not room walls
  let front = []; for (let i = 0; i < N; i++) if (F[i]) { reg[i] = 1; front.push(i); }
  for (let step = 0; step <= R && front.length; step++) { const nx = []; for (const i of front) { const x = i % W, y = (i / W) | 0; for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const xx = x + k, yy = y + j; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = yy * W + xx; if (!reg[q] && !room[q]) { reg[q] = 1; nx.push(q); } } } front = nx; }
  for (let i = 0; i < N; i++) if (solid[i]) reg[i] = 0;
  return { reg, approx: false };
}
function visMask(G, rays, v) {   // floor cells seen, read from the nearest of the 720 rays
  const { W, H, c, solid } = G, M = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) { const cy = (y + 0.5) * c - v[1]; for (let x = 0; x < W; x++) { const i = y * W + x; if (solid[i]) continue; const cx = (x + 0.5) * c - v[0], r = Math.hypot(cx, cy);
    if (r < 1e-9) { M[i] = 1; continue; } let a = Math.atan2(cy, cx); if (a < 0) a += 2 * Math.PI; const ray = rays[Math.round(a / DA) % NR]; if (r > ray.end) continue; let ok = true; for (const iv of ray.hid) { if (r < iv[0]) break; if (r <= iv[1]) { ok = false; break; } } if (ok) M[i] = 1; } }
  return M;
}
function sees(S, v, E, x, y, th) {   // sightline from the eye to (x, y, th): blocked where anything stands above it
  const dx = x - v[0], dy = y - v[1], L = Math.hypot(dx, dy); if (L < 1e-6) return true;
  for (const s of S) {
    const ex = s.bx - s.ax, ey = s.by - s.ay, den = dx * ey - dy * ex; if (Math.abs(den) < 1e-12) continue;
    const qx = s.ax - v[0], qy = s.ay - v[1], t = (qx * ey - qy * ex) / den, u = (qx * dy - qy * dx) / den;
    if (u < -1e-9 || u > 1 + 1e-9 || t <= 1e-7 || t * L > L - 0.15) continue;   // the last 15 cm is the hazard's own object
    if (s.h > E + (th - E) * t + 1e-9) return false;
  }
  if (SC.hm) { let ok = true; cellWalk(SC.hm, v, dx / L, dy / L, L - 0.15, (d, dn, val) => { const t = (d + dn) / 2 / L; if (hmH(val) > E + (th - E) * t + 1e-9) { ok = false; return true; } return false; }); return ok; }
  return true;
}
const CMP = [{ k: 'child', name: 'Child', E: 1.0, col: [232, 86, 74] }, { k: 'wheel', name: 'Wheelchair', E: 1.2, col: [62, 142, 222] }, { k: 'adult', name: 'Adult', E: 1.6, col: [76, 170, 96] }];
let A = null, GC = { key: '' };
function analyse() {
  const t0 = performance.now(), S = obstacles(), gkey = JSON.stringify([SC.hm ? SC.hm.id : 0, SC.bounds, SC.walls.map((w) => [w.a, w.b, w.h, w.glass, w.furnline]), SC.furn.map((f) => [f.x, f.y, f.w, f.d, f.h]), SC.view]);
  if (GC.key !== gkey) { const G = buildGrid(S); GC = { key: gkey, G, R: SC.view ? roomRegion(G, SC.view) : null, cmp: null }; }
  const G = GC.G;
  if (!SC.view) { A = { G, S, noView: true }; return; }
  const one = (E) => { const rays = castRays(S, SC.view, E), vis = visMask(G, rays, SC.view); let eff = 0, seen = 0; const reg = GC.R.reg; for (let i = 0; i < reg.length; i++) if (reg[i]) { eff++; if (vis[i]) seen++; } return { E, rays, vis, eff: eff * G.c * G.c, seen: seen * G.c * G.c, blind: eff ? 1 - seen / eff : 0, haz: SC.haz.map((h) => sees(S, SC.view, E, h.x, h.y, h.h)) }; };
  const cur = one(EYE);
  if (!GC.cmp) { GC.cmp = CMP.map((p) => one(p.E)); const N = G.W * G.H, cat = new Uint8Array(N); for (let i = 0; i < N; i++) { for (let q = 0; q < 3; q++) if (GC.cmp[q].vis[i]) { cat[i] = q + 1; break; } } GC.cat = cat; }
  for (const c of GC.cmp) c.haz = SC.haz.map((h) => sees(S, SC.view, c.E, h.x, h.y, h.h));   // hazards are cheap: always fresh
  A = { ...cur, G, S, reg: GC.R.reg, approx: GC.R.approx, cmp: GC.cmp, cat: GC.cat, poly: cur.rays.map((r, k) => [SC.view[0] + Math.cos(k * DA) * r.end, SC.view[1] + Math.sin(k * DA) * r.end]), ms: performance.now() - t0 };
  A.hz = SC.haz.map((h, i) => ({ seen: cur.haz[i], dist: Math.hypot(h.x - SC.view[0], h.y - SC.view[1]) }));
}
// sc: a Workspace level (planScene, local metres); o: { view: [x, y] local, eye, tgt, haz: [{ name, x, y, h }] }
export function run(sc, o) {
  SC = { bounds: { ...sc.bounds }, walls: (sc.walls || []).map((w) => ({ ...w })), furn: (sc.furn || []).map((f) => ({ ...f })), hm: null, haz: (o.haz || []).map((h) => ({ ...h })), view: o.view.slice() };
  EYE = +o.eye || 1.0; TGT = +o.tgt || 0; GC = { key: '' }; analyse(); return { A, CMP };
}
export { CMP };
