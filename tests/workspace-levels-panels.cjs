// Levels and panels in the Workspace (2026-11-01): in 2D, + adds a level above and both views go there; the level menu takes both
// views back to 1F (a second level() in the modeler had replaced the setter). One panel at a time: Layers closes Project data,
// Project data closes Layers, Statistics closes Project data.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => { const b = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    await p.goto(base + '/mvp/#/new-project'); await p.waitForFunction(() => window.__newProjectMap, null, { timeout: 30000 });
    await p.evaluate(() => window.__newProjectMap.place(49.2448, -123.0071, 'QA site')); await p.waitForFunction(() => window.__newProjectMap.osm, null, { timeout: 120000 });
    await p.click('#npStart'); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 180000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click());
    const lv = () => p.evaluate(() => { const f = (w) => { const L = w.levels(); return L.list.find((l) => l.id === L.lv)?.short; }; return [f(__ws2.inst.plan.ws), f(__ws2.inst.persp.ws), document.querySelector('#levelBtn').textContent.replace(/\s*▾/, '')]; });
    await p.click('[data-sp=dim]'); await p.waitForTimeout(800); assert.equal(await p.locator('[data-sp=dim]').innerText(), '2D');
    await p.click('#addLevel'); await p.waitForTimeout(800); assert.deepEqual(await lv(), ['2F', '2F', 'Level · 2F']);
    await p.click('#levelBtn'); await p.locator('#levelMenu [data-level]').last().click(); await p.waitForTimeout(800); assert.deepEqual(await lv(), ['1F', '1F', 'Level · 1F']);
    await p.click('#levelBtn'); await p.locator('#levelMenu [data-level]').first().click(); await p.waitForTimeout(800); assert.deepEqual(await lv(), ['2F', '2F', 'Level · 2F']);
    console.log('PASS in 2D: + goes to the new level in both views; the level menu goes back to 1F and up to 2F again');
    const st = () => p.evaluate(() => ({ card: document.querySelector('.w2.sp').classList.contains('sp-card-open'), data: !document.querySelector('.sp-datasheet').hidden, stats: !document.querySelector('.sp-pop-stats').hidden }));
    await p.click('#tabList [data-tab=layers]'); await p.waitForTimeout(300); assert.deepEqual(await st(), { card: true, data: false, stats: false });
    await p.click('#tabList [data-tab=properties]'); await p.waitForTimeout(300); assert.deepEqual(await st(), { card: false, data: true, stats: false });
    await p.click('#tabList [data-tab=layers]'); await p.waitForTimeout(300); assert.deepEqual(await st(), { card: true, data: false, stats: false });
    await p.click('#tabList [data-tab=properties]'); await p.waitForTimeout(300); await p.click('[data-sp=stats]'); await p.waitForTimeout(300); assert.deepEqual(await st(), { card: false, data: false, stats: true });
    console.log('PASS one panel at a time: Layers ↔ Project data, and Statistics closes Project data');
    assert.deepEqual(errs, []);
  } finally { await b.close(); } })().catch((e) => { console.error(e); process.exit(1); });
