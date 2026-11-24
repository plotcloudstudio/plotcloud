// Rendering and Boards removed (2026-11-24): the workflow is 1 Site analysis → 2 Plan Studio → 3 Simulation → 4 Reports.
// The homepage, the project page and the Workspace name the four steps; the Workspace has no Render button; an OpenAI key the
// old Render panel kept in this browser is forgotten; the old #/rendering and #/boards addresses still go to the project.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(() => { localStorage.setItem('pc-openai-key', 'test-not-a-key'); localStorage.setItem('pc-render-model', 'x'); sessionStorage.setItem('pc-openai-key', 'test-not-a-key'); });
    await p.reload(); await p.waitForFunction(() => document.querySelector('#app h1'));
    assert.deepEqual(await p.evaluate(() => [localStorage.getItem('pc-openai-key'), localStorage.getItem('pc-render-model'), sessionStorage.getItem('pc-openai-key')]), [null, null, null], 'the saved key is forgotten');
    console.log('PASS an OpenAI key and model kept by the old Render panel are removed from the browser');
    await p.goto(base + '/mvp/#/'); await p.waitForSelector('.lp-flow li b');
    assert.deepEqual(await p.$$eval('.lp-flow li b', (x) => x.map((e) => e.textContent)), ['Site analysis', 'Plan Studio', 'Simulation', 'Reports']);
    const id = await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); const q = (await import('./js/hospital-example.js')).openHospital(); q.onboarding = { created: new Date().toISOString() }; S.save(); return q.id; });
    await p.goto(base + '/mvp/#/project/' + id); await p.waitForSelector('nav.acts a');
    const steps = await p.$$eval('nav[aria-label="Project workflow"] a', (x) => x.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
    assert.deepEqual(steps.slice(0, 4).map((s) => s.replace(/^[✓\d\s]+/, '').replace(/ · .*/, '')), ['Site analysis', 'Plan Studio', 'Simulation', 'Reports'], 'four steps on the project page ' + JSON.stringify(steps)); assert(!steps.some((s) => /Render|Board/i.test(s)), JSON.stringify(steps));
    console.log('PASS homepage and project page: ' + steps.slice(0, 4).join(' → '));
    await p.goto(base + '/mvp/#/workspace/' + id); await p.waitForFunction(() => window.__ws2?.inst.plan.ready && window.__ws2?.inst.persp.ready, null, { timeout: 400000 }); await p.waitForTimeout(2000);
    const ws = await p.evaluate(() => ({ btn: !!document.querySelector('[data-sp="render"], [aria-label="Render"]'), text: [...document.querySelectorAll('button,a')].filter((e) => e.getClientRects().length).map((e) => (e.getAttribute('aria-label') || '') + ' ' + (e.title || '') + ' ' + e.textContent).join(' | '), mod: performance.getEntriesByType('resource').some((r) => /render-(panel|ai)\.js/.test(r.name)) }));
    assert.equal(ws.btn, false, 'no Render button'); assert.doesNotMatch(ws.text, /\bRender\b|OpenAI|\bBoards?\b/, 'no Render or Boards control'); assert.equal(ws.mod, false, 'the render modules are not loaded');
    console.log('PASS the Workspace has no Render button and loads no render code');
    for (const old of ['#/rendering?project=' + id, '#/boards?project=' + id]) { await p.goto(base + '/mvp/' + old); await p.waitForTimeout(1500); assert.equal(await p.evaluate(() => location.hash), '#/project/' + id, old); }
    console.log('PASS old #/rendering and #/boards links open the project');
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
