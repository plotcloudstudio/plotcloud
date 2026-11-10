// Egress code check (2026-11-10): the means of egress of the whole model screened against Ontario Building Code 2024
// (O. Reg. 163/24), Division B, Part 3, on the building prepared by egress.js (grid, rooms, doors, stairs, distance fields).
// A screening for the design team, not a compliance determination: it covers the measurable rules below, reads the occupant
// load from the model, assumes the stairs are exit stairs and the doors are as drawn, and leaves the rest (fire separations,
// signage, hardware, lighting, alternative solutions) to the code consultant and the authority having jurisdiction.
//
// Sources of the values (checked 2026-11-10): the OBC 2024 article text as published on codeindex.ca (not an official source)
// for 3.3.1.9, 3.3.3.3, 3.3.3.4, 3.4.2.1, 3.4.2.3, 3.4.2.4, 3.4.2.5 and 3.4.3.2.(1), (2) and (7); the minimum widths of Tables
// 3.4.3.2.-A and -B from the British Columbia Building Code 2018, which has the same structure (to confirm against the OBC
// tables). Every value is in CODE below, with its clause, so it can be checked and edited.

export const CODE = {
  name: 'Ontario Building Code 2024 (O. Reg. 163/24), Division B, Part 3',
  travel: { F1: 25, D: 40, sprinklered: 45, other: 30 },                   // 3.4.2.5.(1) (a), (b), (c), (f), m
  widthPerPerson: { care: 18.4, door: 6.1, stairLow: 8, stairOther: 9.2 },  // 3.4.3.2.(1) and (2), mm per person
  minWidth: {                                                              // Tables 3.4.3.2.-A and -B (BCBC 2018 values), mm
    general: { corridor: 1100, door: 800, stairLow: 900, stairHigh: 1100 },
    B2: { corridor: 1100, door: 850, doorSleeping: 1050, stairLow: 900, stairHigh: 1100, stairSleeping: 1650 },
    B3: { corridor: 1100, door: 850, doorSleeping: 850, stairLow: 900, stairHigh: 1100, stairSleeping: 1100, stairSleepingHigh: 1650 } },
  corridor: { public: 1100, hospital: 2400, nonAmbulatory: 1650 },          // 3.3.1.9.(1), 3.3.3.3.(2), 3.3.3.3.(3), mm
  bedDoor: 1050,                                                           // 3.3.3.4.(1), mm
  deadEnd: { C: 6, D: 9, E: 9, F2: 9, F3: 9 },                             // 3.3.1.9.(7), (9)-(11), m; none in B (3.3.3.3.(1)), A, F1
  exitSeparation: 9                                                        // 3.4.2.3.(1), m
};
export const OCC = { A: 'Group A · assembly', B1: 'Group B, Division 1 · detention', B2: 'Group B, Division 2 · care and treatment (hospital)', B3: 'Group B, Division 3 · care',
  C: 'Group C · residential', D: 'Group D · business and personal services', E: 'Group E · mercantile', F1: 'Group F, Division 1 · high-hazard industrial', F2: 'Group F, Division 2 · medium-hazard industrial', F3: 'Group F, Division 3 · low-hazard industrial' };
const CIRC = /corridor|hall|lobby|passage|circulation|走廊|过道|大厅/i, STAIRR = /stair|楼梯/i, SLEEP = /patient|ward|bed|icu|isolation|sleep|resident|bedroom|病房|卧室/i;
const fmt = (v, d = 1) => (Number.isFinite(v) ? (+v.toFixed(d)).toString() : '—');

