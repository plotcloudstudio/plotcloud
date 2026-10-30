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
import { mountProps } from './project-props.js?v=props-20261030-2';

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
  function openCard(on) { root.classList.toggle('sp-card-open', on); if (on) { closePops(); if (!cmp.hidden) openSheet(false); } const sc = app.querySelector('.sp-studycard'); if (sc) sc.hidden = on || !ST.id; }
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
  const palOpen = (on, project = false) => { root.classList.toggle('sp-pal-open', on); root.classList.toggle('sp-pal-project', on && project); };
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

  // ---- studies in this view (2026-10-30): Add simulation opens a study panel over the model; Sun hours runs here and draws on the
  // ground in 3D. The other studies keep their own page for now; their panel says so and opens it (with the version handoff).
  const IN_VIEW = { sunhours: true }, DAYS = [['03-21', '21 March'], ['06-21', '21 June'], ['12-21', '21 December']];
  const studyCard = el('section', 'sp-card sp-studycard'); studyCard.hidden = true; studyCard.setAttribute('aria-label', 'Simulation');
  const legend = el('div', 'sp-card sp-legend'); legend.hidden = true; root.append(studyCard, legend);
  const ST = { id: null, tab: 'results', day: '03-21', res: null, key: '', at: null, busy: false, err: '' };
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
  function openStudy(id) { if (!IN_VIEW[id]) { closeStudy(); openPage(id); return; } closeHost(); if (ST.id !== id && ST.res && INST.persp.ready) INST.persp.ws.clearStudy?.(); if (ST.id !== id) Object.assign(ST, { id, res: null, key: '', at: null, err: '', tab: IN_VIEW[id] ? 'settings' : 'results' }); openCard(false); closePops(); palOpen(false); studyCard.hidden = false; drawStudy(); }
  function closeStudy() { studyCard.hidden = true; legend.hidden = true; ST.id = null; ST.res = null; if (INST.persp.ready) INST.persp.ws.clearStudy?.(); }
  function openPage(id) { const sel = $('#workspaceStudy'); if (sel) { sel.value = id; sel.onchange?.(); } $('#sendSim')?.click(); }
  async function runStudy() {
    ST.busy = true; ST.err = ''; drawStudy();
    try { if (UI.view === 'plan') await goView('persp'); for (let i = 0; i < 80 && !INST.persp.ready; i++) await new Promise((r) => setTimeout(r, 100));
      await new Promise((r) => setTimeout(r, 30)); const w = INST.persp.ws; ST.res = w.sunStudy({ day: ST.day }); ST.key = w.model(); ST.saved = ''; ST.at = new Date(); ST.tab = 'results'; }
    catch (e) { ST.err = e.message || String(e); ST.res = null; }
    ST.busy = false; drawStudy();
  }
  // a result is kept with the saved version it was computed on: unsaved edits are saved as a version first
  async function saveStudy() {
    if (!ST.res || ST.busy) return; ST.busy = true; drawStudy();
    try { if (dirty()) { const before = baseline()?.id; $('#saveV')?.click(); for (let i = 0; i < 100 && baseline()?.id === before; i++) await new Promise((r) => setTimeout(r, 100)); if (baseline()?.id === before) throw Error('The version could not be saved.'); }
      const v = baseline(), r = ST.res; if (!v) throw Error('Save a version first.');
      S.addRun(p, v.id, ST.id, { day: ST.day, dayName: r.dayName, method: 'workspace-ground', cell: r.cell, label: `Ground, ${r.dayName} (Workspace)` }, { ground: +r.avg.toFixed(2), ground2h: +(r.two * 100).toFixed(1), min: r.min, max: r.max, dayLength: r.dayLength, cells: r.cells, area: r.area, computedAt: ST.at.toISOString() }, 'workspace');
      ST.saved = 'v' + v.n; ST.key = INST.persp.ws.model(); }
    catch (e) { ST.err = e.message; }
    ST.busy = false; drawStudy(); if (!cmp.hidden) drawCompare();
  }
  function drawStudy() {
    if (!ST.id) return; const id = ST.id, name = simName(id), inView = !!IN_VIEW[id], r = ST.res;
    const stale = r && INST.persp.ready && INST.persp.ws.model() !== ST.key;
    const status = ST.busy ? ['run', 'Running…'] : ST.err ? ['err', ST.err] : !r ? ['idle', inView ? 'Not run yet' : 'Runs on its own page for now'] : stale ? ['stale', 'The model changed after this result: run again'] : ['ok', `Up to date · ${ST.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${r.dayName}`];
    const kv = (k, v) => `<div class="sp-kv"><span>${k}</span><b>${v}</b></div>`;
    studyCard.innerHTML = `<header><b>${esc(name)}</b><button type="button" class="sp-x" data-st="close" aria-label="Close ${esc(name)}">×</button></header>
      <p class="sp-status" data-state="${status[0]}">${esc(status[1])}</p>
      ${inView ? `<div class="sp-tabs" role="tablist"><button type="button" role="tab" data-st-tab="results" aria-selected="${ST.tab === 'results'}">Results</button><button type="button" role="tab" data-st-tab="settings" aria-selected="${ST.tab === 'settings'}">Settings</button></div>` : ''}
      <div class="sp-stbody">${!inView ? `<p class="sp-note">${esc(name)} does not run inside the Workspace yet. Open it on its own page: the current model is saved as a version first, and you come back here afterwards.</p><button type="button" class="btn sm primary" data-st="page">Open ${esc(name)}</button>`
        : ST.tab === 'settings' ? `<label class="sp-field">Day<select data-st="day">${DAYS.map(([k, n]) => `<option value="${k}" ${k === ST.day ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <p class="sp-note">Location, time zone and true north come from the project site. Shading: masses, the building (walls, and each room as a box up to its ceiling) and the surrounding buildings, on the terrain.</p>
          <button type="button" class="btn sm primary sp-run" data-st="run" ${ST.busy ? 'disabled' : ''}>${ST.busy ? 'Running…' : r ? 'Run again' : 'Run analysis'}</button>
          <button type="button" class="btn sm" data-st="page" title="The full study: roofs and facades, the whole year, export">Open the full study</button>`
        : r ? `${kv('Average on the ground', fmt(r.avg, 1) + ' h')}${kv('Range', fmt(r.min, 1) + '–' + fmt(r.max, 1) + ' h')}${kv('Ground with ≥ 2 h of sun', fmt(r.two * 100) + '%')}${r.plot ? kv('Plot with ≥ 2 h of sun', fmt(r.plot.two * 100) + '%') : ''}${kv('Day length', fmt(r.dayLength, 1) + ' h')}
          <h4>How this was found</h4><p class="sp-note">Sun directions through ${esc(r.dayName)} at the site; each ${fmt(r.cell, 1)} m ground cell (${fmt(r.cells)} cells, ${fmt(r.area)} m²) counts the time it sees the sun past ${fmt(r.prisms)} building parts and ${fmt(r.context)} surrounding buildings${r.terrain ? ', on the terrain' : ''}. ${fmt(r.ms)} ms in this browser. A design check for early massing, not a compliance result. ${ST.saved ? '' : 'Not saved yet: Save to results keeps it with a saved version of the model.'}</p>
          ${ST.saved ? `<p class="sp-note">Saved to results with ${esc(ST.saved)}.</p>` : `<button type="button" class="btn sm primary" data-st="save" ${stale || ST.busy ? 'disabled' : ''}>Save to results</button>`} <button type="button" class="btn sm" data-st="clear">Clear from view</button> <button type="button" class="btn sm" data-st="page">Open the full study</button>`
        : `<p class="sp-note">Choose the day in Settings, then run.</p><button type="button" class="btn sm primary" data-st="run">Run analysis</button>`}</div>`;
    legend.hidden = !(inView && r); if (r) legend.innerHTML = `<b>Sun hours</b><div class="sp-ramp" style="background:linear-gradient(to top,${[0, .2, .4, .6, .8, 1].map((t) => INST.persp.ws?.sunRamp?.(t) || '#999').join(',')})"></div><div class="sp-rampl"><span>${r.scale} h</span><span>${fmt(r.scale / 2, 1)} h</span><span>0 h</span></div>`;
  }
  studyCard.addEventListener('click', (e) => { const b = e.target.closest('[data-st],[data-st-tab]'); if (!b) return;
    if (b.dataset.stTab) { ST.tab = b.dataset.stTab; drawStudy(); return; }
    const k = b.dataset.st; if (k === 'save') saveStudy(); else if (k === 'close') closeStudy(); else if (k === 'run') runStudy(); else if (k === 'page') openPage(ST.id); else if (k === 'clear') { if (INST.persp.ready) INST.persp.ws.clearStudy(); ST.res = null; drawStudy(); } });
  studyCard.addEventListener('change', (e) => { if (e.target.dataset.st === 'day') { ST.day = e.target.value; drawStudy(); } });
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
    cmp.innerHTML = `<div class="sp-sk-grip" aria-hidden="true"></div><button type="button" class="sp-x" data-cmp="close" aria-label="Close Compare sketches">×</button>
      <div class="sp-sk-scroll">${head}${body}${notes.map((n) => `<p class="sp-note">${esc(n)}</p>`).join('')}</div>
      <footer><span class="sp-sk-title">Compare sketches</span><button type="button" class="btn sm" data-cmp="csv" title="A CSV file that Excel opens">Export to Excel</button></footer>`;
    const sv = $('#saveV'), note = $('#note'); if (sv && note) { const add = cmp.querySelector('.sp-sk-add'); note.placeholder = 'Sketch name'; add.prepend(note); add.querySelector('#spAddSketch').replaceWith(sv); sv.textContent = 'Add sketch'; sv.classList.add('btn', 'sm', 'primary'); }
    // pictures: the model as it is now, once per opening; a version keeps the picture taken when it was added here
    if (INST.persp.ready && INST.persp.ws.thumb) { const key = cols.find((c) => c.current)?.id; if (key && !THUMB.has(key)) { try { const u = await INST.persp.ws.thumb(); if (u) { THUMB.set(key, u); const im = cmp.querySelector(`[data-sketch="${CSS.escape(key)}"] .sp-sk-pic`); if (im) im.innerHTML = `<img src="${u}" alt="">`; } } catch { } } }
  }
  function openSheet(on) { cmp.hidden = !on; root.classList.toggle('sp-sheet-open', on); if (on) { openCard(false); closePops(); palOpen(false); drawCompare(); } else { const sec = app.querySelector('section[data-tab="versions"]'); const sv = $('#saveV'), note = $('#note'); if (sec && sv && note && !sec.contains(sv)) { sec.querySelector('#dirty')?.after(note, sv); sv.textContent = 'Save version'; } } }
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

  // ---- project props (bottom left): the one place for the project's shared parameters
  const propsCard = el('section', 'sp-card sp-propscard'); propsCard.hidden = true; propsCard.setAttribute('aria-label', 'Project props'); root.append(propsCard);
  let disposeProps = null;
  const propCounts = () => { const st = studio() || {}, o = INST.plan.ready ? INST.plan.ws.objects() : []; const c = (k) => o.filter((x) => x.k === k).length;
    return { plot: st.site?.parcel?.pts?.length > 2 ? 1 : 0, building: (st.masses || []).length + (st.imports || []).length, story: (st.levels || []).length, space: c('room'), aperture: c('op'), wall: c('wall'), floor: c('floor'), furniture: c('furn'), context: (st.site?.buildings || []).filter((b) => !b.excluded).length, street: (st.site?.roads || []).length }; };
  function openProps(on) { propsCard.hidden = !on; $('[data-sp="props"]', root)?.setAttribute('aria-pressed', String(on)); disposeProps?.(); disposeProps = null;
    if (on) { openCard(false); closePops(); palOpen(false); if (!cmp.hidden) openSheet(false); studyCard.hidden = true; disposeProps = mountProps(propsCard, p, { counts: propCounts, onClose: () => openProps(false) }); } else if (ST.id) studyCard.hidden = false; }
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
