import * as S from '../store.js';
import { geocode, enrich, mapEmbed } from '../site.js';
import { $, $$, esc, when, toast, refreshWho } from '../app.js';

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

const TABS = [['profile', 'Profile'], ['site', 'Site & defaults'], ['plan', 'Plan'], ['data', 'Backup & data'], ['notify', 'Notifications']];
const size = (b) => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

export function render(app, _, params = new URLSearchParams()) {
  const A = S.account();
  if (!A.user) { location.hash = '#/login?next=account'; return; }
  let site = S.clone(A.site), loading = false, tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'site';
  const N = A.notify || { batch: true, stale: true };

  app.innerHTML = `<div class="acct">
  <nav aria-label="Account settings" role="tablist"><span class="eyebrow" style="margin-bottom:10px">Account settings</span>${TABS.map(([k, n]) => `<a href="#/account?tab=${k}" role="tab" data-tab="${k}">${n}</a>`).join('')}<a href="#/home">← Dashboard</a><a href="#/" id="logout">Log out</a></nav>
  <div>
    <section id="profile" data-pane="profile">
      <div class="kicker"><b>01</b>Profile</div>
      <h1 class="display md" style="margin-top:16px">You.</h1>
      <form id="prof" class="grid g2" style="margin-top:24px;max-width:720px">
        <label class="f">Name<input name="name" autocomplete="name" required value="${esc(A.user.name)}"></label>
        <label class="f">Email<input name="email" type="email" autocomplete="email" required value="${esc(A.user.email || '')}"></label>
        <label class="f">Units<select disabled><option>Metric (every engine works in metres)</option></select></label>
        <label class="f">Language<select disabled><option>English</option></select></label>
        <label class="f">Time zone of this computer<input disabled value="${esc(Intl.DateTimeFormat().resolvedOptions().timeZone || '—')}"></label>
        <div style="align-self:end"><button class="btn primary">Save profile</button></div>
      </form>
      <p class="note" style="margin-top:10px">Member since ${A.user.since ? when(A.user.since) : 'today'}. Prototype: no server yet, so your account lives in this browser and no password is stored.</p>
      <div class="card" style="margin-top:36px;max-width:720px;border-color:var(--red)"><b>Delete account</b><p class="note" style="margin:6px 0 12px">Removes your account, every project, version and result, and your settings from this browser. Download a backup first if you may want them back.</p><button class="btn sm danger" id="delAcct">Delete my account…</button></div>
    </section>

    <section id="site" data-pane="site">
      <div class="kicker"><b>02</b>Site</div>
      <h1 class="display md" style="margin-top:16px">Where is the project?</h1>
      <p class="lede" style="margin-top:14px">Defaults for new projects. Sun Hours and Daylight keep a project snapshot; edit Shared conditions on a project to change their site. Other studies retain the existing linked-site behaviour during this pilot.</p>
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

    <section id="defaults" data-pane="site">
      <div class="kicker"><b>02</b>Simulation defaults</div>
      <h2 class="display sm" style="margin-top:16px">Defaults for new projects.</h2>
      <p class="lede" style="margin-top:14px">Sun Hours and Daylight copy these into each project once. Existing projects keep their saved shared conditions. Edit Project shared conditions to update a project, or use study-only overrides for one run. Other simulations retain their existing settings during this pilot.</p>
      <div class="grid g3" id="defs" style="margin-top:24px"></div>
      <button class="btn primary" id="saveDefs" style="margin-top:18px">Save defaults</button>
    </section>

    <section id="projects" data-pane="site">
      <div class="kicker"><b>02</b>Projects on this site</div>
      <div style="display:flex;justify-content:space-between;align-items:end;gap:16px;flex-wrap:wrap;margin-top:16px"><h2 class="display sm">Which projects follow it.</h2><a class="btn" href="#/home">Manage projects on the Dashboard →</a></div>
      <div id="plist" class="acct-rows" style="margin-top:20px"></div>
    </section>

    <section id="plan" data-pane="plan">
      <div class="kicker"><b>03</b>Plan</div>
      <div class="pplan pro" style="margin-top:20px;flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:space-between">
        <div><span class="eyebrow">Current plan</span><p style="font-size:26px;font-weight:800;letter-spacing:-.03em;margin-top:6px">PlotCloud Pro · trial</p>
          <p class="muted" id="trialLeft"></p>
          <p class="muted">Prototype: no payment is taken. On the real site the trial is 7 days, then CAD 79 a year or CAD 9 a month.</p></div>
        <a class="btn accent lg" href="#/pricing">See plans</a></div>
      <p class="note" style="margin-top:14px">Billing, invoices and team seats need the server and are coming; nothing here charges you.</p>
    </section>

    <section id="data" data-pane="data">
      <div class="kicker"><b>04</b>Backup &amp; data</div>
      <h2 class="display sm" style="margin-top:16px">Your data stays in this browser.</h2>
      <p class="lede" style="margin-top:14px">A backup file holds every project, version, result and setting. Bring it back here or on another computer.</p><p class="note">Shared EPW contents are browser-local and are not included in this JSON backup. Keep the original EPW file; upload it again under Project shared conditions after restoring on another computer.</p>
      <div class="grid g2" style="margin-top:24px;align-items:start">
        <div class="card"><b>Back up</b><p class="note" style="margin:6px 0 12px" id="lastB"></p><button class="btn primary" id="exp">Download backup (.json)</button></div>
        <div class="card"><b>Restore</b><p class="note" style="margin:6px 0 12px">From a PlotCloud backup file.</p>
          <label class="f">What to do with it<select id="impMode"><option value="merge">Add its projects to mine</option><option value="replace">Replace everything here</option></select></label>
          <input type="file" id="impFile" accept=".json,application/json" hidden><button class="btn" id="imp" style="margin-top:10px">Choose a backup file…</button><p class="note" id="impMsg" role="status" style="margin-top:8px"></p></div>
        <div class="card"><b>Space</b><div class="db-meter" style="margin:10px 0 6px"><i id="useBar"></i></div><p class="note" id="useTxt"></p>
          <button class="btn sm" id="prune" style="margin-top:10px">Remove pictures of older results</button><p class="note" style="margin-top:6px">Keeps every figure; only results not on a project's latest version lose their picture and per-point values.</p></div>
        <div class="card"><b>Start over</b><p class="note" style="margin:6px 0 12px">Remove all projects and settings in this browser and restore the sample project.</p><button class="btn sm danger" id="reset">Reset sample data…</button></div>
      </div>
    </section>

    <section id="notify" data-pane="notify">
      <div class="kicker"><b>05</b>Notifications</div>
      <h2 class="display sm" style="margin-top:16px">What to tell you.</h2>
      <div class="grid" style="margin-top:24px;max-width:720px;gap:10px">
        <label class="card acct-sw"><span><b>A batch run finishes or fails</b><small class="note">A message on the Results page.</small></span><input type="checkbox" data-n="batch" ${N.batch !== false ? 'checked' : ''}></label>
        <label class="card acct-sw"><span><b>Results need a rerun</b><small class="note">Shown under “Needs attention” on the Dashboard when a model or shared conditions changed.</small></span><input type="checkbox" data-n="stale" ${N.stale !== false ? 'checked' : ''}></label>
        <label class="card acct-sw" style="opacity:.6"><span><b>Email me a weekly summary</b><small class="note">Coming: email needs the server.</small></span><input type="checkbox" disabled></label>
      </div>
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
  $('#saveDefs', app).onclick = () => { const next={...A.defaults};for (const i of $$('[data-k]', app)) { const v = i.type === 'number' ? +i.value : i.value.trim(); if (i.type === 'number' && !Number.isFinite(v)) continue; next[i.dataset.k] = v; } if(next.plane<0||next.plane>1.5||!Number.isInteger(next.occStart)||!Number.isInteger(next.occEnd)||next.occStart<0||next.occStart>23||next.occEnd<=next.occStart||next.occEnd>24){toast('Use a work plane from 0–1.5 m and whole occupied hours with start earlier than end.');return;}A.defaults=next;S.save();toast('Defaults saved · existing Sun Hours and Daylight projects unchanged'); };
  const plist = () => {
    $('#plist', app).innerHTML = S.projects().filter((p) => !p.archived).map((p) => `<div class="acct-row"><b>${esc(p.name)}</b><span class="note">${esc((S.siteOf(p)?.label || '').split(',')[0])} · ${p.versions.length} versions · ${p.runs.length} results</span>
      <label class="note" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-link="${p.id}" ${p.siteLinked === false ? '' : 'checked'}> Legacy simulations follow my default site</label>
      <a class="btn sm" href="#/project-settings/${p.id}">Shared conditions</a></div>`).join('') || '<p class="note">No projects yet.</p>';
    // a project follows the Account site (a new address reaches all its simulations) or keeps its own copy of it
    $$('[data-link]', app).forEach((c) => c.onchange = () => { const p = S.project(c.dataset.link); S.linkSite(p, c.checked); toast(c.checked ? `${p.name} follows your default site` : `${p.name} keeps its own site: ${(p.site.label || '').split(',')[0]}`); plist(); });
  };
  // one tab at a time; the address follows without reloading the page
  const show = (k) => { tab = k; $$('[data-pane]', app).forEach((el) => el.hidden = el.dataset.pane !== k); $$('[data-tab]', app).forEach((a) => a.setAttribute('aria-selected', String(a.dataset.tab === k)));
    history.replaceState(null, '', '#/account?tab=' + k); if (k === 'data') dataUI(); window.scrollTo(0, 0); };
  $$('[data-tab]', app).forEach((a) => a.onclick = (e) => { e.preventDefault(); show(a.dataset.tab); });
  $('#logout', app).onclick = (e) => { e.preventDefault(); A.user = null; S.save(); refreshWho(); location.hash = '#/'; toast('Logged out'); };
  $('#prof', app).onsubmit = (e) => { e.preventDefault(); const fd = new FormData(e.target); A.user.name = String(fd.get('name')).trim() || A.user.name; A.user.email = String(fd.get('email')).trim(); S.save(); refreshWho(); toast('Profile saved'); };
  $('#delAcct', app).onclick = () => { if (prompt('Delete your account and everything in this browser? Type DELETE to confirm.') !== 'DELETE') return; S.deleteAccount(); location.hash = '#/'; location.reload(); };
  { const since = A.user.since ? new Date(A.user.since) : new Date(), left = Math.max(0, 7 - Math.floor((Date.now() - since) / 86400000)); $('#trialLeft', app).textContent = left ? `${left} day${left > 1 ? 's' : ''} left of the 7-day trial.` : 'The 7-day trial has ended (prototype: everything stays open).'; }
  function dataUI() {
    const use = S.storageUse(), pc = Math.min(100, 100 * use / S.QUOTA);
    $('#useBar', app).style.width = pc.toFixed(1) + '%'; $('#useTxt', app).textContent = `${size(use)} of about ${size(S.QUOTA)} used (${Math.round(pc)} %).`;
    $('#lastB', app).textContent = A.lastBackup ? `Last backup ${when(A.lastBackup)}.` : 'No backup yet.';
  }
  $('#exp', app).onclick = () => { const blob = new Blob([S.exportAll()], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `plotcloud-backup-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); dataUI(); toast('Backup downloaded'); };
  $('#imp', app).onclick = () => $('#impFile', app).click();
  $('#impFile', app).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; const mode = $('#impMode', app).value, msg = $('#impMsg', app);
    if (mode === 'replace' && !confirm('Replace every project and setting in this browser with the backup?')) { e.target.value = ''; return; }
    let n; try { n = S.importAll(await f.text(), mode); } catch (er) { msg.textContent = er.message; e.target.value = ''; return; }
    // the store was read again: draw the page from it, so later changes here go to the restored data
    render(app, _, new URLSearchParams('tab=data')); refreshWho(); $('#impMsg', app).textContent = `Restored ${n} project${n === 1 ? '' : 's'} from ${f.name}.`; toast('Backup restored'); };
  $('#prune', app).onclick = () => { const n = S.pruneOldMedia(); dataUI(); toast(n ? `Removed pictures from ${n} older result${n === 1 ? '' : 's'}` : 'Nothing to remove'); };
  $$('[data-n]', app).forEach((c) => c.onchange = () => { A.notify = { ...(A.notify || { batch: true, stale: true }), [c.dataset.n]: c.checked }; S.save(); toast('Saved'); });
  $('#reset', app).onclick = () => { if (!confirm('Remove all prototype projects and settings in this browser and restore the sample?')) return; S.reset(); location.hash = '#/'; location.reload(); };
  show(tab);
  facts(); plist();
}
