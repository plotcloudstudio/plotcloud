// Escape routes made clear (2026-11-10), Everyone out on the hospital example:
// · the routes from each starting room run down the stairs and out of the door to an assembly point outside: main routes solid with
//   chevrons, alternatives dashed, the outside leg green to an assembly point symbol; stair hops marked
// · the fire origin as a flame and a cross-hatched room, an assumed smoke zone stippled, a blocked exit crossed out
// · queues as numbered badges during playback; route cards with people, distance, estimated time, narrowest point, queues, smoke and
//   the alternative; the times labelled as estimates; the assumptions summarised
// · scenarios compared side by side (as set, smoke spreading, the main exit blocked) and the one shown switched
// · groups who need other help (hard of hearing, low vision, cognitive), set per floor
const { chromium } = require('playwright'), assert = require('node:assert/strict'), os = require('node:os');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || os.tmpdir();
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    await p.goto(base + '/mvp/#/home'); await p.waitForSelector('[data-hospital]'); await p.click('.ph-thumb[data-hospital]');
    await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(2500);
    await p.evaluate(() => window.__wsStudy.open('fire-evacuation')); await p.waitForTimeout(1500);
    const fr3 = () => p.frames().find((f) => f.url().includes('ws=persp'));
    const run = async () => { await p.click('.sp-studycard [data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 600000 }); return p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, view: s.res?.view, rows: (s.res?.rows || []).map(([k, v]) => [k.replace(/<[^>]+>/g, ''), String(v).replace(/<[^>]+>/g, '')]) }; }); };
    // the groups who need other kinds of help, as rows of the people table
    const groups = await p.$$eval('.sp-studycard .sp-egpop2 tbody tr td:first-child', (tds) => tds.map((t) => t.textContent.trim()));
    for (const g of ['Hard of hearing', 'Low vision', 'Cognitive']) assert(groups.some((x) => x.includes(g)), 'a row for ' + g + ': ' + groups);
    // the scenario: smoke from 4 min, a comparison with the main exit blocked and with smoke
    await p.selectOption('.sp-studycard [data-eg=runs]', '10'); await p.fill('.sp-studycard [data-eg=smoke]', '4'); await p.dispatchEvent('.sp-studycard [data-eg=smoke]', 'change');
    await p.check('.sp-studycard [data-eg=cmpblock]'); await p.check('.sp-studycard [data-eg=cmpsmoke]');
    let r = await run(); assert.equal(r.err, ''); assert.equal(r.view, 'routes', 'the escape routes first');
    assert.match(r.rows[0][1], /\(estimate\)/); const as = r.rows.find((x) => x[0] === 'Scenario and assumptions'); assert(as && /smoke: assumed in the fire compartment from 4\.0 min/.test(as[1]) && /assembly points 15 m/.test(as[1]), JSON.stringify(as));
    const sm = r.rows.find((x) => x[0] === 'In the assumed smoke zone'); assert(sm, 'people in the smoke zone counted');
    const card = await p.locator('.sp-studycard').innerText();
    assert.match(card, /Scenarios compared[\s\S]*As set[\s\S]*No smoke[\s\S]*Main exit blocked/); assert.match(card, /Routes \(run shown\)[\s\S]*people from[\s\S]*then 15 m to the assembly point[\s\S]*Estimated: out by[\s\S]*Narrowest point[\s\S]*Alternative:/);
    assert.match(card, /Times are estimates from the model's run shown, not predictions; the smoke zone is an assumption/);
    for (const k of ['Main route', 'Alternative', 'To the assembly point', 'Fire origin', 'Smoke zone (assumed)', 'Exit blocked', 'Queue (playback)']) assert(card.includes(k), 'legend: ' + k);
    const st = await fr3().evaluate(() => window.__ws.egressState());
    assert(st.routes.some((x) => x.prim > 5) && st.routes.some((x) => x.alt > 0) && st.routes.some((x) => x.out > 0) && st.routes.some((x) => x.hop > 0), 'main routes, alternatives, outside legs and stair hops: ' + JSON.stringify(st.routes));
    assert(st.zones.some((z) => z && z.fire) && st.zones.some((z) => z && z.smoke), 'the fire room and the smoke zone: ' + JSON.stringify(st.zones));
    await p.screenshot({ path: `${out}/routes-3d.png` });
    // queues during playback: find a moment with a queue
    const qmax = await fr3().evaluate(() => { let best = [0, 0]; const s0 = window.__ws.egressState(); for (let t = 0; t < s0.n; t += 3) { window.__ws.egressSeek(t); const q = window.__ws.egressState().queuesNow; const n = q.reduce((a, x) => Math.max(a, x[3]), 0); if (n > best[1]) best = [t, n]; } window.__ws.egressSeek(best[0]); window.__ws.egressPlay(false); return best; });
    assert(qmax[1] >= 2, 'a queue of 2 or more at some moment: ' + qmax); await p.waitForTimeout(500); await p.screenshot({ path: `${out}/routes-queue.png` });
    console.log('PASS routes, zones and queues:', JSON.stringify(st.routes), 'queue', qmax[1], 'at', qmax[0], 's ·', sm[1]);
    // the scenario shown, switched: the main exit blocked
    await p.click('.sp-studycard [data-eg=scen][data-v="2"]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && s.res && /Main exit blocked/.test(document.querySelector('.sp-studycard')?.innerText || ''); }, null, { timeout: 300000 }); await p.waitForTimeout(800);
    const shown = await p.locator('.sp-studycard').innerText(); assert.match(shown, /Showing: Main exit blocked/); const st2 = await fr3().evaluate(() => window.__ws.egressState()); assert(st2.marks.some((m) => m && m.doors.includes('blocked')), 'the blocked exit crossed out');
    console.log('PASS scenarios: the main exit blocked shown');
    // 2D: the plan of level 2 with its routes
    await p.click('[data-sp=dim]'); await p.waitForTimeout(800); await p.evaluate(() => __ws2.inst.plan.ws.level('L2')); await p.waitForTimeout(1200); await p.screenshot({ path: `${out}/routes-2d.png` });
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
