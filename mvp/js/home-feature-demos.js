import evidence from './fallingwater-results.js';
import saved from './home-demo-results.js?v=1';
import modelResults from './home-building-results.js?v=1';

// The four feature cards of the homepage (2026-11-15, after spacio.ai): a visual filling the card with a small floating panel for
// its one interaction, the title and a line of text at the foot. Every figure is a saved result of the sample models.
const image = (name, alt = '', attributes = '') => `<img src="img/home/features/${name}.webp" alt="${alt}" draggable="false" loading="lazy" decoding="async" ${attributes}>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const studies = {
  wind: { label: 'Wind', summary: 'Easterly wind · pedestrian-level speed over the incoming wind', scale: ['0×', '1.6×'], alt: 'Wind speed and direction around the studio and neighbouring buildings' },
  sun: { label: 'Sun hours', summary: 'March 20 · 07:00–17:00 · hours of direct sun on the ground', scale: ['0 h', '10 h'], alt: 'Hours of direct sun on the site ground around the buildings' },
  rain: { label: 'Rain', summary: `50 mm design storm · ${saved.rainVolume.toFixed(1)} m³ of runoff on the site`, scale: ['low', 'high runoff'], alt: 'Modelled runoff routes around the roofs of the sample site' },
  snow: { label: 'Snow', summary: `15 cm snowfall · ${saved.snowVolume.toFixed(1)} m³ settled on the site`, scale: ['ground', 'roofs'], alt: 'Ground and roof surfaces receiving uniform vertical snowfall' },
};
const buildingStudies = {
  wind: { ...studies.wind, summary: `Through the rooms · ${modelResults.air.ach.toFixed(1)} air changes an hour in a 3.6 m/s easterly`, scale: ['room', 'air changes/h'], alt: 'Ventilation results for the two rooms of Courtyard Studio' },
  sun: { ...studies.sun, summary: `On the roof · ${modelResults.roof.sun.toFixed(1)} h of direct sun on March 20, on average`, scale: ['0 h', '10 h'], alt: 'Hours of direct sun on the main roof and overhang' },
  rain: { ...studies.rain, summary: `From the roof · ${modelResults.roof.rain.toFixed(1)} m³ of runoff in a 50 mm storm`, scale: ['roof', 'runoff'], alt: 'Roof and overhang surfaces contributing runoff' },
  snow: { ...studies.snow, summary: `On the roof · ${modelResults.roof.snow.toFixed(1)} m³ of snow from a 15 cm fall`, scale: ['roof', 'snow load'], alt: 'Roof and overhang surfaces receiving modelled snowfall' },
};
const furniture = { sofa: 'Sofa', chair: 'Chair', plant: 'Plant' };
const furnitureImage = (id, view = 'icon') => image(`furniture-${id}-${view}`);
const inks = [['#1F3FE0', 'Blue'], ['#1D2129', 'Black'], ['#C8352B', 'Red']];
const format = (n, digits = 2) => n.toFixed(digits);
const delta = (a, b) => `${b >= a ? '+' : ''}${format(b - a)}`;
const [baseline, option] = evidence.runs;
const comparisonTable = (firstColumn, rows) => `<table><thead><tr><th scope="col">${firstColumn}</th><th scope="col">A</th><th scope="col">B</th><th scope="col">B − A</th></tr></thead>
  <tbody>${rows.map(([label, a, b]) => `<tr><th scope="row">${label}</th><td>${format(a)}</td><td>${format(b)}</td><td>${delta(a, b)}</td></tr>`).join('')}</tbody></table>`;

// Reports: two saved comparisons, each with its figures (B and the change from A) and a small chart by room
const [dayA, dayB] = saved.daylight;
const ventRooms = baseline.rooms.map((r, i) => [r.name, r.ach, option.rooms[i].ach]).filter(([, a, b]) => a > 0 || b > 0).sort((x, y) => y[2] - x[2]).slice(0, 6);
const reports = {
  daylight: {
    label: 'Daylight', model: 'Courtyard Studio · A baseline glazing, B larger south windows',
    rows: [['Floor average', dayA.mean, dayB.mean, '%'], ...dayA.rooms.map(([n, v]) => [n, v, dayB.rooms.find(([m]) => m === n)[1], '%'])],
    finding: `Plan B: studio daylight factor ${format(dayA.rooms[0][1], 1)}% → ${format(dayB.rooms[0][1], 1)}%`, bars: dayA.rooms.map(([n, v]) => [n, v, dayB.rooms.find(([m]) => m === n)[1]]), unit: '% daylight factor',
  },
  vent: {
    label: 'Ventilation', model: `Fallingwater · windows open ${baseline.open * 100}% (A) and ${option.open * 100}% (B)`,
    rows: [['Air changes', baseline.ach, option.ach, '/h'], ['Outdoor air', baseline.airflow, option.airflow, 'L/s'], ['Rooms above 30 /h', baseline.rooms.filter((r) => r.ach > 30).length, option.rooms.filter((r) => r.ach > 30).length, '']],
    finding: `${option.rooms.filter((r) => r.ach > 30).length} of ${option.rooms.length} rooms above 30 air changes an hour with B`, bars: ventRooms, unit: 'air changes per hour',
  },
};
const num = (v, u) => (u === 'L/s' ? Math.round(v).toLocaleString('en') : Number.isInteger(v) ? String(v) : format(v, u === '/h' ? 1 : 2));
const pill = (a, b, u) => { const d = b - a, cls = Math.abs(d) < 1e-9 ? 'flat' : d > 0 ? 'up' : 'down'; return `<span class="lp-pill ${cls}">${d > 0 ? '+' : d < 0 ? '−' : '±'}${num(Math.abs(d), u)}</span>`; };
function reportHTML(k) {
  const R = reports[k], mx = Math.max(...R.bars.flatMap(([, a, b]) => [a, b]), 1e-9);
  return { table: `<p class="lp-rep-model">${esc(R.model)}</p><table><tbody>${R.rows.map(([n, a, b, u]) => `<tr><th scope="row">${esc(n)}</th><td>${pill(a, b, u)}</td><td><b>${num(b, u)}</b> ${u}</td></tr>`).join('')}</tbody></table>`,
    chart: `<p><b>${esc(R.finding)}</b></p><div class="lp-bars" role="img" aria-label="${esc(R.unit)} by room, A and B">${R.bars.map(([n, a, b]) => `<span title="${esc(n)}: A ${format(a, 1)} · B ${format(b, 1)} ${esc(R.unit)}"><i class="a" style="height:${(a / mx * 100).toFixed(1)}%"></i><i class="b" style="height:${(b / mx * 100).toFixed(1)}%"></i></span>`).join('')}</div><small><i class="a"></i>A <i class="b"></i>B · ${esc(R.unit)}</small>` };
}
const seg = (attr, items, on) => `<div class="lp-seg" role="group">${items.map(([v, l]) => `<button type="button" ${attr}="${v}" aria-pressed="${v === on}">${l}</button>`).join('')}</div>`;

export const featureMarkup = `
<section class="lp-feature-tour" aria-labelledby="lpFeatureTitle">
  <header><span class="lp-hero-eyebrow">One model, start to finish</span><h2 id="lpFeatureTitle">From site study<br><span>to design review.</span></h2></header>
  <div class="lp-feature-grid">
    <article class="lp-feature-card lp-card-site">
      <div class="lp-feature-copy"><span class="lp-card-num">01</span><h3>Site analysis</h3><p>Wind, sun, rain and snow on the site and on the building itself, from the same model.</p></div>
      <div class="lp-feature-stage lp-site-stage">
        ${image('site-wind', studies.wind.alt, 'class="lp-site-img"')}
        <div class="lp-float lp-site-panel">${seg('data-study', Object.entries(studies).map(([k, s]) => [k, s.label]), 'wind')}${seg('data-scope', [['site', 'Site'], ['building', 'Building']], 'site')}</div>
        <div class="lp-float lp-site-legend" data-study="wind" data-scope="site"><i></i><span><span>${studies.wind.scale[0]}</span><span>${studies.wind.scale[1]}</span></span></div>
        <p class="lp-float lp-site-caption" role="status">${studies.wind.summary}</p>
      </div>
    </article>
    <article class="lp-feature-card lp-card-furniture">
      <div class="lp-feature-copy"><span class="lp-card-num">02</span><h3>Furniture</h3><p>Drag pieces onto the plan at true size, as in the Workspace: move them, click to turn, drag off to remove.</p></div>
      <div class="lp-feature-stage lp-furn-stage">
        <div class="lp-furn-plan" tabindex="0" aria-label="Ground-floor plan: drop furniture here">${image('furniture-plan', 'Ground-floor plan of the Courtyard Studio sample')}<div class="lp-plan-placements"></div></div>
        <div class="lp-float lp-furn-palette" role="group" aria-label="Furniture: drag onto the plan">${Object.entries(furniture).map(([id, l]) => `<button type="button" data-piece="${id}" aria-label="${l}: drag onto the plan, or press Enter">${furnitureImage(id)}<span>${l}</span></button>`).join('')}</div>
        <p class="lp-float lp-furn-status" role="status">Drag a piece onto the plan</p>
      </div>
    </article>
    <article class="lp-feature-card lp-card-report">
      <div class="lp-feature-copy"><span class="lp-card-num">03</span><h3>Reports</h3><p>Compare two options on the same inputs; every change traces back to a saved run. <a href="reports/examples/fallingwater-ventilation.pdf" target="_blank" rel="noopener">Sample report (PDF) ↗</a></p></div>
      <div class="lp-feature-stage lp-rep-stage">
        <div class="lp-float lp-rep-table">${seg('data-rep', Object.entries(reports).map(([k, r]) => [k, r.label]), 'daylight')}<div class="lp-rep-body">${reportHTML('daylight').table}</div></div>
        <div class="lp-float lp-rep-chart" aria-live="polite">${reportHTML('daylight').chart}</div>
      </div>
    </article>
    <article class="lp-feature-card lp-card-illustration">
      <div class="lp-feature-copy"><span class="lp-card-num">04</span><h3>Illustration</h3><p>The model as a line drawing in one ink, ready for boards. Drag to turn it.</p></div>
      <div class="lp-feature-stage lp-ill-stage">
        ${image('illustration', 'Courtyard Studio drawn as a line illustration', 'class="lp-ill-still"')}
        <div class="lp-ill-view" role="group" aria-label="Line illustration of the model: drag to turn, scroll to zoom"></div>
        <div class="lp-float lp-ill-inks" role="group" aria-label="Line ink">${inks.map(([c, n], i) => `<button type="button" data-ink="${c}" aria-pressed="${i === 0}" title="${n} ink"><i style="background:${c}"></i>${n}</button>`).join('')}</div>
        <button type="button" class="lp-float lp-ill-reset" hidden>Reset view</button>
      </div>
    </article>
  </div>
