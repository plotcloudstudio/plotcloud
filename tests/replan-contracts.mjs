// Contract tests for replan items 02 (project/plan/run data) and 03 (parameter resolution). node --test tests/replan-contracts.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sha256, hashOf } from '../mvp/js/contract-hash.js';
import * as P from '../mvp/js/parameters.js';
import * as C from '../mvp/js/project-contract.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const site = { label: 'Toronto', lat: 43.65, lon: -79.38, north: 15, tz: 'America/Toronto', terrain: 'city' };
const defaults = { units: 'Metric', radius: 250, plane: 0.8, occStart: 8, occEnd: 18, period: 'Equinox', rain: 50, duration: 60, band: '500 Hz', eye: 1.2, code: 'NBC 2020' };
const model = (w = 4) => ({ units: 'm', layers: [], components: [{ id: 'c1', type: 'wall', g: { w } }, { id: 'win1', type: 'window', g: { w: 1.2 } }] });
const epwMeta = { name: 'qa.epw', hash: 'a'.repeat(64), station: 'QA', hours: 8760, lat: 43.6, lon: -79.4 };
// A schema-1 project as stored before this change, with two versions, one run and an uploaded EPW.
function legacy() {
  return { id: 'p1', name: 'Legacy', created: '2026-10-01T00:00:00Z', updated: '2026-10-02T00:00:00Z', siteLinked: true, site: clone(site),
    versions: [{ id: 'v1', n: 1, note: 'A', created: '2026-10-01T01:00:00Z', model: model(4) }, { id: 'v2', n: 2, note: 'B', created: '2026-10-01T02:00:00Z', model: model(5) }],
    runs: [{ id: 'r1', versionId: 'v1', simId: 'daylight', settings: { sharedConditions: { signature: 'x', site: { climate: epwMeta } } }, results: { kpis: [] }, created: '2026-10-01T03:00:00Z', source: 'full-tool' }],
    draft: model(5), sharedConditions: { schema: 1, revision: 3, updated: '2026-10-01T00:00:00Z', site: { ...clone(site), climate: epwMeta }, defaults: clone(defaults) } };
}
function fresh(id = 'pn') {
  const p = { id, name: 'New', created: '2026-10-30T00:00:00Z', versions: [], runs: [], draft: model(), sharedConditions: { schema: 1, revision: 1, site: clone(site), defaults: { ...clone(defaults), plane: 1.0 } } };
  return C.initProject(p, { at: '2026-10-30T00:00:00Z' });
}
const addVersion = (p, m) => { const v = { id: 'v' + (p.versions.length + 1), n: p.versions.length + 1, created: new Date().toISOString(), model: m }; p.versions.push(v); return v; };
const change = (p, mutate, prov) => { const before = clone(p.sharedConditions), after = clone(before); mutate(after); after.revision++; P.recordConditionsChange(p, before, after, prov); p.sharedConditions = after; };

test('sha256 matches node crypto, canonical hashing ignores key order', () => {
  for (const s of ['', 'abc', 'é漢字', 'x'.repeat(1000)]) assert.equal(sha256(s), createHash('sha256').update(s, 'utf8').digest('hex'));
  assert.equal(hashOf({ a: 1, b: [1, { c: 2, d: 3 }] }), hashOf({ b: [1, { d: 3, c: 2 }], a: 1 }));
});

test('template constant matches the existing store DEFAULTS', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../mvp/js/store.js', import.meta.url), 'utf8');
  const D = Function('return ' + src.match(/export const DEFAULTS = (\{[^}]+\})/)[1])();
  for (const [k, v] of Object.entries(D)) { const path = k === 'units' ? 'display.units' : 'study.' + k; assert.deepEqual(C.TEMPLATE.values[path], v, path); }
});

