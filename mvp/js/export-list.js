// The export list (2026-11-09): what a project's report will hold, collected from the studies (a view, a series of 12 months or
// 4 seasons, a section), kept per project in this browser (IndexedDB), then exported together: a report (PDF, US Letter portrait:
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
  host.innerHTML = `<h3>Export list</h3>${items.length ? `<label class="sp-field">Report title<input class="sp-in" data-xl="title" value="${esc(list.title || 'Building Performance Simulation Report')}" maxlength="120"></label>
    <ol class="xl-items">${items.map((it, i) => `<li class="xl-it${stale(it) ? ' stale' : ''}"><span class="xl-th">${thumb(it)}${it.pictures.length > 1 ? `<i>${it.pictures.length}</i>` : ''}</span><span class="xl-tx"><b>${esc(it.title)}</b><small>${esc(KIND[it.kind])} · ${esc(it.sub || '')}</small>${stale(it) ? '<small class="sp-warn">The model has changed since: add it again to update it.</small>' : ''}</span>
      <span class="xl-bt"><button type="button" data-xl="up" data-i="${i}" ${i ? '' : 'disabled'} aria-label="Move up" title="Move up">↑</button><button type="button" data-xl="down" data-i="${i}" ${i < items.length - 1 ? '' : 'disabled'} aria-label="Move down" title="Move down">↓</button><button type="button" data-xl="del" data-i="${i}" aria-label="Remove ${esc(it.title)}" title="Remove">×</button></span></li>`).join('')}</ol>
    <div class="xl-acts"><button type="button" class="btn sm primary" data-xl="pdf" ${busy ? 'disabled' : ''}>Report (PDF)</button><button type="button" class="btn sm" data-xl="pptx" ${busy ? 'disabled' : ''}>Slides (PPTX)</button><button type="button" class="btn sm" data-xl="zip" ${busy ? 'disabled' : ''}>Pictures (ZIP)</button></div>
    <p class="sp-note xl-status" aria-live="polite">${busy ? esc(busy) : `${items.length} item${items.length === 1 ? '' : 's'}, ${items.reduce((a, it) => a + it.pictures.length, 0)} pictures. Each page states what it was computed from.`}</p>`
    : '<p class="sp-note" style="margin-top:0">Nothing yet. Tick the simulations above and Generate pictures; they come here, ready to export together as a report, slides or pictures.</p>'}`;
  host.onclick = async (e) => { const b = e.target.closest('[data-xl]'); if (!b || b.tagName === 'INPUT') return; const k = b.dataset.xl, i = +b.dataset.i;
    if (k === 'up' && i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; onChange(); }
    else if (k === 'down' && i < items.length - 1) { [items[i + 1], items[i]] = [items[i], items[i + 1]]; onChange(); }
    else if (k === 'del') { items.splice(i, 1); onChange(); }
    else if (['pdf', 'pptx', 'zip'].includes(k)) onExport(k); };
  const t = host.querySelector('[data-xl=title]'); if (t) t.onchange = () => { list.title = t.value.trim(); onChange(false); };
}

