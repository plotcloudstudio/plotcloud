// View analysis (2026-11-01): the analysis of the View analysis study (the former emb/views.html, retired 2026-11-01), unchanged, for
// the Workspace: LEED v4.1 Quality Views screening. From spots over the occupied floor, horizontal sight lines through vision
// glazing to the outdoors: line of sight out, the four quality criteria, view factor and distance to the window.
import { clamp } from '../../../emb/lib/plansim.js?v=1';
let SC = null, EYE = 1.07, TGT = 0, HEAD = 2.4, FAR = 7.5, NATURE = false, MOTION = true, EXCL = [];
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

// ================= the view from one spot =================
// Each horizontal ray from the eye runs through the plan. Walls of 2 m or more stop it, and so does anything as high as the
// eye; glass lets it through above its sill. Once it crosses a pane into the outdoors it is a view out: it records how far
// the pane is, how far the view runs past it, and whether the sky shows above whatever stands outside.
let GC = { key: '' };
function hmEvents(p, dx, dy, maxD, ev) {   // an imported model: cells as high as the eye block, glass cells are panes
  const M = SC.hm; if (!M) return; const { c, W, H } = M; let ix = Math.floor(p[0] / c), iy = Math.floor(p[1] / c); const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, adx = Math.abs(dx), ady = Math.abs(dy);
  const tdx = adx > 1e-12 ? c / adx : Infinity, tdy = ady > 1e-12 ? c / ady : Infinity; let tx = adx > 1e-12 ? (dx > 0 ? (ix + 1) * c - p[0] : p[0] - ix * c) / adx : Infinity, ty = ady > 1e-12 ? (dy > 0 ? (iy + 1) * c - p[1] : p[1] - iy * c) / ady : Infinity, inG = false;
  for (let n = 0; n < 1e6; n++) { let d; if (tx < ty) { d = tx; tx += tdx; ix += sx; } else { d = ty; ty += tdy; iy += sy; } if (d >= maxD || ix < 0 || iy < 0 || ix >= W || iy >= H) return;
    const i = iy * W + ix; if (M.g && M.g[i]) { if (!inG) ev.push([d, 2, 0.75]); inG = true; continue; } inG = false; const v = M.h[i]; if (v > 5 && hmH(v) >= EYE) { ev.push([d, 1, v === 255 ? 9 : hmH(v)]); return; } }
}
function spotRays(p, nr, S) {
  const G = GC.G, out = GC.R.out, B = SC.bounds, rays = new Array(nr), da = 2 * Math.PI / nr, ev = [];
  const isOut = (x, y) => { const cx = Math.floor(x / G.c), cy = Math.floor(y / G.c); if (cx < 0 || cy < 0 || cx >= G.W || cy >= G.H) return true; return !!out[cy * G.W + cx]; };
  for (let k = 0; k < nr; k++) {
    const th = k * da, dx = Math.cos(th), dy = Math.sin(th), end = boxExit(p[0], p[1], dx, dy, B); ev.length = 0;
    for (const s of S) { const d = rayHit(p[0], p[1], dx, dy, s); if (d < 0 || d > end) continue; if (s.glass) { if (s.h < EYE) ev.push([d, 2, s.h]); else ev.push([d, 1, 9]); } else if (s.h >= EYE) ev.push([d, 1, s.h]); }
    hmEvents(p, dx, dy, end, ev);
    ev.sort((a, b) => a[0] - b[0]); let r = null;
    for (let e = 0; e < ev.length; e++) {
      const [d, t, h] = ev[e]; if (t === 1) break;
      if (isOut(p[0] + dx * (d + 0.3), p[1] + dy * (d + 0.3))) {   // through this pane, the outdoors
        let dob = end, hob = 0; for (let f = e + 1; f < ev.length; f++) if (ev[f][1] === 1) { dob = ev[f][0]; hob = ev[f][2]; break; }
        const beyond = dob - d, sky = !hob || Math.atan2(HEAD - EYE, d) > Math.atan2(hob - EYE, dob) + 1e-6;
        r = { dg: d, beyond, sky, sill: h, hob }; break;
      }
    }
    rays[k] = r;
  }
  return rays;
}
// the requirements at a spot, from its rays
const VFT = [0.07, 0.2, 0.4, 0.75];   // share of the 90° cone a view fills for a view factor of 2, 3, 4, 5 (1: any glimpse)
function spotEval(rays) {
  const n = rays.length, q = Math.round(n / 4), pre = new Int32Array(2 * n + 1), fv = new Float32Array(n);
  let any = false, sky = false, far = false, near = false;
  for (let k = 0; k < n; k++) { const r = rays[k]; if (!r) continue; any = true; if (r.sky) sky = true; if (r.beyond >= FAR) far = true; if (r.dg <= 3 * HEAD) near = true;
    const up = Math.min(Math.PI / 4, Math.atan2(Math.max(0, HEAD - EYE), r.dg)), dn = Math.min(Math.PI / 4, Math.atan2(Math.max(0, EYE - r.sill), r.dg)); fv[k] = (up + dn) / (Math.PI / 2); }
  for (let k = 0; k < 2 * n; k++) pre[k + 1] = pre[k] + (rays[k % n] ? 1 : 0);
  let multi = false; if (any) for (let k = 0; k < n && !multi; k++) if (rays[k] && pre[k + 3 * q + 1] - pre[k + q] > 0) multi = true;   // another view between 90° and 270° away
  let best = 0, bdir = 0, acc = 0; for (let k = 0; k < q; k++) acc += fv[k]; for (let k = 0; k < n; k++) { if (acc > best) { best = acc; bdir = k; } acc += fv[(k + q) % n] - fv[k]; }
  const F = best / q, vf = !any ? 0 : F >= VFT[3] ? 5 : F >= VFT[2] ? 4 : F >= VFT[1] ? 3 : F >= VFT[0] ? 2 : 1;
  const kinds2 = (sky || NATURE ? 1 : 0) + (any && MOTION ? 1 : 0) + (far ? 1 : 0);
  const c1 = multi, c2 = any && kinds2 >= 2, c3 = near, c4 = vf >= 3, nk = c1 + c2 + c3 + c4;
  let dmin = Infinity; for (const r of rays) if (r && r.dg < dmin) dmin = r.dg;
  return { los: any, c1, c2, c3, c4, nk, quality: any && nk >= 2, vf, F, bdir: (bdir + q / 2) * 2 * Math.PI / n, sky, far, dmin };
}

