// Wayfinding for signs (2026-11-18): where visitors are likely to lose their way and where a sign is needed. Builds on the
// Wayfinding study's grid (emb/lib/plansim.js: the same raster of free floor, walls painted except where the doors are, sight
// lines on the same grid) and adds:
// · starts where visitors start: lift lobbies and stair landings on every floor, the main entrances on the ground floor, or a point
//   the person clicks; never a room's centre
// · routes from each start to each destination room over real floor (walls, doors, rooms with no public access left out), to the
//   room's door; rooms on another floor by a lift or a stair paired between the floors
// · the corridor network: the public floor thinned to its centre lines; junctions, turns, lift and stair exits as candidate points
// · a Signage Priority Score (0–100) for each point from six factors with written formulas, the sign it calls for, its facing
//   and the destinations each way, from the walker's own direction (never the screen's left and right)
// Pure functions over plan scenes (planScene(…, 'wayfinding')): no DOM, so the Node tests run the same code.
import { raster, paintSeg, paintRect, cellOf, centre, los, wallPieces, ROOM_SKIP, sceneBounds } from '../../../emb/lib/plansim.js?v=1';

export const LIFT = /elevator|\blifts?\b|电梯/i, STAIR = /stair|楼梯/i, LOBBY = /lobby|vestibule|foyer|landing|\bhall\b|厅/i;
export const STAFF_ONLY = /\bstaff\b|clean (?:utility|linen|supply)|soiled|dirty utility|\butility\b|mechanical|electrical|\bplant\b|server|housekeeping|janitor|\bstores?\b|storage|nourishment|\bmail\b|linen/i;
export const DEFAULT_WEIGHTS = { A: 25, B: 20, C: 20, D: 15, F: 20 };
export const CLASSES = [[60, 'High', '#d8402a'], [35, 'Medium', '#e0a020'], [0, 'Low', '#3f9d5a']];
const F_WALL = 1, F_FURN = 2, F_IN = 4, F_OUT = 8, F_BLOCK = 16, S_OPQ = 1, S_FURN = 2;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), ang = (v) => Math.atan2(v[1], v[0]), unit = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const wrap = (t) => { while (t > Math.PI) t -= 2 * Math.PI; while (t < -Math.PI) t += 2 * Math.PI; return t; }, deg = (t) => (t * 180) / Math.PI;
const mid = (o) => [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2];
export const classOf = (s) => CLASSES.find(([t]) => s >= t);
const isCirc = (name) => ROOM_SKIP.test(name) || LIFT.test(name);

// ---- groups from the room names: "Patient room 301" and "Patient room 302" are Patient rooms 301–302
export function groupName(name) { const n = String(name || '').trim(), base = n.replace(/[\s#-]*(?:[A-Z]?\d+[A-Z]?|[IVX]+)(?:\s*[-–]\s*\d+)?$/u, '').trim(); return base || n; }
const numOf = (name) => { const m = /(\d+)[A-Z]?$/.exec(String(name || '').trim()); return m ? +m[1] : null; };
const plural = (s) => (/(s|x|ch|sh)$/i.test(s) ? s : /[^aeiou]y$/i.test(s) ? s.slice(0, -1) + 'ies' : s + 's');
/** a group's label for a sign: "Patient rooms 301–320", or the room's own name when it is alone */
export function groupLabel(g, rooms) { if (rooms.length === 1) return rooms[0].name; const ns = rooms.map((r) => numOf(r.name)).filter((x) => x != null).sort((a, b) => a - b);
  return `${plural(g)}${ns.length >= 2 ? ` ${ns[0]}–${ns.at(-1)}` : ''}`; }

// ---- one floor prepared: the walking grid (as the Wayfinding study), the sight grid, which room each cell is in, the doors
export function prepare(sc, o = {}) {
  const SC = { ...sc, walls: sc.walls || [], open: sc.open || [], rooms: sc.rooms || [], furn: sc.furn || [] }, B = sceneBounds(SC), A = B.x1 * B.y1;
  const c = o.cell || Math.max(o.precise ? 0.15 : 0.2, Math.min(0.5, Math.sqrt(A / 30000)) / (o.precise ? 2 : 1)), eye = o.eye || 1.6;
  const R = raster(B, c), SR = raster(B, c), roomAt = new Int32Array(R.W * R.H).fill(-1);
  const staff = (r) => (o.access && r.name in o.access ? o.access[r.name] === 'staff' : STAFF_ONLY.test(r.name) && !isCirc(r.name));
  SC.rooms.forEach((r, i) => { r._i = i; r.circ = isCirc(r.name); r.staff = staff(r); r.group = (o.groups && o.groups[r.name]) || groupName(r.name);
    for (const [x, y, w, d] of r.rects) { paintRect(R, x, y, w, d, F_IN); const i0 = Math.max(0, Math.floor((x - R.x0) / c)), i1 = Math.min(R.W - 1, Math.floor((x + w - R.x0) / c)), j0 = Math.max(0, Math.floor((y - R.y0) / c)), j1 = Math.min(R.H - 1, Math.floor((y + d - R.y0) / c));
      for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) { const p = centre(R, j * R.W + k); if (p[0] >= x && p[0] <= x + w && p[1] >= y && p[1] <= y + d) roomAt[j * R.W + k] = i; } } });
  // the doors, with the rooms either side (half a metre off the door's middle, square to it)
  const roomOfPt = (p) => { const k = cellOf(R, p); return k >= 0 ? roomAt[k] : -1; };
  const doors = SC.open.filter((x) => x.kind === 'door' || x.kind === 'hole').map((x, i) => { const m = mid(x), u = unit([x.b[0] - x.a[0], x.b[1] - x.a[1]]), n = [-u[1], u[0]], w = x.w || dist(x.a, x.b);
    const s1 = roomOfPt([m[0] + n[0] * 0.5, m[1] + n[1] * 0.5]), s2 = roomOfPt([m[0] - n[0] * 0.5, m[1] - n[1] * 0.5]); return { i, o: x, m, n, w, rooms: [s1, s2], ext: !!x.ext }; });
  for (const d of doors) paintSeg(R, d.o.a, d.o.b, 0.3, F_IN);   // a doorway lies in the wall's thickness, in no room: its floor is inside
  for (let k = 0; k < R.a.length; k++) if (!(R.a[k] & F_IN)) R.a[k] |= F_OUT;
  for (const w of SC.walls) { for (const [a, b] of wallPieces(w, SC.open, ['door', 'hole'])) { paintSeg(R, a, b, (w.t || 0.2) / 2 + 0.12, F_WALL); paintSeg(SR, a, b, (w.t || 0.2) / 2, S_OPQ); } }
  for (const f of SC.furn) { if (o.furn && f.h > 0.3) paintRect(R, f.x, f.y, f.w, f.d, F_FURN, 0.05); if (f.h >= eye) paintRect(SR, f.x, f.y, f.w, f.d, S_FURN); }
  // rooms with no public access cannot be walked through; with "accessible route only", doors narrower than the minimum are shut
  for (const r of SC.rooms) if (r.staff) for (const [x, y, w, d] of r.rects) paintRect(R, x + c, y + c, Math.max(0, w - 2 * c), Math.max(0, d - 2 * c), F_BLOCK);
  if (o.accessible) for (const d of doors) if (d.w < (o.minDoor || 0.85)) paintSeg(R, d.o.a, d.o.b, 0.35, F_WALL);
  return { SC, R, SR, c, roomAt, doors, eye, rooms: SC.rooms, sight: (p, q) => los(SR, p, q, S_OPQ | S_FURN) };
}
const freeMask = (mask) => (F) => (k) => k >= 0 && !(F.R.a[k] & mask);
const FREE = freeMask(F_WALL | F_FURN | F_OUT | F_BLOCK), FREE_ANY = freeMask(F_WALL | F_FURN | F_OUT);
function nearestFree(F, p, free, maxR = 3) { const R = F.R, k0 = cellOf(R, p); if (free(k0)) return k0; let best = -1, bd = Infinity; const n = Math.ceil(maxR / R.c), i0 = Math.floor((p[0] - R.x0) / R.c), j0 = Math.floor((p[1] - R.y0) / R.c);
  for (let j = j0 - n; j <= j0 + n; j++) for (let i = i0 - n; i <= i0 + n; i++) { if (i < 0 || j < 0 || i >= R.W || j >= R.H) continue; const k = j * R.W + i; if (!free(k)) continue; const d = dist(centre(R, k), p); if (d < bd) { bd = d; best = k; } } return best; }
// shortest walks from a cell: 8 directions, no cutting corners (the Wayfinding study's rule)
function walk(F, s0, free) { const R = F.R, N = R.W * R.H, D = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1); if (s0 < 0) return { D, prev }; D[s0] = 0;
  const H = [[0, s0]], push = (e) => { H.push(e); let i = H.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (H[q][0] <= H[i][0]) break; [H[q], H[i]] = [H[i], H[q]]; i = q; } };
  const pop = () => { const t = H[0], l = H.pop(); if (H.length) { H[0] = l; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < H.length && H[a][0] < H[m][0]) m = a; if (b < H.length && H[b][0] < H[m][0]) m = b; if (m === i) break; [H[m], H[i]] = [H[i], H[m]]; i = m; } } return t; };
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  while (H.length) { const [d, k] = pop(); if (d > D[k]) continue; const i = k % R.W, j = (k / R.W) | 0;
    for (const [di, dj, w] of NB) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= R.W || b >= R.H) continue; const q = b * R.W + a; if (!free(q)) continue; if (di && dj && (!free(j * R.W + a) || !free(b * R.W + i))) continue;
      const nd = d + w * R.c; if (nd < D[q]) { D[q] = nd; prev[q] = k; push([nd, q]); } } }
  return { D, prev }; }

