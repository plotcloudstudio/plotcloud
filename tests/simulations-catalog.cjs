const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.TEST_BASE || 'http://127.0.0.1:8767';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(base + '/mvp/#/simulations');
    await page.locator('[data-domain="climate-site"]').waitFor();
    assert.equal(await page.locator('.card.sim').count(), 18);
    assert.deepEqual(await page.locator('.sim-domain h2').allTextContents(), ['Climate & Site', 'Light & Views', 'Air & Indoor Comfort', 'Spatial Performance', 'Structural Screening']);
    assert.match(await page.locator('.sim-gap').innerText(), /Whole-building energy/);
    assert.match(await page.locator('[data-sim="daylight"] .sim-tags').innerText(), /Not a Radiance annual simulation/);
    assert.match(await page.locator('[data-sim="wind"] .sim-tags').innerText(), /Not wind-tunnel validated/);
    assert.match(await page.locator('[data-sim="evac"]').innerText(), /Not fire or life safety/);
    assert.equal(await page.locator('[data-sim="evac"] h3').innerText(), 'Circulation & travel paths');
    await page.locator('#filters [data-g="Exterior"]').click();
    assert.equal(await page.locator('.card.sim').count(), 6);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    console.log('PASS simulation catalogue: 18 studies, five domains, evidence limits, filters and mobile width');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
