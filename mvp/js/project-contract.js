// Project, Plan, Run and asset contract (replan item 02, plan §8.4 and §10.1). Pure functions over a project object, so the
// store, backups and contract tests share one implementation. The existing shape (versions, runs, sharedConditions) stays as it
// is; schema 2 adds, it never rewrites:
//   p.contract       { schema, migratedFrom, migratedAt, uiMode, currentPlanId, config { revision, template, history[] } }
//   p.parameters     { records[] }                             — parameters.js
//   p.plans[]        { id, name, parentPlanId, parentRevisionId, created }               A/B/C lineage
//   p.planRevisions[]{ id, planId, n, versionId, parentRevisionId, modelHash, conditions, parameters, physicalHash, inputHash,
//                      templateVersion, configRevision, created, legacy?, restoredFrom? }   immutable once written
//   p.assets[]       { id, kind, hash, name, size?, source, license, redistributable }       EPW and other referenced files
//   p.runGroups[], p.reportRevisions[], p.feedback[]       containers for later batches (validated by backups)
//   run.planRevisionId, run.inputs { values, sources, hash }, run.inputHash, run.recipe { id, engine, version }
import { hashOf } from './contract-hash.js';
import * as P from './parameters.js';

export const SCHEMA = 2;
// The study defaults that already exist in store.js DEFAULTS, fixed as a versioned template. Concept presets, not a code,
// regional or use-type template (those arrive with item 07).
export const TEMPLATE = Object.freeze({ id: 'plotcloud-study-defaults', version: '2026-10-30.1', note: 'PlotCloud concept study presets carried over from the existing defaults; not a code, regional or occupancy template.',
  values: Object.freeze({ 'study.period': 'Equinox', 'study.plane': 0.8, 'study.occStart': 8, 'study.occEnd': 18, 'study.radius': 250, 'study.rain': 50, 'study.duration': 60, 'study.eye': 1.2, 'study.band': '500 Hz', 'study.code': 'NBC 2020', 'display.units': 'Metric' }) });
export const UNRECORDED = 'unrecorded';
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const now = () => new Date().toISOString();
const rid = (k) => k + Math.random().toString(36).slice(2, 10);
const modelHashes = new WeakMap();
export const modelHash = (model) => { if (!model || typeof model !== 'object') return hashOf(model ?? null); let h = modelHashes.get(model); if (!h) { h = hashOf(model); modelHashes.set(model, h); } return h; };

// ---- assets: every EPW a project points at, current or historical, by content hash
const isHash = (h) => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h);
export function climateRefs(p) {
  const found = new Map();
  const walk = (x, where) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { x.forEach((v, i) => walk(v, where + '[' + i + ']')); return; }
    if (isHash(x.hash) && (x.station !== undefined || x.epwSource !== undefined || /\.epw$/i.test(x.name || '') || x.hours === 8760 || x.hours === 8784)) {
      const a = found.get(x.hash) || { hash: x.hash, kind: 'epw', meta: x, where: [] }; a.where.push(where); found.set(x.hash, a);
    }
    for (const [k, v] of Object.entries(x)) if (k !== 'text' && v && typeof v === 'object') walk(v, where + '.' + k);
  };
  walk({ sharedConditions: p.sharedConditions, runs: p.runs, handoffs: p.handoffs, planRevisions: p.planRevisions }, 'project');
  return [...found.values()];
}
const LICENSE = { onebuilding: 'Climate.OneBuilding.Org — publisher terms; kept for this project owner’s restore', doe: 'EnergyPlus weather (U.S. DOE) — publisher terms; kept for this project owner’s restore' };
export function assetRecord(ref) {
  const m = ref.meta || {};
  return { id: 'asset-epw-' + ref.hash.slice(0, 16), kind: 'epw', hash: ref.hash, name: m.name || null, station: m.station || null, hours: m.hours || null,
    source: m.automatic ? { acquisition: 'auto-match', uri: m.sourceURL || null, provider: m.provider || null, stationId: m.stationId || null, period: m.period || null, catalogRetrieved: m.catalogRetrieved || null, downloadedAt: m.downloadedAt || null } : { acquisition: m.name ? 'user-upload' : UNRECORDED },
    license: m.automatic ? (LICENSE[m.provider] || 'Publisher terms not recorded') : 'Provided by the project owner; terms not recorded',
    redistributable: m.automatic ? 'owner-backup-only' : UNRECORDED, references: ref.where };
}
export function refreshAssets(p) {
  const old = new Map((p.assets || []).map((a) => [a.hash, a]));
  p.assets = climateRefs(p).map((ref) => ({ ...assetRecord(ref), ...(old.get(ref.hash)?.size ? { size: old.get(ref.hash).size } : {}) }));
  return p.assets;
}

