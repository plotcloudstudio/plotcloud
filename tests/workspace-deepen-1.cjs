// Deepened studies, batch 1 (2026-11-23), in the Workspace on the hospital example with its project weather:
// Sun hours reports the month's WMO sunshine share and the expected hours; Shade benefit runs with the UTCI criterion and says so;
// Daylight runs with LM-83 blinds and reports sDA with and without them (with ≤ without), the hours shut, and the blinds in its method.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }), p = await b.newPage({ viewport: { width: 1440, height: 900 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  try {
    await p.goto(base + '/mvp/');
    await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'plan' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    const id = await p.evaluate(async () => (await import('./js/hospital-example.js')).openHospital().id); await p.goto(base + '/mvp/#/workspace/' + id);
    await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    const idle = () => p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 600000 });
    const run = async () => { await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await idle(); await p.waitForTimeout(400); const e = await p.evaluate(() => window.__wsStudy.state().err); assert(!e, 'study error: ' + e); };
    const rows = () => p.evaluate(() => Object.fromEntries(window.__wsStudy.state().res.rows.map(([k, v]) => [k, String(v).replace(/<[^>]+>/g, '')])));
    const method = () => p.evaluate(() => String(window.__wsStudy.state().res.method || '').replace(/<[^>]+>/g, ''));
    const open = async (sid) => { await p.evaluate((s) => window.__wsStudy.open(s), sid); await p.waitForSelector('.sp-studycard [data-st=run]'); await p.waitForTimeout(500); };

    await open('sunhours'); await run(); let R = await rows(); const sk = Object.keys(R).find((k) => /^Sunshine in /.test(k));
    assert(sk, 'a sunshine row: ' + JSON.stringify(R)); assert.match(R[sk], /% of daylight hours \([\d,]+ of [\d,]+ with direct sun ≥ 120 W\/m², WMO\)/);
    const share = +R[sk].match(/^(\d+)%/)[1], avg = parseFloat(R['Average on the ground']), exp = parseFloat(R['Expected sun on the ground']);
    assert(share > 5 && share < 95, 'a plausible share: ' + share); assert(Math.abs(exp - avg * share / 100) <= 0.15, `expected ≈ average × share: ${exp} vs ${avg} × ${share}%`); assert.match(await method(), /WMO/);
    console.log(`PASS Sun hours: ${sk} ${R[sk]}; expected ${exp} h of ${avg} h`);

    await open('shadebenefit'); await p.click('[data-st-mode=utci]'); await p.waitForTimeout(300); await run(); R = await rows(); const m1 = await method();
    assert.match(m1, /UTCI in the sun at or above 26 °C/); assert.match(m1, /below 9 °C/); assert(Number.isFinite(parseFloat(R['Mean net benefit'])), JSON.stringify(R));
    const st = await p.evaluate(() => window.__wsStudy.state().res.settings); assert.equal(st.criterion, 'UTCI in the sun');
    const utciNet = parseFloat(R['Mean net benefit']); await p.click('[data-st-mode=air]'); await p.waitForTimeout(300); await run(); const airNet = parseFloat((await rows())['Mean net benefit']); assert.match(await method(), /air temperature above 26 °C/);
    console.log(`PASS Shade benefit: UTCI criterion net ${utciNet} K·h, air criterion ${airNet} K·h`);

    await open('daylight'); assert(await p.$('select[data-dl=dlBlind]'), 'the blinds choice is on the card'); await run(); R = await rows();
    const pc = (s) => parseFloat(s); assert.match(R['sDA300/50%'], /with blinds operated/); const with_ = pc(R['sDA300/50%']), without = pc(R['sDA without blinds (high end)']);
    assert(with_ <= without, `with blinds ${with_} ≤ without ${without}`); assert.match(R['Hours with blinds closed'], /of [\d,]+ occupied daylit hours/); assert.match(await method(), /more than 2% of the spots/);
    await p.evaluate(() => { const e = document.querySelector('select[data-dl=dlBlind]'); e.value = '0'; e.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(300); await run(); R = await rows(); assert.match(R['sDA300/50%'], /\(no blinds\)/); assert(Math.abs(pc(R['sDA300/50%']) - without) < 0.6, 'no blinds gives the open value');
    console.log(`PASS Daylight: sDA ${with_}% with LM-83 blinds, ${without}% without; ${R['sDA300/50%']} with none`);
    assert.deepEqual(errs, [], 'no page errors');
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
