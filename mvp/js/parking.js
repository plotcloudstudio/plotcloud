// Parking layout (2026-11-18): stall rows and aisles generated in a drawn area, surface or underground. Plan metres, x east, y north.
// Pure functions, no DOM (the Node tests run the same code).
// · Rows: double-loaded modules (stall | aisle | stall) laid across the area at a row direction and an offset; the aisles are cut to
//   the free floor, cross aisles join neighbouring aisles at their ends, and only aisles reached from an entrance keep their stalls.
// · Candidates: the row directions of the area's longest edges (and the column grid underground, and one the person set), each at
//   several offsets across the module (and offsets that put the column lines between modules); seeded, so the same input gives the
//   same layouts. The best found by this search is shown: it is not proven optimal.
// · Stalls: along each row the free runs are found; the stall types are then assigned per run exactly for the run lengths (maximum
//   count; or large first, then the rest; or a mix to target shares, by dynamic programming across the runs); accessible stalls with
//   their access aisle go first, in the runs nearest an entrance. Every stall is checked again at the end (inside the area, clear of
//   obstacles, aisles and other stalls, its aisle reached): one that fails is marked invalid and not counted.
import { area, bbox, boxesMeet, cross, dist, dot, gap, inPoly, rasterUnion, segDist, sub, centroid } from './geom2d.js';

const DEG = Math.PI / 180;
export const QUALITY = { draft: { angles: 4, offsets: 3, step: 0.25 }, standard: { angles: 6, offsets: 5, step: 0.2 }, refined: { angles: 12, offsets: 8, step: 0.1 } };
/** stall types: dimensions are editable design assumptions (not a bylaw); width × length in metres */
export const CATEGORIES = [
  { id: 'standard', name: 'Standard', w: 2.5, l: 5.0, enabled: true, share: null },
  { id: 'compact', name: 'Compact', w: 2.3, l: 4.6, enabled: false, share: null },
  { id: 'large', name: 'Large / SUV', w: 2.7, l: 5.5, enabled: false, share: null },
  { id: 'accessible', name: 'Accessible', w: 2.5, l: 5.0, accessAisle: 1.525, accessible: true, enabled: true, count: 2 },
  { id: 'ev', name: 'EV charging', w: 2.5, l: 5.0, enabled: false, share: null },
  { id: 'van', name: 'Van accessible', w: 2.5, l: 5.0, accessAisle: 2.5, accessible: true, enabled: false, count: 0 },
];
/** the usual aisle width for a stall angle (two-way at 90°, one-way when angled); editable */
/** 2010 ADA Standards 208.2: accessible spaces required for a lot of `total` spaces, and 208.2.4: one in six of them van
 *  accessible (at least one). The access aisle is 60 in (1.525 m) beside a car space, 502.3.1. */
export function adaRequired(total) {
  const n = Math.max(0, Math.floor(total || 0)); if (!n) return { accessible: 0, van: 0 };
  const T = [[25, 1], [50, 2], [75, 3], [100, 4], [150, 5], [200, 6], [300, 7], [400, 8], [500, 9]], row = T.find(([m]) => n <= m);
  const accessible = row ? row[1] : n <= 1000 ? Math.ceil(n * 0.02) : 20 + Math.ceil((n - 1000) / 100);
  return { accessible, van: Math.max(1, Math.ceil(accessible / 6)) };
}
const aisleEU = (angle, oneWay) => (angle >= 89 ? 6.0 : angle >= 59 ? (oneWay ? 4.8 : 6.0) : (oneWay ? 4.0 : 6.0));
/**
 * Dimension presets (2026-11-28). North America: the City of Toronto Zoning By-law 569-2013, Chapter 200 (read on toronto.ca,
 * consolidation of 31 July 2024): a parking space 2.6 × 5.6 m (200.5.1.10(2)(A)), parallel 2.6 × 6.7 m (200.5.1.10(2)(C)); drive
 * aisles 6.0 m for spaces at 70–90° to the aisle, 5.5 m at 50–70°, 4.0 m under 50° (200.5.1(3)); a 1.5 m accessible aisle beside an
 * accessible space (200.15.1(3)). Two-way traffic past angled spaces: 6.0 m (an engine assumption: the by-law gives one width per
 * angle). Europe: the earlier defaults (ULI and FGSV EAR practice, as the method report cites).
 */
export const STANDARDS = {
  na: { id: 'na', name: 'North America (Toronto Zoning By-law 569-2013)', stall: { w: 2.6, l: 5.6 }, parallel: { w: 2.6, l: 6.7 }, access: 1.525, vanAccess: 2.5,   /* the access aisle: 1.525 m, ADA 502.3.1 (60 in), which also meets Toronto's 1.5 m */
    aisle: (angle, oneWay) => (angle >= 70 ? 6.0 : oneWay ? (angle >= 50 ? 5.5 : 4.0) : 6.0),
    src: 'City of Toronto Zoning By-law 569-2013, Chapter 200: space 2.6 × 5.6 m (200.5.1.10(2)(A)); aisle 6.0 m at 70–90°, 5.5 m at 50–70°, 4.0 m under 50° (200.5.1(3)); accessible aisle 1.5 m (200.15.1(3)), here 1.525 m to meet ADA 502.3.1 as well' },
  eu: { id: 'eu', name: 'Europe (earlier defaults)', stall: { w: 2.5, l: 5.0 }, parallel: { w: 2.0, l: 6.0 }, access: 1.525, vanAccess: 2.5, aisle: aisleEU, src: 'ULI Dimensions of Parking and FGSV EAR practice, as cited in the method report' },
};
/** the stall types for a preset: standard and accessible from it; compact, large and EV sizes are engine assumptions */
export function categoriesFor(std = 'eu') { const S = STANDARDS[std] || STANDARDS.eu; return CATEGORIES.map((c) => c.id === 'standard' || c.id === 'ev' || c.id === 'accessible' || c.id === 'van' ? { ...c, w: S.stall.w, l: S.stall.l, ...(c.id === 'accessible' ? { accessAisle: S.access } : c.id === 'van' ? { accessAisle: S.vanAccess } : {}) } : c.id === 'large' ? { ...c, w: Math.max(c.w, S.stall.w + 0.3), l: Math.max(c.l, S.stall.l + 0.3) } : { ...c }); }
export const aisleFor = (angle, oneWay, std) => (STANDARDS[std] || STANDARDS.eu).aisle(angle, oneWay);

