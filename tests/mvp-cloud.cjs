// Accounts and the cloud copy of projects (2026-10-25), against a local stand-in for Supabase: real Postgres 16 with the PlotCloud
// migration and its Row Level Security, real PostgREST, and an auth gateway that issues Supabase-style tokens
// (tests/backend/local-backend.sh start). Each browser context is one device.
// Run: tests/backend/local-backend.sh start, a static server on 8765, then node tests/mvp-cloud.cjs.
const { chromium } = require('playwright');
const fs = require('fs'), { execFileSync } = require('child_process');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const B = (process.env.TEST_BASE || 'http://127.0.0.1:8765') + '/mvp/', API = process.env.CLOUD_URL || 'http://127.0.0.1:54321';
const KEY = process.env.CLOUD_KEY || fs.readFileSync('/tmp/pc-backend/anon.env', 'utf8').trim().split('=')[1];
const psql = (q) => execFileSync('psql', ['-h', '/tmp', '-p', process.env.PGPORT || '54329', '-U', 'postgres', '-d', 'plotcloud', '-tAc', q], { encoding: 'utf8' }).trim();
const stamp = Date.now().toString(36), EMAIL = `ann.${stamp}@test.dev`, PW = 'correct horse 1';
(async () => {
  const b = await chromium.launch(); const errs = [];
  async function device(name, { config = true } = {}) {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(`${name}: ${e.message}`)); if (process.env.DBG) p.on('response', (r) => { if (/54321/.test(r.url())) console.log('   ', name, r.status(), r.request().method(), r.url().replace(API, '').slice(0, 100)); });
    if (!config) await ctx.route('**/js/backend-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"export const SUPABASE_URL='';export const SUPABASE_ANON_KEY='';"}));
    await p.goto(B); await p.evaluate(([cfg, url, key]) => { localStorage.clear(); indexedDB.deleteDatabase('plotcloud'); if (cfg) localStorage.setItem('pc-cloud-config', JSON.stringify({ url, key })); }, [config, API, KEY]);
    await p.goto(B + '#/'); await p.reload(); await p.waitForTimeout(700); return p;
  }
  const ev = (p, fn, a) => p.evaluate(fn, a);
  const sync = (p) => ev(p, async () => { const C = await import('./js/cloud.js'); const r = await C.sync(); return { ...r, info: C.info() }; });
  const names = (p) => ev(p, async () => { const S = await import('./js/store.js'); return S.projects().map((x) => x.name).sort(); });
  const login = async (p, email, pw, signup) => { await p.goto(B + '#/login' + (signup ? '?signup=1' : '')); await p.reload(); await p.waitForSelector('#f');
    if (signup) await p.fill('#f input[name=name]', 'Ann Lee'); await p.fill('#f input[name=email]', email); await p.fill('#f input[name=password]', pw); await p.click('#go');
    await p.waitForFunction(() => /#\/home/.test(location.hash) || /warn/.test(document.getElementById('authMsg')?.className || ''), null, { timeout: 15000 }).catch(() => {});
    if (!/#\/home/.test(await p.evaluate(() => location.hash))) return;
    await settled(p); };
  async function settled(p) { for (let i = 0; i < 80; i++) { const i2 = await ev(p, async () => { const C = await import('./js/cloud.js'); return C.info(); }); if (i2.phase !== 'syncing' && i2.last && !i2.busy) return i2; await p.waitForTimeout(250); } return null; }

  // ---- device A: sign up, make a project with a version and a result
  const A = await device('A');
  ok(await A.evaluate(() => document.body.innerText.includes('Log in')), 'signed out to start');
  await login(A, EMAIL, PW, true);
  const ia = await ev(A, async () => { const C = await import('./js/cloud.js'), S = await import('./js/store.js'); return { u: C.user(), acct: S.account().user, phase: C.info().phase }; });
  ok(ia.u?.email === EMAIL && ia.acct?.cloud && ia.acct.name === 'Ann Lee', `signed up and signed in (${ia.u?.email}, ${ia.acct?.name})`);
  ok(/Synced|Syncing/.test(await A.evaluate(() => { document.getElementById('whoBtn')?.click(); return document.getElementById('whoSync')?.textContent || ''; })), 'the account menu shows the sync');
  await ev(A, async () => { const S = await import('./js/store.js'); const p = S.createProject('Riverside housing', S.projects()[0].draft); p.draft.note = 'draft A'; S.saveVersion(p, 'First scheme'); S.addRun(p, p.versions[0].id, 'sunhours', { site: 'x' }, { kpis: [['Mean sun', '4.2 h']], mean: 4.2, thumb: 'data:image/jpeg;base64,AAAA', field: { label: 'Sun', unit: 'h', step: 1, pts: [0, 0, 4.2] } }); });
  let r = await sync(A); ok(r.info.phase === 'ok' && r.sent >= 1, `the new project is sent (${r.sent} sent)`);
  const uidA = psql(`select id from auth.users where email = '${EMAIL}'`);
  ok(psql(`select count(*) from cloud_projects where owner = '${uidA}'`) === '1' && psql(`select count(*) from cloud_versions where owner = '${uidA}'`) === '1', 'the database has its project row and its version (and not the sample project)');
  ok(psql(`select data->'runs'->0->'results'->>'mean' from cloud_projects where owner = '${uidA}'`) === '4.2' && psql(`select (data ? 'versions') from cloud_projects where owner = '${uidA}'`) === 'f', 'results travel with the project; version models live in their own table');
  ok(psql(`select count(*) from cloud_accounts where owner = '${uidA}'`) === '1', 'the Account site and defaults are kept too');

  // ---- device B: log in, the project arrives with its version and result
  const Bd = await device('B');
  await login(Bd, EMAIL, 'wrong password');
  ok(/Wrong email or password/.test(await Bd.textContent('#authMsg')), 'a wrong password is refused');
  await login(Bd, EMAIL, PW);
  const pb = await ev(Bd, async () => { const S = await import('./js/store.js'); const p = S.projects().find((x) => x.name === 'Riverside housing'); return p && { v: p.versions.length, note: p.versions[0].note, run: p.runs[0]?.results.mean, thumb: !!p.runs[0]?.results.thumb, draft: p.draft.note, sample: S.projects().some((x) => x.sample) }; });
  ok(pb && pb.v === 1 && pb.note === 'First scheme' && pb.run === 4.2 && pb.thumb && pb.draft === 'draft A', 'device B gets the project, its version, its result and picture, and its draft');
  ok(pb?.sample, 'device B keeps its own sample project (the sample is never sent)');
  // B changes it; A sees the change
  await ev(Bd, async () => { const S = await import('./js/store.js'); const p = S.projects().find((x) => x.name === 'Riverside housing'); S.renameProject(p, 'Riverside housing B'); p.draft.note = 'draft B'; S.saveVersion(p, 'Second scheme'); });
  await sync(Bd); r = await sync(A);
  const pa = await ev(A, async () => { const S = await import('./js/store.js'); const p = S.projects().find((x) => x.id && x.name.startsWith('Riverside')); return { name: p.name, v: p.versions.map((x) => x.note), draft: p.draft.note }; });
  ok(pa.name === 'Riverside housing B' && pa.v.join('|') === 'First scheme|Second scheme' && pa.draft === 'draft B', `device A gets B's change (${pa.name}: ${pa.v.join(', ')})`);
  ok(psql(`select count(*) from cloud_versions where owner = '${uidA}'`) === '2', 'the new version is added; the first is not sent again');

  // ---- both change the same project before syncing: both are kept
  await ev(A, async () => { const S = await import('./js/store.js'); S.renameProject(S.projects().find((x) => x.name === 'Riverside housing B'), 'Name from A'); });
  await ev(Bd, async () => { const S = await import('./js/store.js'); S.renameProject(S.projects().find((x) => x.name === 'Riverside housing B'), 'Name from B'); });
  await sync(A); r = await sync(Bd); await sync(A);
  const na = await names(A), nb = await names(Bd);
  ok(r.copies === 1 && nb.includes('Name from B') && nb.includes('Name from A (from another device)'), `a change made on both devices keeps both (${nb.filter((n) => !/sample/.test(n)).join(' · ')})`);
  ok(na.includes('Name from B') && na.includes('Name from A (from another device)'), 'and device A ends up with the same two');
  // ---- a project deleted on one device goes on the other
  await ev(A, async () => { const S = await import('./js/store.js'); S.deleteProject(S.projects().find((x) => /from another device/.test(x.name))); });
  await sync(A); r = await sync(Bd);
  ok(!(await names(Bd)).some((n) => /from another device/.test(n)) && r.removed === 1, 'deleting on A removes it on B');

  // ---- another person sees nothing of Ann's
  const Cd = await device('C'); await login(Cd, `cy.${stamp}@test.dev`, 'another pw 2', true);
  ok(!(await names(Cd)).some((n) => /Name from/.test(n)), 'another account does not see Ann’s projects (Row Level Security)');

  // ---- an expiring token is refreshed without asking
  const before = await ev(A, () => JSON.parse(localStorage.getItem('pc-cloud-session')).access_token);
  await ev(A, () => { const s = JSON.parse(localStorage.getItem('pc-cloud-session')); s.expires_at = Math.floor(Date.now() / 1000) + 20; localStorage.setItem('pc-cloud-session', JSON.stringify(s)); });
  await A.reload(); await A.waitForTimeout(800); r = await sync(A); const after = await ev(A, () => JSON.parse(localStorage.getItem('pc-cloud-session')).access_token);
  ok(r.info.phase === 'ok' && after !== before, 'a token about to expire is refreshed and the sync goes on');

  // ---- a sign-in link from an email
  const D = await device('D'); await D.goto(B + '#/login'); await D.fill('#f input[name=email]', EMAIL); await D.click('#link');
  await D.waitForFunction(() => /Sent/.test(document.getElementById('authMsg').textContent), null, { timeout: 8000 });
  const link = await (await fetch(API + '/__test/last-link')).json(); ok(/#access_token=/.test(link.link || ''), 'a sign-in link is sent (the local stand-in keeps it instead of emailing it)');
  await D.goto(link.link); await D.waitForTimeout(2500);
  const id = await ev(D, async () => { const C = await import('./js/cloud.js'), S = await import('./js/store.js'); await C.sync(); return { u: C.user()?.email, hash: location.hash, p: S.projects().map((x) => x.name) }; });
  ok(id.u === EMAIL && id.hash === '#/home' && id.p.includes('Name from B'), `opening the link signs in and brings the projects (${id.hash})`);

  // the same from a fresh tab (as when the link is clicked in an email app)
  { const F = await device('F'); await (await fetch(API + '/auth/v1/otp', { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, redirect_to: B }) })).text();
    const l2 = (await (await fetch(API + '/__test/last-link')).json()).link; const ctx = await b.newContext(), P = await ctx.newPage(); P.on('pageerror', (e) => errs.push('F2: ' + e.message));
    await P.goto(B); await P.evaluate(([url, key]) => localStorage.setItem('pc-cloud-config', JSON.stringify({ url, key })), [API, KEY]); await P.goto('about:blank'); await P.goto(l2); await P.waitForTimeout(800); await settled(P);
    const f = await ev(P, async () => { const C = await import('./js/cloud.js'), S = await import('./js/store.js'); return { u: C.user()?.email, hash: location.hash, p: S.projects().map((x) => x.name), acct: S.account().user?.email }; });
    ok(f.u === EMAIL && f.acct === EMAIL && f.hash === '#/home' && f.p.includes('Name from B'), 'a sign-in link opened in a new tab signs in and brings the projects'); await F.context().close(); await ctx.close(); }
  // ---- log out: the projects stay in this browser, the sync stops
  await A.goto(B + '#/account?tab=data'); await A.waitForSelector('#cloudSt'); ok(/synced/i.test(await A.textContent('#cloudSt')), 'Backup & data shows the cloud copy: ' + (await A.textContent('#cloudSt')).slice(0, 90));
  await A.click('#logout'); await A.waitForTimeout(800);
  const out = await ev(A, async () => { const C = await import('./js/cloud.js'), S = await import('./js/store.js'); return { u: C.user(), acct: S.account().user, p: S.projects().length, s: localStorage.getItem('pc-cloud-session') }; });
  ok(!out.u && !out.acct && !out.s && out.p >= 2, `logging out ends the session and keeps the ${out.p} projects in this browser`);

  // ---- a site without a backend configured keeps the browser-only account, and says so
  const E = await device('E', { config: false }); await E.goto(B + '#/login'); await E.waitForSelector('#f');
  ok(/not switched on/.test(await E.textContent('#f')) && !(await E.$('#link')), 'without a backend the page says cloud accounts are not switched on (browser-only account as before)');
  if (errs.length) { console.log('page errors:', errs); process.exitCode = 1; }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
