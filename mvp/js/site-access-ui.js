// Site access studies in the Workspace (2026-11-18): Vehicle swept path and Parking layout. The engines are pure modules
// (swept-path.js, parking.js, geom2d.js, vehicles.js); this module holds the cards, the drawing by clicks on the plan, the painting on
// the study sheet (2D plan and 3D ground), the timeline, stall editing, the link between the two, and the exports (JSON, SVG, DXF).
// Everything drawn is computed geometry. Both are screenings for early design, not certified swept-path or bylaw studies.
import * as G from './geom2d.js';
import * as V from './vehicles.js';
import * as SP from './swept-path.js';
import * as PK from './parking.js';
import * as CAD from './cad-export.js';

export const VEH = 'vehicle-swept-path', PARK = 'parking-layout';
export const VEH_VIEWS = [['path', 'Swept path'], ['clear', 'Clearance']];
export const PARK_VIEWS = [['layout', 'Layout'], ['types', 'Stall types']];
const RCOL = ['#d8402a', '#2563eb'], CATCOL = { standard: '#bfdbfe', compact: '#a7f3d0', large: '#fde68a', accessible: '#2563eb', ev: '#86efac', van: '#1e40af' };
const QK = (q) => (q === 'refined' ? 'refined' : q === 'standard' ? 'standard' : 'draft');
const snap = (p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
const PARAMS = [['length', 'Length', 'm'], ['width', 'Width', 'm'], ['wheelbase', 'Wheelbase', 'm'], ['frontOverhang', 'Front overhang', 'm'], ['rearOverhang', 'Rear overhang', 'm'], ['track', 'Track', 'm'], ['steer', 'Steering angle', '°'], ['lockTime', 'Lock to lock time', 's'], ['speed', 'Speed', 'km/h']];
const TPARAMS = [['wheelbase', 'Trailer wheelbase (kingpin to axle)', 'm'], ['frontOverhang', 'Trailer front overhang', 'm'], ['rearOverhang', 'Trailer rear overhang', 'm'], ['width', 'Trailer width', 'm'], ['hitch', 'Hitch ahead of the rear axle', 'm'], ['maxArticulation', 'Maximum articulation', '°']];

// ---- the settings, kept per project in this browser ----
export function init(ST, pid) {
  if (ST.va && ST.pk && ST._saPid === pid) return; ST._saPid = pid; let saved = null; try { saved = JSON.parse(localStorage.getItem('pc-site-access:' + pid) || 'null'); } catch { }
  const R0 = (veh, on) => ({ pts: [], rev: [], radii: [], veh, delay: 0, speed: '', on });
  ST.va = { routes: [R0('box', true), R0('car', false)], cur: 0, prof: {}, clear: 0.3, obs: { proposed: true, context: true, parking: true, columns: false, drawn: true }, drawn: [], ...(saved && saved.va) };
  ST.pk = { kind: 'surface', area: 'draw', poly: [], holes: [], ramps: [], ent: [], cats: PK.CATEGORIES.map((c) => ({ ...c })), angle: 90, aisle: '', oneWay: false, setback: 0, wall: 0.3, mode: 'A', seed: 1, opt: 'A', edits: {}, sel: null, locked: [], ...(saved && saved.pk) };
  ST.sk = null; }
export function save(ST) { try { localStorage.setItem('pc-site-access:' + ST._saPid, JSON.stringify({ va: { ...ST.va }, pk: { ...ST.pk, sel: null } })); } catch { } }
export const sig = (ST, id) => (id === VEH ? [ST.va.routes, ST.va.prof, ST.va.clear, ST.va.obs, ST.va.drawn, ST.va.obs.parking ? (ST.pkLast && ST.pkLast.sig) : 0] : [{ ...ST.pk, sel: null, edits: null, opt: null }]);
const vehOf = (ST, i) => ST.va.prof[i] || JSON.parse(JSON.stringify(V.byId(ST.va.routes[i].veh) || V.CUSTOM_BASE));

// ---- the site, as plan geometry: buildings (proposed footprints at the ground, the site's own), roads, the boundary ----
export function sceneOf(ctx) { let sc = null; try { sc = ctx.ws().planScene('noise'); } catch { }
  const masses = (sc && sc.masses) || [], low = masses.filter((m) => m.role === 'proposed').reduce((m, x) => Math.min(m, x.base), Infinity);
  const seen = new Set(), proposed = masses.filter((m) => m.role === 'proposed' && m.base <= low + 1.5 && m.outer && m.outer.length >= 3).filter((m) => { const k = JSON.stringify(m.outer.map(snap)); if (seen.has(k)) return false; seen.add(k); return true; });
  const context = masses.filter((m) => m.role === 'context' && m.outer && m.outer.length >= 3);
  const bd = sc && sc.site && sc.site.boundary; return { proposed, context, roads: (sc && sc.roads) || [], boundary: bd && bd.kind === 'polygon' && bd.pts && bd.pts.length >= 3 ? bd.pts : null, boundaryKind: bd ? bd.kind : null, hasSite: !!(sc && sc.site) }; }
function boxOf(ST, S, extra = []) { const P = [...S.proposed.flatMap((m) => m.outer), ...ST.va.routes.flatMap((r) => r.pts), ...ST.pk.poly, ...ST.pk.ent, ...ST.va.drawn.flat(), ...extra, ...(ST.sk ? ST.sk.pts : [])];
  if (!P.length) P.push([-30, -30], [30, 30]); const b = G.bbox(P), pad = 20; return { x0: b.x0 - pad, y0: b.y0 - pad, x1: b.x1 + pad, y1: b.y1 + pad }; }
const near = (box, P) => { const b = G.bbox(P); return G.boxesMeet(b, box, 0); };

// ---- painting on the study sheet ----
function show(ctx, box, marks, fit) { ctx.views2().forEach((w2) => { w2.clearStudy?.(); w2.walkShow?.({ walks: [], T: 0, box, z: 0, view: 'routes', fit: !!fit, fit2: !!fit, solid: false, people: false, density: { X0: box.x0, Y0: box.y0, cell: 1, nx: 0, ny: 0, vals: new Float32Array(0), lo: 0, hi: 1 }, polys: [], paths: [], dots: [], lines: [], labels: [], ...marks }); }); }
function siteMarks(ST, S, box, o = {}) { const polys = [], paths = [], labels = [];
  for (const r of S.roads) if (r.pts && near(box, r.pts)) paths.push({ pts: r.pts, col: '#cbd5e1', w: Math.max(3, r.width || 6), al: 0.45, tag: 'road' });
  for (const m of S.context) if (near(box, m.outer)) polys.push({ pts: m.outer, fill: o.ctxFill || '#d1d5db', fal: 0.7, col: '#6b7280', w: 0.06, tag: 'context' });
  for (const m of S.proposed) polys.push({ pts: m.outer, fill: o.propFill || '#e5e7eb', fal: 0.8, col: '#111827', w: 0.1, tag: 'proposed' });
  if (S.boundary) paths.push({ pts: S.boundary, closed: true, col: '#64748b', w: 0.08, dash: [1.2, 0.6], al: 0.8, tag: 'boundary' });
  return { polys, paths, labels }; }
function sketchMarks(ST) { const sk = ST.sk; if (!sk || !sk.pts.length) return { paths: [], dots: [] }; return { paths: [{ pts: sk.kind === 'route' ? sk.pts : [...sk.pts, sk.pts[0]], col: '#f97316', w: 0.12, al: 1, dash: sk.kind === 'route' ? null : [0.5, 0.3], tag: 'sketch' }], dots: sk.pts.map((p, i) => ({ p, col: '#f97316', r: 0.35, label: String(i + 1), ink: '#fff', al: 1 })) }; }
const merge = (...ms) => { const o = { polys: [], paths: [], dots: [], lines: [], labels: [] }; for (const m of ms) for (const k of Object.keys(o)) if (m && m[k]) o[k].push(...m[k]); return o; };
/** the plan before a run (or while drawing): the site, what has been drawn, the sketch in progress */
export function preview(ctx, fit) { const ST = ctx.ST, S = sceneOf(ctx), box = boxOf(ST, S), id = ST.id, drawn = { polys: [], paths: [], dots: [], labels: [] };
  if (id === VEH) { ST.va.routes.forEach((r, i) => { if (r.pts.length >= 2 && (i === 0 || r.on)) { drawn.paths.push({ pts: r.pts, col: RCOL[i], w: 0.1, dash: [0.6, 0.4], al: 0.9, tag: 'route' }); drawn.dots.push({ p: r.pts[0], col: RCOL[i], r: 0.5, label: String(i + 1), al: 1, ring: true }); } });
    ST.va.drawn.forEach((P) => drawn.polys.push({ pts: P, fill: '#fca5a5', fal: 0.5, col: '#b91c1c', w: 0.06, tag: 'drawn' })); }
  if (id === PARK) parkInputsMarks(ST, drawn);
  show(ctx, box, merge(siteMarks(ST, S, box), drawn, sketchMarks(ST)), fit); }
function parkInputsMarks(ST, m) { const P = ST.pk; if (P.poly.length >= 2) m.paths.push({ pts: P.poly, closed: P.poly.length >= 3, col: '#111827', w: 0.12, al: 1, tag: 'parea' });
  P.holes.forEach((h) => m.polys.push({ pts: h, fill: '#f3f4f6', fal: 0.9, hatch: '#9ca3af', col: '#6b7280', w: 0.05, tag: 'hole' }));
  if (P.kind === 'underground') P.ramps.forEach((h) => m.polys.push({ pts: h, fill: '#fde68a', fal: 0.8, hatch: '#b45309', col: '#b45309', w: 0.06, tag: 'ramp' }));
  P.ent.forEach((p, i) => m.dots.push({ p, col: '#16a34a', r: 0.6, label: 'E', al: 1, ring: true, tag: 'entrance' + i })); }

// ---- drawing by clicks on the plan: routes, areas, holes, ramps, obstacles; one click for an entrance ----
export function sketchStart(ctx, kind, target) { const ST = ctx.ST; ST.sk = { kind, pts: [], target }; arm(ctx); ctx.drawStudy(); preview(ctx); }
function arm(ctx) { const ST = ctx.ST, panes = ctx.views2(); const f = (pt) => { panes.forEach((w) => w.pickPoint?.(null)); const sk = ST.sk; if (!sk) return; const q = snap(pt);
    if (sk.kind === 'entrance') { ST.pk.ent.push(q); ST.sk = null; save(ST); ctx.drawStudy(); preview(ctx); return; }
    if (sk.kind === 'pickstall') { ST.sk = null; const o = ST.pkLast, s = o && o.stalls.find((x) => x.valid && G.inPoly(q, x.footprint)); ST.pk.sel = s ? s.id : null; if (!s) ST.pkMsg = 'No stall there: click inside a stall of the layout.'; else ST.pkMsg = ''; ctx.drawStudy(); if (ST.res) ctx.paintRes(ST.res); return; }
    sk.pts.push(q); arm(ctx); ctx.drawStudy(); preview(ctx); };
  panes.forEach((w) => w.pickPoint?.(f)); }
export function sketchEnd(ctx, ok) { const ST = ctx.ST, sk = ST.sk; ST.sk = null; ctx.views2().forEach((w) => w.pickPoint?.(null)); let err = '';
  if (ok && sk) { const P = sk.pts;
    if (sk.kind === 'route') { if (P.length < 2) err = 'A route needs at least two points.'; else { const r = ST.va.routes[sk.target]; r.pts = P; r.rev = P.slice(1).map(() => false); r.radii = P.map(() => null); if (sk.target === 1) r.on = true; } }
    else if (P.length < 3) err = 'An area needs at least three points.';
    else { const C = G.clean(P); if (!C) err = 'That outline has no area.'; else if (G.selfCrossing(C)) err = 'That outline crosses itself: draw it again without crossing.';
      else if (sk.kind === 'vobs') ST.va.drawn.push(C); else if (sk.kind === 'parea') ST.pk.poly = C; else if (sk.kind === 'phole') ST.pk.holes.push(C); else if (sk.kind === 'pramp') ST.pk.ramps.push(C); } }
  ST.saMsg = err; save(ST); ctx.drawStudy(); if (ST.res) ctx.paintRes(ST.res); else preview(ctx); }
const sketchBar = (ST, esc) => { const sk = ST.sk; if (!sk) return ''; const what = { route: 'the route: the start first, then each turn, then the end', vobs: 'the obstacle’s outline', parea: 'the parking area’s outline', phole: 'the outline of an area to keep free', pramp: 'the ramp’s outline', entrance: 'the entrance, where cars come in (one click)', pickstall: 'the stall to edit' }[sk.kind];
  return `<div class="sp-sfpick sp-sketch"><b>Click ${esc(what)} on the plan</b><p class="sp-note">${sk.pts.length} point${sk.pts.length === 1 ? '' : 's'} · snapped to 0.1 m</p><div class="sp-acts sp-acts1">${['entrance', 'pickstall'].includes(sk.kind) ? '' : `<button type="button" class="btn sm primary" data-sa="finish">Finish</button><button type="button" class="btn sm" data-sa="undo" ${sk.pts.length ? '' : 'disabled'}>Undo point</button>`}<button type="button" class="btn sm" data-sa="cancel">Cancel</button></div></div>`; };

// ---- the cards' settings ----
export function inputsHTML(ctx) { const { ST, esc } = ctx; return ST.id === VEH ? vehInputs(ctx) : parkInputs(ctx); void esc; }
const num = (attr, val, ph, step = 0.1) => `<input class="sp-in sp-num" type="number" step="${step}" ${attr} value="${val ?? ''}" placeholder="${ph ?? ''}">`;
const chk = (attr, on, label) => `<label class="sp-chk"><input type="checkbox" ${attr} ${on ? 'checked' : ''}> ${label}</label>`;
function vehInputs(ctx) { const { ST, esc, fmt } = ctx, A = ST.va, i = A.cur, R = A.routes[i], v = vehOf(ST, i), errs = V.check(v), list = V.all();
  const len = R.pts.length >= 2 ? G.plLength(R.pts) : 0;
  return `${sketchBar(ST, esc)}${ST.saMsg ? `<p class="sp-note sp-warn">${esc(ST.saMsg)}</p>` : ''}
    <div class="sp-tabs" role="tablist">${A.routes.map((r, k) => `<button type="button" role="tab" data-va-route="${k}" aria-selected="${k === i}">Route ${k + 1}${k && !r.on ? ' (off)' : ''}</button>`).join('')}</div>
    ${i === 1 ? chk('data-va="on2"', R.on, 'Check a second vehicle on its own route (at the same time, or later)') : ''}
    <p class="sp-flabel">Vehicle</p><select class="sp-sel" data-va="veh">${list.map((x) => `<option value="${esc(x.id)}" ${x.id === R.veh ? 'selected' : ''}>${esc(x.name)}${x.custom ? ' · mine' : ''}</option>`).join('')}<option value="custom" ${R.veh === 'custom' ? 'selected' : ''}>Custom vehicle…</option></select>
    <details class="sp-adv" data-adv="va-params" ${ST.advOpen['va-params'] ? 'open' : ''}><summary>Vehicle dimensions${A.prof[i] ? ' <i class="sp-dot"></i><span class="sp-dotl">changed</span>' : ''}</summary>
      <table class="sp-codesum sp-vehtab"><tbody>${PARAMS.map(([k, n, u]) => `<tr><td>${n}</td><td>${num(`data-va-p="${k}"`, v[k])}</td><td>${u}</td></tr>`).join('')}${v.kind === 'artic' ? TPARAMS.map(([k, n, u]) => `<tr><td>${n}</td><td>${num(`data-va-t="${k}"`, v.trailer[k])}</td><td>${u}</td></tr>`).join('') : ''}</tbody></table>
      <p class="sp-note">Turning radius at full lock ${fmt(V.rMin(v), 2)} m (rear axle), outer front corner ${fmt(V.rOuter(v), 2)} m. ${esc(V.PRESET_NOTE)}</p>
      ${errs.length ? `<p class="sp-note sp-warn">${esc(errs.join('; '))}</p>` : ''}<div class="sp-acts sp-acts1"><button type="button" class="btn sm" data-va="savecustom">Save as my vehicle</button>${A.prof[i] ? '<button type="button" class="btn sm" data-va="resetprof">Back to the preset</button>' : ''}</div></details>
    <p class="sp-flabel">Route ${i + 1}</p><p class="sp-note">${R.pts.length >= 2 ? `${R.pts.length} points, ${fmt(len, 1)} m along the drawn line${R.rev.some(Boolean) ? `, ${R.rev.filter(Boolean).length} reversing segment${R.rev.filter(Boolean).length === 1 ? '' : 's'}` : ''}. The rear axle follows it; each corner is driven as an arc of 1.25 × its least radius (less where the segments leave no room), or the radius you set.` : 'Not drawn yet.'}</p>
    <div class="sp-acts sp-acts1"><button type="button" class="btn sm primary" data-va="draw">${R.pts.length ? 'Draw again' : 'Draw route'}</button>${R.pts.length ? '<button type="button" class="btn sm" data-va="clearroute">Clear</button>' : ''}</div>
    ${R.pts.length >= 2 ? `<details class="sp-adv" data-adv="va-segs" ${ST.advOpen['va-segs'] ? 'open' : ''}><summary>Segments and corners</summary><table class="sp-codesum"><tbody>${R.pts.slice(1).map((p, k) => `<tr><td>Segment ${k + 1}, ${fmt(G.dist(R.pts[k], p), 1)} m</td><td>${chk(`data-va-rev="${k}"`, R.rev[k], 'reversing')}</td></tr>${k + 2 < R.pts.length ? `<tr><td>Corner ${k + 1} radius</td><td>${num(`data-va-rad="${k + 1}"`, R.radii[k + 1], 'auto')} m</td></tr>` : ''}`).join('')}</tbody></table></details>` : ''}
    <div class="sp-kv"><span>Speed</span><b>${num('data-va="speed"', R.speed, v.speed, 1)} km/h</b></div>${i === 1 ? `<div class="sp-kv"><span>Starts after route 1 by</span><b>${num('data-va="delay"', R.delay, 0, 1)} s</b></div>` : ''}
    <p class="sp-flabel">Obstacles</p>${chk('data-va-obs="proposed"', A.obs.proposed, 'The proposed buildings')}${chk('data-va-obs="context"', A.obs.context, 'The site’s buildings')}${chk('data-va-obs="parking"', A.obs.parking, `Parked cars in the parking layout${ST.pkLast ? ` (option ${esc(ST.pkLast.label)}, ${ST.pkLast.total} stalls)` : ' (none generated yet)'}`)}${chk('data-va-obs="columns"', A.obs.columns, 'Columns of the structure grid')}${chk('data-va-obs="drawn"', A.obs.drawn, `Drawn obstacles (${A.drawn.length})`)}
    <div class="sp-acts sp-acts1"><button type="button" class="btn sm" data-va="drawobs">Draw an obstacle</button>${A.drawn.length ? '<button type="button" class="btn sm" data-va="clearobs">Clear drawn</button>' : ''}</div>
    <div class="sp-kv"><span>Clearance to keep</span><b>${num('data-va="clear"', A.clear, 0.3, 0.05)} m</b></div>`; }
function parkInputs(ctx) { const { ST, esc } = ctx, P = ST.pk, U = P.kind === 'underground';
  const catRow = (c, k) => `<tr><td>${chk(`data-pk-cat="${k}" data-k="enabled"`, c.enabled, esc(c.name))}</td><td>${num(`data-pk-cat="${k}" data-k="w"`, c.w, '', 0.05)}</td><td>${num(`data-pk-cat="${k}" data-k="l"`, c.l, '', 0.05)}</td><td>${c.accessible ? num(`data-pk-cat="${k}" data-k="count"`, c.count, 0, 1) + ' stalls' : P.mode === 'C' ? num(`data-pk-cat="${k}" data-k="share"`, c.share != null ? Math.round(c.share * 100) : '', 'rest', 1) + ' %' : ''}</td></tr>`;
  return `${sketchBar(ST, esc)}${ST.saMsg ? `<p class="sp-note sp-warn">${esc(ST.saMsg)}</p>` : ''}
    <div class="sp-tabs" role="tablist">${[['surface', 'Surface parking'], ['underground', 'Underground parking']].map(([k, n]) => `<button type="button" role="tab" data-pk-kind="${k}" aria-selected="${P.kind === k}">${n}</button>`).join('')}</div>
    <p class="sp-flabel">Parking area</p><div class="sp-tabs" role="tablist">${[['draw', 'Drawn'], ['boundary', 'Site boundary'], ['around', 'Around the building']].map(([k, n]) => `<button type="button" role="tab" data-pk-area="${k}" aria-selected="${P.area === k}">${n}</button>`).join('')}</div>
    <p class="sp-note">${P.area === 'draw' ? (P.poly.length >= 3 ? `Drawn: ${ctx.fmt(Math.abs(G.area(P.poly)))} m².` : 'Draw the area’s outline on the plan.') : P.area === 'boundary' ? 'The site boundary of the site data.' : 'The drawn area (or the site boundary) less the proposed buildings.'}</p>
    <div class="sp-acts sp-acts1">${P.area !== 'boundary' ? `<button type="button" class="btn sm primary" data-pk="drawarea">${P.poly.length ? 'Draw again' : 'Draw area'}</button>` : ''}<button type="button" class="btn sm" data-pk="drawhole">Keep an area free</button>${U ? '<button type="button" class="btn sm" data-pk="drawramp">Draw a ramp</button>' : ''}${P.holes.length || P.ramps.length ? '<button type="button" class="btn sm" data-pk="clearholes">Clear those</button>' : ''}</div>
    <p class="sp-flabel">Entrances</p><p class="sp-note">${P.ent.length ? `${P.ent.length} set (green E on the plan): aisles are kept only where a car from one can reach them.` : 'Set where cars come in: one click at the area’s edge.'}</p><div class="sp-acts sp-acts1"><button type="button" class="btn sm" data-pk="addent">Add an entrance</button>${P.ent.length ? '<button type="button" class="btn sm" data-pk="clearent">Clear</button>' : ''}</div>
    ${U ? `<p class="sp-note">Underground: the columns of the Structure grid, the stairs and lifts (as cores) and the ramps drawn here are obstacles; walls kept ${num('data-pk="wall"', P.wall, 0.3, 0.05)} m clear.</p>` : `<div class="sp-kv"><span>Setback from the area’s edge</span><b>${num('data-pk="setback"', P.setback, 0, 0.1)} m</b></div>`}
    <p class="sp-flabel">Stall types</p><table class="sp-codesum sp-pktab"><thead><tr><th>Type</th><th>Width</th><th>Length</th><th>${P.mode === 'C' ? 'Share' : ''}</th></tr></thead><tbody>${P.cats.map(catRow).join('')}</tbody></table>
    <p class="sp-note">Dimensions are your design assumptions (metres), not a bylaw. Accessible stalls include their access aisle (blue hatch).</p>
    <div class="sp-kv"><span>Stall angle</span><b><select class="sp-sel" data-pk="angle">${[90, 60, 45].map((a) => `<option value="${a}" ${+P.angle === a ? 'selected' : ''}>${a}°</option>`).join('')}</select></b></div>
    <div class="sp-kv"><span>Aisle width</span><b>${num('data-pk="aisle"', P.aisle, PK.aisleFor(+P.angle, P.oneWay), 0.1)} m</b></div>${chk('data-pk="oneway"', P.oneWay, 'One-way aisles')}
    <p class="sp-flabel">Goal</p><div class="sp-tabs" role="tablist">${[['A', 'Most stalls'], ['B', 'Large first'], ['C', 'Target mix'], ['D', 'Options']].map(([k, n]) => `<button type="button" role="tab" data-pk-mode="${k}" aria-selected="${P.mode === k}">${n}</button>`).join('')}</div>
    <p class="sp-note">${{ A: 'As many stalls as the rows hold, of the narrowest type enabled.', B: 'As many of the first type in the list as the rows hold, then the next in what is left.', C: 'The shares set above, each within one stall, with the most stalls that meets them.', D: 'Distinct layouts to compare, ranked by the number of stalls.' }[P.mode]}</p>
    <div class="sp-kv"><span>Seed</span><b>${num('data-pk="seed"', P.seed, 1, 1)}</b></div>${P.locked.length ? `<p class="sp-note">${P.locked.length} locked stall${P.locked.length === 1 ? '' : 's'} kept when the rest is generated.</p>` : ''}`; }

// ---- obstacles for a vehicle ----
function obstaclesFor(ctx) { const ST = ctx.ST, A = ST.va, S = sceneOf(ctx), out = [], src = [];
  if (A.obs.proposed) { S.proposed.forEach((m, i) => out.push({ id: 'bld' + i, kind: 'building', name: m.level ? `the proposed building (${m.level})` : 'the proposed building', poly: m.outer })); if (S.proposed.length) src.push(`${S.proposed.length} proposed footprint${S.proposed.length === 1 ? '' : 's'}`); }
  if (A.obs.context) { S.context.forEach((m, i) => out.push({ id: 'ctx' + i, kind: 'building', name: m.ref ? `site building ${m.ref}` : 'a site building', poly: m.outer })); if (S.context.length) src.push(`${S.context.length} site building${S.context.length === 1 ? '' : 's'}`); }
  if (A.obs.parking && ST.pkLast) { const s = ST.pkLast.stalls.filter((x) => x.valid); s.forEach((x) => out.push({ id: 'stall:' + x.id, kind: 'stall', name: `stall ${x.id.slice(1)} (${x.name})`, poly: x.footprint })); src.push(`${s.length} parked stalls (option ${ST.pkLast.label})`); }
  if (A.obs.columns) { const C = ctx.columns(); C.forEach((c, i) => { const h = (c.size || 0.4) / 2; out.push({ id: 'col' + i, kind: 'column', name: `column ${c.axis || i + 1}`, poly: [[c.x - h, c.y - h], [c.x + h, c.y - h], [c.x + h, c.y + h], [c.x - h, c.y + h]] }); }); if (C.length) src.push(`${C.length} columns`); }
  if (A.obs.drawn) { A.drawn.forEach((P, i) => out.push({ id: 'drawn' + i, kind: 'drawn', name: `drawn obstacle ${i + 1}`, poly: P })); if (A.drawn.length) src.push(`${A.drawn.length} drawn obstacle${A.drawn.length === 1 ? '' : 's'}`); }
  const complete = S.context.length > 0 || A.drawn.length > 0;
  return { obstacles: out, complete, src, S }; }

// ---- the runs ----
export async function compute(ctx) { return ctx.ST.id === VEH ? computeVeh(ctx) : computePark(ctx); }
async function computeVeh(ctx) { const ST = ctx.ST, A = ST.va, use = A.routes.map((r, i) => ({ r, i })).filter(({ r, i }) => (i === 0 || r.on) && r.pts.length >= 2);
  if (!use.length) throw Error('Draw a route first: Draw route, click the start, each turn and the end on the plan, then Finish.');
  const { obstacles, complete, src, S } = obstaclesFor(ctx), q = QK(ctx.qualOf().k), runs = [];
  for (const { r, i } of use) { const v = vehOf(ST, i), e = V.check(v); if (e.length) throw Error(`Route ${i + 1} (${v.name}): ${e.join('; ')}.`);
    await new Promise((res) => setTimeout(res, 0)); const out = SP.simulate(v, { pts: r.pts, radii: r.radii, reverse: r.rev }, { quality: q, obstacles, clearance: +A.clear || 0.3, speed: +r.speed || v.speed, delay: i ? +r.delay || 0 : 0, complete });
    if (!out.ok) throw Error(`Route ${i + 1}: ${out.error}.`); out.routeNo = i; out.col = RCOL[i]; runs.push(out); }
  const pair = runs.length === 2 ? SP.pairConflict(runs[0], runs[1]) : null;
  ST.vehLast = { pk: ST.pkLast && ST.pkLast.sig, runs: runs.map((x) => ({ route: x.routeNo + 1, vehicle: x.vehicle.name, stalls: [...new Set([...x.collisions, ...x.tooNear].filter((c) => /^stall:/.test(c.id)).map((c) => c.id.slice(6)))] })) };
  return vehResult(ctx, runs, pair, obstacles, src, S); }

function vehMarks(ctx, runs, obstacles, S, box, view, t) { const ST = ctx.ST, m = merge(siteMarks(ST, S, box, { ctxFill: '#e5e7eb', propFill: '#f3f4f6' }));
  const hit = new Map(); for (const r of runs) for (const o of r.perObstacle) { const c = hit.get(o.id); if (!c || o.d < c.d) hit.set(o.id, o); }
  for (const o of obstacles) { if (o.kind === 'building' && !hit.has(o.id) && view !== 'clear') continue; const h = hit.get(o.id), d = h ? h.d : Infinity, thr = +ST.va.clear || 0.3;
    const col = d <= 0 ? '#dc2626' : d < thr ? '#f59e0b' : view === 'clear' ? '#16a34a' : '#6b7280'; m.polys.push({ pts: o.poly, fill: d <= 0 ? '#fecaca' : o.kind === 'stall' ? '#e2e8f0' : o.kind === 'column' ? '#374151' : null, fal: d <= 0 ? 0.45 : 0.8, col, w: d < thr ? 0.16 : 0.05, tag: 'obstacle' });   // a hit obstacle: light red with a red edge
    if (view === 'clear' && Number.isFinite(d) && d < 5) m.labels.push({ p: G.centroid(o.poly), text: d <= 0 ? 'hit' : `${d.toFixed(2)} m`, col, size: 0.6 }); }
  for (const r of runs) { const col = r.col;
    for (const L of r.envelope.loops) { m.polys.push({ pts: L, fill: col, fal: 0.07, tag: 'envfill' }); m.paths.push({ pts: L, closed: true, col, w: 0.07, dash: [0.6, 0.35], al: 1, tag: 'envelope' }); }
    for (const [n, P] of Object.entries(r.tracks)) m.paths.push({ pts: P.filter((_, i) => i % 2 === 0), col: /^T/.test(n) ? '#475569' : '#111827', w: 0.03, thin: true, al: 0.75, tag: 'track' });
    if (view !== 'clear') for (const o of r.outlines) for (const B of o.bodies) m.polys.push({ pts: B, col: '#111827', w: 0.035, al: o.end ? 0.9 : 0.45, tag: 'outline' });
    m.paths.push({ pts: r.ref.path.filter((_, i) => i % 4 === 0).map((x) => x.p), col: '#64748b', w: 0.04, dash: [0.4, 0.3], al: 0.9, tag: 'ref' });
    for (const x of r.infeasible) { const seg = r.poses.filter((p) => p.sRef >= x.s0 - 0.01 && p.sRef <= x.s1 + 0.01).map((p) => [p.x, p.y]); if (seg.length > 1) m.paths.push({ pts: seg, col: '#f97316', w: 0.35, al: 0.75, tag: 'infeasible' }); }
    // direction arrows every 10 m of the route, start and end
    for (let s = 5; s < r.length; s += 10) { const k = r.poses.findIndex((p) => p.s >= s); if (k < 1) continue; const a = r.poses[k - 1], b = r.poses[Math.min(r.poses.length - 1, k + 8)]; m.lines.push({ a: [a.x, a.y], b: [b.x, b.y], col, w: 0.08, head: true, al: 0.9 }); }
    const p0 = r.poses[0], p1 = r.poses.at(-1); m.dots.push({ p: [p0.x, p0.y], col, r: 0.55, label: String(r.routeNo + 1), al: 1, ring: true }); m.labels.push({ p: [p1.x, p1.y + 1.4], text: 'End', col, size: 0.6 });
    if (r.minClear && r.minClear.d < 3) { m.dots.push({ p: r.minClear.at, col: r.minClear.d <= 0 ? '#dc2626' : r.minClear.d < (+ST.va.clear || 0.3) ? '#f59e0b' : '#16a34a', r: 0.4, al: 1, ring: true }); m.labels.push({ p: [r.minClear.at[0], r.minClear.at[1] + 1.1], text: r.minClear.d <= 0 ? 'collision' : `${r.minClear.d.toFixed(2)} m`, col: '#111827', size: 0.55 }); } }
  if (t != null) for (const r of runs) { const q = SP.poseAt(r, t); if (!q) continue; for (const B of SP.shapesAt(r.vehicle, q).bodies) m.polys.push({ pts: B, fill: r.col, fal: 0.55, col: '#111827', w: 0.08, tag: 'body' }); }
  return m; }
function vehResult(ctx, runs, pair, obstacles, src, S) { const { ST, esc, fmt } = ctx, box = (() => { const P = runs.flatMap((r) => r.envelope.loops.flat()); const b = G.bbox(P.length ? P : [[0, 0]]), pad = 12; return { x0: b.x0 - pad, y0: b.y0 - pad, x1: b.x1 + pad, y1: b.y1 + pad }; })();
  const paint = (r, fit, t) => show(ctx, box, vehMarks(ctx, runs, obstacles, S, box, r.view, t), fit);
  const meet = !!(pair && pair.simultaneous.length), worst = meet || runs.some((r) => r.status === 'infeasible') ? 'infeasible' : runs.some((r) => r.status === 'unverified') ? 'unverified' : 'feasible', SN = { feasible: 'Feasible', infeasible: 'Infeasible', unverified: 'Not verified' };
  const T0 = Math.min(...runs.map((r) => r.poses[0].t)), T1 = Math.max(...runs.map((r) => r.poses.at(-1).t)), NF = Math.max(2, Math.min(150, Math.ceil((T1 - T0) / 0.25)));
  const timeline = { n: NF, ms: Math.min(12000, Math.max(3000, (T1 - T0) * 250)), label: (i) => { const t = T0 + (T1 - T0) * i / (NF - 1); return runs.map((r) => { const q = SP.poseAt(r, t); return q ? `Route ${r.routeNo + 1}: ${fmt(q.s, 1)} m, steering ${fmt(q.delta * 180 / Math.PI, 0)}°` : `Route ${r.routeNo + 1}: ${t < r.poses[0].t ? 'waiting' : 'arrived'}`; }).join(' · ') + ` · ${fmt(t, 1)} s`; },
    show: (i) => paint(ST.res, false, T0 + (T1 - T0) * i / (NF - 1)), reset: () => { if (ST.res) ctx.paintRes(ST.res); } };
  const mc = (r) => (r.minClear ? `${fmt(r.minClear.d, 2)} m to ${esc(r.minClear.name)} at ${fmt(r.minClear.s, 1)} m${r.minClear.d < r.clearance ? ` <span class="sp-bad">(under ${fmt(r.clearance, 2)} m)</span>` : ''}` : 'no obstacle within reach');
  const rows = [['Status', `<span class="${worst === 'infeasible' ? 'sp-bad' : ''}">${SN[worst]}</span>`]];
  for (const r of runs) { const pre = runs.length > 1 ? `Route ${r.routeNo + 1} · ` : '';
    rows.push([`${pre}Vehicle`, `${esc(r.vehicle.name)}, ${fmt(V.overallLength(r.vehicle), 2)} × ${fmt(r.vehicle.width, 2)} m, R min ${fmt(r.rMin, 2)} m`], [`${pre}Route`, `${fmt(r.length, 1)} m driven in ${fmt(r.duration, 0)} s at ${fmt(r.speed, 0)} km/h${r.reversing ? `, ${r.reversing} reversing` : ''}`],
      [`${pre}Tightest turn`, Number.isFinite(r.rReached) ? `${fmt(r.rReached, 2)} m (rear axle; the vehicle's least is ${fmt(r.rMin, 2)} m)` : 'straight'], [`${pre}Least clearance`, mc(r)], [`${pre}Collisions`, r.collisions.length ? `<span class="sp-bad">${r.collisions.length}</span>: ${esc(r.collisions.map((c) => `${c.name} (${fmt(c.s0, 1)}–${fmt(c.s1, 1)} m)`).join(', '))}` : 'none'],
      [`${pre}Swept area`, `${fmt(r.swept, 1)} m² (${r.cell} m cells)`]); }
  if (pair) rows.push(['Two vehicles', pair.simultaneous.length ? `<span class="sp-bad">meet at ${pair.simultaneous.map((x) => fmt(x.t0, 1) + ' s').join(', ')}</span>` : pair.envelopesMeet ? 'their paths cross, at different times' : 'their paths do not cross']);
  const reasons = [...runs.flatMap((r) => r.reasons.map((x) => (runs.length > 1 ? `Route ${r.routeNo + 1}: ` : '') + x)), ...(meet ? [`the two vehicles are in the same place at ${pair.simultaneous.map((x) => fmt(x.t0, 1) + ' s').join(', ')}: one must wait`] : [])], unv = runs.filter((r) => r.status === 'unverified').map((r) => r.unverifiedWhy);
  const vdata = (v) => `<table class="sp-codesum sp-vehdata"><thead><tr><th colspan="2">${esc(v.name)}${v.note ? ` <small>(${esc(v.note)})</small>` : ''}</th></tr></thead><tbody>${[['Overall length', fmt(V.overallLength(v), 2) + ' m'], ['Width', fmt(v.width, 2) + ' m'], ['Track', fmt(v.track, 2) + ' m'], ['Wheelbase', fmt(v.wheelbase, 2) + ' m'], ['Overhangs (front / rear)', `${fmt(v.frontOverhang, 2)} / ${fmt(v.rearOverhang, 2)} m`], ['Steering angle', fmt(v.steer, 1) + '°'], ['Lock to lock time', fmt(v.lockTime, 1) + ' s'], ['Turning radius (rear axle)', fmt(V.rMin(v), 2) + ' m'], ...(v.kind === 'artic' ? [['Trailer (kingpin to axle)', fmt(v.trailer.wheelbase, 2) + ' m'], ['Articulation angle', fmt(v.trailer.maxArticulation, 0) + '°']] : [])].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</tbody></table>`;
  const sections = () => `${reasons.length ? `<p class="sp-flabel">Why ${worst === 'infeasible' ? 'it fails' : 'to check'}</p><ul class="sp-sflist">${reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${unv.length ? `<p class="sp-note sp-warn">Not verified: ${esc(unv[0])}. Add the site's buildings or draw the obstacles that matter.</p>` : ''}
    <p class="sp-flabel">Conflicts</p>${runs.some((r) => r.collisions.length || r.tooNear.length) ? `<ul class="sp-sflist">${runs.flatMap((r) => [...r.collisions.map((c) => ['collision', c, r]), ...r.tooNear.map((c) => ['under the clearance', c, r])]).map(([k, c, r], j) => `<li><button type="button" class="sp-link" data-va-zoom="${j}">${esc(c.name)}</button>: ${k}, route ${r.routeNo + 1} at ${fmt(c.s0, 1)}–${fmt(c.s1, 1)} m</li>`).join('')}</ul>` : '<p class="sp-note">None against the obstacles checked.</p>'}
    <p class="sp-flabel">Vehicle data</p>${runs.map((r) => vdata(r.vehicle)).join('')}
    <p class="sp-note">Obstacles checked: ${esc(src.join(', ') || 'none')}. Clearance kept: ${fmt(+ST.va.clear || 0.3, 2)} m.</p>
    <p class="sp-note">The geometry, to use in CAD: <button type="button" class="sp-link" data-sa-exp="dxf">DXF</button> · <button type="button" class="sp-link" data-sa-exp="svg">SVG</button> · <button type="button" class="sp-link" data-sa-exp="json">JSON</button></p>`;
  const zoomList = runs.flatMap((r) => [...r.collisions, ...r.tooNear].map((c) => ({ c, r })));
  const probe = (x, y) => { let best = null; for (const r of runs) for (const p of r.poses) { const d = Math.hypot(p.x - x, p.y - y); if (!best || d < best.d) best = { d, p, r }; } if (!best || best.d > 4) return null; const p = best.p; return `<div class="sp-kv"><span>Route ${best.r.routeNo + 1} at</span><b>${fmt(p.s, 1)} m, ${fmt(p.t, 1)} s</b></div><div class="sp-kv"><span>Steering</span><b>${fmt(p.delta * 180 / Math.PI, 1)}°${Math.abs(p.delta) > 1e-3 ? ` · radius ${fmt(best.r.vehicle.wheelbase / Math.tan(Math.abs(p.delta)), 1)} m` : ''}</b></div><div class="sp-kv"><span>Off the drawn route</span><b>${fmt(p.err, 2)} m</b></div>`; };
  const layers = () => { const L = [{ name: 'BOUNDARY', col: '#64748b', items: S.boundary ? [{ pts: S.boundary, closed: true }] : [] }, { name: 'OBSTACLES', col: '#6b7280', items: obstacles.map((o) => ({ pts: o.poly, closed: true })) }];
    for (const r of runs) { const n = r.routeNo + 1; L.push({ name: `R${n}_ROUTE`, label: `Route ${n} (rear axle path, drawn)`, col: '#64748b', dash: [0.4, 0.3], items: [{ pts: r.ref.path.filter((_, i) => i % 4 === 0).map((x) => x.p) }] }, { name: `R${n}_ENVELOPE`, label: `Route ${n} swept envelope`, col: r.col, dash: [0.6, 0.35], items: r.envelope.loops.map((P) => ({ pts: P, closed: true })) },
      { name: `R${n}_WHEELS`, label: `Route ${n} wheel tracks`, col: '#111827', w: 0.02, items: Object.values(r.tracks).map((P) => ({ pts: P.filter((_, i) => i % 2 === 0) })) }, { name: `R${n}_OUTLINES`, label: `Route ${n} vehicle outlines`, col: '#111827', w: 0.03, items: r.outlines.flatMap((o) => o.bodies.map((B) => ({ pts: B, closed: true }))) },
      { name: `R${n}_LABELS`, col: '#111827', items: [], texts: [...(r.minClear ? [{ p: r.minClear.at, text: `${r.minClear.d.toFixed(2)} m` }] : []), { p: [r.poses[0].x, r.poses[0].y], text: `${n} ${r.vehicle.name}` }] }); }
    return L; };
  const r = { X0: box.x0, Y0: box.y0, cell: 1, nx: 1, ny: 1, cells: 1, avg: runs[0].minClear ? runs[0].minClear.d : 0, timeline, chartHTML: sections, probe, saRuns: runs, saPair: pair,
    views: { path: { vals: new Float32Array([0]), unit: 'm', lo: 0, hi: 1, dec: 2, avg: 0, title: `Vehicle swept path · ${runs.map((x) => x.vehicle.name).join(' and ')}`, legendLabels: ['Swept envelope (dashed)', 'Wheel tracks', 'Vehicle outlines', 'Cannot follow the route', 'Under the clearance'], legendCols: [RCOL[0], '#111827', '#64748b', '#f97316', '#f59e0b'] },
      clear: { vals: new Float32Array([0]), unit: 'm', lo: 0, hi: 1, dec: 2, avg: 0, title: 'Vehicle swept path · clearance to each obstacle', legendLabels: ['Collision', `Under ${fmt(+ST.va.clear || 0.3, 2)} m`, 'Clear'], legendCols: ['#dc2626', '#f59e0b', '#16a34a'] } },
    paint: (rr, fit) => paint(rr, fit), saZoom: (j) => { const z = zoomList[j]; if (!z) return; const at = z.r.poses.find((p) => p.s >= z.c.s0) || z.r.poses[0], b = { x0: at.x - 12, y0: at.y - 12, x1: at.x + 12, y1: at.y + 12 }; show(ctx, b, vehMarks(ctx, runs, obstacles, S, b, ST.res.view), true); },   // the sheet framed on the conflict; the next paint shows the whole again
    foot: `${runs.length} vehicle${runs.length > 1 ? 's' : ''} on drawn routes, ${obstacles.length} obstacles`, rows, saLayers: layers,
    method: `A kinematic screening at low speed. The rear axle's centre follows the drawn route (corners rounded to arcs of 1.25 × the vehicle's least radius, or the radius set); the steering is pure pursuit, limited to the vehicle's maximum angle and to the rate its lock-to-lock time allows at the stated speed, on a ${runs[0].ds} m step. An articulated vehicle's trailer follows its hitch (θt′ = (sin(θ − θt) + h·tanδ/L·cos(θ − θt)) / Lt), so the off-tracking is computed. The envelope is the union of the vehicle's outlines on ${runs[0].cell} m cells; the clearance is the least gap between each outline and each obstacle at every step. Where the vehicle cannot keep within 0.30 m of the route, a corner is tighter than it can turn, or the trailer folds past its limit, the route is reported infeasible, never forced. No tyre slip or dynamics; the body is a plan outline (no mirrors or overhang heights); kerbs only as drawn. Vehicle presets are typical dimensions for early design, not manufacturer specifications. Not a certified (AutoTURN) or fire-access code study.`,
    results: { status: worst, collisions: runs.reduce((s, x) => s + x.collisions.length, 0), minClear: runs[0].minClear ? +runs[0].minClear.d.toFixed(3) : null, swept: +runs[0].swept.toFixed(1), length: +runs[0].length.toFixed(1) },
    settings: { vehicles: runs.map((x) => x.vehicle.name), clearance: +ST.va.clear || 0.3, quality: runs[0].quality, label: `Swept path, ${runs.map((x) => x.vehicle.name).join(' + ')} (Workspace)` } };
  return r; }

