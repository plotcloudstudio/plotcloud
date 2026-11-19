// Large files 7 (2026-11-19): optional simplification of an imported model, chosen in the import preview. Each object's triangles are
// welded into an indexed mesh and reduced with meshoptimizer's simplifier (quadric edge collapse; it keeps existing vertices and
// does not move them). The person gives a target number of triangles and the largest change allowed to the shape; the target is
// met only where the shape allows it, and the result says what was reached and how far the surface moved at most (in metres,
// measured: see deviation).
// Objects under 24 triangles (boxes and simple solids) are kept as they are. The winding is made consistent first (see orient).
const URL_ = 'meshopt-simplifier';
let lib = null;
export async function simplifier() {
  if (!lib) lib = import(URL_).then(async (m) => { const S = m.MeshoptSimplifier; await S.ready; if (!S.supported) throw Error('This browser cannot run the simplifier (WebAssembly is needed).'); return S; }).catch((e) => { lib = null; throw e; });
  return lib;
}

// a triangle soup (9 numbers a triangle) → shared vertices and indices; points closer than `tol` metres are one vertex
export function weld(mesh, tol = 1e-5) {
  const L = mesh.length - mesh.length % 9, map = new Map(), pos = [], idx = new Uint32Array(L / 3), k = 1 / tol;
  for (let i = 0, t = 0; i < L; i += 3, t++) {
    const x = mesh[i], y = mesh[i + 1], z = mesh[i + 2], key = Math.round(x * k) + ',' + Math.round(y * k) + ',' + Math.round(z * k);
    let v = map.get(key); if (v === undefined) { v = pos.length / 3; map.set(key, v); pos.push(x, y, z); } idx[t] = v;
  }
  return { pos: new Float32Array(pos), idx };
}

// the triangles' winding made consistent across each connected piece (2026-11-19): files often mix it (faces drawn double-sided hide
// it), and the simplifier treats an edge whose two triangles run the same way as a seam it may not collapse. Edges shared by more
// than two triangles are left alone. Returns how many triangles were turned.
export function orient(idx) {
  const T = idx.length / 3, edges = new Map(), key = (a, b) => a < b ? a * 4294967296 + b : b * 4294967296 + a;
  for (let t = 0; t < T; t++) for (let k = 0; k < 3; k++) { const a = idx[t * 3 + k], b = idx[t * 3 + (k + 1) % 3], e = key(a, b), l = edges.get(e); if (l) l.push(t); else edges.set(e, [t]); }
  const seen = new Uint8Array(T), flip = new Uint8Array(T), dir = (t, a, b) => { for (let k = 0; k < 3; k++) { const x = idx[t * 3 + k], y = idx[t * 3 + (k + 1) % 3]; if (x === a && y === b) return 1; if (x === b && y === a) return -1; } return 0; };
  let turned = 0;
  for (let s = 0; s < T; s++) { if (seen[s]) continue; seen[s] = 1; const st = [s];
    while (st.length) { const t = st.pop();
      for (let k = 0; k < 3; k++) { let a = idx[t * 3 + k], b = idx[t * 3 + (k + 1) % 3]; if (flip[t]) [a, b] = [b, a]; const l = edges.get(key(a, b)); if (!l || l.length !== 2) continue;
        const u = l[0] === t ? l[1] : l[0]; if (seen[u]) continue; seen[u] = 1; if (dir(u, a, b) === 1) { flip[u] = 1; turned++; } st.push(u); } } }
  for (let t = 0; t < T; t++) if (flip[t]) { const x = idx[t * 3 + 1]; idx[t * 3 + 1] = idx[t * 3 + 2]; idx[t * 3 + 2] = x; }
  return turned;
}

