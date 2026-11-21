// Projects, model versions and simulation runs, kept in this browser (localStorage).
// Shape (ready to move to a backend later):
//   project { id, name, created, updated, draft (working model), versions[], runs[], site, siteLinked }
//     siteLinked (default true): the project follows the Account site, so a new address in Account reaches every
//     simulation of the project; false: the project keeps its own site (p.site)
//   version { id, n, note, created, model }            — immutable snapshot
//   run     { id, versionId, simId, settings, results { kpis: [[label, value]], <metric>: number, thumb?: jpeg data URL,
//             field?: { label, unit, step, pts: [x, y, value, …] in plan metres } }, created, source: 'full-tool' | 'batch' }
//   account { user, site, defaults }                  — site and defaults every new project and run starts from
//   project.sharedConditions { site, defaults, revision } — frozen Sun Hours/Daylight pilot conditions;
//     Account seeds them once, while other engines retain the existing siteLinked behaviour during the pilot.
//   Schema 2 (project-contract.js) adds contract, parameters, plans, planRevisions, assets and run lineage without rewriting
//     the fields above; sharedConditions stays the projection the engines read, written only through parameters.js.
import { sampleModel } from './data.js';
import * as C from './project-contract.js';
import * as P from './parameters.js';

const KEY = 'pc-mvp-v1', MODE = 'pc-mvp-store';
// Where it lives: IndexedDB is the store of record (room for sites, terrain and many versions). While the data is small a copy
// is also kept in localStorage, so every page reads it at once; when it outgrows localStorage that copy is dropped and
// MODE says 'idb', so the next start reads IndexedDB (init() below, awaited before the first page). Clearing the site's
// data clears both, as before.
const IDB_NAME = 'plotcloud', IDB_STORE = 'kv';
let idbP = null, idbOK = typeof indexedDB !== 'undefined', lastSize = 0;
const idb = () => idbP || (idbP = new Promise((res, rej) => { try { const r = indexedDB.open(IDB_NAME, 1); r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }));
const idbDo = (mode, fn) => idb().then((db) => new Promise((res, rej) => { const t = db.transaction(IDB_STORE, mode), q = fn(t.objectStore(IDB_STORE)); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }));
const idbGet = (k) => idbDo('readonly', (st) => st.get(k)), idbPut = (k, v) => idbDo('readwrite', (st) => st.put(v, k)), idbDel = (k) => idbDo('readwrite', (st) => st.delete(k));
// how much the browser lets this site keep (IndexedDB), and whether it promised not to clear it on its own
export let QUOTA = 5 * 1024 * 1024; export let PERSISTED = false;
export async function init() {
  if (DB) return DB;
  try { if (navigator.storage?.estimate) { const e = await navigator.storage.estimate(); if (e.quota) QUOTA = Math.min(e.quota, 4 * 1024 ** 3); } } catch (e) { }
  try { if (navigator.storage?.persisted) PERSISTED = await navigator.storage.persisted(); if (!PERSISTED && navigator.storage?.persist) PERSISTED = await navigator.storage.persist(); } catch (e) { }
  try { if (!localStorage.getItem(KEY) && localStorage.getItem(MODE) === 'idb') { const raw = await idbGet(KEY); if (raw) DB = JSON.parse(raw); } } catch (e) { idbOK = false; }
  const D = load(); try { await resolveMeshes(D); } catch (e) { } setTimeout(sweepMeshes, 8000);   // imported meshes back in every model before the first page
  return D;
}
const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const clone = (x) => JSON.parse(JSON.stringify(x));
let DB = null, memoryOnly = false;

// The sample site. Real sites come from address search and live data on the Account page.
export const SAMPLE_SITE = { label: 'Vancouver, British Columbia, Canada', lat: 49.2827, lon: -123.1207, north: 0, tz: 'America/Vancouver',
  elev: 12, rain: 1189, wind: 3.6, windDir: 'E', koppen: 'Csb · warm-summer Mediterranean', buildings: 214, year: 2024, sample: true };
export const DEFAULTS = { units: 'Metric', grid: 'Auto', radius: 250, plane: 0.8, occStart: 8, occEnd: 18, period: 'Equinox', rain: 50, duration: 60, band: '500 Hz', eye: 1.2, code: 'NBC 2020' };

function seed() {
  const p = { id: 'demo-courtyard', name: 'Courtyard studio (sample)', created: now(), updated: now(), versions: [], runs: [], sample: true, site: clone(SAMPLE_SITE) };
  const add = (model, note) => { const v = { id: uid('v'), n: p.versions.length + 1, note, created: now(), model }; p.versions.push(v); return v; };
  add(sampleModel('A'), 'Baseline massing and glazing');
  const v2 = add(sampleModel('B'), 'Larger south windows, overhang, acoustic ceiling');
  p.draft = clone(v2.model);
  p.sharedConditions={schema:1,revision:1,updated:now(),site:clone(SAMPLE_SITE),defaults:clone(DEFAULTS)};
  C.initProject(p, { fromSample: true });
  return { projects: [p], account: { user: null, site: clone(SAMPLE_SITE), defaults: { ...DEFAULTS } } };
}

let checked = null;
export function load() {
  if (DB && checked === DB) return DB;
  let fresh = false; if (!DB) { try { const raw = localStorage.getItem(KEY); fresh = !raw; DB = raw ? JSON.parse(raw) : seed(); if (raw && resolveSync(DB).length) resolveMeshes(DB).catch(() => { }); } catch (e) { DB = seed(); memoryOnly = true; } }
  checked = DB;
  // Before the first schema-2 migration, keep the untouched data as a v1 backup in IndexedDB (preMigrationBackup below).
  if (!fresh && DB.projects?.some((p) => !(p.contract?.schema >= C.SCHEMA))) keepPreMigration(DB);
  if (!DB.account) DB.account = { user: null, site: clone(SAMPLE_SITE), defaults: { ...DEFAULTS } };
  let migrated=false;
  for (const p of DB.projects) {
    if (!p.site) p.site = clone(DB.account.site); if (p.siteLinked == null) p.siteLinked = true;
    // Pilot: freeze the currently effective conditions, without changing legacy engines or past runs.
    if(!p.sharedConditions){p.sharedConditions={schema:1,revision:1,updated:now(),site:clone(p.siteLinked===false?p.site:DB.account.site),defaults:clone(DB.account.defaults)};migrated=true;}
    if (C.migrateProject(p)) migrated = true;
  }
  // estimates from the old prototype preview are retired: every result now comes from a SimuSite engine
  for (const p of DB.projects) p.runs = p.runs.filter((r) => r.source !== 'prototype-mock');
  if (fresh||migrated) save();   // every page and batch frame sees the same frozen project defaults
  return DB;
}
// A result keeps a small picture (thumb) and its per-point values (field) for Results; when the browser runs out of room,
// pictures and fields of older results go first, so the figures themselves are always kept.
function pruneMedia(keep = 0) {
  const all = DB.projects.flatMap((p) => p.runs).filter((r) => r.results && (r.results.thumb || r.results.field)).sort((a, b) => a.created.localeCompare(b.created));
  const n = Math.max(1, Math.ceil((all.length - keep) / 2)); for (const r of all.slice(0, n)) { delete r.results.thumb; delete r.results.field; r.results.mediaDropped = true; } return n > 0 && all.length > 0;
}
// after every save (the cloud sync in cloud.js listens, to send changes when someone is signed in)
const saveHooks = [];
export const onSave = (fn) => { saveHooks.push(fn); };
const saved = (ok) => { for (const f of saveHooks) try { f(); } catch (e) { } return ok; };
// ---- imported meshes kept apart (Large files 5, 2026-11-19). A model's meshes ({ id: [x, y, z, …] }, the draft's and every
// version's) can hold millions of numbers; written into the store's text on every save they made each save take about half a
// second at 500,000 triangles. Each mesh is now kept once in its own IndexedDB record (keyed by its content, so a version that
// copies the draft shares it) and the store's text holds only { $m: key } for it. In memory every model keeps its arrays as before,
// so nothing that reads meshes changes. A mesh is written inline until its own record is confirmed stored, so a closed tab never
// leaves a reference to a mesh that is not there. Without IndexedDB everything stays inline, as before.
const MESH_DB = 'plotcloud-mesh', MESH_ST = 'm', MESH_MIN = 900;   // smaller meshes (under 100 triangles) stay in the text
let mdbP = null; const MKEY = new WeakMap(), MCACHE = new Map(), STORED = new Set(), PENDING = new Set(); let meshBytes = 0, refill = 0;
const mdb = () => mdbP || (mdbP = new Promise((res, rej) => { try { const r = indexedDB.open(MESH_DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(MESH_ST); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }));
const mdo = (mode, fn) => mdb().then((db) => new Promise((res, rej) => { const t = db.transaction(MESH_ST, mode), q = fn(t.objectStore(MESH_ST)); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }));
const isMesh = (a) => (Array.isArray(a) || ArrayBuffer.isView(a)) && a.length >= MESH_MIN;
const isRef = (a) => a && typeof a === 'object' && !Array.isArray(a) && typeof a.$m === 'string';
// the content key: length and two 32-bit hashes of the numbers' bytes (computed once per array)
function meshKey(a) { let k = MKEY.get(a); if (k) return k; const f = a instanceof Float64Array ? a : Float64Array.from(a), u = new Uint32Array(f.buffer, f.byteOffset, f.length * 2); let h1 = 2166136261, h2 = 5381;
  for (let i = 0; i < u.length; i++) { const v = u[i]; h1 = Math.imul(h1 ^ v, 16777619); h2 = (Math.imul(h2, 33) + v) | 0; }
  k = 'm' + a.length.toString(36) + '-' + (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36); MKEY.set(a, k); if (!MCACHE.has(k)) MCACHE.set(k, a); return k; }
const modelsOf = (D) => (D.projects || []).flatMap((p) => [p.draft, ...(p.versions || []).map((v) => v.model)]).filter((m) => m && m.meshes && typeof m.meshes === 'object');
// new meshes are written together, a second after the last save that found one (an import saves several times on its way, with
// in-between arrays), and only those a model still holds; one transaction for all of them
const QUEUE = new Set(); let flushT = 0, flushBy = 0;
function persistMesh(k) { if (PENDING.has(k) || STORED.has(k)) return; QUEUE.add(k); const now = Date.now(); if (!flushBy) flushBy = now + 5000;
  clearTimeout(flushT); flushT = setTimeout(flushMeshes, Math.max(0, Math.min(1000, flushBy - now))); }
function flushMeshes() { flushBy = 0; if (!DB) return; const live = new Map();
  for (const m of modelsOf(DB)) for (const a of Object.values(m.meshes)) if (isMesh(a)) live.set(meshKey(a), a);
  for (const k of MCACHE.keys()) if (!live.has(k)) MCACHE.delete(k);   // arrays no model holds any more are let go
  const todo = [...QUEUE].filter((k) => live.has(k) && !STORED.has(k) && !PENDING.has(k)); QUEUE.clear(); if (!todo.length) return; todo.forEach((k) => PENDING.add(k)); const t = Date.now();
  mdo('readwrite', (st) => { for (const k of todo) { const a = live.get(k); st.put({ a: a instanceof Float64Array ? a : Float64Array.from(a), t }, k); } return null; })
    .then(() => { todo.forEach((k) => { STORED.add(k); PENDING.delete(k); }); clearTimeout(refill); refill = setTimeout(() => saveRaw(), 50); },   // write the store again, now with the references
      () => { todo.forEach((k) => PENDING.delete(k)); }); }
// the store's text with every stored mesh as a reference; the models in memory keep their arrays
function storeText() {
  const swaps = [], seen = new Set(); let bytes = 0;
  if (idbOK && typeof indexedDB !== 'undefined') for (const m of modelsOf(DB)) { let out = null;
    for (const [id, a] of Object.entries(m.meshes)) { let k = null;
      if (isRef(a)) k = a.$m; else if (isMesh(a)) { k = meshKey(a); if (!STORED.has(k)) { persistMesh(k); k = null; } }
      if (k) { (out ||= { ...m.meshes })[id] = { $m: k }; if (!seen.has(k)) { seen.add(k); bytes += (MCACHE.get(k)?.length || 0) * 8; } } }
    if (out) { swaps.push([m, m.meshes]); m.meshes = out; } }
  try { return { txt: JSON.stringify(DB), bytes }; } finally { for (const [m, keep] of swaps) m.meshes = keep; }
}
// references back to arrays: from this page's memory at once, else (first open, another tab's import) from IndexedDB
function resolveSync(D) { const miss = []; for (const m of modelsOf(D)) for (const [id, a] of Object.entries(m.meshes)) if (isRef(a)) { const c = MCACHE.get(a.$m); if (c) m.meshes[id] = c; else miss.push([m, id, a.$m]); } return miss; }
async function resolveMeshes(D) {
  const miss = resolveSync(D); if (!miss.length) return 0; let lost = 0;
  const got = await mdo('readonly', (st) => { const out = new Map(); for (const k of new Set(miss.map((x) => x[2]))) { const q = st.get(k); q.onsuccess = () => out.set(k, q.result); } return { get result() { return out; } }; }).catch(() => new Map());
  for (const [m, id, k] of miss) { if (!isRef(m.meshes[id])) continue; const r = got.get(k);
    if (r && r.a) { let a = MCACHE.get(k); if (!a) { a = Array.from(r.a); MKEY.set(a, k); MCACHE.set(k, a); } STORED.add(k); m.meshes[id] = a; }
    else { delete m.meshes[id]; lost++; } }   // its record is gone (site data partly cleared): the piece shows as its box, as a mesh-less import does
  if (lost) console.warn(`SimuSite: ${lost} imported mesh record(s) were missing from this browser's storage.`);
  return miss.length; }
// records no model refers to any more (deleted imports, projects), kept a day in case another open tab still writes them
async function sweepMeshes() { try { const live = new Set(); for (const m of modelsOf(DB)) for (const a of Object.values(m.meshes)) { if (isRef(a)) live.add(a.$m); else if (isMesh(a)) { const k = MKEY.get(a); if (k) live.add(k); } }
  const old = Date.now() - 864e5; await mdo('readwrite', (st) => { const q = st.openCursor(); q.onsuccess = () => { const c = q.result; if (!c) return; if (!live.has(c.key) && !(c.value?.t > old)) { c.delete(); STORED.delete(c.key); MCACHE.delete(c.key); } c.continue(); }; return null; }); } catch (e) { } }
export const meshStore = { resolve: () => DB && resolveMeshes(DB), stored: () => STORED.size, has: (a) => STORED.has(meshKey(a)), info: () => ({ cache: MCACHE.size, stored: STORED.size, pending: PENDING.size, bytes: meshBytes, text: lastSize }), keyOf: meshKey, sweep: sweepMeshes };   // tests

export function save() { return saved(saveRaw()); }
function saveRaw() {
  if (memoryOnly) return false;
  const { txt, bytes } = storeText(); lastSize = txt.length; meshBytes = bytes;
  if (idbOK) idbPut(KEY, txt).catch(() => { idbOK = false; });
  try { localStorage.setItem(KEY, txt); localStorage.setItem(MODE, 'mirror'); return true; }
  catch (e) {
    if (e && e.name === 'SecurityError') { memoryOnly = true; return false; }
    if (idbOK) { try { localStorage.removeItem(KEY); localStorage.setItem(MODE, 'idb'); } catch (er) { } return true; }   // too big for the copy: IndexedDB keeps it
    // no IndexedDB: as before, older results lose their pictures first so the figures are kept
    for (let i = 0; i < 6; i++) { if (!pruneMedia(4)) break; try { localStorage.setItem(KEY, JSON.stringify(DB)); return true; } catch (er) { } }
    memoryOnly = true; return false;
  }
}
// read the store again (another page of this site, e.g. a batch run, may have written to it)
export function reload() { const keep = DB; DB = null; try { if (!localStorage.getItem(KEY) && localStorage.getItem(MODE) === 'idb') DB = keep; } catch (e) { } return load(); }
export const persistent = () => !memoryOnly;
export function reset() { DB = seed(); save(); }
// a project as it came from the cloud: replaced in place (pages that hold the object keep seeing it), or added
export function putProject(fresh) { const P = load().projects, old = P.find((x) => x.id === fresh.id); C.migrateProject(fresh);   // a copy from a device on older code
  if (old) { for (const k of Object.keys(old)) delete old[k]; Object.assign(old, fresh); } else P.unshift(fresh); save(); return old || fresh; }
export function dropProject(id) { load().projects = load().projects.filter((x) => x.id !== id); save(); }

export const account = () => load().account;
export const projects = () => load().projects;
export const project = (id) => projects().find((p) => p.id === id);
// the site a project's simulations use: the Account site while the project follows it, else the project's own
export const siteOf = (p) => (p && p.siteLinked === false ? p.site : account().site) || account().site;
export function linkSite(p, on) { if (!on) p.site = clone(account().site); p.siteLinked = !!on; p.updated = now(); save(); }
export function createProject(name, model) {
  const p = { id: uid('p'), name: name || 'Untitled project', created: now(), updated: now(), versions: [], runs: [], draft: model, site: clone(account().site), siteLinked: true, sharedConditions:{schema:1,revision:1,updated:now(),site:clone(account().site),defaults:clone(account().defaults)} };
  C.initProject(p, { fromSample: !!account().site?.sample });   // Account values are copied once; later Account edits never reach this project
  load().projects.unshift(p); save(); return p;
}
export function saveVersion(p, note) {
  const v = { id: uid('v'), n: p.versions.length + 1, note: note || `Version ${p.versions.length + 1}`, created: now(), model: clone(p.draft) };
  p.versions.push(v); p.updated = now(); save(); return v;
}
export function addRun(p, versionId, simId, settings, results, source = 'full-tool') {
  const handoff=[...(p.handoffs||[])].reverse().find(h=>h.versionId===versionId&&h.study===simId&&h.baselineSignature===JSON.stringify({site:conditionsOf(p).site,defaults:conditionsOf(p).defaults}));
  settings={...settings,...(p.activeStudyConfiguration?.[simId]?{configurationName:p.activeStudyConfiguration[simId]}:{}),...(handoff?{handoff:clone(handoff)}:{})};
  const r = { id: uid('r'), versionId, simId, settings: clone(settings), results, created: now(), source };
  // lineage: the frozen PlanRevision, the effective inputs this study subscribes to, and the recipe identity
  try { Object.assign(r, C.runContract(p, versionId, simId, settings)); } catch (e) { r.contractError = e.message; }
  if (results && (results.thumb || results.field)) for (const o of p.runs) if (o.versionId === versionId && o.simId === simId && o.results) { delete o.results.thumb; delete o.results.field; }   // only the newest result of a version keeps its picture
  p.runs.push(r); C.refreshAssets(p); p.updated = now(); save(); return r;
}
export function deleteRun(p, id) { p.runs = p.runs.filter((r) => r.id !== id); save(); }
export const isSharedPilot = id => ['sunhours','radiation','utci','daylight','climate','passive','skyview','shadebenefit','solarenvelope'].includes(id);
export const conditionsOf = p => p.sharedConditions;
export function conditionsSignature(p,id){
  const c=conditionsOf(p),s=c.site,d=c.defaults;
  if(['climate','passive','shadebenefit'].includes(id))return JSON.stringify({lat:s.lat,lon:s.lon,north:id==='shadebenefit'?(s.north||0):undefined,climate:s.climate?.hash});
  if(id==='skyview')return JSON.stringify({lat:s.lat,lon:s.lon,north:s.north||0,tz:s.tz});
  if(id==='solarenvelope')return JSON.stringify({lat:s.lat,lon:s.lon,north:s.north||0,tz:s.tz});
  return JSON.stringify({lat:s.lat,lon:s.lon,north:s.north??0,tz:s.tz,...(id==='sunhours'?{period:d.period}:id==='radiation'?{climate:s.climate?.hash}:id==='utci'?{terrain:s.terrain||'suburban',climate:s.climate?.hash}:id==='vent'?{terrain:s.terrain||'suburban',shelter:s.shelter||'semi',climate:s.climate?.hash}:{plane:d.plane,occStart:d.occStart,occEnd:d.occEnd,climate:s.climate?.hash})});
}
// Every change to the project's conditions is recorded as parameter records (parameters.js) with its provenance.
// keepRevision: the first setup of a brand-new project (no result can depend on the earlier values yet).
export function updateConditions(p,site,defaults,{keepRevision=false,...provenance}={}){
  const c=conditionsOf(p),next={schema:1,revision:c.revision+(keepRevision?0:1),updated:now(),site:clone(site),defaults:clone(defaults)};
  P.recordConditionsChange(p,c,next,provenance);p.sharedConditions=next;C.refreshAssets(p);p.updated=now();save();return p.sharedConditions;
}
// Cancel an unsaved edit: the earlier conditions come back, recorded as a revert (not as new user input).
export function revertConditions(p,snapshot){
  P.recordConditionsChange(p,conditionsOf(p),snapshot,{event:'revert',acquisition:'rollback'});p.sharedConditions=clone(snapshot);C.refreshAssets(p);save();return p.sharedConditions;
}
// One entry point for a single value (parameter page, Workbench, later item 05 overrides). Returns the resolved value.
export function setProjectParameter(p,query,opts={}){
  const before=clone(conditionsOf(p));P.setParameter(p,{...query,mode:opts.mode??p.contract?.uiMode??null,...opts});return commitParameters(p,before,query);
}
export function restoreProjectDefault(p,query){
  const before=clone(conditionsOf(p));P.restoreDefault(p,query);return commitParameters(p,before,query);
}
function commitParameters(p,before,query){
  P.syncMirror(p);const c=conditionsOf(p);if(JSON.stringify({s:before.site,d:before.defaults})!==JSON.stringify({s:c.site,d:c.defaults})){c.revision=before.revision+1;c.updated=now();}
  C.refreshAssets(p);p.updated=now();save();return P.resolve(p,query);
}
// Rolling back makes a new version and a new PlanRevision; later history is kept.
export function rollbackPlan(p,revisionId){
  const rev=C.revision(p,revisionId);if(!rev)throw Error('That plan revision is not in this project.');
  const v=version(p,rev.versionId);if(!v)throw Error('The version of that revision is missing.');
  if(rev.conditions&&rev.conditions!==C.UNRECORDED){const cur=conditionsOf(p),next={...clone(cur),revision:cur.revision+1,updated:now(),site:clone(rev.conditions.site),defaults:clone(rev.conditions.defaults)};P.recordConditionsChange(p,cur,next,{event:'rollback',acquisition:'rollback'});p.sharedConditions=next;}
  p.draft=clone(v.model);const nv=saveVersion(p,`Restored from ${C.currentPlan(p).name}${rev.n} (v${v.n})`);
  const fresh=C.freezePlan(p,nv.id,{restoredFrom:rev.id});C.refreshAssets(p);save();return fresh;
}
export function runConditionsStatus(p,r){
  const latest=p.versions.at(-1);if(latest&&r.versionId!==latest.id)return 'Based on v'+(version(p,r.versionId)?.n??'?')+' · model is now v'+latest.n+' · review or rerun';
  if(r.settings?.handoff&&r.settings.handoff.baselineSignature!==JSON.stringify({site:conditionsOf(p).site,defaults:conditionsOf(p).defaults}))return 'Workbench baseline changed · rerun required';
  if(r.simId==='structure'&&!r.settings?.structuralStudy?.source?.versionId)return 'Legacy structural grid result · building mapping unverified';
  if(!isSharedPilot(r.simId)&&r.simId!=='vent')return '';
  const used=r.settings?.sharedConditions;
  return !used?'Legacy result · verify conditions':used.signature!==conditionsSignature(p,r.simId)?'Shared conditions changed · rerun required':'';
}
// ---- the user's side (Dashboard, Account): managing projects, backups, how much room is left
export function renameProject(p, name) { p.name = String(name || '').trim() || p.name; p.updated = now(); save(); }
export function duplicateProject(p) {
  const q = clone(p); Object.assign(q, { id: uid('p'), name: `${p.name.replace(/ \(sample\)$/, '')} copy`, sample: false, archived: false, created: now(), updated: now() }); delete q.batch;
  if (p.caseStudy || p.sample) { q.copyOf = p.id; delete q.trySig; }   // a copy of an example is your own project (2026-11-17)
  load().projects.unshift(q); save(); return q;
}
export function archiveProject(p, on) { p.archived = !!on; p.updated = now(); save(); }
export function deleteProject(p) { load().projects = load().projects.filter((x) => x !== p); save(); }
export const dirtyDraft = (p) => !p.versions.length || JSON.stringify(p.versions.at(-1).model) !== JSON.stringify(p.draft);
// bytes this prototype keeps in the browser (localStorage holds about 5 MB per site in most browsers)
export function storageUse() { return lastSize ? lastSize + meshBytes : JSON.stringify(load()).length; }   // the store's text and the imported meshes kept apart
export const storageMode = () => { try { return localStorage.getItem(MODE) === 'idb' ? 'idb' : 'mirror'; } catch (e) { return 'mirror'; } };
// pictures and per-point fields of results that are not on a project's latest version (their figures stay)
export function pruneOldMedia() {
  let n = 0; for (const p of load().projects) { const last = p.versions.at(-1)?.id; for (const r of p.runs) if (r.versionId !== last && r.results && (r.results.thumb || r.results.field)) { delete r.results.thumb; delete r.results.field; r.results.mediaDropped = true; n++; } }
  save(); return n;
}
// ---- the data as it was before schema 2, kept once in IndexedDB as a v1 backup file (rollback path)
const PRE = KEY + ':before-schema-2';
function keepPreMigration(D) {
  if (!idbOK) { D.migrationBackup = 'unavailable: IndexedDB is not available in this browser'; return; }
  const text = JSON.stringify({ format: 'plotcloud-backup', v: 1, exported: now(), reason: 'automatic copy before SimuSite data schema 2', account: D.account, projects: D.projects });
  D.migrationBackup = PRE; idbGet(PRE).then((had) => had || idbPut(PRE, text)).catch(() => { });
}
export const preMigrationBackup = () => (idbOK ? idbGet(PRE).catch(() => null) : Promise.resolve(null));
export function exportAll() { const D = load(); D.account.lastBackup = now(); save(); return JSON.stringify({ format: 'plotcloud-backup', v: 1, exported: now(), account: D.account, projects: D.projects }, null, 1); }
// a backup file back in: 'merge' adds its projects (a project already here with the same id is replaced), 'replace' takes the whole file
export function importAll(text, mode = 'merge') {
  let o; try { o = JSON.parse(text); } catch (e) { throw new Error('This is not a SimuSite backup (not JSON).'); }
  if (o?.format !== 'plotcloud-backup' || !Array.isArray(o.projects)) throw new Error('This is not a SimuSite backup file.');
  for (const p of o.projects) if (!p.id || !Array.isArray(p.versions) || !Array.isArray(p.runs)) throw new Error('A project in this file is incomplete.');
  const D = load();
  if (mode === 'replace') { DB = { projects: o.projects, account: { ...o.account, user: D.account.user } }; }
  else { for (const p of o.projects) { D.projects = D.projects.filter((x) => x.id !== p.id); D.projects.unshift(p); } }
  save(); reload(); return o.projects.length;
}
// complete backups (project-backup.js) after every check passed
export function addRestored(p, replace = false) { const D = load(); if (replace) D.projects = D.projects.filter((x) => x.id !== p.id); else if (D.projects.some((x) => x.id === p.id)) throw new Error('A project with this ID is already here.'); C.migrateProject(p); D.projects.unshift(p); save(); return p; }
export function replaceAll(projects, acct) { const D = load(); DB = { projects, account: { ...(acct || D.account), user: D.account.user } }; save(); reload(); }
export function deleteAccount() { idbDel(KEY).catch(() => { }); try { localStorage.removeItem(KEY); localStorage.removeItem(MODE); for (const k of Object.keys(localStorage)) if (k.startsWith('pc-mvp') || k.startsWith('pc-psim') || k.startsWith('pc-sim')) localStorage.removeItem(k); indexedDB.deleteDatabase('pc-project-climate'); } catch (e) { } DB = null; }
// where the person last was (Workspace, a simulation, Results), for "pick up where you left off"
const RKEY = 'pc-mvp-recent';
export function recent() { try { return JSON.parse(localStorage.getItem(RKEY) || '{}'); } catch (e) { return {}; } }
export function touchRecent(kind, data) { try { const r = recent(); r[kind] = { ...data, at: now() }; localStorage.setItem(RKEY, JSON.stringify(r)); } catch (e) { } }
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
