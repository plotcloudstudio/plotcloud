// One parameter resolver for every study input (replan item 03, plan §3.3 and §6.4).
// A project keeps ParameterRecords in p.parameters.records. A record is one explicit value at one scope; records are never
// deleted: overriding appends an event, "restore default" deactivates only that record and the fixed default chain shows again.
// Resolution order, most specific first (plan §3.3):
//   1 study-object   a study's override for one object/room          4 project-config  the project's own fixed configuration
//   2 plan-object    the Plan's explicit object/room property        5 derived         derived from available inputs (e.g. matched EPW)
//   3 study-global   a study's override for the whole model           6 template        the template version fixed in this project
//                                                                     7 recipe-fallback the study recipe's fallback in code
// Within one scope an explicit input (user/Workbench/confirmed source) beats a derived or default one; two explicit inputs that
// disagree at the same scope are a conflict that the person resolves (resolve() reports it and returns no value).
// Provenance has three independent fields (plan §6.4): valueOrigin, acquisition, modeAtAcquisition.
// UI mode, legends and other display settings never enter a dependency hash, so they never make a physical result stale.
import { hashOf } from './contract-hash.js';

export const SCOPES = ['study-object', 'plan-object', 'study-global', 'project-config', 'derived', 'template', 'recipe-fallback'];
export const ORIGINS = { 'platform-default': 'Platform default', derived: 'Derived', 'workbench-input': 'Workbench input', 'user-override': 'User override', 'source-confirmed': 'Confirmed source property', unrecorded: 'Not recorded (legacy)' };
export const ACQUISITIONS = { 'auto-match': 'auto-match', 'user-station': 'station chosen by user', 'user-upload': 'user upload', 'source-import': 'source file import', 'manual-entry': 'manual entry', 'account-default': 'account default for new projects', template: 'template', rollback: 'restored from history', unrecorded: 'not recorded' };
const EXPLICIT = new Set(['workbench-input', 'user-override', 'source-confirmed', 'unrecorded']);
// Legacy values were entered by someone before provenance existed: they stay explicit, but labelled "not recorded".

