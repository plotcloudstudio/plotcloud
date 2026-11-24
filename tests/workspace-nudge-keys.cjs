// Plan Studio keys in the Workspace (2026-11-23), hospital example, plan pane:
// arrow keys nudge any selection 1 mm (10 mm with Shift), one undo step each; Esc clears a group selection;
// a click on a room's name label picks the room, not the floor or furniture under it; hiding Rooms also hides the room fill.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 960 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'plan' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    const id = await p.evaluate(async () => (await import('./js/hospital-example.js')).openHospital().id); await p.goto(base + '/mvp/#/workspace/' + id);
    await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(3000);
    // everything below runs in the page; the plan pane is __ws2.inst.plan.win, its model and test hooks are on win.__st
    const W = (fn, arg) => p.evaluate(([src, arg]) => { const w = __ws2.inst.plan.win; return new Function('w', 'st', 'arg', src)(w, w.__st, arg); }, [fn, arg]);
    const key = (k, shift) => W(`w.document.body.focus(); w.document.body.dispatchEvent(new w.KeyboardEvent('keydown', { key: arg[0], shiftKey: !!arg[1], bubbles: true, cancelable: true }));`, [k, shift]);
    const fid = await W(`const f = st.M.furn.find((q) => q.lv === st.LV && !q.locked && !(st.M.hiddenIds || []).includes(q.id)); st.select({ k: 'furn', id: f.id }); return f.id;`);
    await p.waitForTimeout(300);
    const pos = () => W(`const f = st.M.furn.find((q) => q.id === arg); return [f.x, f.y];`, fid);
    const p0 = await pos(); await key('ArrowRight'); const p1 = await pos(); await key('ArrowUp', true); const p2 = await pos();
    assert(Math.abs(p1[0] - p0[0] - 0.001) < 1e-6 && Math.abs(p1[1] - p0[1]) < 1e-6, 'ArrowRight moves 1 mm ' + JSON.stringify([p0, p1]));
    assert(Math.abs(p2[1] - p1[1] - 0.01) < 1e-6, 'Shift+ArrowUp moves 10 mm ' + JSON.stringify([p1, p2]));
    await W(`st.undo();`); const pu = await pos(); assert(Math.abs(pu[1] - p1[1]) < 1e-6 && Math.abs(pu[0] - p1[0]) < 1e-6, 'one Undo takes back one nudge ' + JSON.stringify([p1, pu]));
    await W(`st.undo();`); const pu2 = await pos(); assert(Math.abs(pu2[0] - p0[0]) < 1e-6, 'a second Undo takes back the first ' + JSON.stringify([p0, pu2]));
    const wid = await W(`const w2 = st.M.walls.find((q) => q.lv === st.LV && !q.locked && !q.auto); st.select({ k: 'wall', id: w2.id }); return w2.id;`);
    const wa = await W(`return st.M.walls.find((q) => q.id === arg).a.slice();`, wid); await key('ArrowLeft', true); const wb = await W(`return st.M.walls.find((q) => q.id === arg)?.a.slice();`, wid);
    assert(wb && Math.abs(wb[0] - wa[0] + 0.01) < 1e-4, 'Shift+ArrowLeft moves a wall 10 mm ' + JSON.stringify([wa, wb])); await W(`st.undo();`);
    console.log(`PASS arrow keys: furniture 1 mm and 10 mm with Shift, a wall 10 mm, one Undo per press`);
    // Esc clears a group selection
    const two = await W(`return st.M.furn.filter((q) => q.lv === st.LV && !q.locked).slice(0, 2).map((q) => q.id);`);
    await p.evaluate((ids) => __ws2.hub.box('plan', ids.map((id) => ({ k: 'furn', id })), {}), two); await p.waitForTimeout(800);
    const nBefore = (await p.evaluate(() => __ws2.sels())).length; assert(nBefore >= 2, 'two selected ' + nBefore);
    await key('Escape'); await p.waitForTimeout(800); const nAfter = (await p.evaluate(() => __ws2.sels())).length; assert.equal(nAfter, 0, 'Esc clears the group');
    console.log(`PASS Esc clears a group selection (${nBefore} → ${nAfter})`);
    // the room label
    const lab = await W(`const r = st.rooms().find((q) => q.lx != null); return { want: r.key, got: st.hit([r.lx, r.ly]) };`);
    assert(lab.got && lab.got.k === 'room' && lab.got.id === lab.want, 'label click picks the room ' + JSON.stringify(lab));
    console.log('PASS a click on a room label picks the room ' + lab.want);
    // Rooms hidden → no names, no area, no fill
    const idx = await p.evaluate(() => __ws2.model().layers.findIndex((l) => l.name === 'Rooms')); assert(idx >= 0, 'Rooms layer');
    assert.equal(await W(`return st.layerOn('roomFill');`), true);
    const clicked = await p.evaluate((i) => { const b2 = document.querySelector(`[data-vis="${i}"]`); if (!b2) return false; b2.click(); return true; }, idx);
    assert(clicked, 'the Rooms eye in Layers');
    await p.waitForTimeout(600); const off = await W(`return [st.layerOn('roomNames'), st.layerOn('roomArea'), st.layerOn('roomFill')];`);
    assert.deepEqual(off, [false, false, false], 'Rooms hidden: names, area and fill off ' + JSON.stringify(off));
    console.log('PASS hiding Rooms in Layers hides the names, the areas and the fill');
    // undo history across a visit to another page (2026-11-24): two nudges, Results and back, Undo still takes them back one by one
    const ready = () => p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 });
    const fid2 = await W(`const f = st.M.furn.find((q) => q.lv === st.LV && !q.locked && !(st.M.hiddenIds || []).includes(q.id)); st.select({ k: 'furn', id: f.id }); return f.id;`); await p.waitForTimeout(300);
    const pos2 = () => W(`const f = st.M.furn.find((q) => q.id === arg); return [f.x, f.y];`, fid2);
    const q0 = await pos2(); await key('ArrowRight', true); await key('ArrowRight', true); const q2 = await pos2(); assert(Math.abs(q2[0] - q0[0] - 0.02) < 1e-6, 'two nudges ' + JSON.stringify([q0, q2]));
    const h0 = await p.evaluate(() => __ws2.hub.hist()); await p.waitForTimeout(1500);   // the model saved
    await p.evaluate((id) => { location.hash = '#/results/' + id; }, id); await p.waitForTimeout(2500);
    await p.evaluate((id) => { location.hash = '#/workspace/' + id; }, id); await ready(); await p.waitForTimeout(2500);
    const h1 = await p.evaluate(() => __ws2.hub.hist()); assert(h1.u >= 2 && h1.u === h0.u, 'history kept: ' + JSON.stringify([h0, h1]));
    assert.deepEqual(await pos2(), q2, 'the model is as it was left');
    await p.evaluate(() => __ws2.hub.undo()); await p.waitForTimeout(400); const q1 = await pos2(); assert(Math.abs(q1[0] - q0[0] - 0.01) < 1e-6, 'one Undo after coming back takes back one nudge ' + JSON.stringify([q0, q1]));
    await p.evaluate(() => __ws2.hub.redo()); await p.waitForTimeout(400); assert.deepEqual(await pos2(), q2, 'Redo puts it back');
    console.log(`PASS undo history kept across a visit to Results: ${h1.u} steps; Undo and Redo work after coming back`);
    // the model changed elsewhere while away: the old history is not put back onto it
    await p.waitForTimeout(1500); await p.evaluate((id) => { location.hash = '#/results/' + id; }, id); await p.waitForTimeout(2000);
    await p.evaluate(async (id) => { const S = await import('./js/store.js'); const q = S.project(id); q.draft.studio.furn[0].x += 1; S.save(); }, id);
    await p.evaluate((id) => { location.hash = '#/workspace/' + id; }, id); await ready(); await p.waitForTimeout(2500);
    const h2 = await p.evaluate(() => __ws2.hub.hist()); assert.equal(h2.u, 0, 'no stale history on a changed model ' + JSON.stringify(h2));
    console.log('PASS a model changed while away starts with an empty history (no stale steps)');
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
