// Vehicle swept path without drawing, in motion, in 3D (2026-11-25), hospital example at 1440×900:
// the card says what it found on the site (buildings, roads, doors to outside, junctions); "To an entrance" with a door picked from
// the list gives a route and a result with no line drawn; playing it moves the vehicle continuously (sampled on the page's own
// frames: small even steps, no jumps) in 2D and as a schematic 3D model whose front wheels steer with the drive; "Follow in 3D"
// moves the view with it; a turn at the junction and a drive through the site (two clicks near the roads) each find a route;
// "Try every vehicle" lists every preset with its result and gives a CSV; no page errors.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], out = process.env.SHOT_DIR || '/tmp';
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'persp' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    const id = await p.evaluate(async () => (await import('./js/hospital-example.js')).openHospital().id); await p.goto(base + '/mvp/#/workspace/' + id);
    await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    const idle = () => p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 });
    const run = async () => { await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await idle(); await p.waitForTimeout(500); const e = await p.evaluate(() => window.__wsStudy.state().err); assert(!e, 'study error: ' + e); };
    const rows = () => p.evaluate(() => Object.fromEntries(window.__wsStudy.state().res.rows.map(([k, v]) => [k, String(v).replace(/<[^>]+>/g, '')])));
    const unfold = () => p.evaluate(() => { const d = document.querySelector('.sp-studycard details[data-adv="__set"]'); if (d && !d.open) d.querySelector('summary').click(); });
    await p.evaluate(() => window.__wsStudy.open('vehicle-swept-path')); await p.waitForSelector('.sp-studycard [data-va-task]'); await p.waitForTimeout(600);
    // 1 · what the site gives, and a route to a door with nothing drawn
    const found = await p.locator('.sp-studycard .sp-found').innerText(); assert.match(found, /\d+ buildings? around it, [1-9]\d* roads?, [1-9]\d* doors? to outside, \d+ junctions?/, found);
    assert.equal(await p.getAttribute('.sp-studycard [data-va-task=entrance]', 'aria-selected'), 'true', 'To an entrance is the first task'); assert.equal(await p.isVisible('.sp-studycard [data-va=draw]'), false, 'no Draw route button for it');
    const opts = await p.$$eval('.sp-studycard [data-va=ent] option', (o) => o.map((x) => x.textContent)); assert(opts.length >= 1 && /^Door 1/.test(opts[0]), 'doors listed: ' + opts);
    await p.selectOption('.sp-studycard [data-va=veh]', 'box'); await run(); let R = await rows();
    assert.match(R['Found route'], /to door 1 .*: [\d.]+ m, \d+ % of it on the roads/, 'a found route: ' + R['Found route']); assert.match(R['Status'], /Feasible|Not verified/); assert.equal(R['Collisions'], 'none');
    assert.equal(await p.evaluate(() => (window.__wsStudy.state().res.saRuns[0].drawnPts)), null, 'no drawn line');
    await p.screenshot({ path: out + '/vehicle-auto-entrance.png' });
    console.log(`PASS ${found.replace(/ All are.*/, '')} To an entrance: ${R['Found route']}; ${R['Status']}`);
    // 2 · playing: the vehicle moves continuously in 2D and in 3D, front wheels steering
    const st = () => p.evaluate(() => __ws2.inst.persp.ws.vehiclesState());
    const s0 = await st(); assert(s0.d3.length === 1 && s0.d3[0].parts >= 4, '3D model at the start ' + JSON.stringify(s0));
    await p.selectOption('.sp-studycard [data-tl=speed]', '2'); await p.click('.sp-studycard [data-tl=play]');
    const samp = await p.evaluate(() => new Promise((res) => { const out = [], t0 = performance.now(); const f = (t) => { const v = __ws2.inst.persp.ws.vehiclesState().d3[0]; if (v) out.push([t - t0, v.x, v.y, v.steer]); if (t - t0 < 3000) requestAnimationFrame(f); else res(out); }; requestAnimationFrame(f); }));
    const steps = samp.slice(1).map((s, i) => Math.hypot(s[1] - samp[i][1], s[2] - samp[i][2])), moved = Math.hypot(samp.at(-1)[1] - samp[0][1], samp.at(-1)[2] - samp[0][2]), maxStep = Math.max(...steps);
    // the headless browser draws 3D in software (a few frames a second); the check is that the steps are even, not their number
    const med = steps.slice().sort((a, c) => a - c)[steps.length >> 1];
    assert(samp.length >= 4, 'frames sampled: ' + samp.length); assert(moved > 1, 'the vehicle moved ' + moved.toFixed(2) + ' m'); assert(maxStep <= Math.max(0.3, med * 3), 'no jumps: largest step ' + maxStep.toFixed(2) + ' m, median ' + med.toFixed(2) + ' m');
    const steered = samp.some((s) => Math.abs(s[3]) > 0.02);
    await p.waitForTimeout(400); const d2 = await p.evaluate(() => __ws2.inst.plan.ws.vehiclesState().d2); assert(d2 >= 1, 'the vehicle over the 2D plan too');
    await p.screenshot({ path: out + '/vehicle-auto-playing.png' });
    console.log(`PASS playing at 2×: ${samp.length} frames in 3 s, ${moved.toFixed(1)} m, steps even (largest ${maxStep.toFixed(2)} m, median ${med.toFixed(2)} m); front wheels ${steered ? 'steered' : 'straight on this stretch'}; also drawn over the 2D plan`);
    // follow in 3D: the camera moves with the vehicle
    const cam = () => p.evaluate(() => { const w = __ws2.inst.persp.win, c = w.S3?.api?.camera?.() || null; return c; }).catch(() => null);
    await p.click('.sp-studycard [data-tl=reset]').catch(() => {}); await p.waitForTimeout(300);
    const c0 = (await st()).d3[0].cam; await p.check('.sp-studycard [data-tl=follow]'); await p.click('.sp-studycard [data-tl=play]'); await p.waitForTimeout(2500);
    const fol = await st(); assert(fol.d3[0].follow === true, 'follow on'); void cam; const cm = Math.hypot(fol.d3[0].cam[0] - c0[0], fol.d3[0].cam[2] - c0[2]); assert(cm > 1, 'the 3D view moved with the vehicle: ' + cm.toFixed(1) + ' m');
    await p.screenshot({ path: out + '/vehicle-auto-follow.png' }); await p.uncheck('.sp-studycard [data-tl=follow]'); await p.waitForTimeout(300); assert((await st()).d3[0].follow === false, 'follow off');
    console.log(`PASS Follow in 3D: the view moved ${cm.toFixed(1)} m with the vehicle; turns off again`);
    await p.click('.sp-studycard [data-tl=reset]').catch(() => {});
    // 3 · Try every vehicle
    await p.click('.sp-studycard [data-va=tryall]'); await p.waitForFunction(() => document.querySelector('.sp-studycard [data-va=tryallcsv]'), null, { timeout: 600000 });
    const all = await p.$$eval('.sp-studycard .sp-vehall tbody tr', (t) => t.map((r) => r.innerText.replace(/\s+/g, ' ')));
    const n = await p.evaluate(async () => (await import('./js/vehicles.js')).PRESETS.length); assert.equal(all.length, n, 'one row per preset');
    const [csv] = await Promise.all([p.waitForEvent('download'), p.click('.sp-studycard [data-va=tryallcsv]')]); assert.match(csv.suggestedFilename(), /every-vehicle.*\.csv$/);
    await p.screenshot({ path: out + '/vehicle-auto-every.png' });
    console.log(`PASS Try every vehicle: ${all.length} rows (${all.filter((r) => /Feasible/.test(r)).length} make it), CSV ${csv.suggestedFilename()}`);
    // 4 · a turn at the junction
    await unfold(); await p.click('.sp-studycard [data-va-task=junction]'); await p.waitForTimeout(300);
    const ar = await p.$$eval('.sp-studycard [data-va=jfrom] option', (o) => o.length); assert(ar >= 2, 'junction arms ' + ar);
    await p.selectOption('.sp-studycard [data-va=veh]', 'car'); await p.selectOption('.sp-studycard [data-va=jto]', String(ar - 1)); await run(); R = await rows();
    assert.match(R['Found route'], /at junction 1: [\d.]+ m/, 'junction route: ' + R['Found route']);
    console.log(`PASS Turn at a junction: ${R['Found route']}; ${R['Status']}`);
    // 5 · through the site: two clicks near the roads
    const rd = await p.evaluate(() => (__ws2.inst.plan.ws.planScene('noise').roads || []).filter((r) => r.pts.length >= 2).map((r) => r.pts));
    const longest = rd.sort((a, c) => c.length - a.length)[0], a0 = longest[0], a1 = longest.at(-1), inA = [a0[0] + (a1[0] - a0[0]) * 0.1, a0[1] + (a1[1] - a0[1]) * 0.1], inB = [a0[0] + (a1[0] - a0[0]) * 0.9, a0[1] + (a1[1] - a0[1]) * 0.9];
    await unfold(); await p.click('.sp-studycard [data-va-task=through]'); await p.waitForTimeout(300); await p.click('.sp-studycard [data-va=pickthr]');
    for (const q of [inA, inB]) { assert(await p.evaluate((q) => __ws2.inst.plan.ws._pick(q), q), 'a click near the road'); await p.waitForTimeout(150); }
    await run(); R = await rows(); assert.match(R['Found route'], /through the site/, R['Found route']);
    console.log(`PASS Through the site with two clicks: ${R['Found route']}; ${R['Status']}`);
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
