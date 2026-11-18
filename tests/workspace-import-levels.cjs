// An imported building's floors, and moving it up and down (2026-11-17). A generated OBJ of a B2–11F tower (slabs named by
// floor, 3.0 m storeys, a 4.5 m ground floor, a roof) is imported into an empty project:
//  - the preview lists 13 floors and a roof and proposes 1F as the ground (B2 and B1 named in the model); on confirm the model
//    moves so 1F is at 0 and the floors become the project's levels B2 … 11F and Roof;
//  - the Move panel (a small white board) shows for a selected import: ↓ 1 floor moves it down a storey, undo puts it back;
//    typed ΔZ moves it; "Whole model" with "Levels follow" moves every object of the file and its levels, renamed around 0;
//  - the blue Z arrow of the 3D gumball drags an import down and snaps its base onto a level;
//  - the panel is dragged by its title and keeps its place after a reload of the Workspace.
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 960 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], shots = process.env.SHOT_DIR || os.tmpdir();
    p.on('pageerror', (e) => errs.push(e.message));
    // the tower as an OBJ (metres, Z up): a slab per floor named after it, two walls per storey, a roof slab
    const names = ['B2', 'B1', '1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F', '9F', '10F', '11F'], lv = []; let z = 0; for (const n of names) { lv.push(z); z += n === '1F' ? 4.5 : 3; } const roofZ = z;
    let obj = '', vn = 0; const box = (name, x, y, z0, w, d, h) => { obj += `o ${name}\n`; const P = [[0, 0, 0], [w, 0, 0], [w, d, 0], [0, d, 0], [0, 0, h], [w, 0, h], [w, d, h], [0, d, h]]; for (const q of P) obj += `v ${x + q[0]} ${y + q[1]} ${z0 + q[2]}\n`;
      for (const f of [[1, 4, 3, 2], [5, 6, 7, 8], [1, 2, 6, 5], [2, 3, 7, 6], [3, 4, 8, 7], [4, 1, 5, 8]]) obj += 'f ' + f.map((i) => i + vn).join(' ') + '\n'; vn += 8; };
    lv.forEach((e, i) => { box(`${names[i]}_slab`, 0, 0, e - 0.25, 20, 12, 0.25); const hh = (lv[i + 1] ?? roofZ) - e - 0.25; box(`${names[i]}_wall_w`, 0, 0, e, 0.25, 12, hh); box(`${names[i]}_wall_e`, 19.75, 0, e, 0.25, 12, hh); });
    box('Roof_slab', 0, 0, roofZ - 0.3, 20, 12, 0.3);
    const file = path.join(os.tmpdir(), 'tower-b2-11f.obj'); fs.writeFileSync(file, obj);
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    const id = await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, gumball: true, view: 'persp' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); return S.createProject('Tower', { units: 'm', layers: [], components: [] }).id; });
    await p.goto(base + '/mvp/#/workspace/' + id); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2.inst.plan.ready && window.__ws2.inst.props.ready, null, { timeout: 300000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(800);
    // import: the preview lists the floors
    await p.evaluate(() => { const u = document.querySelector('#up'); if (u) u.value = 'z'; }); await p.setInputFiles('#file', file); await p.locator('.ipv [data-ipv=ok]').waitFor({ timeout: 60000 });
    await p.locator('.ipv [data-ipv-up]').selectOption('z'); await p.waitForSelector('.ipv-floors:not([hidden])');
    assert.match(await p.locator('[data-ipv-fnote]').innerText(), /13 floors and a roof, 3\.0–4\.5 m apart; ground floor: 1F \(2 basement floors named in the model\)/);
    const listed = await p.$$eval('[data-ipv-flist] li b', (bs) => bs.map((x) => x.textContent)); assert.deepEqual(listed, ['Roof', ...[...names].reverse()]);
    assert.equal(await p.locator('[data-ipv-flist] li.on b').innerText(), '1F'); assert.equal(await p.inputValue('[data-ipv-ground]'), '2');
    await p.locator('.ipv-card').screenshot({ path: shots + '/import-floors.png' });
    await p.click('.ipv [data-ipv=ok]'); await p.waitForFunction(() => (__ws2.model().studio.imports || []).length >= 39, null, { timeout: 60000 }); await p.waitForTimeout(1500);
    const st = await p.evaluate(() => { const s = __ws2.model().studio; return { lv: [...s.levels].sort((a, b) => a.z - b.z).map((l) => [l.name, +l.z.toFixed(2)]), b2: s.imports.find((o) => o.name === 'B2_slab'), f1: s.imports.find((o) => o.name === '1F_slab') }; });
    assert.deepEqual(st.lv.slice(0, 4), [['B2', -6], ['B1', -3], ['1F', 0], ['2F', 4.5]]); assert.deepEqual(st.lv.at(-1), ['Roof', 34.5]); assert.equal(st.lv.length, 14);
    assert(Math.abs(st.f1.g.z + 0.25) < 1e-6 && Math.abs(st.b2.g.z + 6.25) < 1e-6, 'the model moved so 1F is at 0: ' + JSON.stringify([st.f1.g.z, st.b2.g.z]));
    assert.match(await p.locator('#impMsg').innerText(), /Floors: 14 found; they are now the project’s levels; the model moved down 6\.25 m so its ground floor is at 0/);
    console.log('PASS import: 13 floors and a roof found, 1F proposed as ground (B2, B1 named); the model moved down 6.25 m (to the 1F slab top); levels B2 … 11F and Roof');
    // the Move panel for one import
    const sel = async (name) => { await p.evaluate((n) => { const o = __ws2.model().studio.imports.find((x) => x.name === n); __ws2.hub.select('test', { k: 'imp', id: o.id }); }, name); await p.waitForSelector('.w2-move:not([hidden])', { timeout: 10000 }); };
    const zOf = (name) => p.evaluate((n) => +__ws2.model().studio.imports.find((x) => x.name === n).g.z.toFixed(4), name);
    await sel('3F_slab'); assert.match(await p.locator('.w2-move').innerText(), /imported object[\s\S]*base Z[\s\S]*on 3F/);
    const z0 = await zOf('3F_slab'); await p.click('.w2-move [data-mv=down]'); await p.waitForTimeout(500); assert.equal(await zOf('3F_slab'), +(z0 - 3).toFixed(4), 'down one floor (3.0 m)');
    await p.evaluate(() => __ws2.hub.undo()); await p.waitForTimeout(500); assert.equal(await zOf('3F_slab'), z0, 'undo');
    await p.fill('.w2-move [data-mv-d=z]', '-250'); await p.press('.w2-move [data-mv-d=z]', 'Enter'); await p.waitForTimeout(500); assert.equal(await zOf('3F_slab'), +(z0 - 0.25).toFixed(4), 'typed ΔZ');
    await p.fill('.w2-move [data-mv-d=z]', '0'); await p.fill('.w2-move [data-mv-d=x]', '1000'); await p.click('.w2-move [data-mv=go]'); await p.waitForTimeout(500);
    assert.equal(await p.evaluate(() => +__ws2.model().studio.imports.find((x) => x.name === '3F_slab').g.x.toFixed(3)), 1, 'typed ΔX'); await p.evaluate(() => { __ws2.hub.undo(); __ws2.hub.undo(); }); await p.waitForTimeout(600);
    console.log('PASS Move panel: ↓ 1 floor moves 3.0 m down and undo puts it back; typed ΔZ and ΔX move by the amounts');
    // the whole model, its levels following: one floor up puts B1 at 0, renamed 1F
    await p.check('.w2-move [data-mv-whole]'); await p.click('.w2-move [data-mv=up]'); await p.waitForTimeout(800);
    const up = await p.evaluate(() => { const s = __ws2.model().studio; return { lv: [...s.levels].sort((a, b) => a.z - b.z).map((l) => [l.name, +l.z.toFixed(2)]), b2: +s.imports.find((o) => o.name === 'B2_slab').g.z.toFixed(4) }; });
    assert.deepEqual(up.lv.slice(0, 3), [['B1', -3], ['1F', 0], ['2F', 3]]); assert.equal(up.b2, -3.25);
    await p.evaluate(() => __ws2.hub.undo()); await p.waitForTimeout(600); await p.uncheck('.w2-move [data-mv-whole]');
    console.log('PASS whole model with its levels: one floor up moves all 40 objects and the levels, renamed around 0 (the old B1 becomes 1F)');
    // the blue Z arrow in 3D: drag the 3F slab down; its base snaps to a level
    await p.evaluate(() => { __ws2.inst.persp.ws.tool?.({ tool: 'select' }); }); await sel('3F_slab'); await p.evaluate(() => __ws2.inst.persp.win.document.getElementById('fitSelectedBtn')?.click()); await p.waitForTimeout(700);
    const parts = await p.evaluate(() => __ws2.inst.persp.win.S3.gizmo.state()?.parts || []); assert(parts.includes('gz-z'), 'a Z arrow: ' + parts);
    const g = await p.evaluate(() => { const fr = document.querySelector('#fPersp').getBoundingClientRect(), Z = __ws2.inst.persp.win.S3.gizmo.zAxis(); return { o: [fr.left + Z.o[0], fr.top + Z.o[1]], t: [fr.left + Z.t[0], fr.top + Z.t[1]], len: Z.len }; });
    const grab = [g.o[0] + (g.t[0] - g.o[0]) * 0.75, g.o[1] + (g.t[1] - g.o[1]) * 0.75], perM = Math.hypot(g.t[0] - g.o[0], g.t[1] - g.o[1]) / g.len, k = 2.9 * perM / Math.hypot(g.t[0] - g.o[0], g.t[1] - g.o[1]);
    const hit = await p.evaluate(([x, y]) => { const fr = document.querySelector('#fPersp').getBoundingClientRect(); return __ws2.inst.persp.win.S3.gizmo.hit(x - fr.left, y - fr.top); }, grab); assert.equal(hit, 'z', 'the grab point is on the Z arrow: ' + JSON.stringify({ hit, g, grab }));
    await p.mouse.move(...grab); await p.mouse.down(); for (let i = 1; i <= 8; i++) await p.mouse.move(grab[0] - (g.t[0] - g.o[0]) * k * i / 8, grab[1] - (g.t[1] - g.o[1]) * k * i / 8); await p.mouse.up(); await p.waitForTimeout(800);
    const zz = await zOf('3F_slab'), levels = await p.evaluate(() => __ws2.model().studio.levels.map((l) => +l.z.toFixed(3)));
    assert(zz < z0 - 2 && levels.includes(+zz.toFixed(3)), `dragged down about 3 m and snapped onto a level: ${z0} → ${zz}`);
    await p.evaluate(() => __ws2.hub.undo()); await p.waitForTimeout(500); assert.equal(await zOf('3F_slab'), z0);
    console.log(`PASS the blue Z arrow: dragged the 3F slab down, its base snapped onto a level (${z0} → ${zz} m); undo`);
    // a click on the Z arrow (no drag): the box beside it; a storey down, then a typed distance
    const tip = await p.evaluate(() => { const fr = document.querySelector('#fPersp').getBoundingClientRect(), Z = __ws2.inst.persp.win.S3.gizmo.zAxis(); return [fr.left + Z.o[0] + (Z.t[0] - Z.o[0]) * 0.75, fr.top + Z.o[1] + (Z.t[1] - Z.o[1]) * 0.75]; });
    await p.mouse.click(...tip); await p.waitForSelector('.w2-axpop:not([hidden])', { timeout: 5000 }); assert.match(await p.locator('.w2-axpop').innerText(), /Move along Z[\s\S]*↑ 1 floor[\s\S]*↓ 1 floor[\s\S]*mm/);
    assert.equal(await zOf('3F_slab'), z0, 'a click alone moves nothing'); await p.locator('.w2-axpop').screenshot({ path: shots + '/axis-box.png' });
    await p.click('.w2-axpop [data-ap=down]'); await p.waitForTimeout(500); assert.equal(await zOf('3F_slab'), +(z0 - 3).toFixed(4), 'a storey down from the box');
    await p.evaluate(() => __ws2.hub.undo()); await p.waitForTimeout(400);
    await p.mouse.click(...tip); await p.waitForSelector('.w2-axpop:not([hidden])'); await p.fill('.w2-axpop [data-ap-mm]', '-1500'); await p.press('.w2-axpop [data-ap-mm]', 'Enter'); await p.waitForTimeout(500);
    assert.equal(await zOf('3F_slab'), +(z0 - 1.5).toFixed(4), 'a typed -1500 mm'); assert(await p.locator('.w2-axpop').isHidden()); await p.evaluate(() => __ws2.hub.undo()); await p.waitForTimeout(400);
    console.log('PASS a click on the Z arrow opens a box beside it: ↓ 1 floor moves a storey down, a typed -1500 mm moves exactly 1.5 m');
    // the panel moves by its title and keeps its place
    const hd = await p.locator('.w2-move header').boundingBox(); await p.mouse.move(hd.x + 40, hd.y + 10); await p.mouse.down(); await p.mouse.move(hd.x - 300, hd.y - 200, { steps: 6 }); await p.mouse.up();
    const at = await p.locator('.w2-move').boundingBox(); assert(Math.abs(at.x - (hd.x - 340)) < 4 && Math.abs(at.y - (hd.y - 210)) < 4, 'dragged: ' + JSON.stringify([hd, at]));
    await p.locator('.w2-move').screenshot({ path: shots + '/move-panel.png' });
    await p.reload(); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2.inst.plan.ready, null, { timeout: 300000 }); await p.waitForTimeout(800); await sel('3F_slab');
    const at2 = await p.locator('.w2-move').boundingBox(); assert(Math.abs(at2.x - at.x) < 2 && Math.abs(at2.y - at.y) < 2, 'kept its place');
    console.log('PASS the Move panel drags by its title and keeps its place');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
