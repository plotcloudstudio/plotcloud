import * as S from '../store.js';
import { SIMS, simImg } from '../data.js';
import { $, $$, esc, currentProject, currentVersion, LIVE, img } from '../app.js';

const DOMAINS = [
  { id: 'climate-site', name: 'Climate & Site', note: 'Sun, weather, wind, water and environmental exposure around the building.', sims: ['sunhours', 'radiation', 'utci', 'wind', 'stormwater', 'noise'] },
  { id: 'light-views', name: 'Light & Views', note: 'Daylight and visibility evidence for rooms, façades and occupied areas.', sims: ['daylight', 'views', 'privacy'] },
  { id: 'indoor-comfort', name: 'Air & Indoor Comfort', note: 'Natural airflow and room-acoustic screening tied to the current design version.', sims: ['vent', 'acoustics'] },
  { id: 'spatial', name: 'Spatial Performance', note: 'Visibility, movement, wayfinding and coverage studies. These do not predict human behaviour.', sims: ['spacesyntax', 'movementdepth', 'evac', 'isovist', 'wayfinding', 'cameras'] },
  { id: 'structure', name: 'Structural Screening', note: 'Preliminary structural response and member sizing before engineer-led code design.', sims: ['structure'] },
];

const EVIDENCE = {
  sunhours: ['Benchmarked geometry', 'Direct sun; no reflected radiation', 'checked'],
  radiation: ['Benchmarked model', 'No façade or ground reflections', 'checked'],
  utci: ['Benchmarked model', 'Outdoor screening; no CFD', 'checked'],
  daylight: ['Partly benchmarked', 'Not a Radiance annual simulation', 'partial'],
  wind: ['Screening engine', 'Not wind-tunnel validated', 'screen'],
  vent: ['Screening engine', 'Airflow network; not CFD', 'screen'],
  stormwater: ['Screening engine', 'Early site-drainage study', 'screen'],
  acoustics: ['Benchmarked formulas', 'No sound insulation or room modes', 'checked'],
  noise: ['Benchmarked formula', 'Not a measured noise assessment', 'checked'],
  spacesyntax: ['Screening engine', 'Does not predict behaviour', 'screen'],
  movementdepth: ['Screening engine', 'Movement estimate, not observation', 'screen'],
  evac: ['Screening engine', 'Not fire or life safety', 'screen'],
  isovist: ['Screening engine', 'Visibility geometry only', 'screen'],
  views: ['Screening engine', 'Not a certification result', 'screen'],
  wayfinding: ['Screening engine', 'Signage and route study', 'screen'],
  privacy: ['Screening engine', 'Visibility geometry only', 'screen'],
  cameras: ['Screening engine', 'Security designer review required', 'screen'],
  structure: ['Screening engine', 'Not code design', 'screen'],
};

export async function render(app, [simId], params) {
  const sim = SIMS.find((s) => s.id === simId);
  if (sim) return (await import('./sim-engine.js')).render(app, sim, params);   // every simulation runs its PlotCloud engine
  return catalog(app, params);
}

