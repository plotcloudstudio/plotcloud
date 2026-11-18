// 2D geometry for the site studies (2026-11-18): Vehicle swept path and Parking layout. Plan metres, x east, y north.
// Pure functions, no DOM: the same code runs in the browser and in the Node tests. Polygons are [[x, y], …] (not closed);
// a region is { outer, holes: [] }. Tolerances are named, so a check never depends on a stray literal.
export const EPS = 1e-9, TOL = 1e-6;   // EPS: degenerate tests; TOL: a micrometre, for "on the edge" decisions

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, k) => [a[0] * k, a[1] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1], cross = (a, b) => a[0] * b[1] - a[1] * b[0], len = (a) => Math.hypot(a[0], a[1]);
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const unit = (a) => { const l = len(a); return l > EPS ? [a[0] / l, a[1] / l] : [0, 0]; };
export const rot = (a, t) => [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t)];
export const wrap = (t) => { while (t > Math.PI) t -= 2 * Math.PI; while (t < -Math.PI) t += 2 * Math.PI; return t; };

// signed area (counter-clockwise positive), centroid
export function area(P) { let s = 0; for (let i = 0, n = P.length; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
export const ccw = (P) => (area(P) < 0 ? P.slice().reverse() : P.slice());
export function centroid(P) { let A = 0, x = 0, y = 0; for (let i = 0, n = P.length; i < n; i++) { const a = P[i], b = P[(i + 1) % n], c = a[0] * b[1] - b[0] * a[1]; A += c; x += (a[0] + b[0]) * c; y += (a[1] + b[1]) * c; }
  return Math.abs(A) > EPS ? [x / (3 * A), y / (3 * A)] : P.reduce((s, p) => [s[0] + p[0] / P.length, s[1] + p[1] / P.length], [0, 0]); }
export function bbox(P) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of P) { if (p[0] < x0) x0 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[0] > x1) x1 = p[0]; if (p[1] > y1) y1 = p[1]; } return { x0, y0, x1, y1 }; }
export const boxesMeet = (a, b, m = 0) => a.x0 - m <= b.x1 && b.x0 - m <= a.x1 && a.y0 - m <= b.y1 && b.y0 - m <= a.y1;

// a polygon cleaned: repeated points (within 1 mm) and straight-through points removed, counter-clockwise; null when it has no area
export function clean(P, snap = 1e-3) { const out = [];
  for (const p of P || []) { const q = [+p[0], +p[1]]; if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) continue; if (!out.length || dist(out.at(-1), q) > snap) out.push(q); }
  if (out.length > 1 && dist(out[0], out.at(-1)) <= snap) out.pop();
  for (let i = 0; i < out.length && out.length > 3;) { const a = out[(i - 1 + out.length) % out.length], b = out[i], c = out[(i + 1) % out.length]; if (Math.abs(cross(sub(b, a), sub(c, b))) <= snap * Math.max(dist(a, b), dist(b, c), 1e-9) && dot(sub(b, a), sub(c, b)) > 0) out.splice(i, 1); else i++; }
  return out.length >= 3 && Math.abs(area(out)) > snap * snap ? ccw(out) : null; }
// does any edge cross another (not neighbours)? A self-crossing outline is reported, not silently used
export function selfCrossing(P) { const n = P.length; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segsCross(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return [i, j]; } return null; }

