// Level reuse after an edit (2026-11-19), hospital example, 3D view: the first edit after the project opens draws again only the
// level that changed, in the main 3D view and in the build of every level behind the layer list and the Shaded pane; the floors
// each view keeps (made once, by the view the edit was made in) are the same as a full recalculation; the deleted piece is gone.
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
    const stat = (k) => p.evaluate((k) => __ws2.inst.persp.win.S3._lvStat(k), k);
    const pick = (n) => p.evaluate((n) => { const st = __ws2.model().studio, lv = st.levels.slice().sort((a, b) => a.z - b.z).find((l) => st.furn.filter((x) => x.lv === l.id && !x.gen).length > 3).id;
      const f = st.furn.filter((x) => x.lv === lv && !x.gen)[n]; __ws2.UI.sels = ['ps:furn:' + f.id]; return { id: f.id, lv }; }, n);
    for (let n = 0; n < 2; n++) {
      const w0 = (await stat('ws')).length, m0 = (await stat('main')).length, f = await pick(n);
      await p.evaluate(() => { document.activeElement?.blur?.(); document.body.focus(); }); await p.keyboard.press('Delete');
      await p.waitForFunction((n) => __ws2.inst.persp.win.S3._lvStat('ws').length > n, w0, { timeout: 30000 }); await p.waitForTimeout(1500);
      const ws = (await stat('ws')).slice(w0), main = (await stat('main')).slice(m0);
      assert(ws.length >= 1 && ws.every((b) => b.built.length <= 1 && b.built.every((l) => l === f.lv)), 'every-level build: only ' + f.lv + ' drawn again: ' + JSON.stringify(ws));
      assert(main.every((b) => b.built.every((l) => l === f.lv)), 'main 3D view: only ' + f.lv + ' drawn again: ' + JSON.stringify(main));
      const gone = await p.evaluate((id) => !__ws2.model().studio.furn.some((x) => x.id === id) && !__ws2.model().components.some((c) => c.id === 'ps:furn:' + id) && !__ws2.inst.persp.ws.objects().some((o) => o.k === 'furn' && o.id === id), f.id);
      assert(gone, 'the deleted piece is gone from the model, the layer list and the 3D view');
      console.log(`PASS edit ${n + 1} after opening (a piece of furniture on ${f.lv} deleted): the every-level build kept ${ws.at(-1).reused.length} levels and drew ${ws.at(-1).built.join(', ') || 'none'} again; the main 3D view drew ${[...new Set(main.flatMap((b) => b.built))].join(', ') || 'no level'} again`);
    }
    const cmp = await p.evaluate(() => { const out = {}; for (const r of ['plan', 'persp', 'props']) { const w = __ws2.inst[r].win, M = JSON.parse(__ws2.inst[r].ws.model()), C = JSON.parse(JSON.stringify(M)); w.PCStudioGeometry.upsertAutoFloors(C, {});
      const key = (F) => F.filter((f) => f.auto).map((f) => f.id + ':' + f.lv + ':' + JSON.stringify(f.points) + JSON.stringify(f.holes)).sort().join('|'); out[r] = { n: M.floors.filter((f) => f.auto).length, same: key(M.floors) === key(C.floors) }; } return out; });
    assert(Object.values(cmp).every((x) => x.same && x.n > 0), JSON.stringify(cmp));
    console.log(`PASS the automatic floors in the plan, 3D and properties views (${cmp.plan.n} each) are the same as a full recalculation`);
    assert.deepEqual(errs, [], 'no page errors');
  } finally { await b.close(); }
})();
