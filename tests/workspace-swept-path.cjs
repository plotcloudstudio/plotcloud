// Vehicle swept path in the Workspace (2026-11-18), on the hospital example (one building 61.5 × 27.6 m about the origin, site
// buildings around): a route drawn by clicks on the plan (Draw route, three clicks, Finish); Start: the envelope, wheel tracks and
// outlines drawn on the sheet and the result rows; the same route moved against the building: a collision with it; a corner radius
// set under the truck's minimum: infeasible on that corner; the timeline moves the vehicle; a second vehicle on a crossing route at the
// same time: they meet; JSON, SVG and DXF of the geometry; no page errors.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 960 }, acceptDownloads: true }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], shots = process.env.SHOT_DIR || require('os').tmpdir();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'plan' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    const id = await p.evaluate(async () => (await import('./js/hospital-example.js')).openHospital().id); await p.goto(base + '/mvp/#/workspace/' + id);
    await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    const idle = () => p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 });
    const run = async (ok = true) => { await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await idle(); await p.waitForTimeout(400); const e = await p.evaluate(() => window.__wsStudy.state().err); if (ok) assert(!e, 'study error: ' + e); return e; };
    const pick = (pt) => p.evaluate((q) => __ws2.inst.plan.ws._pick(q), pt);
    const unfold = () => p.evaluate(() => { const d = document.querySelector('.sp-studycard details[data-adv="__set"]'); if (d && !d.open) d.querySelector('summary').click(); });   // after a result the settings are folded
    const draw = async (btn, pts) => { await unfold(); await p.waitForTimeout(150); await p.click(`.sp-studycard ${btn}`); for (const q of pts) { assert(await pick(q), 'a click on the plan at ' + q); await p.waitForTimeout(120); } await p.click('.sp-studycard [data-sa=finish]'); await p.waitForTimeout(300); };
    const rows = () => p.evaluate(() => Object.fromEntries(window.__wsStudy.state().res.rows.map(([k, v]) => [k, String(v).replace(/<[^>]+>/g, '')])));
    const marks = () => p.evaluate(() => __ws2.inst.plan.ws._walkMarks());
    // the study is in the menu, under Site access & parking
    await p.click('#addSimBtn'); await p.waitForTimeout(300); const inMenu = await p.evaluate(() => [...document.querySelectorAll('.w2-simmenu [data-group=access] [data-addsim]')].map((x) => x.textContent)); await p.keyboard.press('Escape');
    assert(inMenu.some((t) => /Vehicle swept path/.test(t)) && inMenu.some((t) => /Parking layout/.test(t)) && !inMenu.some((t) => /Coming soon/.test(t)), 'in the menu: ' + inMenu);
    await p.evaluate(() => window.__wsStudy.open('vehicle-swept-path')); await p.waitForSelector('.sp-studycard [data-va=draw]'); await p.waitForTimeout(600);
    await p.selectOption('.sp-studycard [data-va=veh]', 'box'); await p.waitForTimeout(200);
    // 1. a route along the south side and up the east side, 6 m off the building
    await draw('[data-va=draw]', [[-50, -20], [37, -20], [37, 30]]); assert.match(await p.locator('.sp-studycard').innerText(), /3 points, 137\.0 m/);
    await run(); let R = await rows(); const m1 = await marks();
    for (const t of ['envelope', 'track', 'outline', 'ref']) assert(m1.tags.includes(t), `${t} drawn: ${[...new Set(m1.tags)]}`);
    assert.match(R['Status'], /Feasible|Not verified/); assert.match(R['Least clearance'], /m to /); assert.equal(R['Collisions'], 'none'); assert.match(R['Swept area'], /m²/);
    await p.screenshot({ path: `${shots}/swept-path-1.png` });
    console.log(`PASS a box truck along the drawn route: ${R['Status']}; ${R['Route']}; tightest ${R['Tightest turn']}; least clearance ${R['Least clearance']}; swept ${R['Swept area']}; ${m1.tags.filter((t) => t === 'outline').length} outlines`);
    // 2. against the building: 0.6 m off its south face (the truck is 2.45 m wide): a collision
    const avoid = async (on) => { await unfold(); await p.waitForTimeout(150); await p.evaluate((on) => { const c = document.querySelector('.sp-studycard [data-va=avoid]'); if (c.checked !== on) c.click(); }, on); await p.waitForTimeout(200); };
    await avoid(false); await draw('[data-va=draw]', [[-45, -14.5], [20, -14.5]]); await run(); R = await rows();
    assert.match(R['Status'], /Infeasible/); assert.match(R['Collisions'], /^1: the proposed building/); const m2 = await marks(); assert(m2.tags.includes('obstacle'));
    console.log(`PASS against the building, driven as drawn: ${R['Status']}, ${R['Collisions']}`);
    // 2b. the same line with "Drive round obstacles": a way round is found and driven, no collision; the drawn line stays on the plan
    await avoid(true); await run(); R = await rows(); assert.match(R['Way round'] || '', /ran into the proposed building[^;]*; driven round it instead/, JSON.stringify(R)); assert.equal(R['Collisions'], 'none');
    const m2b = await marks(); assert(m2b.tags.includes('drawn') && m2b.tags.includes('envelope')); await p.screenshot({ path: `${shots}/swept-path-around.png` });
    console.log(`PASS with Drive round obstacles: ${R['Way round']}; collisions ${R['Collisions']}; least clearance ${R['Least clearance']}`);
    // 3. a corner of 3 m radius for the truck (its least is 5.5 m), driven as drawn: infeasible on that corner
    await avoid(false); await draw('[data-va=draw]', [[-50, -22], [40, -22], [40, 30]]);
    await unfold(); await p.evaluate(() => { const d = document.querySelector('.sp-studycard [data-adv=va-segs]'); if (d) d.open = true; }); await p.fill('.sp-studycard [data-va-rad="1"]', '3'); await p.dispatchEvent('.sp-studycard [data-va-rad="1"]', 'change'); await p.waitForTimeout(200);
    await run(); R = await rows(); assert.match(R['Status'], /Infeasible/); const why = await p.locator('.sp-studycard').innerText(); assert.match(why, /tighter than the vehicle's minimum radius 5\.50 m/); assert((await marks()).tags.includes('infeasible'));
    console.log('PASS a 3 m corner for the box truck: Infeasible, "tighter than the vehicle\'s minimum radius 5.50 m", marked orange');
    await avoid(true);
    await unfold(); await p.evaluate(() => { const d = document.querySelector('.sp-studycard [data-adv=va-segs]'); if (d) d.open = true; }); await p.fill('.sp-studycard [data-va-rad="1"]', ''); await p.dispatchEvent('.sp-studycard [data-va-rad="1"]', 'change'); await run();
    // 4. the timeline moves the vehicle
    const lab = await p.evaluate(() => { const s = document.querySelector('.sp-studycard [data-tl=seek]'); s.value = String(Math.round(+s.max / 2)); s.dispatchEvent(new Event('input', { bubbles: true })); return 1; }); void lab; await p.waitForTimeout(400);
    const tl = await p.locator('.sp-studycard .sp-tll').innerText(); assert.match(tl, /Route 1: [\d.]+ m, steering -?\d+° · [\d.]+ s/); assert((await marks()).tags.includes('body')); console.log('PASS the timeline: ' + tl);
    await p.click('.sp-studycard [data-tl=reset]').catch(() => {});
    // 5. a car on a second route crossing the first at the same time: they meet
    // (the truck's body is over x = −10 from about 15.1 to 19.3 s; the car, from y = −40 (clear of the site's car park) to −20 (clear of
    // the building) and starting 10 s later, is over the truck's lane from about 15.8 to 19 s)
    await unfold(); await p.click('.sp-studycard [data-va-route="1"]'); await p.waitForTimeout(200); await p.selectOption('.sp-studycard [data-va=veh]', 'car'); await draw('[data-va=draw]', [[-10, -40], [-10, -20]]);
    await p.fill('.sp-studycard [data-va=delay]', '10'); await p.dispatchEvent('.sp-studycard [data-va=delay]', 'change'); await p.waitForTimeout(200);
    await run(); R = await rows(); assert.match(R['Two vehicles'], /meet at/, JSON.stringify(R)); assert.match(R['Status'], /Infeasible/); assert.match(await p.locator('.sp-studycard').innerText(), /in the same place at [\d.]+ s: one must wait/); console.log(`PASS two vehicles: ${R['Two vehicles']}`);
    // 6. exports: JSON downloads; the DXF has the layers, the SVG parses
    const [dlj] = await Promise.all([p.waitForEvent('download'), p.click('.sp-studycard [data-sa-exp=json]')]); assert.match(dlj.suggestedFilename(), /^swept-path-.*\.json$/);
    const ex = await p.evaluate(async () => { const C = await import('./js/cad-export.js'), L = window.__wsStudy.state().res.saLayers(), d = C.readDxf(C.dxf(L)), s = C.svg(L, { title: 't' }); return { d, svgOk: !new DOMParser().parseFromString(s, 'image/svg+xml').querySelector('parsererror'), n: s.length }; });
    assert(ex.d.R1_ENVELOPE && ex.d.R1_ENVELOPE.polylines >= 1 && ex.d.R1_WHEELS.polylines >= 4 && ex.d.OBSTACLES.polylines >= 1, JSON.stringify(ex.d)); assert(ex.svgOk);
    console.log(`PASS exports: JSON ${dlj.suggestedFilename()}; DXF layers ${Object.keys(ex.d).join(', ')}; SVG ${ex.n} characters, parses`);
    await p.screenshot({ path: `${shots}/swept-path-2.png` });
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
