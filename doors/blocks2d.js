// 2D plan and elevation blocks: DXF (R12, real BLOCK definitions + INSERTs), SVG sheet, and Rhino layers.
// Drawing units are millimetres at 1:1; pens and text are sized for plotting at 1:50.
import { LAYERS2D, extent2D } from './models.js';

const f = (v) => (Math.round(v * 1000) / 1000).toString();
const safe = (s) => s.replace(/[^A-Za-z0-9_-]+/g, '_');
const D2R = Math.PI / 180;

// Sheet layout: plan at the origin, elevation above it with the same X, titles under each view.
export function sheetLayout(bl) {
  const pe = extent2D(bl.plan), ee = extent2D(bl.elev);
  const elevDy = pe[3] + 900 - Math.min(0, ee[1]);
  return { pe, ee, elevDy, titles: [['PLAN 1:50', pe[0], pe[1] - 350], ['ELEVATION 1:50', ee[0], elevDy + ee[1] - 350]] };
}

export function toDXFBlocks(bl, name) {
  const base = safe(name).toUpperCase();
  const names = { plan: base + '_PLAN', elev: base + '_ELEV' };
  const S = sheetLayout(bl);
  const L = [];
  const w = (c, v) => L.push(String(c), String(v));
  const layers = Object.keys(LAYERS2D);
  w(0, 'SECTION'); w(2, 'HEADER'); w(9, '$ACADVER'); w(1, 'AC1009'); w(9, '$INSUNITS'); w(70, 4); w(9, '$LTSCALE'); w(40, 1); w(0, 'ENDSEC');
  w(0, 'SECTION'); w(2, 'TABLES');
  w(0, 'TABLE'); w(2, 'LTYPE'); w(70, 2);
  w(0, 'LTYPE'); w(2, 'CONTINUOUS'); w(70, 0); w(3, 'Solid line'); w(72, 65); w(73, 0); w(40, 0);
  w(0, 'LTYPE'); w(2, 'DASHED'); w(70, 0); w(3, '__ __ __'); w(72, 65); w(73, 2); w(40, 160); w(49, 100); w(49, -60);
  w(0, 'ENDTAB');
  w(0, 'TABLE'); w(2, 'LAYER'); w(70, layers.length + 1);
  w(0, 'LAYER'); w(2, '0'); w(70, 0); w(62, 7); w(6, 'CONTINUOUS');
  for (const ln of layers) { const [col, lt] = LAYERS2D[ln]; w(0, 'LAYER'); w(2, ln); w(70, 0); w(62, col); w(6, lt); }
  w(0, 'ENDTAB');
  w(0, 'TABLE'); w(2, 'STYLE'); w(70, 1); w(0, 'STYLE'); w(2, 'STANDARD'); w(70, 0); w(40, 0); w(41, 1); w(50, 0); w(71, 0); w(42, 100); w(3, 'txt'); w(4, ''); w(0, 'ENDTAB');
  w(0, 'ENDSEC');
  const ent = (it) => {
    if (it.t === 'L') { w(0, 'LINE'); w(8, it.layer); w(10, f(it.a[0])); w(20, f(it.a[1])); w(30, 0); w(11, f(it.b[0])); w(21, f(it.b[1])); w(31, 0); }
    else if (it.t === 'A') { w(0, 'ARC'); w(8, it.layer); w(10, f(it.c[0])); w(20, f(it.c[1])); w(30, 0); w(40, f(it.r)); w(50, f(it.a0)); w(51, f(it.a1)); }
    else {
      w(0, 'TEXT'); w(8, it.layer); w(10, f(it.p[0])); w(20, f(it.p[1])); w(30, 0); w(40, f(it.h)); w(1, it.text);
      if (it.align === 'c') { w(72, 1); w(11, f(it.p[0])); w(21, f(it.p[1])); w(31, 0); }
    }
  };
  w(0, 'SECTION'); w(2, 'BLOCKS');
  for (const k of ['plan', 'elev']) {
    w(0, 'BLOCK'); w(8, '0'); w(2, names[k]); w(70, 0); w(10, 0); w(20, 0); w(30, 0); w(3, names[k]);
    for (const it of bl[k]) ent(it);
    w(0, 'ENDBLK'); w(8, '0');
  }
  w(0, 'ENDSEC');
  w(0, 'SECTION'); w(2, 'ENTITIES');
  w(0, 'INSERT'); w(8, '0'); w(2, names.plan); w(10, 0); w(20, 0); w(30, 0);
  w(0, 'INSERT'); w(8, '0'); w(2, names.elev); w(10, 0); w(20, f(S.elevDy)); w(30, 0);
  for (const [txt, x, y] of S.titles) ent({ t: 'T', layer: 'PC-ANNO', p: [x, y], h: 140, text: txt, align: 'l' });
  w(0, 'ENDSEC'); w(0, 'EOF');
  return { dxf: L.join('\r\n') + '\r\n', names };
}

