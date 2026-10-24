import * as S from '../store.js';
import { SIMS } from '../data.js';
import { $, $$, esc, fmt, when, toast, currentProject, setCurrent, MOCK, LIVE } from '../app.js';
import { createViewport } from '../viewport.js';

export function render(app, [pid], params) {
  const p = (pid && S.project(pid)) || currentProject();
  if (!p) { app.innerHTML = '<div class="wrap"><p>No project yet. <a href="#/">Create one on Home.</a></p></div>'; return; }
  setCurrent(p);
  const used = SIMS.filter((s) => p.runs.some((r) => r.simId === s.id));
  let sim = used.find((s) => s.id === params.get('sim')) || used[0];
  let A = p.versions[0], B = p.versions.at(-1);
  const vps = [];

  app.innerHTML = `<div class="wrap">
    <div class="sec-h" style="margin-top:0;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:end"><div><span class="eyebrow">Results · ${esc(p.name)} · ${esc((S.siteOf(p)?.label || "").split(",")[0])}</span><h1 class="display" style="margin-top:16px">Change the design.<br><span>See what it did.</span></h1></div>
      <select class="inp" id="proj" style="max-width:280px" aria-label="Project">${S.projects().map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
    <p class="muted">Every saved result is tied to the model version it ran on, with its settings.</p>
    <div class="sec-h" style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:56px 0 16px"><h2 class="display sm">Versions × simulations</h2><span class="note">latest saved result per cell</span></div>
    <div style="overflow-x:auto"><table class="t matrix"><thead><tr><th>Version</th>${used.map((s) => `<th>${esc(s.name)}<br><span style="text-transform:none">${esc(s.metrics[0][1])}${s.metrics[0][2] ? ' · ' + s.metrics[0][2] : ''}</span></th>`).join('')}<th></th></tr></thead>
      <tbody>${p.versions.slice().reverse().map((v) => `<tr><td><b class="mono">v${v.n}</b> ${esc(v.note)}<br><span class="note">${when(v.created)}</span></td>${used.map((s) => { const r = S.lastRun(p, v.id, s.id); return `<td class="n">${r ? fmt(r.results[s.metrics[0][0]], s.metrics[0][3]) : `<a class="note" href="#/simulations/${s.id}?project=${p.id}&version=${v.id}">run</a>`}</td>`; }).join('')}<td><a class="btn sm" href="#/simulations?project=${p.id}&version=${v.id}">Simulate</a></td></tr>`).join('')}</tbody></table></div>
    ${used.length ? '' : '<p class="note" style="margin-top:10px">No saved results yet. Run a simulation on a saved version.</p>'}

    <div class="sec-h" style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:56px 0 16px"><h2 class="display sm">Compare versions</h2></div>
    ${p.versions.length < 2 ? '<p class="note">Save at least two versions in the workspace to compare them.</p>' : `
    <div class="grid g3" style="margin-bottom:14px">
      <label class="f">Simulation<select id="sim">${used.map((s) => `<option value="${s.id}" ${s === sim ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="f">Version A<select id="va">${p.versions.map((v) => `<option value="${v.id}" ${v === A ? 'selected' : ''}>v${v.n} — ${esc(v.note)}</option>`).join('')}</select></label>
      <label class="f">Version B<select id="vb">${p.versions.map((v) => `<option value="${v.id}" ${v === B ? 'selected' : ''}>v${v.n} — ${esc(v.note)}</option>`).join('')}</select></label></div>
    <div class="cmp"><div class="vp2"><span class="lab" id="la"></span><div class="vp" id="vpa" style="position:absolute;inset:0"></div></div><div class="vp2"><span class="lab" id="lb"></span><div class="vp" id="vpb" style="position:absolute;inset:0"></div></div></div>
    <div class="grid g2" style="margin-top:14px"><div class="card" id="metrics"></div><div class="card" id="changes"></div></div>
    <div class="card" id="trend" style="margin-top:14px"></div>`}

    <div class="sec-h" style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:56px 0 16px"><h2 class="display sm">All saved results</h2><span class="note">${p.runs.length}</span></div>
    <div style="overflow-x:auto"><table class="t"><thead><tr><th>When</th><th>Version</th><th>Simulation</th><th>Settings</th><th>Result</th><th>Source</th><th></th></tr></thead><tbody id="log"></tbody></table></div>
  </div>`;

  function log() {
    $('#log', app).innerHTML = p.runs.slice().sort((a, b) => b.created.localeCompare(a.created)).map((r) => { const s = SIMS.find((x) => x.id === r.simId), v = S.version(p, r.versionId);
      return `<tr><td>${when(r.created)}</td><td class="mono">v${v?.n ?? '?'}</td><td>${esc(s?.name)}</td><td class="small">${Object.entries(r.settings).filter(([k, x]) => x != null && x !== '').map(([k, x]) => k === 'site' ? esc(x) : `${esc(k)} ${esc(x)}`).join(' · ')}${r.results.roomName ? ' · ' + esc(r.results.roomName) : ''}</td>
      <td class="small mono">${r.results.kpis ? r.results.kpis.slice(0, 4).map(([k, x]) => `${esc(k)} ${esc(x)}`).join(' · ') : s.metrics.map(([k, l, u, d]) => `${fmt(r.results[k], d)}${u ? ' ' + u : ''}`).join(' · ')}</td><td>${r.source === 'prototype-mock' ? MOCK : LIVE}</td><td><button class="btn sm danger" data-del="${r.id}">Delete</button></td></tr>`; }).join('') || '<tr><td colspan="7" class="note">Nothing saved yet.</td></tr>';
    $$('[data-del]', app).forEach((b) => b.onclick = () => { if (!confirm('Delete this saved result?')) return; S.deleteRun(p, b.dataset.del); toast('Result deleted'); location.reload(); });
  }
  function compare() {
    if (p.versions.length < 2) return;
    const ra = sim && S.lastRun(p, A.id, sim.id), rb = sim && S.lastRun(p, B.id, sim.id);
    $('#la', app).textContent = `A · v${A.n}`; $('#lb', app).textContent = `B · v${B.n}`;
    vps[0].setModel(A.model, { refit: true }); vps[1].setModel(B.model, { refit: true });
    const missing = (v) => `<a href="#/simulations/${sim?.id}?project=${p.id}&version=${v.id}">Run on v${v.n}</a>`;
    let html = `<h3 style="font-size:15px;margin-bottom:10px">${esc(sim?.name || 'No simulation')} ${ra?.source === 'prototype-mock' || rb?.source === 'prototype-mock' ? MOCK : ''}</h3>`;
    if (!sim) html += '<p class="note">No saved results to compare.</p>';
    else {
      html += `<table class="t"><thead><tr><th>Measure</th><th>v${A.n}</th><th>v${B.n}</th><th>Change</th></tr></thead><tbody>${sim.metrics.map(([k, label, u, d]) => { const a = ra?.results[k], b = rb?.results[k], dlt = Number.isFinite(a) && Number.isFinite(b) ? b - a : NaN;
        return `<tr><td>${esc(label)}${u ? ` <span class="note">${u}</span>` : ''}</td><td class="n">${ra ? fmt(a, d) : missing(A)}</td><td class="n">${rb ? fmt(b, d) : missing(B)}</td><td class="n">${Number.isFinite(dlt) ? (dlt > 0 ? '+' : '') + fmt(dlt, d) : '—'}</td></tr>`; }).join('')}</tbody></table>`;
      if (ra && rb) { const same = JSON.stringify({ ...ra.settings, room: undefined }) === JSON.stringify({ ...rb.settings, room: undefined });
        html += same ? '<p class="note" style="margin-top:10px">Same settings on both versions, so the difference comes from the model.</p>'
          : `<p class="notice warn" style="margin-top:10px">Settings differ (${Object.keys(ra.settings).filter((k) => k !== 'room' && ra.settings[k] !== rb.settings[k]).map((k) => `${k}: ${esc(ra.settings[k])} → ${esc(rb.settings[k])}`).join(', ')}). Part of the difference comes from the settings, not the design.</p>`;
        if (ra.results.roomName && ra.results.roomName !== rb.results.roomName) html += `<p class="notice warn">Different rooms: ${esc(ra.results.roomName)} vs ${esc(rb.results.roomName)}.</p>`; }
    }
    $('#metrics', app).innerHTML = html;
    const d = S.diffModels(A.model, B.model), li = (arr) => arr.slice(0, 8).map((c) => `<li>${esc(c.name)} <span class="note">${esc(c.layer)}</span></li>`).join('') + (arr.length > 8 ? `<li class="note">and ${arr.length - 8} more</li>` : '');
    $('#changes', app).innerHTML = `<h3 style="font-size:15px;margin-bottom:10px">Model changes v${A.n} → v${B.n}</h3>
      ${!d.added.length && !d.removed.length && !d.changed.length ? '<p class="note">No geometry or material changes.</p>' : ''}
      ${d.changed.length ? `<p class="small"><b>Changed (${d.changed.length})</b></p><ul class="small" style="margin:4px 0 10px;padding-left:18px">${li(d.changed)}</ul>` : ''}
      ${d.added.length ? `<p class="small"><b>Added (${d.added.length})</b></p><ul class="small" style="margin:4px 0 10px;padding-left:18px">${li(d.added)}</ul>` : ''}
      ${d.removed.length ? `<p class="small"><b>Removed (${d.removed.length})</b></p><ul class="small" style="margin:4px 0 10px;padding-left:18px">${li(d.removed)}</ul>` : ''}`;
    // one measure across every version
    if (sim) { const [k, label, u, dd] = sim.metrics[0], rows = p.versions.map((v) => [v, S.lastRun(p, v.id, sim.id)?.results[k]]), max = Math.max(1e-9, ...rows.map(([, x]) => (Number.isFinite(x) ? Math.abs(x) : 0)));
      $('#trend', app).innerHTML = `<h3 style="font-size:15px;margin-bottom:10px">${esc(label)} across versions</h3><div class="bars">${rows.map(([v, x]) => `<div class="b ${v === B ? 'v2' : ''}"><span>v${v.n}</span>${Number.isFinite(x) ? `<i style="width:${Math.abs(x) / max * 100}%"></i>` : '<span class="note">not run</span>'}<span style="text-align:right">${Number.isFinite(x) ? fmt(x, dd) + (u ? ' ' + u : '') : ''}</span></div>`).join('')}</div>`; }
  }

  $('#proj', app).onchange = (e) => { location.hash = '#/results/' + e.target.value; };
  if (p.versions.length >= 2) {
    vps.push(createViewport($('#vpa', app)), createViewport($('#vpb', app)));
    if (sim?.view === 'wire') vps.forEach((x) => x.setMode('wire'));
    $('#sim', app).onchange = (e) => { sim = SIMS.find((s) => s.id === e.target.value); vps.forEach((x) => x.setMode(sim.view === 'wire' ? 'wire' : 'shaded')); compare(); };
    $('#va', app).onchange = (e) => { A = S.version(p, e.target.value); compare(); };
    $('#vb', app).onchange = (e) => { B = S.version(p, e.target.value); compare(); };
    compare();
  }
  log();
}
