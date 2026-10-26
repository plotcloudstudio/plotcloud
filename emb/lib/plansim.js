// Shared by the plan simulations Wayfinding, Privacy and Outdoor noise (emb/wayfinding.html, emb/privacy.html, emb/noise.html):
// the plan view (pan, zoom, y up, metres), colour ramps, a raster with line-of-sight walks, sliced loops that keep the page
// responsive, and the bridge to the PlotCloud simulation page (the model comes in, the result goes back to the version).
// Each engine does its own analysis; nothing here knows what a result means.

export const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const PXR = () => Math.min(2, window.devicePixelRatio || 1);

// ---- colour ramps: stops [[t, [r,g,b]], …] with t from 0 to 1
export function ramp(stops, t) {
  t = clamp(t, 0, 1); let i = 1; while (i < stops.length - 1 && stops[i][0] < t) i++;
  const [t0, a] = stops[i - 1], [t1, b] = stops[i], u = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
  return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * u));
}
export const rampCSS = (stops) => `linear-gradient(90deg, ${stops.map(([t, c]) => `rgb(${c.join(',')}) ${Math.round(t * 100)}%`).join(', ')})`;
export const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// ---- the plan view: world metres, y up; drag pans, the wheel zooms, a click without a drag picks a point
export function planView(cv, { draw, onClick, onHover, onLeave } = {}) {
  const g = cv.getContext('2d'), V = { cx: 0, cy: 0, k: 20, w: 10, h: 10, d: 1 };
  const W2S = (p) => [V.w / 2 + (p[0] - V.cx) * V.k, V.h / 2 - (p[1] - V.cy) * V.k];
  const S2W = (x, y) => [V.cx + (x - V.w / 2) / V.k, V.cy - (y - V.h / 2) / V.k];
  let B = { x0: 0, y0: 0, x1: 10, y1: 10 }, raf = 0;
  const redraw = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; g.setTransform(V.d, 0, 0, V.d, 0, 0); g.clearRect(0, 0, V.w, V.h); draw && draw(g, api); }); };
  addEventListener('pc-ui-theme',redraw);
  const fit = (b) => { if (b) B = b; const w = Math.max(1, B.x1 - B.x0), h = Math.max(1, B.y1 - B.y0); V.k = Math.min(V.w * 0.86 / w, V.h * 0.8 / h); V.cx = (B.x0 + B.x1) / 2; V.cy = (B.y0 + B.y1) / 2 - 0.02 * h; redraw(); };
  const size = () => { const r = cv.getBoundingClientRect(); V.d = PXR(); V.w = Math.max(10, r.width); V.h = Math.max(10, r.height); cv.width = Math.round(V.w * V.d); cv.height = Math.round(V.h * V.d); };
  new ResizeObserver(() => { const first = V.w === 10; size(); if (first) fit(); else redraw(); }).observe(cv);
  let drag = null;
  cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: V.cx, cy: V.cy, moved: false }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 3) drag.moved = true; if (drag.moved) { V.cx = drag.cx - dx / V.k; V.cy = drag.cy + dy / V.k; redraw(); } return; }
    onHover && onHover(S2W(sx, sy), [sx, sy]);
  });
  cv.addEventListener('pointerup', (e) => { const r = cv.getBoundingClientRect(); if (drag && !drag.moved && onClick) onClick(S2W(e.clientX - r.left, e.clientY - r.top), e); drag = null; });
  cv.addEventListener('pointerleave', () => onLeave && onLeave());
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top, before = S2W(sx, sy);
    V.k = clamp(V.k * Math.exp(-e.deltaY * 0.0015), 0.5, 600); const after = S2W(sx, sy); V.cx += before[0] - after[0]; V.cy += before[1] - after[1]; redraw(); }, { passive: false });
  const api = { V, W2S, S2W, fit, redraw, ctx: g, get k() { return V.k; } };
  return api;
}
// a grid field (one value per cell) as an image laid on the plan: colour(v) → [r,g,b,a] or null
export function fieldImage(G, vals, colour) {
  const c = document.createElement('canvas'); c.width = G.W; c.height = G.H; const x = c.getContext('2d'), im = x.createImageData(G.W, G.H);
  for (let j = 0; j < G.H; j++) for (let i = 0; i < G.W; i++) { const v = vals[j * G.W + i], col = Number.isFinite(v) ? colour(v) : null; if (!col) continue;
    const o = ((G.H - 1 - j) * G.W + i) * 4; im.data[o] = col[0]; im.data[o + 1] = col[1]; im.data[o + 2] = col[2]; im.data[o + 3] = col[3] ?? 255; }
  x.putImageData(im, 0, 0); return c;
}
export function drawField(g, view, G, img, alpha = 1) {
  const a = view.W2S([G.x0, G.y0 + G.H * G.c]), b = view.W2S([G.x0 + G.W * G.c, G.y0]);
  g.save(); g.globalAlpha = alpha; g.imageSmoothingEnabled = false; g.drawImage(img, a[0], a[1], b[0] - a[0], b[1] - a[1]); g.restore();
}