function catalog(app, params) {
  const p = currentProject(), v = p && currentVersion(p);
  const q = (s) => `#/simulations/${s.id}`;   // one route per simulation, whichever page you come from
  const groups = [{ id: 'all', name: 'All studies' }, { id: 'Interior', name: 'Interior' }, { id: 'Exterior', name: 'Exterior' }, ...DOMAINS.map((d) => ({ id: d.id, name: d.name }))];
  let g = 'all'; try { g = groups.some((x) => x.id === localStorage.getItem('pc-mvp-simgroup')) ? localStorage.getItem('pc-mvp-simgroup') : 'all'; } catch (e) { }
  app.innerHTML = `<div class="wrap">
    <span class="eyebrow">Simulations</span>
    <div class="split sim-lead"><h1 class="display">Test a decision.<br><span>Keep the evidence.</span></h1>
      <p class="lede">Choose from ${SIMS.length} early-design studies. Every run stays linked to its project, model version, shared conditions and settings so Results can compare options on the same basis.</p></div>
    ${p ? `<p class="badge-pill" style="margin-top:32px;text-transform:none;letter-spacing:0;font:500 14px var(--sans)">Running on&nbsp;<b>${esc(p.name)}</b>&nbsp;· ${v ? `v${v.n}` : 'no saved version yet'} · ${esc((S.siteOf(p)?.label || '').split(',')[0])}</p>` : ''}
    <section class="sim-evidence" aria-labelledby="sim-evidence-title"><div><span class="eyebrow">Evidence model</span><h2 id="sim-evidence-title">Know what each result can support.</h2></div><ol><li><b>01 · Screen</b><span>Use every study to find risks and compare early options.</span></li><li><b>02 · Verify</b><span>Look for benchmarked components and read the stated limits.</span></li><li><b>03 · Document</b><span>Save the run to the exact version, inputs and conditions.</span></li><li><b>04 · Review</b><span>Keep consultant, code and certification decisions explicit.</span></li></ol></section>
    <aside class="sim-gap" aria-label="Coverage still to add"><b>Still missing from a complete building-performance stack</b><p>Whole-building energy, peak heating and cooling loads, indoor thermal comfort, operational and embodied carbon, glare and electric lighting, plus fire, smoke, queues and occupant evacuation. PlotCloud does not infer these from the studies below.</p></aside>
    <div class="pills sim-filters" role="group" aria-label="Filter simulations" id="filters">${groups.map((x) => `<button type="button" data-g="${x.id}" aria-pressed="${x.id === g}">${x.name}</button>`).join('')}</div>
    <div class="simgrid" id="grid"></div>
    <p class="note sim-footnote">${LIVE} marks a calculation produced by a PlotCloud engine, not professional validation. Catalogue images are illustrative previews using the same model and camera; they are not computed project results. All studies are for design screening unless a method states otherwise.</p>
  </div>`;
  // what each simulation needs from the open project (2026-10-25): a site or masses, or rooms
  const NEEDS = { sunhours: 'mass', radiation: 'mass', utci: 'mass', wind: 'mass', noise: 'mass', stormwater: 'any', structure: 'none' }, st = v && v.model && v.model.studio;
  const hasRooms = !!(st ? (st.walls || []).length >= 3 : v && v.model && (v.model.components || []).some((c) => c.type === 'wall')), hasMass = hasRooms || !!(st && ((st.masses || []).length || st.site));
  const ready = (s) => { if (!p || !v) return ''; const n = NEEDS[s.id] || 'rooms', okk = n === 'mass' ? hasMass : n === 'rooms' ? hasRooms : true;
    const t = okk ? 'Ready for this project' : n === 'mass' ? 'Needs a site or masses' : (st && (st.masses || []).length ? 'Needs rooms · Make floors from a mass' : 'Needs rooms');
    return `<span class="rdy${okk ? '' : ' no'}" title="${n === 'mass' ? 'Works on masses and the site' : n === 'rooms' ? 'Reads rooms, walls and openings' : 'Works on any model'}">${t}</span>`; };
  const card = (s) => { const i = SIMS.indexOf(s), evidence = EVIDENCE[s.id] || ['Screening engine', 'Read the method and limits', 'screen']; return `<article class="card sim" data-scope="${s.scope}" data-sim="${s.id}">
      <a class="thumb" href="${q(s)}" tabindex="-1" aria-hidden="true"><img data-holo="${simImg(s.id)}" src="${img(simImg(s.id))}" alt="" loading="lazy"></a>
      <div class="top2"><span>${String(i + 1).padStart(2, '0')} · ${esc(s.group)} · ${esc(s.scope)}</span><span>${s.view === 'wire' ? 'Wireframe' : s.view === 'plan' ? 'Plan' : '3D'}</span></div>
      <div class="sim-tags"><span class="sim-tag ${evidence[2]}">${esc(evidence[0])}</span><span class="sim-tag limit">${esc(evidence[1])}</span></div>
      <h3>${esc(s.id === 'evac' ? 'Circulation & travel paths' : s.name)}</h3><p class="muted">${esc(s.id === 'evac' ? 'Compare everyday walking routes, trip distance and concentration between destinations.' : s.blurb)}</p><p class="inputs">Needs · ${s.inputs.map(esc).join(' · ')}</p>
      <div class="acts"><a class="btn sm primary" href="${q(s)}">Open study</a>${LIVE}${ready(s)}</div></article>`; };
  const draw = () => { const sections = DOMAINS.map((d, di) => { const found = d.sims.map((id) => SIMS.find((s) => s.id === id)).filter(Boolean).filter((s) => g === 'all' || g === d.id || s.scope === g); if (!found.length) return ''; return `<section class="sim-domain" data-domain="${d.id}" aria-labelledby="sim-domain-${d.id}"><div class="sim-domain-head"><div><span>${String(di + 1).padStart(2, '0')}</span><h2 id="sim-domain-${d.id}">${d.name}</h2><p>${d.note}</p></div><b>${found.length} ${found.length === 1 ? 'study' : 'studies'}</b></div><div class="sim-domain-grid">${found.map(card).join('')}</div></section>`; }).join(''); $('#grid', app).innerHTML = sections || '<p class="notice">No studies match this filter.</p>';
    $$('#filters button', app).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.g === g))); };
  $$('#filters button', app).forEach((b) => b.onclick = () => { g = b.dataset.g; try { localStorage.setItem('pc-mvp-simgroup', g); } catch (e) { } draw(); }); draw();
}
