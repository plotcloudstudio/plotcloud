import * as S from '../store.js';
import { SIMS, simImg } from '../data.js';
import { $, $$, esc, currentProject, currentVersion, LIVE, img } from '../app.js';

export async function render(app, [simId], params) {
  const sim = SIMS.find((s) => s.id === simId);
  if (sim) return (await import('./sim-engine.js')).render(app, sim, params);   // every simulation runs its PlotCloud engine
  return catalog(app, params);
}

function catalog(app, params) {
  const p = currentProject(), v = p && currentVersion(p);
  const q = (s) => `#/simulations/${s.id}`;   // one route per simulation, whichever page you come from
  const groups = ['All', 'Interior', 'Exterior', ...new Set(SIMS.map((s) => s.group))];
  let g = 'All'; try { g = groups.includes(localStorage.getItem('pc-mvp-simgroup')) ? localStorage.getItem('pc-mvp-simgroup') : 'All'; } catch (e) { }
  app.innerHTML = `<div class="wrap">
    <span class="eyebrow">Simulations</span>
    <div class="split" style="margin-top:16px"><h1 class="display">Choose a study.<br><span>Run it on a version.</span></h1>
      <p class="lede">All ${SIMS.length} analysis tools PlotCloud has today. Each runs its PlotCloud engine on a version of your model, with site and climate from Account; save a result to the version and Results compares them.</p></div>
    ${p ? `<p class="badge-pill" style="margin-top:32px;text-transform:none;letter-spacing:0;font:500 14px var(--sans)">Running on&nbsp;<b>${esc(p.name)}</b>&nbsp;· ${v ? `v${v.n}` : 'no saved version yet'} · ${esc((S.siteOf(p)?.label || '').split(',')[0])}</p>` : ''}
    <div class="pills" role="group" aria-label="Filter" style="margin-top:36px" id="filters">${groups.map((x) => `<button type="button" data-g="${x}" aria-pressed="${x === g}">${x}</button>`).join('')}</div>
    <div class="simgrid" id="grid"></div>
    <p class="note" style="margin-top:28px">${LIVE} every study runs the PlotCloud simulation engine itself. Catalogue images are illustrative previews using the same model and camera; they are not computed project results. All studies are for design screening, not code compliance.</p>
  </div>`;
  const draw = () => { $('#grid', app).innerHTML = SIMS.map((s, i) => [s, i]).filter(([s]) => g === 'All' || s.group === g || s.scope === g).map(([s, i]) => `<article class="card sim" data-scope="${s.scope}" data-sim="${s.id}">
      <a class="thumb" href="${q(s)}" tabindex="-1" aria-hidden="true"><img data-holo="${simImg(s.id)}" src="${img(simImg(s.id))}" alt="" loading="lazy"></a>
      <div class="top2"><span>${String(i + 1).padStart(2, '0')} · ${esc(s.group)} · ${esc(s.scope)}</span><span>${s.view === 'wire' ? 'Wireframe' : s.view === 'plan' ? 'Plan' : '3D'}</span></div>
      <h3>${esc(s.name)}</h3><p class="muted">${esc(s.blurb)}</p><p class="inputs">Needs · ${s.inputs.map(esc).join(' · ')}</p>
      <div class="acts"><a class="btn sm primary" href="${q(s)}">Enter</a>${LIVE}</div></article>`).join('');
    $$('#filters button', app).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.g === g))); };
  $$('#filters button', app).forEach((b) => b.onclick = () => { g = b.dataset.g; try { localStorage.setItem('pc-mvp-simgroup', g); } catch (e) { } draw(); }); draw();
}
