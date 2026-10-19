// PlotCloud door & window generator — parametric doors and windows on the furniture generator engine.
// Units mm, Z up. X runs along the wall, Y across it: the FRONT side is -Y (exterior for exterior doors and windows).
// Origin: center of the frame, at floor level, on the wall centerline. Elevations are seen from the front.
// Code values: NBC 2020 (Part 3 exits, 3.8 accessibility, Part 9 doors and windows), CSA B651-18 clause 5.2,
// BCBC 2024 / OBC differences noted in the checks. Confirm with the code that applies to the project.
import { makeBuilder, bounds, COLORS, FIXED_MATS, paramVisible, materialColor } from 'pc-base/models.js';
export { COLORS, FIXED_MATS, paramVisible, materialColor, bounds };

const GAP = 3, STOP = 15, UNDERCUT = 10, SHIM = 12;
const r0 = (v) => Math.round(v);
const D2R = Math.PI / 180;

// ---------- shared parameters ----------
const FRAME_MATS = [['white', 'White'], ['black', 'Black'], ['steel', 'Aluminium'], ['wood', 'Wood']];
const LEAF_MATS = [['wood', 'Wood'], ['white', 'Painted'], ['steel', 'Steel'], ['black', 'Black']];
const prm = {
  W: (def, min = 610, max = 1220, label = 'Leaf width') => ({ k: 'W', label, min, max, step: 5, def }),
  H: (def, min = 1980) => ({ k: 'H', label: 'Leaf height', min, max: 2740, step: 5, def }),
  T: (def) => ({ k: 'T', label: 'Wall thickness', min: 90, max: 450, step: 5, def }),
  fd: (def) => ({ k: 'fd', label: 'Frame depth', min: 40, max: 450, step: 5, def }),
  fw: (def) => ({ k: 'fw', label: 'Frame face width', min: 25, max: 150, step: 5, def }),
  lt: (def) => ({ k: 'lt', label: 'Leaf thickness', min: 30, max: 70, step: 1, def }),
  hand: (label = 'Hinge side (seen from front)', iff) => ({ k: 'hand', label, type: 'select', options: [['L', 'Left'], ['R', 'Right']], def: 'L', if: iff }),
  hw: { k: 'hw', label: 'Handle height', min: 800, max: 1200, step: 10, def: 1000 },
  open: (iff) => ({ k: 'open', label: 'Opening in 3D view', min: 0, max: 90, step: 5, def: 30, unit: '°', if: iff }),
  frameMat: (def = 'white') => ({ k: 'frameMat', label: 'Frame finish', type: 'select', options: FRAME_MATS, def }),
  leafMat: (def = 'wood') => ({ k: 'leafMat', label: 'Leaf finish', type: 'select', options: LEAF_MATS, def }),
  wall: { k: 'wall', label: 'Show wall', type: 'bool', def: true },
  wallL: (def = 600) => ({ k: 'wallL', label: 'Wall shown each side', min: 200, max: 2500, step: 50, def, if: 'wall' }),
};

// ---------- 2D drawing primitives (plan and elevation blocks) ----------
// Layers: name → [AutoCAD color index, linetype, svg stroke width at 1:50 (mm on paper), svg color]
export const LAYERS2D = {
  'PC-WALL': [7, 'CONTINUOUS', 0.5, '#111'],
  'PC-FRAME': [4, 'CONTINUOUS', 0.35, '#111'],
  'PC-LEAF': [2, 'CONTINUOUS', 0.35, '#111'],
  'PC-GLASS': [5, 'CONTINUOUS', 0.13, '#2b6cb0'],
  'PC-SWING': [1, 'CONTINUOUS', 0.13, '#555'],
  'PC-HIDDEN': [8, 'DASHED', 0.13, '#777'],
  'PC-CLEAR': [3, 'DASHED', 0.18, '#D8402A'],
  'PC-ANNO': [7, 'CONTINUOUS', 0.13, '#333'],
};
function draw() {
  const items = [];
  return {
    items,
    L(layer, x1, y1, x2, y2) { if (Math.hypot(x2 - x1, y2 - y1) > 0.01) items.push({ t: 'L', layer, a: [x1, y1], b: [x2, y2] }); },
    R(layer, x0, y0, x1, y1) { this.PL(layer, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true); },
    PL(layer, pts, closed) {
      for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; this.L(layer, a[0], a[1], b[0], b[1]); }
    },
    // arc, angles in degrees, counter-clockwise from a0 to a1
    A(layer, cx, cy, r, a0, a1) { items.push({ t: 'A', layer, c: [cx, cy], r, a0, a1 }); },
    T(layer, x, y, h, text, align = 'c') { items.push({ t: 'T', layer, p: [x, y], h, text, align }); },
  };
}
export function extent2D(items) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const add = (x, y) => { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); };
  for (const it of items) {
    if (it.t === 'L') { add(...it.a); add(...it.b); }
    else if (it.t === 'A') {
      let a1 = it.a1; while (a1 < it.a0) a1 += 360;
      for (let a = it.a0; a <= a1 + 0.01; a += Math.min(15, a1 - it.a0 || 15)) add(it.c[0] + it.r * Math.cos(a * D2R), it.c[1] + it.r * Math.sin(a * D2R));
      add(it.c[0] + it.r * Math.cos(a1 * D2R), it.c[1] + it.r * Math.sin(a1 * D2R));
    } else { const w = it.text.length * it.h * 0.6; add(it.p[0] - (it.align === 'c' ? w / 2 : 0), it.p[1]); add(it.p[0] + (it.align === 'c' ? w / 2 : w), it.p[1] + it.h); }
  }
  return b;
}

// ---------- rigid placement of a hinged leaf / sash ----------
// Local coordinates: u along the leaf from the hinge axis, v through its thickness (v=0 is the face on the opening side), z up.
// s = +1 when the leaf runs toward +X from its hinge (hinge on the left), o = +1 when it opens toward the front (-Y).
function placer(hx, hy, s, o, angleDeg) {
  const al = angleDeg * D2R * (-s * o), c = Math.cos(al), sn = Math.sin(al);
  const map = (u, v) => { const x = s * u, y = o * v; return [hx + c * x - sn * y, hy + sn * x + c * y]; };
  return { al, map };
}
function leafBox(B, pl, name, layer, mat, u0, u1, v0, v1, z0, z1) {
  if (u1 <= u0 || v1 <= v0 || z1 <= z0) return;
  const [cx, cy] = pl.map((u0 + u1) / 2, (v0 + v1) / 2);
  B.box(name, layer, mat, cx, cy, z0, u1 - u0, v1 - v0, z1 - z0, { rot: pl.al });
}
// leaf body with optional single rectangular lite (u0,u1,z0,z1 absolute)
function leafBody(B, pl, name, mat, W, lt, z0, z1, lite, glassLayer = 'Glass') {
  if (!lite) { leafBox(B, pl, name, 'Leaf', mat, 0, W, 0, lt, z0, z1); return; }
  leafBox(B, pl, name + ' stile', 'Leaf', mat, 0, lite.u0, 0, lt, z0, z1);
  leafBox(B, pl, name + ' stile', 'Leaf', mat, lite.u1, W, 0, lt, z0, z1);
  leafBox(B, pl, name + ' rail', 'Leaf', mat, lite.u0, lite.u1, 0, lt, z0, lite.z0);
  leafBox(B, pl, name + ' rail', 'Leaf', mat, lite.u0, lite.u1, 0, lt, lite.z1, z1);
  leafBox(B, pl, 'Glazing', glassLayer, 'clearglass', lite.u0, lite.u1, lt / 2 - 6, lt / 2 + 6, lite.z0, lite.z1);
}
function liteFor(kind, W, z0, H, p) {
  if (kind === 'half') return { u0: 140, u1: W - 140, z0: z0 + H * 0.5, z1: z0 + H - 160 };
  if (kind === 'full') return { u0: 120, u1: W - 120, z0: z0 + 260, z1: z0 + H - 140 };
  if (kind === 'vision') { const u1 = W - 150, u0 = Math.max(100, u1 - p.vpW); return { u0, u1, z0: p.vpZ, z1: Math.min(z0 + H - 120, p.vpZ + p.vpH) }; }
  return null;
}
function rectMap(pl, u0, u1, v0, v1) { return [pl.map(u0, v0), pl.map(u1, v0), pl.map(u1, v1), pl.map(u0, v1)]; }

// ---------- door frame layout shared by 3D and 2D ----------
function doorFrame(p, o2) {
  const T = p.T, fd = Math.min(p.fd, T), fw = p.fw;
  const thr = o2.thr || 0;
  const leafZ0 = thr > 0 ? thr + GAP : UNDERCUT;
  const Wi = o2.Wi, Hi = o2.Hi != null ? o2.Hi : leafZ0 + p.H + GAP;
  const cols = [];
  if (o2.slL) cols.push({ w: o2.slL, kind: 'side' });
  cols.push({ w: Wi, kind: 'door' });
  if (o2.slR) cols.push({ w: o2.slR, kind: 'side' });
  const outerW = cols.reduce((a, c) => a + c.w, 0) + (cols.length + 1) * fw;
  const X0 = -outerW / 2, X1 = outerW / 2;
  let x = X0 + fw;
  for (const c of cols) { c.x0 = x; c.x1 = x + c.w; x = c.x1 + fw; }
  const tr = o2.transom || 0;
  const outerH = Hi + fw + (tr ? tr + fw : 0);
  const members = [
    { n: 'Jamb', x0: X0, x1: X0 + fw, z0: 0, z1: outerH },
    { n: 'Jamb', x0: X1 - fw, x1: X1, z0: 0, z1: outerH },
    { n: 'Head', x0: X0 + fw, x1: X1 - fw, z0: outerH - fw, z1: outerH },
  ];
  if (tr) members.push({ n: 'Transom bar', x0: X0 + fw, x1: X1 - fw, z0: Hi, z1: Hi + fw });
  for (let i = 0; i < cols.length - 1; i++) members.push({ n: 'Mullion', x0: cols[i].x1, x1: cols[i].x1 + fw, z0: 0, z1: Hi });
  for (const c of cols) if (c.kind === 'side') members.push({ n: 'Sidelight sill', x0: c.x0, x1: c.x1, z0: 0, z1: fw });
  const door = cols.find((c) => c.kind === 'door');
  const glass = cols.filter((c) => c.kind === 'side').map((c) => ({ x0: c.x0, x1: c.x1, z0: fw, z1: Hi }));
  if (tr) glass.push({ x0: X0 + fw, x1: X1 - fw, z0: Hi + fw, z1: outerH - fw });
  return { T, fd, fw, thr, leafZ0, Wi, Hi, X0, X1, outerW, outerH, members, door, glass, yF0: -fd / 2, yF1: fd / 2, cols };
}

