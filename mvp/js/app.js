// Hash router, theme, sign-in state and small helpers shared by the pages.
import * as S from './store.js';
import {SIMS,MODEL_TOOLS,RESOURCES} from './data.js';
import * as C from './cloud.js';
import {checkAccess, canUse, renderGate} from './beta-access.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('en-CA', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
export function refreshProjectContext(project=currentProject()){
  const host=document.querySelector('.pc-ui-context');if(!host||!project)return;
  if(host.dataset.project&&host.dataset.project!==project.id)return;
  host.dataset.project=project.id;const name=host.querySelector('strong'),version=host.querySelector('[data-pc-version]'),v=currentVersion(project),latest=v===project.versions.at(-1);
  if(name){name.textContent=project.name;name.title=project.name;}
  if(version){version.textContent=v?(latest?'Latest saved v':'Saved v')+v.n:'No saved version';version.title=version.textContent;}
}
export const when = (iso) => new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
export function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
export const MOCK = '<span class="tag mock" title="Prototype estimate from simple model quantities. Not the PlotCloud simulation engine.">Mock</span>';
export const LIVE = '<span class="tag live" title="Computed by the PlotCloud simulation engine">Engine</span>';

// Fixed light artwork; project data is independent of interface appearance.
export const img = (name) => `img/${name}-day.jpg${['analysis-climate','analysis-passive','analysis-skyview','analysis-shadebenefit','analysis-solarenvelope'].includes(name)?'?v=study-unified-20261028-1':['analysis-noise','analysis-wayfinding','analysis-privacy'].includes(name)?'?v=engine-20261024-1':''}`;

// the project people are working on, remembered between pages
export function currentProject() {
  const ps = S.projects(); let id = null; try { id = localStorage.getItem('pc-mvp-current'); } catch (e) { }
  return ps.find((p) => p.id === id) || ps[0] || null;
}
export function setCurrent(p) { try { localStorage.setItem('pc-mvp-current', p.id); } catch (e) { } }
// the version simulations run on, per project (set by Workspace "Simulate" or the version picker); default: the latest saved
export function currentVersion(p) { let id = null; try { id = localStorage.getItem('pc-mvp-ver:' + p.id); } catch (e) { } return p.versions.find((v) => v.id === id) || p.versions.at(-1) || null; }
export function setCurrentVersion(p, vId) { try { localStorage.setItem('pc-mvp-ver:' + p.id, vId); } catch (e) { } }
// where "Back" on a simulation goes: the page it was entered from
export const simBack = () => { try { return sessionStorage.getItem('pc-sim-back') || '#/simulations'; } catch (e) { return '#/simulations'; } };

// signed in: Dashboard in the main menu and the avatar menu (Dashboard, Account settings, Log out); signed out: Log in, Start free
// the cloud copy's state, in a few words (signed-in people only)
function syncText() { const i = C.info(); return i.phase === 'syncing' ? 'Syncing…' : i.phase === 'error' ? `Not synced: ${i.error}` : i.last ? `Synced ${when(i.last)}` : 'Not synced yet'; }
function who() {
  const u = S.account().user, nav = $('#nav');
  nav.querySelector('[data-nav="home"]')?.remove();
  if (u) nav.insertAdjacentHTML('afterbegin', `<a href="#/home" data-nav="home"${/^#\/home/.test(location.hash) ? ' aria-current="page"' : ''}>Dashboard</a>`);
  $('#who').innerHTML = u ? `<span class="who-w"><button type="button" class="btn sm who-b" id="whoBtn" aria-haspopup="true" aria-expanded="false" style="padding-left:4px"><span class="avatar">${esc(u.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</span>${esc(u.name.split(/\s+/)[0].replace(/^./, (c) => c.toUpperCase()))} ▾</button>
      <span class="who-m" id="whoMenu" role="menu" hidden><span class="who-id"><b>${esc(u.name)}</b><small>${esc(u.email || '')}</small></span><a role="menuitem" href="#/home">Dashboard</a><a role="menuitem" href="#/account?tab=profile">Account settings</a><a role="menuitem" href="#/account?tab=data">Backup &amp; data</a>${u.cloud?'<span id="adminMenuLink"></span>':''}${u.cloud ? `<span class="who-sync" id="whoSync" aria-live="polite">${esc(syncText())}</span><button role="menuitem" type="button" id="whoSyncNow">Sync now</button>` : ''}<button role="menuitem" type="button" id="whoOut">Log out</button></span></span>`
    : '<a class="btn sm" href="#/login">Log in</a> <a class="btn sm accent" href="#/login?signup=1">Start free</a>';
  if(u?.cloud){const uid=C.user()?.id;C.rpc('pc_is_admin').then(admin=>{if(admin&&uid===C.user()?.id){const el=$('#adminMenuLink');if(el)el.innerHTML='<a role="menuitem" href="#/admin">Manage account access</a>';}}).catch(()=>{});}
  if (!u) return;
  const b = $('#whoBtn'), m = $('#whoMenu'), shut = () => { m.hidden = true; b.setAttribute('aria-expanded', 'false'); };
  b.onclick = (e) => { e.stopPropagation(); m.hidden = !m.hidden; b.setAttribute('aria-expanded', String(!m.hidden)); };
  m.onclick = () => shut(); $('#whoOut').onclick = async () => { if (u.cloud) await C.signOut(); else { S.account().user = null; S.save(); } who(); location.hash = '#/'; toast('Logged out'); };
  const sn = $('#whoSyncNow'); if (sn) sn.onclick = () => C.sync();
}
document.addEventListener('click', (e) => { const m = $('#whoMenu'); if (m && !e.target.closest('.who-w')) { m.hidden = true; $('#whoBtn')?.setAttribute('aria-expanded', 'false'); } });

