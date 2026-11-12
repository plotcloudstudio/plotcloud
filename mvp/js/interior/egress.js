// Hospital evacuation (2026-11-01): the whole building, every level and its stairs, in the Workspace. Progressive horizontal
// evacuation first (the patients of the compartment where the fire starts are moved through a smoke-compartment door into the next
// compartment on the same floor), then, if chosen, down the stairs and out. A screening model for early design, run many times
// with random inputs; not a code compliance check, and no fire or smoke is computed (no ASET).
//
// Model, in short. Each level is a 0.5 m grid of the floor (rooms of the model, walls, door openings, furniture as obstacles). Beds
// move on a grid that needs about 1 m clear. People move cell to cell down a distance field to their goal, one unit per cell (4
// people per m² at most), slowed by the crowd round them (SFPE: v = v0 (1 − 0.266 D) above 0.54 p/m²); a door lets through at most
// 1.32 people per second per metre of effective width and a stair flight 1.01 (SFPE specific flows, 0.15 m boundary layer each side). Staff are the scarce resource: a patient
// who needs help waits for one member of staff (two for a bed), who walks to them, takes them to the goal and goes back for the next.
// Stairs join the levels in order; on the way down each flight is a queue, and people from the floors above merge at each landing.
// Random in each run: where the fire starts (or a chosen room), each patient's mobility, reaction times and walking speeds.
// Default values are assumptions to edit, with sources named in the study card; CSA Z8000 and the NBC set the design context.

const NB8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
const CIRC = /corridor|hall|lobby|passage|circulation|走廊|过道|大厅/i;
// spaces with 'room' in their name that are not where patients stay (2026-11-10: the hospital example's support and public rooms)
const NOT_PATIENT = /corridor|hall|lobby|passage|circulation|stair|lift|elevator|toilet|\bwc\b|bath|shower|ensuite|washroom|store|storage|utility|clean|dirty|soiled|plant|station|office|nurse|staff|reception|kitchen|ante|vestibule|lounge|consult|exam|procedure|chapel|multifaith|imaging|x-ray|control|lab|specimen|pharmacy|medication|change|locker|mechanical|electrical|server|receiving|security|registration|waiting|caf[eé]|gift|entrance|records|janitor|housekeeping|linen|equipment|nourishment|\bit\b|comms|data|meeting|seminar|training|workroom|break|switch|sluice|disposal|走廊|楼梯|卫生|储/i;
const PATIENT = /ward|patient|bed|icu|recovery|room|病房|病室/i;
const STAFFROOM = /nurse|station|staff|护士/i;
// movement parameters (2026-11-10, from the PlotCloud evacuation research note): SFPE hydraulic values (Gwynne & Rosenbaum, SFPE
// Handbook 5th ed.): specific flow 1.32 p/s/m of effective width through doors, 1.01 on a 7/11 stair, a boundary layer of 0.15 m
// each side; free speed 1.19 m/s level (k 1.40) and 0.92 m/s along a 7/11 stair (k 1.08); walking-aid users about 0.8 m/s
// (Boyce, Shields & Silcock 1999); preparing a patient for an assistance device: 29 s evacuation chair, 31 s bed, 53 s rescue
// sheet on the stair (Joyce, Lawrence & Galea 2020, Table 2, after Hunt, Galea & Lawrence 2015 and Hoondert & Peters 2019); children
// 3–6 years 0.84 m/s level (SD 0.25), 0.38–0.58 m/s on stairs (Larusdottir & Dederichs 2011, Table 1)
export const MOVE = { doorFs: 1.32, stairFs: 1.01, layer: 0.15, vLevel: 1.19, vStair: 0.92, vAid: 0.8, prepChair: 29, prepBed: 31, prepSheet: 53, vChild: 0.84, vChildStair: 0.48, vWheel: 0.69, vOlder: 1.0, vChairStair: 0.35, refugeWait: 120 };
const effW = (w) => Math.max(0.3, w - 2 * MOVE.layer);
export const DEFAULTS = { cell: 0.5, mix: { amb: 0.4, asst: 0.35, bed: 0.25 }, ratio: 4, strategy: 'horizontal', runs: 20, seed: 1, fire: 'random', horizon: 3600 };

function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const normal = (r) => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const logn = (r, med, s) => med * Math.exp(s * normal(r));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const segDist = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? clamp(((px - a[0]) * dx + (py - a[1]) * dy) / L, 0, 1) : 0; return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy); };
const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const polyDist = (x, y, P) => { if (inPoly(x, y, P)) return 0; let d = Infinity; for (let i = 0; i < P.length; i++) d = Math.min(d, segDist(x, y, P[i], P[(i + 1) % P.length])); return d; };
const pct = (a, q) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };

