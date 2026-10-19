// PlotCloud stair & ramp generator — parametric stairs and ramps on the furniture generator engine.
// Units mm, Z up, front faces -Y. Stairs climb toward +Y. Checks use typical NBC 2020 Part 9 values (BCBC / OBC are similar).
import { makeBuilder, normalise, bounds, COLORS, FIXED_MATS, paramVisible, materialColor } from 'pc-base/models.js';
export { COLORS, FIXED_MATS, paramVisible, materialColor, bounds };

const RULES = {
  private: { label: 'Dwelling unit', maxR: 200, minR: 125, minT: 255, maxT: 355, minW: 860, guard: 900 },
  public: { label: 'All other stairs', maxR: 180, minR: 125, minT: 280, maxT: Infinity, minW: 900, guard: 1070 },
};

function calc(p) {
  const r = RULES[p.use] || RULES.private;
  // p.n (optional, not shown as a parameter): a caller that picks the riser count itself, e.g. Workbench from the floor height
  const n = p.n >= 2 ? Math.round(p.n) : Math.max(2, Math.ceil(p.H / r.maxR - 1e-9));
  const R = p.H / n, T = p.T;
  return { r, n, R, T };
}

// stepped concrete profile for one flight: u forward, v up. Starts at (0, z0), k risers.
function concreteProfile(k, R, T, z0, waist) {
  const s = R / T, wv = waist * Math.sqrt(1 + s * s);
  const pts = [[0, z0]];
  for (let i = 1; i <= k; i++) { pts.push([(i - 1) * T, z0 + i * R]); if (i < k) pts.push([i * T, z0 + i * R]); }
  const uEnd = (k - 1) * T;
  const topSoffit = Math.max(z0, z0 + (k - 1) * R - wv);
  pts.push([uEnd, topSoffit]);
  const u0 = Math.min(uEnd, Math.max(0, wv / s));
  if (z0 > 0) pts.push([u0, z0 - Math.min(z0, 150)]), pts.push([0, z0 - Math.min(z0, 150)]);
  else pts.push([u0, 0]);
  return dedupe(pts);
}
function stringerProfile(k, R, T, z0) {
  const uEnd = (k - 1) * T, top = 40, depth = 300, s = R / T;
  const uGround = Math.max(0, (depth - R - top) / s);
  const pts = [[0, z0], [0, z0 + R + top], [uEnd, z0 + k * R + top], [uEnd, z0 + k * R + top - depth]];
  if (z0 > 0) pts.push([0, z0]);
  else pts.push([Math.min(uEnd, uGround), 0]);
  return dedupe(pts);
}
function dedupe(pts) {
  const out = [];
  for (const q of pts) { const l = out[out.length - 1]; if (!l || Math.abs(l[0] - q[0]) > 0.01 || Math.abs(l[1] - q[1]) > 0.01) out.push(q); }
  return out;
}

// One straight flight. dir: '+y' | '-y' | '+x' | '-x'. (x0,y0) is the centre of the first riser line, z0 its base.
function flight(B, p, k, R, T, x0, y0, z0, dir, W, opts = {}) {
  const along = dir[1], sgn = dir[0] === '+' ? 1 : -1;
  const map = (u) => (along === 'y' ? y0 + sgn * u : x0 + sgn * u);
  const plane = along === 'y' ? 'yz' : 'xz';
  const across0 = (along === 'y' ? x0 : y0) - W / 2;
  const mapPts = (pts) => pts.map(([u, v]) => [map(u), v]);
  if (p.kind === 'concrete') {
    B.prism('Flight', 'Structure', 'concrete', plane, mapPts(concreteProfile(k, R, T, z0, 150)), across0, W);
  } else {
    const st = 50, mono = p.kind === 'mono';
    const offs = mono ? [W / 2] : [st / 2, W - st / 2];
    for (const o of offs) B.prism('Stringer', 'Structure', p.kind === 'mono' ? 'rail' : 'wood', plane, mapPts(stringerProfile(k, R, T, z0)), across0 + o - (mono ? 60 : st / 2), mono ? 120 : st);
    const tt = 40, nose = 25;
    for (let i = 1; i < k; i++) {
      const u0 = (i - 1) * T - nose, u1 = i * T, um = (u0 + u1) / 2;
      const c = map(um), len = u1 - u0, w = mono ? W : W - 2 * st;
      if (along === 'y') B.box('Tread', 'Treads', 'wood', x0, c, z0 + i * R - tt, w, len, tt);
      else B.box('Tread', 'Treads', 'wood', c, y0, z0 + i * R - tt, len, w, tt);
    }
  }
  // handrails along the nosing line, 900 high, extended 300 past the top
  const railH = opts.railH || 900;
  for (const side of opts.rails || []) {
    const off = side * (W / 2 - 40);
    const P = (u, z) => (along === 'y' ? [x0 + off, map(u), z] : [map(u), y0 + off, z]);
    const pts = [P(0, z0 + R + railH), P((k - 1) * T, z0 + k * R + railH)];
    if (opts.extendTop !== false) pts.push(P((k - 1) * T + 300, z0 + k * R + railH));
    B.tube('Handrail', 'Rails', 'rail', pts, 20);
    for (const u of [0, (k - 1) * T]) {
      const i = u === 0 ? 1 : k;
      const zt = z0 + i * R;
      const a = P(u, zt - (p.kind === 'concrete' ? 0 : 40)), b = P(u, zt + railH);
      B.tube('Post', 'Rails', 'rail', [a, b], 20);
    }
    if (opts.glass) {
      const g = [[0, z0 + R + 80], [(k - 1) * T, z0 + k * R + 80], [(k - 1) * T, z0 + k * R + railH - 60], [0, z0 + R + railH - 60]];
      B.prism('Glass guard', 'Rails', 'clearglass', plane, mapPts(g), (along === 'y' ? x0 + off : y0 + off) - 6, 12);
    }
  }
}

