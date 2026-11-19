// Privacy window risk (2026-11-19), hospital example, ground floor: the run scores every window from its sight lines; the 3D view puts a
// translucent sheet of the risk colour on each window's glass (on the glass's own geometry: nothing floating or shifted) and the plan
// colours the same windows; both views get one id → colour list, the same as the stored result and the legend; a window clicked shows
// its risk, score and direction; raising a sill or building a screen wall in front of a window lowers its score on the rerun (and the
// window shows grey as changed until then); switching level, reloading the project and opening Privacy again keep the colours; the
// overlay switches off and its opacity changes; another study shows no overlay and the glass keeps its own materials; no page errors.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 960 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'persp' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    const id = await p.evaluate(async () => (await import('./js/hospital-example.js')).openHospital().id), url = base + '/mvp/#/workspace/' + id;
    const boot = async () => { await p.goto(url); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready && window.__wsStudy, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(2500); };
    await boot();
    const R = await p.evaluate(async () => { const m = await import('./js/interior/privacy.js?v=priv-20261119-1'); return { RISK: m.RISK, AT: m.RISK_AT }; });
    const riskOf = (s) => (s == null ? 'na' : s >= R.AT.high ? 'high' : s >= R.AT.medium ? 'medium' : 'low');
    const idle = () => p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 });
    const run = async () => { await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await p.waitForTimeout(300); await idle(); await p.waitForTimeout(800); const e = await p.evaluate(() => window.__wsStudy.state().err); assert(!e, 'study error: ' + e); };
    const lvNow = () => p.evaluate(() => __ws2.inst.persp.ws.level());
    const st = () => p.evaluate(() => { const P = window.__wsPriv(), lv = __ws2.inst.persp.ws.level(), S3 = __ws2.inst.persp.win.S3;
      return { lv, rec: P.store[lv] || null, cols: P.cols?.cols || {}, cnt: P.cols?.cnt || {}, info: Object.fromEntries(Object.entries(P.cols?.info || {}).map(([k, v]) => [k, { risk: v.risk, why: v.why, lv: v.lv }])), plan: __ws2.inst.plan.ws.winRiskState(), persp: __ws2.inst.persp.ws.winRiskState(), sheets: S3._winRisk(), glass: S3._glass() }; });
    const setLv = async (l) => { await p.evaluate((l) => { for (const I of Object.values(__ws2.inst)) if (I?.ready) try { I.ws.level(l); } catch { } }, l); await p.waitForTimeout(1500); };
    const edit = (f) => p.evaluate((f) => { const fr = [...document.querySelectorAll('iframe')].find((x) => /ws=plan/.test(x.src)).contentWindow, M = JSON.parse(fr.__ws.model()); new Function('M', f)(M); const s = JSON.stringify(M); fr.__ws.apply(s, false); window.__ws2.hub.change('plan', s, false); }, f);

    // ---- the run
    await p.evaluate(() => window.__wsStudy.open('privacy')); await p.waitForSelector('.sp-studycard'); await p.waitForTimeout(800);
    const glass0 = (await st()).glass; await run(); let s = await st(); const lv1 = s.lv;
    assert(s.rec && s.rec.list.length >= 8, 'a window result for the level: ' + JSON.stringify(s.rec && s.rec.list.length));
    const scored = s.rec.list.filter((x) => x.risk !== 'na'); assert(scored.length >= 8 && scored.every((x) => x.risk === riskOf(x.score) && x.score >= 0 && x.score <= 100), 'every score in 0–100, its class from the shared thresholds');
    assert(new Set(scored.map((x) => x.risk)).size >= 2, 'more than one class on the floor: ' + JSON.stringify(scored.map((x) => x.score)));
    // the score follows from the sight lines: the parts it is made of are recorded and consistent
    for (const x of scored) assert(x.nSeen <= x.nFront && x.seen >= 0 && x.seen <= 100 && x.floor >= 0 && x.floor <= 100 && (x.score === 0 || x.nSeen > 0), JSON.stringify(x));
    // ---- 3D: a sheet on the glass of each coloured window of this level, on the glass's own geometry, in its colour
    const onLv = Object.entries(s.info).filter(([, v]) => v.lv === lv1).map(([k]) => k), glassIds = new Set(s.glass.ids);
    assert(s.sheets.length > 0, 'sheets in 3D'); assert(s.sheets.every((x) => x.sameGeometry && x.offset === 0 && x.visible), 'every sheet on its glass, not moved: ' + JSON.stringify(s.sheets.find((x) => !(x.sameGeometry && x.offset === 0))));
    for (const x of s.sheets) assert.equal(x.col, R.RISK[s.info[x.id].risk].col, 'the sheet of ' + x.id + ' in the colour of its class');
    const covered = new Set(s.sheets.map((x) => x.id)); for (const k of onLv) if (glassIds.has(k)) assert(covered.has(k), 'the glass of ' + k + ' has its sheet');
    // ---- 2D and 3D: the same list, the same as the result
    assert.deepEqual(s.plan.cols, s.persp.cols, 'the plan and the 3D view get the same id → colour list');
    for (const x of scored) assert.equal(s.plan.cols[x.id], R.RISK[x.risk].col, 'window ' + x.id + ': plan colour = its class');
    // drawn on the plan: the pixel in the middle of each window, with the overlay fully opaque, is its class's colour
    await p.evaluate(() => { const r = document.querySelector('[data-privov=op]'); r.value = '0.9'; r.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(400);
    for (const x of scored) assert.equal(await p.evaluate((i) => __ws2.inst.plan.ws._winRiskPx(i), x.id), R.RISK[x.risk].col, 'the plan draws window ' + x.id + ' in ' + R.RISK[x.risk].col);
    await p.evaluate(() => { const r = document.querySelector('[data-privov=op]'); r.value = '0.55'; r.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(400);
    const legend = await p.evaluate(() => [...document.querySelectorAll('.sp-legend [data-priv-legend] .sp-privkey')].map((e) => [e.dataset.risk, +(e.querySelector('em')?.textContent ?? NaN)]));
    const cntNow = { high: 0, medium: 0, low: 0, na: 0 }; for (const k of Object.keys(s.plan.cols)) cntNow[s.info[k].risk]++;
    assert.deepEqual(Object.fromEntries(legend), cntNow, 'the legend counts the windows of each class: ' + JSON.stringify(legend));
    const hi = scored.slice().sort((a, b) => b.score - a.score)[0];
    console.log(`PASS ${scored.length} windows scored on ${lv1} (High ${scored.filter((x) => x.risk === 'high').length}, Medium ${scored.filter((x) => x.risk === 'medium').length}, Low ${scored.filter((x) => x.risk === 'low').length}); ${s.sheets.length} sheets on the glass of ${covered.size} windows in 3D, each on the glass's own geometry; the plan and 3D lists are the same and the plan draws each window in its colour; the legend counts ${JSON.stringify(cntNow)}`);
    // ---- a window clicked (as the view reports a click): its risk, score and direction; both views mark it
    await p.evaluate((i) => __ws2.hub.select('persp', { k: 'op', id: i }), hi.id); await p.waitForTimeout(800);
    const det = await p.evaluate(() => { const d = document.querySelector('[data-priv-detail]'); return d && { id: d.dataset.privDetail, risk: d.dataset.risk, text: d.innerText }; });
    assert(det && det.id === hi.id && det.risk === hi.risk && det.text.includes('score ' + hi.score) && /Mainly seen from/.test(det.text), JSON.stringify(det));
    s = await st(); assert(s.plan.sel === hi.id && s.persp.sel === hi.id, 'both views mark the selected window');
    // from the list: the row selects the window in the model
    const other = scored.find((x) => x.id !== hi.id); await p.evaluate((i) => document.querySelector(`[data-privwin="${i}"]`)?.click(), other.id); await p.waitForTimeout(1200);
    assert.equal(await p.evaluate(() => __ws2.sels().at(-1)), 'ps:op:' + other.id, 'the list row selects its window');
    console.log(`PASS a window clicked: ${det.text.replace(/\s+/g, ' ').slice(0, 220)}; a row of the list selects its window in the model`);
    // ---- the sill raised to 2.0 m: grey until the rerun, then a lower score
    await edit(`const o = M.ops.find((q) => q.id === '${hi.id}'); o.sill = 2.0; o.head = Math.max(o.head || 2.1, 2.4);`); await p.waitForTimeout(1500);
    s = await st(); assert.equal(s.info[hi.id].risk, 'na', 'changed since the run: not analysed'); assert.equal(s.plan.cols[hi.id], R.RISK.na.col); assert.equal(s.persp.cols[hi.id], R.RISK.na.col);
    await run(); s = await st(); const hi2 = s.rec.list.find((x) => x.id === hi.id);
    assert(hi2 && hi2.score < hi.score && s.plan.cols[hi.id] === R.RISK[hi2.risk].col && s.persp.cols[hi.id] === R.RISK[hi2.risk].col, `sill 2.0 m: ${hi.score} → ${hi2 && hi2.score}`);
    console.log(`PASS the sill of ${hi.room} raised to 2.0 m: grey (changed) until the rerun, then score ${hi.score} → ${hi2.score} (${hi2.risk}), the same in both views`);
    // ---- a screen wall 1.5 m outside another window: lower score on the rerun
    const tgt = s.rec.list.filter((x) => x.risk !== 'na' && x.id !== hi.id && x.score > 10).sort((a, b) => b.score - a.score)[0];
    await edit(`const o = M.ops.find((q) => q.id === '${tgt.id}'), w = M.walls.find((q) => q.id === o.wall), L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), d = [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L], m = [w.a[0] + d[0] * o.pos, w.a[1] + d[1] * o.pos];
      let n = [-d[1], d[0]]; const f = '${tgt.faces}'; const want = { top: [0, 1], bottom: [0, -1], left: [-1, 0], right: [1, 0] }[f]; if (n[0] * want[0] + n[1] * want[1] < 0) n = [-n[0], -n[1]];
      const c = [m[0] + n[0] * 1.5, m[1] + n[1] * 1.5]; M.walls.push({ id: 'wPrivQA', lv: w.lv, a: [c[0] - d[0] * 4, c[1] - d[1] * 4], b: [c[0] + d[0] * 4, c[1] + d[1] * 4], t: 0.2, h: 4, object_type: 'wall', layer: 'Wall' });`);
    await p.waitForTimeout(1500); await run(); s = await st(); const tg2 = s.rec.list.find((x) => x.id === tgt.id);
    assert(tg2 && tg2.score < tgt.score, `a screen wall in front of ${tgt.room}: ${tgt.score} → ${tg2 && tg2.score}`);
    console.log(`PASS a screen wall 1.5 m outside the window of ${tgt.room}: score ${tgt.score} → ${tg2.score} (${tg2.risk}) on the rerun`);
    // ---- another level and back: the colours of this level's windows are kept
    const colsL1 = s.plan.cols, lvs = await p.evaluate(() => __ws2.model().studio.levels.map((l) => l.id)), lv2 = lvs.find((l) => l !== lv1);
    await setLv(lv2); s = await st(); assert.equal(s.lv, lv2); assert.deepEqual(s.plan.cols, colsL1, 'on another level: the same colours for every window');
    await setLv(lv1); s = await st(); assert.deepEqual(s.plan.cols, colsL1); assert(s.sheets.length > 0 && s.sheets.every((x) => x.col === colsL1[x.id]), 'back on the level: the sheets in the same colours');
    // ---- reload: the result is kept with the project
    const keep = s.rec.list.map((x) => [x.id, x.score, x.risk]);
    await boot(); await p.evaluate(() => window.__wsStudy.open('privacy')); await p.waitForTimeout(1500); await setLv(lv1); await p.evaluate(() => window.__wsStudy.open('privacy')); await p.waitForTimeout(1200);
    s = await st(); assert.deepEqual(s.rec.list.map((x) => [x.id, x.score, x.risk]), keep, 'the scores after reopening'); assert.deepEqual(s.plan.cols, colsL1, 'the plan colours after reopening'); assert.deepEqual(s.persp.cols, colsL1, 'the 3D colours after reopening');
    assert(s.sheets.length > 0 && s.sheets.every((x) => x.col === colsL1[x.id]), 'the sheets after reopening');
    console.log(`PASS another level and back, and the project reopened: the same ${Object.keys(colsL1).length} window colours in the plan and in 3D, ${s.sheets.length} sheets`);
    // ---- the overlay off and on, its opacity
    await p.evaluate(() => { const c = document.querySelector('[data-privov=on]'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(600);
    s = await st(); assert(s.plan === null && s.persp === null && s.sheets.length === 0, 'overlay off: nothing on the windows');
    await p.evaluate(() => { const c = document.querySelector('[data-privov=on]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(600);
    await p.evaluate(() => { const r = document.querySelector('[data-privov=op]'); r.value = '0.8'; r.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(600);
    s = await st(); assert(s.sheets.length > 0 && s.plan.opacity === 0.8 && s.sheets.filter((x) => x.id !== s.persp.sel).every((x) => x.opacity === 0.8), 'opacity 0.8 on the sheets: ' + JSON.stringify(s.sheets.slice(0, 2)));
    console.log('PASS the overlay switches off and on; its opacity goes to the sheets (0.8)');
    // ---- another study: no overlay; the glass keeps its materials
    await p.evaluate(() => window.__wsStudy.open('views')); await p.waitForTimeout(1500); s = await st();
    assert(s.plan === null && s.persp === null && s.glass.sheets === 0, 'another study: no window overlay'); assert.deepEqual(s.glass.mats, glass0.mats, 'the glass keeps its own materials');
    console.log(`PASS another study open: no window overlay; the glass keeps its materials (${glass0.mats.join(', ')})`);
    assert.deepEqual(errs, [], 'no page errors');
  } finally { await b.close(); }
})();
