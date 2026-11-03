// The public homepage (2026-10-31): a floating pill nav, a short direct headline over an interactive site model, and a grid of
// cards that each show one thing PlotCloud does, animated and answering the pointer. Every card is drawn in code (SVG), so it
// works with no images; a card can also show a picture from mvp/img/home/ (prompts in docs/home-image-prompts.md) when one exists.
// The earlier homepage stays at #/home-classic. Public navigation is shared with the information and authentication pages.
import * as S from '../store.js';
import {SIMS} from '../data.js';
import {simulationPresentation} from '../simulation-presentation.js';
import {mountDriftWall} from '../drift-wall.js';
import {publicNav,bindPublicNav} from '../public-chrome.js';
import {currentProject} from '../app.js';
import {comparisonPlan} from '../home-plan-comparison.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const RAMP = ['#26306b', '#2f6db3', '#3fa6a0', '#9ccf6b', '#f2d44a', '#f08a2c'];
const ramp = (t) => RAMP[Math.max(0, Math.min(RAMP.length - 1, Math.round(t * (RAMP.length - 1))))];
// isometric projection of (x, y, z) metres-ish units into the card's SVG space
const iso = (x, y, z, s = 1, ox = 0, oy = 0) => [ox + (x - y) * 0.866 * s, oy + (x + y) * 0.5 * s - z * s];
const pts = (a) => a.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');
function box(x, y, w, d, h, s, ox, oy, cls = '') {   // an extruded block: top, left and right faces
  const P = (a, b, c) => iso(a, b, c, s, ox, oy), t = [P(x, y, h), P(x + w, y, h), P(x + w, y + d, h), P(x, y + d, h)];
  return `<g class="${cls}"><polygon class="f-l" points="${pts([P(x, y + d, 0), P(x + w, y + d, 0), P(x + w, y + d, h), P(x, y + d, h)])}"/><polygon class="f-r" points="${pts([P(x + w, y, 0), P(x + w, y + d, 0), P(x + w, y + d, h), P(x + w, y, h)])}"/><polygon class="f-t" points="${pts(t)}"/></g>`;
}

