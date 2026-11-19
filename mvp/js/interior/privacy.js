// Privacy (2026-10-31): the analysis of the Privacy study (the former emb/privacy.html, retired 2026-11-01), unchanged, for the Workspace: onlookers along the
// street and in the windows of a building opposite; for every spot of the floor (1.2 m up), the share of them that see it through
// a window, checked against each window's sill and head and furniture taller than the line of sight.
// 2026-11-19: the site's buildings (and terrain) block sight lines and, within 40 m, look in from their own storeys; every window in
// an outside wall gets a risk score from the sight lines that pass through it (see windowRisk). A geometric screening: straight sight
// lines only; curtains, frosting, planting, reflections, glare and how people behave are not modelled.
import { clamp, r1, raster, centre, sliced, keep, ROOM_SKIP, sceneBounds, wallBox, segCross, dist } from '../../../emb/lib/plansim.js?v=1';
let SC = null, RES = null, OPTS = null, IMG = null;   // IMG: the study page's picture cache, unused here
 const opts = () => OPTS, setKey = () => '';
const EXP = [[0, [255, 255, 255]], [0.02, [255, 238, 170]], [0.3, [250, 170, 70]], [0.65, [220, 70, 50]], [1, [140, 20, 40]]];
const NEED = { high: [216, 64, 42], medium: [245, 166, 35], low: [180, 200, 120], none: [210, 210, 205] }, NEEDT = { high: 'High', medium: 'Medium', low: 'Low', none: 'None' };
const LIMIT = { high: 10, medium: 25 };   // % of a room's floor seen before it needs a screen
const needOf = (name) => { const o = keep.get('privacy:' + (SC.source?.project || 'sample'), {})[name]; if (o) return o;
  if (/bed|bath|wc|toilet|shower|en-?suite|master|nursery|卧|浴|厕|卫/i.test(name)) return 'high';
  if (/\bexam|consult|treatment|\bward\b|patient room|chang(e|ing) (room|cubicle)|cubicle|诊室|病房|更衣/i.test(name)) return 'high';   // clinical rooms (2026-11-19)
  if (/living|lounge|study|office|family|sitting|den|客厅|书房/i.test(name)) return 'medium';
  if (ROOM_SKIP.test(name) || /garage|store|storage|utility|plant|车库|储/i.test(name)) return 'none'; return 'low'; };
