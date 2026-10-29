// Workspace v2 viewport. Same scene, materials and picking rules as viewport.js (used by the archived Workspace,
// which stays untouched). On the same geometry it adds:
//   display modes that only change materials (Shaded / Ghosted / Wireframe);
//   cameras: perspective, plan per level (cut 1.2 m above it), front elevation, interior elevation of one wall, walkthrough at eye height;
//   Plan Studio's exploded view (storeys pulled apart along Z, display only);
//   Rhino-style selection (left-drag box: left→right window, right→left crossing; Shift adds, Ctrl removes; right-drag orbits)
//   and Revit-style Tab cycling through the objects under the cursor.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { furnMesh } from './furn3d.js';

const LOOK = {
  day: { clear: 0x9ca2af, grid: [0xc4c8d2, 0xb3b8c4], solid: 0xe9ecf2, ctx: 0xd5d9e2, edge: 0x2b2f38, ctxEdge: 0.4, hemi: [0xffffff, 0x8a90a0, 2.4] },
};
const look = () => LOOK.day;
// Shaded and Ghosted use Plan Studio's warm model colours (beige walls, light timber, pale blue glass), by material first, then by type.
const SHADE_MAT = { Plaster: 0xece4d6, Gypsum: 0xefe9df, Concrete: 0xdcd5c9, Timber: 0xd9c4a0, Carpet: 0xb9a58e, 'Acoustic panel': 0xcdbfa6, Glass: 0x9ec3dc, Grass: 0xc5cfae, Context: 0xd6d2ca, Imported: 0xe2ddd3 };
const SHADE_TYPE = { wall: 0xece4d6, slab: 0xd9cdb8, roof: 0xe3ddd2, window: 0x9ec3dc, furniture: 0xd9c4a0, mass: 0xd6d2ca, terrain: 0xc5cfae, imported: 0xe2ddd3, room: 0xe8b04a };
const shadeOf = (c) => (c.type === 'room' ? 0xe8b04a : c.type === 'window' ? 0x9ec3dc : SHADE_MAT[c.mat] ?? SHADE_TYPE[c.type] ?? 0xe2ddd3);
export const EYE = 1.6, CUT = 1.2;
const SEL_COL = 0xd8402a, HOVER_COL = 0x2f7ad8;

// Levels come from the model: the top of every slab is a floor level. A model with no slab has one level at z = 0.
export function levelsOf(model) {
  const tops = [...new Set((model?.components || []).filter((c) => c.type === 'slab').map((c) => +(c.g.z + c.g.h).toFixed(2)))].sort((a, b) => a - b);
  return (tops.length ? tops : [0]).map((z, i) => ({ n: i + 1, z, from: tops.length ? 'slab' : 'none' }));
}
// Storeys for the exploded view: one band per level, plus a roof band for roofs; site and context stay on the ground.
export function bandsOf(model) {
  const lv = levelsOf(model), bands = lv.map((l) => ({ name: `Level ${l.n}`, z: l.z, ids: [] })), roof = { name: 'Roof', ids: [] };
  for (const c of model.components) {
    if (c.type === 'terrain' || c.type === 'mass') continue;
    if (c.type === 'roof') { roof.ids.push(c.id); continue; }
    let k = 0; for (let i = 0; i < lv.length; i++) if (c.g.z + Math.max(c.g.h, 0.01) / 2 >= lv[i].z - 0.05) k = i;
    bands[k].ids.push(c.id);
  }
  return roof.ids.length ? [...bands, roof] : bands;
}
// A wall's two faces, and the room on a given side of it: what an interior elevation looks at.
export function wallFrame(model, c, side) {
  const alongX = c.g.w >= c.g.d, n = alongX ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const s0 = alongX ? c.g.y : c.g.x, s1 = alongX ? c.g.y + c.g.d : c.g.x + c.g.w, face = side > 0 ? s1 : s0, t = s1 - s0;
  const u0 = alongX ? c.g.x : c.g.y, u1 = alongX ? c.g.x + c.g.w : c.g.y + c.g.d, mid = (u0 + u1) / 2, probe = face + side * 0.3;
  const room = model.components.find((r) => r.type === 'room' && (alongX ? (probe >= r.g.y && probe <= r.g.y + r.g.d && mid >= r.g.x && mid <= r.g.x + r.g.w) : (probe >= r.g.x && probe <= r.g.x + r.g.w && mid >= r.g.y && mid <= r.g.y + r.g.d)) && Math.abs(r.g.z - c.g.z) < 0.6);
  let depth = 5, a0 = u0, a1 = u1, z0 = c.g.z, z1 = c.g.z + c.g.h;
  if (room) { const r0 = alongX ? room.g.y : room.g.x, r1 = alongX ? room.g.y + room.g.d : room.g.x + room.g.w; depth = side > 0 ? r1 - face : face - r0; a0 = alongX ? room.g.x : room.g.y; a1 = alongX ? room.g.x + room.g.w : room.g.y + room.g.d; z0 = room.g.z; z1 = room.g.z + room.g.h; }
  return { alongX, n, face, t, u0: a0, u1: a1, z0, z1, depth: Math.max(0.5, depth), room };
}