export async function render(app, rest, params, context = {}) {
  const user = S.account().user, alive = () => (context.isCurrent ? context.isCurrent() : true);
  document.body.classList.add('lp-full');
  const start = '#/new-project';
  app.innerHTML = `<div class="lp">
  ${publicNav()}

  <header class="lp-hero lp-hero-drift">
    <div class="lp-copy"><div class="lp-eyebrow">Building performance, made visible</div><h1>Understand your building.<br><span>Test every design decision.</span></h1>
      <p>Test sun, daylight, wind and snow in one model. Compare Plan A with Plan B, then turn saved simulation results into a report for your next design review.</p>
      <div class="lp-actions"><a class="lp-btn lp-big" href="${start}">Start a project</a><a class="lp-ghost" href="#lp-studies">See what it does</a></div></div>
    <div class="lp-drift-stage"><div id="lpDriftWall"></div></div>
    <div class="lp-drift-controls"><div class="lp-drift-caption" id="lpDriftCaption"><b>Explore all ${SIMS.length} simulations.</b><span>Hover to lift a card. Click to open its study.</span></div><button type="button" id="lpDriftPause" aria-pressed="false">Pause wall</button></div>
    <p class="lp-drift-note">Illustrative previews · Shared with the Workspace study cards</p>
  </header>

  <section class="lp-intro"><div class="lp-eyebrow">Sketch. Simulate. Compare.</div><h2>See what a design change does.</h2><p>Explore sun, daylight and wind before the next design review. Keep the model, study settings and results together.</p></section>
  <section class="lp-simulation" aria-labelledby="lp-sim-heading"><div class="lp-sim-copy"><div class="lp-eyebrow">Simulation comes first</div><h2 id="lp-sim-heading">One model.<br>Different questions.</h2><div class="lp-study-tabs" role="group" aria-label="Preview a simulation">${['Daylight','Wind flow','Sun hours'].map((name,i)=>`<button type="button" data-study="${i}" aria-pressed="${i===0}">${name}<span>↗</span></button>`).join('')}</div><p id="lpStudyText">Read how daylight reaches into a room and compare changes to openings and layout.</p><a class="lp-ghost" id="lpStudyLink" href="#/simulations/daylight">Explore Daylight</a></div><figure class="lp-study-figure"><div class="lp-study-canvas"><img id="lpStudyImage" src="img/home/daylight.webp" alt="Illustrative daylight mesh across a white apartment model" width="1200" height="750"></div><figcaption>Illustrative study preview · Open a study for its inputs, method and calculated results.</figcaption></figure></section>
  <section class="lp-illustration" aria-labelledby="lp-illustration-heading"><figure><img src="img/home/illustration-interior.webp" alt="Illustrative apartment cutaway axonometric with blue furniture linework and bold blue cut walls" width="1600" height="900" loading="lazy"><figcaption>Illustrative artwork · Inspired by the Workspace Illustration display mode.</figcaption></figure><div><div class="lp-eyebrow">From model to presentation</div><h2 id="lp-illustration-heading">Make the space<br>easy to read.</h2><p>Present a cutaway view of the interior, with one ink for the edges, bold cut walls and quiet paper-coloured faces. Keep the rooms and furniture visible.</p><p class="lp-illustration-how">In Workspace: Perspective → Display mode → Illustration.<br>Choose the ink colour, frame the view and save a PNG from Export model.</p><a class="lp-ghost" href="#/workspace">Open Workspace</a></div></section>
  <p class="lp-demo-note">Interactive demonstrations and AI illustrations · Sample quantities are illustrative, not project results. Hover over the massing preview to explore the model.</p>
  <section class="lp-grid" id="lp-studies">
    <article class="lp-card lp-c1" data-card="figures"><div class="lp-vis" id="lpFigures"></div><h3>Read the model quantities</h3><p>Floor area, footprint and storeys update with every edit. No take-offs, no waiting for a rebuild.</p></article>
    <article class="lp-card lp-c2" data-card="massing"><div class="lp-vis" id="lpMassing"><svg viewBox="0 0 760 330"></svg><div class="lp-tip" id="lpTip"><small>Drag to change storeys</small><b>Height 18.0 m</b><b>6 storeys</b></div></div><h3>Fast massing iterations</h3><p>Push and pull masses straight in the model. Storeys and heights change in seconds, so you compare options instead of committing to one.</p></article>
    <article class="lp-card lp-c3" data-card="site"><div class="lp-vis" id="lpSite"><div class="lp-type"><span id="lpAddr"></span><i></i></div><svg viewBox="0 0 400 260"></svg></div><h3>The site from an address</h3><p>Terrain, surrounding buildings, roads and weather are fetched for the address you type, ready before the first study.</p></article>
    <article class="lp-card lp-c4" data-card="compare"><div class="lp-vis" id="lpCompare"></div><h3>Compare design decisions</h3><p>Every saved version is a sketch. See floor area and study results side by side and export them to Excel.</p></article>
    <article class="lp-card lp-c5" data-card="studies"><div class="lp-vis" id="lpStudies"></div><h3>Every study in one place</h3><p>Building and interior studies open inside the Workspace and run on the version you are drawing.</p></article>
    <article class="lp-card lp-c6 lp-report" data-card="report" aria-labelledby="lpReportTitle"><div id="lpReportDemo"></div><div class="lp-report-copy"><div class="lp-eyebrow">The simulation report</div><h3 id="lpReportTitle">Two plans.<br>One clear comparison.</h3><p>Compare Plan A and Plan B, then generate a simulation report from your saved results. Bring the evidence to your next design review.</p><ul><li>Recorded metrics and available analysis maps</li><li>Model versions, inputs and calculation methods</li><li>PDF report, with CSV and JSON evidence exports</li></ul><a class="lp-btn lp-big" href="${currentProject() ? '#/comparison-report/'+encodeURIComponent(currentProject().id) : start}">Create a simulation report ↗</a><small>Save two design versions and their study results to compare them.</small></div></article>
  </section>

  <section class="lp-band"><h2>Screening for early design.</h2><p>Studies are estimates for comparing options, with their method and inputs kept with every result. They are not code compliance.</p><a class="lp-btn lp-big" href="${start}">Start a project</a></section>
  <footer class="lp-foot"><span>plot<b>cloud</b></span><a href="#/pricing">Pricing</a><a href="#/resources">Resources</a><a href="#/legal">Legal</a></footer>
</div>`;
  const stops = [mountDriftWall(app.querySelector('#lpDriftWall'),SIMS.map(simulationPresentation),{pauseButton:app.querySelector('#lpDriftPause'),onActive:item=>{const caption=app.querySelector('#lpDriftCaption');caption.querySelector('b').textContent=item?item.title:`Explore all ${SIMS.length} simulations.`;caption.querySelector('span').textContent=item?item.question:'Hover to lift a card. Click to open its study.';}}), figures(app), massing(app), site(app), compare(app), studies(app), drawings(app), simulationPreview(app)];
  // optional pictures (generated from docs/home-image-prompts.md): shown only when the file exists
  for (const [k, file] of [['massing', 'massing'], ['site', 'site']]) { const im = new Image(); im.onload = () => { if (!alive()) return; const v = app.querySelector(`[data-card="${k}"] .lp-vis`); if (v) { im.className = 'lp-photo'; im.alt = ''; v.prepend(im); v.classList.add('has-photo'); } }; im.src = `img/home/${file}.webp`; }
  app.querySelectorAll('a[href="#lp-studies"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();app.querySelector('#lp-studies').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}));
  const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('lp-visible');observer.unobserve(e.target);}}),{threshold:.08});
  const nav=bindPublicNav(app),onScroll=()=>nav.classList.toggle('is-scrolled',scrollY>40);onScroll();addEventListener('scroll',onScroll,{passive:true});
  app.querySelectorAll('.lp-card,.lp-simulation,.lp-illustration,.lp-intro,.lp-band').forEach(el=>{el.classList.add('lp-reveal');observer.observe(el);});
  return () => { removeEventListener('scroll',onScroll);observer.disconnect();stops.forEach((f) => f?.()); document.body.classList.remove('lp-full'); };
}

