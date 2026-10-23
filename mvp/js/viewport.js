// Lightweight model viewport: shaded, wireframe (used for acoustics) and plan views, click to select.
// Same visual language as the PlotCloud simulation tools: grey ground, off-white solids, soft light, z up.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const MAT = {
  wall: 0xf1f0ec, slab: 0xe6e3dc, roof: 0xdedbd4, mass: 0xd2cec6, terrain: 0xe9e7e1, furniture: 0xd9d3c7, imported: 0xe6e3dc, window: 0x9cc3e0, room: 0xe8b04a,
};

export function createViewport(host, { onPick } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.setClearColor(0xf3f3f1, 1); host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const persp = new THREE.PerspectiveCamera(35, 1, 0.05, 2000); persp.up.set(0, 0, 1);
  const ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, -100, 500); ortho.up.set(0, 1, 0);
  let camera = persp;
  const controls = new OrbitControls(persp, renderer.domElement); controls.maxPolarAngle = Math.PI * 0.495;
  const hemi = new THREE.HemisphereLight(0xffffff, 0xcfccc4, 2.1); hemi.position.set(0, 0, 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-0.5, -0.35, 1); scene.add(sun);
  const grid = new THREE.GridHelper(80, 80, 0xd9d6cf, 0xe6e3dc); grid.rotation.x = Math.PI / 2; grid.position.z = -0.001; scene.add(grid);
  const root = new THREE.Group(); scene.add(root);
  const extra = new THREE.Group(); scene.add(extra);
  let model = null, mode = 'shaded', selected = null, objects = new Map(), bounds = new THREE.Box3();

  function geometryOf(c) {
    if (c.mesh) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(c.mesh, 3)); g.computeVertexNormals(); return g; }
    const g = new THREE.BoxGeometry(c.g.w, c.g.d, c.g.h); g.translate(c.g.w / 2, c.g.d / 2, c.g.h / 2); return g;
  }
  function build() {
    for (const o of [...root.children]) { root.remove(o); o.traverse((m) => { m.geometry?.dispose(); m.material?.dispose?.(); }); }
    objects.clear(); bounds.makeEmpty(); if (!model) return;
    const vis = new Map(model.layers.map((l) => [l.name, l.visible]));
    for (const c of model.components) {
      if (vis.get(c.layer) === false) continue;
      const geo = geometryOf(c), grp = new THREE.Group(); grp.position.set(c.g.x, c.g.y, c.g.z); grp.userData.id = c.id;
      const isRoom = c.type === 'room', isGlass = c.type === 'window';
      const wire = mode === 'wire';
      const face = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: MAT[c.type] ?? 0xe6e3dc, roughness: 0.95,
        transparent: isRoom || isGlass || wire, opacity: wire ? (isRoom ? 0.07 : 0.0) : isRoom ? 0.0 : isGlass ? 0.45 : 1, depthWrite: !(isRoom || isGlass || wire) }));
      face.userData.id = c.id; grp.add(face);
      if (wire || isRoom || mode === 'plan') {
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: isRoom ? 0xc9852a : c.type === 'terrain' || c.type === 'mass' ? 0xb7b3ab : 0x55524c, transparent: true, opacity: isRoom && mode === 'shaded' ? 0.0 : 1 }));
        grp.add(edges);
      }
      root.add(grp); objects.set(c.id, grp);
      if (c.type !== 'terrain' && c.type !== 'mass') bounds.expandByObject(grp);
    }
    if (bounds.isEmpty()) for (const g of objects.values()) bounds.expandByObject(g);
    highlight();
  }
  function highlight() {
    for (const [id, grp] of objects) { const sel = id === selected; grp.children.forEach((m) => { if (m.isMesh && m.material.emissive) m.material.emissive.setHex(sel ? 0x6b2a1a : 0x000000); });
      const old = grp.getObjectByName('sel'); if (old) { grp.remove(old); old.geometry.dispose(); }
      if (sel) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(grp.children[0].geometry, 25), new THREE.LineBasicMaterial({ color: 0xd8402a })); e.name = 'sel'; grp.add(e); } }
    render();
  }
  function fit() {
    const b = bounds.isEmpty() ? new THREE.Box3(new THREE.Vector3(-5, -5, 0), new THREE.Vector3(5, 5, 3)) : bounds;
    const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()), D = Math.max(s.x, s.y, 4);
    const k = Math.hypot(s.x, s.y, s.z) * 1.6 / Math.hypot(0.55, 0.62, 1);
    persp.position.set(c.x - 0.55 * k, c.y - 1 * k, c.z + 0.62 * k); controls.target.set(c.x, c.y, c.z * 0.5); persp.near = 0.05; persp.far = k * 50; persp.updateProjectionMatrix(); controls.update();
    ortho.position.set(c.x, c.y, 200); ortho.lookAt(c.x, c.y, 0); ortho.userData.span = D * 0.75; ortho.userData.c = c; size(); render();
  }
  function size() {
    const r = host.getBoundingClientRect(); if (r.width < 2) return; renderer.setSize(r.width, r.height, false);
    persp.aspect = r.width / r.height; persp.updateProjectionMatrix();
    const s = ortho.userData.span || 10, a = r.width / r.height; ortho.left = -s * a; ortho.right = s * a; ortho.top = s; ortho.bottom = -s; ortho.updateProjectionMatrix();
  }
  function render() { renderer.render(scene, camera); }
  controls.addEventListener('change', render);
  new ResizeObserver(() => { size(); render(); }).observe(host);

  // plan view: pan with drag, zoom with wheel
  let drag = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 3) drag.moved = true;
    if (camera === ortho && drag.moved && e.buttons) { const r = host.getBoundingClientRect(), s = ortho.userData.span * 2 / r.height; ortho.position.x -= dx * s; ortho.position.y += dy * s; drag.x = e.clientX; drag.y = e.clientY; render(); }
  });
  renderer.domElement.addEventListener('wheel', (e) => { if (camera !== ortho) return; e.preventDefault(); ortho.userData.span *= Math.exp(e.deltaY * 0.001); size(); render(); }, { passive: false });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (drag && !drag.moved) {
      const r = renderer.domElement.getBoundingClientRect(), p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(p, camera);
      const lockedLayers = new Set(model.layers.filter((l) => l.locked).map((l) => l.name));
      const hit = ray.intersectObjects([...objects.values()].map((g) => g.children[0]), false).find((h) => { const c = model.components.find((x) => x.id === h.object.userData.id); return c && !lockedLayers.has(c.layer); });
      onPick?.(hit ? hit.object.userData.id : null);
    }
    drag = null;
  });

  return {
    setModel(m, { refit = false } = {}) { model = m; build(); if (refit) fit(); else render(); },
    setMode(m) { mode = m; camera = m === 'plan' ? ortho : persp; controls.enabled = m !== 'plan'; build(); size(); render(); },
    select(id) { selected = id; highlight(); },
    // Acoustics: show the source and receiver inside the chosen room
    markers(room) {
      for (const o of [...extra.children]) extra.remove(o);
      if (room) { const g = room.g, s = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 10), new THREE.MeshBasicMaterial({ color: 0x8f1025 })); s.position.set(g.x + g.w * 0.3, g.y + g.d * 0.5, 1.5); extra.add(s);
        const r = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0x252421 })); r.position.set(g.x + g.w * 0.72, g.y + g.d * 0.55, 1.2); extra.add(r); }
      render();
    },
    fit, render, png: () => { render(); return renderer.domElement.toDataURL('image/png'); },
  };
}