// ---- the report
// ---- the report, written as a North American building performance simulation report (2026-11-09): English (US spelling),
// US Letter (8.5 × 11 in) portrait, dates written out; a cover with the project information, a summary of results, one
// chapter per analysis (objective, method, references, inputs and boundary conditions, results, assumptions and limitations,
// numbered figures) and a closing page on the limits. References are those the methods use, and are given as informative.
const LIMITS = 'The analyses in this report were computed in PlotCloud from the model, inputs and settings stated in each chapter. They are design-stage screening analyses intended to inform design decisions. They are not a certification, a code-compliance demonstration, a LEED submission or an engineering sign-off. Each result applies only to the model version and the project conditions it states; when either changes, the analysis should be run again.';
const DOC = {
  sunhours: { name: 'Direct Sunlight Hours', refs: ['Ladybug Tools, ladybug-core Sunpath and LB Direct Sun Hours (method followed: sun path, timestep, 0.1 m test-point offset, 90° cut-off)', 'NOAA Solar Calculator algorithm (solar position, as implemented in Ladybug)'], limit: 'Direct sun only: no diffuse skylight, reflected light or atmospheric attenuation. A screening of sun access, not a shadow study prepared to a municipal terms of reference.' },
  radiation: { name: 'Incident Solar Radiation', refs: ['Project weather file (EPW): direct normal and diffuse horizontal irradiance', 'NOAA Solar Calculator algorithm (solar position)'], limit: 'Ground-reflected radiation is not included; surroundings beyond the modeled context are taken as unobstructed.' },
  skyview: { name: 'Sky View', refs: ['Ladybug Tools, LB View Percent (Sky View) and ladybug-core view_sphere dome patches (method followed: patch resolution, 0.1 m offset, 2·cos weighting)', 'Tregenza, P. R. (1987). Subdivision of the sky hemisphere for luminance measurements. Lighting Research & Technology 19(1)'], limit: 'Geometric sky exposure only; no weather data.' },
  utci: { name: 'Outdoor Thermal Comfort (UTCI)', refs: ['Bröde et al. (2012), Deriving the operational procedure for the Universal Thermal Climate Index (UTCI), International Journal of Biometeorology 56'], limit: 'Wind speed and mean radiant temperature are simplified for screening.' },
  wind: { name: 'Pedestrian-Level Wind', refs: ['Two-dimensional lattice-Boltzmann flow at pedestrian height (speed ratio to the reference wind)'], limit: 'A two-dimensional slice of the flow at pedestrian height: no flow over roofs or down facades. It screens channelling and shelter; it is not a wind tunnel test or a three-dimensional CFD study.' },
  daylight: { name: 'Daylight Performance (sDA300/50% and ASE1000,250)', refs: ['IES LM-83, Approved Method: IES Spatial Daylight Autonomy (sDA) and Annual Sunlight Exposure (ASE)', 'LEED v4.1 BD+C, EQ Credit: Daylight, Option 1 (informative)'], limit: 'A screening of the metrics LEED v4.1 Daylight uses, not a simulation prepared for a LEED submission.' },
  vent: { name: 'Natural Ventilation (Air Change Rate)', refs: ['ASHRAE Handbook—Fundamentals, Chapter 24: Airflow Around Buildings (informative)', 'ANSI/ASHRAE Standard 62.1, Natural Ventilation Procedure (informative)', 'AIVC, Guide to Energy Efficient Ventilation (wind pressure coefficients)', 'de Gids and Phaff (1982), single-sided ventilation'], limit: 'Each room is treated as a fully mixed zone; results are air change rates, not air speeds or temperatures. Not CFD and not a code calculation.' },
  acoustics: { name: 'Room Acoustics (Reverberation Time)', refs: ['DIN 18041:2016, Acoustic quality in rooms (reverberation time targets used)', 'ANSI/ASA S12.60 and LEED v4.1 EQ Credit: Acoustic Performance (informative North American references)'], limit: 'Statistical reverberation (Sabine or Eyring) from room volume and finishes; no ray tracing. STI is estimated from reverberation only.' },
  spacesyntax: { name: 'Spatial Configuration (Visibility Graph Analysis)', refs: ['Turner, Doxa, O’Sullivan and Penn (2001), From isovists to visibility graphs, Environment and Planning B 28'], limit: 'Configurational analysis of the plan; it does not predict occupant numbers.' },
  'fire-evacuation': { name: 'Fire Evacuation (Required Safe Egress Time)', refs: ['SFPE Handbook of Fire Protection Engineering, 5th ed. (2016), Employing the Hydraulic Model in Assessing Emergency Movement (walking speeds, specific flows of doors and stairs)', 'BSI PD 7974-6:2019, Human factors: life safety strategies, occupant evacuation, behaviour and condition (detection, alarm and pre-movement times)', 'IBC 2021 Table 1004.5, Maximum floor area allowances per occupant (occupant load)'], limit: 'A screening of the evacuation time (RSET): no fire or smoke is computed, so there is no available safe egress time (ASET) to compare with, and it is not a code compliance check. Pre-movement times and occupant loads are assumptions stated in the inputs; routes through the room of fire origin stay open and lifts are not used.' },
  section: { name: 'Building Section', refs: [], limit: '' } };