function landing(B, p, x, y, z, w, d, name = 'Landing') {
  const th = p.kind === 'concrete' ? 200 : 60;
  B.box(name, 'Structure', p.kind === 'concrete' ? 'concrete' : 'wood', x, y, z - th, w, d, th);
  if (p.kind !== 'concrete' && z - th > 0) for (const sx of [-1, 1]) for (const sy of [-1, 1])
    B.box('Landing post', 'Structure', 'rail', x + sx * (w / 2 - 40), y + sy * (d / 2 - 40), 0, 60, 60, z - th);
}

const railSides = (p) => (p.rails === 'both' ? [-1, 1] : p.rails === 'one' ? [-1] : []);

function stairInfo(p, extra = []) {
  const { r, n, R } = calc(p);
  const T = p.T, rule2 = 2 * R + T;
  const rows = [['Risers', `${n}`], ['Rise', `${R.toFixed(1)} mm`], ['Run', `${T} mm`], ['2R + T', `${rule2.toFixed(0)} mm`],
    ['Pitch', `${(Math.atan(R / T) * 180 / Math.PI).toFixed(1)}°`], ...extra];
  const checks = [
    [`Rise ≤ ${r.maxR} mm`, R <= r.maxR + 0.01, `${R.toFixed(0)}`],
    [`Run ≥ ${r.minT} mm`, T >= r.minT, `${T}`],
    ...(Number.isFinite(r.maxT) ? [[`Run ≤ ${r.maxT} mm`, T <= r.maxT, `${T}`]] : []),
    [`Width ≥ ${r.minW} mm`, p.W >= r.minW, `${p.W}`],
    ['Comfort 550 ≤ 2R+T ≤ 700', rule2 >= 550 && rule2 <= 700, `${rule2.toFixed(0)}`],
  ];
  return { title: 'Code check', rows, checks, note: `${r.label}: typical NBC 2020 Part 9 limits. BC and Ontario use similar values. Confirm with the code that applies to your project.` };
}

const commonStair = [
  { k: 'use', label: 'Use', type: 'select', options: [['private', 'Dwelling unit'], ['public', 'Other buildings']], def: 'private' },
  { k: 'kind', label: 'Structure', type: 'select', options: [['concrete', 'Concrete'], ['stringer', 'Stringers'], ['mono', 'Mono stringer']], def: 'concrete' },
  { k: 'H', label: 'Floor to floor', min: 1000, max: 5000, step: 10, def: 3000 },
  { k: 'W', label: 'Width', min: 700, max: 2400, step: 10, def: 1100 },
  { k: 'T', label: 'Run (tread)', min: 220, max: 380, step: 5, def: 280 },
];
const railParams = [
  { k: 'rails', label: 'Handrails', type: 'select', options: [['none', 'None'], ['one', 'One side'], ['both', 'Both sides']], def: 'both' },
  { k: 'glass', label: 'Glass guard', type: 'bool', def: false, if: (p) => p.rails !== 'none' },
];
const railOpts = (p) => {
  const r = RULES[p.use] || RULES.private;
  return { rails: railSides(p), glass: p.glass && p.rails !== 'none', railH: p.glass ? r.guard : 900 };
};