// ---- geometry
// where segment a-b crosses segment c-d: the share along a-b, or -1
export function segCross(a, b, c, d) {
  const rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1], den = rx * sy - ry * sx; if (Math.abs(den) < 1e-12) return -1;
  const qx = c[0] - a[0], qy = c[1] - a[1], t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
  return t > 1e-9 && t < 1 - 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 ? t : -1;
}
export function inPoly(p, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// ---- a raster over the plan: one byte of flags per cell; walls, furniture and so on are painted into it
export function raster(b, c) {
  const W = Math.max(1, Math.ceil((b.x1 - b.x0) / c)), H = Math.max(1, Math.ceil((b.y1 - b.y0) / c));
  return { x0: b.x0, y0: b.y0, c, W, H, a: new Uint8Array(W * H) };
}
export const cellOf = (R, p) => { const i = Math.floor((p[0] - R.x0) / R.c), j = Math.floor((p[1] - R.y0) / R.c); return i < 0 || j < 0 || i >= R.W || j >= R.H ? -1 : j * R.W + i; };
export const centre = (R, k) => [R.x0 + (k % R.W + 0.5) * R.c, R.y0 + (Math.floor(k / R.W) + 0.5) * R.c];
// every cell within r of segment a-b gets the flag
export function paintSeg(R, a, b, r, flag) {
  const x0 = Math.min(a[0], b[0]) - r, x1 = Math.max(a[0], b[0]) + r, y0 = Math.min(a[1], b[1]) - r, y1 = Math.max(a[1], b[1]) + r;
  const i0 = clamp(Math.floor((x0 - R.x0) / R.c), 0, R.W - 1), i1 = clamp(Math.floor((x1 - R.x0) / R.c), 0, R.W - 1), j0 = clamp(Math.floor((y0 - R.y0) / R.c), 0, R.H - 1), j1 = clamp(Math.floor((y1 - R.y0) / R.c), 0, R.H - 1);
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, rr = (r + R.c * 0.35) ** 2;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const px = R.x0 + (i + 0.5) * R.c, py = R.y0 + (j + 0.5) * R.c, t = L ? clamp(((px - a[0]) * dx + (py - a[1]) * dy) / L, 0, 1) : 0;
    const qx = a[0] + t * dx - px, qy = a[1] + t * dy - py; if (qx * qx + qy * qy <= rr) R.a[j * R.W + i] |= flag; }
}
export function paintRect(R, x, y, w, d, flag, pad = 0) {
  const i0 = clamp(Math.floor((x - pad - R.x0) / R.c), 0, R.W), i1 = clamp(Math.ceil((x + w + pad - R.x0) / R.c), 0, R.W), j0 = clamp(Math.floor((y - pad - R.y0) / R.c), 0, R.H), j1 = clamp(Math.ceil((y + d + pad - R.y0) / R.c), 0, R.H);
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) R.a[j * R.W + i] |= flag;
}
// is the straight line p-q free of cells carrying any of these flags (cells walked by a DDA, both ends excluded)
export function los(R, p, q, mask) {
  let x = (p[0] - R.x0) / R.c, y = (p[1] - R.y0) / R.c; const ex = (q[0] - R.x0) / R.c, ey = (q[1] - R.y0) / R.c;
  let i = Math.floor(x), j = Math.floor(y); const ie = Math.floor(ex), je = Math.floor(ey), dx = ex - x, dy = ey - y;
  const si = dx > 0 ? 1 : -1, sj = dy > 0 ? 1 : -1, tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity;
  let tx = dx ? (dx > 0 ? (i + 1 - x) : (x - i)) * tdx : Infinity, ty = dy ? (dy > 0 ? (j + 1 - y) : (y - j)) * tdy : Infinity, n = 0;
  while ((i !== ie || j !== je) && n++ < 100000) {
    if (tx < ty) { i += si; tx += tdx; } else { j += sj; ty += tdy; }
    if (i === ie && j === je) break;
    if (i < 0 || j < 0 || i >= R.W || j >= R.H) return false;
    if (R.a[j * R.W + i] & mask) return false;
  }
  return true;
}
// march from p in direction (dx,dy) until a cell with the mask or the edge; cb(k) for every free cell passed
export function march(R, p, dx, dy, mask, maxD, cb) {
  const st = R.c * 0.5, n = Math.ceil(maxD / st); let last = -1;
  for (let s = 1; s <= n; s++) { const x = p[0] + dx * s * st, y = p[1] + dy * s * st, k = cellOf(R, [x, y]); if (k < 0) return; if (k === last) continue; last = k; if (R.a[k] & mask) return; cb(k); }
}

