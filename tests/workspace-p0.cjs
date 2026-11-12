// P0, credibility and decluttering (2026-11-12), on the hospital example:
// · Add simulation lists no Coming-soon study and no Movement & spatial depth (a view of Space syntax: old links land there)
// · Circulation is called Everyday circulation; every result card carries its method maturity
// · Everyone out moves the inpatients with the staff on duty, after an assumed clinical preparation: far longer than if everyone walked
const { chromium } = require('playwright'), assert = require('node:assert/strict'), os = require('node:os');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || os.tmpdir();
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    await p.goto(base + '/mvp/#/home'); await p.waitForSelector('[data-hospital]'); await p.click('.ph-thumb[data-hospital]');
    await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(2500);
    // the menu
    await p.click('#addSimBtn'); await p.waitForTimeout(300); const menu = await p.$$eval('.w2-simmenu:not([hidden]) [data-addsim]', (bs) => bs.map((x) => [x.dataset.addsim, x.textContent.trim()])); await p.keyboard.press('Escape'); await p.mouse.click(800, 880); await p.waitForTimeout(300);
    assert(!menu.some(([, t]) => /Coming soon/i.test(t)), 'no Coming soon: ' + JSON.stringify(menu)); assert(!menu.some(([i]) => i === 'movementdepth'), 'no Movement & spatial depth');
    assert(menu.some(([i, t]) => i === 'evac' && /Everyday circulation/.test(t)), 'Everyday circulation'); assert(menu.some(([i]) => i === 'spacesyntax')); console.log('PASS the menu:', menu.length, 'studies');
    // an old link to Movement & spatial depth
    await p.evaluate(() => window.__wsStudy.open('movementdepth')); await p.waitForTimeout(1200); const ss = await p.evaluate(() => ({ id: window.__wsStudy.state().id, card: document.querySelector('.sp-studycard')?.innerText || '' }));
    assert.equal(ss.id, 'spacesyntax'); console.log('PASS Movement & spatial depth opens Space syntax');
    await p.click('.sp-studycard [data-st=close]').catch(() => {}); await p.waitForTimeout(300);
    // Everyone out with the inpatients
    await p.evaluate(() => window.__wsStudy.open('fire-evacuation')); await p.waitForTimeout(1500); await p.click('.sp-studycard [data-st-mode=all]'); await p.waitForTimeout(600);
    let card = await p.locator('.sp-studycard').innerText(); assert.match(card, /Inpatients[\s\S]*moved by the staff on duty[\s\S]*Staff on duty[\s\S]*Clinical preparation before a patient is moved \(assumption\)/);
    const tbl = await p.$$eval('.sp-studycard .sp-egpop2 tr.pat', (rs) => rs.map((r) => r.innerText.replace(/\s+/g, ' '))); assert(tbl.length === 2 && /Inpatients 0 26 26/.test(tbl[0]) && /Staff 0 7 7/.test(tbl[1]), 'inpatients per floor in the table: ' + tbl);
    await p.selectOption('.sp-studycard [data-eg=runs]', '10');
    const run = async () => { await p.click('.sp-studycard [data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 900000 }); return p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, results: s.res?.results, rows: (s.res?.rows || []).map(([k, v]) => [k.replace(/<[^>]+>/g, ''), String(v).replace(/<[^>]+>/g, '')]) }; }); };
    const r = await run(); assert.equal(r.err, ''); const row = (k) => r.rows.find((x) => x[0].startsWith(k));
    assert.match(row('Inpatients (moved by staff)')[1], /52: \d+ walk, \d+ need help, \d+ in bed[\s\S]*staff \(1 to 4\)/); assert(row('Waiting for staff') && row('Clinical preparation (assumption)'));
    assert(!r.rows.some((x) => /Patient rooms in the model/.test(x[0])), 'no warning any more'); assert.equal(r.results.notFinished, 0);
    assert.match(await p.locator('.sp-studyres header .sp-mat').innerText(), /Verified, not validated/, 'the maturity chip');
    const st = await p.frames().find((f) => f.url().includes('ws=persp')).evaluate(() => window.__ws.egressState()); await p.screenshot({ path: `${out}/p0-everyone-out.png` });
    console.log('PASS Everyone out with inpatients:', r.rows.slice(0, 2).map((x) => x.join(': ')).join(' | '), '|', row('Inpatients out')[1], '|', row('Waiting for staff')[1]);
    // the maturity chip on another study
    await p.click('.sp-studycard [data-st=close]').catch(() => {}); await p.waitForTimeout(300); await p.evaluate(() => window.__wsStudy.open('sunhours')); await p.waitForTimeout(1500); const r2 = await run(); assert.equal(r2.err, '');
    assert.match(await p.locator('.sp-studyres header .sp-mat').innerText(), /Matches Ladybug/); console.log('PASS maturity: sun hours', 'Matches Ladybug');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