// ---- configuration fixed per project; account defaults only seed a new project
function newContract(p, at, { uiMode, migratedFrom = null } = {}) {
  return { schema: SCHEMA, ...(migratedFrom ? { migratedFrom, migratedAt: at } : { created: at }), uiMode, currentPlanId: 'plan-a',
    config: { revision: 1, template: clone(TEMPLATE), history: [{ revision: 1, at, change: migratedFrom ? 'migrated from schema ' + migratedFrom : 'created', template: TEMPLATE.id + '@' + TEMPLATE.version }] } };
}
const emptyLike = { site: {}, defaults: {} };
// A brand-new project: its conditions were copied from Account or the sample site, then frozen here.
export function initProject(p, { at = now(), uiMode = 'advanced', fromSample = false } = {}) {
  p.contract = newContract(p, at, { uiMode });
  P.ensure(p);
  // values equal to the fixed template are its defaults; others came from Account (or the sample site) for this new project only
  const c = p.sharedConditions;
  for (const path of Object.keys(P.DEFS)) {
    const v = P.conditionValue(c, path); if (v === undefined || v === null || path === 'weather.epw') continue;
    const def = TEMPLATE.values[path] ?? P.RECIPE_FALLBACKS[path];
    const sample = fromSample && path.startsWith('site.'), asDefault = sample || def !== undefined && JSON.stringify(def) === JSON.stringify(v);
    try { P.setParameter(p, { path, value: v, valueOrigin: asDefault ? 'platform-default' : 'user-override', acquisition: asDefault ? 'template' : 'account-default', mode: null, ruleVersion: asDefault ? (sample ? 'plotcloud-sample-site' : TEMPLATE.id + '@' + TEMPLATE.version) : null, at, event: 'seeded' }); }
    catch (e) { P.setParameter(p, { path, value: v, valueOrigin: 'unrecorded', acquisition: 'unrecorded', at, event: 'seeded-unvalidated', unvalidated: true, meta: { validation: e.message } }); }
  }
  if (c?.site?.climate) P.recordConditionsChange(p, emptyLike, { site: { climate: c.site.climate }, defaults: {} }, { at, event: 'seeded', mode: null });
  p.plans = [{ id: 'plan-a', name: 'A', parentPlanId: null, parentRevisionId: null, created: at }];
  p.planRevisions = []; p.runGroups = []; p.reportRevisions = []; p.feedback = [];
  for (const v of p.versions || []) freezePlan(p, v.id, { at: v.created });
  refreshAssets(p);
  return p;
}

// Schema 1 → 2. Idempotent: a project already at schema 2 is untouched, so repeating a migration creates nothing.
export function migrateProject(p, { at = now() } = {}) {
  if (p.contract && p.contract.schema >= SCHEMA) return false;
  p.contract = newContract(p, at, { uiMode: 'advanced', migratedFrom: 1 });
  p.contract.uiModeOrigin = 'legacy projects open with every control visible, as before';
  P.ensure(p);
  // Past values were entered before provenance existed: kept exactly, labelled "not recorded", never relabelled as derived.
  // An EPW keeps what its own metadata proves (automatic match with publisher details, or an upload).
  P.recordConditionsChange(p, emptyLike, p.sharedConditions || emptyLike, { valueOrigin: 'unrecorded', acquisition: 'unrecorded', mode: null, event: 'migrated', at });
  if (!Array.isArray(p.plans)) p.plans = [{ id: 'plan-a', name: 'A', parentPlanId: null, parentRevisionId: null, created: p.created || at, origin: 'migrated' }];
  if (!Array.isArray(p.planRevisions)) p.planRevisions = [];
  for (const k of ['runGroups', 'reportRevisions', 'feedback']) if (!Array.isArray(p[k])) p[k] = [];
  const known = new Set(p.planRevisions.map((r) => r.versionId));
  let prev = p.planRevisions.at(-1) || null;
  for (const v of p.versions || []) {
    if (known.has(v.id)) continue;
    const rev = { id: 'rev-' + v.id, planId: 'plan-a', n: p.planRevisions.length + 1, versionId: v.id, parentRevisionId: prev?.id || null, modelHash: modelHash(v.model), conditions: UNRECORDED, parameters: null, physicalHash: null, inputHash: null, templateVersion: UNRECORDED, configRevision: null, created: v.created || at, note: v.note || '', legacy: true };
    p.planRevisions.push(rev); prev = rev;
  }
  for (const r of p.runs || []) {
    if (!r.planRevisionId && p.planRevisions.some((x) => x.id === 'rev-' + r.versionId)) r.planRevisionId = 'rev-' + r.versionId;
    if (!r.recipe) r.recipe = { id: r.simId, engine: UNRECORDED, version: UNRECORDED };
  }
  refreshAssets(p);
  return true;
}

