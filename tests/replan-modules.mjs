// Contract tests for replan items 06, 07, 09, 10 and 11 (pure modules). node --test tests/replan-modules.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateEpw } from '../mvp/js/epw-validate.js';
import { USE_TEMPLATES, GENERIC, templateFor, annualProfile, occupiedHours, scheduleValue, lightingLoad } from '../mvp/js/use-templates.js';
import { delta, judge, comparability, fieldDiff } from '../mvp/js/compare-metrics.js';
import { applyPatch, recommend, adopt } from '../mvp/js/recommendations.js';
import { registry, CATEGORIES, TARGETS, targetStatus, categoryOf } from '../mvp/js/capabilities.js';
import { SIMS, sampleModel } from '../mvp/js/data.js';
import { buildPptx } from '../mvp/js/pptx.js';
import * as C from '../mvp/js/project-contract.js';
import * as P from '../mvp/js/parameters.js';

function epw({ hours = 8760, mutate } = {}) {
  const lines = ['LOCATION,QA,BC,CAN,TEST,000,49,-123,-8,70', 'DESIGN CONDITIONS,0', 'TYPICAL/EXTREME PERIODS,0', 'GROUND TEMPERATURES,0', 'HOLIDAYS/DAYLIGHT SAVINGS,No,0,0,0', 'COMMENTS 1,QA', 'COMMENTS 2,QA', 'DATA PERIODS,1,1,Data,Sunday, 1/ 1,12/31'];
  const days = [31, hours === 8784 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (let m = 1; m <= 12; m++) for (let d = 1; d <= days[m - 1]; d++) for (let h = 1; h <= 24; h++) { const r = Array(35).fill('0'); Object.assign(r, { 0: '2025', 1: String(m), 2: String(d), 3: String(h), 6: '12', 7: '5', 8: '60', 9: '101000', 13: '100', 14: '200', 15: '50', 20: '180', 21: '3' }); lines.push(r.join(',')); }
  if (mutate) mutate(lines);
  return lines.join('\n');
}
test('07 EPW: 8760 and 8784 accepted unchanged; gaps, duplicates, sub-hourly and partial files rejected', () => {
  const a = validateEpw(epw()); assert.equal(a.ok, true); assert.equal(a.hours, 8760); assert.equal(a.leap, false); assert.deepEqual(a.blocked, {});
  const b = validateEpw(epw({ hours: 8784 })); assert.equal(b.ok, true); assert.equal(b.hours, 8784, 'leap year kept, not truncated'); assert.equal(b.leap, true);
  const dup = validateEpw(epw({ mutate: (l) => { l[20] = l[19]; } })); assert.equal(dup.ok, false); assert.match(dup.errors.join(' '), /duplicate/); assert.match(dup.errors.join(' '), /not continuous/);
  const sub = validateEpw(epw({ mutate: (l) => { l[7] = 'DATA PERIODS,1,4,Data,Sunday, 1/ 1,12/31'; } })); assert.equal(sub.ok, false); assert.match(sub.errors[0], /4 records per hour/);
  const part = validateEpw(epw({ mutate: (l) => l.splice(100, 24) })); assert.equal(part.ok, false); assert.match(part.errors[0], /8736/);
});
test('07 EPW: missing radiation blocks only the studies that need it; sentinels are never zero', () => {
  const r = validateEpw(epw({ mutate: (l) => { for (let i = 8; i < l.length; i++) { const a = l[i].split(','); a[14] = '9999'; a[15] = '9999'; l[i] = a.join(','); } } }));
  assert.equal(r.ok, true); assert.equal(r.fields.dni.missing, 8760); assert.ok(r.blocked.radiation && r.blocked.daylight && r.blocked.utci); assert.equal(r.blocked.wind, undefined); assert.equal(r.blocked.climate, undefined);
  const w = validateEpw(epw({ mutate: (l) => { const a = l[50].split(','); a[21] = '999'; l[50] = a.join(','); } })); assert.equal(w.fields.windSpeed.missing, 1); assert.match(w.warnings.join(' '), /kept missing, never set to zero/);
});
test('07 use templates: fixed versions, distinct schedules, calendar alignment, no double-counted lighting', () => {
  for (const t of Object.values(USE_TEMPLATES)) { assert.match(t.version, /^\d{4}-\d\d-\d\d\.\d+$/); assert.match(t.source, /not from a code/); for (const s of Object.values(t.schedules)) for (const d of ['weekday', 'saturday', 'sunday']) assert.equal(s[d].length, 24); }
  assert.equal(templateFor('unknown'), GENERIC); assert.equal(annualProfile(GENERIC, 'occupancy'), null, 'unknown use has no invented schedule');
  assert.equal(scheduleValue(USE_TEMPLATES.office, 'occupancy', 2025, 1, 6, 10), 0.95, 'Monday 09–10');
  assert.equal(scheduleValue(USE_TEMPLATES.office, 'occupancy', 2025, 1, 5, 10), 0, 'Sunday');
  assert.equal(scheduleValue(USE_TEMPLATES.school, 'occupancy', 2025, 7, 15, 10), 0, 'school summer break');
  assert.equal(annualProfile(USE_TEMPLATES.office, 'occupancy', { hours: 8784 }).length, 8784);
  const o = occupiedHours(USE_TEMPLATES.office, { hours: 8760 }), s = occupiedHours(USE_TEMPLATES.school, { hours: 8760 }); assert.notEqual(o.count, s.count); assert.equal(o.of, 8760);
  assert.deepEqual(lightingLoad({ area: 50, templateLpd: 8 }), { mode: 'area', watts: 400, lpd: 8, source: 'use template density' });
  const f = lightingLoad({ area: 50, templateLpd: 8, fixtures: [{ id: 'L1', watts: 120 }, { id: 'L2', watts: 80 }] }); assert.equal(f.watts, 200); assert.equal(f.templateIgnored, true, 'fixtures replace the template density');
  assert.throws(() => lightingLoad({ area: 50, templateLpd: 8, fixtures: [{ id: 'L1' }] }), /input power/);
});
test('07 room-level use override stays in its room', () => {
  const p = { id: 'p', versions: [], runs: [], sharedConditions: { revision: 1, site: { lat: 1, lon: 1 }, defaults: {} } }; C.initProject(p); C.applyProgram(p, USE_TEMPLATES.office);
  P.setParameter(p, { path: 'program.use', value: 'school', scope: 'plan-object', target: 'room-2', valueOrigin: 'workbench-input' });
  assert.equal(P.resolve(p, { path: 'program.use', target: 'room-2' }).value, 'school'); assert.equal(P.resolve(p, { path: 'program.use', target: 'room-1' }).value, 'office'); assert.equal(P.resolve(p, { path: 'program.use' }).ruleVersion, 'plotcloud-use-office@2026-10-30.1');
});
test('10 differences: percentage points, zero base, missing values, targets', () => {
  const d = delta(50, 60, { unit: '%' }); assert.equal(d.abs, 10); assert.equal(d.absUnit, 'pp'); assert.equal(d.rel, 20);
  const z = delta(0, 5, { unit: 'h' }); assert.equal(z.rel, null); assert.match(z.relNote, /undefined/);
  assert.equal(delta(null, 5).status, 'missing'); assert.equal(delta(undefined, undefined).note, 'missing in A and B');
  assert.equal(judge(d, null).verdict, 'no-target'); assert.equal(judge(delta(1, 2), { min: 3 }).verdict, 'better'); assert.equal(judge(delta(4, 2), { min: 3 }).verdict, 'worse'); assert.equal(judge(delta(30, 35), { min: 20, max: 40 }).verdict, 'meets-both');
});
test('10 comparability: design, scenario (weather/grid), not comparable (method), unverified legacy', () => {
  const run = (o = {}) => ({ simId: 'daylight', recipe: { engine: 'browser', version: 'unrecorded' }, inputs: { values: { 'site.lat': 1, 'weather.epw': 'a' } }, settings: { grid: 0.5 }, results: {}, ...o });
  assert.equal(comparability(run(), run()).kind, 'design');
  assert.equal(comparability(run(), run({ inputs: { values: { 'site.lat': 1, 'weather.epw': 'b' } } })).kind, 'scenario');
  assert.equal(comparability(run(), run({ settings: { grid: 1 } })).kind, 'scenario');
  assert.equal(comparability(run(), run({ recipe: { engine: 'local-reference', version: 'x' } })).kind, 'not-comparable');
  assert.equal(comparability(run(), run({ inputs: undefined })).kind, 'unverified');
  const fa = { unit: '%', pts: [0, 0, 1, 1, 0, 2, 2, 0, 3] }, fb = { unit: '%', pts: [0, 0, 2, 1, 0, 2, 5, 5, 9] };
  const fd = fieldDiff(fa, fb); assert.equal(fd.matched, 2); assert.equal(fd.onlyA, 1); assert.equal(fd.onlyB, 1); assert.equal(fd.unit, 'pp'); assert.equal(fd.mean, 0.5);
  assert.equal(fieldDiff(fa, { unit: '%', pts: [9, 9, 1] }).status, 'not-comparable');
});
test('09 patches: whitelist, preconditions, wall and neighbour constraints', () => {
  const m = sampleModel('B'), win = m.components.find((c) => c.name === 'South window 1');
  assert.throws(() => applyPatch(m, { op: 'wall.delete', id: 'c5' }), /not supported/);
  assert.throws(() => applyPatch(m, { op: 'window.resize', id: win.id, from: { ...win.g, w: 1 }, to: win.g }), /changed since/);
  assert.throws(() => applyPatch(m, { op: 'window.resize', id: win.id, from: win.g, to: { ...win.g, x: -1, w: 20 } }), /leave its host wall/);
  assert.throws(() => applyPatch(m, { op: 'window.resize', id: win.id, from: win.g, to: { ...win.g, w: 4.5 } }), /overlap/);
  assert.throws(() => applyPatch(m, { op: 'window.resize', id: win.id, from: win.g, to: { ...win.g, h: 3 } }), /wall height/);
  const ok = applyPatch(m, { op: 'window.resize', id: win.id, from: win.g, to: { ...win.g, x: 1.3, w: 3.6 } });
  assert.equal(ok.components.find((c) => c.id === win.id).g.w, 3.6); assert.equal(win.g.w, 3.2, 'original model untouched');
});
test('09 recommend needs a project target and a recorded basis; adopt is idempotent and atomic', () => {
  const S = (() => { const save = () => {}; return { save, clone: (x) => JSON.parse(JSON.stringify(x)), version: (p, id) => p.versions.find((v) => v.id === id), saveVersion: (p, note) => { const v = { id: 'v' + (p.versions.length + 1), n: p.versions.length + 1, note, created: 'now', model: JSON.parse(JSON.stringify(p.draft)) }; p.versions.push(v); return v; } }; })();
  const p = { id: 'p', versions: [{ id: 'v1', n: 1, note: 'A', model: sampleModel('B') }], runs: [], sharedConditions: { revision: 1, site: { lat: 49, lon: -123, north: 0, tz: 'America/Vancouver' }, defaults: { plane: 0.8 } } };
  C.initProject(p); const pts = []; for (let x = 0.25; x < 16; x += 0.5) for (let y = 0.25; y < 12; y += 0.5) pts.push(x, y, y < 3 ? 4 : 1);
  const run = { id: 'r1', simId: 'daylight', versionId: 'v1', ...C.runContract(p, 'v1', 'daylight'), results: { df: 1.6, field: { unit: '%', step: 0.5, pts } } }; p.runs.push(run);
  assert.equal(recommend(p, run, p.versions[0].model).status, 'needs-target');
  P.setParameter(p, { path: 'target.daylight.meanDF', value: 2 });
  const out = recommend(p, run, p.versions[0].model); assert.equal(out.status, 'ok'); const rec = out.recommendation;
  assert.equal(rec.evidence.runId, 'r1'); assert.equal(rec.patch.op, 'window.resize'); assert.ok(!/improve|%\s*better/i.test(rec.expected.replace('Higher', '')), 'no promised improvement');
  assert.doesNotThrow(() => applyPatch(p.versions[0].model, rec.patch));
  const before = JSON.stringify(p.versions[0]);
  const a1 = adopt(S, p, rec), a2 = adopt(S, p, rec);
  assert.equal(a2.repeated, true); assert.equal(p.plans.length, 2); assert.equal(p.versions.length, 2); assert.equal(p.runGroups.length, 1); assert.equal(JSON.stringify(p.versions[0]), before, 'A unchanged');
  assert.equal(C.revision(p, a1.revisionId).planId, a1.planId);
  const bad = { ...rec, id: 'rec-x', patch: { ...rec.patch, from: { ...rec.patch.from, w: 99 } } }, n = JSON.stringify(p);
  assert.throws(() => adopt(S, p, bad), /changed since/); assert.equal(JSON.stringify(p), n, 'a failed adoption changes nothing');
});
test('06 registry: every existing study has one primary category; targets are honest', () => {
  const r = registry(); assert.equal(r.length, SIMS.length); assert.equal(SIMS.length, 22);
  for (const e of r) { assert.ok(['building', 'interior', 'table'].includes(e.category), e.id); assert.ok(e.method && e.test, e.id); assert.ok(fs.existsSync(new URL('../' + e.test, import.meta.url)), e.test); }
  assert.deepEqual(CATEGORIES.map((c) => c.id), ['building', 'interior', 'table']);
  assert.equal(categoryOf('climate'), 'table'); assert.equal(categoryOf('daylight'), 'interior'); assert.equal(categoryOf('sunhours'), 'building');
  assert.equal(targetStatus('I05').status, 'not-connected'); assert.equal(targetStatus('B10').status, 'reference'); assert.equal(targetStatus('I02').status, 'screening', 'covered only by the browser screening, labelled as such');
  assert.match(targetStatus('I02').note, /not HB-Radiance/); assert.equal(TARGETS.length, 36);
});
test('11 PPTX opens in python-pptx with native text, table and shapes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-pptx-')), f = path.join(dir, 't.pptx');
  fs.writeFileSync(f, buildPptx({ title: 'T', footer: 'F', slides: [{ title: '采光 Daylight', blocks: [{ type: 'text', x: 1, y: 1, w: 5, h: 1, paragraphs: [{ text: '中文 & <ok>' }] }, { type: 'table', x: 1, y: 2.5, w: 6, h: 1, rows: [['a', 'b'], ['1', '2']] }, { type: 'bars', x: 8, y: 1, w: 4, h: 1, series: [{ label: 'A', value: 1 }, { label: 'B', value: NaN }] }] }] }));
  let out; try { out = execFileSync('python3', ['-c', `from pptx import Presentation\np=Presentation(${JSON.stringify(f)})\nprint('|'.join((s.text_frame.text if s.has_text_frame else ('TABLE' if s.has_table else s.name)) for sl in p.slides for s in sl.shapes))`]).toString(); }
  catch (e) { test.skip?.('python-pptx not installed'); return; }
  assert.match(out, /采光 Daylight/); assert.match(out, /中文 & <ok>/); assert.match(out, /TABLE/); assert.match(out, /missing/, 'a missing value is labelled, not drawn as zero');
});
