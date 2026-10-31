// Import preview (2026-10-31): before a model joins the project, it opens in 3D in a window in the middle of the screen (70 %). Drag to orbit, right-drag or
// two fingers to pan, scroll to zoom. Units and up axis can be corrected here; the size is read out in metres beside a 1.8 m
// figure for scale. Cancel import (top left) leaves the project as it was; Confirm import (top right) resolves with the
// reviewed model, which the Workspace adds to the current project.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { transformImport, importBounds } from './import-review.js?v=import-feedback-20261027-1';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const UNITS = [['auto', 'From the file'], ['1', 'Metres'], ['0.001', 'Millimetres'], ['0.01', 'Centimetres'], ['0.3048', 'Feet'], ['0.0254', 'Inches']];

export function previewImport(original, { name = original.audit?.fileName || 'Imported model', destination = '' } = {}) {
  return new Promise((resolve) => {
    const audit = original.audit || {}, root = document.createElement('div'); root.className = 'ipv'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Preview the model before importing');
    root.innerHTML = `<div class="ipv-win"><canvas class="ipv-cv" aria-label="The model: drag to orbit, scroll to zoom"></canvas>
      <header class="ipv-top"><button type="button" class="ipv-btn" data-ipv="cancel">✕ Cancel import</button>
        <div class="ipv-title"><b>${esc(name)}</b><span>${esc(destination)}</span></div>
        <button type="button" class="ipv-btn ipv-ok" data-ipv="ok">Confirm import</button></header>
      <section class="ipv-card" aria-label="Scale and orientation">
        <div class="ipv-size" data-ipv-size></div>
        <label>Units<select data-ipv-unit>${UNITS.map(([v, n]) => `<option value="${v}">${n}${v === 'auto' && audit.sourceUnit ? ` (${esc(audit.sourceUnit)})` : ''}</option>`).join('')}</select></label>
        <label>Up axis<select data-ipv-up><option value="z">Z up</option><option value="y">Y up</option></select></label>
        <p data-ipv-msg>Check the size against the 1.8 m figure. Change the units if it is far off.</p></section>
      <p class="ipv-hint">Drag to orbit · right-drag to pan · scroll to zoom</p></div>`;
    document.body.append(root);
    const q = (s) => root.querySelector(s), cv = q('.ipv-cv'), up0 = audit.importedUp === 'y' ? 'y' : 'z'; q('[data-ipv-up]').value = up0;
    const R = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); R.setPixelRatio(Math.min(2, devicePixelRatio || 1)); R.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#eef0f3');
    const cam = new THREE.PerspectiveCamera(40, 1, 0.05, 1e6), ctl = new OrbitControls(cam, cv); ctl.enableDamping = true; ctl.dampingFactor = 0.12;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9bec7, 1.15)); const sun = new THREE.DirectionalLight(0xffffff, 1.35); sun.position.set(0.6, 1, 0.4); scene.add(sun);
    let model = null, current = null, raf = 0;
    const size = () => { const r = q('.ipv-win').getBoundingClientRect(), w = Math.max(10, r.width), h = Math.max(10, r.height); R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    function build() {
      const choice = q('[data-ipv-unit]').value, scale = choice === 'auto' ? audit.unitScale : +choice, up = q('[data-ipv-up]').value;
      try { current = transformImport(original, scale, up); } catch (e) { q('[data-ipv-msg]').textContent = e.message; return; }
      if (model) { scene.remove(model); model.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); }
      model = new THREE.Group(); let tris = 0; const mat = new THREE.MeshStandardMaterial({ color: '#d9d6d0', roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }), edge = new THREE.LineBasicMaterial({ color: '#4b5059', transparent: true, opacity: 0.7 });
      for (const c of current.components) { const m = c.mesh, pos = new Float32Array(m.length); for (let i = 0; i < m.length; i += 3) { pos[i] = m[i] + c.g.x; pos[i + 1] = m[i + 2] + c.g.z; pos[i + 2] = -(m[i + 1] + c.g.y); } tris += m.length / 9;
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.computeVertexNormals(); const me = new THREE.Mesh(geo, mat); model.add(me);
        if (m.length / 9 < 40000) me.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edge)); }
      const b = importBounds(current), [W, D, H] = b.size, span = Math.max(W, D, H, 2);
      // ground grid and a person for scale beside the model
      const grid = new THREE.GridHelper(Math.ceil(span * 1.6 / 10) * 10 || 10, Math.min(80, Math.max(10, Math.round(span * 1.6))), 0xb8bec8, 0xd9dde3); grid.position.set(W / 2, 0, -D / 2); model.add(grid);
      const person = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.8, 16), new THREE.MeshStandardMaterial({ color: '#2f5bd8' })); person.position.set(W + Math.max(1, span * 0.04), 0.9, -D / 2); model.add(person);
      scene.add(model);
      q('[data-ipv-size]').innerHTML = `<b>${W.toFixed(2)} × ${D.toFixed(2)} × ${H.toFixed(2)} m</b><span>${current.components.length} object${current.components.length === 1 ? '' : 's'} · ${Math.round(tris).toLocaleString('en-CA')} triangles</span>`;
      const big = Math.max(W, D, H); q('[data-ipv-msg]').textContent = big > 3000 ? 'Over 3 km across: the units are probably wrong (try Millimetres).' : big < 0.5 ? 'Under half a metre across: the units are probably wrong (try Metres).' : 'Check the size against the 1.8 m figure (blue). Change the units if it is far off.';
      ctl.target.set(W / 2, H / 3, -D / 2); cam.position.set(W / 2 + span * 1.1, H / 2 + span * 0.8, -D / 2 + span * 1.3); cam.near = span / 2000; cam.far = span * 50; cam.updateProjectionMatrix(); ctl.update(); }
    const loop = () => { raf = requestAnimationFrame(loop); ctl.update(); R.render(scene, cam); };
    const finish = (value) => { cancelAnimationFrame(raf); removeEventListener('resize', size); removeEventListener('keydown', key, true); removeEventListener('hashchange', cancel); if (model) model.traverse((o) => { o.geometry?.dispose(); }); R.dispose(); root.remove(); resolve(value); };
    const cancel = () => finish(null), key = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); } };
    q('[data-ipv="cancel"]').onclick = cancel;
    q('[data-ipv="ok"]').onclick = () => { if (!current) return; current.audit = { ...current.audit, scaleConfirmed: true, destination: { label: destination }, reviewedAt: new Date().toISOString() }; finish(current); };
    q('[data-ipv-unit]').onchange = build; q('[data-ipv-up]').onchange = build;
    addEventListener('resize', size); addEventListener('keydown', key, true); addEventListener('hashchange', cancel, { once: true });
    size(); build(); loop(); q('[data-ipv="ok"]').focus();
  });
}
