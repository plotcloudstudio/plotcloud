// Series preview and export (2026-11-09). A study run through the year (12 months or 4 seasons) opens here, in a window the size
// of the import preview: one tile per picture in a grid (12 → 4 × 3, 4 → 2 × 2), all seen through one camera. Dragging any tile
// turns every tile (right-drag or Shift-drag pans, the wheel zooms), so the view to export is chosen once. One colour scale for
// the whole series (set by the caller). Export: the sheet as PNG, every picture and the sheet as ZIP, or a PDF (A3 landscape)
// whose title, captions, legend and notes are text and whose pictures are re-rendered at print size from the same view.
//   opts: { frames: [{ label }], cols, meta, paint(i), snap(w, h, scale) → canvas, move({ orbit, pan, zoom }), onClose() }
//   meta: { project, site, lat, lon, study, what, basis, quality, grid, title, unit, lo, hi, dec, cols (legend colours),
//           labels, method, version, revision, at (Date), station }
import { zip } from './zip-store.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (v, d = 1) => Number(v || 0).toLocaleString('en', { maximumFractionDigits: d, minimumFractionDigits: d });
const stamp = (t) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
const slug = (s) => String(s || 'plotcloud').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
const raf = () => new Promise((r) => requestAnimationFrame(() => r()));

// the lines every export carries: what, where, how and when (a result is read with its basis)
export function notesOf(m, n) {
  return {
    head: `${m.study} · ${n === 12 ? '12 months' : n === 4 ? '4 seasons' : n + ' pictures'}`,
    sub: `${m.basis} · ${m.what}`,
    where: [m.project, m.site && m.site !== m.project ? m.site : '', Number.isFinite(m.lat) ? `${num(Math.abs(m.lat), 4)}° ${m.lat >= 0 ? 'N' : 'S'}, ${num(Math.abs(m.lon), 4)}° ${m.lon >= 0 ? 'E' : 'W'}` : ''].filter(Boolean).join(' · '),
    basis: `Quality ${m.quality} · grid ${m.grid} · model ${m.version} · conditions revision ${m.revision ?? '–'}${m.station ? ` · weather ${m.station}` : ''}`,
    scale: `One colour scale for every picture: ${num(m.lo, m.dec)} to ${num(m.hi, m.dec)} ${m.unit}`,
    made: `Generated ${stamp(m.at)} with PlotCloud`,
  };
}

// the legend as a horizontal bar: colours low → high (legend colours run high → low, as the study legend lists them)
function legendStops(m) { const c = m.cols && m.cols.length ? m.cols.slice() : ['#ddd', '#333']; return m.labels ? c.slice().reverse() : c; }
function drawLegend(g, x, y, w, h, m, fs) {
  const stops = legendStops(m), gr = g.createLinearGradient(x, 0, x + w, 0); stops.forEach((c, i) => gr.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), c));
  g.fillStyle = gr; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(17,24,39,.35)'; g.lineWidth = Math.max(1, fs / 12); g.strokeRect(x, y, w, h);
  g.fillStyle = '#111827'; g.font = `500 ${fs}px Inter, system-ui, sans-serif`; g.textBaseline = 'top';
  const ticks = [0, 0.25, 0.5, 0.75, 1]; for (const t of ticks) { const v = m.lo + (m.hi - m.lo) * t, tx = x + w * t; g.fillRect(tx - 0.5, y + h, 1, fs * 0.35); g.textAlign = t === 0 ? 'left' : t === 1 ? 'right' : 'center'; g.fillText(num(v, m.dec), tx, y + h + fs * 0.45); }
  g.textAlign = 'left'; g.fillStyle = '#374151'; g.fillText(m.unit, x + w + fs * 0.6, y - fs * 0.05);
}