function simulationPreview(app){
  const items=[['Daylight','daylight',simulationPresentation(SIMS.find(s=>s.id==='daylight')).image,'Read how daylight reaches into a room and compare changes to openings and layout.'],['Wind flow','wind',simulationPresentation(SIMS.find(s=>s.id==='wind')).image,'Inspect pedestrian-level wind speed and sheltered areas around the massing. A horizontal 2D flow screening, with blue-to-red speed colours and flow paths.'],['Sun hours','sunhours',simulationPresentation(SIMS.find(s=>s.id==='sunhours')).image,'Compare accumulated direct sunlight across the site with a shared location, date and study period. Read the exposure grid alongside the sun path.']];
  const buttons=[...app.querySelectorAll('[data-study]')],image=app.querySelector('#lpStudyImage');
  const select=index=>{const [name,id,src,description]=items[index];buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));image.src=src;image.alt=`${name} — illustrative architectural study preview`;app.querySelector('#lpStudyText').textContent=description;const link=app.querySelector('#lpStudyLink');link.textContent=`Explore ${name}`;link.href=`#/simulations/${id}`;};
  buttons.forEach((button,i)=>button.addEventListener('click',()=>select(i)));
  select(0);
  const canvas=app.querySelector('.lp-study-canvas'),motion=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,point=null;
  const track=e=>{
    if(e.pointerType==='touch'||motion.matches)return;
    const r=canvas.getBoundingClientRect();point={x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};
    if(frame)return;
    frame=requestAnimationFrame(()=>{frame=0;canvas.style.setProperty('--spot-x',point.x*100+'%');canvas.style.setProperty('--spot-y',point.y*100+'%');canvas.style.setProperty('--shadow-x',((point.x-.5)*30).toFixed(1)+'px');canvas.style.setProperty('--shadow-y',(14+point.y*15).toFixed(1)+'px');canvas.classList.add('is-tracking');});
  };
  const reset=()=>{cancelAnimationFrame(frame);frame=0;canvas.classList.remove('is-tracking');};
  canvas.addEventListener('pointermove',track);canvas.addEventListener('pointerleave',reset);canvas.addEventListener('pointercancel',reset);
  return ()=>{reset();canvas.removeEventListener('pointermove',track);canvas.removeEventListener('pointerleave',reset);canvas.removeEventListener('pointercancel',reset);};
}

