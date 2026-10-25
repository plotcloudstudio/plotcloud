// Accounts and the cloud copy of projects, on Supabase (2026-10-25). Local-first: the browser's store (store.js) stays the store of
// record for every page; when someone is signed in, their projects (with versions, results and Account settings) are sent to their
// rows in Supabase and brought back on their other devices. Plain fetch against Supabase's Auth (GoTrue) and REST (PostgREST) APIs.
//   Tables: cloud_projects (one row per project, without its versions' models), cloud_versions (saved versions, written once),
//   cloud_accounts (site and defaults). Row Level Security: each person reaches only their own rows (supabase/migrations/…).
// What changed where is worked out from a hash of each project as last synced and the server's own write time:
//   changed here only → send; changed there only → bring back; changed on both → keep this one and bring the other back as a copy
//   ("… (from another device)"), so nothing is lost; gone there but synced before → deleted on another device (removed here, unless
//   it was changed here since, then sent again); gone here but synced before → deleted here (removed there).
// The sample project is not sent. A project over 24 MB is not sent (reported in the status).
import * as S from './store.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './backend-config.js';

const SK = 'pc-cloud-session', STK = 'pc-cloud-state', LIMIT = 24e6;
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
// the backend: backend-config.js, or (for testing a project before publishing its keys) { url, key } in localStorage 'pc-cloud-config'
function cfg() { const o = read('pc-cloud-config'); if (o && o.url && o.key) return { url: String(o.url).replace(/\/+$/, ''), key: o.key }; return SUPABASE_URL && SUPABASE_ANON_KEY ? { url: SUPABASE_URL.replace(/\/+$/, ''), key: SUPABASE_ANON_KEY } : null; }
export const configured = () => !!cfg();
let session = read(SK), state = read(STK) || {}, busy = null, again = false, timer = 0;
const status = { phase: 'idle', last: state.last || null, error: '', skipped: [], cloud: null };
export const user = () => session?.user || null;
export const info = () => ({ configured: configured(), user: user(), ...status, last: state.last || null, busy: !!busy });
const emit = (detail = {}) => { try { dispatchEvent(new CustomEvent('pc-cloud', { detail: { ...info(), ...detail } })); } catch (e) { } };
const setSession = (s) => { session = s && s.access_token ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user: s.user ? { id: s.user.id, email: s.user.email, name: s.user.user_metadata?.name || '', created: s.user.created_at } : session?.user } : null; write(SK, session); };