// Read an OBJ / STL / GLB file into components (one per mesh), positioned with their bounding box.
export async function importModel(file, { unit = 1, up = 'auto' } = {}) {
  const ext = file.name.toLowerCase().split('.').pop(), buf = await file.arrayBuffer();
  if (file.size > 25 * 1048576) throw Error('This file is over 25 MB. Export a simplified model for the prototype.');
  let obj, fileUp = 'y';
  if (ext === 'obj') { const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js'); obj = new OBJLoader().parse(new TextDecoder().decode(buf)); }
  else if (ext === 'stl') { const { STLLoader } = await import('three/addons/loaders/STLLoader.js'); obj = new THREE.Mesh(new STLLoader().parse(buf)); fileUp = 'z'; }
  else if (ext === 'glb' || ext === 'gltf') { const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'); obj = (await new GLTFLoader().parseAsync(buf, '')).scene; }
  else throw Error('The prototype reads .obj, .stl and .glb. Rhino, SketchUp and IFC files open in the full tools.');
  const zUp = (up === 'auto' ? fileUp : up) === 'z';
  obj.updateMatrixWorld(true); const out = []; let tris = 0;
  obj.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes.position) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld), a = g.attributes.position;
    tris += a.count / 3; if (tris > 80000) throw Error('Over 80,000 triangles. Simplify the model for the browser prototype.');
    const pos = new Float32Array(a.count * 3);
    for (let i = 0; i < a.count; i++) { const x = a.getX(i) * unit, y = a.getY(i) * unit, z = a.getZ(i) * unit; pos[i * 3] = x; pos[i * 3 + 1] = zUp ? y : -z; pos[i * 3 + 2] = zUp ? z : y; }
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i + k]); mx[k] = Math.max(mx[k], pos[i + k]); }
    for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) pos[i + k] = +(pos[i + k] - mn[k]).toFixed(3);
    out.push({ name: o.name || `Mesh ${out.length + 1}`, type: 'imported', layer: 'Imported', g: { x: +mn[0].toFixed(3), y: +mn[1].toFixed(3), z: +mn[2].toFixed(3), w: +(mx[0] - mn[0]).toFixed(3), d: +(mx[1] - mn[1]).toFixed(3), h: +(mx[2] - mn[2]).toFixed(3) }, mat: 'Imported', mesh: Array.from(pos) });
    g.dispose();
  });
  if (!out.length) throw Error('No meshes found in this file.');
  // drop the model onto the ground plane at the origin
  const minX = Math.min(...out.map((c) => c.g.x)), minY = Math.min(...out.map((c) => c.g.y)), minZ = Math.min(...out.map((c) => c.g.z));
  for (const c of out) { c.g.x = +(c.g.x - minX).toFixed(3); c.g.y = +(c.g.y - minY).toFixed(3); c.g.z = +(c.g.z - minZ).toFixed(3); }
  return { components: out, triangles: Math.round(tris) };
}
