// Compare versions checks its baseline, and saved results say how they were made (2026-11-27), hospital example at 1440×900:
// Sun hours saved on version A at one quality and on version B at another; Compare versions gives a "Conditions vs" row per study:
// the newest saved result is the baseline, the other a scenario whose quality differs (compare-metrics.js comparability); the CSV
// carries that row; the Results page shows each result's build, quality and level; the Dashboard's import names every format read.
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], out = process.env.SHOT_DIR || '/tmp';
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'plan' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    const id = await p.evaluate(async () => (await import('./js/hospital-example.js')).openHospital().id); await p.goto(base + '/mvp/#/workspace/' + id);
    await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    const idle = () => p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 600000 });
    const runSave = async () => { await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await idle(); await p.waitForTimeout(500); const e = await p.evaluate(() => window.__wsStudy.state().err); assert(!e, 'study error: ' + e);
      await p.evaluate(() => document.querySelector('.sp-studyres [data-st=save]')?.click()); await p.waitForTimeout(800);
      if (await p.evaluate(() => /Save as version v\d+\?/.test(document.querySelector('.sp-studyres')?.innerText || ''))) await p.evaluate(() => document.querySelector('.sp-studyres [data-st=save]')?.click());
      await p.waitForFunction(() => window.__wsStudy.state().saved, null, { timeout: 60000 }); };
    const quality = () => p.evaluate(async (id) => { const S = await import('./js/store.js'); return S.conditionsOf(S.project(id)).defaults?.quality || 'draft'; }, id);
    await p.evaluate(() => window.__wsStudy.open('sunhours')); await p.waitForTimeout(800);
    const q0 = await quality(); await runSave();
    // version B at another quality
    // a change to the model: a 9 × 6 m room drawn in the plan, as tests/review-fixes.cjs draws it
    const fr = p.frames().find((f) => f.url().includes('ws=plan')), box = await p.locator('iframe[src*="ws=plan"]').boundingBox();
    const scr = async (q) => { const s2 = await fr.evaluate((q) => window.__ws.screenOf(q), q), c = await fr.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top]; }); return [box.x + s2[0] - c[0], box.y + s2[1] - c[1]]; };
    await fr.evaluate(() => { window.__ws.camSet({ cx: 0, cy: 0, span: 30 }); window.__ws.tool({ tool: 'room' }); }); await p.waitForTimeout(400);
    { const a = await scr([0, 0]), c = await scr([5, 3]); await p.mouse.move(...a); await p.mouse.down(); await p.mouse.move(...c, { steps: 6 }); await p.keyboard.type('9000,6000'); await p.keyboard.press('Enter'); await p.waitForTimeout(300); await p.mouse.up(); await p.waitForTimeout(1200); }
    await fr.evaluate(() => window.__ws.tool({ tool: 'select' })); await p.keyboard.press('Escape'); await p.waitForTimeout(800);
    await p.focus('[data-sp=q]'); await p.keyboard.press(q0 === 'refined' ? 'ArrowLeft' : 'ArrowRight'); await p.waitForTimeout(400); const q1 = await quality(); assert.notEqual(q1, q0, 'quality changed');
    await p.evaluate(() => window.__wsStudy.open('sunhours')); await p.waitForTimeout(800); await runSave();
    const saved = await p.evaluate(async (id) => { const S = await import('./js/store.js'); return S.project(id).runs.filter((r) => r.simId === 'sunhours').map((r) => ({ v: r.versionId, build: r.recipe?.version, q: r.settings.quality, lv: r.settings.levelName })); }, id);
    assert(saved.length >= 2 && saved.every((r) => r.build && r.build !== 'unrecorded' && r.q), 'saved results record build and quality: ' + JSON.stringify(saved)); assert.notEqual(saved.at(-1).v, saved.at(-2).v, 'on two versions');
    console.log(`PASS two Sun hours results saved, on two versions, ${q0} then ${q1}; each records its build (${saved.at(-1).build}) and quality`);
    // Compare versions: the conditions row
    await p.click('[data-sp="saved"]'); await p.waitForSelector('.sp-sheet:not([hidden])', { timeout: 10000 }); await p.waitForTimeout(800);
    const row = await p.evaluate(() => { const r = [...document.querySelectorAll('.sp-sheet .sp-sk-basis')].find((x) => /Sun hours · Conditions vs/.test(x.innerText)); return r ? { lab: r.querySelector('.sp-sk-lab').innerText, cells: [...r.querySelectorAll('[data-cmp-basis]')].map((c) => [c.dataset.cmpBasis, c.innerText]) } : null; });
    assert(row, 'a Sun hours conditions row'); const kinds = row.cells.map((c) => c[0]);
    assert(kinds.includes('baseline') && kinds.includes('scenario'), 'baseline and scenario: ' + JSON.stringify(row)); assert(row.cells.some(([k, t]) => k === 'scenario' && /quality/.test(t)), 'the scenario says the quality differs: ' + JSON.stringify(row));
    await p.screenshot({ path: out + '/compare-baseline.png' });
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.sp-sheet [data-cmp=csv]')]); const f = out + '/' + dl.suggestedFilename(); await dl.saveAs(f); const csv = fs.readFileSync(f, 'utf8');
    assert(/Sun hours · Conditions vs/.test(csv) && /scenario: [^"]*quality/.test(csv), 'the CSV carries the conditions row');
    console.log(`PASS Compare versions: "${row.lab.replace(/^[○●]/, '').trim()}" → ${row.cells.map((c) => c[1]).join(' | ')}; the CSV carries it`);
    // Results page: how each was made
    await p.goto(base + '/mvp/#/results?project=' + id); await p.waitForSelector('[data-card="sunhours"]', { timeout: 60000 });
    const made = await p.locator('[data-card="sunhours"] [data-made-with]').innerText(); assert.match(made, /^build \S+ · \w+ quality/, 'the Results card: ' + made);
    console.log(`PASS the Results card says how the result was made: "${made}"`);
    // the import formats named where an import starts, and no claim of SketchUp or IFC files being read elsewhere
    const src = await p.evaluate(async () => ({ dash: await (await fetch('./js/pages/dashboard.js')).text(), vp: await (await fetch('./js/viewport.js')).text() }));
    assert(/\.gltf or Rhino \.3dm/.test(src.dash), 'the Dashboard names .gltf and .3dm'); assert(!/open in the full tools/.test(src.vp) && /SketchUp and IFC files are not read/.test(src.vp), 'no claim that SketchUp or IFC open elsewhere');
    console.log('PASS the Dashboard names every format read; a file that cannot be read is told to export OBJ or glTF, with no claim of another tool');
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
