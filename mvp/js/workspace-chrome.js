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
  const keep = el('div', 'sp-keep'); keep.hidden = true; keep.append(...[$('#workspaceStudy'), $('#sendSim')].filter(Boolean)); root.append(tr, keep);

  // ---- left rail: statistics, the panels, spaces; Add simulation on its own below
  const left = el('nav', 'sp-rail sp-left'); left.setAttribute('aria-label', 'Panels');
  left.innerHTML = btn('stats', 'Statistics', 'stats', 'aria-pressed="false"');
  const tabList = $('#tabList'); left.append(tabList);
  left.insertAdjacentHTML('beforeend', btn('spaces', 'Spaces', 'spaces', 'aria-pressed="false"'));
  left.insertAdjacentHTML('beforeend', btn('compare', 'Results and compare: versions side by side', 'results', 'aria-pressed="false"'));
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
  bl.append(projBtn); bl.insertAdjacentHTML('beforeend', `<div class="sp-blt"><b>Project</b><span>${esc(S.siteOf(p)?.label?.split(',').slice(0, 2).join(',') || 'No site yet')}</span></div>`);
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
  function openCard(on) { root.classList.toggle('sp-card-open', on); if (on) closePops(); const sc = app.querySelector('.sp-studycard'); if (sc) sc.hidden = on || !ST.id; }
  let lastTab = UI.tab;
  tabList.addEventListener('click', (e) => { const t = e.target.closest('[data-tab]'); if (!t) return;
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
    else if (k === 'compare') { cmp.hidden = !cmp.hidden; b.setAttribute('aria-pressed', String(!cmp.hidden)); if (!cmp.hidden) drawCompare(); }
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
  if (simMenu) { simMenu.querySelectorAll('[data-addsim]').forEach((b) => { if (IN_VIEW[b.dataset.addsim]) b.insertAdjacentHTML('beforeend', ' <small class="sp-inview">in view</small>'); });
    simMenu.addEventListener('click', (e) => { const b = e.target.closest('[data-addsim]'); if (!b) return; e.stopImmediatePropagation(); simMenu.hidden = true; $('#addSimBtn')?.setAttribute('aria-expanded', 'false'); openStudy(b.dataset.addsim); }, true); }
  const simName = (id) => (api.sims.find((x) => x.id === id) || { name: id }).name;
  function openStudy(id) { if (ST.id !== id && ST.res && INST.persp.ready) INST.persp.ws.clearStudy?.(); if (ST.id !== id) Object.assign(ST, { id, res: null, key: '', at: null, err: '', tab: IN_VIEW[id] ? 'settings' : 'results' }); openCard(false); closePops(); palOpen(false); studyCard.hidden = false; drawStudy(); }
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
          <button type="button" class="btn sm primary sp-run" data-st="run" ${ST.busy ? 'disabled' : ''}>${ST.busy ? 'Running…' : r ? 'Run again' : 'Run analysis'}</button>`
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

  // ---- results and compare (2026-10-30), on the right: each saved version a column (newest first) and the current model; rows are
  // the model's own figures and each study's saved results for that version. Values are read from the versions and saved runs.
  const cmp = el('section', 'sp-card sp-compare'); cmp.hidden = true; cmp.setAttribute('aria-label', 'Results and compare'); root.append(cmp);
  const figs = (st) => { st = st || {}; const ms = st.masses || []; return { gfa: ms.reduce((a, m) => a + area(m.points || []) * (m.storeys || 1), 0), fp: ms.reduce((a, m) => a + area(m.points || []), 0), masses: ms.length, levels: (st.levels || []).length, walls: (st.walls || []).length, ops: (st.ops || []).length, furn: (st.furn || []).length }; };
  function compareData() {
    const vs = p.versions.slice().reverse().slice(0, 4), cur = { id: 'current', title: 'Current', sub: dirty() ? 'unsaved changes' : 'same as v' + (baseline()?.n ?? ''), studio: studio() };
    const cols = [cur, ...vs.map((v) => ({ id: v.id, title: 'v' + v.n, sub: v.note || new Date(v.created || v.at || Date.now()).toLocaleDateString(), studio: v.model?.studio, v }))];
    const rows = [['Model', null], ['Gross floor area (masses)', (c) => fmt(figs(c.studio).gfa) + ' m²', (c) => figs(c.studio).gfa], ['Footprint (masses)', (c) => fmt(figs(c.studio).fp) + ' m²', (c) => figs(c.studio).fp], ['Masses', (c) => figs(c.studio).masses], ['Levels', (c) => figs(c.studio).levels], ['Walls', (c) => figs(c.studio).walls], ['Doors and windows', (c) => figs(c.studio).ops], ['Furniture', (c) => figs(c.studio).furn]];
    const notes = [];
    for (const sim of api.sims) {
      const runs = p.runs.filter((r) => r.simId === sim.id && r.results); const live = sim.id === ST.id && ST.res && !(INST.persp.ready && INST.persp.ws.model() !== ST.key);
      if (!runs.length && !live) continue;
      const last = (c) => c.v ? runs.filter((r) => r.versionId === c.v.id).at(-1) : null;
      const basis = new Set(cols.map((c) => last(c)).filter(Boolean).map((r) => r.settings?.label || r.settings?.dayName || 'full study'));
      if (basis.size > 1) notes.push(`${sim.name}: the columns use different settings (${[...basis].join('; ')}), so compare them with care.`);
      rows.push([sim.name, null]);
      for (const [key, label, unit, dec] of sim.metrics || []) {
        const val = (c) => { if (c.id === 'current') { if (!live) return null; const r = ST.res; return key === 'ground' ? r.avg : key === 'ground2h' ? r.two * 100 : null; } const r = last(c); return r && Number.isFinite(+r.results[key]) ? +r.results[key] : null; };
        if (!cols.some((c) => val(c) !== null)) continue;
        rows.push([label, (c) => { const v = val(c); return v === null ? '—' : fmt(v, dec) + (unit === '%' ? '%' : ' ' + unit); }, val]);
      }
    }
    return { cols, rows, notes };
  }
  function drawCompare() {
    const { cols, rows, notes } = compareData();
    cmp.innerHTML = `<header><b>Results and compare</b><button type="button" class="sp-x" data-cmp="close" aria-label="Close">×</button></header>
      <div class="sp-cmpwrap"><table class="sp-cmp"><thead><tr><th></th>${cols.map((c) => `<th><b>${esc(c.title)}</b><small>${esc(c.sub)}</small></th>`).join('')}</tr></thead>
      <tbody>${rows.map(([label, show]) => show ? `<tr><td>${esc(label)}</td>${cols.map((c) => `<td>${esc(String(show(c)))}</td>`).join('')}</tr>` : `<tr class="sp-cmph"><td colspan="${cols.length + 1}">${esc(label)}</td></tr>`).join('')}</tbody></table></div>
      ${notes.map((n) => `<p class="sp-note">${esc(n)}</p>`).join('')}${p.runs.length ? '' : '<p class="sp-note">No saved results yet. Add a simulation (+ on the left), run it and choose Save to results.</p>'}
      <footer><button type="button" class="btn sm primary" data-cmp="version">Add version</button><button type="button" class="btn sm" data-cmp="csv">Export CSV</button><a class="btn sm" href="#/project/${esc(p.id)}">Report and exports</a></footer>`;
  }
  cmp.addEventListener('click', async (e) => { const b = e.target.closest('[data-cmp]'); if (!b) return; const k = b.dataset.cmp;
    if (k === 'close') { cmp.hidden = true; $('[data-sp="compare"]', left)?.setAttribute('aria-pressed', 'false'); }
    else if (k === 'version') { if (!dirty()) { b.textContent = 'No changes since v' + (baseline()?.n ?? ''); setTimeout(drawCompare, 1600); return; } const before = baseline()?.id; $('#saveV')?.click(); for (let i = 0; i < 100 && baseline()?.id === before; i++) await new Promise((r) => setTimeout(r, 100)); drawCompare(); }
    else if (k === 'csv') { const { cols, rows } = compareData(), q = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = [['', ...cols.map((c) => `${c.title} ${c.sub}`)], ...rows.map(([label, show, val]) => show ? [label, ...cols.map((c) => { const v = val ? val(c) : show(c); return v === null || v === undefined ? '' : typeof v === 'number' ? +v.toFixed(3) : v; })] : [label])].map((r) => r.map(q).join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `${p.name.replace(/[^\w-]+/g, '-')}-compare.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); } });

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
  return () => { clearInterval(timer); document.removeEventListener('click', away); if (window.__wsStudy) delete window.__wsStudy; };
}