// ---- long loops in slices, so the page keeps drawing and a Stop button works
export async function sliced(n, fn, { onProg, stop, budget = 24 } = {}) {
  let i = 0;
  while (i < n) { const t0 = performance.now(); while (i < n && performance.now() - t0 < budget) fn(i++); onProg && onProg(i / n); if (stop && stop()) return false; await new Promise((r) => setTimeout(r, 0)); }
  return true;
}

// ---- the analysis controls every engine has: Run, a progress bar, a message
export function runUI(go) {
  const run = $('#run'), prog = $('#prog'), bar = prog.querySelector('i'), msg = $('#runMsg');
  const ui = {
    busy: false,
    prog: (f) => { bar.style.width = Math.round(f * 100) + '%'; },
    say: (t, cls = '') => { msg.textContent = t; msg.className = 'msg ' + cls; },
    async start() { if (ui.busy) return; ui.busy = true; run.disabled = true; prog.hidden = false; ui.prog(0);
      try { await go(ui); } catch (e) { console.error(e); ui.say(e.message || 'The analysis stopped.', 'warn'); } finally { ui.busy = false; run.disabled = false; prog.hidden = true; } },
  };
  run.addEventListener('click', () => ui.start());
  return ui;
}

// ---- the PlotCloud simulation page: the model comes in ("project"), "Add to project" sends the figures and a picture back ("save")
export function bridge({ onScene, state, canvas }) {
  const post = (m) => { try { window.parent.postMessage(Object.assign({ pc: 1 }, m), '*'); } catch (e) { } };
  window.__pcSceneJSON = () => null;
  window.__pcAnalysisState = state;
  let SRC = null; const note = $('#pcProjN');
  $('#pcAdd')?.addEventListener('click', () => {
    const st = state(); if (!st.ready) { if (note) note.textContent = 'Run the analysis on the current model and settings first.'; return; }
    const kpis = $$('.kpis > div').map((d) => [(d.querySelector('small')?.textContent || '').trim(), (d.querySelector('b')?.textContent || '').trim()]).filter(([k, v]) => k && v && v !== '—');
    let img = null; try { const cv = canvas(), w = 640, c2 = document.createElement('canvas'); c2.width = w; c2.height = Math.round(cv.height * w / cv.width); const x = c2.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, c2.height); x.drawImage(cv, 0, 0, w, c2.height); img = c2.toDataURL('image/jpeg', 0.8); } catch (e) { }
    post({ t: 'save', tool: document.title.replace(/^PlotCloud\s+/i, ''), kpis, img, model: ($('#mName')?.textContent || '').trim(), source: Object.assign({}, SRC || {}, { analysis: st.conditions }) });
    if (note) note.textContent = 'Saving…';
  });
  window.addEventListener('message', (e) => {
    if (e.source !== window.parent) return; const d = e.data || {}; if (!d.pc) return;
    if (d.t === 'project' && d.scene) { SRC = d.source || null; try { onScene(JSON.parse(d.scene), d); } catch (er) { console.error(er); } }
    if (d.t === 'saved' && note) note.textContent = `Added · ${d.count} result${d.count > 1 ? 's' : ''} on this version`;
    if (d.t === 'error' && note) note.textContent = d.msg || 'Could not save.';
  });
  if (window.parent !== window) setTimeout(() => post({ t: 'hello', tool: document.title, scene: true }), 150);
  return { get source() { return SRC; } };
}

