// A site that does simulation (2026-11-16):
// · one header: the logo in the same place and size on every page (signed out and in), at desktop and phone widths
// · Rendering and Boards removed: the workflow has four steps (Site analysis, Plan Studio, Simulation, Report) on the homepage;
//   #/rendering and #/boards open the project report or the Dashboard
// · Activity & storage removed; My Projects: tick several projects, move them to Deleted, restore or delete them for good
const { chromium } = require('playwright'), assert = require('node:assert/strict'), os = require('node:os');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });   // downloads for the template
  try {
    const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || os.tmpdir(), errs = [];
    // the header
    for (const [W, want] of [[2000, { x: 24, w: 132 }], [390, { x: 16, w: 132 }]]) {
      const p = await b.newPage({ viewport: { width: W, height: 900 } }); p.on('pageerror', (e) => errs.push(e.message));
      await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1')); await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.save(); });
      const seen = {}; const look = async (h) => { await p.goto(base + '/mvp/' + h); await p.waitForTimeout(1500); seen[h] = await p.evaluate(() => { const l = [...document.querySelectorAll('header.top .brand img, .lp-nav .lp-logo img')].find((e) => e.getBoundingClientRect().width > 0)?.getBoundingClientRect(); return l && { x: Math.round(l.left), w: Math.round(l.width) }; }); };
      for (const h of ['#/', '#/pricing', '#/about', '#/blog', '#/resources', '#/login']) await look(h);
      await p.evaluate(async () => { const S = await import('./js/store.js'); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
      for (const h of ['#/home', '#/simulations', '#/account', '#/new-project']) await look(h);
      for (const [h, v] of Object.entries(seen)) assert.deepEqual(v, want, `${W}px ${h}: ${JSON.stringify(v)}`);
      console.log(`PASS the logo at ${want.x}px, ${want.w}px wide on ${Object.keys(seen).length} pages at ${W}px`); await p.close();
    }
    const p = await b.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    // the workflow: four steps
    await p.goto(base + '/mvp/#/'); await p.waitForSelector('.lp-flow li'); assert.deepEqual(await p.$$eval('.lp-flow li b', (x) => x.map((e) => e.textContent)), ['Site analysis', 'Plan Studio', 'Simulation', 'Report']);
    assert.doesNotMatch(await p.evaluate(() => document.body.innerText), /Rendering|render service|Boards/);
    // projects for the Dashboard
    const ids = await p.evaluate(async () => { const S = await import('./js/store.js'), D = await import('./js/data.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' };
      const a = S.createProject('QA one', D.sampleModel('A')), b2 = S.createProject('QA two', D.sampleModel('A')), c = S.createProject('QA three', D.sampleModel('A')); S.save(); return [a.id, b2.id, c.id]; });
    // old Rendering and Boards links
    await p.goto(base + `/mvp/#/rendering?project=${ids[0]}`); await p.waitForFunction((id) => location.hash === '#/project/' + id, ids[0], { timeout: 15000 });
    await p.goto(base + '/mvp/#/boards'); await p.waitForFunction(() => location.hash === '#/home', null, { timeout: 15000 });
    await p.goto(base + '/mvp/#/activity'); await p.waitForFunction(() => location.hash === '#/home', null, { timeout: 15000 });
    console.log('PASS four steps on the homepage; #/rendering → the project, #/boards and #/activity → the Dashboard');
    // Resources: what the studies use; the retired tools send old links here with a note
    await p.goto(base + '/mvp/#/resources'); await p.waitForSelector('.sim-res'); const rs = await p.$$eval('.resource-section h2', (h) => h.map((x) => x.textContent));
    assert.deepEqual(rs, ['Sample models', 'Weather', 'Methods and validation', 'Templates']); assert.doesNotMatch(await p.evaluate(() => document.body.innerText), /Stair generator|Facade studio|LEED|Colour palettes|Color palettes|Building code finder/);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-res-drill]')]); assert.equal(dl.suggestedFilename(), 'plotcloud-drill-template.csv');
    await p.goto(base + '/mvp/#/resources/tool/stairs3d'); await p.waitForFunction(() => /#\/resources\?retired=/.test(location.hash), null, { timeout: 15000 }); await p.waitForSelector('.resource-notice'); assert.match(await p.locator('.resource-notice').innerText(), /retired/);
    console.log('PASS Resources: sample models, weather, methods and validation, templates; old tool links land here with a note');
    // My Projects: several at once
    await p.goto(base + '/mvp/#/home'); await p.waitForSelector('.ph-grid .ph-card[data-id]'); assert.equal(await p.locator('a[href="#/activity"]').count(), 0, 'no Activity & storage link');
    assert(await p.locator('.ph-new').evaluate((e) => getComputedStyle(e).color === 'rgb(255, 255, 255)'), 'Add new project in white');
    await p.check(`[data-pick="${ids[0]}"]`, { force: true }); await p.check(`[data-pick="${ids[1]}"]`, { force: true });
    assert.match(await p.locator('#phSel').innerText(), /2 selected/); await p.screenshot({ path: `${out}/focus-select.png` });
    await p.click('#phSel [data-sel=delete]'); await p.waitForTimeout(500);
    const left = await p.evaluate(async (ids) => { const S = await import('./js/store.js'); return ids.map((id) => !!S.project(id)?.deletedAt); }, ids); assert.deepEqual(left, [true, true, false], 'two moved to Deleted');
    // in Deleted: restore one, delete the other for good
    await p.goto(base + '/mvp/#/home/deleted'); await p.waitForSelector('.ph-card[data-id]');
    await p.check(`[data-pick="${ids[0]}"]`, { force: true }); await p.click('#phSel [data-sel=restore]'); await p.waitForTimeout(400);
    await p.check(`[data-pick="${ids[1]}"]`, { force: true }); p.once('dialog', (d) => d.accept('DELETE')); await p.click('#phSel [data-sel=purge]'); await p.waitForTimeout(500);
    const st = await p.evaluate(async (ids) => { const S = await import('./js/store.js'); return ids.map((id) => (S.project(id) ? (S.project(id).deletedAt ? 'deleted' : 'live') : 'gone')); }, ids); assert.deepEqual(st, ['live', 'gone', 'live']);
    // the list view: select all
    await p.goto(base + '/mvp/#/home'); await p.waitForSelector('[data-view=list]'); await p.click('[data-view=list]'); await p.check('[data-pickall]', { force: true }); const rows = await p.locator('.ph-rows tbody tr').count(); assert.match(await p.locator('#phSel').innerText(), new RegExp(`^${rows} selected`));
    console.log('PASS My Projects: tick two, move to Deleted; restore one, delete one for good; select all in the list');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
