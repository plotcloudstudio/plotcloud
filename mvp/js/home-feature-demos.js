import evidence from './fallingwater-results.js';
import saved from './home-demo-results.js?v=1';
import modelResults from './home-building-results.js?v=1';

const image = (name, alt = '', attributes = '') => `<img src="img/home/features/${name}.webp" alt="${alt}" draggable="false" loading="lazy" decoding="async" ${attributes}>`;
const button = (value, label, selected = false) => `<button type="button" data-choice="${value}" aria-pressed="${selected}">${label}</button>`;
const studies = {
  wind: { label: 'Wind flow', summary: 'Easterly wind · pedestrian-level speed relative to the incoming wind.', scale: '0× · 0.8× · 1.6×', alt: 'Wind speed and direction around the studio and neighboring buildings' },
  sun: { label: 'Sun hours', summary: 'March 20 · 07:00–17:00 local standard time, sampled every 30 minutes.', scale: '0 h · 5 h · 10 h', alt: 'Hours of direct sun on the site ground around the buildings' },
  rain: { label: 'Rain', summary: `50 mm design rainfall · ${saved.rainVolume.toFixed(1)} m³ of modeled runoff on flat sample terrain.`, scale: 'Low → high accumulated runoff', alt: 'Modeled runoff accumulation routes around roofs on the sample site' },
  snow: { label: 'Snow', summary: `15 cm of uniform vertical snowfall · ${saved.snowVolume.toFixed(1)} m³ deposited on model surfaces.`, scale: 'Ground deposition · roof deposition', alt: 'Ground and roof surfaces receiving uniform vertical snowfall' },
};

const buildingStudies = {
  wind: { ...studies.wind, summary: `Indoor ventilation · ${modelResults.air.ach.toFixed(2)} ACH across both rooms under a 3.6 m/s easterly reference wind.`, scale: 'Room labels show air changes per hour', alt: 'Pressure-network ventilation results for the two rooms of Courtyard Studio' },
  sun: { ...studies.sun, summary: `Roof surfaces received an average of ${modelResults.roof.sun.toFixed(1)} h of direct sun on March 20, 2026, 07:00–17:00 local standard time.`, scale: '0 h → 10 h', alt: 'Hours of direct sun calculated on the main roof and overhang' },
  rain: { ...studies.rain, summary: `50 mm design rainfall · ${modelResults.roof.rain.toFixed(1)} m³ of runoff from the main roof and overhang at a 0.95 runoff coefficient.`, scale: 'Roof surfaces contributing runoff', alt: 'Roof and overhang surfaces contributing to building runoff' },
  snow: { ...studies.snow, summary: `15 cm vertical snowfall · ${modelResults.roof.snow.toFixed(1)} m³ deposited on the studio roof and overhang.`, scale: 'Roof surfaces receiving snow', alt: 'Roof and overhang surface cells receiving modeled snowfall' },
};
const furniture = { sofa: 'Sofa', chair: 'Dining chair', plant: 'Potted plant' };
const furnitureImage = (id, view = 'icon') => image(`furniture-${id}-${view}`);
const channels = [['R', 'Red', 31], ['G', 'Green', 63], ['B', 'Blue', 224]];
const format = (n, digits = 2) => n.toFixed(digits);
const delta = (a, b) => `${b >= a ? '+' : ''}${format(b - a)}`;
const [baseline, option] = evidence.runs;
const comparisonTable = (firstColumn, rows) => `<table><thead><tr><th scope="col">${firstColumn}</th><th scope="col">A</th><th scope="col">B</th><th scope="col">B − A</th></tr></thead>
  <tbody>${rows.map(([label, a, b]) => `<tr><th scope="row">${label}</th><td>${format(a)}</td><td>${format(b)}</td><td>${delta(a, b)}</td></tr>`).join('')}</tbody></table>`;

