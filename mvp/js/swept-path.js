// Vehicle swept path (2026-11-18): a kinematic screening of a vehicle driven along a drawn route. Plan metres, x east, y north.
// Pure functions, no DOM (the Node tests run the same code).
// · The route: points clicked on the plan. Each corner between two segments driven the same way is rounded by an arc (by default
//   of 1.25 × the vehicle's least radius, less where the segments leave no room, or a radius the person set), as the CAD swept-path tools do; a corner between a forward and a reversing segment is a
//   stop where the steering may be turned (a cusp). The reference point is the rear axle's centre (the point the turning radius is
//   measured to), so R_min = wheelbase / tan(maximum steering angle).
// · The vehicle: a bicycle model. Steering by pure pursuit, limited to ±the maximum angle and to the rate the lock-to-lock time
//   allows at the stated speed. An articulated vehicle's trailer follows its hitch: φ' = (sin(θ−φ) + h·(tanδ/L)·cos(θ−φ)) / Lt per
//   metre, so its off-tracking is computed, not drawn by hand.
// · The route is never forced: where the vehicle cannot keep within 0.30 m of it, or a corner is tighter than it can turn, or the
//   trailer folds past its limit, that stretch is reported infeasible with its stations.
// · Clearance: each body outline (tractor and trailer) against each obstacle outline, at every step: the least gap, where, and every
//   stretch in collision (gap 0) or nearer than the threshold.
import { dist, sub, unit, wrap, place, rasterUnion, gap, bbox, boxesMeet, overlap, plLength } from './geom2d.js';
import { rMin } from './vehicles.js?v=batch3-20261124-1';

const DEG = Math.PI / 180;
export const QUALITY = { draft: { ds: 0.10, cell: 0.05 }, standard: { ds: 0.05, cell: 0.05 }, refined: { ds: 0.025, cell: 0.02 } };
export const TRACK_TOL = 0.30, CLEAR_DEFAULT = 0.30, AUTO_R = 1.25, REV_SPEED = 4;   // REV_SPEED (2026-11-25): reversing at walking pace, km/h   // AUTO_R: a corner drawn without a radius is driven at 1.25 × the least radius (less if the segments leave no room)

// ---- the reference path: segments with their corners rounded ----
/**
 * @param route { pts: [[x, y], …], radii?: (number|null)[] (one per point; ends ignored), reverse?: boolean[] (one per segment) }
 * @returns { path: [{ p, s, dir, k }], corners: [{ i, angle, r, fit, auto, s0, s1, tight }], length, cusps }
 *   path: points every `step` metres with the station s, the driving direction (+1 forward, −1 reverse) and the curvature k
 */
