// Stormwater on the site grid (2026-10-31): one design storm falls on a grid of the ground; each cell sheds its runoff (rain ×
// runoff coefficient), buildings shed theirs off the roof to the ground beside them, and water runs downhill (D8 on the
// pit-filled ground) until it leaves the area or fills a hollow. A hollow holds water up to its spill level; when less water
// reaches it than it can hold, it fills to the level that volume reaches (fill and spill). No infiltration timing, no drains,
// pipes or kerbs, no flow over time: a screening of where water goes and where it can collect, not a drainage design.
const D8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

// a binary heap of cells by height (priority flood)
function heap() { const k = [], v = []; return {
  get size() { return k.length; },
  push(c, z) { k.push(c); v.push(z); let i = k.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (v[p] <= v[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; } },
  pop() { const top = k[0], lk = k.pop(), lv = v.pop(); if (k.length) { k[0] = lk; v[0] = lv; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < k.length && v[l] < v[m]) m = l; if (r < k.length && v[r] < v[m]) m = r; if (m === i) break; [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m; } } return top; } }; }

// g: { nx, ny, cell, z (ground height, m), solid (1 = building) }; C: Float32Array runoff coefficient per cell; rain: storm depth (mm)
export function stormwater(g, C, rain) {
  const { nx, ny, cell } = g, N = nx * ny, a = cell * cell, P = rain / 1000, solid = g.solid;
  // buildings stand well above the ground so their roof water runs off to the ground beside them
  const z = new Float64Array(N); for (let c = 0; c < N; c++) z[c] = (g.z ? g.z[c] : 0) + (solid[c] ? 200 : 0);
  // priority flood from the edges: F is the level water must reach to leave the area; flats get a tiny slope so they drain
  const F = new Float64Array(N).fill(Infinity), done = new Uint8Array(N), H = heap(), eps = 1e-5;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) { const c = j * nx + i; F[c] = z[c]; done[c] = 1; H.push(c, z[c]); }
  const order = []; while (H.size) { const c = H.pop(); order.push(c); const i = c % nx, j = (c / nx) | 0;
    for (const [di, dj] of D8) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue; const d = jj * nx + ii; if (done[d]) continue; done[d] = 1; F[d] = Math.max(z[d], F[c] + eps); H.push(d, F[d]); } }
  // flow direction: the steepest lower neighbour on the filled ground
  const to = new Int32Array(N).fill(-1);
  for (let c = 0; c < N; c++) { const i = c % nx, j = (c / nx) | 0; let best = 0; for (const [di, dj] of D8) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue; const d = jj * nx + ii, s = (F[c] - F[d]) / Math.hypot(di, dj); if (s > best) { best = s; to[c] = d; } } }
  // runoff from every cell carried downhill: the order of the flood, highest first
  const runoff = new Float64Array(N), acc = new Float64Array(N); let rainV = 0, runV = 0;
  for (let c = 0; c < N; c++) { rainV += P * a; runoff[c] = P * C[c] * a; runV += runoff[c]; acc[c] = runoff[c]; }
  for (let n = order.length - 1; n >= 0; n--) { const c = order[n]; if (to[c] >= 0) acc[to[c]] += acc[c]; }
  // hollows: connected ground cells below their spill level; each fills with the water that reaches it, up to the spill level
  const pond = new Float32Array(N), lab = new Int32Array(N).fill(-1), hollows = [];
  for (let c0 = 0; c0 < N; c0++) { if (lab[c0] >= 0 || solid[c0] || F[c0] - z[c0] < 0.01) continue; const cells = [c0], id = hollows.length; lab[c0] = id;
    for (let q = 0; q < cells.length; q++) { const c = cells[q], i = c % nx, j = (c / nx) | 0; for (const [di, dj] of D8) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue; const d = jj * nx + ii; if (lab[d] < 0 && !solid[d] && F[d] - z[d] >= 0.01) { lab[d] = id; cells.push(d); } } }
    let inflow = 0, cap = 0, spill = -Infinity, low = Infinity; for (const c of cells) { inflow = Math.max(inflow, acc[c]); cap += (F[c] - z[c]) * a; spill = Math.max(spill, F[c]); low = Math.min(low, z[c]); }
    let level = spill; if (inflow < cap) { let lo = low, hi = spill; for (let it = 0; it < 40; it++) { const L = (lo + hi) / 2; let v = 0; for (const c of cells) v += Math.max(0, L - z[c]) * a; if (v > inflow) hi = L; else lo = L; } level = lo; }
    let vol = 0; for (const c of cells) { pond[c] = Math.max(0, level - z[c]); vol += pond[c] * a; } hollows.push({ cells: cells.length, cap, inflow, vol, full: inflow >= cap }); }
  for (let c = 0; c < N; c++) if (solid[c]) { pond[c] = NaN; }
  return { acc, pond, to, rainV, runV, hollows, pondV: hollows.reduce((s, h) => s + h.vol, 0) };
}
