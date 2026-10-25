// Dashboard (#/home): the page after logging in. Pick up where you left off, what needs attention, your projects
// (new, open, rename, duplicate, archive, delete), recent activity, the simulations you use most, plan and storage.
// Everything comes from this browser's store (store.js); nothing here is estimated.
import * as S from '../store.js';
import { SIMS, sampleModel, simImg } from '../data.js';
import { $, $$, esc, toast, setCurrent, currentProject, currentVersion, setCurrentVersion, img } from '../app.js';

const SIM = Object.fromEntries(SIMS.map((s) => [s.id, s]));
const ago = (iso) => { if (!iso) return '—'; const s = (Date.now() - new Date(iso)) / 1000; if (s < 60) return 'just now'; if (s < 3600) return `${Math.round(s / 60)} min ago`; if (s < 86400) return `${Math.round(s / 3600)} h ago`; if (s < 86400 * 7) return `${Math.round(s / 86400)} d ago`; return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }); };
const size = (b) => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
const PREF = 'pc-mvp-dash';
const pref = () => { try { return JSON.parse(localStorage.getItem(PREF) || '{}'); } catch (e) { return {}; } };
const setPref = (o) => { try { localStorage.setItem(PREF, JSON.stringify({ ...pref(), ...o })); } catch (e) { } };

