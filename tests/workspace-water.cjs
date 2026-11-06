// Site water in the Workspace (2026-11-06), on the Fallingwater case: Bear Run is a stream with two falls and the guest house a
// plunge pool, drawn as water in 3D (moving) and 2D; Project data › Site lists each body of water and its card sets it; and the
// water takes part in Stormwater (an outlet), Outdoor comfort (cooling nearby) and Water sound (the falls as sources).
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    const pid = await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); const m = await import('./js/fallingwater-dashboard.js'), q = m.openCase(); try { localStorage.setItem('pc-mvp-current', q.id); localStorage.setItem('pc-water-anim', 'on'); } catch { } return q.id; });
    await p.goto(base + '/mvp/#/workspace/' + pid); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 180000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(5000);
    const fr = p.frames().find((f) => f.url().includes('ws=persp'));
    const w1 = await fr.evaluate(() => S3._water()); assert.equal(w1.surf, 2, 'Bear Run and the pool'); assert.equal(w1.falls, 1, 'the main falls under the living-room terrace'); assert.equal(w1.foam, 1); assert(w1.lo < -8 && w1.hi > 5, JSON.stringify(w1));
    await p.waitForTimeout(4000); const w2 = await fr.evaluate(() => S3._water()); assert(w2.anim && w2.offset !== w1.offset, 'the ripples move: ' + w1.offset + ' → ' + w2.offset);
    const ws = await p.evaluate(() => __ws2.inst.persp.ws.waters()); assert.deepEqual(ws.map((x) => [x.name, x.type, x.falls.length]), [['Bear Run', 'stream', 1], ['Guest house plunge pool', 'pond', 0]]);
    console.log('PASS water in 3D: Bear Run with', ws[0].falls.map((f) => f.drop + ' m').join(' and '), 'falls, the plunge pool at', ws[1].level, 'm; ripples move');
    // the materials of the house: stone walls and ochre concrete take their own layers' colours
    const looks = await p.evaluate(() => { const st = JSON.parse(__ws2.inst.persp.ws.model()); return { stone: st.walls.filter((w) => (w.sourceLayer || w.layer) === 'Stonework').length, frames: st.ops.filter((o) => o.frame).length, levels: st.levels.map((l) => +l.z.toFixed(3)) }; }); assert(looks.stone > 60 && looks.frames > 15, JSON.stringify(looks)); assert.deepEqual(looks.levels, [0, 2.845, 5.277], 'the levels of the HABS sections');
    // Project data › Site lists each body of water; its card sets it
    await p.click('[data-sp=data]').catch(() => {}); await p.waitForTimeout(400); if (await p.locator('.sp-datasheet').isHidden()) await p.evaluate(() => document.querySelector('#tabList [data-tab=properties]')?.click()); await p.waitForTimeout(600);
    await p.locator('.sp-datasheet [data-dt-sel="water:bear-run"]').click(); await p.waitForTimeout(400); assert.match(await p.locator('.sp-watercard').innerText(), /Bear Run[\s\S]*Flowing water[\s\S]*Falls 1: 5\.\d m drop/);
    await p.fill('.sp-watercard [data-wat=discharge]', '1.2'); await p.locator('.sp-watercard [data-wat=discharge]').dispatchEvent('change'); await p.waitForTimeout(700);
    assert.equal((await p.evaluate(() => __ws2.inst.persp.ws.waters()))[0].discharge, 1.2); console.log('PASS Project data › Site › Bear Run opens its card; the flow is set to 1.2 m³/s');
    await p.click('.sp-watercard [data-watx=close]');
    // Water sound: the falls as sources, levels at each room's windows
    const run = async (sim) => { await p.evaluate((sim) => window.__wsStudy ? null : null, sim); await p.click('#addSimBtn').catch(() => {}); await p.waitForTimeout(300); const btn = p.locator(`.w2-simmenu [data-addsim="${sim}"]`); if (!(await btn.isVisible())) await p.click('#addSimInt'); await btn.click(); await p.waitForTimeout(600);
      await p.click('[data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 }); return p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, rows: s.res?.rows, results: s.res?.results, method: s.res?.method }; }); };
    const snd = await run('watersound'); assert.equal(snd.err, ''); assert.match(snd.rows[0][1], /^\d+ dB\(A\), /); assert.equal(snd.results.falls, 1); assert(snd.results.rooms.length >= 6, JSON.stringify(snd.results.rooms));
    assert(snd.results.window > 50 && snd.results.window < 95, snd.rows[0][1]); console.log('PASS Water sound:', snd.rows.slice(0, 4).map((r) => r.join(' ')).join(' · '));
    const sto = await run('stormwater'); assert.equal(sto.err, ''); assert(sto.rows.some(([k, v]) => /Reaches the site’s water/.test(k) && /\d+ m³/.test(v)), JSON.stringify(sto.rows.slice(0, 3))); console.log('PASS Stormwater: Bear Run takes the water:', sto.rows.find(([k]) => /Reaches/.test(k))[1]);
    const ut = await run('utci'); assert.equal(ut.err, ''); assert.match(ut.method, /Bear Run/); console.log('PASS Outdoor comfort counts cooling near the water', ut.rows.find(([k]) => /near the water/.test(k))?.[1] || '(no warm hours near it)');
    // 2D: the stream's flow and its falls
    await p.click('[data-sp=dim]'); await p.waitForTimeout(1500); console.log('PASS 2D view drawn');
    await p.goto(base + '/mvp/#/simulations/watersound'); await p.waitForFunction(() => location.hash.startsWith('#/workspace'), null, { timeout: 30000 }); console.log('PASS the Water sound link opens the Workspace');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
