// Project entry and overview (replan items 05, 07–11). #/project/new creates a project (Simple asks only for an address);
// #/project/<id> is the project's home: details, Simple/Advanced, readiness per study, parameters with sources and single
// overrides, use template, daylight target, plans and lineage, executable suggestions with "adopt and run Plan B", plan
// comparison, report revisions with PPTX/PDF/HTML/evidence and the offline review file, and feedback → Plan C.
import * as S from '../store.js';
import * as C from '../project-contract.js';
import * as P from '../parameters.js';
import { SIMS } from '../data.js';
import { inspectStudy } from '../study-readiness.js';
import { USE_TEMPLATES, GENERIC, templateFor, occupiedHours } from '../use-templates.js';
import { recommend, adopt, updateGroup, cancelGroup, pendingTasks, feedbackRecommendation } from '../recommendations.js';
import { comparability, fieldDiff, metricRows, describe, fmt } from '../compare-metrics.js';
import { buildSpec, saveRevision, pptxFromSpec, evidenceJSON, reviewHTML, addFeedback, setFeedbackStatus, importReview } from '../report-spec.js';
import { reportHTML, exportComparisonPDF, downloadFile } from '../comparison-report.js';
import { createBatch } from '../batch.js';
import { geocode, enrich } from '../site.js';
import { ensureProjectClimate } from '../project-climate.js';
import { weatherDownloadAvailable } from '../automatic-climate.js?v=epw-connected-20261027-3';
import { $, $$, esc, setCurrent, setCurrentVersion, toast } from '../app.js';

const STATUS = ['active', 'on hold', 'completed'];
export function render(app, [id], params) {
  if (id === 'new' || !id) return create(app, params);
  const p = S.project(id); if (!p) { app.innerHTML = '<div class="wrap"><h1>Project not found.</h1><a class="btn" href="#/project/new">Create a project</a></div>'; return; }
  setCurrent(p); return overview(app, p);
}

