// The frame analysis in the Workspace structure study (2026-11-18): what the card lists and what the 3D and plan views draw.
// Members as tubes coloured on the structure ramp (blue → white → orange → red) along their length, force diagrams as translucent
// flags, the deformed shape over the original at a chosen scale, supports, braces added by hand (a preview, then a real member).
// No DOM here beyond HTML strings; the Workspace passes its helpers (fmt, esc, rampHex) in.
import { braceBays } from './structure-frame.js?v=frame-20261118-2';

export const FVIEWS = [['M', 'Moment M'], ['N', 'Axial N'], ['V', 'Shear V'], ['T', 'Torsion T'], ['disp', 'Displacement'], ['sigma', 'Normal stress'], ['vm', 'von Mises'], ['util', 'Capacity used'], ['sys', 'System and supports']];
export const LAYOUT_VIEWS = [['load', 'Column load'], ['size', 'Column size'], ['pressure', 'Foundation'], ['depth', 'Floor depth']];
export const CASES = [['gravity', 'Gravity'], ['wind', 'Wind'], ['sls', 'Service'], ['drift', 'Sway']];
const STATION = { M: 1, N: 1, V: 1, T: 1, disp: 1 };
const KIND_COL = { column: '#475569', beam: '#2f5fd0', strip: '#8fb8ea', brace: '#f2a24a' };
const RADIUS = { column: 0.11, beam: 0.08, strip: 0.06, brace: 0.05 };

/** the case a station view shows: the chosen one, or the gravity case; displacement defaults to service */
export function caseOf(A, view, chosen) { const k = chosen || (view === 'disp' ? 'sls' : 'gravity'); return A.gov[k] || A.gov.gravity; }

const absMax = (a) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const stVal = (view, s) => (view === 'disp' ? Math.hypot(s.d[0], s.d[1], s.d[2]) * 1000 : s[view]);

/**
 * The views of a frame result: per shown member (not the hidden floor diaphragms) its value, for the legend and the histogram.
 * Station views read the chosen load case; stresses and capacity are the envelope of every factored combination.
 */
export function frameViews(A, chosen) {
  const shown = A.members.filter((m) => !m.hidden), out = {};
  for (const [k] of FVIEWS) {
    if (k === 'sys') { out.sys = { vals: Float32Array.from(shown.map((m) => ({ column: 0, beam: 1, strip: 1, brace: 2 }[m.kind] ?? 1))), unit: 'members', ramp: 'structure', lo: 0, hi: 2, dec: 0, title: 'Structure · system, supports and loads', legendLabels: ['Braces', 'Beams and slab strips', 'Columns'], legendCols: [KIND_COL.column, KIND_COL.beam, KIND_COL.brace] }; continue; }
    if (STATION[k]) { const cid = caseOf(A, k, chosen), per = shown.map((m) => { const st = m.stations[cid] || []; if (k === 'N') { const v = st.map((s) => s.N); return v.length ? v.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a)) : 0; } return absMax(st.map((s) => stVal(k, s))); });
      const mx = Math.max(1e-6, absMax(per)), name = (A.combos.find((c) => c.id === cid) || {}).name || cid;
      const U = { M: ['kN·m', 'bending moment'], N: ['kN, − compression · + tension', 'axial force'], V: ['kN', 'shear force'], T: ['kN·m', 'torsion'], disp: ['mm', 'displacement'] }[k];
      out[k] = { vals: Float32Array.from(per), unit: U[0], ramp: 'structure', lo: k === 'N' ? -mx : 0, hi: mx, dec: mx < 10 ? 1 : 0, title: `Structure · ${U[1]} · ${name}`, caseId: cid, max: mx }; continue; }
    const f = { sigma: (m) => m.s, vm: (m) => m.vm, util: (m) => m.util * 100 }[k], per = shown.map(f), mx = Math.max(1e-6, ...per);
    out[k] = k === 'util' ? { vals: Float32Array.from(per), unit: '% of capacity (screening)', ramp: 'structure', lo: 0, hi: 100, dec: 0, title: 'Structure · capacity used · every factored combination' }
      : { vals: Float32Array.from(per), unit: 'MPa', ramp: 'structure', lo: 0, hi: mx, dec: mx < 10 ? 1 : 0, title: `Structure · ${k === 'sigma' ? 'normal stress' : 'von Mises stress'} · envelope` };
  }
  for (const k in out) { const v = out[k].vals; let s = 0; for (const x of v) s += x; out[k].avg = v.length ? s / v.length : 0; out[k].frame = true; }
  return out;
}

