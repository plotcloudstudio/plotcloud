// Render (2026-11-19), hospital example, with OpenAI replaced by a stand-in (no real key or image model is used):
//  1 the Render button opens the window; it says the images come from OpenAI with the person's own key and are not a result;
//  2 a wrong key is refused with OpenAI's reason; a good one lists only the image models; the key is kept for this session only;
//  3 Capture the 3D view: the base at 1536 × 1024, with its level and that level's modelled furniture named;
//  4 a product picture added as a reference and named; an area painted (a box) over the base;
//  5 Generate sends one edit request to api.openai.com: the view first, then the reference, the mask, and wording that keeps the
//    camera, geometry and layout, names the furniture and the reference, and changes only the painted area; the render is kept
//    (its details in the project, its image in this browser) and shown beside the view;
//  6 its PNG has a caption band saying what it is and is not; the comparison saves side by side;
//  7 after the model changes, the render is marked as showing an earlier model; the key went to no other host; no page errors.
const { chromium } = require('playwright'), assert = require('node:assert/strict'), zlib = require('node:zlib'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const png = (w, h, rgb) => { const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rgb(x, y).forEach((v, k) => raw[y * (w * 3 + 1) + 1 + x * 3 + k] = v);
  const crc = (b) => { let c = ~0; for (const v of b) { c ^= v; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return ~c >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 1600, height: 960 }, acceptDownloads: true }), p = await ctx.newPage(), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], shots = process.env.SHOT_DIR || os.tmpdir();
    p.on('pageerror', (e) => errs.push(e.message)); const authTo = new Set(); p.on('request', (r) => { const a = r.headers().authorization || ''; if (/sk-/.test(a)) authTo.add(new URL(r.url()).host); });
    const edits = [], result = png(1536, 1024, (x, y) => [200 - (y >> 3), 170, 120 + (x >> 4)]).toString('base64');
    await ctx.route('https://api.openai.com/**', async (r) => { const u = new URL(r.request().url()), auth = r.request().headers().authorization;
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization', 'access-control-allow-methods': 'GET, POST' } });
      const H = { 'access-control-allow-origin': '*' };
      if (auth !== 'Bearer sk-test-good') return r.fulfill({ status: 401, headers: H, json: { error: { message: 'Incorrect API key provided.' } } });
      if (u.pathname === '/v1/models') return r.fulfill({ headers: H, json: { data: [{ id: 'gpt-4.1' }, { id: 'gpt-image-1.5' }, { id: 'gpt-image-2.5-flare' }, { id: 'dall-e-2' }] } });
      if (u.pathname === '/v1/images/edits') { edits.push(r.request().postDataBuffer().toString('latin1')); return r.fulfill({ headers: H, json: { created: 1, data: [{ b64_json: result }] } }); }
      return r.fulfill({ status: 404, headers: H, json: { error: { message: 'not here' } } }); });
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'persp' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    const id = await p.evaluate(async () => (await import('./js/hospital-example.js')).openHospital().id); await p.goto(base + '/mvp/#/workspace/' + id);
    await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(3000);
    // 1
    await p.click('[data-sp="render"]'); await p.waitForSelector('.rn [data-rn="capture"]'); const head = await p.locator('.rn-hd').innerText();
    assert.match(head, /OpenAI[\s\S]*your own key[\s\S]*Not a daylight, comfort or other performance result/); assert.match(await p.locator('.rn-side').innerText(), /sent only to api\.openai\.com/);
    console.log('PASS 1 Render opens from the Workspace; it says OpenAI, your own key, and not a performance result');
    // 2
    await p.fill('#rnKey', 'sk-test-bad'); await p.click('[data-rn="connect"]'); await p.waitForFunction(() => /did not accept this key/.test(document.querySelector('[data-rn-kmsg]').textContent));
    await p.fill('#rnKey', 'sk-test-good'); await p.click('[data-rn="connect"]'); await p.waitForFunction(() => /Connected/.test(document.querySelector('[data-rn-kmsg]').textContent));
    const models = await p.$$eval('#rnModel option', (o) => o.map((x) => x.value)); assert.deepEqual(models, ['gpt-image-2.5-flare', 'gpt-image-1.5']);
    const kept = await p.evaluate(() => ({ s: sessionStorage.getItem('pc-openai-key'), l: localStorage.getItem('pc-openai-key') })); assert.deepEqual(kept, { s: 'sk-test-good', l: null });
    console.log('PASS 2 a wrong key refused ("' + (await p.locator('[data-rn-kmsg]').innerText()).slice(0, 0) + 'did not accept this key"); a good one lists 2 image models (not gpt-4.1 or dall-e-2); kept for this session only');
    // 3
    await p.click('[data-rn="capture"]'); await p.waitForSelector('.rn-frame canvas', { timeout: 60000 }); const vinfo = await p.locator('[data-rn-vinfo]').innerText();
    const dims = await p.evaluate(() => { const c = document.querySelector('.rn-frame canvas'); return [c.width, c.height]; }); assert.deepEqual(dims, [1536, 1024]); assert.match(vinfo, /1536 × 1024/);
    const furn = await p.locator('[data-rn-furn] li').count(), fc = await p.locator('[data-rn-fcount]').innerText(); assert(furn >= 1, 'the level\'s furniture is listed');
    console.log(`PASS 3 the 3D view captured at 1536 × 1024 (${vinfo}); ${fc}`);
    // 4
    const ref = path.join(os.tmpdir(), 'lounge-chair.png'); fs.writeFileSync(ref, png(300, 300, (x, y) => (Math.hypot(x - 150, y - 150) < 110 ? [90, 120, 95] : [245, 245, 245])));
    await p.setInputFiles('#rnRefFile', ref); await p.waitForSelector('[data-rn-rn="0"]'); assert.equal(await p.inputValue('[data-rn-rn="0"]'), 'lounge chair');
    await p.click('[data-rn-tool="rect"]'); const cb = await p.locator('.rn-frame canvas').boundingBox();
    await p.mouse.move(cb.x + cb.width * 0.3, cb.y + cb.height * 0.4); await p.mouse.down(); await p.mouse.move(cb.x + cb.width * 0.55, cb.y + cb.height * 0.6, { steps: 6 }); await p.mouse.move(cb.x + cb.width * 0.6, cb.y + cb.height * 0.8, { steps: 4 }); await p.mouse.up();
    const reg = await p.locator('[data-rn-reg]').innerText(), pct = +reg.match(/(\d+) %/)[1]; assert(pct >= 10 && pct <= 15, reg);   // 30 % × 40 % of the view = 12 %
    console.log(`PASS 4 a product picture added as a reference ("lounge chair"); a box painted: ${reg}`);
    // 5
    await p.fill('#rnDesc', 'Patient lounge, pale oak, sage upholstery'); await p.click('[data-rn="go"]');
    await p.waitForFunction(() => /Done: 1 render/.test(document.querySelector('[data-rn-gmsg]').textContent), null, { timeout: 60000 }); assert.equal(edits.length, 1);
    const body = edits[0], parts = body.split(/--[-\w]+\r\n/).filter(Boolean), field = (n) => { const q = parts.find((x) => x.includes(`name="${n}"`)); return q ? q.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '') : null; };
    assert.equal(field('model'), 'gpt-image-2.5-flare'); assert.equal(field('size'), '1536x1024'); assert.equal(field('n'), '1'); assert.equal(parts.filter((x) => x.includes('name="image[]"')).length, 2); assert(parts.some((x) => x.includes('name="mask"')), 'the mask is sent');
    assert(parts.find((x) => x.includes('name="image[]"')).includes('filename="view.png"'), 'the view first'); const pr = field('prompt');
    for (const re of [/Keep exactly the camera position/, /Furniture in the view \(as modelled\): /, /Image 2 is a reference for "lounge chair"/, /Change only the transparent \(masked\) area/, /Design intent: Patient lounge, pale oak, sage upholstery/]) assert.match(pr, re);
    const saved = await p.evaluate(async () => { const r = __ws2.model ? null : null; const S = await import('./js/store.js'), pj = S.project(location.hash.split('/').pop()), x = pj.renders[0]; const RA = await import('./js/render-ai.js?v=render-20261119-1'), rec = await RA.getImages(x.id);
      return { n: pj.renders.length, model: x.model, level: x.level, refs: x.refs, region: x.region, evidence: x.evidence, hasImg: /^data:image\/png/.test(rec?.result || ''), hasSrc: /^data:image\/png/.test(rec?.source || ''), inProject: JSON.stringify(pj).includes(rec.result.slice(30, 90)) }; });
    assert.equal(saved.n, 1); assert.equal(saved.model, 'gpt-image-2.5-flare'); assert.deepEqual(saved.refs, ['lounge chair']); assert(saved.region > 0.1 && saved.region < 0.15); assert.equal(saved.evidence, 'presentation only'); assert(saved.hasImg && saved.hasSrc && !saved.inProject, JSON.stringify(saved));
    assert.equal(await p.locator('[data-rn-mode="cmp"]').getAttribute('aria-pressed'), 'true'); await p.waitForSelector('.rn-cmp [data-rn-split]');
    await p.locator('.rn-win').screenshot({ path: shots + '/render-window.png' });
    console.log(`PASS 5 one request to OpenAI: the view, the reference, the mask, ${pr.split('\n').length} lines of wording that keep the layout; the render kept (details in the project, image in this browser, level "${saved.level}") and shown beside the view`);
    // 6
    let [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-rn-dl]')]); let f = await dl.path(); const head2 = fs.readFileSync(f);
    assert.equal(head2.readUInt32BE(16), 1536); assert(head2.readUInt32BE(20) > 1024 + 40, 'a caption band under the image'); assert.match(dl.suggestedFilename(), /-render-1\.png$/);
    [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-rn="cmpsave"]')]); f = await dl.path(); assert(fs.readFileSync(f).readUInt32BE(16) > 2000, 'two images side by side'); assert.match(dl.suggestedFilename(), /-compare\.png$/);
    console.log('PASS 6 the PNG has its caption band (' + head2.readUInt32BE(16) + ' × ' + head2.readUInt32BE(20) + '); the comparison saved side by side');
    // 7
    await p.click('[data-rn="close"]'); await p.evaluate(() => { const st = __ws2.model().studio, w = st.walls[0]; __ws2.inst.plan.ws.select({ k: 'wall', id: w.id }); }); await p.waitForTimeout(300);
    await p.evaluate(() => __ws2.UI.sels = ['ps:wall:' + __ws2.model().studio.walls[0].id]); await p.evaluate(() => { document.activeElement?.blur?.(); }); await p.keyboard.press('Delete'); await p.waitForTimeout(2500);
    await p.click('[data-sp="render"]'); await p.waitForSelector('.rn-card'); assert.match(await p.locator('.rn-card').innerText(), /The model has changed since this render/);
    assert.deepEqual([...authTo], ['api.openai.com'], 'the key went only to OpenAI');
    console.log('PASS 7 after the model changed, the render is marked as showing an earlier model; the key went only to api.openai.com');
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