// per-engine settings kept in this browser (roads drawn, privacy needs of rooms…), by project
export const keep = {
  get(k, d) { try { const v = localStorage.getItem('pc-psim:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('pc-psim:' + k, JSON.stringify(v)); } catch (e) { } },
};

// segmented buttons: [data-x] inside a .seg; returns a setter
export function seg(el, attr, onPick) {
  const set = (v) => { $$(`[${attr}]`, el).forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === String(v)))); };
  el.addEventListener('click', (e) => { const b = e.target.closest(`[${attr}]`); if (!b) return; set(b.getAttribute(attr)); onPick(b.getAttribute(attr)); });
  return set;
}

// ---- a Plan Studio level as the plan simulations read it (walls whole, openings with their side, rooms as rectangles)
// solid pieces of a wall: the wall minus the openings of the given kinds that sit on it
export function wallPieces(w, open, kinds) {
  const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], L = Math.hypot(dx, dy); if (L < 1e-6) return [];
  const ux = dx / L, uy = dy / L, cut = [];
  for (const o of open) { if (!kinds.includes(o.kind)) continue; const m = [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2], off = Math.abs((m[0] - w.a[0]) * uy - (m[1] - w.a[1]) * ux); if (off > Math.max(0.05, (w.t || 0.2))) continue;
    const t0 = (o.a[0] - w.a[0]) * ux + (o.a[1] - w.a[1]) * uy, t1 = (o.b[0] - w.a[0]) * ux + (o.b[1] - w.a[1]) * uy; const lo = Math.min(t0, t1), hi = Math.max(t0, t1); if (hi < 0 || lo > L) continue; cut.push([Math.max(0, lo), Math.min(L, hi)]); }
  cut.sort((p, q) => p[0] - q[0]); const out = []; let s = 0;
  for (const [lo, hi] of cut) { if (lo > s + 1e-3) out.push([[w.a[0] + ux * s, w.a[1] + uy * s], [w.a[0] + ux * lo, w.a[1] + uy * lo]]); s = Math.max(s, hi); }
  if (L > s + 1e-3) out.push([[w.a[0] + ux * s, w.a[1] + uy * s], [w.b[0], w.b[1]]]);
  return out;
}
export const ROOM_SKIP = /corridor|hall|lobby|landing|stair|entry|entrance|circulation|passage|foyer|vestibule|走廊|门厅|楼梯/i;
// a two-bedroom flat with a corridor, for opening an engine on its own (no project)
export function sampleFlat() {
  const W = (a, b, t = 0.2) => ({ a, b, h: 2.7, t }), D = (a, b, ext = false) => ({ a, b, kind: 'door', ext, sill: 0, head: 2.1 }), N = (a, b, sill = 0.9, head = 2.2) => ({ a, b, kind: 'win', ext: true, sill, head });
  const R = (name, x, y, w, d) => ({ name, label: [x + w / 2, y + d / 2], rects: [[x, y, w, d]] });
  return { app: 'plotcloud-sample', name: 'Sample flat', bounds: { w: 14, h: 10 }, origin: [0, 0], settings: { floorZ: 0, ceil: 2.7, north: 0 },
    walls: [W([1, 1], [13, 1]), W([13, 1], [13, 9]), W([13, 9], [1, 9]), W([1, 9], [1, 1]), W([1, 4.5], [13, 4.5], 0.12), W([1, 5.7], [13, 5.7], 0.12),
      W([7, 1], [7, 4.5], 0.12), W([10, 1], [10, 4.5], 0.12), W([5, 5.7], [5, 9], 0.12), W([9, 5.7], [9, 9], 0.12)],
    open: [D([1, 4.6], [1, 5.6], true), D([3, 4.5], [3.9, 4.5]), D([8, 4.5], [8.9, 4.5]), D([11, 4.5], [11.8, 4.5]), D([2.5, 5.7], [3.4, 5.7]), D([6.5, 5.7], [7.4, 5.7]), D([10.5, 5.7], [11.4, 5.7]),
      N([2, 1], [5.5, 1], 0.5), N([7.8, 1], [9.3, 1], 1.0), N([11, 1], [12, 1], 1.5), N([2, 9], [4, 9]), N([6, 9], [8, 9]), N([10, 9], [12, 9]), N([13, 4.7], [13, 5.5])],
    rooms: [R('Corridor', 1, 4.5, 12, 1.2), R('Living room', 1, 1, 6, 3.5), R('Kitchen', 7, 1, 3, 3.5), R('Bathroom', 10, 1, 3, 3.5), R('Bedroom 1', 1, 5.7, 4, 3.3), R('Bedroom 2', 5, 5.7, 4, 3.3), R('Study', 9, 5.7, 4, 3.3)],
    furn: [{ x: 1.6, y: 7, w: 1.6, d: 2, h: 0.5, name: 'Bed' }, { x: 3.8, y: 8.3, w: 1.1, d: 0.6, h: 2.1, name: 'Wardrobe' }, { x: 5.6, y: 7.2, w: 1.4, d: 1.9, h: 0.5, name: 'Bed' },
      { x: 1.5, y: 2.6, w: 2.2, d: 0.9, h: 0.8, name: 'Sofa' }, { x: 9.6, y: 6.2, w: 1.6, d: 0.8, h: 0.75, name: 'Desk' }, { x: 9.3, y: 8.4, w: 2.4, d: 0.5, h: 2.0, name: 'Shelves' }] };
}
// the plan as every plan engine draws it under its result
export function drawPlanScene(g, view, SC, { roomFill = '#fbfbfa', names = true, furn = true } = {}) {
  const k = view.k, P = (p) => view.W2S(p);
  g.fillStyle = roomFill; for (const r of SC.rooms || []) for (const [x, y, w, d] of r.rects) { const a = P([x, y + d]); g.fillRect(a[0], a[1], w * k + 0.5, d * k + 0.5); }
  return {
    over() {   // walls, openings, furniture and names, drawn over the result
      if (furn) { g.lineWidth = 1; for (const f of SC.furn || []) { const a = P([f.x, f.y + f.d]); g.fillStyle = f.h >= 1.5 ? 'rgba(90,88,83,.55)' : 'rgba(255,255,255,.55)'; g.strokeStyle = '#8a877f'; g.fillRect(a[0], a[1], f.w * k, f.d * k); g.strokeRect(a[0], a[1], f.w * k, f.d * k); } }
      g.lineCap = 'butt'; g.strokeStyle = '#2b2a27';
      for (const w of SC.walls || []) for (const [a, b] of wallPieces(w, SC.open || [], ['door', 'win', 'hole'])) { const p = P(a), q = P(b); g.lineWidth = Math.max(1.5, (w.t || 0.2) * k); g.beginPath(); g.moveTo(...p); g.lineTo(...q); g.stroke(); }
      for (const o of SC.open || []) { const p = P(o.a), q = P(o.b); if (o.kind === 'win') { g.strokeStyle = '#4f86b8'; g.lineWidth = Math.max(2, 0.12 * k); g.beginPath(); g.moveTo(...p); g.lineTo(...q); g.stroke(); g.strokeStyle = '#e8f1f8'; g.lineWidth = Math.max(0.8, 0.04 * k); g.beginPath(); g.moveTo(...p); g.lineTo(...q); g.stroke(); }
        else if (o.kind === 'door') { g.strokeStyle = o.ext ? '#d8402a' : '#9b978f'; g.lineWidth = 1.2; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(...p); g.lineTo(...q); g.stroke(); g.setLineDash([]); } }
      if (names) { g.font = `600 ${clamp(k * 0.32, 9, 13)}px ${getComputedStyle(document.body).fontFamily}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (const r of SC.rooms || []) { const p = P(r.label || [r.rects[0][0] + r.rects[0][2] / 2, r.rects[0][1] + r.rects[0][3] / 2]), t = r.name, w = g.measureText(t).width + 8; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(p[0] - w / 2, p[1] - 8, w, 16); g.fillStyle = '#2b2a27'; g.fillText(t, p[0], p[1]); } }
    } };
}
export const sceneBounds = (SC) => ({ x0: 0, y0: 0, x1: SC.bounds.w, y1: SC.bounds.h });
// the drawn building's extent (walls), for observers and fitting
export function wallBox(SC) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const w of SC.walls) for (const p of [w.a, w.b]) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } return Number.isFinite(x0) ? { x0, y0, x1, y1 } : sceneBounds(SC); }
