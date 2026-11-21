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
export const aisleFor = (angle, oneWay) => (angle >= 89 ? 6.0 : angle >= 59 ? (oneWay ? 4.8 : 6.0) : (oneWay ? 4.0 : 6.0));

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
  const Q = QUALITY[o.quality] || QUALITY.standard, step = o.step || Q.step, aDeg = +o.angle || 90, a = aDeg * DEG, A = +o.aisle || aisleFor(aDeg, o.oneWay);
  const region = { outer: o.region.outer, holes: o.region.holes || [] }, gross = Math.abs(area(region.outer)) - region.holes.reduce((s, h) => s + Math.abs(area(h)), 0);
  const edgeClr = o.underground ? (o.wallClear ?? 0.3) : (o.setback ?? 0);
  const cats = (o.categories || CATEGORIES).filter((c) => c.enabled !== false), regular = cats.filter((c) => !c.accessible), acc = cats.filter((c) => c.accessible && (c.count || 0) > 0);
  if (!regular.length && !acc.length) return { ok: false, error: 'Enable at least one stall type' };
  const fits = new Map(cats.map((c) => [c.id, stallFit(c.w + (c.accessAisle || 0), c.l, aDeg)])), D = Math.max(...cats.map((c) => fits.get(c.id).depth)), M = 2 * D + A;
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
      if (best && bd <= A + edgeClr + 1.0) { roots.add(best.id); continue; }
      // a connector across the rows from the entrance to the nearest aisle line, if the strip is free
      const uE = F.U(E), vE = F.V(E), p2 = pieces.filter((p) => uE >= p.u0 + A / 2 && uE <= p.u1 - A / 2).sort((x, y) => Math.abs(x.c - vE) - Math.abs(y.c - vE))[0];
      if (p2) { const S = rectUV(F, uE - A / 2, uE + A / 2, Math.min(vE, p2.c), Math.max(vE, p2.c)); connectors.push({ poly: S, bb: bbox(S), to: p2.id }); roots.add(p2.id); } }
    const reach = new Set(roots), stack = [...roots]; while (stack.length) { const x = stack.pop(); for (const y of link[x]) if (!reach.has(y)) { reach.add(y); stack.push(y); } }
    const circ = [...pieces.filter((p) => reach.has(p.id)), ...spines.filter((s) => reach.has(s.from)), ...connectors];
    // rows: both sides of each reached piece, the free runs of the band (clear of cross aisles and connectors)
    const rows = []; for (const p of pieces) { if (!reach.has(p.id)) continue; for (const s of [-1, 1]) { const ve = p.c + s * A / 2, v0 = Math.min(ve, ve + s * D), v1 = Math.max(ve, ve + s * D);
      for (const [u0, u1] of runs(F, v0, v1, p.u0, p.u1, [...spines, ...connectors])) rows.push({ piece: p.id, side: s, ve, u0, u1, len: u1 - u0, near: Math.min(...(o.entrances || [[Infinity, Infinity]]).map((E) => dist(E, F.P((u0 + u1) / 2, ve)))) }); } }
    return { F, pieces, spines, connectors, reach, rows, circ, lines };
  };

  // the stall types in one run: how many of each fit (the sequence's length: the pitches of all but the last, plus the last's extent)
  const need = (counts) => { let n = 0, len = 0, lastExt = 0; for (const c of cats) { const k = counts[c.id] || 0; if (!k) continue; const f = fits.get(c.id); len += k * f.pitch; lastExt = f.ext - f.pitch; n += k; } return n ? len + Math.max(0, lastExt) : 0; };
  const order = regular;   // the person's order is the priority (mode B: the first is the large type)
  const assign = (rowsIn, modeIn) => {
    const rows = rowsIn.map((r) => ({ ...r, counts: {}, left: r.len }));
    // accessible first: in the runs nearest an entrance
    const accLeft = {}; for (const c of acc) accLeft[c.id] = c.count || 0;
    for (const r of rows.slice().sort((x, y) => x.near - y.near)) for (const c of acc) { while (accLeft[c.id] > 0) { const t = { ...r.counts, [c.id]: (r.counts[c.id] || 0) + 1 }; if (need(t) > r.len + 1e-9) break; r.counts = t; accLeft[c.id]--; } }
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
      return { rows, accShort: Object.values(accLeft).reduce((s, x) => s + x, 0), note, targets, missed: !!(best && best.off > 0) }; }
    return { rows, accShort: Object.values(accLeft).reduce((s, x) => s + x, 0), note, targets: null };
  };

  // stalls placed along each run, in the order accessible, then the person's order; then every one checked again
  const place = (B, asg) => { const stalls = [];
    for (const r of asg.rows) { const p = B.pieces[r.piece]; let u = r.u0; const seq = [...acc, ...regular];
      for (const c of seq) for (let k = 0; k < (r.counts[c.id] || 0); k++) { const f = fits.get(c.id), wTot = c.w + (c.accessAisle || 0);
        const poly = stallUV(B.F, u, r.ve, r.side, wTot, c.l, a), body = c.accessAisle ? stallUV(B.F, u, r.ve, r.side, c.w, c.l, a) : poly;
        let access = null; if (c.accessAisle) { access = stallUV(B.F, u + c.w / (aDeg >= 89.9 ? 1 : Math.sin(a)), r.ve, r.side, c.accessAisle, c.l, a); }
        stalls.push({ id: 's' + stalls.length, cat: c.id, name: c.name, poly: body, footprint: poly, access, piece: p.id, row: r, w: c.w, l: c.l }); u += f.pitch; } }
    const aisles = B.circ.map((x) => ({ poly: x.poly, bb: x.bb || bbox(x.poly) }));
    for (const s of stalls) { const P = s.footprint, bb = bbox(P); s.valid = true;
      if (!free(P)) { s.valid = false; s.reason = 'outside the area or on an obstacle'; }
      else if (aisles.some((x) => boxesMeet(bb, x.bb) && !disjoint(P, x.poly))) { s.valid = false; s.reason = 'on an aisle'; }
      else if (!B.reach.has(s.piece)) { s.valid = false; s.reason = 'its aisle is not reached from an entrance'; }
      s.bb = bb; }
    for (let i = 0; i < stalls.length; i++) for (let j = i + 1; j < stalls.length; j++) { const P = stalls[i], Q2 = stalls[j]; if (!boxesMeet(P.bb, Q2.bb) || !P.valid || !Q2.valid) continue; if (!disjoint(P.footprint, Q2.footprint)) { Q2.valid = false; Q2.reason = 'overlaps another stall'; } }
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
  const key = (r) => mode === 'B' ? [...order.map((c) => r.by[c.id] || 0), r.use] : mode === 'C' ? [r.asg.missed ? 0 : 1, r.total, r.use] : [r.total, r.use, -r.circShare];
  const better = (x, y) => { const a1 = key(x), b1 = key(y); for (let i = 0; i < a1.length; i++) { if (a1[i] > b1[i] + 1e-9) return -1; if (a1[i] < b1[i] - 1e-9) return 1; } return 0; };
  results.sort((x, y) => better(x, y) || x.cand.deg - y.cand.deg || x.cand.off - y.cand.off);
  const opts = []; for (const r of results) { if (opts.length >= (o.options || 3)) break; if (!r.total) continue; if (opts.some((x) => Math.abs(x.cand.deg - r.cand.deg) < 1 && x.total === r.total)) continue; opts.push(r); }
  if (!opts.length) return { ok: false, error: results.length && results.every((r) => !r.B.reach.size) ? 'No aisle is reached from an entrance: set an entrance at the area\'s edge next to where the cars come in' : 'No stalls fit in this area with these sizes and aisles', candidates: results.length };
  // the 2010 ADA count for the lot's size (208.2), against the accessible stalls placed: a note, the person's counts stay as set
  const adaNote = (r) => { const need = adaRequired(r.total), have = acc.reduce((q, c) => q + (r.by[c.id] || 0), 0), vans = acc.filter((c) => c.accessAisle >= 2.4).reduce((q, c) => q + (r.by[c.id] || 0), 0);
    return [...(have < need.accessible ? [`The 2010 ADA Standards (208.2) ask for ${need.accessible} accessible space${need.accessible === 1 ? '' : 's'} in a lot of ${r.total}: ${have} placed`] : []), ...(vans < need.van ? [`${need.van} of them van accessible (208.2.4): ${vans} placed`] : [])]; };
  const out = opts.map((r, i) => ({ label: String.fromCharCode(65 + i), angle: r.cand.deg, offset: r.cand.off, total: r.total, byCat: r.by, invalid: r.invalid, gross, stallArea: r.stallArea, circArea: r.circArea, use: r.use, circShare: r.circShare,
    stalls: r.stalls.map(({ bb, row, ...s }) => ({ ...s, rowAt: [row.u0, row.u1] })), aisles: r.B.circ.map((x) => ({ poly: x.poly, kind: x.from != null ? 'cross' : x.to != null && x.u == null && x.k == null ? 'connector' : 'aisle', oneWay: !!o.oneWay })),
    rows: r.asg.rows.map((x) => ({ len: x.len, counts: x.counts, u0: x.u0, u1: x.u1, side: x.side, piece: x.piece })), unreachedAisles: r.unreached, notes: [...r.asg.note, ...(r.asg.accShort ? [`${r.asg.accShort} accessible stall${r.asg.accShort === 1 ? '' : 's'} could not be placed`] : []), ...adaNote(r)], targets: r.asg.targets }));
  void firstLarge;
  return { ok: true, options: out, best: out[0], candidates: results.length, module: { depth: D, aisle: A, pitch: M }, angle: aDeg, mode, gross, quality: o.quality || 'standard',
    method: `Rows of stall | aisle | stall modules (${D.toFixed(2)} + ${A.toFixed(2)} + ${D.toFixed(2)} m) tried in ${results.length} positions (row directions and offsets, seed ${o.seed ?? 1}); the best found is shown, not a proven optimum.` };
}
