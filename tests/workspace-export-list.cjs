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
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA Architect', email: 'qa@x.test' }; S.save(); });
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
    await p.check('[data-gp=sunhours]'); await p.waitForTimeout(200); await p.selectOption('select[data-gk=sunhours]', 'seasons'); await p.check('[data-gp=vent]'); await p.check('[data-gp=section]'); await p.waitForTimeout(400);
    const gen = await p.evaluate(() => ({ t: [...document.querySelectorAll('.xl-gr.on')].map((r) => [r.querySelector('label').textContent.trim(), r.querySelector('.xl-t').textContent.trim()]), tot: document.querySelector('.xl-tot').innerText, go: document.querySelector('[data-g=go]').textContent }));
    const tSun = gen.t.find(([n]) => /Sun hours/i.test(n))[1], tVent = gen.t.find(([n]) => /ventilation/i.test(n))[1]; assert.match(tSun, /^~\d+ (s|min)|^~a second/, 'Sun hours: an estimate ' + tSun); assert.match(tVent, /first run|~/, 'ventilation: ' + tVent);
    assert.match(gen.tot, /6 pictures · about[\s\S]*done around \d/, gen.tot); assert.match(gen.go, /Generate 6 pictures/);
    await p.screenshot({ path: out + '/xl-generate.png' });
    console.log('PASS Generate pictures:', JSON.stringify(gen.t), '|', gen.tot.replace(/\s+/g, ' '));
    // 3 · generate: one after another, the run at the top says which; all three join the list
    await p.click('[data-g=go]'); await p.waitForFunction(() => /1 of 3 · Sun hours/i.test(document.querySelector('.sp-runbar')?.innerText || ''), null, { timeout: 30000 });
    await p.waitForFunction(() => +document.querySelector('.sp-xlb .sp-badge')?.textContent === 3, null, { timeout: 900000 });
    await p.waitForFunction(() => /3 of 3 made for the export list/.test(document.querySelector('.sp-runbar')?.innerText || ''), null, { timeout: 60000 });
    assert.equal(await p.locator('.sp-pop-sec [data-sec=xl]').count(), 0, 'no Add to export list on the Section card');
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
    const pdf = await dl('pdf'); assert.match(pdf.name, /qa-report-block-report-\d{4}-\d\d-\d\d\.pdf$/); const info = execFileSync('pdfinfo', [pdf.f]).toString(), pages = +/Pages:\s+(\d+)/.exec(info)[1];
    assert.equal(pages, 5, 'cover, three items, basis and limits'); assert.match(info, /Page size:\s+1190\.55 x 841\.89/, 'A3 landscape');
    const fonts = execFileSync('pdffonts', [pdf.f]).toString(); assert.match(fonts, /DejaVu\s+CID TrueType\s+Identity-H\s+yes/, 'the font embedded');
    const text = execFileSync('pdftotext', ['-layout', pdf.f, '-']).toString();
    for (const re of [/QA report · sun and air/, /Contents/, /4 seasons/, /Key results/, /Legend/, /Method/, /Basis/, /Quality Draft/, /model (v\d+|unsaved draft)/, /one value per room/i, /Basis and limits/, /not a certification/, /prepared by QA Architect/, /1 ?\/ ?5/, /5 ?\/ ?5/]) assert.match(text, re, 'report text: ' + re);
    execFileSync('pdftoppm', ['-r', '45', '-png', pdf.f, out + '/report']);
    const pptx = await dl('pptx'); const pz = pptx.buf.toString('latin1'); assert.equal(pptx.buf.toString('ascii', 0, 2), 'PK'); for (let n = 1; n <= 5; n++) assert(pz.includes(`ppt/slides/slide${n}.xml`), 'slide ' + n); assert(!pz.includes('ppt/slides/slide6.xml')); assert(((pz.match(/ppt\/media\/image\d+\.(jpeg|png)/g) || []).length) >= 6 * 2, 'pictures and legends in the slides');
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