// Parameters the existing project conditions carry. physical:false never enters a result's dependency hash.
export const DEFS = {
  'site.lat': { unit: '°', type: 'number', min: -90, max: 90, physical: true, mirror: ['site', 'lat'] },
  'site.lon': { unit: '°', type: 'number', min: -180, max: 180, physical: true, mirror: ['site', 'lon'] },
  'site.north': { unit: '° clockwise', type: 'number', min: -360, max: 360, physical: true, mirror: ['site', 'north'] },
  'site.tz': { unit: 'IANA zone', type: 'string', physical: true, mirror: ['site', 'tz'] },
  'site.elev': { unit: 'm', type: 'number', min: -500, max: 9000, physical: true, mirror: ['site', 'elev'] },
  'site.terrain': { unit: '', type: 'enum', values: ['open', 'suburban', 'city'], physical: true, mirror: ['site', 'terrain'] },
  'site.shelter': { unit: '', type: 'enum', values: ['exposed', 'semi', 'sheltered'], physical: true, mirror: ['site', 'shelter'] },
  'weather.epw': { unit: 'EPW sha-256', type: 'string', physical: true, mirror: ['site', 'climate'], asset: true },
  'study.period': { unit: '', type: 'enum', values: ['Equinox', 'Summer solstice', 'Winter solstice'], physical: true, mirror: ['defaults', 'period'] },
  'study.plane': { unit: 'm', type: 'number', min: 0, max: 1.5, physical: true, mirror: ['defaults', 'plane'] },
  'study.occStart': { unit: 'h', type: 'number', min: 0, max: 23, physical: true, mirror: ['defaults', 'occStart'] },
  'study.occEnd': { unit: 'h', type: 'number', min: 1, max: 24, physical: true, mirror: ['defaults', 'occEnd'] },
  'study.radius': { unit: 'm', type: 'number', min: 0, max: 5000, physical: true, mirror: ['defaults', 'radius'] },
  'study.rain': { unit: 'mm/h', type: 'number', min: 0, max: 500, physical: true, mirror: ['defaults', 'rain'] },
  'study.duration': { unit: 'min', type: 'number', min: 1, max: 1440, physical: true, mirror: ['defaults', 'duration'] },
  'study.eye': { unit: 'm', type: 'number', min: 0, max: 3, physical: true, mirror: ['defaults', 'eye'] },
  'study.band': { unit: '', type: 'string', physical: true, mirror: ['defaults', 'band'] },
  'study.code': { unit: '', type: 'string', physical: true, mirror: ['defaults', 'code'] },
  'project.buildingType': { unit: '', type: 'string', physical: false, mirror: ['defaults', 'buildingType'] },
  'display.units': { unit: '', type: 'enum', values: ['Metric', 'Imperial'], physical: false, mirror: ['defaults', 'units'] },
  'display.legend': { unit: '', type: 'string', physical: false },
  'program.use': { unit: '', type: 'enum', values: ['office', 'residential', 'school', 'generic'], physical: true },
  'program.occupancyDensity': { unit: 'people/m²', type: 'number', min: 0, max: 5, physical: true },
  'program.lightingPowerDensity': { unit: 'W/m²', type: 'number', min: 0, max: 50, physical: true },
  'program.equipmentPowerDensity': { unit: 'W/m²', type: 'number', min: 0, max: 200, physical: true },
  'program.occupiedFrom': { unit: 'h', type: 'number', min: 0, max: 23, physical: true },
  'program.occupiedUntil': { unit: 'h', type: 'number', min: 1, max: 24, physical: true },
  'program.lightingMode': { unit: '', type: 'enum', values: ['area', 'fixtures'], physical: true },
  'object.optical.reflectance': { unit: '0–1', type: 'number', min: 0, max: 1, physical: true },
  'object.optical.visibleTransmittance': { unit: '0–1 (Tv)', type: 'number', min: 0, max: 1, physical: true },
  'object.thermal.uValue': { unit: 'W/m²K', type: 'number', min: 0.05, max: 10, physical: true },
  'object.thermal.shgc': { unit: '0–1', type: 'number', min: 0, max: 1, physical: true },
  'object.acoustic.absorption500': { unit: 'α at 500 Hz', type: 'number', min: 0, max: 1, physical: true },
  'object.structure.section': { unit: '', type: 'string', physical: true },
  'object.structure.materialGrade': { unit: '', type: 'string', physical: true },
  'object.lighting.watts': { unit: 'W', type: 'number', min: 0, max: 5000, physical: true },
  'object.analysis.include': { unit: '', type: 'enum', values: ['yes', 'no'], physical: true },
  'target.daylight.meanDF': { unit: '%', type: 'number', min: 0, max: 20, physical: false },
  'ui.mode': { unit: '', type: 'enum', values: ['simple', 'advanced'], physical: false },
};
// Object/room properties are open-ended paths (e.g. object.material.reflectance); they are physical unless under display.
const defOf = (path) => DEFS[path] || (/^(object|room|material)\./.test(path) ? { unit: '', type: 'any', physical: true } : null);

// Fallbacks that the existing engine code already applies (store.conditionsSignature, project-climate.js): versioned here.
export const RECIPE_FALLBACK_VERSION = 'plotcloud-recipe-fallback@2026-10-30';
export const RECIPE_FALLBACKS = { 'site.north': 0, 'site.terrain': 'suburban', 'site.shelter': 'semi' };

