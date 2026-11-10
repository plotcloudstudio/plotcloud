// Edit site model on the plan (2026-11-10): the site's own elements (the water, planting and paving areas, roads, the boundary)
// are picked, moved and reshaped like the rest of the model. On the hospital example: click the water runnel, its card opens; drag
// it, it moves (and its water centre line with it); drag a corner, the shape changes; undo puts it back; it shows in 3D.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    await p.goto(base + '/mvp/#/home'); await p.waitForSelector('[data-hospital]'); await p.click('.ph-thumb[data-hospital]');
    await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(2500);
    await p.click('#editSite'); await p.waitForTimeout(800); await p.click('[data-sp=dim]'); await p.waitForTimeout(1500);
    const fr = p.frames().find((f) => f.url().includes('ws=plan')), box = await p.locator('iframe[src*="ws=plan"]').boundingBox();
    const st = () => fr.evaluate(() => { const a = JSON.parse(__ws.model()).site.areas.find((x) => x.id === 'runnel'); return { pts: a.pts, centre: a.water?.centre || null, edited: !!a.edited }; });
    const s0 = await st(), pl = await fr.evaluate(() => __ws.sitePlanPt({ k: 'sarea', id: 'runnel' })), sc = await fr.evaluate((q) => __ws.toScreen(q), pl);
    assert((await fr.evaluate(() => __ws.siteDebug())).editOn, 'Edit site model is on, on the plan');
    // 1 · drag the area
    const X = box.x + sc[0], Y = box.y + sc[1]; await p.mouse.move(X, Y); await p.mouse.down(); for (let i = 1; i <= 10; i++) await p.mouse.move(X + 6 * i, Y + 3 * i); await p.mouse.up(); await p.waitForTimeout(600);
    const s1 = await st(), dx = s1.pts[0][0] - s0.pts[0][0], dy = s1.pts[0][1] - s0.pts[0][1];
    assert(Math.hypot(dx, dy) > 1, 'the water moved: ' + JSON.stringify([s0.pts[0], s1.pts[0]])); assert(s1.edited);
    assert(s1.pts.every((q, i) => Math.abs(q[0] - s0.pts[i][0] - dx) < 0.02 && Math.abs(q[1] - s0.pts[i][1] - dy) < 0.02), 'every corner moved by the same amount');
    if (s0.centre) assert(Math.abs(s1.centre[0][0] - s0.centre[0][0] - dx) < 0.02, 'its water centre line moved with it');
    const card = await p.evaluate(() => window.__wsSiteEl?.state()); assert(card && card.sel && card.sel.id === 'runnel', 'its card is open: ' + JSON.stringify(card));
    console.log('PASS the water dragged on the plan:', dx.toFixed(2), dy.toFixed(2), 'm; its card open');
    // 2 · drag a corner (the area selected: its corners are handles)
    const c0 = await fr.evaluate(() => { const M = JSON.parse(__ws.model()), a = M.site.areas.find((x) => x.id === 'runnel'); return a.pts[0]; });
    const cpl = await fr.evaluate(() => { const P = JSON.parse(__ws.model()).site.areas.find((x) => x.id === 'runnel').pts, c = __ws.sitePlanPt({ k: 'sarea', id: 'runnel' }), m = P.reduce((a, q) => [a[0] + q[0] / P.length, a[1] + q[1] / P.length], [0, 0]); return [c[0] + (P[0][0] - m[0]), c[1] + (P[0][1] - m[1])]; });
    const cs = await fr.evaluate((q) => __ws.toScreen(q), cpl), h = await fr.evaluate((q) => __ws.siteDebug(q).hit, cpl);
    await p.mouse.move(box.x + cs[0], box.y + cs[1]); await p.mouse.down(); for (let i = 1; i <= 6; i++) await p.mouse.move(box.x + cs[0] - 5 * i, box.y + cs[1]); await p.mouse.up(); await p.waitForTimeout(600);
    const s2 = await st(); assert(h && h.v === 0, 'the corner is a handle: ' + JSON.stringify(h)); assert(Math.hypot(s2.pts[0][0] - c0[0], s2.pts[0][1] - c0[1]) > 0.5 && JSON.stringify(s2.pts[1]) === JSON.stringify(s1.pts[1]), 'one corner moved, the others stayed');
    console.log('PASS a corner dragged:', JSON.stringify(c0), '→', JSON.stringify(s2.pts[0]));
    // 3 · undo twice: back where it was
    await p.evaluate(() => { __ws2.inst.plan.ws.undo(); }); await p.waitForTimeout(400); await p.evaluate(() => { __ws2.inst.plan.ws.undo(); }); await p.waitForTimeout(800);
    const s3 = await st(); assert.deepEqual(s3.pts, s0.pts, 'undo restores the water');
    // 4 · the 3D view has the same site
    const p3 = await p.evaluate(() => JSON.parse(__ws2.inst.persp.ws.model()).site.areas.find((x) => x.id === 'runnel').pts); assert.deepEqual(p3, s0.pts, 'the 3D view follows');
    console.log('PASS undo, and the 3D view follows'); assert.deepEqual(errs, []);
  } finally { await b.close(); } })().catch((e) => { console.error(e); process.exit(1); });
