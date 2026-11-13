// Getting-started checklist shown over the Workspace (top right). Every tick comes from the project's own data; nothing is
// ticked by visiting a page. Dismiss keeps a small "Getting started" button to reopen it.
import * as S from './store.js';

export function steps(p) {
  const v = p.versions.at(-1)?.model, st = v?.studio || p.draft?.studio, c = S.conditionsOf(p)?.site || {};
  const building = !!((st?.walls || []).length || (st?.masses || []).length || (st?.imports || []).length || (v?.components || []).some((x) => x.type !== 'terrain' && !['Context', 'Site'].includes(x.layer)));
  const ranOn = new Set(p.runs.map((r) => r.versionId));
  return [
    { id: 'site', t: 'Pick the project site', done: !c.sample && Number.isFinite(c.lat), href: `#/project-settings/${p.id}` },
    { id: 'weather', t: 'Get the site weather (EPW)', done: !!c.climate?.hash, href: `#/project-settings/${p.id}` },
    { id: 'building', t: 'Draw or import a building', done: building, href: `#/workspace/${p.id}` },
    { id: 'version', t: 'Save a design version', done: p.versions.length >= 2 || (p.versions.length >= 1 && building), href: `#/workspace/${p.id}` },
    { id: 'study', t: 'Run a study', done: p.runs.length > 0, href: `#/workspace/${p.id}?add=sim` },   // opens Add simulation in the Workspace (2026-11-12)
    { id: 'compare', t: 'Compare two options', done: ranOn.size >= 2, href: `#/workspace/${p.id}` },   // opens Compare sketches (workspace-chrome.js)
    { id: 'report', t: 'Export a report', done: (p.reportRevisions || []).length > 0 || (p.exports || []).length > 0, href: `#/project/${p.id}` },   // the project report, or a PDF, slides or ZIP from the Workspace Export list
  ];
}
// the five steps of the project workflow (2026-11-12, P1b), each marked done from the project's own data; shown in the Workspace and on
// the project page, so both say the same. Steps can be taken in any order.
export function workflowState(p) { const st = steps(p), d = (id) => st.find((x) => x.id === id).done;
  return [
    { id: 'site', n: 1, t: 'Site analysis', done: d('site') && d('weather'), href: `#/project-settings/${p.id}` },
    { id: 'plan', n: 2, t: 'Plan Studio', done: d('building'), href: `#/workspace/${p.id}` },
    { id: 'sim', n: 3, t: 'Simulation', done: p.runs.length > 0, href: `#/workspace/${p.id}?add=sim` },
    { id: 'render', n: 4, t: 'Rendering', done: (p.renders || []).length > 0, href: `#/rendering?project=${p.id}` },
    { id: 'boards', n: 5, t: 'Boards', done: (p.boards || []).length > 0 || (p.exports || []).length > 0 || (p.reportRevisions || []).length > 0, href: `#/boards?project=${p.id}` },
  ]; }
export function mountChecklist(p, host = document.body) {
  if (!p.onboarding) return () => { };   // only projects started from the map (#/new-project) get the checklist
  const box = document.createElement('section'); box.className = 'pc-start'; box.setAttribute('aria-label', 'Getting started');
  const mini = document.createElement('button'); mini.type = 'button'; mini.className = 'pc-start-min'; mini.textContent = 'Getting started';
  const name = (S.account().user?.name || '').split(/\s+/)[0];
  function draw() {
    const list = steps(p), done = list.filter((x) => x.done).length, closed = !!p.onboarding?.dismissed;
    box.hidden = closed; mini.hidden = !closed || done === list.length;
    box.innerHTML = `<button type="button" class="x" aria-label="Close checklist">×</button><h2>👋 Welcome${name ? ' ' + escapeHTML(name) : ''}!</h2><p>Let’s get you started with your project.</p><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${list.length}" aria-valuenow="${done}"><i style="width:${(100 * done) / list.length}%"></i></div>
      <ol>${list.map((s) => `<li data-step="${s.id}" data-done="${s.done}"><a href="${s.href}"><span class="ck">${s.done ? '✓' : ''}</span><span class="t">${escapeHTML(s.t)}</span><span class="chev">›</span></a></li>`).join('')}</ol>`;
    box.querySelector('.x').onclick = () => { p.onboarding = { ...(p.onboarding || {}), dismissed: true }; S.save(); draw(); };
  }
  mini.onclick = () => { p.onboarding = { ...(p.onboarding || {}), dismissed: false }; S.save(); draw(); };
  host.append(box, mini); draw();
  const onSave = () => { if (box.isConnected) draw(); }; S.onSave(onSave);
  return () => { box.remove(); mini.remove(); };
}
const escapeHTML = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