// Which inputs each existing study subscribes to; mirrors store.conditionsSignature so legacy staleness and the new hash agree.
const SITE = ['site.lat', 'site.lon'], SUNPOS = [...SITE, 'site.north', 'site.tz'];
export function studyInputs(study) {
  if (['climate', 'passive'].includes(study)) return [...SITE, 'weather.epw'];
  if (study === 'shadebenefit') return [...SITE, 'site.north', 'weather.epw'];
  if (['skyview', 'solarenvelope'].includes(study)) return SUNPOS;
  if (study === 'sunhours') return [...SUNPOS, 'study.period'];
  if (study === 'radiation') return [...SUNPOS, 'weather.epw'];
  if (study === 'utci' || study === 'wind') return [...SUNPOS, 'site.terrain', 'weather.epw'];
  if (study === 'vent') return [...SUNPOS, 'site.terrain', 'site.shelter', 'weather.epw'];
  if (study === 'daylight') return [...SUNPOS, 'study.plane', 'study.occStart', 'study.occEnd', 'weather.epw'];
  if (study === 'stormwater') return [...SITE, 'study.rain', 'study.duration'];
  if (['acoustics', 'roomacoustics', 'noise'].includes(study)) return ['study.band'];
  if (['isovist', 'views', 'privacy'].includes(study)) return ['study.eye'];
  if (study === 'structure') return ['study.code'];
  return [];   // studies that read only the model (space syntax, circulation, cameras…)
}

const now = () => new Date().toISOString();
const rid = () => 'pr' + Math.random().toString(36).slice(2, 10);
export const ensure = (p) => (p.parameters && Array.isArray(p.parameters.records) ? p.parameters : (p.parameters = { schema: 1, records: [] }));
const keyOf = (r) => [r.path, r.scope, r.study || '', r.target || '', EXPLICIT.has(r.valueOrigin) ? (r.valueOrigin === 'source-confirmed' ? 'source' : 'user') : 'auto'].join('|');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function validate(path, value) {
  const d = defOf(path); if (!d) throw Error(`Unknown parameter ${path}.`);
  if (value === undefined) throw Error(`${path} needs a value.`);
  if (d.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value) || value < d.min || value > d.max)) throw Error(`${path} must be a number from ${d.min} to ${d.max} ${d.unit}.`.trim());
  if (d.type === 'enum' && !d.values.includes(value)) throw Error(`${path} must be one of ${d.values.join(', ')}.`);
  if (d.type === 'string' && (typeof value !== 'string' || !value.trim())) throw Error(`${path} must be a non-empty text value.`);
  if (path === 'site.tz') { try { new Intl.DateTimeFormat('en', { timeZone: value }); } catch (e) { throw Error('site.tz must be a valid IANA time zone.'); } }
  return d;
}

// Write one explicit value. The parameter page and Workbench both call this, so the same path/scope/target is one record.
export function setParameter(p, { path, value, scope = 'project-config', study = null, target = null, valueOrigin = 'user-override', acquisition = 'manual-entry', mode = null, source = null, ruleVersion = null, parents = [], author = null, meta, at = now(), event = 'set', unvalidated = false }) {
  if (!SCOPES.slice(0, 5).includes(scope)) throw Error(`Values cannot be written at scope ${scope}; templates and recipe fallbacks are fixed versions.`);
  if (!ORIGINS[valueOrigin] || !ACQUISITIONS[acquisition]) throw Error('Unknown provenance.');
  if ((scope === 'study-object' || scope === 'plan-object') && !target) throw Error(`${scope} needs a target object or room.`);
  if ((scope === 'study-object' || scope === 'study-global') && !study) throw Error(`${scope} needs a study.`);
  // unvalidated is only for keeping a legacy value exactly as it was stored, labelled "not recorded"
  if (unvalidated && valueOrigin !== 'unrecorded') throw Error('Only legacy values may skip validation.');
  const d = unvalidated ? (defOf(path) || { unit: '' }) : validate(path, value), store = ensure(p);
  const draft = { path, scope, study, target, valueOrigin }, k = keyOf(draft);
  let r = store.records.find((x) => x.active && keyOf(x) === k);
  const ev = { type: event, at, author, value, mode, acquisition, valueOrigin };
  if (r) {
    if (same(r.value, value) && r.acquisition === acquisition && same(r.source, source) && same(r.meta, meta)) return r;
    ev.previous = r.value; r.events.push(ev);
    Object.assign(r, { value, acquisition, modeAtAcquisition: mode, source, ruleVersion, parents: [...parents], at, author, ...(meta === undefined ? {} : { meta }) });
  } else {
    r = { id: rid(), path, scope, study, target, value, unit: d.unit, valueOrigin, acquisition, modeAtAcquisition: mode, source, ruleVersion, parents: [...parents], at, author, active: true, events: [ev], ...(meta === undefined ? {} : { meta }) };
    store.records.push(r);
  }
  return r;
}

