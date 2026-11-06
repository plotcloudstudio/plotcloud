// Site water bodies (2026-11-06): a water area of the site (site.areas, kind 'water', site metres) as a body of water with a
// surface: a still pond or lake at one level, or a stream whose surface follows a centreline down to the outlet, with falls where
// it drops. The person sets the type, level, depth, speed and flow on the area (area.water); where they are not set they are read
// from the terrain. Pure functions: the modeler builds the 3D surface, falls and foam from them, the 2D plan draws the flow, and the
// studies (stormwater, outdoor comfort, water sound) read the same bodies.
//
// area.water = { type: 'auto' | 'pond' | 'stream' | 'drape', level (m, pond surface), depth (m), speed (m/s),
//                discharge (m³/s), centre: [[x, y, z, width?]…] (stream surface along its centreline, upstream first) }
export const DEF = { depth: 0.8, speed: 0.5 };
export const TYPES = [['auto', 'From the terrain'], ['pond', 'Still water (pond, lake, pool)'], ['stream', 'Flowing water (stream, river)']];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], dot = (a, b) => a[0] * b[0] + a[1] * b[1], len = (a) => Math.hypot(a[0], a[1]);
export function areaOf(pts) { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }
// the outline's main axis and its spread along and across it
function axes(pts) { const n = pts.length, cx = pts.reduce((s, p) => s + p[0], 0) / n, cy = pts.reduce((s, p) => s + p[1], 0) / n; let xx = 0, yy = 0, xy = 0;
  for (const p of pts) { const dx = p[0] - cx, dy = p[1] - cy; xx += dx * dx; yy += dy * dy; xy += dx * dy; }
  const ang = 0.5 * Math.atan2(2 * xy, xx - yy), a = [Math.cos(ang), Math.sin(ang)], b = [-a[1], a[0]], s = pts.map((p) => dot(sub(p, [cx, cy]), a)), t = pts.map((p) => dot(sub(p, [cx, cy]), b));
  return { c: [cx, cy], a, b, s0: Math.min(...s), s1: Math.max(...s), t0: Math.min(...t), t1: Math.max(...t) }; }
export const elongation = (pts) => { const A = axes(pts), L = A.s1 - A.s0, W = Math.max(0.1, areaOf(pts) / Math.max(0.1, L)); return L / W; };
// the centreline of a long outline: cross sections every step along its main axis, their middle and width, the lowest ground in
// each; turned to run downhill, and never rising (water does not climb), so drops collect into falls
export function autoCentre(pts, gz, step = 2) {
  const A = axes(pts), out = [];
  for (let s = A.s0 + step / 2; s <= A.s1 - step / 2 + 1e-9; s += step) { const ts = [];
    for (let i = 0; i < pts.length; i++) { const p = sub(pts[i], A.c), q = sub(pts[(i + 1) % pts.length], A.c), sp = dot(p, A.a), sq = dot(q, A.a); if ((sp - s) * (sq - s) > 0 || sp === sq) continue; const u = (s - sp) / (sq - sp); ts.push(dot(p, A.b) + u * (dot(q, A.b) - dot(p, A.b))); }
    if (ts.length < 2) continue; const t0 = Math.min(...ts), t1 = Math.max(...ts), at = (t) => [A.c[0] + A.a[0] * s + A.b[0] * t, A.c[1] + A.a[1] * s + A.b[1] * t]; let z = Infinity;
    for (let k = 0; k <= 4; k++) { const p = at(t0 + (t1 - t0) * (0.1 + 0.8 * k / 4)); z = Math.min(z, gz(p[0], p[1])); }
    out.push([...at((t0 + t1) / 2), Number.isFinite(z) ? z : 0, t1 - t0]); }
  if (out.length > 1 && out[0][2] < out[out.length - 1][2]) out.reverse();
  for (let i = 1; i < out.length; i++) out[i][2] = Math.min(out[i][2], out[i - 1][2]);
  return out; }
// the width of the water at a centreline point: twice the distance to the nearest edge of the outline
function widthAt(pts, p) { let d = Infinity; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], ab = sub(b, a), L = dot(ab, ab), u = L ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / L)) : 0; d = Math.min(d, len(sub(p, [a[0] + ab[0] * u, a[1] + ab[1] * u]))); } return Math.max(0.5, 2 * d); }
// falls: a drop of 0.4 m or more over a short run (steeper than about 1 in 3)
export function fallsOf(C) { const F = []; for (let i = 1; i < C.length; i++) { const a = C[i - 1], b = C[i], drop = a[2] - b[2], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (drop < 0.4 || drop / Math.max(0.05, L) < 0.35) continue;
    const d = [(b[0] - a[0]) / (L || 1), (b[1] - a[1]) / (L || 1)]; F.push({ i, p: [a[0], a[1]], dir: d, w: (a[3] + b[3]) / 2, top: a[2], bot: b[2], drop }); } return F; }
