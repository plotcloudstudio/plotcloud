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
import { sampleModel } from './data.js';

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
  return load();
}
const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const clone = (x) => JSON.parse(JSON.stringify(x));
let DB = null, memoryOnly = false;

// The sample site. Real sites come from address search and live data on the Account page.
export const SAMPLE_SITE = { label: 'Vancouver, British Columbia, Canada', lat: 49.2827, lon: -123.1207, north: 0, tz: 'America/Vancouver',
  elev: 12, rain: 1189, wind: 3.6, windDir: 'E', koppen: 'Csb · warm-summer Mediterranean', buildings: 214, year: 2024, sample: true };
export const DEFAULTS = { units: 'Metric', radius: 250, plane: 0.8, occStart: 8, occEnd: 18, period: 'Equinox', rain: 50, duration: 60, band: '500 Hz', eye: 1.2, code: 'NBC 2020' };

function seed() {
  const p = { id: 'demo-courtyard', name: 'Courtyard studio (sample)', created: now(), updated: now(), versions: [], runs: [], sample: true, site: clone(SAMPLE_SITE) };
  const add = (model, note) => { const v = { id: uid('v'), n: p.versions.length + 1, note, created: now(), model }; p.versions.push(v); return v; };
  add(sampleModel('A'), 'Baseline massing and glazing');
  const v2 = add(sampleModel('B'), 'Larger south windows, overhang, acoustic ceiling');
  p.draft = clone(v2.model);
  p.sharedConditions={schema:1,revision:1,updated:now(),site:clone(SAMPLE_SITE),defaults:clone(DEFAULTS)};
  return { projects: [p], account: { user: null, site: clone(SAMPLE_SITE), defaults: { ...DEFAULTS } } };
}

let checked = null;
export function load() {
  if (DB && checked === DB) return DB;
  let fresh = false; if (!DB) { try { const raw = localStorage.getItem(KEY); fresh = !raw; DB = raw ? JSON.parse(raw) : seed(); } catch (e) { DB = seed(); memoryOnly = true; } }
  checked = DB;
  if (!DB.account) DB.account = { user: null, site: clone(SAMPLE_SITE), defaults: { ...DEFAULTS } };
  let migrated=false;
  for (const p of DB.projects) {
    if (!p.site) p.site = clone(DB.account.site); if (p.siteLinked == null) p.siteLinked = true;
    // Pilot: freeze the currently effective conditions, without changing legacy engines or past runs.
    if(!p.sharedConditions){p.sharedConditions={schema:1,revision:1,updated:now(),site:clone(p.siteLinked===false?p.site:DB.account.site),defaults:clone(DB.account.defaults)};migrated=true;}
  }
  // estimates from the old prototype preview are retired: every result now comes from a PlotCloud engine
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
export function save() { return saved(saveRaw()); }
function saveRaw() {
  if (memoryOnly) return false;
  const txt = JSON.stringify(DB); lastSize = txt.length;
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
export function putProject(fresh) { const P = load().projects, old = P.find((x) => x.id === fresh.id);
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
  load().projects.unshift(p); save(); return p;
}
export function saveVersion(p, note) {
  const v = { id: uid('v'), n: p.versions.length + 1, note: note || `Version ${p.versions.length + 1}`, created: now(), model: clone(p.draft) };
  p.versions.push(v); p.updated = now(); save(); return v;
}
export function addRun(p, versionId, simId, settings, results, source = 'full-tool') {
  const r = { id: uid('r'), versionId, simId, settings: clone(settings), results, created: now(), source };
  if (results && (results.thumb || results.field)) for (const o of p.runs) if (o.versionId === versionId && o.simId === simId && o.results) { delete o.results.thumb; delete o.results.field; }   // only the newest result of a version keeps its picture
  p.runs.push(r); p.updated = now(); save(); return r;
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
export function updateConditions(p,site,defaults){
  const c=conditionsOf(p);p.sharedConditions={schema:1,revision:c.revision+1,updated:now(),site:clone(site),defaults:clone(defaults)};p.updated=now();save();return p.sharedConditions;
}
export function runConditionsStatus(p,r){
  if(r.simId==='structure'&&!r.settings?.structuralStudy?.source?.versionId)return 'Legacy structural grid result · building mapping unverified';
  if(!isSharedPilot(r.simId)&&r.simId!=='vent')return '';
  const used=r.settings?.sharedConditions;
  return !used?'Legacy result · verify conditions':used.signature!==conditionsSignature(p,r.simId)?'Shared conditions changed · rerun required':'';
}
// ---- the user's side (Dashboard, Account): managing projects, backups, how much room is left
export function renameProject(p, name) { p.name = String(name || '').trim() || p.name; p.updated = now(); save(); }
export function duplicateProject(p) {
  const q = clone(p); Object.assign(q, { id: uid('p'), name: `${p.name.replace(/ \(sample\)$/, '')} copy`, sample: false, archived: false, created: now(), updated: now() }); delete q.batch;
  load().projects.unshift(q); save(); return q;
}
export function archiveProject(p, on) { p.archived = !!on; p.updated = now(); save(); }
export function deleteProject(p) { load().projects = load().projects.filter((x) => x !== p); save(); }
export const dirtyDraft = (p) => !p.versions.length || JSON.stringify(p.versions.at(-1).model) !== JSON.stringify(p.draft);
// bytes this prototype keeps in the browser (localStorage holds about 5 MB per site in most browsers)
export function storageUse() { return lastSize || JSON.stringify(load()).length; }
export const storageMode = () => { try { return localStorage.getItem(MODE) === 'idb' ? 'idb' : 'mirror'; } catch (e) { return 'mirror'; } };
// pictures and per-point fields of results that are not on a project's latest version (their figures stay)
export function pruneOldMedia() {
  let n = 0; for (const p of load().projects) { const last = p.versions.at(-1)?.id; for (const r of p.runs) if (r.versionId !== last && r.results && (r.results.thumb || r.results.field)) { delete r.results.thumb; delete r.results.field; r.results.mediaDropped = true; n++; } }
  save(); return n;
}
export function exportAll() { const D = load(); D.account.lastBackup = now(); save(); return JSON.stringify({ format: 'plotcloud-backup', v: 1, exported: now(), account: D.account, projects: D.projects }, null, 1); }
// a backup file back in: 'merge' adds its projects (a project already here with the same id is replaced), 'replace' takes the whole file
export function importAll(text, mode = 'merge') {
  let o; try { o = JSON.parse(text); } catch (e) { throw new Error('This is not a PlotCloud backup (not JSON).'); }
  if (o?.format !== 'plotcloud-backup' || !Array.isArray(o.projects)) throw new Error('This is not a PlotCloud backup file.');
  for (const p of o.projects) if (!p.id || !Array.isArray(p.versions) || !Array.isArray(p.runs)) throw new Error('A project in this file is incomplete.');
  const D = load();
  if (mode === 'replace') { DB = { projects: o.projects, account: { ...o.account, user: D.account.user } }; }
  else { for (const p of o.projects) { D.projects = D.projects.filter((x) => x.id !== p.id); D.projects.unshift(p); } }
  save(); reload(); return o.projects.length;
}
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