// the exits of a level: the outside doors on the exit level, the stairs down from the floors above (up from a basement)
export function exitsOf(B, li) {
  const L = B.levels[li];
  if (li === B.exitLv) return B.doors.filter((d) => d.li === li && d.ext).map((d) => ({ kind: 'door', name: `outside door ${fmt(d.w, 2)} m`, cells: d.cells, w: d.w, door: d, pts: [d.a, d.b] }));
  const st = B.stairs.filter((s) => (li > B.exitLv ? s.hi === li : s.lo === li));
  return st.map((S) => { const [cx, cy] = S.centre; let best = null, bd = 9;   // the door into the stair: a door with the stair's room on one side, nearest the stair
    for (const d of B.doors) { if (d.li !== li || d.ext) continue; const sr = d.sides.map((ri) => (ri >= 0 ? L.rooms[ri].name : '')); if (!sr.some((n) => STAIRR.test(n))) continue; const dd = Math.hypot(d.mid[0] - cx, d.mid[1] - cy); if (dd < bd) { bd = dd; best = d; } }
    return { kind: 'stair', name: S.name, cells: S.acc[li], w: Math.min(S.width, best ? best.w : S.width), stairW: S.width, door: best, S, pts: [] }; });
}
// the clear width of a corridor at a point: the shorter of its spans across x and across y between wall faces
function spanAt(walls, x, y, dx, dy) { let t = 60;
  for (const w of walls) { const ax = w.a[0], ay = w.a[1], bx = w.b[0] - ax, by = w.b[1] - ay, den = dx * by - dy * bx; if (Math.abs(den) < 1e-9) continue;
    const s = ((ax - x) * by - (ay - y) * bx) / den, u = ((ax - x) * dy - (ay - y) * dx) / den; if (s > 0 && u >= -1e-6 && u <= 1 + 1e-6) { const face = s - (w.t || 0.2) / 2 / Math.max(1e-6, Math.abs(dx * by - dy * bx) / Math.hypot(bx, by)); if (face < t) t = Math.max(0, face); } }
  return t; }
export function corridorWidth(B, li) { const L = B.levels[li], out = []; const walls = L.walls || [];
  for (const r of L.rooms) { if (!CIRC.test(r.name) || /lobby|entrance/i.test(r.name)) continue; let mn = Infinity, at = null;
    for (let k = 0; k < B.N; k++) { if (L.room[k] !== r.ri || !L.walk[k] || L.door[k] >= 0) continue; const [x, y] = B.ctr(k), wx = spanAt(walls, x, y, 1, 0) + spanAt(walls, x, y, -1, 0), wy = spanAt(walls, x, y, 0, 1) + spanAt(walls, x, y, 0, -1), wd = Math.min(wx, wy); if (wd < mn) { mn = wd; at = [x, y]; } }
    if (Number.isFinite(mn)) out.push({ room: r.name, w: mn, at }); }
  return out; }