// ---- the building, prepared once: grids, rooms, doors, compartments, stairs, fields --------------------------------------------
// building: { levels: [{ id, name, z, h, sc }], stairs: [{ id, lv, top, corners (plan), w, d, name }] }; o: { cell, compDoors: [ids] | null }
export function prepare(building, o = {}) {
  const c = o.cell || DEFAULTS.cell, L0 = building.levels, O = L0[0].sc.origin || [0, 0], W = Math.ceil(L0[0].sc.bounds.w / c), H = Math.ceil(L0[0].sc.bounds.h / c), N = W * H;
  const ctr = (k) => [((k % W) + 0.5) * c, (((k / W) | 0) + 0.5) * c], cellAt = (x, y) => { const i = Math.floor(x / c), j = Math.floor(y / c); return i < 0 || j < 0 || i >= W || j >= H ? -1 : j * W + i; };
  const stairIds = new Set(building.stairs.map((s) => s.id)), levels = [], doors = [];
  for (const [li, Lv] of L0.entries()) {
    const sc = Lv.sc, rooms = (sc.rooms || []).map((r, ri) => ({ ri, li, id: r.id, name: r.name || 'Room', rects: r.rects, label: r.label, area: r.rects.reduce((s, q) => s + q[2] * q[3], 0) }));
    const room = new Int16Array(N).fill(-1), walk = new Uint8Array(N), door = new Int32Array(N).fill(-1);
    for (const r of rooms) for (const [x, y, w, h] of r.rects) { const i0 = Math.max(0, Math.floor(x / c)), i1 = Math.min(W - 1, Math.ceil((x + w) / c)), j0 = Math.max(0, Math.floor(y / c)), j1 = Math.min(H - 1, Math.ceil((y + h) / c));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * W + i, [px, py] = ctr(k); if (px >= x && px <= x + w && py >= y && py <= y + h && room[k] < 0) { room[k] = r.ri; walk[k] = 1; } } }
    // walls block what they cross; door openings are cut through them
    for (const w of sc.walls || []) { const t = (w.t || 0.2) / 2 + c * 0.45, xs = [w.a[0], w.b[0]], ys = [w.a[1], w.b[1]], i0 = Math.max(0, Math.floor((Math.min(...xs) - t) / c)), i1 = Math.min(W - 1, Math.ceil((Math.max(...xs) + t) / c)), j0 = Math.max(0, Math.floor((Math.min(...ys) - t) / c)), j1 = Math.min(H - 1, Math.ceil((Math.max(...ys) + t) / c));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * W + i, [px, py] = ctr(k); if (segDist(px, py, w.a, w.b) < t) walk[k] = 0; } }
    for (const op of sc.open || []) { if (op.kind !== 'door' && op.kind !== 'hole') continue; const di = doors.length, len = Math.hypot(op.b[0] - op.a[0], op.b[1] - op.a[1]); if (len < 0.5) continue;
      const nx = -(op.b[1] - op.a[1]) / len, ny = (op.b[0] - op.a[0]) / len, mid = [(op.a[0] + op.b[0]) / 2, (op.a[1] + op.b[1]) / 2], side = (s) => { for (let off = 0.35; off <= 1.2; off += 0.1) { const k = cellAt(mid[0] + nx * off * s, mid[1] + ny * off * s); if (k >= 0 && room[k] >= 0) return room[k]; } return -1; };
      const d = { di, id: op.id, li, w: len, ext: !!op.ext, a: op.a, b: op.b, mid, n: [nx, ny], cells: [], sides: [side(1), side(-1)], tokens: 0 };
      const span = 0.4, xs = [op.a[0], op.b[0]], ys = [op.a[1], op.b[1]], i0 = Math.max(0, Math.floor((Math.min(...xs) - span) / c)), i1 = Math.min(W - 1, Math.ceil((Math.max(...xs) + span) / c)), j0 = Math.max(0, Math.floor((Math.min(...ys) - span) / c)), j1 = Math.min(H - 1, Math.ceil((Math.max(...ys) + span) / c));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * W + i, [px, py] = ctr(k), u = ((px - op.a[0]) * (op.b[0] - op.a[0]) + (py - op.a[1]) * (op.b[1] - op.a[1])) / (len * len), v = Math.abs((px - op.a[0]) * nx + (py - op.a[1]) * ny);
        if (u >= 0 && u <= 1 && v < span) { walk[k] = 1; door[k] = di; d.cells.push(k); } }
      if (d.cells.length) doors.push(d); }
    // furniture blocks (stairs are handled as stairs)
    for (const f of sc.furn || []) { if (stairIds.has(f.id) || !(f.h > 0.3)) continue; const i0 = Math.max(0, Math.floor(f.x / c)), i1 = Math.min(W - 1, Math.floor((f.x + f.w) / c)), j0 = Math.max(0, Math.floor(f.y / c)), j1 = Math.min(H - 1, Math.floor((f.y + f.d) / c));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * W + i, [px, py] = ctr(k); if (px > f.x && px < f.x + f.w && py > f.y && py < f.y + f.d && door[k] < 0) walk[k] = 0; } }
    levels.push({ li, id: Lv.id, name: Lv.name, z: Lv.z, h: Lv.h || 3, rooms, room, walk, door, furn: sc.furn || [], walls: sc.walls || [] });
  }
  // stairs: their footprint is closed on the levels they join; the cells round it (0.9 m) are where people get on and off
  const lvIx = new Map(levels.map((L) => [L.id, L.li])), stairs = [];
  for (const s of building.stairs) { const a = lvIx.get(s.lv), b = lvIx.get(s.top); if (a == null || b == null) continue; const P = s.corners.map((p) => [p[0] - O[0], p[1] - O[1]]), acc = {};
    for (const li of [a, b]) { const L = levels[li], cells = []; for (let k = 0; k < N; k++) { const [px, py] = ctr(k); const d = polyDist(px, py, P); if (d === 0) L.walk[k] = 0; } for (let k = 0; k < N; k++) { if (!L.walk[k]) continue; const [px, py] = ctr(k); if (polyDist(px, py, P) <= 0.9) cells.push(k); } acc[li] = cells; }
    const cx = P.reduce((t, p) => t + p[0], 0) / P.length, cy = P.reduce((t, p) => t + p[1], 0) / P.length;
    stairs.push({ si: stairs.length, id: s.id, name: s.name || 'Stair', poly: P, lo: a, hi: b, width: Math.max(0.8, Math.min(s.w, s.d)), centre: [cx, cy], acc, len: Math.max(2, (levels[b].z - levels[a].z) * 1.75) }); }
  // beds need about 1 m clear: the walkable cells whose four neighbours are walkable too (door cells of 1 m and more keep a lane)
  for (const L of levels) { L.bedWalk = new Uint8Array(N); for (let k = 0; k < N; k++) { if (!L.walk[k]) continue; const i = k % W, j = (k / W) | 0; let ok = 0, n = 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; n++; if (L.walk[jj * W + ii]) ok++; } if (ok >= 3) L.bedWalk[k] = 1; } }
  // smoke compartments: a cross-corridor door (circulation on both sides, 1 m wide or more) closes; the floor splits into compartments
  const compSet = o.compDoors ? new Set(o.compDoors) : null;
  for (const d of doors) { const L = levels[d.li], nm = (ri) => (ri >= 0 ? L.rooms[ri].name : ''); d.comp = compSet ? compSet.has(d.id) : !d.ext && d.w >= 0.95 && CIRC.test(nm(d.sides[0])) && CIRC.test(nm(d.sides[1])); }   // a door across a corridor
  for (const L of levels) { const comp = new Int16Array(N).fill(-1); let n = 0;
    for (let s0 = 0; s0 < N; s0++) { if (!L.walk[s0] || comp[s0] >= 0 || (L.door[s0] >= 0 && doors[L.door[s0]].comp)) continue; const q = [s0]; comp[s0] = n;
      for (let h = 0; h < q.length; h++) { const k = q[h], i = k % W, j = (k / W) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; const m = jj * W + ii; if (!L.walk[m] || comp[m] >= 0 || (L.door[m] >= 0 && doors[L.door[m]].comp)) continue; comp[m] = n; q.push(m); } }
      n++; }
    L.comp = comp; L.nComp = n; L.adj = Array.from({ length: n }, () => new Set());
    for (const d of doors) { if (d.li !== L.li || !d.comp) continue; const near = new Set(); for (const k of d.cells) { const i = k % W, j = (k / W) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; const m = jj * W + ii; if (comp[m] >= 0) near.add(comp[m]); } }
      const arr = [...near]; for (const a of arr) for (const b of arr) if (a !== b) L.adj[a].add(b); } }
  const exitLv = levels.filter((L) => doors.some((d) => d.li === L.li && d.ext)).sort((a, b) => a.z - b.z)[0];
  const B = { c, W, H, N, O, levels, doors, stairs, ctr, cellAt, exitLv: exitLv ? exitLv.li : -1, fields: new Map() };
  B.dR = Math.max(2, Math.round(1.25 / c)); B.dA = ((2 * B.dR + 1) * c) ** 2;   // the crowd round a person: a square of about 2.5 m whatever the grid (2026-11-10: was 5 × 5 cells, which slowed a lone walker on a 0.25 m grid)
  B.field = (key, li, targets, bed, block, bkey) => { const k0 = key + '|' + li + '|' + (bed ? 1 : 0) + (block ? '|' + bkey : ''); if (B.fields.has(k0)) return B.fields.get(k0); const f = dijkstra(B, levels[li], targets, bed, block); B.fields.set(k0, f); return f; };
  return B;
}
function dijkstra(B, L, targets, bed, block) {   // block: cells no one may enter (the room of fire origin, a blocked exit)
  const { W, H, N } = B, ok0 = bed ? L.bedWalk : L.walk, ok = block ? Uint8Array.from(ok0, (v, k) => (v && !block[k] ? 1 : 0)) : ok0, F = new Float32Array(N).fill(Infinity), heap = [];
  const push = (k, d) => { heap.push([d, k]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (const k of targets) if ((ok[k] || L.walk[k]) && !(block && block[k])) { F[k] = 0; push(k, 0); }
  while (heap.length) { const [d, k] = pop(); if (Math.fround(d) > F[k]) continue; const i = k % W, j = (k / W) | 0;
    for (const [di, dj, w] of NB8) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; const m = jj * W + ii; if (!ok[m]) continue; if (di && dj && (!ok[j * W + ii] || !ok[jj * W + i])) continue; const nd = Math.fround(d + w); if (nd < F[m]) { F[m] = nd; push(m, nd); } } }
  return F;
}

// ---- who is where (the same in every run): patients by room (beds, or about one per 12 m² of a patient room), staff by floor ----
export function population(B, o = {}) {
  const ratio = o.ratio || DEFAULTS.ratio, pats = [], staff = [];
  for (const L of B.levels) { let nP = 0;
    for (const r of L.rooms) { if (NOT_PATIENT.test(r.name) || !PATIENT.test(r.name)) continue; const cells = []; for (let k = 0; k < B.N; k++) if (L.room[k] === r.ri && L.walk[k]) cells.push(k); if (!cells.length) continue;
      const beds = L.furn.filter((f) => /bed/i.test(f.name || '') && r.rects.some(([x, y, w, h]) => f.x + f.w / 2 >= x && f.x + f.w / 2 <= x + w && f.y + f.d / 2 >= y && f.y + f.d / 2 <= y + h));
      const starts = beds.length ? beds.map((f) => nearest(B, L, B.cellAt(f.x + f.w / 2, f.y + f.d / 2), cells)) : Array.from({ length: Math.max(1, Math.round(r.area / 12)) }, (_, i) => cells[Math.floor((i + 0.5) * cells.length / Math.max(1, Math.round(r.area / 12)))]);
      for (const k of starts) pats.push({ li: L.li, room: r.ri, roomName: r.name, k }); nP += starts.length; }
    if (!nP) continue; const nS = Math.max(2, Math.ceil(nP / ratio))   /* never fewer than two on a floor with patients: a bed needs two to move */, sroom = L.rooms.find((r) => STAFFROOM.test(r.name)) || L.rooms.find((r) => CIRC.test(r.name)), scells = []; for (let k = 0; k < B.N; k++) if (L.walk[k] && (!sroom || L.room[k] === sroom.ri)) scells.push(k);
    for (let i = 0; i < nS; i++) staff.push({ li: L.li, k: scells[Math.floor((i + 0.5) * scells.length / nS)] }); }
  return { pats, staff };
}
function nearest(B, L, k0, cells) { if (k0 >= 0 && L.walk[k0]) return k0; const [x0, y0] = k0 >= 0 ? B.ctr(k0) : [0, 0]; let best = cells[0], bd = Infinity; for (const k of cells) { const [x, y] = B.ctr(k), d = (x - x0) ** 2 + (y - y0) ** 2; if (d < bd) { bd = d; best = k; } } return best; }

// ---- one run -------------------------------------------------------------------------------------------------------------------
// o: { strategy: 'horizontal' | 'down', mix, fire: 'random' | { li, room }, horizon, record }
export function simulate(B, pop, seed, o = {}) {
  const r = rng(seed), dt = 0.5, horizon = o.horizon || DEFAULTS.horizon, mix = o.mix || DEFAULTS.mix, { W, N, levels, doors, stairs } = B;
  const occ = levels.map(() => new Uint8Array(N)), peak = levels.map(() => new Float32Array(N));
  // where the fire starts: a compartment with patients (random each run, or the chosen room's)
  const comps = []; for (const p of pop.pats) { const c0 = levels[p.li].comp[p.k]; if (!comps.some((q) => q.li === p.li && q.c === c0)) comps.push({ li: p.li, c: c0 }); }
  let fire = comps[Math.floor(r() * comps.length)]; if (o.fire && o.fire !== 'random') { const L = levels[o.fire.li]; for (let k = 0; k < N; k++) if (L.room[k] === o.fire.room && L.walk[k]) { fire = { li: L.li, c: L.comp[k] }; break; } }
  if (!fire) throw Error('No patients found: name the patient rooms (ward, patient room, bed…) on the plan.');
  const FL = levels[fire.li], safe = [...FL.adj[fire.c]], horiz = safe.length > 0;
  // the goal cells of the horizontal stage: the next compartments, at least 4 m in from their doors
  const hTargets = (() => { if (!horiz) return []; const cd = []; for (const d of doors) if (d.li === fire.li && d.comp) cd.push(...d.cells); const fromDoor = B.field('cd', fire.li, cd, false), t = []; for (let k = 0; k < N; k++) if (FL.walk[k] && safe.includes(FL.comp[k]) && fromDoor[k] >= 8) t.push(k); if (!t.length) for (let k = 0; k < N; k++) if (FL.walk[k] && safe.includes(FL.comp[k])) t.push(k); return t; })();
  const downCells = (li) => stairs.filter((s) => s.hi === li).flatMap((s) => s.acc[li]), exitCells = (li) => doors.filter((d) => d.li === li && d.ext).flatMap((d) => d.cells);
  const goalField0 = (u, bed) => { const L = u.li;
    if (u.goal === 'h') return B.field('h' + fire.li + ':' + fire.c, L, hTargets, bed);
    if (L === B.exitLv) return B.field('exit', L, exitCells(L), bed);
    return B.field('down', L, downCells(L), bed); };
  const goalField = (u) => { if (u.kind !== 'bed') return goalField0(u, false); const F = goalField0(u, true); return isFinite(F[u.k]) ? F : goalField0(u, false); };  // a bed squeezes through where its clear width runs out
  // units: patients and staff
  const U = [], down = o.strategy === 'down';
  for (const p of pop.pats) { const x = r(), kind = x < mix.amb ? 'amb' : x < mix.amb + mix.asst ? 'asst' : 'bed', inFire = p.li === fire.li && levels[p.li].comp[p.k] === fire.c;
    U.push({ id: U.length, pat: true, kind, li: p.li, li0: p.li, k0: p.k, k: p.k, room: p.roomName, roomIx: p.room, v0: kind === 'amb' ? clamp(0.9 + 0.25 * normal(r), 0.4, 1.3) : kind === 'asst' ? clamp(0.55 + 0.1 * normal(r), 0.35, 0.8) : clamp(0.6 + 0.1 * normal(r), 0.4, 0.8),
      vs: kind === 'amb' ? clamp(0.5 + 0.12 * normal(r), 0.3, 0.75) : kind === 'asst' ? 0.3 : 0.25, need: kind === 'amb' ? 0 : kind === 'asst' ? 1 : 2, react: logn(r, 90, 0.6), stage: inFire ? (horiz ? 1 : 2) : 0, state: 'idle', d: 0, esc: [], t1: NaN, t2: NaN }); }
  for (const s of pop.staff) U.push({ id: U.length, pat: false, kind: 'staff', li: s.li, k: s.k, v0: clamp(1.25 + 0.15 * normal(r), 0.9, 1.6), vs: 0.7, react: logn(r, 30, 0.5), state: 'idle', d: 0, task: null, t2: NaN });
  // incidents (2026-11-10, assumptions for sensitivity): a member of staff held up (a call, another patient) sets off 30 s to 2 min
  // late; a patient who walks alone may trip and stay down a while
  const incidents = []; if (o.incidents !== false) for (const u of U) { if (!u.pat && r() < 0.1) { const s2 = 30 + 90 * r(); u.react += s2; incidents.push({ type: 'staff held up', t: 0, s: s2 }); } if (u.pat && u.kind === 'amb' && r() < 0.03) { u.fallAt = 2 + 15 * r(); u.fallFor = clamp(logn(r, 25, 0.6), 5, 120); } }
  for (const u of U) occ[u.li][u.k]++;
  const pats = U.filter((u) => u.pat), staffU = U.filter((u) => !u.pat);
  if (down && !horiz) for (const u of U) if (u.li >= fire.li) { if (u.pat) { u.stage = 2; u.goal = 'down'; } else u.leaveAfter = true; }   // no compartments on the fire floor: straight down
  const active = (u) => u.stage === 1 || (u.stage === 2 && T >= t2Start);
  let T = 0, t2Start = horiz ? Infinity : 0, t1Done = NaN, staffWait = 0; const curve = [], doorMax = new Float32Array(doors.length), stairMax = stairs.map(() => 0), frames = o.record ? [] : null;
  const flights = stairs.map((s) => { const q = {}; for (let li = s.lo + 1; li <= s.hi; li++) q[li] = []; return { q, tok: {}, on: [] }; });
  // the patients whose compartment burns: stage 1 (or 2 at once where the floor has no compartments); in 'down', after stage 1 + a
  // decision delay, the fire floor and every floor above go down the stairs and out
  const stage1 = pats.filter((u) => u.stage === 1); if (!stage1.length) t1Done = 0;
  for (const u of U) if (u.stage === 2 && !horiz) u.goal = 'down';
  const decide = 60 + 120 * r();
  const step = (u, F, speed) => { // move along the field; one unit per cell; the crowd slows; doors and stairs meter the flow
    const L = levels[u.li], o2 = occ[u.li], i = u.k % W, j = (u.k / W) | 0; let cnt = 0; const R = B.dR; for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= B.H) continue; cnt += o2[jj * W + ii]; }
    const D = cnt / B.dA; if (D > peak[u.li][u.k]) peak[u.li][u.k] = D; const v = speed * (D <= 0.54 ? 1 : Math.max(0.15, (1 - 0.266 * D) / (1 - 0.266 * 0.54)));
    u.d += v * dt; let moved = false; const cap = (u.wait || 0) > 2 ? 2 : 1;
    for (let guard = 0; guard < 4; guard++) { const fk = F[u.k]; if (!(fk > 0)) break; let best = -1, bf = fk, bw = 1; const ii0 = u.k % W, jj0 = (u.k / W) | 0;
      for (const [di, dj, w] of NB8) { const ii = ii0 + di, jj = jj0 + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= B.H) continue; const m = jj * W + ii; if (F[m] < bf - 1e-6 && o2[m] < cap) { if (di && dj && (!isFinite(F[jj0 * W + ii]) || !isFinite(F[jj * W + ii0]))) continue; bf = F[m]; best = m; bw = w; } }
      const len = bw * B.c; if (best < 0) { u.d = Math.min(u.d, len); u.wait = (u.wait || 0) + dt; break; } if (u.d < len) break;
      const dr = L.door[best]; if (dr >= 0 && L.door[u.k] !== dr) { const dd = doors[dr], need = u.kind === 'bed' ? 2 : u.esc?.length ? 1.5 : 1; if (dd.tokens < need) { doorMax[dr] = Math.max(doorMax[dr], (doorMax[dr] || 0) + 0); u.d = Math.min(u.d, len); u.wait = (u.wait || 0) + dt; dd.waiting = (dd.waiting || 0) + 1; break; } dd.tokens -= need; }
      o2[u.k] = Math.max(0, o2[u.k] - 1); o2[best]++; u.from = u.k; u.k = best; u.d -= len; u.wait = 0; moved = true; }
    return moved; };
  const escortsFollow = (u) => { for (const s of u.esc || []) { s.li = u.li; s.k = u.k; s.onStair = u.onStair; } };
  for (T = 0; T <= horizon; T += dt) {
    for (const d of doors) { d.tokens = Math.min(d.tokens + MOVE.doorFs * effW(d.w) * dt, Math.max(2, MOVE.doorFs * effW(d.w))); doorMax[d.di] = Math.max(doorMax[d.di], d.waiting || 0); d.waiting = 0; }
    if (down && horiz && t2Start === Infinity && stage1.every((u) => u.state === 'safe')) { t2Start = T + decide; for (const u of U) if (u.li >= fire.li) { if (u.pat) { u.stage = 2; u.goal = 'down'; if (u.state === 'safe') u.state = 'idle'; } else u.leaveAfter = true; } }
    // two beds on one floor that each have one of the two staff they need: one of the staff joins the other bed (no deadlock)
    for (const s of staffU) { if (s.state !== 'with' || !s.task) continue; const p = s.task; if (p.state !== 'idle' || p.esc.length >= p.need || (p.coming || 0) > 0) continue;
      const q = pats.find((x) => x !== p && x.li === p.li && x.state === 'idle' && x.need === 2 && x.esc.length === 1 && !(x.coming || 0) && x.id < p.id && active(x)); if (!q) continue;
      p.esc = p.esc.filter((x) => x !== s); s.task = q; q.coming = (q.coming || 0) + 1; s.state = 'to'; s.li = p.li; s.k = freeNear(p.li, p.k); occ[s.li][s.k]++; }
    // staff take the nearest waiting patient who needs help on their floor
    for (const s of staffU) { if (s.state === 'gone' || s.onStair) continue; if (T < s.react || s.task) continue;
      const cand = pats.filter((p) => p.li === s.li && p.need && active(p) && p.state === 'idle' && p.esc.length + (p.coming || 0) < p.need);
      if (!cand.length) { // nobody left here who needs help: go back up the stair to a floor where someone still waits
        if (s.state === 'idle' && stairs.some((S) => S.lo === s.li) && pats.some((p) => p.li > s.li && p.need && active(p) && p.state === 'idle' && p.esc.length + (p.coming || 0) < p.need)) s.state = 'up';
        continue; }
      let best = null, bd = Infinity; for (const p of cand) { const F = B.field('p' + p.id + ':' + p.li + ':' + p.k, p.li, [p.k], false), d = F[s.k]; if (d < bd) { bd = d; best = p; } }
      if (best && isFinite(bd)) { s.task = best; best.coming = (best.coming || 0) + 1; s.state = 'to'; } }
    for (const u of U) {
      if (u.state === 'safe' || u.state === 'out' || u.state === 'gone') continue;
      if (u.upS) { if (T >= u.upT) { const S = u.upS, li = S.hi, free = S.acc[li].find((k) => !occ[li][k]) ?? S.acc[li][0]; u.upS = null; u.onStair = false; u.li = li; u.k = free; occ[li][free]++; u.state = 'idle'; u.d = 0; } continue; }
      if (u.onStair) continue;
      if (u.state === 'up') { const acc = stairs.filter((S) => S.lo === u.li).flatMap((S) => S.acc[u.li]), F = B.field('up', u.li, acc, false);
        if (F[u.k] === 0) { const S = stairs.find((S) => S.lo === u.li && S.acc[u.li].includes(u.k)); occ[u.li][u.k] = Math.max(0, occ[u.li][u.k] - 1); u.onStair = true; u.upS = S; u.upT0 = T; u.upT = T + S.len / 0.6; u.stairT1 = null; }
        else if (!isFinite(F[u.k])) u.state = 'idle'; else step(u, F, u.v0); continue; }
      if (!u.pat) { // staff
        if (u.state === 'to') { const p = u.task, F = B.field('p' + p.id + ':' + p.li + ':' + p.k, p.li, [p.k], false); if (F[u.k] <= 1.5 || u.li !== p.li) { occ[u.li][u.k] = Math.max(0, occ[u.li][u.k] - 1); u.state = 'with'; u.k = p.k; p.esc.push(u); p.coming--; } else { step(u, F, u.v0); } }
        else if (u.state === 'idle' && u.leaveAfter && T >= t2Start && !pats.some((p) => p.li >= u.li && p.need && p.state !== 'out' && p.stage === 2)) { u.goal = 'down'; u.state = 'walk'; }   /* staff leave last: nobody on their floor or above still needs help */
        if (u.state === 'walk') { const F = goalField(u); if (F[u.k] === 0) arrive(u); else step(u, F, u.v0); }
        continue; }
      if (!active(u)) continue;
      if (u.state === 'idle') { // ambulant patients set off after their reaction time (in stage 2, soon after the decision); the others wait for staff
        if (u.need) { if (u.esc.length < u.need) { staffWait += dt; u.waitStaff = (u.waitStaff || 0) + dt; continue; } } else if (T < (u.stage === 2 && horiz ? t2Start + 0.3 * u.react : u.react)) continue;
        if (u.need && o.prep !== false) { if (u.prepUntil == null) u.prepUntil = T + (u.kind === 'bed' ? MOVE.prepBed : MOVE.prepChair) * (0.8 + 0.4 * r()); if (T < u.prepUntil) continue; u.prepUntil = undefined; }   // getting the patient ready to move (each stage)
        u.state = 'walk'; u.tStart = T; if (!u.goal || u.stage === 2) u.goal = u.stage === 1 ? 'h' : 'down'; }
      if (u.state === 'walk' && u.fallAt != null) { u.walked = (u.walked || 0) + 0; if (u.downUntil == null && (u.d0 = (u.d0 || 0) + u.v0 * dt) >= u.fallAt) { u.downUntil = T + u.fallFor; incidents.push({ type: 'fall', kind: u.kind, room: u.room, li: u.li, t: T, s: u.fallFor }); } if (u.downUntil != null && T < u.downUntil) continue; }
      if (u.state === 'walk') { const F = goalField(u); if (!isFinite(F[u.k])) { u.state = 'stuck'; for (const s of u.esc) { s.state = 'idle'; s.task = null; } u.esc = []; continue; } if (F[u.k] === 0) arrive(u); else { step(u, F, u.v0); escortsFollow(u); } }
    }
    // stairs: flights meter the flow down; people from above merge at each landing
    for (const [si, S] of stairs.entries()) { const fl = flights[si];
      for (let li = S.hi; li > S.lo; li--) { const q = fl.q[li]; fl.tok[li] = Math.min((fl.tok[li] || 0) + MOVE.stairFs * effW(S.width) * dt, 2 + MOVE.stairFs * effW(S.width)); stairMax[si] = Math.max(stairMax[si], q.length);
        for (;;) { const ix = q.findIndex((x) => !(x.after > T)); if (ix < 0 || fl.tok[li] < q[ix].wgt) break; const e = q.splice(ix, 1)[0]; fl.tok[li] -= e.wgt; e.u.stairFrom = li; e.u.stairT0 = T; e.u.stairT1 = T + S.len / e.u.vs * (0.85 + 0.3 * r()); fl.on.push(e.u); } }
      for (let n = fl.on.length - 1; n >= 0; n--) { const u = fl.on[n]; if (T < u.stairT1) continue; const li = u.stairFrom - 1;
        if (li > S.lo && li !== B.exitLv) { fl.on.splice(n, 1); fl.q[li].push({ u, wgt: u.wgtS }); u.li = li; continue; }
        const cells = S.acc[li] || [], free = cells.find((k) => !occ[li][k]); if (free == null) continue; fl.on.splice(n, 1); u.onStair = false; u.stairT1 = null; u.li = li; u.k = free; occ[li][free]++; escortsFollow(u); u.d = 0; } }
    if (frames && Math.abs(T - Math.round(T)) < 1e-6) frames.push(snapshot());
    const moving = pats.filter((u) => u.stage > 0), fin = (u) => u.state === 'stuck' || (u.stage === 1 && !down ? u.state === 'safe' : u.stage === 2 ? u.state === 'out' : u.state === 'safe');
    if (Number.isNaN(t1Done) && stage1.length && stage1.every((u) => u.state === 'safe' || u.stage === 2)) t1Done = T + dt;
    if (Math.round(T) % 5 === 0 && Math.abs(T - Math.round(T)) < 1e-6) curve.push([T, pats.filter((u) => (down ? u.state === 'out' : u.state === 'safe')).length]);
    if (moving.every(fin) && (!down || ((t2Start !== Infinity || !horiz) && staffU.filter((u) => u.leaveAfter).every((u) => ['gone', 'stuck'].includes(u.state))))) { curve.push([T + dt, pats.filter((u) => (down ? u.state === 'out' : u.state === 'safe')).length]); break; }
  }
  function arrive(u) { // reached the goal: the next compartment, a stair, or out
    if (u.goal === 'h') { u.state = 'safe'; u.t1 = T; occ[u.li][u.k] = Math.max(0, occ[u.li][u.k] - 1); /* into the refuge compartment, out of the way */ for (const s of u.esc || []) { s.state = 'idle'; s.task = null; s.k = freeNear(u.li, u.k); occ[u.li][s.k]++; } u.esc = []; return; }
    const L = u.li; if (L === B.exitLv) { occ[L][u.k] = Math.max(0, occ[L][u.k] - 1); u.state = 'out'; u.t2 = T; for (const s of u.esc || []) { s.state = 'idle'; s.task = null; s.k = freeNear(L, u.k); occ[L][s.k]++; s.li = L; } u.esc = []; if (!u.pat) u.state = 'gone'; return; }
    const S = stairs.find((s) => s.hi === L && s.acc[L].includes(u.k)); if (!S) return; occ[L][u.k] = Math.max(0, occ[L][u.k] - 1); u.onStair = true; u.wgtS = u.kind === 'bed' ? 2.5 : u.esc?.length ? 1.5 : 1; for (const s of u.esc || []) s.onStair = true; if (u.kind === 'bed' && o.prep !== false && !u.sheet) { u.sheet = true; u.sheetUntil = T + MOVE.prepSheet * (0.8 + 0.4 * r()); }   /* a bed patient moved onto a rescue sheet or evacuation chair at the stair */
    flights[S.si].q[L].push({ u, wgt: u.wgtS, after: u.sheetUntil || 0 }); }
  function freeNear(li, k0) { const i0 = k0 % W, j0 = (k0 / W) | 0; for (let rr = 1; rr < 6; rr++) for (let dj = -rr; dj <= rr; dj++) for (let di = -rr; di <= rr; di++) { const ii = i0 + di, jj = j0 + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= B.H) continue; const m = jj * W + ii; if (levels[li].walk[m] && !occ[li][m]) return m; } return k0; }
  function snapshot() { const out = new Float32Array(U.length * 5); U.forEach((u, n) => { let x, y, z, li = u.li; const L = levels[li];
      if (u.upS) { const S = u.upS, f = clamp((T - u.upT0) / Math.max(1e-6, u.upT - u.upT0), 0, 1); [x, y] = S.centre; z = levels[S.lo].z + (levels[S.hi].z - levels[S.lo].z) * f; li = f < 0.5 ? S.lo : S.hi; }
      else if (u.onStair && u.stairT1) { const S = stairs.find((s) => s.lo < u.stairFrom && s.hi >= u.stairFrom) || stairs[0], f = clamp((T - u.stairT0) / Math.max(1e-6, u.stairT1 - u.stairT0), 0, 1), z0 = levels[u.stairFrom].z, z1 = levels[u.stairFrom - 1].z; [x, y] = S.centre; z = z0 + (z1 - z0) * f; li = f < 0.5 ? u.stairFrom : u.stairFrom - 1; }
      else { [x, y] = B.ctr(u.k); z = L.z; }
      if (!u.pat && u.state === 'with') { x += 0.45; y += 0.25; }
      out[n * 5] = x + B.O[0]; out[n * 5 + 1] = y + B.O[1]; out[n * 5 + 2] = z; out[n * 5 + 3] = li; out[n * 5 + 4] = u.state === 'out' || u.state === 'gone' ? 0 : 1; }); return out; }
  const perLevel = levels.map((L) => { const ts = pats.filter((u) => u.li0 === L.li && u.stage > 0).map((u) => (down ? u.t2 : u.t1)).filter(Number.isFinite); return ts.length ? Math.max(...ts) : NaN; });
  return { seed, fire: { li: fire.li, comp: fire.c, level: levels[fire.li].name, horiz }, t1: Number.isNaN(t1Done) ? NaN : t1Done, t2: down ? Math.max(...pats.filter((u) => u.stage === 2).map((u) => u.t2).filter(Number.isFinite), 0) : NaN,
    stuck: U.filter((u) => u.state === 'stuck').length, unfinished: pats.filter((u) => (u.stage === 1 && u.state !== 'safe') || (down && u.stage === 2 && u.state !== 'out')).length,
    pats: pats.map((u) => ({ kind: u.kind, li: u.li0, k: u.k0, room: u.roomIx, t1: u.t1, t2: u.t2, t: down ? u.t2 : u.t1, moved: u.stage > 0, wait: u.waitStaff || 0 })), staffWait: staffWait / Math.max(1, pats.filter((u) => u.need && u.stage > 0).length), curve, incidents, unitT: U.map((u) => (u.pat ? (u.stage > 0 ? (down ? u.t2 : u.t1) : NaN) : u.t2)), doorMax: Array.from(doorMax), stairMax, peak, frames, kinds: U.map((u) => u.kind), perLevel, nPat: pats.length, nStaff: staffU.length, mixCount: { amb: pats.filter((u) => u.kind === 'amb').length, asst: pats.filter((u) => u.kind === 'asst').length, bed: pats.filter((u) => u.kind === 'bed').length } };
}

