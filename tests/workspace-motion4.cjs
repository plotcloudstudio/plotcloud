// Motion, round 3 (2026-11-14): on the hospital example, wayfinding's walk to each room, a passer-by's view in privacy and the views
// out spreading from the windows; on the Fallingwater case, ripples from the falls, the sky dome at a spot (the same rays as the
// study) and daylight shown only where it reaches when the walls do not close into rooms
const { chromium } = require('playwright'), assert = require('node:assert/strict'), os = require('node:os');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || os.tmpdir();
    const ms = () => p.evaluate(() => __ws2.inst.persp.ws.motionState());
    const run = async (id) => { await p.evaluate((i) => window.__wsStudy.open(i), id); await p.waitForTimeout(1000); await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 900000 }); const e = await p.evaluate(() => window.__wsStudy.state().err); assert.equal(e, '', id + ': ' + e); await p.waitForTimeout(1200); };
    const bar = () => p.evaluate(() => { const s = document.querySelector('.sp-studycard [data-tl=seek]'); return s ? { n: +s.max + 1, i: +s.value, label: document.querySelector('.sp-studycard .sp-tll')?.textContent || '' } : null; });
    const seek = async (i) => { await p.evaluate((k) => { const s = document.querySelector('.sp-studycard [data-tl=seek]'); s.value = String(k); s.dispatchEvent(new Event('input', { bubbles: true })); }, i); await p.waitForTimeout(500); return bar(); };
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    await p.goto(base + '/mvp/#/home'); await p.waitForSelector('[data-hospital]'); await p.click('.ph-thumb[data-hospital]');
    await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    // wayfinding
    await run('wayfinding'); let B = await bar(); assert(B && B.n >= 2, 'rooms ' + JSON.stringify(B)); B = await seek(1); assert.match(B.label, /^To .+ · [\d.]+ m · \d+ turns? · \d+ decision points?$/); await p.waitForTimeout(800); assert((await ms()).people, 'walking'); await p.screenshot({ path: `${out}/m4-way.png` }); console.log('PASS wayfinding walk:', B.n, 'rooms ·', B.label);
    // privacy
    await run('privacy'); B = await bar(); assert(B && B.n > 2, 'passer-by ' + JSON.stringify(B)); const pl = []; for (const i of [0, Math.floor(B.n / 2), B.n - 1]) pl.push((await seek(i)).label); assert(pl.every((l) => /A passer-by on the street · step \d+ of \d+ · sees into \d+ windows?, [\d,]+ m² of floor/.test(l)), JSON.stringify(pl));
    await p.screenshot({ path: `${out}/m4-privacy.png` }); console.log('PASS privacy passer-by:', pl.map((l) => /sees into \d+ windows?, [\d,]+ m²/.exec(l)[0]).join(' | '));
    // views
    await run('views'); B = await bar(); assert(B && B.n > 2, 'views ' + JSON.stringify(B)); const a0 = /(\d+) drawn/.exec((await seek(0)).label), a1 = /(\d+) drawn/.exec((await seek(B.n - 1)).label); assert(+a1[1] > +a0[1], `more arrows: ${a0[1]} → ${a1[1]}`); await p.screenshot({ path: `${out}/m4-views.png` }); console.log('PASS views spreading:', a0[1], '→', a1[1], 'arrows');
    // Fallingwater
    await p.goto('about:blank'); await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    const pid = await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); const m = await import('./js/fallingwater-dashboard.js'), q = m.openCase(); try { localStorage.setItem('pc-mvp-current', q.id); localStorage.setItem('pc-water-anim', 'off'); } catch { } return q.id; });
    await p.goto('about:blank'); await p.goto(base + '/mvp/#/workspace/' + pid);   // a fresh page: the other project's Workspace is left await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready && window.__wsStudy?.open, null, { timeout: 240000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    await p.waitForFunction(() => window.__wsStudy?.open && window.__ws2?.inst.persp.ready, null, { timeout: 240000 }); await p.waitForTimeout(1000);   // the Workspace of this project, built
    // water sound ripples
    await run('watersound'); B = await bar(); assert(B && B.n === 20, 'ripples ' + JSON.stringify(B)); await seek(0); const r0 = (await ms()).ovSum; B = await seek(5); const r1 = (await ms()).ovSum; assert.notEqual(r0, r1, 'the rings move'); assert.match(B.label, /illustration/);
    await p.evaluate(() => document.querySelector('.sp-studycard [data-tl=reset]').click()); await p.waitForTimeout(400); await p.screenshot({ path: `${out}/m4-water.png`, timeout: 120000 }); console.log('PASS water sound ripples');
    // sky dome at a spot: the same value as the study's cell
    await run('skyview'); const cell = await p.evaluate(() => { const r = window.__wsStudy.state().res; let best = -1; for (let c = 0; c < r.vals.length; c++) if (Number.isFinite(r.vals[c]) && r.vals[c] > 20 && r.vals[c] < 95) { best = c; break; } return best < 0 ? null : { v: r.vals[best], pt: [r.X0 + (best % r.nx + 0.5) * r.cell, r.Y0 + (Math.floor(best / r.nx) + 0.5) * r.cell] }; });
    assert(cell, 'a partly open cell'); const dm = await p.evaluate((pt) => window.__wsStudy.dome(pt), cell.pt); assert(dm && Math.abs(dm.sky - cell.v) < 5, `dome ${dm && dm.sky} vs cell ${cell.v}`); assert(await p.locator('.sp-dome svg circle').count() > 100);
    await p.screenshot({ path: `${out}/m4-dome.png` }); console.log('PASS sky dome:', dm.sky.toFixed(1), '% vs the cell', cell.v.toFixed(1), '%');
    // daylight: shown only where it reaches (and the dome card goes with the study it belongs to)
    await run('daylight'); assert(await p.locator('.sp-dome').isHidden(), 'the dome closed with Sky view'); const dl = await p.evaluate(() => { const s = window.__wsStudy.state().res; return { foot: s.foot, fin: Array.from(s.vals).filter(Number.isFinite).length, n: s.cells }; }); if (/do not close/.test(dl.foot)) assert(dl.fin < dl.n, 'the outdoors not painted: ' + JSON.stringify(dl));
    await p.screenshot({ path: `${out}/m4-daylight.png` }); console.log('PASS daylight:', dl.fin, 'of', dl.n, 'spots shown', /do not close/.test(dl.foot) ? '(walls do not close: shown where daylight reaches)' : '');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
