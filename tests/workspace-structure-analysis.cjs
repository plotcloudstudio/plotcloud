// The structure study's frame analysis in the Workspace (2026-11-18), on the hospital and Fallingwater examples: the laid-out
// structure analysed as a 3D frame; the result list (M, N, V, T, displacement, stresses, capacity, system) drawn as tubes coloured
// on the structure ramp, with force flags and the deformed shape (counted through the modeler's API, not pixels); the legend's
// unit and range; the deformation slider changes the drawn scale; ▶ Play raises the load; the load case changes the colours;
// a brace previewed on hover in 3D and added on click (the analysis runs again, the drift drops); a click on a member reads its
// values; the sway idea's "Try it"; the card's sections; the CSV's new columns; no page errors.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 960 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], shots = process.env.SHOT_DIR || require('os').tmpdir();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'persp' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    const idle = () => p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 180000 });
    const run = async () => { await p.evaluate(() => window.__wsStudy.run()); await idle(); await p.waitForTimeout(400); const e = await p.evaluate(() => window.__wsStudy.state().err); assert(!e, 'study error: ' + e); };
    const st = () => p.evaluate(() => { const r = window.__wsStudy.state().res; return { view: r.view, unit: r.unit, lo: r.lo, hi: r.hi, title: r.title, results: r.results, rows: r.rows, frame: r.frame, drift: r.frameA && r.frameA.drift, counts: r.frameA && r.frameA.counts }; });
    const parts = () => p.evaluate(() => __ws2.inst.persp.ws.structFrameState());
    const view = async (k) => { await p.click(`.sp-studycard [data-st-view="${k}"]`); await p.waitForTimeout(300); };
    const open = async (mod, fn) => { const id = await p.evaluate(async ([m, f]) => (await import(m))[f]().id, [mod, fn]); await p.goto(base + '/mvp/#/workspace/' + id);
      await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
      await p.evaluate(() => window.__wsStudy.open('structure')); await p.waitForSelector('.sp-studycard'); };
    const shot = async (name) => { try { await p.screenshot({ path: shots + '/' + name, timeout: 120000 }); } catch (e) { console.log('(screenshot skipped: ' + e.message.split('\n')[0] + ')'); } };

    // ---- the hospital: a concrete flat plate on a column grid, analysed as a frame
    await open('./js/hospital-example.js', 'openHospital');
    await run(); let r = await st();
    assert(r.frame, 'the frame analysis ran'); assert.equal(r.view, 'M', 'the moment is shown first'); assert(r.counts.columns > 30 && r.counts.beams > 30, JSON.stringify(r.counts));
    const row = (k) => ((r.rows.find(([a]) => a === k) || [])[1] || '').replace(/<[^>]+>/g, '');
    assert.match(row('Frame analysis'), /\d+ members, [\d,]+ nodes · equilibrium ✓/); assert.match(row('Largest bending moment'), /[\d,]+ kN·m/); assert.match(row('Wind sway, worst storey'), /h\/[\d,]+ on/);
    assert.equal(r.unit, 'kN·m'); assert(r.hi > 0 && r.lo === 0);
    let fp = await parts(); assert(fp && fp.parts['sf-tubes'] === 1 && fp.parts['sf-flags'] === 1 && fp.parts['sf-deformed'] === 1 && fp.parts['sf-support'] > 10, JSON.stringify(fp));
    assert(fp.model === true, 'the model is shown');
    const leg = await p.locator('.sp-legend').innerText(); assert.match(leg, /kN·m/); assert.match(leg, /Deformation ×[\d,]+/);
    console.log(`PASS hospital frame: ${r.counts.columns} columns, ${r.counts.beams} slab strips, ${fp.tris} tube triangles, moment flags and the deformed shape; ${row('Wind sway, worst storey')}`);
    // every result in the list draws
    for (const [k, unit, flags] of [['N', /compression/, 1], ['V', /kN/, 1], ['T', /kN·m/, 1], ['disp', /mm/, 0], ['sigma', /MPa/, 0], ['vm', /MPa/, 0], ['util', /capacity/, 0], ['sys', /members/, 0]]) {
      await view(k); r = await st(); fp = await parts(); assert.equal(r.view, k); assert.match(r.unit, unit, k); assert.equal(fp.parts['sf-tubes'], 1, k); assert.equal(!!fp.parts['sf-flags'], !!flags, k + ' flags'); }
    await view('sys'); assert.match(await p.locator('.sp-legend').innerText(), /Braces[\s\S]*Columns/);
    console.log('PASS every result draws: N (− compression · + tension), V, T with flags; displacement, normal stress, von Mises, capacity used, system and supports');
    // the deformation slider: a larger scale moves the deformed lines further
    await view('disp');
    const scaleOf = () => p.evaluate(() => { const v = document.querySelector('.sp-legend [data-sf=scale]'); return v ? +v.value : null; });
    const a0 = await scaleOf(); assert(a0 >= 1);
    const box = await p.locator('.sp-legend [data-sf=scale]').boundingBox(); await p.mouse.click(box.x + box.width * 0.9, box.y + box.height / 2); await p.waitForTimeout(400);
    const a1 = await scaleOf(); assert(a1 > a0, `the slider moved: ${a0} → ${a1}`); await p.waitForFunction((v) => __ws2.inst.persp.ws.structFrameState()?.deform === v, a1, { timeout: 20000 }).catch(() => {}); assert.equal((await parts()).deform, a1, 'the drawn scale follows the slider'); assert.equal(await p.evaluate(() => window.__wsStudy.state().stScale), a1, 'the scale is kept');
    assert.match(await p.locator('.sp-legend .sp-lbdefv').innerText(), new RegExp('×' + a1.toLocaleString('en')));
    await p.click('.sp-legend [data-sf=scaleauto]'); await p.waitForTimeout(300); assert.equal(await p.evaluate(() => window.__wsStudy.state().stScale), 'auto');
    console.log(`PASS the deformation slider: ×${a0} (auto) → ×${a1}, then Auto again`);
    // ▶ Play: the load rises in steps
    await view('M');
    await p.click('.sp-studycard [data-tl=seek]', { position: { x: 30, y: 5 } }).catch(() => {});
    await p.evaluate(() => { const s = document.querySelector('.sp-studycard [data-tl=seek]'); s.value = 10; s.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(300);
    assert.match(await p.locator('.sp-studycard .sp-tll').innerText(), /Load 50 %/);
    await p.click('.sp-studycard [data-tl=play]'); await p.waitForTimeout(1200); const lab = await p.locator('.sp-studycard .sp-tll').innerText(); assert.match(lab, /Load \d+ %/); await p.click('.sp-studycard [data-tl=play]');
    await p.click('.sp-studycard [data-tl=reset]'); await p.waitForTimeout(300);
    console.log('PASS ▶ Play: ' + lab);
    // the load case: wind changes the moment's colours and title
    const t0 = (await st()).title; await p.click('.sp-studycard [data-sf=case][data-v=wind]'); await p.waitForTimeout(300); r = await st(); assert.notEqual(r.title, t0); assert.match(r.title, /W/);
    await p.click('.sp-studycard [data-sf=case][data-v=""]'); await p.waitForTimeout(300);
    console.log('PASS the load case: ' + r.title);
    // "Show the model" off hides the building
    await p.click('.sp-studycard [data-sf=model]'); await p.waitForTimeout(300); assert.equal((await parts()).model, false); await p.click('.sp-studycard [data-sf=model]'); await p.waitForTimeout(300); assert.equal((await parts()).model, true);
    // a click on a member reads its values
    const hit = await p.evaluate(() => { const w = __ws2.inst.persp.win, fr = w.frameElement.getBoundingClientRect(); for (let y = 0.3; y < 0.8; y += 0.02) for (let x = 0.3; x < 0.7; x += 0.02) { const cx = fr.width * x, cy = fr.height * y; const i = w.S3.structFramePick(cx, cy, 'member'); if (i != null) return { x: fr.left + cx, y: fr.top + cy, i }; } return null; });
    assert(hit, 'a member under the pointer somewhere'); await p.mouse.click(hit.x, hit.y); await p.waitForTimeout(600);
    const pick = await p.locator('.sp-studycard .sp-sfpick').innerText(); assert.match(pick, /Section[\s\S]*Axial N[\s\S]*Moment M[\s\S]*Capacity used/);
    console.log('PASS a member clicked: ' + pick.split('\n')[0]);
    // the card's sections, as in the reference
    const card = await p.locator('.sp-studycard').innerText();
    for (const s of ['Members and calculation status', 'Member forces and deformation', 'Loads and parameters', 'Assumptions', 'Foundation and joint checks', 'Capacity, stability and strengthening', 'Add a member by hand']) assert(card.includes(s), 'section ' + s);
    await shot('structure-frame-hospital-moment.png');

    // ---- a brace by hand: hover previews, click adds, and the analysis runs again
    const drift0 = (await st()).drift.hOver;
    if (!(await p.evaluate(() => document.querySelector('.sp-studycard details[data-adv=sf-hand]').open))) await p.click('.sp-studycard details[data-adv=sf-hand] > summary');
    await p.click('.sp-studycard [data-sf=brace]'); await p.waitForTimeout(500);
    const bay = await p.evaluate(() => { const w = __ws2.inst.persp.win, fr = w.frameElement.getBoundingClientRect(); for (let y = 0.2; y < 0.85; y += 0.015) for (let x = 0.15; x < 0.85; x += 0.015) { const cx = fr.width * x, cy = fr.height * y; const i = w.S3.structFramePick(cx, cy, 'bay'); if (i != null) return { x: fr.left + cx, y: fr.top + cy, i }; } return null; });
    assert(bay, 'a bay under the pointer somewhere'); await p.mouse.move(bay.x, bay.y); await p.waitForTimeout(300);
    assert.equal((await parts()).preview, 1, 'the dashed preview diagonal');
    await p.mouse.click(bay.x, bay.y); await idle(); await p.waitForTimeout(500); r = await st();
    assert.equal(r.counts.braces, 1, 'one diagonal'); assert.match(await p.locator('.sp-studycard').innerText(), /Brace added: a single diagonal/);
    console.log(`PASS a brace previewed and added by click; the analysis ran again (drift h/${drift0} → h/${r.drift.hOver})`);
    // the sway idea: X braces in the bays that sway most
    const hasIdea = await p.locator('.sp-studycard [data-sf=sway]').count();
    if (hasIdea) { await p.click('.sp-studycard [data-sf=sway]'); await idle(); await p.waitForTimeout(400); const r2 = await st(); assert(r2.counts.braces > r.counts.braces); assert(r2.drift.hOver > r.drift.hOver, `the drift drops: h/${r.drift.hOver} → h/${r2.drift.hOver}`); console.log(`PASS the sway idea tried: ${r2.counts.braces} brace members, drift h/${r.drift.hOver} → h/${r2.drift.hOver}`); r = r2; }
    else console.log('(no sway idea: the drift is already within h/400)');
    await view('N'); await shot('structure-frame-hospital-braced-axial.png');
    // the CSV
    const csv = await p.evaluate(() => window.__wsStudy.state().res.csv().join('\n')); assert.match(csv, /frame member,kind,level,section,length_m,N_min_kN,N_max_kN,V_kN,M_kNm,normal_stress_MPa,von_mises_MPa,capacity_used/); assert.match(csv, /\nwind sway,worst storey/);
    // remove them all
    await p.click('.sp-studycard [data-sf=brace]'); await p.click('.sp-studycard [data-sf=nobraces]'); await idle(); await p.waitForTimeout(300); assert.equal((await st()).counts.braces, 0);
    console.log('PASS the CSV has every member\'s forces and the sway; all braces removed');

    // ---- Fallingwater: stone walls as supports, a steel-free concrete frame with cantilevers
    await open('./js/fallingwater-dashboard.js', 'openCase');
    await run(); r = await st(); assert(r.frame, 'the frame ran on Fallingwater'); fp = await parts(); assert(fp.parts['sf-tubes'] === 1 && fp.parts['sf-support'] > 0);
    assert.match(r.rows.find(([a]) => a === 'Frame analysis')[1], /equilibrium ✓/);
    await shot('structure-frame-fallingwater-moment.png');
    console.log(`PASS Fallingwater frame: ${r.counts.columns} columns, ${r.counts.beams} strips, ${fp.parts['sf-support']} supports; ${r.rows.find(([a]) => a === 'Capacity used, highest')[1].replace(/<[^>]+>/g, '')}`);
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
