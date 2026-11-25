// Schematic 3D vehicles for the swept-path study (2026-11-25): a vehicle's parts as boxes and cylinders, from its dimensions in
// vehicles.js, so the 3D view shows the vehicle that drives the route at its true size. Pure geometry (no three.js): the modeler
// turns the parts into meshes. A schematic model to read the movement and the scale, not a rendering of a make or model.
//
// Frame: a unit's own frame, metres. The tractor: origin at the centre of the rear axle, x forward, y to the left, z up (the pose of
// swept-path.js: x, y, th). The trailer: origin at the hitch (kingpin), x along the trailer forward, turned by the trailer heading phi.
// Footprints match swept-path.js shapesAt: the tractor's body spans x from −rearOverhang to wheelbase + frontOverhang and y ±width/2;
// the trailer's from −(wheelbase + rearOverhang) to frontOverhang, ±width/2.

// Display heights (m). Where an AASHTO design vehicle matches the preset, its overall height from Exhibit 2-1 (Metric) of
// A Policy on Geometric Design of Highways and Streets (AASHTO; values as reprinted in the June 2004 errata to the 2004 edition):
// P passenger car 1.3; SU single-unit truck 3.4–4.1 (4.1 used); CITY-BUS 3.2; BUS-12/14 3.7; WB-19 and WB-20 semitrailers 4.1.
// The SUV, pickup and delivery van have no AASHTO design vehicle: their heights are assumptions for the picture and say so.
// Heights only shape the 3D picture: no overhead clearance is checked.
export const HEIGHTS = {
  car: [1.3, 'AASHTO P'], suv: [1.8, 'assumed'], pickup: [1.9, 'assumed'], van: [2.6, 'assumed'], box: [3.4, 'AASHTO SU (lower value)'], mrv: [3.6, 'AASHTO SU (within 3.4–4.1)'],
  hrv: [4.1, 'AASHTO SU (upper value)'], mixer: [3.7, 'AASHTO SU (within 3.4–4.1)'], fire: [3.4, 'AASHTO SU (lower value)'], bus: [3.2, 'AASHTO CITY-BUS'], semi: [4.1, 'AASHTO WB-20'], staa: [4.1, 'AASHTO WB-19 (STAA)'],
};
export const HEIGHT_SOURCE = 'AASHTO, A Policy on Geometric Design of Highways and Streets, Exhibit 2-1 (Metric), design vehicle overall heights';
const TYPE = { car: 'car', suv: 'car', pickup: 'pickup', van: 'van', box: 'truck', mrv: 'truck', hrv: 'truck', mixer: 'mixer', fire: 'fire', bus: 'bus', semi: 'artic', staa: 'artic' };

/** the height used for a vehicle (its own, the preset's, or from its size), and where it comes from */
export function heightOf(v) { if (+v.height > 0) return { h: +v.height, src: v.heightSrc || 'set by you' }; const H = HEIGHTS[v.id]; if (H) return { h: H[0], src: H[1] };
  const L = (v.wheelbase || 3) + (v.frontOverhang || 0) + (v.rearOverhang || 0); return { h: L < 6 ? 1.6 : L < 9 ? 3.0 : 3.6, src: 'assumed from the length' }; }
export const typeOf = (v) => TYPE[v.id] || (v.kind === 'artic' ? 'artic' : (v.wheelbase || 0) + (v.frontOverhang || 0) + (v.rearOverhang || 0) < 6.2 ? 'car' : 'truck');

const box = (x0, x1, y0, y1, z0, z1, col, role) => ({ shape: 'box', x0, x1, y0, y1, z0, z1, col, role });

/**
 * the parts of a vehicle: { type, height, heightSrc, units: [{ id: 'tractor'|'trailer', parts: [...] }], wheels: [{ unit, x, y, r, w, steer }] }
 * parts: { shape: 'box', x0, x1, y0, y1, z0, z1, col, role } or { shape: 'cylx', x0, x1, y: 0, z, r0, r1, col, role } (a cylinder along x)
 * @param col the route's colour, for the body (a fire truck stays red)
 */
