// Wayfinding (2026-10-31): the analysis of the Wayfinding study (emb/wayfinding.html), for the Workspace, unchanged but for one marked fix
// (doorways walkable whatever the grid): from a start
// (a door to outside or a room), the shortest walk to every room's door, the decision points where routes split, whether each door
// is in sight there (else a sign), and the visual depth of the floor: 0 where the start sees, 1 one look-around on, and so on.
import { clamp, r1, ramp, raster, paintSeg, paintRect, cellOf, centre, los, march, sliced, wallPieces, ROOM_SKIP, sceneBounds, dist } from '../../../emb/lib/plansim.js?v=1';
let SC = null, RES = null, OPTS = { start: '', furn: false }, EYE = 1.6, IMG = null; const setKey = () => '';
const F_WALL = 1, F_FURN = 2, F_IN = 4, F_OUT = 8, S_OPQ = 1, S_FURN = 2;
const DEPTH = [[0, [46, 160, 90]], [0.34, [240, 205, 80]], [0.67, [240, 140, 60]], [1, [200, 50, 50]]];
const depthCol = (d) => ramp(DEPTH, Math.min(d, 3) / 3);

// ---- the start: each door to the outside, else a room
function starts() {
  const out = [];
  SC.open.filter((o) => o.kind === 'door' && o.ext).forEach((o, i) => { const m = [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2], dx = o.b[0] - o.a[0], dy = o.b[1] - o.a[1], L = Math.hypot(dx, dy) || 1, n = [-dy / L, dx / L];
    const inRoom = (p) => SC.rooms.some((r) => r.rects.some(([x, y, w, d]) => p[0] >= x && p[0] <= x + w && p[1] >= y && p[1] <= y + d));
    const p = [m[0] + n[0] * 0.5, m[1] + n[1] * 0.5], q = [m[0] - n[0] * 0.5, m[1] - n[1] * 0.5]; out.push({ id: 'd' + i, name: `Door to outside ${i + 1} (${r1(o.w || L)} m)`, p: inRoom(p) ? p : q, door: o }); });
  SC.rooms.forEach((r, i) => out.push({ id: 'r' + i, name: `Room: ${r.name}`, p: r.label || [r.rects[0][0] + r.rects[0][2] / 2, r.rects[0][1] + r.rects[0][3] / 2], room: r }));
  return out;
}
// ---- the analysis
async function analyse(ui) {
  const B = sceneBounds(SC), area = B.x1 * B.y1, c = clamp(Math.sqrt(area / 30000), 0.2, 0.5);
  const R = raster(B, c), SR = raster(B, c), walkFurn = OPTS.furn;
  for (const r of SC.rooms) for (const [x, y, w, d] of r.rects) paintRect(R, x, y, w, d, F_IN);
  // (Workspace fix, 2026-10-31) a doorway lies in the wall's thickness, in no room: its floor counts as inside, so a door is always walkable
  for (const o of SC.open) if (o.kind === 'door' || o.kind === 'hole') paintSeg(R, o.a, o.b, 0.3, F_IN);
  for (let k = 0; k < R.a.length; k++) if (!(R.a[k] & F_IN)) R.a[k] |= F_OUT;
  for (const w of SC.walls) { for (const [a, b] of wallPieces(w, SC.open, ['door', 'hole'])) { paintSeg(R, a, b, (w.t || 0.2) / 2 + 0.12, F_WALL); paintSeg(SR, a, b, (w.t || 0.2) / 2, S_OPQ); } }
  for (const f of SC.furn || []) { if (walkFurn && f.h > 0.3) paintRect(R, f.x, f.y, f.w, f.d, F_FURN, 0.05); if (f.h >= EYE) paintRect(SR, f.x, f.y, f.w, f.d, S_FURN); }
  const free = (k) => k >= 0 && !(R.a[k] & (F_WALL | F_FURN | F_OUT)), N = R.W * R.H;
  const S = starts(), st = S.find((s) => s.id === OPTS.start) || S[0]; if (!st) throw new Error('No rooms on this level.');
  // the start cell: the free cell nearest the start point
  const nearestFree = (p, maxR = 3) => { let best = -1, bd = Infinity; const k0 = cellOf(R, p); if (free(k0)) return k0; const n = Math.ceil(maxR / c), i0 = Math.floor((p[0] - R.x0) / c), j0 = Math.floor((p[1] - R.y0) / c);
    for (let j = j0 - n; j <= j0 + n; j++) for (let i = i0 - n; i <= i0 + n; i++) { if (i < 0 || j < 0 || i >= R.W || j >= R.H) continue; const k = j * R.W + i; if (!free(k)) continue; const d = dist(centre(R, k), p); if (d < bd) { bd = d; best = k; } } return best; };
  const s0 = nearestFree(st.p); if (s0 < 0) throw new Error('The start is not on free floor.');
  ui.say('Walking every route…'); ui.prog(0.05);
  // shortest walks (8 directions, no cutting corners)
  const D = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1); D[s0] = 0;
  { const heap = [[0, s0]], push = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return t; };
    const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    while (heap.length) { const [d, k] = pop(); if (d > D[k]) continue; const i = k % R.W, j = (k / R.W) | 0;
      for (const [di, dj, w] of NB) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= R.W || b >= R.H) continue; const q = b * R.W + a; if (!free(q)) continue; if (di && dj && (!free(j * R.W + a) || !free(b * R.W + i))) continue;
        const nd = d + w * c; if (nd < D[q]) { D[q] = nd; prev[q] = k; push([nd, q]); } } } }
  // each room: its door is the room cell reached first; the route is pulled tight
  const rooms = [], wl = (p, q) => los(R, p, q, F_WALL | F_FURN | F_OUT);
  for (const r of SC.rooms) {
    if (st.room === r) continue; let best = -1, bd = Infinity;
    for (const [x, y, w, d] of r.rects) { const i0 = Math.max(0, Math.floor((x - R.x0) / c)), i1 = Math.min(R.W - 1, Math.floor((x + w - R.x0) / c)), j0 = Math.max(0, Math.floor((y - R.y0) / c)), j1 = Math.min(R.H - 1, Math.floor((y + d - R.y0) / c));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * R.W + i, cc = centre(R, k); if (cc[0] < x + c * 0.5 || cc[0] > x + w - c * 0.5 || cc[1] < y + c * 0.5 || cc[1] > y + d - c * 0.5) continue; if (D[k] < bd) { bd = D[k]; best = k; } } }
    const skip = ROOM_SKIP.test(r.name);
    if (best < 0 || !Number.isFinite(bd)) { rooms.push({ r, skip, unreached: true }); continue; }
    const cells = []; for (let k = best; k >= 0; k = prev[k]) cells.push(centre(R, k)); cells.reverse(); cells[0] = st.p;
    const pts = [cells[0]]; let i = 0; while (i < cells.length - 1) { let j = Math.min(cells.length - 1, i + 400); while (j > i + 1 && !wl(cells[i], cells[j])) j--; pts.push(cells[j]); i = j; }
    let turns = 0; for (let t = 1; t < pts.length - 1; t++) { const a = Math.atan2(pts[t][1] - pts[t - 1][1], pts[t][0] - pts[t - 1][0]), b = Math.atan2(pts[t + 1][1] - pts[t][1], pts[t + 1][0] - pts[t][0]); let da = Math.abs(b - a); if (da > Math.PI) da = 2 * Math.PI - da; if (da > 0.44) turns++; }
    // the door of the room: the opening nearest where the walk enters it (its middle is what people look for)
    const end = centre(R, best); let door = end, dd = 1.2, op = null;
    for (const o of SC.open) { if (o.kind === 'win') continue; const m = [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2], e = dist(m, end); if (e < dd) { dd = e; door = m; op = o; } }
    pts.push(door);
    // what counts as seeing the door: any of a few points across the doorway, just either side of it
    const marks = [door]; if (op) { const L = dist(op.a, op.b) || 1, n = [-(op.b[1] - op.a[1]) / L, (op.b[0] - op.a[0]) / L];
      for (const u of [0.25, 0.5, 0.75]) for (const sgn of [-1, 1]) marks.push([op.a[0] + (op.b[0] - op.a[0]) * u + n[0] * 0.25 * sgn, op.a[1] + (op.b[1] - op.a[1]) * u + n[1] * 0.25 * sgn]); }
    rooms.push({ r, skip, pts, len: bd, turns, door, marks });
  }
  ui.prog(0.2);
  // decision points: places where the routes go off in different directions
  const routes = rooms.filter((x) => x.pts && !x.skip), cand = [];
  for (const x of routes) for (let t = 1; t < x.pts.length - 1; t++) cand.push(x.pts[t]);
  const clusters = []; for (const p of cand) { const cl = clusters.find((q) => dist(q.p, p) < 1.1); if (cl) { cl.n++; cl.p = [(cl.p[0] * (cl.n - 1) + p[0]) / cl.n, (cl.p[1] * (cl.n - 1) + p[1]) / cl.n]; } else clusters.push({ p, n: 1 }); }
  const segNear = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L, 0, 1) : 0; return [Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]), t]; };
  const outDir = (x, p) => { for (let t = 0; t < x.pts.length - 1; t++) { const [d, u] = segNear(p, x.pts[t], x.pts[t + 1]); if (d < 0.8) { const nx = u > 0.97 && t + 2 < x.pts.length ? [x.pts[t + 1], x.pts[t + 2]] : [x.pts[t], x.pts[t + 1]]; if (dist(nx[1], p) < 0.6) return 'end'; return Math.atan2(nx[1][1] - p[1], nx[1][0] - p[0]); } } return null; };
  const sightOK = (p, q) => los(SR, p, q, S_OPQ | S_FURN), seesDoor = (p, x) => x.marks.some((q) => sightOK(p, q));
  const decisions = [];
  for (const cl of clusters) { const by = []; for (const x of routes) { const a = outDir(x, cl.p); if (a == null || a === 'end') continue; by.push([x, a]); }
    const dirs = []; for (const [, a] of by) if (!dirs.some((b) => { let d = Math.abs(a - b); if (d > Math.PI) d = 2 * Math.PI - d; return d < 0.5; })) dirs.push(a);
    if (dirs.length < 2) continue;
    const hidden = by.filter(([x]) => !seesDoor(cl.p, x)).map(([x]) => x.r.name);
    decisions.push({ p: cl.p, ways: dirs.length, routes: by.length, hidden: [...new Set(hidden)] }); }
  const startHidden = routes.filter((x) => !seesDoor(st.p, x)).map((x) => x.r.name);
  ui.say('Looking around: visual depth…');
  // visual depth: 0 where the start sees, 1 where a spot seen from it sees, and so on
  const depth = new Float32Array(N).fill(NaN), NR = 300, maxD = Math.hypot(B.x1, B.y1), m = Math.max(1, Math.round(0.7 / c));
  let src = [s0], level = 0;
  const look = (k, lv, out) => { const p = centre(R, k); if (Number.isNaN(depth[k]) && (R.a[k] & F_IN)) { depth[k] = lv; out.push(k); } for (let r = 0; r < NR; r++) { const a = (r / NR) * 2 * Math.PI; march(SR, p, Math.cos(a), Math.sin(a), S_OPQ | S_FURN, maxD, (q) => { if (!(R.a[q] & F_IN)) return; if (Number.isNaN(depth[q])) { depth[q] = lv; out.push(q); } }); } };
  while (src.length && level < 8) {
    const fresh = []; const ok = await sliced(src.length, (i) => look(src[i], level, fresh), { onProg: (f) => ui.prog(0.25 + 0.7 * (level + f) / 6) }); if (!ok) break;
    src = fresh.filter((k) => (k % R.W) % m === 0 && ((k / R.W) | 0) % m === 0 && free(k)); if (!src.length && fresh.length) src = [fresh[0]];
    level++;
  }
  for (const x of rooms) { if (!x.marks) { x.depth = NaN; continue; } const ds = x.marks.map((q) => depth[cellOf(R, q)]).filter((d) => d >= 0); x.depth = ds.length ? Math.min(...ds) : NaN; }
  RES = { key: setKey(), R, c, D, depth, rooms, decisions, start: st, startHidden, level }; IMG = null; ui.prog(1);
  const vis = rooms.filter((x) => !x.skip && x.pts);
  ui.say(`${vis.length} rooms routed, ${decisions.length} decision point${decisions.length === 1 ? '' : 's'}.`, 'ok');
  
}

// ---- figures
function figures() {
  if (!RES) return null; const vis = RES.rooms.filter((x) => !x.skip && x.pts), seen = vis.filter((x) => x.depth === 0).length;
  const signs = RES.decisions.filter((d) => d.hidden.length).length + (RES.startHidden.length ? 1 : 0), md = vis.length ? vis.reduce((s, x) => s + (Number.isFinite(x.depth) ? x.depth : 3), 0) / vis.length : 0;
  const longest = vis.slice().sort((a, b) => b.len - a.len)[0], hard = vis.filter((x) => !(x.depth < 2) || x.turns >= 3);
  return { vis, seen, signs, md, longest, hard };
}

export function startsOf(scene) { SC = scene; return starts(); }
export async function run(scene, o, prog) { SC = { ...scene, walls: scene.walls || [], open: scene.open || [], rooms: scene.rooms || [], furn: scene.furn || [] }; OPTS = { start: o.start || '', furn: !!o.furn }; EYE = o.eye || 1.6; RES = null;
  await analyse({ say() {}, prog: prog || (() => {}) }); if (!RES) throw Error('Stopped.'); return { SC, RES, F: figures() }; }
export { DEPTH, depthCol };
