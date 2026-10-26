import * as S from '../store.js';
import { SIMS } from '../data.js';
import { $, $$, esc, setCurrent, setCurrentVersion, toast } from '../app.js';
import { SEMANTICS, suggestedSemantic, inferLevels, prepareAnalysisModel } from '../analysis-model.js';

export function render(app, _rest, params = new URLSearchParams()) {
  let imported = null, mapping = {}, levels = [], saved = null;
  const requested = params.get('study'), initial = SIMS.some((s) => s.id === requested) ? requested : 'daylight';
  app.innerHTML = `<div class="wrap quick-sim">
    <span class="eyebrow">Quick Simulation</span>
    <div class="split qs-lead"><div><h1 class="display">Import a model.<br><span>Prepare only what the study needs.</span></h1></div>
      <p class="lede">Skip Site and Plan Studio. PlotCloud keeps the authoring file as the source and creates a separate, traceable analysis proxy. Nothing here changes the Rhino model.</p></div>
    <div class="qs-grid">
      <section class="card qs-step"><span class="eyebrow">01 · Outcome</span><h2>Choose the study first</h2>
        <label class="f">Study<select id="qsStudy">${SIMS.map((s) => `<option value="${s.id}" ${s.id === initial ? 'selected' : ''}>${esc(s.name)} · ${s.scope}</option>`).join('')}</select></label>
        <label class="f">Result name<input id="qsName" value="Imported model study"></label>
        <p class="note" id="qsNeeds"></p></section>
      <section class="card qs-step"><span class="eyebrow">02 · Source</span><h2>Import the authoring model</h2>
        <div class="drop" id="qsDrop"><button class="btn" id="qsPick">Choose .3dm · .obj · .stl · .glb</button><div>or drop it here · processed locally</div></div>
        <input type="file" id="qsFile" accept=".3dm,.obj,.stl,.glb,.gltf" hidden>
        <div class="grid g2"><label class="f">Units for non-Rhino files<select id="qsUnit"><option value="1">Metres</option><option value="0.001">Millimetres</option><option value="0.01">Centimetres</option><option value="0.3048">Feet</option></select></label>
          <label class="f">Up axis<select id="qsUp"><option value="auto">File default</option><option value="z">Z up</option><option value="y">Y up</option></select></label></div>
        <p class="msg note" id="qsMsg" role="status" aria-live="polite">The full file is read, then a browser-sized proxy is generated when needed. Large files are no longer rejected only because of file size or triangle count.</p></section>
    </div>
    <section class="card qs-review" id="qsReview" hidden></section>
    <section class="card qs-levels" id="qsLevels" hidden></section>
    <section class="card qs-ready" id="qsReady" hidden></section>
  </div>`;
  const study = () => $('#qsStudy', app).value, sim = () => SIMS.find((s) => s.id === study());
  const needs = () => { $('#qsNeeds', app).innerHTML = `<b>Needs:</b> ${sim().inputs.map(esc).join(' · ')}<br><span class="note">Location and north are requested only by climate studies; a Site model is not required.</span>`; };
  needs(); $('#qsStudy', app).onchange = () => { needs(); if (imported) initialiseReview(); };

  function initialiseReview() {
    const sources = [...new Set(imported.components.map((c) => c.srcLayer || 'Unclassified'))]; mapping = {};
    for (const layer of sources) mapping[layer] = suggestedSemantic(`${layer} ${imported.components.filter((c) => (c.srcLayer || 'Unclassified') === layer).map((c) => c.name).join(' ')}`, study());
    levels = inferLevels(imported.components, mapping); saved = null; drawReview();
  }
  function drawReview() {
    const host = $('#qsReview', app), by = new Map(); for (const c of imported.components) { const k = c.srcLayer || 'Unclassified', q = by.get(k) || { n: 0, tris: 0 }; q.n++; q.tris += c.sourceTriangles || c.mesh.length / 9; by.set(k, q); }
    host.hidden = false; host.innerHTML = `<div class="sec-h"><div><span class="eyebrow">03 · Meaning</span><h2>Map source layers to analysis roles</h2></div><span class="badge-pill">${by.size} layers · ${imported.components.length} objects</span></div>
      <p class="note">Suggestions come from Rhino layer and object names. Confirm them before running; an imported display mesh is not automatically treated as a room.</p>
      <div class="table-wrap"><table class="qs-table"><thead><tr><th>Source layer</th><th>Objects</th><th>Source triangles</th><th>Use as</th></tr></thead><tbody>${[...by].map(([name, q]) => `<tr><td><b>${esc(name)}</b></td><td>${q.n}</td><td>${Math.round(q.tris).toLocaleString('en')}</td><td><select data-map="${esc(name)}">${SEMANTICS.map(([v, n]) => `<option value="${v}" ${mapping[name] === v ? 'selected' : ''}>${n}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>`;
    $$('[data-map]', host).forEach((el) => el.onchange = () => { mapping[el.dataset.map] = el.value; levels = inferLevels(imported.components, mapping); saved = null; drawLevels(); drawReady(); });
    drawLevels(); drawReady();
  }
  function drawLevels() {
    const host = $('#qsLevels', app); host.hidden = false; host.innerHTML = `<div class="sec-h"><div><span class="eyebrow">04 · Levels</span><h2>Review before the simulation</h2></div><button class="btn sm" id="qsAddLevel">Add level</button></div>
      <p class="note">High confidence means the name contained a level number. Medium and low confidence are geometric suggestions, not verified storeys.</p>
      <div class="table-wrap"><table class="qs-table"><thead><tr><th>Use</th><th>Name</th><th>Elevation</th><th>Detected from</th><th>Confidence</th><th></th></tr></thead><tbody>${levels.map((l, i) => `<tr><td><input type="checkbox" data-lconfirm="${i}" ${l.confirmed ? 'checked' : ''} aria-label="Confirm ${esc(l.name)}"></td><td><input data-lname="${i}" value="${esc(l.name)}"></td><td><input type="number" step="0.01" data-lz="${i}" value="${l.elevation}"> m</td><td>${esc(l.source)}</td><td><span class="qs-confidence ${l.confidence}">${esc(l.confidence)}</span></td><td><button class="btn sm ghost" data-ldel="${i}" aria-label="Remove ${esc(l.name)}">Remove</button></td></tr>`).join('')}</tbody></table></div>`;
    $$('[data-lconfirm]', host).forEach((el) => el.onchange = () => { levels[+el.dataset.lconfirm].confirmed = el.checked; saved = null; drawReady(); });
    $$('[data-lname]', host).forEach((el) => el.onchange = () => { levels[+el.dataset.lname].name = el.value.trim() || `Level ${+el.dataset.lname + 1}`; saved = null; });
    $$('[data-lz]', host).forEach((el) => el.onchange = () => { levels[+el.dataset.lz].elevation = +el.value || 0; saved = null; drawReady(); });
    $$('[data-ldel]', host).forEach((b) => b.onclick = () => { levels.splice(+b.dataset.ldel, 1); saved = null; drawLevels(); drawReady(); });
    $('#qsAddLevel', host).onclick = () => { const z = levels.length ? Math.max(...levels.map((l) => l.elevation)) + 3 : 0; levels.push({ id: `L${levels.length + 1}`, name: `Level ${levels.length + 1}`, elevation: +z.toFixed(2), source: 'User added', confidence: 'high', confirmed: true }); saved = null; drawLevels(); drawReady(); };
  }
  const make = () => prepareAnalysisModel(imported, { studyId: study(), mapping, levels });
  function drawReady() {
    const host = $('#qsReady', app), model = make(), r = model.analysisModel.readiness, cls = r.state === 'not-ready' ? 'no' : r.state === 'limited' ? 'warn' : 'yes'; host.hidden = false;
    host.innerHTML = `<div class="sec-h"><div><span class="eyebrow">05 · Analysis model</span><h2>${r.state === 'ready' ? 'Ready to run' : r.state === 'limited' ? 'Ready with stated limits' : 'Needs attention before running'}</h2></div><span class="rdy ${cls}">${r.state.replace('-', ' ')}</span></div>
      <div class="qs-summary"><div><b>${r.counts.objects}</b><span>included objects</span></div><div><b>${r.counts.walls}</b><span>walls / envelope parts</span></div><div><b>${r.counts.windows}</b><span>windows</span></div><div><b>${levels.filter((l) => l.confirmed).length}/${levels.length}</b><span>confirmed levels</span></div></div>
      ${r.issues.length ? `<div class="notice"><b>Required</b><ul>${r.issues.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${r.limits.length ? `<div class="sim-gap"><b>Recorded limitations</b><ul>${r.limits.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      <p class="note">Source: ${esc(imported.source.name)} · ${(imported.source.bytes / 1048576).toFixed(1)} MB · ${imported.sourceTriangles.toLocaleString('en')} source triangles${imported.simplified ? ` → ${imported.triangles.toLocaleString('en')} proxy triangles` : ''}. The source filename, fingerprint, proxy method, levels and limitations are saved with the version and every result.</p>
      <div class="acts"><button class="btn" id="qsSave">Save analysis model</button><button class="btn primary" id="qsRun" ${r.state === 'not-ready' ? 'disabled' : ''}>Run ${esc(sim().name)}</button><a class="btn ghost" href="#/workspace">Use full Workspace instead</a></div><p class="msg note" id="qsSaveMsg" role="status"></p>`;
    const save = () => { if (saved) return saved; const model2 = make(), name = $('#qsName', app).value.trim() || imported.source.name.replace(/\.[^.]+$/, '');
      const p = S.createProject(name, model2); p.analysisOnly = true; p.siteRequired = false; p.contextIncluded = model2.analysisModel.contextIncluded; p.sourceModel = S.clone(model2.analysisModel.source); p.draft = S.clone(model2);
      const v = S.saveVersion(p, `Imported for ${sim().name}`); setCurrent(p); setCurrentVersion(p, v.id); S.save(); saved = { p, v };
      $('#qsSaveMsg', app).textContent = `Saved as ${p.name} · v${v.n}. Site geometry was not required.`; toast('Analysis model saved'); return saved; };
    $('#qsSave', host).onclick = save; $('#qsRun', host).onclick = () => { const { p, v } = save(); location.hash = `#/simulations/${study()}?project=${p.id}&version=${v.id}`; };
  }
  async function read(file) {
    const msg = $('#qsMsg', app); msg.textContent = `Reading ${file.name}…`; $('#qsPick', app).disabled = true;
    try { const { importModel } = await import('../viewport.js'); imported = await importModel(file, { unit: +$('#qsUnit', app).value, up: $('#qsUp', app).value });
      msg.textContent = imported.simplified ? `Read ${imported.sourceTriangles.toLocaleString('en')} triangles. Created a ${imported.triangles.toLocaleString('en')}-triangle browser proxy; the source count and method will be recorded.` : `Read ${imported.components.length} objects and ${imported.triangles.toLocaleString('en')} triangles.`;
      if ($('#qsName', app).value === 'Imported model study') $('#qsName', app).value = file.name.replace(/\.[^.]+$/, '') + ' study'; initialiseReview(); }
    catch (e) { msg.textContent = e.message || 'The model could not be read.'; }
    finally { $('#qsPick', app).disabled = false; }
  }
  $('#qsPick', app).onclick = () => $('#qsFile', app).click(); $('#qsFile', app).onchange = (e) => { if (e.target.files[0]) read(e.target.files[0]); e.target.value = ''; };
  const drop = $('#qsDrop', app); ['dragenter', 'dragover'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.remove('over'); if (n === 'drop' && e.dataTransfer.files[0]) read(e.dataTransfer.files[0]); }));
  window.__quickSimulation = { read, accept(result) { imported = result; initialiseReview(); }, model: () => imported ? make() : null };
  return () => { delete window.__quickSimulation; };
}