export function referencePath(route, v, step = 0.05) {
  const P = (route.pts || []).map((p) => [+p[0], +p[1]]).filter((p, i, a) => !i || dist(p, a[i - 1]) > 1e-3); if (P.length < 2) return { path: [], corners: [], length: 0, cusps: 0, error: 'Draw at least two points' };
  const rev = (i) => !!(route.reverse && route.reverse[i]), R0 = rMin(v), segs = [];
  for (let i = 0; i + 1 < P.length; i++) segs.push({ a: P[i], b: P[i + 1], d: unit(sub(P[i + 1], P[i])), L: dist(P[i], P[i + 1]), dir: rev(i) ? -1 : 1, t0: 0, t1: 0 });
  // corners: tangent length r·tan(Δ/2), at most half of a segment shared with another corner, or all of an end segment
  const corners = [];
  for (let i = 1; i + 1 < P.length; i++) { const A = segs[i - 1], B = segs[i]; if (A.dir !== B.dir) { corners.push({ i, cusp: true }); continue; }
    const turn = wrap(Math.atan2(B.d[1], B.d[0]) - Math.atan2(A.d[1], A.d[0])); if (Math.abs(turn) < 1e-4) continue;
    if (Math.abs(turn) > Math.PI - 1e-3) { corners.push({ i, angle: turn, r: 0, fit: 0, tight: true, uturn: true }); continue; }
    const tanH = Math.tan(Math.abs(turn) / 2), roomA = i - 1 === 0 ? A.L : A.L / 2, roomB = i + 1 === P.length - 1 ? B.L : B.L / 2, fit = Math.min(roomA, roomB) / tanH;
    const set = route.radii && Number.isFinite(+route.radii[i]) && +route.radii[i] > 0 ? +route.radii[i] : null, r = set != null ? Math.min(set, fit) : Math.min(fit, AUTO_R * R0);   // by default a turn close to the drawn corner, as a driver takes it
    corners.push({ i, angle: turn, r, fit, auto: set == null, set, tight: r < R0 - 1e-6, tan: r * tanH }); }
  for (const c of corners) if (!c.cusp && !c.uturn) { segs[c.i - 1].t1 = c.tan; segs[c.i].t0 = c.tan; }
  // walk the pieces: the straight part of each segment, then the arc of the corner after it
  const path = []; let s = 0; const push = (p, dir, k) => { if (path.length) s += dist(path.at(-1).p, p); path.push({ p, s, dir, k }); };
  let cusps = 0;
  for (let i = 0; i < segs.length; i++) { const g = segs[i], a = [g.a[0] + g.d[0] * g.t0, g.a[1] + g.d[1] * g.t0], L = Math.max(0, g.L - g.t0 - g.t1), n = Math.max(1, Math.ceil(L / step));
    for (let k = path.length ? 1 : 0; k <= n; k++) push([a[0] + g.d[0] * L * k / n, a[1] + g.d[1] * L * k / n], g.dir, 0);
    const c = corners.find((x) => x.i === i + 1); if (!c) continue;
    if (c.cusp) { cusps++; c.s = s; path.at(-1).cusp = true; continue; }
    if (c.uturn) { c.s0 = c.s1 = s; continue; }
    const sg = Math.sign(c.angle), nrm = [-g.d[1] * sg, g.d[0] * sg], end = path.at(-1).p, ctr = [end[0] + nrm[0] * c.r, end[1] + nrm[1] * c.r], a0 = Math.atan2(end[1] - ctr[1], end[0] - ctr[0]);
    const m = Math.max(2, Math.ceil(Math.abs(c.angle) * c.r / step)); c.s0 = s; c.centre = ctr;
    for (let k = 1; k <= m; k++) { const t = a0 + c.angle * k / m; push([ctr[0] + c.r * Math.cos(t), ctr[1] + c.r * Math.sin(t)], g.dir, sg / c.r); }
    c.s1 = s; }
  return { path, corners, length: s, cusps };
}

// (2026-11-25) a planned path may reverse: each point carries its direction, and the last point before a change is a cusp (a stop)
function plannedRef(pl) { const path = []; let s = 0, cusps = 0; for (const x of pl) { const dir = x.dir < 0 ? -1 : 1; if (path.length) { const d = dist(path.at(-1).p, x.p); if (d < 1e-4) continue; if (dir !== path.at(-1).dir) { path.at(-1).cusp = true; cusps++; } s += d; } path.push({ p: x.p, s, dir, k: x.k || 0, phi: x.phi }); } return { path, corners: [], length: s, cusps, planned: true }; }