// ================= analysis over the floor =================
let RES = null, STOP = false;
function analyse() {
  const S = obstacles(), gkey = JSON.stringify([SC.hm ? SC.hm.id : 0, SC.bounds, SC.walls.map((w) => [w.a, w.b, w.h, w.glass, w.furnline]), SC.furn.map((f) => [f.x, f.y, f.w, f.d, f.h])]);
  if (GC.key !== gkey) { const G = buildGrid(S); GC = { key: gkey, G, S, R: floorRegion(G) }; }
}
const setKey = () => JSON.stringify([GC.key, EYE, HEAD, FAR, NATURE, MOTION]);
const tick = () => new Promise((r) => setTimeout(r, 0));
async function compute(spacing, nr, onProg) {
  analyse(); const runInputKey = setKey();
  analyse(); const G = GC.G, reg = GC.R.reg, B = SC.bounds, PW = Math.ceil(B.w / spacing), PH = Math.ceil(B.h / spacing), pts = [];
  for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) { const x = (i + 0.5) * spacing, y = (j + 0.5) * spacing, cx = Math.floor(x / G.c), cy = Math.floor(y / G.c); if (cx >= G.W || cy >= G.H) continue; const ci = cy * G.W + cx; if (reg[ci]) pts.push({ i, j, x, y, ci }); }
  const S = GC.S, ev = new Array(pts.length); let t0 = performance.now();
  for (let k = 0; k < pts.length; k++) {
    ev[k] = spotEval(spotRays([pts[k].x, pts[k].y], nr, S));
    if (performance.now() - t0 > 60) { onProg((k + 1) / pts.length); await tick(); t0 = performance.now(); if (STOP) return null; }
  }
  return { key: runInputKey, spacing, nr, PW, PH, pts, ev, img: null };
}
// summary over the occupied floor (rooms left out are not counted)
function summary() {
  if (!RES) return null; const R = GC.R, nR = R.nRooms, rooms = Array.from({ length: nR }, (_, k) => ({ k, n: 0, los: 0, q: 0, c: [0, 0, 0, 0], x: 0, y: 0, out: false }));
  const ex = new Set(EXCL.map((p) => roomAt(p)).filter((k) => k >= 0)); rooms.forEach((r) => (r.out = ex.has(r.k)));
  const tot = { n: 0, los: 0, q: 0, c: [0, 0, 0, 0] };
  RES.pts.forEach((p, k) => { const e = RES.ev[k], rk = R.room[p.ci]; const r = rk >= 0 ? rooms[rk] : null; if (r) { r.n++; r.x += p.x; r.y += p.y; if (e.los) r.los++; if (e.quality) r.q++; ['c1', 'c2', 'c3', 'c4'].forEach((c, i) => { if (e[c]) r.c[i]++; }); if (r.out) return; }
    tot.n++; if (e.los) tot.los++; if (e.quality) tot.q++; ['c1', 'c2', 'c3', 'c4'].forEach((c, i) => { if (e[c]) tot.c[i]++; }); });
  rooms.forEach((r) => { if (r.n) { r.x /= r.n; r.y /= r.n; } r.area = r.n * RES.spacing * RES.spacing; });
  const f = (v) => (tot.n ? v / tot.n : 0), los = f(tot.los), q = f(tot.q);
  return { rooms: rooms.filter((r) => r.n), tot, los, q, crit: tot.c.map(f), area: tot.n * RES.spacing * RES.spacing, met: los >= 0.75 && q >= 0.75, exemplary: los >= 0.9 && q >= 0.9 };
}
function roomAt(p) { const G = GC.G, cx = Math.floor(p[0] / G.c), cy = Math.floor(p[1] / G.c); if (cx < 0 || cy < 0 || cx >= G.W || cy >= G.H) return -1; return GC.R.room[cy * G.W + cx]; }
export const LEVELS = {
  draft: { name: 'Draft', T: 15, cand: [[0.5, 360], [0.75, 240], [1, 180]] },
  standard: { name: 'Standard', T: 180, cand: [[0.15, 720], [0.2, 720], [0.25, 720], [0.35, 540], [0.5, 360]] },
  fine: { name: 'Fine', T: 480, cand: [[0.08, 1440], [0.1, 1440], [0.12, 1080], [0.15, 720], [0.25, 720], [0.5, 360]] },
};
const RATEK = 'pc-view-rate', rate = () => { try { return +localStorage.getItem(RATEK) || 4e-9; } catch (e) { return 4e-9; } };
function setScene(sc, o = {}) { const k = JSON.stringify([sc.bounds, sc.walls?.length, sc.furn?.length]); if (!SC || SC.__k !== k) { SC = { bounds: { ...sc.bounds }, walls: (sc.walls || []).map((w) => ({ ...w })), furn: (sc.furn || []).map((f) => ({ ...f })), hm: null, __k: k }; GC = { key: '' }; }
  if (o.eye) EYE = +o.eye; if (o.head) HEAD = +o.head; if (o.far) FAR = +o.far; if (o.nature != null) NATURE = !!o.nature; if (o.motion != null) MOTION = !!o.motion; }
