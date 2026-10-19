// PlotCloud furniture configurator — parametric base models.
// Units: millimetres. Axes: Z up, X = width, Y = depth, front faces -Y.
// After building, every model is moved so the origin sits at the bottom centre of its footprint.

export const COLORS = {
  fabric: [
    ['#d6ccbd', '燕麦'], ['#5d6168', '石墨灰'], ['#8ea2b5', '雾蓝'], ['#7f866a', '橄榄绿'], ['#a35d49', '砖红'],
  ],
  wood: [
    ['#d9c4a0', '白橡'], ['#6f4c34', '胡桃'], ['#efeee9', '白色烤漆'], ['#2e2e2f', '黑色'],
  ],
};

export const FIXED_MATS = {
  white: '#f1f1ee', steel: '#b9bdc1', black: '#2a2b2d', ceramic: '#f6f6f3', glass: '#1d242b',
  mattress: '#ebe6dc', stone: '#d9d6cf', burner: '#4a4a4a', mirror: '#cdd7dc', clearglass: '#bfd4dc', panel: '#d5d7d8',
  concrete: '#c8c6c0', rail: '#3a3c3e',
  bookA: '#8c3b2e', bookB: '#2f4f6b', bookC: '#c9a227', bookD: '#5a6b4f', bookE: '#d8d2c4',
};

// ---------- part helpers ----------
export function makeBuilder() {
  const parts = [];
  return {
    parts,
    // box with bottom at z0
    box(name, layer, mat, cx, cy, z0, w, d, h, o = {}) {
      if (w <= 0 || d <= 0 || h <= 0) return;
      parts.push({ kind: 'box', name, layer, mat, cx, cy, cz: z0 + h / 2, w, d, h, round: o.r || 0, rotZ: o.rot || 0 });
    },
    // vertical cylinder with bottom at z0. o.ry = elliptical depth radius, o.taper = bottom radius factor
    cyl(name, layer, mat, cx, cy, z0, r, h, o = {}) {
      if (r <= 0 || h <= 0) return;
      parts.push({ kind: 'cyl', axis: 'z', name, layer, mat, cx, cy, cz: z0 + h / 2, r, ry: o.ry || r, taper: o.taper || 1, h, seg: o.seg || 32 });
    },
    // cylinder lying along Y (pointing to the front), centred at (cx,cy,cz)
    cylY(name, layer, mat, cx, cy, cz, r, len, o = {}) {
      parts.push({ kind: 'cyl', axis: 'y', name, layer, mat, cx, cy, cz, r, ry: r, taper: 1, h: len, seg: o.seg || 32 });
    },
    // planar polygon extruded by t. plane 'xy' → extrude along z from a0; 'xz' → along y; 'yz' → along x. pts are [u,v] in that plane
    prism(name, layer, mat, plane, pts, a0, t) {
      if (pts.length < 3 || t <= 0) return;
      parts.push({ kind: 'prism', name, layer, mat, plane, pts, a0, t, cx: 0, cy: 0, cz: 0 });
    },
    // round bar along a 3D polyline
    tube(name, layer, mat, pts, r) {
      if (pts.length < 2) return;
      parts.push({ kind: 'tube', name, layer, mat, pts, r, cx: 0, cy: 0, cz: 0 });
    },
  };
}

function partBounds(p) {
  if (p.kind === 'prism') {
    const us = p.pts.map((q) => q[0]), vs = p.pts.map((q) => q[1]);
    const u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
    const b = p.plane === 'xy' ? [u0, v0, p.a0, u1, v1, p.a0 + p.t]
      : p.plane === 'xz' ? [u0, p.a0, v0, u1, p.a0 + p.t, v1]
      : [p.a0, u0, v0, p.a0 + p.t, u1, v1];
    return [b[0] + p.cx, b[1] + p.cy, b[2] + p.cz, b[3] + p.cx, b[4] + p.cy, b[5] + p.cz];
  }
  if (p.kind === 'tube') {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const q of p.pts) for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], q[i] - p.r); b[i + 3] = Math.max(b[i + 3], q[i] + p.r); }
    return [b[0] + p.cx, b[1] + p.cy, b[2] + p.cz, b[3] + p.cx, b[4] + p.cy, b[5] + p.cz];
  }
  if (p.kind === 'box') {
    const c = Math.cos(p.rotZ), s = Math.sin(p.rotZ);
    const hx = Math.abs(c) * p.w / 2 + Math.abs(s) * p.d / 2;
    const hy = Math.abs(s) * p.w / 2 + Math.abs(c) * p.d / 2;
    return [p.cx - hx, p.cy - hy, p.cz - p.h / 2, p.cx + hx, p.cy + hy, p.cz + p.h / 2];
  }
  if (p.axis === 'y') return [p.cx - p.r, p.cy - p.h / 2, p.cz - p.r, p.cx + p.r, p.cy + p.h / 2, p.cz + p.r];
  return [p.cx - p.r, p.cy - p.ry, p.cz - p.h / 2, p.cx + p.r, p.cy + p.ry, p.cz + p.h / 2];
}

export function bounds(parts) {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    const q = partBounds(p);
    for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], q[i]); b[i + 3] = Math.max(b[i + 3], q[i + 3]); }
  }
  return b;
}

export function normalise(parts) {
  const b = bounds(parts);
  const ox = (b[0] + b[3]) / 2, oy = (b[1] + b[4]) / 2, oz = b[2];
  for (const p of parts) { p.cx -= ox; p.cy -= oy; p.cz -= oz; }
  return parts;
}

const n = (v) => Math.round(v);