// onlookers: along the street lines at eye height, and in the windows of the building opposite (every 3 m up to its height)
function onlookers(o) {
  const B = wallBox(SC), z0 = SC.settings?.floorZ || 0, out = [];
  const line = (side, d) => { const m = 1.5; if (side === 'top' || side === 'bottom') { const y = side === 'top' ? B.y1 + d : B.y0 - d, pts = []; for (let x = B.x0 - d; x <= B.x1 + d + 1e-6; x += m) pts.push([x, y]); return pts; }
    const x = side === 'right' ? B.x1 + d : B.x0 - d, pts = []; for (let y = B.y0 - d; y <= B.y1 + d + 1e-6; y += m) pts.push([x, y]); return pts; };
  for (const s of o.sides) { for (const p of line(s, o.dS)) out.push({ p, z: o.eye, kind: 'street', side: s });
    if (o.dO > o.dS && o.hO >= 1) for (let z = 1.5; z <= o.hO + 1e-6; z += 3) for (const p of line(s, o.dO)) out.push({ p, z, kind: 'opposite', side: s }); }
  // people in the site's buildings nearby (2026-11-19): on each storey (every 3 m from 1.5 m) of the faces turned towards this plan, a
  // point every 3 m, 0.3 m out from the face; buildings whose middle is inside this plan's walls are not neighbours
  if (o.near !== false && SC.ctx && SC.ctx.length) { const cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2, dN = o.dN || 40, nb = [];
    const gap = (p) => Math.hypot(Math.max(B.x0 - p[0], 0, p[0] - B.x1), Math.max(B.y0 - p[1], 0, p[1] - B.y1));
    for (const b of SC.ctx) { const P = b.pts; if (!P || P.length < 3) continue; const g = [P.reduce((t, q) => t + q[0], 0) / P.length, P.reduce((t, q) => t + q[1], 0) / P.length];
      if (g[0] > B.x0 && g[0] < B.x1 && g[1] > B.y0 && g[1] < B.y1) continue;
      for (let i = 0; i < P.length; i++) { const e0 = P[i], e1 = P[(i + 1) % P.length], L = dist(e0, e1); if (L < 1) continue; const d = [(e1[0] - e0[0]) / L, (e1[1] - e0[1]) / L], m = [(e0[0] + e1[0]) / 2, (e0[1] + e1[1]) / 2];
        let n = [-d[1], d[0]]; if (n[0] * (m[0] - g[0]) + n[1] * (m[1] - g[1]) < 0) n = [-n[0], -n[1]];
        const tw = [cx - m[0], cy - m[1]], tl = Math.hypot(tw[0], tw[1]) || 1; if ((n[0] * tw[0] + n[1] * tw[1]) / tl < 0.2) continue;
        for (let t = Math.min(1.5, L / 2); t < L; t += 3) { const p = [e0[0] + d[0] * t + n[0] * 0.3, e0[1] + d[1] * t + n[1] * 0.3]; if (gap(p) > dN || gap(p) < 1) continue;
          for (let z = (b.base || 0) + 1.5; z <= b.h - 0.3; z += 3) nb.push({ p, z, kind: 'nearby', side: sideOf(p, cx, cy), bid: b.id }); } } }
    const k = Math.max(1, Math.ceil(nb.length / 600)); nb.forEach((x, i) => { if (i % k === 0) out.push(x); }); }
  if (TER) for (const ob of out) if (ob.kind !== 'nearby') ob.z += groundAt(ob.p);   // street and opposite: eye height above the ground under them
  void z0; return out;
}
const sideOf = (p, cx, cy) => { const a = Math.atan2(p[1] - cy, p[0] - cx) * 180 / Math.PI; return a >= 45 && a < 135 ? 'top' : a >= -45 && a < 45 ? 'right' : a >= -135 && a < -45 ? 'bottom' : 'left'; };
// the terrain (scene metres, z), for the ground under a point: the nearest of its grid points (2026-11-19)
let TER = null;
function terrainOf(T) { if (!T || !T.pts || !T.pts.length) return null; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of T.pts) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  const st = Math.max(0.5, Math.sqrt(((x1 - x0) * (y1 - y0) || 1) / T.pts.length)), nx = Math.ceil((x1 - x0) / st) + 1, ny = Math.ceil((y1 - y0) / st) + 1, z = new Float32Array(nx * ny).fill(NaN);
  for (const q of T.pts) { const i = Math.round((q[0] - x0) / st), j = Math.round((q[1] - y0) / st); z[j * nx + i] = q[2]; }
  for (let pass = 0; pass < 4; pass++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (!Number.isNaN(z[k])) continue; let s = 0, n = 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const u = i + a, v = j + b; if (u >= 0 && v >= 0 && u < nx && v < ny && !Number.isNaN(z[v * nx + u])) { s += z[v * nx + u]; n++; } } if (n) z[k] = s / n; }
  return { x0, y0, st, nx, ny, z }; }
function groundAt(p) { const T = TER; if (!T) return 0; const i = Math.max(0, Math.min(T.nx - 1, Math.round((p[0] - T.x0) / T.st))), j = Math.max(0, Math.min(T.ny - 1, Math.round((p[1] - T.y0) / T.st))), v = T.z[j * T.nx + i]; return Number.isNaN(v) ? 0 : v; }
// the site's buildings and the terrain across a sight line from ob to q (q at zA, absolute): true when one of them is in the way
function blockedOutside(ob, q, zA) {
  for (const b of SC.ctx || []) { if (b.id === ob.bid) continue; const P = b.pts; for (let i = 0; i < P.length; i++) { const t = segCross(ob.p, q, P[i], P[(i + 1) % P.length]); if (t < 0) continue; const z = ob.z + (zA - ob.z) * t; if (z >= (b.base || 0) - 0.01 && z <= b.h) return true; } }
  if (TER) { const L = dist(ob.p, q), n = Math.ceil(L / (TER.st / 2)); for (let i = 1; i < n; i++) { /* samples at half the terrain spacing */ const t = i / n, x = [ob.p[0] + (q[0] - ob.p[0]) * t, ob.p[1] + (q[1] - ob.p[1]) * t]; if (groundAt(x) > ob.z + (zA - ob.z) * t + 0.1) return true; } }
  return false; }
