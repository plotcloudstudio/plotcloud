// The export list (2026-11-09): what a project's report will hold, collected from the studies (a view, a series of 12 months or
// 4 seasons, a section), kept per project in this browser (IndexedDB), then exported together: a report (PDF, A3 landscape:
// cover with contents, one page per item with its pictures, legend, key results, method and basis, and a closing page on the
// basis and limits), editable slides (PPTX), or every picture (ZIP). Every item records what it was computed from, and the list
// marks an item whose model has changed since.
//   item: { id, kind: 'view' | 'series' | 'section', study, title, sub, pictures: [{ label, blob }], cols,
//           legend: { lo, hi, unit, dec, stops } | null, rows: [[label, value]], method, basis, notes: [..], modelKey, at (ISO) }
import { zip } from './zip-store.js';
import { buildPptx } from './pptx.js';

const DB = 'plotcloud-export-list', STORE = 'lists';
const idb = () => new Promise((res, rej) => { const q = indexedDB.open(DB, 1); q.onupgradeneeded = () => q.result.createObjectStore(STORE); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
async function tx(mode, fn) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction(STORE, mode), s = t.objectStore(STORE), r = fn(s); t.oncomplete = () => { d.close(); res(r && 'result' in r ? r.result : undefined); }; t.onerror = () => { d.close(); rej(t.error); }; }); }
const MEM = new Map();   // when IndexedDB is not available (a private window), the list lives while the page is open
export async function loadList(pid) { try { return (await tx('readonly', (s) => s.get(pid))) || { title: '', items: [] }; } catch { return MEM.get(pid) || { title: '', items: [] }; } }
export async function saveList(pid, list) { MEM.set(pid, list); try { await tx('readwrite', (s) => s.put(list, pid)); return true; } catch { return false; } }

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const plain = (v) => String(v ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const num = (v, d = 1) => Number(v || 0).toLocaleString('en', { maximumFractionDigits: d, minimumFractionDigits: d });
const local = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const day = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const slug = (s) => String(s || 'plotcloud').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
const KIND = { view: 'View', series: 'Series', section: 'Section' };
const bytes = async (b) => new Uint8Array(await b.arrayBuffer());
const dataURL = (b) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
const imgOf = (b) => new Promise((res, rej) => { const u = URL.createObjectURL(b), i = new Image(); i.onload = () => { res(i); setTimeout(() => URL.revokeObjectURL(u), 1000); }; i.onerror = rej; i.src = u; });
export const canvasBlob = (c, type = 'image/jpeg', q = 0.92) => new Promise((r) => c.toBlob(r, type, q));

// the panel in the Workspace's popover: the items in order, each with its status; the report's title; the exports
export function renderList(host, list, { project, modelKey, onChange, onExport, busy }) {
  const items = list.items, stale = (it) => it.modelKey && modelKey && it.modelKey !== modelKey;
  for (const u of host.__urls || []) URL.revokeObjectURL(u); host.__urls = [];
  const thumb = (it) => { const b = it.pictures[0]?.blob; if (!b) return ''; const u = URL.createObjectURL(b); host.__urls.push(u); return `<img src="${u}" alt="">`; };
  host.innerHTML = `<h3>Export list</h3>${items.length ? `<label class="sp-field">Report title<input class="sp-in" data-xl="title" value="${esc(list.title || `${project} · environmental studies`)}" maxlength="120"></label>
    <ol class="xl-items">${items.map((it, i) => `<li class="xl-it${stale(it) ? ' stale' : ''}"><span class="xl-th">${thumb(it)}${it.pictures.length > 1 ? `<i>${it.pictures.length}</i>` : ''}</span><span class="xl-tx"><b>${esc(it.title)}</b><small>${esc(KIND[it.kind])} · ${esc(it.sub || '')}</small>${stale(it) ? '<small class="sp-warn">The model has changed since: add it again to update it.</small>' : ''}</span>
      <span class="xl-bt"><button type="button" data-xl="up" data-i="${i}" ${i ? '' : 'disabled'} aria-label="Move up" title="Move up">↑</button><button type="button" data-xl="down" data-i="${i}" ${i < items.length - 1 ? '' : 'disabled'} aria-label="Move down" title="Move down">↓</button><button type="button" data-xl="del" data-i="${i}" aria-label="Remove ${esc(it.title)}" title="Remove">×</button></span></li>`).join('')}</ol>
    <div class="xl-acts"><button type="button" class="btn sm primary" data-xl="pdf" ${busy ? 'disabled' : ''}>Report (PDF)</button><button type="button" class="btn sm" data-xl="pptx" ${busy ? 'disabled' : ''}>Slides (PPTX)</button><button type="button" class="btn sm" data-xl="zip" ${busy ? 'disabled' : ''}>Pictures (ZIP)</button></div>
    <p class="sp-note xl-status" aria-live="polite">${busy ? esc(busy) : `${items.length} item${items.length === 1 ? '' : 's'}, ${items.reduce((a, it) => a + it.pictures.length, 0)} pictures. Each page states what it was computed from.`}</p>`
    : '<p class="sp-note" style="margin-top:0">Nothing yet. Add a view or a series from a study’s Export area (⤓), or a section from the Section card; then export them together as a report, slides or pictures.</p>'}`;
  host.onclick = async (e) => { const b = e.target.closest('[data-xl]'); if (!b || b.tagName === 'INPUT') return; const k = b.dataset.xl, i = +b.dataset.i;
    if (k === 'up' && i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; onChange(); }
    else if (k === 'down' && i < items.length - 1) { [items[i + 1], items[i]] = [items[i], items[i + 1]]; onChange(); }
    else if (k === 'del') { items.splice(i, 1); onChange(); }
    else if (['pdf', 'pptx', 'zip'].includes(k)) onExport(k); };
  const t = host.querySelector('[data-xl=title]'); if (t) t.onchange = () => { list.title = t.value.trim(); onChange(false); };
}

// ---- the report
const LIMITS = 'Results are computed in PlotCloud from the model, the inputs and the settings stated on each page. They are screenings for design decisions: not a certification, a code-compliance assessment or an engineering sign-off. A result applies to the model version and the conditions it states; when either changes, run it again.';
function legendCanvas(L, w = 900, h = 150) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); const bw = w - 40, gr = g.createLinearGradient(20, 0, 20 + bw, 0); L.stops.forEach((s, i) => gr.addColorStop(L.stops.length === 1 ? 0 : i / (L.stops.length - 1), s)); g.fillStyle = gr; g.fillRect(20, 20, bw, 34); g.strokeStyle = '#6b7280'; g.strokeRect(20, 20, bw, 34);
  g.fillStyle = '#111827'; g.font = '500 26px Inter, Arial, sans-serif'; g.textBaseline = 'top'; [0, 0.5, 1].forEach((t) => { g.textAlign = t === 0 ? 'left' : t === 1 ? 'right' : 'center'; g.fillText(num(L.lo + (L.hi - L.lo) * t, L.dec), 20 + bw * t, 64); }); g.textAlign = 'left'; g.fillStyle = '#374151'; g.fillText(L.unit, 20, 106); return c; }   // the unit on its own line: long units fit