// the model's stairs that reach a floor (from it or arriving on it), moved from plan world coordinates to that floor's scene coordinates
export function stairsOn(building, lv) { const o = (lv.sc && lv.sc.origin) || [0, 0]; return (building.stairs || []).filter((s) => s.lv === lv.id || s.top === lv.id).map((s) => ({ ...s, corners: s.corners.map((p) => [p[0] - o[0], p[1] - o[1]]) })); }
// ---- the starts on a floor: lift lobbies, stair landings, the main entrances (ground floor only), points the person set
export function startsOf(F, { stairs = [], ground = false, manual = [] } = {}) {
  const out = [], R = F.R, rooms = F.rooms, outside = (d, r) => { const s = d.rooms[0] === r._i ? -1 : 1; return [d.m[0] + d.n[0] * 0.8 * s, d.m[1] + d.n[1] * 0.8 * s]; };
  // the doors of a lift or stair room that open onto public circulation (not to outside, not into a room), named by the side they face when there are several
  const side = (d, r) => { const s = d.rooms[0] === r._i ? -1 : 1, a = Math.atan2(d.n[1] * s, d.n[0] * s), north = (F.SC.settings && F.SC.settings.north) || 0; return ['east', 'north', 'west', 'south'][Math.round((((a * 180 / Math.PI + north) % 360) + 360) % 360 / 90) % 4]; };
  const publicDoors = (r) => F.doors.filter((d) => d.rooms.includes(r._i) && !d.ext && d.rooms.every((x) => x === r._i || x < 0 || F.rooms[x].circ));
  const named = (base, ds, d, r) => (ds.length > 1 ? `${base} (${side(d, r)} door)` : base);
  const free = FREE(F), keep = (s) => { const k = nearestFree(F, s.p, free, 2.5); if (k < 0) return; s.p = centre(R, k); if (!out.some((x) => x.kind === s.kind && dist(x.p, s.p) < 3)) out.push(s); };
  const cen = (r) => { let a = 0, x = 0, y = 0; for (const [rx, ry, w, d] of r.rects) { a += w * d; x += (rx + w / 2) * w * d; y += (ry + d / 2) * w * d; } return a ? [x / a, y / a] : r.label; };
  // lifts: a lift car or shaft room (not its lobby); the start is in the lobby just outside its door, else the lobby's floor nearest it
  const lifts = rooms.filter((r) => LIFT.test(r.name) && !LOBBY.test(r.name)), lobbies = rooms.filter((r) => LIFT.test(r.name) && LOBBY.test(r.name));
  for (const r of lifts) { const ds = publicDoors(r); const pos = cen(r);
    if (ds.length) for (const d of ds) keep({ kind: 'lift', name: named(`Elevator lobby · ${r.name}`, ds, d, r), p: outside(d, r), link: pos, room: r.name });
    else { const lb = lobbies.slice().sort((a, b) => dist(cen(a), pos) - dist(cen(b), pos))[0]; if (lb) { const k = nearestInRoom(F, lb, pos); if (k >= 0) keep({ kind: 'lift', name: `Elevator lobby · ${lb.name}`, p: centre(R, k), link: pos, room: r.name }); } } }
  for (const lb of lobbies) if (!out.some((s) => s.kind === 'lift' && cellOf(R, s.p) >= 0 && F.roomAt[cellOf(R, s.p)] === lb._i)) { const pos = cen(lb), k = nearestInRoom(F, lb, pos); if (k >= 0) keep({ kind: 'lift', name: `Elevator lobby · ${lb.name}`, p: centre(R, k), link: pos, room: lb.name }); }
  // stairs: a stair room's doors (the landing outside), or a drawn stair's foot
  const stairRooms = rooms.filter((r) => STAIR.test(r.name) && !LOBBY.test(r.name));
  for (const r of stairRooms) { const pos = cen(r), ds = publicDoors(r); for (const d of ds) keep({ kind: 'stair', name: named(`Stair landing · ${r.name}`, ds, d, r), p: outside(d, r), link: pos, room: r.name }); }
  for (const s of stairs) { const pos = s.corners.reduce((a, p) => [a[0] + p[0] / s.corners.length, a[1] + p[1] / s.corners.length], [0, 0]), k0 = cellOf(R, pos), inRoom = k0 >= 0 && F.roomAt[k0] >= 0 && STAIR.test(F.rooms[F.roomAt[k0]].name);
    const near = out.find((x) => x.kind === 'stair' && dist(x.link, pos) < 6); if (inRoom || near) { if (near) (near.sids = near.sids || []).push(s.id); continue; }   // a drawn stair inside a stair room, or beside another: that landing is the start (it keeps the stair's id to pair the floors)
    let best = null, bd = Infinity; for (const p of s.corners) { const k = nearestFree(F, p, free, 2.5); if (k >= 0) { const q = centre(R, k), d2 = dist(q, p); if (d2 < bd) { bd = d2; best = q; } } } if (best) keep({ kind: 'stair', name: `Stair · ${s.name}`, p: best, link: pos, sids: [s.id] }); }
  if (ground) F.doors.filter((d) => d.ext).forEach((d, i) => { const r = d.rooms.find((x) => x >= 0); const s = r === d.rooms[0] ? 1 : -1; keep({ kind: 'entrance', name: `Entrance ${i + 1} (${d.w.toFixed(1)} m door)`, p: [d.m[0] + d.n[0] * 0.8 * s, d.m[1] + d.n[1] * 0.8 * s], link: d.m }); });
  manual.forEach((m, i) => keep({ kind: 'manual', name: m.name || `Start ${i + 1} (set by hand)`, p: m.p.slice(), link: m.p }));
  const seen = {}; for (const s of out) { seen[s.name] = (seen[s.name] || 0) + 1; if (seen[s.name] > 1) s.name += ` ${seen[s.name]}`; }   // two lifts of one name: Bed elevators, Bed elevators 2
  return out.map((s, i) => ({ ...s, id: `${s.kind}:${i}` })); }
function nearestInRoom(F, r, p) { const R = F.R, free = FREE(F); let best = -1, bd = Infinity; for (let k = 0; k < F.roomAt.length; k++) if (F.roomAt[k] === r._i && free(k)) { const d = dist(centre(R, k), p); if (d < bd) { bd = d; best = k; } } return best; }