export function createViewport2(host, { onPick, onBox, onHover, onPlace, onFrame, canDrag, onDrag, onCam } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.setClearColor(look().clear, 1); renderer.localClippingEnabled = true; host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const persp = new THREE.PerspectiveCamera(35, 1, 0.05, 2000); persp.up.set(0, 0, 1);
  const walkCam = new THREE.PerspectiveCamera(60, 1, 0.05, 2000); walkCam.up.set(0, 0, 1);
  const plan = new THREE.OrthographicCamera(-10, 10, 10, -10, -100, 500); plan.up.set(0, 1, 0);
  const elev = new THREE.OrthographicCamera(-10, 10, 10, -10, -500, 500); elev.up.set(0, 0, 1);
  const iel = new THREE.OrthographicCamera(-10, 10, 10, -10, -500, 500); iel.up.set(0, 0, 1);
  let camera = persp;
  const controls = new OrbitControls(persp, renderer.domElement); controls.maxPolarAngle = Math.PI * 0.495;
  controls.mouseButtons = { LEFT: -1, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };   // as in Rhino: left selects, right orbits, Shift+right or middle pans
  const hemi = new THREE.HemisphereLight(...look().hemi); hemi.position.set(0, 0, 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-0.5, -0.35, 1); scene.add(sun);
  let grid = null; const makeGrid = () => { if (grid) { scene.remove(grid); grid.geometry.dispose(); } grid = new THREE.GridHelper(120, 60, ...look().grid); grid.rotation.x = Math.PI / 2; grid.position.z = -0.32; scene.add(grid); }; makeGrid();
  const root = new THREE.Group(); scene.add(root);
  const clrGroup = new THREE.Group(); scene.add(clrGroup); let clrRects = [];
  let model = null, display = 'shaded', view = { kind: 'persp', level: 1 }, selected = new Set(), hover = null, objects = new Map(), bounds = new THREE.Box3(), clip = [];
  const walk = { yaw: Math.PI / 2, pitch: 0, pos: new THREE.Vector3() };
  const xpl = { on: false, d: 1.5, labels: true, bands: [] };
  const labelBox = document.createElement('div'); labelBox.className = 'w2-xlabels'; host.appendChild(labelBox);
  // placing a piece: a ghost box on the floor follows the cursor (snapped to 5 cm); a click places it
  const ghost = new THREE.Group(); ghost.visible = false; scene.add(ghost); let placing = null;
  function setPlacing(dims) {
    for (const o of [...ghost.children]) { ghost.remove(o); o.geometry.dispose(); o.material.dispose(); }
    placing = dims || null; ghost.visible = false; if (!placing) { render(); return; }
    const g = new THREE.BoxGeometry(dims.w, dims.d, dims.h); g.translate(0, 0, dims.h / 2);
    ghost.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: SEL_COL, transparent: true, opacity: 0.18, depthWrite: false })), new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: SEL_COL })));
  }
  function floorAt(x, y, step = 0.05) {
    const lv = levelsOf(model), L = lv.find((q) => q.n === view.level) || lv[0], ray = new THREE.Raycaster(); ray.setFromCamera(ndc(x, y), camera);
    const pt = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -L.z), new THREE.Vector3()); if (!pt) return null;
    const sn = (v) => (step ? Math.round(v / step) * step : v); return { x: +sn(pt.x).toFixed(3), y: +sn(pt.y).toFixed(3), z: L.z };
  }
  const boxEl = document.createElement('div'); boxEl.className = 'w2-box'; boxEl.hidden = true; host.appendChild(boxEl);

  function geometryOf(c) {
    const k = c.furn && furnMesh(c);
    if (k) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(k.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(k.col, 3)); g.computeVertexNormals(); return g; }   // Plan Studio furniture, part colours
    if (c.mesh) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(c.mesh, 3)); if (c.meshCol) g.setAttribute('color', new THREE.Float32BufferAttribute(c.meshCol, 3)); g.computeVertexNormals(); return g; }   // meshCol: Plan Studio's own part colours (Workspace panes)
    const g = new THREE.BoxGeometry(c.g.w, c.g.d, c.g.h); g.translate(c.g.w / 2, c.g.d / 2, c.g.h / 2); return g;
  }
  const TINT = { map: new Map(), neutral: false };   // compare views: a colour per changed component, the rest grey (Highlight only)
  const kindOf = (c) => (c.ghostWire ? 'ghost' : c.type === 'room' ? 'room' : c.type === 'window' || c.glass ? 'glass' : c.type === 'mass' || c.type === 'terrain' ? 'ctx' : 'solid');
  // display modes: only material properties change, the scene is not rebuilt
  function paint(grp) {
    const k = grp.userData.kind, face = grp.userData.face, edges = grp.userData.edges, L = look(), fm = face.material, em = edges.material;
    const ghost = display === 'ghosted', wire = display === 'wire';
    const op = wire ? 0 : ghost ? 0.5 : k === 'room' ? 0 : k === 'glass' ? 0.45 : 1;
    const vc = grp.userData.vc && !wire; fm.vertexColors = vc; fm.color.setHex(wire ? grp.userData.themeColor : vc ? 0xffffff : grp.userData.shadeColor);
    em.color.setHex(display === 'shaded' && k !== 'room' ? 0x4a453d : k === 'room' ? 0xe8b04a : L.edge);
    fm.opacity = op; fm.transparent = op < 1; fm.depthWrite = op === 1; fm.colorWrite = op > 0;
    const eo = k === 'room' ? (display === 'shaded' ? 0 : 1) : display === 'shaded' ? 0.45 : k === 'ctx' ? Math.max(L.ctxEdge, wire ? 0.6 : 0) : 0.9;
    em.opacity = eo; em.visible = eo > 0;
    const tn = TINT.map.get(grp.userData.id);
    if (k === 'ghost') { fm.opacity = 0; fm.transparent = true; fm.depthWrite = false; fm.colorWrite = false; em.color.setHex(grp.userData.c.ghostWire); em.opacity = 1; em.visible = true; em.depthTest = false; edges.renderOrder = 12; }
    else if (tn != null || TINT.neutral) { fm.vertexColors = false; fm.color.setHex(tn ?? 0xc9c9c6); if (tn != null && !wire) { fm.opacity = ghost ? 0.75 : 1; fm.transparent = fm.opacity < 1; fm.depthWrite = fm.opacity === 1; fm.colorWrite = true; em.color.setHex(0x3a3324); em.opacity = 0.9; em.visible = true; } }
    fm.clippingPlanes = clip; em.clippingPlanes = clip; fm.needsUpdate = true; em.needsUpdate = true;
    for (const nm of ['sel', 'hov']) { const o = grp.getObjectByName(nm); if (o) { o.material.clippingPlanes = clip; o.material.needsUpdate = true; } }
  }
  function build() {
    const keep = new Map(); for (const [id, g] of objects) if (g.userData.c?.sig) keep.set(id, g);
    for (const o of [...root.children]) { root.remove(o); if (!keep.has(o.userData.id) || keep.get(o.userData.id) !== o) o.traverse((m) => { m.geometry?.dispose(); m.material?.dispose?.(); }); }
    objects.clear(); bounds.makeEmpty(); if (!model) { for (const g of keep.values()) g.traverse((m) => { m.geometry?.dispose(); m.material?.dispose?.(); }); return; }
    const vis = new Map(model.layers.map((l) => [l.name, l.visible])), L = look(), used = new Set();
    for (const c of model.components) {
      if (vis.get(c.layer) === false) continue;
      const old = c.sig && keep.get(c.id);
      if (old && old.userData.c.sig === c.sig) { used.add(c.id); old.position.set(c.g.x, c.g.y, c.g.z); old.userData.c = c; root.add(old); objects.set(c.id, old); paint(old); if (old.userData.kind !== 'ctx') bounds.expandByObject(old); continue; }
      const geo = geometryOf(c), grp = new THREE.Group(); grp.position.set(c.g.x, c.g.y, c.g.z); grp.userData.id = c.id;
      const k = kindOf(c);
      const face = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: k === 'glass' ? 0xcfe0f2 : k === 'room' ? 0xe8b04a : k === 'ctx' ? L.ctx : L.solid, roughness: 0.5 }));
      face.userData.id = c.id;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, c.furn ? 40 : 25), new THREE.LineBasicMaterial({ color: k === 'room' ? 0xe8b04a : L.edge, transparent: true }));
      grp.add(face, edges); Object.assign(grp.userData, { kind: k, face, edges, c, vc: !!geo.attributes.color, shadeColor: shadeOf(c), themeColor: face.material.color.getHex() });
      root.add(grp); objects.set(c.id, grp); paint(grp);
      if (k !== 'ctx') bounds.expandByObject(grp);
    }
    for (const [id, g] of keep) if (!used.has(id)) g.traverse((m) => { m.geometry?.dispose(); m.material?.dispose?.(); });
    if (bounds.isEmpty()) for (const g of objects.values()) bounds.expandByObject(g);
    applyExplode(); highlight();
  }
  // clearance hint: a dashed red outline on the floor round each piece (footprint + the free space it wants), as in Plan Studio
  function drawClearance() {
    for (const o of [...clrGroup.children]) { clrGroup.remove(o); o.geometry.dispose(); o.material.dispose(); }
    if (xpl.on) return;
    for (const r of clrRects) {
      if (r.pts) {   // a turned piece: its outline as it stands (Workspace panes)
        const z = r.z + 0.02, P = [...r.pts, r.pts[0]].map(([x, y]) => new THREE.Vector3(x, y, z));
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(P), new THREE.LineDashedMaterial({ color: 0xd8402a, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0.95, clippingPlanes: clip }));
        line.computeLineDistances(); line.renderOrder = 11; clrGroup.add(line);
        const sh = new THREE.Shape(r.pts.map(([x, y]) => new THREE.Vector2(x, y))), fill = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: 0xd8402a, transparent: true, opacity: 0.08, depthWrite: false, clippingPlanes: clip, side: THREE.DoubleSide }));
        fill.position.z = z; clrGroup.add(fill); continue;
      }
      const z = r.z + 0.02, pts = [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1], [r.x0, r.y0]].map(([x, y]) => new THREE.Vector3(x, y, z));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xd8402a, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0.95, clippingPlanes: clip }));
      line.computeLineDistances(); line.renderOrder = 11; clrGroup.add(line);
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.y1 - r.y0), new THREE.MeshBasicMaterial({ color: 0xd8402a, transparent: true, opacity: 0.08, depthWrite: false, clippingPlanes: clip }));
      fill.position.set((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, z); clrGroup.add(fill);
    }
  }
  function outline(grp, name, color) {
    const old = grp.getObjectByName(name); if (old) { grp.remove(old); old.geometry.dispose(); old.material.dispose(); }
    if (!color) return; const e = new THREE.LineSegments(new THREE.EdgesGeometry(grp.userData.face.geometry, 25), new THREE.LineBasicMaterial({ color, depthTest: false, clippingPlanes: clip, linewidth: 2 }));
    e.name = name; e.renderOrder = name === 'sel' ? 10 : 9; grp.add(e);
  }
  function highlight() {
    for (const [id, grp] of objects) {
      const on = selected.has(id), f = grp.userData.face; if (f.material.emissive) f.material.emissive.setHex(on ? 0x6b2a1a : id === hover ? 0x12304f : 0x000000);
      outline(grp, 'sel', on ? SEL_COL : 0); outline(grp, 'hov', !on && id === hover ? HOVER_COL : 0);
    }
    render();
  }
  const box = () => (bounds.isEmpty() ? new THREE.Box3(new THREE.Vector3(-5, -5, 0), new THREE.Vector3(5, 5, 3)) : bounds);
  function fit() {
    const b = box(), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
    const hr = host.getBoundingClientRect(), asp = hr.width > 2 && hr.height > 2 ? hr.width / hr.height : 1.5;   // a narrow view (a Workspace pane) stands further back
    const k = Math.hypot(s.x, s.y, s.z + (xpl.on ? xpl.d * (xpl.bands.length - 1) : 0)) * 1.6 / Math.hypot(0.55, 0.62, 1) * Math.max(1, 1.25 / asp);
    persp.position.set(c.x - 0.55 * k, c.y - 1 * k, c.z + 0.62 * k); controls.target.set(c.x, c.y, c.z * 0.5 + (xpl.on ? xpl.d * (xpl.bands.length - 1) / 2 : 0)); persp.far = k * 50; persp.updateProjectionMatrix(); controls.update();
    plan.position.set(c.x, c.y, 200); plan.lookAt(c.x, c.y, 0); plan.userData.span = Math.max(s.x, s.y, 4) * 0.62;
    elev.position.set(c.x, b.min.y - 100, c.z); elev.lookAt(c.x, b.min.y, c.z); elev.userData.span = Math.max(s.z, s.x * 0.6, 3);
    size(); render();
  }
  function size() {
    const r = host.getBoundingClientRect(); if (r.width < 2) return; renderer.setSize(r.width, r.height, false); const a = r.width / r.height;
    for (const p of [persp, walkCam]) { p.aspect = a; p.updateProjectionMatrix(); }
    if (iel.userData.fit) { const F = iel.userData.fit; iel.userData.span = Math.max((F.h / 2) * 1.2, (F.w / 2) / a * 1.12); iel.userData.fit = null; }
    for (const o of [plan, elev, iel]) { const s = o.userData.span || 10; o.left = -s * a; o.right = s * a; o.top = s; o.bottom = -s; o.updateProjectionMatrix(); }
  }
  function aimWalk() { const d = new THREE.Vector3(Math.cos(walk.pitch) * Math.cos(walk.yaw), Math.cos(walk.pitch) * Math.sin(walk.yaw), Math.sin(walk.pitch)); walkCam.position.copy(walk.pos); walkCam.lookAt(walk.pos.clone().add(d)); }
  function labels() {
    labelBox.innerHTML = ''; if (!xpl.on || !xpl.labels || camera !== persp) return;
    const r = host.getBoundingClientRect();
    xpl.bands.forEach((b, i) => { const bb = new THREE.Box3(); for (const id of b.ids) { const g = objects.get(id); if (g) bb.expandByObject(g); } if (bb.isEmpty()) return;
      const p = new THREE.Vector3(bb.min.x, bb.min.y, bb.max.z).project(camera); if (p.z > 1) return;
      const d = document.createElement('span'); d.textContent = b.name; d.style.left = ((p.x + 1) / 2 * r.width) + 'px'; d.style.top = ((1 - p.y) / 2 * r.height) + 'px'; labelBox.appendChild(d); void i; });
  }
  function render() { if (camera === walkCam) aimWalk(); renderer.render(scene, camera); labels(); onFrame?.(); }
  let camQuiet = false; const camChanged = () => { if (!camQuiet && onCam) onCam(); };
  controls.addEventListener('change', () => { render(); camChanged(); });

  function applyExplode() {
    xpl.bands = model ? bandsOf(model) : [];
    const off = new Map(); xpl.bands.forEach((b, i) => b.ids.forEach((id) => off.set(id, xpl.on ? i * xpl.d : 0)));
    for (const [id, g] of objects) g.position.z = g.userData.c.g.z + (off.get(id) || 0);
  }
  function setView(v) {
    view = { ...view, ...v }; const lv = levelsOf(model), L = lv.find((x) => x.n === view.level) || lv[0];
    clip = [];
    if (view.kind === 'plan') { clip = [new THREE.Plane(new THREE.Vector3(0, 0, -1), L.z + CUT)]; if (L.n > 1) clip.push(new THREE.Plane(new THREE.Vector3(0, 0, 1), -(L.z - 0.35))); camera = plan; }
    else if (view.kind === 'elev') camera = elev;
    else if (view.kind === 'ielev' && model) {
      const c = model.components.find((x) => x.id === view.wall), sd = view.side || 1;
      if (!c) { view.kind = 'persp'; camera = persp; }
      else {
        const F = wallFrame(model, c, sd), n = F.n, U = F.alongX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        // keep: the room in front of the wall face (up to its far side), the wall itself, the room's width and height
        clip = [new THREE.Plane(n.clone().multiplyScalar(-sd), sd * F.face + F.depth - 0.03), new THREE.Plane(n.clone().multiplyScalar(sd), -sd * F.face + F.t + 0.02),
          new THREE.Plane(U.clone(), -(F.u0 - 0.05)), new THREE.Plane(U.clone().negate(), F.u1 + 0.05), new THREE.Plane(new THREE.Vector3(0, 0, -1), F.z1 + 0.35), new THREE.Plane(new THREE.Vector3(0, 0, 1), -(F.z0 - 0.35))];
        const mid = (F.u0 + F.u1) / 2, zc = (F.z0 + F.z1) / 2, at = F.alongX ? new THREE.Vector3(mid, F.face, zc) : new THREE.Vector3(F.face, mid, zc);
        iel.position.copy(at).addScaledVector(n, sd * 100); iel.lookAt(at); iel.userData.fit = { w: F.u1 - F.u0 + 0.4, h: F.z1 - F.z0 + 0.8 }; view.frame = { from: F.room?.name || null, length: Math.max(c.g.w, c.g.d) };
        camera = iel;
      }
    }
    else if (view.kind === 'walk') {
      const room = model?.components.find((c) => c.type === 'room' && Math.abs(c.g.z - L.z) < 0.5), b = box(), c = b.getCenter(new THREE.Vector3());
      walk.pos.set(room ? room.g.x + room.g.w / 2 : c.x, room ? room.g.y + room.g.d / 2 : c.y, L.z + EYE); walk.yaw = Math.PI / 2; walk.pitch = 0; camera = walkCam;
    } else camera = persp;
    controls.enabled = camera === persp;
    for (const g of objects.values()) paint(g); drawClearance(); size(); render();
  }
  const ro = new ResizeObserver(() => { size(); render(); }); ro.observe(host);

  // ---- picking: every selectable object under a screen point, nearest first (locked layers and anything cut away are skipped)
  const el = renderer.domElement;
  const ndc = (x, y) => { const r = el.getBoundingClientRect(); return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); };
  const lockedSet = () => new Set(model.layers.filter((l) => l.locked).map((l) => l.name));
  const kept = (pt) => clip.every((pl) => pl.distanceToPoint(pt) >= -1e-3);
  function candidatesAt(x, y) {
    if (!model || xpl.on) return [];
    if (camera === plan) {   // plan: pick by footprint below the cut, as on a drawing
      const ray = new THREE.Raycaster(); ray.setFromCamera(ndc(x, y), camera); const o = ray.ray.origin, locked = lockedSet(), cut = clip[0] ? clip[0].constant : Infinity, low = clip[1] ? -clip[1].constant : -Infinity, hits = [];
      for (const [id, g] of objects) { const c = g.userData.c; if (locked.has(c.layer)) continue; const bb = new THREE.Box3().setFromObject(g.userData.face);
        if (bb.min.z > cut - 1e-3 || bb.max.z < low) continue; if (o.x < bb.min.x - 0.03 || o.x > bb.max.x + 0.03 || o.y < bb.min.y - 0.03 || o.y > bb.max.y + 0.03) continue;
        hits.push({ id, rank: c.type === 'room' ? 1 : c.type === 'slab' || c.type === 'terrain' ? 2 : 0, top: Math.min(bb.max.z, cut), area: (bb.max.x - bb.min.x) * (bb.max.y - bb.min.y) }); }
      return hits.sort((a, b) => a.rank - b.rank || b.top - a.top || a.area - b.area).map((h) => h.id);   // solids first, then rooms, then floors
    }
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc(x, y), camera); const locked = lockedSet(), seen = new Set(), out = [];
    for (const h of ray.intersectObjects([...objects.values()].map((g) => g.userData.face), false)) { const c = objects.get(h.object.userData.id)?.userData.c; if (!c || seen.has(c.id) || locked.has(c.layer) || !kept(h.point)) continue; seen.add(c.id); out.push(c.id); }
    return out;
  }
  // Tab state (Revit): the candidates under the cursor and which one is pre-highlighted
  let cand = [], ci = 0, over = false, last = null;
  function setHover(id) { if (hover === id) return; hover = id; highlight(); }
  function announce() { onHover?.(cand.length ? { id: cand[ci], index: ci, count: cand.length, name: objects.get(cand[ci])?.userData.c.name } : null); }
  function refreshCand(x, y) { const next = candidatesAt(x, y); if (next.join() !== cand.join()) { cand = next; ci = 0; } setHover(cand[ci] ?? null); announce(); }

  // ---- pointer: left = click / box select, right = orbit (perspective) or pan (orthographic); walkthrough: left drag looks around
  let drag = null;
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, b: e.button, moved: false }; try { el.setPointerCapture(e.pointerId); } catch (er) { }
    // plan: pressing on a movable piece and dragging moves it (as in Plan Studio)
    if (e.button === 0 && camera === plan && !placing && !xpl.on && canDrag) { const id = candidatesAt(e.clientX, e.clientY)[0]; if (id && canDrag(id)) { const f = floorAt(e.clientX, e.clientY, 0), c = objects.get(id).userData.c; drag.move = { id, off: { x: f.x - c.g.x, y: f.y - c.g.y } }; } }
  });
  el.addEventListener('pointermove', (e) => {
    over = true; last = { x: e.clientX, y: e.clientY };
    if (placing && (!drag || drag.b === 0)) { const f = floorAt(e.clientX, e.clientY); ghost.visible = !!f; if (f) ghost.position.set(f.x, f.y, f.z); setHover(null); render(); if (!drag) return; }
    if (!drag || !e.buttons) { refreshCand(e.clientX, e.clientY); return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) drag.moved = true; if (!drag.moved) return;
    const r = host.getBoundingClientRect();
    if (drag.move) { const f = floorAt(e.clientX, e.clientY, 0); if (f) { const nx = Math.round((f.x - drag.move.off.x) / 0.01) * 0.01, ny = Math.round((f.y - drag.move.off.y) / 0.01) * 0.01; onDrag?.(drag.move.id, +nx.toFixed(2), +ny.toFixed(2), 'move'); } drag.x = e.clientX; drag.y = e.clientY; return; }
    if (camera === walkCam) { walk.yaw -= dx * 0.005; walk.pitch = Math.max(-1.2, Math.min(1.2, walk.pitch - dy * 0.005)); }
    else if (drag.b === 0 && !xpl.on && !placing) {   // selection box
      const x0 = Math.min(drag.sx, e.clientX) - r.left, y0 = Math.min(drag.sy, e.clientY) - r.top, w = Math.abs(e.clientX - drag.sx), h = Math.abs(e.clientY - drag.sy);
      Object.assign(boxEl.style, { left: x0 + 'px', top: y0 + 'px', width: w + 'px', height: h + 'px' }); boxEl.hidden = false; boxEl.classList.toggle('cross', e.clientX < drag.sx); setHover(null);
    } else if (camera !== persp) { const s = camera.userData.span * 2 / r.height; if (camera === plan) { plan.position.x -= dx * s; plan.position.y += dy * s; camChanged(); } else { const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); camera.position.addScaledVector(right, -dx * s); camera.position.z += dy * s; } }
    else return;
    drag.x = e.clientX; drag.y = e.clientY; render();
  });
  el.addEventListener('pointerleave', () => { over = false; cand = []; ghost.visible = false; setHover(null); announce(); });
  el.addEventListener('wheel', (e) => {
    if (camera === persp) return; e.preventDefault();
    if (camera === walkCam) { const step = -Math.sign(e.deltaY) * 0.6; walk.pos.x += Math.cos(walk.yaw) * step; walk.pos.y += Math.sin(walk.yaw) * step; }
    else { camera.userData.span *= Math.exp(e.deltaY * 0.001); size(); camChanged(); }
    render();
  }, { passive: false });
  const mods = (e) => ({ add: e.shiftKey, remove: e.ctrlKey || e.metaKey });
  el.addEventListener('pointerup', (e) => {
    if (!drag) return; const d = drag; drag = null;
    if (d.move && d.moved) { onDrag?.(d.move.id, null, null, 'end'); return; }
    if (d.b !== 0 || xpl.on) return;
    if (placing) { if (!d.moved) { const f = floorAt(e.clientX, e.clientY); if (f) onPlace?.(f); } return; }
    if (!d.moved) { const id = cand.length ? cand[ci] : (candidatesAt(e.clientX, e.clientY)[0] ?? null); onPick?.(id, mods(e)); return; }
    if (camera === walkCam || boxEl.hidden) return;
    boxEl.hidden = true;
    const r = el.getBoundingClientRect(), x0 = Math.min(d.sx, e.clientX) - r.left, x1 = Math.max(d.sx, e.clientX) - r.left, y0 = Math.min(d.sy, e.clientY) - r.top, y1 = Math.max(d.sy, e.clientY) - r.top;
    const crossing = e.clientX < d.sx, locked = lockedSet(), out = [];
    for (const [id, g] of objects) {
      const c = g.userData.c; if (locked.has(c.layer)) continue;
      const bb = new THREE.Box3().setFromObject(g.userData.face), pts = [];
      for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z]) { const p = new THREE.Vector3(X, Y, Z); if (!kept(p)) continue; const q = p.clone().project(camera); if (q.z > 1 || q.z < -1) continue; pts.push([(q.x + 1) / 2 * r.width, (1 - q.y) / 2 * r.height]); }
      if (!pts.length) continue;
      const inside = pts.every(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
      const px0 = Math.min(...pts.map((p) => p[0])), px1 = Math.max(...pts.map((p) => p[0])), py0 = Math.min(...pts.map((p) => p[1])), py1 = Math.max(...pts.map((p) => p[1]));
      const touch = px0 <= x1 && px1 >= x0 && py0 <= y1 && py1 >= y0;
      if (crossing ? touch : inside) out.push(id);
    }
    onBox?.(out, { ...mods(e), crossing });
  });
  // Tab / Shift+Tab while the cursor is over the model: next / previous object under the cursor
  const onKey = (e) => { if (e.key !== 'Tab' || !over || !cand.length || e.target.closest?.('input,select,textarea')) return; e.preventDefault(); ci = (ci + (e.shiftKey ? cand.length - 1 : 1)) % cand.length; setHover(cand[ci]); announce(); };
  addEventListener('keydown', onKey, true);

  return {
    setModel(m, { refit = false } = {}) { model = m; build(); if (refit) fit(); setView({}); if (last && over) refreshCand(last.x, last.y); },
    setDisplay(d) { display = d; for (const g of objects.values()) paint(g); render(); },
    setView, get view() { return view; }, get display() { return display; },
    select(ids) { selected = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean)); highlight(); },
    setPlacing, floorAt, get placing() { return placing; },
    // move one object without rebuilding the scene (dragging); the page updates the model
    moveObject(id, x, y) { const g = objects.get(id); if (!g) return; g.position.x = x; g.position.y = y; render(); },
    toScreen(x, y, z = 0) { const r = el.getBoundingClientRect(), q = new THREE.Vector3(x, y, z).project(camera); return [(q.x + 1) / 2 * r.width, (1 - q.y) / 2 * r.height]; },
    pxPerMetre() { if (camera !== plan) return null; const r = el.getBoundingClientRect(); return r.height / (2 * plan.userData.span); },
    setClearance(rects) { clrRects = rects || []; drawClearance(); render(); }, clearanceCount: () => clrRects.length,
    setExplode({ on, d, labels: lb } = {}) { if (on != null) xpl.on = on; if (d != null) xpl.d = d; if (lb != null) xpl.labels = lb; if (xpl.on) { cand = []; hover = null; } applyExplode(); drawClearance(); if (on != null) fit(); else render(); highlight(); },
    get explode() { return { ...xpl, bands: xpl.bands.map((b) => ({ name: b.name, n: b.ids.length })) }; },
    fit() { fit(); setView({}); camChanged(); }, render,
    // compare views: colours per component, a flash, focus on one, and the camera as numbers so two views can share it
    setTint(map, { neutral = false } = {}) { TINT.map = new Map(Object.entries(map || {})); TINT.neutral = neutral; for (const g of objects.values()) paint(g); render(); },
    flash(id) { const g = objects.get(id); if (!g) return; let n = 0; const on = () => { outline(g, 'sel', n % 2 ? 0 : 0xffb000); render(); if (++n < 7) setTimeout(on, 170); else { highlight(); } }; on(); },
    focusOn(id) { const g = objects.get(id); if (!g) return false; const b = new THREE.Box3().setFromObject(g.userData.face), c = b.getCenter(new THREE.Vector3()), r = Math.max(1.5, b.getSize(new THREE.Vector3()).length());
      if (camera === persp) { const d = persp.position.clone().sub(controls.target).normalize(); controls.target.copy(c); persp.position.copy(c).addScaledVector(d, r * 2.6); controls.update(); }
      else if (camera === plan) { plan.position.x = c.x; plan.position.y = c.y; plan.userData.span = Math.max(3, r * 1.4); size(); }
      render(); camChanged(); return true; },
    getCam() { return { p: persp.position.toArray(), t: controls.target.toArray(), q: [plan.position.x, plan.position.y, plan.userData.span || 10] }; },
    setCam(c) { if (!c) return; camQuiet = true; try { persp.position.fromArray(c.p); controls.target.fromArray(c.t); controls.update(); plan.position.x = c.q[0]; plan.position.y = c.q[1]; plan.userData.span = c.q[2]; size(); render(); } finally { camQuiet = false; } }, png: () => { render(); return el.toDataURL('image/png'); },
    // for tests
    probe: () => [...objects.values()].map((g) => ({ id: g.userData.id, kind: g.userData.kind, op: g.userData.face.material.opacity, color: g.userData.face.material.color.getHexString(), edges: g.userData.edges.visible, clip: g.userData.face.material.clippingPlanes?.length || 0, z: +g.position.z.toFixed(3) })),
    camera: () => (camera === persp ? 'persp' : camera === plan ? 'plan' : camera === elev ? 'elev' : camera === iel ? 'ielev' : 'walk'),
    eye: () => walkCam.position.z, hoverId: () => hover, candidates: () => [...cand],
    screenOf: (id) => { const g = objects.get(id); if (!g) return null; const bb = new THREE.Box3().setFromObject(g.userData.face), r = el.getBoundingClientRect(), q = bb.getCenter(new THREE.Vector3()).project(camera); return { x: r.left + (q.x + 1) / 2 * r.width, y: r.top + (1 - q.y) / 2 * r.height }; },
    dispose() { removeEventListener('keydown', onKey, true); ro.disconnect(); controls.dispose(); renderer.dispose(); el.remove(); labelBox.remove(); boxEl.remove(); },
  };
}