export const featureMarkup = `
<section class="lp-feature-tour" aria-labelledby="lpFeatureTitle">
  <header><h2 id="lpFeatureTitle">From site study to design review.</h2></header>
  <div class="lp-feature-grid">
    <article class="lp-feature-card lp-demo-report">
      <div class="lp-feature-stage lp-demo-report-stage">
        ${image('report-landscape', 'Fallingwater landscape and Bear Run from the project model')}
        <div class="lp-demo-report-summary">
          <strong>Fallingwater</strong><span>Natural ventilation · saved study</span>
          ${comparisonTable('Whole house', [['Outdoor flow (L/s)', baseline.airflow, option.airflow], ['Air changes (h⁻¹)', baseline.ach, option.ach]])}
        </div>
      </div>
      <div class="lp-feature-copy">
        <h3>Reports</h3><p>Review the inputs, results and room-by-room differences between two options.</p>
        <details class="lp-demo-report-details"><summary>View report details</summary>
          <p>Operable window fraction A: ${baseline.open * 100}% · B: ${option.open * 100}%. Both runs use a ${evidence.conditions.windSpeedAt10m} m/s southwest wind at 10 m, ${evidence.conditions.outdoorC} °C outdoors and ${evidence.conditions.indoorC} °C indoors.</p>
          <div class="lp-demo-table-scroll" tabindex="0" aria-label="Room results">${comparisonTable('Room · air changes/h', baseline.rooms.map((room, i) => [room.name, room.ach, option.rooms[i].ach]))}</div>
          <a href="reports/examples/fallingwater-ventilation.pdf" target="_blank" rel="noopener">Open exported PDF ↗</a>
        </details>
      </div>
    </article>
    <article class="lp-feature-card lp-demo-site">
      <div class="lp-feature-stage lp-demo-site-stage">
        ${image('site-base', 'Courtyard Studio sample massing and its neighboring buildings')}
        <div class="lp-demo-site-overlay"><span>Courtyard Studio</span><span class="lp-demo-site-legend" hidden><i></i><span></span></span></div>
      </div>
      <div class="lp-feature-copy">
        <h3>Site analysis</h3><p class="lp-site-status" role="status">Choose a study and load saved site or building results.</p>
        <div class="lp-feature-controls">
          <div class="lp-choice-group" role="group" aria-label="Site study">${Object.entries(studies).map(([id, s]) => button(id, s.label, id === 'wind')).join('')}</div>
          <button class="lp-calculate" type="button">Calculate</button>
        </div>
        <div class="lp-feature-controls lp-site-scope">
          <div class="lp-scope-group lp-choice-group" role="group" aria-label="Analysis scope"><button type="button" data-scope="site" aria-pressed="true">Site</button><button type="button" data-scope="building" aria-pressed="false">Building</button></div>
          <small class="lp-site-source">Saved Courtyard Studio results</small>
        </div>
      </div>
    </article>
    <article class="lp-feature-card lp-demo-furniture">
      <div class="lp-feature-stage lp-drop-plan" role="button" tabindex="0" aria-label="Place selected furniture on the plan">
        ${image('furniture-plan', 'Ground-floor plan of the Courtyard Studio sample')}
        <div class="lp-plan-placements" aria-hidden="true"></div>
      </div>
      <div class="lp-feature-copy">
        <h3>Furniture</h3><p class="lp-furniture-status" role="status">Drag a piece onto the plan, or select one and click the plan.</p>
        <div class="lp-feature-controls">
          <div class="lp-choice-group" role="group" aria-label="Furniture library">${Object.entries(furniture).map(([id, label]) => button(id, furnitureImage(id) + label)).join('')}</div>
          <button class="lp-demo-undo" type="button" disabled>Undo</button>
        </div>
      </div>
    </article>
    <article class="lp-feature-card lp-demo-illustration">
      <div class="lp-feature-stage lp-illustration-stage">
        ${image('illustration', 'Courtyard Studio perspective illustration')}
        <div class="lp-illustration-view" role="group" aria-label="3D illustration"></div>
        <button class="lp-open-illustration" type="button">Open 3D view</button>
        <div class="lp-illustration-camera" role="group" aria-label="Camera controls" hidden>
          <button type="button" data-camera="left" aria-label="Rotate left">↶</button>
          <button type="button" data-camera="right" aria-label="Rotate right">↷</button>
          <button type="button" data-camera="in" aria-label="Zoom in">+</button>
          <button type="button" data-camera="out" aria-label="Zoom out">−</button>
          <button type="button" data-camera="reset">Reset view</button>
        </div>
      </div>
      <div class="lp-feature-copy">
        <h3>Illustration</h3><p>Drag to orbit. Scroll or pinch to zoom. Mix the RGB channels to change the linework.</p>
        <fieldset class="lp-rgb"><legend>Line color <i></i> <output class="lp-rgb-hex">#1F3FE0</output></legend>
          ${channels.map(([short, label, value]) => `<label><span aria-hidden="true">${short}</span><input name="${short}" type="range" min="0" max="255" value="${value}" aria-label="${label}"><output>${value}</output></label>`).join('')}
        </fieldset>
        <p class="lp-illustration-status" role="status"></p>
      </div>
    </article>
  </div>
</section>`;