// Candidates for one query, in priority order, including the fixed template and recipe fallback.
function candidates(p, { path, study = null, target = null }) {
  const recs = ensure(p).records.filter((r) => r.active && r.path === path), out = [];
  const match = { 'study-object': (r) => study && target && r.study === study && r.target === target, 'plan-object': (r) => target && r.target === target, 'study-global': (r) => study && r.study === study && !r.target, 'project-config': (r) => !r.study && !r.target, derived: (r) => (!r.study || r.study === study) && (!r.target || r.target === target) };
  for (const scope of SCOPES.slice(0, 5)) {
    const here = recs.filter((r) => r.scope === scope && match[scope](r)).sort((a, b) => (EXPLICIT.has(b.valueOrigin) ? 1 : 0) - (EXPLICIT.has(a.valueOrigin) ? 1 : 0));
    out.push(...here);
  }
  const u = p.contract?.config?.program;   // the use template fixed in this project (use-templates.js), below explicit values
  if (u && u.values && u.values[path] !== undefined) out.push({ id: 'program:' + u.id + '@' + u.version, path, scope: 'template', value: u.values[path], unit: defOf(path)?.unit ?? '', valueOrigin: 'platform-default', acquisition: 'template', modeAtAcquisition: null, ruleVersion: u.id + '@' + u.version, parents: [], fixed: true });
  const t = p.contract?.config?.template;
  if (t && t.values && t.values[path] !== undefined) out.push({ id: 'template:' + t.id + '@' + t.version, path, scope: 'template', value: t.values[path], unit: defOf(path)?.unit ?? '', valueOrigin: 'platform-default', acquisition: 'template', modeAtAcquisition: null, ruleVersion: t.id + '@' + t.version, parents: [], fixed: true });
  if (RECIPE_FALLBACKS[path] !== undefined) out.push({ id: 'fallback:' + RECIPE_FALLBACK_VERSION, path, scope: 'recipe-fallback', value: RECIPE_FALLBACKS[path], unit: defOf(path)?.unit ?? '', valueOrigin: 'platform-default', acquisition: 'template', modeAtAcquisition: null, ruleVersion: RECIPE_FALLBACK_VERSION, parents: [], fixed: true });
  return out;
}