/** how far the deformed shape is drawn: the chosen factor, or "auto": the largest movement about 1/20 of the building */
export function autoScale(A, cid, size) { let mx = 0; for (const m of A.members) for (const s of m.stations[cid] || []) mx = Math.max(mx, Math.hypot(s.d[0], s.d[1], s.d[2])); return mx > 1e-9 ? Math.max(1, Math.min(2000, Math.round(size / 20 / mx))) : 1; }

/**
 * What structFrame draws for a view.
 * @param o { view, caseId, f (load share 0–1, for ▶ Play), scale (deformation), flags, deformed, showModel, bays, rampHex, size }
 */
export function frameDrawing(A, V, o) {
  const shown = A.members.filter((m) => !m.hidden), view = o.view, f = o.f ?? 1, R = (t) => o.rampHex('structure', t), Hf = Math.min(2.5, Math.max(0.6, o.size * 0.06));
  const members = shown.map((m, i) => {
    const st0 = m.stations[o.caseId] || m.stations[Object.keys(m.stations)[0]] || [];
    const st = st0.map((s) => { let c, h = 0;
      if (view === 'sys') c = KIND_COL[m.kind] || '#64748b';
      else if (STATION[view]) { const v = stVal(view, s) * f; c = view === 'N' ? R(0.5 + 0.5 * v / V.max) : R(Math.abs(v) / V.max); if (view !== 'disp' && o.flags) h = Hf * Math.abs(v) / V.max; }
      else c = R(Math.min(1, (V.vals[i] * f - V.lo) / Math.max(1e-9, V.hi - V.lo)));
      return { p: s.p, d: [s.d[0] * f, s.d[1] * f, s.d[2] * f], c, h, side: s.side }; });
    return { kind: m.kind, r: RADIUS[m.kind] || 0.06, st }; });
  const deform = (o.deformed || view === 'disp') && view !== 'sys' ? o.scale : 0;
  return { members, flags: STATION[view] && view !== 'disp' && o.flags, deform, supports: A.supports, bays: o.bays || null, showModel: o.showModel };
}

/** a member's values, for the click on a tube */
export function memberHTML(A, i, { fmt, esc }) {
  const m = A.members.filter((x) => !x.hidden)[i]; if (!m) return '';
  const kv = (k, v) => `<div class="sp-kv"><span>${k}</span><b>${v}</b></div>`;
  return `<b>${esc(m.label)} · ${esc(m.level)}</b>${kv('Section', esc(m.sec))}${kv('Length', fmt(m.L, 2) + ' m')}${kv('Axial N', `${fmt(m.Nmin, 0)} to ${fmt(m.Nmax, 0)} kN`)}${kv('Shear V', fmt(m.V, 1) + ' kN')}${kv('Moment M', fmt(m.M, 1) + ' kN·m')}${kv('Normal stress', fmt(m.s, 1) + ' MPa')}${kv('von Mises', fmt(m.vm, 1) + ' MPa')}${kv('Capacity used', `<span class="${m.util > 1 ? 'sp-bad' : ''}">${fmt(m.util * 100)} %</span>`)}${Number.isFinite(m.buckle) && m.buckle > 0.01 ? kv('Buckling', fmt(m.buckle * 100) + ' % of Euler') : ''}${(m.kind === 'beam' || m.kind === 'strip') && Number.isFinite(m.deflRatio) ? kv('Deflection, service', `L/${fmt(m.deflRatio)}`) : ''}`;
}

/** what can go wrong with a member, and what to try */
function fixOf(m, sys) {
  if (m.buckle > 1) return 'buckling: brace it at mid-height or use a stockier section';
  if (m.kind === 'column') return sys === 'steel' ? 'the next HSS size up' : sys === 'timber' ? 'a larger glulam column' : 'a larger column (+50 mm a side) or stronger concrete';
  if (m.kind === 'strip') return 'a thicker slab or drop panels at the columns, or a shorter span';
  if (m.kind === 'brace') return 'a larger tube, or bracing in more bays';
  return 'a deeper beam, or a shorter span (another column or grid line between)';
}

/** the ideas from the analysis: brace the most-swaying bays when the drift is over h/400 */
export function swayIdea(A, L) {
  if (!A.drift || !(A.drift.hOver < 400)) return null;
  const bays = braceBays(L), pickIn = (dir) => { const B = dir === 'u' ? L.axes.v : L.axes.u, A0 = dir === 'u' ? L.axes.u : L.axes.v, mid = Math.max(0, Math.floor((B.length - 1) / 2) - (B.length > 2 ? 0 : 0));
    return [A0[0].name, A0.at(-1).name].flatMap((line) => bays.filter((b) => b.dir === dir && b.line === line && b.bay === Math.min(mid, B.length - 2))).map((b) => ({ dir: b.dir, line: b.line, bay: b.bay, level: b.level, kind: 'X' })); };
  const braces = [...pickIn('u'), ...pickIn('v')]; if (!braces.length) return null;
  return { title: 'Brace the bays that sway most', text: `The wind sway is h/${A.drift.hOver} on ${A.drift.level}, over the usual h/400 screening limit. X braces in the middle bay of each outside grid line, on every floor (${braces.length} bays), make the frame much stiffer; the analysis runs again with them.`, braces };
}

