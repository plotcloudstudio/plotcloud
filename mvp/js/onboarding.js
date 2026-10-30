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
    { id: 'study', t: 'Run a study', done: p.runs.length > 0, href: '#/simulations' },
    { id: 'compare', t: 'Compare two options', done: ranOn.size >= 2, href: `#/project/${p.id}` },
    { id: 'report', t: 'Export a report', done: (p.reportRevisions || []).length > 0, href: `#/project/${p.id}` },
  ];
}
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
