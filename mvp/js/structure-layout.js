// A first structure laid out from the drawn walls (2026-11-17). Pure functions, no DOM: the Workspace Structure study calls
// layoutStructure() with the model's levels and walls and draws what comes back. Rules of thumb for early design only:
// - bearing walls: masonry, stone or concrete walls at least 150 mm thick (or the person's own choice per wall);
// - grid lines: every bearing wall line, then the partition lines that keep the spans within the target, then evenly added lines
//   where no wall is near; columns where grid lines cross and no bearing wall stands;
// - sizes: floor depth from the span, beams span/12 (concrete), span/20 (steel), span/15 (glulam), columns from the factored load,
//   the wall thickness the load needs against an assumed masonry or concrete strength.
// It is not structural design: no lateral system, no connections, no code checks.

const BEARING_MAT = /stone|masonry|brick|block|concrete|cmu|rammed|adobe/i, NEVER_MAT = /glass|glaz|gypsum|plaster|stud|timber-cladding|curtain/i;
// assumed factored compressive resistance of a bearing wall (MPa) and its density (kN/m³)
export const WALL_STRENGTH = { stone: [1.5, 23], masonry: [1.5, 20], concrete: [8, 24] };
const wallKind = (mat) => (/concrete/i.test(mat || '') ? 'concrete' : /stone|rammed|adobe/i.test(mat || '') ? 'stone' : 'masonry');
export const BEAM = { concrete: { ratio: 12, minW: 0.3, step: 0.05 }, steel: { ratio: 20, minW: 0.15, step: 0.01 }, timber: { ratio: 15, minW: 0.13, step: 0.045 } };
const GLULAM_W = [0.13, 0.175, 0.215, 0.265, 0.315, 0.365];

const len = (w) => Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)); return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]); };
const inPoly = (p, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1] || 1e-12) + a[0]) c = !c; } return c; };
const hull = (pts) => { const P = pts.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), p) <= 0) lo.pop(); lo.push(p); } for (const p of P.slice().reverse()) { while (hi.length >= 2 && cr(hi.at(-2), hi.at(-1), p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1)); };
const near = (q, P, tol) => inPoly(q, P) || P.some((a, i) => segDist(q, a, P[(i + 1) % P.length]) < tol);
export const axisName = (i, dir) => (dir === 'u' ? String(i + 1) : i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));
const r50 = (x, step = 0.05) => Math.ceil(x / step - 1e-9) * step;

// the plan's main direction: wall length by angle, modulo 90 degrees, in 1 degree bins (smoothed)
export function mainAngle(walls) {
  const bins = new Float64Array(90); for (const w of walls) { const L = len(w); if (L < 0.3) continue; let a = (Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]) * 180) / Math.PI; a = ((a % 90) + 90) % 90; bins[Math.round(a) % 90] += L; }
  let best = 0, k = 0; for (let i = 0; i < 90; i++) { const s = bins[i] + 0.5 * (bins[(i + 1) % 90] + bins[(i + 89) % 90]); if (s > best) { best = s; k = i; } }
  return (k * Math.PI) / 180; }

// which walls carry the floors: the person's choice first, then material and thickness, then whether it stands on something below
export function wallRoles(levels, walls, roles = {}, matOf = (w) => w.mat || '') {
  const lv = [...levels].sort((a, b) => a.z - b.z), idx = Object.fromEntries(lv.map((l, i) => [l.id, i])), out = {};
  const auto = (w) => { const m = matOf(w) || ''; if (NEVER_MAT.test(m)) return ['partition', /glass|glaz/i.test(m) ? 'glass' : `${m} (a lining or partition)`];
    if ((w.t || 0) < 0.15) return ['partition', `${Math.round((w.t || 0) * 1000)} mm thick, under 150 mm`];
    if (BEARING_MAT.test(m)) return ['bearing', `${m}, ${Math.round(w.t * 1000)} mm`];
    return ['partition', m ? `${m} is not a bearing material` : 'no material given']; };
  for (const w of walls) { if (w.bulge || !(w.lv in idx)) continue; const [role, why] = auto(w); out[w.id] = { role, why, auto: role, set: false }; }
  // a bearing wall on an upper level that stands on no bearing wall below is still bearing, but needs a transfer (flagged later)
  for (const w of walls) { const r = out[w.id]; if (!r) continue; if (roles[w.id] === 'bearing' || roles[w.id] === 'partition') { r.role = roles[w.id]; r.set = true; r.why = 'set by you'; } }
  return out;
}

