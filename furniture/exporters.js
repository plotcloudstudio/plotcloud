// Exporters. All geometry is in millimeters, Z up, origin at the bottom center.
import { partGeometry, triangles, isNurbsable } from './geom.js?v=furniture-detail-20261027-1';
import { materialColor } from './models.js?v=furniture-detail-20261027-1';
import { LANG } from './i18n.js';

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const f = (v) => (Math.round(v * 1000) / 1000).toString();
const safe = (s) => s.replace(/[^A-Za-z0-9_-]+/g, '_');

function prepared(parts, values) {
  return parts.map((p, i) => {
    const g = partGeometry(p);
    const t = triangles(g);
    g.dispose();
    return { p, i, name: `${safe(p.name)}_${String(i + 1).padStart(2, '0')}`, color: materialColor(p.mat, values), ...t };
  });
}

function matList(items) {
  const m = new Map();
  for (const it of items) if (!m.has(it.p.mat)) m.set(it.p.mat, it.color);
  return m;
}

// ---------- OBJ + MTL (Y up, the convention 3ds Max / Blender / D5 / Twinmotion expect) ----------
export function toOBJ(items, base) {
  const mats = matList(items);
  let mtl = '# PlotCloud\n';
  for (const [k, c] of mats) {
    const [r, g, b] = hexRgb(c).map((v) => (v / 255).toFixed(4));
    mtl += `newmtl ${k}\nKd ${r} ${g} ${b}\nKa 0 0 0\nKs 0.05 0.05 0.05\nd 1\nillum 2\n\n`;
  }
  const out = [`# PlotCloud furniture configurator\n# Units: millimeters. Y up. Origin: bottom center.\nmtllib ${base}.mtl\n`];
  let off = 1;
  for (const it of items) {
    out.push(`o ${it.name}\ng ${safe(it.p.layer)}\nusemtl ${it.p.mat}\n`);
    const v = [];
    for (let i = 0; i < it.pos.length; i += 3) v.push(`v ${f(it.pos[i])} ${f(it.pos[i + 2])} ${f(-it.pos[i + 1])}\n`);
    out.push(v.join(''));
    const fs = [];
    for (let i = 0; i < it.idx.length; i += 3) fs.push(`f ${it.idx[i] + off} ${it.idx[i + 1] + off} ${it.idx[i + 2] + off}\n`);
    out.push(fs.join(''));
    off += it.pos.length / 3;
  }
  return { obj: out.join(''), mtl };
}

// ---------- COLLADA (SketchUp: File › Import › COLLADA) ----------
export function toDAE(items, title) {
  const mats = matList(items);
  const now = new Date().toISOString();
  let effects = '', materials = '', geoms = '', nodes = '';
  for (const [k, c] of mats) {
    const [r, g, b] = hexRgb(c).map((v) => (v / 255).toFixed(4));
    effects += `<effect id="fx-${k}"><profile_COMMON><technique sid="common"><lambert><diffuse><color>${r} ${g} ${b} 1</color></diffuse></lambert></technique></profile_COMMON></effect>\n`;
    materials += `<material id="mat-${k}" name="${k}"><instance_effect url="#fx-${k}"/></material>\n`;
  }
  for (const it of items) {
    const id = `geo-${it.i}`;
    const n = it.pos.length;
    const pos = Array.from(it.pos, (v) => f(v)).join(' ');
    const tri = Array.from(it.idx).join(' ');
    geoms += `<geometry id="${id}" name="${it.name}"><mesh><source id="${id}-pos"><float_array id="${id}-pos-a" count="${n}">${pos}</float_array><technique_common><accessor source="#${id}-pos-a" count="${n / 3}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source><vertices id="${id}-v"><input semantic="POSITION" source="#${id}-pos"/></vertices><triangles count="${it.idx.length / 3}" material="m"><input semantic="VERTEX" source="#${id}-v" offset="0"/><p>${tri}</p></triangles></mesh></geometry>\n`;
    nodes += `<node id="n-${it.i}" name="${it.name}"><instance_geometry url="#${id}"><bind_material><technique_common><instance_material symbol="m" target="#mat-${it.p.mat}"/></technique_common></bind_material></instance_geometry></node>\n`;
  }
  return `<?xml version="1.0" encoding="utf-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
<asset><contributor><authoring_tool>PlotCloud configurator</authoring_tool></contributor><created>${now}</created><modified>${now}</modified><unit name="millimeter" meter="0.001"/><up_axis>Z_UP</up_axis></asset>
<library_effects>
${effects}</library_effects>
<library_materials>
${materials}</library_materials>
<library_geometries>
${geoms}</library_geometries>
<library_visual_scenes><visual_scene id="scene" name="scene"><node id="root" name="${safe(title)}">
${nodes}</node></visual_scene></library_visual_scenes>
<scene><instance_visual_scene url="#scene"/></scene>
</COLLADA>
`;
}

