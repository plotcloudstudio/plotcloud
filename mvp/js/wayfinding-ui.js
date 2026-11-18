// The Wayfinding card in the Workspace (2026-11-18): settings (starts, destinations, visitor access, pedestrian, existing signs,
// weights), the drawing (routes with arrows, starts, decision points by sign priority with their facing, existing signs; sign panels
// in 3D) and the results (points ranked by the Signage Priority Score, each with its reason and factors; routes with no valid way;
// destination entrances and the Room Entrance View). The analysis is interior/wayfinding-signage.js; this module only presents it.
import * as WS from './interior/wayfinding-signage.js?v=wfsign-20261118-5';

export const VIEWS = [['signs', 'Sign priority'], ['routes', 'Routes'], ['depth', 'Visual depth']];
const KIND = { lift: 'L', stair: 'S', entrance: 'E', manual: 'M' };

/** the settings, with their defaults filled in */
export function settings(ST) { ST.wayStart ||= 'all'; ST.wayDest ||= { mode: 'all', groups: [], rooms: [], other: false }; ST.wayAccess ||= {}; ST.wayGroupsSet ||= {}; ST.wayManual ||= []; ST.waySigns ||= [];
  ST.wayW ||= { ...WS.DEFAULT_WEIGHTS }; if (ST.wayThr == null) ST.wayThr = 35; if (ST.waySpeed == null) ST.waySpeed = 1.2; if (ST.wayAcc == null) ST.wayAcc = false; return ST; }
/** the options for the analysis */
export function optsOf(ST, lvId, precise) { settings(ST); return { level: lvId, starts: ST.wayStart === 'all' ? 'all' : [ST.wayStart], dest: { mode: ST.wayDest.mode, groups: ST.wayDest.groups, rooms: ST.wayDest.rooms, otherFloors: !!ST.wayDest.other },
  access: ST.wayAccess, groups: ST.wayGroupsSet, accessible: !!ST.wayAcc, eye: +ST.wayEye || 1.6, furn: !!ST.wayFurn, precise, manual: ST.wayManual.filter((m) => m.lv === lvId), signs: ST.waySigns.filter((g) => g.lv === lvId), weights: ST.wayW, threshold: +ST.wayThr }; }
/** what the settings need before a run: the starts on this floor, the groups and rooms (with their access) */
export function preview(building, lvId, ST) { settings(ST); const lv = building.levels.find((l) => l.id === lvId) || building.levels[0]; if (!lv) return null;
  const lvs = building.levels.slice().sort((a, b) => a.z - b.z), ground = (lvs.filter((l) => l.z > -0.5).sort((a, b) => Math.abs(a.z) - Math.abs(b.z))[0] || lvs[0]).id;
  const F = WS.prepare(lv.sc, { access: ST.wayAccess, groups: ST.wayGroupsSet, precise: false }), starts = WS.startsOf(F, { stairs: (building.stairs || []).filter((s) => s.lv === lv.id || s.top === lv.id), ground: lv.id === ground, manual: ST.wayManual.filter((m) => m.lv === lv.id) });
  const rooms = F.rooms.filter((r) => !r.circ).map((r) => ({ name: r.name, group: r.group, staff: r.staff })), groups = {}; for (const r of rooms.filter((x) => !x.staff)) (groups[r.group] ||= []).push(r.name);
  return { lv, ground: lv.id === ground, starts, rooms, groups, origin: lv.sc.origin || [0, 0] }; }