// the share of wall w that stands over bearing walls of the level below (0..1)
function stacked(w, below, rolesOf) { const L = len(w); if (!below.length || L < 0.01) return 0; let on = 0; const n = Math.max(2, Math.ceil(L / 0.25));
  for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, p = [w.a[0] + t * (w.b[0] - w.a[0]), w.a[1] + t * (w.b[1] - w.a[1])]; if (below.some((v) => rolesOf(v) === 'bearing' && segDist(p, v.a, v.b) <= (v.t || 0.2) / 2 + 0.15)) on++; }
  return on / n; }

// choose the grid lines along one direction from candidate wall lines {c, w (length), bearing}
function chooseAxes(cands, lo, hi, span) {
  const cl = []; for (const c of cands.sort((a, b) => a.c - b.c)) { const last = cl.at(-1); if (last && c.c - last.c1 < 0.45) { last.c = (last.c * last.w + c.c * c.w) / (last.w + c.w); last.w += c.w; last.c1 = c.c; last.bearing ||= c.bearing; last.ids.push(...c.ids); } else cl.push({ ...c, c1: c.c, ids: [...c.ids] }); }
  // every bearing wall line of some length is a grid line; the outer lines are the extent
  const ax = cl.filter((c) => c.bearing && c.w >= 1.2).map((c) => ({ c: c.c, kind: 'bearing', ids: c.ids, w: c.w }));
  // lines closer than 1.2 m are one line: the one with more wall stays
  for (let k = 1; k < ax.length; k++) if (ax[k].c - ax[k - 1].c < 1.2) { const keep = ax[k].w > ax[k - 1].w ? ax[k] : ax[k - 1], gone = keep === ax[k] ? ax[k - 1] : ax[k]; keep.ids = [...keep.ids, ...gone.ids]; ax.splice(ax.indexOf(gone), 1); k--; }
  const has = (x) => ax.some((a) => Math.abs(a.c - x) < 1.2);
  if (!has(lo)) ax.push({ c: (cl.find((c) => Math.abs(c.c - lo) < 0.6) || { c: lo }).c, kind: cl.some((c) => Math.abs(c.c - lo) < 0.6) ? 'wall' : 'edge', ids: [] });
  if (!has(hi)) ax.push({ c: (cl.find((c) => Math.abs(c.c - hi) < 0.6) || { c: hi }).c, kind: cl.some((c) => Math.abs(c.c - hi) < 0.6) ? 'wall' : 'edge', ids: [] });
  ax.sort((a, b) => a.c - b.c);
  // fill the gaps longer than the span: the partition line farthest within reach, else evenly added lines
  for (let guard = 0; guard < 200; guard++) { let i = ax.findIndex((a, k) => k < ax.length - 1 && ax[k + 1].c - a.c > span + 0.05); if (i < 0) break; const a = ax[i], b = ax[i + 1], gap = b.c - a.c;
    const opts = cl.filter((c) => c.c > a.c + Math.max(1.5, 0.3 * span) && c.c <= a.c + span + 0.05 && c.c < b.c - 1.5 && c.w >= 1.0);
    if (opts.length) { const pick = opts.reduce((p, q) => (q.c > p.c ? q : p)); ax.splice(i + 1, 0, { c: pick.c, kind: 'wall', ids: pick.ids }); }
    else { // evenly spaced lines, each moved onto a wall line within 1.5 m when every bay still fits the span
      const n = Math.ceil(gap / span - 1e-6), d = gap / n, pos = Array.from({ length: n - 1 }, (_, k) => ({ c: a.c + d * (k + 1), kind: 'added', ids: [] }));
      for (const q of pos) { const near2 = cl.filter((c) => Math.abs(c.c - q.c) <= 1.5 && c.w >= 1.0).sort((x, y) => Math.abs(x.c - q.c) - Math.abs(y.c - q.c));
        for (const c of near2) { const trial = pos.map((x) => (x === q ? c.c : x.c)), cs = [a.c, ...trial, b.c]; if (cs.every((x, k) => k === 0 || (x - cs[k - 1] <= span + 0.05 && x - cs[k - 1] >= 1.2))) { q.c = c.c; q.kind = 'wall'; q.ids = c.ids; break; } } }
      ax.splice(i + 1, 0, ...pos); } }
  return ax; }

