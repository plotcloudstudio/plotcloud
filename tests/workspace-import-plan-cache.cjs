// Large files 6 (2026-11-19): the plan pane's layer of imported pieces, drawn once and put back. An OBJ of 4,600 objects, plan view:
//  1 the plan drawn with the layer kept is the same, pixel for pixel, as the plan drawn piece by piece; a redraw takes a small part
//    of the time (both printed);
//  2 hovering a piece does not draw the layer again (the hovered piece is outlined on top);
//  3 selecting a piece, and moving it down a floor, draw it again, and the plan is again the same as drawn piece by piece; no page errors.
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 960 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const objOf = (N) => { const out = []; let vn = 0; const side = Math.ceil(Math.sqrt(N)), s = 3;
      const faces = [[[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, 0], [1, 0, 0], [0, 0, 1]], [[0, 1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 0], [0, 1, 0], [0, 0, 1]], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]];
      for (let k = 0; k < N; k++) { const x = (k % side) * 1.5, y = Math.floor(k / side) * 1.5, z = (k % 7) * 3; out.push(`o piece_${k}`);
        for (const [o, u, v] of faces) { const st = vn; for (let j = 0; j <= s; j++) for (let i = 0; i <= s; i++) { out.push(`v ${x + o[0] + u[0] * i / s + v[0] * j / s} ${y + o[1] + u[1] * i / s + v[1] * j / s} ${z + o[2] + u[2] * i / s + v[2] * j / s}`); vn++; }
          for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) { const q = st + j * (s + 1) + i + 1; out.push(`f ${q} ${q + 1} ${q + s + 2} ${q + s + 1}`); } } }
      return out.join('\n') + '\n'; };
    const big = path.join(os.tmpdir(), 'plan-cache-4600.obj'); fs.writeFileSync(big, objOf(4600));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    const id = await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'plan' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); return S.createProject('Large', { units: 'm', layers: [], components: [] }).id; });
    await p.goto(base + '/mvp/#/workspace/' + id); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2.inst.plan.ready, null, { timeout: 300000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(800);
    await p.evaluate(() => { const u = document.querySelector('#up'); if (u) u.value = 'z'; }); await p.setInputFiles('#file', big); await p.locator('.ipv [data-ipv=ok]').waitFor({ timeout: 300000 });
    await p.click('.ipv [data-ipv=ok]'); await p.waitForFunction(() => (__ws2.model().studio.imports || []).length >= 4600, null, { timeout: 300000 }); await p.waitForTimeout(3000);
    const P = (fn, arg) => p.evaluate(([f, a]) => { const w = __ws2.inst.plan.win; return w.eval(`(${f})`)(w, a); }, [fn.toString(), arg]);
    // the plan drawn now, against the plan drawn piece by piece: share of pixels that differ
    // as seen on screen: a screenshot of the plan pane drawn with the layer kept, and one drawn piece by piece (reading the canvas
    // itself back makes the browser draw it another way, so the screen is compared)
    const frame = await p.evaluate(() => { const r = __ws2.inst.plan.win.frameElement.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    const shot = async (off) => { await P((w, o) => { w.__impNoCache = o; w.__impCache.draw(); }, off); return (await p.screenshot({ clip: frame })).toString('base64'); };
    const same = async () => { const a = await shot(false), bb = await shot(true); await P((w) => { w.__impNoCache = false; w.__impCache.draw(); });
      return p.evaluate(async ([a, bb]) => { const px = async (s) => { const im = await createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob()), c = new OffscreenCanvas(im.width, im.height), x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height).data; };
        const A = await px(a), B = await px(bb); let n = 0, ink = 0; for (let i = 0; i < A.length; i += 4) { if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 6) n++; if (B[i] < 200) ink++; } return { diff: n / (A.length / 4), ink: ink / (A.length / 4) }; }, [a, bb]); };
    const s0 = await same(); assert(s0.ink > 0.01, 'the pieces are on the plan: ' + JSON.stringify(s0)); assert(s0.diff < 0.001, 'the same plan: ' + JSON.stringify(s0));
    const tm = await P((w) => { const run = (off) => { w.__impNoCache = off; w.__impCache.draw(); const t = performance.now(); for (let k = 0; k < 10; k++) w.__impCache.draw(); return (performance.now() - t) / 10; }; const r = { off: run(true), on: run(false) }; w.__impNoCache = false; return r; });
    assert(tm.on < tm.off / 2, 'a redraw is faster with the layer kept: ' + JSON.stringify(tm));
    console.log(`PASS 1 the plan with the layer kept is the plan drawn piece by piece (${(s0.diff * 100).toFixed(3)} % of pixels differ); a redraw ${tm.off.toFixed(0)} → ${tm.on.toFixed(0)} ms`);
    // 2. hover: not drawn again
    const one = await p.evaluate(() => { const L = __ws2.model().studio.imports, z0 = Math.min(...L.map((q) => q.g.z)); return L.filter((q) => q.g.z < z0 + 0.01)[40].id; });
    const n0 = await P((w) => w.__impCache.drawn()); await P((w, i) => w.__impCache.hover(i), one); await P((w) => w.__impCache.hover(null)); const n1 = await P((w) => w.__impCache.drawn());
    assert.equal(n1, n0, 'hovering does not draw the layer again'); console.log('PASS 2 hovering a piece puts the layer back, without drawing 4,600 pieces again');
    // 3. selecting and moving draw it again, the same as piece by piece
    await p.evaluate((i) => __ws2.hub.select('test', { k: 'imp', id: i }), one); await p.waitForTimeout(800); const n2 = await P((w) => { w.__impCache.draw(); return w.__impCache.drawn(); }); assert(n2 > n1, 'selection drew it again');
    const s1 = await same(); assert(s1.diff < 0.001, 'with a piece selected: ' + JSON.stringify(s1));
    await p.waitForSelector('.w2-move:not([hidden])', { timeout: 10000 }); await p.click('.w2-move [data-mv=down]'); await p.waitForTimeout(2500);
    const n3 = await P((w) => { w.__impCache.draw(); return w.__impCache.drawn(); }); assert(n3 > n2, 'the move drew it again'); const s2 = await same(); assert(s2.diff < 0.001, 'after the move: ' + JSON.stringify(s2));
    console.log(`PASS 3 selecting a piece and moving it down a floor drew the layer again (${n3 - n1} times); the plan is still the one drawn piece by piece (${(s1.diff * 100).toFixed(3)} %, ${(s2.diff * 100).toFixed(3)} %)`);
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
