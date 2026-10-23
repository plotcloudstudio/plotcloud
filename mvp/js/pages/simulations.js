import * as S from '../store.js';
import { SIMS, FULL, simImg } from '../data.js';
import { run as mockRun } from '../mocksim.js';
import { $, $$, esc, fmt, when, toast, currentProject, setCurrent, MOCK, LIVE, img } from '../app.js';
import { createViewport } from '../viewport.js';

export function render(app, [simId], params) {
  const sim = SIMS.find((s) => s.id === simId);
  return sim ? runPage(app, sim, params) : catalog(app, params);
}

function catalog(app, params) {
  const p = params.get('project') ? S.project(params.get('project')) : currentProject(), v = p && (S.version(p, params.get('version')) || p.versions.at(-1));
  const q = (s) => `#/simulations/${s.id}${p ? `?project=${p.id}${v ? '&version=' + v.id : ''}` : ''}`;
  const groups = ['All', ...new Set(SIMS.map((s) => s.group))];
  let g = 'All';
  app.innerHTML = `<div class="wrap">
    <span class="eyebrow">Simulations</span>
    <div class="split" style="margin-top:16px"><h1 class="display">Choose a study.<br><span>Run it on a version.</span></h1>
      <p class="lede">All ${SIMS.length} analysis tools PlotCloud has today. Each runs in full in its own tool; inside a project a preview is saved to the model version so Results can compare them.</p></div>
    ${p ? `<p class="badge-pill" style="margin-top:32px;text-transform:none;letter-spacing:0;font:500 14px var(--sans)">Running on&nbsp;<b>${esc(p.name)}</b>&nbsp;· ${v ? `v${v.n}` : 'no saved version yet'} · ${esc((p.site?.label || '').split(',')[0])}</p>` : ''}
    <div class="pills" role="group" aria-label="Filter" style="margin-top:36px" id="filters">${groups.map((x) => `<button type="button" data-g="${x}" aria-pressed="${x === g}">${x}</button>`).join('')}</div>
    <div class="simgrid" id="grid"></div>
    <p class="note" style="margin-top:28px">${LIVE} opens the existing PlotCloud tool. ${MOCK} previews here use simple model quantities and are for the workflow only. All studies are for design screening, not code compliance.</p>
  </div>`;
  const draw = () => { $('#grid', app).innerHTML = SIMS.map((s, i) => [s, i]).filter(([s]) => g === 'All' || s.group === g).map(([s, i]) => `<article class="card sim">
      <a class="thumb" href="${q(s)}" tabindex="-1" aria-hidden="true"><img data-holo="${simImg(s.id)}" src="${img(simImg(s.id))}" alt="" loading="lazy"></a>
      <div class="top2"><span>${String(i + 1).padStart(2, '0')} · ${esc(s.group)}</span><span>${s.view === 'wire' ? 'Wireframe' : s.view === 'plan' ? 'Plan' : '3D'}</span></div>
      <h3>${esc(s.name)}</h3><p class="muted">${esc(s.blurb)}</p><p class="inputs">Needs · ${s.inputs.map(esc).join(' · ')}</p>
      <div class="acts"><a class="btn sm primary" href="${q(s)}">${v ? `Run on v${v.n}` : 'Preview'}</a><a class="btn sm" href="${FULL(s.tool)}" target="_blank" rel="noopener">Open full tool ↗</a></div></article>`).join('');
    $$('#filters button', app).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.g === g))); };
  $$('#filters button', app).forEach((b) => b.onclick = () => { g = b.dataset.g; draw(); }); draw();
}