// ---------- DXF R12, 3DFACE per triangle (AutoCAD / Revit import) ----------
export function toDXF(items) {
  const layers = [...new Set(items.map((it) => safe(it.p.layer).toUpperCase()))];
  const L = [];
  const w = (code, val) => L.push(String(code), String(val));
  w(0, 'SECTION'); w(2, 'HEADER'); w(9, '$ACADVER'); w(1, 'AC1009'); w(9, '$INSUNITS'); w(70, 4); w(0, 'ENDSEC');
  w(0, 'SECTION'); w(2, 'TABLES');
  w(0, 'TABLE'); w(2, 'LTYPE'); w(70, 1); w(0, 'LTYPE'); w(2, 'CONTINUOUS'); w(70, 0); w(3, 'Solid line'); w(72, 65); w(73, 0); w(40, 0); w(0, 'ENDTAB');
  w(0, 'TABLE'); w(2, 'LAYER'); w(70, layers.length);
  layers.forEach((ln, i) => { w(0, 'LAYER'); w(2, ln); w(70, 0); w(62, (i % 7) + 1); w(6, 'CONTINUOUS'); });
  w(0, 'ENDTAB'); w(0, 'ENDSEC');
  w(0, 'SECTION'); w(2, 'ENTITIES');
  for (const it of items) {
    const ln = safe(it.p.layer).toUpperCase();
    for (let i = 0; i < it.idx.length; i += 3) {
      w(0, '3DFACE'); w(8, ln);
      const vs = [it.idx[i], it.idx[i + 1], it.idx[i + 2], it.idx[i + 2]];
      vs.forEach((vi, k) => { w(10 + k, f(it.pos[vi * 3])); w(20 + k, f(it.pos[vi * 3 + 1])); w(30 + k, f(it.pos[vi * 3 + 2])); });
    }
  }
  w(0, 'ENDSEC'); w(0, 'EOF');
  return L.join('\r\n') + '\r\n';
}

// ---------- binary STL ----------
export function toSTL(items) {
  let n = 0;
  for (const it of items) n += it.idx.length / 3;
  const buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
  const head = 'PlotCloud configurator, units mm';
  for (let i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i));
  dv.setUint32(80, n, true);
  let o = 84;
  for (const it of items) {
    const P = it.pos;
    for (let i = 0; i < it.idx.length; i += 3) {
      const a = it.idx[i] * 3, b = it.idx[i + 1] * 3, c = it.idx[i + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      for (const v of [nx, ny, nz]) { dv.setFloat32(o, v, true); o += 4; }
      for (const k of [a, b, c]) for (let j = 0; j < 3; j++) { dv.setFloat32(o, P[k + j], true); o += 4; }
      dv.setUint16(o, 0, true); o += 2;
    }
  }
  return new Uint8Array(buf);
}

