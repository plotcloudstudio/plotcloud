import {inspectStudy} from '../study-readiness.js';
import {checkAccess, isFreeStudy,canUse} from '../beta-access.js';
import {activateTestingCode,mountTestingAccess,testingStatus,allowsTestingStudy} from '../simulation-test-access.js?v=private-testing-20261027-1';
import * as S from '../store.js';
import { SIMS, simImg } from '../data.js';
import { CATEGORIES, TARGETS, targetStatus, STATUS_LABEL, categoryOf } from '../capabilities.js';
import { $, $$, esc, currentProject, currentVersion, LIVE, img } from '../app.js';

export async function render(app, [simId], params, context={}) {
  if(params.get('test-code')){const code=params.get('test-code');params.delete('test-code');history.replaceState(null,'','#/simulations'+(simId?'/'+encodeURIComponent(simId):'')+(params.toString()?'?'+params.toString():''));try{await activateTestingCode(code);}catch(error){app.innerHTML='<div class="wrap"><h1>Testing access could not be activated.</h1><p role="alert"></p><a href="#/simulations">Browse studies</a></div>';app.querySelector('[role=alert]').textContent=error.message;return;}}
  if(simId==='noise'){app.innerHTML='<div class="wrap"><h1>Study removed</h1><p>Outdoor Noise is no longer available.</p><a class="btn" href="#/simulations">All studies</a></div>';return;}
  const access = await checkAccess();
  const sim = SIMS.find((s) => s.id === simId);
  if(sim?.family==='environment')return(await import('./environment-study.js?v=run-20261031-1')).render(app,sim,params,context);
  if (sim?.id==='structure') return (await import('./structure-study.js?v=run-20261031-1')).render(app,sim,params,context);
  if (sim) return (await import('./sim-engine.js')).render(app, sim, params,context);   // every simulation runs its PlotCloud engine
  return catalog(app, params, access);
}

function thumbnail(s){return `<img data-holo="${simImg(s.id)}" src="${img(simImg(s.id))}" alt="" loading="lazy">`;}