/**
 * @param {object} o
 *  levels [{id,z,h,name}], walls [{id,lv,a,b,t,h,mat}], span (target, m), system 'concrete'|'steel'|'timber',
 *  loads {dead(span) kPa, live kPa, roofDead(span), snow kPa}, fcol (MPa), roles {wallId: 'bearing'|'partition'}, matOf(w)
 */
export function layoutStructure(o) {
  const span = +o.span || 7.5, sys = o.system || 'concrete', matOf = o.matOf || ((w) => w.mat || '');
  const levels = [...(o.levels || [])].filter((l) => (o.walls || []).some((w) => w.lv === l.id)).sort((a, b) => a.z - b.z);
  const walls = (o.walls || []).filter((w) => !w.bulge && len(w) > 0.05 && levels.some((l) => l.id === w.lv));
  if (!levels.length || walls.length < 3) return null;
  const R = wallRoles(levels, walls, o.roles, matOf), roleOf = (w) => R[w.id]?.role;
  const ang = mainAngle(walls), ca = Math.cos(ang), sa = Math.sin(ang), loc = (q) => [q[0] * ca + q[1] * sa, -q[0] * sa + q[1] * ca], glob = (u) => [u[0] * ca - u[1] * sa, u[0] * sa + u[1] * ca];
  const lw = walls.map((w) => ({ w, a: loc(w.a), b: loc(w.b) }));
  const foot = Object.fromEntries(levels.map((l) => { const pts = lw.filter((x) => x.w.lv === l.id).flatMap((x) => [x.a, x.b]); return [l.id, pts.length >= 3 ? hull(pts) : []]; }));
  const all = Object.values(foot).flat(); if (all.length < 3) return null;
  const u0 = Math.min(...all.map((q) => q[0])), u1 = Math.max(...all.map((q) => q[0])), v0 = Math.min(...all.map((q) => q[1])), v1 = Math.max(...all.map((q) => q[1]));
  // candidate grid lines: walls running along v give a line at their u, and the other way round (within 5 degrees of the main axes)
  const cu = [], cv = []; for (const x of lw) { const dx = x.b[0] - x.a[0], dy = x.b[1] - x.a[1], L = Math.hypot(dx, dy); if (L < 0.5) continue; const bear = roleOf(x.w) === 'bearing';
    if (Math.abs(dx) / L < 0.09) cu.push({ c: (x.a[0] + x.b[0]) / 2, w: L, bearing: bear, ids: [x.w.id] }); else if (Math.abs(dy) / L < 0.09) cv.push({ c: (x.a[1] + x.b[1]) / 2, w: L, bearing: bear, ids: [x.w.id] }); }
  const AU = chooseAxes(cu, u0, u1, span).map((a, i) => ({ ...a, dir: 'u', name: axisName(i, 'u') })), AV = chooseAxes(cv, v0, v1, span).map((a, i) => ({ ...a, dir: 'v', name: axisName(i, 'v') }));
  const loads = o.loads || {}, deadOf = loads.dead || ((sp) => 24 * Math.max(0.2, sp / 30) + 1.5), roofOf = loads.roofDead || deadOf, live = loads.live ?? 1.9, snow = loads.snow ?? 1.0, fcol = o.fcol || 20;
  const wf = (sp) => 1.25 * deadOf(sp) + 1.5 * live, wr = (sp) => 1.25 * roofOf(sp) + 1.5 * snow;
  const lvIdx = Object.fromEntries(levels.map((l, i) => [l.id, i])), wallsOn = (lid) => lw.filter((x) => x.w.lv === lid);
  const bearingAt = (lid, q) => wallsOn(lid).find((x) => roleOf(x.w) === 'bearing' && segDist(q, x.a, x.b) <= (x.w.t || 0.2) / 2 + 0.2);
  const anyWallAt = (lid, q) => wallsOn(lid).find((x) => segDist(q, x.a, x.b) <= (x.w.t || 0.2) / 2 + 0.2);
  const inside = (lid, q) => foot[lid].length >= 3 && near(q, foot[lid], 0.3);
  // bays: each cell between grid lines, on each level whose outline holds its centre; its floor goes a quarter to each corner
  const nodes = new Map(), key = (i, j) => i + ',' + j, node = (i, j) => { const k = key(i, j); if (!nodes.has(k)) nodes.set(k, { i, j, u: [AU[i].c, AV[j].c], per: {} }); return nodes.get(k); };
  const bays = []; let slabMax = 0;
  for (let i = 0; i < AU.length - 1; i++) for (let j = 0; j < AV.length - 1; j++) { const du = AU[i + 1].c - AU[i].c, dv = AV[j + 1].c - AV[j].c, cq = [(AU[i].c + AU[i + 1].c) / 2, (AV[j].c + AV[j + 1].c) / 2];
    const on = levels.filter((l) => inside(l.id, cq)); if (!on.length) continue; const sp = Math.max(du, dv); slabMax = Math.max(slabMax, sp);
    bays.push({ i, j, du, dv, span: sp, short: Math.min(du, dv), levels: on.map((l) => l.id), area: du * dv, c: glob(cq) });
    for (const l of on) { const top = lvIdx[l.id] === levels.length - 1 || !levels.slice(lvIdx[l.id] + 1).some((m) => inside(m.id, cq)), w = (top ? wr(sp) : wf(sp)) * du * dv / 4;
      for (const [a, b] of [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]]) { const n = node(a, b); n.per[l.id] = (n.per[l.id] || 0) + w; n.trib = (n.trib || 0) + (lvIdx[l.id] === 0 ? du * dv / 4 : 0); } } }
  // columns: at a node, on each level that loads it, where no bearing wall stands; loads gathered from the top down
  const cols = [], flags = [], wallLoad = new Map();
  for (const n of nodes.values()) { let N = 0, run = null; const lvsDown = levels.slice().reverse();
    for (const l of lvsDown) { N += n.per[l.id] || 0; if (!(l.id in n.per) && !run) continue; const wb = bearingAt(l.id, n.u);
      if (wb) { if (N > 0) wallLoad.set(wb.w.id, (wallLoad.get(wb.w.id) || 0) + N); if (run) { run.z0 = l.z + l.h; cols.push(run); run = null; } N = 0; continue; }
      if (!inside(l.id, n.u) && !(l.id in n.per)) { if (run || N > 0) flags.push({ kind: 'transfer', what: 'column', at: glob(n.u), axis: AU[n.i].name + '/' + AV[n.j].name, level: l.name, load: N, note: `nothing below it on ${l.name}` }); if (run) { run.z0 = l.z + l.h; cols.push(run); run = null; } N = 0; continue; }
      if (!run) run = { node: n, axis: AV[n.j].name + '-' + AU[n.i].name, z1: l.z + l.h, inWall: !!anyWallAt(l.id, n.u) };
      run.z0 = l.z; run.N = N; run.lv = l.id; run.inWall ||= !!anyWallAt(l.id, n.u); }
    if (run) cols.push(run); }
  for (const c of cols) { const A = (c.N * 1000) / (fcol * 1e6); c.A = A; c.size = sys === 'steel' ? Math.max(0.15, Math.sqrt(A)) : Math.max(sys === 'timber' ? 0.265 : 0.3, r50(Math.sqrt(A))); const g = glob(c.node.u); c.x = g[0]; c.y = g[1]; c.trib = c.node.trib || 0; }
  // beams: along every grid line between neighbouring nodes, where no bearing wall carries that stretch (flat plates need none)
  const beams = [], slabT = (sp) => (o.depthOf ? o.depthOf(sp) : Math.max(0.2, sp / 30));
  const along = (A, B, dirU) => { for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length - 1; j++) { const p = dirU ? [A[i].c, B[j].c] : [B[j].c, A[i].c], q = dirU ? [A[i].c, B[j + 1].c] : [B[j + 1].c, A[i].c], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    for (const l of levels) { const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; if (!inside(l.id, mid) || !inside(l.id, p) || !inside(l.id, q)) continue;
      const covered = [0.2, 0.5, 0.8].every((t) => bearingAt(l.id, [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]));
      if (covered) continue; if (sys === 'concrete' && !o.beamsInConcrete) continue;
      const B0 = BEAM[sys], h = r50(L / B0.ratio, sys === 'steel' ? 0.01 : 0.05), b = sys === 'timber' ? GLULAM_W.find((x) => x >= h / 3.5) || 0.365 : Math.max(B0.minW, r50(h / 2, B0.step));
      beams.push({ a: glob(p), b: glob(q), span: L, h, w: b, level: l.id, z: l.z + l.h, axis: (dirU ? A[i].name : B[j].name) + ' ' + (dirU ? B[j].name + '–' + B[j + 1].name : A[i].name + '–' + A[i + 1]?.name) }); } } };
  along(AU, AV, true); along(AV, AU, false);
  // bearing walls: the thickness the load needs vs the thickness drawn (ground level and every level above)
  const bw = []; for (const x of lw) { if (roleOf(x.w) !== 'bearing') continue; const l = levels[lvIdx[x.w.lv]], L = len(x.w), k = wallKind(matOf(x.w)), [f, rho] = WALL_STRENGTH[k];
    // the floor it carries: the half-bays on each side of its line, per level at and above it
    const dx = x.b[0] - x.a[0], dy = x.b[1] - x.a[1], alongU = Math.abs(dy) > Math.abs(dx), c = alongU ? (x.a[0] + x.b[0]) / 2 : (x.a[1] + x.b[1]) / 2, A = alongU ? AU : AV;
    const ii = A.findIndex((a) => Math.abs(a.c - c) < 0.6), oblique = Math.min(Math.abs(dx), Math.abs(dy)) / (L || 1) > 0.09;
    let width = 0; if (ii >= 0 && !oblique) width = ((ii > 0 ? A[ii].c - A[ii - 1].c : 0) + (ii < A.length - 1 ? A[ii + 1].c - A[ii].c : 0)) / 2; else width = Math.min(span, 3) ;   // off-grid walls: about 3 m of floor
    const above = levels.slice(lvIdx[x.w.lv]).filter((m) => wallsOn(m.id).some((y) => roleOf(y.w) === 'bearing' && segDist([(x.a[0] + x.b[0]) / 2, (x.a[1] + x.b[1]) / 2], y.a, y.b) < 1.0));
    const nAbove = Math.max(1, above.length), q = width * (wf(span) * (nAbove - 1) + wr(span)) + 1.25 * rho * (x.w.t || 0.2) * above.reduce((s, m) => s + m.h, 0);   // kN/m with its own weight
    const tReq = Math.max(k === 'concrete' ? 0.15 : 0.19, r50(q / (f * 1000), 0.01)), st = lvIdx[x.w.lv] > 0 ? stacked(x.w, walls.filter((y) => y.lv === levels[lvIdx[x.w.lv] - 1].id), roleOf) : 1;
    const wfirst = { id: x.w.id, level: l.name, lv: l.id, a: x.w.a, b: x.w.b, length: L, t: x.w.t || 0, tReq, q, kind: k, width, stacked: st, ok: (x.w.t || 0) + 1e-6 >= tReq, why: R[x.w.id].why };
    bw.push(wfirst); if (lvIdx[x.w.lv] > 0 && st < 0.7) flags.push({ kind: 'transfer', what: 'wall', id: x.w.id, at: [(x.w.a[0] + x.w.b[0]) / 2, (x.w.a[1] + x.w.b[1]) / 2], level: l.name, length: L, load: q * L, note: `${Math.round(st * 100)} % of it stands on a bearing wall below` }); }
  const bySpan = (A) => A.slice(1).map((a, i) => a.c - A[i].c);
  return { angle: ang, glob, loc, axes: { u: AU, v: AV }, extent: { u0, u1, v0, v1 }, spansU: bySpan(AU), spansV: bySpan(AV), bays, cols, beams, walls: bw, roles: R, flags, levels, slabMax, slabT: slabT(slabMax), system: sys, span, live, snow };
}