// The effective value with its source chain. status: 'ok' | 'conflict' | 'missing'.
export function resolve(p, query) {
  const list = candidates(p, query), top = list[0];
  if (!top) return { path: query.path, status: 'missing', value: undefined, chain: [] };
  const rivals = list.filter((r) => r.scope === top.scope && EXPLICIT.has(r.valueOrigin) && EXPLICIT.has(top.valueOrigin) && r.id !== top.id && !same(r.value, top.value));
  const chain = list.map((r, i) => ({ id: r.id, scope: r.scope, value: r.value, valueOrigin: r.valueOrigin, acquisition: r.acquisition, effective: i === 0 && !rivals.length }));
  if (rivals.length) return { path: query.path, status: 'conflict', value: undefined, unit: top.unit, candidates: [top, ...rivals].map((r) => ({ id: r.id, value: r.value, valueOrigin: r.valueOrigin, acquisition: r.acquisition })), chain };
  return { path: query.path, status: 'ok', value: top.value, unit: top.unit, scope: top.scope, recordId: top.id, valueOrigin: top.valueOrigin, acquisition: top.acquisition, modeAtAcquisition: top.modeAtAcquisition, ruleVersion: top.ruleVersion || null, source: top.source || null, parents: top.parents || [], label: provenanceLabel(top), chain };
}
export function chooseConflict(p, keepId, { author = null, at = now() } = {}) {
  const keep = ensure(p).records.find((r) => r.id === keepId && r.active); if (!keep) throw Error('That value is no longer available.');
  for (const r of ensure(p).records) if (r !== keep && r.active && r.path === keep.path && r.scope === keep.scope && (r.study || null) === (keep.study || null) && (r.target || null) === (keep.target || null) && EXPLICIT.has(r.valueOrigin)) { r.active = false; r.events.push({ type: 'conflict-dropped', at, author, keptRecordId: keep.id }); }
  keep.events.push({ type: 'conflict-kept', at, author });
  return keep;
}
// Restore default: deactivate only the matching explicit override; the fixed default chain resolves again.
export function restoreDefault(p, { path, scope = 'project-config', study = null, target = null, author = null, at = now() }) {
  const hit = ensure(p).records.filter((r) => r.active && r.path === path && r.scope === scope && (r.study || null) === study && (r.target || null) === target && r.valueOrigin !== 'derived' && r.valueOrigin !== 'platform-default');
  for (const r of hit) { r.active = false; r.events.push({ type: 'restore-default', at, author }); }
  return { removed: hit.map((r) => r.id), resolved: resolve(p, { path, study, target }) };
}
export function provenanceLabel(r, mode = r.modeAtAcquisition) {
  const m = mode === 'simple' ? 'Simple ' : mode === 'advanced' ? 'Advanced ' : '';
  return `${ORIGINS[r.valueOrigin] || r.valueOrigin} · ${m}${ACQUISITIONS[r.acquisition] || r.acquisition}`;
}

// Every effective physical value a study depends on, and its hash. The model hash enters separately (PlanRevision).
export function studySnapshot(p, study, { target = null } = {}) {
  const values = {}, sources = {}, problems = [];
  for (const path of studyInputs(study)) {
    const r = resolve(p, { path, study, target });
    if (r.status !== 'ok') { problems.push({ path, status: r.status }); continue; }
    if (!defOf(path)?.physical) continue;
    values[path] = r.value; sources[path] = { recordId: r.recordId, scope: r.scope, valueOrigin: r.valueOrigin, acquisition: r.acquisition, modeAtAcquisition: r.modeAtAcquisition, ruleVersion: r.ruleVersion };
  }
  return { study, values, sources, problems, hash: hashOf(values) };
}
// Is a saved result still valid for the current inputs? Only the inputs that study subscribes to matter.
export function applicability(p, run) {
  const used = run?.inputs; if (!used || !used.values) return { status: 'unrecorded', changed: [] };
  const now = studySnapshot(p, run.simId), changed = [...new Set([...Object.keys(used.values), ...Object.keys(now.values)])].filter((k) => !same(used.values[k], now.values[k]));
  return { status: changed.length ? 'stale' : 'current', changed };
}
// Every effective parameter for export (T09 audit table) — final value plus its source.
export function effectiveTable(p) {
  return Object.keys(DEFS).map((path) => resolve(p, { path })).filter((r) => r.status !== 'missing').map((r) => ({ path: r.path, status: r.status, value: r.value, unit: r.unit, scope: r.scope, valueOrigin: r.valueOrigin, acquisition: r.acquisition, modeAtAcquisition: r.modeAtAcquisition, ruleVersion: r.ruleVersion, recordId: r.recordId, label: r.label }));
}

