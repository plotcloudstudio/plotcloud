// Import preview (2026-10-31): before a model joins the project, it opens in 3D in a window in the middle of the screen (70 %). Drag to orbit, right-drag or
// two fingers to pan, scroll to zoom. Units and up axis can be corrected here; the size is read out in metres beside a 1.8 m
// figure for scale. Cancel import (top left) leaves the project as it was; Confirm import (top right) resolves with the
// reviewed model, which the Workspace adds to the current project.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { transformImport, importBounds } from './import-review.js?v=import-feedback-20261027-1';
import { detectFloors, withGround } from './level-detect.js?v=levels-20261117-1';
import { simplifyComponents } from './mesh-simplify.js?v=simplify-20261119-1';

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
        <p data-ipv-msg>Check the size against the red figure, a person 1.8 m tall. Change the units if it is far off.</p>
        <div class="ipv-floors" data-ipv-floors hidden><b>Floors</b><p data-ipv-fnote></p><label>Ground floor (1F)<select data-ipv-ground></select></label><ol data-ipv-flist></ol><label class="ipv-check"><input type="checkbox" data-ipv-uselv checked> Make these the project’s levels</label></div>
        <div class="ipv-simp" data-ipv-simpbox><b>Simplify (optional)</b><p>Fewer triangles draw and simulate faster. Simplifying changes the geometry: small or thin parts can lose detail. Off unless you turn it on; the import record notes it.</p>
          <label class="ipv-check"><input type="checkbox" data-ipv-simp> Simplify to <input type="number" min="100" step="1000" data-ipv-target aria-label="Target number of triangles"> triangles</label>
          <label>Largest change<select data-ipv-err><option value="0.01">1 cm</option><option value="0.02" selected>2 cm</option><option value="0.05">5 cm</option><option value="0.1">10 cm</option><option value="inf">No limit</option></select></label>
          <p class="ipv-simpmsg" data-ipv-simpmsg role="status"></p></div></section>
      <p class="ipv-hint">Drag to orbit · right-drag to pan · scroll to zoom</p></div>`;
    document.body.append(root);
    const q = (s) => root.querySelector(s), cv = q('.ipv-cv'), up0 = audit.importedUp === 'y' ? 'y' : 'z'; q('[data-ipv-up]').value = up0;
    const R = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); R.setPixelRatio(Math.min(2, devicePixelRatio || 1)); R.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#eef0f3');
    const cam = new THREE.PerspectiveCamera(40, 1, 0.05, 1e6), ctl = new OrbitControls(cam, cv); ctl.enableDamping = true; ctl.dampingFactor = 0.12;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9bec7, 1.15)); const sun = new THREE.DirectionalLight(0xffffff, 1.35); sun.position.set(0.6, 1, 0.4); scene.add(sun);
    let model = null, current = null, raf = 0, base = null, simp = null, run = 0, tris0 = 0;
    const size = () => { const r = q('.ipv-win').getBoundingClientRect(), w = Math.max(10, r.width), h = Math.max(10, r.height); R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    function build() {
      const choice = q('[data-ipv-unit]').value, scale = choice === 'auto' ? audit.unitScale : +choice, up = q('[data-ipv-up]').value;
      try { base = transformImport(original, scale, up); } catch (e) { q('[data-ipv-msg]').textContent = e.message; return; }
      tris0 = base.components.reduce((t, c) => t + Math.floor(c.mesh.length / 9), 0); const tg = q('[data-ipv-target]'); if (!tg.value) tg.value = String(Math.max(1000, Math.min(100000, Math.round(tris0 / 2 / 1000) * 1000)));
      q('[data-ipv-simpbox]').hidden = tris0 < 2000; simplify(); }
    // simplification (2026-11-19): only when it is turned on; a later change of units, axis, target or limit starts it again from the full model
    async function simplify() {
      const on = q('[data-ipv-simp]').checked && !q('[data-ipv-simpbox]').hidden, my = ++run, msg = q('[data-ipv-simpmsg]'), ok = q('[data-ipv="ok"]');
      simp = null; if (!on) { msg.textContent = ''; show(base); return; }
      const target = Math.round(+q('[data-ipv-target]').value), ev = q('[data-ipv-err]').value, lim = ev === 'inf' ? Infinity : +ev;
      if (!(target >= 100)) { msg.textContent = 'Enter a number of triangles, at least 100.'; show(base); return; }
      if (target >= tris0) { msg.textContent = `The model already has ${tris0.toLocaleString('en-CA')} triangles, no more than the target: nothing to simplify.`; show(base); return; }
      ok.disabled = true; msg.textContent = 'Simplifying…';
      try { const r = await simplifyComponents(base.components, { target, maxError: lim, onProgress: (x) => { if (my === run) msg.textContent = 'Simplifying… ' + Math.floor(x * 100) + '%'; } });
        if (my !== run) return; simp = { from: r.before, to: Math.round(r.after), target, limitM: Number.isFinite(lim) ? lim : null, maxChangeM: +r.maxError.toFixed(4), objectsReduced: r.changed, objectsKept: r.kept, method: 'meshoptimizer 0.25 simplify (quadric edge collapse; vertices kept in place)' };
        const reached = r.after <= target * 1.02, cm = r.maxError < 1e-4 ? 'less than 0.1 mm' : r.maxError < 0.01 ? (r.maxError * 1000).toFixed(1) + ' mm' : (r.maxError * 100).toFixed(1) + ' cm';
        msg.textContent = `Simplified: ${r.before.toLocaleString('en-CA')} → ${simp.to.toLocaleString('en-CA')} triangles (${Math.round(100 * r.after / r.before)} %), ${r.changed.toLocaleString('en-CA')} of ${base.components.length.toLocaleString('en-CA')} objects reduced; the surface moved ${cm} at most (measured at the removed vertices).` + (reached ? '' : ` The target was not reached within the ${Number.isFinite(lim) ? (lim * 100) + ' cm' : ''} limit; allow a larger change to go further.`);
        show({ ...base, components: r.components }); }
      catch (e) { if (my !== run) return; msg.textContent = 'Simplification did not run: ' + (e.message || e) + ' The model is imported as it is unless you cancel.'; show(base); }
      finally { if (my === run) ok.disabled = false; } }
    function show(m) {
      current = m;
      if (model) { scene.remove(model); model.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); }
      model = new THREE.Group(); let tris = 0; const mat = new THREE.MeshStandardMaterial({ color: '#d9d6d0', roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }), edge = new THREE.LineBasicMaterial({ color: '#4b5059', transparent: true, opacity: 0.7 });
      // one mesh for the whole model (2026-11-18: one draw, not one per object); edge lines only while it is under 20,000 triangles
      { const n = current.components.reduce((t, c) => t + c.mesh.length - c.mesh.length % 9, 0), pos = new Float32Array(n); let at = 0;
        for (const c of current.components) { const m = c.mesh, L = m.length - m.length % 9; for (let i = 0; i < L; i += 3) { pos[at++] = m[i] + c.g.x; pos[at++] = m[i + 2] + c.g.z; pos[at++] = -(m[i + 1] + c.g.y); } }
        tris = n / 9; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.computeVertexNormals(); const me = new THREE.Mesh(geo, mat); model.add(me);
        if (tris < 20000) me.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edge)); }
      const b = importBounds(current), [W, D, H] = b.size, span = Math.max(W, D, H, 2);
      // ground grid and a person for scale beside the model
      const grid = new THREE.GridHelper(Math.ceil(span * 1.6 / 10) * 10 || 10, Math.min(80, Math.max(10, Math.round(span * 1.6))), 0xb8bec8, 0xd9dde3); grid.position.set(W / 2, 0, -D / 2); model.add(grid);
      // a person 1.8 m tall, in red, beside the model: head, body, arms and legs, with the height written over it
      const person = new THREE.Group(), red = new THREE.MeshStandardMaterial({ color: '#d8402a', roughness: 0.6 }), part = (geo, x, y, z = 0) => { const m = new THREE.Mesh(geo, red); m.position.set(x, y, z); person.add(m); };
      part(new THREE.SphereGeometry(0.11, 20, 14), 0, 1.69); part(new THREE.CylinderGeometry(0.17, 0.14, 0.62, 16), 0, 1.25);
      part(new THREE.CylinderGeometry(0.045, 0.04, 0.6, 10), -0.22, 1.22); part(new THREE.CylinderGeometry(0.045, 0.04, 0.6, 10), 0.22, 1.22);
      part(new THREE.CylinderGeometry(0.07, 0.055, 0.94, 12), -0.08, 0.47); part(new THREE.CylinderGeometry(0.07, 0.055, 0.94, 12), 0.08, 0.47);
      { const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d'); g.fillStyle = '#d8402a'; g.font = '700 60px Inter,system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1.8 m', 128, 50);
        const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: false, toneMapped: false })), k = Math.max(0.6, span * 0.035); sp.scale.set(k * 2.6, k, 1); sp.position.set(0, 1.8 + k * 0.9, 0); sp.renderOrder = 9; person.add(sp); }
      { const tick = new THREE.LineBasicMaterial({ color: '#d8402a' }), pts = [[-0.35, 0], [0.35, 0], [0, 0], [0, 1.8], [-0.35, 1.8], [0.35, 1.8]].map(([x, y]) => new THREE.Vector3(x + 0.45, y, 0)); const g2 = new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]]); person.add(new THREE.LineSegments(g2, tick)); }
      person.position.set(W + Math.max(1.2, span * 0.05), 0, -D / 2); model.add(person);
      scene.add(model);
      q('[data-ipv-size]').innerHTML = `<b>${W.toFixed(2)} × ${D.toFixed(2)} × ${H.toFixed(2)} m</b><span>${current.components.length} object${current.components.length === 1 ? '' : 's'} · ${Math.round(tris).toLocaleString('en-CA')} triangles</span>`;
      const big = Math.max(W, D, H); q('[data-ipv-msg]').textContent = big > 3000 ? 'Over 3 km across: the units are probably wrong (try Millimetres).' : big < 0.5 ? 'Under half a metre across: the units are probably wrong (try Metres).' : 'Check the size against the red figure, a person 1.8 m tall. Change the units if it is far off.';
      if (simp) q('[data-ipv-size]').innerHTML += `<span class="ipv-simplified">Simplified from ${simp.from.toLocaleString('en-CA')} triangles</span>`;
      floors();
      ctl.target.set(W / 2, H / 3, -D / 2); cam.position.set(W / 2 + span * 1.1, H / 2 + span * 0.8, -D / 2 + span * 1.3); cam.near = span / 2000; cam.far = span * 50; cam.updateProjectionMatrix(); ctl.update(); }
    // the floors (2026-11-17): found from the geometry; the person picks the ground floor, which goes to height 0 on import
    let det = null;
    function floors() { const box = q('[data-ipv-floors]'); try { det = detectFloors(current.components, current.audit); } catch { det = null; }
      const st = det ? det.floors.filter((f) => !f.roof) : []; box.hidden = !st.length; if (!st.length) return;
      const sel = q('[data-ipv-ground]'); sel.innerHTML = st.map((f, i) => `<option value="${i}">${i + 1}${['st', 'nd', 'rd'][i] && i < 3 ? ['st', 'nd', 'rd'][i] : 'th'} from the bottom · now at +${f.z.toFixed(2)} m</option>`).join(''); sel.value = String(det.ground); list(); }
    function list() { const g = withGround(det, +q('[data-ipv-ground]').value); q('[data-ipv-fnote]').textContent = det.note;
      q('[data-ipv-flist]').innerHTML = [...g.floors].reverse().map((f) => `<li${f.z === 0 ? ' class="on"' : ''}><b>${esc(f.name)}</b><span>${f.z >= 0 ? '+' : ''}${f.z.toFixed(2)} m${f.roof ? '' : ' · ' + f.h.toFixed(2) + ' m high'}</span></li>`).join(''); }
    q('[data-ipv-ground]').onchange = list;
    const loop = () => { raf = requestAnimationFrame(loop); ctl.update(); R.render(scene, cam); };
    const finish = (value) => { cancelAnimationFrame(raf); removeEventListener('resize', size); removeEventListener('keydown', key, true); removeEventListener('hashchange', cancel); if (model) model.traverse((o) => { o.geometry?.dispose(); }); R.dispose(); root.remove(); resolve(value); };
    const cancel = () => finish(null), key = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); } };
    q('[data-ipv="cancel"]').onclick = cancel;
    q('[data-ipv="ok"]').onclick = () => { if (!current || q('[data-ipv="ok"]').disabled) return; current = { ...current, components: current.components.map((c) => ({ ...c, g: { ...c.g } })) }; current.audit = { ...current.audit, scaleConfirmed: true, destination: { label: destination }, reviewedAt: new Date().toISOString(), ...(simp ? { simplified: simp } : {}) };
      if (simp) current.triangles = simp.to;
      // the chosen ground floor goes to height 0, and the floors go with the model when they are to become the project's levels
      if (det && det.floors.length && q('[data-ipv-uselv]').checked && !q('[data-ipv-floors]').hidden) { const g = withGround(det, +q('[data-ipv-ground]').value); for (const c of current.components) c.g.z = +(c.g.z + g.offset).toFixed(4); current.levels = { floors: g.floors, note: det.note, offset: g.offset }; current.audit.levels = { found: det.floors.length, ground: g.floors[g.ground]?.name, offset: g.offset }; }
      finish(current); };
    q('[data-ipv-unit]').onchange = build; q('[data-ipv-up]').onchange = build;
    q('[data-ipv-simp]').onchange = simplify; q('[data-ipv-err]').onchange = simplify; q('[data-ipv-target]').onchange = () => { if (q('[data-ipv-simp]').checked) simplify(); };
    addEventListener('resize', size); addEventListener('keydown', key, true); addEventListener('hashchange', cancel, { once: true });
    size(); build(); loop(); q('[data-ipv="ok"]').focus();
  });
}
