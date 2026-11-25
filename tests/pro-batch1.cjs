// Professional review, batch 1 (2026-11-25), hospital example at 1440×900:
// loading progress until the 2D plan and the 3D view are ready; the "?" Help card (shortcuts, terms, method reports) and T for the
// text label; "Compare versions" named the same on the button and the sheet, its export a CSV named so; the legend range of a colour
// map set by hand and back to automatic (a display choice: the result stays current); the method label opens the method report;
// Units offers Metric only; the wind method no longer claims a GPU.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }), p = await ctx.newPage(), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], out = process.env.SHOT_DIR || '/tmp';
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { localStorage.clear(); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    const id = await p.evaluate(async () => (await import('./js/hospital-example.js')).openHospital().id);
    await p.goto(base + '/mvp/#/workspace/' + id);
    // 1 · loading progress
    await p.waitForSelector('#wsLoad'); const early = await p.evaluate(() => ({ shown: !document.querySelector('#wsLoad').hidden, text: document.querySelector('#wsLoad').innerText }));
    assert(early.shown && /Opening the model[\s\S]*2D plan[\s\S]*3D view/.test(early.text), 'loading shows what is opening ' + JSON.stringify(early));
    await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.waitForTimeout(1500);
    const load = await p.evaluate(() => ({ hidden: document.querySelector('#wsLoad').hidden, ms: window.__ws2.loadMs }));
    assert(load.hidden && load.ms.plan > 0 && load.ms.persp > 0, 'loading gone once both views are ready ' + JSON.stringify(load));
    console.log(`PASS loading progress shown, then gone: 2D plan ready at ${load.ms.plan} ms, 3D view at ${load.ms.persp} ms`);
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click());
    // 2 · Help
    await p.click('[data-sp="help"]'); await p.waitForSelector('.sp-help:not([hidden])');
    const keys = await p.locator('.sp-help [data-help-sec="keys"]').innerText(); assert(/Text label/.test(keys) && /Ctrl/.test(keys) && /Nudge 1 mm/.test(keys), 'shortcuts listed');
    await p.click('.sp-help [data-help-tab="terms"]'); assert.match(await p.locator('.sp-help [data-help-sec="terms"]').innerText(), /sDA 300\/50%[\s\S]*UTCI/);
    await p.click('.sp-help [data-help-tab="methods"]'); const n = await p.locator('.sp-help [data-help-report]').count(); assert(n >= 20, 'method reports listed: ' + n);
    assert.equal(await p.getAttribute('.sp-help [data-help-report="sunhours"]', 'href'), '#/blog/report-sunhours');
    await p.screenshot({ path: out + '/pro1-help.png' });
    await p.keyboard.press('Escape'); assert.equal(await p.isVisible('.sp-help'), false, 'Esc closes Help');
    console.log(`PASS Help: shortcuts, terms and ${n} method reports; Esc closes it`);
    // T picks the text label in the plan
    const fr = p.frames().find((f) => f.url().includes('ws=plan'));
    await fr.evaluate(() => { document.getElementById('cv').focus(); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true })); }); await p.waitForTimeout(300);
    const tool = await fr.evaluate(() => document.querySelector('[data-tool="note"]')?.getAttribute('aria-pressed')); assert.equal(tool, 'true', 'T selects the text label');
    await fr.evaluate(() => window.__ws.tool({ tool: 'select' }));
    console.log('PASS T selects the text label, as its tooltip says');
    // 3 · Compare versions
    assert.equal(await p.getAttribute('[data-sp="saved"]', 'aria-label'), 'Compare versions');
    await p.click('[data-sp="saved"]'); await p.waitForSelector('.sp-sheet:not([hidden])', { timeout: 10000 });
    const sheet = await p.evaluate(() => ({ label: document.querySelector('.sp-sheet').getAttribute('aria-label'), title: document.querySelector('.sp-sheet .sp-sk-title')?.textContent, csv: document.querySelector('.sp-sheet [data-cmp=csv]')?.textContent }));
    assert.deepEqual(sheet, { label: 'Compare versions', title: 'Compare versions', csv: 'Export CSV' }, JSON.stringify(sheet));
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.sp-sheet [data-cmp=csv]')]); assert.match(dl.suggestedFilename(), /compare-versions\.csv$/);
    console.log(`PASS the Compare versions button and sheet share one name; Export CSV gives ${dl.suggestedFilename()}`);
    await p.evaluate(() => document.querySelector('.sp-sheet [data-cmp=close]')?.click()); await p.waitForTimeout(500);
    // 4 · legend range on Sun hours
    await p.evaluate(() => window.__wsStudy.open('sunhours')); await p.waitForTimeout(800); await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click());
    await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 400000 }); await p.waitForTimeout(800);
    const auto = await p.evaluate(() => { const r = window.__wsStudy.state().res; return { lo: r.lo, hi: r.hi, top: document.querySelector('.sp-legend .sp-lblabels span')?.textContent }; });
    await p.click('.sp-legend [data-lb=edit]'); await p.fill('.sp-legend [data-lb=lo]', '1'); await p.fill('.sp-legend [data-lb=hi]', '5'); await p.click('.sp-legend .sp-lbrange button[type=submit]'); await p.waitForTimeout(600);
    const set = await p.evaluate(async (id) => { const r = window.__wsStudy.state().res, S = await import('./js/store.js'), L = [...document.querySelectorAll('.sp-legend .sp-lblabels span')].map((x) => x.textContent); return { lo: r.lo, hi: r.hi, top: L[0], bottom: L.at(-1), stored: S.project(id).display?.legend, link: document.querySelector('.sp-legend [data-lb=edit]')?.textContent, save: !document.querySelector('.sp-studyres [data-st=save]')?.disabled, xl: !document.querySelector('.sp-studycard [data-st=xlview]')?.disabled }; }, id);
    await p.screenshot({ path: out + '/pro1-legend.png' });
    assert(set.lo === 1 && set.hi === 5 && +set.top === 5 && +set.bottom === 1, 'legend 1–5 ' + JSON.stringify(set));
    assert.deepEqual(set.stored['sunhours:' + (await p.evaluate(() => window.__wsStudy.state().res.view))], { lo: 1, hi: 5 }, 'kept with the project');
    assert(set.save && set.xl, 'the result stays current: Save and Add to Export list still enabled ' + JSON.stringify(set)); assert.match(set.link, /Range set by you/);
    await p.click('.sp-legend [data-lb=edit]'); await p.click('.sp-legend [data-lb=reset]'); await p.waitForTimeout(600);
    const back = await p.evaluate(() => { const r = window.__wsStudy.state().res; return { lo: r.lo, hi: r.hi }; }); assert.deepEqual(back, { lo: auto.lo, hi: auto.hi }, 'Automatic restores the range');
    console.log(`PASS legend range: automatic ${auto.lo}–${auto.hi} → set 1–5 (kept with the project, result still current) → automatic again`);
    // 5 · the method label opens the report
    const mat = await p.evaluate(() => { const a = document.querySelector('.sp-studyres .sp-mat, .sp-mat'); return a ? { tag: a.tagName, href: a.getAttribute('href') } : null; });
    assert(mat && mat.tag === 'A' && /#\/blog\/report-sunhours$/.test(mat.href), 'method label links to the report ' + JSON.stringify(mat));
    const rp = await ctx.newPage(); await rp.goto(base + '/mvp/#/blog/report-sunhours'); await rp.waitForTimeout(2500); assert.match(await rp.evaluate(() => document.body.innerText), /Direct sun hours/); await rp.close();
    console.log('PASS the method label opens the Sun hours method report on the Blog');
    // 6 · Units and the wind method text
    const txt = await p.evaluate(async () => ({ props: await (await fetch('./js/project-props.js')).text(), cap: (await import('./js/capabilities.js')).CAPABILITIES?.wind?.method || (await (await fetch('./js/capabilities.js')).text()) }));
    assert(!/'Imperial'/.test(txt.props) && /metric only for now/.test(txt.props), 'Units: Metric only, said so'); assert(!/GPU/.test(txt.cap.match(/wind: \{[^}]*\}/)?.[0] || txt.cap), 'wind method: no GPU claim');
    console.log('PASS Units offers Metric only and says so; the wind method no longer claims a GPU');
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
