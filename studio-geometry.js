(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PCStudioGeometry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // All geometry is in model metres. Tolerance joins numerical noise, not door-sized gaps.
  const DEFAULT_TOLERANCE = 0.0001;
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const validPoint = p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
  const cleanNumber = n => Object.is(n, -0) ? 0 : +n.toFixed(12);
  const comparePoint = (a, b) => a[0] - b[0] || a[1] - b[1];
  const toleranceOf = options => Number.isFinite(options?.tolerance) && options.tolerance > 0 ? options.tolerance : DEFAULT_TOLERANCE;

  function signedArea(points) {
    if (!Array.isArray(points) || points.length < 3) return 0;
    // Translate first so far-from-origin GIS coordinates retain room-scale precision.
    const origin = points[0]; let area = 0;
    for (let i = 1; i + 1 < points.length; i++) area += cross(sub(points[i], origin), sub(points[i + 1], origin));
    return area / 2;
  }
  function closestOnSegment(point, a, b) {
    const d = sub(b, a), length2 = d[0] * d[0] + d[1] * d[1];
    const t = length2 ? Math.max(0, Math.min(1, ((point[0] - a[0]) * d[0] + (point[1] - a[1]) * d[1]) / length2)) : 0;
    const projected = [a[0] + t * d[0], a[1] + t * d[1]];
    return { point: projected, t, distance: distance(point, projected) };
  }
  function pointInPolygon(point, polygon, options = {}) {
    if (!validPoint(point) || !Array.isArray(polygon) || polygon.length < 3) return false;
    const tolerance = toleranceOf(options); let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[j], b = polygon[i];
      if (closestOnSegment(point, a, b).distance <= tolerance) return options.includeBoundary !== false;
      if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  function floorPoints(floor) {
    if (Array.isArray(floor?.points) && floor.points.length >= 3 && floor.points.every(validPoint)) return floor.points.map(p => p.slice(0, 2));
    if (floor && [floor.x, floor.y, floor.w, floor.d].every(Number.isFinite) && floor.w > 0 && floor.d > 0) return [[floor.x, floor.y], [floor.x + floor.w, floor.y], [floor.x + floor.w, floor.y + floor.d], [floor.x, floor.y + floor.d]];
    return [];
  }
  function floorRectBounds(floor) {
    const points = Array.isArray(floor) ? floor : floorPoints(floor);
    if (!points.length || !points.every(validPoint)) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of points) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    return { x: x0, y: y0, w: x1 - x0, d: y1 - y0, x0, y0, x1, y1 };
  }

  // Deterministic union of points in neighbouring spatial cells. A connected cluster uses
  // its lexicographically first coordinate, so wall order and orientation do not matter.
  function cluster(points, tolerance) {
    const sorted = points.map((p, index) => ({ p, index })).sort((a, b) => comparePoint(a.p, b.p));
    const parent = sorted.map((_, i) => i), cells = new Map();
    function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i].p, x = Math.floor(p[0] / tolerance), y = Math.floor(p[1] / tolerance);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const j of cells.get(`${x + dx},${y + dy}`) || []) {
        if (distance(p, sorted[j].p) <= tolerance) { const a = find(i), b = find(j); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); }
      }
      const key = `${x},${y}`; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(i);
    }
    const representative = new Map(), nodes = [], index = new Array(points.length);
    for (let i = 0; i < sorted.length; i++) {
      const id = find(i);
      if (!representative.has(id)) { representative.set(id, nodes.length); nodes.push(sorted[id].p.map(cleanNumber)); }
      index[sorted[i].index] = representative.get(id);
    }
    return { nodes, index };
  }
  function cutsBetween(a, b, tolerance) {
    const r = sub(a.b, a.a), s = sub(b.b, b.a), q = sub(b.a, a.a), den = cross(r, s);
    const lr = Math.hypot(...r), ls = Math.hypot(...s), out = [];
    if (Math.abs(den) > 1e-12 * lr * ls) {
      const t = cross(q, s) / den, u = cross(q, r) / den;
      if (t >= -tolerance / lr && t <= 1 + tolerance / lr && u >= -tolerance / ls && u <= 1 + tolerance / ls) out.push([a.a[0] + Math.max(0, Math.min(1, t)) * r[0], a.a[1] + Math.max(0, Math.min(1, t)) * r[1]]);
    }
    // Handles collinear overlaps as well as a nearly coincident T junction.
    for (const p of [a.a, a.b]) if (closestOnSegment(p, b.a, b.b).distance <= tolerance) out.push(p);
    for (const p of [b.a, b.b]) if (closestOnSegment(p, a.a, a.b).distance <= tolerance) out.push(p);
    return out;
  }
  function simplify(points, tolerance) {
    let out = points.slice(), changed = true;
    while (changed && out.length > 3) {
      changed = false;
      for (let i = 0; i < out.length; i++) {
        if (closestOnSegment(out[i], out[(i + out.length - 1) % out.length], out[(i + 1) % out.length]).distance <= tolerance) { out.splice(i, 1); changed = true; break; }
      }
    }
    let first = 0; for (let i = 1; i < out.length; i++) if (comparePoint(out[i], out[first]) < 0) first = i;
    return out.slice(first).concat(out.slice(0, first)).map(p => p.slice());
  }
  function cyclicKey(parts) {
    let best = null;
    for (let i = 0; i < parts.length; i++) { const value = JSON.stringify(parts.slice(i).concat(parts.slice(0, i))); if (best === null || value < best) best = value; }
    return best;
  }
  function wallIsBoundary(wall) {
    if (!wall || !validPoint(wall.a) || !validPoint(wall.b) || wall.fence === true) return false;
    return ![wall.object_type, wall.type, wall.kind, wall.layer].some(value => typeof value === 'string' && /^(?:fence|fences)$/i.test(value));
  }
  function facesForLevel(input, levelId, tolerance) {
    let walls = input.filter(w => w.lv === levelId && wallIsBoundary(w) && distance(w.a, w.b) > tolerance).map(w => ({ a: w.a.slice(0, 2), b: w.b.slice(0, 2), id: String(w.id ?? JSON.stringify([w.a, w.b].sort(comparePoint))) }));
    const endpoints = cluster(walls.flatMap(w => [w.a, w.b]), tolerance);
    walls = walls.map((w, i) => ({ ...w, a: endpoints.nodes[endpoints.index[i * 2]], b: endpoints.nodes[endpoints.index[i * 2 + 1]] })).filter(w => distance(w.a, w.b) > tolerance);
    const cuts = walls.map(w => [w.a, w.b]);
    for (let i = 0; i < walls.length; i++) for (let j = i + 1; j < walls.length; j++) {
      const found = cutsBetween(walls[i], walls[j], tolerance); cuts[i].push(...found); cuts[j].push(...found);
    }
    const allCuts = cuts.flat(), vertices = cluster(allCuts, tolerance), nodes = vertices.nodes, edges = new Map(); let offset = 0;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i], ids = [...new Set(vertices.index.slice(offset, offset + cuts[i].length))]; offset += cuts[i].length;
      const d = sub(w.b, w.a); ids.sort((a, b) => (nodes[a][0] - nodes[b][0]) * d[0] + (nodes[a][1] - nodes[b][1]) * d[1]);
      for (let j = 0; j + 1 < ids.length; j++) {
        const a = Math.min(ids[j], ids[j + 1]), b = Math.max(ids[j], ids[j + 1]); if (distance(nodes[a], nodes[b]) <= tolerance) continue;
        const key = `${a}/${b}`; if (!edges.has(key)) edges.set(key, { a, b, walls: new Set() }); edges.get(key).walls.add(w.id);
      }
    }
    let adjacency = nodes.map(() => []);
    for (const [key, edge] of edges) { adjacency[edge.a].push({ to: edge.b, key }); adjacency[edge.b].push({ to: edge.a, key }); }
    // Remove graph bridges: dangling partitions and open chains enclose no surface.
    const discovery = new Array(nodes.length).fill(-1), low = [], bridges = new Set(); let clock = 0;
    for (let start = 0; start < nodes.length; start++) {
      if (discovery[start] !== -1) continue;
      discovery[start] = low[start] = clock++; const stack = [{ node: start, parent: -1, edge: null, next: 0 }];
      while (stack.length) {
        const frame = stack[stack.length - 1], u = frame.node;
        if (frame.next < adjacency[u].length) {
          const next = adjacency[u][frame.next++]; if (next.key === frame.edge) continue;
          if (discovery[next.to] === -1) { discovery[next.to] = low[next.to] = clock++; stack.push({ node: next.to, parent: u, edge: next.key, next: 0 }); }
          else low[u] = Math.min(low[u], discovery[next.to]);
        } else {
          stack.pop(); if (frame.parent !== -1) { low[frame.parent] = Math.min(low[frame.parent], low[u]); if (low[u] > discovery[frame.parent]) bridges.add(frame.edge); }
        }
      }
    }
    adjacency = adjacency.map((list, index) => list.filter(e => !bridges.has(e.key)).sort((a, b) => Math.atan2(nodes[a.to][1] - nodes[index][1], nodes[a.to][0] - nodes[index][0]) - Math.atan2(nodes[b.to][1] - nodes[index][1], nodes[b.to][0] - nodes[index][0])));
    const nodeWallIds = adjacency.map(list => [...new Set(list.flatMap(e => [...edges.get(e.key).walls]))].sort());
    const visited = new Set(), found = [], seen = new Set();
    function accept(cycle) {
      const raw = cycle.map(id => nodes[id]); if (signedArea(raw) <= tolerance * tolerance) return;
      const points = simplify(raw, tolerance); if (points.length < 3 || signedArea(points) <= tolerance * tolerance) return;
      const parts = cycle.map((node, i) => { const next = cycle[(i + 1) % cycle.length], edge = edges.get(`${Math.min(node, next)}/${Math.max(node, next)}`); return [nodeWallIds[node], [...edge.walls].sort()]; });
      const key = `wall-face:${JSON.stringify(levelId ?? null)}:${cyclicKey(parts)}`; if (seen.has(key)) return; seen.add(key);
      found.push({ key, lv: levelId, points, holes: [], wallIds: [...new Set(parts.flatMap(p => p[1]))].sort(), area: signedArea(points) });
    }
    for (let start = 0; start < nodes.length; start++) for (const next of adjacency[start]) {
      if (visited.has(`${start}>${next.to}`)) continue;
      const walk = []; let a = start, b = next.to;
      for (let count = 0; count <= edges.size * 2; count++) {
        const directed = `${a}>${b}`; if (visited.has(directed)) break; visited.add(directed); walk.push(a);
        const list = adjacency[b], reverse = list.findIndex(e => e.to === a); if (reverse < 0 || !list.length) break;
        const c = list[(reverse + list.length - 1) % list.length].to; a = b; b = c;
        if (a === start && b === next.to) break;
      }
      // An articulation vertex can bound multiple simple cycles. Split repeated vertices
      // before accepting faces rather than emitting a self-touching floor polygon.
      const path = [], positions = new Map();
      for (const node of walk.concat(walk.length ? [walk[0]] : [])) {
        if (positions.has(node)) { const at = positions.get(node), cycle = path.slice(at); if (cycle.length >= 3) accept(cycle); for (let i = at + 1; i < path.length; i++) positions.delete(path[i]); path.length = at + 1; }
        else { positions.set(node, path.length); path.push(node); }
      }
    }
    // Disconnected nested wall loops bound an annular room around an inner room.
    // Retain both floors but subtract the immediate child's polygon from its parent.
    for (const child of found) {
      const containers = found.filter(parent => parent !== child && parent.area > child.area + tolerance * tolerance && child.points.every(p => pointInPolygon(p, parent.points, { tolerance, includeBoundary: false })));
      if (containers.length) containers.sort((a, b) => a.area - b.area)[0].holes.push(child.points.slice().reverse().map(p => p.slice()));
    }
    for (const face of found) face.area = signedArea(face.points) - face.holes.reduce((sum, hole) => sum + Math.abs(signedArea(hole)), 0);
    return found.sort((a, b) => a.key.localeCompare(b.key));
  }
  function closedWallFaces(walls, options = {}) {
    if (!Array.isArray(walls)) return [];
    const tolerance = toleranceOf(options), levels = options.levelId !== undefined ? [options.levelId] : [...new Set(walls.filter(Boolean).map(w => w.lv))].sort((a, b) => String(a).localeCompare(String(b)));
    return levels.flatMap(level => facesForLevel(walls, level, tolerance));
  }

  function polygonContainsPolygon(container, polygon, tolerance) {
    if (!polygon.every(p => pointInPolygon(p, container, { tolerance }))) return false;
    // Check every subsegment between boundary crossings; concave manual floors must
    // never suppress an auto floor merely because their rectangular bounds cover it.
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length], segment = { a, b }, params = [0, 1];
      for (let j = 0; j < container.length; j++) for (const p of cutsBetween(segment, { a: container[j], b: container[(j + 1) % container.length] }, tolerance)) params.push(closestOnSegment(p, a, b).t);
      params.sort((x, y) => x - y);
      for (let j = 0; j + 1 < params.length; j++) { const t = (params[j] + params[j + 1]) / 2; if (!pointInPolygon([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], container, { tolerance })) return false; }
    }
    return true;
  }
  function polygonsOverlap(a, b, tolerance) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length < 3 || b.length < 3) return false;
    if (a.some(p => pointInPolygon(p, b, { tolerance })) || b.some(p => pointInPolygon(p, a, { tolerance }))) return true;
    for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) if (cutsBetween({ a: a[i], b: a[(i + 1) % a.length] }, { a: b[j], b: b[(j + 1) % b.length] }, tolerance).length) return true;
    return false;
  }
  function hash(value) { let n = 2166136261; for (let i = 0; i < value.length; i++) { n ^= value.charCodeAt(i); n = Math.imul(n, 16777619); } return (n >>> 0).toString(36); }
  function upsertAutoFloors(model, options = {}) {
    if (!model || !Array.isArray(model.walls)) return [];
    const existing = Array.isArray(model.floors) ? model.floors : [], tolerance = toleranceOf(options);
    const inScope = floor => options.levelId === undefined || floor.lv === options.levelId;
    const manual = existing.filter(floor => !floor.auto), keep = existing.filter(floor => !floor.auto || !inScope(floor));
    const previous = new Map(existing.filter(floor => floor.auto && inScope(floor)).map(floor => [floor.autoKey, floor]));
    const usedIds = new Set(keep.map(floor => floor.id)), generated = [];
    for (const face of closedWallFaces(model.walls, options)) {
      const covered = manual.some(floor => floor.lv === face.lv && polygonContainsPolygon(floorPoints(floor), face.points, tolerance) && !(floor.holes || []).some(hole => polygonsOverlap(hole, face.points, tolerance) && !face.holes.some(excluded => polygonContainsPolygon(excluded, hole, tolerance))));
      if (covered) continue;
      const old = previous.get(face.key), bounds = floorRectBounds(face.points), level = (model.levels || []).find(l => l.id === face.lv);
      let id = old?.id || `fl-auto-${hash(face.key)}`; let suffix = 1; while (usedIds.has(id)) id = `fl-auto-${hash(face.key)}-${suffix++}`; usedIds.add(id);
      const thickness = [old?.thickness, options.thickness, level?.slab, 0.22].find(value => Number.isFinite(value) && value > 0);
      generated.push({ ...old, id, lv: face.lv, object_type: 'floor', layer: 'Floor', auto: true, autoKey: face.key, points: face.points, holes: face.holes, x: bounds.x, y: bounds.y, w: bounds.w, d: bounds.d, thickness });
    }
    model.floors = keep.concat(generated); return generated;
  }
  return { closedWallFaces, upsertAutoFloors, pointInPolygon, floorPoints, floorRectBounds, signedArea, closestOnSegment };
});
