// Interior studies in the Workspace (2026-10-31): Circulation runs on the level chosen in the Level menu, with the rooms as places,
// and draws its walks on that floor in 3D (a cutaway) and over the plan in 2D. Needs network access (site data) like workspace-in-view.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); localStorage.setItem('pc-unfold', '1'); });
    await p.goto(base + '/mvp/#/new-project'); await p.waitForFunction(() => window.__newProjectMap, null, { timeout: 30000 });
    await p.evaluate(() => window.__newProjectMap.place(49.2448, -123.0071, 'QA flat')); await p.waitForFunction(() => window.__newProjectMap.osm, null, { timeout: 120000 });
    await p.click('#npStart'); await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 180000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
  // a small flat on level 1: four rooms off a corridor, with doors, and a few pieces of furniture
  await p.evaluate(() => { const ws = __ws2.inst.plan.ws, M = JSON.parse(ws.model()), c = M.site?.at || [0, 0], lv = M.levels[0].id, X = c[0] - 9, Y = c[1] - 6, id = (k) => k + Math.random().toString(36).slice(2, 8);
    const W = (a, b) => { const w = { id: id('w'), lv, a: [X + a[0], Y + a[1]], b: [X + b[0], Y + b[1]], t: 0.2, h: 3 }; M.walls.push(w); return w; };
    const D = (w, pos) => M.ops.push({ id: id('o'), wall: w.id, pos, w: 0.9, kind: 'door', object_type: 'door', sill: 0, head: 2.1, open: 1 }); const Wn = (w, pos) => M.ops.push({ id: id('o'), wall: w.id, pos, w: 1.6, kind: 'win', object_type: 'window', sill: 0.9, head: 2.1 });
    const bot = W([0, 0], [18, 0]); W([18, 0], [18, 12]); Wn(bot, 3); Wn(bot, 9); Wn(bot, 15); const top = W([18, 12], [0, 12]); W([0, 12], [0, 0]);
    const c1 = W([0, 5], [18, 5]), c2 = W([0, 7], [18, 7]); W([6, 0], [6, 5]); W([12, 0], [12, 5]); W([9, 7], [9, 12]);
    Wn(top, 4.5); Wn(top, 13.5); D(c1, 3); D(c1, 9); D(c1, 15); D(c2, 4); D(c2, 14); const ent = M.walls.find((w) => w.a[0] === X && w.a[1] === Y + 12); D(ent, 6);
    M.names = [{ lv, x: X + 3, y: Y + 2.5, name: 'Bedroom' }, { lv, x: X + 9, y: Y + 2.5, name: 'Bathroom' }, { lv, x: X + 15, y: Y + 2.5, name: 'Study' }, { lv, x: X + 4.5, y: Y + 9.5, name: 'Living' }, { lv, x: X + 13.5, y: Y + 9.5, name: 'Kitchen' }, { lv, x: X + 9, y: Y + 6, name: 'Corridor' }];
    const snap = JSON.stringify(M); ws.apply(snap, false); __ws2.hub.change('plan', snap, false); }); await p.waitForTimeout(2500);
    await p.click('#addSimInt'); await p.click('.w2-simmenu [data-addsim=evac]'); await p.waitForTimeout(800);
    const card = await p.locator('.sp-studycard').innerText(); assert.match(card, /circulation[\s\S]*Level 1[\s\S]*5 rooms as places[\s\S]*Living/i); assert.doesNotMatch(card, /Corridor/);
    await p.click('[data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 180000 });
    const r = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, rows: s.res?.rows, view: s.res?.view }; });
    assert.equal(r.err, ''); assert.deepEqual(r.rows[1], ['Pairs walked', '10 of 10']); assert.match(r.rows[0][1], /^\d+(\.\d)? m$/); assert.equal(r.view, 'walks');
    await p.waitForTimeout(9000); const fr = p.frames().find((f) => f.url().includes('ws=persp')), sheet = await fr.evaluate(() => S3._sheet());
    assert(sheet && sheet.vis, 'the walks are drawn on the floor in 3D'); assert(await fr.evaluate(() => (window.__ws._walkPNG() || '').length > 10000), 'the walks ink has content');
    // on the floor, not in the air, and people walking the routes (2026-11-01)
    const pp = await fr.evaluate(() => ({ ...S3._people(), sheet: S3._sheet().y }));
    const lv1 = await fr.evaluate(() => S3._floorTop());   // the top of Level 1's floor slab in the 3D view
    assert(Number.isFinite(lv1) && Math.abs(pp.sheet - lv1) < 0.12, `the walks sheet on the floor of Level 1 (${pp.sheet} vs slab top ${lv1})`); assert(pp.n >= 1 && Math.abs(pp.y - pp.sheet) < 0.01, `people walking on the sheet ${JSON.stringify(pp)}`);
    // the cutaway takes only the design above 1.2 m: no cut over the whole scene, the surrounding buildings stay whole
    const cut = await fr.evaluate(() => S3._cut()); assert(cut.global === 0 && cut.design > 0 && cut.site === 0, `cutaway on the design only ${JSON.stringify(cut)}`);
    if (process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/circ-3d.png' });
    console.log(`PASS Circulation on Level 1: ${r.rows[1][1]} pairs, average walk ${r.rows[0][1]}, walks on the floor in 3D (sheet ${pp.sheet.toFixed(2)} m, floor ${lv1.toFixed(2)} m), ${pp.n} people walking`);
    await p.click('[data-sp=dim]'); await p.waitForTimeout(2500); await p.click('[data-st-view=density]'); await p.waitForTimeout(500);
    if (process.env.SHOTS) { await p.click('[data-st-view=walks]'); await p.waitForTimeout(1500); await p.screenshot({ path: process.env.SHOTS + '/circ-2d.png' }); await p.click('[data-st-view=density]'); await p.waitForTimeout(500); }
    const pf = p.frames().find((f) => f.url().includes('ws=plan')); assert(await pf.evaluate(() => (window.__ws._walkPNG() || '').length > 5000), 'density drawn over the plan');
    console.log('PASS the same study over the 2D plan; Density view');
    await p.click('#addSimInt'); await p.click('.w2-simmenu [data-addsim=privacy]'); await p.click('[data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 180000 });
    const pr = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, rows: s.res?.rows }; }); assert.equal(pr.err, ''); assert.match(pr.rows[0][1], /%$/); assert.match(JSON.stringify(pr.rows), /Bedroom[\s\S]*High need/);
    assert(await pf.evaluate(() => (window.__ws._walkPNG() || '').length > 5000), 'privacy drawn over the plan'); console.log(`PASS Privacy on Level 1: ${pr.rows[0][1]} of the floor seen from outside, windows to screen ${pr.rows[3][1]}`);
    await p.click('#addSimInt'); await p.click('.w2-simmenu [data-addsim=wayfinding]'); await p.click('[data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 180000 });
    const wf = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, rows: s.res?.rows }; }); assert.equal(wf.err, ''); assert.deepEqual(wf.rows[2], ['Rooms seen from the start', '5 of 5']); assert.doesNotMatch(JSON.stringify(wf.rows), /no way in/);
    console.log(`PASS Wayfinding on Level 1: every room reached (doorways walkable), ${wf.rows[0][1]} decision points`);
    // Space syntax and Movement depth (2026-11-01; Movement depth a view of Space syntax, no menu entry, since 2026-11-12): the study page's visibility graph, in the Workspace, on the floor of this level
    for (const [id, view] of [['spacesyntax', 'integ'], ['movementdepth', 'flowdepth']]) {
      if (id === 'movementdepth') { await p.click('.sp-studycard [data-st=close]').catch(() => {}); await p.evaluate(() => window.__wsStudy.open('movementdepth')); } else { await p.click('#addSimInt'); await p.click(`.w2-simmenu [data-addsim=${id}]`); } await p.locator('.sp-studycard .sp-est').waitFor({ timeout: 30000 });   // Movement depth: a view of Space syntax since 2026-11-12, opened by its old link
      assert.match(await p.locator('.sp-studycard').innerText(), /Draft · estimated time/); assert.equal(await p.locator('.sp-studycard [data-st-set^="ssLevel"]').count(), 0, 'the detail comes from the quality above Add simulation (2026-11-09)');
      await p.click('[data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 });
      const ss = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, view: s.res?.view, n: s.res?.cells, rows: s.res?.rows, fin: s.res ? Array.from(s.res.vals).filter(Number.isFinite).length : 0, views: Object.keys(s.res?.views || {}) }; });
      assert(!ss.err && ss.view === view && ss.n > 30 && ss.fin === ss.n, id + ' ' + JSON.stringify(ss));
      const fr2 = p.frames().find((f) => f.url().includes('ws=persp')); assert((await fr2.evaluate(() => S3._sheet()))?.vis, id + ': drawn on the floor in 3D');
      if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/${id}.png` });
      console.log(`PASS ${id} in the Workspace: ${ss.n} nodes, views ${ss.views.join(', ')}; ${ss.rows.slice(0, 2).map((x) => x.join(' ')).join(' · ')}`); }
    // Isovist safety (2026-11-01): the study page's analysis in the Workspace; the viewpoint starts in the largest room and moves with a click
    await p.click('#addSimInt'); await p.click('.w2-simmenu [data-addsim=isovist]'); await p.locator('.sp-studycard [data-iso=pick]').waitFor({ timeout: 30000 });
    await p.click('[data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 120000 });
    const iv = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, view: s.res?.view, rows: s.res?.rows, at: s.isoView, views: Object.keys(s.res?.views || {}) }; });
    assert(!iv.err && iv.view === 'seen' && /%/.test(iv.rows[0][1]) && iv.at && iv.views.includes('eyes'), 'isovist ' + JSON.stringify(iv));
    await p.click('[data-iso=pick]'); const fb = await p.locator('#fPlan:visible, #fPersp:visible').first().boundingBox(); await p.mouse.click(fb.x + fb.width * 0.62, fb.y + fb.height * 0.55);
    await p.waitForFunction((a0) => { const s = window.__wsStudy.state(); return !s.busy && s.res && s.isoView && (s.isoView[0] !== a0[0] || s.isoView[1] !== a0[1]); }, iv.at, { timeout: 60000 });
    const iv2 = await p.evaluate(() => { const s = window.__wsStudy.state(); return { at: s.isoView, rows: s.res.rows }; });
    if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/isovist.png` });
    console.log(`PASS isovist in the Workspace: ${iv.rows[0].join(' ')} from the largest room; a click moved the viewpoint to ${iv2.at.map((v) => v.toFixed(1)).join(', ')} → ${iv2.rows[0].join(' ')}`);
    // View analysis (2026-11-01): the study page's LEED Quality Views screening in the Workspace
    await p.click('#addSimInt'); await p.click('.w2-simmenu [data-addsim=views]'); await p.locator('.sp-studycard .sp-est').waitFor({ timeout: 30000 });
    assert.match(await p.locator('.sp-studycard').innerText(), /Draft · estimated time[\s\S]*Window head height/);
    await p.click('[data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 });
    const vw = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, view: s.res?.view, n: s.res?.cells, rows: s.res?.rows, views: Object.keys(s.res?.views || {}) }; });
    assert(!vw.err && vw.view === 'quality' && vw.n > 50 && /%/.test(vw.rows[0][1]) && /LEED/.test(vw.rows[2][0]), 'views ' + JSON.stringify(vw));
    if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/views.png` });
    console.log(`PASS views in the Workspace: ${vw.n} spots; ${vw.rows.slice(0, 3).map((x) => x.join(' ')).join(' · ')}`);
    // Camera coverage (2026-11-01): the study page's DORI camera search in the Workspace
    await p.click('#addSimInt'); await p.click('.w2-simmenu [data-addsim=cameras]'); await p.locator('.sp-studycard [data-cam=camLevel]').waitFor({ timeout: 30000 });
    await p.click('[data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 });
    const cm = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, view: s.res?.view, rows: s.res?.rows, views: Object.keys(s.res?.views || {}) }; });
    assert(!cm.err && cm.view === 'count' && /%/.test(cm.rows[0][1]) && /^4 /.test(cm.rows[1][1]), 'cameras ' + JSON.stringify(cm));
    if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/cameras.png` });
    console.log(`PASS cameras in the Workspace: ${cm.rows.slice(0, 3).map((x) => x.join(' ')).join(' · ')}`);
    // Daylight (2026-11-01): the study page's climate-based daylight in the Workspace, with the project weather
    await p.click('#addSimInt'); await p.click('.w2-simmenu [data-addsim=daylight]'); await p.locator('.sp-studycard .sp-est').waitFor({ timeout: 30000 });
    await p.click('[data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 });
    const dl = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, view: s.res?.view, rows: s.res?.rows, views: Object.keys(s.res?.views || {}) }; });
    assert(!dl.err && dl.view === 'sda' && /%/.test(dl.rows[0][1]) && dl.views.includes('opt2'), 'daylight ' + JSON.stringify(dl));
    if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/daylight.png` });
    console.log(`PASS daylight in the Workspace: ${dl.rows.slice(0, 3).map((x) => x.join(' ')).join(' · ')} · ${dl.rows.at(-1).join(' ')}`);
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
