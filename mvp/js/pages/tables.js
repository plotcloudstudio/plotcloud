// Tables (replan item 06, plan §4.4 T03/T04/T09). Every table is read from a saved run, referenced by its run ID; nothing is
// computed by an engine again. Field statistics are over the saved sensor values; missing values stay missing.
import * as S from '../store.js';
import * as C from '../project-contract.js';
import { SIMS } from '../data.js';
import { categoryOf } from '../capabilities.js';
import { downloadFile } from '../comparison-report.js';
import { $, $$, esc, currentProject, setCurrent } from '../app.js';

const finite = Number.isFinite;
export function fieldStats(field) {
  if (!field?.pts?.length) return null;
  const v = []; let missing = 0; for (let i = 2; i < field.pts.length; i += 3) (finite(field.pts[i]) ? v.push(field.pts[i]) : missing++);
  if (!v.length) return { n: 0, missing };
  v.sort((a, b) => a - b); const q = (f) => v[Math.min(v.length - 1, Math.floor(f * (v.length - 1)))];
  return { n: v.length, missing, mean: v.reduce((s, x) => s + x, 0) / v.length, min: v[0], p10: q(0.1), p50: q(0.5), p90: q(0.9), max: v.at(-1), unit: field.unit, label: field.label, step: field.step };
}
const csvCell = (x) => { const s = String(x ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export function runCSV(p, r) {
  const v = S.version(p, r.versionId), rev = r.planRevisionId ? C.revision(p, r.planRevisionId) : null, lines = [['run_id', r.id], ['study', r.simId], ['version', 'v' + (v?.n ?? '?')], ['plan_revision', rev ? rev.id : 'not recorded'], ['created', r.created], ['recipe', JSON.stringify(r.recipe || 'not recorded')], ['inputs', JSON.stringify(r.inputs?.values || 'not recorded')], [], ['figure', 'value']];
  for (const [k, val] of r.results?.kpis || []) lines.push([k, val]);
  const f = r.results?.field; if (f?.pts) { lines.push([], ['x_m', 'y_m', `${f.label} (${f.unit})`]); for (let i = 0; i < f.pts.length; i += 3) lines.push([f.pts[i], f.pts[i + 1], finite(f.pts[i + 2]) ? f.pts[i + 2] : '']); }
  return lines.map((l) => l.map(csvCell).join(',')).join('\n');
}
export function render(app, _, params) {
  const p = S.project(params.get('project')) || currentProject();
  if (!p) { app.innerHTML = '<div class="wrap"><h1 class="display md">Choose a project first.</h1><a class="btn" href="#/project/new">Create a project</a></div>'; return; }
  setCurrent(p);
  const sims = [...new Set(p.runs.map((r) => r.simId))];
  app.innerHTML = `<div class="wrap pj"><a href="#/project/${esc(p.id)}">← ${esc(p.name)}</a><span class="eyebrow" style="margin-top:20px">Tables · from saved runs</span><h1 class="display md">Result tables</h1>
    <p class="lede">Each table reads one saved run. No engine runs on this page. Missing values stay empty.</p>
    <label class="f" style="max-width:360px">Study<select id="tbSim"><option value="">All studies</option>${sims.map((s) => `<option value="${esc(s)}">${esc(SIMS.find((x) => x.id === s)?.name || s)}</option>`).join('')}</select></label>
    <section class="card"><h2>Summary per run (T04)</h2><div class="pc-scroll"><table class="pc-table" id="tbSummary"></table></div></section>
    <section class="card"><h2>Run figures (T03)</h2><div id="tbRuns"></div></section></div>`;
  const draw = () => {
    const f = $('#tbSim', app).value, runs = p.runs.filter((r) => !f || r.simId === f).slice().reverse();
    $('#tbSummary', app).innerHTML = `<thead><tr><th>Run</th><th>Study · category</th><th>Version / plan</th><th>Field</th><th>n</th><th>mean</th><th>min</th><th>p10</th><th>median</th><th>p90</th><th>max</th></tr></thead><tbody>${runs.map((r) => { const s = fieldStats(r.results?.field), v = S.version(p, r.versionId), rev = r.planRevisionId && C.revision(p, r.planRevisionId), pl = rev && p.plans.find((x) => x.id === rev.planId); const n = (x) => (finite(x) ? x.toFixed(2) : '—');
      return `<tr data-run="${esc(r.id)}"><td>${esc(r.id)}</td><td>${esc(SIMS.find((x) => x.id === r.simId)?.name || r.simId)} · ${esc(categoryOf(r.simId) || '—')}</td><td>v${v?.n ?? '?'}${pl ? ' · ' + esc(pl.name) + rev.n : ''}</td><td>${s ? esc(s.label) + ' (' + esc(s.unit) + ')' : r.results?.mediaDropped ? 'removed to save space' : 'none saved'}</td><td>${s ? s.n + (s.missing ? ' (+' + s.missing + ' missing)' : '') : '—'}</td><td>${n(s?.mean)}</td><td>${n(s?.min)}</td><td>${n(s?.p10)}</td><td>${n(s?.p50)}</td><td>${n(s?.p90)}</td><td>${n(s?.max)}</td></tr>`; }).join('')}</tbody>`;
    $('#tbRuns', app).innerHTML = runs.map((r) => `<details data-run="${esc(r.id)}"><summary>${esc(SIMS.find((x) => x.id === r.simId)?.name || r.simId)} · run ${esc(r.id)} · ${esc(r.created.slice(0, 16).replace('T', ' '))}</summary><table class="pc-table"><tbody>${(r.results?.kpis || []).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('') || '<tr><td>No figures saved.</td></tr>'}</tbody></table><button class="btn sm" type="button" data-csv="${esc(r.id)}">Download CSV</button></details>`).join('') || '<p class="note">No saved results yet.</p>';
    for (const b of $$('[data-csv]', app)) b.onclick = () => { const r = p.runs.find((x) => x.id === b.dataset.csv); downloadFile(runCSV(p, r), `plotcloud-run-${r.id}.csv`, 'text/csv;charset=utf-8'); };
  };
  $('#tbSim', app).onchange = draw; draw();
}
