// Hash router and small helpers shared by the pages.
import * as S from './store.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('en-CA', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
export const when = (iso) => new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
export function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
export const MOCK = '<span class="tag mock" title="Prototype estimate from simple model quantities. Not the PlotCloud simulation engine.">Mock</span>';
export const LIVE = '<span class="tag live" title="Opens the working PlotCloud tool">Working tool</span>';

// the project people are working on, remembered between pages
export function currentProject() {
  const ps = S.projects(); let id = null; try { id = localStorage.getItem('pc-mvp-current'); } catch (e) { }
  return ps.find((p) => p.id === id) || ps[0] || null;
}
export function setCurrent(p) { try { localStorage.setItem('pc-mvp-current', p.id); } catch (e) { } }

const PAGES = {
  '': () => import('./pages/home.js'), workspace: () => import('./pages/workspace.js'), simulations: () => import('./pages/simulations.js'),
  results: () => import('./pages/results.js'), resources: () => import('./pages/resources.js'),
};
let cleanup = null;
async function route() {
  const [, page = '', ...rest] = location.hash.replace(/^#/, '').split('/');
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const key = PAGES[page.split('?')[0]] ? page.split('?')[0] : '';
  $$('[data-nav]').forEach((a) => { if (a.dataset.nav === (key || 'home')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#nav').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false');
  if (cleanup) { try { cleanup(); } catch (e) { } cleanup = null; }
  const app = $('#app'); app.innerHTML = '';
  const mod = await PAGES[key]();
  cleanup = (await mod.render(app, rest.map((x) => decodeURIComponent(x.split('?')[0])), params)) || null;
  document.title = 'PlotCloud — ' + ({ '': 'Home', workspace: 'Workspace', simulations: 'Simulations', results: 'Results', resources: 'Resources' })[key];
  window.scrollTo(0, 0);
}
addEventListener('hashchange', route);
$('#menuBtn').addEventListener('click', () => { const o = $('#nav').classList.toggle('open'); $('#menuBtn').setAttribute('aria-expanded', String(o)); });
S.load(); route();
