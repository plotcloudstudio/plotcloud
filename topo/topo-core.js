// PlotCloud contour model maker — terrain → stacked laser-cut layers.
// Field heights in metres, grid spacing `cell` metres. Output geometry in model millimetres (y = north, up).

// ---------- terrain ----------
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function valueNoise(seed) {
  const r = rng(seed), P = 256, g = new Float32Array(P * P);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const at = (x, y) => g[((y & (P - 1)) * P) + (x & (P - 1))];
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

export const TERRAINS = [['hill', 'Hill'], ['slope', 'Hillside'], ['valley', 'River valley'], ['ridge', 'Two peaks']];

export function sampleTerrain({ type = 'hill', seed = 7, W = 120, D = 80, relief = 12, N = 160 }) {
  const cell = Math.max(W, D) / (N - 1);
  const nx = Math.round(W / cell) + 1, ny = Math.round(D / cell) + 1;
  const h = new Float32Array(nx * ny), noise = valueNoise(seed);
  const fbm = (x, y) => { let v = 0, a = 0.5, f = 1; for (let o = 0; o < 4; o++) { v += a * noise(x * f, y * f); a *= 0.5; f *= 2; } return v; };
  const g = (x, y, cx, cy, s) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * s * s));
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const u = i / (nx - 1), v = j / (ny - 1), n = fbm(u * 4 + seed, v * 4) - 0.5;
    let base;
    if (type === 'slope') base = 0.15 + 0.75 * v + 0.12 * Math.sin(u * 7 + v * 3);
    else if (type === 'valley') base = 0.2 + 0.8 * Math.min(1, Math.abs(u - 0.5 - 0.12 * Math.sin(v * 6)) * 2.4);
    else if (type === 'ridge') base = 0.95 * Math.max(g(u, v, 0.32, 0.55, 0.2), 0.8 * g(u, v, 0.72, 0.4, 0.17));
    else base = 0.95 * g(u, v, 0.48, 0.52, 0.27);
    h[j * nx + i] = relief * Math.max(0, base + 0.22 * n);
  }
  return { nx, ny, cell, h };
}

// lum: Float32Array 0..1 of size w*h (row 0 = top of image = north)
export function fieldFromLuminance(lum, w, hgt, { W = 120, minZ = 0, maxZ = 20, N = 160 }) {
  const D = W * hgt / w, cell = Math.max(W, D) / (N - 1);
  const nx = Math.round(W / cell) + 1, ny = Math.round(D / cell) + 1;
  const out = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const sx = i / (nx - 1) * (w - 1), sy = (1 - j / (ny - 1)) * (hgt - 1);
    const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(hgt - 1, y0 + 1), fx = sx - x0, fy = sy - y0;
    const v = lum[y0 * w + x0] * (1 - fx) * (1 - fy) + lum[y0 * w + x1] * fx * (1 - fy) + lum[y1 * w + x0] * (1 - fx) * fy + lum[y1 * w + x1] * fx * fy;
    out[j * nx + i] = minZ + (maxZ - minZ) * v;
  }
  // light 3×3 smoothing to remove image noise
  const sm = new Float32Array(out.length);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let s = 0, c = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= ny) continue; s += out[b * nx + a]; c++;
    }
    sm[j * nx + i] = s / c;
  }
  return { nx, ny, cell, h: sm, W, D };
}