// ---- parking ----
function regionFor(ctx, S) { const P = ctx.ST.pk; let outer = null; const holes = P.holes.map((h) => h.slice());
  if (P.area === 'boundary' || (P.area === 'around' && P.poly.length < 3)) { if (!S.boundary) throw Error(S.boundaryKind === 'radius' ? 'The site boundary is a circle around the site: draw the parking area instead (Drawn).' : 'This project has no site boundary: draw the parking area (Drawn).'); outer = S.boundary; }
  else { if (P.poly.length < 3) throw Error('Draw the parking area first: Draw area, click its corners on the plan, then Finish.'); outer = P.poly; }
  outer = G.clean(outer); if (!outer) throw Error('The parking area has no area.');
  return { outer, holes }; }
function obstaclesPark(ctx, S, region) { const P = ctx.ST.pk, out = [], src = [], inArea = (poly) => G.boxesMeet(G.bbox(poly), G.bbox(region.outer));
  S.proposed.forEach((m, i) => { if (inArea(m.outer)) out.push({ id: 'bld' + i, kind: 'building', poly: m.outer, clear: P.kind === 'underground' ? 0 : Math.max(0.5, +P.setback || 0) }); }); if (out.length && P.kind !== 'underground') src.push(`${out.length} proposed footprint${out.length === 1 ? '' : 's'} (kept clear)`);
  if (P.kind === 'underground') { out.length = 0; const C = ctx.columns(); C.forEach((c, i) => { const h = (c.size || 0.4) / 2; out.push({ id: 'col' + i, kind: 'column', poly: [[c.x - h, c.y - h], [c.x + h, c.y - h], [c.x + h, c.y + h], [c.x - h, c.y + h]], clear: 0.15 }); });
    if (C.length) src.push(`${C.length} columns of the Structure grid`); const cores = ctx.cores(); cores.forEach((q, i) => out.push({ id: 'core' + i, kind: 'core', poly: q.poly, clear: 0.3, name: q.name })); if (cores.length) src.push(`${cores.length} core${cores.length === 1 ? '' : 's'} (stairs and lifts)`);
    P.ramps.forEach((q, i) => out.push({ id: 'ramp' + i, kind: 'ramp', poly: q, clear: 0.3 })); if (P.ramps.length) src.push(`${P.ramps.length} ramp${P.ramps.length === 1 ? '' : 's'}`); }
  if (P.area === 'around' && P.kind !== 'underground') { /* the building footprints are already kept clear above */ }
  return { obstacles: out, src, grid: P.kind === 'underground' ? ctx.columns() : [] }; }
