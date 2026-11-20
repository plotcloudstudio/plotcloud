// Catalog completeness, actual image decoding and catalog-to-Workspace handoff.
// Membership is mocked only in the isolated browser test context; solvers are unchanged.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { resourceAccessFixture } = require('./resource-access-fixture.cjs');
const base = process.env.TEST_BASE || 'http://127.0.0.1:8893';
const shots = process.env.SHOT_DIR || require('node:os').tmpdir();
(async () => {
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await resourceAccessFixture(context);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/mvp/#/simulations');
    await page.waitForSelector('[data-sim]');
    const registry = await page.evaluate(async () => {
      const { SIMS } = await import('./js/data.js');
      const { categoryOf, CATEGORIES } = await import('./js/capabilities.js');
      return SIMS.map(s => ({ id: s.id, category: categoryOf(s.id), valid: CATEGORIES.some(c => c.id === categoryOf(s.id)) }));
    });
    assert(registry.every(s => s.valid), 'every study must have a visible category');
    const ids = registry.map(s => s.id).sort();
    assert.deepEqual((await page.locator('[data-sim]').evaluateAll(cards => cards.map(c => c.dataset.sim))).sort(), ids);
    assert.match(await page.locator('.lede').innerText(), new RegExp(`Browse all ${ids.length} current analysis tools`));
    for (const id of ids) {
      const card = page.locator(`[data-sim="${id}"]`), img = card.locator('img');
      assert.equal(await card.locator('.acts a').getAttribute('href'), '#/simulations/' + id);
      await img.scrollIntoViewIfNeeded();
      await img.evaluate(image => image.decode());
      assert(await img.evaluate(image => image.complete && image.naturalWidth > 0), id + ' image');
    }
    console.log('PASS all ' + ids.length + ' catalog entries and decoded cover images');
    for (const label of ['Building analysis', 'Interior analysis', 'Tables', 'All']) {
      await page.locator('#filters').getByRole('button', { name: label, exact: true }).click();
      const category = { 'Building analysis': 'building', 'Interior analysis': 'interior', Tables: 'table' }[label];
      const expected = registry.filter(s => !category || s.category === category).map(s => s.id).sort();
      assert.deepEqual((await page.locator('[data-sim]').evaluateAll(cards => cards.map(c => c.dataset.sim))).sort(), expected);
    }
    await page.locator('[data-sim="vehicle-swept-path"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shots, 'simulation-site-access-catalog.png') });
    await page.locator('[data-sim="watersound"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shots, 'simulation-water-cover.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile catalog overflow');
    await page.screenshot({ path: path.join(shots, 'simulation-catalog-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Empty input must lead to an actionable setup page, never a missing legacy engine.
    await page.evaluate(async () => { const S = await import('./js/store.js'); S.projects().splice(0); S.save(); });
    for (const id of ids) {
      await page.goto(base + '/mvp/#/simulations/' + id);
      await page.waitForFunction(() => document.querySelector('#app h1'));
      const body = await page.locator('#app').innerText();
      assert(!/unknown (simulation|tool)|404|not found|Study removed|could not finish loading/i.test(body), id + ': ' + body);
      assert.equal(await page.locator('#app iframe').count(), 0, id + ' should request a model before loading an engine');
    }
    console.log('PASS all ' + ids.length + ' routes provide input/setup without a missing engine');
    await page.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); });
    for (const [id, selector] of [['vehicle-swept-path', '[data-va]'], ['parking-layout', '[data-pk=drawarea]'], ['watersound', '[data-st=run]']]) {
      await page.goto(base + '/mvp/#/simulations');
      await page.locator(`[data-sim="${id}"] .acts a`).click();
      await page.waitForFunction(id => window.__wsStudy?.state().id === id && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, id, { timeout: 60000 }).catch(async error => {
        console.error(await page.locator('#app').textContent(), errors);
        await page.screenshot({ path: path.join(shots, 'simulation-entry-failure.png') });
        throw error;
      });
      await page.waitForSelector('.sp-studycard ' + selector);
      assert.match(page.url(), /#\/workspace\//);
      await page.evaluate(() => document.querySelector('.pc-start .x')?.click());
      await page.screenshot({ path: path.join(shots, 'simulation-entry-' + id + '.png') });
      console.log('PASS catalog opens actual Workspace card: ' + id);
    }
    assert.deepEqual(errors, [], 'browser page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
