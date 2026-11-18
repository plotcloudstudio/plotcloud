// SVG and DXF of computed plan geometry (2026-11-18): the swept path and parking studies. Plan metres, x east, y north.
// layers: [{ name, col (#rrggbb), w (line width, m), dash ([m, m]), items: [{ pts: [[x, y], …], closed, fill }], texts: [{ p, text, size (m) }] }]
// The DXF is AutoCAD R12 (POLYLINE / VERTEX / SEQEND, TEXT), one layer per study layer, so any CAD program opens it; units metres.
const num = (v) => (Math.round(v * 1000) / 1000).toString();
const aci = (hex) => { const h = (hex || '#000000').replace('#', ''), r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);   // nearest AutoCAD colour of the first seven
  const C = [[1, 255, 0, 0], [2, 255, 255, 0], [3, 0, 255, 0], [4, 0, 255, 255], [5, 0, 0, 255], [6, 255, 0, 255], [7, 0, 0, 0], [8, 128, 128, 128]]; let best = 7, bd = Infinity; for (const [i, R, G, B] of C) { const d = (R - r) ** 2 + (G - g) ** 2 + (B - b) ** 2; if (d < bd) { bd = d; best = i; } } return best; };
const layerName = (s) => String(s || '0').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 31) || '0';

export function bounds(layers) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const L of layers) { for (const it of L.items || []) for (const p of it.pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } for (const t of L.texts || []) { x0 = Math.min(x0, t.p[0]); y0 = Math.min(y0, t.p[1]); x1 = Math.max(x1, t.p[0]); y1 = Math.max(y1, t.p[1]); } }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: 1, y1: 1 }; }

/** an SVG drawing: 1 m = `scale` px, y up turned to y down, a scale bar and a legend of the layers; o: { title, note, scale } */
export function svg(layers, o = {}) {
  const B = bounds(layers), pad = 4, s = o.scale || 10, W = (B.x1 - B.x0 + 2 * pad) * s, legendH = 18 * (layers.length + 3), H = (B.y1 - B.y0 + 2 * pad) * s + legendH;
  const X = (x) => num((x - B.x0 + pad) * s), Y = (y) => num((B.y1 - y + pad) * s), esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${num(W)}" height="${num(H)}" viewBox="0 0 ${num(W)} ${num(H)}" font-family="Inter,Arial,sans-serif">`, `<rect width="100%" height="100%" fill="#ffffff"/>`];
  if (o.title) out.push(`<title>${esc(o.title)}</title>`);
  for (const L of layers) { out.push(`<g id="${esc(layerName(L.name))}" stroke="${L.col || '#000'}" stroke-width="${num((L.w || 0.05) * s)}" fill="none"${L.dash ? ` stroke-dasharray="${L.dash.map((d) => num(d * s)).join(' ')}"` : ''}>`);
    for (const it of L.items || []) { if (!it.pts || it.pts.length < 2) continue; const d = it.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0])} ${Y(p[1])}`).join(' ') + (it.closed ? ' Z' : ''); out.push(`<path d="${d}"${it.fill ? ` fill="${it.fill}" fill-opacity="${it.fop ?? 0.35}"` : ''}/>`); }
    for (const t of L.texts || []) out.push(`<text x="${X(t.p[0])}" y="${Y(t.p[1])}" font-size="${num((t.size || 0.8) * s)}" fill="${L.col || '#000'}" stroke="none" text-anchor="middle">${esc(t.text)}</text>`);
    out.push('</g>'); }
  // the scale bar (10 m) and the legend
  const y0 = (B.y1 - B.y0 + 2 * pad) * s + 10, bar = 10 * s; out.push(`<g font-size="11" fill="#111"><rect x="10" y="${num(y0)}" width="${num(bar / 2)}" height="5" fill="#111"/><rect x="${num(10 + bar / 2)}" y="${num(y0)}" width="${num(bar / 2)}" height="5" fill="#fff" stroke="#111"/><text x="10" y="${num(y0 + 18)}">0</text><text x="${num(10 + bar)}" y="${num(y0 + 18)}" text-anchor="middle">10 m</text>`);
  layers.forEach((L, i) => { const yy = y0 + 36 + 18 * i; out.push(`<line x1="10" y1="${num(yy)}" x2="40" y2="${num(yy)}" stroke="${L.col || '#000'}" stroke-width="2"${L.dash ? ' stroke-dasharray="6 4"' : ''}/><text x="48" y="${num(yy + 4)}">${esc(L.label || L.name)}</text>`); });
  if (o.note) out.push(`<text x="10" y="${num(y0 + 36 + 18 * layers.length + 6)}" fill="#555">${esc(o.note)}</text>`);
  out.push('</g></svg>'); return out.join('\n');
}

/** an AutoCAD R12 DXF: one layer per study layer; polylines and text, metres */
export function dxf(layers) {
  const P = [], put = (...kv) => { for (let i = 0; i < kv.length; i += 2) P.push(String(kv[i]), String(kv[i + 1])); };
  put(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$INSUNITS', 70, 6, 0, 'ENDSEC');
  put(0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LAYER', 70, layers.length);
  for (const L of layers) put(0, 'LAYER', 2, layerName(L.name), 70, 0, 62, aci(L.col), 6, L.dash ? 'DASHED' : 'CONTINUOUS');
  put(0, 'ENDTAB', 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
  for (const L of layers) { const ln = layerName(L.name);
    for (const it of L.items || []) { if (!it.pts || it.pts.length < 2) continue; put(0, 'POLYLINE', 8, ln, 66, 1, 70, it.closed ? 1 : 0, 10, 0, 20, 0, 30, 0); for (const p of it.pts) put(0, 'VERTEX', 8, ln, 10, num(p[0]), 20, num(p[1]), 30, 0); put(0, 'SEQEND', 8, ln); }
    for (const t of L.texts || []) put(0, 'TEXT', 8, ln, 10, num(t.p[0]), 20, num(t.p[1]), 30, 0, 40, num(t.size || 0.8), 1, String(t.text).replace(/[\r\n]+/g, ' '), 72, 1, 11, num(t.p[0]), 21, num(t.p[1]), 31, 0); }
  put(0, 'ENDSEC', 0, 'EOF'); return P.join('\n') + '\n';
}

/** read a DXF back (tests): its layers and the number of polylines and texts on each */
export function readDxf(text) { const L = text.split(/\r?\n/), out = {}; let cur = null;
  for (let i = 0; i + 1 < L.length; i += 2) { const c = L[i].trim(), v = L[i + 1].trim(); if (c === '0') cur = v; if (c === '8' && (cur === 'POLYLINE' || cur === 'TEXT')) { const o = (out[v] ||= { polylines: 0, texts: 0 }); if (cur === 'POLYLINE') o.polylines++; else o.texts++; cur = null; } }
  return out; }
