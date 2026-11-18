// A drivable way around obstacles for the Vehicle swept path (2026-11-18). The route a person draws is driven as drawn when it is
// clear; where it runs into an obstacle, this finds a path the vehicle can actually drive around it, through the same points.
// Method (hybrid A*, as used for vehicle and parking planners): the search moves the vehicle forward in short arcs, straight or
// turning no tighter than its least radius (with a margin), so every path it returns can be driven; each pose is checked
// against the obstacles with the body (and the trailer of an articulated vehicle) covered by circles, using a distance map of
// the obstacles; the estimate that guides it is the shortest way round the obstacles on a grid, so it heads round them, not into
// them. Plan metres, x east, y north. Pure functions: the Node tests run the same code.
// Limits, said where they apply: forward driving only (a route drawn with reversing is not re-planned); obstacles as given (a
// missing obstacle is not avoided); the found path is a feasible one, not the only or a regulation one.
import { rMin } from './vehicles.js';

const TAU = Math.PI * 2;
const wrapA = (t) => ((t % TAU) + TAU) % TAU;

// ---- the obstacles as a grid: occupied cells, then the distance (m) from each cell to the nearest occupied one ----
function grid(obstacles, box, res) {
  const nx = Math.max(2, Math.ceil((box.x1 - box.x0) / res)), ny = Math.max(2, Math.ceil((box.y1 - box.y0) / res)), occ = new Uint8Array(nx * ny);
  for (const o of obstacles) { const P = o.poly; if (!P || P.length < 3) continue; let y0 = Infinity, y1 = -Infinity; for (const p of P) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const j0 = Math.max(0, Math.floor((y0 - box.y0) / res)), j1 = Math.min(ny - 1, Math.ceil((y1 - box.y0) / res));
    for (let j = j0; j <= j1; j++) { const y = box.y0 + (j + 0.5) * res, xs = [];
      for (let i = 0, n = P.length, k = n - 1; i < n; k = i++) { const a = P[i], b = P[k]; if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
      xs.sort((a, b) => a - b); for (let q = 0; q + 1 < xs.length; q += 2) { const i0 = Math.max(0, Math.ceil((xs[q] - box.x0) / res - 0.5)), i1 = Math.min(nx - 1, Math.floor((xs[q + 1] - box.x0) / res - 0.5)); for (let i = i0; i <= i1; i++) occ[j * nx + i] = 1; }
      // thin obstacles (a curb, a post) narrower than a cell: their edges still mark the cells they pass through
      for (let i = 0, n = P.length, k = n - 1; i < n; k = i++) { const a = P[i], b = P[k], m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (res / 2)));
        for (let t = 0; t <= m; t++) { const x = a[0] + (b[0] - a[0]) * t / m, yy = a[1] + (b[1] - a[1]) * t / m, ci = Math.floor((x - box.x0) / res), cj = Math.floor((yy - box.y0) / res); if (cj === j && ci >= 0 && ci < nx) occ[cj * nx + ci] = 1; } } } }
  // exact Euclidean distance transform (Felzenszwalb–Huttenlocher), in cells, then metres less half a cell (to the cell's edge)
  const INF = 1e20, f = new Float64Array(Math.max(nx, ny)), d = new Float64Array(Math.max(nx, ny)), v = new Int32Array(Math.max(nx, ny)), z = new Float64Array(Math.max(nx, ny) + 1), D = new Float64Array(nx * ny);
  const edt1 = (n) => { let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF; for (let q = 1; q < n; q++) { let s; do { const r = v[k]; s = ((f[q] + q * q) - (f[r] + r * r)) / (2 * q - 2 * r); if (s <= z[k]) k--; else break; } while (k >= 0); k++; v[k] = q; z[k] = s; z[k + 1] = INF; }
    k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const r = v[k]; d[q] = (q - r) * (q - r) + f[r]; } };
  for (let i = 0; i < nx; i++) { for (let j = 0; j < ny; j++) f[j] = occ[j * nx + i] ? 0 : INF; edt1(ny); for (let j = 0; j < ny; j++) D[j * nx + i] = d[j]; }
  for (let j = 0; j < ny; j++) { for (let i = 0; i < nx; i++) f[i] = D[j * nx + i]; edt1(nx); for (let i = 0; i < nx; i++) D[j * nx + i] = d[i] >= INF / 2 ? 1e9 : Math.max(0, Math.sqrt(d[i]) * res - res / 2); }
  const at = (x, y) => { const i = Math.floor((x - box.x0) / res), j = Math.floor((y - box.y0) / res); return i < 0 || j < 0 || i >= nx || j >= ny ? -1 : D[j * nx + i]; };   // off the grid: blocked
  return { nx, ny, res, box, occ, D, at };
}

