// Large imported models (2026-11-18), in an empty Workspace project:
//  1 the limits shown are 100 MiB and 500,000 triangles;
//  2 a binary STL of 520,000 triangles: a dialog says it is too large, with its count and the limit; nothing is imported;
//  3 a large OBJ: reading shows a progress card with Cancel; Cancel stops it, no preview, nothing imported;
//  4 an OBJ of 4,600 objects and about 497,000 triangles opens: the preview, then every object in the project; the 3D view draws them
//    in a few batches (not one draw per object), a point on one object still picks that object, and selecting it outlines it;
//  5 moving one object down a floor moves only it (the batches follow); the time for it is printed;
//  6 Illustration: no edge lines on the imported meshes (over 20,000 triangles); no page errors.
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 960 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], shots = process.env.SHOT_DIR || os.tmpdir();
    p.on('pageerror', (e) => errs.push(e.message));
    // the files: an OBJ of N small subdivided boxes (108 triangles each, on 7 heights), a binary STL over the limit
    const objOf = (N) => { const out = []; let vn = 0; const side = Math.ceil(Math.sqrt(N)), s = 3;
      const faces = [[[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, 0], [1, 0, 0], [0, 0, 1]], [[0, 1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 0], [0, 1, 0], [0, 0, 1]], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]];
      for (let k = 0; k < N; k++) { const x = (k % side) * 1.5, y = Math.floor(k / side) * 1.5, z = (k % 7) * 3; out.push(`o piece_${k}`);
        for (const [o, u, v] of faces) { const st = vn; for (let j = 0; j <= s; j++) for (let i = 0; i <= s; i++) { out.push(`v ${x + o[0] + u[0] * i / s + v[0] * j / s} ${y + o[1] + u[1] * i / s + v[1] * j / s} ${z + o[2] + u[2] * i / s + v[2] * j / s}`); vn++; }
          for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) { const q = st + j * (s + 1) + i + 1; out.push(`f ${q} ${q + 1} ${q + s + 2} ${q + s + 1}`); } } }
      return out.join('\n') + '\n'; };
    const big = path.join(os.tmpdir(), 'large-4600.obj'); fs.writeFileSync(big, objOf(4600));
    const over = path.join(os.tmpdir(), 'over-limit.stl'), nT = 520000, buf = Buffer.alloc(84 + 50 * nT); buf.writeUInt32LE(nT, 80);
    for (let t = 0; t < nT; t++) { const o = 84 + t * 50 + 12, x = (t % 1000) * 0.01, y = Math.floor(t / 1000) * 0.01; [x, y, 0, x + 0.01, y, 0, x, y + 0.01, 0].forEach((v, j) => buf.writeFloatLE(v, o + j * 4)); } fs.writeFileSync(over, buf);
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    const id = await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'persp' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); return S.createProject('Large', { units: 'm', layers: [], components: [] }).id; });
    await p.goto(base + '/mvp/#/workspace/' + id); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2.inst.plan.ready, null, { timeout: 300000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(800);
    const nImp = () => p.evaluate(() => (__ws2.model().studio.imports || []).length);
    // 1. the limits
    const lim = await p.evaluate(async () => (await import('./js/viewport.js?v=bigfile-20261118-1')).IMPORT_LIMITS); assert.deepEqual(lim, { tris: 500000, mib: 100 });
    console.log('PASS 1 the limits: 500,000 triangles and 100 MiB');
    // 2. over the limit: the dialog, nothing imported
    await p.evaluate(() => { const u = document.querySelector('#up'); if (u) u.value = 'z'; }); await p.setInputFiles('#file', over);
    await p.waitForSelector('.w2-impbig [role=alertdialog]', { timeout: 120000 }); const dlg = await p.locator('.w2-impbig').innerText();
    assert.match(dlg, /too large to open here/); assert.match(dlg, /520,000 triangles \(limit 500,000\)/); assert.match(dlg, /Reduce Mesh/); assert.equal(await nImp(), 0);
    await p.locator('.w2-impbig').screenshot({ path: shots + '/large-too-big.png' }); await p.click('.w2-impbig [data-ok]'); assert.equal(await p.locator('.w2-impbig').count(), 0);
    console.log('PASS 2 an STL of 520,000 triangles: "' + dlg.split('\n').find((l) => /triangles/.test(l)).trim() + '"; nothing imported');
    // 3. reading with progress, then Cancel
    await p.setInputFiles('#file', big); await p.waitForSelector('.w2-impprog', { timeout: 30000 }); assert.match(await p.locator('.w2-impprog').innerText(), /Reading large-4600\.obj/);
    await p.click('.w2-impprog [data-cancel]'); await p.waitForTimeout(1500);
    assert.equal(await p.locator('.ipv [data-ipv=ok]').count(), 0, 'no preview after Cancel'); assert.equal(await p.locator('.w2-impprog').count(), 0); assert.equal(await nImp(), 0);
    assert.match(await p.locator('#impMsg').textContent(), /Import cancelled/); console.log('PASS 3 reading showed its progress with Cancel; Cancel stopped it: no preview, nothing imported');
    // 4. the large OBJ opens
    let t = Date.now(); await p.setInputFiles('#file', big); await p.locator('.ipv [data-ipv=ok]').waitFor({ timeout: 300000 }); const tRead = Date.now() - t;
    assert.match(await p.locator('[data-ipv-size]').innerText(), /4600 objects · 496,800 triangles/);
    t = Date.now(); await p.click('.ipv [data-ipv=ok]'); await p.waitForFunction(() => (__ws2.model().studio.imports || []).length >= 4600, null, { timeout: 300000 }); const tConf = Date.now() - t; await p.waitForTimeout(2500);
    const S3 = (fn, arg) => p.evaluate(([f, a]) => { const w = __ws2.inst.persp.win, s = w.S3.api || w.S3; return s[f](...(a || [])); }, [fn, arg]);
    const im = await S3('_imp'); assert(im.batches >= 8 && im.batches <= 30 && im.pieces + im.single === 4600 && im.single < 100, JSON.stringify(im));
    const top = await p.evaluate(() => { const L = __ws2.model().studio.imports, z0 = Math.min(...L.map((q) => q.g.z)), low = L.filter((q) => q.g.z < z0 + 0.01), cx = low.reduce((a, q) => a + q.g.x, 0) / low.length, cy = low.reduce((a, q) => a + q.g.y, 0) / low.length, o = low.reduce((a, q) => (Math.hypot(q.g.x - cx, q.g.y - cy) < Math.hypot(a.g.x - cx, a.g.y - cy) ? q : a));   /* on the lowest floor, near the middle */ return { id: o.id, x: o.g.x + o.g.w / 2, y: o.g.y + o.g.d / 2, z: o.g.z + o.g.h }; });
    const hits = await S3('_impHit', [top.x, top.y, top.z]); assert(hits.includes('imp:' + top.id), 'the point on the piece picks it: ' + hits.slice(0, 4).join());
    await p.evaluate((i) => __ws2.hub.select('test', { k: 'imp', id: i }), top.id); await p.waitForTimeout(800); const sel = await S3('_imp'); assert(sel.outlines >= 1, 'the selected piece outlined: ' + JSON.stringify(sel));
    await p.screenshot({ path: shots + '/large-import.png' });
    console.log(`PASS 4 4,600 objects, 496,800 triangles: read in ${(tRead / 1000).toFixed(1)} s, added in ${(tConf / 1000).toFixed(1)} s; drawn in ${im.batches} batches (${im.single} alone); a point on one picks it; selected, it is outlined`);
    // 5. one object down a floor
    const z0 = await p.evaluate((i) => __ws2.model().studio.imports.find((o) => o.id === i).g.z, top.id), others = await p.evaluate((i) => __ws2.model().studio.imports.filter((o) => o.id !== i).reduce((s, o) => s + o.g.z, 0), top.id);
    await p.waitForSelector('.w2-move:not([hidden])', { timeout: 10000 }); t = Date.now(); await p.click('.w2-move [data-mv=down]'); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))); const tEdit = Date.now() - t; await p.waitForTimeout(2500);
    const z1 = await p.evaluate((i) => __ws2.model().studio.imports.find((o) => o.id === i).g.z, top.id), others1 = await p.evaluate((i) => __ws2.model().studio.imports.filter((o) => o.id !== i).reduce((s, o) => s + o.g.z, 0), top.id);
    assert(z1 < z0 - 0.5 && Math.abs(others1 - others) < 1e-6, JSON.stringify({ z0, z1 })); const hits2 = await S3('_impHit', [top.x, top.y, z1 + 1]); assert(hits2.includes('imp:' + top.id), 'picked where it now is');
    console.log(`PASS 5 one object down a floor (${z0} → ${z1} m), the rest unchanged; on screen ${tEdit} ms after the click`);
    // 6. Illustration: no edge lines on the imported meshes
    await p.evaluate(() => __ws2.inst.persp.ws.display('illus')); await p.waitForTimeout(1500); const ill = await S3('_imp'); assert.equal(ill.edges, 0, JSON.stringify(ill));
    await p.evaluate(() => __ws2.inst.persp.ws.display('shaded')); console.log('PASS 6 Illustration over 20,000 imported triangles: no edge lines on them');
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
