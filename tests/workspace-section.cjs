// Section cut and Section view in the Workspace (2026-11-07, after Revit's Section tool). The two-storey block of the ventilation
// test: a section line drawn on the plan with two clicks, kept in the model (both views, undo); the 3D view cut by a real plane with
// filled cut faces; the Section view square to the cut with the levels drawn; flip, far clip, drag on the plan; Natural ventilation's
// per-room result on the cut; switching views; delete. The model's walls, doors and windows are unchanged throughout.
// Needs network access (site data).
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    await p.goto(base + '/mvp/#/new-project'); await p.waitForFunction(() => window.__newProjectMap, null, { timeout: 30000 });
    await p.evaluate(() => window.__newProjectMap.place(49.2448, -123.0071, 'QA section block')); await p.waitForFunction(() => window.__newProjectMap.osm, null, { timeout: 120000 });
    await p.click('#npStart'); await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 180000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    const O = await p.evaluate(() => { const ws = __ws2.inst.plan.ws, M = JSON.parse(ws.model()), c = M.site?.at || [0, 0], X = c[0] - 12, Y = c[1] - 6, id = (k) => k + Math.random().toString(36).slice(2, 8);
      M.levels = [{ id: 'L1', name: 'Level 1', z: 0, h: 3 }, { id: 'L2', name: 'Level 2', z: 3, h: 3 }];
      for (const lv of ['L1', 'L2']) {
        const W = (a, b2) => { const w = { id: id('w'), lv, a: [X + a[0], Y + a[1]], b: [X + b2[0], Y + b2[1]], t: 0.2, h: 3 }; M.walls.push(w); return w; };
        const Op = (w, pos, wd, kind) => M.ops.push(kind === 'door' ? { id: id('o'), wall: w.id, pos, w: wd, kind: 'door', object_type: 'door', sill: 0, head: 2.1 } : { id: id('o'), wall: w.id, pos, w: wd, kind: 'win', object_type: 'window', sill: 0.9, head: 2.1, open: 0.5 });
        const s0 = W([0, 0], [24, 0]), e = W([24, 0], [24, 12]), n0 = W([24, 12], [0, 12]), wv = W([0, 12], [0, 0]);
        const cs = W([0, 5], [20, 5]), cn = W([0, 7], [20, 7]), st = W([20, 0], [20, 12]);
        for (const x of [5, 10, 15]) { W([x, 0], [x, 5]); W([x, 7], [x, 12]); }
        [0, 5, 10, 15].forEach((x0, k) => { Op(s0, x0 + 2.5, 1.6, 'win'); Op(n0, 24 - x0 - 2.5, 1.6, 'win'); Op(cs, x0 + 2.5, 0.9, 'door'); Op(cn, x0 + 2.5, 0.9, 'door');
          M.names.push({ lv, x: X + x0 + 2.5, y: Y + 2.5, name: `Room ${lv}S${k + 1}` }, { lv, x: X + x0 + 2.5, y: Y + 9.5, name: `Room ${lv}N${k + 1}` }); });
        Op(st, 6, 1.2, 'door'); Op(e, 6, 1.4, 'win'); if (lv === 'L1') Op(wv, 6, 1.2, 'door');
        M.names.push({ lv, x: X + 10, y: Y + 6, name: 'Corridor' }, { lv, x: X + 22, y: Y + 3, name: 'Stair' }); }
      M.furn.push(__ws2.inst.plan.ws._genFurn('L1', 'straight', X + 22, Y + 6, 0));
      M.furn.push({ id: id('f'), lv: 'L1', type: 'sofa', name: 'Sofa', x: X + 7.5, y: Y + 9.6, w: 2, d: 0.9, h: 0.8, rot: 0, object_type: 'furniture', layer: 'Furniture' });
      const snap = JSON.stringify(M); ws.apply(snap, false); __ws2.hub.change('plan', snap, false); return { X, Y }; }); await p.waitForTimeout(3000);
    const frp = p.frames().find((f) => f.url().includes('ws=plan')), fr3 = p.frames().find((f) => f.url().includes('ws=persp'));
    const body = () => frp.evaluate(() => { const M = JSON.parse(__ws.model()); return JSON.stringify([M.walls, M.ops, M.floors, M.furn, M.levels]); }), body0 = await body();
    const box = async (sel) => (await p.locator(sel).boundingBox());
    const setRange = (sel, v) => p.evaluate(([sel2, v2]) => { const e = document.querySelector(sel2); e.value = v2; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, String(v)]);
    const pickView = async (k) => { if (await p.locator('#vMenu').isHidden()) await p.click('#vBtn'); await p.click(`#vMenu [data-view=${k}]`); };
    const planPx = async (q) => { const bb = await box('#fPlan'), s = await frp.evaluate((q2) => __ws.screenOf(q2), q); return [bb.x + s[0], bb.y + s[1]]; };

    // 1 · the Section button on the right rail; no section yet; Draw section line, then two clicks on the plan (y = Y + 3, through the south rooms)
    await p.click('[data-sp=sec]'); let pop = await p.locator('.sp-pop-sec').innerText(); assert.match(pop, /Section[\s\S]*Draw section line/);
    await p.click('.sp-pop-sec [data-sec=draw]'); await p.waitForTimeout(500); assert(await frp.evaluate(() => __ws.sectionState().drawing), 'drawing a section');
    let a = await planPx([O.X - 3, O.Y + 3]), c = await planPx([O.X + 27, O.Y + 3.3]); await p.mouse.click(a[0], a[1]); await p.mouse.move(c[0], c[1], { steps: 4 }); await p.mouse.click(c[0], c[1]); await p.waitForTimeout(800);
    let sec = await frp.evaluate(() => __ws.section()); assert(sec, 'a section in the model');
    assert(Math.abs(sec.a[1] - (O.Y + 3)) < 0.15 && Math.abs(sec.b[1] - sec.a[1]) < 1e-6, 'drawn nearly level, it snaps level: ' + JSON.stringify(sec)); assert(Math.abs(sec.len - 30) < 0.4, 'its length');
    assert.deepEqual(sec.look.map((v) => Math.round(v) + 0), [0, 1], 'drawn left to right, it looks north (up the plan)');
    await p.waitForTimeout(600); assert(await fr3.evaluate(() => !!__ws.section()), 'the 3D pane has it too');
    assert.equal(await body(), body0, 'the model itself is untouched');
    console.log('PASS section line drawn on the plan:', sec.a.map((v) => v.toFixed(2)).join(','), '→', sec.b.map((v) => v.toFixed(2)).join(','));

    // 2 · undo and redo
    await frp.evaluate(() => __ws.undo()); await p.waitForTimeout(400); assert.equal(await frp.evaluate(() => __ws.section()), null, 'undo removes it');
    await frp.evaluate(() => __ws.redo()); await p.waitForTimeout(600); assert(await frp.evaluate(() => !!__ws.section()), 'redo brings it back');

    // 3 · 3D cutaway: the cut plane, filled cut faces
    await p.click('[data-sp=dim]'); await p.waitForFunction(() => __ws2.inst.persp.ready, null, { timeout: 30000 }); await p.waitForTimeout(1500);
    await fr3.evaluate((o) => S3.fitBox({ x0: o.X, y0: o.Y, x1: o.X + 24, y1: o.Y + 12 }, 3, 0.9), O); await p.waitForTimeout(500);
    let s3 = await fr3.evaluate(() => { S3.png(); return S3.secState(); }); assert(s3.cut && s3.planes === 1 && !s3.view, 'the 3D view is cut: ' + JSON.stringify(s3)); assert(s3.caps > 10, 'closed meshes take part in the cut faces: ' + s3.caps);
    const dark = () => fr3.evaluate(async () => { const im = new Image(); im.src = S3.png(); await im.decode(); const c2 = document.createElement('canvas'); c2.width = im.width; c2.height = im.height; const x = c2.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c2.width, c2.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 0x23) < 6 && Math.abs(d[i + 1] - 0x26) < 6 && Math.abs(d[i + 2] - 0x2b) < 6) n++; return n; });
    if (process.env.SHOT_DIR) { const u = await fr3.evaluate(() => S3.png()); require('fs').writeFileSync(process.env.SHOT_DIR + '/cut3d.png', Buffer.from(u.split(',')[1], 'base64')); }
    const darkCut = await dark(); assert(darkCut > 200, 'cut faces painted solid: ' + darkCut);
    console.log('PASS 3D cutaway:', JSON.stringify({ planes: s3.planes, caps: s3.caps, poche: darkCut }));

    // 4 · Section view from the View menu: square to the cut, 1° lens, the two levels drawn, the name in the view pill
    await pickView('section'); await p.waitForTimeout(1200);
    s3 = await fr3.evaluate(() => S3.secState()); assert(s3.view && s3.fov === 1, JSON.stringify(s3)); assert(Math.abs(s3.dir[1] - 1) < 1e-3 && Math.abs(s3.dir[2]) < 1e-3, 'looking north, level: ' + s3.dir);
    assert.equal(s3.levels, 2, 'the two levels drawn as level lines'); assert.match(await p.locator('#vBtn').innerText(), /Section A/);
    const svg = await fr3.evaluate(() => document.querySelector('svg.secov').textContent); assert.match(svg, /Level 1[\s\S]*\+0\.00[\s\S]*Level 2[\s\S]*\+3\.00/);
    const darkSec = await dark(); assert(darkSec > 300, 'walls and slabs cut in the Section view: ' + darkSec);
    await p.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/section-view.png' : '/dev/null' }).catch(() => {});
    console.log('PASS Section view:', JSON.stringify({ dir: s3.dir, levels: s3.levels, poche: darkSec }));

    // 5 · flip and far clip from the Section popover; the view follows
    if (await p.locator('.sp-pop-sec').isHidden()) await p.click('[data-sp=sec]');
    await p.click('.sp-pop-sec [data-sec=flip]'); await p.waitForTimeout(900); s3 = await fr3.evaluate(() => S3.secState()); assert(s3.view && Math.abs(s3.dir[1] + 1) < 1e-3, 'flipped, looking south: ' + s3.dir);
    await p.click('.sp-pop-sec [data-sec=farOn]'); await p.waitForTimeout(900); s3 = await fr3.evaluate(() => S3.secState()); sec = await frp.evaluate(() => __ws.section()); assert(sec.far > 0 && s3.planes === 2, 'far clip: ' + JSON.stringify([sec.far, s3.planes]));
    await setRange('.sp-pop-sec [data-sec=far]', 3); await p.waitForTimeout(800); sec = await frp.evaluate(() => __ws.section()); assert.equal(sec.far, 3);
    console.log('PASS flip and far clip', sec.far, 'm');

    // 6 · back to 3D: orbit works again, the cut stays put in the world
    await p.click('.sp-pop-sec [data-sec=view]'); await p.waitForTimeout(800); s3 = await fr3.evaluate(() => S3.secState()); assert(!s3.view && s3.cut && s3.planes === 2, JSON.stringify(s3)); assert(await fr3.evaluate(() => S3.secState().fov) > 30, 'the normal lens is back');
    // switching views keeps the model and the section: plan, perspective, isometric
    await pickView('iso'); await p.waitForTimeout(800); assert(await fr3.evaluate(() => S3.secState().cut), 'the cut survives the isometric view');
    await pickView('section'); await p.waitForTimeout(1000); assert(await fr3.evaluate(() => S3.secState().view), 'Section view from isometric');
    await pickView('persp'); await p.waitForTimeout(1000); assert(!(await fr3.evaluate(() => S3.secState().view)), 'Perspective leaves the Section view');
    console.log('PASS view switching keeps the section');

    // 7 · on the plan: drag the line 2 m north, click an arrow to flip it back
    await p.click('[data-sp=dim]'); await p.waitForTimeout(1200); sec = await frp.evaluate(() => __ws.section());
    const m0 = await planPx([(sec.a[0] + sec.b[0]) / 2 - 4, sec.a[1]]), m1 = await planPx([(sec.a[0] + sec.b[0]) / 2 - 4, sec.a[1] + 1.5]);
    await p.mouse.move(m0[0], m0[1]); await p.mouse.down(); await p.mouse.move(m1[0], m1[1], { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(700);
    const moved = await frp.evaluate(() => __ws.section()); assert(Math.abs(moved.a[1] - sec.a[1] - 1.5) < 0.15 && Math.abs(moved.b[1] - sec.b[1] - 1.5) < 0.15, 'dragged 1.5 m: ' + JSON.stringify([sec.a, moved.a]));
    const tip = await frp.evaluate(() => { const s = __ws.section(); return __ws.screenOf([s.a[0], s.a[1]]); }), look = moved.look, bb = await box('#fPlan');
    await p.mouse.click(bb.x + tip[0] + look[0] * 16, bb.y + tip[1] - look[1] * 16); await p.waitForTimeout(600);
    assert.equal((await frp.evaluate(() => __ws.section())).flip, !moved.flip, 'a click on the arrow flips it');
    assert.equal(await body(), body0, 'dragging the section never moves the model');
    await p.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/section-plan.png' : '/dev/null' }).catch(() => {});
    console.log('PASS plan editing: drag', (moved.a[1] - sec.a[1]).toFixed(2), 'm, arrow flips');

    // 8 · Natural ventilation: its per-room result on the cut, with the opacity control
    await p.click('#addSimInt'); await p.click('.w2-simmenu [data-addsim="vent"]'); await p.waitForTimeout(1500);
    await p.waitForFunction(() => /m\/s at 10 m|Without the project weather/.test(document.querySelector('.sp-studycard')?.innerText || ''), null, { timeout: 120000 });
    await p.click('[data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 180000 });
    assert.equal(await p.evaluate(() => window.__wsStudy.state().err), '');
    await frp.evaluate(() => __ws.sectionSet({ far: null })); await p.click('[data-sp=dim]'); await p.waitForTimeout(1500);
    assert.doesNotMatch(await p.locator('.sp-studycard').innerText(), /Model changed/, 'moving the section is not a change to the model the study ran on');
    s3 = await fr3.evaluate(() => S3.secState()); assert(s3.band && s3.cut, 'ventilation drawn on the cut: ' + JSON.stringify(s3));
    if (await p.locator('.sp-pop-sec').isHidden()) await p.click('[data-sp=sec]');
    pop = await p.locator('.sp-pop-sec').innerText(); assert.match(pop, /Simulation on the cut[\s\S]*one value per room[\s\S]*not air speed or temperature/i);
    await setRange('.sp-pop-sec [data-sec=op]', 0.3); await p.waitForTimeout(300); assert.equal(await fr3.evaluate(() => S3.secState().opacity), 0.3);
    await p.click('.sp-pop-sec [data-sec=view]'); await p.waitForTimeout(1200); assert(!(await p.locator('.sp-pop-sec').isHidden()), 'the popover stays open'); assert(await fr3.evaluate(() => S3.secState().view && S3.secState().band));
    await p.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/section-vent.png' : '/dev/null' }).catch(() => {});
    await p.click('.sp-pop-sec [data-sec=bands]'); await p.waitForTimeout(300); assert(!(await fr3.evaluate(() => S3.secState().band)), 'the result can be hidden on the cut');
    await p.click('.sp-pop-sec [data-sec=bands]'); await p.click('.sp-pop-sec [data-sec=view]'); await p.waitForTimeout(600);
    console.log('PASS Natural ventilation on the cut');

    // 9 · Cut the 3D view off, then delete; the model is as it was
    await p.click('.sp-pop-sec [data-sec=on]'); await p.waitForTimeout(700); s3 = await fr3.evaluate(() => S3.secState()); assert(!s3.cut && s3.planes === 0, 'not cut: ' + JSON.stringify(s3));
    await p.click('.sp-pop-sec [data-sec=del]'); await p.waitForTimeout(800); assert.equal(await frp.evaluate(() => __ws.section()), null); assert.equal(await fr3.evaluate(() => __ws.section()), null);
    assert.match(await p.locator('.sp-pop-sec').innerText(), /Draw section line/);
    assert.equal(await body(), body0, 'walls, openings, floors, furniture and levels unchanged');
    console.log('PASS cut off, section deleted, model unchanged');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
