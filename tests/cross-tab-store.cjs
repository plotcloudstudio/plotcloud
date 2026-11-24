// Two tabs, one store (2026-11-24). A store small enough for localStorage reaches the other tab through the storage event; a store
// too big for it lives only in IndexedDB, and the other tab hears of each save on a BroadcastChannel and reads IndexedDB again.
// Tab A saves a run; tab B, open on Results, has it and redraws, in both modes.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }), A = await ctx.newPage(), B = await ctx.newPage(), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [];
    for (const t of [A, B]) t.on('pageerror', (e) => errs.push(e.message));
    await A.goto(base + '/mvp/'); await A.waitForFunction(() => document.querySelector('#app h1'));
    const id = await A.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); return (await import('./js/hospital-example.js')).openHospital().id; });
    await B.goto(base + '/mvp/#/results/' + id); await B.waitForFunction(() => document.querySelector('#app h1')); await B.waitForTimeout(1500);
    await B.evaluate(() => { window.__redraws = 0; addEventListener('hashchange', () => window.__redraws++); });
    const addRun = (rid) => A.evaluate(async ([id, rid]) => { const S = await import('./js/store.js'), q = S.project(id), v = q.versions.at(-1); (q.runs ||= []).push({ id: rid, simId: 'sunhours', versionId: v.id, source: 'workspace', created: new Date().toISOString(), results: { kpis: [['Mean', '5 h']] } }); S.save(); }, [id, rid]);
    const hasRun = (rid) => B.evaluate(async ([id, rid]) => { const S = await import('./js/store.js'); return (S.project(id).runs || []).some((r) => r.id === rid); }, [id, rid]);
    // 1 · small store: localStorage copy, the storage event
    await addRun('rQA1'); await B.waitForTimeout(1500);
    assert.equal(await hasRun('rQA1'), true, 'tab B has the run (storage event)'); assert(await B.evaluate(() => window.__redraws) >= 1, 'Results redrew');
    console.log('PASS small store: tab B has the new run and Results redrew (storage event)');
    // 2 · a store too big for localStorage: tab A cannot write the copy, so the store lives only in IndexedDB
    await A.evaluate(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'pc-mvp-v1') { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } return set.call(this, k, v); }; });
    const r0 = await B.evaluate(() => window.__redraws); await addRun('rQA2'); await B.waitForTimeout(2500);
    const mode = await B.evaluate(() => [localStorage.getItem('pc-mvp-store'), !!localStorage.getItem('pc-mvp-v1')]); assert.deepEqual(mode, ['idb', false], 'the store is in IndexedDB only');
    assert.equal(await hasRun('rQA2'), true, 'tab B has the run saved only to IndexedDB (BroadcastChannel)'); assert(await B.evaluate(() => window.__redraws) > r0, 'Results redrew again');
    await addRun('rQA3'); await B.waitForTimeout(2500); assert.equal(await hasRun('rQA3'), true, 'and the next one');
    console.log('PASS store in IndexedDB only: tab B has each new run and Results redrew (BroadcastChannel)');
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
