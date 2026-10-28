// Shared existing solver. Units: kN, m; E/G in kN/m²; stresses in MPa.
const SA = (() => {
  const G_ACC = 9.81;
  // ---------------- materials (typical values; the user can override E and density) ----------------
  const MATERIALS = {
    steel: { name: 'Steel, grade 350W', E: 200e6, G: 77e6, rho: 7850, fy: 350, fyName: 'yield' },
    glulam: { name: 'Glulam, Douglas fir 24f-E', E: 12.4e6, G: 0.775e6, rho: 490, fy: 30.6, fyName: 'bending strength' },
    concrete: { name: 'Concrete, 30 MPa', E: 24.6e6, G: 10.3e6, rho: 2400, fy: 30, fyName: "f'c" },
    cable: { name: 'Spiral strand, galvanised', E: 160e6, G: 0, rho: 7850, fy: 1570, fyName: 'wire strength' },
  };
  // ---------------- sections (from nominal dimensions in mm; fillets ignored) ----------------
  const mm = (v) => v / 1000;
  function chs(D, t) { const d = mm(D), ti = mm(t), di = d - 2 * ti, A = Math.PI / 4 * (d * d - di * di), I = Math.PI / 64 * (d ** 4 - di ** 4); return { A, Iy: I, Iz: I, J: 2 * I, Wy: I / (d / 2), Wz: I / (d / 2), r: d / 2, shape: 'round' }; }
  function rhs(B, H, t) { const b = mm(B), h = mm(H), ti = mm(t), A = b * h - (b - 2 * ti) * (h - 2 * ti), Iy = (b * h ** 3 - (b - 2 * ti) * (h - 2 * ti) ** 3) / 12, Iz = (h * b ** 3 - (h - 2 * ti) * (b - 2 * ti) ** 3) / 12, bm = b - ti, hm = h - ti, J = 4 * (bm * hm) ** 2 * ti / (2 * (bm + hm)); return { A, Iy, Iz, J, Wy: Iy / (h / 2), Wz: Iz / (b / 2), r: Math.max(b, h) / 2, shape: 'box' }; }
  function wsh(D, BF, TF, TW) { const d = mm(D), bf = mm(BF), tf = mm(TF), tw = mm(TW), hw = d - 2 * tf, A = 2 * bf * tf + hw * tw, Iy = (bf * d ** 3 - (bf - tw) * hw ** 3) / 12, Iz = 2 * tf * bf ** 3 / 12 + hw * tw ** 3 / 12, J = (2 * bf * tf ** 3 + hw * tw ** 3) / 3; return { A, Iy, Iz, J, Wy: Iy / (d / 2), Wz: Iz / (bf / 2), r: d / 2, shape: 'I' }; }
  function rect(B, H) { const b = mm(B), h = mm(H), a = Math.max(b, h), c = Math.min(b, h), J = a * c ** 3 * (1 / 3 - 0.21 * c / a * (1 - c ** 4 / (12 * a ** 4))); return { A: b * h, Iy: b * h ** 3 / 12, Iz: h * b ** 3 / 12, J, Wy: b * h * h / 6, Wz: h * b * b / 6, r: Math.max(b, h) / 2, shape: 'box' }; }
  function cable(D) { const d = mm(D), A = 0.75 * Math.PI * d * d / 4; return { A, Iy: 0, Iz: 0, J: 0, Wy: 0, Wz: 0, r: d / 2, shape: 'round' }; }   // metallic area of a spiral strand, fill factor 0.75
  const SECTIONS = [
    ...[[60.3, 4], [88.9, 5], [114.3, 6], [168.3, 8], [219.1, 10], [273, 10], [323.9, 12]].map(([D, t]) => ({ id: `chs${D}x${t}`, mat: 'steel', name: `Round tube CHS ${D} × ${t}`, ...chs(D, t) })),
    ...[[100, 100, 6], [150, 150, 8], [200, 200, 10], [250, 150, 10]].map(([B, H, t]) => ({ id: `rhs${B}x${H}x${t}`, mat: 'steel', name: `Box tube HSS ${H} × ${B} × ${t}`, ...rhs(B, H, t) })),
    ...[['W200x46', 203, 203, 11, 7.2], ['W310x60', 303, 203, 13.1, 7.5], ['W410x67', 410, 179, 14.4, 8.8], ['W530x92', 533, 209, 15.6, 10.2]].map(([n, d, bf, tf, tw]) => ({ id: n.toLowerCase(), mat: 'steel', name: `I-beam ${n}`, ...wsh(d, bf, tf, tw) })),
    ...[[80, 228], [130, 304], [175, 456], [215, 608]].map(([b, h]) => ({ id: `glu${b}x${h}`, mat: 'glulam', name: `Glulam ${b} × ${h}`, ...rect(b, h) })),
    ...[[300, 300], [400, 400], [400, 600]].map(([b, h]) => ({ id: `con${b}x${h}`, mat: 'concrete', name: `Concrete ${b} × ${h}`, ...rect(b, h) })),
    ...[12, 16, 20, 26, 32, 40, 52, 64].map((d) => ({ id: `cab${d}`, mat: 'cable', name: `Cable Ø${d} spiral strand`, ...cable(d) })),
    // added for Quick Analysis: more W shapes (nominal d, bf, tf, tw; fillets ignored — check the CISC Handbook), concrete and glulam
    ...[['W150x30', 157, 153, 9.3, 6.6], ['W250x58', 252, 203, 13.5, 8.0], ['W360x79', 354, 205, 16.8, 9.4], ['W460x89', 463, 192, 17.7, 10.5], ['W610x125', 612, 229, 19.6, 11.9], ['W690x170', 693, 256, 23.6, 13.1], ['W250x89', 260, 256, 17.3, 10.7], ['W310x118', 314, 307, 18.7, 11.9], ['W360x147', 360, 370, 19.8, 12.3], ['W360x196', 372, 374, 26.2, 16.4], ['W760x196', 770, 268, 25.4, 15.6], ['W840x226', 851, 294, 26.8, 16.1]].map(([n, d, bf, tf, tw]) => ({ id: n.toLowerCase(), mat: 'steel', name: `I-beam ${n}`, ...wsh(d, bf, tf, tw) })),
    ...[[300, 450], [300, 500], [350, 600], [400, 700], [400, 800], [450, 900], [500, 500], [600, 600], [700, 700]].map(([b, h]) => ({ id: `con${b}x${h}`, mat: 'concrete', name: `Concrete ${b} × ${h}`, ...rect(b, h) })),
    ...[[130, 380], [175, 532], [215, 684], [265, 760], [265, 912], [175, 228], [215, 266], [265, 304], [315, 342]].map(([b, h]) => ({ id: `glu${b}x${h}`, mat: 'glulam', name: `Glulam ${b} × ${h}`, ...rect(b, h) })),
    ...[[127, 127, 8], [178, 178, 10]].map(([B, H, t]) => ({ id: `rhs${B}x${H}x${t}`, mat: 'steel', name: `Box tube HSS ${H} × ${B} × ${t}`, ...rhs(B, H, t) })),
  ];
  const secById = (id) => SECTIONS.find((s) => s.id === id);

  // ---------------- model building: merge nodes, split at T-junctions, drop duplicates ----------------
  // segs: [{a:[x,y,z], b:[x,y,z], g: groupIndex}], faces: [[p,p,p]] (optional, for area loads)
  function build(segs, faces = [], tol = 0.001) {
    const nodes = [], H = new Map(), cell = Math.max(tol * 4, 1e-6), key = (i, j, k) => `${i},${j},${k}`;
    const node = (p) => { const i = Math.round(p[0] / cell), j = Math.round(p[1] / cell), k = Math.round(p[2] / cell); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const l = H.get(key(i + a, j + b, k + c)); if (l) for (const n of l) { const q = nodes[n]; if (Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) <= tol) return n; } } nodes.push([p[0], p[1], p[2]]); const kk = key(i, j, k); (H.get(kk) || H.set(kk, []).get(kk)).push(nodes.length - 1); return nodes.length - 1; };
    let short = 0;
    let mem = [];
    for (const s of segs) { const a = node(s.a), b = node(s.b); if (a === b) { short++; continue; } mem.push({ a, b, g: s.g || 0 }); }
    const fc = []; for (const f of faces) { const ids = f.map(node); if (ids[0] !== ids[1] && ids[1] !== ids[2] && ids[0] !== ids[2]) fc.push(ids); }
    // split members where another node lies on them (lines drawn through a joint)
    const MC = new Map(), mcell = (() => { let L = 0; for (const m of mem) L += dist(nodes[m.a], nodes[m.b]); return Math.max(tol * 10, L / Math.max(1, mem.length)); })();
    const mkey = (p) => [Math.floor(p[0] / mcell), Math.floor(p[1] / mcell), Math.floor(p[2] / mcell)];
    let split = 0;
    {
      const NB = new Map(); nodes.forEach((p, n) => { const k = mkey(p).join(); (NB.get(k) || NB.set(k, []).get(k)).push(n); });
      const out = [];
      for (const m of mem) {
        const A = nodes[m.a], B = nodes[m.b], L = dist(A, B), lo = mkey(A.map((v, i) => Math.min(v, B[i]) - tol)), hi = mkey(A.map((v, i) => Math.max(v, B[i]) + tol)), on = [];
        if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) < 2e5) for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = lo[2]; k <= hi[2]; k++) { const l = NB.get(`${i},${j},${k}`); if (!l) continue; for (const n of l) { if (n === m.a || n === m.b) continue; const P = nodes[n], t = ((P[0] - A[0]) * (B[0] - A[0]) + (P[1] - A[1]) * (B[1] - A[1]) + (P[2] - A[2]) * (B[2] - A[2])) / (L * L); if (t <= 1e-9 || t >= 1 - 1e-9) continue; const Q = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]; if (dist(P, Q) <= tol) on.push([t, n]); } }
        if (!on.length) { out.push(m); continue; }
        on.sort((x, y) => x[0] - y[0]); let prev = m.a; for (const [, n] of on) { if (n !== prev) out.push({ a: prev, b: n, g: m.g }); prev = n; } out.push({ a: prev, b: m.b, g: m.g }); split++;
      }
      mem = out;
    }
    const seen = new Set(); let dup = 0; const members = [];
    for (const m of mem) { const k = m.a < m.b ? m.a + ':' + m.b : m.b + ':' + m.a; if (seen.has(k)) { dup++; continue; } seen.add(k); members.push(m); }
    // drop nodes nobody uses
    const used = new Int32Array(nodes.length).fill(-1), N2 = []; for (const m of members) for (const n of [m.a, m.b]) if (used[n] < 0) { used[n] = N2.length; N2.push(nodes[n]); }
    for (const m of members) { m.a = used[m.a]; m.b = used[m.b]; }
    const faces2 = fc.filter((f) => f.every((n) => used[n] >= 0)).map((f) => f.map((n) => used[n]));
    const M = { nodes: N2, members, faces: faces2, check: { short, dup, split, merged: segs.length * 2 - N2.length } };
    M.check.parts = components(M).count;
    return M;
  }
  // a pinned base also holds the twist about the vertical axis, so a column cannot spin on its base (no effect on bending)
  const FIX = { fixed: [1, 1, 1, 1, 1, 1], pinned: [1, 1, 1, 0, 0, 1], roller: [0, 0, 1, 0, 0, 0] };
  const fixity = (t) => (Array.isArray(t) ? t : FIX[t] || FIX.pinned);
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  function components(M) {
    const n = M.nodes.length, p = new Int32Array(n).map((_, i) => i), f = (x) => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; };
    for (const m of M.members) { const a = f(m.a), b = f(m.b); if (a !== b) p[a] = b; }
    const lab = new Int32Array(n), map = new Map(); for (let i = 0; i < n; i++) { const r = f(i); if (!map.has(r)) map.set(r, map.size); lab[i] = map.get(r); }
    return { count: map.size, lab };
  }

  // ---------------- loads ----------------
  // M.groups[g] = { kind: 'frame'|'truss'|'cable', mat: {E,G,rho,fy}, sec: {A,Iy,Iz,J,...}, T0 }
  // M.supports: Map(node -> 'fixed'|'pinned'|'roller'); M.point: [{n, c:'D'|'L', F:[x,y,z]}]; M.area: {D, L} in kN/m²
  function tributary(M) {   // surface area and plan area per node, from the faces
    const s = new Float64Array(M.nodes.length), pl = new Float64Array(M.nodes.length), X = M.nodes;
    for (const f of M.faces) for (let k = 1; k + 1 < f.length; k++) { const a = X[f[0]], b = X[f[k]], c = X[f[k + 1]], u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], cx = u[1] * v[2] - u[2] * v[1], cy = u[2] * v[0] - u[0] * v[2], cz = u[0] * v[1] - u[1] * v[0], A = Math.hypot(cx, cy, cz) / 2, P = Math.abs(cz) / 2; for (const n of [f[0], f[k], f[k + 1]]) { s[n] += A / 3; pl[n] += P / 3; } }
    return { s, pl };
  }
  // load cases: D dead, L live, S snow, and any lateral cases (Wx, Wy, ...) given as point loads.
  // vertical load per meter on a member: self-weight (unless switched off), the group's line loads and the member's own
  function lineLoad(M, m) {
    const g = M.groups[m.g], w = m.w || {}; if (!g || !g.sec || !g.mat) return { D: 0, L: 0, S: 0 };
    return { D: (M.self === false ? 0 : g.mat.rho * G_ACC / 1000 * g.sec.A) + (+g.wD || 0) + (+w.D || 0), L: (+g.wL || 0) + (+w.L || 0), S: (+g.wS || 0) + (+w.S || 0) };
  }
  function caseNames(M) {
    const c = new Set(['D', 'L']);
    for (const m of M.members) { const w = lineLoad(M, m); if (w.S) c.add('S'); }
    if (M.area && +M.area.S) c.add('S');
    for (const p of M.point || []) c.add(p.c);
    return [...c];
  }
  function caseLoads(M, X = M.nodes) {   // nodal force vectors (3 per node) per load case
    const n = X.length, out = {}, tr = tributary({ ...M, nodes: X });
    for (const c of caseNames(M)) out[c] = new Float64Array(3 * n);
    for (const m of M.members) { const L = dist(X[m.a], X[m.b]), w = lineLoad(M, m); for (const c of ['D', 'L', 'S']) if (w[c] && out[c]) { out[c][3 * m.a + 2] -= w[c] * L / 2; out[c][3 * m.b + 2] -= w[c] * L / 2; } }
    const aD = +M.area.D || 0, aL = +M.area.L || 0, aS = +M.area.S || 0;
    for (let i = 0; i < n; i++) { out.D[3 * i + 2] -= aD * tr.s[i]; out.L[3 * i + 2] -= aL * tr.pl[i]; if (out.S) out.S[3 * i + 2] -= aS * tr.pl[i]; }
    for (const p of M.point || []) { const V = out[p.c]; for (let k = 0; k < 3; k++) V[3 * p.n + k] += p.F[k]; }
    out.area = tr;
    return out;
  }
  const SGN = 1;   // sign of the consistent end moments, checked by the benchmarks
  // Without snow or lateral loads: the original three. With them: NBC 2020 Table 4.1.3.2.-A (cases 1–4, companions one at a time,
  // 0.9 D where dead load counteracts wind) and service combinations with Is = 0.9 for snow and Iw = 0.75 for wind (Tables 4.1.6.2, 4.1.7.3).
  const COMBOS = { D: { name: 'Dead load only', f: { D: 1 }, kind: 'D' }, SLS: { name: 'Service · 1.0 D + 1.0 L', f: { D: 1, L: 1 }, kind: 'SLS' }, ULS: { name: 'Strength · 1.25 D + 1.5 L', f: { D: 1.25, L: 1.5 }, kind: 'ULS' } };
  function combosFor(M) {
    const cs = caseNames(M), S = cs.includes('S'), W = cs.filter((c) => c[0] === 'W');
    if (!S && !W.length) return Object.entries(COMBOS).map(([id, c]) => ({ id, ...c }));
    const out = [{ id: 'D', name: 'Dead load only', f: { D: 1 }, kind: 'D' }], U = (id, name, f) => out.push({ id, name, f, kind: 'ULS' }), V = (id, name, f) => out.push({ id, name, f, kind: 'SLS' });
    const Ws = W.flatMap((w) => [[w, 1], [w, -1]]), wn = (w, sg) => `${sg < 0 ? '−' : '+'}${w.slice(1) || ''}`;
    U('U1', '1 · 1.4 D', { D: 1.4 });
    U('U2', `2 · 1.25 D + 1.5 L${S ? ' + 1.0 S' : ''}`, { D: 1.25, L: 1.5, ...(S ? { S: 1 } : {}) });
    for (const [w, sg] of Ws) U(`U2${w}${sg}`, `2 · 1.25 D + 1.5 L + 0.4 W${wn(w, sg)}`, { D: 1.25, L: 1.5, [w]: 0.4 * sg });
    if (S) { U('U3', '3 · 1.25 D + 1.5 S + 1.0 L', { D: 1.25, S: 1.5, L: 1 }); for (const [w, sg] of Ws) U(`U3${w}${sg}`, `3 · 1.25 D + 1.5 S + 0.4 W${wn(w, sg)}`, { D: 1.25, S: 1.5, [w]: 0.4 * sg }); }
    for (const [w, sg] of Ws) {
      U(`U4L${w}${sg}`, `4 · 1.25 D + 1.4 W${wn(w, sg)} + 0.5 L`, { D: 1.25, [w]: 1.4 * sg, L: 0.5 });
      if (S) U(`U4S${w}${sg}`, `4 · 1.25 D + 1.4 W${wn(w, sg)} + 0.5 S`, { D: 1.25, [w]: 1.4 * sg, S: 0.5 });
      U(`U4D${w}${sg}`, `4 · 0.9 D + 1.4 W${wn(w, sg)}`, { D: 0.9, [w]: 1.4 * sg });
    }
    V('S1', 'Service · D + L', { D: 1, L: 1 });
    if (S) V('S2', 'Service · D + 0.9 S', { D: 1, S: 0.9 });
    for (const [w, sg] of Ws) V(`S3${w}${sg}`, `Service · D + 0.75 W${wn(w, sg)}`, { D: 1, [w]: 0.75 * sg });
    return out;
  }

  // ---------------- sparse symmetric solver: RCM ordering + skyline LDLt ----------------
  function rcm(n, adj) {
    const deg = adj.map((a) => a.length), seen = new Uint8Array(n), order = [];
    while (order.length < n) {
      let s = -1; for (let i = 0; i < n; i++) if (!seen[i] && (s < 0 || deg[i] < deg[s])) s = i;
      // pseudo-peripheral start: walk to the last level twice
      for (let rep = 0; rep < 2; rep++) { const lv = new Int32Array(n).fill(-1), q = [s]; lv[s] = 0; let last = s; for (let h = 0; h < q.length; h++) { const u = q[h]; for (const v of adj[u]) if (lv[v] < 0 && !seen[v]) { lv[v] = lv[u] + 1; q.push(v); if (lv[v] > lv[last] || (lv[v] === lv[last] && deg[v] < deg[last])) last = v; } } s = last; }
      const q = [s]; seen[s] = 1;
      for (let h = 0; h < q.length; h++) { const u = q[h]; order.push(u); const nb = adj[u].filter((v) => !seen[v]).sort((a, b) => deg[a] - deg[b]); for (const v of nb) { seen[v] = 1; q.push(v); } }
    }
    order.reverse(); const perm = new Int32Array(n); order.forEach((u, i) => (perm[u] = i)); return perm;   // perm[node] = new index
  }
  class Skyline {
    constructor(N, top) { this.N = N; this.top = top; this.off = new Float64Array(N + 1); let s = 0; for (let j = 0; j < N; j++) { this.off[j] = s; s += j - top[j] + 1; } this.off[N] = s; this.size = s; this.a = new Float64Array(s); }
    add(i, j, v) { if (i > j) [i, j] = [j, i]; this.a[this.off[j] + i - this.top[j]] += v; }
    get(i, j) { if (i > j) [i, j] = [j, i]; return i < this.top[j] ? 0 : this.a[this.off[j] + i - this.top[j]]; }
    factor() {   // in place: column j holds l_ij above the diagonal and d_j on it
      const { N, top, off, a } = this, diag0 = new Float64Array(N);
      for (let j = 0; j < N; j++) diag0[j] = a[off[j] + j - top[j]];
      for (let j = 0; j < N; j++) {
        const tj = top[j], oj = off[j];
        for (let i = tj; i < j; i++) { const ti = top[i], oi = off[i], k0 = Math.max(ti, tj); let s = a[oj + i - tj]; for (let k = k0; k < i; k++) s -= a[oi + k - ti] * a[oj + k - tj]; a[oj + i - tj] = s; }
        let d = a[oj + j - tj];
        for (let i = tj; i < j; i++) { const g = a[oj + i - tj], di = a[off[i] + i - top[i]], l = g / di; a[oj + i - tj] = l; d -= l * g; }
        if (!(d > 1e-11 * Math.max(1e-30, diag0[j]))) { const e = new Error('singular'); e.dof = j; e.pivot = d; throw e; }
        a[oj + j - tj] = d;
      }
    }
    solve(b) {
      const { N, top, off, a } = this, x = Float64Array.from(b);
      for (let j = 0; j < N; j++) { const tj = top[j], oj = off[j]; let s = x[j]; for (let i = tj; i < j; i++) s -= a[oj + i - tj] * x[i]; x[j] = s; }
      for (let j = 0; j < N; j++) x[j] /= a[off[j] + j - top[j]];
      for (let j = N - 1; j >= 0; j--) { const tj = top[j], oj = off[j], xj = x[j]; for (let i = tj; i < j; i++) x[i] -= a[oj + i - tj] * xj; }
      return x;
    }
  }
  // equation numbering: dpn dofs per node, restrained dofs removed, nodes in RCM order
  function numbering(nNodes, elems, dpn, fixed) {
    const adj = Array.from({ length: nNodes }, () => []); for (const e of elems) { adj[e.a].push(e.b); adj[e.b].push(e.a); }
    const perm = rcm(nNodes, adj), byNew = new Int32Array(nNodes); perm.forEach((p, n) => (byNew[p] = n));
    const eq = new Int32Array(nNodes * dpn).fill(-1); let N = 0;
    for (let p = 0; p < nNodes; p++) { const n = byNew[p]; for (let k = 0; k < dpn; k++) if (!fixed[n * dpn + k]) eq[n * dpn + k] = N++; }
    const top = new Int32Array(N); for (let i = 0; i < N; i++) top[i] = i;
    for (const e of elems) { const ds = []; for (const n of [e.a, e.b]) for (let k = 0; k < dpn; k++) { const q = eq[n * dpn + k]; if (q >= 0) ds.push(q); } const mn = Math.min(...ds); for (const q of ds) if (mn < top[q]) top[q] = mn; }
    return { eq, N, top };
  }
  const profileSize = (top) => { let s = 0; for (let j = 0; j < top.length; j++) s += j - top[j] + 1; return s; };
  const MAX_PROFILE = 4.0e7;   // about 320 MB of doubles; beyond this the model must be simplified

  // ---------------- element geometry ----------------
  function frameAxes(A, B) {
    const L = dist(A, B), ex = [(B[0] - A[0]) / L, (B[1] - A[1]) / L, (B[2] - A[2]) / L];
    const ref = Math.abs(ex[2]) > 0.999 ? [1, 0, 0] : [0, 0, 1];
    let ey = [ref[1] * ex[2] - ref[2] * ex[1], ref[2] * ex[0] - ref[0] * ex[2], ref[0] * ex[1] - ref[1] * ex[0]]; const ly = Math.hypot(...ey); ey = ey.map((v) => v / ly);
    const ez = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]];
    return { L, R: [ex, ey, ez] };
  }
  function kLocal(E, G, s, L, truss) {
    const k = Array.from({ length: 12 }, () => new Float64Array(12)), set = (i, j, v) => { k[i][j] += v; if (i !== j) k[j][i] += v; };
    const ea = E * s.A / L; set(0, 0, ea); set(6, 6, ea); set(0, 6, -ea);
    if (truss) return k;
    const gj = G * s.J / L; set(3, 3, gj); set(9, 9, gj); set(3, 9, -gj);
    const z = E * s.Iz, y = E * s.Iy, L2 = L * L, L3 = L2 * L;
    set(1, 1, 12 * z / L3); set(1, 5, 6 * z / L2); set(1, 7, -12 * z / L3); set(1, 11, 6 * z / L2); set(5, 5, 4 * z / L); set(5, 7, -6 * z / L2); set(5, 11, 2 * z / L); set(7, 7, 12 * z / L3); set(7, 11, -6 * z / L2); set(11, 11, 4 * z / L);
    set(2, 2, 12 * y / L3); set(2, 4, -6 * y / L2); set(2, 8, -12 * y / L3); set(2, 10, -6 * y / L2); set(4, 4, 4 * y / L); set(4, 8, 6 * y / L2); set(4, 10, 2 * y / L); set(8, 8, 12 * y / L3); set(8, 10, 6 * y / L2); set(10, 10, 4 * y / L);
    return k;
  }
  const rot = (R, v, o) => [R[0][0] * v[o] + R[0][1] * v[o + 1] + R[0][2] * v[o + 2], R[1][0] * v[o] + R[1][1] * v[o + 1] + R[1][2] * v[o + 2], R[2][0] * v[o] + R[2][1] * v[o + 1] + R[2][2] * v[o + 2]];
  const rotT = (R, v, o) => [R[0][0] * v[o] + R[1][0] * v[o + 1] + R[2][0] * v[o + 2], R[0][1] * v[o] + R[1][1] * v[o + 1] + R[2][1] * v[o + 2], R[0][2] * v[o] + R[1][2] * v[o + 1] + R[2][2] * v[o + 2]];

  // ---------------- which solver ----------------
  function kindOf(M) {
    const kinds = new Set(M.members.map((m) => M.groups[m.g].kind));
    return kinds.has('cable') ? 'cable' : kinds.has('frame') ? 'frame' : 'truss';
  }
  // what is missing before a run (never assume it)
  function missing(M) {
    const out = [];
    M.groups.forEach((g, i) => { if (!M.members.some((m) => m.g === i)) return; if (!g.mat) out.push(`Material for “${g.name}”`); if (!g.sec) out.push(`Section for “${g.name}”`); if (g.kind === 'cable' && !(g.T0 >= 0)) out.push(`Pretension for “${g.name}”`); });
    if (!M.supports || !M.supports.size) out.push('Supports: select the nodes that sit on foundations');
    if (M.area.D === '' || M.area.D == null || isNaN(M.area.D)) out.push('Dead load on the surface (type 0 if none)');
    if (M.area.L === '' || M.area.L == null || isNaN(M.area.L)) out.push('Live or snow load (type 0 if none)');
    return out;
  }

  // ---------------- linear static frame / truss ----------------
  // Frame members are split into nSub pieces so that member loads bend them between joints. Each load case is solved once
  // (one factorisation); combinations are linear sums of the case results. Member end releases (pins) are applied to the end
  // pieces by static condensation of the element stiffness and of the member-load equivalent forces.
  const REL = { none: [0, 0], both: [1, 1], a: [1, 0], b: [0, 1] };
  const relOf = (M, m) => { const r = m.rel != null ? m.rel : M.groups[m.g].rel; return Array.isArray(r) ? r : REL[r] || REL.none; };
  function inv(A) {   // small dense inverse (Gauss-Jordan)
    const n = A.length, a = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
    for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r; [a[c], a[p]] = [a[p], a[c]]; const d = a[c][c]; if (Math.abs(d) < 1e-300) return null; for (let k = 0; k < 2 * n; k++) a[c][k] /= d; for (let r = 0; r < n; r++) if (r !== c) { const f = a[r][c]; if (f) for (let k = 0; k < 2 * n; k++) a[r][k] -= f * a[c][k]; } }
    return a.map((r) => r.slice(n));
  }
  function condense(kl, rel) {   // rel: local dof indices released (moment-free); returns condensed k and a function for loads
    if (!rel.length) return { k: kl, load: (f) => f, full: (u) => u };
    const keep = [...Array(12).keys()].filter((i) => !rel.includes(i)), Krr = inv(rel.map((i) => rel.map((j) => kl[i][j])));
    if (!Krr) return { k: kl, load: (f) => f, full: (u) => u };
    const k = Array.from({ length: 12 }, () => new Float64Array(12)), Kkr = keep.map((i) => rel.map((j) => kl[i][j]));
    const G = Kkr.map((row) => rel.map((_, b) => row.reduce((s, v, a) => s + v * Krr[a][b], 0)));   // Kkr Krr⁻¹
    keep.forEach((i, p) => keep.forEach((j, q) => { let v = kl[i][j]; for (let a = 0; a < rel.length; a++) v -= G[p][a] * kl[rel[a]][j]; k[i][j] = v; }));
    const load = (f) => { const o = new Float64Array(12); keep.forEach((i, p) => { let v = f[i]; for (let a = 0; a < rel.length; a++) v -= G[p][a] * f[rel[a]]; o[i] = v; }); return o; };
    // the rotations at released ends (moment there is zero): u_r = Krr⁻¹ (f_r − Krk u_k), f = equivalent member-load forces
    const full = (u, f) => { const o = Float64Array.from(u); rel.forEach((i, a) => { let v = 0; rel.forEach((_, b) => { let t = f ? f[rel[b]] : 0; for (const j of keep) t -= kl[rel[b]][j] * u[j]; v += Krr[a][b] * t; }); o[i] = v; }); return o; };
    return { k, load, full };
  }
  function linear(M, opts = {}) {
    const kind = kindOf(M), dpn = kind === 'frame' ? 6 : 3, nSub = kind === 'frame' ? (opts.nSub ?? 4) : 1;
    const X = M.nodes.map((p) => p.slice()), elems = [], memberNodes = [];
    M.members.forEach((m, mi) => {
      const g = M.groups[m.g], truss = g.kind !== 'frame', ns = truss ? 1 : nSub, [ra, rb] = truss ? [0, 0] : relOf(M, m); let prev = m.a; const list = [m.a];
      for (let s = 1; s <= ns; s++) { let b = m.b; if (s < ns) { const A = M.nodes[m.a], B = M.nodes[m.b]; X.push([A[0] + (B[0] - A[0]) * s / ns, A[1] + (B[1] - A[1]) * s / ns, A[2] + (B[2] - A[2]) * s / ns]); b = X.length - 1; } elems.push({ a: prev, b, m: mi, truss, g, relA: s === 1 && !!ra, relB: s === ns && !!rb }); list.push(b); prev = b; }
      memberNodes.push(list);
    });
    const n = X.length, fixed = new Uint8Array(n * dpn);
    for (const [node, t] of M.supports) { const f = fixity(t); for (let k = 0; k < dpn; k++) if (f[k]) fixed[node * dpn + k] = 1; }
    // rotations nobody resists (joints touched only by bars or by pinned member ends) are held; they carry nothing
    let freeRot = 0;
    if (dpn === 6) { const rigid = new Uint8Array(n); for (const e of elems) if (!e.truss) { if (!e.relA) rigid[e.a] = 1; if (!e.relB) rigid[e.b] = 1; } for (let i = 0; i < n; i++) if (!rigid[i]) { for (let k = 3; k < 6; k++) fixed[i * 6 + k] = 1; freeRot++; } }
    const { eq, N, top } = numbering(n, elems, dpn, fixed);
    if (profileSize(top) > MAX_PROFILE) throw new Error(`The model is too big to solve in the browser (${N.toLocaleString('en-CA')} unknowns). Simplify the mesh or use fewer members.`);
    const K = new Skyline(N, top), cache = [], cases = caseNames(M);
    for (const e of elems) {
      const { L, R } = frameAxes(X[e.a], X[e.b]), kl0 = kLocal(e.g.mat.E, e.g.mat.G, e.g.sec, L, e.truss);
      const rel = [...(e.relA ? [4, 5] : []), ...(e.relB ? [10, 11] : [])], cd = condense(kl0, rel), kl = cd.k;
      const TT = Array.from({ length: 12 }, (_, i) => Float64Array.from({ length: 12 }, (_, j) => (Math.floor(i / 3) === Math.floor(j / 3) ? R[i % 3][j % 3] : 0)));
      const nd = dpn === 6 ? 12 : 6, idx = [], map = [];
      for (const [k, node] of [[0, e.a], [1, e.b]]) for (let d = 0; d < dpn; d++) { idx.push(eq[node * dpn + d]); map.push(k * 6 + d); }
      const KT = Array.from({ length: 12 }, () => new Float64Array(12)); for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) { let s = 0; for (let k = 0; k < 12; k++) s += kl[i][k] * TT[k][j]; KT[i][j] = s; }
      const kg = Array.from({ length: nd }, () => new Float64Array(nd)); for (let a = 0; a < nd; a++) for (let b = 0; b < nd; b++) { const i = map[a], j = map[b]; let s = 0; for (let k = 0; k < 12; k++) s += TT[k][i] * KT[k][j]; kg[a][b] = s; }
      for (let a = 0; a < nd; a++) { const p = idx[a]; if (p < 0) continue; for (let b = a; b < nd; b++) { const q = idx[b]; if (q < 0) continue; K.add(p, q, kg[a][b]); } }
      // equivalent nodal loads (local) of this piece's uniform vertical member load, per case; condensed where an end is released
      const w = e.truss ? null : lineLoad(M, M.members[e.m]), eqL = {}, ql = {};
      if (w) for (const c of ['D', 'L', 'S']) {
        if (!w[c]) continue;
        const qg = [0, 0, -w[c]], q = rot(R, qg, 0), ex = R[0], cr = [ex[1] * qg[2] - ex[2] * qg[1], ex[2] * qg[0] - ex[0] * qg[2], ex[0] * qg[1] - ex[1] * qg[0]].map((v) => v * L * L / 12);
        const eqg = new Float64Array(12); for (let k = 0; k < 3; k++) { eqg[3 + k] = SGN * cr[k]; eqg[9 + k] = -SGN * cr[k]; }
        const f = new Float64Array(12); for (let blk = 0; blk < 4; blk++) f.set(rot(R, eqg, blk * 3), blk * 3); for (let k = 0; k < 3; k++) { f[k] = q[k] * L / 2; f[6 + k] = q[k] * L / 2; }
        eqL[c] = { full: f, cond: cd.load(f) }; ql[c] = q;
      }
      cache.push({ kl, R, L, eqL, ql, rel, cd, EIy: e.g.mat.E * e.g.sec.Iy, EIz: e.g.mat.E * e.g.sec.Iz });
    }
    try { K.factor(); } catch (err) { if (err.message !== 'singular') throw err; let dof = -1; for (let i = 0; i < eq.length; i++) if (eq[i] === err.dof) dof = i; const node = Math.floor(dof / dpn); throw Object.assign(new Error('mechanism'), { mechanism: true, node: node < M.nodes.length ? node : elemsNodeParent(elems, node), dir: ['x', 'y', 'z', 'rx', 'ry', 'rz'][dof % dpn] }); }
    // ----- one solve per load case -----
    const base = caseLoads(M), CR = {};
    for (const c of cases) {
      const F = new Float64Array(n * dpn);
      for (let i = 0; i < M.nodes.length; i++) for (let k = 0; k < 3; k++) F[i * dpn + k] = base[c][3 * i + k];
      // member loads were lumped at the real joints: replace them by the (condensed) equivalent loads of each piece
      for (const m of M.members) { const L = dist(M.nodes[m.a], M.nodes[m.b]), w = lineLoad(M, m)[c] || 0; if (!w) continue; F[m.a * dpn + 2] += w * L / 2; F[m.b * dpn + 2] += w * L / 2; }
      elems.forEach((e, ei) => {
        const ch = cache[ei], q = ch.eqL[c];
        if (e.truss) { const w = lineLoad(M, M.members[e.m])[c] || 0, L = dist(X[e.a], X[e.b]); if (w) { F[e.a * dpn + 2] -= w * L / 2; F[e.b * dpn + 2] -= w * L / 2; } return; }
        if (!q) return;
        const fgl = new Float64Array(12); for (let blk = 0; blk < 4; blk++) fgl.set(rotT(ch.R, q.cond, blk * 3), blk * 3);
        for (const [k, node] of [[0, e.a], [1, e.b]]) for (let d = 0; d < dpn; d++) F[node * dpn + d] += fgl[k * 6 + d];
      });
      const b = new Float64Array(N); for (let i = 0; i < n * dpn; i++) if (eq[i] >= 0) b[eq[i]] = F[i];
      const x = K.solve(b), U = new Float64Array(n * dpn); for (let i = 0; i < n * dpn; i++) if (eq[i] >= 0) U[i] = x[eq[i]];
      const Rn = new Float64Array(n * dpn), FL = [], UL = [];
      elems.forEach((e, ei) => {
        const ch = cache[ei], ug = new Float64Array(12); for (const [k, node] of [[0, e.a], [1, e.b]]) for (let d = 0; d < dpn; d++) ug[k * 6 + d] = U[node * dpn + d];
        const ul = new Float64Array(12); for (let blk = 0; blk < 4; blk++) ul.set(rot(ch.R, ug, blk * 3), blk * 3);
        const fl = new Float64Array(12); for (let i = 0; i < 12; i++) { let s = 0; for (let j = 0; j < 12; j++) s += ch.kl[i][j] * ul[j]; fl[i] = s; }
        const fg = new Float64Array(12); for (let blk = 0; blk < 4; blk++) fg.set(rotT(ch.R, fl, blk * 3), blk * 3);
        for (const [k, node] of [[0, e.a], [1, e.b]]) for (let d = 0; d < dpn; d++) Rn[node * dpn + d] += fg[k * 6 + d];
        if (ch.eqL[c]) { const q = ch.eqL[c].cond; for (let i = 0; i < 12; i++) fl[i] -= q[i]; }
        FL.push(fl); UL.push(ch.rel.length ? ch.cd.full(ul, ch.eqL[c] ? ch.eqL[c].full : null) : ul);
      });
      const reac = new Map(); for (const [node] of M.supports) { const v = []; for (let k = 0; k < Math.min(dpn, 6); k++) v.push(Rn[node * dpn + k] - F[node * dpn + k]); while (v.length < 6) v.push(0); reac.set(node, v); }
      CR[c] = { U, FL, UL, reac, Fsum: sumLoads(F, dpn) };
    }
    // ----- combinations by superposition -----
    const combine = (f) => {
      const U = new Float64Array(n * dpn), mres = M.members.map(() => ({ N: 0, Nmin: Infinity, Nmax: -Infinity, M: 0, V: 0, s: 0, Mend: 0, dmid: 0 }));
      for (const [c, k] of Object.entries(f)) if (CR[c]) { const u = CR[c].U; for (let i = 0; i < U.length; i++) U[i] += k * u[i]; }
      elems.forEach((e, ei) => {
        const ch = cache[ei], fl = new Float64Array(12), q = [0, 0, 0];
        for (const [c, k] of Object.entries(f)) { if (!CR[c]) continue; const a = CR[c].FL[ei]; for (let i = 0; i < 12; i++) fl[i] += k * a[i]; if (ch.ql[c]) for (let j = 0; j < 3; j++) q[j] += k * ch.ql[c][j]; }
        const L = ch.L, mY = e.truss ? 0 : (fl[4] - fl[10]) / 2 - q[2] * L * L / 8, mZ = e.truss ? 0 : (fl[11] - fl[5]) / 2 + q[1] * L * L / 8, mid = Math.hypot(mY, mZ);
        const r = mres[e.m], Nn = fl[6], Me = Math.max(Math.hypot(fl[4], fl[5]), Math.hypot(fl[10], fl[11])), Mm = Math.max(Me, mid), V = Math.max(Math.hypot(fl[1], fl[2]), Math.hypot(fl[7], fl[8]));
        const s = e.g.sec, st = (Math.abs(Nn) / s.A + (s.Wy ? Math.max(Math.abs(fl[4]), Math.abs(fl[10]), Math.abs(mY)) / s.Wy : 0) + (s.Wz ? Math.max(Math.abs(fl[5]), Math.abs(fl[11]), Math.abs(mZ)) / s.Wz : 0)) / 1000;
        r.Nmin = Math.min(r.Nmin, Nn); r.Nmax = Math.max(r.Nmax, Nn); if (Mm > r.M) r.M = Mm; if (Me > r.Mend) r.Mend = Me; if (V > r.V) r.V = V; if (st > r.s) r.s = st;
        // a member in one piece: exact midspan deflection from the end displacements and the uniform load (Euler-Bernoulli)
        if (!e.truss && nSub === 1) {
          const u = new Float64Array(12); for (const [c, k] of Object.entries(f)) if (CR[c]) { const a = CR[c].UL[ei]; for (let i = 0; i < 12; i++) u[i] += k * a[i]; }
          const dz = -L / 8 * (u[4] - u[10]) + (ch.EIy > 0 ? q[2] * L ** 4 / (384 * ch.EIy) : 0), dy = L / 8 * (u[5] - u[11]) + (ch.EIz > 0 ? q[1] * L ** 4 / (384 * ch.EIz) : 0);
          r.dmid = Math.hypot(dz, dy);
        }
      });
      if (nSub > 1) memberNodes.forEach((list, mi) => { if (list.length < 3) return; const a = list[0], b = list[list.length - 1], m = list[Math.floor(list.length / 2)], d = [0, 1, 2].map((k) => U[m * dpn + k] - (U[a * dpn + k] + U[b * dpn + k]) / 2); const A = X[a], B = X[b], L = dist(A, B), ex = [(B[0] - A[0]) / L, (B[1] - A[1]) / L, (B[2] - A[2]) / L], along = d[0] * ex[0] + d[1] * ex[1] + d[2] * ex[2]; mres[mi].dmid = Math.hypot(d[0] - along * ex[0], d[1] - along * ex[1], d[2] - along * ex[2]); });
      for (const r of mres) r.N = Math.abs(r.Nmin) > Math.abs(r.Nmax) ? r.Nmin : r.Nmax;
      const reac = new Map(); for (const [node] of M.supports) { const v = [0, 0, 0, 0, 0, 0]; for (const [c, k] of Object.entries(f)) if (CR[c]) { const a = CR[c].reac.get(node); for (let j = 0; j < 6; j++) v[j] += k * a[j]; } reac.set(node, v); }
      const disp = new Float64Array(3 * M.nodes.length); for (let i = 0; i < M.nodes.length; i++) for (let k = 0; k < 3; k++) disp[3 * i + k] = U[i * dpn + k];
      const dispAll = new Float64Array(3 * n); for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) dispAll[3 * i + k] = U[i * dpn + k];
      const Fs = [0, 0, 0]; for (const [c, k] of Object.entries(f)) if (CR[c]) for (let j = 0; j < 3; j++) Fs[j] += k * CR[c].Fsum[j];
      return { disp, dispAll, members: mres, reac, F: Fs, Rsum: sumReac(reac) };
    };
    const list = combosFor(M), out = {};
    for (const cb of list) out[cb.id] = { ...combine(cb.f), name: cb.name, f: cb.f, kind: cb.kind, id: cb.id };
    envelopes(out, list);
    const caseRes = {}; for (const c of cases) caseRes[c] = combine({ [c]: 1 });
    return { kind, dpn, unknowns: N, nSub, X, elems: elems.map((e) => [e.a, e.b, e.m]), memberNodes, freeRot, combos: out, list, cases: caseRes, method: kind === 'frame' ? `Linear static, 3D frame${M.members.some((m) => relOf(M, m).some(Boolean)) ? ' with pinned member ends' : ' (rigid joints)'}` : 'Linear static, 3D truss (pinned joints)' };
  }
  // envelope pseudo-combinations: 'ULS' and 'SLS' hold the extreme member forces over their combinations and the
  // displaced shape of the combination with the largest movement (named in .gov)
  function envelopes(out, list) {
    for (const kind of ['ULS', 'SLS']) {
      const ids = list.filter((c) => c.kind === kind).map((c) => c.id); if (!ids.length || (ids.length === 1 && ids[0] === kind)) continue;
      const rs = ids.map((id) => out[id]); let gov = rs[0], mx = -1;
      for (const r of rs) { let d = 0; for (let i = 0; i < r.disp.length; i++) d = Math.max(d, Math.abs(r.disp[i])); if (d > mx) { mx = d; gov = r; } }
      const members = gov.members.map((_, i) => { const e = { N: 0, Nmin: Infinity, Nmax: -Infinity, M: 0, V: 0, s: 0, Mend: 0 }; for (const r of rs) { const m = r.members[i]; e.Nmin = Math.min(e.Nmin, m.Nmin); e.Nmax = Math.max(e.Nmax, m.Nmax); e.M = Math.max(e.M, m.M); e.Mend = Math.max(e.Mend, m.Mend); e.V = Math.max(e.V, m.V); e.s = Math.max(e.s, m.s); } e.N = Math.abs(e.Nmin) > Math.abs(e.Nmax) ? e.Nmin : e.Nmax; return e; });
      const reacEnv = new Map(); for (const node of gov.reac.keys()) { const v = [0, 0, 0, 0, 0, 0]; for (const r of rs) { const a = r.reac.get(node); for (let j = 0; j < 6; j++) if (Math.abs(a[j]) > Math.abs(v[j])) v[j] = a[j]; } reacEnv.set(node, v); }
      out[kind] = { ...gov, members, reacEnv, name: `${kind === 'ULS' ? 'Strength' : 'Service'} envelope · ${ids.length} combinations (shape: ${gov.name})`, kind, id: kind, gov: gov.id, ids };
    }
  }
  function elemsNodeParent(elems, node) { const e = elems.find((q) => q.a === node || q.b === node); return e ? e.m : node; }
  function sumLoads(F, dpn) { const s = [0, 0, 0]; for (let i = 0; i < F.length; i += dpn) for (let k = 0; k < 3; k++) s[k] += F[i + k]; return s; }
  function sumReac(reac) { const s = [0, 0, 0]; for (const v of reac.values()) for (let k = 0; k < 3; k++) s[k] += v[k]; return s; }

  // ---------------- non-linear bars and cables ----------------
  // Each member is a bar with stress-free length L0 = L / (1 + N0 / EA), N0 = initial force (pretension in cables).
  // Equilibrium is followed from the drawn geometry (where the internal forces are r0) to the full load in steps,
  // F(λ) = r0 + λ (F − r0), with Newton-Raphson and a tangent stiffness K = EA/L0 e eᵀ + N/L (I − e eᵀ).
  // Slack cables carry nothing (a tiny stiffness keeps the system solvable and is reported).
  function nonlinear(M, opts = {}) {
    const n = M.nodes.length, X0 = Float64Array.from(M.nodes.flat()), fixed = new Uint8Array(3 * n);
    for (const [node, t] of M.supports) { const f = fixity(t); for (let k = 0; k < 3; k++) if (f[k]) fixed[3 * node + k] = 1; }
    const el = M.members.map((m) => { const g = M.groups[m.g], EA = g.mat.E * g.sec.A, L = dist(M.nodes[m.a], M.nodes[m.b]), N0 = m.N0 != null ? m.N0 : g.kind === 'cable' ? (+g.T0 || 0) : 0; return { a: m.a, b: m.b, EA, L0: L / (1 + N0 / EA), cable: g.kind === 'cable' }; });
    const { eq, N, top } = numbering(n, M.members, 3, fixed);
    if (profileSize(top) > MAX_PROFILE) throw new Error(`The model is too big to solve in the browser (${N.toLocaleString('en-CA')} unknowns). Simplify the mesh or use fewer members.`);
    const internal = (X, withK) => {
      const f = new Float64Array(3 * n), K = withK ? new Skyline(N, top) : null, force = new Float64Array(el.length); let slack = 0;
      el.forEach((e, i) => {
        const a = 3 * e.a, b = 3 * e.b, d = [X[b] - X[a], X[b + 1] - X[a + 1], X[b + 2] - X[a + 2]], L = Math.hypot(...d), u = d.map((v) => v / L);
        let Nn = e.EA * (L - e.L0) / e.L0, km = e.EA / e.L0; if (e.cable && Nn < 0) { Nn = 0; km = e.EA / e.L0 * 1e-6; slack++; }
        force[i] = Nn; for (let k = 0; k < 3; k++) { f[a + k] -= Nn * u[k]; f[b + k] += Nn * u[k]; }
        if (!K) return;
        const g = Math.max(Nn, 0) / L; // compression softening is left out of the tangent for robustness; equilibrium is still exact
        const idx = [eq[a], eq[a + 1], eq[a + 2], eq[b], eq[b + 1], eq[b + 2]];
        for (let p = 0; p < 6; p++) { if (idx[p] < 0) continue; for (let q = p; q < 6; q++) { if (idx[q] < 0) continue; const pp = p % 3, qq = q % 3, v = km * u[pp] * u[qq] + g * ((pp === qq ? 1 : 0) - u[pp] * u[qq]); K.add(idx[p], idx[q], (p < 3) === (q < 3) ? v : -v); } }
      });
      return { f, K, force, slack };
    };
    const base = caseLoads(M), r0 = internal(X0, false).f;
    const out = {}, list = combosFor(M);
    let iters = 0;
    for (const cmb of list) {
      const ck = cmb.id, F = new Float64Array(3 * n); for (const [c, k] of Object.entries(cmb.f)) if (base[c]) for (let i = 0; i < 3 * n; i++) F[i] += k * base[c][i];
      const X = Float64Array.from(X0), Fl = (lam) => { const v = new Float64Array(3 * n); for (let i = 0; i < 3 * n; i++) v[i] = r0[i] + lam * (F[i] - r0[i]); return v; };
      const scale = Math.max(1, ...F.map(Math.abs), ...r0.map(Math.abs)), tol = 1e-7 * scale * Math.sqrt(n);
      const resid = (Xc, lam) => { const st = internal(Xc, false), Ft = Fl(lam); let s = 0; for (let i = 0; i < 3 * n; i++) if (eq[i] >= 0) { const r = Ft[i] - st.f[i]; s += r * r; } return Math.sqrt(s); };
      let lam = 0, dl = 1 / (opts.steps || 8), ok = true;
      while (lam < 1 - 1e-12) {
        const target = Math.min(1, lam + dl), Xs = Float64Array.from(X); let conv = false;
        for (let it = 0; it < 40; it++) {
          iters++;
          const st = internal(X, true), Ft = Fl(target), R = new Float64Array(N); let rn = 0;
          for (let i = 0; i < 3 * n; i++) if (eq[i] >= 0) { R[eq[i]] = Ft[i] - st.f[i]; rn += R[eq[i]] ** 2; }
          rn = Math.sqrt(rn); if (rn < tol) { conv = true; break; }
          try { st.K.factor(); } catch (e) { break; }
          const dx = st.K.solve(R);
          let a = 1, best = Infinity, Xt = null;
          for (let ls = 0; ls < 8; ls++) { const Xc = Float64Array.from(X); for (let i = 0; i < 3 * n; i++) if (eq[i] >= 0) Xc[i] += a * dx[eq[i]]; const r2 = resid(Xc, target); if (r2 < best) { best = r2; Xt = Xc; } if (r2 < rn) break; a /= 2; }
          X.set(Xt);
        }
        if (conv) { lam = target; dl = Math.min(dl * 1.5, 0.5); } else { X.set(Xs); dl /= 2; if (dl < 1e-4) { ok = false; break; } }
      }
      const st = internal(X, false);
      const disp = new Float64Array(3 * n); for (let i = 0; i < 3 * n; i++) disp[i] = X[i] - X0[i];
      const reac = new Map(); for (const [node] of M.supports) { const v = [0, 0, 0, 0, 0, 0]; for (let k = 0; k < 3; k++) v[k] = st.f[3 * node + k] - F[3 * node + k]; reac.set(node, v); }
      const mres = el.map((e, i) => { const g = M.groups[M.members[i].g], Nn = st.force[i]; return { N: Nn, Nmin: Nn, Nmax: Nn, M: 0, V: 0, s: Math.abs(Nn) / g.sec.A / 1000, slack: e.cable && Nn === 0 }; });
      out[ck] = { disp, dispAll: disp, members: mres, reac, F: sumLoads(F, 3), Rsum: sumReac(reac), converged: ok, lam, slack: st.slack, name: cmb.name, kind: cmb.kind, id: ck };
    }
    // how far the drawn shape is from equilibrium under dead load and pretension
    const Fd = base.D; let un = 0, sc = 0; for (let i = 0; i < 3 * n; i++) if (eq[i] >= 0) { un = Math.max(un, Math.abs(Fd[i] - r0[i])); sc = Math.max(sc, Math.abs(Fd[i]), Math.abs(r0[i])); }
    envelopes(out, list);
    return { kind: 'cable', dpn: 3, unknowns: N, X: M.nodes, elems: M.members.map((m, i) => [m.a, m.b, i]), memberNodes: M.members.map((m) => [m.a, m.b]), combos: out, list, iters, unbalance: un / Math.max(sc, 1e-9), method: 'Geometrically non-linear, bars and tension-only cables (Newton-Raphson)' };
  }

  // ---------------- form finding (force density) ----------------
  // Free nodes: joints touched only by cables and not supported. Cable force densities q = T/L are updated so every
  // cable ends up near its group's target tension; with dead load the net hangs into shape. Nodes held during
  // form finding (mast tops) are then balanced by solving for the forces in their other members.
  function findForm(M, opts = {}) {
    const n = M.nodes.length, isCable = M.members.map((m) => M.groups[m.g].kind === 'cable'), held = new Uint8Array(n);
    for (const [node] of M.supports) held[node] = 1;
    M.members.forEach((m, i) => { if (!isCable[i]) { held[m.a] = 1; held[m.b] = 1; } });
    const freeIdx = new Int32Array(n).fill(-1); let nf = 0; for (let i = 0; i < n; i++) if (!held[i]) freeIdx[i] = nf++;
    if (!nf) throw new Error('Nothing to form-find: every joint is held by a support or a non-cable member.');
    const cab = M.members.map((m, i) => i).filter((i) => isCable[i] && !(held[M.members[i].a] && held[M.members[i].b]));   // cables between two held joints (guys) are left for the balancing step
    const X = M.nodes.map((p) => p.slice());
    const elems = cab.map((i) => ({ a: M.members[i].a, b: M.members[i].b }));
    const fixedF = new Uint8Array(n); for (let i = 0; i < n; i++) fixedF[i] = held[i];
    const { eq, N, top } = numbering(n, elems, 1, fixedF);
    let q = cab.map((i) => (+M.groups[M.members[i].g].T0 || 1) / Math.max(1e-6, dist(X[M.members[i].a], X[M.members[i].b])));
    let move = Infinity, it = 0;
    for (; it < (opts.iters || 60) && move > 1e-7; it++) {
      const K = new Skyline(N, top), B = [new Float64Array(N), new Float64Array(N), new Float64Array(N)];
      const loads = opts.dead ? caseLoads({ ...M, nodes: X }, X).D : new Float64Array(3 * n);
      for (let i = 0; i < n; i++) if (eq[i] >= 0) for (let k = 0; k < 3; k++) B[k][eq[i]] += loads[3 * i + k];
      cab.forEach((mi, j) => {
        const { a, b } = M.members[mi], qa = eq[a], qb = eq[b], w = q[j];
        if (qa >= 0) K.add(qa, qa, w); if (qb >= 0) K.add(qb, qb, w); if (qa >= 0 && qb >= 0) K.add(qa, qb, -w);
        if (qa >= 0 && qb < 0) for (let k = 0; k < 3; k++) B[k][qa] += w * X[b][k];
        if (qb >= 0 && qa < 0) for (let k = 0; k < 3; k++) B[k][qb] += w * X[a][k];
      });
      try { K.factor(); } catch (e) { const node = [...eq].indexOf(e.dof); throw Object.assign(new Error('A joint in the net is not held by any cable that leads to a support.'), { node }); }
      const sol = B.map((b) => K.solve(b));
      move = 0; for (let i = 0; i < n; i++) if (eq[i] >= 0) for (let k = 0; k < 3; k++) { const v = sol[k][eq[i]]; move = Math.max(move, Math.abs(v - X[i][k])); X[i][k] = v; }
      if (opts.uniform === true) q = cab.map((mi) => (+M.groups[M.members[mi].g].T0 || 1) / Math.max(1e-6, dist(X[M.members[mi].a], X[M.members[mi].b])));
      move /= Math.max(1, spanOf(X));
    }
    // final forces from the last solve: N = q L (equilibrium is exact for these)
    const N0 = new Map(); cab.forEach((mi, j) => N0.set(mi, q[j] * dist(X[M.members[mi].a], X[M.members[mi].b])));
    // balance held joints that are not supports with their other members (least-norm solution)
    const loads = caseLoads({ ...M, nodes: X }, X).D; let balanced = 0, worst = 0, badSign = 0;
    for (let i = 0; i < n; i++) {
      if (!held[i] || M.supports.has(i)) continue;
      const R = [loads[3 * i], loads[3 * i + 1], loads[3 * i + 2]], cols = [];
      M.members.forEach((m, mi) => { if (m.a !== i && m.b !== i) return; const o = m.a === i ? m.b : m.a, d = [X[o][0] - X[i][0], X[o][1] - X[i][1], X[o][2] - X[i][2]], L = Math.hypot(...d), u = d.map((v) => v / L); if (N0.has(mi)) { for (let k = 0; k < 3; k++) R[k] += N0.get(mi) * u[k]; } else cols.push([mi, u]); });
      if (cols.length < 3) continue;
      const AAt = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (const [, u] of cols) for (let p = 0; p < 3; p++) for (let r = 0; r < 3; r++) AAt[p][r] += u[p] * u[r];
      const y = solve3(AAt, R.map((v) => -v)); if (!y) continue;
      for (const [mi, u] of cols) { const t = u[0] * y[0] + u[1] * y[1] + u[2] * y[2]; N0.set(mi, t); if (isCable[mi] && t < 0) badSign++; }
      balanced++;
    }
    const ts = [...N0.entries()].filter(([mi]) => isCable[mi]).map(([, t]) => t);
    return { X, N0, iters: it, balanced, badSign, Tmin: Math.min(...ts), Tmax: Math.max(...ts) };
  }
  const spanOf = (X) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (const p of X) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } return Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]); };
  function solve3(A, b) { const d = A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]); if (Math.abs(d) < 1e-12) return null; const r = (c) => { const m = A.map((row, i) => row.map((v, j) => (j === c ? b[i] : v))); return (m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])) / d; }; return [r(0), r(1), r(2)]; }

  function analyse(M, opts) { return kindOf(M) === 'cable' ? nonlinear(M, opts) : linear(M, opts); }

  // ---------------- sample models ----------------
  // prestressed four-point saddle net (cables along the two curvature directions), edge cables, four guyed masts — the default
  function sampleNet() {
    const N = 14, h = 1.0, a = N * h, Hh = 10, Hl = 4, zc = (Hh + Hl) / 2, k = (Hh - Hl) / (2 * a * a), segs = [], faces = [];
    const inside = (i, j) => Math.abs(i) + Math.abs(j) <= N, P = (i, j) => [i * h, j * h, zc + k * ((i * h) ** 2 - (j * h) ** 2)];
    for (let j = -N; j <= N; j++) for (let i = -N; i <= N; i++) {
      if (!inside(i, j)) continue;
      if (inside(i + 1, j)) segs.push({ a: P(i, j), b: P(i + 1, j), g: 0 });
      if (inside(i, j + 1)) segs.push({ a: P(i, j), b: P(i, j + 1), g: 0 });
      // edge cables along the diamond's sides
      for (const [di, dj] of [[1, 1], [1, -1]]) if (Math.abs(i) + Math.abs(j) === N && inside(i + di, j + dj) && Math.abs(i + di) + Math.abs(j + dj) === N) segs.push({ a: P(i, j), b: P(i + di, j + dj), g: 1 });
      const q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].filter(([x, y]) => inside(x, y));
      if (q.length === 4) faces.push([P(i, j), P(i + 1, j), P(i + 1, j + 1)], [P(i, j), P(i + 1, j + 1), P(i, j + 1)]);
      else if (q.length === 3) faces.push(q.map(([x, y]) => P(x, y)));
    }
    for (const [i, j] of [[N, 0], [0, N], [-N, 0], [0, -N]]) {
      const c = P(i, j), ux = Math.sign(i), uy = Math.sign(j), back = c[2] * 0.75;
      segs.push({ a: [c[0], c[1], 0], b: c, g: 2 });                                                                       // mast
      const side = [-uy, ux];   // the two guys spread either side of the outward direction
      for (const s of [1, -1]) segs.push({ a: c, b: [c[0] + (ux + s * side[0] * 0.7) * back, c[1] + (uy + s * side[1] * 0.7) * back, 0], g: 3 });
    }
    const M = build(segs, faces, 0.001);
    M.groups = [
      { name: 'Net cables', kind: 'cable', mat: { ...MATERIALS.cable }, matId: 'cable', sec: secById('cab20'), secId: 'cab20', T0: 25 },
      { name: 'Edge cables', kind: 'cable', mat: { ...MATERIALS.cable }, matId: 'cable', sec: secById('cab52'), secId: 'cab52', T0: 300 },
      { name: 'Masts', kind: 'truss', mat: { ...MATERIALS.steel }, matId: 'steel', sec: secById('chs323.9x12'), secId: 'chs323.9x12', T0: 0 },
      { name: 'Guy cables', kind: 'cable', mat: { ...MATERIALS.cable }, matId: 'cable', sec: secById('cab52'), secId: 'cab52', T0: 200 },
    ];
    M.supports = new Map(); M.nodes.forEach((p, i) => { if (Math.abs(p[2]) < 1e-6) M.supports.set(i, 'pinned'); });
    M.area = { D: 0.15, L: 1.0 }; M.point = [];
    const ff = findForm(M, { dead: true });
    M.nodes = ff.X; M.members.forEach((m, i) => { if (ff.N0.has(i)) m.N0 = ff.N0.get(i); });
    M.formFound = ff;
    M.name = 'Sample: four-point saddle cable net on guyed masts';
    return M;
  }
  // steel gridshell vault on eight columns (linear frame)
  function sampleGrid() {
    const n = 10, a = 10, segs = [], faces = [], z = (u, v) => 5 + 2 * (1 - u * u) + 2 * (1 - v * v) - (1 - u * u) * (1 - v * v), P = (i, j) => { const u = -1 + 2 * i / n, v = -1 + 2 * j / n; return [u * a, v * a, z(u, v)]; };
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const edge = (k) => k === 0 || k === n;
      if (i < n) segs.push({ a: P(i, j), b: P(i + 1, j), g: edge(j) ? 1 : 0 });
      if (j < n) segs.push({ a: P(i, j), b: P(i, j + 1), g: edge(i) ? 1 : 0 });
      if (i < n && j < n) { segs.push((i + j) % 2 ? { a: P(i, j), b: P(i + 1, j + 1), g: 2 } : { a: P(i + 1, j), b: P(i, j + 1), g: 2 }); faces.push([P(i, j), P(i + 1, j), P(i + 1, j + 1)], [P(i, j), P(i + 1, j + 1), P(i, j + 1)]); }
    }
    for (const [x, y] of [[-a, -a], [a, -a], [a, a], [-a, a], [0, -a], [a, 0], [0, a], [-a, 0]]) segs.push({ a: [x, y, 0], b: [x, y, z(x / a, y / a)], g: 3 });
    const M = build(segs, faces, 0.001);
    M.groups = [
      { name: 'Grid members', kind: 'frame', mat: { ...MATERIALS.steel }, matId: 'steel', sec: secById('chs168.3x8'), secId: 'chs168.3x8', T0: 0 },
      { name: 'Edge arches', kind: 'frame', mat: { ...MATERIALS.steel }, matId: 'steel', sec: secById('chs273x10'), secId: 'chs273x10', T0: 0 },
      { name: 'Diagonals', kind: 'frame', mat: { ...MATERIALS.steel }, matId: 'steel', sec: secById('chs114.3x6'), secId: 'chs114.3x6', T0: 0 },
      { name: 'Columns', kind: 'frame', mat: { ...MATERIALS.steel }, matId: 'steel', sec: secById('chs323.9x12'), secId: 'chs323.9x12', T0: 0 },
    ];
    M.supports = new Map(); M.nodes.forEach((p, i) => { if (Math.abs(p[2]) < 1e-6) M.supports.set(i, 'fixed'); });
    M.area = { D: 0.5, L: 1.0 }; M.point = [];
    M.name = 'Sample: steel gridshell vault on eight columns';
    return M;
  }

  // ---------------- benchmarks against closed-form answers ----------------
  function benchmarks() {
    const out = [], rel = (a, b) => Math.abs(a - b) / Math.abs(b);
    const steel = { ...MATERIALS.steel, rho: 0 }, sec = secById('chs168.3x8');
    const mk = (segs, kind, s = sec, mat = steel) => { const M = build(segs); M.groups = [{ name: 'g', kind, mat, sec: s, T0: 0 }]; M.supports = new Map(); M.area = { D: 0, L: 0 }; M.point = []; return M; };
    // 1 cantilever, tip load: PL³/3EI
    { const L = 4, P = 10, M = mk([{ a: [0, 0, 0], b: [L, 0, 0] }], 'frame'); M.supports.set(0, 'fixed'); M.point.push({ n: 1, c: 'D', F: [0, 0, -P] }); const r = linear(M).combos.D, got = -r.disp[3 * 1 + 2], exp = P * L ** 3 / (3 * steel.E * sec.Iy); out.push({ name: 'Cantilever, tip load: PL³/3EI', exp, got, err: rel(got, exp), unit: 'm' }); }
    // 2 simply supported, mid load: PL³/48EI and M = PL/4
    { const L = 6, P = 20, M = mk([{ a: [0, 0, 0], b: [L / 2, 0, 0] }, { a: [L / 2, 0, 0], b: [L, 0, 0] }], 'frame'); const ends = M.nodes.map((p, i) => [p[0], i]).sort((a, b) => a[0] - b[0]); M.supports.set(ends[0][1], 'pinned'); M.supports.set(ends[2][1], 'roller'); M.groups[0].sec = { ...sec }; const mid = ends[1][1]; M.point.push({ n: mid, c: 'D', F: [0, 0, -P] });
      M.supports.set(ends[0][1], [1, 1, 1, 1, 0, 0]); M.supports.set(ends[2][1], [0, 1, 1, 0, 0, 0]); const r0 = (() => { try { return linear(M).combos.D; } catch (e) { return null; } })();
      if (r0) { const got = -r0.disp[3 * mid + 2], exp = P * L ** 3 / (48 * steel.E * sec.Iy); out.push({ name: 'Simply supported beam, center load: PL³/48EI', exp, got, err: rel(got, exp), unit: 'm' }); const Mg = Math.max(...r0.members.map((m) => m.M)); out.push({ name: 'Same beam, bending moment: PL/4', exp: P * L / 4, got: Mg, err: rel(Mg, P * L / 4), unit: 'kN·m' }); } }
    // 2b same beam, uniform load as a member line load: 5wL⁴/384EI (loads lumped on 8 pieces) and wL²/8
    { const L = 6, w = 5, M = mk([{ a: [0, 0, 0], b: [L / 2, 0, 0] }, { a: [L / 2, 0, 0], b: [L, 0, 0] }], 'frame'); const ends = M.nodes.map((p, i) => [p[0], i]).sort((a, b) => a[0] - b[0]); M.supports.set(ends[0][1], [1, 1, 1, 1, 0, 0]); M.supports.set(ends[2][1], [0, 1, 1, 0, 0, 0]); M.groups[0].wD = w;
      const r = linear(M).combos.D, mid = ends[1][1], got = -r.disp[3 * mid + 2], exp = 5 * w * L ** 4 / (384 * steel.E * sec.Iy); out.push({ name: 'Uniform load on a beam: 5wL⁴/384EI', exp, got, err: rel(got, exp), unit: 'm' }); const Mg = Math.max(...r.members.map((m) => m.M)); out.push({ name: 'Same beam, bending moment: wL²/8', exp: w * L * L / 8, got: Mg, err: rel(Mg, w * L * L / 8), unit: 'kN·m' }); }
    // 2c cantilever under its own uniform load, sloping member: wL⁴/8EI and wL²/2 (checks rotated axes)
    { const L = 5, w = 4, c = Math.cos(0.5), sn = Math.sin(0.5), M = mk([{ a: [0, 0, 0], b: [L * c, L * sn, 0] }], 'frame'); M.supports.set(0, 'fixed'); M.groups[0].wD = w; const r = linear(M).combos.D, got = -r.disp[3 * 1 + 2], exp = w * L ** 4 / (8 * steel.E * sec.Iy); out.push({ name: 'Cantilever, uniform load: wL⁴/8EI', exp, got, err: rel(got, exp), unit: 'm' }); const Mg = Math.max(...r.members.map((m) => m.M)); out.push({ name: 'Same cantilever, root moment: wL²/2', exp: w * L * L / 2, got: Mg, err: rel(Mg, w * L * L / 2), unit: 'kN·m' }); }
    // 3 two-bar truss: N = P / (2 sin θ)
    { const P = 50, h = 3, b = 4, M = mk([{ a: [-b, 0, 0], b: [0, 0, h] }, { a: [b, 0, 0], b: [0, 0, h] }, { a: [0, 0, h], b: [0, 5, h] }], 'truss'); M.nodes.forEach((p, i) => { if (Math.abs(p[2]) < 1e-9 || p[1] > 4) M.supports.set(i, 'pinned'); }); const top = M.nodes.findIndex((p) => p[1] === 0 && p[2] === h); M.point.push({ n: top, c: 'D', F: [0, 0, -P] }); const r = linear(M).combos.D, got = Math.abs(r.members[0].N), exp = P / (2 * h / Math.hypot(b, h)); out.push({ name: 'Two-bar truss, bar force: P / (2 sin θ)', exp, got, err: rel(got, exp), unit: 'kN' }); const Rz = r.Rsum[2]; out.push({ name: 'Equilibrium: sum of reactions = load', exp: P, got: Rz, err: rel(Rz, P), unit: 'kN' }); }
    // 4 V-cable with pretension under a center load (large displacement, solved by hand with bisection)
    { const a = 5, P = 30, cab = secById('cab16'), mat = { ...MATERIALS.cable, rho: 0 }, EA = mat.E * cab.A, T0 = 10; const M = mk([{ a: [-a, 0, 0], b: [0, 0, 0] }, { a: [0, 0, 0], b: [a, 0, 0] }], 'cable', cab, mat); M.groups[0].T0 = T0; M.nodes.forEach((p, i) => { if (Math.abs(p[0]) > 1) M.supports.set(i, 'pinned'); }); const mid = M.nodes.findIndex((p) => Math.abs(p[0]) < 1e-9);
      // hold the middle node sideways (y) by symmetry is automatic; add point load
      M.point.push({ n: mid, c: 'D', F: [0, 0, -P] });
      const L0 = a / (1 + T0 / EA), f = (w) => { const L = Math.hypot(a, w), T = EA * (L - L0) / L0; return 2 * T * w / L - P; }; let lo = 0, hi = a; for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; } const exp = (lo + hi) / 2;
      try { const r = nonlinear(M).combos.D, got = -r.disp[3 * mid + 2]; out.push({ name: 'Pretensioned cable, center load (large deflection)', exp, got, err: rel(got, exp), unit: 'm' }); } catch (e) { out.push({ name: 'Pretensioned cable, center load', exp, got: NaN, err: 1, unit: 'm' }); } }
    // 5 hanging chain by force density: sag = w L² / (8 H)
    { const n = 20, L = 20, w = 2, Hh = 40, segs = []; for (let i = 0; i < n; i++) segs.push({ a: [i * L / n, 0, 0], b: [(i + 1) * L / n, 0, 0] }); const M = mk(segs, 'cable', secById('cab16'), { ...MATERIALS.cable, rho: 0 }); M.nodes.forEach((p, i) => { if (p[0] < 1e-9 || p[0] > L - 1e-9) M.supports.set(i, 'pinned'); else M.point.push({ n: i, c: 'D', F: [0, 0, -w * L / n] }); });
      const q = Hh / (L / n); M.groups[0].T0 = Hh; const ff = findForm(M, { dead: true, uniform: false, iters: 1 }), mid = M.nodes.findIndex((p) => Math.abs(p[0] - L / 2) < 1e-9), got = -ff.X[mid][2], exp = w * L * L / (8 * Hh); void q; out.push({ name: 'Hanging cable by force density: wL²/8H', exp, got, err: rel(got, exp), unit: 'm' }); }
    // 6 member end releases: a beam on fixed supports with both ends pinned is simply supported: 5wL⁴/384EI, wL²/8
    { const L = 6, w = 5, M = mk([{ a: [0, 0, 0], b: [L, 0, 0] }], 'frame'); M.supports.set(0, 'fixed'); M.supports.set(1, 'fixed'); M.groups[0].wD = w; M.groups[0].rel = 'both';
      const r = linear(M), c = r.combos.D, mid = r.memberNodes[0][2], got = -c.dispAll[3 * mid + 2], exp = 5 * w * L ** 4 / (384 * steel.E * sec.Iy); out.push({ name: 'Pinned member ends on fixed supports: 5wL⁴/384EI', exp, got, err: rel(got, exp), unit: 'm' }); out.push({ name: 'Same beam, bending moment: wL²/8', exp: w * L * L / 8, got: c.members[0].M, err: rel(c.members[0].M, w * L * L / 8), unit: 'kN·m' }); }
    // 7 propped cantilever by a release at one end: far reaction 3wL/8, fixed-end moment wL²/8
    { const L = 5, w = 4, M = mk([{ a: [0, 0, 0], b: [L, 0, 0] }], 'frame'); M.supports.set(0, 'fixed'); M.supports.set(1, 'fixed'); M.groups[0].wD = w; M.groups[0].rel = 'b';
      const c = linear(M).combos.D, Rb = c.reac.get(1)[2]; out.push({ name: 'Propped cantilever (release at one end): reaction 3wL/8', exp: 3 * w * L / 8, got: Rb, err: rel(Rb, 3 * w * L / 8), unit: 'kN' }); out.push({ name: 'Same, fixed-end moment wL²/8', exp: w * L * L / 8, got: c.members[0].Mend, err: rel(c.members[0].Mend, w * L * L / 8), unit: 'kN·m' }); }
    // 8 portal frame with a rigid beam, sway under a lateral load: Δ = H h³ / (24 E I) for two fixed-base columns
    { const h = 3.5, b = 6, H = 20, rigid = { ...sec, A: 1e4, Iy: 1e4, Iz: 1e4, J: 1e4 }, M = build([{ a: [0, 0, 0], b: [0, 0, h], g: 0 }, { a: [b, 0, 0], b: [b, 0, h], g: 0 }, { a: [0, 0, h], b: [b, 0, h], g: 1 }]);
      M.groups = [{ name: 'c', kind: 'frame', mat: steel, sec: { ...sec, A: 1e4 } }, { name: "b", kind: "frame", mat: steel, sec: rigid }]; /* columns axially rigid, as the formula assumes */ M.supports = new Map(); M.area = { D: 0, L: 0 }; M.point = [];
      M.nodes.forEach((p, i) => { if (p[2] === 0) M.supports.set(i, 'fixed'); }); const top = M.nodes.findIndex((p) => p[0] === 0 && p[2] === h); M.point.push({ n: top, c: 'D', F: [H, 0, 0] });
      const c = linear(M).combos.D, got = c.disp[3 * top], I = sec.Iy, exp = H * h ** 3 / (24 * steel.E * I); out.push({ name: 'Portal frame sway, rigid beam: Hh³/24EI', exp, got, err: rel(got, exp), unit: 'm' }); }
    // 9 braced frame, pinned beam and bases, one diagonal: brace force = H / cos θ, and the lateral reactions add up to H
    { const h = 3, b = 4, H = 30, M = build([{ a: [0, 0, 0], b: [0, 0, h], g: 0 }, { a: [b, 0, 0], b: [b, 0, h], g: 0 }, { a: [0, 0, h], b: [b, 0, h], g: 1 }, { a: [0, 0, 0], b: [b, 0, h], g: 2 }]);
      M.groups = [{ name: 'c', kind: 'frame', mat: steel, sec }, { name: 'b', kind: 'frame', mat: steel, sec, rel: 'both' }, { name: 'd', kind: 'truss', mat: steel, sec }]; M.supports = new Map(); M.area = { D: 0, L: 0 }; M.point = [];
      M.nodes.forEach((p, i) => { if (p[2] === 0) M.supports.set(i, [1, 1, 1, 1, 0, 1]); }); const top = M.nodes.findIndex((p) => p[0] === 0 && p[2] === h); M.point.push({ n: top, c: 'W', F: [H, 0, 0] });   // pinned in the frame's plane, held out of plane
      const r = linear(M), c = r.combos.D, cw = r.cases.W, di = M.members.findIndex((m) => M.groups[m.g].kind === 'truss'), got = Math.abs(cw.members[di].N), exp = H * Math.hypot(b, h) / b; void c;
      out.push({ name: 'Braced frame with pinned beam: brace force H / cos θ', exp, got, err: rel(got, exp), unit: 'kN' }); out.push({ name: 'Same frame: horizontal reactions add up to H', exp: H, got: -cw.Rsum[0], err: rel(-cw.Rsum[0], H), unit: 'kN' }); }
    // 9b a member in one piece: exact midspan deflection 5wL⁴/384EI from end rotations, also with pinned ends
    { const L = 6, w = 5, M = mk([{ a: [0, 0, 0], b: [L, 0, 0] }], 'frame'); M.supports.set(0, 'fixed'); M.supports.set(1, 'fixed'); M.groups[0].wD = w; M.groups[0].rel = 'both';
      const c = linear(M, { nSub: 1 }).combos.D, exp = 5 * w * L ** 4 / (384 * steel.E * sec.Iy); out.push({ name: 'One-piece member, pinned ends: midspan deflection 5wL⁴/384EI', exp, got: c.members[0].dmid, err: rel(c.members[0].dmid, exp), unit: 'm' }); }
    // 10 superposition: an NBC combination equals a direct solve of the factored loads
    { const L = 6, M = mk([{ a: [0, 0, 0], b: [L, 0, 0] }], 'frame'); M.supports.set(0, 'fixed'); M.groups[0].wD = 3; M.members[0].w = { L: 2, S: 1.5 }; M.point.push({ n: 1, c: 'Wx', F: [0, 0, -4] });
      const r = linear(M), u2 = r.combos.U2.disp[5], M2 = mk([{ a: [0, 0, 0], b: [L, 0, 0] }], 'frame'); M2.supports.set(0, 'fixed'); M2.groups[0].wD = 3 * 1.25 + 2 * 1.5 + 1.5 * 1.0; const d = linear(M2).combos.D.disp[5];
      out.push({ name: 'Combination 1.25D + 1.5L + 1.0S = direct factored solve', exp: d, got: u2, err: rel(u2, d), unit: 'm' }); }
    return out;
  }

  return { lineLoad, caseNames, combosFor, relOf, MATERIALS, SECTIONS, secById, build, components, caseLoads, tributary, COMBOS, missing, kindOf, linear, nonlinear, findForm, analyse, sampleNet, sampleGrid, benchmarks, dist, Skyline };
})();
if (typeof module !== 'undefined') module.exports = SA;
globalThis.PlotCloudStructuralSolver = SA;