// ---------------------------------------------------------------- create
function create(app) {
  app.innerHTML = `<div class="wrap pj"><a href="#/home">← Projects</a><span class="eyebrow" style="margin-top:20px">New project</span><h1 class="display md">Start with the address.</h1>
  <form id="newProject" class="card" style="padding:22px;margin-top:18px">
    <fieldset class="pj-mode" style="border:0;padding:0"><legend><b>Mode</b></legend><label><input type="radio" name="mode" value="simple" checked> Simple — only what the next study needs</label><label><input type="radio" name="mode" value="advanced"> Advanced — every input on one page</label></fieldset>
    <p class="note">You can switch at any time. Switching never changes data or calculation precision.</p>
    <div class="grid g2" style="margin-top:12px"><label class="f">Address or place<input id="npAddress" placeholder="e.g. 1 Dundas St W, Toronto"></label><div><button type="button" class="btn" id="npFind" style="margin-top:22px">Find address</button></div></div>
    <div id="npMatches"></div><p class="note" id="npStatus" role="status" aria-live="polite">Or enter coordinates below.</p>
    <div class="grid g2"><label class="f">Latitude (°)<input id="npLat" type="number" step="any" min="-90" max="90"></label><label class="f">Longitude (°)<input id="npLon" type="number" step="any" min="-180" max="180"></label></div>
    <details id="npMore"><summary>Name, use and client (optional now)</summary><div class="grid g2" style="margin-top:10px">
      <label class="f">Project name<input id="npName" placeholder="From the address if empty"></label>
      <label class="f">Use<select id="npUse"><option value="">Not set yet — climate studies only</option>${Object.entries(USE_TEMPLATES).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('')}<option value="generic">Other / unknown (generic concept template)</option></select></label>
      <label class="f">Client<input id="npClient"></label><label class="f">Stage<select id="npStage"><option>Concept</option><option>Schematic</option><option>Design development</option><option>Student project</option></select></label>
      <label class="f" style="grid-column:1/-1">Description<textarea id="npDesc" rows="2"></textarea></label></div></details>
    <div class="acts" style="margin-top:16px"><button class="btn accent" type="submit">Create and prepare</button></div><p class="note" id="npError" role="alert"></p></form>
  <p class="note">Projects are kept in this browser${S.account().user?.cloud ? ' and copied to your cloud account' : ''}. Use Account → Backup &amp; data to move them.</p></div>`;
  const mode = () => app.querySelector('[name=mode]:checked').value;
  for (const r of $$('[name=mode]', app)) r.onchange = () => { $('#npMore', app).open = mode() === 'advanced'; };
  let picked = null;
  $('#npFind', app).onclick = async () => { const st = $('#npStatus', app), box = $('#npMatches', app); st.textContent = 'Searching…'; box.replaceChildren();
    try { const rows = await geocode($('#npAddress', app).value.trim()); st.textContent = rows.length ? 'Choose the matching address:' : 'No match. Enter coordinates below.';
      for (const row of rows) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm'; b.style.cssText = 'display:block;margin-top:6px'; b.textContent = row.label; b.onclick = async () => { picked = { ...row }; $('#npLat', app).value = row.lat; $('#npLon', app).value = row.lon; box.replaceChildren(); st.textContent = 'Address selected: ' + row.label; try { Object.assign(picked, await enrich(row.lat, row.lon)); } catch (e) { } }; box.append(b); } }
    catch (e) { st.textContent = (e.message || 'Address search failed') + ' Enter coordinates below.'; } };
  $('#newProject', app).onsubmit = async (e) => {
    e.preventDefault(); const err = $('#npError', app); err.textContent = '';
    const lat = parseFloat($('#npLat', app).value), lon = parseFloat($('#npLon', app).value);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) { err.textContent = 'Choose an address or enter valid coordinates (latitude −90…90, longitude −180…180).'; return; }
    const label = picked && picked.lat === lat && picked.lon === lon ? picked.label : `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    let tz = picked?.tz; if (!tz) { try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e2) { tz = 'UTC'; } }
    const name = $('#npName', app).value.trim() || label.split(',')[0];
    const p = S.createProject(name, { units: 'm', north: 0, layers: [{ name: 'Imported', color: '#d5d2cb', visible: true, locked: false }], components: [] });
    C.setUiMode(p, mode());
    p.profile = { description: $('#npDesc', app).value.trim(), client: $('#npClient', app).value.trim(), stage: $('#npStage', app).value, status: 'active', use: $('#npUse', app).value || null };
    const site = { label, lat, lon, north: 0, tz, sample: false, ...(Number.isFinite(picked?.elev) ? { elev: picked.elev } : {}) };
    S.updateConditions(p, site, S.conditionsOf(p).defaults, { keepRevision: true, acquisition: picked ? 'manual-entry' : 'manual-entry', mode: mode() });
    if (p.profile.use) C.applyProgram(p, templateFor(p.profile.use));
    S.save(); setCurrent(p);
    if (weatherDownloadAvailable()) ensureProjectClimate(p).catch(() => { });   // Simple: weather is matched automatically
    location.hash = '#/project/' + p.id;
  };
}

// ---------------------------------------------------------------- overview
function overview(app, p) {
  const mode = () => p.contract.uiMode, adv = () => mode() === 'advanced';
  let batch = null, activeGroup = null;
  app.innerHTML = `<div class="wrap pj" data-mode="${mode()}"><a href="#/home">← Projects</a>
    <span class="eyebrow" style="margin-top:20px">Project</span><h1 class="display md" id="pjName"></h1><p class="lede" id="pjSummary"></p>
    <div class="pj-mode" role="radiogroup" aria-label="Project mode"><b>Mode</b><label><input type="radio" name="pjMode" value="simple"> Simple</label><label><input type="radio" name="pjMode" value="advanced"> Advanced</label><span class="note" id="pjModeNote"></span></div>
    <nav class="acts" aria-label="Project workflow" style="margin-top:12px"><a class="btn" href="#/project-settings/${esc(p.id)}">1 Site analysis</a><a class="btn" href="#/workspace/${esc(p.id)}">2 Plan Studio · Workbench</a><a class="btn" href="#/simulations">3 Simulation</a><a class="btn" href="#/rendering?project=${esc(p.id)}">4 Rendering</a><a class="btn" href="#/boards?project=${esc(p.id)}">5 Boards</a><a class="btn ghost" href="#/tables?project=${esc(p.id)}">Tables</a><a class="btn ghost" href="#/results/${esc(p.id)}">Results</a></nav><p class="note">Steps can be taken in any order; imported models can go straight to Simulation.</p>
    <section class="card" id="pjReady"><h2>What can run now</h2><div class="pj-status" id="pjReadyList"></div><div class="acts" style="margin-top:12px"><button class="btn" type="button" id="pjPackage">Run default study package</button><span class="note" id="pjPackageNote"></span></div></section>
    <section class="card" id="pjDetails"><h2>Project details</h2><form id="pjForm" class="grid g2"></form></section>
    <section class="card" id="pjParams"><h2>Inputs and their sources</h2><p class="note" id="pjProv"></p><div class="pc-scroll"><table class="pc-table" id="pjParamTable"></table></div></section>
    <section class="card" id="pjUse"><h2>Use template and daylight target</h2><div id="pjUseBody"></div></section>
    <section class="card" id="pjPlans"><h2>Plans</h2><div id="pjPlanList"></div></section>
    <section class="card" id="pjSuggest"><h2>Suggestions</h2><div id="pjSuggestBody"></div><div id="pjGroups"></div><div id="pjBatchHost" aria-hidden="true"></div></section>
    <section class="card" id="pjCompare"><h2>Compare plans</h2><div id="pjCompareBody"></div></section>
    <section class="card" id="pjReport"><h2>Report and review</h2><div id="pjReportBody"></div></section>
    <section class="card" id="pjFeedback"><h2>Feedback</h2><div id="pjFeedbackBody"></div></section></div>`;

  const draw = () => { $('.pj', app).dataset.mode = mode(); head(); ready(); details(); params(); use(); plans(); suggest(); groups(); compare(); report(); feedback(); };
  function head() {
    const st = C.stats(p), w = S.conditionsOf(p).site.climate;
    $('#pjName', app).textContent = p.name;
    $('#pjSummary', app).textContent = `${(S.conditionsOf(p).site.label || 'No site').split(',')[0]} · ${p.profile?.status || 'active'} · ${st.plans} plan${st.plans === 1 ? '' : 's'}, ${st.revisions} revision${st.revisions === 1 ? '' : 's'}, ${st.runs} result${st.runs === 1 ? '' : 's'} · ` + (w ? `weather ${w.station || w.name}${Number.isFinite(w.distanceKm) ? ', ' + w.distanceKm.toFixed(1) + ' km' : ''}` : 'no weather yet') + ` · ${S.persistent() ? 'saved in this browser' : 'storage unavailable'}`;
    for (const r of $$('[name=pjMode]', app)) r.checked = r.value === mode();
    $('#pjModeNote', app).textContent = mode() === 'simple' && st.overrides ? `Using ${st.overrides} custom setting${st.overrides === 1 ? '' : 's'} — listed under Inputs.` : mode() === 'simple' ? 'Essentials only. Every input can still be changed one at a time.' : 'All inputs shown.';
  }
  for (const r of $$('[name=pjMode]', app)) r.onchange = () => { C.setUiMode(p, r.value); S.save(); toast(r.value === 'simple' ? 'Simple mode: nothing was changed or removed' : 'Advanced mode'); draw(); };

  function ready() {
    queueMicrotask(() => { const l = packageStudies(); $('#pjPackageNote', app).textContent = l.length ? 'Ready: ' + l.map((x) => SIMS.find((s) => s.id === x)?.name || x).join(', ') + '. Runs in this page.' : 'No study in the default package is ready yet.'; });
    const v = p.versions.at(-1), c = S.conditionsOf(p), rows = [['climate', 'Climate (address + weather)'], ['sunhours', 'Building · sun and massing'], ['daylight', 'Interior · daylight'], ['structure', 'Structure']];
    $('#pjReadyList', app).innerHTML = rows.map(([sid, label]) => { const r = inspectStudy(p, v, sid, { site: c.site, defaults: c.defaults }); const e = r.errors[0], wv = r.warnings[0], state = e ? 'error' : wv ? 'warning' : 'ok';
      return `<div data-state="${state}" data-study="${sid}" data-ready="${r.ready}"><b>${esc(label)}</b><p class="note">${esc(e ? e.title + ' — ' + e.detail : wv ? wv.title : 'Inputs found · open the study to run')}</p>${e?.href ? `<a href="${esc(e.href)}">Fix</a>` : `<a href="#/simulations/${sid}">Open</a>`}</div>`; }).join('');
  }
  // default package by task (plan §6.7): only studies whose inputs are ready; never the whole catalogue
  const PACKAGE = ['sunhours', 'radiation', 'utci', 'daylight'];
  function packageStudies() { const v = p.versions.at(-1), c = S.conditionsOf(p); return v ? PACKAGE.filter((sid) => inspectStudy(p, v, sid, { site: c.site, defaults: c.defaults }).ready) : []; }
  $('#pjPackage', app).onclick = () => { const v = p.versions.at(-1), list = packageStudies(); if (!v || !list.length) { $('#pjPackageNote', app).textContent = 'Nothing in the default package is ready: see the items above.'; return; }
    const rev = C.freezePlan(p, v.id), g = { id: 'rg-pkg-' + Date.now().toString(36), planRevisionId: rev.id, baseRevisionId: null, recommendationId: null, versionId: v.id, created: new Date().toISOString(), state: 'queued', execution: 'browser-batch (page must stay open)', tasks: list.map((simId) => ({ simId, status: 'queued', runId: null, why: '' })), log: [{ at: new Date().toISOString(), event: 'default package' }] };
    p.runGroups.push(g); S.save(); start(g.id); groups(); };
  function details() {
    const f = p.profile || {};
    $('#pjForm', app).innerHTML = `<label class="f">Name<input name="name" value="${esc(p.name)}" required></label><label class="f">Status<select name="status">${STATUS.map((s) => `<option ${s === (f.status || 'active') ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label class="f">Client<input name="client" value="${esc(f.client || '')}"></label><label class="f">Stage<input name="stage" value="${esc(f.stage || '')}"></label><label class="f" style="grid-column:1/-1">Description<textarea name="description" rows="2">${esc(f.description || '')}</textarea></label><div><button class="btn" type="submit">Save details</button></div>`;
    $('#pjForm', app).onsubmit = (e) => { e.preventDefault(); const d = new FormData(e.target); S.renameProject(p, d.get('name')); p.profile = { ...(p.profile || {}), client: String(d.get('client')).trim(), stage: String(d.get('stage')).trim(), status: d.get('status'), description: String(d.get('description')).trim() }; p.updated = new Date().toISOString(); S.save(); toast('Details saved'); head(); };
  }
  function params() {
    const table = P.effectiveTable(p), st = C.stats(p), w = P.resolve(p, { path: 'weather.epw' });
    $('#pjProv', app).textContent = `${w.status === 'ok' ? 'Weather: ' + w.label + '. ' : 'No weather file yet. '}${st.derived} derived, ${st.overrides} set by you${st.unrecorded ? `, ${st.unrecorded} from before sources were recorded` : ''}. Defaults come from ${p.contract.config.template.id}@${p.contract.config.template.version}${p.contract.config.program ? ' and ' + p.contract.config.program.id + '@' + p.contract.config.program.version : ''}.`;
    const shown = adv() ? table : table.filter((r) => ['user-override', 'workbench-input', 'derived'].includes(r.valueOrigin) || ['site.lat', 'site.lon', 'site.north', 'weather.epw'].includes(r.path));
    $('#pjParamTable', app).innerHTML = `<thead><tr><th>Input</th><th>Value</th><th>Source</th><th></th></tr></thead><tbody>${shown.map((r) => `<tr data-path="${esc(r.path)}"><td>${esc(r.path)}</td><td>${esc(r.path === 'weather.epw' ? String(r.value).slice(0, 12) + '…' : r.value)} ${esc(r.unit)}</td><td>${esc(r.label || r.status)}<br><small>${esc(r.scope)}${r.ruleVersion ? ' · ' + esc(r.ruleVersion) : ''}</small></td><td>${r.path === 'weather.epw' ? '<a href="#/project-settings/' + esc(p.id) + '">Change</a>' : `<button class="btn sm" type="button" data-set="${esc(r.path)}">Change</button>`}${['user-override', 'unrecorded'].includes(r.valueOrigin) && r.scope === 'project-config' ? ` <button class="btn sm" type="button" data-restore="${esc(r.path)}">Restore default</button>` : ''}</td></tr>`).join('')}</tbody>`;
    if (!adv()) $('#pjParamTable', app).insertAdjacentHTML('beforeend', `<caption class="note" style="caption-side:bottom;text-align:left">Simple shows inputs you set, derived inputs and location. Switch to Advanced for all ${table.length}.</caption>`);
    for (const b of $$('[data-set]', app)) b.onclick = () => { const path = b.dataset.set, cur = P.resolve(p, { path }), def = P.DEFS[path]; const raw = prompt(`${path} (${def.unit || 'text'})${def.values ? ' — one of ' + def.values.join(', ') : def.type === 'number' ? ` — ${def.min} to ${def.max}` : ''}`, cur.value ?? ''); if (raw === null) return;
      try { const r = S.setProjectParameter(p, { path }, { value: def.type === 'number' ? Number(raw) : raw.trim(), valueOrigin: 'user-override', acquisition: 'manual-entry' }); toast(`${path} = ${r.value} ${r.unit}`); draw(); } catch (e) { alert(e.message); } };
    for (const b of $$('[data-restore]', app)) b.onclick = () => { const r = S.restoreProjectDefault(p, { path: b.dataset.restore }); toast(r.status === 'ok' ? `Restored: ${r.value} (${r.label})` : 'Restored; no default exists for this input'); draw(); };
  }
  function use() {
    const prog = p.contract.config.program, t = P.resolve(p, { path: 'target.daylight.meanDF' }), hours = S.conditionsOf(p).site.climate?.hours || 8760, occ = prog ? occupiedHours(prog, { hours }) : null;
    $('#pjUseBody', app).innerHTML = `<p>${prog ? `<b>${esc(prog.label)}</b> · ${esc(prog.id)}@${esc(prog.version)}<br><span class="note">${esc(prog.source)}.</span>${occ ? `<br><span class="note">Occupied hours (occupancy ≥ 50 %): ${occ.count} of ${occ.of}, on the ${hours === 8784 ? 'leap-year' : '365-day'} calendar of the project weather.</span>` : ''}` : 'No use template: only climate and geometry studies use defaults. Choose one to record occupancy, lighting and equipment assumptions.'}</p>
      <div class="grid g2"><label class="f">Use template<select id="pjUseSel">${Object.entries(USE_TEMPLATES).map(([k, x]) => `<option value="${k}" ${prog?.id === x.id ? 'selected' : ''}>${x.label} (${x.version})</option>`).join('')}<option value="generic" ${prog?.id === GENERIC.id ? 'selected' : ''}>Generic concept</option></select></label><div><button class="btn" id="pjUseApply" type="button" style="margin-top:22px">${prog ? 'Change template' : 'Apply template'}</button></div>
      <label class="f">Daylight target · mean daylight factor (%)<input id="pjTarget" type="number" min="0" max="20" step="0.1" value="${t.status === 'ok' ? t.value : ''}" placeholder="From your brief"></label><div><button class="btn" id="pjTargetSave" type="button" style="margin-top:22px">Save target</button></div></div>
      <p class="note">${t.status === 'ok' ? 'Target source: ' + esc(t.label) + '.' : 'PlotCloud does not assume a daylight target; suggestions need one from the project brief.'}</p>`;
    $('#pjUseApply', app).onclick = () => { const k = $('#pjUseSel', app).value; if (prog && !confirm('Apply this template as a new configuration revision? Saved plan revisions keep their values.')) return; C.applyProgram(p, templateFor(k)); p.profile = { ...(p.profile || {}), use: k }; S.save(); toast('Use template applied'); draw(); };
    $('#pjTargetSave', app).onclick = () => { const v = parseFloat($('#pjTarget', app).value); try { S.setProjectParameter(p, { path: 'target.daylight.meanDF' }, { value: v, valueOrigin: 'user-override', acquisition: 'manual-entry' }); toast('Target saved'); draw(); } catch (e) { alert(e.message); } };
  }
  function plans() {
    $('#pjPlanList', app).innerHTML = p.plans.map((pl) => { const revs = p.planRevisions.filter((r) => r.planId === pl.id), parent = pl.parentRevisionId && C.revision(p, pl.parentRevisionId);
      return `<div style="margin:10px 0" data-plan="${esc(pl.name)}"><b>Plan ${esc(pl.name)}</b>${pl.id === p.contract.currentPlanId ? ' <span class="badge-pill">current</span>' : ''}${parent ? ` <span class="note">from ${esc(p.plans.find((x) => x.id === parent.planId)?.name || '?')}${parent.n}</span>` : ''}<ul>${revs.map((r) => { const v = S.version(p, r.versionId), runs = p.runs.filter((x) => x.planRevisionId === r.id); return `<li>${esc(pl.name)}${r.n} · v${v?.n ?? '?'} ${esc(v?.note || '')} · ${runs.length} result${runs.length === 1 ? '' : 's'}${r.legacy ? ' · conditions not recorded' : ''}${r.restoredFrom ? ' · restored from ' + esc(r.restoredFrom) : ''} <button class="btn sm" type="button" data-rollback="${esc(r.id)}">Restore as new revision</button></li>`; }).join('') || '<li class="note">No saved revision yet.</li>'}</ul></div>`; }).join('');
    for (const b of $$('[data-rollback]', app)) b.onclick = () => { if (!confirm('Restore this revision as a new version and revision? Later history is kept.')) return; try { const r = S.rollbackPlan(p, b.dataset.rollback); toast('Restored as revision ' + r.n); draw(); } catch (e) { alert(e.message); } };
  }
  // ---- 09
  function latestDaylight() { return [...p.runs].reverse().find((r) => r.simId === 'daylight' && r.planRevisionId && !C.revision(p, r.planRevisionId)?.legacy); }
  function suggest() {
    const run = latestDaylight(), v = run && S.version(p, run.versionId), out = run ? recommend(p, run, v.model) : { status: 'no-basis', text: 'Run Daylight on a saved version to get suggestions. Only the daylight window rule is connected so far.' };
    const box = $('#pjSuggestBody', app);
    if (out.status !== 'ok') { box.innerHTML = `<p class="note" data-suggest="${out.status}">${esc(out.text)}</p>`; return; }
    const r = out.recommendation, had = (p.recommendations || []).find((x) => x.id === r.id);
    box.innerHTML = `<div data-suggest="ok" data-rec="${esc(r.id)}"><p><b>${esc(r.title)}</b></p><p class="note">Evidence: average daylight factor ${fmt(r.evidence.value)} % in run ${esc(r.evidence.runId)} is below the target ${r.evidence.target} % (${esc(r.evidence.targetSource)}); ${r.evidence.lowPoints} of ${r.evidence.ofPoints} sensor points are below target, centred at (${r.evidence.lowCentroid.join(', ')}) m. ${esc(r.expected)}</p>
      <p class="note">Change: window ${esc(r.patch.name)} ${esc(JSON.stringify(r.patch.from))} → ${esc(JSON.stringify(r.patch.to))}. Reruns: ${esc((r.studies.length ? r.studies : ['daylight']).join(', '))} in this browser (keep this page open).</p>
      ${had?.adoption ? `<p>Adopted as Plan ${esc(had.adoption.planName)}.</p>` : `<button class="btn accent" type="button" id="pjAdopt">Adopt and run Plan B</button>`}</div>`;
    const btn = $('#pjAdopt', app); if (btn) btn.onclick = () => { btn.disabled = true; try { const a = adopt(S, p, r); toast(a.repeated ? 'Already adopted' : `Plan ${a.planName} created; running`); start(a.runGroupId); } catch (e) { alert(e.message); } draw(); };
  }
  function start(groupId) {
    const g = p.runGroups.find((x) => x.id === groupId); if (!g) return; activeGroup = groupId;
    if (!batch) batch = createBatch($('#pjBatchHost', app), { onChange: (items) => { const gg = updateGroup(S, p, activeGroup, items); groups(); if (gg && ['succeeded', 'partial', 'failed'].includes(gg.state)) { toast('Plan ' + (p.plans.find((x) => C.revision(p, gg.planRevisionId)?.planId === x.id)?.name || '') + ': ' + gg.state); draw(); } } });
    batch.add(pendingTasks(g).map((t) => ({ projectId: p.id, simId: t.simId, versionId: g.versionId })));
  }
  function groups() {
    $('#pjGroups', app).innerHTML = (p.runGroups || []).map((g) => `<div class="card" style="padding:12px;margin-top:10px" data-group="${esc(g.id)}" data-state="${esc(g.state)}"><b>Run group ${esc(g.id)}</b> · ${esc(g.state)} · ${esc(g.execution)}<ul>${g.tasks.map((t) => `<li>${esc(t.simId)}: ${esc(t.status)}${t.runId ? ' · run ' + esc(t.runId) : ''}${t.why ? ' · ' + esc(t.why) : ''}</li>`).join('')}</ul>${['queued', 'running', 'partial', 'failed', 'cancelled'].includes(g.state) && pendingTasks(g).length ? `<button class="btn sm" type="button" data-resume="${esc(g.id)}">${g.state === 'queued' || g.state === 'running' ? 'Resume in this page' : 'Retry unfinished'}</button> <button class="btn sm" type="button" data-cancel="${esc(g.id)}">Cancel</button>` : ''}</div>`).join('');
    for (const b of $$('[data-resume]', app)) b.onclick = () => start(b.dataset.resume);
    for (const b of $$('[data-cancel]', app)) b.onclick = () => { batch?.dispose(); batch = null; cancelGroup(S, p, b.dataset.cancel); draw(); };
  }
  // ---- 10
  function compare() {
    const vs = p.versions, box = $('#pjCompareBody', app);
    if (vs.length < 2) { box.innerHTML = '<p class="note">Save two versions (or adopt a suggestion) to compare plans.</p>'; return; }
    const opt = (sel) => vs.map((v) => `<option value="${esc(v.id)}" ${v.id === sel ? 'selected' : ''}>v${v.n} · ${esc(v.note)}</option>`).join('');
    const studies = [...new Set(p.runs.map((r) => r.simId))];
    box.innerHTML = `<div class="grid g3"><label class="f">A<select id="cmpA">${opt(vs.at(-2).id)}</select></label><label class="f">B<select id="cmpB">${opt(vs.at(-1).id)}</select></label><label class="f">Study<select id="cmpSim">${studies.map((s) => `<option value="${esc(s)}">${esc(SIMS.find((x) => x.id === s)?.name || s)}</option>`).join('')}</select></label></div><div id="cmpOut"></div>`;
    const go = () => { const a = $('#cmpA', app).value, b = $('#cmpB', app).value, sid = $('#cmpSim', app).value, sim = SIMS.find((x) => x.id === sid), A = S.lastRun(p, a, sid), B = S.lastRun(p, b, sid), out = $('#cmpOut', app);
      if (!A || !B) { out.innerHTML = `<p class="note">${!A ? 'A' : 'B'} has no saved ${esc(sim?.name || sid)} result.</p>`; return; }
      const c = comparability(A, B), t = P.resolve(p, { path: 'target.daylight.meanDF' }), rows = metricRows(sim, A, B, t.status === 'ok' ? { 'daylight.df': { min: t.value, source: t.label } } : {}), fd = fieldDiff(A.results?.field, B.results?.field), dm = S.diffModels(S.version(p, a).model, S.version(p, b).model);
      out.innerHTML = `<p data-comparability="${c.kind}" class="${c.kind === 'design' ? 'pj-good' : c.kind === 'not-comparable' ? 'pj-bad' : 'pj-warn'}">${esc(c.text)}</p>${c.diffs.length ? `<ul class="note">${c.diffs.map((d) => `<li>${esc(d.key)}: ${esc(JSON.stringify(d.a))} → ${esc(JSON.stringify(d.b))}</li>`).join('')}</ul>` : ''}
        <div class="pc-scroll"><table class="pc-table" id="cmpTable"><thead><tr><th>Metric</th><th>A</th><th>B</th><th>Change</th><th>Target</th></tr></thead><tbody>${rows.map((r) => `<tr data-metric="${esc(r.key)}"><td>${esc(r.label)} (${esc(r.unit)})</td><td>${fmt(r.a, r.dec)}</td><td>${fmt(r.b, r.dec)}</td><td>${esc(describe(r))}</td><td>${esc(r.judge.text)}</td></tr>`).join('')}</tbody></table></div>
        <p class="note" id="cmpField">${fd.status === 'ok' ? `Point difference on ${fd.matched} matching sensors: mean ${fmt(fd.mean, 2)} ${esc(fd.unit)}, range ${fmt(fd.min, 2)} to ${fmt(fd.max, 2)}${fd.onlyA || fd.onlyB ? `; ${fd.onlyA} only in A and ${fd.onlyB} only in B are left out (no reliable match)` : ''}.` : 'No point difference map: ' + esc(fd.reason)}</p>
        <p class="note">Design differences (geometry, not results): ${dm.added.length} added, ${dm.removed.length} removed, ${dm.changed.length} changed${dm.changed.length ? ' — ' + esc(dm.changed.slice(0, 5).map((x) => x.name || x.id).join(', ')) : ''}. Several changes at once are shown together; their separate contributions are not estimated.</p>`; };
    for (const id of ['cmpA', 'cmpB', 'cmpSim']) $('#' + id, app).onchange = go; go();
  }
  // ---- 11
  function report() {
    const vs = p.versions, box = $('#pjReportBody', app);
    if (vs.length < 2) { box.innerHTML = '<p class="note">A report compares two saved versions with saved results.</p>'; return; }
    const opt = (sel) => vs.map((v) => `<option value="${esc(v.id)}" ${v.id === sel ? 'selected' : ''}>v${v.n} · ${esc(v.note)}</option>`).join('');
    box.innerHTML = `<div class="grid g2"><label class="f">A<select id="repA">${opt(vs.at(-2).id)}</select></label><label class="f">B<select id="repB">${opt(vs.at(-1).id)}</select></label><label class="f">Version<select id="repKind"><option value="quick">Quick report</option><option value="technical" ${adv() ? 'selected' : ''}>Technical report</option></select></label><label class="f">Footer / practice name<input id="repFooter" value="${esc(p.profile?.brand || '')}"></label><label class="f" style="grid-column:1/-1">Conclusions (your words)<textarea id="repNote" rows="3">${esc(p.reportNotes || '')}</textarea></label></div>
      <div class="acts" id="repActs"><button class="btn accent" type="button" data-rep="pptx">Save revision + PowerPoint</button><button class="btn" type="button" data-rep="pdf">PDF</button><button class="btn" type="button" data-rep="html">HTML</button><button class="btn" type="button" data-rep="json">Evidence JSON</button><button class="btn" type="button" data-rep="review">Review file for client</button></div><p class="note" id="repStatus" role="status"></p>
      <p class="note">A hosted share link is not connected yet. Send the review file instead: the client opens it, adds comments and returns a small JSON file, which you import below.</p>
      <ul id="repList">${(p.reportRevisions || []).map((r) => `<li data-rev="${esc(r.id)}">r${r.n} · ${esc(r.created.slice(0, 16).replace('T', ' '))} · ${esc(r.kind)} · regenerated: ${esc(r.changedChapters.join(', ') || 'none')} · reused: ${esc(r.reusedChapters.join(', ') || 'none')}</li>`).join('')}</ul>`;
    const st = $('#repStatus', app);
    for (const b of $$('[data-rep]', app)) b.onclick = async () => {
      try {
        p.reportNotes = $('#repNote', app).value; p.profile = { ...(p.profile || {}), brand: $('#repFooter', app).value }; S.save();
        const { spec, report: rep } = buildSpec(S, p, { a: $('#repA', app).value, b: $('#repB', app).value, note: $('#repNote', app).value, kind: $('#repKind', app).value, brand: { footer: $('#repFooter', app).value || undefined, author: S.account().user?.name || '' } });
        const rev = saveRevision(S, p, spec), base = `plotcloud-${p.name.replace(/[^\w-]+/g, '-').slice(0, 30)}-r${rev.n}`, k = b.dataset.rep;
        if (k === 'pptx') downloadFile(pptxFromSpec(spec, rep, rev), base + '.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        if (k === 'pdf') await exportComparisonPDF(rep);
        if (k === 'html') downloadFile(reportHTML(rep), base + '.html', 'text/html;charset=utf-8');
        if (k === 'json') downloadFile(evidenceJSON(spec, rev), base + '-evidence.json', 'application/json');
        if (k === 'review') downloadFile(reviewHTML(spec, rev), base + '-review.html', 'text/html;charset=utf-8');
        st.textContent = `Report revision r${rev.n} saved (${rev.id}). Regenerated chapters: ${rev.changedChapters.join(', ') || 'none'}.`; report(); feedback();
      } catch (e) { st.textContent = e.message; st.setAttribute('role', 'alert'); }
    };
  }
  function feedback() {
    const box = $('#pjFeedbackBody', app), revs = p.reportRevisions || [];
    if (!revs.length) { box.innerHTML = '<p class="note">Save a report revision first; feedback always refers to one.</p>'; return; }
    const lastB = p.versions.at(-1), wins = (lastB?.model.components || []).filter((c) => c.type === 'window');
    box.innerHTML = `<div class="acts"><label class="btn">Import review file<input type="file" id="fbImport" accept=".json,application/json" hidden></label></div>
      <form id="fbForm" class="grid g2"><label class="f">Report revision<select name="rev">${revs.slice().reverse().map((r) => `<option value="${esc(r.id)}">r${r.n} · ${esc(r.created.slice(0, 10))}</option>`).join('')}</select></label><label class="f">About<input name="chapter" placeholder="e.g. study:daylight"></label><label class="f" style="grid-column:1/-1">Feedback<textarea name="text" rows="2"></textarea></label><div><button class="btn" type="submit">Add feedback</button></div></form>
      <ul id="fbList">${p.feedback.map((f) => `<li data-fb="${esc(f.id)}" data-status="${esc(f.status)}"><b>${esc(f.author)}</b> on r${revs.find((r) => r.id === f.reportRevisionId)?.n ?? '?'}${f.chapter ? ' · ' + esc(f.chapter) : ''}: ${esc(f.text)} <select data-fbstatus="${esc(f.id)}">${['open', 'adopted', 'partly-adopted', 'declined', 'verified'].map((s) => `<option ${s === f.status ? 'selected' : ''}>${s}</option>`).join('')}</select>${f.status === 'open' && wins.length ? ` <details style="display:inline-block"><summary>Make the next plan from this</summary><label class="f">Window<select data-fbwin="${esc(f.id)}">${wins.map((w) => `<option value="${esc(w.id)}">${esc(w.name)} (${w.g.w} × ${w.g.h} m)</option>`).join('')}</select></label><label class="f">New width (m)<input type="number" step="0.1" min="0.3" data-fbw="${esc(f.id)}"></label><label class="f">New height (m)<input type="number" step="0.1" min="0.3" data-fbh="${esc(f.id)}"></label><button class="btn sm" type="button" data-fbadopt="${esc(f.id)}">Adopt and run</button></details>` : ''}${f.planId ? ' · became Plan ' + esc(p.plans.find((x) => x.id === f.planId)?.name || '?') : ''}</li>`).join('') || '<li class="note">No feedback yet. Nothing is invented: only comments you enter or import appear here.</li>'}</ul>`;
    $('#fbImport', app).onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const items = importReview(S, p, await f.text()); toast(`${items.length} comment(s) imported`); feedback(); } catch (er) { alert(er.message); } };
    $('#fbForm', app).onsubmit = (e) => { e.preventDefault(); const d = new FormData(e.target); try { addFeedback(S, p, { reportRevisionId: d.get('rev'), chapter: String(d.get('chapter')).trim() || null, text: d.get('text'), author: 'client (entered by architect)' }); feedback(); } catch (er) { alert(er.message); } };
    for (const s of $$('[data-fbstatus]', app)) s.onchange = () => { setFeedbackStatus(S, p, s.dataset.fbstatus, s.value); feedback(); };
    for (const b of $$('[data-fbadopt]', app)) b.onclick = () => { const id = b.dataset.fbadopt, w = parseFloat($(`[data-fbw="${id}"]`, app).value), h = parseFloat($(`[data-fbh="${id}"]`, app).value);
      try { const rec = feedbackRecommendation(S, p, { versionId: lastB.id, windowId: $(`[data-fbwin="${id}"]`, app).value, width: Number.isFinite(w) ? w : undefined, height: Number.isFinite(h) ? h : undefined, feedbackIds: [id] }); const a = adopt(S, p, rec); const f = p.feedback.find((x) => x.id === id); f.planId = a.planId; setFeedbackStatus(S, p, id, 'adopted', 'Plan ' + a.planName + ' · run group ' + a.runGroupId); start(a.runGroupId); draw(); }
      catch (er) { alert(er.message + ' The feedback stays open as a task.'); } };
  }
  draw();
  return () => { batch?.dispose(); };
}