const docOf = (it) => DOC[it.study] || { name: it.title, refs: [], limit: '' };
const usage = (t) => String(t || '').replace(/\bcolour/g, 'color').replace(/\bColour/g, 'Color').replace(/\bcentre/g, 'center').replace(/\bmetres\b/g, 'meters').replace(/\bmetre\b/g, 'meter').replace(/\bmodelled\b/g, 'modeled').replace(/\banalyse/g, 'analyze');
// a method written for a report: no screen language, US spelling
const methodText = (t) => usage(plain(t).replace(/Project props(\s*›\s*\w+)?/g, 'the project settings').split(/(?<=\.)\s+/).filter((x) => !/detailed page|Workspace|this page|click|Start again/i.test(x)).join(' '));
const usDate = (t) => new Date(t).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const usTime = (t) => new Date(t).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
// a chapter's title: the analysis, then what this one shows (a day, a season set, a wind), written once
const cap1 = (v) => (v && /^[a-z]{2}/.test(v) ? v.charAt(0).toUpperCase() + v.slice(1) : v || '');   // "sDA300" stays as written
const variantOf = (it) => { if (it.kind === 'series') return /12 months/.test(it.title) ? (it.study === 'sunhours' ? 'Twelve Months (21st of Each Month)' : 'Monthly') : (it.study === 'sunhours' ? 'Equinoxes and Solstices' : 'Seasonal');
  const parts = String(it.title).split(' · '), last = parts.length > 1 ? parts.at(-1) : ''; return cap1(last.replace(/^[a-z][a-z ]*, (?=[a-z])/, '')); };   // "air changes, wind from E 4.7 m/s" → "Wind from E 4.7 m/s"
const headOf = (it) => { const v = variantOf(it), sec = it.kind === 'section' ? String(it.title).split(' · ')[0] : ''; if (sec) return it.study === 'section' ? `Building ${sec}` : `${sec} — ${docOf(it).name}${v ? ': ' + v : ''}`; return `${docOf(it).name}${v ? ' — ' + v : ''}`; };
const inputsOf = (it) => (it.inputs && it.inputs.length ? it.inputs : [['Basis', it.basis || '']]).concat([['Computed', usTime(it.at)]]);
// the headline: a series by its range across the figures (lowest and highest), any other by its first result
const headline = (it) => { const R = it.rows || [];
  if (it.kind === 'series' && R.length > 1) { const v = R.map(([k, x]) => ({ k: plain(k), n: parseFloat(plain(x)), u: (/^[-\d.,]+\s*(\S+)/.exec(plain(x)) || [])[1] || '' })).filter((q) => Number.isFinite(q.n));
    if (v.length > 1) { const lo = v.reduce((a, q) => (q.n < a.n ? q : a)), hi = v.reduce((a, q) => (q.n > a.n ? q : a)); return `Average ${lo.n}–${hi.n} ${lo.u} across the ${v.length} figures (lowest ${lo.k}, highest ${hi.k})`; } }
  const r = R[0]; return r ? `${plain(r[0])}: ${plain(r[1])}` : '—'; };
function legendCanvas(L, w = 900, h = 150) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); const bw = w - 40, gr = g.createLinearGradient(20, 0, 20 + bw, 0); L.stops.forEach((s, i) => gr.addColorStop(L.stops.length === 1 ? 0 : i / (L.stops.length - 1), s)); g.fillStyle = gr; g.fillRect(20, 20, bw, 34); g.strokeStyle = '#6b7280'; g.strokeRect(20, 20, bw, 34);
  g.fillStyle = '#111827'; g.font = '500 26px Inter, Arial, sans-serif'; g.textBaseline = 'top'; [0, 0.5, 1].forEach((t) => { g.textAlign = t === 0 ? 'left' : t === 1 ? 'right' : 'center'; g.fillText(num(L.lo + (L.hi - L.lo) * t, L.dec), 20 + bw * t, 64); }); g.textAlign = 'left'; g.fillStyle = '#374151'; g.fillText(L.unit, 20, 106); return c; }   // the unit on its own line: long units fit