</section>`;

const press = (group, btn) => group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
const onView = (el, fn) => { if (!('IntersectionObserver' in window)) { fn(); return () => {}; } const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: '200px' }); io.observe(el); return () => io.disconnect(); };

function mountReport(card) {
  const body = card.querySelector('.lp-rep-body'), chart = card.querySelector('.lp-rep-chart'), group = card.querySelector('.lp-seg');
  group.addEventListener('click', (e) => { const b = e.target.closest('[data-rep]'); if (!b) return; press(group, b); const h = reportHTML(b.dataset.rep); body.innerHTML = h.table; chart.innerHTML = h.chart; });
}

function mountSite(card) {
  const img = card.querySelector('.lp-site-img'), cap = card.querySelector('.lp-site-caption'), legend = card.querySelector('.lp-site-legend');
  const [gStudy, gScope] = card.querySelectorAll('.lp-site-panel .lp-seg');
  let study = 'wind', scope = 'site', token = 0;
  const show = () => { const t = ++token, S = (scope === 'site' ? studies : buildingStudies)[study], src = `img/home/features/${scope}-${study}.webp`, next = new Image();
    next.onload = () => { if (t !== token) return; img.classList.add('is-fading'); setTimeout(() => { if (t !== token) return; img.src = src; img.alt = S.alt; img.classList.remove('is-fading'); }, 120); cap.textContent = S.summary; legend.dataset.study = study; legend.dataset.scope = scope; const sp = legend.querySelectorAll('span > span'); sp[0].textContent = S.scale[0]; sp[1].textContent = S.scale[1]; };
    next.onerror = () => { if (t === token) cap.textContent = 'This saved result could not load.'; }; next.src = src; };
  gStudy.addEventListener('click', (e) => { const b = e.target.closest('[data-study]'); if (!b) return; press(gStudy, b); study = b.dataset.study; show(); });
  gScope.addEventListener('click', (e) => { const b = e.target.closest('[data-scope]'); if (!b) return; press(gScope, b); scope = b.dataset.scope; show(); });
  return onView(card, () => { for (const sc of ['site', 'building']) for (const st of Object.keys(studies)) { const i = new Image(); i.src = `img/home/features/${sc}-${st}.webp`; } });
}

// Furniture: true-size pieces (the Workspace footprints) on the 636 × 476 plan (31 px a metre at 1272 × 952); the rooms' inside
// faces bound them. Drag from the palette to place, drag a piece to move it, a click turns it 90°, dragging it off removes it
function mountFurniture(card) {
  const plan = card.querySelector('.lp-furn-plan'), layer = card.querySelector('.lp-plan-placements'), status = card.querySelector('.lp-furn-status'), palette = card.querySelector('.lp-furn-palette');
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n)), B = { x0: .12, x1: .88, y0: .13, y1: .87 };
  const half = (P) => { const { w, d } = modelResults.furniture[P.id], hw = w * 31 / 1272, hd = d * 31 / 952; return P.rot % 180 ? [hd * 952 / 1272, hw * 1272 / 952] : [hw, hd]; };
  const draw = (P) => { const { w, d } = modelResults.furniture[P.id], [hx, hy] = half(P); P.x = clamp(P.x, B.x0 + hx, B.x1 - hx); P.y = clamp(P.y, B.y0 + hy, B.y1 - hy);
    Object.assign(P.el.style, { left: P.x * 100 + '%', top: P.y * 100 + '%', width: w * 31 / 1272 * 200 + '%', height: d * 31 / 952 * 200 + '%', transform: `translate(-50%,-50%) rotate(${P.rot}deg)` }); };
  const say = () => { const n = layer.childElementCount; status.textContent = n ? `${n} piece${n === 1 ? '' : 's'} on the plan · drag to move, click to turn, drag off to remove` : 'Drag a piece onto the plan'; };
  const at = (e) => { const r = layer.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  const inside = (e) => { const r = layer.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
  function add(id, x, y) { const el = document.createElement('span'); el.className = 'lp-placed-furniture'; el.tabIndex = 0; el.dataset.furniture = id; el.setAttribute('role', 'button'); el.setAttribute('aria-label', `${furniture[id]}: arrows move, R turns, Delete removes`); el.innerHTML = furnitureImage(id, 'top');
    const P = { id, x, y, rot: 0, el }; el._p = P; layer.append(el); draw(P); say(); return P; }
  // one pointer drag for both: from the palette (a ghost until it is over the plan) and of a placed piece
  let drag = null;
  card.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; const src = e.target.closest('[data-piece]'), piece = e.target.closest('.lp-placed-furniture'); if (!src && !piece) return;
    e.preventDefault(); drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, src, P: piece?._p }; card.setPointerCapture?.(e.pointerId); });
  card.addEventListener('pointermove', (e) => { if (!drag || drag.id !== e.pointerId) return; if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return; drag.moved = true; const [x, y] = at(e);
    if (drag.src) { if (!drag.ghost) { drag.ghost = document.createElement('span'); drag.ghost.className = 'lp-furniture-ghost'; drag.ghost.innerHTML = furnitureImage(drag.src.dataset.piece, 'top'); document.body.append(drag.ghost); }
      Object.assign(drag.ghost.style, { left: e.clientX + 'px', top: e.clientY + 'px' }); plan.classList.toggle('is-dropping', inside(e)); }
    else { drag.P.x = x; drag.P.y = y; draw(drag.P); drag.P.el.classList.toggle('is-leaving', !inside(e)); } });
  const end = (e) => { if (!drag || drag.id !== e.pointerId) return; const D = drag; drag = null; plan.classList.remove('is-dropping'); D.ghost?.remove();
    if (D.src) { if (D.moved && e.type === 'pointerup' && inside(e)) { const [x, y] = at(e); add(D.src.dataset.piece, x, y).el.focus({ preventScroll: true }); } else if (!D.moved && e.type === 'pointerup') add(D.src.dataset.piece, .5, .55); return; }
    if (!D.moved) { D.P.rot = (D.P.rot + 90) % 360; draw(D.P); return; }   // a click turns it
    if (!inside(e)) { D.P.el.remove(); say(); } else D.P.el.classList.remove('is-leaving'); };
  card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  palette.addEventListener('keydown', (e) => { const b = e.target.closest('[data-piece]'); if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); add(b.dataset.piece, .5, .55).el.focus(); } });
  palette.addEventListener('click', (e) => { if (e.detail === 0) e.preventDefault(); });   // keyboard placing is handled above; a pointer click places in pointerup
  layer.addEventListener('keydown', (e) => { const P = e.target._p; if (!P) return; const st = e.shiftKey ? .05 : .015, mv = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
    if (mv) { e.preventDefault(); P.x += mv[0]; P.y += mv[1]; draw(P); } else if (e.key === 'r' || e.key === 'R') { P.rot = (P.rot + 90) % 360; draw(P); } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); P.el.remove(); say(); } });
}

// Illustration: the line model opens when the card is in view and turns slowly until it is touched; three inks
function mountIllustration(card) {
  const host = card.querySelector('.lp-ill-view'), still = card.querySelector('.lp-ill-still'), inks = card.querySelector('.lp-ill-inks'), reset = card.querySelector('.lp-ill-reset'), controller = new AbortController();
  let viewer = null, ink = '#1F3FE0', raf = 0, spin = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const turn = (t0) => { let last = t0; const step = (t) => { if (!spin || !viewer || controller.signal.aborted) return; viewer.rotate((t - last) / 1000 * 0.18); last = t; raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); };
  const stopSpin = () => { if (!spin) return; spin = false; cancelAnimationFrame(raf); reset.hidden = false; };
  const stopView = onView(card, async () => { try { const { openIllustration } = await import('./home-illustration.js?v=1'); viewer = await openIllustration(host, ink, controller.signal); still.hidden = true; card.dataset.live = '1'; if (spin) turn(performance.now()); } catch { /* the still drawing stays */ } });
  host.addEventListener('pointerdown', stopSpin); host.addEventListener('wheel', stopSpin, { passive: true });
  inks.addEventListener('click', (e) => { const b = e.target.closest('[data-ink]'); if (!b) return; press(inks, b); ink = b.dataset.ink; viewer?.color(ink); card.dataset.ink = ink; });
  reset.addEventListener('click', () => { viewer?.reset(); });
  return () => { stopView(); controller.abort(); cancelAnimationFrame(raf); viewer?.dispose(); };
}

export function mountFeatures(app) {
  const section = app.querySelector('.lp-feature-tour');
  mountReport(section.querySelector('.lp-card-report'));
  const offSite = mountSite(section.querySelector('.lp-card-site'));
  mountFurniture(section.querySelector('.lp-card-furniture'));
  const offIll = mountIllustration(section.querySelector('.lp-card-illustration'));
  return () => { offSite(); offIll(); document.querySelectorAll('.lp-furniture-ghost').forEach((g) => g.remove()); };
}

export function comparisonMarkup() {
  const [a, b] = saved.daylight;
  return `<div class="lp-report-toolbar"><span>Courtyard Studio · Ground floor · Daylight factor</span><div role="group" aria-label="Choose comparison view">
    <button type="button" data-report-view="0" aria-pressed="false">Plan A</button><button type="button" data-report-view="50" aria-pressed="true">Compare</button><button type="button" data-report-view="100" aria-pressed="false">Plan B</button>
  </div></div><div class="lp-report-wipe" style="--reveal:50%">
    <div class="lp-report-layer">${image('daylight-a', 'Plan A computed daylight factor, baseline glazing')}</div>
    <div class="lp-report-layer lp-report-layer-b">${image('daylight-b', 'Plan B computed daylight factor, larger south windows')}</div>
    <span class="lp-report-label label-a">A · Baseline glazing</span><span class="lp-report-label label-b">B · Larger south windows</span>
    <div class="lp-report-divider" aria-hidden="true"><span>↔</span></div>
  </div>
  <label class="lp-report-range">Drag to compare<input type="range" min="0" max="100" value="50" aria-label="Reveal Plan B" aria-valuetext="Plan A and Plan B side by side"></label>
  <div class="lp-daylight-details"><div class="lp-daylight-legend"><b>Daylight factor</b><i></i><span>0%<span>3%</span>≥6%</span></div>
  ${comparisonTable('Daylight factor (%)', [['Floor average', a.mean, b.mean], ...a.rooms.map(([name, value]) => [name, value, b.rooms.find(([bName]) => name === bName)[1]])])}</div>
  <p class="lp-compare-state" id="lpReportState" role="status">Plan A + Plan B · Split view</p>
  <p class="lp-report-disclaimer">Plan Studio · CIE overcast sky · 0.5 m sampling grid · 0.8 m workplane · glazing transmittance 0.70. The study estimates daylight from glazing under an overcast sky.</p>`;
}