// ---------- contours (marching squares on a grid padded with "below everything") ----------
function contourLoops(field, L) {
  const { nx, ny, h } = field;
  const NX = nx + 2, NY = ny + 2, LOW = -1e9;
  const val = (i, j) => (i < 1 || j < 1 || i > nx || j > ny ? LOW : h[(j - 1) * nx + (i - 1)]);
  const hKey = (i, j) => j * NX + i, vKey = (i, j) => NX * NY + j * NX + i;
  const pt = new Map(), adj = new Map();
  const point = (key) => {
    if (pt.has(key)) return pt.get(key);
    let i, j, a, b, p;
    if (key < NX * NY) { j = Math.floor(key / NX); i = key - j * NX; a = val(i, j); b = val(i + 1, j); const t = clampT((L - a) / (b - a)); p = [i - 1 + t, j - 1]; }
    else { const k = key - NX * NY; j = Math.floor(k / NX); i = k - j * NX; a = val(i, j); b = val(i, j + 1); const t = clampT((L - a) / (b - a)); p = [i - 1, j - 1 + t]; }
    pt.set(key, p); return p;
  };
  const link = (a, b) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); };
  for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const v0 = val(i, j), v1 = val(i + 1, j), v2 = val(i + 1, j + 1), v3 = val(i, j + 1);
    const c = (v0 >= L ? 1 : 0) | (v1 >= L ? 2 : 0) | (v2 >= L ? 4 : 0) | (v3 >= L ? 8 : 0);
    if (c === 0 || c === 15) continue;
    const e0 = hKey(i, j), e1 = vKey(i + 1, j), e2 = hKey(i, j + 1), e3 = vKey(i, j);
    const centre = (v0 + v1 + v2 + v3) / 4 >= L;
    switch (c) {
      case 1: case 14: link(e3, e0); break;
      case 2: case 13: link(e0, e1); break;
      case 3: case 12: link(e3, e1); break;
      case 4: case 11: link(e1, e2); break;
      case 6: case 9: link(e0, e2); break;
      case 7: case 8: link(e3, e2); break;
      case 5: if (centre) { link(e0, e1); link(e2, e3); } else { link(e3, e0); link(e1, e2); } break;
      case 10: if (centre) { link(e3, e0); link(e1, e2); } else { link(e0, e1); link(e2, e3); } break;
    }
  }
  const loops = [], seen = new Set();
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop = []; let prev = -1, cur = start;
    while (cur !== undefined && !seen.has(cur)) {
      seen.add(cur); loop.push(point(cur));
      const nb = adj.get(cur); const next = nb[0] !== prev ? nb[0] : nb[1];
      prev = cur; cur = next;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}
const clampT = (t) => (Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0);

