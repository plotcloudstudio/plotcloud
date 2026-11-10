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
import {plannedStudy} from './planned-simulations.js';
import { climateFile, ensureProjectClimate } from './project-climate.js';
import { weatherDownloadAvailable } from './automatic-climate.js?v=epw-connected-20261027-3';
import { sunPosition } from './environment/analysis.js?v=run-20261031-2';
import * as CL from '../../emb/lib/climate.js';
import { speedRatio } from './wind-lbm.js?v=wind-20261031-5';
import { stormwater } from './stormwater-grid.js?v=water-20261106-1';
import * as WTRL from '../../emb/lib/water.js?v=water-20261106-1';
import { canUse } from './beta-access.js';
import * as CIRC from './circulation-engine.js?v=circ-20261031-1';
import * as PRIV from './interior/privacy.js?v=priv-20261031-2';
import * as WAY from './interior/wayfinding.js?v=way-20261031-2';
import * as SSX from './interior/spacesyntax.js?v=ss-20261101-1';
import * as ISO from './interior/isovist.js?v=iso-20261101-1';
import * as VWS from './interior/views.js?v=vw-20261101-1';
import * as CAMS from './interior/cameras.js?v=cam-20261101-1';
import * as DAY from './interior/daylight.js?v=day-20261110-1';
import { daylightInputs, daylightRecord } from './daylight-run.js?v=day-20261110-1';
import * as EGX from './interior/egress.js?v=eg-20261109-1';
import * as ACU from './interior/acoustics.js?v=acu-20261106-1';
import { keep as PKEEP } from '../../emb/lib/plansim.js?v=1';
import { mountProps } from './project-props.js?v=grids-20261101-1';

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
  section: '<path d="M6.4 13h2.2M11 13h2M15.4 13h2.2"/><circle cx="4" cy="13" r="2.3"/><circle cx="20" cy="13" r="2.3"/><path d="M4 10.7V5.5M20 10.7V5.5"/><path d="M2.3 7.6L4 5.2l1.7 2.4zM18.3 7.6L20 5.2l1.7 2.4z" fill="currentColor"/>',
  xlist: '<path d="M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v14l-3-2-3 2-3-2-3 2V6A1.5 1.5 0 0 1 7 4.5z"/><path d="M9.5 9h5M9.5 12h5M9.5 15h3"/>',
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
  vBtn: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><path d="M12 8l4 2v4l-4 2-4-2v-4z"/><path d="M8 10l4 2 4-2M12 12v4"/>',
  dBtn: '<path d="M12 3.5l8 4.5v8l-8 4.5-8-4.5V8z"/><path d="M12 12.5L20 8M12 12.5L4 8M12 12.5v8"/>',
  tabGear: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10.5 21l2-6 3 3v3M8.5 12.5l2.5-5 4 1.2 2 3.8M12.8 8.5l-1.3 5"/>',
};
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const area = (pts) => Math.abs(pts.reduce((a, q, i) => { const r = pts[(i + 1) % pts.length]; return a + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
const fmt = (n, d = 0) => Number(n || 0).toLocaleString('en', { maximumFractionDigits: d, minimumFractionDigits: d });
const DOY0 = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334], MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function mountChrome(app, api) {
  const { p, UI, saveUI, goView, activePane, dirty, baseline, select, studio, INST, sectionView } = api;
  const $ = (s, r = app) => r.querySelector(s), root = $('.w2');
  root.classList.add('sp');
  let KEEP = null; const keepEl = () => { if (!KEEP) { KEEP = document.createElement('div'); KEEP.className = 'sp-keep'; KEEP.hidden = true; root.append(KEEP); } return KEEP; };   // controls kept for their behaviour, not shown
  const el = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; };
  const btn = (key, label, icon, extra = '') => `<button type="button" class="sp-b" data-sp="${key}" title="${label}" aria-label="${label}" ${extra}>${I(P[icon] || icon)}</button>`;
  for (const [id, d] of Object.entries(MASK)) { const b = $('#' + id); if (b) { b.classList.add('sp-mask'); b.style.setProperty('--ic', svgURL(d)); } }

  // ---- top left: project name (switch projects) and the level pill
  const tl = el('div', 'sp-tl');
  tl.innerHTML = `<div class="sp-card sp-proj sp-menuwrap"><button type="button" class="sp-pname" aria-haspopup="menu" aria-expanded="false"><span class="sp-pn">${esc(p.name)}</span><small id="spSub"></small>${I(P.chevron, 14)}</button>
    <div class="w2-menu sp-pmenu" role="menu" hidden>${S.projects().filter((x) => !x.archived).slice(0, 12).map((x) => `<a role="menuitem" href="#/workspace/${x.id}" ${x.id === p.id ? 'aria-current="page"' : ''}>${esc(x.name)}</a>`).join('')}<hr><button type="button" role="menuitem" data-sp="terrain">Site &amp; terrain</button><a role="menuitem" href="#/home">All projects</a><a role="menuitem" href="#/new-project">New project</a></div></div>`;
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
  // back to the Dashboard (2026-11-01): the last button on the right; the project is kept as it is (unsaved changes stay in the draft)
  tr.insertAdjacentHTML('beforeend', `<span class="sp-sep"></span><a class="sp-b sp-home" href="#/home" title="Dashboard: all projects" aria-label="Back to the Dashboard"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/></svg></a>`);
  // Send to Simulation is gone from view (2026-10-30): studies open in this view from Add simulation. The button and its study
  // picker stay, hidden, because a study that does not run here yet opens its own page through them (the version handoff)
  const keep = keepEl(); keep.append(...[$('#workspaceStudy'), $('#sendSim')].filter(Boolean)); root.append(tr);

  // ---- left rail: statistics, the panels, spaces; Add simulation on its own below
  const left = el('nav', 'sp-rail sp-left'); left.setAttribute('aria-label', 'Panels');
  left.innerHTML = btn('stats', 'Statistics', 'stats', 'aria-pressed="false"');
  const tabList = $('#tabList'); left.append(tabList);
  left.insertAdjacentHTML('beforeend', btn('assets', 'Assets: imported models and your furniture', 'assets', 'aria-pressed="false"'));
  left.insertAdjacentHTML('beforeend', btn('spaces', 'Spaces', 'spaces', 'aria-pressed="false"'));
  const add = el('div', 'sp-rail sp-add'); add.append($('#addSimBtn'), $('#addSimInt'));
  add.insertAdjacentHTML('beforeend', `<span class="sp-hr"></span><button type="button" class="sp-b sp-xlb" data-sp="xl" title="Export list: the views, series and sections for the report" aria-label="Export list" aria-pressed="false">${I(P.xlist)}<i class="sp-badge" hidden></i></button>`);
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
  right.innerHTML = `<button type="button" class="sp-b sp-dim" data-sp="dim" title="Switch between plan (2D) and 3D" aria-label="Switch between plan and 3D">3D</button>`;
  keepEl().append($('#fit'));   // Fit and Zoom selected live in the View panel (2026-11-01); the button stays for its behaviour
  const wrap = (node) => { const w = node.closest('div') || node; w.classList.add('sp-menuwrap'); right.append(w); };
  const gear = $('.w3-gearw'); wrap($('#vBtn')); gear.classList.add('sp-menuwrap'); right.append(gear);
  right.insertAdjacentHTML('beforeend', `<span class="sp-hr"></span>${btn('sec', 'Section', 'section', 'aria-pressed="false"')}${btn('sun', 'Sun position', 'sun', 'aria-pressed="false"')}${btn('snap', 'Snapping', 'snap', 'aria-pressed="false"')}${btn('vis', 'Visibility', 'eye', 'aria-pressed="false"')}`);
  wrap($('#dBtn'));
  root.append(right);
  $('#vBtn').title = 'View: plan, perspective, isometric, zoom and fit'; $('#dBtn').title = 'Display mode'; $('#fit').title = 'Fit the model'; $('#tabGear').title = 'Walkthrough, explode, interior elevation';

  // ---- floating cards: the panels card (from the left rail), popovers (from the right rail), statistics and spaces
  const card = $('.w2-right'); card.classList.add('sp-card', 'sp-panelcard'); card.insertAdjacentHTML('afterbegin', '<button type="button" class="sp-x" aria-label="Close panel" title="Close">×</button>');
  card.querySelector('.sp-x').onclick = () => openCard(false);
  const pops = {};
  for (const k of ['stats', 'spaces', 'q', 'xl', 'sec', 'sun', 'snap', 'vis']) { const c = el('section', `sp-card sp-pop sp-pop-${k}`); c.hidden = true; c.dataset.pop = k; root.append(c); pops[k] = c; }
  pops.sec.style.right = '60px'; pops.q.style.left = '60px'; pops.q.style.width = '280px'; pops.xl.style.left = '60px'; pops.xl.style.width = '340px';
  const status = $('.w2-status'); pops.snap.innerHTML = '<h3>Snapping</h3>'; pops.snap.append(status);

  // the panels card and a study panel share the left side: the card covers the study panel while it is open
  function openCard(on) { root.classList.toggle('sp-card-open', on); if (on) { closePops(); if (!cmp.hidden) openSheet(false); if (!assetsCard.hidden) openAssets(false); } const sc = app.querySelector('.sp-studycard'); if (sc) sc.hidden = on || !ST.id; }
  let lastTab = UI.tab;
  tabList.addEventListener('click', (e) => { const t = e.target.closest('[data-tab]'); if (!t) return;
    if (t.dataset.tab === 'properties' && !UI.sels.length) { e.stopImmediatePropagation(); openData(dat.hidden); return; }   // Project data
    if (t.dataset.tab === 'versions') { const on = !cmp.hidden && t.getAttribute('aria-selected') === 'true'; if (on) { e.stopImmediatePropagation(); openSheet(false); return; } setTimeout(() => openSheet(true), 0); return; }   // Compare sketches
    if (root.classList.contains('sp-card-open') && t.getAttribute('aria-selected') === 'true') { e.stopImmediatePropagation(); openCard(false); return; }
    if (!dat.hidden) openData(false);   // one panel at a time (2026-11-01): opening Layers and the like closes Project data
    openCard(true); }, true);
  // a selection switches the card to Properties (Workspace): show it
  new MutationObserver(() => { if (UI.tab !== lastTab) { lastTab = UI.tab; if (UI.tab === 'properties' && UI.sels.length) openCard(true); else if (!['layers', 'versions', 'properties'].includes(UI.tab)) openCard(true); } }).observe(tabList, { childList: true });

  function closePops(except) { for (const [k, c] of Object.entries(pops)) if (k !== except) { c.hidden = true; app.querySelector(`[data-sp="${k}"]`)?.setAttribute('aria-pressed', 'false'); } }
  function togglePop(k, anchor) {
    const c = pops[k], on = c.hidden; closePops(k); c.hidden = !on; anchor.setAttribute('aria-pressed', String(on)); if (!on) return;
    if (k === 'stats') drawStats(); if (k === 'spaces') drawSpaces(); if (k === 'sun') drawSun(); if (k === 'vis') drawVis(); if (k === 'sec') { closePops(); secEditor(true); return; } if (k === 'q') drawQ(); if (k === 'xl') drawXL();
    if (k === 'q' || k === 'xl') { const sc = app.querySelector('.sp-studycard'); c.style.left = sc && !sc.hidden ? `${Math.round(sc.getBoundingClientRect().right - root.getBoundingClientRect().left + 8)}px` : '60px'; }   // beside an open study, not over it
    if (['stats', 'spaces'].includes(k)) { openCard(false); if (!dat.hidden) openData(false); if (!cmp.hidden) openSheet(false); }
    const r = anchor.getBoundingClientRect(); c.style.top = '64px'; requestAnimationFrame(() => { const h = c.offsetHeight; c.style.top = Math.max(64, Math.min(innerHeight - h - 12, r.top - 8)) + 'px'; });
  }

  // ---- the palette (tools from the bottom bar, the Project panel from the bottom left): open and closed from its own button
  const palOpen = (on, project = false) => { root.classList.toggle('sp-pal-open', on); root.classList.toggle('sp-pal-project', on && project); if (on && typeof cmp !== 'undefined' && cmp && !cmp.hidden) openSheet(false); if (on && typeof dat !== 'undefined' && dat && !dat.hidden) openData(false); };
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
    else if (k === 'terrain') { pmenu.hidden = true; pbtn.setAttribute('aria-expanded', 'false'); openProject('site'); }
    else if (k === 'dim') goView(UI.view === 'plan' ? 'persp' : 'plan');
    else if (k === 'props') openProps(propsCard.hidden);
    else if (k === 'assets') openAssets(assetsCard.hidden);
    else if (k === 'zoomSel') doc()?.getElementById('fitSelectedBtn')?.click();
    else if (k === 'sec') { e.stopPropagation(); closePops(); if (SE.el) secEditor(false); else secEditor(true); }
    else if (pops[k]) { e.stopPropagation(); togglePop(k, b); }
  });
  const away = (e) => { const inPop = e.composedPath().some((n) => n.nodeType === 1 && (n.matches?.('.sp-pop,[data-sp]')));   /* the path as the click went: a popover that redrew under it still holds it */ if (!inPop && !e.target.closest('.sp-pop,[data-sp]')) closePops(); if (!e.target.closest('.sp-proj')) { pmenu.hidden = true; pbtn.setAttribute('aria-expanded', 'false'); } };
  document.addEventListener('click', away);

  // ---- drop a model anywhere (2026-11-09, as a whiteboard takes a file): drag a file over the Workspace, plan or 3D, and a card
  // says to let go; it goes through the Project panel's own import (the preview first, then Confirm import), wherever it lands
  const DROPF = [['OBJ', '#2563eb', 'Wavefront OBJ'], ['STL', '#7c3aed', 'STL mesh'], ['GLB', '#059669', 'glTF binary'], ['glTF', '#0d9488', 'glTF'], ['3DM', '#dc2626', 'Rhino 3DM']], DROPX = /\.(obj|stl|glb|gltf|3dm)$/i;
  const dropEl = el('div', 'sp-drop'); dropEl.hidden = true; dropEl.setAttribute('role', 'dialog'); dropEl.setAttribute('aria-label', 'Drop a model');
  dropEl.innerHTML = `<div class="sp-drop-card"><p class="sp-drop-t">Release to drop your model into the site</p><p class="sp-drop-s">It opens in a preview first: units, up axis and size to check before it joins ${esc(p.name)}.</p><hr><div class="sp-drop-pill"><span>Supported file types</span>${DROPF.map(([n, c, t]) => `<i style="--c:${c}" title="${t}">${n}</i>`).join('')}</div><p class="sp-drop-n">Up to 25 MiB and 80,000 triangles · read in this browser, not uploaded</p></div>`;
  document.body.append(dropEl);
  const DROP = { t: 0, wins: new WeakSet() }, hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  const dropShow = (on, msg) => { clearTimeout(DROP.t); dropEl.hidden = !on; dropEl.classList.toggle('bad', !!msg); const t = dropEl.querySelector('.sp-drop-t'), s2 = dropEl.querySelector('.sp-drop-s'); t.textContent = msg ? msg[0] : 'Release to drop your model into the site'; s2.textContent = msg ? msg[1] : `It opens in a preview first: units, up axis and size to check before it joins ${p.name}.`; if (msg) DROP.t = setTimeout(() => dropShow(false), 3200); };
  async function dropFile(files) { const f = [...files].find((x) => DROPX.test(x.name)) || files[0]; if (!f) return dropShow(false);
    if (!DROPX.test(f.name)) return dropShow(true, [`${f.name} is not a model PlotCloud reads`, 'Drop an OBJ, STL, GLB, glTF or Rhino 3DM file. A plan drawing goes in through Draw › Import plan.']);
    dropShow(false); openProject('import'); let inp = null; for (let i = 0; i < 40 && !(inp = app.querySelector('#file')); i++) await new Promise((r) => setTimeout(r, 50)); if (!inp) return dropShow(true, ['The import could not open', 'Open Project › Import and choose the file there.']);
    const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); }
  const onOver = (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.stopImmediatePropagation(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; if (dropEl.hidden || dropEl.classList.contains('bad')) dropShow(true); };
  const onDrop = (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.stopImmediatePropagation(); dropFile(e.dataTransfer.files); };
  for (const n of ['dragenter', 'dragover']) window.addEventListener(n, onOver, true); window.addEventListener('drop', onDrop, true);
  dropEl.addEventListener('dragleave', (e) => { if (!e.relatedTarget || !dropEl.contains(e.relatedTarget)) { if (e.target === dropEl) dropShow(false); } });
  dropEl.addEventListener('click', () => dropShow(false)); window.addEventListener('dragend', () => dropShow(false));
  // the plan and 3D panes are pages of their own: a file dragged over them shows the card here, and Plan Studio's own drop (it
  // opens a saved Plan Studio file in place of the model) never sees it
  const dropPanes = () => { for (const k of ['plan', 'persp']) { const w = INST[k].ready ? INST[k].win : null; if (!w || DROP.wins.has(w)) continue; DROP.wins.add(w);
    for (const n of ['dragenter', 'dragover']) w.addEventListener(n, onOver, true); w.addEventListener('drop', onDrop, true); } };
  dropPanes(); const dropT = setInterval(dropPanes, 1500);
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
  // ---- simulation quality (2026-11-09): a small slider above Add simulation. Drag it (or use the arrow keys) from Draft, quick
  // results while designing, to Refined, finer grids for results to present; a click opens its card: what each step changes,
  // the open study's time at each step, and the grids of Project props to set by hand.
  const qEl = el('div', 'sp-q'); qEl.dataset.sp = 'q'; qEl.tabIndex = 0; qEl.setAttribute('role', 'slider'); qEl.setAttribute('aria-label', 'Simulation quality'); qEl.setAttribute('aria-valuemin', '0'); qEl.setAttribute('aria-valuemax', '2');
  qEl.innerHTML = '<span class="sp-q-tr"><i></i><i></i><i></i><b></b></span>'; root.append(qEl);
  function qUI() { const q = qualOf(), i = QUAL.indexOf(q); qEl.dataset.q = q.k; qEl.setAttribute('aria-valuenow', String(i)); qEl.setAttribute('aria-valuetext', q.name); qEl.querySelector('b').style.left = `${i * 50}%`;
    qEl.title = `Simulation quality: ${q.name}. Slide right for finer, slower results; left for quick drafts. Click for grids and times.`; }
  function setQual(k) { const q = QUAL.find((x) => x.k === k); if (!q || q === qualOf()) return; const c = S.conditionsOf(p); S.updateConditions(p, c.site, { ...c.defaults, quality: k }, { acquisition: 'manual-entry', valueOrigin: 'user-override' }); syncLevels(); qUI(); if (!pops.q.hidden) drawQ(); if (!pops.xl.hidden) drawXL(); if (ST.id) drawStudy(); }
  const setDefault = (key, v) => { const c = S.conditionsOf(p); S.updateConditions(p, c.site, { ...c.defaults, [key]: v }, { acquisition: 'manual-entry', valueOrigin: 'user-override' }); drawQ(); if (ST.id) drawStudy(); };
  { let drag = null; const at = (x) => { const r = qEl.querySelector('.sp-q-tr').getBoundingClientRect(); return Math.max(0, Math.min(2, Math.round((x - r.left) / Math.max(1, r.width) * 2))); };
    qEl.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; drag = { x: e.clientX, moved: false }; qEl.setPointerCapture(e.pointerId); });
    qEl.addEventListener('pointermove', (e) => { if (!drag) return; if (Math.abs(e.clientX - drag.x) > 5) drag.moved = true; if (drag.moved) qEl.querySelector('b').style.left = `${at(e.clientX) * 50}%`; });
    qEl.addEventListener('pointerup', (e) => { if (!drag) return; const d = drag; drag = null; if (d.moved) { qEl.dataset.dragged = '1'; setQual(QUAL[at(e.clientX)].k); qUI(); } });
    qEl.addEventListener('click', (e) => { if (qEl.dataset.dragged) { delete qEl.dataset.dragged; e.stopImmediatePropagation(); } }, true);   // a slide is not a click
    qEl.addEventListener('keydown', (e) => { const i = QUAL.indexOf(qualOf()); if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setQual(QUAL[Math.min(2, i + 1)].k); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setQual(QUAL[Math.max(0, i - 1)].k); } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePop('q', qEl); } }); }
  queueMicrotask(qUI);   // once the quality table below is defined
  function drawQ() { const q = qualOf(), i = QUAL.indexOf(q), id = ST.id, nm = id ? simName(id) : '', est = id ? QUAL.map((x) => estimate(id, x)) : null, d0 = S.conditionsOf(p).defaults || {}, a = autoCells();
    const sel = (key, opts, label) => `<label class="sp-field">${label}<select class="sp-sel" data-qset="${key}">${opts.map((o) => `<option value="${o}" ${String(d0[key] ?? opts[0]) === o ? 'selected' : ''}>${o === 'Auto' ? `Auto (set by quality${key === 'grid' && a ? `: ${fmt(gridSet() ? a.cell : (gridOf() || a.cell), 2)} m` : key === 'surfGrid' && a && a.surf ? `: ${fmt(surfSet() ? a.surf : (surfOf() || a.surf), 2)} m` : ''})` : o + (key === 'flowDetail' ? '' : ' m')}</option>`).join('')}</select></label>`;
    const times = id && NOGRID[id] ? `<p class="sp-note"><b>${esc(nm)}</b> has no grid (${esc(NOGRID[id])}): its time and its result are the same at every quality.</p>` : est && est.some(Boolean) ? `<h4>${esc(nm)} at each quality</h4>${QUAL.map((x, j) => `<div class="sp-kv"><span>${x.name}</span><b>${est[j] ? dur(est[j].ms) : '—'}</b></div>`).join('')}` : `<p class="sp-note">${id ? `${esc(nm)} has no time estimate before it runs; its progress shows at the top while it runs.` : 'Open a simulation to see its time at each quality.'}</p>`;
    pops.q.innerHTML = `<h3>Simulation quality</h3>
      <label class="sp-sl"><span><b>${q.name}</b><output>${['Quickest', 'Balanced', 'Finest, slower'][i]}</output></span><input type="range" min="0" max="2" step="1" value="${i}" data-qset="quality" aria-label="Simulation quality"></label>
      <div class="sp-qticks"><span>Draft</span><span>Standard</span><span>Refined</span></div>
      <p class="sp-note">${esc(q.note)} Interior studies: ${esc(q.lv === 'fine' ? 'Fine' : q.lv === 'standard' ? 'Standard' : 'Draft')} detail.</p>
      ${i > 0 ? `<p class="sp-note sp-warn">Takes longer than Draft${est && est[0] && est[i] ? `: ${esc(nm)} ${dur(est[i].ms)} instead of ${dur(est[0].ms)}` : `: about ${i === 1 ? '2' : '4'} times the grid points`}. Once it starts, the time left and when it will finish show at the top, so you can leave it running.</p>` : ''}
      ${times}
      <h4>Grids (Project props › Default)</h4>
      ${sel('grid', ['Auto', '0.25', '0.5', '1', '2', '4'], 'Ground grid')}${sel('surfGrid', ['Auto', '0.25', '0.5', '1', '2'], 'Building surface grid')}${sel('flowDetail', ['Standard', 'Fine', 'Very fine'], 'Wind, snow and water detail')}
      <p class="sp-note">A grid set here is used at every quality; Auto lets the quality set it.${gridSet() || surfSet() ? ' <b>Custom grids are set.</b>' : ''}</p>`;
    pops.q.querySelectorAll('[data-qset]').forEach((x) => x.onchange = () => { if (x.dataset.qset === 'quality') setQual(QUAL[+x.value].k); else setDefault(x.dataset.qset, x.value); });
    pops.q.querySelector('[data-qset=quality]').oninput = (e) => { const j = +e.target.value; e.target.closest('label').querySelector('b').textContent = QUAL[j].name; }; }

  // ---- the run at the top (2026-11-09): while a study runs, its time left and the clock time it should finish, from the estimate
  // and, once it reports progress, from its progress; the tab title shows it too, and a notice can come when it ends (opt in)
  const runEl = el('div', 'sp-card sp-runbar'); runEl.hidden = true; runEl.setAttribute('role', 'status'); runEl.setAttribute('aria-live', 'polite'); root.append(runEl);
  let BATCH = null;   // Generate pictures: { n, k, later (ms of the ones after this), final, cancel }
  const RUN = { title: null, cleanup: null }, NOTK = 'pc-ws-notify', clock = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const durS = (ms) => (ms < 60000 ? `${Math.max(1, Math.round(ms / 1000))} s` : ms < 3600000 ? `${Math.floor(ms / 60000)} min ${String(Math.round(ms % 60000 / 1000)).padStart(2, '0')} s` : `${Math.floor(ms / 3600000)} h ${Math.round(ms % 3600000 / 60000)} min`);
  const wantNotice = () => { try { return localStorage.getItem(NOTK) === '1'; } catch { return false; } };
  function runBar(state, extra = {}) {
    const B = BATCH; if (B && !['start', 'tick'].includes(state)) return;   // one run of several: the bar carries on to the next
    if (RUN.title == null) RUN.title = document.title; const nm = extra.batch ? 'Generate pictures' : B ? `${B.k + 1} of ${B.n} · ${simName(ST.id)}` : simName(ST.id), q = ST.runQ || qualOf(), el0 = Date.now() - (ST.t0 || Date.now()), e = ST.estAtRun;
    if (RUN.cleanup) { RUN.cleanup(); RUN.cleanup = null; }
    if (state === 'start' || state === 'tick') {
      const m = /(\d+(?:\.\d+)?)\s*%/.exec(ST.progress || ''), f = m ? Math.min(0.99, +m[1] / 100) : 0;
      let left = e ? Math.max(0, e.ms - el0) : null; if (f >= 0.1 && el0 > 2000) left = el0 * (1 - f) / f;   // the study's own progress, once it has some, beats the estimate
      if (left != null && B) left += B.later;   // and the ones still to come
      const over = left != null && left < 1000 && f < 0.95 && el0 > 3000, txt = left != null && !over ? `about ${durS(left)} left · done around ${clock(Date.now() + left)}` : over ? 'taking longer than estimated' : 'time not known before it runs';
      if (state === 'start' || !runEl.querySelector('.sp-run-left')) { runEl.innerHTML = `<span class="sp-run-dot" aria-hidden="true"></span><b class="sp-run-nm"></b><span class="sp-run-q"></span><span class="sp-run-left"></span><span class="sp-run-el"></span><label class="sp-run-n" title="A notice from the browser when it finishes, while you are in another tab or window"><input type="checkbox" ${wantNotice() ? 'checked' : ''}> Notify me</label><button type="button" class="btn sm" data-run="stop">Stop</button>`;
        runEl.querySelector('[data-run=stop]').onclick = () => { if (BATCH) BATCH.cancel = true; ST.cancel = true; SSX.stop(); VWS.stop(); CAMS.stop(); DAY.stop(); ST.progress = 'Stopping after this step…'; drawStudy(); };
        runEl.querySelector('.sp-run-n input').onchange = async (ev) => { const on = ev.target.checked; try { localStorage.setItem(NOTK, on ? '1' : '0'); } catch { } if (on && 'Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch { } } }; }
      runEl.dataset.state = 'run'; runEl.hidden = false; runEl.querySelector('.sp-run-nm').textContent = nm; runEl.querySelector('.sp-run-q').textContent = q.name; runEl.querySelector('.sp-run-left').textContent = txt;
      runEl.querySelector('.sp-run-el').textContent = `${durS(el0)} elapsed${e ? ` · estimated ${dur(e.ms)}` : ''}${f ? ` · ${Math.round(f * 100)}%` : ''}`;
      document.title = `${left != null && !over ? durS(left) + ' left' : 'Running'} · ${nm} — PlotCloud`; return; }
    if (state === 'done' || state === 'error') { const ok = state === 'done', end = Date.now();
      runEl.dataset.state = ok ? 'done' : 'error'; runEl.hidden = false;
      runEl.innerHTML = `<span class="sp-run-dot" aria-hidden="true"></span><b>${esc(nm)}</b><span>${extra.batch ? `${esc(extra.batch)} · finished at ${clock(end)}` : ok ? `finished at ${clock(end)} · took ${durS(el0)} · ${esc(q.name)}` : 'could not run: see its panel'}</span><button type="button" class="sp-x" aria-label="Close" title="Close">×</button>`;
      document.title = `${ok ? '✓' : '✗'} ${nm} ${ok ? 'done' : 'failed'} — PlotCloud`;
      // the bar stays until closed or the next run (whoever stepped away sees it on return); the tab title comes back once someone is here
      const restore = () => { document.title = RUN.title; runEl.hidden = true; RUN.title = null; }, back = () => { if (RUN.title != null) document.title = RUN.title; RUN.cleanup?.(); RUN.cleanup = null; };
      runEl.querySelector('.sp-x').onclick = () => { restore(); RUN.cleanup?.(); RUN.cleanup = null; };
      if (wantNotice() && document.hidden && 'Notification' in window && Notification.permission === 'granted') { try { new Notification(`PlotCloud · ${nm} ${ok ? 'finished' : 'could not run'}`, { body: ok ? `${q.name} · took ${durS(el0)}` : 'Open the Workspace to see why.' }); } catch { } }
      setTimeout(() => { if (RUN.cleanup) return; const opts = { capture: true, once: true }; for (const n of ['pointerdown', 'keydown']) window.addEventListener(n, back, opts); RUN.cleanup = () => { for (const n of ['pointerdown', 'keydown']) window.removeEventListener(n, back, true); }; }, 400);
      return; }
    runEl.hidden = true; if (RUN.title != null) { document.title = RUN.title; RUN.title = null; } }
  // ---- the export list (2026-11-09): views, series and sections kept for the report, under Add simulation; see export-list.js
  let XLM = null; const xlMod = () => (XLM ||= import('./export-list.js?v=xlist-20261109-5'));
  const XL = { list: { title: '', items: [] }, busy: '' };
  xlMod().then((m) => m.loadList(p.id)).then((l) => { XL.list = l; xlBadge(); }).catch(() => { });
  function xlBadge() { const b = app.querySelector('.sp-xlb .sp-badge'), n = XL.list.items.length; if (!b) return; b.hidden = !n; b.textContent = String(n); }
  async function xlSave() { const m = await xlMod(); await m.saveList(p.id, XL.list); xlBadge(); if (!pops.xl.hidden) drawXL(); }
  async function drawXL() { const m = await xlMod(); if (!pops.xl.querySelector('.xl-lst')) pops.xl.innerHTML = '<div class="xl-gen"></div><div class="xl-lst"></div>'; drawGen(pops.xl.querySelector('.xl-gen')); m.renderList(pops.xl.querySelector('.xl-lst'), XL.list, { project: p.name, modelKey: modelHash(), busy: XL.busy, onChange: (redraw = true) => { xlSave(); if (redraw) drawXL(); }, onExport: xlExport }); }
  const xlCtx = () => { const st = S.siteOf(p) || {}, last = (p.versions || []).at(-1); return { project: p.name, site: st.label && st.label !== p.name ? st.label : '', coords: Number.isFinite(st.lat) ? `${Math.abs(st.lat).toFixed(4)}° ${st.lat >= 0 ? 'N' : 'S'}, ${Math.abs(st.lon).toFixed(4)}° ${st.lon >= 0 ? 'E' : 'W'}` : '', version: last ? `v${last.n}${dirty() ? ' + unsaved changes' : ''}` : 'unsaved draft', revision: S.conditionsOf(p).revision, author: S.account()?.user?.name || '', weather: ROSE.v?.station || '' }; };
  async function xlExport(kind) { if (XL.busy) return; XL.busy = kind === 'pdf' ? 'Laying out the report…' : kind === 'pptx' ? 'Building the slides…' : 'Packing the pictures…'; drawXL();
    try { const m = await xlMod(), { name, blob } = await m.exportList(kind, XL.list, xlCtx()), a = document.createElement('a'), u = URL.createObjectURL(blob); a.href = u; a.download = name; a.addEventListener('click', (ev) => ev.stopPropagation()); document.body.append(a); a.click(); a.remove();   /* a download is not a click outside the list */ setTimeout(() => URL.revokeObjectURL(u), 4000); XL.busy = ''; }
    catch (e) { XL.busy = 'The export could not finish: ' + (e.message || e); } drawXL(); setTimeout(() => { if (XL.busy.startsWith('The export')) { XL.busy = ''; } }, 6000); }
  // ---- Generate pictures (2026-11-09): tick the simulations, choose a view or a series for each, see each one's time and the
  // total, then generate: they run one after another at the quality set above Add simulation, and each picture joins the list
  const GENK = 'pc-ws-gen:' + p.id, GEN_IDS = ['sunhours', 'radiation', 'skyview', 'utci', 'wind', 'daylight', 'vent', 'acoustics', 'spacesyntax', 'fire-evacuation'];
  XL.gen = (() => { try { return { pick: {}, cam: {}, ...(JSON.parse(localStorage.getItem(GENK)) || {}) }; } catch { return { pick: {}, cam: {} }; } })(); XL.gen.cam ||= {};
  const genSave = () => { try { localStorage.setItem(GENK, JSON.stringify({ pick: XL.gen.pick, cam: XL.gen.cam })); } catch { } };
  const genList = () => [...GEN_IDS.filter((id) => (api.sims || []).some((x) => x.id === id)).map((id) => ({ id, name: simName(id), series: !!SERIES[id] })), ...(secPane()?.section?.() ? [{ id: 'section', name: `Section ${secPane().section().name || 'A'}`, series: false }] : [])];
  const nPics = (kind) => (kind === 'months' ? 12 : kind === 'seasons' ? 4 : 1);
  // each one's time: the estimate where the study has one, else its last run on this computer, else not known before it runs
  function timeOf(id, kind) { if (id === 'section') return { ms: 4000, src: 'est' }; const n = nPics(kind); let ms = null, src = 'est';
    try { const e = estimate(id); if (e && e.ms) ms = e.ms; } catch { } if (ms == null) { const L = simLog()[id]; if (L && L.ms) { ms = L.ms; src = 'last'; } }
    return ms == null ? null : { ms: ms * n + n * 600, src }; }   // + about 0.6 s a picture to frame and capture it
  const clockAt = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  function drawGen(host) { const G = genList(), on = G.filter((g) => XL.gen.pick[g.id]), T = on.map((g) => timeOf(g.id, XL.gen.pick[g.id])), known = T.filter(Boolean), tot = known.reduce((a, t) => a + t.ms, 0), pics = on.reduce((a, g) => a + nPics(XL.gen.pick[g.id]), 0), busy = !!XL.gen.running || ST.busy;
    const opt = (g) => { const k = XL.gen.pick[g.id] || 'view'; return g.series ? `<select class="xl-gk" data-gk="${g.id}" ${busy ? 'disabled' : ''} aria-label="${esc(g.name)}: what to make">${[['view', 'View'], ['months', '12 months'], ['seasons', '4 seasons']].map(([v, n]) => `<option value="${v}" ${k === v ? 'selected' : ''}>${n}</option>`).join('')}</select>` : '<span class="xl-gk">View</span>'; };
    const tm = (g) => { if (!XL.gen.pick[g.id]) return ''; const t = timeOf(g.id, XL.gen.pick[g.id]); const same = NOGRID[g.id] ? `<i class="xl-same" title="No grid (${esc(NOGRID[g.id])}): the same at every quality">same at every quality</i>` : ''; return t ? `${dur(t.ms).replace(/^about /, '~')}${t.src === 'last' ? '<i title="From its last run on this computer">*</i>' : ''}${same}` : `<i title="Not known before its first run">first run</i>${same}`; };
    host.innerHTML = `<h3>Generate pictures</h3><p class="sp-note" style="margin-top:0">Tick what to make; they run one after another at ${esc(qualOf().name)} quality and each picture joins the export list below.</p>
      <div class="xl-gl">${G.map((g) => `<div class="xl-gr${XL.gen.pick[g.id] ? ' on' : ''}"><label><input type="checkbox" data-gp="${g.id}" ${XL.gen.pick[g.id] ? 'checked' : ''} ${busy ? 'disabled' : ''}> ${esc(g.name)}</label>${opt(g)}<span class="xl-t">${tm(g)}</span>${g.id !== 'section' && XL.gen.pick[g.id] ? `<button type="button" class="xl-pv${XL.gen.cam[g.id] ? ' set' : ''}" data-gpv="${g.id}" ${busy ? 'disabled' : ''} title="${XL.gen.cam[g.id] ? 'The pictures are taken from the view you set. Click to look again or change it.' : 'Run it once and set the 3D view the pictures are taken from'}">${XL.gen.cam[g.id] ? 'View set ✓' : 'Preview'}</button>` : '<span></span>'}</div>`).join('')}</div>
      <div class="xl-tot">${on.length ? `<b>${pics} picture${pics === 1 ? '' : 's'} · about ${dur(tot).replace(/^about /, '')}${known.length < on.length ? ` + ${on.length - known.length} not yet timed` : ''}</b><span>done around ${clockAt(Date.now() + tot)}${known.some((t) => t.src === 'last') ? ' · * from the last run' : ''}</span>` : '<span>Nothing ticked.</span>'}</div>
      <div class="xl-acts"><button type="button" class="btn sm primary" data-g="go" ${on.length && !busy ? '' : 'disabled'}>${XL.gen.running ? `Generating ${XL.gen.running.k + 1} of ${XL.gen.running.n}…` : `Generate ${pics || ''} picture${pics === 1 ? '' : 's'}`}</button></div>
      ${XL.gen.last ? `<p class="sp-note xl-glast">${XL.gen.last}</p>` : ''}`;
    host.querySelectorAll('[data-gp]').forEach((x) => x.onchange = () => { if (x.checked) XL.gen.pick[x.dataset.gp] = XL.gen.pick[x.dataset.gp] || 'view'; else delete XL.gen.pick[x.dataset.gp]; genSave(); drawGen(host); });
    host.querySelectorAll('select[data-gk]').forEach((x) => x.onchange = () => { XL.gen.pick[x.dataset.gk] = x.value; genSave(); drawGen(host); });
    host.querySelectorAll('[data-gpv]').forEach((x) => x.onclick = () => genPreview(x.dataset.gpv));
    const go = host.querySelector('[data-g=go]'); if (go) go.onclick = () => genRun(); }
  // Preview (2026-11-09): run the study once, frame its result in 3D (or go back to the view set before); the person orbits, pans
  // and zooms, then keeps that view: Generate pictures takes its pictures from it (each picture of a series too)
  async function genPreview(id) { if (XL.gen.running || ST.busy) return; closePops(); app.querySelector('.xl-pvbar')?.remove();
    openStudy(id); await new Promise((r) => setTimeout(r, 400)); if (UI.view !== 'persp') { await goView('persp'); for (let i = 0; i < 60 && !INST.persp.ready; i++) await new Promise((r) => setTimeout(r, 100)); }
    if (!ST.res || ST.id !== id) await runStudy(); if (!ST.res) { if (pops.xl.hidden) togglePop('xl', app.querySelector('.sp-xlb')); return; }
    const w = INST.persp.ws, r = ST.res; if (!(XL.gen.cam[id] && w.camViewSet?.(XL.gen.cam[id])) && Number.isFinite(r.X0) && r.nx) w.fitBox?.({ x0: r.X0, y0: r.Y0, x1: r.X0 + r.nx * r.cell, y1: r.Y0 + r.ny * r.cell }, 0, 1.25, false);
    const bar = document.createElement('div'); bar.className = 'xl-pvbar'; bar.setAttribute('role', 'dialog'); bar.setAttribute('aria-label', 'Preview the view for the report');
    bar.innerHTML = `<span><b>Preview · ${esc(simName(id))}</b> Orbit, pan and zoom the 3D view to the framing you want in the report.</span><button type="button" class="btn sm primary" data-pv="use">Use this view</button><button type="button" class="btn sm" data-pv="fit">Fit to result</button>${XL.gen.cam[id] ? '<button type="button" class="btn sm" data-pv="clear">Clear</button>' : ''}<button type="button" class="btn sm" data-pv="x">Cancel</button>`;
    const back = () => { bar.remove(); if (pops.xl.hidden) togglePop('xl', app.querySelector('.sp-xlb')); else drawXL(); };
    bar.addEventListener('click', (e) => { const k = e.target.closest('[data-pv]')?.dataset.pv; if (!k) return; e.stopPropagation();
      if (k === 'use') { const c = w.camView?.(); if (c) { XL.gen.cam[id] = c; genSave(); toastXL(`View kept for ${simName(id)}: its pictures are taken from it.`); } back(); }
      else if (k === 'fit') { if (Number.isFinite(r.X0) && r.nx) w.fitBox?.({ x0: r.X0, y0: r.Y0, x1: r.X0 + r.nx * r.cell, y1: r.Y0 + r.ny * r.cell }, 0, 1.25, false); }
      else if (k === 'clear') { delete XL.gen.cam[id]; genSave(); back(); } else back(); });
    root.append(bar); }
  const genCam = async (id) => { const c = XL.gen.cam[id]; if (c && INST.persp.ws.camViewSet?.(c)) await new Promise((r) => setTimeout(r, 120)); };
  async function genRun() { const G = genList().filter((g) => XL.gen.pick[g.id]); if (!G.length || XL.gen.running || ST.busy) return;
    const times = G.map((g) => timeOf(g.id, XL.gen.pick[g.id])?.ms || 0), done = [], failed = [], keepId = ST.id; XL.gen.running = { k: 0, n: G.length }; XL.gen.last = '';
    closePops(); BATCH = { n: G.length, k: 0, later: 0, final: false, cancel: false };
    for (let k = 0; k < G.length; k++) { const g = G[k], kind = XL.gen.pick[g.id]; Object.assign(BATCH, { k, later: times.slice(k + 1).reduce((a, t) => a + t, 0), final: k === G.length - 1 }); XL.gen.running.k = k; let ok = false, why = '';
      try { if (g.id === 'section') ok = await xlAddSection();
        else { openStudy(g.id); await new Promise((r) => setTimeout(r, 400));
          if (kind === 'view') { await runStudy(); if (ST.res) await genCam(g.id); ok = !!ST.res && !!(await xlAddView()); if (!ST.res) why = ST.err; }
          else { const out = await runSeries(kind, { preview: false }); ok = !!out && await xlAddSeries(g.id, kind, out.frames, out.q); if (!out) why = ST.err; } } }
      catch (e) { why = e.message || String(e); }
      (ok ? done : failed).push(ok ? g.name : `${g.name}${why ? ': ' + plain(why) : ''}`); if (BATCH.cancel) break; }
    const stopped = BATCH.cancel; BATCH = null; XL.gen.running = null;
    XL.gen.last = `${done.length ? `Added: ${esc(done.join(', '))}.` : ''}${failed.length ? ` <span class="sp-warn">Could not make: ${esc(failed.join('; '))}.</span>` : ''}${stopped ? ' Stopped.' : ''}`;
    runBar(failed.length && !done.length ? 'error' : 'done', { batch: `${done.length} of ${G.length} made for the export list${failed.length ? `, ${failed.length} could not run` : ''}` });
    if (keepId && keepId !== ST.id && !stopped) { /* the study last open stays as the generation left it */ }
    if (pops.xl.hidden) togglePop('xl', app.querySelector('.sp-xlb')); else drawXL(); }
  // what every item records: how it was computed
  const basisLine = (q = qualOf(), cell = 0) => { const c = xlCtx(); return `Quality ${q.name}${cell ? ` · ground grid ${fmt(cell, 2)} m` : ''} · model ${c.version} · conditions revision ${c.revision ?? '–'}${c.site ? ' · ' + c.site : ''}`; };
  const legendOf = (V, r) => { const cols = V.legendCols || INST.persp.ws.rampColors?.(r.ramp) || ['#ddd', '#333']; return { lo: V.lo, hi: V.hi, unit: V.unit || r.unit || '', dec: V.dec ?? r.dec ?? 1, stops: V.legendLabels ? cols.slice().reverse() : cols }; };
  async function xlAdd(item) { const m = await xlMod(); void m; XL.list.items.push({ id: 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: new Date().toISOString(), modelKey: modelHash(), ...item }); await xlSave(); toastXL(`Added to the export list (${XL.list.items.length}).`); return true; }
  const toastXL = (t) => { const b = app.querySelector('.sp-xlb'); if (!b) return; b.classList.remove('sp-pulse'); void b.offsetWidth; b.classList.add('sp-pulse'); b.title = t; };
  // what a report chapter states (2026-11-09): the analysis objective (the study's own description) and its inputs and boundary conditions
  const objectiveOf = (id) => { const a = SPEC[id]?.about; try { return typeof a === 'function' ? a() : a || ''; } catch { return ''; } };
  const WX = new Set(['radiation', 'utci', 'wind', 'vent', 'daylight', 'snow', 'stormwater', 'acoustics']);
  const inputsFor = (id, r, q = qualOf(), extra = []) => { const c = xlCtx(), st = r?.settings?.label ? String(r.settings.label).replace(/\s*\(Workspace\)\s*$/, '') : '';
    return [['Simulation resolution', `${q.name}: ${q.note.replace(/\.$/, '').replace(/^Quick results while you design: /, '')}`], ...(r?.cell ? [['Analysis grid', `${fmt(r.cell, 2)} m`]] : []), ...(st ? [['Analysis settings', st]] : []), ...extra,
      ...(WX.has(id) && c.weather ? [['Climate data', c.weather]] : []), ['Location', [c.site, c.coords].filter(Boolean).join(' · ') || '—'], ['Model', c.version], ['Project conditions', `Revision ${c.revision ?? '—'}`]]; };
  // the section as it is, in the Section view: its levels and notes, and Natural ventilation on the cut when that is the result shown
  async function xlAddSection() { const s = secPane()?.section?.(); if (!s) return false; const was = secViewOn(); if (!was) { await sectionView(true); await new Promise((r) => setTimeout(r, 600)); }
    try { const vent = ST.id === 'vent' && ST.res, on = ST.res?.onSection ? ST.res : null, R = vent || on, V = R ? (R.views[R.view] || Object.values(R.views)[0]) : null, u = await INST.persp.ws.sectionPNG?.(false); if (!u) return false;   // no title block: the report captions it
      const blob = await (await fetch(u)).blob(), X = await xlMod(), study = vent ? 'vent' : on ? ST.id : 'section', shape = `${fmt(s.len, 2)} m long${s.segs?.length > 1 ? `, ${s.segs.length} segments (unfolded at each turn)` : ''}, ${s.far ? `far clip ${fmt(s.far, 1)} m` : 'no far clip'}, parallel view`;
      await xlAdd({ kind: 'section', study, title: `Section ${s.name || 'A'}${V ? ' · ' + X.plain(V.title) : ''}`, sub: shape, pictures: [{ label: `Section ${s.name || 'A'}`, blob }], cols: 1, legend: V ? legendOf(V, R) : null,
        rows: V ? (R.rows || []).slice(0, 10).map(([k, v]) => [X.plain(k), X.plain(v)]) : [], method: V ? X.plain(R.method || '') : 'A vertical cut through the model along the section line, each segment seen square on in a parallel view and unfolded side by side where the line turns; cut faces filled where closed solids are cut.', basis: basisLine(), objective: V ? objectiveOf(study) : 'A vertical section through the building along the section line, to read the spaces, levels and cut construction.', inputs: inputsFor(study, V ? R : null, qualOf(), [['Section', `${s.name || 'A'}, ${shape}`]]), notes: vent ? ['On the cut: one value per room (the airflow network treats each room as fully mixed), not air speed or temperature.'] : [] });
      return true; } finally { if (!was) await sectionView(false); } }
  // the study's view as it is now, at print size (about 1800 px wide), with its legend, key results and method
  async function xlAddView() { const r = ST.res, id = ST.id; if (!r || !INST.persp.ready) return; if (UI.view !== 'persp') { await goView('persp'); await new Promise((res) => setTimeout(res, 400)); }
    const fr = app.querySelector('#fPersp')?.getBoundingClientRect() || { width: 1200, height: 800 }, sc = 1800 / (Math.max(400, fr.width) * (devicePixelRatio || 1)), c = INST.persp.ws.snapAt?.(fr.width, fr.height, sc); if (!c) return;
    const m = await xlMod(), V = (r.views && r.views[r.view]) || r, blob = await m.canvasBlob(c);
    return xlAdd({ kind: 'view', study: id, title: m.plain(V.title || r.title || simName(id)), sub: `${simName(id)} · ${qualOf().name}`, pictures: [{ label: m.plain(V.title || r.title || ''), blob }], cols: 1, legend: legendOf(V, r), rows: (r.rows || []).map(([k, v]) => [m.plain(k), m.plain(v)]), method: m.plain(r.method || ''), basis: basisLine(qualOf(), r.cell), objective: objectiveOf(id), inputs: inputsFor(id, r) }); }
  // ---- section (2026-11-07, after Revit's Section): the line is part of the model, drawn and edited on the plan (drag the line or a
  // head, click an arrow to flip, drag the dashed far edge); here: draw it, the Section view (square to the cut, parallel, with the
  // levels), the 3D cutaway, the far clip, and a study's result on the cut where the study has one through the height of a room
  const SECK = 'pc-ws-section';
  // the model as a study sees it: a section line is a way of looking at the model, never an input, so moving it keeps results current
  const studyModel = (w) => String(w.model()).replace(/,"section":\{[^{}]*\}|"section":\{[^{}]*\},?/, '');
  const secStyle = () => { try { return { opacity: 0.6, bands: true, ...(JSON.parse(localStorage.getItem(SECK)) || {}) }; } catch { return { opacity: 0.6, bands: true }; } };
  const secPane = () => (INST.plan.ready ? INST.plan.ws : INST.persp.ready ? INST.persp.ws : null);
  const secViewOn = () => !!(UI.view === 'persp' && INST.persp.ready && INST.persp.ws.sectionState?.()?.view);
  // ---- the section, as a key plan (2026-11-10): Section opens a plan at preview size where the cut is drawn, any angle and as
  // many turns as needed; Use this section shrinks it into a key plan in the top right corner, the model cut in 3D (or the cut
  // unfolded in the Section view, a button on the key plan). Clicking the key plan changes the cut; closing it ends the section.
  const SECLAST = 'pc-ws-sec-last:' + p.id, SE = { el: null, kp: null, lv: null, pts: [], flip: false, drawing: true, drag: -1, hover: null, map: null, key: '' };
  const bsNow = () => { try { return INST.persp.ready ? INST.persp.ws.buildingScene?.() : INST.plan.ready ? INST.plan.ws.buildingScene?.() : null; } catch { return null; } };
  const curLv = () => { try { return (INST.plan.ready ? INST.plan.ws : INST.persp.ws).level?.(); } catch { return null; } };
  // the plan of one level, drawn plainly (rooms, walls, openings, stairs, names), fitted to box (plan metres) in a w × h canvas
  function keyPlanDraw(cv, bs, lvId, box, o = {}) { const x = cv.getContext('2d'), W = cv.width, H = cv.height, pad = o.pad ?? 10, k = Math.min((W - 2 * pad) / Math.max(1, box.x1 - box.x0), (H - 2 * pad) / Math.max(1, box.y1 - box.y0)), ox = (W - (box.x1 - box.x0) * k) / 2, oy = (H - (box.y1 - box.y0) * k) / 2;
    const P = (q) => [ox + (q[0] - box.x0) * k, H - oy - (q[1] - box.y0) * k]; x.fillStyle = '#fbfaf7'; x.fillRect(0, 0, W, H);
    const L = bs?.levels.find((l) => l.id === lvId) || bs?.levels[0]; if (L) { const sc = L.sc, O = sc.origin || [0, 0], G = (q) => P([q[0] + O[0], q[1] + O[1]]);
      for (const r of sc.rooms || []) for (const [rx, ry, rw, rh] of r.rects || []) { const a2 = G([rx, ry]), b2 = G([rx + rw, ry + rh]); x.fillStyle = /corridor|hall|lobby|stair|走廊/i.test(r.name || '') ? '#efece6' : '#f4f1ea'; x.fillRect(a2[0], b2[1], b2[0] - a2[0], a2[1] - b2[1]); }
      x.lineCap = 'butt'; x.strokeStyle = '#1f2937'; for (const w of sc.walls || []) { if (w.furnline) continue; x.lineWidth = Math.max(1, (w.t || 0.2) * k); const a2 = G(w.a), b2 = G(w.b); x.beginPath(); x.moveTo(a2[0], a2[1]); x.lineTo(b2[0], b2[1]); x.stroke(); }
      for (const op of sc.open || []) { const a2 = G(op.a), b2 = G(op.b); x.strokeStyle = '#fbfaf7'; x.lineWidth = Math.max(2, 0.34 * k); x.beginPath(); x.moveTo(a2[0], a2[1]); x.lineTo(b2[0], b2[1]); x.stroke(); if (op.kind === 'win') { x.strokeStyle = '#4b83c4'; x.lineWidth = Math.max(1, 0.06 * k); x.beginPath(); x.moveTo(a2[0], a2[1]); x.lineTo(b2[0], b2[1]); x.stroke(); } }
      for (const st of bs.stairs || []) { if (st.lv !== L.id && st.top !== L.id) continue; const Q = st.corners.map(P); x.strokeStyle = '#6b7280'; x.lineWidth = 1; x.beginPath(); Q.forEach((q, i) => (i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]))); x.closePath(); x.stroke(); x.beginPath(); x.moveTo(Q[0][0], Q[0][1]); x.lineTo(Q[2][0], Q[2][1]); x.stroke(); }
      if (o.names !== false) { x.fillStyle = '#6b7280'; x.font = `500 ${Math.max(9, Math.min(12, k * 0.5))}px Inter,system-ui,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
        for (const r of sc.rooms || []) { if (!r.name || !r.rects?.length) continue; let A = 0, cx = 0, cy = 0; for (const [rx, ry, rw, rh] of r.rects) { A += rw * rh; cx += (rx + rw / 2) * rw * rh; cy += (ry + rh / 2) * rw * rh; } if (A * k * k < 900) continue; const q = G([cx / A, cy / A]); x.fillText(r.name, q[0], q[1]); } } }
    return { k, P, inv: (px, py) => [box.x0 + (px - ox) / k, box.y0 + (H - oy - py) / k] }; }
  // the extent of the building (every level) with a margin, and the cut if there is one
  function keyBox(bs, pts) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const add = (q) => { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); };
    for (const L of bs?.levels || []) { const O = L.sc.origin || [0, 0]; for (const w of L.sc.walls || []) { add([w.a[0] + O[0], w.a[1] + O[1]]); add([w.b[0] + O[0], w.b[1] + O[1]]); } } for (const q of pts || []) add(q);
    if (!Number.isFinite(x0)) { const c = S.siteOf(p) ? [0, 0] : [0, 0]; x0 = c[0] - 20; y0 = c[1] - 20; x1 = c[0] + 20; y1 = c[1] + 20; } const m = Math.max(3, 0.08 * Math.max(x1 - x0, y1 - y0)); return { x0: x0 - m, y0: y0 - m, x1: x1 + m, y1: y1 + m }; }
  // the cut drawn over a plan: dash-dot line, the looking side shown by an arrow at each end (with the letter) and on each segment
  function cutSVG(map, pts, flip, o = {}) { if (!pts || pts.length < 1) return ''; const Q = pts.map((q) => map.P(q)), f = (v) => v.toFixed(1), ink = o.ink || '#1f2a3a', r = o.r || 9; let h = '';
    if (Q.length > 1) h += `<polyline points="${Q.map((q) => f(q[0]) + ',' + f(q[1])).join(' ')}" fill="none" stroke="${ink}" stroke-width="${o.w || 1.8}" stroke-dasharray="14 4 3 4"/>`;
    const lookAt = (i) => { const a2 = Q[i], b2 = Q[i + 1], dx = b2[0] - a2[0], dy = b2[1] - a2[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L; return flip ? [-uy, ux] : [uy, -ux]; };   // screen y down: the plan's left of the line
    for (let i = 0; i + 1 < Q.length; i++) { if (!o.mids) break; const m = [(Q[i][0] + Q[i + 1][0]) / 2, (Q[i][1] + Q[i + 1][1]) / 2], l = lookAt(i); h += `<path d="M${f(m[0] + l[0] * 4)} ${f(m[1] + l[1] * 4)}l${f(l[0] * 9 - l[1] * 5)} ${f(l[1] * 9 + l[0] * 5)}M${f(m[0] + l[0] * 4)} ${f(m[1] + l[1] * 4)}l${f(l[0] * 9 + l[1] * 5)} ${f(l[1] * 9 - l[0] * 5)}" stroke="${ink}" stroke-width="1.5" fill="none" opacity=".75"/>`; }
    if (Q.length > 1) for (const [c, i] of [[Q[0], 0], [Q.at(-1), Q.length - 2]]) { const l = lookAt(i), ps = [-l[1], l[0]];
      h += `<path d="M${f(c[0] + l[0] * r * 2.4)} ${f(c[1] + l[1] * r * 2.4)}L${f(c[0] + ps[0] * r)} ${f(c[1] + ps[1] * r)}L${f(c[0] - ps[0] * r)} ${f(c[1] - ps[1] * r)}Z" fill="${ink}"/><circle cx="${f(c[0])}" cy="${f(c[1])}" r="${r}" fill="#fff" stroke="${ink}" stroke-width="1.4"/><text x="${f(c[0])}" y="${f(c[1] + r * 0.42)}" text-anchor="middle" font-size="${f(r * 1.2)}" font-weight="700" fill="${ink}">${esc(o.name || 'A')}</text>`; }
    return h; }
  const secNow = () => { try { return secPane()?.section?.() || null; } catch { return null; } };
  // the editor at preview size
  function secEditor(open = true) { if (!open) { SE.el?.remove(); SE.el = null; document.removeEventListener('keydown', secKey, true); return; } if (SE.el) return;
    const bs = bsNow(), cur = secNow(); let last = null; try { last = JSON.parse(localStorage.getItem(SECLAST) || 'null'); } catch { }
    SE.pts = cur ? cur.pts.map((q) => q.slice()) : last?.pts?.length >= 2 ? last.pts : []; SE.flip = cur ? !!cur.flip : !!last?.flip; SE.drawing = SE.pts.length < 2; SE.lv = SE.lv && bs?.levels.some((l) => l.id === SE.lv) ? SE.lv : curLv() || bs?.levels[0]?.id; SE.drag = -1; SE.hover = null;
    closePops(); const el = document.createElement('div'); el.className = 'sxs'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Draw the section');
    el.innerHTML = `<div class="sxs-win"><header class="sxs-head"><b>Section ${esc(cur?.name || 'A')}</b><span class="sxs-hint"></span><label class="sxs-lv">Level <select data-se="lv">${(bs?.levels || []).map((l) => `<option value="${esc(l.id)}" ${l.id === SE.lv ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label><button type="button" class="sp-x" data-se="x" aria-label="Close">×</button></header>
      <div class="sxs-stage"><canvas class="sxs-cv"></canvas><svg class="sxs-svg"></svg></div>
      <footer class="sxs-foot"><span class="sxs-len"></span><button type="button" class="btn sm" data-se="clear">Clear</button><button type="button" class="btn sm" data-se="flip" title="Look the other way">Flip view ⇄</button><span style="flex:1"></span><button type="button" class="btn sm" data-se="x">Cancel</button><button type="button" class="btn sm primary" data-se="ok">Use this section</button></footer></div>`;
    root.append(el); SE.el = el; document.addEventListener('keydown', secKey, true);
    el.addEventListener('click', (e) => { const k = e.target.closest('[data-se]')?.dataset.se; if (!k || e.target.tagName === 'SELECT') return; e.stopPropagation();
      if (k === 'x') secEditor(false); else if (k === 'clear') { SE.pts = []; SE.drawing = true; secEdDraw(); } else if (k === 'flip') { SE.flip = !SE.flip; secEdDraw(); } else if (k === 'ok') secConfirm(); });
    el.querySelector('[data-se=lv]').onchange = (e) => { SE.lv = e.target.value; secEdLay(); };
    const sv = el.querySelector('.sxs-svg'), at = (e) => { const r = sv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }, world = (e) => { const [px, py] = at(e); return SE.map.inv(px * SE.dpr, py * SE.dpr); };
    const snap = (q, e) => { if (!e.shiftKey || !SE.pts.length) return q; const a2 = SE.pts.at(-1), dx = q[0] - a2[0], dy = q[1] - a2[1], L = Math.hypot(dx, dy), an = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12); return [a2[0] + Math.cos(an) * L, a2[1] + Math.sin(an) * L]; };
    const near = (e, list, px = 10) => { const [mx, my] = at(e); let best = -1, bd = px; list.forEach((q, i) => { const s2 = SE.map.P(q).map((v) => v / SE.dpr), d = Math.hypot(s2[0] - mx, s2[1] - my); if (d < bd) { bd = d; best = i; } }); return best; };
    const mids = () => SE.pts.slice(1).map((q, i) => [(q[0] + SE.pts[i][0]) / 2, (q[1] + SE.pts[i][1]) / 2]);
    const okTurn = (P) => { for (let i = 1; i + 1 < P.length; i++) { const a2 = P[i - 1], b2 = P[i], c2 = P[i + 1], u1 = [b2[0] - a2[0], b2[1] - a2[1]], u2 = [c2[0] - b2[0], c2[1] - b2[1]], l1 = Math.hypot(...u1), l2 = Math.hypot(...u2); if (l1 < 0.3 || l2 < 0.3 || (u1[0] * u2[0] + u1[1] * u2[1]) / (l1 * l2) < -0.985) return false; } return true; };
    sv.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; e.preventDefault(); const q = snap(world(e), e).map((v) => +v.toFixed(3));
      if (SE.drawing) { const P = [...SE.pts, q]; if (SE.pts.length && Math.hypot(q[0] - SE.pts.at(-1)[0], q[1] - SE.pts.at(-1)[1]) < 0.3) { if (SE.pts.length >= 2) { SE.drawing = false; secEdDraw(); } return; } if (!okTurn(P)) { secHint('A turn that sharp would fold the cut back on itself: turn less than 170°.'); return; } SE.pts = P; secEdDraw(); return; }
      const v = near(e, SE.pts); if (v >= 0) { SE.drag = v; sv.setPointerCapture(e.pointerId); return; }
      const m = near(e, mids()); if (m >= 0) { SE.pts.splice(m + 1, 0, mids()[m]); SE.drag = m + 1; sv.setPointerCapture(e.pointerId); secEdDraw(); } });
    sv.addEventListener('pointermove', (e) => { const q = snap(world(e), e); if (SE.drag >= 0) { const P = SE.pts.slice(); P[SE.drag] = q.map((v) => +v.toFixed(3)); if (okTurn(P)) SE.pts = P; secEdDraw(); return; } SE.hover = q; if (SE.drawing) secEdDraw(); else sv.style.cursor = near(e, SE.pts) >= 0 ? 'move' : near(e, mids()) >= 0 ? 'copy' : 'default'; });
    sv.addEventListener('pointerup', () => { SE.drag = -1; });
    sv.addEventListener('dblclick', (e) => { e.preventDefault(); if (SE.drawing) { if (SE.pts.length >= 2) { SE.drawing = false; secEdDraw(); } return; } const v = near(e, SE.pts); if (v >= 0 && SE.pts.length > 2) { SE.pts.splice(v, 1); secEdDraw(); } });
    sv.addEventListener('contextmenu', (e) => { e.preventDefault(); if (SE.drawing && SE.pts.length) { SE.pts.pop(); secEdDraw(); } });
    new ResizeObserver(() => secEdLay()).observe(el.querySelector('.sxs-stage')); secEdLay(); }
  function secKey(e) { if (!SE.el) return; if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (SE.drawing && SE.pts.length >= 2) { SE.drawing = false; secEdDraw(); } else secEditor(false); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (SE.drawing && SE.pts.length >= 2) { SE.drawing = false; secEdDraw(); } else if (!SE.drawing) secConfirm(); }
    else if ((e.key === 'Backspace' || e.key === 'Delete') && SE.drawing && SE.pts.length && e.target.tagName !== 'INPUT') { e.preventDefault(); SE.pts.pop(); secEdDraw(); } }
  const secHint = (t) => { const h = SE.el?.querySelector('.sxs-hint'); if (h) { h.textContent = t; h.classList.add('warn'); clearTimeout(SE.ht); SE.ht = setTimeout(() => { h.classList.remove('warn'); secEdDraw(); }, 2600); } };
  function secEdLay() { const el = SE.el; if (!el) return; const st = el.querySelector('.sxs-stage'), cv = el.querySelector('.sxs-cv'), r = st.getBoundingClientRect(), dpr = devicePixelRatio || 1; SE.dpr = dpr; cv.width = Math.max(2, Math.round(r.width * dpr)); cv.height = Math.max(2, Math.round(r.height * dpr));
    const bs = bsNow(); SE.bs = bs; SE.map = keyPlanDraw(cv, bs, SE.lv, keyBox(bs, SE.pts), { pad: 24 * dpr }); const sv = el.querySelector('.sxs-svg'); sv.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`); secEdDraw(); }
  function secEdDraw() { const el = SE.el; if (!el || !SE.map) return; const sv = el.querySelector('.sxs-svg'), d = SE.dpr, M2 = { P: (q) => SE.map.P(q).map((v) => v / d) }, f = (v) => v.toFixed(1);
    let h = cutSVG(M2, SE.pts, SE.flip, { mids: true, r: 11, w: 2.2, name: secNow()?.name || 'A' });
    if (SE.drawing && SE.pts.length && SE.hover) { const a2 = M2.P(SE.pts.at(-1)), b2 = M2.P(SE.hover), L = Math.hypot(SE.hover[0] - SE.pts.at(-1)[0], SE.hover[1] - SE.pts.at(-1)[1]); h += `<line x1="${f(a2[0])}" y1="${f(a2[1])}" x2="${f(b2[0])}" y2="${f(b2[1])}" stroke="#2f6fd6" stroke-width="1.6" stroke-dasharray="6 4"/><text x="${f((a2[0] + b2[0]) / 2)}" y="${f((a2[1] + b2[1]) / 2 - 8)}" text-anchor="middle" font-size="11" font-weight="600" fill="#2f6fd6" stroke="#fff" stroke-width="3" paint-order="stroke">${L.toFixed(2)} m</text>`; }
    if (!SE.drawing) { for (const q of SE.pts) { const c = M2.P(q); h += `<circle class="sxs-v" cx="${f(c[0])}" cy="${f(c[1])}" r="5.5" fill="#fff" stroke="#2f6fd6" stroke-width="1.8"/>`; }
      SE.pts.slice(1).forEach((q, i) => { const c = M2.P([(q[0] + SE.pts[i][0]) / 2, (q[1] + SE.pts[i][1]) / 2]); h += `<g opacity=".8"><circle cx="${f(c[0])}" cy="${f(c[1])}" r="5" fill="#fff" stroke="#9ca3af"/><path d="M${f(c[0] - 2.6)} ${f(c[1])}h5.2M${f(c[0])} ${f(c[1] - 2.6)}v5.2" stroke="#6b7280" stroke-width="1.3"/></g>`; }); }
    else for (const q of SE.pts) { const c = M2.P(q); h += `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="3.5" fill="#2f6fd6"/>`; }
    sv.innerHTML = h; const len = SE.pts.slice(1).reduce((a2, q, i) => a2 + Math.hypot(q[0] - SE.pts[i][0], q[1] - SE.pts[i][1]), 0);
    el.querySelector('.sxs-len').textContent = SE.pts.length >= 2 ? `${fmt(len, 1)} m · ${SE.pts.length - 1} segment${SE.pts.length === 2 ? '' : 's'}` : '';
    const hint = el.querySelector('.sxs-hint'); if (!hint.classList.contains('warn')) hint.textContent = SE.drawing ? (SE.pts.length ? 'Click to turn; double-click or Enter to finish · Shift: 15° steps · right-click: undo a point' : 'Click where the cut starts, then at every turn, at any angle') : 'Drag a point to move it, the + to add a turn; double-click a point to remove it. The arrows show the way the section looks.';
    el.querySelector('[data-se=ok]').disabled = SE.pts.length < 2; }
  async function secConfirm() { if (SE.pts.length < 2) return; const pts = SE.pts.map((q) => q.slice()), flip = SE.flip, w = secPane(); if (!w?.sectionSet?.({ pts, flip, on: true })) { secHint('This cut could not be used: make it longer.'); return; }
    try { localStorage.setItem(SECLAST, JSON.stringify({ pts, flip })); } catch { }
    // the plan shrinks into the key plan
    const win = SE.el.querySelector('.sxs-win'), from = win.getBoundingClientRect(); secKeyPlan(true); const to = SE.kp.getBoundingClientRect();
    win.style.transformOrigin = '0 0'; win.style.transition = 'transform .38s cubic-bezier(.2,.7,.2,1), opacity .38s'; win.style.transform = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`; win.style.opacity = '0.2'; SE.el.classList.add('sxs-out');
    SE.kp.style.opacity = '0'; await new Promise((r) => setTimeout(r, 380)); secEditor(false); SE.kp.style.transition = 'opacity .2s'; SE.kp.style.opacity = '1';
    if (UI.view !== 'persp') { await goView('persp'); for (let i = 0; i < 60 && !INST.persp.ready; i++) await new Promise((r) => setTimeout(r, 100)); }
    if (INST.persp.ready) { INST.persp.ws.sectionView?.(false); const b = keyBox(bsNow(), pts); INST.persp.ws.fitBox?.(b, 0, 1.1, false); } setTimeout(() => secKeyPlan(true), 300); }   // the building framed, its cut in view
  // the key plan in the top right corner (left of a study's results when they are open)
  function secKeyPlan(show = true) { const s = secNow(); if (!show || !s) { SE.kp?.remove(); SE.kp = null; SE.key = ''; return; }
    if (!SE.kp) { const kp = document.createElement('section'); kp.className = 'sp-card sp-kp'; kp.setAttribute('aria-label', 'Section key plan'); root.append(kp); SE.kp = kp;
      kp.addEventListener('click', async (e) => { const k = e.target.closest('[data-kp]')?.dataset.kp; if (!k) return; e.stopPropagation();
        if (k === 'edit' || k === 'plan') secEditor(true); else if (k === 'x') await secClose(); else if (k === '3d') { if (INST.persp.ready) INST.persp.ws.sectionView?.(false); if (UI.view !== 'persp') await goView('persp'); secKeyPlan(true); } else if (k === 'sec') { await sectionView(true); secKeyPlan(true); } else if (k === 'flip') { secPane()?.sectionSet?.({ flip: !s.flip }); setTimeout(() => { secKeyPlan(true); INST.persp.ws.secFit?.(); }, 150); } }); }
    const on = secViewOn(), kp = SE.kp, res = app.querySelector('.sp-studyres'), resOn = res && !res.hidden && res.offsetWidth > 0; kp.style.right = (resOn ? 60 + res.offsetWidth + 10 : 60) + 'px';
    const field = ST.res && ST.res.onSection ? ST.res : null;
    kp.innerHTML = `<header><b>Section ${esc(s.name || 'A')}</b><span class="sp-kp-sub">${fmt(s.len, 1)} m${s.segs.length > 1 ? ` · ${s.segs.length} segments` : ''}</span><button type="button" class="sp-x" data-kp="x" title="Close the section" aria-label="Close the section">×</button></header>
      <div class="sp-kp-plan" data-kp="plan" title="Change the cut"><canvas></canvas><svg></svg><span class="sp-kp-edit">✎ Edit</span></div>
      <div class="sp-kp-acts"><div class="seg" role="group" aria-label="Section view"><button type="button" data-kp="3d" aria-pressed="${!on}">3D cut</button><button type="button" data-kp="sec" aria-pressed="${on}">Section</button></div><button type="button" class="btn sm" data-kp="flip" title="Look the other way">⇄</button></div>
      ${field ? `<p class="sp-kp-note">${esc(field.title || '')} on the cut</p>` : ''}`;
    const box = kp.querySelector('.sp-kp-plan'), cv = box.querySelector('canvas'), sv = box.querySelector('svg'), dpr = devicePixelRatio || 1, Wd = 236, Hd = 150; cv.width = Wd * dpr; cv.height = Hd * dpr; cv.style.width = Wd + 'px'; cv.style.height = Hd + 'px'; sv.setAttribute('viewBox', `0 0 ${Wd} ${Hd}`);
    const bs = bsNow(), lv = SE.lv || curLv() || bs?.levels[0]?.id, map = keyPlanDraw(cv, bs, lv, keyBox(bs, s.pts), { pad: 8 * dpr, names: false }); sv.innerHTML = cutSVG({ P: (q) => map.P(q).map((v) => v / dpr) }, s.pts, s.flip, { r: 7, w: 1.6, name: s.name });
    SE.key = JSON.stringify([s.pts, s.flip, on, resOn, !!field]); }
  async function secClose() { if (secViewOn()) await sectionView(false); secPane()?.sectionSet?.(null); if (INST.persp.ready) INST.persp.ws.sectionField?.(null); secKeyPlan(false); if (ST.res?.onSection) { ST.res = null; clearAll(); drawStudy(); } }
  // keep the key plan with the model (undo, the other pane, a study's results opening beside it)
  const secTick = setInterval(() => { const s = secNow(); if (!s) { if (SE.kp) secKeyPlan(false); return; } const res = app.querySelector('.sp-studyres'), resOn = res && !res.hidden && res.offsetWidth > 0, key = JSON.stringify([s.pts, s.flip, secViewOn(), resOn, !!(ST.res && ST.res.onSection)]); if (key !== SE.key) secKeyPlan(true); }, 700);
  window.__wsSection = { edit: () => secEditor(true), state: () => ({ editor: !!SE.el, drawing: SE.drawing, pts: SE.pts.map((q) => q.slice()), flip: SE.flip, keyplan: !!SE.kp, map: SE.map ? { k: SE.map.k / (SE.dpr || 1) } : null }), toScreen: (q) => { if (!SE.el || !SE.map) return null; const r = SE.el.querySelector('.sxs-svg').getBoundingClientRect(), s2 = SE.map.P(q); return [r.left + s2[0] / SE.dpr, r.top + s2[1] / SE.dpr]; }, close: () => secClose() };
  function drawSec() { closePops(); secEditor(true); }
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
  const IN_VIEW = { sunhours: 1, radiation: 1, skyview: 1, shadebenefit: 1, solarenvelope: 1, utci: 1, wind: 1, stormwater: 1, snow: 1, structure: 1, evac: 1, privacy: 1, wayfinding: 1, spacesyntax: 1, movementdepth: 1, isovist: 1, views: 1, cameras: 1, daylight: 1, 'fire-evacuation': 1, watersound: 1, vent: 1, acoustics: 1 }, DAYS = [['03-21', '21 March'], ['06-21', '21 June'], ['12-21', '21 December']];
  const ENVELOPES = [['equinox', 'Equinoxes, 9:00 to 15:00', [[3, 20], [9, 22]], 9, 15], ['winter', 'Winter solstice, 10:00 to 14:00', [[12, 21]], 10, 14], ['summer', 'Summer solstice, 8:00 to 17:00', [[6, 21]], 8, 17]];
  const PERIODS = [['year', 'Whole year', 1, 12], ['summer', 'Summer · June to August', 6, 8], ['winter', 'Winter · December to February', 12, 2]];
  // the periods of a series (2026-11-09): each month, and the four three-month seasons (named by their months: the site may be south)
  const MONTHN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const SER_PERIODS = Object.fromEntries([...MONTHN.map((n, i) => [`m${i + 1}`, n, i + 1, i + 1]), ['q-djf', 'December to February', 12, 2], ['q-mam', 'March to May', 3, 5], ['q-jja', 'June to August', 6, 8], ['q-son', 'September to November', 9, 11]].map((x) => [x[0], x]));
  const periodDef = (k) => PERIODS.find((x) => x[0] === k) || SER_PERIODS[k] || PERIODS[0];
  const studyCard = el('section', 'sp-card sp-studycard'); studyCard.hidden = true; studyCard.setAttribute('aria-label', 'Simulation settings');
  const resCard = el('section', 'sp-card sp-studyres'); resCard.hidden = true; resCard.setAttribute('aria-label', 'Simulation results');
  const legend = el('div', 'sp-card sp-legend'); legend.hidden = true; root.append(studyCard, resCard, legend);
  const ST = { dlLevel: 'draft', dlTau: 0.6, dlRf: 0.2, dlRw: 0.5, dlRc: 0.8, dlHead: 2.4, camMode: 'budget', camN: 4, camWant: '0.95', camLevel: 'recognise', camH: 2.7, camTgt: '1', camTypes: { dome: true, bullet: true, fish: true }, vwLevel: 'draft', vwEye: '1.07', vwHead: 2.4, vwFar: 7.5, vwNature: false, vwMotion: true, isoEye: '1.0', isoTgt: '0.6', isoView: null, isoPick: false, ssLevel: 'standard', ssVh: '1.6', ssGlass: true, id: null, day: '03-21', sunH0: 0, sunH1: 24, sunStep: 15, period: 'year', envelope: 'equinox', utciHours: 'sun', windMode: 'yearly', windDir: null, windSpeed: null, storm: '50', cover: 'mixed', snowCm: '30', system: null, span: '7.5', bearing: '150', circW: 'use', circUse: {}, priv: { sides: ['top', 'bottom'], dS: 4, eye: 1.6, dO: 15, hO: 9, doors: false }, wayEye: '1.6', wayStart: '', wayFurn: true, wsLoud: 'typical', egStrat: 'all', dlWhere: 'plan', egUse: 'office', egDetect: '60', egRatio: '4', egMix: 'typical', egRuns: 20, egSeed: 1, egFire: null, egPick: false, egSpeed: 30, egPlay: true, egT: 0, area: 3, view: {}, res: null, key: '', sig: '', at: null, busy: false, cancel: false, err: '', saved: '', exp: false, areaOpen: false, rose: null, roseErr: '' };
  // the project's analysis grid (Project props › Default): 0 = automatic
  // simulation quality (2026-11-09): one setting above Add simulation for every study, from Draft (quick results while designing:
  // the automatic grids, as before) to Refined (finer grids, slower: results to present). A grid set in Project props › Default
  // is kept as set (Custom). Kept with the project's conditions, so each result records the quality it ran at.
  const QUAL = [
    { k: 'draft', name: 'Draft', f: 1, flow: 160, lv: 'draft', sun: 15, dome: 1, note: 'Quick results while you design: the automatic grids; Sun hours every 15 min (Ladybug timestep 4), Sky view on 145 sky patches (Ladybug resolution 1).' },
    { k: 'standard', name: 'Standard', f: 1.5, flow: 260, lv: 'standard', sun: 10, dome: 2, note: 'Grids 1.5 times finer than Draft; Sun hours every 10 min (timestep 6), Sky view on 577 patches (resolution 2).' },
    { k: 'refined', name: 'Refined', f: 2, flow: 400, lv: 'fine', sun: 5, dome: 3, note: 'Grids twice as fine as Draft; Sun hours every 5 min (timestep 12), Sky view on 1,297 patches (resolution 3): results to present. Slower.' }];
  const qualOf = () => QUAL.find((q) => q.k === S.conditionsOf(p).defaults?.quality) || QUAL[0];
  // Sun hours' time step follows the quality as Ladybug's _timestep_ (Draft 4 an hour, Standard 6, Refined 12) unless set by hand
  const syncLevels = () => { const q = qualOf(); ST.dlLevel = ST.vwLevel = ST.ssLevel = q.lv; if (!ST.sunStepHand) ST.sunStep = q.sun; };
  // the automatic grids for the study area as it is (cached per area and model), the base that Standard and Refined make finer
  const AUTO = { key: '', v: null };
  function autoCells() { const w = INST.persp.ready ? INST.persp.ws : null; if (!w?.studySize) return null; let mk = ''; try { mk = String(w.model()).length; } catch { }
    const key = JSON.stringify([ST.area, mk]); if (AUTO.key === key) return AUTO.v; let z = null; try { w.studyArea?.(ST.area); w.studyCell?.(0); w.surfaceCell?.(0); z = w.studySize({ maxCells: 160 }); } catch { }
    AUTO.key = key; AUTO.v = z && z.cell ? { cell: z.cell, surf: z.surfCell || 0 } : null; return AUTO.v; }
  const gridSet = () => { const g = S.conditionsOf(p).defaults?.grid; return g && g !== 'Auto' ? +g || 0 : 0; };
  const gridOf = (q = qualOf()) => { const g = gridSet(); if (g || q.f === 1) return g; const a = autoCells(); return a ? Math.max(0.25, +(a.cell / q.f).toFixed(2)) : 0; };
  // the building surface grid and the detail of the flow studies (Project props › Default, 2026-11-01)
  const surfSet = () => { const g = S.conditionsOf(p).defaults?.surfGrid; return g && g !== 'Auto' ? +g || 0 : 0; };
  const surfOf = (q = qualOf()) => { const g = surfSet(); if (g || q.f === 1) return g; const a = autoCells(); return a && a.surf ? Math.max(0.2, +(a.surf / q.f).toFixed(2)) : 0; };
  // the flow studies (wind, snow, water) take their detail from the flow grid's cell count (flowOf); a finer ground grid would
  // only cap that grid from below (a finer quality came out coarser), so they keep a grid only when one is set by hand
  // studies with no grid for the quality to refine: the room airflow network, the statistical room acoustics (same time, same result)
  const NOGRID = { vent: 'an airflow network of the rooms', acoustics: 'a statistical reverberation of each room', section: 'a picture of the section' };
  const FLOWS = new Set(['wind', 'snow', 'stormwater']), gridFor = (id, q = qualOf()) => (FLOWS.has(id) ? gridSet() : gridOf(q));
  const flowSet = () => ({ Fine: 260, 'Very fine': 400 })[S.conditionsOf(p).defaults?.flowDetail] || 160;
  const flowOf = (q = qualOf()) => Math.max(flowSet(), q.flow);
  // a time estimate before a run (2026-11-01): milliseconds per ground cell (a) and per building square (b) for each study,
  // measured in a desktop browser; flow studies (lattice-Boltzmann) grow faster than the cell count. Each run corrects its
  // study's factor on this computer, so the estimate learns the machine.
  const COST = { sunhours: [0.03, 0.1], radiation: [0.2, 0.55], skyview: [0.15, 0.4], shadebenefit: [0.2, 0.45], solarenvelope: [0.03, 0.02], utci: [0.3, 0.02], stormwater: [0.025, 0.02], wind: [0.55, 0.02, 1], snow: [0.12, 0.02, 1] };
  const DOME_N = { 1: 145, 2: 577, 3: 1297 };   // Ladybug's sky patches at each resolution (Tregenza, Reinhart, 3)
  const SPEEDK = 'pc-study-speed', speed = () => { try { return JSON.parse(localStorage.getItem(SPEEDK)) || {}; } catch { return {}; } };
  function estimate(id, q = qualOf()) { const c = COST[id]; if (!c) return estInterior(id, q); if (!INST.persp.ready || !INST.persp.ws.studySize) return null; let z = null; try { const g = gridFor(id, q), sf = surfOf(q); INST.persp.ws.studyArea?.(ST.area); INST.persp.ws.studyCell?.(g); INST.persp.ws.surfaceCell?.(sf); z = INST.persp.ws.studySize({ maxCells: flowOf(q) }); INST.persp.ws.studyCell?.(gridOf()); INST.persp.ws.surfaceCell?.(surfOf()); } catch { } if (!z) return null;
    const flow = !!c[2], n = flow ? z.flowCells : z.cells, side = flow ? z.flowSide : 0, mode = id === 'wind' && ST.windMode !== 'yearly' ? 0.15 : 1, sunK = id === 'sunhours' ? Math.max(0.2, (ST.sunH1 - ST.sunH0) / 24 * 15 / Math.max(1, ST.sunStepHand ? ST.sunStep : q.sun)) : id === 'skyview' ? DOME_N[q.dome] / 144 : 1;
    const ms = (c[0] * n * (flow ? Math.max(1, side / 160) : 1) * mode + c[1] * z.samples) * sunK * (speed()[id] || 1);
    return { ms, ...z, flow }; }
  // the interior studies plan their grid for the time of their level; that plan is their estimate
  const IPLAN = { daylight: [() => DAY, 'daylight'], views: [() => VWS, 'views'], spacesyntax: [() => SSX, 'spacesyntax'] };
  function estInterior(id, q = qualOf()) { const P0 = IPLAN[id]; if (!P0 || !INST.persp.ready) return null; try { const sc = INST.persp.ws.planScene?.(P0[1]); if (!sc || !sc.walls?.length) return null; const pl = P0[0]().plan(sc, { level: q.lv }); return pl && pl.est ? { ms: pl.est * 1000, interior: true, sp: pl.sp, n: pl.n } : null; } catch { return null; } }
  const dur = (ms) => (ms < 1500 ? 'about a second' : ms < 60000 ? `about ${Math.round(ms / 1000)} s` : ms < 3600000 ? `about ${Math.round(ms / 60000)} min` : 'over an hour');
  function learn(id, actual) { const e = ST.estAtRun; if (!e || !e.ms || !actual || !COST[id]) return; const S0 = speed(), k = (S0[id] || 1) * actual / e.ms; S0[id] = +Math.max(0.05, Math.min(20, 0.6 * (S0[id] || 1) + 0.4 * k)).toFixed(3); try { localStorage.setItem(SPEEDK, JSON.stringify(S0)); } catch { } }
  const estLine = (e) => e && !e.interior ? `<p class="sp-note sp-est"><b>${esc(qualOf().name)} · estimated time: ${dur(e.ms)}</b> · ${e.flow ? `flow grid ${fmt(e.flowCells)} cells at ${fmt(e.flowCell, 1)} m` : `ground ${fmt(e.cells)} cells at ${fmt(e.cell, 2)} m`}${e.samples ? ` · building ${fmt(e.samples)} squares at ${fmt(e.surfCell, 2)} m` : ''}. Quality: set above Add simulation${gridSet() || surfSet() ? ' (a grid set in Project props › Default is kept)' : ''}.${e.ms > 120000 ? ' <span class="sp-warn">Long: Draft or a smaller area is quicker.</span>' : ''}</p>` : '';
  const DIR16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const AREAS = [[1, '1× · the building and 40 m round it'], [2, '2×'], [3, '3× · the default'], [4, '4×']];
  // every building study has the same card (2026-10-31): a mode where the study has one, the study area on the site before Start,
  // Start / Stop and Change area, map views (chips) that switch without running again, and the study's own input at the foot
  const SPEC = {
    sunhours: { views: [['hours', 'Sun hours'], ['two', '2 h or more']], input: 'day', about: 'Hours of direct sun on the ground through one day.' },
    radiation: { views: [['kwh', 'kWh/m²'], ['share', 'Share of open ground']], input: 'period', about: 'Sunlight reaching the ground, direct and diffuse, from the project weather.' },
    skyview: { views: [['sky', 'Sky view'], ['low', 'Under 50 %']], about: 'How much of the sky each spot of ground sees.' },
    shadebenefit: { views: [['net', 'Net'], ['helps', 'Helps'], ['costs', 'Costs']], about: 'Where the design’s shade helps in hot hours or costs warmth in cool ones, over a year of the project weather.' },
    solarenvelope: { views: [['height', 'Height'], ['low', 'Under 10 m']], input: 'envelope', about: 'The tallest you could build at each spot without shading the surrounding buildings.' },
    utci: { mode: ['utciHours', [['sun', 'Sun-up hours'], ['all', 'All hours']]], views: [['comfort', 'Comfort'], ['heat', 'Heat'], ['cold', 'Cold']], input: 'period', about: 'Outdoor thermal comfort (UTCI) through the hours of the period, from the project weather.' },
    wind: { mode: ['windMode', [['single', 'Single direction'], ['yearly', 'Yearly comfort'], ['section', 'On the section']]], views: () => (ST.windMode === 'single' ? [['speed', 'Wind speed'], ['pressure', 'Pressure']] : ST.windMode === 'section' ? [['speed', 'Wind speed'], ['ratio', 'Speed-up']] : [['comfort', 'Comfort'], ['risk', 'Risk'], ['speedup', 'Speed-up']]), input: 'rose',
      about: () => (ST.windMode === 'section' ? 'The wind along the section: a vertical slice of the flow over and round the cut through the building, for one wind (pick its direction on the rose; it should run along the cut).' : ST.windMode === 'single' ? 'Wind speed and pressure on the ground for one wind: pick its direction on the rose.' : 'Pedestrian wind comfort through the year (Lawson), from the project weather’s wind in eight directions.') },
  };
  SPEC.watersound = { mode: ['wsLoud', [['gentle', 'Gentle falls'], ['typical', 'Typical'], ['loud', 'Loud falls']]], views: [['level', 'Sound level'], ['quiet', '55 dB(A) or more']], input: 'watersound', building: true, about: 'How loud the site’s falls and streams are on the ground, on the facades and at each room’s windows, and inside with the windows open or shut.' };
  SPEC.stormwater = { views: [['map', 'Drainage'], ['flow', 'Flow paths'], ['pond', 'Ponding'], ['runoff', 'Runoff']], input: 'storm', about: 'Where the rain of one design storm runs over the ground and where it can collect, on the terrain.' };
  SPEC.structure = { views: [['load', 'Column load'], ['size', 'Column size'], ['pressure', 'Foundation'], ['depth', 'Floor depth']], input: 'structure', noArea: true, about: 'A first column grid in every mass: loads down to the ground, column sizes, floor depth and the pressure on the ground, by rules of thumb for early design.' };
  // structural systems for early sizing: floor dead load (kPa, with finishes and partitions), floor depth from the span, and the
  // column's design strength in compression (MPa, with slenderness and reinforcement folded in)
  const SYSTEMS = [['concrete', 'Concrete flat plate', (sp) => 24 * Math.max(0.2, sp / 30) + 1.5, (sp) => Math.max(0.2, sp / 30), 20, 'concrete flat plate (slab span/30, f′c 35 MPa columns with 2 % steel)'],
    ['steel', 'Steel frame', () => 3.0 + 1.5, (sp) => sp / 22 + 0.14, 190, 'steel beams (span/22) under a 140 mm composite deck, 350 MPa columns'],
    ['timber', 'Mass timber', () => 1.5 + 1.5, (sp) => sp / 18 + 0.175, 12, 'glulam beams (span/18) under 175 mm CLT, glulam columns']];
  const LIVE = { Residential: 1.9, Office: 2.4, Retail: 4.8, Hotel: 1.9, Education: 2.4, Industrial: 6.0 };   // NBC 2020 typical occupancy loads (kPa)
  const systemOf = () => ST.system || (() => { const l = (api.layers?.() || []).find((x) => /struct/i.test(x.name) && x.material); const m = l?.material || ''; return /steel/.test(m) ? 'steel' : /glulam|clt|timber/.test(m) ? 'timber' : 'concrete'; })();
  const rampHex = (name, t) => { const cols = INST.persp.ws?.rampColors?.(name) || ['#888888', '#888888'], k = Math.max(0, Math.min(1, t)) * (cols.length - 1), i = Math.min(cols.length - 2, Math.floor(k)), u = k - i, A = parseInt(cols[i].slice(1), 16), B = parseInt(cols[i + 1].slice(1), 16), m = (b) => Math.round(((A >> b) & 255) * (1 - u) + ((B >> b) & 255) * u); return `rgb(${m(16)},${m(8)},${m(0)})`; };
  // interior studies (2026-10-31) run on the level chosen in the Level menu (top left) and paint its floor, in 2D and 3D
  SPEC.evac = { mode: ['circW', [['use', 'Weighted by use'], ['same', 'Every pair the same']]], views: [['walks', 'Walks'], ['density', 'Density']], input: 'places', noArea: true, interior: true,
    about: 'Where people walk between the rooms they use on this level: the shortest routes and an ant colony’s walks, which settle on the good routes and build up as dark bands.' };
  SPEC.privacy = { views: [['exp', 'Seen from outside'], ['need', 'Privacy need']], input: 'privacy', noArea: true, interior: true,
    about: 'How much of each room can be seen from the street and from a building opposite, through the windows of this level.' };
  SPEC.wayfinding = { mode: ['wayEye', [['1.6', 'Standing 1.6 m'], ['1.2', 'Wheelchair 1.2 m']]], views: [['depth', 'Visual depth'], ['routes', 'Routes']], input: 'wayfinding', noArea: true, interior: true,
    about: 'How easily each room is found from the start: the walk to its door, the decision points on the way, where a sign helps, and how many look-arounds each spot needs.' };
  // Space syntax and Movement depth (2026-11-01): the visibility graph of this level, as the study page computed it; the page's
  // detail levels, analysis heights and colours
  const SSV = { mode: ['ssVh', [['1.6', 'See · eye 1.6 m'], ['0.5', 'Walk · knee 0.5 m']]], input: 'ss', noArea: true, interior: true };
  SPEC.spacesyntax = { ...SSV, views: [['integ', 'Integration'], ['r3', 'Integration R3'], ['conn', 'Connectivity'], ['flowdepth', 'Movement + depth'], ['gate', 'Agents']],
    about: 'How well each spot of this level is connected by sight to the rest (visibility graph analysis): integrated spots draw people and movement, segregated ones stay quiet.' };
  SPEC.movementdepth = { ...SSV, views: [['flowdepth', 'Movement + depth'], ['integ', 'Integration'], ['gate', 'Agents']],
    about: 'Where movement gathers and how deep each spot lies from the rest: agents walk towards what they see, and their crossings are combined with visual integration.' };
  // Daylight (2026-11-01): the study page's climate-based daylight, with the project weather; its settings, views and colours
  SPEC.daylight = { mode: ['dlWhere', [['plan', 'On the floor'], ['section', 'On the section']]], views: () => (ST.dlWhere === 'section' ? [['df', 'Daylight factor'], ['da', 'Daylight autonomy']] : [['sda', 'sDA'], ['ase', 'ASE'], ['df', 'Daylight factor'], ['opt2', 'Option 2']]), input: 'dl', noArea: true, interior: true,
    about: 'Daylight on the work plane of this level over a year of the project weather: where it is daylit enough (sDA), where direct sun is too much (ASE), the daylight factor and the LEED v4.1 illuminance check.' };
  // Camera coverage (2026-11-01): the study page's DORI levels, camera types and search, and its colours
  SPEC.cameras = { mode: ['camMode', [['budget', 'I can buy N cameras'], ['all', 'Cover everything']]], views: [['count', 'How many see it'], ['cam', 'Which camera']], input: 'cam', noArea: true, interior: true,
    about: 'Where to put security cameras on this level: the fewest positions on the walls and ceiling that watch the most floor at the detail you need (detect, observe, recognise or identify a person).' };
  // View analysis (2026-11-01): the study page's LEED Quality Views screening, its detail levels, settings and colours
  SPEC.views = { mode: ['vwEye', [['1.07', 'Seated 1.07 m'], ['1.6', 'Standing 1.6 m']]], views: [['quality', 'Quality views'], ['vf', 'View factor'], ['dist', 'Distance to window']], input: 'vw', noArea: true, interior: true,
    about: 'Where on this level people see out through the windows, and whether those are quality views (LEED v4.1 Quality Views): directions, nature or sky, movement, distance and how much of the view the window fills.' };
  // Isovist safety (2026-11-01): the study page's eye heights, targets and colours
  SPEC.isovist = { mode: ['isoEye', [['1.0', 'Child 1.0 m'], ['1.2', 'Wheelchair 1.2 m'], ['1.6', 'Adult 1.6 m']]], views: [['seen', 'Seen and blind'], ['eyes', 'Eye heights']], input: 'iso', noArea: true, interior: true,
    about: 'From where someone watches (a parent, a teacher, a nurse): which floor they see from their eye height, and the blind spots behind furniture and walls in the room around them.' };
  // Fire evacuation (2026-11-06): the whole building, every level and its stairs; a hospital's progressive horizontal evacuation,
  // then down the stairs if chosen; many runs with random inputs, the run nearest the median played back in 2D and 3D
  SPEC['fire-evacuation'] = { mode: ['egStrat', [['all', 'Everyone out'], ['horizontal', 'Hospital: next zone'], ['down', 'Hospital: then out']]], views: () => (ST.egStrat === 'all' ? [['trails', 'Routes'], ['density', 'Peak crowding'], ['time', 'Time out']] : [['trails', 'Routes'], ['density', 'Peak crowding'], ['time', 'Time to safety'], ['wait', 'Waiting for staff']]), input: 'egress', noArea: true, interior: true, building: true,
    about: 'Everyone out: a fire starts in a room, the alarm sounds, people take their time to react and then walk to the nearest way out, queueing at doors and stairs; each person’s route is left as a purple trail, with the time of each stage. Hospital: how long it takes the staff on duty to move the patients of the compartment where a fire starts into the next compartment on the same floor, and, if chosen, everyone on the fire floor and above down the stairs and out. The whole building, many runs with random inputs.' };
  // Natural ventilation (2026-11-06): the whole building's airflow network (every level, stairs and voids between them) for one
  // wind, or through the year's window-open hours of the project weather; air changes painted on every floor, flows at the openings
  SPEC.vent = { mode: ['vnMode', [['one', 'One wind'], ['year', 'Through the year']]], views: () => (ST.vnMode === 'year' ? [['hours', 'Hours at target'], ['median', 'Typical air changes'], ['fresh', 'Outdoor air share']] : [['ach', 'Air changes'], ['fresh', 'Outdoor air share']]), input: 'vent', noArea: true, interior: true, building: true,
    about: () => (ST.vnMode === 'year' ? 'For every hour of the project weather when the windows would be open: the air changes of each room with that hour’s wind and temperature, and how often each room reaches the target.' : 'Fresh air through the windows and doors of the whole building for one wind: pressure on the facades and the stack between floors push air through each opening; the air changes of every room, painted on each floor.') };
  // Indoor acoustics (2026-11-06): the study page's reverberation of every room on this level, from its finishes (Plan Studio)
  SPEC.acoustics = { mode: ['acFormula', [['eyring', 'Eyring'], ['sabine', 'Sabine']]], views: [['ratio', 'Against target'], ['rt', 'Reverberation'], ['sti', 'Speech clarity']], input: 'acu', noArea: true, interior: true,
    about: 'How long sound rings in each room of this level (reverberation time, six octave bands) from its volume and what absorbs: the finishes set in Plan Studio, furniture, people and the air; against the target for the room’s use (DIN 18041).' };
  Object.assign(ST, { vnMode: 'one', vnTout: 22, vnTin: 25, vnWin: '1', vnDoors: 'inside', vnTarget: '5', vnLo: 15, vnHi: 27, acFormula: 'eyring', acTarget: 'auto', acPeople: '0', acTemp: 20, acRh: 50 });
  const VN_ACH = [[0, '#b2182b'], [0.25, '#f08a3c'], [0.5, '#f3e3a0'], [0.75, '#8fcaa9'], [1, '#1f7a4d']], VN_FR = [[0, '#f1eef6'], [0.5, '#9ebcda'], [1, '#2b5a9e']], VN_H = [[0, '#b2182b'], [0.3, '#f08a3c'], [0.6, '#f3e3a0'], [0.8, '#8fcaa9'], [1, '#1f7a4d']];
  const AC_RATIO = [[0, '#2f6fa8'], [0.35, '#8cbed7'], [0.5, '#bee1aa'], [0.65, '#f5d26e'], [1, '#c83228']], AC_RT = [[0, '#ebf5eb'], [0.3, '#aad7a0'], [0.6, '#f5c85a'], [1, '#b42828']], AC_STI = [[0, '#b2182b'], [0.3, '#f08a3c'], [0.45, '#f3e3a0'], [0.6, '#8fcaa9'], [1, '#1f7a4d']];
  // rooms as bars (lowest first), with the target marked
  function roomBars(list, max, tgt, unit, dec = 1) { const L = list.slice(0, 14), H = 18 + L.length * 15, X = (v) => 104 + Math.min(1, Math.max(0, v / Math.max(1e-9, max))) * 146;
    return `<svg viewBox="0 0 260 ${H}" class="sp-hist" role="img" aria-label="Rooms, ${esc(unit)}">${L.map((x, i) => `<text x="100" y="${14 + i * 15}" text-anchor="end">${esc(String(x.name).slice(0, 18))}</text><rect x="104" y="${5 + i * 15}" width="${Math.max(1, X(x.v) - 104).toFixed(1)}" height="11" fill="${x.col}"><title>${esc(x.name)}: ${fmt(x.v, dec)} ${esc(unit)}</title></rect>${x.t != null ? `<line x1="${X(x.t)}" x2="${X(x.t)}" y1="${4 + i * 15}" y2="${17 + i * 15}" stroke="#111" stroke-width="1.4"/>` : ''}`).join('')}${tgt != null ? `<line x1="${X(tgt)}" x2="${X(tgt)}" y1="2" y2="${H - 12}" stroke="#111" stroke-dasharray="3 3"/>` : ''}<text x="104" y="${H - 2}">0</text><text x="250" y="${H - 2}" text-anchor="end">${fmt(max, dec)} ${esc(unit)}</text></svg>`; }
  const EG_MIX = [['typical', 'General ward: 40 % walk, 35 % helped, 25 % in bed', { amb: 0.4, asst: 0.35, bed: 0.25 }], ['acute', 'Acute or ICU: 15 % walk, 35 % helped, 50 % in bed', { amb: 0.15, asst: 0.35, bed: 0.5 }], ['rehab', 'Rehabilitation: 60 % walk, 30 % helped, 10 % in bed', { amb: 0.6, asst: 0.3, bed: 0.1 }]];
  const EG_DENS = [[0, '#eef2f6'], [0.18, '#bcd7ea'], [0.36, '#fde29a'], [0.62, '#f58b4c'], [1, '#b2182b']], EG_TIME = [[0, '#2e9e5b'], [0.4, '#e9d35a'], [0.7, '#f08a3c'], [1, '#c0392b']];
  // the share of moved patients safe over time: each run in grey, the run played back in blue, the median time marked
  function egChart(runs, rep, down, med) { const tMax = Math.max(60, ...runs.map((x) => (x.curve.length ? x.curve[x.curve.length - 1][0] : 0))), X = (t) => 30 + t / tMax * 222, Y = (f) => 116 - f * 104;
    const line = (x, col, w) => { const n = Math.max(1, x.pats.filter((q) => q.moved).length); return `<polyline fill="none" stroke="${col}" stroke-width="${w}" points="${[[0, 0], ...x.curve].map(([t, c]) => `${X(t).toFixed(1)},${Y(Math.min(1, c / n)).toFixed(1)}`).join(' ')}"/>`; };
    const tick = (t) => (t < 120 ? fmt(t) + ' s' : fmt(t / 60) + ' min');
    return `<svg viewBox="0 0 260 150" class="sp-hist" role="img" aria-label="Share of patients ${down ? 'out' : 'moved'} over time, every run">${[0, 0.5, 1].map((f) => `<line x1="30" x2="252" y1="${Y(f)}" y2="${Y(f)}" stroke="#eceff3"/><text x="26" y="${Y(f) + 3}" text-anchor="end">${f * 100}%</text>`).join('')}${runs.map((x) => line(x, 'rgba(120,128,140,.35)', 1)).join('')}${line(rep, '#2f6fd6', 2.2)}${Number.isFinite(med) ? `<line x1="${X(med)}" x2="${X(med)}" y1="10" y2="116" stroke="#111" stroke-dasharray="3 3"/><text x="${Math.min(240, X(med) + 3)}" y="18">P50</text>` : ''}<line x1="30" y1="116.5" x2="252" y2="116.5" stroke="#d1d5db"/><text x="30" y="132">0</text><text x="252" y="132" text-anchor="end">${tick(tMax)}</text></svg><p class="sp-note">Share of the moved patients ${down ? 'outside' : 'in the next compartment'} over time: each run in grey, the run played back in blue.</p>`; }
  const hexOf = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''), stopsOf = (R) => R.map(([t, c]) => [t, hexOf(c)]);
  const USES = [['0', 'Off'], ['1.5', 'Rarely'], ['3.5', 'Now and then'], ['6.5', 'Sometimes'], ['12', 'Often'], ['20', 'Most']], CORRIDOR = /corridor|hallway|^hall$|passage|circulation|landing|走廊/i;
  const levelPlanNow = () => { try { return INST.persp.ready ? INST.persp.ws.levelPlan?.() : null; } catch { return null; } };
  const placesOf = (pl) => (pl?.rooms || []).filter((r) => r.area >= 2 && !CORRIDOR.test(r.name)).map((r, i) => ({ name: r.name, p: r.p, area: r.area, letter: String.fromCharCode(65 + (i % 26)), use: ST.circUse[r.name] != null ? +ST.circUse[r.name] : CIRC.guessUse(r.name) }));
  SPEC.snow = { views: [['depth', 'Snow depth'], ['drift', 'Drift'], ['load', 'Roof and ground load']], input: 'snow',
    about: 'Where a snowfall drifts deep in the lee of buildings and where the winter wind scours the ground bare, and the snow load on roofs, from the project weather.' };
  const SNOWS = [['10', '10 cm'], ['30', '30 cm'], ['60', '60 cm']];
  const STORMS = [['25', '25 mm'], ['50', '50 mm'], ['100', '100 mm']], COVERS = [['lawn', 'Mostly planted', 0.25], ['mixed', 'Mixed', 0.5], ['paved', 'Mostly paved', 0.85]];
  const viewsOf = (id) => { const v = SPEC[id]?.views; return typeof v === 'function' ? v() : v || []; };
  const sigOf = (id) => JSON.stringify([id, qualOf().k, ST.area, gridOf(), surfOf(), flowOf(), ...({ sunhours: [ST.day, ST.sunH0, ST.sunH1, ST.sunStep, gridOf()], radiation: [ST.period], solarenvelope: [ST.envelope], utci: [ST.period, ST.utciHours], stormwater: [ST.storm, ST.cover], isovist: [ST.isoEye, ST.isoTgt, ST.isoView], daylight: [ST.dlLevel, ST.dlTau, ST.dlRf, ST.dlRw, ST.dlRc, ST.dlHead], cameras: [ST.camMode, ST.camN, ST.camWant, ST.camLevel, ST.camH, ST.camTgt, JSON.stringify(ST.camTypes)], views: [ST.vwLevel, ST.vwEye, ST.vwHead, ST.vwFar, ST.vwNature, ST.vwMotion], spacesyntax: [ST.ssLevel, ST.ssVh, ST.ssGlass], movementdepth: [ST.ssLevel, ST.ssVh, ST.ssGlass], snow: [ST.snowCm], wayfinding: [ST.wayEye, ST.wayStart, ST.wayFurn, INST.persp.ready ? INST.persp.ws.level?.() : ''], privacy: [JSON.stringify(ST.priv), ST.privNeedV || 0, INST.persp.ready ? INST.persp.ws.level?.() : ''], evac: [ST.circW, JSON.stringify(ST.circUse), INST.persp.ready ? INST.persp.ws.level?.() : ''], watersound: [ST.wsLoud, INST.persp.ready ? JSON.stringify(INST.persp.ws.waters?.() || []) : ''], 'fire-evacuation': [ST.egStrat, ST.egRatio, ST.egMix, ST.egUse, ST.egDetect, ST.egRuns, ST.egSeed, JSON.stringify(ST.egFire)], structure: [ST.system, ST.span, ST.bearing], vent: [ST.vnMode, ST.vnTout, ST.vnTin, ST.vnWin, ST.vnDoors, ST.vnTarget, ST.vnLo, ST.vnHi, ST.vnMode === 'one' ? ST.windDir : '', ST.vnMode === 'one' ? ST.windSpeed : ''], acoustics: [ST.acFormula, ST.acTarget, ST.acPeople, ST.acTemp, ST.acRh, INST.persp.ready ? INST.persp.ws.level?.() : ''], wind: [ST.windMode, ...(ST.windMode === 'single' ? [ST.windDir, ST.windSpeed] : [])] }[id] || [])]);
  // the map views of a result: the study's own, or made here from its values
  function addViews(id, r) {
    if (!r.views) { const base = { vals: r.vals, svals: r.svals, slo: r.slo, shi: r.shi, unit: r.unit, ramp: r.ramp, lo: r.lo, hi: r.hi, dec: r.dec, avg: r.avg, title: r.title, legendLabels: r.legendLabels }, bin = (f, title, labels, ramp = 'risk') => { const vals = r.vals.map((v) => (Number.isFinite(v) ? (f(v) ? 1 : 0) : NaN)); return { vals, unit: 'share', ramp, lo: 0, hi: 1, dec: 0, avg: statsOf(vals).avg * 100, title, legendLabels: labels }; };
      const k = viewsOf(id).map((x) => x[0]); r.views = { [k[0]]: base };
      if (id === 'sunhours') { r.views.two = bin((v) => v >= 2, 'Ground with 2 h of sun or more', ['2 h or more', '', 'Under 2 h'], 'sun'); if (r.svals) { r.views.hours.svals = r.svals; r.views.two.svals = r.svals.map((v) => (v >= 2 ? 1 : 0)); } }
      if (id === 'radiation') { const vals = r.vals.map((v) => v / Math.max(1e-9, r.open) * 100); r.views.share = { vals, svals: r.svals ? Array.from(r.svals, (v) => v / Math.max(1e-9, r.open) * 100) : null, unit: '% of open ground', ramp: 'heat', lo: 0, hi: 100, dec: 0, avg: statsOf(vals).avg, title: r.title + ' · share of open ground' }; }
      if (id === 'skyview') { r.views.low = bin((v) => v < 50, 'Ground seeing under half the sky', ['Under 50 %', '', '50 % or more']); if (r.svals) r.views.low.svals = Array.from(r.svals, (v, i) => (Number.isFinite(v) ? (v < (r.slist?.[i]?.roof ? 50 : 25) ? 1 : 0) : NaN)); }
      if (id === 'solarenvelope') { r.views.low = bin((v) => v < 10, 'Envelope under 10 m', ['Under 10 m', '', '10 m or more']); if (r.svals) r.views.low.svals = Array.from(r.svals, (v) => (Number.isFinite(v) ? (v < 10 ? 1 : 0) : NaN)); }
      if (id === 'shadebenefit') { const pos = r.vals.map((v) => (Number.isFinite(v) ? Math.max(0, v) : NaN)), neg = r.vals.map((v) => (Number.isFinite(v) ? Math.max(0, -v) : NaN));
        const sp = r.svals ? Array.from(r.svals, (v) => (Number.isFinite(v) ? Math.max(0, v) : NaN)) : null, sn = r.svals ? Array.from(r.svals, (v) => (Number.isFinite(v) ? Math.max(0, -v) : NaN)) : null;
        r.views.helps = { vals: pos, svals: sp, slo: r.slo !== undefined ? 0 : undefined, shi: r.shi, unit: 'K·h', ramp: 'heat', lo: 0, hi: r.hi, dec: 0, avg: statsOf(pos).avg, title: 'Shade benefit · where the shade helps' }; r.views.costs = { vals: neg, svals: sn, slo: r.slo !== undefined ? 0 : undefined, shi: r.shi, unit: 'K·h', ramp: 'risk', lo: 0, hi: r.hi, dec: 0, avg: statsOf(neg).avg, title: 'Shade benefit · where it costs warmth' }; } }
    return r; }
  const LBR = new Set(['sun', 'heat', 'sky', 'height']);
  function applyView(r, key) { const v = r.views[key] ? key : (viewsOf(ST.id) || []).map(([k]) => k).find((k) => r.views[k]) || Object.keys(r.views)[0];   /* no view chosen yet: the card's first */ r.svals = null; r.slo = r.shi = undefined; Object.assign(r, r.views[v]); if (LBR.has(r.ramp) && !r.views[v].legendLabels) r.ramp = 'ladybug'; r.legendLabels = r.views[v].legendLabels || null; r.legendCols = r.views[v].legendCols || null; r.view = v; return r; }
  // the result in both views (2026-10-31): the 3D topographic block and the 2D plan, with the same grid and colours
  const views2 = () => [INST.persp, INST.plan].filter((I) => I.ready && I.ws).map((I) => I.ws);
  const clearAll = () => views2().forEach((w) => w.clearStudy?.());
  const animOn = () => ST.anim !== false;
  const animate = (r) => views2().forEach((w) => w.flowAnim?.(r && r.anim && animOn() ? { X0: r.X0, Y0: r.Y0, cell: r.cell, nx: r.nx, ny: r.ny, ...r.anim } : null));
  const paintRes = (r, fit) => { if (r.paint) { r.paint(r, fit); return; } animate(r); if (INST.persp.ready) INST.persp.ws.surfacePaint?.(r.svals && r.svals.length ? { vals: r.svals, ramp: r.ramp, lo: r.slo ?? r.lo, hi: r.shi ?? r.hi } : null); views2().forEach((w) => { w.paintGrid({ X0: r.X0, Y0: r.Y0, cell: r.cell, nx: r.nx, ny: r.ny, vals: r.vals, lo: r.lo, hi: r.hi, ramp: r.ramp, fit }); w.streams?.(r.streams && ['map', 'flow'].includes(r.view) ? r.streams : null); }); sunPathFor(ST.id); };
  // ---- what the result is at the spot under the pointer (2026-10-31), in 2D and 3D
  const probeEl = el('div', 'sp-probe'); probeEl.hidden = true; root.append(probeEl);
  const PNAME = { comfort: 'Comfort', risk: 'Hours above 15 m/s', speedup: 'Speed-up', speed: 'Wind speed', pressure: 'Pressure', flow: 'Water passing', pond: 'Ponding', runoff: 'Runoff coefficient' };
  let q0 = null;
  function probeText(r, x, y) {
    if (q0 && q0.surf != null && r.svals && Number.isFinite(r.svals[q0.surf])) { const v = r.svals[q0.surf], t = r.unit === 'share' ? (v ? r.legendLabels[0] : r.legendLabels[2]) : `${fmt(v, Math.max(1, r.dec))} ${r.unit}`; return `<div class="sp-kv"><span>${q0.roof ? 'Roof' : 'Facade'}</span><b>${esc(t)}</b></div>`; }
    if (r.probe) return r.probe(x, y); const i = Math.floor((x - r.X0) / r.cell), j = Math.floor((y - r.Y0) / r.cell); if (i < 0 || j < 0 || i >= r.nx || j >= r.ny) return null; const c = j * r.nx + i, names = Object.fromEntries(viewsOf(ST.id));
    const rows = Object.entries(r.views).map(([k, v]) => { const val = v.vals[c]; if (!Number.isFinite(val) || k === 'map') return null; let t;
      if (v.ramp === 'lawson') t = CL.LAWSON[Math.round(val)]?.[1] || ''; else if (v.unit === 'share') t = val ? v.legendLabels[0] : v.legendLabels[2]; else if (k === 'flow') t = fmt(10 ** val - 1) + ' m³'; else t = `${fmt(val, Math.max(1, v.dec))} ${v.unit}`;
      return `<div class="sp-kv"><span>${esc(names[k] || PNAME[k] || k)}</span><b>${esc(t)}</b></div>`; }).filter(Boolean);
    return rows.length ? rows.join('') : (SPEC[ST.id]?.interior ? '<p class="sp-note">No floor value here: a wall, furniture or outside the analysed room.</p>' : '<p class="sp-note">A building: no ground value here.</p>'); }
  function onProbe(q, frame) {
    const r = ST.res; if (!q || !r || ST.busy || !frame) { probeEl.hidden = true; return; } q0 = q; const html = probeText(r, q.x, q.y); if (!html) { probeEl.hidden = true; return; }
    const fr = frame.getBoundingClientRect(), rr = root.getBoundingClientRect(); probeEl.innerHTML = `<b>${esc(simName(ST.id))}</b>${html}`; probeEl.hidden = false;
    const x = fr.left - rr.left + q.cx + 16, y = fr.top - rr.top + q.cy + 16; probeEl.style.left = Math.min(x, rr.width - probeEl.offsetWidth - 8) + 'px'; probeEl.style.top = Math.min(y, rr.height - probeEl.offsetHeight - 8) + 'px'; }
  const hookProbe = () => [INST.persp, INST.plan].forEach((I) => { if (I.ready && I.ws?.onProbe && !I.__probe) { I.__probe = 1; I.ws.onProbe((q) => onProbe(q, I.win.frameElement)); } });
  // ---- the day played through (Sun hours): the sun moves along the day's arc, with its shadows in 3D
  const PLAY = { t: 0, h: 0 };
  function playDay() { if (PLAY.t) { clearInterval(PLAY.t); PLAY.t = 0; drawStudy(); return; } const site = S.conditionsOf(p).site, tz = Number.isFinite(site.tz) ? site.tz : Math.round(site.lon / 15), [m, d] = ST.day.split('-').map(Number); let h = 4;
    const step = () => { h += 0.1; while (h < 22 && sunPosition(2026, m, d, h, site.lat, site.lon, tz).alt <= 0) h += 0.1; if (h >= 22) h = 4; PLAY.h = h; const sp = sunPosition(2026, m, d, h, site.lat, site.lon, tz);
      try { localStorage.setItem(SUNK, JSON.stringify({ ...sunState(), on: true, m, d, h })); } catch { } applySun(); sunPathFor(ST.id, sp); const lab = studyCard.querySelector('.sp-playh'); if (lab) lab.textContent = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`; };
    PLAY.t = setInterval(step, 80); step(); drawStudy(); }
  const stopPlay = () => { if (PLAY.t) { clearInterval(PLAY.t); PLAY.t = 0; } };
  // the sun path (after Ladybug): the 21st of every month, the hours through the year (clock time), and for Sun hours the day studied
  const SUNLIT = new Set(['sunhours', 'radiation', 'shadebenefit', 'solarenvelope', 'utci']);
  function sunPathFor(id, now) {
    if (!SUNLIT.has(id)) { views2().forEach((w) => w.sunPath?.(null)); return; } const site = S.conditionsOf(p).site; if (!Number.isFinite(site.lat)) return; const tz = Number.isFinite(site.tz) ? site.tz : Math.round(site.lon / 15);
    const pos = (m, d, h) => sunPosition(2026, m, d, h, site.lat, site.lon, tz), runs = (pts) => { const out = []; let cur = []; for (const q of pts) { if (q.alt > 0) cur.push(q); else if (cur.length) { out.push(cur); cur = []; } } if (cur.length) out.push(cur); return out.filter((x) => x.length > 1); };
    const arcs = [], hours = []; for (let m = 1; m <= 12; m++) { const pts = []; for (let h = 0; h <= 24; h += 0.25) pts.push(pos(m, 21, h)); arcs.push(...runs(pts)); }
    for (let h = 0; h < 24; h++) { const pts = []; for (let k = 0; k <= 365; k += 5) { const [m, d] = CL.monthDay(Math.min(364, k)); pts.push(pos(m, d, h)); } hours.push(...runs(pts)); }
    let day = [], suns = []; if (id === 'sunhours') { const [m, d] = ST.day.split('-').map(Number), pts = []; for (let h = 0; h <= 24; h += 0.25) pts.push(pos(m, d, h)); day = runs(pts); for (let h = 0; h < 24; h++) { const q = pos(m, d, h); if (q.alt > 0) suns.push(q); } }
    views2().forEach((w) => w.sunPath?.({ arcs, hours, day, suns, now })); }
  // the study area on the site before a run: a frame on the topographic block
  // the estimate, kept until the study, its area, the grids or the model change
  function estFor() { if (!ST.id || !INST.persp.ready) return null; let mk = ''; try { mk = String(INST.persp.ws.model()).length; } catch { } const key = JSON.stringify([ST.id, ST.area, gridOf(), surfOf(), flowOf(), ST.windMode, ST.sunStep, ST.sunH0, ST.sunH1, mk]);
    if (ST.estKey !== key) { ST.estKey = key; ST.est = estimate(ST.id); } return ST.est; }
  function showArea() { if (!ST.id || SPEC[ST.id]?.noArea || ST.res || ST.busy || !INST.persp.ready || !INST.persp.ws.studyArea) return; try { views2().forEach((w) => w.sunPath?.(null)); ST.areaInfo = INST.persp.ws.studyArea(ST.area, { show: true }); INST.plan.ready && INST.plan.ws.studyArea?.(ST.area, { show: true }); } catch { ST.areaInfo = null; } }
  // the wind of the project weather: 16 directions (share of the hours, mean speed at 10 m) for the rose, and the year's hourly
  // speeds at 1.5 m in eight directions for the comfort study
  const ROSE = { key: '', v: null };
  async function windRose() {
    const wx = await weather(), key = (wx.station || '') + wx.text.length; if (ROSE.key === key) return ROSE.v;
    const E = CL.parseEPW(wx.text), alpha = ({ open: 0.14, suburban: 0.22, city: 0.33 })[S.conditionsOf(p).site.terrain] || 0.22, sec = Array.from({ length: 16 }, () => ({ n: 0, sum: 0 })), sp8 = Array.from({ length: 8 }, () => []); let tot = 0, calm = 0;
    for (let k = 0; k < 8760; k++) { if (!Number.isFinite(E.WS[k])) continue; tot++; if (E.WS[k] < 0.5) { calm++; continue; } const d = ((E.WD[k] % 360) + 360) % 360, s16 = sec[Math.round(d / 22.5) % 16]; s16.n++; s16.sum += E.WS[k]; sp8[Math.round(d / 45) % 8].push(CL.siteWind(E.WS[k], 1.5, alpha)); }
    sp8.forEach((a) => a.sort((x, y) => x - y)); const out = sec.map((x) => ({ share: x.n / Math.max(1, tot), mean: x.n ? x.sum / x.n : 0 })), top = out.reduce((b, x, i) => (x.share > out[b].share ? i : b), 0);
    ROSE.key = key; ROSE.v = { sec: out, sp8, tot, calm: calm / Math.max(1, tot), prevailing: top * 22.5, alpha, station: E.station || wx.station || '' }; return ROSE.v; }
  function loadRose() { if (ST.rose || (ST.id !== 'wind' && ST.id !== 'vent')) return; windRose().then((r) => { ST.rose = r; ST.roseErr = ''; if (ST.id === 'wind' || ST.id === 'vent') drawStudy(); }).catch((e) => { ST.roseErr = e.message || String(e); if (ST.id === 'wind' || ST.id === 'vent') drawStudy(); }); }
  function roseSVG(R, pick) { const cx = 110, cy = 110, mx = Math.max(...R.sec.map((x) => x.share)), dir = ST.windDir ?? R.prevailing, sel = Math.round(dir / 22.5) % 16, vmax = Math.max(...R.sec.map((x) => x.mean), 1);
    const pt = (a, r) => [cx + r * Math.sin(a * Math.PI / 180), cy - r * Math.cos(a * Math.PI / 180)].map((v) => v.toFixed(1)).join(',');
    const wedges = R.sec.map((x, i) => { const r = 14 + 80 * x.share / Math.max(1e-9, mx), a0 = i * 22.5 - 10, a1 = i * 22.5 + 10, t = x.mean / vmax, col = `rgb(${Math.round(190 - 140 * t)},${Math.round(215 - 110 * t)},${Math.round(240 - 50 * t)})`;
      return `<path ${pick ? `data-wdir="${i}" role="button" tabindex="0"` : ''} class="${pick && i === sel ? 'on' : ''}" d="M${cx},${cy} L${pt(a0, r)} A${r},${r} 0 0 1 ${pt(a1, r)} Z" fill="${col}"><title>From ${DIR16[i]}: ${fmt(x.share * 100, 1)}% of hours, mean ${fmt(x.mean, 1)} m/s at 10 m</title></path>`; }).join('');
    return `<svg viewBox="0 0 220 220" class="sp-rose" aria-label="Wind rose of the project weather">${[32, 62, 94].map((r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e5e7eb"/>`).join('')}${wedges}${['N', 'E', 'S', 'W'].map((t, i) => `<text x="${pt(i * 90, 104).split(',')[0]}" y="${+pt(i * 90, 104).split(',')[1] + 3.5}" text-anchor="middle">${t}</text>`).join('')}</svg>`; }

  const simMenu = document.querySelector('.w2-simmenu');
  if (simMenu) { simMenu.querySelectorAll('[data-addsim]').forEach((b) => { void b; });
    simMenu.addEventListener('click', (e) => { const b = e.target.closest('[data-addsim]'); if (!b) return; e.stopImmediatePropagation(); simMenu.hidden = true; $('#addSimBtn')?.setAttribute('aria-expanded', 'false'); $('#addSimInt')?.setAttribute('aria-expanded', 'false'); openStudy(b.dataset.addsim); }, true); }
  const simName = (id) => (api.sims.find((x) => x.id === id) || { name: id }).name;
  // ---- every study in this page (2026-10-30): a study that does not run in the Workspace panel itself mounts its own study page
  // here, beside the left rail, after the usual handoff (pre-flight, site review, the version it runs on). Its "Back" returns to
  // the model; the model's editing controls are hidden while it is open.
  const HOST = { el: null, cleanup: null, token: 0, id: null };
  async function openHost(id) {
    closeHost(); closeStudy(); openCard(false); closePops(); palOpen(false); openSheet(false);
    const token = ++HOST.token, el = el2('section', 'sp-host'); el.setAttribute('aria-label', simName(id)); HOST.el = el; HOST.id = id; root.append(el); root.classList.add('sp-hosting');
    el.addEventListener('click', (e) => { const a = e.target.closest('a[href]'); if (!a) return; const h = a.getAttribute('href') || ''; if (/^#\/workspace(\/|$)/.test(h) || (a.closest('.shbar') && /Back/.test(a.textContent))) { e.preventDefault(); closeHost(); } }, true);
    try { const mod = await import('./pages/simulations.js?v=planned-20261104-1'); const r = await mod.render(el, [id], new URLSearchParams('autorun=workspace'), { isCurrent: () => HOST.token === token && !!HOST.el }); if (HOST.token === token) HOST.cleanup = typeof r === 'function' ? r : null; else if (typeof r === 'function') r(); }
    catch (e) { el.innerHTML = `<div class="sp-hosterr"><p>${esc(simName(id))} could not open here: ${esc(e.message || e)}.</p><a class="btn sm" href="#/simulations/${esc(id)}">Open it on its own page</a></div>`; }
  }
  function closeHost() { if (!HOST.el) return; try { HOST.cleanup?.(); } catch { } HOST.cleanup = null; HOST.el.remove(); HOST.el = null; HOST.id = null; HOST.token++; root.classList.remove('sp-hosting'); }
  const el2 = (tag, cls) => { const e = document.createElement(tag); e.className = cls; return e; };
  window.__wsHost = { open: openHost, close: closeHost, id: () => HOST.id };
  function openStudy(id) { if(plannedStudy(id)){openHost(id);return;} if (!IN_VIEW[id]) { closeStudy(); openPage(id); return; } closeHost(); if (ST.id !== id && ST.res) clearAll(); if (ST.id !== id) Object.assign(ST, { id, res: null, key: '', sig: '', at: null, err: '', saved: '', exp: false, areaOpen: false, stopped: false }); openCard(false); closePops(); palOpen(false); studyCard.hidden = false; hookProbe(); showArea(); loadRose(); drawStudy(); }
  function closeStudy() { studyCard.hidden = true; resCard.hidden = true; legend.hidden = true; ST.id = null; ST.res = null; stopPlay(); probeEl.hidden = true; clearAll(); }
  function openPage(id) { const sel = $('#workspaceStudy'); if (sel) { sel.value = id; sel.onchange?.(); } $('#sendSim')?.click(); }
  // the sky seen from a ground cell: 6 rings × 24 patches, weighted for a horizontal surface (sum 1): the sky view factor
  const SKY = (() => { const out = []; for (let i = 0; i < 6; i++) { const alt = 7.5 + i * 15, w0 = Math.sin(alt * Math.PI / 180) * Math.cos(alt * Math.PI / 180); for (let j = 0; j < 24; j++) out.push({ az: j * 15 + 7.5, alt, w: w0 }); } const t = out.reduce((a, d) => a + d.w, 0); out.forEach((d) => d.w /= t); return out; })();
  // the sky for the building's surfaces (2026-11-01): 72 patches weighted so that an open horizontal roof sees 1 (an open wall about 0.5)
  const SKYS = (() => { const out = []; for (let i = 0; i < 6; i++) { const alt = 7.5 + i * 15; for (let j = 0; j < 12; j++) out.push({ az: j * 30 + 15, alt, w: Math.cos(alt * Math.PI / 180) }); } const t = out.reduce((a, d) => a + d.w * Math.sin(d.alt * Math.PI / 180), 0); out.forEach((d) => d.w /= t); return out; })();
  // a field on a grid read at each surface square: just in front of a facade (off cells out), or under a roof square (roofs: true)
  const fieldAt = (m, list, arr, o = {}) => Float32Array.from(list, (S0) => { if (S0.roof && !o.roofs) return NaN; const off = S0.roof ? 0 : (o.off ?? 1.2) * m.cell, x = S0.p[0] + S0.n[0] * off, y = S0.p[1] + S0.n[1] * off, i0 = Math.floor((x - m.X0) / m.cell), j0 = Math.floor((y - m.Y0) / m.cell);
    let best = NaN, bd = Infinity; for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= m.nx || j >= m.ny) continue; const c = j * m.nx + i; if ((!o.roofs && m.solid && m.solid[c]) || !Number.isFinite(arr[c])) continue; const d = di * di + dj * dj; if (d < bd) { bd = d; best = arr[c]; } } return best; });
  // the means on the building's facades and roofs, for the results card
  const surfMeans = (sl, sv, unit, dec = 0) => { if (!sv || !sv.length) return []; const fac = [], roo = []; sl.forEach((S0, i) => { if (Number.isFinite(sv[i])) (S0.roof ? roo : fac).push(sv[i]); }); const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    return [...(fac.length ? [['Facades, mean', fmt(mean(fac), dec) + unit]] : []), ...(roo.length ? [['Roofs, mean', fmt(mean(roo), dec) + unit]] : [])]; };
  const onSurf = (sv) => (sv && sv.length ? `, and on each of the ${fmt(sv.length)} squares of the design's facades and roofs (imported models included)` : '');
  // the project's weather file, hourly direct normal and diffuse horizontal irradiance (EPW columns 15 and 16)
  async function weather() {
    let c = S.conditionsOf(p).site.climate; if (!c?.hash && weatherDownloadAvailable()) { await ensureProjectClimate(p); c = S.conditionsOf(p).site.climate; }
    const rec = c?.hash ? await climateFile(c.hash) : null; if (!rec?.text) throw Error('The weather for this address could not be fetched. Check the connection, or add an EPW in Project props › Default › Advanced.');
    const lines = rec.text.trim().split(/\r?\n/), h = lines[0].split(','), rows = [];
    for (const line of lines.slice(8)) { const a = line.split(','); rows.push({ m: +a[1], d: +a[2], h: +a[3], t: +a[6], dni: Math.max(0, +a[14] || 0), dhi: Math.max(0, +a[15] || 0) }); }
    return { station: c.station || c.name, lat: +h[6], lon: +h[7], tz: +h[8], rows, text: rec.text };
  }
  const statsOf = (vals) => { let lo = Infinity, hi = -Infinity, n = 0, sum = 0; for (const v of vals) if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); n++; sum += v; } return { lo: n ? lo : 0, hi: n ? hi : 0, n, avg: n ? sum / n : 0 }; };
  // Fire evacuation, everyone out (2026-11-09): a fire in any building; each person's route as a purple trail (as Circulation's
  // walks), the stages of the evacuation time (RSET) and what happened at every exit and stair
  async function evacAll(bs) {
    const nRuns = +ST.egRuns || 20, use = EGX.USES[ST.egUse] || EGX.USES.office, detect = +ST.egDetect || 60;
    const out = await EGX.run(bs, { strategy: 'all', use: ST.egUse, detect, runs: nRuns, seed: +ST.egSeed || 1, fire: ST.egFire || 'random' }, (f) => { if (ST.cancel) throw Error('Stopped.'); ST.progress = f >= 1 ? 'recording the run shown' : `run ${Math.min(nRuns, Math.max(1, Math.round(f * (nRuns + 1))))} of ${nRuns}`; const e = studyCard.querySelector('.sp-stage.run .sp-note'); if (e) e.textContent = ST.progress; });
    const { B, runs, rep, med, p90, p10 } = out, X0 = B.O[0], Y0 = B.O[1], NL = B.levels.length, box = { x0: X0, y0: Y0, x1: X0 + B.W * B.c, y1: Y0 + B.H * B.c }, P = (a, q) => EGX.pct(a, q);
    const T = (v) => (Number.isFinite(v) ? (v < 120 ? `${fmt(v)} s` : `${fmt(v / 60, 1)} min`) : '—'), ppl = rep.people, others = ppl.filter((q) => !q.own), outs = ppl.map((q) => q.tOut).filter(Number.isFinite);
    const nameOf = (li, ri) => (ri >= 0 ? B.levels[li].rooms[ri].name : 'outside');
    // by room, over all runs: the median time out
    const m = new Map(); for (const x of runs) for (const q of x.people) { if (!Number.isFinite(q.tOut)) continue; const k0 = q.li + '|' + q.room; if (!m.has(k0)) m.set(k0, []); m.get(k0).push(q.tOut); }
    const tAll = B.levels.map(() => new Float32Array(B.N).fill(NaN)); for (const [k0, a] of m) { const [li, ri] = k0.split('|').map(Number), L = B.levels[li], md = P(a, 0.5); for (let k = 0; k < B.N; k++) if (L.room[k] === ri && L.walk[k]) tAll[li][k] = md / 60; }
    const dens = B.levels.map((L, li) => Float32Array.from(L.walk, (v, k) => (v ? Math.min(3, rep.peak[li][k]) : NaN))), base = B.levels.map((L) => Float32Array.from(L.walk, (v) => (v ? 0 : NaN)));
    const tHi = Math.max(1, Math.ceil(Math.max(...outs, 60) / 60));
    const view = (lv, unit, lo, hi2, dec, title, stops, labels) => ({ lv, vals: lv[B.exitLv >= 0 ? B.exitLv : 0], unit, ramp: 'heat', lo, hi: hi2, dec, avg: 0, title, stops, legendCols: stops.map((x) => x[1]), legendLabels: labels || null });
    const TRAIL = [[0, '#ede9fe'], [0.5, '#8b5cf6'], [1, '#4c1d95']], views = { trails: view(base, 'people', 0, 1, 0, 'Fire evacuation · routes taken (run shown)', [[0, '#f4f2f8'], [1, '#f4f2f8']], ['More people', '', 'Fewer']),
      density: view(dens, 'people per m²', 0, 3, 1, 'Fire evacuation · peak crowding (run shown)', EG_DENS), time: view(tAll, 'min until out', 0, tHi, 1, 'Fire evacuation · time until out, by room (median)', EG_TIME) };
    views.trails.legendCols = TRAIL.map((x) => x[1]); views.trails.lo = 0; views.trails.hi = 1;
    const fr = B.levels[rep.fire.li], frm = fr.rooms[rep.fire.room], fc = frm ? frm.rects.reduce((a, [x, y, w2, h]) => [a[0] + (x + w2 / 2) * w2 * h, a[1] + (y + h / 2) * w2 * h, a[2] + w2 * h], [0, 0, 0]) : null, fireAt = fc && fc[2] ? { lv: fr.id, x: X0 + fc[0] / fc[2], y: Y0 + fc[1] / fc[2] } : null;
    const egTime = (t, n) => { ST.egT = t; const e = studyCard.querySelector('.sp-egt'); if (e) e.textContent = `${T(t)} of ${T(n)}`; const sl = studyCard.querySelector('[data-eg="seek"]'); if (sl && document.activeElement !== sl) { sl.max = String(n); sl.value = String(t); } };
    const show = (r, fit) => { const V = r.views[r.view] || views.trails, tr = r.view === 'trails'; views2().forEach((w2) => { w2.clearStudy?.(); w2.egressShow?.({ levels: B.levels.map((L) => ({ lv: L.id, z: L.z, box, density: { X0, Y0, cell: B.c, nx: B.W, ny: B.H, vals: V.lv[L.li], lo: V.lo, hi: V.hi } })), rampStops: V.stops, frames: rep.frames, kinds: rep.kinds, trails: tr, fire: fireAt, fit: !!fit, speed: ST.egSpeed, play: ST.egPlay, t: ST.egT || 0, onTime: w2 === INST.persp.ws ? egTime : null }); }); };
    // the stages (run shown): detection and alarm, pre-movement, travel with queueing
    const pre = others.map((q) => q.pre), trav = ppl.map((q) => q.travel).filter(Number.isFinite), qu = ppl.map((q) => q.queue), dist = ppl.map((q) => q.dist), last = rep.t;
    const exits = rep.exitUse.map((e, di) => ({ ...e, d: B.doors[di] })).filter((e) => e.n > 0).sort((a, b) => b.n - a.n), stairsUsed = rep.stairUse.map((n, si) => ({ n, S: B.stairs[si], q: rep.stairMax[si] })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
    const di = rep.doorMax.reduce((b, v, i) => (v > (rep.doorMax[b] || 0) ? i : b), 0), dd = B.doors[di], bad = runs.filter((x) => x.unfinished).length, nImp = ppl.filter((q) => q.kind === 'imp').length;
    const exName = (d) => `${esc(B.levels[d.li].name)}, ${esc(nameOf(d.li, d.sides[0] >= 0 ? d.sides[0] : d.sides[1]))} (${fmt(d.w, 1)} m)`;
    const chart = () => { const tMax = Math.max(60, ...runs.map((x) => (x.curve.length ? x.curve.at(-1)[0] : 0))), X = (t) => 30 + t / tMax * 222, Y = (f) => 116 - f * 104, n = Math.max(1, rep.n);
      const line = (x, col, w2) => `<polyline fill="none" stroke="${col}" stroke-width="${w2}" points="${[[0, 0], ...x.curve].map(([t, c]) => `${X(t).toFixed(1)},${Y(Math.min(1, c / Math.max(1, x.n))).toFixed(1)}`).join(' ')}"/>`, tick = (t) => (t < 120 ? fmt(t) + ' s' : fmt(t / 60, 1) + ' min');
      const pre99 = detect + (P(pre, 0.99) || 0), seg2 = (a, b, col, lab) => `<rect x="${X(a).toFixed(1)}" y="138" width="${Math.max(1, X(b) - X(a)).toFixed(1)}" height="8" fill="${col}"/><text x="${((X(a) + X(b)) / 2).toFixed(1)}" y="158" text-anchor="middle">${lab}</text>`;
      return `<svg viewBox="0 0 260 166" class="sp-hist" role="img" aria-label="Share of people out over time, every run, and the stages of the run shown">${[0, 0.5, 1].map((f) => `<line x1="30" x2="252" y1="${Y(f)}" y2="${Y(f)}" stroke="#eceff3"/><text x="26" y="${Y(f) + 3}" text-anchor="end">${f * 100}%</text>`).join('')}${runs.map((x) => line(x, 'rgba(120,128,140,.35)', 1)).join('')}${line(rep, '#6d28d9', 2.2)}<line x1="${X(detect)}" x2="${X(detect)}" y1="10" y2="116" stroke="#dc2626" stroke-dasharray="2 3"/><text x="${X(detect) + 3}" y="18" fill="#dc2626">alarm</text>${Number.isFinite(med) ? `<line x1="${X(med)}" x2="${X(med)}" y1="10" y2="116" stroke="#111" stroke-dasharray="3 3"/><text x="${Math.min(240, X(med) + 3)}" y="30">P50</text>` : ''}<line x1="30" y1="116.5" x2="252" y2="116.5" stroke="#d1d5db"/><text x="30" y="128">0</text><text x="252" y="128" text-anchor="end">${tick(tMax)}</text>
        ${seg2(0, detect, '#fca5a5', 'alarm')}${seg2(detect, Math.min(pre99, last || pre99), '#fcd34d', 'pre-movement')}${Number.isFinite(last) ? seg2(Math.min(pre99, last), last, '#a78bfa', 'travel') : ''}</svg>
        <p class="sp-note">People out over time: each run in grey, the run shown in purple (n = ${fmt(n)}). Below: its stages, detection and alarm, pre-movement (to the 99th percentile) and travel to the last person out.</p>`; };
    ST.egT = 0;
    return { X0, Y0, cell: B.c, nx: B.W, ny: B.H, cells: B.N * NL, avg: med, nFrames: Math.max(1, rep.frames.length - 1), views, paint: (r, fit) => show(r, fit), chartHTML: chart, chartNote: '',
      probe: (x, y) => { const lvId = INST.persp.ws.level?.(), li = B.levels.findIndex((L) => L.id === lvId), k = B.cellAt(x - X0, y - Y0); if (li < 0 || k < 0 || !B.levels[li].walk[k]) return null; const L = B.levels[li];
        return `<div class="sp-kv"><span>${esc(L.name)}</span><b>${esc(nameOf(li, L.room[k]))}</b></div><div class="sp-kv"><span>Peak crowding</span><b>${fmt(dens[li][k], 1)} per m²</b></div>${Number.isFinite(tAll[li][k]) ? `<div class="sp-kv"><span>Out after (median)</span><b>${T(tAll[li][k] * 60)}</b></div>` : ''}`; },
      csv: () => ['person,level,room,mobility,room_of_fire,alarm_s,pre_movement_s,starts_walking_s,out_s,travel_s,queueing_s,distance_m,exit', ...ppl.map((q, i) => `${i + 1},"${B.levels[q.li].name}","${nameOf(q.li, q.room)}",${q.kind === 'imp' ? 'slow' : 'typical'},${q.own ? 'yes' : 'no'},${q.tAlarm.toFixed(0)},${q.pre.toFixed(1)},${q.tStart.toFixed(1)},${Number.isFinite(q.tOut) ? q.tOut.toFixed(1) : ''},${Number.isFinite(q.travel) ? q.travel.toFixed(1) : ''},${q.queue.toFixed(1)},${q.dist.toFixed(1)},"${q.exit >= 0 ? B.levels[B.doors[q.exit].li].name + ' door ' + (q.exit + 1) : ''}"`)],
      rows: [['Everyone out (RSET), median of runs', T(med)], ['90th percentile (P90)', T(p90)], ['10th percentile (P10)', T(p10)],
        ['Run shown: fire starts in', `${esc(nameOf(rep.fire.li, rep.fire.room))}, ${esc(rep.fire.level)}`],
        ['1 · Detection and alarm', T(detect)], ['2 · Pre-movement after the alarm: first · median · 99th %', `${T(P(pre, 0.01))} · ${T(P(pre, 0.5))} · ${T(P(pre, 0.99))}`],
        ['First person out', T(Math.min(...outs))], ['3 · Travel incl. queueing: median · longest', `${T(P(trav, 0.5))} · ${T(Math.max(...trav))}`],
        ['Queueing at doors and stairs: mean · longest', `${T(qu.reduce((a, b) => a + b, 0) / Math.max(1, qu.length))} · ${T(Math.max(...qu))}`], ['Walk: median · longest', `${fmt(P(dist, 0.5))} m · ${fmt(Math.max(...dist))} m`],
        ['Last person out (run shown)', T(last)],
        ...B.levels.map((L, li) => [`${esc(L.name)} clear after`, Number.isFinite(rep.perLevel[li]) ? T(rep.perLevel[li]) : 'nobody there']),
        ...exits.map((e) => [`Exit: ${exName(e.d)}`, `${fmt(e.n)} people · last at ${T(e.last)} · ${fmt(e.n / Math.max(1, e.last - Math.min(...outs) + 1) * 60)} per min`]),
        ...stairsUsed.map((x) => [`Stair: ${esc(x.S.name)}`, `${fmt(x.n)} people · longest queue ${fmt(x.q)}`]),
        ...(dd && rep.doorMax[di] > 0 ? [['Longest door queue', `${fmt(rep.doorMax[di])} waiting at ${exName(dd)}`]] : []),
        ['People', `${fmt(rep.n)} (${B.levels.map((L, li) => `${esc(L.name)} ${ppl.filter((q) => q.li === li).length}`).join(' · ')}), ${fmt(nImp)} walking slowly`], ['Building use', esc(use.name)],
        ['Runs', `${runs.length}, seed ${ST.egSeed}`], ...(bad ? [['<span class="sp-warn">Not everyone out within 60 min</span>', `${bad} of ${runs.length} runs: someone could not reach a way out (check doors and stairs)`]] : [])],
      method: `The whole building: ${NL} level${NL === 1 ? '' : 's'} of the model on a ${fmt(B.c, 1)} m grid (rooms, walls, doors, furniture), joined by ${B.stairs.length} stair${B.stairs.length === 1 ? '' : 's'}; ${fmt(rep.n)} people placed by room use (occupant load factors after IBC 2021 Table 1004.5). In each of ${runs.length} runs the fire starts in ${ST.egFire ? 'the room you chose' : 'a random occupied room'}: its occupants set off within 10 to 30 s; everyone else hears the alarm after ${T(detect)} (detection and alarm) and sets off after a pre-movement time drawn for each person (lognormal, ${use.p1} s first to ${use.p99} s at the 99th percentile, ${esc(use.name.toLowerCase())}, after PD 7974-6:2019). Each walks to the nearest way out (outside doors on the exit level, the stairs from other levels), at 1.19 m/s on average (4 % at about 0.6 m/s), slowed in a crowd; doors let through 1.32 people per second per metre and stair flights 1.1, with queues at both (SFPE Handbook). The run nearest the median is played back; the purple trails are every route taken in it. Evacuation time (RSET) = detection and alarm + pre-movement + travel with queueing. A screening of evacuation time: no fire or smoke is computed (no available safe egress time, ASET), routes through the room of fire origin stay open, lifts are not used, and it is not a code compliance check`,
      foot: `${fmt(rep.n)} people, P50 of ${runs.length} runs, the run nearest it played back`,
      results: { p50: +med.toFixed(1), p90: +p90.toFixed(1), p10: +p10.toFixed(1), detect, preP99: +(P(pre, 0.99) || 0).toFixed(1), travelP50: +(P(trav, 0.5) || 0).toFixed(1), people: rep.n, notFinished: bad },
      settings: { strategy: 'all', use: ST.egUse, detect, runs: runs.length, seed: +ST.egSeed, fire: ST.egFire ? ST.egFire.name : 'random', label: `Everyone out · ${use.name} · alarm ${T(detect)} (Workspace)` } }; }
  // ---- studies on the section (2026-11-10): a field over the unfolded cut, painted on the cut in 3D and in the Section view
  const hexStops = (cols) => cols.map((c, i) => [i / Math.max(1, cols.length - 1), c]);
  function secPaint(r) { const V = r.views[r.view] || Object.values(r.views)[0]; for (const w2 of views2()) { w2.clearStudy?.(); w2.sectionField?.({ t0: r.F.t0, t1: r.F.t1, z0: r.F.z0, z1: r.F.z1, nx: r.F.nx, ny: r.F.ny, vals: V.vals, lo: V.lo, hi: V.hi, stops: V.stops, vx: V.arrows ? r.F.vx : null, vy: V.arrows ? r.F.vy : null, labels: V.labels || [] }); }
    if (!secViewOn()) sectionView(true).then(() => secKeyPlan(true)); else secKeyPlan(true); }
  const secOrThrow = (w) => { const s = w.section?.(); if (!s) throw Error('Draw the section first: Section in the top right, then Use this section.'); return s; };
  // wind in section: a vertical 2D lattice-Boltzmann flow along the unfolded cut (the same solver as on the ground, turned on end),
  // the ground and the cut through the buildings solid, the wind coming in at the upwind end and over the top
  async function windSection() { const w = INST.persp.ws, s = secOrThrow(w), R0 = await windRose(), alpha = R0.alpha, dir = ST.windDir ?? R0.prevailing, i16 = Math.round(dir / 22.5) % 16, dn = DIR16[i16], u10 = ST.windSpeed ?? R0.sec[i16].mean;
    let north = 0; try { north = JSON.parse(w.model()).north || 0; } catch { }
    const tt = (dir + 180 - north) * Math.PI / 180, flow = [Math.sin(tt), Math.cos(tt)], ch = [s.pts.at(-1)[0] - s.pts[0][0], s.pts.at(-1)[1] - s.pts[0][1]], cl = Math.hypot(...ch) || 1, along = (flow[0] * ch[0] + flow[1] * ch[1]) / cl, ang = Math.round(Math.acos(Math.min(1, Math.abs(along))) * 180 / Math.PI);
    if (Math.abs(along) < 0.2) throw Error(`The wind from ${dn} blows across Section ${s.name || 'A'} (${ang}° to it), so there is no flow along the cut to show. Turn the cut to run with the wind, or choose a wind direction along it (Wind, above).`);
    const q = qualOf(), want = { draft: 0.75, standard: 0.5, refined: 0.33 }[q.k] || 0.75, p0 = w.sectionProfile({ ds: 2, dz: 2 }), top = Math.max(3, p0.top || 6), span = Math.max(25, 6 * top), t0 = -span, t1 = s.len + span, z1 = Math.max(top * 3, top + 25), cap = { draft: 26000, standard: 70000, refined: 160000 }[q.k] || 26000;
    const ds = Math.max(want, Math.sqrt((t1 - t0) * z1 / cap)); ST.progress = 'solving the flow along the cut'; drawStudy(); await new Promise((r) => setTimeout(r, 0));
    const P = w.sectionProfile({ ds, dz: ds, t0, t1 }), sg = Math.sign(along), r = speedRatio(P.solid, P.nx, P.ny, [sg, 0]); if (ST.cancel) throw Error('Stopped.');
    const Uh = CL.siteWind(u10, Math.max(2, top), alpha) * Math.abs(along), N = P.nx * P.ny, speed = new Float32Array(N), ratio = new Float32Array(N);
    // speed-up: the speed with the buildings over the speed at the same point without them (the same ground, the same solver),
    // as a wind engineer's speed ratio; speed: the solver's ratio to the free stream above, at the roof-height wind
    const r0 = speedRatio(P.open, P.nx, P.ny, [sg, 0]); if (ST.cancel) throw Error('Stopped.');
    for (let c = 0; c < N; c++) { speed[c] = Number.isFinite(r[c]) ? r[c] * Uh : NaN; ratio[c] = Number.isFinite(r[c]) && Number.isFinite(r0[c]) ? r[c] / Math.max(0.3, r0[c]) : NaN; }   // at least 0.3 of the free stream below: the still air at the very ground would make any breeze a large speed-up
    // along the cut at 1.5 m above the ground: sheltered and windy stretches; over the roofs: the fastest speed-up
    let shel = 0, fast = 0, n15 = 0, peak = 0; const v15 = []; for (let i = 0; i < P.nx; i++) { const t = P.t0 + (i + 0.5) * P.ds; let jg = -1; for (let j = 0; j < P.ny; j++) if (!P.solid[j * P.nx + i]) { jg = j; break; } if (jg < 0) continue; const j15 = Math.min(P.ny - 1, jg + Math.round(1.5 / P.dz)), v = ratio[j15 * P.nx + i]; if (!Number.isFinite(v)) continue;
      if (t >= -10 && t <= s.len + 10) { n15++; v15.push(speed[j15 * P.nx + i]); if (v < 0.5) shel++; if (v > 1.2) fast++; } }
    { const all = []; for (let c = 0; c < N; c++) if (Number.isFinite(ratio[c])) all.push(ratio[c]); all.sort((x, y) => x - y); peak = all[Math.floor(all.length * 0.99)] || 0; }   // the windiest 1 %, not one cell
    const flowStops = hexStops(w.rampColors?.('flow') || ['#2b4a8c', '#3d9bd6', '#9fdcc6', '#f6e27a', '#e8702a']), F = { t0: P.t0, t1: P.t1, z0: P.z0, z1: P.z1, nx: P.nx, ny: P.ny, vx: r.vx, vy: r.vy };
    const views = { speed: { vals: speed, unit: 'm/s', lo: 0, hi: Math.max(1, 1.6 * Uh), dec: 1, title: `Wind from ${dn} · speed in section`, stops: flowStops, legendCols: flowStops.map((x) => x[1]), arrows: true },
      ratio: { vals: ratio, unit: '× the wind there without the buildings', lo: 0, hi: 1.6, dec: 2, title: `Wind from ${dn} · speed-up in section`, stops: flowStops, legendCols: flowStops.map((x) => x[1]), arrows: true } };
    return { F, views, onSection: true, paint: (rr) => secPaint(rr), cells: N, avg: Uh, title: views.speed.title, chartNote: 'Share of the section in each band; hover a bar for its value.',
      rows: [['Wind', `from ${dn}, ${fmt(u10, 1)} m/s at 10 m`], ['Along the cut', `${ang}° from the line of Section ${esc(s.name || 'A')} (${fmt(Math.abs(along) * 100)} % of the wind runs along it)`], ['Free stream at roof height', fmt(Uh, 1) + ' m/s'],
        ['Speed-up, windiest 1 % of the section', fmt(peak, 2) + '× the wind there without the buildings'], ['At 1.5 m along the cut, mean', fmt(v15.reduce((a, b) => a + b, 0) / Math.max(1, v15.length), 1) + ' m/s'], ['Sheltered at 1.5 m (under half the wind without the buildings)', fmt(shel / Math.max(1, n15) * 100) + '% of the cut'], ['Windier at 1.5 m (20 %+ above the wind without the buildings)', fmt(fast / Math.max(1, n15) * 100) + '% of the cut'], ['Grid', `${fmt(P.ds, 2)} m, ${fmt(P.nx)} × ${fmt(P.ny)} cells, ${fmt(P.t1 - P.t0)} m long and ${fmt(P.z1 - P.z0)} m high`]],
      method: `A vertical 2D lattice-Boltzmann flow (the solver of the ground study, turned on end) along Section ${esc(s.name || 'A')}, unfolded where it turns, ${fmt(-P.t0)} m past each end, ${fmt(P.z1 - P.z0)} m high on a ${fmt(P.ds, 2)} m grid. The ground, the terrain and the cut through the building and the surrounding buildings are solid. The wind from ${dn} (${fmt(u10, 1)} m/s at 10 m) comes in at the upwind end with the part of it that runs along the cut (${fmt(Math.abs(along) * 100)} %), brought to roof height for ${({ 0.14: 'open', 0.22: 'suburban', 0.33: 'city' })[alpha] || 'suburban'} terrain; arrows show the flow; the speed-up compares each point with the same flow over the same ground without the buildings. A 2D slice: air cannot go round the building, so the flow over the roof and the eddy behind it are overstated; screening, not a wind tunnel or 3D CFD study.`,
      results: { dir, u10: +u10.toFixed(1), along: +Math.abs(along).toFixed(2), peak: +peak.toFixed(2), sheltered: +(shel / Math.max(1, n15) * 100).toFixed(1) }, settings: { mode: 'section', dir, speed: u10, section: s.pts, label: `Wind from ${dn} on Section ${s.name || 'A'} (Workspace)` } }; }
  // daylight in section: the floor study's sky, sun, glass and reflections at points of the cut, every level, every height
  async function daylightSection() { const w = INST.persp.ws, s = secOrThrow(w), bs = w.buildingScene?.(); if (!bs || !bs.levels.length) throw Error('The model is still loading.');
    try { await weather(); } catch (e) { } const { inputs } = await daylightInputs(p), q = qualOf(), ds = { draft: 0.5, standard: 0.33, refined: 0.25 }[q.k] || 0.5, nb = { draft: 120, standard: 180, refined: 240 }[q.k] || 120;
    const lvs = [...bs.levels].sort((a, b) => a.z - b.z), z0 = lvs[0].z, z1 = Math.max(...lvs.map((l) => l.z + l.h)), nx = Math.max(2, Math.round(s.len / ds)), ny = Math.max(2, Math.round((z1 - z0) / ds)), dsx = s.len / nx, dz = (z1 - z0) / ny;
    const DF = new Float32Array(nx * ny).fill(NaN), DA = new Float32Array(nx * ny).fill(NaN), per = []; let done = 0;
    for (const L of lvs) { const sc = w.planSceneAt?.(L.id, 'daylight'); if (!sc || !sc.walls?.length) continue; const O = sc.origin || [0, 0], ceil = Math.max(1.5, L.h - 0.25), pts = [], at = [];
      for (let j = 0; j < ny; j++) { const z = z0 + (j + 0.5) * dz - L.z; if (z < 0.05 || z > ceil - 0.05) continue; for (let i = 0; i < nx; i++) { const qq = w.sectionAt((i + 0.5) * dsx); pts.push({ x: qq[0] - O[0], y: qq[1] - O[1], z }); at.push(j * nx + i); } }
      if (!pts.length) continue; ST.progress = `daylight on the cut, ${L.name}`; drawStudy();
      const res = await DAY.section(sc, { tau: ST.dlTau, rf: ST.dlRf, rw: ST.dlRw, rc: ST.dlRc, head: ST.dlHead, ceil, nb, ...inputs }, pts, (f) => { if (ST.cancel) DAY.stop(); const e = studyCard.querySelector('.sp-stage.run .sp-note'); if (e) e.textContent = `daylight on the cut, ${L.name} ${Math.round(f * 100)}%`; });
      let n = 0, sdf = 0, two = 0, sda = 0; res.forEach((v, k) => { if (!v) return; DF[at[k]] = v.df; DA[at[k]] = v.da * 100; n++; sdf += v.df; if (v.df >= 2) two++; sda += v.da; });
      if (n) per.push({ L, n, df: sdf / n, two: two / n, da: sda / n }); done++; }
    if (!per.length) throw Error(`Section ${s.name || 'A'} passes through no room with walls on any level.`);
    const SR = stopsOf(DAY.RAMPS.SRAMP), F = { t0: 0, t1: s.len, z0, z1, nx, ny }, all = per.reduce((a, x) => a + x.n, 0), mDF = per.reduce((a, x) => a + x.df * x.n, 0) / all, m2 = per.reduce((a, x) => a + x.two * x.n, 0) / all;
    const views = { df: { vals: DF, unit: '% daylight factor', lo: 0, hi: 8, dec: 1, title: 'Daylight factor in section', stops: SR, legendCols: SR.map((x) => x[1]), legendLabels: ['8 %+', '2 % (a daylit room)', '0 %'] },
      da: { vals: DA, unit: '% of occupied hours ≥ 300 lux', lo: 0, hi: 100, dec: 0, title: 'Daylight autonomy (300 lux) in section', stops: SR, legendCols: SR.map((x) => x[1]), legendLabels: ['100 %', '50 %', '0 %'] } };
    return { F, views, onSection: true, paint: (rr) => secPaint(rr), cells: all, avg: mDF, title: views.df.title, chartNote: 'Share of the cut in each band; hover a bar for its value.',
      rows: [['Daylight factor on the cut, mean', fmt(mDF, 1) + '%'], ['Share of the cut at 2 % or more', fmt(m2 * 100) + '%'], ...per.map((x) => [`${esc(x.L.name)}`, `mean ${fmt(x.df, 1)} % · ${fmt(x.two * 100)} % at 2 %+ · autonomy ${fmt(x.da * 100)} %`]), ['Grid', `${fmt(dsx, 2)} m along the cut × ${fmt(dz, 2)} m in height, ${fmt(all)} points, ${nb} sky bearings`]],
      method: `Daylight at points on Section ${esc(s.name || 'A')} through every level (${fmt(dsx, 2)} m along the cut and ${fmt(dz, 2)} m in height, from the floor to below the ceiling): each point is a horizontal sensor at its height, with the floor study's model of the sky in 145 patches (CIE overcast for the daylight factor; the project weather for the daylight autonomy, 300 lux over the occupied hours), the sun, the glass at its angle of incidence, reflections inside the room (split flux) and outside. Glass transmittance ${fmt(ST.dlTau, 2)}, reflectances floor ${ST.dlRf}, walls ${ST.dlRw}, ceiling ${ST.dlRc}. A screening, not a Radiance simulation or a compliance result.`,
      results: { df: +mDF.toFixed(2), df2: +(m2 * 100).toFixed(1), levels: per.length }, settings: { where: 'section', section: s.pts, label: `Daylight on Section ${s.name || 'A'} (Workspace)` } }; }
  async function compute(id) {
    const w = INST.persp.ws;
    if (id === 'sunhours') { const tw = { step: ST.sunStep, h0: ST.sunH0, h1: ST.sunH1 }, r = w.sunStudy({ day: ST.day, ...tw }); w.surfaceSamples?.(); const sv = w.surfaceSun?.(ST.day, tw) || [], sl = w.surfaceList?.() || [], fac = sv.filter((v, i) => !sl[i].roof), roo = sv.filter((v, i) => sl[i].roof), mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
      const surfRows = sv.length ? [['Facades, mean', fmt(mean(fac), 1) + ' h'], ['Facade with ≥ 2 h of sun', fmt(fac.filter((v) => v >= 2).length / Math.max(1, fac.length) * 100) + '%'], ...(roo.length ? [['Roofs, mean', fmt(mean(roo), 1) + ' h']] : [])] : [];
      return { ...r, ...r.grid, svals: sv, slist: sl, surfRows, vals: r.grid.H, unit: 'h', ramp: 'sun', lo: 0, hi: r.scale, dec: 1, title: `Sun hours · ${r.dayName}`,
      rows: [['Average on the ground', fmt(r.avg, 1) + ' h'], ['Range', fmt(r.min, 1) + '–' + fmt(r.max, 1) + ' h'], ['Ground with ≥ 2 h of sun', fmt(r.two * 100) + '%'], ...(r.plot ? [['Plot with ≥ 2 h of sun', fmt(r.plot.two * 100) + '%']] : []), ...surfRows, ['Day length', fmt(r.dayLength, 1) + ' h']],
      method: `Ladybug’s Direct Sun Hours method: the Ladybug sun path for ${r.dayName} at the site (local standard time), a sun position every ${ST.sunStep} minutes (timestep ${Math.round(60 / ST.sunStep)}), counted while the sun is up; each ${fmt(r.cell, 1)} m ground cell, tested 0.1 m above the ground, counts the hours its ray to the sun is clear${sv.length ? `, and so does each square on the design's facades and roofs (${fmt(sv.length)} of them, tested 0.1 m out, counting only sun within 90° of the square's normal)` : ''}.`, results: { ground: +r.avg.toFixed(2), ground2h: +(r.two * 100).toFixed(1), min: r.min, max: r.max }, settings: { day: ST.day, dayName: r.dayName, step: ST.sunStep, timestep: Math.round(60 / ST.sunStep), method: 'Ladybug Direct Sun Hours', offset: 0.1, label: `Ground, ${r.dayName} (Workspace)` } }; }
    if (id === 'radiation') {
      const wx = await weather(), [, pname, m0, m1] = periodDef(ST.period), inP = (m) => (m0 <= m1 ? m >= m0 && m <= m1 : m >= m0 || m <= m1);
      const bins = new Map(), binsN = new Map(); let dhi = 0, hours = 0;
      for (const r of wx.rows) { if (!inP(r.m)) continue; const sp = sunPosition(2026, r.m, r.d, r.h - 0.5, wx.lat, wx.lon, wx.tz); if (sp.alt <= 0) continue; hours++; dhi += r.dhi / 1000;
        if (r.dni > 0) { const key = Math.floor(sp.az / 15) + '|' + Math.min(8, Math.floor(sp.alt / 10)); bins.set(key, (bins.get(key) || 0) + r.dni * Math.sin(sp.alt * Math.PI / 180) / 1000); binsN.set(key, (binsN.get(key) || 0) + r.dni / 1000); } }
      const dirsOf = (B) => [...B].map(([k, v]) => { const [a, l] = k.split('|').map(Number); return { az: a * 15 + 7.5, alt: Math.min(85, l * 10 + 5), w: v }; }), direct = dirsOf(bins);
      const g = w.rayGrid([direct, SKY]), vals = g.H[0].map((v, k) => (Number.isFinite(v) ? v + dhi * g.H[1][k] : NaN)), st = statsOf(vals), dsum = direct.reduce((a, d) => a + d.w, 0);
      // on the building: direct sun by the angle it strikes each face (beam normal), and the diffuse sky each face sees
      ST.progress = 'sunlight on the building'; drawStudy(); await new Promise((r) => setTimeout(r, 0));
      w.surfaceSamples?.(); const sl = w.surfaceList?.() || [], SR = sl.length ? w.surfaceRays?.([dirsOf(binsN), SKYS], { cos: true }) : null, sv = SR ? Float32Array.from(SR[0], (v, k) => v + dhi * SR[1][k]) : null;
      return { ...g, open: dsum + dhi, vals, svals: sv, slist: sl, unit: 'kWh/m²', ramp: 'heat', lo: st.lo, hi: Math.max(st.hi, sv && sv.length ? Math.ceil(Math.max(...sv)) : 0), avg: st.avg, dec: 0, title: `Solar radiation · ${pname}`,
        rows: [['Average on the ground', fmt(st.avg) + ' kWh/m²'], ['Range', fmt(st.lo) + '–' + fmt(st.hi) + ' kWh/m²'], ['Open ground (no shade)', fmt(dsum + dhi) + ' kWh/m²'], ['Share of open-ground sun', fmt(st.avg / Math.max(1e-9, dsum + dhi) * 100) + '%'], ...surfMeans(sl, sv, ' kWh/m²'), ['Weather', esc(wx.station || '')]],
        method: `Hourly direct and diffuse sunlight from the project weather file (${esc(wx.station || 'EPW')}), ${fmt(hours)} sun-up hours, ${pname.toLowerCase()}. Direct sun in ${direct.length} sky patches is blocked by buildings and terrain; diffuse sky light is scaled by the sky each cell sees. Horizontal ground, ${fmt(g.cell, 1)} m cells${sv && sv.length ? `; on each of the ${fmt(sv.length)} squares of the design's facades and roofs (imported models included), direct sun by the angle it strikes the face and the diffuse light of the sky the face sees (no light reflected from the ground)` : ''}.`,
        results: { ground: +st.avg.toFixed(1), min: st.lo, max: st.hi }, settings: { period: ST.period, label: `Ground, ${pname} (Workspace)` } }; }
    if (id === 'skyview') {   // LB View Percent, Sky View (2026-11-09): Ladybug's dome patches at the quality's resolution; a patch counts
      // 2·cos(angle to the normal)·its weight when its ray is clear and it is within 90° of the normal; the sum ·100 / the patch count
      const res = qualOf().dome, { LB_DOME } = await import('./environment/lb-dome.js?v=lbdome-20261109-1'), dome = LB_DOME[res], N = dome.length;
      const g = w.rayGrid([dome.map(([x, y, z, k]) => ({ vec: [x, y, z], w: 2 * z * k * 100 / N }))], { plan: true }), vals = Array.from(g.H[0], (v) => (Number.isFinite(v) ? v : NaN)), st = statsOf(vals);
      w.surfaceSamples?.(); const sl = w.surfaceList?.() || [], SR = sl.length ? w.surfaceRays?.([dome.map(([x, y, z, k]) => ({ vec: [x, y, z], w: 2 * k * 100 / N }))], { cos: true, plan: true }) : null, sv = SR ? Float32Array.from(SR[0]) : null;
      const open = dome.reduce((a, [, , z, k]) => a + 2 * z * k, 0) * 100 / N, PN = { 1: 'Tregenza, 145 patches', 2: 'Reinhart, 577 patches', 3: '1,297 patches' }[res];
      return { ...g, vals, svals: sv, slist: sl, unit: '%', ramp: 'sky', lo: Math.min(Math.floor(st.lo), sv && sv.length ? Math.floor(Math.min(...sv)) : 100), hi: Math.max(100, Math.ceil(open)), avg: st.avg, dec: 0, title: 'Sky view',
        rows: [['Mean sky view', fmt(st.avg, 1) + '%'], ['Range', fmt(st.lo) + '–' + fmt(st.hi) + '%'], ['Ground under 50% sky', fmt(vals.filter((v) => v < 50).length / Math.max(1, st.n) * 100) + '%'], ...surfMeans(sl, sv, '%', 1)],
        method: `Ladybug’s View Percent method, Sky View: from each ${fmt(g.cell, 1)} m ground cell, tested 0.1 m above the ground${onSurf(sv)}, a ray to each of Ladybug’s sky patches (resolution ${res}: ${PN}); a clear patch within 90° of the surface’s normal counts twice the cosine of that angle times its area weight, and the sum is taken over the patch count. As in Ladybug, open ground reads ${fmt(open, 1)}% at this resolution and an open wall about half that.`,
        results: { value: +st.avg.toFixed(2), min: st.lo, max: st.hi }, settings: { label: 'Ground sky view (Workspace)', method: 'Ladybug View Percent, Sky View', resolution: res, patches: N, offset: 0.1 } }; }
    if (id === 'shadebenefit') {
      const wx = await weather(), lower = 18, upper = 26, help = new Map(), harm = new Map(), add = (M0, k, v) => M0.set(k, (M0.get(k) || 0) + v);
      for (const r of wx.rows) { if (!(r.dni > 0) || !Number.isFinite(r.t)) continue; const sp = sunPosition(2026, r.m, r.d, r.h - 0.5, wx.lat, wx.lon, wx.tz); if (sp.alt <= 0) continue; const k = Math.floor(sp.az / 15) + '|' + Math.min(8, Math.floor(sp.alt / 10));
        if (r.t > upper) add(help, k, r.t - upper); else if (r.t < lower) add(harm, k, lower - r.t); }
      const dirs = (M0) => [...M0].map(([k, v]) => { const [a, l] = k.split('|').map(Number); return { az: a * 15 + 7.5, alt: Math.min(85, l * 10 + 5), w: v }; });
      const H = dirs(help), C = dirs(harm), withD = w.rayGrid([H, C]), without = w.rayGrid([H, C], { withoutDesign: true });
      // on the building: sun on each face in hot hours (counts against) and in cold hours (counts for), in degree-hours
      w.surfaceSamples?.(); const sl = w.surfaceList?.() || [], SR = sl.length ? w.surfaceRays?.([H, C]) : null, sv = SR ? Float32Array.from(SR[0], (v, k) => v - SR[1][k]) : null;   /* as on the ground: above 0, shade on this face would help */
      const vals = withD.H[0].map((v, k) => (Number.isFinite(v) ? (without.H[0][k] - v) - (without.H[1][k] - withD.H[1][k]) : NaN)), st = statsOf(vals), abs = [...vals].filter(Number.isFinite).map(Math.abs).sort((x, y) => x - y), m = Math.max(1, abs[Math.floor(abs.length * 0.95)] || 1);   // the scale from the 95th percentile, so a few extreme cells do not wash out the rest
      const pos = vals.filter((v) => v > 0.5).length, neg = vals.filter((v) => v < -0.5).length;
      const sHot = SR ? statsOf(SR[0]).avg : NaN, sCold = SR ? statsOf(SR[1]).avg : NaN, sAbs = sv ? Array.from(sv).filter(Number.isFinite).map(Math.abs).sort((x, y) => x - y) : [], sm = Math.max(1, sAbs[Math.floor(sAbs.length * 0.95)] || 1);
      return { ...withD, vals, svals: sv, slist: sl, slo: sv ? -sm : undefined, shi: sv ? sm : undefined, unit: 'K·h', ramp: 'div', lo: -m, hi: m, avg: st.avg, dec: 0, title: 'Shade benefit · the design',
        rows: [['Mean net benefit', fmt(st.avg, 1) + ' K·h'], ['Ground where the design’s shade helps', fmt(pos / Math.max(1, st.n) * 100) + '%'], ['Ground where it costs warmth', fmt(neg / Math.max(1, st.n) * 100) + '%'], ...(sv && sv.length ? [['Building: sun in hot hours, mean', fmt(sHot) + ' K·h'], ['Building: sun in cold hours, mean', fmt(sCold) + ' K·h'], ['Building faces where shade would help', fmt(Array.from(sv).filter((v) => v > 0.5).length / sv.length * 100) + '%']] : []), ['Weather', esc(wx.station || '')]],
        method: `What the design's shade does to the ground around it, over a year of the project weather (${esc(wx.station || 'EPW')}): an hour of shade counts for each degree above ${upper} °C and against for each degree below ${lower} °C, compared with the site without the design${sv && sv.length ? `. On the building's ${fmt(sv.length)} facade and roof squares (imported models included): sun on the face in hot hours minus sun in cold hours, in the same degree-hours, so the colours read as on the ground: where shade on that face would help, and where its sun is welcome` : ''}.`,
        results: { value: +st.avg.toFixed(2), min: st.lo, max: st.hi }, settings: { lower, upper, label: 'Design shade on the ground (Workspace)' } }; }
    if (id === 'solarenvelope') {
      const site = S.conditionsOf(p).site, [, pname, days, h0, h1] = ENVELOPES.find((x) => x[0] === ST.envelope), dirs = [];
      for (const [m, d] of days) for (let hr = h0; hr <= h1 + 1e-9; hr += 0.5) { const sp = sunPosition(2026, m, d, hr, site.lat, site.lon, site.lon / 15); if (sp.alt > 1) dirs.push(sp); }
      const g = w.solarEnvelope(dirs, { cap: 100 }), vals = g.H, st = statsOf(vals);
      // on the building: the envelope height where each face stands; a square higher than that casts shade on a neighbour
      w.surfaceSamples?.(); const sl = w.surfaceList?.() || [], sv = sl.length ? fieldAt(g, sl, vals, { roofs: true, off: 0 }) : null, over = sv ? sl.filter((S0, i) => Number.isFinite(sv[i]) && S0.p[2] > sv[i] + 0.5).length : 0;
      return { ...g, vals, svals: sv, slist: sl, unit: 'm', ramp: 'height', lo: 0, hi: Math.max(10, Math.ceil(st.hi)), avg: st.avg, dec: 0, title: `Solar envelope · ${pname}`,
        rows: [['Mean envelope height', fmt(st.avg, 1) + ' m'], ['Range', fmt(st.lo, 1) + '–' + fmt(st.hi, 1) + ' m'], ['Ground under 10 m', fmt(vals.filter((v) => v < 10).length / Math.max(1, st.n) * 100) + '%'], ...(sv && sv.length ? [['Building squares above the envelope', fmt(over / sv.length * 100) + '% (' + fmt(over) + ')']] : []), ['Protected', `${g.context} surrounding buildings`]],
        method: `The tallest a building could be at each ${fmt(g.cell, 1)} m cell without its shadow reaching a surrounding building, for ${dirs.length} sun positions (${pname}, solar time). Heights above the ground, capped at 100 m${sv && sv.length ? `. The building's facades and roofs (imported models included) show the envelope height where they stand; squares higher than it shade a neighbour at the protected hours` : ''}.`,
        results: { value: +st.avg.toFixed(2), min: st.lo, max: st.hi }, settings: { envelope: ST.envelope, label: `Envelope, ${pname} (Workspace)` } }; }
    if (id === 'utci') {
      const wx = await weather(), E = CL.parseEPW(wx.text), [, pname, m0, m1] = periodDef(ST.period), inP = (m) => (m0 <= m1 ? m >= m0 && m <= m1 : m >= m0 || m <= m1);
      const alpha = ({ open: 0.14, suburban: 0.22, city: 0.33 })[S.conditionsOf(p).site.terrain] || 0.22, hrs = [], binIx = new Map(), binDirs = [];
      for (let k = 0; k < 8760; k++) { const [m, d] = CL.monthDay(Math.floor(k / 24)); if (!inP(m)) continue; const sp = sunPosition(2026, m, d, (k % 24) + 0.5, E.lat, E.lon, E.tz); if (ST.utciHours === 'sun' && sp.alt <= 0) continue;
        let b = -1; if (sp.alt > 1 && E.DNR[k] > 0) { const key = Math.floor(sp.az / 15) + '|' + Math.min(8, Math.floor(sp.alt / 10)); if (!binIx.has(key)) { binIx.set(key, binDirs.length); const [a, l] = key.split('|').map(Number); binDirs.push({ az: a * 15 + 7.5, alt: Math.min(85, l * 10 + 5), w: 1 }); } b = binIx.get(key); }
        hrs.push({ k, alt: sp.alt, b }); }
      if (!hrs.length) throw Error('No hours to count in this period.');
      const g = w.rayGrid([SKY, ...binDirs.map((d) => [d])]), svf = g.H[0], n = hrs.length, LUT = new Float32Array(n * 22);
      // cooling by the site's water (2026-11-06): in warm hours (20 °C and above) the air near a stream or pond is taken as cooler, by
      // up to 2 K over flowing water with falls and 1.5 K over still water, fading with distance (e-folding 30 m) and with the size of
      // the water; an estimate from field studies of urban blue space (Völker et al. 2013 report about 2.5 K on average), not a CFD
      const WB = w.waterSpecs?.() || [], cool = WB.length ? new Float32Array(svf.length) : null, dTmax = 2, eF = 30;
      if (cool) { const WS0 = WB.map((b) => ({ ...b, k: Math.min(1, WTRL.areaOf(b.pts) / 300) * (b.type === 'stream' ? (b.falls.length ? 1 : 0.85) : 0.75) }));
        for (let c = 0; c < svf.length; c++) { if (!Number.isFinite(svf[c])) continue; const x = g.X0 + (c % g.nx + 0.5) * g.cell, y = g.Y0 + (((c / g.nx) | 0) + 0.5) * g.cell; let best = 0;
          for (const b of WS0) { let d = WTRL.distTo(b.pts, x, y); best = Math.max(best, Math.min(1, b.k) * Math.exp(-d / eF)); } cool[c] = best; } }
      const LUTc = cool ? new Float32Array(n * 22) : null;
      hrs.forEach((h, j) => { const k = h.k, ta = E.T[k], va = CL.siteWind(E.WS[k], 10, alpha), tsky = CL.skyTemp(E, k);
        for (let sl = 0; sl < 2; sl++) for (let l = 0; l <= 10; l++) { const mrt = CL.mrtOutdoor({ ta, tsky, svf: l / 10, sunlit: sl === 1, alt: h.alt, dnr: E.DNR[k], dhr: E.DHR[k] }); LUT[j * 22 + sl * 11 + l] = CL.utci(ta, mrt, va, E.RH[k]); if (LUTc) { const tc = ta >= 20 ? ta - dTmax : ta; LUTc[j * 22 + sl * 11 + l] = ta >= 20 ? CL.utci(tc, mrt - dTmax * 0.5, va, Math.min(100, E.RH[k] + 5)) : LUT[j * 22 + sl * 11 + l]; } } });
      const N = svf.length, comfort = new Float32Array(N).fill(NaN), heat = new Float32Array(N).fill(NaN), cold = new Float32Array(N).fill(NaN);
      for (let c = 0; c < N; c++) { if (!Number.isFinite(svf[c])) continue; const f = Math.min(1, svf[c]) * 10, l0 = Math.min(9, Math.floor(f)), t = f - l0; let ok = 0, hot = 0;
        const wc = cool ? cool[c] : 0; for (let j = 0; j < n; j++) { const b = hrs[j].b, lit = b >= 0 && g.H[1 + b][c] > 0, x = j * 22 + (lit ? 11 : 0) + l0; let u = LUT[x] + (LUT[x + 1] - LUT[x]) * t; if (wc > 0.02) u = u * (1 - wc) + (LUTc[x] + (LUTc[x + 1] - LUTc[x]) * t) * wc; if (u > 26) hot++; else if (u >= 9) ok++; }
        comfort[c] = 100 * ok / n; heat[c] = 100 * hot / n; cold[c] = 100 * (n - ok - hot) / n; }
      // on the building: the comfort of the ground just in front of each facade (where people stand against it)
      w.surfaceSamples?.(); const sl = w.surfaceList?.() || [], fv = (arr) => (sl.length ? fieldAt(g, sl, arr) : null), fCom = fv(comfort);
      const sc = statsOf(comfort), sh = statsOf(heat), sk = statsOf(cold), pv = (vals, name, ramp, svals) => { const ss = statsOf(vals); return { vals, svals, unit: '% of hours', ramp, lo: Math.floor(ss.lo), hi: Math.max(Math.floor(ss.lo) + 1, Math.ceil(ss.hi)), avg: ss.avg, dec: 0, title: `Outdoor comfort · ${name}` }; };
      return { ...g, slist: sl, views: { comfort: pv(comfort, 'No thermal stress', 'sun', fCom), heat: pv(heat, 'Heat stress', 'heat', fv(heat)), cold: pv(cold, 'Cold stress', 'sky', fv(cold)) },
        rows: [['No thermal stress (UTCI 9–26 °C)', fmt(sc.avg, 1) + '% of hours'], ['Heat stress (above 26 °C)', fmt(sh.avg, 1) + '%'], ['Cold stress (below 9 °C)', fmt(sk.avg, 1) + '%'], ...(fCom && fCom.length ? [['Along the facades, no thermal stress', fmt(statsOf(fCom).avg, 1) + '% of hours']] : []), ...(cool ? (() => { let a = 0, na = 0, b2 = 0, nb = 0; for (let c = 0; c < N; c++) { if (!Number.isFinite(heat[c])) continue; if (cool[c] > 0.3) { a += heat[c]; na++; } else if (cool[c] < 0.05) { b2 += heat[c]; nb++; } } return na && nb ? [['Heat stress near the water (cooling over 30 %)', fmt(a / na, 1) + '% of hours, ' + fmt(b2 / nb, 1) + '% away from it']] : []; })() : []), ['Hours counted', fmt(n) + (ST.utciHours === 'sun' ? ', sun up' : '')], ['Weather', esc(E.station || wx.station || '')]],
        method: `UTCI (Bröde et al. 2012) for every counted hour of the project weather (${esc(E.station || 'EPW')}, ${pname.toLowerCase()}), in sun and in shade at the sky view each ${fmt(g.cell, 1)} m cell has: air temperature, humidity, wind at 10 m for ${({ 0.14: 'open', 0.22: 'suburban', 0.33: 'city' })[alpha] || 'suburban'} terrain, and the radiant temperature from sun, sky and ground. Wind is not reduced by buildings here. The building's facades (imported models included) show the comfort of the ground just in front of them.${cool ? ` Near the site's water (${WB.map((b) => esc(b.name)).join(', ')}), warm hours (20 °C and above) are taken up to ${dTmax} K cooler over the water and its falls, fading with distance (half of it about 20 m away) and smaller over small or still water: an estimate from field studies of urban blue space, not computed airflow.` : ''}`,
        results: { comfort: +sc.avg.toFixed(1), heat: +sh.avg.toFixed(1), cold: +sk.avg.toFixed(1) }, settings: { period: ST.period, hours: ST.utciHours, label: `Outdoor comfort, ${pname} (Workspace)` } }; }
    if (id === 'fire-evacuation') {
      const bs = w.buildingScene?.(); if (!bs || !bs.levels.length) throw Error('The model is still loading.');
      if (ST.egStrat === 'all') return evacAll(bs);
      const mix = (EG_MIX.find((x) => x[0] === ST.egMix) || EG_MIX[0])[2], nRuns = +ST.egRuns || 20, down = ST.egStrat === 'down';
      const out = await EGX.run(bs, { strategy: ST.egStrat, ratio: +ST.egRatio, mix, runs: nRuns, seed: +ST.egSeed || 1, fire: ST.egFire || 'random' }, (f) => { if (ST.cancel) throw Error('Stopped.'); ST.progress = f >= 1 ? 'recording the run shown' : `run ${Math.min(nRuns, Math.max(1, Math.round(f * (nRuns + 1))))} of ${nRuns}`; const e = studyCard.querySelector('.sp-stage.run .sp-note'); if (e) e.textContent = ST.progress; });
      const { B, pop, runs, rep, med, p90, p10 } = out, X0 = B.O[0], Y0 = B.O[1], NL = B.levels.length, box = { x0: X0, y0: Y0, x1: X0 + B.W * B.c, y1: Y0 + B.H * B.c };
      const T = (v) => (Number.isFinite(v) ? (v < 120 ? `${fmt(v)} s` : `${fmt(v / 60, 1)} min`) : '—'), P = (a, q) => EGX.pct(a, q);
      // per level: the peak crowding of the run shown; and by room, over all runs, the median time to safety and wait for staff
            const dens = B.levels.map((L, li) => Float32Array.from(L.walk, (v, k) => (v ? Math.min(3, rep.peak[li][k]) : NaN)));
      const byRoom = (f) => { const m = new Map(); for (const x of runs) for (const q of x.pats) { if (!q.moved) continue; const v = f(q); if (!Number.isFinite(v)) continue; const k0 = q.li + '|' + q.room; if (!m.has(k0)) m.set(k0, []); m.get(k0).push(v); }
        const out2 = B.levels.map(() => new Float32Array(B.N).fill(NaN)); for (const [k0, a] of m) { const [li, ri] = k0.split('|').map(Number), L = B.levels[li], md = P(a, 0.5); for (let k = 0; k < B.N; k++) if (L.room[k] === ri && L.walk[k]) out2[li][k] = md; } return out2; };
      const tAll = byRoom((q) => q.t), wAll = byRoom((q) => q.wait), hi = (arrs, q) => { const a = []; for (const A of arrs) for (const v of A) if (v > 0) a.push(v); return Math.max(60, Math.ceil((P(a, q) || 60) / 60) * 60); };
      const tHi = hi(tAll, 0.98), wHi = hi(wAll, 0.98), D = EG_DENS, Tm = EG_TIME;
      const view = (lv, unit, lo, hi2, dec, title, stops, labels) => ({ lv, vals: lv[B.exitLv >= 0 ? B.exitLv : 0], unit, ramp: 'heat', lo, hi: hi2, dec, avg: 0, title, stops, legendCols: stops.map((x) => x[1]), legendLabels: labels || null });
      const views = { density: view(dens, 'people per m²', 0, 3, 1, 'Fire evacuation · peak crowding (run shown)', D), time: view(tAll, 'min to safety', 0, tHi / 60, 1, down ? 'Fire evacuation · time until out, by room (median)' : 'Fire evacuation · time into the next compartment, by room (median)', Tm),
        wait: view(wAll, 'min waiting for staff', 0, wHi / 60, 1, 'Fire evacuation · waiting for staff, by room (median)', Tm),
        trails: view(B.levels.map((L) => Float32Array.from(L.walk, (v) => (v ? 0 : NaN))), 'people', 0, 1, 0, 'Fire evacuation · routes taken (run shown)', [[0, '#f4f2f8'], [1, '#f4f2f8']], ['More people', '', 'Fewer']) };
      views.trails.legendCols = ['#ede9fe', '#8b5cf6', '#4c1d95'];
      views.time.lv = tAll.map((A) => A.map((v) => (Number.isFinite(v) ? v / 60 : v))); views.wait.lv = wAll.map((A) => A.map((v) => (Number.isFinite(v) ? v / 60 : v)));
      const egTime = (t, n) => { ST.egT = t; const e = studyCard.querySelector('.sp-egt'); if (e) e.textContent = `${T(t)} of ${T(n)}`; const sl = studyCard.querySelector('[data-eg="seek"]'); if (sl && document.activeElement !== sl) { sl.max = String(n); sl.value = String(t); } };
      const show = (r, fit) => { const V = r.views[r.view] || views.density; views2().forEach((w2) => { w2.clearStudy?.(); w2.egressShow?.({ levels: B.levels.map((L) => ({ lv: L.id, z: L.z, box, density: { X0, Y0, cell: B.c, nx: B.W, ny: B.H, vals: V.lv[L.li], lo: V.lo, hi: V.hi } })), rampStops: V.stops, frames: rep.frames, kinds: rep.kinds, trails: r.view === 'trails', fit: !!fit, speed: ST.egSpeed, play: ST.egPlay, t: ST.egT || 0, onTime: w2 === INST.persp.ws ? egTime : null }); }); };
      const nameOf = (li, ri) => (ri >= 0 ? B.levels[li].rooms[ri].name : 'outside'), di = rep.doorMax.reduce((b, v, i) => (v > (rep.doorMax[b] || 0) ? i : b), 0), dd = B.doors[di], si = rep.stairMax.reduce((b, v, i) => (v > (rep.stairMax[b] || 0) ? i : b), 0);
      const moved = (x) => x.pats.filter((q) => q.moved).length, bad = runs.filter((x) => x.unfinished || x.stuck).length, t1s = runs.map((x) => x.t1), MIXN = (EG_MIX.find((x) => x[0] === ST.egMix) || EG_MIX[0])[1];
      ST.egT = 0;
      return { X0, Y0, cell: B.c, nx: B.W, ny: B.H, cells: B.N * NL, avg: med, nFrames: Math.max(1, rep.frames.length - 1), views, paint: (r, fit) => show(r, fit),
        chartHTML: () => egChart(runs, rep, down, med), chartNote: '',
        probe: (x, y) => { const lvId = INST.persp.ws.level?.(), li = B.levels.findIndex((L) => L.id === lvId), k = B.cellAt(x - X0, y - Y0); if (li < 0 || k < 0 || !B.levels[li].walk[k]) return null; const L = B.levels[li];
          return `<div class="sp-kv"><span>${esc(L.name)}</span><b>${esc(nameOf(li, L.room[k]))}</b></div><div class="sp-kv"><span>Peak crowding</span><b>${fmt(dens[li][k], 1)} per m²</b></div>${Number.isFinite(tAll[li][k]) && tAll[li][k] > 0 ? `<div class="sp-kv"><span>${down ? 'Out after' : 'Safe after'} (median)</span><b>${T(tAll[li][k])}</b></div><div class="sp-kv"><span>Waiting for staff</span><b>${T(wAll[li][k])}</b></div>` : ''}`; },
        csv: () => ['run,seed,fire_level,fire_compartment,horizontal_s,total_s,patients_moved,staff_wait_mean_s,stuck,unfinished', ...runs.map((x, i) => `${i + 1},${x.seed},"${x.fire.level}",${x.fire.comp + 1},${Number.isFinite(x.t1) ? x.t1.toFixed(1) : ''},${Number.isFinite(x.t2) ? x.t2.toFixed(1) : ''},${moved(x)},${x.staffWait.toFixed(1)},${x.stuck},${x.unfinished}`)],
        rows: [[down ? 'Everyone out, median (P50)' : 'Compartment moved, median (P50)', T(med)], ['90th percentile (P90)', T(p90)], ['10th percentile (P10)', T(p10)],
          ...(down ? [['Horizontal stage first, median', T(P(t1s, 0.5))]] : []),
          ['Patients moved per run, median', fmt(P(runs.map(moved), 0.5))], ['Waiting for staff, mean per patient (median run)', T(P(runs.map((x) => x.staffWait), 0.5))],
          ...(dd ? [['Busiest door (run shown)', `${esc(B.levels[dd.li].name)}: ${esc(nameOf(dd.li, dd.sides[0]))} – ${esc(nameOf(dd.li, dd.sides[1]))}${dd.comp ? ' (smoke door)' : ''}, ${fmt(rep.doorMax[di])} waiting`]] : []),
          ...(down && B.stairs.length ? [['Longest stair queue (run shown)', `${fmt(rep.stairMax[si])} on ${esc(B.stairs[si].name)}, ${esc(B.levels[B.stairs[si].lo].name)}–${esc(B.levels[B.stairs[si].hi].name)}`]] : []),
          ...B.levels.map((L, li) => [`${esc(L.name)} (run shown)`, Number.isFinite(rep.perLevel[li]) ? `${down ? 'out' : 'moved'} after ${T(rep.perLevel[li])}` : 'not moved']),
          ['Fire starts', ST.egFire ? `in ${esc(ST.egFire.name || 'the room you chose')}` : `random each run · shown: ${esc(rep.fire.level)}, compartment ${rep.fire.comp + 1}`],
          ['Smoke compartments', B.levels.map((L) => `${esc(L.name)} ${L.nComp}`).join(' · ')], ['People', `${fmt(pop.pats.length)} patients (${esc(MIXN)}) · ${fmt(pop.staff.length)} staff (1 to ${ST.egRatio})`],
          ['Runs', `${runs.length}, seed ${ST.egSeed}`], ...(bad ? [['<span class="sp-warn">Runs not finished in 60 min</span>', `${bad} of ${runs.length}: someone could not reach the goal (check doors and stairs)`]] : [])],
        method: `The whole building: ${NL} level${NL === 1 ? '' : 's'} of the model on a ${fmt(B.c, 1)} m grid (rooms, walls, doors, furniture), joined by ${B.stairs.length} stair${B.stairs.length === 1 ? '' : 's'}. In each of ${runs.length} runs the fire starts in ${ST.egFire ? 'the room you chose' : 'a random compartment with patients'}; its patients are moved through a smoke door into the next compartment on the same floor (progressive horizontal evacuation)${down ? ', and after a decision delay of 1 to 3 minutes the fire floor and every floor above go down the stairs and out' : ''}. Each run draws each patient's mobility (${esc(MIXN)}), walking speeds and reaction times; a patient who cannot walk alone waits for one member of staff (two for a bed). Walking speeds slow in a crowd and doors and stair flights limit the flow (SFPE Handbook). Context: NBC 2020 care and treatment occupancies and CSA Z8000-18 plan for horizontal relocation first. A screening of evacuation time with the staff on duty: no fire or smoke is computed (no available safe egress time), lifts are not used`,
        foot: `${fmt(pop.pats.length)} patients and ${fmt(pop.staff.length)} staff, P50 of ${runs.length} runs, the run nearest it played back`,
        results: { p50: +med.toFixed(1), p90: +p90.toFixed(1), p10: +p10.toFixed(1), horizontalP50: +(P(t1s, 0.5) || 0).toFixed(1), staffWait: +P(runs.map((x) => x.staffWait), 0.5).toFixed(1), patients: pop.pats.length, staff: pop.staff.length, notFinished: bad },
        settings: { strategy: ST.egStrat, ratio: +ST.egRatio, mix: ST.egMix, runs: runs.length, seed: +ST.egSeed, fire: ST.egFire ? ST.egFire.name : 'random', label: `${down ? 'Horizontal, then down' : 'Horizontal relocation'} · 1:${ST.egRatio} (Workspace)` } }; }
    if (id === 'vent') {
      const one = ST.vnMode !== 'year', tgt = +ST.vnTarget || 5, terr = S.conditionsOf(p).site.terrain || 'suburban', base = { terrain: terr, win: +ST.vnWin || 1, doors: ST.vnDoors }, say = (t) => { ST.progress = t; const e = studyCard.querySelector('.sp-stage.run .sp-note'); if (e) e.textContent = t; };
      let R0 = null; try { R0 = await windRose(); ST.rose = R0; } catch { }
      const dir = ST.windDir ?? R0?.prevailing ?? 225, i16 = Math.round(dir / 22.5) % 16, spd = ST.windSpeed ?? (R0 ? R0.sec[i16].mean : 3.5), Tin1 = +ST.vnTin;
      const net = w.ventNet?.({ ...base, from: dir, U10: spd, Tout: one ? +ST.vnTout : Math.min(+ST.vnTin - 1, 22), Tin: Tin1, grid: true });
      if (!net || !net.rooms.length) throw Error('No closed rooms in the model: draw walls round the rooms first.');
      if (net.rooms.every((r) => !r.ext) && net.closed) throw Error('No window or door to outside in the model, so no air can flow.');
      const NR = net.rooms.length, lvName = (id2) => (net.levels.find((L) => L.id === id2) || {}).name || id2;
      // through the year: the window-open hours of the project weather, gathered by wind direction (16), speed (5) and temperature (3)
      let yr = null;
      if (!one) { const wx = await weather(), E = CL.parseEPW(wx.text), lo = +ST.vnLo, hi = Math.max(lo + 1, +ST.vnHi), bins = new Map(); let open = 0;
        for (let k = 0; k < 8760; k++) { const T = E.T[k], U = E.WS[k], D = E.WD[k]; if (!Number.isFinite(T) || !Number.isFinite(U) || T < lo || T > hi) continue; open++;
          const calm = U < 0.5, d = calm ? 0 : Math.round((((D % 360) + 360) % 360) / 22.5) % 16, sb = calm ? 0 : U < 2 ? 1 : U < 4 ? 2 : U < 6 ? 3 : 4, tb = Math.min(2, Math.floor((T - lo) / ((hi - lo) / 3))), key = d * 100 + sb * 10 + tb;
          const b = bins.get(key) || { n: 0, sU: 0, sT: 0, d }; b.n++; b.sU += U; b.sT += T; bins.set(key, b); }
        if (!open) throw Error(`No hour of the project weather is between ${lo} and ${hi} °C: widen the window-open range.`);
        const okH = new Float64Array(NR), list = Array.from({ length: NR }, () => []), frs = new Float64Array(NR); let allOk = 0, done = 0; const B = [...bins.values()];
        for (const b of B) { if (ST.cancel) throw Error('Stopped.'); const T = b.sT / b.n, r = w.ventNet({ ...base, from: b.d * 22.5, U10: Math.max(0.1, b.sU / b.n), Tout: T, Tin: Math.max(Tin1, T + 1) }); if (!r) continue;
          let all = true; r.rooms.forEach((q, i) => { if (q.ach >= tgt) okH[i] += b.n; else if (q.ext || q.ach > 0) all = false; list[i].push([q.ach, b.n]); frs[i] += q.fresh * b.n; }); if (all) allOk += b.n;
          if (++done % 12 === 0) { say(`hours of the year ${Math.round(done / B.length * 100)}%`); await new Promise((res) => setTimeout(res, 0)); } }
        const med = list.map((a) => { a.sort((x, y) => x[0] - y[0]); const half = a.reduce((t, x) => t + x[1], 0) / 2; let c = 0; for (const [v, n] of a) { c += n; if (c >= half) return v; } return 0; });
        yr = { open, okH, med, fresh: Array.from(frs, (v) => v / open), allOk, bins: B.length, station: wx.station || E.station || 'project weather', lo, hi }; }
      // per room values, painted on every level's floor
      const val = { ach: net.rooms.map((r) => r.ach), fresh: net.rooms.map((r) => r.fresh * 100) };
      if (yr) { val.hours = net.rooms.map((r, i) => yr.okH[i] / yr.open * 100); val.median = yr.med; val.fresh = yr.fresh.map((v) => v * 100); }
      const box = net.levels.reduce((a, L) => ({ x0: Math.min(a.x0, L.X0), y0: Math.min(a.y0, L.Y0), x1: Math.max(a.x1, L.X0 + L.nx * L.cell), y1: Math.max(a.y1, L.Y0 + L.ny * L.cell) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
      const grids = (arr) => net.levels.map((L) => Float32Array.from(L.room, (g) => (g >= 0 && Number.isFinite(arr[g]) ? arr[g] : NaN)));
      const curLi = () => Math.max(0, net.levels.findIndex((L) => L.id === INST.persp.ws.level?.()));
      const view = (arr, unit, lo, hi, dec, title, stops, labels, avg) => { const lv = grids(arr); return { lv, vals: lv[curLi()], unit, ramp: 'heat', lo, hi, dec, avg, title, stops, legendCols: stops.map((x) => x[1]), legendLabels: labels }; };
      const vw = {}, A = net.rooms.reduce((t, r) => t + r.area, 0), aw = (arr) => net.rooms.reduce((t, r, i) => t + r.area * (Number.isFinite(arr[i]) ? arr[i] : 0), 0) / Math.max(1e-9, A);
      if (!yr) vw.ach = view(val.ach, 'air changes per hour', 0, 2 * tgt, 1, `Natural ventilation · air changes, wind from ${DIR16[i16]} ${fmt(spd, 1)} m/s`, VN_ACH, [`${fmt(2 * tgt)}+ ach`, `${fmt(tgt)} ach (target)`, 'none'], net.ach);
      else { vw.hours = view(val.hours, '% of window-open hours at the target', 0, 100, 0, `Natural ventilation · hours at ${fmt(tgt)} ach or more`, VN_H, ['100%', '50%', '0%'], aw(val.hours));
        vw.median = view(val.median, 'air changes per hour (median hour)', 0, 2 * tgt, 1, 'Natural ventilation · air changes in a typical window-open hour', VN_ACH, [`${fmt(2 * tgt)}+ ach`, `${fmt(tgt)} ach (target)`, 'none'], aw(val.median)); }
      vw.fresh = view(val.fresh, '% outdoor air in the air coming in', 0, 100, 0, 'Natural ventilation · outdoor air share', VN_FR, ['All from outside', 'Half', 'All from other rooms'], aw(val.fresh));
      // arrows at the openings (for the wind shown): blue in, red out, grey between rooms
      const qmax = Math.max(1, ...net.flows.map((f) => Math.abs(f.q)));
      const arrowsOf = (lvId) => net.flows.filter((f) => f.lv === lvId && Math.abs(f.q) >= 0.5).map((f) => { const s0 = Math.sign(f.q), d = [f.dir[0] * s0, f.dir[1] * s0], L = 0.5 + 1.6 * Math.sqrt(Math.abs(f.q) / qmax);
        return { a: [f.p[0] - d[0] * L / 2, f.p[1] - d[1] * L / 2], b: [f.p[0] + d[0] * L / 2, f.p[1] + d[1] * L / 2], col: f.ext ? (f.q > 0 ? '#1d4ed8' : '#b91c1c') : '#475569', w: 0.07 + 0.2 * Math.sqrt(Math.abs(f.q) / qmax) }; });
      const show = (r, fit) => { const V = r.views[r.view] || Object.values(r.views)[0]; views2().forEach((w2) => { w2.clearStudy?.(); w2.egressShow?.({ levels: net.levels.map((L, li) => ({ lv: L.id, z: L.z, box, density: { X0: L.X0, Y0: L.Y0, cell: L.cell, nx: L.nx, ny: L.ny, vals: V.lv[li], lo: V.lo, hi: V.hi }, arrows: arrowsOf(L.id) })), rampStops: V.stops, frames: [], kinds: [], play: false, fit: !!fit, section: 'room', secFmt: { unit: /%/.test(V.unit) ? '%' : 'ach', dec: /%/.test(V.unit) ? 0 : 1 }, secFlows: yr ? null : net.flows.map((f) => ({ id: f.id, p: f.p, dir: f.dir, q: f.q, ext: f.ext })), secZn: yr ? null : net.zn }); }); };   // on a section: each room's value, and (for one wind) the flow at each opening and the neutral plane
      const roomAt = (x, y) => { const li = curLi(), L = net.levels[li]; if (!L) return null; const i = Math.floor((x - L.X0) / L.cell), j = Math.floor((y - L.Y0) / L.cell); if (i < 0 || j < 0 || i >= L.nx || j >= L.ny) return null; const g = L.room[j * L.nx + i]; return g >= 0 ? g : null; };
      const ok1 = net.rooms.filter((r) => r.ach >= tgt).length, sorted = net.rooms.map((r, i) => ({ r, i })).sort((a, b) => (yr ? val.hours[a.i] - val.hours[b.i] : a.r.ach - b.r.ach)), singles = net.rooms.filter((r) => r.single), cols = (v) => (v >= tgt ? '#8fcaa9' : v >= tgt / 2 ? '#f3e3a0' : '#f08a3c');
      const DOORS = { open: 'all doors open', inside: 'inside doors open, outside doors shut', shut: 'all doors shut' }[ST.vnDoors], WIN = { 2: 'windows wide open', 1: 'windows open as drawn', 0.5: 'windows ajar' }[ST.vnWin] || 'windows open as drawn';
      const roomRow = ({ r, i }) => [`${esc(r.name)} · ${esc(lvName(r.lv))}`, yr ? `${fmt(val.hours[i])}% of hours · typically ${fmt(val.median[i], 1)} ach` : `${fmt(r.ach, 1)} ach · ${fmt(r.inflow)} L/s${r.single ? ' · one-sided' : ''}${!r.ext ? ' · no outside opening' : ''}`];
      const rows = yr ? [['Rooms at the target, share of hours (by floor area)', fmt(aw(val.hours)) + '%'], ['Window-open hours', `${fmt(yr.open)} h a year (${yr.lo}–${yr.hi} °C outside)`], ['Every room at the target', `${fmt(yr.allOk)} h (${fmt(yr.allOk / yr.open * 100)}%)`], ['Weakest room', `${esc(sorted[0].r.name)}: ${fmt(val.hours[sorted[0].i])}% of hours`], ['Target', `${fmt(tgt)} air changes per hour`], ['Openings', `${WIN}, ${DOORS}`], ['Weather', esc(yr.station)], ...sorted.slice(0, 24).map(roomRow)]
        : [['Outdoor air, whole building', `${fmt(net.total)} L/s · ${fmt(net.ach, 1)} ach`], [`Rooms at ${fmt(tgt)} ach or more`, `${ok1} of ${NR}`], ['Weakest room', `${esc(sorted[0].r.name)} (${esc(lvName(sorted[0].r.lv))}): ${fmt(sorted[0].r.ach, 1)} ach`], ['Wind', `from ${DIR16[i16]} (${Math.round(dir)}°), ${fmt(spd, 1)} m/s at 10 m${R0 ? '' : ' (no project weather: an assumed wind)'}`], ['Temperatures', `${ST.vnTout} °C outside, ${ST.vnTin} °C inside`], ...(net.zn != null && Math.abs(net.zn) < 200 ? [['Neutral plane (stack alone)', `${fmt(net.zn, 1)} m above level 0`]] : []), ['Openings', `${WIN}, ${DOORS}`], ...(singles.length ? [['One-sided rooms', `${singles.length} (de Gids and Phaff where larger)`]] : []), ...sorted.slice(0, 24).map(roomRow)];
      return { X0: box.x0, Y0: box.y0, cell: net.levels[0].cell, nx: net.levels[0].nx, ny: net.levels[0].ny, cells: NR, avg: yr ? aw(val.hours) : net.ach, views: vw, paint: (r, fit) => show(r, fit),
        chartHTML: () => `${roomBars(sorted.map(({ r, i }) => ({ name: r.name, v: yr ? val.hours[i] : r.ach, col: yr ? (val.hours[i] >= 80 ? '#8fcaa9' : val.hours[i] >= 50 ? '#f3e3a0' : '#f08a3c') : cols(r.ach) })), yr ? 100 : Math.max(2 * tgt, ...net.rooms.map((r) => Math.min(4 * tgt, r.ach))), yr ? null : tgt, yr ? '% of hours' : 'ach')}<p class="sp-note">${yr ? 'Each room’s share of the window-open hours at the target, weakest first.' : 'Each room’s air changes, weakest first; the dashed line is the target.'} Arrows on the plan: blue in, red out, grey between rooms (the wind ${yr ? 'from the prevailing direction' : 'shown'}).</p>`, chartNote: '',
        probe: (x, y) => { const g = roomAt(x, y); if (g == null) return null; const r = net.rooms[g]; return `<div class="sp-kv"><span>${esc(lvName(r.lv))}</span><b>${esc(r.name)}</b></div>${yr ? `<div class="sp-kv"><span>At the target</span><b>${fmt(val.hours[g])}% of hours</b></div><div class="sp-kv"><span>Typical hour</span><b>${fmt(val.median[g], 1)} ach</b></div>` : `<div class="sp-kv"><span>Air changes</span><b>${fmt(r.ach, 1)} /h</b></div><div class="sp-kv"><span>Air coming in</span><b>${fmt(r.inflow)} L/s</b></div>`}<div class="sp-kv"><span>Of it from outside</span><b>${fmt(val.fresh[g])}%</b></div>${r.single ? '<div class="sp-kv"><span>One-sided</span><b>openings on one facade</b></div>' : ''}`; },
        csv: () => ['level,room,area_m2,volume_m3,' + (yr ? 'hours_at_target_percent,median_ach,outdoor_share_percent' : 'ach,inflow_Ls,outdoor_share_percent,one_sided'), ...net.rooms.map((r, i) => `"${lvName(r.lv)}","${r.name}",${r.area},${r.vol},${yr ? `${val.hours[i].toFixed(1)},${val.median[i].toFixed(2)},${val.fresh[i].toFixed(1)}` : `${r.ach.toFixed(2)},${r.inflow.toFixed(1)},${val.fresh[i].toFixed(1)},${r.single ? 1 : 0}`}`)],
        rows, foot: yr ? `${fmt(yr.open)} window-open hours in ${yr.bins} wind and temperature groups, ${NR} rooms on ${net.levels.length} level${net.levels.length === 1 ? '' : 's'}` : `${NR} rooms on ${net.levels.length} level${net.levels.length === 1 ? '' : 's'}, ${net.flows.length} openings`,
        method: `An airflow network of the whole building (every level, joined through stairs and floor voids): each window and door is split into strips up its height, and the flow through each strip follows the orifice equation (discharge coefficient 0.6) from the difference between the pressure inside and outside. Outside, the wind at the roof height (${terr} terrain profile) presses on each facade by its angle to the wind (surface-averaged pressure coefficients for a low-rise building, as in the AIVC guide); inside, warm air is lighter (the stack effect). Rooms whose openings are all on one facade also get the single-sided flow of de Gids and Phaff (1982) where that is larger. ${yr ? `Every hour of the project weather (${esc(yr.station)}) between ${yr.lo} and ${yr.hi} °C is counted with its own wind and temperature (gathered in ${yr.bins} groups of direction, speed and temperature), inside at least 1 °C warmer than outside.` : ''} Nearby buildings and trees do not shelter the facades here, and the air inside each room is taken as well mixed: a screening of air changes for early design, not CFD and not a code calculation. For the air speed inside the rooms of one level, use the detailed page.`,
        results: yr ? { hoursAtTarget: +aw(val.hours).toFixed(1), allRoomsHours: yr.allOk, openHours: yr.open, target: tgt, rooms: net.rooms.map((r, i) => ({ level: lvName(r.lv), room: r.name, hours: +val.hours[i].toFixed(1), median: +val.median[i].toFixed(2) })) } : { fresh: +net.total.toFixed(1), ach: +net.ach.toFixed(2), roomsAtTarget: ok1, rooms: NR, target: tgt, roomList: net.rooms.map((r) => ({ level: lvName(r.lv), room: r.name, ach: +r.ach.toFixed(2), inflow: +r.inflow.toFixed(1) })) },
        settings: { mode: ST.vnMode, from: Math.round(dir), U10: +(+spd).toFixed(1), Tout: +ST.vnTout, Tin: +ST.vnTin, windows: +ST.vnWin, doors: ST.vnDoors, target: tgt, open: [+ST.vnLo, +ST.vnHi], label: yr ? `Through the year, ${ST.vnLo}–${ST.vnHi} °C, target ${tgt} ach (Workspace)` : `Wind from ${DIR16[i16]} ${fmt(spd, 1)} m/s, ${ST.vnTout}/${ST.vnTin} °C (Workspace)` } }; }
    if (id === 'acoustics') {
      const sc = w.planScene('acoustics'); if (!(sc.rooms || []).some((r) => r.surf && r.vol > 0)) throw Error('No closed rooms on this level: draw walls round the rooms first, or pick another level in the Level menu.');
      const out = ACU.run(sc, { target: ST.acTarget, people: +ST.acPeople || 0, tC: +ST.acTemp, rh: +ST.acRh, formula: ST.acFormula }), R = out.rooms, o = sc.origin || [0, 0], cell = 0.2, nx = Math.ceil(sc.bounds.w / cell), ny = Math.ceil(sc.bounds.h / cell), idx = new Int32Array(nx * ny).fill(-1);
      R.forEach((x, k) => { for (const [rx, ry, rw, rd] of x.r.rects) for (let j = Math.max(0, Math.floor(ry / cell)); j < Math.min(ny, Math.ceil((ry + rd) / cell)); j++) for (let i = Math.max(0, Math.floor(rx / cell)); i < Math.min(nx, Math.ceil((rx + rw) / cell)); i++) { const cx = (i + 0.5) * cell, cy = (j + 0.5) * cell; if (cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rd) idx[j * nx + i] = k; } });
      const grid = (f) => Float32Array.from(idx, (k) => (k >= 0 ? f(R[k]) : NaN)), r2 = (v) => fmt(v, 2), FN = ST.acFormula === 'eyring' ? 'Eyring' : 'Sabine';
      const views = { ratio: { vals: grid((x) => (x.tgt != null ? Math.max(0.4, Math.min(1.6, x.mid / x.tgt)) : NaN)), unit: '× the target', ramp: 'heat', lo: 0.4, hi: 1.6, dec: 2, avg: out.judged ? out.ok / out.judged * 100 : 0, title: 'Indoor acoustics · reverberation against the target', stops: AC_RATIO, legendCols: AC_RATIO.map((x) => x[1]), legendLabels: ['Too live (1.6× or more)', 'On target (±20 %)', 'Too dry (0.4× or less)'] },
        rt: { vals: grid((x) => Math.min(2, x.mid)), unit: 's, 500 Hz–1 kHz', ramp: 'heat', lo: 0, hi: 2, dec: 2, avg: out.mean, title: `Indoor acoustics · reverberation time (${FN})`, stops: AC_RT, legendCols: AC_RT.map((x) => x[1]), legendLabels: ['2 s or more', '1 s', '0 s'] },
        sti: { vals: grid((x) => x.sti), unit: 'STI (estimate)', ramp: 'heat', lo: 0, hi: 1, dec: 2, avg: out.low ? out.low.sti : 0, title: 'Indoor acoustics · speech clarity from reverberation (STI estimate)', stops: AC_STI, legendCols: AC_STI.map((x) => x[1]), legendLabels: ['Excellent (0.75+)', 'Fair (0.45)', 'Bad'] } };
      const box = { x0: o[0], y0: o[1], x1: o[0] + nx * cell, y1: o[1] + ny * cell };
      const show = (r, fit) => views2().forEach((w2) => { w2.clearStudy?.(); w2.walkShow?.({ walks: [], T: 0, box, lv: w2.level?.(), z: sc.settings?.floorZ || 0, view: r.view, fit: !!fit, fit2: !!fit, solid: true, density: { X0: o[0], Y0: o[1], cell, nx, ny, vals: r.vals, lo: r.lo, hi: r.hi }, rampStops: r.stops }); });
      const st = (x) => (x.status === 'ok' ? 'on target' : x.status === 'hi' ? 'too live' : x.status === 'lo' ? 'too dry' : 'no target');
      const sorted = R.slice().sort((a, b) => (b.tgt != null ? b.mid / b.tgt : 0) - (a.tgt != null ? a.mid / a.tgt : 0));
      return { X0: o[0], Y0: o[1], cell, nx, ny, cells: R.length, avg: out.mean, views, paint: (r, fit) => show(r, fit),
        chartHTML: () => `${roomBars(sorted.map((x) => ({ name: x.r.name, v: x.mid, t: x.tgt, col: x.status === 'ok' ? '#bee1aa' : x.status === 'hi' ? '#f08a3c' : x.status === 'lo' ? '#8cbed7' : '#d6d9de' })), Math.max(1, ...R.map((x) => Math.min(3, x.mid))), null, 's', 2)}<p class="sp-note">Each room’s reverberation time (${FN}, mean of 500 Hz and 1 kHz); the black tick is its target.</p>`, chartNote: '',
        probe: (x, y) => { const i = Math.floor((x - o[0]) / cell), j = Math.floor((y - o[1]) / cell); if (i < 0 || j < 0 || i >= nx || j >= ny) return null; const k = idx[j * nx + i]; if (k < 0) return null; const q = R[k];
          return `<div class="sp-kv"><span>Room</span><b>${esc(q.r.name)}</b></div><div class="sp-kv"><span>T 500 Hz–1 kHz</span><b>${r2(q.mid)} s${q.tgt != null ? ` · target ${r2(q.tgt)} s` : ''}</b></div><div class="sp-kv"><span>Status</span><b>${st(q)}</b></div><div class="sp-kv"><span>Bands 125–4k</span><b>${q.T.map((t) => fmt(t, 1)).join(' · ')} s</b></div><div class="sp-kv"><span>STI (estimate)</span><b>${fmt(q.sti, 2)} · ${ACU.stiWord(q.sti)}</b></div>`; },
        csv: () => ['room,use,volume_m3,' + ACU.BANDS.map((b) => `T${b}_s`).join(',') + ',T_mid_s,target_s,status,sti,extra_absorption_m2', ...R.map((x) => `"${x.r.name}",${x.grp},${x.r.vol},${x.T.map((t) => t.toFixed(2)).join(',')},${x.mid.toFixed(2)},${x.tgt != null ? x.tgt.toFixed(2) : ''},${st(x)},${x.sti.toFixed(2)},${x.needA.toFixed(1)}`)],
        rows: [['Rooms on target', out.judged ? `${out.ok} of ${out.judged}` : 'no targets'], ['Longest T 500 Hz–1 kHz', out.longest ? `${r2(out.longest.mid)} s, ${esc(out.longest.r.name)}` : '—'], ['Mean T 500 Hz–1 kHz (by volume)', r2(out.mean) + ' s'], ['Lowest speech clarity (STI estimate)', out.low ? `${fmt(out.low.sti, 2)} (${ACU.stiWord(out.low.sti)}), ${esc(out.low.r.name)}` : '—'],
          ...sorted.map((x) => [`${esc(x.r.name)} · ${esc(ACU.TARGET_SHORT[x.grp] || x.grp)}`, `${r2(x.mid)} s${x.tgt != null ? ` of ${r2(x.tgt)} s` : ''} · ${st(x)} · STI ${fmt(x.sti, 2)}${x.panel > 0.5 ? ` · about ${fmt(x.panel)} m² of acoustic panel would bring it to target` : ''}`])],
        foot: `${R.length} rooms, ${fmt(R.reduce((t, x) => t + x.r.vol, 0))} m³ · ${FN}, ${ST.acTemp} °C, ${ST.acRh}% humidity`,
        method: `Each room's reverberation time in six octave bands (125 Hz–4 kHz) by the ${FN} formula, from its volume and the sound absorbed by its surfaces (the finishes set in Plan Studio, measured absorption coefficients; unset surfaces as plaster walls and ceilings, a timber floor and double glazing), furniture, ${+ST.acPeople ? `people (one per ${ST.acPeople} m²)` : 'no people'} and the air (ISO 9613-1 at ${ST.acTemp} °C, ${ST.acRh}%). The target for each room's use from DIN 18041:2016 (mean of 500 Hz and 1 kHz, ±20 %), or 0.5 s for homes and offices (a rule of thumb). Speech clarity (STI) is estimated from reverberation alone (IEC 60268-16 modulation transfer), without background noise or the direct sound. The acoustic panel suggested is 50 mm mineral wool replacing plaster (Sabine). The method of the Indoor acoustics study: a diffuse-field screening for early design, not a measurement or a ray-traced model.`,
        results: { onTarget: out.ok, judged: out.judged, meanRT: +out.mean.toFixed(2), longest: out.longest ? { room: out.longest.r.name, rt: +out.longest.mid.toFixed(2) } : null, lowestSTI: out.low ? +out.low.sti.toFixed(2) : null, rooms: R.map((x) => ({ room: x.r.name, use: x.grp, rt: +x.mid.toFixed(2), target: x.tgt != null ? +x.tgt.toFixed(2) : null, status: x.status, sti: +x.sti.toFixed(2) })) },
        settings: { formula: ST.acFormula, target: ST.acTarget, people: +ST.acPeople, tC: +ST.acTemp, rh: +ST.acRh, level: sc.source?.level, label: `${FN}, ${ST.acTarget === 'auto' ? 'targets by room name' : ACU.TARGET_SHORT[ST.acTarget]}, ${sc.name?.split(' · ').pop() || 'level'} (Workspace)` } }; }
    if (id === 'wayfinding') {
      const sc = w.planScene('wayfinding'); if (!sc.walls.length || !(sc.rooms || []).length) throw Error('No rooms on this level: draw the rooms first, or pick another level in the Level menu.');
      const out = await WAY.run(sc, { start: ST.wayStart, furn: ST.wayFurn, eye: +ST.wayEye }, (f) => { ST.progress = `looking around ${Math.round(f * 100)}%`; const e = studyCard.querySelector('.sp-stage.run .sp-note'); if (e) e.textContent = ST.progress; });
      const { RES, F, SC: S2 } = out, R = RES.R, o = S2.origin || [0, 0], X0 = o[0] + R.x0, Y0 = o[1] + R.y0, toP = (p) => [p[0] + o[0], p[1] + o[1]];
      const box = { x0: X0, y0: Y0, x1: X0 + R.W * R.c, y1: Y0 + R.H * R.c }, vis = RES.rooms.filter((x) => !x.skip);
      const dots = [{ p: toP(RES.start.p), col: '#111', r: 0.45, label: 'S', ring: true }, ...(RES.startHidden.length ? [{ p: toP([RES.start.p[0] + 0.7, RES.start.p[1] + 0.7]), col: '#d8402a', r: 0.3, square: true, label: 'i', al: 1 }] : []),
        ...RES.decisions.flatMap((d, i) => [{ p: toP(d.p), col: '#f39c12', r: 0.4, label: String(i + 1), ink: '#111', ring: true, al: 1 }, ...(d.hidden.length ? [{ p: toP([d.p[0] + 0.65, d.p[1] + 0.65]), col: '#d8402a', r: 0.28, square: true, label: 'i', al: 1 }] : [])]),
        ...vis.filter((x) => x.door).map((x) => ({ p: toP(x.door), col: '#3b6fb6', r: 0.16, al: 1 }))];
      const show = (r, fit) => views2().forEach((w2) => { w2.clearStudy?.(); w2.walkShow?.({ walks: [], T: 0, box, lv: w2.level?.(), z: S2.settings?.floorZ || 0, view: r.view, fit: !!fit, fit2: !!fit, solid: false,
        paths: vis.filter((x) => x.pts).map((x) => ({ pts: x.pts.map(toP), col: r.view === 'routes' ? '#3b6fb6' : '#1e1e1e', w: r.view === 'routes' ? 0.1 : 0.06, al: r.view === 'routes' ? 0.85 : 0.45 })), dots,
        density: { X0, Y0, cell: R.c, nx: R.W, ny: R.H, vals: r.view === 'depth' ? RES.depth : new Float32Array(R.W * R.H).fill(NaN), lo: 0, hi: 3 }, rampStops: stopsOf(WAY.DEPTH) }); });
      const dtxt = (d) => (Number.isFinite(d) ? String(d) : '—');
      return { X0, Y0, cell: R.c, nx: R.W, ny: R.H, cells: R.W * R.H, avg: F.md, chartNote: 'Share of the floor at each visual depth from the start; hover a bar for its value.', foot: `${vis.length} rooms routed from ${esc(RES.start.name)}, ${RES.decisions.length} decision points`,
        views: { depth: { legendCols: stopsOf(WAY.DEPTH).map((x) => x[1]), vals: RES.depth, unit: 'look-arounds', ramp: 'heat', lo: 0, hi: 3, dec: 0, avg: F.md, title: 'Wayfinding · visual depth from the start', legendLabels: ['3 or more', '1 · 2', '0 · in sight'] },
          routes: { legendCols: ['#3b6fb6', '#3b6fb6'], vals: RES.depth, unit: 'walk to each door', ramp: 'heat', lo: 0, hi: 3, dec: 0, avg: F.md, title: 'Wayfinding · routes to each room', legendLabels: ['Route to a door', '', 'Orange: decision point · red: sign'] } },
        paint: (r, fit) => show(r, fit),
        probe: (x, y) => { const i = Math.floor((x - X0) / R.c), j = Math.floor((y - Y0) / R.c); if (i < 0 || j < 0 || i >= R.W || j >= R.H) return null; const k = j * R.W + i, d = RES.depth[k], wk = RES.D[k];
          return `<div class="sp-kv"><span>Visual depth</span><b>${Number.isFinite(d) ? d + (d === 0 ? ' · in sight of the start' : ' look-around' + (d === 1 ? '' : 's')) : '—'}</b></div>${Number.isFinite(wk) ? `<div class="sp-kv"><span>Walk from the start</span><b>${fmt(wk, 1)} m</b></div>` : ''}`; },
        rows: [['Decision points', String(RES.decisions.length)], ['Signs suggested', String(F.signs)], ['Rooms seen from the start', `${F.seen} of ${F.vis.length}`], ['Mean visual depth', fmt(F.md, 1)], ['Longest route', F.longest ? `${esc(F.longest.r.name)}, ${fmt(F.longest.len, 1)} m` : '—'], ['Hard to find', F.hard.length ? esc(F.hard.map((x) => x.r.name).join(', ')) : 'none'],
          ...vis.map((x) => [esc(x.r.name), x.unreached ? 'no way in' : `${fmt(x.len, 1)} m · ${x.turns} turns · depth ${dtxt(x.depth)}`]),
          ...RES.decisions.map((d, i) => [`Decision point ${i + 1}`, `${d.ways} ways · ${d.hidden.length ? 'sign for ' + esc(d.hidden.join(', ')) : 'the way on is in sight'}`])],
        method: `From ${esc(RES.start.name)}: the shortest walk to every room's door (${fmt(R.c, 2)} m grid, 8 directions, no cutting corners${ST.wayFurn ? ', furniture in the way' : ''}), pulled tight; where routes split, a decision point, and a sign wherever a room's door is not in sight from there (eye ${ST.wayEye} m; furniture taller than the eye blocks the view). Visual depth: 0 where the start sees, 1 where a spot seen from it sees, and so on. The method of the Wayfinding study, for early layout; signage design and lighting are not modelled.`,
        results: { decisions: RES.decisions.length, signs: F.signs, depth: +F.md.toFixed(2), seen: F.seen }, settings: { start: RES.start.name, eye: +ST.wayEye, furniture: ST.wayFurn, label: `Wayfinding from ${esc(RES.start.name)} (Workspace)` } }; }
    if (id === 'daylight' && ST.dlWhere === 'section') return daylightSection();
    if (id === 'daylight') {
      const sc = w.planScene('daylight'); if (!sc.walls.length) throw Error('No walls on this level: draw the rooms first, or pick another level in the Level menu.');
      try { await weather(); } catch (e) { }   // fetch the project weather if it is not stored yet
      const { shared, inputs } = await daylightInputs(p), occ = inputs.occ, wx = inputs.epw ? { station: inputs.epwName } : null;
      const out = await DAY.run(sc, { level: ST.dlLevel, tau: ST.dlTau, rf: ST.dlRf, rw: ST.dlRw, rc: ST.dlRc, head: ST.dlHead, ...inputs },
        (f) => { ST.progress = `a year of daylight ${Math.round(f * 100)}%`; const e = studyCard.querySelector('.sp-stage.run .sp-note'); if (e) e.textContent = ST.progress; });
      const rec = daylightRecord(p, null, shared, out, { origin: sc.origin, settings: { level: ST.dlLevel, tau: ST.dlTau, rf: ST.dlRf, rw: ST.dlRw, rc: ST.dlRc, head: ST.dlHead } });
      const { RES, sm } = out, o = sc.origin || [0, 0], RM = DAY.RAMPS, grid = (f) => { const g = new Float32Array(RES.PW * RES.PH).fill(NaN); RES.pts.forEach((q, k) => { g[q.j * RES.PW + q.i] = f(RES.ev[k]); }); return g; }, pc = (v) => fmt(v * 100, 0) + '%';
      const sSt = stopsOf(RM.SRAMP), aSt = stopsOf(RM.ARAMP), oSt = [[0, '#4668a8'], [0.5, '#38a060'], [1, '#ec783c']];
      const views = { sda: { vals: grid((e) => e.da * 100), unit: '% of occupied hours ≥ 300 lux', ramp: 'heat', lo: 0, hi: 100, dec: 0, avg: sm.sda * 100, title: 'Daylight autonomy (300 lux)', legendCols: sSt.map((x) => x[1]), legendLabels: ['100% of hours', '50% (sDA threshold)', '0%'], stops: sSt },
        ase: { vals: grid((e) => Math.min(1000, e.ase)), unit: 'h of direct sun ≥ 1,000 lux', ramp: 'heat', lo: 0, hi: 1000, dec: 0, avg: sm.ase * 100, title: 'Annual sun exposure', legendCols: aSt.map((x) => x[1]), legendLabels: ['1,000 h+', '250 h (ASE limit)', 'None'], stops: aSt },
        df: { vals: grid((e) => Math.min(6, e.df)), unit: '% daylight factor', ramp: 'heat', lo: 0, hi: 6, dec: 1, avg: sm.df, title: 'Daylight factor', legendCols: sSt.map((x) => x[1]), legendLabels: ['6%+', '3%', '0%'], stops: sSt },
        opt2: { vals: grid((e) => (e.o2ok ? 0.5 : Math.max(...e.o2) > 3000 ? 1 : 0)), unit: 'LEED option 2', ramp: 'heat', lo: 0, hi: 1, dec: 0, avg: sm.o2 * 100, title: 'LEED option 2: 300–3,000 lux at 9:00 and 15:00', legendCols: oSt.map((x) => x[1]), legendLabels: ['Over 3,000 lux', '300–3,000 lux', 'Under 300 lux'], stops: oSt } };
      const box = { x0: o[0], y0: o[1], x1: o[0] + sc.bounds.w, y1: o[1] + sc.bounds.h };
      const show = (r, fit) => views2().forEach((w2) => { w2.clearStudy?.(); w2.walkShow?.({ walks: [], T: 0, box, lv: w2.level?.(), z: sc.settings?.floorZ || 0, view: r.view, fit: !!fit, fit2: !!fit, solid: true, density: { X0: o[0], Y0: o[1], cell: RES.spacing, nx: RES.PW, ny: RES.PH, vals: r.vals, lo: r.lo, hi: r.hi }, rampStops: r.stops }); });
      return { X0: o[0], Y0: o[1], cell: RES.spacing, nx: RES.PW, ny: RES.PH, cells: RES.pts.length, avg: sm.sda * 100, views, paint: (r, fit) => show(r, fit), chartNote: 'Share of the floor in each band; hover a bar for its value.',
        rows: [['sDA300/50%', pc(sm.sda)], ['ASE1000/250 h', pc(sm.ase)], ['Mean daylight factor', fmt(sm.df, 2) + '%'], ['LEED v4.1 option 1 (sDA)', `${sm.pts1} point${sm.pts1 === 1 ? '' : 's'}${sm.ase > 0.1 ? ' · ASE over 10%: glare control needed' : ''}`], ['LEED v4.1 option 2 (300–3,000 lux)', `${pc(sm.o2)} · ${sm.pts2} point${sm.pts2 === 1 ? '' : 's'}`], ['Regularly occupied floor', fmt(sm.area) + ' m²'], ['Weather', out.epw ? esc(wx.station || 'project weather') : 'a generic year (no project weather)']],
        foot: `${fmt(RES.pts.length)} spots every ${Math.round(RES.spacing * 100)} cm, ${RES.nb} sky directions each`,
        method: `Illuminance on the work plane (${fmt(inputs.wp, 2)} m) for every daylit hour of ${out.epw ? `the project weather (${esc(wx.station || 'EPW')})` : 'a generic year at the site'}: the sky in 145 patches seen through the windows (glass light ${fmt(ST.dlTau, 2)}), the sun where it reaches the spot, reflections outside and inside (floor ${ST.dlRf}, walls ${ST.dlRw}, ceiling ${ST.dlRc}), window head ${fmt(ST.dlHead, 2)} m; occupied ${occ[0]}:00–${occ[1]}:00. sDA300/50% and ASE1000/250 h as in IES LM-83 and LEED v4.1; option 2 at 9:00 and 15:00 on 21 March and 21 September (clear sky). The method of the Daylight study; a screening, not a certified simulation.`,
        results: rec.results, settings: { ...rec.settings, label: `${DAY.LEVELS[ST.dlLevel].name}, glass ${ST.dlTau} (Workspace)` } }; }
    if (id === 'cameras') {
      const sc = w.planScene('cameras'); if (!sc.walls.length) throw Error('No walls on this level: draw the rooms first, or pick another level in the Level menu.');
      const out = await CAMS.run(sc, { camh: ST.camH, tgt: +ST.camTgt, level: ST.camLevel, mode: ST.camMode, n: ST.camN, want: +ST.camWant, types: ST.camTypes }, (f) => { ST.progress = `searching camera positions ${Math.round(f * 100)}%`; const e = studyCard.querySelector('.sp-stage.run .sp-note'); if (e) e.textContent = ST.progress; });
      const { COV, cams, G, R } = out, o = sc.origin || [0, 0], N = G.W * G.H, toP = (p) => [p[0] + o[0], p[1] + o[1]], pc = (v) => fmt(v * 100, 1) + '%';
      const count = new Float32Array(N).fill(NaN), which = new Float32Array(N).fill(NaN); for (let i = 0; i < N; i++) if (R.reg[i]) { count[i] = Math.min(4, COV.cnt[i]); if (COV.cnt[i]) which[i] = COV.own[i]; }
      const cStops = [[0, '#e2e2e2'], ...CAMS.BLUES_.map((c, i) => [(i + 1) / 4, hexOf(c)])], nC = Math.max(1, cams.length), wStops = cams.length > 1 ? cams.map((c, k) => [k / (nC - 1), c.col]) : [[0, cams[0]?.col || '#2563eb'], [1, cams[0]?.col || '#2563eb']];
      const marks = { dots: cams.map((c, k) => ({ p: toP([c.x, c.y]), col: c.col, r: 0.32, ring: true, label: String(k + 1) })), paths: cams.map((c) => ({ pts: c.poly.map(toP).concat([toP(c.poly[0])]), col: c.col, w: 0.05, al: 0.85 })) };
      const box = { x0: o[0], y0: o[1], x1: o[0] + sc.bounds.w, y1: o[1] + sc.bounds.h };
      const show = (r, fit) => views2().forEach((w2) => { w2.clearStudy?.(); w2.walkShow?.({ walks: [], T: 0, box, lv: w2.level?.(), z: sc.settings?.floorZ || 0, view: r.view, fit: !!fit, fit2: !!fit, solid: true, ...marks, density: { X0: o[0], Y0: o[1], cell: G.c, nx: G.W, ny: G.H, vals: r.vals, lo: r.lo, hi: r.hi }, rampStops: r.stops }); });
      const unreach = (1 - out.reach) * R.area, lv = CAMS.LEVELS[ST.camLevel];
      return { X0: o[0], Y0: o[1], cell: G.c, nx: G.W, ny: G.H, cells: [...R.reg].filter(Boolean).length, avg: COV.frac * 100, paint: (r, fit) => show(r, fit), chartNote: 'Share of the floor by how many cameras see it; hover a bar for its value.',
        views: { count: { vals: count, unit: 'cameras', ramp: 'heat', lo: 0, hi: 4, dec: 0, avg: COV.frac * 100, title: `Cameras · ${lv.name.toLowerCase()} at ${+ST.camTgt ? fmt(+ST.camTgt, 1) + ' m' : 'the floor'}`, legendCols: cStops.map((x) => x[1]), legendLabels: ['4 or more', '1', 'Not covered'], stops: cStops },
          cam: { vals: which, unit: 'camera', ramp: 'heat', lo: 0, hi: Math.max(1, nC - 1), dec: 0, avg: COV.frac * 100, title: 'Cameras · which camera sees it', legendCols: wStops.map((x) => x[1]), legendLabels: [`Camera ${nC}`, '', 'Camera 1'], stops: wStops } },
        rows: [['Floor covered', `${pc(COV.frac)} of ${fmt(COV.area, 1)} m²`], ['Cameras', `${cams.length} (${[...new Set(cams.map((c) => c.name))].join(', ')})`], ['Cost (example prices)', '$' + fmt(COV.cost, 2)], ['Seen by 2 or more', fmt(COV.ov[2] + COV.ov[3], 1) + ' m²'], ...(unreach > 0.05 ? [['Out of reach of any position', fmt(unreach, 1) + ' m²']] : []), ['Detail', `${lv.name} (${lv.ppm} px/m), camera at ${fmt(ST.camH, 1)} m`]],
        foot: `${cams.length} cameras from ${fmt(out.curve.length)} search rounds; ${fmt(G.c * 100)} cm floor cells`,
        method: `Each camera type reaches as far as it still gives ${lv.ppm} pixels per metre (DORI ${lv.name}, IEC 62676-4) at ${+ST.camTgt ? fmt(+ST.camTgt, 1) + ' m' : 'the floor'} from ${fmt(ST.camH, 1)} m; sight lines from the camera are blocked by walls and anything taller than the line. Candidate positions on the walls (dome, bullet: 16 directions) and the ceiling (fisheye); greedy picks plus swaps choose the set that covers the most floor${ST.camMode === 'all' ? `, until ${pc(+ST.camWant)} is covered` : `, ${ST.camN} cameras`}. The method of the Camera coverage study; a layout screening, not a security design.`,
        results: { covered: +(COV.frac * 100).toFixed(1), cameras: cams.length, cost: +COV.cost.toFixed(2) }, settings: { mode: ST.camMode, n: ST.camN, want: +ST.camWant, level: ST.camLevel, camh: ST.camH, tgt: +ST.camTgt, types: ST.camTypes, label: `${lv.name}, ${ST.camMode === 'all' ? 'cover ' + pc(+ST.camWant) : ST.camN + ' cameras'} (Workspace)` } }; }
    if (id === 'views') {
      const sc = w.planScene('views'); if (!sc.walls.length) throw Error('No walls on this level: draw the rooms first, or pick another level in the Level menu.');
      const out = await VWS.run(sc, { level: ST.vwLevel, eye: +ST.vwEye, head: ST.vwHead, far: ST.vwFar, nature: ST.vwNature, motion: ST.vwMotion }, (f) => { ST.progress = `sight lines ${Math.round(f * 100)}%`; const e = studyCard.querySelector('.sp-stage.run .sp-note'); if (e) e.textContent = ST.progress; });
      const { RES, sm } = out, o = sc.origin || [0, 0], C = VWS.COLOURS, H = ST.vwHead, grid = (f) => { const g = new Float32Array(RES.PW * RES.PH).fill(NaN); RES.pts.forEach((q, k) => { g[q.j * RES.PW + q.i] = f(RES.ev[k]); }); return g; }, pc = (v) => fmt(v * 100, 0) + '%';
      const qStops = [[0, hexOf(C.QCOL.none)], [0.5, hexOf(C.QCOL.los)], [1, hexOf(C.QCOL.q)]], vfStops = C.VFC.map((c, i) => [i / 5, hexOf(c)]), dStops = stopsOf(C.DRAMP), dmax = 3 * H * 1.5;
      const views = { quality: { vals: grid((e) => (e.quality ? 2 : e.los ? 1 : 0)), unit: 'view out', ramp: 'heat', lo: 0, hi: 2, dec: 0, avg: sm.q * 100, title: 'Quality views', legendCols: qStops.map((x) => x[1]), legendLabels: ['Quality view (2+ kinds)', 'View out, fewer kinds', 'No view out'], stops: qStops },
        vf: { vals: grid((e) => e.vf), unit: 'view factor', ramp: 'heat', lo: 0, hi: 5, dec: 0, avg: 0, title: 'View factor', legendCols: vfStops.map((x) => x[1]), legendLabels: ['5', '3 · LEED needs 3+', '0 · no view'], stops: vfStops },
        dist: { vals: grid((e) => (e.los ? Math.min(dmax, e.dmin) : NaN)), unit: 'm to the window', ramp: 'heat', lo: 0, hi: dmax, dec: 1, avg: 0, title: 'Distance to the nearest window seen', legendCols: dStops.map((x) => x[1]), legendLabels: [`${fmt(dmax, 1)} m+`, '', 'At the window'], stops: dStops } };
      const box = { x0: o[0], y0: o[1], x1: o[0] + sc.bounds.w, y1: o[1] + sc.bounds.h };
      const show = (r, fit) => views2().forEach((w2) => { w2.clearStudy?.(); w2.walkShow?.({ walks: [], T: 0, box, lv: w2.level?.(), z: sc.settings?.floorZ || 0, view: r.view, fit: !!fit, fit2: !!fit, solid: true, density: { X0: o[0], Y0: o[1], cell: RES.spacing, nx: RES.PW, ny: RES.PH, vals: r.vals, lo: r.lo, hi: r.hi }, rampStops: r.stops }); });
      return { X0: o[0], Y0: o[1], cell: RES.spacing, nx: RES.PW, ny: RES.PH, cells: RES.pts.length, avg: sm.q * 100, views, paint: (r, fit) => show(r, fit), chartNote: 'Share of the floor in each band; hover a bar for its value.',
        rows: [['Quality views', pc(sm.q)], ['Line of sight out', pc(sm.los)], ['LEED v4.1 Quality Views (75% each)', sm.met ? (sm.exemplary ? 'met (exemplary, 90%+)' : 'met') : 'not met'], ...VWS.CRITS.slice(1, 5).map((c, i) => [c.name, pc(sm.crit[i])]), ['Occupied floor', fmt(sm.area) + ' m²'], ['Eye', `${+ST.vwEye === 1.6 ? 'standing' : 'seated'} ${fmt(+ST.vwEye, 2)} m · window head ${fmt(H, 2)} m`]],
        foot: `${fmt(RES.pts.length)} spots every ${Math.round(RES.spacing * 100)} cm, ${RES.nr} sight lines each${out.R.approx ? '; the walls do not close, so the whole level counts' : ''}`,
        method: `Horizontal sight lines (${RES.nr} from each spot, a spot every ${Math.round(RES.spacing * 100)} cm on the occupied floor) at eye ${fmt(+ST.vwEye, 2)} m: walls 2 m or taller and anything as high as the eye stop them, vision glazing lets them out above its sill. Criteria as LEED v4.1 Quality Views: views in directions 90° apart; two of nature or sky${ST.vwNature ? ' (nature assumed)' : ''}, movement${ST.vwMotion ? ' (assumed)' : ''} and objects ${fmt(ST.vwFar, 1)} m+ away; a window within three head heights; view factor 3+. The method of the View analysis study; a screening, not a LEED review.`,
        results: { quality: +(sm.q * 100).toFixed(1), los: +(sm.los * 100).toFixed(1), met: sm.met }, settings: { level: ST.vwLevel, eye: +ST.vwEye, head: H, far: ST.vwFar, nature: ST.vwNature, motion: ST.vwMotion, label: `${VWS.LEVELS[ST.vwLevel].name}, eye ${ST.vwEye} m (Workspace)` } }; }
    if (id === 'isovist') {
      const sc = w.planScene('isovist'); if (!sc.walls.length) throw Error('No walls on this level: draw the rooms first, or pick another level in the Level menu.');
      const o = sc.origin || [0, 0], cen = (P) => { if (!P || P.length < 3) return null; let a = 0, x = 0, y = 0; for (let i = 0; i < P.length; i++) { const p0 = P[i], p1 = P[(i + 1) % P.length], k = p0[0] * p1[1] - p1[0] * p0[1]; a += k; x += (p0[0] + p1[0]) * k; y += (p0[1] + p1[1]) * k; } return Math.abs(a) > 1e-9 ? [x / (3 * a), y / (3 * a)] : null; };
      if (!ST.isoView) { let rooms = []; try { rooms = w.planScene('privacy').rooms || []; } catch { } const r0 = rooms.map((r) => ({ r, p: r.label || r.p || cen(r.pts || r.poly), a: (r.rects || []).reduce((t, q) => t + q[2] * q[3], 0) || r.area || 0 })).filter((x) => x.p && !/corridor|hall|lobby|landing|stair/i.test(x.r.name || '')).sort((a, b) => b.a - a.a)[0];   /* the label point of the largest room (the scene with rooms) */ if (!r0) throw Error('Place the viewpoint: press Place the viewpoint, then click the floor.'); ST.isoView = [r0.p[0] + o[0], r0.p[1] + o[1]]; }
      const vp = [ST.isoView[0] - o[0], ST.isoView[1] - o[1]], haz = (sc.furn || []).filter((f) => /stair/i.test([f.name, f.type, f.kind, f.id].join(' '))).map((f) => ({ name: f.name || 'Stairs', x: f.x + (f.w || 0) / 2, y: f.y + (f.d || 0) / 2, h: 0 }));
      const { A, CMP } = ISO.run(sc, { view: vp, eye: +ST.isoEye, tgt: +ST.isoTgt, haz }), G = A.G, N = G.W * G.H, toP = (p) => [p[0] + o[0], p[1] + o[1]];
      const seen = new Float32Array(N).fill(NaN), eyes = new Float32Array(N).fill(NaN); for (let i = 0; i < N; i++) if (A.reg[i]) { seen[i] = A.vis[i] ? 1 : 0; eyes[i] = A.cat[i] || 0; }
      const hx = (c) => hexOf(c), eyeStops = [[0, '#e4e4e4'], [1 / 3, hx(CMP[0].col)], [2 / 3, hx(CMP[1].col)], [1, hx(CMP[2].col)]], seenStops = [[0, '#e4e4e4'], [1, '#f5a623']];
      const box = { x0: o[0], y0: o[1], x1: o[0] + sc.bounds.w, y1: o[1] + sc.bounds.h }, marks = { dots: [{ p: ST.isoView, col: '#111', r: 0.32, ring: true }, ...haz.map((h, i) => ({ p: toP([h.x, h.y]), col: A.haz[i] ? '#d71920' : '#9a9a9a', r: 0.3, square: true }))], paths: [{ pts: A.poly.map(toP).concat([toP(A.poly[0])]), col: '#d6800a', w: 0.05, al: 0.9 }] };
      const show = (r, fit) => views2().forEach((w2) => { w2.clearStudy?.(); w2.walkShow?.({ walks: [], T: 0, box, lv: w2.level?.(), z: sc.settings?.floorZ || 0, view: r.view, fit: !!fit, fit2: !!fit, solid: true, ...marks, density: { X0: o[0], Y0: o[1], cell: G.c, nx: G.W, ny: G.H, vals: r.vals, lo: r.lo, hi: r.hi }, rampStops: r.stops }); });
      const pc = (v) => fmt(v * 100, 1) + '%', nh = A.haz.filter(Boolean).length, tg = +ST.isoTgt === 0 ? 'the floor' : +ST.isoTgt < 1 ? 'a seated child (0.6 m)' : 'a standing child (1.0 m)';
      return { X0: o[0], Y0: o[1], cell: G.c, nx: G.W, ny: G.H, cells: [...A.reg].filter(Boolean).length, avg: A.blind * 100, paint: (r, fit) => show(r, fit), chartNote: 'Share of the room floor seen and blind; hover a bar for its value.',
        views: { seen: { vals: seen, unit: 'seen', ramp: 'heat', lo: 0, hi: 1, dec: 0, avg: (1 - A.blind) * 100, title: `Isovist · eye ${fmt(+ST.isoEye, 2)} m`, legendCols: ['#e4e4e4', '#f5a623'], legendLabels: ['Seen', '', 'Blind spot'], stops: seenStops },
          eyes: { vals: eyes, unit: 'lowest eye that sees it', ramp: 'heat', lo: 0, hi: 3, dec: 0, avg: 0, title: 'Isovist · lowest eye that sees it', legendCols: eyeStops.map((x) => x[1]), legendLabels: [`${CMP[2].name} ${CMP[2].E.toFixed(1)} m only`, `${CMP[0].name} ${CMP[0].E.toFixed(1)} m and up`, 'Not seen at 1.6 m'], stops: eyeStops } },
        rows: [['Blind spots', `${pc(A.blind)} of ${fmt(A.eff, 1)} m²`], ['Floor seen', fmt(A.seen, 1) + ' m²'], ...A.cmp.map((c, q) => [`Blind at ${CMP[q].name.toLowerCase()} eye ${c.E.toFixed(1)} m`, pc(c.blind)]), ...(haz.length ? [['Hazards seen', `${nh} of ${haz.length}`]] : []), ['Looking for', tg]],
        foot: `720 sight lines; ${fmt(G.c * 100)} cm floor cells${A.approx ? '; the walls round the viewpoint do not close, so the whole level counts' : ''}`,
        method: `Isovist from the viewpoint at eye ${fmt(+ST.isoEye, 2)} m, looking for ${tg}: 720 sight lines; anything as tall as the eye stops a line, lower furniture hides the floor behind it to where the line over its top comes back down to the height looked for. The room is the floor closed by walls 2 m or taller and glazing; furniture footprints are not floor. The method of the Isovist safety study; supervision screening, not a safety certification.`,
        results: { blind: +(A.blind * 100).toFixed(1), seen: +A.seen.toFixed(1) }, settings: { eye: +ST.isoEye, tgt: +ST.isoTgt, view: ST.isoView, label: `Eye ${ST.isoEye} m, ${tg} (Workspace)` } }; }
    if (id === 'spacesyntax' || id === 'movementdepth') {
      const sc = w.planScene('spacesyntax'); if (!sc.walls.length) throw Error('No walls on this level: draw the rooms first, or pick another level in the Level menu.');
      const out = await SSX.run(sc, { level: ST.ssLevel, vh: +ST.ssVh, glass: ST.ssGlass, agents: 200, steps: 1500 }, (f) => { ST.progress = `visibility graph ${Math.round(f * 100)}%`; const e = studyCard.querySelector('.sp-stage.run .sp-note'); if (e) e.textContent = ST.progress; });
      const R = out.R, o = sc.origin || [0, 0], X0 = o[0], Y0 = o[1], md = id === 'movementdepth', S1 = stopsOf(SSX.SPEC), S2 = stopsOf(SSX.DEPTHMAP_SPEC);
      const grid = (arr) => { const g = new Float32Array(R.PW * R.PH).fill(NaN); for (let k = 0; k < R.N; k++) { const q = R.pts[k]; g[q.j * R.PW + q.i] = arr[k]; } return g; }, mean = (a) => Array.from(a).reduce((x, y) => x + y, 0) / Math.max(1, a.length);
      const vw = (arr, title, unit, stops, labels, dec, fixed) => { const rg = fixed || SSX.robust(arr); return { vals: grid(arr), unit, ramp: 'heat', lo: rg[0], hi: rg[1], dec, avg: mean(arr), title, legendCols: stops.map((x) => x[1]), legendLabels: labels, stops }; };
      const pal = md ? S2 : S1, views = { integ: vw(R.integ, 'Visual integration [HH]', 'integration', pal, ['Integrated', '', 'Segregated'], 2), flowdepth: vw(R.flowdepth, 'Movement + depth', 'movement × depth', S2, ['Movement gathers', '', 'Quiet, deep'], 2, [0, 1]), gate: vw(R.gate, 'Agent counts', 'agent crossings', pal, ['Most crossings', '', 'None'], 0) };
      if (!md) { views.r3 = vw(R.r3, 'Visual integration R3', 'integration R3', S1, ['Integrated locally', '', 'Segregated'], 2); views.conn = vw(R.conn, 'Connectivity (nodes in view)', 'nodes in view', S1, ['Sees most', '', 'Sees least'], 0); }
      const box = { x0: X0, y0: Y0, x1: X0 + sc.bounds.w, y1: Y0 + sc.bounds.h };
      const show = (r, fit) => views2().forEach((w2) => { w2.clearStudy?.(); w2.walkShow?.({ walks: [], T: 0, box, lv: w2.level?.(), z: sc.settings?.floorZ || 0, view: r.view, fit: !!fit, fit2: !!fit, solid: true, density: { X0, Y0, cell: R.spacing, nx: R.PW, ny: R.PH, vals: r.vals, lo: r.lo, hi: r.hi }, rampStops: r.stops }); });
      const lab = sc.name?.split(' · ').pop() || 'this level', hiK = [...R.integ.keys()].sort((a, b) => R.integ[b] - R.integ[a]).slice(0, Math.max(1, Math.round(R.N * 0.1)));
      return { X0, Y0, cell: R.spacing, nx: R.PW, ny: R.PH, cells: R.N, avg: mean(R.integ), views, paint: (r, fit) => show(r, fit), chartNote: 'Share of the floor in each band; hover a bar for its value.',
        rows: [[md ? 'Movement + depth, mean' : 'Mean visual integration', md ? fmt(mean(R.flowdepth), 2) : fmt(mean(R.integ), 2)], ['Intelligibility (connectivity vs integration, R²)', fmt(R.r2, 2)], ['Nodes', `${fmt(R.N)}, every ${Math.round(R.spacing * 100)} cm`], ['Floor analysed', fmt(out.area) + ' m²'], ['Analysis height', +ST.ssVh === 1.6 ? 'eye 1.6 m (see)' : 'knee 0.5 m (walk)'], ['Most integrated tenth', `integration ${fmt(Math.min(...hiK.map((k) => R.integ[k])), 2)} and up`], ['Agents', `200 × 1,500 steps, ${fmt(Math.max(...R.gate))} crossings at the busiest node`]],
        foot: `${fmt(R.N)} nodes on ${esc(lab)}${out.approx ? ' (no closed rooms found: the whole drawing area)' : ''}`,
        method: `Visibility graph analysis (Turner et al. 2001, as in DepthmapX) of ${esc(lab)}: a node every ${Math.round(R.spacing * 100)} cm on the floor inside the walls, ${R.nr} sight lines from each; nodes that see each other at ${+ST.ssVh === 1.6 ? 'eye height (1.6 m)' : 'knee height (0.5 m)'} are joined${ST.ssGlass ? ', glass is seen through' : ''}. Integration [HH] from the mean visual depth (Hillier & Hanson RRA, diamond D-value), R3 within three steps; intelligibility is R² of connectivity against integration. 200 agents each pick a spot in their 170° view and walk three steps towards it, 1,500 steps in all (gate counts); Movement + depth weights their crossings 0.65 (square root) with integration 0.35.`,
        results: { integ: +mean(R.integ).toFixed(3), r2: +R.r2.toFixed(3), nodes: R.N }, settings: { level: ST.ssLevel, vh: +ST.ssVh, glass: ST.ssGlass, label: `${SSX.LEVELS[ST.ssLevel].name}, ${+ST.ssVh === 1.6 ? 'eye' : 'knee'} (Workspace)` } }; }
    if (id === 'privacy') {
      const sc = w.planScene('privacy'); if (!sc.walls.length) throw Error('No walls on this level: draw the rooms first, or pick another level in the Level menu.');
      if (!ST.priv.sides.length) throw Error('Pick at least one side with a street.');
      const out = await PRIV.run(sc, { ...ST.priv }, (f) => { ST.progress = `onlookers ${Math.round(f * 100)}%`; const e = studyCard.querySelector('.sp-stage.run .sp-note'); if (e) e.textContent = ST.progress; });
      const { RES, F, SC: S2 } = out, R = RES.R, o = S2.origin || [0, 0], X0 = o[0] + R.x0, Y0 = o[1] + R.y0, N = R.W * R.H, NI = { none: 0, low: 1, medium: 2, high: 3 };
      const need = new Float32Array(N).fill(NaN); for (const k of RES.cells) need[k] = NI[out.needOf(S2.rooms[RES.room[k]].name)];
      const toP = (p) => [p[0] + o[0], p[1] + o[1]], B = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }; for (const ob of RES.obs) { B.x0 = Math.min(B.x0, ob.p[0]); B.y0 = Math.min(B.y0, ob.p[1]); B.x1 = Math.max(B.x1, ob.p[0]); B.y1 = Math.max(B.y1, ob.p[1]); }
      const box = { x0: Math.min(X0, B.x0 + o[0]) - 1, y0: Math.min(Y0, B.y0 + o[1]) - 1, x1: Math.max(X0 + R.W * R.c, B.x1 + o[0]) + 1, y1: Math.max(Y0 + R.H * R.c, B.y1 + o[1]) + 1 };
      const seenDots = new Map(); for (const ob of RES.obs) seenDots.set(ob.p.join(','), ob);
      const dots = [...seenDots.values()].map((ob) => ({ p: toP(ob.p), col: '#111827', r: ob.kind === 'street' ? 0.25 : 0.18 })), lines = F.wins.map(([wn]) => ({ a: toP(wn.a), b: toP(wn.b), col: '#d8402a', w: 0.22 }));
      const needStops = [[0, '#d2d2cd'], [0.34, '#b4c878'], [0.67, '#f5a623'], [1, '#d8402a']];
      const show = (r, fit) => views2().forEach((w2) => { w2.clearStudy?.(); w2.walkShow?.({ walks: [], T: 0, box, lv: w2.level?.(), z: S2.settings?.floorZ || 0, view: r.view, fit: !!fit, fit2: !!fit, solid: r.view === 'need', lines: r.view === 'exp' ? lines : [], dots: r.view === 'exp' ? dots : [],
        density: { X0, Y0, cell: R.c, nx: R.W, ny: R.H, vals: r.vals, lo: r.lo, hi: r.hi }, rampStops: r.view === 'need' ? needStops : stopsOf(PRIV.EXP) }); });
      const rooms = RES.rooms.map((x) => [`${esc(x.r.name)}${PRIV.LIMIT[x.need] != null && x.share > PRIV.LIMIT[x.need] ? ' · <b style="color:#d8402a">screen</b>' : ''}`, `${PRIV.NEEDT[x.need]} need · ${Math.round(x.share)}% seen`]);
      return { X0, Y0, cell: R.c, nx: R.W, ny: R.H, cells: RES.cells.length, avg: F.floor, chartNote: 'Share of the floor in each band of onlookers who see it; hover a bar for its value.', foot: `${RES.obs.length} onlookers, ${RES.cells.length} spots of floor`,
        views: { exp: { legendCols: stopsOf(PRIV.EXP).map((x) => x[1]), vals: RES.exp, unit: '% of onlookers', ramp: 'heat', lo: 0, hi: 100, dec: 0, avg: F.floor, title: 'Privacy · seen from outside', legendLabels: ['All onlookers', '', 'None'] }, need: { legendCols: needStops.map((x) => x[1]), vals: need, unit: 'privacy need', ramp: 'heat', lo: 0, hi: 3, dec: 0, avg: 0, title: 'Privacy · need of each room', legendLabels: ['High', 'Medium · Low', 'None'] } },
        paint: (r, fit) => show(r, fit),
        probe: (x, y) => { const i = Math.floor((x - X0) / R.c), j = Math.floor((y - Y0) / R.c); if (i < 0 || j < 0 || i >= R.W || j >= R.H) return null; const k = j * R.W + i; if (RES.room[k] < 0) return null; const rm = S2.rooms[RES.room[k]];
          return `<div class="sp-kv"><span>Room</span><b>${esc(rm.name)}</b></div><div class="sp-kv"><span>Seen by</span><b>${Math.round(RES.exp[k])}% of onlookers</b></div><div class="sp-kv"><span>Need</span><b>${PRIV.NEEDT[out.needOf(rm.name)]}</b></div>`; },
        rows: [['Floor seen from outside', fmt(F.floor, 1) + '%'], ['Private floor seen', F.hasPriv ? fmt(F.priv, 1) + '%' : 'no private rooms'], ['Rooms to screen', String(F.toScreen.length)], ['Windows to screen', String(F.wins.length) + (F.wins.length ? ' (red on the plan)' : '')], ['Most exposed room', F.worst && F.worst.share > 0 ? `${esc(F.worst.r.name)} ${Math.round(F.worst.share)}%` : 'none'], ...rooms],
        method: `Onlookers walk along the street ${fmt(ST.priv.dS, 1)} m from the walls on the chosen sides at ${fmt(ST.priv.eye, 1)} m eye height${ST.priv.dO > ST.priv.dS && ST.priv.hO >= 1 ? `, and look out of a building opposite ${fmt(ST.priv.dO)} m away at every storey up to ${fmt(ST.priv.hO)} m` : ''}. For every spot of the floor (1.2 m above it, a seated or standing person) the share of them that can see it through a window, checked against each window's sill and head; furniture taller than the line of sight blocks it. A high-need room needs a screen above ${PRIV.LIMIT.high}% of its floor seen, a medium one above ${PRIV.LIMIT.medium}%. The method of the Privacy study: geometric screening (straight sight lines; curtains, frosting, planting and reflections are not modelled).`,
        results: { floor: +F.floor.toFixed(1), priv: +F.priv.toFixed(1), rooms: F.toScreen.length, windows: F.wins.length }, settings: { ...ST.priv, label: `Privacy, ${esc(sc.name || '')} (Workspace)` } }; }
    if (id === 'evac') {
      const pl = w.levelPlan(); if (!pl.box) throw Error('No walls on this level: draw the rooms first (Draw room), or pick another level in the Level menu.');
      const places = placesOf(pl), t0 = performance.now(); ST.progress = 'routes and ant walks'; drawStudy();
      const R = await CIRC.run({ segs: pl.segs, box: pl.box }, places, { weighted: ST.circW === 'use', onProg: (f) => { ST.progress = `pair walks ${Math.round(f * 100)}%`; const e = studyCard.querySelector('.sp-stage.run .sp-note'); if (e) e.textContent = ST.progress; }, stop: () => ST.cancel });
      const D = R.density, a2 = D.cell * D.cell, per = D.vals.map((v) => v / a2), st = statsOf(per), hi = Math.max(1, R.density.ref / a2), box = { x0: pl.box.x0 - 1, y0: pl.box.y0 - 1, x1: pl.box.x1 + 1, y1: pl.box.y1 + 1 };
      const walks = R.walks.map((x) => ({ pts: x.pts, len: x.len, t0: x.t0, al: x.al, col: CIRC.rampV(x.r) })), name = (i) => `${places[i].letter} ${places[i].name}`;
      const longest = R.ok.reduce((m, P) => (!m || P.r.len > m.r.len ? P : m), null), busyRoom = (() => { let b = null, d = Infinity; for (const q of places) { const dd = Math.hypot(q.p[0] - R.busy[0], q.p[1] - R.busy[1]); if (dd < d) { d = dd; b = q; } } return b && d < 3 ? ` (by ${b.name})` : ''; })();
      const show = (r, fit) => views2().forEach((w2) => { w2.clearStudy?.(); w2.walkShow?.({ walks, T: R.T, box, lv: pl.lv, z: pl.z, places: places.filter((q) => q.use > 0), view: r.view, play: r.view === 'walks' && ST.anim !== false && !r.played, fit: !!fit, fit2: !!fit, speed: 8, density: { X0: D.X0, Y0: D.Y0, cell: D.cell, nx: D.nx, ny: D.ny, vals: per, hi }, ramp: 'violet' }); });
      const table = [...R.ok].sort((a, b) => b.share - a.share || b.r.len - a.r.len).slice(0, 8).map((P) => [`${esc(name(P.i))} ⇄ ${esc(name(P.j))}`, `${fmt(P.share * 100)}% · ${fmt(P.r.len, 1)} m`]);
      const bad = R.pairs.filter((P) => !P.r);
      return { X0: D.X0, Y0: D.Y0, cell: D.cell, nx: D.nx, ny: D.ny, cells: R.walks.length, prisms: 0, context: 0, terrain: false, avg: R.avg, chartNote: 'Share of the walked floor in each band of metres walked per m²; hover a bar for its value.',
        views: { walks: { vals: per, unit: 'm walked per m²', ramp: 'violet', lo: 0, hi, dec: 0, avg: st.avg, title: `Circulation · walks, ${pl.level}`, legendLabels: ['Last rounds (settled)', '', 'First rounds (exploring)'] }, density: { vals: per, unit: 'm walked per m²', ramp: 'violet', lo: 0, hi, dec: 0, avg: st.avg, title: `Circulation · density, ${pl.level}` } },
        paint: (r, fit) => { show(r, fit); r.played = true; }, foot: `${R.walks.length} ant walks between ${places.filter((q) => q.use > 0).length} places on ${esc(pl.level)}`,
        probe: (x, y) => { const i = Math.floor((x - D.X0) / D.cell), j = Math.floor((y - D.Y0) / D.cell); if (i < 0 || j < 0 || i >= D.nx || j >= D.ny) return null; const v = per[j * D.nx + i]; let near = null, dn = Infinity; for (const q of places) { const dd = Math.hypot(q.p[0] - x, q.p[1] - y); if (dd < dn) { dn = dd; near = q; } }
          return `<div class="sp-kv"><span>Walked here</span><b>${Number.isFinite(v) ? fmt(v, 1) + ' m per m²' : 'not walked'}</b></div>${near && dn < 2.5 ? `<div class="sp-kv"><span>Place</span><b>${esc(near.letter + ' ' + near.name)}</b></div>` : ''}`; },
        rows: [['Average walk', fmt(R.avg, 1) + ' m'], ['Pairs walked', `${R.ok.length} of ${R.pairs.length}`], ...(longest ? [['Longest walk', `${esc(name(longest.i))} ⇄ ${esc(name(longest.j))}, ${fmt(longest.r.len, 1)} m, ${fmt(longest.r.len / 1.3)} s at 1.3 m/s`]] : []), ['Busiest spot', `about ${fmt(R.busyV)} ant crossings${busyRoom}`], ['Walked in all', fmt(R.walked) + ' m in ' + R.walks.length + ' walks'], ...table, ...(bad.length ? [['No way through', esc(bad.map((P) => name(P.i) + ' ⇄ ' + name(P.j)).join(', ')) + ': a door may be missing']] : [])],
        method: `Between every pair of places on ${esc(pl.level)}: the shortest walkable route (0.4 m grid; walls block, doors and wall openings let through, furniture is in the way) and an ant colony's walks over ${R.iters} rounds (up to ${R.ants} ants a round on the busiest pair${ST.circW === 'use' ? ', the others in proportion to how often their rooms are used' : ', the same on every pair'}), seed ${R.seed}: the same inputs replay the same walks. Each walk wobbles a little, so the walks along one corridor read as a band; pink lines are the exploring first rounds, deep purple the settled last ones. Walking at 1.3 m/s. The method of the Circulation study, for early layout: it shows where people would tend to walk, not how many will.`,
        results: { walk: +R.avg.toFixed(1), pairs: R.ok.length }, settings: { level: pl.lv, weighted: ST.circW === 'use', label: `Circulation, ${pl.level} (Workspace)` } }; }
    if (id === 'structure') {
      const sys = systemOf(), [, sname, deadOf, depthOf, fcol, sdesc] = SYSTEMS.find((x) => x[0] === sys), span = +ST.span, qa = +ST.bearing, ms = w.structGrid({ span });
      if (!ms.length) throw Error('Draw a mass first: the column grid is laid out in the masses.');
      const cols = [], rows = [], tint = {}; let nMax = 0, pMax = 0, worst = null, weight = 0;
      for (const m of ms) { const sp = Math.max(...m.spans), D = deadOf(sp), Lv = LIVE[m.use] ?? 2.4, roofD = D, snow = 1.0, wf = 1.25 * D + 1.5 * Lv, wr = 1.25 * roofD + 1.5 * snow, n = m.storeys;
        const service = m.area * ((n - 1) * (D + Lv) + roofD + snow), p = service / Math.max(1, m.area); weight += service; if (p > pMax) { pMax = p; worst = m; }
        for (const c of m.cols) { const N = c.trib * (wf * (n - 1) + wr), A = N * 1000 / (fcol * 1e6), size = sys === 'steel' ? Math.sqrt(A) : Math.max(sys === 'timber' ? 0.265 : 0.3, Math.ceil(Math.sqrt(A) / 0.05) * 0.05); nMax = Math.max(nMax, N);
          cols.push({ x: c.x, y: c.y, z0: m.base, z1: m.top, N, A, size, trib: c.trib, p, depth: depthOf(sp), mass: m.id }); }
        rows.push([`${esc(m.name || 'Mass')} · ${n} storeys`, `${m.cols.length} columns, ${fmt(m.spans[0], 1)} × ${fmt(m.spans[1], 1)} m bays, ${fmt(p)} kPa on the ground`]); }
      const sizes = cols.map((c) => c.size).sort((a, b) => a - b), big = sizes.at(-1), kgm = (A) => A * 7850, depth = Math.max(...cols.map((c) => c.depth));
      const mk = (key, val, unit, lo, hi, dec, title, colorOf) => { const vals = Float32Array.from(cols.map(val)); return { vals, unit, ramp: 'ladybug', lo, hi, dec, avg: statsOf(vals).avg, title, colorOf }; };
      const views = { load: mk('load', (c) => c.N, 'kN', 0, Math.max(10, nMax), 0, 'Structure · ground-floor column load'),
        size: mk('size', (c) => (sys === 'steel' ? kgm(c.A) : c.size * 1000), sys === 'steel' ? 'kg/m of steel' : 'mm square', 0, sys === 'steel' ? Math.max(50, kgm(Math.max(...cols.map((c) => c.A)))) : Math.max(400, big * 1000), 0, 'Structure · column size at the ground'),
        pressure: mk('pressure', (c) => c.p, 'kPa (service)', 0, Math.max(qa * 1.5, pMax), 0, `Structure · pressure on the ground vs ${qa} kPa`),
        depth: mk('depth', (c) => c.depth * 1000, 'mm floor depth', 0, Math.max(400, depth * 1000), 0, 'Structure · floor depth') };
      const paint = (r, fit) => { const tintOf = {}; for (const c of cols) { const v = r.vals[cols.indexOf(c)], t = (v - r.lo) / Math.max(1e-9, r.hi - r.lo); c.color = rampHex('ladybug', t); }
        for (const m of ms) { const cs = cols.filter((c) => c.mass === m.id); tintOf[m.id] = r.view === 'pressure' || r.view === 'depth' ? cs[0]?.color : '#d7dbe0'; }
        views2().forEach((w2) => { w2.clearStudy?.(); w2.structShow?.({ cols: cols.map((c) => ({ x: c.x, y: c.y, z0: c.z0, z1: c.z1, s: Math.max(0.35, sys === 'steel' ? 0.35 : c.size), color: c.color })), tint: tintOf, fit }); }); };
      const csv = () => ['mass,x_m,y_m,tributary_m2,load_kN,column_mm,steel_kg_per_m,pressure_kPa,floor_depth_mm', ...cols.map((c) => [c.mass, c.x.toFixed(2), c.y.toFixed(2), c.trib.toFixed(1), Math.round(c.N), sys === 'steel' ? '' : Math.round(c.size * 1000), sys === 'steel' ? Math.round(kgm(c.A)) : '', Math.round(c.p), Math.round(c.depth * 1000)].join(','))];
      return { cells: cols.length, prisms: ms.length, context: 0, terrain: false, views, paint, csv, avg: nMax, chartNote: 'Share of the columns in each band; hover a bar for its value.', foot: `${cols.length} columns in ${ms.length} ${ms.length === 1 ? 'mass' : 'masses'}`,
        rows: [['Heaviest ground-floor column', fmt(nMax) + ' kN (factored)'], ['Column size, largest', sys === 'steel' ? `about ${fmt(kgm(Math.max(...cols.map((c) => c.A))))} kg/m of steel` : `${fmt(big * 1000)} mm square`], ['Floor depth', fmt(depth * 1000) + ' mm structure'], ['Pressure on the ground, highest', `${fmt(pMax)} kPa ${pMax > qa ? `· above the assumed ${qa} kPa: piles or a larger raft likely` : `· within the assumed ${qa} kPa`}`], ['Building weight (service)', fmt(weight / 9.81 / 1000, 1) + ' kt'], ...rows],
        method: `${sname}: ${sdesc}. A column grid at about ${span} m in every mass (along its longest side); each column carries the floor nearest to it. Loads: floor dead load ${fmt(deadOf(span), 1)} kPa with finishes and partitions, occupancy loads by use (NBC 2020 typical: residential 1.9, office 2.4, retail 4.8 kPa), roof snow 1.0 kPa assumed; factored 1.25 D + 1.5 L for the columns, service D + L for the ground. The soil bearing is assumed (${qa} kPa) until a geotechnical report. Rules of thumb for early design, to be checked by a structural engineer; no lateral (wind, seismic) design.`,
        results: { colMax: Math.round(nMax), size: sys === 'steel' ? null : Math.round(big * 1000), depth: Math.round(depth * 1000), pressure: Math.round(pMax), columns: cols.length }, settings: { system: sys, span, bearing: qa, label: `${sname}, ${span} m grid (Workspace)` } }; }
    if (id === 'watersound') {
      // the sound of the site's water (2026-11-06): each fall a point source, riffles along streams weaker ones; levels in dB(A) on
      // the ground (1.5 m up), on the facades and at each room's windows, with screening by buildings and the terrain
      const WB = w.waterSpecs?.() || []; if (!WB.length) throw Error('No water on the site: draw a water area (Site › Water) or map one first.');
      const eff = ({ gentle: 3e-7, typical: 1e-6, loud: 3e-6 })[ST.wsLoud] || 1e-6, src = [];
      for (const b of WB) { for (const f of b.falls) { const h = f.dir.map((v) => v / (Math.hypot(...f.dir) || 1)); src.push({ x: f.p[0] + h[0] * 0.6, y: f.p[1] + h[1] * 0.6, z: (f.top + f.bot) / 2, lw: WTRL.fallPower({ discharge: b.discharge }, f, eff), kind: 'fall', name: `${b.name}, falls of ${fmt(f.drop, 1)} m` }); }
        if (b.type === 'stream' && b.centre && b.speed >= 0.3) { const C = b.centre, cum = [0]; for (let i = 1; i < C.length; i++) cum.push(cum[i - 1] + Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]));   // running water every 8 m
          for (let s0 = 4; s0 < cum[cum.length - 1]; s0 += 8) { let i = 1; while (i < C.length - 1 && cum[i] < s0) i++; const u = (s0 - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]); src.push({ x: C[i - 1][0] + (C[i][0] - C[i - 1][0]) * u, y: C[i - 1][1] + (C[i][1] - C[i - 1][1]) * u, z: C[i - 1][2] + (C[i][2] - C[i - 1][2]) * u + 0.1, lw: 66 + 10 * Math.log10(Math.max(0.02, b.discharge)) + 10 * Math.log10(Math.max(0.3, b.speed) / 0.5), kind: 'riffle', name: b.name }); } } }
      if (!src.length) throw Error('The site’s water is still or slow: set a stream’s surface speed (Project data › Site › the water) or draw where it falls.');
      const g = w.groundMask({ maxCells: flowOf(), levels: true }), N = g.nx * g.ny, zAt = (x, y) => { const i = Math.floor((x - g.X0) / g.cell), j = Math.floor((y - g.Y0) / g.cell); return i < 0 || j < 0 || i >= g.nx || j >= g.ny ? null : g.z ? g.z[j * g.nx + i] : 0; };
      const solidAt = (x, y) => { const i = Math.floor((x - g.X0) / g.cell), j = Math.floor((y - g.Y0) / g.cell); return i >= 0 && j >= 0 && i < g.nx && j < g.ny && g.solid[j * g.nx + i]; };
      // what stands between: a building (−10 dB, a thin barrier's typical screening) or the terrain rising over the line (−8 dB)
      const screen = (s, x, y, z, skip) => { const L = Math.hypot(x - s.x, y - s.y), n = Math.max(2, Math.ceil(L / Math.max(0.5, g.cell))); let bld = false, ter = false;
        for (let k = 1; k < n; k++) { const u = k / n, px = s.x + (x - s.x) * u, py = s.y + (y - s.y) * u; if (Math.hypot(px - x, py - y) < skip || Math.hypot(px - s.x, py - s.y) < 1) continue; if (!bld && solidAt(px, py)) bld = true; const zz = zAt(px, py); if (!ter && zz != null && zz > s.z + (z - s.z) * u + 0.3) ter = true; if (bld && ter) break; }
        return (bld ? 10 : 0) + (ter ? 8 : 0); };
      const level = (x, y, z, skip = 0, facing = null) => { let e = 0; for (const s of src) { const r = Math.max(1, Math.hypot(x - s.x, y - s.y, z - s.z)); let lp = s.lw - 20 * Math.log10(r) - 8 - 0.005 * r - screen(s, x, y, z, skip);   // hemispherical spreading over the ground, a little air absorption
          if (facing) { const dx = s.x - x, dy = s.y - y; if (dx * facing[0] + dy * facing[1] < 0) lp -= 8; } e += 10 ** (lp / 10); } return e > 0 ? 10 * Math.log10(e) : NaN; };
      const vals = new Float32Array(N).fill(NaN); for (let c = 0; c < N; c++) { if (g.solid[c]) continue; const x = g.X0 + (c % g.nx + 0.5) * g.cell, y = g.Y0 + (((c / g.nx) | 0) + 0.5) * g.cell; vals[c] = level(x, y, (g.z ? g.z[c] : 0) + 1.5); }
      // the facades, and each room at its windows (outside), then inside with the windows open (about −10 dB) or shut (about −25 dB)
      w.surfaceSamples?.(); const sl = w.surfaceList?.() || [], sv = sl.length ? Float32Array.from(sl, (S0) => (S0.roof ? NaN : level(S0.p[0] + S0.n[0] * 0.3, S0.p[1] + S0.n[1] * 0.3, S0.p[2], 1.2, S0.n))) : null;
      const bs = w.buildingScene?.(), rooms = [];
      for (const L of bs?.levels || []) { const sc = L.sc, o = sc.origin || [0, 0];
        for (const op of sc.open || []) { if (op.kind !== 'win' || !op.ext) continue; const m = [(op.a[0] + op.b[0]) / 2, (op.a[1] + op.b[1]) / 2], d = [op.b[0] - op.a[0], op.b[1] - op.a[1]], dl = Math.hypot(...d) || 1, n0 = [-d[1] / dl, d[0] / dl];
          let rm = null, bd = 1.2; for (const r of sc.rooms || []) for (const [x0, y0, w0, h0] of r.rects || []) { const dx = Math.max(x0 - m[0], 0, m[0] - x0 - w0), dy = Math.max(y0 - m[1], 0, m[1] - y0 - h0), dd = Math.hypot(dx, dy); if (dd < bd) { bd = dd; rm = r; } } if (!rm) continue;
          const c0 = rm.label || [rm.rects[0][0] + rm.rects[0][2] / 2, rm.rects[0][1] + rm.rects[0][3] / 2], out = (n0[0] * (m[0] - c0[0]) + n0[1] * (m[1] - c0[1])) >= 0 ? n0 : [-n0[0], -n0[1]];
          const lv = level(m[0] + o[0] + out[0] * 0.4, m[1] + o[1] + out[1] * 0.4, L.z + 1.5, 1.0, out), key = L.id + '|' + rm.id; let e = rooms.find((x) => x.key === key); if (!e) rooms.push(e = { key, room: rm.name, level: L.name, lv: -Infinity }); if (lv > e.lv) e.lv = lv; } }
      rooms.sort((a, b) => b.lv - a.lv); const st = statsOf(vals), lo = 35, hi = 85, top = rooms[0], STOPS = [[0, '#f3f1ec'], [0.3, '#bfe0d8'], [0.55, '#5bb3c4'], [0.78, '#2c6fa3'], [1, '#18325e']];
      const share = (t) => { let k = 0, n2 = 0; for (const v of vals) if (Number.isFinite(v)) { n2++; if (v >= t) k++; } return n2 ? k / n2 * 100 : 0; };
      const loud = ST.wsLoud === 'gentle' ? 'gentle' : ST.wsLoud === 'loud' ? 'loud' : 'typical';
      return { ...g, cells: st.n, avg: st.avg, slist: sl, views: {
          level: { vals, svals: sv, unit: 'dB(A)', ramp: 'heat', lo, hi, dec: 0, avg: st.avg, title: 'Water sound · level at 1.5 m', legendCols: STOPS.map((x) => x[1]) },
          quiet: { vals: Float32Array.from(vals, (v) => (Number.isFinite(v) ? (v < 55 ? 0 : 1) : NaN)), svals: sv ? Float32Array.from(sv, (v) => (Number.isFinite(v) ? (v < 55 ? 0 : 1) : NaN)) : null, unit: 'share', ramp: 'risk', lo: 0, hi: 1, dec: 0, avg: share(55), title: 'Water sound · 55 dB(A) or more', legendLabels: ['55 dB(A) or more', '', 'Under 55 dB(A)'] } },
        rows: [['Loudest at a window', top ? `${fmt(top.lv)} dB(A), ${esc(top.room)} (${esc(top.level)})` : '—'], ['Mean on the ground', fmt(st.avg) + ' dB(A)'], ['Ground at 55 dB(A) or more', fmt(share(55)) + '%'], ['Sources', `${src.filter((s) => s.kind === 'fall').length} falls (sound power ${src.filter((s) => s.kind === 'fall').map((s) => fmt(s.lw)).join(', ') || '—'} dB), ${src.filter((s) => s.kind === 'riffle').length} stretches of running water`],
          ...rooms.slice(0, 12).map((r) => [`${esc(r.room)} · ${esc(r.level)}`, `${fmt(r.lv)} dB(A) at the windows; inside about ${fmt(r.lv - 10)} open, ${fmt(r.lv - 25)} shut`]), ['For reference', 'WHO (1999): 35 dB(A) in living rooms by day, 30 dB(A) in bedrooms at night, for continuous noise']],
        method: `Each fall is a point source halfway down its drop, its sound power from the power of the falling water (1000 × 9.81 × flow × drop, W) with an acoustic efficiency of ${eff.toExponential(0)} (${loud}; an assumption: measured falls vary widely), and running water along each stream a weaker source every 8 m. Levels add up over the sources with spreading over the ground (−20 log r − 8 dB), a little air absorption, −10 dB where a building stands between and −8 dB where the terrain rises over the line; on a facade, sources behind it count 8 dB less. At each room's outside windows the loudest level is given, and inside about 10 dB less with the windows open and 25 dB less with them shut. A screening in A-weighted levels, not a measurement or an ISO 9613 calculation; water sound is often heard as pleasant, and these are levels, not annoyance.`,
        foot: `${fmt(st.n)} ground cells at ${fmt(g.cell, 1)} m, ${src.length} sources${sv ? `, ${fmt(sv.length)} facade squares` : ''}, ${rooms.length} rooms with outside windows`,
        results: { window: top ? +top.lv.toFixed(1) : null, ground: +st.avg.toFixed(1), loud55: +share(55).toFixed(1), falls: src.filter((s) => s.kind === 'fall').length, rooms: rooms.map((r) => ({ room: r.room, level: r.level, dBA: +r.lv.toFixed(1) })) }, settings: { loudness: loud, efficiency: eff, label: `Water sound, ${loud} falls (Workspace)` } }; }
    if (id === 'stormwater') {
      const g = w.groundMask({ maxCells: flowOf(), levels: true }), N = g.nx * g.ny, a2 = g.cell * g.cell, rain = +ST.storm, [, cname, cg] = COVERS.find((x) => x[0] === ST.cover), green = (api.layers?.() || []).some((l) => l.visible !== false && l.material === 'green-roof'), cr = green ? 0.5 : 0.95;
      const CK = [cg, 0.25, 1, 0.9], C = new Float32Array(N); let drawnA = 0; for (let c = 0; c < N; c++) { C[c] = g.solid[c] ? (g.design[c] ? cr : 0.95) : CK[g.cover?.[c] || 0]; if (!g.solid[c] && g.cover?.[c]) drawnA += g.cell * g.cell; }
      if (g.cover) { const wat = new Uint8Array(N); let nw = 0; for (let c = 0; c < N; c++) if (g.cover[c] === 2) { wat[c] = 1; nw++; } if (nw) g.water = wat; }   // streams and ponds of the site carry their water away (2026-11-06)
      const r = stormwater(g, C, rain), flow = new Float32Array(N).fill(NaN), pond = new Float32Array(N).fill(NaN), coef = new Float32Array(N).fill(NaN); let fmax = 0, wet = 0, dmax = 0, roofA = 0, n = 0;
      for (let c = 0; c < N; c++) { if (g.solid[c]) { if (g.design[c]) roofA += a2; continue; } n++; coef[c] = C[c]; const f = Math.log10(1 + r.acc[c]); flow[c] = f; fmax = Math.max(fmax, f); if (r.pond[c] >= 0.02) { pond[c] = r.pond[c]; wet++; dmax = Math.max(dmax, r.pond[c]); } }
      const ux = new Float32Array(N), uy = new Float32Array(N); for (let c = 0; c < N; c++) { const d = r.to[c]; if (d < 0 || g.solid[c] || r.acc[c] < 1 || !g.terrain) continue; const dx = (d % g.nx) - (c % g.nx), dy = ((d / g.nx) | 0) - ((c / g.nx) | 0), L = Math.hypot(dx, dy) || 1, v = 0.3 + Math.log10(1 + r.acc[c]); ux[c] = dx / L * v; uy[c] = dy / L * v; }
      const anim = g.terrain ? { ux, uy, lo: 0, hi: 0.3 + Math.max(1, fmax), tint: '#ffffff', ramp: 'water', min: 0.2, speed: 6, lift: 0.4, arrows: false, life: 6 } : null;
      const qRoof = cr * rain * roofA / 3600, full = r.hollows.filter((h) => h.full && h.vol > 1).length, big = r.hollows.filter((h) => h.vol > 1).length;
      if (!g.terrain) for (let c = 0; c < N; c++) if (!g.solid[c]) flow[c] = NaN;
      // the drainage picture (2026-10-31): high dry ground in a warm tint, flow paths in pale to mid blue, ponds deepening to strong blue
      let zlo = Infinity, zhi = -Infinity; if (g.z) for (let c = 0; c < N; c++) if (!g.solid[c]) { zlo = Math.min(zlo, g.z[c]); zhi = Math.max(zhi, g.z[c]); }
      const map = new Float32Array(N).fill(NaN), dref = Math.max(0.05, dmax);
      for (let c = 0; c < N; c++) { if (g.solid[c]) continue; if (r.pond[c] >= 0.02) { map[c] = 0.75 + 0.25 * Math.min(1, r.pond[c] / dref); continue; } const fr = g.terrain ? Math.log10(1 + r.acc[c]) / Math.max(1e-6, fmax) : 0;
        if (fr > 0.3) { map[c] = 0.4 + 0.33 * Math.min(1, (fr - 0.3) / 0.7); continue; } const zr = g.z && zhi > zlo ? (g.z[c] - zlo) / (zhi - zlo) : 0; map[c] = 0.36 - 0.36 * Math.max(0, (zr - 0.55) / 0.45); }
      // flow lines: from each channel head (a cell carrying enough water that nothing upstream does) downhill until the edge, a pond or
      // a line already drawn; smoothed, wider where more water runs, an arrow every so often and at the end
      let streams = null;
      if (g.terrain) { const acc = r.acc, to = r.to, amax = Math.max(...acc), thr = Math.max(amax * 0.012, 3), up = new Uint8Array(N); for (let c = 0; c < N; c++) if (to[c] >= 0 && acc[c] >= thr) up[to[c]] = 1;
        const seen = new Uint8Array(N), heads = [], lines = [], xy = (c) => [g.X0 + (c % g.nx + 0.5) * g.cell, g.Y0 + (((c / g.nx) | 0) + 0.5) * g.cell];
        const starts = []; for (let c = 0; c < N; c++) if (!g.solid[c] && acc[c] >= thr && !up[c]) starts.push(c); starts.sort((a, b) => acc[b] - acc[a]);
        for (const c0 of starts.slice(0, 160)) { const path = []; let c = c0, stop = false; for (let k = 0; k < 4000; k++) { path.push(c); if (seen[c] && k > 0) break; seen[c] = 1; if (r.pond[c] >= 0.02) { stop = true; break; } const d = to[c]; if (d < 0 || g.solid[d]) break; c = d; } void stop;
          if (path.length < 4) continue; let pts = path.map(xy); for (let it = 0; it < 2; it++) { const o2 = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; o2.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } o2.push(pts.at(-1)); pts = o2; }
          const wEnd = Math.min(g.cell * 1.1, 0.25 + 0.22 * Math.log10(1 + acc[path.at(-1)])), wStart = Math.max(0.15, wEnd * 0.35); lines.push({ pts, w: wEnd, w0: wStart, col: '#2b8fe6' });
          let run = 0; for (let i = 1; i < pts.length; i++) { run += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (run > 28 || i === pts.length - 1) { heads.push({ p: pts[i], dir: [pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]], s: Math.max(1.2, wEnd * 3), col: '#1f7fe0' }); run = 0; } } }
        streams = { lines, heads }; }
      // on the building: the water against each facade (from the ground just in front) and the roofs' runoff coefficient
      w.surfaceSamples?.(); const sl = w.surfaceList?.() || [], pondAll = Float32Array.from(r.pond, (v, c) => (g.solid[c] ? NaN : Math.max(0, v || 0))), sPond = sl.length ? fieldAt(g, sl, pondAll) : null, sMap0 = sl.length ? fieldAt(g, sl, map) : null, sMap = sMap0 ? Float32Array.from(sl, (S0, i) => (S0.roof ? 0.4 + 0.33 * cr : !Number.isFinite(sMap0[i]) ? NaN : sMap0[i] < 0.4 ? 0.04 : sMap0[i])) : null, sFlow = sl.length ? fieldAt(g, sl, flow) : null,   /* roofs: all but shed their rain (flow blue); facades: dry, on a flow path or in a pond at their foot */ sCoef = sl.length ? Float32Array.from(sl, (S0) => (S0.roof ? cr : NaN)) : null;
      const wetF = sPond ? Array.from(sPond).filter((v) => v >= 0.02).length : 0, facN = sl.filter((S0) => !S0.roof).length;
      return { ...g, cells: n, avg: r.runV / Math.max(1, r.rainV) * 100, anim, streams, slist: sl, views: {
          map: { vals: map, svals: sMap, unit: 'drainage', ramp: 'storm', lo: 0, hi: 1, dec: 0, avg: 0, title: `Stormwater · where water runs and collects, ${rain} mm`, legendLabels: ['Ponding (deeper is darker)', 'Flow paths', 'High, dry ground'] },
          flow: { vals: flow, svals: sFlow, unit: 'm³ passing (log)', ramp: 'water', lo: 0, hi: Math.max(1, fmax), dec: 0, avg: statsOf(flow).avg, title: `Stormwater · flow paths, ${rain} mm`, legendLabels: [`${fmt(10 ** Math.max(1, fmax) - 1)} m³`, `${fmt(10 ** (Math.max(1, fmax) / 2) - 1)} m³`, '0 m³'] },
          pond: { vals: pond, svals: sPond, unit: 'm deep', ramp: 'water', lo: 0, hi: Math.max(0.1, Math.ceil(dmax * 10) / 10), dec: 2, avg: dmax, title: `Stormwater · ponding, ${rain} mm` },
          runoff: { vals: coef, svals: sCoef, unit: 'runoff coefficient', ramp: 'risk', lo: 0, hi: 1, dec: 1, avg: cg, title: 'Stormwater · runoff coefficient' } },
        rows: [['Runoff', fmt(r.runV) + ' m³ of ' + fmt(r.rainV) + ' m³ of rain'], ...(g.water ? [['Reaches the site’s water', fmt(r.toWater) + ' m³ (' + fmt(r.toWater / Math.max(1e-9, r.runV) * 100) + '% of the runoff)']] : []), ['Ponds 2 cm or deeper', fmt(wet * a2) + ' m²'], ['Deepest ponding', fmt(dmax, 2) + ' m'], ['Water held in hollows', fmt(r.pondV) + ' m³ in ' + big + (big === 1 ? ' hollow' : ' hollows') + (full ? `, ${full} filled to spilling` : '')], ['Design roofs', fmt(roofA) + ' m², runoff ' + cr + (green ? ' (green roof)' : '')], ['Roof peak flow (rational method)', fmt(qRoof, 1) + ' L/s'], ...(facN ? [['Facade with water against it (2 cm or more)', fmt(wetF / facN * 100) + '% of facade squares'], ['Facade on a flow path', fmt(sMap0 ? sl.filter((S0, i) => !S0.roof && sMap0[i] >= 0.4 && sMap0[i] < 0.75).length / facN * 100 : 0) + '% of facade squares']] : []), ['Ground', `${cname.toLowerCase()}, runoff ${cg}`]],
        method: `${rain} mm of rain in 1 hour (a design storm you choose, not local rainfall statistics) on a ${fmt(g.cell, 1)} m grid. Runoff = rain × coefficient (ground ${cg}${drawnA ? `, and on the site's mapped or drawn areas planting 0.25, paving 0.9, water 1 (${fmt(drawnA)} m²)` : ''}, roofs ${cr}${green ? ' with a green roof layer' : ''}, surrounding buildings 0.95); roof water leaves at the building edge.${g.water ? ' The site’s streams, rivers and ponds take the water that reaches them away, like the edge of the area (their own flow is not added).' : ''} Water runs downhill (D8) on the ${g.terrain ? 'terrain' : 'flat ground (this site has no ground levels, so flow paths and ponding are not shown)'}; hollows fill up to their spill level with the water that reaches them. No infiltration over time, drains, pipes or kerbs: a screening of where water goes, not a drainage design. On the building (imported models included): roofs in the flow blue, as they shed nearly all their rain; each facade in the colour of the ground at its foot (sand where it is dry, blue where water runs past or stands against it).`,
        results: { runoff: Math.round(r.runV), rain: Math.round(r.rainV), toWater: Math.round(r.toWater || 0), pondArea: Math.round(wet * a2), pondMax: +dmax.toFixed(2), pondVol: Math.round(r.pondV), roofPeak: +qRoof.toFixed(1) }, settings: { storm: rain, cover: ST.cover, label: `${rain} mm storm (Workspace)` } }; }
    // a field on the ground grid read just in front of each facade square (the nearest open cell within 3 cells); roofs left out
    const facadeField = (m, list, arr) => Float32Array.from(list, (S0) => { if (S0.roof) return NaN; const x = S0.p[0] + S0.n[0] * m.cell * 1.2, y = S0.p[1] + S0.n[1] * m.cell * 1.2, i0 = Math.floor((x - m.X0) / m.cell), j0 = Math.floor((y - m.Y0) / m.cell);
      let best = NaN, bd = Infinity; for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= m.nx || j >= m.ny) continue; const c = j * m.nx + i; if ((m.solid && m.solid[c]) || !Number.isFinite(arr[c])) continue; const d = di * di + dj * dj; if (d < bd) { bd = d; best = arr[c]; } } return best; });
    if (id === 'snow') {
      // the winter wind: hours at or below 0 °C with wind, from the project weather; the most frequent of 16 directions, its mean speed
      const wx = await weather(), E = CL.parseEPW(wx.text), alpha = ({ open: 0.14, suburban: 0.22, city: 0.33 })[S.conditionsOf(p).site.terrain] || 0.22, sec = Array.from({ length: 16 }, () => ({ n: 0, s: 0 })); let cold = 0;
      const hrs = []; for (let k = 0; k < 8760; k++) { if (!(E.T[k] <= 0) || !Number.isFinite(E.WS[k]) || E.WS[k] < 0.5) continue; cold++; hrs.push(k); }
      if (cold < 24) throw Error('The project weather has almost no hours below freezing: snow drifting does not apply at this site.');
      // the drifting wind: the strongest tenth of the below-freezing hours (when snow moves); its most frequent direction and mean speed
      const sp = hrs.map((k) => E.WS[k]).sort((a, b) => a - b), p90 = sp[Math.floor(sp.length * 0.9)]; for (const k of hrs) { if (E.WS[k] < p90) continue; const b = sec[Math.round((((E.WD[k] % 360) + 360) % 360) / 22.5) % 16]; b.n++; b.s += E.WS[k]; }
      const top = sec.reduce((b, x, i) => (x.n > sec[b].n ? i : b), 0), dir = top * 22.5, u10 = sec[top].s / Math.max(1, sec[top].n), U = CL.siteWind(u10, 1.5, alpha), dn = DIR16[top];
      const m = w.groundMask({ maxCells: flowOf() }), a2 = m.cell * m.cell, t = (dir + 180 - m.north) * Math.PI / 180; ST.progress = 'solving the winter wind'; drawStudy(); await new Promise((r) => setTimeout(r, 0));
      const r = speedRatio(m.solid, m.nx, m.ny, [Math.sin(t), Math.cos(t)]), N = m.nx * m.ny, cm = +ST.snowCm, depth = new Float32Array(N).fill(NaN), drift = new Float32Array(N).fill(NaN);
      // drifting: snow moves once the local wind passes about 4 m/s at 1.5 m (fresh dry snow) and settles where the wind slows down
      const k0 = Math.max(0, Math.min(1, (U * 1.3 - 2.5) / 3)); let deep = 0, bare = 0, n = 0, dmax = 0, dsum = 0;
      for (let c = 0; c < N; c++) { if (m.solid[c] || !Number.isFinite(r[c])) continue; n++; const f = 1 + k0 * (Math.max(0.1, Math.min(2.4, 1.65 - 0.85 * r[c])) - 1); drift[c] = f; depth[c] = cm * f; dsum += depth[c]; dmax = Math.max(dmax, depth[c]); if (f > 1.3) deep++; if (f < 0.6) bare++; }
      const rho = cm >= 40 ? 200 : 150, gl = cm / 100 * rho * 9.81 / 1000, roof = 0.8 * gl;   // fresh snow density (kg/m³); a flat roof 0.8 × the ground load (basic roof factor, screening)
      w.surfaceSamples?.(); const sl = w.surfaceList?.() || [], fDepth = facadeField(m, sl, depth), sv = Float32Array.from(sl, (S0, i) => (S0.roof ? cm * 0.8 : fDepth[i])), load = Float32Array.from(depth, (v) => (Number.isFinite(v) ? v / 100 * rho * 9.81 / 1000 : NaN)), svl = Float32Array.from(sv, (v) => (Number.isFinite(v) ? v / 100 * rho * 9.81 / 1000 : NaN));
      const anim = { ux: r.vx.map((v) => v * U), uy: r.vy.map((v) => v * U), lo: 0, hi: Math.max(1, 2 * U), tint: '#ffffff', ramp: 'flow', min: 0.05 * U, speed: 7, life: 5 };
      return { ...m, cells: n, avg: dsum / Math.max(1, n), anim, views: {
          depth: { vals: depth, svals: sv, unit: 'cm of snow', ramp: 'snow', lo: 0, hi: Math.max(cm * 2, Math.ceil(dmax / 10) * 10), dec: 0, avg: dsum / Math.max(1, n), title: `Snow · depth after drifting, ${cm} cm fall` },
          drift: { vals: drift, unit: '× the snowfall', ramp: 'snow', lo: 0, hi: 2.4, dec: 1, avg: 1, title: `Snow · drifting, wind from ${dn}`, legendLabels: ['Drifts (deeper)', 'As it fell', 'Scoured (bare)'] },
          load: { vals: load, svals: svl, unit: 'kPa', ramp: 'snow', lo: 0, hi: Math.max(0.2, Math.ceil(load.reduce((a, v) => (Number.isFinite(v) ? Math.max(a, v) : a), 0) * 10) / 10), dec: 2, avg: gl, title: 'Snow · load on the ground and roofs' } },
        rows: [['Snowfall', `${cm} cm, ${fmt(gl, 2)} kPa on open ground`], ['Drifting wind', `from ${dn}, ${fmt(u10, 1)} m/s at 10 m (the strongest tenth of ${fmt(cold)} hours below 0 °C)`], ['Drifts (30 % deeper or more)', fmt(deep * a2) + ' m²'], ['Scoured (under 60 % of the fall)', fmt(bare * a2) + ' m²'], ['Deepest drift', fmt(dmax) + ' cm'], ['Flat roof snow load (0.8 × ground)', fmt(roof, 2) + ' kPa'], ['Snow against the facades, mean', fmt(statsOf(fDepth).avg) + ' cm']],
        method: `One snowfall of ${cm} cm (density ${rho} kg/m³) is moved by the project weather's drifting wind (${esc(E.station || 'EPW')}: the strongest tenth of the hours at or below 0 °C, from ${dn}, their most frequent direction, ${fmt(u10, 1)} m/s at 10 m, ${fmt(U, 1)} m/s at 1.5 m for ${({ 0.14: 'open', 0.22: 'suburban', 0.33: 'city' })[alpha] || 'suburban'} terrain). A 2D lattice-Boltzmann flow at pedestrian height gives the wind round the design and the ${fmt(m.context)} surrounding buildings; where it slows the snow settles deeper, where it speeds up the ground is scoured (up to 2.4 × or down to 0.1 × the fall), scaled by how often the winter wind is strong enough to move snow. Roofs carry 0.8 × the ground load, a basic flat-roof factor; roof steps, parapets and sliding are not modelled. Screening for early design, not a snow load calculation to a code.`,
        results: { cm, deep: Math.round(deep * a2), bare: Math.round(bare * a2), max: Math.round(dmax), roof: +roof.toFixed(2) }, settings: { snow: cm, dir, label: `${cm} cm snow, wind from ${dn} (Workspace)` } }; }
    if (id === 'wind' && ST.windMode === 'section') return windSection();
    if (id === 'wind') {
      const R0 = await windRose(), alpha = R0.alpha, m = w.groundMask({ maxCells: flowOf() }), a2 = m.cell * m.cell, tn = ({ 0.14: 'open', 0.22: 'suburban', 0.33: 'city' })[alpha] || 'suburban';
      const flowTo = (from) => { const t = (from + 180 - m.north) * Math.PI / 180; return [Math.sin(t), Math.cos(t)]; };
      if (ST.windMode === 'single') {
        const dir = ST.windDir ?? R0.prevailing, u10 = ST.windSpeed ?? R0.sec[Math.round(dir / 22.5) % 16].mean, U = CL.siteWind(u10, 1.5, alpha);
        ST.progress = 'solving the flow'; drawStudy(); await new Promise((r) => setTimeout(r, 0));
        const r = speedRatio(m.solid, m.nx, m.ny, flowTo(dir)); if (ST.cancel) throw Error('Stopped.');
        const N = m.nx * m.ny, speed = new Float32Array(N), ss = []; let shel = 0, fast = 0, n = 0; for (let c = 0; c < N; c++) { speed[c] = r[c] * U; if (!Number.isFinite(r[c])) continue; n++; ss.push(r[c]); if (r[c] < 0.5) shel++; if (r[c] > 1.2) fast++; }
        ss.sort((x, y) => x - y); const p99 = ss[Math.floor(ss.length * 0.99)] || 0, st = statsOf(speed), cps = statsOf(r.cp), dn = DIR16[Math.round(dir / 22.5) % 16];
        w.surfaceSamples?.(); const sl = w.surfaceList?.() || [], fSpeed = facadeField(m, sl, speed), fCp = facadeField(m, sl, r.cp);
        const anim = { ux: r.vx.map((v) => v * U), uy: r.vy.map((v) => v * U), lo: 0, hi: Math.max(1, 2 * U), tint: '#ffffff', ramp: 'flow', min: 0.04 * U, speed: 10 };
        return { ...m, cells: n, avg: st.avg, anim, views: {
            speed: { vals: speed, svals: fSpeed, unit: 'm/s', ramp: 'flow', lo: 0, hi: Math.max(1, 2 * U), dec: 1, avg: st.avg, title: `Wind from ${dn} · speed at 1.5 m` },
            pressure: { vals: r.cp, svals: fCp, unit: 'Cp', ramp: 'flow', lo: -1, hi: 1, dec: 1, avg: cps.avg, title: `Wind from ${dn} · pressure`, legendLabels: ['+1 (pushing)', '0', '−1 (suction)'] } },
          rows: [['Wind', `from ${dn}, ${fmt(u10, 1)} m/s at 10 m`], ...(sl.length ? [['Facades facing the wind (Cp above 0.3)', fmt(Array.from(fCp).filter((v) => v > 0.3).length / Math.max(1, sl.filter((x) => !x.roof).length) * 100) + '%'], ['Highest pressure on a facade', 'Cp ' + fmt(Math.max(...Array.from(fCp).filter(Number.isFinite), 0), 2)]] : []), ['Free stream at 1.5 m', fmt(U, 1) + ' m/s'], ['Mean on the ground', fmt(st.avg, 1) + ' m/s'], ['Sheltered (under half the free stream)', fmt(shel / Math.max(1, n) * 100) + '% of ground'], ['Faster than the free stream by 20 %+', fmt(fast / Math.max(1, n) * 100) + '%'], ['Speed-up, windiest 1 % of ground', fmt(p99, 2) + '×']],
          method: `A 2D lattice-Boltzmann flow at pedestrian height on a ${fmt(m.cell, 1)} m grid for one wind, from ${dn} at ${fmt(u10, 1)} m/s (10 m, weather-station terrain), brought to 1.5 m for ${tn} terrain; buildings (the design and ${fmt(m.context)} surrounding buildings) block the flow. The building's facades (imported models included) show the wind at their foot; roofs are left grey, as the flow is not computed above the ground. A 2D slice: no flow over roofs or down facades, so speed-up in narrow gaps is overstated; screening, not a wind tunnel or 3D CFD study.`,
          results: { dir, u10: +u10.toFixed(1), mean: +st.avg.toFixed(2), sheltered: +(shel / Math.max(1, n) * 100).toFixed(1), peak: +p99.toFixed(2) }, settings: { mode: 'single', dir, speed: u10, label: `Wind from ${dn} (Workspace)` } }; }
      const SEC = 8, sp = R0.sp8, tot = R0.tot, prev = sp.reduce((b, a, i) => (a.length > sp[b].length ? i : b), 0), R = [];
      for (let s = 0; s < SEC; s++) { if (ST.cancel) throw Error('Stopped.'); if (!sp[s].length) { R.push(null); continue; } R.push(speedRatio(m.solid, m.nx, m.ny, flowTo(s * 45))); ST.progress = `${s + 1} of ${SEC} wind directions`; drawStudy(); await new Promise((r) => setTimeout(r, 0)); }
      const above = (arr, x) => { let lo = 0, hi = arr.length; while (lo < hi) { const md = (lo + hi) >> 1; if (arr[md] > x) hi = md; else lo = md + 1; } return arr.length - lo; };
      const share = (c, x) => { let n = 0; for (let s = 0; s < SEC; s++) if (R[s] && R[s][c] > 0) n += above(sp[s], x / R[s][c]); return n / tot; };
      const N = m.nx * m.ny, cls = new Float32Array(N).fill(NaN), ratio = new Float32Array(N).fill(NaN), risk = new Float32Array(N).fill(NaN), peaks = []; let windy = 0, sit = 0, unc = 0, unsafe = 0, n = 0;
      for (let c = 0; c < N; c++) { if (m.solid[c]) continue; let lo = 0, hi = 40; for (let it = 0; it < 24; it++) { const x = (lo + hi) / 2; if (share(c, x) > 0.05) lo = x; else hi = x; } const u95 = hi, k = CL.LAWSON.findIndex(([t]) => u95 <= t), sh = share(c, CL.LAWSON_SAFE.speed);
        cls[c] = k; ratio[c] = R[prev] ? R[prev][c] : NaN; risk[c] = sh * 8760; let pk = 0; for (let s = 0; s < SEC; s++) if (R[s] && R[s][c] > pk) pk = R[s][c]; peaks.push(pk); n++; if (u95 > 6) windy++; if (k <= 1) sit++; if (k === 4) unc++; if (sh > CL.LAWSON_SAFE.share) unsafe++; }
      peaks.sort((x, y) => x - y); const peak = peaks[Math.floor(peaks.length * 0.99)] || 0, names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], rk = statsOf(risk);
      w.surfaceSamples?.(); const slY = w.surfaceList?.() || [], fUp = facadeField(m, slY, ratio), fCls = facadeField(m, slY, cls), fRisk = facadeField(m, slY, risk);   /* on the building: the wind at the foot of each facade */
      const Up = sp[prev].length ? sp[prev].reduce((a, b) => a + b, 0) / sp[prev].length : 2, Rp = R[prev], anim = Rp ? { ux: Rp.vx.map((v) => v * Up), uy: Rp.vy.map((v) => v * Up), lo: 0, hi: Math.max(1, 2 * Up), tint: '#ffffff', ramp: 'flow', min: 0.04 * Up, speed: 10 } : null;
      return { ...m, cells: n, avg: statsOf(cls).avg, anim, views: {
          comfort: { vals: cls, svals: fCls, unit: 'Lawson class', ramp: 'lawson', lo: 0, hi: 4, dec: 0, avg: statsOf(cls).avg, title: 'Wind comfort · Lawson', legendLabels: ['Uncomfortable', 'Standing', 'Frequent sitting'] },
          risk: { vals: risk, svals: fRisk, unit: 'h/yr above 15 m/s', ramp: 'risk', lo: 0, hi: Math.max(4, Math.ceil(rk.hi)), dec: 1, avg: rk.avg, title: 'Wind safety · hours above 15 m/s', legendLabels: [`${fmt(Math.max(4, Math.ceil(rk.hi)))} h or more`, '2 h (Lawson limit)', '0 h'] },
          speedup: { vals: ratio, svals: fUp, unit: '× free stream', ramp: 'flow', lo: 0, hi: 2, dec: 1, avg: statsOf(ratio).avg, title: `Wind speed-up · from ${names[prev]} (prevailing)` } },
        rows: [['Frequent or occasional sitting', fmt(sit / Math.max(1, n) * 100) + '% of ground'], ['Uncomfortable', fmt(unc / Math.max(1, n) * 100) + '%'], ['Windy (above walking comfort)', fmt(windy * a2) + ' m²'], ['Unsafe (15 m/s too often)', fmt(unsafe * a2) + ' m²'], ['Speed-up, windiest 1 % of ground', fmt(peak, 2) + '×'], ['Prevailing wind', `from ${names[prev]}`], ['Weather', esc(R0.station)]],
        method: `A 2D lattice-Boltzmann flow at pedestrian height for ${R.filter(Boolean).length} wind directions on a ${fmt(m.cell, 1)} m grid; buildings (the design and ${fmt(m.context)} surrounding buildings) block the flow. Hourly wind from the project weather (${esc(R0.station || 'EPW')}) at 1.5 m for ${tn} terrain sets each spot's 5 % exceeded speed, rated by the City of London Lawson criteria (2019). The building's facades (imported models included) show the wind at their foot; roofs are left grey, as the flow is not computed above the ground. A 2D slice: no flow over roofs or down facades, so speed-up in narrow gaps is overstated; screening, not a wind tunnel or 3D CFD study.`,
        results: { peak: +peak.toFixed(2), windy: Math.round(windy * a2), sitting: +(sit / Math.max(1, n) * 100).toFixed(1), uncomf: +(unc / Math.max(1, n) * 100).toFixed(1), unsafe: Math.round(unsafe * a2) }, settings: { mode: 'yearly', label: 'Pedestrian wind, the year (Workspace)' } }; }
    throw Error('This study does not run here yet.');
  }
  // ---- series (2026-11-09): one study through the year, a picture each month (the 21st, for a day's study; the month, for a
  // period's) or each season (the solstices and equinoxes; three-month seasons), on one colour scale, then the linked preview
  // where the view is chosen and the sheet exported. The presets are the study's own: only studies with a time of year have them.
  const SEASON_DAYS = [['03-21', '21 March'], ['06-21', '21 June'], ['09-23', '23 September'], ['12-21', '21 December']];
  const SERIES = {
    sunhours: { key: 'day', what: 'direct sun through the day',
      method: (r) => `Ladybug’s Direct Sun Hours method: the Ladybug sun path for each day shown, at the site’s latitude, time zone and true north (Project props), a sun position every ${ST.sunStep} minutes (timestep ${Math.round(60 / ST.sunStep)}) from ${ST.sunH0}:00 to ${ST.sunH1 >= 24 ? '23:' + String(60 - ST.sunStep).padStart(2, '0') : ST.sunH1 + ':00'} local standard time, counted while the sun is up; each ${fmt(r.cell, 1)} m ground cell, tested 0.1 m above the ground, counts the hours its ray to the sun is clear, shaded by the masses, the building, the surrounding buildings and the terrain${r.svals && r.svals.length ? ', and so does each square of the design’s facades and roofs' : ''}. Direct sun only: a screening, not a daylight or rights-to-light assessment.`,
      months: MONTHN.map((n, i) => ({ v: `${String(i + 1).padStart(2, '0')}-21`, label: `21 ${n}` })), seasons: SEASON_DAYS.map(([v, label]) => ({ v, label })),
      monthsNote: 'The 21st of each month', seasonsNote: 'The equinoxes and solstices' },
    radiation: { key: 'period', what: 'sunlight energy over the period, from the project weather',
      method: (r) => `The hourly direct sun and diffuse sky of the project weather over each period, with the same shading; each ${fmt(r.cell, 1)} m ground cell sums the sunlight that reaches it in kWh/m² (direct sun by its height, sky by the share each cell sees; no light reflected from the ground).`,
      months: MONTHN.map((n, i) => ({ v: `m${i + 1}`, label: n })), seasons: [['q-mam', 'March–May'], ['q-jja', 'June–August'], ['q-son', 'September–November'], ['q-djf', 'December–February']].map(([v, label]) => ({ v, label })),
      monthsNote: 'Each month', seasonsNote: 'Three-month seasons' } };
  let SERMOD = null; const seriesUI = () => (SERMOD ||= import('./series-export.js?v=series-20261109-4'));
  async function runSeries(kind, opts = {}) {
    const id = ST.id, def = SERIES[id]; if (!def || ST.busy) return; if (!canUse(id)) { ST.err = 'This study needs PlotCloud Beta access (Pricing).'; drawStudy(); return; }
    if (UI.view !== 'persp') { await goView('persp'); for (let i = 0; i < 60 && !INST.persp.ready; i++) await new Promise((r) => setTimeout(r, 100)); }
    const list = def[kind], keep = ST[def.key], keepRes = ST.res, q = qualOf(), frames = []; syncLevels();
    // the estimate: one run per frame, at this quality
    let estMs = 0; for (const f of list) { ST[def.key] = f.v; const e = estimate(id); estMs += e ? e.ms : 0; } ST[def.key] = keep;
    ST.busy = true; ST.cancel = false; ST.err = ''; ST.t0 = Date.now(); ST.runQ = q; ST.estAtRun = estMs ? { ms: estMs } : null; ST.progress = `${list.length} pictures`; drawStudy(); runBar('start');
    const tick = setInterval(() => runBar('tick'), 1000);
    try { INST.persp.ws.studyArea?.(ST.area); INST.persp.ws.studyCell?.(gridFor(id)); INST.persp.ws.surfaceCell?.(surfOf());
      for (let k = 0; k < list.length; k++) { if (ST.cancel) throw Error('Stopped.'); ST[def.key] = list[k].v; ST.progress = `${list[k].label}: picture ${k + 1} of ${list.length} · ${Math.round(k / list.length * 100)}%`; drawStudy(); runBar('tick'); await new Promise((r) => setTimeout(r, 20));
        const r = await compute(id); addViews(id, r); applyView(r, ST.view[id]); frames.push({ label: list[k].label, v: list[k].v, r }); }
    } catch (e) { ST.err = e.message === 'Stopped.' ? '' : e.message || String(e); }
    clearInterval(tick); ST[def.key] = keep; ST.busy = false; ST.progress = ''; const ok = frames.length === list.length; runBar(ok ? 'done' : ST.err ? 'error' : 'stopped');
    if (keepRes) paintRes(keepRes); else { clearAll(); showArea(); } drawStudy(); if (!ok) return;
    if (opts.preview === false) return { frames, q }; openSeries(id, kind, frames, q); }
  // a series' colour scale, painting and the notes its exports carry (the preview and Generate pictures both use it)
  async function seriesPack(id, kind, frames, q) {
    const def = SERIES[id], w = INST.persp.ws, view = frames[0].r.view, V = (r) => (r.views && r.views[view]) || r;
    // one colour scale for every picture: the lowest and the highest of the series (each month alone would not compare)
    const lo = Math.min(...frames.map((f) => V(f.r).lo)), hi = Math.max(...frames.map((f) => V(f.r).hi)), shi = Math.max(...frames.map((f) => V(f.r).shi ?? V(f.r).hi));
    const keepKey = ST[def.key], paint = (i) => { const f = frames[i]; ST[def.key] = f.v; try { paintRes({ ...f.r, lo, hi, slo: lo, shi: Math.max(hi, shi) }); } finally { ST[def.key] = keepKey; } };   // that day's sun path too
    const site = S.siteOf(p) || {}, c0 = S.conditionsOf(p), r0 = frames[0].r, cols = (V(r0).legendCols) || w.rampColors?.(r0.ramp) || ['#ddd', '#333'];
    const meta = { project: p.name, site: site.label || '', lat: site.lat, lon: site.lon, study: simName(id), what: def.what, basis: def[kind + 'Note'], quality: q.name, grid: `ground ${fmt(r0.cell || 0, 2)} m${r0.surfCell ? ` · building ${fmt(r0.surfCell, 2)} m` : ''}`,
      title: V(r0).title?.replace(/ · .*$/, '') || simName(id), unit: V(r0).unit || r0.unit, lo, hi, dec: V(r0).dec ?? r0.dec ?? 1, cols, labels: V(r0).legendLabels || null, view: view,
      method: def.method ? def.method(r0) : r0.method, version: (p.versions || []).at(-1)?.n ? `v${p.versions.at(-1).n}${dirty() ? ' + unsaved changes' : ''}` : 'unsaved draft', revision: c0.revision, at: new Date(), station: id === 'radiation' ? ((await weather().catch(() => null))?.station || '') : '' };
    const frame = () => { paintRes({ ...frames[0].r, lo, hi, slo: lo, shi: Math.max(hi, shi) }); if (Number.isFinite(r0.X0) && r0.nx) w.fitBox?.({ x0: r0.X0, y0: r0.Y0, x1: r0.X0 + r0.nx * r0.cell, y1: r0.Y0 + r0.ny * r0.cell }, 0, 1.25, false); };   // the view framed on the result
    const item = (pics) => ({ kind: 'series', study: id, title: `${simName(id)} · ${kind === 'months' ? '12 months' : '4 seasons'}`, sub: `${def[kind + 'Note']} · ${q.name}`, pictures: pics, cols: frames.length === 12 ? 4 : 2,
      legend: { lo, hi, unit: meta.unit, dec: meta.dec, stops: meta.labels ? cols.slice().reverse() : cols }, rows: frames.map((f) => [f.label, Number.isFinite(V(f.r).avg ?? f.r.avg) ? `${fmt(V(f.r).avg ?? f.r.avg, meta.dec)} ${meta.unit} on average` : '–']),
      method: meta.method, basis: basisLine(q, r0.cell), objective: objectiveOf(id), inputs: inputsFor(id, r0, q, [['Series', `${def[kind + 'Note']} (${frames.length} figures)`]]), notes: [`One color scale for every figure: ${fmt(lo, meta.dec)} to ${fmt(hi, meta.dec)} ${meta.unit}.`] });
    return { def, meta, paint, frame, item, keepKey, restore: () => { ST[def.key] = keepKey; if (ST.res) paintRes(ST.res); else clearAll(); } }; }
  async function openSeries(id, kind, frames, q) {
    const P = await seriesPack(id, kind, frames, q); P.frame();
    const M = await seriesUI();
    M.openSeriesPreview(app, { frames: frames.map((f) => ({ label: f.label })), cols: frames.length === 12 ? 4 : frames.length === 4 ? 2 : Math.ceil(Math.sqrt(frames.length)), meta: P.meta,
      paint: P.paint, snap: (wd, ht, sc) => INST.persp.ws.snapAt?.(wd, ht, sc), move: (o) => INST.persp.ws.camMove?.(o), onClose: P.restore }); }
  // a series straight into the export list (Generate pictures): framed on the result, each picture at print size from the 3D view
  async function xlAddSeries(id, kind, frames, q) { const P = await seriesPack(id, kind, frames, q), X = await xlMod(); P.frame(); await new Promise((r) => setTimeout(r, 120)); await genCam(id);
    const fr = app.querySelector('#fPersp')?.getBoundingClientRect() || { width: 1200, height: 800 }, sc = 1400 / (Math.max(400, fr.width) * (devicePixelRatio || 1)), pics = [];
    try { for (let i = 0; i < frames.length; i++) { P.paint(i); const c = INST.persp.ws.snapAt?.(fr.width, fr.height, sc); if (c) pics.push({ label: frames[i].label, blob: await X.canvasBlob(c) }); await new Promise((r) => setTimeout(r, 0)); } } finally { P.restore(); }
    if (pics.length === frames.length) await xlAdd(P.item(pics)); return pics.length === frames.length; }
  async function runStudy() {
    if (ST.busy) return; if (!canUse(ST.id)) { ST.err = 'This study needs PlotCloud Beta access (Pricing).'; drawStudy(); return; } syncLevels(); ST.busy = true; ST.cancel = false; ST.err = ''; ST.progress = ''; ST.t0 = Date.now(); ST.areaOpen = false; ST.runQ = qualOf(); ST.estAtRun = INST.persp.ready ? estimate(ST.id) : null; drawStudy(); runBar('start');
    const tick = setInterval(() => { const e = studyCard.querySelector('.sp-elapsed'); if (e) e.textContent = `${Math.round((Date.now() - ST.t0) / 1000)} s elapsed${ST.estAtRun ? ` of ${dur(ST.estAtRun.ms)}` : ''}`; runBar('tick'); }, 1000);
    try { for (let i = 0; i < 80 && !INST.persp.ready; i++) await new Promise((r) => setTimeout(r, 100));
      ST.estAtRun = estimate(ST.id); INST.persp.ws.studyArea?.(ST.area); INST.persp.ws.studyCell?.(gridFor(ST.id)); INST.persp.ws.surfaceCell?.(surfOf()); drawStudy(); await new Promise((r) => setTimeout(r, 30)); const t0 = performance.now(), id = ST.id, r = await compute(id), w = INST.persp.ws;
      if (ST.cancel) throw Error('Stopped.');
      addViews(id, r); applyView(r, ST.view[id]); hookProbe(); paintRes(r, true);
      r.ms = Math.round(performance.now() - t0); ST.res = r; ST.key = studyModel(w); ST.sig = sigOf(id); ST.saved = ''; ST.at = new Date(); logRun(id, r); learn(id, r.ms); }
    catch (e) { ST.res = null; ST.err = e.message === 'Stopped.' ? '' : e.message || String(e); ST.stopped = e.message === 'Stopped.'; }
    clearInterval(tick); ST.busy = false; ST.progress = ''; runBar(ST.res ? 'done' : ST.err ? 'error' : 'stopped'); if (!ST.res) { clearAll(); showArea(); } drawStudy();
  }
  // a result is kept with the saved version it was computed on: unsaved edits are saved as a version first
  async function saveStudy() {
    if (!ST.res || ST.busy) return; ST.busy = true; drawStudy();
    try { if (dirty()) { const before = baseline()?.id; $('#saveV')?.click(); for (let i = 0; i < 100 && baseline()?.id === before; i++) await new Promise((r) => setTimeout(r, 100)); if (baseline()?.id === before) throw Error('The version could not be saved.'); }
      const v = baseline(), r = ST.res; if (!v) throw Error('Save a version first.');
      // the project's shared conditions this result used (2026-11-01), so Results can say when they change afterwards
      const shc = S.clone(S.conditionsOf(p)), sharedConditions = r.settings?.sharedConditions || { revision: shc.revision, signature: S.conditionsSignature(p, ST.id), site: S.clone(shc.site || {}), defaults: S.clone(shc.defaults || {}), studyOnlyOverrides: false, effective: { lat: shc.site?.lat, lon: shc.site?.lon, north: shc.site?.north ?? 0, tz: shc.site?.tz } };
      S.addRun(p, v.id, ST.id, { ...r.settings, sharedConditions, inheritedFrom: 'Project shared conditions', method: 'workspace-ground', cell: r.cell }, { ...r.results, cells: r.cells, computedAt: ST.at.toISOString() }, 'workspace');
      ST.saved = 'v' + v.n; ST.key = studyModel(INST.persp.ws); logRun(ST.id, r, 'v' + v.n); }
    catch (e) { ST.err = e.message; }
    ST.busy = false; drawStudy(); if (!cmp.hidden) drawCompare();
  }
  function download(name, href) { const a = document.createElement('a'); a.href = href; a.download = name; a.click(); }
  function exportCSV() { const r = ST.res; if (!r) return; const lines = r.csv ? r.csv() : ['x_m,y_m,' + (r.unit === '%' ? 'value_percent' : 'value_' + r.unit.replace(/[^a-z0-9]+/gi, '_'))]; if (!r.csv) for (let j = 0; j < r.ny; j++) for (let i = 0; i < r.nx; i++) { const v = r.vals[j * r.nx + i]; if (Number.isFinite(v)) lines.push(`${(r.X0 + (i + 0.5) * r.cell).toFixed(2)},${(r.Y0 + (j + 0.5) * r.cell).toFixed(2)},${(+v).toFixed(3)}`); }
    const u = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })); download(`${p.name.replace(/[^\w-]+/g, '-')}-${ST.id}.csv`, u); setTimeout(() => URL.revokeObjectURL(u), 2000); }
  function exportPNG() { const u = INST.persp.ready ? INST.persp.ws.viewPNG?.() : null; if (u) download(`${p.name.replace(/[^\w-]+/g, '-')}-${ST.id}.png`, u); }
  // the distribution of values on the ground, coloured with the legend's ramp
  function chart(r) { const n = 12, cnt = Array(n).fill(0), span = Math.max(1e-9, r.hi - r.lo); let tot = 0; for (const v of r.vals) if (Number.isFinite(v)) { cnt[Math.min(n - 1, Math.floor((v - r.lo) / span * n))]++; tot++; }
    const mx = Math.max(1, ...cnt), cols = (r.legendCols || INST.persp.ws?.rampColors?.(r.ramp)) || ['#999'], col = (i) => cols[Math.min(cols.length - 1, Math.round(i / (n - 1) * (cols.length - 1)))];
    return `<svg viewBox="0 0 260 150" class="sp-hist" role="img" aria-label="Share of the ground in each band">${cnt.map((c, i) => `<rect x="${8 + i * 20.5}" y="${120 - c / mx * 105}" width="18" height="${c / mx * 105}" fill="${col(i)}"><title>${fmt(r.lo + span * i / n, r.dec)}–${fmt(r.lo + span * (i + 1) / n, r.dec)} ${r.unit}: ${fmt(c / Math.max(1, tot) * 100, 1)}%</title></rect>`).join('')}<line x1="6" y1="120.5" x2="256" y2="120.5" stroke="#d1d5db"/><text x="8" y="136">${fmt(r.lo, r.dec)}</text><text x="252" y="136" text-anchor="end">${fmt(r.hi, r.dec)} ${esc(r.unit)}</text></svg><p class="sp-note">${r.chartNote || 'Share of the ground in each band; hover a bar for its value.'}</p>`; }
  function drawStudy() { syncLevels();
    if (!ST.id) return; const id = ST.id, name = simName(id), r = ST.res, sp = SPEC[id] || {}, stale = r && INST.persp.ready && studyModel(INST.persp.ws) !== ST.key, changed = r && ST.sig !== sigOf(id);
    const status = ST.busy ? ['run', 'Solving'] : ST.err ? ['err', 'Could not run'] : ST.stopped && !r ? ['idle', 'Stopped'] : !r ? ['idle', 'Not run yet'] : stale ? ['stale', 'Model changed'] : changed ? ['stale', 'Settings changed'] : ['ok', `Up to date ${ST.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`];
    const seg = (attr, cur, list) => `<div class="sp-tabs" role="tablist">${list.map(([k, n]) => `<button type="button" role="tab" ${attr}="${k}" aria-selected="${cur === k}">${esc(n)}</button>`).join('')}</div>`;
    const about = typeof sp.about === 'function' ? sp.about() : sp.about || '', views = viewsOf(id), cur = r ? r.view : ST.view[id] || views[0]?.[0], area = AREAS.find((a) => a[0] === ST.area) || AREAS[0];
    const stage = ST.busy ? `<div class="sp-stage run"><h3>Solving…</h3><p class="sp-note">${esc(ST.progress || 'Working on the ground grid')}</p><p class="sp-note sp-elapsed">${Math.round((Date.now() - ST.t0) / 1000)} s elapsed${ST.estAtRun ? ` of ${dur(ST.estAtRun.ms)}` : ''}</p></div>`
      : ST.err ? `<div class="sp-stage"><h3>Could not run</h3><p class="sp-note sp-errtext">${esc(ST.err)}</p></div>`
      : !r ? `<div class="sp-stage"><h3>Click ▶ Start to begin</h3><p class="sp-note">${esc(about)}</p>${sp.noArea ? '' : `<p class="sp-note">Study area: ${esc(area[0] + '×')}${ST.areaInfo ? `, about ${fmt(ST.areaInfo.w)} × ${fmt(ST.areaInfo.h)} m (blue on the site)` : ''}. Change area makes it smaller or larger.</p>`}${sp.noArea ? '' : estLine(estFor())}</div>`
      : `<div class="sp-stage"><div class="sp-head"><span>${esc(r.rows[0][0])}</span><b>${r.rows[0][1]}</b></div>${r.chartHTML ? r.chartHTML() : chart(r)}${stale ? '<p class="sp-note sp-warn">The model changed after this result: Start again to update it.</p>' + estLine(estFor()) : changed ? '<p class="sp-note sp-warn">The settings changed: Start again to update the map.</p>' + estLine(estFor()) : ''}</div>`;
    const hh = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
    const inputs = { day: () => `<p class="sp-flabel">Day</p>${seg('data-st-set', 'day:' + ST.day, DAYS.map(([k, n]) => ['day:' + k, n]))}
        <div class="sp-two"><label class="sp-field">Date<input type="date" data-sun="date" value="2026-${ST.day}" min="2026-01-01" max="2026-12-31"></label>
          <label class="sp-field">Time step<select data-sun="step"><option value="q" ${ST.sunStepHand ? '' : 'selected'}>${qualOf().sun} min (${qualOf().name})</option>${[[5, '5 min'], [10, '10 min'], [15, '15 min'], [30, '30 min'], [60, '1 h']].map(([v, n]) => `<option value="${v}" ${ST.sunStepHand && +ST.sunStep === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="sp-field">From<input type="time" data-sun="h0" value="${hh(ST.sunH0)}" step="900"></label><label class="sp-field">Until<input type="time" data-sun="h1" value="${hh(Math.min(23.99, ST.sunH1))}" step="900"></label></div>
        <p class="sp-note">${ST.sunH0 <= 0 && ST.sunH1 >= 24 ? 'The whole day, sunrise to sunset.' : `Sun counted from ${hh(ST.sunH0)} to ${hh(ST.sunH1)} (local standard time).`} Grid: ${gridOf() ? gridOf() + ' m' : 'automatic'} (Project props › Default).</p>`,
      structure: () => `<p class="sp-flabel">Structure</p>${seg('data-st-set', 'system:' + systemOf(), SYSTEMS.map(([k, n]) => ['system:' + k, n]))}<p class="sp-flabel">Column grid, about</p>${seg('data-st-set', 'span:' + ST.span, [['6', '6 m'], ['7.5', '7.5 m'], ['9', '9 m']].map(([k, n]) => ['span:' + k, n]))}<p class="sp-flabel">Soil bearing (assumed until a geotechnical report)</p>${seg('data-st-set', 'bearing:' + ST.bearing, [['100', '100 kPa'], ['150', '150 kPa'], ['300', '300 kPa']].map(([k, n]) => ['bearing:' + k, n]))}<p class="sp-note"><a href="#" data-st="page">Detailed frame check, member by member</a></p>`,
      dl: () => { let sc = null, pl = {}; try { sc = INST.persp.ws.planScene?.('daylight'); } catch { } const lab = sc?.name?.split(' · ').pop() || 'this level', tf = (s0) => (s0 < 90 ? `~${Math.max(1, Math.round(s0))} s` : `~${Math.round(s0 / 60)} min`), D0 = S.conditionsOf(p).defaults || {};
        if (sc && sc.walls?.length) for (const k of [ST.dlLevel]) { try { pl[k] = DAY.plan(sc, { level: k }); } catch { } }
        const q = pl[ST.dlLevel], num = (k, n, u, min, max, st) => `<label class="sp-field">${n}<span class="sp-num"><input type="number" data-dl="${k}" min="${min}" max="${max}" step="${st}" value="${ST[k]}"><i>${u}</i></span></label>`;
        return `
          ${q ? `<p class="sp-note sp-est"><b>${esc(qualOf().name)} · estimated time: ${tf(q.est)}</b> · a spot every ${Math.round(q.sp * 100)} cm, about ${fmt(q.n)} spots, ${q.nb} sky directions each, a year of hours. On ${esc(lab)}. The estimate learns this computer's speed; the quality is set above Add simulation.</p>` : ''}
          <div class="sp-two">${num('dlTau', 'Glass light transmission', '', 0.1, 0.95, 0.05)}${num('dlHead', 'Window head', 'm', 1.5, 6, 0.05)}${num('dlRf', 'Floor reflects', '', 0.05, 0.9, 0.05)}${num('dlRw', 'Walls reflect', '', 0.05, 0.95, 0.05)}${num('dlRc', 'Ceiling reflects', '', 0.05, 0.95, 0.05)}</div>
          <p class="sp-note">Weather: the project weather (Project props). Occupied ${Number.isFinite(+D0.occStart) ? D0.occStart : 8}:00 to ${Number.isFinite(+D0.occEnd) ? D0.occEnd : 18}:00 (Project props). Work plane ${Number.isFinite(+D0.plane) ? D0.plane : 0.8} m (Project props). sDA300/50%: daylit when 300 lux or more for half the occupied hours; ASE1000/250 h: direct sun of 1,000 lux for more than 250 hours. A screening as LEED v4.1 Daylight describes, not a certified simulation.</p>`; },
      cam: () => { const L = CAMS.LEVELS, num = (k, n, u, min, max, st) => `<label class="sp-field">${n}<span class="sp-num"><input type="number" data-cam="${k}" min="${min}" max="${max}" step="${st}" value="${ST[k]}"><i>${u}</i></span></label>`;
        return `${ST.camMode === 'budget' ? `<div class="sp-two">${num('camN', 'Number of cameras', '', 1, 30, 1)}<span></span></div>` : `<label class="sp-field">Cover at least<select class="sp-sel" data-cam="camWant">${[['1', '100% of the floor'], ['0.99', '99%'], ['0.95', '95%'], ['0.9', '90%']].map(([v, n]) => `<option value="${v}" ${ST.camWant === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`}
          <label class="sp-field">Detail needed (DORI, IEC 62676-4)<select class="sp-sel" data-cam="camLevel">${Object.entries(L).map(([k, l]) => `<option value="${k}" ${ST.camLevel === k ? 'selected' : ''}>${l.name} · ${l.ppm} px/m · ${esc(l.note)}</option>`).join('')}</select></label>
          <div class="sp-two">${num('camH', 'Camera height', 'm', 2, 6, 0.1)}<span></span></div>
          <p class="sp-flabel">Watch at</p>${seg('data-st-set', 'camTgt:' + ST.camTgt, [['camTgt:0', 'Floor'], ['camTgt:1', 'Body 1.0 m'], ['camTgt:1.6', 'Face 1.6 m']])}
          <p class="sp-flabel">Camera types to use</p>${CAMS.TYPES.map((T) => `<label class="sp-check"><input type="checkbox" data-camtype="${T.k}" ${ST.camTypes[T.k] ? 'checked' : ''}> ${esc(T.name)} · ${T.fov}° · ${fmt(T.px)} px · $${fmt(T.price, 2)}</label>`).join('')}
          <p class="sp-note">Candidate positions 0.15–0.35 m inside the walls every 0.8 m (dome and bullet, 16 directions) and on a 1.25 m ceiling grid (fisheye). Each camera reaches as far as it still gives the pixels per metre of the chosen detail at the watched height; walls and anything taller than the sight line block it. Prices are examples.</p>`; },
      vw: () => { let sc = null, pl = {}; try { sc = INST.persp.ws.planScene?.('views'); } catch { } const lab = sc?.name?.split(' · ').pop() || 'this level', tf = (s0) => (s0 < 90 ? `~${Math.max(1, Math.round(s0))} s` : `~${Math.round(s0 / 60)} min`);
        if (sc && sc.walls?.length) for (const k of [ST.vwLevel]) { try { pl[k] = VWS.plan(sc, { level: k, eye: +ST.vwEye, head: ST.vwHead, far: ST.vwFar, nature: ST.vwNature, motion: ST.vwMotion }); } catch { } }
        const q = pl[ST.vwLevel], num = (k, n, u, min, max, st) => `<label class="sp-field">${n}<span class="sp-num"><input type="number" data-vw="${k}" min="${min}" max="${max}" step="${st}" value="${ST[k]}"><i>${u}</i></span></label>`;
        return `
          ${q ? `<p class="sp-note sp-est"><b>${esc(qualOf().name)} · estimated time: ${tf(q.est)}</b> · a spot every ${Math.round(q.sp * 100)} cm, about ${fmt(q.n)} spots, ${q.nr} sight lines each. On ${esc(lab)}. The estimate learns this computer's speed; the quality is set above Add simulation.</p>` : ''}
          <div class="sp-two">${num('vwHead', 'Window head height', 'm', 1.5, 6, 0.05)}${num('vwFar', '"Far" objects from', 'm', 2, 50, 0.5)}</div>
          <label class="sp-check"><input type="checkbox" data-vw="vwNature" ${ST.vwNature ? 'checked' : ''}> Planting, water or animals in view outside (counts as nature)</label>
          <label class="sp-check"><input type="checkbox" data-vw="vwMotion" ${ST.vwMotion ? 'checked' : ''}> A street or path with people outside (counts as movement)</label>
          <p class="sp-note">Horizontal sight lines from spots over the occupied floor; walls 2 m or taller and anything as high as the eye stop them, vision glazing lets them out above its sill. LEED v4.1 Quality Views needs 75% of the floor with a view out and 75% with quality views; a screening, not a LEED review.</p>`; },
      iso: () => { const v = ST.isoView;
        return `<p class="sp-flabel">Look for</p>${seg('data-st-set', 'isoTgt:' + ST.isoTgt, [['isoTgt:0', 'Floor 0 m'], ['isoTgt:0.6', 'Seated child 0.6 m'], ['isoTgt:1.0', 'Standing child 1.0 m']])}
          <p class="sp-flabel">Viewpoint</p><div class="sp-acts sp-acts1"><button type="button" class="btn sm${ST.isoPick ? ' primary' : ''}" data-iso="pick">${ST.isoPick ? 'Click the floor in the view…' : v ? 'Move the viewpoint' : 'Place the viewpoint'}</button></div>
          <p class="sp-note">${v ? `At ${fmt(v[0], 1)}, ${fmt(v[1], 1)} m on this level.` : 'Not placed yet: Start puts it in the middle of the largest room.'} Stairs on this level count as hazards (seen when the eye sees their floor).</p>
          <p class="sp-note">720 sight lines from the eye: anything taller than the eye stops them; lower furniture hides the floor behind it down to where the line over its top comes back to the height looked for. The room is the floor closed by walls 2 m or taller and glazing.</p>`; },
      ss: () => { let sc = null, pl = {}; try { sc = INST.persp.ws.planScene?.('spacesyntax'); } catch { } const lab = sc?.name?.split(' · ').pop() || 'this level';
        const tf = (s0) => (s0 < 90 ? `~${Math.max(1, Math.round(s0))} s` : `~${Math.round(s0 / 60)} min`);
        if (sc && sc.walls?.length) for (const k of [ST.ssLevel]) { try { pl[k] = SSX.plan(sc, { level: k, vh: +ST.ssVh, glass: ST.ssGlass }); } catch { } }
        return `
          ${pl[ST.ssLevel] ? `<p class="sp-note sp-est"><b>${esc(qualOf().name)} · estimated time: ${tf(pl[ST.ssLevel].est)}</b> · a node every ${Math.round(pl[ST.ssLevel].sp * 100)} cm, about ${fmt(pl[ST.ssLevel].n)} nodes, ${pl[ST.ssLevel].nr} sight lines from each. On ${esc(lab)}. The estimate learns this computer's speed; the quality is set above Add simulation.</p>` : ''}
          <label class="sp-check"><input type="checkbox" data-ss="glass" ${ST.ssGlass ? 'checked' : ''}> Windows and glass partitions are seen through</label>
          <p class="sp-note">Nodes on a grid over the floor are joined where they see each other at the analysis height (eye 1.6 m: furniture below it is seen over; knee 0.5 m: furniture blocks, as for walking). Integration [HH] from mean visual depth; 200 agents walk 1,500 steps towards spots in their 170° view (gate counts). As DepthmapX; a design check, not a measure of use.</p>`; },
      watersound: () => { const WB = (INST.persp.ready ? INST.persp.ws.waters?.() : null) || []; return `<p class="sp-flabel">The site’s water</p>${WB.length ? `<div class="sp-places">${WB.map((b) => `<button type="button" class="sp-place" data-wsopen="${esc(b.id)}"><i style="background:#2c6fa3">≈</i><span>${esc(b.name)}</span><small>${b.type === 'stream' ? `${fmt(b.discharge, 2)} m³/s${b.falls.length ? `, falls ${b.falls.map((f) => fmt(f.drop, 1) + ' m').join(', ')}` : ''}` : 'still'}</small></button>`).join('')}</div>` : '<p class="sp-note">No water on the site yet: draw a water area (Site › Water) or map one.</p>'}<p class="sp-note">Click a body of water to set its flow, speed and level (Project data › Site). The loudness of falls varies a lot with their shape: choose Gentle, Typical or Loud above.</p>`; },
      egress: () => { const f = ST.egFire, fireChips = `<p class="sp-flabel">Where the fire starts</p><div class="sp-chips sp-chips-in"><button type="button" data-eg="random" aria-pressed="${!f}">Random each run</button><button type="button" data-eg="pick" aria-pressed="${!!f || ST.egPick}">${ST.egPick ? 'Click a room in the view…' : f ? esc(f.name || 'Chosen room') : 'Click a room'}</button></div>`,
          runsSeed = `<div class="sp-two"><label class="sp-field">Runs<select data-eg="runs">${[10, 20, 50, 100].map((v) => `<option value="${v}" ${+ST.egRuns === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="sp-field">Seed<input type="number" data-eg="seed" min="1" step="1" value="${ST.egSeed}"></label></div>`;
        if (ST.egStrat === 'all') { const U0 = EGX.USES[ST.egUse] || EGX.USES.office;
          return `<p class="sp-flabel">Building use</p><select class="sp-sel" data-eg="use">${Object.entries(EGX.USES).map(([k, u]) => `<option value="${k}" ${ST.egUse === k ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>
          <p class="sp-flabel">Detection and alarm</p><select class="sp-sel" data-eg="detect">${[['30', '30 s · smoke detection, voice alarm'], ['60', '60 s · automatic detection and alarm'], ['120', '2 min · heat detection'], ['180', '3 min · someone finds it and raises the alarm']].map(([v, n]) => `<option value="${v}" ${ST.egDetect === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
          ${fireChips}${runsSeed}
          <p class="sp-note">People: by room name and area, after the occupant load factors of IBC 2021 Table 1004.5 (offices 1 per 13.9 m², classrooms 1.9, meeting and dining 1.4, shops 5.6, homes and hotel rooms 18.6, storage 27.9; corridors, stairs and toilets none); 4 % walk slowly. Pre-movement after the alarm: ${U0.p1} s for the first and ${U0.p99 < 120 ? U0.p99 + ' s' : U0.p99 / 60 + ' min'} for the 99th percentile (${esc(U0.name.toLowerCase())}, after PD 7974-6:2019); the people in the room of fire origin set off within 10 to 30 s. Ways out: the outside doors of the lowest level with one, by the model's stairs.</p>
          <p class="sp-note">Walking 1.19 m/s on average, slower in a crowd; doors 1.32 people per second per metre of width and stairs 1.1 (SFPE Handbook). Evacuation time (RSET) = detection and alarm + pre-movement + travel and queueing. A screening of evacuation time: no fire or smoke is computed (no ASET), and it is not a code compliance check.</p>`; }
        return `<p class="sp-flabel">Staff on duty</p>${seg('data-st-set', 'egRatio:' + ST.egRatio, [['egRatio:4', 'Day · 1 to 4 patients'], ['egRatio:8', 'Night · 1 to 8']])}
          <p class="sp-flabel">Patients</p><select class="sp-sel" data-eg="mix">${EG_MIX.map(([k, n]) => `<option value="${k}" ${ST.egMix === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
          <p class="sp-flabel">Where the fire starts</p><div class="sp-chips sp-chips-in"><button type="button" data-eg="random" aria-pressed="${!f}">Random each run</button><button type="button" data-eg="pick" aria-pressed="${!!f || ST.egPick}">${ST.egPick ? 'Click a room in the view…' : f ? esc(f.name || 'Chosen room') : 'Click a room'}</button></div>
          <div class="sp-two"><label class="sp-field">Runs<select data-eg="runs">${[10, 20, 50, 100].map((v) => `<option value="${v}" ${+ST.egRuns === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="sp-field">Seed<input type="number" data-eg="seed" min="1" step="1" value="${ST.egSeed}"></label></div>
          <p class="sp-note">Patients: one per bed in rooms named ward, patient room, bed bay, ICU or recovery (about one per 12 m² where no beds are placed); staff start at the nurse station. Smoke compartments: at doors 0.95 m or wider across a corridor. Stairs: the model's stairs between levels. Exit: an outside door on the lowest level with one.</p>
          <p class="sp-note">Context: the National Building Code of Canada 2020 (care and treatment occupancies) and CSA Z8000-18 plan for patients to be moved horizontally into the next zone on the same floor first, and down the stairs only if needed. Walking, door and stair flows from the SFPE Handbook; mobility shares, reaction times (median 90 s for patients, 30 s for staff) and staffing are assumptions. A screening of evacuation time: no fire or smoke is computed, and it is not a code compliance check.</p>`; },
      wayfinding: () => { let sc = null; try { sc = INST.persp.ws.planScene?.('wayfinding'); } catch { } const S0 = sc ? WAY.startsOf(sc) : [];
        return `<p class="sp-flabel">Start (${esc(sc?.name?.split(' · ').pop() || 'this level')}, change the level in the Level menu)</p>${S0.length ? `<select class="sp-sel" data-way="start">${S0.map((x) => `<option value="${esc(x.id)}" ${x.id === ST.wayStart ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : '<p class="sp-note">No rooms on this level yet.</p>'}
          <label class="sp-check"><input type="checkbox" data-way="furn" ${ST.wayFurn ? 'checked' : ''}> Furniture is in the way when walking</label>
          <p class="sp-note">Furniture taller than the eye blocks the view; lower pieces are seen over. Doors count as open passages. Corridors, halls, lobbies, landings and stairs are walked through, not destinations.</p>`; },
      privacy: () => { const P = ST.priv, side = (k, n) => `<button type="button" data-priv-side="${k}" aria-pressed="${P.sides.includes(k)}">${n}</button>`, num = (k, n, u, min, max, st) => `<label class="sp-field">${n}<span class="sp-num"><input type="number" data-priv="${k}" min="${min}" max="${max}" step="${st}" value="${P[k]}"> ${u}</span></label>`;
        let sc = null; try { sc = INST.persp.ws.planScene?.('privacy'); } catch { } const rooms = sc?.rooms || [], proj = sc?.source?.project || 'sample', nd = PKEEP.get('privacy:' + proj, {});
        return `<p class="sp-flabel">Street on these sides of the plan</p><div class="sp-chips sp-chips-in">${side('top', 'Top')}${side('right', 'Right')}${side('bottom', 'Bottom')}${side('left', 'Left')}</div>
          <div class="sp-two">${num('dS', 'Street from the wall', 'm', 1, 40, 0.5)}${num('eye', 'Passer-by eye', 'm', 0.5, 3, 0.1)}${num('dO', 'Building opposite at', 'm', 0, 80, 1)}${num('hO', 'Its windows up to', 'm', 0, 60, 1)}</div>
          <label class="sp-check"><input type="checkbox" data-priv="doors" ${P.doors ? 'checked' : ''}> Interior doors are open</label>
          ${rooms.length ? `<p class="sp-flabel">Privacy need of each room</p><div class="sp-places">${rooms.map((r) => { const v = nd[r.name] || ''; return `<label class="sp-place"><i style="background:#d8402a">${esc(r.name.slice(0, 1))}</i><span>${esc(r.name)}</span><select data-privneed="${esc(r.name)}"><option value="" ${!v ? 'selected' : ''}>From the name</option>${Object.entries(PRIV.NEEDT).map(([k, n]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`; }).join('')}</div>` : '<p class="sp-note">No rooms on this level yet.</p>'}
          <p class="sp-note">People walk along the street at eye height and look out of the building opposite at every storey (3 m apart). Furniture taller than the line of sight blocks it.</p>`; },
      places: () => { const pl = levelPlanNow(), P = placesOf(pl); if (!pl) return '<p class="sp-note">The model is still loading.</p>';
        return `<p class="sp-flabel">${esc(pl.level)} (change the level in the Level menu, top left) · ${P.length} rooms as places</p>${P.length ? `<div class="sp-places">${P.map((q) => `<label class="sp-place"><i>${q.letter}</i><span>${esc(q.name)}</span><select data-circuse="${esc(q.name)}">${USES.map(([v, n]) => `<option value="${v}" ${Math.abs(+v - q.use) < 0.01 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`).join('')}</div><p class="sp-note">How often each room is used weights the walks between it and the others (corridors are routes, not places).</p>` : '<p class="sp-note">No rooms on this level yet: draw walls round the rooms (Draw room), with doors between them.</p>'}`; },
      snow: () => `<p class="sp-note">Winter-wind drift screening · <a href="#/simulations/snow?mode=vertical" data-st="uniform-snow">Uniform snowfall quantities →</a></p><p class="sp-flabel">Snowfall (one event, before drifting)</p>${seg('data-st-set', 'snowCm:' + ST.snowCm, SNOWS.map(([k, n]) => ['snowCm:' + k, n]))}<p class="sp-note">The wind is the project weather's drifting wind: the strongest tenth of the hours at or below 0 °C, from their most frequent direction.</p>`,
      storm: () => `<p class="sp-flabel">Design storm, falling in 1 hour (your choice, not local rainfall statistics)</p>${seg('data-st-set', 'storm:' + ST.storm, STORMS.map(([k, n]) => ['storm:' + k, n]))}<p class="sp-flabel">Ground away from buildings</p>${seg('data-st-set', 'cover:' + ST.cover, COVERS.map(([k, n]) => ['cover:' + k, n]))}`,
      period: () => `<p class="sp-flabel">Period</p>${seg('data-st-set', 'period:' + ST.period, PERIODS.map(([k, n]) => ['period:' + k, n.split(' · ')[0]]))}`,
      envelope: () => `<p class="sp-flabel">Protected sun</p><div class="sp-optlist">${ENVELOPES.map(([k, n]) => `<button type="button" data-st-set="envelope:${k}" aria-pressed="${ST.envelope === k}">${esc(n)}</button>`).join('')}</div>`,
      vent: () => { const R = ST.rose, one = ST.vnMode !== 'year', dir = ST.windDir ?? R?.prevailing ?? 225, i = Math.round(dir / 22.5) % 16, spd = ST.windSpeed ?? (R ? R.sec[i].mean : 3.5);
        const wind = !one ? `<p class="sp-flabel">Windows open when it is ${ST.vnLo}–${ST.vnHi} °C outside</p><div class="sp-two"><label class="sp-field">From °C<input type="number" data-st-num="vnLo" min="0" max="30" step="1" value="${ST.vnLo}"></label><label class="sp-field">Until °C<input type="number" data-st-num="vnHi" min="10" max="40" step="1" value="${ST.vnHi}"></label></div><p class="sp-note">Every such hour of the project weather, with its own wind and temperature${R ? ` (${esc(R.station)})` : ''}.</p>`
          : ST.roseErr ? `<p class="sp-note sp-errtext">${esc(ST.roseErr)}</p><p class="sp-note">Without the project weather the wind is 3.5 m/s from the south-west.</p>` : !R ? '<p class="sp-note">Reading the wind of the project weather…</p>'
          : `<p class="sp-flabel">Click the rose to choose the wind direction</p>${roseSVG(R, true)}<label class="sp-spdrow"><span>From ${DIR16[i]} · <span class="sp-spd">${fmt(spd, 1)}</span> m/s at 10 m</span><input type="range" min="0.5" max="12" step="0.5" value="${(+spd).toFixed(1)}" data-st="windSpeed"></label>`;
        return `${wind}${one ? `<div class="sp-two"><label class="sp-field">Outside °C<input type="number" data-st-num="vnTout" min="-10" max="40" step="1" value="${ST.vnTout}"></label><label class="sp-field">Inside °C<input type="number" data-st-num="vnTin" min="10" max="35" step="1" value="${ST.vnTin}"></label></div>` : `<label class="sp-field">Inside °C (at least 1 °C above outside)<input type="number" data-st-num="vnTin" min="10" max="35" step="1" value="${ST.vnTin}"></label>`}
          <p class="sp-flabel">Windows</p>${seg('data-st-set', 'vnWin:' + ST.vnWin, [['vnWin:2', 'Wide open'], ['vnWin:1', 'As drawn'], ['vnWin:0.5', 'Ajar']])}
          <p class="sp-flabel">Doors</p>${seg('data-st-set', 'vnDoors:' + ST.vnDoors, [['vnDoors:open', 'All open'], ['vnDoors:inside', 'Inside open, outside shut'], ['vnDoors:shut', 'All shut']])}
          <p class="sp-flabel">Target</p>${seg('data-st-set', 'vnTarget:' + ST.vnTarget, [['vnTarget:2', '2 ach'], ['vnTarget:5', '5 ach'], ['vnTarget:10', '10 ach (cooling)']])}
          <p class="sp-note">Each window opens by its own share (Plan Studio › the window › Opening; half the window where it is not set); “Wide open” doubles that, up to the whole window. A shut door leaves a 1 cm gap. The whole building: air rises through stairs and floor voids between levels.</p>
          <p class="sp-note"><a href="#/simulations/vent?detail=1">Air speed inside the rooms of one level (the detailed page) →</a></p>`; },
      acu: () => { let sc = null; try { sc = INST.persp.ws.planScene?.('acoustics'); } catch { } const n = (sc?.rooms || []).length, set = (sc?.rooms || []).reduce((a, r) => a + r.surf.filter((q) => q.mat && q.kind !== 'door' && q.kind !== 'opening').length, 0), all = (sc?.rooms || []).reduce((a, r) => a + r.surf.filter((q) => q.kind !== 'door' && q.kind !== 'opening').length, 0);
        return `<p class="sp-flabel">${esc(sc?.name?.split(' · ').pop() || 'This level')} (change the level in the Level menu) · ${n} room${n === 1 ? '' : 's'}, finishes set on ${set} of ${all} surfaces</p>
          <p class="sp-flabel">Target for every room</p><select class="sp-sel" data-st-sel="acTarget">${[['auto', 'By the room’s name'], ['A3', 'Teaching, meetings (DIN 18041 A3)'], ['A4', 'Inclusive teaching (DIN 18041 A4)'], ['A2', 'Talks, presentations (DIN 18041 A2)'], ['A1', 'Music (DIN 18041 A1)'], ['home', 'Home and office (0.4–0.6 s, rule of thumb)']].map(([k, t]) => `<option value="${k}" ${ST.acTarget === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
          <p class="sp-flabel">People in each room</p><select class="sp-sel" data-st-sel="acPeople">${[['0', 'None (finished, unoccupied)'], ['10', '1 per 10 m² (home, office)'], ['5', '1 per 5 m² (meeting room)'], ['2', '1 per 2 m² (classroom, hall)']].map(([k, t]) => `<option value="${k}" ${ST.acPeople === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
          <div class="sp-two"><label class="sp-field">Air °C<input type="number" data-st-num="acTemp" min="0" max="35" step="1" value="${ST.acTemp}"></label><label class="sp-field">Humidity %<input type="number" data-st-num="acRh" min="10" max="95" step="5" value="${ST.acRh}"></label></div>
          <p class="sp-note">The finishes come from Plan Studio (select a wall, floor, level ceiling or window › Finish); unset surfaces are taken as plaster walls and ceilings, a timber floor and double glazing. Upholstered furniture and people absorb too.</p>`; },
      rose: () => { if (ST.roseErr) return `<p class="sp-note sp-errtext">${esc(ST.roseErr)}</p>`; if (!ST.rose) return '<p class="sp-note">Reading the wind of the project weather…</p>'; const R = ST.rose, single = ST.windMode !== 'yearly', dir = ST.windDir ?? R.prevailing, i = Math.round(dir / 22.5) % 16, spd = ST.windSpeed ?? R.sec[i].mean;
        return `<p class="sp-flabel">${single ? 'Click the rose to choose the wind direction' : 'The year’s wind by direction, from the project weather'}</p>${roseSVG(R, single)}${single ? `<label class="sp-spdrow"><span>From ${DIR16[i]} · <span class="sp-spd">${fmt(spd, 1)}</span> m/s at 10 m</span><input type="range" min="0.5" max="20" step="0.5" value="${(+spd).toFixed(1)}" data-st="windSpeed"></label>` : `<p class="sp-note">Prevailing from ${DIR16[Math.round(R.prevailing / 22.5) % 16]}; calm ${fmt(R.calm * 100)}% of hours. ${esc(R.station)}</p>`}`; } };
    studyCard.innerHTML = `<header><b>${esc(name)}</b><span class="sp-pill" data-state="${status[0]}">${esc(status[1])}</span><span class="sp-hbtns"><button type="button" class="sp-ib" data-st="exp" aria-expanded="${ST.exp}" title="Export">⤓</button><button type="button" class="sp-x" data-st="close" aria-label="Close ${esc(name)}">×</button></span></header>
      ${ST.exp ? `<div class="sp-exp"><button type="button" class="btn sm" data-st="csv" ${r ? '' : 'disabled'}>Ground values (CSV)</button><button type="button" class="btn sm" data-st="png" ${r ? '' : 'disabled'}>View (PNG)</button>${r ? '' : '<p class="sp-note">Run the study first.</p>'}${SERIES[id] ? `<p class="sp-flabel">Series: one picture each, on one colour scale</p><button type="button" class="btn sm" data-st="ser-months" ${ST.busy ? 'disabled' : ''} title="${esc(SERIES[id].monthsNote)}">12 months</button><button type="button" class="btn sm" data-st="ser-seasons" ${ST.busy ? 'disabled' : ''} title="${esc(SERIES[id].seasonsNote)}">4 seasons</button><p class="sp-note">${esc(SERIES[id].monthsNote)}, or ${esc(SERIES[id].seasonsNote.toLowerCase())}; at ${esc(qualOf().name)} quality, about ${dur((estimate(id)?.ms || 0) * 12)} for 12. Then choose the view and export the sheet.</p>` : ''}</div>` : ''}
      ${sp.mode ? seg('data-st-mode', ST[sp.mode[0]], sp.mode[1]) : ''}${stage}
      ${views.length > 1 ? `<div class="sp-chips" role="group" aria-label="Map shows">${views.map(([k, n]) => `<button type="button" data-st-view="${k}" aria-pressed="${cur === k}">${esc(n)}</button>`).join('')}</div>` : ''}
      ${r && id === 'fire-evacuation' ? `<div class="sp-acts sp-acts1 sp-egplay"><button type="button" class="btn sm" data-eg="play">${ST.egPlay ? '❚❚ Pause' : '▶ Play'}</button><input type="range" data-eg="seek" min="0" max="${r.nFrames || 1}" step="1" value="${Math.round(ST.egT || 0)}" aria-label="Time in the run shown"><span class="sp-egt sp-note"></span></div><div class="sp-chips" role="group" aria-label="Playback speed">${[[10, '×10'], [30, '×30'], [60, '×60']].map(([v, n]) => `<button type="button" data-eg="speed" data-v="${v}" aria-pressed="${ST.egSpeed === v}">${n}</button>`).join('')}</div>` : ''}
      ${r && id === 'evac' && r.view === 'walks' ? `<div class="sp-acts sp-acts1"><button type="button" class="btn sm" data-st="anim">↺ Replay the walks</button></div>` : ''}${r && (r.anim || id === 'sunhours') ? `<div class="sp-acts sp-acts1">${r.anim ? `<button type="button" class="btn sm" data-st="anim">${animOn() ? '❚❚ Pause the flow' : '▶ Show the flow'}</button>` : `<button type="button" class="btn sm" data-st="play">${PLAY.t ? '❚❚ Stop' : '▶ Play the day'} <span class="sp-playh"></span></button>`}</div>` : ''}<div class="sp-acts">${ST.busy ? '<button type="button" class="btn sm" data-st="stop">Stop</button>' : `<button type="button" class="btn sm primary" data-st="run">▶ ${r ? 'Start again' : 'Start'}</button>`}${sp.noArea ? '' : `<button type="button" class="btn sm" data-st="area" aria-expanded="${ST.areaOpen}" ${ST.busy ? 'disabled' : ''}>Change area</button>`}</div>
      ${ST.areaOpen ? `<div class="sp-optlist">${AREAS.map(([k, n]) => `<button type="button" data-st-area="${k}" aria-pressed="${ST.area === k}">${esc(n)}</button>`).join('')}</div>` : ''}
      <div class="sp-foot">${sp.input ? inputs[sp.input]() : ''}${sp.building ? '' : `<p class="sp-note">Location, time zone, true north${['radiation', 'shadebenefit', 'utci', 'wind', 'snow'].includes(id) ? ' and weather' : ''} come from Project props. ${id === 'wind' || id === 'snow' ? 'Wind is blocked by' : 'Shade from'} the masses, the building and the surrounding buildings, on the terrain.</p>`}</div>`;
    resCard.hidden = !r; legend.hidden = !r;
    if (r) { resCard.innerHTML = `<header><b>${esc(r.title)}</b></header><div class="sp-stbody">${r.rows.map(([k, v]) => `<div class="sp-kv"><span>${k}</span><b>${v}</b></div>`).join('')}
        <h4>How this was found</h4><p class="sp-note">${r.method} ${r.foot || `${fmt(r.cells)} cells, ${fmt(r.prisms)} building parts and ${fmt(r.context)} surrounding buildings${r.terrain ? ', on the terrain' : ''}`}; ${fmt(r.ms)} ms in this browser. A design check for early design, not a compliance result.</p>
        ${ST.saved ? `<p class="sp-note">Saved to results with ${esc(ST.saved)}.</p>` : `<button type="button" class="btn sm primary" data-st="save" ${stale || changed || ST.busy ? 'disabled' : ''}>Save to results</button>`} <button type="button" class="btn sm" data-st="clear">Clear from view</button></div>`;
      const cols = (r.legendCols || INST.persp.ws?.rampColors?.(r.ramp)) || [];
      // after Ladybug's legend: ten coloured steps, the value at every step (a categorical map keeps its named classes)
      if (r.legendLabels) legend.innerHTML = `<b>${esc(r.title.split(' · ')[0])} · ${esc(r.unit)}</b><div class="sp-ramp" style="background:linear-gradient(to top,${cols.join(',')})"></div><div class="sp-rampl">${r.legendLabels.map((x) => `<span>${esc(x)}</span>`).join('')}</div>`;
      else { const n = 10, at = (t) => { const k = t * (cols.length - 1), i = Math.min(cols.length - 2, Math.floor(k)), u = k - i, A = parseInt((cols[i] || '#888888').slice(1), 16), B = parseInt((cols[i + 1] || '#888888').slice(1), 16), m = (b) => Math.round(((A >> b) & 255) * (1 - u) + ((B >> b) & 255) * u); return `rgb(${m(16)},${m(8)},${m(0)})`; };
        legend.innerHTML = `<b>${esc(r.title.split(' · ')[0])} · ${esc(r.unit)}</b><div class="sp-lbsteps">${Array.from({ length: n }, (_, i) => n - 1 - i).map((i) => `<i style="background:${at((i + 0.5) / n)}"></i>`).join('')}</div><div class="sp-lblabels">${Array.from({ length: n + 1 }, (_, i) => n - i).map((i) => `<span>${fmt(r.lo + (r.hi - r.lo) * i / n, r.dec)}</span>`).join('')}</div>`; } }
      if (r && r.svals && r.slo !== undefined) legend.insertAdjacentHTML('beforeend', `<small class="sp-lbnote">On the building: ${fmt(r.slo)} to ${fmt(r.shi)} ${esc(r.unit)}, the same colours</small>`);
  }
  studyCard.addEventListener('click', (e) => { const b = e.target.closest('[data-priv-side]'); if (!b || ST.busy) return; const k = b.dataset.privSide, on = ST.priv.sides.includes(k); ST.priv = { ...ST.priv, sides: on ? ST.priv.sides.filter((x) => x !== k) : [...ST.priv.sides, k] }; drawStudy(); });
  root.addEventListener('click', (e) => { const b = e.target.closest('.sp-studycard [data-st-mode], .sp-studycard [data-st-view], .sp-studycard [data-st-set], .sp-studycard [data-st-area], .sp-studycard [data-wdir]'); if (!b || ST.busy) return; const d = b.dataset;
    if (d.stMode) { const k = SPEC[ST.id].mode[0]; if (ST[k] === d.stMode) return; ST[k] = d.stMode; if ((ST.id === 'wind' || ST.id === 'vent' || ST.id === 'daylight') && ST.res) { ST.res = null; clearAll(); showArea(); } if (d.stMode === 'section' && !secNow()) secEditor(true); }
    else if (d.stView) { ST.view[ST.id] = d.stView; if (ST.res && ST.res.views[d.stView]) { applyView(ST.res, d.stView); paintRes(ST.res); } }
    else if (d.stSet) { const [k, v] = d.stSet.split(':'); ST[k] = v; }
    else if (d.stArea) { ST.area = +d.stArea; ST.areaOpen = false; if (!ST.res) showArea(); }
    else if (d.wdir) { ST.windDir = +d.wdir * 22.5; ST.windSpeed = null; }
    drawStudy(); });
  studyCard.addEventListener('change', (e) => { const t = e.target, k = t.dataset.stNum || t.dataset.stSel; if (!k || ST.busy) return; ST[k] = t.dataset.stNum ? (Number.isFinite(+t.value) ? +t.value : ST[k]) : t.value; drawStudy(); });
  studyCard.addEventListener('change', (e) => { const wk = e.target.dataset.way; if (wk) { if (wk === 'start') ST.wayStart = e.target.value; else ST.wayFurn = e.target.checked; drawStudy(); } });
  studyCard.addEventListener('change', (e) => { const t = e.target, k = t.dataset.priv; if (k) { ST.priv = { ...ST.priv, [k]: k === 'doors' ? t.checked : +t.value }; drawStudy(); return; }
    if (t.dataset.privneed != null) { let sc = null; try { sc = INST.persp.ws.planScene('privacy'); } catch { } const key = 'privacy:' + (sc?.source?.project || 'sample'), m = PKEEP.get(key, {}); if (t.value) m[t.dataset.privneed] = t.value; else delete m[t.dataset.privneed]; PKEEP.set(key, m); ST.privNeedV = (ST.privNeedV || 0) + 1; drawStudy(); return; } });
  studyCard.addEventListener('click', (e) => { const b = e.target.closest('[data-iso="pick"]'); if (!b || ST.busy) return; const pane = activePane(); if (!pane.ready || !pane.ws.pickPoint) return;
    ST.isoPick = !ST.isoPick; pane.ws.pickPoint(ST.isoPick ? (pt) => { ST.isoPick = false; ST.isoView = pt; drawStudy(); runStudy(); } : null); drawStudy(); });
  // Fire evacuation: playback, speed, the fire room (a click in either view), patients, runs and seed
  studyCard.addEventListener('click', (e) => { const b = e.target.closest('[data-eg]'); if (!b || ST.busy || b.tagName === 'SELECT' || b.tagName === 'INPUT') return; const k = b.dataset.eg;
    if (k === 'play') { ST.egPlay = !ST.egPlay; views2().forEach((w2) => w2.egressPlay?.(ST.egPlay)); drawStudy(); return; }
    if (k === 'speed') { ST.egSpeed = +b.dataset.v; if (ST.res) paintRes(ST.res); drawStudy(); return; }
    if (k === 'random') { ST.egFire = null; ST.egPick = false; activePane().ws?.pickPoint?.(null); drawStudy(); return; }
    if (k === 'pick') { const pane = activePane(); if (!pane.ready || !pane.ws.pickPoint) return; ST.egPick = !ST.egPick;
      pane.ws.pickPoint(ST.egPick ? (pt) => { ST.egPick = false; let name = '', lv = pane.ws.level?.(); try { const sc = pane.ws.planScene('wayfinding'), o = sc.origin || [0, 0], x = pt[0] - o[0], y = pt[1] - o[1], rm = (sc.rooms || []).find((r) => (r.rects || []).some(([x0, y0, w0, h0]) => x >= x0 && x <= x0 + w0 && y >= y0 && y <= y0 + h0)); name = rm ? `${rm.name} (${sc.name.split(' · ').pop()})` : ''; } catch { }
        if (!name) { ST.err = 'That spot is not inside a room: click inside a room on the level shown.'; drawStudy(); return; } ST.err = ''; ST.egFire = { lv, x: pt[0], y: pt[1], name }; drawStudy(); } : null); drawStudy(); } });
  studyCard.addEventListener('click', (e) => { const b = e.target.closest('[data-wsopen]'); if (b) openWater(b.dataset.wsopen); });
  studyCard.addEventListener('input', (e) => { if (e.target.dataset.eg === 'seek') { ST.egT = +e.target.value; views2().forEach((w2) => w2.egressSeek?.(ST.egT)); } });
  studyCard.addEventListener('change', (e) => { const k = e.target.dataset.eg; if (!k || k === 'seek') return; if (k === 'mix') ST.egMix = e.target.value; else if (k === 'use') ST.egUse = e.target.value; else if (k === 'detect') ST.egDetect = e.target.value; else if (k === 'runs') ST.egRuns = +e.target.value; else if (k === 'seed') ST.egSeed = Math.max(1, Math.round(+e.target.value) || 1); drawStudy(); });
  studyCard.addEventListener('change', (e) => { const k = e.target.dataset.dl; if (!k) return; ST[k] = +e.target.value; drawStudy(); });
  studyCard.addEventListener('change', (e) => { const t = e.target; if (t.dataset.camtype) { ST.camTypes = { ...ST.camTypes, [t.dataset.camtype]: t.checked }; drawStudy(); return; } const k = t.dataset.cam; if (!k) return; ST[k] = t.tagName === 'SELECT' ? t.value : +t.value; drawStudy(); });
  studyCard.addEventListener('change', (e) => { const k = e.target.dataset.vw; if (!k) return; ST[k] = e.target.type === 'checkbox' ? e.target.checked : +e.target.value; drawStudy(); });
  studyCard.addEventListener('change', (e) => { if (e.target.dataset.ss === 'glass') { ST.ssGlass = e.target.checked; drawStudy(); } });
  studyCard.addEventListener('change', (e) => { const n = e.target.dataset.circuse; if (n != null) { ST.circUse = { ...ST.circUse, [n]: e.target.value }; drawStudy(); } });
  studyCard.addEventListener('change', (e) => { const k = e.target.dataset.sun; if (!k) return; const v = e.target.value;
    if (k === 'date' && /^\d{4}-\d\d-\d\d$/.test(v)) ST.day = v.slice(5); else if (k === 'step') { ST.sunStepHand = v !== 'q'; ST.sunStep = ST.sunStepHand ? +v : qualOf().sun; } else if (k === 'h0' || k === 'h1') { const [a, b] = v.split(':').map(Number); if (Number.isFinite(a)) { const h = a + (b || 0) / 60; if (k === 'h0') ST.sunH0 = h; else ST.sunH1 = h === 0 ? 24 : h; } if (ST.sunH1 <= ST.sunH0) ST.sunH1 = Math.min(24, ST.sunH0 + 1); }
    drawStudy(); });
  studyCard.addEventListener('input', (e) => { if (e.target.dataset.st === 'windSpeed') { const o = studyCard.querySelector('.sp-spd'); if (o) o.textContent = fmt(+e.target.value, 1); } });
  studyCard.addEventListener('change', (e) => { if (e.target.dataset.st === 'windSpeed') { ST.windSpeed = +e.target.value; drawStudy(); } });
  root.addEventListener('click', (e) => { const b = e.target.closest('.sp-studycard [data-st], .sp-studyres [data-st], [data-st-l], [data-st-r]'); if (!b) return;
    if (b.dataset.stL) { ST.ltab = b.dataset.stL; drawStudy(); return; } if (b.dataset.stR) { ST.rtab = b.dataset.stR; drawStudy(); return; }
    if (b.tagName === 'A') e.preventDefault(); const k = b.dataset.st; if (k === 'anim') { if (ST.id === 'evac' && ST.res) { ST.res.played = false; ST.anim = true; paintRes(ST.res); drawStudy(); return; } ST.anim = !animOn(); animate(ST.res); drawStudy(); return; } if (k === 'play') { playDay(); return; } if (k === 'ser-months' || k === 'ser-seasons') { runSeries(k === 'ser-months' ? 'months' : 'seasons'); return; } if (k === 'stop') { ST.cancel = true; SSX.stop(); VWS.stop(); CAMS.stop(); DAY.stop(); ST.progress = 'Stopping after this step…'; drawStudy(); return; } if (k === 'area') { ST.areaOpen = !ST.areaOpen; drawStudy(); return; } if (k === 'exp') { ST.exp = !ST.exp; drawStudy(); return; } if (k === 'windSpeed') return; if (k === 'save') saveStudy(); else if (k === 'close') closeStudy(); else if (k === 'run') runStudy(); else if (k === 'uniform-snow') { closeStudy(); location.hash = '#/simulations/snow?mode=vertical'; } else if (k === 'page') openPage(ST.id); else if (k === 'csv') exportCSV(); else if (k === 'png') exportPNG();
    else if (k === 'clear') { clearAll(); ST.res = null; showArea(); drawStudy(); } });
  let staleShown = false;

  // ---- Compare sketches (2026-10-30): a sheet over the lower half of the view. Each saved version is a sketch (a column with its
  // picture and name; the one the model is on says Current); rows are grouped (Pinned, Building, Site, Space, Element, Results) and
  // read from the versions and the saved study results. Add sketch saves the model as a version; Export to Excel writes a CSV.
  const cmp = el('section', 'sp-card sp-sheet'); cmp.hidden = true; cmp.setAttribute('aria-label', 'Compare sketches'); root.append(cmp);
  const dat = el('section', 'sp-card sp-sheet sp-datasheet'); dat.hidden = true; dat.setAttribute('aria-label', 'Project data'); root.append(dat);
  // ---- a water body of the site (2026-11-06): what it is and how it moves, set by the person or read from the terrain
  const watCard = el('section', 'sp-card sp-watercard'); watCard.hidden = true; watCard.setAttribute('aria-label', 'Water body'); root.append(watCard);
  const WTYPES = [['auto', 'From the terrain'], ['pond', 'Still water (pond, lake, pool)'], ['stream', 'Flowing water (stream, river)']];
  let watId = null;
  function drawWater() { const w = INST.persp.ready ? INST.persp.ws : null, all = w?.waters?.() || [], o = all.find((x) => x.id === watId); if (!o) { watCard.hidden = true; return; }
    const set = o.set || {}, num = (k, label, unit, auto, st, dis) => `<label class="sp-field">${label}<span class="sp-num"><input type="number" data-wat="${k}" step="${st}" value="${set[k] ?? ''}" placeholder="${auto == null ? '' : fmt(auto, st < 0.1 ? 2 : 1)}" ${dis ? 'disabled' : ''}> ${unit}</span></label>`, still = o.type !== 'stream';
    let anim = true; try { anim = localStorage.getItem('pc-water-anim') !== 'off'; } catch { }
    watCard.innerHTML = `<header><b>${esc(o.name)}</b><span class="sp-pill" data-state="ok">${still ? 'Still water' : 'Flowing water'}</span><button type="button" class="sp-x" data-watx="close" aria-label="Close">×</button></header>
      <label class="sp-field">Name<input type="text" data-wat="name" value="${esc(o.name)}"></label>
      <label class="sp-field">Water<select data-wat="type">${WTYPES.map(([k, n]) => `<option value="${k}" ${(set.type || 'auto') === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <div class="sp-two">${num('level', still ? 'Surface level' : 'Level at the top', 'm', o.level, 0.05, !still)}${num('depth', 'Depth', 'm', o.depth, 0.1)}</div>
      ${still ? '' : `<div class="sp-two">${num('speed', 'Surface speed', 'm/s', o.speed, 0.1)}${num('discharge', 'Flow', 'm³/s', o.discharge, 0.05)}</div>`}
      <p class="sp-note">${fmt(o.area)} m²${o.length ? ` · ${fmt(o.length)} m long, from ${fmt(o.level, 2)} m to ${fmt(o.outlet, 2)} m` : ` · surface at ${fmt(o.level, 2)} m`}. ${o.falls.length ? o.falls.map((f, i) => `Falls ${i + 1}: ${fmt(f.drop, 1)} m drop, ${fmt(f.w, 1)} m wide`).join(' · ') : still ? '' : 'No falls: the water drops less than 0.4 m at a time.'}</p>
      <p class="sp-note">Empty fields are read from the terrain (shown in grey): a pond at the lowest point of its shore, a stream along its middle, running downhill, with falls where it drops 0.4 m or more. The flow, when not given, is about 0.6 × width × depth × surface speed.</p>
      <label class="sp-check"><input type="checkbox" data-watanim ${anim ? 'checked' : ''}> Moving water in 3D</label>
      <div class="sp-acts"><button type="button" class="btn sm" data-watx="reset">Read all from the terrain</button></div>`;
    watCard.hidden = false; }
  function openWater(id) { watId = id; openData(false); drawWater(); }
  watCard.addEventListener('change', (e) => { const t = e.target; if (t.dataset.watanim != null) { views2().forEach((w) => w.waterAnim?.(t.checked)); return; } const k = t.dataset.wat; if (!k || !watId) return;
    const v = k === 'name' ? t.value : k === 'type' ? t.value : t.value === '' ? null : +t.value; [INST.persp, INST.plan].filter((I) => I.ready).forEach((I, n) => { if (!n) I.ws.waterSet?.(watId, { [k]: v }); }); setTimeout(drawWater, 300); });
  watCard.addEventListener('click', (e) => { const b = e.target.closest('[data-watx]'); if (!b) return; if (b.dataset.watx === 'close') { watCard.hidden = true; watId = null; return; }
    if (b.dataset.watx === 'reset' && INST.persp.ready) { INST.persp.ws.waterSet?.(watId, { type: null, level: null, depth: null, speed: null, discharge: null }); setTimeout(drawWater, 300); } });
  window.__wsWater = { open: openWater, state: () => ({ id: watId, open: !watCard.hidden }) };
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
    for (const sim of api.sims) { const runs = p.runs.filter((r) => r.simId === sim.id && r.results); if (!runs.length && !simLog()[sim.id]?.results) continue;
      const lg = simLog()[sim.id], now = lg && lg.results && lg.key === modelHash() ? { results: lg.results, settings: { label: lg.settings } } : null, last = (c) => (c.v ? runs.filter((r) => r.versionId === c.v.id).at(-1) : null) || (c.current && now) || null;
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
    cmp.innerHTML = `${GRIP}<button type="button" class="sp-x" data-cmp="close" aria-label="Close Compare sketches">×</button>
      <div class="sp-sk-scroll">${head}${body}${notes.map((n) => `<p class="sp-note">${esc(n)}</p>`).join('')}</div>
      <footer><span class="sp-sk-title">Compare sketches</span><span class="sp-sk-acts"><button type="button" class="btn sm" data-cmp="csv" title="A CSV file that Excel opens">Export to Excel</button><button type="button" class="btn sm primary" data-cmp="report" title="Choose two sketches and make a comparison report"${cols.length < 2 ? ' disabled' : ''}>Generate report</button></span></footer>
      <div class="sp-rpick" hidden></div>`;
    // Add sketch: the current model becomes the next sketch (version) of this project, named Sketch N; nothing else comes along
    const sv = $('#saveV'), note = $('#note'); if (sv && note) { const add = cmp.querySelector('.sp-sk-add'); add.querySelector('#spAddSketch').replaceWith(sv); sv.textContent = 'Add sketch'; sv.classList.add('btn', 'sm', 'primary');
      if (!sv.dataset.spSketch) { sv.dataset.spSketch = '1'; sv.addEventListener('click', () => { if (cmp.contains(sv) && !note.value.trim()) note.value = 'Sketch ' + (p.versions.length + 1); }, true); } }
    // pictures: the model as it is now, once per opening; a version keeps the picture taken when it was added here
    if (INST.persp.ready && INST.persp.ws.thumb) { const key = cols.find((c) => c.current)?.id; if (key && !THUMB.has(key)) { try { const u = await INST.persp.ws.thumb(); if (u) { THUMB.set(key, u); const im = cmp.querySelector(`[data-sketch="${CSS.escape(key)}"] .sp-sk-pic`); if (im) im.innerHTML = `<img src="${u}" alt="">`; } } catch { } } }
  }
  function parkSave() { const sec = app.querySelector('section[data-tab="versions"]'), sv = $('#saveV'), note = $('#note'); if (sec && sv && note && !sec.contains(sv)) { sec.querySelector('#dirty')?.after(note, sv); sv.textContent = 'Save version'; } }
  function openSheet(on) { if (on && !dat.hidden) openData(false); cmp.hidden = !on; root.classList.toggle('sp-sheet-open', on); syncTabs(); if (on) { openCard(false); closePops(); palOpen(false); drawCompare(); } else parkSave(); }
  cmp.addEventListener('click', async (e) => {
    const g = e.target.closest('[data-grp]'), pin = e.target.closest('[data-pin]'), sk = e.target.closest('[data-sketch]'), b = e.target.closest('[data-cmp]');
    if (g) { const x = shut(); x.has(g.dataset.grp) ? x.delete(g.dataset.grp) : x.add(g.dataset.grp); setShut(x); drawCompare(); return; }
    if (pin) { const x = pins(); x.has(pin.dataset.pin) ? x.delete(pin.dataset.pin) : x.add(pin.dataset.pin); setPins(x); drawCompare(); return; }
    if (sk) { if (sk.dataset.sketch === 'draft') return; const ld = app.querySelector(`#versions [data-load="${CSS.escape(sk.dataset.sketch)}"]`); if (ld) { ld.click(); setTimeout(drawCompare, 300); } return; }
    if (!b) return; const k = b.dataset.cmp;
    if (k === 'close') openSheet(false);
    else if (k === 'report') reportPick();
    else if (k === 'rgo') makeReport();
    else if (k === 'rx') cmp.querySelector('.sp-rpick').hidden = true;
    else if (k === 'csv') { const { cols, groups, N } = compareData(), q = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = [['', ...cols.map((c) => `${c.title} (${c.current ? 'current' : c.sub})`)], ...groups.filter(([g]) => g !== 'Pinned').flatMap(([g, rows]) => [[g], ...rows.map(([l, get, u, d]) => [l, ...cols.map((c) => { const v = get(c); return v === null || v === undefined ? '' : +(+v).toFixed(3); })])])].map((r) => r.map(q).join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })); a.download = `${p.name.replace(/[^\w-]+/g, '-')}-compare-sketches.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); } });
  // Getting started › Compare two options, and the project overview's Compare plans, open this sheet (2026-11-01)
  const startCompare = (e) => { const a = e.target.closest('.pc-start [data-step="compare"] a'); if (!a) return; e.preventDefault(); e.stopPropagation(); openSheet(true); };
  document.addEventListener('click', startCompare, true);
  { let want = false; try { want = sessionStorage.getItem('pc-ws-open-compare') === '1'; sessionStorage.removeItem('pc-ws-open-compare'); } catch { } if (want) setTimeout(() => openSheet(true), 600); }
  // a sketch added here keeps a picture of the model
  const thumbT = (() => { const n0 = { n: p.versions.length }; return setInterval(() => { if (p.versions.length > n0.n) { const v = p.versions.at(-1); n0.n = p.versions.length; const u = THUMB.get('draft') || THUMB.get(v.id); if (u && !v.thumb) { v.thumb = u; S.save(); } THUMB.delete('draft'); if (!cmp.hidden) drawCompare(); } }, 500); })();

  // ---- the sheets' height (2026-11-01): drag the grip up to make a sheet taller, down to make it shorter; let go low enough and
  // it closes. The height is kept for the next opening. Arrow keys on the grip do the same.
  const SHK = 'pc-ws-sheet-h', sheetH = () => { try { const h = +localStorage.getItem(SHK); return h > 0 ? h : 0; } catch { return 0; } };
  const setSheetH = (h) => { if (h) root.style.setProperty('--sp-sheet-h', Math.round(h) + 'px'); else root.style.removeProperty('--sp-sheet-h'); };
  setSheetH(sheetH());
  const GRIP = '<div class="sp-sk-grip" role="separator" tabindex="0" aria-orientation="horizontal" aria-label="Drag up to enlarge, down to shrink or close" title="Drag up to enlarge, down to close"><i></i></div>';
  function gripDrag(sheet, close) {
    const maxH = () => Math.max(200, root.clientHeight - 80), MIN = 150, SHUT = 110;
    sheet.addEventListener('pointerdown', (e) => { const g = e.target.closest('.sp-sk-grip'); if (!g || e.button !== 0) return; e.preventDefault();
      const y0 = e.clientY, h0 = sheet.getBoundingClientRect().height; let h = h0; g.setPointerCapture(e.pointerId); root.classList.add('sp-sheet-drag');
      const mv = (ev) => { h = Math.min(maxH(), h0 - (ev.clientY - y0)); setSheetH(Math.max(60, h)); sheet.classList.toggle('sp-closing', h < SHUT); };
      const up = () => { g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); root.classList.remove('sp-sheet-drag'); sheet.classList.remove('sp-closing');
        if (h < SHUT) { setSheetH(sheetH()); close(); return; } h = Math.max(MIN, h); setSheetH(h); try { localStorage.setItem(SHK, String(Math.round(h))); } catch { } };
      g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up); });
    sheet.addEventListener('keydown', (e) => { if (!e.target.closest?.('.sp-sk-grip') || !['ArrowUp', 'ArrowDown'].includes(e.key)) return; e.preventDefault();
      const h = sheet.getBoundingClientRect().height + (e.key === 'ArrowUp' ? 40 : -40); if (h < SHUT) { close(); return; } const v = Math.min(maxH(), Math.max(MIN, h)); setSheetH(v); try { localStorage.setItem(SHK, String(Math.round(v))); } catch { } });
  }
  gripDrag(cmp, () => openSheet(false));
  function syncTabs() { root.classList.toggle('sp-cmp-open', !cmp.hidden); root.classList.toggle('sp-data-open', !dat.hidden); root.classList.toggle('sp-sheet-open', !cmp.hidden || !dat.hidden); }

  // ---- the simulations run in this project (2026-11-01): the last run of each study, kept in this browser with the model it was
  // run on (a fingerprint), so Project data and Compare sketches can say whether it still matches the model
  const LOGK = 'pc-ws-simlog:' + p.id;
  const hashOf = (s) => { s = String(s ?? ''); let h = 5381; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36) + '.' + s.length.toString(36); };
  const modelHash = () => { try { return INST.persp.ready ? hashOf(studyModel(INST.persp.ws)) : null; } catch { return null; } };
  const simLog = () => { try { return JSON.parse(localStorage.getItem(LOGK)) || {}; } catch { return {}; } };
  const plain = (h) => { const d = document.createElement('div'); d.innerHTML = String(h ?? ''); return d.textContent.trim(); };
  function logRun(id, r, saved) {
    const L = simLog(), prev = L[id]; if (saved && prev) { prev.saved = saved; prev.key = modelHash() || prev.key; }
    else L[id] = { id, name: simName(id), title: plain(r.title), at: (ST.at || new Date()).toISOString(), key: modelHash(), version: baseline()?.n ?? null, draft: dirty(),
      rows: (r.rows || []).map(([k, v]) => [plain(k), plain(v)]), results: r.results || null, settings: r.settings?.label || '', cell: r.cell, cells: r.cells, ms: r.ms, saved: '' };
    try { localStorage.setItem(LOGK, JSON.stringify(L)); } catch { }
    if (!dat.hidden) drawData();
  }

  // ---- Project data (2026-11-01): the Properties button with nothing selected opens a sheet listing the project's objects with
  // their figures (the design, spaces, the site) and every simulation run here, with its key results and whether it still
  // matches the model. Rows open what they describe; Export to Excel writes the whole table.
  gripDrag(dat, () => openData(false));
  const DGK = 'pc-ws-datagroups', dshut = () => { try { return new Set(JSON.parse(localStorage.getItem(DGK)) || []); } catch { return new Set(); } }, setDshut = (x) => { try { localStorage.setItem(DGK, JSON.stringify([...x])); } catch { } };
  const ago = (t) => { const s = (Date.now() - new Date(t)) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : new Date(t).toLocaleDateString('en-CA', { day: 'numeric', month: 'short', year: 'numeric' }); };
  function projectData() {
    const st = studio() || {}, ms = st.masses || [], ims = (st.imports || []).filter((o) => !o.ref), site = st.site || {}, objs = INST.plan.ready ? INST.plan.ws.objects() : [];
    const groups = [];
    // the design: masses and imported models
    const dRows = ms.map((m) => { const fp = area(m.points || []), n = m.storeys || 1, fh = m.fh || 3.2, h = n * fh;
      return { sel: 'ps:mass:' + m.id, cells: [m.name || 'Mass', 'Mass', m.use || '—', n, fp, fp * n, h, fp * h] }; });
    for (const o of ims) { const cs = o.components || [], b = cs.length ? cs.reduce((a, c) => { const g = c.g || {}; return [Math.min(a[0], g.x ?? 0), Math.min(a[1], g.y ?? 0), Math.min(a[2], g.z ?? 0), Math.max(a[3], (g.x ?? 0) + (g.w ?? 0)), Math.max(a[4], (g.y ?? 0) + (g.d ?? 0)), Math.max(a[5], (g.z ?? 0) + (g.h ?? 0))]; }, [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]) : null;
      const W = b ? b[3] - b[0] : null, D = b ? b[4] - b[1] : null, H = b ? b[5] - b[2] : null;
      dRows.push({ sel: 'ps:imp:' + o.id, cells: [o.name || 'Imported model', 'Imported model', o.layer || '—', null, W && D ? W * D : null, null, H, null], note: `${fmt(o.tris || 0)} triangles; footprint is the bounding box` }); }
    const tot = (i) => dRows.reduce((a, r) => a + (+r.cells[i] || 0), 0);
    if (dRows.length) dRows.push({ total: true, cells: ['Total', `${ms.length} mass${ms.length === 1 ? '' : 'es'}${ims.length ? `, ${ims.length} imported` : ''}`, '', ms.reduce((a, m) => Math.max(a, m.storeys || 1), 0) || null, tot(4), tot(5), Math.max(0, ...dRows.map((r) => +r.cells[6] || 0)), tot(7)] });
    groups.push({ k: 'Design', head: ['Object', 'Type', 'Use / layer', 'Storeys', 'Footprint m²', 'Gross floor area m²', 'Height m', 'Volume m³'], dec: [0, 0, 0, 0, 0, 0, 1, 0], rows: dRows, empty: 'No masses or imported models yet: draw a mass or import a model.' });
    // spaces and elements on the plan
    const rooms = objs.filter((o) => o.k === 'room'), c = (k) => objs.filter((o) => o.k === k).length;
    const sRows = rooms.map((r) => ({ sel: 'ps:room:' + r.id, cells: [r.name || 'Room', 'Space', r.level || r.lv || '—', r.area ?? null] }));
    if (rooms.length) sRows.push({ total: true, cells: ['Total', `${rooms.length} space${rooms.length === 1 ? '' : 's'}`, '', rooms.reduce((a, r) => a + (r.area || 0), 0)] });
    for (const [k, n] of [['wall', 'Walls'], ['op', 'Doors and windows'], ['floor', 'Floor slabs'], ['furn', 'Furniture']]) if (c(k)) sRows.push({ cells: [n, 'Elements', '', null], count: c(k) });
    groups.push({ k: 'Spaces', head: ['Object', 'Type', 'Level', 'Area m²', 'Count'], dec: [0, 0, 0, 1, 0], rows: sRows.map((r) => ({ ...r, cells: [...r.cells, r.count ?? (r.total ? null : '')] })), empty: INST.plan.ready ? 'No rooms on the plan yet.' : 'The plan is still loading.' });
    // the site
    const ctx = (site.buildings || []).filter((b) => !b.excluded), ctxA = ctx.reduce((a, b) => a + area(b.pts || b.points || []), 0);
    const tRows = []; if (site.parcel?.pts?.length > 2) tRows.push({ cells: ['Plot', 'Site boundary', area(site.parcel.pts), 1] });
    for (const [kind, n] of [['green', 'Planting'], ['paving', 'Paving']]) { const a = (site.areas || []).filter((x) => x.kind === kind); if (a.length) tRows.push({ cells: [n, 'Landscape', a.reduce((s, x) => s + area(x.pts || []), 0), a.length] }); }
    for (const wb of (INST.persp.ready ? INST.persp.ws.waters?.() : null) || []) tRows.push({ sel: 'water:' + wb.id, cells: [wb.name, wb.type === 'stream' ? `Flowing water${wb.falls.length ? `, ${wb.falls.length} fall${wb.falls.length > 1 ? 's' : ''}` : ''}` : 'Still water', wb.area, 1] });   /* each water body: click to set it (2026-11-06) */
    if (ctx.length) tRows.push({ cells: ['Surrounding buildings', 'Context', ctxA || null, ctx.length] });
    if ((site.roads || []).length) tRows.push({ cells: ['Roads and paths', 'Context', null, site.roads.length] });
    const z = site.terrain?.grid?.z || []; if (z.length) tRows.push({ cells: ['Terrain', `relief ${fmt(Math.max(...z) - Math.min(...z), 1)} m`, null, null] });
    groups.push({ k: 'Site', head: ['Object', 'Type', 'Area m²', 'Count'], dec: [0, 0, 0, 0], rows: tRows, empty: 'No site yet: choose one on the map (Edit site).' });
    // simulations: the last run here of each study, and the results saved with versions
    const L = simLog(), now = modelHash(), simIds = new Set([...Object.keys(L), ...p.runs.filter((r) => r.results).map((r) => r.simId)]);
    const mRows = [...simIds].map((id) => { const g = L[id], saved = p.runs.filter((r) => r.simId === id && r.results), vs = [...new Set(saved.map((r) => p.versions.find((v) => v.id === r.versionId)).filter(Boolean).map((v) => 'v' + v.n))];
      const at = g?.at || saved.at(-1)?.results?.computedAt || saved.at(-1)?.createdAt || saved.at(-1)?.at;
      const state = g ? (now && g.key === now ? 'Matches the model' : 'Model changed since') : 'Saved result';
      const key = g ? g.rows.slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ') : (() => { const sim = api.sims.find((s) => s.id === id), r = saved.at(-1); return (sim?.metrics || []).filter(([k]) => Number.isFinite(+r?.results?.[k])).slice(0, 3).map(([k, l, u, d]) => `${l}: ${fmt(+r.results[k], d || 0)}${u === '%' ? '%' : ' ' + u}`).join(' · '); })();
      return { study: id, stale: g && state !== 'Matches the model', cells: [g?.name || simName(id), g?.settings || saved.at(-1)?.settings?.label || '—', at ? ago(at) : '—', state, key || '—', vs.join(', ') || (g?.saved || 'Not saved')], at: at ? +new Date(at) : 0, rowsAll: g?.rows || [] }; }).sort((a, b) => b.at - a.at);
    groups.push({ k: 'Simulations', head: ['Study', 'Settings', 'Computed', 'Model', 'Key results', 'Saved with'], dec: [], rows: mRows, empty: 'No simulations yet: open Add simulation and press Start. Each run is listed here with its key results.' });
    return groups;
  }
  const cellText = (v, d = 0) => v === null || v === undefined || v === '' ? '—' : typeof v === 'number' ? fmt(v, d) : String(v);
  function drawData() {
    const G = projectData(), closed = dshut(); parkSave();
    dat.innerHTML = `${GRIP}<button type="button" class="sp-x" data-dat="close" aria-label="Close Project data">×</button>
      <div class="sp-sk-scroll sp-dt-scroll">${G.map((g) => `<section class="sp-dt-grp" data-dgrp="${g.k}">
        <button type="button" class="sp-dt-gh" data-dt-grp="${g.k}" aria-expanded="${!closed.has(g.k)}"><span>${g.k.toUpperCase()}</span><small>${g.rows.filter((r) => !r.total && !(r.count >= 0 && g.k === 'Spaces' && r.cells[1] === 'Elements')).length || ''}</small><i>${closed.has(g.k) ? '›' : '⌄'}</i></button>
        ${closed.has(g.k) ? '' : g.rows.length ? `<table class="sp-dt${g.k === 'Simulations' ? ' sp-dt-sim' : ''}"><thead><tr>${g.head.map((h, i) => `<th${i > 1 && g.k !== 'Simulations' ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>
          ${g.rows.map((r) => `<tr class="${r.total ? 'tot' : ''}${r.stale ? ' stale' : ''}${r.sel || r.study ? ' go' : ''}"${r.sel ? ` data-dt-sel="${esc(r.sel)}" title="Select it in the model"` : r.study ? ` data-dt-study="${esc(r.study)}" title="Open this simulation"` : ''}>${r.cells.map((v, i) => `<td${i > 1 && g.k !== 'Simulations' ? ' class="n"' : ''}${g.k === 'Simulations' && i === 3 ? ` class="sp-dt-st${r.stale ? ' old' : ''}"` : ''}>${esc(cellText(v, g.dec[i] || 0))}</td>`).join('')}</tr>${r.note ? '' : ''}`).join('')}</tbody></table>` : `<p class="sp-dt-empty">${esc(g.empty)}</p>`}</section>`).join('')}
        <p class="sp-note">Figures come from the model as it is now (heights from storeys × storey height). Simulation results are the last run of each study in this view; “Model changed since” means the model was edited after that run, so run it again before relying on it. Design checks, not compliance results.</p></div>
      <footer><span class="sp-sk-title">Project data</span><span class="sp-sk-acts"><button type="button" class="btn sm" data-dat="csv" title="A CSV file that Excel opens">Export to Excel</button></span></footer>`;
  }
  function openData(on) { if (on && !cmp.hidden) openSheet(false); dat.hidden = !on; syncTabs(); if (on) { openCard(false); closePops(); palOpen(false); if (!assetsCard.hidden) openAssets(false); drawData(); } }
  dat.addEventListener('click', (e) => {
    const g = e.target.closest('[data-dt-grp]'), sel = e.target.closest('[data-dt-sel]'), sk = e.target.closest('[data-dt-study]'), b = e.target.closest('[data-dat]');
    if (g) { const x = dshut(); x.has(g.dataset.dtGrp) ? x.delete(g.dataset.dtGrp) : x.add(g.dataset.dtGrp); setDshut(x); drawData(); return; }
    if (sel) { if (sel.dataset.dtSel.startsWith('water:')) { openWater(sel.dataset.dtSel.slice(6)); return; } select([sel.dataset.dtSel]); return; }
    if (sk) { if (IN_VIEW[sk.dataset.dtStudy]) { openData(false); openStudy(sk.dataset.dtStudy); } return; }
    if (!b) return; if (b.dataset.dat === 'close') openData(false);
    else if (b.dataset.dat === 'csv') { const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`, G = projectData();
      const rows = G.flatMap((g) => [[g.k.toUpperCase()], g.head, ...g.rows.map((r) => r.cells.map((v, i) => typeof v === 'number' ? +v.toFixed(g.dec[i] ? 2 : 1) : v ?? '')), ...(g.k === 'Simulations' ? g.rows.flatMap((r) => r.rowsAll.length ? [[`${r.cells[0]}: all results`], ...r.rowsAll.map(([k, v]) => ['', k, v])] : []) : []), []]);
      download(`${p.name.replace(/[^\w-]+/g, '-')}-project-data.csv`, '﻿' + rows.map((r) => r.map(q).join(',')).join('\n'), 'text/csv'); } });
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

  // ---- a report on two sketches (2026-11-01): Generate report in Compare sketches; choose the two sketches, and a report opens in a
  // new tab with both pictures, every figure side by side with the difference, the simulation results each was saved with, notes
  // on settings that differ, and the main changes in words. Print it or save it as PDF from that tab.
  function reportPick() {
    const { cols } = compareData(), pk = cmp.querySelector('.sp-rpick'); if (cols.length < 2) return;
    const cur = cols.findIndex((c) => c.current), b = cur >= 0 ? cur : 0, a = cols.findIndex((c, i) => i !== b);
    const opt = (sel) => cols.map((c) => `<option value="${esc(c.id)}"${c.id === sel ? ' selected' : ''}>${esc(c.title)} (${esc(c.current ? 'current' : c.sub)})</option>`).join('');
    pk.innerHTML = `<b>Comparison report</b><p class="sp-note">Choose two sketches. The report sets every figure side by side, with the change from A to B.</p>
      <label>A · before<select data-rp="a">${opt(cols[a].id)}</select></label><label>B · after<select data-rp="b">${opt(cols[b].id)}</select></label>
      <div class="sp-rp-acts"><button type="button" class="btn sm" data-cmp="rx">Cancel</button><button type="button" class="btn sm primary" data-cmp="rgo">Create report</button></div><p class="sp-rp-msg" role="status"></p>`;
    pk.hidden = false; pk.querySelector('select').focus();
  }
  function makeReport() {
    const pk = cmp.querySelector('.sp-rpick'), ia = pk.querySelector('[data-rp="a"]').value, ib = pk.querySelector('[data-rp="b"]').value, msg = pk.querySelector('.sp-rp-msg');
    if (ia === ib) { msg.textContent = 'Choose two different sketches.'; return; }
    const html = reportHTML2(ia, ib), w = window.open('', '_blank');
    if (w) { w.document.open(); w.document.write(html); w.document.close(); msg.textContent = 'The report opened in a new tab.'; }
    else { download(`${p.name.replace(/[^\w-]+/g, '-')}-comparison-report.html`, html, 'text/html'); msg.textContent = 'Pop-ups are blocked here, so the report was downloaded instead.'; }
    window.__wsLastReport = html; pk.hidden = true;
  }
  function reportHTML2(ia, ib) {
    const { cols, groups, notes } = compareData(), A = cols.find((c) => c.id === ia), B = cols.find((c) => c.id === ib), site = S.siteOf(p)?.label || 'No site chosen';
    const N = (v, u, d) => v === null || v === undefined || !Number.isFinite(+v) ? '—' : fmt(v, d || 0) + (u || ''); const changes = [];
    const table = groups.filter(([g, rows]) => g !== 'Pinned' && rows.length).map(([g, rows]) => { const body = rows.map(([l, get, u, d]) => { const a = get(A), b = get(B), ok = Number.isFinite(+a) && Number.isFinite(+b) && a !== null && b !== null;
        const df = ok ? b - a : null, pc = ok && a ? df / Math.abs(a) * 100 : null; if (ok && df) changes.push({ l, a, b, u, d, pc, g });
        return `<tr><td>${esc(l)}</td><td class="n">${N(a, u, d)}</td><td class="n">${N(b, u, d)}</td><td class="n ${ok && df ? (df > 0 ? 'up' : 'dn') : ''}">${ok ? (df > 0 ? '+' : df < 0 ? '−' : '±') + N(Math.abs(df), u, d) : '—'}</td><td class="n">${ok && !df ? '0%' : pc === null ? '—' : (pc > 0 ? '+' : '−') + fmt(Math.abs(pc), 1) + '%'}</td></tr>`; }).join('');
      return `<h2>${esc(g)}</h2><table><thead><tr><th>Figure</th><th class="n">A · ${esc(A.title)}</th><th class="n">B · ${esc(B.title)}</th><th class="n">Change</th><th class="n">Change %</th></tr></thead><tbody>${body}</tbody></table>`; }).join('');
    const top = changes.filter((c) => c.pc !== null).sort((x, y) => Math.abs(y.pc) - Math.abs(x.pc)).slice(0, 6);
    const words = top.length ? top.map((c) => `<li><b>${esc(c.l)}</b> ${c.b > c.a ? 'rises' : 'falls'} by ${fmt(Math.abs(c.pc), 1)}% (${N(c.a, c.u, c.d)} → ${N(c.b, c.u, c.d)}).</li>`).join('') : '<li>No figure differs between the two sketches.</li>';
    const resNote = groups.some(([g]) => g === 'Results') ? '' : '<p class="note">Neither sketch has saved simulation results. Run a study and press Save to results (it is kept with the version) to compare results here.</p>';
    const pic = (c) => c.thumb ? `<img src="${c.thumb}" alt="${esc(c.title)}">` : '<div class="nopic">No picture</div>';
    const when = (c) => c.draft ? 'The model as it is now (unsaved)' : `${esc(c.sub)}${c.v?.created ? ' · saved ' + new Date(c.v.created).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' }) : ''}${c.current ? ' · current' : ''}`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.name)} · comparison report</title><style>
      body{margin:0;background:#f4f5f7;color:#1f2430;font:13px/1.5 Inter,system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:900px;margin:24px auto;background:#fff;padding:36px 44px;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
      h1{font-size:22px;margin:0 0 4px}h2{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#4b5563;margin:26px 0 8px}.meta{color:#6b7280;margin:0 0 18px}
      .pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}.pair figure{margin:0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}.pair img,.nopic{width:100%;height:220px;object-fit:cover;background:#e7e7e3;display:grid;place-items:center;color:#9ca3af}.pair figcaption{padding:8px 12px}.pair figcaption b{display:block}.pair figcaption small{color:#6b7280}
      .tag{display:inline-block;background:#2f5bd3;color:#fff;border-radius:4px;padding:0 6px;margin-right:6px;font-weight:600}
      table{width:100%;border-collapse:collapse}th,td{padding:6px 8px;border-bottom:1px solid #eef0f3;text-align:left}th{font-weight:600;color:#6b7280;font-size:11.5px}.n{text-align:right;font-variant-numeric:tabular-nums}.up{color:#0f7b4b}.dn{color:#b42318}
      ul{margin:0;padding-left:20px}.note{color:#6b7280;font-size:12px}.bar{max-width:900px;margin:16px auto 0;display:flex;justify-content:flex-end;gap:8px}.bar button{font:inherit;padding:6px 14px;border-radius:6px;border:1px solid #cfd4dc;background:#fff;cursor:pointer}.bar button.p{background:#2f5bd3;color:#fff;border-color:#2f5bd3}
      @media print{body{background:#fff}.bar{display:none}main{box-shadow:none;margin:0;max-width:none;padding:0}}</style></head><body>
      <div class="bar"><button type="button" class="p" onclick="print()">Print or save as PDF</button></div>
      <main><h1>${esc(p.name)} · comparison report</h1><p class="meta">${esc(site)} · made ${new Date().toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })} in PlotCloud</p>
      <div class="pair"><figure>${pic(A)}<figcaption><b><span class="tag">A</span>${esc(A.title)}</b><small>${when(A)}</small></figcaption></figure><figure>${pic(B)}<figcaption><b><span class="tag">B</span>${esc(B.title)}</b><small>${when(B)}</small></figcaption></figure></div>
      <h2>Main changes from A to B</h2><ul>${words}</ul>
      ${table}${resNote}${notes.length ? `<h2>Read with care</h2><ul>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      <h2>About these figures</h2><p class="note">Floor areas and footprints come from each sketch's masses (gross floor area = footprint × storeys); rooms are counted for the sketch the model is on. Simulation results are those saved with each version${A.current || B.current ? ', or the last run on the model as it is now for the current sketch' : ''}; they are early-design checks computed in the browser, not compliance results or certified calculations. Compare results only where the settings match.</p></main></body></html>`;
  }

  // ---- assets (left rail): the models imported into this project and your own furniture, each with its import
  const assetsCard = el('section', 'sp-card sp-assets'); assetsCard.hidden = true; assetsCard.setAttribute('aria-label', 'Assets'); root.append(assetsCard);
  function drawAssets() {
    const ims = (studio()?.imports || []).filter((o) => !o.ref), mine = S.account().furniture || [];
    assetsCard.innerHTML = `<button type="button" class="sp-x" data-as="close" aria-label="Close assets">×</button>
      <section><h3>Imported models</h3>${ims.length ? `<ul class="sp-aslist">${ims.map((o) => `<li><button type="button" data-as-sel="${esc(o.id)}" title="Select it in the model"><b>${esc(o.name)}</b><small>${esc(o.layer || 'Imported')} · ${fmt(o.tris || 0)} triangles</small></button></li>`).join('')}</ul>`
        : '<div class="sp-asempty"><b>No imported models</b><p>Import OBJ, STL, GLB/glTF or 3DM files. Each opens in a preview first, then joins this project.</p></div>'}
        <button type="button" class="btn sm primary sp-asbtn" data-as="model">+ Import model</button></section>
      <section><h3>My furniture</h3>${mine.length ? `<div class="sp-asgrid">${mine.slice(0, 12).map((x) => `<figure title="${esc(x.name)} · ${x.w} × ${x.d} × ${x.h} m">${x.thumb ? `<img src="${x.thumb}" alt="">` : ''}<figcaption>${esc(x.name)}</figcaption></figure>`).join('')}</div><p class="sp-note">${mine.length} piece${mine.length === 1 ? '' : 's'} in your account, for every project. Place them from Furniture in the bottom bar.</p>`
        : '<div class="sp-asempty"><b>No furniture of your own yet</b><p>Import a piece (OBJ, GLB, STL, 3DM); it is kept in your account for every project.</p></div>'}
        <button type="button" class="btn sm primary sp-asbtn" data-as="furn">+ Import furniture</button></section>`;
  }
  function openAssets(on) { assetsCard.hidden = !on; $('[data-sp="assets"]', root)?.setAttribute('aria-pressed', String(on)); if (on) { openCard(false); closePops(); palOpen(false); if (!cmp.hidden) openSheet(false); if (!dat.hidden) openData(false); drawAssets(); } }
  assetsCard.addEventListener('click', (e) => { const b = e.target.closest('[data-as],[data-as-sel]'); if (!b) return;
    if (b.dataset.asSel) { select(['ps:imp:' + b.dataset.asSel]); return; }
    const k = b.dataset.as; if (k === 'close') openAssets(false);
    else if (k === 'model') { openAssets(false); openProject('import'); setTimeout(() => $('#file')?.click(), 60); }   // straight to choosing the file; the preview follows
    else if (k === 'furn') { openAssets(false); UI.acc.furniture = 0; saveUI(); if (!(UI.panel === 'furniture' && root.classList.contains('sp-pal-open'))) app.querySelector('.sp-tools [data-panel="furniture"]')?.click(); setTimeout(() => app.querySelector('#panelBody [data-impfurn]')?.click(), 60); } });

  // ---- project props (bottom left): the one place for the project's shared parameters
  const propsCard = el('section', 'sp-card sp-propscard'); propsCard.hidden = true; propsCard.setAttribute('aria-label', 'Project props'); root.append(propsCard);
  let disposeProps = null;
  const propCounts = () => { const st = studio() || {}, o = INST.plan.ready ? INST.plan.ws.objects() : []; const c = (k) => o.filter((x) => x.k === k).length;
    return { plot: st.site?.parcel?.pts?.length > 2 ? 1 : 0, building: (st.masses || []).length + (st.imports || []).length, story: (st.levels || []).length, space: c('room'), aperture: c('op'), wall: c('wall'), floor: c('floor'), furniture: c('furn'), context: (st.site?.buildings || []).filter((b) => !b.excluded).length, street: (st.site?.roads || []).length }; };
  function openProps(on) { propsCard.hidden = !on; $('[data-sp="props"]', root)?.setAttribute('aria-pressed', String(on)); disposeProps?.(); disposeProps = null;
    if (on) { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); openCard(false); closePops(); palOpen(false); if (!cmp.hidden) openSheet(false); if (!dat.hidden) openData(false); studyCard.hidden = true; disposeProps = mountProps(propsCard, p, { counts: propCounts, onClose: () => openProps(false) }); } else if (ST.id) studyCard.hidden = false; }
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
    if (ST.res && INST.persp.ready) { const st = studyModel(INST.persp.ws) !== ST.key; if (st !== staleShown) { staleShown = st; drawStudy(); } }
  };
  const timer = setInterval(tick, 400); tick();
  // a study asked for from another page (an old study link): its card opens once the 3D view is ready
  { let want = null; try { want = sessionStorage.getItem('pc-ws-open-study'); sessionStorage.removeItem('pc-ws-open-study'); } catch { } if (want && IN_VIEW[want]) { const t = setInterval(() => { if (INST.persp.ready) { clearInterval(t); openStudy(want); } }, 300); setTimeout(() => clearInterval(t), 60000); } }
  // ---- the name of an icon on hover (2026-10-31): a dark label with a small arrow, above the bottom tools, beside the rails,
  // below the top bar; it takes over from the browser's own tooltip
  const tip = el('div', 'sp-tip'); tip.hidden = true; root.append(tip);
  const TIPS = '.sp-tools :is(button,summary), .sp-rail :is(button,summary), .sp-tr :is(button,summary), .sp-bl button, .sp-tl button';
  root.addEventListener('pointerover', (e) => { const b = e.target.closest(TIPS); if (!b || !root.contains(b)) return; const t0 = b.getAttribute('title'); if (t0) { b.dataset.tip = t0; b.removeAttribute('title'); }
    const t = b.dataset.tip || b.getAttribute('aria-label'); if (!t) return; tip.textContent = t; tip.hidden = false; const r = b.getBoundingClientRect(), rr = root.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    const side = b.closest('.sp-bottom, .sp-bl') ? 'top' : b.closest('.sp-right') ? 'left' : b.closest('.sp-rail') ? 'right' : 'bottom'; tip.dataset.side = side;
    const cx = r.left + r.width / 2 - rr.left, cy = r.top + r.height / 2 - rr.top;
    const [x, y] = side === 'top' ? [cx - w / 2, r.top - rr.top - h - 10] : side === 'bottom' ? [cx - w / 2, r.bottom - rr.top + 10] : side === 'left' ? [r.left - rr.left - w - 10, cy - h / 2] : [r.right - rr.left + 10, cy - h / 2];
    tip.style.left = Math.max(6, Math.min(rr.width - w - 6, x)) + 'px'; tip.style.top = Math.max(6, y) + 'px'; tip.style.setProperty('--ax', (cx - Math.max(6, Math.min(rr.width - w - 6, x))) + 'px'); });
  root.addEventListener('pointerout', (e) => { const b = e.target.closest(TIPS); if (b && !b.contains(e.relatedTarget)) tip.hidden = true; });
  root.addEventListener('pointerdown', () => { tip.hidden = true; }, true);
  window.__wsStudy = { open: openStudy, run: runStudy, state: () => ({ ...ST, res: ST.res && { ...ST.res } }), est: (id, k) => { const e = estimate(id, QUAL.find((q) => q.k === k) || qualOf()); return e ? { ms: Math.round(e.ms), cells: e.cells, cell: e.cell, flowCells: e.flowCells, samples: e.samples, sp: e.sp, n: e.n } : null; }, time: (id, kind) => timeOf(id, kind) };   // for the browser checks
  return () => { clearInterval(dropT); dropEl.remove(); for (const n of ['dragenter', 'dragover']) window.removeEventListener(n, onOver, true); window.removeEventListener('drop', onDrop, true); document.removeEventListener('click', startCompare, true); disposeProps?.(); delete window.__wsProps; closeHost(); clearInterval(timer); clearInterval(thumbT); document.removeEventListener('click', away); if (window.__wsStudy) delete window.__wsStudy; if (window.__wsHost) delete window.__wsHost; };
}
