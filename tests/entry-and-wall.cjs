// Entry and the home page wall (2026-11-09). The site's root address goes straight to PlotCloud: no white page with a link first
// (the redirect runs before anything is drawn; an older bookmarked #/… address still lands on its new place). On the home page the
// wall of simulations moves as soon as the page opens, with no click, also when the system prefers reduced motion (at half speed);
// Pause wall stops it.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try { const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [];
    // 1 · the root: straight to /mvp/, nothing drawn on the way
    for (const [from, to] of [['/', /\/mvp\/#\/$/], ['/#/workspace', /\/mvp\/#\/workspace$/], ['/#/tool/sunhours', /\/mvp\/#\/simulations\/sunhours$/]]) {
      const p = await b.newPage(); p.on('pageerror', (e) => errs.push(e.message)); 
      await p.goto(base + from, { waitUntil: 'commit' }); await p.waitForURL(to, { timeout: 20000 });
      // the root page itself shows nothing while JavaScript is on: its only text is inside <noscript>
      const shown = await b.newPage().then(async (q) => { await q.route('**/legacy-redirect.js', (r) => r.fulfill({ body: '/* held */', contentType: 'text/javascript' })); await q.goto(base + '/'); const t = await q.evaluate(() => document.body.innerText.trim()); await q.close(); return t; });
      assert.equal(shown, '', 'the root page draws no text before the redirect');
      console.log('PASS', from, '→', p.url().replace(base, '')); await p.close(); }

    // 2 · the wall moves on its own, with normal motion and with reduced motion (half speed); Pause wall stops it
    for (const rm of ['no-preference', 'reduce']) { const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); p.on('pageerror', (e) => errs.push(e.message)); await p.emulateMedia({ reducedMotion: rm });
      await p.goto(base + '/mvp/#/'); await p.waitForSelector('#lpDriftWall .drift-wall__track, #lpDriftWall [class*=track]', { timeout: 30000 }); await p.waitForTimeout(800);
      const pos = () => p.evaluate(() => [...document.querySelectorAll('#lpDriftWall [class*=track]')].slice(0, 2).map((t) => getComputedStyle(t).transform));
      const a = await pos(); await p.waitForTimeout(1200); const c = await pos();
      const state = await p.evaluate(() => ({ motion: document.querySelector('#lpDriftWall').dataset.motion, button: document.querySelector('#lpDriftPause')?.textContent }));
      assert.notDeepEqual(a, c, `the wall moves by itself (${rm})`); assert.equal(state.motion, 'running'); assert.equal(state.button, 'Pause wall');
      await p.click('#lpDriftPause'); await p.waitForTimeout(300); const d = await pos(); await p.waitForTimeout(900); assert.deepEqual(await pos(), d, 'Pause wall stops it');
      console.log(`PASS the wall moves on its own (${rm}), Pause wall stops it`); await p.close(); }
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