const PAGES = {
  'local-compute':()=>import('./pages/local-compute.js?v=study-unified-20261028-2'),
  'comparison-report':()=>import('./pages/comparison-report.js'),
  'start-study':()=>import('./pages/start-study.js'),
  project:()=>import('./pages/project.js'), tables:()=>import('./pages/tables.js'), rendering:()=>import('./pages/rendering.js'),
  boards:()=>import('./pages/rendering.js').then(m=>({render:(a,r,q)=>m.render(a,['boards'],q)})),
  admin: () => import('./pages/admin.js'),
  '': () => import('./pages/home.js'), workspace: () => import('./pages/workspace-v2.js'), simulations: () => import('./pages/simulations.js'), legal:()=>import('./pages/legal.js'),
  results: () => import('./pages/results.js'), resources: () => import('./pages/resources.js'), pricing: () => import('./pages/pricing.js'), 'project-settings':()=>import('./pages/project-settings.js'),
  login: () => import('./pages/login.js'), account: () => import('./pages/account.js'), home: () => import('./pages/projects-home.js'), activity: () => import('./pages/dashboard.js'), 'new-project': () => import('./pages/project-map.js'), 'new-site': () => import('./pages/new-site.js'), 'batch-run': () => import('./pages/batch-run.js'),
};
const TITLES = { project:'Project', tables:'Tables', rendering:'Rendering', boards:'Boards', 'local-compute':'Local compute', admin:'Account access', '': 'Home', workspace: 'Workspace', simulations: 'Simulations', results: 'Results', resources: 'Resources', legal: 'Legal', pricing: 'Pricing', login: 'Log in', account: 'Account', home: 'Projects', activity: 'Activity', 'new-project': 'New project', 'new-site': 'New project from the map', 'batch-run': 'Batch run', 'project-settings':'Project shared conditions' };
let cleanup = null, prevHash = '', routeGeneration=0;
export async function route() {
  if (/(^#|&)(access_token|error_description)=/.test(location.hash)) { const r = C.captureRedirect(); if (r?.error) toast(r.error); }   // an emailed sign-in link opened in this tab
  const generation=++routeGeneration,isCurrent=()=>generation===routeGeneration;
  if(/^#\/(?:studio|workspace-archive)(?:\/|$|\?)/.test(location.hash))history.replaceState(null,'',location.hash.replace(/^#\/(?:studio|workspace-archive)/,'#/workspace'));
  if(/^#\/library(?:\?|$)/.test(location.hash))history.replaceState(null,'',location.hash.replace('#/library','#/resources/files'));
  if(/^#\/res\//.test(location.hash))history.replaceState(null,'',location.hash.replace('#/res/','#/resources/item/'));
  if(/^#\/showroom(?:\/|$)/.test(location.hash))history.replaceState(null,'',location.hash.replace('#/showroom','#/resources/showroom'));
  // one route per simulation, one state: old links that carry ?project=&version= set the current project and version, then the address is cleaned
  // the merged Workspace is now the Workspace; old Workspace v2 links land on it
  if (/^#\/workspace-v2(\/|$|\?)/.test(location.hash)) history.replaceState(null, '', location.hash.replace('#/workspace-v2', '#/workspace'));
  const h0 = location.hash, m0 = h0.match(/^#\/simulations(\/[\w-]+)?\?(.*)$/);
  if (m0) { const q0 = new URLSearchParams(m0[2]), pr = q0.get('project') && S.project(q0.get('project')); if (pr) { setCurrent(pr); if (q0.get('version') && S.version(pr, q0.get('version'))) setCurrentVersion(pr, q0.get('version')); } q0.delete('project');q0.delete('version');const query=q0.toString();history.replaceState(null, '', '#/simulations' + (m0[1] || '')+(query?'?'+query:'')); }
  if (/^#\/simulations\/[\w-]+$/.test(location.hash) && !/^#\/simulations\/[\w-]+/.test(prevHash)) { try { sessionStorage.setItem('pc-sim-back', prevHash || '#/simulations'); } catch (e) { } }
  prevHash = location.hash || '#/';
  const [, page = '', ...rest] = location.hash.replace(/^#/, '').split('/');
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const key = PAGES[page.split('?')[0]] ? page.split('?')[0] : '';
  $$('[data-nav]').forEach((a) => { if (a.dataset.nav === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#nav').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false');
  document.querySelector('.pc-ui-context')?.remove();
  if (cleanup) { try { cleanup(); } catch (e) { } cleanup = null; }
  who();
  const app = $('#app'); app.innerHTML = '';
  const study = key === 'simulations' ? rest[0]?.split('?')[0] : key === 'batch-run' ? params.get('sim') : null;
  const resource = key === 'resources' && rest[0] === 'tool' ? rest[1]?.split('?')[0] : null;
  const resourceTools = ['furniture','facade','detaillab','topo','stairs3d','doors3d','palette','axon','ergo','scale','code-bc','code-on','access-bc','access-on','leed'];
  const feature = SIMS.some(s => s.id === study) ? study : resourceTools.includes(resource) ? 'resource:' + resource : null;
  if (feature) {
    await checkAccess(); if (!isCurrent()) return;
    if (!canUse(feature)) {
      const toolName=[...MODEL_TOOLS,...RESOURCES.utilities,...RESOURCES.refs].find(t=>t.tool===resource)?.name||({stairs3d:'Stair generator',doors3d:'Door generator'})[resource];
      renderGate(app, toolName || 'This tool');
      if (key === 'batch-run' && params.get('batch')) window.parent.postMessage({pcBatch:params.get('batch'),ok:false,why:'Paid beta access required.'},location.origin);
      document.title = 'Beta access · PlotCloud'; return;
    }
  }
  const recover=error=>{app.innerHTML=`<div class="wrap"><h1 class="display md">This page could not finish loading.</h1><p>Your saved projects and results are kept. Reload to try again, or return to Workspace.</p><details><summary>Technical details</summary><p>${esc(error.message||'Page unavailable')}</p></details><button type="button" class="btn accent" id="retryPageLoad">Reload page</button> <a class="btn" href="#/workspace">Open Workspace</a> <a class="btn" href="#/simulations">Browse studies</a></div>`;$('#retryPageLoad',app).onclick=()=>location.reload();document.title='Page recovery · PlotCloud';};
  let mod;try{mod=await PAGES[key]();}catch(error){if(isCurrent())recover(error);return;}

  if(!isCurrent())return;
  let nextCleanup;
  try{nextCleanup=await mod.render(app,rest.map(x=>decodeURIComponent(x.split('?')[0])),params,{isCurrent});}catch(error){if(isCurrent())recover(error);return;}
  if(!isCurrent()){if(typeof nextCleanup==='function')nextCleanup();return;}
  cleanup=nextCleanup||null;
  // where the person was, for the Dashboard's “pick up where you left off”
  { const cp = currentProject(); if (cp && key === 'workspace') S.touchRecent('workspace', { project: cp.id }); if (cp && key === 'results') S.touchRecent('results', { project: cp.id }); if (cp && key === 'simulations' && rest[0] && rest[0] !== '') S.touchRecent('sim', { id: rest[0].split('?')[0], project: cp.id }); }
  if (['workspace','simulations','results'].includes(key)) {
    const requested=params.get('project')||rest[0]?.split('?')[0];
    const project=S.project(requested)||currentProject();
    if(project){
      const context=document.createElement('div');context.className='pc-ui-context';context.setAttribute('aria-label','Current project');
      const version=currentVersion(project), latest=version&&version===project.versions.at(-1);   // the version simulations run on (chosen in the Workspace or the version picker)
      context.innerHTML='<strong>'+esc(project.name)+'</strong><span data-pc-version>'+(version?(latest?'Latest saved v':'Saved v')+version.n:'No saved version')+'</span><span>'+esc((((S.isSharedPilot(rest[0])||rest[0]==='vent')?S.conditionsOf(project).site:S.siteOf(project))?.label||'Site not set').split(',')[0])+'</span><a href="#/project-settings/'+esc(project.id)+'">Shared conditions</a><span class="pc-ui-storage">'+(S.persistent()?'Saved in this browser':'Session only · storage unavailable')+'</span>';
      app.before(context);
      refreshProjectContext(project);
    }
  }
  document.title = 'PlotCloud — ' + TITLES[key];
  window.scrollTo(0, 0);
}
export const refreshWho = who;
document.addEventListener('change',event=>{
  if(event.target.id!=='ver')return;
  const version=currentProject()?.versions.find(v=>v.id===event.target.value);
  const label=document.querySelector('[data-pc-version]');if(label&&version)label.textContent='Saved v'+version.n;
});
addEventListener('hashchange', route);
$('#menuBtn').addEventListener('click', () => { const o = $('#nav').classList.toggle('open'); $('#menuBtn').setAttribute('aria-expanded', String(o)); });
// accounts and the cloud copy (cloud.js): an emailed sign-in link comes back in the address; read it before the first page
const fromLink = C.captureRedirect();
addEventListener('pc-cloud', (e) => { const el = $('#whoSync'); if (el) el.textContent = syncText(); if (e.detail.user && !S.account().user) who();
  const d = e.detail; if ((d.changed || d.copies || d.removed) && /^#\/(home|account|results)?(\?|$)|^#?$/.test(location.hash)) route(); else if (d.changed || d.copies) toast('Projects updated from your other devices'); });
S.init().then(() => { C.start(); if (fromLink?.error) toast(fromLink.error); return route(); }, route);   // the store comes from IndexedDB first (see store.js)
