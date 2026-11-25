// A drivable way around obstacles for the Vehicle swept path (2026-11-18). The route a person draws is driven as drawn when it is
// clear; where it runs into an obstacle, this finds a path the vehicle can actually drive around it, through the same points.
// Method (hybrid A*, as used for vehicle and parking planners): the search moves the vehicle forward in short arcs, straight or
// turning no tighter than its least radius (with a margin), so every path it returns can be driven; each pose is checked
// against the obstacles with the body (and the trailer of an articulated vehicle) covered by circles, using a distance map of
// the obstacles; the estimate that guides it is the shortest way round the obstacles on a grid, so it heads round them, not into
// them. Plan metres, x east, y north. Pure functions: the Node tests run the same code.
// Limits, said where they apply: rigid vehicles may reverse (o.reverse, 2026-11-25), articulated ones drive forward only; a route drawn with reversing is not re-planned; obstacles as given (a
// missing obstacle is not avoided); the found path is a feasible one, not the only or a regulation one.
import { rMin } from './vehicles.js?v=batch3-20261124-1';

const TAU = Math.PI * 2;
const wrapA = (t) => ((t % TAU) + TAU) % TAU;

// ---- the obstacles as a grid: occupied cells, then the distance (m) from each cell to the nearest occupied one ----
function grid(obstacles, box, res, block = null) {
  const nx = Math.max(2, Math.ceil((box.x1 - box.x0) / res)), ny = Math.max(2, Math.ceil((box.y1 - box.y0) / res)), occ = new Uint8Array(nx * ny);
  if (block) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (block(box.x0 + (i + 0.5) * res, box.y0 + (j + 0.5) * res)) occ[j * nx + i] = 1;   // (2026-11-25) off the paved area: blocked
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

// the body as its rectangle (2026-11-25, tight turns): points along its outline must keep the clearance, points along its axis (away from
// the ends) must be half its width clear, so nothing lies inside it; [x along the heading, y to the left, distance needed less the clearance]
function rectSamples(lenBack, lenFront, W) { const out = [], h = W / 2, L = lenBack + lenFront, nL = Math.max(2, Math.ceil(L / 0.35)), nW = Math.max(2, Math.ceil(W / 0.35));
  for (let i = 0; i <= nL; i++) { const x = -lenBack + L * i / nL; out.push([x, h, 0], [x, -h, 0]); }
  for (let j = 1; j < nW; j++) { const y = -h + W * j / nW; out.push([-lenBack, y, 0], [lenFront, y, 0]); }
  const a = -lenBack + h, b = lenFront - h; if (b > a) { const n = Math.max(1, Math.ceil((b - a) / 0.5)); for (let i = 0; i <= n; i++) out.push([a + (b - a) * i / n, 0, h]); } else out.push([(lenFront - lenBack) / 2, 0, Math.min(h, L / 2)]);
  return out; }
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
 * @param o { clearance (m), maxExpand, startHeading (rad), goalHeading (rad, the last point: the vehicle ends facing this way, ±goalTol),
 *            goalTol (rad, 0.2), roads: [{ pts, width }] (2026-11-25: off these corridors costs more, so the path keeps to the roads),
 *            roadsOnly (the vehicle must stay within the road corridors), reverse (rigid vehicles may reverse: three-point turns, backing in) }
 * @returns { ok, path: [{ p: [x, y], k, dir }] every ~0.1 m, length, reverseLength, cusps, clearanceUsed, legs, onRoad (share), error?, closest? }
 */
export function planAround(v, route, obstacles, o = {}) {
  const P = (route.pts || []).map((p) => [+p[0], +p[1]]); if (P.length < 2) return { ok: false, error: 'Draw at least two points' };
  if ((route.reverse || []).some(Boolean)) return { ok: false, error: 'a route with reversing is driven as drawn' };
  const W = v.width, Lw = v.wheelbase, art = v.kind === 'artic' && v.trailer, T = art ? v.trailer : null, canRev = !!o.reverse;   // (2026-11-26) articulated vehicles reverse too, the trailer kept straighter (below)
  const R = rMin(v) * 1.1, kmax = 1 / R;   // a 10 % margin on the least radius, so the driven vehicle can follow what is planned
  // the area searched: the route and the obstacles near it, with room to go round
  const pad = Math.max(25, 2 * v.length + (T ? T.wheelbase + T.rearOverhang : 0));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of P) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const box = { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad }, span = Math.max(box.x1 - box.x0, box.y1 - box.y0), res = Math.max(0.15, Math.min(0.5, span / 900));
  const near = obstacles.filter((ob) => { if (!ob.poly || ob.poly.length < 3) return false; let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const p of ob.poly) { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); } return a < box.x1 + 5 && c > box.x0 - 5 && b < box.y1 + 5 && d > box.y0 - 5; });   // its extent meets the area (a long wall with its ends far away counts)
  const roadAt = roadMask(o.roads, box, o.roadsOnly ? res : Math.max(res, 0.5)),   /* kept within the roads: the edge at the grid's own resolution */ offCost = o.roads && o.roads.length && !o.roadsOnly ? 0.6 : 0;
  const G = grid(near, box, res, o.roadsOnly && o.roads && o.roads.length ? (x, y) => !roadAt(x, y) : null), exact = !!(o.reverse || o.roadsOnly || o.exact), shape = exact ? rectSamples : (b, f, w) => circles(b, f, w).map(([off, r]) => [off, 0, r]), body = shape(v.rearOverhang, Lw + v.frontOverhang, W), tbody = art ? shape(T.wheelbase + T.rearOverhang, T.frontOverhang, T.width || W) : null;   // tight manoeuvres: the exact outline; else circles (as before)
  const tryWith = (clear) => {
    const free = (x, y, th, phi) => { const c = Math.cos(th), s = Math.sin(th); for (const [lx, ly, r] of body) { if (G.at(x + c * lx - s * ly, y + s * lx + c * ly) < r + clear) return false; }
      if (art) { const hx = x + c * (T.hitch || 0), hy = y + s * (T.hitch || 0), cp = Math.cos(phi), sp = Math.sin(phi); for (const [lx, ly, r] of tbody) if (G.at(hx + cp * lx - sp * ly, hy + sp * lx + cp * ly) < r + clear) return false; }
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
      // the state's key: cell, heading and direction; for a semi-trailer that may reverse (2026-11-26) also the trailer's angle in 10° bins,
      // so a pose reached with the trailer at another angle is not thrown away
      const AB = canRev && art ? 15 : 1, abin = (th, phi) => (AB > 1 ? Math.max(0, Math.min(AB - 1, Math.floor((Math.atan2(Math.sin(th - phi), Math.cos(th - phi)) + 75 * Math.PI / 180) / (10 * Math.PI / 180)))) : 0);
      const key = (x, y, th, dir = 1, phi = th) => (((Math.floor((y - box.y0) / cs) * gx + Math.floor((x - box.x0) / cs)) * NH + (Math.floor(wrapA(th) / TAU * NH) % NH)) * 2 + (dir < 0 ? 1 : 0)) * AB + abin(th, phi);
      const minLeg = 1.5, hTh = () => 0;   // the turning still to do toward the final heading
      const REV = art ? 3.0 : 2.0, ARTREV = (T ? (T.maxArticulation || 70) : 70) * 0.6 * Math.PI / 180, SWITCH = Math.max(3 * step, v.wheelbase + v.frontOverhang + v.rearOverhang);   // reversing costs 2x a metre (a semi-trailer 3x, its articulation kept within 0.6 x the maximum); a change of direction costs the vehicle's own length
      const nodes = [{ ...s0, g: 0, k: 0, dir: s0.dir || 0, par: -1, seg: null }], best = new Map([[key(s0.x, s0.y, s0.th), 0]]), hp = new Heap(); hp.push([hAt(s0.x, s0.y), 0]);
      const maxN = o.maxExpand || 120000, gH = last && o.goalHeading != null ? o.goalHeading : null, gTol = o.goalTol || 0.2; let found = -1, exp = 0, close = 0, closeD = Infinity;
      const headOk = (th) => gH == null || Math.abs(Math.atan2(Math.sin(th - gH), Math.cos(th - gH))) <= gTol;
      while (hp.size && exp < maxN) { const [, ni] = hp.pop(), n = nodes[ni]; if (n.closed) continue; n.closed = true; exp++;
        if (o.onProgress && exp % 2000 === 0) o.onProgress(exp, maxN);   /* (2026-11-26) for the worker's progress */
        const dn = Math.hypot(goal[0] - n.x, goal[1] - n.y); if (dn < closeD) { closeD = dn; close = ni; }
        if (dn < tol && headOk(n.th)) { found = ni; break; }
        for (const dir of canRev ? [1, -1] : [1]) for (const k of ks) { if (n.dir && dir !== n.dir && (n.leg || 0) < minLeg) continue; /* (2026-11-25) a leg at least minLeg long before the next change of direction */ let x = n.x, y = n.y, th = n.th, phi = n.phi, ok = true; const pts = []; const ds = step / sub * dir;   // dir −1: backwards along the heading
          for (let q = 0; q < sub; q++) { if (art) phi += (Math.sin(th - phi) + (T.hitch || 0) * k * Math.cos(th - phi)) / T.wheelbase * ds;
            const thm = th + k * ds / 2; x += Math.cos(thm) * ds; y += Math.sin(thm) * ds; th += k * ds;
            if (art && Math.abs(Math.atan2(Math.sin(th - phi), Math.cos(th - phi))) > (dir < 0 ? ARTREV : o.artMax ?? (T.maxArticulation || 70) * Math.PI / 180)) { ok = false; break; }
            if (!free(x, y, th, phi)) { ok = false; break; } pts.push([x, y, k, dir, phi]); }
          if (!ok) continue;
          const g = n.g + step * (dir < 0 ? REV : 1) * (1 + 0.15 * Math.abs(k) / kmax + (offCost && !roadAt(x, y) ? offCost : 0)) + (k !== n.k ? 0.25 * step * Math.abs(k - n.k) / kmax : 0) + (n.dir && dir !== n.dir ? SWITCH : 0), kk = key(x, y, th, dir, phi), prev = best.get(kk);
          if (prev !== undefined && nodes[prev].g <= g) continue;
          nodes.push({ x, y, th, phi, g, k, dir, leg: dir === n.dir || !n.dir ? (n.leg || 0) + step : step, par: ni, seg: pts }); best.set(kk, nodes.length - 1); hp.push([g + 1.05 * hAt(x, y) + hTh(th), nodes.length - 1]); } }
      if (found < 0) { const c = nodes[close]; return { error: gH != null && closeD < tol ? 'the vehicle reaches the end but cannot end facing the way asked: not enough room to turn' : exp >= maxN ? 'no way round was found within the search limit' : 'no way round: the obstacles leave no gap the vehicle can pass', closest: c ? [c.x, c.y] : null, gap: closeD }; }
      const chain = []; for (let i = found; i >= 0; i = nodes[i].par) chain.push(nodes[i]); chain.reverse();
      const pts = []; for (const c of chain) if (c.seg) pts.push(...c.seg);
      // to the point itself in a straight line when the last pose is near it and the line is clear
      const e = chain.at(-1), dg = Math.hypot(goal[0] - e.x, goal[1] - e.y), heading = Math.atan2(goal[1] - e.y, goal[0] - e.x);
      if (dg > 0.05 && !exact && (e.dir || 1) > 0 && Math.abs(Math.atan2(Math.sin(heading - e.th), Math.cos(heading - e.th))) < (dg < 1.2 ? 0.9 : 0.35) && headOk(heading)) { /* the last metre or so straight to the point */ const m = Math.ceil(dg / 0.25); let okL = true; const extra = [];
        for (let q = 1; q <= m; q++) { const x = e.x + (goal[0] - e.x) * q / m, y = e.y + (goal[1] - e.y) * q / m; if (!free(x, y, heading, e.phi)) { okL = false; break; } extra.push([x, y, 0, 1, e.phi]); }
        if (okL) { pts.push(...extra); return { pts, end: { x: goal[0], y: goal[1], th: heading, phi: e.phi, dir: 1 }, exp }; } }
      void last; return { pts, end: { x: e.x, y: e.y, th: e.th, phi: e.phi, dir: e.dir }, exp }; };
    const moved = [], Q = P.map((p, i) => { const q = nearestFree(p); if (q && q !== p) moved.push({ i, from: p, to: q, d: Math.hypot(q[0] - p[0], q[1] - p[1]) }); return q; });
    const bad = Q.findIndex((q) => !q); if (bad >= 0) return { ok: false, error: `point ${bad + 1} of the route is ${bad === 0 ? 'where' : 'where'} the vehicle cannot stand, with no free place within 8 m` };
    const th0 = o.startHeading != null ? o.startHeading : Math.atan2(Q[1][1] - Q[0][1], Q[1][0] - Q[0][0]); let st = { x: Q[0][0], y: Q[0][1], th: th0, phi: th0 };
    if (!free(st.x, st.y, st.th, st.phi)) { for (let a = 1; a <= 36 && !free(st.x, st.y, st.th, st.phi); a++) st.th = th0 + (a % 2 ? 1 : -1) * Math.ceil(a / 2) * TAU / 72; st.phi = st.th; }   // facing a little off the line where the body fits
    const all = [[Q[0][0], Q[0][1], 0, 1, st.phi]], heading0 = st.th; let exp = 0;
    for (let i = 1; i < Q.length; i++) { const r = leg(st, Q[i], i === Q.length - 1); if (r.error) return { ok: false, error: r.error, leg: i, closest: r.closest, gap: r.gap }; all.push(...r.pts); st = r.end; exp += r.exp; }
    // every ~0.1 m along it, with the curvature
    if (all.length > 1) all[0][3] = all[1][3] || 1;
    const path = [{ p: [all[0][0], all[0][1]], k: 0, dir: all[0][3] || 1, phi: all[0][4] }]; let len = 0, rlen = 0, cusps = 0;
    for (let i = 1; i < all.length; i++) { const a = all[i - 1], b = all[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d < 1e-6) continue; len += d; const dir = b[3] || 1; if (dir < 0) rlen += d; if (dir !== path.at(-1).dir) cusps++; path.push({ p: [b[0], b[1]], k: b[2], dir, phi: b[4] }); }
    const onRoad = offCost ? path.filter((q) => roadAt(q.p[0], q.p[1])).length / path.length : null;
    return { ok: true, path, heading0, length: len, reverseLength: rlen, cusps, clearanceUsed: clear, expanded: exp, moved, onRoad, endHeading: st.th, endPhi: st.phi, end: [st.x, st.y] };
  };
  const clear = o.clearance ?? 0.3, first = tryWith(clear); if (first.ok) return first;
  const tight = clear > 0 ? tryWith(0) : first; if (tight.ok) return { ...tight, underClearance: true };
  return { ok: false, error: first.error, leg: first.leg, closest: first.closest, gap: first.gap };
}

