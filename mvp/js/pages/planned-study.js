import {simulationPresentation} from '../simulation-presentation.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function render(app,sim){
  const p=simulationPresentation(sim);
  app.innerHTML=`<section class="planned-study wrap" aria-labelledby="plannedStudyTitle">
    <nav aria-label="Study navigation"><a class="btn sm" href="#/workspace">← Back to Workspace</a> <a class="btn sm" href="#/simulations">Browse available studies</a></nav>
    <div class="planned-study-layout"><figure><img src="${esc(p.image)}" alt="${esc(sim.name)} concept on the shared white ${sim.scope==='Interior'?'interior':'site'} model" width="1672" height="941"><figcaption>Concept illustration · Not a calculated result</figcaption></figure>
    <div class="planned-study-copy"><span class="study-soon">Coming soon</span><p class="eyebrow">${esc(sim.scope)} study</p><h1 id="plannedStudyTitle">${esc(sim.name)}</h1><h2>${esc(p.question)}</h2><p>${esc(sim.intent)}</p><p class="planned-study-status">This study is in planning. Calculations and report results are not available yet.</p><h3>Planned inputs</h3><ul>${sim.inputs.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></div></div>
  </section>`;
}
