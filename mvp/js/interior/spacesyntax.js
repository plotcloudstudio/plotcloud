// Space syntax (2026-11-01): the visibility graph analysis of the Space syntax study (the former emb/spacesyntax.html, retired 2026-11-01), unchanged, for the
// Workspace (Turner's VGA as in DepthmapX): nodes on a grid over the floor, joined where they see each other at the analysis
// height; integration [HH], integration R3 and connectivity, steps from a spot, and agents walking towards what they see
// (gate counts), combined with integration as "Movement + depth". The scene is a level of the Workspace model (planScene).
import { clamp } from '../../../emb/lib/plansim.js?v=1';
let SC = null, GC = { key: '' }, TGT = 0, VH = 1.6, GLASS = true, STOP = false;
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

// ================= visibility graph (Turner's VGA, as in DepthmapX) =================
// Nodes: a grid over the floor inside the walls. Two nodes are joined when each can see the other: a straight line between
// them crosses nothing that stands at the analysis height (eye 1.6 m: furniture below it is seen over; knee 0.5 m: furniture
// blocks, as for walking). From every node a breadth-first search over the graph gives the depth (visual steps) to every
// other node; mean depth gives integration (Hillier & Hanson: RRA with the diamond D-value, shown as 1/RRA).
// GC is declared at the top of this module
function blockers() { return GC.S.filter((s) => (s.glass ? !(GLASS && VH >= 1.2 && VH > s.h) : s.h >= VH)); }
function nodeRays(p, nr, S) {   // free distance along nr bearings
  const ends = new Float32Array(nr), B = SC.bounds, M = SC.hm;
  for (let k = 0; k < nr; k++) { const th = k * 2 * Math.PI / nr, dx = Math.cos(th), dy = Math.sin(th); let end = boxExit(p[0], p[1], dx, dy, B);
    for (const s of S) { const d = rayHit(p[0], p[1], dx, dy, s); if (d > 0 && d < end) end = d; }
    if (M) { const { c, W, H } = M; let ix = Math.floor(p[0] / c), iy = Math.floor(p[1] / c); const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, adx = Math.abs(dx), ady = Math.abs(dy), tdx = adx > 1e-12 ? c / adx : Infinity, tdy = ady > 1e-12 ? c / ady : Infinity;
      let tx = adx > 1e-12 ? (dx > 0 ? (ix + 1) * c - p[0] : p[0] - ix * c) / adx : Infinity, ty = ady > 1e-12 ? (dy > 0 ? (iy + 1) * c - p[1] : p[1] - iy * c) / ady : Infinity;
      for (let n = 0; n < 1e6; n++) { let d; if (tx < ty) { d = tx; tx += tdx; ix += sx; } else { d = ty; ty += tdy; iy += sy; } if (d >= end || ix < 0 || iy < 0 || ix >= W || iy >= H) break; const i = iy * W + ix, v = M.h[i]; if ((M.g && M.g[i] && !GLASS) || (v > 5 && (v === 255 ? 9 : hmH(v)) >= VH)) { end = d; break; } } }
    ends[k] = end; }
  return ends;
}
const popc = (v) => { v -= (v >>> 1) & 0x55555555; v = (v & 0x33333333) + ((v >>> 2) & 0x33333333); return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; };
const dval = (k) => (k > 2 ? 2 * (k * (Math.log2((k + 2) / 3) - 1) + 1) / ((k - 1) * (k - 2)) : 1);
async function computeVGA(spacing, nr, onProg) {
  analyse(); const G = GC.G, reg = GC.R.reg, B = SC.bounds, PW = Math.ceil(B.w / spacing), PH = Math.ceil(B.h / spacing), pts = [], at = new Int32Array(PW * PH).fill(-1);
  for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) { const x = (i + 0.5) * spacing, y = (j + 0.5) * spacing, cx = Math.floor(x / G.c), cy = Math.floor(y / G.c); if (cx >= G.W || cy >= G.H) continue; const ci = cy * G.W + cx; if (reg[ci] && !GC.G.solid[ci]) { at[j * PW + i] = pts.length; pts.push({ i, j, x, y, ci }); } }
  const N = pts.length, W = (N + 31) >>> 5, adj = new Uint32Array(N * W), S = blockers(); let t0 = performance.now();
  // 1. what each node sees (polar), 2. join pairs both ways
  const ends = new Array(N), da = 2 * Math.PI / nr;
  for (let a = 0; a < N; a++) { ends[a] = nodeRays([pts[a].x, pts[a].y], nr, S); if (performance.now() - t0 > 60) { onProg(0.3 * a / N); await tick(); t0 = performance.now(); if (STOP) return null; } }
  const sees = (a, b) => { const dx = pts[b].x - pts[a].x, dy = pts[b].y - pts[a].y, r = Math.hypot(dx, dy); let th = Math.atan2(dy, dx); if (th < 0) th += 2 * Math.PI; return r <= ends[a][Math.round(th / da) % nr] + 1e-6; };
  for (let a = 0; a < N; a++) { adj[a * W + (a >>> 5)] |= 1 << (a & 31);
    for (let b = a + 1; b < N; b++) if (sees(a, b) && sees(b, a)) { adj[a * W + (b >>> 5)] |= 1 << (b & 31); adj[b * W + (a >>> 5)] |= 1 << (a & 31); }
    if (performance.now() - t0 > 60) { onProg(0.3 + 0.2 * a / N); await tick(); t0 = performance.now(); if (STOP) return null; } }
  // 3. a breadth-first search from every node over bitsets
  const conn = new Float32Array(N), md = new Float32Array(N), integ = new Float32Array(N), r3 = new Float32Array(N), reach = new Int32Array(N), vis = new Uint32Array(W), cur = new Uint32Array(W), nxt = new Uint32Array(W);
  for (let a = 0; a < N; a++) { let c = 0; for (let q = 0; q < W; q++) c += popc(adj[a * W + q]); conn[a] = c - 1; }
  for (let s = 0; s < N; s++) {
    vis.fill(0); cur.fill(0); vis[s >>> 5] |= 1 << (s & 31); cur[s >>> 5] = vis[s >>> 5];
    let depth = 0, tot = 0, cnt = 1, t3 = 0, c3 = 1;
    for (;;) { nxt.fill(0);
      for (let w = 0; w < W; w++) { let bits = cur[w]; while (bits) { const t = bits & -bits, node = (w << 5) + (31 - Math.clz32(t)), row = node * W; for (let q = 0; q < W; q++) nxt[q] |= adj[row + q]; bits ^= t; } }
      depth++; let nc = 0; for (let q = 0; q < W; q++) { const n = nxt[q] & ~vis[q]; nxt[q] = n; vis[q] |= n; if (n) nc += popc(n); }
      if (!nc) break; tot += depth * nc; cnt += nc; if (depth <= 3) { t3 += depth * nc; c3 += nc; } cur.set(nxt); }
    reach[s] = cnt; md[s] = cnt > 1 ? tot / (cnt - 1) : 0;
    const ra = (m, k) => (k > 2 ? 2 * (m - 1) / (k - 2) : 0), rr = ra(md[s], cnt) / dval(cnt); integ[s] = rr > 0 ? 1 / rr : 0;
    const m3 = c3 > 1 ? t3 / (c3 - 1) : 0, rr3 = ra(m3, c3) / dval(c3); r3[s] = rr3 > 0 ? 1 / rr3 : 0;
    if (performance.now() - t0 > 60) { onProg(0.5 + 0.5 * s / N); await tick(); t0 = performance.now(); if (STOP) return null; } }
  // intelligibility: correlation of connectivity with global integration (R²)
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0; for (let a = 0; a < N; a++) { const x = conn[a], y = integ[a]; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
  const cov = sxy / N - sx * sy / N / N, vx = sxx / N - (sx / N) ** 2, vy = syy / N - (sy / N) ** 2, r2 = vx > 0 && vy > 0 ? cov * cov / (vx * vy) : 0;
  return { key: setKey(), spacing, nr, PW, PH, pts, at, N, W, adj, ends, conn, md, integ, r3, reach, r2, gate: null };
}
function depthFrom(R, s) {   // visual steps from node s to every node
  const N = R.N, W = R.W, adj = R.adj, d = new Int16Array(N).fill(-1); d[s] = 0; let cur = [s], depth = 0;
  const vis = new Uint32Array(W); vis[s >>> 5] |= 1 << (s & 31);
  while (cur.length) { depth++; const nx = []; for (const a of cur) { const row = a * W; for (let q = 0; q < W; q++) { let n = adj[row + q] & ~vis[q]; if (!n) continue; vis[q] |= n; while (n) { const t = n & -n, b = (q << 5) + (31 - Math.clz32(t)); d[b] = depth; nx.push(b); n ^= t; } } } cur = nx; }
  return d;
}
// ================= agents (DepthmapX-style): walk toward a spot chosen at random in their field of view =================
function runAgents(R, n, steps, onFrame) {
  const N = R.N, gate = new Float32Array(N), rnd = (() => { let s = 7; return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); })(), FOV = 170 * Math.PI / 180, sp = R.spacing;
  const ag = []; for (let k = 0; k < n; k++) { const a = Math.floor(rnd() * N); ag.push({ x: R.pts[a].x, y: R.pts[a].y, h: rnd() * 2 * Math.PI, tx: 0, ty: 0, left: 0, node: a, trail: [] }); }
  const nodeAt = (x, y) => { const i = Math.floor(x / sp), j = Math.floor(y / sp); if (i < 0 || j < 0 || i >= R.PW || j >= R.PH) return -1; return R.at[j * R.PW + i]; };
  const pick = (A) => { const row = A.node * R.W; for (let t = 0; t < 40; t++) { const b = Math.floor(rnd() * N); if (!(R.adj[row + (b >>> 5)] & (1 << (b & 31)))) continue; const dx = R.pts[b].x - A.x, dy = R.pts[b].y - A.y; if (Math.hypot(dx, dy) < sp * 2) continue; let d = Math.atan2(dy, dx) - A.h; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) > FOV / 2 && t < 30) continue; A.tx = R.pts[b].x; A.ty = R.pts[b].y; A.left = 3; return; } A.h += Math.PI; A.left = 0; };
  let step = 0;
  const one = () => { for (const A of ag) { if (A.left <= 0) pick(A); const dx = A.tx - A.x, dy = A.ty - A.y, L = Math.hypot(dx, dy); if (L < sp * 0.5) { A.left = 0; continue; } const ux = dx / L, uy = dy / L, nx = A.x + ux * sp, ny = A.y + uy * sp, nn = nodeAt(nx, ny); if (nn < 0) { A.left = 0; A.h += Math.PI; continue; }
      A.x = nx; A.y = ny; A.h = Math.atan2(uy, ux); A.left--; if (nn !== A.node) { A.node = nn; gate[nn]++; } } step++; };
  return { ag, gate, step: () => one(), get n() { return step; } };
}

