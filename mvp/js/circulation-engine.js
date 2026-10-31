// Circulation (2026-10-31): the method of the Circulation study (emb/evac.html), for the Workspace. Places on one level; between
// every pair, the shortest walkable route and an ant colony's walks (rounds of ants that settle on the good routes), each walk
// a slightly wobbling line, so the walks along one corridor read as a band; the metres walked through each spot make the
// density. The functions below are the study's own, unchanged (EV, wobble, densify, chaikin, guessUse); run() strings them
// together as the study's Run did, without its page.
export const EV = (() => {
  const rng = (seed) => { let s = (Math.trunc(seed) * 2654435761 + 1013904223) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
  const SQ2 = Math.SQRT2;
  const N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQ2], [1, -1, SQ2], [-1, 1, SQ2], [-1, -1, SQ2]];

  // ---------- grids ----------
  // fine raster of walls (fine m per pixel), then the navigation grid: a cell is blocked if any wall pixel touches it
  function makeGrid(w, h, cell = 0.4, fine = 0.1) {
    let c = cell, f = fine;
    while ((w / f) * (h / f) > 4.5e6) { c *= 2; f *= 2; }
    const FW = Math.ceil(w / f) + 2, FH = Math.ceil(h / f) + 2, k = Math.round(c / f);
    return { w, h, cell: c, fine: f, k, FW, FH, wall: new Uint8Array(FW * FH), edit: new Int8Array(FW * FH), W: Math.ceil(FW / k), H: Math.ceil(FH / k), blocked: null };
  }
  function rasterSegs(G, segs) {
    G.wall.fill(0);
    const f = G.fine;
    for (const s of segs) {
      const L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]), n = Math.max(1, Math.ceil(L / (f * 0.5)));
      for (let i = 0; i <= n; i++) {
        const x = s.a[0] + (s.b[0] - s.a[0]) * i / n, y = s.a[1] + (s.b[1] - s.a[1]) * i / n;
        const px = Math.floor(x / f), py = Math.floor(y / f);
        if (px >= 0 && py >= 0 && px < G.FW && py < G.FH) G.wall[py * G.FW + px] = 1;
      }
    }
  }
  function buildNav(G) {
    const { W, H, k, FW, FH } = G, B = new Uint8Array(W * H);
    for (let py = 0; py < FH; py++) for (let px = 0; px < FW; px++) {
      const i = py * FW + px, e = G.edit[i], wv = e > 0 ? 1 : e < 0 ? 0 : G.wall[i];
      if (wv) B[Math.floor(py / k) * W + Math.floor(px / k)] = 1;
    }
    // the outer ring is always blocked so nobody walks off the drawing
    for (let x = 0; x < W; x++) { B[x] = 1; B[(H - 1) * W + x] = 1; } for (let y = 0; y < H; y++) { B[y * W] = 1; B[y * W + W - 1] = 1; }
    G.blocked = B; return B;
  }
  const toCell = (G, p) => [Math.min(G.W - 1, Math.max(0, Math.floor(p[0] / G.cell))), Math.min(G.H - 1, Math.max(0, Math.floor(p[1] / G.cell)))];
  const toWorld = (G, c) => [(c[0] + 0.5) * G.cell, (c[1] + 0.5) * G.cell];
  // nearest free cell (a point clicked on a wall line still works)
  function freeCell(G, p) {
    const [cx, cy] = toCell(G, p); if (!G.blocked[cy * G.W + cx]) return [cx, cy];
    for (let r = 1; r < 6; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const x = cx + i, y = cy + j; if (x > 0 && y > 0 && x < G.W - 1 && y < G.H - 1 && !G.blocked[y * G.W + x]) return [x, y]; }
    return null;
  }
  // can you step diagonally without cutting a wall corner?
  const canStep = (G, x, y, dx, dy) => { const W = G.W, B = G.blocked, nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= G.H || B[ny * W + nx]) return false; if (dx && dy && (B[y * W + nx] || B[ny * W + x])) return false; return true; };

  // ---------- binary heap ----------
  class Heap { constructor() { this.k = []; this.v = []; } push(key, val) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; } pop() { const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(); if (k.length) { let i = 0; const n = k.length; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i, mk = lk; if (l < n && k[l] < mk) { m = l; mk = k[l]; } if (r < n && k[r] < mk) { m = r; } if (m === i) break; k[i] = k[m]; v[i] = v[m]; i = m; } k[i] = lk; v[i] = lv; } return top; } get size() { return this.k.length; } }

  // distance field from one or many source cells (Dijkstra, 8 neighbors, no corner cutting). Returns Float32 in cells.
  function field(G, sources) {
    const W = G.W, D = new Float32Array(W * G.H).fill(Infinity), h = new Heap();
    for (const [x, y] of sources) { const i = y * W + x; if (G.blocked[i]) continue; D[i] = 0; h.push(0, i); }
    while (h.size) {
      const i = h.pop(), x = i % W, y = (i / W) | 0, d = D[i];
      for (const [dx, dy, c] of N8) { if (!canStep(G, x, y, dx, dy)) continue; const j = (y + dy) * W + x + dx, nd = d + c; if (nd < D[j]) { D[j] = nd; h.push(nd, j); } }
    }
    return D;
  }
  // A* from a to b (cells); returns the list of cells or null
  function astar(G, a, b) {
    const W = G.W, n = W * G.H, g = new Float32Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), closed = new Uint8Array(n), h = new Heap();
    const H = (x, y) => { const dx = Math.abs(x - b[0]), dy = Math.abs(y - b[1]); return Math.max(dx, dy) + (SQ2 - 1) * Math.min(dx, dy); };
    const s = a[1] * W + a[0], t = b[1] * W + b[0]; g[s] = 0; h.push(H(a[0], a[1]), s);
    let expanded = 0;
    while (h.size) {
      const i = h.pop(); if (closed[i]) continue; closed[i] = 1; expanded++;
      if (i === t) break;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy, c] of N8) { if (!canStep(G, x, y, dx, dy)) continue; const j = (y + dy) * W + x + dx, nd = g[i] + c; if (nd < g[j]) { g[j] = nd; from[j] = i; h.push(nd + H(x + dx, y + dy), j); } }
    }
    if (!isFinite(g[t])) return null;
    const path = []; for (let i = t; i >= 0; i = from[i]) path.push([i % W, (i / W) | 0]); path.reverse();
    return { cells: path, gLen: g[t] * G.cell, expanded };
  }
  // straight-line visibility on the fine raster (walls and edits), used to pull paths taut
  function sees(G, a, b) {
    const f = G.fine, L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / (f * 0.5))), clr = 0.12;
    for (let i = 0; i <= n; i++) {
      const x = a[0] + (b[0] - a[0]) * i / n, y = a[1] + (b[1] - a[1]) * i / n;
      for (const [ox, oy] of [[0, 0], [clr, 0], [-clr, 0], [0, clr], [0, -clr]]) {
        const px = Math.floor((x + ox) / f), py = Math.floor((y + oy) / f); if (px < 0 || py < 0 || px >= G.FW || py >= G.FH) return false;
        const k = py * G.FW + px, e = G.edit[k]; if (e > 0 || (!e && G.wall[k])) return false;
      }
    }
    return true;
  }
  function smooth(G, pts) {
    if (pts.length < 3) return pts.slice();
    const out = [pts[0]]; let i = 0;
    while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !sees(G, pts[i], pts[j])) j--; out.push(pts[j]); i = j; }
    return out;
  }
  const polyLen = (p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; };
  // shortest walking route between two points in metres: A* on the grid, then pulled taut
  function route(G, A, B) {
    const a = freeCell(G, A), b = freeCell(G, B); if (!a || !b) return null;
    const r = astar(G, a, b); if (!r) return null;
    const pts = [A, ...r.cells.slice(1, -1).map((c) => toWorld(G, c)), B], sm = smooth(G, pts);
    return { pts: sm, len: polyLen(sm), gridLen: r.gLen, expanded: r.expanded, cells: r.cells };
  }

  // ---------- ant colony on the grid itself (to watch ants find a corridor route) ----------
  function* acoGrid(G, a, b, { ants = 24, iters = 40, alpha = 1, beta = 1.6, rho = 0.12, seed = 1 } = {}) {
    const W = G.W, n = W * G.H, R = rng(seed), tau = new Float32Array(n).fill(1);
    const hD = field(G, [b]);   // heuristic: real walking distance to the goal (what an ant smells)
    const t = b[1] * W + b[0], maxSteps = 6 * (W + G.H);
    let best = null;
    for (let it = 0; it < iters; it++) {
      const paths = [];
      for (let k = 0; k < ants; k++) {
        const seen = new Uint8Array(n); let i = a[1] * W + a[0], len = 0; const path = [i]; seen[i] = 1;
        for (let s = 0; s < maxSteps && i !== t; s++) {
          const x = i % W, y = (i / W) | 0; let sum = 0; const cand = [];
          // heuristic: how much closer to the food this step brings the ant (per meter walked)
          for (const [dx, dy, c] of N8) { if (!canStep(G, x, y, dx, dy)) continue; const j = (y + dy) * W + x + dx; if (seen[j]) continue; const w = Math.pow(tau[j], alpha) * Math.exp(beta * (hD[i] - hD[j]) / c); cand.push([j, w, c]); sum += w; }
          if (!cand.length || sum <= 0) { len = Infinity; break; }
          let r = R() * sum, pick = cand[cand.length - 1]; for (const q of cand) { r -= q[1]; if (r <= 0) { pick = q; break; } }
          i = pick[0]; seen[i] = 1; path.push(i); len += pick[2];
        }
        if (i !== t) len = Infinity;
        paths.push({ path, len });
        if (isFinite(len) && (!best || len < best.len)) best = { path, len, it };
      }
      for (let i = 0; i < n; i++) tau[i] = Math.max(0.05, tau[i] * (1 - rho));
      for (const p of paths) { if (!isFinite(p.len)) continue; const q = 40 / p.len; for (const i of p.path) tau[i] += q; }
      yield { it, best, tau, paths };
    }
    return best;
  }
  // ---------- clear width ----------
  // Local thickness on the fine raster: at each free pixel, the diameter of the largest disc that fits between
  // walls and furniture and still covers that pixel (Hildebrand & Ruegsegger 1997). Exact Euclidean distance
  // transform (Felzenszwalb & Huttenlocher 2012), then discs painted from the ridge of the distance map.
  function edt1(f, n, d, v, z) { let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity; for (let q = 1; q < n; q++) { let s; for (;;) { s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); if (s <= z[k]) { k--; if (k < 0) { k = 0; break; } } else break; } k++; v[k] = q; z[k] = s; z[k + 1] = Infinity; } k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; } }
  function clearWidth(G, segs) {   // segs: the solid lines (walls, furniture) in meters; raster at half the fine pixel (0.05 m)
    const sh = G.FW * G.FH <= 1.5e6 ? 1 : 0, f = G.fine / (1 << sh), FW = G.FW << sh, FH = G.FH << sh, N = FW * FH, INF = 1e12, D2 = new Float64Array(N), solid = new Uint8Array(N);   // big plans: no half-pixel raster
    for (const s of segs) { const L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]), n = Math.max(1, Math.ceil(L / (f * 0.5))); for (let i = 0; i <= n; i++) { const x = Math.floor((s.a[0] + (s.b[0] - s.a[0]) * i / n) / f + 1e-7), y = Math.floor((s.a[1] + (s.b[1] - s.a[1]) * i / n) / f + 1e-7); if (x >= 0 && y >= 0 && x < FW && y < FH) solid[y * FW + x] = 1; } }
    if (!segs.length) for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) solid[y * FW + x] = G.wall[(y >> sh) * G.FW + (x >> sh)];   // image plans: no lines, use the scan
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const e = G.edit[(y >> sh) * G.FW + (x >> sh)], i = y * FW + x; if (e > 0) solid[i] = 1; else if (e < 0) solid[i] = 0; D2[i] = solid[i] ? 0 : INF; }
    for (let x = 0; x < FW; x++) D2[x] = D2[(FH - 1) * FW + x] = 0; for (let y = 0; y < FH; y++) D2[y * FW] = D2[y * FW + FW - 1] = 0;
    const m = Math.max(FW, FH), fa = new Float64Array(m), d = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1);
    for (let x = 0; x < FW; x++) { for (let y = 0; y < FH; y++) fa[y] = D2[y * FW + x]; edt1(fa, FH, d, v, z); for (let y = 0; y < FH; y++) D2[y * FW + x] = d[y]; }
    for (let y = 0; y < FH; y++) { for (let x = 0; x < FW; x++) fa[x] = D2[y * FW + x]; edt1(fa, FW, d, v, z); for (let x = 0; x < FW; x++) D2[y * FW + x] = d[x]; }
    const R = new Float32Array(N); for (let i = 0; i < N; i++) R[i] = Math.sqrt(D2[i]);   // pixels to the nearest solid pixel center
    // Discs are painted from the ridge (local maxima of the distance map). Room corners the ridge discs do not reach are then
    // filled from their own maximal discs (corner bisectors), so a corner keeps the room's width; doors and corridors keep
    // their ridge value, because discs from the rooms beside them are not allowed to overwrite it. A gap of n free pixels has its ridge at R = (n + 1) / 2 (odd n, one ridge row) or n / 2 (even n, two equal rows);
    // the true wall line lies inside its pixel, so the clear width is n + 1 pixels: 2R, or 2R + 1 on an even ridge.
    const ridge = [], ridge2 = [], EVEN = new Uint8Array(N);
    for (let y = 1; y < FH - 1; y++) for (let x = 1; x < FW - 1; x++) { const i = y * FW + x, r = R[i]; if (r < 1) continue; let top = true, max = true, eq = 0; for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { if (!j && !k) continue; const q = R[i + j * FW + k]; if (q > r + 1e-6) top = false; if (q > r - 1e-6) eq++; if (q >= r + Math.hypot(j, k) - 0.25) max = false; } if (top) { ridge.push(i); if (eq >= 4) EVEN[i] = 1; } else if (max) ridge2.push(i); }
    ridge.sort((a, b) => R[a] - R[b]);
    const T = new Float32Array(N);
    const paint = (list, only) => { for (const i of list) { const r = R[i] - 0.5, rr = r * r, cx = i % FW, cy = (i / FW) | 0, ri = Math.ceil(r), val = 2 * R[i] + EVEN[i]; for (let j = -ri; j <= ri; j++) { const yy = cy + j; if (yy < 0 || yy >= FH) continue; for (let k = -ri; k <= ri; k++) { if (j * j + k * k > rr) continue; const xx = cx + k; if (xx < 0 || xx >= FW) continue; const q = yy * FW + xx; if (only && only[q]) continue; if (val > T[q]) T[q] = val; } } } };
    ridge2.sort((a, b) => R[a] - R[b]);
    paint(ridge, null);                                                  // the medial ridge: corridors, doors, room centers
    const done = new Uint8Array(N); for (let i = 0; i < N; i++) done[i] = T[i] > 0 ? 1 : 0;
    paint(ridge2, done);                                                 // corners the ridge discs miss: their own maximal discs
    for (let i = 0; i < N; i++) { if (R[i] < 1) { T[i] = 0; continue; } if (!T[i]) T[i] = 2 * R[i]; T[i] *= f; }
    // Passage width B: the local thickness overstates thin door openings (discs from the rooms bulge into them) and is low in
    // corners, so passages are found as saddles of the distance map: the distance falls off both ways across the passage
    // and does not fall along it (a corridor, a door, a gap between a sofa and a table). Each saddle's disc is painted
    // with its width, keeping the smallest; a corner is not a saddle because the distance falls toward the corner.
    const B = new Float32Array(N).fill(Infinity), DIRS = [[1, 0, 0, 1], [0, 1, 1, 0], [1, 1, 1, -1], [1, -1, 1, 1]], sad = [];
    for (let y = 2; y < FH - 2; y++) for (let x = 2; x < FW - 2; x++) {
      const i = y * FW + x, r = R[i]; if (r < 2) continue;
      for (const [dx, dy, px, py] of DIRS) { const a = R[i + dy * FW + dx], b = R[i - dy * FW - dx], c = R[i + py * FW + px], e = R[i - py * FW - px]; if (a <= r + 1e-6 && b <= r + 1e-6 && Math.min(a, b) < r - 1e-6 && c >= r - 1e-6 && e >= r - 1e-6) { sad.push([i, 2 * r + (Math.max(a, b) > r - 1e-6 && (dx === 0 || dy === 0) ? 1 : 0)]); break; } }
    }
    for (const [i, w0] of sad) { const r = R[i] - 0.5, rr = r * r, cx = i % FW, cy = (i / FW) | 0, ri = Math.ceil(r), val = w0 * f; for (let j = -ri; j <= ri; j++) { const yy = cy + j; if (yy < 0 || yy >= FH) continue; for (let k = -ri; k <= ri; k++) { if (j * j + k * k > rr) continue; const xx = cx + k; if (xx < 0 || xx >= FW) continue; const q = yy * FW + xx; if (val < B[q]) B[q] = val; } } }
    return { T, B, R, f, FW, FH };
  }
  return { rng, makeGrid, rasterSegs, buildNav, toCell, toWorld, freeCell, field, astar, sees, smooth, polyLen, route, acoGrid, clearWidth, canStep };
})();

