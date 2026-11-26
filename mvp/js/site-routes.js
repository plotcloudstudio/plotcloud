// Routes without drawing (2026-11-25), for the Vehicle swept path: the site's roads (OpenStreetMap centrelines with a width) and the
// building's doors to outside give the start and the end of a route, and the planner (route-plan.js) finds the drive between them.
// Three tasks: to an entrance (from the nearest road to a stop beside a door, parallel to the wall), through the site (from one road
// to another), and a turn at a junction (from one road into another). Traffic keeps to the right (North America); a vehicle keeps to
// the middle of its half of the road. Plan metres, x east, y north. Pure functions: the Node tests run the same code.
// What this does not know: kerbs and the paved edge (a road is its centreline and width), lanes and their markings, turn
// restrictions, one-way streets beyond the data, driveways that are not mapped. Everything found is a starting route to check.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]), unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; }, right = (d) => [d[1], -d[0]];

/** the point of a polyline nearest to p: { at, seg, t, d, dir (unit, along the line), s (distance along it) } */
export function nearestOn(pts, p) { let best = null, s0 = 0;
  for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1], ab = sub(b, a), L = len(ab); if (L < 1e-9) continue; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / (L * L))), at = add(a, mul(ab, t)), d = len(sub(p, at));
    if (!best || d < best.d) best = { at, seg: i, t, d, dir: unit(ab), s: s0 + t * L }; s0 += L; }
  return best; }
/** the point at distance s along a polyline (clamped), and the direction there */
export function pointAt(pts, s) { let acc = 0; for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1], L = len(sub(b, a)); if (acc + L >= s || i + 2 === pts.length) { const t = L ? Math.max(0, Math.min(1, (s - acc) / L)) : 0; return { p: add(a, mul(sub(b, a), t)), dir: unit(sub(b, a)) }; } acc += L; } return { p: pts[0], dir: [1, 0] }; }
export const plLen = (pts) => { let s = 0; for (let i = 0; i + 1 < pts.length; i++) s += len(sub(pts[i + 1], pts[i])); return s; };
/** the middle of the right-hand half of a road at a centreline point, for a vehicle going in direction dir */
export const laneAt = (road, p, dir) => add(p, mul(right(dir), Math.max(1.2, (+road.width || 6) / 4)));

/** the road nearest to a point (roads: [{ id, name, pts, width }]) and where on it */
export function nearestRoad(roads, p, filter = () => true) { let best = null; for (const r of roads) { if (!r.pts || r.pts.length < 2 || !filter(r)) continue; const q = nearestOn(r.pts, p); if (q && (!best || q.d < best.q.d)) best = { road: r, q }; } return best; }

/**
 * To an entrance: a door { p, n (outward unit normal), w } and the roads → { start: { p, heading }, end: { p, heading }, road, approach }
 * The vehicle starts on the nearest road, `lead` metres before the point nearest the door, in the lane going toward it, and ends
 * beside the door, `stand` metres out from the wall, parallel to it, facing the way it came along the road.
 */