// ---- the vehicle's outlines and wheels at a pose ----
/** pose { x, y, th, phi (trailer heading), delta } → { bodies: [polygon, …], wheels: { name: [x, y] }, hitch } */
export function shapesAt(v, q) {
  const L = v.wheelbase, W = v.width, rear = q;
  const tractor = place([[-v.rearOverhang, -W / 2], [L + v.frontOverhang, -W / 2], [L + v.frontOverhang, W / 2], [-v.rearOverhang, W / 2]], rear.x, rear.y, rear.th);
  const t2 = v.track / 2, wl = (lx, ly) => place([[lx, ly]], rear.x, rear.y, rear.th)[0];
  const wheels = { RL: wl(0, t2), RR: wl(0, -t2), FL: wl(L, t2), FR: wl(L, -t2) }, bodies = [tractor];
  let hitch = null;
  if (v.kind === 'artic' && v.trailer) { const T = v.trailer, h = wl(T.hitch || 0, 0), tw = (T.width || W) / 2, tt = (T.track || v.track) / 2; hitch = h;
    bodies.push(place([[-(T.wheelbase + T.rearOverhang), -tw], [T.frontOverhang, -tw], [T.frontOverhang, tw], [-(T.wheelbase + T.rearOverhang), tw]], h[0], h[1], q.phi));
    const ta = (ly) => place([[-T.wheelbase, ly]], h[0], h[1], q.phi)[0]; wheels.TL = ta(tt); wheels.TR = ta(-tt); }
  return { bodies, wheels, hitch };
}

// ---- the drive ----
/**
 * @param v a vehicle (vehicles.js)
 * @param route { pts, radii?, reverse? }
 * @param o { quality: 'draft'|'standard'|'refined', obstacles: [{ id, kind, name, poly }], clearance (m), speed (km/h), delay (s),
 *            outlineEvery (m), complete (are the obstacles known to be complete?) }
 */
