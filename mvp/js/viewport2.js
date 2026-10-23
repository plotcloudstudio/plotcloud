// Workspace v2 viewport. Same scene, materials and picking rules as viewport.js (used by the archived Workspace,
// which stays untouched); adds three display modes that only change materials, and four cameras on the same geometry:
// perspective, plan per level (cut 1.2 m above the level), front elevation (orthographic) and a basic walkthrough at eye height.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const LOOK = {
  day: { clear: 0x9ca2af, grid: [0xc4c8d2, 0xb3b8c4], solid: 0xe9ecf2, ctx: 0xd5d9e2, edge: 0x2b2f38, ctxEdge: 0.4, hemi: [0xffffff, 0x8a90a0, 2.4] },
  night: { clear: 0x08090c, grid: [0x2a2d35, 0x1c1f26], solid: 0x2a2f3a, ctx: 0x1d2028, edge: 0xffffff, ctxEdge: 0.3, hemi: [0xffffff, 0x1a1d24, 1.3] },
};
const look = () => LOOK[document.documentElement.dataset.theme === 'day' ? 'day' : 'night'];
// Shaded and Ghosted use Plan Studio's warm model colours (beige walls, light timber, pale blue glass), by material first, then by type.
const SHADE_MAT = { Plaster: 0xece4d6, Gypsum: 0xefe9df, Concrete: 0xdcd5c9, Timber: 0xd9c4a0, Carpet: 0xb9a58e, 'Acoustic panel': 0xcdbfa6, Glass: 0x9ec3dc, Grass: 0xc5cfae, Context: 0xd6d2ca, Imported: 0xe2ddd3 };
const SHADE_TYPE = { wall: 0xece4d6, slab: 0xd9cdb8, roof: 0xe3ddd2, window: 0x9ec3dc, furniture: 0xd9c4a0, mass: 0xd6d2ca, terrain: 0xc5cfae, imported: 0xe2ddd3, room: 0xe8b04a };
const shadeOf = (c) => (c.type === 'room' ? 0xe8b04a : c.type === 'window' ? 0x9ec3dc : SHADE_MAT[c.mat] ?? SHADE_TYPE[c.type] ?? 0xe2ddd3);
export const EYE = 1.6, CUT = 1.2;

// Levels come from the model: the top of every slab is a floor level. A model with no slab has one level at z = 0.
export function levelsOf(model) {
  const tops = [...new Set((model?.components || []).filter((c) => c.type === 'slab').map((c) => +(c.g.z + c.g.h).toFixed(2)))].sort((a, b) => a - b);
  return (tops.length ? tops : [0]).map((z, i) => ({ n: i + 1, z, from: tops.length ? 'slab' : 'none' }));
}