function analyse() {
  const S = obstacles(), gkey = JSON.stringify([SC.hm ? SC.hm.id : 0, SC.bounds, SC.walls.map((w) => [w.a, w.b, w.h, w.glass, w.furnline]), SC.furn.map((f) => [f.x, f.y, f.w, f.d, f.h])]);
  if (GC.key !== gkey) { const G = buildGrid(S); GC = { key: gkey, G, S, R: floorRegion(G) }; }
}
const setKey = () => JSON.stringify([GC.key, VH, GLASS]);
const tick = () => new Promise((r) => setTimeout(r, 0));
// the page's detail levels: candidate node spacings and ray counts, the first that fits the time budget (s) on this computer
export const LEVELS = {
  draft: { name: 'Draft', T: 15, cand: [[0.6, 360], [0.75, 360], [0.9, 360], [1.2, 240], [1.5, 240]] },
  standard: { name: 'Standard', T: 180, cand: [[0.3, 720], [0.35, 720], [0.4, 720], [0.5, 540], [0.6, 360], [0.75, 360]] },
  fine: { name: 'Fine', T: 480, cand: [[0.2, 720], [0.25, 720], [0.3, 720], [0.35, 720], [0.4, 540], [0.5, 360]] },
};
const RATEK = 'pc-ss-rate', rate = () => { try { return +localStorage.getItem(RATEK) || 2e-9; } catch (e) { return 2e-9; } };
function setScene(sc, o = {}) { const k = JSON.stringify([sc.bounds, sc.walls?.length, sc.furn?.length]); if (!SC || SC.__k !== k) { SC = { bounds: { ...sc.bounds }, walls: (sc.walls || []).map((w) => ({ ...w })), furn: (sc.furn || []).map((f) => ({ ...f })), hm: null, __k: k }; GC = { key: '' }; }
  if (o.vh) VH = +o.vh; if (o.glass != null) GLASS = !!o.glass; }
