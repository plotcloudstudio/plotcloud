// Fixes of 2026-11-15:
// · the avatar menu reads in the dark site header (its name, Dashboard, Account settings were white on white)
// · Cameras, Cover everything at 100 %: the floor is covered in full (the search's 25 cm points missed slivers of the floor cells)
// · Wind flow: the buildings stay plain, with an upright slice along the wind in the wind's colours; on Single direction · Pressure the
//   facades show the pressure, which differs face by face
const { chromium } = require('playwright'), assert = require('node:assert/strict'), os = require('node:os');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || os.tmpdir();
    const run = async () => { await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 1500000 }); const e = await p.evaluate(() => window.__wsStudy.state().err); assert.equal(e, ''); await p.waitForTimeout(1500); };
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'You', email: 'you@studio.com' }; S.save(); localStorage.setItem('pc-unfold', '1'); });
    // the avatar menu
    await p.goto(base + '/mvp/#/home'); await p.waitForSelector('#whoBtn'); await p.click('#whoBtn'); await p.hover('#whoMenu a[href^="#/account"]');
    const ink = await p.$$eval('#whoMenu b, #whoMenu a, #whoMenu button', (es) => es.map((e) => { const m = getComputedStyle(e).color.match(/\d+/g).map(Number); return [e.textContent.trim(), (m[0] * 299 + m[1] * 587 + m[2] * 114) / 1000]; }));
    assert(ink.length >= 4 && ink.every(([, l]) => l < 120), 'dark ink on the white menu: ' + JSON.stringify(ink)); await p.screenshot({ path: `${out}/fix-menu.png`, clip: { x: 1100, y: 0, width: 500, height: 420 } }); console.log('PASS the avatar menu reads:', JSON.stringify(ink));
    await p.keyboard.press('Escape');
    // the hospital
    await p.goto(base + '/mvp/#/home'); await p.waitForSelector('[data-hospital]'); await p.click('.ph-thumb[data-hospital]');
    await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    // cameras at 100 %
    await p.evaluate(() => window.__wsStudy.open('cameras')); await p.waitForTimeout(1000); await p.click('.sp-studycard [data-st-mode="all"]'); await p.waitForTimeout(300); await p.selectOption('.sp-studycard [data-cam=camWant]', '1'); await p.waitForTimeout(300); await run();
    const cam = await p.evaluate(() => { const r = window.__wsStudy.state().res; return { avg: r.avg, rows: r.rows.map((x) => x.join(': ')), foot: r.foot }; });
    assert(cam.avg >= 100 - 1e-6 || cam.rows.some((x) => /^Short of the 100% asked/.test(x)), 'everything covered, or said why not: ' + JSON.stringify(cam)); assert.match(cam.rows[0], /^Floor covered: 100(\.0)?%/, cam.rows[0]);
    console.log('PASS cameras at 100%:', cam.rows[0], '·', cam.rows[1], '·', cam.foot);
    // wind, the year: buildings plain, the upright slice
    await p.evaluate(() => window.__wsStudy.open('wind')); await p.waitForTimeout(1000); await run();
    const wy = await p.evaluate(() => { const r = window.__wsStudy.state().res, v = r.vslice; return { sv: Object.values(r.views).filter((x) => x.svals).length, on: __ws2.inst.persp.ws.vplaneOn(), v: v && { nx: v.nx, ny: v.ny, fin: Array.from(v.vals).filter(Number.isFinite).length, hole: Array.from(v.vals).filter((x) => !Number.isFinite(x)).length, hi: v.hi, dn: v.dn } }; });
    assert.equal(wy.sv, 0, 'no view paints the buildings'); assert(wy.on && wy.v && wy.v.fin > 1000 && wy.v.hole > 10, 'the upright slice, the buildings cut out of it: ' + JSON.stringify(wy));
    assert.match(await p.locator('.sp-legend').innerText(), /Upright slice · wind from/); assert.match(await p.evaluate(() => window.__wsStudy.state().res.method), /upright slice along the wind/);
    await p.evaluate(() => __ws2.inst.persp.ws.camMove({ orbit: [1.6, -0.45], zoom: 1.8 })); await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/fix-wind-slice.png` });
    await p.click('.sp-studycard [data-st=vslice]'); await p.waitForTimeout(400); assert.equal(await p.evaluate(() => __ws2.inst.persp.ws.vplaneOn()), false, 'hidden'); await p.click('.sp-studycard [data-st=vslice]'); await p.waitForTimeout(400); assert.equal(await p.evaluate(() => __ws2.inst.persp.ws.vplaneOn()), true, 'shown again');
    console.log('PASS wind, the year: buildings plain, upright slice', JSON.stringify(wy.v));
    // single direction: pressure on the facades differs face by face
    await p.click('.sp-studycard [data-st-mode="single"]'); await p.waitForTimeout(400); await run();
    const ws = await p.evaluate(() => { const r = window.__wsStudy.state().res, cp = Array.from(r.views.pressure.svals || []).filter(Number.isFinite); return { n: cp.length, lo: Math.min(...cp), hi: Math.max(...cp), speed: !!r.views.speed.svals, slice: !!r.vslice }; });
    assert(ws.n > 100 && ws.hi - ws.lo > 0.3 && !ws.speed && ws.slice, 'pressure differs by face: ' + JSON.stringify(ws)); console.log('PASS wind, one direction: facade pressure', ws.lo.toFixed(2), 'to', ws.hi.toFixed(2), '· speed leaves the buildings plain, slice shown');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