// the roads as corridors (2026-11-25): a cell is on a road when it lies within half the road's width of its centreline
function roadMask(roads, box, res) { if (!roads || !roads.length) return () => true; const nx = Math.max(1, Math.ceil((box.x1 - box.x0) / res)), ny = Math.max(1, Math.ceil((box.y1 - box.y0) / res)), m = new Uint8Array(nx * ny);
  for (const r of roads) { const P = r.pts || [], hw = Math.max(1.5, (+r.width || 6) / 2);
    for (let s = 0; s + 1 < P.length; s++) { const a = P[s], b = P[s + 1], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-9;
      const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - hw - box.x0) / res)), i1 = Math.min(nx - 1, Math.floor((Math.max(a[0], b[0]) + hw - box.x0) / res)), j0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - hw - box.y0) / res)), j1 = Math.min(ny - 1, Math.floor((Math.max(a[1], b[1]) + hw - box.y0) / res));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = box.x0 + (i + 0.5) * res, y = box.y0 + (j + 0.5) * res, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)); if (Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) <= hw) m[j * nx + i] = 1; } } }
  return (x, y) => { const i = Math.floor((x - box.x0) / res), j = Math.floor((y - box.y0) / res); return i >= 0 && j >= 0 && i < nx && j < ny && m[j * nx + i] === 1; }; }