export async function exportList(kind, list, ctx) {
  const items = list.items, title = list.title || `${ctx.project} · environmental studies`, base = `${slug(ctx.project)}-report-${day(Date.now())}`;
  if (kind === 'zip') { const files = []; for (const [n, it] of items.entries()) for (const [k, p] of it.pictures.entries()) files.push({ name: `${String(n + 1).padStart(2, '0')}-${slug(it.title)}/${String(k + 1).padStart(2, '0')}-${slug(p.label || it.title)}.jpg`, data: await bytes(p.blob) });
    files.push({ name: 'report.json', data: JSON.stringify({ title, project: ctx.project, site: ctx.site, generated: new Date().toISOString(), items: items.map((it) => ({ kind: it.kind, study: it.study, title: it.title, sub: it.sub, pictures: it.pictures.map((p) => p.label), legend: it.legend && { from: it.legend.lo, to: it.legend.hi, unit: it.legend.unit }, results: it.rows, method: it.method, basis: it.basis, computed: it.at })), limits: LIMITS }, null, 2) });
    return { name: base + '.zip', blob: new Blob([zip(files)], { type: 'application/zip' }) }; }
  if (kind === 'pptx') return { name: base + '.pptx', blob: new Blob([await pptx(items, title, ctx)], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }) };
  return { name: base + '.pdf', blob: await pdf(items, title, ctx) };
}

