// The floors of an imported building (2026-11-17), read from its geometry. Pure functions, no DOM.
// - Floor heights: the plan area of horizontal faces (normal within ~18° of vertical) in 5 cm bands; a band becomes a floor when
//   it holds at least a quarter of the largest band's area and a share of the footprint (so stair treads, sills and table tops are
//   not floors); bands within 0.6 m are one floor (a slab's top and underside), its height the top of the slab; floors at least
//   2.2 m apart.
// - The topmost floor is the roof when there are two or more.
// - Which floor is the ground: basement words in object or layer names (B2, B1, -1F, Basement, 地下2) count the floors below it;
//   otherwise, when the file's own coordinates put a floor at height 0 and others below it, that floor; otherwise the lowest.
// The person sees the list and can choose the ground floor before the model joins the project.

const BAND = 0.05;

// horizontal face area by height band, over every imported object (meshes are local to their object's corner g)
export function horizontalBands(components) {
  const area = new Map(); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, zTop = -Infinity;
  for (const c of components || []) { const m = c.mesh || [], g = c.g || { x: 0, y: 0, z: 0 };
    x0 = Math.min(x0, g.x); y0 = Math.min(y0, g.y); x1 = Math.max(x1, g.x + (g.w || 0)); y1 = Math.max(y1, g.y + (g.d || 0)); zTop = Math.max(zTop, g.z + (g.h || 0));
    for (let i = 0; i + 8 < m.length; i += 9) {
      const ax = m[i], ay = m[i + 1], az = m[i + 2], bx = m[i + 3] - ax, by = m[i + 4] - ay, bz = m[i + 5] - az, cx = m[i + 6] - ax, cy = m[i + 7] - ay, cz = m[i + 8] - az;
      const nx = by * cz - bz * cy, ny = bz * cx - bx * cz, nz = bx * cy - by * cx, len = Math.hypot(nx, ny, nz); if (len < 1e-9) continue;
      if (Math.abs(nz) / len < 0.95) continue;
      const z = g.z + (az + m[i + 5] + m[i + 8]) / 3, k = Math.round(z / BAND);
      area.set(k, (area.get(k) || 0) + len / 2);
    } }
  const footprint = Number.isFinite(x0) ? Math.max(0, (x1 - x0) * (y1 - y0)) : 0;
  return { bands: [...area.entries()].map(([k, a]) => ({ z: k * BAND, a })).sort((p, q) => p.z - q.z), footprint, top: Number.isFinite(zTop) ? zTop : 0 };
}

// basement floors named in the model: the deepest basement number found (B3, -3F, Level -3, Basement 3, 地下3层)
export function basementCount(components) {
  let n = 0; const seen = (v) => { if (v > n && v < 20) n = v; };
  for (const c of components || []) for (const s of [c.name, c.srcLayer, c.layer]) { const t = String(s || '');
    for (const m of t.matchAll(/(?:^|[^A-Za-z0-9])B(\d{1,2})(?:F|L)?(?![A-Za-z0-9])/gi)) seen(+m[1]);
    for (const m of t.matchAll(/(?:^|[^0-9])-(\d{1,2})\s*(?:F|L|层|樓|楼)/gi)) seen(+m[1]);
    for (const m of t.matchAll(/level\s*-\s*(\d{1,2})/gi)) seen(+m[1]);
    for (const m of t.matchAll(/basement\s*(\d{0,2})/gi)) seen(m[1] ? +m[1] : 1);
    for (const m of t.matchAll(/地下\s*(\d{0,2})/g)) seen(m[1] ? +m[1] : 1);
  }
  return n;
}