export function render(app) {
  const A = S.account();
  if (!A.user) { location.hash = '#/login?next=home'; return; }
  const P = pref(); let q = '', sort = P.sort || 'recent', showArch = false;
  const first = (A.user.name.split(/\s+/)[0] || '').replace(/^./, (c) => c.toUpperCase()), hr = new Date().getHours(), hello = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';

  app.innerHTML = `<div class="wrap db">
    <header class="db-hi">
      <div><span class="eyebrow">Dashboard</span><h1 class="display sm" style="margin-top:10px">${hello}, ${esc(first)}.</h1><p class="lede" id="where" style="margin-top:10px"></p></div>
      <div class="db-go" id="go"></div>
    </header>
    <section class="db-attn" id="attn" aria-label="Needs attention"></section>
    <div class="db-main">
      <section aria-labelledby="h-proj">
        <div class="db-bar"><h2 id="h-proj" class="db-h">Your projects</h2><span class="sp"></span>
          <input class="inp" id="q" type="search" placeholder="Search projects" aria-label="Search projects">
          <select class="inp" id="sort" aria-label="Sort projects"><option value="recent">Last changed</option><option value="name">Name</option><option value="results">Most results</option></select>
          <div class="db-new"><button class="btn accent" id="newBtn" aria-haspopup="true" aria-expanded="false">+ New project</button>
            <div class="db-menu" id="newMenu" hidden role="menu">
              <button role="menuitem" data-new="blank"><b>Blank</b><small>An empty model on your default site</small></button>
              <button role="menuitem" data-new="sample"><b>From the sample</b><small>A copy of the courtyard studio with two versions</small></button>
              <button role="menuitem" data-new="import"><b>Import a model</b><small>.obj, .stl or .glb, read in your browser</small></button>
            </div></div></div>
        <div class="db-grid" id="plist"></div>
        <button class="btn sm ghost" id="arch" hidden></button>
      </section>
      <aside class="db-side">
        <div class="card db-card" id="plan"></div>
        <div class="card db-card" id="store"></div>
        <div class="card db-card"><h3 class="db-h3">Simulations you use most</h3><div id="most"></div></div>
        <div class="card db-card"><h3 class="db-h3">Recent activity</h3><ol class="db-feed" id="feed"></ol></div>
      </aside>
    </div></div>`;

  const open = (p, to) => { setCurrent(p); location.hash = to; };
  function top() {
    const R = S.recent(), cur = currentProject(), v = cur && currentVersion(cur);
    const pw = R.workspace && S.project(R.workspace.project) || cur, ps = R.sim && S.project(R.sim.project) || cur, pr = R.results && S.project(R.results.project) || cur;
    $('#where', app).innerHTML = cur ? `Working on <b>${esc(cur.name)}</b>${v ? ` · v${v.n} “${esc(v.note)}”` : ' · no saved version yet'}.` : 'No project yet: start one below.';
    const card = (k, title, sub, href, pid) => `<a class="db-gocard" href="${href}" data-pid="${pid || ''}"><span class="eyebrow">${k}</span><b>${title}</b><small>${sub}</small></a>`;
    const sim = R.sim && SIM[R.sim.id];
    $('#go', app).innerHTML = (pw ? card('Continue modelling', 'Workspace', `${esc(pw.name)}${R.workspace ? ' · ' + ago(R.workspace.at) : ''}`, `#/workspace/${pw.id}`, pw.id) : '')
      + (sim && ps ? card('Continue simulating', esc(sim.name), `${esc(ps.name)} · ${ago(R.sim.at)}`, `#/simulations/${sim.id}`, ps.id) : card('Run a simulation', 'Simulations', `${SIMS.length} engines`, '#/simulations', cur?.id))
      + (pr ? card('Compare results', 'Results', `${esc(pr.name)} · ${pr.runs.length} result${pr.runs.length === 1 ? '' : 's'}`, `#/results/${pr.id}`, pr.id) : '');
    $$('#go [data-pid]', app).forEach((a) => a.addEventListener('click', () => { const p = S.project(a.dataset.pid); if (p) setCurrent(p); }));
  }
  // what needs doing, each with the way to do it
  function attention() {
    const out = [], live = S.projects().filter((p) => !p.archived);
    if (A.site?.sample) out.push(['site', 'Your default site is still the sample (Vancouver).', 'New projects and their simulations will use it until you set your own.', 'Set my site', '#/account?tab=site']);
    for (const p of live) {
      if (p.versions.length && S.dirtyDraft(p)) out.push(['draft', `${p.name}: changes since v${p.versions.at(-1).n} are not saved.`, 'Simulations run on saved versions only.', 'Open the Workspace', `#/workspace/${p.id}`, p.id]);
      const last = p.versions.at(-1); if (!last) continue;
      const onLast = new Set(p.runs.filter((r) => r.versionId === last.id).map((r) => r.simId)), before = new Set(p.runs.filter((r) => r.versionId !== last.id).map((r) => r.simId)), missing = [...before].filter((id) => !onLast.has(id));
      if (missing.length) out.push(['stale', `${p.name}: v${last.n} has no results yet for ${missing.length} simulation${missing.length > 1 ? 's' : ''} that ran on earlier versions.`, missing.slice(0, 4).map((id) => SIM[id]?.name || id).join(', ') + (missing.length > 4 ? '…' : ''), 'Run them in Results', `#/results/${p.id}`, p.id]);
      const redo = [...onLast].map((id) => S.lastRun(p, last.id, id)).filter((r) => r && S.runConditionsStatus(p, r));
      if (redo.length) out.push(['cond', `${p.name}: ${redo.map((r) => SIM[r.simId]?.name).join(' and ')} on v${last.n} ${redo.length > 1 ? 'need' : 'needs'} a rerun.`, S.runConditionsStatus(p, redo[0]), 'Open Results', `#/results/${p.id}`, p.id]);
    }
    const use = S.storageUse(); if (use > S.QUOTA * 0.8) out.push(['store', `Browser storage is ${Math.round(100 * use / S.QUOTA)} % full.`, 'When it is full, older results lose their pictures first.', 'Free up space', '#/account?tab=data']);
    const runs = live.reduce((n, p) => n + p.runs.length, 0), lb = A.lastBackup; if (runs && (!lb || Date.now() - new Date(lb) > 14 * 86400000)) out.push(['backup', lb ? `Last backup ${ago(lb)}.` : 'Your projects are only in this browser.', 'Download a backup file you can bring back on any computer.', 'Back up now', '#/account?tab=data']);
    if (A.notify?.stale === false) for (let i = out.length - 1; i >= 0; i--) if (out[i][0] === 'stale' || out[i][0] === 'cond') out.splice(i, 1);   // turned off in Account › Notifications
    $('#attn', app).innerHTML = out.length ? `<h2 class="db-h">Needs attention <span class="db-n">${out.length}</span></h2><div class="db-alist">${out.map(([k, t, s, b, href, pid]) => `<div class="db-aitem" data-kind="${k}"><i aria-hidden="true"></i><div><b>${esc(t)}</b><small>${esc(s)}</small></div><a class="btn sm" href="${href}" data-pid="${pid || ''}">${esc(b)}</a></div>`).join('')}</div>` : '';
    $$('#attn [data-pid]', app).forEach((a) => a.addEventListener('click', () => { const p = S.project(a.dataset.pid); if (p) setCurrent(p); }));
  }
  const thumbOf = (p) => { const last = p.versions.at(-1)?.id, r = p.runs.filter((x) => x.results?.thumb).sort((a, b) => (b.versionId === last) - (a.versionId === last) || b.created.localeCompare(a.created))[0]; return r ? `<img src="${r.results.thumb}" alt="">` : `<img data-holo="${p.sample ? 'hero' : 'heroA'}" src="${img(p.sample ? 'hero' : 'heroA')}" alt="">`; };
  function projects() {
    const all = S.projects(), arch = all.filter((p) => p.archived), ql = q.toLowerCase();
    let list = all.filter((p) => !!p.archived === showArch && (!ql || p.name.toLowerCase().includes(ql) || (S.siteOf(p)?.label || '').toLowerCase().includes(ql)));
    list.sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : sort === 'results' ? (a, b) => b.runs.length - a.runs.length : (a, b) => (b.updated || '').localeCompare(a.updated || ''));
    $('#plist', app).innerHTML = list.map((p) => { const last = p.versions.at(-1), dirty = p.versions.length && S.dirtyDraft(p);
      return `<article class="card db-p" data-id="${p.id}"><a class="db-th" href="#/workspace/${p.id}" data-open="${p.id}" tabindex="-1" aria-hidden="true">${thumbOf(p)}</a>
        <div class="db-pb"><div class="db-pt"><h3>${esc(p.name)}</h3><button class="db-dots" data-more="${p.id}" aria-label="More for ${esc(p.name)}" aria-haspopup="true">⋯</button></div>
        <p class="meta">${esc((S.siteOf(p)?.label || '—').split(',')[0])} · ${p.versions.length} version${p.versions.length === 1 ? '' : 's'} · ${p.runs.length} result${p.runs.length === 1 ? '' : 's'}</p>
        <p class="note">${last ? `v${last.n} “${esc(last.note)}” · ` : 'No saved version · '}changed ${ago(p.updated)}${dirty ? ' · <span class="dirty">unsaved changes</span>' : ''}${p.archived ? ' · archived' : ''}</p>
        <div class="acts"><a class="btn sm primary" href="#/workspace/${p.id}" data-open="${p.id}">Open</a><a class="btn sm" href="#/results/${p.id}" data-open="${p.id}">Results</a><a class="btn sm" href="#/simulations" data-open="${p.id}">Simulate</a></div></div></article>`; }).join('')
      || `<div class="card db-empty"><b>${showArch ? 'No archived projects.' : q ? 'No project matches.' : 'No projects yet.'}</b>${!showArch && !q ? '<p class="note">Start one with “+ New project”.</p>' : ''}</div>`;
    const ab = $('#arch', app); ab.hidden = !arch.length && !showArch; ab.textContent = showArch ? '← Back to your projects' : `Show archived (${arch.length})`;
    $$('#plist [data-open]', app).forEach((a) => a.addEventListener('click', () => setCurrent(S.project(a.dataset.open))));
    $$('#plist [data-more]', app).forEach((b) => b.onclick = (e) => { e.stopPropagation(); more(b, S.project(b.dataset.more)); });
  }
  // the ⋯ menu of a project card
  function more(btn, p) {
    closeMenus(); const m = document.createElement('div'); m.className = 'db-menu db-pmenu'; m.setAttribute('role', 'menu');
    m.innerHTML = `<button role="menuitem" data-a="rename">Rename</button><button role="menuitem" data-a="dup">Duplicate</button><a role="menuitem" href="#/project-settings/${p.id}">Shared conditions</a>
      <button role="menuitem" data-a="arch">${p.archived ? 'Unarchive' : 'Archive'}</button><button role="menuitem" data-a="del" class="danger">Delete…</button>`;
    btn.closest('.db-pt').appendChild(m);
    m.onclick = (e) => { const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; closeMenus();
      if (a === 'rename') { const n = prompt('Project name', p.name); if (n != null && n.trim()) { S.renameProject(p, n); toast('Renamed'); refresh(); } }
      if (a === 'dup') { const c = S.duplicateProject(p); toast(`Made “${c.name}”`); refresh(); }
      if (a === 'arch') { S.archiveProject(p, !p.archived); toast(p.archived ? 'Archived: find it under “Show archived”' : 'Back in your projects'); refresh(); }
      if (a === 'del') { if (prompt(`Delete “${p.name}” with its ${p.versions.length} versions and ${p.runs.length} results? This can't be undone here. Type DELETE to confirm.`) !== 'DELETE') return; S.deleteProject(p); toast('Project deleted'); refresh(); }
    };
  }
  const closeMenus = () => { $$('.db-pmenu', app).forEach((m) => m.remove()); $('#newMenu', app).hidden = true; $('#newBtn', app).setAttribute('aria-expanded', 'false'); };
  const outside = (e) => { if (!e.target.closest('.db-menu, #newBtn, [data-more]')) closeMenus(); };
  document.addEventListener('click', outside);
  $('#newBtn', app).onclick = (e) => { e.stopPropagation(); const was = !$('#newMenu', app).hidden; closeMenus(); if (!was) { $('#newMenu', app).hidden = false; $('#newBtn', app).setAttribute('aria-expanded', 'true'); } };
  $$('[data-new]', app).forEach((b) => b.onclick = () => { const k = b.dataset.new; closeMenus();
    const name = prompt('Project name', k === 'sample' ? 'Courtyard studio copy' : 'New project'); if (name === null) return;
    const blank = { units: 'm', north: A.site.north || 0, layers: [{ name: 'Imported', color: '#d5d2cb', visible: true, locked: false }], components: [] };
    const p = S.createProject(name.trim() || 'New project', k === 'sample' ? S.clone(sampleModel('B')) : blank);
    if (k === 'sample') { p.draft = S.clone(sampleModel('A')); S.saveVersion(p, 'Baseline massing and glazing'); p.draft = S.clone(sampleModel('B')); S.saveVersion(p, 'Larger south windows'); }
    if (k === 'import') { try { const u = JSON.parse(localStorage.getItem('pc-mvp-ws2') || '{}'); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ...u, panel: 'project', pacc: 'import', sels: [], selProject: null })); } catch (er) { } }
    setCurrent(p); if (p.versions.length) setCurrentVersion(p, p.versions.at(-1).id); location.hash = '#/workspace/' + p.id; });
  $('#q', app).oninput = (e) => { q = e.target.value; projects(); };
  $('#sort', app).value = sort; $('#sort', app).onchange = (e) => { sort = e.target.value; setPref({ sort }); projects(); };
  $('#arch', app).onclick = () => { showArch = !showArch; projects(); };

  function side() {
    const since = A.user.since ? new Date(A.user.since) : new Date(), left = Math.max(0, 7 - Math.floor((Date.now() - since) / 86400000)), trial = (A.user.plan || 'trial') === 'trial';
    $('#plan', app).innerHTML = `<h3 class="db-h3">Plan</h3><p class="db-big">${trial ? 'Pro trial' : 'Pro'}</p><p class="note">${trial ? (left ? `${left} day${left > 1 ? 's' : ''} left of 7. ` : 'The trial has ended. ') + 'Prototype: no payment is taken.' : 'Prototype plan.'}</p><a class="btn sm accent" href="#/pricing">See plans</a>`;
    const use = S.storageUse(), pc = Math.min(100, 100 * use / S.QUOTA), media = S.projects().reduce((n, p) => n + p.runs.filter((r) => r.results?.thumb).length, 0);
    $('#store', app).innerHTML = `<h3 class="db-h3">Storage in this browser</h3><div class="db-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pc)}" aria-label="Storage used"><i style="width:${pc.toFixed(1)}%"></i></div>
      <p class="note">${size(use)} of about ${size(S.QUOTA)} · ${S.projects().length} project${S.projects().length === 1 ? '' : 's'} · ${media} result picture${media === 1 ? '' : 's'}</p><p class="note">${A.lastBackup ? `Last backup ${ago(A.lastBackup)}.` : 'Not backed up yet.'} <a href="#/account?tab=data">Backup and space</a></p>`;
    const n = {}; for (const p of S.projects()) for (const r of p.runs) n[r.simId] = (n[r.simId] || 0) + 1;
    const top5 = Object.entries(n).filter(([id]) => SIM[id]).sort((a, b) => b[1] - a[1]).slice(0, 5);
    $('#most', app).innerHTML = top5.length ? top5.map(([id, k]) => `<a class="db-sim" href="#/simulations/${id}"><img data-holo="${simImg(id)}" src="${img(simImg(id))}" alt="" loading="lazy"><span><b>${esc(SIM[id].name)}</b><small>${k} run${k > 1 ? 's' : ''} · ${esc(SIM[id].group)}</small></span></a>`).join('')
      : `<p class="note">No runs yet. <a href="#/simulations">Browse the ${SIMS.length} simulations</a>.</p>`;
    const ev = [];
    for (const p of S.projects()) { for (const v of p.versions) ev.push([v.created, `Saved v${v.n} of ${p.name}`, v.note, `#/workspace/${p.id}`, p.id]);
      for (const r of p.runs) { const v = S.version(p, r.versionId), k = r.results?.kpis?.[0]; ev.push([r.created, `${SIM[r.simId]?.name || r.simId} on ${p.name}${v ? ' v' + v.n : ''}${r.source === 'batch' ? ' (batch)' : ''}`, k ? `${k[0]} ${k[1]}` : '', `#/results/${p.id}?sim=${r.simId}`, p.id]); } }
    ev.sort((a, b) => b[0].localeCompare(a[0]));
    $('#feed', app).innerHTML = ev.slice(0, 8).map(([t, w, s, href, pid]) => `<li><a href="${href}" data-pid="${pid}"><b>${esc(w)}</b>${s ? `<small>${esc(s)}</small>` : ''}<time datetime="${t}">${ago(t)}</time></a></li>`).join('') || '<li class="note">Nothing yet.</li>';
    $$('#feed [data-pid]', app).forEach((a) => a.addEventListener('click', () => { const p = S.project(a.dataset.pid); if (p) setCurrent(p); }));
  }
  function refresh() { top(); attention(); projects(); side(); }
  refresh();
  window.__dash = { refresh };
  return () => { document.removeEventListener('click', outside); delete window.__dash; };
}
