import * as S from '../store.js';
import { PAGE, FULL, LAYER_COLORS } from '../data.js';
import { $, $$, esc, when, toast, currentProject, setCurrent } from '../app.js';
import { createViewport, importModel } from '../viewport.js';

const TYPES = ['wall', 'slab', 'roof', 'window', 'room', 'mass', 'terrain', 'furniture', 'imported'];
const MATS = ['Concrete', 'Plaster', 'Gypsum', 'Glass', 'Timber', 'Carpet', 'Acoustic panel', 'Grass', 'Context', 'Imported'];
const NEW = {
  mass: { name: 'Massing block', type: 'mass', layer: 'Context', g: { x: 0, y: -6, z: 0, w: 6, d: 4, h: 6 }, mat: 'Context' },
  wall: { name: 'Wall', type: 'wall', layer: 'Walls', g: { x: 0, y: 0, z: 0, w: 4, d: 0.2, h: 3 }, mat: 'Plaster' },
  window: { name: 'Window', type: 'window', layer: 'Glazing', g: { x: 1, y: -0.02, z: 0.9, w: 1.5, d: 0.3, h: 1.4 }, mat: 'Glass' },
  room: { name: 'Room', type: 'room', layer: 'Rooms', g: { x: 0, y: 0, z: 0, w: 5, d: 4, h: 3 }, mat: 'Room', room: { floor: 'Timber', ceiling: 'Gypsum' } },
  slab: { name: 'Slab', type: 'slab', layer: 'Structure', g: { x: 0, y: 0, z: -0.2, w: 6, d: 6, h: 0.2 }, mat: 'Concrete' },
};

