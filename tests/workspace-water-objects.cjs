// Water objects as static site elements (2026-11-18), on Fallingwater (hilly terrain), in the Workspace:
// 1 a rectangle dragged on the plan: a level pool whose shore lies on the drawn ground (none floating) and which is level;
// 2 'Follow the ground': every vertex on the ground within 1 mm; 3 a level set above the shore: the warning, drawn at the shore;
// 4 circle, ellipse and freehand each make a water area with its shape; 5 width, rotation, duplicate and delete; 6 no moving water
// (no control, no animation, the old setting cleared); 7 a fountain and a rill: Water sound finds both, a deleted one marks the result
// out of date and the rerun drops it; 8 after a reload the shapes, placement, colour and sound settings are kept; no page errors.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 960 } }), errs = [], base = process.env.TEST_BASE || 'http://127.0.0.1:8765', shots = process.env.SHOT_DIR || require('os').tmpdir();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    const pid = await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'plan' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); const m = await import('./js/fallingwater-dashboard.js'), q = m.openCase(); try { localStorage.setItem('pc-mvp-current', q.id); localStorage.setItem('pc-water-anim', 'on'); } catch { } return q.id; });
    const open = async () => { await p.goto(base + '/mvp/#/workspace/' + pid); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 300000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(2500); await p.click('#editSite'); await p.waitForTimeout(800); };   // Edit site model: the site's layer open to drawing
    await open();
    const persp = () => p.frames().find((f) => f.url().includes('ws=persp'));
    const waters = () => p.evaluate(() => __ws2.inst.persp.ws.waters());
    // a plan point on the screen: the main view (the persp pane, showing the plan) plus its iframe's offset
    const S = (q) => p.evaluate((q) => { const f = [...document.querySelectorAll('iframe')].find((x) => /ws=persp/.test(x.src)), r = f.getBoundingClientRect(), s = __ws2.inst.persp.ws.toScreen(q); return [r.left + s[0], r.top + s[1]]; }, q);
    const onScreen = async (q) => { const v = await S(q); assert(v[0] > 0 && v[1] > 0 && v[0] < 1600 && v[1] < 960, 'off the screen: ' + q); return v; };
    const tool = async (t) => { const ok = await p.evaluate((t) => __ws2.inst.persp.ws.tool({ tool: t }), t); if (!ok) console.log('tool', t, await p.evaluate((t) => { const f = [...document.querySelectorAll('iframe')].find((x) => /ws=plan/.test(x.src)); const d = f.contentDocument; return { btn: !!d.querySelector(`[data-tool="${t}"]`), water: !!d.querySelector('[data-tool="lswater"]'), lock: JSON.stringify(__ws2.model().layers.filter((l) => l.locked).map((l) => l.name)) }; }, t)); return ok; };
    const drag = async (a, c, steps = 6) => { await onScreen(a); await onScreen(c); await p.mouse.move(...(await S(a))); await p.mouse.down(); await p.mouse.move(...(await S(c)), { steps }); await p.mouse.up(); await p.waitForTimeout(400); };
    const fit = (id) => persp().evaluate((id) => S3._waterFit(id), id);
    const settle = () => p.waitForTimeout(1200);
    // the old moving-water setting is cleared on load, and nothing animates
    assert.equal(await p.evaluate(() => localStorage.getItem('pc-water-anim')), null, 'the old setting cleared'); assert.equal((await persp().evaluate(() => S3._water())).anim, false);
    const n0 = (await waters()).length;
    // 1. a rectangle, 12 × 8 m, north-east of the house (all shapes inside the framed plan view)
    assert(await tool('lswrect'), 'the rectangle tool'); await drag([22, 10], [34, 18]); await settle();
    let W = await waters(); assert.equal(W.length, n0 + 1); const R = W.at(-1); assert.equal(R.shape.type, 'rectangle'); assert(R.shape.w > 1 && R.shape.l > 1 && Math.abs(R.area - R.shape.w * R.shape.l) < 0.05, 'the shape and its outline agree: ' + JSON.stringify([R.shape, R.area]));   // the corners snap to nearby geometry, so the size is the snapped one assert.equal(R.place, 'level'); assert.equal(R.type, 'pond');
    let F = await fit(R.id); assert(F && F.shoreAbove <= 0.001, 'the shore is not above the ground: ' + JSON.stringify(F)); assert(F.spread < 1e-4, 'level: ' + JSON.stringify(F));
    console.log(`PASS 1 a ${R.shape.w.toFixed(1)} × ${R.shape.l.toFixed(1)} m rectangle (dragged about 12 × 8 m, snapped): a level pool at ${R.level.toFixed(2)} m (its lowest shore); shore ${F.shoreAbove} m above the drawn ground at most; ${F.n} vertices, all at one level`);
    // the card: no moving-water control
    await p.evaluate((id) => window.__wsWater.open(id), R.id); await p.waitForTimeout(500); const card = await p.locator('.sp-watercard').innerText();
    assert(!/Moving water/.test(card), 'no Moving water control'); assert.match(card, /Level surface[\s\S]*Follow the ground[\s\S]*Rectangle[\s\S]*Width/);
    // 2. follow the ground
    await p.click('.sp-watercard [data-watplace=ground]'); await settle(); F = await fit(R.id); assert(F.above <= 0.001 && F.below <= 0.001, 'on the ground: ' + JSON.stringify(F));
    console.log(`PASS 2 Follow the ground: every one of ${F.n} vertices on the drawn ground (${F.above} / ${F.below} m off); spread ${F.spread} m over the slope`);
    await p.click('.sp-watercard [data-watplace=level]'); await settle();
    // 3. a level set 1 m above the lowest shore: the warning, drawn at the shore
    const shore = (await waters()).find((x) => x.id === R.id).shore; await p.fill('.sp-watercard [data-wat=level]', String((shore + 1).toFixed(2))); await p.locator('.sp-watercard [data-wat=level]').dispatchEvent('change'); await settle();
    await p.waitForFunction(() => /The water would spill at the shore/.test(document.querySelector('.sp-watercard')?.innerText || ''), null, { timeout: 10000 }).catch(() => {}); assert.match(await p.locator('.sp-watercard').innerText(), /The water would spill at the shore/); F = await fit(R.id); assert(F.shoreAbove <= 0.001 && Math.abs(F.y0 - shore) < 0.002, 'drawn at the shore: ' + JSON.stringify(F));
    await p.fill('.sp-watercard [data-wat=level]', ''); await p.locator('.sp-watercard [data-wat=level]').dispatchEvent('change'); await settle();
    console.log(`PASS 3 a level 1 m above the shore (${shore.toFixed(2)} m): "The water would spill at the shore", drawn at the shore, not floating`);
    // 5 (part). width and rotation in the card
    await p.fill('.sp-watercard [data-wsh=w]', '16'); await p.locator('.sp-watercard [data-wsh=w]').dispatchEvent('change'); await settle();
    await p.fill('.sp-watercard [data-wsh=rot]', '30'); await p.locator('.sp-watercard [data-wsh=rot]').dispatchEvent('change'); await settle();
    let R2 = (await waters()).find((x) => x.id === R.id); assert(Math.abs(R2.shape.w - 16) < 1e-6 && Math.abs(R2.shape.rot * 180 / Math.PI - 30) < 1e-6 && Math.abs(R2.area - 16 * R2.shape.l) < 0.5, JSON.stringify([R2.shape, R2.area]));
    { const F5 = await fit(R.id); assert(F5.shoreAbove <= 0.001, 'after resize: ' + JSON.stringify([F5, R2.level, R2.shore, R2.set])); }
    console.log(`PASS 5 the card: width 16 m and rotation 30°: ${R2.area.toFixed(1)} m², still on the ground`);
    // 7 (part). the rectangle as a fountain
    const pickSound = async (kind) => { for (let k = 0; k < 3; k++) { await p.waitForTimeout(800); await p.selectOption('.sp-watercard [data-watsnd=kind]', kind); await p.waitForTimeout(900); if (await p.evaluate((kind) => document.querySelector('.sp-watercard [data-watsnd=kind]')?.value === kind, kind)) return; } };   // the card redraws a moment after each edit
    await pickSound('fountain'); assert.match(await p.locator('.sp-watercard').innerText(), /59\.4 dB\(A\) in all/);
    await p.selectOption('.sp-watercard [data-wat=color]', 'teal'); await p.waitForTimeout(500); await p.click('.sp-watercard [data-watx=close]');
    // 4. circle, ellipse, freehand
    assert(await tool('lswcirc')); await drag([45, 30], [50, 30]); await settle(); W = await waters(); const C = W.at(-1); assert.equal(C.shape.type, 'circle'); assert(C.shape.r > 2 && Math.abs(C.area - Math.PI * C.shape.r ** 2) / C.area < 0.01, JSON.stringify([C.shape, C.area]));
    assert(await tool('lswell')); await drag([5, 40], [13, 40]); await p.mouse.move(...(await S([5, 43]))); await p.waitForTimeout(150); await p.mouse.click(...(await S([5, 43]))); await settle();
    W = await waters(); const E = W.at(-1); assert.equal(E.shape.type, 'ellipse'); assert(E.shape.a > 3 && E.shape.b > 1 && E.shape.b <= E.shape.a * 4 && Math.abs(E.area - Math.PI * E.shape.a * E.shape.b) / E.area < 0.01, JSON.stringify([E.shape, E.area]));
    assert(await tool('lswfree')); { const loop = Array.from({ length: 24 }, (_, k) => [52 + 5 * Math.cos(2 * Math.PI * k / 23), 8 + 3 * Math.sin(2 * Math.PI * k / 23)]); await p.mouse.move(...(await S(loop[0]))); await p.mouse.down(); for (const q of loop.slice(1)) await p.mouse.move(...(await S(q)), { steps: 2 }); await p.mouse.up(); await settle(); const pf = p.frames().find((f) => f.url().includes('ws=persp')); const hint = await pf.evaluate(() => document.querySelector('#toolHint')?.textContent); if ((await waters()).at(-1).shape.type !== 'freeform') console.log('FREE hint:', hint); }
    W = await waters(); const Fr = W.at(-1); assert.equal(Fr.shape.type, 'freeform'); assert(Fr.area > 30 && Fr.area < 60, 'freehand area ' + Fr.area);
    for (const x of [C, E, Fr]) assert((await fit(x.id)).shoreAbove <= 0.001, x.shape.type + ' shore on the ground');
    await p.screenshot({ path: `${shots}/water-shapes.png` });
    console.log(`PASS 4 circle R ${C.shape.r.toFixed(2)} m, ellipse ${(2 * E.shape.a).toFixed(1)} × ${(2 * E.shape.b).toFixed(1)} m, freehand ${Fr.area.toFixed(0)} m²: each a water area with its shape, shores on the ground`);
    // 7. the circle as a rill; Water sound finds both
    await p.evaluate((id) => window.__wsWater.open(id), C.id); await p.waitForTimeout(500); await pickSound('rill'); await p.click('.sp-watercard [data-watx=close]');
    const runWS = async () => { await p.evaluate(() => window.__wsStudy.open('watersound')); await p.waitForTimeout(600); await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 300000 }); return p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, rows: s.res && s.res.rows.map(([k, v]) => [k, String(v)]), bands: !!(s.res && s.res.bands), pv: s.res && s.res.pvals ? [...s.res.pvals].filter((v) => v >= 9000).length : 0 }; }); };
    let ws1 = await runWS(); assert.equal(ws1.err, ''); const src1 = ws1.rows.find(([k]) => k === 'Sources')[1]; assert.match(src1, /Rectangular pool, fountain/); assert.match(src1, /Round pool, rill/);
    assert(ws1.bands && ws1.pv > 10, 'the map in 5 dB bands with contour lines'); await p.screenshot({ path: `${shots}/water-sound-bands.png` });
    console.log(`PASS 7 Water sound finds the fountain and the rill (${src1}); the map in 5 dB bands with ${ws1.pv} contour cells`);
    // 5 and 7. duplicate, then delete the circle: the result is out of date; the rerun has no rill
    const dupId = await p.evaluate((id) => __ws2.inst.persp.ws.waterDup(id), E.id); await settle(); W = await waters(); assert(W.some((x) => x.id === dupId && x.shape.type === 'ellipse'), 'duplicated');
    await p.evaluate((id) => __ws2.inst.persp.ws.siteElDel({ k: 'sarea', id }), C.id); await settle(); W = await waters(); assert(!W.some((x) => x.id === C.id), 'deleted');
    assert((await persp().evaluate((id) => S3._waterFit(id), C.id)) === null, 'no leftover surface');
    assert.match(await p.locator('.sp-studycard').innerText(), /Model changed|Settings changed|Start again/); const ws2 = await runWS(); assert.doesNotMatch(ws2.rows.find(([k]) => k === 'Sources')[1], /Round pool, rill/);
    console.log('PASS 5 duplicated the ellipse; deleted the circle (no leftover surface): Water sound out of date, the rerun without the rill');
    // 8. reload: shapes, placement, colour, sound kept; all static
    await p.waitForTimeout(1500); await open(); W = await waters(); const R3 = W.find((x) => x.id === R.id);
    assert(R3 && R3.shape.type === 'rectangle' && Math.abs(R3.shape.w - 16) < 1e-6 && R3.color === 'teal' && R3.sound && R3.sound.kind === 'fountain' && R3.place === 'level', JSON.stringify(R3)); assert(W.some((x) => x.id === E.id) && W.some((x) => x.id === Fr.id));
    assert.equal((await persp().evaluate(() => S3._water())).anim, false);
    console.log('PASS 8 after a reload: the rectangle (16 m, teal, fountain, level), the ellipse and the freehand water are kept; all static');
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
