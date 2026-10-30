// Projects home after sign-in (#/home): a workspace rail, a sidebar (My Projects, Favorites, Deleted, Account settings,
// Categories & Tags, Tutorials, What's new, latest change, signed-in user), and the project browser with a count, sort,
// grid / list / map views, search and a large "Add new project" card that opens the map (#/new-project).
// Everything here is real project data in this browser (or synced to the cloud account when signed in). The earlier
// dashboard (needs-attention list, activity, storage) stays available at #/activity.
import * as S from '../store.js';
import * as C from '../cloud.js';
import { $, $$, esc, toast, setCurrent, refreshWho } from '../app.js';

const I = {
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  grid: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>', restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;
// Real PlotCloud changes, newest first (shown under What's new; the first one also in the sidebar).
export const CHANGES = [
  ['2026-10-30', 'New project from the map', 'Pick a location, see which site data is available, and start with terrain and surrounding buildings.'],
  ['2026-10-30', 'One layout for every study', 'Every simulation now uses the Sun Hours layout: Settings | Export, Results | Charts and the same 3D view.'],
  ['2026-10-30', 'Plan B and editable PowerPoint', 'Adopt a suggested change, rerun the affected studies and export an editable deck.'],
  ['2026-10-30', 'Complete backups with weather', 'Backups include EPW files and can be restored in another browser.'],
];
const LEAF = 'https://unpkg.com/leaflet@1.9.4/dist/';
const leafletLoad = () => window.L ? Promise.resolve(window.L) : new Promise((res, rej) => { if (!document.querySelector('link[data-leaflet]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = LEAF + 'leaflet.css'; l.dataset.leaflet = '1'; document.head.append(l); } const s = document.createElement('script'); s.src = LEAF + 'leaflet.js'; s.onload = () => res(window.L); s.onerror = () => rej(Error('The map could not load.')); document.head.append(s); });
const PREF = 'pc-ph-pref';
const pref = () => { try { return JSON.parse(localStorage.getItem(PREF) || '{}'); } catch { return {}; } };
const setPref = (o) => { try { localStorage.setItem(PREF, JSON.stringify({ ...pref(), ...o })); } catch { } };
const day = (iso) => (iso || '').slice(0, 10).replaceAll('-', '/');
function ago(iso) { const s = (Date.now() - Date.parse(iso)) / 1000; if (!Number.isFinite(s)) return '—'; if (s < 60) return 'just now'; const m = s / 60; if (m < 60) return `${Math.floor(m)} minute${m < 2 ? '' : 's'} ago`; const h = m / 60; if (h < 24) return `${Math.floor(h)} hour${h < 2 ? '' : 's'} ago`; const d = h / 24; return d < 30 ? `${Math.floor(d)} day${d < 2 ? '' : 's'} ago` : day(iso); }
const thumbOf = (p) => [...(p.runs || [])].reverse().find((r) => /^data:image\/(png|jpeg);base64,/.test(r.results?.thumb || ''))?.results.thumb || null;

export function render(app, [section], params) {
  const A = S.account();
  if (!A.user) { location.hash = '#/login?next=home'; return; }
  const P = pref(); let view = ['grid', 'list', 'map'].includes(P.view) ? P.view : 'grid', sort = P.sort || 'created', q = '', tag = params.get('tag') || '';
  const where = ['favorites', 'deleted', 'tags'].includes(section) ? section : 'mine';
  const first = (A.user.name || A.user.email || 'You').trim(), initial = first[0]?.toUpperCase() || 'P';
  const all = () => S.projects(), live = () => all().filter((p) => !p.deletedAt);
  app.innerHTML = `<div class="ph">
    <nav class="ph-rail" aria-label="Workspaces"><a class="ph-ws" href="#/home" title="${esc(first)}’s workspace" aria-label="${esc(first)}’s workspace">${esc(initial)}</a><a class="ph-add" href="#/new-project" title="New project" aria-label="New project">+</a></nav>
    <aside class="ph-side" aria-label="Projects navigation"><div class="ph-brand">PlotCloud</div>
      <div class="ph-nav">
        <a href="#/home" ${where === 'mine' && !tag ? 'aria-current="page"' : ''}>${svg('folder')}My Projects<span class="ph-n">${live().length}</span></a>
        <a href="#/home/favorites" ${where === 'favorites' ? 'aria-current="page"' : ''}>${svg('star')}Favorites<span class="ph-n">${live().filter((p) => p.favorite).length || ''}</span></a>
        <a href="#/home/deleted" ${where === 'deleted' ? 'aria-current="page"' : ''}>${svg('trash')}Deleted<span class="ph-n">${all().filter((p) => p.deletedAt).length || ''}</span></a>
        <div class="ph-sep"></div>
        <a href="#/account">${svg('gear')}Account settings</a>
        <a href="#/home/tags" ${where === 'tags' || tag ? 'aria-current="page"' : ''}>${svg('tag')}Categories &amp; Tags</a>
        <div class="ph-sep"></div>
        <a href="#/start-study">${svg('book')}Tutorials</a>
        <button type="button" id="phNews">${svg('spark')}What’s new</button>
        <a href="#/activity">${svg('chart')}Activity &amp; storage</a>
      </div>
      <div class="ph-bottom"><a class="ph-news" href="#" id="phLatest"><small>New in the changelog</small><b>${esc(CHANGES[0][1])}</b></a>
        <div class="ph-who"><span class="ph-avatar">${esc(initial)}</span><div><small>Logged in as ${esc(first)}</small><button type="button" id="phOut">Log out</button></div></div></div>
    </aside>
    <section class="ph-main" aria-label="Projects"><div class="ph-bar">
      <div class="ph-count">${where === 'deleted' ? 'Deleted' : where === 'favorites' ? 'Favorites' : where === 'tags' ? 'Categories & Tags' : tag ? `Tag: ${esc(tag)}` : 'Project'}<span id="phCount"></span></div>
      <label>Sort by: <select class="ph-sort" id="phSort"><option value="created">Created</option><option value="edited">Last edited</option><option value="name">Name</option><option value="results">Most results</option></select></label>
      <div class="ph-views" role="group" aria-label="View">${['grid', 'list', 'map'].map((v) => `<button type="button" data-view="${v}" aria-pressed="${v === view}" aria-label="${v[0].toUpperCase() + v.slice(1)} view">${svg(v)}</button>`).join('')}</div>
      <div class="ph-search">${svg('search')}<input id="phQ" type="search" placeholder="Search projects" aria-label="Search projects"></div></div>
      <div class="ph-body" id="phBody"></div></section></div>
    <dialog class="ph-dialog" id="phDlg"><h2>What’s new</h2><ul>${CHANGES.map(([d, t, s]) => `<li><b>${esc(t)}</b> <small>${esc(d)}</small><br><span>${esc(s)}</span></li>`).join('')}</ul><form method="dialog"><button class="btn">Close</button></form></dialog>`;
  $('#phSort', app).value = sort;
  const news = () => $('#phDlg', app).showModal(); $('#phNews', app).onclick = news; $('#phLatest', app).onclick = (e) => { e.preventDefault(); news(); };
  $('#phOut', app).onclick = async () => { if (A.user.cloud) await C.signOut(); else { A.user = null; S.save(); } refreshWho(); location.hash = '#/'; toast('Logged out'); };
  $('#phSort', app).onchange = (e) => { sort = e.target.value; setPref({ sort }); draw(); };
  $('#phQ', app).oninput = (e) => { q = e.target.value.toLowerCase(); draw(); };
  for (const b of $$('[data-view]', app)) b.onclick = () => { view = b.dataset.view; setPref({ view }); for (const x of $$('[data-view]', app)) x.setAttribute('aria-pressed', String(x === b)); draw(); };
  let mapObj = null;

  function list() {
    let L = where === 'deleted' ? all().filter((p) => p.deletedAt) : live();
    if (where === 'favorites') L = L.filter((p) => p.favorite);
    if (tag) L = L.filter((p) => (p.tags || []).includes(tag));
    if (q) L = L.filter((p) => [p.name, S.conditionsOf(p)?.site?.label, ...(p.tags || []), p.profile?.client].join(' ').toLowerCase().includes(q));
    const by = { created: (a, b) => (b.created || '').localeCompare(a.created || ''), edited: (a, b) => (b.updated || '').localeCompare(a.updated || ''), name: (a, b) => a.name.localeCompare(b.name), results: (a, b) => b.runs.length - a.runs.length }[sort];
    return L.sort(by);
  }
  function card(p) {
    const t = thumbOf(p), del = !!p.deletedAt;
    return `<article class="ph-card" data-id="${esc(p.id)}"><a class="ph-thumb" href="${del ? '#' : '#/workspace/' + esc(p.id)}" data-open="${esc(p.id)}" aria-label="Open ${esc(p.name)}">${t ? `<img src="${t}" alt="">` : svg('folder').replace('<svg', '<svg class="ph-folder"')}</a>
      <div class="ph-actions">${del ? `<button type="button" data-restore="${esc(p.id)}" title="Restore" aria-label="Restore ${esc(p.name)}">${svg('restore')}</button><button type="button" data-purge="${esc(p.id)}" title="Delete permanently" aria-label="Delete ${esc(p.name)} permanently">${svg('trash')}</button>`
        : `<button type="button" data-fav="${esc(p.id)}" aria-pressed="${!!p.favorite}" title="Favorite" aria-label="Favorite ${esc(p.name)}">${svg('star')}</button><button type="button" data-tags="${esc(p.id)}" title="Tags" aria-label="Tags for ${esc(p.name)}">${svg('tag')}</button><button type="button" data-rename="${esc(p.id)}" title="Rename" aria-label="Rename ${esc(p.name)}">${svg('edit')}</button><button type="button" data-dup="${esc(p.id)}" title="Duplicate" aria-label="Duplicate ${esc(p.name)}">${svg('copy')}</button><button type="button" data-del="${esc(p.id)}" title="Delete" aria-label="Delete ${esc(p.name)}">${svg('trash')}</button>`}</div>
      <div class="ph-meta"><b title="${esc(p.name)}">${esc(p.name)}</b><span class="ph-stats"><span title="Saved results">${svg('chart')}${p.runs.length}</span><span title="Saved versions">${svg('layers')}${p.versions.length}</span></span></div>
      <div class="ph-dates">Created ${day(p.created)}<br>${del ? 'Deleted ' + ago(p.deletedAt) : 'Last edited ' + ago(p.updated || p.created)}</div>${(p.tags || []).length ? `<div class="ph-tags">${p.tags.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : ''}</article>`;
  }
  function draw() {
    if (mapObj) { mapObj.remove(); mapObj = null; }
    const body = $('#phBody', app), L = list(); $('#phCount', app).textContent = where === 'tags' ? '' : L.length;
    if (where === 'tags') { const counts = {}; for (const p of live()) for (const t of p.tags || []) counts[t] = (counts[t] || 0) + 1;
      body.innerHTML = Object.keys(counts).length ? `<table class="ph-list"><thead><tr><th>Tag</th><th>Projects</th></tr></thead><tbody>${Object.entries(counts).sort().map(([t, n]) => `<tr><td><a href="#/home?tag=${encodeURIComponent(t)}">${esc(t)}</a></td><td>${n}</td></tr>`).join('')}</tbody></table>` : '<p class="ph-empty">No tags yet. Hover a project and choose the tag button to add categories such as “Housing” or “Competition”.</p>'; return; }
    if (view === 'list') body.innerHTML = `${where === 'mine' ? '<p><a class="btn accent" href="#/new-project">+ Add new project</a></p>' : ''}<table class="ph-list"><thead><tr><th>Name</th><th>Location</th><th>Versions</th><th>Results</th><th>Created</th><th>Last edited</th></tr></thead><tbody>${L.map((p) => `<tr data-id="${esc(p.id)}"><td><a href="#/workspace/${esc(p.id)}" data-open="${esc(p.id)}">${esc(p.name)}</a>${p.favorite ? ' ★' : ''}</td><td>${esc((S.conditionsOf(p)?.site?.label || '—').split(',')[0])}</td><td>${p.versions.length}</td><td>${p.runs.length}</td><td>${day(p.created)}</td><td>${ago(p.updated || p.created)}</td></tr>`).join('')}</tbody></table>${L.length ? '' : '<p class="ph-empty">No projects here.</p>'}`;
    else if (view === 'map') { body.innerHTML = '<div class="ph-mapview" id="phMap"></div><p class="ph-dates">Projects are placed at their saved site location.</p>'; leafletLoad().then((Lf) => {
        if (!$('#phMap', app)) return; mapObj = Lf.map($('#phMap', app)).setView([30, 0], 2); Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'np-light', attribution: '© OpenStreetMap contributors' }).addTo(mapObj);
        const pts = []; for (const p of L) { const s = S.conditionsOf(p)?.site; if (!Number.isFinite(s?.lat)) continue; pts.push([s.lat, s.lon]); Lf.marker([s.lat, s.lon]).addTo(mapObj).bindPopup(`<b>${esc(p.name)}</b><br><a href="#/workspace/${esc(p.id)}">Open</a>`); }
        if (pts.length) mapObj.fitBounds(pts, { maxZoom: 12, padding: [40, 40] }); }); }
    else body.innerHTML = `<div class="ph-grid">${where === 'mine' && !tag ? `<a class="ph-new" href="#/new-project"><b>+</b>Add new project</a>` : ''}${L.map(card).join('')}</div>${L.length || where === 'mine' ? '' : `<p class="ph-empty">${where === 'deleted' ? 'Nothing deleted. Deleted projects stay here until you remove them permanently.' : 'No favorites yet: use the star on a project.'}</p>`}`;
    bind();
  }
  function bind() {
    const P = (id) => S.project(id);
    for (const a of $$('[data-open]', app)) a.addEventListener('click', () => { const p = P(a.dataset.open); if (p && !p.deletedAt) setCurrent(p); });
    for (const b of $$('[data-fav]', app)) b.onclick = () => { const p = P(b.dataset.fav); p.favorite = !p.favorite; S.save(); draw(); };
    for (const b of $$('[data-rename]', app)) b.onclick = () => { const p = P(b.dataset.rename), n = prompt('Project name', p.name); if (n?.trim()) { S.renameProject(p, n); draw(); } };
    for (const b of $$('[data-dup]', app)) b.onclick = () => { const c = S.duplicateProject(P(b.dataset.dup)); delete c.deletedAt; c.favorite = false; S.save(); toast(`Made “${c.name}”`); draw(); };
    for (const b of $$('[data-tags]', app)) b.onclick = () => { const p = P(b.dataset.tags), v = prompt('Tags, separated by commas', (p.tags || []).join(', ')); if (v === null) return; p.tags = [...new Set(v.split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 12); p.updated = new Date().toISOString(); S.save(); draw(); };
    for (const b of $$('[data-del]', app)) b.onclick = () => { const p = P(b.dataset.del); p.deletedAt = new Date().toISOString(); S.save(); toast(`“${p.name}” moved to Deleted`); render(app, [section], params); };
    for (const b of $$('[data-restore]', app)) b.onclick = () => { const p = P(b.dataset.restore); delete p.deletedAt; S.save(); toast('Restored'); render(app, [section], params); };
    for (const b of $$('[data-purge]', app)) b.onclick = () => { const p = P(b.dataset.purge); if (prompt(`Delete “${p.name}” with its ${p.versions.length} versions and ${p.runs.length} results permanently? Type DELETE to confirm.`) !== 'DELETE') return; S.deleteProject(p); toast('Deleted permanently'); render(app, [section], params); };
  }
  draw();
  return () => { if (mapObj) mapObj.remove(); };
}
