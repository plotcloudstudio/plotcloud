// Complete project backup and restore (replan item 04, AC29). One JSON file carries projects with their versions (models),
// plans, plan revisions, parameter records, runs, lineage and the EPW files they reference — the file contents, not only a
// name or a hash that is meaningless in another browser. Restore checks the whole file first and changes nothing if any check
// fails: format and schema, an integrity hash over the file, every asset's SHA-256, referential integrity of each project,
// every weather reference being either included or listed as missing, and project ID conflicts with this browser.
//   { format:'plotcloud-backup', v:2, schema, exported, account, projects[], assets[{hash,kind,name,data,record}],
//     missingAssets[{hash,kind,name,reason,projects}], completeness, integrity{algorithm,hash} }
// Version-1 files (projects only) still restore through store.importAll.
import * as S from './store.js';
import * as C from './project-contract.js';
import { climateFile, putClimateRecord } from './project-climate.js';
import { sha256, hashOf } from './contract-hash.js';

export const FORMAT = 'plotcloud-backup', VERSION = 2;
const now = () => new Date().toISOString();
const bodyHash = (o) => { const { integrity, ...rest } = o; return hashOf(rest); };

export async function buildBackup({ projectIds = null } = {}) {
  const D = S.load(), chosen = projectIds ? D.projects.filter((p) => projectIds.includes(p.id)) : D.projects;
  for (const p of chosen) C.refreshAssets(p);
  const projects = chosen.map((p) => S.clone(p)), assets = [], missingAssets = [];
  for (const p of projects) for (const a of p.assets || []) {
    const had = assets.find((x) => x.hash === a.hash) || missingAssets.find((x) => x.hash === a.hash);
    if (had) { if (had.projects && !had.projects.includes(p.id)) had.projects.push(p.id); continue; }
    let rec = null; try { rec = await climateFile(a.hash); } catch (e) { }
    if (rec && typeof rec.text === 'string' && sha256(rec.text) === a.hash) { const { text, ...record } = rec; assets.push({ hash: a.hash, kind: a.kind, name: rec.name || a.name, encoding: 'utf-8', size: text.length, data: text, record, license: a.license, redistributable: a.redistributable }); }
    else missingAssets.push({ hash: a.hash, kind: a.kind, name: a.name, station: a.station, reason: rec ? 'The stored file no longer matches its hash.' : 'The file is not stored in this browser (for example a result made on another device).', source: a.source, projects: [p.id] });
  }
  const exported = now();
  if (!projectIds) { D.account.lastBackup = exported; S.save(); }
  const out = { format: FORMAT, v: VERSION, schema: C.SCHEMA, exported, account: projectIds ? null : S.clone(D.account), projects, assets, missingAssets,
    completeness: missingAssets.length ? 'incomplete: some referenced weather files are not included; results that used them cannot be rerun from this file alone' : 'all referenced weather files included',
    notes: ['Weather files are included for restoring your own projects; redistribution follows each publisher’s terms.', 'Cloud sharing, external engines and site context saved by the separate Site page are not part of this file.'] };
  out.integrity = { algorithm: 'sha-256', over: 'canonical JSON of this file without the integrity field', hash: bodyHash(out) };
  return out;
}
export async function backupText(opts) { return JSON.stringify(await buildBackup(opts)); }

