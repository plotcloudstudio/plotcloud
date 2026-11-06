// Hospital evacuation (2026-11-01): the whole building, every level and its stairs, in the Workspace. Progressive horizontal
// evacuation first (the patients of the compartment where the fire starts are moved through a smoke-compartment door into the next
// compartment on the same floor), then, if chosen, down the stairs and out. A screening model for early design, run many times
// with random inputs; not a code compliance check, and no fire or smoke is computed (no ASET).
//
// Model, in short. Each level is a 0.5 m grid of the floor (rooms of the model, walls, door openings, furniture as obstacles). Beds
// move on a grid that needs about 1 m clear. People move cell to cell down a distance field to their goal, one unit per cell (4
// people per m² at most), slowed by the crowd round them (SFPE: v = v0 (1 − 0.266 D) above 0.54 p/m²); a door lets through at most
// 1.32 people per second per metre of width and a stair flight 1.1 (SFPE specific flows). Staff are the scarce resource: a patient
// who needs help waits for one member of staff (two for a bed), who walks to them, takes them to the goal and goes back for the next.
// Stairs join the levels in order; on the way down each flight is a queue, and people from the floors above merge at each landing.
// Random in each run: where the fire starts (or a chosen room), each patient's mobility, reaction times and walking speeds.
// Default values are assumptions to edit, with sources named in the study card; CSA Z8000 and the NBC set the design context.

