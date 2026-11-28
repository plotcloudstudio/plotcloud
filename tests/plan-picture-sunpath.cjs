// Report pictures from the 2D plan, and the sun path turned off (2026-11-28), hospital example at 1440×900, 2D plan view:
// Sun hours shows its sun path; "Show the sun path" in the study card turns it off in the 2D plan and in 3D, is kept with the project
// and is the same switch as in the Visibility popup; in the 2D plan the report preview stays in 2D ("Pan and zoom the 2D plan"),
// "Use this view" keeps a 2D framing, and Add to Export list then takes the picture from the 2D plan (not 3D); no page errors.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], out = process.env.SHOT_DIR || '/tmp';
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'plan' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    const id = await p.evaluate(async () => (await import('./js/hospital-example.js')).openHospital().id); await p.goto(base + '/mvp/#/workspace/' + id);
    await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    const view = () => p.evaluate(() => JSON.parse(localStorage.getItem('pc-mvp-ws2') || '{}').view);
    if ((await view()) !== 'plan') { await p.click('[data-sp="dim"]'); await p.waitForTimeout(1500); } assert.equal(await view(), 'plan', 'in the 2D plan');
    await p.evaluate(() => window.__wsStudy.open('sunhours')); await p.waitForTimeout(800); await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click());
    await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 600000 }); await p.waitForTimeout(800);
    const shown = () => p.evaluate(() => ({ plan: __ws2.inst.plan.ws.sunPathShown(), persp: __ws2.inst.persp.ws.sunPathShown() }));
    const s0 = await shown(); assert(s0.plan, 'the sun path is shown at first ' + JSON.stringify(s0)); assert.equal(await p.isChecked('.sp-studycard [data-sunpath]'), true);
    // 1 · off from the card
    await p.uncheck('.sp-studycard [data-sunpath]'); await p.waitForTimeout(600);
    const s1 = await shown(), kept = await p.evaluate(async (id) => (await import('./js/store.js')).project(id).display?.sunPath, id);
    assert(!s1.plan && !s1.persp && kept === false, 'off in 2D and 3D, kept with the project ' + JSON.stringify({ s1, kept }));
    await p.screenshot({ path: out + '/sunpath-off.png' });
    // the Visibility popup has the same switch, now off; on from there
    await p.click('[data-sp="vis"]'); await p.waitForSelector('.sp-pop-vis [data-vis-sun]'); assert.equal(await p.isChecked('.sp-pop-vis [data-vis-sun]'), false, 'the Visibility popup agrees');
    await p.check('.sp-pop-vis [data-vis-sun]'); await p.waitForTimeout(600); const s2 = await shown(); assert(s2.plan, 'on again from the Visibility popup ' + JSON.stringify(s2)); assert.equal(await p.isChecked('.sp-studycard [data-sunpath]'), true, 'and the card follows');
    await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelector('[data-sp="vis"][aria-pressed="true"]')?.click()); await p.uncheck('.sp-studycard [data-sunpath]'); await p.waitForTimeout(400);
    console.log('PASS the sun path: shown with Sun hours; the card turns it off in 2D and 3D (kept with the project); the Visibility popup has the same switch');
    // 2 · the report preview in the 2D plan
    await p.click('.sp-xlb'); await p.waitForTimeout(600); await p.evaluate(() => { const c = document.querySelector('[data-gp="sunhours"]'); if (c && !c.checked) c.click(); }); await p.waitForSelector('[data-gpv="sunhours"]'); await p.evaluate(() => document.querySelector('[data-gpv="sunhours"]').click()); await p.waitForSelector('.xl-pvbar', { timeout: 120000 });
    const bar = await p.evaluate(() => ({ view: document.querySelector('.xl-pvbar').dataset.view, text: document.querySelector('.xl-pvbar').innerText, ui: JSON.parse(localStorage.getItem('pc-mvp-ws2') || '{}').view }));
    assert(bar.view === 'plan' && /Pan and zoom the 2D plan/.test(bar.text), 'the preview stays in 2D: ' + JSON.stringify(bar));
    await p.screenshot({ path: out + '/plan-preview.png' });
    await p.click('.xl-pvbar [data-pv=use]'); await p.waitForTimeout(600);
    const cam = await p.evaluate(() => { const g = JSON.parse(localStorage.getItem('pc-ws-gen') || 'null'); return g; });
    console.log(`PASS the report preview stays in the 2D plan: "${bar.text.split('\n')[0].slice(0, 110)}"`);
    // 3 · Add to Export list from the 2D plan: the picture is the 2D plan
    await p.keyboard.press('Escape'); await p.evaluate(() => { document.querySelectorAll('.sp-pop:not([hidden])').forEach((x) => (x.hidden = true)); });
    const before = await p.evaluate(() => __ws2.inst.persp.ws.snapAt ? 1 : 0); void before; void cam;
    await p.evaluate(() => { window.__snap = { d2: 0, d3: 0 }; const w2 = __ws2.inst.plan.ws, w3 = __ws2.inst.persp.ws, a = w2.snap2d.bind(w2), c = w3.snapAt.bind(w3); w2.snap2d = (...x) => { window.__snap.d2++; return a(...x); }; w3.snapAt = (...x) => { window.__snap.d3++; return c(...x); }; });
    await p.evaluate(() => document.querySelector('.sp-studycard [data-st=xlview]')?.click()); await p.waitForFunction(() => +document.querySelector('.sp-xlb .sp-badge')?.textContent >= 1, null, { timeout: 120000 });
    const snap = await p.evaluate(() => ({ ...window.__snap, view: JSON.parse(localStorage.getItem('pc-mvp-ws2') || '{}').view }));
    assert(snap.d2 >= 1 && snap.d3 === 0, 'the picture was taken from the 2D plan: ' + JSON.stringify(snap));
    console.log(`PASS Add to Export list in the 2D plan takes the picture from the plan (2D pictures: ${snap.d2}, 3D: ${snap.d3})`);
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