function catalog(app, params, access) {
  const p = currentProject(), v = p && currentVersion(p);
  const q = (s) => `#/simulations/${s.id}`;   // one route per simulation, whichever page you come from
  // three primary analysis types first (plan §4.1); the earlier scope and group filters stay for existing links and habits
  const catOf = (s) => CATEGORIES.find((c) => c.id === categoryOf(s.id))?.label;
  const groups = ['All', ...CATEGORIES.map((c) => c.label)];   // only the three analysis types (an older saved filter falls back to All)
  let g = 'All'; try { g = groups.includes(localStorage.getItem('pc-mvp-simgroup')) ? localStorage.getItem('pc-mvp-simgroup') : 'All'; } catch (e) { }
  app.innerHTML = `<div class="wrap">
    <span class="eyebrow">Simulations</span>
    <div class="split" style="margin-top:16px"><h1 class="display">Choose a study.<br><span>Run it on a version.</span></h1>
      <p class="lede">All simulations are currently free to use. No payment or activation code is required. Browse all ${SIMS.length} current analysis tools. Each runs its PlotCloud engine on a version of your model, using its recorded project conditions; save the result to that version, then compare it in Results.</p></div>
    ${p ? `<p class="badge-pill" style="margin-top:32px;text-transform:none;letter-spacing:0;font:500 14px var(--sans)">Running on&nbsp;<b>${esc(p.name)}</b>&nbsp;· ${v ? `v${v.n}` : 'no saved version yet'} · ${esc((S.siteOf(p)?.label || '').split(',')[0])}</p>` : ''}
    <div class="card" style="margin-top:24px"><h2>New to simulation?</h2><p>Start with an editable example or check your own project. Run a study, save the result, then compare one design change.</p><a class="btn accent" href="#/start-study">Start a guided study</a> <a class="btn" href="#/local-compute">Local reference engines</a><p class="note">Radiance daylight factor and reviewed EnergyPlus jobs run on your computer or a school workstation. Separate engine installation is required.</p></div>
    <div class="pills" role="group" aria-label="Filter" style="margin-top:36px" id="filters">${groups.map((x) => `<button type="button" data-g="${x}" aria-pressed="${x === g}">${x}</button>`).join('')}</div>
    <div class="simgrid" id="grid"></div>
    <details class="card" id="capabilityMap" style="margin-top:28px"><summary><b>Capability map</b> · what each analysis type covers today</summary>
      <p class="note">Status is what PlotCloud runs now. “Not connected” items have no result and no run button; the plan lists what they need. Table views reuse saved runs and never run an engine again.</p>
      ${CATEGORIES.map((c) => `<h3 style="margin-top:16px">${esc(c.label)}</h3><table class="pc-table" data-category="${c.id}"><thead><tr><th>ID</th><th>Capability</th><th>Status</th><th>How</th></tr></thead><tbody>${TARGETS.filter((t) => t.category === c.id).map((t) => { const st = targetStatus(t.id); return `<tr data-target="${t.id}" data-status="${st.status}"><td>${t.id}</td><td>${esc(t.name)}</td><td>${esc(STATUS_LABEL[st.status])}</td><td>${st.via.filter((v) => v !== 'local-compute').map((v) => `<a href="#/simulations/${v}">${esc(SIMS.find((x) => x.id === v)?.name || v)}</a>`).join(', ')}${st.via.length && st.via[0] !== 'local-compute' ? ' — ' : ''}${esc(st.note)}${t.category === 'table' && st.status === 'data' ? ' <a href="#/tables">Open tables</a>' : ''}</td></tr>`; }).join('')}</tbody></table>`).join('')}
    </details>
    <p class="note" style="margin-top:28px">${LIVE} every study runs the PlotCloud simulation engine itself. Catalogue images are illustrative previews using the same model and camera; they are not computed project results. All studies are for design screening, not code compliance.</p>
  </div>`;
  // what each simulation needs from the open project (2026-10-25): a site or masses, or rooms
  const draftChanged=!!(p&&v&&p.draft&&JSON.stringify(p.draft)!==JSON.stringify(v.model));
  const ready=s=>{if(!p)return '<span class="rdy no">Choose a project</span>';const c=S.conditionsOf(p),r=inspectStudy(p,v,s.id,{site:S.isSharedPilot(s.id)||s.id==='vent'?c.site:S.siteOf(p),defaults:S.isSharedPilot(s.id)?c.defaults:S.account().defaults,draftChanged});return `<span class="rdy${r.ready?'':' no'}" title="${esc(r.errors.map(x=>x.title).join('; ')||'Review scope and inputs inside the study; engine geometry checks still apply')}">${r.ready?'Inputs found · review in study':esc(r.errors[0]?.title||'Review inputs')}</span>`;};
  const card = (s) => `<article class="card sim" data-scope="${s.scope}" data-category="${categoryOf(s.id)}" data-sim="${s.id}">
      <a class="thumb" href="${q(s)}" tabindex="-1" aria-hidden="true">${thumbnail(s)}</a>
      <h3>${esc(s.name)}</h3><p class="muted">${esc(s.blurb)}</p><p class="inputs">Needs · ${s.inputs.map(esc).join(' · ')}</p>
      <div class="acts"><a class="btn sm primary" href="${q(s)}">${canUse(s.id) ? 'Enter' : 'Unlock'}</a>${LIVE}${ready(s)}</div></article>`;
  const draw = () => { $('#grid', app).innerHTML = CATEGORIES.filter((c) => g === 'All' || c.label === g).map((c) => `<h2 class="sim-cat" data-category-heading="${c.id}" style="grid-column:1/-1;margin:28px 0 4px">${esc(c.label)}</h2>${SIMS.filter((s) => categoryOf(s.id) === c.id).map(card).join('')}`).join('');
    $$('#filters button', app).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.g === g))); };
  $$('#filters button', app).forEach((b) => b.onclick = () => { g = b.dataset.g; try { localStorage.setItem('pc-mvp-simgroup', g); } catch (e) { } draw(); }); draw();

}