// can the onlooker see the spot q (at z above the level's floor)? the window it looks through, or null
function sees(ob, q, zq, o, z0) {
  let win = null; const walls = SC.walls;
  for (const w of walls) { const t = segCross(ob.p, q, w.a, w.b); if (t < 0) continue;
    const X = [ob.p[0] + (q[0] - ob.p[0]) * t, ob.p[1] + (q[1] - ob.p[1]) * t], zX = ob.z + (z0 + zq - ob.z) * t - z0;   // height above this floor where the line meets the wall
    const op = SC.open.find((op) => { const L = dist(op.a, op.b) || 1, u = ((X[0] - op.a[0]) * (op.b[0] - op.a[0]) + (X[1] - op.a[1]) * (op.b[1] - op.a[1])) / (L * L), off = Math.abs((X[0] - op.a[0]) * (op.b[1] - op.a[1]) - (X[1] - op.a[1]) * (op.b[0] - op.a[0])) / L; return u >= 0 && u <= 1 && off < (w.t || 0.2) + 0.05; });
    if (!op) return null;
    if (op.kind === 'door' && (op.ext || !o.doors)) return null;
    if (op.kind === 'win') { if (zX < op.sill || zX > op.head) return null; if (op.ext && !win) win = op; } }
  if (!win) return null;
  if ((SC.ctx && SC.ctx.length || TER) && blockedOutside(ob, q, z0 + zq)) return null;
  for (const f of SC.furn || []) { if (f.h < 0.9) continue; const E = [[f.x, f.y], [f.x + f.w, f.y], [f.x + f.w, f.y + f.d], [f.x, f.y + f.d]]; let tin = Infinity;
    for (let i = 0; i < 4; i++) { const t = segCross(ob.p, q, E[i], E[(i + 1) % 4]); if (t >= 0) tin = Math.min(tin, t); }
    if (q[0] > f.x && q[0] < f.x + f.w && q[1] > f.y && q[1] < f.y + f.d) continue;   // the spot is on the piece itself
    if (tin < Infinity && ob.z + (z0 + zq - ob.z) * tin - z0 < f.h) return null; }
  return win;
}
async function analyse(ui) {
  const o = opts(); if (!o.sides.length) throw new Error('Pick at least one side with a street.');
  const B = sceneBounds(SC), area = SC.rooms.reduce((s, r) => s + r.rects.reduce((a, [, , w, d]) => a + w * d, 0), 0), c = clamp(Math.sqrt(area / 2500), 0.3, 0.75);
  const R = raster(B, c), N = R.W * R.H, room = new Int16Array(N).fill(-1);
  SC.rooms.forEach((r, ri) => { for (const [x, y, w, d] of r.rects) { const i0 = Math.max(0, Math.ceil((x - R.x0) / c - 0.5)), i1 = Math.min(R.W - 1, Math.floor((x + w - R.x0) / c - 0.5)), j0 = Math.max(0, Math.ceil((y - R.y0) / c - 0.5)), j1 = Math.min(R.H - 1, Math.floor((y + d - R.y0) / c - 0.5));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) room[j * R.W + i] = ri; } });
  const cells = []; for (let k = 0; k < N; k++) if (room[k] >= 0) cells.push(k);
  const obs = onlookers(o), z0 = SC.settings?.floorZ || 0, seen = new Uint16Array(N), winHits = new Map(), lines = new Map();
  ui.say(`${obs.length} onlookers, ${cells.length} spots…`);
  const WIN = new Map();   // per window (2026-11-19): the onlookers who see in through it and the spots of floor they see
  const ok = await sliced(obs.length, (i) => { const ob = obs[i]; for (const k of cells) { const w = sees(ob, centre(R, k), 1.2, o, z0); if (!w) continue; seen[k]++;
    { let e = WIN.get(w); if (!e) WIN.set(w, e = { obs: new Set(), spots: new Set() }); e.obs.add(i); e.spots.add(k); }
    const need = needOf(SC.rooms[room[k]].name); if (need === 'high' || need === 'medium') winHits.set(w, (winHits.get(w) || 0) + 1); } }, { onProg: ui.prog });
  if (!ok) return;
  const exp = new Float32Array(N).fill(NaN); for (const k of cells) exp[k] = 100 * seen[k] / obs.length;
  const rooms = SC.rooms.map((r, ri) => { const ks = cells.filter((k) => room[k] === ri), s = ks.filter((k) => seen[k] > 0).length; return { r, need: needOf(r.name), n: ks.length, share: ks.length ? 100 * s / ks.length : 0, mean: ks.length ? ks.reduce((a, k) => a + exp[k], 0) / ks.length : 0, area: ks.length * c * c }; });
  RES = { key: setKey(), R, c, exp, room, cells, obs, rooms, winHits, o, z0, WIN }; RES.windows = windowRisk(RES); IMG = null; ui.prog(1);
  
}
// the room a window belongs to: the one just inside it
function winRoom(w) { const m = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2], L = dist(w.a, w.b) || 1, n = [-(w.b[1] - w.a[1]) / L, (w.b[0] - w.a[0]) / L];
  for (const sg of [1, -1]) { const p = [m[0] + n[0] * 0.4 * sg, m[1] + n[1] * 0.4 * sg], r = SC.rooms.find((r) => r.rects.some(([x, y, ww, d]) => p[0] >= x && p[0] <= x + ww && p[1] >= y && p[1] <= y + d)); if (r) return r.name; } return 'Window'; }