function frame3D(B, F, mat) {
  for (const m of F.members) {
    if (m.split) {   // pocket-side jamb: split so the leaf can slide through
      const g = m.split, d = F.fd / 2 - g;
      for (const sd of [-1, 1]) B.box(m.n, 'Frame', mat, (m.x0 + m.x1) / 2, sd * (g + d / 2), m.z0, m.x1 - m.x0, d, m.z1 - m.z0);
      continue;
    }
    B.box(m.n, 'Frame', mat, (m.x0 + m.x1) / 2, 0, m.z0, m.x1 - m.x0, F.fd, m.z1 - m.z0);
  }
  for (const g of F.glass) B.box('Glazing', 'Glass', 'clearglass', (g.x0 + g.x1) / 2, 0, g.z0, g.x1 - g.x0, 12, g.z1 - g.z0);
}
function stops3D(B, F, o, lt, mat, sides = 'both') {
  const xa = F.door.x0, xb = F.door.x1;
  const yv0 = -o * F.fd / 2 + o * lt, yv1 = yv0 + o * STOP, y0 = Math.min(yv0, yv1), cy = (yv0 + yv1) / 2;
  if (y0 < -F.fd / 2 - 0.1 || Math.max(yv0, yv1) > F.fd / 2 + 0.1) return;
  if (sides !== 'none') {
    B.box('Stop', 'Frame', mat, xa + STOP / 2, cy, F.thr, STOP, STOP, F.Hi - F.thr);
    B.box('Stop', 'Frame', mat, xb - STOP / 2, cy, F.thr, STOP, STOP, F.Hi - F.thr);
  }
  B.box('Stop', 'Frame', mat, (xa + xb) / 2, cy, F.Hi - STOP, xb - xa - 2 * STOP, STOP, STOP);
}
function threshold3D(B, F) {
  if (!(F.thr > 0)) return;
  const d = F.fd + 40, bev = Math.min(2 * F.thr, d / 3);
  B.prism('Threshold', 'Threshold', 'steel', 'yz', [[-d / 2, 0], [d / 2, 0], [d / 2 - bev, F.thr], [-d / 2 + bev, F.thr]], F.door.x0, F.door.x1 - F.door.x0);
}
function wall3D(B, F, p, zBelow = 0) {
  if (!p.wall) return;
  const L = p.wallL, Hw = Math.max(F.outerH + zBelow + 350, 2700), T = F.T;
  B.box('Wall', 'Wall (context)', 'panel', F.X0 - L / 2, 0, 0, L, T, Hw);
  B.box('Wall', 'Wall (context)', 'panel', F.X1 + L / 2, 0, 0, L, T, Hw);
  B.box('Wall', 'Wall (context)', 'panel', 0, 0, F.outerH + zBelow, F.outerW, T, Hw - F.outerH - zBelow);
  if (zBelow > 0) B.box('Wall', 'Wall (context)', 'panel', 0, 0, 0, F.outerW, T, zBelow);
}

// hinged leaves of a swing door (1 or 2), returns list with placement data for 3D and 2D
function swingLeaves(F, p, n, s1, o) {
  const xa = F.door.x0, xb = F.door.x1, hy = -o * F.fd / 2;
  if (n === 2) return [{ hx: xa, hy, s: 1, o }, { hx: xb, hy, s: -1, o }];
  return [s1 > 0 ? { hx: xa, hy, s: 1, o } : { hx: xb, hy, s: -1, o }];
}

// door hardware in leaf-local coordinates
function leafHardware(B, pl, p, lf, opts) {
  const W = lf.W, lt = p.lt, z0 = lf.z0, z1 = lf.z1;
  const hw = p.hw;
  if (opts.lever !== false) for (const side of [-1, 1]) {
    const vF = side < 0 ? 0 : lt, dv = side < 0 ? -1 : 1;
    if (opts.panic && side > 0) continue;
    const va = vF + dv * 8, vb = vF + dv * 55;
    leafBox(B, pl, 'Lever rose', 'Hardware', 'steel', W - 92, W - 42, Math.min(vF, va), Math.max(vF, va), hw - 25, hw + 25);
    leafBox(B, pl, 'Lever', 'Hardware', 'steel', W - 190, W - 50, Math.min(vb - dv * 18, vb), Math.max(vb - dv * 18, vb), hw - 10, hw + 10);
    leafBox(B, pl, 'Lever neck', 'Hardware', 'steel', W - 76, W - 58, Math.min(va, vb), Math.max(va, vb), hw - 9, hw + 9);
  }
  if (opts.panic) {
    leafBox(B, pl, 'Panic bar', 'Hardware', 'steel', W * 0.22, W - 55, lt + 25, lt + 75, hw - 35, hw + 35);
    leafBox(B, pl, 'Panic bracket', 'Hardware', 'steel', W * 0.22 - 40, W * 0.22, lt, lt + 75, hw - 60, hw + 60);
    leafBox(B, pl, 'Panic latch case', 'Hardware', 'steel', W - 55, W - 20, lt, lt + 75, hw - 90, hw + 90);
  }
  if (opts.closer) {
    leafBox(B, pl, 'Closer', 'Hardware', 'black', 90, 380, -62, -2, z1 - 105, z1 - 45);
    leafBox(B, pl, 'Closer arm', 'Hardware', 'black', 380, 560, -50, -35, z1 - 30, z1 - 15);
  }
  if (opts.kick) leafBox(B, pl, 'Kick plate', 'Hardware', 'steel', 25, W - 25, lt, lt + 1.5, z0 + 5, z0 + 5 + p.kickH);
}

function leaves3D(B, F, p, defs, cfg) {
  const lfs = [];
  for (const d of defs) {
    const W = p.W, pl = placer(d.hx, d.hy, d.s, d.o, cfg.angle);
    const lf = { ...d, W, z0: F.leafZ0, z1: F.leafZ0 + p.H, u0: GAP };
    // shift so the leaf starts GAP from the jamb
    const pl2 = { al: pl.al, map: (u, v) => pl.map(u + GAP, v) };
    leafBody(B, pl2, 'Door leaf', p.leafMat, W, p.lt, lf.z0, lf.z1, cfg.lite ? cfg.lite(W, lf.z0, p.H) : null);
    leafHardware(B, pl2, p, lf, cfg.hw || {});
    lfs.push(lf);
  }
  return lfs;
}

// 2D: plan and elevation of a swing door set
function swingPlan(D, F, p, defs, panicD = 0) {
  for (const d of defs) {
    const pl = placer(d.hx, d.hy, d.s, d.o, 90);
    D.PL('PC-LEAF', rectMap({ map: (u, v) => pl.map(u + GAP, v) }, 0, p.W, 0, p.lt), true);
    const a0 = d.s > 0 ? 0 : 180, a1 = a0 + 90 * (-d.s * d.o);
    D.A('PC-SWING', d.hx, d.hy, p.W + GAP, Math.min(a0, a1), Math.max(a0, a1));
    if (panicD) D.PL('PC-LEAF', rectMap({ map: (u, v) => pl.map(u + GAP, v) }, p.W * 0.22, p.W - 55, p.lt, p.lt + panicD - 0.01), true);
  }
}
function swingElev(D, F, p, defs, lite) {
  for (const d of defs) {
    const xL = d.s > 0 ? d.hx + GAP : d.hx - GAP - p.W, xR = xL + p.W, z0 = F.leafZ0, z1 = z0 + p.H;
    D.R('PC-LEAF', xL, z0, xR, z1);
    const lt = lite ? lite(p.W, z0, p.H) : null;
    if (lt) { const a = d.s > 0 ? xL + lt.u0 : xR - lt.u1, b = d.s > 0 ? xL + lt.u1 : xR - lt.u0; D.R('PC-GLASS', a, lt.z0, b, lt.z1); }
    // opening indication: lines from the latch-side corners meet at the hinge side
    const xh = d.s > 0 ? xL : xR, xl = d.s > 0 ? xR : xL;
    D.L('PC-HIDDEN', xl, z0, xh, (z0 + z1) / 2); D.L('PC-HIDDEN', xl, z1, xh, (z0 + z1) / 2);
  }
}
function framePlan(D, F, opts = {}) {
  const { fd, fw } = F;
  for (const m of F.members.slice(0, 2)) {
    if (m.split) { D.R('PC-FRAME', m.x0, -fd / 2, m.x1, -m.split); D.R('PC-FRAME', m.x0, m.split, m.x1, fd / 2); }
    else D.R('PC-FRAME', m.x0, -fd / 2, m.x1, fd / 2);
  }
  for (let i = 0; i < F.cols.length - 1; i++) D.R('PC-FRAME', F.cols[i].x1, -fd / 2, F.cols[i].x1 + fw, fd / 2);
  for (const c of F.cols) if (c.kind === 'side') { D.L('PC-GLASS', c.x0, -6, c.x1, -6); D.L('PC-GLASS', c.x0, 6, c.x1, 6); }
  if (opts.stopsO) {
    const o = opts.stopsO, yv0 = -o * fd / 2 + o * opts.lt, yv1 = yv0 + o * STOP;
    if (Math.abs(yv1) <= fd / 2 + 0.1) {
      D.R('PC-FRAME', F.door.x0, Math.min(yv0, yv1), F.door.x0 + STOP, Math.max(yv0, yv1));
      D.R('PC-FRAME', F.door.x1 - STOP, Math.min(yv0, yv1), F.door.x1, Math.max(yv0, yv1));
    }
  }
  if (F.thr > 0) { const d = fd / 2 + 20; D.L('PC-FRAME', F.door.x0, -d, F.door.x1, -d); D.L('PC-FRAME', F.door.x0, d, F.door.x1, d); }
}
function frameElev(D, F, z0 = 0) {
  D.R('PC-FRAME', F.X0, z0, F.X1, z0 + F.outerH);
  for (const c of F.cols) {
    if (c.kind === 'door') D.PL('PC-FRAME', [[c.x0, z0], [c.x0, z0 + F.Hi], [c.x1, z0 + F.Hi], [c.x1, z0]], false);
    else { D.R('PC-FRAME', c.x0, z0, c.x1, z0 + F.Hi); D.L('PC-FRAME', c.x0, z0 + F.fw, c.x1, z0 + F.fw); }
  }
  if (F.outerH > F.Hi + F.fw + 1) D.R('PC-FRAME', F.X0 + F.fw, z0 + F.Hi + F.fw, F.X1 - F.fw, z0 + F.outerH - F.fw);
  for (const g of F.glass) D.R('PC-GLASS', g.x0 + 12, z0 + g.z0 + 12, g.x1 - 12, z0 + g.z1 - 12);
  if (F.thr > 0) D.R('PC-FRAME', F.door.x0, z0, F.door.x1, z0 + F.thr);
}
function wallPlan(D, F, p, extra = 0) {
  const T = F.T, L = Math.max(p.wall ? p.wallL : 300, extra);
  for (const [xo, dir] of [[F.X0, -1], [F.X1, 1]]) {
    const xe = xo + dir * L;
    D.L('PC-WALL', xo, -T / 2, xe, -T / 2); D.L('PC-WALL', xo, T / 2, xe, T / 2); D.L('PC-WALL', xo, -T / 2, xo, T / 2);
    D.L('PC-HIDDEN', xe, -T / 2, xe, T / 2);
  }
}
function floorLine(D, F, p) { const L = p.wall ? p.wallL : 300; D.L('PC-WALL', F.X0 - L, 0, F.X1 + L, 0); }
function dimLine(D, x0, x1, y, text) {
  D.L('PC-ANNO', x0, y, x1, y);
  for (const x of [x0, x1]) D.L('PC-ANNO', x - 25, y - 25, x + 25, y + 25);
  D.T('PC-ANNO', (x0 + x1) / 2, y + 40, 90, text);
}

