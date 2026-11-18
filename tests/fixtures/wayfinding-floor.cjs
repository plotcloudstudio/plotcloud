// A test floor for the Wayfinding signage tests (2026-11-18), in the plan-scene shape the modeler gives (planScene(…, 'wayfinding')).
// An east–west corridor (y 10–12, x 2–62) crossed by a north–south corridor at x 30–32 (a crossing) and joined by a north arm at
// x 50–52 (a T). A lift at the west end (Bed elevators, its door onto the corridor), a stair room at the east end. South of the
// corridor six patient rooms (301–306); north of it Imaging and Rehabilitation; up the crossing's north arm Reception; down its south
// arm a clean utility (no public access) and Records behind it (reachable only through the utility); up the T arm two more patient
// rooms (310, 311). Walls round every room but the corridor; doors where stated; outside is not walkable.
const room = (name, x, y, w, d) => ({ name, label: [x + w / 2, y + d / 2], rects: [[x, y, w, d]] });
module.exports = function floor(o = {}) {
  const rooms = [], walls = [], open = [], door = (a, b, ext) => open.push({ id: 'd' + open.length, a, b, kind: 'door', w: Math.hypot(b[0] - a[0], b[1] - a[1]), ext: !!ext, sill: 0, head: 2.1 });
  const box = (r) => { const [x, y, w, d] = r.rects[0]; walls.push({ a: [x, y], b: [x + w, y], t: 0.15, h: 3 }, { a: [x + w, y], b: [x + w, y + d], t: 0.15, h: 3 }, { a: [x + w, y + d], b: [x, y + d], t: 0.15, h: 3 }, { a: [x, y + d], b: [x, y], t: 0.15, h: 3 }); };
  rooms.push({ name: 'Corridor', label: [16, 11], rects: [[2, 10, 60, 2], [30, 2, 2, 8], [30, 12, 2, 10], [50, 12, 2, 10]] });
  const add = (r) => { rooms.push(r); box(r); return r; };
  add(room(o.liftName || 'Bed elevators', 0, 10, 2, 2)); door([2, 10.2], [2, 11.8]);
  add(room('Stair East', 62, 10, 3, 2)); door([62, 10.2], [62, 11.8]);
  for (let i = 0; i < 6; i++) { const x = 4 + 4 * i; add(room('Patient room ' + (301 + i), x, 4, 4, 6)); door([x + 1, 10], [x + 2, 10]); }
  add(room('Imaging', 4, 12, 12, 6)); door([8, 12], [9.5, 12]);
  add(room('Rehabilitation', 16, 12, 12, 6)); door([20, 12], [21.5, 12]);
  add(room('Reception', 32, 14, 8, 6)); door([32, 16], [32, 17]);
  add(room('Clean utility', 32, 4, 6, 6)); door([32, 6], [32, 7]);
  add(room('Records', 38, 4, 6, 6)); door([38, 6], [38, 7]);
  add(room('Patient room 310', 52, 14, 4, 6)); door([52, 16], [52, 17]);
  add(room('Patient room 311', 46, 14, 4, 6)); door([50, 16], [50, 17]);
  if (o.extraWall) walls.push(o.extraWall);
  return { app: 'plotcloud-studio', v: 2, name: 'Test · ' + (o.name || 'L1'), bounds: { w: 70, h: 30 }, walls, open, rooms, furn: o.furn || [], origin: [0, 0], settings: { floorZ: 0, ceil: 3, north: 0 }, tool: 'wayfinding' };
};
