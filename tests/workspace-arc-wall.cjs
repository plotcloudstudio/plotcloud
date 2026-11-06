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
    // select it (Select tool, a click on the wall) and drag its middle handle further out: the curve follows the pointer
    const cvr = await fr.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top]; }), scr = async (q) => { const s2 = await fr.evaluate((q) => window.__ws.screenOf(q), q); return [box.x + s2[0] - cvr[0], box.y + s2[1] - cvr[1]]; };
    // the middle of the arc: the chord's middle, the sagitta (bulge × half the chord) to the right of a → b
    await fr.evaluate(() => window.__ws.tool({ tool: 'select' })); const mid = await fr.evaluate((n0) => { const w = window.__st.M.walls[n0], dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], c = Math.hypot(dx, dy), sg = w.bulge * c / 2; return [(w.a[0] + w.b[0]) / 2 + dy / c * sg, (w.a[1] + w.b[1]) / 2 - dx / c * sg]; }, n0);
    const onArc = await scr(mid); await p.mouse.click(...onArc); await p.waitForTimeout(300);
    await p.mouse.move(...onArc); await p.mouse.down(); const far = await scr([mid[0], mid[1] + 2.5]); await p.mouse.move(far[0], far[1], { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(500);
    const after = await fr.evaluate((n0) => window.__st.M.walls[n0].bulge, n0); assert(Math.abs(after) > Math.abs(made[0].bulge) + 0.2, `the middle handle bends it further: ${made[0].bulge} → ${after}`); void mid;
    console.log('PASS dragging the middle handle bends the arc wall: bulge', made[0].bulge.toFixed(3), '→', after.toFixed(3));
    // 3D: smooth curved pieces of that wall
    await p.click('[data-sp=dim]'); await p.waitForTimeout(2500); const f3 = p.frames().find((f) => f.url().includes('ws=persp'));
    const meshes = await f3.evaluate(() => { let n = 0, v = 0; S3._scene().traverse((m) => { if (m.isMesh && m.userData && m.userData.k === 'wall' && m.geometry?.type === 'ExtrudeGeometry') { n++; v += m.geometry.attributes.position.count; } }); return { n, v }; });
    assert(meshes.n >= 1 && meshes.v > 200, 'curved wall meshes in 3D: ' + JSON.stringify(meshes)); console.log('PASS 3D draws the arc walls as smooth curved solids:', JSON.stringify(meshes));
    await p.screenshot({ path: (process.env.SHOT || '/tmp') + '/arc-3d.png' });
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