async function computePark(ctx) { const ST = ctx.ST, P = ST.pk, S = sceneOf(ctx), region = regionFor(ctx, S), { obstacles, src, grid } = obstaclesPark(ctx, S, region);
  if (!P.ent.length) throw Error('Set an entrance first: Add an entrance, then click where cars come in, at the area’s edge.');
  const cats = P.cats.map((c) => ({ ...c, w: +c.w, l: +c.l, count: c.count != null ? +c.count : c.count, share: c.share != null && c.share !== '' ? +c.share : null })).filter((c) => c.w > 0 && c.l > 0);
  await new Promise((res) => setTimeout(res, 0));
  const R = PK.generate({ region, obstacles, entrances: P.ent, categories: cats, angle: +P.angle, aisle: +P.aisle || null, oneWay: P.oneWay, setback: +P.setback || 0, wallClear: +P.wall || 0.3, underground: P.kind === 'underground', mode: P.mode, seed: +P.seed || 1, quality: QK(ctx.qualOf().k), grid: grid.length ? { angle: 0, pts: grid.map((c) => [c.x, c.y]) } : null, locked: P.locked.map((s) => ({ cat: s.cat, poly: s.footprint })) });
  if (!R.ok) throw Error(R.error + '.');
  ST.pkGen = R; P.edits = {}; P.sel = null; if (!R.options.some((o) => o.label === P.opt)) P.opt = 'A';
  return parkResult(ctx, R, obstacles, src, S, region); }
