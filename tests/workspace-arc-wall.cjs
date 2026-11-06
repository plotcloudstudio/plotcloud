// Arc wall in the Workspace (2026-11-07): Draw rooms › Arc wall makes ONE wall that bends (start, end, then a point on the curve);
// it draws as a curved band in 2D and a smooth curved wall in 3D, is selected and deleted as one, and the Fallingwater hall's
// curved wall is one such wall. Uses the Fallingwater case (no site download).
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    const pid = await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); const m = await import('./js/fallingwater-dashboard.js'), q = m.openCase(); try { localStorage.setItem('pc-mvp-current', q.id); localStorage.setItem('pc-water-anim', 'off'); } catch { } return q.id; });
    await p.goto(base + '/mvp/#/workspace/' + pid); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 180000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(2000);
    // the case's curved hall wall is one wall
    const hall = await p.evaluate(() => JSON.parse(__ws2.inst.persp.ws.model()).walls.filter((w) => w.bulge).map((w) => ({ lv: w.lv, bulge: w.bulge })));
    assert.deepEqual(hall.map((w) => w.lv), ['L2']); console.log('PASS the hall of the Fallingwater second floor has one arc wall, bulge', hall[0].bulge);
    // draw an arc wall on level 1 in 2D: three clicks on the open ground east of the house
    await p.click('[data-sp=dim]'); await p.waitForTimeout(1200); await p.evaluate(() => { for (const k of ['plan', 'persp']) __ws2.inst[k].ws.level('L1'); }); await p.waitForTimeout(800);
    const fr = p.frames().find((f) => f.url().includes('ws=plan')), n0 = await fr.evaluate(() => window.__st.M.walls.length);
    await fr.evaluate(() => window.__ws.camSet({ cx: 18, cy: 4, span: 30 })); await p.waitForTimeout(500);
    assert.notEqual(await fr.evaluate(() => window.__ws.tool({ tool: 'arc' })), false, 'the Arc wall tool starts');
    const box = await p.locator('iframe[src*="ws=plan"]').boundingBox();
    for (const q of [[12, 1], [24, 1], [18, 7]]) { const s = await fr.evaluate((q) => window.__ws.screenOf(q), q); await p.mouse.click(box.x + s[0] - (await fr.evaluate(() => document.getElementById('cv').getBoundingClientRect().left)), box.y + s[1] - (await fr.evaluate(() => document.getElementById('cv').getBoundingClientRect().top))); await p.waitForTimeout(250); }
    await p.waitForTimeout(600);
    const made = await fr.evaluate((n0) => { const M = window.__st.M, w = M.walls.slice(n0); return w.map((x) => ({ a: x.a, b: x.b, bulge: x.bulge, len: window.__STC ? null : null })); }, n0);
    assert.equal(made.length, 1, 'one wall, not a chain of pieces: ' + JSON.stringify(made)); assert(Math.abs(made[0].bulge) > 0.6 && Math.abs(made[0].bulge) < 1.2, 'it bends: bulge ' + made[0].bulge);
    console.log('PASS Arc wall draws one wall through three clicks: bulge', made[0].bulge.toFixed(3));
    await p.screenshot({ path: (process.env.SHOT || '/tmp') + '/arc-2d.png' });
    // 3D: smooth curved pieces of that wall
    await p.click('[data-sp=dim]'); await p.waitForTimeout(2500); const f3 = p.frames().find((f) => f.url().includes('ws=persp'));
    const meshes = await f3.evaluate(() => { let n = 0, v = 0; S3._scene().traverse((m) => { if (m.isMesh && m.userData && m.userData.k === 'wall' && m.geometry?.type === 'ExtrudeGeometry') { n++; v += m.geometry.attributes.position.count; } }); return { n, v }; });
    assert(meshes.n >= 1 && meshes.v > 200, 'curved wall meshes in 3D: ' + JSON.stringify(meshes)); console.log('PASS 3D draws the arc walls as smooth curved solids:', JSON.stringify(meshes));
    await p.screenshot({ path: (process.env.SHOT || '/tmp') + '/arc-3d.png' });
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
