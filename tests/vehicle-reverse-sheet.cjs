// Reversing, turning round and the vehicle access sheet (2026-11-25), hospital example at 1440×900:
// a box truck backed up to the goods door (the planner reverses: the result counts the moves and the metres reversing, the playback
// says when it reverses); Try every vehicle says why an articulated vehicle cannot back in; "Turn round" on the hospital drive, kept
// within the road, backs and fills; the vehicle access sheet goes to the Export list and into the report PDF with its plan drawing and
// its tables on a page of their own (route and moves, every vehicle, conflicts, vehicle data); no page errors.
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('fs'), { execFileSync } = require('child_process');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], out = process.env.SHOT_DIR || '/tmp';
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'persp' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    const id = await p.evaluate(async () => (await import('./js/hospital-example.js')).openHospital().id); await p.goto(base + '/mvp/#/workspace/' + id);
    await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    const idle = () => p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 600000 });
    const run = async () => { await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await idle(); await p.waitForTimeout(500); const e = await p.evaluate(() => window.__wsStudy.state().err); assert(!e, 'study error: ' + e); };
    const rows = () => p.evaluate(() => Object.fromEntries(window.__wsStudy.state().res.rows.map(([k, v]) => [k, String(v).replace(/<[^>]+>/g, '')])));
    const unfold = () => p.evaluate(() => { const d = document.querySelector('.sp-studycard details[data-adv="__set"]'); if (d && !d.open) d.querySelector('summary').click(); });
    await p.evaluate(() => window.__wsStudy.open('vehicle-swept-path')); await p.waitForSelector('.sp-studycard [data-va-task]'); await p.waitForTimeout(600);
    // 1 · backed up to the goods door
    await p.selectOption('.sp-studycard [data-va=veh]', 'box'); await p.selectOption('.sp-studycard [data-va=stop]', 'back'); await p.waitForTimeout(300);
    assert.equal(await p.isChecked('.sp-studycard [data-va=rev]'), true, 'reversing allowed by default');
    await run(); let R = await rows();
    console.log('back-in reasons:', JSON.stringify(await p.evaluate(() => window.__wsStudy.state().res.saRuns[0].reasons)));
    assert.match(R['Found route'], /^backed up from .* to door 1/, R['Found route']); assert.match(R['Moves'] || '', /^\d+ \(\d+ changes? of direction\), [\d.]+ m reversing/, 'moves: ' + R['Moves']); assert.equal(R['Collisions'], 'none');
    const rv = await p.evaluate(() => { const r = window.__wsStudy.state().res.saRuns[0], P = r.poses, k = P.findIndex((q) => q.dir < 0), end = P.at(-1); return { k, f: k >= 0 ? (P[k].t + 0.5 - P[0].t) / (end.t - P[0].t) : -1, cusps: r.cusps, endDir: end.dir }; });
    assert(rv.k > 0 && rv.cusps >= 1 && rv.endDir < 0, 'the last move is backwards: ' + JSON.stringify(rv));
    await p.evaluate((f) => { const s = document.querySelector('.sp-studycard [data-tl=seek]'); s.value = String(+s.max * f); s.dispatchEvent(new Event('input', { bubbles: true })); }, Math.min(0.999, rv.f)); await p.waitForTimeout(400);
    assert.match(await p.locator('.sp-studycard .sp-tll').innerText(), /reversing/, 'the playback says it reverses');
    await p.screenshot({ path: out + '/vehicle-backin.png' });
    console.log(`PASS backed up to the door: ${R['Found route']}; ${R['Moves']}; ${R['Status']}; the playback says "reversing"`);
    // every vehicle: the articulated ones are not reversed, and say so
    await p.click('.sp-studycard [data-va=tryall]'); await p.waitForFunction(() => document.querySelector('.sp-studycard [data-va=tryallcsv]'), null, { timeout: 900000 });
    const all = await p.$$eval('.sp-studycard .sp-vehall tbody tr', (t) => t.map((r) => ({ name: r.cells[0].innerText, res: r.cells[2].innerText, why: r.cells[2].title })));
    const semi = all.find((r) => /Semi-trailer/.test(r.name)); assert(semi && /No route/.test(semi.res) && /articulated/.test(semi.why), 'the semi-trailer: ' + JSON.stringify(semi));
    console.log(`PASS every vehicle backed up: ${all.filter((r) => /Feasible/.test(r.res)).length} of ${all.length} make it; the semi-trailer: "${semi.why.slice(0, 80)}…"`);
    // 2 · the vehicle access sheet into the report
    const badge = () => p.evaluate(() => { const e = document.querySelector('.sp-xlb .sp-badge'); return e && !e.hidden ? +e.textContent : 0; });
    await p.click('.sp-studycard [data-va=sheet]'); await p.waitForFunction(() => +document.querySelector('.sp-xlb .sp-badge')?.textContent >= 1, null, { timeout: 120000 }); assert.equal(await badge(), 1);
    // 3 · turn round on the hospital drive, within its width
    const rd = await p.evaluate(() => (__ws2.inst.plan.ws.planScene('noise').roads || []).filter((r) => r.pts.length >= 2).map((r) => ({ name: r.name, width: r.width, pts: r.pts })));
    const drive = rd.find((r) => /Hospital Drive/.test(r.name)) || rd.sort((a, c) => c.width - a.width)[0], A0 = drive.pts[0], A1 = drive.pts.at(-1), at = (u) => [A0[0] + (A1[0] - A0[0]) * u, A0[1] + (A1[1] - A0[1]) * u];
    await unfold(); await p.click('.sp-studycard [data-va-task=turnround]'); await p.waitForTimeout(300); await p.selectOption('.sp-studycard [data-va=veh]', 'van'); await p.click('.sp-studycard [data-va=picktr]');
    for (const q of [at(0.5), at(0.62)]) { assert(await p.evaluate((q) => __ws2.inst.plan.ws._pick(q), q)); await p.waitForTimeout(150); }
    await run(); R = await rows();
    assert.match(R['Found route'], /turning round on .* within its width/, R['Found route']); assert.match(R['Moves'] || '', /\d+ \(\d+ changes? of direction\)/, 'moves: ' + R['Moves']);
    const inRoad = await p.evaluate((w) => { const r = window.__wsStudy.state().res.saRuns[0]; return r.status; }, drive.width);
    await p.screenshot({ path: out + '/vehicle-turnround.png' });
    console.log(`PASS turn round on ${drive.name} (${drive.width} m wide): ${R['Moves']}; ${R['Status']} (${inRoad})`);
    // 4 · the report PDF: the sheet with its plan drawing and its tables page
    await p.click('.sp-xlb'); await p.waitForTimeout(800);
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 300000 }), p.click('.sp-pop-xl [data-xl=pdf]')]); const f = out + '/' + dl.suggestedFilename(); await dl.saveAs(f);
    const pages = +/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [f]).toString())[1], text = execFileSync('pdftotext', ['-layout', f, '-']).toString().replace(/\s+/g, ' ');
    for (const t of ['Vehicle access', 'Figure 1.1 Plan drawing', 'Figure 1.2', '(continued)', 'Route and moves', 'Every vehicle on this route', 'Conflicts', 'Vehicle data', 'backed up']) assert(text.includes(t), 'the report has: ' + t);
    assert.equal(pages, 5, 'cover, summary, the sheet, its tables, the closing page: ' + pages);
    execFileSync('pdftoppm', ['-r', '45', '-png', '-f', '3', '-l', '4', f, out + '/vehicle-sheet']);
    console.log(`PASS the report: ${pages} pages, the vehicle access sheet with its plan drawing and a page of tables (route and moves, every vehicle, conflicts, vehicle data)`);
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