const NB8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
const CIRC = /corridor|hall|lobby|passage|circulation|走廊|过道|大厅/i;
const NOT_PATIENT = /corridor|hall|lobby|passage|circulation|stair|lift|elevator|toilet|\bwc\b|bath|shower|store|storage|utility|clean|dirty|plant|station|office|nurse|staff|reception|kitchen|走廊|楼梯|卫生|储/i;
const PATIENT = /ward|patient|bed|icu|recovery|room|病房|病室/i;
const STAFFROOM = /nurse|station|staff|护士/i;
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
    levels.push({ li, id: Lv.id, name: Lv.name, z: Lv.z, h: Lv.h || 3, rooms, room, walk, door, furn: sc.furn || [] });
  }
  // stairs: their footprint is closed on the levels they join; the cells round it (0.9 m) are where people get on and off
  const lvIx = new Map(levels.map((L) => [L.id, L.li])), stairs = [];
  for (const s of building.stairs) { const a = lvIx.get(s.lv), b = lvIx.get(s.top); if (a == null || b == null) continue; const P = s.corners.map((p) => [p[0] - O[0], p[1] - O[1]]), acc = {};
    for (const li of [a, b]) { const L = levels[li], cells = []; for (let k = 0; k < N; k++) { const [px, py] = ctr(k); const d = polyDist(px, py, P); if (d === 0) L.walk[k] = 0; } for (let k = 0; k < N; k++) { if (!L.walk[k]) continue; const [px, py] = ctr(k); if (polyDist(px, py, P) <= 0.9) cells.push(k); } acc[li] = cells; }
    const cx = P.reduce((t, p) => t + p[0], 0) / P.length, cy = P.reduce((t, p) => t + p[1], 0) / P.length;
    stairs.push({ si: stairs.length, id: s.id, name: s.name || 'Stair', lo: a, hi: b, width: Math.max(0.8, Math.min(s.w, s.d)), centre: [cx, cy], acc, len: Math.max(2, (levels[b].z - levels[a].z) * 1.75) }); }
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
  B.field = (key, li, targets, bed) => { const k0 = key + '|' + li + '|' + (bed ? 1 : 0); if (B.fields.has(k0)) return B.fields.get(k0); const f = dijkstra(B, levels[li], targets, bed); B.fields.set(k0, f); return f; };
  return B;
}
function dijkstra(B, L, targets, bed) {
  const { W, H, N } = B, ok = bed ? L.bedWalk : L.walk, F = new Float32Array(N).fill(Infinity), heap = [];
  const push = (k, d) => { heap.push([d, k]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (const k of targets) if (ok[k] || L.walk[k]) { F[k] = 0; push(k, 0); }
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
    if (!nP) continue; const nS = Math.max(1, Math.ceil(nP / ratio)), sroom = L.rooms.find((r) => STAFFROOM.test(r.name)) || L.rooms.find((r) => CIRC.test(r.name)), scells = []; for (let k = 0; k < B.N; k++) if (L.walk[k] && (!sroom || L.room[k] === sroom.ri)) scells.push(k);
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
    const L = levels[u.li], o2 = occ[u.li], i = u.k % W, j = (u.k / W) | 0; let cnt = 0; for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= B.H) continue; cnt += o2[jj * W + ii]; }
    const D = cnt / (25 * B.c * B.c); if (D > peak[u.li][u.k]) peak[u.li][u.k] = D; const v = speed * (D <= 0.54 ? 1 : Math.max(0.15, (1 - 0.266 * D) / (1 - 0.266 * 0.54)));
    u.d += v * dt; let moved = false; const cap = (u.wait || 0) > 2 ? 2 : 1;
    for (let guard = 0; guard < 4; guard++) { const fk = F[u.k]; if (!(fk > 0)) break; let best = -1, bf = fk, bw = 1; const ii0 = u.k % W, jj0 = (u.k / W) | 0;
      for (const [di, dj, w] of NB8) { const ii = ii0 + di, jj = jj0 + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= B.H) continue; const m = jj * W + ii; if (F[m] < bf - 1e-6 && o2[m] < cap) { if (di && dj && (!isFinite(F[jj0 * W + ii]) || !isFinite(F[jj * W + ii0]))) continue; bf = F[m]; best = m; bw = w; } }
      const len = bw * B.c; if (best < 0) { u.d = Math.min(u.d, len); u.wait = (u.wait || 0) + dt; break; } if (u.d < len) break;
      const dr = L.door[best]; if (dr >= 0 && L.door[u.k] !== dr) { const dd = doors[dr], need = u.kind === 'bed' ? 2 : u.esc?.length ? 1.5 : 1; if (dd.tokens < need) { doorMax[dr] = Math.max(doorMax[dr], (doorMax[dr] || 0) + 0); u.d = Math.min(u.d, len); u.wait = (u.wait || 0) + dt; dd.waiting = (dd.waiting || 0) + 1; break; } dd.tokens -= need; }
      o2[u.k] = Math.max(0, o2[u.k] - 1); o2[best]++; u.from = u.k; u.k = best; u.d -= len; u.wait = 0; moved = true; }
    return moved; };
  const escortsFollow = (u) => { for (const s of u.esc || []) { s.li = u.li; s.k = u.k; s.onStair = u.onStair; } };
  for (T = 0; T <= horizon; T += dt) {
    for (const d of doors) { d.tokens = Math.min(d.tokens + 1.32 * d.w * dt, Math.max(2, 1.32 * d.w)); doorMax[d.di] = Math.max(doorMax[d.di], d.waiting || 0); d.waiting = 0; }
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
        u.state = 'walk'; u.tStart = T; if (!u.goal || u.stage === 2) u.goal = u.stage === 1 ? 'h' : 'down'; }
      if (u.state === 'walk') { const F = goalField(u); if (!isFinite(F[u.k])) { u.state = 'stuck'; for (const s of u.esc) { s.state = 'idle'; s.task = null; } u.esc = []; continue; } if (F[u.k] === 0) arrive(u); else { step(u, F, u.v0); escortsFollow(u); } }
    }
    // stairs: flights meter the flow down; people from above merge at each landing
    for (const [si, S] of stairs.entries()) { const fl = flights[si];
      for (let li = S.hi; li > S.lo; li--) { const q = fl.q[li]; fl.tok[li] = Math.min((fl.tok[li] || 0) + 1.1 * S.width * dt, 2 + 1.1 * S.width); stairMax[si] = Math.max(stairMax[si], q.length);
        while (q.length && fl.tok[li] >= q[0].wgt) { const e = q.shift(); fl.tok[li] -= e.wgt; e.u.stairFrom = li; e.u.stairT0 = T; e.u.stairT1 = T + S.len / e.u.vs * (0.85 + 0.3 * r()); fl.on.push(e.u); } }
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
    const S = stairs.find((s) => s.hi === L && s.acc[L].includes(u.k)); if (!S) return; occ[L][u.k] = Math.max(0, occ[L][u.k] - 1); u.onStair = true; u.wgtS = u.kind === 'bed' ? 2.5 : u.esc?.length ? 1.5 : 1; for (const s of u.esc || []) s.onStair = true; flights[S.si].q[L].push({ u, wgt: u.wgtS }); }
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
    pats: pats.map((u) => ({ kind: u.kind, li: u.li0, k: u.k0, room: u.roomIx, t1: u.t1, t2: u.t2, t: down ? u.t2 : u.t1, moved: u.stage > 0, wait: u.waitStaff || 0 })), staffWait: staffWait / Math.max(1, pats.filter((u) => u.need && u.stage > 0).length), curve, doorMax: Array.from(doorMax), stairMax, peak, frames, kinds: U.map((u) => u.kind), perLevel, nPat: pats.length, nStaff: staffU.length, mixCount: { amb: pats.filter((u) => u.kind === 'amb').length, asst: pats.filter((u) => u.kind === 'asst').length, bed: pats.filter((u) => u.kind === 'bed').length } };
}

