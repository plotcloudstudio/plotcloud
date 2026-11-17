// The Fallingwater example to the HABS record (2026-11-16): the main house's three levels and the roof over the study level, every room
// named as the sheets label it (no "Room n"), the fittings the plan sheets draw (beds, baths, the kitchen, Wright's built-ins), the stair
// from the bedroom level to the study level through an opening in the slab; then every study in Add simulation runs on it without an
// error and returns a result. Writes a screenshot of each study for the research report (SHOT_DIR). Needs network access (project weather).
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || require('os').tmpdir();
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); localStorage.setItem('pc-unfold', '1'); });
    // 1 · the card on the projects page opens the example in the Workspace
    await p.goto(base + '/mvp/#/home'); await p.waitForSelector('[data-fallingwater]', { timeout: 30000 }); await p.click('.ph-thumb[data-fallingwater]');
    await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(2500);
    // 2 · the model, as the browser analyses it
    const m = await p.evaluate(() => { const B = __ws2.inst.persp.ws.buildingScene(), M = JSON.parse(__ws2.inst.plan.ws.model()); const rooms = B.levels.flatMap((l) => l.sc.rooms.map((r) => l.id + ':' + r.name));
      return { levels: M.levels.map((l) => l.id), rooms, numbered: rooms.filter((r) => /:Room \d/.test(r)), furn: M.furn.length, types: [...new Set(M.furn.map((f) => f.type))].sort(), voids: (M.voids || []).map((v) => v.lv + ':' + v.kind), roofSlabs: M.floors.filter((f) => f.lv === 'RF').length,
        kettle: !!M.imports.find((i) => /Kettle/.test(i.name)), glazing: M.walls.filter((w) => w.sourceLayer === 'Glazing' || w.layer === 'Glazing').length }; });
    assert.deepEqual(m.levels, ['L1', 'L2', 'L3', 'RF', 'G1'], 'the main house, its roof and the guest house: ' + m.levels);
    assert.deepEqual(m.numbered, [], 'every room named as the sheets label it: ' + m.numbered); assert(m.rooms.length >= 12, 'rooms: ' + m.rooms.length);
    for (const n of ['L1:Living room', 'L1:Kitchen', 'L2:Dressing room', 'L2:Master bedroom', 'L2:Guest bedroom', 'L2:Master bath', 'L3:Study and gallery']) assert(m.rooms.includes(n), n);
    assert(m.furn >= 38, 'the fittings the sheets draw: ' + m.furn); for (const t of ['bed', 'bathtub', 'toilet', 'vanity', 'shower', 'fridge', 'range', 'chair', 'dining']) assert(m.types.includes(t), t);
    assert.equal(m.roofSlabs, 2, 'the roof over the study level'); assert(m.voids.includes('L2:shaft'), 'the opening above the stair to the study level: ' + m.voids); assert(m.glazing >= 15, 'glass walls on the Glazing layer: ' + m.glazing);
    console.log('PASS the model:', JSON.stringify({ levels: m.levels, rooms: m.rooms.length, furn: m.furn, roofSlabs: m.roofSlabs, voids: m.voids }));
    await p.screenshot({ path: `${out}/fallingwater-model.png`, timeout: 90000 }).catch(() => {});
    // 3 · every study in Add simulation, on the bedroom level (seven rooms; the Workspace opens the example on the study level, which has one)
    await p.evaluate(() => { for (const r of ['plan', 'persp']) __ws2.inst[r].ready && __ws2.inst[r].ws.level('L2'); }); await p.waitForTimeout(1500);
    await p.click('#addSimBtn'); await p.waitForTimeout(300); const list = await p.$$eval('.w2-simmenu:not([hidden]) [data-addsim]', (bs) => bs.map((x) => [x.dataset.addsim, x.textContent.trim().replace(/\s+/g, ' ')]).filter(([, t]) => !/Coming soon/.test(t))); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    assert(list.length >= 20, 'the studies: ' + list.length); const res = [], results = {};
    for (const [id, label] of list) { await p.click('.sp-studycard [data-st=close]', { timeout: 1500 }).catch(() => {}); await p.waitForTimeout(250); await p.evaluate((i) => window.__wsStudy.open(i), id); await p.waitForTimeout(2000);
      if (id === 'fire-evacuation') await p.click('.sp-studycard [data-st-mode=down]').catch(() => {});
      const t0 = Date.now(); await p.click('.sp-studycard [data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 420000 });
      const r = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, row: s.res?.rows?.[0], rows: s.res?.rows || [], kpis: s.res?.kpis || null }; });
      const dt = Math.round((Date.now() - t0) / 1000);
      // Solar Envelope needs neighbours to protect; Fallingwater has none, and the study says so instead of inventing a limit
      if (id === 'solarenvelope' && /no surrounding buildings/.test(r.err)) { res.push(`${label}: not applicable (${r.err})`); results[id] = { label, na: r.err, rows: [], seconds: dt }; continue; }
      assert.equal(r.err, '', `${label}: ${r.err}`); assert(r.row, `${label}: no result row`);
      res.push(`${label}: ${r.row.join(' ')} (${dt} s)`); results[id] = { label, rows: r.rows, seconds: dt };
      await p.waitForTimeout(600); await p.screenshot({ path: `${out}/fallingwater-${id}.png`, timeout: 90000 }).catch(() => {}); }
    require('fs').writeFileSync(`${out}/fallingwater-results.json`, JSON.stringify(results, null, 1));
    console.log('PASS every study runs on the example:\n  ' + res.join('\n  '));
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