export function render(app, [pid]) {
  const p = (pid && S.project(pid)) || currentProject();
  if (!p) { app.innerHTML = '<div class="wrap"><p>No project yet. <a href="#/">Create one on Home.</a></p></div>'; return; }
  setCurrent(p);
  const M = () => p.draft;
  let sel = null, mode = 'shaded', open = new Set(['Walls', 'Glazing', 'Rooms', 'Imported']);
  const last = () => p.versions.at(-1);
  const dirty = () => !last() || JSON.stringify(last().model) !== JSON.stringify(p.draft);

  app.innerHTML = `<div class="ws">
  <aside aria-label="Model and layers">
    <div class="pane"><h2>Project</h2>
      <select class="inp" id="proj" aria-label="Project">${S.projects().map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <p class="note">Site: ${esc(p.site?.label || '—')}${p.site?.sample ? ' (sample)' : ''} · north ${p.site?.north ?? 0}°</p><p class="note">${p.sample ? 'Sample project with mock results. Edits are kept in this browser.' : 'Stored in this browser.'}</p>
    </div>
    <div class="pane"><h2>Model</h2>
      <div class="drop" id="drop"><button class="btn sm" id="pick">Import .obj · .stl · .glb</button><div style="margin-top:6px">or drop a file here · read locally</div></div>
      <input type="file" id="file" accept=".obj,.stl,.glb,.gltf" hidden>
      <div class="grid g2"><label class="f">Units<select id="unit"><option value="1">Metres</option><option value="0.001">Millimetres</option><option value="0.01">Centimetres</option><option value="0.3048">Feet</option></select></label>
        <label class="f">Up axis<select id="up"><option value="auto">File default</option><option value="z">Z up</option><option value="y">Y up</option></select></label></div>
      <p class="msg note" id="impMsg" role="status"></p>
      <label class="f">Add a component<select id="add"><option value="">Choose…</option><option value="mass">Massing block</option><option value="wall">Wall</option><option value="window">Window</option><option value="room">Room (for acoustics, daylight)</option><option value="slab">Slab</option></select></label>
      <p class="note">Detailed modelling stays in the existing tools: <a href="${PAGE('studio')}" target="_blank" rel="noopener">Plan Studio ↗</a> · <a href="${PAGE('site')}" target="_blank" rel="noopener">Site Planner ↗</a> · <a href="${FULL('tracer')}" target="_blank" rel="noopener">Plan tracer ↗</a>. Bringing their models into a project here is <span class="tag plan">Planned</span>.</p>
    </div>
    <div class="pane"><h2>Layers &amp; components <button class="btn sm" id="addLayer">+ Layer</button></h2><div id="layers"></div></div>
  </aside>
  <section class="stage" aria-label="3D model">
    <div class="vp" id="vp"></div>
    <div class="bar"><div class="seg" id="modes" role="group" aria-label="View"><button data-m="shaded" aria-pressed="true">Shaded</button><button data-m="wire" aria-pressed="false">Wireframe</button><button data-m="plan" aria-pressed="false">Plan</button></div>
      <button class="btn" id="fit">Fit</button><button class="btn" id="png">PNG</button></div>
    <div class="badge" id="state"></div>
    <div class="hint" id="hint">Drag to orbit · right-drag to pan · scroll to zoom · click to select</div>
  </section>
  <aside class="r" aria-label="Properties and versions">
    <div class="pane" id="props"></div>
    <div class="pane"><h2>Versions</h2>
      <p id="dirty" class="dirty"></p>
      <label class="f">Describe this version<input id="note" placeholder="e.g. Larger south windows"></label>
      <button class="btn primary" id="saveV">Save version</button>
      <div id="versions"></div>
    </div>
    <div class="pane"><h2>Next</h2><a class="btn accent" id="toSim" href="#/simulations">Choose a simulation</a><p class="note">Simulations run on a saved version, so each result stays linked to the exact model it came from.</p></div>
  </aside></div>`;

  const vp = createViewport($('#vp', app), { onPick: (id) => select(id) });
  const persist = () => { S.save(); state(); };
  function refresh(refit) { vp.setModel(M(), { refit }); vp.select(sel); layers(); props(); state(); }
  function state() {
    const v = last(), d = dirty();
    $('#state', app).innerHTML = `${esc(p.name)} · ${v ? 'v' + v.n : 'no version yet'}${d ? ' · <span class="dirty">unsaved changes</span>' : ''}`;
    $('#dirty', app).textContent = d ? (v ? `Changes since v${v.n} are not saved.` : 'Save the first version to run simulations.') : `Up to date with v${v.n}.`;
    $('#versions', app).innerHTML = p.versions.slice().reverse().map((x) => `<div class="vrow ${x === v && !d ? 'cur' : ''}"><span class="vn">v${x.n}</span><div><div>${esc(x.note)}</div><div class="vmeta">${when(x.created)} · ${p.runs.filter((r) => r.versionId === x.id).length} results</div></div>
      <div style="display:grid;gap:4px"><button class="btn sm" data-load="${x.id}">Open</button><a class="btn sm" href="#/simulations?project=${p.id}&version=${x.id}">Simulate</a></div></div>`).join('') || '<p class="note">No versions yet.</p>';
    $$('[data-load]', app).forEach((b) => b.onclick = () => { if (dirty() && !confirm('Discard unsaved changes and open this version?')) return; p.draft = S.clone(S.version(p, b.dataset.load).model); sel = null; persist(); refresh(true); toast('Version opened'); });
    $('#toSim', app).href = v ? `#/simulations?project=${p.id}&version=${v.id}` : '#/simulations';
  }
  function layers() {
    const host = $('#layers', app), comps = M().components;
    for (const c of comps) if (!M().layers.find((l) => l.name === c.layer)) M().layers.push({ name: c.layer, color: LAYER_COLORS[c.layer] || '#ccc', visible: true, locked: false });
    host.innerHTML = M().layers.map((l, i) => { const list = comps.filter((c) => c.layer === l.name); return `<div class="layer ${l.visible ? '' : 'off'}">
      <div class="lh"><span class="sw" style="background:${l.color}"></span><span><button data-open="${i}" aria-expanded="${open.has(l.name)}" style="color:inherit;font-size:13px;padding:0">${open.has(l.name) ? '▾' : '▸'} ${esc(l.name)}</button></span><span class="cnt">${list.length}</span>
      <button data-vis="${i}" title="${l.visible ? 'Hide' : 'Show'} layer" aria-pressed="${l.visible}">${l.visible ? 'Hide' : 'Show'}</button><button data-lock="${i}" title="Locked layers cannot be selected" aria-pressed="${l.locked}">${l.locked ? 'Locked' : 'Lock'}</button></div>
      ${open.has(l.name) ? `<div class="comps">${list.map((c) => `<button data-sel="${c.id}" aria-current="${c.id === sel}">${esc(c.name)}</button>`).join('') || '<span class="note">Empty</span>'}</div>` : ''}</div>`; }).join('');
    $$('[data-open]', host).forEach((b) => b.onclick = () => { const n = M().layers[b.dataset.open].name; open.has(n) ? open.delete(n) : open.add(n); layers(); });
    $$('[data-vis]', host).forEach((b) => b.onclick = () => { const l = M().layers[b.dataset.vis]; l.visible = !l.visible; persist(); refresh(); });
    $$('[data-lock]', host).forEach((b) => b.onclick = () => { const l = M().layers[b.dataset.lock]; l.locked = !l.locked; if (l.locked && comp(sel)?.layer === l.name) sel = null; persist(); refresh(); });
    $$('[data-sel]', host).forEach((b) => b.onclick = () => select(b.dataset.sel));
  }
  const comp = (id) => M().components.find((c) => c.id === id);
  function select(id) { const c = comp(id); if (c && M().layers.find((l) => l.name === c.layer)?.locked) id = null; sel = id; if (c) open.add(c.layer); vp.select(sel); layers(); props(); }
  function props() {
    const host = $('#props', app), c = comp(sel);
    if (!c) { const n = M().components.length; host.innerHTML = `<h2>Selection</h2><p class="note">Click a component in the model or in the layer list. ${n} components on ${M().layers.length} layers.</p>`; return; }
    const isMesh = !!c.mesh, num = (k, label) => `<label class="f">${label}<input type="number" step="0.05" data-g="${k}" value="${c.g[k]}" ${isMesh && 'wdh'.includes(k) ? 'disabled title="Imported meshes keep their size"' : ''}></label>`;
    host.innerHTML = `<h2>Selection <button class="btn sm" id="desel">Clear</button></h2>
      <label class="f">Name<input id="pName" value="${esc(c.name)}"></label>
      <div class="grid g2"><label class="f">Layer<select id="pLayer">${M().layers.map((l) => `<option ${l.name === c.layer ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>
        <label class="f">Type<select id="pType">${TYPES.map((t) => `<option ${t === c.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
      ${c.type === 'room' ? `<div class="grid g2"><label class="f">Floor finish<select data-room="floor">${MATS.map((m) => `<option ${m === c.room?.floor ? 'selected' : ''}>${m}</option>`).join('')}</select></label><label class="f">Ceiling finish<select data-room="ceiling">${MATS.map((m) => `<option ${m === c.room?.ceiling ? 'selected' : ''}>${m}</option>`).join('')}</select></label></div>`
        : `<label class="f">Material<select id="pMat">${MATS.map((m) => `<option ${m === c.mat ? 'selected' : ''}>${m}</option>`).join('')}</select></label>`}
      <span class="note">Position (m)</span><div class="dims">${num('x', 'x')}${num('y', 'y')}${num('z', 'z')}</div>
      <span class="note">Size (m)</span><div class="dims">${num('w', 'Width')}${num('d', 'Depth')}${num('h', 'Height')}</div>
      <div class="grid g2"><button class="btn" id="dup">Duplicate</button><button class="btn danger" id="del">Delete</button></div>`;
    const ch = () => { persist(); vp.setModel(M()); vp.select(sel); };
    $('#desel', host).onclick = () => select(null);
    $('#pName', host).onchange = (e) => { c.name = e.target.value.trim() || c.name; persist(); layers(); };
    $('#pLayer', host).onchange = (e) => { c.layer = e.target.value; ch(); layers(); };
    $('#pType', host).onchange = (e) => { c.type = e.target.value; if (c.type === 'room' && !c.room) c.room = { floor: 'Timber', ceiling: 'Gypsum' }; ch(); props(); };
    $('#pMat', host)?.addEventListener('change', (e) => { c.mat = e.target.value; ch(); });
    $$('[data-room]', host).forEach((s) => s.onchange = () => { c.room = { ...c.room, [s.dataset.room]: s.value }; ch(); });
    $$('[data-g]', host).forEach((i) => i.onchange = () => { const v = parseFloat(i.value); if (!Number.isFinite(v) || ('wdh'.includes(i.dataset.g) && v <= 0)) { i.value = c.g[i.dataset.g]; return; } c.g[i.dataset.g] = v; ch(); });
    $('#dup', host).onclick = () => { const n = S.clone(c); n.id = S.uid('c'); n.name = c.name + ' copy'; n.g.x += 1; M().components.push(n); persist(); select(n.id); vp.setModel(M()); vp.select(sel); };
    $('#del', host).onclick = () => { M().components = M().components.filter((x) => x.id !== c.id); sel = null; persist(); refresh(); };
  }

  $('#proj', app).onchange = (e) => { location.hash = '#/workspace/' + e.target.value; };
  $$('#modes button', app).forEach((b) => b.onclick = () => { mode = b.dataset.m; $$('#modes button', app).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); vp.setMode(mode); vp.select(sel);
    $('#hint', app).textContent = mode === 'plan' ? 'Drag to pan · scroll to zoom · click to select' : mode === 'wire' ? 'Wireframe: edges only, rooms in amber — the view used for acoustics' : 'Drag to orbit · right-drag to pan · scroll to zoom · click to select'; });
  $('#fit', app).onclick = () => vp.fit();
  $('#png', app).onclick = () => { const a = document.createElement('a'); a.href = vp.png(); a.download = `${p.name.replace(/\W+/g, '-')}.png`; a.click(); };
  $('#add', app).onchange = (e) => { const k = e.target.value; if (!k) return; const n = { id: S.uid('c'), ...S.clone(NEW[k]) }; M().components.push(n); e.target.value = ''; persist(); refresh(); select(n.id); toast(`${n.name} added on ${n.layer}`); };
  $('#addLayer', app).onclick = () => { const name = prompt('Layer name'); if (!name || M().layers.find((l) => l.name === name.trim())) return; M().layers.push({ name: name.trim(), color: '#cfcac0', visible: true, locked: false }); open.add(name.trim()); persist(); layers(); };
  $('#saveV', app).onclick = () => { if (!dirty() && last()) { toast('No changes since v' + last().n); return; } const v = S.saveVersion(p, $('#note', app).value.trim()); $('#note', app).value = ''; state(); toast(`Saved v${v.n}`); };
  // import: a working local reader for common mesh formats
  const doImport = async (f) => { const msg = $('#impMsg', app); msg.textContent = 'Reading ' + f.name + '…';
    try { const r = await importModel(f, { unit: +$('#unit', app).value, up: $('#up', app).value }); for (const c of r.components) M().components.push({ id: S.uid('c'), ...c }); open.add('Imported'); persist(); refresh(true);
      msg.textContent = `${f.name}: ${r.components.length} component${r.components.length > 1 ? 's' : ''}, ${r.triangles.toLocaleString('en-CA')} triangles on layer Imported.${S.persistent() ? '' : ' Browser storage is unavailable; save will not persist.'}`; }
    catch (e) { msg.textContent = e.message; } };
  $('#pick', app).onclick = () => $('#file', app).click();
  $('#file', app).onchange = (e) => { const f = e.target.files[0]; if (f) doImport(f); e.target.value = ''; };
  const drop = $('#drop', app);
  ['dragenter', 'dragover'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.remove('over'); if (n === 'drop' && e.dataTransfer.files[0]) doImport(e.dataTransfer.files[0]); }));
  refresh(true);
}
