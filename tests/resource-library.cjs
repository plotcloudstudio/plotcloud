// The resource library back on Resources (2026-11-17), with free and members-only files. The content database and Supabase are
// stood in for here (nothing real is touched): LEED v5 finder and the Ergonomics cheat sheet are gone from the references; the
// library has its category, access, search and sort filters; published library files show with a Free or Members tag; a free file
// links straight to its file; a members-only file asks a visitor to log in, sends a signed-in person without access to Pricing,
// and for a member asks Supabase for a five-minute signed link (the file's own address is never a download link).
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } }), p = await ctx.newPage(), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], signed = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const items = [
      { id: 'lib-free', kind: 'resource', publishedAt: '2026-11-16T10:00:00Z', content: { type: 'library', title: 'Free section template', summary: 'A drawing template.', category: 'pres', access: 'free', formats: 'pdf, indd', compatibility: 'InDesign 2022+', size: '8 MB', license: 'Free for studio use', file: 'https://files.test/section-template.zip' } },
      { id: 'lib-members', kind: 'resource', publishedAt: '2026-11-17T10:00:00Z', content: { type: 'library', title: 'Window detail set', summary: 'CAD details.', category: 'cad', access: 'members', formats: 'dwg, pdf', compatibility: 'AutoCAD 2018+', size: '24 MB', license: 'Members, project use', file: 'library-files/2026/abc-window-details.zip' } },
    ];
    let member = { active: false };
    await ctx.route('https://lib.test.invalid/**', (r) => { const u = new URL(r.request().url());
      if (u.pathname === '/rest/v1/rpc/pc_public_site_content') return r.fulfill({ json: items });
      if (u.pathname === '/rest/v1/rpc/pc_access_status') return r.fulfill({ json: member });
      if (u.pathname === '/rest/v1/rpc/pc_is_admin') return r.fulfill({ json: false });
      if (u.pathname === '/auth/v1/user') return r.fulfill({ json: { id: 'u1', email: 'qa@x.test' } });
      if (u.pathname.startsWith('/storage/v1/object/sign/library-files/') && r.request().method() === 'GET') return r.fulfill({ body: 'zip' });   // the signed link opened
      if (u.pathname.startsWith('/storage/v1/object/sign/library-files/')) { signed.push([u.pathname, r.request().headers().authorization || '']); return member.active ? r.fulfill({ json: { signedURL: '/object/sign/library-files/2026/abc-window-details.zip?token=t1' } }) : r.fulfill({ status: 400, json: { message: 'Object not found' } }); }
      if (u.pathname.startsWith('/storage/v1/object/sign/')) return r.fulfill({ status: 404, json: {} });
      return r.fulfill({ json: [] }); });
    await ctx.route('https://files.test/**', (r) => r.fulfill({ body: 'zip' }));
    await p.goto(base + '/mvp/'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('pc-cloud-config', JSON.stringify({ url: 'https://lib.test.invalid', key: 'anon-test' })); });
    // the page: references without LEED or Ergonomics; the library with its filters and the two files
    await p.goto(base + '/mvp/#/resources'); await p.reload(); await p.waitForSelector('#library'); await p.waitForFunction(() => document.querySelectorAll('#resourceGrid .lib-card').length === 2, null, { timeout: 15000 });
    const text = await p.locator('#app').innerText(); assert.doesNotMatch(text, /LEED v5 finder|Ergonomics cheat sheet/); assert.match(text, /Building code finder[\s\S]*Accessibility finder[\s\S]*Scale & sheets/);
    assert.deepEqual(await p.$$eval('#library .resource-filter label', (ls) => ls.map((l) => l.firstChild.textContent.trim())), ['Category', 'Access', 'Search', 'Sort']);
    const cards = await p.$$eval('#resourceGrid .lib-card', (cs) => cs.map((c) => [c.querySelector('h3').textContent, c.querySelector('.lib-tag').textContent, c.getAttribute('href')]));
    assert.deepEqual(cards, [['Window detail set', 'Members', '#/resources/pub/lib-members'], ['Free section template', 'Free', '#/resources/pub/lib-free']]);
    await p.selectOption('#resourceCategory', 'cad'); assert.deepEqual(await p.$$eval('#resourceGrid .lib-card h3', (h) => h.map((x) => x.textContent)), ['Window detail set']);
    await p.selectOption('#resourceCategory', 'revit'); assert.match(await p.locator('#resourceGrid').innerText(), /Nothing in this category yet/);
    await p.selectOption('#resourceCategory', 'all'); await p.selectOption('#resourceAccess', 'free'); assert.deepEqual(await p.$$eval('#resourceGrid .lib-card h3', (h) => h.map((x) => x.textContent)), ['Free section template']);
    await p.selectOption('#resourceAccess', 'all'); await p.fill('#resourceSearch', 'dwg'); assert.deepEqual(await p.$$eval('#resourceGrid .lib-card h3', (h) => h.map((x) => x.textContent)), ['Window detail set']);
    await p.selectOption('#resourceCategory', 'all'); await p.fill('#resourceSearch', ''); await p.dispatchEvent('#resourceSearch', 'input'); await p.locator('#library').screenshot({ path: (process.env.SHOT_DIR || require('os').tmpdir()) + '/resource-library.png' }); await p.fill('#resourceSearch', 'dwg');
    console.log('PASS Resources: LEED v5 finder and Ergonomics gone; the library with Category, Access, Search and Sort; a Free and a Members file, each filter working');
    // a free file: its page links to the file
    await p.goto(base + '/mvp/#/resources/pub/lib-free'); await p.waitForSelector('#libAction');
    assert.equal(await p.getAttribute('#libAction a', 'href'), 'https://files.test/section-template.zip'); assert.match(await p.locator('.lib-facts').innerText(), /\.pdf · \.indd[\s\S]*InDesign 2022\+[\s\S]*8 MB[\s\S]*Free for studio use[\s\S]*Free to download/);
    // a members' file: a visitor is asked to log in; the file path is not a link anywhere on the page
    await p.goto(base + '/mvp/#/resources/pub/lib-members'); await p.waitForFunction(() => /Log in to download/.test(document.querySelector('#libAction')?.textContent || ''));
    assert.equal(await p.locator('a[href*="library-files"]').count(), 0, 'no link to the private file');
    console.log('PASS a free file links to its file; a members-only file asks a visitor to log in, and its path is not a link');
    // signed in without access: sent to Pricing; Supabase is never asked for a link
    const tok = 'h.' + Buffer.from(JSON.stringify({ sub: 'u1', email: 'qa@x.test', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.s';
    await p.goto(base + `/mvp/#access_token=${tok}&refresh_token=r1&expires_in=3600&type=magiclink`); await p.waitForFunction(() => location.hash === '#/home');
    await p.goto(base + '/mvp/#/resources/pub/lib-members'); await p.waitForFunction(() => /get monthly access/.test(document.querySelector('#libAction')?.textContent || ''));
    assert.equal(await p.getAttribute('#libAction a', 'href'), '#/pricing'); assert.equal(signed.length, 0);
    // a member: Download asks for a signed link with the person's token and opens it
    member = { active: true, accessType: 'month' }; await p.reload(); await p.waitForSelector('#libDownload');
    const [pop] = await Promise.all([p.waitForEvent('popup', { timeout: 10000 }).catch(() => null), p.click('#libDownload')]);
    await p.waitForFunction(() => /download has started/.test(document.querySelector('#libNote')?.textContent || ''));
    assert.equal(signed.length, 1); assert.equal(signed[0][0], '/storage/v1/object/sign/library-files/2026/abc-window-details.zip'); assert.match(signed[0][1], /^Bearer h\./);
    if (pop) { assert.match(pop.url(), /^https:\/\/lib\.test\.invalid\/storage\/v1\/object\/sign\/library-files\/2026\/abc-window-details\.zip\?token=t1&download=abc-window-details\.zip$/); await pop.close(); }
    console.log('PASS without access: Pricing, no link asked for; a member: a signed link asked for with their token and opened');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