let JR = EV.rng(91);
function wobble(pts, RG, ex = 0) {   // each walk keeps a small sideways offset, so walks along one corridor share it as a band, not one line; never into a wall.
  // ex (1 in the first round, 0 in the last) lets the exploring rounds sway more, so early lines read loose and later ones tight
  const off = (JR() - 0.5) * (0.22 + 0.3 * ex), amp = 0.03 + JR() * (0.05 + 0.16 * ex), wl = 1.2 + JR() * (2.5 - 0.8 * ex), ph = JR() * 6.283, out = []; let acc = 0;
  for (let k = 0; k < pts.length; k++) {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; if (k) acc += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    const f = Math.min(1, acc / 0.8), o = (off + amp * Math.sin(acc / wl * 6.283 + ph)) * f, q = [pts[k][0] - dy / l * o, pts[k][1] + dx / l * o];
    const c = EV.toCell(RG, q); out.push(!RG.blocked[c[1] * RG.W + c[0]] ? q : pts[k]);
  }
  return out;
}
export function densify(pts, step) { const o = [pts[0]]; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 1; k <= n; k++) o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } return o; }
export function chaikin(p, n = 2) { for (let k = 0; k < n; k++) { if (p.length < 3) break; const o = [p[0]]; for (let i = 0; i < p.length - 1; i++) { const a = p[i], b = p[i + 1]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } o.push(p[p.length - 1]); p = o; } return p; }
export function guessUse(name) {
  const n = (name || '').toLowerCase();
  if (/bed|sleep|guest|卧|睡/.test(n)) return 1.5;
  if (/living|sofa|lounge|family|客厅|起居/.test(n)) return 20;
  if (/kitchen|dining|pantry|厨|餐|break|cafe|lobby/.test(n)) return 12;
  if (/bath|wc|toilet|shower|卫|厕|washroom|entry|entrance|front|door|stair|lift|elev|入口|门|楼梯|电梯|copier|print/.test(n)) return 6.5;
  if (/desk|study|office|work|书房|laundry|storage|closet|store|balcony|阳台/.test(n)) return 3.5;
  return 6.5;
}

