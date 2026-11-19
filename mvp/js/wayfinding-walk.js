// Wayfinding phases 4 and 5 (2026-11-19).
// · The first-person walk: one route at eye height in the 3D view, at the walking speed set, pausing before each decision point
//   with what the walker sees there (interior/wayfinding-signage.js walkCheck); Play, Pause, Restart, Previous and Next decision.
// · The signage schedule (CSV) and the drawing (SVG, PNG, PDF, DXF): the floor plan with the routes and their direction, the
//   decision points by priority, the signs numbered with their facing, a legend and the schedule; High priority only on request.
import * as WS from './interior/wayfinding-signage.js?v=wfsign-20261119-3';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), plen = (P) => P.reduce((s, p, i) => (i ? s + dist(P[i - 1], p) : 0), 0);
const along = (P, s) => { let acc = 0; for (let i = 1; i < P.length; i++) { const L = dist(P[i - 1], P[i]); if (acc + L >= s) { const t = L ? (s - acc) / L : 0; return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t]; } acc += L; } return P.at(-1).slice(); };
const GLYPH = { Ahead: '↑', Left: '←', Right: '→', Back: '↓', Here: '●' };
const PCT = (x) => `${Math.round(x * 100)} %`;
const COMPASS = (deg, north = 0) => ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'][Math.round((((deg + north) % 360 + 360) % 360) / 45) % 8];

// ---------------- the walk ----------------
/** a walk along one route: place(p, angle) moves the eye, onState(state) tells the card; pauses 1.5 m before each decision */
export function walker({ check, speed = 1.2, place, onState }) {
  const P = check.pts, L = plen(P), D = check.decisions, st = { s: 0, len: L, playing: false, at: null, i: -1, done: false }; let raf = 0, last = 0;
  const pose = () => { const p = along(P, st.s), q = along(P, Math.min(L, st.s + 1.5)), a = Math.atan2(q[1] - p[1], q[0] - p[0]); place(p, Number.isFinite(a) && dist(p, q) > 0.05 ? a : st.a || 0); st.a = a; st.p = p; };
  const stopAt = (k) => { st.i = k; st.at = D[k]; st.playing = false; cancelAnimationFrame(raf); pose(); onState({ ...st }); };
  const tick = (t) => { const dt = Math.min(0.1, (t - last) / 1000); last = t; const s0 = st.s; st.s = Math.min(L, st.s + speed * dt);
    const k = D.findIndex((d, j) => j > st.i && s0 < Math.max(0, d.s - 1.5) + 1e-9 && st.s >= Math.max(0, d.s - 1.5)); if (k >= 0) { st.s = Math.max(0, D[k].s - 1.5); return stopAt(k); }
    pose(); if (st.s >= L) { st.playing = false; st.done = true; st.at = null; onState({ ...st }); return; } onState({ ...st, quiet: true }); raf = requestAnimationFrame(tick); };
  const api = {
    play() { if (st.playing) return; if (st.done) api.restart(); st.playing = true; st.at = null; last = performance.now(); onState({ ...st }); raf = requestAnimationFrame(tick); },
    pause() { st.playing = false; cancelAnimationFrame(raf); onState({ ...st }); },
    restart() { cancelAnimationFrame(raf); Object.assign(st, { s: 0, playing: false, at: null, i: -1, done: false }); const k = D.findIndex((d) => d.s - 1.5 <= 0); if (k >= 0) return stopAt(k); pose(); onState({ ...st }); },
    next() { const k = st.i + 1; if (k < D.length) { st.s = Math.max(0, D[k].s - 1.5); stopAt(k); } else { st.s = L; st.done = true; st.at = null; pose(); onState({ ...st }); } },
    prev() { const k = Math.max(0, st.i - 1); if (D[k]) { st.s = Math.max(0, D[k].s - 1.5); stopAt(k); } },
    stop() { cancelAnimationFrame(raf); st.playing = false; }, state: () => ({ ...st }) };
  api.restart(); return api;
}

