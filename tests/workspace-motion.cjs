// Motion (2026-11-14), on the Fallingwater case: results arrive with a reveal (the ground from the middle out, the facades upward),
// figures count up and chart bars grow; Sun hours' Play the day fills the ground with the hours so far; wind particles leave comet
// trails; a motion clip (8 s WebM, 4:5) can be recorded; with reduced motion nothing animates
const { chromium } = require('playwright'), assert = require('node:assert/strict'), os = require('node:os'), fs = require('node:fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 }, acceptDownloads: true }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || os.tmpdir();
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    const pid = await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); const m = await import('./js/fallingwater-dashboard.js'), q = m.openCase(); try { localStorage.setItem('pc-mvp-current', q.id); localStorage.setItem('pc-water-anim', 'off'); localStorage.setItem('pc-motion-scale', '10'); } catch { } return q.id; });
    await p.goto(base + '/mvp/#/workspace/' + pid); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 240000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    const ms = () => p.evaluate(() => __ws2.inst.persp.ws.motionState());
    const run = async (id) => { await p.evaluate((i) => window.__wsStudy.open(i), id); await p.waitForTimeout(1000); await p.click('.sp-studycard [data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 900000 }); };
    // 1 · the reveal (slowed ten times for the check)
    await run('sunhours'); let m = await ms(); assert(m.active.includes('topo') && m.topo != null && m.topo < 1, 'the ground revealing: ' + JSON.stringify(m)); assert(m.active.includes('surf'), 'the facades rising: ' + JSON.stringify(m));
    assert.equal(await p.locator('.sp-studycard svg.sp-hist.sp-grow').count(), 1, 'the chart bars grow');
    await p.screenshot({ path: `${out}/motion-reveal.png` }); await p.waitForFunction(() => __ws2.inst.persp.ws.motionState().active.length === 0, null, { timeout: 40000 }).catch(async (e) => { console.log('STATE', JSON.stringify(await ms())); throw e; }); console.log('PASS the reveal:', JSON.stringify(m));
    // 2 · Play the day fills the ground with the hours so far
    await p.click('.sp-studycard [data-st=play]'); await p.waitForTimeout(1500); const a1 = await p.locator('.sp-playh').innerText(), hr = (t) => { const m2 = /(\d\d):(\d\d)/.exec(t); return m2 ? +m2[1] + m2[2] / 60 : NaN; };
    await p.waitForFunction((h0) => { const m2 = /(\d\d):(\d\d)/.exec(document.querySelector('.sp-playh')?.textContent || ''); return m2 && +m2[1] + m2[2] / 60 >= h0 + 1.5; }, hr(a1), { timeout: 120000 }); const a2 = await p.locator('.sp-playh').innerText();
    const so = (t) => +(/([\d.]+) h so far/.exec(t) || [])[1]; assert(Number.isFinite(so(a1)) && Number.isFinite(so(a2)) && so(a2) > so(a1), `the hours add up: ${a1} → ${a2}`);
    await p.screenshot({ path: `${out}/motion-day.png` }); await p.click('.sp-studycard [data-st=play]'); console.log('PASS Play the day builds up:', a1, '→', a2);
    // 3 · wind: comet trails
    await p.evaluate(() => localStorage.setItem('pc-motion-scale', '1')); await run('wind'); await p.waitForTimeout(2500); m = await ms(); assert.equal(m.trail, 4, 'trails with alpha: ' + JSON.stringify(m));
    await p.screenshot({ path: `${out}/motion-wind.png` }); console.log('PASS wind trails');
    // 4 · a motion clip, 4:5
    await p.click('.sp-studycard [data-st=exp]'); await p.waitForTimeout(300);
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), p.click('.sp-studycard [data-st=vid][data-v="4:5"]')]); const f = `${out}/${dl.suggestedFilename()}`; await dl.saveAs(f);
    const clip = await p.evaluate(() => window.__wsStudy.state().lastClip); assert(clip && clip.size > 20000 && clip.w === 1080 && clip.h === 1350 && /webm|mp4/.test(clip.type), JSON.stringify(clip)); assert.match(dl.suggestedFilename(), /mp4/.test(clip.type) ? /^wind-flow-4x5\.mp4$/ : /^wind-flow-4x5\.webm$/);   /* MP4 where the browser records it (2026-11-15) */ assert(fs.statSync(f).size === clip.size);
    console.log('PASS the motion clip:', dl.suggestedFilename(), Math.round(clip.size / 1024) + ' kB');
    // 5 · reduced motion: nothing animates
    await p.emulateMedia({ reducedMotion: 'reduce' }); await run('skyview'); m = await ms(); assert(m.off && m.active.length === 0, 'no reveal with reduced motion: ' + JSON.stringify(m)); console.log('PASS reduced motion');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
