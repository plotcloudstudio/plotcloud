// The parking layout as it opens (2026-11-28), hospital example at 1600×960: the same 56 × 23 m area south of the building and an
// entrance on its west edge, with the defaults: North American sizes (Toronto Zoning By-law 569-2013), islands at the row ends,
// a turnaround at a dead end, the ADA count; the result rows say so; the plan draws numbered stalls, islands, the turnaround and the
// aisle; the stall schedule CSV has one line per stall counted; the DXF has the new layers; no page errors.
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 960 }, acceptDownloads: true }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], out = process.env.SHOT_DIR || '/tmp';
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'plan' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    const id = await p.evaluate(async () => (await import('./js/hospital-example.js')).openHospital().id); await p.goto(base + '/mvp/#/workspace/' + id);
    await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    const pick = (q) => p.evaluate((q) => __ws2.inst.plan.ws._pick(q), q);
    const rows = () => p.evaluate(() => Object.fromEntries(window.__wsStudy.state().res.rows.map(([k, v]) => [k, String(v).replace(/<[^>]+>/g, '')])));
    await p.evaluate(() => window.__wsStudy.open('parking-layout')); await p.waitForSelector('.sp-studycard [data-pk=drawarea]'); await p.waitForTimeout(600);
    const card = await p.locator('.sp-studycard').innerText(); assert.match(card, /569-2013/, 'the preset and its source on the card');
    assert.equal(await p.inputValue('.sp-studycard [data-pk=std]'), 'na'); for (const k of ['islends', 'dead', 'ada']) assert.equal(await p.isChecked(`.sp-studycard [data-pk=${k}]`), true, k + ' on by default');
    await p.click('.sp-studycard [data-pk=drawarea]'); for (const q of [[-28, -40], [28, -40], [28, -17], [-28, -17]]) { assert(await pick(q)); await p.waitForTimeout(100); } await p.click('.sp-studycard [data-sa=finish]'); await p.waitForTimeout(300);
    await p.click('.sp-studycard [data-pk=addent]'); assert(await pick([-28, -28])); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 }); await p.waitForTimeout(600);
    assert(!(await p.evaluate(() => window.__wsStudy.state().err)), 'ran'); const R = await rows();
    assert.match(R['Sizes from'], /Toronto/); assert.match(R['Islands'], /\d+ at row ends/); assert.match(R['Dead ends'], /turnaround|none/); assert.match(R['Accessible (ADA 208.2)'], /placed .* asked/); assert(!/short/.test(R['Accessible (ADA 208.2)']), 'ADA met: ' + R['Accessible (ADA 208.2)']);
    const o = await p.evaluate(() => { const L = window.__wsStudy.state().pkLast; return { total: L.total, nos: L.stalls.filter((s) => s.valid).map((s) => s.no), islands: (L.islands || []).length }; });
    assert(o.nos.every(Boolean) && new Set(o.nos).size === o.total && o.islands >= 2, 'numbered stalls and islands ' + JSON.stringify({ total: o.total, islands: o.islands }));
    await p.screenshot({ path: out + '/parking-defaults.png' });
    console.log(`PASS defaults: ${R['Stalls']}; sizes from ${R['Sizes from']}; islands ${R['Islands']}; dead ends: ${R['Dead ends']}; ADA ${R['Accessible (ADA 208.2)']}; stalls numbered ${o.nos[0]}…`);
    // the schedule and the DXF
    const [csv] = await Promise.all([p.waitForEvent('download'), p.click('.sp-studycard [data-sa-exp=csv]')]); const f = out + '/' + csv.suggestedFilename(); await csv.saveAs(f); const lines = fs.readFileSync(f, 'utf8').trim().split('\n');
    assert.match(lines[0], /"stall","type"/); assert.equal(lines.length - 1, o.total, 'one line per stall');
    const [dx] = await Promise.all([p.waitForEvent('download'), p.click('.sp-studycard [data-sa-exp=dxf]')]); const fd = out + '/' + dx.suggestedFilename(); await dx.saveAs(fd); const dxf = fs.readFileSync(fd, 'utf8');
    for (const L of ['ISLANDS', 'STALL_NUMBERS', 'AISLES']) assert(dxf.includes(L), 'DXF layer ' + L);
    console.log(`PASS the stall schedule CSV: ${lines.length - 1} stalls; the DXF has ISLANDS, STALL_NUMBERS and AISLES`);
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