// ---- everyone out (2026-11-09): a fire in any building, the way an evacuation unfolds -------------------------------------------
// The fire starts in a room (random each run, or chosen). The people in that room notice it and leave first; everyone else hears
// the alarm after the detection and alarm time and then takes their pre-movement time (noticing, checking, gathering) before
// walking: a lognormal through the 1st and 99th percentiles of the building use (after PD 7974-6:2019 and the SFPE Handbook;
// assumptions to edit). Then each walks to the nearest way out: the outside doors on the exit level, the stairs down from the
// floors above (up from a basement), slowed in a crowd (SFPE), doors letting through 1.32 people per second per metre and stair
// flights 1.01 (SFPE specific flows, of the effective width), queues at both. RSET, in the terms of PD 7974-6: detection and alarm + pre-movement + travel
// (with queueing). No fire or smoke is computed (no ASET); the room of fire origin is closed to through traffic (its own
// occupants leave it first), one outside door may be found blocked, and random incidents (falls, children with a parent) slow some.
// occupant load factors, m² per person, after IBC 2021 Table 1004.5 (gross or net as there); 0: nobody is counted there
const LOAD = [[/corridor|hall(way)?\b|lobby|passage|circulation|landing|stair|lift|elevator|toilet|\bwc\b|bath|shower|en-?suite|washroom|restroom|shaft|duct|走廊|过道|楼梯|电梯|卫生间|厕所|浴室/i, 0],
  [/class|lecture|seminar|tutorial|教室|课室/i, 1.9], [/meeting|conference|assembly|auditorium|theat|cinema|hall|chapel|worship|会议|礼堂|报告厅/i, 1.4], [/dining|restaurant|cafe|café|canteen|bar\b|餐厅|食堂|咖啡/i, 1.4],
  [/retail|shop|sales|showroom|商店|零售|商铺/i, 5.6], [/gym|fitness|exercise|dance|健身/i, 4.6], [/librar|reading|图书|阅览/i, 4.6], [/lab|workshop|studio|实验|工作室/i, 4.6],
  [/ward|patient|isolation|bed bay|icu|病房/i, 22.3], [/bed|living|dining room|apartment|suite|unit|guest|hotel|dwelling|lounge|family|卧室|客厅|起居|公寓|客房/i, 18.6], [/kitchen|厨房/i, 18.6],
  [/stor|plant|mechanical|electrical|utility|server|garage|parking|库|机房|设备|车库/i, 27.9], [/office|work|admin|reception|办公|前台/i, 13.9]];