export function plan(sc, o) { setScene(sc, o); analyse(); const A = GC.R.area || 1, nS = Math.max(8, GC.S.length), L = LEVELS[o.level] || LEVELS.draft, VR = rate(); let best = null;
  for (const [sp, nr] of L.cand) { const n = A / (sp * sp), est = VR * n * nr * nS + 0.2; best = { sp, nr, n, est, work: n * nr * nS }; if (est <= L.T) return best; } return best; }
export function stop() { STOP = true; }
// o: { level, eye, head, far, nature, motion }
export async function run(sc, o, onProg) { STOP = false; const p = plan(sc, o), t0 = performance.now(); RES = await compute(p.sp, p.nr, onProg || (() => {})); if (!RES) throw Error('Stopped.');
  const secs = (performance.now() - t0) / 1000; try { localStorage.setItem(RATEK, String(Math.max(1e-13, (secs - 0.2) / Math.max(1, p.work)))); } catch (e) { }
  return { RES, G: GC.G, R: GC.R, sm: summary(), plan: p }; }
export { CRITS_LIST as CRITS };
const CRITS_LIST = [{ k: 'los', name: 'Line of sight out' }, { k: 'c1', name: '1 · Directions 90° apart' }, { k: 'c2', name: '2 · Nature/sky, movement, far' }, { k: 'c3', name: '3 · Within 3× head height' }, { k: 'c4', name: '4 · View factor 3+' }, { k: 'q', name: 'Quality views (2 of 1–4)' }];
const QCOL = { q: [46, 160, 90], los: [246, 196, 68], none: [214, 212, 206] };
const VFC = [[214, 212, 206], [255, 231, 160], [250, 196, 90], [134, 196, 108], [56, 160, 96], [22, 112, 72]];
const DRAMP = [[0, [22, 112, 72]], [0.33, [134, 196, 108]], [0.66, [250, 196, 90]], [1, [214, 112, 60]]];
export const COLOURS = { QCOL, VFC, DRAMP };