// ---- Plans and immutable revisions
export const currentPlan = (p) => p.plans.find((x) => x.id === p.contract.currentPlanId) || p.plans[0];
export const revision = (p, id) => (p.planRevisions || []).find((r) => r.id === id);
export function freezeInputs(p) {
  const table = P.effectiveTable(p), physical = {};
  for (const row of table) if (row.status === 'ok' && P.DEFS[row.path]?.physical) physical[row.path] = row.value;
  return { table, physical, physicalHash: hashOf(physical) };
}
// The PlanRevision a run uses: the same plan, version and inputs reuse one revision (idempotent); any change makes a new one.
export function freezePlan(p, versionId, { at = now(), restoredFrom = null, planId = null } = {}) {
  const v = (p.versions || []).find((x) => x.id === versionId); if (!v) throw Error('Save a version before freezing a plan.');
  const plan = planId ? p.plans.find((x) => x.id === planId) : currentPlan(p), mh = modelHash(v.model), { table, physical, physicalHash } = freezeInputs(p);
  const inputHash = hashOf({ modelHash: mh, physicalHash });
  const hit = p.planRevisions.find((r) => r.planId === plan.id && r.versionId === versionId && r.inputHash === inputHash);
  if (hit && !restoredFrom) return hit;
  const mine = p.planRevisions.filter((r) => r.planId === plan.id);
  const rev = { id: rid('rev-'), planId: plan.id, n: mine.length + 1, versionId, parentRevisionId: mine.at(-1)?.id || plan.parentRevisionId || null, modelHash: mh,
    conditions: { revision: p.sharedConditions?.revision ?? null, site: clone(p.sharedConditions?.site), defaults: clone(p.sharedConditions?.defaults) },
    parameters: table, physicalHash, inputHash, templateVersion: p.contract.config.template.id + '@' + p.contract.config.template.version, configRevision: p.contract.config.revision,
    uiModeAtFreeze: p.contract.uiMode, created: at, ...(restoredFrom ? { restoredFrom } : {}) };
  p.planRevisions.push(rev);
  return rev;
}
// Plan B/C: a new branch whose parent is a fixed revision. Nothing in the parent changes.
export function derivePlan(p, fromRevisionId, { name, at = now(), switchTo = true } = {}) {
  const src = revision(p, fromRevisionId); if (!src) throw Error('Choose a saved plan revision to derive from.');
  const used = new Set(p.plans.map((x) => x.name)); let auto = 'B'; while (used.has(auto)) auto = String.fromCharCode(auto.charCodeAt(0) + 1);
  const plan = { id: rid('plan-'), name: name || auto, parentPlanId: src.planId, parentRevisionId: src.id, created: at };
  p.plans.push(plan); if (switchTo) p.contract.currentPlanId = plan.id;
  return plan;
}
export function lineage(p, revisionId) { const out = []; let r = revision(p, revisionId); const seen = new Set(); while (r && !seen.has(r.id)) { seen.add(r.id); out.push(r.id); r = revision(p, r.parentRevisionId); } return out; }

// Run metadata: which revision, which effective inputs, which recipe. Settings stay exactly as the engine wrote them.
export function runContract(p, versionId, simId, settings = {}) {
  const rev = freezePlan(p, versionId), inputs = P.studySnapshot(p, simId);
  return { planRevisionId: rev.id, inputs, inputHash: hashOf({ modelHash: rev.modelHash, inputs: inputs.hash }), recipe: { id: simId, engine: settings.engine || (settings.localCompute ? 'local-reference' : 'browser'), version: settings.engineVersion || UNRECORDED } };
}