export const USES = { office: { name: 'Office (awake, familiar)', p1: 30, p99: 120, mix: { occ: 0.85, older: 0.06, child: 0, imp: 0.04, wheel: 0.01, hearing: 0.02, vision: 0.01, cognitive: 0.01 } }, school: { name: 'School (awake, staff-led)', p1: 30, p99: 120, mix: { occ: 0.08, older: 0.01, child: 0.85, imp: 0.01, wheel: 0.01, hearing: 0.01, vision: 0.01, cognitive: 0.02 } },
  retail: { name: 'Shop, clinic or assembly (awake, unfamiliar)', p1: 30, p99: 180, mix: { occ: 0.57, older: 0.18, child: 0.12, imp: 0.06, wheel: 0.02, hearing: 0.02, vision: 0.01, cognitive: 0.02 } }, residential: { name: 'Homes (may be asleep)', p1: 60, p99: 600, mix: { occ: 0.55, older: 0.18, child: 0.15, imp: 0.05, wheel: 0.02, hearing: 0.02, vision: 0.01, cognitive: 0.02 } }, hotel: { name: 'Hotel (asleep, unfamiliar)', p1: 120, p99: 900, mix: { occ: 0.70, older: 0.15, child: 0.07, imp: 0.03, wheel: 0.01, hearing: 0.02, vision: 0.01, cognitive: 0.01 } } };
// who is in the building (2026-11-10): five groups, each with its own walking speed on the level and on stairs ([mean, SD, min, max]),
// a factor on the building use's pre-movement time, and chances of a fall on the level and on a stair. Speeds from the sources in MOVE;
// older adults' speeds scaled from adults' by the ratio of older to younger pedestrians' speeds in field studies (Knoblauch,
// Pietrucha & Nitzburg 1996); the pre-movement factors, fall chances and the default shares by use are assumptions to edit.
export const GROUPS = {
  occ: { name: 'Adults', v: [MOVE.vLevel, 0.2, 0.6, 1.6], vs: [MOVE.vStair, 0.15, 0.5, 1.2], pre: 1, fall: 0.015, sfall: 0.008, col: '#3d4250' },
  older: { name: 'Older adults (65+)', v: [MOVE.vOlder, 0.15, 0.6, 1.3], vs: [0.7, 0.12, 0.4, 1.0], pre: 1.3, fall: 0.04, sfall: 0.02, col: '#a16207' },
  child: { name: 'Children', v: [MOVE.vChild, 0.25, 0.42, 1.36], vs: [MOVE.vChildStair, 0.1, 0.25, 0.8], pre: 1, fall: 0.05, sfall: 0.03, col: '#16a34a' },
  imp: { name: 'Walking aid', v: [MOVE.vAid, 0.15, 0.45, 1.1], vs: [0.35, 0.05, 0.25, 0.45], pre: 1.2, fall: 0.06, sfall: 0.03, col: '#d9921a' },
  wheel: { name: 'Wheelchair users', v: [MOVE.vWheel, 0.15, 0.4, 1.0], vs: [MOVE.vChairStair, 0.05, 0.25, 0.45], pre: 1.2, fall: 0.005, sfall: 0, col: '#0891b2' },
  // people who need other kinds of help (2026-11-10; all values assumptions, to edit): hard of hearing (without visual alarm signals
  // they notice the alarm 30 s to 2 min late, from others), low vision (slower, more careful on stairs), a cognitive or learning
  // disability (longer to get going)
  hearing: { name: 'Hard of hearing', v: [MOVE.vLevel, 0.2, 0.6, 1.6], vs: [MOVE.vStair, 0.15, 0.5, 1.2], pre: 1, fall: 0.015, sfall: 0.008, col: '#be185d', late: [30, 120] },
  vision: { name: 'Low vision', v: [0.8, 0.15, 0.45, 1.1], vs: [0.5, 0.1, 0.3, 0.7], pre: 1.2, fall: 0.03, sfall: 0.02, col: '#0f766e' },
  cognitive: { name: 'Cognitive or learning disability', v: [MOVE.vLevel, 0.2, 0.6, 1.6], vs: [MOVE.vStair, 0.15, 0.5, 1.2], pre: 1.5, fall: 0.015, sfall: 0.008, col: '#92400e' } };