// ---- one route: from a start's walks to a room's door, pulled tight (as the Wayfinding study); or why there is none
function routeTo(F, W, r, start, diag) {
  const R = F.R, c = R.c; let best = -1, bd = Infinity;
  for (let k = 0; k < F.roomAt.length; k++) if (F.roomAt[k] === r._i && W.D[k] < bd) { bd = W.D[k]; best = k; }
  if (best < 0 || !Number.isFinite(bd)) return { room: r, start, noRoute: true, reason: diag(r) };
  const cells = []; for (let k = best; k >= 0; k = W.prev[k]) cells.push(centre(R, k)); cells.reverse(); cells[0] = start.p.slice();
  const wl = (p, q) => los(R, p, q, F_WALL | F_FURN | F_OUT | F_BLOCK), pts = [cells[0]]; let i = 0;
  while (i < cells.length - 1) { let j = Math.min(cells.length - 1, i + 400); while (j > i + 1 && !wl(cells[i], cells[j])) j--; pts.push(cells[j]); i = j; }
  // the room's door: the opening nearest where the walk enters the room; the route ends at its middle
  const end = centre(R, best); let door = null, dd = 1.4; for (const d of F.doors) { if (!d.rooms.includes(r._i)) continue; const e = dist(d.m, end); if (e < dd) { dd = e; door = d; } }
  if (door) { pts[pts.length - 1] = door.m.slice(); }
  const len = pts.reduce((s, p, k) => (k ? s + dist(pts[k - 1], p) : 0), 0), marks = [door ? door.m : end];
  if (door) for (const u of [0.25, 0.75]) for (const s of [-1, 1]) marks.push([door.o.a[0] + (door.o.b[0] - door.o.a[0]) * u + door.n[0] * 0.25 * s, door.o.a[1] + (door.o.b[1] - door.o.a[1]) * u + door.n[1] * 0.25 * s]);
  return { room: r, start, pts, len, door, marks }; }

// a route's point at a distance along it (negative: back from the end); and the dense polyline for matching
const along = (pts, s) => { let acc = 0; for (let i = 1; i < pts.length; i++) { const L = dist(pts[i - 1], pts[i]); if (acc + L >= s) { const t = L ? (s - acc) / L : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]; } acc += L; } return pts.at(-1).slice(); };
const dense = (pts, st = 0.25) => { const out = []; let s = 0; for (let i = 1; i < pts.length; i++) { const L = dist(pts[i - 1], pts[i]), n = Math.max(1, Math.ceil(L / st)); for (let k = 0; k < n; k++) { const t = k / n; out.push({ p: [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t], s: s + L * t }); } s += L; } out.push({ p: pts.at(-1).slice(), s }); return out; };

// ---- the corridor network: the public floor thinned to its centre lines (Zhang–Suen), short spurs pruned; nodes where three or
// more ways meet, where a long corridor turns, and the edges between them with their lengths
export function corridorNet(F, { prune = 1.6, turnDeg = 45 } = {}) {
  const R = F.R, W = R.W, H = R.H, N = W * H, free = FREE(F), circ = new Uint8Array(N);
  for (let k = 0; k < N; k++) { if (!free(k)) continue; const ri = F.roomAt[k]; if (ri >= 0) { if (F.rooms[ri].circ) circ[k] = 1; } else { // a doorway: public only between public spaces
      const p = centre(R, k), d = F.doors.find((x) => dist(x.m, p) < Math.max(0.6, x.w / 2 + 0.2)); if (d && d.rooms.every((x) => x < 0 || F.rooms[x].circ)) circ[k] = 1; } }
  // half-width: distance to the nearest non-public cell (two-pass chamfer)
  const hw = new Float32Array(N); for (let k = 0; k < N; k++) hw[k] = circ[k] ? 1e9 : 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; if (!hw[k]) continue; if (i) hw[k] = Math.min(hw[k], hw[k - 1] + 1); if (j) hw[k] = Math.min(hw[k], hw[k - W] + 1); if (i && j) hw[k] = Math.min(hw[k], hw[k - W - 1] + 1.414); if (j && i < W - 1) hw[k] = Math.min(hw[k], hw[k - W + 1] + 1.414); }
  for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) { const k = j * W + i; if (!hw[k]) continue; if (i < W - 1) hw[k] = Math.min(hw[k], hw[k + 1] + 1); if (j < H - 1) hw[k] = Math.min(hw[k], hw[k + W] + 1); if (i < W - 1 && j < H - 1) hw[k] = Math.min(hw[k], hw[k + W + 1] + 1.414); if (j < H - 1 && i) hw[k] = Math.min(hw[k], hw[k + W - 1] + 1.414); }
  const S = circ.slice(), nb = (k) => { const i = k % W, j = (k / W) | 0, g = (a, b) => (a < 0 || b < 0 || a >= W || b >= H ? 0 : S[b * W + a]); return [g(i, j - 1), g(i + 1, j - 1), g(i + 1, j), g(i + 1, j + 1), g(i, j + 1), g(i - 1, j + 1), g(i - 1, j), g(i - 1, j - 1)]; };
  for (let it = 0; it < 400; it++) { let changed = 0; for (const pass of [0, 1]) { const del = []; for (let k = 0; k < N; k++) { if (!S[k]) continue; const P = nb(k), Bn = P.reduce((a, b) => a + b, 0); if (Bn < 2 || Bn > 6) continue; let A = 0; for (let q = 0; q < 8; q++) if (!P[q] && P[(q + 1) % 8]) A++; if (A !== 1) continue;
          if (pass === 0 ? (P[0] * P[2] * P[4] === 0 && P[2] * P[4] * P[6] === 0) : (P[0] * P[2] * P[6] === 0 && P[0] * P[4] * P[6] === 0)) del.push(k); } for (const k of del) S[k] = 0; changed += del.length; } if (!changed) break; }
  const deg = (k) => nb(k).reduce((a, b) => a + b, 0), cn = (k) => { const P = nb(k); let A = 0; for (let q = 0; q < 8; q++) if (!P[q] && P[(q + 1) % 8]) A++; return A; };
  // trace the skeleton into a graph; prune dead-end spurs shorter than the corridor's own width (they are its corners, not corridors)
  const build = () => { const isNode = new Uint8Array(N); for (let k = 0; k < N; k++) if (S[k] && (cn(k) >= 3 || deg(k) === 1)) isNode[k] = 1;
    // nodes: clusters of branch cells within two cells; end cells their own nodes
    const nodeOf = new Int32Array(N).fill(-1), nodes = []; for (let k = 0; k < N; k++) { if (!isNode[k] || nodeOf[k] >= 0) continue; const id = nodes.length, st = [k], cells = []; nodeOf[k] = id;
      while (st.length) { const q = st.pop(); cells.push(q); const i = q % W, j = (q / W) | 0; for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= H) continue; const r = b * W + a; if (isNode[r] && nodeOf[r] < 0 && deg(q) !== 1 && deg(r) !== 1) { nodeOf[r] = id; st.push(r); } } }
      const p = cells.reduce((a, q) => { const cc = centre(R, q); return [a[0] + cc[0] / cells.length, a[1] + cc[1] / cells.length]; }, [0, 0]); nodes.push({ id, p, cells, end: cells.length === 1 && deg(cells[0]) === 1, hw: Math.max(...cells.map((q) => hw[q])) * R.c }); }
    // edges: from each node cell along the skeleton to the next node; every skeleton cell between nodes belongs to one edge only, so a
    // corridor reached from two cells of one junction, or traced from both ends, is kept once
    const edges = [], owner = new Int32Array(N).fill(-1), NB8 = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
    for (const n of nodes) for (const c0 of n.cells) { const i0 = c0 % W, j0 = (c0 / W) | 0; for (const [di, dj] of NB8) { const a = i0 + di, b = j0 + dj; if (a < 0 || b < 0 || a >= W || b >= H) continue; let k = b * W + a; if (!S[k] || nodeOf[k] === n.id || owner[k] >= 0) continue;
        const path = [c0, k], inPath = new Set(path); let prev = c0, guard = 0, dup = false;
        while (nodeOf[k] < 0 && guard++ < N) { if (owner[k] >= 0) { dup = true; break; } const i = k % W, j = (k / W) | 0; let nx = -1;
          for (const [ei, ej] of NB8) { const x = i + ei, y = j + ej; if (x < 0 || y < 0 || x >= W || y >= H) continue; const r = y * W + x; if (!S[r] || r === prev || inPath.has(r) || nodeOf[r] === n.id && path.length < 3) continue; if (nodeOf[r] >= 0) { nx = r; break; } if (nx < 0) nx = r; }
          if (nx < 0) break; prev = k; k = nx; path.push(k); inPath.add(k); }
        if (dup || nodeOf[k] < 0) continue; const id = edges.length; for (let x = 1; x < path.length - 1; x++) owner[path[x]] = id;
        const pts = path.map((q) => centre(R, q)); edges.push({ a: n.id, b: nodeOf[k], pts, len: pts.reduce((s, p, x) => (x ? s + dist(pts[x - 1], p) : 0), 0) }); } }
    return { nodes, edges }; };
  let G = build();
  for (let round = 0; round < 4; round++) { let cut = 0; for (const e of G.edges) { const na = G.nodes[e.a], nbb = G.nodes[e.b], end = na.end ? na : nbb.end ? nbb : null; if (!end || na.end && nbb.end) continue; const other = end === na ? nbb : na;
      if (e.len < Math.max(prune, other.hw * 2.2)) { for (const p of e.pts) { const k = cellOf(R, p); if (k >= 0 && !other.cells.includes(k)) S[k] = 0; } cut++; } } if (!cut) break; G = build(); }
  // keep junctions (3+ edges) and ends; a corridor that turns sharply (over turnDeg across 2 m either side, both runs at least 2 m) gets a turn node
  const nodes = [], map = new Map(), edges = []; G.nodes.forEach((n) => { const d = G.edges.filter((e) => e.a === n.id || e.b === n.id).length; if (d >= 3 || d === 1) { map.set(n.id, nodes.length); nodes.push({ id: nodes.length, p: n.p, hw: n.hw, kind: d >= 3 ? 'junction' : 'end', deg: d }); } });
  // chains through the degree-2 nodes, merged into edges between the kept nodes
  const adj = new Map(); for (const e of G.edges) { for (const [x, y] of [[e.a, e.b], [e.b, e.a]]) { if (!adj.has(x)) adj.set(x, []); adj.get(x).push({ e, to: y }); } }
  const used = new Set(); for (const [nid, ni] of map) for (const { e, to } of adj.get(nid) || []) { if (used.has(e)) continue; used.add(e); let pts = e.a === nid ? e.pts.slice() : e.pts.slice().reverse(), cur = to, guard = 0;
    while (!map.has(cur) && guard++ < 1000) { const nx = (adj.get(cur) || []).find((x) => !used.has(x.e)); if (!nx) break; used.add(nx.e); pts = pts.concat((nx.e.a === cur ? nx.e.pts : nx.e.pts.slice().reverse()).slice(1)); cur = nx.to; }
    if (!map.has(cur)) continue; edges.push({ a: ni, b: map.get(cur), pts, len: pts.reduce((s, p, x) => (x ? s + dist(pts[x - 1], p) : 0), 0) }); }
  // turns along the edges: simplify (0.3 m), then a corner of more than turnDeg with 2 m runs either side splits the edge
  const simplify = (P, tol) => { if (P.length < 3) return P; let md = 0, mi = 0; const a = P[0], b = P.at(-1); for (let i = 1; i < P.length - 1; i++) { const d = segD(P[i], a, b); if (d > md) { md = d; mi = i; } } return md > tol ? [...simplify(P.slice(0, mi + 1), tol).slice(0, -1), ...simplify(P.slice(mi), tol)] : [a, b]; };
  const out = []; for (const e of edges) { const S2 = simplify(e.pts, 0.3); let from = e.a, run = [S2[0]];
    for (let i = 1; i < S2.length - 1; i++) { run.push(S2[i]); const a1 = ang([S2[i][0] - S2[i - 1][0], S2[i][1] - S2[i - 1][1]]), a2 = ang([S2[i + 1][0] - S2[i][0], S2[i + 1][1] - S2[i][1]]), bend = Math.abs(deg(wrap(a2 - a1)));
      if (bend > turnDeg && dist(S2[i - 1], S2[i]) >= 2 && dist(S2[i], S2[i + 1]) >= 2) { const tn = { id: nodes.length, p: S2[i].slice(), hw: hw[cellOf(R, S2[i])] * R.c || 0.6, kind: 'turn', deg: 2, bend }; nodes.push(tn); out.push({ a: from, b: tn.id, pts: run.slice(), len: plen(run) }); from = tn.id; run = [S2[i]]; } }
    run.push(S2.at(-1)); out.push({ a: from, b: e.b, pts: run, len: plen(run) }); }
  for (const n of nodes) { const es = out.filter((e) => e.a === n.id || e.b === n.id); n.branches = es.map((e) => { const P = e.a === n.id ? e.pts : e.pts.slice().reverse(), q = along(P, Math.min(2.5, plen(P))); return { edge: e, dir: unit([q[0] - n.p[0], q[1] - n.p[1]]), len: e.len, to: e.a === n.id ? e.b : e.a }; }); n.deg = n.branches.length; }
  return { nodes, edges: out, skeleton: S, hw }; }
