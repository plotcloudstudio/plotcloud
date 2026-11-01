// Results on the building in every building study (2026-11-01): a mass is drawn on the site, then Solar radiation, Sky exposure,
// Shade benefit, Solar envelope, Outdoor comfort and Stormwater each run in the Workspace and must give values on the building's
// facades and roofs (painted like Sun hours), with facade/roof rows on the results card. Needs network access like workspace-in-view.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message));
    const base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    await p.goto(base + '/mvp/#/new-project'); await p.waitForFunction(() => window.__newProjectMap, null, { timeout: 30000 });
    await p.evaluate(() => window.__newProjectMap.place(49.2448, -123.0071, 'QA site')); await p.waitForFunction(() => window.__newProjectMap.osm, null, { timeout: 120000 });
    await p.click('#npStart'); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 180000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click());
    await p.evaluate(() => window.__ws2.inst.plan.win.__mass.addMass([[-12, -9], [12, -9], [12, 9], [-12, 9]]));
    await p.waitForFunction(() => (window.__ws2.inst.persp.win.__st?.M.masses || []).length > 0, null, { timeout: 30000 });
    // an imported tower (a triangle mesh, as from an OBJ or 3DM file) beside the mass: the results must reach it too
    await p.evaluate(() => { const box = (W, D, H) => { const v = [[0, 0, 0], [W, 0, 0], [W, D, 0], [0, D, 0], [0, 0, H], [W, 0, H], [W, D, H], [0, D, H]], f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
        return new Float32Array(f.flatMap((t) => t.flatMap((i) => v[i]))); };
      window.__ws2.inst.persp.ws.addImports([{ id: 'imp_qa_tower', name: 'QA tower', layer: 'Imported', mesh: box(16, 14, 36), g: { x: 30, y: -7, z: 0, w: 16, d: 14, h: 36 } }]); });
    await p.waitForTimeout(800);
    const impN = await p.evaluate(() => { const w = __ws2.inst.persp.ws; w.surfaceSamples(); return w.surfaceList().filter((x, i) => x).length; });
    for (const [id, views] of [['radiation', ['kwh', 'share']], ['skyview', ['sky', 'low']], ['shadebenefit', []], ['solarenvelope', []], ['utci', ['comfort', 'heat']], ['stormwater', ['map', 'flow', 'pond', 'runoff']], ['wind', ['comfort', 'risk', 'speedup']]]) {
      await p.click('#addSimBtn'); await p.click(`.w2-simmenu [data-addsim=${id}]`); await p.click('[data-st=run]');
      await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 });
      const r = await p.evaluate(() => { const s = window.__wsStudy.state(), sv = s.res?.svals ? Array.from(s.res.svals) : [], vw = {}; for (const [k, v] of Object.entries(s.res?.views || {})) vw[k] = v.svals ? Array.from(v.svals).filter(Number.isFinite).length : 0;
        const sl = __ws2.inst.persp.ws.surfaceList(), onImp = sl.map((S0, i) => (S0.p[0] > 29 && !S0.roof ? sv[i] : null)).filter((v) => v !== null);
        return { imp: onImp.length, impFin: onImp.filter(Number.isFinite).length, err: s.err, n: sv.length, fin: sv.filter(Number.isFinite).length, lo: Math.min(...sv.filter(Number.isFinite)), hi: Math.max(...sv.filter(Number.isFinite)), rows: (s.res?.rows || []).map((x) => x.join(': ')), ms: s.res?.ms, vw }; });
      assert(!r.err, id + ' ' + r.err); assert(r.fin > 20, `${id}: values on the building ${JSON.stringify(r)}`);
      assert(r.impFin > 10, `${id}: values on the imported tower's facades ${r.impFin} of ${r.imp}`);
      for (const k of views) assert(r.vw[k] > 20, `${id}: the ${k} view paints the building too ${JSON.stringify(r.vw)}`);
      if (['radiation', 'skyview'].includes(id)) assert(r.rows.some((x) => /^Facades, mean/.test(x)) && r.rows.some((x) => /^Roofs, mean/.test(x)), id + ' rows ' + r.rows);
      assert.equal(await p.locator('.sp-legend').isVisible(), true);
      console.log(`PASS ${id}: imported tower ${r.impFin} of ${r.imp} facade squares; ${r.fin} of ${r.n} building squares with values (${r.lo.toFixed(2)}–${r.hi.toFixed(2)}), ${r.ms} ms; ${r.rows.filter((x) => /Facade|Roof|Building|building|facade/.test(x)).join(' | ')}`);
      if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/surf-${id}.png` }); }
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
