// Hash router, theme, sign-in state and small helpers shared by the pages.
import * as S from './store.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('en-CA', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
export const when = (iso) => new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
export function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
export const MOCK = '<span class="tag mock" title="Prototype estimate from simple model quantities. Not the PlotCloud simulation engine.">Mock</span>';
export const LIVE = '<span class="tag live" title="Opens the working PlotCloud tool">Working tool</span>';

// ---- theme: night by default, remembered in this browser; pages and the 3D view follow it
export const theme = () => document.documentElement.dataset.theme || 'night';
export const img = (name) => `img/${name}-${theme()}.jpg`;
export function setTheme(t) {
  document.documentElement.dataset.theme = t; try { localStorage.setItem('pc-mvp-theme', t); } catch (e) { }
  $$('#themeSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === t)));
  $$('img[data-holo]').forEach((im) => { im.src = img(im.dataset.holo); });
  dispatchEvent(new CustomEvent('pc-theme', { detail: t }));
}

// the project people are working on, remembered between pages
export function currentProject() {
  const ps = S.projects(); let id = null; try { id = localStorage.getItem('pc-mvp-current'); } catch (e) { }
  return ps.find((p) => p.id === id) || ps[0] || null;
}
export function setCurrent(p) { try { localStorage.setItem('pc-mvp-current', p.id); } catch (e) { } }

function who() {
  const u = S.account().user;
  $('#who').innerHTML = u ? `<a class="btn sm" href="#/account" style="padding-left:4px"><span class="avatar">${esc(u.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</span>Account</a>`
    : '<a class="btn sm" href="#/login">Log in</a> <a class="btn sm accent" href="#/login?signup=1">Start free</a>';
}

const PAGES = {
  '': () => import('./pages/home.js'), workspace: () => import('./pages/workspace.js'), 'workspace-v2': () => import('./pages/workspace-v2.js'), simulations: () => import('./pages/simulations.js'),
  results: () => import('./pages/results.js'), resources: () => import('./pages/resources.js'), pricing: () => import('./pages/pricing.js'),
  login: () => import('./pages/login.js'), account: () => import('./pages/account.js'),
};
const TITLES = { '': 'Home', workspace: 'Workspace', 'workspace-v2': 'Advanced workspace', simulations: 'Simulations', results: 'Results', resources: 'Resources', pricing: 'Pricing', login: 'Log in', account: 'Account' };
let cleanup = null;
export async function route() {
  const [, page = '', ...rest] = location.hash.replace(/^#/, '').split('/');
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const key = PAGES[page.split('?')[0]] ? page.split('?')[0] : '';
  $$('[data-nav]').forEach((a) => { if (a.dataset.nav === (key === 'workspace-v2' ? 'workspace' : key)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#nav').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false');
  document.querySelector('.pc-ui-context')?.remove();
  if (cleanup) { try { cleanup(); } catch (e) { } cleanup = null; }
  who();
  const app = $('#app'); app.innerHTML = '';
  const mod = await PAGES[key]();
  cleanup = (await mod.render(app, rest.map((x) => decodeURIComponent(x.split('?')[0])), params)) || null;
  if (['workspace','workspace-v2','simulations','results'].includes(key)) {
    const requested=params.get('project')||rest[0]?.split('?')[0];
    const project=S.project(requested)||currentProject();
    if(project){
      const context=document.createElement('div');context.className='pc-ui-context';context.setAttribute('aria-label','Current project');
      const version=project.versions.find(v=>v.id===params.get('version'))||project.versions.at(-1);
      context.innerHTML='<strong>'+esc(project.name)+'</strong><span data-pc-version>'+(version?(params.has('version')?'Saved v':'Latest saved v')+version.n:'No saved version')+'</span><span>'+esc((project.site?.label||'Site not set').split(',')[0])+'</span><a href="#/account">Site defaults</a><span class="pc-ui-storage">'+(S.persistent()?'Saved in this browser':'Session only · storage unavailable')+'</span>';
      app.before(context);
    }
  }
  document.title = 'PlotCloud — ' + TITLES[key];
  window.scrollTo(0, 0);
}
export const refreshWho = who;
addEventListener('pc-ui-theme',event=>setTheme(event.detail));
document.addEventListener('change',event=>{
  if(event.target.id!=='ver')return;
  const version=currentProject()?.versions.find(v=>v.id===event.target.value);
  const label=document.querySelector('[data-pc-version]');if(label&&version)label.textContent='Saved v'+version.n;
});
addEventListener('hashchange', route);
$('#menuBtn').addEventListener('click', () => { const o = $('#nav').classList.toggle('open'); $('#menuBtn').setAttribute('aria-expanded', String(o)); });
$$('#themeSeg button').forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.theme)));
S.load(); setTheme(theme()); route();
