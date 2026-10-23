import * as S from '../store.js';
import { mountHomeHero } from '../home-hero.js';
import { SIMS, simImg } from '../data.js';
import { esc, img, setCurrent } from '../app.js';

export function render(app) {
  const logo = document.querySelector('.brand .logo')?.outerHTML || 'plotcloud';
  const A = S.account();
  const uses = [['Latitude, longitude and time', 'Sun hours · Daylight · View analysis'], ['True north', 'Sun · Daylight · Wind · Natural ventilation'], ['A year of weather', 'Daylight · Natural ventilation · Wind flow'],
    ['Rainfall and terrain', 'Stormwater & waterlogging'], ['Buildings around the site', 'Sun · Daylight · Wind · Views']];
  app.innerHTML = `<div class="wrap">
  <section class="hero">
    <span class="badge-pill">One site · ${SIMS.length} simulations · every version</span>
    <h1 class="display" style="margin-top:28px">Test the design<br><span>on the real site.</span></h1>
    <p class="lede">Pin the site once, anywhere in the world. Sun, daylight, wind, stormwater, acoustics, movement and structure run on the same location, climate and model, and every result is saved with the version it came from.</p>
    <div class="cta"><a class="btn accent lg" href="#/${A.user ? 'account' : 'login?signup=1'}">${A.user ? 'Set your site →' : 'Start free →'}</a><a class="btn lg" href="#/workspace">Open the workspace</a></div>
    <p class="eyebrow" style="margin-top:18px;color:var(--mut2)">Sample project included · runs in the browser</p>
    <figure class="shot home-hero-study" aria-label="Interactive Toronto environmental study">
      <iframe title="Toronto CN Tower — interactive Sun, Wind, Rain and Sound study" data-home-hero loading="eager"></iframe>
      <figcaption class="sr-only">Illustrative Toronto maquette, not your project's simulation results. Move the pointer or drag to explore. The scene advances Sun, Wind, Rain, Sound on refresh and return.</figcaption></figure>
  </section>

  <section class="section">
    <div class="kicker"><b>01</b>One site, every study</div>
    <div class="split" style="margin-top:22px;align-items:start">
      <div><h2 class="display md">Pin it once.<br><span>Every study uses it.</span></h2>
        <p class="lede" style="margin-top:22px">Set the location in your account, anywhere in the world. Elevation, a year of weather, the climate class and the buildings around the site are read for the pin and shared by every simulation in your projects. Anything not found is marked missing, never guessed.</p>
        <a class="btn lg" href="#/account" style="margin-top:28px">See the site settings →</a></div>
      <ol class="numlist">${uses.map(([a, b], i) => `<li><span>0${i + 1}</span><div><b>${a}</b><p>${b}</p></div></li>`).join('')}</ol>
    </div>
  </section>

  <section class="section">
    <div class="kicker"><b>02</b>Simulations</div>
    <div class="split" style="margin-top:22px"><h2 class="display md">${SIMS.length === 14 ? 'Fourteen' : SIMS.length} studies.<br><span>Real engines.</span></h2>
      <p class="lede">Each one is a working PlotCloud tool with its method and limits written down. Results are screening studies for design decisions, not code compliance.</p></div>
    <div class="figs">
      <figure><img data-holo="sim-daylight" src="${img('sim-daylight')}" alt="Daylight study view"><figcaption><b>Sun &amp; daylight</b><span>3D view · whole year</span></figcaption></figure>
      <figure><img data-holo="sim-acoustics" src="${img('sim-acoustics')}" alt="Acoustic wavefronts in the studio room"><figcaption><b>Indoor acoustics</b><span>Wireframe view · per room</span></figcaption></figure>
      <figure><img data-holo="sim-wind" src="${img('sim-wind')}" alt="Wind streamlines around the massing"><figcaption><b>Wind &amp; stormwater</b><span>Site · streamlines and runoff</span></figcaption></figure>
    </div>
    <ol class="simmini" style="margin-top:56px">${SIMS.map((s, i) => `<li><a href="#/simulations/${s.id}"><img data-holo="${simImg(s.id)}" src="${img(simImg(s.id))}" alt="" loading="lazy"><span class="n">${String(i + 1).padStart(2, '0')}</span><b>${esc(s.name)}</b><p>${esc(s.blurb)}</p></a></li>`).join('')}</ol>
    <a class="btn lg" href="#/simulations" style="margin-top:28px">Browse simulations →</a>
  </section>

  <section class="section">
    <div class="kicker"><b>03</b>Versions</div>
    <h2 class="display md" style="margin-top:22px">Change the design.<br><span>See what it did.</span></h2>
    <div class="grid g2" style="margin-top:44px">
      <figure class="shot" style="margin:0;height:340px"><img data-holo="heroA" src="${img('heroA')}" alt="Version 1"><figcaption class="chip" style="left:16px;top:16px">V1 · Baseline</figcaption></figure>
      <figure class="shot" style="margin:0;height:340px"><img data-holo="hero" src="${img('hero')}" alt="Version 2"><figcaption class="chip" style="left:16px;top:16px">V2 · Wider glazing · acoustic ceiling</figcaption></figure></div>
    <div class="stats"><div><small>sDA 300/50%</small><b>41 → <em>50</em><i> %</i></b></div><div><small>RT60 · studio room</small><b>2.66 → <em>0.55</em><i> s</i></b></div><div><small>Facade sun</small><b>2.2 → <em>1.9</em><i> h/day</i></b></div></div>
    <p class="note">Sample project, prototype estimates labelled Mock. Same settings on both versions, so the difference comes from the design.</p>
    <a class="btn lg" href="#/results" style="margin-top:24px">Compare versions →</a>
  </section>

  <section class="section">
    <div class="kicker"><b>04</b>Free resources</div>
    <h2 class="display sm" style="margin-top:22px">Tools and files,<br><span>free to use.</span></h2>
    <div class="pills" style="margin-top:28px">${['Image toolkit', 'Architectural drawing', 'Color palettes', 'Pin-up composer', 'CAD blocks', 'Rhino & Revit sets', 'Case study models', 'Building code finder'].map((r) => `<a class="btn" href="#/resources">${r}</a>`).join('')}</div>
  </section>

  <section class="section">
    <div class="kicker"><b>05</b>Pricing</div>
    <div class="split" style="margin-top:22px"><h2 class="display sm">Free tools.<br><span>Pro projects.</span></h2>
      <div><p class="lede">Every analysis tool is free. PlotCloud Pro keeps your projects, versions and results together: CAD 9 a month or CAD 79 a year, 7 days free.</p><a class="btn lg" href="#/pricing" style="margin-top:20px">See pricing →</a></div></div>
  </section>
  </div>
  <footer class="foot">${logo}<span>Prototype · screening studies for design, not code compliance · <a href="../index.html#/home">classic site</a></span></footer>`;
  app.querySelectorAll('[data-p]').forEach((a) => a.addEventListener('click', () => setCurrent(S.project(a.dataset.p))));
  return mountHomeHero(app.querySelector('.home-hero-study'));
}