// Template upgrade is its own change: preview the diff, apply as a new configuration revision. Saved revisions keep theirs.
export function templateDiff(p, next) {
  const cur = p.contract.config.template.values, keys = [...new Set([...Object.keys(cur), ...Object.keys(next.values)])];
  return keys.filter((k) => JSON.stringify(cur[k]) !== JSON.stringify(next.values[k])).map((k) => ({ path: k, from: cur[k], to: next.values[k] }));
}
export function upgradeTemplate(p, next, { at = now(), author = null } = {}) {
  const diff = templateDiff(p, next), cfg = p.contract.config;
  cfg.revision += 1; cfg.template = clone(next); cfg.history.push({ revision: cfg.revision, at, author, change: 'template upgrade', template: next.id + '@' + next.version, diff });
  P.syncMirror(p);
  return diff;
}
// UI mode is display only: it is never in a hash and never changes data.
export function setUiMode(p, mode) { if (!['simple', 'advanced'].includes(mode)) throw Error('Mode must be simple or advanced.'); p.contract.uiMode = mode; return mode; }

// Referential integrity of one project (used by migration tests and backups).
export function integrityProblems(p) {
  const out = [], V = new Set((p.versions || []).map((v) => v.id)), R = new Set((p.planRevisions || []).map((r) => r.id)), PL = new Set((p.plans || []).map((x) => x.id)), RUN = new Set((p.runs || []).map((r) => r.id)), REP = new Set((p.reportRevisions || []).map((r) => r.id));
  if (!p.id) out.push('project has no id');
  for (const r of p.runs || []) { if (!V.has(r.versionId)) out.push(`run ${r.id} points at missing version ${r.versionId}`); if (r.planRevisionId && !R.has(r.planRevisionId)) out.push(`run ${r.id} points at missing plan revision ${r.planRevisionId}`); }
  for (const r of p.planRevisions || []) { if (!V.has(r.versionId)) out.push(`plan revision ${r.id} points at missing version ${r.versionId}`); if (!PL.has(r.planId)) out.push(`plan revision ${r.id} points at missing plan ${r.planId}`); if (r.parentRevisionId && !R.has(r.parentRevisionId)) out.push(`plan revision ${r.id} has missing parent ${r.parentRevisionId}`); if (!r.legacy && r.modelHash !== modelHash(p.versions.find((v) => v.id === r.versionId)?.model)) out.push(`plan revision ${r.id} model hash does not match version ${r.versionId}`); }
  for (const x of p.plans || []) if (x.parentRevisionId && !R.has(x.parentRevisionId)) out.push(`plan ${x.name} has missing parent revision`);
  for (const g of p.runGroups || []) for (const id of g.runIds || []) if (!RUN.has(id)) out.push(`run group ${g.id} points at missing run ${id}`);
  for (const r of p.reportRevisions || []) for (const id of r.runIds || []) if (!RUN.has(id)) out.push(`report ${r.id} points at missing run ${id}`);
  for (const f of p.feedback || []) if (f.reportRevisionId && !REP.has(f.reportRevisionId)) out.push(`feedback ${f.id} points at missing report ${f.reportRevisionId}`);
  return out;
}

// Use template (use-templates.js): copied into this project's configuration as a new configuration revision. A later template
// version is a separate, explicit change; saved plan revisions keep the values they froze.
export function applyProgram(p, template, { at = now(), author = null } = {}) {
  const cfg = p.contract.config, prev = cfg.program ? cfg.program.id + '@' + cfg.program.version : null;
  cfg.revision += 1; cfg.program = clone(template);
  cfg.history.push({ revision: cfg.revision, at, author, change: prev ? 'use template changed from ' + prev : 'use template applied', template: template.id + '@' + template.version });
  return cfg.program;
}
// Counts for project cards and the overview (plan §3.1).
export function stats(p) {
  const recs = (p.parameters?.records || []).filter((r) => r.active);
  return { mode: p.contract?.uiMode || 'advanced', overrides: recs.filter((r) => ['user-override', 'workbench-input'].includes(r.valueOrigin)).length, derived: recs.filter((r) => r.valueOrigin === 'derived').length, unrecorded: recs.filter((r) => r.valueOrigin === 'unrecorded').length, plans: (p.plans || []).length, revisions: (p.planRevisions || []).length, runs: (p.runs || []).length, reports: (p.reportRevisions || []).length, openFeedback: (p.feedback || []).filter((f) => f.status === 'open').length };
}