test('02 migration: schema, lineage, legacy provenance, idempotent', () => {
  const p = legacy(), before = clone(p);
  assert.equal(C.migrateProject(p, { at: '2026-10-30T00:00:00Z' }), true);
  assert.equal(p.contract.schema, 2); assert.equal(p.contract.migratedFrom, 1);
  assert.deepEqual(p.versions, before.versions, 'versions untouched'); assert.deepEqual(p.sharedConditions, before.sharedConditions, 'conditions untouched');
  assert.deepEqual(p.runs[0].settings, before.runs[0].settings, 'run settings untouched'); assert.deepEqual(p.runs[0].results, before.runs[0].results);
  assert.equal(p.planRevisions.length, 2); assert.equal(p.planRevisions[1].parentRevisionId, p.planRevisions[0].id);
  assert.equal(p.planRevisions[0].conditions, 'unrecorded', 'history is not back-filled'); assert.equal(p.runs[0].planRevisionId, 'rev-v1');
  assert.deepEqual(p.runs[0].recipe, { id: 'daylight', engine: 'unrecorded', version: 'unrecorded' });
  const lat = P.resolve(p, { path: 'site.lat' }); assert.equal(lat.value, 43.65); assert.equal(lat.valueOrigin, 'unrecorded'); assert.equal(lat.acquisition, 'unrecorded');
  const epw = P.resolve(p, { path: 'weather.epw' }); assert.equal(epw.valueOrigin, 'user-override'); assert.equal(epw.acquisition, 'user-upload');
  assert.equal(p.assets.length, 1); assert.equal(p.assets[0].hash, epwMeta.hash); assert.ok(p.assets[0].references.length >= 2, 'current and historical references');
  assert.deepEqual(P.mirrorMismatches(p), []); assert.deepEqual(C.integrityProblems(p), []);
  const snap = clone(p);
  assert.equal(C.migrateProject(p), false, 'second migration is a no-op');
  assert.deepEqual(p, snap, 'repeat migration creates nothing');
});

test('02 runs reference frozen PlanRevisions; same inputs reuse, changes create new; history immutable', () => {
  const p = fresh(); const v1 = addVersion(p, model(4));
  const a = C.runContract(p, v1.id, 'daylight'), b = C.runContract(p, v1.id, 'sunhours');
  assert.equal(a.planRevisionId, b.planRevisionId, 'one revision for the same plan, version and inputs');
  const rev = clone(C.revision(p, a.planRevisionId));
  assert.equal(rev.uiModeAtFreeze, 'advanced'); assert.ok(rev.parameters.some((x) => x.path === 'study.plane' && x.value === 1.0));
  change(p, (c) => { c.defaults.plane = 0.75; });
  const c2 = C.runContract(p, v1.id, 'daylight');
  assert.notEqual(c2.planRevisionId, a.planRevisionId); assert.equal(C.revision(p, c2.planRevisionId).parentRevisionId, a.planRevisionId);
  assert.deepEqual(C.revision(p, a.planRevisionId), rev, 'earlier revision unchanged');
  C.setUiMode(p, 'simple');
  assert.equal(C.runContract(p, v1.id, 'daylight').planRevisionId, c2.planRevisionId, 'UI mode is not a physical input');
});

test('02 A/B/C lineage and rollback-as-new-revision data', () => {
  const p = fresh(); const v1 = addVersion(p, model(4)); const a = C.freezePlan(p, v1.id);
  const B = C.derivePlan(p, a.id); assert.equal(B.name, 'B'); assert.equal(B.parentRevisionId, a.id);
  const v2 = addVersion(p, model(6)); const b = C.freezePlan(p, v2.id); assert.equal(b.planId, B.id); assert.equal(b.parentRevisionId, a.id);
  const Cc = C.derivePlan(p, b.id); assert.equal(Cc.name, 'C');
  const v3 = addVersion(p, model(7)); const c = C.freezePlan(p, v3.id);
  assert.deepEqual(C.lineage(p, c.id), [c.id, b.id, a.id]);
  const restored = C.freezePlan(p, v1.id, { restoredFrom: a.id }); assert.equal(restored.restoredFrom, a.id); assert.notEqual(restored.id, a.id);
  assert.deepEqual(C.integrityProblems(p), []);
});

test('02 two projects and Account defaults stay isolated', () => {
  const account = { defaults: clone(defaults) };
  const X = fresh('x'), Y = fresh('y'), yBefore = clone(Y);
  change(X, (c) => { c.defaults.plane = 0.6; c.site.terrain = 'open'; });
  assert.equal(P.resolve(X, { path: 'study.plane' }).value, 0.6);
  assert.deepEqual(Y, yBefore, 'Y untouched by X');
  account.defaults.plane = 1.4;   // Account changes after creation never enter a resolver
  assert.equal(P.resolve(Y, { path: 'study.plane' }).value, 1.0); assert.equal(P.resolve(X, { path: 'study.plane' }).value, 0.6);
  assert.equal(P.resolve(Y, { path: 'study.plane' }).acquisition, 'account-default');
});

