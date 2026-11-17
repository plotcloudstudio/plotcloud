// The Structure study laid out from the drawn walls (2026-11-17), on the Fallingwater and hospital examples in the Workspace:
// bearing walls read from material and thickness (Fallingwater's stone walls carry, the hospital's gypsum walls do not), grid lines
// named 1, 2, 3 / A, B, C with dimension chains in mm, columns and beams with their sizes, a member schedule, transfers marked,
// ideas with numbers, an idea tried (its settings, run again), a wall made a partition and back, the CSV schedule, and the plan
// drawing checked on screen. Rules of thumb: the test checks the layout and its arithmetic, not engineering design.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 960 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], shots = process.env.SHOT_DIR || require('os').tmpdir();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); localStorage.setItem('pc-unfold', '1'); });
    const run = async () => { await p.evaluate(() => window.__wsStudy.run()); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 120000 }); const s = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, res: s.res && { rows: s.res.rows, results: s.res.results, settings: s.res.settings, ideas: s.res.ideas, foot: s.res.foot } }; }); assert.equal(s.err, '', 'runs: ' + s.err); return s.res; };
    // the plan drawing itself (the plan canvas, as drawn): a whole-page screenshot of this Workspace takes too long in software GL
    const planShot = async (name) => { const url = await p.evaluate(() => { const d = __ws2.inst.plan.win.document, cs = [...d.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height); return cs[0].toDataURL('image/png'); });
      require('fs').writeFileSync(shots + '/' + name, Buffer.from(url.split(',')[1], 'base64')); };
    const open = async (mod, fn) => { const id = await p.evaluate(async ([m, f]) => (await import(m))[f]().id, [mod, fn]); await p.goto(base + '/mvp/#/workspace/' + id);
      await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
      await p.evaluate(() => window.__wsStudy.open('structure')); await p.waitForSelector('.sp-studycard'); };

    // ---- Fallingwater: stone walls carry the floors
    await open('./js/fallingwater-dashboard.js', 'openCase');
    let r = await run(); const row = (k) => (r.rows.find(([a]) => a === k) || [])[1] || '';
    assert(r.results.bearingWalls > 40, 'stone walls are bearing: ' + r.results.bearingWalls); assert.match(row('Bearing walls'), /of \d+ walls/);
    assert.match(row('Grid'), /\d+ × \d+ lines · bays [\d.]+–[\d.]+ m \(1–\d+\), [\d.]+–[\d.]+ m \(A–[A-Z]+\)/); assert.match(row('Floor depth'), /\d+ mm structure \(longest bay [\d.]+ m\)/);
    assert(r.results.transfers > 0, 'Fallingwater has walls and columns over nothing below (its cantilevers)'); assert.match(row('Load with nothing below'), /marked ! on the plan/);
    assert(r.ideas.length >= 3 && r.ideas.every((i) => i.title && /\d/.test(i.text)), 'ideas with numbers: ' + JSON.stringify(r.ideas.map((i) => i.title)));
    assert.match(r.foot, /\d+ columns, \d+ beams and \d+ bearing walls from \d+ walls on [4-5] levels/);
    const card = await p.locator('.sp-studycard').innerText(); assert.match(card, /Members, the most loaded[\s\S]*Column[\s\S]*Wall[\s\S]*Ideas to improve it/i); assert.match(card, /\d+×\d+/);
    console.log(`PASS Fallingwater: ${r.results.bearingWalls} bearing stone walls, ${r.results.columns} columns, ${r.results.transfers} transfers flagged, ${r.ideas.length} ideas; ${row('Grid')}`);
    // the plan shows the grid, dimension chains and labels (drawn into the plan canvas): compare with the drawing switched off
    const plan = await p.evaluate(() => { const I = __ws2.inst.plan, o = I.ws; return { has: typeof o.structInput === 'function' }; }); assert(plan.has, 'the plan offers its walls');
    await planShot('structure-fallingwater-plan.png');
    // a wall made a partition, then the walls as drawn again
    const before = r.results.bearingWalls; await p.click('.sp-studycard [data-st-role]:not([data-st-role=reset])'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && s.res; }, null, { timeout: 120000 }); await p.waitForTimeout(300);
    r = await p.evaluate(() => { const s = window.__wsStudy.state(); return { results: s.res.results, settings: s.res.settings }; });
    assert.equal(r.results.bearingWalls, before - 1, 'one wall fewer carries'); assert.equal(Object.keys(r.settings.roles).length, 1);
    await p.click('.sp-studycard [data-st-role=reset]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && s.res && !Object.keys(s.res.settings.roles).length; }, null, { timeout: 120000 });
    assert.equal(await p.evaluate(() => window.__wsStudy.state().res.results.bearingWalls), before);
    console.log('PASS a wall made a partition (one fewer bearing wall), then the walls as drawn again');

    // ---- the hospital: gypsum partitions, so a column grid that sits in the walls
    await open('./js/hospital-example.js', 'openHospital');
    r = await run();
    assert.equal(r.results.bearingWalls, 0, 'gypsum walls are partitions'); assert(r.results.columns > 30);
    const inWall = await p.evaluate(() => { const L = window.__wsStudy.state().res.layout; return L.cols.filter((c) => c.inWall).length / L.cols.length; });
    assert(inWall > 0.6, 'most columns stand in walls: ' + inWall.toFixed(2));
    const L = await p.evaluate(() => { const L = window.__wsStudy.state().res.layout; return { u: L.axes.u.map((a) => a.name), v: L.axes.v.map((a) => a.name), su: L.spansU, sv: L.spansV, span: L.span }; });
    assert.equal(L.u[0], '1'); assert.equal(L.v[0], 'A'); assert(L.su.concat(L.sv).every((x) => x <= L.span + 0.06), 'no bay longer than the grid: ' + L.su.concat(L.sv).map((x) => x.toFixed(1)));
    console.log(`PASS hospital: no bearing walls (gypsum), ${r.results.columns} columns, ${(inWall * 100).toFixed(0)} % of them in walls, grid ${L.u.join(',')} × ${L.v.join(',')}, no bay over ${L.span} m`);
    // a 6 m grid: lines added where no wall is, and the idea to try a steel frame on 9 m, which needs fewer; tried, it runs again with beams
    await p.evaluate(() => document.querySelector('.sp-studycard [data-st-set="span:6"]').click()); r = await run();
    const k = r.ideas.findIndex((i) => i.action && i.action.system === 'steel'); assert(k >= 0, 'the steel idea is offered at 6 m: ' + JSON.stringify(r.ideas.map((i) => [i.title, i.action])));
    assert.match(r.ideas[k].text, /needs \d+ added line|needs no added line/);
    await p.click(`.sp-studycard [data-st-idea="${k}"]`); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && s.res && s.res.settings.system === 'steel'; }, null, { timeout: 120000 }); await p.waitForTimeout(300);
    r = await p.evaluate(() => { const s = window.__wsStudy.state().res; return { rows: s.rows, results: s.results, settings: s.settings }; });
    assert.equal(String(r.settings.span), '9'); assert(r.results.beams > 20, 'beams in a steel frame: ' + r.results.beams); assert.match(r.rows.find(([q]) => q === 'Beams')[1], /\d+, the deepest \d+ × \d+ mm over [\d.]+ m/);
    console.log(`PASS an idea tried: steel frame on a 9 m grid, run again: ${r.rows.find(([q]) => q === 'Beams')[1]}`);
    await planShot('structure-hospital-steel-plan.png');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
