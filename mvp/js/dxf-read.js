// Reading a CAD floor plan (2026-11-27): an ASCII DXF (AutoCAD R12 to 2018) as lines in plan metres, by layer, with its text, and
// walls found from it. The architect's own drawing becomes an underlay to trace or snap to, and its double wall lines become
// SimuSite walls, instead of redrawing the plan. Pure functions: the Node tests run the same code.
// Read: LINE, LWPOLYLINE and POLYLINE (with bulges), ARC, CIRCLE, ELLIPSE, SPLINE (through its fit or control points), INSERT (blocks,
// nested, scaled, rotated, arrays), TEXT and MTEXT; layers that are off or frozen are marked; $INSUNITS gives the units.
// Not read: DWG (save as DXF), binary DXF, hatches, dimensions' own geometry, 3D solids, xrefs, paper space.

const DEG = Math.PI / 180;
/** units by $INSUNITS code → metres per drawing unit (0 = unitless: guessed from the extent, and said so) */
export const UNITS = { 1: ['inches', 0.0254], 2: ['feet', 0.3048], 4: ['millimetres', 0.001], 5: ['centimetres', 0.01], 6: ['metres', 1], 14: ['decimetres', 0.1] };

/**
 * text → { ok, units: { code, name, scale, guessed }, layers: { name: { n, off } }, segs: [{ layer, a, b }], texts: [{ layer, p, s, h }],
 *          bounds: { x0, y0, x1, y1 } (metres), counts: { LINE: n, … }, skipped: { HATCH: n, … }, error? }
 * Coordinates are scaled to metres; o.scale overrides the units (metres per drawing unit).
 */