test('03 resolution priority across scopes, and validation', () => {
  const p = fresh();
  assert.equal(P.resolve(p, { path: 'study.radius' }).acquisition, 'template');
  assert.equal(P.resolve(p, { path: 'site.shelter' }).scope, 'recipe-fallback');
  P.setParameter(p, { path: 'study.plane', value: 0.9, scope: 'study-global', study: 'daylight' });
  P.setParameter(p, { path: 'study.plane', value: 0.7, scope: 'plan-object', target: 'room-1', valueOrigin: 'workbench-input', acquisition: 'manual-entry', mode: 'advanced' });
  P.setParameter(p, { path: 'study.plane', value: 0.5, scope: 'study-object', study: 'daylight', target: 'room-1' });
  assert.equal(P.resolve(p, { path: 'study.plane' }).value, 1.0, 'project value');
  assert.equal(P.resolve(p, { path: 'study.plane', study: 'daylight' }).value, 0.9, 'study global beats project');
  assert.equal(P.resolve(p, { path: 'study.plane', target: 'room-1' }).value, 0.7, 'plan object beats project');
  assert.equal(P.resolve(p, { path: 'study.plane', study: 'daylight', target: 'room-1' }).value, 0.5, 'study object beats all');
  assert.equal(P.resolve(p, { path: 'study.plane', study: 'daylight', target: 'room-2' }).value, 0.9, 'local override does not leak to another room');
  assert.equal(P.resolve(p, { path: 'study.plane', study: 'sunhours', target: 'room-1' }).value, 0.7);
  assert.throws(() => P.setParameter(p, { path: 'study.plane', value: 2 }), /0 to 1.5/);
  assert.throws(() => P.setParameter(p, { path: 'site.tz', value: 'Mars/Base' }), /IANA/);
  assert.throws(() => P.setParameter(p, { path: 'study.plane', value: 1, scope: 'template' }), /fixed/);
  const r = P.resolve(p, { path: 'study.plane', target: 'room-1' });
  assert.equal(r.label, 'Workbench input · Advanced manual entry');
  assert.deepEqual(r.chain.map((x) => x.scope), ['plan-object', 'project-config', 'template']);
});

test('03 Workbench and parameter page write one record; conflicts need a choice', () => {
  const p = fresh();
  const a = P.setParameter(p, { path: 'object.material.reflectance', value: 0.5, scope: 'plan-object', target: 'wall-1', valueOrigin: 'workbench-input' });
  const b = P.setParameter(p, { path: 'object.material.reflectance', value: 0.6, scope: 'plan-object', target: 'wall-1', valueOrigin: 'user-override' });
  assert.equal(a.id, b.id, 'same record, with an event history'); assert.equal(b.events.length, 2); assert.equal(b.events[1].previous, 0.5);
  P.setParameter(p, { path: 'object.material.reflectance', value: 0.4, scope: 'plan-object', target: 'wall-1', valueOrigin: 'source-confirmed', acquisition: 'source-import' });
  const r = P.resolve(p, { path: 'object.material.reflectance', target: 'wall-1' });
  assert.equal(r.status, 'conflict'); assert.equal(r.value, undefined); assert.equal(r.candidates.length, 2);
  P.chooseConflict(p, b.id); assert.equal(P.resolve(p, { path: 'object.material.reflectance', target: 'wall-1' }).value, 0.6);
});