// the floors: [{z, h, area}] bottom to top, and which is the roof
export function floorHeights(components, { minGap = 2.2, merge = 0.6, share = 0.25, footShare = 0.12 } = {}) {
  const { bands, footprint, top } = horizontalBands(components); if (!bands.length) return { floors: [], footprint, top };
  // runs of bands within `merge` of each other are one slab; its level is the highest band with a real share of its area
  const runs = []; for (const b of bands) { const r = runs.at(-1); if (r && b.z - r.z1 <= merge) { r.bands.push(b); r.z1 = b.z; r.a += b.a; } else runs.push({ bands: [b], z0: b.z, z1: b.z, a: b.a }); }
  const big = Math.max(...runs.map((r) => r.a)), keep = runs.filter((r) => r.a >= share * big && r.a >= footShare * footprint);
  let floors = keep.map((r) => { const peak = Math.max(...r.bands.map((b) => b.a)), at = r.bands.filter((b) => b.a >= 0.25 * peak).at(-1); return { z: +at.z.toFixed(3), area: r.a }; });
  // too close to the floor below: the larger one stays
  for (let i = 1; i < floors.length; i++) if (floors[i].z - floors[i - 1].z < minGap) { const drop = floors[i].area > floors[i - 1].area ? i - 1 : i; floors.splice(drop, 1); i--; }
  floors = floors.map((f, i) => ({ ...f, h: i < floors.length - 1 ? +(floors[i + 1].z - f.z).toFixed(3) : null }));
  return { floors, footprint, top };
}

const median = (a) => { const s = [...a].sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)] : 3; };
const storeyName = (i, ground) => (i < ground ? 'B' + (ground - i) : i - ground + 1 + 'F');

/**
 * @param components imported objects ({name, srcLayer, g:{x,y,z,w,d,h}, mesh}) after the units and up axis are set
 * @param audit the import's audit (its source bounds tell where the file's own height 0 was)
 * @returns {floors:[{z,h,name,roof}], ground, basementsNamed, originZ, note}
 */
export function detectFloors(components, audit = {}) {
  const { floors: raw, top } = floorHeights(components); if (!raw.length) return { floors: [], ground: 0, note: 'No floors found: the model has no large horizontal faces.' };
  const roof = raw.length >= 2, storeys = roof ? raw.slice(0, -1) : raw, hs = storeys.map((f) => f.h).filter((h) => h > 0), typical = median(hs.length ? hs : [3]);
  // where the file's own height 0 was, relative to the model as imported (its lowest point is 0 now)
  const b = audit.sourceBounds, k = audit.unitScale || 1, up = audit.importedUp === 'y' ? 1 : 2, originZ = b && Number.isFinite(b.min?.[up]) ? -b.min[up] * k : null;
  const named = basementCount(components);
  let ground = 0, why = 'the lowest floor';
  if (named > 0 && named < storeys.length) { ground = named; why = `${named} basement floor${named > 1 ? 's' : ''} named in the model`; }
  else if (originZ !== null && originZ > 0.5) { const i = storeys.findIndex((f) => Math.abs(f.z - originZ) < 0.3); if (i > 0) { ground = i; why = 'the floor at height 0 in the file'; } }
  const floors = storeys.map((f, i) => ({ z: f.z, h: +(f.h || typical).toFixed(3), name: storeyName(i, ground), roof: false }));
  if (roof) floors.push({ z: raw.at(-1).z, h: +Math.max(0.3, Math.min(1.5, top - raw.at(-1).z || 1)).toFixed(3), name: 'Roof', roof: true });
  const hsr = storeys.slice(0, -1).map((f) => f.h).filter(Boolean);
  const note = `${storeys.length} floor${storeys.length === 1 ? '' : 's'}${roof ? ' and a roof' : ''}${hsr.length ? `, ${Math.min(...hsr).toFixed(1)}–${Math.max(...hsr).toFixed(1)} m apart` : ''}; ground floor: ${floors[ground].name} (${why}).`;
  return { floors, ground, basementsNamed: named, originZ, note };
}

// the floors renamed for another ground floor, and how far the model moves so that floor is at height 0
export function withGround(det, ground) { const g = Math.max(0, Math.min(det.floors.filter((f) => !f.roof).length - 1, ground | 0));
  return { ground: g, offset: -det.floors[g].z, floors: det.floors.map((f, i) => ({ ...f, name: f.roof ? 'Roof' : storeyName(i, g), z: +(f.z - det.floors[g].z).toFixed(3) })) }; }
