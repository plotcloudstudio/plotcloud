// Natural ventilation and Indoor acoustics in the Workspace (2026-11-06). A two-storey block (rooms on both sides of a corridor,
// windows on both long facades, a stair between the floors) runs Natural ventilation on the whole building, for one wind and
// through the year of the project weather, with air changes on both floors and arrows at the openings; then Indoor acoustics on
// level 1, with a hard room that is too live and a panelled one. The old pages open the Workspace. Needs network access (site data).
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    await p.goto(base + '/mvp/#/new-project'); await p.waitForFunction(() => window.__newProjectMap, null, { timeout: 30000 });
    await p.evaluate(() => window.__newProjectMap.place(49.2448, -123.0071, 'QA vent block')); await p.waitForFunction(() => window.__newProjectMap.osm, null, { timeout: 120000 });
    await p.click('#npStart'); await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 180000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    await p.evaluate(() => { const ws = __ws2.inst.plan.ws, M = JSON.parse(ws.model()), c = M.site?.at || [0, 0], X = c[0] - 12, Y = c[1] - 6, id = (k) => k + Math.random().toString(36).slice(2, 8);
      M.levels = [{ id: 'L1', name: 'Level 1', z: 0, h: 3 }, { id: 'L2', name: 'Level 2', z: 3, h: 3 }];
      for (const lv of ['L1', 'L2']) {
        const W = (a, b2, mat) => { const w = { id: id('w'), lv, a: [X + a[0], Y + a[1]], b: [X + b2[0], Y + b2[1]], t: 0.2, h: 3, ...(mat ? { mat } : {}) }; M.walls.push(w); return w; };
        const O = (w, pos, wd, kind) => M.ops.push(kind === 'door' ? { id: id('o'), wall: w.id, pos, w: wd, kind: 'door', object_type: 'door', sill: 0, head: 2.1 } : { id: id('o'), wall: w.id, pos, w: wd, kind: 'win', object_type: 'window', sill: 0.9, head: 2.1, open: 0.5 });
        const s0 = W([0, 0], [24, 0]), e = W([24, 0], [24, 12]), n0 = W([24, 12], [0, 12]), wv = W([0, 12], [0, 0]);
        const cs = W([0, 5], [20, 5]), cn = W([0, 7], [20, 7]), st = W([20, 0], [20, 12]);
        for (const x of [5, 10, 15]) { W([x, 0], [x, 5], lv === 'L1' && x === 5 ? 'absorber' : null); W([x, 7], [x, 12]); }
        [0, 5, 10, 15].forEach((x0, k) => { O(s0, x0 + 2.5, 1.6, 'win'); O(n0, 24 - x0 - 2.5, 1.6, 'win'); O(cs, x0 + 2.5, 0.9, 'door'); O(cn, x0 + 2.5, 0.9, 'door');
          M.names.push({ lv, x: X + x0 + 2.5, y: Y + 2.5, name: k === 0 && lv === 'L1' ? 'Meeting room' : `Room ${lv}S${k + 1}` }, { lv, x: X + x0 + 2.5, y: Y + 9.5, name: `Room ${lv}N${k + 1}` }); });
        O(st, 6, 1.2, 'door'); O(e, 6, 1.4, 'win'); if (lv === 'L1') O(wv, 6, 1.2, 'door');
        M.names.push({ lv, x: X + 10, y: Y + 6, name: 'Corridor' }, { lv, x: X + 22, y: Y + 3, name: 'Stair' }); }
      const fr = __ws2.inst.plan.ws._genFurn('L1', 'straight', X + 22, Y + 6, 0); M.furn.push(fr);
      M.furn.push({ id: id('f'), lv: 'L1', type: 'sofa', name: 'Sofa', x: X + 7.5, y: Y + 2, w: 2, d: 0.9, h: 0.8, rot: 0, object_type: 'furniture', layer: 'Furniture' });
      const snap = JSON.stringify(M); ws.apply(snap, false); __ws2.hub.change('plan', snap, false); }); await p.waitForTimeout(3000);
    // the network directly: rooms on both levels, cross flow with the windows open, less with them ajar, nothing with no outside opening
    const d = await p.evaluate(() => { const w = __ws2.inst.persp.ws, a = w.ventNet({ from: 180, U10: 4, Tout: 20, Tin: 24, grid: true }), b2 = w.ventNet({ from: 180, U10: 4, Tout: 20, Tin: 24, win: 0.5 }), still = w.ventNet({ from: 180, U10: 0.1, Tout: 15, Tin: 25 });
      return { n: a.rooms.length, lv: [...new Set(a.rooms.map((r) => r.lv))], levels: a.levels.length, total: a.total, half: b2.total, still: still.total, ach: a.ach, flows: a.flows.length, inS: a.flows.filter((f) => f.ext && f.q > 0).length, outS: a.flows.filter((f) => f.ext && f.q < 0).length }; });
    assert(d.n >= 18 && d.lv.length === 2 && d.levels === 2, JSON.stringify(d)); assert(d.total > d.half && d.half > 0, 'ajar windows let in less air: ' + JSON.stringify(d)); assert(d.still > 0, 'the stack effect alone moves air');
    assert(d.inS > 0 && d.outS > 0, 'air comes in on one side and leaves on the other');
    console.log('PASS the network: rooms on both levels, total', Math.round(d.total), 'L/s (ajar', Math.round(d.half), ', stack alone', Math.round(d.still), '), openings in', d.inS, 'out', d.outS);
    // the study, from Add simulation › Interior: one wind
    await p.click('#addSimInt'); await p.click('.w2-simmenu [data-addsim="vent"]'); await p.waitForTimeout(1500);
    let card = await p.locator('.sp-studycard').innerText(); assert.match(card, /Natural Ventilation[\s\S]*One wind[\s\S]*Through the year[\s\S]*Windows[\s\S]*Doors[\s\S]*Target/i); assert.equal(await p.locator('.sp-host').count(), 0, 'it runs in the Workspace, not on the old page');
    await p.waitForFunction(() => /m\/s at 10 m|Without the project weather/.test(document.querySelector('.sp-studycard')?.innerText || ''), null, { timeout: 120000 });
    await p.click('[data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 180000 });
    let r = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, rows: s.res?.rows, view: s.res?.view, results: s.res?.results }; });
    assert.equal(r.err, ''); assert.equal(r.rows[0][0], 'Outdoor air, whole building'); assert.match(r.rows[0][1], /L\/s · [\d.]+ ach/); assert.equal(r.view, 'ach'); assert(r.results.rooms >= 18 && r.results.fresh > 0, JSON.stringify(r.results));
    const fr3 = p.frames().find((f) => f.url().includes('ws=persp')); await p.waitForTimeout(800);
    const g = await fr3.evaluate(() => S3._egress()); assert(g.on && g.sheets.length === 2, 'a sheet on each floor: ' + JSON.stringify(g));
    console.log('PASS one wind:', r.rows.slice(0, 4).map((x) => x.join(' ')).join(' · '));
    await p.click('.sp-studycard [data-st-view=fresh]'); await p.waitForTimeout(400); assert.equal(await p.evaluate(() => window.__wsStudy.state().res.view), 'fresh');
    // through the year
    await p.click('.sp-studycard [data-st-mode=year]'); await p.click('[data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 });
    r = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, rows: s.res?.rows, view: s.res?.view, results: s.res?.results }; });
    assert.equal(r.err, ''); assert.match(r.rows[0][0], /share of hours/); assert.match(r.rows[1][1], /h a year/); assert(['hours', 'fresh'].includes(r.view)); assert(r.results.openHours > 500, JSON.stringify(r.results));
    console.log('PASS through the year:', r.rows.slice(0, 3).map((x) => x.join(' ')).join(' · '));
    // 2D shows the current level's sheet with arrows
    await p.click('[data-sp=dim]'); await p.waitForTimeout(1200); const frp = p.frames().find((f) => f.url().includes('ws=plan'));
    assert(await frp.evaluate(() => !!window.__ws.egressState()), '2D shows the result');
    await p.click('[data-st=save]'); await p.waitForFunction(() => /Saved to results/.test(document.querySelector('.sp-studyres')?.innerText || ''), null, { timeout: 30000 });
    console.log('PASS 2D and Save to results');
    // Indoor acoustics on level 1
    await p.click('.sp-studycard [data-st=close]').catch(() => {}); await p.waitForTimeout(500);
    await p.click('#addSimInt'); await p.click('.w2-simmenu [data-addsim="acoustics"]'); await p.waitForTimeout(1000);
    card = await p.locator('.sp-studycard').innerText(); assert.match(card, /Indoor Acoustics[\s\S]*Eyring[\s\S]*Sabine[\s\S]*Target for every room[\s\S]*People/i);
    await p.click('[data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 60000 });
    r = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, rows: s.res?.rows, view: s.res?.view, results: s.res?.results }; });
    assert.equal(r.err, ''); assert.equal(r.rows[0][0], 'Rooms on target'); assert.equal(r.view, 'ratio'); assert(r.results.rooms.length >= 9, JSON.stringify(r.results));
    const meet = r.results.rooms.find((x) => x.room === 'Meeting room'), plain = r.results.rooms.find((x) => x.room === 'Room L1N1');
    assert.equal(meet.use, 'A3'); assert(plain.rt > 1 && plain.status === 'hi', 'a bare plaster room rings: ' + JSON.stringify(plain)); assert(meet.rt < plain.rt, 'the panelled meeting room with a sofa is drier: ' + JSON.stringify([meet, plain]));
    assert(r.rows.some(([k, v]) => /Room L1N1/.test(k) && /acoustic panel/.test(v)), 'a fix is suggested for a live room');
    await p.click('.sp-studycard [data-st-mode=sabine]'); await p.click('[data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 60000 });
    const sab = await p.evaluate(() => window.__wsStudy.state().res.results.rooms.find((x) => x.room === 'Room L1N1').rt); assert(sab > plain.rt, 'Sabine gives a longer time than Eyring: ' + sab + ' vs ' + plain.rt);
    for (const v of ['rt', 'sti']) { await p.click(`.sp-studycard [data-st-view=${v}]`); await p.waitForTimeout(300); assert.equal(await p.evaluate(() => window.__wsStudy.state().res.view), v); }
    console.log('PASS acoustics:', r.rows.slice(0, 4).map((x) => x.join(' ')).join(' · '), '· Sabine', sab);
    // the old pages open the Workspace; the detailed ventilation page stays
    await p.goto(base + '/mvp/#/simulations/acoustics'); await p.waitForFunction(() => location.hash.startsWith('#/workspace'), null, { timeout: 30000 });
    await p.goto(base + '/mvp/#/simulations/vent'); await p.waitForFunction(() => location.hash.startsWith('#/workspace'), null, { timeout: 30000 });
    await p.goto(base + '/mvp/#/simulations/vent?detail=1'); await p.waitForTimeout(4000); assert(!(await p.evaluate(() => location.hash)).startsWith('#/workspace'), 'the detailed page opens');
    console.log('PASS the old pages open the Workspace; the detailed ventilation page stays');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