const segD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0; return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]); };
const plen = (P) => P.reduce((s, p, i) => (i ? s + dist(P[i - 1], p) : 0), 0);

/**
 * The analysis of one floor (and the floors its destinations are on).
 * @param building { levels: [{ id, name, z, h, sc }], stairs: [{ id, lv, top, corners, name }] } (the modeler's buildingScene())
 * @param o { level, starts: 'all' | [ids], dest: { mode: 'all'|'groups'|'rooms', groups, rooms, otherFloors }, access: {room: 'staff'|'public'},
 *            groups: {room: group}, accessible, minDoor, eye, furn, precise, manual: [{p, name}], signs: [{p, face (deg)}], weights, threshold }
 */
export function analyse(building, o = {}) {
  const t0 = Date.now(), lvs = building.levels.slice().sort((a, b) => a.z - b.z), L = lvs.find((l) => l.id === o.level) || lvs[0]; if (!L) throw new Error('No floors in the model.');
  const groundId = (lvs.filter((l) => l.z > -0.5).sort((a, b) => Math.abs(a.z) - Math.abs(b.z))[0] || lvs[0]).id;
  const prepOpts = { eye: o.eye, furn: o.furn, precise: o.precise, access: o.access, groups: o.groups, accessible: o.accessible, minDoor: o.minDoor };
  const cache = new Map(), floor = (lv) => { if (!cache.has(lv.id)) { const F = prepare(lv.sc, prepOpts); F.level = lv; F.starts = startsOf(F, { stairs: stairsOn(building, lv), ground: lv.id === groundId, manual: lv.id === L.id ? o.manual || [] : [] }); cache.set(lv.id, F); } return cache.get(lv.id); };
  const F = floor(L); if (!F.rooms.length) throw new Error('No rooms on this floor: draw the rooms first, or pick another floor.');
  const allStarts = F.starts, chosen = o.starts === 'all' || !o.starts ? allStarts.filter((s) => s.kind !== 'manual' || (o.manual || []).length) : allStarts.filter((s) => o.starts.includes(s.id));
  if (!chosen.length) return { level: L, starts: allStarts, chosen: [], routes: [], nodes: [], none: allStarts.length ? 'Choose a start.' : 'No lift, stair or entrance was recognised on this floor: set a start by hand (click the plan).', cell: F.c, ms: Date.now() - t0 };
  // destinations: rooms that are not circulation and have public access, chosen by group or by room
  const D0 = o.dest || { mode: 'all' }, pick = (r) => !r.circ && !r.staff && (D0.mode === 'all' || (D0.mode === 'groups' && (D0.groups || []).includes(r.group)) || (D0.mode === 'rooms' && (D0.rooms || []).includes(r.name)));
  const dests = F.rooms.filter(pick), groups = {}; for (const r of F.rooms.filter((x) => !x.circ && !x.staff)) (groups[r.group] ||= []).push(r);
  const free = FREE(F), freeAny = FREE_ANY(F), noBlockWalk = new Map();
  const routes = [], walks = new Map();
  for (const s of chosen) { const W = walk(F, nearestFree(F, s.p, free), free); walks.set(s.id, W);
    const diag = (r) => { if (!F.doors.some((d) => d.rooms.includes(r._i))) return 'no door into the room'; if (!noBlockWalk.has(s.id)) noBlockWalk.set(s.id, walk(F, nearestFree(F, s.p, freeAny), freeAny)); const W2 = noBlockWalk.get(s.id);
      for (let k = 0; k < F.roomAt.length; k++) if (F.roomAt[k] === r._i && Number.isFinite(W2.D[k])) return 'only through rooms with no public access' + (o.accessible ? ' or doors narrower than the minimum' : ''); return 'no walkable way from this start (walls, furniture or no connecting door)'; };
    for (const r of dests) routes.push(routeTo(F, W, r, s, diag)); }
  // destinations on other floors: by a lift or a stair paired between the floors (plan positions within 1.5 m); the walk here ends at it
  const legs = [];
  if (D0.otherFloors) for (const M of lvs) { if (M.id === L.id) continue; const G2 = floor(M), there = G2.rooms.filter((r) => !r.circ && !r.staff && (D0.mode === 'all' || (D0.mode === 'groups' && (D0.groups || []).includes(r.group)) || (D0.mode === 'rooms' && (D0.rooms || []).includes(r.name))));
    if (!there.length) continue; const links = F.starts.filter((a) => (a.kind === 'lift' || (a.kind === 'stair' && !o.accessible))).map((a) => ({ a, b: G2.starts.find((b) => b.kind === a.kind && (dist(b.link, a.link) < 1.5 || (a.sids || []).some((id) => (b.sids || []).includes(id)))) })).filter((x) => x.b);
    const levelsApart = Math.abs(lvs.indexOf(M) - lvs.indexOf(L)), vcost = (k) => (k === 'lift' ? 40 + 4 * levelsApart : 12 * levelsApart);   // a lift: about 30 s wait and ride, as 40 m of walking; a stair: 12 m a floor
    for (const r of there) for (const s of chosen) { const W = walks.get(s.id); let best = null;
      for (const { a, b } of links) { const k = nearestFree(F, a.p, free); if (k < 0 || !Number.isFinite(W.D[k])) continue; const W2 = walk(G2, nearestFree(G2, b.p, FREE(G2)), FREE(G2)), up = routeTo(G2, W2, r, b, () => 'unreachable on its floor'); if (up.noRoute) continue;
        const here = pathFrom(F, W, k, s), tot = here.len + vcost(a.kind) + up.len; if (!best || tot < best.tot) best = { tot, here, up, a, b }; }
      if (!best) { routes.push({ room: r, start: s, noRoute: true, reason: `no ${o.accessible ? 'lift' : 'lift or stair'} joins this floor to ${M.name} with a way to the room`, floor: M.name }); continue; }
      routes.push({ room: r, start: s, pts: best.here.pts, len: best.tot, marks: [best.here.pts.at(-1)], door: null, floor: M.name, via: best.a, viaKind: best.a.kind, upPts: best.up.pts }); legs.push({ room: r.name, floor: M.name, via: best.a.name, kind: best.a.kind }); } }
  // ---- the corridor network and its candidate points; lift lobby and stair exits from the starts themselves
  const net = corridorNet(F), cand = net.nodes.filter((n) => n.kind !== 'end').map((n) => ({ ...n }));
  for (const s of chosen) if (s.kind === 'lift' || s.kind === 'stair' || s.kind === 'entrance') { const near = cand.find((n) => dist(n.p, s.p) < Math.max(2.5, n.hw + 1)); if (near) { near.exitOf = s; continue; }
    cand.push({ id: 'x' + s.id, p: s.p.slice(), hw: 1, kind: s.kind + '-exit', exitOf: s, deg: 0, branches: [] }); }
  const ok = routes.filter((r) => !r.noRoute && r.pts && r.pts.length > 1), dn = new Map(ok.map((r) => [r, dense(r.pts)])), W8 = { ...DEFAULT_WEIGHTS, ...(o.weights || {}) };
  const signs = (o.signs || []).map((g, i) => ({ id: g.id || 'sign' + (i + 1), p: g.p, face: +g.face || 0, name: g.name || `Existing sign ${i + 1}` }));
  for (const n of cand) {
    const rad = Math.max(1.2, (n.hw || 0.6) + 0.4), passes = [];
    for (const r of ok) { const P = dn.get(r); let bi = -1, bd = Infinity; for (let i = 0; i < P.length; i++) { const d = dist(P[i].p, n.p); if (d < bd) { bd = d; bi = i; } } if (bd > rad) continue;
      const s = P[bi].s, before = along(r.pts, Math.max(0, s - 2)), after = along(r.pts, Math.min(P.at(-1).s, s + 2.5)); if (dist(after, P[bi].p) < 0.5) continue;   // the route ends here: not a choice made here
      const arr = unit([P[bi].p[0] - before[0], P[bi].p[1] - before[1]]), dep = unit([after[0] - n.p[0], after[1] - n.p[1]]);
      passes.push({ r, s, arr: s < 0.5 ? null : arr, dep, p5: along(r.pts, Math.max(0, s - 5)), t3: along(r.pts, Math.min(P.at(-1).s, s + 3)) }); }
    // the ways out: the corridor's branches, or, at a start with no junction, the directions the routes leave in
    let br = (n.branches || []).map((b) => ({ dir: b.dir, len: b.len, to: b.to }));
    if (!br.length) for (const q of passes) if (!br.some((b) => Math.abs(wrap(ang(b.dir) - ang(q.dep))) < 0.6)) br.push({ dir: q.dep, len: 20, to: null });
    for (const q of passes) { let bi = -1, bd = Infinity; br.forEach((b, i) => { const d = Math.abs(wrap(ang(b.dir) - ang(q.dep))); if (d < bd) { bd = d; bi = i; } }); q.taken = bd < 1.2 ? bi : -1;
      let ai = -1, ad = Infinity; if (q.arr) br.forEach((b, i) => { const d = Math.abs(wrap(ang(b.dir) - ang([-q.arr[0], -q.arr[1]]))); if (d < ad) { ad = d; ai = i; } }); q.from = ad < 1.2 ? ai : -1; }
    n.passes = passes; n.br = br;
    const branches = Math.max(br.length, 1), close = br.some((b, i) => br.some((c2, j) => j > i && Math.abs(wrap(ang(b.dir) - ang(c2.dir))) < Math.PI / 4));
    const A = n.kind === 'turn' ? 0.33 : Math.min(1, (branches - 1) / 3 + (close ? 0.2 : 0));
    const wsum = passes.length;   // every destination weighs 1
    const hiddenP = passes.filter((q) => !(F.sight(q.p5, q.t3) || q.r.marks.some((m) => F.sight(q.p5, m)))), notSeen = hiddenP.length, C = wsum ? notSeen / wsum : 0, hidden = [...new Set(hiddenP.map((q) => q.r.room.name))];
    const byBr = new Map(); for (const q of passes) { if (q.taken < 0) continue; if (!byBr.has(q.taken)) byBr.set(q.taken, new Set()); byBr.get(q.taken).add(q.r.room.name); }
    const tot = [...byBr.values()].reduce((a, s) => a + s.size, 0), maxShare = tot ? Math.max(...[...byBr.values()].map((s) => s.size)) / tot : 1;
    const grpBy = [...byBr.values()].map((s) => new Set([...s].map((nm) => (F.rooms.find((r) => r.name === nm) || {}).group))), sameGroup = grpBy.some((g, i) => grpBy.some((h, j) => j > i && [...g].some((x) => h.has(x))));
    const D = Math.min(1, (byBr.size >= 2 ? 1 - maxShare : 0) + (sameGroup ? 0.25 : 0));
    let wrongSum = 0, wrongN = 0; for (const q of passes) br.forEach((b, i) => { if (i === q.taken || i === q.from) return; wrongSum += 2 * Math.min(b.len, 40); wrongN++; }); const wrongAvg = wrongN ? wrongSum / wrongN : 0, Fw = Math.min(1, wrongAvg / 40);
    // existing signs: in reach (8 m), in sight from the approach, facing the people arriving (within 60°)
    const ap = mainApproach(passes, true), apPt = ap ? ap.p : null; n.approach = ap;
    // seen on the approach: from any spot of the last 5 m before the point (metre by metre) on the main approach's route that still has the sign
    // at least 0.5 m ahead, with the sign facing that spot within 60°
    const cover = signs.filter((g) => dist(g.p, n.p) <= 8 && ap && ap.view.some((v) => (g.p[0] - v[0]) * ap.v[0] + (g.p[1] - v[1]) * ap.v[1] > 0.5 && F.sight(v, g.p) && Math.abs(wrap(g.face * Math.PI / 180 - ang([v[0] - g.p[0], v[1] - g.p[1]]))) <= Math.PI / 3));
    const E = cover.length ? 1 : 0;
    n.f = { A, B: wsum, C, D, F: Fw, E }; n.meta = { branches, close, notSeen, hidden, wsum, byBr: [...byBr.entries()].map(([i, s]) => [i, [...s]]), sameGroup, wrongAvg, cover: cover.map((g) => g.name) };
  }
  const maxB = Math.max(1, ...cand.map((n) => n.f.B)); const wTot = W8.A + W8.B + W8.C + W8.D + W8.F || 1, thr = o.threshold ?? 35;
  for (const n of cand) { n.f.B = n.f.B / maxB; const raw = (W8.A * n.f.A + W8.B * n.f.B + W8.C * n.f.C + W8.D * n.f.D + W8.F * n.f.F) / wTot; n.score = Math.round(100 * raw * (1 - n.f.E)); n.cls = classOf(n.score)[1]; n.col = classOf(n.score)[2];
    n.onRoute = n.passes.length > 0; n.recommended = n.onRoute && n.score >= thr && !n.f.E; n.unresolved = n.cls === 'High' && n.f.C > 0.5;
    describe(n, F, W8, wTot, groups); }
  const nodes = cand.filter((n) => n.onRoute).sort((a, b) => b.score - a.score); nodes.forEach((n, i) => { n.no = i + 1; });
  const events = nodes.filter((n) => n.br.length >= 3 || n.exitOf).reduce((a, n) => a + n.passes.length, 0), covered = nodes.filter((n) => (n.br.length >= 3 || n.exitOf) && (n.recommended || n.f.E)).reduce((a, n) => a + n.passes.length, 0);
  // the entrance of each destination: from how far back along the route its door is in sight, a sign beside it read square-on, similar doors near it
  const entrances = ok.filter((r) => r.door).map((r) => entranceOf(F, r, groups));
  const stats = { points: nodes.length, high: nodes.filter((n) => n.cls === 'High').length, medium: nodes.filter((n) => n.cls === 'Medium').length, low: nodes.filter((n) => n.cls === 'Low').length, recommended: nodes.filter((n) => n.recommended).length,
    unresolved: nodes.filter((n) => n.unresolved).length, noRoute: routes.filter((r) => r.noRoute).length, routes: ok.length, coverage: events ? covered / events : 1 };
  return { level: L, ground: L.id === groundId, starts: allStarts, chosen, routes, legs, groups: Object.fromEntries(Object.entries(groups).map(([g, rs]) => [g, { label: groupLabel(g, rs), rooms: rs.map((r) => r.name) }])),
    net: { edges: net.edges.map((e) => ({ a: e.a, b: e.b, pts: e.pts, len: e.len })) }, nodes, entrances, signs, stats, weights: W8, threshold: thr, cell: F.c, eye: F.eye, F, ms: Date.now() - t0 }; }