// ---- many runs, summarised; the run nearest the median kept with its frames for playback --------------------------------------
export async function run(building, o = {}, onProg = () => {}) {
  const B = prepare(building, o), pop = population(B, o);
  if (o.fire && o.fire.lv != null) { const li = B.levels.findIndex((L) => L.id === o.fire.lv), k = li >= 0 ? B.cellAt(o.fire.x - B.O[0], o.fire.y - B.O[1]) : -1, ri = k >= 0 ? B.levels[li].room[k] : -1;   // a room clicked in the view (plan point)
    if (ri < 0) throw Error('The fire room is not inside a room of the model: click inside a room.'); o = { ...o, fire: { li, room: ri } }; } if (!pop.pats.length) throw Error('No patient rooms found on any level: name rooms ward, patient room, bed bay or ICU on the plan.');
  if (B.exitLv < 0) throw Error('No outside door found: draw an exterior door on the ground floor.');
  if (o.strategy === 'down') { const tops = B.levels.filter((L) => L.li !== B.exitLv && pop.pats.some((p) => p.li === L.li)); for (const L of tops) if (!B.stairs.some((s) => s.hi === L.li)) throw Error(`${L.name} has no stair down: place a stair from the level below.`); }
  const runs = [], n = o.runs || DEFAULTS.runs, seed0 = o.seed ?? DEFAULTS.seed;
  for (let i = 0; i < n; i++) { for (const d of B.doors) d.tokens = 0; runs.push(simulate(B, pop, seed0 + i * 7919, { ...o })); onProg((i + 1) / (n + 1)); if (i % 2 === 1) await new Promise((r) => setTimeout(r, 0)); }
  const key = o.strategy === 'down' ? 't2' : 't1', vals = runs.map((x) => x[key]), med = pct(vals, 0.5), rep = runs.reduce((b, x) => (Math.abs(x[key] - med) < Math.abs(b[key] - med) ? x : b), runs[0]);
  for (const d of B.doors) d.tokens = 0; const shown = simulate(B, pop, rep.seed, { ...o, record: true }); onProg(1);
  return { B, pop, runs, rep: shown, key, med, p90: pct(vals, 0.9), p10: pct(vals, 0.1) };
}
export { pct };