/** the settings in the card */
export function settingsHTML(P, ST, esc) { settings(ST); if (!P) return '<p class="sp-note">The model is still loading.</p>';
  const S = P.starts, D = ST.wayDest, opt = (v, n, cur) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(n)}</option>`, check = (attr, v, on, label) => `<label class="sp-check"><input type="checkbox" ${attr}="${esc(v)}" ${on ? 'checked' : ''}> ${label}</label>`;
  const startsHTML = S.length ? `<select class="sp-sel" data-way="start">${opt('all', `All on this floor (${S.length}: ${S.filter((s) => s.kind === 'lift').length} lift, ${S.filter((s) => s.kind === 'stair').length} stair${P.ground ? `, ${S.filter((s) => s.kind === 'entrance').length} entrance` : ''})`, ST.wayStart)}${S.map((s) => opt(s.id, s.name, ST.wayStart)).join('')}</select>`
    : '<p class="sp-note sp-warn">No lift, stair or entrance was recognised on this floor. Set a start by hand: a lift lobby or a stair landing.</p>';
  const groupList = Object.entries(P.groups).sort((a, b) => a[0].localeCompare(b[0]));
  const destHTML = `<div class="sp-tabs" role="tablist">${[['all', 'Every room'], ['groups', 'Groups'], ['rooms', 'Rooms']].map(([k, n]) => `<button type="button" role="tab" data-way-dmode="${k}" aria-selected="${D.mode === k}">${n}</button>`).join('')}</div>
    ${D.mode === 'groups' ? `<div class="sp-wfl">${groupList.map(([g, rs]) => check('data-way-grp', g, D.groups.includes(g), `${esc(g)} <small>(${rs.length})</small>`)).join('')}</div>` : ''}
    ${D.mode === 'rooms' ? `<div class="sp-wfl">${P.rooms.filter((r) => !r.staff).map((r) => check('data-way-room', r.name, D.rooms.includes(r.name), esc(r.name))).join('')}</div>` : ''}
    ${check('data-way', 'other', D.other, 'Also rooms on other floors (by a lift or stair paired between the floors)')}`;
  const access = `<details class="sp-adv" data-adv="wayAccess" ${ST.advOpen?.wayAccess ? 'open' : ''}><summary>Visitor access (${P.rooms.filter((r) => r.staff).length} rooms staff only)</summary><p class="sp-note">Rooms with no public access are not destinations and routes do not pass through them. Read from the room names until you change them.</p>
    <div class="sp-wfl">${P.rooms.map((r) => check('data-way-acc', r.name, !r.staff, `${esc(r.name)} <small>${r.staff ? 'staff only' : 'public'}</small>`)).join('')}</div></details>`;
  const signs = ST.waySigns.filter((g) => g.lv === P.lv.id);
  return `<p class="sp-flabel">Start (${esc(P.lv.name)}: change the floor in the Level menu)</p>${startsHTML}
    <div class="sp-acts sp-acts1"><button type="button" class="btn sm" data-way="pickstart">${ST.wayPick === 'start' ? 'Click the plan…' : '＋ Set a start by hand'}</button>${ST.wayManual.some((m) => m.lv === P.lv.id) ? '<button type="button" class="btn sm" data-way="nomanual">Remove hand-set starts</button>' : ''}</div>
    <p class="sp-flabel">Destinations</p>${destHTML}${access}
    <p class="sp-flabel">Pedestrian</p><div class="sp-two"><label class="sp-field">Walking speed, m/s<input type="number" data-st-num="waySpeed" min="0.4" max="2" step="0.1" value="${ST.waySpeed}"></label><label class="sp-field">Priority shown from<input type="number" data-st-num="wayThr" min="0" max="90" step="5" value="${ST.wayThr}"></label></div>
    ${check('data-way', 'acc', ST.wayAcc, 'Accessible route only (doors 0.85 m or wider; lifts between floors)')}${check('data-way', 'furn', ST.wayFurn, 'Furniture is in the way when walking')}
    <p class="sp-flabel">Existing signs on this floor (${signs.length})</p><div class="sp-acts sp-acts1"><button type="button" class="btn sm" data-way="addsign">${ST.wayPick === 'sign' ? 'Click where it is…' : ST.wayPick === 'signface' ? 'Click the way it faces…' : '＋ Add an existing sign'}</button>${signs.length ? '<button type="button" class="btn sm" data-way="nosigns">Remove them</button>' : ''}</div>
    <details class="sp-adv" data-adv="wayW" ${ST.advOpen?.wayW ? 'open' : ''}><summary>Score weights</summary><div class="sp-two">${[['A', 'Decision complexity'], ['B', 'Route importance'], ['C', 'Visibility'], ['D', 'Destination ambiguity'], ['F', 'Wrong-turn cost']].map(([k, n]) => `<label class="sp-field">${k} · ${n}<input type="number" data-way-w="${k}" min="0" max="100" step="5" value="${ST.wayW[k]}"></label>`).join('')}</div><p class="sp-note">E, an existing sign in sight and facing the approach, removes the need at that point.</p></details>`;
}

// arrow heads along a route every 6 m (two short strokes), for the direction of walking
function arrows(pts, toP, col) { const out = []; let acc = 0, next = 3; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!L) continue; const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    while (next <= acc + L) { const t = next - acc, p = [a[0] + u[0] * t, a[1] + u[1] * t], l = [-u[1], u[0]], tip = toP(p);
      for (const s of [-1, 1]) out.push({ pts: [toP([p[0] - u[0] * 0.45 + l[0] * 0.3 * s, p[1] - u[1] * 0.45 + l[1] * 0.3 * s]), tip], col, w: 0.06, al: 0.9 }); next += 6; } acc += L; } return out; }

/** the result for the Workspace study card */
export function resultOf(A, depthRun, ctx) {
  const { esc, fmt, ST, views2, stopsOf, DEPTH } = ctx, o = A.F.SC.origin || [0, 0], toP = (p) => [p[0] + o[0], p[1] + o[1]], R = A.F.R, X0 = o[0] + R.x0, Y0 = o[1] + R.y0, z = A.F.SC.settings?.floorZ || 0;
  const box = { x0: X0, y0: Y0, x1: X0 + R.W * R.c, y1: Y0 + R.H * R.c }, ok = A.routes.filter((r) => !r.noRoute && r.pts), none = A.routes.filter((r) => r.noRoute), rec = A.nodes.filter((n) => n.recommended);
  const depth = depthRun ? depthRun.RES : null, nan = new Float32Array(R.W * R.H).fill(NaN);
  const paint = (r, fit, focus) => { const sel = A.nodes.find((n) => n.no === ST.waySel), signsView = r.view === 'signs';
    const paths = [...ok.map((x) => ({ pts: x.pts.map(toP), col: r.view === 'routes' ? '#3b6fb6' : '#64748b', w: r.view === 'routes' ? 0.1 : 0.05, al: r.view === 'routes' ? 0.8 : 0.45 })), ...(r.view === 'routes' ? ok.flatMap((x) => arrows(x.pts, toP, '#3b6fb6')) : [])];
    if (sel) for (const q of sel.passes) paths.push({ pts: q.r.pts.map(toP), col: '#f97316', w: 0.12, al: 0.9 });
    for (const n of A.nodes) if ((signsView ? n.score >= +ST.wayThr || n === sel : n.recommended)) { const f = n.faceDeg * Math.PI / 180, p = toP(n.p); paths.push({ pts: [p, [p[0] + Math.cos(f) * 1.3, p[1] + Math.sin(f) * 1.3]], col: n.col, w: 0.14, al: 1 }); }
    for (const g of A.signs) { const f = g.face * Math.PI / 180, p = toP(g.p); paths.push({ pts: [p, [p[0] + Math.cos(f) * 1.0, p[1] + Math.sin(f) * 1.0]], col: '#111827', w: 0.1, al: 1 }); }
    const dots = [...A.chosen.map((s) => ({ p: toP(s.p), col: '#111827', r: 0.5, label: KIND[s.kind] || 'S', ring: true, al: 1 })),
      ...ok.filter((x) => x.door).map((x) => ({ p: toP(x.door.m), col: '#3b6fb6', r: 0.16, al: 1 })),
      ...A.nodes.filter((n) => (signsView ? n.score >= +ST.wayThr || n === sel : true)).map((n) => ({ p: toP(n.p), col: signsView || n.recommended ? n.col : '#d1d5db', r: n === sel ? 0.75 : n.cls === 'High' ? 0.6 : 0.48, label: String(n.no), ink: '#111', ring: n.unresolved || n === sel, al: 1 })),
      ...A.signs.map((g) => ({ p: toP(g.p), col: '#111827', r: 0.28, square: true, label: 'i', al: 1 }))];
    const fbox = focus ? { x0: focus[0] - 8, y0: focus[1] - 8, x1: focus[0] + 8, y1: focus[1] + 8 } : box;
    views2().forEach((w2) => { w2.clearStudy?.(); w2.walkShow?.({ walks: [], T: 0, box: fbox, lv: w2.level?.(), z, view: r.view === 'depth' ? 'depth' : 'routes', fit: !!fit || !!focus, fit2: !!fit || !!focus, solid: false, paths, dots,
      density: { X0: depth ? o[0] + depth.R.x0 : X0, Y0: depth ? o[1] + depth.R.y0 : Y0, cell: depth ? depth.R.c : R.c, nx: depth ? depth.R.W : R.W, ny: depth ? depth.R.H : R.H, vals: r.view === 'depth' && depth ? depth.depth : depth ? new Float32Array(depth.R.W * depth.R.H).fill(NaN) : nan, lo: 0, hi: 3 }, rampStops: stopsOf(DEPTH) });
      w2.signShow?.(rec.map((n) => ({ p: toP(n.p), face: n.faceDeg, col: n.col, z }))); }); };
  // walking each route in turn: the decision points on it light up (the existing timeline, on the new routes)
  const onR = (n, x) => n.passes.some((q) => q.r === x), lenOf = (P) => P.reduce((t, q, i) => (i ? t + Math.hypot(q[0] - P[i - 1][0], q[1] - P[i - 1][1]) : 0), 0);
  const timeline = ok.length ? { n: ok.length, ms: 3200, label: (i) => { const x = ok[i], nd = A.nodes.filter((n) => onR(n, x)); return `${x.start.name} → ${x.room.name}${x.floor ? ` (${x.floor}, by the ${x.viaKind})` : ''} · ${fmt(x.len, 1)} m · ${nd.length} decision point${nd.length === 1 ? '' : 's'}${nd.length ? ` (${nd.map((n) => n.no).join(', ')})` : ''} · about ${fmt(x.len / (+ST.waySpeed || 1.2) / 60, 1)} min`; },
    show: (i) => { const x = ok[i], P = x.pts.map(toP); views2().forEach((w2) => w2.walkShow?.({ walks: [], agents: [{ pts: P, len: lenOf(P) }], T: 0, box, lv: w2.level?.(), z, view: 'routes', fit: false, fit2: false, solid: false,
        paths: [...ok.map((y) => ({ pts: y.pts.map(toP), col: '#94a3b8', w: 0.05, al: 0.5 })), { pts: P, col: '#f97316', w: 0.16, al: 1 }, ...arrows(x.pts, toP, '#f97316')],
        dots: [...A.chosen.map((s) => ({ p: toP(s.p), col: '#111827', r: 0.5, label: KIND[s.kind] || 'S', ring: true, al: 1 })), ...A.nodes.map((n) => ({ p: toP(n.p), col: onR(n, x) ? n.col : '#d1d5db', r: onR(n, x) ? 0.6 : 0.36, label: String(n.no), ink: '#111', ring: onR(n, x), al: 1 }))],
        density: { X0, Y0, cell: R.c, nx: R.W, ny: R.H, vals: nan, lo: 0, hi: 3 }, rampStops: stopsOf(DEPTH) })); },
    reset: () => { if (ST.res) ctx.paintRes(ST.res); } } : null;
  const scoreVals = Float32Array.from(A.nodes.map((n) => n.score)), pct = (x) => `${Math.round(x * 100)} %`;
  const row = (n) => `<tr class="${ST.waySel === n.no ? 'sp-wfsel' : ''}"><td><button type="button" class="sp-link" data-way-sel="${n.no}">${n.no}</button></td><td><i class="sp-wfdot" style="background:${n.col}"></i>${n.score}</td><td>${esc(n.exitOf ? `${{ lift: 'Lift', stair: 'Stair', entrance: 'Entrance', manual: 'Start' }[n.exitOf.kind] || 'Start'} exit` : n.kind === 'turn' ? 'Turn' : n.br.length >= 3 ? `${n.br.length}-way junction` : 'Corridor joint')}</td><td>${n.recommended ? esc(n.signType) : n.f.E ? 'covered' : 'no sign needed'}</td></tr>`;
  const detail = (n) => { if (!n) return ''; const F = n.factors, W = A.weights;
    return `<div class="sp-sfpick sp-wfdetail"><b>Point ${n.no} · ${n.cls} priority · ${n.score}/100</b>
      <div class="sp-kv"><span>Recommended sign</span><b>${n.recommended ? esc(n.signType) : n.f.E ? 'covered by an existing sign' : 'none needed'}</b></div>
      <div class="sp-kv"><span>Orientation</span><b>${esc(n.facing)} (${n.faceDeg}°)</b></div>
      ${n.ways.map((w) => `<div class="sp-kv"><span>${esc(w.rel)} <small>(${w.angle > 0 ? '+' : ''}${w.angle}°)</small></span><b>${esc(w.to.join(', '))}</b></div>`).join('')}
      <div class="sp-kv"><span>Visibility</span><b>${n.meta.notSeen ? `way on out of sight for ${n.meta.notSeen} of ${n.meta.wsum}${n.meta.hidden.length ? ` (${esc(n.meta.hidden.slice(0, 4).join(', '))})` : ''}` : 'the way on is in sight'}</b></div>
      ${n.also.length ? `<div class="sp-kv"><span>Also</span><b>${esc(n.also.join('; '))}</b></div>` : ''}
      <p class="sp-note"><b>Why:</b> ${esc(n.reason)}</p>
      <table class="sp-codesum sp-wffac"><thead><tr><th>Factor</th><th>Value</th><th>Weight</th></tr></thead><tbody>${[['A', 'Decision complexity'], ['B', 'Route importance'], ['C', 'Visibility (hidden share)'], ['D', 'Destination ambiguity'], ['F', 'Wrong-turn cost']].map(([k, nm]) => `<tr><td>${k} · ${nm}</td><td>${F[k].toFixed(2)}</td><td>${W[k]}</td></tr>`).join('')}<tr><td>E · Existing coverage</td><td>${F.E}</td><td>× (1 − E)</td></tr></tbody></table>
      <p class="sp-note">Score = 100 × Σ(weight × factor) / Σ weights × (1 − E). A: (ways − 1)/3, +0.2 if two ways are within 45°. B: routes here / the most at any point. C: share of routes whose way on (3 m past) and destination door are out of sight 5 m before. D: 1 − the largest way's share of the destinations, +0.25 if one kind of room lies down different ways. F: mean extra walk of a wrong turn (there and back, to the next point) / 40 m.</p></div>`; };
  const entr = A.entrances;
  const sections = () => { const eSel = entr.find((e) => e.room === ST.wayRoom) || null; return `<p class="sp-flabel">Decision points by sign priority (${A.nodes.length}; shown from ${ST.wayThr})</p>
      <table class="sp-codesum sp-sched sp-wftab"><thead><tr><th>#</th><th>Score</th><th>Where</th><th>Sign</th></tr></thead><tbody>${A.nodes.map(row).join('')}</tbody></table>${detail(A.nodes.find((n) => n.no === ST.waySel))}
    ${none.length ? `<p class="sp-flabel">No valid route (${none.length})</p><ul class="sp-sflist">${none.map((x) => `<li><b>${esc(x.room.name)}</b>${x.floor ? ` (${esc(x.floor)})` : ''} from ${esc(x.start.name)}: ${esc(x.reason)}</li>`).join('')}</ul>` : ''}
    ${entr.length ? `<p class="sp-flabel">Destination entrance</p><select class="sp-sel" data-way="room">${['', ...new Set(entr.map((e) => e.room))].map((nm) => `<option value="${esc(nm)}" ${nm === (ST.wayRoom || '') ? 'selected' : ''}>${nm ? esc(nm) : 'Choose a room…'}</option>`).join('')}</select>
      ${eSel ? `<div class="sp-kv"><span>Door in sight from</span><b>${fmt(eSel.seenFrom, 1)} m before it</b></div><div class="sp-kv"><span>A sign beside the door, read square-on</span><b>${eSel.flushFrom ? `from ${fmt(eSel.flushFrom, 1)} m` : 'not on the approach'}</b></div><div class="sp-kv"><span>Similar doors within 8 m</span><b>${eSel.similar}</b></div><p class="sp-note">${esc(eSel.verdict)}</p>
        <div class="sp-acts sp-acts1"><button type="button" class="btn sm" data-way="entry" data-v="in">Room Entrance View</button><button type="button" class="btn sm" data-way="entry" data-v="out">From the door</button><button type="button" class="btn sm" data-way="entry" data-v="off">Leave the view</button></div>` : ''}` : ''}` };
  const probe = (x, y) => { const q = [x - o[0], y - o[1]], n = A.nodes.slice().sort((a, b) => Math.hypot(a.p[0] - q[0], a.p[1] - q[1]) - Math.hypot(b.p[0] - q[0], b.p[1] - q[1]))[0];
    if (n && Math.hypot(n.p[0] - q[0], n.p[1] - q[1]) < 1.6) return `<div class="sp-kv"><span>Point ${n.no}</span><b>${n.score} · ${n.cls}</b></div><div class="sp-kv"><span>Sign</span><b>${n.recommended ? esc(n.signType) : 'none needed'}</b></div><p class="sp-note">${esc(n.reason)}</p>`;
    if (depth) { const i = Math.floor((x - o[0] - depth.R.x0) / depth.R.c), j = Math.floor((y - o[1] - depth.R.y0) / depth.R.c); if (i >= 0 && j >= 0 && i < depth.R.W && j < depth.R.H) { const d = depth.depth[j * depth.R.W + i]; if (Number.isFinite(d)) return `<div class="sp-kv"><span>Visual depth</span><b>${d}</b></div>`; } } return null; };
  const st = A.stats;
  return { X0, Y0, cell: R.c, nx: R.W, ny: R.H, cells: R.W * R.H, avg: st.high, timeline, chartNote: 'Decision points by Signage Priority Score; hover a bar for its value.', frameA: null, wayA: A, wayFocus: (n) => paint(ST.res, false, toP(n.p)),
    foot: `${ok.length} routes from ${A.chosen.length} start${A.chosen.length === 1 ? '' : 's'} on ${esc(A.level.name)}, ${A.nodes.length} decision points`,
    views: { signs: { vals: scoreVals, unit: 'priority score', ramp: 'risk', lo: 0, hi: 100, dec: 0, avg: st.high, title: 'Wayfinding · sign priority', legendLabels: ['High (60+)', 'Medium (35–59)', 'Low'], legendCols: ['#3f9d5a', '#e0a020', '#d8402a'] },
      routes: { vals: scoreVals, unit: 'routes', ramp: 'risk', lo: 0, hi: 100, dec: 0, avg: st.routes, title: 'Wayfinding · routes from the starts', legendLabels: ['Route, with its direction', 'Decision point', 'Start (L lift, S stair, E entrance)'], legendCols: ['#111827', '#e0a020', '#3b6fb6'] },
      depth: { vals: depth ? depth.depth : nan, unit: 'look-arounds', ramp: 'heat', lo: 0, hi: 3, dec: 0, avg: 0, title: 'Wayfinding · visual depth from the first start', legendLabels: ['3 or more', '1 · 2', '0 · in sight'], legendCols: stopsOf(DEPTH).map((x) => x[1]) } },
    paint: (r, fit) => paint(r, fit), probe,
    chartHTML: sections,
    rows: [['Decision points', `${st.points} on the visitor routes`], ['High priority', `<span class="${st.high ? 'sp-bad' : ''}">${st.high}</span> · Medium ${st.medium} · Low ${st.low}`], ['Recommended signs', String(st.recommended)], ['Unresolved', `${st.unresolved} (High, with the way on out of sight)`],
      ['Signage coverage', `${pct(st.coverage)} of the choices at junctions and lift, stair or entrance exits`], ['Routes', `${st.routes} from ${A.chosen.length} start${A.chosen.length === 1 ? '' : 's'} (${['lift', 'stair', 'entrance', 'manual'].map((k) => [k, A.chosen.filter((s) => s.kind === k).length]).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(', ')})`], ['No valid route', st.noRoute ? `<span class="sp-bad">${st.noRoute}</span>` : 'none'],
      ...(A.legs.length ? [['Other floors', `${A.legs.length} route${A.legs.length > 1 ? 's' : ''} by ${[...new Set(A.legs.map((l) => l.kind))].join(' and ')}`]] : [])],
    method: `From the lift lobbies, stair landings${A.ground ? ' and entrances' : ''} chosen: the shortest walk to each destination's door over real floor (${fmt(A.cell, 2)} m grid, 8 directions, no cutting corners; walls, doors and rooms with no public access as drawn${ST.wayAcc ? '; accessible: doors 0.85 m or wider, lifts between floors' : ''}). The public floor is thinned to its centre lines; junctions, turns and the exits of the starts are the candidate points. Each gets a Signage Priority Score from five factors (complexity, route importance, visibility at eye ${ST.wayEye} m, destination ambiguity, wrong-turn cost; the weights in the card) and existing signs in sight and facing the approach. Groups are read from the room names. A screening for early design: it ranks where signs are most needed; it is not a measured navigation success rate.`,
    results: { points: st.points, high: st.high, recommended: st.recommended, unresolved: st.unresolved, coverage: +st.coverage.toFixed(3), noRoute: st.noRoute },
    settings: { starts: A.chosen.map((s) => s.name), dest: ST.wayDest, accessible: !!ST.wayAcc, eye: +ST.wayEye, weights: A.weights, threshold: A.threshold, signs: A.signs.length, label: `Wayfinding signage from ${A.chosen.length} start${A.chosen.length === 1 ? '' : 's'} (Workspace)` } };
}
