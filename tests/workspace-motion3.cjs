// Motion, round 2 (2026-11-14), on the Fallingwater case: one playback bar for the studies with time or steps, each frame from the
// study's own numbers: the snow falling (in proportion), outdoor comfort month by month, the year's winds in turn, daylight at nine
// hours of the year, cameras added one by one, the load coming down the columns, walking round a room with its isovist; and fire
// evacuation's clock and people-out counter
const { chromium } = require('playwright'), assert = require('node:assert/strict'), os = require('node:os');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || os.tmpdir();
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    const pid = await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); const m = await import('./js/fallingwater-dashboard.js'), q = m.openCase(); try { localStorage.setItem('pc-mvp-current', q.id); localStorage.setItem('pc-water-anim', 'off'); } catch { } return q.id; });
    await p.goto(base + '/mvp/#/workspace/' + pid); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 240000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    const ms = () => p.evaluate(() => __ws2.inst.persp.ws.motionState());
    const run = async (id) => { await p.evaluate((i) => window.__wsStudy.open(i), id); await p.waitForTimeout(1000); await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 900000 }); const e = await p.evaluate(() => window.__wsStudy.state().err); assert.equal(e, '', id + ': ' + e); await p.waitForTimeout(1200); };
    const bar = () => p.evaluate(() => { const s = document.querySelector('.sp-studycard [data-tl=seek]'); return s ? { n: +s.max + 1, i: +s.value, label: document.querySelector('.sp-studycard .sp-tll')?.textContent || '' } : null; });
    const seek = async (i) => { await p.evaluate((k) => { const s = document.querySelector('.sp-studycard [data-tl=seek]'); s.value = String(k); s.dispatchEvent(new Event('input', { bubbles: true })); }, i); await p.waitForTimeout(400); return bar(); };
    const played = async (re) => { await p.evaluate(() => document.querySelector('.sp-studycard [data-tl=play]').click()); const l0 = (await bar()).label; await p.waitForFunction((l) => (document.querySelector('.sp-studycard .sp-tll')?.textContent || '') !== l, l0, { timeout: 120000 }); const l1 = (await bar()).label; await p.evaluate(() => document.querySelector('.sp-studycard [data-tl=play]').click()); assert.match(l1, re); return l1; };
    // snow: plays once by itself; at 50 % the depth is half the full depth
    await run('snow'); let B = await bar(); assert(B && B.n === 21, 'snow: 21 frames ' + JSON.stringify(B)); await p.waitForTimeout(500);
    await p.evaluate(() => document.querySelector('.sp-studycard [data-tl=reset]')?.click()); await p.waitForTimeout(400); const full = (await ms()).ovSum; B = await seek(10); const half = (await ms()).ovSum;
    assert.match(B.label, /50% of the \d+ cm fall/); assert(Math.abs(half - full / 2) < full * 0.01, `half the depth: ${half} of ${full}`); await p.screenshot({ path: `${out}/m3-snow.png` }); console.log('PASS snow falls:', B.label);
    // outdoor comfort, month by month
    await run('utci'); B = await bar(); assert(B && B.n >= 2, 'utci months ' + JSON.stringify(B)); B = await seek(0); const s0 = (await ms()).ovSum; B = await seek(B.n - 1); const s1 = (await ms()).ovSum; assert.match(B.label, /(January|February|March|April|May|June|July|August|September|October|November|December) · % of its counted hours/); assert.notEqual(s0, s1, 'months differ'); console.log('PASS outdoor comfort by month:', B.n, 'months');
    // wind: the year's directions in turn, the flow carrying on
    await run('wind'); B = await bar(); assert(B && B.n >= 2, 'wind directions ' + JSON.stringify(B)); const wl = await played(/Wind from (N|NE|E|SE|S|SW|W|NW) · \d+% of the hours/); assert((await ms()).flow, 'particles still running'); await p.screenshot({ path: `${out}/m3-wind.png` }); console.log('PASS the winds in turn:', wl);
    // daylight at nine hours of the year
    await run('daylight'); B = await bar(); assert.equal(B.n, 9); B = await seek(4); assert.match(B.label, /^21 June 12:00 · illuminance/); await p.screenshot({ path: `${out}/m3-daylight.png` }); console.log('PASS daylight through the year:', B.label.slice(0, 40));
    // cameras one by one
    await run('cameras'); B = await bar(); if (B) { B = await seek(0); assert.match(B.label, /^Camera 1 of \d+ .* of the floor covered so far/); const c0 = +/([\d.]+)% of the floor/.exec(B.label)[1]; B = await seek(B.n - 1); const c1 = +/([\d.]+)% of the floor/.exec(B.label)[1]; assert(c1 >= c0, `coverage grows ${c0} → ${c1}`); await p.screenshot({ path: `${out}/m3-cameras.png` }); console.log('PASS cameras one by one:', c0, '→', c1, '%'); } else console.log('(one camera only: no build-up)');
    // structure: the load coming down
    await run('structure'); B = await bar(); assert(B && B.n >= 2, 'storeys ' + JSON.stringify(B)); B = await seek(1); assert.match(B.label, /The roof/); B = await seek(B.n - 1); assert.match(B.label, /kN/); await p.screenshot({ path: `${out}/m3-structure.png` }); console.log('PASS the load coming down:', B.label);
    // isovist: walking round the room
    await run('isovist'); B = await bar(); assert(B && B.n > 3, 'walk ' + JSON.stringify(B)); const il = await played(/Walking round the room · step \d+ of \d+/); await p.screenshot({ path: `${out}/m3-isovist.png` }); console.log('PASS the isovist walk:', il);
    // fire evacuation: the clock and the people out
    await p.goto(base + '/mvp/#/home'); await p.waitForSelector('[data-hospital]'); await p.click('.ph-thumb[data-hospital]');   // a building with stairs to the ground: the hospital example
    await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    await p.evaluate(() => window.__wsStudy.open('fire-evacuation')); await p.waitForTimeout(800); await p.evaluate(() => { const c = document.querySelector('.sp-studycard details[data-adv=egAll]'); if (c) c.open = true; }); await p.selectOption('.sp-studycard [data-eg=runs]', '10').catch(() => {});
    await run('fire-evacuation'); await p.waitForTimeout(4000); const fr = p.frames().find((f) => f.url().includes('ws=persp')), c1 = await fr.evaluate(() => window.__ws.egressState().clock); await p.waitForTimeout(4000); const c2 = await fr.evaluate(() => window.__ws.egressState().clock);
    assert(c1 && c2 && c2.n > 0 && (c2.t !== c1.t), 'the clock runs: ' + JSON.stringify([c1, c2])); await p.screenshot({ path: `${out}/m3-fire.png` }); console.log('PASS the fire evacuation clock:', JSON.stringify(c2));
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
