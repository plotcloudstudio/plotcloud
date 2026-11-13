// Generate pictures as figure sets (2026-11-13), on the hospital example:
// · every study's name shown in full in the panel (nothing cut off)
// · a ticked study shows the figures it gives as chips, its default set ticked; interior studies go through every level
// · Generate makes each figure: Sun hours' two maps from one run, Daylight's sDA on each level, Fire evacuation's escape routes and
//   its chart as a picture; the level, mode and study the person had are restored; the PDF has a page per figure
const { chromium } = require('playwright'), assert = require('node:assert/strict'), os = require('node:os'), fs = require('node:fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 }, acceptDownloads: true }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || os.tmpdir();
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    await p.goto(base + '/mvp/#/home'); await p.waitForSelector('[data-hospital]'); await p.click('.ph-thumb[data-hospital]');
    await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(2000);
    // the quality: Draft keeps the runs short
    const lv0 = await p.evaluate(() => __ws2.inst.persp.ws.level());
    await p.click('.sp-xlb'); await p.waitForTimeout(800);
    // names in full
    const names = await p.$$eval('.xl-gr .xl-gn', (ns) => ns.map((n) => [n.textContent, n.scrollWidth <= n.clientWidth + 1, n.getBoundingClientRect().height]));
    assert(names.length >= 10 && names.every((x) => x[1]), 'every name in full: ' + JSON.stringify(names)); for (const k of ['Sky Exposure & Solar Mask', 'Outdoor thermal comfort', 'Natural ventilation']) assert(names.some((x) => x[0] === k), k);
    // chips and defaults
    await p.check('[data-gp=daylight]'); await p.waitForTimeout(300);
    const dl = await p.$$eval('.xl-gr.on [data-gf^="daylight:"]', (bs) => bs.map((x) => [x.dataset.gf.split(':')[1], x.getAttribute('aria-pressed')]));
    assert.deepEqual(dl.filter((x) => x[1] === 'true').map((x) => x[0]), ['sda', 'ase', 'df'], 'Daylight default set: ' + JSON.stringify(dl));
    assert.match(await p.locator('.xl-gr.on').filter({ has: p.locator('[data-gp=daylight]') }).innerText(), /9 figures · every level: L1, L2, L3/);
    await p.screenshot({ path: `${out}/figsets-panel.png` }); console.log('PASS the panel: names in full,', names.length, 'studies; Daylight', JSON.stringify(dl));
    // Daylight: sDA only (3 figures, one per level)
    await p.click('[data-gf="daylight:ase"]'); await p.click('[data-gf="daylight:df"]');
    // Sun hours: its default two maps
    await p.check('[data-gp=sunhours]'); await p.waitForTimeout(200);
    // Fire evacuation: escape routes and the chart only
    await p.check('[data-gp=fire-evacuation]'); await p.waitForTimeout(200); await p.click('[data-gf="fire-evacuation:density"]'); await p.click('[data-gf="fire-evacuation:time"]');
    const tot = await p.locator('.xl-tot').innerText(); assert.match(tot, /7 figures from 5 runs/, tot); assert.match(await p.locator('[data-g=go]').innerText(), /Generate 7 figures/);
    // fewer fire runs keep this test short
    await p.evaluate(() => { const s = window.__wsStudy.state(); void s; }); await p.evaluate(() => window.__wsStudy.open('fire-evacuation')); await p.waitForTimeout(800);
    await p.evaluate(() => { const c = document.querySelector('.sp-studycard details[data-adv=egAll]'); if (c) c.open = true; }); await p.selectOption('.sp-studycard [data-eg=runs]', '10').catch(() => {}); await p.click('.sp-studycard [data-st=close]').catch(() => {});
    if (await p.locator('.sp-pop-xl').isHidden()) await p.click('.sp-xlb'); await p.waitForTimeout(500);
    await p.click('[data-g=go]');
    await p.waitForFunction(() => +document.querySelector('.sp-xlb .sp-badge')?.textContent >= 7 && !document.querySelector('.sp-runbar[data-state=run]'), null, { timeout: 1500000 });
    await p.waitForTimeout(1500); if (await p.locator('.sp-pop-xl').isHidden()) await p.click('.sp-xlb'); await p.waitForTimeout(800);
    const titles = await p.$$eval('.xl-it .xl-tx b', (bs) => bs.map((x) => x.textContent));
    for (const k of [/^Sun hours/, /2 h of sun or more/, /Daylight autonomy.*· Level 1$/, /Daylight autonomy.*· Level 2$/, /Daylight autonomy.*· Level 3$/, /escape routes/i, /Fire Evacuation · chart/]) assert(titles.some((t) => k.test(t)), k + ' in ' + JSON.stringify(titles));
    assert.equal(titles.length, 7, JSON.stringify(titles));
    // the chart is a real picture
    const chart = await p.evaluate(async () => { const m = await import('./js/export-list.js'); const L = await m.loadList(location.hash.split('/')[2].split('?')[0]); const it = L.items.find((x) => /chart/.test(x.title)); const bmp = await createImageBitmap(it.pictures[0].blob); return { w: bmp.width, h: bmp.height, size: it.pictures[0].blob.size, legend: it.legend }; });
    assert(chart.w >= 1000 && chart.h >= 300 && chart.size > 5000 && chart.legend === null, JSON.stringify(chart));
    assert.equal(await p.evaluate(() => __ws2.inst.persp.ws.level()), lv0, 'the level restored');
    assert.match(await p.locator('.xl-glast').innerText(), /Added 7 figures/);
    await p.screenshot({ path: `${out}/figsets-list.png` });
    const [d] = await Promise.all([p.waitForEvent('download', { timeout: 300000 }), p.click('.sp-pop-xl [data-xl=pdf]')]); const f = `${out}/${d.suggestedFilename()}`; await d.saveAs(f);
    const pages = (fs.readFileSync(f).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length; assert(pages >= 7, 'a page per figure: ' + pages);
    console.log('PASS Generate:', titles.length, 'figures', JSON.stringify(titles), '· chart', chart.w + '×' + chart.h, '· PDF', pages, 'pages');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
