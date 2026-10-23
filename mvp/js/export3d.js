// Model export for Workspace v2: every visible component as triangles, in metres, written to common formats.
// Model axes: x east, y north, z up. OBJ and glTF are written Y-up (their convention); the others stay Z-up.
// SketchUp's own .skp can only be written by SketchUp's SDK, so SketchUp gets Collada (.dae), which it imports directly.
import * as THREE from 'three';
import { furnMesh } from './furn3d.js';

const COLORS = { Site: '#c5cfae', Context: '#d6d2ca', Structure: '#d9cdb8', Walls: '#ece4d6', Glazing: '#9ec3dc', Roof: '#e3ddd2', Rooms: '#e8b04a', Furniture: '#d9c4a0', Imported: '#e2ddd3' };
const colorOf = (model, layer) => model.layers.find((l) => l.name === layer)?.color || COLORS[layer] || '#cccccc';
const safe = (s) => String(s).replace(/[^\w\-]+/g, '_').slice(0, 60) || 'item';

// triangles in world coordinates for each visible component
export function items(model) {
  const vis = new Set(model.layers.filter((l) => l.visible).map((l) => l.name)), out = [];
  for (const c of model.components) {
    if (!vis.has(c.layer)) continue;
    let pos; const k = c.furn && furnMesh(c);
    if (k) { pos = new Float32Array(k.pos.length); for (let i = 0; i < pos.length; i += 3) { pos[i] = k.pos[i] + c.g.x; pos[i + 1] = k.pos[i + 1] + c.g.y; pos[i + 2] = k.pos[i + 2] + c.g.z; } }
    else if (c.mesh) { pos = new Float32Array(c.mesh.length); for (let i = 0; i < pos.length; i += 3) { pos[i] = c.mesh[i] + c.g.x; pos[i + 1] = c.mesh[i + 1] + c.g.y; pos[i + 2] = c.mesh[i + 2] + c.g.z; } }
    else { const g = new THREE.BoxGeometry(c.g.w, c.g.d, c.g.h).toNonIndexed(); g.translate(c.g.x + c.g.w / 2, c.g.y + c.g.d / 2, c.g.z + c.g.h / 2); pos = Float32Array.from(g.attributes.position.array); g.dispose(); }
    out.push({ c, pos });
  }
  return out;
}
const f = (v) => +v.toFixed(5);

export function obj(model) {
  const L = [`# PlotCloud Workspace export · metres · Y up`, `mtllib none`]; let base = 1;
  for (const { c, pos } of items(model)) {
    L.push(`o ${safe(c.name)}`, `g ${safe(c.layer)}`);
    for (let i = 0; i < pos.length; i += 3) L.push(`v ${f(pos[i])} ${f(pos[i + 2])} ${f(-pos[i + 1])}`);
    for (let i = 0; i < pos.length / 3; i += 3) L.push(`f ${base + i} ${base + i + 1} ${base + i + 2}`);
    base += pos.length / 3;
  }
  return new Blob([L.join('\n') + '\n'], { type: 'text/plain' });
}

export function stl(model) {
  const all = items(model), n = all.reduce((s, x) => s + x.pos.length / 9, 0), buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
  new TextEncoder().encode('PlotCloud Workspace export, metres, Z up').forEach((b, i) => dv.setUint8(i, b));
  dv.setUint32(80, n, true); let o = 84; const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nn = new THREE.Vector3();
  for (const { pos } of all) for (let i = 0; i < pos.length; i += 9) {
    a.fromArray(pos, i); b.fromArray(pos, i + 3); c.fromArray(pos, i + 6); nn.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    for (const v of [nn, a, b, c]) { dv.setFloat32(o, v.x, true); dv.setFloat32(o + 4, v.y, true); dv.setFloat32(o + 8, v.z, true); o += 12; } o += 2;
  }
  return new Blob([buf], { type: 'model/stl' });
}