export const GROUP_KEYS = ['occ', 'older', 'child', 'imp', 'wheel', 'hearing', 'vision', 'cognitive'];
export function loadFactor(name) { for (const [re, f] of LOAD) if (re.test(name || '')) return f; return 9.3; }
export function occupants(B) {
  const people = [];
  for (const L of B.levels) for (const r of L.rooms) { const f = loadFactor(r.name); if (!f) continue; const cells = []; for (let k = 0; k < B.N; k++) if (L.room[k] === r.ri && L.walk[k] && L.door[k] < 0) cells.push(k); if (!cells.length) continue;
    const n = Math.min(Math.floor(cells.length / 2), Math.max(r.area >= 4 ? 1 : 0, Math.round(r.area / f))); for (let i = 0; i < n; i++) people.push({ li: L.li, room: r.ri, roomName: r.name, k: cells[Math.floor((i + 0.5) * cells.length / n)], f }); }
  return people;
}
// the default number in each group on each level: the building use's shares of the people placed there (largest remainder)
export const isPatientRoom = (name) => PATIENT.test(name || '') && !NOT_PATIENT.test(name || '');
export function groupCounts(B, people, useKey, o = {}) { const mix = (USES[useKey] || USES.office).mix; if (o.patients !== false) people = people.filter((p) => !isPatientRoom(p.roomName));   // patients are counted apart (2026-11-12)
  return B.levels.map((L) => { const n = people.filter((p) => p.li === L.li).length, raw = GROUP_KEYS.map((g) => (mix[g] || 0) * n), c = raw.map(Math.floor); let left = n - c.reduce((a, v) => a + v, 0);
    raw.map((v, i) => [v - c[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0 && raw[i] > 0) { c[i]++; left--; } }); if (left > 0) c[0] += left;
    const o = { n }; GROUP_KEYS.forEach((g, i) => { o[g] = c[i]; }); return o; }); }
// the people of every run (the same in each): counts per level and group (the use's defaults, or as set per level), placed in the
// rooms (more than the occupant load: extra places in the same rooms), children first in rooms families use, each with an adult
export function populate(B, people, o = {}) { const hosp = o.patients !== false ? population(B, { ratio: o.ratio || DEFAULTS.ratio }) : { pats: [], staff: [] }; if (hosp.pats.length) people = people.filter((p) => !isPatientRoom(p.roomName));
  const r = rng(9973), def = groupCounts(B, people, o.use, { patients: false }), out = [], KIDS = /waiting|clinic|caf[eé]|lobby|entrance|family|lounge|living|apartment|suite|dwelling|home|hotel|guest|bed|class|gym|retail|shop|restaurant|dining|play/i;
  for (const L of B.levels) { const base = people.filter((p) => p.li === L.li), want = { ...def[L.li], ...((o.counts && (o.counts[L.id] || o.counts[L.li])) || {}) }, N = GROUP_KEYS.reduce((a, g) => a + Math.max(0, Math.round(+want[g] || 0)), 0); if (!N) continue;
    let pos = base.slice(); if (N < pos.length) { const step = pos.length / N; pos = Array.from({ length: N }, (_, i) => pos[Math.floor(i * step)]); }
    else if (N > pos.length) { const used = new Set(pos.map((p) => p.k)), rooms = new Set((base.length ? base : []).map((p) => p.room)), cand = [];
      for (let k = 0; k < B.N; k++) if (L.walk[k] && L.door[k] < 0 && !used.has(k) && L.room[k] >= 0 && (rooms.size ? rooms.has(L.room[k]) : loadFactor(L.rooms[L.room[k]]?.name) > 0)) cand.push(k);
      for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
      for (const k of cand.slice(0, N - pos.length)) pos.push({ li: L.li, room: L.room[k], roomName: L.rooms[L.room[k]]?.name || '', k }); }
    for (let i = pos.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pos[i], pos[j]] = [pos[j], pos[i]]; }
    pos.sort((a, b) => (KIDS.test(b.roomName) ? 1 : 0) - (KIDS.test(a.roomName) ? 1 : 0));   // children first where families are
    const kinds = []; for (const g of ['child', 'wheel', 'imp', 'vision', 'hearing', 'cognitive', 'older', 'occ']) for (let i = 0; i < Math.max(0, Math.round(+want[g] || 0)); i++) kinds.push(g);
    const lv = pos.slice(0, kinds.length).map((p, i) => ({ ...p, kind: kinds[i] }));
    for (const c of lv) { if (c.kind !== 'child') continue; const free = (x) => (x.kind === 'occ' || x.kind === 'older') && x.childOf == null; let a = lv.find((x) => free(x) && x.room === c.room);
      if (!a) { const [cx, cy] = B.ctr(c.k); let bd = 15; for (const x of lv) { if (!free(x)) continue; const [px, py] = B.ctr(x.k), d = Math.hypot(px - cx, py - cy); if (d < bd) { bd = d; a = x; } } }
      if (a) { a.childOf = true; c.with = a; } }
    out.push(...lv); }
  // inpatients (2026-11-12, P0): one per bed in patient rooms, with the staff of their floor at the nurse station; they are moved by
  // staff as in the hospital modes, not counted as people who walk out on their own
  for (const p of hosp.pats) out.push({ li: p.li, room: p.room, roomName: p.roomName, k: p.k, kind: 'patient', icu: /\bicu\b|intensive|critical/i.test(p.roomName || '') });
  for (const p of hosp.staff) { const L = B.levels[p.li]; out.push({ li: p.li, room: L.room[p.k], roomName: L.rooms[L.room[p.k]]?.name || '', k: p.k, kind: 'staff' }); }
  return out.map((p) => ({ ...p, parent: p.with ? out.indexOf(p.with) : -1, with: undefined, childOf: undefined })); }