const KEY = (b) => `${b.dir}|${b.line}|${b.bay}|${b.level}`;
/** a click on a bay with the brace tool: a single diagonal, then an X; Shift removes it */
export function toggleBrace(list, bay, shift) { const k = KEY(bay), i = list.findIndex((b) => KEY(b) === k), out = list.slice();
  if (shift) { if (i >= 0) out.splice(i, 1); return { list: out, said: i >= 0 ? `Brace removed: ${bay.label}` : '' }; }
  if (i < 0) { out.push({ dir: bay.dir, line: bay.line, bay: bay.bay, level: bay.level, kind: '/' }); return { list: out, said: `Brace added: a single diagonal in ${bay.label}, from preview to a real member` }; }
  if (out[i].kind === '/') { out[i] = { ...out[i], kind: 'X' }; return { list: out, said: `Brace made an X in ${bay.label}` }; }
  return { list: out, said: `${bay.label} already has an X brace (Shift-click removes it)` }; }
export const braceKind = (list, bay) => { const b = bay && list.find((x) => KEY(x) === KEY(bay)); return !b ? '/' : 'X'; };

/** the card's sections, after the reference: status; forces and deformation; loads and parameters; assumptions; foundation and
 *  joints; capacity, stability and strengthening; adding a member by hand */