test('03 provenance combinations keep three independent fields', () => {
  const p = fresh();
  change(p, (c) => { c.site.climate = { ...epwMeta, automatic: true, provider: 'onebuilding', sourceURL: 'https://climate.onebuilding.org/x.zip', catalogRetrieved: '2026-10' }; }, { mode: 'simple' });
  const auto = P.resolve(p, { path: 'weather.epw' });
  assert.equal(auto.label, 'Derived · Simple auto-match'); assert.equal(auto.scope, 'derived'); assert.deepEqual(auto.parents, ['site.lat', 'site.lon']);
  change(p, (c) => { c.site.climate = { ...epwMeta, hash: 'b'.repeat(64) }; }, { mode: 'simple' });
  const up = P.resolve(p, { path: 'weather.epw' });
  assert.equal(up.label, 'User override · Simple user upload', 'an upload in Simple is not relabelled Advanced');
  assert.equal(up.valueOrigin, 'user-override'); assert.equal(up.acquisition, 'user-upload'); assert.equal(up.modeAtAcquisition, 'simple');
  // restore default removes only the upload: the automatic match shows again, and the projection follows
  P.restoreDefault(p, { path: 'weather.epw' }); P.syncMirror(p);
  assert.equal(P.resolve(p, { path: 'weather.epw' }).value, 'a'.repeat(64)); assert.equal(p.sharedConditions.site.climate.hash, 'a'.repeat(64));
  assert.deepEqual(P.mirrorMismatches(p), []);
});

test('03 restore default removes only the target override and re-resolves the fixed chain', () => {
  const p = fresh();
  change(p, (c) => { c.defaults.plane = 0.6; c.defaults.radius = 300; });
  P.setParameter(p, { path: 'study.plane', value: 0.9, scope: 'study-global', study: 'daylight' });
  const out = P.restoreDefault(p, { path: 'study.plane' });
  assert.equal(out.resolved.value, 0.8); assert.equal(out.resolved.scope, 'template');
  assert.equal(P.resolve(p, { path: 'study.radius' }).value, 300, 'other overrides kept');
  assert.equal(P.resolve(p, { path: 'study.plane', study: 'daylight' }).value, 0.9, 'study override kept');
  const rec = P.ensure(p).records.find((r) => out.removed.includes(r.id)); assert.equal(rec.active, false); assert.equal(rec.events.at(-1).type, 'restore-default');
});

test('03 template upgrade is a separate, previewed change that leaves saved revisions alone', () => {
  const p = fresh(); P.restoreDefault(p, { path: 'study.plane' }); const v = addVersion(p, model()); const r1 = clone(C.freezePlan(p, v.id));
  const next = { ...C.TEMPLATE, version: '2026-11-01.1', values: { ...C.TEMPLATE.values, 'study.plane': 0.75 } };
  assert.deepEqual(C.templateDiff(p, next), [{ path: 'study.plane', from: 0.8, to: 0.75 }]);
  assert.equal(P.resolve(p, { path: 'study.plane' }).value, 0.8, 'preview alone changes nothing');
  C.upgradeTemplate(p, next);
  assert.equal(P.resolve(p, { path: 'study.plane' }).value, 0.75); assert.equal(p.contract.config.revision, 2);
  assert.deepEqual(C.revision(p, r1.id), r1, 'saved revision unchanged');
});

test('03 dependency hashes: only affected studies go stale; display and mode never do', () => {
  const p = fresh(); const v = addVersion(p, model());
  const run = (simId) => ({ simId, ...C.runContract(p, v.id, simId) });
  const day = run('daylight'), sun = run('sunhours'), clim = run('climate');
  change(p, (c) => { c.defaults.plane = 0.6; });
  assert.deepEqual(P.applicability(p, day), { status: 'stale', changed: ['study.plane'] });
  assert.equal(P.applicability(p, sun).status, 'current'); assert.equal(P.applicability(p, clim).status, 'current');
  change(p, (c) => { c.defaults.units = 'Imperial'; c.defaults.buildingType = 'Office'; });
  C.setUiMode(p, 'simple');
  assert.equal(P.applicability(p, sun).status, 'current', 'display and UI mode are not physical');
  change(p, (c) => { c.site.north = 30; });
  assert.equal(P.applicability(p, sun).status, 'stale'); assert.equal(P.applicability(p, clim).status, 'current', 'climate does not depend on north');
  assert.equal(P.applicability(p, { simId: 'daylight' }).status, 'unrecorded', 'legacy run without recorded inputs');
  const table = P.effectiveTable(p); const row = table.find((x) => x.path === 'site.north');
  assert.equal(row.value, 30); assert.equal(row.unit, '° clockwise'); assert.ok(row.recordId);
});
