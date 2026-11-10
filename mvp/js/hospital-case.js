// Example: a hospital inpatient building (2026-11-10), for demonstrating every study (Fire Evacuation above all). A generic
// three-storey building, not a real hospital; planned after common Canadian practice for acute inpatient units (CSA Z8000
// planning, NBC care occupancies). These are the example's design assumptions, to check against a project's own brief and code:
// · a racetrack floor plate, 61.2 × 27.4 m, 4.5 m floor to floor: patient rooms on both long sides, support in the core between
//   two corridors of 2.44 m clear (bed and equipment movement)
// · every floor in two smoke compartments: a smoke barrier across both corridors and the core at mid-length, double smoke doors
//   held open on magnetic releases (progressive horizontal evacuation, the first stage in care occupancies)
// · two exit stairs at the ends of the core (1.65 m flights, OBC Table 3.4.3.2.-B for stairs serving patients' sleeping rooms), entered from both corridors at their ends (no dead-end corridor, OBC 3.3.3.3.(1)), opening to outside at grade; two bed
//   elevators at mid-plate (not used to evacuate in this model)
// · 26 single patient rooms per inpatient floor, same-handed: an inboard barrier-free ensuite with a curbless shower, a dedicated
//   hand-hygiene sink at the entry, the bed on a side headwall with a view to the window, a patient chair and a family sleeper
//   sofa by the window; 4.2 × 7.2 m bays (about 23 m² of room and a 5.3 m² ensuite); 1.2 m clear doors; a bariatric room (1.5 m door, larger ensuite) and an airborne infection isolation
//   room (AIIR) with its anteroom in the west compartment, a palliative/family room in the east; windows 2.4 m wide, sill 0.75 m
// · each compartment its own nurse station; medication, clean supply, soiled utility, equipment, nourishment, housekeeping,
//   staff washroom and lounge, family lounge and consult
// · finishes: suspended mineral-fibre ceilings, resilient sheet flooring, painted gypsum partitions (Indoor acoustics, Daylight)
// · ground floor: main entrance, registration and waiting, café, outpatient pharmacy, multifaith space, an ambulatory clinic,
//   diagnostic imaging, specimen collection, staff lockers, shipping and receiving
export const title = 'Example hospital · inpatient building';
export const site = { label: 'Example hospital site (generic location)', lat: 49.2448, lon: -123.0071, north: 0, tz: 'America/Vancouver', wind: 3.5, windDir: 'E' };
export const CASE_ID = 'example-hospital-inpatient-v5';
const r3 = (n) => +n.toFixed(3);
export function hospitalModel() {
  const L = 61.2, D = 27.4, HF = 4.5, X0 = -L / 2, Y0 = -D / 2, P = (x, y) => [r3(X0 + x), r3(Y0 + y)];
  const yS1 = 7.2, yS2 = 9.84, yN1 = 17.56, yN2 = 20.2, XM = 30.6, STW = 9;   // corridor walls (centre lines), the smoke barrier, the stair cores' length
  // finishes (for Indoor acoustics and Daylight): suspended mineral-fibre ceilings, resilient sheet flooring, painted gypsum partitions
  const FIN = { ceilMat: 'tileceiling', floorMat: 'vinyl', ceilH: 2.9 };   // and a 2.9 m suspended ceiling below the 4.5 m floor to floor
  const levels = [{ id: 'L1', name: 'Level 1 · Entrance and clinics', z: 0, h: HF, ...FIN }, { id: 'L2', name: 'Level 2 · Inpatient unit 2', z: HF, h: HF, ...FIN }, { id: 'L3', name: 'Level 3 · Inpatient unit 3', z: 2 * HF, h: HF, ...FIN }, { id: 'RF', name: 'Roof', z: 3 * HF, h: 1 }];
  const walls = [], ops = [], floors = [], names = [], furn = [];
  const wall = (lv, a, b, t = 0.15, layer = 'Walls') => { const id = `w${walls.length + 1}`; walls.push({ id, lv, a: P(...a), b: P(...b), t, h: HF, object_type: 'wall', layer, mat: 'gypsum' }); return id; };
  const door = (w, pos, wd) => ops.push({ id: `o${ops.length + 1}`, wall: w, pos: r3(pos), w: wd, kind: 'door', object_type: 'door', sill: 0, head: 2.4, open: 1 });
  const win = (w, pos, wd) => ops.push({ id: `o${ops.length + 1}`, wall: w, pos: r3(pos), w: wd, kind: 'win', object_type: 'window', sill: 0.75, head: 2.75, open: 0.15 });
  const name = (lv, x, y, n) => { const q = P(x, y); names.push({ lv, x: q[0], y: q[1], name: n }); };
  const item = (lv, x, y, w, d, h, label, type = 'box') => { const q = P(x, y); furn.push({ id: `u${furn.length + 1}`, lv, type, name: label, label, x: q[0], y: q[1], w, d, h, rot: 0, object_type: 'furniture', layer: 'Furniture' }); };
  const wallAt = (lv, a, b) => { const A = P(...a), B2 = P(...b); return walls.find((w) => w.lv === lv && Math.hypot(w.a[0] - A[0], w.a[1] - A[1]) < 1e-6 && Math.hypot(w.b[0] - B2[0], w.b[1] - B2[1]) < 1e-6).id; };
  // a patient room, same-handed: x0..x0+w along the band; side 'S' (window at y 0, corridor at yS1) or 'N' (window at D, corridor at yN2)
  function patientRoom(lv, side, x0, w, label, o = {}) {
    const S = side === 'S', yc = S ? yS1 : yN2, yw = S ? 0 : D, sg = S ? 1 : -1, Y = (d) => yw + sg * d, depth = Math.abs(yc - yw), ew = o.ensW || 2.2, ed = 2.4;   // d: metres in from the window
    wall(lv, [x0 + ew, Y(depth - ed)], [x0 + ew, yc]); const e2 = wall(lv, [x0, Y(depth - ed)], [x0 + ew, Y(depth - ed)]); door(e2, ew / 2 + 0.25, 1.0);   // the ensuite, inboard
    name(lv, x0 + ew / 2, Y(depth - ed / 2), 'Ensuite ' + (label.match(/\d+/) || [''])[0]); name(lv, x0 + w / 2 + 0.4, Y(2.2), label);
    item(lv, x0 + 0.45, Y(depth - 0.4), 0.7, 0.45, 0.45, 'Toilet'); item(lv, x0 + ew - 0.55, Y(depth - 0.95), 0.9, 1.1, 0.02, 'Curbless shower'); item(lv, x0 + 0.4, Y(depth - ed + 0.6), 0.5, 0.45, 0.85, 'Ensuite sink');
    item(lv, x0 + ew + 0.35, Y(depth - 0.9), 0.45, 0.55, 0.9, 'Hand-hygiene sink');   // at the entry, outside the ensuite
    const bw = o.bariatric ? 1.3 : 1.0, bl = o.bariatric ? 2.4 : 2.2; item(lv, x0 + 0.15 + bl / 2, Y(2.6), bl, bw, 0.6, o.bariatric ? 'Bariatric bed' : 'Patient bed', 'bed1');   // head on the side headwall
    item(lv, x0 + w - 0.6, Y(2.6), 0.8, 0.9, 1.0, 'Patient recliner'); item(lv, x0 + w / 2 + 0.3, Y(0.6), 2.0, 0.8, 0.8, 'Family sleeper sofa', 'sofa');
    return { door: [x0 + ew + (w - ew) / 2, o.door || 1.2] }; }
  // a band of rooms along one side: [width, name, kind, extra]; kind 'pt' a patient room, 'bar' bariatric, 'pal' palliative/family,
  // 'aiir' the isolation suite, 'x' any other room (extra: { door, out (a door to outside), blind (no window) })
  function band(lv, side, list) { const S = side === 'S', yc = S ? yS1 : yN2, yw = S ? 0 : D, mid = (yc + yw) / 2, corr = wallAt(lv, [0, yc], [L, yc]), ext = S ? wallAt(lv, [0, 0], [L, 0]) : wallAt(lv, [L, D], [0, D]); let x = 0;
    const pos = (xx) => (S ? xx : L - xx);   // along the outer wall (the north wall runs east to west)
    for (const [w, nm, kind, extra] of list) { const x1 = x + w; if (x1 < L - 0.01) wall(lv, [x1, S ? 0 : yN2], [x1, S ? yS1 : D], 0.15);
      if (kind === 'pt' || kind === 'bar' || kind === 'pal') { const r = patientRoom(lv, side, x, w, nm, kind === 'bar' ? { bariatric: true, ensW: 2.8, door: 1.5 } : kind === 'pal' ? { ensW: 2.8 } : {}); door(corr, r.door[0], r.door[1]); win(ext, pos(x + w / 2 + 0.4), 2.4); }
      else if (kind === 'aiir') { // the anteroom off the corridor, the isolation room behind it, its ensuite inboard beside the anteroom
        const ya = S ? yc - 2.4 : yc + 2.4, ante = wall(lv, [x, ya], [x + 2.2, ya]); wall(lv, [x + 2.2, ya], [x + 2.2, yc]); door(corr, x + 1.1, 1.2); door(ante, 1.1, 1.2); name(lv, x + 1.1, (ya + yc) / 2, 'AIIR anteroom');
        patientRoom(lv, side, x + 2.2, w - 2.2, nm, { ensW: 1.8 }); win(ext, pos(x + w / 2), 2.4); }
      else { door(corr, x + w / 2, extra?.door || 1.2); if (extra?.out) door(ext, pos(x + w / 2), extra.out); else if (!extra?.blind) win(ext, pos(x + w / 2), Math.min(2.4, w - 1.2)); name(lv, x + w / 2, mid, nm); }
      x = x1; } }
  function core(lv, x0, list) { const corS = wallAt(lv, [0, yS2], [L, yS2]), corN = wallAt(lv, [0, yN1], [L, yN1]); let x = x0;
    for (const [w, nm, o = {}] of list) { const x1 = x + w; if (Math.abs(x1 - (L - STW)) > 0.01) wall(lv, [x1, yS2], [x1, yN1], 0.15);   /* the last one is the stair core's wall */ if (o.s !== false) door(corS, x + w / 2, o.d || 1.0); if (o.n) door(corN, x + w / 2, o.d || 1.0); name(lv, x + w / 2, (yS2 + yN1) / 2, nm); if (o.desk) item(lv, x + w / 2, yS2 + 1.0, Math.min(4.2, w - 0.8), 0.75, 1.05, 'Nurse station counter'); x = x1; } }
  const pad = (k) => String(k).padStart(2, '0');
  const UNIT = {
    S: (n) => [...[1, 2, 3, 4, 5, 6].map((i) => [4.2, `Patient room ${n}${pad(i)}`, 'pt']), [5.4, `Patient room ${n}07 (bariatric)`, 'bar'], ...[8, 9, 10, 11, 12, 13].map((i) => [4.2, `Patient room ${n}${pad(i)}`, 'pt']), [5.4, `Patient room ${n}14 (palliative, family)`, 'pal']],
    N: (n) => [[6.0, `Isolation room ${n}15 (AIIR)`, 'aiir'], ...[16, 17, 18, 19, 20].map((i) => [4.2, `Patient room ${n}${pad(i)}`, 'pt']), [3.6, 'Family consult', 'x'], ...[21, 22, 23, 24, 25, 26].map((i) => [4.2, `Patient room ${n}${pad(i)}`, 'pt']), [5.4, 'Family lounge', 'x']] };
  for (const lv of ['L1', 'L2', 'L3']) {
    const n = lv.slice(1), ward = lv !== 'L1';
    // envelope and corridors
    wall(lv, [0, 0], [L, 0], 0.35); const E = wall(lv, [L, 0], [L, D], 0.35); wall(lv, [L, D], [0, D], 0.35); const W = wall(lv, [0, D], [0, 0], 0.35);
    for (const y of [yS1, yS2, yN1, yN2]) wall(lv, [0, y], [L, y], 0.2);
    // the smoke barrier at mid-length: across both corridors (double smoke doors held open) and the core
    for (const [y0, y1] of [[yS1, yS2], [yN1, yN2]]) door(wall(lv, [XM, y0], [XM, y1], 0.2), 1.32, 1.8);
    name(lv, XM / 2, (yS1 + yS2) / 2, 'Corridor South West'); name(lv, XM * 1.5, (yS1 + yS2) / 2, 'Corridor South East'); name(lv, XM / 2, (yN1 + yN2) / 2, 'Corridor North West'); name(lv, XM * 1.5, (yN1 + yN2) / 2, 'Corridor North East');
    // the exit stairs at both ends of the core, entered from both corridors, out to grade on Level 1
    const corS = wallAt(lv, [0, yS2], [L, yS2]), corN = wallAt(lv, [0, yN1], [L, yN1]); wall(lv, [STW, yS2], [STW, yN1], 0.25); wall(lv, [L - STW, yS2], [L - STW, yN1], 0.25);
    door(corS, 1.15, 1.2); door(corN, 1.15, 1.2); door(corS, L - 1.15, 1.2); door(corN, L - 1.15, 1.2); name(lv, 1.0, yS2 + 0.7, 'Exit stair West'); name(lv, L - 1.0, yS2 + 0.7, 'Exit stair East');   // stair doors at the corridors' ends: no dead end beyond the exit (2026-11-10)
    if (!ward) { door(W, D - yN1 + 0.9, 1.2); door(E, yS2 + 0.9, 1.2); }
    if (lv !== 'L3') for (const [cx, rot] of [[STW / 2, -Math.PI / 2], [L - STW / 2, Math.PI / 2]]) { const nR = Math.round(HF / 0.18), run = r3((nR - 1) * 0.28), q = P(cx, (yS2 + yN1) / 2 + 1.1); name(lv, cx, (yS2 + yN1) / 2 + 1.1, cx < L / 2 ? 'Exit stair West (flight)' : 'Exit stair East (flight)'); furn.push({ id: `st${furn.length + 1}`, lv, type: 'straight', gen: { id: 'straight', vals: { use: 'public', kind: 'stringer', H: Math.round(HF * 1000), W: 1650, T: 280, topLanding: false, rails: 'both', glass: false, color_wood: '#c9c3b8', n: nR }, auto: true }, name: 'Exit stair (1.65 m)', x: q[0], y: q[1], w: 1.4, d: run, h: HF, rot, object_type: 'furniture', layer: 'Stairs' }); }
    if (ward) {
      band(lv, 'S', UNIT.S(n)); band(lv, 'N', UNIT.N(n));
      core(lv, STW, [[6.0, 'Nurse station West', { n: true, d: 1.8, desk: true }], [3.2, 'Medication'], [3.2, 'Clean supply'], [3.4, 'Soiled utility'], [3.0, 'Equipment storage', { d: 1.5 }], [2.8, 'Staff washroom']]);
      core(lv, XM, [[5.0, 'Bed elevators', { s: false }], [3.6, 'Elevator vestibule', { n: true, d: 1.8 }], [4.6, 'Nurse station East', { n: true, d: 1.8, desk: true }], [2.8, 'Nourishment'], [3.2, 'Staff lounge'], [2.4, 'Housekeeping']]);
    } else {
      band(lv, 'S', [[8.4, 'Main entrance', 'x', { out: 2.4 }], [4.2, 'Registration', 'x'], [8.4, 'Waiting', 'x'], [4.2, 'Gift shop', 'x'], [5.4, 'Public toilets', 'x', { blind: true }],
        [3.6, 'Exam 1', 'x'], [3.6, 'Exam 2', 'x'], [3.6, 'Exam 3', 'x'], [3.6, 'Exam 4', 'x'], [5.4, 'Procedure', 'x', { door: 1.5 }], [6.0, 'Clinic waiting', 'x'], [4.8, 'Clinic reception', 'x']]);
      band(lv, 'N', [[12.6, 'Café', 'x'], [6.0, 'Outpatient pharmacy', 'x'], [6.0, 'Multifaith space', 'x'], [6.0, 'Security', 'x'],
        [7.2, 'Diagnostic imaging (X-ray)', 'x', { door: 1.5, blind: true }], [3.0, 'Imaging control', 'x', { blind: true }], [3.0, 'Change cubicles', 'x', { blind: true }], [6.0, 'Specimen collection', 'x'], [6.0, 'Staff lockers', 'x'], [5.4, 'Shipping and receiving', 'x', { door: 1.8, out: 2.4 }]]);
      core(lv, STW, [[6.0, 'Information desk', { n: true, d: 1.8 }], [3.2, 'Health records'], [3.2, 'IT room'], [3.4, 'Electrical'], [3.0, 'Mechanical'], [2.8, 'Staff washroom']]);
      core(lv, XM, [[5.0, 'Bed elevators', { s: false }], [3.6, 'Elevator vestibule', { n: true, d: 1.8 }], [4.6, 'Volunteer office'], [2.8, 'Mail'], [3.2, 'Clean linen'], [2.4, 'Housekeeping']]);
    }
    // the bed elevators open on the vestibule; the floor slab, open over the stairs arriving from below
    const ev = wallAt(lv, [XM + 5.0, yS2], [XM + 5.0, yN1]); door(ev, 1.9, 1.4); door(ev, 5.8, 1.4);
    const holes = lv === 'L1' ? undefined : [STW / 2, L - STW / 2].map((cx) => { const y = (yS2 + yN1) / 2 + 1.1; return [P(cx - 3.5, y - 0.8), P(cx + 3.5, y - 0.8), P(cx + 3.5, y + 0.8), P(cx - 3.5, y + 0.8)]; });
    floors.push({ id: `f${floors.length + 1}`, lv, x: P(0, 0)[0], y: P(0, 0)[1], w: L, d: D, thickness: 0.3, object_type: 'floor', layer: 'Floors', ...(holes ? { holes } : {}) });
  }
  floors.push({ id: `f${floors.length + 1}`, lv: 'RF', x: P(0, 0)[0], y: P(0, 0)[1], w: L, d: D, thickness: 0.35, object_type: 'floor', layer: 'Roof' });
  // the site (made up): a medical office tower to the west, an outpatient clinic to the east, a parking structure across the road to
  // the south, houses to the north; the service and ambulance lane to the receiving dock, the entrance plaza, a healing garden
  const B = (id, nm, x0, y0, x1, y1, h) => ({ id, name: nm, kind: 'building', xy: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], holes: [], h, hSource: 'example', base: 0, valid: true, excluded: false, src: { ref: 'example:' + id, provider: 'PlotCloud example' } });
  const buildings = [B('tower', 'Medical office tower', -74, -18, -52, 8, 34), B('clinic', 'Outpatient clinic', 50, -12, 76, 14, 14), B('parking', 'Parking structure', -30, -66, 30, -42, 11),
    B('h1', 'House', -40, 40, -28, 50, 8), B('h2', 'House', -18, 40, -6, 50, 8), B('h3', 'House', 4, 40, 16, 50, 8), B('h4', 'House', 26, 40, 38, 50, 8)];
  const roads = [{ id: 'road', name: 'Hospital Drive', cls: 'road', width: 9, pts: [[-110, -32], [110, -32]] }, { id: 'ambulance', name: 'Service and ambulance lane', cls: 'road', width: 6, pts: [[40, -32], [40, 18], [24, 18]] }];
  const areas = [{ id: 'plaza', kind: 'paving', name: 'Entrance plaza', pts: [[-30, -27], [-14, -27], [-14, -14.2], [-30, -14.2]] }, { id: 'garden', kind: 'green', name: 'Healing garden', pts: [[-30, 16], [18, 16], [18, 33], [-30, 33]] },
    { id: 'runnel', kind: 'water', name: 'Healing garden runnel and water wall', pts: [[-14, 24], [-1, 24], [-1, 26], [-14, 26]], water: { type: 'stream', depth: 0.15, speed: 0.6, centre: [[-13.5, 25, 0.9], [-8.2, 25, 0.9], [-8, 25, 0.1], [-1.5, 25, 0.1]] } }];   // a runnel spilling 0.8 m over a water wall
  const origin = { lat: site.lat, lon: site.lon, label: site.label };
  const context = { v: 1, id: 'example-hospital-site', version: 1, crs: 'local-tm', origin, north: 0, boundary: { kind: 'radius', r: 120 }, tz: -8, dst: 1, buildings, roads, trees: [], areas, sources: [{ provider: 'PlotCloud', attribution: 'Example site: a generic location; the neighbouring buildings, roads and garden are made up' }] };
  const studio = { v: 2, id: 'example-hospital', name: title, units: 'm', north: 0, version: 1, imports: [], masses: [], levels, walls, ops, floors, names, furn, voids: [], fences: [], ceil: [], notes: [], hiddenIds: [], lights: [], climate: { from: 90, U10: 3.5, terrain: 'suburban', Tout: 18, Tin: 22 }, targets: { ach: 6, df: 2 }, site: context };
  return { units: 'm', north: 0, layers: ['Site', 'Masses', 'Context', 'Walls', 'Floors', 'Roof', 'Stairs', 'Rooms', 'Furniture'].map((nm) => ({ name: nm, visible: true, locked: nm === 'Site' })), components: [], meshes: [], studio };
}