async function pdf(items, title, ctx) {
  const { PDF, font } = await pdfDeps(), d = new PDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true }); d.addFileToVFS('DejaVuSans.ttf', font); d.addFont('DejaVuSans.ttf', 'DejaVu', 'normal'); d.setFont('DejaVu');
  d.setProperties({ title, subject: `${ctx.project} · ${ctx.site || ''}`, author: ctx.author || '', creator: 'PlotCloud' });
  const W = 420, H = 297, mg = 16, ink = [17, 24, 39], sub = [75, 85, 99], line = [209, 213, 219], N = items.length + 2, made = `Generated ${day(Date.now())} with PlotCloud`;
  const foot = (n) => { d.setDrawColor(...line); d.setLineWidth(0.2); d.line(mg, H - 12, W - mg, H - 12); d.setFontSize(8); d.setTextColor(...sub); d.text(`${ctx.project} · ${title}`, mg, H - 7.5); d.text(`${n} / ${N}`, W - mg, H - 7.5, { align: 'right' }); };
  const wrap = (t, w, size, x, y, col = sub, lh = 0.42) => { d.setFontSize(size); d.setTextColor(...col); const ls = d.splitTextToSize(t, w); d.text(ls, x, y); return y + ls.length * size * lh; };
  // cover
  const CW = 168;   // the cover: title, project and contents on the left, the first picture on the right
  d.setFillColor(17, 24, 39); d.rect(0, 0, W, 8, 'F'); d.setTextColor(...ink); d.setFontSize(28); const tl = d.splitTextToSize(title, CW); d.text(tl, mg, 46);
  let y = wrap([ctx.project, ctx.site, ctx.coords].filter(Boolean).join(' · '), CW, 12.5, mg, 46 + tl.length * 11 + 4, sub, 0.45);
  y = wrap(`${made}${ctx.author ? ' · prepared by ' + ctx.author : ''} · model ${ctx.version}`, CW, 9.5, mg, y + 2, sub);
  d.setDrawColor(...line); d.line(mg, y + 6, mg + CW, y + 6); d.setTextColor(...ink); d.setFontSize(12); d.text('Contents', mg, y + 16); y += 25;
  const toc = (n, t, s2, pg) => { d.setFontSize(10.5); d.setTextColor(...ink); const tt = d.splitTextToSize(`${n}.  ${t}`, CW - 14); d.text(tt, mg, y); d.setTextColor(...sub); d.text(String(pg), mg + CW, y, { align: 'right' }); y += tt.length * 4.6; if (s2) { d.setFontSize(8.5); d.text(d.splitTextToSize(s2, CW - 14), mg + 6, y); y += 4.2; } y += 2.6; };
  items.forEach((it, i) => toc(i + 1, it.title, `${KIND[it.kind]} · ${it.sub || ''}`, i + 2)); toc(items.length + 1, 'Basis and limits', '', N);
  if (items[0]?.pictures[0]) { const b0 = items[0].pictures[0].blob, im = await imgOf(b0), x0 = mg + CW + 14, ww = W - mg - x0, hh = Math.min(H - 60, ww * im.height / im.width), w2 = hh * im.width / im.height;
    d.addImage(await dataURL(b0), 'JPEG', x0 + (ww - w2) / 2, 30, w2, hh, undefined, 'FAST'); d.setFontSize(8); d.setTextColor(...sub); d.text(`${items[0].title}${items[0].pictures.length > 1 ? ' · ' + (items[0].pictures[0].label || '') : ''}`, x0 + (ww - w2) / 2, 30 + hh + 5); }
  foot(1);
  // one page per item: pictures left (a grid for a series), the key results, legend, method and basis on the right
  for (const [i, it] of items.entries()) { d.addPage('a3', 'landscape'); d.setFont('DejaVu');
    d.setFillColor(17, 24, 39); d.rect(0, 0, W, 4, 'F'); d.setTextColor(...ink); d.setFontSize(18); d.text(`${i + 1}. ${it.title}`, mg, 20); d.setFontSize(10); d.setTextColor(...sub); d.text(`${KIND[it.kind]} · ${it.sub || ''}`, mg, 27);
    const infoH = 72, gx = mg, gw = W - 2 * mg, gy = 33, gh = H - gy - 20 - infoH - 4, P = it.pictures, cols = it.cols || (P.length === 12 ? 4 : P.length === 4 ? 2 : Math.ceil(Math.sqrt(P.length))), rows = Math.ceil(P.length / cols);
    const im0 = await imgOf(P[0].blob), ar = im0.height / im0.width, gap = 3.5, cap = P.length > 1 ? 5 : 0, fw = Math.min((gw - (cols - 1) * gap) / cols, ((gh - (rows - 1) * gap) / rows - cap) / ar), fh = fw * ar, x0 = gx + (gw - (cols * fw + (cols - 1) * gap)) / 2;
    for (const [k, p] of P.entries()) { const x = x0 + (k % cols) * (fw + gap), yy = gy + Math.floor(k / cols) * (fh + cap + gap); if (cap) { d.setFontSize(8.5); d.setTextColor(...ink); d.text(p.label || '', x, yy + 3.6); }
      d.addImage(await dataURL(p.blob), 'JPEG', x, yy + cap, fw, fh, undefined, 'FAST'); d.setDrawColor(229, 231, 235); d.rect(x, yy + cap, fw, fh); }
    // under the pictures: legend and key results | method | basis and notes
    const iy = H - 20 - infoH, c1 = 128, c2 = 150, cx2 = mg + c1 + 10, cx3 = cx2 + c2 + 10, c3 = W - mg - cx3; d.setDrawColor(...line); d.line(mg, iy - 3, W - mg, iy - 3);
    let sy = iy + 2; const sx = mg, side = c1;
    if (it.legend) { const L = it.legend, lw = side - 26, lh = 4, st = L.stops, hex = (c) => { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(c); return m ? m.slice(1).map((v) => parseInt(v, 16)) : (/rgb\((\d+),\s*(\d+),\s*(\d+)/.exec(c) || [0, 128, 128, 128]).slice(1).map(Number); };
      const at = (t) => { const s2 = t * (st.length - 1), k = Math.min(st.length - 2, Math.floor(s2)), u = s2 - k, a = hex(st[Math.max(0, k)]), b = hex(st[Math.min(st.length - 1, k + 1)]); return a.map((v, j) => Math.round(v + (b[j] - v) * u)); };
      d.setFontSize(9); d.setTextColor(...ink); d.text('Legend', sx, sy + 3); sy += 6; for (let k = 0; k < 90; k++) { d.setFillColor(...(st.length > 1 ? at(k / 89) : hex(st[0]))); d.rect(sx + lw * k / 90, sy, lw / 90 + 0.05, lh, 'F'); }
      d.setDrawColor(107, 114, 128); d.rect(sx, sy, lw, lh); d.setFontSize(7.5); for (const t of [0, 0.5, 1]) d.text(num(L.lo + (L.hi - L.lo) * t, L.dec), sx + lw * t, sy + lh + 3.6, { align: t === 0 ? 'left' : t === 1 ? 'right' : 'center' }); d.text(d.splitTextToSize(L.unit, 24), sx + lw + 2, sy + lh - 0.5); sy += lh + 9; }
    if (it.rows && it.rows.length) { d.setFontSize(9); d.setTextColor(...ink); d.text('Key results', sx, sy + 3); sy += 5.5; d.setFontSize(7.6);
      for (const [k, v] of it.rows.slice(0, 14)) { if (sy > H - 24) break; const kl = d.splitTextToSize(plain(k), side * 0.5), vl = d.splitTextToSize(plain(v), side * 0.48), h = Math.max(kl.length, vl.length) * 3.2 + 1.4; d.setTextColor(...sub); d.text(kl, sx, sy + 2.8); d.setTextColor(...ink); d.text(vl, sx + side, sy + 2.8, { align: 'right' }); d.setDrawColor(238, 240, 243); d.line(sx, sy + h, sx + side, sy + h); sy += h; } }
    let my = iy + 2; if (it.method) { d.setFontSize(9); d.setTextColor(...ink); d.text('Method', cx2, my + 3); my = wrap(it.method, c2, 7.8, cx2, my + 8, sub) + 3; }
    let by = iy + 2; d.setFontSize(9); d.setTextColor(...ink); d.text('Basis', cx3, by + 3); by = wrap(`${it.basis || ''} · computed ${local(it.at)}`, c3, 7.8, cx3, by + 8, sub) + 3;
    for (const n2 of it.notes || []) by = wrap(n2, c3, 7.8, cx3, by + 1, sub) + 1;
    foot(i + 2); }
  // basis and limits
  d.addPage('a3', 'landscape'); d.setFont('DejaVu'); d.setFillColor(17, 24, 39); d.rect(0, 0, W, 4, 'F'); d.setTextColor(...ink); d.setFontSize(18); d.text(`${items.length + 1}. Basis and limits`, mg, 20);
  y = wrap(LIMITS, W - 2 * mg, 10.5, mg, 32, ink, 0.45) + 6; d.setFontSize(11); d.setTextColor(...ink); d.text('Each item', mg, y); y += 7;
  for (const [i, it] of items.entries()) { d.setFontSize(9.5); d.setTextColor(...ink); d.text(`${i + 1}. ${it.title}`, mg, y); y = wrap(`${it.basis || ''} · computed ${local(it.at)}`, W - 2 * mg - 10, 8.5, mg + 6, y + 5, sub) + 3; if (y > H - 30) { foot(N); d.addPage('a3', 'landscape'); d.setFont('DejaVu'); y = 24; } }
  y = wrap(`Site and weather: ${[ctx.site, ctx.coords, ctx.weather].filter(Boolean).join(' · ')}. Project conditions revision ${ctx.revision ?? '–'}.`, W - 2 * mg, 9, mg, y + 4, sub);
  foot(N);
  return d.output('blob');
}

