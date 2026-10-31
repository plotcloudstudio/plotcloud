// The Workspace's floating layout (2026-10-30): the model fills the window and the controls float over it.
//   top left     project (switch projects) and the level pill
//   top right    saved state, undo / redo, export, import, Send to Simulation
//   left rail    statistics, the panels (properties, layers, versions, view tool), spaces; Add simulation below it
//   bottom       Edit site, then the model tools (masses, context, rooms, structure, doors, windows, furniture, lights), select, text, delete
//   right rail   2D / 3D, zoom selected, fit, camera, walk / explode / elevation, sun, snapping, visibility, display
//   bottom left  project settings (import, export, site)
// Nothing here is a new tool: each control is the Workspace's or Plan Studio's own, moved, so its behaviour, keyboard and tests stay.
// The sun is the one addition: Plan Studio's 3D key light set from the site, the date and solar time, with shadows (display only).
import * as S from './store.js';
import { climateFile, ensureProjectClimate } from './project-climate.js';
import { weatherDownloadAvailable } from './automatic-climate.js?v=epw-connected-20261027-3';
import { sunPosition } from './environment/analysis.js?v=run-20261031-2';
import * as CL from '../../emb/lib/climate.js';
import { speedRatio } from './wind-lbm.js?v=wind-20261031-1';
import { mountProps } from './project-props.js?v=weather-20261031-1';