/** the walk block of the card */
export function walkHTML(A, ST, esc, ws) {
  const ok = A.routes.filter((r) => !r.noRoute && r.pts && r.pts.length > 1); if (!ok.length) return '';
  const i = Math.min(ok.length - 1, Math.max(0, ST.wayWalkR || 0)), W = ST.wayWalk && ST.wayWalk.lv === A.level.id && ST.wayWalk.r === i ? ST.wayWalk : null, s = W ? W.state : null, d = s && s.at;
  const list = W ? W.check.decisions.map((x, k) => `<li class="${s && s.i === k ? 'sp-wfsel' : ''}${x.guided ? '' : ' sp-bad'}">#${x.no} at ${x.s.toFixed(1)} m · take <b>${esc(x.take)}</b> · ${esc(x.note)}</li>`).join('') : '';
  return `<p class="sp-flabel">First-person walk</p><select class="sp-sel" data-way="walkroute" aria-label="Route to walk">${ok.map((r, k) => `<option value="${k}" ${k === i ? 'selected' : ''}>${esc(r.start.name)} → ${esc(r.room.name)}${r.floor ? ` (${esc(r.floor)})` : ''} · ${r.len.toFixed(0)} m</option>`).join('')}</select>
    <div class="sp-acts">${W ? `<button type="button" class="btn sm" data-way="walkprev" aria-label="Previous decision">◀</button><button type="button" class="btn sm primary" data-way="${s.playing ? 'walkpause' : 'walkplay'}">${s.playing ? 'Pause' : s.done ? 'Again' : 'Play'}</button><button type="button" class="btn sm" data-way="walknext" aria-label="Next decision">▶</button><button type="button" class="btn sm" data-way="walkrestart">Restart</button><button type="button" class="btn sm" data-way="walkstop">Leave the walk</button>` : `<button type="button" class="btn sm primary" data-way="walkgo">Walk it at eye height</button>`}</div>
    ${W ? `<p class="sp-note" data-way-walkpos>${s.done ? 'Arrived' : `${s.s.toFixed(1)} of ${s.len.toFixed(1)} m`} · ${ws} m/s · ${W.check.guided} of ${W.check.decisions.length} decisions guided on this route</p>
      ${d ? `<div class="sp-sfpick sp-wfdetail" data-way-walkat><b>Point ${d.no} · ${esc(d.cls)} · the way on is ${esc(d.take)}</b>${d.ways.map((w) => `<div class="sp-kv"><span>${GLYPH[w.rel] || ''} ${esc(w.rel)}</span><b>${esc(w.to.join(', '))}</b></div>`).join('')}
        <div class="sp-kv"><span>Signs seen</span><b>${d.seen.length ? d.seen.map((x) => `${esc(x.id)} from ${x.from} m${x.mine ? ` (${esc(x.mine)} for ${esc(W.check.room)})` : ' (not naming it)'}`).join('; ') : 'none'}</b></div>
        <p class="sp-note ${d.guided ? '' : 'sp-warn'}">${d.guided ? 'Guided: ' : 'Not guided: '}${esc(d.note)}. The walker is not told the way: a sign in sight must name it.</p></div>` : ''}
      <ol class="sp-sflist sp-wfwalk">${list}</ol>` : '<p class="sp-note">Walks the route in the 3D view at the eye height set, stopping before each decision point to show which signs the walker can see from there (the layout\'s signs and existing ones) and whether one names the way.</p>'}`;
}

// ---------------- the schedule and the drawing ----------------
/** the signage schedule: one row per sign */
export function schedule(A, plan, ev, { highOnly = false, north = 0 } = {}) {
  const sel = ev.signs.filter((g) => !highOnly || g.cls === 'High');
  return sel.map((g) => ({ id: g.id, floor: A.level.name, x: +g.p[0].toFixed(2), y: +g.p[1].toFixed(2), point: g.at ? '#' + g.at : '', where: WS.whereIs(A, g.p), type: g.type, mount: g.mount === 'wall' ? 'on the wall' : 'hung, both sides',
    faces: `${g.face}° (towards the ${COMPASS(g.face, north)})`, says: g.ways.map((w) => `${w.arrow}: ${w.to.join(', ')}`).join(' | '), back: g.waysB ? g.waysB.map((w) => `${w.arrow}: ${w.to.join(', ')}`).join(' | ') : '',
    priority: g.room ? 'identification' : `${g.cls} (${g.score})`, visibility: PCT(g.vis), status: g.issue || 'OK' }));
}
const COLS = [['id', 'Sign ID'], ['floor', 'Floor'], ['x', 'x (m)'], ['y', 'y (m)'], ['point', 'Decision point'], ['where', 'Location'], ['type', 'Sign type'], ['mount', 'Mounting'], ['faces', 'Direction it faces'], ['says', 'Destinations (front)'], ['back', 'Destinations (back)'], ['priority', 'Priority'], ['visibility', 'Seen by routes'], ['status', 'Visibility status']];
export function scheduleCSV(rows) { const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; return '﻿' + [COLS.map((c) => c[1]).join(','), ...rows.map((r) => COLS.map((c) => q(r[c[0]])).join(','))].join('\r\n') + '\r\n'; }