function mountChoices(card, onChange) {
  const group = card.querySelector('.lp-choice-group');
  group.addEventListener('click', (event) => {
    const selected = event.target.closest('button[data-choice]');
    if (!selected) return;
    group.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === selected)));
    onChange(selected.dataset.choice, event);
  });
}

function mountSite(card) {
  const scene = card.querySelector('img');
  const status = card.querySelector('.lp-site-status');
  const legend = card.querySelector('.lp-demo-site-legend');
  let selected = 'wind', scope = 'site', loaded = false, request = 0;
  function show() {
    const token = ++request;
    const study = (scope === 'site' ? studies : buildingStudies)[selected];
    const src = `img/home/features/${scope}-${selected}.webp`;
    const next = new Image();
    status.textContent = `Loading saved ${study.label.toLowerCase()} result…`;
    next.onload = () => {
      if (request !== token) return;
      scene.src = src;
      scene.alt = study.alt;
      legend.hidden = false;
      legend.dataset.study = selected;
      legend.dataset.scope = scope;
      legend.lastElementChild.textContent = study.scale;
      status.textContent = study.summary;
    };
    next.onerror = () => {
      if (request === token) status.textContent = 'The saved result could not load. Try Calculate again.';
    };
    next.src = src;
  }
  mountChoices(card, (id) => {
    selected = id;
    if (loaded) show();
  });
  const scopeGroup = card.querySelector('.lp-scope-group');
  scopeGroup.addEventListener('click', (event) => {
    const chosen = event.target.closest('button[data-scope]');
    if (!chosen) return;
    scope = chosen.dataset.scope;
    scopeGroup.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === chosen)));
    if (loaded) show();
  });
  card.querySelector('.lp-calculate').addEventListener('click', (event) => {
    loaded = true;
    event.currentTarget.textContent = 'Reload result';
    show();
  });
}

function mountFurniture(card) {
  const plan = card.querySelector('.lp-drop-plan');
  const placements = card.querySelector('.lp-plan-placements');
  const status = card.querySelector('.lp-furniture-status');
  const undo = card.querySelector('.lp-demo-undo');
  let selected, drag, suppressClick = false;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  function place(x, y) {
    const item = document.createElement('span');
    item.className = 'lp-placed-furniture';
    const {w, d} = modelResults.furniture[selected];
    const halfW = w * 31 / 1272, halfD = d * 31 / 952;
    item.dataset.furniture = selected;
    item.style.width = `${halfW * 200}%`;
    item.style.height = `${halfD * 200}%`;
    item.style.left = `${clamp(x, .12 + halfW, .88 - halfW) * 100}%`;
    item.style.top = `${clamp(y, .13 + halfD, .87 - halfD) * 100}%`;
    item.innerHTML = furnitureImage(selected, 'top');
    placements.append(item);
    status.textContent = `${furniture[selected]} placed · ${placements.childElementCount} on plan.`;
    undo.disabled = false;
  }
  function placeAt(event) {
    const rect = placements.getBoundingClientRect();
    place((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  }
  mountChoices(card, (id, event) => {
    if (suppressClick && event.detail > 0) return;
    selected = id;
    status.textContent = `${furniture[id]} selected. Click the plan or press Enter on it.`;
  });
  plan.addEventListener('click', (event) => { if (selected) placeAt(event); });
  plan.addEventListener('keydown', (event) => {
    if (selected && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      place(.48, .64);
    }
  });
  undo.addEventListener('click', () => {
    placements.lastElementChild?.remove();
    undo.disabled = !placements.childElementCount;
    status.textContent = `${placements.childElementCount} pieces on plan.`;
  });
  const palette = card.querySelector('.lp-choice-group');
  palette.addEventListener('pointerdown', (event) => {
    const item = event.target.closest('button[data-choice]');
    if (!item || event.button !== 0) return;
    item.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, item, x: event.clientX, y: event.clientY };
  });
  palette.addEventListener('pointermove', (event) => {
    if (drag?.id !== event.pointerId || (!drag.ghost && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6)) return;
    if (!drag.ghost) {
      drag.ghost = document.createElement('span');
      drag.ghost.className = 'lp-furniture-ghost';
      drag.ghost.innerHTML = furnitureImage(drag.item.dataset.choice);
      card.append(drag.ghost);
      plan.classList.add('is-dropping');
    }
    drag.ghost.style.left = `${event.clientX}px`;
    drag.ghost.style.top = `${event.clientY}px`;
  });
  function end(event) {
    if (drag?.id !== event.pointerId) return;
    if (drag.ghost) {
      suppressClick = true;
      drag.ghost.remove();
      plan.classList.remove('is-dropping');
      if (event.type === 'pointerup' && plan.contains(document.elementFromPoint(event.clientX, event.clientY))) {
        selected = drag.item.dataset.choice;
        palette.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === drag.item)));
        placeAt(event);
      }
      setTimeout(() => { suppressClick = false; }, 0);
    }
    drag = null;
  }
  palette.addEventListener('pointerup', end);
  palette.addEventListener('pointercancel', end);
  palette.addEventListener('lostpointercapture', end);
}