export function frameSections(A, ctx) {
  const { fmt, esc, ST, sys, sname, span, live, snow, wind, qa, padSide, prevDrift, L } = ctx, c = A.counts, shown = A.members.filter((m) => !m.hidden);
  const fold = (key, title, body, open) => `<details class="sp-set sp-adv sp-sf" data-adv="sf-${key}" ${ST.unfold || (ST.advOpen?.['sf-' + key] ?? open) ? 'open' : ''}><summary>${title}</summary><div class="sp-sfbody">${body}</div></details>`;
  const kv = (k, v) => `<div class="sp-kv"><span>${k}</span><b>${v}</b></div>`, ok = A.eq.err < 1e-4;
  const cases = CASES.filter(([k]) => A.gov[k]), curCase = ST.stCase && A.gov[ST.stCase] ? ST.stCase : '';
  const status = kv('Members', `${c.columns} columns, ${c.beams} ${sys === 'concrete' ? 'slab strips' : 'beams'}${c.braces ? `, ${c.braces} braces` : ''}`) + kv('Nodes · unknowns', `${fmt(c.nodes)} · ${fmt(c.unknowns)}`) + kv('Solved in', `${fmt(A.ms)} ms in this browser`) + kv('Equilibrium', ok ? '✓ the reactions balance the loads' : `<span class="sp-bad">off by ${fmt(A.eq.err * 100, 2)} %</span>`) + (A.assumed.length ? kv('Supports assumed', `<span class="sp-bad">${A.assumed.length}</span> where the drawing shows nothing below`) : '');
  const forces = `<p class="sp-flabel">Load case for M, N, V, T and displacement</p><div class="sp-chips sp-sfcases" role="group" aria-label="Load case">${[['', 'Default'], ...cases].map(([k, n]) => `<button type="button" data-sf="case" data-v="${k}" aria-pressed="${curCase === k}" title="${esc(k ? (A.combos.find((x) => x.id === A.gov[k]) || {}).name || '' : 'Gravity for forces, service for displacement')}">${esc(n)}</button>`).join('')}</div><p class="sp-note">Gravity and wind are factored (ULS); service and sway are not (SLS).</p>
    <label class="sp-check"><input type="checkbox" data-sf="model" ${ST.stModel !== false ? 'checked' : ''}> Show the model</label><label class="sp-check"><input type="checkbox" data-sf="flags" ${ST.stFlags !== false ? 'checked' : ''}> Force diagrams as flags</label><label class="sp-check"><input type="checkbox" data-sf="deformed" ${ST.stDeformed !== false ? 'checked' : ''}> Deformed shape (scale in the legend)</label>
    <p class="sp-note">Click a member in 3D to read its values.</p>${ST.stPick != null && shown[ST.stPick] ? `<div class="sp-sfpick">${memberHTML(A, ST.stPick, { fmt, esc })}</div>` : ''}
    ${A.wallHeld ? kv('Wind sway', 'held by the bearing walls (modelled as rigid supports, so the sway is not computed; the walls\' own racking is not checked)') : ''}${A.drift ? kv('Wind sway, worst storey', `<span class="${A.drift.hOver < 400 ? 'sp-bad' : ''}">h/${fmt(A.drift.hOver)}</span> on ${esc(A.drift.level)} (${fmt(A.drift.mm, 1)} mm; screening limit h/400)${prevDrift && prevDrift !== A.drift.hOver ? ` · was h/${fmt(prevDrift)}` : ''}`) : ''}`;
  const loads = kv('System', esc(sname)) + kv('Grid', `about ${span} m`) + kv('Occupancy', `${fmt(live, 1)} kPa`) + kv('Roof snow', `${fmt(snow, 1)} kPa (assumed)`) + kv('Wind pressure', `${fmt(wind, 1)} kPa on the building's width (chosen below), plus 0.5 % of gravity per floor`)
    + `<p class="sp-flabel">Wind pressure (until the site's design wind is known)</p><div class="sp-tabs" role="tablist" aria-label="Wind pressure">${['0.4', '0.6', '0.8', '1.0'].map((v) => `<button type="button" role="tab" data-st-set="stWind:${v}" aria-selected="${String(ST.stWind ?? '0.6') === v}">${v} kPa</button>`).join('')}</div>`
    + `<p class="sp-flabel">Occupancy (sets the floor live load, NBC 2020 Table 4.1.5.3)</p><div class="sp-tabs" role="tablist" aria-label="Occupancy">${[['Residential', 'Residential'], ['Office', 'Office'], ['Education', 'School'], ['Retail', 'Retail'], ['Industrial', 'Industrial']].map(([v, n]) => `<button type="button" role="tab" data-st-set="stUse:${v}" aria-selected="${(ST.stUse || 'Residential') === v}">${n}</button>`).join('')}</div>`
    + `<p class="sp-flabel">Combinations (NBC 2020 set, the governing ones shown)</p><ul class="sp-sflist">${A.combos.map((x) => `<li>${esc(x.name)}</li>`).join('')}</ul><p class="sp-note">Changing a setting marks the result as changed: Start again to update it.</p>`;
  const assume = `<ul class="sp-sflist"><li>Linear static analysis of a 3D frame; joints rigid, braces pinned at both ends.</li><li>Floors act as stiff diaphragms (hidden diagonals in each bay).</li>${sys === 'concrete' ? '<li>The flat plate is modelled as slab strips along the grid lines (an equivalent-frame simplification).</li>' : ''}<li>Bearing walls are supports along their line, not plates; column bases ${ST.stBase === 'pinned' ? 'pinned' : 'fixed'}.</li><li>Not considered: second-order (P-Δ) effects, earthquakes, connection design, code checks. An engineer designs the structure.</li></ul>`;
  const up = A.reac.map((r) => r.F[2]), maxN = Math.max(0, ...up), cols = A.reac.filter((r) => !A.supports.some((s) => s.t === 'wall' && Math.hypot(s.p[0] - r.p[0], s.p[1] - r.p[1], s.p[2] - r.p[2]) < 1e-6));
  const uplift = A.reacW ? Math.min(0, ...A.reacW.map((r) => r.F[2])) : 0, braceN = Math.max(0, ...shown.filter((m) => m.kind === 'brace').map((m) => Math.max(Math.abs(m.Nmin), Math.abs(m.Nmax))));
  const pad = padSide ? padSide(Math.max(0, ...cols.map((r) => r.F[2])), qa) : null;
  const found = kv('Supports', `${A.supports.length} (${A.supports.filter((s) => s.t === 'fixed').length} fixed, ${A.supports.filter((s) => s.t === 'pinned').length} pinned, ${A.supports.filter((s) => s.t === 'wall').length} on walls)`) + kv('Largest reaction, gravity', `${fmt(maxN)} kN (factored)`) + (pad ? kv('Pad for it', `about ${fmt(pad, 1)} × ${fmt(pad, 1)} m at ${qa} kPa`) : '') + kv('Uplift under wind', uplift < -0.5 ? `<span class="sp-bad">${fmt(-uplift)} kN</span>: anchor the base` : 'none') + (braceN ? kv('Brace connections', `up to ${fmt(braceN)} kN each end (to be designed)`) : '') + `<p class="sp-note">Joints are taken as rigid; their design (bolts, welds, reinforcement) is not part of this check.</p>`;
  const worst = shown.map((m, i) => ({ m, i, u: Math.max(m.util, m.buckle || 0) })).sort((a, b) => b.u - a.u).slice(0, 5), over = shown.filter((m) => m.util > 1 || m.buckle > 1).length;
  const sagging = shown.filter((m) => (m.kind === 'beam' || m.kind === 'strip') && m.deflRatio < 360).length;
  const cap = kv('Over capacity', over ? `<span class="sp-bad">${over} member${over > 1 ? 's' : ''}</span>` : 'none ✓') + kv('Beams sagging more than L/360', sagging ? `<span class="sp-bad">${sagging}</span>` : 'none ✓')
    + `<table class="sp-codesum sp-sched"><thead><tr><th>Member</th><th>Level</th><th>Used</th><th>Try</th></tr></thead><tbody>${worst.map(({ m, i, u }) => `<tr><td><button type="button" class="sp-link" data-sf="pick" data-v="${i}">${esc(m.label)}</button></td><td>${esc(m.level)}</td><td class="${u > 1 ? 'sp-bad' : ''}">${fmt(u * 100)} %</td><td>${u > 0.9 ? esc(fixOf(m, sys)) : '—'}</td></tr>`).join('')}</tbody></table>`
    + (over && span > 6 ? `<button type="button" class="btn sm" data-st-set="span:6">Try it: a 6 m grid</button>` : '') + '<p class="sp-note">Screening strengths: steel 0.9 fy, glulam 0.8 fb, reinforced concrete with typical steel (1 % in slabs and beams, 2 % in columns); buckling against the Euler load.</p>';
  const br = ST.stBraces || [], idea = swayIdea(A, L);
  const hand = `<div class="sp-acts sp-acts1"><button type="button" class="btn sm ${ST.stBraceMode ? 'primary' : ''}" data-sf="brace" aria-pressed="${!!ST.stBraceMode}">${ST.stBraceMode ? 'Done adding braces' : '＋ Add a brace'}</button>${br.length ? `<button type="button" class="btn sm" data-sf="nobraces">Remove all (${br.length})</button>` : ''}</div>`
    + (ST.stBraceMode ? '<p class="sp-note">In 3D, point at a bay between two columns of a grid line: a dashed diagonal previews the brace. Click to add it; click again for an X; Shift-click removes it. The analysis runs again each time.</p>' : '')
    + (ST.stBraceSaid ? `<p class="sp-note sp-sfsaid">${esc(ST.stBraceSaid)}</p>` : '')
    + (br.length ? `<ul class="sp-sflist">${br.map((b) => `<li>${b.kind === 'X' ? 'X brace' : 'Diagonal'} on line ${esc(b.line)}, bay ${b.bay + 1}, ${esc((L.levels.find((l) => l.id === b.level) || {}).name || b.level)}</li>`).join('')}</ul>` : '<p class="sp-note">No braces yet: the frame resists wind by its rigid joints alone.</p>')
    + (idea ? `<p class="sp-flabel">Idea</p><ol class="sp-ideas"><li><b>${esc(idea.title)}</b><span>${esc(idea.text)}</span><button type="button" class="btn sm" data-sf="sway">Try it: ${idea.braces.length} X braces</button></li></ol>` : '');
  return fold('status', 'Members and calculation status', status, true) + fold('forces', 'Member forces and deformation', forces, true) + fold('loads', 'Loads and parameters', loads) + fold('assume', 'Assumptions', assume) + fold('found', 'Foundation and joint checks', found) + fold('cap', 'Capacity, stability and strengthening', cap, over > 0) + fold('hand', 'Add a member by hand', hand, !!ST.stBraceMode || br.length > 0);
}

/** the CSV of every analysed member */
export function frameCSV(A) {
  return ['', 'frame member,kind,level,section,length_m,N_min_kN,N_max_kN,V_kN,M_kNm,normal_stress_MPa,von_mises_MPa,capacity_used,buckling_of_euler,deflection_L_over',
    ...A.members.filter((m) => !m.hidden).map((m) => [`"${m.label}"`, m.kind, `"${m.level}"`, `"${m.sec}"`, m.L.toFixed(2), m.Nmin.toFixed(1), m.Nmax.toFixed(1), m.V.toFixed(1), m.M.toFixed(1), m.s.toFixed(1), m.vm.toFixed(1), m.util.toFixed(3), Number.isFinite(m.buckle) ? m.buckle.toFixed(3) : '', Number.isFinite(m.deflRatio) ? Math.round(m.deflRatio) : ''].join(',')),
    A.drift ? `wind sway,worst storey,"${A.drift.level}",,,,,,,,,,,h/${A.drift.hOver}` : ''];
}
