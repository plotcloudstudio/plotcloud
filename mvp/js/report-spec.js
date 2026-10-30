// One ReportSpec per delivery (replan item 11, plan §9, AC25–AC28). The spec is built only from saved plan revisions and runs —
// never from what is on screen — through the existing comparison report (comparison-report-data.js), so the PDF, HTML, CSV,
// JSON and the new PPTX all carry the same numbers and run IDs. Each chapter has a dependency hash; a new report revision
// records which chapters changed and which were reused, and earlier revisions are never overwritten.
// Feedback is bound to a report revision (and chapter / metric / object / run). Offline review: the review page is a file the
// client opens, fills in and returns as JSON; nothing is sent anywhere automatically. A hosted share link is not connected.
import { buildComparisonReport } from './comparison-report-data.js';
import { SIMS } from './data.js';
import * as C from './project-contract.js';
import * as P from './parameters.js';
import { comparability, judge, describe } from './compare-metrics.js';
import { STUDIES } from './capabilities.js';
import { hashOf } from './contract-hash.js';
import { buildPptx } from './pptx.js';

const now = () => new Date().toISOString();
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (v, d = 1) => (Number.isFinite(v) ? (Math.round(v * 10 ** d) / 10 ** d).toFixed(d) : '—');

export function buildSpec(S, p, { a, b, simId = null, note = '', kind = 'quick', brand = {} } = {}) {
  const va = S.version(p, a), vb = S.version(p, b);
  const report = buildComparisonReport(p, va, vb, SIMS, { simId, note });
  const site = S.conditionsOf(p).site, climate = site.climate || null;
  const revOf = (run) => (run?.planRevisionId ? C.revision(p, run.planRevisionId) : null);
  const planName = (rev) => (rev ? (p.plans.find((x) => x.id === rev.planId)?.name || '?') + rev.n : 'not recorded');
  const targets = {}; const t = P.resolve(p, { path: 'target.daylight.meanDF' }); if (t.status === 'ok') targets['daylight.df'] = { min: t.value, source: t.label };
  const sections = report.sections.map((s) => {
    const cmp = comparability(s.a, s.b);
    return { simId: s.simId, name: s.name, method: STUDIES[s.simId]?.method || s.method, runIds: { a: s.a?.id || null, b: s.b?.id || null }, plans: { a: planName(revOf(s.a)), b: planName(revOf(s.b)) }, comparability: { kind: cmp.kind, text: cmp.text, diffs: cmp.diffs },
      metrics: s.metrics.map((m) => { const d = { status: Number.isFinite(m.a) && Number.isFinite(m.b) ? 'ok' : 'missing', a: m.a, b: m.b, abs: m.delta, absUnit: m.unit === '%' ? 'pp' : m.unit, rel: m.relative, relNote: m.a === 0 ? 'undefined (A is zero)' : null, note: !Number.isFinite(m.a) ? 'missing in A' : !Number.isFinite(m.b) ? 'missing in B' : '' }; return { key: m.key, label: m.label, unit: m.unit, decimals: m.decimals, a: m.a, b: m.b, change: describe({ ...d, dec: m.decimals }), judge: judge(d, targets[s.simId + '.' + m.key]) }; }) };
  });
  const recB = (p.recommendations || []).find((r) => r.adoption?.versionId === b);
  const overrides = P.effectiveTable(p).filter((r) => ['user-override', 'workbench-input'].includes(r.valueOrigin));
  const spec = { schema: 'plotcloud-report-spec/1', kind, generatedAt: now(), brand: { logoText: brand.logoText || '', footer: brand.footer || `PlotCloud · ${p.name}`, author: brand.author || '' },
    project: { id: p.id, name: p.name, client: p.profile?.client || '', use: P.resolve(p, { path: 'program.use' }).value || p.profile?.use || 'not set', stage: p.profile?.stage || '', site: site.label || '', lat: site.lat, lon: site.lon, example: !!p.sample },
    weather: climate ? { name: climate.name, station: climate.station, hash: climate.hash, distanceKm: climate.distanceKm ?? null, provider: climate.provider || 'uploaded by user', period: climate.period || 'not recorded', how: P.resolve(p, { path: 'weather.epw' }).label } : null,
    versions: { a: { id: va.id, n: va.n, note: va.note }, b: { id: vb.id, n: vb.n, note: vb.note } },
    change: recB ? { title: recB.title, patch: recB.patch, rule: recB.rule, evidence: recB.evidence, expected: recB.expected } : { title: 'Design change between the two saved versions', patch: null },
    assumptions: { template: p.contract?.config?.template?.id + '@' + p.contract?.config?.template?.version, program: p.contract?.config?.program ? p.contract.config.program.id + '@' + p.contract.config.program.version : 'no use template', overrides: overrides.map((r) => ({ path: r.path, value: r.value, unit: r.unit, label: r.label })) },
    sections, conclusion: String(note || ''), limitations: ['Results are design screening from the methods named per study; they are not code compliance or certification.', 'Renderings are not performance evidence.', ...(sections.some((s) => s.comparability.kind !== 'design') ? ['Some studies compare different conditions; see each study’s comparability note.'] : [])] };
  spec.chapters = { overview: hashOf({ project: spec.project, brand: spec.brand }), weather: hashOf(spec.weather), plans: hashOf({ versions: spec.versions, change: spec.change }), assumptions: hashOf(spec.assumptions), ...Object.fromEntries(sections.map((s) => ['study:' + s.simId, hashOf({ runIds: s.runIds, metrics: s.metrics.map((m) => [m.key, m.a, m.b]) })])), conclusion: hashOf(spec.conclusion) };
  return { spec, report };
}
// A new revision every time; unchanged chapters are reported as reused.
export function saveRevision(S, p, spec) {
  p.reportRevisions = p.reportRevisions || [];
  const prev = [...p.reportRevisions].reverse().find((r) => r.versions?.a === spec.versions.a.id);
  const changed = Object.keys(spec.chapters).filter((k) => !prev || prev.chapters[k] !== spec.chapters[k]);
  const rev = { id: 'rep-' + Math.random().toString(36).slice(2, 10), n: p.reportRevisions.length + 1, created: now(), kind: spec.kind, versions: { a: spec.versions.a.id, b: spec.versions.b.id }, runIds: spec.sections.flatMap((s) => [s.runIds.a, s.runIds.b]).filter(Boolean), chapters: spec.chapters, specHash: hashOf({ ...spec, generatedAt: undefined }), previousId: prev?.id || null, changedChapters: changed, reusedChapters: Object.keys(spec.chapters).filter((k) => !changed.includes(k)), share: { status: 'not-connected', note: 'Hosted share links need the sharing service; use the review file instead.' } };
  p.reportRevisions.push(rev); S.save(); return rev;
}
// ---- PPTX: same numbers as the spec; pictures are the saved engine previews with a source line
const dataURLImage = (u) => { const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(u || ''); if (!m) return null; const s = atob(m[2]), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return { [m[1]]: b }; };
export function pptxFromSpec(spec, report, rev) {
  const slides = [];
  slides.push({ title: spec.project.name, blocks: [{ type: 'text', x: 0.6, y: 1.4, w: 12, h: 3.6, paragraphs: [{ text: spec.brand.logoText || 'PlotCloud design comparison', size: 14 }, { text: `${spec.kind === 'technical' ? 'Technical report' : 'Quick report'} · revision ${rev.n} · ${rev.created.slice(0, 10)}`, size: 14 }, { text: `Client: ${spec.project.client || 'not set'} · Use: ${spec.project.use} · Site: ${spec.project.site}`, size: 14 }, { text: `Weather: ${spec.weather ? `${spec.weather.station} (${spec.weather.name}) · ${spec.weather.how}` : 'no project EPW'}`, size: 12 }, ...(spec.project.example ? [{ text: 'Example project — results describe the sample model, not a real building.', size: 12, bold: true, color: 'C4473A' }] : [])] }] });
  slides.push({ title: 'What changed: A → B', blocks: [{ type: 'text', x: 0.6, y: 1.3, w: 12, h: 2.2, paragraphs: [{ text: `A: v${spec.versions.a.n} · ${spec.versions.a.note}`, size: 14 }, { text: `B: v${spec.versions.b.n} · ${spec.versions.b.note}`, size: 14 }, { text: spec.change.title, size: 14, bold: true }, ...(spec.change.patch ? [{ text: `Object ${spec.change.patch.name || spec.change.patch.id}: ${JSON.stringify(spec.change.patch.from)} → ${JSON.stringify(spec.change.patch.to)}`, size: 10 }, { text: 'Evidence: ' + `${spec.change.evidence.metric} ${num(spec.change.evidence.value)} % vs target ${spec.change.evidence.target} % (${spec.change.evidence.targetSource}); run ${spec.change.evidence.runId}`, size: 10 }] : [])] }] });
  for (const s of spec.sections) {
    const rows = [['Metric', 'A', 'B', 'Change', 'Target'], ...s.metrics.map((m) => [`${m.label} (${m.unit || '-'})`, num(m.a, m.decimals), num(m.b, m.decimals), m.change, m.judge.text])];
    const bars = s.metrics.filter((m) => Number.isFinite(m.a) || Number.isFinite(m.b)).slice(0, 3).flatMap((m) => [{ label: `${m.label} · A`, value: m.a, text: num(m.a, m.decimals) + ' ' + m.unit, color: '8C97AB' }, { label: `${m.label} · B`, value: m.b, text: num(m.b, m.decimals) + ' ' + m.unit, color: '3B6FB6' }]);
    const blocks = [{ type: 'text', x: 0.6, y: 1.1, w: 12, h: 0.8, paragraphs: [{ text: s.comparability.text, size: 12, color: s.comparability.kind === 'design' ? '2F6B4F' : 'AD842C' }, { text: 'Method: ' + s.method, size: 10 }] }, { type: 'table', x: 0.6, y: 2.0, w: 7.4, h: 3.2, rows }];
    if (bars.length) blocks.push({ type: 'bars', x: 8.3, y: 2.0, w: 4.6, h: Math.min(3.6, bars.length * 0.5) });
    if (bars.length) blocks.at(-1).series = bars;
    const sec = report.sections.find((x) => x.simId === s.simId), pics = ['a', 'b'].map((k) => dataURLImage(sec?.[k]?.results?.thumb));
    if (pics[0] || pics[1]) { pics.forEach((img, i) => { if (img) blocks.push({ type: 'image', x: 0.6 + i * 3.8, y: 5.35, w: 3.6, h: 1.6, ...img, alt: `Saved engine preview ${i ? 'B' : 'A'}` }); }); blocks.push({ type: 'text', x: 8.3, y: 5.9, w: 4.6, h: 0.8, paragraphs: [{ text: `Pictures: saved engine previews of runs ${s.runIds.a || '—'} / ${s.runIds.b || '—'}; colour scales may differ.`, size: 9 }] }); }
    blocks.push({ type: 'text', x: 0.6, y: 6.75, w: 12, h: 0.3, paragraphs: [{ text: `Plans ${s.plans.a} → ${s.plans.b} · runs ${s.runIds.a || '—'} → ${s.runIds.b || '—'}`, size: 9, color: '6B7385' }] });
    slides.push({ title: s.name, blocks });
  }
  slides.push({ title: 'Assumptions and sources', blocks: [{ type: 'table', x: 0.6, y: 1.2, w: 12, h: 4.5, size: 10, rows: [['Item', 'Value', 'Source'], ['Study defaults template', spec.assumptions.template, 'Fixed in this project'], ['Use template', spec.assumptions.program, 'Fixed in this project'], ['Weather', spec.weather ? `${spec.weather.station} · ${spec.weather.hash.slice(0, 12)}…` : 'none', spec.weather?.how || '—'], ...spec.assumptions.overrides.slice(0, 10).map((o) => [o.path, `${o.value} ${o.unit}`, o.label])] }] });
  slides.push({ title: 'Conclusions and limitations', blocks: [{ type: 'text', x: 0.6, y: 1.2, w: 12, h: 5.2, paragraphs: [{ text: spec.conclusion || 'No written conclusion yet (author to add).', size: 14 }, ...spec.limitations.map((t) => ({ text: t, size: 12, bullet: true }))] }] });
  return buildPptx({ title: `${spec.project.name} — design comparison`, author: spec.brand.author, footer: `${spec.brand.footer} · report r${rev.n} (${rev.id})`, slides });
}
export function evidenceJSON(spec, rev) { return JSON.stringify({ reportRevision: rev, spec }, null, 1); }