function figures() {
  if (!RES) return null; const all = RES.cells.length, seenAll = RES.cells.filter((k) => RES.exp[k] > 0).length;
  const priv = RES.cells.filter((k) => needOf(SC.rooms[RES.room[k]].name) === 'high'), privSeen = priv.filter((k) => RES.exp[k] > 0).length;
  const toScreen = RES.rooms.filter((x) => LIMIT[x.need] != null && x.share > LIMIT[x.need]);
  const wins = [...RES.winHits.entries()].filter(([, n]) => n >= Math.max(3, RES.obs.length * 0.02)).sort((a, b) => b[1] - a[1]);
  const worst = RES.rooms.filter((x) => x.need !== 'none' && x.n).sort((a, b) => b.share - a.share)[0];
  return { floor: all ? 100 * seenAll / all : 0, priv: priv.length ? 100 * privSeen / priv.length : 0, hasPriv: priv.length > 0, toScreen, wins, worst };
}

export async function run(scene, o, prog) { SC = { ...scene, walls: scene.walls || [], open: scene.open || [], rooms: scene.rooms || [], furn: scene.furn || [], ctx: scene.ctx || [] }; OPTS = o; RES = null; TER = terrainOf(scene.terrain);
  await analyse({ say() {}, prog: prog || (() => {}) }); if (!RES) throw Error('Stopped.'); return { SC, RES, F: figures(), winRoom, needOf, windows: RES.windows }; }
export { EXP, NEED, NEEDT, LIMIT };

// ---- window risk (2026-11-19) -------------------------------------------------------------------------------------------------------
// One definition, used by the plan and the 3D view alike: the classes, their colours and the thresholds on the score.
export const RISK = { high: { col: '#d8402a', name: 'High risk', note: 'Higher exposure' }, medium: { col: '#e8b923', name: 'Medium risk', note: 'Medium exposure' },
  low: { col: '#2f9e5b', name: 'Low risk', note: 'Lower exposure' }, na: { col: '#9aa0a6', name: 'Not analysed', note: 'Not analysed' } };
export const RISK_AT = { medium: 15, high: 40 };   // score (0–100) at which a window is Medium, High
export const NEEDW = { high: 1, medium: 0.7, low: 0.35, none: 0.1 };   // a low-need room is Medium at most, a no-need one Low   // the weight of the room's privacy need
export const W_SEEN = 0.6, W_FLOOR = 0.4, NEAR_M = 8;   // the score's two parts; onlookers nearer than NEAR_M count in full, farther ones NEAR_M / d
export const riskOf = (score) => (score == null || !Number.isFinite(score) ? 'na' : score >= RISK_AT.high ? 'high' : score >= RISK_AT.medium ? 'medium' : 'low');
export const riskCol = (score) => RISK[riskOf(score)].col;
export const SIDE_NAME = { top: 'Top', right: 'Right', bottom: 'Bottom', left: 'Left' };
const near = (d) => Math.min(1, NEAR_M / Math.max(d, 0.1));
// the fingerprint of a window and what it looks onto: a saved result applies to it only while this is unchanged
export const winSig = (op) => JSON.stringify([op.a, op.b, op.sill, op.head, op.ext]);
/** every window of the level with its score. score = 100 × need weight × (W_SEEN × seen + W_FLOOR × floor), where
 *  seen  = the share of the onlookers in front of the window (on its outer side) who see into the building through it, each counted
 *          by closeness (1 within NEAR_M, NEAR_M / distance beyond),
 *  floor = the share of the floor of the room behind it that those onlookers see through it (spots 1.2 m above the floor).
 *  Windows in inside walls are not analysed. */
