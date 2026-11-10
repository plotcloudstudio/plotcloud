// Section in the Workspace (2026-11-10, a key plan): the Section button opens a plan at preview size where the cut is drawn, any
// angle and with turns; Use this section shrinks it into a key plan in the top right corner. The two-storey block of the
// ventilation test: the cut kept in the model (both views, undo); the 3D view cut segment by segment with filled cut faces; the
// Section view unfolded at the turns, with the levels; flip and editing from the key plan; Natural ventilation, Wind flow and
// Daylight on the section; closing the key plan ends the section. The model's walls, doors and windows are unchanged throughout.
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

    const kpOpen = async () => { await p.waitForSelector('.sp-kp', { timeout: 10000 }); return p.locator('.sp-kp').innerText(); };
    const edPt = (x, y) => p.evaluate((q) => window.__wsSection.toScreen(q), [O.X + x, O.Y + y]);
    const run = async () => { await p.click('[data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 }); return p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, rows: s.res?.rows || [], on: !!s.res?.onSection }; }); };

    // 1 · Section on the right rail opens the plan at preview size; three clicks with a turn, Enter, Use this section
    await p.click('[data-sp=sec]'); await p.waitForSelector('.sxs', { timeout: 10000 }); const ed = await p.locator('.sxs-win').boundingBox();
    assert(Math.abs(ed.width / 1600 - 0.7) < 0.03 && Math.abs(ed.height / 900 - 0.7) < 0.03, 'the plan at preview size: ' + JSON.stringify(ed)); assert.match(await p.locator('.sxs').innerText(), /Section A[\s\S]*Click where the cut starts/);
    for (const [x, y] of [[-3, 3], [9, 3], [14, 9.5], [27, 9.5]]) { const s2 = await edPt(x, y); await p.mouse.click(s2[0], s2[1]); await p.waitForTimeout(120); }
    await p.keyboard.press('Enter'); await p.waitForTimeout(200); let st = await p.evaluate(() => window.__wsSection.state()); assert(!st.drawing && st.pts.length === 4, 'four points, three segments: ' + JSON.stringify(st));
    assert.match(await p.locator('.sxs-len').innerText(), /m · 3 segments/); await p.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/section-editor.png' : '/dev/null' }).catch(() => {});
    await p.click('.sxs [data-se=ok]'); await p.waitForTimeout(1500); assert.equal(await p.locator('.sxs').count(), 0, 'the editor closes');
    let kp = await kpOpen(); assert.match(kp, /Section A[\s\S]*3 segments[\s\S]*3D cut[\s\S]*Section/); const kb = await p.locator('.sp-kp').boundingBox(); assert(kb.x > 1100 && kb.y < 120, 'top right: ' + JSON.stringify(kb));
    let sec = await frp.evaluate(() => __ws.section()); assert(sec && sec.pts.length === 4 && sec.segs.length === 3, 'in the model: ' + JSON.stringify(sec)); assert(Math.abs(sec.pts[2][0] - (O.X + 14)) < 0.2, 'a turn at any angle kept as drawn');
    await p.waitForTimeout(600); assert(await fr3.evaluate(() => !!__ws.section()), 'the 3D pane has it too'); assert.equal(await body(), body0, 'the model itself is untouched');
    console.log('PASS editor → key plan:', sec.pts.map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' → '));

    // 2 · undo and redo (the key plan follows)
    await frp.evaluate(() => __ws.undo()); await p.waitForTimeout(1200); assert.equal(await frp.evaluate(() => __ws.section()), null, 'undo removes it'); await p.waitForFunction(() => !document.querySelector('.sp-kp'), null, { timeout: 8000 }).catch(() => {}); assert.equal(await p.locator('.sp-kp').count(), 0, 'and its key plan');
    await frp.evaluate(() => __ws.redo()); await p.waitForTimeout(1200); assert(await frp.evaluate(() => !!__ws.section()), 'redo brings it back'); await kpOpen();

    // 3 · 3D cutaway: one pass per segment, filled cut faces, lit, the site not cut
    if (await p.evaluate(() => __ws2.UI.view) !== 'persp') { await p.click('[data-sp=dim]'); await p.waitForTimeout(1500); }
    await fr3.evaluate((o) => S3.fitBox({ x0: o.X, y0: o.Y, x1: o.X + 24, y1: o.Y + 12 }, 3, 0.9), O); await p.waitForTimeout(500);
    let s3 = await fr3.evaluate(() => { S3.png(); return S3.secState(); }); assert(s3.cut && s3.passes === 3 && !s3.view, 'the 3D view cut segment by segment: ' + JSON.stringify(s3)); assert(s3.caps > 10, 'closed meshes take part in the cut faces: ' + s3.caps);
    const dark = () => fr3.evaluate(async () => { const im = new Image(); im.src = S3.png(); await im.decode(); const c2 = document.createElement('canvas'); c2.width = im.width; c2.height = im.height; const x = c2.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c2.width, c2.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 0x23) < 6 && Math.abs(d[i + 1] - 0x26) < 6 && Math.abs(d[i + 2] - 0x2b) < 6) n++; return n; });
    const black = () => fr3.evaluate(async () => { const im = new Image(); im.src = S3.png(); await im.decode(); const c2 = document.createElement('canvas'); c2.width = im.width; c2.height = im.height; const x = c2.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c2.width, c2.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 14 && d[i + 1] < 14 && d[i + 2] < 14) n++; return n / (d.length / 4); });
    const earth = () => fr3.evaluate(async () => { const im = new Image(); im.src = S3.png(); await im.decode(); const c2 = document.createElement('canvas'); c2.width = im.width; c2.height = im.height; const x = c2.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c2.width, c2.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 0xb9) < 4 && Math.abs(d[i + 1] - 0xb2) < 4 && Math.abs(d[i + 2] - 0xa4) < 4) n++; return n / (d.length / 4); });
    if (process.env.SHOT_DIR) { const u = await fr3.evaluate(() => S3.png()); require('fs').writeFileSync(process.env.SHOT_DIR + '/cut3d.png', Buffer.from(u.split(',')[1], 'base64')); }
    const darkCut = await dark(); assert(darkCut > 200, 'cut faces painted solid: ' + darkCut); const bl = await black(); assert(bl < 0.004, `the cut building is lit, not black: ${(bl * 100).toFixed(2)}%`);
    for (const [r, low] of [[150, false], [400, true]]) { await fr3.evaluate(([o, r2, lo]) => S3.fitBox({ x0: o.X - r2, y0: o.Y - r2, x1: o.X + r2, y1: o.Y + r2 }, 0, 0.6, lo), [O, r, low]); await p.waitForTimeout(600); const e = await earth(); assert(e < 0.002, `no cut ground in the 3D cutaway (${r} m round): ${(e * 100).toFixed(2)}%`); }
    console.log('PASS 3D cutaway:', JSON.stringify({ passes: s3.passes, caps: s3.caps, poche: darkCut }));

    // 4 · the Section view from the key plan: unfolded at the turns (three strips, two fold lines), the levels, the ground cut
    await p.click('.sp-kp [data-kp=sec]'); await p.waitForTimeout(1500); s3 = await fr3.evaluate(() => S3.secState());
    assert(s3.view && s3.panels.length === 3 && s3.folds === 2 && s3.levels === 2, 'unfolded: ' + JSON.stringify(s3)); assert(s3.panels[0][1] === s3.panels[1][0] && s3.panels[1][1] === s3.panels[2][0], 'the strips meet: ' + JSON.stringify(s3.panels));
    assert.match(await p.locator('#vBtn').innerText(), /Section A/); assert.equal(await p.getAttribute('.sp-kp [data-kp=sec]', 'aria-pressed'), 'true');
    const svg = await fr3.evaluate(() => document.querySelector('svg.secov').textContent); assert.match(svg, /Level 1[\s\S]*\+0\.00[\s\S]*Level 2[\s\S]*\+3\.00/);
    const darkSec = await dark(); assert(darkSec > 300, 'walls and slabs cut in the Section view: ' + darkSec); assert(await earth() > 0.02, 'the ground cut in the Section view');
    const k0 = s3.scale; await p.mouse.move(800, 450); await p.mouse.wheel(0, -300); await p.waitForTimeout(300); assert((await fr3.evaluate(() => S3.secState().scale)) > k0, 'the wheel zooms the section');
    await fr3.evaluate(() => S3.secFit()); await p.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/section-view.png' : '/dev/null' }).catch(() => {});
    console.log('PASS Section view unfolded:', JSON.stringify({ panels: s3.panels, levels: s3.levels, poche: darkSec }));

    // 5 · flip from the key plan; the strips run the other way
    await p.click('.sp-kp [data-kp=flip]'); await p.waitForTimeout(1000); sec = await frp.evaluate(() => __ws.section()); assert.equal(sec.flip, true); s3 = await fr3.evaluate(() => S3.secState()); assert(s3.view && s3.panels.length === 3);
    console.log('PASS flip from the key plan');

    // 6 · change the cut: a click on the key plan opens the editor with the cut; drag a point; Use this section
    await p.click('.sp-kp .sp-kp-plan'); await p.waitForSelector('.sxs'); st = await p.evaluate(() => window.__wsSection.state()); assert(!st.drawing && st.pts.length === 4 && st.flip, 'the cut to change: ' + JSON.stringify(st));
    const v0 = await edPt(14, 9.5), v1 = await edPt(15, 6); await p.mouse.move(v0[0], v0[1]); await p.mouse.down(); await p.mouse.move(v1[0], v1[1], { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
    st = await p.evaluate(() => window.__wsSection.state()); assert(Math.abs(st.pts[2][0] - (O.X + 15)) < 0.3 && Math.abs(st.pts[2][1] - (O.Y + 6)) < 0.3, 'the point moved: ' + JSON.stringify(st.pts[2]));
    await p.click('.sxs [data-se=ok]'); await p.waitForTimeout(1500); sec = await frp.evaluate(() => __ws.section()); assert(Math.abs(sec.pts[2][1] - (O.Y + 6)) < 0.3, 'kept in the model'); assert.equal(await body(), body0, 'editing the cut never moves the model');
    console.log('PASS editing from the key plan');

    // 7 · back to 3D from the key plan; the views keep the section
    await p.click('.sp-kp [data-kp="3d"]'); await p.waitForTimeout(800); s3 = await fr3.evaluate(() => S3.secState()); assert(!s3.view && s3.cut, JSON.stringify(s3));
    await pickView('iso'); await p.waitForTimeout(800); assert(await fr3.evaluate(() => S3.secState().cut), 'the cut survives the isometric view');
    await pickView('section'); await p.waitForTimeout(1000); assert(await fr3.evaluate(() => S3.secState().view), 'Section view from the View menu');
    await pickView('persp'); await p.waitForTimeout(1000); assert(!(await fr3.evaluate(() => S3.secState().view)), 'Perspective leaves the Section view');
    console.log('PASS view switching keeps the section');

    // 8 · Natural ventilation on the cut: each room's value, the flow at the openings across a straight north–south cut
    await p.click('#addSimInt'); await p.click('.w2-simmenu [data-addsim="vent"]'); await p.waitForTimeout(1500);
    await p.waitForFunction(() => /m\/s at 10 m|Without the project weather/.test(document.querySelector('.sp-studycard')?.innerText || ''), null, { timeout: 120000 });
    let r = await run(); assert.equal(r.err, '');
    await frp.evaluate((o) => __ws.sectionSet({ pts: [[o.X + 2.5, o.Y - 3], [o.X + 2.5, o.Y + 15]], flip: false }), O); await p.waitForTimeout(1500);
    await p.click('.sp-kp [data-kp=sec]'); await p.waitForTimeout(1500); s3 = await fr3.evaluate(() => S3.secState()); assert(s3.band && s3.view, 'ventilation on the cut: ' + JSON.stringify(s3));
    let nt = s3.notes; assert(nt && nt.rooms >= 4 && nt.across >= 4, 'room values and flows across the cut: ' + JSON.stringify(nt));
    const u = await fr3.evaluate(() => __ws.sectionPNG(['QA'])); assert(u && u.length > 50000, 'the Section view as a picture');
    await p.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/section-vent.png' : '/dev/null' }).catch(() => {});
    await p.click('.sp-studycard [data-st=close]').catch(() => {}); await p.waitForTimeout(600);
    console.log('PASS Natural ventilation on the cut:', JSON.stringify(nt));

    // 9 · Wind flow on the section: a cut west–east, the wind from the east, a vertical flow along the cut drawn on it
    await frp.evaluate((o) => __ws.sectionSet({ pts: [[o.X - 3, o.Y + 3], [o.X + 10, o.Y + 3], [o.X + 14, o.Y + 9], [o.X + 27, o.Y + 9]] }), O); await p.waitForTimeout(1200);
    await p.click('#addSimBtn'); await p.click('.w2-simmenu [data-addsim="wind"]'); await p.waitForTimeout(1500); await p.click('.sp-studycard [data-st-mode=section]'); await p.waitForTimeout(2500);
    await p.click('.sp-studycard [data-wdir="4"]'); await p.waitForTimeout(300); r = await run(); assert.equal(r.err, ''); assert(r.on, 'a result on the section');
    const rk = r.rows.map((x) => x[0]).join(' | '); assert.match(rk, /Along the cut[\s\S]*Speed-up, windiest 1 % of the section[\s\S]*At 1\.5 m along the cut/);
    await p.waitForTimeout(1500); s3 = await fr3.evaluate(() => S3.secState()); assert(s3.view && s3.field !== false && s3.bands === 3, 'the flow on every segment of the cut, in the Section view: ' + JSON.stringify(s3));
    assert.match(await p.locator('.sp-kp').innerText(), /on the cut/);
    await p.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/section-wind.png' : '/dev/null' }).catch(() => {});
    await p.click('.sp-studycard [data-st-view=ratio]'); await p.waitForTimeout(600); assert(await fr3.evaluate(() => S3.secState().bands === 3));
    await p.click('.sp-studycard [data-st=close]').catch(() => {}); await p.waitForTimeout(600);
    console.log('PASS Wind flow on the section:', r.rows.slice(1, 5).map((x) => x.join(' ')).join(' · '));

    // 10 · Daylight on the section: the floor study's sky at points of the cut, every level
    await p.click('#addSimInt'); await p.click('.w2-simmenu [data-addsim="daylight"]'); await p.waitForTimeout(1500); await p.click('.sp-studycard [data-st-mode=section]'); await p.waitForTimeout(400);
    r = await run(); assert.equal(r.err, ''); assert(r.on); assert.match(r.rows.map((x) => x.join(' ')).join(' | '), /Daylight factor on the cut, mean \d[\s\S]*Level 1 mean[\s\S]*Level 2 mean/);
    await p.waitForTimeout(1200); s3 = await fr3.evaluate(() => S3.secState()); assert(s3.bands >= 1, 'daylight on the cut: ' + JSON.stringify(s3));
    await p.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/section-daylight.png' : '/dev/null' }).catch(() => {});
    console.log('PASS Daylight on the section:', r.rows.slice(0, 2).map((x) => x.join(' ')).join(' · '));

    // 11 · closing the key plan ends the section; the model is as it was; Section offers the last cut again
    await p.click('.sp-kp [data-kp=x]'); await p.waitForTimeout(1200); assert.equal(await frp.evaluate(() => __ws.section()), null); assert.equal(await fr3.evaluate(() => __ws.section()), null); assert.equal(await p.locator('.sp-kp').count(), 0);
    assert(!(await fr3.evaluate(() => S3.secState().cut)), 'nothing cut'); assert.equal(await body(), body0, 'walls, openings, floors, furniture and levels unchanged');
    await p.click('[data-sp=sec]'); await p.waitForSelector('.sxs'); st = await p.evaluate(() => window.__wsSection.state()); assert.equal(st.pts.length, 4, 'the last cut offered again'); await p.keyboard.press('Escape'); await p.waitForTimeout(300); assert.equal(await p.locator('.sxs').count(), 0, 'Esc closes the editor');
    console.log('PASS key plan closed, section ended, model unchanged');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
