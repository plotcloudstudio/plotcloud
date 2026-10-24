import * as S from '../store.js';
import { geocode, enrich, mapEmbed } from '../site.js';
import { $, $$, esc, when, toast, setCurrent, img, refreshWho } from '../app.js';

const FIELDS = [
  ['label', 'Site', (s) => s.label, () => 'From address search'],
  ['lat', 'Latitude / longitude', (s) => `${s.lat.toFixed(4)}°, ${s.lon.toFixed(4)}°`, () => 'From the pin'],
  ['north', 'True north', (s) => `${s.north ?? 0}° from up`, () => 'Adjustable below'],
  ['tz', 'Time zone', (s) => s.tz, (s) => `Open-Meteo · ${s.year}`],
  ['koppen', 'Climate (Köppen)', (s) => s.koppen, (s) => `ERA5 reanalysis ${s.year} · Open-Meteo`],
  ['rain', 'Annual rainfall', (s) => `${s.rain.toLocaleString('en-CA')} mm`, (s) => `ERA5 ${s.year} · Open-Meteo`],
  ['wind', 'Wind', (s) => `${s.windDir || '—'} · ${s.wind} m/s mean`, (s) => `ERA5 ${s.year} · prevailing direction`],
  ['elev', 'Ground elevation', (s) => `${s.elev} m`, () => 'Copernicus DEM · Open-Meteo'],
  ['buildings', 'Buildings mapped around', (s) => `${s.buildings} within ${S.account().defaults.radius} m`, () => 'OpenStreetMap · Overpass'],
];
// each default and the simulation inputs it fills in (sim-engine.js applies them; a run records what it used)
const DEF = [
  ['units', 'Units', ['Metric'], 'every simulation (all engines work in metres)'], ['radius', 'Study radius (m)', 'number', 'the building count above'], ['plane', 'Work plane height (m)', 'number', 'Daylight'],
  ['occStart', 'Occupied from (h)', 'number', 'Daylight'], ['occEnd', 'Occupied until (h)', 'number', 'Daylight'], ['period', 'Sun study period', ['Equinox', 'Summer solstice', 'Winter solstice'], 'Sun hours (Mar 20, Jun 21 or Dec 21)'],
  ['rain', 'Design storm (mm/h)', 'number', 'Stormwater'], ['duration', 'Storm duration (min)', 'number', 'Stormwater'], ['band', 'Acoustic band', ['125 Hz', '250 Hz', '500 Hz', '1 kHz', '2 kHz', '4 kHz'], 'Indoor acoustics'],
  ['eye', 'Eye height (m)', 'number', 'Isovist'], ['code', 'Structural code', ['NBC 2020'], 'Structural analysis (the code it checks)'],
];

