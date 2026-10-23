// Projects, model versions and simulation runs, kept in this browser (localStorage).
// Shape (ready to move to a backend later):
//   project { id, name, created, updated, draft (working model), versions[], runs[] }
//   version { id, n, note, created, model }            — immutable snapshot
//   run     { id, versionId, simId, settings, results, created, source: 'prototype-mock' | 'full-tool' }
import { sampleModel } from './data.js';
import { run as mockRun } from './mocksim.js';

const KEY = 'pc-mvp-v1';
const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const clone = (x) => JSON.parse(JSON.stringify(x));
let DB = null, memoryOnly = false;

function seed() {
  const p = { id: 'demo-courtyard', name: 'Courtyard studio (sample)', created: now(), updated: now(), versions: [], runs: [], sample: true };
  const add = (model, note) => { const v = { id: uid('v'), n: p.versions.length + 1, note, created: now(), model }; p.versions.push(v); return v; };
  const v1 = add(sampleModel('A'), 'Baseline massing and glazing');
  const v2 = add(sampleModel('B'), 'Larger south windows, overhang, acoustic ceiling');
  for (const v of [v1, v2]) for (const [simId, settings] of [['daylight', { city: 'Vancouver', plane: 0.8 }], ['acoustics', { room: 'c15', band: '500 Hz' }], ['sunhours', { city: 'Vancouver', period: 'Equinox' }]])
    p.runs.push({ id: uid('r'), versionId: v.id, simId, settings, results: mockRun(simId, v.model, settings), created: now(), source: 'prototype-mock' });
  p.draft = clone(v2.model);
  return { projects: [p] };
}

export function load() {
  if (DB) return DB;
  try { const raw = localStorage.getItem(KEY); DB = raw ? JSON.parse(raw) : seed(); } catch (e) { DB = seed(); memoryOnly = true; }
  return DB;
}
export function save() { if (memoryOnly) return false; try { localStorage.setItem(KEY, JSON.stringify(DB)); return true; } catch (e) { memoryOnly = true; return false; } }
export const persistent = () => !memoryOnly;
export function reset() { DB = seed(); save(); }

export const projects = () => load().projects;
export const project = (id) => projects().find((p) => p.id === id);
export function createProject(name, model) {
  const p = { id: uid('p'), name: name || 'Untitled project', created: now(), updated: now(), versions: [], runs: [], draft: model };
  load().projects.unshift(p); save(); return p;
}
export function saveVersion(p, note) {
  const v = { id: uid('v'), n: p.versions.length + 1, note: note || `Version ${p.versions.length + 1}`, created: now(), model: clone(p.draft) };
  p.versions.push(v); p.updated = now(); save(); return v;
}
export function addRun(p, versionId, simId, settings, results, source = 'prototype-mock') {
  const r = { id: uid('r'), versionId, simId, settings: clone(settings), results, created: now(), source };
  p.runs.push(r); p.updated = now(); save(); return r;
}
export function deleteRun(p, id) { p.runs = p.runs.filter((r) => r.id !== id); save(); }
export const version = (p, id) => p.versions.find((v) => v.id === id);
export function lastRun(p, versionId, simId) { return p.runs.filter((r) => r.versionId === versionId && r.simId === simId).sort((a, b) => b.created.localeCompare(a.created))[0]; }

// What changed between two model versions, by component id.
export function diffModels(a, b) {
  const A = new Map(a.components.map((c) => [c.id, c])), B = new Map(b.components.map((c) => [c.id, c]));
  const added = [], removed = [], changed = [];
  for (const [id, c] of B) { const o = A.get(id); if (!o) added.push(c); else if (JSON.stringify(o.g) !== JSON.stringify(c.g) || o.mat !== c.mat || o.layer !== c.layer || JSON.stringify(o.room) !== JSON.stringify(c.room)) changed.push(c); }
  for (const [id, c] of A) if (!B.has(id)) removed.push(c);
  return { added, removed, changed };
}
export { uid, clone };
