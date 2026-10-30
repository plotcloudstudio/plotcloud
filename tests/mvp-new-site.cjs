// New project from the map (2026-10-25): the study area, the plot, OpenStreetMap and terrain loaded for real, the site made
// by Plan Studio, the project created and the Workspace showing the site; then a new site for an existing project.
// Needs the network (OpenStreetMap, AWS Terrain Tiles) and the static server on 8765 (TEST_BASE overrides it).
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const B = (process.env.TEST_BASE || 'http://127.0.0.1:8765') + '/mvp/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }), p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(B); await p.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('plotcloud'); }); await p.goto(B + '#/'); await p.reload(); await p.waitForTimeout(800);
  await p.goto(B + '#/new-site'); await p.waitForFunction(() => /#\/login/.test(location.hash), null, { timeout: 10000 }).catch(() => {}); ok(/#\/login\?next=new-site/.test(p.url()), 'signed out, it asks to log in first');
  await p.evaluate(async () => { const S = await import('./js/store.js'); S.account().user = { name: 'Jun', email: 'j@x.com', since: new Date().toISOString() }; S.save(); });
  await p.goto(B + '#/home'); await p.waitForTimeout(500); ok(await p.isVisible('a.ph-new[href="#/new-project"]'), 'Projects home › Add new project opens the map');
  await p.goto(B + '#/activity'); await p.waitForTimeout(500); await p.click('#newBtn'); ok(await p.isVisible('#newMenu a[href="#/new-site"]'), 'Activity › New project still offers “From the map” (study area and plot drawing)');
  await p.click('#newMenu a[href="#/new-site"]'); await p.waitForFunction(() => window.__newsite, null, { timeout: 30000 }); ok(await p.evaluate(() => !!document.querySelector('.leaflet-container')), 'the map opens');
  await p.evaluate(() => { const c = [49.2805, -123.1203]; window.__newsite.map.setView(c, 17); window.__newsite.center.setLatLng(c); window.__newsite.center.fire('dragend'); });
  await p.click('#rSeg [data-r="150"]'); ok(await p.evaluate(() => document.querySelector('#create').disabled), 'Create waits until the site is loaded');
  await p.click('#load'); await p.waitForFunction(() => window.__newsite.data || /could not/i.test(document.getElementById('loadMsg').textContent), null, { timeout: 240000 });
  const d = await p.evaluate(() => { const s = window.__newsite.data?.site; return s && { b: s.buildings.filter((x) => !x.excluded).length, src: s.buildings.filter((x) => !x.excluded && x.h != null && x.hSource !== 'estimate').length, roads: s.roads.length, t: window.__newsite.data.terrain }; });
  console.log('  ' + await p.textContent('#loadMsg')); ok(d && d.b > 20 && d.roads > 10, `OpenStreetMap loaded: ${d?.b} buildings (${d?.src} of them with a mapped or floor-count height), ${d?.roads} roads`);
  ok(d?.t && d.t.grid.nx > 10, `terrain loaded: ${d?.t?.grid.nx} × ${d?.t?.grid.ny} grid, ${d?.t?.relief} m relief`);
  ok(await p.evaluate(() => document.querySelectorAll('.leaflet-overlay-pane path').length) > 50, 'the buildings and roads are drawn on the map by height source');
  await p.evaluate(() => { const c = [49.2805, -123.1203], dl = 20 / 111320, dn = 15 / 111320 / Math.cos(49.28 * Math.PI / 180); window.__newsite.setPlot([[c[0] - dl, c[1] - dn], [c[0] - dl, c[1] + dn], [c[0] + dl, c[1] + dn], [c[0] + dl, c[1] - dn]]); });
  ok(/Plot: 1,2\d\d m²/.test(await p.textContent('#plotMsg')), 'the plot shows its area: ' + await p.textContent('#plotMsg'));
  await p.fill('#pname', 'Robson test'); await p.click('#create'); await p.waitForFunction(() => /#\/workspace\//.test(location.hash), null, { timeout: 120000 });
  const st = await p.evaluate(async () => { const S = await import('./js/store.js'); const pr = S.projects()[0], s = pr.draft.studio.site; return { name: pr.name, v: pr.versions.length, inV: !!pr.versions[0].model.studio.site, parcel: s.parcel?.pts.length, own: s.buildings.filter((x) => x.why === 'on your plot').length, est: s.buildings.filter((x) => x.hSource === 'estimate').length, attr: s.sources[0].attribution, label: s.origin.label, psite: pr.site.lat }; });
  ok(st.name === 'Robson test' && st.v === 1 && st.inV, 'the project is made with its first version holding the site');
  ok(st.parcel === 4 && st.own >= 1, `the plot is the parcel; ${st.own} building(s) on it left out`);
  ok(/OpenStreetMap/.test(st.attr) && st.label.length > 3, `the source and place are recorded (${st.attr}; ${st.label.slice(0, 40)}…)`);
  for (let i = 0; i < 60; i++) { await p.waitForTimeout(500); if (await p.evaluate(() => window.__ws2 && window.__ws2.inst.plan.ready && window.__ws2.inst.persp.ready)) break; }
  const shown = await p.evaluate(() => { const w = document.getElementById('fPlan').contentWindow; return { site: !!w.__st.M.site, b: w.__st.M.site?.buildings.length, parcel: !!w.__wb.site.siteOk() }; });
  ok(shown.site && shown.b > 20 && shown.parcel, 'Plan Studio in the Workspace has the site and the locked plot');
  // a new site for the same project, from the Workspace
  await p.click('[data-panel="project"]'); await p.click('[data-pacc="site"]'); ok(/buildings/.test(await p.textContent('[data-pacc="site"] ~ .w3-accb, .w3-accp.on .w3-accb')), 'the Workspace’s Site section describes the site');
  await p.click('#siteBtn'); await p.waitForFunction(() => window.__newsite, null, { timeout: 30000 }); ok(/A site for Robson test/.test(await p.textContent('.ns-h')), 'Choose another site keeps the project');
  if (errs.length) { console.log('page errors:', errs); process.exitCode = 1; }
  await b.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