// live figures: a table whose numbers move as storeys change, and a small bar chart beside it
function figures(app) {
  const host = app.querySelector('#lpFigures'); let st = 6, dir = 1;
  const draw = () => { const fp = 1450, gfa = fp * st, prev = fp * (st - dir);
    host.innerHTML = `<div class="lp-table"><div class="lp-tabs"><b>Building</b><span>Site</span><span>Space</span><span>Results</span></div>
      <div><span>Gross floor area</span><em class="${dir > 0 ? 'up' : 'down'}">${dir > 0 ? '+' : '−'}${(1450).toLocaleString('en')}</em><b>${gfa.toLocaleString('en')} m²</b></div><div><span>Footprint</span><b>${fp.toLocaleString('en')} m²</b></div><div><span>Storeys</span><b>${st}</b></div><div><span>Height</span><b>${(st * 3).toFixed(1)} m</b></div></div>
      <div class="lp-chart"><small><b>Solar exposure · demo</b></small><div>${[30, 34, 41, 48, 56, 63, 72, 79, 88].map((h, i) => `<i style="height:${Math.max(6, h - st * 4 + 20)}%;background:${ramp(i / 8)}"></i>`).join('')}</div></div>`; void prev; };
  draw(); const t = setInterval(() => { if (st >= 9) dir = -1; if (st <= 4) dir = 1; st += dir; draw(); }, 1600);
  return () => clearInterval(t);
}
// massing: drag a block up and down; storeys and height follow, with a measurement tooltip
function massing(app) {
  const svg = app.querySelector('#lpMassing svg'), tip = app.querySelector('#lpTip'), s = 7.5, ox = 380, oy = 120; let st = 6, drag = null, phase = 0;
  const draw = () => { let g = `<polygon class="lp-plot" points="${pts([iso(0, 0, 0, s, ox, oy), iso(40, 0, 0, s, ox, oy), iso(40, 28, 0, s, ox, oy), iso(0, 28, 0, s, ox, oy)])}"/>`;
    for (let k = 0; k < 5; k++) g += box(3 + k * 7, 2, 5, 6, 6, s, ox, oy, 'lp-house');
    for (let k = 0; k < 4; k++) g += box(30, 10 + k * 4.5, 7, 3.5, 5, s, ox, oy, 'lp-house');
    g += box(8, 14, 16, 10, st * 2.2, s, ox, oy, 'lp-mass');
    for (let k = 1; k < st; k++) { const a = iso(8, 24, k * 2.2, s, ox, oy), b = iso(24, 24, k * 2.2, s, ox, oy), c = iso(24, 14, k * 2.2, s, ox, oy); g += `<polyline class="lp-floor" points="${pts([a, b, c])}"/>`; }
    const top = iso(16, 19, st * 2.2, s, ox, oy); g += `<circle class="lp-handle" cx="${top[0].toFixed(1)}" cy="${top[1].toFixed(1)}" r="7"/>`;
    svg.innerHTML = g;svg.setAttribute('aria-valuenow',String(st)); tip.style.left = (top[0] / 760 * 100 + 3) + '%'; tip.style.top = (top[1] / 330 * 100 - 6) + '%'; tip.querySelectorAll('b')[0].textContent = `Height ${(st * 3).toFixed(1)} m`; tip.querySelectorAll('b')[1].textContent = `${st} storeys`; };
  const yToSt = (y) => { const r = svg.getBoundingClientRect(), vy = (y - r.top) / r.height * 330, base = iso(16, 19, 0, s, ox, oy)[1]; return Math.max(1, Math.min(9, Math.round((base - vy) / (2.2 * s)))); };
  svg.addEventListener('pointerdown', (e) => { drag = true; svg.setPointerCapture(e.pointerId); st = yToSt(e.clientY); draw(); });
  svg.addEventListener('pointermove', (e) => { if (drag) { st = yToSt(e.clientY); draw(); } });
  svg.addEventListener('pointerup', () => { drag = false; });
  svg.addEventListener('pointercancel',()=>{drag=false;});
  svg.setAttribute('tabindex','0');svg.setAttribute('role','slider');svg.setAttribute('aria-label','Illustrative massing storeys');svg.setAttribute('aria-valuemin','1');svg.setAttribute('aria-valuemax','9');
  svg.addEventListener('keydown',e=>{if(['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].includes(e.key)){e.preventDefault();st=Math.max(1,Math.min(9,st+(['ArrowUp','ArrowRight'].includes(e.key)?1:-1)));draw();}});
  draw(); const t = setInterval(() => { if (drag || svg.matches(':hover')||svg.matches(':focus')||matchMedia('(prefers-reduced-motion: reduce)').matches) return; phase += 1; st = Math.round(5 + 3 * Math.sin(phase / 2)); draw(); }, 900);
  return () => clearInterval(t);
}
// site from an address: the address types itself, then contours and buildings draw in
function site(app) {
  const addr = app.querySelector('#lpAddr'), svg = app.querySelector('#lpSite svg'), places = ['4371 Fir St, Burnaby', '1 Queen St W, Toronto', 'Kungsgatan 4, Stockholm', 'Shibuya 2-21, Tokyo'];
  let pi = 0, ci = 0, wait = 0, drawn = -1;
  const drawSite = (seed) => { const R = (n) => (Math.sin(seed * 99 + n * 7.13) + 1) / 2; let g = '';
    for (let k = 0; k < 7; k++) { let d = ''; for (let a = 0; a <= 64; a++) { const t = a / 64 * Math.PI * 2, r = 30 + k * 16 + 8 * Math.sin(t * 3 + seed + k) ; d += (a ? 'L' : 'M') + (200 + r * Math.cos(t) * 1.6).toFixed(1) + ',' + (130 + r * Math.sin(t) * 0.8).toFixed(1); } g += `<path d="${d}" class="lp-contour" style="animation-delay:${k * 80}ms"/>`; }
    g += `<path d="M0,${150 + 30 * R(1)} C120,${120 + 40 * R(2)} 260,${190 - 40 * R(3)} 400,${140 + 30 * R(4)}" class="lp-road"/>`;
    for (let k = 0; k < 16; k++) { const x = 40 + R(k + 5) * 320, y = 40 + R(k + 25) * 180, w = 12 + R(k + 45) * 22, h = 10 + R(k + 65) * 16; g += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" class="lp-bldg" style="animation-delay:${300 + k * 40}ms"/>`; }
    g += `<circle cx="200" cy="130" r="6" class="lp-pin"/>`; svg.innerHTML = g; };
  const t = setInterval(() => { const a = places[pi];
    if (ci <= a.length) { addr.textContent = a.slice(0, ci++); return; }
    if (drawn !== pi) { drawn = pi; drawSite(pi + 1); }
    if (++wait > 26) { wait = 0; ci = 0; pi = (pi + 1) % places.length; } }, 90);
  return () => clearInterval(t);
}
// compare sketches: three sketch columns; the current one moves along
function compare(app) {
  const host = app.querySelector('#lpCompare'), S3 = [['Sketch 1', 8700, 62], ['Sketch 2', 11600, 54], ['Sketch 3', 9900, 71]]; let cur = 0;
  const draw = () => { host.innerHTML = `<div class="lp-sk">${S3.map(([n, g, s], i) => `<div class="${i === cur ? 'cur' : ''}"><i style="--h:${30 + i * 18}%"></i><b>${n}</b><small>${i === cur ? 'Current' : 'v' + (i + 1)}</small><span>${g.toLocaleString('en')} m²</span><span>${s}% ≥ 2 h sun</span></div>`).join('')}</div>`; };
  draw(); const t = setInterval(() => { cur = (cur + 1) % 3; draw(); }, 2200);
  host.addEventListener('pointerover', (e) => { const d = e.target.closest('.lp-sk > div'); if (d) { cur = [...d.parentNode.children].indexOf(d); draw(); } });
  return () => clearInterval(t);
}
// every study in one place: the study list, one lit at a time
function studies(app) {
  const host = app.querySelector('#lpStudies'), L = [['Building', ['Sun hours', 'Solar radiation', 'Wind flow', 'Outdoor comfort', 'Daylight']], ['Interior', ['Room acoustics', 'Views', 'Natural ventilation', 'Evacuation', 'Space syntax']]];
  host.innerHTML = L.map(([c, xs]) => `<div><small>${c}</small>${xs.map((x) => `<span>${esc(x)}</span>`).join('')}</div>`).join('');
  const all = [...host.querySelectorAll('span')]; let k = 0; const t = setInterval(() => { all.forEach((s, i) => s.classList.toggle('on', i === k)); k = (k + 1) % all.length; }, 700);
  return () => clearInterval(t);
}
// A schematic comparison, deliberately separate from saved engine evidence.
function drawings(app) {
  const host=app.querySelector('#lpReportDemo');
  const plan=comparisonPlan;
  host.innerHTML=`<div class="lp-report-toolbar"><span>DAYLIGHT · DESIGN OPTIONS</span><div role="group" aria-label="Choose comparison view"><button type="button" data-report-view="0" aria-pressed="false">Plan A</button><button type="button" data-report-view="50" aria-pressed="true">Compare</button><button type="button" data-report-view="100" aria-pressed="false">Plan B</button></div></div><div class="lp-report-wipe" style="--reveal:50%"><div class="lp-report-layer">${plan('A')}</div><div class="lp-report-layer lp-report-layer-b">${plan('B')}</div><span class="lp-report-label label-a">A · Enclosed layout</span><span class="lp-report-label label-b">B · Open living + kitchen</span><div class="lp-report-divider"><span>↔</span></div></div><label class="lp-report-range">Drag to compare<input type="range" min="0" max="100" value="50" aria-label="Reveal Plan B" aria-valuetext="Plan A and Plan B side by side"></label><div class="lp-report-evidence"><span>01 / COMPARE</span><b id="lpReportState" role="status">Plan A + Plan B · Side by side</b><span>02 / REPORT ↗</span></div><p class="lp-report-disclaimer">Schematic interaction demo · Colours are illustrative, not calculated results. Reports use your saved engine runs.</p>`;
  const input=host.querySelector('input'),wipe=host.querySelector('.lp-report-wipe'),buttons=[...host.querySelectorAll('button')];
  const update=()=>{const value=Number(input.value),description=value===0?'Plan A · Enclosed layout':value===100?'Plan B · Open living + kitchen':'Plan A + Plan B · Side by side';wipe.style.setProperty('--reveal',value+'%');host.querySelector('.label-a').hidden=value===100;host.querySelector('.label-b').hidden=value===0;buttons.forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.reportView)===value)));input.setAttribute('aria-valuetext',description);host.querySelector('#lpReportState').textContent=description;};
  input.addEventListener('input',update);
  const drag=e=>{if(e.type==='pointermove'&&!wipe.hasPointerCapture(e.pointerId))return;const rect=wipe.getBoundingClientRect();input.value=Math.round(100-Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width))*100);update();};
  const grab=e=>{wipe.setPointerCapture(e.pointerId);drag(e);};
  wipe.addEventListener('pointerdown',grab);wipe.addEventListener('pointermove',drag);
  const select=e=>{input.value=e.currentTarget.dataset.reportView;update();};
  buttons.forEach(b=>b.addEventListener('click',select));
  return ()=>{wipe.removeEventListener('pointerdown',grab);wipe.removeEventListener('pointermove',drag);input.removeEventListener('input',update);buttons.forEach(b=>b.removeEventListener('click',select));};
}
