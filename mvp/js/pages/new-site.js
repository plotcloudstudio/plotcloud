import {weatherDownloadAvailable} from '../automatic-climate.js?v=epw-connected-20261027-3';
// New project from the map (#/new-site): find the place, set the study area, draw or pick your plot, load what is around it
// from open data, and start the project with the site already in Plan Studio (buildings, roads, water, green, trees, terrain).
// Nothing is invented: what a source does not have is shown as missing; heights that are guessed are marked as estimates.
import * as S from '../store.js';
import {ensureProjectClimate} from '../project-climate.js';
import { geocode, enrich } from '../site.js';
import { fetchOSM, fetchTerrain } from '../sitedata.js';
import { sitec } from '../studio-bridge.js';
import { toStudio } from '../studio-convert.js';
import { tzInfo } from '../sunscene.js';
import { LAYER_COLORS } from '../data.js';
import { $, $$, esc, toast, setCurrent, setCurrentVersion } from '../app.js';

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/';
function leaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!document.querySelector('link[data-leaflet]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = LEAFLET + 'leaflet.css'; l.dataset.leaflet = '1'; document.head.appendChild(l); }
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = LEAFLET + 'leaflet.js'; s.onload = () => res(window.L); s.onerror = () => rej(Error('The map could not load.')); document.head.appendChild(s); });
}
const RADII = [100, 150, 250, 400, 500];
const HCOL = { source: '#4a4a46', levels: '#7a7468', estimate: '#d9a400', none: '#c0392b' };

