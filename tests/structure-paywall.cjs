// Structure and Snow behind the paywall (2026-11-24), gate on (pc-dev-gate=1) as on the live site, hospital example:
// unchanged, Structure runs (examples are free while unchanged); with a wall drawn in (an own project), the first click on
// Start already says the study needs monthly access and offers the pricing page, for Structure and for Snow; no silent click.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); localStorage.setItem('pc-dev-gate', '1'); });
    const id = await p.evaluate(async () => (await import('./js/hospital-example.js')).openHospital().id);
    await p.goto(base + '/mvp/#/workspace/' + id); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(3000);
    const start = async (sim) => { await p.evaluate((sim) => window.__wsStudy.open(sim), sim); await p.waitForTimeout(800); await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); };
    // 1 · the example, unchanged: Structure runs
    await start('structure'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 });
    const ok = await p.evaluate(() => ({ err: window.__wsStudy.state().err, res: !!window.__wsStudy.state().res })); assert(ok.res && !ok.err, 'Structure runs on the unchanged example: ' + JSON.stringify(ok));
    console.log('PASS Structure runs on the unchanged hospital example (free while unchanged)');
    await p.evaluate(() => document.querySelector('.sp-studycard [data-st=close]')?.click()); await p.waitForTimeout(500);
    // 2 · a wall drawn in: an own project
    await p.evaluate(() => { const fr = [...document.querySelectorAll('iframe')].find((f) => /ws=plan/.test(f.src)).contentWindow; const M = JSON.parse(fr.__ws.model()); const lv = M.levels[0].id; M.walls.push({ id: 'wQA', lv, a: [-40, -40], b: [-30, -40], t: 0.2, h: 3, object_type: 'wall', layer: 'Wall' }); const s = JSON.stringify(M); fr.__ws.apply(s, false); window.__ws2.hub.change('plan', s, false); });
    await p.waitForTimeout(1500);
    for (const sim of ['structure', 'snow']) {
      await start(sim); await p.waitForTimeout(700);   // the first click, nothing else
      const st = await p.evaluate(() => ({ err: window.__wsStudy.state().err, res: !!window.__wsStudy.state().res, busy: window.__wsStudy.state().busy, text: document.querySelector('.sp-studycard')?.innerText || '', link: !!document.querySelector('.sp-studycard a[href="#/pricing"]') }));
      assert(!st.res && !st.busy && /needs monthly access/i.test(st.err), `${sim}: refused on the first click: ` + JSON.stringify({ err: st.err, res: st.res, busy: st.busy }));
      assert(/needs monthly access/i.test(st.text) && st.link, `${sim}: the card says so and links to monthly access`);
      console.log(`PASS ${sim}: the first click on an own project says "${st.err.slice(0, 70)}…" with a link to monthly access`);
      await p.evaluate(() => document.querySelector('.sp-studycard [data-st=close]')?.click()); await p.waitForTimeout(400);
    }
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