// the body as circles along its axis: [offset from the reference point along the heading, radius]
function circles(lenBack, lenFront, W) { const L = lenBack + lenFront, n = Math.max(2, Math.ceil(L / (W * 0.8))), seg = L / n, r = Math.hypot(seg / 2, W / 2), out = [];
  for (let i = 0; i < n; i++) out.push([-lenBack + seg * (i + 0.5), r]); return out; }

// a tiny binary heap of [f, node]
class Heap { constructor() { this.a = []; } push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; } }

/**
 * @param v a vehicle (vehicles.js)
 * @param route { pts: [[x, y], …], reverse? }
 * @param obstacles [{ id, poly }]
 * @param o { clearance (m), maxExpand }
 * @returns { ok, path: [{ p: [x, y], k }] every ~0.1 m, length, clearanceUsed, legs, error? }
 */
export function planAround(v, route, obstacles, o = {}) {
  const P = (route.pts || []).map((p) => [+p[0], +p[1]]); if (P.length < 2) return { ok: false, error: 'Draw at least two points' };
  if ((route.reverse || []).some(Boolean)) return { ok: false, error: 'a route with reversing is driven as drawn' };
  const W = v.width, Lw = v.wheelbase, art = v.kind === 'artic' && v.trailer, T = art ? v.trailer : null;
  const R = rMin(v) * 1.1, kmax = 1 / R;   // a 10 % margin on the least radius, so the driven vehicle can follow what is planned
  // the area searched: the route and the obstacles near it, with room to go round
  const pad = Math.max(25, 2 * v.length + (T ? T.wheelbase + T.rearOverhang : 0));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of P) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const box = { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad }, span = Math.max(box.x1 - box.x0, box.y1 - box.y0), res = Math.max(0.15, Math.min(0.5, span / 900));
  const near = obstacles.filter((ob) => { if (!ob.poly || ob.poly.length < 3) return false; let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const p of ob.poly) { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); } return a < box.x1 + 5 && c > box.x0 - 5 && b < box.y1 + 5 && d > box.y0 - 5; });   // its extent meets the area (a long wall with its ends far away counts)
  const G = grid(near, box, res), body = circles(v.rearOverhang, Lw + v.frontOverhang, W), tbody = art ? circles(T.wheelbase + T.rearOverhang, T.frontOverhang, T.width || W) : null;
  const tryWith = (clear) => {
    const free = (x, y, th, phi) => { const c = Math.cos(th), s = Math.sin(th); for (const [off, r] of body) { if (G.at(x + c * off, y + s * off) < r + clear) return false; }
      if (art) { const hx = x + c * (T.hitch || 0), hy = y + s * (T.hitch || 0), cp = Math.cos(phi), sp = Math.sin(phi); for (const [off, r] of tbody) if (G.at(hx + cp * off, hy + sp * off) < r + clear) return false; }
      return true; };
    // the shortest way round on a grid from the goal (8 neighbours, cells the body's half width can pass), for the estimate
    const cs = Math.max(0.5, res * 2), gx = Math.ceil((box.x1 - box.x0) / cs), gy = Math.ceil((box.y1 - box.y0) / cs), passable = new Uint8Array(gx * gy);
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) passable[j * gx + i] = G.at(box.x0 + (i + 0.5) * cs, box.y0 + (j + 0.5) * cs) >= W / 2 + clear * 0.5 ? 1 : 0;
    const holo = (goal) => { const H = new Float64Array(gx * gy).fill(Infinity), gi = Math.floor((goal[0] - box.x0) / cs), gj = Math.floor((goal[1] - box.y0) / cs); if (gi < 0 || gj < 0 || gi >= gx || gj >= gy) return H;
      const hp = new Heap(); H[gj * gx + gi] = 0; hp.push([0, gj * gx + gi]);
      while (hp.size) { const [d0, c] = hp.pop(); if (d0 > H[c]) continue; const i = c % gx, j = (c / gx) | 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= gx || jj >= gy) continue; const n = jj * gx + ii; if (!passable[n] && !(ii === gi && jj === gj)) continue;
          const nd = d0 + (di && dj ? Math.SQRT2 : 1) * cs; if (nd < H[n]) { H[n] = nd; hp.push([nd, n]); } } }
      return H; };
    const NH = 72, step = Math.max(1.0, cs * 1.6), sub = Math.max(3, Math.ceil(step / 0.25)), ks = [-kmax, -kmax / 2, 0, kmax / 2, kmax], tol = Math.max(1.0, cs * 1.5);
    // a drawn point the vehicle cannot stand on (against a wall, inside a building): the nearest point it can, within 8 m
    const need = W / 2 + clear, okAt = (x, y) => G.at(x, y) >= need + 0.05;
    const nearestFree = (p) => { if (okAt(p[0], p[1])) return p; let best = null, bd = Infinity; const st2 = res;
      for (let r = st2; r <= 8 && !best; r += st2) for (let a = 0; a < 64; a++) { const x = p[0] + Math.cos(a / 64 * TAU) * r, y = p[1] + Math.sin(a / 64 * TAU) * r; if (okAt(x, y) && r < bd) { bd = r; best = [x, y]; } }
      return best; };
    const leg = (s0, goal, last) => {
      if (!free(s0.x, s0.y, s0.th, s0.phi)) return { error: 'the start of the route is inside or against an obstacle' };
      const H = holo(goal), hAt = (x, y) => { const i = Math.floor((x - box.x0) / cs), j = Math.floor((y - box.y0) / cs); const h = i < 0 || j < 0 || i >= gx || j >= gy ? Infinity : H[j * gx + i]; return Math.max(Math.hypot(goal[0] - x, goal[1] - y), Number.isFinite(h) ? h : 1e6); };
      const key = (x, y, th) => (Math.floor((y - box.y0) / cs) * gx + Math.floor((x - box.x0) / cs)) * NH + (Math.floor(wrapA(th) / TAU * NH) % NH);
      const nodes = [{ ...s0, g: 0, k: 0, par: -1, seg: null }], best = new Map([[key(s0.x, s0.y, s0.th), 0]]), hp = new Heap(); hp.push([hAt(s0.x, s0.y), 0]);
      const maxN = o.maxExpand || 120000; let found = -1, exp = 0;
      while (hp.size && exp < maxN) { const [, ni] = hp.pop(), n = nodes[ni]; if (n.closed) continue; n.closed = true; exp++;
        if (Math.hypot(goal[0] - n.x, goal[1] - n.y) < tol) { found = ni; break; }
        for (const k of ks) { let x = n.x, y = n.y, th = n.th, phi = n.phi, ok = true; const pts = []; const ds = step / sub;
          for (let q = 0; q < sub; q++) { if (art) phi += (Math.sin(th - phi) + (T.hitch || 0) * k * Math.cos(th - phi)) / T.wheelbase * ds;
            const thm = th + k * ds / 2; x += Math.cos(thm) * ds; y += Math.sin(thm) * ds; th += k * ds;
            if (art && Math.abs(Math.atan2(Math.sin(th - phi), Math.cos(th - phi))) > (T.maxArticulation || 70) * Math.PI / 180) { ok = false; break; }
            if (!free(x, y, th, phi)) { ok = false; break; } pts.push([x, y, k]); }
          if (!ok) continue;
          const g = n.g + step * (1 + 0.15 * Math.abs(k) / kmax) + (k !== n.k ? 0.25 * step * Math.abs(k - n.k) / kmax : 0), kk = key(x, y, th), prev = best.get(kk);
          if (prev !== undefined && nodes[prev].g <= g) continue;
          nodes.push({ x, y, th, phi, g, k, par: ni, seg: pts }); best.set(kk, nodes.length - 1); hp.push([g + 1.05 * hAt(x, y), nodes.length - 1]); } }
      if (found < 0) return { error: exp >= maxN ? 'no way round was found within the search limit' : 'no way round: the obstacles leave no gap the vehicle can pass' };
      const chain = []; for (let i = found; i >= 0; i = nodes[i].par) chain.push(nodes[i]); chain.reverse();
      const pts = []; for (const c of chain) if (c.seg) pts.push(...c.seg);
      // to the point itself in a straight line when the last pose is near it and the line is clear
      const e = chain.at(-1), dg = Math.hypot(goal[0] - e.x, goal[1] - e.y), heading = Math.atan2(goal[1] - e.y, goal[0] - e.x);
      if (dg > 0.05 && Math.abs(Math.atan2(Math.sin(heading - e.th), Math.cos(heading - e.th))) < 0.35) { const m = Math.ceil(dg / 0.25); let okL = true; const extra = [];
        for (let q = 1; q <= m; q++) { const x = e.x + (goal[0] - e.x) * q / m, y = e.y + (goal[1] - e.y) * q / m; if (!free(x, y, heading, e.phi)) { okL = false; break; } extra.push([x, y, 0]); }
        if (okL) { pts.push(...extra); return { pts, end: { x: goal[0], y: goal[1], th: heading, phi: e.phi }, exp }; } }
      void last; return { pts, end: { x: e.x, y: e.y, th: e.th, phi: e.phi }, exp }; };
    const moved = [], Q = P.map((p, i) => { const q = nearestFree(p); if (q && q !== p) moved.push({ i, from: p, to: q, d: Math.hypot(q[0] - p[0], q[1] - p[1]) }); return q; });
    const bad = Q.findIndex((q) => !q); if (bad >= 0) return { ok: false, error: `point ${bad + 1} of the route is ${bad === 0 ? 'where' : 'where'} the vehicle cannot stand, with no free place within 8 m` };
    const th0 = Math.atan2(Q[1][1] - Q[0][1], Q[1][0] - Q[0][0]); let st = { x: Q[0][0], y: Q[0][1], th: th0, phi: th0 };
    if (!free(st.x, st.y, st.th, st.phi)) { for (let a = 1; a <= 36 && !free(st.x, st.y, st.th, st.phi); a++) st.th = th0 + (a % 2 ? 1 : -1) * Math.ceil(a / 2) * TAU / 72; st.phi = st.th; }   // facing a little off the line where the body fits
    const all = [[Q[0][0], Q[0][1], 0]]; let exp = 0;
    for (let i = 1; i < Q.length; i++) { const r = leg(st, Q[i], i === Q.length - 1); if (r.error) return { ok: false, error: r.error, leg: i }; all.push(...r.pts); st = r.end; exp += r.exp; }
    // every ~0.1 m along it, with the curvature
    const path = [{ p: [all[0][0], all[0][1]], k: 0 }]; let len = 0;
    for (let i = 1; i < all.length; i++) { const a = all[i - 1], b = all[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d < 1e-6) continue; len += d; path.push({ p: [b[0], b[1]], k: b[2] }); }
    return { ok: true, path, length: len, clearanceUsed: clear, expanded: exp, moved };
  };
  const clear = o.clearance ?? 0.3, first = tryWith(clear); if (first.ok) return first;
  const tight = clear > 0 ? tryWith(0) : first; if (tight.ok) return { ...tight, underClearance: true };
  return { ok: false, error: first.error, leg: first.leg };
}

// how much of the drawn route runs into an obstacle (with the body's half width and the clearance): the first such point, or null
export function drawnBlocked(v, route, obstacles, clear = 0.3) {
  const P = route.pts || []; const pad = 5; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of P) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  if (!Number.isFinite(x0)) return null; const box = { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad }, G = grid(obstacles, box, 0.2);
  for (let i = 0; i + 1 < P.length; i++) { const a = P[i], b = P[i + 1], m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.2));
    for (let q = 0; q <= m; q++) { const x = a[0] + (b[0] - a[0]) * q / m, y = a[1] + (b[1] - a[1]) * q / m; if (G.at(x, y) < v.width / 2 + clear) return { seg: i, p: [x, y] }; } }
  return null; }