function runPage(app, sim, params) {
  const p = (params.get('project') && S.project(params.get('project'))) || currentProject();
  if (!p) { app.innerHTML = '<div class="wrap"><p>No project. <a href="#/">Create one on Home.</a></p></div>'; return; }
  setCurrent(p);
  let v = S.version(p, params.get('version')) || p.versions.at(-1);
  const rooms = () => (v ? v.model.components.filter((c) => c.type === 'room') : []);
  const D = S.account().defaults, vals = {}; for (const f of sim.settings) vals[f.k] = f.type === 'room' ? rooms()[0]?.id : (D[f.k] ?? f.v);
  let result = null;

  app.innerHTML = `<div class="run">
  <aside><div class="pane"><a class="btn sm ghost" href="#/simulations" style="justify-self:start">← All simulations</a><span class="eyebrow" style="color:var(--red)">${sim.group}</span><h1 style="font-size:34px;line-height:1;letter-spacing:-.04em;font-weight:800">${esc(sim.name)}</h1><p class="small muted">${esc(sim.blurb)}</p></div>
    <div class="pane"><h2>Model</h2>
      <label class="f">Project<select id="proj">${S.projects().map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label class="f">Version<select id="ver">${p.versions.slice().reverse().map((x) => `<option value="${x.id}" ${x === v ? 'selected' : ''}>v${x.n} — ${esc(x.note)}</option>`).join('') || '<option>No saved versions</option>'}</select></label>
      <p class="note">Needs: ${sim.inputs.map(esc).join(' · ')}</p><p class="note">Site: ${esc(p.site?.label || '—')}${p.site?.sample ? ' (sample)' : ''} · settings start from <a href="#/account">your defaults</a></p></div>
    <div class="pane"><h2>Full analysis</h2><p class="note">The complete ${esc(sim.name.toLowerCase())} engine, methods and exports are in the existing tool.</p>
      <a class="btn" href="${FULL(sim.tool)}" target="_blank" rel="noopener">Open full tool ↗</a>${LIVE}
      <p class="note">Sending this version's model straight into the tool and saving its result back here is <span class="tag plan">Planned</span>.</p></div>
  </aside>
  <section class="stage"><div class="vp" id="vp"></div>
    <div class="bar"><span class="btn" style="cursor:default">${sim.view === 'wire' ? 'Wireframe' : sim.view === 'plan' ? 'Plan' : 'Shaded'} view</span><button class="btn" id="fit">Fit</button></div>
    <div class="badge" id="vlabel"></div></section>
  <aside class="r">
    <div class="pane"><h2>Settings</h2><div id="form" class="grid"></div>
      <button class="btn accent" id="go" ${v ? '' : 'disabled'}>Run preview</button><div class="prog" id="prog" hidden><i></i></div>
      ${v ? '' : `<p class="note">Save a model version first: <a href="#/workspace/${p.id}">open the workspace</a>.</p>`}</div>
    <div class="pane" id="res"><h2>Result</h2><p class="note">Run a preview to see the result for this version.</p></div>
    <div class="pane"><h2>History on this version</h2><div id="hist"></div></div>
  </aside></div>`;

  const vp = createViewport($('#vp', app));
  vp.setMode(sim.view === 'wire' ? 'wire' : sim.view === 'plan' ? 'plan' : 'shaded');
  function show() {
    vp.setModel(v ? v.model : p.draft, { refit: true });
    vp.markers(sim.id === 'acoustics' ? rooms().find((r) => r.id === vals.room) : null);
    $('#vlabel', app).textContent = v ? `${p.name} · v${v.n}` : `${p.name} · unsaved draft`;
    form(); history();
  }
  function form() {
    $('#form', app).innerHTML = sim.settings.map((f) => f.type === 'select' ? `<label class="f">${f.label}<select data-k="${f.k}">${f.options.map((o) => `<option ${o === vals[f.k] ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`
      : f.type === 'room' ? `<label class="f">${f.label}<select data-k="${f.k}">${rooms().map((r) => `<option value="${r.id}" ${r.id === vals[f.k] ? 'selected' : ''}>${esc(r.name)}</option>`).join('') || '<option value="">No room in this version</option>'}</select></label>`
      : `<label class="f">${f.label}<input type="number" step="${f.step || 1}" data-k="${f.k}" value="${vals[f.k]}"></label>`).join('') || '<p class="note">No settings needed for the preview.</p>';
    $$('[data-k]', app).forEach((i) => i.onchange = () => { vals[i.dataset.k] = i.type === 'number' ? +i.value : i.value; if (i.dataset.k === 'room') vp.markers(rooms().find((r) => r.id === vals.room)); });
  }
  function history() {
    const runs = v ? p.runs.filter((r) => r.versionId === v.id && r.simId === sim.id).sort((a, b) => b.created.localeCompare(a.created)) : [];
    $('#hist', app).innerHTML = runs.map((r) => `<div class="vrow"><span class="vn">${sim.metrics.map(([k, , u, d]) => fmt(r.results[k], d) + (u ? ' ' + u : '')).slice(0, 1).join('')}</span><div class="vmeta">${when(r.created)}<br>${Object.entries(r.settings).filter(([k]) => k !== 'room').map(([k, x]) => esc(x)).join(' · ')}</div>${r.source === 'prototype-mock' ? MOCK : LIVE}</div>`).join('') || '<p class="note">No saved results yet.</p>';
  }
  function showResult() {
    const host = $('#res', app);
    if (result.error) { host.innerHTML = `<h2>Result</h2><p class="notice warn">${esc(result.error)}</p>`; return; }
    host.innerHTML = `<h2>Result ${MOCK}</h2>
      <div class="kpis">${sim.metrics.map(([k, label, u, d]) => `<div><small>${esc(label)}</small><b>${fmt(result[k], d)}</b> <span class="small muted">${u}</span></div>`).join('')}</div>
      ${result.roomName ? `<p class="note">Room: ${esc(result.roomName)}</p>` : ''}
      <p class="notice">Prototype estimate from model quantities (areas, glazing, volume, finishes). Use the full tool for the real analysis.</p>
      <button class="btn primary" id="keep">Save result to v${v.n}</button>`;
    $('#keep', host).onclick = () => { S.addRun(p, v.id, sim.id, { site: p.site?.label, ...vals }, result); history(); toast(`Saved to v${v.n}`); host.querySelector('#keep').outerHTML = `<a class="btn" href="#/results/${p.id}?sim=${sim.id}">Compare versions →</a>`; };
  }
  $('#go', app).onclick = () => {
    const bar = $('#prog', app), i = bar.firstElementChild; bar.hidden = false; $('#go', app).disabled = true; let t = 0;
    const tick = setInterval(() => { t += 12; i.style.width = Math.min(100, t) + '%'; if (t >= 100) { clearInterval(tick); bar.hidden = true; i.style.width = 0; $('#go', app).disabled = false; result = mockRun(sim.id, v.model, vals, p.site); showResult(); } }, 40);
  };
  $('#fit', app).onclick = () => vp.fit();
  $('#proj', app).onchange = (e) => { location.hash = `#/simulations/${sim.id}?project=${e.target.value}`; };
  $('#ver', app).onchange = (e) => { v = S.version(p, e.target.value); for (const f of sim.settings) if (f.type === 'room') vals[f.k] = rooms()[0]?.id; result = null; $('#res', app).innerHTML = '<h2>Result</h2><p class="note">Run a preview to see the result for this version.</p>'; show(); };
  show();
}
