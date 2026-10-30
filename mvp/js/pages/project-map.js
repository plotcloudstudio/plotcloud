// New project from a map location (#/new-project): a full-screen map with search, Map / Satellite, a project-location card
// (coordinate system and origin), the site data actually available at the point (checked live), the choice to bring the
// surroundings in now or later, and Start Project. With context, the existing OpenStreetMap + terrain pipeline builds the site
// (the same one as #/new-site); the Workspace then opens with the 3D site and the getting-started checklist.
import * as S from '../store.js';
import { enrich } from '../site.js';
import { suggest, resolve, placeLine } from '../address-suggest.js';
import { fetchOSM, fetchTerrain, terrainAt } from '../sitedata.js';
import { sitec } from '../studio-bridge.js';
import { toStudio } from '../studio-convert.js';
import { tzInfo } from '../sunscene.js';
import { LAYER_COLORS } from '../data.js';
import { stationCatalog, nearestStations, weatherDownloadAvailable } from '../automatic-climate.js?v=epw-connected-20261027-3';
import { ensureProjectClimate } from '../project-climate.js';
import { $, $$, esc, toast, setCurrent, setCurrentVersion } from '../app.js';

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/';
const leaflet = () => window.L ? Promise.resolve(window.L) : new Promise((res, rej) => {
  if (!document.querySelector('link[data-leaflet]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = LEAFLET + 'leaflet.css'; l.dataset.leaflet = '1'; document.head.append(l); }
  const s = document.createElement('script'); s.src = LEAFLET + 'leaflet.js'; s.onload = () => res(window.L); s.onerror = () => rej(Error('The map could not load. Check the connection and reload.')); document.head.append(s);
});
let R = 250;   // half the side of the study square (m); 250 = the #/new-site default; changeable on the location card

// WGS84 → UTM (zone from longitude, Norway/Svalbard exceptions not applied). Easting/northing in metres.
export function utm(lat, lon) {
  const zone = Math.min(60, Math.floor((lon + 180) / 6) + 1), a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2), rad = Math.PI / 180;
  const phi = lat * rad, lam = lon * rad, lam0 = ((zone - 1) * 6 - 180 + 3) * rad, N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2), T = Math.tan(phi) ** 2, C = ep2 * Math.cos(phi) ** 2, A = Math.cos(phi) * (lam - lam0);
  const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi) + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi) - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));
  const E = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
  let Nn = k0 * (M + N * Math.tan(phi) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24 + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720));
  if (lat < 0) Nn += 10000000;
  return { zone, hemisphere: lat < 0 ? 'S' : 'N', epsg: (lat < 0 ? 32700 : 32600) + zone, E: Math.round(E), N: Math.round(Nn) };
}

