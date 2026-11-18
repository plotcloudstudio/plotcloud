// Wayfinding for signs in the Workspace (2026-11-18), on the hospital example: the starts offered are lift lobbies and stair landings
// (entrances only on the ground floor, never a room's centre); a run from all of them; decision points drawn by sign priority and
// counted; a point selected shows its score, sign, facing, ways and reason, and the views zoom to it; sign panels in 3D; the Room
// Entrance View moves the 3D camera to the door; an existing sign added by two clicks covers its point on the rerun; a route to
// another floor; the timeline walks a route; no page errors.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 960 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], shots = process.env.SHOT_DIR || require('os').tmpdir();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'plan' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    const id = await p.evaluate(async () => (await import('./js/hospital-example.js')).openHospital().id); await p.goto(base + '/mvp/#/workspace/' + id);
    await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    const idle = () => p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 });
    const run = async () => { await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await idle(); await p.waitForTimeout(500); const e = await p.evaluate(() => window.__wsStudy.state().err); assert(!e, 'study error: ' + e); };
    const levels = await p.evaluate(() => __ws2.inst.persp.ws.buildingScene().levels.map((l) => ({ id: l.id, name: l.name, z: l.z })));
    const setLv = async (lid) => { await p.evaluate((x) => { __ws2.inst.persp.ws.setLevel?.(x) ?? __ws2.hub?.setLevel?.(x); }, lid); await p.waitForTimeout(800); };
    await p.evaluate(() => window.__wsStudy.open('wayfinding')); await p.waitForSelector('.sp-studycard'); await p.waitForTimeout(800);
    // the starts on this floor: lifts and stairs; entrances only on the ground floor; never "Room: …"
    const opts = () => p.evaluate(() => [...document.querySelectorAll('.sp-studycard [data-way=start] option')].map((o) => o.textContent));
    let o1 = await opts(); assert(o1.length >= 2, 'starts: ' + o1); assert(o1.some((t) => /Elevator lobby/.test(t)), 'a lift lobby: ' + o1); assert(o1.some((t) => /Stair/.test(t)), 'a stair: ' + o1); assert(!o1.some((t) => /^Room:/.test(t)), 'no room centres');
    const lv0 = await p.evaluate(() => __ws2.inst.persp.ws.level()), ground = levels.slice().sort((a, b) => Math.abs(a.z) - Math.abs(b.z))[0];
    assert.equal(o1.some((t) => /Entrance/.test(t)), lv0 === ground.id, 'entrances only on the ground floor');
    console.log(`PASS starts on ${lv0}: ${o1.join(' · ')}`);
    // run from all of them
    await run(); let r = await p.evaluate(() => { const s = window.__wsStudy.state().res, A = s.wayA; return { rows: s.rows, view: s.view, n: A.nodes.length, high: A.stats.high, rec: A.stats.recommended, routes: A.stats.routes, starts: A.chosen.length, top: A.nodes[0] && { no: A.nodes[0].no, score: A.nodes[0].score, cls: A.nodes[0].cls, type: A.nodes[0].signType, reason: A.nodes[0].reason, ways: A.nodes[0].ways.length } }; });
    assert.equal(r.view, 'signs'); assert(r.routes > 10 && r.n > 0 && r.top && r.top.reason.length > 10, JSON.stringify(r));
    const plain = (h) => String(h).replace(/<[^>]+>/g, ''); assert.match(plain(r.rows.find(([k]) => k === 'Decision points')[1]), /\d+ on the visitor routes/);
    console.log(`PASS run from ${r.starts} starts: ${r.routes} routes, ${r.n} decision points (${r.high} high, ${r.rec} recommended); the top: #${r.top.no} ${r.top.score} ${r.top.cls}, ${r.top.type}: ${r.top.reason}`);
    // the table lists them; selecting one shows its details and zooms
    const rows = await p.locator('.sp-studycard .sp-wftab tbody tr').count(); assert.equal(rows, r.n);
    await p.click('.sp-studycard [data-way-sel="1"]'); await p.waitForTimeout(600);
    const det = await p.locator('.sp-studycard .sp-wfdetail').innerText(); assert.match(det, /Point 1 · (High|Medium|Low) priority · \d+\/100/); assert.match(det, /Orientation/); assert.match(det, /Why:/); assert.match(det, /A · Decision complexity/);
    console.log('PASS point 1 selected: ' + det.split('\n').slice(0, 3).join(' | '));
    // 3D sign panels for the recommended points
    const n3 = await p.evaluate(() => __ws2.inst.persp.ws.signCount?.()); assert.equal(n3, r.rec, 'a 3D sign panel for every recommended point');
    // an existing sign at point 1, facing the people arriving: two clicks on the plan (where, then the way it faces), then run again
    const top = await p.evaluate(() => { const A = window.__wsStudy.state().res.wayA, n = A.nodes[0], o = A.F.SC.origin; const ap = n.approach; return { p: [n.p[0] + o[0], n.p[1] + o[1]], face: ap ? [ap.p[0] + o[0], ap.p[1] + o[1]] : null, score: n.score }; });   // facing the people arriving: towards where the main approach is 5 m before
    const pick = async (pt) => { await p.waitForTimeout(150); return p.evaluate((q) => __ws2.inst.plan.ws._pick(q) || __ws2.inst.persp.ws._pick(q), pt); };
    if (top.face && top.score > 0) {
      await p.evaluate(() => document.querySelector('.sp-studycard [data-way=addsign]').click()); assert(await pick(top.p), 'the first click: where the sign is'); assert(await pick(top.face), 'the second click: the way it faces');
      const sg = await p.evaluate(() => window.__wsStudy.state().waySigns); assert.equal(sg.length, 1, JSON.stringify(sg));
      await run(); const after = await p.evaluate((pt) => { const A = window.__wsStudy.state().res.wayA, o = A.F.SC.origin, n = A.nodes.slice().sort((a, b) => Math.hypot(a.p[0] + o[0] - pt[0], a.p[1] + o[1] - pt[1]) - Math.hypot(b.p[0] + o[0] - pt[0], b.p[1] + o[1] - pt[1]))[0]; return { E: n.factors.E, score: n.score, reason: n.reason }; }, top.p);
      assert.equal(after.E, 1, JSON.stringify(after)); assert.match(after.reason, /Covered by/); console.log(`PASS an existing sign added by two clicks covers point 1 on the rerun: ${top.score} → ${after.score}`);
      await p.evaluate(() => document.querySelector('.sp-studycard [data-way=nosigns]').click()); await run(); }
    console.log(`PASS 3D: ${n3} sign panels`);
    // the Room Entrance View: choose a routed room, the 3D camera goes to its door
    const room = await p.evaluate(() => window.__wsStudy.state().res.wayA.entrances[0]?.room); assert(room, 'a destination entrance');
    await p.selectOption('.sp-studycard [data-way=room]', room); await p.waitForTimeout(400);
    const ent = await p.locator('.sp-studycard').innerText(); assert.match(ent, /Door in sight from/); assert.match(ent, /Similar doors within 8 m/);
    await p.click('.sp-studycard [data-way=entry][data-v=in]'); await p.waitForFunction(() => __ws2.inst.persp.win.S3?.walk?.state().on, null, { timeout: 30000 });
    const cam = await p.evaluate(() => __ws2.inst.persp.win.S3.walk.state()); assert(cam.on && Number.isFinite(cam.x), JSON.stringify(cam));
    console.log(`PASS Room Entrance View of ${room}: eye camera at ${cam.x.toFixed(1)}, ${cam.y.toFixed(1)}`);
    await p.click('.sp-studycard [data-way=entry][data-v=off]'); await p.waitForTimeout(500);
    // the timeline walks a route
    const tl = await p.evaluate(() => { const s = document.querySelector('.sp-studycard [data-tl=seek]'); s.value = '1'; s.dispatchEvent(new Event('input', { bubbles: true })); return document.querySelector('.sp-studycard .sp-tll')?.textContent; });
    await p.waitForTimeout(400); const lab = await p.locator('.sp-studycard .sp-tll').innerText(); assert.match(lab, /→ .* · [\d.]+ m · \d+ decision point/); console.log('PASS the timeline: ' + lab); void tl;
    await p.click('.sp-studycard [data-tl=reset]').catch(() => {});
    // rooms on other floors: routes by a lift or stair
    await p.evaluate(() => { const c = document.querySelector('.sp-studycard [data-way=other]'); if (!c.checked) c.click(); }); await p.waitForTimeout(300); await run();
    const legs = await p.evaluate(() => window.__wsStudy.state().res.wayA.legs.length); assert(legs > 0, 'routes to other floors'); console.log(`PASS rooms on other floors: ${legs} routes by a lift or stair`);
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