export function entranceTask(roads, door, v, o = {}) {
  const near = nearestRoad(roads, door.p); if (!near) return { error: 'no road in the site data: draw the route instead' };
  const { road, q } = near, total = plLen(road.pts), lead = o.lead ?? Math.max(25, 3 * (v.wheelbase + v.frontOverhang + v.rearOverhang)), n = unit(door.n), t = [-n[1], n[0]];
  // come along the road in the direction that leaves the most road behind the start
  const fwd = q.s >= lead || q.s >= total - q.s, s0 = fwd ? Math.max(0, q.s - lead) : Math.min(total, q.s + lead), A = pointAt(road.pts, s0), dir = fwd ? A.dir : mul(A.dir, -1);
  const start = laneAt(road, A.p, dir), stand = o.stand ?? (v.width / 2 + 1.0);
  // the stop: out from the door, along the wall, facing the way the road was being driven (the side of the wall's tangent nearest it)
  if (o.back) { // (2026-11-25) backed up to the door, as at a loading dock: square to the wall, the rear `gap` m from it, facing out
    // what reaches back from the rear axle: the body's rear overhang, or for a semi-trailer (2026-11-26) the trailer, straight behind it
    const T = v.kind === 'artic' && v.trailer ? v.trailer : null, back = T ? T.wheelbase + T.rearOverhang - (T.hitch || 0) : v.rearOverhang;
    const gap = o.gap ?? 0.5, endP = add(door.p, mul(n, back + gap)), R = v.wheelbase / Math.tan(v.steer * Math.PI / 180) * 1.25;
    // as a driver docks: forward past the door, parallel to the wall, then back in turning; the staging point is that stop
    const along = t[0] * dir[0] + t[1] * dir[1] >= 0 ? t : mul(t, -1), via = add(add(door.p, mul(n, back + gap + R + v.width)), mul(along, R + v.wheelbase + (T ? T.wheelbase : 0)));
    // (2026-11-26) where to stop before backing: on the road past the door, in the lane, at a few distances (as a driver docks
    // from the road), then the staging point in the yard; the planner keeps the one that needs least reversing
    const Lr = R + v.wheelbase + (T ? T.wheelbase : 0), vias = []; for (const f of [1, 1.5, 2, 3]) { const s1 = fwd ? Math.min(total, q.s + f * Lr) : Math.max(0, q.s - f * Lr), P = pointAt(road.pts, s1), d = fwd ? P.dir : mul(P.dir, -1), V = { p: laneAt(road, P.p, d), heading: Math.atan2(d[1], d[0]) }; if (!vias.some((x) => len(sub(x.p, V.p)) < 1)) vias.push(V); }   // along the road as it runs there; past its end, its end
    vias.push({ p: via, heading: Math.atan2(along[1], along[0]) });
    return { start: { p: start, heading: Math.atan2(dir[1], dir[0]) }, via, vias, viaHeading: Math.atan2(along[1], along[0]), end: { p: endP, heading: Math.atan2(n[1], n[0]), back: true }, door: door.p, road, approach: q.d }; }
  let along = t[0] * dir[0] + t[1] * dir[1] >= 0 ? t : mul(t, -1); if (o.flip) along = mul(along, -1); const mid = add(door.p, mul(n, stand));   // flip: stop facing the other way along the wall
  const endP = add(mid, mul(along, -(v.wheelbase + v.frontOverhang - v.rearOverhang) / 2));   // the rear axle, so the vehicle's middle stands at the door
  return { start: { p: start, heading: Math.atan2(dir[1], dir[0]) }, end: { p: endP, heading: Math.atan2(along[1], along[0]) }, road, approach: q.d };
}

/** where two roads' centrelines cross or meet (within `tol` m of each other's ends), merged within `merge` m → [{ p, roads: [id…] }] */
export function junctions(roads, o = {}) { const tol = o.tol ?? 1.0, merge = o.merge ?? 6, out = [], R = roads.filter((r) => r.pts && r.pts.length >= 2);
  const addJ = (p, a, b) => { const j = out.find((x) => len(sub(x.p, p)) < merge); if (j) { for (const id of [a.id, b.id]) if (!j.roads.includes(id)) j.roads.push(id); } else out.push({ p, roads: [a.id, b.id] }); };
  for (let i = 0; i < R.length; i++) for (let k = i + 1; k < R.length; k++) { const A = R[i], B = R[k];
    for (let s = 0; s + 1 < A.pts.length; s++) for (let u = 0; u + 1 < B.pts.length; u++) { const p = segX(A.pts[s], A.pts[s + 1], B.pts[u], B.pts[u + 1]); if (p) addJ(p, A, B); }
    for (const e of [A.pts[0], A.pts.at(-1)]) { const q = nearestOn(B.pts, e); if (q && q.d <= tol) addJ(q.at, A, B); }
    for (const e of [B.pts[0], B.pts.at(-1)]) { const q = nearestOn(A.pts, e); if (q && q.d <= tol) addJ(q.at, A, B); } }
  return out; }
function segX(a, b, c, d) { const r = sub(b, a), s = sub(d, c), den = r[0] * s[1] - r[1] * s[0]; if (Math.abs(den) < 1e-9) return null; const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? add(a, mul(r, t)) : null; }