// the geometry drawn: walls, rooms, routes, points, signs (scene coordinates, metres, y up)
function parts(A, plan, ev, highOnly) {
  const SC = A.F.SC, ok = A.routes.filter((r) => !r.noRoute && r.pts), pts = A.nodes.filter((n) => !highOnly || n.cls === 'High'), signs = ev ? ev.signs.filter((g) => !highOnly || g.cls === 'High') : [];
  const xs = [], ys = []; for (const w of SC.walls) { xs.push(w.a[0], w.b[0]); ys.push(w.a[1], w.b[1]); } for (const r of SC.rooms) for (const [x, y, w, d] of r.rects) { xs.push(x, x + w); ys.push(y, y + d); }
  const box = { x0: Math.min(...xs) - 2, y0: Math.min(...ys) - 2, x1: Math.max(...xs) + 2, y1: Math.max(...ys) + 2 };
  return { SC, ok, pts, signs, box };
}
/** the drawing as SVG: plan, routes with arrows, points by priority, numbered signs with their facing, legend, title and schedule */
export function drawingSVG(A, plan, ev, { project = '', highOnly = false, north = 0 } = {}) {
  const { SC, ok, pts, signs, box } = parts(A, plan, ev, highOnly), k = 1000 / Math.max(box.x1 - box.x0, box.y1 - box.y0) * 1.6, W = (box.x1 - box.x0) * k, H = (box.y1 - box.y0) * k;
  const X = (x) => ((x - box.x0) * k).toFixed(1), Y = (y) => ((box.y1 - y) * k).toFixed(1), esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const rows = schedule(A, plan, ev || { signs: [] }, { highOnly, north }), rh = 20, side = 440, TW = W + side, TH = Math.max(H, 260) + 60 + (rows.length + 2) * rh;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(TW)}" height="${Math.round(TH)}" viewBox="0 0 ${Math.round(TW)} ${Math.round(TH)}" font-family="Inter, Arial, sans-serif"><rect width="100%" height="100%" fill="#fff"/><g>`];
  for (const r of SC.rooms) for (const [x, y, w, d] of r.rects) out.push(`<rect x="${X(x)}" y="${Y(y + d)}" width="${(w * k).toFixed(1)}" height="${(d * k).toFixed(1)}" fill="${r.circ ? '#f5f7fa' : '#fbfbfc'}" stroke="none"/>`);
  for (const w of SC.walls) out.push(`<line x1="${X(w.a[0])}" y1="${Y(w.a[1])}" x2="${X(w.b[0])}" y2="${Y(w.b[1])}" stroke="#1f2937" stroke-width="${Math.max(1.2, (w.t || 0.2) * k).toFixed(1)}" stroke-linecap="square"/>`);
  for (const r of SC.rooms) if (!r.circ && r.rects[0]) { const [x, y, w, d] = r.rects[0]; out.push(`<text x="${X(x + w / 2)}" y="${Y(y + d / 2)}" font-size="${Math.max(7, Math.min(11, w * k / 9)).toFixed(1)}" fill="#6b7280" text-anchor="middle">${esc(r.name)}</text>`); }
  for (const r of ok) { out.push(`<polyline points="${r.pts.map((p) => X(p[0]) + ',' + Y(p[1])).join(' ')}" fill="none" stroke="#3b6fb6" stroke-width="1.4" stroke-opacity=".55"/>`);
    const L = plen(r.pts); for (let s = 4; s < L - 1; s += 8) { const a = along(r.pts, s), b = along(r.pts, s + 0.6), ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0]) * 180 / Math.PI; out.push(`<path d="M-4,-3 L2,0 L-4,3" transform="translate(${X(a[0])},${Y(a[1])}) rotate(${ang.toFixed(0)})" fill="none" stroke="#3b6fb6" stroke-width="1.2" stroke-opacity=".8"/>`); } }
  for (const n of pts) out.push(`<circle cx="${X(n.p[0])}" cy="${Y(n.p[1])}" r="8" fill="${n.col}" stroke="#fff" stroke-width="1.5"/><text x="${X(n.p[0])}" y="${(+Y(n.p[1]) + 3.5).toFixed(1)}" font-size="9" font-weight="700" fill="#111" text-anchor="middle">${n.no}</text>`);
  for (const g of signs) { const f = g.face * Math.PI / 180, px = +X(g.p[0]), py = +Y(g.p[1]), c = g.issue ? '#ea580c' : '#1f3a68';
    out.push(`<line x1="${px}" y1="${py}" x2="${(px + Math.cos(f) * 18).toFixed(1)}" y2="${(py - Math.sin(f) * 18).toFixed(1)}" stroke="${c}" stroke-width="2"/>`); if (g.sides === 2) out.push(`<line x1="${px}" y1="${py}" x2="${(px - Math.cos(f) * 14).toFixed(1)}" y2="${(py + Math.sin(f) * 14).toFixed(1)}" stroke="${c}" stroke-width="1.4"/>`);
    out.push(`<rect x="${px - 11}" y="${py - 7}" width="22" height="14" rx="2" fill="${c}"/><text x="${px}" y="${py + 3.5}" font-size="8.5" font-weight="700" fill="#fff" text-anchor="middle">${esc(g.id)}</text>`); }
  out.push('</g>');
  // the side: title, figures, legend
  const sx = W + 24; let y = 34; const T = (t, size = 11, wt = 400, col = '#1d2433') => { const per = Math.max(12, Math.floor((side - 40) / (size * (wt >= 600 ? 0.6 : 0.54)))), words = String(t).split(' '), lines = ['']; for (const w of words) { if ((lines.at(-1) + ' ' + w).trim().length > per) lines.push(w); else lines[lines.length - 1] = (lines.at(-1) + ' ' + w).trim(); }
    for (const l of lines) { out.push(`<text x="${sx}" y="${y}" font-size="${size}" font-weight="${wt}" fill="${col}">${esc(l)}</text>`); y += size + 5; } y += 2; };   // wrapped to the side column
  T('Wayfinding signage', 18, 700); T(`${project ? project + ' · ' : ''}${A.level.name}`, 12); T(`${new Date().toISOString().slice(0, 10)} · ${highOnly ? 'High priority only' : 'full analysis'}`, 10, 400, '#6b7280'); y += 6;
  if (plan && ev) { T(`Layout: option ${plan.opt}${plan.edited ? ' (edited)' : ''} · ${ev.total} signs`, 11, 600); T(`Decisions guided ${PCT(ev.clarity)} (${ev.guided} of ${ev.events})`); T(`Routes fully guided ${ev.routesOK} of ${ev.routes}`); T(`High-priority points guided ${ev.highCovered} of ${ev.high}`); T(`Points left without a sign: ${ev.unresolved.length ? ev.unresolved.map((n) => '#' + n).join(', ') : 'none'}`); }
  else T('No signage layout chosen: decision points only.', 11, 400, '#6b7280'); y += 8;
  T('Legend', 12, 700); for (const [col, t] of [['#d8402a', 'High priority point (60+)'], ['#e0a020', 'Medium (35–59)'], ['#3f9d5a', 'Low']]) { out.push(`<circle cx="${sx + 7}" cy="${y - 4}" r="6" fill="${col}"/>`); out.push(`<text x="${sx + 20}" y="${y}" font-size="10.5" fill="#1d2433">${t}</text>`); y += 17; }
  out.push(`<rect x="${sx}" y="${y - 11}" width="16" height="11" rx="2" fill="#1f3a68"/><text x="${sx + 22}" y="${y - 2}" font-size="10.5" fill="#1d2433">Sign, numbered; the line shows the way it faces</text>`); y += 17;
  out.push(`<rect x="${sx}" y="${y - 11}" width="16" height="11" rx="2" fill="#ea580c"/><text x="${sx + 22}" y="${y - 2}" font-size="10.5" fill="#1d2433">Sign with a visibility issue</text>`); y += 17;
  out.push(`<line x1="${sx}" y1="${y - 5}" x2="${sx + 16}" y2="${y - 5}" stroke="#3b6fb6" stroke-width="1.6"/><text x="${sx + 22}" y="${y - 2}" font-size="10.5" fill="#1d2433">Visitor route, with its direction</text>`); y += 22;
  T('Counts, not a predicted success rate: a decision is guided when a sign there is seen from 2 of the 8 metres before it and names the way.', 8.5, 400, '#6b7280');
  // the schedule under the plan
  let ty = Math.max(H, 260) + 40; const cw = [42, 48, 70, 70, 120, 230, 230, 90, 70, 150], cols = [['id', 'Sign'], ['point', 'Point'], ['type', 'Type'], ['mount', 'Mounting'], ['faces', 'Faces'], ['says', 'Front'], ['back', 'Back'], ['priority', 'Priority'], ['visibility', 'Seen'], ['status', 'Status']];
  out.push(`<text x="24" y="${ty}" font-size="13" font-weight="700" fill="#1d2433">Signage schedule (${rows.length})</text>`); ty += rh;
  const row = (vals, bold) => { let x = 24; vals.forEach((v, i) => { const t = String(v); out.push(`<text x="${x}" y="${ty}" font-size="9" ${bold ? 'font-weight="700"' : ''} fill="#1d2433">${esc(t.length > cw[i] / 5 ? t.slice(0, Math.floor(cw[i] / 5) - 1) + '…' : t)}</text>`); x += cw[i]; }); ty += rh; };
  row(cols.map((c) => c[1]), true); for (const r of rows) row(cols.map((c) => r[c[0]]));
  out.push('</svg>'); return out.join('');
}
/** the drawing as a PNG (from the SVG) */
export async function drawingPNG(svg) { const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); try { const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(Error('The drawing could not be drawn.')); i.src = url; });
  const c = document.createElement('canvas'); c.width = img.width * 1.5; c.height = img.height * 1.5; const x = c.getContext('2d'); x.scale(1.5, 1.5); x.drawImage(img, 0, 0); return c.toDataURL('image/png'); } finally { URL.revokeObjectURL(url); } }