export function openSeriesPreview(app, o) {
  const n = o.frames.length, cols = o.cols || Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), m = o.meta, N = notesOf(m, n);
  const back = document.createElement('div'); back.className = 'sx'; back.setAttribute('role', 'dialog'); back.setAttribute('aria-modal', 'true'); back.setAttribute('aria-label', N.head);
  const stops = legendStops(m);
  back.innerHTML = `<div class="sx-win">
    <header class="sx-head"><div><b>${esc(N.head)}</b><span>${esc(N.sub)}</span></div>
      <div class="sx-acts"><button type="button" class="btn sm" data-sx="png" title="One picture of the whole sheet, with its title, legend and notes">Sheet (PNG)</button><button type="button" class="btn sm" data-sx="zip" title="Every picture at print size, the sheet, and the settings">All pictures (ZIP)</button><button type="button" class="btn sm primary" data-sx="pdf" title="A3 landscape: the pictures at print size, text and legend as text">PDF (A3)</button><button type="button" class="sx-x" data-sx="close" aria-label="Close the preview" title="Close">×</button></div></header>
    <div class="sx-grid" style="grid-template-columns:repeat(${cols},minmax(0,1fr));grid-template-rows:repeat(${rows},minmax(0,1fr))">${o.frames.map((f, i) => `<figure class="sx-tile" data-i="${i}"><canvas aria-label="${esc(f.label)}"></canvas><figcaption>${esc(f.label)}</figcaption></figure>`).join('')}</div>
    <footer class="sx-foot"><div class="sx-leg"><span class="sx-bar" style="background:linear-gradient(90deg,${stops.join(',')})"></span><span class="sx-lab"><i>${esc(num(m.lo, m.dec))}</i><i>${esc(num((m.lo + m.hi) / 2, m.dec))}</i><i>${esc(num(m.hi, m.dec))} ${esc(m.unit)}</i></span></div>
      <p class="sx-note">${esc(N.scale)}. Drag any picture to turn them all; right-drag or Shift-drag to pan; scroll to zoom.</p><p class="sx-status" aria-live="polite"></p></footer></div>`;
  app.append(back);
  const tiles = [...back.querySelectorAll('.sx-tile')], cvs = tiles.map((t) => t.querySelector('canvas')), status = back.querySelector('.sx-status');
  const box = () => { const r = cvs[0].getBoundingClientRect(); return { w: Math.max(40, r.width), h: Math.max(30, r.height) }; };
  const R = { token: 0, painted: -1, busy: false };
  const put = (i, c) => { if (!c) return; const t = cvs[i]; t.width = c.width; t.height = c.height; t.getContext('2d').drawImage(c, 0, 0); };
  const shot = (i, sc = 1) => { if (R.painted !== i) { o.paint(i); R.painted = i; } const b = box(); return o.snap(b.w, b.h, sc); };
  // every tile, one after another (a newer request stops an older one); low resolution while the view moves
  async function renderAll(sc = 1, first = -1) { const tk = ++R.token; const order = [...Array(n).keys()].sort((a, b) => (a === first ? -1 : b === first ? 1 : a - b));
    for (let k = 0; k < order.length; k++) { if (tk !== R.token) return false; const i = order[k]; put(i, shot(i, sc)); status.textContent = sc < 1 ? 'Moving the view…' : k + 1 < n ? `Drawing ${k + 1} of ${n}…` : ''; await raf(); }
    if (tk === R.token && sc < 1) return renderAll(1, first); return true; }
  // one camera for every tile: a drag in any tile turns them all
  let drag = null, wheelT = 0;
  for (const [i, c] of cvs.entries()) {
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); drag = { i, x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey }; R.token++; });
    c.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; const b = box();
      o.move(drag.pan ? { pan: [dx / b.h, dy / b.h] } : { orbit: [dx * 0.008, dy * 0.008] }); if (!drag.raf) drag.raf = requestAnimationFrame(() => { if (drag) { drag.raf = 0; put(drag.i, shot(drag.i, 0.6)); } }); });
    c.addEventListener('pointerup', () => { if (!drag) return; const i0 = drag.i; drag = null; renderAll(0.5, i0); });
    c.addEventListener('wheel', (e) => { e.preventDefault(); o.move({ zoom: Math.pow(1.0015, e.deltaY) }); put(i, shot(i, 0.6)); clearTimeout(wheelT); wheelT = setTimeout(() => renderAll(0.5, i), 180); }, { passive: false });
  }
  const close = () => { R.token++; back.remove(); removeEventListener('keydown', onKey, true); removeEventListener('resize', onResize); o.onClose?.(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  let rsT = 0; const onResize = () => { clearTimeout(rsT); rsT = setTimeout(() => renderAll(1), 200); };
  addEventListener('keydown', onKey, true); addEventListener('resize', onResize);

  // ---- export: every picture re-rendered at print size from the chosen view (1200 px wide), then laid out
  async function printFrames(px = 1200) { const b = box(), sc = px / (b.w * (devicePixelRatio || 1)), out = []; R.token++;
    for (let i = 0; i < n; i++) { status.textContent = `Rendering ${i + 1} of ${n} at print size…`; out.push(shot(i, sc)); await raf(); } status.textContent = ''; return out; }
  function sheet(frames) {
    const fw = frames[0].width, fh = frames[0].height, gap = Math.round(fw * 0.035), pad = Math.round(fw * 0.09), fs = Math.round(fw * 0.028), head = fs * 5.2, foot = fs * 9;
    const W = pad * 2 + cols * fw + (cols - 1) * gap, H = pad * 2 + head + rows * (fh + fs * 1.9) + (rows - 1) * gap + foot, c = document.createElement('canvas'); c.width = W; c.height = Math.round(H); const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, c.height); g.fillStyle = '#111827'; g.textBaseline = 'alphabetic';
    g.font = `700 ${fs * 1.75}px Inter, system-ui, sans-serif`; g.fillText(N.head, pad, pad + fs * 1.75);
    g.font = `400 ${fs}px Inter, system-ui, sans-serif`; g.fillStyle = '#374151'; g.fillText(N.sub, pad, pad + fs * 3.3); g.fillText(N.where, pad, pad + fs * 4.6);
    g.textAlign = 'right'; g.fillText(N.made, W - pad, pad + fs * 1.75); g.textAlign = 'left';
    frames.forEach((f, i) => { const x = pad + (i % cols) * (fw + gap), y = pad + head + Math.floor(i / cols) * (fh + fs * 1.9 + gap);
      g.font = `600 ${fs}px Inter, system-ui, sans-serif`; g.fillStyle = '#111827'; g.fillText(o.frames[i].label, x, y + fs); g.drawImage(f, x, y + fs * 1.6); g.strokeStyle = '#e5e7eb'; g.lineWidth = Math.max(1, fs / 14); g.strokeRect(x, y + fs * 1.6, fw, fh); });
    const ly = c.height - pad - foot + fs * 1.2; drawLegend(g, pad, ly, Math.min(W * 0.36, fw * 1.6), fs * 0.9, m, fs * 0.9);
    g.font = `400 ${fs * 0.9}px Inter, system-ui, sans-serif`; g.fillStyle = '#374151'; const tx = pad + Math.min(W * 0.36, fw * 1.6) + fs * 5;
    const wrap = (t, mw) => { const out = [], words = t.split(' '); let line = ''; for (const w of words) { const s2 = line ? line + ' ' + w : w; if (g.measureText(s2).width > mw && line) { out.push(line); line = w; } else line = s2; } if (line) out.push(line); return out; };
    let k = 0; for (const t of [N.scale + '.', N.basis + '.', m.method ? 'Method: ' + m.method : ''].filter(Boolean)) for (const ln of wrap(t, W - tx - pad)) g.fillText(ln, tx, ly + fs * 0.9 + (k++) * fs * 1.3);
    return c; }
  const save = (name, blob) => { const a = document.createElement('a'), u = URL.createObjectURL(blob); a.href = u; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); };
  const toBlob = (c) => new Promise((r) => c.toBlob(r, 'image/png'));
  const base = () => `${slug(m.project)}-${slug(m.study)}-${n === 12 ? '12-months' : n === 4 ? '4-seasons' : n}`;
  const busy = async (fn) => { if (R.busy) return; R.busy = true; back.querySelectorAll('[data-sx]').forEach((b) => { if (b.dataset.sx !== 'close') b.disabled = true; });
    try { await fn(); } catch (e) { status.textContent = 'The export could not finish: ' + (e.message || e); } finally { R.busy = false; back.querySelectorAll('[data-sx]').forEach((b) => (b.disabled = false)); renderAll(1); } };
  back.addEventListener('click', (e) => { const b = e.target.closest('[data-sx]'); if (!b) { if (e.target === back) close(); return; } const k = b.dataset.sx;
    if (k === 'close') close();
    else if (k === 'png') busy(async () => { const fr = await printFrames(); save(base() + '.png', await toBlob(sheet(fr))); status.textContent = 'Sheet saved.'; });
    else if (k === 'zip') busy(async () => { const fr = await printFrames(), files = [];
      for (const [i, f] of fr.entries()) files.push({ name: `${String(i + 1).padStart(2, '0')}-${slug(o.frames[i].label)}.png`, data: new Uint8Array(await (await toBlob(f)).arrayBuffer()) });
      files.push({ name: 'sheet.png', data: new Uint8Array(await (await toBlob(sheet(fr))).arrayBuffer()) });
      files.push({ name: 'series.json', data: JSON.stringify({ study: m.study, series: N.head, basis: m.basis, what: m.what, pictures: o.frames.map((f) => f.label), colourScale: { from: m.lo, to: m.hi, unit: m.unit }, quality: m.quality, grid: m.grid, model: m.version, conditionsRevision: m.revision, weather: m.station || null, site: { name: m.site, lat: m.lat, lon: m.lon }, method: m.method, generated: m.at.toISOString() }, null, 2) });
      save(base() + '.zip', new Blob([zip(files)], { type: 'application/zip' })); status.textContent = 'ZIP saved.'; });
    else if (k === 'pdf') busy(async () => { const fr = await printFrames(); status.textContent = 'Laying out the PDF…'; save(base() + '.pdf', await pdf(fr)); status.textContent = 'PDF saved.'; }); });

  // A3 landscape, millimetres: title block, the pictures in the grid with their captions, the legend drawn as bands, the notes
  async function pdf(frames) {
    const { PDF, font } = await pdfDeps(), d = new PDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true }); d.addFileToVFS('DejaVuSans.ttf', font); d.addFont('DejaVuSans.ttf', 'DejaVu', 'normal'); d.setFont('DejaVu');
    d.setProperties({ title: `${N.head} · ${m.project}`, subject: N.sub, creator: 'PlotCloud', keywords: `${m.study}, ${m.quality}` });
    const W = 420, H = 297, mg = 14, gap = 4, bottom = 30, ar = frames[0].height / frames[0].width, cw = (W - 2 * mg - (cols - 1) * gap) / cols, chMax = (H - 34 - bottom - mg - (rows - 1) * gap) / rows - 6, fw = Math.min(cw, chMax / ar), fh = fw * ar, x0 = (W - (cols * fw + (cols - 1) * gap)) / 2, block = rows * (fh + 6) + (rows - 1) * gap + 30, top = Math.max(34, 34 + (H - mg - 34 - block) / 2);   // the pictures, legend and notes centred on the page under the title
    d.setTextColor(17, 24, 39); d.setFontSize(18); d.text(N.head, mg, mg + 6); d.setFontSize(9); d.setTextColor(55, 65, 81); d.text(N.sub, mg, mg + 12.5); d.text(N.where, mg, mg + 17.5); d.text(N.made, W - mg, mg + 6, { align: 'right' });
    d.setDrawColor(209, 213, 219); d.setLineWidth(0.2); d.line(mg, mg + 21, W - mg, mg + 21);
    frames.forEach((f, i) => { const x = x0 + (i % cols) * (fw + gap), y = top + Math.floor(i / cols) * (fh + 6 + gap); d.setFontSize(8.5); d.setTextColor(17, 24, 39); d.text(o.frames[i].label, x, y + 3.6);
      d.addImage(f.toDataURL('image/jpeg', 0.93), 'JPEG', x, y + 5, fw, fh, undefined, 'FAST'); d.setDrawColor(229, 231, 235); d.rect(x, y + 5, fw, fh); });
    // the legend: bands of the ramp, ticks and values (all text and vector)
    const gridBottom = top + rows * (fh + 6) + (rows - 1) * gap, ly = Math.min(H - bottom + 4, gridBottom + 9), lw = 110, lh = 4,   // the legend and notes right under the pictures
    st = legendStops(m), hex = (c) => { const x = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(c); return x ? x.slice(1).map((v) => parseInt(v, 16)) : (/rgb\((\d+),\s*(\d+),\s*(\d+)/.exec(c) || [0, 128, 128, 128]).slice(1).map(Number); };
    const at = (t) => { const s = t * (st.length - 1), k = Math.min(st.length - 2, Math.floor(s)), u = s - k, a = hex(st[Math.max(0, k)]), b = hex(st[Math.min(st.length - 1, k + 1)]); return a.map((v, j) => Math.round(v + (b[j] - v) * u)); };
    for (let k = 0; k < 120; k++) { const c = st.length > 1 ? at(k / 119) : hex(st[0]); d.setFillColor(...c); d.rect(mg + lw * k / 120, ly, lw / 120 + 0.05, lh, 'F'); }
    d.setDrawColor(107, 114, 128); d.rect(mg, ly, lw, lh); d.setFontSize(7.5); d.setTextColor(17, 24, 39);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) { const x = mg + lw * t; d.line(x, ly + lh, x, ly + lh + 1.2); d.text(num(m.lo + (m.hi - m.lo) * t, m.dec), x, ly + lh + 4.4, { align: t === 0 ? 'left' : t === 1 ? 'right' : 'center' }); }
    d.text(m.unit, mg + lw + 3, ly + lh - 0.6); d.setFontSize(7.5); d.setTextColor(55, 65, 81);
    const notes = [N.scale + '.', N.basis + '.', m.method ? 'Method: ' + m.method : ''].filter(Boolean), tx = mg + lw + 22; let ty = ly + 1.5;
    for (const t of notes) { const lines = d.splitTextToSize(t, W - tx - mg); d.text(lines, tx, ty); ty += lines.length * 3.3 + 0.8; }
    return d.output('blob'); }

  requestAnimationFrame(() => renderAll(1));
  return { close, renderAll, _state: () => ({ n, cols, rows, drawn: cvs.filter((c) => c.width > 0).length, tile: box() }) };
}

let deps = null;
function pdfDeps() { if (!deps) deps = (async () => { await import('../vendor/jspdf-4.2.1.umd.min.js'); const r = await fetch(new URL('../vendor/DejaVuSans.ttf', import.meta.url)); if (!r.ok) throw Error('The PDF font could not load. Please retry.');
  const bytes = new Uint8Array(await r.arrayBuffer()); let bin = ''; for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768)); return { PDF: globalThis.jspdf.jsPDF, font: btoa(bin) }; })().catch((e) => { deps = null; throw e; }); return deps; }
