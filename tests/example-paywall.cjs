// The example projects and the paywall (2026-11-17): every study is free on an example only while its building is the shipped
// one. Opening it in the Workspace keeps it free; drawing a wall into it, or duplicating it, makes it an own project (paid
// studies locked); undoing the change makes it free again. Fallingwater, the hospital and the courtyard sample. Run with the gate
// on (pc-dev-gate=1), as on the live site.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); localStorage.setItem('pc-dev-gate', '1'); });
    const can = (id, sim = 'wind') => p.evaluate(async ([id, sim]) => { const S = await import('./js/store.js'), A = await import('./js/beta-access.js'); const q = S.project(id); return { try: A.isTryProject(q), wind: A.canUse(sim, q), sun: A.canUse('sunhours', q) }; }, [id, sim]);
    // the courtyard sample, untouched
    assert.deepEqual(await can('demo-courtyard'), { try: true, wind: true, sun: true }, 'the sample is free');
    for (const [name, open] of [['Fallingwater', "(await import('./js/fallingwater-dashboard.js')).openCase()"], ['Hospital', "(await import('./js/hospital-example.js')).openHospital()"]]) {
      const id = await p.evaluate(`(async () => { const q = ${open}; return q.id; })()`);
      assert.deepEqual(await can(id), { try: true, wind: true, sun: true }, `${name}: free when made`);
      // open it in the Workspace: still free (loading must not change the building)
      await p.goto(base + '/mvp/#/workspace/' + id); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.waitForTimeout(3000);
      assert.equal((await can(id)).wind, true, `${name}: still free after opening in the Workspace`);
      const tags0 = await p.$$eval('.w2-simmenu [data-addsim]', (bs) => bs.filter((x) => /Monthly access/.test(x.textContent)).length); assert.equal(tags0, 0, `${name}: no study locked in the menu`);
      // draw a wall into it, as the plan pane does
      await p.evaluate(() => { const fr = [...document.querySelectorAll('iframe')].find((f) => /ws=plan/.test(f.src)).contentWindow; const M = JSON.parse(fr.__ws.model()); const lv = M.levels[0].id; M.walls.push({ id: 'wQA', lv, a: [-40, -40], b: [-30, -40], t: 0.2, h: 3, object_type: 'wall', layer: 'Wall' }); const s = JSON.stringify(M); fr.__ws.apply(s, false); window.__ws2.hub.change('plan', s, false); });
      await p.waitForTimeout(1500);
      assert.deepEqual(await can(id), { try: false, wind: false, sun: true }, `${name}: an edited example is an own project`);
      // the study card refuses a paid study
      await p.evaluate(() => window.__wsStudy.open('wind')); await p.waitForTimeout(800); await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await p.waitForTimeout(800);
      const st = await p.evaluate(() => ({ err: window.__wsStudy.state().err, res: !!window.__wsStudy.state().res })); assert(!st.res && /monthly access/i.test(st.err), `${name}: Wind refused: ` + JSON.stringify(st));
      await p.evaluate(() => document.querySelector('.sp-studycard [data-st=close]')?.click());
      // take the wall out again: free again
      await p.evaluate(() => { const fr = [...document.querySelectorAll('iframe')].find((f) => /ws=plan/.test(f.src)).contentWindow; const M = JSON.parse(fr.__ws.model()); M.walls = M.walls.filter((w) => w.id !== 'wQA'); const s = JSON.stringify(M); fr.__ws.apply(s, false); window.__ws2.hub.change('plan', s, false); });
      await p.waitForTimeout(1500); assert.equal((await can(id)).wind, true, `${name}: free again once the building is back`);
      // a duplicate is an own project, and reopening the example opens the original
      const dup = await p.evaluate(async (id) => { const S = await import('./js/store.js'); const q = S.duplicateProject(S.project(id)); return q.id; }, id);
      assert.deepEqual(await can(dup), { try: false, wind: false, sun: true }, `${name}: a duplicate is an own project`);
      assert.equal(await p.evaluate(`(async () => ${open}.id)()`), id, `${name}: the card reopens the original, not the copy`);
      console.log(`PASS ${name}: free when made and after opening; an edited building or a duplicate is locked; free again when restored`);
      await p.goto(base + '/mvp/#/home'); await p.waitForTimeout(800);
    }
    // the sample: change a mass, locked
    const s2 = await p.evaluate(async () => { const S = await import('./js/store.js'), A = await import('./js/beta-access.js'); const q = S.project('demo-courtyard'); const c = q.draft.components.find((x) => x.g && x.type !== 'terrain'); c.g.w += 5; S.save(); return A.canUse('wind', q); });
    assert.equal(s2, false, 'the sample, edited, is locked'); console.log('PASS the courtyard sample: free as shipped, locked when its building changes');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
