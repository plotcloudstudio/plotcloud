// Project props (2026-10-30): the one place in the Workspace where the project's shared parameters are set (bottom left, Project).
// Default holds what every study shares (location, time zone, true north, weather EPW with terrain and shelter, building type,
// units); the other tabs hold what only some studies read (sun and light, noise, water, views, structure). Each tab says which
// studies use it. Values save as a new shared-conditions revision (store.updateConditions), so saved results that used the old
// value are marked for rerun and never rewritten. Object types are listed with their counts; per-object properties are set on
// the object itself, so a type without shared props says so.
import * as S from './store.js';
import { studyInputs } from './parameters.js';
import { SIMS } from './data.js';
import { mountProjectClimate } from './project-climate.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// tab → the fields it edits: [parameter path, label, conditions key ['site'|'defaults', name], input]
const TABS = [
  ['Default', [['site.label', 'Site name', ['site', 'label'], 'text'], ['site.lat', 'Latitude', ['site', 'lat'], 'number', '°'], ['site.lon', 'Longitude', ['site', 'lon'], 'number', '°'], ['site.tz', 'Time zone', ['site', 'tz'], 'text'],
    ['site.north', 'True north', ['site', 'north'], 'number', '° clockwise'], ['project.buildingType', 'Building type', ['defaults', 'buildingType'], 'text'], ['display.units', 'Units', ['defaults', 'units'], ['Metric', 'Imperial']]], true],
  ['Sun & light', [['study.period', 'Study day', ['defaults', 'period'], ['Equinox', 'Summer solstice', 'Winter solstice']], ['study.plane', 'Work plane', ['defaults', 'plane'], 'number', 'm'], ['study.occStart', 'Occupied from', ['defaults', 'occStart'], 'number', 'h'], ['study.occEnd', 'Occupied until', ['defaults', 'occEnd'], 'number', 'h']]],
  ['Noise', [['study.band', 'Frequency band', ['defaults', 'band'], 'text']]],
  ['Water', [['study.rain', 'Design rainfall', ['defaults', 'rain'], 'number', 'mm/h'], ['study.duration', 'Storm duration', ['defaults', 'duration'], 'number', 'min']]],
  ['Views', [['study.eye', 'Eye height', ['defaults', 'eye'], 'number', 'm']]],
  ['Structure', [['study.code', 'Design code', ['defaults', 'code'], 'text']]],
];
// object types, with what each tab shows; counts come from the model
const TYPES = [['plot', 'Plot'], ['building', 'Building'], ['story', 'Story'], ['space', 'Space'], ['aperture', 'Aperture'], ['wall', 'Wall'], ['floor', 'Floor'], ['furniture', 'Furniture'], ['context', 'Context'], ['street', 'Street']];
const TAB_TYPES = { Default: TYPES.map(([k]) => k), 'Sun & light': ['building', 'space', 'aperture', 'context'], Noise: ['plot', 'wall', 'street'], Water: ['plot', 'street'], Views: ['space', 'aperture'], Structure: ['building', 'story', 'wall', 'floor'] };