async function pptx(items, title, ctx) {
  const W = 13.333, H = 7.5, slides = [{ title, blocks: [{ type: 'text', x: 0.5, y: 1.3, w: W - 1, h: 1.6, paragraphs: [{ text: [ctx.project, ctx.site, ctx.coords].filter(Boolean).join(' · '), size: 18 }, { text: `Generated ${day(Date.now())} with PlotCloud · model ${ctx.version}`, size: 12, color: '6B7385' }] },
    { type: 'text', x: 0.5, y: 3.1, w: 6.2, h: 3.6, paragraphs: items.map((it, i) => ({ text: `${i + 1}. ${it.title} — ${KIND[it.kind]} · ${it.sub || ''}`, size: 12, bullet: false })) }] }];
  if (items[0]?.pictures[0]) { const im = await imgOf(items[0].pictures[0].blob), w = 5.9, h = Math.min(4.6, w * im.height / im.width); slides[0].blocks.push({ type: 'image', x: W - 0.5 - h * im.width / im.height, y: 2.6, w: h * im.width / im.height, h, jpeg: await bytes(items[0].pictures[0].blob), alt: items[0].title, name: 'Cover picture' }); }
  for (const [i, it] of items.entries()) { const P = it.pictures, cols = it.cols || (P.length === 12 ? 4 : P.length === 4 ? 2 : Math.ceil(Math.sqrt(P.length))), rows = Math.ceil(P.length / cols), im0 = await imgOf(P[0].blob), ar = im0.height / im0.width;
    const gx = 0.5, gy = 1.2, gw = 8.6, gh = H - gy - 0.7, gap = 0.08, cap = P.length > 1 ? 0.22 : 0, fw = Math.min((gw - (cols - 1) * gap) / cols, ((gh - (rows - 1) * gap) / rows - cap) / ar), fh = fw * ar, blocks = [];
    for (const [k, p] of P.entries()) { const x = gx + (k % cols) * (fw + gap), y = gy + Math.floor(k / cols) * (fh + cap + gap); if (cap) blocks.push({ type: 'text', x, y: y - 0.04, w: fw, h: cap, paragraphs: [{ text: p.label || '', size: 9, bold: true }] }); blocks.push({ type: 'image', x, y: y + cap, w: fw, h: fh, jpeg: await bytes(p.blob), alt: `${it.title} · ${p.label || ''}`, name: p.label || it.title }); }
    let sy = 1.25; const sx = 9.35, sw = W - sx - 0.45;
    blocks.push({ type: 'text', x: sx, y: 0.95, w: sw, h: 0.35, paragraphs: [{ text: `${KIND[it.kind]} · ${it.sub || ''}`, size: 10, color: '4B5563' }] });
    if (it.legend) { const c = legendCanvas(it.legend), png = await bytes(await canvasBlob(c, 'image/png')); blocks.push({ type: 'image', x: sx, y: sy + 0.1, w: sw, h: sw * c.height / c.width, png, alt: 'Legend', name: 'Legend' }); sy += sw * c.height / c.width + 0.25; }
    if (it.rows && it.rows.length) { const r = it.rows.slice(0, 9).map(([k, v]) => [plain(k), plain(v)]); blocks.push({ type: 'table', x: sx, y: sy, w: sw, h: Math.min(3, r.length * 0.32 + 0.32), size: 9, rows: [['Key result', 'Value'], ...r] }); sy += Math.min(3, (r.length + 1) * 0.32) + 0.2; }
    blocks.push({ type: 'text', x: sx, y: sy, w: sw, h: Math.max(0.6, H - sy - 0.6), paragraphs: [{ text: it.method ? 'Method: ' + it.method : '', size: 8, color: '4B5563' }, { text: `Basis: ${it.basis || ''} · computed ${local(it.at)}`, size: 8, color: '4B5563' }] });
    slides.push({ title: `${i + 1}. ${it.title}`, blocks }); }
  slides.push({ title: `${items.length + 1}. Basis and limits`, blocks: [{ type: 'text', x: 0.5, y: 1.3, w: W - 1, h: H - 2, paragraphs: [{ text: LIMITS, size: 13 }, ...items.map((it, i) => ({ text: `${i + 1}. ${it.title}: ${it.basis || ''}`, size: 10, color: '4B5563' })), { text: `Site and weather: ${[ctx.site, ctx.coords, ctx.weather].filter(Boolean).join(' · ')}`, size: 10, color: '4B5563' }] }] });
  return buildPptx({ title, author: ctx.author || 'PlotCloud', footer: `${ctx.project} · ${title}`, slides });
}

let deps = null;
function pdfDeps() { if (!deps) deps = (async () => { await import('../vendor/jspdf-4.2.1.umd.min.js'); const r = await fetch(new URL('../vendor/DejaVuSans.ttf', import.meta.url)); if (!r.ok) throw Error('The report font could not load. Please retry.');
  const b = new Uint8Array(await r.arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode(...b.subarray(i, i + 32768)); return { PDF: globalThis.jspdf.jsPDF, font: btoa(s) }; })().catch((e) => { deps = null; throw e; }); return deps; }