// a body of water, ready to draw and to study
export function spec(area, gz = () => 0) {
  const w = area.water || {}, pts = area.pts || []; if (pts.length < 3) return null;
  let type = w.type && w.type !== 'auto' ? w.type : (w.centre && w.centre.length > 1) || elongation(pts) > 3.5 ? 'stream' : 'pond';
  const depth = +w.depth > 0 ? +w.depth : DEF.depth, A = areaOf(pts), o = { id: area.id, name: area.name || 'Water', type, depth, area: A, pts, set: { ...w } };
  if (type === 'pond' || type === 'drape') { let lo = Infinity; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; for (let k = 0; k < 4; k++) { const z = gz(a[0] + (b[0] - a[0]) * k / 4, a[1] + (b[1] - a[1]) * k / 4); if (Number.isFinite(z)) lo = Math.min(lo, z); } }
    o.level = Number.isFinite(+w.level) && w.level !== null && w.level !== '' ? +w.level : Number.isFinite(lo) ? +lo.toFixed(2) : 0; o.speed = +w.speed >= 0 && w.speed !== undefined && w.speed !== null && w.speed !== '' ? +w.speed : 0; o.falls = []; o.centre = null; o.length = 0;
    o.discharge = +w.discharge > 0 ? +w.discharge : 0; return o; }
  const C = (w.centre && w.centre.length > 1 ? w.centre.map((p) => [p[0], p[1], Number.isFinite(p[2]) ? p[2] : gz(p[0], p[1]), p[3] > 0 ? p[3] : null]) : autoCentre(pts, gz)).map((p) => (p[3] ? p : [p[0], p[1], p[2], widthAt(pts, p)]));
  if (C.length > 1 && C[0][2] < C[C.length - 1][2]) C.reverse();   // upstream first
  if (C.length < 2) { o.type = 'pond'; return spec({ ...area, water: { ...w, type: 'pond' } }, gz); }
  const cum = [0]; for (let i = 1; i < C.length; i++) cum.push(cum[i - 1] + Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]));
  o.centre = C; o.cum = cum; o.length = cum[cum.length - 1]; o.falls = fallsOf(C); o.speed = +w.speed > 0 ? +w.speed : DEF.speed;
  const wMean = C.reduce((s, p) => s + p[3], 0) / C.length; o.width = wMean;
  o.discharge = +w.discharge > 0 ? +w.discharge : +(0.6 * wMean * depth * o.speed).toFixed(2);   // the mean velocity is about 0.6 of the surface speed
  o.level = C[0][2]; o.outlet = C[C.length - 1][2]; return o; }
// at a point of the surface: its level, the distance down the stream (s) and across it (d), for the ripples that flow with it
export function sample(o, x, y) {
  if (!o.centre) return { z: o.level, s: x, d: y };
  const C = o.centre; let best = null, bd = Infinity;
  for (let i = 1; i < C.length; i++) { const a = C[i - 1], b = C[i], ab = [b[0] - a[0], b[1] - a[1]], L2 = dot(ab, ab), u = L2 ? Math.max(0, Math.min(1, ((x - a[0]) * ab[0] + (y - a[1]) * ab[1]) / L2)) : 0, px = a[0] + ab[0] * u, py = a[1] + ab[1] * u, dd = Math.hypot(x - px, y - py);
    if (dd < bd - 1e-9) { bd = dd; best = { i, u, side: Math.sign(ab[0] * (y - a[1]) - ab[1] * (x - a[0])) || 1 }; } }
  const a = C[best.i - 1], b = C[best.i], fall = a[2] - b[2] >= 0.4, u = best.u, z = fall ? (u < 0.12 ? a[2] : b[2]) : a[2] + (b[2] - a[2]) * u;
  return { z, s: o.cum[best.i - 1] + (o.cum[best.i] - o.cum[best.i - 1]) * u, d: bd * best.side }; }
// split triangles (flat [x, y, x, y, x, y, …]) until no edge is longer than maxLen, so a surface can follow its levels
export function subdivide(tris, maxLen = 2.5) {
  let cur = tris, guard = 0;
  while (guard++ < 12) { const nx = []; let split = false;
    for (let i = 0; i < cur.length; i += 6) { const A = [cur[i], cur[i + 1]], B = [cur[i + 2], cur[i + 3]], C = [cur[i + 4], cur[i + 5]], ab = len(sub(A, B)), bc = len(sub(B, C)), ca = len(sub(C, A)), m = Math.max(ab, bc, ca);
      if (m <= maxLen) { nx.push(...A, ...B, ...C); continue; } split = true;
      if (m === ab) { const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]; nx.push(...A, ...M, ...C, ...M, ...B, ...C); }
      else if (m === bc) { const M = [(B[0] + C[0]) / 2, (B[1] + C[1]) / 2]; nx.push(...A, ...B, ...M, ...A, ...M, ...C); }
      else { const M = [(C[0] + A[0]) / 2, (C[1] + A[1]) / 2]; nx.push(...A, ...B, ...M, ...M, ...B, ...C); } }
    cur = nx; if (!split || cur.length > 600000) break; }
  return cur; }
export function inside(pts, x, y) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
export function distTo(pts, x, y) { if (inside(pts, x, y)) return 0; let d = Infinity; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], ab = sub(b, a), L = dot(ab, ab), u = L ? Math.max(0, Math.min(1, ((x - a[0]) * ab[0] + (y - a[1]) * ab[1]) / L)) : 0; d = Math.min(d, Math.hypot(x - a[0] - ab[0] * u, y - a[1] - ab[1] * u)); } return d; }
// the sound of falling water, as a point source at each fall: sound power from the power of the falling water (ρ g Q h) with an
// acoustic efficiency of about 1e-6 to 1e-5 (an assumption to edit; measured waterfalls span a wide range), never below 70 dB
export function fallPower(o, f, eff = 3e-6) { const Q = Math.max(0.01, o.discharge || 0.05), P = 1000 * 9.81 * Q * f.drop; return Math.max(70, 10 * Math.log10(Math.max(1e-12, P * eff) / 1e-12)); }
