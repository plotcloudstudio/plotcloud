// Deleting a selection of many objects at once (2026-11-18), hospital example, 3D view: 20 walls and the furniture of the ground floor
// (about 40 objects) selected, Delete: every one is gone in one step, the screen updates (time printed), the rooms and the 3D follow;
// one Undo brings every one back, Redo removes them again; no page errors.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 960 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'persp' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    const id = await p.evaluate(async () => (await import('./js/hospital-example.js')).openHospital().id); await p.goto(base + '/mvp/#/workspace/' + id);
    await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(4000);
    const ids = await p.evaluate(() => { const st = __ws2.model().studio, lv = st.levels.slice().sort((a, b) => a.z - b.z).find((l) => st.walls.some((w) => w.lv === l.id)).id;
      return [...st.walls.filter((x) => x.lv === lv).slice(0, 20).map((x) => 'ps:wall:' + x.id), ...(st.furn || []).filter((x) => x.lv === lv).slice(0, 20).map((x) => 'ps:furn:' + x.id)]; });
    const left = () => p.evaluate((ids) => ids.filter((c) => { const [, k, i] = c.split(':'); return (__ws2.model().studio[k === 'wall' ? 'walls' : 'furn'] || []).some((o) => o.id === i); }).length, ids);
    assert.equal(await left(), ids.length); const n0 = await p.evaluate(() => ({ w: __ws2.model().studio.walls.length, f: (__ws2.model().studio.furn || []).length }));
    await p.evaluate((ids) => { __ws2.UI.sels = ids; }, ids); await p.evaluate(() => { document.activeElement?.blur?.(); document.body.focus(); });
    // timed in the page (2026-11-19): Delete → the first frame after the 3D view hid them (what the person sees), and how long the page is busy
    await p.evaluate(() => { const T = window.__delT = { key: 0, hid: 0, shown: 0, busy: 0, gap: 0 }, ws = __ws2.inst.persp.ws, h = ws.hideNow; let last = 0;
      ws.hideNow = function (...a) { const n = h.apply(this, a); if (n > 0) T.hid = performance.now(); return n; };
      addEventListener('keydown', (e) => { if (e.key === 'Delete') T.key = performance.now(); }, true);
      requestAnimationFrame(function f(t) { const n = performance.now(); if (T.hid && !T.shown) T.shown = n; if (T.key && last && n - last > 40) T.busy = Math.max(T.busy, n); if (T.key && last) T.gap = Math.max(T.gap, n - last); last = n; if (!T.key || n - T.key < 3000) requestAnimationFrame(f); }); });
    const t0 = Date.now(); await p.keyboard.press('Delete');
    await p.waitForFunction((ids) => ids.every((c) => { const [, k, i] = c.split(':'); return !(__ws2.model().studio[k === 'wall' ? 'walls' : 'furn'] || []).some((o) => o.id === i); }), ids, { timeout: 30000 }); const dt2 = Date.now() - t0;
    assert.equal(await left(), 0, 'every selected object deleted'); assert.equal((await p.evaluate(() => __ws2.sels())).length, 0, 'selection cleared');
    await p.waitForTimeout(3000); const T = await p.evaluate(() => window.__delT); assert(T.hid > 0, 'the 3D view hid the objects before the model was updated');
    const dt = Math.round(T.shown - T.key), busy = Math.round(Math.max(T.busy, T.shown) - T.key); assert(dt < 400, 'gone from the screen ' + dt + ' ms after Delete'); const n1 = await p.evaluate(() => ({ w: __ws2.model().studio.walls.length, f: (__ws2.model().studio.furn || []).length }));
    assert(n0.w - n1.w >= 20 - 2 && n0.f - n1.f === ids.length - ids.filter((c) => c.includes(':wall:')).length, JSON.stringify({ n0, n1 }));   // walls: joined lines may merge
    const in3D = await p.evaluate((ids) => { const st = __ws2.inst.persp.ws.objects(); return ids.filter((c) => { const [, k, i] = c.split(':'); return st.some((o) => o.k === k && o.id === i); }).length; }, ids); assert.equal(in3D, 0, 'gone from the 3D pane too');
    console.log(`PASS ${ids.length} selected objects deleted in one step; gone from the 3D view ${dt} ms after Delete (the next frame drawn), the page busy until ${busy} ms while the model and the other views update (longest pause between frames ${Math.round(T.gap)} ms); the model updated by ${dt2} ms; gone from every pane`);
    // the automatic floors: made once, by the view the edit was made in, on the level whose walls changed (2026-11-19); the same as a full recalculation in every view
    const floorsOk = () => p.evaluate(() => { const out = {}; for (const r of ['plan', 'persp', 'props']) { const w = __ws2.inst[r].win, M = JSON.parse(__ws2.inst[r].ws.model()), C = JSON.parse(JSON.stringify(M)); w.PCStudioGeometry.upsertAutoFloors(C, {});
      const key = (F) => F.filter((f) => f.auto).map((f) => f.id + ':' + f.lv + ':' + JSON.stringify(f.points) + JSON.stringify(f.holes)).sort().join('|'); out[r] = { n: M.floors.filter((f) => f.auto).length, same: key(M.floors) === key(C.floors) }; } return out; });
    const fl1 = await floorsOk(); assert(Object.values(fl1).every((x) => x.same), 'floors after the delete ' + JSON.stringify(fl1));
    await p.evaluate(() => __ws2.hub.undo()); await p.waitForTimeout(2500); assert.equal(await left(), ids.length, 'one Undo restores every one');
    const fl2 = await floorsOk(); assert(Object.values(fl2).every((x) => x.same), 'floors after Undo ' + JSON.stringify(fl2));
    console.log(`PASS the automatic floors match a full recalculation in the plan, 3D and properties views after the delete (${fl1.plan.n}) and after Undo (${fl2.plan.n})`);
    await p.evaluate(() => __ws2.hub.redo()); await p.waitForTimeout(2500); assert.equal(await left(), 0, 'Redo deletes them again');
    console.log('PASS one Undo brings all of them back; Redo removes them again');
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
