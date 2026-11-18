// The account menu (2026-11-17): for a founder signed in to the cloud, "Manage site content" and "Manage account access" sit one per
// row like the other items, and the sync line is a small note under a divider; at desktop and phone widths. The founder check and
// the cloud are stood in for here; nothing is sent to a real Supabase project.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
    for (const [w, h] of [[1280, 900], [390, 844]]) {
      const ctx = await b.newContext({ viewport: { width: w, height: h } }), p = await ctx.newPage(), errs = [];
      p.on('pageerror', (e) => errs.push(e.message));
      await ctx.route('https://menu.test.invalid/**', (r) => r.fulfill({ json: /pc_is_admin/.test(r.request().url()) ? true : {} }));
      await p.goto(base + '/mvp/');
      await p.evaluate(async () => {
        localStorage.clear(); localStorage.setItem('pc-cloud-config', JSON.stringify({ url: 'https://menu.test.invalid', key: 'anon-test' }));
        const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'Jun Chen', email: 'plotcloudstudio@gmail.com', cloud: true }; S.save();
      });
      await p.goto(base + '/mvp/#/home'); await p.reload(); await p.waitForSelector('#whoBtn', { state: 'visible' });
      // the founder links, as the menu fills them in once the admin check answers
      await p.evaluate(() => { const el = document.getElementById('adminMenuLink'); if (el && !el.children.length) el.innerHTML = '<a role="menuitem" href="#/founder">Manage site content</a><a role="menuitem" href="#/admin">Manage account access</a>'; });
      await p.click('#whoBtn'); await p.waitForSelector('#whoMenu:not([hidden])');
      const rows = await p.$$eval('#whoMenu a, #whoMenu button, #whoSync', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), x: Math.round(r.left), y: Math.round(r.top), h: Math.round(r.height), fs: parseFloat(getComputedStyle(e).fontSize) }; }));
      const items = rows.filter((r) => r.t !== '' && !/^Synced|^Not synced|^Syncing/.test(r.t));
      // every item on its own row, all left-aligned together, none wrapped onto two lines
      for (let i = 1; i < items.length; i++) assert(items[i].y >= items[i - 1].y + items[i - 1].h - 1, 'one item per row: ' + JSON.stringify(items));
      assert.equal(new Set(items.map((r) => r.x)).size, 1, 'items line up: ' + JSON.stringify(items));
      assert(items.every((r) => r.h < 50), 'no item wraps: ' + JSON.stringify(items));
      const sync = rows.find((r) => /^Synced|^Not synced|^Syncing/.test(r.t)); assert(sync && sync.fs <= 12.5 && sync.x === items[0].x, 'the sync line is a small note: ' + JSON.stringify(sync));
      await p.screenshot({ path: (process.env.SHOT_DIR || require('os').tmpdir()) + `/account-menu-${w}.png` });
      assert.deepEqual(errs, []);
      console.log(`PASS the account menu at ${w}px: founder links one per row, aligned; the sync line a small note`);
      await ctx.close();
    }
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