export async function render(app, _, params = new URLSearchParams()) {
  const A = S.account();
  if (!A.user) { location.hash = '#/login?next=new-site'; return; }
  const into = params.get('project') ? S.project(params.get('project')) : null;   // a new site for a project that exists, instead of a new project
  app.innerHTML = `<div class="ns">
    <div class="ns-map" id="map" aria-label="Map"><div class="ns-hint" id="hint" hidden></div></div>
    <aside class="ns-side" aria-label="New project from the map">
      <a class="btn sm ghost" href="${into ? `#/workspace/${into.id}` : '#/home'}">← ${into ? 'Workspace' : 'Dashboard'}</a>
      <h1 class="ns-h">${into ? `A site for ${esc(into.name)}` : "A new project, on its site"}</h1>
      <section class="ns-step"><h2><b>1</b>Find the place</h2>
        <form id="find" class="ns-row"><input class="inp" id="q" placeholder="An address or a place" aria-label="Address or place" autocomplete="street-address"><button class="btn primary">Find</button></form>
        <div class="ns-hits" id="hits"></div><p class="note" id="findMsg" role="status"></p></section>
      <section class="ns-step"><h2><b>2</b>Study area</h2>
        <p class="note">Drag the red point to the middle of the area you need. Everything within the circle comes in.</p>
        <div class="seg" id="rSeg" role="group" aria-label="Radius">${RADII.map((r) => `<button type="button" data-r="${r}" aria-pressed="${r === 250}">${r} m</button>`).join('')}</div></section>
      <section class="ns-step"><h2><b>3</b>Your plot</h2>
        <div class="ns-row"><button type="button" class="btn" id="drawPlot" aria-pressed="false">Draw the plot</button><button type="button" class="btn" id="pickPlot" aria-pressed="false" disabled title="Load the site first">Pick an outline</button><button type="button" class="btn ghost" id="clearPlot">Clear</button></div>
        <p class="note" id="plotMsg">Click its corners on the map; double-click to close it.</p>
        <label class="ns-ck"><input type="checkbox" id="dropOwn" checked> Leave out the buildings already on my plot</label></section>
      <section class="ns-step"><h2><b>4</b>What comes in</h2>
        <button type="button" class="btn accent" id="load">Load the site</button>
        <div id="facts" class="ns-facts"></div><p class="note" id="loadMsg" role="status"></p>
        <label class="ns-ck" id="estRow" hidden>Buildings without a height: about <input type="number" id="estN" min="1" max="60" value="3" class="inp ns-n"> storeys of 3 m (marked as estimates)</label></section>
      <section class="ns-step"><h2><b>5</b>Start</h2>
        ${into ? "" : '<label class="f">Project name<input class="inp" id="pname" placeholder="e.g. Granville Street housing"></label>'}
        <button type="button" class="btn accent lg" id="create" disabled>${into ? "Use this site and open the Workspace" : "Create the project and open the Workspace"}</button>
        <p class="note">Data © OpenStreetMap contributors (ODbL); terrain from AWS Terrain Tiles. It is copied into the project, so results stay the same when the map changes.</p></section>
    </aside></div>`;

  let L; try { L = await leaflet(); } catch (e) { $('#map', app).innerHTML = `<p class="note" style="padding:24px">${esc(e.message)}</p>`; return; }
  const home = A.site && Number.isFinite(A.site.lat) ? [A.site.lat, A.site.lon] : [49.2827, -123.1207];
  const map = L.map($('#map', app), { zoomControl: true, doubleClickZoom: false }).setView(home, 16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
  let R = 250, label = '', plot = [], drawing = false, picking = false, data = null, preview = null, plotLayer = null, tmpLine = null;
  const center = L.marker(home, { draggable: true, title: 'Middle of the study area' }).addTo(map), circle = L.circle(home, { radius: R, color: '#d8402a', weight: 1.5, fillOpacity: 0.04, interactive: false }).addTo(map);
  const stale = () => { if (data) { data = null; if (preview) { preview.remove(); preview = null; } $('#facts', app).innerHTML = ''; $('#loadMsg', app).textContent = 'The study area changed: load the site again.'; $('#pickPlot', app).disabled = true; } createUI(); };
  center.on('drag', () => circle.setLatLng(center.getLatLng())); center.on('dragend', stale);
  $$('#rSeg [data-r]', app).forEach((b) => b.onclick = () => { R = +b.dataset.r; $$('#rSeg [data-r]', app).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); circle.setRadius(R); stale(); });
  const hint = (t) => { const h = $('#hint', app); h.hidden = !t; h.textContent = t || ''; };

  // 1 · find
  $('#find', app).onsubmit = async (e) => { e.preventDefault(); const q = $('#q', app).value.trim(); if (!q) return; $('#findMsg', app).textContent = 'Searching…'; $('#hits', app).innerHTML = '';
    try { const r = await geocode(q); $('#findMsg', app).textContent = r.length ? 'Choose the right place:' : 'No match. Try a fuller address.';
      $('#hits', app).innerHTML = r.map((h, i) => `<button type="button" data-i="${i}">${esc(h.label)}</button>`).join('');
      $$('#hits [data-i]', app).forEach((b) => b.onclick = () => { const h = r[+b.dataset.i]; label = h.label; map.setView([h.lat, h.lon], 17); center.setLatLng([h.lat, h.lon]); circle.setLatLng([h.lat, h.lon]); $('#hits', app).innerHTML = ''; $('#findMsg', app).textContent = h.label;
        if ($('#pname', app) && !$('#pname', app).value) $('#pname', app).value = h.label.split(',')[0]; stale(); }); }
    catch (er) { $('#findMsg', app).textContent = er.message || 'Address search failed.'; } };

  // 3 · plot: drawn corner by corner, or an outline picked from what was loaded
  const plotUI = () => { if (plotLayer) plotLayer.remove(); plotLayer = plot.length > 2 ? L.polygon(plot, { color: '#d8402a', weight: 2.5, fillColor: '#d8402a', fillOpacity: 0.12, interactive: false }).addTo(map) : plot.length ? L.polyline(plot, { color: '#d8402a', weight: 2, dashArray: '4 4', interactive: false }).addTo(map) : null;
    const A2 = plot.length > 2 ? areaM2(plot) : 0; $('#plotMsg', app).textContent = plot.length > 2 && !drawing ? `Plot: ${Math.round(A2).toLocaleString('en-CA')} m², ${plot.length} corners.` : drawing ? `${plot.length} corner${plot.length === 1 ? '' : 's'} · double-click to close.` : 'Click its corners on the map; double-click to close it.'; createUI(); };
  const mode = (d, p) => { drawing = d; picking = p; $('#drawPlot', app).setAttribute('aria-pressed', String(d)); $('#pickPlot', app).setAttribute('aria-pressed', String(p)); map.getContainer().style.cursor = d || p ? 'crosshair' : ''; hint(d ? 'Click the corners of your plot; double-click to close it. Esc cancels.' : p ? 'Click a building or area outline to use it as your plot.' : ''); };
  $('#drawPlot', app).onclick = () => { if (drawing) { mode(false, false); plotUI(); return; } plot = []; mode(true, false); plotUI(); };
  $('#pickPlot', app).onclick = () => mode(false, !picking);
  $('#clearPlot', app).onclick = () => { plot = []; mode(false, false); plotUI(); };
  map.on('click', (e) => { if (drawing) { plot.push([e.latlng.lat, e.latlng.lng]); plotUI(); } });
  map.on('dblclick', () => { if (drawing) { if (plot.length > 3) plot.pop(); mode(false, false); if (plot.length < 3) plot = []; plotUI(); } });
  map.on('mousemove', (e) => { if (!drawing || !plot.length) return; if (tmpLine) tmpLine.remove(); tmpLine = L.polyline([plot.at(-1), [e.latlng.lat, e.latlng.lng]], { color: '#d8402a', weight: 1, dashArray: '3 4', interactive: false }).addTo(map); });
  const onKey = (e) => { if (e.key === 'Escape' && (drawing || picking)) { if (drawing) plot = []; mode(false, false); plotUI(); } }; addEventListener('keydown', onKey);

  // 4 · load: OpenStreetMap and the terrain, previewed on the map; the site itself is made at Create (from the final plot)
  $('#load', app).onclick = async () => {
    const c = center.getLatLng(), msg = $('#loadMsg', app); $('#load', app).disabled = true; msg.textContent = '';
    try {
      const osm = await fetchOSM(c.lat, c.lng, R, (t) => { msg.textContent = t; });
      msg.textContent = 'Reading the terrain…'; const SC = await sitec(), origin = { lat: c.lat, lon: c.lng, label };
      let terrain = null, tErr = ''; try { terrain = await fetchTerrain(SC.frame(origin), R, R > 250 ? 15 : R > 150 ? 10 : 5); } catch (er) { tErr = er.message; }
      msg.textContent = 'Reading the buildings…';
      const site = SC.siteFromOSM(osm.text, origin, { kind: 'radius', r: R }, { provider: osm.provider, at: osm.at });
      data = { osm, terrain, tErr, origin, R, site }; drawPreview(site, SC.frame(origin)); facts(site, terrain, tErr, osm);
      msg.textContent = `Loaded from ${osm.provider}.`; $('#pickPlot', app).disabled = false;
    } catch (er) { msg.textContent = er.message || 'The site could not be loaded.'; }
    finally { $('#load', app).disabled = false; createUI(); }
  };
  function drawPreview(site, F) {
    if (preview) preview.remove(); preview = L.layerGroup().addTo(map); const ll = (p) => { const q = F.inv(p[0], p[1]); return [q[0], q[1]]; };
    for (const a of site.areas) L.polygon(a.pts.map(ll), { stroke: false, fillColor: a.kind === 'water' ? '#78aad7' : '#8cbe78', fillOpacity: 0.45, interactive: true }).on('click', (e) => usePick(e, a.pts.map(ll))).addTo(preview);
    for (const r of site.roads) L.polyline(r.pts.map(ll), { color: r.cls === 'path' ? '#c9bfa6' : '#a99d80', weight: r.cls === 'main' ? 4 : r.cls === 'minor' ? 3 : 1.5, opacity: 0.8, interactive: false }).addTo(preview);
    for (const b of site.buildings) { if (b.excluded || !b.xy.length) continue; const src = b.h != null ? b.hSource : 'none';
      L.polygon(b.xy.map(ll), { color: HCOL[src] || '#555', weight: 1, fillColor: HCOL[src] || '#555', fillOpacity: 0.35 }).bindTooltip(`${b.name ? esc(b.name) + ' · ' : ''}${b.h != null ? Math.round(b.h) + ' m, ' + SC_LABEL(src) : 'no height in the data'}`, { sticky: true })
        .on('click', (e) => usePick(e, b.xy.map(ll))).addTo(preview); }
    for (const t of site.trees) L.circleMarker(ll(t.xy), { radius: 2, color: '#5a9650', weight: 0, fillOpacity: 0.7, interactive: false }).addTo(preview);
  }
  const SC_LABEL = (s) => ({ source: 'height from the map', levels: 'from the floor count', estimate: 'estimated', user: 'yours' })[s] || s;
  function usePick(e, ring) { if (!picking) return; L.DomEvent.stopPropagation(e); plot = ring.slice(); mode(false, false); plotUI(); }
  function facts(site, terrain, tErr, osm) {
    const B = site.buildings.filter((b) => !b.excluded && b.valid), n = B.length || 1, by = (k) => B.filter((b) => (b.h != null ? b.hSource : 'none') === k).length, miss = by('none');
    const rc = (c) => site.roads.filter((r) => r.cls === c).length, row = (k, v, s = '') => `<div><small>${k}</small><b>${v}</b>${s ? `<span>${s}</span>` : ''}</div>`;
    $('#facts', app).innerHTML = row('Buildings', B.length, `${Math.round(100 * by('source') / n)} % height from the map · ${Math.round(100 * by('levels') / n)} % from floor counts · ${Math.round(100 * miss / n)} % without a height`)
      + row('Roads', site.roads.length, `${rc('main')} main · ${rc('minor')} local · ${rc('path')} paths`) + row('Water and green', site.areas.length, `${site.areas.filter((a) => a.kind === 'water').length} water · ${site.areas.filter((a) => a.kind === 'green').length} green`)
      + row('Trees', site.trees.length) + row('Terrain', terrain ? `${terrain.relief} m` : 'flat', terrain ? `difference between high and low ground · ${terrain.res} m grid` : `not loaded (${esc(tErr || 'unavailable')}); the ground is taken as flat`)
      + `<p class="note ns-legend">${Object.entries({ source: 'height from the map', levels: 'from floor counts', none: 'no height' }).map(([k, t]) => `<i style="background:${HCOL[k]}"></i>${t}`).join(' ')}</p>`;
    $('#estRow', app).hidden = !miss;
  }
  const createUI = () => { $('#create', app).disabled = !data; $('#create', app).title = data ? '' : 'Load the site first'; };

  // 5 · create: the site is made around the plot (or the study area's middle), stored in the project, then the Workspace opens
  $('#create', app).onclick = async () => {
    if (!data) return; const btn = $('#create', app), msg = $('#loadMsg', app); btn.disabled = true;
    try {
      const SC = await sitec(), c = plot.length > 2 ? centroidLL(plot) : [data.origin.lat, data.origin.lon], origin = { lat: c[0], lon: c[1], label: label || data.origin.label };
      const F = SC.frame(origin), far = Math.hypot(...F.fwd(data.origin.lat, data.origin.lon));
      if (far > data.R * 0.6) throw Error('Your plot is far from the middle of the study area: move the red point onto it and load the site again.');
      msg.textContent = 'Making the site…'; if (!origin.label) origin.label = await placeName(origin.lat, origin.lon);
      const env = await enrich(origin.lat, origin.lon, data.R).catch(() => ({}));
      const tz = tzInfo({ tz: env.tz, lat: origin.lat, lon: origin.lon });
      const site = SC.siteFromOSM(data.osm.text, origin, { kind: 'radius', r: Math.max(50, data.R - far) }, { provider: data.osm.provider, at: data.osm.at, tz: tz.tz, dst: tz.dst });
      if (data.terrain) { try { site.terrain = await fetchTerrain(F, data.R, data.terrain.res); SC.groundFromOpen(site); } catch (er) { site.terrain = null; } }   // ground under buildings from the open ground around
      if (plot.length > 2) { site.parcel = { pts: plot.map(([la, lo]) => F.fwd(la, lo).map((v) => +v.toFixed(2))), source: 'drawn on the map' }; site.parcelId = 'Your plot';
        if ($('#dropOwn', app).checked) for (const b of site.buildings) if (!b.excluded && b.xy.length && SC.inside(SC.centroid(b.xy), site.parcel.pts)) SC.setExcluded(site, b.id, true, 'on your plot'); }
      const nEst = Math.max(1, Math.min(60, +$('#estN', app).value || 3)); SC.estimateMissing(site, nEst);
      const name = into ? into.name : ($('#pname', app).value.trim() || (origin.label || 'New project').split(',')[0]);
      const psite = { label: origin.label || `${origin.lat.toFixed(5)}, ${origin.lon.toFixed(5)}`, lat: origin.lat, lon: origin.lon, north: 0, tz: env.tz, elev: data.terrain ? data.terrain.elev0 : env.elev, rain: env.rain, wind: env.wind, windDir: env.windDir, koppen: env.koppen, buildings: site.buildings.filter((b) => !b.excluded).length, year: env.year };
      if (into) {   // the project keeps its model; its site is replaced (the change shows as unsaved until a version is saved)
        if (!into.draft.studio) throw Error('Open this project in the Workspace once, then choose its site.');
        into.draft.studio.site = site; into.draft.studio.north = 0; into.site = S.clone(psite); into.siteLinked = false; into.sharedConditions.site = S.clone(psite); into.updated = new Date().toISOString(); S.save();
        if(weatherDownloadAvailable())ensureProjectClimate(into).catch(()=>{});setCurrent(into); toast(`New site for ${into.name}: save a version to keep it`); location.hash = '#/workspace/' + into.id; return;
      }
      const studio = toStudio({ layers: [], components: [] }, psite, { name }); studio.site = site; studio.north = 0; studio.name = name;
      const layers = Object.keys(LAYER_COLORS).filter((k) => k !== 'Imported' && k !== 'Context').map((n) => ({ name: n, color: LAYER_COLORS[n], visible: true, locked: n === 'Site' }));
      const p = S.createProject(name, { units: 'm', north: 0, layers, components: [], studio });
      p.site = S.clone(psite); p.siteLinked = false; p.sharedConditions.site = S.clone(psite); S.saveVersion(p, 'Site from OpenStreetMap');
      if(weatherDownloadAvailable())ensureProjectClimate(p).catch(()=>{});setCurrent(p); setCurrentVersion(p, p.versions.at(-1).id); toast(`${name}: ${psite.buildings} buildings around your plot`); location.hash = '#/workspace/' + p.id;
    } catch (er) { msg.textContent = er.message || 'The project could not be made.'; btn.disabled = false; }
  };
  window.__newsite = { map, center, setPlot: (p) => { plot = p; plotUI(); }, get data() { return data; }, get plot() { return plot; } };
  return () => { removeEventListener('keydown', onKey); map.remove(); delete window.__newsite; };
}
function centroidLL(P) { let a = 0, x = 0, y = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], k = p[1] * q[0] - q[1] * p[0]; a += k; x += (p[0] + q[0]) * k; y += (p[1] + q[1]) * k; } return a ? [x / (3 * a), y / (3 * a)] : P[0]; }
function areaM2(P) { const la0 = P[0][0] * Math.PI / 180, k = 111320, xy = P.map(([la, lo]) => [lo * k * Math.cos(la0), la * k]); let s = 0; for (let i = 0; i < xy.length; i++) { const a = xy[i], b = xy[(i + 1) % xy.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s / 2); }
// a name for a point picked on the map without a search (Nominatim reverse, once)
async function placeName(lat, lon) {
  try { const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=17`, { headers: { Accept: 'application/json' } }); const j = await r.json(); return j.display_name || ''; } catch (e) { return ''; }
}