export async function exportList(kind, list, ctx) {
  const items = list.items, title = list.title || 'Building Performance Simulation Report', base = `${slug(ctx.project)}-simulation-report-${day(Date.now())}`;
  if (kind === 'zip') { const files = []; for (const [n, it] of items.entries()) for (const [k, p] of it.pictures.entries()) files.push({ name: `${String(n + 1).padStart(2, '0')}-${slug(headOf(it))}/figure-${n + 1}-${k + 1}-${slug(p.label || it.title)}.jpg`, data: await bytes(p.blob) });
    files.push({ name: 'report.json', data: JSON.stringify({ title, project: ctx.project, location: ctx.site, coordinates: ctx.coords, climateData: ctx.weather || null, generated: new Date().toISOString(), items: items.map((it, n) => ({ number: n + 1, analysis: headOf(it), kind: it.kind, study: it.study, figures: it.pictures.map((p, k) => `Figure ${n + 1}.${k + 1} ${p.label || ''}`.trim()), legend: it.legend && { from: it.legend.lo, to: it.legend.hi, unit: it.legend.unit }, results: it.rows, objective: it.objective || null, method: methodText(it.method), references: docOf(it).refs, inputs: inputsOf(it), limitations: [docOf(it).limit, ...(it.notes || []).map(usage)].filter(Boolean), computed: it.at })), disclaimer: LIMITS }, null, 2) });
    return { name: base + '.zip', blob: new Blob([zip(files)], { type: 'application/zip' }) }; }
  if (kind === 'pptx') return { name: base + '.pptx', blob: new Blob([await pptx(items, title, ctx)], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }) };
  return { name: base + '.pdf', blob: await pdf(items, title, ctx) };
}