// ---- the existing sharedConditions object is kept as the projection the engines read
const getIn = (o, [a, b]) => o?.[a]?.[b];
export function conditionValue(c, path) { const d = DEFS[path]; if (!d?.mirror) return undefined; const v = getIn(c, d.mirror); return path === 'weather.epw' ? v?.hash : v; }
// Record what changed between two sharedConditions objects (the parameter page, EPW import and revert all pass through here).
export function recordConditionsChange(p, before, after, { acquisition = 'manual-entry', valueOrigin = 'user-override', mode = p.contract?.uiMode ?? null, author = null, event = 'set', at = now() } = {}) {
  const written = [];
  for (const path of Object.keys(DEFS)) {
    if (!DEFS[path].mirror) continue;
    const a = conditionValue(before, path), b = conditionValue(after, path);
    if (same(a, b)) continue;
    if (b === undefined || b === null || b === '') { written.push(...restoreDefault(p, { path, author, at }).removed); for (const r of ensure(p).records) if (r.active && r.path === path && r.scope === 'derived') { r.active = false; r.events.push({ type: 'cleared', at, author }); } continue; }
    if (path === 'weather.epw') {
      const c = after.site.climate, auto = !!c.automatic, src = { uri: c.sourceURL || null, hash: c.hash, label: [c.station, c.provider, c.period].filter(Boolean).join(' · ') || c.name || null };
      const rec = setParameter(p, { path, value: b, scope: auto ? 'derived' : 'project-config', valueOrigin: auto ? 'derived' : 'user-override', acquisition: auto ? (c.stationChosen ? 'user-station' : 'auto-match') : 'user-upload', mode, source: src, ruleVersion: auto ? 'nearest-station@' + (c.catalogRetrieved || 'unrecorded') : null, parents: auto ? ['site.lat', 'site.lon'] : [], author, at, event, meta: c });
      if (auto) restoreDefault(p, { path, author, at });   // a fresh automatic match replaces an earlier upload for future runs
      written.push(rec.id); continue;
    }
    let rec;
    try { rec = setParameter(p, { path, value: b, valueOrigin, acquisition, mode, author, at, event }); }
    catch (e) { rec = setParameter(p, { path, value: b, valueOrigin: 'unrecorded', acquisition: 'unrecorded', mode: null, author, at, event: 'set-unvalidated', unvalidated: true, meta: { validation: e.message } }); }
    // the project's value is now this one: earlier project-level records for the path are superseded, not deleted
    for (const r of ensure(p).records) if (r !== rec && r.active && r.path === path && r.scope === 'project-config' && !r.study && !r.target) { r.active = false; r.events.push({ type: 'superseded', at, author, by: rec.id }); }
    written.push(rec.id);
  }
  return written;
}
// Values the projection disagrees with: should be empty after every write through the store.
export function mirrorMismatches(p, c = p.sharedConditions) {
  const out = [];
  for (const path of Object.keys(DEFS)) {
    if (!DEFS[path].mirror) continue;
    const want = conditionValue(c, path); if (want === undefined) continue;
    const r = resolve(p, { path }); if (r.status !== 'ok' || !same(r.value, want)) out.push({ path, mirror: want, resolved: r.value, status: r.status });
  }
  return out;
}
// Write resolved project-level values back into the projection (after restore default or conflict choice).
export function syncMirror(p) {
  const c = p.sharedConditions; if (!c) return;
  for (const path of Object.keys(DEFS)) {
    const d = DEFS[path]; if (!d.mirror) continue;
    const r = resolve(p, { path }), [a, b] = d.mirror;
    if (r.status === 'missing' && path === 'weather.epw') { delete c[a][b]; continue; }
    if (r.status !== 'ok') continue;
    if (path === 'weather.epw') { const rec = ensure(p).records.find((x) => x.id === r.recordId); if (rec?.meta) c[a][b] = JSON.parse(JSON.stringify(rec.meta)); continue; }
    if (c[a][b] !== undefined || r.scope !== 'recipe-fallback') c[a][b] = r.value;
  }
}
