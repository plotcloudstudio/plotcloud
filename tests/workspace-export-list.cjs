// The export list and the report (2026-11-09). Under Add simulation, a list of what the report will hold: a study's view (from
// its Export area), a series (from the series preview) and a section (from the Section card), each with what it was computed
// from. Kept per project in this browser; reordered; the report as PDF (A3: cover with contents, a page per item, basis and
// limits), slides (PPTX) and pictures (ZIP); an item whose model has changed is marked. Needs network access (site data).
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('fs'), { execFileSync } = require('child_process');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 }, acceptDownloads: true }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || require('os').tmpdir();
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA Architect', email: 'qa@x.test' }; S.save(); localStorage.setItem('pc-unfold', '1'); });
    await p.goto(base + '/mvp/#/new-project'); await p.waitForFunction(() => window.__newProjectMap, null, { timeout: 30000 });
    await p.evaluate(() => window.__newProjectMap.place(49.2448, -123.0071, 'QA report block')); await p.waitForFunction(() => window.__newProjectMap.osm, null, { timeout: 120000 });
    await p.click('#npStart'); await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 180000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    const O = await p.evaluate(() => { const ws = __ws2.inst.plan.ws, M = JSON.parse(ws.model()), c = M.site?.at || [0, 0], X = c[0] - 8, Y = c[1] - 5, id = (k) => k + Math.random().toString(36).slice(2, 8);
      const W = (a, b2) => { const w = { id: id('w'), lv: 'L1', a: [X + a[0], Y + a[1]], b: [X + b2[0], Y + b2[1]], t: 0.2, h: 3 }; M.walls.push(w); return w; };
      const s0 = W([0, 0], [16, 0]); W([16, 0], [16, 10]); const n0 = W([16, 10], [0, 10]); W([0, 10], [0, 0]); W([8, 0], [8, 10]);
      for (const [w, pos] of [[s0, 4], [s0, 12], [n0, 4], [n0, 12]]) M.ops.push({ id: id('o'), wall: w.id, pos, w: 2, kind: 'win', object_type: 'window', sill: 0.9, head: 2.4, open: 0.5 });
      M.names.push({ lv: 'L1', x: X + 4, y: Y + 5, name: 'West room' }, { lv: 'L1', x: X + 12, y: Y + 5, name: 'East room' });
      M.section = { a: [X - 3, Y + 5], b: [X + 19, Y + 5], flip: false, far: null, on: true, name: 'A' };
      const snap = JSON.stringify(M); ws.apply(snap, false); __ws2.hub.change('plan', snap, false); return { X, Y }; }); await p.waitForTimeout(2500);
    if (await p.evaluate(() => __ws2.UI.view) === 'plan') { await p.click('[data-sp=dim]'); await p.waitForTimeout(1500); }
    const badge = () => p.evaluate(() => { const e = document.querySelector('.sp-xlb .sp-badge'); return e && !e.hidden ? +e.textContent : 0; });
    assert.equal(await p.locator('.sp-add .sp-xlb').count(), 1, 'the list sits under Add simulation'); assert.equal(await badge(), 0);

    // 1 · no "add to the list" buttons elsewhere any more: Generate pictures is the one way in (2026-11-09)
    await p.click('#addSimBtn'); await p.click('.w2-simmenu [data-addsim="sunhours"]'); await p.waitForTimeout(1500); await p.click('.sp-studycard [data-st=exp]'); await p.waitForTimeout(300);
    assert.equal(await p.locator('.sp-exp [data-st=xl-view]').count(), 0, 'no Add view to export list in the study'); await p.click('.sp-studycard [data-st=close]').catch(() => {}); await p.waitForTimeout(400);
    // 2 · Generate pictures: tick Sun hours (4 seasons), Natural ventilation (a view) and the section; each one's time and the total
    await p.click('.sp-xlb'); await p.waitForTimeout(800); const rows = await p.$$eval('.xl-gr label', (ls) => ls.map((l) => l.textContent.trim()));
    assert(rows.includes('Sun Hours') || rows.some((r) => /Sun hours/i.test(r)), 'Sun hours listed: ' + rows); assert(rows.some((r) => /Section A/.test(r)), 'the section listed: ' + rows);
    await p.check('[data-gp=sunhours]'); await p.waitForTimeout(200); for (const k of ['hours', 'two', 'seasons']) await p.click(`[data-gf="sunhours:${k}"]`);   // figure sets (2026-11-13): the 4 seasons only
    await p.check('[data-gp=vent]'); await p.waitForTimeout(200); for (const k of ['fresh', 'chart']) await p.click(`[data-gf="vent:${k}"]`); await p.check('[data-gp=section]'); await p.waitForTimeout(400);
    const gen = await p.evaluate(() => ({ t: [...document.querySelectorAll('.xl-gr.on')].map((r) => [r.querySelector('label').textContent.trim(), r.querySelector('.xl-t').textContent.trim()]), tot: document.querySelector('.xl-tot').innerText, go: document.querySelector('[data-g=go]').textContent }));
    const tSun = gen.t.find(([n]) => /Sun hours/i.test(n))[1], tVent = gen.t.find(([n]) => /ventilation/i.test(n))[1]; assert.match(tSun, /^~\d+ (s|min)|^~a second/, 'Sun hours: an estimate ' + tSun); assert.match(tVent, /first run|~/, 'ventilation: ' + tVent);
    assert.match(gen.tot, /3 figures from 2 runs · about[\s\S]*done around \d/, gen.tot); assert.match(gen.go, /Generate 3 figures/);
    await p.screenshot({ path: out + '/xl-generate.png' });
    console.log('PASS Generate pictures:', JSON.stringify(gen.t), '|', gen.tot.replace(/\s+/g, ' '));
    // 2b · Preview after the time: runs the study once, the person sets the 3D view, Use this view keeps it; the pictures come from it
    assert.equal(await p.locator('.xl-gr.on [data-gpv=sunhours]').innerText(), 'Preview'); assert.equal(await p.locator('[data-gpv=section]').count(), 0, 'no preview for the section');
    const tBox = await p.locator('.xl-gr.on:has([data-gpv=sunhours]) .xl-t').boundingBox(), pvBox = await p.locator('[data-gpv=sunhours]').boundingBox(); assert(pvBox.x >= tBox.x + tBox.width - 1, 'Preview sits after the time');
    await p.click('[data-gpv=sunhours]'); await p.waitForSelector('.xl-pvbar', { timeout: 240000 }); assert(await p.locator('.sp-pop-xl').isHidden(), 'the list steps aside for the preview'); const pvb = await p.locator('.xl-pvbar').boundingBox(); assert(pvb && pvb.y > 40 && pvb.y < 160 && pvb.width > 300, 'the preview bar is on screen at the top: ' + JSON.stringify(pvb));
    assert.match(await p.locator('.xl-pvbar').innerText(), /Preview · Sun hours[\s\S]*Orbit, pan and zoom[\s\S]*Use this view/);
    const cam0 = await p.evaluate(() => __ws2.inst.persp.ws.camView());
    await p.screenshot({ path: out + '/xl-preview.png' });
    await p.evaluate(() => __ws2.inst.persp.ws.camMove({ orbit: [0.7, 0.15], zoom: 0.8 })); await p.waitForTimeout(400);   // as an orbit and a zoom in the 3D view
    const cam1 = await p.evaluate(() => __ws2.inst.persp.ws.camView()); assert.notDeepEqual(cam1.p, cam0.p, 'the view turned');
    await p.click('.xl-pvbar [data-pv=use]'); await p.waitForTimeout(600); assert.equal(await p.locator('.xl-pvbar').count(), 0); assert(!(await p.locator('.sp-pop-xl').isHidden()), 'back to the list');
    assert.equal(await p.locator('[data-gpv=sunhours]').innerText(), 'View set ✓');
    await p.evaluate(() => { const w = __ws2.inst.persp.ws, f = w.snapAt.bind(w); window.__snapCams = []; w.snapAt = (...a) => { window.__snapCams.push(w.camView()); return f(...a); }; });
    console.log('PASS Preview: the view set and kept');
    // 3 · generate: one after another, the run at the top says which; all three join the list
    await p.click('[data-g=go]'); await p.waitForFunction(() => /1 of 3 · Sun hours/i.test(document.querySelector('.sp-runbar')?.innerText || ''), null, { timeout: 30000 });
    await p.waitForFunction(() => +document.querySelector('.sp-xlb .sp-badge')?.textContent === 3, null, { timeout: 900000 });
    await p.waitForFunction(() => /3 figures from 3 of 3 studies made for the export list/.test(document.querySelector('.sp-runbar')?.innerText || ''), null, { timeout: 60000 });
    assert.equal(await p.locator('.sp-pop-sec [data-sec=xl]').count(), 0, 'no Add to export list on the Section card');
    const snapCams = await p.evaluate(() => window.__snapCams.slice(0, 4)); assert.equal(snapCams.length, 4); for (const c of snapCams) assert(c.p.every((v, k) => Math.abs(v - cam1.p[k]) < 1e-6) && c.t.every((v, k) => Math.abs(v - cam1.t[k]) < 1e-6), 'the 4 season pictures from the view set: ' + JSON.stringify([c, cam1]));
    console.log('PASS generated: 3 items');

    // 4 · the list: three items in order, move the section up, a title
    if (await p.locator('.sp-pop-xl').isHidden()) await p.click('.sp-xlb'); await p.waitForTimeout(600); let titles = await p.$$eval('.xl-it .xl-tx b', (bs) => bs.map((x) => x.textContent));
    assert.equal(titles.length, 3); assert.match(titles[0], /Sun hours · 4 seasons/); assert.match(titles[1], /Natural ventilation/i); assert.match(titles[2], /Section A/);
    await p.click('.xl-it:nth-child(3) [data-xl=up]'); await p.waitForTimeout(400); titles = await p.$$eval('.xl-it .xl-tx b', (bs) => bs.map((x) => x.textContent)); assert.match(titles[0], /4 seasons/); assert.match(titles[1], /Section A/);
    await p.fill('.sp-pop-xl [data-xl=title]', 'QA report · sun and air'); await p.press('.sp-pop-xl [data-xl=title]', 'Tab'); await p.waitForTimeout(300);
    await p.screenshot({ path: out + '/xl-list.png' });
    console.log('PASS the list:', titles.join(' | '));

    // 5 · kept with the project in this browser
    await p.reload(); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 180000 }); await p.waitForTimeout(2500);
    assert.equal(await badge(), 3, 'kept after a reload'); await p.click('.sp-xlb'); await p.waitForTimeout(600);
    assert.equal(await p.inputValue('.sp-pop-xl [data-xl=title]'), 'QA report · sun and air'); assert.match((await p.$$eval('.xl-it .xl-tx b', (bs) => bs.map((x) => x.textContent)))[0], /4 seasons/);
    console.log('PASS kept after a reload');

    // 6 · the exports
    const dl = async (k) => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 240000 }), p.click(`.sp-pop-xl [data-xl=${k}]`)]); const f = out + '/' + d.suggestedFilename(); await d.saveAs(f); return { f, buf: fs.readFileSync(f), name: d.suggestedFilename() }; };
    const pdf = await dl('pdf'); assert.match(pdf.name, /qa-report-block-simulation-report-\d{4}-\d\d-\d\d\.pdf$/); const info = execFileSync('pdfinfo', [pdf.f]).toString(), pages = +/Pages:\s+(\d+)/.exec(info)[1];
    assert.equal(pages, 6, 'cover, summary, three chapters, limitations'); assert.match(info, /Page size:\s+612 x 792/, 'US Letter portrait (North American)');
    const fonts = execFileSync('pdffonts', [pdf.f]).toString(); assert.match(fonts, /DejaVu\s+CID TrueType\s+Identity-H\s+yes/, 'the font embedded');
    const text = execFileSync('pdftotext', ['-layout', pdf.f, '-']).toString().replace(/\s+/g, ' ');   // lines joined: a sentence may wrap
    for (const re of [/QA report · sun and air/, /Project information/, /Report status\s+Design-stage screening analysis; not a compliance submission/, /Prepared by\s+QA Architect/, /Date of issue\s+[A-Z][a-z]+ \d{1,2}, \d{4}/, /Summary of Results/, /Headline result/,
      /Direct Sunlight Hours — Equinoxes and Solstices/, /Section A — Natural Ventilation \(Air Change Rate\): Wind from/, /Figure 1\.1\s+21 March/, /Objective/, /Method/, /References/, /Inputs and Boundary Conditions/, /Simulation resolution/, /Results/, /Assumptions and Limitations/,
      /ANSI\/ASHRAE Standard 62\.1/, /One color scale for every figure/, /one value per room/i, /Assumptions, Limitations and Disclaimer/, /not a certification, a code-compliance demonstration, a LEED submission/, /Page ?1 ?of ?6/, /Page ?6 ?of ?6/]) assert.match(text, re, 'report text: ' + re);
    for (const bad of [/colour/i, /Project props/, /Workspace/, /detailed page/, /\bpicture/i]) assert.doesNotMatch(text, bad, 'report wording: ' + bad);
    execFileSync('pdftoppm', ['-r', '45', '-png', pdf.f, out + '/report']);
    const pptx = await dl('pptx'); const pz = pptx.buf.toString('latin1'); assert.equal(pptx.buf.toString('ascii', 0, 2), 'PK'); for (let n = 1; n <= 6; n++) assert(pz.includes(`ppt/slides/slide${n}.xml`), 'slide ' + n); assert(!pz.includes('ppt/slides/slide7.xml')); assert(((pz.match(/ppt\/media\/image\d+\.(jpeg|png)/g) || []).length) >= 6 * 2, 'pictures and legends in the slides');
    const z = await dl('zip'); const zn = [...z.buf.toString('latin1').matchAll(/PK\x01\x02[\s\S]{42}([\w./-]+\.(?:jpg|json))/g)].map((m) => m[1]); assert(zn.includes('report.json') && zn.filter((x) => x.endsWith('.jpg')).length === 6, 'zip: ' + zn.join(', '));
    console.log('PASS exports:', `PDF ${pages} pages ${Math.round(pdf.buf.length / 1024)} kB`, `PPTX ${Math.round(pptx.buf.length / 1024)} kB`, `ZIP ${zn.length} files`);

    // 7 · the model changes: the items are marked
    await p.evaluate(() => { const ws = __ws2.inst.plan.ws, M = JSON.parse(ws.model()); M.walls.push({ id: 'wx', lv: 'L1', a: [M.walls[0].a[0], M.walls[0].a[1] - 6], b: [M.walls[0].a[0] + 4, M.walls[0].a[1] - 6], t: 0.2, h: 3 }); const s = JSON.stringify(M); ws.apply(s, false); __ws2.hub.change('plan', s, false); }); await p.waitForTimeout(1500);
    await p.click('.sp-xlb'); await p.waitForTimeout(200); if (await p.locator('.sp-pop-xl').isHidden()) await p.click('.sp-xlb'); await p.waitForTimeout(500);
    assert.equal(await p.locator('.xl-it.stale').count(), 3, 'every item marked'); assert.match(await p.locator('.sp-pop-xl').innerText(), /The model has changed since/);
    await p.click('.xl-it:nth-child(3) [data-xl=del]'); await p.waitForTimeout(300); assert.equal(await badge(), 2);
    console.log('PASS marked when the model changes; remove');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