// how far the simplified surface is from the original (2026-11-19): the distance from each vertex the simplifier removed to the
// nearest simplified triangle (kept vertices are on it already). meshoptimizer's own figure is an estimate that can be lower,
// so this is the one reported and held to the limit. Triangles are binned in a grid and searched ring by ring.
function ptTri(p, P, i0, i1, i2) {
  const ax = P[i0], ay = P[i0 + 1], az = P[i0 + 2], abx = P[i1] - ax, aby = P[i1 + 1] - ay, abz = P[i1 + 2] - az, acx = P[i2] - ax, acy = P[i2 + 1] - ay, acz = P[i2 + 2] - az;
  const apx = p[0] - ax, apy = p[1] - ay, apz = p[2] - az, d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz; let u, v;
  if (d1 <= 0 && d2 <= 0) { u = 0; v = 0; } else {
    const bpx = apx - abx, bpy = apy - aby, bpz = apz - abz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { u = 1; v = 0; } else { const cpx = apx - acx, cpy = apy - acy, cpz = apz - acz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
      if (d6 >= 0 && d5 <= d6) { u = 0; v = 1; } else { const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4;
        if (vc <= 0 && d1 >= 0 && d3 <= 0) { u = d1 / (d1 - d3); v = 0; } else if (vb <= 0 && d2 >= 0 && d6 <= 0) { u = 0; v = d2 / (d2 - d6); }
        else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); u = 1 - w; v = w; } else { const den = 1 / (va + vb + vc); u = vb * den; v = vc * den; } } } }
  const qx = ax + abx * u + acx * v - p[0], qy = ay + aby * u + acy * v - p[1], qz = az + abz * u + acz * v - p[2]; return qx * qx + qy * qy + qz * qz;
}
export function deviation(pos, idx0, res) {
  const T = res.length / 3, keep = new Uint8Array(pos.length / 3); for (const v of res) keep[v] = 1;
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], pos[i + a]); mx[a] = Math.max(mx[a], pos[i + a]); }
  const diag = Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) || 1, h = Math.max(diag / Math.max(1, Math.cbrt(T) * 2), 1e-4), n = [0, 1, 2].map((a) => Math.max(1, Math.ceil((mx[a] - mn[a]) / h) + 1));
  const cell = (x, a) => Math.min(n[a] - 1, Math.max(0, Math.floor((x - mn[a]) / h))), grid = new Map(), id = (i, j, k) => (i * n[1] + j) * n[2] + k;
  for (let t = 0; t < T; t++) { const lo = [0, 1, 2].map((a) => cell(Math.min(pos[res[t * 3] * 3 + a], pos[res[t * 3 + 1] * 3 + a], pos[res[t * 3 + 2] * 3 + a]), a)), hi = [0, 1, 2].map((a) => cell(Math.max(pos[res[t * 3] * 3 + a], pos[res[t * 3 + 1] * 3 + a], pos[res[t * 3 + 2] * 3 + a]), a));
    for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = lo[2]; k <= hi[2]; k++) { const c = id(i, j, k), l = grid.get(c); if (l) l.push(t); else grid.set(c, [t]); } }
  let worst = 0; const done = new Uint8Array(pos.length / 3), p = [0, 0, 0], mark = new Int32Array(T).fill(-1);
  for (const v of idx0) { if (keep[v] || done[v]) continue; done[v] = 1; p[0] = pos[v * 3]; p[1] = pos[v * 3 + 1]; p[2] = pos[v * 3 + 2];
    const c0 = [0, 1, 2].map((a) => cell(p[a], a)); let best = Infinity;
    for (let r = 0; r <= Math.max(...n); r++) {
      for (let i = c0[0] - r; i <= c0[0] + r; i++) for (let j = c0[1] - r; j <= c0[1] + r; j++) for (let k = c0[2] - r; k <= c0[2] + r; k++) {
        if (Math.max(Math.abs(i - c0[0]), Math.abs(j - c0[1]), Math.abs(k - c0[2])) !== r || i < 0 || j < 0 || k < 0 || i >= n[0] || j >= n[1] || k >= n[2]) continue;
        const l = grid.get(id(i, j, k)); if (l) for (const t of l) { if (mark[t] === v) continue; mark[t] = v; const d = ptTri(p, pos, res[t * 3] * 3, res[t * 3 + 1] * 3, res[t * 3 + 2] * 3); if (d < best) best = d; } }
      if (best <= (r * h) ** 2) break; }
    if (best > worst) worst = best; }
  return Math.sqrt(worst);
}

const soup = (pos, idx) => { const out = new Array(idx.length * 3); for (let i = 0; i < idx.length; i++) { const v = idx[i] * 3; out[i * 3] = +pos[v].toFixed(6); out[i * 3 + 1] = +pos[v + 1].toFixed(6); out[i * 3 + 2] = +pos[v + 2].toFixed(6); } return out; };
const trisOf = (c) => Math.floor(c.mesh.length / 9);

/** components: [{ mesh, g, ... }] in metres. target: triangles wanted for the whole model. maxError: metres the surface may move (Infinity for no limit).
 *  Returns { components (new objects, meshes replaced), before, after, maxError (the largest change found, m), changed (objects reduced), kept } */
export async function simplifyComponents(components, { target, maxError = 0.02, onProgress, signal } = {}) {
  const S = await simplifier(), before = components.reduce((s, c) => s + trisOf(c), 0);
  if (!(target > 0) || target >= before) return { components, before, after: before, maxError: 0, changed: 0, kept: components.length };
  // the small objects stay; the rest share what is left of the target in proportion to their size
  const small = components.filter((c) => trisOf(c) < 24).reduce((s, c) => s + trisOf(c), 0), big = before - small, ratio = Math.max(0, Math.min(1, (target - small) / Math.max(1, big)));
  const out = [], abs = Number.isFinite(maxError); let after = 0, worst = 0, changed = 0, done = 0, last = performance.now();
  for (const c of components) {
    if (signal?.aborted) throw Object.assign(Error('Simplification cancelled.'), { name: 'AbortError' });
    const t = trisOf(c); done += t;
    if (t < 24 || ratio >= 1) { out.push(c); after += t; continue; }
    const { pos, idx } = weld(c.mesh); orient(idx); const want = Math.max(12, Math.floor(t * ratio)) * 3;
    // held to the limit by the measured change: tighter and again while it is over, and the object as it was if it stays over
    let res = null, e = 0, budget = abs ? maxError : 1;
    for (let k = 0; k < 4; k++) { const [r] = S.simplify(idx, pos, 3, Math.min(idx.length, want), budget, abs ? ['ErrorAbsolute'] : []); if (!r.length || r.length >= idx.length) { res = null; break; }
      const d = deviation(pos, idx, r); if (!abs || d <= maxError) { res = r; e = d; break; } budget *= Math.max(0.1, 0.8 * maxError / d); res = null; }
    if (!res) { out.push(c); after += t; }
    else { out.push({ ...c, mesh: soup(pos, res) }); after += res.length / 3; changed++; worst = Math.max(worst, e); }
    if (performance.now() - last > 60) { onProgress?.(done / before); await new Promise((r) => setTimeout(r)); last = performance.now(); }
  }
  onProgress?.(1);
  return { components: out, before, after, maxError: worst, changed, kept: components.length - changed };
}