// ---- feedback
const STATUSES = ['open', 'adopted', 'partly-adopted', 'declined', 'verified'];
export function addFeedback(S, p, { reportRevisionId, chapter = null, metric = null, objectId = null, runId = null, text, author = 'client', source = 'entered by architect' }) {
  if (!(p.reportRevisions || []).some((r) => r.id === reportRevisionId)) throw Error('Feedback must refer to a saved report revision.');
  if (!String(text || '').trim()) throw Error('Feedback text is empty.');
  const f = { id: 'fb-' + Math.random().toString(36).slice(2, 10), reportRevisionId, chapter, metric, objectId, runId, text: String(text).slice(0, 4000), author, source, status: 'open', created: now(), history: [{ at: now(), status: 'open' }] };
  p.feedback.push(f); S.save(); return f;
}
export function setFeedbackStatus(S, p, id, status, note = '') { if (!STATUSES.includes(status)) throw Error('Unknown status.'); const f = p.feedback.find((x) => x.id === id); if (!f) throw Error('Feedback not found.'); f.status = status; f.history.push({ at: now(), status, note }); S.save(); return f; }
// The client's returned review file → feedback items. Only items for a known report revision are accepted.
export function importReview(S, p, text) {
  let o; try { o = JSON.parse(text); } catch { throw Error('This is not a PlotCloud review file.'); }
  if (o?.format !== 'plotcloud-review' || !Array.isArray(o.items)) throw Error('This is not a PlotCloud review file.');
  if (!(p.reportRevisions || []).some((r) => r.id === o.reportRevisionId)) throw Error('The review refers to a report revision that is not in this project.');
  return o.items.filter((i) => String(i.text || '').trim()).map((i) => addFeedback(S, p, { reportRevisionId: o.reportRevisionId, chapter: i.chapter || null, metric: i.metric || null, objectId: i.objectId || null, text: i.text, author: o.reviewer || 'client', source: 'review file ' + (o.savedAt || '') }));
}
// A self-contained review page: the report summary plus a form that saves a JSON file for the architect. Sends nothing.
export function reviewHTML(spec, rev) {
  const chapters = [['plans', 'What changed'], ...spec.sections.map((s) => ['study:' + s.simId, s.name]), ['assumptions', 'Assumptions'], ['conclusion', 'Conclusions']];
  const metricRows = spec.sections.map((s) => `<h2>${esc(s.name)}</h2><p>${esc(s.comparability.text)}</p><table><tr><th>Metric</th><th>A</th><th>B</th><th>Change</th><th>Target</th></tr>${s.metrics.map((m) => `<tr><td>${esc(m.label)} (${esc(m.unit)})</td><td>${num(m.a, m.decimals)}</td><td>${num(m.b, m.decimals)}</td><td>${esc(m.change)}</td><td>${esc(m.judge.text)}</td></tr>`).join('')}</table>`).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Review · ${esc(spec.project.name)}</title><style>body{font:15px/1.5 system-ui,sans-serif;max-width:900px;margin:24px auto;padding:0 16px;color:#1f2a44}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ccd;padding:6px;text-align:left}textarea,select,input{width:100%;box-sizing:border-box;margin:4px 0 10px;font:inherit}button{font:inherit;padding:8px 14px}</style>
<h1>${esc(spec.project.name)}</h1><p>Report revision ${rev.n} (${esc(rev.id)}) · ${esc(rev.created.slice(0, 10))} · A v${spec.versions.a.n} → B v${spec.versions.b.n}</p><p><b>${esc(spec.change.title)}</b></p>${metricRows}
<h2>Your comments</h2><p>Comments are saved to a file on your device. Send the file back to your architect; nothing is uploaded from this page.</p>
<label>Your name<input id="who"></label><div id="items"></div><button type="button" id="add">Add a comment</button> <button type="button" id="save">Save review file</button>
<script>const chapters=${JSON.stringify(chapters)};const items=document.getElementById('items');function add(){const d=document.createElement('div');d.innerHTML='<label>About<select>'+chapters.map(c=>'<option value="'+c[0]+'">'+c[1].replace(/</g,'&lt;')+'</option>').join('')+'</select></label><label>Comment<textarea rows="3"></textarea></label>';items.append(d);}add();document.getElementById('add').onclick=add;
document.getElementById('save').onclick=()=>{const out={format:'plotcloud-review',reportRevisionId:${JSON.stringify(rev.id)},reviewer:document.getElementById('who').value,savedAt:new Date().toISOString(),items:[...items.children].map(d=>({chapter:d.querySelector('select').value,text:d.querySelector('textarea').value})).filter(i=>i.text.trim())};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,1)],{type:'application/json'}));a.download='plotcloud-review-${esc(rev.id)}.json';a.click();};</script></html>`;
}
