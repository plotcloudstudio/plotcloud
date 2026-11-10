// Simulation quality and the run at the top (2026-11-09). Above Add simulation, a small slider from Draft to Refined sets the
// grids of every study (Standard and Refined make the automatic grids 1.5 and 2 times finer; the interior studies take their
// Standard and Fine detail); a click opens its card with the open study's time at each quality and the grids to set by hand.
// The interior studies' own Draft / Standard / Fine tabs are gone. While a study runs, the top shows the time left and when it
// should finish; then that it finished. Sun hours follows Ladybug's timestep for the quality (Refined: 12, every 5 minutes).
// Needs network access (site data).
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    await p.goto(base + '/mvp/#/new-project'); await p.waitForFunction(() => window.__newProjectMap, null, { timeout: 30000 });
    await p.evaluate(() => window.__newProjectMap.place(49.2448, -123.0071, 'QA quality block')); await p.waitForFunction(() => window.__newProjectMap.osm, null, { timeout: 120000 });
    await p.click('#npStart'); await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 180000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    await p.evaluate(() => { const ws = __ws2.inst.plan.ws, M = JSON.parse(ws.model()), c = M.site?.at || [0, 0], X = c[0] - 8, Y = c[1] - 5, id = (k) => k + Math.random().toString(36).slice(2, 8);
      const W = (a, b2) => { const w = { id: id('w'), lv: 'L1', a: [X + a[0], Y + a[1]], b: [X + b2[0], Y + b2[1]], t: 0.2, h: 3 }; M.walls.push(w); return w; };
      const s0 = W([0, 0], [16, 0]); W([16, 0], [16, 10]); const n0 = W([16, 10], [0, 10]); W([0, 10], [0, 0]); W([8, 0], [8, 10]);
      for (const [w, pos] of [[s0, 4], [s0, 12], [n0, 4], [n0, 12]]) M.ops.push({ id: id('o'), wall: w.id, pos, w: 2, kind: 'win', object_type: 'window', sill: 0.9, head: 2.4, open: 0.5 });
      M.names.push({ lv: 'L1', x: X + 4, y: Y + 5, name: 'West room' }, { lv: 'L1', x: X + 12, y: Y + 5, name: 'East room' });
      const snap = JSON.stringify(M); ws.apply(snap, false); __ws2.hub.change('plan', snap, false); }); await p.waitForTimeout(2500);
    const cond = () => p.evaluate(async () => { const S = await import('./js/store.js'); const pid = location.hash.split('/')[2], pr = S.project(pid); return S.conditionsOf(pr).defaults; });

    // 1 · the slider sits in the gap above Add simulation, Draft by default
    const q = await p.locator('.sp-q').boundingBox(), add = await p.locator('.sp-add').boundingBox(), left = await p.locator('.sp-left').boundingBox();
    assert(q.y + q.height <= add.y - 2 && q.y >= left.y + left.height + 2, 'between the panels and Add simulation: ' + JSON.stringify([left, q, add]));
    assert(Math.abs(q.x - add.x) < 2 && Math.abs(q.width - add.width) < 2, 'as wide as the rail below');
    assert.equal(await p.getAttribute('.sp-q', 'aria-valuetext'), 'Draft');
    console.log('PASS slider above Add simulation, Draft:', JSON.stringify({ q: [q.x, q.y, q.width, q.height], add: [add.x, add.y] }));

    // 2 · Daylight: no Draft / Standard / Fine tabs in its panel; its estimate names the quality
    await p.click('#addSimInt'); await p.click('.w2-simmenu [data-addsim="daylight"]'); await p.waitForTimeout(2500);
    let card = await p.locator('.sp-studycard').innerText();
    assert.equal(await p.locator('.sp-studycard [data-st-set^="dlLevel"]').count(), 0, 'the level tabs are gone'); assert.doesNotMatch(card, /change the level in the Level menu/);
    assert.match(card, /Draft · estimated time: ~\d/); console.log('PASS Daylight panel cleaned:', card.match(/Draft · estimated time[^.]*/)[0]);

    // 3 · the card: Daylight's time at each quality, longer as it gets finer
    await p.click('.sp-q'); await p.waitForTimeout(800); let pop = await p.locator('.sp-pop-q').innerText();
    assert.match(pop, /Simulation quality[\s\S]*Draft[\s\S]*Standard[\s\S]*Refined/); assert.match(pop, /Daylight[\s\S]*at each quality/i);
    const tl = await p.$$eval('.sp-pop-q .sp-kv b', (bs) => bs.map((x) => x.textContent)); assert.equal(tl.length, 3, JSON.stringify(tl));
    const secs = (t) => (/a second/.test(t) ? 1 : /hour/.test(t) ? 3600 : (/min/.test(t) ? 60 : 1) * parseFloat(t.replace(/[^\d.]/g, '')));
    await p.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/quality-card.png' : '/dev/null' }).catch(() => {}); 
    assert(secs(tl[0]) < secs(tl[2]), 'Refined takes longer: ' + tl); console.log('PASS the card: Daylight', tl.join(' · '));

    // 4 · slide right to Refined: saved with the project, the warning, the panel follows
    if (!(await p.locator('.sp-pop-q').isHidden())) await p.click('.sp-q'); await p.waitForTimeout(300); assert(await p.locator('.sp-pop-q').isHidden(), 'a second click closes the card');
    const qb = await p.locator('.sp-q').boundingBox(); await p.mouse.move(qb.x + qb.width / 2 - 12, qb.y + qb.height / 2); await p.mouse.down(); await p.mouse.move(qb.x + qb.width / 2 + 4, qb.y + qb.height / 2, { steps: 4 }); await p.mouse.move(qb.x + qb.width - 4, qb.y + qb.height / 2, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(800);
    assert.equal(await p.getAttribute('.sp-q', 'aria-valuetext'), 'Refined'); assert.equal((await cond()).quality, 'refined', 'kept with the project conditions');
    assert(await p.locator('.sp-pop-q').isHidden(), 'a slide does not open the card');
    card = await p.locator('.sp-studycard').innerText(); assert.match(card, /Refined · estimated time/);
    await p.click('.sp-q'); await p.waitForTimeout(600); pop = await p.locator('.sp-pop-q').innerText(); assert.match(pop, /Takes longer than Draft[\s\S]*leave it running/);
    console.log('PASS slid to Refined: saved, warned, the panel follows');

    // 5 · keyboard back to Draft; a ground grid set by hand is kept as Custom
    await p.focus('.sp-q'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(300); assert.equal(await p.getAttribute('.sp-q', 'aria-valuetext'), 'Standard'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(300); assert.equal(await p.getAttribute('.sp-q', 'aria-valuetext'), 'Draft');
    if (await p.locator('.sp-pop-q').isHidden()) await p.click('.sp-q');
    await p.selectOption('.sp-pop-q [data-qset=grid]', '2'); await p.waitForTimeout(500); assert.equal((await cond()).grid, '2'); assert.match(await p.locator('.sp-pop-q').innerText(), /Custom grids are set/);
    await p.selectOption('.sp-pop-q [data-qset=grid]', 'Auto'); await p.waitForTimeout(400);
    console.log('PASS keyboard and a grid set by hand');

    // 6 · Sun hours: estimate at the quality; finer grids at Refined; the run at the top, then done; the tab title
    await p.keyboard.press('Escape'); await p.click('.sp-studycard [data-st=close]').catch(() => {}); await p.waitForTimeout(500);
    await p.click('#addSimBtn'); await p.click('.w2-simmenu [data-addsim="sunhours"]'); await p.waitForTimeout(2500);
    card = await p.locator('.sp-studycard').innerText(); assert.match(card, /Draft · estimated time/);
    const cells = async () => { const t = await p.locator('.sp-studycard').innerText(); const m = /ground ([\d,]+) cells at ([\d.]+) m/.exec(t); return m ? [+m[1].replace(/,/g, ''), +m[2]] : null; };
    const c0 = await cells(); await p.focus('.sp-q'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(800); const c2 = await cells();
    assert(c0 && c2 && c2[1] < c0[1] && c2[0] > c0[0] * 2.5, 'Refined: a finer ground grid, more cells: ' + JSON.stringify([c0, c2]));
    const title0 = await p.title(); await p.click('[data-st=run]');
    await p.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/quality-run.png' : '/dev/null' }).catch(() => {}); 
    const bar = await p.evaluate(() => { const e = document.querySelector('.sp-runbar'); return e && !e.hidden ? { state: e.dataset.state, text: e.innerText, title: document.title } : null; });
    // a quick run can finish before the check looks: then the bar already says it finished
    assert(bar && /Sun Hours|Sun hours/i.test(bar.text) && /Refined/.test(bar.text) && ((bar.state === 'run' && /left · done around \d/.test(bar.text)) || (bar.state === 'done' && /finished at \d/.test(bar.text))), 'the run at the top: ' + JSON.stringify(bar));
    await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 180000 });
    const meth = await p.evaluate(() => window.__wsStudy.state().res?.method || ''); assert.match(meth, /Ladybug’s Direct Sun Hours method[\s\S]*every 5 minutes \(timestep 12\)[\s\S]*0\.1 m above the ground/, 'Refined: Ladybug timestep 12: ' + meth);
    const done = await p.evaluate(() => { const e = document.querySelector('.sp-runbar'); return { state: e.dataset.state, text: e.innerText, hidden: e.hidden, title: document.title }; });
    assert(!done.hidden && done.state === 'done' && /finished at \d/.test(done.text) && /took/.test(done.text), 'then done: ' + JSON.stringify(done));
    await p.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/quality-done.png' : '/dev/null' }).catch(() => {}); 
    await p.waitForTimeout(9000); assert(!(await p.locator('.sp-runbar').isHidden()), 'the finished run stays at the top until closed (whoever stepped away sees it)');
    assert.match(done.title, /✓ .* done — PlotCloud/); await p.click('.sp-runbar .sp-x'); assert.equal(await p.title(), title0, 'the title comes back');
    console.log('PASS run at the top:', bar.text.replace(/\s+/g, ' ').slice(0, 120), '→', done.text.replace(/\s+/g, ' '));
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