async function pdf(items, title, ctx) {
  const { PDF, font } = await pdfDeps(), d = new PDF({ orientation: 'portrait', unit: 'mm', format: 'letter', compress: true }); d.addFileToVFS('DejaVuSans.ttf', font); d.addFont('DejaVuSans.ttf', 'DejaVu', 'normal'); d.setFont('DejaVu');
  d.setProperties({ title, subject: `${ctx.project}${ctx.site ? ' · ' + ctx.site : ''}`, author: ctx.author || '', creator: 'PlotCloud', keywords: 'building performance simulation, screening analysis' });
  const W = d.internal.pageSize.getWidth(), H = d.internal.pageSize.getHeight(), mg = 16, ink = [17, 24, 39], sub = [75, 85, 99], line = [209, 213, 219], N = items.length + 3, issued = usDate(Date.now());
  const foot = (n) => { d.setDrawColor(...line); d.setLineWidth(0.2); d.line(mg, H - 12, W - mg, H - 12); d.setFontSize(8); d.setTextColor(...sub); d.text(`${ctx.project} · ${title} · Issued ${issued}`, mg, H - 7.5); d.text(`Page ${n} of ${N}`, W - mg, H - 7.5, { align: 'right' }); };
  const wrap = (t, w, size, x, y, col = sub, lh = 0.42) => { d.setFontSize(size); d.setTextColor(...col); const ls = d.splitTextToSize(String(t), w); d.text(ls, x, y); return y + ls.length * size * lh; };
  const head = (t, x, y) => { d.setFontSize(9.5); d.setTextColor(...ink); d.text(t, x, y); d.setDrawColor(...line); d.line(x, y + 1.6, x + 12, y + 1.6); return y + 6; };
  const table = (rows, x, y, w, kw = 0.45, size = 8, maxY = H - 22) => { d.setFontSize(size); for (const [k, v] of rows) { if (y > maxY) break; const kl = d.splitTextToSize(plain(k), w * kw - 2), vl = d.splitTextToSize(plain(v), w * (1 - kw)), h = Math.max(kl.length, vl.length) * size * 0.4 + 1.6; d.setTextColor(...sub); d.text(kl, x, y + size * 0.36); d.setTextColor(...ink); d.text(vl, x + w * kw, y + size * 0.36); d.setDrawColor(238, 240, 243); d.line(x, y + h, x + w, y + h); y += h; } return y; };
  const band = () => { d.setFillColor(17, 24, 39); d.rect(0, 0, W, 4, 'F'); };
  // cover: title, the project information, the first figure
  const CW = W - 2 * mg; d.setFillColor(17, 24, 39); d.rect(0, 0, W, 8, 'F'); d.setFontSize(9); d.setTextColor(...sub); d.text('BUILDING PERFORMANCE SIMULATION · DESIGN-STAGE SCREENING', mg, 26);
  d.setTextColor(...ink); d.setFontSize(24); const tl = d.splitTextToSize(title, CW); d.text(tl, mg, 38); let y = 38 + tl.length * 9.5 + 2;
  if (items[0]?.pictures[0]) { const b0 = items[0].pictures[0].blob, im = await imgOf(b0), hh = Math.min(100, CW * im.height / im.width), w2 = hh * im.width / im.height, x0 = mg + (CW - w2) / 2;
    d.addImage(await dataURL(b0), 'JPEG', x0, y, w2, hh, undefined, 'FAST'); d.setFontSize(8); d.setTextColor(...sub); d.text(`${headOf(items[0])}${items[0].pictures.length > 1 ? ', ' + (items[0].pictures[0].label || '') : ''}`, x0, y + hh + 4.5); y += hh + 10; }
  y = head('Project information', mg, y + 2);
  y = table([['Project', ctx.project], ['Location', ctx.site || '—'], ['Coordinates', ctx.coords || '—'], ['Climate data', ctx.weather || 'Not used by the analyses in this report'], ['Model', ctx.version], ['Project conditions', `Revision ${ctx.revision ?? '—'}`], ['Prepared by', ctx.author || '—'], ['Date of issue', issued], ['Software', 'PlotCloud, web-based building performance screening'], ['Report status', 'Design-stage screening analysis; not a compliance submission']], mg, y, CW, 0.3, 9);
  foot(1);
  // summary of results, with the contents
  d.addPage('letter', 'portrait'); d.setFont('DejaVu'); band(); d.setTextColor(...ink); d.setFontSize(18); d.text('Summary of Results', mg, 20);
  y = wrap('Each analysis below is described in its own chapter: objective, method, references, inputs and boundary conditions, results, and assumptions and limitations.', W - 2 * mg, 9.5, mg, 30, sub) + 4;
  const cx = [mg, mg + 10, mg + 82, W - mg - 26, W - mg - 9], hdr = ['No.', 'Analysis', 'Headline result', 'Figures', 'Page']; d.setFontSize(9); d.setTextColor(...sub); hdr.forEach((t, k) => d.text(t, cx[k], y)); d.setDrawColor(...line); d.line(mg, y + 2, W - mg, y + 2); y += 7;
  items.forEach((it, i) => { d.setFontSize(9.5); const an = d.splitTextToSize(headOf(it), cx[2] - cx[1] - 4), hl = d.splitTextToSize(headline(it), cx[3] - cx[2] - 6), h = Math.max(an.length, hl.length) * 4.2 + 2.4; d.setTextColor(...ink); d.text(String(i + 1), cx[0], y); d.text(an, cx[1], y); d.setTextColor(...sub); d.text(hl, cx[2], y); d.text(String(it.pictures.length), cx[3], y); d.text(String(i + 3), cx[4], y); d.setDrawColor(238, 240, 243); d.line(mg, y + h - 3, W - mg, y + h - 3); y += h; });
  d.setFontSize(9.5); d.setTextColor(...ink); d.text(String(items.length + 1), cx[0], y); d.text('Assumptions, Limitations and Disclaimer', cx[1], y); d.setTextColor(...sub); d.text(String(N), cx[4], y); foot(2);
  // one chapter per analysis: the figures across the page; under them objective and method | references, inputs | results, limitations
  for (const [i, it] of items.entries()) { d.addPage('letter', 'portrait'); d.setFont('DejaVu'); band(); const D = docOf(it), n = i + 1;
    d.setTextColor(...ink); d.setFontSize(17); const tt = d.splitTextToSize(`${n}. ${headOf(it)}`, W - 2 * mg).slice(0, 2), ty = (tt.length - 1) * 7; d.text(tt, mg, 19); d.setFontSize(9); d.setTextColor(...sub); d.text(`${it.kind === 'series' ? 'Series' : it.kind === 'section' ? 'Section' : 'Analysis view'} · ${it.pictures.length} figure${it.pictures.length === 1 ? '' : 's'}`, mg, 25.5 + ty);
    const infoH = 122, gx = mg, gw = W - 2 * mg, gy = 31 + ty, gh = H - gy - 20 - infoH - 3, P = it.pictures, cols = it.cols || (P.length === 12 ? 4 : P.length === 4 ? 2 : Math.ceil(Math.sqrt(P.length))), rows = Math.ceil(P.length / cols);
    const im0 = await imgOf(P[0].blob), ar = im0.height / im0.width, gap = 3.5, cap = 4.6, fw = Math.min((gw - (cols - 1) * gap) / cols, ((gh - (rows - 1) * gap) / rows - cap) / ar), fh = fw * ar, x0 = gx + (gw - (cols * fw + (cols - 1) * gap)) / 2;
    for (const [k, pic] of P.entries()) { const x = x0 + (k % cols) * (fw + gap), yy = gy + Math.floor(k / cols) * (fh + cap + gap); d.setFontSize(8); d.setTextColor(...ink); d.text(`Figure ${n}.${k + 1}${pic.label ? '  ' + pic.label : ''}`, x, yy + 3.4);
      d.addImage(await dataURL(pic.blob), 'JPEG', x, yy + cap, fw, fh, undefined, 'FAST'); d.setDrawColor(229, 231, 235); d.rect(x, yy + cap, fw, fh); }
    const iy = H - 20 - infoH, colW = (W - 2 * mg - 10) / 2, c1 = mg, c2 = mg + colW + 10, c3 = c2; d.setDrawColor(...line); d.line(mg, iy - 3, W - mg, iy - 3);
    // column 1: objective, method
    let y1 = iy + 3; if (it.objective) { y1 = head('Objective', c1, y1); y1 = wrap(usage(plain(it.objective)), colW, 7.8, c1, y1, sub) + 3; }
    y1 = head('Method', c1, y1); y1 = wrap(methodText(it.method) || '—', colW, 7.8, c1, y1, sub) + 2;
    if (D.refs.length) { y1 = head('References', c1, y1 + 1); for (const r of D.refs) y1 = wrap('• ' + r, colW, 7.4, c1, y1, sub) + 0.6; }
    // column 2: legend, results, inputs and boundary conditions, assumptions and limitations
    let y3 = iy + 3; if (it.legend) { const L = it.legend, lw = colW - 30, lh = 3.6, st = L.stops, hex = (c) => { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(c); return m ? m.slice(1).map((v) => parseInt(v, 16)) : (/rgb\((\d+),\s*(\d+),\s*(\d+)/.exec(c) || [0, 128, 128, 128]).slice(1).map(Number); };
      const at = (t) => { const s2 = t * (st.length - 1), k = Math.min(st.length - 2, Math.floor(s2)), u = s2 - k, a = hex(st[Math.max(0, k)]), b = hex(st[Math.min(st.length - 1, k + 1)]); return a.map((v, j) => Math.round(v + (b[j] - v) * u)); };
      y3 = head('Legend', c3, y3); for (let k = 0; k < 90; k++) { d.setFillColor(...(st.length > 1 ? at(k / 89) : hex(st[0]))); d.rect(c3 + lw * k / 90, y3, lw / 90 + 0.05, lh, 'F'); }
      d.setDrawColor(107, 114, 128); d.rect(c3, y3, lw, lh); d.setFontSize(7.4); d.setTextColor(...ink); for (const t of [0, 0.5, 1]) d.text(num(L.lo + (L.hi - L.lo) * t, L.dec), c3 + lw * t, y3 + lh + 3.4, { align: t === 0 ? 'left' : t === 1 ? 'right' : 'center' }); d.text(d.splitTextToSize(L.unit, 28), c3 + lw + 2, y3 + lh - 0.4); y3 += lh + 8; }
    if (it.rows && it.rows.length) { y3 = head('Results', c3, y3); y3 = table(it.rows.slice(0, 12), c3, y3, colW, 0.52, 7.6, H - 60) + 3; }
    y3 = head('Inputs and Boundary Conditions', c3, y3); y3 = table(inputsOf(it), c3, y3, colW, 0.4, 7.4, H - 50) + 3;
    const lim = [D.limit, ...(it.notes || []).map(usage)].filter(Boolean); if (lim.length) { y3 = head('Assumptions and Limitations', c3, y3); for (const t of lim) { if (y3 > H - 26) break; y3 = wrap(t, colW, 7.2, c3, y3, sub) + 1; } }
    foot(i + 3); }
  // assumptions, limitations and disclaimer
  d.addPage('letter', 'portrait'); d.setFont('DejaVu'); band(); d.setTextColor(...ink); d.setFontSize(18); d.text(`${items.length + 1}. Assumptions, Limitations and Disclaimer`, mg, 20);
  y = wrap(LIMITS, W - 2 * mg, 10.5, mg, 31, ink, 0.45) + 5; y = head('By analysis', mg, y + 2);
  for (const [i, it] of items.entries()) { d.setFontSize(9.5); d.setTextColor(...ink); d.text(`${i + 1}. ${headOf(it)}`, mg, y); y = wrap([docOf(it).limit, `${it.basis || ''} · computed ${usTime(it.at)}`].filter(Boolean).join(' '), W - 2 * mg - 8, 8.4, mg + 6, y + 5, sub) + 3; if (y > H - 30) { foot(N); d.addPage('letter', 'portrait'); d.setFont('DejaVu'); y = 24; } }
  y = head('Site and climate data', mg, y + 3); wrap(`${[ctx.site, ctx.coords].filter(Boolean).join(' · ') || '—'}. Climate data: ${ctx.weather || 'not used by the analyses in this report'}. Project conditions revision ${ctx.revision ?? '—'}. Units: SI.`, W - 2 * mg, 9, mg, y, sub);
  foot(N);
  return d.output('blob');
}

async function pptx(items, title, ctx) {
  const W = 13.333, H = 7.5, issued = usDate(Date.now()), slides = [{ title, blocks: [{ type: 'table', x: 0.5, y: 1.25, w: 6.3, h: 4.6, size: 11, rows: [['Project information', ''], ['Project', ctx.project], ['Location', ctx.site || '—'], ['Coordinates', ctx.coords || '—'], ['Climate data', ctx.weather || 'Not used'], ['Model', ctx.version], ['Prepared by', ctx.author || '—'], ['Date of issue', issued], ['Report status', 'Design-stage screening analysis']] }] }];
  if (items[0]?.pictures[0]) { const im = await imgOf(items[0].pictures[0].blob), h = Math.min(4.6, 5.9 * im.height / im.width); slides[0].blocks.push({ type: 'image', x: W - 0.5 - h * im.width / im.height, y: 1.3, w: h * im.width / im.height, h, jpeg: await bytes(items[0].pictures[0].blob), alt: headOf(items[0]), name: 'Cover figure' }); }
  slides.push({ title: 'Summary of Results', blocks: [{ type: 'table', x: 0.5, y: 1.25, w: W - 1, h: Math.min(5.5, (items.length + 1) * 0.42), size: 11, rows: [['No.', 'Analysis', 'Headline result'], ...items.map((it, i) => [String(i + 1), headOf(it), headline(it)])] }] });
  for (const [i, it] of items.entries()) { const P = it.pictures, n = i + 1, cols = it.cols || (P.length === 12 ? 4 : P.length === 4 ? 2 : Math.ceil(Math.sqrt(P.length))), rows = Math.ceil(P.length / cols), im0 = await imgOf(P[0].blob), ar = im0.height / im0.width;
    const gx = 0.5, gy = 1.2, gw = 8.6, gh = H - gy - 0.7, gap = 0.08, cap = 0.22, fw = Math.min((gw - (cols - 1) * gap) / cols, ((gh - (rows - 1) * gap) / rows - cap) / ar), fh = fw * ar, blocks = [];
    for (const [k, p] of P.entries()) { const x = gx + (k % cols) * (fw + gap), y = gy + Math.floor(k / cols) * (fh + cap + gap); blocks.push({ type: 'text', x, y: y - 0.04, w: fw, h: cap, paragraphs: [{ text: `Figure ${n}.${k + 1}${p.label ? '  ' + p.label : ''}`, size: 9, bold: true }] }); blocks.push({ type: 'image', x, y: y + cap, w: fw, h: fh, jpeg: await bytes(p.blob), alt: `${headOf(it)} · ${p.label || ''}`, name: `Figure ${n}.${k + 1}` }); }
    let sy = 1.2; const sx = 9.35, sw = W - sx - 0.45;
    if (it.legend) { const c = legendCanvas(it.legend), png = await bytes(await canvasBlob(c, 'image/png')); blocks.push({ type: 'image', x: sx, y: sy, w: sw, h: sw * c.height / c.width, png, alt: 'Legend', name: 'Legend' }); sy += sw * c.height / c.width + 0.2; }
    if (it.rows && it.rows.length) { const r = it.rows.slice(0, 8).map(([k, v]) => [plain(k), plain(v)]); blocks.push({ type: 'table', x: sx, y: sy, w: sw, h: Math.min(2.8, r.length * 0.3 + 0.3), size: 9, rows: [['Result', 'Value'], ...r] }); sy += Math.min(2.8, (r.length + 1) * 0.3) + 0.2; }
    blocks.push({ type: 'text', x: sx, y: sy, w: sw, h: Math.max(0.6, H - sy - 0.6), paragraphs: [{ text: 'Method: ' + (methodText(it.method) || '—'), size: 8, color: '4B5563' }, ...(docOf(it).refs.length ? [{ text: 'References: ' + docOf(it).refs.join('; '), size: 8, color: '4B5563' }] : []), { text: 'Inputs: ' + inputsOf(it).map(([k, v]) => `${k} ${v}`).join(' · '), size: 8, color: '4B5563' }, ...(docOf(it).limit ? [{ text: 'Limitations: ' + docOf(it).limit, size: 8, color: '4B5563' }] : [])] });
    slides.push({ title: `${n}. ${headOf(it)}`, blocks }); }
  slides.push({ title: `${items.length + 1}. Assumptions, Limitations and Disclaimer`, blocks: [{ type: 'text', x: 0.5, y: 1.3, w: W - 1, h: H - 2, paragraphs: [{ text: LIMITS, size: 13 }, ...items.map((it, i) => ({ text: `${i + 1}. ${headOf(it)}: ${docOf(it).limit || ''} ${it.basis || ''}`, size: 10, color: '4B5563' })), { text: `Site and climate data: ${[ctx.site, ctx.coords, ctx.weather].filter(Boolean).join(' · ')}. Units: SI.`, size: 10, color: '4B5563' }] }] });
  return buildPptx({ title, author: ctx.author || 'PlotCloud', footer: `${ctx.project} · ${title} · Issued ${issued}`, slides });
}

let deps = null;
function pdfDeps() { if (!deps) deps = (async () => { await import('../vendor/jspdf-4.2.1.umd.min.js'); const r = await fetch(new URL('../vendor/DejaVuSans.ttf', import.meta.url)); if (!r.ok) throw Error('The report font could not load. Please retry.');
  const b = new Uint8Array(await r.arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode(...b.subarray(i, i + 32768)); return { PDF: globalThis.jspdf.jsPDF, font: btoa(s) }; })().catch((e) => { deps = null; throw e; }); return deps; }
