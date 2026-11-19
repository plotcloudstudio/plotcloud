// Wayfinding Phase 3 in the Workspace (2026-11-19), hospital example: after a run, Generate signage gives three layouts with their
// counts (signs, decisions guided, routes fully guided, High points, points left, visibility); Use B makes it the floor's layout,
// saved with the project; its signs stand in 3D as boards (on the wall or hung) carrying their arrows; a sign's wording edited; a
// sign moved by a click on the plan into a room is flagged; Before / After compares the floor without and with the layout; after a
// reload the layout is still there; no page errors.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 960 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], shots = process.env.SHOT_DIR || require('os').tmpdir();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'plan' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    const id = await p.evaluate(async () => (await import('./js/hospital-example.js')).openHospital().id);
    const open = async () => { await p.goto(base + '/mvp/#/workspace/' + id); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
      await p.evaluate(() => window.__wsStudy.open('wayfinding')); await p.waitForSelector('.sp-studycard'); await p.waitForTimeout(800);
      await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 }); await p.waitForTimeout(600);
      const e = await p.evaluate(() => window.__wsStudy.state().err); assert(!e, 'study error: ' + e); };
    await open();
    // three layouts
    await p.click('.sp-studycard [data-way="gen"]'); await p.waitForSelector('.sp-studycard .sp-wfopt tbody tr');
    const opt = await p.$$eval('.sp-studycard .sp-wfopt tbody tr', (rs) => rs.map((r) => [...r.cells].slice(0, 7).map((c) => c.textContent.trim())));
    assert.equal(opt.length, 3); const n = opt.map((r) => +r[1]); assert(n[0] <= n[1] && n[1] <= n[2], 'A ≤ B ≤ C: ' + n); for (const r of opt) assert.match(r[2], /^\d+ % \(\d+\/\d+\)$/);
    console.log('PASS three layouts: ' + opt.map((r) => `${r[0]}: ${r[1]} signs, ${r[2]} decisions guided, routes ${r[3]}, High ${r[4]}, left ${r[5]}, visibility ${r[6]}`).join(' · '));
    // use B
    await p.click('.sp-studycard [data-way="use"][data-v="B"]'); await p.waitForSelector('.sp-studycard .sp-wfsigns tbody tr');
    const saved = await p.evaluate((pid) => import('./js/store.js').then((S) => { const pj = S.project(pid), lv = window.__wsStudy.state().res.wayA.level.id; return { lv, plan: pj.wayPlans?.[lv] }; }), id);
    assert(saved.plan && saved.plan.opt === 'B' && saved.plan.signs.length === n[1], JSON.stringify(saved).slice(0, 300));
    const head = await p.locator('.sp-studycard .sp-flabel', { hasText: 'Signage layout' }).innerText(); assert.match(head, new RegExp(`option B · ${n[1]} signs`));
    const n3 = await p.evaluate(() => __ws2.inst.persp.ws.signCount?.()); assert.equal(n3, n[1], 'a 3D board for every sign');
    console.log(`PASS option B used: ${n[1]} signs saved with the project for this floor; ${n3} boards in 3D`);
    // edit a sign's wording
    const say = p.locator('.sp-studycard [data-way-say="0:0"]'); await say.fill('Imaging, Main Reception'); await say.press('Tab'); await p.waitForTimeout(400);
    const w0 = await p.evaluate((pid) => import('./js/store.js').then((S) => { const pj = S.project(pid), lv = window.__wsStudy.state().res.wayA.level.id; return pj.wayPlans[lv]; }), id);
    assert.deepEqual(w0.signs[0].ways[0].to, ['Imaging', 'Main Reception']); assert(w0.edited); assert.match(await p.locator('.sp-studycard .sp-flabel', { hasText: 'Signage layout' }).innerText(), /\(edited\)/);
    console.log('PASS a sign\'s wording edited: "' + w0.signs[0].ways[0].to.join(', ') + '" (saved, the layout marked edited)');
    // move the first sign into a room by a click on the plan (the pick hook): flagged
    const target = await p.evaluate(() => { const A = window.__wsStudy.state().res.wayA, o = A.F.SC.origin, r = A.F.rooms.filter((x) => !x.circ).sort((a, b) => b.rects[0][2] * b.rects[0][3] - a.rects[0][2] * a.rects[0][3])[0], c = r.rects[0]; return { name: r.name, p: [c[0] + c[2] / 2 + o[0], c[1] + c[3] / 2 + o[1]] }; });
    await p.click('.sp-studycard [data-way="signmove"][data-v="0"]'); await p.waitForTimeout(300);
    assert(await p.evaluate((q) => __ws2.inst.plan.ws._pick(q) || __ws2.inst.persp.ws._pick(q), target.p), 'the click on the plan is taken'); await p.waitForTimeout(800);   // as a click there (the other wayfinding test's way)
    const row0 = await p.locator('.sp-studycard .sp-wfsigns tbody tr').first(); assert.match(await row0.getAttribute('class'), /sp-bad/);
    const iss = await p.locator('.sp-studycard .sp-sflist').first().innerText(); assert.match(iss, /Visibility issue|not at a decision point/);
    console.log(`PASS the first sign moved into ${target.name} by a click on the plan (the pick hook): flagged ("${iss.split('\n')[0]}")`);
    await p.evaluate(() => __ws2.inst.plan.ws.pickPoint?.(null));
    // Before / After
    await p.click('.sp-studycard [data-way="ba"]'); await p.waitForSelector('.sp-studycard .sp-wfba', { timeout: 120000 });
    const ba = await p.$$eval('.sp-studycard .sp-wfba tbody tr', (rs) => rs.map((r) => [...r.cells].map((c) => c.textContent.trim()))); const need = ba.find((r) => /Points needing a sign/.test(r[0]));
    assert(+need[2] < +need[1], 'fewer points needing a sign with the layout: ' + JSON.stringify(ba)); await p.locator('.sp-studycard').screenshot({ path: shots + '/wayfinding-layout.png' });
    console.log('PASS Before / After: ' + ba.map((r) => `${r[0]} ${r[1]} → ${r[2]}`).join(' · '));
    // reload: still there
    await open(); await p.waitForSelector('.sp-studycard .sp-wfsigns tbody tr'); const again = await p.locator('.sp-studycard .sp-wfsigns tbody tr').count(); assert.equal(again, n[1]);
    console.log(`PASS after a reload the floor's layout is back (${again} signs, option B, edited)`);
    // Phase 4: walk a route at eye height; it stops before the first decision with what the walker sees; Next goes on; the 3D eye follows
    await p.click('.sp-studycard [data-way="walkgo"]'); await p.waitForSelector('.sp-studycard [data-way-walkat]', { timeout: 60000 });
    const at1 = await p.locator('.sp-studycard [data-way-walkat]').innerText(); assert.match(at1, /Point \d+ · (High|Medium|Low) · the way on is (Ahead|Left|Right|Back)/); assert.match(at1, /Signs seen/); assert.match(at1, /(Guided|Not guided):/);
    const eye1 = await p.evaluate(() => { const w = __ws2.inst.persp.win, s = (w.S3.api || w.S3).walk.state(); return { on: s.on, x: s.x, y: s.y, eye: s.eye }; }); assert(eye1.on, 'the 3D view walks at eye height');
    const st1 = await p.evaluate(() => window.__wsStudy.state().wayWalk.state); await p.click('.sp-studycard [data-way="walknext"]'); await p.waitForTimeout(500);
    const eye2 = await p.evaluate(() => { const w = __ws2.inst.persp.win, s = (w.S3.api || w.S3).walk.state(); return { x: s.x, y: s.y }; }), st2 = await p.evaluate(() => window.__wsStudy.state().wayWalk.state);
    assert(st2.i === st1.i + 1 && st2.s > st1.s && Math.hypot(eye2.x - eye1.x, eye2.y - eye1.y) > 0.2, 'Next moved on to the next decision: ' + JSON.stringify([st1.i, st1.s, st2.i, st2.s, eye1, eye2])); const nDec = await p.locator('.sp-studycard .sp-wfwalk li').count(); assert(nDec >= 2);
    await p.click('.sp-studycard [data-way="walkplay"]'); await p.waitForTimeout(1200); const moving = await p.evaluate(() => window.__wsStudy.state().wayWalk?.state); assert(moving && (moving.playing || moving.at), 'playing, or stopped at the next decision');
    await p.locator('.sp-studycard').screenshot({ path: shots + '/wayfinding-walk-card.png' }); await p.screenshot({ path: shots + '/wayfinding-walk.png' });
    await p.click('.sp-studycard [data-way="walkstop"]'); await p.waitForTimeout(500);
    console.log(`PASS the walk: stopped before point 1 ("${at1.split('\n')[0]}"), eye at ${eye1.eye} m; Next moved it ${Math.hypot(eye2.x - eye1.x, eye2.y - eye1.y).toFixed(1)} m on; ${nDec} decisions listed; Play walks on`);
    // Phase 5: the schedule and the drawing
    const fs = require('node:fs'), got = {};
    for (const k of ['xcsv', 'xsvg', 'xdxf', 'xpng', 'xpdf']) { const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click(`.sp-studycard [data-way="${k}"]`)]); const f2 = await dl.path(); got[k] = { name: dl.suggestedFilename(), buf: fs.readFileSync(f2) }; }
    fs.writeFileSync(shots + '/wayfinding-drawing-export.png', got.xpng.buf);
    const csv = got.xcsv.buf.toString('utf8'); assert.match(got.xcsv.name, /-wayfinding-.*-schedule\.csv$/); assert.equal(csv.trim().split('\r\n').length, n[1] + 1); assert.match(csv, /Sign ID,Floor,/);
    assert.match(got.xsvg.buf.toString(), /^<svg[\s\S]*Signage schedule[\s\S]*<\/svg>$/); assert.match(got.xdxf.buf.toString(), /\n8\nSIGNS\n[\s\S]*EOF\n$/); assert.equal(got.xpng.buf.readUInt32BE(0), 0x89504e47); assert.equal(got.xpdf.buf.slice(0, 5).toString(), '%PDF-');
    console.log(`PASS exports: ${Object.values(got).map((g) => `${g.name} (${Math.round(g.buf.length / 1024)} kB)`).join(', ')}; the schedule has ${n[1]} signs`);
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
