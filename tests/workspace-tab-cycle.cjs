// Plan Studio pointer keys in the Workspace (2026-11-23), Fallingwater case, plan pane:
// with the pointer over a room (no click first), Tab cycles what is under it (the room, then the floor slab) and Enter picks it;
// the Room tool: drag, type 6000 and Enter makes a room with 6000 mm sides and the drag does not abort.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    const pid = await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); const m = await import('./js/fallingwater-dashboard.js'), q = m.openCase(); try { localStorage.setItem('pc-mvp-current', q.id); localStorage.setItem('pc-water-anim', 'off'); } catch { } return q.id; });
    await p.goto(base + '/mvp/#/workspace/' + pid); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 180000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(2000);
    await p.click('[data-sp=dim]'); await p.waitForTimeout(1200); await p.evaluate(() => { for (const k of ['plan', 'persp']) __ws2.inst[k].ws.level('L1'); }); await p.waitForTimeout(800);
    const fr = p.frames().find((f) => f.url().includes('ws=plan'));
    const box = await p.locator('iframe[src*="ws=plan"]').boundingBox(), cvr = await fr.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top]; });
    const scr = async (q) => { const s2 = await fr.evaluate((q) => window.__ws.screenOf(q), q); return [box.x + s2[0] - cvr[0], box.y + s2[1] - cvr[1]]; };
    // Tab over a room
    const r = (await fr.evaluate(() => window.__st.rooms()))[0];
    await fr.evaluate(([x, y]) => window.__ws.camSet({ cx: x, cy: y, span: 12 }), [r.lx, r.ly]); await p.waitForTimeout(400);
    const at = await scr([r.lx + 0.8, r.ly - 0.9]), picked = [];
    for (let i = 0; i < 3; i++) { await p.mouse.move(at[0] + 20, at[1]); await p.mouse.move(...at, { steps: 3 }); await p.waitForTimeout(150); for (let k = 0; k <= i; k++) { await p.keyboard.press('Tab'); await p.waitForTimeout(120); } await p.keyboard.press('Enter'); await p.waitForTimeout(200); picked.push(await fr.evaluate(() => window.__st.SEL)); }
    assert.equal(picked[0]?.k, 'room', 'one Tab: the room ' + JSON.stringify(picked)); assert.equal(picked[1]?.k, 'floor', 'two Tabs: the floor under it ' + JSON.stringify(picked)); assert.equal(picked[2]?.k, 'room', 'three Tabs: back to the room ' + JSON.stringify(picked));
    console.log(`PASS Tab with the pointer over a room (no click first) cycles ${picked.map((s) => s.k).join(' → ')}, Enter picks it`);
    await p.keyboard.press('Escape');
    // the Room tool with a typed size
    await fr.evaluate(() => window.__ws.camSet({ cx: 18, cy: 4, span: 30 })); await p.waitForTimeout(500); const n0 = await fr.evaluate(() => window.__st.M.walls.length);
    assert.notEqual(await fr.evaluate(() => window.__ws.tool({ tool: 'room' })), false, 'the Room tool starts');
    const a = await scr([14, 0]), c = await scr([18, 3]);
    await p.mouse.move(...a); await p.mouse.down(); await p.mouse.move(...c, { steps: 6 }); await p.keyboard.type('6000'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    await p.mouse.move(c[0] + 30, c[1] + 10, { steps: 3 }); await p.mouse.up(); await p.waitForTimeout(800);
    const made = await fr.evaluate((n0) => window.__st.M.walls.slice(n0).map((w) => Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1])), n0);
    assert.equal(made.length, 4, 'one room of four walls ' + JSON.stringify(made)); assert(made.every((L) => Math.abs(L - 6) < 1e-9), 'every side 6000 mm ' + JSON.stringify(made));
    console.log('PASS Room tool: drag, type 6000, Enter → a room of four 6000 mm sides; releasing the mouse afterwards adds nothing');
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