// the direction most routes arrive from (unit vector), or null when they all start here
function mainApproach(passes, withPoint) { const A = passes.filter((q) => q.arr); if (!A.length) return null; const bins = [];
  for (const q of A) { const b = bins.find((x) => Math.abs(wrap(ang(x.v) - ang(q.arr))) < 0.5); if (b) { b.qs.push(q); b.sum = [b.sum[0] + q.arr[0], b.sum[1] + q.arr[1]]; b.v = unit(b.sum); } else bins.push({ v: q.arr, sum: q.arr.slice(), qs: [q] }); }
  const b = bins.sort((x, y) => y.qs.length - x.qs.length)[0]; if (!withPoint) return b.v;
  // where those people are 5 m before the point: on a real route of the bin (the one closest to its mean direction), not an extrapolation that can land in a wall
  const q = b.qs.slice().sort((x, y) => Math.abs(wrap(ang(x.arr) - ang(b.v))) - Math.abs(wrap(ang(y.arr) - ang(b.v))))[0]; return { v: b.v, p: q.p5, view: [5, 4, 3, 2, 1].map((d) => along(q.r.pts, Math.max(0, q.s - d))) }; }
// the walk from a start to a cell (for the leg to a lift or stair)
function pathFrom(F, W, k, s) { const R = F.R, cells = []; for (let q = k; q >= 0; q = W.prev[q]) cells.push(centre(R, q)); cells.reverse(); cells[0] = s.p.slice();
  const wl = (p, q) => los(R, p, q, F_WALL | F_FURN | F_OUT | F_BLOCK), pts = [cells[0]]; let i = 0; while (i < cells.length - 1) { let j = Math.min(cells.length - 1, i + 400); while (j > i + 1 && !wl(cells[i], cells[j])) j--; pts.push(cells[j]); i = j; }
  return { pts, len: W.D[k] }; }