export function render(app) {
  const A = S.account();
  if (!A.user) { location.hash = '#/login?next=account'; return; }
  let site = S.clone(A.site), loading = false;

  app.innerHTML = `<div class="acct">
  <nav aria-label="Account sections"><span class="eyebrow" style="margin-bottom:10px">Account</span><a href="#/account" data-jump="site">Site</a><a href="#/account" data-jump="defaults">Simulation defaults</a><a href="#/account" data-jump="projects">Your projects</a><a href="#/account" data-jump="plan">Plan</a><a href="#/" id="logout">Log out</a></nav>
  <div>
    <section id="site">
      <div class="kicker"><b>01</b>Site</div>
      <h1 class="display md" style="margin-top:16px">Where is the project?</h1>
      <p class="lede" style="margin-top:14px">Anywhere in the world. New projects start on this site, and every simulation reads the same location, north, climate and surroundings.</p>
      <form id="find" style="display:flex;gap:8px;margin-top:24px;max-width:720px"><label for="q" class="sr" style="position:absolute;left:-9999px">Address, place or coordinates</label>
        <input id="q" class="inp round" placeholder="An address, a place or “lat, lon” — e.g. Shibuya Station, Tokyo" autocomplete="street-address"><button class="btn accent lg" style="min-height:48px">Find</button></form>
      <div class="results" id="hits"></div>
      <p class="note" id="findMsg" role="status" style="margin-top:8px"></p>
      <div class="grid g2" style="margin-top:20px;align-items:start">
        <div><div class="map" id="map"></div><p class="note" style="margin-top:8px">Map © OpenStreetMap contributors.</p>
          <label class="f" style="margin-top:12px;max-width:220px">True north (° clockwise from up)<input type="number" id="north" step="1" min="-180" max="180"></label></div>
        <div><div class="facts" id="facts"></div>
          <p class="note" style="margin-top:10px">Values come from the sources named under each one. A value a source does not return is marked missing; enter it in the simulation, or load a weather file there.</p>
          <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="btn primary" id="saveSite">Use as my default site</button><span class="note" id="siteState" style="align-self:center"></span></div></div>
      </div>
    </section>

    <section id="defaults">
      <div class="kicker"><b>02</b>Simulation defaults</div>
      <h2 class="display sm" style="margin-top:16px">Set once, used everywhere.</h2>
      <p class="lede" style="margin-top:14px">Each simulation opens with these values, linked: change one here and every simulation picks it up the next time it opens. Change a value inside a run when one study needs something different; the run records what it used and what differed from here.</p>
      <div class="grid g3" id="defs" style="margin-top:24px"></div>
      <button class="btn primary" id="saveDefs" style="margin-top:18px">Save defaults</button>
    </section>

    <section id="projects">
      <div class="kicker"><b>03</b>Your projects</div>
      <div style="display:flex;justify-content:space-between;align-items:end;gap:16px;flex-wrap:wrap;margin-top:16px"><h2 class="display sm">Your projects</h2><button class="btn accent" id="newP">+ New project on my site</button></div>
      <div class="grid g3" id="plist" style="margin-top:24px"></div>
    </section>

    <section id="plan">
      <div class="kicker"><b>04</b>Plan</div>
      <div class="pplan pro" style="margin-top:20px;flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:space-between">
        <div><span class="eyebrow">Current plan</span><p style="font-size:26px;font-weight:800;letter-spacing:-.03em;margin-top:6px">PlotCloud Pro · trial</p>
          <p class="muted">Prototype: no payment is taken. On the real site the trial is 7 days, then CAD 79 a year or CAD 9 a month.</p></div>
        <a class="btn accent lg" href="#/pricing">See plans</a></div>
      <p class="note" style="margin-top:14px">Signed in as ${esc(A.user.name)} · ${esc(A.user.email)} · this prototype keeps your account in this browser only.</p>
      <button class="btn sm ghost" id="reset" style="margin-top:8px">Reset sample data</button>
    </section>
  </div></div>`;

  const facts = () => {
    $('#facts', app).innerHTML = FIELDS.map(([k, label, val, src]) => {
      const missing = site[k] == null || site[k] === '' || (typeof site[k] === 'number' && !Number.isFinite(site[k]));
      const wait = loading && ['tz', 'koppen', 'rain', 'wind', 'elev', 'buildings'].includes(k) && missing;
      return `<div><small>${label}</small><b>${missing ? '—' : esc(val(site))}</b><span class="${wait ? 'wait' : missing ? 'miss' : ''}">${wait ? 'Loading…' : missing ? 'Missing · enter it in the study' : esc(src(site))}</span></div>`;
    }).join('') + (site.sample ? '<div style="grid-column:1/-1"><small>Sample site</small><b>Illustrative values</b><span class="miss">Search an address to load live data</span></div>' : '');
    $('#map', app).innerHTML = `<iframe title="Map of the site" loading="lazy" src="${mapEmbed(site.lat, site.lon)}"></iframe>`;
    $('#north', app).value = site.north ?? 0;
    const same = JSON.stringify(site) === JSON.stringify(A.site); $('#siteState', app).textContent = same ? 'This is your default site.' : 'Not saved yet.';
  };
  async function pick(h) {
    site = { label: h.label, lat: h.lat, lon: h.lon, north: 0 }; loading = true; facts();
    $('#hits', app).innerHTML = ''; $('#findMsg', app).textContent = 'Reading site data…';
    const d = await enrich(h.lat, h.lon, A.defaults.radius); loading = false;
    Object.assign(site, { tz: d.tz, koppen: d.koppen, rain: d.rain, wind: d.wind, windDir: d.windDir, elev: d.elev, buildings: d.buildings, year: d.year });
    const miss = Object.entries(d.status).filter(([, v]) => v !== 'ok').map(([k]) => ({ elev: 'elevation', climate: 'climate', buildings: 'building count' })[k]);
    $('#findMsg', app).textContent = miss.length ? `Could not load ${miss.join(', ')} right now; those values are marked missing.` : 'Site data loaded.';
    facts();
  }
  $('#find', app).onsubmit = async (e) => {
    e.preventDefault(); const q = $('#q', app).value.trim(); if (!q) return; const hits = $('#hits', app); hits.innerHTML = '';
    const ll = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (ll && Math.abs(+ll[1]) <= 90 && Math.abs(+ll[2]) <= 180) { pick({ label: `${(+ll[1]).toFixed(5)}, ${(+ll[2]).toFixed(5)}`, lat: +ll[1], lon: +ll[2] }); return; }
    $('#findMsg', app).textContent = 'Searching…';
    try { const r = await geocode(q); $('#findMsg', app).textContent = r.length ? 'Choose the right place:' : 'No match. Try a fuller address or “lat, lon”.';
      hits.innerHTML = r.map((h, i) => `<button type="button" data-i="${i}">${esc(h.label)}</button>`).join(''); $$('[data-i]', hits).forEach((b) => b.onclick = () => pick(r[+b.dataset.i])); }
    catch (err) { $('#findMsg', app).textContent = err.message || 'Address search failed. Try “lat, lon”.'; }
  };
  $('#north', app).onchange = (e) => { const v = +e.target.value; if (Number.isFinite(v)) { site.north = Math.max(-180, Math.min(180, v)); facts(); } };
  $('#saveSite', app).onclick = () => { A.site = S.clone(site); S.save(); facts(); plist(); const n = S.projects().filter((p) => p.siteLinked !== false).length; toast(`Default site saved · ${n} project${n === 1 ? '' : 's'} follow it`); };
  $('#defs', app).innerHTML = DEF.map(([k, label, type, used]) => `<label class="f card" style="padding:14px">${label}${Array.isArray(type)
    ? `<select data-k="${k}">${type.map((o) => `<option ${String(A.defaults[k]).toLowerCase() === o.toLowerCase() ? 'selected' : ''}>${o}</option>`).join('')}</select>`
    : `<input type="${type}" data-k="${k}" value="${esc(A.defaults[k])}" ${type === 'number' ? 'step="any"' : ''}>`}<span class="note">Used by ${used}</span></label>`).join('');
  $('#saveDefs', app).onclick = () => { for (const i of $$('[data-k]', app)) { const v = i.type === 'number' ? +i.value : i.value.trim(); if (i.type === 'number' && !Number.isFinite(v)) continue; A.defaults[i.dataset.k] = v; } S.save(); toast('Defaults saved'); };
  const plist = () => {
    $('#plist', app).innerHTML = S.projects().map((p) => `<article class="card pcard"><div class="thumb"><img data-holo="${p.sample ? 'hero' : 'heroA'}" src="${img(p.sample ? 'hero' : 'heroA')}" alt=""></div><h3>${esc(p.name)}</h3>
      <p class="meta">${esc((S.siteOf(p)?.label || '').split(',')[0])} · ${p.versions.length} versions · ${p.runs.length} results</p>
      <label class="note" style="display:flex;gap:6px;align-items:center;margin-top:6px"><input type="checkbox" data-link="${p.id}" ${p.siteLinked === false ? '' : 'checked'}> Follows my default site</label>
      <div class="acts"><a class="btn sm primary" href="#/workspace/${p.id}" data-p="${p.id}">Open</a><a class="btn sm" href="#/results/${p.id}" data-p="${p.id}">Results</a></div></article>`).join('');
    $$('[data-p]', app).forEach((a) => a.addEventListener('click', () => setCurrent(S.project(a.dataset.p))));
    // a project follows the Account site (a new address reaches all its simulations) or keeps its own copy of it
    $$('[data-link]', app).forEach((c) => c.onchange = () => { const p = S.project(c.dataset.link); S.linkSite(p, c.checked); toast(c.checked ? `${p.name} follows your default site` : `${p.name} keeps its own site: ${(p.site.label || '').split(',')[0]}`); plist(); });
  };
  $('#newP', app).onclick = () => { const name = prompt('Project name', 'New project'); if (name === null) return; const p = S.createProject(name.trim() || 'New project', { units: 'm', north: A.site.north || 0, layers: [{ name: 'Imported', color: '#d5d2cb', visible: true, locked: false }], components: [] }); setCurrent(p); location.hash = '#/workspace/' + p.id; };
  $('#logout', app).onclick = (e) => { e.preventDefault(); A.user = null; S.save(); refreshWho(); location.hash = '#/'; };
  $$('[data-jump]', app).forEach((a) => a.onclick = (e) => { e.preventDefault(); document.getElementById(a.dataset.jump).scrollIntoView({ behavior: 'smooth' }); });
  $('#reset', app).onclick = () => { if (!confirm('Remove all prototype projects and settings in this browser and restore the sample?')) return; S.reset(); location.hash = '#/'; location.reload(); };
  facts(); plist();
}