export async function glb(model) {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const scene = new THREE.Scene(), root = new THREE.Group(); root.rotation.x = -Math.PI / 2; scene.add(root); const mats = {};
  for (const { c, pos } of items(model)) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals();
    const m = mats[c.layer] ||= new THREE.MeshStandardMaterial({ color: colorOf(model, c.layer), roughness: 0.7, transparent: c.type === 'window', opacity: c.type === 'window' ? 0.45 : 1, name: c.layer });
    const mesh = new THREE.Mesh(g, m); mesh.name = c.name; mesh.userData = { layer: c.layer, type: c.type }; root.add(mesh);
  }
  const ab = await new GLTFExporter().parseAsync(scene, { binary: true });
  return new Blob([ab], { type: 'model/gltf-binary' });
}

export function dxf(model) {   // AutoCAD R12: one 3DFACE per triangle, on the component's layer
  const all = items(model), layers = [...new Set(all.map((x) => safe(x.c.layer)))], P = [];
  const add = (...kv) => { for (let i = 0; i < kv.length; i += 2) P.push(String(kv[i]), String(kv[i + 1])); };
  add(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$INSUNITS', 70, 6, 0, 'ENDSEC');
  add(0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LAYER', 70, layers.length); layers.forEach((l, i) => add(0, 'LAYER', 2, l, 70, 0, 62, (i % 7) + 1, 6, 'CONTINUOUS')); add(0, 'ENDTAB', 0, 'ENDSEC');
  add(0, 'SECTION', 2, 'ENTITIES');
  for (const { c, pos } of all) for (let i = 0; i < pos.length; i += 9) { const v = (k) => [f(pos[i + k * 3]), f(pos[i + k * 3 + 1]), f(pos[i + k * 3 + 2])];
    const [a, b, d] = [v(0), v(1), v(2)]; add(0, '3DFACE', 8, safe(c.layer), 10, a[0], 20, a[1], 30, a[2], 11, b[0], 21, b[1], 31, b[2], 12, d[0], 22, d[1], 32, d[2], 13, d[0], 23, d[1], 33, d[2]); }
  add(0, 'ENDSEC', 0, 'EOF');
  return new Blob([P.join('\n') + '\n'], { type: 'application/dxf' });
}

export function dae(model) {   // Collada 1.4.1, Z up, metres: SketchUp, Rhino, Blender and 3ds Max read it
  const all = items(model), layers = [...new Set(all.map((x) => x.c.layer))], x = (s) => String(s).replace(/[<>&"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[ch]);
  const rgb = (hex) => { const c = new THREE.Color(hex); return `${f(c.r)} ${f(c.g)} ${f(c.b)} 1`; };
  const fx = layers.map((l, i) => `<effect id="fx${i}"><profile_COMMON><technique sid="t"><lambert><diffuse><color>${rgb(colorOf(model, l))}</color></diffuse></lambert></technique></profile_COMMON></effect>`).join('');
  const mt = layers.map((l, i) => `<material id="m${i}" name="${x(l)}"><instance_effect url="#fx${i}"/></material>`).join('');
  const geo = all.map(({ c, pos }, k) => { const n = pos.length / 3; return `<geometry id="g${k}" name="${x(c.name)}"><mesh><source id="g${k}p"><float_array id="g${k}a" count="${pos.length}">${Array.from(pos, f).join(' ')}</float_array><technique_common><accessor source="#g${k}a" count="${n}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source><vertices id="g${k}v"><input semantic="POSITION" source="#g${k}p"/></vertices><triangles material="mat" count="${n / 3}"><input semantic="VERTEX" source="#g${k}v" offset="0"/><p>${Array.from({ length: n }, (_, i) => i).join(' ')}</p></triangles></mesh></geometry>`; }).join('');
  const nodes = all.map(({ c }, k) => `<node id="n${k}" name="${x(c.name)}"><instance_geometry url="#g${k}"><bind_material><technique_common><instance_material symbol="mat" target="#m${layers.indexOf(c.layer)}"/></technique_common></bind_material></instance_geometry></node>`).join('');
  const now = new Date().toISOString();
  const s = `<?xml version="1.0" encoding="utf-8"?>\n<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1"><asset><contributor><authoring_tool>PlotCloud Workspace</authoring_tool></contributor><created>${now}</created><modified>${now}</modified><unit name="meter" meter="1"/><up_axis>Z_UP</up_axis></asset><library_effects>${fx}</library_effects><library_materials>${mt}</library_materials><library_geometries>${geo}</library_geometries><library_visual_scenes><visual_scene id="scene">${nodes}</visual_scene></library_visual_scenes><scene><instance_visual_scene url="#scene"/></scene></COLLADA>\n`;
  return new Blob([s], { type: 'model/vnd.collada+xml' });
}

let rhinoP = null;
function loadRhino() {
  return rhinoP ||= new Promise((res, rej) => { if (window.rhino3dm) return res(window.rhino3dm()); const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/rhino3dm@8.35.0/rhino3dm.min.js'; s.onload = () => res(window.rhino3dm()); s.onerror = () => { rhinoP = null; rej(Error('The Rhino library could not load. Check the connection and try again.')); }; document.head.appendChild(s); });
}
export async function rhino(model) {   // Rhino .3dm: one mesh per component, named, on its layer, metres
  const rh = await loadRhino(), doc = new rh.File3dm(); doc.settings().modelUnitSystem = rh.UnitSystem.Meters;
  const idx = {};
  for (const l of model.layers) { const layer = new rh.Layer(); layer.name = l.name; const c = new THREE.Color(l.color || COLORS[l.name] || '#cccccc'); layer.color = { r: Math.round(c.r * 255), g: Math.round(c.g * 255), b: Math.round(c.b * 255), a: 255 }; idx[l.name] = doc.layers().add(layer); }
  for (const { c, pos } of items(model)) {
    const m = new rh.Mesh(), vs = m.vertices(), fs = m.faces();
    for (let i = 0; i < pos.length; i += 3) vs.add(pos[i], pos[i + 1], pos[i + 2]);
    for (let i = 0; i < pos.length / 3; i += 3) fs.addTriFace(i, i + 1, i + 2);
    m.normals().computeNormals(); m.compact();
    const at = new rh.ObjectAttributes(); at.name = c.name; at.layerIndex = idx[c.layer] ?? 0; doc.objects().add(m, at);
  }
  const bytes = doc.toByteArray(); doc.delete();
  return new Blob([bytes], { type: 'application/octet-stream' });
}

// IFC4 with tessellated bodies: walls, slabs, windows, furniture and rooms as their IFC classes, everything else as proxies
export function ifc(model, name = 'PlotCloud model') {
  const A = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  const gid = () => { let s = A[Math.floor(Math.random() * 4)]; for (let i = 0; i < 21; i++) s += A[Math.floor(Math.random() * 64)]; return `'${s}'`; };
  const str = (s) => `'${String(s).replace(/'/g, "''").replace(/[^\x20-\x7e]/g, '_')}'`;
  const L = []; let n = 0; const e = (t) => { L.push(`#${++n}=${t};`); return `#${n}`; };
  const origin = e('IFCCARTESIANPOINT((0.,0.,0.))'), ax = e(`IFCAXIS2PLACEMENT3D(${origin},$,$)`);
  const ctx = e(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${ax},$)`), body = e(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${ctx},$,.MODEL_VIEW.,$)`);
  const units = e(`IFCUNITASSIGNMENT((${e('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)')},${e('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)')},${e('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)')}))`);
  const project = e(`IFCPROJECT(${gid()},$,${str(name)},$,$,$,$,(${ctx}),${units})`);
  const place = () => e(`IFCLOCALPLACEMENT($,${ax})`);
  const site = e(`IFCSITE(${gid()},$,'Site',$,$,${place()},$,$,.ELEMENT.,$,$,$,$,$)`), bldg = e(`IFCBUILDING(${gid()},$,'Building',$,$,${place()},$,$,.ELEMENT.,$,$,$)`), storey = e(`IFCBUILDINGSTOREY(${gid()},$,'Level 1',$,$,${place()},$,$,.ELEMENT.,0.)`);
  e(`IFCRELAGGREGATES(${gid()},$,$,$,${project},(${site}))`); e(`IFCRELAGGREGATES(${gid()},$,$,$,${site},(${bldg}))`); e(`IFCRELAGGREGATES(${gid()},$,$,$,${bldg},(${storey}))`);
  const contained = [], spaces = [];
  for (const { c, pos } of items(model)) {
    const pts = [], tri = []; for (let i = 0; i < pos.length; i += 3) pts.push(`(${f(pos[i])},${f(pos[i + 1])},${f(pos[i + 2])})`); for (let i = 0; i < pos.length / 3; i += 3) tri.push(`(${i + 1},${i + 2},${i + 3})`);
    const fs = e(`IFCTRIANGULATEDFACESET(${e(`IFCCARTESIANPOINTLIST3D((${pts.join(',')}))`)},$,$,(${tri.join(',')}),$)`);
    const shape = e(`IFCPRODUCTDEFINITIONSHAPE($,$,(${e(`IFCSHAPEREPRESENTATION(${body},'Body','Tessellation',(${fs}))`)}))`), pl = place(), nm = str(c.name), lay = str(c.layer);
    const cls = c.type === 'wall' ? `IFCWALL(${gid()},$,${nm},$,${lay},${pl},${shape},$,.NOTDEFINED.)` : c.type === 'slab' ? `IFCSLAB(${gid()},$,${nm},$,${lay},${pl},${shape},$,.FLOOR.)`
      : c.type === 'roof' ? `IFCSLAB(${gid()},$,${nm},$,${lay},${pl},${shape},$,.ROOF.)` : c.type === 'window' ? `IFCWINDOW(${gid()},$,${nm},$,${lay},${pl},${shape},$,$,$,.WINDOW.,.NOTDEFINED.,$)`
        : c.type === 'furniture' ? `IFCFURNITURE(${gid()},$,${nm},$,${lay},${pl},${shape},$,.NOTDEFINED.)` : c.type === 'room' ? `IFCSPACE(${gid()},$,${nm},$,${lay},${pl},${shape},$,.ELEMENT.,.INTERNAL.,$)`
          : `IFCBUILDINGELEMENTPROXY(${gid()},$,${nm},$,${lay},${pl},${shape},$,.NOTDEFINED.)`;
    (c.type === 'room' ? spaces : contained).push(e(cls));
  }
  if (contained.length) e(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${gid()},$,$,$,(${contained.join(',')}),${storey})`);
  if (spaces.length) e(`IFCRELAGGREGATES(${gid()},$,$,$,${storey},(${spaces.join(',')}))`);
  const head = `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [ReferenceView]'),'2;1');\nFILE_NAME(${str(name + '.ifc')},'${new Date().toISOString().slice(0, 19)}',(''),(''),'PlotCloud Workspace','PlotCloud Workspace','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n`;
  return new Blob([head + L.join('\n') + '\nENDSEC;\nEND-ISO-10303-21;\n'], { type: 'application/x-step' });
}

export const FORMATS = [
  ['png', 'PNG', 'The current view as an image'],
  ['3dm', 'Rhino (.3dm)', 'Meshes on their layers, metres'],
  ['dae', 'SketchUp (.dae)', 'Collada: SketchUp imports it directly'],
  ['obj', 'OBJ', 'Any 3D app, metres, Y up'],
  ['glb', 'glTF (.glb)', 'Web, Blender, game engines'],
  ['stl', 'STL', '3D printing, metres'],
  ['dxf', 'DXF', 'AutoCAD, 3D faces on layers'],
  ['ifc', 'IFC', 'Revit, Archicad and other BIM tools'],
];
export async function make(kind, model, name) {
  return kind === 'obj' ? obj(model) : kind === 'stl' ? stl(model) : kind === 'glb' ? glb(model) : kind === 'dxf' ? dxf(model) : kind === 'dae' ? dae(model) : kind === '3dm' ? rhino(model) : kind === 'ifc' ? ifc(model, name) : null;
}
