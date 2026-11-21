// The structure laid out from the walls, analysed as a 3D frame (2026-11-18). Pure functions; the solver is passed in
// (emb/lib/structural-solver.js, PlotCloudStructuralSolver), so the same code runs in the browser, in a worker and in Node.
// Model: nodes at the grid crossings on every floor; columns between floors where the layout has them; beams along the grid lines
// (steel, timber), or, for a concrete flat plate, slab strips of the tributary width (an equivalent-frame simplification); braces
// pinned at both ends; column bases fixed (or pinned); bearing walls as supports along their line (not modelled as plates).
// Loads: D (self-weight + floor dead load on the beams and strips by tributary width), L (occupancy), S (roof snow), and wind along
// each plan axis (Wx, Wy) with a notional 0.5 % of gravity. Combinations: the solver's NBC 2020 set. Linear static, screening only.

const STEEL_COL = ['rhs100x100x6', 'rhs127x127x8', 'rhs150x150x8', 'rhs178x178x10', 'rhs200x200x10', 'w250x89'];
const STEEL_BEAM = ['w150x30', 'w200x46', 'w250x58', 'w310x60', 'w360x79', 'w410x67', 'w460x89', 'w530x92', 'w610x125', 'w690x170'];
const BRACE = { steel: 'chs114.3x6', concrete: 'chs114.3x6', timber: 'glu130x304' };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len3 = (v) => Math.hypot(v[0], v[1], v[2]), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const l = len3(v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// a rectangle's section properties (m), as the solver's own rect() but for any size
function rectSec(b, h, name) { const a = Math.max(b, h), c = Math.min(b, h), J = a * c ** 3 * (1 / 3 - 0.21 * c / a * (1 - c ** 4 / (12 * a ** 4))); return { id: name, name, b, h, A: b * h, Iy: b * h ** 3 / 12, Iz: h * b ** 3 / 12, J, Wy: b * h * h / 6, Wz: h * b * b / 6, r: Math.sqrt(Math.min(b * h ** 3, h * b ** 3) / 12 / (b * h)), shape: 'rect' }; }
const pick = (SA, ids, needA, needW = 0) => ids.map((id) => SA.secById(id)).filter(Boolean).find((s) => s.A >= needA && (!needW || (s.Wy || 0) >= needW)) || SA.secById(ids.at(-1));

/**
 * @param L layoutStructure() result
 * @param o { system, span, depthOf, deadOf, live, snow, wind: { q (kPa) }, braces: [{dir:'u'|'v', line, bay, level, kind:'/'|'X'}], base: 'fixed'|'pinned' }
 * @param SA the solver
 */
export function buildFrame(L, o, SA) {
  const sys = o.system || L.system || 'concrete', levels = L.levels, nL = levels.length, AU = L.axes.u, AV = L.axes.v, G = (u, v) => L.glob([u, v]);
  const deadOf = o.deadOf || ((sp) => 24 * Math.max(0.2, sp / 30) + 1.5), depthOf = o.depthOf || ((sp) => Math.max(0.2, sp / 30)), live = o.live ?? 1.9, snow = o.snow ?? 1.0;
  // which grid crossing carries a floor at the top of level k (the floor of level k+1, or the roof): any bay round it on level k
  const has = new Map(), bayAt = new Map(); for (const b of L.bays) for (const lv of b.levels) { bayAt.set(`${b.i},${b.j},${lv}`, b); for (const [a, c] of [[0, 0], [1, 0], [0, 1], [1, 1]]) has.set(`${b.i + a},${b.j + c},${lv}`, true); }
  const nodes = [], nodeOf = new Map(), node = (i, j, k, top) => { const key = `${i},${j},${k},${top ? 1 : 0}`; if (nodeOf.has(key)) return nodeOf.get(key); const lv = levels[k], z = top ? lv.z + lv.h : lv.z, p = G(AU[i].c, AV[j].c); nodes.push([p[0], p[1], z]); nodeOf.set(key, nodes.length - 1); return nodes.length - 1; };
  // the top of level k and the bottom of level k+1 are the same floor
  const at = (i, j, k, top) => (top || k === 0 ? node(i, j, k, top) : node(i, j, k - 1, true));
  const groups = [], members = [], meta = [], supports = new Map(), point = [];
  const matOf = { concrete: SA.MATERIALS.concrete, steel: SA.MATERIALS.steel, timber: SA.MATERIALS.glulam };
  const group = (kind, sec, mat, extra = {}) => { groups.push({ kind, sec, mat, ...extra }); return groups.length - 1; };
  // bearing walls: the nodes on them are held where the wall stands below them
  const wallAt = (k, p) => L.walls.find((w) => w.lv === levels[k].id && segD(p, w.a, w.b) <= Math.max(0.2, (w.t || 0.2) / 2 + 0.15));
  // columns, storey by storey, from the layout's column runs
  for (const c of L.cols) { const i = c.node.i, j = c.node.j, mat = matOf[sys];
    const sec = sys === 'steel' ? pick(SA, STEEL_COL, c.A * 1.2) : rectSec(c.size, c.size, `${Math.round(c.size * 1000)}×${Math.round(c.size * 1000)}`);
    const g = group('frame', sec, mat);
    for (let k = 0; k < nL; k++) { const lv = levels[k]; if (lv.z + 1e-6 < c.z0 || lv.z + lv.h > c.z1 + 1e-6) continue;
      const a = at(i, j, k, false), b = node(i, j, k, true); members.push({ a, b, g }); meta.push({ kind: 'column', label: `Column ${c.axis}`, level: lv.name, lv: lv.id, sec: sec.name || sec.id });
      if (k === 0 || Math.abs(lv.z - levels[0].z) < 1e-6) supports.set(a, o.base === 'pinned' ? 'pinned' : 'fixed'); } }
  // floor members along every grid line on the top of each level: beams, or slab strips for a flat plate
  const strips = sys === 'concrete', mat0 = { ...SA.MATERIALS.concrete, rho: 0 };   // strips carry the slab as load, not as self-weight twice
  const lineMembers = (dirU) => { const A = dirU ? AU : AV, B = dirU ? AV : AU;
    for (let k = 0; k < nL; k++) for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length - 1; j++) {
      const I = dirU ? i : j, J = dirU ? j : i, I2 = dirU ? i : j + 1, J2 = dirU ? j + 1 : i;
      if (!has.get(`${I},${J},${levels[k].id}`) || !has.get(`${I2},${J2},${levels[k].id}`)) continue;
      // the bays on either side of this stretch on this level, for the tributary width
      const side = [-1, 0].map((d) => { const bi = dirU ? i + d : j, bj = dirU ? j : i + d; return bayAt.get(`${bi},${bj},${levels[k].id}`); }).filter(Boolean); if (!side.length) continue;
      // the floor of each bay is shared between its two directions (two-way, Rankine–Grashof: by the inverse fourth power of the span), so
      // a bay's load is counted once in all: the members along this line take their direction's share of half of each bay beside them
      const share = (b) => { const along = dirU ? b.dv : b.du, across = dirU ? b.du : b.dv; return (1 / along ** 4) / (1 / along ** 4 + 1 / across ** 4); };
      const span = Math.abs(B[j + 1].c - B[j].c), trib = side.reduce((s, b) => s + (dirU ? b.du : b.dv) / 2 * share(b), 0), tribW = side.reduce((s, b) => s + (dirU ? b.du : b.dv) / 2, 0), top = k === nL - 1, D = deadOf(span) * trib, Lq = top ? 0 : live * trib, S = top ? snow * trib : 0;
      const a = node(I, J, k, true), b = node(I2, J2, k, true);
      let g; if (strips) { const t = depthOf(span), w = Math.max(0.6, tribW / 2); g = group('frame', rectSec(w, t, `slab strip ${Math.round(w * 1000)}×${Math.round(t * 1000)}`), mat0); }
      else { const lb = L.beams.find((bm) => bm.level === levels[k].id && Math.abs(bm.span - span) < 0.05 && Math.hypot(...sub([...bm.a, 0], [...nodes[a].slice(0, 2), 0])) + Math.hypot(...sub([...bm.b, 0], [...nodes[b].slice(0, 2), 0])) < 0.2);
        const h = lb ? lb.h : span / (sys === 'steel' ? 20 : 15), w = lb ? lb.w : Math.max(0.13, h / 3);
        g = group('frame', sys === 'steel' ? pick(SA, STEEL_BEAM, 0, ((1.25 * D + 1.5 * Lq) * span * span / 8) / (0.9 * 350e3) * 1.0) : rectSec(w, h, `glulam ${Math.round(w * 1000)}×${Math.round(h * 1000)}`), matOf[sys]); }
      members.push({ a, b, g, w: { D, L: Lq, S } }); meta.push({ kind: strips ? 'strip' : 'beam', label: `${strips ? 'Slab strip' : 'Beam'} ${(dirU ? A[i].name : A[i].name)} ${B[j].name}–${B[j + 1].name}`, level: levels[k].name, lv: levels[k].id, sec: groups[g].sec.name || groups[g].sec.id, span }); } };
  lineMembers(true); lineMembers(false);
  // the floors as diaphragms: each bay of each floor gets two stiff in-plane diagonals (axial only, weightless, not drawn), so wind
  // reaches the braced and stiffer frames as it does through a real slab
  { const dg = group('truss', rectSec(1.0, 0.15, 'floor diaphragm'), { ...SA.MATERIALS.concrete, rho: 0 });
    for (const b of L.bays) for (const lvId of b.levels) { const k = levels.findIndex((l) => l.id === lvId); if (k < 0) continue; const n00 = node(b.i, b.j, k, true), n11 = node(b.i + 1, b.j + 1, k, true), n10 = node(b.i + 1, b.j, k, true), n01 = node(b.i, b.j + 1, k, true);
      for (const [a, c] of [[n00, n11], [n10, n01]]) { members.push({ a, b: c, g: dg }); meta.push({ kind: 'diaphragm', label: 'Floor diaphragm', level: levels[k].name, lv: levels[k].id, sec: 'floor diaphragm', hidden: true }); } } }
  // braces: in a bay of a grid line, between two floors
  for (const br of o.braces || []) { const A = br.dir === 'u' ? AU : AV, B = br.dir === 'u' ? AV : AU, i = A.findIndex((x) => x.name === br.line), j = br.bay, k = levels.findIndex((l) => l.id === br.level);
    if (i < 0 || j < 0 || j >= B.length - 1 || k < 0) continue; const ij = (jj) => (br.dir === 'u' ? [i, jj] : [jj, i]);
    const [i0, j0] = ij(j), [i1, j1] = ij(j + 1), bot0 = at(i0, j0, k, false), bot1 = at(i1, j1, k, false), top0 = node(i0, j0, k, true), top1 = node(i1, j1, k, true);
    const g = group('truss', SA.secById(BRACE[sys]), matOf[sys === 'timber' ? 'timber' : 'steel']);   // pinned at both ends: axial force only
    for (const [a, b] of br.kind === 'X' ? [[bot0, top1], [bot1, top0]] : [[bot0, top1]]) { members.push({ a, b, g }); meta.push({ kind: 'brace', label: `Brace ${br.line} ${B[j].name}–${B[j + 1].name}`, level: levels[k].name, lv: levels[k].id, sec: groups[g].sec.name, brace: br }); } }
  // bearing walls under a floor node: a support there (vertical and horizontal; the wall's own stiffness is not modelled)
  for (const [key, n] of nodeOf) { const [i, j, k, top] = key.split(',').map(Number); if (!top) continue; const p = G(AU[i].c, AV[j].c); if (wallAt(k, p) && !supports.has(n)) supports.set(n, [1, 1, 1, 0, 0, 0]); }
  // wind: q (kPa) on the building's width, per floor, along each plan axis, spread over the floor's nodes; with 0.5 % of gravity
  const q = o.wind?.q ?? 0.6, ex = unit([...G(1, 0)].map((v, n) => v - G(0, 0)[n]).concat(0)), ey = unit([...G(0, 1)].map((v, n) => v - G(0, 0)[n]).concat(0));
  const widthU = L.extent.v1 - L.extent.v0, widthV = L.extent.u1 - L.extent.u0;
  for (let k = 0; k < nL; k++) { const lv = levels[k], top = [...nodeOf.entries()].filter(([key]) => { const s = key.split(','); return +s[2] === k && s[3] === '1'; }).map(([, n]) => n); if (!top.length) continue;
    const h = (lv.h + (levels[k + 1]?.h || 0)) / 2, gravity = L.bays.filter((b) => b.levels.includes(lv.id)).reduce((s, b) => s + b.area * (deadOf(b.span) + live), 0), notional = 0.005 * gravity;
    for (const [c, dir, width] of [['Wx', ex, widthU], ['Wy', ey, widthV]]) { const F = (q * width * h + notional) / top.length; for (const n of top) point.push({ n, c, F: [dir[0] * F, dir[1] * F, 0] }); } }
  // nothing may float: a column standing on nothing, or a piece of floor not reached by any column or wall, gets an assumed
  // support at its lowest node, and is listed (it needs a transfer structure or a support the drawing does not show)
  const assumed = [], frameDeg = new Array(nodes.length).fill(0), adj = nodes.map(() => []);
  members.forEach((m) => { adj[m.a].push(m.b); adj[m.b].push(m.a); if (groups[m.g].kind === 'frame') { frameDeg[m.a]++; frameDeg[m.b]++; } });
  const seen = new Uint8Array(nodes.length);
  for (let s0 = 0; s0 < nodes.length; s0++) { if (seen[s0] || !adj[s0].length) continue; const comp = [], st = [s0]; seen[s0] = 1; while (st.length) { const n = st.pop(); comp.push(n); for (const q of adj[n]) if (!seen[q]) { seen[q] = 1; st.push(q); } }
    if (!comp.some((n) => supports.has(n))) { const low = comp.reduce((a, b) => (nodes[b][2] < nodes[a][2] ? b : a)); supports.set(low, 'fixed'); assumed.push({ p: nodes[low], why: 'a part of the frame reaches no column base or wall' }); } }
  for (let n = 0; n < nodes.length; n++) if (!supports.has(n) && adj[n].length === 1 && frameDeg[n] === 1) { supports.set(n, 'pinned'); assumed.push({ p: nodes[n], why: 'a column or beam end with nothing under it' }); }
  const M = { nodes, members, groups, supports: [...supports.entries()], faces: [], area: { D: 0, L: 0, S: 0 }, point, self: true };
  return { M, meta, nodeOf, levels, assumed };
}
function segD(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]); }

