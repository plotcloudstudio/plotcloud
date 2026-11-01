// Compare two options (2026-11-01): Getting started › Compare two options opens Compare sketches in the Workspace, and the project
// overview's Compare plans opens the same sheet (its old comparison table is retired).
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => { const b = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    await p.goto(base + '/mvp/#/new-project'); await p.waitForFunction(() => window.__newProjectMap, null, { timeout: 30000 });
    await p.evaluate(() => window.__newProjectMap.place(49.2448, -123.0071, 'QA site')); await p.waitForFunction(() => window.__newProjectMap.osm, null, { timeout: 120000 });
    await p.click('#npStart'); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 180000 });
    const sheet = p.locator('.sp-sheet:not(.sp-datasheet)');
    await p.click('.pc-start [data-step="compare"] a'); await sheet.waitFor({ state: 'visible', timeout: 10000 }); assert.match(await p.evaluate(() => location.hash), /^#\/workspace\//);
    assert.match(await sheet.innerText(), /Compare sketches[\s\S]*Generate report/); console.log('PASS Getting started › Compare two options opens Compare sketches in the Workspace');
    const id = await p.evaluate(() => location.hash.split('/')[2]); await p.goto(base + '/mvp/#/project/' + id); await p.locator('#pjOpenCompare').waitFor();
    assert.equal(await p.locator('#cmpTable, #cmpA').count(), 0, 'the old comparison table is gone');
    await p.click('#pjOpenCompare'); await p.waitForFunction(() => window.__ws2?.inst.persp.ready, null, { timeout: 180000 }); await sheet.waitFor({ state: 'visible', timeout: 15000 });
    console.log('PASS the project overview’s Compare plans opens the same Compare sketches sheet; the old comparison table is retired');
    assert.deepEqual(errs, []);
  } finally { await b.close(); } })().catch((e) => { console.error(e); process.exit(1); });