/** the chosen option with the edits (types changed, stalls removed) and the locked stalls */
export function chosen(ST) { const R = ST.pkGen; if (!R) return null; const o = R.options.find((x) => x.label === ST.pk.opt) || R.best, E = ST.pk.edits || {}, cats = Object.fromEntries(ST.pk.cats.map((c) => [c.id, c]));
  const stalls = o.stalls.filter((s) => !(E[s.id] && E[s.id].del)).map((s) => (E[s.id] && E[s.id].cat ? { ...s, cat: E[s.id].cat, name: (cats[E[s.id].cat] || {}).name || s.name, edited: true } : s));
  const locked = ST.pk.locked.map((s, i) => ({ ...s, id: 'L' + (i + 1), valid: true, locked: true })), all = [...stalls, ...locked], ok = all.filter((s) => s.valid), by = {}; for (const s of ok) by[s.cat] = (by[s.cat] || 0) + 1;
  return { ...o, stalls: all, total: ok.length, byCat: by, sig: JSON.stringify([o.label, o.angle, o.offset, o.total, E, ST.pk.locked.length]) }; }
function parkMarks(ctx, o, S, box, view) { const ST = ctx.ST, P = ST.pk, m = merge(siteMarks(ST, S, box), {}), cats = Object.fromEntries(P.cats.map((c) => [c.id, c])), hitIds = new Set(ST.vehLast && ST.vehLast.pk === o.sig ? ST.vehLast.runs.flatMap((r) => r.stalls) : []);
  m.paths.push({ pts: ctx.ST.pkRegion.outer, closed: true, col: '#111827', w: 0.14, al: 1, tag: 'parea' });
  for (const h of ctx.ST.pkRegion.holes) m.polys.push({ pts: h, fill: '#f3f4f6', fal: 0.9, hatch: '#9ca3af', col: '#6b7280', w: 0.05, tag: 'hole' });
  for (const x of ctx.ST.pkObs) m.polys.push({ pts: x.poly, fill: x.kind === 'column' ? '#374151' : x.kind === 'ramp' ? '#fde68a' : '#d1d5db', fal: 0.9, hatch: x.kind === 'core' || x.kind === 'ramp' ? '#6b7280' : null, col: '#374151', w: 0.05, tag: x.kind });
  o.aisles.forEach((a, i) => { m.polys.push({ pts: a.poly, fill: '#f8fafc', fal: 1, col: '#cbd5e1', w: 0.03, tag: 'aisle' });
    if (P.oneWay && a.kind === 'aisle') { const c = G.centroid(a.poly), u = G.unit(G.sub(a.poly[1], a.poly[0])), s = i % 2 ? -1 : 1, L = Math.min(4, G.dist(a.poly[0], a.poly[1]) / 4); m.lines.push({ a: [c[0] - u[0] * L * s, c[1] - u[1] * L * s], b: [c[0] + u[0] * L * s, c[1] + u[1] * L * s], col: '#64748b', w: 0.12, head: true, al: 0.9 }); } });
  let dimDone = false;
  for (const s of o.stalls) { const sel = P.sel === s.id, fill = view === 'types' || cats[s.cat]?.accessible ? CATCOL[s.cat] || '#e2e8f0' : '#e2e8f0';
    m.polys.push({ pts: s.footprint && !s.access ? s.footprint : s.poly, fill: s.valid ? fill : '#fee2e2', fal: cats[s.cat]?.accessible ? 0.75 : 0.9, col: hitIds.has(s.id) ? '#dc2626' : sel ? '#f97316' : s.locked ? '#111827' : '#475569', w: sel || hitIds.has(s.id) ? 0.14 : s.locked ? 0.1 : 0.04, hatch: s.valid ? null : '#dc2626', tag: s.valid ? 'stall' : 'invalid' });
    if (s.access) m.polys.push({ pts: s.access, fill: '#dbeafe', fal: 0.9, hatch: '#2563eb', col: '#2563eb', w: 0.03, tag: 'access' });
    if (!dimDone && s.valid && !cats[s.cat]?.accessible) { dimDone = true; m.labels.push({ p: G.centroid(s.poly), text: `${s.w} × ${s.l}`, size: 0.42, col: '#111827' }); } }
  const aisle0 = o.aisles.find((a) => a.kind === 'aisle'); if (aisle0) m.labels.push({ p: G.centroid(aisle0.poly), text: `${ctx.fmt(ST.pkGen.module.aisle, 1)} m aisle`, size: 0.5, col: '#475569' });
  P.ent.forEach((p) => m.dots.push({ p, col: '#16a34a', r: 0.7, label: 'E', al: 1, ring: true, tag: 'entrance' }));
  return m; }