// ---------- Rhino .3dm via rhino3dm (NURBS for plain boxes and cylinders, meshes for soft shapes) ----------
export function to3dm(rhino, items, title) {
  const doc = new rhino.File3dm();
  doc.settings().modelUnitSystem = rhino.UnitSystem.Millimeters;
  const layerIdx = new Map(), matIdx = new Map();
  let nurbs = 0, meshes = 0;
  for (const it of items) {
    const [r, g, b] = hexRgb(it.color);
    const col = { r, g, b, a: 255 };
    if (!layerIdx.has(it.p.layer)) {
      const ly = new rhino.Layer(); ly.name = it.p.layer; ly.color = col;
      layerIdx.set(it.p.layer, doc.layers().add(ly));
    }
    if (!matIdx.has(it.p.mat)) {
      const m = new rhino.Material(); m.name = it.p.mat; m.diffuseColor = col;
      doc.materials().add(m);
      matIdx.set(it.p.mat, doc.materials().count - 1);
    }
    const attr = new rhino.ObjectAttributes();
    attr.name = it.name;
    attr.layerIndex = layerIdx.get(it.p.layer);
    attr.colorSource = rhino.ObjectColorSource.ColorFromObject;
    attr.objectColor = col;
    attr.materialSource = rhino.ObjectMaterialSource.MaterialFromObject;
    attr.materialIndex = matIdx.get(it.p.mat);
    const p = it.p;
    let geo = null;
    if (isNurbsable(p)) {
      if (p.kind === 'prism') {
        try {
          const pl = new rhino.Polyline(0);
          for (const q of p.pts) pl.add(q[0], q[1], 0);
          pl.add(p.pts[0][0], p.pts[0][1], 0);
          const ex = rhino.Extrusion.create(pl.toPolylineCurve(), p.t, true);
          geo = ex ? ex.toBrep(true) : null;
          if (geo) {
            const bb = geo.getBoundingBox();
            geo.transform(rhino.Transform.translationXYZ(0, 0, -bb.min[2]));   // extrusion now spans z 0..t
            if (p.plane === 'xy') geo.transform(rhino.Transform.translationXYZ(0, 0, p.a0));
            else if (p.plane === 'xz') {
              geo.transform(rhino.Transform.rotation(Math.PI / 2, [1, 0, 0], [0, 0, 0]));
              geo.transform(rhino.Transform.translationXYZ(0, p.a0 + p.t, 0));
            } else {
              geo.transform(rhino.Transform.rotation(Math.PI / 2, [1, 0, 0], [0, 0, 0]));
              geo.transform(rhino.Transform.rotation(Math.PI / 2, [0, 0, 1], [0, 0, 0]));
              geo.transform(rhino.Transform.translationXYZ(p.a0, 0, 0));
            }
          }
        } catch (err) { geo = null; }
      } else if (p.kind === 'box') {
        const bb = new rhino.BoundingBox([-p.w / 2, -p.d / 2, -p.h / 2], [p.w / 2, p.d / 2, p.h / 2]);
        geo = rhino.Brep.createFromBox(new rhino.Box(bb));
        if (p.rotZ) geo.transform(rhino.Transform.rotation(p.rotZ, [0, 0, 1], [0, 0, 0]));
      } else {
        const cyl = new rhino.Cylinder(new rhino.Circle([0, 0, -p.h / 2], p.r), p.h);
        geo = rhino.Brep.createFromCylinder(cyl, true, true);
        if (p.axis === 'y') geo.transform(rhino.Transform.rotationVectors([0, 0, 1], [0, 1, 0], [0, 0, 0]));
      }
      if (geo) { geo.transform(rhino.Transform.translationXYZ(p.cx, p.cy, p.cz)); nurbs++; }
    }
    if (!geo) {
      geo = new rhino.Mesh();
      const vs = geo.vertices(), fs = geo.faces();
      for (let i = 0; i < it.pos.length; i += 3) vs.add(it.pos[i], it.pos[i + 1], it.pos[i + 2]);
      for (let i = 0; i < it.idx.length; i += 3) fs.addTriFace(it.idx[i], it.idx[i + 1], it.idx[i + 2]);
      geo.normals().computeNormals();
      geo.compact();
      meshes++;
    }
    doc.objects().add(geo, attr);
  }
  doc.settings().modelUrl = '';
  return { bytes: doc.toByteArray(), nurbs, meshes };
}

export const FORMATS = [
  { id: '3dm', label: 'Rhino', ext: '.3dm', note: '原生文件，按部件分图层' },
  { id: 'dae', label: 'SketchUp', ext: '.dae', note: '文件 › 导入 › COLLADA' },
  { id: 'obj', label: '3ds Max / Blender / D5', ext: '.obj', note: '附 .mtl 材质颜色' },
  { id: 'dxf', label: 'AutoCAD / Revit', ext: '.dxf', note: '3D 面，毫米' },
  { id: 'stl', label: '3D 打印 / 激光模型', ext: '.stl', note: '实体网格' },
];

