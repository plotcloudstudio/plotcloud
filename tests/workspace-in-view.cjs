// The Workspace as the one place for the work (2026-10-30): nav without Workspace / Simulations / Projects & Results, a study added
// with + runs in the view and paints the topographic site, its result is saved with a version and compared on the right, and the
// Dashboard's list and map views. Needs network access (OpenStreetMap, terrain tiles) like mvp-new-site.
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message));
    const base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    await p.goto(base + '/mvp/#/home'); await p.waitForSelector('[data-view]');
    assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('#nav [data-nav]')].map((a) => a.dataset.nav)), ['home', 'resources', 'pricing']);
    console.log('PASS main nav: Dashboard, Resources, Pricing (the Workspace, its studies and results are reached from the Dashboard)');

    await p.goto(base + '/mvp/#/new-project'); await p.waitForFunction(() => window.__newProjectMap, null, { timeout: 30000 });
    await p.evaluate(() => window.__newProjectMap.place(49.2448, -123.0071, 'QA site'));
    await p.waitForFunction(() => window.__newProjectMap.osm, null, { timeout: 120000 });
    await p.click('#npStart'); await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 180000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click());
    assert.equal(await p.locator('#sendSim').isVisible(), false, 'no Send to Simulation in view');

    await p.click('#addSimBtn'); await p.click('.w2-simmenu [data-addsim=sunhours]');
    assert.match(await p.locator('.sp-studycard').innerText(), /Sun hours[\s\S]*Not run yet/i);
    await p.click('[data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 120000 });
    const st = await p.evaluate(() => window.__wsStudy.state()); assert.equal(st.err, ''); assert(st.res.cells > 1000 && st.res.context > 0 && st.res.max <= st.res.dayLength + 1e-6, JSON.stringify(st.res));
    const painted = await p.evaluate(() => { const w = __ws2.inst.persp.win, g = w.S3._topoState?.(); return g; });
    assert(await p.locator('.sp-legend').isVisible(), 'legend shown'); assert(painted && painted.ana && painted.cv, 'the result is painted into the topographic block');
    console.log(`PASS Sun hours runs in the view: ${st.res.cells} ground cells, mean ${st.res.avg.toFixed(1)} h, painted into the site; legend shown`);

    for (const [id, unit] of [['radiation', 'kWh/m²'], ['skyview', '%'], ['wind', 'Lawson class']]) {   // Solar radiation (project weather), Sky exposure and Wind flow (2D flow, Lawson) run on the ground too
      await p.click('#addSimBtn'); await p.click(`.w2-simmenu [data-addsim=${id}]`); await p.click('[data-st=run]');
      await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 180000 });
      const r = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, unit: s.res?.unit, avg: s.res?.avg, cells: s.res?.cells }; });
      assert(!r.err && r.unit === unit && r.avg >= 0 && r.cells > 1000, id + ' ' + JSON.stringify(r)); assert(await p.locator('.sp-studyres').isVisible() && await p.locator('.sp-legend').isVisible());
      console.log(`PASS ${id} runs in the view: mean ${r.avg.toFixed(1)} ${unit} over ${r.cells} cells, Results | Charts and legend shown`); }
    await p.click('#addSimBtn'); await p.click('.w2-simmenu [data-addsim=sunhours]'); await p.click('[data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && s.res; }, null, { timeout: 120000 });
    await p.click('[data-st=save]'); await p.waitForFunction(() => window.__wsStudy.state().saved || window.__wsStudy.state().err, null, { timeout: 30000 });
    const saved = await p.evaluate(async () => { const A = await import('./js/app.js'), pr = A.currentProject(), r = pr.runs.at(-1); return { n: pr.versions.length, linked: r.versionId === pr.versions.at(-1).id, sim: r.simId, ground: r.results.ground, src: r.source, day: r.settings.day }; });
    assert(saved.linked && saved.sim === 'sunhours' && saved.src === 'workspace' && saved.day === '03-21' && Math.abs(saved.ground - st.res.avg) < 0.01, JSON.stringify(saved));
    console.log('PASS Save to results keeps the result with the saved version it was computed on');

    await p.click('#tabList [data-tab=versions]'); await p.locator('.sp-sheet .sp-sk-card').first().waitFor(); const cmp = await p.locator('.sp-sheet').innerText();
    assert.match(cmp, /Sun hours · Ground, mean[\s\S]*\d\.\d h/); assert.match(cmp, /Current/); assert.match(cmp, /BUILDING[\s\S]*SITE[\s\S]*SPACE[\s\S]*ELEMENT[\s\S]*RESULTS/); await p.locator('.sp-sheet #saveV').waitFor({ timeout: 10000 });   // Add sketch saves a version
    const dl = p.waitForEvent('download'); await p.click('[data-cmp=csv]'); const csv = fs.readFileSync(await (await dl).path(), 'utf8');
    assert.match(csv, /"Sun hours · Ground, mean"/); console.log('PASS Compare sketches: sketch columns, grouped rows with the saved study result, Add sketch, Export to Excel (CSV)');
    await p.click('[data-cmp=close]'); assert(await p.locator('.sp-sheet').isHidden());

    // every other study opens inside this page too: the full study page, after the handoff, without leaving the Workspace
    await p.click('#addSimBtn'); await p.click('.w2-simmenu [data-addsim=stormwater]'); await p.waitForFunction(() => window.__wsHost?.id() || document.querySelector('#handoffDialog[open]'), null, { timeout: 60000 });
    if (await p.locator('#handoffConfirm').isVisible().catch(() => false)) await p.click('#handoffConfirm');
    await p.waitForFunction(() => window.__wsHost?.id() === 'stormwater', null, { timeout: 60000 }); await p.locator('.sp-host .shbar').waitFor({ state: 'attached', timeout: 60000 });
    assert.match(await p.evaluate(() => location.hash), /^#\/workspace/); assert.equal(await p.evaluate(() => [...document.querySelectorAll('.w2-simmenu .w2-simcat')].map((x) => x.textContent).join('|')), 'Building|Interior');
    await p.evaluate(() => [...document.querySelectorAll('.sp-host a')].find((a) => /Back/.test(a.textContent)).click());
    assert.equal(await p.evaluate(() => !!document.querySelector('.sp-host')), false); assert(await p.evaluate(() => window.__ws2.inst.plan.ready));
    console.log('PASS a study that does not run on the ground yet (Stormwater) opens inside the Workspace page and Back returns to the model; + lists Building and Interior');

    // the project's shared parameters live in Project props (bottom left): saving makes a new shared revision
    await p.click('[data-sp=props]'); await p.locator('.pp-form').waitFor(); assert.match(await p.locator('.sp-propscard').innerText(), /Default[\s\S]*Sun & light[\s\S]*Noise[\s\S]*Weather[\s\S]*Advanced/);
    const rev0 = await p.evaluate(async () => { const S = await import('./js/store.js'), A = await import('./js/app.js'); return S.conditionsOf(A.currentProject()).revision; });
    await p.fill('.pp-form [name="site.north"]', '7'); await p.click('.pp-form button[type=submit]'); await p.waitForFunction(() => /Saved revision/.test(document.querySelector('.pp-form .pp-note')?.textContent || ''));
    assert.deepEqual(await p.evaluate(async () => { const S = await import('./js/store.js'), A = await import('./js/app.js'), c = S.conditionsOf(A.currentProject()); return [c.site.north, c.revision]; }), [7, rev0 + 1]);
    console.log('PASS Project props: shared parameters in one place (Default and topic tabs); saving makes a new shared revision');

    // layer materials: a preset on a layer, the structure study's material follows, rendering requests get the words
    await p.click('[data-pp=close]'); await p.click('#tabList [data-tab=layers]'); await p.evaluate(() => [...document.querySelectorAll('#layers [data-open]')].find((b) => /Structure/.test(b.textContent)).click());
    await p.click('.w3-matbox summary'); await p.selectOption('[data-layer-mat]', 'glulam');
    await p.fill('[data-mat-prop=rw]', '44'); await p.locator('[data-mat-prop=rw]').dispatchEvent('change');
    assert.equal(await p.evaluate(() => __ws2.model().layers.find((x) => x.name === 'Structure').props.rw), 44, 'a value is set by the person');
    assert.deepEqual(await p.evaluate(() => { const l = __ws2.model().layers.find((x) => x.name === 'Structure'); return [l.material, l.structural?.material]; }), ['glulam', 'glulam']);
    assert.match(await p.evaluate(async () => (await import('./js/layer-materials.js')).describe(__ws2.model().layers)), /Structure: warm Douglas fir glulam timber/);
    console.log('PASS layer materials: chosen per layer, its values editable (Rw), the structure study material and the rendering words follow');

    await p.goto(base + '/mvp/#/home'); await p.waitForSelector('[data-view]');
    await p.click('[data-view=list]'); assert.match(await p.locator('.ph-rows').innerText(), /Projects[\s\S]*Created[\s\S]*Last edited[\s\S]*QA site/);
    await p.click('[data-view=map]'); await p.waitForSelector('.ph-col .ph-card'); await p.waitForFunction(() => document.querySelectorAll('#phMap .leaflet-interactive').length >= 1, null, { timeout: 20000 });
    console.log('PASS Dashboard list (thumbnail rows) and map (cards beside the map with markers)');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