function mountIllustration(card) {
  const stage = card.querySelector('.lp-illustration-stage');
  const host = card.querySelector('.lp-illustration-view');
  const fallback = stage.querySelector('img');
  const open = card.querySelector('.lp-open-illustration');
  const tools = card.querySelector('.lp-illustration-camera');
  const status = card.querySelector('.lp-illustration-status');
  const rgb = card.querySelector('.lp-rgb');
  const ranges = [...rgb.querySelectorAll('input')];
  const controller = new AbortController();
  let viewer, loading;
  function color() {
    const values = ranges.map((range) => Number(range.value));
    const hex = '#' + values.map((n) => n.toString(16).padStart(2,'0')).join('').toUpperCase();
    rgb.style.setProperty('--rgb', hex);
    rgb.querySelector('.lp-rgb-hex').value = hex;
    for (const [i, range] of ranges.entries()) {
      range.nextElementSibling.value = values[i];
      const start = [...values], end = [...values];
      start[i] = 0;
      end[i] = 255;
      range.style.setProperty('--from', `rgb(${start.join(' ')})`);
      range.style.setProperty('--to', `rgb(${end.join(' ')})`);
    }
    viewer?.color(hex);
    return hex;
  }
  async function start() {
    if (viewer || loading) return;
    loading = true;
    open.disabled = true;
    status.textContent = 'Loading 3D model…';
    try {
      const {openIllustration} = await import('./home-illustration.js?v=1');
      viewer = await openIllustration(host, color(), controller.signal);
      color();
      fallback.hidden = true;
      open.hidden = true;
      tools.hidden = false;
      status.textContent = '';
    } catch {
      if (controller.signal.aborted) return;
      status.textContent = 'The 3D view could not start. The model illustration is shown above.';
      open.disabled = false;
    } finally {
      loading = false;
    }
  }
  color();
  rgb.addEventListener('input', () => { color(); start(); });
  open.addEventListener('click', start);
  tools.addEventListener('click', (event) => {
    const action = event.target.closest('button')?.dataset.camera;
    if (action === 'left') viewer.rotate(-Math.PI / 12);
    if (action === 'right') viewer.rotate(Math.PI / 12);
    if (action === 'in') viewer.zoom(.8);
    if (action === 'out') viewer.zoom(1.25);
    if (action === 'reset') viewer.reset();
  });
  return () => { controller.abort(); viewer?.dispose(); };
}

export function mountFeatures(app) {
  const section = app.querySelector('.lp-feature-tour');
  mountSite(section.querySelector('.lp-demo-site'));
  mountFurniture(section.querySelector('.lp-demo-furniture'));
  return mountIllustration(section.querySelector('.lp-demo-illustration'));
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
