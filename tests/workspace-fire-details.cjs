// Fire evacuation details on the hospital example (2026-11-10): stairs and outside doors drawn and labelled on the result sheets
// (STAIR, EXIT, smoke doors; a door found blocked crossed out), purple routes shaded by when each person got out (lighter: out
// sooner), a fire room chosen by clicking a room in the view, and the incidents of the run (falls, children with a parent,
// a blocked exit) in the results. Needs network access (the project weather).
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || require('os').tmpdir();
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    await p.goto(base + '/mvp/#/home'); await p.waitForSelector('[data-hospital]', { timeout: 30000 });
    await p.click('.ph-thumb[data-hospital]'); await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(2500);
    const fr = (k) => p.frames().find((f) => f.url().includes('ws=' + k));
    await p.evaluate(() => window.__wsStudy.open('fire-evacuation')); await p.waitForTimeout(1500);
    // 1 · everyone out, random fire: marks, timed routes, incidents; the people on each floor by group (2026-11-10)
    await p.selectOption('.sp-studycard [data-eg=use]', 'retail'); await p.waitForTimeout(500);
    const pop = await p.$$eval('.sp-studycard .sp-egpop tbody tr', (rs) => rs.map((r) => [r.cells[0].textContent, ...[...r.querySelectorAll('input')].map((i) => +i.value)]));
    assert(pop.length >= 3 && pop.some((r) => r[3] > 0) && pop.some((r) => r[2] > 0), 'groups by floor, with older adults and children: ' + JSON.stringify(pop));
    await p.fill('.sp-studycard [data-egc="L2:wheel"]', '3'); await p.dispatchEvent('.sp-studycard [data-egc="L2:wheel"]', 'change'); await p.fill('.sp-studycard [data-egc="L3:child"]', '12'); await p.dispatchEvent('.sp-studycard [data-egc="L3:child"]', 'change'); await p.waitForTimeout(400);
    assert.equal(await p.inputValue('.sp-studycard [data-egc="L2:wheel"]'), '3'); assert(await p.locator('.sp-studycard [data-eg=popreset]').count(), 'a way back to the building use');
    await p.selectOption('.sp-studycard [data-eg=runs]', '20');
    await p.click('.sp-studycard [data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 420000 });
    let r = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, rows: s.res?.rows, method: s.res?.method, csv: [].concat(s.res?.csv?.() || []).join("\n") }; });
    assert.equal(r.err, ''); const row = (k) => (r.rows.find((x) => x[0] === k) || [])[1];
    assert.match(row('Incidents in the run shown') || '', /falls?[\s\S]*children walking with a parent/); assert.match(row('Runs with an exit found blocked') || '', /^\d+ of 20$/);
    assert.match(r.method, /trip and stay down/); assert.match(r.method, /lighter for the people out sooner/); assert.match(r.csv, /children with an adult/); assert.match(r.csv, /wheelchair users/);
    const grp = (k) => (r.rows.find((x) => x[0].startsWith(k)) || [])[0] || ''; assert.match(grp('Wheelchair users'), /\((\d+)\)/); assert(+grp('Wheelchair users').match(/\((\d+)\)/)[1] >= 3, grp('Wheelchair users')); assert.match((r.rows.find((x) => x[0].startsWith('Wheelchair users')) || [])[1], /waited .* at the stair/);
    assert.match(grp('Children'), /Children \(\d+\)/); assert.match(grp('Older adults'), /Older adults/);
    const svg = await p.locator('.sp-studycard svg.sp-hist').innerHTML(); for (const c of ['#eab308', '#0891b2', '#16a34a', '#a16207']) assert(svg.includes(c), 'a line for ' + c); assert.match(await p.locator('.sp-studycard .sp-eglegend').innerText(), /Alerted[\s\S]*Children[\s\S]*Wheelchair/);
    const st0 = await fr('persp').evaluate(() => { window.__ws.egressPlay(false); window.__ws.egressSeek(0); return window.__ws.egressState().now; }); assert(st0.unaware > 50, 'grey before the alarm: ' + JSON.stringify(st0));
    const st1 = await fr('persp').evaluate(() => { window.__ws.egressSeek(75); return window.__ws.egressState().now; }); assert(st1.alerted > 20, 'yellow once alerted: ' + JSON.stringify(st1));
    console.log('PASS groups by floor, their lines in the chart, grey then yellow:', JSON.stringify(st0), JSON.stringify(st1));
    let st = await fr('persp').evaluate(() => window.__ws.egressState()); assert(st.timed, 'routes shaded by time'); const mk = st.marks.filter((m) => m && (m.stairs || m.doors.length));
    assert(mk.length >= 3 && mk.every((m) => m.stairs >= 2), 'two stairs drawn on every floor: ' + JSON.stringify(st.marks)); assert(mk.some((m) => m.doors.includes('exit')), 'the outside doors drawn'); assert(mk.some((m) => m.doors.includes('smoke')), 'the smoke doors drawn');
    const legend = await p.locator('.sp-legend').innerText(); assert.match(legend, /Out last[\s\S]*Out first/);
    await p.screenshot({ path: `${out}/fire-details-all.png` });
    console.log('PASS everyone out:', ['Everyone out (RSET), median of runs', 'Incidents in the run shown', 'Runs with an exit found blocked'].map((k) => `${k}: ${row(k)}`).join(' · '), '· marks', JSON.stringify(st.marks));
    // 2 · the fire room, clicked in the plan
    await p.click('[data-sp=dim]').catch(() => {}); await p.waitForTimeout(1500);
    await p.evaluate(() => __ws2.inst.plan.ws.level('L2')); await p.waitForTimeout(800);
    const pt = await p.evaluate(() => { const ws = __ws2.inst.plan.ws, sc = ws.planScene('wayfinding'), rm = sc.rooms.find((x) => /^Patient room/i.test(x.name)), [x0, y0, w, h] = rm.rects[0]; return { name: rm.name, x: sc.origin[0] + x0 + w / 2, y: sc.origin[1] + y0 + h / 2 }; });
    await p.click('.sp-studycard [data-eg=pick]'); assert.match(await p.locator('.sp-studycard [data-eg=pick]').innerText(), /Click a room in the view/);
    const scr = await fr('plan').evaluate(([x, y]) => window.__ws.toScreen ? window.__ws.toScreen([x, y]) : null, [pt.x, pt.y]);
    const box = await p.locator('iframe[src*="ws=plan"]').boundingBox(); await p.mouse.click(box.x + scr[0], box.y + scr[1]);
    await p.waitForTimeout(800); const picked = await p.locator('.sp-studycard [data-eg=pick]').innerText();
    assert.match(picked, /Patient room[\s\S]*Inpatient unit 2/, 'the chosen room on the chip');
    await p.click('.sp-studycard [data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 420000 });
    r = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, settings: s.res?.settings }; }); assert.equal(r.err, ''); assert.equal(r.settings.fire, picked.trim());
    console.log('PASS the fire room chosen in the plan:', picked.trim());
    // 3 · hospital mode: marks and timed routes too, the fire room kept
    await p.click('.sp-studycard [data-st-mode=down]'); await p.selectOption('.sp-studycard [data-eg=runs]', '10');
    await p.click('.sp-studycard [data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 420000 });
    r = await p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, rows: s.res?.rows }; }); assert.equal(r.err, '');
    assert.match((r.rows.find((x) => x[0] === 'Fire starts') || [])[1], new RegExp('in ' + picked.trim().replace(/[()]/g, '.'))); assert.match((r.rows.find((x) => x[0] === 'Incidents in the run shown') || [])[1], /patient falls · \d+ staff held up/);
    await p.click('[data-sp=dim]').catch(() => {}); await p.waitForTimeout(1200);
    st = await fr('persp').evaluate(() => window.__ws.egressState()); assert(st.timed && st.marks.some((m) => m && m.stairs >= 2));
    await p.screenshot({ path: `${out}/fire-details-hospital.png` });
    console.log('PASS hospital mode:', r.rows.slice(0, 3).map((x) => x.join(' ')).join(' · '));
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
