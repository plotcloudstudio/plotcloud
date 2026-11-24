// The homepage pairs the study wall with a saved study comparison.
import {SIMS} from '../data.js';
import {simulationPresentation} from '../simulation-presentation.js';
import {mountDriftWall} from '../drift-wall.js';
import {publicNav,bindPublicNav,publicBrand} from '../public-chrome.js';
import {featureMarkup, mountFeatures, comparisonMarkup} from '../home-feature-demos.js?v=3';

export function render(app) {
  document.body.classList.add('lp-full');
  app.innerHTML = `<div class="lp">
  ${publicNav()}

  <header class="lp-hero lp-hero-drift lp-hero-full" aria-labelledby="lpHeroTitle">
    <div class="lp-hero-lead" data-enter>
      <div><span class="lp-hero-eyebrow">Building simulation for early design</span>
        <h1 id="lpHeroTitle">Simulate your site<br><span>and building.</span></h1></div>
      <div class="lp-hero-summary"><p>Study sun, daylight, wind and circulation on one model. Compare design versions and export the results for review.</p>
        <div class="lp-hero-cta"><a class="lp-btn lp-big" href="#/new-project">Start a project <span aria-hidden="true">↗</span></a><a class="lp-hero-alt" href="#/start-study">Try an example <span aria-hidden="true">→</span></a></div></div>
    </div>
    <div class="lp-wall">
      <div class="lp-drift-controls">
        <div class="lp-drift-caption" id="lpDriftCaption"><b>Explore the studies</b><span>Interactive previews</span></div>
        <button type="button" id="lpDriftPause" aria-pressed="false">Pause wall</button>
      </div>
      <div class="lp-drift-stage"><div id="lpDriftWall"></div></div>
    </div>
    <ol class="lp-flow" aria-label="The workflow">${[['Site analysis', 'Site, terrain and context'], ['Plan Studio', 'Draw or import the building'], ['Simulation', 'Run studies on a version'], ['Reports', 'Figures and the report to export']].map(([t, d], i) => `<li><span>0${i + 1}</span><b>${t}</b><small>${d}</small></li>`).join('')}</ol>
  </header>

  ${featureMarkup}
  <section class="lp-compare-story" aria-labelledby="lpCompareTitle">
    <div class="lp-compare-heading">
      <div><span class="lp-hero-eyebrow">Version comparison</span><h2 id="lpCompareTitle">Compare two layouts<br><span>on the same site.</span></h2>
      <p>Compare baseline glazing with larger south windows in the Courtyard Studio model. Both plans use the same site, view and daylight study settings.</p></div>
      <a class="lp-btn lp-big" href="#/new-project">Start a project <span aria-hidden="true">↗</span></a>
    </div>
    <div id="lpReportDemo"></div>
  </section>
  <footer class="lp-foot">${publicBrand()}<a href="#/pricing">Pricing</a><a href="#/resources">Resources</a><a href="#/legal">Legal</a></footer>
</div>`;
  const wallStudies = SIMS.filter((sim) => sim.status !== 'planned').map(sim => {   // only studies that run (2026-11-16: no "Coming soon" on the wall)
    const study = simulationPresentation(sim);
    return study.id === 'watersound' ? { ...study, image: 'img/fallingwater-cover.jpg' } : study;
  });
  const stops = [mountFeatures(app),mountDriftWall(app.querySelector('#lpDriftWall'),wallStudies,{pauseButton:app.querySelector('#lpDriftPause'),onActive:item=>{const caption=app.querySelector('#lpDriftCaption');caption.querySelector('b').textContent=item?item.title+(item.status==='planned'?' · Coming soon':''):'Explore the studies';caption.querySelector('span').textContent=item?item.question:'Interactive previews';}}), drawings(app)];
  const nav=bindPublicNav(app),onScroll=()=>nav.classList.toggle('is-scrolled',scrollY>40);onScroll();addEventListener('scroll',onScroll,{passive:true});
  return () => { removeEventListener('scroll',onScroll);stops.forEach((f) => f?.()); document.body.classList.remove('lp-full'); };
}

function drawings(app) {
  const host=app.querySelector('#lpReportDemo');
  host.innerHTML=comparisonMarkup();
  const input=host.querySelector('input'),wipe=host.querySelector('.lp-report-wipe'),buttons=[...host.querySelectorAll('button')];
  const update=()=>{const value=Number(input.value),description=value===0?'Plan A · Baseline glazing':value===100?'Plan B · Larger south windows':'Plan A + Plan B · Split view';wipe.style.setProperty('--reveal',value+'%');wipe.querySelector('.lp-report-divider').hidden=value===0||value===100;host.querySelector('.label-a').hidden=value===100;host.querySelector('.label-b').hidden=value===0;buttons.forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.reportView)===value)));input.setAttribute('aria-valuetext',description);host.querySelector('#lpReportState').textContent=description;};
  input.addEventListener('input',update);
  const drag=e=>{if(e.type==='pointermove'&&!wipe.hasPointerCapture(e.pointerId))return;const rect=wipe.getBoundingClientRect();input.value=Math.round(100-Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width))*100);update();};
  const grab=e=>{wipe.setPointerCapture(e.pointerId);drag(e);};
  wipe.addEventListener('pointerdown',grab);wipe.addEventListener('pointermove',drag);
  const select=e=>{input.value=e.currentTarget.dataset.reportView;update();};
  buttons.forEach(b=>b.addEventListener('click',select));
  return ()=>{wipe.removeEventListener('pointerdown',grab);wipe.removeEventListener('pointermove',drag);input.removeEventListener('input',update);buttons.forEach(b=>b.removeEventListener('click',select));};
}