export const MODELS = [
  {
    id: 'straight', cat: 'Stairs', name: 'Straight stair', en: 'Straight stair', colors: ['wood'],
    params: [...commonStair, { k: 'topLanding', label: 'Top landing', type: 'bool', def: true }, ...railParams],
    build(p) {
      const B = makeBuilder();
      const { n, R, T } = calc(p);
      flight(B, p, n, R, T, 0, 0, 0, '+y', p.W, { ...railOpts(p), extendTop: !p.topLanding });
      if (p.topLanding) landing(B, p, 0, (n - 1) * T + p.W / 2, p.H, p.W, p.W, 'Top landing');
      return B.parts;
    },
    info: (p) => stairInfo(p, [['Total going', `${((calc(p).n - 1) * p.T / 1000).toFixed(2)} m`]]),
  },
  {
    id: 'lshape', cat: 'Stairs', name: 'L-shaped stair', en: 'L-shaped stair', colors: ['wood'],
    params: [...commonStair,
      { k: 'turn', label: 'Turn', type: 'select', options: [['right', 'Right'], ['left', 'Left']], def: 'right' },
      { k: 'split', label: 'Risers before landing (%)', min: 20, max: 80, step: 5, def: 50 }, ...railParams],
    build(p) {
      const B = makeBuilder();
      const { n, R, T } = calc(p);
      const n1 = Math.min(n - 2, Math.max(2, Math.round(n * p.split / 100))), n2 = n - n1;
      const ro = railOpts(p);
      flight(B, p, n1, R, T, 0, 0, 0, '+y', p.W, { ...ro, extendTop: false });
      const ly = (n1 - 1) * T + p.W / 2;
      landing(B, p, 0, ly, n1 * R, p.W, p.W);
      const sg = p.turn === 'right' ? 1 : -1;
      flight(B, p, n2, R, T, sg * p.W / 2, ly, n1 * R, sg > 0 ? '+x' : '-x', p.W, { ...ro, extendTop: true });
      return B.parts;
    },
    info: (p) => { const { n } = calc(p); const n1 = Math.min(n - 2, Math.max(2, Math.round(n * p.split / 100))); return stairInfo(p, [['Flights', `${n1} + ${n - n1} risers`], ['Landing', `${p.W} × ${p.W} mm`]]); },
  },
  {
    id: 'ushape', cat: 'Stairs', name: 'U-shaped stair', en: 'U-shaped stair', colors: ['wood'],
    params: [...commonStair, { k: 'gap', label: 'Well gap', min: 0, max: 1200, step: 10, def: 200 }, ...railParams],
    build(p) {
      const B = makeBuilder();
      const { n, R, T } = calc(p);
      const n1 = Math.ceil(n / 2), n2 = n - n1, ro = railOpts(p);
      const xL = -(p.gap / 2 + p.W / 2), xR = p.gap / 2 + p.W / 2;
      flight(B, p, n1, R, T, xL, 0, 0, '+y', p.W, { ...ro, extendTop: false });
      const yL = (n1 - 1) * T + p.W / 2;
      landing(B, p, 0, yL, n1 * R, 2 * p.W + p.gap, p.W, 'Half landing');
      flight(B, p, n2, R, T, xR, (n1 - 1) * T, n1 * R, '-y', p.W, { ...ro, extendTop: true });
      return B.parts;
    },
    info: (p) => { const { n } = calc(p); const n1 = Math.ceil(n / 2); return stairInfo(p, [['Flights', `${n1} + ${n - n1} risers`], ['Footprint', `${2 * p.W + p.gap} × ${((n1 - 1) * p.T + p.W)} mm`]]); },
  },
  {
    id: 'spiral', cat: 'Stairs', name: 'Spiral stair', en: 'Spiral stair', colors: ['wood'],
    params: [
      { k: 'use', label: 'Use', type: 'select', options: [['private', 'Dwelling unit'], ['public', 'Other buildings']], def: 'private' },
      { k: 'H', label: 'Floor to floor', min: 1000, max: 5000, step: 10, def: 3000 },
      { k: 'D', label: 'Diameter', min: 1200, max: 3000, step: 10, def: 1800 },
      { k: 'step', label: 'Angle per tread (°)', min: 20, max: 40, step: 1, def: 27 },
      { k: 'dir', label: 'Rotation', type: 'select', options: [['ccw', 'Counter-clockwise'], ['cw', 'Clockwise']], def: 'ccw' },
      { k: 'rail', label: 'Outer handrail', type: 'bool', def: true },
    ],
    build(p) {
      const B = makeBuilder();
      const r = RULES[p.use] || RULES.private;
      const n = p.n >= 2 ? Math.round(p.n) : Math.max(2, Math.ceil(p.H / r.maxR - 1e-9)), R = p.H / n;
      const ro = p.D / 2, rc = 80, da = p.step * Math.PI / 180 * (p.dir === 'cw' ? -1 : 1), a0 = -Math.PI / 2;
      B.cyl('Column', 'Structure', 'rail', 0, 0, 0, rc, p.H + 1000, { seg: 32 });
      const sector = (aS, aE, rin, rout) => {
        const pts = [], seg = 8;
        for (let i = 0; i <= seg; i++) { const a = aS + (aE - aS) * i / seg; pts.push([Math.cos(a) * rout, Math.sin(a) * rout]); }
        for (let i = seg; i >= 0; i--) { const a = aS + (aE - aS) * i / seg; pts.push([Math.cos(a) * rin, Math.sin(a) * rin]); }
        return pts;
      };
      for (let i = 1; i < n; i++) {
        const aS = a0 + (i - 1) * da, aE = aS + da * 1.08;
        B.prism('Tread', 'Treads', 'wood', 'xy', sector(Math.min(aS, aE), Math.max(aS, aE), rc, ro), i * R - 40, 40);
        if (p.rail) { const am = aS + da / 2; B.tube('Baluster', 'Rails', 'rail', [[Math.cos(am) * (ro - 40), Math.sin(am) * (ro - 40), i * R], [Math.cos(am) * (ro - 40), Math.sin(am) * (ro - 40), i * R + 900]], 9); }
      }
      const aL = a0 + (n - 1) * da;
      B.prism('Top landing', 'Treads', 'wood', 'xy', sector(Math.min(aL, aL + da * 3), Math.max(aL, aL + da * 3), rc, ro), p.H - 40, 40);
      if (p.rail) {
        const pts = [];
        for (let i = 1; i <= (n - 1) * 2; i++) { const a = a0 + i * da / 2, z = (i / 2 + 0.5) * R + 900; pts.push([Math.cos(a) * (ro - 40), Math.sin(a) * (ro - 40), Math.min(z, p.H + 900)]); }
        B.tube('Handrail', 'Rails', 'rail', pts, 20);
      }
      return B.parts;
    },
    info: (p) => {
      const r = RULES[p.use] || RULES.private;
      const n = p.n >= 2 ? Math.round(p.n) : Math.max(2, Math.ceil(p.H / r.maxR - 1e-9)), R = p.H / n;
      const walk = (80 + p.D / 2) / 2, runW = walk * p.step * Math.PI / 180, turns = (n - 1) * p.step / 360;
      return {
        title: 'Check',
        rows: [['Risers', `${n}`], ['Rise', `${R.toFixed(1)} mm`], ['Run at walking line', `${runW.toFixed(0)} mm`], ['Turns', `${turns.toFixed(2)}`], ['Clear width', `${p.D / 2 - 80} mm`]],
        checks: [[`Rise ≤ ${r.maxR} mm`, R <= r.maxR + 0.01, `${R.toFixed(0)}`]],
        note: 'Spiral stairs have their own limits for run, width and headroom, and are usually allowed only inside dwelling units. Check the code that applies to your project.',
      };
    },
  },
  {
    id: 'ramp', cat: 'Ramps', name: 'Accessible ramp', en: 'Accessible ramp', colors: [],
    params: [
      { k: 'rise', label: 'Total rise', min: 100, max: 2000, step: 10, def: 600 },
      { k: 'W', label: 'Width', min: 900, max: 2400, step: 10, def: 1100 },
      { k: 'slope', label: 'Slope', type: 'select', options: [['12', '1:12'], ['15', '1:15'], ['20', '1:20']], def: '12' },
      { k: 'layout', label: 'Layout', type: 'select', options: [['straight', 'Straight'], ['switch', 'Switchback']], def: 'switch' },
      { k: 'maxRun', label: 'Max run between landings', min: 3000, max: 9000, step: 100, def: 9000 },
      { k: 'landL', label: 'Landing length', min: 1200, max: 2400, step: 50, def: 1500 },
      { k: 'rails', label: 'Handrails both sides', type: 'bool', def: true },
    ],
    build(p) {
      const B = makeBuilder();
      const k = +p.slope, totalRun = p.rise * k;
      const nRuns = Math.max(1, Math.ceil(totalRun / p.maxRun - 1e-9)), run = totalRun / nRuns, dz = p.rise / nRuns;
      const railZ = 900, sep = 150;
      const railPts = { L: [], R: [] };
      const addRail = (lane, pts) => railPts[lane].push(...pts);
      if (p.layout === 'straight') {
        let y = 0, z = 0;
        B.box('Bottom landing', 'Landings', 'concrete', 0, -p.landL / 2, 0, p.W, p.landL, 10);
        for (let i = 0; i < nRuns; i++) {
          B.prism('Ramp run', 'Ramp', 'concrete', 'yz', [[y, 0], [y, z], [y + run, z + dz], [y + run, 0]], -p.W / 2, p.W);
          for (const s of ['L', 'R']) addRail(s, [[0, y, z + railZ], [0, y + run, z + dz + railZ]]);
          y += run; z += dz;
          const last = i === nRuns - 1;
          B.box(last ? 'Top landing' : 'Landing', 'Landings', 'concrete', 0, y + p.landL / 2, 0, p.W, p.landL, z);
          for (const s of ['L', 'R']) addRail(s, [[0, y + (last ? 300 : p.landL), z + railZ]]);
          y += last ? 0 : p.landL;
        }
        if (p.rails) for (const [s, sx] of [['L', -1], ['R', 1]]) {
          const pts = [[0, -300, railZ], ...railPts[s]].map(([, yy, zz]) => [sx * (p.W / 2 - 40), yy, zz]);
          B.tube('Handrail', 'Rails', 'rail', pts, 20);
          for (const q of [pts[0], pts[pts.length - 1]]) B.tube('Post', 'Rails', 'rail', [[q[0], q[1], q[2] - railZ], q], 20);
        }
      } else {
        // switchback: lanes side by side, turning landings span two lanes
        let z = 0;
        const laneX = (i) => (i - (nRuns - 1) / 2) * (p.W + sep);
        B.box('Bottom landing', 'Landings', 'concrete', laneX(0), -p.landL / 2, 0, p.W, p.landL, 10);
        for (let i = 0; i < nRuns; i++) {
          const up = i % 2 === 0, x = laneX(i);
          const ya = up ? 0 : run, yb = up ? run : 0;
          B.prism('Ramp run', 'Ramp', 'concrete', 'yz', [[ya, 0], [ya, z], [yb, z + dz], [yb, 0]], x - p.W / 2, p.W);
          if (p.rails) for (const sx of [-1, 1]) {
            const xr = x + sx * (p.W / 2 - 40);
            const pts = [[xr, ya + (up ? -300 : 300) * (i === 0 ? 1 : 0), z + railZ], [xr, yb, z + dz + railZ]];
            B.tube('Handrail', 'Rails', 'rail', pts, 20);
          }
          z += dz;
          const last = i === nRuns - 1;
          const ly = up ? run + p.landL / 2 : -p.landL / 2;
          if (last) B.box('Top landing', 'Landings', 'concrete', x, ly, 0, p.W, p.landL, z);
          else B.box('Turning landing', 'Landings', 'concrete', (x + laneX(i + 1)) / 2, ly, 0, 2 * p.W + sep, p.landL, z);
        }
      }
      return B.parts;
    },
    info: (p) => {
      const k = +p.slope, totalRun = p.rise * k, nRuns = Math.max(1, Math.ceil(totalRun / p.maxRun - 1e-9)), run = totalRun / nRuns;
      return {
        title: 'Check',
        rows: [['Total run (sloped)', `${(totalRun / 1000).toFixed(2)} m`], ['Runs', `${nRuns} × ${(run / 1000).toFixed(2)} m`], ['Landings between runs', `${nRuns - 1}`], ['Slope', `1:${k} (${(100 / k).toFixed(1)}%)`]],
        checks: [['Slope ≤ 1:12', k >= 12, `1:${k}`], ['Run between landings ≤ 9 m', run <= 9000 + 0.5, `${(run / 1000).toFixed(2)} m`], ['Landing ≥ 1500 mm', p.landL >= 1500, `${p.landL}`], ['Handrails on both sides', !!p.rails, p.rails ? 'yes' : 'no']],
        note: 'Typical barrier-free ramp values (NBC Part 3). Handrails are drawn 900 mm high and extend 300 mm at the ends. Confirm with the code that applies to your project.',
      };
    },
  },
];

export const CATS = ['Stairs', 'Ramps'];

export function defaults(model) {
  const v = {};
  for (const q of model.params) v[q.k] = q.def;
  for (const c of model.colors) v['color_' + c] = COLORS[c][0][0];
  return v;
}

export function buildModel(model, values) {
  const parts = normalise(model.build(values));
  const b = bounds(parts);
  return { parts, dims: { W: Math.round(b[3] - b[0]), D: Math.round(b[4] - b[1]), H: Math.round(b[5] - b[2]) } };
}