// ---- geometry helpers: interiors disjoint (touching allowed), a convex polygon inside a region ----
const orient = (a, b, c) => cross(sub(b, a), sub(c, a));
const properCross = (a, b, c, d) => { const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b), e = 1e-9; return ((o1 > e && o2 < -e) || (o1 < -e && o2 > e)) && ((o3 > e && o4 < -e) || (o3 < -e && o4 > e)); };
function inStrict(p, P) { let c = false; for (let i = 0, n = P.length, j = n - 1; i < n; j = i++) { const a = P[i], b = P[j]; if (segDist(p, a, b).d <= 1e-7) return false; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
const edgesCross = (P, Q) => { for (let i = 0; i < P.length; i++) for (let j = 0; j < Q.length; j++) if (properCross(P[i], P[(i + 1) % P.length], Q[j], Q[(j + 1) % Q.length])) return true; return false; };
/** interiors disjoint: no proper crossing, neither has a vertex strictly inside the other, and the centres are not inside each other */
export function disjoint(P, Q) { if (edgesCross(P, Q)) return false; if (P.some((p) => inStrict(p, Q)) || Q.some((q) => inStrict(q, P))) return false; const c = centroid(P), d = centroid(Q); return !inStrict(c, Q) && !inStrict(d, P); }
const edgeGap = (P, Q) => { let m = Infinity; for (let i = 0; i < P.length; i++) for (let j = 0; j < Q.length; j++) { const a = P[i], b = P[(i + 1) % P.length], c = Q[j], d = Q[(j + 1) % Q.length]; if (properCross(a, b, c, d)) return 0; m = Math.min(m, segDist(a, c, d).d, segDist(b, c, d).d, segDist(c, a, b).d, segDist(d, a, b).d); } return m; };

// a rectangle in a (u, v) frame: u along the rows, v across
const frame = (th) => { const d = [Math.cos(th), Math.sin(th)], n = [-d[1], d[0]]; return { d, n, P: (u, v) => [d[0] * u + n[0] * v, d[1] * u + n[1] * v], U: (p) => dot(p, d), V: (p) => dot(p, n) }; };
const rectUV = (F, u0, u1, v0, v1) => [F.P(u0, v0), F.P(u1, v0), F.P(u1, v1), F.P(u0, v1)];
// a stall at angle α to its aisle, drawn as the stripes do: a parallelogram from the aisle edge (v = ve) going away on side s (+1 / −1),
// its stripes leaning at α, wide enough along the aisle (w / sin α) and deep enough (l·sin α + w·cos α) to hold the w × l car at α
function stallUV(F, u, ve, s, w, l, a) { if (a >= 89.9 * DEG) return rectUV(F, u, u + w, Math.min(ve, ve + s * l), Math.max(ve, ve + s * l));
  const p = w / Math.sin(a), Dp = l * Math.sin(a) + w * Math.cos(a), sh = Dp / Math.tan(a), v1 = ve + s * Dp;
  const P = [F.P(u, ve), F.P(u + p, ve), F.P(u + p + sh, v1), F.P(u + sh, v1)]; return s > 0 ? P : P.reverse(); }
/** how a stall of w × l at angle α sits along a row: pitch between neighbours, extent along the row, depth from the aisle */
export const stallFit = (w, l, aDeg) => { const a = aDeg * DEG; if (aDeg >= 89.9) return { pitch: w, ext: w, depth: l }; const p = w / Math.sin(a), Dp = l * Math.sin(a) + w * Math.cos(a); return { pitch: p, ext: p + Dp / Math.tan(a), depth: Dp }; };

// seeded random numbers (mulberry32)
const rng = (seed) => { let t = (seed >>> 0) || 1; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; };

/**
 * @param o {
 *   region: { outer, holes: [] }, obstacles: [{ id, kind ('column'|'core'|'ramp'|'exclusion'|'building'|'locked'), poly, clear? }],
 *   entrances: [[x, y]], categories (see CATEGORIES; share 0–1 for mode C), angle (90|60|45), aisle (m), oneWay, setback (m, from the
 *   area's edge), wallClear (m, underground), underground, mode 'A'|'B'|'C'|'D', seed, quality, orient (degrees, or null), grid ({ angle
 *   (degrees), xs, ys } for the column lines underground), locked: [{ cat, poly }], fixed: { angle (deg), offset } (tests)
 * }
 */
export function generate(o) {
  const Q = QUALITY[o.quality] || QUALITY.standard, step = o.step || Q.step, aDeg = +o.angle || 90, a = aDeg * DEG, A = +o.aisle || aisleFor(aDeg, o.oneWay, o.standard);
  const region = { outer: o.region.outer, holes: o.region.holes || [] }, gross = Math.abs(area(region.outer)) - region.holes.reduce((s, h) => s + Math.abs(area(h)), 0);
  const edgeClr = o.underground ? (o.wallClear ?? 0.3) : (o.setback ?? 0);
  // (2026-11-28) adaAuto: the accessible counts raised to ADA 208.2 for the lot found (van spaces 208.2.4), a van type added if needed
  const cats0 = (o.categories || categoriesFor(o.standard)).filter((c) => c.enabled !== false), vanDef = (categoriesFor(o.standard).find((c) => c.id === 'van'));
  const cats = o.adaAuto && !cats0.some((c) => c.accessible && c.accessAisle >= 2.4) && vanDef ? [...cats0, { ...vanDef, enabled: true, count: 0, auto: true }] : cats0;
  const regular = cats.filter((c) => !c.accessible), acc = cats.filter((c) => c.accessible && ((c.count || 0) > 0 || o.adaAuto));
  // two accessible spaces of a type share one access aisle between them (2010 ADA 502.3.4 allows it): a pair is one unit
  const pairs = o.sharedAisles === false ? [] : acc.filter((c) => c.accessAisle).map((c) => ({ ...c, id: c.id + '~2', pairOf: c.id, w: 2 * c.w, pairW: 2 * c.w + c.accessAisle }));
  if (!regular.length && !acc.length) return { ok: false, error: 'Enable at least one stall type' };
  const fits = new Map([...cats.map((c) => [c.id, stallFit(c.w + (c.accessAisle || 0), c.l, aDeg)]), ...pairs.map((c) => [c.id, stallFit(c.pairW, c.l, aDeg)])]), D = Math.max(...cats.map((c) => fits.get(c.id).depth)), M = 2 * D + A;
  const obstacles = [...(o.obstacles || []), ...(o.locked || []).map((s, i) => ({ id: 'locked' + i, kind: 'locked', poly: s.poly, clear: 0 }))].filter((x) => x.poly && x.poly.length >= 3).map((x) => ({ ...x, bb: bbox(x.poly) }));
  const holes = region.holes.map((h, i) => ({ id: 'hole' + i, kind: 'hole', poly: h, bb: bbox(h), clear: 0 }));
  const outerBB = bbox(region.outer);
  // is a convex shape on free floor: inside the area (clear of its edge by the setback), clear of holes and obstacles
  const free = (P, extra = []) => { const bb = bbox(P);
    if (!boxesMeet(bb, outerBB)) return false; if (!P.every((p) => inPoly(p, region.outer))) return false; if (edgesCross(P, region.outer) || region.outer.some((q) => inStrict(q, P))) return false;
    if (edgeClr > 0 && edgeGap(P, region.outer) < edgeClr - 1e-9) return false;
    for (const H of holes) if (boxesMeet(bb, H.bb, edgeClr) && (edgeClr > 0 ? gap(P, H.poly).d < edgeClr - 1e-9 : !disjoint(P, H.poly))) return false;
    for (const X of obstacles) { const c = X.clear ?? 0; if (boxesMeet(bb, X.bb, c) && (c > 0 ? gap(P, X.poly).d < c - 1e-9 : !disjoint(P, X.poly))) return false; }
    for (const X of extra) if (boxesMeet(bb, X.bb) && !disjoint(P, X.poly)) return false; return true; };
  // runs along u where a slice (u, u + step) × [v0, v1] is free
  const runs = (F, v0, v1, u0, u1, extra) => { const out = []; let cur = null; for (let u = u0; u + step <= u1 + 1e-9; u += step) { const ok = free(rectUV(F, u, u + step, v0, v1), extra); if (ok) { if (cur) cur[1] = u + step; else cur = [u, u + step]; } else if (cur) { out.push(cur); cur = null; } } if (cur) out.push(cur); return out; };

  // ---- the candidate row directions and offsets ----
  const R = rng(o.seed ?? 1), dirs = [];
  const addDir = (deg) => { const d = ((deg % 180) + 180) % 180; if (!dirs.some((x) => Math.abs(((x - d + 270) % 180) - 90) < 1)) dirs.push(d); };
  if (o.fixed) addDir(o.fixed.angle); else {
    if (o.orient != null && o.orient !== '') addDir(+o.orient);
    if (o.underground && o.grid) { addDir(o.grid.angle || 0); addDir((o.grid.angle || 0) + 90); }
    const edges = region.outer.map((p, i) => { const q = region.outer[(i + 1) % region.outer.length]; return { L: dist(p, q), deg: Math.atan2(q[1] - p[1], q[0] - p[0]) / DEG }; }).sort((x, y) => y.L - x.L);
    for (const e of edges) { addDir(e.deg); addDir(e.deg + 90); if (dirs.length >= Q.angles) break; }
    while (dirs.length < Q.angles) addDir(R() * 180); }
  const cands = [];
  for (const deg of dirs.slice(0, o.fixed ? 1 : Q.angles)) { const offs = new Set();
    if (o.fixed) offs.add(+o.fixed.offset || 0); else { for (let k = 0; k < Q.offsets; k++) offs.add(+(M * k / Q.offsets).toFixed(3));
      if (o.underground && o.grid) { const F = frame(deg * DEG), lines = [...new Set([...(o.grid.pts || []).map((q) => +F.V(q).toFixed(1)), ...(o.grid.xs || []).map((x) => F.V([x, 0])), ...(o.grid.ys || []).map((y) => F.V([0, y]))])].sort((p, q) => p - q), vmin = Math.min(...region.outer.map(F.V)); for (const v of lines.slice(0, 3)) offs.add(+((((v - vmin) % M) + M) % M).toFixed(3)); } }
    for (const off of offs) cands.push({ deg, off }); }

  // ---- one candidate: aisles, cross aisles, reach, rows, stall types ----
  const build = (cd) => {
    const F = frame(cd.deg * DEG), us = region.outer.map(F.U), vs = region.outer.map(F.V), umin = Math.min(...us), umax = Math.max(...us), vmin = Math.min(...vs), vmax = Math.max(...vs);
    const lines = []; for (let v = vmin + cd.off; v + M <= vmax + 1e-9; v += M) lines.push(v + D + A / 2);
    // aisle pieces: free runs of the aisle strip, at least two stalls long
    const minRun = Math.max(5, 2 * Math.min(...cats.map((c) => fits.get(c.id).pitch)));
    const pieces = []; lines.forEach((c, k) => { for (const [u0, u1] of runs(F, c - A / 2, c + A / 2, umin, umax, [])) if (u1 - u0 >= minRun) pieces.push({ id: pieces.length, k, c, u0, u1, poly: rectUV(F, u0, u1, c - A / 2, c + A / 2) }); });
    pieces.forEach((p) => { p.bb = bbox(p.poly); });
    // cross aisles: between pieces on neighbouring lines, at both ends of their overlap (moved inwards until the strip is free)
    const spines = [], link = pieces.map(() => new Set());
    for (const p of pieces) for (const q of pieces) { if (q.k !== p.k + 1) continue; const lo = Math.max(p.u0, q.u0), hi = Math.min(p.u1, q.u1); if (hi - lo < A) continue;
      const tryAt = (u) => { const S = rectUV(F, u, u + A, p.c, q.c); return free(S) ? S : null; };
      const ends = []; for (let u = lo; u + A <= hi + 1e-9; u += step) { const S = tryAt(u); if (S) { ends.push([u, S]); break; } }
      for (let u = hi - A; u >= lo - 1e-9; u -= step) { const S = tryAt(u); if (S) { if (!ends.length || Math.abs(ends[0][0] - u) > A) ends.push([u, S]); break; } }
      for (const [u, S] of ends) { spines.push({ u, from: p.id, to: q.id, poly: S, bb: bbox(S) }); link[p.id].add(q.id); link[q.id].add(p.id); } }
    // the entrances: a piece within reach of one (its strip within the aisle width of the point, beyond the setback), or a connector
    const roots = new Set(), connectors = [];
    for (const E of o.entrances || []) { let best = null, bd = Infinity; for (const p of pieces) { const d = Math.max(0, gap([E, [E[0] + 1e-3, E[1]], [E[0], E[1] + 1e-3]], p.poly).d); if (d < bd) { bd = d; best = p; } }
      if (best && bd <= A + edgeClr + 1.0) { roots.add(best.id); (best.ent ||= []).push(F.U(E)); continue; }
      // a connector across the rows from the entrance to the nearest aisle line, if the strip is free
      const uE = F.U(E), vE = F.V(E), p2 = pieces.filter((p) => uE >= p.u0 + A / 2 && uE <= p.u1 - A / 2).sort((x, y) => Math.abs(x.c - vE) - Math.abs(y.c - vE))[0];
      if (p2) { const S = rectUV(F, uE - A / 2, uE + A / 2, Math.min(vE, p2.c), Math.max(vE, p2.c)); connectors.push({ poly: S, bb: bbox(S), to: p2.id, u: uE }); roots.add(p2.id); } }
    const reach = new Set(roots), stack = [...roots]; while (stack.length) { const x = stack.pop(); for (const y of link[x]) if (!reach.has(y)) { reach.add(y); stack.push(y); } }
    // (2026-11-28) traffic: one-way aisle lines run opposite ways in turn, so neighbouring lines and the cross aisles at both ends of
    // their overlap make loops; a cross aisle carries the traffic from the line that arrives at that end to the next
    pieces.forEach((p) => { p.flow = o.oneWay ? (p.k % 2 ? -1 : 1) : 0; });
    for (const S2 of spines) { const p = pieces[S2.from], q = pieces[S2.to], mid = (Math.max(p.u0, q.u0) + Math.min(p.u1, q.u1)) / 2; S2.flow = o.oneWay ? ((S2.u + A / 2 > mid) === (p.flow > 0) ? 1 : -1) : 0; }
    const pairSp = new Map(); for (const S2 of spines) { const k2 = S2.from + '-' + S2.to; pairSp.set(k2, (pairSp.get(k2) || 0) + 1); }
    const oneWayOpen = o.oneWay ? [...pairSp.values()].filter((n) => n < 2).length : 0;
    // dead ends: an aisle beyond its last junction (a cross aisle, a connector, an entrance) with stalls along it. Drivers must turn
    // there: a turnaround (a T-head one aisle wide across both stall bands) is kept at its end, unless dead ends are allowed
    const turns = [], minPitch = Math.min(...cats.map((c) => fits.get(c.id).pitch)); let deadEnds = 0;
    for (const p of pieces) { if (!reach.has(p.id)) continue; const J = [];
      for (const S2 of spines) if (S2.from === p.id || S2.to === p.id) J.push(S2.u, S2.u + A);
      for (const C of connectors) if (C.to === p.id) J.push(C.u - A / 2, C.u + A / 2);
      for (const u of p.ent || []) J.push(u - A / 2, u + A / 2);
      if (!J.length) continue; const jlo = Math.min(...J), jhi = Math.max(...J);
      for (const [end, len] of [[p.u0, jlo - p.u0], [p.u1, p.u1 - jhi]]) { if (len < minPitch + 0.5) continue; deadEnds++;
        if (o.deadEnds === 'allow') continue; const u0 = end === p.u0 ? p.u0 : p.u1 - A, T = rectUV(F, u0, u0 + A, p.c - A / 2 - D, p.c + A / 2 + D); turns.push({ poly: T, bb: bbox(T), piece: p.id, u: u0, kind: 'turnaround' }); } }
    const circ = [...pieces.filter((p) => reach.has(p.id)), ...spines.filter((s) => reach.has(s.from)), ...connectors, ...turns];
    // the accessible spaces go nearest the building's doors (else the vehicle entrances)
    const targets = (o.doors && o.doors.length ? o.doors : o.entrances) || [[Infinity, Infinity]];
    // how near a run's nearer end is to a door, and which end (the accessible spaces go at that end)
    const nearEnd = (u0, u1, ve) => { const d0 = Math.min(...targets.map((E) => dist(E, F.P(u0, ve)))), d1 = Math.min(...targets.map((E) => dist(E, F.P(u1, ve)))); return { near: Math.min(d0, d1), accHi: d1 < d0 }; };
    // rows: both sides of each reached piece, the free runs of the band (clear of cross aisles, connectors and turnarounds)
    const rows0 = []; for (const p of pieces) { if (!reach.has(p.id)) continue; for (const s of [-1, 1]) { const ve = p.c + s * A / 2, v0 = Math.min(ve, ve + s * D), v1 = Math.max(ve, ve + s * D);
      for (const [u0, u1] of runs(F, v0, v1, p.u0, p.u1, [...spines, ...connectors, ...turns])) rows0.push({ piece: p.id, side: s, ve, v0, v1, u0, u1, len: u1 - u0, key: p.k * 2 + (s > 0 ? 1 : 0), lean: p.flow || 1, ...nearEnd(u0, u1, ve) }); } }
    // islands (2026-11-28): at the ends of each row, and if asked one every N standard stalls; the rows are the runs between them
    const IS = o.islands || {}, iL = +IS.len || 1.8, every = +IS.every || 0, pS = Math.min(...(regular.length ? regular : cats).map((c) => fits.get(c.id).pitch)), islands = [], rows = [];
    for (const r of rows0) { let u0 = r.u0, u1 = r.u1;
      if (IS.ends && u1 - u0 >= 2 * iL + 2 * pS) { islands.push({ poly: rectUV(F, u0, u0 + iL, r.v0, r.v1), kind: 'end' }, { poly: rectUV(F, u1 - iL, u1, r.v0, r.v1), kind: 'end' }); u0 += iL; u1 -= iL; }
      if (every > 0) { const chunk = every * pS; while (u1 - u0 > chunk + iL + pS) { rows.push({ ...r, u0, u1: u0 + chunk, len: chunk, ...nearEnd(u0, u0 + chunk, r.ve) }); islands.push({ poly: rectUV(F, u0 + chunk, u0 + chunk + iL, r.v0, r.v1), kind: 'interior' }); u0 += chunk + iL; } }
      rows.push({ ...r, u0, u1, len: u1 - u0, ...nearEnd(u0, u1, r.ve) }); }
    return { F, pieces, spines, connectors, turns, islands, reach, rows, circ, lines, deadEnds, oneWayOpen };
  };

  // the stall types in one run: how many of each fit (the sequence's length: the pitches of all but the last, plus the last's extent)
  const need = (counts) => { let n = 0, len = 0, lastExt = 0; for (const c of [...pairs, ...cats]) { const k = counts[c.id] || 0; if (!k) continue; const f = fits.get(c.id); len += k * f.pitch; lastExt = f.ext - f.pitch; n += k; } return n ? len + Math.max(0, lastExt) : 0; };
  const order = regular;   // the person's order is the priority (mode B: the first is the large type)
  const assign = (rowsIn, modeIn) => {
    const rows = rowsIn.map((r) => ({ ...r, counts: {}, left: r.len }));
    // accessible first: in the runs nearest an entrance
    const accLeft = {}; for (const c of acc) accLeft[c.id] = c.count || 0;
    if (o.adaAuto && regular.length) { const sm = regular.slice().sort((x, y) => fits.get(x.id).pitch - fits.get(y.id).pitch)[0], f = fits.get(sm.id);
      const Nup = rows.reduce((m, r) => m + Math.max(0, Math.floor((r.len - (f.ext - f.pitch)) / f.pitch + 1e-9)), 0), nd = adaRequired(Nup), vanC = acc.find((c) => c.accessAisle >= 2.4), carC = acc.find((c) => c.accessAisle && c.accessAisle < 2.4);
      if (vanC) accLeft[vanC.id] = Math.max(accLeft[vanC.id], nd.van); if (carC) accLeft[carC.id] = Math.max(accLeft[carC.id], nd.accessible - (vanC ? accLeft[vanC.id] : 0)); }
    const accAsked = { ...accLeft };
    for (const r of rows.slice().sort((x, y) => x.near - y.near)) for (const c of acc) { const pc = pairs.find((x) => x.pairOf === c.id);
      while (pc && accLeft[c.id] >= 2) { const t = { ...r.counts, [pc.id]: (r.counts[pc.id] || 0) + 1 }; if (need(t) > r.len + 1e-9) break; r.counts = t; accLeft[c.id] -= 2; }
      while (accLeft[c.id] > 0) { const t = { ...r.counts, [c.id]: (r.counts[c.id] || 0) + 1 }; if (need(t) > r.len + 1e-9) break; r.counts = t; accLeft[c.id]--; } }
    for (const r of rows) r.left = r.len - (need(r.counts) ? need(r.counts) : 0);
    const mode = modeIn || o.mode || 'A', note = [];
    const fillRow = (r, list) => { for (const c of list) { const base = need(r.counts); let k = 0; while (need({ ...r.counts, [c.id]: (r.counts[c.id] || 0) + k + 1 }) <= r.len + 1e-9) k++; void base; if (k) r.counts[c.id] = (r.counts[c.id] || 0) + k; } };
    if (mode === 'A' || mode === 'D') { const best = regular.slice().sort((x, y) => fits.get(x.id).pitch - fits.get(y.id).pitch)[0]; if (best) for (const r of rows) fillRow(r, [best]); }
    else if (mode === 'B') { for (const r of rows) fillRow(r, order); }
    else if (mode === 'C') {   // dynamic programming over the runs: the tracked types' counts → the most of the filler; then the mix nearest the shares
      const pitchOf = (c) => fits.get(c.id).pitch; let tracked = regular.filter((c) => +c.share > 0), filler = regular.filter((c) => !(+c.share > 0)).sort((x, y) => pitchOf(x) - pitchOf(y))[0] || null;
      const sum0 = tracked.reduce((m, c) => m + +c.share, 0), shareOf = Object.fromEntries(tracked.map((c) => [c.id, sum0 > 1 + 1e-9 ? +c.share / sum0 : +c.share]));
      if (sum0 > 1 + 1e-9) note.push(`The target shares add up to ${(sum0 * 100).toFixed(0)} %: scaled to 100 % (${tracked.map((c) => `${c.name} ${(shareOf[c.id] * 100).toFixed(0)} %`).join(', ')})`);
      // with no type left to fill the rest, the last one with a share fills it (its count is then the most that fits): one count fewer to search
      let fillShare = null; if (!filler && tracked.length) { filler = tracked.at(-1); fillShare = shareOf[filler.id]; tracked = tracked.slice(0, -1); }
      const small = regular.slice().sort((x, y) => pitchOf(x) - pitchOf(y))[0], cnt1 = (r, c) => { let k = 0; while (need({ ...r.counts, [c.id]: k + 1 }) <= r.len + 1e-9) k++; return k; };
      const Nup = rows.reduce((m, r) => m + cnt1(r, small), 0), cap = Object.fromEntries(tracked.map((c) => [c.id, Math.ceil(shareOf[c.id] * Nup) + 1]));
      // per run, every choice of tracked counts (within the caps) with the most filler that fits; lengths by arithmetic, conservatively
      // (the tail of a run is the longest of the types in it); the states are the tracked totals, with a back-pointer per run
      const P = tracked.map(pitchOf), Tl = tracked.map((c) => fits.get(c.id).ext - pitchOf(c)), pF = filler ? pitchOf(filler) : 0, tF = filler ? fits.get(filler.id).ext - pF : 0, capV = tracked.map((c) => cap[c.id]);
      let layer = new Map([['', { tr: tracked.map(() => 0), fill: 0 }]]); const back = []; let approx = false;
      for (const r of rows) { const base = need(r.counts), accTail = base ? Math.max(0, ...acc.filter((c) => r.counts[c.id]).map((c) => fits.get(c.id).ext - pitchOf(c))) : 0, baseP = base ? base - accTail : 0, opts = [];
        const rec = (j, ks, used, tail) => { if (j === tracked.length) { let fl = 0; if (filler) { const room = r.len + 1e-9 - used; const t2 = Math.max(tail, tF); fl = room - t2 >= 0 ? Math.max(0, Math.floor((room - t2) / pF + 1e-9)) : 0; } opts.push({ ks: ks.slice(), fl }); return; }
          for (let k = 0; k <= capV[j]; k++) { const u2 = used + k * P[j], t2 = k ? Math.max(tail, Tl[j]) : tail; if (k && u2 + t2 > r.len + 1e-9) break; ks[j] = k; rec(j + 1, ks, u2, t2); } ks[j] = 0; };
        rec(0, tracked.map(() => 0), baseP, accTail);
        const next = new Map(), bp = new Map();
        for (const [key0, st] of layer) for (const op of opts) { let over = false; const tr = st.tr.map((x, q) => { const y = x + op.ks[q]; if (y > capV[q]) over = true; return y; }); if (over) continue;
          const key = tr.join(','), val = st.fill + op.fl, cur = next.get(key); if (!cur || val > cur.fill) { next.set(key, { tr, fill: val }); bp.set(key, [key0, op]); } }
        if (next.size > 20000) { approx = true; const keep = [...next.entries()].sort((x, y) => y[1].fill - x[1].fill).slice(0, 20000); layer = new Map(keep); } else layer = next; back.push(bp); }
      const states = layer;
      // the mix: each tracked type within one stall of its share of the total; the most stalls among those (else the least short)
      // (the counts are capped at the share of the most stalls possible, plus one: a mix with more of a tracked type cannot be nearer its share)
      let best = null, Nmax = 0; const accN = rows.reduce((m, r) => m + acc.reduce((q, c) => q + (r.counts[c.id] || 0), 0), 0);
      for (const [key, st] of states) { const N = st.fill + st.tr.reduce((m, x) => m + x, 0) + accN; if (!N) continue; Nmax = Math.max(Nmax, N);
        const off = tracked.reduce((m, c, j) => m + Math.max(0, Math.abs(st.tr[j] - shareOf[c.id] * N) - 1), 0) + (fillShare != null ? Math.max(0, Math.abs(st.fill - fillShare * N) - 1) : 0), met = off <= 1e-9;
        if (!best || (met && !best.met) || (met === best.met && (met ? N > best.N : off < best.off - 1e-9 || (Math.abs(off - best.off) <= 1e-9 && N > best.N)))) best = { ...st, key, off, N, met }; }
      if (best) { let key = best.key; for (let i = rows.length - 1; i >= 0; i--) { const [k0, op] = back[i].get(key); tracked.forEach((c, q) => { if (op.ks[q]) rows[i].counts[c.id] = (rows[i].counts[c.id] || 0) + op.ks[q]; }); if (op.fl && filler) rows[i].counts[filler.id] = (rows[i].counts[filler.id] || 0) + op.fl; key = k0; } }
      const targets = best ? Object.fromEntries([...tracked, ...(fillShare != null ? [filler] : [])].map((c) => [c.id, +(shareOf[c.id] * best.N).toFixed(1)])) : null;
      if (best && best.met && best.N < Nmax * 0.95) note.push(`Meeting the mix leaves ${Nmax - best.N} fewer stalls than the rows can hold (${best.N} of ${Nmax})`);
      if (best && best.off > 0) note.push(`The target mix cannot be met within one stall in the rows found (${tracked.map((c, j) => `${c.name} ${best.tr[j]} for a target of ${(shareOf[c.id] * best.N).toFixed(1)}`).join(', ')})`);
      if (approx) note.push('The mix search was cut to the 20,000 best states: the result may be short of the best mix');
      return { rows, accShort: Object.values(accLeft).reduce((s, x) => s + x, 0), accAsked, note, targets, missed: !!(best && best.off > 0) }; }
    return { rows, accShort: Object.values(accLeft).reduce((s, x) => s + x, 0), accAsked, note, targets: null };
  };

  // stalls placed along each run, in the order accessible, then the person's order; then every one checked again
  const place = (B, asg) => { const stalls = [];
    for (const r of asg.rows) { const p = B.pieces[r.piece]; let u = r.u0; const mirrored = r.lean < 0 && aDeg < 89.9, seq = r.accHi !== mirrored ? [...regular, ...pairs, ...acc] : [...pairs, ...acc, ...regular], sinA = aDeg >= 89.9 ? 1 : Math.sin(a), um = (r.u0 + r.u1) / 2;
      // (2026-11-28) one-way aisles: angled stalls lean the way the traffic goes (the row mirrored along its length when it runs −u)
      const L = r.lean < 0 && aDeg < 89.9 ? (P) => P && P.map((q) => B.F.P(2 * um - B.F.U(q), B.F.V(q))).reverse() : (P) => P;
      for (const c of seq) for (let k = 0; k < (r.counts[c.id] || 0); k++) { const f = fits.get(c.id);
        if (c.pairOf) { const b0 = acc.find((x) => x.id === c.pairOf), ax = b0.accessAisle, b1 = stallUV(B.F, u, r.ve, r.side, b0.w, b0.l, a), ac = stallUV(B.F, u + b0.w / sinA, r.ve, r.side, ax, b0.l, a), b2 = stallUV(B.F, u + (b0.w + ax) / sinA, r.ve, r.side, b0.w, b0.l, a), fp1 = stallUV(B.F, u, r.ve, r.side, b0.w + ax, b0.l, a);
          const id1 = 's' + stalls.length; stalls.push({ id: id1, cat: b0.id, name: b0.name, poly: L(b1), footprint: L(fp1), access: L(ac), shared: true, piece: p.id, row: r, w: b0.w, l: b0.l });
          stalls.push({ id: 's' + stalls.length, cat: b0.id, name: b0.name, poly: L(b2), footprint: L(b2), access: null, sharedWith: id1, piece: p.id, row: r, w: b0.w, l: b0.l }); u += f.pitch; continue; }
        const wTot = c.w + (c.accessAisle || 0), poly = stallUV(B.F, u, r.ve, r.side, wTot, c.l, a), body = c.accessAisle ? stallUV(B.F, u, r.ve, r.side, c.w, c.l, a) : poly;
        let access = null; if (c.accessAisle) { access = stallUV(B.F, u + c.w / sinA, r.ve, r.side, c.accessAisle, c.l, a); }
        stalls.push({ id: 's' + stalls.length, cat: c.id, name: c.name, poly: L(body), footprint: L(poly), access: L(access), piece: p.id, row: r, w: c.w, l: c.l }); u += f.pitch; } }
    const aisles = B.circ.map((x) => ({ poly: x.poly, bb: x.bb || bbox(x.poly) }));
    for (const s of stalls) { const P = s.footprint, bb = bbox(P); s.valid = true;
      if (!free(P)) { s.valid = false; s.reason = 'outside the area or on an obstacle'; }
      else if (aisles.some((x) => boxesMeet(bb, x.bb) && !disjoint(P, x.poly))) { s.valid = false; s.reason = 'on an aisle'; }
      else if (!B.reach.has(s.piece)) { s.valid = false; s.reason = 'its aisle is not reached from an entrance'; }
      s.bb = bb; }
    for (let i = 0; i < stalls.length; i++) for (let j = i + 1; j < stalls.length; j++) { const P = stalls[i], Q2 = stalls[j]; if (!boxesMeet(P.bb, Q2.bb) || !P.valid || !Q2.valid) continue; if (!disjoint(P.footprint, Q2.footprint)) { Q2.valid = false; Q2.reason = 'overlaps another stall'; } }
    // (2026-11-28) numbers: a letter per row (each side of each aisle line, in order across the lot), then 1, 2, … along it
    const keys = [...new Set(stalls.filter((x) => x.valid).map((x) => x.row.key))].sort((x, y) => x - y), letter = (i) => (i < 26 ? '' : String.fromCharCode(64 + Math.floor(i / 26))) + String.fromCharCode(65 + (i % 26));
    keys.forEach((k, i) => { stalls.filter((x) => x.valid && x.row.key === k).map((x) => ({ x, u: B.F.U(centroid(x.poly)) })).sort((p, q) => p.u - q.u).forEach((e, n) => { e.x.no = letter(i) + (n + 1); e.x.rowLabel = letter(i); }); });
    return stalls; };

  // ---- run every candidate, score it, keep the best distinct ones ----
  const results = [];
  const score = (cd, B, asg) => { const stalls = place(B, asg), ok = stalls.filter((s) => s.valid), by = {};
    for (const c of cats) by[c.id] = ok.filter((s) => s.cat === c.id).length;
    const stallArea = ok.reduce((s, x) => s + x.w * x.l, 0), circA = B.circ.length ? rasterUnion(B.circ.map((x) => x.poly), 0.1, 0).area : 0;
    return { cand: cd, B, asg, stalls, by, total: ok.length, invalid: stalls.length - ok.length, stallArea, circArea: circA, use: gross > 0 ? stallArea / gross : 0, circShare: gross > 0 ? circA / gross : 0, unreached: B.pieces.length - B.reach.size }; };
  // mode C: every position by the plain count first; the exact mix search on the few with the most room (it is the slow part)
  for (const cd of cands) { const B = build(cd); results.push(score(cd, B, assign(B.rows, o.mode === 'C' ? 'A' : null))); }
  if (o.mode === 'C') { results.sort((x, y) => y.total - x.total || x.cand.deg - y.cand.deg || x.cand.off - y.cand.off); const K = o.quality === 'refined' ? 6 : 4;
    for (let i = 0; i < Math.min(K, results.length); i++) { const r = results[i]; results[i] = score(r.cand, r.B, assign(r.B.rows, 'C')); } results.splice(K); }
  const mode = o.mode || 'A', firstLarge = order[0] && order[0].id;
  const key = (r) => mode === 'B' ? [...order.map((c) => r.by[c.id] || 0), -r.B.deadEnds, r.use] : mode === 'C' ? [r.asg.missed ? 0 : 1, r.total, -r.B.deadEnds, r.use] : [r.total, -r.B.deadEnds, r.use, -r.circShare];
  const better = (x, y) => { const a1 = key(x), b1 = key(y); for (let i = 0; i < a1.length; i++) { if (a1[i] > b1[i] + 1e-9) return -1; if (a1[i] < b1[i] - 1e-9) return 1; } return 0; };
  results.sort((x, y) => better(x, y) || x.cand.deg - y.cand.deg || x.cand.off - y.cand.off);
  const opts = []; for (const r of results) { if (opts.length >= (o.options || 3)) break; if (!r.total) continue; if (opts.some((x) => Math.abs(x.cand.deg - r.cand.deg) < 1 && x.total === r.total)) continue; opts.push(r); }
  if (!opts.length) return { ok: false, error: results.length && results.every((r) => !r.B.reach.size) ? 'No aisle is reached from an entrance: set an entrance at the area\'s edge next to where the cars come in' : 'No stalls fit in this area with these sizes and aisles', candidates: results.length };
  // the 2010 ADA count for the lot's size (208.2), against the accessible stalls placed: a note, the person's counts stay as set
  const adaNote = (r) => { const need = adaRequired(r.total), have = acc.reduce((q, c) => q + (r.by[c.id] || 0), 0), vans = acc.filter((c) => c.accessAisle >= 2.4).reduce((q, c) => q + (r.by[c.id] || 0), 0);
    return [...(have < need.accessible ? [`The 2010 ADA Standards (208.2) ask for ${need.accessible} accessible space${need.accessible === 1 ? '' : 's'} in a lot of ${r.total}: ${have} placed`] : []), ...(vans < need.van ? [`${need.van} of them van accessible (208.2.4): ${vans} placed`] : [])]; };
  const out = opts.map((r, i) => ({ label: String.fromCharCode(65 + i), angle: r.cand.deg, offset: r.cand.off, total: r.total, byCat: r.by, invalid: r.invalid, gross, stallArea: r.stallArea, circArea: r.circArea, use: r.use, circShare: r.circShare,
    stalls: r.stalls.map(({ bb, row, ...s }) => ({ ...s, rowAt: [row.u0, row.u1], lean: row.lean, rowKey: row.key })), aisles: r.B.circ.map((x) => ({ poly: x.poly, kind: x.kind === 'turnaround' ? 'turnaround' : x.from != null ? 'cross' : x.k != null ? 'aisle' : 'connector', oneWay: !!o.oneWay, flow: x.flow || 0, dir: x.k != null ? r.B.F.d : x.from != null ? r.B.F.n : null })),
    islands: r.B.islands, turnarounds: r.B.turns.map((x) => x.poly), deadEnds: r.B.deadEnds, oneWayOpen: r.B.oneWayOpen, accAsked: r.asg.accAsked,
    schedule: r.stalls.filter((x) => x.valid).map((x) => ({ no: x.no, cat: x.cat, name: x.name, w: x.w, l: x.l, row: x.rowLabel, shared: !!(x.shared || x.sharedWith) })).sort((p, q) => p.no.localeCompare(q.no, 'en', { numeric: true })),
    rows: r.asg.rows.map((x) => ({ len: x.len, counts: x.counts, u0: x.u0, u1: x.u1, side: x.side, piece: x.piece })), unreachedAisles: r.unreached, notes: [...r.asg.note, ...(r.asg.accShort ? [`${r.asg.accShort} accessible stall${r.asg.accShort === 1 ? '' : 's'} could not be placed`] : []), ...adaNote(r), ...(o.deadEnds !== 'allow' && r.B.turns.length ? [`${r.B.turns.length} dead-end aisle${r.B.turns.length === 1 ? '' : 's'} end in a turnaround (one aisle wide across both stall rows)`] : []), ...(o.deadEnds === 'allow' && r.B.deadEnds ? [`${r.B.deadEnds} dead-end aisle${r.B.deadEnds === 1 ? '' : 's'} without a turnaround: drivers reverse out`] : []), ...(r.B.oneWayOpen ? [`${r.B.oneWayOpen} pair${r.B.oneWayOpen === 1 ? '' : 's'} of one-way aisles joined at one end only: no loop there (make those two-way or widen the lot)`] : [])], targets: r.asg.targets }));
  void firstLarge;
  const STD = STANDARDS[o.standard] || null;
  return { ok: true, options: out, best: out[0], candidates: results.length, module: { depth: D, aisle: A, pitch: M }, angle: aDeg, mode, gross, quality: o.quality || 'standard', standard: STD ? { id: STD.id, name: STD.name, src: STD.src } : null,
    method: `Rows of stall | aisle | stall modules (${D.toFixed(2)} + ${A.toFixed(2)} + ${D.toFixed(2)} m) tried in ${results.length} positions (row directions and offsets, seed ${o.seed ?? 1}); the best found is shown, not a proven optimum.` };
}
