import * as S from '../store.js';
import { SIMS, PAGE } from '../data.js';
import { esc, when, setCurrent, toast } from '../app.js';
import { createViewport } from '../viewport.js';

export function render(app) {
  const ps = S.projects();
  const groups = [...new Set(SIMS.map((s) => s.group))];
  app.innerHTML = `<div class="wrap">
  <section class="hero">
    <div>
      <span class="eyebrow">Architecture analysis in the browser</span>
      <h1>Test a design before you commit to it.</h1>
      <p class="lede">Bring in a model, organise it, and run sun, daylight, wind, stormwater, acoustics, movement and structure studies. Every result is saved with the model version it came from, so you can compare what a design change actually did.</p>
      <div class="cta"><a class="btn primary" href="#/workspace">Open your workspace</a><a class="btn" href="#/simulations">Browse ${SIMS.length} simulations</a></div>
    </div>
    <div class="shot" id="heroVp" aria-label="Sample project model"></div>
  </section>

  <div class="flow" aria-label="How it works">
    ${['Upload a model', 'Organise layers and components', 'Save a version', 'Pick a simulation', 'Run the analysis', 'Save the result', 'Compare versions'].map((t, i) => `<div><b>${String(i + 1).padStart(2, '0')}</b>${t}</div>`).join('')}
  </div>

  <div class="sec-h"><h2>Your projects</h2><button class="btn" id="newP">New project</button></div>
  <div class="grid g3">${ps.map((p) => `<article class="card pcard"><h3>${esc(p.name)}</h3>
    <p class="meta">${p.versions.length} version${p.versions.length === 1 ? '' : 's'} · ${p.runs.length} saved result${p.runs.length === 1 ? '' : 's'} · ${when(p.updated)}</p>
    <div class="acts"><a class="btn sm primary" href="#/workspace/${p.id}" data-p="${p.id}">Open</a><a class="btn sm" href="#/results/${p.id}" data-p="${p.id}">Results</a></div></article>`).join('')}
  </div>

  <div class="sec-h"><h2>Simulations</h2><a class="btn ghost" href="#/simulations">All simulations →</a></div>
  <div class="grid g4">${groups.map((g) => `<div class="card"><span class="eyebrow">${g}</span><p style="margin-top:8px">${SIMS.filter((s) => s.group === g).map((s) => esc(s.name)).join(' · ')}</p></div>`).join('')}</div>

  <div class="sec-h"><h2>Free resources</h2><a class="btn ghost" href="#/resources">All resources →</a></div>
  <div class="grid g3">
    <a class="card" href="#/resources" style="text-decoration:none"><span class="eyebrow">AI image tools</span><p style="margin-top:8px">Cut-outs, line drawings, upscaling, sky replacement and material drawings.</p></a>
    <a class="card" href="#/resources" style="text-decoration:none"><span class="eyebrow">CAD &amp; 3D files</span><p style="margin-top:8px">CAD blocks, Rhino and Revit sets, case study models and templates.</p></a>
    <a class="card" href="#/resources" style="text-decoration:none"><span class="eyebrow">References</span><p style="margin-top:8px">Building code, accessibility, LEED and ergonomics finders.</p></a>
  </div>
  <p class="note" style="margin-top:36px">Prototype. Projects are stored in this browser only. Results marked <span class="tag mock">Mock</span> are prototype estimates; the full analysis runs in the existing PlotCloud tools (<a href="${PAGE('tools')}">current tools page</a>). <button class="btn sm ghost" id="reset">Reset sample data</button></p>
</div>`;
  app.querySelectorAll('[data-p]').forEach((a) => a.addEventListener('click', () => setCurrent(S.project(a.dataset.p))));
  app.querySelector('#newP').onclick = () => { const name = prompt('Project name', 'New project'); if (name === null) return; const p = S.createProject(name.trim() || 'New project', { units: 'm', north: 0, layers: [{ name: 'Imported', color: '#d5d2cb', visible: true, locked: false }], components: [] }); setCurrent(p); toast('Project created'); location.hash = '#/workspace/' + p.id; };
  app.querySelector('#reset').onclick = () => { if (!confirm('Remove all prototype projects in this browser and restore the sample?')) return; S.reset(); location.hash = '#/'; location.reload(); };
  // the sample model in the hero, as people will see it in the workspace
  const sample = ps.find((p) => p.sample) || ps[0]; let vp = null;
  if (sample) try { vp = createViewport(app.querySelector('#heroVp')); vp.setModel(sample.versions.at(-1)?.model || sample.draft, { refit: true }); } catch (e) { app.querySelector('#heroVp').textContent = ''; }
}