// along each member: stations with N, V, T, M (and the side the moment diagram is drawn on) and the displacement, for one combination
export function stations(res, mi, comb) { const list = res.memberNodes[mi], out = [], X = res.X, U = comb.dispAll, P = comb.pieces || [];
  const els = res.elems.map((e, ei) => [e, ei]).filter(([e]) => e[2] === mi);
  els.forEach(([e, ei], s) => { const pc = P[ei]; if (!pc) return; const R = pc.R, f = pc.fl;
    const at = (end) => { const o = end ? 6 : 0, sg = end ? 1 : -1, S = [0, 1, 2, 3, 4, 5].map((k) => sg * f[o + k]), Mg = [0, 1, 2].map((k) => S[4] * R[1][k] + S[5] * R[2][k]), side = unit(cross(R[0], Mg)), n = end ? e[1] : e[0];
      return { p: X[n], d: [U[3 * n], U[3 * n + 1], U[3 * n + 2]], N: S[0], V: Math.hypot(S[1], S[2]), T: S[3], M: Math.hypot(S[4], S[5]), side: Number.isFinite(side[0]) ? side : [0, 0, 1] }; };
    if (s === 0) out.push(at(false)); out.push(at(true)); });
  void list; return out; }

/** analyse: build, solve, post-process. Returns everything the Workspace draws and lists. */
export function analyseFrame(L, o, SA) {
  const t0 = Date.now(), { M, meta, levels, assumed } = buildFrame(L, o, SA);
  if (!M.members.length) throw new Error('No members to analyse: the layout has no columns or beams.');
  const res = SA.linear(M, { nSub: 2, pieces: true }), list = res.list, ul = list.filter((c) => c.kind === 'ULS'), sl = list.filter((c) => c.kind === 'SLS');
  const C = res.combos, mx = (c, f) => Math.max(0, ...M.members.map((_, i) => f(C[c.id].members[i])));
  const govGrav = ul.filter((c) => !Object.keys(c.f).some((k) => k[0] === 'W')).sort((a, b) => mx(b, (r) => r.M) - mx(a, (r) => r.M))[0] || ul[0];
  const drift = (c) => { let worst = { r: 0 }; for (let k = 0; k < levels.length; k++) { const lv = levels[k]; M.nodes.forEach((p, n) => { if (Math.abs(p[2] - (lv.z + lv.h)) > 1e-6) return; const d = C[c.id].disp, dx = Math.hypot(d[3 * n], d[3 * n + 1]); const below = M.nodes.findIndex((q, m) => m !== n && Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6 && Math.abs(q[2] - lv.z) < 1e-6); const db = below >= 0 ? Math.hypot(d[3 * below], d[3 * below + 1]) : 0, r = Math.abs(dx - db) / lv.h; if (r > worst.r) worst = { r, level: lv.name, mm: Math.abs(dx - db) * 1000, h: lv.h, n }; }); } return worst; };
  const govWindU = ul.filter((c) => Object.keys(c.f).some((k) => k[0] === 'W')).sort((a, b) => mx(b, (r) => r.M) - mx(a, (r) => r.M))[0] || null;
  // (2026-11-21) a bearing wall under a floor is a rigid support sideways too, so once any floor rests on one the stiff floor
  // cannot sway and the drift says nothing (h/2,700,000 and the like): it is not reported, and the card says the walls hold it
  const wallHeld = M.supports.some(([n, t]) => Array.isArray(t) && M.nodes[n][2] > levels[0].z + 1e-6);
  const windSls = sl.filter((c) => Object.keys(c.f).some((k) => k[0] === 'W')), driftW = wallHeld ? null : windSls.map((c) => ({ c, ...drift(c) })).sort((a, b) => b.r - a.r)[0] || null;
  const showC = [govGrav, govWindU, sl.find((c) => c.id === 'S1') || sl[0], driftW?.c].filter(Boolean).filter((c, i, a) => a.findIndex((x) => x.id === c.id) === i);
  const env = C.ULS || C[govGrav.id];
  const members = M.members.map((m, i) => { const g = M.groups[m.g], r = env.members[i], s = g.sec, mat = g.mat, f = mat.fy || 30, A = s.A, Lm = len3(sub(M.nodes[m.b], M.nodes[m.a]));
    const allow = mat === SA.MATERIALS.steel || mat.name === SA.MATERIALS.steel.name ? 0.9 * f : mat.name === SA.MATERIALS.glulam.name ? 0.8 * f : 0.45 * f;   // screening strengths (MPa)
    const tau = r.V / A / 1000, vm = Math.sqrt(r.s * r.s + 3 * tau * tau), util0 = concreteUtil(meta[i].kind, s, mat, r, SA) ?? vm / allow, I = Math.min(s.Iy || 0, s.Iz || 0), Ncr = I > 0 ? Math.PI ** 2 * mat.E * I / (Lm * Lm) : Infinity;
    const comp = Math.max(0, -r.Nmin), defl = C[(sl.find((c) => c.id === 'S1') || sl[0]).id].members[i].dmid;
    return { ...meta[i], a: M.nodes[m.a], b: M.nodes[m.b], L: Lm, mat: mat.name, N: r.N, Nmin: r.Nmin, Nmax: r.Nmax, V: r.V, M: r.M, s: r.s, vm, util: util0, buckle: comp / (0.9 * Ncr), defl, deflRatio: defl > 1e-6 ? Lm / defl : Infinity, stations: Object.fromEntries(showC.map((c) => [c.id, stations(res, i, C[c.id])])) }; });
  const reacOf = (c) => [...C[c.id].reac.entries()].map(([n, v]) => ({ p: M.nodes[n], F: v.slice(0, 3), Mo: v.slice(3, 6) })), reac = reacOf(govGrav), reacW = govWindU ? reacOf(govWindU) : null;
  const sumL = C[govGrav.id].F, sumR = C[govGrav.id].Rsum, eqErr = Math.hypot(sumL[0] + sumR[0], sumL[1] + sumR[1], sumL[2] + sumR[2]) / Math.max(1, Math.abs(sumL[2]));
  return { members, combos: showC.map((c) => ({ id: c.id, name: c.name })), gov: { gravity: govGrav.id, wind: govWindU?.id || null, sls: (sl.find((c) => c.id === 'S1') || sl[0]).id, drift: driftW?.c.id || null },
    wallHeld, drift: driftW ? { ratio: driftW.r, hOver: driftW.r > 0 ? Math.round(1 / driftW.r) : Infinity, level: driftW.level, mm: driftW.mm } : null,
    reac, reacW, eq: { loads: sumL, reactions: sumR, err: eqErr }, counts: { nodes: M.nodes.length, members: M.members.length, unknowns: res.unknowns, columns: meta.filter((m) => m.kind === 'column').length, beams: meta.filter((m) => m.kind === 'beam' || m.kind === 'strip').length, braces: meta.filter((m) => m.kind === 'brace').length, diaphragm: meta.filter((m) => m.kind === 'diaphragm').length },
    supports: M.supports.map(([n, t]) => ({ p: M.nodes[n], t: Array.isArray(t) ? 'wall' : t })), assumed, method: res.method, ms: Date.now() - t0 };
}

