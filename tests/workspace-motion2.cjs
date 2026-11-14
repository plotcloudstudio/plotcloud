// Motion brought back (2026-11-14), on the Fallingwater case: Natural ventilation's air moving through the openings, Space syntax's
// agents walking, Stormwater's rain and its analysis sequence, Indoor acoustics' sound particles in 3D
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
    const run = async (id) => { await p.evaluate((i) => window.__wsStudy.open(i), id); await p.waitForTimeout(1000); await p.click('.sp-studycard [data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 900000 }); const e = await p.evaluate(() => window.__wsStudy.state().err); assert.equal(e, '', id + ': ' + e); await p.waitForTimeout(1500); };
    // ventilation
    await run('vent'); let m = await ms(); assert(m.streaks > 20 && m.streaking, 'air through the openings: ' + JSON.stringify(m)); await p.screenshot({ path: `${out}/motion2-vent.png` }); console.log('PASS ventilation: air moving,', m.streaks, 'streaks');
    // space syntax
    await run('spacesyntax'); m = await ms(); assert(m.people, 'the agents walking: ' + JSON.stringify(m)); assert.match(await p.locator('.sp-studycard [data-st=anim]').innerText(), /Stop the agents/);
    await p.screenshot({ path: `${out}/motion2-ss.png` }); await p.click('.sp-studycard [data-st=anim]'); await p.waitForTimeout(500); m = await ms(); assert(!m.people, 'stopped'); console.log('PASS space syntax: the agents walk and stop');
    // stormwater
    await run('stormwater'); m = await ms(); assert(m.streaks > 40 && m.streaking && m.flow, 'rain and running water: ' + JSON.stringify(m)); const v0 = await p.evaluate(() => window.__wsStudy.state().res.view);
    await p.evaluate(() => document.querySelector('.sp-studycard [data-st=seq]').click()); await p.waitForFunction((v) => window.__wsStudy.state().res.view !== v, v0, { timeout: 120000 }); const v1 = await p.evaluate(() => window.__wsStudy.state().res.view);   // a view switch repaints the whole site: slow in a software renderer
    await p.waitForFunction((v) => window.__wsStudy.state().res.view !== v, v1, { timeout: 120000 }); await p.screenshot({ path: `${out}/motion2-storm.png`, timeout: 120000 }); await p.evaluate(() => document.querySelector('.sp-studycard [data-st=seq]').click()); await p.waitForFunction(() => !window.__wsStudy.state().seq, null, { timeout: 120000 }); console.log('PASS stormwater: rain,', m.streaks, 'streaks; the sequence', v0, '→', v1, '→ …');
    // acoustics
    await run('acoustics'); await p.click('.sp-studycard [data-st=sound3d]'); await p.waitForSelector('.sp-sound:not([hidden]) canvas', { timeout: 30000 }); await p.waitForTimeout(2500);
    const cv = await p.evaluate(() => { const c = document.querySelector('.sp-sound canvas'); return { w: c.width, h: c.height, rooms: document.querySelectorAll('.sp-sound [data-snd=room] option').length }; }); assert(cv.w > 200 && cv.h > 150 && cv.rooms > 0, JSON.stringify(cv));
    await p.screenshot({ path: `${out}/motion2-sound.png` }); await p.click('.sp-sound [data-snd=x]'); assert(await p.locator('.sp-sound').isHidden()); console.log('PASS acoustics: sound particles in 3D,', cv.rooms, 'rooms');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