// ---------- models ----------
export const MODELS = [
  // ===== Bedroom =====
  {
    id: 'bed', cat: '卧室', name: '床', en: 'Bed', colors: ['fabric', 'wood'],
    presets: [
      ['Twin 单人', { W: 990, L: 1905 }], ['Double', { W: 1370, L: 1905 }], ['Queen', { W: 1520, L: 2030 }],
      ['King', { W: 1930, L: 2030 }], ['1.5 m', { W: 1500, L: 2000 }], ['1.8 m', { W: 1800, L: 2000 }],
    ],
    params: [
      { k: 'W', label: '床垫宽', min: 800, max: 2200, step: 10, def: 1520 },
      { k: 'L', label: '床垫长', min: 1800, max: 2200, step: 10, def: 2030 },
      { k: 'frameH', label: '床架高', min: 200, max: 450, step: 10, def: 300 },
      { k: 'mat', label: '床垫厚', min: 150, max: 350, step: 10, def: 250 },
      { k: 'legH', label: '床脚高', min: 0, max: 150, step: 10, def: 80 },
      { k: 'head', label: '床头板', type: 'bool', def: true },
      { k: 'headH', label: '床头板高', min: 700, max: 1400, step: 10, def: 1050, if: 'head' },
      { k: 'pillows', label: '枕头', type: 'int', min: 0, max: 4, def: 2 },
      { k: 'duvet', label: '被子', type: 'bool', def: true },
    ],
    build(p) {
      const B = makeBuilder();
      const fw = p.W + 60, fl = p.L + 60;
      if (p.legH > 0) for (const sx of [-1, 1]) for (const sy of [-1, 1])
        B.cyl('Leg', 'Frame', 'wood', sx * (fw / 2 - 60), sy * (fl / 2 - 60), 0, 25, p.legH);
      B.box('Bed frame', 'Frame', 'wood', 0, 0, p.legH, fw, fl, Math.max(40, p.frameH - p.legH), { r: 6 });
      B.box('Mattress', 'Mattress', 'mattress', 0, 0, p.frameH, p.W, p.L, p.mat, { r: 40 });
      const top = p.frameH + p.mat;
      if (p.head) B.box('Headboard', 'Headboard', 'fabric', 0, fl / 2 + 30, 0, fw, 60, Math.max(p.headH, top + 150), { r: 25 });
      if (p.pillows > 0) {
        const pw = Math.min(700, (p.W - 100) / p.pillows - 20);
        for (let i = 0; i < p.pillows; i++) {
          const x = -p.W / 2 + 50 + (pw + 20) * (i + 0.5);
          B.box('Pillow', 'Bedding', 'mattress', x, p.L / 2 - 260, top, pw, 400, 130, { r: 55 });
        }
      }
      if (p.duvet) B.box('Duvet', 'Bedding', 'fabric', 0, -p.L / 2 + p.L * 0.31 - 10, top, p.W + 20, p.L * 0.62, 40, { r: 18 });
      return B.parts;
    },
  },
  {
    id: 'nightstand', cat: '卧室', name: '床头柜', en: 'Nightstand', colors: ['wood'],
    params: [
      { k: 'W', label: '宽', min: 350, max: 650, step: 10, def: 450 },
      { k: 'D', label: '深', min: 300, max: 500, step: 10, def: 400 },
      { k: 'H', label: '高', min: 450, max: 700, step: 10, def: 550 },
      { k: 'drawers', label: '抽屉数', type: 'int', min: 1, max: 3, def: 2 },
      { k: 'legH', label: '脚高', min: 0, max: 200, step: 10, def: 100 },
    ],
    build(p) {
      const B = makeBuilder();
      if (p.legH > 0) for (const sx of [-1, 1]) for (const sy of [-1, 1])
        B.cyl('Leg', 'Frame', 'wood', sx * (p.W / 2 - 40), sy * (p.D / 2 - 40), 0, 16, p.legH);
      const bodyH = p.H - p.legH;
      B.box('Carcass', 'Carcass', 'wood', 0, 9, p.legH, p.W, p.D - 18, bodyH, { r: 3 });
      const fh = (bodyH - 6) / p.drawers - 6;
      for (let i = 0; i < p.drawers; i++) {
        const z = p.legH + 6 + i * (fh + 6);
        B.box('Drawer front', 'Fronts', 'wood', 0, -p.D / 2 + 9, z, p.W - 12, 18, fh, { r: 2 });
        B.box('Handle', 'Hardware', 'steel', 0, -p.D / 2 - 8, z + fh - 45, 120, 14, 14);
      }
      return B.parts;
    },
  },
  {
    id: 'wardrobe', cat: '卧室', name: '衣柜', en: 'Wardrobe', colors: ['wood'],
    params: [
      { k: 'W', label: '宽', min: 600, max: 2400, step: 10, def: 1200 },
      { k: 'D', label: '深', min: 500, max: 650, step: 10, def: 600 },
      { k: 'H', label: '高', min: 1800, max: 2700, step: 10, def: 2100 },
      { k: 'doors', label: '门数', type: 'int', min: 1, max: 4, def: 2 },
      { k: 'plinth', label: '踢脚高', min: 0, max: 150, step: 10, def: 80 },
    ],
    build(p) {
      const B = makeBuilder();
      if (p.plinth > 0) B.box('Plinth', 'Carcass', 'black', 0, 30, 0, p.W - 40, p.D - 80, p.plinth);
      B.box('Carcass', 'Carcass', 'wood', 0, 10, p.plinth, p.W, p.D - 20, p.H - p.plinth);
      const dw = (p.W - 4) / p.doors - 4;
      for (let i = 0; i < p.doors; i++) {
        const x = -p.W / 2 + 4 + (dw + 4) * (i + 0.5);
        B.box('Door', 'Fronts', 'wood', x, -p.D / 2 + 10, p.plinth + 2, dw, 20, p.H - p.plinth - 4, { r: 2 });
        let hx = x < -1 ? x + dw / 2 - 50 : x - dw / 2 + 50;
        if (p.doors === 1) hx = x + dw / 2 - 50;
        B.box('Handle', 'Hardware', 'steel', hx, -p.D / 2 - 12, p.plinth + 900, 20, 24, 320);
      }
      return B.parts;
    },
  },
  // ===== Living =====
  {
    id: 'sofa', cat: '客厅', name: '沙发', en: 'Sofa', colors: ['fabric'],
    presets: [['单人', { seats: 1 }], ['双人', { seats: 2 }], ['三人', { seats: 3 }], ['四人', { seats: 4 }]],
    params: [
      { k: 'seats', label: '座位数', type: 'int', min: 1, max: 4, def: 3 },
      { k: 'sw', label: '单座宽', min: 500, max: 800, step: 10, def: 620 },
      { k: 'D', label: '深', min: 780, max: 1050, step: 10, def: 900 },
      { k: 'seatH', label: '座高', min: 380, max: 480, step: 5, def: 430 },
      { k: 'backH', label: '靠背高', min: 680, max: 950, step: 10, def: 820 },
      { k: 'armW', label: '扶手宽', min: 80, max: 300, step: 10, def: 180 },
      { k: 'armH', label: '扶手高', min: 500, max: 720, step: 10, def: 620 },
      { k: 'legH', label: '脚高', min: 0, max: 200, step: 10, def: 120 },
      { k: 'cushions', label: '分座垫和靠枕', type: 'bool', def: true },
    ],
    build(p) {
      const B = makeBuilder();
      const inner = p.seats * p.sw, L = inner + 2 * p.armW, backT = 220, cushT = 140;
      if (p.legH > 0) for (const sx of [-1, 1]) for (const sy of [-1, 1])
        B.cyl('Leg', 'Legs', 'wood', sx * (L / 2 - 60), sy * (p.D / 2 - 60), 0, 20, p.legH, { taper: 0.7 });
      const baseH = Math.max(60, p.seatH - cushT - p.legH);
      B.box('Seat base', 'Body', 'fabric', 0, -backT / 2, p.legH, inner, p.D - backT, baseH, { r: 15 });
      const sz = p.legH + baseH, ch = p.seatH - sz;
      if (p.cushions) {
        for (let i = 0; i < p.seats; i++) {
          const x = -inner / 2 + p.sw * (i + 0.5);
          B.box('Seat cushion', 'Cushions', 'fabric', x, -backT / 2, sz, p.sw - 8, p.D - backT - 10, ch, { r: 45 });
          B.box('Back cushion', 'Cushions', 'fabric', x, p.D / 2 - backT - 80, p.seatH,
            p.sw - 30, 160, Math.max(150, Math.min(p.backH - p.seatH - 40, 520)), { r: 60 });
        }
      } else {
        B.box('Seat cushion', 'Cushions', 'fabric', 0, -backT / 2, sz, inner - 8, p.D - backT - 10, ch, { r: 45 });
      }
      B.box('Back', 'Body', 'fabric', 0, p.D / 2 - backT / 2, p.legH, inner, backT, p.backH - p.legH, { r: 30 });
      for (const sx of [-1, 1])
        B.box('Arm', 'Body', 'fabric', sx * (inner / 2 + p.armW / 2), 0, p.legH, p.armW, p.D, p.armH - p.legH, { r: Math.min(35, p.armW / 2 - 2) });
      return B.parts;
    },
  },
  {
    id: 'coffee', cat: '客厅', name: '茶几', en: 'Coffee table', colors: ['wood'],
    params: [
      { k: 'shape', label: '形状', type: 'select', options: [['rect', '矩形'], ['round', '圆形']], def: 'rect' },
      { k: 'L', label: '长 / 直径', min: 600, max: 1400, step: 10, def: 1100 },
      { k: 'W', label: '宽', min: 400, max: 800, step: 10, def: 600, if: (p) => p.shape === 'rect' },
      { k: 'H', label: '高', min: 300, max: 480, step: 10, def: 400 },
      { k: 'shelf', label: '下层隔板', type: 'bool', def: true },
    ],
    build(p) {
      const B = makeBuilder();
      const t = 30, lt = 40;
      if (p.shape === 'round') {
        const R = p.L / 2;
        B.cyl('Top', 'Top', 'wood', 0, 0, p.H - t, R, t, { seg: 64 });
        for (let k = 0; k < 4; k++) {
          const a = Math.PI / 4 + k * Math.PI / 2, rr = R * 0.62;
          B.box('Leg', 'Legs', 'wood', Math.cos(a) * rr, Math.sin(a) * rr, 0, lt, lt, p.H - t);
        }
        if (p.shelf) B.cyl('Shelf', 'Top', 'wood', 0, 0, 120, R * 0.62 + 20, 18, { seg: 64 });
      } else {
        B.box('Top', 'Top', 'wood', 0, 0, p.H - t, p.L, p.W, t, { r: 3 });
        for (const sx of [-1, 1]) for (const sy of [-1, 1])
          B.box('Leg', 'Legs', 'wood', sx * (p.L / 2 - 40 - lt / 2), sy * (p.W / 2 - 40 - lt / 2), 0, lt, lt, p.H - t);
        if (p.shelf) B.box('Shelf', 'Top', 'wood', 0, 0, 120, p.L - 80 - 2 * lt, p.W - 80, 18);
      }
      return B.parts;
    },
  },
  {
    id: 'tvstand', cat: '客厅', name: '电视柜', en: 'TV stand', colors: ['wood'],
    params: [
      { k: 'W', label: '宽', min: 1000, max: 2400, step: 10, def: 1800 },
      { k: 'D', label: '深', min: 350, max: 500, step: 10, def: 400 },
      { k: 'H', label: '高', min: 400, max: 650, step: 10, def: 450 },
      { k: 'tv', label: '电视', type: 'bool', def: true },
      { k: 'size', label: '电视尺寸', type: 'select', options: [['55', '55 寸'], ['65', '65 寸'], ['75', '75 寸']], def: '65', if: 'tv' },
    ],
    build(p) {
      const B = makeBuilder();
      const legH = 100;
      for (const sx of [-1, 1]) for (const sy of [-1, 1])
        B.cyl('Leg', 'Frame', 'wood', sx * (p.W / 2 - 50), sy * (p.D / 2 - 50), 0, 16, legH);
      B.box('Carcass', 'Carcass', 'wood', 0, 9, legH, p.W, p.D - 18, p.H - legH, { r: 3 });
      const nd = Math.max(2, Math.round(p.W / 600)), dw = (p.W - 4) / nd - 4;
      for (let i = 0; i < nd; i++)
        B.box('Door', 'Fronts', 'wood', -p.W / 2 + 4 + (dw + 4) * (i + 0.5), -p.D / 2 + 9, legH + 4, dw, 18, p.H - legH - 8, { r: 2 });
      if (p.tv) {
        const tvs = { 55: [1230, 710], 65: [1450, 830], 75: [1670, 960] }[p.size];
        B.box('TV foot', 'TV', 'black', 0, 20, p.H, 420, 220, 10);
        B.box('TV neck', 'TV', 'black', 0, 50, p.H + 10, 70, 30, 90);
        B.box('TV screen', 'TV', 'glass', 0, 50, p.H + 70, tvs[0], 28, tvs[1], { r: 3 });
      }
      return B.parts;
    },
  },
  {
    id: 'bookshelf', cat: '客厅', name: '书架', en: 'Bookshelf', colors: ['wood'],
    params: [
      { k: 'W', label: '宽', min: 400, max: 1800, step: 10, def: 900 },
      { k: 'D', label: '深', min: 250, max: 420, step: 10, def: 300 },
      { k: 'H', label: '高', min: 800, max: 2400, step: 10, def: 1800 },
      { k: 'shelves', label: '中间层板', type: 'int', min: 1, max: 8, def: 4 },
      { k: 't', label: '板厚', min: 18, max: 40, step: 1, def: 22 },
      { k: 'back', label: '背板', type: 'bool', def: true },
      { k: 'books', label: '示意书本', type: 'bool', def: true },
    ],
    build(p) {
      const B = makeBuilder();
      const t = p.t;
      for (const sx of [-1, 1]) B.box('Side', 'Carcass', 'wood', sx * (p.W / 2 - t / 2), 0, 0, t, p.D, p.H);
      B.box('Top', 'Carcass', 'wood', 0, 0, p.H - t, p.W - 2 * t, p.D, t);
      B.box('Bottom', 'Carcass', 'wood', 0, 0, 0, p.W - 2 * t, p.D, t);
      if (p.back) B.box('Back panel', 'Carcass', 'wood', 0, p.D / 2 - 4, t, p.W - 2 * t, 8, p.H - 2 * t);
      const sp = (p.H - t) / (p.shelves + 1);
      for (let k = 1; k <= p.shelves; k++) B.box('Shelf', 'Shelves', 'wood', 0, 0, k * sp, p.W - 2 * t, p.D - 10, t);
      if (p.books) {
        let seed = 7;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        const mats = ['bookA', 'bookB', 'bookC', 'bookD', 'bookE'];
        for (let k = 0; k <= p.shelves; k++) {
          const z0 = k === 0 ? t : k * sp + t, clear = sp - t;
          if (clear < 150) continue;
          let x = -p.W / 2 + t + 8;
          const xEnd = -p.W / 2 + t + (p.W - 2 * t) * (0.45 + rnd() * 0.3);
          while (x < xEnd) {
            const bt = 18 + rnd() * 26, bh = Math.min(clear - 25, 190 + rnd() * 110);
            B.box('Book', 'Books', mats[Math.floor(rnd() * mats.length)], x + bt / 2, -5, z0, bt, Math.min(p.D - 50, 220), bh);
            x += bt + 1;
          }
        }
      }
      return B.parts;
    },
  },
  // ===== Dining & study =====
  {
    id: 'dining', cat: '餐厅与书房', name: '餐桌', en: 'Dining table', colors: ['wood'],
    params: [
      { k: 'shape', label: '形状', type: 'select', options: [['rect', '矩形'], ['round', '圆形']], def: 'rect' },
      { k: 'L', label: '长 / 直径', min: 800, max: 2600, step: 10, def: 1600 },
      { k: 'W', label: '宽', min: 700, max: 1100, step: 10, def: 900, if: (p) => p.shape === 'rect' },
      { k: 'H', label: '高', min: 700, max: 780, step: 5, def: 750 },
      { k: 'topT', label: '桌面厚', min: 20, max: 60, step: 2, def: 30 },
      { k: 'base', label: '桌腿', type: 'select', options: [['legs', '四腿'], ['pedestal', '中心底座']], def: 'legs' },
      { k: 'legT', label: '腿粗', min: 40, max: 100, step: 5, def: 60 },
    ],
    build(p) {
      const B = makeBuilder();
      const legH = p.H - p.topT;
      if (p.shape === 'round') B.cyl('Top', 'Top', 'wood', 0, 0, legH, p.L / 2, p.topT, { seg: 72 });
      else B.box('Top', 'Top', 'wood', 0, 0, legH, p.L, p.W, p.topT, { r: 3 });
      if (p.base === 'pedestal') {
        const pos = p.shape === 'rect' && p.L > 1400 ? [-p.L / 4, p.L / 4] : [0];
        const baseR = Math.min(p.shape === 'rect' ? p.W : p.L, 1000) * 0.32;
        for (const x of pos) {
          B.cyl('Pedestal base', 'Base', 'wood', x, 0, 0, baseR, 30, { seg: 48 });
          B.cyl('Pedestal column', 'Base', 'wood', x, 0, 30, p.legT, legH - 30);
        }
      } else if (p.shape === 'round') {
        for (let k = 0; k < 4; k++) {
          const a = Math.PI / 4 + k * Math.PI / 2, rr = p.L / 2 * 0.62;
          B.box('Leg', 'Base', 'wood', Math.cos(a) * rr, Math.sin(a) * rr, 0, p.legT, p.legT, legH);
        }
      } else {
        const inset = 60;
        for (const sx of [-1, 1]) for (const sy of [-1, 1])
          B.box('Leg', 'Base', 'wood', sx * (p.L / 2 - inset - p.legT / 2), sy * (p.W / 2 - inset - p.legT / 2), 0, p.legT, p.legT, legH);
      }
      return B.parts;
    },
  },
  {
    id: 'chair', cat: '餐厅与书房', name: '餐椅', en: 'Dining chair', colors: ['wood', 'fabric'],
    params: [
      { k: 'sw', label: '座宽', min: 400, max: 560, step: 5, def: 450 },
      { k: 'sd', label: '座深', min: 400, max: 560, step: 5, def: 460 },
      { k: 'sh', label: '座高', min: 420, max: 480, step: 5, def: 450 },
      { k: 'bh', label: '总高', min: 750, max: 1050, step: 10, def: 850 },
      { k: 'legT', label: '腿粗', min: 25, max: 50, step: 1, def: 35 },
      { k: 'seatMat', label: '座面', type: 'select', options: [['fabric', '软包'], ['wood', '实木']], def: 'fabric' },
    ],
    build(p) {
      const B = makeBuilder();
      const t = p.legT, st = 40, lz = p.sh - st;
      const xs = p.sw / 2 - t / 2 - 8, ys = p.sd / 2 - t / 2 - 8;
      for (const sx of [-1, 1]) {
        B.box('Front leg', 'Frame', 'wood', sx * xs, -ys, 0, t, t, lz);
        B.box('Back leg', 'Frame', 'wood', sx * xs, ys, 0, t, t, p.bh);
      }
      B.box('Apron', 'Frame', 'wood', 0, -ys, lz - 70, 2 * xs - t, 20, 70);
      B.box('Apron', 'Frame', 'wood', 0, ys, lz - 70, 2 * xs - t, 20, 70);
      for (const sx of [-1, 1]) B.box('Apron', 'Frame', 'wood', sx * xs, 0, lz - 70, 20, 2 * ys - t, 70);
      B.box('Seat', 'Seat', p.seatMat, 0, 0, lz, p.sw, p.sd, st, { r: p.seatMat === 'fabric' ? 12 : 3 });
      B.box('Back rail', 'Frame', 'wood', 0, ys, p.bh - 170, 2 * xs - t, 22, 150, { r: 6 });
      B.box('Back rail', 'Frame', 'wood', 0, ys, p.sh + 120, 2 * xs - t, 22, 40);
      return B.parts;
    },
  },
  {
    id: 'desk', cat: '餐厅与书房', name: '电脑桌', en: 'Computer desk', colors: ['wood'],
    params: [
      { k: 'L', label: '长', min: 900, max: 1800, step: 10, def: 1400 },
      { k: 'D', label: '深', min: 500, max: 800, step: 10, def: 650 },
      { k: 'H', label: '高', min: 680, max: 760, step: 5, def: 740 },
      { k: 'pedestal', label: '抽屉柜', type: 'bool', def: true },
      { k: 'monitor', label: '显示器和键盘', type: 'bool', def: true },
      { k: 'size', label: '显示器', type: 'select', options: [['24', '24 寸'], ['27', '27 寸'], ['32', '32 寸']], def: '27', if: 'monitor' },
    ],
    build(p) {
      const B = makeBuilder();
      const tt = 25, under = p.H - tt;
      B.box('Desktop', 'Top', 'wood', 0, 0, under, p.L, p.D, tt, { r: 3 });
      for (const sx of [-1, 1]) B.box('Side panel', 'Frame', 'wood', sx * (p.L / 2 - 30), 0, 0, 25, p.D - 40, under);
      B.box('Modesty panel', 'Frame', 'wood', 0, p.D / 2 - 50, under - 320, p.L - 85, 18, 300);
      if (p.pedestal && p.L >= 1000) {
        const pw = 400, px = p.L / 2 - 42.5 - pw / 2 - 5, pd = p.D - 100, ph = under - 40;
        B.box('Drawer unit', 'Drawers', 'wood', px, 10, 30, pw, pd, ph);
        const fh = (ph - 8) / 3 - 6;
        for (let i = 0; i < 3; i++) {
          const z = 30 + 6 + i * (fh + 6);
          B.box('Drawer front', 'Drawers', 'wood', px, 10 - pd / 2 - 9, z, pw - 8, 18, fh, { r: 2 });
          B.box('Handle', 'Hardware', 'steel', px, 10 - pd / 2 - 26, z + fh - 40, 140, 16, 14);
        }
      }
      if (p.monitor) {
        const ms = { 24: [540, 320], 27: [615, 365], 32: [710, 420] }[p.size];
        const my = Math.min(p.D / 2 - 160, 150);
        B.box('Monitor base', 'Devices', 'black', 0, my + 30, p.H, 230, 180, 12, { r: 4 });
        B.box('Monitor arm', 'Devices', 'black', 0, my + 60, p.H + 12, 50, 26, 150);
        B.box('Monitor screen', 'Devices', 'glass', 0, my + 30, p.H + 110, ms[0], 24, ms[1], { r: 4 });
        B.box('Keyboard', 'Devices', 'black', 0, -p.D / 2 + 170, p.H, 440, 135, 22, { r: 4 });
        B.box('Mouse', 'Devices', 'black', 300, -p.D / 2 + 170, p.H, 62, 110, 35, { r: 25 });
      }
      return B.parts;
    },
  },
  {
    id: 'office', cat: '餐厅与书房', name: '办公椅', en: 'Office chair', colors: ['fabric'],
    params: [
      { k: 'sh', label: '座高', min: 400, max: 560, step: 5, def: 470 },
      { k: 'sw', label: '座宽', min: 440, max: 560, step: 5, def: 500 },
      { k: 'bh', label: '总高', min: 900, max: 1300, step: 10, def: 1100 },
      { k: 'arms', label: '扶手', type: 'bool', def: true },
    ],
    build(p) {
      const B = makeBuilder();
      const sd = 480;
      for (let k = 0; k < 5; k++) {
        const a = Math.PI / 2 + k * 2 * Math.PI / 5;
        B.box('Base leg', 'Base', 'black', Math.cos(a) * 165, Math.sin(a) * 165, 55, 330, 50, 35, { rot: a, r: 10 });
        B.cyl('Caster', 'Base', 'black', Math.cos(a) * 310, Math.sin(a) * 310, 0, 28, 55, { seg: 20 });
      }
      B.cyl('Hub', 'Base', 'black', 0, 0, 50, 45, 50);
      B.cyl('Gas lift', 'Base', 'steel', 0, 0, 100, 25, Math.max(50, p.sh - 200));
      B.box('Mechanism', 'Base', 'black', 0, 0, p.sh - 100, 220, 220, 30, { r: 6 });
      B.box('Seat', 'Seat', 'fabric', 0, 0, p.sh - 70, p.sw, sd, 70, { r: 30 });
      B.box('Back support', 'Base', 'black', 0, sd / 2 + 10, p.sh - 100, 60, 30, 270, { r: 8 });
      B.box('Backrest', 'Seat', 'fabric', 0, sd / 2 + 35, p.sh + 120, p.sw - 20, 60, p.bh - p.sh - 120, { r: 28 });
      if (p.arms) for (const sx of [-1, 1]) {
        B.box('Arm post', 'Arms', 'black', sx * (p.sw / 2 + 25), 0, p.sh - 70, 30, 60, 250, { r: 6 });
        B.box('Arm pad', 'Arms', 'black', sx * (p.sw / 2 + 25), -20, p.sh + 180, 75, 250, 26, { r: 12 });
      }
      return B.parts;
    },
  },
  // ===== Kitchen & appliances =====
  {
    id: 'kitchen', cat: '厨房与家电', name: '橱柜', en: 'Kitchen cabinets', colors: ['wood'],
    params: [
      { k: 'L', label: '总长', min: 1200, max: 4200, step: 50, def: 2400 },
      { k: 'D', label: '台面深', min: 550, max: 700, step: 10, def: 620 },
      { k: 'H', label: '台面高', min: 850, max: 950, step: 5, def: 900 },
      { k: 'sink', label: '水槽', type: 'bool', def: true },
      { k: 'cooktop', label: '灶台', type: 'bool', def: true },
      { k: 'dishwasher', label: '洗碗机', type: 'bool', def: true },
      { k: 'uppers', label: '吊柜', type: 'bool', def: true },
    ],
    build(p) {
      const B = makeBuilder();
      const m = Math.max(2, Math.round(p.L / 600)), mw = p.L / m, cd = p.D - 20, cy = 10, ch = p.H - 40 - 100;
      const front = cy - cd / 2;
      B.box('Plinth', 'Carcass', 'black', 0, cy + 25, 0, p.L, cd - 50, 100);
      B.box('Base carcass', 'Carcass', 'wood', 0, cy, 100, p.L, cd, ch);
      const xs = (i) => -p.L / 2 + mw * (i + 0.5);
      const ci = m >= 3 ? 1 : 0, si = m - 1;
      const hasSink = p.sink && !(p.cooktop && si === ci);
      let di = -1;
      if (p.dishwasher) for (const c of [si - 1, si - 2, 0, si]) if (c >= 0 && c < m && !(p.cooktop && c === ci) && !(hasSink && c === si)) { di = c; break; }
      for (let i = 0; i < m; i++) {
        if (i === di) {
          B.box('Dishwasher front', 'Appliances', 'steel', xs(i), front - 10, 102, mw - 4, 20, ch - 4, { r: 3 });
          B.box('Dishwasher handle', 'Appliances', 'steel', xs(i), front - 32, p.H - 40 - 90, mw - 120, 22, 22, { r: 8 });
          continue;
        }
        B.box('Base door', 'Fronts', 'wood', xs(i), front - 9, 102, mw - 4, 18, ch - 4, { r: 2 });
        B.box('Handle', 'Hardware', 'steel', xs(i), front - 28, p.H - 40 - 70, mw * 0.5, 18, 14);
      }
      B.box('Countertop', 'Countertop', 'stone', 0, 0, p.H - 40, p.L, p.D, 40, { r: 3 });
      if (hasSink) {
        B.box('Sink rim', 'Fixtures', 'steel', xs(si), -20, p.H, Math.min(mw - 100, 760), 460, 4);
        B.box('Sink basin', 'Fixtures', 'glass', xs(si), -20, p.H + 4, Math.min(mw - 160, 700), 400, 1);
        B.cyl('Faucet', 'Fixtures', 'steel', xs(si), p.D / 2 - 90, p.H, 16, 260);
        B.box('Spout', 'Fixtures', 'steel', xs(si), p.D / 2 - 170, p.H + 240, 28, 180, 22, { r: 6 });
      }
      if (p.cooktop) {
        const cw = Math.min(mw - 40, 580);
        B.box('Cooktop', 'Fixtures', 'glass', xs(ci), -20, p.H, cw, 510, 6, { r: 4 });
        for (const [dx, dy, r] of [[-1, -1, 90], [1, -1, 70], [-1, 1, 70], [1, 1, 90]])
          B.cyl('Burner', 'Fixtures', 'burner', xs(ci) + dx * cw / 4, -20 + dy * 120, p.H + 6, r, 2, { seg: 40 });
      }
      if (p.uppers) {
        B.box('Wall carcass', 'Wall units', 'wood', 0, p.D / 2 - 175, 1450, p.L, 350, 720);
        for (let i = 0; i < m; i++)
          B.box('Wall door', 'Wall units', 'wood', xs(i), p.D / 2 - 350 - 9, 1452, mw - 4, 18, 716, { r: 2 });
      }
      return B.parts;
    },
  },
  {
    id: 'fridge', cat: '厨房与家电', name: '冰箱', en: 'Refrigerator', colors: [],
    params: [
      { k: 'type', label: '类型', type: 'select', options: [['bottom', '上冷藏下冷冻'], ['french', '法式对开门'], ['single', '单门']], def: 'french' },
      { k: 'W', label: '宽', min: 550, max: 910, step: 5, def: 760 },
      { k: 'D', label: '深', min: 600, max: 800, step: 5, def: 720 },
      { k: 'H', label: '高', min: 1450, max: 1850, step: 10, def: 1780 },
    ],
    build(p) {
      const B = makeBuilder();
      const dd = 60, bodyD = p.D - dd, fy = -p.D / 2 + dd / 2, hy = -p.D / 2 - 18;
      B.box('Body', 'Body', 'white', 0, dd / 2, 0, p.W, bodyD, p.H, { r: 8 });
      const dz = 520;
      const handle = (x, z, h, horiz) => horiz
        ? B.box('Handle', 'Hardware', 'steel', x, hy, z, Math.min(p.W - 160, 500), 26, 26, { r: 8 })
        : B.box('Handle', 'Hardware', 'steel', x, hy, z, 26, 26, h, { r: 8 });
      if (p.type === 'single') {
        B.box('Door', 'Doors', 'white', 0, fy, 10, p.W - 6, dd - 4, p.H - 20, { r: 6 });
        handle(p.W / 2 - 60, p.H / 2 - 200, 600);
      } else {
        B.box('Freezer drawer', 'Doors', 'white', 0, fy, 10, p.W - 6, dd - 4, dz - 14, { r: 6 });
        handle(0, dz - 90, 0, true);
        if (p.type === 'french') {
          for (const sx of [-1, 1]) {
            B.box('Door', 'Doors', 'white', sx * (p.W / 4), fy, dz + 2, p.W / 2 - 6, dd - 4, p.H - dz - 12, { r: 6 });
            handle(sx * 40, dz + 120, Math.min(700, p.H - dz - 300));
          }
        } else {
          B.box('Door', 'Doors', 'white', 0, fy, dz + 2, p.W - 6, dd - 4, p.H - dz - 12, { r: 6 });
          handle(p.W / 2 - 60, dz + 120, Math.min(700, p.H - dz - 300));
        }
      }
      return B.parts;
    },
  },
  {
    id: 'range', cat: '厨房与家电', name: '灶台烤箱', en: 'Range', colors: [],
    params: [
      { k: 'W', label: '宽', min: 600, max: 910, step: 5, def: 760 },
      { k: 'D', label: '深', min: 600, max: 720, step: 5, def: 650 },
      { k: 'H', label: '高', min: 880, max: 950, step: 5, def: 915 },
      { k: 'back', label: '后挡板', type: 'bool', def: true },
    ],
    build(p) {
      const B = makeBuilder();
      B.box('Body', 'Body', 'steel', 0, 0, 0, p.W, p.D, p.H - 8, { r: 4 });
      B.box('Glass top', 'Cooktop', 'glass', 0, 0, p.H - 8, p.W, p.D, 8, { r: 3 });
      for (const [dx, dy, r] of [[-1, -1, 95], [1, -1, 75], [-1, 1, 75], [1, 1, 95]])
        B.cyl('Burner', 'Cooktop', 'burner', dx * p.W / 4.2, dy * p.D / 5, p.H, r, 2, { seg: 40 });
      const doorTop = p.H - 180;
      B.box('Oven door', 'Oven', 'steel', 0, -p.D / 2 - 12, 120, p.W - 20, 24, doorTop - 120, { r: 4 });
      B.box('Oven window', 'Oven', 'glass', 0, -p.D / 2 - 25, 220, p.W - 180, 3, doorTop - 340);
      B.box('Oven handle', 'Hardware', 'steel', 0, -p.D / 2 - 50, doorTop - 60, p.W - 120, 24, 24, { r: 8 });
      B.box('Drawer', 'Oven', 'steel', 0, -p.D / 2 - 10, 10, p.W - 20, 20, 100, { r: 3 });
      for (let i = 0; i < 5; i++)
        B.cylY('Knob', 'Hardware', 'black', -p.W / 2 + p.W * (i + 0.5) / 5, -p.D / 2 - 12, p.H - 95, 22, 24);
      if (p.back) B.box('Backguard', 'Body', 'steel', 0, p.D / 2 - 25, p.H, p.W, 50, 130, { r: 4 });
      return B.parts;
    },
  },
  {
    id: 'washer', cat: '厨房与家电', name: '洗衣机 / 烘干机', en: 'Washer / dryer', colors: [],
    params: [
      { k: 'type', label: '类型', type: 'select', options: [['washer', '洗衣机'], ['dryer', '烘干机'], ['pair', '并排一对'], ['stack', '叠放']], def: 'washer' },
      { k: 'W', label: '宽', min: 595, max: 700, step: 5, def: 600 },
      { k: 'D', label: '深', min: 500, max: 800, step: 5, def: 600 },
      { k: 'H', label: '单台高', min: 820, max: 1000, step: 5, def: 850 },
    ],
    build(p) {
      const B = makeBuilder();
      const unit = (x, z0, dryer) => {
        const tag = dryer ? 'Dryer' : 'Washer';
        B.box(tag + ' body', tag, 'white', x, 0, z0, p.W, p.D, p.H, { r: 10 });
        B.box(tag + ' control panel', tag, 'panel', x, -p.D / 2 - 2, z0 + p.H - 140, p.W - 30, 4, 120);
        B.box(tag + ' display', tag, 'glass', x - 40, -p.D / 2 - 5, z0 + p.H - 105, 170, 3, 50);
        B.cylY(tag + ' dial', tag, 'steel', x + p.W / 2 - 100, -p.D / 2 - 12, z0 + p.H - 80, 32, 18);
        const dzc = z0 + (p.H - 140) / 2 + 30;
        B.cylY(tag + ' door ring', tag, 'steel', x, -p.D / 2 - 15, dzc, 215, 30, { seg: 56 });
        B.cylY(tag + ' door', tag, dryer ? 'panel' : 'glass', x, -p.D / 2 - 32, dzc, 160, 6, { seg: 56 });
      };
      if (p.type === 'stack') { unit(0, 0, false); unit(0, p.H + 10, true); }
      else if (p.type === 'pair') { unit(-p.W / 2 - 10, 0, false); unit(p.W / 2 + 10, 0, true); }
      else unit(0, 0, p.type === 'dryer');
      return B.parts;
    },
  },
  // ===== Bathroom =====
  {
    id: 'toilet', cat: '卫浴', name: '马桶', en: 'Toilet', colors: [],
    params: [
      { k: 'D', label: '总深', min: 620, max: 780, step: 5, def: 700 },
      { k: 'sh', label: '座高', min: 380, max: 450, step: 5, def: 410 },
      { k: 'tw', label: '水箱宽', min: 360, max: 540, step: 10, def: 440 },
    ],
    build(p) {
      const B = makeBuilder();
      const tankD = 200, bl = p.D - tankD + 30, by = -p.D / 2 + bl / 2;
      B.cyl('Pedestal', 'Bowl', 'ceramic', 0, by + bl * 0.1, 0, 115, p.sh - 125, { ry: bl * 0.3, taper: 0.85, seg: 48 });
      B.cyl('Bowl', 'Bowl', 'ceramic', 0, by, p.sh - 125, 185, 100, { ry: bl / 2, taper: 0.72, seg: 64 });
      B.cyl('Seat', 'Seat', 'white', 0, by - 4, p.sh - 25, 182, 25, { ry: bl / 2 - 8, seg: 64 });
      B.box('Tank', 'Tank', 'ceramic', 0, p.D / 2 - tankD / 2, p.sh - 10, p.tw, tankD, 360, { r: 20 });
      B.box('Tank lid', 'Tank', 'ceramic', 0, p.D / 2 - tankD / 2, p.sh + 350, p.tw + 12, tankD + 12, 26, { r: 10 });
      B.box('Flush lever', 'Tank', 'steel', -p.tw / 2 + 60, p.D / 2 - tankD - 10, p.sh + 290, 60, 20, 16, { r: 6 });
      return B.parts;
    },
  },
  {
    id: 'vanity', cat: '卫浴', name: '浴室柜', en: 'Bathroom vanity', colors: ['wood'],
    params: [
      { k: 'W', label: '宽', min: 600, max: 1600, step: 10, def: 900 },
      { k: 'D', label: '深', min: 420, max: 580, step: 10, def: 500 },
      { k: 'H', label: '台面高', min: 780, max: 920, step: 5, def: 850 },
      { k: 'basins', label: '台盆数', type: 'int', min: 1, max: 2, def: 1 },
      { k: 'mirror', label: '镜子', type: 'bool', def: true },
    ],
    build(p) {
      const B = makeBuilder();
      const cd = p.D - 20;
      B.box('Carcass', 'Carcass', 'wood', 0, 10, 0, p.W, cd, p.H - 20);
      const nd = p.basins * 2, dw = (p.W - 4) / nd - 4;
      for (let i = 0; i < nd; i++) {
        const x = -p.W / 2 + 4 + (dw + 4) * (i + 0.5);
        B.box('Door', 'Fronts', 'wood', x, 10 - cd / 2 - 9, 10, dw, 18, p.H - 20 - 14, { r: 2 });
        B.box('Handle', 'Hardware', 'steel', x + (i % 2 ? -1 : 1) * (dw / 2 - 40), 10 - cd / 2 - 26, p.H - 180, 16, 16, 120);
      }
      B.box('Countertop', 'Countertop', 'stone', 0, 0, p.H - 20, p.W, p.D, 20, { r: 2 });
      const bx = p.basins === 2 && p.W >= 1100 ? [-p.W / 4, p.W / 4] : [0];
      for (const x of bx) {
        B.cyl('Basin', 'Fixtures', 'ceramic', x, -30, p.H, 210, 130, { ry: 160, taper: 0.8, seg: 56 });
        B.cyl('Faucet', 'Fixtures', 'steel', x, p.D / 2 - 70, p.H, 16, 250);
        B.box('Spout', 'Fixtures', 'steel', x, p.D / 2 - 140, p.H + 230, 26, 150, 20, { r: 6 });
      }
      if (p.mirror) B.box('Mirror', 'Mirror', 'mirror', 0, p.D / 2 + 10, p.H + 250, Math.max(500, p.W - 100), 20, 800, { r: 4 });
      return B.parts;
    },
  },
  {
    id: 'bathtub', cat: '卫浴', name: '浴缸', en: 'Bathtub', colors: [],
    params: [
      { k: 'L', label: '长', min: 1400, max: 1830, step: 5, def: 1525 },
      { k: 'W', label: '宽', min: 700, max: 900, step: 5, def: 760 },
      { k: 'H', label: '高', min: 430, max: 620, step: 5, def: 510 },
      { k: 'faucet', label: '龙头', type: 'bool', def: true },
    ],
    build(p) {
      const B = makeBuilder();
      const t = 70;
      for (const sy of [-1, 1]) B.box('Long wall', 'Shell', 'ceramic', 0, sy * (p.W / 2 - t / 2), 0, p.L, t, p.H, { r: 12 });
      for (const sx of [-1, 1]) B.box('End wall', 'Shell', 'ceramic', sx * (p.L / 2 - t / 2), 0, 0, t, p.W - 2 * t, p.H, { r: 12 });
      B.box('Tub floor', 'Shell', 'ceramic', 0, 0, 0, p.L - 2 * t, p.W - 2 * t, 110);
      B.cyl('Drain', 'Fixtures', 'steel', p.L / 2 - t - 120, 0, 110, 25, 2);
      if (p.faucet) {
        B.cyl('Faucet', 'Fixtures', 'steel', p.L / 2 - t / 2, 0, p.H, 18, 160);
        B.box('Spout', 'Fixtures', 'steel', p.L / 2 - t / 2 - 75, 0, p.H + 130, 150, 30, 24, { r: 6 });
      }
      return B.parts;
    },
  },
  // ===== added: residential essentials =====
  {
    id: 'sectional', cat: '客厅', name: '转角沙发', en: 'Sectional sofa', colors: ['fabric'],
    params: [
      { k: 'side', label: '转角方向', type: 'select', options: [['right', '右转'], ['left', '左转']], def: 'right' },
      { k: 'L', label: '主段长', min: 1800, max: 3600, step: 10, def: 2700 },
      { k: 'R', label: '转角段长', min: 1500, max: 2600, step: 10, def: 1800 },
      { k: 'D', label: '座深', min: 850, max: 1050, step: 10, def: 920 },
      { k: 'seatH', label: '座高', min: 380, max: 480, step: 5, def: 430 },
      { k: 'backH', label: '靠背高', min: 680, max: 950, step: 10, def: 800 },
      { k: 'armW', label: '扶手宽', min: 80, max: 260, step: 10, def: 160 },
      { k: 'legH', label: '脚高', min: 0, max: 200, step: 10, def: 100 },
    ],
    build(p) {
      const B = makeBuilder();
      const bt = 200, ct = 140, L = p.L, R = Math.max(p.R, p.D + p.armW + 300), D = p.D, a = p.armW, lz = p.legH;
      const baseH = Math.max(60, p.seatH - ct - lz), sz = lz + baseH, ch = p.seatH - sz;
      const y0 = -D / 2, yb = D / 2, yEnd = yb - R;            // return runs toward the front (-y) on the right
      // legs
      if (lz > 0) for (const [x, y] of [[60, y0 + 60], [60, yb - 60], [L - 60, yb - 60], [L - 60, yEnd + 60], [L - D + 60, yEnd + 60]])
        B.cyl('Leg', 'Legs', 'wood', x, y, 0, 20, lz, { taper: 0.7 });
      // arms and backs
      B.box('Arm', 'Body', 'fabric', a / 2, 0, lz, a, D, p.seatH + 180 - lz, { r: Math.min(30, a / 2 - 2) });
      B.box('Back', 'Body', 'fabric', (a + L) / 2, yb - bt / 2, lz, L - a, bt, p.backH - lz, { r: 30 });
      B.box('Return back', 'Body', 'fabric', L - bt / 2, (yEnd + a + yb - bt) / 2, lz, bt, (yb - bt) - (yEnd + a), p.backH - lz, { r: 30 });
      B.box('Return arm', 'Body', 'fabric', L - D / 2, yEnd + a / 2, lz, D, a, p.seatH + 180 - lz, { r: Math.min(30, a / 2 - 2) });
      // seat bases
      const mainW = L - bt - a, retL = (y0) - (yEnd + a);
      B.box('Seat base', 'Body', 'fabric', a + mainW / 2, (y0 + yb - bt) / 2, lz, mainW, D - bt, baseH, { r: 15 });
      B.box('Return seat base', 'Body', 'fabric', L - bt - (D - bt) / 2, (yEnd + a + y0) / 2, lz, D - bt, retL, baseH, { r: 15 });
      // cushions: main run (excluding the corner), corner square, return run
      const runW = L - a - D;
      const nm = Math.max(1, Math.round(runW / 650)), cw = runW / nm;
      for (let i = 0; i < nm; i++) {
        const x = a + cw * (i + 0.5);
        B.box('Seat cushion', 'Cushions', 'fabric', x, (y0 + yb - bt) / 2, sz, cw - 8, D - bt - 10, ch, { r: 40 });
        B.box('Back cushion', 'Cushions', 'fabric', x, yb - bt - 80, p.seatH, cw - 30, 160, Math.min(p.backH - p.seatH - 40, 480), { r: 55 });
      }
      B.box('Corner cushion', 'Cushions', 'fabric', L - D + (D - bt) / 2, (y0 + yb - bt) / 2, sz, D - bt - 8, D - bt - 10, ch, { r: 40 });
      const nr = Math.max(1, Math.round(retL / 650)), rl = retL / nr;
      for (let i = 0; i < nr; i++) {
        const y = y0 - rl * (i + 0.5);
        B.box('Return cushion', 'Cushions', 'fabric', L - bt - (D - bt) / 2, y, sz, D - bt - 10, rl - 8, ch, { r: 40 });
        B.box('Return back cushion', 'Cushions', 'fabric', L - bt - 80, y, p.seatH, 160, rl - 30, Math.min(p.backH - p.seatH - 40, 480), { r: 55 });
      }
      if (p.side === 'left') for (const q of B.parts) q.cx = -q.cx;
      return B.parts;
    },
  },
  {
    id: 'armchair', cat: '客厅', name: '扶手椅', en: 'Armchair', colors: ['fabric', 'wood'],
    params: [
      { k: 'W', label: '宽', min: 650, max: 1000, step: 10, def: 800 },
      { k: 'D', label: '深', min: 700, max: 950, step: 10, def: 820 },
      { k: 'seatH', label: '座高', min: 380, max: 470, step: 5, def: 420 },
      { k: 'backH', label: '靠背高', min: 700, max: 1050, step: 10, def: 820 },
      { k: 'armW', label: '扶手宽', min: 60, max: 200, step: 5, def: 120 },
      { k: 'armH', label: '扶手高', min: 520, max: 700, step: 10, def: 600 },
      { k: 'legH', label: '脚高', min: 0, max: 250, step: 10, def: 160 },
    ],
    build(p) {
      const B = makeBuilder();
      const inner = p.W - 2 * p.armW, bt = 180, ct = 130, lz = p.legH;
      if (lz > 0) for (const sx of [-1, 1]) for (const sy of [-1, 1])
        B.cyl('Leg', 'Legs', 'wood', sx * (p.W / 2 - 50), sy * (p.D / 2 - 50), 0, 18, lz, { taper: 0.65 });
      const baseH = Math.max(60, p.seatH - ct - lz);
      B.box('Seat base', 'Body', 'fabric', 0, -bt / 2, lz, inner, p.D - bt, baseH, { r: 15 });
      B.box('Seat cushion', 'Cushions', 'fabric', 0, -bt / 2 - 5, lz + baseH, inner - 8, p.D - bt - 10, p.seatH - lz - baseH, { r: 40 });
      B.box('Back', 'Body', 'fabric', 0, p.D / 2 - bt / 2, lz, inner, bt, p.backH - lz, { r: 30 });
      B.box('Back cushion', 'Cushions', 'fabric', 0, p.D / 2 - bt - 70, p.seatH, inner - 30, 140, Math.max(150, Math.min(p.backH - p.seatH - 40, 480)), { r: 55 });
      for (const sx of [-1, 1])
        B.box('Arm', 'Body', 'fabric', sx * (inner / 2 + p.armW / 2), 0, lz, p.armW, p.D, p.armH - lz, { r: Math.min(30, p.armW / 2 - 2) });
      return B.parts;
    },
  },
  {
    id: 'sidetable', cat: '客厅', name: '边几', en: 'Side table', colors: ['wood'],
    params: [
      { k: 'shape', label: '形状', type: 'select', options: [['round', '圆形'], ['rect', '矩形']], def: 'round' },
      { k: 'W', label: '宽 / 直径', min: 300, max: 650, step: 10, def: 450 },
      { k: 'D', label: '深', min: 300, max: 650, step: 10, def: 450, if: (p) => p.shape === 'rect' },
      { k: 'H', label: '高', min: 400, max: 700, step: 10, def: 550 },
      { k: 'shelf', label: '下层隔板', type: 'bool', def: false },
    ],
    build(p) {
      const B = makeBuilder();
      const t = 25, lt = 32;
      if (p.shape === 'round') {
        const R = p.W / 2;
        B.cyl('Top', 'Top', 'wood', 0, 0, p.H - t, R, t, { seg: 56 });
        for (let k = 0; k < 3; k++) {
          const a = Math.PI / 2 + k * 2 * Math.PI / 3, rr = R * 0.6;
          B.cyl('Leg', 'Legs', 'wood', Math.cos(a) * rr, Math.sin(a) * rr, 0, lt / 2, p.H - t, { seg: 20 });
        }
        if (p.shelf) B.cyl('Shelf', 'Top', 'wood', 0, 0, 150, R * 0.6 + 10, 15, { seg: 56 });
      } else {
        B.box('Top', 'Top', 'wood', 0, 0, p.H - t, p.W, p.D, t, { r: 3 });
        for (const sx of [-1, 1]) for (const sy of [-1, 1])
          B.box('Leg', 'Legs', 'wood', sx * (p.W / 2 - 25 - lt / 2), sy * (p.D / 2 - 25 - lt / 2), 0, lt, lt, p.H - t);
        if (p.shelf) B.box('Shelf', 'Top', 'wood', 0, 0, 150, p.W - 50 - 2 * lt, p.D - 50, 15);
      }
      return B.parts;
    },
  },
  {
    id: 'dresser', cat: '卧室', name: '斗柜', en: 'Dresser', colors: ['wood'],
    presets: [['宽矮', { W: 1400, H: 800, cols: 2, rows: 3 }], ['高窄', { W: 800, H: 1250, cols: 1, rows: 5 }]],
    params: [
      { k: 'W', label: '宽', min: 500, max: 1800, step: 10, def: 1200 },
      { k: 'D', label: '深', min: 380, max: 560, step: 10, def: 480 },
      { k: 'H', label: '高', min: 650, max: 1400, step: 10, def: 850 },
      { k: 'cols', label: '抽屉列数', type: 'int', min: 1, max: 3, def: 2 },
      { k: 'rows', label: '抽屉层数', type: 'int', min: 2, max: 6, def: 3 },
      { k: 'legH', label: '脚高', min: 0, max: 200, step: 10, def: 100 },
    ],
    build(p) {
      const B = makeBuilder();
      if (p.legH > 0) for (const sx of [-1, 1]) for (const sy of [-1, 1])
        B.cyl('Leg', 'Frame', 'wood', sx * (p.W / 2 - 45), sy * (p.D / 2 - 45), 0, 18, p.legH, { taper: 0.75 });
      const bodyH = p.H - p.legH;
      B.box('Carcass', 'Carcass', 'wood', 0, 9, p.legH, p.W, p.D - 18, bodyH, { r: 3 });
      const g = 5, fw = (p.W - g) / p.cols - g, fh = (bodyH - g) / p.rows - g;
      for (let c = 0; c < p.cols; c++) for (let r = 0; r < p.rows; r++) {
        const x = -p.W / 2 + g + (fw + g) * (c + 0.5), z = p.legH + g + r * (fh + g);
        B.box('Drawer front', 'Fronts', 'wood', x, -p.D / 2 + 9, z, fw, 18, fh, { r: 2 });
        B.box('Handle', 'Hardware', 'steel', x, -p.D / 2 - 8, z + fh / 2 - 7, Math.min(160, fw * 0.4), 14, 14);
      }
      return B.parts;
    },
  },
  {
    id: 'island', cat: '厨房与家电', name: '中岛 + 吧凳', en: 'Kitchen island', colors: ['wood', 'fabric'],
    params: [
      { k: 'L', label: '长', min: 1200, max: 3000, step: 10, def: 1800 },
      { k: 'D', label: '台面深', min: 800, max: 1300, step: 10, def: 1000 },
      { k: 'H', label: '台面高', min: 860, max: 1070, step: 5, def: 910 },
      { k: 'over', label: '吧台悬挑', min: 0, max: 400, step: 10, def: 300 },
      { k: 'stools', label: '吧凳数', type: 'int', min: 0, max: 5, def: 3 },
      { k: 'sink', label: '水槽', type: 'bool', def: false },
    ],
    build(p) {
      const B = makeBuilder();
      const cd = p.D - p.over, cy = -p.over / 2, ch = p.H - 40 - 100, front = cy - cd / 2;
      B.box('Plinth', 'Carcass', 'black', 0, cy, 0, p.L - 60, cd - 100, 100);
      B.box('Island carcass', 'Carcass', 'wood', 0, cy, 100, p.L, cd, ch);
      const m = Math.max(2, Math.round(p.L / 600)), mw = p.L / m;
      for (let i = 0; i < m; i++) {
        const x = -p.L / 2 + mw * (i + 0.5);
        B.box('Door', 'Fronts', 'wood', x, front - 9, 102, mw - 4, 18, ch - 4, { r: 2 });
        B.box('Handle', 'Hardware', 'steel', x, front - 28, p.H - 40 - 70, mw * 0.5, 18, 14);
      }
      B.box('Countertop', 'Countertop', 'stone', 0, 0, p.H - 40, p.L, p.D, 40, { r: 3 });
      if (p.sink) {
        B.box('Sink rim', 'Fixtures', 'steel', 0, front + 300, p.H, 760, 460, 4);
        B.box('Sink basin', 'Fixtures', 'glass', 0, front + 300, p.H + 4, 700, 400, 1);
        B.cyl('Faucet', 'Fixtures', 'steel', 0, front + 300 + 280, p.H, 16, 300);
        B.box('Spout', 'Fixtures', 'steel', 0, front + 300 + 200, p.H + 280, 28, 180, 22, { r: 6 });
      }
      // counter-height stools: seat about 300 mm below the counter
      const sh = p.H - 290, sp = p.L / Math.max(1, p.stools);
      for (let i = 0; i < p.stools; i++) {
        const x = -p.L / 2 + sp * (i + 0.5), y = p.D / 2 - p.over + 200 + Math.max(0, p.over - 150);
        B.cyl('Stool base', 'Stools', 'black', x, y, 0, 190, 15, { seg: 40 });
        B.cyl('Stool column', 'Stools', 'steel', x, y, 15, 22, sh - 65);
        B.cyl('Stool footrest', 'Stools', 'steel', x, y, 300, 150, 14, { seg: 40 });
        B.cyl('Stool seat', 'Stools', 'fabric', x, y, sh - 50, 190, 50, { seg: 40 });
      }
      for (const q of B.parts) q.cy = -q.cy;   // seating side faces the viewer (front), cabinets face the kitchen
      return B.parts;
    },
  },
  {
    id: 'shower', cat: '卫浴', name: '淋浴房', en: 'Shower', colors: [],
    params: [
      { k: 'type', label: '类型', type: 'select', options: [['corner', '转角（两面玻璃）'], ['alcove', '一字（正面玻璃）']], def: 'corner' },
      { k: 'W', label: '宽', min: 800, max: 1600, step: 10, def: 900 },
      { k: 'D', label: '深', min: 800, max: 1200, step: 10, def: 900 },
      { k: 'H', label: '玻璃高', min: 1850, max: 2200, step: 10, def: 2000 },
      { k: 'trayH', label: '底盘高', min: 0, max: 150, step: 10, def: 50 },
    ],
    build(p) {
      const B = makeBuilder();
      const z0 = p.trayH, gt = 8;
      if (p.trayH > 0) B.box('Shower tray', 'Tray', 'ceramic', 0, 0, 0, p.W, p.D, p.trayH, { r: 4 });
      B.cyl('Drain', 'Fixtures', 'steel', 0, 0, p.trayH, 45, 2, { seg: 32 });
      // front: fixed panel + sliding door
      const half = p.W / 2;
      B.box('Fixed glass', 'Glass', 'clearglass', -half / 2 - 5, -p.D / 2 + 15, z0, half + 10, gt, p.H);
      B.box('Door glass', 'Glass', 'clearglass', half / 2, -p.D / 2 + 35, z0, half, gt, p.H);
      B.box('Door handle', 'Hardware', 'steel', 60, -p.D / 2 + 50, z0 + 950, 20, 20, 300, { r: 6 });
      B.box('Top rail', 'Glass', 'steel', 0, -p.D / 2 + 25, z0 + p.H, p.W, 40, 25);
      if (p.type === 'corner') {
        B.box('Side glass', 'Glass', 'clearglass', -p.W / 2 + 5, 10, z0, gt, p.D - 20, p.H);
        B.box('Side rail', 'Glass', 'steel', -p.W / 2 + 5, 0, z0 + p.H, 25, p.D, 25);
      }
      // shower column on the back wall
      const bx = p.type === 'corner' ? p.W / 4 : 0, by = p.D / 2 - 40;
      B.cyl('Riser', 'Fixtures', 'steel', bx, by, z0 + 900, 12, p.H - 1000);
      B.box('Mixer', 'Fixtures', 'steel', bx, by - 20, z0 + 1000, 180, 50, 70, { r: 12 });
      B.box('Head arm', 'Fixtures', 'steel', bx, by - 150, z0 + p.H - 120, 20, 300, 20, { r: 6 });
      B.cyl('Shower head', 'Fixtures', 'steel', bx, by - 290, z0 + p.H - 135, 120, 15, { seg: 48 });
      return B.parts;
    },
  },
];