function parkResult(ctx, R, obstacles, src, S, region) { const { ST, esc, fmt } = ctx; ST.pkRegion = region; ST.pkObs = obstacles; const box = (() => { const b = G.bbox(region.outer), pad = 10; return { x0: b.x0 - pad, y0: b.y0 - pad, x1: b.x1 + pad, y1: b.y1 + pad }; })();
  const cur = () => chosen(ST), paint = (r, fit) => { const o = cur(); ST.pkLast = o; show(ctx, box, parkMarks(ctx, o, S, box, r.view), fit); };
  const cats = Object.fromEntries(ST.pk.cats.map((c) => [c.id, c])), pct = (x) => `${fmt(x * 100, 0)} %`;
  const rowsOf = (o) => [['Stalls', `${o.total} in option ${o.label}`], ...Object.entries(o.byCat).map(([k, n]) => [`· ${esc((cats[k] || { name: k }).name)}`, `${n} (${pct(n / Math.max(1, o.total))})`]), ['Gross area', `${fmt(o.gross)} m²`], ['Stall area', `${fmt(o.stallArea)} m² (${pct(o.use)} of the area)`], ['Circulation', `${fmt(o.circArea)} m² (${pct(o.circShare)})`], ['Area per stall', `${fmt(o.gross / Math.max(1, o.total), 1)} m²`], ['Not reached', o.unreachedAisles ? `<span class="sp-bad">${o.unreachedAisles} aisle${o.unreachedAisles === 1 ? '' : 's'}</span> with no way from an entrance (no stalls there)` : 'every aisle reached from an entrance'], ['Invalid stalls', o.invalid ? `<span class="sp-bad">${o.invalid}</span> (hatched red, not counted)` : 'none']];
  const sections = () => { const o = cur(), sel = o.stalls.find((s) => s.id === ST.pk.sel), hit = ST.vehLast && ST.vehLast.pk === o.sig ? ST.vehLast.runs : null;
    return `<p class="sp-flabel">Options (${R.options.length} of ${R.candidates} layouts tried)</p><div class="sp-pkopts">${R.options.map((x) => `<button type="button" class="sp-pkopt" data-pk-opt="${x.label}" aria-pressed="${x.label === o.label}"><b>${x.label}</b><span>${x.total} stalls</span><small>${fmt(x.angle, 0)}° rows · use ${pct(x.use)} · aisles ${pct(x.circShare)}</small></button>`).join('')}</div>
      ${o.notes.length ? `<ul class="sp-sflist">${o.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      <p class="sp-flabel">Edit stalls</p><p class="sp-note">${ST.pkMsg ? esc(ST.pkMsg) : 'Pick a stall on the plan to change its type, remove it or lock it; locked stalls stay when the rest is generated again.'}</p>
      <div class="sp-acts sp-acts1"><button type="button" class="btn sm" data-pk="pickstall">Pick a stall</button>${ST.pk.locked.length ? `<button type="button" class="btn sm primary" data-pk="regen">Regenerate the unlocked</button><button type="button" class="btn sm" data-pk="unlockall">Unlock all</button>` : ''}</div>
      ${sel ? `<div class="sp-sfpick"><b>Stall ${esc(sel.id)} · ${esc(sel.name)}${sel.locked ? ' · locked' : ''}</b><div class="sp-kv"><span>Type</span><b><select class="sp-sel" data-pk="selcat" ${sel.locked ? 'disabled' : ''}>${ST.pk.cats.map((c) => `<option value="${c.id}" ${c.id === sel.cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></b></div><div class="sp-acts sp-acts1">${sel.locked ? '' : '<button type="button" class="btn sm" data-pk="lock">Lock</button><button type="button" class="btn sm" data-pk="del">Remove</button>'}</div><p class="sp-note">A changed type keeps the stall's size: check the row still fits it.</p></div>` : ''}
      <p class="sp-flabel">Check with a vehicle</p><p class="sp-note">${hit ? hit.map((h) => `Route ${h.route} (${esc(h.vehicle)}): ${h.stalls.length ? `<span class="sp-bad">${h.stalls.length} stall${h.stalls.length === 1 ? '' : 's'} hit or under the clearance</span> (red on the plan)` : 'no stall hit'}.`).join(' ') : 'Drive a vehicle through this layout: its stalls become obstacles in the Vehicle swept path.'}</p>
      <div class="sp-acts sp-acts1"><button type="button" class="btn sm" data-pk="checkveh">Check with a vehicle</button></div>
      <p class="sp-note">Obstacles: ${esc(src.join(', ') || 'none')}. Module ${fmt(R.module.depth, 2)} + ${fmt(R.module.aisle, 2)} + ${fmt(R.module.depth, 2)} m.</p>
      <p class="sp-note">The geometry, to use in CAD: <button type="button" class="sp-link" data-sa-exp="dxf">DXF</button> · <button type="button" class="sp-link" data-sa-exp="svg">SVG</button> · <button type="button" class="sp-link" data-sa-exp="json">JSON</button></p>`; };
  const probe = (x, y) => { const o = cur(), s = o.stalls.find((q) => G.inPoly([x, y], q.footprint || q.poly)); if (!s) return null; return `<div class="sp-kv"><span>Stall ${esc(s.id)}</span><b>${esc(s.name)}${s.locked ? ' · locked' : ''}</b></div><div class="sp-kv"><span>Size</span><b>${s.w} × ${s.l} m</b></div>${s.valid ? '' : `<p class="sp-note sp-bad">${esc(s.reason)}</p>`}`; };
  const layers = () => { const o = cur(), L = [{ name: 'PARKING_AREA', col: '#111827', w: 0.1, items: [{ pts: region.outer, closed: true }, ...region.holes.map((h) => ({ pts: h, closed: true }))] }, { name: 'OBSTACLES', col: '#374151', items: obstacles.map((q) => ({ pts: q.poly, closed: true })) }, { name: 'AISLES', col: '#94a3b8', items: o.aisles.map((a) => ({ pts: a.poly, closed: true })) }];
    for (const c of ST.pk.cats) { const its = o.stalls.filter((s) => s.valid && s.cat === c.id); if (its.length) L.push({ name: 'STALLS_' + c.id.toUpperCase(), label: `${c.name} stalls (${its.length})`, col: c.accessible ? '#2563eb' : '#475569', items: its.map((s) => ({ pts: s.poly, closed: true, fill: CATCOL[c.id] })) }); }
    const acc = o.stalls.filter((s) => s.valid && s.access); if (acc.length) L.push({ name: 'ACCESS_AISLES', col: '#2563eb', items: acc.map((s) => ({ pts: s.access, closed: true })) });
    L.push({ name: 'LABELS', col: '#111827', items: [], texts: [{ p: G.centroid(region.outer), text: `Option ${o.label}: ${o.total} stalls` }] }); return L; };
  const o0 = cur(); ST.pkLast = o0;
  const r = { X0: box.x0, Y0: box.y0, cell: 1, nx: 1, ny: 1, cells: 1, avg: o0.total, chartHTML: sections, probe, saLayers: layers, saRowsOf: () => rowsOf(cur()),
    views: { layout: { vals: new Float32Array([o0.total]), unit: 'stalls', lo: 0, hi: 1, dec: 0, avg: o0.total, title: `Parking layout · option ${o0.label}`, legendLabels: ['Stall', 'Accessible stall and access aisle', 'Aisle', 'Invalid (not counted)', 'Entrance'], legendCols: ['#e2e8f0', '#2563eb', '#f8fafc', '#dc2626', '#16a34a'] },
      types: { vals: new Float32Array([o0.total]), unit: 'stalls', lo: 0, hi: 1, dec: 0, avg: o0.total, title: 'Parking layout · stall types', legendLabels: ST.pk.cats.filter((c) => c.enabled).map((c) => c.name), legendCols: ST.pk.cats.filter((c) => c.enabled).map((c) => CATCOL[c.id] || '#e2e8f0') } },
    paint, foot: `${R.options.length} layout option${R.options.length === 1 ? '' : 's'} in ${fmt(o0.gross)} m², ${ST.pk.kind}`, rows: rowsOf(o0),
    method: `Rows of stall | aisle | stall modules (${fmt(R.module.depth, 2)} + ${fmt(R.module.aisle, 2)} + ${fmt(R.module.depth, 2)} m at ${R.angle}°) laid across the area in ${R.candidates} positions (row directions from the area's longest edges${ST.pk.kind === 'underground' ? ' and the column grid' : ''}, offsets across the module, seed ${ST.pk.seed}); aisles cut to the free floor, cross aisles at the ends of neighbouring aisles, and only aisles reached from an entrance keep stalls. Along each row the free runs are found and the stall types assigned exactly for those runs (${{ A: 'the most stalls', B: 'large first, then the rest', C: 'the target mix by dynamic programming across the runs', D: 'the most stalls, distinct options' }[ST.pk.mode]}); accessible stalls go nearest an entrance. Every stall is checked again: inside the area, clear of obstacles, aisles and other stalls, on a reached aisle. The best found by this search, not a proven optimum. Dimensions are the design assumptions set in the card, not a bylaw; accessible-stall rules are not checked against a code.`,
    results: { stalls: o0.total, byCat: o0.byCat, use: +o0.use.toFixed(3), option: o0.label }, settings: { kind: ST.pk.kind, angle: +ST.pk.angle, mode: ST.pk.mode, seed: +ST.pk.seed, label: `Parking layout, option ${o0.label} (Workspace)` } };
  return r; }
/** after an edit or another option: the rows and the plan again, without a new run */
export function refreshPark(ctx) { const ST = ctx.ST; if (!ST.res || !ST.res.saRowsOf) return; const o = chosen(ST); ST.pkLast = o; ST.res.rows = ST.res.saRowsOf(); ST.res.results = { stalls: o.total, byCat: o.byCat, use: +o.use.toFixed(3), option: o.label }; ST.res.settings.label = `Parking layout, option ${o.label} (Workspace)`; ctx.paintRes(ST.res); ctx.drawStudy(); }

// ---- the card's buttons and fields ----
export function onClick(e, ctx) { const ST = ctx.ST; if (ST.id !== VEH && ST.id !== PARK) return false; const b = e.target.closest('[data-sa], [data-va], [data-va-route], [data-va-zoom], [data-pk], [data-pk-kind], [data-pk-area], [data-pk-mode], [data-pk-opt], [data-sa-exp]'); if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT' || ST.busy) return false; const d = b.dataset;
  if (d.sa === 'finish') { sketchEnd(ctx, true); return true; } if (d.sa === 'cancel') { sketchEnd(ctx, false); return true; } if (d.sa === 'undo') { if (ST.sk) { ST.sk.pts.pop(); ctx.drawStudy(); preview(ctx); } return true; }
  if (d.saExp) { exportAs(ctx, d.saExp); return true; }
  if (d.vaRoute != null) { ST.va.cur = +d.vaRoute; ctx.drawStudy(); return true; }
  if (d.vaZoom != null) { ST.res && ST.res.saZoom && ST.res.saZoom(+d.vaZoom); return true; }
  if (d.va === 'draw') { sketchStart(ctx, 'route', ST.va.cur); return true; }
  if (d.va === 'clearroute') { const r = ST.va.routes[ST.va.cur]; r.pts = []; r.rev = []; r.radii = []; save(ST); ctx.drawStudy(); preview(ctx); return true; }
  if (d.va === 'drawobs') { sketchStart(ctx, 'vobs'); return true; } if (d.va === 'clearobs') { ST.va.drawn = []; save(ST); ctx.drawStudy(); preview(ctx); return true; }
  if (d.va === 'savecustom') { const v = vehOf(ST, ST.va.cur), name = (globalThis.prompt ? globalThis.prompt('A name for this vehicle', v.custom ? v.name : v.name + ' (mine)') : v.name + ' (mine)'); if (!name) return true; const list = V.loadCustom(), nv = v.custom && list.some((x) => x.id === v.id) ? { ...v, name } : V.duplicate(v, name); V.saveCustom([...list.filter((x) => x.id !== nv.id), nv]); ST.va.routes[ST.va.cur].veh = nv.id; delete ST.va.prof[ST.va.cur]; save(ST); ctx.drawStudy(); return true; }
  if (d.va === 'resetprof') { delete ST.va.prof[ST.va.cur]; save(ST); ctx.drawStudy(); return true; }
  if (d.pkKind) { ST.pk.kind = d.pkKind; save(ST); ctx.drawStudy(); preview(ctx); return true; } if (d.pkArea) { ST.pk.area = d.pkArea; save(ST); ctx.drawStudy(); preview(ctx); return true; } if (d.pkMode) { ST.pk.mode = d.pkMode; save(ST); ctx.drawStudy(); return true; }
  if (d.pkOpt) { ST.pk.opt = d.pkOpt; ST.pk.edits = {}; ST.pk.sel = null; save(ST); refreshPark(ctx); return true; }
  const P = ST.pk;
  if (d.pk === 'drawarea') { sketchStart(ctx, 'parea'); return true; } if (d.pk === 'drawhole') { sketchStart(ctx, 'phole'); return true; } if (d.pk === 'drawramp') { sketchStart(ctx, 'pramp'); return true; }
  if (d.pk === 'clearholes') { P.holes = []; P.ramps = []; save(ST); ctx.drawStudy(); preview(ctx); return true; } if (d.pk === 'addent') { sketchStart(ctx, 'entrance'); return true; } if (d.pk === 'clearent') { P.ent = []; save(ST); ctx.drawStudy(); preview(ctx); return true; }
  if (d.pk === 'pickstall') { ST.pkMsg = ''; sketchStart(ctx, 'pickstall'); return true; }
  if (d.pk === 'del' || d.pk === 'lock') { const o = chosen(ST), s = o && o.stalls.find((x) => x.id === P.sel); if (!s) return true; if (d.pk === 'lock') P.locked.push({ cat: s.cat, name: s.name, w: s.w, l: s.l, poly: s.poly, footprint: s.footprint, access: s.access }); P.edits[s.id] = { del: true }; P.sel = null; save(ST); refreshPark(ctx); return true; }
  if (d.pk === 'unlockall') { P.locked = []; save(ST); refreshPark(ctx); return true; }
  if (d.pk === 'regen') { ctx.run(); return true; }
  if (d.pk === 'checkveh') { ST.va.obs.parking = true; save(ST); ctx.openStudy(VEH); return true; }
  return false; }
export function onChange(e, ctx) { const ST = ctx.ST; if (ST.id !== VEH && ST.id !== PARK) return false; const t = e.target, d = t.dataset, A = ST.va, P = ST.pk, i = A.cur, val = t.type === 'checkbox' ? t.checked : t.value;
  if (d.va === 'veh') { if (t.value === 'custom') { A.routes[i].veh = 'custom'; A.prof[i] = { ...JSON.parse(JSON.stringify(V.CUSTOM_BASE)) }; } else { A.routes[i].veh = t.value; delete A.prof[i]; } }
  else if (d.vaP) { const v = A.prof[i] || vehOf(ST, i); v[d.vaP] = +t.value; if (d.vaP === 'length') { /* the length is shown; the overhangs and wheelbase drive the outline */ } A.prof[i] = v; }
  else if (d.vaT) { const v = A.prof[i] || vehOf(ST, i); v.trailer[d.vaT] = +t.value; A.prof[i] = v; }
  else if (d.va === 'on2') A.routes[1].on = !!val; else if (d.va === 'speed') A.routes[i].speed = t.value; else if (d.va === 'delay') A.routes[i].delay = t.value; else if (d.va === 'clear') A.clear = +t.value || 0.3;
  else if (d.vaObs) A.obs[d.vaObs] = !!val; else if (d.vaRev != null) A.routes[i].rev[+d.vaRev] = !!val; else if (d.vaRad != null) A.routes[i].radii[+d.vaRad] = t.value === '' ? null : +t.value;
  else if (d.pkCat != null) { const c = P.cats[+d.pkCat], k = d.k; c[k] = k === 'enabled' ? !!val : k === 'share' ? (t.value === '' ? null : +t.value / 100) : +t.value; }
  else if (d.pk === 'angle') { P.angle = +t.value; } else if (d.pk === 'aisle') P.aisle = t.value; else if (d.pk === 'oneway') P.oneWay = !!val; else if (d.pk === 'setback') P.setback = +t.value || 0; else if (d.pk === 'wall') P.wall = +t.value || 0;
  else if (d.pk === 'seed') P.seed = Math.max(1, Math.round(+t.value || 1));
  else if (d.pk === 'selcat') { if (P.sel) { P.edits[P.sel] = { cat: t.value }; save(ST); refreshPark(ctx); } return true; }
  else return false;
  save(ST); ctx.drawStudy(); if (!ST.res) preview(ctx); return true; }

// ---- exports ----
function exportAs(ctx, kind) { const ST = ctx.ST, r = ST.res; if (!r || !r.saLayers) return; const L = r.saLayers(), base = (ST.id === VEH ? 'swept-path' : 'parking-layout') + '-' + new Date().toISOString().slice(0, 10);
  const note = ST.id === VEH ? 'Kinematic screening for early design; not a certified swept-path or fire-access study.' : 'Layout screening for early design; dimensions are design assumptions, not a bylaw.';
  if (kind === 'svg') return dl(base + '.svg', CAD.svg(L, { title: r.views[r.view || Object.keys(r.views)[0]].title, note }), 'image/svg+xml');
  if (kind === 'dxf') return dl(base + '.dxf', CAD.dxf(L), 'application/dxf');
  const o = ST.id === VEH ? { study: 'Vehicle swept path', note, settings: { routes: ST.va.routes, vehicles: (r.saRuns || []).map((x) => x.vehicle), clearance: +ST.va.clear }, results: (r.saRuns || []).map((x) => ({ route: x.routeNo + 1, status: x.status, reasons: x.reasons, length: x.length, rMin: x.rMin, rReached: x.rReached, minClear: x.minClear, collisions: x.collisions, tooNear: x.tooNear, infeasible: x.infeasible, swept: x.swept, cell: x.cell, envelope: x.envelope.loops, path: x.poses.filter((_, i) => i % 4 === 0).map((p) => [+p.x.toFixed(3), +p.y.toFixed(3), +p.th.toFixed(4)]) })), pair: r.saPair }
    : (() => { const c = chosen(ST); return { study: 'Parking layout', note, settings: { ...ST.pk, sel: undefined }, option: { label: c.label, total: c.total, byCat: c.byCat, gross: c.gross, stallArea: c.stallArea, circArea: c.circArea, use: c.use, notes: c.notes, stalls: c.stalls.map((s) => ({ id: s.id, cat: s.cat, valid: s.valid, reason: s.reason, locked: !!s.locked, poly: s.poly })), aisles: c.aisles } }; })();
  dl(base + '.json', JSON.stringify(o, null, 1), 'application/json'); }
function dl(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