const REL = (t) => { const d = deg(t); return Math.abs(d) <= 35 ? 'Ahead' : d > 35 && d <= 145 ? 'Left' : d < -35 && d >= -145 ? 'Right' : 'Back'; };
// the sign a point calls for, which way it faces, what each way leads to, and why (the largest factors, in words)
function describe(n, F, W8, wTot, groups) {
  const appr = mainApproach(n.passes), m = n.meta;
  n.signType = n.kind === 'lift-exit' || (n.exitOf && n.exitOf.kind === 'lift') ? 'Elevator lobby directory' : n.kind === 'entrance-exit' || (n.exitOf && n.exitOf.kind === 'entrance') ? 'Directory' : 'Directional';
  const also = []; for (const [, rooms] of m.byBr) { const gs = new Set(rooms.map((nm) => (F.rooms.find((r) => r.name === nm) || {}).group)); if (gs.size === 1) { const g = [...gs][0]; if ((groups[g] || []).length >= 3 && m.byBr.length >= 2) also.push(`Identification at the ${groupLabel(g, groups[g])} entrance`); } }
  const longRun = n.br.find((b, i) => b.len > 25 && m.byBr.some(([j]) => j === i)); if (longRun) also.push(`Confirmation along the ${Math.round(longRun.len)} m corridor beyond`);
  n.also = also;
  // facing: square to the main approach (the sign's face looks back at the people arriving); a start with no approach faces the way out most take
  const face = appr ? [-appr[0], -appr[1]] : n.passes.length ? [-n.passes[0].dep[0], -n.passes[0].dep[1]] : [0, 1], north = (F.SC.settings && F.SC.settings.north) || 0;
  n.faceDeg = Math.round(((deg(ang(face)) % 360) + 360) % 360); const comp = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'][Math.round((((deg(ang([-face[0], -face[1]])) + north) % 360 + 360) % 360) / 45) % 8];
  n.facing = appr ? `faces people arriving from the ${['west', 'south-west', 'south', 'south-east', 'east', 'north-east', 'north', 'north-west'][Math.round((((deg(ang(appr)) + north) % 360 + 360) % 360) / 45) % 8]}` : `faces the people leaving the ${n.exitOf ? n.exitOf.kind === 'lift' ? 'lift' : n.exitOf.kind : 'start'} (towards the ${comp})`;
  // the ways, relative to the walker facing the sign's approach direction
  const head = appr || (n.passes[0] && n.passes[0].dep) || [1, 0];
  n.ways = n.br.map((b, i) => { const rooms = (m.byBr.find(([j]) => j === i) || [, []])[1], gs = {}; for (const nm of rooms) { const g = (F.rooms.find((r) => r.name === nm) || {}).group || nm; (gs[g] ||= []).push(nm); }
      return { dir: b.dir, rel: REL(wrap(ang(b.dir) - ang(head))), angle: Math.round(deg(wrap(ang(b.dir) - ang(head)))), to: Object.entries(gs).map(([g, list]) => (list.length >= 2 || (groups[g] || []).length > 1 ? groupLabel(g, (groups[g] || []).filter((r) => list.includes(r.name))) : list[0])) }; })
    .filter((w) => w.to.length);
  const parts = [['A', W8.A * n.f.A, `${m.branches} way${m.branches === 1 ? '' : 's'} to choose${m.close ? ', two of them close in angle' : ''}${n.kind === 'turn' ? ` (a ${Math.round(n.bend || 0)}° turn)` : ''}`],
    ['B', W8.B * n.f.B, `${m.wsum} route${m.wsum === 1 ? '' : 's'} pass here`], ['C', W8.C * n.f.C, `the way on is out of sight 5 m before here for ${m.notSeen} of ${m.wsum} (${m.hidden.slice(0, 3).join(', ')}${m.hidden.length > 3 ? ` and ${m.hidden.length - 3} more` : ''})`],
    ['D', W8.D * n.f.D, `destinations split ${m.byBr.length} ways${m.sameGroup ? ', with rooms of one kind down different ways' : ''}`], ['F', W8.F * n.f.F, `a wrong turn costs about ${Math.round(m.wrongAvg)} m extra`]];
  n.reason = n.f.E ? `Covered by ${m.cover.join(', ')} (in sight and facing the approach): no new sign needed.` : parts.filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[2]).join('; ') + '.';
  if (!n.f.E && n.score < 35) n.reason = (n.f.A < 0.4 ? 'one clear way on' : n.f.C < 0.3 ? 'the way on is in sight' : 'few routes pass') + '; ' + n.reason;
  n.factors = Object.fromEntries(Object.entries(n.f).map(([k, v]) => [k, +v.toFixed(3)])); }

