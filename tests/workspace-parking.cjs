// Parking layout in the Workspace (2026-11-18), on the hospital example: an area drawn by clicks south of the building (56 × 23 m,
// between it and the site's car park) and an entrance on its west edge; Start: stalls and aisles drawn, the rows; the Options goal: two
// or more options, another chosen updates the rows; a stall picked and changed to EV, another locked and kept when the rest is generated
// again; underground: the columns of the Structure grid and no stall on one; "Check with a vehicle" opens the swept path with the stalls
// as obstacles and the result comes back to the parking card; the DXF has the stall layers; no page errors.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 960 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], shots = process.env.SHOT_DIR || require('os').tmpdir();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'plan' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    const id = await p.evaluate(async () => (await import('./js/hospital-example.js')).openHospital().id); await p.goto(base + '/mvp/#/workspace/' + id);
    await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    const idle = () => p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 });
    const run = async () => { await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await idle(); await p.waitForTimeout(400); const e = await p.evaluate(() => window.__wsStudy.state().err); assert(!e, 'study error: ' + e); };
    const pick = (pt) => p.evaluate((q) => __ws2.inst.plan.ws._pick(q), pt);
    const unfold = () => p.evaluate(() => { const d = document.querySelector('.sp-studycard details[data-adv="__set"]'); if (d && !d.open) d.querySelector('summary').click(); });
    const rows = () => p.evaluate(() => Object.fromEntries(window.__wsStudy.state().res.rows.map(([k, v]) => [k, String(v).replace(/<[^>]+>/g, '')])));
    const marks = () => p.evaluate(() => __ws2.inst.plan.ws._walkMarks());
    const stalls = () => p.evaluate(() => window.__wsStudy.state().pkLast.stalls.filter((s) => s.valid).map((s) => ({ id: s.id, cat: s.cat, c: s.footprint.reduce((a, q) => [a[0] + q[0] / s.footprint.length, a[1] + q[1] / s.footprint.length], [0, 0]), locked: !!s.locked })));
    await p.evaluate(() => window.__wsStudy.open('parking-layout')); await p.waitForSelector('.sp-studycard [data-pk=drawarea]'); await p.waitForTimeout(600);
    // 1. the area and an entrance, by clicks
    await p.click('.sp-studycard [data-pk=drawarea]'); for (const q of [[-28, -40], [28, -40], [28, -17], [-28, -17]]) { assert(await pick(q)); await p.waitForTimeout(100); } await p.click('.sp-studycard [data-sa=finish]'); await p.waitForTimeout(300);
    assert.match(await p.locator('.sp-studycard').innerText(), /Drawn: 1,288 m²/);
    await p.click('.sp-studycard [data-pk=addent]'); assert(await pick([-28, -28])); await p.waitForTimeout(300); assert.match(await p.locator('.sp-studycard').innerText(), /1 set \(green E on the plan\)/);
    await run(); let R = await rows(); const m1 = await marks(); assert(m1.tags.includes('stall') && m1.tags.includes('aisle'), [...new Set(m1.tags)].join());
    const n1 = +R['Stalls'].match(/^(\d+)/)[1]; assert(n1 >= 42 && n1 <= 44, R['Stalls']);   // by hand: one module (5 + 6 + 5 m) in the 23 m depth, two rows of about 22 along 56 m, two of them wider accessible stalls assert.equal(R['Invalid stalls'], 'none'); assert.match(R['Not reached'], /every aisle reached/); assert.match(R['· Accessible'], /^2 /);
    await p.screenshot({ path: `${shots}/parking-1.png` });
    console.log(`PASS surface, 1,288 m²: ${R['Stalls']}; ${R['· Standard']} standard, ${R['· Accessible']} accessible; stall area ${R['Stall area']}; ${R['Area per stall']} per stall`);
    // 2. options: another one chosen updates the rows
    await unfold(); await p.click('.sp-studycard [data-pk-mode=D]'); await run(); const opts = await p.locator('.sp-studycard [data-pk-opt]').count(); assert(opts >= 2, 'options: ' + opts);
    await p.click('.sp-studycard [data-pk-opt=B]'); await p.waitForTimeout(400); R = await rows(); assert.match(R['Stalls'], /in option B/); console.log(`PASS ${opts} options; option B: ${R['Stalls']}`);
    await p.click('.sp-studycard [data-pk-opt=A]'); await p.waitForTimeout(300);
    // 3. a stall picked and made EV; another locked, then the rest generated again
    let S1 = await stalls(); const t1 = S1.find((s) => s.cat === 'standard'); await p.click('.sp-studycard [data-pk=pickstall]'); assert(await pick(t1.c)); await p.waitForTimeout(300);
    await p.selectOption('.sp-studycard [data-pk=selcat]', 'ev'); await p.waitForTimeout(400); R = await rows(); assert.match(R['· EV charging'] || '', /^1 /, JSON.stringify(R));
    const t2 = (await stalls()).find((s) => s.cat === 'standard' && s.id !== t1.id); await p.click('.sp-studycard [data-pk=pickstall]'); assert(await pick(t2.c)); await p.waitForTimeout(300); await p.click('.sp-studycard [data-pk=lock]'); await p.waitForTimeout(300);
    await p.click('.sp-studycard [data-pk=regen]'); await idle(); await p.waitForTimeout(400); const S3 = await stalls(); const L = S3.find((s) => s.locked); assert(L && Math.hypot(L.c[0] - t2.c[0], L.c[1] - t2.c[1]) < 0.01, 'the locked stall kept in place');
    console.log(`PASS a stall changed to EV (rows updated); another locked and kept where it was when the rest was generated again (${S3.length} stalls)`);
    // 4. the DXF has the stall layers
    const dx = await p.evaluate(async () => { const C = await import('./js/cad-export.js'); return C.readDxf(C.dxf(window.__wsStudy.state().res.saLayers())); }); assert(dx.STALLS_STANDARD && dx.STALLS_STANDARD.polylines > 40 && dx.AISLES.polylines >= 1 && dx.PARKING_AREA && dx.STALLS_ACCESSIBLE && dx.ACCESS_AISLES, JSON.stringify(dx));
    console.log(`PASS the DXF: ${Object.entries(dx).map(([k, v]) => `${k} ${v.polylines}`).join(', ')}`);
    // 5. check with a vehicle: the swept path opens with the stalls as obstacles; a truck along the aisle; back in parking, the result is listed
    await p.click('.sp-studycard [data-pk=checkveh]'); await p.waitForSelector('.sp-studycard [data-va=draw]'); await p.waitForTimeout(400);
    assert.match(await p.locator('.sp-studycard').innerText(), /Parked cars in the parking layout \(option A, \d+ stalls\)/);
    const aisle = await p.evaluate(() => { const a = window.__wsStudy.state().pkLast.aisles.find((x) => x.kind === 'aisle'), P = a.poly, c = P.reduce((s, q) => [s[0] + q[0] / 4, s[1] + q[1] / 4], [0, 0]); return { c, u: [P[1][0] - P[0][0], P[1][1] - P[0][1]] }; });
    const L2 = Math.hypot(...aisle.u), u = [aisle.u[0] / L2, aisle.u[1] / L2], a0 = [aisle.c[0] - u[0] * (L2 / 2 - 4), aisle.c[1] - u[1] * (L2 / 2 - 4)], a1 = [aisle.c[0] + u[0] * (L2 / 2 - 4), aisle.c[1] + u[1] * (L2 / 2 - 4)];
    await p.selectOption('.sp-studycard [data-va=veh]', 'van'); await p.click('.sp-studycard [data-va=draw]'); for (const q of [a0, a1]) { assert(await pick(q)); await p.waitForTimeout(100); } await p.click('.sp-studycard [data-sa=finish]'); await p.waitForTimeout(300);
    await run(); const RV = await rows(); assert.match(RV['Least clearance'], /stall|m to/); console.log(`PASS a delivery van down the middle of the first aisle: ${RV['Status']}, least clearance ${RV['Least clearance']}`);
    await p.evaluate(() => window.__wsStudy.open('parking-layout')); await p.waitForTimeout(600); const back = await p.locator('.sp-studycard').innerText();
    assert.match(back, /Route 1 \(Delivery van\): (no stall hit|\d+ stalls? hit or under the clearance)/, back.slice(0, 400)); console.log('PASS back in Parking layout: ' + back.match(/Route 1 \(Delivery van\)[^.]*/)[0]);
    // 6. underground: the columns of the Structure grid, none under a stall
    await p.evaluate(() => { const s = window.__wsStudy.state(); return s; }); await unfold(); await p.click('.sp-studycard [data-pk-kind=underground]'); await p.click('.sp-studycard [data-pk=unlockall]').catch(() => {}); await run();
    const ug = await p.evaluate(async () => { const P = await import('./js/parking.js'), s = window.__wsStudy.state(), cols = s.pkObs.filter((o) => o.kind === 'column'), ok = s.pkLast.stalls.filter((x) => x.valid); return { cols: cols.length, total: ok.length, on: ok.filter((x) => cols.some((c) => !P.disjoint(x.footprint, c.poly))).length }; });
    assert(ug.cols > 0, 'columns from the Structure grid'); assert.equal(ug.on, 0, 'no stall on a column'); await p.screenshot({ path: `${shots}/parking-2.png` });
    console.log(`PASS underground: ${ug.cols} columns of the Structure grid in the area, ${ug.total} stalls, none on a column`);
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
