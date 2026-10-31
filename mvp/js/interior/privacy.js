// Privacy (2026-10-31): the analysis of the Privacy study (emb/privacy.html), unchanged, for the Workspace: onlookers along the
// street and in the windows of a building opposite; for every spot of the floor (1.2 m up), the share of them that see it through
// a window, checked against each window's sill and head and furniture taller than the line of sight.
import { clamp, r1, raster, centre, sliced, keep, ROOM_SKIP, sceneBounds, wallBox, segCross, dist } from '../../../emb/lib/plansim.js?v=1';
let SC = null, RES = null, OPTS = null, IMG = null;   // IMG: the study page's picture cache, unused here
 const opts = () => OPTS, setKey = () => '';
const EXP = [[0, [255, 255, 255]], [0.02, [255, 238, 170]], [0.3, [250, 170, 70]], [0.65, [220, 70, 50]], [1, [140, 20, 40]]];
const NEED = { high: [216, 64, 42], medium: [245, 166, 35], low: [180, 200, 120], none: [210, 210, 205] }, NEEDT = { high: 'High', medium: 'Medium', low: 'Low', none: 'None' };
const LIMIT = { high: 10, medium: 25 };   // % of a room's floor seen before it needs a screen
const needOf = (name) => { const o = keep.get('privacy:' + (SC.source?.project || 'sample'), {})[name]; if (o) return o;
  if (/bed|bath|wc|toilet|shower|en-?suite|master|nursery|卧|浴|厕|卫/i.test(name)) return 'high';
  if (/living|lounge|study|office|family|sitting|den|客厅|书房/i.test(name)) return 'medium';
  if (ROOM_SKIP.test(name) || /garage|store|storage|utility|plant|车库|储/i.test(name)) return 'none'; return 'low'; };
// onlookers: along the street lines at eye height, and in the windows of the building opposite (every 3 m up to its height)
function onlookers(o) {
  const B = wallBox(SC), z0 = SC.settings?.floorZ || 0, out = [];
  const line = (side, d) => { const m = 1.5; if (side === 'top' || side === 'bottom') { const y = side === 'top' ? B.y1 + d : B.y0 - d, pts = []; for (let x = B.x0 - d; x <= B.x1 + d + 1e-6; x += m) pts.push([x, y]); return pts; }
    const x = side === 'right' ? B.x1 + d : B.x0 - d, pts = []; for (let y = B.y0 - d; y <= B.y1 + d + 1e-6; y += m) pts.push([x, y]); return pts; };
  for (const s of o.sides) { for (const p of line(s, o.dS)) out.push({ p, z: o.eye, kind: 'street', side: s });
    if (o.dO > o.dS && o.hO >= 1) for (let z = 1.5; z <= o.hO + 1e-6; z += 3) for (const p of line(s, o.dO)) out.push({ p, z, kind: 'opposite', side: s }); }
  void z0; return out;
}
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
  const ok = await sliced(obs.length, (i) => { const ob = obs[i]; for (const k of cells) { const w = sees(ob, centre(R, k), 1.2, o, z0); if (!w) continue; seen[k]++;
    const need = needOf(SC.rooms[room[k]].name); if (need === 'high' || need === 'medium') winHits.set(w, (winHits.get(w) || 0) + 1); } }, { onProg: ui.prog });
  if (!ok) return;
  const exp = new Float32Array(N).fill(NaN); for (const k of cells) exp[k] = 100 * seen[k] / obs.length;
  const rooms = SC.rooms.map((r, ri) => { const ks = cells.filter((k) => room[k] === ri), s = ks.filter((k) => seen[k] > 0).length; return { r, need: needOf(r.name), n: ks.length, share: ks.length ? 100 * s / ks.length : 0, mean: ks.length ? ks.reduce((a, k) => a + exp[k], 0) / ks.length : 0, area: ks.length * c * c }; });
  RES = { key: setKey(), R, c, exp, room, cells, obs, rooms, winHits, o, z0 }; IMG = null; ui.prog(1);
  
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

export async function run(scene, o, prog) { SC = { ...scene, walls: scene.walls || [], open: scene.open || [], rooms: scene.rooms || [], furn: scene.furn || [] }; OPTS = o; RES = null;
  await analyse({ say() {}, prog: prog || (() => {}) }); if (!RES) throw Error('Stopped.'); return { SC, RES, F: figures(), winRoom, needOf }; }
export { EXP, NEED, NEEDT, LIMIT };