function windowRisk(RES) {
  const out = [], box = wallBox(SC), cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  const roomAt = (p) => SC.rooms.findIndex((r) => r.rects.some(([x, y, w, d]) => p[0] >= x && p[0] <= x + w && p[1] >= y && p[1] <= y + d));
  for (const op of SC.open) { if (op.kind !== 'win') continue; const m = [(op.a[0] + op.b[0]) / 2, (op.a[1] + op.b[1]) / 2], L = dist(op.a, op.b) || 1, nrm = [-(op.b[1] - op.a[1]) / L, (op.b[0] - op.a[0]) / L];
    const base = { id: op.id, sig: winSig(op), a: op.a, b: op.b, sill: op.sill, head: op.head, width: +L.toFixed(2) };
    if (!op.ext) { out.push({ ...base, score: null, risk: 'na', why: 'A window in an inside wall: only windows in outside walls are analysed.' }); continue; }
    // the outer side: the one with no room just beyond the glass (or the one away from the middle of the plan)
    const rA = roomAt([m[0] + nrm[0] * 0.4, m[1] + nrm[1] * 0.4]), rB = roomAt([m[0] - nrm[0] * 0.4, m[1] - nrm[1] * 0.4]);
    let n = nrm; if (rA >= 0 && rB < 0) n = [-nrm[0], -nrm[1]]; else if (!(rB >= 0 && rA < 0) && nrm[0] * (m[0] - cx) + nrm[1] * (m[1] - cy) < 0) n = [-nrm[0], -nrm[1]];
    const ri = roomAt([m[0] - n[0] * 0.4, m[1] - n[1] * 0.4]), rm = ri >= 0 ? SC.rooms[ri] : null, need = rm ? needOf(rm.name) : 'low';
    const e = RES.WIN.get(op), zW = RES.z0 + ((op.sill || 0) + (op.head || 2.1)) / 2, dOf = (ob) => Math.hypot(ob.p[0] - m[0], ob.p[1] - m[1], ob.z - zW);
    let wAll = 0, wSeen = 0; const groups = new Map();
    RES.obs.forEach((ob, i) => { if ((ob.p[0] - m[0]) * n[0] + (ob.p[1] - m[1]) * n[1] <= 0) return; const d = dOf(ob), w = near(d); wAll += w; if (!e || !e.obs.has(i)) return; wSeen += w;
      const key = ob.kind === 'nearby' ? 'nearby' : ob.kind + ':' + ob.side, g = groups.get(key) || { key, kind: ob.kind, side: ob.side, w: 0, n: 0, d0: Infinity, d1: 0 }; g.w += w; g.n++; g.d0 = Math.min(g.d0, d); g.d1 = Math.max(g.d1, d); groups.set(key, g); });
    const roomCells = ri >= 0 ? RES.cells.filter((k) => RES.room[k] === ri) : [], seenCells = e ? roomCells.filter((k) => e.spots.has(k)).length : 0;
    const seen = wAll ? wSeen / wAll : 0, floor = roomCells.length ? seenCells / roomCells.length : 0, score = Math.round(100 * NEEDW[need] * (W_SEEN * seen + W_FLOOR * floor));
    const top = [...groups.values()].sort((a, b) => b.w - a.w)[0], ang = Math.atan2(n[1], n[0]) * 180 / Math.PI, faces = ang >= 45 && ang < 135 ? 'top' : ang >= -45 && ang < 45 ? 'right' : ang >= -135 && ang < -45 ? 'bottom' : 'left';
    const from = top ? { kind: top.kind, side: top.side, share: wSeen ? top.w / wSeen : 0, n: top.n, d0: +top.d0.toFixed(1), d1: +top.d1.toFixed(1),
      label: top.kind === 'street' ? `the street on the ${SIDE_NAME[top.side]} side` : top.kind === 'opposite' ? `the building opposite on the ${SIDE_NAME[top.side]} side` : 'the windows of nearby buildings' } : null;
    out.push({ ...base, score, risk: riskOf(score), need, room: rm ? rm.name : '', seen: +(100 * seen).toFixed(1), floor: +(100 * floor).toFixed(1), nSeen: e ? e.obs.size : 0, nFront: [...RES.obs].filter((ob) => (ob.p[0] - m[0]) * n[0] + (ob.p[1] - m[1]) * n[1] > 0).length,
      faces, bearing: Math.round((90 - ang + 360) % 360), from }); }
  return out;
}
// one onlooker of the last run (2026-11-14): the floor spots they see and the windows they see them through, for a passer-by walked
// along the street; the same test as the study, for one person (about spots × walls)
export function seesFrom(i) { if (!RES || !RES.obs[i]) return null; const ob = RES.obs[i], seen = [], wins = new Set(); for (const k of RES.cells) { const w = sees(ob, centre(RES.R, k), 1.2, RES.o, RES.z0); if (w) { seen.push(k); wins.add(w); } } return { ob, seen, wins: [...wins] }; }
