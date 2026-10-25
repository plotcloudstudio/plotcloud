// The user's side (2026-10-25): Dashboard after login, the avatar menu, project management, needs-attention items,
// recent places, backup and restore, tabbed Account settings, log out.
// Run with a static server on 8765 (python3 -m http.server 8765 --bind 127.0.0.1); TEST_BASE overrides it.
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const B = (process.env.TEST_BASE || 'http://127.0.0.1:8765') + '/mvp/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? (globalThis.__answer ?? d.defaultValue()) : undefined));
  const db = () => p.evaluate(() => JSON.parse(localStorage.getItem('pc-mvp-v1')));
  await p.goto(B); await p.evaluate(() => localStorage.clear()); await p.goto(B + '#/'); await p.waitForTimeout(600);
  await p.goto(B + '#/home'); await p.waitForTimeout(600); ok(/#\/login\?next=home/.test(p.url()), 'signed out, the Dashboard sends you to log in');
  await p.fill('input[name=email]', 'jun@studio.com'); await p.fill('input[name=password]', 'secret1'); await p.click('#f button.accent'); await p.waitForTimeout(1200);
  ok(/#\/home$/.test(p.url()), 'logging in lands on the Dashboard');
  ok(await p.evaluate(() => /Jun\./.test(document.querySelector('.db-hi h1').textContent)), 'it greets you by name');
  ok(await p.evaluate(() => document.querySelector('#nav [data-nav="home"]')?.getAttribute('aria-current') === 'page'), 'Dashboard is in the main menu, current');
  ok(await p.evaluate(() => document.querySelectorAll('#go .db-gocard').length === 3), 'three ways to pick up where you left off');
  ok(await p.evaluate(() => /default site is still the sample/.test(document.getElementById('attn').textContent)), 'needs attention: the sample site');
  await p.click('#whoBtn'); ok(await p.evaluate(() => !document.getElementById('whoMenu').hidden && /Account settings/.test(document.getElementById('whoMenu').textContent)), 'the avatar opens a menu with Account settings and Log out');
  await p.mouse.click(700, 600); ok(await p.evaluate(() => document.getElementById('whoMenu').hidden), '…and closes on a click outside');
  // new projects
  globalThis.__answer = 'Library test'; await p.click('#newBtn'); await p.click('[data-new="blank"]'); await p.waitForTimeout(1500);
  ok(/#\/workspace\//.test(p.url()) && (await db()).projects[0].name === 'Library test', 'New project › Blank makes it and opens the Workspace');
  await p.goto(B + '#/home'); await p.waitForTimeout(600);
  globalThis.__answer = 'Sample copy'; await p.click('#newBtn'); await p.click('[data-new="sample"]'); await p.waitForTimeout(1500);
  const sc = (await db()).projects.find((x) => x.name === 'Sample copy'); ok(sc && sc.versions.length === 2, 'New project › From the sample comes with two versions');
  await p.goto(B + '#/home'); await p.waitForFunction(() => document.querySelectorAll('#plist .db-p').length >= 3, null, { timeout: 15000 }).catch(() => {});
  const nCards = await p.evaluate(() => [...document.querySelectorAll('#plist .db-p h3')].map((h) => h.textContent)); ok(nCards.length === 3, 'three project cards: ' + nCards.join(', '));
  await p.fill('#q', 'library'); await p.waitForTimeout(200); ok(await p.evaluate(() => document.querySelectorAll('#plist .db-p').length) === 1, 'search narrows the cards'); await p.fill('#q', '');
  const card = async (name) => p.evaluate((n) => [...document.querySelectorAll('#plist .db-p')].find((c) => c.querySelector('h3').textContent === n)?.dataset.id, name);
  let id = await card('Library test'); globalThis.__answer = 'Library renamed'; await p.click(`[data-more="${id}"]`); await p.click('.db-pmenu [data-a="rename"]'); await p.waitForTimeout(300);
  ok((await db()).projects.some((x) => x.name === 'Library renamed'), '⋯ › Rename');
  id = await card('Library renamed'); await p.click(`[data-more="${id}"]`); await p.click('.db-pmenu [data-a="dup"]'); await p.waitForTimeout(300);
  ok((await db()).projects.some((x) => x.name === 'Library renamed copy'), '⋯ › Duplicate');
  id = await card('Library renamed copy'); await p.click(`[data-more="${id}"]`); await p.click('.db-pmenu [data-a="arch"]'); await p.waitForTimeout(300);
  ok(!(await card('Library renamed copy')) && /Show archived \(1\)/.test(await p.textContent('#arch')), '⋯ › Archive moves it under Show archived');
  await p.click('#arch'); ok(!!(await card('Library renamed copy')), '…where it is listed');
  id = await card('Library renamed copy'); globalThis.__answer = 'DELETE'; await p.click(`[data-more="${id}"]`); await p.click('.db-pmenu [data-a="del"]'); await p.waitForTimeout(300);
  ok(!(await db()).projects.some((x) => x.name === 'Library renamed copy'), '⋯ › Delete (typed DELETE)');
  await p.click('#arch');
  // needs attention: unsaved changes and versions without results
  await p.evaluate(async () => { const S = await import('./js/store.js'); const pr = S.projects().find((x) => x.name === 'Sample copy'); pr.draft.components.push({ id: 'cx', name: 'Extra', type: 'furniture', layer: 'Furniture', g: { x: 1, y: 1, z: 0, w: 1, d: 1, h: 1 } }); pr.runs.push({ id: 'r1', versionId: pr.versions[0].id, simId: 'daylight', settings: {}, results: { kpis: [['sDA', '50 %']] }, created: new Date().toISOString(), source: 'full-tool' }); S.save(); });
  await p.goto(B + '#/'); await p.goto(B + '#/home'); await p.waitForTimeout(600);
  const at = await p.textContent('#attn'); ok(/Sample copy: changes since v2 are not saved/.test(at), 'needs attention: unsaved changes');
  ok(/Sample copy: v2 has no results yet for 1 simulation/.test(at), 'needs attention: the latest version has no result where an earlier one did');
  ok(/Daylight on Sample copy v1/.test(await p.textContent('#feed')), 'recent activity lists the run');
  ok(/Daylight/.test(await p.textContent('#most')), 'simulations you use most');
  // recent place: open a simulation, the Dashboard offers to continue it
  await p.goto(B + '#/simulations/wayfinding'); await p.waitForTimeout(1500); await p.goto(B + '#/home'); await p.waitForTimeout(600);
  ok(/Continue simulating\s*Wayfinding/.test(await p.textContent('#go')), 'Continue simulating goes back to the last simulation');
  // Account settings: tabs, backup, restore
  await p.goto(B + '#/account'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => !document.querySelector('[data-pane="site"]').hidden && document.querySelector('[data-pane="profile"]').hidden), 'Account opens on Site & defaults, one tab at a time');
  await p.click('[data-tab="data"]'); ok(/tab=data/.test(p.url()) && await p.evaluate(() => !document.getElementById('data').hidden), 'the Backup & data tab, with the address following');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exp')]); const file = await dl.path(); const txt = require('fs').readFileSync(file, 'utf8');
  ok(/plotcloud-backup/.test(txt) && JSON.parse(txt).projects.length === 3, `Download backup (${dl.suggestedFilename()}) holds the projects`);
  await p.evaluate(async () => { const S = await import('./js/store.js'); S.deleteProject(S.projects().find((x) => x.name === 'Sample copy')); });
  await p.setInputFiles('#impFile', file); await p.waitForTimeout(500);
  ok((await db()).projects.some((x) => x.name === 'Sample copy') && /Restored 3 projects/.test(await p.textContent('#impMsg')), 'Restore brings a deleted project back');
  await p.click('[data-tab="profile"]'); await p.fill('#prof input[name=name]', 'Jun Chen'); await p.click('#prof button'); await p.waitForTimeout(300);
  ok((await db()).account.user.name === 'Jun Chen' && /Jun/.test(await p.textContent('#who')), 'Profile: the name is saved and shown in the header');
  await p.click('[data-tab="notify"]'); await p.click('[data-n="stale"]'); await p.waitForTimeout(200); ok((await db()).account.notify.stale === false, 'Notifications: a switch is kept');
  await p.goto(B + '#/home'); await p.waitForTimeout(600); ok(!/has no results yet/.test(await p.textContent('#attn')), '…and rerun reminders leave the Dashboard');
  await p.click('#whoBtn'); await p.click('#whoOut'); await p.waitForTimeout(600);
  ok(!(await db()).account.user && /Log in/.test(await p.textContent('#who')) && !(await p.$('#nav [data-nav="home"]')), 'Log out from the avatar menu');
  if (errs.length) { console.log('page errors:', errs); process.exitCode = 1; }
  await b.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
