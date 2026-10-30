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
  tr.innerHTML = `<button type="button" class="sp-b sp-saved" data-sp="saved" title="Versions" aria-label="Versions">${I(P.check)}</button><span class="sp-sep"></span>${btn('undo', 'Undo (Ctrl+Z)', 'undo')}${btn('redo', 'Redo (Ctrl+Y)', 'redo')}<span class="sp-sep"></span>${btn('export', 'Export model', 'download')}${btn('import', 'Import model', 'upload')}`;
  tr.append($('#sendSim')); root.append(tr);

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
  const edit = $('.wb-edit');
  for (const [k, icon, label] of [['select', 'select', 'Select (Esc)'], ['text', 'text', 'Text label (T)'], ['delete', 'del', 'Delete (Del)']]) {
    const proxy = el('button', 'sp-b', I(P[icon])); proxy.type = 'button'; proxy.dataset.spCmd = k; proxy.title = label; proxy.setAttribute('aria-label', label);
    proxy.onclick = () => edit?.querySelector(`[data-command="${k}"]`)?.click(); tools.append(proxy);
  }
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

  function openCard(on) { root.classList.toggle('sp-card-open', on); if (on) closePops(); }
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
    else if (k === 'undo' || k === 'redo') edit?.querySelector(`[data-command="${k}"]`)?.click();
    else if (k === 'export') openProject('export');
    else if (k === 'import') openProject('import');
    else if (k === 'dim') goView(UI.view === 'plan' ? 'persp' : 'plan');
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

  // ---- what changes while working: 2D / 3D label, saved state, undo / redo, sun after the 3D view rebuilds
  let sunOnce = false;
  const tick = () => {
    $('[data-sp="dim"]', right).textContent = UI.view === 'plan' ? '2D' : '3D';
    const d = dirty(), v = baseline();
    const saved = $('.sp-saved', tr); saved.dataset.state = d ? 'dirty' : 'saved'; saved.title = d ? 'Unsaved changes: save a version' : `Saved${v ? ' · v' + v.n : ''}`;
    $('#spSub', tl).textContent = `${v ? 'v' + v.n : 'No version yet'}${d ? ' · unsaved changes' : ''}`;
    for (const k of ['undo', 'redo']) { const o = edit?.querySelector(`[data-command="${k}"]`); $(`[data-sp="${k}"]`, tr).disabled = !o || o.disabled; }
    const t = edit?.querySelector('[data-command="select"]'); $('[data-sp-cmd="select"]', tools)?.setAttribute('aria-pressed', t?.getAttribute('aria-pressed') || 'false');
    if (!sunOnce && INST.persp.ready && sunState().on) { sunOnce = true; applySun(); }
  };
  const timer = setInterval(tick, 400); tick();
  return () => { clearInterval(timer); document.removeEventListener('click', away); };
}