export function readme(model, dims, values, report) {
  if (LANG === 'en') return [
    `PlotCloud furniture generator — ${model.en}`,
    `Size W×D×H: ${dims.W} × ${dims.D} × ${dims.H} mm`,
    'Units: millimeters. Origin: bottom center.',
    `Parameters: ${Object.entries(values).map(([k, v]) => `${k}=${v}`).join(', ')}`,
    '',
    'How to import',
    '- Rhino 7/8: open the .3dm. Plain boxes and cylinders are NURBS solids you can edit; rounded cushions and oval shapes are meshes.',
    '- SketchUp: File › Import › COLLADA (*.dae). It comes in as one component with each part grouped.',
    '- 3ds Max: import the .obj. Keep "Flip ZY-axis" ticked and set units to millimeters.',
    '- Blender / D5 Render / Twinmotion / Enscape: import the .obj (Y up, millimeters).',
    '- AutoCAD: open the .dxf (3D faces). Revit: Insert › Import CAD, units millimeters.',
    '- 3D printing / laser-cut model prep: .stl.',
    '',
    'Why there is no native .skp / .max / .dwg',
    'These are closed formats a browser cannot write. A later version will convert them on the server with the official SDKs.',
    '',
    report ? `Rhino file: ${report.nurbs} NURBS solids, ${report.meshes} meshes.` : '',
    'Generated from parameters by PlotCloud. Free to use in coursework and portfolios.',
  ].join('\r\n');
  const lines = [
    `PlotCloud 家具生成器 — ${model.name} ${model.en}`,
    `尺寸 W×D×H: ${dims.W} × ${dims.D} × ${dims.H} mm`,
    `单位: 毫米。原点: 底面中心。`,
    `参数: ${Object.entries(values).map(([k, v]) => `${k}=${v}`).join(', ')}`,
    '',
    '怎么导入',
    '- Rhino 7/8: 直接打开 .3dm。方块和圆柱是 NURBS 实体，可直接编辑；圆角软包和椭圆形是网格。',
    '- SketchUp: 文件 › 导入 › 选择 COLLADA (*.dae)。导入后是一个组件，部件各自成组。',
    '- 3ds Max: 导入 .obj。导入窗口里保持 Flip ZY-axis 勾选，单位选毫米。',
    '- Blender / D5 Render / Twinmotion / Enscape: 导入 .obj（Y 轴向上，毫米）。',
    '- AutoCAD: 打开 .dxf（三维面）。Revit: 插入 › 导入 CAD，单位选毫米。',
    '- 3D 打印 / 激光切割前建模: .stl。',
    '',
    '为什么没有 .skp / .max / .dwg 原生文件',
    '这三种是私有格式，浏览器里无法写出。上线版本会在服务器上用官方 SDK 转换。',
    '',
    report ? `Rhino 文件: ${report.nurbs} 个 NURBS 实体, ${report.meshes} 个网格。` : '',
    '模型由 PlotCloud 参数生成，可自由用于课程作业和作品集。',
  ];
  return lines.join('\r\n');
}

export function buildFiles({ model, parts, dims, values, formats, rhino }) {
  const items = prepared(parts, values);
  const base = `PlotCloud_${safe(model.en)}_${dims.W}x${dims.D}x${dims.H}`;
  const files = {};
  let report = null;
  if (formats.includes('3dm') && rhino) { report = to3dm(rhino, items, base); files[base + '.3dm'] = report.bytes; }
  if (formats.includes('dae')) files[base + '.dae'] = toDAE(items, base);
  if (formats.includes('obj')) { const o = toOBJ(items, base); files[base + '.obj'] = o.obj; files[base + '.mtl'] = o.mtl; }
  if (formats.includes('dxf')) files[base + '.dxf'] = toDXF(items);
  if (formats.includes('stl')) files[base + '.stl'] = toSTL(items);
  files['README.txt'] = readme(model, dims, values, report);
  return { base, files, report };
}
