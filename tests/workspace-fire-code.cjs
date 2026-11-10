// Fire Evacuation, from screening to the engineer (2026-11-10), on the hospital example:
// 1 · Code check (OBC 2024 Part 3): every check on every floor; the example meets them; without sprinklers the travel distance
//     limit drops to 30 m and the longest travel distances are flagged; the travel distance map and the exits on the sheets
// 2 · ASET: entered, or read from an FDS device file at a threshold; the margin against the evacuation time
// 3 · A drill to compare with: loaded from a CSV, drawn on the chart, compared with the runs
// 4 · The fire engineer's brief: downloaded, with the results, ASET, drill, code check, sources, limitations and a review block
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 }, acceptDownloads: true }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || os.tmpdir();
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    await p.goto(base + '/mvp/#/home'); await p.waitForSelector('[data-hospital]'); await p.click('.ph-thumb[data-hospital]');
    await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(2500);
    await p.evaluate(() => window.__wsStudy.open('fire-evacuation')); await p.waitForTimeout(1500);
    const run = async () => { await p.click('.sp-studycard [data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 420000 }); return p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, rows: (s.res?.rows || []).map(([k, v]) => [k.replace(/<[^>]+>/g, ''), String(v).replace(/<[^>]+>/g, '')]), results: s.res?.results }; }); };
    // 1 · code check
    await p.click('.sp-studycard [data-st-mode=code]'); await p.waitForTimeout(600);
    assert.match(await p.locator('.sp-studycard').innerText(), /Ontario Building Code 2024[\s\S]*Group B, Division 2[\s\S]*not a code compliance determination/);
    let r = await run(); assert.equal(r.err, ''); assert.equal(r.results.fail, 0, 'the example meets every check: ' + JSON.stringify(r.rows.filter((x) => x[0].startsWith('✗'))));
    for (const k of [/Number of exits/, /Travel distance to an exit/, /Distance between exits/, /Exit width for the occupant load/, /Minimum width: exit stair/, /Minimum width: door into/, /Corridor clear width/, /Doorways that beds pass through/, /Dead-end corridors/]) assert(r.rows.some((x) => k.test(x[0])), 'checked: ' + k);
    assert(r.results.pass >= 30, JSON.stringify(r.results)); assert.match(r.rows.find((x) => /Corridor clear width/.test(x[0]))[1], /2440 mm/);
    const st = await p.frames().find((f) => f.url().includes('ws=persp')).evaluate(() => window.__ws.egressState()); assert(st.marks.some((m) => m && m.doors.includes('exit') && m.stairs >= 2), 'exits and stairs on the sheets');
    await p.screenshot({ path: `${out}/code-check.png` }); console.log('PASS the code check: hospital example', r.rows[0][1]);
    await p.uncheck('.sp-studycard [data-cd=cdSpr]'); r = await run(); assert.equal(r.results.limit, 30); const td = r.rows.filter((x) => x[0].startsWith('✗') && /Travel distance/.test(x[0])); assert(td.length >= 1, 'without sprinklers the 30 m limit is exceeded: ' + JSON.stringify(r.rows.slice(0, 6)));
    console.log('PASS without sprinklers:', td.map((x) => x.join(' ')).join(' | ')); await p.check('.sp-studycard [data-cd=cdSpr]');
    // 2 · ASET: entered, then from an FDS device file
    await p.click('.sp-studycard [data-st-mode=all]'); await p.waitForTimeout(500); await p.selectOption('.sp-studycard [data-eg=runs]', '20');
    await p.click('.sp-studycard [data-eg=asetmode][data-v=value]'); await p.fill('.sp-studycard [data-eg=aset]', '12'); await p.dispatchEvent('.sp-studycard [data-eg=aset]', 'change');
    r = await run(); assert.equal(r.err, ''); let as = r.rows.find((x) => x[0] === 'ASET'), mg = r.rows.find((x) => x[0].startsWith('Margin'));
    assert.match(as[1], /12(\.0)? min \(entered\)/); assert.match(mg[1], /RSET/); console.log('PASS ASET entered:', as[1], '·', mg.join(' '));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-')), fds = path.join(tmp, 'ward_devc.csv'); fs.writeFileSync(fds, 's,m,C\nTime,VIS_CORRIDOR,TEMP_CORRIDOR\n' + Array.from({ length: 121 }, (_, i) => `${i * 10},${(30 - i * 0.2).toFixed(1)},${(20 + i * 0.4).toFixed(1)}`).join('\n'));
    await p.click('.sp-studycard [data-eg=asetmode][data-v=fds]'); await p.setInputFiles('.sp-studycard [data-eg=fds]', fds); await p.waitForSelector('.sp-studycard [data-eg=fdscol]');
    await p.fill('.sp-studycard [data-eg=fdsthr]', '10'); await p.dispatchEvent('.sp-studycard [data-eg=fdsthr]', 'change'); await p.waitForTimeout(300);
    assert.match(await p.locator('.sp-studycard').innerText(), /ASET 16\.\d min \(ward_devc\.csv: VIS_CORRIDOR below 10 m\)/, 'visibility falls below 10 m at 1010 s');
    // 3 · a drill
    const drill = path.join(tmp, 'drill.csv'); fs.writeFileSync(drill, '# test drill\nperson,out_s\n' + Array.from({ length: 200 }, (_, i) => `${i + 1},${(90 + i * 1.6).toFixed(1)}`).join('\n'));
    await p.setInputFiles('.sp-studycard [data-eg=drill]', drill); await p.waitForFunction(() => /drill\.csv: 200 people out/.test(document.querySelector('.sp-studycard')?.innerText || ''), null, { timeout: 10000 });
    r = await run(); assert.equal(r.err, ''); for (const k of [/^ASET$/, /^Drill: people out/, /^Drill against the runs/, /^Curve difference \(ERD\)/]) assert(r.rows.some((x) => k.test(x[0])), 'row ' + k);
    const svg = await p.locator('.sp-studycard svg.sp-hist').innerHTML(); assert(svg.includes('#f97316') && svg.includes('#15803d'), 'the drill curve and the ASET line on the chart');
    await p.screenshot({ path: `${out}/aset-drill.png` }); console.log('PASS FDS ASET and the drill:', r.rows.filter((x) => /^ASET|^Margin|^Drill|^Curve/.test(x[0])).map((x) => x.join(': ')).join(' | '));
    // 4 · the brief
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.sp-studycard [data-eg=brief]')]); const f = path.join(tmp, dl.suggestedFilename()); await dl.saveAs(f); const html = fs.readFileSync(f, 'utf8');
    assert.match(dl.suggestedFilename(), /^fire-evacuation-brief-.*\.html$/); for (const k of [/Fire evacuation brief/, /Not a code compliance determination/, /1\. Results of this study/, /VIS_CORRIDOR below 10/, /drill\.csv: 200 people/, /6\. Code check/, /Corridor clear width/, /Gwynne &amp; Rosenbaum 2016|Gwynne & Rosenbaum 2016/, /Reviewed by \(fire protection engineer\)/]) assert.match(html, k);
    const b2 = await b.newPage(); await b2.setContent(html); await b2.screenshot({ path: `${out}/brief.png`, fullPage: true }); await b2.close();
    console.log('PASS the fire engineer’s brief:', dl.suggestedFilename(), Math.round(html.length / 1024) + ' kB');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