/** the arms of a junction: each road leaving it, as a direction and the road → [{ road, dir, s }] (a road through it gives two arms) */
export function arms(roads, j, reach = 20) { const out = [];
  for (const id of j.roads) { const r = roads.find((x) => x.id === id); if (!r) continue; const q = nearestOn(r.pts, j.p), total = plLen(r.pts);
    if (q.s > 3) out.push({ road: r, dir: unit(sub(pointAt(r.pts, Math.max(0, q.s - reach)).p, j.p)), s: q.s, toStart: true });
    if (total - q.s > 3) out.push({ road: r, dir: unit(sub(pointAt(r.pts, Math.min(total, q.s + reach)).p, j.p)), s: q.s, toStart: false }); }
  return out; }

/**
 * A turn at a junction: come in along arm `from` toward the junction, leave along arm `to` → { start, end } with headings.
 * The vehicle starts `lead` m out on the incoming arm, in the lane toward the junction, and ends `lead` m out on the leaving arm.
 */
export function turnTask(roads, j, from, to, v, o = {}) { const A = arms(roads, j); const a = A[from], b = A[to]; if (!a || !b || from === to) return { error: 'choose two different roads of the junction' };
  const lead = o.lead ?? Math.max(20, 2 * (v.wheelbase + v.frontOverhang + v.rearOverhang)), place = (arm, out) => { const total = plLen(arm.road.pts), s = arm.toStart ? Math.max(0, arm.s - lead) : Math.min(total, arm.s + lead), P = pointAt(arm.road.pts, s).p, d = out ? arm.dir : mul(arm.dir, -1); return { p: laneAt(arm.road, P, d), heading: Math.atan2(d[1], d[0]) }; };
  const start = place(a, false), end = place(b, true), turn = Math.atan2(Math.sin(end.heading - start.heading), Math.cos(end.heading - start.heading));
  return { start, end, turn, kind: Math.abs(turn) < 0.35 ? 'straight on' : turn > 0 ? 'left turn' : 'right turn' }; }

/** through the site: from a point on one road to a point on another (or the same) road; each given by a click near the road */
export function throughTask(roads, pA, pB, o = {}) { const a = nearestRoad(roads, pA), b = nearestRoad(roads, pB); if (!a || !b) return { error: 'no road in the site data near those points' };
  const toward = unit(sub(b.q.at, a.q.at)), dA = a.q.dir[0] * toward[0] + a.q.dir[1] * toward[1] >= 0 ? a.q.dir : mul(a.q.dir, -1), away = unit(sub(b.q.at, a.q.at)), dB = b.q.dir[0] * away[0] + b.q.dir[1] * away[1] >= 0 ? b.q.dir : mul(b.q.dir, -1);
  void o; return { start: { p: laneAt(a.road, a.q.at, dA), heading: Math.atan2(dA[1], dA[0]) }, end: { p: laneAt(b.road, b.q.at, dB), heading: Math.atan2(dB[1], dB[0]) }, roads: [a.road, b.road] }; }

/**
 * Turn round (2026-11-25): a vehicle on a road at pA, facing toward pB, turns to face the other way in the other half of the road at
 * the same place: a U-turn where there is room, a three-point (or more) turn where there is not. Kept within the roads.
 */
export function turnRoundTask(roads, pA, pB) { const a = nearestRoad(roads, pA); if (!a) return { error: 'no road in the site data near that point' };
  const toward = unit(sub(pB, pA)), d = a.q.dir[0] * toward[0] + a.q.dir[1] * toward[1] >= 0 ? a.q.dir : mul(a.q.dir, -1), back = mul(d, -1);
  return { start: { p: laneAt(a.road, a.q.at, d), heading: Math.atan2(d[1], d[0]) }, end: { p: laneAt(a.road, a.q.at, back), heading: Math.atan2(back[1], back[0]) }, road: a.road }; }

/** (2026-11-26) the room square in front of a door: how far out from the wall along its normal before an obstacle → { d, name } (max 200 m) */
export function roomInFront(door, n, obstacles) { const inside = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
  const u = unit(n); for (let d = 0.5; d <= 200; d += 0.25) { const x = door[0] + u[0] * d, y = door[1] + u[1] * d, hit = obstacles.find((o) => o.poly && o.poly.length >= 3 && inside(o.poly, x, y)); if (hit) return { d: d - 0.25, name: hit.name || 'an obstacle' }; }
  return { d: Infinity, name: '' }; }