export function parseDXF(text, o = {}) {
  const t = String(text || '');
  if (/^AutoCAD Binary DXF/.test(t.slice(0, 22))) return { ok: false, error: 'This is a binary DXF: save it again as an ASCII DXF (in AutoCAD: Save As › DXF, untick Binary).' };
  if (/^AC10\d\d/.test(t.slice(0, 6))) return { ok: false, error: 'This is a DWG file: save it as DXF first (AutoCAD, BricsCAD, Revit and Rhino all can: Save As or Export › DXF).' };
  const L = t.split(/\r?\n/), P = []; for (let i = 0; i + 1 < L.length; i += 2) P.push([parseInt(L[i], 10), L[i + 1]]);
  if (!P.some(([c, v]) => c === 0 && v.trim() === 'SECTION')) return { ok: false, error: 'This file is not a DXF drawing.' };
  // split into sections and entity records (each record: type and its group codes in order)
  let i = 0, sec = null, insunits = 0; const layers = {}, blocks = {}, ents = [];
  const rec = () => { const r = { type: P[i][1].trim(), g: [] }; i++; while (i < P.length && P[i][0] !== 0) { r.g.push(P[i]); i++; } return r; };
  let block = null;
  while (i < P.length) { const [c, v0] = P[i], v = (v0 || '').trim();
    if (c !== 0) { i++; continue; }
    if (v === 'SECTION') { sec = (P[i + 1] && P[i + 1][1] || '').trim(); i += 2; continue; }
    if (v === 'ENDSEC') { sec = null; i++; continue; }
    if (v === 'EOF') break;
    if (sec === 'HEADER') { i++; continue; }
    const r = rec();
    if (sec === 'HEADER' || r.type === '$INSUNITS') continue;
    if (sec === 'TABLES' && r.type === 'LAYER') { const name = val(r, 2); if (name) layers[name] = { n: 0, off: (+val(r, 62, 7)) < 0 || ((+val(r, 70, 0)) & 1) === 1 }; continue; }
    if (sec === 'BLOCKS') { if (r.type === 'BLOCK') { block = { name: val(r, 2), base: [+val(r, 10, 0), +val(r, 20, 0)], ents: [] }; blocks[block.name] = block; } else if (r.type === 'ENDBLK') block = null; else if (block) block.ents.push(r); continue; }
    if (sec === 'ENTITIES') ents.push(r); }
  // $INSUNITS sits in the header as 9/$INSUNITS then 70/code
  for (let k = 0; k + 1 < P.length; k++) if (P[k][0] === 9 && P[k][1].trim() === '$INSUNITS') { insunits = parseInt(P[k + 1][1], 10) || 0; break; }
  // geometry in drawing units, then scaled
  const segs = [], texts = [], counts = {}, skipped = {}, ARCSEG = 10 * DEG;
  const add = (layer, a, b, M) => { const A = M(a), B = M(b); if (Math.hypot(A[0] - B[0], A[1] - B[1]) > 1e-9) segs.push({ layer, a: A, b: B }); };
  const arcPts = (cx, cy, r, a0, a1) => { while (a1 <= a0) a1 += 360; const n = Math.max(2, Math.ceil((a1 - a0) * DEG / ARCSEG)), out = []; for (let k = 0; k <= n; k++) { const a = (a0 + (a1 - a0) * k / n) * DEG; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return out; };
  // a bulge (LWPOLYLINE, VERTEX 42): tan(¼ of the arc's included angle), positive counter-clockwise from p to q
  const bulgePts = (p, q, b) => { if (!b) return [p, q]; const th = 4 * Math.atan(b), d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < 1e-12) return [p, q];
    const ux = (q[0] - p[0]) / d, uy = (q[1] - p[1]) / d, h = d / 2 / Math.tan(th / 2), cx = (p[0] + q[0]) / 2 - uy * h, cy = (p[1] + q[1]) / 2 + ux * h, R = Math.hypot(p[0] - cx, p[1] - cy), a0 = Math.atan2(p[1] - cy, p[0] - cx), n = Math.max(2, Math.ceil(Math.abs(th) / ARCSEG)), out = [];
    for (let k = 0; k <= n; k++) { const a = a0 + th * k / n; out.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); } out[0] = p; out[n] = q; return out; };
  const poly = (layer, pts, closed, M) => { for (let k = 0; k + 1 < pts.length; k++) add(layer, pts[k], pts[k + 1], M); if (closed && pts.length > 2) add(layer, pts.at(-1), pts[0], M); };
  const ocs = (r) => ((+val(r, 230, 1)) < 0 ? (p) => [-p[0], p[1]] : (p) => p);   // an arbitrary axis with Z down (mirrored arcs and polylines)
  const walk = (list, M, inLayer, depth) => { let pl = null;
    for (const r of list) { const ly0 = val(r, 8, '0'), layer = ly0 === '0' && inLayer ? inLayer : ly0, O = ocs(r), MO = (p) => M(O(p)); counts[r.type] = (counts[r.type] || 0) + 1;
      if (!layers[layer]) layers[layer] = { n: 0, off: false };
      if (pl && r.type === 'VERTEX') { pl.pts.push([+val(r, 10, 0), +val(r, 20, 0)]); pl.bul.push(+val(r, 42, 0)); continue; }
      if (pl && r.type === 'SEQEND') { const pts = []; for (let k = 0; k < pl.pts.length; k++) { const q = pl.pts[(k + 1) % pl.pts.length]; if (k + 1 === pl.pts.length && !pl.closed) break; const s = bulgePts(pl.pts[k], q, pl.bul[k]); pts.push(...(pts.length ? s.slice(1) : s)); } if (pl.pts.length === 1) pts.push(pl.pts[0]); poly(pl.layer, pts, false, pl.M); layers[pl.layer].n++; pl = null; continue; }
      const n0 = segs.length;
      switch (r.type) {
        case 'LINE': add(layer, [+val(r, 10, 0), +val(r, 20, 0)], [+val(r, 11, 0), +val(r, 21, 0)], M); break;
        case 'LWPOLYLINE': { const xs = all(r, 10), ys = all(r, 20), closed = ((+val(r, 70, 0)) & 1) === 1, bul = bulges(r); const V = xs.map((x, k) => [+x, +ys[k]]), pts = [];
          for (let k = 0; k < V.length; k++) { if (k + 1 === V.length && !closed) break; const s = bulgePts(V[k], V[(k + 1) % V.length], bul[k] || 0); pts.push(...(pts.length ? s.slice(1) : s)); }
          poly(layer, pts, false, MO); break; }
        case 'POLYLINE': if (((+val(r, 70, 0)) & (16 | 64)) === 0) pl = { layer, pts: [], bul: [], closed: ((+val(r, 70, 0)) & 1) === 1, M: MO }; else skipped.POLYMESH = (skipped.POLYMESH || 0) + 1; break;
        case 'ARC': poly(layer, arcPts(+val(r, 10, 0), +val(r, 20, 0), +val(r, 40, 0), +val(r, 50, 0), +val(r, 51, 360)), false, MO); break;
        case 'CIRCLE': poly(layer, arcPts(+val(r, 10, 0), +val(r, 20, 0), +val(r, 40, 0), 0, 360), false, MO); break;
        case 'ELLIPSE': { const cx = +val(r, 10, 0), cy = +val(r, 20, 0), mx = +val(r, 11, 1), my = +val(r, 21, 0), k = +val(r, 40, 1), t0 = +val(r, 41, 0), t1 = +val(r, 42, 2 * Math.PI), rot = Math.atan2(my, mx), a = Math.hypot(mx, my), b = a * k, n = Math.max(8, Math.ceil(Math.abs(t1 - t0) / ARCSEG)), pts = [];
          for (let q = 0; q <= n; q++) { const tt = t0 + (((t1 - t0) % (2 * Math.PI)) || 2 * Math.PI) * q / n, x = a * Math.cos(tt), y = b * Math.sin(tt); pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); } poly(layer, pts, false, MO); break; }
        case 'SPLINE': { const fx = all(r, 11), fy = all(r, 21), cx = all(r, 10), cy = all(r, 20), use = fx.length >= 2 ? [fx, fy] : [cx, cy]; poly(layer, use[0].map((x, k) => [+x, +use[1][k]]), ((+val(r, 70, 0)) & 1) === 1, MO); break; }
        case 'INSERT': { const B = blocks[val(r, 2)]; if (!B || depth > 8) { skipped.INSERT = (skipped.INSERT || 0) + 1; break; }
          const ix = +val(r, 10, 0), iy = +val(r, 20, 0), sx = +val(r, 41, 1), sy = +val(r, 42, sx), rot = +val(r, 50, 0) * DEG, nc = Math.max(1, +val(r, 70, 1)), nr = Math.max(1, +val(r, 71, 1)), dc = +val(r, 44, 0), dr = +val(r, 45, 0), c = Math.cos(rot), s = Math.sin(rot);
          for (let ci = 0; ci < nc; ci++) for (let ri = 0; ri < nr; ri++) { const ox = ci * dc, oy = ri * dr;
            const Mi = (p) => { const x = (p[0] - B.base[0]) * sx + ox, y = (p[1] - B.base[1]) * sy + oy; return MO([ix + x * c - y * s, iy + x * s + y * c]); };
            walk(B.ents, Mi, layer, depth + 1); }
          break; }
        case 'TEXT': case 'MTEXT': { const s = mtext(r.type === 'MTEXT' ? all(r, 3).join('') + val(r, 1, '') : val(r, 1, '')); if (s.trim()) texts.push({ layer, p: M(O([+val(r, 10, 0), +val(r, 20, 0)])), s: s.trim(), h: +val(r, 40, 0) }); break; }
        case 'HATCH': case 'DIMENSION': case '3DFACE': case '3DSOLID': case 'REGION': case 'IMAGE': case 'VIEWPORT': case 'POINT': case 'ATTRIB': case 'ATTDEF': case 'SOLID': case 'LEADER': case 'MLEADER': case 'MLINE': case 'WIPEOUT': case 'OLE2FRAME': skipped[r.type] = (skipped[r.type] || 0) + 1; break;
        default: skipped[r.type] = (skipped[r.type] || 0) + 1; }
      if (segs.length > n0) layers[layer].n += 1; } };
  walk(ents, (p) => p, null, 0);
  if (!segs.length) return { ok: false, error: 'No lines were found in the drawing (model space). Check that the plan is in model space and not only in a layout.', counts, skipped };
  // the units, and metres
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity; for (const s of segs) for (const p of [s.a, s.b]) { bx0 = Math.min(bx0, p[0]); by0 = Math.min(by0, p[1]); bx1 = Math.max(bx1, p[0]); by1 = Math.max(by1, p[1]); }
  const ext = Math.max(bx1 - bx0, by1 - by0), U = UNITS[insunits], guess = ext > 2000 ? 4 : ext > 300 ? 5 : 6;
  const code = U ? insunits : guess, scale = o.scale || UNITS[code][1], units = { code, name: o.scale ? 'as set' : UNITS[code][0], scale, guessed: !U && !o.scale };
  const S = (p) => [p[0] * scale, p[1] * scale];
  for (const s of segs) { s.a = S(s.a); s.b = S(s.b); } for (const x of texts) { x.p = S(x.p); x.h *= scale; }
  return { ok: true, units, layers, segs, texts, bounds: { x0: bx0 * scale, y0: by0 * scale, x1: bx1 * scale, y1: by1 * scale }, counts, skipped };
}
function val(r, code, d = '') { for (const [c, v] of r.g) if (c === code) return v.trim(); return d; }
function all(r, code) { return r.g.filter(([c]) => c === code).map(([, v]) => v.trim()); }
// LWPOLYLINE bulges: a 42 follows the vertex (10/20) it belongs to
function bulges(r) { const out = []; let k = -1; for (const [c, v] of r.g) { if (c === 10) { k++; out[k] = 0; } else if (c === 42 && k >= 0) out[k] = +v; } return out; }
// MTEXT formatting codes out: \P new paragraph, {\fArial;…}, \A1;, \H2.5x;, %%c etc.
function mtext(s) { return String(s).replace(/\\P/g, ' ').replace(/\\[ACFHQTWfacfhqtw][^;]*;/g, '').replace(/\\[LlOoKk]/g, '').replace(/[{}]/g, '').replace(/%%[cC]/g, 'Ø').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±').replace(/\\U\+([0-9A-Fa-f]{4})/g, (m, h) => String.fromCodePoint(parseInt(h, 16))); }

/**
 * Walls from double lines: pairs of parallel segments (within 2°) between minT and maxT apart that overlap along their length by at
 * least `minLen` → wall centrelines { a, b, t (thickness), layer }, joined at corners and merged along their line.
 * segs: in metres (from parseDXF), already filtered to the layers chosen.
 */
export function wallsFromLines(segs, o = {}) {
  const minT = o.minT ?? 0.05, maxT = o.maxT ?? 0.6, minLen = o.minLen ?? 0.3, ang = (o.angTol ?? 2) * DEG;
  const S = segs.map((s) => { const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], L = Math.hypot(dx, dy); return { ...s, L, u: [dx / L, dy / L] }; }).filter((s) => s.L >= minLen);
  // a grid of cells, so each segment meets only its neighbours
  const cs = Math.max(1, maxT * 4), G = new Map(), key = (i, j) => i + ',' + j;
  S.forEach((s, k) => { const i0 = Math.floor((Math.min(s.a[0], s.b[0]) - maxT) / cs), i1 = Math.floor((Math.max(s.a[0], s.b[0]) + maxT) / cs), j0 = Math.floor((Math.min(s.a[1], s.b[1]) - maxT) / cs), j1 = Math.floor((Math.max(s.a[1], s.b[1]) + maxT) / cs);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const kk = key(i, j); if (!G.has(kk)) G.set(kk, []); G.get(kk).push(k); } });
  const pieces = [], seen = new Set();
  S.forEach((s, k) => { const near = new Set(); const i0 = Math.floor(Math.min(s.a[0], s.b[0]) / cs), i1 = Math.floor(Math.max(s.a[0], s.b[0]) / cs), j0 = Math.floor(Math.min(s.a[1], s.b[1]) / cs), j1 = Math.floor(Math.max(s.a[1], s.b[1]) / cs);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const m of G.get(key(i, j)) || []) if (m > k) near.add(m);
    for (const m of near) { const q = S[m], dot = s.u[0] * q.u[0] + s.u[1] * q.u[1]; if (Math.abs(dot) < Math.cos(ang)) continue;
      // the distance between the two lines, and how much of q lies alongside s
      const nx = -s.u[1], ny = s.u[0], d = Math.abs((q.a[0] - s.a[0]) * nx + (q.a[1] - s.a[1]) * ny), d2 = Math.abs((q.b[0] - s.a[0]) * nx + (q.b[1] - s.a[1]) * ny); if (Math.abs(d - d2) > Math.max(0.01, 0.1 * d)) continue;
      const t = (d + d2) / 2; if (t < minT || t > maxT) continue;
      const pr = (p) => (p[0] - s.a[0]) * s.u[0] + (p[1] - s.a[1]) * s.u[1], qa = pr(q.a), qb = pr(q.b), lo = Math.max(0, Math.min(qa, qb)), hi = Math.min(s.L, Math.max(qa, qb));
      if (hi - lo < minLen || hi - lo < 0.5 * Math.min(s.L, q.L) && hi - lo < 1.0) continue;
      const side = Math.sign((q.a[0] - s.a[0]) * nx + (q.a[1] - s.a[1]) * ny) || 1, off = side * t / 2, P = (x) => [s.a[0] + s.u[0] * x + nx * off, s.a[1] + s.u[1] * x + ny * off];
      const pk = [k, m].join(':'); if (seen.has(pk)) continue; seen.add(pk);
      pieces.push({ a: P(lo), b: P(hi), t: +t.toFixed(3), layer: s.layer, u: s.u.slice() }); } });
  // a line between two others (a wall with a finish line, or three lines) yields overlapping pieces: keep the thickest of each place
  pieces.sort((p, q) => q.t - p.t); const kept = [];
  for (const w of pieces) { const mid = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2]; if (kept.some((k) => Math.abs(k.u[0] * w.u[0] + k.u[1] * w.u[1]) > Math.cos(ang) && distSeg(mid, k.a, k.b) < k.t / 2 + 1e-6)) continue; kept.push(w); }
  // merge pieces on one line with the same thickness that touch or nearly touch (gaps under the thickness: a line broken by a column)
  let merged = true; while (merged) { merged = false;
    outer: for (let x = 0; x < kept.length; x++) for (let y = x + 1; y < kept.length; y++) { const A = kept[x], B = kept[y]; if (Math.abs(A.t - B.t) > 0.01 || Math.abs(A.u[0] * B.u[0] + A.u[1] * B.u[1]) < Math.cos(ang)) continue;
      if (distLine(B.a, A.a, A.u) > 0.01 || distLine(B.b, A.a, A.u) > 0.01) continue; const pr = (p) => (p[0] - A.a[0]) * A.u[0] + (p[1] - A.a[1]) * A.u[1], a0 = 0, a1 = pr(A.b), b0 = Math.min(pr(B.a), pr(B.b)), b1 = Math.max(pr(B.a), pr(B.b));
      if (b0 > a1 + A.t || b1 < a0 - A.t) continue; const lo = Math.min(a0, b0), hi = Math.max(a1, b1), P = (v) => [A.a[0] + A.u[0] * v, A.a[1] + A.u[1] * v];
      kept[x] = { ...A, a: P(lo), b: P(hi) }; kept.splice(y, 1); merged = true; break outer; } }
  // corners and tees: an end near another wall's centreline (within the thicker half width plus a little) is carried to meet it
  for (const w of kept) for (const end of ['a', 'b']) { const p = w[end]; let best = null;
    for (const v of kept) { if (v === w || Math.abs(v.u[0] * w.u[0] + v.u[1] * w.u[1]) > Math.cos(30 * DEG)) continue; const X = lineX(w.a, w.u, v.a, v.u); if (!X) continue;
      const reach = Math.max(w.t, v.t) * 0.75 + 0.05, dEnd = Math.hypot(X[0] - p[0], X[1] - p[1]), onV = distSeg(X, v.a, v.b) <= v.t / 2 + 0.05; if (dEnd <= reach && onV && (!best || dEnd < best.d)) best = { X, d: dEnd }; }
    if (best) w[end] = best.X; }
  return kept.filter((w) => Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) >= minLen).map((w) => ({ a: w.a.map((x) => +x.toFixed(4)), b: w.b.map((x) => +x.toFixed(4)), t: w.t, layer: w.layer }));
}
function distLine(p, a, u) { return Math.abs((p[0] - a[0]) * -u[1] + (p[1] - a[1]) * u[0]); }
function distSeg(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-12, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
function lineX(a, u, b, v) { const den = u[0] * v[1] - u[1] * v[0]; if (Math.abs(den) < 1e-9) return null; const t = ((b[0] - a[0]) * v[1] - (b[1] - a[1]) * v[0]) / den; return [a[0] + u[0] * t, a[1] + u[1] * t]; }

/** which layers look like walls: by name (WALL, MUR, A-WALL, 墙, …) or, failing that, the layer whose lines give the most wall length */
export function wallLayers(res) { const names = Object.keys(res.layers).filter((n) => /wall|mur|wand|muro|a-wall|墙|壁/i.test(n) && res.layers[n].n > 0); if (names.length) return names;
  let best = null, bl = 0; for (const n of Object.keys(res.layers)) { const w = wallsFromLines(res.segs.filter((s) => s.layer === n)), l = w.reduce((a, x) => a + Math.hypot(x.b[0] - x.a[0], x.b[1] - x.a[1]), 0); if (l > bl) { bl = l; best = n; } } return best ? [best] : []; }