// clear width of a swing door set
function swingClear(F, p, n, panicD) {
  if (n === 2) return { both: F.Wi - 2 * (p.lt + panicD), one: p.W + GAP - p.lt - panicD };
  return { both: F.Wi - p.lt - panicD - STOP, one: F.Wi - p.lt - panicD - STOP };
}

// accessible clear floor spaces (plan rectangles)
const B651 = {   // CSA B651-18 Table 5: [depth, width, beyond latch]
  front: { pull: [1500, 1700, 600], push: [1350, 1200, 300] },
  latch: { pull: [1500, 1200, 600], push: [1500, 1050, 600] },
  hinge: { pull: [1500, 1700, 600], push: [1500, 1050, 600] },
};

// ---------- shared door checks ----------
const ok = (label, pass, detail) => [label, !!pass, detail];
const mm = (v) => `${r0(v)} mm`;

// ---------- models ----------
export const MODELS = [
  // ===== Exterior door =====
  {
    id: 'ext', cat: 'Doors', name: '外门', en: 'Exterior door', colors: ['wood'],
    presets: [['3′0″ × 6′8″', { leaves: '1', W: 915, H: 2032 }], ['2′8″ × 6′8″', { leaves: '1', W: 813, H: 2032 }], ['Double 2 × 2′6″', { leaves: '2', W: 762, H: 2032 }], ['With sidelights', { leaves: '1', W: 915, side: 'both', slW: 356, glaze: 'full' }], ['Metric 900 × 2100', { leaves: '1', W: 900, H: 2100 }]],
    params: [
      { k: 'leaves', label: 'Leaves', type: 'select', options: [['1', 'Single'], ['2', 'Double']], def: '1' },
      prm.W(915), prm.H(2032),
      { k: 'swing', label: 'Opens', type: 'select', options: [['in', 'Inward'], ['out', 'Outward']], def: 'in' },
      prm.hand('Hinge side (seen from outside)', (v) => v.leaves === '1'),
      { k: 'glaze', label: 'Glazing', type: 'select', options: [['solid', 'Solid'], ['half', 'Half lite'], ['full', 'Full lite']], def: 'half' },
      { k: 'side', label: 'Sidelights', type: 'select', options: [['none', 'None'], ['one', 'One'], ['both', 'Both']], def: 'none' },
      { k: 'slW', label: 'Sidelight width', min: 250, max: 600, step: 5, def: 356, if: (v) => v.side !== 'none' },
      { k: 'transom', label: 'Transom', type: 'bool', def: false },
      { k: 'trH', label: 'Transom height', min: 250, max: 700, step: 10, def: 400, if: 'transom' },
      { k: 'thr', label: 'Threshold height', min: 0, max: 40, step: 1, def: 13 },
      { k: 'bf', label: 'On a barrier-free path', type: 'bool', def: false },
      prm.hw, prm.T(200), prm.fd(200), prm.fw(60), prm.lt(45),
      prm.frameMat('white'), prm.leafMat('white'), prm.open(), prm.wall, prm.wallL(600),
    ],
    layout(p) {
      const n = +p.leaves, o = p.swing === 'out' ? 1 : -1, s = p.hand === 'L' ? 1 : -1;
      const F = doorFrame(p, { Wi: n * p.W + (n + 1) * GAP, thr: p.thr, slL: p.side !== 'none' ? p.slW : 0, slR: p.side === 'both' ? p.slW : 0, transom: p.transom ? p.trH : 0 });
      const defs = swingLeaves(F, p, n, s, o);
      const lite = p.glaze === 'solid' ? null : (W, z0, H) => liteFor(p.glaze, W, z0, H, p);
      return { F, defs, lite, n, o, s, clear: swingClear(F, p, n, 0) };
    },
    build(p) {
      const B = makeBuilder(), Lo = this.layout(p), F = Lo.F;
      frame3D(B, F, p.frameMat); stops3D(B, F, Lo.o, p.lt, p.frameMat); threshold3D(B, F); wall3D(B, F, p);
      leaves3D(B, F, p, Lo.defs, { angle: p.open, lite: Lo.lite, hw: {} });
      return B.parts;
    },
    blocks(p) {
      const Lo = this.layout(p), F = Lo.F, P = draw(), E = draw();
      wallPlan(P, F, p); framePlan(P, F, { stopsO: Lo.o, lt: p.lt }); swingPlan(P, F, p, Lo.defs);
      dimLine(P, F.door.x0 + (Lo.n === 2 ? p.lt : (Lo.s > 0 ? p.lt : STOP)), F.door.x1 - (Lo.n === 2 ? p.lt : (Lo.s > 0 ? STOP : p.lt)), Lo.o > 0 ? F.T / 2 + 250 : -F.T / 2 - 300, `CLR ${r0(Lo.clear.both)}`);
      P.T('PC-ANNO', 0, -F.T / 2 - (Lo.o > 0 ? p.W + 350 : 450), 90, 'EXTERIOR');
      floorLine(E, F, p); frameElev(E, F); swingElev(E, F, p, Lo.defs, Lo.lite);
      return { plan: P.items, elev: E.items };
    },
    info(p) {
      const Lo = this.layout(p), F = Lo.F, leafTot = Lo.n * p.W;
      const checks = [
        ok('Dwelling entrance door ≥ 810 × 1980 (NBC 9.5.5.1)', leafTot >= 810 && p.H >= 1980, `${leafTot} × ${p.H}`),
        ok('Threshold ≤ 13 mm, bevelled (NBC 3.4.6.11, B651 5.2.6)', p.thr <= 13, mm(p.thr)),
      ];
      if (p.bf) {
        checks.push(ok('Clear width ≥ 850 mm (NBC 3.8.3.6)', (Lo.n === 2 ? Lo.clear.one : Lo.clear.both) >= 850, mm(Lo.n === 2 ? Lo.clear.one : Lo.clear.both) + (Lo.n === 2 ? ' active leaf' : '')));
        checks.push(ok('Handle 900–1100 mm high (NBC 3.8.3.6)', p.hw >= 900 && p.hw <= 1100, mm(p.hw)));
      }
      return {
        title: 'Check',
        rows: [['Frame outside W × H', `${r0(F.outerW)} × ${r0(F.outerH)}`], ['Rough opening', `${r0(F.outerW + 2 * SHIM)} × ${r0(F.outerH + SHIM)}`], ['Clear width (leaf at 90°)', Lo.n === 2 ? `${r0(Lo.clear.both)} both · ${r0(Lo.clear.one)} one leaf` : mm(Lo.clear.both)], ['Clear height', mm(F.Hi - F.thr)], ['Opening force', p.bf ? '≤ 38 N (exterior, NBC 3.8.3.6)' : '—']],
        checks,
        note: 'Most Canadian exterior doors swing in; an outswing door needs a landing outside. Clear width is measured from the face of the leaf open at 90° to the stop. NBC 2020 · CSA B651-18 · Part 9 Table 9.5.5.1 — confirm with your province (BCBC / OBC).',
      };
    },
  },
  // ===== Interior door =====
  {
    id: 'int', cat: 'Doors', name: '室内门', en: 'Interior door', colors: ['wood'],
    presets: [['2′6″ room', { op: 'swing1', W: 762, room: 'room' }], ['2′4″ bath', { op: 'swing1', W: 711, room: 'bath' }], ['Pocket 2′8″', { op: 'pocket', W: 813 }], ['Barn slider', { op: 'barn', W: 1000 }], ['Closet bi-fold', { op: 'bifold', W: 915, room: 'bath' }], ['French pair', { op: 'swing2', W: 610, glaze: 'full' }]],
    params: [
      { k: 'op', label: 'Operation', type: 'select', options: [['swing1', 'Swing'], ['swing2', 'Double swing'], ['pocket', 'Pocket'], ['barn', 'Barn slider'], ['bifold', 'Bi-fold']], def: 'swing1' },
      prm.W(762, 450, 1500, 'Leaf width'), prm.H(2032),
      { k: 'swing', label: 'Opens toward', type: 'select', options: [['front', 'Front'], ['back', 'Back']], def: 'front', if: (v) => v.op === 'swing1' || v.op === 'swing2' || v.op === 'bifold' },
      prm.hand('Hinge / slide side (seen from front)', (v) => v.op !== 'swing2'),
      { k: 'glaze', label: 'Glazing', type: 'select', options: [['solid', 'Solid'], ['half', 'Half lite'], ['full', 'Full lite']], def: 'solid', if: (v) => v.op !== 'bifold' },
      { k: 'room', label: 'Doorway serves', type: 'select', options: [['room', 'Room'], ['bath', 'Bath / closet'], ['entry', 'Entry / stair / utility'], ['bf', 'Barrier-free path']], def: 'room' },
      prm.hw, prm.T(125), prm.fd(125), prm.fw(15), prm.lt(35),
      prm.frameMat('white'), prm.leafMat('white'), prm.open(), prm.wall, prm.wallL(600),
    ],
    layout(p) {
      const op = p.op, s = p.hand === 'L' ? 1 : -1, o = p.swing === 'back' ? -1 : 1;
      if (op === 'barn') {
        const Wi = p.W - 100, Hi = UNDERCUT + p.H - 50;
        const F = doorFrame(p, { Wi, Hi });
        return { F, op, s, o, clear: Wi, n: 1 };
      }
      if (op === 'pocket') {
        const F = doorFrame(p, { Wi: p.W + GAP + 50 });
        F.members[s > 0 ? 0 : 1].split = p.lt / 2 + 8;
        return { F, op, s, o: 1, clear: F.Wi - 50 - STOP, n: 1 };
      }
      if (op === 'bifold') {
        const F = doorFrame(p, { Wi: p.W + 2 * GAP });
        return { F, op, s, o, clear: F.Wi - 2 * p.lt - 25, n: 1 };
      }
      const n = op === 'swing2' ? 2 : 1;
      const F = doorFrame(p, { Wi: n * p.W + (n + 1) * GAP });
      return { F, op, s, o, n, defs: swingLeaves(F, p, n, s, o), clear: swingClear(F, p, n, 0).both, lite: p.glaze === 'solid' ? null : (W, z0, H) => liteFor(p.glaze, W, z0, H, p) };
    },
    build(p) {
      const B = makeBuilder(), Lo = this.layout(p), F = Lo.F, fr = p.frameMat;
      const fOpen = p.open / 90;
      if (Lo.op === 'barn') {
        // cased opening, leaf hangs on the front face of the wall
        frame3D(B, F, fr); wall3D(B, F, p);
        const yL = -F.T / 2 - 20 - p.lt / 2, x0c = -p.W / 2, dx = -Lo.s * fOpen * (p.W - 60);
        const lite = p.glaze === 'solid' ? null : liteFor(p.glaze, p.W, UNDERCUT, p.H + 0, p);
        const pl = placer(x0c + dx, yL - p.lt / 2, 1, 1, 0);
        leafBody(B, pl, 'Barn door', p.leafMat, p.W, p.lt, UNDERCUT, UNDERCUT + p.H, lite);
        B.box('Track', 'Hardware', 'black', -Lo.s * (p.W - 60) / 2, yL, UNDERCUT + p.H + 30, 2 * p.W, 12, 50);
        for (const u of [120, p.W - 120]) B.box('Hanger', 'Hardware', 'black', x0c + dx + u, yL, UNDERCUT + p.H - 40, 30, 8, 100);
        B.box('Pull', 'Hardware', 'black', x0c + dx + (Lo.s > 0 ? p.W - 80 : 80), yL - p.lt / 2 - 25, p.hw - 150, 20, 30, 300);
        return B.parts;
      }
      if (Lo.op === 'pocket') {
        frame3D(B, F, fr); wall3D(B, F, { ...p, wallL: Math.max(p.wallL, p.W + 150) });
        const xh = Lo.s > 0 ? F.door.x0 : F.door.x1;          // pocket side
        const shift = fOpen * (p.W - 50);
        const xs = Lo.s > 0 ? xh + GAP - shift : xh - GAP - p.W + shift;
        const lite = p.glaze === 'solid' ? null : liteFor(p.glaze, p.W, UNDERCUT, p.H, p);
        leafBody(B, placer(xs, -p.lt / 2, 1, 1, 0), 'Pocket door', p.leafMat, p.W, p.lt, UNDERCUT, UNDERCUT + p.H, lite);
        const xp = xs + (Lo.s > 0 ? p.W - 40 : 40);
        for (const sd of [-1, 1]) B.box('Edge pull', 'Hardware', 'steel', xp, sd * (p.lt / 2 + 2), p.hw - 50, 20, 4, 100);
        // latch-side stop only
        const xl = Lo.s > 0 ? F.door.x1 - STOP / 2 : F.door.x0 + STOP / 2;
        for (const sd of [-1, 1]) B.box('Stop', 'Frame', fr, xl, sd * (p.lt / 2 + 4 + STOP / 2), 0, STOP, STOP, F.Hi);
        return B.parts;
      }
      if (Lo.op === 'bifold') {
        frame3D(B, F, fr); wall3D(B, F, p);
        const pw = p.W / 2, hx = Lo.s > 0 ? F.door.x0 + GAP : F.door.x1 - GAP, hy = -Lo.o * F.fd / 2 + Lo.o * 2;
        const ang = Math.min(80, p.open);
        const p1 = placer(hx, hy, Lo.s, Lo.o, ang);
        leafBox(B, p1, 'Bi-fold panel', 'Leaf', p.leafMat, 0, pw - 1, 0, p.lt, UNDERCUT, UNDERCUT + p.H);
        const [ex, ey] = p1.map(pw, 0);
        const p2 = { al: -p1.al, map: (u, v) => { const c = Math.cos(-p1.al), sn = Math.sin(-p1.al), x = Lo.s * u, y = Lo.o * v; return [ex + c * x - sn * y, ey + sn * x + c * y]; } };
        // second panel folds back: its local frame starts at the shared hinge, running back toward the track
        const p2b = { al: p2.al, map: (u, v) => p2.map(u, v) };
        leafBox(B, p2b, 'Bi-fold panel', 'Leaf', p.leafMat, 1, pw, 0, p.lt, UNDERCUT, UNDERCUT + p.H);
        const [kx, ky] = p2b.map(pw - 60, -1);
        B.cyl('Knob', 'Hardware', 'steel', kx, ky - Lo.o * 20, p.hw, 14, 20);
        B.box('Track', 'Hardware', 'steel', 0, hy + Lo.o * p.lt / 2, F.Hi - 30, F.Wi - 10, 30, 30);
        return B.parts;
      }
      frame3D(B, F, fr); stops3D(B, F, Lo.o, p.lt, fr);
      wall3D(B, F, p);
      leaves3D(B, F, p, Lo.defs, { angle: p.open, lite: Lo.lite, hw: {} });
      return B.parts;
    },
    blocks(p) {
      const Lo = this.layout(p), F = Lo.F, P = draw(), E = draw(), T = F.T;
      if (Lo.op === 'pocket') {
        wallPlan(P, F, p, p.W + 150); framePlan(P, F, {});
        const s = Lo.s, xh = s > 0 ? F.door.x0 : F.door.x1, xs0 = s > 0 ? xh + GAP - (p.W - 50) : xh - GAP - 50;
        // pocket cavity and the leaf in its open position (hidden inside the wall)
        const px0 = s > 0 ? xh - p.W - 20 : xh, px1 = s > 0 ? xh : xh + p.W + 20;
        P.R('PC-HIDDEN', px0, -p.lt / 2 - 12, px1, p.lt / 2 + 12);
        P.R('PC-HIDDEN', xs0, -p.lt / 2, xs0 + p.W, p.lt / 2);
        const xv0 = s > 0 ? xh : xh - 50 - GAP;
        P.R('PC-LEAF', Math.max(xs0, xv0), -p.lt / 2, Math.min(xs0 + p.W, xv0 + 50 + GAP), p.lt / 2);
        dimLine(P, s > 0 ? F.door.x0 + 50 : F.door.x0 + STOP, s > 0 ? F.door.x1 - STOP : F.door.x1 - 50, T / 2 + 250, `CLR ${r0(Lo.clear)}`);
        floorLine(E, F, p); frameElev(E, F);
        const ex0 = s > 0 ? F.door.x0 + GAP : F.door.x1 - GAP - p.W;
        E.R('PC-LEAF', ex0, UNDERCUT, ex0 + p.W, UNDERCUT + p.H);
        E.R('PC-HIDDEN', s > 0 ? F.X0 - p.W - 20 : F.X1, 0, s > 0 ? F.X0 : F.X1 + p.W + 20, F.Hi);
        const ym = UNDERCUT + p.H / 2, xm = ex0 + p.W / 2, dir = -s;
        E.L('PC-ANNO', xm - 150 * dir, ym, xm + 150 * dir, ym); E.L('PC-ANNO', xm + 150 * dir, ym, xm + 100 * dir, ym + 40); E.L('PC-ANNO', xm + 150 * dir, ym, xm + 100 * dir, ym - 40);
        return { plan: P.items, elev: E.items };
      }
      if (Lo.op === 'barn') {
        wallPlan(P, F, p, p.W); framePlan(P, F, {});
        const s = Lo.s, yL0 = -T / 2 - 20 - p.lt, yL1 = -T / 2 - 20;
        const xo = -p.W / 2 - s * (p.W - 60);
        P.R('PC-LEAF', xo, yL0, xo + p.W, yL1);
        P.R('PC-HIDDEN', -p.W / 2, yL0, p.W / 2, yL1);
        P.L('PC-HIDDEN', Math.min(xo, -p.W / 2) - 30, yL1 + 8, Math.max(xo + p.W, p.W / 2) + 30, yL1 + 8);
        dimLine(P, F.door.x0, F.door.x1, T / 2 + 250, `CLR ${r0(Lo.clear)}`);
        floorLine(E, F, p); frameElev(E, F);
        E.R('PC-LEAF', -p.W / 2, UNDERCUT, p.W / 2, UNDERCUT + p.H);
        const lt = p.glaze === 'solid' ? null : liteFor(p.glaze, p.W, UNDERCUT, p.H, p);
        if (lt) E.R('PC-GLASS', -p.W / 2 + lt.u0, lt.z0, -p.W / 2 + lt.u1, lt.z1);
        E.R('PC-LEAF', -p.W / 2 - s * (p.W - 60) - 0, UNDERCUT + p.H + 5, -p.W / 2 - s * (p.W - 60) + 2 * p.W, UNDERCUT + p.H + 55);
        return { plan: P.items, elev: E.items };
      }
      if (Lo.op === 'bifold') {
        wallPlan(P, F, p); framePlan(P, F, {});
        const pw = p.W / 2, s = Lo.s, o = Lo.o, hx = s > 0 ? F.door.x0 + GAP : F.door.x1 - GAP, hy = -o * F.fd / 2 + o * 2;
        const p1 = placer(hx, hy, s, o, 60);
        P.PL('PC-LEAF', rectMap(p1, 0, pw, 0, p.lt), true);
        const [ex, ey] = p1.map(pw, 0), c = Math.cos(-p1.al), sn = Math.sin(-p1.al);
        const m2 = (u, v) => { const x = s * u, y = o * v; return [ex + c * x - sn * y, ey + sn * x + c * y]; };
        P.PL('PC-LEAF', [m2(0, 0), m2(pw, 0), m2(pw, p.lt), m2(0, p.lt)], true);
        P.L('PC-SWING', hx, hy, hx + s * p.W, hy);
        dimLine(P, F.door.x0 + (s > 0 ? 2 * p.lt + 25 : 0), F.door.x1 - (s > 0 ? 0 : 2 * p.lt + 25), o * (T / 2 + 250), `CLR ${r0(Lo.clear)}`);
        floorLine(E, F, p); frameElev(E, F);
        const x0 = F.door.x0 + GAP;
        for (let i = 0; i < 2; i++) {
          const a = x0 + i * pw, b = a + pw, z0 = UNDERCUT, z1 = UNDERCUT + p.H;
          E.R('PC-LEAF', a, z0, b, z1);
          const xh = (i === 0) === (s > 0) ? a : b, xl = xh === a ? b : a;
          E.L('PC-HIDDEN', xl, z0, xh, (z0 + z1) / 2); E.L('PC-HIDDEN', xl, z1, xh, (z0 + z1) / 2);
        }
        return { plan: P.items, elev: E.items };
      }
      wallPlan(P, F, p); framePlan(P, F, { stopsO: Lo.o, lt: p.lt }); swingPlan(P, F, p, Lo.defs);
      dimLine(P, F.door.x0 + (Lo.n === 2 || Lo.s > 0 ? p.lt : STOP), F.door.x1 - (Lo.n === 2 ? p.lt : Lo.s > 0 ? STOP : p.lt), Lo.o > 0 ? T / 2 + 250 : -T / 2 - 300, `CLR ${r0(Lo.clear)}`);
      floorLine(E, F, p); frameElev(E, F); swingElev(E, F, p, Lo.defs, Lo.lite);
      return { plan: P.items, elev: E.items };
    },
    info(p) {
      const Lo = this.layout(p), F = Lo.F;
      const min = { room: 760, bath: 610, entry: 810, bf: 810 }[p.room];
      const doorW = Lo.op === 'swing2' ? 2 * p.W : p.W;
      const checks = [ok(`Door ≥ ${min} × 1980 (NBC Table 9.5.5.1)`, doorW >= min && p.H >= 1980, `${doorW} × ${p.H}`)];
      if (p.room === 'bf') {
        checks.push(ok('Clear width ≥ 850 mm (NBC 3.8.3.6)', Lo.clear >= 850, mm(Lo.clear)));
        checks.push(ok('Handle 900–1100 mm high (NBC 3.8.3.6)', p.hw >= 900 && p.hw <= 1100, mm(p.hw)));
        if (Lo.op === 'bifold' || Lo.op === 'barn') checks.push(ok('Operable from both sides, force ≤ 22 N (B651 5.2.8)', Lo.op === 'barn', Lo.op === 'barn' ? 'check track' : 'bi-fold not suited'));
      }
      return {
        title: 'Check',
        rows: [['Frame outside W × H', `${r0(F.outerW)} × ${r0(F.outerH)}`], ['Rough opening', `${r0(F.outerW + 2 * SHIM)} × ${r0(F.outerH + SHIM)}`], ['Clear width', mm(Lo.clear)], ['Clear height', mm(F.Hi)], ['Pocket needs', Lo.op === 'pocket' ? `${p.W + 100} mm of wall` : '—']],
        checks,
        note: 'Table 9.5.5.1 sizes apply to doors inside dwelling units. Barrier-free doorways need 850 mm clear and ≤ 22 N opening force (NBC 3.8.3.6, CSA B651-18 5.2). Confirm with your province.',
      };
    },
  },
  // ===== Exit door =====
  {
    id: 'exit', cat: 'Doors', name: '安全出口门', en: 'Exit door', colors: ['wood'],
    presets: [['3′0″ × 7′0″', { leaves: '1', W: 915, H: 2134 }], ['3′6″ × 7′0″', { leaves: '1', W: 1067, H: 2134 }], ['Pair 2 × 3′0″', { leaves: '2', W: 915, H: 2134 }], ['45 min stair door', { leaves: '1', W: 915, H: 2134, fire: '45', closer: true }]],
    params: [
      { k: 'leaves', label: 'Leaves', type: 'select', options: [['1', 'Single'], ['2', 'Double']], def: '1' },
      prm.W(915, 610, 1220), prm.H(2134),
      { k: 'travel', label: 'Exit travel toward', type: 'select', options: [['front', 'Front'], ['back', 'Back']], def: 'front' },
      { k: 'swing', label: 'Door opens toward', type: 'select', options: [['front', 'Front'], ['back', 'Back']], def: 'front' },
      prm.hand('Hinge side (seen from front)', (v) => v.leaves === '1'),
      { k: 'occ', label: 'Occupant load served', type: 'int', min: 0, max: 600, def: 60 },
      { k: 'panic', label: 'Panic bar', type: 'bool', def: true },
      { k: 'closer', label: 'Closer', type: 'bool', def: true },
      { k: 'vision', label: 'Vision panel', type: 'bool', def: true },
      { k: 'vpW', label: 'Vision panel width', min: 75, max: 400, step: 5, def: 150, if: 'vision' },
      { k: 'vpH', label: 'Vision panel height', min: 200, max: 1200, step: 10, def: 750, if: 'vision' },
      { k: 'vpZ', label: 'Vision panel bottom', min: 600, max: 1500, step: 10, def: 900, if: 'vision' },
      { k: 'fire', label: 'Fire rating', type: 'select', options: [['none', 'None'], ['20', '20 min'], ['45', '45 min'], ['60', '1 h'], ['90', '1.5 h']], def: 'none' },
      { k: 'thr', label: 'Threshold height', min: 0, max: 40, step: 1, def: 13 },
      prm.hw, prm.T(200), prm.fd(200), prm.fw(50), prm.lt(45),
      prm.frameMat('steel'), prm.leafMat('steel'), prm.open(), prm.wall, prm.wallL(600),
    ],
    layout(p) {
      const n = +p.leaves, o = p.swing === 'back' ? -1 : 1, s = p.hand === 'L' ? 1 : -1;
      const F = doorFrame(p, { Wi: n * p.W + (n + 1) * GAP, thr: p.thr });
      const panicD = p.panic ? 75 : 0;
      return { F, n, o, s, defs: swingLeaves(F, p, n, s, o), panicD, clear: swingClear(F, p, n, 0), clearPanic: swingClear(F, p, n, panicD), lite: p.vision ? (W, z0, H) => liteFor('vision', W, z0, H, p) : null };
    },
    build(p) {
      const B = makeBuilder(), Lo = this.layout(p), F = Lo.F;
      frame3D(B, F, p.frameMat); stops3D(B, F, Lo.o, p.lt, p.frameMat); threshold3D(B, F); wall3D(B, F, p);
      leaves3D(B, F, p, Lo.defs, { angle: p.open, lite: Lo.lite, hw: { panic: p.panic, closer: p.closer } });
      return B.parts;
    },
    blocks(p) {
      const Lo = this.layout(p), F = Lo.F, P = draw(), E = draw(), T = F.T;
      wallPlan(P, F, p); framePlan(P, F, { stopsO: Lo.o, lt: p.lt }); swingPlan(P, F, p, Lo.defs, Lo.panicD);
      const ay = (p.travel === 'front' ? -1 : 1) * (T / 2 + p.W + 300);
      P.L('PC-ANNO', 0, 0, 0, ay); P.L('PC-ANNO', 0, ay, -50, ay - Math.sign(ay) * 90); P.L('PC-ANNO', 0, ay, 50, ay - Math.sign(ay) * 90);
      P.T('PC-ANNO', 70, ay - Math.sign(ay) * 60, 90, 'EXIT', 'l');
      const yd = Lo.o > 0 ? T / 2 + 250 : -T / 2 - 300;
      if (Lo.n === 2) dimLine(P, F.door.x0 + p.lt, F.door.x1 - p.lt, yd, `CLR ${r0(Lo.clear.both)}`);
      else dimLine(P, Lo.s > 0 ? F.door.x0 + p.lt : F.door.x0 + STOP, Lo.s > 0 ? F.door.x1 - STOP : F.door.x1 - p.lt, yd, `CLR ${r0(Lo.clear.both)}`);
      floorLine(E, F, p); frameElev(E, F); swingElev(E, F, p, Lo.defs, Lo.lite);
      if (p.fire !== 'none') E.T('PC-ANNO', 0, F.outerH + 120, 100, `FIRE-PROTECTION RATING ${p.fire === '60' ? '1 H' : p.fire === '90' ? '1.5 H' : p.fire + ' MIN'} · LABELED`);
      return { plan: P.items, elev: E.items };
    },
    info(p) {
      const Lo = this.layout(p), F = Lo.F;
      const cw = Lo.clear.both, need = Math.max(800, Math.ceil(6.1 * p.occ));
      const leafTop = F.leafZ0 + p.H, headroom = p.closer ? leafTop - 105 : F.Hi - F.thr;
      const checks = [
        ok('Swings in the direction of exit travel (NBC 3.4.6.12)', p.travel === p.swing, p.travel === p.swing ? 'yes' : 'reverse the swing'),
        ok(`Clear width ≥ ${need} mm (800 min, 6.1 mm/person, 3.4.3.2)`, cw >= need, mm(cw)),
        ok('Clear height ≥ 2030 mm (NBC 3.4.3.4)', F.Hi - F.thr >= 2030, mm(F.Hi - F.thr)),
        ok('Closer keeps ≥ 1980 mm headroom (3.4.3.4)', headroom >= 1980, mm(headroom)),
        ok('Release hardware 900–1100 mm high (3.4.6.16)', p.hw >= 900 && p.hw <= 1100, mm(p.hw)),
        ok('Threshold ≤ 13 mm (NBC 3.4.6.11)', p.thr <= 13, mm(p.thr)),
      ];
      if (Lo.n === 2) checks.push(ok('Each leaf ≥ 610 mm (NBC 3.4.6.11)', p.W >= 610, mm(p.W)));
      if (p.fire !== 'none') checks.push(ok('Fire door is self-closing and latching (NBC 3.1.8)', p.closer, p.closer ? 'closer on' : 'add a closer'));
      if (p.vision) checks.push(ok('Vision panel bottom ≤ 900 mm (B651 5.2.10)', p.vpZ <= 900, mm(p.vpZ)));
      return {
        title: 'Check',
        rows: [['Frame outside W × H', `${r0(F.outerW)} × ${r0(F.outerH)}`], ['Rough opening', `${r0(F.outerW + 2 * SHIM)} × ${r0(F.outerH + SHIM)}`], ['Clear width (to leaf face)', Lo.n === 2 ? `${r0(cw)} both leaves` : mm(cw)], ['Clear to panic bar face', p.panic ? mm(Lo.clearPanic.both) : '—'], ['Width for occupants', `${p.occ} × 6.1 = ${r0(6.1 * p.occ)} mm`], ['Opening force', '≤ 90 N at the latch (3.4.6.16)'], ['Fire rating', p.fire === 'none' ? '—' : (p.fire === '60' ? '1 h' : p.fire === '90' ? '1.5 h' : p.fire + ' min') + ' label on hinge edge']],
        checks,
        note: p.panic ? 'Exit width is checked to the face of the open leaf; the panic bar (drawn 75 mm deep) may project into it (NBC 3.4.3.3), but CSA B651 5.2.1 measures to the panic bar face, so a barrier-free exit needs a wider leaf. Exit doors in NBC 2020 Part 3; where more than one exit is required each counts for at most half the width. Confirm with your province.' : 'Exit doors in NBC 2020 Part 3; where more than one exit is required each counts for at most half the width. Confirm with your province.',
      };
    },
  },
  // ===== Accessible door =====
  {
    id: 'acc', cat: 'Doors', name: '无障碍门', en: 'Accessible door', colors: ['wood'],
    presets: [['3′0″ × 7′0″', { op: 'swing', W: 915, H: 2134 }], ['3′6″ × 7′0″', { op: 'swing', W: 1067, H: 2134 }], ['Power operated', { op: 'swing', W: 915, power: true }], ['Sliding', { op: 'slide', W: 1000 }]],
    params: [
      { k: 'op', label: 'Operation', type: 'select', options: [['swing', 'Swing'], ['slide', 'Sliding']], def: 'swing' },
      prm.W(915, 760, 1220), prm.H(2134),
      { k: 'swing', label: 'Opens toward (pull side)', type: 'select', options: [['front', 'Front'], ['back', 'Back']], def: 'front', if: (v) => v.op === 'swing' },
      prm.hand('Hinge / slide side (seen from front)'),
      { k: 'std', label: 'Clear floor space', type: 'select', options: [['nbc', 'NBC 3.8.3.6'], ['b651', 'CSA B651 Table 5']], def: 'nbc' },
      { k: 'appr', label: 'Approach', type: 'select', options: [['front', 'Front'], ['latch', 'Latch side'], ['hinge', 'Hinge side']], def: 'front', if: (v) => v.std === 'b651' && v.op === 'swing' },
      { k: 'lsPull', label: 'Wall beyond latch, pull side', min: 0, max: 1500, step: 10, def: 600 },
      { k: 'lsPush', label: 'Wall beyond latch, push side', min: 0, max: 1500, step: 10, def: 300 },
      { k: 'exterior', label: 'Exterior door', type: 'bool', def: false },
      { k: 'power', label: 'Power door operator', type: 'bool', def: false },
      { k: 'btn', label: 'Push button from door swing', min: 300, max: 2000, step: 50, def: 900, if: 'power' },
      { k: 'kick', label: 'Kick plate', type: 'bool', def: true },
      { k: 'kickH', label: 'Kick plate height', min: 150, max: 450, step: 10, def: 300, if: 'kick' },
      { k: 'vision', label: 'Vision panel', type: 'bool', def: true },
      { k: 'vpW', label: 'Vision panel width', min: 75, max: 400, step: 5, def: 150, if: 'vision' },
      { k: 'vpH', label: 'Vision panel height', min: 200, max: 1200, step: 10, def: 900, if: 'vision' },
      { k: 'vpZ', label: 'Vision panel bottom', min: 400, max: 1500, step: 10, def: 800, if: 'vision' },
      { k: 'thr', label: 'Threshold height', min: 0, max: 40, step: 1, def: 6 },
      prm.hw, prm.T(200), prm.fd(200), prm.fw(50), prm.lt(45),
      prm.frameMat('steel'), prm.leafMat('wood'), prm.open((v) => v.op === 'swing'), prm.wall, prm.wallL(1800),
    ],
    layout(p) {
      const s = p.hand === 'L' ? 1 : -1, o = p.op === 'swing' ? (p.swing === 'back' ? -1 : 1) : 1;
      if (p.op === 'slide') {
        const F = doorFrame(p, { Wi: p.W - 60, thr: p.thr });
        return { F, op: 'slide', s, o, clear: F.Wi - STOP, n: 1 };
      }
      const F = doorFrame(p, { Wi: p.W + 2 * GAP, thr: p.thr });
      return { F, op: 'swing', s, o, n: 1, defs: swingLeaves(F, p, 1, s, o), clear: swingClear(F, p, 1, 0).both, lite: p.vision ? (W, z0, H) => liteFor('vision', W, z0, H, p) : null };
    },
    clearSpaces(p, Lo) {
      const F = Lo.F, s = Lo.s, T = F.T;
      const xh = s > 0 ? F.door.x0 : F.door.x1, xl = s > 0 ? F.door.x1 : F.door.x0;
      const pullY = Lo.o > 0 ? -1 : 1;     // pull side is the side the door opens toward
      let pull, push;
      if (Lo.op === 'slide') { pull = [1350, 1200, 300]; push = [1100, 1350, 600]; if (p.std === 'nbc') { pull = [1500, 1200, 300]; push = [1500, 1200, 300]; } }
      else if (p.std === 'b651') { pull = B651[p.appr].pull; push = B651[p.appr].push; }
      else { pull = [1500, 1700, null]; push = [1500, p.power ? 1000 : 1200, 300]; }
      const rect = (spec, side) => {
        const [dep, wid, beyond] = spec;
        let a, b;
        if (beyond == null) { a = xh; b = xh + s * wid; } else { b = xl + s * beyond; a = b - s * wid; }
        const y0 = side * T / 2, y1 = side * (T / 2 + dep);
        return { x0: Math.min(a, b), x1: Math.max(a, b), y0: Math.min(y0, y1), y1: Math.max(y0, y1), dep, wid };
      };
      return { pull: rect(pull, pullY), push: rect(push, -pullY), pullY, xl, xh };
    },
    build(p) {
      const B = makeBuilder(), Lo = this.layout(p), F = Lo.F;
      frame3D(B, F, p.frameMat); threshold3D(B, F); wall3D(B, F, p);
      if (Lo.op === 'slide') {
        const fOpen = p.open / 90, s = Lo.s, yL = -F.T / 2 - 15 - p.lt / 2;
        const x0c = -p.W / 2 - s * fOpen * (p.W - 60);
        const lite = p.vision ? liteFor('vision', p.W, F.leafZ0, p.H, p) : null;
        const pl = placer(x0c, yL - p.lt / 2, 1, 1, 0);
        leafBody(B, pl, 'Sliding leaf', p.leafMat, p.W, p.lt, F.leafZ0, F.leafZ0 + p.H, lite);
        B.box('Track cover', 'Hardware', 'steel', -s * (p.W - 60) / 2, yL, F.leafZ0 + p.H + 10, 2 * p.W, 80, 120);
        const xp = x0c + (s > 0 ? p.W - 80 : 80);
        for (const sd of [-1, 1]) B.box('D-pull', 'Hardware', 'steel', xp, yL + sd * (p.lt / 2 + 30), p.hw - 150, 22, 22, 300);
        if (p.kick) for (const sd of [-1, 1]) B.box('Kick plate', 'Hardware', 'steel', x0c + p.W / 2, yL + sd * (p.lt / 2 + 1), F.leafZ0 + 5, p.W - 50, 2, p.kickH);
      } else {
        stops3D(B, F, Lo.o, p.lt, p.frameMat);
        leaves3D(B, F, p, Lo.defs, { angle: p.open, lite: Lo.lite, hw: { closer: true, kick: p.kick } });
      }
      if (p.power && p.wall) {
        const s = Lo.s, xb = (s > 0 ? F.X1 : F.X0) + s * p.btn;
        for (const side of [-1, 1]) {
          const y = side * (F.T / 2 + 15);
          B.box('Power door button', 'Hardware', 'steel', xb, y, 900, 150, 30, 200);
          B.box('Power door button', 'Hardware', 'steel', xb, y, 150, 150, 30, 150);
        }
      }
      return B.parts;
    },
    blocks(p) {
      const Lo = this.layout(p), F = Lo.F, P = draw(), E = draw(), T = F.T, s = Lo.s;
      const C = this.clearSpaces(p, Lo);
      const need = Math.max(Math.abs(C.pull.x1), Math.abs(C.pull.x0), Math.abs(C.push.x1), Math.abs(C.push.x0)) - F.outerW / 2 + 100;
      wallPlan(P, F, p, Math.max(need, p.power ? p.btn + 300 : 0));
      if (Lo.op === 'slide') {
        framePlan(P, F, {});
        const yL0 = -T / 2 - 15 - p.lt, yL1 = -T / 2 - 15, xo = -p.W / 2 - s * (p.W - 60);
        P.R('PC-LEAF', xo, yL0, xo + p.W, yL1); P.R('PC-HIDDEN', -p.W / 2, yL0, p.W / 2, yL1);
        dimLine(P, F.door.x0 + (s > 0 ? 0 : STOP), F.door.x1 - (s > 0 ? STOP : 0), T / 2 + 200, `CLR ${r0(Lo.clear)}`);
      } else {
        framePlan(P, F, { stopsO: Lo.o, lt: p.lt }); swingPlan(P, F, p, Lo.defs);
        dimLine(P, s > 0 ? F.door.x0 + p.lt : F.door.x0 + STOP, s > 0 ? F.door.x1 - STOP : F.door.x1 - p.lt, -C.pullY * (T / 2 + 200), `CLR ${r0(Lo.clear)}`);
      }
      for (const [r, lab] of [[C.pull, 'PULL SIDE'], [C.push, 'PUSH SIDE']]) {
        P.R('PC-CLEAR', r.x0, r.y0, r.x1, r.y1);
        P.T('PC-CLEAR', (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2 + 20, 90, lab);
        P.T('PC-CLEAR', (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2 - 110, 80, `${r.wid} × ${r.dep}`);
      }
      if (p.power) {
        const xb = (s > 0 ? F.X1 : F.X0) + s * p.btn;
        for (const side of [-1, 1]) { const y = side * T / 2; P.R('PC-FRAME', xb - 75, y, xb + 75, y + side * 30); }
        P.T('PC-ANNO', xb, -T / 2 - 200, 80, 'PUSH BUTTON');
      }
      floorLine(E, F, p); frameElev(E, F);
      if (Lo.op === 'slide') {
        E.R('PC-LEAF', -p.W / 2, F.leafZ0, p.W / 2, F.leafZ0 + p.H);
        const lt = p.vision ? liteFor('vision', p.W, F.leafZ0, p.H, p) : null;
        if (lt) { const a = s > 0 ? -p.W / 2 + lt.u0 : p.W / 2 - lt.u1, b = s > 0 ? -p.W / 2 + lt.u1 : p.W / 2 - lt.u0; E.R('PC-GLASS', a, lt.z0, b, lt.z1); }
        if (p.kick) E.R('PC-LEAF', -p.W / 2 + 25, F.leafZ0 + 5, p.W / 2 - 25, F.leafZ0 + 5 + p.kickH);
      } else {
        swingElev(E, F, p, Lo.defs, Lo.lite);
        if (p.kick) { const d = Lo.defs[0], xL = d.s > 0 ? d.hx + GAP : d.hx - GAP - p.W; E.R('PC-HIDDEN', xL + 25, F.leafZ0 + 5, xL + p.W - 25, F.leafZ0 + 5 + p.kickH); }
      }
      if (p.power) { const xb = (s > 0 ? F.X1 : F.X0) + s * p.btn; E.R('PC-FRAME', xb - 75, 900, xb + 75, 1100); E.R('PC-FRAME', xb - 75, 150, xb + 75, 300); }
      E.T('PC-ANNO', 0, F.outerH + 120, 90, `HANDLE ${p.hw} AFF`);
      return { plan: P.items, elev: E.items };
    },
    info(p) {
      const Lo = this.layout(p), F = Lo.F;
      const latchPull = p.op === 'slide' ? 300 : 600, latchPush = p.op === 'slide' ? 300 : 300;
      const checks = [
        ok('Clear width ≥ 850 mm (NBC 3.8.3.6, B651 5.2.1)', Lo.clear >= 850, mm(Lo.clear)),
        ok('Handle 900–1100 mm high (NBC 3.8.3.6, B651 5.2.7)', p.hw >= 900 && p.hw <= 1100, mm(p.hw)),
        ok('Threshold ≤ 13 mm, bevelled 1:2 above 6 mm (B651 5.2.6)', p.thr <= 13, mm(p.thr)),
        ok(`Latch-side space ≥ ${latchPull} mm on the pull side (NBC 3.8.3.6)`, p.lsPull >= latchPull || p.power, p.power && p.lsPull < latchPull ? 'power operator' : mm(p.lsPull)),
        ok(`Latch-side space ≥ ${latchPush} mm on the push side (NBC 3.8.3.6)`, p.lsPush >= latchPush || p.power, p.power && p.lsPush < latchPush ? 'power operator' : mm(p.lsPush)),
      ];
      if (p.vision) checks.push(ok('Vision panel bottom ≤ 900 mm (B651 5.2.10)', p.vpZ <= 900, mm(p.vpZ)));
      if (p.power) checks.push(ok('Push button ≤ 1500 mm from the door swing (B651 5.2.9)', p.btn <= 1500 && p.btn >= 600, `${p.btn} mm (BCBC: 600–1500)`));
      const C = this.clearSpaces(p, Lo);
      return {
        title: 'Check',
        rows: [['Frame outside W × H', `${r0(F.outerW)} × ${r0(F.outerH)}`], ['Clear width', mm(Lo.clear)], ['Pull-side space', `${C.pull.wid} × ${C.pull.dep}`], ['Push-side space', `${C.push.wid} × ${C.push.dep}`], ['Opening force', p.exterior ? '≤ 38 N exterior (B651 5.2.8)' : '≤ 22 N interior (B651 5.2.8)'], ['Closer', '≥ 3 s from 90° to 12° (B651 5.2.7)'], ['Power operator', p.power ? '≥ 3 s to open, stays open ≥ 5 s, buttons at 150–300 and 900–1100 mm' : '—']],
        checks,
        note: 'The red dashed rectangles are the level clear floor spaces drawn into the plan block. NBC 2020 3.8.3.6 (BCBC 2024 same numbers) or CSA B651-18 Table 5, simplified to rectangles — see B651 Figure 19 for the exact shapes. B651 says to apply one standard in full, not mix the two.',
      };
    },
  },
  // ===== Window =====
  {
    id: 'win', cat: 'Windows', name: '窗', en: 'Window', colors: ['wood'],
    presets: [['Casement 600 × 1200', { op: 'casement', W: 600, H: 1200, units: 1 }], ['Pair 1200 × 1200', { op: 'casement', W: 1200, H: 1200, units: 2 }], ['Slider 1500 × 1200', { op: 'sliding', W: 1500, H: 1200, units: 1 }], ['Double hung', { op: 'dhung', W: 900, H: 1500, units: 1, mc: 2, mr: 1 }], ['Tilt-turn', { op: 'tilt', W: 800, H: 1400, units: 1, pos: 'mid' }], ['Bedroom egress', { op: 'casement', W: 700, H: 1100, sill: 900, egress: true }]],
    params: [
      { k: 'op', label: 'Type', type: 'select', options: [['fixed', 'Fixed'], ['casement', 'Casement'], ['awning', 'Awning'], ['sliding', 'Sliding'], ['shung', 'Single hung'], ['dhung', 'Double hung'], ['tilt', 'Tilt-turn']], def: 'casement' },
      { k: 'W', label: 'Frame width', min: 400, max: 4000, step: 10, def: 1200 },
      { k: 'H', label: 'Frame height', min: 400, max: 3000, step: 10, def: 1200 },
      { k: 'sill', label: 'Sill height above floor', min: 0, max: 2200, step: 10, def: 900 },
      { k: 'units', label: 'Units across', type: 'int', min: 1, max: 4, def: 2 },
      prm.hand('Hinge side (seen from outside)', (v) => v.op === 'casement' || v.op === 'tilt' || v.op === 'sliding'),
      { k: 'mc', label: 'Muntins across (per pane)', type: 'int', min: 0, max: 6, def: 0 },
      { k: 'mr', label: 'Muntins up (per pane)', type: 'int', min: 0, max: 6, def: 0 },
      { k: 'pos', label: 'Position in wall', type: 'select', options: [['ext', 'Outside'], ['mid', 'Centre'], ['int', 'Inside']], def: 'ext' },
      { k: 'extSill', label: 'Exterior sill', type: 'bool', def: true },
      { k: 'stool', label: 'Interior stool', type: 'bool', def: false },
      { k: 'egress', label: 'Bedroom egress window', type: 'bool', def: false },
      { k: 'high', label: 'Floor > 1800 mm above grade', type: 'bool', def: false },
      { k: 'limiter', label: 'Opening limiter', type: 'bool', def: false, if: 'high' },
      prm.T(200), { k: 'fd', label: 'Frame depth', min: 50, max: 250, step: 5, def: 100 },
      { k: 'fw', label: 'Frame face width', min: 30, max: 120, step: 5, def: 55 },
      { k: 'sw', label: 'Sash face width', min: 30, max: 120, step: 5, def: 55 },
      prm.frameMat('white'), prm.open((v) => v.op === 'casement' || v.op === 'tilt' || v.op === 'sliding' || v.op === 'shung' || v.op === 'dhung'),
      prm.wall, prm.wallL(600),
    ],
    layout(p) {
      const T = p.T, fd = Math.min(p.fd, T), fw = p.fw, sw = p.sw, n = p.units;
      const yF0 = p.pos === 'ext' ? -T / 2 : p.pos === 'int' ? T / 2 - fd : -fd / 2, yF1 = yF0 + fd;
      const X0 = -p.W / 2, X1 = p.W / 2, Z0 = p.sill, Z1 = p.sill + p.H;
      const uw = (p.W - (n + 1) * fw) / n;
      const cells = [];
      for (let i = 0; i < n; i++) { const x0 = X0 + fw + i * (uw + fw); cells.push({ x0, x1: x0 + uw, z0: Z0 + fw, z1: Z1 - fw }); }
      const members = [{ n: 'Jamb', x0: X0, x1: X0 + fw, z0: Z0, z1: Z1 }, { n: 'Jamb', x0: X1 - fw, x1: X1, z0: Z0, z1: Z1 }, { n: 'Head', x0: X0 + fw, x1: X1 - fw, z0: Z1 - fw, z1: Z1 }, { n: 'Sill', x0: X0 + fw, x1: X1 - fw, z0: Z0, z1: Z0 + fw }];
      for (let i = 0; i < n - 1; i++) members.push({ n: 'Mullion', x0: cells[i].x1, x1: cells[i].x1 + fw, z0: Z0 + fw, z1: Z1 - fw });
      const sd = Math.min(60, fd - 10), ym = (yF0 + yF1) / 2;
      // sashes: {x0,x1,z0,z1,y0,y1, hinge:'L'|'R'|'T'|null, kind}
      const sashes = [], glass = [];
      const s = p.hand === 'L' ? 1 : -1;
      cells.forEach((c, i) => {
        const cw = c.x1 - c.x0, ch = c.z1 - c.z0;
        // alternate hinge sides on pairs so they open like a French casement
        const hs = n === 2 ? (i === 0 ? 1 : -1) : s;
        if (p.op === 'fixed') glass.push({ x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1, y: ym });
        else if (p.op === 'casement' || p.op === 'awning') sashes.push({ ...c, y0: yF0 + 5, y1: yF0 + 5 + sd, hs, kind: p.op, o: 1 });
        else if (p.op === 'tilt') sashes.push({ ...c, y0: yF1 - 5 - sd, y1: yF1 - 5, hs, kind: 'tilt', o: -1 });
        else if (p.op === 'sliding') {
          const tw = Math.min(45, (fd - 15) / 2), half = cw / 2 + 15;
          const mov = hs > 0 ? 'R' : 'L';      // the operable sash slides toward the hinge-side label
          sashes.push({ x0: c.x0, x1: c.x0 + half, z0: c.z0, z1: c.z1, y0: ym + 2, y1: ym + 2 + tw, kind: 'slide', moving: mov === 'L' });
          sashes.push({ x0: c.x1 - half, x1: c.x1, z0: c.z0, z1: c.z1, y0: ym - 2 - tw, y1: ym - 2, kind: 'slide', moving: mov === 'R' });
        } else {
          const tw = Math.min(45, (fd - 15) / 2), half = ch / 2 + 15;
          sashes.push({ x0: c.x0, x1: c.x1, z0: c.z1 - half, z1: c.z1, y0: ym - 2 - tw, y1: ym - 2, kind: 'hungTop', moving: p.op === 'dhung' });
          sashes.push({ x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z0 + half, y0: ym + 2, y1: ym + 2 + tw, kind: 'hungBot', moving: true });
        }
      });
      return { T, fd, fw, sw, yF0, yF1, X0, X1, Z0, Z1, cells, members, sashes, glass, ym, sd };
    },
    clearOpening(p, Lo) {
      // largest unobstructed opening of one operable unit, assuming egress hardware opening to 90°
      const c = Lo.cells[0], cw = c.x1 - c.x0, ch = c.z1 - c.z0;
      const op = p.op;
      if (op === 'fixed') return { w: 0, h: 0 };
      if (op === 'casement' || op === 'tilt') return { w: cw - Lo.sd, h: ch };
      if (op === 'awning') return { w: cw, h: ch - Lo.sd };
      if (op === 'sliding') return { w: cw / 2 - 15 - Lo.sw, h: ch - 2 * Lo.sw };
      return { w: cw - 2 * Lo.sw, h: ch / 2 - 15 - Lo.sw };
    },
    build(p) {
      const B = makeBuilder(), Lo = this.layout(p), fm = p.frameMat, fdy = (Lo.yF0 + Lo.yF1) / 2;
      for (const m of Lo.members) B.box(m.n, 'Frame', fm, (m.x0 + m.x1) / 2, fdy, m.z0, m.x1 - m.x0, Lo.fd, m.z1 - m.z0);
      for (const g of Lo.glass) { B.box('Glazing', 'Glass', 'clearglass', (g.x0 + g.x1) / 2, g.y, g.z0, g.x1 - g.x0, 24, g.z1 - g.z0); muntins3D(B, p, g.x0, g.x1, g.z0, g.z1, g.y, 30); }
      const f = p.open / 90;
      for (const sh of Lo.sashes) {
        const t = sh.y1 - sh.y0, w = sh.x1 - sh.x0;
        if (sh.kind === 'casement' || sh.kind === 'tilt') {
          const hx = sh.hs > 0 ? sh.x0 : sh.x1, hy = sh.o > 0 ? sh.y0 : sh.y1;
          const pl = placer(hx, hy, sh.hs, sh.o, p.open);
          sash3D(B, p, pl, w, t, sh.z0, sh.z1, Lo.sw);
          const [kx, ky] = pl.map(w - Lo.sw / 2, sh.o > 0 ? t + 25 : -25);
          if (sh.kind === 'tilt') B.box('Handle', 'Hardware', 'steel', kx, ky, (sh.z0 + sh.z1) / 2 - 80, 22, 30, 160);
          else B.box('Crank', 'Hardware', 'steel', (sh.x0 + sh.x1) / 2, Lo.yF1 + 20, Lo.Z0 + Lo.fw + 10, 60, 40, 30);
        } else if (sh.kind === 'awning') {
          sash3D(B, p, placer(sh.x0, sh.y0, 1, 1, 0), w, t, sh.z0, sh.z1, Lo.sw);
          B.box('Crank', 'Hardware', 'steel', (sh.x0 + sh.x1) / 2, Lo.yF1 + 20, Lo.Z0 + Lo.fw + 10, 60, 40, 30);
        } else {
          let dx = 0, dz = 0;
          if (sh.moving && sh.kind === 'slide') dx = (sh.x0 < (Lo.X0 + Lo.X1) / 2 ? 1 : -1) * f * (w - 60);
          if (sh.moving && sh.kind === 'hungBot') dz = f * ((sh.z1 - sh.z0) - 40);
          if (sh.moving && sh.kind === 'hungTop' && f > 0) dz = 0;
          sash3D(B, p, placer(sh.x0 + dx, sh.y0, 1, 1, 0), w, t, sh.z0 + dz, sh.z1 + dz, Lo.sw);
          if (sh.kind === 'hungBot') B.box('Sash lock', 'Hardware', 'steel', (sh.x0 + sh.x1) / 2 + dx, sh.y1 + 10, sh.z1 + dz - 30, 80, 20, 25);
        }
      }
      if (p.extSill) B.box('Exterior sill', 'Sill', fm, 0, -Lo.T / 2 - 40 + (Lo.yF0 + Lo.T / 2 + 40 + 20) / 2, Lo.Z0 - 30, p.W + 80, Lo.yF0 + Lo.T / 2 + 60, 30);
      if (p.stool) B.box('Interior stool', 'Sill', 'wood', 0, (Lo.yF1 + Lo.T / 2 + 30) / 2, Lo.Z0 - 20, p.W + 80, Lo.T / 2 + 30 - Lo.yF1, 20);
      if (p.wall) {
        const F = { X0: Lo.X0, X1: Lo.X1, outerW: p.W, outerH: p.H, T: Lo.T };
        const L = p.wallL, Hw = Math.max(Lo.Z1 + 350, 2700);
        B.box('Wall', 'Wall (context)', 'panel', F.X0 - L / 2, 0, 0, L, Lo.T, Hw);
        B.box('Wall', 'Wall (context)', 'panel', F.X1 + L / 2, 0, 0, L, Lo.T, Hw);
        B.box('Wall', 'Wall (context)', 'panel', 0, 0, Lo.Z1, p.W, Lo.T, Hw - Lo.Z1);
        if (Lo.Z0 > 0) B.box('Wall', 'Wall (context)', 'panel', 0, 0, 0, p.W, Lo.T, Lo.Z0);
      }
      return B.parts;
    },
    blocks(p) {
      const Lo = this.layout(p), P = draw(), E = draw(), T = Lo.T, L = p.wall ? p.wallL : 300;
      // plan (cut through the window)
      for (const [xo, dir] of [[Lo.X0, -1], [Lo.X1, 1]]) {
        const xe = xo + dir * L;
        P.L('PC-WALL', xo, -T / 2, xe, -T / 2); P.L('PC-WALL', xo, T / 2, xe, T / 2); P.L('PC-WALL', xo, -T / 2, xo, T / 2); P.L('PC-HIDDEN', xe, -T / 2, xe, T / 2);
      }
      for (const m of Lo.members) if (m.n !== 'Head' && m.n !== 'Sill') P.R('PC-FRAME', m.x0, Lo.yF0, m.x1, Lo.yF1);
      for (const c of Lo.cells) { P.L('PC-HIDDEN', c.x0, Lo.yF0, c.x1, Lo.yF0); P.L('PC-HIDDEN', c.x0, Lo.yF1, c.x1, Lo.yF1); }
      for (const g of Lo.glass) { P.L('PC-GLASS', g.x0, g.y - 8, g.x1, g.y - 8); P.L('PC-GLASS', g.x0, g.y + 8, g.x1, g.y + 8); }
      const sashSeen = new Set();
      for (const sh of Lo.sashes) {
        if (sh.kind === 'hungTop' || sh.kind === 'hungBot') { const k = sh.kind + sh.x0; if (sashSeen.has(k)) continue; sashSeen.add(k); }
        P.R('PC-LEAF', sh.x0, sh.y0, sh.x1, sh.y1);
        const ym = (sh.y0 + sh.y1) / 2;
        P.L('PC-GLASS', sh.x0 + Lo.sw, ym, sh.x1 - Lo.sw, ym);
        if (sh.kind === 'casement' || sh.kind === 'tilt') {
          const w = sh.x1 - sh.x0, hx = sh.hs > 0 ? sh.x0 : sh.x1, hy = sh.o > 0 ? sh.y0 : sh.y1;
          const pl = placer(hx, hy, sh.hs, sh.o, 90);
          P.PL('PC-SWING', rectMap(pl, 0, w, 0, sh.y1 - sh.y0), true);
          const a0 = sh.hs > 0 ? 0 : 180, a1 = a0 + 90 * (-sh.hs * sh.o);
          P.A('PC-SWING', hx, hy, w, Math.min(a0, a1), Math.max(a0, a1));
        }
      }
      if (p.extSill) P.R('PC-FRAME', Lo.X0 - 40, -T / 2 - 40, Lo.X1 + 40, Lo.yF0);
      if (p.stool) P.R('PC-FRAME', Lo.X0 - 40, Lo.yF1, Lo.X1 + 40, T / 2 + 30);
      P.T('PC-ANNO', 0, -T / 2 - (p.op === 'casement' ? Math.max(...Lo.cells.map((c) => c.x1 - c.x0)) + 250 : 300), 90, 'EXTERIOR');
      // elevation from outside
      E.L('PC-WALL', Lo.X0 - L, 0, Lo.X1 + L, 0);
      E.R('PC-FRAME', Lo.X0, Lo.Z0, Lo.X1, Lo.Z1);
      for (const c of Lo.cells) E.R('PC-FRAME', c.x0, c.z0, c.x1, c.z1);
      for (const g of Lo.glass) { E.R('PC-GLASS', g.x0 + 15, g.z0 + 15, g.x1 - 15, g.z1 - 15); muntins2D(E, p, g.x0, g.x1, g.z0, g.z1); }
      for (const sh of Lo.sashes) {
        E.R('PC-LEAF', sh.x0, sh.z0, sh.x1, sh.z1);
        const gx0 = sh.x0 + Lo.sw, gx1 = sh.x1 - Lo.sw, gz0 = sh.z0 + Lo.sw, gz1 = sh.z1 - Lo.sw;
        E.R('PC-GLASS', gx0, gz0, gx1, gz1); muntins2D(E, p, gx0, gx1, gz0, gz1);
        const zm = (sh.z0 + sh.z1) / 2, xm = (sh.x0 + sh.x1) / 2;
        if (sh.kind === 'casement' || sh.kind === 'tilt') {
          const xh = sh.hs > 0 ? sh.x0 : sh.x1, xl = sh.hs > 0 ? sh.x1 : sh.x0;
          E.L('PC-HIDDEN', xl, sh.z0, xh, zm); E.L('PC-HIDDEN', xl, sh.z1, xh, zm);
          if (sh.kind === 'tilt') { E.L('PC-HIDDEN', sh.x0, sh.z1, xm, sh.z0); E.L('PC-HIDDEN', sh.x1, sh.z1, xm, sh.z0); }
        } else if (sh.kind === 'awning') { E.L('PC-HIDDEN', sh.x0, sh.z0, xm, sh.z1); E.L('PC-HIDDEN', sh.x1, sh.z0, xm, sh.z1); }
        else if (sh.kind === 'slide' && sh.moving) {
          const d = sh.x0 < 0 ? 1 : -1; E.L('PC-ANNO', xm - 120 * d, zm, xm + 120 * d, zm); E.L('PC-ANNO', xm + 120 * d, zm, xm + 70 * d, zm + 40); E.L('PC-ANNO', xm + 120 * d, zm, xm + 70 * d, zm - 40);
        } else if (sh.moving && (sh.kind === 'hungBot' || sh.kind === 'hungTop')) {
          const d = sh.kind === 'hungBot' ? 1 : -1; E.L('PC-ANNO', xm, zm - 100 * d, xm, zm + 100 * d); E.L('PC-ANNO', xm, zm + 100 * d, xm - 40, zm + 55 * d); E.L('PC-ANNO', xm, zm + 100 * d, xm + 40, zm + 55 * d);
        }
      }
      if (p.extSill) E.R('PC-FRAME', Lo.X0 - 40, Lo.Z0 - 30, Lo.X1 + 40, Lo.Z0);
      E.T('PC-ANNO', Lo.X1 + 120, Lo.Z0 - 45, 90, `SILL ${p.sill} AFF`, 'l');
      return { plan: P.items, elev: E.items };
    },
    info(p) {
      const Lo = this.layout(p), co = this.clearOpening(p, Lo), area = (co.w * co.h) / 1e6;
      const operable = p.op !== 'fixed';
      const hwZ = p.op === 'casement' || p.op === 'awning' ? p.sill + p.fw + 25 : p.sill + p.H / 2;
      const checks = [];
      if (p.egress) {
        checks.push(ok('Opening ≥ 0.35 m² (NBC 9.9.10.1)', area >= 0.35, `${area.toFixed(2)} m²`));
        checks.push(ok('No opening dimension < 380 mm (NBC 9.9.10.1)', co.w >= 380 && co.h >= 380, `${r0(co.w)} × ${r0(co.h)}`));
        checks.push(ok('Sill ≤ 1000 mm above floor (OBC 9.9.10.1; check province)', p.sill <= 1000, mm(p.sill)));
      }
      if (p.high && operable) checks.push(ok('Sill ≥ 900 mm, or limiter (100 mm sphere) or guard (NBC 9.8.8.1)', p.sill >= 900 || p.limiter, p.sill >= 900 ? mm(p.sill) : p.limiter ? 'limiter' : mm(p.sill)));
      if (operable) checks.push(ok('Operating hardware 400–1200 mm, if accessible (B651 4.2)', hwZ >= 400 && hwZ <= 1200, mm(hwZ)));
      return {
        title: 'Check',
        rows: [['Frame W × H', `${p.W} × ${p.H}`], ['Rough opening', `${p.W + 2 * SHIM} × ${p.H + 2 * SHIM}`], ['Head height', mm(Lo.Z1)], ['Glass per unit', `${r0(Lo.cells[0].x1 - Lo.cells[0].x0)} × ${r0(Lo.cells[0].z1 - Lo.cells[0].z0)}`], ['Clear opening (one unit)', operable ? `${r0(co.w)} × ${r0(co.h)} = ${area.toFixed(2)} m²` : 'fixed']],
        checks,
        note: 'Clear opening assumes hardware that opens the sash fully (90° for casements, awnings and tilt-turns). Elevation is seen from outside; dashed lines point to the hinge. NBC 2020 Part 9 · CSA B651-18 4.2. Confirm with your province.',
      };
    },
  },
];

function sash3D(B, p, pl, w, t, z0, z1, sw) {
  const m = p.frameMat;
  leafBox(B, pl, 'Sash stile', 'Sash', m, 0, sw, 0, t, z0, z1);
  leafBox(B, pl, 'Sash stile', 'Sash', m, w - sw, w, 0, t, z0, z1);
  leafBox(B, pl, 'Sash rail', 'Sash', m, sw, w - sw, 0, t, z0, z0 + sw);
  leafBox(B, pl, 'Sash rail', 'Sash', m, sw, w - sw, 0, t, z1 - sw, z1);
  leafBox(B, pl, 'Glazing', 'Glass', 'clearglass', sw, w - sw, t / 2 - 12, t / 2 + 12, z0 + sw, z1 - sw);
  const gw = w - 2 * sw, gh = z1 - z0 - 2 * sw;
  for (let i = 1; i <= p.mc; i++) leafBox(B, pl, 'Muntin', 'Muntins', m, sw + gw * i / (p.mc + 1) - 10, sw + gw * i / (p.mc + 1) + 10, t / 2 - 15, t / 2 + 15, z0 + sw, z1 - sw);
  for (let i = 1; i <= p.mr; i++) leafBox(B, pl, 'Muntin', 'Muntins', m, sw, w - sw, t / 2 - 15, t / 2 + 15, z0 + sw + gh * i / (p.mr + 1) - 10, z0 + sw + gh * i / (p.mr + 1) + 10);
}
function muntins3D(B, p, x0, x1, z0, z1, y, d) {
  for (let i = 1; i <= p.mc; i++) { const x = x0 + (x1 - x0) * i / (p.mc + 1); B.box('Muntin', 'Muntins', p.frameMat, x, y, z0, 20, d, z1 - z0); }
  for (let i = 1; i <= p.mr; i++) { const z = z0 + (z1 - z0) * i / (p.mr + 1); B.box('Muntin', 'Muntins', p.frameMat, (x0 + x1) / 2, y, z - 10, x1 - x0, d, 20); }
}
function muntins2D(E, p, x0, x1, z0, z1) {
  for (let i = 1; i <= p.mc; i++) { const x = x0 + (x1 - x0) * i / (p.mc + 1); E.L('PC-GLASS', x - 10, z0, x - 10, z1); E.L('PC-GLASS', x + 10, z0, x + 10, z1); }
  for (let i = 1; i <= p.mr; i++) { const z = z0 + (z1 - z0) * i / (p.mr + 1); E.L('PC-GLASS', x0, z - 10, x1, z - 10); E.L('PC-GLASS', x0, z + 10, x1, z + 10); }
}

export const CATS = ['Doors', 'Windows'];

export function defaults(model) {
  const v = {};
  for (const q of model.params) v[q.k] = q.def;
  for (const c of model.colors) v['color_' + c] = COLORS[c][0][0];
  return v;
}

// No normalising: the origin stays at the frame center, floor level, wall centerline.
export function buildModel(model, values) {
  const parts = model.build(values);
  const frame = parts.filter((q) => q.layer === 'Frame');
  const b = bounds(frame.length ? frame : parts);
  return { parts, box: b, dims: { W: Math.round(b[3] - b[0]), D: Math.round(b[4] - b[1]), H: Math.round(b[5] - b[2]) } };
}

// 2D blocks: plan (looking down, front at the bottom) and elevation (from the front), both in mm.
export function buildBlocks(model, values) { return model.blocks(values); }
