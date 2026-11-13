// Fire Evacuation follows the model and shows the building (2026-11-10), on a model drawn in the Workspace (not the example):
// · Code check and Everyone out read the exits, stairs and doors from the model: move the outside door and add a second one, and the
//   study runs again by itself, with the exits where they now are; move the stair, and its mark moves
// · the 3D view is a cutaway: the storey shown and those below solid, cut 1.4 m above the floor with dark caps on the walls; the
//   storeys above, their sheets and their people hidden; switching level shows the other storey; See-through brings back the ghost
const { chromium } = require('playwright'), assert = require('node:assert/strict'), os = require('node:os');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const fr3s = () => pg.frames().find((f) => f.url().includes('ws=persp')); let pg;
  try {
    const p = pg = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || os.tmpdir();
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); localStorage.setItem('pc-unfold', '1'); });
    await p.goto(base + '/mvp/#/new-project'); await p.waitForFunction(() => window.__newProjectMap, null, { timeout: 30000 });
    await p.evaluate(() => window.__newProjectMap.place(49.2448, -123.0071, 'QA ward block')); await p.waitForFunction(() => window.__newProjectMap.osm, null, { timeout: 120000 });
    await p.click('#npStart'); await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 180000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    // the ward block, the same on both floors; the exit door on the ground floor only
    await p.evaluate(() => { const ws = __ws2.inst.plan.ws, M = JSON.parse(ws.model()), c = M.site?.at || [0, 0], X = c[0] - 20, Y = c[1] - 7, id = (k) => k + Math.random().toString(36).slice(2, 8);
      M.levels = [{ id: 'L1', name: 'Level 1', z: 0, h: 4 }, { id: 'L2', name: 'Level 2', z: 4, h: 4 }];
      for (const lv of ['L1', 'L2']) {
        const W = (a, b) => { const w = { id: id('w'), lv, a: [X + a[0], Y + a[1]], b: [X + b[0], Y + b[1]], t: 0.2, h: 4 }; M.walls.push(w); return w; };
        const D = (w, pos, wd) => M.ops.push({ id: id('o'), wall: w.id, pos, w: wd, kind: 'door', object_type: 'door', sill: 0, head: 2.1, open: 1 });
        W([0, 0], [40, 0]); W([40, 0], [40, 14]); W([40, 14], [0, 14]); const west = W([0, 14], [0, 0]); if (lv === 'L1') D(west, 7, 1.8);
        const s = W([0, 6], [34, 6]), n = W([0, 8], [34, 8]), smoke = W([17, 6], [17, 8]), st = W([34, 0], [34, 14]); D(smoke, 1, 1.6); D(st, 7, 1.6);
        for (const x of [8.5, 25.5]) { W([x, 0], [x, 6]); W([x, 8], [x, 14]); } W([17, 0], [17, 6]); W([17, 8], [17, 14]);
        const xs = [0, 8.5, 17, 25.5]; xs.forEach((x0, k) => { D(s, x0 + 4.25, 1.2); D(n, x0 + 4.25, 1.2); M.names.push({ lv, x: X + x0 + 4.25, y: Y + 3, name: `Ward ${lv === 'L1' ? 1 : 2}S${k + 1}` }, { lv, x: X + x0 + 4.25, y: Y + 11, name: `Ward ${lv === 'L1' ? 1 : 2}N${k + 1}` });
          for (const bx of [x0 + 2.2, x0 + 6.3]) for (const by of [2.4, 11.6]) M.furn.push({ id: id('f'), lv, type: 'bed1', name: 'Single bed', x: X + bx, y: Y + by, w: 0.95, d: 2, h: 0.5, rot: 0, object_type: 'furniture', layer: 'Furniture' }); });
        M.names.push({ lv, x: X + 8, y: Y + 7, name: 'Corridor' }, { lv, x: X + 26, y: Y + 7, name: 'Corridor' }, { lv, x: X + 37, y: Y + 3, name: 'Stair' }); }
      const fr = __ws2.inst.plan.ws._genFurn('L1', 'straight', X + 37.2, Y + 7.6, 0); fr.gen.vals.W = 1400; M.furn.push(fr);
      const snap = JSON.stringify(M); ws.apply(snap, false); __ws2.hub.change('plan', snap, false); }); await p.waitForTimeout(3000);
    const snap = () => p.evaluate(() => JSON.parse(__ws2.inst.plan.ws.model()));
    const apply = (M) => p.evaluate((m) => { const s = JSON.stringify(m); __ws2.inst.plan.ws.apply(s, false); __ws2.hub.change('plan', s, false); }, M);
    const key = () => p.evaluate(() => window.__wsStudy.state().key), waitNewRun = (k0) => p.waitForFunction((k) => { const s = window.__wsStudy.state(); return !s.busy && s.res && s.key !== k; }, k0, { timeout: 300000 });
    const marks = () => fr3s().evaluate(() => window.__ws.egressState().marks);
    // 1 · the code check on this model
    await p.evaluate(() => window.__wsStudy.open('fire-evacuation')); await p.waitForTimeout(1200); await p.click('.sp-studycard [data-st-mode=code]'); await p.waitForTimeout(500);
    await p.click('.sp-studycard [data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 });
    let m0 = await marks(); const ex0 = m0[0].doorAt.filter((d) => d[2] === 'exit'), rows0 = await p.evaluate(() => window.__wsStudy.state().res.rows.map((r) => r.join(' ').replace(/<[^>]+>/g, '')));
    assert.equal(ex0.length, 1, 'one outside door to begin with: ' + JSON.stringify(m0[0])); assert(rows0.some((r) => /✗ Level 1 · Number of exits/.test(r)), 'one exit: to review');
    // 2 · move the outside door 3 m along its wall and add a second outside door at the east end: the study runs again by itself
    const M = await snap(), west = M.walls.find((w) => w.lv === 'L1' && Math.abs(w.a[0] - w.b[0]) < 1e-6 && w.a[1] > w.b[1]), east = M.walls.find((w) => w.lv === 'L1' && Math.abs(w.a[0] - w.b[0]) < 1e-6 && w.b[1] > w.a[1] && w.a[0] > west.a[0] + 30);
    const d0 = M.ops.find((o) => o.wall === west.id); d0.pos = d0.pos - 3; M.ops.push({ ...d0, id: 'oEast', wall: east.id, pos: 7 });
    const t1 = Date.now(), k1 = await key(); await apply(M); await waitNewRun(k1); await p.waitForTimeout(800);
    let m1 = await marks(); const ex1 = m1[0].doorAt.filter((d) => d[2] === 'exit'); assert.equal(ex1.length, 2, 'two outside doors after the edit: ' + JSON.stringify(m1[0]));
    assert(ex1.some((d) => Math.abs(d[1] - ex0[0][1]) > 2.5), 'the moved door is marked where it now is: ' + JSON.stringify([ex0, ex1])); const rows1 = await p.evaluate(() => window.__wsStudy.state().res.rows.map((r) => r.join(' ').replace(/<[^>]+>/g, '')));
    assert(rows1.some((r) => /✓ Level 1 · Number of exits 2/.test(r)), 'two exits now: ' + rows1.slice(0, 6).join(' | ')); console.log('PASS the study ran again by itself: exits', JSON.stringify(ex0), '→', JSON.stringify(ex1), `(${Math.round((Date.now() - t1) / 1000)} s)`);
    // 3 · move the stair 2 m: its mark follows
    const s0 = m1[1].stairAt[0], M2 = await snap(), st = M2.furn.find((f) => f.gen && /straight|stair/.test(f.gen.id || f.type)), k2 = await key(); st.y -= 2; await apply(M2); await waitNewRun(k2); await p.waitForTimeout(800);
    const m2 = await marks(); assert(Math.abs(m2[1].stairAt[0][1] - s0[1]) > 1.5, 'the stair mark moved: ' + JSON.stringify([s0, m2[1].stairAt[0]])); console.log('PASS the stair mark follows the stair:', JSON.stringify(s0), '→', JSON.stringify(m2[1].stairAt[0]));
    // 4 · the cutaway in 3D: everyone out, level 1 shown
    await p.click('.sp-studycard [data-st-mode=all]'); await p.waitForTimeout(400); await p.selectOption('.sp-studycard [data-eg=runs]', '10');
    await p.click('.sp-studycard [data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 }); await p.waitForTimeout(1500);
    await p.evaluate(() => __ws2.inst.persp.ws.level('L1')); await p.waitForTimeout(1500); let g = await fr3s().evaluate(() => S3._egress());
    assert.equal(g.mode, 'cut'); assert(g.cut.n > 20 && g.cut.caps > 5, 'the storey cut with caps on its walls: ' + JSON.stringify(g.cut)); assert(g.cut.hidden >= 1, 'the storey above hidden'); assert.equal(g.sheetsShown, 1, 'only the sheet of level 1');
    await p.screenshot({ path: `${out}/cutaway-l1.png` });
    await p.evaluate(() => __ws2.inst.persp.ws.level('L2')); await p.waitForTimeout(1500); g = await fr3s().evaluate(() => S3._egress()); assert.equal(g.lv, 'L2'); assert.equal(g.sheetsShown, 2, 'level 2 and the one below'); await p.screenshot({ path: `${out}/cutaway-l2.png` });
    await p.click('.sp-studycard [data-eg=v3d][data-v=ghost]'); await p.waitForTimeout(1000); g = await fr3s().evaluate(() => S3._egress()); assert.equal(g.mode, 'ghost'); assert(g.ghost > 10 && g.cut.n === 0, 'see-through again: ' + JSON.stringify(g));
    console.log('PASS the cutaway: cut parts', JSON.stringify(g.cut), '· see-through back on request'); assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