export function area(loop) { let a = 0; for (let i = 0, n = loop.length; i < n; i++) { const p = loop[i], q = loop[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
export function inside(pt, loop) {
  let c = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i], b = loop[j];
    if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function simplify(loop, tol) {
  if (loop.length < 8) return loop;
  const pts = loop.concat([loop[0]]);
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  // split the closed loop at its farthest point so DP has a real chord
  let far = 0, fd = -1; for (let i = 1; i < pts.length - 1; i++) { const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2; if (d > fd) { fd = d; far = i; } }
  stack.length = 0; stack.push([0, far], [far, pts.length - 1]); keep[far] = 1;
  while (stack.length) {
    const [a, b] = stack.pop(); let md = -1, mi = -1;
    const [x1, y1] = pts[a], [x2, y2] = pts[b], dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / len; if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  const out = []; for (let i = 0; i < pts.length - 1; i++) if (keep[i]) out.push(pts[i]);
  return out.length >= 3 ? out : loop;
}

// distance (in cells) to the nearest cell outside the mask
function distanceInside(field, L) {
  const { nx, ny, h } = field, d = new Float32Array(nx * ny), BIG = 1e6;
  for (let k = 0; k < d.length; k++) d[k] = h[k] >= L ? BIG : 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; if (!d[k]) continue;
    const edge = i === 0 || j === 0 || i === nx - 1 || j === ny - 1;
    let v = edge ? 1 : d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + 1); if (j > 0) v = Math.min(v, d[k - nx] + 1);
    if (i > 0 && j > 0) v = Math.min(v, d[k - nx - 1] + 1.414); if (i < nx - 1 && j > 0) v = Math.min(v, d[k - nx + 1] + 1.414);
    d[k] = v;
  }
  for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = j * nx + i; if (!d[k]) continue; let v = d[k];
    if (i < nx - 1) v = Math.min(v, d[k + 1] + 1); if (j < ny - 1) v = Math.min(v, d[k + nx] + 1);
    if (i < nx - 1 && j < ny - 1) v = Math.min(v, d[k + nx + 1] + 1.414); if (i > 0 && j < ny - 1) v = Math.min(v, d[k + nx - 1] + 1.414);
    d[k] = v;
  }
  let best = -1, bi = 0, bj = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (d[j * nx + i] > best) { best = d[j * nx + i]; bi = i; bj = j; }
  return best > 0 ? { i: bi, j: bj, r: best } : null;
}

// ---------- layers ----------
export function computeLayers(field, { scale = 500, thickness = 3, exag = 1, minArea = 12, tol = 0.15 }) {
  const { nx, ny, cell, h } = field;
  let zmin = Infinity, zmax = -Infinity; for (const v of h) { if (v < zmin) zmin = v; if (v > zmax) zmax = v; }
  const interval = thickness * scale / 1000 / exag;            // metres of real elevation per layer
  const mm = cell * 1000 / scale;                               // model mm per grid cell
  const w = (nx - 1) * mm, d = (ny - 1) * mm;
  const layers = [{ k: 0, z: zmin, base: true, loops: [[[0, 0], [w, 0], [w, d], [0, d]]] }];
  const count = Math.floor((zmax - zmin) / interval + 1e-9);
  for (let k = 1; k <= count; k++) {
    const z = zmin + k * interval;
    const loops = contourLoops(field, z).map((l) => simplify(l.map(([x, y]) => [x * mm, y * mm]), tol)).filter((l) => Math.abs(area(l)) >= minArea);
    if (!loops.length) break;
    layers.push({ k, z, loops });
  }
  for (const L of layers) L.pieces = pieces(L.loops);
  // label each piece, hidden under the next layer when there is room
  for (let n = 0; n < layers.length; n++) {
    const next = layers[n + 1];
    for (const P of layers[n].pieces) P.label = labelSpot(P, next);
  }
  return { interval, zmin, zmax, size: { w, d }, mm, layers };
}

function pieces(loops) {
  const info = loops.map((l) => ({ l, a: Math.abs(area(l)), depth: 0, parent: -1 }));
  info.forEach((A, i) => {
    let best = -1;
    info.forEach((B, j) => { if (i !== j && B.a > A.a && inside(A.l[0], B.l)) { A.depth++; if (best < 0 || B.a < info[best].a) best = j; } });
    A.parent = best;
  });
  const out = [];
  info.forEach((A, i) => { if (A.depth % 2 === 0) out.push({ outer: A.l, holes: [], idx: i }); });
  info.forEach((A) => { if (A.depth % 2 === 1) { const p = out.find((o) => o.idx === A.parent); if (p) p.holes.push(A.l); } });
  return out.map((o) => ({ outer: o.outer, holes: o.holes, loops: [o.outer, ...o.holes] }));
}
function inPiece(pt, P) { return inside(pt, P.outer) && !P.holes.some((h) => inside(pt, h)); }
function edgeDist(pt, loops) {
  let m = Infinity;
  for (const l of loops) for (let i = 0; i < l.length; i++) {
    const a = l[i], b = l[(i + 1) % l.length], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L2));
    m = Math.min(m, Math.hypot(pt[0] - a[0] - t * dx, pt[1] - a[1] - t * dy));
  }
  return m;
}
function labelSpot(P, next) {
  const b = bbox([P.outer]); let best = null, bestCov = null;
  const S = 14;
  for (let a = 0; a <= S; a++) for (let c = 0; c <= S; c++) {
    const pt = [b[0] + (b[2] - b[0]) * (a + 0.5) / (S + 1), b[1] + (b[3] - b[1]) * (c + 0.5) / (S + 1)];
    if (!inPiece(pt, P)) continue;
    const d = edgeDist(pt, P.loops);
    if (!best || d > best.d) best = { pt, d };
    if (next && next.pieces) {
      const np = next.pieces.find((q) => inPiece(pt, q));
      if (np) { const dn = Math.min(d, edgeDist(pt, np.loops)); if (!bestCov || dn > bestCov.d) bestCov = { pt, d: dn }; }
    }
  }
  const pick = bestCov && bestCov.d >= 3 ? bestCov : best;
  if (!pick) return null;
  return { x: pick.pt[0], y: pick.pt[1], size: Math.max(2, Math.min(6, pick.d * 0.9)) };
}

