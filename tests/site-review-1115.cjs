// The site review of 2026-11-15:
// · what is free matches Pricing, Log in and the Terms: Sun hours and Daylight on any project, every study on the example projects,
//   the other studies on your own projects need monthly access (the gate is tried with pc-dev-gate=1, as on the live site)
// · Activity & storage is gone: #/activity opens the Dashboard
// · Resources lists no files that cannot be downloaded (the library shows published files only)
// · the old homepage is no longer served; Results lists only the studies a batch runs, the others on one line of links
// · leaving the Workspace for Report & boards: the project page draws (the 3D view's GPU memory is let go first)
const { chromium } = require('playwright'), assert = require('node:assert/strict'), os = require('node:os');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || os.tmpdir();
    const local = /127\.0\.0\.1|localhost/.test(base);
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA Architect', email: 'qa@x.test' }; S.save(); localStorage.setItem('pc-dev-gate', '1'); });
    // the old homepage
    await p.goto(base + '/mvp/#/home-classic'); await p.waitForTimeout(1500); assert.equal(await p.evaluate(() => location.hash), '#/', 'the old homepage goes to the homepage');
    // Pricing says what is free, and agrees with itself
    await p.goto(base + '/mvp/#/pricing'); await p.waitForSelector('table.t'); const pr = await p.evaluate(() => document.querySelector('#app').innerText);
    assert.match(pr, /Every study on the example projects/); assert.doesNotMatch(pr, /Resource tools and design utilities\s+Activation required/); assert.match(pr, /The other studies on your own projects\s+Monthly access/);
    // the Terms and the Simulations page say the same
    await p.goto(base + '/mvp/#/legal'); await p.waitForFunction(() => /Free and paid access/.test(document.body.innerText)); assert.match(await p.evaluate(() => document.body.innerText), /every study is free on the example projects/);
    await p.goto(base + '/mvp/#/simulations'); await p.waitForSelector('.simgrid'); const sl = await p.evaluate(() => document.querySelector('.lede')?.innerText || ''); assert.match(sl, /Sun hours and Daylight are free on every project/); assert.doesNotMatch(sl, /All simulations are currently free/);
    console.log('PASS the claims agree: Pricing, Terms, Simulations; the old homepage redirects');
    // Resources: no files nobody can download
    await p.goto(base + '/mvp/#/resources'); await p.waitForSelector('.resource-page h1'); const rs = await p.evaluate(() => ({ h1: document.querySelector('.resource-page h1').innerText, notAttached: (document.body.innerText.match(/source file not attached/g) || []).length, files: !!document.querySelector('#resourceGrid') }));
    // since 2026-11-17 the resource library is back (files the founder publishes, free or for members); still nothing that cannot be reached
    assert.equal(rs.notAttached, 0); assert.equal(rs.files, true); assert.match(rs.h1, /Tools and files/);
    await p.goto(base + '/mvp/#/resources/files'); await p.waitForSelector('#resourceGrid'); await p.waitForTimeout(500); assert.equal(await p.locator('#resourceGrid .resource-card').count(), 0, 'no record without a file'); assert.match(await p.locator('#resourceGrid').innerText(), /Nothing in the library yet/);
    console.log('PASS Resources: tools, references and the library; no file listed that cannot be downloaded');
    // Activity & storage was removed (2026-11-16): its address opens the Dashboard, which has no link to it
    await p.goto(base + '/mvp/#/activity'); await p.waitForFunction(() => location.hash === '#/home', null, { timeout: 15000 }); await p.waitForSelector('.ph-main');
    assert.equal(await p.locator('a[href="#/activity"]').count(), 0, 'no Activity link'); console.log('PASS #/activity opens the Dashboard; no Activity & storage link');
    if (local) {
      // the gate on your own project
      const own = await p.evaluate(async () => { const S = await import('./js/store.js'), D = await import('./js/data.js'); const q = S.createProject('QA own project', D.sampleModel('A')); S.save(); return q.id; });
      await p.goto(base + '/mvp/#/workspace/' + own); await p.waitForFunction(() => window.__wsStudy?.open && window.__ws2?.inst.persp.ready, null, { timeout: 240000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1000);
      const tags = await p.$$eval('.w2-simmenu [data-addsim]', (bs) => Object.fromEntries(bs.map((x) => [x.dataset.addsim, /Monthly access/.test(x.textContent)])));
      assert.equal(tags.sunhours, false); assert.equal(tags.daylight, false); assert.equal(tags.wind, true); assert.equal(tags['fire-evacuation'], true);
      await p.evaluate(() => window.__wsStudy.open('wind')); await p.waitForTimeout(800); await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await p.waitForTimeout(800);
      const g = await p.evaluate(() => ({ err: window.__wsStudy.state().err, res: !!window.__wsStudy.state().res, link: document.querySelector('.sp-studycard a[href="#/pricing"]')?.textContent }));
      assert(!g.res && /needs monthly access/.test(g.err) && g.link === 'See monthly access', 'wind is locked on your own project: ' + JSON.stringify(g));
      await p.screenshot({ path: `${out}/review-gate.png` });
      // Results: the batch list
      await p.goto(base + '/mvp/#/results/' + own); await p.waitForSelector('#btList .bt-row'); const bl = await p.evaluate(() => ({ rows: [...document.querySelectorAll('#btList .bt-row')].map((r) => r.dataset.row), hand: document.querySelector('#btList .bt-hand')?.innerText || '', notIn: (document.querySelector('#btList').innerText.match(/Not in batches/g) || []).length, locked: [...document.querySelectorAll('#btList .bt-row')].filter((r) => /Membership required/.test(r.innerText)).map((r) => r.dataset.row) }));
      assert(bl.rows.length >= 5 && bl.rows.length <= 10 && bl.notIn === 0 && /Run one at a time in the Workspace/.test(bl.hand), 'batch rows and the one-at-a-time line: ' + JSON.stringify(bl)); assert(!bl.locked.includes('sunhours') && bl.locked.includes('wind'), 'locked rows: ' + JSON.stringify(bl.locked));
      console.log('PASS the gate on your own project: menu tags, Wind refused with a link to Pricing; Results lists', bl.rows.length, 'batch studies, locked', JSON.stringify(bl.locked));
    }
    // an example project: every study open, and Report & boards draws after the Workspace
    await p.goto(base + '/mvp/#/home'); await p.waitForSelector('[data-hospital]'); await p.click('.ph-thumb[data-hospital]');
    await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    const tagsEx = await p.$$eval('.w2-simmenu [data-addsim]', (bs) => bs.filter((x) => /Monthly access/.test(x.textContent)).length); assert.equal(tagsEx, 0, 'no study locked on an example');
    const t0 = Date.now(); await p.click('.sp-flow [data-flow=report]'); await p.waitForSelector('[aria-label="Project workflow"]', { timeout: 60000 }); const dt = Date.now() - t0;
    console.log('PASS the example opens every study; Report & boards drew', dt, 'ms after leaving the Workspace');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