export function vehicleParts(v, col = '#2563eb') {
  const type = typeOf(v), { h: H, src } = heightOf(v), L = v.wheelbase, W = v.width, xr = -v.rearOverhang, xf = L + v.frontOverhang, y0 = -W / 2, y1 = W / 2;
  const big = type !== 'car' && type !== 'pickup', r = big ? 0.5 : 0.33, ww = big ? 0.32 : 0.22, z0 = r * 0.55, parts = [];
  const glass = '#1f2937', dark = '#374151', body = type === 'fire' ? '#c81e1e' : col;
  if (type === 'car' || type === 'pickup') {
    const zb = H * 0.55; parts.push(box(xr, xf, y0, y1, z0, zb, body, 'body'));
    const c0 = type === 'pickup' ? L * 0.35 : xr + (xf - xr) * 0.28, c1 = type === 'pickup' ? L + v.frontOverhang * 0.1 : xr + (xf - xr) * 0.78;
    parts.push(box(c0, c1, y0 + W * 0.06, y1 - W * 0.06, zb, H, glass, 'cabin'));
    if (type === 'pickup') parts.push(box(xr, c0 - 0.05, y0, y1, zb, zb + 0.35, body, 'bed'));
  } else if (type === 'van') {
    parts.push(box(xr, xf - 0.9, y0, y1, z0, H, body, 'body')); parts.push(box(xf - 0.9, xf, y0, y1, z0, H * 0.62, body, 'bonnet')); parts.push(box(xf - 1.05, xf - 0.85, y0 + 0.08, y1 - 0.08, H * 0.62, H * 0.95, glass, 'windscreen'));
  } else if (type === 'bus') {
    parts.push(box(xr, xf, y0, y1, z0 + 0.15, H, body, 'body')); parts.push(box(xr + 0.4, xf - 0.3, y0 - 0.01, y1 + 0.01, H * 0.5, H * 0.82, glass, 'windows'));
  } else if (type === 'artic') {
    const cab = Math.min(2.4, v.frontOverhang + L * 0.45); parts.push(box(xf - cab, xf, y0, y1, z0, H * 0.78, body, 'cab')); parts.push(box(xr, xf - cab, y0 + 0.25, y1 - 0.25, z0, 1.15, dark, 'chassis'));
  } else {   // trucks, the mixer, the fire truck: a cab at the front, the body behind it
    const cab = Math.min(2.3, (xf - xr) * 0.3); parts.push(box(xf - cab, xf, y0, y1, z0, H * 0.75, type === 'fire' ? body : '#e5e7eb', 'cab'));
    parts.push(box(xf - cab + 0.15, xf - 0.05, y0 + 0.05, y1 - 0.05, H * 0.45, H * 0.72, glass, 'windscreen'));
    parts.push(box(xr, xf - cab - 0.1, y0 + 0.2, y1 - 0.2, z0, 1.1, dark, 'chassis'));
    if (type === 'mixer') parts.push({ shape: 'cylx', x0: xr + 0.3, x1: xf - cab - 0.3, y: 0, z: (1.1 + H) / 2, r0: (H - 1.1) / 2 * 0.95, r1: (H - 1.1) / 2 * 0.6, col: body, role: 'drum' });
    else parts.push(box(xr, xf - cab - 0.1, y0, y1, 1.1, H, body, type === 'fire' ? 'body' : 'cargo'));
    if (type === 'fire') { for (const yy of [-0.45, 0.45]) parts.push(box(xr + 0.4, xf - 0.3, yy - 0.04, yy + 0.04, H + 0.05, H + 0.15, '#d1d5db', 'ladder')); }
  }
  const units = [{ id: 'tractor', parts }], t2 = v.track / 2, wheels = [{ unit: 'tractor', x: 0, y: t2, r, w: ww, steer: false }, { unit: 'tractor', x: 0, y: -t2, r, w: ww, steer: false }, { unit: 'tractor', x: L, y: t2, r, w: ww, steer: true }, { unit: 'tractor', x: L, y: -t2, r, w: ww, steer: true }];
  if (type === 'artic' && v.trailer) { const T = v.trailer, tw = (T.width || W) / 2, tt = (T.track || v.track) / 2;
    units.push({ id: 'trailer', parts: [box(-(T.wheelbase + T.rearOverhang), T.frontOverhang, -tw, tw, 1.15, H, body === '#c81e1e' ? '#e5e7eb' : '#f3f4f6', 'trailer'), box(-(T.wheelbase + T.rearOverhang), T.frontOverhang, -tw - 0.01, tw + 0.01, H - 0.35, H - 0.2, body, 'stripe')] });
    wheels.push({ unit: 'trailer', x: -T.wheelbase, y: tt, r, w: ww, steer: false }, { unit: 'trailer', x: -T.wheelbase, y: -tt, r, w: ww, steer: false }); }
  return { type, height: H, heightSrc: src, units, wheels, hitchX: v.kind === 'artic' && v.trailer ? (v.trailer.hitch || 0) : null };
}

/** the plan footprint of a unit's parts (x0, x1, y0, y1), for checks */
export function footprint(spec, unit = 'tractor') { const U = spec.units.find((u) => u.id === unit); if (!U) return null; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of U.parts) { const a = p.shape === 'box' ? [p.x0, p.x1, p.y0, p.y1] : [p.x0, p.x1, -p.r0, p.r0]; x0 = Math.min(x0, a[0]); x1 = Math.max(x1, a[1]); y0 = Math.min(y0, a[2]); y1 = Math.max(y1, a[3]); }
  return { x0, x1, y0, y1 }; }
