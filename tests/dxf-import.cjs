// Import a CAD plan into Plan Studio (2026-11-27), a new empty project at 1440×900:
// Draw room › Import plan › Import CAD plan opens a DXF (a 9 × 6 m flat in millimetres with 200 mm double-line walls, a door opening,
// a door block and a sofa) in a dialog: units from the file, the layers (A-WALL ticked for walls by its name), five walls found and
// previewed; "Add the underlay and 5 walls" puts the drawing under level 1 as thin lines and five 0.2 m walls on its centrelines, the
// door opening kept, the room closed; the wall tool snaps to the underlay's lines; Undo takes the walls off and then the underlay;
// a DWG dropped on the Workspace is told to save as DXF; the project keeps the underlay after a reload; no page errors.
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('fs');
const dxf = (ents, blocks = '') => ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER',
  ...['A-WALL', 'A-DOOR', 'FURN'].flatMap((n) => ['0', 'LAYER', '2', n, '70', '0', '62', '7']), '0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'BLOCKS', blocks, '0', 'ENDSEC',
  '0', 'SECTION', '2', 'ENTITIES', ents, '0', 'ENDSEC', '0', 'EOF'].filter((x) => x !== '').join('\n');
const line = (ly, a, b) => ['0', 'LINE', '8', ly, '10', a[0], '20', a[1], '11', b[0], '21', b[1]].join('\n');
const W = 'A-WALL', PLAN = dxf([line(W, [0, 0], [2000, 0]), line(W, [2900, 0], [9000, 0]), line(W, [200, 200], [2000, 200]), line(W, [2900, 200], [8800, 200]), line(W, [2000, 0], [2000, 200]), line(W, [2900, 0], [2900, 200]),
  line(W, [9000, 0], [9000, 6000]), line(W, [9000, 6000], [0, 6000]), line(W, [0, 6000], [0, 0]), line(W, [8800, 200], [8800, 5800]), line(W, [8800, 5800], [200, 5800]), line(W, [200, 5800], [200, 200]),
  ['0', 'INSERT', '8', 'A-DOOR', '2', 'DOOR900', '10', '2000', '20', '200'].join('\n'),
  ['0', 'LWPOLYLINE', '8', 'FURN', '90', '4', '70', '1', '10', '5000', '20', '3000', '10', '7000', '20', '3000', '10', '7000', '20', '3900', '10', '5000', '20', '3900'].join('\n')].join('\n'),
  ['0', 'BLOCK', '2', 'DOOR900', '10', '0', '20', '0', '0', 'LINE', '8', '0', '10', '0', '20', '0', '11', '0', '21', '900', '0', 'ARC', '8', '0', '10', '0', '20', '0', '40', '900', '50', '0', '51', '90', '0', 'ENDBLK'].join('\n'));
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], out = process.env.SHOT_DIR || '/tmp', file = out + '/flat-plan.dxf';
    fs.writeFileSync(file, PLAN); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    const id = await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'plan' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save();
      const q = S.createProject('QA CAD plan', { units: 'm', north: 0, layers: [], components: [] }); q.onboarding = { created: new Date().toISOString(), siteContext: false }; S.saveVersion(q, 'Empty'); S.save(); return q.id; });
    await p.goto(base + '/mvp/#/workspace/' + id); await p.waitForFunction(() => window.__ws2?.inst.plan.ready && window.__ws2?.inst.persp.ready, null, { timeout: 400000 }); await p.waitForTimeout(2000);
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click());
    const fr = p.frames().find((f) => f.url().includes('ws=plan')), walls = () => fr.evaluate(() => window.__st.M.walls.filter((w) => w.lv === window.__st.LV).map((w) => ({ a: w.a, b: w.b, t: w.t, source: w.source })));
    // 1 · Draw room › Import plan › Import CAD plan
    await p.click('[data-panel="draw"]'); await p.waitForTimeout(300);
    await p.evaluate(() => [...document.querySelectorAll('.w2-tools [data-acc]')].find((x) => /Import plan/.test(x.textContent))?.click()); await p.waitForSelector('[data-impdxf]');
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-impdxf]')]); await fc.setFiles(file); await p.waitForSelector('.dxi [data-dx-found]', { timeout: 30000 });
    const dlg = await p.evaluate(() => { const d = document.querySelector('.dxi'); return { text: d.innerText, units: d.querySelector('[data-dx=units] option:checked').textContent, wall: [...d.querySelectorAll('[data-dx-wall]')].filter((x) => x.checked).map((x) => x.dataset.dxWall), lines: d.querySelectorAll('.dxi-pv g line').length, btn: d.querySelector('[data-dx=both]').textContent }; });
    assert.equal(dlg.units, 'millimetres'); assert(/from the file/.test(dlg.text), 'units from the file'); assert.deepEqual(dlg.wall, ['A-WALL'], 'A-WALL ticked for walls by its name');
    assert(/5 walls/.test(dlg.text) && dlg.lines === 5 && /5 walls/.test(dlg.btn), 'five walls found and previewed: ' + JSON.stringify(dlg).slice(0, 300));
    await p.screenshot({ path: out + '/dxf-dialog.png' });
    console.log(`PASS the dialog: units ${dlg.units} (from the file), walls on ${dlg.wall.join(', ')}, ${dlg.lines} walls previewed; "${dlg.btn}"`);
    // 2 · the underlay and the walls
    await p.click('.dxi [data-dx=both]'); await p.waitForTimeout(1500); assert.equal(await p.locator('.dxi').count(), 0, 'the dialog closes');
    const U = await fr.evaluate(() => window.__ws.underlay()), Wd = await walls();
    assert(U && U.segs >= 20 && U.units === 'millimetres' && U.layers.includes('A-WALL'), 'the underlay on the level: ' + JSON.stringify(U));
    assert.equal(Wd.length, 5, 'five walls: ' + JSON.stringify(Wd)); assert(Wd.every((w) => Math.abs(w.t - 0.2) < 1e-6 && /^dxf:A-WALL/.test(w.source || '')), 'all 0.2 m, marked as from the DXF');
    const xs = Wd.flatMap((w) => [w.a[0], w.b[0]]), ys = Wd.flatMap((w) => [w.a[1], w.b[1]]), span = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
    assert(Math.abs(span[0] - 8.8) < 0.01 && Math.abs(span[1] - 5.8) < 0.01, 'on the centrelines: 8.8 × 5.8 m ' + JSON.stringify(span));
    const rooms = await fr.evaluate(() => window.__ws.objects().filter((o) => o.k === 'room').map((r) => r.area));
    await p.screenshot({ path: out + '/dxf-plan.png' });
    console.log(`PASS underlay of ${U.segs} lines (${U.units}) on the level and 5 walls 0.2 m thick on the centrelines (${span.map((v) => v.toFixed(2)).join(' × ')} m)${rooms.length ? `; a room of ${rooms[0].toFixed(1)} m² formed` : ''}`);
    // 3 · the wall tool snaps to the underlay: a point 0.15 m from the sofa's corner lands on it
    const snap = await fr.evaluate(() => { const U = window.__st.M.underlays[window.__st.LV].pts; let best = null; for (let i = 0; i + 3 < U.length; i += 4) for (const q of [[U[i], U[i + 1]], [U[i + 2], U[i + 3]]]) if (!best || q[0] > best[0] + 1e-6 || (Math.abs(q[0] - best[0]) < 1e-6 && q[1] > best[1])) if (Math.abs(q[0]) < 3.5 && Math.abs(q[1]) < 2.5 && q[1] > 0) best = q; return best; });
    assert(snap, 'a sofa corner on the underlay');
    const box = await p.locator('iframe[src*="ws=plan"]').boundingBox(), scr = async (q) => { const s2 = await fr.evaluate((q) => window.__ws.screenOf(q), q), c = await fr.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top]; }); return [box.x + s2[0] - c[0], box.y + s2[1] - c[1]]; };
    await fr.evaluate(() => window.__ws.tool({ tool: 'wall' })); await p.waitForTimeout(300);
    const a = await scr([snap[0] - 0.03, snap[1] + 0.03]); await p.mouse.click(...a); await p.waitForTimeout(150); const c2 = await scr([snap[0] - 1.5, snap[1] + 1.0]); await p.mouse.dblclick(...c2); await p.waitForTimeout(600);
    await fr.evaluate(() => window.__ws.tool({ tool: 'select' })); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    const W2 = await walls(), nw = W2.find((w) => !w.source); assert(nw, 'a wall drawn: ' + JSON.stringify(W2.length));
    const dEnd = Math.min(Math.hypot(nw.a[0] - snap[0], nw.a[1] - snap[1]), Math.hypot(nw.b[0] - snap[0], nw.b[1] - snap[1])); assert(dEnd < 0.005, `the wall starts on the underlay's corner (${dEnd.toFixed(3)} m)`);
    console.log(`PASS the wall tool snaps to the underlay: a click 4 cm off the sofa's corner starts the wall on it (${dEnd.toFixed(3)} m)`);
    // 4 · Undo: the wall drawn, the walls, then the underlay
    const undo = async () => { await p.evaluate(() => document.querySelector('[data-sp="undo"], button[aria-label="Undo"]')?.click() ?? window.__ws2.inst.plan.ws.undo?.()); await p.waitForTimeout(700); };
    await fr.evaluate(() => document.getElementById('cv').focus()); for (let k = 0; k < 2; k++) { await p.keyboard.press('Control+z'); await p.waitForTimeout(700); }
    const afterW = await walls(), afterU = await fr.evaluate(() => window.__ws.underlay()); void undo;
    assert(afterW.length === 0 && afterU, 'two undos: the drawn wall, then the five walls; the underlay stays ' + JSON.stringify({ w: afterW.length, u: !!afterU }));
    await p.keyboard.press('Control+z'); await p.waitForTimeout(700); assert.equal(await fr.evaluate(() => window.__ws.underlay()), null, 'a third undo takes the underlay off');
    await p.keyboard.press('Control+y'); await p.waitForTimeout(700); await p.keyboard.press('Control+y'); await p.waitForTimeout(700);
    const redo = { u: await fr.evaluate(() => window.__ws.underlay()), w: (await walls()).length }; assert(redo.u && redo.w === 5, 'redo brings them back ' + JSON.stringify({ u: !!redo.u, w: redo.w }));
    console.log('PASS Undo takes off the drawn wall, then the five walls, then the underlay; Redo brings them back');
    // 5 · a DWG dropped on the Workspace
    await p.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File(['AC1032'], 'plan.dwg')); for (const t of ['dragenter', 'dragover', 'drop']) document.querySelector('.w2, #app').dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt })); }); await p.waitForTimeout(600);
    const dwg = await p.evaluate(() => { const d = document.querySelector('.sp-drop'); return d && !d.hidden ? d.innerText : ''; });
    assert(/saved as DXF/.test(dwg), 'a DWG is told to save as DXF: ' + dwg); await p.keyboard.press('Escape'); await p.evaluate(() => { const d = document.querySelector('.sp-drop'); if (d) d.hidden = true; });
    console.log(`PASS a DWG dropped: "${dwg.split('\n').filter(Boolean).slice(0, 2).join(' — ')}"`);
    // 6 · kept with the project
    await p.waitForTimeout(2500); await p.reload(); await p.waitForFunction(() => window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.waitForTimeout(2000);
    const fr2 = p.frames().find((f) => f.url().includes('ws=plan')), kept = { u: await fr2.evaluate(() => window.__ws.underlay()), w: await fr2.evaluate(() => window.__st.M.walls.length) };
    assert(kept.u && kept.u.segs === U.segs && kept.w >= 5, 'after a reload the underlay and the walls are there ' + JSON.stringify(kept));
    console.log(`PASS after a reload: the underlay (${kept.u.segs} lines) and ${kept.w} walls are kept with the project`);
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
