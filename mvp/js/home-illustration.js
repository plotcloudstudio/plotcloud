import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export async function openIllustration(host, initialColor, signal) {
  const response = await fetch('img/home/features/illustration-model.json', {signal});
  if (!response.ok) throw Error('Could not load the Courtyard Studio meshes.');
  const model = await response.json();
  if (signal.aborted) throw signal.reason;

  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor('#f0f3ee');
  const canvas = renderer.domElement;
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','Courtyard Studio, rotatable 3D architectural linework');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 1, .1, 320);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, canvas);
  controls.minDistance = 9;
  controls.maxDistance = 135;
  controls.maxPolarAngle = Math.PI * .49;
  controls.enablePan = false;

  const line = new THREE.LineBasicMaterial({color: initialColor});
  const face = new THREE.MeshBasicMaterial({color: '#fbfcf9', polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1});
  const glass = new THREE.MeshBasicMaterial({color: '#e8f2f1', polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1});
  const site = new THREE.MeshBasicMaterial({color: '#e9ede6', polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1});
  function add(geometry, material, x = 0, y = 0, z = 0) {
    const surface = new THREE.Mesh(geometry, material);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), line);
    surface.position.set(x, y, z);
    surface.add(outline);
    scene.add(surface);
  }
  for (const m of model.meshes) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(m.pos, 3));
    add(geometry, m.glass ? glass : face);
  }
  for (const {g, type} of model.context) {
    add(new THREE.BoxGeometry(g.w, g.d, g.h), type === 'terrain' ? site : face, g.x + g.w / 2, g.y + g.d / 2, g.z + g.h / 2);
  }

  const render = () => renderer.render(scene, camera);
  controls.addEventListener('change', render);
  function reset() {
    const distance = host.clientWidth < 410 ? 1.25 : 1;
    controls.target.set(9, 6, .7);
    camera.position.copy(controls.target).add(new THREE.Vector3(-24, -34, 30).multiplyScalar(distance));
    controls.update();
    render();
  }
  function resize() {
    if (!host.clientWidth || !host.clientHeight) return;
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    render();
  }
  host.append(canvas);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  reset();
  resize();

  return {
    color(value) { line.color.set(value); render(); },
    zoom(factor) {
      const offset = camera.position.clone().sub(controls.target);
      offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
      camera.position.copy(controls.target).add(offset);
      controls.update();
      render();
    },
    rotate(angle) {
      const offset = camera.position.clone().sub(controls.target);
      offset.applyAxisAngle(camera.up, angle);
      camera.position.copy(controls.target).add(offset);
      controls.update();
      render();
    },
    reset,
    dispose() {
      observer.disconnect();
      controls.dispose();
      scene.traverse((object) => object.geometry?.dispose());
      for (const material of [line, face, glass, site]) material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    }
  };
}
