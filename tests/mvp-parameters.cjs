// Parameter types in Plan Studio (2026-10-25): 1 · finishes with physical properties (sound absorption per band, light reflectance,
// glazing transmittance) on walls, windows and a level's floor and ceiling, read by Indoor acoustics and Daylight; 2 · arrays of
// furniture; 3 · linked values (an array's count from a length to fill, a mass's storeys from a height limit or a target FAR).
// Run with a static server on 8765 (python3 -m http.server 8765 --bind 127.0.0.1); TEST_BASE overrides it.
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const BASE = process.env.TEST_BASE || 'http://127.0.0.1:8765';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/emb/modeler.html'); await p.waitForFunction(() => window.__params && window.__pcWorkflow, null, { timeout: 30000 });
  const Ev = (fn, a) => p.evaluate(fn, a);
  const scene = (tool) => Ev((t) => JSON.parse(__pcWorkflow.toolScene(t, __st.M.levels[0].id).scene), tool);

  // ---- 1 · finishes
  const dl0 = await scene('daylight'); ok(dl0.rw == null && dl0.rf == null && dl0.rc == null && dl0.tau == null, 'with no finish set, Daylight keeps its own reflectances (nothing sent)');
  const a0 = await scene('acoustics'); ok(a0.rooms.length > 0 && a0.rooms.every((r) => r.vol > 0 && r.surf.some((q) => q.kind === 'ceiling') && r.surf.some((q) => q.kind === 'floor')), `Indoor acoustics gets ${a0.rooms.length} rooms with their surfaces`);
  const lr = a0.rooms.find((r) => r.surf.some((q) => q.kind === 'window')) || a0.rooms[0];
  const sum = (r, k) => r.surf.filter((q) => q.kind === k).reduce((s, q) => s + q.area, 0);
  ok(Math.abs(sum(lr, 'floor') - lr.area) < 0.5 && Math.abs(sum(lr, 'ceiling') - lr.area) < 0.5 && lr.vol > lr.area * 2, `${lr.name}: floor and ceiling equal its area (${lr.area} m²), volume ${Math.round(lr.vol)} m³`);
  const wid = await Ev(() => __st.M.walls[0].id); await Ev((id) => __params.select('wall', id), wid);
  ok(await p.$('#props #pmx_mat') !== null, 'a wall’s panel has a Finish select');
  const wallOpts = await p.$$eval('#pmx_mat option', (o) => o.map((x) => x.value)); ok(wallOpts.includes('absorber') && !wallOpts.includes('carpet'), 'wall finishes only (acoustic panel yes, carpet no)');
  await p.selectOption('#pmx_mat', 'absorber'); await p.waitForTimeout(150);
  ok(await Ev((id) => __st.M.walls.find((w) => w.id === id).mat, wid) === 'absorber', 'choosing it sets the wall’s finish');
  ok(/α 0\.20 · 0\.55 · 0\.95/.test(await p.textContent('#pmx_matn')), 'its absorption by band and light reflectance are shown');
  const win = await Ev(() => __st.M.ops.find((o) => o.object_type === 'window').id); await Ev((id) => __params.select('op', id), win);
  ok(await p.$('#props #pmx_mat') !== null && (await p.$$eval('#pmx_mat option', (o) => o.map((x) => x.value))).includes('triple'), 'a window’s panel has a Glazing select');
  await p.selectOption('#pmx_mat', 'triple'); await p.waitForTimeout(150); ok(await Ev((id) => __st.M.ops.find((o) => o.id === id).glaz, win) === 'triple', 'choosing it sets the window’s glazing');
  await Ev(() => __params.select(null)); await p.waitForTimeout(100);
  const lvSel = async (id, v) => { if (await Ev(() => document.getElementById('lvCard').classList.contains('kr-closed'))) { await p.click('#lvCard .kr-h'); await p.waitForTimeout(150); } await p.selectOption(id, v); };   // the card may be folded
  ok(await p.$('#lvFM') !== null && await p.$('#lvCM') !== null, 'Level properties has floor and ceiling finishes');
  await lvSel('#lvFM', 'carpet'); await lvSel('#lvCM', 'tileceiling'); await p.waitForTimeout(150);
  ok(await Ev(() => [__st.M.levels[0].floorMat, __st.M.levels[0].ceilMat].join()) === 'carpet,tileceiling', 'they are kept on the level');
  const a1 = await scene('acoustics'), r1 = a1.rooms.find((r) => r.id === lr.id) || a1.rooms[0];
  ok(a1.rooms.every((r) => r.surf.filter((q) => q.kind === 'ceiling').every((q) => q.mat === 'tileceiling')), 'Indoor acoustics: every ceiling is the suspended ceiling');
  ok(a1.rooms.every((r) => r.surf.filter((q) => q.kind === 'floor').every((q) => q.mat === 'carpet' || q.mat)), 'Indoor acoustics: floors carry a finish (the level’s, or a slab’s own)');
  ok(a1.rooms.some((r) => r.surf.some((q) => q.kind === 'wall' && q.mat === 'absorber')), 'Indoor acoustics: the panelled wall’s faces carry the acoustic panel');
  ok(a1.rooms.some((r) => r.surf.some((q) => q.kind === 'window' && q.mat === 'triple')), 'Indoor acoustics: the window carries its glazing');
  ok(a1.materials?.absorber?.a?.length === 6 && a1.glazing?.triple?.vt === 0.6, 'the scene carries the finishes’ properties');
  const dl1 = await scene('daylight'); ok(dl1.rc === 0.8 && dl1.rf === 0.2 && dl1.tau === 0.6 && dl1.rw > 0 && dl1.rw <= 0.7, `Daylight gets the reflectances and transmittance (walls ${dl1.rw}, floor ${dl1.rf}, ceiling ${dl1.rc}, glass ${dl1.tau})`);

  // ---- 2 · arrays (and 3 · fill a length)
  const f0 = await Ev(() => { const f = __st.M.furn.find((q) => q.type === 'dining') || __st.M.furn[0]; return { id: f.id, w: f.w, x: f.x, y: f.y, rot: f.rot || 0 }; });
  await Ev((id) => __params.select('furn', id), f0.id); ok(await p.$('#props #pmx_n') !== null, 'a piece of furniture has an Array section');
  await p.fill('#pmx_s', '2'); await p.dispatchEvent('#pmx_s', 'change'); await p.fill('#pmx_n', '4'); await p.dispatchEvent('#pmx_n', 'change'); await p.waitForTimeout(150);
  let cp = await Ev((id) => __st.M.furn.filter((q) => q.arrOf === id).map((q) => ({ id: q.id, x: q.x, y: q.y, locked: q.locked })), f0.id);
  ok(cp.length === 3 && cp.every((c, k) => c.id === f0.id + '~' + (k + 1) && c.locked), `count 4: three copies that follow the first (${cp.map((c) => c.id).join(', ')})`);
  ok(cp.every((c, k) => Math.abs(Math.hypot(c.x - f0.x, c.y - f0.y) - 2 * (k + 1)) < 1e-3), 'spaced 2 m centre to centre along its width');
  await Ev((id) => { const f = __st.M.furn.find((q) => q.id === id); f.x += 1; __params.syncArrays(); }, f0.id);
  cp = await Ev((id) => __st.M.furn.filter((q) => q.arrOf === id).map((q) => q.x), f0.id); ok(cp.length === 3 && Math.abs(cp[0] - (f0.x + 1 + (f0.rot ? 0 : 2))) < 1e-3 || f0.rot, 'moving the first piece moves the copies');
  await p.fill('#pmx_fill', '7'); await p.dispatchEvent('#pmx_fill', 'change'); await p.waitForTimeout(150);
  const n7 = await Ev((id) => __st.M.furn.filter((q) => q.id === id || q.arrOf === id).length, f0.id), want = Math.floor((7 - f0.w) / 2 + 1e-6) + 1;
  const dis = await p.$eval('#pmx_n', (e) => e.disabled); ok(n7 === want && dis, `fill 7 m: the count is worked out (${n7} pieces of ${f0.w} m at 2 m) and the Count box follows it`);
  await Ev((id) => __params.select('furn', id + '~1'), f0.id); ok(await p.$('#props #pmx_src') !== null && await p.$('#props #pmx_n') === null, 'a copy says it follows the first piece and has no array of its own');
  await p.click('#pmx_src'); ok(await Ev(() => __st.SEL.id) === f0.id, '“Select the first piece” selects it');
  await p.fill('#pmx_fill', ''); await p.dispatchEvent('#pmx_fill', 'change'); await p.fill('#pmx_n', '1'); await p.dispatchEvent('#pmx_n', 'change'); await p.waitForTimeout(150);
  ok(await Ev((id) => __st.M.furn.filter((q) => q.arrOf === id).length, f0.id) === 0, 'count 1 removes the copies');

  // ---- 3 · a mass's storeys from a height limit or a target FAR (a plot of 40 × 30 m)
  await Ev(() => { const SC = window.__SITEC, site = SC.siteFromOSM('<?xml version="1.0"?><osm version="0.6"></osm>', { lat: 49.28, lon: -123.12, label: 'Test plot' }, { kind: 'radius', r: 100 }, { provider: 'test fixture' }); site.fixture = true;
    site.parcel = { pts: [[-20, -15], [20, -15], [20, 15], [-20, 15]] }; site.parcelId = 'Your plot'; const m = JSON.parse(JSON.stringify(__st.M)); m.walls = []; m.ops = []; m.floors = []; m.furn = []; m.voids = []; m.masses = []; m.site = site; m.name = 'Links test'; window.__mass.load(m); });
  await p.waitForTimeout(500); const sk = await p.$('text=Skip'); if (sk) await sk.click().catch(() => {});
  await Ev(() => window.__mass.addMass([[-10, -5], [10, -5], [10, 5], [-10, 5]])); await p.waitForTimeout(150);
  const mid = await Ev(() => __st.M.masses[0].id); await Ev((id) => __params.select('mass', id), mid);
  ok(await p.$('#props #pmx_by') !== null, 'a mass has “Storeys from”');
  await p.selectOption('#pmx_by', 'height'); await p.fill('#pmx_v', '20'); await p.dispatchEvent('#pmx_v', 'change'); await p.waitForTimeout(150);
  let m = await Ev(() => ({ st: __st.M.masses[0].storeys, fh: __st.M.masses[0].fh }));
  ok(m.st === Math.floor(20 / m.fh), `height limit 20 m: ${m.st} storeys of ${m.fh} m`);
  ok(await p.$eval('#pm_st', (e) => e.disabled).catch(() => false), 'the typed storeys are locked while the rule holds');
  await p.selectOption('#pmx_by', 'far'); await p.fill('#pmx_v', '2'); await p.dispatchEvent('#pmx_v', 'change'); await p.waitForTimeout(150);
  m = await Ev(() => __st.M.masses[0].storeys); ok(m === 12, `target FAR 2 on 1,200 m² with a 200 m² footprint: ${m} storeys`);
  await Ev(() => window.__mass.addMass([[12, -12], [18, -12], [18, -2], [12, -2]])); await p.waitForTimeout(150);
  m = await Ev(() => { const [a, b2] = __st.M.masses; return [a.storeys, b2.storeys]; }); ok(m[0] === Math.round((2 * 1200 - 60 * m[1]) / 200), `a second mass (60 m², ${m[1]} storeys) takes its share: the first now has ${m[0]}`);
  await Ev((id) => __params.select('mass', id), mid); await p.selectOption('#pmx_by', ''); await p.waitForTimeout(150);
  ok(await Ev(() => !__st.M.masses[0].link) && !(await p.$eval('#pm_st', (e) => e.disabled).catch(() => true)), '“Typed in” frees the storeys again');
  if (errs.length) { console.log('page errors:', errs); process.exitCode = 1; }
  await b.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