export function createViewport2(host, { onPick } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.setClearColor(look().clear, 1); renderer.localClippingEnabled = true; host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const persp = new THREE.PerspectiveCamera(35, 1, 0.05, 2000); persp.up.set(0, 0, 1);
  const walkCam = new THREE.PerspectiveCamera(60, 1, 0.05, 2000); walkCam.up.set(0, 0, 1);
  const plan = new THREE.OrthographicCamera(-10, 10, 10, -10, -100, 500); plan.up.set(0, 1, 0);
  const elev = new THREE.OrthographicCamera(-10, 10, 10, -10, -500, 500); elev.up.set(0, 0, 1);
  let camera = persp;
  const controls = new OrbitControls(persp, renderer.domElement); controls.maxPolarAngle = Math.PI * 0.495;
  const hemi = new THREE.HemisphereLight(...look().hemi); hemi.position.set(0, 0, 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-0.5, -0.35, 1); scene.add(sun);
  let grid = null; const makeGrid = () => { if (grid) { scene.remove(grid); grid.geometry.dispose(); } grid = new THREE.GridHelper(120, 60, ...look().grid); grid.rotation.x = Math.PI / 2; grid.position.z = -0.32; scene.add(grid); }; makeGrid();
  const root = new THREE.Group(); scene.add(root);
  const clrGroup = new THREE.Group(); scene.add(clrGroup); let clrRects = [];
  let model = null, display = 'shaded', view = { kind: 'persp', level: 1 }, selected = null, objects = new Map(), bounds = new THREE.Box3(), clip = [];
  const walk = { yaw: Math.PI / 2, pitch: 0, pos: new THREE.Vector3() };

  function geometryOf(c) {
    if (c.mesh) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(c.mesh, 3)); g.computeVertexNormals(); return g; }
    const g = new THREE.BoxGeometry(c.g.w, c.g.d, c.g.h); g.translate(c.g.w / 2, c.g.d / 2, c.g.h / 2); return g;
  }
  const kindOf = (c) => (c.type === 'room' ? 'room' : c.type === 'window' ? 'glass' : c.type === 'mass' || c.type === 'terrain' ? 'ctx' : 'solid');
  // display modes: only material properties change, the scene is not rebuilt
  function paint(grp) {
    const k = grp.userData.kind, face = grp.userData.face, edges = grp.userData.edges, L = look(), fm = face.material, em = edges.material;
    const ghost = display === 'ghosted', wire = display === 'wire';
    const op = wire ? 0 : ghost ? 0.5 : k === 'room' ? 0 : k === 'glass' ? 0.45 : 1;
    fm.color.setHex(wire ? grp.userData.themeColor : grp.userData.shadeColor);
    em.color.setHex(display === 'shaded' && k !== 'room' ? 0x4a453d : k === 'room' ? 0xe8b04a : L.edge);
    fm.opacity = op; fm.transparent = op < 1; fm.depthWrite = op === 1; fm.colorWrite = op > 0;
    const eo = k === 'room' ? (display === 'shaded' ? 0 : 1) : display === 'shaded' ? 0.45 : k === 'ctx' ? Math.max(L.ctxEdge, wire ? 0.6 : 0) : 0.9;
    em.opacity = eo; em.visible = eo > 0;
    fm.clippingPlanes = clip; em.clippingPlanes = clip; fm.needsUpdate = true; em.needsUpdate = true;
    const sel = grp.getObjectByName('sel'); if (sel) { sel.material.clippingPlanes = clip; sel.material.needsUpdate = true; }
  }
  function build() {
    for (const o of [...root.children]) { root.remove(o); o.traverse((m) => { m.geometry?.dispose(); m.material?.dispose?.(); }); }
    objects.clear(); bounds.makeEmpty(); if (!model) return;
    const vis = new Map(model.layers.map((l) => [l.name, l.visible])), L = look();
    for (const c of model.components) {
      if (vis.get(c.layer) === false) continue;
      const geo = geometryOf(c), grp = new THREE.Group(); grp.position.set(c.g.x, c.g.y, c.g.z); grp.userData.id = c.id;
      const k = kindOf(c);
      const face = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: k === 'glass' ? 0xcfe0f2 : k === 'room' ? 0xe8b04a : k === 'ctx' ? L.ctx : L.solid, roughness: 0.5 }));
      face.userData.id = c.id;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: k === 'room' ? 0xe8b04a : L.edge, transparent: true }));
      grp.add(face, edges); Object.assign(grp.userData, { kind: k, face, edges, c, shadeColor: shadeOf(c), themeColor: face.material.color.getHex() });
      root.add(grp); objects.set(c.id, grp); paint(grp);
      if (k !== 'ctx') bounds.expandByObject(grp);
    }
    if (bounds.isEmpty()) for (const g of objects.values()) bounds.expandByObject(g);
    highlight();
  }
  // clearance hint: a dashed red outline on the floor round each piece (footprint + the free space it wants), as in Plan Studio
  function drawClearance() {
    for (const o of [...clrGroup.children]) { clrGroup.remove(o); o.geometry.dispose(); o.material.dispose(); }
    for (const r of clrRects) {
      const z = r.z + 0.02, pts = [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1], [r.x0, r.y0]].map(([x, y]) => new THREE.Vector3(x, y, z));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xd8402a, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0.95, clippingPlanes: clip }));
      line.computeLineDistances(); line.renderOrder = 11; clrGroup.add(line);
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.y1 - r.y0), new THREE.MeshBasicMaterial({ color: 0xd8402a, transparent: true, opacity: 0.08, depthWrite: false, clippingPlanes: clip }));
      fill.position.set((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, z); clrGroup.add(fill);
    }
  }
  function highlight() {
    for (const [id, grp] of objects) {
      const on = id === selected, f = grp.userData.face; if (f.material.emissive) f.material.emissive.setHex(on ? 0x6b2a1a : 0x000000);
      const old = grp.getObjectByName('sel'); if (old) { grp.remove(old); old.geometry.dispose(); old.material.dispose(); }
      if (on) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(f.geometry, 25), new THREE.LineBasicMaterial({ color: 0xd8402a, depthTest: false, clippingPlanes: clip })); e.name = 'sel'; e.renderOrder = 10; grp.add(e); }
    }
    render();
  }
  const box = () => (bounds.isEmpty() ? new THREE.Box3(new THREE.Vector3(-5, -5, 0), new THREE.Vector3(5, 5, 3)) : bounds);
  function fit() {
    const b = box(), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
    const k = Math.hypot(s.x, s.y, s.z) * 1.6 / Math.hypot(0.55, 0.62, 1);
    persp.position.set(c.x - 0.55 * k, c.y - 1 * k, c.z + 0.62 * k); controls.target.set(c.x, c.y, c.z * 0.5); persp.far = k * 50; persp.updateProjectionMatrix(); controls.update();
    plan.position.set(c.x, c.y, 200); plan.lookAt(c.x, c.y, 0); plan.userData.span = Math.max(s.x, s.y, 4) * 0.62;
    elev.position.set(c.x, b.min.y - 100, c.z); elev.lookAt(c.x, b.min.y, c.z); elev.userData.span = Math.max(s.z, s.x * 0.6, 3);
    size(); render();
  }
  function size() {
    const r = host.getBoundingClientRect(); if (r.width < 2) return; renderer.setSize(r.width, r.height, false); const a = r.width / r.height;
    for (const p of [persp, walkCam]) { p.aspect = a; p.updateProjectionMatrix(); }
    for (const o of [plan, elev]) { const s = o.userData.span || 10; o.left = -s * a; o.right = s * a; o.top = s; o.bottom = -s; o.updateProjectionMatrix(); }
  }
  function aimWalk() { const d = new THREE.Vector3(Math.cos(walk.pitch) * Math.cos(walk.yaw), Math.cos(walk.pitch) * Math.sin(walk.yaw), Math.sin(walk.pitch)); walkCam.position.copy(walk.pos); walkCam.lookAt(walk.pos.clone().add(d)); }
  function render() { if (camera === walkCam) aimWalk(); renderer.render(scene, camera); }
  controls.addEventListener('change', render);

  function setView(v) {
    view = { ...view, ...v }; const lv = levelsOf(model), L = lv.find((x) => x.n === view.level) || lv[0];
    clip = [];
    if (view.kind === 'plan') { clip = [new THREE.Plane(new THREE.Vector3(0, 0, -1), L.z + CUT)]; if (L.n > 1) clip.push(new THREE.Plane(new THREE.Vector3(0, 0, 1), -(L.z - 0.35))); camera = plan; }
    else if (view.kind === 'elev') camera = elev;
    else if (view.kind === 'walk') {
      const room = model?.components.find((c) => c.type === 'room' && Math.abs(c.g.z - L.z) < 0.5), b = box(), c = b.getCenter(new THREE.Vector3());
      walk.pos.set(room ? room.g.x + room.g.w / 2 : c.x, room ? room.g.y + room.g.d / 2 : c.y, L.z + EYE); walk.yaw = Math.PI / 2; walk.pitch = 0; camera = walkCam;
    } else camera = persp;
    controls.enabled = camera === persp;
    for (const g of objects.values()) paint(g); drawClearance(); size(); render();
  }

  const onTheme = () => { renderer.setClearColor(look().clear, 1); hemi.color.set(look().hemi[0]); hemi.groundColor.set(look().hemi[1]); hemi.intensity = look().hemi[2]; makeGrid(); build(); render(); };
  addEventListener('pc-theme', onTheme);
  const ro = new ResizeObserver(() => { size(); render(); }); ro.observe(host);

  // ortho views: drag pans, wheel zooms. Walkthrough: drag looks around, wheel moves forward and back.
  let drag = null; const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; });
  el.addEventListener('pointermove', (e) => {
    if (!drag || !e.buttons) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 3) drag.moved = true; if (!drag.moved) return;
    const r = host.getBoundingClientRect();
    if (camera === plan) { const s = plan.userData.span * 2 / r.height; plan.position.x -= dx * s; plan.position.y += dy * s; }
    else if (camera === elev) { const s = elev.userData.span * 2 / r.height; elev.position.x -= dx * s; elev.position.z += dy * s; }
    else if (camera === walkCam) { walk.yaw -= dx * 0.005; walk.pitch = Math.max(-1.2, Math.min(1.2, walk.pitch - dy * 0.005)); }
    else return;
    drag.x = e.clientX; drag.y = e.clientY; render();
  });
  el.addEventListener('wheel', (e) => {
    if (camera === persp) return; e.preventDefault();
    if (camera === walkCam) { const step = -Math.sign(e.deltaY) * 0.6; walk.pos.x += Math.cos(walk.yaw) * step; walk.pos.y += Math.sin(walk.yaw) * step; }
    else { camera.userData.span *= Math.exp(e.deltaY * 0.001); size(); }
    render();
  }, { passive: false });
  el.addEventListener('pointerup', (e) => {
    if (drag && !drag.moved && model) {
      const r = el.getBoundingClientRect(), p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(p, camera);
      const locked = new Set(model.layers.filter((l) => l.locked).map((l) => l.name));
      const visible = (h) => clip.every((pl) => pl.distanceToPoint(h.point) >= -1e-3);   // nothing above the plan cut can be picked
      const hit = ray.intersectObjects([...objects.values()].map((g) => g.userData.face), false)
        .find((h) => { const c = objects.get(h.object.userData.id)?.userData.c; return c && !locked.has(c.layer) && visible(h); });   // locked layers: clicks pass through
      onPick?.(hit ? hit.object.userData.id : null);
    }
    drag = null;
  });

  return {
    setModel(m, { refit = false } = {}) { model = m; build(); if (refit) fit(); setView({}); },
    setDisplay(d) { display = d; for (const g of objects.values()) paint(g); render(); },
    setView, get view() { return view; }, get display() { return display; },
    select(id) { selected = id; highlight(); },
    setClearance(rects) { clrRects = rects || []; drawClearance(); render(); }, clearanceCount: () => clrRects.length,
    fit() { fit(); setView({}); }, render, png: () => { render(); return el.toDataURL('image/png'); },
    // for tests: what the materials are doing right now
    probe: () => [...objects.values()].map((g) => ({ id: g.userData.id, kind: g.userData.kind, op: g.userData.face.material.opacity, color: g.userData.face.material.color.getHexString(), edges: g.userData.edges.visible, clip: g.userData.face.material.clippingPlanes?.length || 0 })),
    camera: () => (camera === persp ? 'persp' : camera === plan ? 'plan' : camera === elev ? 'elev' : 'walk'),
    eye: () => walkCam.position.z,
    dispose() { removeEventListener('pc-theme', onTheme); ro.disconnect(); controls.dispose(); renderer.dispose(); el.remove(); },
  };
}
