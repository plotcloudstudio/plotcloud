// A semi-trailer backed up to the goods door, planned in the background (2026-11-26), hospital example at 1440×900:
// the route search runs in a Web Worker (window.__routeWorker counts it), the card says how far it has got, and the page keeps
// answering while it searches (a 50 ms timer on the page is never more than 250 ms late); the semi-trailer gets a result — backed up,
// its trailer turning as it reverses, or a reason about the room — never "not reversed"; Stop in the run bar ends a search with no
// error, and Stop in Try every vehicle ends that too; no page errors.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], out = process.env.SHOT_DIR || '/tmp';
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'persp' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    const id = await p.evaluate(async () => (await import('./js/hospital-example.js')).openHospital().id); await p.goto(base + '/mvp/#/workspace/' + id);
    await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    const idle = () => p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy; }, null, { timeout: 900000 });
    const rows = () => p.evaluate(() => Object.fromEntries(window.__wsStudy.state().res.rows.map(([k, v]) => [k, String(v).replace(/<[^>]+>/g, '')])));
    await p.evaluate(() => window.__wsStudy.open('vehicle-swept-path')); await p.waitForSelector('.sp-studycard [data-va-task]'); await p.waitForTimeout(600);
    await p.selectOption('.sp-studycard [data-va=veh]', 'semi'); await p.selectOption('.sp-studycard [data-va=stop]', 'back'); await p.waitForTimeout(300);
    const note = await p.locator('.sp-studycard').innerText(); assert(!/not reversed in this version/.test(note), 'the card no longer says articulated vehicles are not reversed'); assert(/semi-trailer backs up/i.test(note), 'the card says how a semi-trailer backs up');
    // 1 · the search in the background: progress, a page that keeps answering
    await p.evaluate(() => { const M = (window.__lag = { max: 0, seen: [], n: 0 }); let t = performance.now();
      M.id = setInterval(() => { const now = performance.now(), late = now - t - 50, pr = window.__wsStudy.state().progress || ''; t = now; if (/positions tried/.test(pr)) { M.n++; M.max = Math.max(M.max, late); if (M.seen.at(-1) !== pr) M.seen.push(pr); } }, 50); });
    const w0 = await p.evaluate(() => (window.__routeWorker || { runs: 0 }).runs);
    await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await idle(); await p.waitForTimeout(500);
    const lag = await p.evaluate(() => { clearInterval(window.__lag.id); return { ...window.__lag, w: window.__routeWorker }; });
    assert(lag.w && lag.w.runs > w0 && lag.w.fallback === 0, 'planned in the worker: ' + JSON.stringify(lag.w));
    assert(lag.n >= 3 && lag.seen.length >= 1, 'progress shown while searching: ' + JSON.stringify(lag.seen.slice(0, 3)));
    assert(lag.max < 250, `the page kept answering while the route was searched: a 50 ms timer at most ${Math.round(lag.max)} ms late`);
    const st = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, res: !!s.res }; });
    let said;
    if (st.res) { const R = await rows(); assert.match(R['Found route'], /^backed up from .* to door/, R['Found route']); assert.match(R['Moves'] || '', /changes? of direction\), [\d.]+ m reversing/, 'moves: ' + R['Moves']);
      const tr = await p.evaluate(() => { const r = window.__wsStudy.state().res.saRuns[0], B = r.poses.filter((q) => q.dir < 0), a = B.map((q) => Math.atan2(Math.sin(q.th - q.phi), Math.cos(q.th - q.phi)) * 180 / Math.PI); return { n: B.length, lo: Math.min(...a), hi: Math.max(...a), end: r.poses.at(-1).dir }; });
      assert(tr.n > 10 && tr.end < 0 && tr.hi - tr.lo > 5, 'the trailer turns as the semi reverses: ' + JSON.stringify(tr)); assert(Math.max(Math.abs(tr.lo), Math.abs(tr.hi)) <= 42.5, 'within 0.6 × the articulation limit: ' + JSON.stringify(tr));
      said = `backed up: ${R['Found route'].slice(0, 70)}…; ${R['Moves']}; ${R['Status']}; trailer between ${tr.lo.toFixed(0)}° and ${tr.hi.toFixed(0)}°`; await p.screenshot({ path: out + '/vehicle-semi-backin.png' }); }
    else { assert(st.err && !/not reversed/.test(st.err) && /in front of the door there are [\d.]+ m to .*, for a vehicle [\d.]+ m long/.test(st.err), 'a reason about the room: ' + st.err); said = 'no route, and why: …' + st.err.slice(-110); }
    console.log(`PASS the semi-trailer backing up, planned in the worker (${lag.w.runs} run${lag.w.runs > 1 ? 's' : ''}, last ${lag.w.lastMs} ms), progress "${lag.seen.at(-1)}", the page at most ${Math.round(lag.max)} ms late: ${said}`);
    // 2 · Stop in the run bar ends the search
    const w1 = await p.evaluate(() => window.__routeWorker.runs);
    await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click());
    await p.waitForFunction(() => /positions tried/.test(window.__wsStudy.state().progress || ''), null, { timeout: 120000 });
    await p.evaluate(() => document.querySelector('[data-run=stop]').click()); const tStop = Date.now(); await idle(); const stopMs = Date.now() - tStop;
    const s2 = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, res: !!s.res, runs: window.__routeWorker.runs }; });
    assert(!s2.err && !s2.res && s2.runs === w1 && stopMs < 5000, 'Stop ended the search with no error: ' + JSON.stringify({ ...s2, stopMs }));
    console.log(`PASS Stop in the run bar ended the search in ${stopMs} ms, no error, no result`);
    // 3 · Stop in Try every vehicle (shown with a result: the box truck backed up first)
    await p.selectOption('.sp-studycard [data-va=veh]', 'box'); await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await idle(); await p.waitForTimeout(500);
    assert(await p.evaluate(() => !!window.__wsStudy.state().res), 'the box truck backs up: ' + await p.evaluate(() => window.__wsStudy.state().err));
    await p.click('.sp-studycard [data-va=tryall]'); await p.waitForFunction(() => document.querySelector('.sp-studycard [data-va=tryallstop]'), null, { timeout: 60000 });
    await p.waitForTimeout(1500); await p.click('.sp-studycard [data-va=tryallstop]');
    await p.waitForFunction(() => document.querySelector('.sp-studycard [data-va=tryallcsv]'), null, { timeout: 120000 });
    const tx = await p.locator('.sp-studycard').innerText(); assert.match(tx, /Stopped after \d+ of \d+/, 'Try every vehicle says it stopped');
    console.log(`PASS Stop in Try every vehicle: "${/Stopped after [^.]*/.exec(tx)[0]}"`);
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
