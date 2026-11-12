// The hospital example (2026-11-10): a generic three-storey inpatient building made to demonstrate every study. From its card on
// the projects page it opens in the Workspace; the model is checked (levels, single patient rooms with beds, the two exit stairs,
// two smoke compartments on each inpatient floor); then every study in Add simulation runs on it without an error, Fire Evacuation
// in its hospital mode (horizontal relocation, then down and out). Needs network access (the project weather).
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || require('os').tmpdir();
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    // 1 · the card on the projects page, next to Fallingwater
    await p.goto(base + '/mvp/#/home'); await p.waitForSelector('[data-hospital]', { timeout: 30000 });
    const card = await p.locator('.ph-example:has([data-hospital])').innerText(); assert.match(card, /Hospital · inpatient building[\s\S]*52 single rooms[\s\S]*Fire evacuation/);
    await p.waitForFunction(() => { const im = document.querySelector('[data-hospital] img'); return im && im.complete && im.naturalWidth >= 640; }, null, { timeout: 30000 }).catch(() => {});
    assert(await p.evaluate(() => { const im = document.querySelector('[data-hospital] img'); return im && im.complete && im.naturalWidth >= 640; }), 'the cover picture loads');
    await p.click('.ph-thumb[data-hospital]'); await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(2500);
    // 2 · the model
    const m = await p.evaluate(() => { const B = __ws2.inst.persp.ws.buildingScene(), M = JSON.parse(__ws2.inst.plan.ws.model()); return { levels: B.levels.map((l) => [l.id, l.sc.rooms.length, l.sc.rooms.filter((r) => /^Room \d/.test(r.name)).length]), stairs: B.stairs.map((s) => [s.lv, s.top]), beds: M.furn.filter((f) => /bed/i.test(f.name)).length, single: M.names.filter((n) => /^(Patient|Isolation) room/.test(n.name)).length, sinks: M.furn.filter((f) => f.name === 'Hand-hygiene sink').length, ctx: (M.site?.buildings || []).length, water: (M.site?.areas || []).some((a) => a.kind === 'water') }; });
    assert.equal(m.beds, 52); assert.equal(m.single, 52, 'one bed in every patient room'); assert.equal(m.sinks, 52, 'a hand-hygiene sink in every patient room'); assert.deepEqual(m.stairs.length, 4);
    assert(m.levels.slice(0, 3).every((l) => l[1] > 40 && l[2] === 0), 'every room named: ' + JSON.stringify(m.levels)); assert(m.ctx >= 5 && m.water, 'neighbours and water on the site');
    console.log('PASS the example:', JSON.stringify(m));
    // 3 · every study in Add simulation (not the ones coming soon)
    await p.click('#addSimBtn'); await p.waitForTimeout(300); const list = await p.$$eval('.w2-simmenu:not([hidden]) [data-addsim]', (bs) => bs.map((x) => [x.dataset.addsim, x.textContent.trim().replace(/\s+/g, ' ')]).filter(([, t]) => !/Coming soon/.test(t))); await p.keyboard.press('Escape'); await p.mouse.click(800, 880); await p.waitForTimeout(300);
    assert(list.length >= 20 && !list.some(([i]) => i === 'movementdepth'), 'the studies: ' + list.length); const res = [];
    for (const [id, label] of list) { await p.click('.sp-studycard [data-st=close]', { timeout: 1500 }).catch(() => {}); await p.waitForTimeout(250); await p.evaluate((i) => window.__wsStudy.open(i), id); await p.waitForTimeout(2000);
      if (id === 'fire-evacuation') await p.click('.sp-studycard [data-st-mode=down]');
      const t0 = Date.now(); await p.click('.sp-studycard [data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 420000 });
      const r = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, row: s.res?.rows?.[0], rows: s.res?.rows || [] }; });
      if (id === 'fire-evacuation') { const sc = r.rows.find((x) => x[0] === 'Smoke compartments'); assert(sc && /Inpatient unit 2 2 · Level 3 · Inpatient unit 3 2/.test(sc[1]), 'two smoke compartments on each inpatient floor: ' + JSON.stringify(sc)); } assert.equal(r.err, '', `${label}: ${r.err}`); assert(r.row, label + ': a result');
      res.push(`${label}: ${r.row.join(' ')} (${Math.round((Date.now() - t0) / 1000)} s)`); if (['fire-evacuation', 'acoustics', 'daylight', 'wind'].includes(id)) await p.screenshot({ path: `${out}/hospital-${id}.png` }).catch(() => {}); }
    console.log('PASS every study runs on the example:\n  ' + res.join('\n  '));
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
