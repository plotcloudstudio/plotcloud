// Vehicle swept path: draw the route and the vehicle drives it (2026-11-28), hospital example at 1440×900:
// no task tabs, "Draw the route" first; a turn at the site's road junction drawn with three clicks shows the swept path after the
// second click, before Finish; the run is feasible (or says why); in 3D the vehicle sits on the terrain under it (not floating);
// "Move a point" moves the last point and the route is driven again; a hairpin too tight for the truck is flagged while drawing;
// Try every vehicle runs on the drawn route; the vehicle access sheet goes to the report; no page errors.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], out = process.env.SHOT_DIR || '/tmp';
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'persp' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    const id = await p.evaluate(async () => (await import('./js/hospital-example.js')).openHospital().id); await p.goto(base + '/mvp/#/workspace/' + id);
    await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    const pick = (q) => p.evaluate((q) => __ws2.inst.plan.ws._pick(q), q), marks = () => p.evaluate(() => __ws2.inst.plan.ws._walkMarks());
    const idle = () => p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 600000 });
    const run = async () => { await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await idle(); await p.waitForTimeout(500); const e = await p.evaluate(() => window.__wsStudy.state().err); assert(!e, 'study error: ' + e); };
    const unfold = () => p.evaluate(() => { const d = document.querySelector('.sp-studycard details[data-adv="__set"]'); if (d && !d.open) d.querySelector('summary').click(); });
    const rows = () => p.evaluate(() => Object.fromEntries(window.__wsStudy.state().res.rows.map(([k, v]) => [k, String(v).replace(/<[^>]+>/g, '')])));
    await p.evaluate(() => window.__wsStudy.open('vehicle-swept-path')); await p.waitForSelector('.sp-studycard [data-va=draw]'); await p.waitForTimeout(600);
    // 1 · one way of working
    assert.equal(await p.locator('.sp-studycard [data-va-task]').count(), 0, 'no task tabs'); assert.match(await p.locator('.sp-studycard').innerText(), /Draw the route/);
    // the junction of the site's two roads, and a point 22 m out along two of its arms (in the right-hand lane)
    const J = await p.evaluate(async () => { const SR = await import('./js/site-routes.js'), roads = (__ws2.inst.plan.ws.planScene('noise').roads || []).filter((r) => r.pts.length >= 2), Js = SR.junctions(roads); if (!Js.length) return null; const j = Js[0], ar = SR.arms(roads, j).sort((a, c) => (c.road.width || 6) - (a.road.width || 6));
      const out = (a, d) => [j.p[0] + a.dir[0] * d, j.p[1] + a.dir[1] * d], c = ar.find((x) => x !== ar[0] && Math.abs(x.dir[0] * ar[0].dir[0] + x.dir[1] * ar[0].dir[1]) < 0.7) || ar[1]; return { j: j.p, a: out(ar[0], 22), c: out(c, 22), turn: Math.acos(Math.max(-1, Math.min(1, -(c.dir[0] * ar[0].dir[0] + c.dir[1] * ar[0].dir[1])))) * 180 / Math.PI }; });   // two arms at an angle: a real turn
    assert(J, 'the site has a road junction');
    await p.selectOption('.sp-studycard [data-va=veh]', 'box'); await p.click('.sp-studycard [data-va=draw]');
    assert(await pick(J.a)); await p.waitForTimeout(200); assert(await pick(J.j)); await p.waitForTimeout(600);
    const live = await marks(); assert(live.tags.includes('livepath'), 'the swept path shows after the second click: ' + [...new Set(live.tags)].join());
    assert(await pick(J.c)); await p.waitForTimeout(400); await p.click('.sp-studycard [data-sa=finish]'); await p.waitForTimeout(300);
    console.log('PASS no task tabs; a turn at the junction drawn with three clicks, its swept path shown after the second');
    await run(); let R = await rows(); assert.match(R['Status'], /Feasible|Not verified|Infeasible/); const len1 = await p.evaluate(() => window.__wsStudy.state().res.saRuns[0].length);
    await p.screenshot({ path: out + '/vehicle-draw.png' });
    assert.notEqual(R['Tightest turn'], 'straight', 'a turn: ' + R['Tightest turn']);
    console.log(`PASS the drawn turn (${J.turn.toFixed(0)}° at the junction) driven: ${R['Status']}; ${len1.toFixed(1)} m; tightest turn ${R['Tightest turn']}`);
    // 2 · in 3D on the ground: at three moments of the playback the vehicle's height is the terrain's under it
    const gaps = [], grounds = []; for (const f of [0.1, 0.5, 0.9]) { await p.evaluate((f) => { const s = document.querySelector('.sp-studycard [data-tl=seek]'); s.value = String(+s.max * f); s.dispatchEvent(new Event('input', { bubbles: true })); }, f); await p.waitForTimeout(300);
      const g = await p.evaluate(() => { const v = __ws2.inst.persp.ws.vehiclesState().d3[0]; return v ? { z: v.z, g: __ws2.inst.persp.ws._vehGround(v.x, v.y) } : null; }); assert(g, 'a 3D vehicle'); gaps.push(Math.abs(g.z - 0.02 - g.g)); grounds.push(g.g); }
    assert(Math.max(...gaps) < 0.05, 'on the terrain: ' + gaps.map((x) => x.toFixed(3)).join(', '));
    console.log(`PASS in 3D the vehicle sits on the terrain under it (within ${Math.max(...gaps).toFixed(3)} m at three moments; the ground there ${grounds.map((x) => x.toFixed(2)).join(' / ')} m)`);
    // 3 · move the last point 6 m on: driven again
    await unfold(); await p.click('.sp-studycard [data-va=movept]'); assert(await pick(J.c)); await p.waitForTimeout(200); const c2 = [J.c[0] + (J.c[0] - J.j[0]) * 0.27, J.c[1] + (J.c[1] - J.j[1]) * 0.27]; assert(await pick(c2)); await idle(); await p.waitForTimeout(800);
    const len2 = await p.evaluate(() => window.__wsStudy.state().res.saRuns[0].length); assert(len2 > len1 + 3, `the route driven again, longer: ${len1.toFixed(1)} → ${len2.toFixed(1)} m`);
    console.log(`PASS Move a point: the last point moved, the route driven again (${len1.toFixed(1)} → ${len2.toFixed(1)} m)`);
    // 4 · a hairpin too tight for the truck, flagged while drawing
    await unfold(); await p.click('.sp-studycard [data-va=draw]'); const h0 = J.a, h1 = [J.a[0] + (J.j[0] - J.a[0]) * 0.5, J.a[1] + (J.j[1] - J.a[1]) * 0.5], h2 = [h0[0] + (J.j[1] - J.a[1]) * 0.08, h0[1] - (J.j[0] - J.a[0]) * 0.08];
    for (const q of [h0, h1, h2]) { assert(await pick(q)); await p.waitForTimeout(300); } const hm = await marks(); assert(hm.tags.includes('livebad'), 'the hairpin flagged while drawing: ' + [...new Set(hm.tags)].join());
    await p.click('.sp-studycard [data-sa=cancel], .sp-studycard [data-sa=finish]'); await p.waitForTimeout(300);
    console.log('PASS a hairpin too tight for the truck is flagged red while it is drawn');
    // 5 · Try every vehicle on the drawn route; the sheet to the report
    await unfold(); await p.click('.sp-studycard [data-va=draw]'); for (const q of [J.a, J.j, J.c]) { assert(await pick(q)); await p.waitForTimeout(150); } await p.click('.sp-studycard [data-sa=finish]'); await p.waitForTimeout(300); await run();
    await p.click('.sp-studycard [data-va=tryall]'); await p.waitForFunction(() => document.querySelector('.sp-studycard [data-va=tryallcsv]'), null, { timeout: 900000 });
    const n = await p.$$eval('.sp-studycard .sp-vehall tbody tr', (t) => t.length), np = await p.evaluate(async () => (await import('./js/vehicles.js')).PRESETS.length); assert.equal(n, np);
    await p.click('.sp-studycard [data-va=sheet]'); await p.waitForFunction(() => +document.querySelector('.sp-xlb .sp-badge')?.textContent >= 1, null, { timeout: 120000 });
    console.log(`PASS Try every vehicle on the drawn route: ${n} rows; the vehicle access sheet added to the report`);
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
