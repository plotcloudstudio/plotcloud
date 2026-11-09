// Drop a model anywhere in the Workspace (2026-11-09). A file dragged over the Workspace, or over its plan or 3D pane, shows one
// card for the whole window ("Release to drop your model into the site", the supported file types); letting go anywhere opens the
// import preview, and Confirm import adds the model. A file PlotCloud does not read is turned away with a message; Plan Studio's
// own drop (a saved Plan Studio file in place of the model) never sees a dropped file. Needs network access (site data).
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || require('os').tmpdir();
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    await p.goto(base + '/mvp/#/new-project'); await p.waitForFunction(() => window.__newProjectMap, null, { timeout: 30000 });
    await p.evaluate(() => window.__newProjectMap.place(49.2448, -123.0071, 'QA drop block')); await p.waitForFunction(() => window.__newProjectMap.osm, null, { timeout: 120000 });
    await p.click('#npStart'); await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 180000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(2500);
    const obj = fs.readFileSync(__dirname + '/../mvp/examples/building-metres.obj', 'utf8');
    // a drag as the browser sends it: a DataTransfer holding a file, on any element of a window (the Workspace or a pane)
    const drag = (frameUrl, type, name, text, sel) => p.evaluate(({ frameUrl, type, name, text, sel }) => { const fr = frameUrl ? [...document.querySelectorAll('iframe')].find((f) => f.src.includes(frameUrl)) : null, doc = fr ? fr.contentDocument : document, W = fr ? fr.contentWindow : window;
      const dt = new W.DataTransfer(); dt.items.add(new W.File([text], name, { type: 'application/octet-stream' })); const t = doc.querySelector(sel) || doc.body; t.dispatchEvent(new W.DragEvent(type, { bubbles: true, cancelable: true, composed: true, dataTransfer: dt })); }, { frameUrl, type, name, text, sel });
    const card = () => p.evaluate(() => { const e = document.querySelector('.sp-drop'); return e && !e.hidden ? { text: e.innerText, bad: e.classList.contains('bad'), badges: [...e.querySelectorAll('.sp-drop-pill i')].map((i) => i.textContent) } : null; });
    const imports = () => p.evaluate(() => JSON.parse(__ws2.inst.plan.ws.model()).imports?.length || 0);

    // 1 · over the Workspace: the card, the file types; leaving hides it
    await drag(null, 'dragenter', 'building.obj', obj, '.sp-bottom'); let c = await card();
    assert(c && /Release to drop your model into the site/.test(c.text) && /Supported file types/.test(c.text), JSON.stringify(c)); assert.deepEqual(c.badges, ['OBJ', 'STL', 'GLB', 'glTF', '3DM']);
    await p.screenshot({ path: out + '/drop-card.png' });
    await p.evaluate(() => { const e = document.querySelector('.sp-drop'); e.dispatchEvent(new DragEvent('dragleave', { bubbles: true, relatedTarget: null })); }); assert.equal(await card(), null, 'leaving the window hides it');
    console.log('PASS the card over the Workspace:', c.badges.join(' '));

    // 2 · over the plan pane: the same card in the Workspace; Plan Studio's own drop is not touched
    await drag('ws=plan', 'dragenter', 'building.obj', obj, '#stage'); c = await card(); assert(c && !c.bad, 'the card shows over the plan pane');
    assert(!(await p.evaluate(() => [...document.querySelectorAll('iframe')].find((f) => f.src.includes('ws=plan')).contentDocument.querySelector('#stage').classList.contains('over'))), 'Plan Studio did not take the drag');
    const n0 = await imports(), m0 = await p.evaluate(() => JSON.parse(__ws2.inst.plan.ws.model()).id);
    // let go over the plan pane: the import preview opens, and Confirm import adds the model
    await drag('ws=plan', 'drop', 'building.obj', obj, '#stage'); await p.waitForSelector('.ipv', { timeout: 60000 }); assert.equal(await card(), null);
    await p.waitForTimeout(1500); await p.screenshot({ path: out + '/drop-preview.png' }); await p.click('.ipv [data-ipv=ok]');
    await p.waitForFunction((n) => (JSON.parse(__ws2.inst.plan.ws.model()).imports?.length || 0) > n, n0, { timeout: 60000 });
    assert.equal(await p.evaluate(() => JSON.parse(__ws2.inst.plan.ws.model()).id), m0, 'the same project: the model was added, not replaced');
    console.log('PASS dropped on the plan pane: preview, then added (imports', n0, '→', await imports() + ')');

    // 3 · over the 3D pane too
    if (await p.evaluate(() => __ws2.UI.view) === 'plan') { await p.click('[data-sp=dim]'); await p.waitForTimeout(1500); }
    await drag('ws=persp', 'dragover', 'tower.stl', 'solid x\nendsolid x\n', 'canvas'); c = await card(); assert(c && !c.bad, 'the card shows over the 3D pane');
    await p.evaluate(() => document.querySelector('.sp-drop').dispatchEvent(new DragEvent('dragleave', { bubbles: true, relatedTarget: null })));
    console.log('PASS the card over the 3D pane');

    // 4 · a file PlotCloud does not read: turned away, nothing imported
    const n1 = await imports(); await drag(null, 'dragenter', 'notes.txt', 'hello', '.sp-bottom'); await drag(null, 'drop', 'notes.txt', 'hello', '.sp-drop');
    c = await card(); assert(c && c.bad && /notes\.txt is not a model PlotCloud reads/.test(c.text) && /OBJ, STL, GLB, glTF or Rhino 3DM/.test(c.text), JSON.stringify(c));
    await p.waitForTimeout(500); assert.equal(await p.locator('.ipv').count(), 0); assert.equal(await imports(), n1);
    await p.waitForFunction(() => document.querySelector('.sp-drop').hidden, null, { timeout: 8000 });
    console.log('PASS an unsupported file is turned away');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
