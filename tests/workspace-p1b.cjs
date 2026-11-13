// P1b, the study card and the Workspace loop (2026-11-12), on the hospital example:
// · before a run the settings come first, then Start; less common settings fold under Advanced, marked when changed
// · after a run the results come first, the settings fold below Start again, then Export (Add to Export list, CSV · PNG)
// · the project workflow in the Workspace: five steps, Plan Studio current, Simulation done once a result is saved; Simulation opens
//   Add simulation here; Results and Report & boards at the top right
// · exporting from the Export list ticks "Export a report" in the getting-started checklist
const { chromium } = require('playwright'), assert = require('node:assert/strict'), os = require('node:os');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 }, acceptDownloads: true }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || os.tmpdir();
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); try { localStorage.removeItem('pc-unfold'); } catch { } });
    await p.goto(base + '/mvp/#/home'); await p.waitForSelector('[data-hospital]'); await p.click('.ph-thumb[data-hospital]');
    await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(2000);
    const pid = await p.evaluate(() => location.hash.split('/')[2].split('?')[0]);
    const steps = () => p.evaluate(async (id) => { const S = await import('./js/store.js'), O = await import('./js/onboarding.js'), pr = S.project(id); return { steps: Object.fromEntries(O.steps(pr).map((x) => [x.id, x.done])), exports: (pr.exports || []).length }; }, pid);
    // the workflow and the links
    const flow = () => p.$$eval('.sp-flow a', (as) => as.map((a) => [a.dataset.flow, a.dataset.done, a.getAttribute('aria-current') || '', a.getAttribute('href')]));
    let f = await flow(); assert.deepEqual(f.map((x) => x[0]), ['site', 'plan', 'sim', 'render', 'boards']); assert.equal(f.find((x) => x[0] === 'plan')[2], 'step'); assert.equal(f.find((x) => x[0] === 'sim')[1], 'false');
    assert.equal(f.find((x) => x[0] === 'render')[3], `#/rendering?project=${pid}`); assert.equal(f.find((x) => x[0] === 'boards')[3], `#/boards?project=${pid}`);
    assert.equal(await p.getAttribute('.sp-tr [data-sp=results]', 'href'), `#/results/${pid}`); assert.equal(await p.getAttribute('.sp-tr [data-sp=report]', 'href'), `#/project/${pid}`);
    await p.click('.sp-flow [data-flow=sim]'); await p.waitForSelector('.w2-simmenu:not([hidden])', { timeout: 5000 }); assert.match(await p.evaluate(() => location.hash), new RegExp(`^#/workspace/${pid}$`), 'stays in the Workspace');
    await p.keyboard.press('Escape'); await p.mouse.click(800, 880); await p.waitForTimeout(300);
    console.log('PASS the workflow in the Workspace:', JSON.stringify(f.map((x) => x.slice(0, 3))));
    // before a run: settings, then Start; Advanced folded
    await p.evaluate(() => window.__wsStudy.open('fire-evacuation')); await p.waitForTimeout(1500);
    const order = await p.evaluate(() => { const c = document.querySelector('.sp-studycard'), at = (s) => [...c.querySelectorAll('*')].indexOf(c.querySelector(s)); return { sect: at('.sp-sect'), use: at('[data-eg=use]'), run: at('[data-st=run]'), adv: !!c.querySelector('details[data-adv=egAll]'), open: c.querySelector('details[data-adv=egAll]')?.open }; });
    assert(order.sect >= 0 && order.use > order.sect && order.run > order.use, 'settings before Start: ' + JSON.stringify(order)); assert(order.adv && !order.open, 'Advanced folded');
    assert(!(await p.isVisible('.sp-studycard [data-eg=runs]')), 'runs under Advanced'); assert.equal(await p.locator('.sp-studycard details[data-adv=egAll] .sp-dot').count(), 0, 'no mark at the defaults');
    await p.click('.sp-studycard details[data-adv=egAll] > summary'); await p.selectOption('.sp-studycard [data-eg=runs]', '10'); await p.waitForTimeout(300);
    const advTxt = await p.locator('.sp-studycard details[data-adv=egAll]').innerText(); const advOk = [/ASET/.test(advTxt), /drill/i.test(advTxt), await p.isVisible('.sp-studycard [data-eg=runs]')]; assert(advOk.every(Boolean), 'ASET and drill under Advanced: ' + advOk + ' ' + advTxt.length); assert.equal(await p.locator('.sp-studycard details[data-adv=egAll] .sp-dot').count(), 1, 'marked as changed');
    assert(await p.evaluate(() => document.querySelector('.sp-studycard details[data-adv=egAll]').open), 'stays open after a redraw');
    await p.screenshot({ path: `${out}/p1b-before.png` }); console.log('PASS before a run: settings first, Advanced folded and marked when changed');
    // after a run: results first, settings folded, export
    await p.click('.sp-studycard [data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 900000 });
    const after = await p.evaluate(() => { const c = document.querySelector('.sp-studycard'), at = (s) => [...c.querySelectorAll('*')].indexOf(c.querySelector(s)); return { stage: at('.sp-stage'), run: at('[data-st=run]'), set: at('details.sp-set'), exp: at('.sp-expacts'), open: c.querySelector('details.sp-set')?.open, sect: !!c.querySelector(':scope > .sp-sect') }; });
    assert(after.stage >= 0 && after.run > after.stage && after.set > after.run && after.exp > after.set && !after.open && !after.sect, 'results, Start again, settings, export: ' + JSON.stringify(after));
    await p.click('.sp-studycard details.sp-set > summary'); await p.selectOption('.sp-studycard [data-eg=detect]', '120'); await p.waitForTimeout(400);
    assert.match(await p.locator('.sp-studycard .sp-pill').innerText(), /Settings changed/); assert.match(await p.locator('.sp-studycard details.sp-set > summary').innerText(), /changed: Start again/);
    assert(await p.isDisabled('.sp-studycard [data-st=xlview]'), 'no export of a result that no longer matches the settings');
    await p.selectOption('.sp-studycard [data-eg=detect]', '60'); await p.waitForTimeout(400); assert.match(await p.locator('.sp-studycard .sp-pill').innerText(), /Up to date/);
    await p.screenshot({ path: `${out}/p1b-after.png` }); console.log('PASS after a run: results first, settings folded, changes flagged');
    // save the result: Simulation done
    await p.click('.sp-studyres [data-st=save]'); await p.waitForFunction(() => document.querySelector('.sp-flow [data-flow=sim]')?.dataset.done === 'true', null, { timeout: 30000 });
    // add to the Export list and export a PDF: "Export a report" ticked
    await p.click('.sp-studycard [data-st=xlview]'); await p.waitForFunction(() => +document.querySelector('.sp-xlb .sp-badge')?.textContent >= 1, null, { timeout: 120000 });
    let st = await steps(); assert.equal(st.steps.report, false); assert.equal(st.steps.study, true);
    if (await p.locator('.sp-pop-xl').isHidden()) await p.click('.sp-xlb'); await p.waitForTimeout(800);
    const [d] = await Promise.all([p.waitForEvent('download', { timeout: 240000 }), p.click('.sp-pop-xl [data-xl=pdf]')]); assert.match(d.suggestedFilename(), /\.pdf$/);
    await p.waitForTimeout(800); st = await steps(); assert.equal(st.steps.report, true, 'Export a report ticked: ' + JSON.stringify(st)); assert.equal(st.exports, 1);
    f = await flow(); assert.equal(f.find((x) => x[0] === 'boards')[1], 'true', 'an export counts for step 5');
    console.log('PASS the loop: result saved, view added, PDF exported; checklist', JSON.stringify(st.steps));
    // the project page shows the same steps
    await p.goto(base + `/mvp/#/project/${pid}`); await p.waitForSelector('[aria-label="Project workflow"] [data-flow]'); const pj = await p.$$eval('[aria-label="Project workflow"] [data-flow]', (as) => as.map((a) => [a.dataset.flow, a.dataset.done]));
    assert.deepEqual(pj.map((x) => x[1]), f.map((x) => x[1]), 'the same on the project page'); console.log('PASS the project page agrees:', JSON.stringify(pj));
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