// o: { occ: 'B2', sprinklered, publicCorridor, lowRise (stairs rise ≤ 180 mm, run ≥ 280 mm), fromDoors (3.4.2.4.(2)), people: [{ li }] }
export function check(B, o = {}) {
  const occ = o.occ || 'D', care = /^B/.test(occ), items = [], travel = [], marks = B.levels.map(() => ({ stairs: [], doors: [] })), people = o.people || [];
  const limit = occ === 'F1' ? CODE.travel.F1 : o.sprinklered ? CODE.travel.sprinklered : occ === 'D' ? CODE.travel.D : CODE.travel.other;
  const add = (it) => { items.push(it); return it; }, P = (q) => [q[0] + B.O[0], q[1] + B.O[1]];
  const maxAbove = Math.max(0, ...B.levels.map((L) => L.li - B.exitLv));
  for (const L of B.levels) { const li = L.li, ppl = people.filter((p) => p.li === li).length, occRooms = L.rooms.filter((r) => !CIRC.test(r.name) && !STAIRR.test(r.name));
    const used = L.rooms.some((r) => !STAIRR.test(r.name)) && (ppl > 0 || occRooms.length > 0); if (!used) { travel.push(null); continue; }
    const sleeping = care && L.rooms.some((r) => SLEEP.test(r.name)), X = exitsOf(B, li), lv = L.name;
    for (const e of X) { if (e.kind === 'stair') marks[li].stairs.push({ name: e.name.toUpperCase().slice(0, 18) || 'STAIR', pts: e.S.poly.map(P) }); }
    // 3.4.2.1.(1): at least two exits
    add({ level: lv, li, clause: '3.4.2.1.(1)', title: 'Number of exits', status: X.length >= 2 ? 'pass' : 'fail', measured: `${X.length}`, required: 'at least 2', note: X.length < 2 ? 'The single-exit allowance of 3.4.2.1.(2) (small, low buildings) is not checked.' : '' });
    // 3.4.2.4 and 3.4.2.5: travel distance, along the path, to the nearest exit
    const allCells = X.flatMap((e) => e.cells), F = allCells.length ? B.field('codeexit', li, allCells, false) : null, dist = new Float32Array(B.N).fill(NaN); let worst = 0, wAt = null, wRoom = '';
    if (F) { const roomMin = new Map(); if (o.fromDoors) for (const d of B.doors) { if (d.li !== li) continue; const v = Math.min(...d.cells.map((k) => F[k])); for (const ri of d.sides) if (ri >= 0 && !CIRC.test(L.rooms[ri].name)) roomMin.set(ri, Math.min(roomMin.get(ri) ?? Infinity, v)); }
      for (let k = 0; k < B.N; k++) { if (!L.walk[k] || L.room[k] < 0) continue; const rm = L.rooms[L.room[k]]; if (STAIRR.test(rm.name)) continue; let v = F[k]; if (o.fromDoors && !CIRC.test(rm.name) && roomMin.has(rm.ri)) v = roomMin.get(rm.ri); if (!Number.isFinite(v)) continue; const m = v * B.c; dist[k] = m; if (m > worst) { worst = m; wAt = B.ctr(k); wRoom = rm.name; } } }
    travel.push(dist);
    add({ level: lv, li, clause: '3.4.2.4, 3.4.2.5.(1)', title: 'Travel distance to an exit', status: !F ? 'fail' : worst <= limit + 1e-6 ? 'pass' : 'fail', measured: F ? `${fmt(worst)} m (${wRoom})` : 'no exit', required: `≤ ${limit} m`, at: wAt, note: o.fromDoors ? 'Measured from the doors of rooms taken as separated from the corridor (3.4.2.4.(2)); the separation itself is not checked.' : 'Measured from any point of the floor area along the path of travel.' });
    // 3.4.2.3.(1): the distance between two exits (the shortest path smoke would travel on the floor)
    if (X.length >= 2) { let best = 0; for (let i = 0; i < X.length; i++) { const Fi = B.field('codex' + li + ':' + i, li, X[i].cells, false); for (let j = i + 1; j < X.length; j++) { const d = Math.min(...X[j].cells.map((k) => Fi[k])) * B.c; if (Number.isFinite(d) && d > best) best = d; } }
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let k = 0; k < B.N; k++) { if (!L.walk[k] || L.room[k] < 0) continue; const [x, y] = B.ctr(k); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const diag = Math.hypot(x1 - x0, y1 - y0), req = o.publicCorridor !== false ? Math.min(diag / 2, CODE.exitSeparation) : Math.max(diag / 2, CODE.exitSeparation);
      add({ level: lv, li, clause: '3.4.2.3.(1)', title: 'Distance between exits', status: best >= req - 1e-6 ? 'pass' : 'fail', measured: `${fmt(best)} m`, required: `≥ ${fmt(req)} m (${o.publicCorridor !== false ? 'half the diagonal, need not exceed 9 m' : 'half the diagonal, at least 9 m'}; diagonal ${fmt(diag)} m)` }); }
    // 3.4.3.2: the aggregate exit width for the occupant load, each exit counting for at most half (7)
    if (X.length) { const f = care ? CODE.widthPerPerson.care : li === B.exitLv ? CODE.widthPerPerson.door : o.lowRise !== false ? CODE.widthPerPerson.stairLow : CODE.widthPerPerson.stairOther, req = ppl * f, prov = X.reduce((s, e) => s + Math.min(e.w * 1000, X.length > 1 ? req / 2 : Infinity), 0);
      add({ level: lv, li, clause: care ? '3.4.3.2.(2), (7)' : '3.4.3.2.(1), (7)', title: 'Exit width for the occupant load', status: prov >= req - 1e-6 ? 'pass' : 'fail', measured: `${fmt(prov, 0)} mm counted (${X.map((e) => fmt(e.w * 1000, 0)).join(' + ')} mm)`, required: `≥ ${fmt(req, 0)} mm (${ppl} people × ${f} mm)`, note: 'Occupant load from the model (the room loads of the study, or the numbers set per floor); OBC Table 3.1.17.1 may give a different load.' }); }
    // Tables 3.4.3.2.-A and -B: minimum widths of the exit doors and stairs
    const T = occ === 'B2' ? CODE.minWidth.B2 : occ === 'B3' ? CODE.minWidth.B3 : CODE.minWidth.general, high = maxAbove > 2;
    for (const e of X) { const isStair = e.kind === 'stair', need = isStair ? (sleeping && T.stairSleeping ? (high && T.stairSleepingHigh ? T.stairSleepingHigh : T.stairSleeping) : high ? T.stairHigh : T.stairLow) : (sleeping && T.doorSleeping ? T.doorSleeping : T.door), have = (isStair ? e.stairW : e.w) * 1000, ok = have >= need - 1;
      add({ level: lv, li, clause: 'Table 3.4.3.2.-' + (/^B[23]/.test(occ) ? 'B' : 'A'), title: `Minimum width: ${isStair ? 'exit stair' : 'exit door'} (${e.name})`, status: ok ? 'pass' : 'fail', measured: `${fmt(have, 0)} mm`, required: `≥ ${need} mm${sleeping ? ' (serving patients’ or residents’ sleeping rooms)' : ''}`, note: 'Table values from BCBC 2018 (same structure); confirm against OBC Table 3.4.3.2.' });
      if (isStair && e.door) { const dn = sleeping && T.doorSleeping ? T.doorSleeping : T.door, dh = e.door.w * 1000; add({ level: lv, li, clause: 'Table 3.4.3.2.-' + (/^B[23]/.test(occ) ? 'B' : 'A'), title: `Minimum width: door into ${e.name}`, status: dh >= dn - 1 ? 'pass' : 'fail', measured: `${fmt(dh, 0)} mm`, required: `≥ ${dn} mm` }); }
      const dd = e.door; if (dd) marks[li].doors.push([P(dd.a), P(dd.b), ok ? 'exit' : 'blocked', ok ? 'EXIT' : 'TOO NARROW']); }
    // 3.3.1.9.(1), 3.3.3.3.(2), (3): corridor clear widths, between wall faces
    const cw = corridorWidth(B, li), cReq = occ === 'B2' && sleeping ? CODE.corridor.hospital : occ === 'B3' && sleeping ? CODE.corridor.nonAmbulatory : CODE.corridor.public;
    if (cw.length) { const mn = cw.reduce((a, c) => (c.w < a.w ? c : a)); add({ level: lv, li, clause: occ === 'B2' && sleeping ? '3.3.3.3.(2)' : occ === 'B3' && sleeping ? '3.3.3.3.(3)' : '3.3.1.9.(1)', title: 'Corridor clear width', status: mn.w * 1000 >= cReq - 1 ? 'pass' : 'fail', measured: `${fmt(mn.w * 1000, 0)} mm narrowest (${mn.room})`, required: `≥ ${cReq} mm${occ === 'B2' && sleeping ? ' (corridor serving patients in a hospital)' : ''}`, at: mn.at, note: 'Between wall faces; handrails, equipment alcoves and furniture are not deducted.' }); }
    // 3.3.3.4.(1): doorways that beds pass through
    if (care) { const bedRooms = new Set(L.rooms.filter((r) => SLEEP.test(r.name) && !/ensuite|en-suite|toilet|bath|wc|shower/i.test(r.name)).map((r) => r.ri)), bd = B.doors.filter((d) => d.li === li && d.sides.some((ri) => bedRooms.has(ri)) && d.sides.some((ri) => ri >= 0 && CIRC.test(L.rooms[ri].name)));
      if (bd.length) { const bad = bd.filter((d) => d.w * 1000 < CODE.bedDoor - 1); for (const d of bad) marks[li].doors.push([P(d.a), P(d.b), 'blocked', 'NARROW']);
        add({ level: lv, li, clause: '3.3.3.4.(1)', title: 'Doorways that beds pass through', status: bad.length ? 'fail' : 'pass', measured: bad.length ? `${bad.length} of ${bd.length} narrower (narrowest ${fmt(Math.min(...bad.map((d) => d.w)) * 1000, 0)} mm)` : `${bd.length} doors, narrowest ${fmt(Math.min(...bd.map((d) => d.w)) * 1000, 0)} mm`, required: `≥ ${CODE.bedDoor} mm clear` }); } }
    // 3.3.1.9 and 3.3.3.3.(1): dead-end corridors, along corridors only (the shared part of the routes to two exits, below)
    if (X.length >= 2) { const exitRooms = new Set(X.flatMap((e) => (e.door ? e.door.sides : [])).filter((ri) => ri >= 0)), block = new Uint8Array(B.N); for (let k = 0; k < B.N; k++) { if (!L.walk[k]) continue; const ri = L.room[k], nm = ri >= 0 ? L.rooms[ri].name : ''; if (!(CIRC.test(nm) || STAIRR.test(nm) || /entrance|vestibule|foyer|atrium/i.test(nm) || exitRooms.has(ri) || L.door[k] >= 0)) block[k] = 1; }   // the way out: corridors, stairs, entrance halls and the rooms the exits open from
      for (const e of X) for (const k of e.cells) block[k] = 0; const Fs = X.map((e, i) => B.field('codedead' + li + ':' + i, li, e.cells, false, block, 'cd')), D = X.map((_, i) => X.map((e, j) => Math.min(...e.cells.map((k) => Fs[i][k]))));
      const cwMax = cw.length ? Math.max(...cw.map((c) => c.w)) : 2; let worstD = 0, dAt = null, dRoom = '';
      const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]], trace = (F, k0) => { const out = [k0]; let k = k0; for (let g = 0; g < 4000 && F[k] > 0; g++) { const i = k % B.W, j = (k / B.W) | 0; let best = -1, bf = F[k]; for (const [di, dj] of NB) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= B.W || jj >= B.H) continue; const m = jj * B.W + ii; if (F[m] < bf - 1e-6) { bf = F[m]; best = m; } } if (best < 0) break; k = best; out.push(k); } return out; };
      // the routes from a point to two different exits, followed down their distance fields: how far they run together (within a
      // corridor's half width) before they part; the least over the pairs of exits is the dead-end length at that point
      const shared = (a, b) => { let len = 0; for (let n = 1; n < Math.min(a.length, b.length); n++) { const [ax, ay] = B.ctr(a[n]), [bx, by] = B.ctr(b[n]); if (Math.hypot(ax - bx, ay - by) > Math.max(1.2, cwMax / 2)) return len; const [px, py] = B.ctr(a[n - 1]); len += Math.hypot(ax - px, ay - py); } return len; };
      for (let k = 0; k < B.N; k++) { const ri = L.room[k]; if (ri < 0 || !L.walk[k] || !CIRC.test(L.rooms[ri].name)) continue; let m = Infinity; const tr = X.map((_, i) => (Number.isFinite(Fs[i][k]) ? trace(Fs[i], k) : null));
        for (let i = 0; i < X.length && m > 0; i++) for (let j = i + 1; j < X.length && m > 0; j++) { if (!tr[i] || !tr[j]) continue; const v = shared(tr[i], tr[j]); if (v < m) m = v; } if (!Number.isFinite(m)) continue; const len = m - cwMax / 2; if (len > worstD) { worstD = len; dAt = B.ctr(k); dRoom = L.rooms[ri].name; } }
      const lim = care || occ === 'A' || occ === 'B1' || occ === 'F1' ? 0 : CODE.deadEnd[occ] ?? 6, tol = 0.5 + B.c;
      add({ level: lv, li, clause: care ? '3.3.3.3.(1)' : '3.3.1.9.(5)–(12)', title: 'Dead-end corridors', status: worstD <= lim + tol ? 'pass' : 'fail', measured: worstD > tol ? `${fmt(worstD)} m (${dRoom})` : 'none found', required: lim ? `≤ ${lim} m${occ === 'C' ? '' : ' (serving not more than 30 people, self-closing doors)'}` : 'none, unless the area it serves has a second and separate means of egress', at: dAt, note: `Measured along corridors, from each point, how far the ways to two different exits run together before they part, less half the corridor width; ${fmt(tol)} m tolerance for the grid.` }); }
  }
  return { items, travel, limit, marks, occ, pass: items.filter((i) => i.status === 'pass').length, fail: items.filter((i) => i.status === 'fail').length };
}