export function simulate(v, route, o = {}) {
  const Q = QUALITY[o.quality] || QUALITY.standard, ds = o.ds || Q.ds, cellE = o.cell || Q.cell, thr = o.clearance ?? CLEAR_DEFAULT, speed = (o.speed || v.speed || 8) / 3.6;
  // a planned path (route-plan.js: a way round the obstacles) is followed as it is: its turns are already within the vehicle's radius
  const ref = route.planned ? plannedRef(route.planned) : referencePath(route, v, Math.min(0.05, ds)); if (!ref.path.length) return { ok: false, error: ref.error || 'No route' };
  const R = ref.path, L = v.wheelbase, dmax = v.steer * DEG, rateMax = (2 * dmax / (v.lockTime || 4)) / speed, Ld = Math.max(1.5, Math.min(12, L)), art = v.kind === 'artic' && v.trailer;
  const T = art ? v.trailer : null, maxArt = art ? (T.maxArticulation || 70) * DEG : 0;
  if (art && !route.planned && R.some((x) => x.dir < 0)) return { ok: false, error: 'A drawn route cannot reverse an articulated vehicle: pick a task (it plans the reversing) or draw the route forward only' };   // (2026-11-26) a planned path is replayed, trailer included
  // the start: on the route's first point, facing along it (backwards for a reversing start)
  const d0 = unit(sub(R[Math.min(R.length - 1, 3)].p, R[0].p)), th0 = Number.isFinite(route.heading0) ? route.heading0 : Math.atan2(d0[1], d0[0]) + (R[0].dir < 0 ? Math.PI : 0);   // a planned path: the heading it was planned from
  const q = { x: R[0].p[0], y: R[0].p[1], th: th0, phi: th0, delta: 0 }; let idx = 0, s = 0, u = 0, t = o.delay || 0, still = true;   // u: the distance driven with its sign (backwards counts down), for the wheels' roll   // still: at a standstill (the start, a cusp) the wheel may be turned freely
  const poses = [], bad = [], stretches = (arr) => { const out = [], last = {}; for (const x of arr.slice().sort((p, q2) => p.s - q2.s)) { const l = last[x.why]; if (l && x.s - l.s1 <= 2 * ds + 1e-9) l.s1 = x.s; else { last[x.why] = { s0: x.s, s1: x.s, why: x.why }; out.push(last[x.why]); } } return out.sort((p, q2) => p.s0 - q2.s0); };   // runs of the same reason
  const nearest = () => { let best = idx, bd = Infinity; for (let k = idx; k < Math.min(R.length, idx + 400); k++) { const d = dist(R[k].p, [q.x, q.y]); if (d < bd) { bd = d; best = k; } if (R[k].cusp && k > idx) break; } return [best, bd]; };
  let guard = 0; const maxSteps = Math.ceil((ref.length * 1.5 + 20) / ds);
  // (2026-11-25) a planned path that reverses (route-plan.js, rigid vehicles) is driven as planned: arcs of constant steering one after
  // another, indexed by the distance driven, the steering set at the start of each arc and the vehicle stopping at each change of
  // direction. Following it with pure pursuit instead turns its small heading errors at a cusp into large ones when reversing.
  const replay = !!(ref.planned && ref.cusps); let revAt = null, seam = 0;
  if (replay) { let j = 0; const last = R.at(-1).s;
    while (guard++ < maxSteps && s < last - ds / 2) { while (j + 1 < R.length - 1 && R[j + 1].s <= s + 1e-9) j++;
      const nx = R[Math.min(R.length - 1, j + 1)], dir = nx.dir, a = R[j], u0 = nx.s > a.s ? (s - a.s) / (nx.s - a.s) : 0, at = [a.p[0] + (nx.p[0] - a.p[0]) * u0, a.p[1] + (nx.p[1] - a.p[1]) * u0], err = dist(at, [q.x, q.y]);
      const want = Math.max(-dmax, Math.min(dmax, Math.atan(L * (nx.k || 0)))); q.delta = want;
      poses.push({ x: q.x, y: q.y, th: q.th, phi: q.phi, delta: q.delta, s, u, t, sRef: s, err, dir, sat: false });
      if (err > TRACK_TOL) bad.push({ s, why: 'track' });
      if (art && Math.abs(wrap(q.th - q.phi)) > maxArt) bad.push({ s, why: 'articulation' });
      const step = Math.min(ds, Math.max(1e-4, nx.s - s)), w = Math.tan(q.delta) / L;   // never past the next point: the arcs change there
      if (art) { const h = T.hitch || 0; q.phi += (Math.sin(q.th - q.phi) + h * w * Math.cos(q.th - q.phi)) / T.wheelbase * step * dir;   // the trailer, as the planner integrates it
        // backing a trailer is unstable: left alone its angle drifts from the plan's and grows. A driver steers to keep it on the line
        // planned, so where the plan gives the trailer's angle the reverse follows it, a difference at the stop taken out over 3 m
        if (dir < 0 && Number.isFinite(nx.phi) && Number.isFinite(a.phi)) { const pp = a.phi + wrap(nx.phi - a.phi) * u0; if (revAt == null) { revAt = s; seam = wrap(q.phi - pp); } q.phi = pp + seam * Math.max(0, 1 - (s - revAt) / 3); } else if (dir > 0) revAt = null; }
      q.th += w * step * dir; q.x += Math.cos(q.th - w * step * dir / 2) * step * dir; q.y += Math.sin(q.th - w * step * dir / 2) * step * dir; s += step; u += step * dir; t += step / (dir < 0 ? Math.min(speed, REV_SPEED / 3.6) : speed); }
    poses.push({ x: q.x, y: q.y, th: q.th, phi: q.phi, delta: q.delta, s, u, t, sRef: s, err: dist(R.at(-1).p, [q.x, q.y]), dir: R.at(-1).dir, sat: false }); }
  while (!replay && guard++ < maxSteps) {
    const [k, err] = nearest(); idx = k; const dir = R[idx].dir, cuspAhead = (() => { for (let j = idx; j < R.length; j++) { if (R[j].cusp) return j; if (R[j].s - R[idx].s > Ld) return -1; } return -1; })();
    // the target: the first route point Ld ahead (not past a cusp or the end)
    let tg = idx; while (tg + 1 < R.length && dist(R[tg].p, [q.x, q.y]) < Ld && !(R[tg].cusp && tg > idx)) tg++;
    const lead = dir > 0 ? q.th : q.th + Math.PI, toT = sub(R[tg].p, [q.x, q.y]), dT = Math.hypot(toT[0], toT[1]);
    const alpha = wrap(Math.atan2(toT[1], toT[0]) - lead), kappa = dT > 1e-6 ? 2 * Math.sin(alpha) / Math.max(dT, 1e-6) : 0;
    let want = Math.atan(L * kappa) * dir;
    // a planned path (2026-11-25) knows its own curvature: steer by it, and by half of pure pursuit's correction, so short legs between
    // changes of direction are followed closely
    if (ref.planned) { let j = idx; while (j + 1 < R.length && R[j].s - R[idx].s < Math.min(1.0, Ld / 2) && !(R[j].cusp && j > idx)) j++; const ff = Math.atan(L * (R[j].k || 0)); want = ff + 0.5 * (want - ff); }
    const sat = Math.abs(want) > dmax + 1e-9; want = Math.max(-dmax, Math.min(dmax, want));
    const vNow = dir < 0 ? Math.min(speed, REV_SPEED / 3.6) : speed, rate = rateMax * speed / vNow, dd = still ? want - q.delta : Math.max(-rate * ds, Math.min(rate * ds, want - q.delta)); q.delta += dd; const atStop = still; still = false;
    poses.push({ x: q.x, y: q.y, th: q.th, phi: q.phi, delta: q.delta, s, u, t, sRef: R[idx].s, err, dir, sat });
    if (err > TRACK_TOL && !atStop) bad.push({ s: R[idx].s, why: 'track' });   // not at a standstill (a cusp): the point nearest may jump to the next leg there
    if (art && Math.abs(wrap(q.th - q.phi)) > maxArt) bad.push({ s: R[idx].s, why: 'articulation' });
    // the end, or a cusp reached: stop there (and at a cusp turn the wheel at standstill)
    // passed a point of the route: beyond it along the route's direction there (within half a step), and near it
    const passed = (j) => { const a = R[Math.max(0, j - 1)].p, b = R[j].p, u = unit(sub(b, a)); return dist(b, [q.x, q.y]) < Ld && (q.x - b[0]) * u[0] + (q.y - b[1]) * u[1] >= -ds / 2; };
    if (idx >= R.length - 3 && passed(R.length - 1)) break;
    if (cuspAhead >= 0 && passed(cuspAhead)) { idx = cuspAhead + 1; still = true; continue; }
    const step = ds, w = Math.tan(q.delta) / L, sgn = dir;
    if (art) { const h = T.hitch || 0, Lt = T.wheelbase; q.phi += (Math.sin(q.th - q.phi) + h * w * Math.cos(q.th - q.phi)) / Lt * step * sgn; }
    q.th += w * step * sgn; q.x += Math.cos(q.th - w * step * sgn / 2) * step * sgn; q.y += Math.sin(q.th - w * step * sgn / 2) * step * sgn; s += step; u += step * sgn; t += step / (sgn < 0 ? Math.min(speed, REV_SPEED / 3.6) : speed);
  }
  const last = poses.at(-1), reached = last && R.at(-1) && dist([last.x, last.y], R.at(-1).p) < Math.max(0.5, 3 * ds);
  if (!reached) bad.push({ s: last ? last.sRef : 0, why: 'end' });
  for (const c of ref.corners) if (c.tight) for (let x = c.s0 ?? 0; x <= (c.s1 ?? c.s0 ?? 0) + 1e-9; x += ds) bad.push({ s: x, why: c.uturn ? 'uturn' : 'corner' });
  bad.sort((a, b) => a.s - b.s);
  // the shapes: wheel tracks and body corners every step, the envelope from the bodies, outlines every few metres
  const tracks = {}, every = o.outlineEvery || Math.max(2, Math.round(v.length / 2)), outlines = []; let nextOut = 0;
  const bodiesAll = [];
  for (const p of poses) { const S = shapesAt(v, p); for (const [n, w] of Object.entries(S.wheels)) (tracks[n] ||= []).push(w); bodiesAll.push(S.bodies);
    if (p.s >= nextOut - 1e-9) { outlines.push({ s: p.s, bodies: S.bodies, pose: p }); nextOut += every; } }
  if (last) outlines.push({ s: last.s, bodies: shapesAt(v, last).bodies, pose: last, end: true });
  const sampleEvery = Math.max(1, Math.round(Math.min(cellE * 2, 0.1) / ds)), env = rasterUnion(bodiesAll.filter((_, i) => i % sampleEvery === 0 || i === bodiesAll.length - 1).flat(), cellE);
  // clearance against each obstacle
  const obs = (o.obstacles || []).filter((x) => x.poly && x.poly.length >= 3).map((x) => ({ ...x, bb: bbox(x.poly) }));
  let minC = { d: Infinity }; const hits = [], near = [], perObs = new Map();
  for (let i = 0; i < poses.length; i++) for (let b = 0; b < bodiesAll[i].length; b++) { const B = bodiesAll[i][b], bb = bbox(B);
    for (const ob of obs) { if (!boxesMeet(bb, ob.bb, Math.max(thr, 0) + 2)) continue; const g = gap(B, ob.poly);
      const cur = perObs.get(ob.id); if (!cur || g.d < cur.d) perObs.set(ob.id, { d: g.d, at: g.hit ? g.a : g.b, s: poses[i].s, unit: b ? 'trailer' : 'vehicle', name: ob.name || ob.kind || ob.id, kind: ob.kind });
      if (g.d < minC.d) minC = { d: g.d, at: g.hit ? g.a : g.b, from: g.a, s: poses[i].s, id: ob.id, name: ob.name || ob.kind || ob.id, unit: b ? 'trailer' : 'vehicle' };
      if (g.hit) hits.push({ s: poses[i].s, why: ob.id }); else if (g.d < thr) near.push({ s: poses[i].s, why: ob.id }); } }
  const group = (arr) => { const by = new Map(); for (const x of arr) { if (!by.has(x.why)) by.set(x.why, []); by.get(x.why).push(x); } const out = []; for (const [id, l] of by) for (const r of stretches(l.sort((a, b) => a.s - b.s))) { const ob = obs.find((z) => z.id === id); out.push({ ...r, id, name: ob ? ob.name || ob.kind || id : id, kind: ob && ob.kind }); } return out.sort((a, b) => a.s0 - b.s0); };
  const collisions = group(hits), tooNear = group(near), infeasible = stretches(bad);
  const radii = poses.filter((p) => Math.abs(p.delta) > 1e-4).map((p) => L / Math.tan(Math.abs(p.delta))), rReached = radii.length ? Math.min(...radii) : Infinity;
  const reasons = []; for (const x of infeasible) reasons.push(x.why === 'track' ? `cannot follow the route within ${TRACK_TOL.toFixed(2)} m at ${x.s0.toFixed(1)}–${x.s1.toFixed(1)} m` : x.why === 'corner' ? `the corner at ${x.s0.toFixed(1)} m is tighter than the vehicle's minimum radius ${rMin(v).toFixed(2)} m` : x.why === 'uturn' ? `a turn back on itself at ${x.s0.toFixed(1)} m: draw it as a loop or with a reversing segment` : x.why === 'articulation' ? `the trailer folds past ${T.maxArticulation}° at ${x.s0.toFixed(1)}–${x.s1.toFixed(1)} m` : 'the vehicle does not reach the end of the route');
  for (const c of collisions) reasons.push(`collides with ${c.name} at ${c.s0.toFixed(1)}–${c.s1.toFixed(1)} m`);
  if (!collisions.length && minC.d < thr) reasons.push(`passes ${minC.name} ${minC.d.toFixed(2)} m away, under the ${thr.toFixed(2)} m clearance`);
  const status = reasons.length ? 'infeasible' : !obs.length || o.complete === false ? 'unverified' : 'feasible';
  return { ok: true, status, reasons, unverifiedWhy: status === 'unverified' ? (!obs.length ? 'no obstacles were given (no buildings, curbs or columns near the route)' : 'the obstacle data is incomplete') : '',
    vehicle: v, ref, poses, tracks, outlines, envelope: env, swept: env.area, cell: cellE, length: last ? last.s : 0, duration: last ? last.t - (o.delay || 0) : 0, speed: speed * 3.6,
    rMin: rMin(v), rReached, minClear: Number.isFinite(minC.d) ? minC : null, perObstacle: [...perObs.entries()].map(([id, x]) => ({ id, ...x })).sort((a, b) => a.d - b.d), collisions, tooNear, infeasible,
    reversing: R.reduce((n, x, i) => n + (x.dir < 0 && (i === 0 || R[i - 1].dir >= 0) ? 1 : 0), 0),   /* reversing legs: each start of a run of reversing points */ reverseLength: poses.reduce((a, p, i) => a + (i && p.dir < 0 ? p.s - poses[i - 1].s : 0), 0), cusps: ref.cusps, moves: ref.cusps + 1, clearance: thr, ds, quality: o.quality || 'standard' };
}

