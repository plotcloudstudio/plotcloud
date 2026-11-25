// One panel at a time in the Workspace (2026-11-18): opening any panel closes the one open before. Compare versions, then
// Spaces: Compare closes; Assets, then the simulations menu: Assets closes; and so on through Statistics, Project data, Layers
// (the panels card), Simulation quality, the Export list, Project props and the tool palette. After each step, exactly one is open.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 960 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'persp' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    const id = await p.evaluate(async () => (await import('./js/fallingwater-dashboard.js')).openCase().id); await p.goto(base + '/mvp/#/workspace/' + id);
    await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    // what is open now
    const open = () => p.evaluate(() => { const vis = (s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden"; }, r = document.querySelector('.w2.sp') || document.body, out = [];
      for (const k of ['stats', 'spaces', 'q', 'xl', 'sun', 'snap', 'vis']) if (vis('.sp-pop-' + k)) out.push('pop:' + k);
      if (r.classList.contains('sp-card-open')) out.push('card'); if (r.classList.contains('sp-cmp-open')) out.push('compare'); if (r.classList.contains('sp-pal-open')) out.push('palette');
      for (const [k, s] of [['data', '.sp-datasheet'], ['assets', '.sp-assets'], ['props', '.sp-propscard'], ['sim', '.w2-simmenu']]) if (vis(s)) out.push(k); return out; });
    const step = async (name, act, want) => { await act(); await p.waitForTimeout(500); const o = await open(); assert.deepEqual(o, [want], `${name}: open ${JSON.stringify(o)}`); return o; };
    const rail = (k) => () => p.click(`.w2.sp [data-sp="${k}"]`);
    const steps = [
      ['Compare versions', () => p.click('#tabList [data-tab="versions"]'), 'compare'],
      ['Spaces', rail('spaces'), 'pop:spaces'],
      ['Assets', rail('assets'), 'assets'],
      ['Simulations menu', () => p.click('#addSimBtn'), 'sim'],
      ['Statistics', rail('stats'), 'pop:stats'],
      ['Layers', () => p.click('#tabList [data-tab="layers"]'), 'card'],
      ['Compare versions again', () => p.click('#tabList [data-tab="versions"]'), 'compare'],
      ['Simulation quality', () => p.click('.sp-q'), 'pop:q'],
      ['Assets again', rail('assets'), 'assets'],
      ['Export list', () => p.click('.sp-xlb'), 'pop:xl'],
      ['Visibility', rail('vis'), 'pop:vis'],
      ['Simulations menu again', () => p.click('#addSimBtn'), 'sim'],
      ['Sun position', rail('sun'), 'pop:sun'],
      ['Project data', () => p.click('#tabList [data-tab="properties"]'), 'data'],
      ['Tool palette', () => p.locator('[data-panel]:visible:not([aria-disabled=true])').first().click(), 'palette'],
      ['Project props', () => p.locator('.w2.sp [data-sp="props"]').first().click(), 'props'],
      ['Spaces after Project props', rail('spaces'), 'pop:spaces']];
    for (const [n, a, w] of steps) await step(n, a, w);
    console.log(`PASS one panel at a time through ${steps.length} openings: ${steps.map((x) => x[0]).join(' → ')}`);
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