// ---- HTTP
let refreshing = null;
async function fresh() {
  if (!session || session.expires_at * 1000 - Date.now() > 60000) return;
  refreshing = refreshing || (async () => { try { const r = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token }, auth: false }); setSession({ ...r, user: r.user || null }); }
    catch (e) { if (e.status === 400 || e.status === 401) { lost('Your session ended: please log in again.'); } throw e; } finally { refreshing = null; } })();
  return refreshing;
}
async function call(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const c = cfg(); if (!c) throw new Error('Cloud accounts are not set up on this site.');
  if (auth) await fresh();
  const r = await fetch(c.url + path, { method, headers: { apikey: c.key, 'Content-Type': 'application/json', ...(auth && session ? { Authorization: 'Bearer ' + session.access_token } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const txt = await r.text(); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
  if (!r.ok) { const e = new Error((data && (data.msg || data.error_description || data.message || data.error)) || r.statusText || 'Request failed'); e.status = r.status; throw e; }
  return data;
}
const back = () => location.origin + location.pathname;   // where emailed links return to (the hash router starts from here)

// ---- the account
function toAccount() {   // the Account page's user, from the signed-in person
  const A = S.account(), u = user(); if (!u) return;
  A.user = { ...(A.user || {}), name: u.name || A.user?.name || u.email.split('@')[0], email: u.email, id: u.id, cloud: true, plan: A.user?.plan || 'trial', since: A.user?.since || u.created || new Date().toISOString() }; S.save();
}
function lost(msg) { setSession(null); const A = S.account(); if (A.user?.cloud) { A.user = null; S.save(); } status.phase = 'signed-out'; status.error = msg || ''; emit(); }
export async function signUp(email, password, name) {
  const r = await call('/auth/v1/signup?redirect_to=' + encodeURIComponent(back()), { method: 'POST', body: { email, password, data: { name } }, auth: false });
  if (!r || !r.access_token) return { confirm: true };   // the project asks people to confirm their email first
  setSession(r); begin(); return { ok: true };
}
export async function signIn(email, password) { const r = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, auth: false }); setSession(r); begin(); return { ok: true }; }
export async function emailLink(email) { await call('/auth/v1/otp?redirect_to=' + encodeURIComponent(back()), { method: 'POST', body: { email, create_user: true }, auth: false }); return { sent: true }; }
export async function signOut() { try { if (session) await call('/auth/v1/logout', { method: 'POST' }); } catch (e) { } setSession(null); state = {}; write(STK, null); const A = S.account(); A.user = null; S.save(); status.phase = 'signed-out'; emit(); }
// a link from an email (sign-in link, confirmation) comes back as #access_token=…&refresh_token=… (or #error=…); read it before the router
export function captureRedirect() {
  const h = location.hash; if (!/(^#|&)(access_token|error_description)=/.test(h)) return null;
  const q = new URLSearchParams(h.slice(1)); history.replaceState(null, '', location.pathname + location.search + (q.get('access_token') ? '#/home' : '#/login'));
  if (q.get('error_description')) return { error: q.get('error_description') };
  let claims = {}; try { claims = JSON.parse(atob(q.get('access_token').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { }
  setSession({ access_token: q.get('access_token'), refresh_token: q.get('refresh_token'), expires_at: +q.get('expires_at') || claims.exp || undefined, expires_in: +q.get('expires_in') || 3600,
    user: claims.sub ? { id: claims.sub, email: claims.email || '', user_metadata: claims.user_metadata || {} } : null });
  if (started) { toAccount(); setTimeout(sync, 0); }   // a link opened in a tab already running the site (on a fresh load, start() does this)
  return { pending: true };
}
function begin() { toAccount(); emit(); sync(); }

// ---- the sync
const syncable = (p) => p && !p.sample && !/^demo-/.test(p.id);
const pack = (p) => { const { versions, ...rest } = p; return { ...rest, versionIds: (versions || []).map((v) => v.id) }; };
const hashOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + s.length; };
const saveState = () => write(STK, state);
async function push(p, txt, h, st) {
  if (txt.length > LIMIT) { status.skipped.push(`${p.name} (${Math.round(txt.length / 1e6)} MB)`); return; }
  const [row] = await call('/rest/v1/cloud_projects?on_conflict=owner,id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: { id: p.id, name: p.name || '', data: JSON.parse(txt), client_updated: p.updated || null } });
  const sent = new Set(st?.vs || []), todo = (p.versions || []).filter((v) => !sent.has(v.id));
  for (const v of todo) { await call('/rest/v1/cloud_versions?on_conflict=owner,project_id,id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: { project_id: p.id, id: v.id, n: v.n, note: v.note || '', created: v.created || null, model: v.model } }); sent.add(v.id); }
  state.projects[p.id] = { h, su: row.server_updated, vs: [...sent] };
}
async function fetchProject(id, have = []) {
  const [row] = await call(`/rest/v1/cloud_projects?id=eq.${encodeURIComponent(id)}&select=data,server_updated`); if (!row) return null;
  const ids = row.data.versionIds || [], local = new Map(have.map((v) => [v.id, v])), miss = ids.filter((v) => !local.has(v));
  if (miss.length) for (const v of await call(`/rest/v1/cloud_versions?project_id=eq.${encodeURIComponent(id)}&id=in.(${miss.map((x) => '"' + x.replace(/"/g, '') + '"').join(',')})&select=id,n,note,created,model`)) local.set(v.id, v);
  const { versionIds, ...data } = row.data; return { project: { ...data, versions: ids.map((v) => local.get(v)).filter(Boolean) }, su: row.server_updated };
}
async function pull(id, have) {
  const got = await fetchProject(id, have); if (!got) return null; const txt = JSON.stringify(pack(got.project));
  state.projects[id] = { h: hashOf(txt), su: got.su, vs: got.project.versions.map((v) => v.id) }; saveState();
  return S.putProject(got.project);
}
async function syncAccount() {
  const A = S.account(), txt = JSON.stringify({ site: A.site, defaults: A.defaults }), h = hashOf(txt), st = state.account;
  const [row] = await call('/rest/v1/cloud_accounts?select=data,server_updated');
  const here = !st || st.h !== h, there = row && (!st || st.su !== row.server_updated);
  if (row && there && (!here || !st)) { A.site = row.data.site || A.site; A.defaults = row.data.defaults || A.defaults; state.account = { h: hashOf(JSON.stringify({ site: A.site, defaults: A.defaults })), su: row.server_updated }; saveState(); S.save(); return true; }
  if (here || !row) { const [r] = await call('/rest/v1/cloud_accounts?on_conflict=owner', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: { data: JSON.parse(txt) } }); state.account = { h, su: r.server_updated }; }
  return false;
}
export function sync() {
  if (!configured() || !session) return Promise.resolve(null);
  if (busy) { again = true; return busy; }
  busy = (async () => {
    status.phase = 'syncing'; status.error = ''; status.skipped = []; emit();
    if (state.uid !== session.user?.id) state = { uid: session.user?.id, projects: {} }; state.projects = state.projects || {};
    let changed = 0, copies = 0, removed = 0, sent = 0;
    try {
      if (!session.user?.id) { const u = await call('/auth/v1/user'); setSession({ ...session, user: u }); state.uid = u.id; toAccount(); }
      if (await syncAccount()) changed++;
      const remote = await call('/rest/v1/cloud_projects?select=id,name,server_updated,bytes'), R = new Map(remote.map((r) => [r.id, r]));
      for (const p of S.projects().filter(syncable).slice()) {
        const txt = JSON.stringify(pack(p)), h = hashOf(txt), st = state.projects[p.id], r = R.get(p.id); R.delete(p.id);
        if (!r) { if (st && st.h === h) { S.dropProject(p.id); delete state.projects[p.id]; removed++; continue; }   // deleted on another device
          await push(p, txt, h, null); sent++; continue; }
        const here = !st || st.h !== h, there = !st || st.su !== r.server_updated;
        if (!here && !there) continue;
        if (here && !there) { await push(p, txt, h, st); sent++; continue; }
        if (!here && there) { await pull(p.id, p.versions); changed++; continue; }
        // changed on both (or met for the first time with different contents): keep this one, bring the other back as a copy
        const got = await fetchProject(p.id, p.versions);
        if (got && JSON.stringify(pack(got.project)) !== txt) { const c = { ...got.project, id: p.id + '-' + Math.random().toString(36).slice(2, 6), name: `${got.project.name} (from another device)` }; S.putProject(c); copies++; }
        await push(p, txt, h, st); sent++;
      }
      for (const r of R.values()) {   // only in the cloud
        if (state.projects[r.id]) { await call(`/rest/v1/cloud_projects?id=eq.${encodeURIComponent(r.id)}`, { method: 'DELETE' }); delete state.projects[r.id]; removed++; }   // deleted here
        else { await pull(r.id, []); changed++; }   // made on another device
      }
      for (const p of S.projects().filter(syncable)) if (!state.projects[p.id]) { const txt = JSON.stringify(pack(p)); await push(p, txt, hashOf(txt), null); sent++; }   // copies made above
      state.last = new Date().toISOString(); saveState();
      status.phase = 'ok'; status.cloud = { projects: S.projects().filter(syncable).length, bytes: remote.reduce((s, r) => s + (r.bytes || 0), 0) };
    } catch (e) { status.phase = 'error'; status.error = e.message || String(e); if (e.status === 401) lost('Your session ended: please log in again.'); }
    finally { busy = null; saveState(); emit({ changed, copies, removed, sent }); if (again) { again = false; setTimeout(sync, 50); } }
    return { changed, copies, removed, sent };
  })();
  return busy;
}
// start: once per tab, in the top window only (batch runs open the site in hidden frames)
let started = false;
export function start() {
  if (started || window.top !== window) return; started = true;
  S.onSave(() => { if (!session || busy) return; clearTimeout(timer); timer = setTimeout(sync, 2500); });
  addEventListener('online', () => sync()); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });
  setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 120000);
  if (session && configured()) { toAccount(); sync(); } else emit();
}
// remove every row of the signed-in person (projects, versions, account settings); the sign-in itself stays (only the project's
// owner can delete a login, with the service key, which never reaches the browser)
export async function wipe() { if (!session) return; await call('/rest/v1/cloud_projects?id=not.is.null', { method: 'DELETE' }); await call('/rest/v1/cloud_accounts?owner=not.is.null', { method: 'DELETE' }); state = { uid: session.user?.id, projects: {} }; saveState(); }
