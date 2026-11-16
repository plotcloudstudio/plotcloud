// The homepage and the shared page language (2026-11-16):
// · the cover: the heading and its words above the full-width study wall, the five workflow steps under it
// · the four cards in workflow order: Site analysis switches study and scope at once (no Calculate); Furniture: drag a piece in,
//   drag it to move it (it stays inside the walls), click to turn it, drag it off to remove it; Reports: the tabs change the figures
//   and the bars, from the saved results; Illustration: the line model starts in view and takes another ink
// · About in the site's language; headings left aligned with a green second line; nothing scrolls sideways on a phone
const { chromium } = require('playwright'), assert = require('node:assert/strict'), os = require('node:os');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || os.tmpdir();
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.save(); }); await p.goto(base + '/mvp/#/'); await p.waitForSelector('.lp-feature-card');
    // the cover
    const cover = await p.evaluate(() => { const l = document.querySelector('.lp-hero-lead').getBoundingClientRect(), w = document.querySelector('.lp-hero-full .lp-wall').getBoundingClientRect(), h1 = document.querySelector('.lp-hero-lead h1');
      return { side: w.top >= l.bottom - 12 && w.width >= l.width - 2,   /* the words slide in by 8 px */ steps: [...document.querySelectorAll('.lp-flow li b')].map((x) => x.textContent), green: getComputedStyle(h1.querySelector('span')).color, lines: Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight)) }; });
    assert(cover.side, 'the full-width wall under the words'); assert.deepEqual(cover.steps, ['Site analysis', 'Plan Studio', 'Simulation', 'Rendering', 'Boards']); assert.equal(cover.lines, 2, 'the heading on two lines'); assert.equal(cover.green, 'rgb(33, 100, 76)');
    const order = await p.$$eval('.lp-feature-card h3', (h) => h.map((x) => x.textContent)); assert.deepEqual(order, ['Site analysis', 'Furniture', 'Reports', 'Illustration']);
    console.log('PASS the cover and the card order:', JSON.stringify(cover.steps));
    // 01 Site analysis
    const site = p.locator('.lp-card-site'); await site.scrollIntoViewIfNeeded(); assert.equal(await p.locator('.lp-calculate').count(), 0, 'no Calculate');
    const seen = new Set(); for (const sc of ['site', 'building']) { await site.locator(`button[data-scope=${sc}]`).click(); for (const st of ['wind', 'sun', 'rain', 'snow']) { await site.locator(`button[data-study=${st}]`).click();
      await p.waitForFunction((src) => document.querySelector('.lp-site-img').getAttribute('src').endsWith(src), `${sc}-${st}.webp`, { timeout: 10000 }); seen.add(await site.locator('.lp-site-caption').innerText()); } }
    assert.equal(seen.size, 8, 'eight results, eight captions'); console.log('PASS Site analysis: 8 study × scope results at a click');
    // 02 Furniture
    const card = p.locator('.lp-card-furniture'); await card.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    const plan = await p.locator('.lp-plan-placements').boundingBox(), sofa = await card.locator('[data-piece=sofa]').boundingBox();
    await p.mouse.move(sofa.x + sofa.width / 2, sofa.y + sofa.height / 2); await p.mouse.down(); await p.mouse.move(plan.x + plan.width * .35, plan.y + plan.height * .45, { steps: 8 }); await p.mouse.up();
    assert.equal(await p.locator('.lp-placed-furniture').count(), 1, 'dragged onto the plan'); const pc = await p.locator('.lp-placed-furniture').boundingBox();
    const ratio = pc.width / plan.width; assert(Math.abs(ratio - 2.22 * 31 / 1272 * 2) < 0.01, 'true size ' + ratio);
    await p.mouse.move(pc.x + pc.width / 2, pc.y + pc.height / 2); await p.mouse.down(); await p.mouse.move(plan.x + plan.width * .99, plan.y + plan.height * .05, { steps: 8 }); await p.mouse.up();
    const moved = await p.locator('.lp-placed-furniture').boundingBox(); assert(moved.x + moved.width <= plan.x + plan.width * .885 && moved.y >= plan.y + plan.height * .125, 'moved, inside the walls');
    await p.locator('.lp-placed-furniture').click(); assert.match(await p.locator('.lp-placed-furniture').getAttribute('style'), /rotate\(90deg\)/, 'a click turns it');
    const m2 = await p.locator('.lp-placed-furniture').boundingBox(); await p.mouse.move(m2.x + m2.width / 2, m2.y + m2.height / 2); await p.mouse.down(); await p.mouse.move(plan.x + plan.width * 1.3, plan.y - 60, { steps: 8 }); await p.mouse.up();
    assert.equal(await p.locator('.lp-placed-furniture').count(), 0, 'dragged off: removed');
    await card.locator('[data-piece=chair]').focus(); await p.keyboard.press('Enter'); assert.equal(await p.locator('.lp-placed-furniture').count(), 1, 'Enter places'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('Delete'); assert.equal(await p.locator('.lp-placed-furniture').count(), 0);
    console.log('PASS Furniture: drag in at true size, move inside the walls, turn, drag off, keyboard');
    // 03 Reports
    const rep = p.locator('.lp-card-report'); await rep.scrollIntoViewIfNeeded(); const t1 = await rep.locator('.lp-rep-body').innerText(); assert.match(t1, /Floor average[\s\S]*\+0\.69[\s\S]*2\.37/);
    await rep.locator('[data-rep=vent]').click(); const t2 = await rep.locator('.lp-rep-body').innerText(); assert.match(t2, /Air changes[\s\S]*\+16\.1[\s\S]*51\.2/); assert((await rep.locator('.lp-bars > span').count()) >= 4);
    assert.equal(await rep.locator('a[href$="fallingwater-ventilation.pdf"]').count(), 1); console.log('PASS Reports: tabs over the saved results');
    // 04 Illustration
    const ill = p.locator('.lp-card-illustration'); await ill.scrollIntoViewIfNeeded(); await p.waitForFunction(() => document.querySelector('.lp-card-illustration').dataset.live === '1', null, { timeout: 60000 });
    await ill.locator('[data-ink="#C8352B"]').click(); assert.equal(await ill.getAttribute('data-ink'), '#C8352B'); await p.screenshot({ path: `${out}/home-cards.png`, fullPage: true }); console.log('PASS Illustration: live, red ink');
    // About and the shared headings
    await p.goto(base + '/mvp/#/about'); await p.waitForSelector('.about-beliefs li'); const ab = await p.evaluate(() => ({ h: getComputedStyle(document.querySelector('.about-hero h1')).textAlign, span: getComputedStyle(document.querySelector('.about-hero h1 span')).color, beliefs: document.querySelectorAll('.about-beliefs li').length, checks: document.querySelectorAll('.about-checkgrid > div').length }));
    assert.deepEqual(ab, { h: 'left', span: 'rgb(33, 100, 76)', beliefs: 6, checks: 4 }); console.log('PASS About:', JSON.stringify(ab));
    for (const h of ['#/pricing', '#/blog', '#/resources']) { await p.goto(base + '/mvp/' + h); await p.waitForSelector('#app h1'); await p.waitForTimeout(600); const a = await p.evaluate(() => getComputedStyle(document.querySelector('#app h1')).textAlign); assert.equal(a, 'left', h + ' heading left'); }
    // a phone
    const m = await b.newPage({ viewport: { width: 390, height: 844 } }); for (const h of ['#/', '#/about', '#/pricing']) { await m.goto(base + '/mvp/' + h); await m.waitForTimeout(1500); assert.equal(await m.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, h + ' no sideways scroll'); }
    console.log('PASS headings left on Pricing, Blog, Resources; no sideways scroll on a phone');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
