// Sign-in forms (2026-11-17): sign-up states the password rule and refuses a weak password before anything is sent; log-in offers
// "Forgot your password?", which asks Supabase for a reset email (the request is intercepted here); a reset link opens "Set a new
// password", which refuses mismatched or weak passwords and saves a good one. No real Supabase project is touched.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }), p = await ctx.newPage(), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], sent = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await ctx.route('https://auth.test.invalid/**', (r) => { const u = new URL(r.request().url()); sent.push([r.request().method(), u.pathname, r.request().postData() || '']);
      if (u.pathname === '/auth/v1/user') return r.fulfill({ json: { id: 'u1', email: 'qa@x.test' } }); return r.fulfill({ json: {} }); });
    await p.goto(base + '/mvp/'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('pc-cloud-config', JSON.stringify({ url: 'https://auth.test.invalid', key: 'anon-test' })); });
    // sign-up: the rule, and a weak password stopped here
    await p.goto(base + '/mvp/#/login?signup=1'); await p.reload(); await p.waitForSelector('#f input[name=password]');
    assert.match(await p.locator('#f').innerText(), /At least 10 characters, with letters and at least one number/);
    assert.equal(await p.getAttribute('#f input[name=password]', 'minlength'), '10');
    await p.fill('#f input[name=name]', 'QA'); await p.fill('#f input[name=email]', 'qa@x.test'); await p.fill('#f input[name=password]', 'onlyletterspw'); await p.click('#go'); await p.waitForTimeout(500);
    assert.match(await p.locator('#authMsg').innerText(), /At least 10 characters/); assert.equal(sent.filter((x) => /signup/.test(x[1])).length, 0, 'nothing sent for a weak password');
    console.log('PASS sign-up: the rule is shown; a weak password is refused before anything is sent');
    // log-in: forgot password
    await p.goto(base + '/mvp/#/login'); await p.waitForSelector('#forgot'); await p.click('#forgot'); assert.match(await p.locator('#authMsg').innerText(), /Type your email first/);
    await p.fill('#f input[name=email]', 'qa@x.test'); await p.click('#forgot'); await p.waitForTimeout(500);
    assert.match(await p.locator('#authMsg').innerText(), /link to set a new password is on its way/); const rec = sent.find((x) => x[1] === '/auth/v1/recover'); assert(rec && /qa@x\.test/.test(rec[2]), 'the reset email is requested');
    console.log('PASS log-in: Forgot your password? asks for the reset email');
    // the reset link: signed in, asked for a new password
    const tok = (o) => 'h.' + Buffer.from(JSON.stringify(o)).toString('base64url') + '.s';
    const at = tok({ sub: 'u1', email: 'qa@x.test', exp: Math.floor(Date.now() / 1000) + 3600 });
    await p.goto(base + `/mvp/#access_token=${at}&refresh_token=r1&expires_in=3600&type=recovery`); await p.waitForSelector('#pw', { timeout: 15000 });
    assert.match(await p.evaluate(() => location.hash), /#\/login\?set=1/); assert.match(await p.locator('#pw').innerText(), /Set a new password[\s\S]*qa@x\.test/);
    await p.fill('#pw input[name=password]', 'goodpassword1'); await p.fill('#pw input[name=again]', 'goodpassword2'); await p.click('#pwGo'); await p.waitForTimeout(300); assert.match(await p.locator('#pwMsg').innerText(), /differ/);
    await p.fill('#pw input[name=password]', 'weakweakweak'); await p.fill('#pw input[name=again]', 'weakweakweak'); await p.click('#pwGo'); await p.waitForTimeout(300); assert.match(await p.locator('#pwMsg').innerText(), /At least 10 characters/);
    await p.fill('#pw input[name=password]', 'goodpassword1'); await p.fill('#pw input[name=again]', 'goodpassword1'); await p.click('#pwGo'); await p.waitForFunction(() => location.hash === '#/home', null, { timeout: 10000 });
    const put = sent.find((x) => x[0] === 'PUT' && x[1] === '/auth/v1/user'); assert(put && /goodpassword1/.test(put[2]), 'the new password is saved');
    console.log('PASS the reset link opens Set a new password; mismatched and weak passwords refused; a good one saved');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