export function mountProps(host, p, { counts = () => ({}), onClose = () => { } } = {}) {
  let tab = 'Default', type = 'project', note = '', disposeClimate = null;
  const usedBy = (paths) => SIMS.filter((s) => studyInputs(s.id).some((x) => paths.includes(x) || (paths.includes('weather.epw') && x === 'weather.epw'))).map((s) => s.name);
  // the weather in use: matched from the project's address automatically; Advanced changes it
  function weatherLine() { const w = S.conditionsOf(p).site.climate; return w ? esc(`${w.station || w.name}${Number.isFinite(w.distanceKm) ? ` · ${w.distanceKm.toFixed(1)} km from the site` : ''} · ${w.automatic ? 'matched from the address' : 'your file'}`) + (w.representativenessWarning ? `<small>${esc(w.representativenessWarning)}</small>` : '') : 'Matched from the project address when a study needs it.'; }
  function value([, , [k, n]]) { const c = S.conditionsOf(p); return c[k]?.[n]; }
  function draw() {
    disposeClimate?.(); disposeClimate = null;
    const [, fields, shared] = TABS.find(([t]) => t === tab), n = counts(), types = TAB_TYPES[tab];
    const used = usedBy([...fields.map((f) => f[0]), ...(shared ? ['weather.epw'] : [])]);
    host.innerHTML = `<header class="pp-tabs" role="tablist">${TABS.map(([t]) => `<button type="button" role="tab" data-pp-tab="${t}" aria-selected="${t === tab}">${t}</button>`).join('')}<button type="button" class="sp-x" data-pp="close" aria-label="Close project props">×</button></header>
      <div class="pp-body"><nav class="pp-types"><button type="button" data-pp-type="project" aria-pressed="${type === 'project'}">Project</button><hr>${types.map((k) => { const nm = TYPES.find(([q]) => q === k)[1]; return `<button type="button" data-pp-type="${k}" aria-pressed="${type === k}">${nm}${n[k] ? `<i>${n[k]}</i>` : ''}</button>`; }).join('')}</nav>
      <section class="pp-props">${type === 'project' ? `<h3>Project · ${esc(tab)}</h3><p class="pp-used">${used.length ? 'Used by ' + esc(used.join(', ')) : 'Used by no study yet'}</p>
        <form class="pp-form">${fields.map((f) => { const [path, label, , input, unit] = f, v = value(f);
          return `<label><span>${esc(label)}${unit ? ` <small>${esc(unit)}</small>` : ''}</span>${Array.isArray(input) ? `<select name="${path}">${input.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>` : `<input name="${path}" type="${input}" ${input === 'number' ? 'step="any"' : ''} value="${esc(v ?? '')}">`}</label>`; }).join('')}
          <button type="submit" class="btn sm primary">Save</button><p class="pp-note" role="status">${esc(note)}</p></form>${shared ? `<p class="pp-weather"><b>Weather</b> ${weatherLine()}</p><details class="pp-adv"><summary>Advanced · upload EPW, choose a station, terrain and shelter</summary><div class="pp-climate"><div id="sharedForm"></div></div></details>` : ''}
        <p class="pp-note">Saving makes a new shared revision. Results saved with earlier values keep them and are marked for rerun.</p>`
        : `<div class="pp-empty"><b>No props here</b><p>No shared props for “${esc(TYPES.find(([q]) => q === type)[1])}” in ${esc(tab)}. ${n[type] ? `This model has ${n[type]}. Select` : 'Select'} one in the model to set its own properties.</p></div>`}</section></div>`;
    if (type === 'project' && shared) { const c = host.querySelector('.pp-climate'); disposeClimate = mountProjectClimate(c, p); c.querySelector('#sharedForm')?.remove(); }
  }
  host.addEventListener('click', (e) => { const t = e.target.closest('[data-pp-tab]'), y = e.target.closest('[data-pp-type]'), x = e.target.closest('[data-pp]');
    if (t) { tab = t.dataset.ppTab; note = ''; if (type !== 'project' && !TAB_TYPES[tab].includes(type)) type = 'project'; draw(); } else if (y) { type = y.dataset.ppType; draw(); } else if (x) onClose(); });
  host.addEventListener('submit', (e) => {
    if (!e.target.classList.contains('pp-form')) return; e.preventDefault();
    const [, fields] = TABS.find(([t]) => t === tab), c = S.conditionsOf(p), site = { ...c.site }, defaults = { ...c.defaults }, fd = new FormData(e.target);
    try {
      for (const [path, label, [k, n], input] of fields) { const raw = fd.get(path); const v = input === 'number' ? (raw === '' ? undefined : +raw) : String(raw ?? '').trim();
        if (input === 'number' && raw !== '' && !Number.isFinite(v)) throw Error(`${label} must be a number.`); if (v === undefined || v === '') continue; (k === 'site' ? site : defaults)[n] = v; }
      if (site.tz && !(/^[+-]?\d{1,2}(\.\d+)?$/.test(String(site.tz)) && Math.abs(+site.tz) <= 14)) new Intl.DateTimeFormat('en', { timeZone: site.tz });   // an IANA zone, or a UTC offset in hours as new projects store it
      if (Number.isFinite(defaults.occEnd) && Number.isFinite(defaults.occStart) && defaults.occEnd <= defaults.occStart) throw Error('Occupied until must be later than occupied from.');
      if (Math.abs(site.lat) > 90 || Math.abs(site.lon) > 180) throw Error('Latitude is −90 to 90 and longitude −180 to 180.');
      const moved = site.lat !== c.site.lat || site.lon !== c.site.lon; if (moved) { site.sample = false; if (site.climate?.automatic) delete site.climate; }
      if (JSON.stringify({ site, defaults }) === JSON.stringify({ site: c.site, defaults: c.defaults })) { note = 'No changes to save.'; draw(); return; }
      S.updateConditions(p, site, defaults); S.save();
      const n = p.runs.filter((r) => S.runConditionsStatus(p, r).includes('rerun')).length; note = `Saved revision ${S.conditionsOf(p).revision}.${n ? ` ${n} saved result${n === 1 ? '' : 's'} need rerunning.` : ''}`;
    } catch (err) { note = err instanceof RangeError ? 'Enter a time zone such as America/Vancouver, or a UTC offset in hours such as -8.' : err.message; }
    draw();
  });
  draw();
  return () => { disposeClimate?.(); host.innerHTML = ''; };
}