const ANT_V = 1.3;   // m/s in the replay, as in the study
// plan: { segs: [{ a, b }] (walls with their door gaps, furniture edges; plan metres), box: { x0, y0, x1, y1 } }
// places: [{ name, p: [x, y], use }]; o: { iters, ants, seed, weighted, cap, onProg, stop }
export async function run(plan, places, o = {}) {
  const iters = Math.max(5, Math.min(60, o.iters || 12)), ants = Math.max(2, Math.min(40, o.ants || 5)), seed = Math.max(1, Math.round(o.seed || 7)), cap = o.cap || 1200, M = 1.0;
  const X0 = plan.box.x0 - M, Y0 = plan.box.y0 - M, G = EV.makeGrid(plan.box.x1 - plan.box.x0 + 2 * M, plan.box.y1 - plan.box.y0 + 2 * M);
  const L = (p) => [p[0] - X0, p[1] - Y0], Wd = (p) => [p[0] + X0, p[1] + Y0];
  EV.rasterSegs(G, plan.segs.map((s) => ({ a: L(s.a), b: L(s.b) }))); EV.buildNav(G); JR = EV.rng(91 + seed * 13);
  const use = (i) => (o.weighted === false ? 1 : places[i].use ?? guessUse(places[i].name)), on = places.map((P, i) => i).filter((i) => use(i) > 0);
  if (on.length < 2) throw Error('Circulation needs at least two places on this level: rooms with walls round them.');
  const pairs = []; for (let a = 0; a < on.length; a++) for (let b = a + 1; b < on.length; b++) pairs.push({ i: on[a], j: on[b], w: use(on[a]) * use(on[b]) });
  const wmax = Math.max(1e-9, ...pairs.map((P) => P.w)), tot = pairs.reduce((s, P) => s + ants * P.w / wmax * iters, 0), sc = Math.min(1, cap / Math.max(1, tot));
  for (const P of pairs) P.rate = Math.min(ants, ants * P.w / wmax * sc); const wsum = pairs.reduce((s, P) => s + P.w, 0) || 1; for (const P of pairs) P.share = P.w / wsum;
  const toW = (c) => EV.toWorld(G, [c % G.W, (c / G.W) | 0]), raw = [];
  for (let k = 0; k < pairs.length; k++) {
    if (o.stop?.()) throw Error('Stopped.');
    const P = pairs[k], pa = L(places[P.i].p), pb = L(places[P.j].p), a = EV.freeCell(G, pa), b = EV.freeCell(G, pb);
    P.r = a && b ? EV.route(G, pa, pb) : null; if (!P.r) continue;
    const gen = EV.acoGrid(G, a, b, { iters, ants, seed: seed * 101 + k * 7 }); let last = null, carry = 0.5; P.walks = 0;
    for (let s = gen.next(); !s.done; s = gen.next()) {
      last = s.value; let n = 0; carry += P.rate; let cp = Math.floor(carry); carry -= cp; if (last.it === iters && !P.walks && !cp) cp = 1;   // every pair walked at least once
      for (const q of last.paths) { if (!isFinite(q.len) || q.path.length < 2 || n >= cp) continue; n++; P.walks++;
        let pts = chaikin(q.path.filter((_, i, A) => i % 2 === 0 || i === A.length - 1).map(toW), 3); if ((n + last.it) % 2) pts = pts.slice().reverse();
        raw.push({ pts: densify(wobble(pts, G, 1 - (last.it - 1) / Math.max(1, iters - 1)), 0.15).map(Wd), it: last.it, k }); } }
    if (last && last.best) P.antLen = last.best.len * G.cell;
    o.onProg?.((k + 1) / pairs.length); if (k % 2 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  // the replay: round r leaves at r × wave, the ants of a round a little apart (seeded, so a run repeats exactly)
  const lenOf = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };
  const lens = raw.map((w) => lenOf(w.pts)).sort((a, b) => a - b), med = lens[Math.floor(lens.length / 2)] || 10, wave = Math.max(1.2, med / ANT_V * 0.45), SR = EV.rng(seed * 31 + 5);
  const walks = raw.map((w) => ({ ...w, len: lenOf(w.pts), t0: (w.it - 1) * wave + SR() * wave * 0.9, r: (w.it - 1) / Math.max(1, iters - 1) })).filter((w) => w.len >= 0.2);
  const T = walks.reduce((m, w) => Math.max(m, w.t0 + w.len / ANT_V), 0) + 0.6, alpha = Math.max(0.07, Math.min(0.3, 0.085 * Math.sqrt(1200 / Math.max(1, walks.length))));
  for (const w of walks) w.al = alpha * (0.75 + 0.5 * w.r);   // fewer walks, stronger lines (the study's rule)
  // density: metres walked through each cell (bilinear deposits every 5 cm along each walk)
  const c = Math.max(0.15, Math.sqrt((plan.box.x1 - plan.box.x0 + 2) * (plan.box.y1 - plan.box.y0 + 2) / 40000)), DW = Math.ceil((plan.box.x1 - plan.box.x0 + 2 * M) / c), DH = Math.ceil((plan.box.y1 - plan.box.y0 + 2 * M) / c), v = new Float32Array(DW * DH);
  const dep = (p, wt) => { const fx = (p[0] - X0) / c - 0.5, fy = (p[1] - Y0) / c - 0.5, x = Math.floor(fx), y = Math.floor(fy), tx = fx - x, ty = fy - y, add = (i, j, kk) => { if (i >= 0 && j >= 0 && i < DW && j < DH) v[j * DW + i] += kk; }; add(x, y, wt * (1 - tx) * (1 - ty)); add(x + 1, y, wt * tx * (1 - ty)); add(x, y + 1, wt * (1 - tx) * ty); add(x + 1, y + 1, wt * tx * ty); };
  for (const w of walks) for (let i = 1; i < w.pts.length; i++) { const a = w.pts[i - 1], b = w.pts[i], L2 = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let d = 0.05; d <= L2 + 1e-9; d += 0.05) dep([a[0] + (b[0] - a[0]) * d / L2, a[1] + (b[1] - a[1]) * d / L2], 0.05); }
  const pos = []; let bi = 0; for (let q = 0; q < v.length; q++) { if (v[q] > 0.05) pos.push(v[q]); if (v[q] > v[bi]) bi = q; } pos.sort((a, b) => a - b);
  const ref = pos.length ? pos[Math.floor(pos.length * 0.995)] : 1, vals = new Float32Array(v.length); for (let q = 0; q < v.length; q++) vals[q] = v[q] > 0.05 ? v[q] : NaN;
  const ok = pairs.filter((P) => P.r);
  return { pairs, ok, walks, T, wave, iters, ants, seed, walked: walks.reduce((s, w) => s + w.len, 0), avg: ok.length ? ok.reduce((s, P) => s + P.r.len, 0) / ok.length : 0,
    density: { X0, Y0, cell: c, nx: DW, ny: DH, vals, ref }, busy: [X0 + (bi % DW + 0.5) * c, Y0 + (Math.floor(bi / DW) + 0.5) * c], busyV: v[bi] };
}
// the study's colours: pink for the exploring first rounds, deep purple for the last, settled ones
export const RAMPV = [[0, [244, 160, 201]], [0.3, [226, 104, 178]], [0.6, [177, 64, 182]], [0.85, [118, 40, 170]], [1, [70, 20, 140]]];
export function rampV(t) { let j = 1; while (j < RAMPV.length - 1 && RAMPV[j][0] < t) j++; const [a, ca] = RAMPV[j - 1], [b, cb] = RAMPV[j], f = Math.max(0, Math.min(1, (t - a) / (b - a))); return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * f)).join(',')})`; }
export const ANT_SPEED = ANT_V;
