// Plan Studio's parametric furniture in Workspace v2. A placed piece stores only its kind, parameters and rotation;
// the mesh is rebuilt from furniture/models.js + furniture/geom.js (the same code Plan Studio uses), so nothing heavy is saved.
import './pc-en.js';
import * as THREE from 'three';
import { MODELS, defaults, buildModel, paramVisible, materialColor } from '../../furniture/models.js';
import { partGeometry } from '../../furniture/geom.js';
import { t } from '../../furniture/i18n.js';

export const furnModel = (id) => MODELS.find((m) => m.id === id) || null;
export const label = (s) => t(s);
export { paramVisible };

const cache = new Map();
// local mesh in metres: origin at the minimum corner of the rotated footprint (like imported meshes), with per-vertex colours
export function furnMesh(c) {
  const m = furnModel(c.furn); if (!m) return null;
  const vals = { ...defaults(m), ...(c.params || {}) }, rot = ((c.rot || 0) % 360 + 360) % 360, key = c.furn + '|' + rot + '|' + JSON.stringify(vals);
  if (cache.has(key)) return cache.get(key);
  const { parts } = buildModel(m, vals), pos = [], col = [], tmp = new THREE.Color();
  for (const p of parts) {
    let g = partGeometry(p); if (g.index) g = g.toNonIndexed(); const a = g.attributes.position; tmp.set(materialColor(p.mat, vals));
    for (let i = 0; i < a.count; i++) { pos.push(a.getX(i) / 1000, a.getY(i) / 1000, a.getZ(i) / 1000); col.push(tmp.r, tmp.g, tmp.b); }
    g.dispose();
  }
  const r = rot * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r); let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) { const x = pos[i], y = pos[i + 1]; pos[i] = x * cs - y * sn; pos[i + 1] = x * sn + y * cs; for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i + k]); mx[k] = Math.max(mx[k], pos[i + k]); } }
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) pos[i + k] -= mn[k];
  const out = { pos: new Float32Array(pos), col: new Float32Array(col), w: +(mx[0] - mn[0]).toFixed(3), d: +(mx[1] - mn[1]).toFixed(3), h: +(mx[2] - mn[2]).toFixed(3) };
  if (cache.size > 200) cache.clear(); cache.set(key, out); return out;
}
// a new piece centred on a floor point; size comes from the model, so the footprint matches Plan Studio
export function newFurniture(id, at, uid) {
  const m = furnModel(id), c = { id: uid, name: m.en, type: 'furniture', layer: 'Furniture', mat: 'Timber', furn: id, params: {}, rot: 0, g: { x: 0, y: 0, z: at.z, w: 1, d: 1, h: 1 } };
  fitBox(c, { x: at.x, y: at.y }); return c;
}
// after a parameter or rotation change: new size from the model, same centre
export function fitBox(c, centre) {
  const k = furnMesh(c); if (!k) return c; const cx = centre ? centre.x : c.g.x + c.g.w / 2, cy = centre ? centre.y : c.g.y + c.g.d / 2;
  Object.assign(c.g, { w: k.w, d: k.d, h: k.h, x: +(cx - k.w / 2).toFixed(3), y: +(cy - k.d / 2).toFixed(3) }); return c;
}
export function paramsOf(c) { const m = furnModel(c.furn); return m ? { model: m, values: { ...defaults(m), ...(c.params || {}) } } : null; }