// point in polygon (even-odd); on the edge counts as inside within TOL
export function inPoly(p, P) { let c = false; for (let i = 0, n = P.length, j = n - 1; i < n; j = i++) { const a = P[i], b = P[j];
    if (segDist(p, a, b).d <= TOL) return true; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
export const inRegion = (p, R) => inPoly(p, R.outer) && !(R.holes || []).some((h) => inPoly(p, h) && !onBoundary(p, h));
export const onBoundary = (p, P) => P.some((a, i) => segDist(p, a, P[(i + 1) % P.length]).d <= TOL);

// distance from a point to a segment, with the nearest point
export function segDist(p, a, b) { const ab = sub(b, a), l2 = dot(ab, ab); let t = l2 > EPS ? dot(sub(p, a), ab) / l2 : 0; t = Math.max(0, Math.min(1, t)); const q = [a[0] + ab[0] * t, a[1] + ab[1] * t]; return { d: dist(p, q), q, t }; }
// do two segments cross (proper or touching)?
export function segsCross(a, b, c, d) { const o = (p, q, r) => { const v = cross(sub(q, p), sub(r, p)); return Math.abs(v) <= EPS ? 0 : v > 0 ? 1 : -1; }, on = (p, q, r) => Math.min(p[0], r[0]) - EPS <= q[0] && q[0] <= Math.max(p[0], r[0]) + EPS && Math.min(p[1], r[1]) - EPS <= q[1] && q[1] <= Math.max(p[1], r[1]) + EPS;
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b); if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && on(a, c, b)) || (o2 === 0 && on(a, d, b)) || (o3 === 0 && on(c, a, d)) || (o4 === 0 && on(c, b, d)); }
// where two lines meet (infinite lines), or null when parallel
export function lineX(a, b, c, d) { const r = sub(b, a), s = sub(d, c), k = cross(r, s); if (Math.abs(k) < EPS) return null; const t = cross(sub(c, a), s) / k; return [a[0] + r[0] * t, a[1] + r[1] * t]; }

// two polygons overlap (an edge crosses, or one holds the other)
export function overlap(A, B) { const ba = bbox(A), bb = bbox(B); if (!boxesMeet(ba, bb)) return false;
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) if (segsCross(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length])) return true;
  return inPoly(A[0], B) || inPoly(B[0], A); }
// strict overlap (shared area, not merely touching): used for stalls that may share an edge
export function overlapArea(A, B) { const C = clipConvex(A, B); return C ? Math.abs(area(C)) : 0; }
// the gap between two polygons (0 when they overlap), with the nearest points
export function gap(A, B) { if (overlap(A, B)) { const c = centroid(A); return { d: 0, a: c, b: c, hit: true }; } let best = { d: Infinity };
  for (const [P, Q, flip] of [[A, B, false], [B, A, true]]) for (const p of P) for (let j = 0; j < Q.length; j++) { const r = segDist(p, Q[j], Q[(j + 1) % Q.length]); if (r.d < best.d) best = flip ? { d: r.d, a: r.q, b: p } : { d: r.d, a: p, b: r.q }; }
  return { ...best, hit: false }; }

// Sutherland–Hodgman: a polygon clipped by a convex one (both counter-clockwise); null when nothing is left
export function clipConvex(P, C) { let out = ccw(P); const K = ccw(C);
  for (let i = 0; i < K.length && out.length; i++) { const a = K[i], b = K[(i + 1) % K.length], inside = (p) => cross(sub(b, a), sub(p, a)) >= -EPS, inp = out; out = [];
    for (let j = 0; j < inp.length; j++) { const p = inp[j], q = inp[(j + 1) % inp.length], pi = inside(p), qi = inside(q); if (pi) out.push(p); if (pi !== qi) { const x = lineX(p, q, a, b); if (x) out.push(x); } } }
  return out.length >= 3 ? out : null; }

// an oriented rectangle: centre, direction angle (radians) of its length, length and width
export function rect(c, ang, L, W) { const u = [Math.cos(ang), Math.sin(ang)], v = [-u[1], u[0]], hl = L / 2, hw = W / 2;
  return [add(add(c, mul(u, -hl)), mul(v, -hw)), add(add(c, mul(u, hl)), mul(v, -hw)), add(add(c, mul(u, hl)), mul(v, hw)), add(add(c, mul(u, -hl)), mul(v, hw))]; }
