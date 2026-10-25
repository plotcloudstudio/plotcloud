// Wayfinding, Privacy and Outdoor noise (2026-10-24): each opens from the Simulations page on a saved version, gets that version's
// model, runs, saves its figures, picture and field to the version, and runs in a Results batch.
// Run with a static server on 8765 (python3 -m http.server 8765 --bind 127.0.0.1); TEST_BASE overrides it.
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const B = (process.env.TEST_BASE || 'http://127.0.0.1:8765') + '/mvp/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(B); await p.evaluate(() => localStorage.clear()); await p.goto(B + '#/'); await p.waitForTimeout(800); await p.reload(); await p.waitForTimeout(800);
  await p.goto(B + '#/simulations'); await p.waitForFunction(() => document.querySelector('#grid [data-sim="noise"]'), null, { timeout: 15000 }).catch(() => {});
  const names = await p.evaluate(() => [...document.querySelectorAll('a[href^="#/simulations/"]')].map((a) => a.getAttribute('href')));
  for (const id of ['wayfinding', 'privacy', 'noise']) ok(names.includes('#/simulations/' + id), `Simulations page lists ${id}`);
  const fr = () => p.frame({ url: /emb\/(wayfinding|privacy|noise)\.html/ });
  for (const [id, sample, kpi] of [['wayfinding', 'Sample flat', /Decision points/], ['privacy', 'Sample flat', /Floor seen from outside/], ['noise', 'Sample block', /Loudest façade/]]) {
    await p.goto(B + '#/simulations/' + id); let f = null;
    for (let i = 0; i < 60; i++) { await p.waitForTimeout(500); f = fr(); if (f && (await f.evaluate(() => document.getElementById('mName')?.textContent || '').catch(() => '')) && !(await f.evaluate((s) => document.getElementById('mName').textContent === s, sample).catch(() => true))) break; }
    const model = await f.evaluate(() => [document.getElementById('mName').textContent, document.getElementById('mInfo').textContent]);
    ok(model[0] !== sample, `${id}: the version's model came in (${model.join(' · ')})`);
    await f.click('#run'); await f.waitForFunction(() => !document.getElementById('run').disabled && window.__psim.RES, null, { timeout: 120000 });
    const k = await f.evaluate(() => [...document.querySelectorAll('.kpis > div')].map((d) => d.textContent.trim()).join(' | '));
    console.log('  ' + k); ok(kpi.test(k) && /\d/.test(k), `${id}: figures after the run`);
    const before = await p.evaluate((id) => JSON.parse(localStorage.getItem('pc-mvp-v1')).projects[0].runs.filter((r) => r.simId === id).length, id);
    await p.click('#save'); await p.waitForTimeout(1500);
    const run = await p.evaluate((id) => JSON.parse(localStorage.getItem('pc-mvp-v1')).projects[0].runs.filter((r) => r.simId === id).at(-1), id);
    const n = await p.evaluate((id) => JSON.parse(localStorage.getItem('pc-mvp-v1')).projects[0].runs.filter((r) => r.simId === id).length, id);
    ok(n === before + 1, `${id}: Save result keeps a run on the version`);
    ok(run && run.results.kpis.length >= 4 && run.results.thumb && run.results.field?.pts?.length > 30, `${id}: the run has figures, a picture and a field (${run?.results.field?.pts?.length / 3 | 0} points, ${run?.results.field?.unit})`);
    const metric = { wayfinding: 'signs', privacy: 'seen', noise: 'loud' }[id]; ok(Number.isFinite(run?.results[metric]), `${id}: Results reads its metric ${metric} = ${run?.results[metric]}`);
    await p.screenshot({ path: require('os').tmpdir() + `/newsim-${id}.png` });
  }
  // batch: the three run in Results without a hand
  await p.goto(B + '#/results'); await p.waitForTimeout(1500);
  const can = await p.evaluate(() => ['wayfinding', 'privacy', 'noise'].map((id) => !!document.querySelector(`[data-bsel="${id}"], input[value="${id}"], [data-sim="${id}"]`)));
  console.log('  batch rows found:', can.join(','));
  const res = await p.evaluate(async () => { const R = window.__res; if (!R?.batch) return 'no batch hook';
    const S = await import('./js/store.js'), pr = S.projects()[0], v = pr.versions.at(-1);
    R.batch.add(['wayfinding', 'privacy', 'noise'].map((id) => ({ simId: id, projectId: pr.id, versionId: v.id, ov: {} })));
    return 'queued'; });
  console.log('  ' + res);
  if (res === 'queued') { let st = []; for (let i = 0; i < 160; i++) { await p.waitForTimeout(1500); st = await p.evaluate(() => window.__res.batch.items().map((x) => x.simId + ':' + x.status + (x.why ? '(' + x.why + ')' : ''))); if (st.length && st.every((x) => /done|failed/.test(x))) break; }
    console.log('  ' + st.join(' ')); ok(st.length === 3 && st.every((x) => /done/.test(x)), 'Results batch runs Wayfinding, Privacy and Outdoor noise'); }
  if (errs.length) { console.log('page errors:', errs); process.exitCode = 1; }
  await b.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