export function plan(sc, o) { setScene(sc, o); analyse(); const A = GC.R.area || 1, nS = Math.max(8, GC.S.length), L = LEVELS[o.level] || LEVELS.standard, VR = rate(); let best = null;
  for (const [sp, nr] of L.cand) { const n = A / (sp * sp); if (n > 16000) continue; const work = n * n * n / 32 + n * nr * nS * 3 + n * n * 4, est = VR * work + 0.3; best = { sp, nr, n, est, work }; if (est <= L.T) return best; }
  return best || { sp: 1.5, nr: 240, n: A / 2.25, est: 1, work: 1 }; }
export function stop() { STOP = true; }
// o: { level: draft|standard|fine, vh: 1.6|0.5, glass, agents: n (0: none), steps }
export async function run(sc, o, onProg) {
  STOP = false; const p = plan(sc, o), t0 = performance.now(), R = await computeVGA(p.sp, p.nr, onProg || (() => {})); if (!R) throw Error('Stopped.');
  const secs = (performance.now() - t0) / 1000; try { localStorage.setItem(RATEK, String(Math.max(1e-13, (secs - 0.3) / (R.N ** 3 / 32 + R.N * p.nr * Math.max(8, GC.S.length) * 3 + R.N * R.N * 4)))); } catch (e) { }
  if (o.agents) { const A = runAgents(R, o.agents); for (let s = 0; s < (o.steps || 1500); s++) A.step(); R.gate = A.gate; R.agentN = o.agents; R.agentSteps = o.steps || 1500;
    const fr = robust(R.gate), ir = robust(R.integ); R.flowdepth = Float32Array.from(R.integ, (v, k) => 0.65 * Math.sqrt(clamp((R.gate[k] - fr[0]) / (fr[1] - fr[0]), 0, 1)) + 0.35 * clamp((v - ir[0]) / (ir[1] - ir[0]), 0, 1)); }
  return { R, G: GC.G, reg: GC.R.reg, area: GC.R.area, approx: GC.R.approx, plan: p };
}
export { depthFrom };
export function robust(v) { const s = Array.from(v || []).filter((x) => x >= 0).sort((a, b) => a - b); if (!s.length) return [0, 1]; const lo = s[Math.floor(s.length * 0.01)], hi = s[Math.floor(s.length * 0.99)]; return [lo, hi > lo ? hi : lo + 1]; }
// the page's colours: Space syntax (blue to red) and Movement depth (DepthmapX's blue, white, pink)
export const SPEC = [[0, [40, 40, 150]], [0.2, [30, 110, 220]], [0.4, [40, 200, 170]], [0.6, [235, 225, 50]], [0.8, [245, 135, 30]], [1, [215, 25, 45]]];
export const DEPTHMAP_SPEC = [[0, [79, 129, 183]], [0.28, [141, 185, 226]], [0.5, [250, 248, 247]], [0.72, [255, 179, 190]], [1, [255, 82, 101]]];