// a polygon placed by a pose (local x forward, y left)
export const place = (P, x, y, th) => P.map((p) => [x + p[0] * Math.cos(th) - p[1] * Math.sin(th), y + p[0] * Math.sin(th) + p[1] * Math.cos(th)]);
// a polyline's length and the point at a distance along it
export const plLength = (L) => L.reduce((s, p, i) => (i ? s + dist(L[i - 1], p) : 0), 0);

// ---- the union of many polygons on a raster, its area and its outline (the swept envelope of a vehicle) ----
// cell: the raster's cell size (m); the area is the filled cells times the cell area and the outline follows the cell edges,
// so both are exact to the cell size, which the result states
export function rasterUnion(polys, cell, pad = 0.5) { if (!polys.length) return { area: 0, loops: [], cell };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const P of polys) for (const p of P) { if (p[0] < x0) x0 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[0] > x1) x1 = p[0]; if (p[1] > y1) y1 = p[1]; }
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad; const nx = Math.ceil((x1 - x0) / cell), ny = Math.ceil((y1 - y0) / cell), G = new Uint8Array(nx * ny);
  for (const P of polys) { const b = bbox(P), j0 = Math.max(0, Math.floor((b.y0 - y0) / cell)), j1 = Math.min(ny - 1, Math.ceil((b.y1 - y0) / cell));
    for (let j = j0; j <= j1; j++) { const y = y0 + (j + 0.5) * cell, xs = [];   // scanline at the cell centre
      for (let i = 0, n = P.length; i < n; i++) { const a = P[i], c = P[(i + 1) % n]; if ((a[1] > y) !== (c[1] > y)) xs.push(a[0] + (y - a[1]) * (c[0] - a[0]) / (c[1] - a[1])); }
      xs.sort((p, q) => p - q); for (let k = 0; k + 1 < xs.length; k += 2) { const i0 = Math.max(0, Math.ceil((xs[k] - x0) / cell - 0.5)), i1 = Math.min(nx - 1, Math.floor((xs[k + 1] - x0) / cell - 0.5)); for (let i = i0; i <= i1; i++) G[j * nx + i] = 1; } } }
  let n = 0; for (const v of G) n += v;
  // the outline: every edge between a filled and an empty cell, chained into loops, straight runs merged
  const at = (i, j) => (i >= 0 && j >= 0 && i < nx && j < ny ? G[j * nx + i] : 0), E = new Map(), key = (i, j) => i + ',' + j, put = (a, b) => { const k = key(...a); if (E.has(k)) E.get(k).push(b); else E.set(k, [b]); }, take = (k) => { const l = E.get(k); if (!l) return null; const b = l.pop(); if (!l.length) E.delete(k); return b; };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { if (!G[j * nx + i]) continue;   // edges with the cell on their left (counter-clockwise loops)
    if (!at(i, j - 1)) put([i, j], [i + 1, j]); if (!at(i + 1, j)) put([i + 1, j], [i + 1, j + 1]); if (!at(i, j + 1)) put([i + 1, j + 1], [i, j + 1]); if (!at(i - 1, j)) put([i, j + 1], [i, j]); }
  const loops = []; while (E.size) { const k0 = E.keys().next().value, b0 = take(k0), s = k0.split(',').map(Number), L = [s]; let c = b0, guard = 0;   // a vertex where two loops touch at a corner holds two edges
    while (key(...c) !== k0 && guard++ < 4e6) { L.push(c); const nx2 = take(key(...c)); if (!nx2) break; c = nx2; }
    const P = []; for (let k = 0; k < L.length; k++) { const a = L[(k - 1 + L.length) % L.length], b = L[k], c2 = L[(k + 1) % L.length]; if ((b[0] - a[0]) * (c2[1] - b[1]) - (b[1] - a[1]) * (c2[0] - b[0]) !== 0) P.push([x0 + b[0] * cell, y0 + b[1] * cell]); }
    if (P.length >= 3) loops.push(P); }
  return { area: n * cell * cell, loops, cell, grid: { G, nx, ny, x0, y0 } }; }