const ORDER = ['bed', 'nightstand', 'wardrobe', 'dresser', 'sofa', 'sectional', 'armchair', 'coffee', 'sidetable', 'tvstand', 'bookshelf',
  'dining', 'chair', 'desk', 'office', 'kitchen', 'island', 'fridge', 'range', 'washer', 'toilet', 'vanity', 'bathtub', 'shower'];
MODELS.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));

export const CATS = ['卧室', '客厅', '餐厅与书房', '厨房与家电', '卫浴'];

export function defaults(model) {
  const v = {};
  for (const q of model.params) v[q.k] = q.def;
  for (const c of model.colors) v['color_' + c] = COLORS[c][0][0];
  return v;
}

export function paramVisible(q, v) {
  if (!q.if) return true;
  return typeof q.if === 'function' ? q.if(v) : !!v[q.if];
}

export function buildModel(model, values) {
  const parts = normalise(model.build(values));
  const b = bounds(parts);
  const dims = { W: n(b[3] - b[0]), D: n(b[4] - b[1]), H: n(b[5] - b[2]) };
  return { parts, dims };
}

export function materialColor(mat, values) {
  if (mat === 'fabric') return values.color_fabric || COLORS.fabric[0][0];
  if (mat === 'wood') return values.color_wood || COLORS.wood[0][0];
  return FIXED_MATS[mat] || '#999999';
}