// footing sizes for the ground pressure (service loads ~ factored / 1.4)
export const padSide = (Nfactored, qa) => Math.sqrt(Nfactored / 1.4 / qa);
export const stripWidth = (qFactored, qa) => qFactored / 1.4 / qa;

// improvement ideas: each with what is found, what to change, the estimated effect, and (where it can be tried in the study) an action
export function structureIdeas(L, o = {}) {
  if (!L) return []; const out = [], f1 = (x) => (Math.round(x * 10) / 10).toFixed(1), mm = (x) => Math.round(x * 1000), qa = o.bearing || 150, sys = L.system;
  const maxSpan = { concrete: 7.5, steel: 9, timber: 6 }[sys] || 7.5;
  // 1. added grid lines: columns standing where no wall is
  const added = [...L.axes.u, ...L.axes.v].filter((a) => a.kind === 'added'), inRoom = L.cols.filter((c) => !c.inWall);
  if (added.length) { const gaps = []; for (const A of [L.axes.u, L.axes.v]) for (let i = 0; i < A.length - 1; i++) if (A[i + 1].kind === 'added' || A[i].kind === 'added') gaps.push(A[i + 1].c - A[i].c);
    const wide = Math.max(...[L.axes.u, L.axes.v].flatMap((A) => { const out2 = []; let s = 0; for (let i = 0; i < A.length - 1; i++) { s += A[i + 1].c - A[i].c; if (A[i + 1].kind !== 'added') { out2.push(s); s = 0; } } return out2; }));
    // how many lines a longer-spanning frame would add instead
    const stretches = [L.axes.u, L.axes.v].flatMap((A) => { const out2 = []; let s0 = A[0].c; for (let i = 1; i < A.length; i++) if (A[i].kind !== 'added') { out2.push(A[i].c - s0); s0 = A[i].c; } return out2; });
    const need = (sp) => stretches.reduce((n, g) => n + Math.max(0, Math.ceil(g / sp - 1e-6) - 1), 0), altSpan = sys === 'steel' ? 9 : sys === 'timber' ? 7.5 : 9;
    const alt = need(altSpan) < added.length && !(sys === 'steel' && L.span >= 9) ? (sys === 'timber' ? 'concrete' : 'steel') : null;
    out.push({ id: 'added-lines', title: `${added.length} grid line${added.length > 1 ? 's' : ''} (${added.map((a) => a.name).join(', ')}) ${added.length > 1 ? 'have' : 'has'} no wall to sit in`,
      text: `The walls are up to ${f1(wide)} m apart, more than the ${f1(L.span)} m grid, so lines were added between them and their columns stand in rooms. ${alt ? `A ${alt === 'steel' ? 'steel frame' : 'concrete flat plate'} on a ${altSpan} m grid needs ${need(altSpan) || 'no'} added line${need(altSpan) === 1 ? '' : 's'} instead of ${added.length}, with deeper floors (beams span/20).` : 'A longer-spanning floor (post-tensioned slab, deeper beams) or a wall where the line is would drop them.'}`,
      action: alt ? { system: alt, span: String(altSpan) } : null }); }
  // 2. very uneven bays
  for (const [nm, sp, A] of [['along ' + L.axes.u.map((a) => a.name).join('–'), L.spansU, L.axes.u], ['along ' + L.axes.v.map((a) => a.name).join('–'), L.spansV, L.axes.v]]) { const s = sp.filter((x) => x > 1.2); if (s.length < 2) continue; const mx = Math.max(...s), mn = Math.min(...s);
    const dOf = (x) => (o.depthOf ? o.depthOf(x) : Math.max(0.2, x / 30)), rest = Math.max(mx / 2, ...s.filter((x) => x !== mx));
    if (mx / mn > 1.8 && dOf(mx) - dOf(rest) >= 0.02) { const i = sp.indexOf(mx); out.push({ id: 'uneven-' + nm.slice(6, 8), title: `Uneven bays ${nm}: ${f1(mn)} to ${f1(mx)} m`, text: `The ${f1(mx)} m bay between ${A[i].name} and ${A[i + 1].name} sets the floor depth (${mm(dOf(mx))} mm) for the whole floor. Moving a wall or a grid line to split it nearer ${f1(mx / 2)} m would bring the depth to about ${mm(dOf(rest))} mm.`, action: null }); } }
  // 3. transfers
  const tw = L.flags.filter((f) => f.kind === 'transfer' && f.what === 'wall'), tc = L.flags.filter((f) => f.kind === 'transfer' && f.what === 'column');
  if (tw.length) { const big = tw.reduce((p, q) => (q.length > p.length ? q : p)), d = Math.max(0.4, r50(Math.min(big.length, Math.max(...L.spansU, ...L.spansV)) / 10)); out.push({ id: 'transfer-walls', title: `${tw.length} bearing wall${tw.length > 1 ? 's' : ''} without a wall below`, text: `On ${[...new Set(tw.map((f) => f.level))].join(', ')}: they need a transfer beam or slab (the longest is ${f1(big.length)} m; a concrete transfer beam over a ${f1(Math.min(big.length, Math.max(...L.spansU, ...L.spansV)))} m bay is about ${mm(d)} mm deep), or line them up over a wall below.`, action: null, at: tw.map((f) => f.at) }); }
  if (tc.length) out.push({ id: 'transfer-cols', title: `${tc.length} column${tc.length > 1 ? 's' : ''} with nothing below`, text: `At ${tc.slice(0, 6).map((f) => f.axis).join(', ')}${tc.length > 6 ? '…' : ''}: the floor above reaches past the floor below (a cantilever) or the column needs a transfer beam. Cantilevers over about ${f1(maxSpan / 3)} m need checking by an engineer.`, action: null, at: tc.map((f) => f.at) });
  // 4. walls thinner than the load needs
  const thin = L.walls.filter((w) => !w.ok); if (thin.length) { const worst = thin.reduce((p, q) => (q.tReq - q.t > p.tReq - p.t ? q : p)); out.push({ id: 'thin-walls', title: `${thin.length} bearing wall${thin.length > 1 ? 's' : ''} thinner than the load needs`, text: `The worst on ${worst.level}: drawn ${mm(worst.t)} mm, about ${mm(worst.tReq)} mm needed for ${Math.round(worst.q)} kN/m in ${worst.kind} (assumed ${WALL_STRENGTH[worst.kind][0]} MPa). Thicken them, add a grid line to shorten the floor they carry, or make them partitions and add columns.`, action: null, at: thin.map((w) => [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2]) }); }
  // 5. ground pressure: footing sizes
  const ground = L.cols.filter((c) => c.z0 <= L.levels[0].z + 0.01), Nmax = Math.max(0, ...ground.map((c) => c.N)), qmax = Math.max(0, ...L.walls.filter((w) => w.lv === L.levels[0].id).map((w) => w.q));
  if (Nmax > 0 || qmax > 0) out.push({ id: 'footings', title: 'Footings at the assumed soil bearing', text: `${Nmax > 0 ? `The heaviest column (${Math.round(Nmax)} kN) needs a pad about ${f1(padSide(Nmax, qa))} × ${f1(padSide(Nmax, qa))} m` : ''}${Nmax > 0 && qmax > 0 ? '; ' : ''}${qmax > 0 ? `the most loaded wall (${Math.round(qmax)} kN/m) a strip about ${mm(Math.max(0.45, stripWidth(qmax, qa)))} mm wide` : ''}, at ${qa} kPa (assumed until a geotechnical report).${Nmax > 0 && padSide(Nmax, qa) > 3.5 ? ' Pads this big usually mean a raft or piles.' : ''}`, action: qa < 300 && Nmax > 0 && padSide(Nmax, qa) > 3.5 ? null : null });
  // 6. light columns: the grid could open up
  if (ground.length >= 4 && sys !== 'steel') { const minS = sys === 'timber' ? 0.265 : 0.3, light = ground.filter((c) => c.size <= minS + 1e-6 && (c.A / (minS * minS)) < 0.4).length;
    if (light / ground.length > 0.6 && L.span < 9 && !added.length) out.push({ id: 'light-columns', title: `${light} of ${ground.length} ground columns are at the smallest size and lightly loaded`, text: `They carry less than 40 % of what a ${mm(minS)} mm column can. A wider grid (9 m) would mean fewer columns for the same floor, at a deeper floor (${mm(o.depthOf ? o.depthOf(9) : 0.3)} mm).`, action: { span: '9' } }); }
  return out;
}