/** the drawing as a PDF: the drawing on an A3 landscape page, the schedule as a table after it.
 *  The table is set in DejaVu Sans (2026-11-19: was the PDF's built-in Helvetica, which has no arrows, ≥ or letters outside Western
 *  Europe). DejaVu has no Chinese, Japanese or Korean; a schedule with them is drawn by the browser, with its fonts, as pictures of the table. */
let pdfFont = null;
const loadFont = () => pdfFont || (pdfFont = (async () => { const r = await fetch(new URL('../vendor/DejaVuSans.ttf', import.meta.url)); if (!r.ok) throw Error('The PDF font could not load. Please retry.');
  const b = new Uint8Array(await r.arrayBuffer()); let t = ''; for (let i = 0; i < b.length; i += 32768) t += String.fromCharCode(...b.subarray(i, i + 32768)); return btoa(t); })().catch((e) => { pdfFont = null; throw e; }));
export const CJK = /[\u1100-\u11FF\u2E80-\u2FDF\u3000-\u30FF\u3100-\u31FF\u3400-\u4DBF\u4E00-\u9FFF\uA960-\uA97F\uAC00-\uD7AF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF]|[\uD840-\uD87F][\uDC00-\uDFFF]/;
const PCOLS = [['id', 14], ['floor', 30], ['point', 14], ['where', 40], ['type', 34], ['mount', 26], ['faces', 38], ['says', 110], ['priority', 26], ['visibility', 18], ['status', 50]];
export async function drawingPDF(png, rows, title) { await import('../vendor/jspdf-4.2.1.umd.min.js'); const PDF = globalThis.jspdf.jsPDF, pdf = new PDF({ unit: 'mm', format: 'a3', orientation: 'landscape', compress: true });
  const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = png; }), k = Math.min(400 / img.width, 277 / img.height); pdf.setProperties({ title, author: 'PlotCloud' }); pdf.addImage(png, 'PNG', 10, 10, img.width * k, img.height * k);
  if (!rows.length) return pdf.output('blob');
  const head = PCOLS.map(([k2]) => COLS.find((c) => c[0] === k2)[1]), body = rows.map((r) => PCOLS.map(([k2]) => String(r[k2] ?? '')));
  if (body.some((r) => r.some((v) => CJK.test(v)))) { tablePictures(pdf, head, body); return pdf.output('blob'); }
  pdf.addFileToVFS('DejaVuSans.ttf', await loadFont()); pdf.addFont('DejaVuSans.ttf', 'DejaVu', 'normal'); pdf.setFont('DejaVu', 'normal');
  pdf.addPage('a3', 'landscape'); pdf.setFontSize(14); pdf.text('Signage schedule', 12, 16); pdf.setFontSize(7.5); let y = 26;
  const line = (vals, b) => { let x = 12; vals.forEach((v, i) => { const t = pdf.splitTextToSize(v, PCOLS[i][1] - 2)[0] || ''; pdf.text(t, x, y); if (b) pdf.text(t, x + 0.12, y); x += PCOLS[i][1]; }); y += 6; if (y > 285) { pdf.addPage('a3', 'landscape'); y = 16; } };   // the header drawn twice, a little apart: DejaVu is here in one weight
  line(head, true); for (const r of body) line(r);
  return pdf.output('blob'); }