// reinforced concrete, screened with typical steel (2026-11-18): slab strips and beams at 1 % (Mr = φs ρ fy b d² (1 − 0.59 ρ fy/f'c),
// d = 0.85 h), columns at 2 % (Pr = 0.8 (0.65·0.85 f'c Ac + 0.85 fy As)) with a straight-line N–M interaction; fy 400 MPa
function concreteUtil(kind, s, mat, r, SA) { if (mat.name !== SA.MATERIALS.concrete.name || !s.b || !s.h) return null; const fc = mat.fy || 30, fy = 400;
  const Mr = (rho, b, h) => { const d = 0.85 * h; return 0.85 * rho * fy * 1000 * b * d * d * (1 - 0.59 * rho * fy / fc); };
  if (kind === 'column') { const A = s.b * s.h, As = 0.02 * A, Pr = 0.8 * (0.65 * 0.85 * fc * (A - As) + 0.85 * fy * As) * 1000; return Math.max(0, -r.Nmin) / Pr + r.M / Mr(0.01, s.b, s.h); }
  return r.M / Mr(0.01, s.b, s.h); }

// the bays a brace can go in (for the picker and the ideas): every stretch of a grid line between two floors
export function braceBays(L) { const out = []; for (const [dir, A, B] of [['u', L.axes.u, L.axes.v], ['v', L.axes.v, L.axes.u]]) for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length - 1; j++) for (const lv of L.levels) {
  const ok = L.bays.some((b) => b.levels.includes(lv.id) && (dir === 'u' ? (b.i === i || b.i === i - 1) && b.j === j : (b.j === i || b.j === i - 1) && b.i === j)); if (!ok) continue;
  const p0 = L.glob(dir === 'u' ? [A[i].c, B[j].c] : [B[j].c, A[i].c]), p1 = L.glob(dir === 'u' ? [A[i].c, B[j + 1].c] : [B[j + 1].c, A[i].c]);
  out.push({ dir, line: A[i].name, bay: j, level: lv.id, levelName: lv.name, label: `${A[i].name} ${B[j].name}–${B[j + 1].name}, ${lv.name}`, a: [p0[0], p0[1], lv.z], b: [p1[0], p1[1], lv.z + lv.h] }); } return out; }