// SVG of the sheet. opts.screen = true draws for the on-screen preview (hairlines thickened slightly).
export function toSVG(bl, opts = {}) {
  const S = sheetLayout(bl);
  const all = [...bl.plan, ...bl.elev.map((it) => shift(it, S.elevDy))];
  for (const [txt, x, y] of S.titles) all.push({ t: 'T', layer: 'PC-ANNO', p: [x, y], h: 140, text: txt, align: 'l', bold: true });
  const e = extent2D(all), pad = 400;
  const x0 = e[0] - pad, y0 = -(e[3] + pad), W = e[2] - e[0] + 2 * pad, H = e[3] - e[1] + 2 * pad;
  const groups = {};
  for (const it of all) (groups[it.layer] = groups[it.layer] || []).push(it);
  let body = '';
  for (const [ln, items] of Object.entries(groups)) {
    const [, lt, pen, col] = LAYERS2D[ln] || [7, 'CONTINUOUS', 0.18, '#111'];
    const sw = Math.max(pen, opts.screen ? 0.18 : 0) * 50;
    let d = '', texts = '';
    for (const it of items) {
      if (it.t === 'L') d += `M${f(it.a[0])} ${f(-it.a[1])}L${f(it.b[0])} ${f(-it.b[1])}`;
      else if (it.t === 'A') {
        let a1 = it.a1; while (a1 <= it.a0) a1 += 360;
        const sx = it.c[0] + it.r * Math.cos(it.a0 * D2R), sy = it.c[1] + it.r * Math.sin(it.a0 * D2R);
        const ex = it.c[0] + it.r * Math.cos(a1 * D2R), ey = it.c[1] + it.r * Math.sin(a1 * D2R);
        d += `M${f(sx)} ${f(-sy)}A${f(it.r)} ${f(it.r)} 0 ${a1 - it.a0 > 180 ? 1 : 0} 0 ${f(ex)} ${f(-ey)}`;
      } else {
        const esc = it.text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        texts += `<text x="${f(it.p[0])}" y="${f(-it.p[1])}" font-size="${f(it.h * 1.25)}" text-anchor="${it.align === 'c' ? 'middle' : 'start'}"${it.bold ? ' font-weight="700"' : ''}>${esc}</text>`;
      }
    }
    body += `<g data-layer="${ln}" stroke="${col}" fill="none" stroke-width="${f(sw)}" stroke-linecap="round"${lt === 'DASHED' ? ' stroke-dasharray="100 60"' : ''}>${d ? `<path d="${d}"/>` : ''}</g>`;
    if (texts) body += `<g data-layer="${ln}-text" fill="${col}" stroke="none" font-family="Noto Sans, Helvetica, Arial, sans-serif">${texts}</g>`;
  }
  const size = opts.screen ? 'width="100%" height="100%"' : `width="${f(W / 50)}mm" height="${f(H / 50)}mm"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" ${size} viewBox="${f(x0)} ${f(y0)} ${f(W)} ${f(H)}" preserveAspectRatio="xMidYMid meet"><rect x="${f(x0)}" y="${f(y0)}" width="${f(W)}" height="${f(H)}" fill="#fff"/>${body}</svg>`;
}
function shift(it, dy) {
  if (it.t === 'L') return { ...it, a: [it.a[0], it.a[1] + dy], b: [it.b[0], it.b[1] + dy] };
  if (it.t === 'A') return { ...it, c: [it.c[0], it.c[1] + dy] };
  return { ...it, p: [it.p[0], it.p[1] + dy] };
}