// ---------- packing ----------
function bbox(loops) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const l of loops) for (const [x, y] of l) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
  return b;
}
export function packSheets(layers, { bedW = 600, bedH = 400, margin = 5, gap = 4 }) {
  const items = [];
  for (const L of layers) for (const P of L.pieces || [{ loops: L.loops }]) { const b = bbox(P.loops); items.push({ L, P, b, w: b[2] - b[0], h: b[3] - b[1] }); }
  items.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));
  const sheets = []; let oversize = false;
  const tryPlace = (sh, it) => {
    for (const rot of [false, true]) {
      const w = rot ? it.h : it.w, hh = rot ? it.w : it.h;
      // shelves
      for (const row of sh.rows) if (row.x + w <= bedW - margin && hh <= row.h) { place(sh, it, row.x, row.y, rot); row.x += w + gap; return true; }
      const y = sh.rows.length ? sh.rows[sh.rows.length - 1].y + sh.rows[sh.rows.length - 1].h + gap : margin;
      if (y + hh <= bedH - margin && margin + w <= bedW - margin) { sh.rows.push({ x: margin + w + gap, y, h: hh }); place(sh, it, margin, y, rot); return true; }
    }
    return false;
  };
  const place = (sh, it, x, y, rot) => sh.items.push({ L: it.L, P: it.P, x, y, rot, b: it.b, w: rot ? it.h : it.w, h: rot ? it.w : it.h });
  for (const it of items) {
    let ok = false;
    for (const sh of sheets) if (tryPlace(sh, it)) { ok = true; break; }
    if (!ok) { const sh = { rows: [], items: [] }; sheets.push(sh); if (!tryPlace(sh, it)) { oversize = true; sh.items.push({ L: it.L, P: it.P, x: margin, y: margin, rot: false, b: it.b, w: it.w, h: it.h }); } }
  }
  return { sheets, oversize };
}
// item-local → sheet coordinates (sheet y measured from the bottom)
export function placer(item) {
  const [x0, y0] = item.b;
  return ([x, y]) => (item.rot ? [item.x + (y - y0), item.y + (item.h - (x - x0))] : [item.x + (x - x0), item.y + (y - y0)]);
}

// ---------- stroke digits for engraving (unit box 0..0.6 × 0..1) ----------
const DIG = {
  0: [[[0, 0], [0.6, 0], [0.6, 1], [0, 1], [0, 0]]], 1: [[[0.3, 0], [0.3, 1], [0.15, 0.85]]], 2: [[[0, 1], [0.6, 1], [0.6, 0.5], [0, 0.5], [0, 0], [0.6, 0]]],
  3: [[[0, 1], [0.6, 1], [0.6, 0], [0, 0]], [[0.15, 0.5], [0.6, 0.5]]], 4: [[[0, 1], [0, 0.5], [0.6, 0.5]], [[0.6, 1], [0.6, 0]]],
  5: [[[0.6, 1], [0, 1], [0, 0.5], [0.6, 0.5], [0.6, 0], [0, 0]]], 6: [[[0.6, 1], [0, 1], [0, 0], [0.6, 0], [0.6, 0.5], [0, 0.5]]],
  7: [[[0, 1], [0.6, 1], [0.25, 0]]], 8: [[[0, 0], [0.6, 0], [0.6, 1], [0, 1], [0, 0]], [[0, 0.5], [0.6, 0.5]]], 9: [[[0, 0], [0.6, 0], [0.6, 1], [0, 1], [0, 0.5], [0.6, 0.5]]],
};
export function textStrokes(str, x, y, size) {
  const out = [], adv = size * 0.85, total = adv * str.length - size * 0.25;
  [...str].forEach((ch, i) => { for (const s of DIG[ch] || []) out.push(s.map(([u, v]) => [x - total / 2 + i * adv + u * size, y - size / 2 + v * size])); });
  return out;
}