// ---- the entrance of a destination (Room Entrance View): approach visibility, a sign beside the door read square-on, similar doors near
export function entranceOf(F, r, groups) { const d = r.door, P = r.pts, total = plen(P); let seenFrom = 0;
  for (let s = 0; s <= Math.min(total, 40); s += 0.5) { const q = along(P, total - s); if (r.marks.some((m) => F.sight(q, m))) seenFrom = s; else if (s > 2) break; }
  // a flush sign beside the door at eye height, on the corridor side: read when the viewer is within 30° of square-on, 2–10 m away
  const side = r.door.rooms[0] === r.room._i ? -1 : 1, u = unit([d.o.b[0] - d.o.a[0], d.o.b[1] - d.o.a[1]]), spot = [d.o.b[0] + u[0] * 0.3 + d.n[0] * 0.1 * side, d.o.b[1] + u[1] * 0.3 + d.n[1] * 0.1 * side], nrm = [d.n[0] * side, d.n[1] * side];
  let flushFrom = 0; for (let s = 2; s <= Math.min(total, 10); s += 0.5) { const q = along(P, total - s), v = unit([q[0] - spot[0], q[1] - spot[1]]); if (F.sight(q, spot) && Math.acos(Math.max(-1, Math.min(1, v[0] * nrm[0] + v[1] * nrm[1]))) <= Math.PI / 6) flushFrom = s; }
  const similar = F.doors.filter((x) => x !== d && x.rooms.some((ri) => ri >= 0 && F.rooms[ri].group === r.room.group && ri !== r.room._i) && dist(x.m, d.m) <= 8).length;
  const cam = along(P, Math.max(0, total - 4));
  return { room: r.room.name, group: r.room.group, door: d.m, seenFrom: +seenFrom.toFixed(1), flushFrom: +flushFrom.toFixed(1), similar, cam, look: d.m, out: [d.m[0] + nrm[0] * 3, d.m[1] + nrm[1] * 3], spot,
    verdict: seenFrom < 3 ? 'hard to spot: the door comes into sight only at the last moment' : similar >= 2 ? `easy to see, but ${similar} similar doors within 8 m: number or name it clearly` : flushFrom ? 'easy to see and a sign beside it can be read on the approach' : 'easy to see; a sign flat on the wall is read only close to: a projecting sign helps' }; }

// ================= Phase 3 (2026-11-19): proposed signs, their layouts A/B/C, and how well they work =================
// A proposed sign stands at a decision point: on the wall ahead of the people arriving when one is within 6 m (read square-on as
// they walk up), otherwise hung over the corridor at the point. It faces the main approach and lists, for each way on, the
// destinations down it with the arrow the walker sees (from the walker's own direction, never the screen's).
// Its visibility, for each route through its point: seen from at least 2 of the 8 one-metre spots before the point (in sight,
// within 15 m, ahead of the walker and within 60° of square-on). A decision is guided when a sign there is seen by that route and
// lists the way the route takes. Every figure below is a count of these.
const VIS_MAX = 15, VIS_ANG = Math.PI / 3, AHEAD = 8;
const S_WALLS = 1;   // the sight raster's wall flag (S_OPQ)
function wallAhead(F, p, v, max = 6) { const R = F.SR; for (let t = 0.3; t <= max; t += R.c / 2) { const q = [p[0] + v[0] * t, p[1] + v[1] * t], k = cellOf(R, q); if (k < 0) return null; if (R.a[k] & S_WALLS) return Math.max(0.2, t - 0.15); } return null; }
const relOf = (t) => REL(t);
/** the sign proposed for a decision point */
// the directions people arrive at a point from, largest first (each with its share of the routes)
export function approaches(n) { const bins = []; for (const q of n.passes.filter((x) => x.arr)) { const b = bins.find((x) => Math.abs(wrap(ang(x.v) - ang(q.arr))) < 0.5); if (b) { b.n++; b.sum = [b.sum[0] + q.arr[0], b.sum[1] + q.arr[1]]; b.v = unit(b.sum); } else bins.push({ v: q.arr, sum: q.arr.slice(), n: 1 }); }
  return bins.sort((a, b) => b.n - a.n).map((b) => ({ v: b.v, share: b.n / n.passes.length })); }
export function signAt(A, n, alt = null) { const F = A.F, starters = n.passes.filter((q) => !q.arr), ap = alt ? { v: alt } : n.exitOf && starters.length ? null : n.approach, dep = mainApproach((starters.length ? starters : n.passes).map((q) => ({ arr: q.dep })), false), head = ap ? ap.v : dep || [Math.cos(n.faceDeg * Math.PI / 180 + Math.PI), Math.sin(n.faceDeg * Math.PI / 180 + Math.PI)];
  // arriving people read it on the wall ahead; people leaving a lift or a stair, on the wall in front of them or hung 2 m out
  const t = wallAhead(F, n.p, head), p = t ? [n.p[0] + head[0] * t, n.p[1] + head[1] * t] : ap ? n.p.slice() : [n.p[0] + head[0] * 2, n.p[1] + head[1] * 2];
  const ways = alt ? n.ways.map((w) => { const a = wrap(ang(w.dir) - ang(alt)); return { ...w, rel: REL(a), angle: Math.round(deg(a)) }; }) : n.ways;
  return { id: 'S' + n.no + (alt ? 'b' : ''), node: n.no, p: p.map((x) => +x.toFixed(3)), face: Math.round(((deg(ang([-head[0], -head[1]])) % 360) + 360) % 360), mount: t ? 'wall' : 'hung', sides: t ? 1 : 2, type: n.signType,
    ways: ways.map((w) => ({ arrow: w.rel, angle: w.angle, to: w.to.slice() })),
    // a hung sign is read from both sides: the back face's arrows are those of a walker coming the other way
    waysB: t ? null : ways.map((w) => { const a = wrap(w.angle * Math.PI / 180 + Math.PI); return { arrow: REL(a), angle: Math.round(deg(a)), to: w.to.slice() }; }), score: n.score, cls: n.cls, z: t ? 1.7 : 2.3 }; }
// can the walker of pass q see sign g before the decision point? (the count of one-metre spots that see it)
function seenBy(F, n, q, g) { const f = g.face * Math.PI / 180, fv = [Math.cos(f), Math.sin(f)], walkDir = q.arr || q.dep; let k = 0;
  // the spots: the last 8 m before the point; for people starting here (out of a lift or a stair), their first 2 m, looking round as they come out
  const spots = q.arr ? [...Array(AHEAD)].map((_, i) => along(q.r.pts, Math.max(0, q.s - (i + 1)))) : [0, 0.5, 1, 1.5, 2].map((d) => along(q.r.pts, Math.min(q.s + d, plen(q.r.pts))));
  for (const v of spots) { const d = dist(v, g.p); if (d > VIS_MAX || d < 0.3) continue; const tv = unit([v[0] - g.p[0], v[1] - g.p[1]]), c = tv[0] * fv[0] + tv[1] * fv[1];
    if (Math.acos(Math.max(-1, Math.min(1, (g.sides === 2 ? Math.abs(c) : c)))) > VIS_ANG) continue; if (q.arr && (g.p[0] - v[0]) * walkDir[0] + (g.p[1] - v[1]) * walkDir[1] < 0) continue;   /* arriving: ahead of them; starting here: they look round before choosing */ if (F.sight(v, g.p)) k++; }
  return q.arr ? k : Math.round(k * AHEAD / 5); }