// the schedule drawn on a canvas, a page at a time, and placed as pictures (a schedule with Chinese, Japanese or Korean names)
function tablePictures(pdf, head, body) {
  const S = 6, W = 400, pageRows = 42, mm = (v) => v * S, ff = 'system-ui, "Noto Sans", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif';
  for (let at = 0, pg = 0; at < body.length || pg === 0; at += pageRows, pg++) {
    const part = body.slice(at, at + pageRows), H = 26 + (part.length + 1) * 6, c = document.createElement('canvas'); c.width = mm(W); c.height = mm(H); const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#1d2433'; g.textBaseline = 'alphabetic';
    if (pg === 0) { g.font = `600 ${mm(5)}px ${ff}`; g.fillText('Signage schedule', mm(2), mm(6)); }
    let y = 16; const line = (vals, b) => { let x = 2; g.font = `${b ? 700 : 400} ${mm(2.65)}px ${ff}`; vals.forEach((v, i) => { const w = mm(PCOLS[i][1] - 2); let t = v; if (g.measureText(t).width > w) { while (t && g.measureText(t + '…').width > w) t = t.slice(0, -1); t += '…'; } g.fillText(t, mm(x), mm(y)); x += PCOLS[i][1]; }); y += 6; };
    line(head, true); for (const r of part) line(r);
    pdf.addPage('a3', 'landscape'); pdf.addImage(c.toDataURL('image/png'), 'PNG', 10, 10, W, H);
    if (at + pageRows >= body.length) break; }
}
/** the drawing as DXF (metres): layers WALLS, ROOMS, ROUTES, POINTS, SIGNS, SIGN_FACING, TEXT */
export function drawingDXF(A, plan, ev, { highOnly = false } = {}) { const { SC, ok, pts, signs } = parts(A, plan, ev, highOnly), E = [];
  const ln = (L, a, b) => E.push(`0\nLINE\n8\n${L}\n10\n${a[0]}\n20\n${a[1]}\n30\n0\n11\n${b[0]}\n21\n${b[1]}\n31\n0`), tx = (L, p, h, t) => E.push(`0\nTEXT\n8\n${L}\n10\n${p[0]}\n20\n${p[1]}\n30\n0\n40\n${h}\n1\n${String(t).replace(/\n/g, ' ')}`), ci = (L, p, r) => E.push(`0\nCIRCLE\n8\n${L}\n10\n${p[0]}\n20\n${p[1]}\n30\n0\n40\n${r}`);
  for (const w of SC.walls) ln('WALLS', w.a, w.b); for (const r of SC.rooms) if (!r.circ && r.rects[0]) { const [x, y, w, d] = r.rects[0]; tx('ROOMS', [x + 0.3, y + d / 2], 0.35, r.name); }
  for (const r of ok) for (let i = 1; i < r.pts.length; i++) ln('ROUTES', r.pts[i - 1], r.pts[i]);
  for (const n of pts) { ci('POINTS', n.p, 0.45); tx('TEXT', [n.p[0] + 0.55, n.p[1] + 0.2], 0.35, `#${n.no} ${n.cls} ${n.score}`); }
  for (const g of signs) { const f = g.face * Math.PI / 180, u = [Math.cos(f), Math.sin(f)], v = [-u[1], u[0]], hw = g.type === 'Identification' ? 0.2 : 0.45;
    ln('SIGNS', [g.p[0] - v[0] * hw, g.p[1] - v[1] * hw], [g.p[0] + v[0] * hw, g.p[1] + v[1] * hw]); ln('SIGN_FACING', g.p, [g.p[0] + u[0] * 1.2, g.p[1] + u[1] * 1.2]); tx('TEXT', [g.p[0] + 0.3, g.p[1] - 0.6], 0.3, `${g.id} ${g.type}: ${g.ways.map((w) => `${w.arrow} ${w.to.join(', ')}`).join('; ')}`); }
  const layers = ['WALLS', 'ROOMS', 'ROUTES', 'POINTS', 'SIGNS', 'SIGN_FACING', 'TEXT'];
  return `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n6\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${layers.length}\n${layers.map((l, i) => `0\nLAYER\n2\n${l}\n70\n0\n62\n${[7, 8, 5, 1, 4, 4, 7][i]}\n6\nCONTINUOUS`).join('\n')}\n0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${E.join('\n')}\n0\nENDSEC\n0\nEOF\n`; }