// ---------- outputs ----------
function sheetGeometry(sheet, layers, { engraveNext = true, numbers = true }) {
  const cut = [], eng = [];
  const byK = new Map(layers.map((L) => [L.k, L]));
  for (const it of sheet.items) {
    const f = placer(it), L = it.L, P = it.P;
    for (const l of P.loops) cut.push(l.map(f));
    const next = byK.get(L.k + 1);
    if (engraveNext && next) for (const l of next.loops) if (inPiece(l[0], P)) eng.push({ pts: l.map(f), closed: true });
    if (numbers && P.label) {
      const [lx, ly] = f([P.label.x, P.label.y]);
      for (const s of textStrokes(String(L.k), lx, ly, P.label.size)) eng.push({ pts: s, closed: false });
    }
  }
  return { cut, eng };
}

export function sheetSVG(sheet, layers, bed, opts = {}) {
  const { cut, eng } = sheetGeometry(sheet, layers, opts);
  const H = bed.bedH, fmt = (v) => (Math.round(v * 100) / 100).toString();
  const path = (pts, closed) => 'M' + pts.map(([x, y]) => `${fmt(x)} ${fmt(H - y)}`).join('L') + (closed ? 'Z' : '');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${bed.bedW}mm" height="${bed.bedH}mm" viewBox="0 0 ${bed.bedW} ${bed.bedH}">
<!-- PlotCloud contour model. Red = cut, blue = engrave. Units: mm. -->
<g id="engrave" fill="none" stroke="#0000ff" stroke-width="0.1">
${eng.map((e) => `<path d="${path(e.pts, e.closed)}"/>`).join('\n')}
</g>
<g id="cut" fill="none" stroke="#ff0000" stroke-width="0.1">
${cut.map((l) => `<path d="${path(l, true)}"/>`).join('\n')}
</g>
</svg>
`;
}

export function sheetsDXF(sheets, layers, bed, opts = {}) {
  const L = []; const w = (c, v) => L.push(String(c), String(v));
  const f = (v) => (Math.round(v * 1000) / 1000).toString();
  w(0, 'SECTION'); w(2, 'HEADER'); w(9, '$ACADVER'); w(1, 'AC1009'); w(9, '$INSUNITS'); w(70, 4); w(0, 'ENDSEC');
  w(0, 'SECTION'); w(2, 'TABLES'); w(0, 'TABLE'); w(2, 'LTYPE'); w(70, 1); w(0, 'LTYPE'); w(2, 'CONTINUOUS'); w(70, 0); w(3, 'Solid line'); w(72, 65); w(73, 0); w(40, 0); w(0, 'ENDTAB');
  w(0, 'TABLE'); w(2, 'LAYER'); w(70, 3);
  for (const [n, c] of [['CUT', 1], ['ENGRAVE', 5], ['SHEET', 8]]) { w(0, 'LAYER'); w(2, n); w(70, 0); w(62, c); w(6, 'CONTINUOUS'); }
  w(0, 'ENDTAB'); w(0, 'ENDSEC');
  w(0, 'SECTION'); w(2, 'ENTITIES');
  const poly = (layer, pts, closed, ox) => {
    w(0, 'POLYLINE'); w(8, layer); w(66, 1); w(70, closed ? 1 : 0); w(10, 0); w(20, 0); w(30, 0);
    for (const [x, y] of pts) { w(0, 'VERTEX'); w(8, layer); w(10, f(x + ox)); w(20, f(y)); w(30, 0); }
    w(0, 'SEQEND'); w(8, layer);
  };
  sheets.forEach((sh, si) => {
    const ox = si * (bed.bedW + 50);
    poly('SHEET', [[0, 0], [bed.bedW, 0], [bed.bedW, bed.bedH], [0, bed.bedH]], true, ox);
    const { cut, eng } = sheetGeometry(sh, layers, opts);
    for (const l of cut) poly('CUT', l, true, ox);
    for (const e of eng) poly('ENGRAVE', e.pts, e.closed, ox);
  });
  w(0, 'ENDSEC'); w(0, 'EOF');
  return L.join('\r\n') + '\r\n';
}

export function cutLength(layers) {
  let s = 0;
  for (const L of layers) for (const l of L.loops) for (let i = 0; i < l.length; i++) { const p = l[i], q = l[(i + 1) % l.length]; s += Math.hypot(q[0] - p[0], q[1] - p[1]); }
  return s;
}