const I = (d, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const P = {
  stats: '<path d="M5 20V11M10 20V5M15 20v-6M20 20V9"/>',
  spaces: '<rect x="3.5" y="4" width="17" height="16" rx="1"/><path d="M3.5 12h8V4M11.5 12v8M11.5 15h9"/>',
  undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12h-1" transform="translate(0 -6)"/>',
  redo: '<path d="M15 7l5 5-5 5"/><path d="M20 12H10a6 6 0 0 0 0 12h1" transform="translate(0 -6)"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  zoomSel: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><rect x="9" y="9" width="6" height="6"/>',
  sun: '<circle cx="12" cy="12" r="3.6"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  snap: '<path d="M7 4v7a5 5 0 0 0 10 0V4"/><path d="M7 8h3M14 8h3"/>',
  eye: '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6S18 18 12 18 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>',
  select: '<path d="M6 4l12 7.5-5.2 1.2L10 18z"/>',
  text: '<path d="M5 6V4.5h14V6M12 4.5v15M9 19.5h6"/>',
  del: '<path d="M14.5 4.5l5 5-8.5 8.5H6l-2-2a1.4 1.4 0 0 1 0-2z"/><path d="M9.5 9.5l5 5M10 19.5h10"/>',
  more: '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
  settings: '<path d="M5 6h9M18 6h1M5 12h3M12 12h7M5 18h11M20 18h-1"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  chevron: '<path d="M7 10l5 5 5-5"/>',
  assets: '<path d="M4 7.5L12 4l8 3.5-8 3.5z"/><path d="M4 7.5v9L12 20l8-3.5v-9M12 11v9"/>',
  results: '<path d="M7 3.5h7l4 4V20.5H7z"/><path d="M14 3.5v4h4M10 12h5M10 15h5M10 18h3"/>',
};
// icons for controls whose text the Workspace rewrites (so the icon is drawn by CSS, not inside the button)
const svgURL = (d) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'>${d}</svg>`)}")`;
const MASK = {
  editSite: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.6 5.3 3.6 8.5s-1 6.1-3.6 8.5c-2.6-2.4-3.6-5.3-3.6-8.5s1-6.1 3.6-8.5z"/>',
  fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  vBtn: '<path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4z"/><circle cx="12" cy="13" r="3.2"/>',
  dBtn: '<path d="M12 3.5l8 4.5v8l-8 4.5-8-4.5V8z"/><path d="M12 12.5L20 8M12 12.5L4 8M12 12.5v8"/>',
  tabGear: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10.5 21l2-6 3 3v3M8.5 12.5l2.5-5 4 1.2 2 3.8M12.8 8.5l-1.3 5"/>',
};
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const area = (pts) => Math.abs(pts.reduce((a, q, i) => { const r = pts[(i + 1) % pts.length]; return a + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
const fmt = (n, d = 0) => Number(n || 0).toLocaleString('en', { maximumFractionDigits: d, minimumFractionDigits: d });
const DOY0 = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334], MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function mountChrome(app, api) {
  const { p, UI, saveUI, goView, activePane, dirty, baseline, select, studio, INST } = api;
  const $ = (s, r = app) => r.querySelector(s), root = $('.w2');
  root.classList.add('sp');
  let KEEP = null; const keepEl = () => { if (!KEEP) { KEEP = document.createElement('div'); KEEP.className = 'sp-keep'; KEEP.hidden = true; root.append(KEEP); } return KEEP; };   // controls kept for their behaviour, not shown
  const el = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; };
  const btn = (key, label, icon, extra = '') => `<button type="button" class="sp-b" data-sp="${key}" title="${label}" aria-label="${label}" ${extra}>${I(P[icon] || icon)}</button>`;
  for (const [id, d] of Object.entries(MASK)) { const b = $('#' + id); if (b) { b.classList.add('sp-mask'); b.style.setProperty('--ic', svgURL(d)); } }

  // ---- top left: project name (switch projects) and the level pill
  const tl = el('div', 'sp-tl');
  tl.innerHTML = `<div class="sp-card sp-proj sp-menuwrap"><button type="button" class="sp-pname" aria-haspopup="menu" aria-expanded="false"><span class="sp-pn">${esc(p.name)}</span><small id="spSub"></small>${I(P.chevron, 14)}</button>
    <div class="w2-menu sp-pmenu" role="menu" hidden>${S.projects().filter((x) => !x.archived).slice(0, 12).map((x) => `<a role="menuitem" href="#/workspace/${x.id}" ${x.id === p.id ? 'aria-current="page"' : ''}>${esc(x.name)}</a>`).join('')}<hr><a role="menuitem" href="#/home">All projects</a><a role="menuitem" href="#/new-project">New project</a></div></div>`;
  const cap = $('#cap'); cap.classList.add('sp-card', 'sp-level'); tl.append(cap);
  root.append(tl);
  const pbtn = $('.sp-pname', tl), pmenu = $('.sp-pmenu', tl);
  pbtn.onclick = (e) => { e.stopPropagation(); pmenu.hidden = !pmenu.hidden; pbtn.setAttribute('aria-expanded', String(!pmenu.hidden)); };

  // ---- top right: saved state, undo / redo, export, import, Send to Simulation
  const tr = el('div', 'sp-card sp-tr');
  // the Workbench's own command buttons move here (their state and handlers stay the Workbench's); shown as icons
  const edit = $('.wb-edit'), cmd = (k, d, title) => { const c = app.querySelector(`[data-command="${k}"]`); if (!c) return document.createComment(k); c.classList.add('sp-mask'); c.style.setProperty('--ic', svgURL(d)); if (title) c.title = title; return c; };
  tr.innerHTML = `<button type="button" class="sp-b sp-saved" data-sp="saved" title="Versions" aria-label="Versions">${I(P.check)}</button><span class="sp-sep"></span><span class="sp-u"></span><span class="sp-sep"></span>${btn('export', 'Export model', 'download')}${btn('import', 'Import model', 'upload')}<span class="sp-c"></span>`;
  tr.querySelector('.sp-u').replaceWith(cmd('undo', P.undo, 'Undo (Ctrl+Z)'), cmd('redo', P.redo, 'Redo (Ctrl+Y)'));
  tr.querySelector('.sp-c').replaceWith(cmd('center', '<circle cx="12" cy="12" r="2.5"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>', 'Center the imported building at the origin'));
  // Send to Simulation is gone from view (2026-10-30): studies open in this view from Add simulation. The button and its study
  // picker stay, hidden, because a study that does not run here yet opens its own page through them (the version handoff)
  const keep = keepEl(); keep.append(...[$('#workspaceStudy'), $('#sendSim')].filter(Boolean)); root.append(tr);

  // ---- left rail: statistics, the panels, spaces; Add simulation on its own below
  const left = el('nav', 'sp-rail sp-left'); left.setAttribute('aria-label', 'Panels');
  left.innerHTML = btn('stats', 'Statistics', 'stats', 'aria-pressed="false"');
  const tabList = $('#tabList'); left.append(tabList);
  left.insertAdjacentHTML('beforeend', btn('assets', 'Assets: imported models and your furniture', 'assets', 'aria-pressed="false"'));
  left.insertAdjacentHTML('beforeend', btn('spaces', 'Spaces', 'spaces', 'aria-pressed="false"'));
  const add = el('div', 'sp-rail sp-add'); add.append($('#addSimBtn'));
  root.append(left, add);

  // ---- bottom: Edit site | the model tools | select, text, delete, more
  const bottom = el('div', 'sp-bottom');
  const site = el('div', 'sp-card sp-tools'); site.append($('#editSite'));
  const tools = el('div', 'sp-card sp-tools'); tools.setAttribute('role', 'toolbar'); tools.setAttribute('aria-label', 'Model tools');
  for (const b of [...app.querySelectorAll('.w2-rail [data-panel]')].filter((b) => b.dataset.panel !== 'project')) tools.append(b);
  tools.insertAdjacentHTML('beforeend', '<span class="sp-sep"></span>');
  for (const [k, icon, label] of [['select', 'select', 'Select (Esc)'], ['text', 'text', 'Text label (T)'], ['delete', 'del', 'Delete (Del)']]) tools.append(cmd(k, P[icon], label));
  const more = $('.wb-extra'); if (more) { more.querySelector('summary').innerHTML = I(P.more); more.querySelector('summary').title = 'More: clear level, ceiling items'; tools.append(more); }
  bottom.append(site, tools); root.append(bottom);
  const palette = $('#panel'); palette.classList.add('sp-card', 'sp-palette'); root.append(palette);

  // ---- bottom left: project settings (the Project panel: import, export, site)
  const bl = el('div', 'sp-bl'); const projBtn = app.querySelector('.w2-rail [data-panel="project"]');
  projBtn.innerHTML = `${I(P.settings)}`; projBtn.classList.add('sp-b');
  // the Project panel (import, export, site) stays behind Export and Import at the top right; this button opens the project's props
  keepEl().append(projBtn);
  bl.insertAdjacentHTML('beforeend', `<button type="button" class="sp-b" data-sp="props" title="Project props: the shared parameters for every study" aria-label="Project props" aria-pressed="false">${I(P.settings)}</button><div class="sp-blt"><b>Project</b><span>${esc(S.siteOf(p)?.label?.split(',').slice(0, 2).join(',') || 'No site yet')}</span></div>`);
  root.append(bl);

  // ---- right rail: 2D / 3D, zoom selected, fit, camera, view tools, sun, snapping, visibility, display
  const right = el('nav', 'sp-rail sp-right'); right.setAttribute('aria-label', 'View');
  right.innerHTML = `<button type="button" class="sp-b sp-dim" data-sp="dim" title="Switch between plan (2D) and 3D" aria-label="Switch between plan and 3D">3D</button>${btn('zoomSel', 'Zoom selected', 'zoomSel')}`;
  right.append($('#fit'));
  const wrap = (node) => { const w = node.closest('div') || node; w.classList.add('sp-menuwrap'); right.append(w); };
  const gear = $('.w3-gearw'); wrap($('#vBtn')); gear.classList.add('sp-menuwrap'); right.append(gear);
  right.insertAdjacentHTML('beforeend', `<span class="sp-hr"></span>${btn('sun', 'Sun position', 'sun', 'aria-pressed="false"')}${btn('snap', 'Snapping', 'snap', 'aria-pressed="false"')}${btn('vis', 'Visibility', 'eye', 'aria-pressed="false"')}`);
  wrap($('#dBtn'));
  root.append(right);
  $('#vBtn').title = 'Camera: plan, ceiling plan, perspective'; $('#dBtn').title = 'Display: shaded, ghosted, wireframe'; $('#fit').title = 'Fit the model'; $('#tabGear').title = 'Walkthrough, explode, interior elevation';

  // ---- floating cards: the panels card (from the left rail), popovers (from the right rail), statistics and spaces
  const card = $('.w2-right'); card.classList.add('sp-card', 'sp-panelcard'); card.insertAdjacentHTML('afterbegin', '<button type="button" class="sp-x" aria-label="Close panel" title="Close">×</button>');
  card.querySelector('.sp-x').onclick = () => openCard(false);
  const pops = {};
  for (const k of ['stats', 'spaces', 'sun', 'snap', 'vis']) { const c = el('section', `sp-card sp-pop sp-pop-${k}`); c.hidden = true; c.dataset.pop = k; root.append(c); pops[k] = c; }
  const status = $('.w2-status'); pops.snap.innerHTML = '<h3>Snapping</h3>'; pops.snap.append(status);

  // the panels card and a study panel share the left side: the card covers the study panel while it is open
  function openCard(on) { root.classList.toggle('sp-card-open', on); if (on) { closePops(); if (!cmp.hidden) openSheet(false); if (!assetsCard.hidden) openAssets(false); } const sc = app.querySelector('.sp-studycard'); if (sc) sc.hidden = on || !ST.id; }
  let lastTab = UI.tab;
  tabList.addEventListener('click', (e) => { const t = e.target.closest('[data-tab]'); if (!t) return;
    if (t.dataset.tab === 'versions') { const on = !cmp.hidden && t.getAttribute('aria-selected') === 'true'; if (on) { e.stopImmediatePropagation(); openSheet(false); return; } setTimeout(() => openSheet(true), 0); return; }   // Compare sketches
    if (root.classList.contains('sp-card-open') && t.getAttribute('aria-selected') === 'true') { e.stopImmediatePropagation(); openCard(false); return; }
    openCard(true); }, true);
  // a selection switches the card to Properties (Workspace): show it
  new MutationObserver(() => { if (UI.tab !== lastTab) { lastTab = UI.tab; if (UI.tab === 'properties' && UI.sels.length) openCard(true); else if (!['layers', 'versions', 'properties'].includes(UI.tab)) openCard(true); } }).observe(tabList, { childList: true });

  function closePops(except) { for (const [k, c] of Object.entries(pops)) if (k !== except) { c.hidden = true; app.querySelector(`[data-sp="${k}"]`)?.setAttribute('aria-pressed', 'false'); } }
  function togglePop(k, anchor) {
    const c = pops[k], on = c.hidden; closePops(k); c.hidden = !on; anchor.setAttribute('aria-pressed', String(on)); if (!on) return;
    if (k === 'stats') drawStats(); if (k === 'spaces') drawSpaces(); if (k === 'sun') drawSun(); if (k === 'vis') drawVis();
    if (['stats', 'spaces'].includes(k)) openCard(false);
    const r = anchor.getBoundingClientRect(); c.style.top = '64px'; requestAnimationFrame(() => { const h = c.offsetHeight; c.style.top = Math.max(64, Math.min(innerHeight - h - 12, r.top - 8)) + 'px'; });
  }

  // ---- the palette (tools from the bottom bar, the Project panel from the bottom left): open and closed from its own button
  const palOpen = (on, project = false) => { root.classList.toggle('sp-pal-open', on); root.classList.toggle('sp-pal-project', on && project); if (on && typeof cmp !== 'undefined' && cmp && !cmp.hidden) openSheet(false); };
  palOpen(false);
  app.addEventListener('click', (e) => {
    const b = e.target.closest('[data-panel]'); if (!b) return;
    const same = UI.panel === b.dataset.panel && root.classList.contains('sp-pal-open');
    if (same) { e.stopImmediatePropagation(); palOpen(false); b.setAttribute('aria-pressed', 'false'); return; }
    palOpen(true, b.dataset.panel === 'project'); closePops();
  }, true);
  palette.addEventListener('click', (e) => { const t = e.target.closest('.w2-tile,.w2-card'); if (t && !t.dataset.impfurn && !e.target.closest('[data-myfx]')) setTimeout(() => palOpen(false), 0); });

  // ---- buttons
  const doc = () => { const a = activePane(); try { return a.ready ? a.win.document : null; } catch { return null; } };
  const openProject = (section) => { UI.pacc = section; saveUI(); if (UI.panel === 'project' && root.classList.contains('sp-pal-open')) palOpen(false); projBtn.click(); };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sp]'); if (!b) return; const k = b.dataset.sp;
    if (k === 'saved') { if (UI.tab !== 'versions') tabList.querySelector('[data-tab="versions"]')?.click(); else openCard(!root.classList.contains('sp-card-open')); }
    else if (k === 'export') openProject('export');
    else if (k === 'import') openProject('import');
    else if (k === 'dim') goView(UI.view === 'plan' ? 'persp' : 'plan');
    else if (k === 'props') openProps(propsCard.hidden);
    else if (k === 'assets') openAssets(assetsCard.hidden);
    else if (k === 'zoomSel') doc()?.getElementById('fitSelectedBtn')?.click();
    else if (pops[k]) { e.stopPropagation(); togglePop(k, b); }
  });
  const away = (e) => { if (!e.target.closest('.sp-pop,[data-sp]')) closePops(); if (!e.target.closest('.sp-proj')) { pmenu.hidden = true; pbtn.setAttribute('aria-expanded', 'false'); } };
  document.addEventListener('click', away);

  // ---- statistics: counted from the model as it is now (Plan Studio's objects and masses), nothing estimated
  function drawStats() {
    const w = INST.plan.ready ? INST.plan.ws : INST.persp.ready ? INST.persp.ws : null, objs = w ? w.objects() : [], st = studio() || {};
    const rooms = objs.filter((o) => o.k === 'room'), masses = st.masses || [], lv = w ? w.levels().list : [];
    const gfa = masses.reduce((a, m) => a + area(m.points || []) * (m.storeys || 1), 0), fp = masses.reduce((a, m) => a + area(m.points || []), 0);
    const ctx = (st.site?.buildings || []).filter((b) => !b.excluded).length;
    const row = (k, v) => `<div class="sp-kv"><span>${k}</span><b>${v}</b></div>`;
    pops.stats.innerHTML = `<h3>Statistics</h3>
      <h4>Massing</h4>${row('Masses', masses.length)}${row('Footprint', fmt(fp) + ' m²')}${row('Gross floor area', fmt(gfa) + ' m²')}
      <h4>Plan</h4>${row('Levels', lv.length)}${row('Rooms', rooms.length)}${row('Room area', fmt(rooms.reduce((a, r) => a + (r.area || 0), 0), 1) + ' m²')}${row('Walls', objs.filter((o) => o.k === 'wall').length)}${row('Doors and windows', objs.filter((o) => o.k === 'op').length)}${row('Furniture', objs.filter((o) => o.k === 'furn').length)}
      <h4>Site</h4>${row('Surrounding buildings', ctx)}${row('Terrain', st.site?.terrain ? `${st.site.terrain.res} m grid` : 'None')}
      <p class="sp-note">Gross floor area is each mass outline × its storeys. Room area is inside the walls.</p>`;
  }
  // ---- spaces: the rooms Plan Studio finds (closed walls), by level; a click selects the room
  function drawSpaces() {
    const w = INST.plan.ready ? INST.plan.ws : null, rooms = w ? w.objects().filter((o) => o.k === 'room') : [];
    const by = new Map(); for (const r of rooms) { if (!by.has(r.level)) by.set(r.level, []); by.get(r.level).push(r); }
    pops.spaces.innerHTML = `<h3>Spaces</h3>${rooms.length ? [...by].map(([l, list]) => `<h4>${esc(l || 'Level')}</h4>${list.map((r) => `<button type="button" class="sp-row" data-room="${esc(r.id)}"><span>${esc(r.name || 'Room')}</span><b>${fmt(r.area, 1)} m²</b></button>`).join('')}`).join('') : '<p class="sp-note">No rooms yet. Rooms appear when walls close a space (Draw room in the bottom bar).</p>'}`;
    pops.spaces.querySelectorAll('[data-room]').forEach((b) => b.onclick = () => select(['ps:room:' + b.dataset.room]));
  }
  // ---- sun: the 3D key light from the project site at a date and solar time
  const SUNK = 'pc-ws-sun';
  const sunState = () => { try { return JSON.parse(localStorage.getItem(SUNK)) || { on: false, m: 5, d: 21, h: 14 }; } catch { return { on: false, m: 5, d: 21, h: 14 }; } };
  function applySun() {
    const s = sunState(), c = S.siteOf(p) || {}, P3 = INST.persp; if (!P3.ready || !P3.win.S3?.sun) return null;
    if (!s.on || !Number.isFinite(c.lat)) { P3.win.S3.sun(null); return null; }
    return P3.win.S3.sun({ lat: c.lat, doy: DOY0[s.m] + s.d, hour: s.h, north: studio()?.north || 0 });
  }
  function drawSun() {
    const s = sunState(), c = S.siteOf(p) || {}, ok = Number.isFinite(c.lat), r = applySun();
    pops.sun.innerHTML = `<h3>Sun position</h3>${ok ? '' : '<p class="sp-note">This project has no site location yet.</p>'}
      <label class="sp-sw"><input type="checkbox" id="spSunOn" ${s.on ? 'checked' : ''} ${ok ? '' : 'disabled'}> Sun and shadows in 3D</label>
      <label class="sp-sl"><span>Date <output>${MONTHS[s.m]} ${s.d}</output></span><input type="range" id="spSunDay" min="0" max="364" value="${DOY0[s.m] + s.d - 1}" ${s.on ? '' : 'disabled'}></label>
      <label class="sp-sl"><span>Solar time <output>${String(Math.floor(s.h)).padStart(2, '0')}:${String(Math.round((s.h % 1) * 60)).padStart(2, '0')}</output></span><input type="range" id="spSunHour" min="4" max="21" step="0.25" value="${s.h}" ${s.on ? '' : 'disabled'}></label>
      <p class="sp-note" id="spSunAt">${r ? (r.alt > 0 ? `Sun ${fmt(r.alt, 1)}° up, bearing ${fmt(r.az)}°` : 'The sun is below the horizon.') : s.on ? 'Open the 3D view to see the sun.' : `${esc(c.label || '')}`}</p>
      <p class="sp-note">Shown in 3D only, for a look at shadows. For hours of sun, run Sun hours.</p>`;
    const save = (o) => { try { localStorage.setItem(SUNK, JSON.stringify({ ...sunState(), ...o })); } catch { } drawSun(); };
    pops.sun.querySelector('#spSunOn').onchange = (e) => { save({ on: e.target.checked }); if (e.target.checked && UI.view === 'plan') goView('persp'); };
    pops.sun.querySelector('#spSunDay').oninput = (e) => { const n = +e.target.value + 1; let m = 11; while (DOY0[m] >= n) m--; save({ m, d: n - DOY0[m] }); };
    pops.sun.querySelector('#spSunHour').oninput = (e) => save({ h: +e.target.value });
  }
  // ---- visibility: the Workspace's layers (the same eye as the Layers panel) and the site context's transparency
  function drawVis() {
    const layers = api.layers(), pd = INST.plan.ready ? INST.plan.win.document : null, op = pd?.getElementById('siteContextOpacity');
    pops.vis.innerHTML = `<h3>Visibility</h3>${layers.map((l, i) => `<label class="sp-sw"><input type="checkbox" data-visl="${i}" ${l.visible !== false ? 'checked' : ''}> <i style="background:${esc(l.color)}"></i>${esc(l.name)}</label>`).join('')}
      ${op ? `<label class="sp-sl"><span>Site context opacity <output>${op.value}%</output></span><input type="range" id="spCtxOp" min="0" max="100" step="5" value="${op.value}"></label>` : ''}`;
    pops.vis.querySelectorAll('[data-visl]').forEach((x) => x.onchange = () => { app.querySelector(`#layers [data-vis="${x.dataset.visl}"]`)?.click(); drawVis(); });
    const sl = pops.vis.querySelector('#spCtxOp'); if (sl) {
      sl.oninput = () => { sl.previousElementSibling.querySelector('output').textContent = sl.value + '%'; for (const k of ['plan', 'persp']) { const d = INST[k].ready ? INST[k].win.document.getElementById('siteContextOpacity') : null; if (d) { d.value = sl.value; d.dispatchEvent(new Event('input', { bubbles: true })); } } };
      sl.onchange = () => { const d = INST.plan.ready ? INST.plan.win.document.getElementById('siteContextOpacity') : null; if (d) d.dispatchEvent(new Event('change', { bubbles: true })); };
    }
  }

  // ---- studies in this view (2026-10-30, laid out like the study pages 2026-10-31): Add simulation opens the study over the model,
  // with Settings | Export on the left, Results | Charts on the right and the legend; the result is painted on the site in 3D.
  // Sun hours, Solar radiation and Sky exposure run here on Plan Studio's ground grid (the same shading: masses, the building,
  // surrounding buildings, terrain). The other studies still open their study page inside the Workspace (the host below).
  const IN_VIEW = { sunhours: 1, radiation: 1, skyview: 1, shadebenefit: 1, solarenvelope: 1, utci: 1, wind: 1 }, DAYS = [['03-21', '21 March'], ['06-21', '21 June'], ['12-21', '21 December']];
  const ENVELOPES = [['equinox', 'Equinoxes, 9:00 to 15:00', [[3, 20], [9, 22]], 9, 15], ['winter', 'Winter solstice, 10:00 to 14:00', [[12, 21]], 10, 14], ['summer', 'Summer solstice, 8:00 to 17:00', [[6, 21]], 8, 17]];
  const PERIODS = [['year', 'Whole year', 1, 12], ['summer', 'Summer · June to August', 6, 8], ['winter', 'Winter · December to February', 12, 2]];
  const studyCard = el('section', 'sp-card sp-studycard'); studyCard.hidden = true; studyCard.setAttribute('aria-label', 'Simulation settings');
  const resCard = el('section', 'sp-card sp-studyres'); resCard.hidden = true; resCard.setAttribute('aria-label', 'Simulation results');
  const legend = el('div', 'sp-card sp-legend'); legend.hidden = true; root.append(studyCard, resCard, legend);
  const ST = { id: null, ltab: 'settings', rtab: 'results', day: '03-21', period: 'year', envelope: 'equinox', utciHours: 'sun', utciShow: 'comfort', windShow: 'comfort', res: null, key: '', at: null, busy: false, err: '', saved: '' };
  const simMenu = document.querySelector('.w2-simmenu');
  if (simMenu) { simMenu.querySelectorAll('[data-addsim]').forEach((b) => { void b; });
    simMenu.addEventListener('click', (e) => { const b = e.target.closest('[data-addsim]'); if (!b) return; e.stopImmediatePropagation(); simMenu.hidden = true; $('#addSimBtn')?.setAttribute('aria-expanded', 'false'); openStudy(b.dataset.addsim); }, true); }
  const simName = (id) => (api.sims.find((x) => x.id === id) || { name: id }).name;
  // ---- every study in this page (2026-10-30): a study that does not run in the Workspace panel itself mounts its own study page
  // here, beside the left rail, after the usual handoff (pre-flight, site review, the version it runs on). Its "Back" returns to
  // the model; the model's editing controls are hidden while it is open.
  const HOST = { el: null, cleanup: null, token: 0, id: null };
  async function openHost(id) {
    closeHost(); closeStudy(); openCard(false); closePops(); palOpen(false); openSheet(false);
    const token = ++HOST.token, el = el2('section', 'sp-host'); el.setAttribute('aria-label', simName(id)); HOST.el = el; HOST.id = id; root.append(el); root.classList.add('sp-hosting');
    el.addEventListener('click', (e) => { const a = e.target.closest('a[href]'); if (!a) return; const h = a.getAttribute('href') || ''; if (/^#\/workspace(\/|$)/.test(h) || (a.closest('.shbar') && /Back/.test(a.textContent))) { e.preventDefault(); closeHost(); } }, true);
    try { const mod = await import('./pages/simulations.js'); const r = await mod.render(el, [id], new URLSearchParams('autorun=workspace'), { isCurrent: () => HOST.token === token && !!HOST.el }); if (HOST.token === token) HOST.cleanup = typeof r === 'function' ? r : null; else if (typeof r === 'function') r(); }
    catch (e) { el.innerHTML = `<div class="sp-hosterr"><p>${esc(simName(id))} could not open here: ${esc(e.message || e)}.</p><a class="btn sm" href="#/simulations/${esc(id)}">Open it on its own page</a></div>`; }
  }
  function closeHost() { if (!HOST.el) return; try { HOST.cleanup?.(); } catch { } HOST.cleanup = null; HOST.el.remove(); HOST.el = null; HOST.id = null; HOST.token++; root.classList.remove('sp-hosting'); }
  const el2 = (tag, cls) => { const e = document.createElement(tag); e.className = cls; return e; };
  window.__wsHost = { open: openHost, close: closeHost, id: () => HOST.id };
  function openStudy(id) { if (!IN_VIEW[id]) { closeStudy(); openPage(id); return; } closeHost(); if (ST.id !== id && ST.res && INST.persp.ready) INST.persp.ws.clearStudy?.(); if (ST.id !== id) Object.assign(ST, { id, res: null, key: '', at: null, err: '', saved: '', ltab: 'settings', rtab: 'results' }); openCard(false); closePops(); palOpen(false); studyCard.hidden = false; drawStudy(); }
  function closeStudy() { studyCard.hidden = true; resCard.hidden = true; legend.hidden = true; ST.id = null; ST.res = null; if (INST.persp.ready) INST.persp.ws.clearStudy?.(); }
  function openPage(id) { const sel = $('#workspaceStudy'); if (sel) { sel.value = id; sel.onchange?.(); } $('#sendSim')?.click(); }
  // the sky seen from a ground cell: 6 rings × 24 patches, weighted for a horizontal surface (sum 1): the sky view factor
  const SKY = (() => { const out = []; for (let i = 0; i < 6; i++) { const alt = 7.5 + i * 15, w0 = Math.sin(alt * Math.PI / 180) * Math.cos(alt * Math.PI / 180); for (let j = 0; j < 24; j++) out.push({ az: j * 15 + 7.5, alt, w: w0 }); } const t = out.reduce((a, d) => a + d.w, 0); out.forEach((d) => d.w /= t); return out; })();
  // the project's weather file, hourly direct normal and diffuse horizontal irradiance (EPW columns 15 and 16)
  async function weather() {
    let c = S.conditionsOf(p).site.climate; if (!c?.hash && weatherDownloadAvailable()) { await ensureProjectClimate(p); c = S.conditionsOf(p).site.climate; }
    const rec = c?.hash ? await climateFile(c.hash) : null; if (!rec?.text) throw Error('The weather for this address could not be fetched. Check the connection, or add an EPW in Project props › Default › Advanced.');
    const lines = rec.text.trim().split(/\r?\n/), h = lines[0].split(','), rows = [];
    for (const line of lines.slice(8)) { const a = line.split(','); rows.push({ m: +a[1], d: +a[2], h: +a[3], t: +a[6], dni: Math.max(0, +a[14] || 0), dhi: Math.max(0, +a[15] || 0) }); }
    return { station: c.station || c.name, lat: +h[6], lon: +h[7], tz: +h[8], rows, text: rec.text };
  }
  const statsOf = (vals) => { let lo = Infinity, hi = -Infinity, n = 0, sum = 0; for (const v of vals) if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); n++; sum += v; } return { lo: n ? lo : 0, hi: n ? hi : 0, n, avg: n ? sum / n : 0 }; };
  async function compute(id) {
    const w = INST.persp.ws;
    if (id === 'sunhours') { const r = w.sunStudy({ day: ST.day }); return { ...r, vals: r.grid.H, unit: 'h', ramp: 'sun', lo: 0, hi: r.scale, dec: 1, title: `Sun hours · ${r.dayName}`,
      rows: [['Average on the ground', fmt(r.avg, 1) + ' h'], ['Range', fmt(r.min, 1) + '–' + fmt(r.max, 1) + ' h'], ['Ground with ≥ 2 h of sun', fmt(r.two * 100) + '%'], ...(r.plot ? [['Plot with ≥ 2 h of sun', fmt(r.plot.two * 100) + '%']] : []), ['Day length', fmt(r.dayLength, 1) + ' h']],
      method: `Sun directions through ${r.dayName} at the site; each ${fmt(r.cell, 1)} m ground cell counts the time it sees the sun.`, results: { ground: +r.avg.toFixed(2), ground2h: +(r.two * 100).toFixed(1), min: r.min, max: r.max }, settings: { day: ST.day, dayName: r.dayName, label: `Ground, ${r.dayName} (Workspace)` } }; }
    if (id === 'radiation') {
      const wx = await weather(), [, pname, m0, m1] = PERIODS.find((x) => x[0] === ST.period), inP = (m) => (m0 <= m1 ? m >= m0 && m <= m1 : m >= m0 || m <= m1);
      const bins = new Map(); let dhi = 0, hours = 0;
      for (const r of wx.rows) { if (!inP(r.m)) continue; const sp = sunPosition(2026, r.m, r.d, r.h - 0.5, wx.lat, wx.lon, wx.tz); if (sp.alt <= 0) continue; hours++; dhi += r.dhi / 1000;
        if (r.dni > 0) { const key = Math.floor(sp.az / 15) + '|' + Math.min(8, Math.floor(sp.alt / 10)); bins.set(key, (bins.get(key) || 0) + r.dni * Math.sin(sp.alt * Math.PI / 180) / 1000); } }
      const direct = [...bins].map(([k, v]) => { const [a, l] = k.split('|').map(Number); return { az: a * 15 + 7.5, alt: Math.min(85, l * 10 + 5), w: v }; });
      const g = w.rayGrid([direct, SKY]), vals = g.H[0].map((v, k) => (Number.isFinite(v) ? v + dhi * g.H[1][k] : NaN)), st = statsOf(vals), dsum = direct.reduce((a, d) => a + d.w, 0);
      return { ...g, vals, unit: 'kWh/m²', ramp: 'heat', lo: st.lo, hi: st.hi, avg: st.avg, dec: 0, title: `Solar radiation · ${pname}`,
        rows: [['Average on the ground', fmt(st.avg) + ' kWh/m²'], ['Range', fmt(st.lo) + '–' + fmt(st.hi) + ' kWh/m²'], ['Open ground (no shade)', fmt(dsum + dhi) + ' kWh/m²'], ['Share of open-ground sun', fmt(st.avg / Math.max(1e-9, dsum + dhi) * 100) + '%'], ['Weather', esc(wx.station || '')]],
        method: `Hourly direct and diffuse sunlight from the project weather file (${esc(wx.station || 'EPW')}), ${fmt(hours)} sun-up hours, ${pname.toLowerCase()}. Direct sun in ${direct.length} sky patches is blocked by buildings and terrain; diffuse sky light is scaled by the sky each cell sees. Horizontal ground, ${fmt(g.cell, 1)} m cells.`,
        results: { ground: +st.avg.toFixed(1), min: st.lo, max: st.hi }, settings: { period: ST.period, label: `Ground, ${pname} (Workspace)` } }; }
    if (id === 'skyview') { const g = w.rayGrid([SKY]), vals = g.H[0].map((v) => (Number.isFinite(v) ? v * 100 : NaN)), st = statsOf(vals);
      return { ...g, vals, unit: '%', ramp: 'sky', lo: Math.floor(st.lo), hi: 100, avg: st.avg, dec: 0, title: 'Sky exposure',
        rows: [['Mean sky view', fmt(st.avg, 1) + '%'], ['Range', fmt(st.lo) + '–' + fmt(st.hi) + '%'], ['Ground under 50% sky', fmt(vals.filter((v) => v < 50).length / Math.max(1, st.n) * 100) + '%']],
        method: `The share of the sky each ${fmt(g.cell, 1)} m ground cell sees past buildings and terrain (144 sky patches, weighted for a horizontal surface).`, results: { value: +st.avg.toFixed(2), min: st.lo, max: st.hi }, settings: { label: 'Ground sky view (Workspace)' } }; }
    if (id === 'shadebenefit') {
      const wx = await weather(), lower = 18, upper = 26, help = new Map(), harm = new Map(), add = (M0, k, v) => M0.set(k, (M0.get(k) || 0) + v);
      for (const r of wx.rows) { if (!(r.dni > 0) || !Number.isFinite(r.t)) continue; const sp = sunPosition(2026, r.m, r.d, r.h - 0.5, wx.lat, wx.lon, wx.tz); if (sp.alt <= 0) continue; const k = Math.floor(sp.az / 15) + '|' + Math.min(8, Math.floor(sp.alt / 10));
        if (r.t > upper) add(help, k, r.t - upper); else if (r.t < lower) add(harm, k, lower - r.t); }
      const dirs = (M0) => [...M0].map(([k, v]) => { const [a, l] = k.split('|').map(Number); return { az: a * 15 + 7.5, alt: Math.min(85, l * 10 + 5), w: v }; });
      const H = dirs(help), C = dirs(harm), withD = w.rayGrid([H, C]), without = w.rayGrid([H, C], { withoutDesign: true });
      const vals = withD.H[0].map((v, k) => (Number.isFinite(v) ? (without.H[0][k] - v) - (without.H[1][k] - withD.H[1][k]) : NaN)), st = statsOf(vals), abs = [...vals].filter(Number.isFinite).map(Math.abs).sort((x, y) => x - y), m = Math.max(1, abs[Math.floor(abs.length * 0.95)] || 1);   // the scale from the 95th percentile, so a few extreme cells do not wash out the rest
      const pos = vals.filter((v) => v > 0.5).length, neg = vals.filter((v) => v < -0.5).length;
      return { ...withD, vals, unit: 'K·h', ramp: 'div', lo: -m, hi: m, avg: st.avg, dec: 0, title: 'Shade benefit · the design',
        rows: [['Mean net benefit', fmt(st.avg, 1) + ' K·h'], ['Ground where the design’s shade helps', fmt(pos / Math.max(1, st.n) * 100) + '%'], ['Ground where it costs warmth', fmt(neg / Math.max(1, st.n) * 100) + '%'], ['Weather', esc(wx.station || '')]],
        method: `What the design's shade does to the ground around it, over a year of the project weather (${esc(wx.station || 'EPW')}): an hour of shade counts for each degree above ${upper} °C and against for each degree below ${lower} °C, compared with the site without the design.`,
        results: { value: +st.avg.toFixed(2), min: st.lo, max: st.hi }, settings: { lower, upper, label: 'Design shade on the ground (Workspace)' } }; }
    if (id === 'solarenvelope') {
      const site = S.conditionsOf(p).site, [, pname, days, h0, h1] = ENVELOPES.find((x) => x[0] === ST.envelope), dirs = [];
      for (const [m, d] of days) for (let hr = h0; hr <= h1 + 1e-9; hr += 0.5) { const sp = sunPosition(2026, m, d, hr, site.lat, site.lon, site.lon / 15); if (sp.alt > 1) dirs.push(sp); }
      const g = w.solarEnvelope(dirs, { cap: 100 }), vals = g.H, st = statsOf(vals);
      return { ...g, vals, unit: 'm', ramp: 'height', lo: 0, hi: Math.max(10, Math.ceil(st.hi)), avg: st.avg, dec: 0, title: `Solar envelope · ${pname}`,
        rows: [['Mean envelope height', fmt(st.avg, 1) + ' m'], ['Range', fmt(st.lo, 1) + '–' + fmt(st.hi, 1) + ' m'], ['Ground under 10 m', fmt(vals.filter((v) => v < 10).length / Math.max(1, st.n) * 100) + '%'], ['Protected', `${g.context} surrounding buildings`]],
        method: `The tallest a building could be at each ${fmt(g.cell, 1)} m cell without its shadow reaching a surrounding building, for ${dirs.length} sun positions (${pname}, solar time). Heights above the ground, capped at 100 m.`,
        results: { value: +st.avg.toFixed(2), min: st.lo, max: st.hi }, settings: { envelope: ST.envelope, label: `Envelope, ${pname} (Workspace)` } }; }
    if (id === 'utci') {
      const wx = await weather(), E = CL.parseEPW(wx.text), [, pname, m0, m1] = PERIODS.find((x) => x[0] === ST.period), inP = (m) => (m0 <= m1 ? m >= m0 && m <= m1 : m >= m0 || m <= m1);
      const alpha = ({ open: 0.14, suburban: 0.22, city: 0.33 })[S.conditionsOf(p).site.terrain] || 0.22, hrs = [], binIx = new Map(), binDirs = [];
      for (let k = 0; k < 8760; k++) { const [m, d] = CL.monthDay(Math.floor(k / 24)); if (!inP(m)) continue; const sp = sunPosition(2026, m, d, (k % 24) + 0.5, E.lat, E.lon, E.tz); if (ST.utciHours === 'sun' && sp.alt <= 0) continue;
        let b = -1; if (sp.alt > 1 && E.DNR[k] > 0) { const key = Math.floor(sp.az / 15) + '|' + Math.min(8, Math.floor(sp.alt / 10)); if (!binIx.has(key)) { binIx.set(key, binDirs.length); const [a, l] = key.split('|').map(Number); binDirs.push({ az: a * 15 + 7.5, alt: Math.min(85, l * 10 + 5), w: 1 }); } b = binIx.get(key); }
        hrs.push({ k, alt: sp.alt, b }); }
      if (!hrs.length) throw Error('No hours to count in this period.');
      const g = w.rayGrid([SKY, ...binDirs.map((d) => [d])]), svf = g.H[0], n = hrs.length, LUT = new Float32Array(n * 22);
      hrs.forEach((h, j) => { const k = h.k, ta = E.T[k], va = CL.siteWind(E.WS[k], 10, alpha), tsky = CL.skyTemp(E, k);
        for (let sl = 0; sl < 2; sl++) for (let l = 0; l <= 10; l++) LUT[j * 22 + sl * 11 + l] = CL.utci(ta, CL.mrtOutdoor({ ta, tsky, svf: l / 10, sunlit: sl === 1, alt: h.alt, dnr: E.DNR[k], dhr: E.DHR[k] }), va, E.RH[k]); });
      const N = svf.length, comfort = new Float32Array(N).fill(NaN), heat = new Float32Array(N).fill(NaN), cold = new Float32Array(N).fill(NaN);
      for (let c = 0; c < N; c++) { if (!Number.isFinite(svf[c])) continue; const f = Math.min(1, svf[c]) * 10, l0 = Math.min(9, Math.floor(f)), t = f - l0; let ok = 0, hot = 0;
        for (let j = 0; j < n; j++) { const b = hrs[j].b, lit = b >= 0 && g.H[1 + b][c] > 0, x = j * 22 + (lit ? 11 : 0) + l0, u = LUT[x] + (LUT[x + 1] - LUT[x]) * t; if (u > 26) hot++; else if (u >= 9) ok++; }
        comfort[c] = 100 * ok / n; heat[c] = 100 * hot / n; cold[c] = 100 * (n - ok - hot) / n; }
      const sc = statsOf(comfort), sh = statsOf(heat), sk = statsOf(cold), show = { comfort: [comfort, 'No thermal stress', 'sun'], heat: [heat, 'Heat stress', 'heat'], cold: [cold, 'Cold stress', 'sky'] }[ST.utciShow], ss = statsOf(show[0]);
      return { ...g, vals: show[0], unit: '% of hours', ramp: show[2], lo: Math.floor(ss.lo), hi: Math.max(Math.floor(ss.lo) + 1, Math.ceil(ss.hi)), avg: ss.avg, dec: 0, title: `Outdoor comfort · ${show[1]}`,
        rows: [['No thermal stress (UTCI 9–26 °C)', fmt(sc.avg, 1) + '% of hours'], ['Heat stress (above 26 °C)', fmt(sh.avg, 1) + '%'], ['Cold stress (below 9 °C)', fmt(sk.avg, 1) + '%'], ['Hours counted', fmt(n) + (ST.utciHours === 'sun' ? ', sun up' : '')], ['Weather', esc(E.station || wx.station || '')]],
        method: `UTCI (Bröde et al. 2012) for every counted hour of the project weather (${esc(E.station || 'EPW')}, ${pname.toLowerCase()}), in sun and in shade at the sky view each ${fmt(g.cell, 1)} m cell has: air temperature, humidity, wind at 10 m for ${({ 0.14: 'open', 0.22: 'suburban', 0.33: 'city' })[alpha] || 'suburban'} terrain, and the radiant temperature from sun, sky and ground. Wind is not reduced by buildings here.`,
        results: { comfort: +sc.avg.toFixed(1), heat: +sh.avg.toFixed(1), cold: +sk.avg.toFixed(1) }, settings: { period: ST.period, hours: ST.utciHours, label: `Outdoor comfort, ${pname} (Workspace)` } }; }
    if (id === 'wind') {
      const wx = await weather(), E = CL.parseEPW(wx.text), alpha = ({ open: 0.14, suburban: 0.22, city: 0.33 })[S.conditionsOf(p).site.terrain] || 0.22, m = w.groundMask({ maxCells: 120 });
      const SEC = 8, sp = Array.from({ length: SEC }, () => []); let tot = 0;
      for (let k = 0; k < 8760; k++) { if (!Number.isFinite(E.WS[k])) continue; tot++; const u = CL.siteWind(E.WS[k], 1.5, alpha); if (E.WS[k] < 0.5) continue; sp[Math.round(((E.WD[k] % 360) + 360) % 360 / (360 / SEC)) % SEC].push(u); }
      sp.forEach((a) => a.sort((x, y) => x - y)); const prev = sp.reduce((b, a, i) => (a.length > sp[b].length ? i : b), 0), R = [];
      for (let s = 0; s < SEC; s++) { if (!sp[s].length) { R.push(null); continue; } const toward = (s * 360 / SEC + 180 - m.north) * Math.PI / 180; R.push(speedRatio(m.solid, m.nx, m.ny, [Math.sin(toward), Math.cos(toward)])); ST.progress = `${s + 1} of ${SEC} wind directions`; drawStudy(); await new Promise((r) => setTimeout(r, 0)); }
      const above = (arr, x) => { let lo = 0, hi = arr.length; while (lo < hi) { const md = (lo + hi) >> 1; if (arr[md] > x) hi = md; else lo = md + 1; } return arr.length - lo; };
      const share = (c, x) => { let n = 0; for (let s = 0; s < SEC; s++) if (R[s] && R[s][c] > 0) n += above(sp[s], x / R[s][c]); return n / tot; };
      const N = m.nx * m.ny, cls = new Float32Array(N).fill(NaN), ratio = new Float32Array(N).fill(NaN); const peaks = []; let windy = 0, sit = 0, unc = 0, unsafe = 0, n = 0;
      for (let c = 0; c < N; c++) { if (m.solid[c]) continue; let lo = 0, hi = 40; for (let it = 0; it < 24; it++) { const x = (lo + hi) / 2; if (share(c, x) > 0.05) lo = x; else hi = x; } const u95 = hi, k = CL.LAWSON.findIndex(([t]) => u95 <= t);
        cls[c] = k; ratio[c] = R[prev] ? R[prev][c] : NaN; let pk = 0; for (let s = 0; s < SEC; s++) if (R[s] && R[s][c] > pk) pk = R[s][c]; peaks.push(pk); n++; if (u95 > 6) windy++; if (k <= 1) sit++; if (k === 4) unc++; if (share(c, CL.LAWSON_SAFE.speed) > CL.LAWSON_SAFE.share) unsafe++; }
      peaks.sort((x, y) => x - y); const peak = peaks[Math.floor(peaks.length * 0.99)] || 0, a2 = m.cell * m.cell, names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], comfortMap = ST.windShow === 'comfort';
      return { ...m, cells: n, vals: comfortMap ? cls : ratio, unit: comfortMap ? 'Lawson class' : '× free stream', ramp: comfortMap ? 'lawson' : 'wind', lo: 0, hi: comfortMap ? 4 : 1.6, avg: statsOf(comfortMap ? cls : ratio).avg, dec: comfortMap ? 0 : 1, title: comfortMap ? 'Wind comfort · Lawson' : `Wind speed-up · from ${names[prev]}`,
        legendLabels: comfortMap ? ['Uncomfortable', 'Standing', 'Frequent sitting'] : null,
        rows: [['Frequent or occasional sitting', fmt(sit / Math.max(1, n) * 100) + '% of ground'], ['Uncomfortable', fmt(unc / Math.max(1, n) * 100) + '%'], ['Windy (above walking comfort)', fmt(windy * a2) + ' m²'], ['Unsafe (15 m/s too often)', fmt(unsafe * a2) + ' m²'], ['Speed-up, windiest 1 % of ground', fmt(peak, 2) + '×'], ['Prevailing wind', `from ${names[prev]}`], ['Weather', esc(E.station || '')]],
        method: `A 2D lattice-Boltzmann flow at pedestrian height for ${R.filter(Boolean).length} wind directions on a ${fmt(m.cell, 1)} m grid; buildings (the design and ${fmt(m.context)} surrounding buildings) block the flow. Hourly wind from the project weather (${esc(E.station || 'EPW')}) at 1.5 m for ${({ 0.14: 'open', 0.22: 'suburban', 0.33: 'city' })[alpha] || 'suburban'} terrain sets each spot's 5 % exceeded speed, rated by the City of London Lawson criteria (2019). A 2D slice: no flow over roofs or down facades, so speed-up in narrow gaps is overstated; screening, not a wind tunnel or 3D CFD study.`,
        results: { peak: +peak.toFixed(2), windy: Math.round(windy * a2), sitting: +(sit / Math.max(1, n) * 100).toFixed(1), uncomf: +(unc / Math.max(1, n) * 100).toFixed(1), unsafe: Math.round(unsafe * a2) }, settings: { show: ST.windShow, label: 'Pedestrian wind (Workspace)' } }; }
    throw Error('This study does not run here yet.');
  }
  async function runStudy() {
    ST.busy = true; ST.err = ''; ST.progress = ''; drawStudy();
    try { if (UI.view === 'plan') await goView('persp'); for (let i = 0; i < 80 && !INST.persp.ready; i++) await new Promise((r) => setTimeout(r, 100));
      await new Promise((r) => setTimeout(r, 30)); const t0 = performance.now(), r = await compute(ST.id), w = INST.persp.ws;
      if (ST.id !== 'sunhours') w.paintGrid({ X0: r.X0, Y0: r.Y0, cell: r.cell, nx: r.nx, ny: r.ny, vals: r.vals, lo: r.lo, hi: r.hi, ramp: r.ramp });
      r.ms = Math.round(performance.now() - t0); ST.res = r; ST.key = w.model(); ST.saved = ''; ST.at = new Date(); ST.rtab = 'results'; }
    catch (e) { ST.err = e.message || String(e); ST.res = null; }
    ST.busy = false; drawStudy();
  }
  // a result is kept with the saved version it was computed on: unsaved edits are saved as a version first
  async function saveStudy() {
    if (!ST.res || ST.busy) return; ST.busy = true; drawStudy();
    try { if (dirty()) { const before = baseline()?.id; $('#saveV')?.click(); for (let i = 0; i < 100 && baseline()?.id === before; i++) await new Promise((r) => setTimeout(r, 100)); if (baseline()?.id === before) throw Error('The version could not be saved.'); }
      const v = baseline(), r = ST.res; if (!v) throw Error('Save a version first.');
      S.addRun(p, v.id, ST.id, { ...r.settings, method: 'workspace-ground', cell: r.cell }, { ...r.results, cells: r.cells, computedAt: ST.at.toISOString() }, 'workspace');
      ST.saved = 'v' + v.n; ST.key = INST.persp.ws.model(); }
    catch (e) { ST.err = e.message; }
    ST.busy = false; drawStudy(); if (!cmp.hidden) drawCompare();
  }
  function download(name, href) { const a = document.createElement('a'); a.href = href; a.download = name; a.click(); }
  function exportCSV() { const r = ST.res; if (!r) return; const lines = ['x_m,y_m,' + (r.unit === '%' ? 'value_percent' : 'value_' + r.unit.replace(/[^a-z0-9]+/gi, '_'))]; for (let j = 0; j < r.ny; j++) for (let i = 0; i < r.nx; i++) { const v = r.vals[j * r.nx + i]; if (Number.isFinite(v)) lines.push(`${(r.X0 + (i + 0.5) * r.cell).toFixed(2)},${(r.Y0 + (j + 0.5) * r.cell).toFixed(2)},${(+v).toFixed(3)}`); }
    const u = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })); download(`${p.name.replace(/[^\w-]+/g, '-')}-${ST.id}.csv`, u); setTimeout(() => URL.revokeObjectURL(u), 2000); }
  function exportPNG() { const u = INST.persp.ready ? INST.persp.ws.viewPNG?.() : null; if (u) download(`${p.name.replace(/[^\w-]+/g, '-')}-${ST.id}.png`, u); }
  // the distribution of values on the ground, coloured with the legend's ramp
  function chart(r) { const n = 12, cnt = Array(n).fill(0), span = Math.max(1e-9, r.hi - r.lo); let tot = 0; for (const v of r.vals) if (Number.isFinite(v)) { cnt[Math.min(n - 1, Math.floor((v - r.lo) / span * n))]++; tot++; }
    const mx = Math.max(1, ...cnt), cols = INST.persp.ws?.rampColors?.(r.ramp) || ['#999'], col = (i) => cols[Math.min(cols.length - 1, Math.round(i / (n - 1) * (cols.length - 1)))];
    return `<svg viewBox="0 0 260 150" class="sp-hist" role="img" aria-label="Share of the ground in each band">${cnt.map((c, i) => `<rect x="${8 + i * 20.5}" y="${120 - c / mx * 105}" width="18" height="${c / mx * 105}" fill="${col(i)}"><title>${fmt(r.lo + span * i / n, r.dec)}–${fmt(r.lo + span * (i + 1) / n, r.dec)} ${r.unit}: ${fmt(c / Math.max(1, tot) * 100, 1)}%</title></rect>`).join('')}<line x1="6" y1="120.5" x2="256" y2="120.5" stroke="#d1d5db"/><text x="8" y="136">${fmt(r.lo, r.dec)}</text><text x="252" y="136" text-anchor="end">${fmt(r.hi, r.dec)} ${esc(r.unit)}</text></svg><p class="sp-note">Share of the ground in each band; hover a bar for its value.</p>`; }
  function drawStudy() {
    if (!ST.id) return; const id = ST.id, name = simName(id), r = ST.res, stale = r && INST.persp.ready && INST.persp.ws.model() !== ST.key;
    const status = ST.busy ? ['run', ST.progress ? `Running · ${ST.progress}` : 'Running…'] : ST.err ? ['err', ST.err] : !r ? ['idle', 'Not run yet'] : stale ? ['stale', 'The model changed after this result: run again'] : ['ok', `Up to date · ${ST.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`];
    const tabs = (side, cur, list) => `<div class="sp-tabs" role="tablist">${list.map(([k, n]) => `<button type="button" role="tab" data-st-${side}="${k}" aria-selected="${cur === k}">${n}</button>`).join('')}</div>`;
    const settings = id === 'sunhours' ? `<label class="sp-field">Day<select data-st="day">${DAYS.map(([k, n]) => `<option value="${k}" ${k === ST.day ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`
      : id === 'radiation' ? `<label class="sp-field">Period<select data-st="period">${PERIODS.map(([k, n]) => `<option value="${k}" ${k === ST.period ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`
      : id === 'solarenvelope' ? `<label class="sp-field">Protected sun<select data-st="envelope">${ENVELOPES.map(([k, n]) => `<option value="${k}" ${k === ST.envelope ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`
      : id === 'utci' ? `<label class="sp-field">Period<select data-st="period">${PERIODS.map(([k, n]) => `<option value="${k}" ${k === ST.period ? 'selected' : ''}>${n}</option>`).join('')}</select></label><label class="sp-field">Hours<select data-st="utciHours"><option value="sun" ${ST.utciHours === 'sun' ? 'selected' : ''}>Hours with the sun up</option><option value="all" ${ST.utciHours === 'all' ? 'selected' : ''}>All hours</option></select></label><label class="sp-field">Map shows<select data-st="utciShow">${[['comfort', 'No thermal stress (UTCI 9–26 °C)'], ['heat', 'Heat stress'], ['cold', 'Cold stress']].map(([k, n]) => `<option value="${k}" ${k === ST.utciShow ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`
      : id === 'wind' ? `<label class="sp-field">Map shows<select data-st="windShow"><option value="comfort" ${ST.windShow === 'comfort' ? 'selected' : ''}>Comfort (Lawson)</option><option value="speedup" ${ST.windShow === 'speedup' ? 'selected' : ''}>Speed-up, prevailing wind</option></select></label><p class="sp-note">Eight wind directions, about a second each.</p>`
      : id === 'shadebenefit' ? '<p class="sp-note">Shade helps above 26 °C and costs warmth below 18 °C, from the project weather.</p>' : '';
    studyCard.innerHTML = `<header><b>${esc(name)}</b><button type="button" class="sp-x" data-st="close" aria-label="Close ${esc(name)}">×</button></header>
      <p class="sp-status" data-state="${status[0]}">${esc(status[1])}</p>${tabs('l', ST.ltab, [['settings', 'Settings'], ['export', 'Export']])}
      <div class="sp-stbody">${ST.ltab === 'settings' ? `${settings}<p class="sp-note">Location, time zone, true north${['radiation', 'shadebenefit', 'utci', 'wind'].includes(id) ? ' and weather' : ''} come from Project props. ${id === 'wind' ? 'Wind is blocked by' : 'Shading:'} masses, the building (walls, and each room as a box up to its ceiling) and the surrounding buildings, on the terrain.</p>
        <button type="button" class="btn sm primary sp-run" data-st="run" ${ST.busy ? 'disabled' : ''}>${ST.busy ? 'Running…' : r ? 'Run again' : 'Run analysis'}</button>`
        : `<p class="sp-note">${r ? 'The result on the ground as a table, or the view as a picture.' : 'Run the study first.'}</p><button type="button" class="btn sm" data-st="csv" ${r ? '' : 'disabled'}>Ground values (CSV)</button> <button type="button" class="btn sm" data-st="png" ${r ? '' : 'disabled'}>View (PNG)</button>`}</div>`;
    resCard.hidden = !r; legend.hidden = !r;
    if (r) { resCard.innerHTML = `<header><b>${esc(r.title)}</b></header>${tabs('r', ST.rtab, [['results', 'Results'], ['charts', 'Charts']])}<div class="sp-stbody">${ST.rtab === 'results' ? `${r.rows.map(([k, v]) => `<div class="sp-kv"><span>${k}</span><b>${v}</b></div>`).join('')}
        <h4>How this was found</h4><p class="sp-note">${r.method} ${fmt(r.cells)} cells, ${fmt(r.prisms)} building parts and ${fmt(r.context)} surrounding buildings${r.terrain ? ', on the terrain' : ''}; ${fmt(r.ms)} ms in this browser. A design check for early design, not a compliance result.</p>
        ${ST.saved ? `<p class="sp-note">Saved to results with ${esc(ST.saved)}.</p>` : `<button type="button" class="btn sm primary" data-st="save" ${stale || ST.busy ? 'disabled' : ''}>Save to results</button>`} <button type="button" class="btn sm" data-st="clear">Clear from view</button>` : chart(r)}</div>`;
      const cols = INST.persp.ws?.rampColors?.(r.ramp) || []; legend.innerHTML = `<b>${esc(name)} · ${esc(r.unit)}</b><div class="sp-ramp" style="background:linear-gradient(to top,${cols.join(',')})"></div><div class="sp-rampl">${(r.legendLabels || [fmt(r.hi, r.dec), fmt((r.lo + r.hi) / 2, r.dec), fmt(r.lo, r.dec)]).map((x) => `<span>${esc(x)}</span>`).join('')}</div>`; }
  }
  root.addEventListener('click', (e) => { const b = e.target.closest('.sp-studycard [data-st], .sp-studyres [data-st], [data-st-l], [data-st-r]'); if (!b) return;
    if (b.dataset.stL) { ST.ltab = b.dataset.stL; drawStudy(); return; } if (b.dataset.stR) { ST.rtab = b.dataset.stR; drawStudy(); return; }
    const k = b.dataset.st; if (k === 'save') saveStudy(); else if (k === 'close') closeStudy(); else if (k === 'run') runStudy(); else if (k === 'page') openPage(ST.id); else if (k === 'csv') exportCSV(); else if (k === 'png') exportPNG();
    else if (k === 'clear') { if (INST.persp.ready) INST.persp.ws.clearStudy(); ST.res = null; drawStudy(); } });
  studyCard.addEventListener('change', (e) => { const k = e.target.dataset.st; if (['day', 'period', 'envelope', 'utciHours', 'utciShow', 'windShow'].includes(k)) { ST[k] = e.target.value; drawStudy(); } });
  let staleShown = false;

  // ---- Compare sketches (2026-10-30): a sheet over the lower half of the view. Each saved version is a sketch (a column with its
  // picture and name; the one the model is on says Current); rows are grouped (Pinned, Building, Site, Space, Element, Results) and
  // read from the versions and the saved study results. Add sketch saves the model as a version; Export to Excel writes a CSV.
  const cmp = el('section', 'sp-card sp-sheet'); cmp.hidden = true; cmp.setAttribute('aria-label', 'Compare sketches'); root.append(cmp);
  const PINK = 'pc-ws-pins', GRPK = 'pc-ws-sheetgroups', THUMB = new Map();
  const pins = () => { try { return new Set(JSON.parse(localStorage.getItem(PINK)) || []); } catch { return new Set(); } }, setPins = (x) => { try { localStorage.setItem(PINK, JSON.stringify([...x])); } catch { } };
  const shut = () => { try { return new Set(JSON.parse(localStorage.getItem(GRPK)) || []); } catch { return new Set(); } }, setShut = (x) => { try { localStorage.setItem(GRPK, JSON.stringify([...x])); } catch { } };
  const figs = (st) => { st = st || {}; const ms = st.masses || [], site = st.site || {}, z = site.terrain?.grid?.z || [];
    return { gfa: ms.reduce((a, m) => a + area(m.points || []) * (m.storeys || 1), 0), fp: ms.reduce((a, m) => a + area(m.points || []), 0), masses: ms.length, storeys: ms.reduce((a, m) => Math.max(a, m.storeys || 1), 0), levels: (st.levels || []).length,
      ctx: (site.buildings || []).filter((b) => !b.excluded).length, relief: z.length ? Math.max(...z) - Math.min(...z) : null, roads: (site.roads || []).length,
      walls: (st.walls || []).length, ops: (st.ops || []).length, furn: (st.furn || []).length, lights: (st.lights || []).length, floors: (st.floors || []).length }; };
  function compareData() {
    const cur = baseline(), vs = p.versions.slice().reverse().slice(0, 8);
    const cols = vs.map((v) => ({ id: v.id, title: v.note || 'v' + v.n, sub: 'v' + v.n, current: v === cur, studio: v.model?.studio, v, thumb: v.thumb || THUMB.get(v.id) }));
    if (!cols.length || dirty()) cols.unshift({ id: 'draft', title: 'Unsaved changes', sub: cur ? 'since v' + cur.n : 'not saved yet', current: true, draft: true, studio: studio(), thumb: THUMB.get('draft') });
    if (cols.some((c) => c.draft)) for (const c of cols) if (!c.draft) c.current = false;
    const N = (v, u = '', d = 0) => (v === null || v === undefined ? '—' : fmt(v, d) + u);
    const G = [['Building', [['Gross floor area', (c) => figs(c.studio).gfa, ' m²'], ['Footprint', (c) => figs(c.studio).fp, ' m²'], ['Masses', (c) => figs(c.studio).masses], ['Tallest mass, storeys', (c) => figs(c.studio).storeys], ['Levels', (c) => figs(c.studio).levels]]],
      ['Site', [['Surrounding buildings', (c) => figs(c.studio).ctx], ['Terrain relief', (c) => figs(c.studio).relief, ' m', 1], ['Roads and paths', (c) => figs(c.studio).roads]]],
      ['Space', [['Rooms', (c) => (c.draft || c.current) && INST.plan.ready ? INST.plan.ws.objects().filter((o) => o.k === 'room').length : null], ['Room area', (c) => (c.draft || c.current) && INST.plan.ready ? INST.plan.ws.objects().filter((o) => o.k === 'room').reduce((a, r) => a + (r.area || 0), 0) : null, ' m²', 1]]],
      ['Element', [['Walls', (c) => figs(c.studio).walls], ['Doors and windows', (c) => figs(c.studio).ops], ['Floor slabs', (c) => figs(c.studio).floors], ['Furniture', (c) => figs(c.studio).furn], ['Lights', (c) => figs(c.studio).lights]]]];
    const notes = [], res = [];
    for (const sim of api.sims) { const runs = p.runs.filter((r) => r.simId === sim.id && r.results); if (!runs.length) continue;
      const last = (c) => c.v ? runs.filter((r) => r.versionId === c.v.id).at(-1) : null;
      const basis = new Set(cols.map(last).filter(Boolean).map((r) => r.settings?.label || r.settings?.dayName || 'full study')); if (basis.size > 1) notes.push(`${sim.name}: the sketches use different settings (${[...basis].join('; ')}), so compare with care.`);
      for (const [key, label, unit, dec] of sim.metrics || []) { const get = (c) => { const r = last(c); return r && Number.isFinite(+r.results[key]) ? +r.results[key] : null; }; if (cols.some((c) => get(c) !== null)) res.push([`${sim.name} · ${label}`, get, unit === '%' ? '%' : ' ' + unit, dec]); } }
    if (res.length) G.push(['Results', res]);
    const P = pins(), pinned = G.flatMap(([, rows]) => rows).filter(([l]) => P.has(l));
    return { cols, groups: [['Pinned', pinned], ...G], notes, N };
  }
  async function drawCompare() {
    const { cols, groups, notes, N } = compareData(), closed = shut(), P = pins(); cmp.style.setProperty('--n', cols.length);
    const head = `<div class="sp-sk-row sp-sk-head"><div class="sp-sk-lab"></div>${cols.map((c) => `<button type="button" class="sp-sk-card${c.current ? ' cur' : ''}" data-sketch="${esc(c.id)}" title="${c.draft ? 'The model as it is now' : 'Open ' + esc(c.sub) + ' in the model'}"><span class="sp-sk-pic">${c.thumb ? `<img src="${c.thumb}" alt="">` : ''}</span><b>${esc(c.title)}</b><small>${c.current ? 'Current' : esc(c.sub)}</small></button>`).join('')}
      <div class="sp-sk-add"><button type="button" class="btn sm primary" id="spAddSketch">Add sketch</button><small>Add sketch to compare metrics</small></div></div>`;
    const body = groups.map(([g, rows]) => `<div class="sp-sk-row sp-sk-grp"><button type="button" class="sp-sk-lab" data-grp="${g}" aria-expanded="${!closed.has(g)}">${g.toUpperCase()} <i>${closed.has(g) ? '›' : '⌄'}</i></button>${cols.map(() => '<div></div>').join('')}</div>`
      + (closed.has(g) ? '' : rows.length ? rows.map(([l, get, u, d]) => `<div class="sp-sk-row"><div class="sp-sk-lab"><button type="button" class="sp-pin${P.has(l) ? ' on' : ''}" data-pin="${esc(l)}" title="${P.has(l) ? 'Unpin' : 'Pin to the top'}" aria-label="${P.has(l) ? 'Unpin' : 'Pin'} ${esc(l)}">${P.has(l) ? '●' : '○'}</button>${esc(l)}</div>${cols.map((c) => `<div class="sp-sk-v${c.current ? ' cur' : ''}">${N(get(c), u || '', d || 0)}</div>`).join('')}</div>`).join('') : g === 'Pinned' ? `<div class="sp-sk-row"><div class="sp-sk-lab sp-sk-empty">Pin a row to keep it here</div></div>` : '')).join('');
    parkSave();   // a redraw must not take the Save version button with it
    cmp.innerHTML = `<div class="sp-sk-grip" aria-hidden="true"></div><button type="button" class="sp-x" data-cmp="close" aria-label="Close Compare sketches">×</button>
      <div class="sp-sk-scroll">${head}${body}${notes.map((n) => `<p class="sp-note">${esc(n)}</p>`).join('')}</div>
      <footer><span class="sp-sk-title">Compare sketches</span><button type="button" class="btn sm" data-cmp="csv" title="A CSV file that Excel opens">Export to Excel</button></footer>`;
    // Add sketch: the current model becomes the next sketch (version) of this project, named Sketch N; nothing else comes along
    const sv = $('#saveV'), note = $('#note'); if (sv && note) { const add = cmp.querySelector('.sp-sk-add'); add.querySelector('#spAddSketch').replaceWith(sv); sv.textContent = 'Add sketch'; sv.classList.add('btn', 'sm', 'primary');
      if (!sv.dataset.spSketch) { sv.dataset.spSketch = '1'; sv.addEventListener('click', () => { if (cmp.contains(sv) && !note.value.trim()) note.value = 'Sketch ' + (p.versions.length + 1); }, true); } }
    // pictures: the model as it is now, once per opening; a version keeps the picture taken when it was added here
    if (INST.persp.ready && INST.persp.ws.thumb) { const key = cols.find((c) => c.current)?.id; if (key && !THUMB.has(key)) { try { const u = await INST.persp.ws.thumb(); if (u) { THUMB.set(key, u); const im = cmp.querySelector(`[data-sketch="${CSS.escape(key)}"] .sp-sk-pic`); if (im) im.innerHTML = `<img src="${u}" alt="">`; } } catch { } } }
  }
  function parkSave() { const sec = app.querySelector('section[data-tab="versions"]'), sv = $('#saveV'), note = $('#note'); if (sec && sv && note && !sec.contains(sv)) { sec.querySelector('#dirty')?.after(note, sv); sv.textContent = 'Save version'; } }
  function openSheet(on) { cmp.hidden = !on; root.classList.toggle('sp-sheet-open', on); if (on) { openCard(false); closePops(); palOpen(false); drawCompare(); } else parkSave(); }
  cmp.addEventListener('click', async (e) => {
    const g = e.target.closest('[data-grp]'), pin = e.target.closest('[data-pin]'), sk = e.target.closest('[data-sketch]'), b = e.target.closest('[data-cmp]');
    if (g) { const x = shut(); x.has(g.dataset.grp) ? x.delete(g.dataset.grp) : x.add(g.dataset.grp); setShut(x); drawCompare(); return; }
    if (pin) { const x = pins(); x.has(pin.dataset.pin) ? x.delete(pin.dataset.pin) : x.add(pin.dataset.pin); setPins(x); drawCompare(); return; }
    if (sk) { if (sk.dataset.sketch === 'draft') return; const ld = app.querySelector(`#versions [data-load="${CSS.escape(sk.dataset.sketch)}"]`); if (ld) { ld.click(); setTimeout(drawCompare, 300); } return; }
    if (!b) return; const k = b.dataset.cmp;
    if (k === 'close') openSheet(false);
    else if (k === 'csv') { const { cols, groups, N } = compareData(), q = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = [['', ...cols.map((c) => `${c.title} (${c.current ? 'current' : c.sub})`)], ...groups.filter(([g]) => g !== 'Pinned').flatMap(([g, rows]) => [[g], ...rows.map(([l, get, u, d]) => [l, ...cols.map((c) => { const v = get(c); return v === null || v === undefined ? '' : +(+v).toFixed(3); })])])].map((r) => r.map(q).join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })); a.download = `${p.name.replace(/[^\w-]+/g, '-')}-compare-sketches.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); } });
  // a sketch added here keeps a picture of the model
  const thumbT = (() => { const n0 = { n: p.versions.length }; return setInterval(() => { if (p.versions.length > n0.n) { const v = p.versions.at(-1); n0.n = p.versions.length; const u = THUMB.get('draft') || THUMB.get(v.id); if (u && !v.thumb) { v.thumb = u; S.save(); } THUMB.delete('draft'); if (!cmp.hidden) drawCompare(); } }, 500); })();

  // ---- assets (left rail): the models imported into this project and your own furniture, each with its import
  const assetsCard = el('section', 'sp-card sp-assets'); assetsCard.hidden = true; assetsCard.setAttribute('aria-label', 'Assets'); root.append(assetsCard);
  function drawAssets() {
    const ims = (studio()?.imports || []).filter((o) => !o.ref), mine = S.account().furniture || [];
    assetsCard.innerHTML = `<button type="button" class="sp-x" data-as="close" aria-label="Close assets">×</button>
      <section><h3>Imported models</h3>${ims.length ? `<ul class="sp-aslist">${ims.map((o) => `<li><button type="button" data-as-sel="${esc(o.id)}" title="Select it in the model"><b>${esc(o.name)}</b><small>${esc(o.layer || 'Imported')} · ${fmt(o.tris || 0)} triangles</small></button></li>`).join('')}</ul>`
        : '<div class="sp-asempty"><b>No imported models</b><p>Import OBJ, STL, GLB/glTF or 3DM files. You choose whether a file joins this project or starts a new one.</p></div>'}
        <button type="button" class="btn sm primary sp-asbtn" data-as="model">+ Import model</button></section>
      <section><h3>My furniture</h3>${mine.length ? `<div class="sp-asgrid">${mine.slice(0, 12).map((x) => `<figure title="${esc(x.name)} · ${x.w} × ${x.d} × ${x.h} m">${x.thumb ? `<img src="${x.thumb}" alt="">` : ''}<figcaption>${esc(x.name)}</figcaption></figure>`).join('')}</div><p class="sp-note">${mine.length} piece${mine.length === 1 ? '' : 's'} in your account, for every project. Place them from Furniture in the bottom bar.</p>`
        : '<div class="sp-asempty"><b>No furniture of your own yet</b><p>Import a piece (OBJ, GLB, STL, 3DM); it is kept in your account for every project.</p></div>'}
        <button type="button" class="btn sm primary sp-asbtn" data-as="furn">+ Import furniture</button></section>`;
  }
  function openAssets(on) { assetsCard.hidden = !on; $('[data-sp="assets"]', root)?.setAttribute('aria-pressed', String(on)); if (on) { openCard(false); closePops(); palOpen(false); if (!cmp.hidden) openSheet(false); drawAssets(); } }
  assetsCard.addEventListener('click', (e) => { const b = e.target.closest('[data-as],[data-as-sel]'); if (!b) return;
    if (b.dataset.asSel) { select(['ps:imp:' + b.dataset.asSel]); return; }
    const k = b.dataset.as; if (k === 'close') openAssets(false);
    else if (k === 'model') { openAssets(false); openProject('import'); }
    else if (k === 'furn') { openAssets(false); UI.acc.furniture = 0; saveUI(); if (!(UI.panel === 'furniture' && root.classList.contains('sp-pal-open'))) app.querySelector('.sp-tools [data-panel="furniture"]')?.click(); setTimeout(() => app.querySelector('#panelBody [data-impfurn]')?.click(), 60); } });

  // ---- project props (bottom left): the one place for the project's shared parameters
  const propsCard = el('section', 'sp-card sp-propscard'); propsCard.hidden = true; propsCard.setAttribute('aria-label', 'Project props'); root.append(propsCard);
  let disposeProps = null;
  const propCounts = () => { const st = studio() || {}, o = INST.plan.ready ? INST.plan.ws.objects() : []; const c = (k) => o.filter((x) => x.k === k).length;
    return { plot: st.site?.parcel?.pts?.length > 2 ? 1 : 0, building: (st.masses || []).length + (st.imports || []).length, story: (st.levels || []).length, space: c('room'), aperture: c('op'), wall: c('wall'), floor: c('floor'), furniture: c('furn'), context: (st.site?.buildings || []).filter((b) => !b.excluded).length, street: (st.site?.roads || []).length }; };
  function openProps(on) { propsCard.hidden = !on; $('[data-sp="props"]', root)?.setAttribute('aria-pressed', String(on)); disposeProps?.(); disposeProps = null;
    if (on) { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); openCard(false); closePops(); palOpen(false); if (!cmp.hidden) openSheet(false); studyCard.hidden = true; disposeProps = mountProps(propsCard, p, { counts: propCounts, onClose: () => openProps(false) }); } else if (ST.id) studyCard.hidden = false; }
  window.__wsProps = () => openProps(true);   // studies and the site review open these props while in the Workspace
  // links to the old project settings page (studies, the site review) open the props here instead
  app.addEventListener('click', (e) => { const a = e.target.closest('a[href^="#/project-settings"], #siteReviewEdit'); if (!a) return; e.preventDefault(); e.stopImmediatePropagation(); openProps(true); }, true);

  // ---- what changes while working: 2D / 3D label, saved state, undo / redo, sun after the 3D view rebuilds
  let sunOnce = false;
  const tick = () => {
    $('[data-sp="dim"]', right).textContent = UI.view === 'plan' ? '2D' : '3D';
    const d = dirty(), v = baseline();
    const saved = $('.sp-saved', tr); saved.dataset.state = d ? 'dirty' : 'saved'; saved.title = d ? 'Unsaved changes: save a version' : `Saved${v ? ' · v' + v.n : ''}`;
    $('#spSub', tl).textContent = `${v ? 'v' + v.n : 'No version yet'}${d ? ' · unsaved changes' : ''}`;
    if (!sunOnce && INST.persp.ready && sunState().on) { sunOnce = true; applySun(); }
    if (ST.res && INST.persp.ready) { const st = INST.persp.ws.model() !== ST.key; if (st !== staleShown) { staleShown = st; drawStudy(); } }
  };
  const timer = setInterval(tick, 400); tick();
  window.__wsStudy = { open: openStudy, run: runStudy, state: () => ({ ...ST, res: ST.res && { ...ST.res } }) };   // for the browser checks
  return () => { disposeProps?.(); delete window.__wsProps; closeHost(); clearInterval(timer); clearInterval(thumbT); document.removeEventListener('click', away); if (window.__wsStudy) delete window.__wsStudy; if (window.__wsHost) delete window.__wsHost; };
}
