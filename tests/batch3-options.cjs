// Batch 3 options in the Workspace (2026-11-24). Snow on the Fallingwater case: the default hours (below 0 °C with wind) as before,
// then "Snowfall in the weather file": the drifting wind from the hours it snows (EPW precipitation / snow depth), or, for a file
// without them, the fallback said plainly; the result names the hours used. Wayfinding on the hospital: "15 m" as before, then
// "From letter height (ADA 703.5.5)" at 75 mm: the method names ADA and the distances, and no more points are guided than at 15 m.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 960 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const plain = (h) => String(h ?? '').replace(/<[^>]+>/g, '');
    const idle = () => p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 400000 });
    const run = async () => { await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await idle(); await p.waitForTimeout(500); return p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, rows: s.res?.rows || [], method: s.res?.method || '', settings: s.res?.settings || null }; }); };
    const row = (r, k) => plain((r.rows.find(([a]) => plain(a) === k) || [])[1]);
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    // ---- snow, Fallingwater
    const fw = await p.evaluate(async () => { localStorage.clear(); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); const m = await import('./js/fallingwater-dashboard.js'); return m.openCase().id; });
    await p.goto(base + '/mvp/#/workspace/' + fw); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 300000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    await p.evaluate(() => window.__wsStudy.open('snow')); await p.waitForSelector('.sp-studycard'); await p.waitForTimeout(800);
    let r = await run(); assert(!r.err, 'snow default: ' + r.err); const h0 = row(r, 'Hours used'); assert.match(h0, /hours below 0 °C with wind/, 'default hours: ' + h0); assert.equal(r.settings.hours, 'cold');
    const d0 = row(r, 'Drifting wind'); console.log(`PASS snow, default: ${h0}; drifting wind ${d0}`);
    await p.evaluate(() => document.querySelector('.sp-studycard [data-st-set="snHours:fall"]').click()); await p.waitForTimeout(500);
    assert.match(await p.evaluate(() => document.querySelector('.sp-studycard').textContent), /precipitation, or with the snow depth rising/, 'the card explains the option');
    r = await run();
    if (r.err) { assert.match(r.err, /records only \d+ hours of snowfall/, 'snowfall: ' + r.err); console.log('PASS snow, snowfall hours: too few in this weather file, said plainly: ' + r.err); }
    else { const h1 = row(r, 'Hours used'); assert.match(h1, /hours of snowfall \(EPW precipitation and snow depth\)|no snowfall data in the file/, 'snowfall hours: ' + h1); assert(['fall', 'cold-nodata'].includes(r.settings.hours), JSON.stringify(r.settings));
      assert.match(r.method, /hours of snowfall in the weather file|records no precipitation or snow depth/); console.log(`PASS snow, snowfall hours: ${h1}; drifting wind ${row(r, 'Drifting wind')}`); }
    // ---- wayfinding, hospital
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    const hid = await p.evaluate(async () => (await import('./js/hospital-example.js')).openHospital().id); await p.goto(base + '/mvp/#/workspace/' + hid);
    await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    await p.evaluate(() => window.__wsStudy.open('wayfinding')); await p.waitForSelector('.sp-studycard'); await p.waitForTimeout(800);
    // one proposed sign at every candidate point on a route, evaluated with this run's reading distance
    const guided = () => p.evaluate(async () => { const W = await import('./js/interior/wayfinding-signage.js'), A = window.__wsStudy.state().res.wayA; const signs = A.nodes.filter((n) => n.onRoute && !n.f.E).map((n) => W.signAt(A, n)); const ev = W.evaluate(A, signs); return { guided: ev.guided, events: ev.events, vis: A.F.visFor ? 'ada' : '15' }; });
    r = await run(); assert(!r.err, 'wayfinding default: ' + r.err); assert.match(r.method, /read from up to 15 m/); const g15 = await guided();
    await p.evaluate(() => { const el = document.querySelector('.sp-studycard [data-way-read=mode]'); el.value = 'ada'; el.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(500);
    const note = await p.evaluate(() => document.querySelector('.sp-studycard').textContent); assert.match(note, /meets the table to 7\.5 m, a hung sign .* to 6\.9 m/, 'the card gives the distances');
    r = await run(); assert(!r.err, 'wayfinding ADA: ' + r.err); assert.match(r.method, /ADA 2010 Table 703\.5\.5/); assert.deepEqual(r.settings.signRead, { mode: 'ada', charMm: 75 });
    const gA = await guided(); assert.equal(g15.vis, '15'); assert.equal(gA.vis, 'ada'); assert(gA.guided <= g15.guided && g15.events > 0, `no more guided at about 7 m than at 15 m: ${JSON.stringify([g15, gA])}`);
    console.log(`PASS wayfinding, a sign at every candidate point: 15 m guides ${g15.guided} of ${g15.events} decisions; ADA 75 mm letters (wall 7.5 m, hung 6.9 m) guide ${gA.guided} of ${gA.events}`);
    // small letters: 25 mm meets the table only to 2.7 m on a wall, and not at all on a hung sign (the 51 mm minimum of its tier)
    await p.evaluate(() => { const el = document.querySelector('.sp-studycard [data-way-read=charMm]'); el.value = '25'; el.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(500);
    r = await run(); assert(!r.err, 'wayfinding ADA 25 mm: ' + r.err); assert.deepEqual(r.settings.signRead, { mode: 'ada', charMm: 25 }); const g25 = await guided();
    assert(g25.guided < gA.guided, `25 mm letters guide fewer decisions: ${g25.guided} vs ${gA.guided}`);
    console.log(`PASS wayfinding, 25 mm letters (wall 2.7 m, hung signs below the table): ${g25.guided} of ${g25.events} decisions guided`);
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