export function patientCounts(B, o = {}) { const h = population(B, { ratio: o.ratio || DEFAULTS.ratio }); return B.levels.map((L) => ({ id: L.id, patients: h.pats.filter((p) => p.li === L.li).length, staff: h.staff.filter((p) => p.li === L.li).length })); }
export function simulateAll(B, people, seed, o = {}) {
  const r = rng(seed), dt = 0.5, horizon = o.horizon || DEFAULTS.horizon, { W, N, levels, doors, stairs } = B, use = USES[o.use] || USES.office, detect = Number.isFinite(+o.detect) ? +o.detect : 60, slow = o.slow ?? 0.04;
  const occ = levels.map(() => new Uint8Array(N)), peak = levels.map(() => new Float32Array(N));
  const rooms = []; for (const p of people) if (!rooms.some((q) => q.li === p.li && q.room === p.room)) rooms.push({ li: p.li, room: p.room });
  let fire = rooms[Math.floor(r() * rooms.length)]; if (o.fire === 'none') fire = { li: -1, room: -1 }; else if (o.fire && o.fire !== 'random') fire = { li: o.fire.li, room: o.fire.room };   // 'none': no room of fire origin (verification tests)
  const zq = (2.326), med = Math.sqrt(use.p1 * use.p99), sg = Math.log(use.p99 / use.p1) / (2 * zq);
  const downCells = (li) => stairs.filter((s) => s.hi === li).flatMap((s) => s.acc[li]), upCells = (li) => stairs.filter((s) => s.lo === li).flatMap((s) => s.acc[li]), exitCells = (li) => doors.filter((d) => d.li === li && d.ext).flatMap((d) => d.cells);
  // the room of fire origin: no one enters it (its own occupants leave it first); in some runs an exit is found blocked (an obstructed
  // or locked door, 2026-11-10) and everyone uses the others
  const inc = o.incidents !== false, FL = levels[fire.li] || null, fmask = new Uint8Array(N); if (FL) for (let k = 0; k < N; k++) if (FL.room[k] === fire.room && FL.walk[k]) fmask[k] = 1;
  const exits = doors.filter((d) => d.li === B.exitLv && d.ext); let blocked = null; if (o.blockExit && o.blockExit !== 'random') blocked = exits.find((d) => d.id === o.blockExit) || null; else if (inc && exits.length >= 2 && r() < (o.blockP ?? 0.15)) blocked = exits[Math.floor(r() * exits.length)];
  const masks = levels.map((L) => { const m = L.li === fire.li ? fmask.slice() : null; if (!blocked || blocked.li !== L.li) return m; const mm = m || new Uint8Array(N); for (const k of blocked.cells) mm[k] = 1; return mm; });
  const mkey = (li) => `f${fire.li}:${fire.room}${blocked ? ':x' + blocked.di : ''}`, exitsOf = (li) => doors.filter((d) => d.li === li && d.ext && d !== blocked).flatMap((d) => d.cells);
  // an assumed smoke zone (2026-11-10): from o.smoke.t (s), the smoke compartment of the room of fire origin (the whole floor where
  // there are no smoke doors) is avoided by everyone outside it; those inside leave it, and the time they spend in it is counted
  const smask = new Uint8Array(N); let smokeT = Infinity; if (o.smoke && Number.isFinite(+o.smoke.t) && FL) { smokeT = +o.smoke.t; let c0 = -1; for (let k = 0; k < N; k++) if (fmask[k]) { c0 = FL.comp[k]; break; } if (c0 >= 0) for (let k = 0; k < N; k++) if (FL.walk[k] && FL.comp[k] === c0) smask[k] = 1; }
  const smokeField = (li) => { const m = (masks[li] || new Uint8Array(N)).slice(); for (let k = 0; k < N; k++) if (smask[k]) m[k] = 1; const bk = mkey(li) + ':s'; return li === B.exitLv ? B.field('exit', li, exitsOf(li), false, m, bk) : li > B.exitLv ? B.field('down', li, downCells(li), false, m, bk) : B.field('upx', li, upCells(li), false, m, bk); };
  const fieldOf = (li, own) => { const m = own ? (blocked && blocked.li === li ? Uint8Array.from(blocked.cells.reduce((a, k) => (a[k] = 1, a), new Uint8Array(N))) : null) : masks[li], bk = own ? 'own' + (blocked ? blocked.di : '') : mkey(li);
    return li === B.exitLv ? B.field('exit', li, exitsOf(li), false, m, bk) : li > B.exitLv ? B.field('down', li, downCells(li), false, m, bk) : B.field('upx', li, upCells(li), false, m, bk); };
  const KIDS = /waiting|clinic|caf[eé]|lobby|entrance|family|lounge|living|apartment|suite|dwelling|home|hotel|guest|bed|class|gym|retail|shop|restaurant|dining/i;
  const grouped = people.some((p) => p.kind), gv = (a) => clamp(a[0] + a[1] * normal(r), a[2], a[3]);
  const U = people.map((p, id) => { const own = p.li === fire.li && p.room === fire.room;
    if (grouped && p.kind === 'patient') { const mix = o.mix || DEFAULTS.mix, x = r(), sub = x < mix.amb ? 'amb' : x < mix.amb + mix.asst ? 'asst' : 'bed', tAlarm = own ? 0 : detect, pre = sub === 'amb' ? clamp(logn(r, 90, 0.6), 20, 600) : 0;
      return { id, kind: sub, pat: true, need: sub === 'amb' ? 0 : sub === 'asst' ? 1 : 2, li: p.li, li0: p.li, k0: p.k, k: p.k, room: p.room, roomName: p.roomName, own, tAlarm, pre, tStart: sub === 'amb' ? tAlarm + pre : Infinity,
        v0: sub === 'amb' ? clamp(0.9 + 0.25 * normal(r), 0.4, 1.3) : sub === 'asst' ? clamp(0.55 + 0.1 * normal(r), 0.35, 0.8) : clamp(0.6 + 0.1 * normal(r), 0.4, 0.8), vs: sub === 'amb' ? clamp(0.5 + 0.12 * normal(r), 0.3, 0.75) : MOVE.vChairStair,
        clin: sub === 'amb' ? 0 : (p.icu ? (o.clinPrepICU ?? 600) : (o.clinPrep ?? 120)) * (0.7 + 0.6 * r()), esc: [], coming: 0, waitStaff: 0, state: 'idle', d: 0, dist: 0, queue: 0, tOut: NaN, exit: -1, pIx: -1 }; }
    if (grouped && p.kind === 'staff') { const tAlarm = detect, pre = clamp(logn(r, 30, 0.5), 10, 180);
      return { id, kind: 'staff', staff: true, li: p.li, li0: p.li, k0: p.k, k: p.k, home: p.k, homeLi: p.li, room: p.room, roomName: p.roomName, own: false, tAlarm, pre, tStart: tAlarm + pre, v0: clamp(1.25 + 0.15 * normal(r), 0.9, 1.6), vs: MOVE.vStair, state: 'idle', task: null, d: 0, dist: 0, queue: 0, tOut: NaN, exit: -1, pIx: -1 }; }
    if (grouped) { const g = GROUPS[p.kind] || GROUPS.occ, tAlarm = own ? 0 : detect + (g.late && o.strobes === false ? g.late[0] + (g.late[1] - g.late[0]) * r() : 0), pre = own ? 10 + 20 * r() : clamp(logn(r, med, sg) * g.pre, use.p1 * 0.5, use.p99 * 2 * g.pre);
      return { id, kind: p.kind, li: p.li, li0: p.li, k0: p.k, k: p.k, room: p.room, roomName: p.roomName, own, tAlarm, pre, tStart: tAlarm + pre, v0: gv(g.v), vs: gv(g.vs), state: 'idle', d: 0, dist: 0, queue: 0, tOut: NaN, exit: -1, pIx: p.parent }; }
    const imp = r() < slow;
    const tAlarm = own ? 0 : detect, pre = own ? 10 + 20 * r() : clamp(logn(r, med, sg), use.p1 * 0.5, use.p99 * 2);
    return { id, kind: imp ? 'imp' : 'occ', li: p.li, li0: p.li, k0: p.k, k: p.k, room: p.room, roomName: p.roomName, own, tAlarm, pre, tStart: tAlarm + pre, v0: imp ? clamp(MOVE.vAid + 0.15 * normal(r), 0.45, 1.1) : clamp(MOVE.vLevel + 0.2 * normal(r), 0.6, 1.6),
      vs: imp ? clamp(0.35 + 0.05 * normal(r), 0.25, 0.45) : clamp(MOVE.vStair + 0.15 * normal(r), 0.5, 1.2), state: 'idle', d: 0, dist: 0, queue: 0, tOut: NaN, exit: -1 }; });
  // a child goes with their adult: the same alarm and start, both at the slower pace of the two
  if (grouped) for (const u of U) { if (u.pIx == null || u.pIx < 0) continue; const a = U[u.pIx]; u.parent = a; a.child = u; u.tAlarm = a.tAlarm; u.pre = a.pre; u.tStart = a.tStart; u.v0 = a.v0 = Math.min(u.v0, a.v0); u.vs = a.vs = Math.min(u.vs, a.vs); }
  // fixed inputs for the verification tests (tests/validation/egress-verification.mjs): one speed, one pre-movement time for all
  for (const u of U) { if (o.v0 != null) u.v0 = o.v0; if (o.vs != null) u.vs = o.vs; if (o.pre != null) { u.pre = o.pre; u.tStart = u.tAlarm + o.pre; } }
  // incidents (2026-11-10, assumptions for sensitivity, not measured rates): in rooms where families come (waiting, clinics, cafés,
  // homes…) about one person in seven is a child, who walks with an adult of the room at the slower pace of the two; a person may
  // trip and stay down a while (more often a child or someone walking slowly), the cell held so others pass round; on a stair a fall
  // holds that flight for a while
  const incidents = [];
  if (inc && !grouped) { const byRoom = new Map(); for (const u of U) { const k = u.li + ':' + u.room; if (!byRoom.has(k)) byRoom.set(k, []); byRoom.get(k).push(u); }
    for (const list of byRoom.values()) { if (!KIDS.test(list[0].roomName || '') || list.length < 2) continue; const adults = list.slice();
      for (const u of list) { if (u.parent || u.child || r() >= (o.childShare ?? 0.15)) continue; const a = adults.find((x) => x !== u && !x.parent && !x.child && x.kind !== 'child'); if (!a) continue;
        u.kind = 'child'; u.parent = a; a.child = u; u.tStart = a.tStart; u.pre = a.pre; u.tAlarm = a.tAlarm; const v = Math.min(a.v0, clamp(MOVE.vChild + 0.25 * normal(r), 0.42, 1.36)); u.v0 = a.v0 = v; u.vs = a.vs = Math.min(a.vs, clamp(MOVE.vChildStair + 0.1 * normal(r), 0.25, 0.8)); } }
  } if (inc) { for (const u of U) { const pf = (GROUPS[u.kind] || GROUPS.occ).fall; if (r() < (o.fallScale ?? 1) * pf && !u.need && !u.staff) { u.fallAt = 3 + 25 * r(); u.fallFor = clamp(logn(r, 20, 0.6), 5, 120); } } }
  for (const u of U) occ[u.li][u.k]++;
  const hasPat = U.some((u) => u.pat), wgtOf = (u) => (u.kind === 'bed' ? 2.5 : u.kind === 'wheel' ? 2 : u.kind === 'imp' || u.kind === 'asst' ? 1.5 : 1), pField = (p) => B.field('p' + p.id + ':' + p.li + ':' + p.k, p.li, [p.k], false);
  const waitingOn = (li) => U.filter((p) => p.need && p.state === 'idle' && p.li === li && p.esc.length + p.coming < p.need);
  const doorMax = new Float32Array(doors.length), stairMax = stairs.map(() => 0), frames = o.record ? [] : null, curve = [], flights = stairs.map((s) => { const q = {}; for (let li = s.lo + 1; li <= s.hi; li++) q[li] = []; return { q, tok: {}, on: [], hold: {} }; });
  const exitUse = doors.map(() => ({ n: 0, last: NaN })), stairUse = stairs.map(() => 0);
  const queues = o.record ? [] : null;
  let T = 0;
  const step = (u, F) => { const L = levels[u.li], o2 = occ[u.li], i = u.k % W, j = (u.k / W) | 0; let cnt = 0; const R = B.dR; for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= B.H) continue; cnt += o2[jj * W + ii]; }
    const D = cnt / B.dA; if (D > peak[u.li][u.k]) peak[u.li][u.k] = D; const v = u.v0 * (D <= 0.54 ? 1 : Math.max(0.15, (1 - 0.266 * D) / (1 - 0.266 * 0.54)));
    u.d += v * dt; const cap = (u.wait || 0) > 2 ? 2 : 1; let blocked = false;
    for (let guard = 0; guard < 4; guard++) { const fk = F[u.k]; if (!(fk > 0)) break; let best = -1, bf = fk, bw = 1; const ii0 = u.k % W, jj0 = (u.k / W) | 0;
      for (const [di, dj, w] of NB8) { const ii = ii0 + di, jj = jj0 + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= B.H) continue; const m = jj * W + ii; if (F[m] < bf - 1e-6 && o2[m] < cap) { if (di && dj && (!isFinite(F[jj0 * W + ii]) || !isFinite(F[jj * W + ii0]))) continue; bf = F[m]; best = m; bw = w; } }
      const len = bw * B.c; if (best < 0) { u.d = Math.min(u.d, len); u.wait = (u.wait || 0) + dt; blocked = true; break; } if (u.d < len) break;
      const dr = L.door[best]; if (dr >= 0 && L.door[u.k] !== dr) { const dd = doors[dr]; if (dd.tokens < 1) { u.d = Math.min(u.d, len); u.wait = (u.wait || 0) + dt; dd.waiting = (dd.waiting || 0) + 1; blocked = true; break; } dd.tokens -= 1; }
      o2[u.k] = Math.max(0, o2[u.k] - 1); o2[best]++; u.k = best; u.d -= len; u.dist += len; u.wait = 0; }
    if (blocked) u.queue += dt; };
  const arrive = (u) => { const L = u.li;
    if (L === B.exitLv) { occ[L][u.k] = Math.max(0, occ[L][u.k] - 1); u.state = 'out'; u.tOut = T; const di = levels[L].door[u.k]; u.exit = di; if (di >= 0) { exitUse[di].n++; exitUse[di].last = T; }
      // the staff who moved a patient out go back to their floor for the next one (the time to walk back the way they came, an assumption), or leave
      for (const s of u.esc || []) { s.task = null; s.li = L; s.k = u.k; s.trips = (s.trips || 0) + 1; if (waitingOn(s.homeLi).length) { s.state = 'back'; s.backT = T + u.dist / s.v0 + 10; } else { s.state = 'out'; s.tOut = T; s.exit = di; if (di >= 0) exitUse[di].n++; } } if (u.esc) u.esc = []; return; }
    if (L > B.exitLv) { const S = stairs.find((s) => s.hi === L && s.acc[L].includes(u.k)); if (!S) return; occ[L][u.k] = Math.max(0, occ[L][u.k] - 1); u.onStair = true; u.qT = T; stairUse[S.si]++; let after = 0; if (u.kind === 'bed' && !u.sheet) { u.sheet = true; after = T + MOVE.prepSheet * (0.8 + 0.4 * r()); }   /* a bed patient moved onto a rescue sheet or evacuation chair at the stair */
    if (u.kind === 'wheel' && !u.inChair) { u.inChair = true; u.refWait = clamp(logn(r, o.refugeWait ?? MOVE.refugeWait, 0.5), 30, 1200) + MOVE.prepChair * (0.8 + 0.4 * r()); after = T + u.refWait; }   /* a wheelchair user waits in the stair's refuge for helpers and an evacuation chair, once; then carried on down */
    flights[S.si].q[L].push({ u, wgt: wgtOf(u), after }); return; }
    const S = stairs.find((s) => s.lo === L && s.acc[L].includes(u.k)); if (!S) return; occ[L][u.k] = Math.max(0, occ[L][u.k] - 1); u.onStair = true; u.upS = S; u.upT0 = T; u.upT = T + S.len / (u.vs * 0.8); if (u.kind === 'wheel' && !u.inChair) { u.inChair = true; u.refWait = clamp(logn(r, o.refugeWait ?? MOVE.refugeWait, 0.5), 30, 1200) + MOVE.prepChair * (0.8 + 0.4 * r()); u.upT += u.refWait; } stairUse[S.si]++; };
  for (T = 0; T <= horizon; T += dt) {
    for (const d of doors) { d.tokens = Math.min(d.tokens + MOVE.doorFs * effW(d.w) * dt, Math.max(2, MOVE.doorFs * effW(d.w))); doorMax[d.di] = Math.max(doorMax[d.di], d.waiting || 0); d.waiting = 0; }
    // staff (2026-11-12): after their reaction time, the free staff of a floor go to the nearest patient who waits for help, in teams
    // big enough to move that patient (one for a patient who needs help walking, two for a bed); when nobody on the floor still waits, they leave
    if (hasPat) for (const L of levels) { const free = U.filter((s) => s.staff && s.state === 'idle' && T >= s.tStart && s.li === L.li); if (!free.length) continue; const wait = waitingOn(L.li);
      if (!wait.length) { if (!U.some((p) => p.need && p.li === L.li && p.state === 'idle')) for (const s of free) s.state = 'walk'; continue; }
      wait.sort((a, b) => pField(a)[free[0].k] - pField(b)[free[0].k]);
      for (const p of wait) { const need = p.need - p.esc.length - p.coming; if (free.length < need) continue; const F = pField(p); free.sort((a, b) => F[a.k] - F[b.k]); for (const s of free.splice(0, need)) { s.task = p; s.state = 'to'; p.coming++; } if (!free.length) break; } }
    for (const u of U) { if (u.state === 'out' || u.state === 'stuck') continue;
      if (u.staff && u.state !== 'walk') { // with a patient (moved with them), walking back up to their floor, waiting, or on the way to a patient
        if (u.state === 'back' && T >= u.backT) { u.li = u.homeLi; u.k = freeNear(u.homeLi, u.home); occ[u.li][u.k]++; u.state = 'idle'; }
        if (u.state === 'to') { const p = u.task, F = pField(p); if (p.state !== 'idle' || u.li !== p.li || !isFinite(F[u.k])) { p.coming--; u.task = null; u.state = 'idle'; } else if (F[u.k] <= 1.5) { occ[u.li][u.k] = Math.max(0, occ[u.li][u.k] - 1); u.state = 'with'; p.esc.push(u); p.coming--; } else step(u, F); }
        continue; }
      if (u.need && u.state === 'idle') { // a patient who waits for staff, then for the clinical preparation (lines, monitors, oxygen: an assumption), then is moved
        if (u.esc.length < u.need) { if (T >= u.tAlarm) u.waitStaff += dt; continue; } if (u.prepUntil == null) u.prepUntil = T + u.clin; if (T < u.prepUntil) continue; u.tStart = T; }
      if (u.upS) { if (T >= u.upT) { const S = u.upS, li = S.hi, free = S.acc[li].find((k) => !occ[li][k]) ?? S.acc[li][0]; u.upS = null; u.onStair = false; u.li = li; u.k = free; occ[li][free]++; u.d = 0; u.dist += S.len; } continue; }
      if (u.onStair) continue;
      if (T >= smokeT && !u.onStair && u.li === fire.li && smask[u.k]) u.smokeS = (u.smokeS || 0) + dt;   // in the assumed smoke zone, moving or not
      if (u.state === 'idle') { if (T < u.tStart) continue; u.state = 'walk'; }
      if (u.downUntil != null && T < u.downUntil) continue;   // fallen: down a while, the cell held
      if (u.fallAt != null && u.downUntil == null && u.dist >= u.fallAt) { u.downUntil = T + u.fallFor; incidents.push({ type: 'fall', kind: u.kind, room: u.roomName, li: u.li, t: T, s: u.fallFor }); continue; }
      if (u.child && u.child.state !== 'out' && u.child.downUntil != null && T < u.child.downUntil) continue;   // a parent waits for a fallen child
      const own = u.li === fire.li && fmask[u.k] === 1, inSmoke = T >= smokeT && u.li === fire.li && smask[u.k] === 1;
      let F = T >= smokeT && u.li === fire.li && !inSmoke && !own ? smokeField(u.li) : fieldOf(u.li, own || u.through); if (!isFinite(F[u.k]) && T >= smokeT) { F = fieldOf(u.li, own || u.through); u.thruSmoke = true; } if (!isFinite(F[u.k]) && !own && !u.through) { const F2 = fieldOf(u.li, true); if (isFinite(F2[u.k])) { u.through = true; F = F2; } }   // the only way out is through the room of fire origin: recorded, and taken
      if (!isFinite(F[u.k])) { u.state = 'stuck'; for (const s of u.esc || []) { s.state = 'walk'; s.task = null; s.li = u.li; s.k = freeNear(u.li, u.k); occ[s.li][s.k]++; } if (u.esc) u.esc = []; continue; } if (F[u.k] === 0) arrive(u); else { step(u, F); if (u.esc) for (const s of u.esc) { s.li = u.li; s.k = u.k; } } }
    for (const [si, S] of stairs.entries()) { const fl = flights[si];
      for (let li = S.hi; li > S.lo; li--) { const q = fl.q[li]; if (!(fl.hold[li] > T)) fl.tok[li] = Math.min((fl.tok[li] || 0) + MOVE.stairFs * effW(S.width) * dt, 2 + MOVE.stairFs * effW(S.width)); stairMax[si] = Math.max(stairMax[si], q.length);
        for (;;) { if (fl.hold[li] > T) break; const ix = q.findIndex((x) => !(x.after > T)); if (ix < 0 || fl.tok[li] < q[ix].wgt) break; const e = q.splice(ix, 1)[0]; fl.tok[li] -= e.wgt; e.u.queue += T - (e.u.qT ?? T); e.u.stairFrom = li; e.u.stairT0 = T; e.u.stairT1 = T + S.len / e.u.vs * (0.85 + 0.3 * r());
          if (inc && r() < (o.fallScale ?? 1) * (GROUPS[e.u.kind] || GROUPS.occ).sfall) { const s2 = clamp(logn(r, 15, 0.6), 5, 90); e.u.stairT1 += s2; fl.hold[li] = T + s2; incidents.push({ type: 'stair fall', kind: e.u.kind, room: e.u.roomName, li, t: T, s: s2, stair: S.name }); }   // a fall on the flight holds it
          fl.on.push(e.u); } }
      for (let n = fl.on.length - 1; n >= 0; n--) { const u = fl.on[n]; if (T < u.stairT1) continue; const li = u.stairFrom - 1; u.dist += S.len; u.stairS = (u.stairS || 0) + (u.stairT1 - u.stairT0);
        if (li > S.lo && li !== B.exitLv) { fl.on.splice(n, 1); u.qT = T; fl.q[li].push({ u, wgt: wgtOf(u) }); u.li = li; continue; }
        const cells = S.acc[li] || [], free = cells.find((k) => !occ[li][k]); if (free == null) continue; fl.on.splice(n, 1); u.onStair = false; u.stairT1 = null; u.li = li; u.k = free; occ[li][free]++; u.d = 0; } }
    if (frames && Math.abs(T - Math.round(T)) < 1e-6) { frames.push(snapshot()); const qn = []; for (const d of doors) if ((d.waiting || 0) >= 2) qn.push([0, d.di, d.li, d.waiting]); for (const [si, S] of stairs.entries()) for (let li = S.hi; li > S.lo; li--) { const n2 = flights[si].q[li].length; if (n2 >= 2) qn.push([1, si, li, n2]); } queues.push(qn); }   // who queues where, each second (2026-11-10)
    if (Math.round(T) % 5 === 0 && Math.abs(T - Math.round(T)) < 1e-6) curve.push([T, U.filter((u) => u.state === 'out').length]);
    if (U.every((u) => u.state === 'out' || u.state === 'stuck')) { curve.push([T + dt, U.filter((u) => u.state === 'out').length]); if (frames) frames.push(snapshot()); break; }
  }
  function freeNear(li, k0) { const i0 = k0 % W, j0 = (k0 / W) | 0; for (let rr = 0; rr < 8; rr++) for (let dj = -rr; dj <= rr; dj++) for (let di = -rr; di <= rr; di++) { const ii = i0 + di, jj = j0 + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= B.H) continue; const m = jj * W + ii; if (levels[li].walk[m] && !occ[li][m]) return m; } return k0; }
  function snapshot() { const out = new Float32Array(U.length * 5); U.forEach((u, n) => { let x, y, z, li = u.li;
      if (u.upS) { const S = u.upS, f = clamp((T - u.upT0) / Math.max(1e-6, u.upT - u.upT0), 0, 1); [x, y] = S.centre; z = levels[S.lo].z + (levels[S.hi].z - levels[S.lo].z) * f; li = f < 0.5 ? S.lo : S.hi; }
      else if (u.onStair && u.stairT1) { const S = stairs.find((s) => s.lo < u.stairFrom && s.hi >= u.stairFrom) || stairs[0], f = clamp((T - u.stairT0) / Math.max(1e-6, u.stairT1 - u.stairT0), 0, 1), z0 = levels[u.stairFrom].z, z1 = levels[u.stairFrom - 1].z; [x, y] = S.centre; z = z0 + (z1 - z0) * f; li = f < 0.5 ? u.stairFrom : u.stairFrom - 1; }
      else { [x, y] = B.ctr(u.k); z = levels[li].z; }
      out[n * 5] = x + B.O[0]; out[n * 5 + 1] = y + B.O[1]; out[n * 5 + 2] = z; out[n * 5 + 3] = li; out[n * 5 + 4] = u.state === 'out' || u.state === 'back' ? 0 : T < u.tAlarm ? 1 : T < u.tStart ? 2 : 3; });
    U.forEach((u, n) => { if (u.state !== 'with' || !u.task) return; const m = u.task.id, side = u.task.esc.indexOf(u); for (let q = 0; q < 4; q++) out[n * 5 + q] = out[m * 5 + q]; out[n * 5] += side ? -0.45 : 0.45; out[n * 5 + 1] += 0.25; out[n * 5 + 4] = 3; }); return out; }   // 1 not yet alerted, 2 alerted and getting ready, 3 on the move
  // the routes (2026-11-10): from each room people start in, the way the run's fields lead (round the room of fire origin and a blocked
  // exit), down the stairs to the exit level, out of the door and on to a safe place outside (o.assembly m from the door, along its
  // outward normal); and an alternative to a different exit or stair from the start floor. Plan coordinates for drawing.
  function routesOf() { const ASM = o.assembly ?? 15, NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]], pt = (k) => { const [x, y] = B.ctr(k); return [+(x + B.O[0]).toFixed(2), +(y + B.O[1]).toFixed(2)]; };
    const trace = (F, k0) => { const out = [k0]; let k = k0; for (let g = 0; g < 6000 && F[k] > 0; g++) { const i = k % W, j = (k / W) | 0; let best = -1, bf = F[k]; for (const [di, dj] of NB) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= B.H) continue; const m = jj * W + ii; if (F[m] < bf - 1e-6) { bf = F[m]; best = m; } } if (best < 0) break; k = best; out.push(k); } return out; };
    const len = (cells) => cells.reduce((a2, k, n) => (n ? a2 + Math.hypot(...B.ctr(k).map((v, q) => v - B.ctr(cells[n - 1])[q])) : 0), 0);
    const outside = (d) => { const L = levels[d.li]; for (const sg of [1, -1]) { const k = B.cellAt(d.mid[0] + d.n[0] * sg * 1.2, d.mid[1] + d.n[1] * sg * 1.2); if (k < 0 || L.room[k] < 0) return [d.n[0] * sg, d.n[1] * sg]; } return [d.n[0], d.n[1]]; };
    // follow from (li, k) with the first field F0, then level by level to an outside door
    const follow = (li, k, F0) => { const segs = [], hops = []; let F = F0, dist = 0, narrow = Infinity, door = null;
      for (let guard = 0; guard < levels.length + 2; guard++) { if (!F || !isFinite(F[k])) return null; const cells = trace(F, k); dist += len(cells) ; for (const c of cells) { const dd = levels[li].door[c]; if (dd >= 0 && doors[dd].w < narrow) narrow = doors[dd].w; } segs.push({ li, pts: cells.filter((_, n) => n % 2 === 0 || n === cells.length - 1).map(pt) }); const last = cells[cells.length - 1];
        if (li === B.exitLv) { const di = levels[li].door[last]; door = di >= 0 ? doors[di] : doors.filter((d) => d.li === li && d.ext).reduce((a2, d) => (!a2 || Math.hypot(d.mid[0] - B.ctr(last)[0], d.mid[1] - B.ctr(last)[1]) < Math.hypot(a2.mid[0] - B.ctr(last)[0], a2.mid[1] - B.ctr(last)[1]) ? d : a2), null); break; }
        const S = stairs.find((s2) => (li > B.exitLv ? s2.hi === li : s2.lo === li) && s2.acc[li].includes(last)); if (!S) return null; const nl = li > B.exitLv ? S.lo : S.hi, foot = S.acc[nl].reduce((a2, c) => (a2 < 0 || Math.hypot(...B.ctr(c).map((v, q) => v - B.ctr(last)[q])) < Math.hypot(...B.ctr(a2).map((v, q) => v - B.ctr(last)[q])) ? c : a2), -1);
        hops.push({ si: S.si, a: li, b: nl, from: pt(last), to: pt(foot) }); dist += S.len; narrow = Math.min(narrow, S.width); li = nl; k = foot; F = fieldOf(li, false); }
      if (!door) return null; const n2 = outside(door), m2 = [door.mid[0] + B.O[0], door.mid[1] + B.O[1]], asm = [+(m2[0] + n2[0] * ASM).toFixed(2), +(m2[1] + n2[1] * ASM).toFixed(2)];
      return { segs, hops, di: door.di, out: [m2, asm], dist: +(dist).toFixed(1), toSafe: ASM, narrow: Number.isFinite(narrow) ? +narrow.toFixed(2) : null }; };
    const groups = new Map(); for (const u of U) { const key = u.li0 + ':' + u.room; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(u); }
    const out = [];
    for (const [key, us] of groups) { const li = us[0].li0, k0 = us[0].k0, own = li === fire.li && fmask[k0] === 1, prim = follow(li, k0, fieldOf(li, own)); if (!prim) continue;
      // the alternative: the same start, with the exit or stair the main route takes on the start floor closed
      let alt = null; { const firstHop = prim.hops[0], m = (masks[li] || new Uint8Array(N)).slice(); if (firstHop) for (const c of stairs[firstHop.si].acc[li]) m[c] = 1; else for (const c of doors[prim.di].cells) m[c] = 1;
        const tg = li === B.exitLv ? exitsOf(li) : li > B.exitLv ? downCells(li) : upCells(li), Fa = B.field(li === B.exitLv ? 'exit' : li > B.exitLv ? 'down' : 'upx', li, tg, false, m, mkey(li) + ':alt' + (firstHop ? 's' + firstHop.si : 'd' + prim.di)); if (isFinite(Fa[k0])) alt = follow(li, k0, Fa); }
      const free = follow(li, k0, li === B.exitLv ? B.field('exit', li, doors.filter((d) => d.li === li && d.ext).flatMap((d) => d.cells), false) : li > B.exitLv ? B.field('down', li, downCells(li), false) : B.field('upx', li, upCells(li), false));
      const tOut = us.map((u) => u.tOut).filter(Number.isFinite).sort((a2, b2) => a2 - b2), exitsUsed = new Map(); for (const u of us) if (u.exit >= 0) exitsUsed.set(u.exit, (exitsUsed.get(u.exit) || 0) + 1);
      out.push({ li, room: us[0].room, roomName: us[0].roomName, n: us.length, start: pt(k0), prim, alt, rerouted: !!(free && (free.di !== prim.di || (free.hops[0] && prim.hops[0] && free.hops[0].si !== prim.hops[0].si))), freeDist: free ? free.dist : null,
        tMed: tOut.length ? tOut[Math.floor(tOut.length / 2)] : NaN, tMax: tOut.length ? tOut.at(-1) : NaN, queued: us.filter((u) => u.queue > 30).length, smoke: us.filter((u) => (u.smokeS || 0) > 0).length, exitsUsed: [...exitsUsed.entries()] }); }
    return out; }
  const outT = U.map((u) => u.tOut).filter(Number.isFinite), perLevel = levels.map((L) => { const ts = U.filter((u) => u.li0 === L.li).map((u) => u.tOut).filter(Number.isFinite); return ts.length ? Math.max(...ts) : NaN; });
  return { seed, fire: { li: fire.li, room: fire.room, level: levels[fire.li]?.name || 'none', roomName: levels[fire.li]?.rooms[fire.room]?.name || 'a room' }, t: outT.length ? Math.max(...outT) : NaN, t2: outT.length ? Math.max(...outT) : NaN,
    stuck: U.filter((u) => u.state === 'stuck').length, unfinished: U.filter((u) => u.state !== 'out').length, detect, use: o.use || 'office',
    people: U.map((u) => ({ v0: u.v0, vs: u.vs, stairS: u.stairS || 0, through: !!u.through, refWait: u.refWait || 0, withChild: !!u.child, withAdult: !!u.parent, smokeS: u.smokeS || 0, thruSmoke: !!u.thruSmoke, kind: u.kind, li: u.li0, room: u.room, own: u.own, tAlarm: u.tAlarm, pre: u.pre, tStart: u.tStart, tOut: u.tOut, travel: u.tOut - u.tStart, queue: u.queue, dist: u.dist, exit: u.exit })),
    curve, doorMax: Array.from(doorMax), stairMax, stairUse, exitUse, peak, frames, kinds: U.map((u) => u.kind), perLevel, n: U.length,
    unitT: U.map((u) => u.tOut), incidents, blocked: blocked ? { di: blocked.di, id: blocked.id } : null, children: U.filter((u) => u.kind === 'child').length,
    patients: hasPat ? (() => { const P = U.filter((u) => u.pat), Sx = U.filter((u) => u.staff), tP = P.map((u) => u.tOut).filter(Number.isFinite), helped = P.filter((u) => u.need);
      return { n: P.length, amb: P.filter((u) => u.kind === 'amb').length, asst: P.filter((u) => u.kind === 'asst').length, bed: P.filter((u) => u.kind === 'bed').length, staff: Sx.length, out: tP.length, tLast: tP.length ? Math.max(...tP) : NaN,
        waitMean: helped.length ? helped.reduce((a2, u) => a2 + u.waitStaff, 0) / helped.length : 0, waitMax: helped.length ? Math.max(...helped.map((u) => u.waitStaff)) : 0, clinMean: helped.length ? helped.reduce((a2, u) => a2 + u.clin, 0) / helped.length : 0, tripsMax: Sx.length ? Math.max(...Sx.map((u) => u.trips || 0)) : 0 }; })() : null,
    queues, smoke: Number.isFinite(smokeT) ? { t: smokeT, li: fire.li, cells: smask.reduce((a2, v) => a2 + v, 0), mask: o.record ? smask : null } : null, routes: o.record ? routesOf() : null };
}