// how much of the drawn route runs into an obstacle (with the body's half width and the clearance): the first such point, or null
export function drawnBlocked(v, route, obstacles, clear = 0.3) {
  const P = route.pts || []; const pad = 5; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of P) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  if (!Number.isFinite(x0)) return null; const box = { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad }, G = grid(obstacles, box, 0.2);
  for (let i = 0; i + 1 < P.length; i++) { const a = P[i], b = P[i + 1], m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.2));
    for (let q = 0; q <= m; q++) { const x = a[0] + (b[0] - a[0]) * q / m, y = a[1] + (b[1] - a[1]) * q / m; if (G.at(x, y) < v.width / 2 + clear) return { seg: i, p: [x, y] }; } }
  return null; }

/**
 * Backing a semi-trailer up to a door (2026-11-26). Searching for the reverse directly rarely succeeds: going backwards the trailer's
 * angle grows, so very few of the moves tried keep it in check. Going forwards it settles, so the reverse is planned as a drive
 * forward out of the door (the trailer square to the wall at the start), and then driven the other way. The trailer retraces the same
 * angles when the same path is driven backwards: the trailer equation is the same with the sign of the step changed.
 * The drive: forward from the road to a staging pose in line with the end of that pull-out, the stop, then the pull-out backwards.
 * task { start: { p, heading }, via: [x, y], viaHeading, end: { p, heading } } → as planAround, plus trailerSeam (degrees: how far the
 * trailer's angle at the stop differs from the one the reverse starts from; the driver takes that out in the first metres).
 */