// Add the blocks to an existing Rhino file: plan flat at floor level under the model (lines up in Top view),
// elevation standing in a vertical plane in front of the model (lines up in Front view).
export function add2DTo3dm(rhino, bytes, bl, frontY) {
  const doc = rhino.File3dm.fromByteArray(bytes);
  const hex = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return { r, g, b, a: 255 }; };
  let count = 0;
  const parentIdx = {};
  for (const [key, label] of [['plan', '2D plan block'], ['elev', '2D elevation block']]) {
    const ly = new rhino.Layer(); ly.name = label; ly.color = { r: 20, g: 20, b: 20, a: 255 };
    parentIdx[key] = doc.layers().add(ly);
  }
  const subIdx = {};
  const layerFor = (key, ln) => {
    const k = key + ln;
    if (subIdx[k] != null) return subIdx[k];
    const ly = new rhino.Layer(); ly.name = ln; ly.color = hex(LAYERS2D[ln][3]);
    try { const par = doc.layers().findIndex(parentIdx[key]); if (par && par.id) ly.parentLayerId = par.id; else ly.name = (key === 'plan' ? 'Plan ' : 'Elev ') + ln; }
    catch (e) { ly.name = (key === 'plan' ? 'Plan ' : 'Elev ') + ln; }
    subIdx[k] = doc.layers().add(ly);
    return subIdx[k];
  };
  const P = { plan: (x, y) => [x, y, 0], elev: (x, y) => [x, frontY, y] };
  for (const key of ['plan', 'elev']) {
    for (const it of bl[key]) {
      const attr = new rhino.ObjectAttributes();
      attr.layerIndex = layerFor(key, it.layer);
      let geo = null;
      if (it.t === 'L') geo = new rhino.LineCurve(P[key](...it.a), P[key](...it.b));
      else if (it.t === 'A') {
        let a1 = it.a1; while (a1 <= it.a0) a1 += 360;
        const pts = [], n = Math.max(8, Math.ceil((a1 - it.a0) / 3));
        try {
          const s = P[key](it.c[0] + it.r * Math.cos(it.a0 * D2R), it.c[1] + it.r * Math.sin(it.a0 * D2R));
          const am = (it.a0 + a1) / 2 * D2R, m = P[key](it.c[0] + it.r * Math.cos(am), it.c[1] + it.r * Math.sin(am));
          const e = P[key](it.c[0] + it.r * Math.cos(a1 * D2R), it.c[1] + it.r * Math.sin(a1 * D2R));
          const arc = new rhino.Arc(s, m, e);
          geo = new rhino.ArcCurve(arc);
        } catch (err) {
          const pl = new rhino.Polyline(0);
          for (let i = 0; i <= n; i++) { const a = (it.a0 + (a1 - it.a0) * i / n) * D2R; pl.add(...P[key](it.c[0] + it.r * Math.cos(a), it.c[1] + it.r * Math.sin(a))); }
          geo = pl.toPolylineCurve();
        }
      } else geo = new rhino.TextDot(it.text, P[key](...it.p));
      if (geo) { doc.objects().add(geo, attr); count++; }
    }
  }
  return { bytes: doc.toByteArray(), count };
}
