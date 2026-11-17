// The founder editor's live preview (2026-11-17): beside the form, the Blog post, the resource and the About page are drawn by the
// same functions as the public pages and follow every keystroke. Blog: the card, then the page. About: the same sections as the
// public About page. Resources: a members-only library file shows its Members tag on the card and its facts on the page, with the
// download shown, not live. The content database is stood in for here; nothing is saved.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } }), p = await ctx.newPage(), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], shots = process.env.SHOT_DIR || require('os').tmpdir();
    p.on('pageerror', (e) => errs.push(e.message));
    const about = await (async () => { await p.goto(base + '/mvp/'); return p.evaluate(async () => (await import('./js/site-content.js')).aboutDefault); })();
    const docs = [{ id: 'about', kind: 'about', draft: about, revision: 2, published: { at: '2026-11-16' } }, { id: 'post-1', kind: 'blog', draft: { title: 'A talk on daylight', category: 'event', summary: 'Summary.', body: 'Body text.', university: 'QA School', location: 'Toronto', eventDate: '2026-12-03' }, revision: 1, published: null }];
    await ctx.route('https://cms.test.invalid/**', (r) => { const u = new URL(r.request().url());
      if (u.pathname === '/rest/v1/rpc/pc_site_edit') return r.fulfill({ json: docs });
      if (u.pathname === '/rest/v1/rpc/pc_public_site_content') return r.fulfill({ json: [{ id: 'about', kind: 'about', content: about }] });
      if (u.pathname === '/rest/v1/rpc/pc_is_admin') return r.fulfill({ json: true });
      if (u.pathname === '/auth/v1/user') return r.fulfill({ json: { id: 'u1', email: 'plotcloudstudio@gmail.com' } });
      return r.fulfill({ json: [] }); });
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem('pc-cloud-config', JSON.stringify({ url: 'https://cms.test.invalid', key: 'anon-test' })); });
    const tok = 'h.' + Buffer.from(JSON.stringify({ sub: 'u1', email: 'plotcloudstudio@gmail.com', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.s';
    await p.goto(base + `/mvp/#access_token=${tok}&refresh_token=r1&expires_in=3600&type=magiclink`); await p.waitForFunction(() => location.hash === '#/home');
    // Blog: the card follows the title as it is typed; Page shows the whole post
    await p.goto(base + '/mvp/#/founder'); await p.waitForSelector('#cmsForm'); await p.waitForSelector('#cmsLive article, #cmsLive .cms-live-cards *');
    assert(await p.isVisible('.cms-live'), 'the preview is beside the form');
    await p.fill('#cmsForm [name=title]', 'Daylight in early design: a talk'); await p.waitForFunction(() => /Daylight in early design: a talk/.test(document.querySelector('#cmsLive').innerText), null, { timeout: 3000 });
    assert.match(await p.locator('#cmsLive').innerText(), /Event[\s\S]*QA School[\s\S]*Toronto/i);
    await p.click('[data-live=page]'); await p.waitForTimeout(200); assert.match(await p.locator('#cmsLive').innerText(), /Daylight in early design: a talk[\s\S]*Body text\./);
    await p.fill('#cmsForm [name=body]', 'A new first paragraph.'); await p.waitForFunction(() => /A new first paragraph\./.test(document.querySelector('#cmsLive').innerText), null, { timeout: 3000 });
    const box = await p.locator('#cmsLive').boundingBox(), col = await p.locator('.cms-live').boundingBox(); assert(box.width <= col.width + 1, 'the page is scaled to the column: ' + box.width + ' vs ' + col.width);
    await p.screenshot({ path: shots + '/founder-live-blog.png' });
    console.log('PASS Blog: the card and the page follow the form as it is typed, scaled to fit beside it');
    // About: the preview has the public page's sections, from the same function
    p.once('dialog', (d) => d.accept()); await p.click('[data-section=about]'); await p.waitForSelector('#cmsLive .about-hero');
    const sections = (sel) => p.$$eval(sel, (ss) => ss.map((s) => s.className.split(' ')[0]));
    const inPreview = await sections('#cmsLive .about-page > section, #cmsLive .about-page > header');
    await p.fill('#cmsForm [name=headline]', 'A new headline\nSecond line'); await p.waitForFunction(() => /A new headline/.test(document.querySelector('#cmsLive h1')?.innerText || ''), null, { timeout: 3000 });
    assert.equal(await p.locator('#cmsLive h1 span').innerText(), 'Second line');
    await p.screenshot({ path: shots + '/founder-live-about.png' });
    const pub = await b.newPage({ viewport: { width: 1600, height: 1000 } }); await pub.goto(base + '/mvp/#/about'); await pub.waitForSelector('.about-hero');
    const onSite = await pub.$$eval('.about-page > section, .about-page > header', (ss) => ss.map((s) => s.className.split(' ')[0])); await pub.close();
    assert.deepEqual(inPreview, onSite, 'the same sections as the public About page');
    console.log(`PASS About: the preview has the public page's ${onSite.length} sections in the same order (${onSite.join(', ')}); the headline follows the form`);
    // Resources: a members-only library file
    p.once('dialog', (d) => d.accept()); await p.click('[data-section=resource]'); await p.click('#newPost'); await p.waitForSelector('#cmsForm [name=type]');
    await p.selectOption('#cmsForm [name=type]', 'library'); assert(await p.isVisible('#cmsForm [name=access]')); assert(!(await p.isVisible('#cmsForm [name=authors]')), 'paper fields hidden for a library file');
    await p.fill('#cmsForm [name=title]', 'Stair detail set'); await p.selectOption('#cmsForm [name=category]', 'cad'); await p.selectOption('#cmsForm [name=access]', 'members'); await p.fill('#cmsForm [name=formats]', 'dwg, pdf');
    await p.click('[data-live=card]'); await p.waitForFunction(() => /Stair detail set[\s\S]*Members/.test(document.querySelector('#cmsLive').innerText), null, { timeout: 3000 });
    assert.match(await p.locator('#cmsLive .lib-card').innerText(), /CAD Resources[\s\S]*Stair detail set[\s\S]*\.dwg · \.pdf[\s\S]*Members/i);
    await p.click('[data-live=page]'); await p.waitForTimeout(200); assert.match(await p.locator('#cmsLive').innerText(), /Members with active monthly, yearly or permanent access[\s\S]*Members only: visitors are asked to log in/);
    await p.screenshot({ path: shots + '/founder-live-library.png' });
    console.log('PASS Resources: a members-only library file previews as its card (Members tag) and its page (facts, the download shown, not live)');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
