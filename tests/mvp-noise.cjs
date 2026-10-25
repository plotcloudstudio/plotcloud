// Outdoor noise, redesigned (2026-10-25): it reads the site that is already in the project (OpenStreetMap roads with their type and
// lanes, parks, the neighbours) through Plan Studio's noise scene, shows the site in Plan and 3D like Sun hours and Wind flow, colours
// every façade of every storey, and says which roads matter. Part 1: the engine on its own (sample). Part 2: Plan Studio's scene from a
// small labelled OpenStreetMap fixture (no network). Part 3: the Workspace → version → Simulations page → save → Results batch.
// Run with a static server on 8765 (python3 -m http.server 8765 --bind 127.0.0.1); TEST_BASE overrides it.
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const BASE = process.env.TEST_BASE || 'http://127.0.0.1:8765';
const LAT = 49.28, LON = -123.12, mLat = 1 / 111320, mLon = 1 / (111320 * Math.cos(LAT * Math.PI / 180));
function fixture() {   // a primary road, a residential street, a footpath, a park and a tall neighbour; site metres → lat/lon
  let id = 1; const nodes = [], ways = [];
  const way = (pts, tags, closed) => { const nd = pts.map(([x, y]) => { const n = id++; nodes.push(`<node id="${n}" lat="${(LAT + y * mLat).toFixed(7)}" lon="${(LON + x * mLon).toFixed(7)}"/>`); return n; }); if (closed) nd.push(nd[0]);
    ways.push(`<way id="${100 + ways.length}">${nd.map((n) => `<nd ref="${n}"/>`).join('')}${Object.entries(tags).map(([k, v]) => `<tag k="${k}" v="${v}"/>`).join('')}</way>`); };
  way([[-150, -30], [150, -30]], { highway: 'primary', name: 'Fixture Road', lanes: '4' });
  way([[35, -100], [35, 100]], { highway: 'residential', name: 'Fixture Street' });
  way([[-100, 25], [100, 25]], { highway: 'footway' });
  way([[-70, 10], [-25, 10], [-25, 45], [-70, 45]], { leisure: 'park', name: 'Fixture Park' }, true);
  way([[45, -15], [65, -15], [65, 10], [45, 10]], { building: 'yes', height: '24', name: 'Tall neighbour' }, true);
  return `<?xml version="1.0"?><osm version="0.6">${nodes.join('')}${ways.join('')}</osm>`;
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  // ---------- part 1: the engine on its own
  { const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage(), errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE + '/emb/noise.html'); await p.waitForFunction(() => window.__psim?.SC, null, { timeout: 20000 });
    const g0 = await p.evaluate(() => __psim.groups().map((g) => [g.name, g.type, g.L]));
    ok(g0.length === 2 && g0[0][2] === 67 && g0[1][2] === 57, `roads come with typical levels for their type: ${g0.map((g) => `${g[0]} (${g[1]}) ${g[2]} dB`).join(', ')}`);
    ok(await p.evaluate(() => !!document.querySelector('#v3 canvas') && document.querySelector('#camBar [data-view="plan"]').getAttribute('aria-pressed') === 'true'), 'Plan and 3D views, Plan first');
    const run = async () => { await p.click('#run'); await p.waitForFunction(() => __psim.RES && !document.getElementById('run').disabled && !__psim.RES.stale, null, { timeout: 120000 }); return p.evaluate(() => __psim.figures()); };
    let F = await run(); const day = F.loud.max;
    ok(F.storeys === 5 && Number.isFinite(F.loud.max) && F.loud.max > F.quiet.max, `every storey's façades get a level (loudest ${Math.round(F.loud.max)} dB, quietest ${Math.round(F.quiet.max)} dB, ${F.storeys} storeys)`);
    ok(await p.evaluate(() => [...document.querySelectorAll('.kpis > div')].map((d) => d.textContent).join('|')).then((t) => /Main source\s*Sample Avenue/.test(t)), 'the main source is named (the louder avenue)');
    ok(await p.evaluate(() => __psim.RES.share.length === 2 && Math.abs(__psim.RES.share.reduce((s, r) => s + r.share, 0) - 1) < 1e-9), 'the roads’ shares of the façade sound add up to 100 %');
    // the building's own top: a scene mass's h is its top; the third storey (6.4–9.6 m) must not shield as if it were 16 m tall
    ok(await p.evaluate(() => __psim.SC.masses.find((m) => m.id === 'a2').h === 9.6), 'storey tops read as heights above the ground (h is the top)');
    await p.click('#period [data-p="night"]'); F = await run(); ok(Math.abs(day - 8 - F.loud.max) < 0.05, `night is 8 dB quieter (${Math.round(day)} → ${Math.round(F.loud.max)} dB)`);
    await p.click('#period [data-p="day"]'); await p.click('#traffic [data-t="3"]'); F = await run(); ok(Math.abs(day + 3 - F.loud.max) < 0.05, `more traffic is 3 dB louder (${Math.round(F.loud.max)} dB)`);
    await p.click('#traffic [data-t="0"]');
    // a road left out, and a level typed in, are kept for the project
    await p.uncheck('#roads [data-on="0"]'); F = await run(); ok(/Sample Lane/.test(F.top.name) && F.loud.max < day - 3, `leaving the avenue out leaves the lane (loudest ${Math.round(F.loud.max)} dB)`);
    await p.check('#roads [data-on="0"]'); await p.fill('#roads [data-l="1"]', '63'); await p.dispatchEvent('#roads [data-l="1"]', 'change');
    await p.reload(); await p.waitForFunction(() => window.__psim?.SC); ok(await p.evaluate(() => __psim.groups().find((g) => g.name === 'Sample Lane').L) === 63, 'a typed level is kept after a reload');
    // ground: the park softens the ground next to it
    const parkPt = async () => { await run(); return p.evaluate(() => { const R = __psim.RES, G = R.G; let best = NaN; for (let k = 0; k < R.map.length; k++) { const x = G.x0 + (k % G.W + 0.5) * G.c, y = G.y0 + (Math.floor(k / G.W) + 0.5) * G.c; if (x > 46 && x < 54 && y > 48 && y < 56 && Number.isFinite(R.map[k])) { best = R.map[k]; break; } } return best; }); };
    const soft = await parkPt(); await p.uncheck('#soft'); const hard = await parkPt();
    ok(Number.isFinite(soft) && soft < hard - 0.5, `soft ground in the park takes some dB off (${soft.toFixed(1)} vs ${hard.toFixed(1)} dB on hard ground)`);
    await p.click('#camBar [data-view="persp"]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => document.querySelector('#camBar [data-view="persp"]').getAttribute('aria-pressed') === 'true'), '3D view');
    const png = await p.evaluate(() => document.querySelector('#v3 canvas').toDataURL('image/png').length); ok(png > 30000, `the view draws (PNG ${Math.round(png / 1024)} kB)`);
    // drawing a road in plan
    await p.click('#camBar [data-view="plan"]'); await p.evaluate(() => { document.getElementById('addBox').open = true; }); await p.click('#drawRoad');
    const bx = await p.locator('#v3 canvas').boundingBox(); await p.mouse.click(bx.x + 100, bx.y + 120); await p.mouse.click(bx.x + 400, bx.y + 140); await p.keyboard.press('Enter');
    ok(await p.evaluate(() => __psim.groups().some((g) => g.drawn && /Local street/.test(g.name))), 'a road drawn in Plan joins the list');
    if (errs.length) { console.log('page errors:', errs); process.exitCode = 1; } await p.context().close(); }

  // ---------- part 2: Plan Studio's noise scene from the site
  { const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage(), errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE + '/emb/modeler.html'); await p.waitForFunction(() => window.__mass && window.__SITEC, null, { timeout: 30000 });
    await p.evaluate((xml) => { const SC = window.__SITEC, site = SC.siteFromOSM(xml, { lat: 49.28, lon: -123.12, label: 'Noise fixture' }, { kind: 'radius', r: 150 }, { provider: 'test fixture' }); site.fixture = true; SC.estimateMissing(site, 4);
      const m = JSON.parse(JSON.stringify(window.__st.M)); m.walls = []; m.ops = []; m.floors = []; m.furn = []; m.voids = []; m.masses = []; m.site = site; m.name = 'Noise test'; window.__mass.load(m); }, fixture());
    await p.waitForTimeout(500); const sk = await p.$('text=Skip'); if (sk) await sk.click().catch(() => {});
    await p.evaluate(() => window.__mass.addMass([[-10, -12], [12, -12], [12, 6], [-10, 6]]));
    const sc = await p.evaluate(() => { const t = window.__pcWorkflow.toolScene('noise'); return t.ok ? JSON.parse(t.scene) : t; });
    ok(sc.tool === 'noise' && sc.masses.some((m) => m.role === 'proposed') && sc.masses.some((m) => m.role === 'context'), 'the noise scene has the building and the neighbours (as Sun hours)');
    ok(sc.roads?.length === 2 && sc.roads.some((r) => r.kind === 'primary' && r.lanes === 4) && sc.roads.some((r) => r.kind === 'residential'), `it has the site's roads with type and lanes, footpaths left out (${(sc.roads || []).map((r) => r.kind).join(', ')})`);
    ok(sc.areas?.some((a) => a.kind === 'green' && a.name === 'Fixture Park') && sc.site?.boundary?.r === 150 && sc.site.paths === 1, 'and the park, the site circle and the count of footpaths');
    const road = sc.roads.find((r) => r.kind === 'primary'); ok(Math.abs(road.pts[0][1] + 30) < 0.5, `in plan metres (the primary road at y = ${road.pts[0][1]})`);
    if (errs.length) { console.log('page errors:', errs); process.exitCode = 1; } await p.context().close(); }

  // ---------- part 3: from the Workspace to the Simulations page and Results
  { const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage(), errs = []; p.on('pageerror', (e) => errs.push(e.message));
    const B = BASE + '/mvp/'; await p.goto(B); await p.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('plotcloud'); }); await p.goto(B + '#/'); await p.reload(); await p.waitForTimeout(600);
    await p.goto(B + '#/workspace'); for (let i = 0; i < 80; i++) { await p.waitForTimeout(400); if (await p.evaluate(() => window.__ws2 && window.__ws2.ready())) break; } await p.waitForTimeout(600);
    await p.evaluate((xml) => { const w = document.getElementById('fPlan').contentWindow, SC = w.__SITEC, site = SC.siteFromOSM(xml, { lat: 49.28, lon: -123.12, label: 'Noise fixture' }, { kind: 'radius', r: 150 }, { provider: 'test fixture' }); site.fixture = true; SC.estimateMissing(site, 4);
      const m = JSON.parse(JSON.stringify(w.__st.M)); m.walls = []; m.ops = []; m.floors = []; m.furn = []; m.voids = []; m.masses = []; m.site = site; m.name = 'Noise test'; w.__mass.load(m); }, fixture());
    await p.waitForTimeout(700); const sk = p.frameLocator('#fPlan').locator('text=Skip'); if (await sk.count()) await sk.first().click().catch(() => {});
    await p.evaluate(() => document.getElementById('fPlan').contentWindow.__mass.addMass([[-10, -12], [12, -12], [12, 6], [-10, 6]])); await p.waitForTimeout(1500);
    ok(await p.evaluate(() => !!__ws2.model().studio.site && __ws2.model().studio.masses.length === 1), 'the project has the site and a mass');
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.saveVersion(S.projects()[0], 'With a site and a mass'); });
    await p.goto(B + '#/simulations/noise'); let f = null;
    for (let i = 0; i < 80; i++) { await p.waitForTimeout(500); f = p.frame({ url: /emb\/noise\.html/ }); if (f && await f.evaluate(() => window.__psim && document.getElementById('mName').textContent !== 'Sample block').catch(() => false)) break; }
    const sum = await f.evaluate(() => document.getElementById('roadSum').textContent); ok(/2 road pieces from the site/.test(sum) && /1 footpaths? left out/.test(sum), 'the Simulations page brings the site\'s roads in: ' + sum);
    const g = await f.evaluate(() => __psim.groups().map((x) => [x.name, x.L])); ok(g.some(([n, L]) => n === 'Fixture Road' && L === 73) && g.some(([n, L]) => n === 'Fixture Street' && L === 57), `typical levels from the map data: ${g.map((x) => x.join(' ')).join(', ')} dB`);
    ok(await f.evaluate(() => getComputedStyle(document.getElementById('h-scene').closest('.sec')).display) === 'none', 'its Model section is hidden there');
    await f.click('#run'); await f.waitForFunction(() => window.__psim.RES && !document.getElementById('run').disabled, null, { timeout: 180000 });
    const k = await f.evaluate(() => [...document.querySelectorAll('.kpis > div')].map((d) => d.textContent.trim()).join(' | ')); console.log('  ' + k);
    ok(/Main source\s*Fixture Road/.test(k), 'the four-lane primary road is the main source');
    const st = await f.evaluate(() => { const F = __psim.figures(), L = [...new Set(__psim.RES.fac.map((x) => x.level))]; return [F.storeys, L]; }); ok(st[0] === 4 && st[1].includes('Mass 1 · storey 4'), `the mass drawn with 4 storeys is checked storey by storey (${st[1].join(', ')})`);
    await p.click('#save'); await p.waitForTimeout(1500);
    const run = await p.evaluate(async () => { const S = await import('./js/store.js'); return S.projects()[0].runs.filter((r) => r.simId === 'noise').at(-1); });
    ok(run && run.results.kpis.length >= 5 && run.results.thumb && run.results.field?.pts?.length > 30 && Number.isFinite(run.results.loud), `Save result keeps figures, a picture, a field (${run?.results.field?.pts?.length / 3 | 0} points) and the loudest façade ${run?.results.loud} dB`);
    await p.screenshot({ path: require('os').tmpdir() + '/noise-site.png' });
    await f.click('#camBar [data-view="persp"]'); await p.waitForTimeout(1200); await p.screenshot({ path: require('os').tmpdir() + '/noise-site-3d.png' });
    await p.goto(B + '#/results'); await p.waitForTimeout(1500);
    const q = await p.evaluate(async () => { const R = window.__res; if (!R?.batch) return 'no batch hook'; const S = await import('./js/store.js'), pr = S.projects()[0], v = pr.versions.at(-1); R.batch.add([{ simId: 'noise', projectId: pr.id, versionId: v.id, ov: {} }]); return 'queued'; });
    if (q === 'queued') { let st = []; for (let i = 0; i < 120; i++) { await p.waitForTimeout(1500); st = await p.evaluate(() => window.__res.batch.items().map((x) => x.simId + ':' + x.status + (x.why ? '(' + x.why + ')' : ''))); if (st.length && st.every((x) => /done|fail|error/.test(x))) break; }
      console.log('  ' + st.join(' ')); ok(st.length === 1 && /done/.test(st[0]), 'a Results batch runs Outdoor noise'); } else ok(false, q);
    if (errs.length) { console.log('page errors:', errs); process.exitCode = 1; } }
  await b.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