/** the pose at a time (s), interpolated between steps; null before the start or after the end */
export function poseAt(run, t) { const P = run.poses; if (!P.length || t < P[0].t - 1e-9 || t > P.at(-1).t + 1e-9) return null; let lo = 0, hi = P.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m].t <= t) lo = m; else hi = m; }
  const a = P[lo], b = P[hi], k = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0, mix = (u, w) => u + (w - u) * k, ang = (u, w) => u + wrap(w - u) * k; return { x: mix(a.x, b.x), y: mix(a.y, b.y), th: ang(a.th, b.th), phi: ang(a.phi, b.phi), delta: mix(a.delta, b.delta), s: mix(a.s, b.s), u: mix(a.u ?? a.s, b.u ?? b.s), dir: b.dir || 1, t }; }

/**
 * two vehicles: do their bodies meet at the same moment (a real conflict), or do their envelopes only cross at different times?
 * Sampled every dt seconds over the time both are moving.
 */
export function pairConflict(A, B, dt = 0.1) {
  const t0 = Math.max(A.poses[0].t, B.poses[0].t), t1 = Math.min(A.poses.at(-1).t, B.poses.at(-1).t), hits = [];
  for (let t = t0; t <= t1 + 1e-9; t += dt) { const a = poseAt(A, t), b = poseAt(B, t); if (!a || !b) continue; const SA = shapesAt(A.vehicle, a).bodies, SB = shapesAt(B.vehicle, b).bodies;
    if (SA.some((p) => SB.some((q) => overlap(p, q)))) hits.push({ t, at: [(a.x + b.x) / 2, (a.y + b.y) / 2] }); }
  const GA = A.envelope.grid, GB = B.envelope.grid; let meet = false;
  if (GA && GB) for (let j = 0; j < GA.ny && !meet; j++) for (let i = 0; i < GA.nx; i++) { if (!GA.G[j * GA.nx + i]) continue; const x = GA.x0 + (i + 0.5) * A.envelope.cell, y = GA.y0 + (j + 0.5) * A.envelope.cell, bi = Math.floor((x - GB.x0) / B.envelope.cell), bj = Math.floor((y - GB.y0) / B.envelope.cell); if (bi >= 0 && bj >= 0 && bi < GB.nx && bj < GB.ny && GB.G[bj * GB.nx + bi]) { meet = true; break; } }
  const spans = []; for (const h of hits) { const l = spans.at(-1); if (l && h.t - l.t1 <= dt * 1.5) { l.t1 = h.t; } else spans.push({ t0: h.t, t1: h.t, at: h.at }); }
  return { simultaneous: spans, envelopesMeet: meet };
}

export { plLength };
