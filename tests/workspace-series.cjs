// Series (2026-11-09): Sun hours through the year from the study's Export area: 4 seasons (2 × 2) and 12 months (4 × 3), one
// colour scale, one camera for every tile (a drag in one turns all), and the exports: the sheet (PNG), every picture (ZIP) and
// an A3 PDF. Needs network access (site data).
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 }, acceptDownloads: true }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || require('os').tmpdir();
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    await p.goto(base + '/mvp/#/new-project'); await p.waitForFunction(() => window.__newProjectMap, null, { timeout: 30000 });
    await p.evaluate(() => window.__newProjectMap.place(49.2448, -123.0071, 'QA series block')); await p.waitForFunction(() => window.__newProjectMap.osm, null, { timeout: 120000 });
    await p.click('#npStart'); await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 180000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    await p.evaluate(() => { const ws = __ws2.inst.plan.ws, M = JSON.parse(ws.model()), c = M.site?.at || [0, 0], X = c[0] - 8, Y = c[1] - 5, id = (k) => k + Math.random().toString(36).slice(2, 8);
      const W = (a, b2) => M.walls.push({ id: id('w'), lv: 'L1', a: [X + a[0], Y + a[1]], b: [X + b2[0], Y + b2[1]], t: 0.2, h: 3 }); W([0, 0], [16, 0]); W([16, 0], [16, 10]); W([16, 10], [0, 10]); W([0, 10], [0, 0]); W([8, 0], [8, 10]);
      const snap = JSON.stringify(M); ws.apply(snap, false); __ws2.hub.change('plan', snap, false); }); await p.waitForTimeout(2500);
    if (await p.evaluate(() => __ws2.UI.view) === 'plan') { await p.click('[data-sp=dim]'); await p.waitForTimeout(1500); }
    await p.click('#addSimBtn'); await p.click('.w2-simmenu [data-addsim="sunhours"]'); await p.waitForTimeout(2000);
    await p.click('.sp-studycard [data-st=exp]'); await p.waitForTimeout(300);
    const ex = await p.locator('.sp-exp').innerText(); assert.match(ex, /Series[\s\S]*12 months[\s\S]*4 seasons[\s\S]*21st of each month/);

    // 1 · four seasons: the run at the top, then the preview, 2 × 2, every tile drawn
    const t0 = Date.now(); await p.click('.sp-exp [data-st=ser-seasons]'); await p.waitForTimeout(200);
    const bar = await p.evaluate(() => { const e = document.querySelector('.sp-runbar'); return e && !e.hidden ? e.innerText : ''; }); assert.match(bar, /Sun hours[\s\S]*(left|picture)/i, 'the run at the top: ' + bar);
    await p.waitForSelector('.sx', { timeout: 240000 }); await p.waitForSelector('.sx[data-ready="1"]', { timeout: 240000 });   // every tile drawn at full resolution (a blank canvas is 300 wide too) await p.waitForTimeout(1500);
    const g4 = await p.evaluate(() => { const t = [...document.querySelectorAll('.sx-tile')], r = t.map((e) => e.getBoundingClientRect()); return { n: t.length, labels: t.map((e) => e.querySelector('figcaption').textContent), cols: new Set(r.map((q) => Math.round(q.x))).size, rows: new Set(r.map((q) => Math.round(q.y))).size, win: document.querySelector('.sx-win').getBoundingClientRect().width / innerWidth, legend: document.querySelector('.sx-lab').textContent }; });
    assert.equal(g4.n, 4); assert.equal(g4.cols, 2); assert.equal(g4.rows, 2); assert.deepEqual(g4.labels, ['21 March', '21 June', '23 September', '21 December']); assert(Math.abs(g4.win - 0.7) < 0.02, 'the size of the import preview: ' + g4.win);
    const sig = () => p.evaluate(() => [...document.querySelectorAll('.sx-tile canvas')].map((c) => { const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < x.length; i += 97) h = (h * 31 + x[i]) >>> 0; return h; }));
    const s0 = await sig(); assert.equal(new Set(s0).size, 4, 'four different pictures: ' + s0);
    console.log('PASS 4 seasons:', JSON.stringify(g4), Math.round((Date.now() - t0) / 1000) + ' s');
    await p.screenshot({ path: out + '/series-4.png' });

    // 2 · one camera: dragging the first tile turns the last one too
    const tb = await p.locator('.sx-tile canvas').first().boundingBox(); await p.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2); await p.mouse.down(); await p.mouse.move(tb.x + tb.width / 2 + 120, tb.y + tb.height / 2 + 20, { steps: 8 }); await p.mouse.up();
    await p.waitForSelector('.sx[data-ready="1"]', { timeout: 240000 });
    const s1 = await sig(); assert(s1.every((v, i) => v !== s0[i]), 'every tile follows the drag: ' + JSON.stringify([s0, s1]));
    console.log('PASS one camera for every tile');

    // 3 · exports: the sheet, every picture, the PDF
    const dl = async (k) => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 180000 }), p.click(`.sx [data-sx=${k}]`)]); const f = out + '/' + d.suggestedFilename(); await d.saveAs(f); return { f, buf: fs.readFileSync(f), name: d.suggestedFilename() }; };
    const png = await dl('png'); assert.match(png.name, /qa-series-block-sun-hours-4-seasons\.png$/); assert.equal(png.buf.toString('ascii', 1, 4), 'PNG'); const pw = png.buf.readUInt32BE(16), ph = png.buf.readUInt32BE(20); assert(pw >= 2400 && ph >= 1500, 'print size: ' + [pw, ph]);
    const z = await dl('zip'); const names = [...z.buf.toString('latin1').matchAll(/PK\x01\x02[\s\S]{42}([\w.-]+\.(?:png|json))/g)].map((m) => m[1]); assert(names.includes('sheet.png') && names.includes('series.json') && names.filter((x) => /^\d\d-/.test(x)).length === 4, 'zip: ' + names);
    const js = JSON.parse(z.buf.toString('latin1').match(/\{\s*"study"[\s\S]*?"generated": "[^"]+"\s*\}/)[0]); assert.equal(js.pictures.length, 4); assert(js.colourScale.to > js.colourScale.from && js.quality === 'Draft' && js.site.lat, JSON.stringify(js).slice(0, 300));
    const pdf = await dl('pdf'); assert.equal(pdf.buf.toString('ascii', 0, 4), '%PDF'); assert.equal((pdf.buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length, 1, 'one A3 page'); assert((pdf.buf.toString('latin1').match(/\/Subtype\s*\/Image/g) || []).length >= 4, 'the pictures as images');
    console.log('PASS exports:', `sheet ${pw}×${ph} ${Math.round(png.buf.length / 1024)} kB`, `zip ${names.length} files`, `pdf ${Math.round(pdf.buf.length / 1024)} kB`);

    // 4 · close: the view comes back; twelve months, 4 × 3
    await p.click('.sx [data-sx=close]'); await p.waitForTimeout(500); assert.equal(await p.locator('.sx').count(), 0);
    if (await p.locator('.sp-exp').count() === 0) await p.click('.sp-studycard [data-st=exp]');
    await p.click('.sp-exp [data-st=ser-months]'); await p.waitForSelector('.sx', { timeout: 300000 }); await p.waitForSelector('.sx[data-ready="1"]', { timeout: 300000 });
    const g12 = await p.evaluate(() => { const t = [...document.querySelectorAll('.sx-tile')], r = t.map((e) => e.getBoundingClientRect()); return { n: t.length, first: t[0].querySelector('figcaption').textContent, last: t[11].querySelector('figcaption').textContent, cols: new Set(r.map((q) => Math.round(q.x))).size, rows: new Set(r.map((q) => Math.round(q.y))).size }; });
    assert.deepEqual(g12, { n: 12, first: '21 January', last: '21 December', cols: 4, rows: 3 });
    await p.waitForSelector('.sx[data-ready="1"]', { timeout: 300000 }); await p.screenshot({ path: out + '/series-12.png', timeout: 120000 });
    console.log('PASS 12 months, 4 × 3');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300); assert.equal(await p.locator('.sx').count(), 0, 'Esc closes');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
