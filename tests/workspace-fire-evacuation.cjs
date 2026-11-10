// Fire evacuation in the Workspace (2026-11-06): the whole building. A two-storey ward block (a corridor with a cross-corridor
// smoke door, eight two-bed wards per floor, a stair at the east end, the exit on the ground floor) runs as a hospital evacuation:
// horizontal relocation, then down the stairs. The result sheets lie on both floors in 3D with the building ghosted, people play
// back on both floors and on the stair, and the 2D plan shows the current level's people. Needs network access (site data).
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const fr3s = () => pg.frames().find((f) => f.url().includes('ws=persp')); let pg;
  try {
    const p = pg = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
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
    const bs = await p.evaluate(() => { const B = __ws2.inst.persp.ws.buildingScene(); return { levels: B.levels.map((l) => [l.id, l.z, l.sc.rooms.length, l.sc.open.filter((o) => o.kind === 'door').length]), stairs: B.stairs.map((s) => [s.lv, s.top]) }; });
    assert.deepEqual(bs.stairs, [['L1', 'L2']], 'the stair joins level 1 to level 2'); assert.equal(bs.levels.length, 2); assert(bs.levels.every((l) => l[2] >= 10), JSON.stringify(bs));
    console.log('PASS the building scene: two levels with their rooms and doors, one stair between them', JSON.stringify(bs.levels));
    // the study, from Add simulation › Interior
    await p.click('#addSimInt'); await p.click('.w2-simmenu [data-addsim="fire-evacuation"]'); await p.waitForTimeout(800);
    let card = await p.locator('.sp-studycard').innerText(); assert.match(card, /Fire Evacuation[\s\S]*Everyone out[\s\S]*Hospital: next zone[\s\S]*Hospital: then out[\s\S]*Building use[\s\S]*Detection and alarm[\s\S]*PD 7974-6/);
    assert.doesNotMatch(card, /Shade from the masses/); assert.equal(await p.locator('.sp-host').count(), 0, 'it runs in the Workspace, not on the old page');
    // 1 · everyone out (the default, 2026-11-09): the stages of the evacuation time, the exits and stairs, the purple routes
    await p.selectOption('.sp-studycard [data-eg=runs]', '10'); await p.selectOption('.sp-studycard [data-eg=detect]', '60');
    await p.click('[data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 });
    const ra = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, rows: s.res?.rows, view: s.res?.view, results: s.res?.results, csv: s.res?.csv?.().slice(0, 3) }; });
    assert.equal(ra.err, ''); assert.equal(ra.view, 'routes', 'the escape routes first'); assert.equal(ra.results.notFinished, 0, JSON.stringify(ra.rows)); assert(ra.results.people > 20, JSON.stringify(ra.results));
    const keys = ra.rows.map((x) => x[0]).join(' | ');
    for (const k of [/Everyone out \(RSET\)/, /1 · Detection and alarm/, /2 · Pre-movement/, /First person out/, /3 · Travel incl\. queueing/, /Queueing at doors and stairs/, /Last person out/, /Level 1 clear after/, /Level 2 clear after/, /Exit: Level 1/, /Stair: /]) assert.match(keys, k);
    assert.match(ra.csv[0], /alarm_s,pre_movement_s,starts_walking_s,out_s,travel_s,queueing_s,distance_m,exit/);
    await p.click('.sp-studycard [data-st-view=trails]'); await p.waitForTimeout(800);
    const st = await fr3s().evaluate(() => window.__ws.egressState()); assert(st.trails && st.purple[0] > 500 && st.purple[1] > 500, 'purple routes on both floors: ' + JSON.stringify(st.purple)); assert(st.fire, 'the room of fire origin marked');
    await p.screenshot({ path: (process.env.SHOT_DIR || require('os').tmpdir()) + '/evac-routes.png' });
    console.log('PASS everyone out:', ra.rows.slice(0, 9).map((x) => x.join(' ')).join(' · '), '· purple px', st.purple.join('/'));
    // 2 · the hospital: horizontal relocation, then down the stairs
    await p.click('.sp-studycard [data-st-mode=down]'); card = await p.locator('.sp-studycard').innerText(); assert.match(card, /Staff on duty[\s\S]*CSA Z8000/); await p.selectOption('.sp-studycard [data-eg=runs]', '10');
    await p.click('[data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 });
    const r = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, rows: s.res?.rows, view: s.res?.view, results: s.res?.results }; });
    assert.equal(r.err, ''); assert.equal(r.rows[0][0], 'Everyone out, median (P50)'); assert.match(r.rows[0][1], /^\d+(\.\d)? (s|min)$/); assert.equal(r.view, 'trails');
    assert.equal(r.results.patients, 32); assert.equal(r.results.staff, 8); assert.equal(r.results.notFinished, 0, JSON.stringify(r.rows));
    assert(r.rows.some(([k, v]) => k === 'Smoke compartments' && /Level 1 2 · Level 2 2/.test(v)), 'the smoke door splits each floor in two');
    console.log('PASS the run: horizontal then down,', r.rows.slice(0, 4).map((x) => x.join(' ')).join(' · '));
    // 3D: the building ghosted, a sheet on each floor, people on both floors and on the stair over the playback
    const fr3 = fr3s(); await p.waitForTimeout(1500);
    const g = await fr3.evaluate(() => S3._egress()); assert(g.on && g.ghost > 10, 'the building is ghosted: ' + JSON.stringify(g)); assert.equal(g.sheets.length, 2); assert(g.sheets[1] - g.sheets[0] > 3, 'one sheet on each floor: ' + g.sheets);
    const ys = new Set(); for (let i = 0; i < 30; i++) { const st = await fr3.evaluate(() => { const s = window.__ws.egressState(); window.__ws.egressSeek(s.n * Math.random()); return S3._egress(); }); st.ys.forEach((y) => ys.add(y)); }
    assert(ys.size >= 2, 'people on more than one floor: ' + [...ys]); console.log('PASS 3D: the building ghosted, sheets at', g.sheets.join(' and '), 'm, people at heights', [...ys].sort((a, b) => a - b).join(', '));
    // playback controls: pause, scrub, speed; the views switch without running again
    await p.click('.sp-studycard [data-eg=play]'); assert.equal(await fr3.evaluate(() => window.__ws.egressState().playing), false); await p.click('.sp-studycard [data-eg=play]'); assert.equal(await fr3.evaluate(() => window.__ws.egressState().playing), true);
    for (const v of ['time', 'wait', 'density', 'trails']) { await p.click(`.sp-studycard [data-st-view=${v}]`); await p.waitForTimeout(400); assert.equal(await p.evaluate(() => window.__wsStudy.state().res.view), v); }
    assert(await p.locator('.sp-studycard svg.sp-hist polyline').count() >= 11, 'the chart has a curve per run and the run shown');
    console.log('PASS playback: pause and play, the three views, the curve of every run');
    // 2D: the current level's sheet and its people
    await p.click('[data-sp=dim]'); await p.waitForTimeout(1200); const frp = p.frames().find((f) => f.url().includes('ws=plan'));
    const s2 = await frp.evaluate(() => window.__ws.egressState()); assert(s2 && s2.n > 50, '2D plays the same run: ' + JSON.stringify(s2));
    // Save to results; the old page now opens the Workspace
    await p.click('[data-st=save]'); await p.waitForFunction(() => /Saved to results/.test(document.querySelector('.sp-studyres')?.innerText || ''), null, { timeout: 30000 });
    console.log('PASS 2D playback and Save to results');
    await p.goto(base + '/mvp/#/simulations/fire-evacuation'); await p.waitForFunction(() => location.hash.startsWith('#/workspace'), null, { timeout: 30000 });
    console.log('PASS the old Fire Evacuation page opens the Workspace');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
