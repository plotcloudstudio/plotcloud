// The page policy (2026-11-17): the main pages, a Resources tool, the new-project map and the Workspace with an example open, with
// the Content-Security-Policy of mvp/index.html: nothing the site needs is refused, and the policy is in force (an inline script
// may run, a script from another site may not).
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', refused = [], errs = [];
    p.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) refused.push(p.url().split('#')[1] + ' :: ' + m.text().slice(0, 200)); });
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    for (const h of ['#/', '#/about', '#/blog', '#/blog/fallingwater-model-sources', '#/pricing', '#/resources', '#/resources/tool/stairs3d', '#/resources/files', '#/legal/terms', '#/login', '#/home', '#/simulations', '#/account', '#/new-project']) {
      await p.goto(base + '/mvp/' + h); await p.waitForTimeout(h === '#/new-project' || h.startsWith('#/resources/tool') ? 5000 : 1800);
    }
    const id = await p.evaluate(async () => (await import('./js/fallingwater-dashboard.js')).openCase().id);
    await p.goto(base + '/mvp/#/workspace/' + id); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.waitForTimeout(3000);
    await p.goto(base + '/mvp/#/project/' + id); await p.waitForTimeout(2500);
    await p.goto(base + '/mvp/#/results/' + id); await p.waitForTimeout(2500);
    assert.deepEqual(refused, [], 'nothing refused:\n' + refused.join('\n'));
    // in force: an outside script is refused
    const outside = await p.evaluate(() => new Promise((ok) => { const s = document.createElement('script'); s.src = 'https://example.com/x.js'; s.onerror = () => ok('blocked'); s.onload = () => ok('loaded'); document.head.appendChild(s); setTimeout(() => ok('timeout'), 4000); }));
    assert.equal(outside, 'blocked', 'a script from another site is refused');
    console.log('PASS the page policy: 17 pages and the Workspace load with nothing refused; a script from another site is refused');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
