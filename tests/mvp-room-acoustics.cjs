// Indoor acoustics on the plan engines' shell (2026-10-25): it takes every room of the version's level from Plan Studio (with the
// finishes set there), gives each room's reverberation time by band against a target, saves figures, a picture and a field, and
// runs in a Results batch. Opened on its own it runs a sample flat; a finish set in Plan Studio changes the result.
// Run with a static server on 8765 (python3 -m http.server 8765 --bind 127.0.0.1); TEST_BASE overrides it.
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const BASE = process.env.TEST_BASE || 'http://127.0.0.1:8765', B = BASE + '/mvp/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));

  // 1 · on its own: the sample flat, six bands, Sabine ≥ Eyring, the physics pulled out for the validation script
  await p.goto(BASE + '/emb/roomacoustics.html'); await p.waitForFunction(() => window.__psim?.RES, null, { timeout: 20000 });
  const s = await p.evaluate(() => { const R = __psim.RES; return { n: R.rooms.length, six: R.rooms.every((x) => x.T.length === 6 && x.T.every((t) => t > 0.05 && t < 20)),
    sab: R.rooms.every((x) => x.B.every((q) => q.sabine >= q.eyring - 1e-9)), kpis: [...document.querySelectorAll('.kpis > div')].map((d) => d.textContent).join(' | '), rows: document.querySelectorAll('#res tr[data-k]').length, chart: !!document.getElementById('rbars') }; });
  ok(s.n === 7 && s.six, `sample flat: ${s.n} rooms, a reverberation time in each of six bands`);
  ok(s.sab, 'Sabine is never shorter than Eyring');
  ok(s.rows === 7 && s.chart && /Rooms on target/.test(s.kpis), `room table, band chart and figures (${s.kpis})`);
  // 2 · a finish changes the result: an absorbent ceiling everywhere shortens every room
  const tA = await p.evaluate(() => __psim.RES.rooms.map((x) => x.mid));
  await p.evaluate(() => { const sc = JSON.parse(JSON.stringify(__psim.SC)); sc.rooms.forEach((r) => r.surf.forEach((q) => { if (q.kind === 'ceiling') q.mat = 'absorber'; })); sc.name = 'Absorbent ceilings';
    window.postMessage({ pc: 1, t: 'project', scene: JSON.stringify(sc), name: 'Absorbent ceilings' }, '*'); });
  await p.waitForFunction(() => document.getElementById('mName').textContent === 'Absorbent ceilings');
  await p.click('#run'); await p.waitForFunction(() => __psim.RES && !document.getElementById('run').disabled);
  const tB = await p.evaluate(() => __psim.RES.rooms.map((x) => x.mid));
  ok(tB.length === tA.length && tB.every((t, i) => t < tA[i] * 0.6), `absorbent ceilings shorten every room (${tA.map((t) => t.toFixed(2)).join(' ')} → ${tB.map((t) => t.toFixed(2)).join(' ')})`);
  const fix = await p.evaluate(() => { const i = __psim.RES.rooms.findIndex((x) => x.status === 'hi'); return i; });
  // 3 · a target changed by hand is kept and used
  await p.selectOption('#res select[data-grp="1"]', 'A3'); await p.waitForFunction(() => __psim.RES?.rooms[1].grp === 'A3' && !document.getElementById('run').disabled);
  const t3 = await p.evaluate(() => [__psim.RES.rooms[1].tgt, __psim.dinTarget('A3', __psim.RES.rooms[1].r.vol)]);
  ok(Math.abs(t3[0] - t3[1]) < 1e-9, `a room's own target (DIN 18041 A3, ${t3[0].toFixed(2)} s) is used`);

  // 3b · the 3D view: one room, a burst of sound particles that bounce and fade; the room's energy against the formula's decay
  await p.click('#camBar [data-view="3d"]'); await p.waitForFunction(() => window.__psim.v3, null, { timeout: 20000 });
  ok(await p.evaluate(() => !document.getElementById('v3').hidden && !document.getElementById('v3bar').hidden && !!document.querySelector('#v3 canvas')), '3D sound particles opens a 3D view with its controls');
  await p.evaluate(() => __psim.v3.play(false)); await p.selectOption('#v3room', '1');
  const d1 = await p.evaluate(() => { __psim.v3.replay(); const a = __psim.v3.advance(0.3, 1 / 30); return { t: a.t, b: a.bounces, db: a.db }; });
  const d2 = await p.evaluate(() => { const a = __psim.v3.advance(5, 1 / 30); return { t: a.t, b: a.bounces, db: a.db, n: a.curve.length }; });
  ok(d1.b > 0 && d2.b > d1.b && d2.t > d1.t, `the particles bounce (${d2.b.toLocaleString('en')} bounces by ${(d2.t * 1000).toFixed(0)} ms)`);
  ok(d2.db < d1.db && d2.db < -10, `the room's energy falls as they do (${d1.db.toFixed(1)} → ${d2.db.toFixed(1)} dB)`);
  const soft = await p.evaluate(() => { const sc = JSON.parse(JSON.stringify(__psim.SC)); return sc.rooms[1].name; });
  ok(!!soft && await p.evaluate(() => document.getElementById('v3stats').textContent.includes('bounces')), 'the bar says how long after the sound and how many bounces');
  const png = await p.evaluate(() => __psim.v3.canvas().toDataURL('image/png').length); ok(png > 20000, `the 3D view draws (PNG ${Math.round(png / 1024)} kB)`);
  await p.click('#camBar [data-view="plan"]'); ok(await p.evaluate(() => document.getElementById('v3').hidden), 'Plan returns to the plan');

  // 4 · from the Simulations page on a saved version: the level's rooms come in from Plan Studio
  await p.goto(B); await p.evaluate(() => localStorage.clear()); await p.goto(B + '#/'); await p.waitForTimeout(800); await p.reload(); await p.waitForTimeout(800);
  await p.goto(B + '#/simulations/acoustics'); let f = null;
  for (let i = 0; i < 60; i++) { await p.waitForTimeout(500); f = p.frame({ url: /emb\/roomacoustics\.html/ }); if (f && (await f.evaluate(() => document.getElementById('mName')?.textContent || '').catch(() => '')) && !(await f.evaluate(() => document.getElementById('mName').textContent === 'Sample flat').catch(() => true))) break; }
  ok(!!f, 'the Simulations page opens the new engine (emb/roomacoustics.html)');
  const model = await f.evaluate(() => [document.getElementById('mName').textContent, document.getElementById('mInfo').textContent, __psim.SC.rooms.length]);
  ok(model[0] !== 'Sample flat' && model[2] > 0, `the version's rooms came in (${model[0]} · ${model[1]})`);
  const hidden = await f.evaluate(() => getComputedStyle(document.getElementById('h-scene').closest('.sec')).display);
  ok(hidden === 'none', 'its Model section is hidden there (the page header names the model)');
  await f.click('#run'); await f.waitForFunction(() => !document.getElementById('run').disabled && window.__psim.RES, null, { timeout: 60000 });
  const k = await f.evaluate(() => [...document.querySelectorAll('.kpis > div')].map((d) => d.textContent.trim()).join(' | ')); console.log('  ' + k);
  await p.click('#save'); await p.waitForTimeout(1500);
  const run = await p.evaluate(async () => { const S = await import('./js/store.js'); return S.projects()[0].runs.filter((r) => r.simId === 'acoustics').at(-1); });
  ok(run && run.results.kpis.length >= 4 && run.results.thumb && run.results.field?.pts?.length > 30, `Save result keeps figures, a picture and a field (${run?.results.field?.pts?.length / 3 | 0} points, ${run?.results.field?.unit})`);
  ok(Number.isFinite(run?.results.rtmean) && run.results.rtmean > 0, `Results reads Mean T 500–1k = ${run?.results.rtmean} s`);
  await p.screenshot({ path: require('os').tmpdir() + '/room-acoustics.png' });
  await f.click('#camBar [data-view="3d"]'); await f.waitForFunction(() => window.__psim.v3, null, { timeout: 20000 });
  ok(await f.evaluate(() => { const b = document.querySelector('#camBar'); return !!b && getComputedStyle(b).display !== 'none' && !document.getElementById('v3').hidden; }), 'the Plan | 3D switch stays in the view bar on the Simulations page');
  await p.waitForTimeout(1200); await p.screenshot({ path: require('os').tmpdir() + '/room-acoustics-3d.png' });

  // 5 · a Results batch runs it without a hand
  await p.goto(B + '#/results'); await p.waitForTimeout(1500);
  const q = await p.evaluate(async () => { const R = window.__res; if (!R?.batch) return 'no batch hook'; const S = await import('./js/store.js'), pr = S.projects()[0], v = pr.versions.at(-1);
    R.batch.add([{ simId: 'acoustics', projectId: pr.id, versionId: v.id, ov: {} }]); return 'queued'; });
  if (q === 'queued') { let st = []; for (let i = 0; i < 80; i++) { await p.waitForTimeout(1500); st = await p.evaluate(() => window.__res.batch.items().map((x) => x.simId + ':' + x.status + (x.why ? '(' + x.why + ')' : ''))); if (st.length && st.every((x) => /done|fail|error/.test(x))) break; }
    console.log('  ' + st.join(' ')); ok(st.length === 1 && /done/.test(st[0]), 'a Results batch runs Indoor acoustics'); } else ok(false, q);
  if (errs.length) { console.log('page errors:', errs); process.exitCode = 1; }
  await b.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