export function planBackIn(v, task, obstacles, o = {}) {
  const T = v.trailer || { wheelbase: 1e9, hitch: 0 }, kb = 0.5 / (rMin(v) * 1.1), S = v.trailer ? Math.max(6, T.wheelbase) : 6, D = Math.max(10, 2 * v.wheelbase), dsP = 0.1;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), base = { ...o, reverse: false, roadsOnly: false };
  // the pull-out keeps the trailer within the articulation allowed when reversing (0.6 x the maximum), as the reverse follows it; it is
  // tried to each staging pose given (on the road past the door first, as a driver docks), the one with the least reversing kept
  const artMax = (T.maxArticulation || 70) * 0.6 * Math.PI / 180, vias = task.vias || [{ p: task.via, heading: task.viaHeading }]; let po = null, err = null;
  for (const st of vias) { const r = planAround(v, { pts: [task.end.p, st.p] }, obstacles, { ...base, artMax, exact: true, startHeading: task.end.heading, goalHeading: st.heading, goalTol: 0.15, maxExpand: o.maxExpand || 60000 }); if (o.onProgress) o.onProgress(0, 0);
    if (r.ok && (!po || r.length < po.length)) po = r; else if (!r.ok && !err) err = r.error; if (po && po.length < 2.5 * Math.hypot(st.p[0] - task.end.p[0], st.p[1] - task.end.p[1])) break; }
  if (!po) return { ok: false, error: 'no way to back up to the door was found: ' + err, closest: null, gap: NaN };
  // the pull-out, then straight on: a straight stretch where the reverse begins, the trailer nearly in line
  const fwd = po.path.map((q) => ({ ...q })), th = po.endHeading; let x = fwd.at(-1).p[0], y = fwd.at(-1).p[1], phi = fwd.at(-1).phi ?? th;
  for (let d = dsP; d <= S + 1e-9; d += dsP) { x += Math.cos(th) * dsP; y += Math.sin(th) * dsP; phi += Math.sin(th - phi) / T.wheelbase * dsP; fwd.push({ p: [x, y], k: 0, dir: 1, phi }); }
  const B = [x, y], ux = [Math.cos(th), Math.sin(th)], Pa = [B[0] - ux[0] * D, B[1] - ux[1] * D];
  const ap = planAround(v, { pts: [task.start.p, Pa] }, obstacles, { ...base, startHeading: task.start.heading, goalHeading: th, goalTol: 0.12 });
  if (!ap.ok) return { ok: false, error: 'no way from the road to the staging point: ' + ap.error, closest: ap.closest, gap: ap.gap };
  // onto the line of the reverse: two opposite arcs (a lane change) from where the approach ends, then straight to the stop
  const A = ap.path.at(-1), loc = (p) => [(p[0] - B[0]) * ux[0] + (p[1] - B[1]) * ux[1], -(p[0] - B[0]) * ux[1] + (p[1] - B[1]) * ux[0]];
  const [ax, ay] = loc(A.p), eps = wrap(ap.endHeading - th);
  const run = (k1, l1, k2, l2) => { let px = ax, py = ay, h = eps; const out = []; for (const [k, l] of [[k1, l1], [k2, l2]]) { const m = Math.max(1, Math.round(l / dsP)), st = l / m; for (let i = 0; i < m; i++) { const hm = h + k * st / 2; px += Math.cos(hm) * st; py += Math.sin(hm) * st; h += k * st; out.push([px, py, k]); } } return { out, px, py, h }; };
  let best = null;
  if (Math.abs(ay) > 0.02 || Math.abs(eps) > 0.005) for (const sg of [1, -1]) { let prev = null;
    for (let l1 = 0; l1 <= Math.PI / kb; l1 += 0.1) { const l2 = l1 + eps / (sg * kb); if (l2 < 0) continue; const r = run(sg * kb, l1, -sg * kb, l2);
      if (prev && Math.sign(prev.py) !== Math.sign(r.py)) { const f = prev.py / (prev.py - r.py), L1 = prev.l1 + (l1 - prev.l1) * f, R2 = run(sg * kb, L1, -sg * kb, L1 + eps / (sg * kb)); if (!best || L1 * 2 < best.len) best = { ...R2, len: 2 * L1 + eps / (sg * kb) }; break; }
      prev = { py: r.py, l1 }; } }
  if ((Math.abs(ay) > 0.02 || Math.abs(eps) > 0.005) && !best) return { ok: false, error: 'the approach cannot be brought in line with the reverse', closest: A.p, gap: Math.hypot(ax, ay) };
  const world = (lx, ly) => [B[0] + lx * ux[0] - ly * ux[1], B[1] + lx * ux[1] + ly * ux[0]], path = ap.path.map((q) => ({ ...q }));
  let ph = A.phi ?? ap.endHeading, hh = ap.endHeading, last = A.p;
  const push = (p, k, dir) => { const d = Math.hypot(p[0] - last[0], p[1] - last[1]); if (d < 1e-6) return; const hn = Math.atan2(p[1] - last[1], p[0] - last[0]); if (dir > 0) { ph += (Math.sin(hh - ph) + (T.hitch || 0) * k * Math.cos(hh - ph)) / T.wheelbase * d; hh = hn; } path.push({ p, k, dir, phi: ph }); last = p; };
  if (best) for (const [lx, ly, k] of best.out) push(world(lx, ly), k, 1);
  const X = best ? best.px : ax; for (let lx = X + dsP; lx < -1e-9; lx += dsP) push(world(Math.min(0, lx), 0), 0, 1); if (X < 0) push(world(0, 0), 0, 1);   // straight on to the stop
  const seam = Math.abs(wrap(ph - fwd.at(-1).phi)) * 180 / Math.PI;
  // the reverse: back along the stop's line to the end of the straight, then the pull-out driven the other way (each point carries the
  // curvature of the arc that reaches it, so the arcs shift by one)
  const pre = []; if (X > 0) for (let lx = X - dsP; lx > 1e-9; lx -= dsP) pre.push({ p: world(lx, 0), k: 0, dir: -1, phi: fwd.at(-1).phi });
  path.push(...pre); for (let j = fwd.length - 2; j >= 0; j--) path.push({ p: fwd[j].p, k: fwd[j + 1].k, dir: -1, phi: fwd[j].phi });
  let len = 0, rlen = 0, cusps = 0; for (let i = 1; i < path.length; i++) { const d = Math.hypot(path[i].p[0] - path[i - 1].p[0], path[i].p[1] - path[i - 1].p[1]); len += d; if (path[i].dir < 0) rlen += d; if (path[i].dir !== path[i - 1].dir) cusps++; }
  return { ok: true, path, heading0: ap.heading0, length: len, reverseLength: rlen, cusps, clearanceUsed: Math.max(po.clearanceUsed, ap.clearanceUsed), underClearance: !!(po.underClearance || ap.underClearance), expanded: (po.expanded || 0) + (ap.expanded || 0), moved: [], onRoad: ap.onRoad, endHeading: task.end.heading, trailerSeam: seam, method: 'pull-out reversed' };
}