// a room's identification sign: seen from the last 8 m of the walk to its door
function seenAtDoor(F, r, g) { const L = plen(r.pts), f = g.face * Math.PI / 180, fv = [Math.cos(f), Math.sin(f)]; let k = 0;
  for (let i = 1; i <= AHEAD; i++) { const v = along(r.pts, Math.max(0, L - i)), d = dist(v, g.p); if (d > VIS_MAX || d < 0.3) continue; const tv = unit([v[0] - g.p[0], v[1] - g.p[1]]); if (Math.acos(Math.max(-1, Math.min(1, tv[0] * fv[0] + tv[1] * fv[1]))) > Math.PI / 2.4) continue; if (F.sight(v, g.p)) k++; }
  return k; }
const lists = (g, n, q) => { if (q.taken < 0) return false; const w = n.br[q.taken], want = (n.ways.find((x) => Math.abs(wrap(ang(x.dir) - ang(w.dir))) < 0.3) || {}).to || [];
  return want.length > 0 && g.ways.some((x) => x.to.some((t) => want.includes(t))); };
/** how a set of signs works on the analysed routes: per sign (visibility, the points it guides) and in total */
export function evaluate(A, signs) { const F = A.F, thr = A.threshold, byNode = new Map(A.nodes.map((n) => [n.no, n])), decide = A.nodes.filter((n) => n.br.length >= 3 || n.exitOf || n.score >= thr);
  const ok = A.routes.filter((r) => !r.noRoute && r.pts && r.door);
  const out = signs.map((g) => { if (g.room) { const rs = ok.filter((r) => r.room.name === g.room), seen = rs.map((r) => seenAtDoor(F, r, g) >= 2), vis = seen.length ? seen.filter(Boolean).length / seen.length : 0;
      return { ...g, at: null, vis: +vis.toFixed(3), issue: !rs.length ? 'no route reaches this room' : vis < 0.5 ? `Visibility issue: seen on the way to the door by ${seen.filter(Boolean).length} of ${seen.length} routes` : null }; }
    const n = g.node != null ? byNode.get(g.node) : A.nodes.slice().sort((a, b) => dist(a.p, g.p) - dist(b.p, g.p))[0]; const at = n && dist(n.p, g.p) <= 8 ? n : null;
    const seen = at ? at.passes.map((q) => seenBy(F, at, q, g) >= 2) : [], vis = seen.length ? seen.filter(Boolean).length / seen.length : 0;
    return { ...g, at: at ? at.no : null, vis: +vis.toFixed(3), issue: !at ? 'not at a decision point' : vis < 0.5 ? `Visibility issue: seen before the point by ${seen.filter(Boolean).length} of ${seen.length} routes` : null }; });
  let events = 0, guided = 0; const routeOK = new Map(), unresolved = [], highs = A.nodes.filter((n) => n.cls === 'High'); let highCov = 0;
  for (const n of decide) { const here = out.filter((g) => g.at === n.no); let nodeGuided = 0;
    n.passes.forEach((q, i) => { events++; const ok = here.some((g) => seenBy(F, n, q, g) >= 2 && lists(g, n, q)) || !!n.f.E; if (ok) { guided++; nodeGuided++; } if (!routeOK.has(q.r)) routeOK.set(q.r, true); if (!ok) routeOK.set(q.r, false); });
    const okNode = n.passes.length ? nodeGuided / n.passes.length >= 0.5 : true; if (n.cls === 'High' && okNode) highCov++; if (n.score >= thr && !okNode) unresolved.push(n.no); }
  for (const n of highs) if (!decide.includes(n)) highCov++;
  const dup = []; out.forEach((g, i) => out.forEach((h, j) => { if (j <= i || dist(g.p, h.p) > 6) return; const a = new Set(g.ways.flatMap((w) => w.to)), b = h.ways.flatMap((w) => w.to); if (b.length && b.every((x) => a.has(x))) dup.push([g.id, h.id]); }));
  const routes = A.routes.filter((r) => !r.noRoute && r.pts), routesOK = routes.filter((r) => routeOK.get(r) !== false).length;
  return { signs: out, total: out.length, byType: out.reduce((m, g) => ((m[g.type] = (m[g.type] || 0) + 1), m), {}), events, guided, clarity: events ? guided / events : 1,
    routeCoverage: routes.length ? routesOK / routes.length : 1, routesOK, routes: routes.length, high: highs.length, highCovered: highCov, unresolved, avgVis: out.length ? out.reduce((s, g) => s + g.vis, 0) / out.length : 0,
    issues: out.filter((g) => g.issue).map((g) => ({ id: g.id, issue: g.issue })), duplicates: dup }; }
export const OPTIONS = [['A', 'Minimum signs'], ['B', 'Balanced'], ['C', 'Maximum coverage']];
/** the three layouts, measured against what every candidate sign together achieves (the most this floor's points can guide):
 *  A Minimum: the fewest signs, highest priority first, that guide `target` (default 80 %) of that; B Balanced: every point at or above
 *  the threshold, leaving out a sign within 6 m of one saying the same, then more until 95 % of it; C Maximum: every candidate sign, a
 *  second sign where a wall sign's point has a second approach with a fifth or more of its routes, and
 *  an identification sign at each destination entrance that is hard to spot or among similar doors */
export function layouts(A, o = {}) { const target = o.target ?? 0.8, cand = A.nodes.filter((n) => n.onRoute && !n.f.E).map((n) => ({ n, g: signAt(A, n) })).sort((a, b) => b.n.score - a.n.score), best = evaluate(A, cand.map((c) => c.g)).clarity;
  const grow = (picked, goal) => { const left = cand.filter((c) => !picked.includes(c)); let ev = evaluate(A, picked.map((c) => c.g)); while (ev.clarity < goal - 1e-9 && left.length) { picked.push(left.shift()); ev = evaluate(A, picked.map((c) => c.g)); } return picked; };
  const a = grow([], target * best);
  const b = []; for (const c of cand.filter((x) => x.n.score >= A.threshold)) if (!b.some((d) => dist(d.g.p, c.g.p) <= 6 && c.g.ways.flatMap((w) => w.to).every((t) => d.g.ways.some((w) => w.to.includes(t))))) b.push(c); grow(b, 0.95 * best);
  const ids = A.entrances.filter((e, i, L) => (e.seenFrom < 3 || e.similar >= 2) && L.findIndex((x) => x.room === e.room) === i).map((e, i) => ({ id: 'I' + (i + 1), node: null, p: e.spot.map((x) => +x.toFixed(3)), face: Math.round(((deg(ang([e.out[0] - e.door[0], e.out[1] - e.door[1]])) % 360) + 360) % 360), mount: 'wall', sides: 1, type: 'Identification', ways: [{ arrow: 'Here', angle: 0, to: [e.room] }], score: 0, cls: 'Low', z: 1.6, room: e.room }));
  const order = (L) => cand.filter((c) => L.includes(c)).map((c) => c.g);
  const second = cand.flatMap((c) => { const bins = approaches(c.n), b2 = bins[1]; if (!b2 || b2.share < 0.2 || c.g.mount === 'hung') return []; const g2 = signAt(A, c.n, b2.v); return dist(g2.p, c.g.p) > 0.5 ? [g2] : []; });   // a wall sign faces one approach: the next largest gets its own   // by priority, so the sign numbers read the same in every option
  return OPTIONS.map(([k, name]) => { const signs = k === 'A' ? order(a) : k === 'B' ? order(b) : [...cand.map((x) => x.g), ...second, ...ids]; return { key: k, name, signs, ev: evaluate(A, signs), best, goal: k === 'A' ? target * best : k === 'B' ? 0.95 * best : best }; }); }
/** Before and After, by the same counts as the layouts: without the proposal (the existing signs only, as in the model) and with it */
export function beforeAfter(building, opts, proposed) { const A = analyse(building, opts), evB = evaluate(A, []), evA = evaluate(A, proposed);
  const row = (ev) => ({ recommended: ev.unresolved.length, high: ev.high - ev.highCovered, clarity: ev.clarity, routeCoverage: ev.routeCoverage, guided: ev.guided, events: ev.events });
  return { before: row(evB), after: row(evA), still: evA.unresolved, issues: evA.issues, duplicates: evA.duplicates }; }
