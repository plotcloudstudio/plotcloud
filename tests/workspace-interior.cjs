// Interior studies in the Workspace (2026-10-31): Circulation runs on the level chosen in the Level menu, with the rooms as places,
// and draws its walks on that floor in 3D (a cutaway) and over the plan in 2D. Needs network access (site data) like workspace-in-view.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    await p.goto(base + '/mvp/#/new-project'); await p.waitForFunction(() => window.__newProjectMap, null, { timeout: 30000 });
    await p.evaluate(() => window.__newProjectMap.place(49.2448, -123.0071, 'QA flat')); await p.waitForFunction(() => window.__newProjectMap.osm, null, { timeout: 120000 });
    await p.click('#npStart'); await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 180000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
  // a small flat on level 1: four rooms off a corridor, with doors, and a few pieces of furniture
  await p.evaluate(() => { const ws = __ws2.inst.plan.ws, M = JSON.parse(ws.model()), c = M.site?.at || [0, 0], lv = M.levels[0].id, X = c[0] - 9, Y = c[1] - 6, id = (k) => k + Math.random().toString(36).slice(2, 8);
    const W = (a, b) => { const w = { id: id('w'), lv, a: [X + a[0], Y + a[1]], b: [X + b[0], Y + b[1]], t: 0.2, h: 3 }; M.walls.push(w); return w; };
    const D = (w, pos) => M.ops.push({ id: id('o'), wall: w.id, pos, w: 0.9, kind: 'door', sill: 0, head: 2.1, open: 1 });
    W([0, 0], [18, 0]); W([18, 0], [18, 12]); const top = W([18, 12], [0, 12]); W([0, 12], [0, 0]);
    const c1 = W([0, 5], [18, 5]), c2 = W([0, 7], [18, 7]); W([6, 0], [6, 5]); W([12, 0], [12, 5]); W([9, 7], [9, 12]);
    D(c1, 3); D(c1, 9); D(c1, 15); D(c2, 4); D(c2, 14); const ent = M.walls.find((w) => w.a[0] === X && w.a[1] === Y + 12); D(ent, 6);
    M.names = [{ lv, x: X + 3, y: Y + 2.5, name: 'Bedroom' }, { lv, x: X + 9, y: Y + 2.5, name: 'Bathroom' }, { lv, x: X + 15, y: Y + 2.5, name: 'Study' }, { lv, x: X + 4.5, y: Y + 9.5, name: 'Living' }, { lv, x: X + 13.5, y: Y + 9.5, name: 'Kitchen' }, { lv, x: X + 9, y: Y + 6, name: 'Corridor' }];
    const snap = JSON.stringify(M); ws.apply(snap, false); __ws2.hub.change('plan', snap, false); }); await p.waitForTimeout(2500);
    await p.click('#addSimBtn'); await p.click('.w2-simmenu [data-addsim=evac]'); await p.waitForTimeout(800);
    const card = await p.locator('.sp-studycard').innerText(); assert.match(card, /Circulation[\s\S]*Level 1[\s\S]*5 rooms as places[\s\S]*Living/); assert.doesNotMatch(card, /Corridor/);
    await p.click('[data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 180000 });
    const r = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, rows: s.res?.rows, view: s.res?.view }; });
    assert.equal(r.err, ''); assert.deepEqual(r.rows[1], ['Pairs walked', '10 of 10']); assert.match(r.rows[0][1], /^\d+(\.\d)? m$/); assert.equal(r.view, 'walks');
    await p.waitForTimeout(9000); const fr = p.frames().find((f) => f.url().includes('ws=persp')), sheet = await fr.evaluate(() => S3._sheet());
    assert(sheet && sheet.vis, 'the walks are drawn on the floor in 3D'); assert(await fr.evaluate(() => (window.__ws._walkPNG() || '').length > 10000), 'the walks ink has content');
    console.log(`PASS Circulation on Level 1: ${r.rows[1][1]} pairs, average walk ${r.rows[0][1]}, walks on the floor in 3D`);
    await p.click('[data-sp=dim]'); await p.waitForTimeout(2500); await p.click('[data-st-view=density]'); await p.waitForTimeout(500);
    const pf = p.frames().find((f) => f.url().includes('ws=plan')); assert(await pf.evaluate(() => (window.__ws._walkPNG() || '').length > 5000), 'density drawn over the plan');
    console.log('PASS the same study over the 2D plan; Density view'); assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