// Check a parsed file without touching this browser. Returns the plan of what restore would do, or throws with every problem.
export function checkBackup(o, { conflicts = 'copy' } = {}) {
  const problems = [];
  if (!o || o.format !== FORMAT || !Array.isArray(o.projects)) throw Error('This is not a PlotCloud backup file.');
  if (o.v !== VERSION) throw Error(`Backup version ${o.v} is not supported here.`);
  if (!(o.schema <= C.SCHEMA)) throw Error('This backup was made by a newer PlotCloud. Update the page and try again.');
  if (!o.integrity || o.integrity.algorithm !== 'sha-256' || bodyHash(o) !== o.integrity.hash) throw Error('This backup file is damaged or was edited: its integrity check failed. Nothing was changed.');
  const included = new Map(), listed = new Set();
  for (const a of o.assets || []) {
    if (a.kind !== 'epw' || typeof a.data !== 'string' || sha256(a.data) !== a.hash) { problems.push(`Weather file ${a.name || a.hash} is damaged (its contents do not match its SHA-256).`); continue; }
    const lines = a.data.trim().split(/\r?\n/);
    if (!lines[0].startsWith('LOCATION,') || ![8760, 8784].includes(lines.length - 8)) problems.push(`Weather file ${a.name || a.hash} is not a complete hourly EPW.`);
    included.set(a.hash, a);
  }
  for (const a of o.missingAssets || []) listed.add(a.hash);
  const local = new Set(S.projects().map((p) => p.id)), seen = new Set(), plan = [];
  for (const raw of o.projects) {
    const p = S.clone(raw), label = p?.name || p?.id || 'A project';
    if (!p?.id || !Array.isArray(p.versions) || !Array.isArray(p.runs)) { problems.push(`${label} is incomplete.`); continue; }
    if (seen.has(p.id)) problems.push(`${label} appears twice in the file.`); seen.add(p.id);
    C.migrateProject(p);
    for (const x of C.integrityProblems(p)) problems.push(`${label}: ${x}.`);
    for (const ref of C.climateRefs(p)) if (!included.has(ref.hash) && !listed.has(ref.hash)) problems.push(`${label} uses weather ${ref.meta?.name || ref.hash} that is neither included nor listed as missing.`);
    const clash = local.has(p.id);
    plan.push({ project: p, from: raw.id, action: clash ? (conflicts === 'replace' ? 'replace' : 'copy') : 'add', missing: (o.missingAssets || []).filter((a) => C.climateRefs(p).some((r) => r.hash === a.hash)) });
  }
  if (problems.length) { const e = Error('The backup was not restored. Nothing in this browser changed.\n• ' + problems.join('\n• ')); e.problems = problems; throw e; }
  return { plan, assets: [...included.values()], missingAssets: o.missingAssets || [] };
}

// mode 'merge' adds projects (an ID already here is kept and the restored one becomes a copy, unless conflicts:'replace');
// mode 'replace' replaces every project and the Account settings here (the signed-in user is kept).
export async function restoreBackup(text, { mode = 'merge', conflicts = 'copy' } = {}) {
  let o; try { o = JSON.parse(text); } catch (e) { throw Error('This is not a PlotCloud backup (not JSON).'); }
  if (o?.format === FORMAT && o.v === 1) { const n = S.importAll(text, mode); return { legacy: true, restored: n, projects: [], assetsRestored: 0, missingAssets: [], note: 'Version-1 backup: weather files were not part of it. Upload the original EPW again under Project shared conditions.' }; }
  const { plan, assets, missingAssets } = checkBackup(o, { conflicts: mode === 'replace' ? 'replace' : conflicts });
  // Weather first: content-addressed, so a failure here leaves projects untouched (and extra copies are harmless).
  for (const a of assets) await putClimateRecord({ ...a.record, name: a.name, text: a.data, hash: a.hash });
  for (const a of assets) { const back = await climateFile(a.hash); if (!back || sha256(back.text) !== a.hash) throw Error('A weather file could not be stored in this browser. Nothing in your projects changed.'); }
  const out = [];
  if (mode === 'replace') S.replaceAll(plan.map((x) => x.project), o.account);
  for (const x of plan) {
    const p = x.project;
    if (mode !== 'replace') {
      if (x.action === 'copy') { p.id = S.uid('p'); p.name = `${p.name} (restored ${o.exported.slice(0, 10)})`; p.restoredFrom = { id: x.from, exported: o.exported }; }
      S.addRestored(p, x.action === 'replace');
    }
    out.push({ id: p.id, from: x.from, name: p.name, action: mode === 'replace' ? 'replace-all' : x.action, versions: p.versions.length, runs: p.runs.length, planRevisions: p.planRevisions.length, missingAssets: x.missing.map((a) => a.name || a.hash) });
  }
  return { restored: out.length, projects: out, assetsRestored: assets.length, missingAssets };
}