// ---- many runs, summarised; the run nearest the median kept with its frames for playback --------------------------------------
export async function run(building, o = {}, onProg = () => {}) {
  if (o.strategy === 'all') return runAll(building, o, onProg);
  const B = prepare(building, o), pop = population(B, o);
  if (o.fire && o.fire.lv != null) { const li = B.levels.findIndex((L) => L.id === o.fire.lv), k = li >= 0 ? B.cellAt(o.fire.x - B.O[0], o.fire.y - B.O[1]) : -1, ri = k >= 0 ? B.levels[li].room[k] : -1;   // a room clicked in the view (plan point)
    if (ri < 0) throw Error('The fire room is not inside a room of the model: click inside a room.'); o = { ...o, fire: { li, room: ri } };
    const L0 = B.levels[li], c0 = (() => { for (let k = 0; k < B.N; k++) if (L0.room[k] === ri && L0.walk[k]) return L0.comp[k]; return -1; })();
    if (!pop.pats.some((p) => p.li === li && L0.comp[p.k] === c0)) throw Error(`No patients in the smoke compartment of ${L0.rooms[ri]?.name || 'that room'}: in the hospital modes choose a room on a patient floor, or use Everyone out.`); } if (!pop.pats.length) throw Error('No patient rooms found on any level: name rooms ward, patient room, bed bay or ICU on the plan.');
  if (B.exitLv < 0) throw Error('No outside door found: draw an exterior door on the ground floor.');
  if (o.strategy === 'down') { const tops = B.levels.filter((L) => L.li !== B.exitLv && pop.pats.some((p) => p.li === L.li)); for (const L of tops) if (!B.stairs.some((s) => s.hi === L.li)) throw Error(`${L.name} has no stair down: place a stair from the level below.`); }
  const runs = [], n = o.runs || DEFAULTS.runs, seed0 = o.seed ?? DEFAULTS.seed;
  for (let i = 0; i < n; i++) { for (const d of B.doors) d.tokens = 0; runs.push(simulate(B, pop, seed0 + i * 7919, { ...o })); onProg((i + 1) / (n + 1)); if (i % 2 === 1) await new Promise((r) => setTimeout(r, 0)); }
  const key = o.strategy === 'down' ? 't2' : 't1', vals = runs.map((x) => x[key]), med = pct(vals, 0.5), rep = runs.reduce((b, x) => (Math.abs(x[key] - med) < Math.abs(b[key] - med) ? x : b), runs[0]);
  for (const d of B.doors) d.tokens = 0; const shown = simulate(B, pop, rep.seed, { ...o, record: true }); onProg(1);
  return { B, pop, runs, rep: shown, key, med, p90: pct(vals, 0.9), p10: pct(vals, 0.1) };
}
async function runAll(building, o, onProg) {
  const B = prepare(building, o), people = o.groups === false ? occupants(B) : populate(B, occupants(B), o);
  if (o.fire && o.fire.lv != null) { const li = B.levels.findIndex((L) => L.id === o.fire.lv), k = li >= 0 ? B.cellAt(o.fire.x - B.O[0], o.fire.y - B.O[1]) : -1, ri = k >= 0 ? B.levels[li].room[k] : -1;
    if (ri < 0) throw Error('The fire room is not inside a room of the model: click inside a room.'); o = { ...o, fire: { li, room: ri } }; }
  if (!people.length) throw Error('Nobody to evacuate: draw rooms with names (office, classroom, bedroom…) on the plan.');
  if (B.exitLv < 0) throw Error('No outside door found: draw an exterior door on the ground floor.');
  for (const L of B.levels) { if (L.li === B.exitLv || !people.some((p) => p.li === L.li)) continue; if (L.li > B.exitLv ? !B.stairs.some((s) => s.hi === L.li) : !B.stairs.some((s) => s.lo === L.li)) throw Error(`${L.name} has no stair ${L.li > B.exitLv ? 'down' : 'up'}: place a stair to the next level.`); }
  const runs = [], n = o.runs || DEFAULTS.runs, seed0 = o.seed ?? DEFAULTS.seed;
  for (let i = 0; i < n; i++) { for (const d of B.doors) d.tokens = 0; runs.push(simulateAll(B, people, seed0 + i * 7919, { ...o })); onProg((i + 1) / (n + 1)); if (i % 2 === 1) await new Promise((r) => setTimeout(r, 0)); }
  const vals = runs.map((x) => x.t), med = pct(vals, 0.5), rep = runs.reduce((b, x) => (Math.abs(x.t - med) < Math.abs(b.t - med) ? x : b), runs[0]);
  for (const d of B.doors) d.tokens = 0; const shown = simulateAll(B, people, rep.seed, { ...o, record: true }); onProg(1);
  return { B, people, runs, rep: shown, key: 't', med, p90: pct(vals, 0.9), p10: pct(vals, 0.1), all: true };
}
export { pct };
