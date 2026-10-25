// A project version as the PlotCloud scene the Sun Hours engine (emb/sunhours.html) reads: the same "plotcloud-scene"
// Plan Studio sends — masses with roles, location and north, plan metres, Z up. Only the input is prepared here;
// the analysis, the pictures and the exports are the engine's own.
//   proposed: one storey block per level, the outer outline of its walls and slabs (as Plan Studio sends storey outlines), plus each roof
//   context: each massing block on a context layer (casts shadows only)
import { levelsOf } from './viewport2.js';

// Account time zone (IANA) → the engine's standard UTC offset and DST rule (1 North America, 2 Europe, 3 southern hemisphere)
export function tzInfo(site) {
  const fallback = { tz: Math.round((site?.lon || 0) / 15), dst: 0, source: 'estimated from longitude' };
  if (!site?.tz || typeof Intl === 'undefined') return fallback;
  try {
    const off = (month) => { const s = new Intl.DateTimeFormat('en-US', { timeZone: site.tz, timeZoneName: 'shortOffset' }).formatToParts(new Date(Date.UTC(new Date().getUTCFullYear(), month, 15, 12))).find((x) => x.type === 'timeZoneName')?.value || 'GMT';
      const m = s.match(/GMT([+-]\d+)(?::(\d+))?/); return m ? +m[1] + Math.sign(+m[1] || 1) * (+(m[2] || 0) / 60) : 0; };
    const jan = off(0), jul = off(6), std = Math.min(jan, jul);
    return { tz: std, dst: jan === jul ? 0 : site.lat < 0 ? 3 : site.lon < -30 ? 1 : 2, source: site.tz };
  } catch (e) { return fallback; }
}

// outer outlines of a set of axis-aligned rectangles (anything enclosed is filled, as a storey block is)
function outlines(rects) {
  if (!rects.length) return [];
  const xs = [...new Set(rects.flatMap((r) => [r.x0, r.x1]).map((v) => +v.toFixed(4)))].sort((a, b) => a - b), ys = [...new Set(rects.flatMap((r) => [r.y0, r.y1]).map((v) => +v.toFixed(4)))].sort((a, b) => a - b);
  const nx = xs.length - 1, ny = ys.length - 1, cov = new Uint8Array((nx + 2) * (ny + 2)), at = (i, j) => (j + 1) * (nx + 2) + (i + 1);
  for (const r of rects) for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2; if (cx > r.x0 && cx < r.x1 && cy > r.y0 && cy < r.y1) cov[at(i, j)] = 1; }
  // flood the outside from the border; every cell not reached is part of a block
  const out = new Uint8Array(cov.length), st = [at(-1, -1)]; out[st[0]] = 1;
  while (st.length) { const k = st.pop(), i = (k % (nx + 2)) - 1, j = Math.floor(k / (nx + 2)) - 1; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < -1 || b < -1 || a > nx || b > ny) continue; const q = at(a, b); if (!out[q] && !cov[q]) { out[q] = 1; st.push(q); } } }
  const inside = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && !out[at(i, j)];
  // boundary edges, counter-clockwise around inside cells, chained into loops
  const next = new Map(), key = (x, y) => x + ',' + y;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { if (!inside(i, j)) continue; const X0 = xs[i], X1 = xs[i + 1], Y0 = ys[j], Y1 = ys[j + 1];
    if (!inside(i, j - 1)) next.set(key(X0, Y0), [X1, Y0]); if (!inside(i + 1, j)) next.set(key(X1, Y0), [X1, Y1]); if (!inside(i, j + 1)) next.set(key(X1, Y1), [X0, Y1]); if (!inside(i - 1, j)) next.set(key(X0, Y1), [X0, Y0]); }
  const loops = [], seen = new Set();
  for (const [k0] of next) { if (seen.has(k0)) continue; const loop = []; let k = k0, guard = 0; while (!seen.has(k) && guard++ < 100000) { seen.add(k); const [x, y] = k.split(',').map(Number); loop.push([x, y]); const n = next.get(k); if (!n) break; k = key(n[0], n[1]); }
    const simp = loop.filter((p, i) => { const a = loop[(i - 1 + loop.length) % loop.length], b = loop[(i + 1) % loop.length]; return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-9; });
    if (simp.length >= 3) loops.push(simp); }
  return loops;
}
const rectOf = (c) => ({ x0: c.g.x, y0: c.g.y, x1: c.g.x + c.g.w, y1: c.g.y + c.g.d });
const ring = (r) => [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]].map((p) => p.map((v) => +v.toFixed(3)));

export function sunScene(model, site, { name = 'Project', project = null, version = null } = {}) {
  const vis = new Set(model.layers.filter((l) => l.visible !== false).map((l) => l.name)), comps = model.components.filter((c) => vis.has(c.layer));
  const lv = levelsOf(model), masses = [], notes = [];
  lv.forEach((L, k) => {
    const top = lv[k + 1]?.z ?? Infinity, parts = comps.filter((c) => (c.type === 'wall' || c.type === 'slab') && c.g.z + c.g.h > L.z + 0.01 && c.g.z < top - 0.01);
    const walls = parts.filter((c) => c.type === 'wall'); if (!walls.length) return;
    const base = Math.min(...walls.map((c) => c.g.z)), h = Math.max(...walls.map((c) => c.g.z + c.g.h));
    outlines(parts.map(rectOf)).forEach((o, i) => masses.push({ id: `L${L.n}_${i}`, role: 'proposed', level: `Level ${L.n}`, base: +base.toFixed(3), h: +h.toFixed(3), outer: o, holes: [] }));
  });
  for (const c of comps.filter((x) => x.type === 'roof')) masses.push({ id: c.id, role: 'proposed', level: 'Roof', base: +c.g.z.toFixed(3), h: +(c.g.z + c.g.h).toFixed(3), outer: ring(rectOf(c)), holes: [] });
  // masses drawn in Plan Studio (Massing) are the proposal; other mass components are context blocks
  if (vis.has('Masses')) for (const m of (model.studio && model.studio.masses) || []) masses.push({ id: 'mass_' + m.id, role: 'proposed', level: m.name || 'Mass', base: 0, h: +(m.storeys * m.fh).toFixed(3), outer: m.points.map((q) => q.map((v) => +v.toFixed(3))), holes: [] });
  for (const c of comps.filter((x) => x.type === 'mass' && !/^ps:mass:/.test(x.id))) masses.push({ id: c.id, role: 'context', base: +c.g.z.toFixed(3), h: +(c.g.z + c.g.h).toFixed(3), outer: ring(rectOf(c)), holes: [] });
  const skipped = comps.filter((c) => c.type === 'imported').length; if (skipped) notes.push(`${skipped} imported mesh${skipped > 1 ? 'es are' : ' is'} not sent; give them a type to include them.`);
  const t = tzInfo(site);
  return { format: 'plotcloud-scene', v: 1, kind: 'masses', app: 'plotcloud-workspace', name,
    loc: site && Number.isFinite(site.lat) ? { lat: site.lat, lon: site.lon, tz: t.tz, dst: t.dst, label: site.label || '' } : null,
    north: -(site?.north || 0), masses, terrain: null, analysis: null,
    source: { app: 'plotcloud-workspace', project, version, level: 'all' }, notes };
}