export async function render(app) {
  const A = S.account();
  if (!A.user) { location.hash = '#/login?next=new-project'; return; }
  app.innerHTML = `<div class="np">
    <div class="np-map" id="npMap" aria-label="Map: click to place the project"></div>
    <div class="np-search"><input id="npQ" class="np-input" placeholder="Search" aria-label="Search an address or place" autocomplete="off"><div id="npHits" class="np-hits" role="listbox" hidden></div></div>
    <section class="np-card np-data" id="npData" hidden aria-label="Available site data"></section>
    <div class="np-right">
      <section class="np-card" id="npLoc"><div class="np-title"><h2>Project location</h2><span id="npOk" class="np-ok" hidden aria-label="Location set">✓</span></div><p class="np-sub" id="npPlace">Please pick a location on the map</p><p class="np-note" id="npNote"></p><div id="npCoords" hidden>
        <label class="np-lab">Project size<select id="npSize" class="np-sel"><option value="150">300 m × 300 m</option><option value="250" selected>500 m × 500 m</option><option value="400">800 m × 800 m</option><option value="500">1000 m × 1000 m</option></select></label>
        <label class="np-lab">Coordinate system<select id="npCrs" class="np-sel"></select></label>
        <span class="np-lab">Project origin</span><div class="np-xy"><span>E:</span><input id="npE" readonly></div><div class="np-xy"><span>N:</span><input id="npN" readonly></div></div></section>
      <section class="np-card" id="npCtx" hidden><h2>Add site data?</h2><p class="np-sub">Automatically add roads, buildings, terrain and trees inside the ${2 * R} m square.</p>
        <label class="np-radio"><input type="radio" name="npCtx" value="yes" checked> Yes, I want context</label><label class="np-radio"><input type="radio" name="npCtx" value="later"> I’ll do this later</label></section>
      <section class="np-card" id="npGo" hidden><label class="np-lab">Project name<input id="npName" class="np-sel" placeholder="From the address"></label><button class="np-start" id="npStart" type="button">Start Project →</button><p class="np-sub" id="npMsg" role="status"></p></section>
    </div>
    <div class="np-layers" role="group" aria-label="Base map"><button type="button" data-base="map" aria-pressed="true"><span class="np-th np-th-map"></span>Map</button><button type="button" data-base="sat" aria-pressed="false"><span class="np-th np-th-sat"></span>Satellite</button></div>
    <a class="np-back" href="#/home" aria-label="Back to projects">←</a></div>`;
  let L; try { L = await leaflet(); } catch (e) { $('#npMap', app).innerHTML = `<p style="padding:24px">${esc(e.message)}</p>`; return; }
  const map = L.map($('#npMap', app), { zoomControl: false, worldCopyJump: true, attributionControl: true }).setView([30, 0], 3);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  const bases = {
    map: L.layerGroup([L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 16, maxZoom: 19, attribution: 'Esri, HERE, Garmin, © OpenStreetMap contributors' }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 16, maxZoom: 19 })]),
    sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' }),
  };
  bases.map.addTo(map);
  for (const b of $$('[data-base]', app)) b.onclick = () => { for (const k in bases) map.removeLayer(bases[k]); bases[b.dataset.base].addTo(map); for (const x of $$('[data-base]', app)) x.setAttribute('aria-pressed', String(x === b)); };
  const pin = L.marker([0, 0], { draggable: true, title: 'Project origin', icon: L.divIcon({ className: 'np-pin', html: '<span></span>', iconSize: [26, 34], iconAnchor: [13, 32] }) });
  let pick = null, check = 0, label = '', osm = null;

  // ---- search
  let timer = 0, seq = 0;
  // location hint for suggestions: the map when zoomed in, else your most recent project's site, else your account site
  const near = () => { const c = map.getCenter(); if (map.getZoom() >= 6) return { lat: c.lat, lon: c.lng };
    const last = S.projects().filter((x) => !x.deletedAt && !x.sample).map((x) => S.conditionsOf(x)?.site).find((x) => Number.isFinite(x?.lat) && !x.sample), a = S.account().site;
    return last ? { lat: last.lat, lon: last.lon } : Number.isFinite(a?.lat) ? { lat: a.lat, lon: a.lon } : null; };
  let ctrl = null;
  $('#npQ', app).oninput = () => { clearTimeout(timer); const q = $('#npQ', app).value.trim(), box = $('#npHits', app); if (q.length < 3) { box.hidden = true; return; } timer = setTimeout(async () => { const my = ++seq; ctrl?.abort(); ctrl = new AbortController();
    try { const rows = await suggest(q, { near: near(), signal: ctrl.signal }); if (my !== seq) return;
      box.innerHTML = rows.length ? rows.map((r, i) => `<button type="button" role="option" data-i="${i}"><b>${esc(r.title)}</b><small>${esc(r.place)}</small></button>`).join('') : '<p class="np-sub" style="padding:8px">No match yet. Keep typing, or click the map.</p>'; box.hidden = false;
      for (const b of $$('[data-i]', box)) b.onclick = async () => { box.hidden = true; try { const r = await resolve(rows[+b.dataset.i], q); $('#npQ', app).value = r.place; map.setView([r.lat, r.lon], 16); place(r.lat, r.lon, r.place, r.parts, r.note); } catch (e) { $('#npPlace', app).textContent = e.message; } }; }
    catch (e) { if (my === seq && e.name !== 'AbortError') { box.innerHTML = '<p class="np-sub" style="padding:8px">Address search is unavailable right now. Click the map instead.</p>'; box.hidden = false; } } }, 250); };
  $('#npQ', app).onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#npHits button', app)?.click(); } if (e.key === 'Escape') $('#npHits', app).hidden = true; };
  map.on('click', (e) => { if (e.originalEvent?.target?.closest?.('.np-search,.np-card')) return; place(e.latlng.lat, e.latlng.lng, ''); });
  pin.on('dragend', () => { const c = pin.getLatLng(); place(c.lat, c.lng, ''); });

  // ---- a location: card, coordinate system, live data check
  let square = null, sizeTags = [];
  function drawSquare() { if (!pick) return; const dLat = R / 110574, dLon = R / (111320 * Math.cos(pick.lat * Math.PI / 180)), b = [[pick.lat - dLat, pick.lon - dLon], [pick.lat + dLat, pick.lon + dLon]];
    if (square) square.setBounds(b); else square = L.rectangle(b, { color: '#111827', weight: 1.5, fillColor: '#ffffff', fillOpacity: 0.35, interactive: false }).addTo(map);
    for (const t of sizeTags) t.remove(); const side = `${2 * R} m`, tag = (ll, html, cls) => L.marker(ll, { interactive: false, icon: L.divIcon({ className: 'np-size ' + cls, html, iconSize: null }) }).addTo(map);
    sizeTags = [tag([pick.lat + dLat, pick.lon], `<span>${side}</span>`, 'np-size-top'), tag([pick.lat, pick.lon - dLon], `<span>${side}</span>`, 'np-size-left'), tag([pick.lat - dLat, pick.lon], '<em>Project size can be changed below</em>', 'np-size-bottom')]; }
  async function place(lat, lon, name, parts = null, note = '') {
    lon = ((lon + 540) % 360) - 180; pick = { lat, lon }; label = name; osm = null; pin.setLatLng([lat, lon]).addTo(map); drawSquare();
    const u = utm(lat, lon); $('#npOk', app).hidden = false; $('#npCoords', app).hidden = false; for (const id of ['npCtx', 'npGo']) $('#' + id, app).hidden = false;
    $('#npPlace', app).textContent = parts ? placeLine(parts) || name : name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`; $('#npNote', app).textContent = note || (parts && name ? name : '');
    $('#npCrs', app).innerHTML = `<option value="utm">UTM Zone ${u.zone}${u.hemisphere} · EPSG:${u.epsg}</option><option value="wgs84">WGS 84 latitude / longitude</option>`;
    const show = () => { const v = $('#npCrs', app).value; $('#npE', app).value = v === 'utm' ? u.E : lon.toFixed(6); $('#npN', app).value = v === 'utm' ? u.N : lat.toFixed(6); $$('.np-xy span', app)[0].textContent = v === 'utm' ? 'E:' : 'Lon:'; $$('.np-xy span', app)[1].textContent = v === 'utm' ? 'N:' : 'Lat:'; };
    $('#npCrs', app).onchange = show; show();
    if (!$('#npName', app).dataset.typed) $('#npName', app).value = (name || '').split(',')[0];
    if (!name) { const my = pick; reverse(lat, lon).then((n) => { if (pick === my && n) { label = n; $('#npPlace', app).textContent = n.split(',').map((x) => x.trim()).reverse().slice(0, 3).join(', '); $('#npNote', app).textContent = n; if (!$('#npName', app).dataset.typed) $('#npName', app).value = n.split(',')[0]; } }); }
    dataCheck(lat, lon);
  }
  $('#npName', app).oninput = (e) => { e.target.dataset.typed = '1'; };
  $('#npSize', app).onchange = (e) => { R = +e.target.value; drawSquare(); $('#npCtx p', app).textContent = `Automatically add roads, buildings, terrain and trees inside the ${2 * R} m square.`; if (pick) { osm = null; dataCheck(pick.lat, pick.lon); } };

  async function dataCheck(lat, lon) {
    const my = ++check, card = $('#npData', app); card.hidden = false;
    const row = (k, v, src, state) => `<div class="np-row" data-source="${k}" data-state="${state}"><div><b>${k}</b><span class="np-src">${esc(src)}</span></div><em>${esc(v)}</em></div>`;
    const draw = (r) => { if (my !== check) return; const states = Object.values(r).map((x) => x.state), ok = states.filter((s) => s === 'ok').length, pending = states.includes('checking');
      const cov = pending ? ['Checking…', 'checking'] : ok >= 3 ? ['Good coverage', 'good'] : ok >= 2 ? ['Medium coverage', 'medium'] : ['Low coverage', 'low'];
      card.innerHTML = `<div class="np-title"><h2>Available site data</h2><span class="np-badge" data-coverage="${cov[1]}">${cov[0]}</span></div>${Object.entries(r).map(([k, x]) => row(k, x.v, x.src, x.state)).join('')}<p class="np-foot">Data found here is copied into the project when it starts, so results do not change when the sources do.</p>`; };
    const r = { Terrain: { v: 'Checking…', src: 'AWS Terrain Tiles', state: 'checking' }, Buildings: { v: 'Checking…', src: 'OpenStreetMap', state: 'checking' }, Streets: { v: 'Checking…', src: 'OpenStreetMap', state: 'checking' }, Weather: { v: 'Checking…', src: 'EPW station index', state: 'checking' }, 'Property boundaries': { v: 'No data available', src: 'No source connected', state: 'none' } };
    draw(r);
    terrainAt(lat, lon).then((h) => { r.Terrain = { v: `${h} m above sea level`, src: 'AWS Terrain Tiles', state: 'ok' }; draw(r); }, () => { r.Terrain = { v: 'Not available', src: 'AWS Terrain Tiles', state: 'none' }; draw(r); });
    stationCatalog().then((c) => { const s = nearestStations({ lat, lon }, c.stations, 1)[0]; r.Weather = s ? { v: `${s.name} · ${s.distanceKm.toFixed(0)} km`, src: s.provider === 'onebuilding' ? 'Climate.OneBuilding' : 'EnergyPlus weather', state: s.distanceKm <= 100 ? 'ok' : 'far' } : { v: 'No station', src: 'EPW station index', state: 'none' }; draw(r); }, () => { r.Weather = { v: 'Catalogue unavailable', src: 'EPW station index', state: 'none' }; draw(r); });
    try { const o = await fetchOSM(lat, lon, R); if (my !== check) return; osm = o; const { b, s } = countWays(o.text);
      r.Buildings = { v: b ? `${b} mapped nearby` : 'None mapped here', src: o.provider || 'OpenStreetMap', state: b ? 'ok' : 'none' }; r.Streets = { v: s ? `${s} street and path segments` : 'None mapped here', src: o.provider || 'OpenStreetMap', state: s ? 'ok' : 'none' }; draw(r); }
    catch (e) { if (my !== check) return; r.Buildings = { v: 'Could not be checked', src: 'OpenStreetMap', state: 'none' }; r.Streets = { v: 'Could not be checked', src: 'OpenStreetMap', state: 'none' }; draw(r); }
  }

  // ---- start: build the site now (context) or create the project at the location and add the site later
  $('#npStart', app).onclick = async () => {
    if (!pick) return; const btn = $('#npStart', app), msg = $('#npMsg', app), ctx = app.querySelector('[name=npCtx]:checked').value === 'yes'; btn.disabled = true;
    try {
      msg.textContent = 'Reading location details…'; const env = await enrich(pick.lat, pick.lon, R).catch(() => ({})), tz = tzInfo({ tz: env.tz, lat: pick.lat, lon: pick.lon });
      const name = $('#npName', app).value.trim() || (label || 'New project').split(',')[0];
      const psite = { label: label || `${pick.lat.toFixed(5)}, ${pick.lon.toFixed(5)}`, lat: pick.lat, lon: pick.lon, north: 0, tz: env.tz || tz.tz, elev: env.elev, rain: env.rain, wind: env.wind, windDir: env.windDir, koppen: env.koppen, year: env.year, crs: { kind: $('#npCrs', app).value, ...utm(pick.lat, pick.lon) } };
      const layers = Object.keys(LAYER_COLORS).filter((k) => k !== 'Imported' && k !== 'Context').map((n) => ({ name: n, color: LAYER_COLORS[n], visible: true, locked: n === 'Site' }));
      let studio;
      if (ctx) {
        msg.textContent = 'Loading buildings, roads and terrain…';
        const SC = await sitec(), origin = { lat: pick.lat, lon: pick.lon, label: psite.label }, F = SC.frame(origin);
        const o = osm || await fetchOSM(pick.lat, pick.lon, R, (t) => { msg.textContent = t; });
        const site = SC.siteFromOSM(o.text, origin, { kind: 'radius', r: R }, { provider: o.provider, at: o.at, tz: tz.tz, dst: tz.dst });
        try { site.terrain = await fetchTerrain(F, R, 10); SC.groundFromOpen(site); psite.elev = site.terrain.elev0 ?? psite.elev; } catch (e) { site.terrain = null; }
        SC.estimateMissing(site, 3); psite.buildings = site.buildings.filter((b) => !b.excluded).length;
        studio = toStudio({ layers: [], components: [] }, psite, { name }); studio.site = site; studio.north = 0; studio.name = name;
      }
      const p = S.createProject(name, { units: 'm', north: 0, layers, components: [], ...(studio ? { studio } : {}) });
      p.site = S.clone(psite); p.siteLinked = false; S.updateConditions(p, psite, p.sharedConditions.defaults, { keepRevision: true });
      p.onboarding = { created: new Date().toISOString(), siteContext: ctx };
      S.saveVersion(p, ctx ? 'Site from OpenStreetMap and terrain' : 'Project location');
      if (weatherDownloadAvailable()) ensureProjectClimate(p).catch(() => { });
      setCurrent(p); setCurrentVersion(p, p.versions.at(-1).id); toast(ctx ? `${name}: ${psite.buildings} surrounding buildings and terrain added` : `${name} created at this location`);
      try { const u = JSON.parse(localStorage.getItem('pc-mvp-ws2') || '{}'); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ...u, view: 'persp' })); } catch (e) { }   // open on the 3D site
      location.hash = '#/workspace/' + p.id;
    } catch (e) { msg.textContent = e.message || 'The project could not be started.'; btn.disabled = false; }
  };
  window.__newProjectMap = { place, map, get osm() { return osm; } };
  return () => { map.remove(); delete window.__newProjectMap; };
}
// mapped buildings and street ways (not every tagged node): OSM XML from the API or Overpass JSON
export function countWays(text) {
  if (/^\s*</.test(text)) { const ways = text.split('<way ').slice(1); return { b: ways.filter((w) => /k="building"/.test(w.split('</way>')[0])).length, s: ways.filter((w) => /k="highway"/.test(w.split('</way>')[0])).length }; }
  try { const els = JSON.parse(text).elements || []; return { b: els.filter((e) => e.type === 'way' && e.tags?.building).length, s: els.filter((e) => e.type === 'way' && e.tags?.highway).length }; } catch { return { b: 0, s: 0 }; }
}
async function reverse(lat, lon) { try { const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=14`, { headers: { Accept: 'application/json' } }); const j = await r.json(); return j.display_name || ''; } catch (e) { return ''; } }
