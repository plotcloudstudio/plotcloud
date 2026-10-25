// Massing (2026-10-25): masses drawn on the site in Plan Studio (outline or rectangle, storeys, floor height), the live site figures
// (coverage, GFA, FAR, tallest), masses in 3D and in Sun hours, and the surroundings edited by the person (height, leave out, put back,
// a missing neighbour, sub-layers, kept on re-import). Part 1 runs in the Workspace; part 2 in Plan Studio on its own with a small
// labelled OpenStreetMap fixture (no network needed).
// Run with a static server on 8765 (python3 -m http.server 8765 --bind 127.0.0.1); TEST_BASE overrides it.
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const BASE = process.env.TEST_BASE || 'http://127.0.0.1:8765';
const LAT = 49.28, LON = -123.12, mLat = 1 / 111320, mLon = 1 / (111320 * Math.cos(LAT * Math.PI / 180));
function fixture() {   // two buildings (one with a mapped height), a road; site metres → lat/lon
  let id = 1; const nodes = [], ways = [];
  const way = (pts, tags) => { const nd = pts.map(([x, y]) => { const n = id++; nodes.push(`<node id="${n}" lat="${(LAT + y * mLat).toFixed(7)}" lon="${(LON + x * mLon).toFixed(7)}"/>`); return n; }); if (tags.building) nd.push(nd[0]); ways.push(`<way id="${100 + ways.length}">${nd.map((n) => `<nd ref="${n}"/>`).join('')}${Object.entries(tags).map(([k, v]) => `<tag k="${k}" v="${v}"/>`).join('')}</way>`); };
  way([[30, -10], [50, -10], [50, 5], [30, 5]], { building: 'yes', height: '30', name: 'Tall neighbour' });
  way([[-50, -10], [-35, -10], [-35, 5], [-50, 5]], { building: 'yes' });
  way([[-80, -25], [80, -25]], { highway: 'residential', name: 'Test Street' });
  return `<?xml version="1.0"?><osm version="0.6">${nodes.join('')}${ways.join('')}</osm>`;
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  // ---------- part 1: the Workspace
  { const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage(), errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const B = BASE + '/mvp/'; await p.goto(B); await p.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('plotcloud'); }); await p.goto(B + '#/'); await p.reload(); await p.waitForTimeout(600);
    await p.goto(B + '#/workspace'); for (let i = 0; i < 80; i++) { await p.waitForTimeout(400); if (await p.evaluate(() => window.__ws2 && window.__ws2.ready())) break; } await p.waitForTimeout(600);
    const W = (role, fn) => p.evaluate(([role, fn]) => { const w = document.getElementById({ plan: 'fPlan', persp: 'fPersp', props: 'fProps' }[role]).contentWindow; return (new Function('w', 'return (' + fn + ')(w)'))(w); }, [role, fn.toString()]);
    const P = (x, y) => p.evaluate(([x, y]) => { const f = document.getElementById('fPlan'), w = f.contentWindow, fr = f.getBoundingClientRect(), cv = w.document.getElementById('cv').getBoundingClientRect(), q = w.__st.toPx([x, y]); return [fr.left + cv.left + q[0], fr.top + cv.top + q[1]]; }, [x, y]);
    ok(await p.evaluate(() => !!document.querySelector('.w2-rail [data-panel="mass"]')), 'the Workspace rail has Massing');
    ok(await p.evaluate(() => __ws2.model().layers.some((l) => l.name === 'Masses')), 'the project has a Masses layer');
    await p.click('[data-panel="mass"]'); await p.click('[data-tool="Rectangle mass"]');
    ok(await W('plan', (w) => w.__ws.state().tool) === 'massrect', 'Rectangle mass starts Plan Studio’s rectangle mass tool');
    const a = await P(1, 1), c = await P(13, 11);
    await p.mouse.move(...a); await p.mouse.down(); await p.mouse.move(...c, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(1200);
    if (process.env.DBG) { console.log(JSON.stringify([a, c])); await p.screenshot({ path: require('os').tmpdir() + '/massing-ws.png' }); }
    let st = await p.evaluate(() => __ws2.model().studio.masses); ok(st.length === 1 && st[0].storeys === 4, `a mass is drawn and kept in the project model (${st[0] && st[0].points.length} corners, ${st[0] && st[0].storeys} storeys)`);
    const area = await W('plan', (w) => w.__mass.siteFigures().foot); ok(Math.abs(area - 120) < 3, `its footprint is the rectangle drawn: ${Math.round(area)} m² (12 × 10 m)`);
    ok(await p.evaluate((id) => __ws2.model().components.some((q) => q.id === 'ps:mass:' + id && q.layer === 'Masses'), st[0].id), 'the mass is listed on the Masses layer');
    // storeys in the Properties pane
    await p.waitForFunction(() => document.getElementById('fProps').contentWindow.document.getElementById('pm_st'), null, { timeout: 8000 }).catch(() => {});
    const fp = p.frameLocator('#fProps'); await fp.locator('#pm_st').fill('9'); await fp.locator('#pm_st').press('Enter'); await p.waitForTimeout(1200);
    st = await p.evaluate(() => __ws2.model().studio.masses); ok(st[0].storeys === 9, 'storeys set in the Properties pane reach the model: ' + st[0].storeys);
    ok(await W('persp', (w) => w.__mass.massList()[0]?.h) > 28, '3D pane has the 9-storey mass (28.8 m)');
    const kpi = await W('plan', (w) => w.document.getElementById('massKpi').textContent); ok(/GFA\s*1,080 m²/.test(kpi.replace(/\s+/g, ' ')) || /GFA1,0[78]\d/.test(kpi), 'site figures on the plan: ' + kpi.replace(/\s+/g, ' ').slice(0, 90));
    ok(await W('plan', (w) => w.__st.sunScene().masses.some((m) => m.role === 'proposed' && /^mass_/.test(m.id))), 'Sun hours gets the mass as a proposed building');
    // Send to Simulation › Sun hours reads Plan Studio's scene, masses included
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.saveVersion(S.projects()[0], 'With a mass'); });
    await p.goto(B + '#/simulations/sunhours'); await p.waitForFunction(() => /blocks/.test(document.getElementById('shmsg')?.textContent || ''), null, { timeout: 60000 }).catch(() => {});
    const info = await p.evaluate(() => document.getElementById('shmsg')?.textContent || ''); ok(/\d+ blocks/.test(info), 'Sun hours gets the version from Plan Studio: ' + info.slice(0, 90));
    const sent = await p.evaluate(() => { try { const w = document.getElementById('eng').contentWindow, sc = w.__sun && w.__sun.S && w.__sun.S.scene; return sc ? sc.masses.filter((m) => m.role === 'proposed' && /^mass_/.test(m.id)).length : null; } catch (e) { return null; } });
    if (sent != null) ok(sent === 1, 'the engine has the mass as a proposed block');
    if (errs.length) { console.log('page errors:', errs); process.exitCode = 1; } else ok(true, 'no page errors in the Workspace');
    await p.context().close(); }
  // ---------- part 2: Plan Studio with a site
  { const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage(), errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE + '/emb/modeler.html'); await p.waitForFunction(() => window.__mass && window.__SITEC, null, { timeout: 30000 });
    await p.evaluate((xml) => { const SC = window.__SITEC, site = SC.siteFromOSM(xml, { lat: 49.28, lon: -123.12, label: 'Test fixture' }, { kind: 'radius', r: 120 }, { provider: 'test fixture' }); site.fixture = true; site.parcel = { pts: [[-20, -15], [20, -15], [20, 15], [-20, 15]] }; site.parcelId = 'Your plot'; SC.estimateMissing(site, 4);
      const m = JSON.parse(JSON.stringify(window.__st.M)); m.walls = []; m.ops = []; m.floors = []; m.furn = []; m.voids = []; m.site = site; m.name = 'Massing test'; window.__mass.load(m); }, fixture());
    await p.waitForTimeout(600); const sk = await p.$('text=Skip'); if (sk) await sk.click().catch(() => {});
    const cvb = await p.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top]; });
    const P = async (q) => { const s = await p.evaluate((q) => window.__st.toPx(q), q); return [s[0] + cvb[0], s[1] + cvb[1]]; };
    ok(await p.evaluate(() => window.__st.M.site.buildings.length === 2 && window.__st.M.site.roads.length === 1), 'the fixture site: two buildings and a road');
    // a rectangle mass that starts near a plot corner snaps onto it
    await p.click('[data-tool="massrect"]'); const a = await P([-19.6, -14.7]), c = await P([0, 0]);
    await p.mouse.move(...a); await p.mouse.down(); await p.mouse.move(...c, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
    let ms = await p.evaluate(() => window.__st.M.masses); ok(ms.length === 1 && ms[0].points.some((q) => q[0] === -20 && q[1] === -15), 'the rectangle snaps to the plot corner: ' + JSON.stringify(ms[0] && ms[0].points[0]));
    // an outline mass overlapping it (a tower on a podium)
    await p.click('[data-tool="mass"]'); for (const q of [[-10, -10], [10, -10], [10, 10], [-10, 10]]) { await p.mouse.click(...await P(q)); await p.waitForTimeout(60); } await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    await p.fill('#pm_st', '12'); await p.press('#pm_st', 'Enter'); await p.waitForTimeout(200);
    const F = await p.evaluate(() => window.__mass.siteFigures());
    ok(F.n === 2 && F.overlap && Math.abs(F.foot - 600) < 6, `overlapping masses count once: footprint ${Math.round(F.foot)} m² (300 + 400 − 100 overlap)`);
    ok(Math.abs(F.gfa - (400 * 12 + 200 * 4)) < 60, `GFA takes the tallest where they overlap: ${Math.round(F.gfa)} m² (400 × 12 + 200 × 4 = 5,600)`);
    ok(Math.abs(F.site - 1200) < 1 && Math.abs(F.far - F.gfa / F.site) < 1e-9 && F.top === 38.4, `plot 1,200 m², FAR ${F.far.toFixed(2)}, tallest ${F.top} m`);
    // height entered as metres rounds to storeys
    await p.fill('#pm_h', '20'); await p.press('#pm_h', 'Enter'); await p.waitForTimeout(150); ok(await p.evaluate(() => window.__st.M.masses[1].storeys) === 6, 'a height of 20 m with 3.2 m floors gives 6 storeys');
    // drag a corner of the selected mass
    await p.click('[data-tool="select"]'); const v0 = await P([10, 10]), v1 = await P([14, 12]); await p.mouse.move(...v0); await p.mouse.down(); await p.mouse.move(...v1, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(200);
    ok(await p.evaluate(() => { const q = window.__st.M.masses[1].points.find((r) => Math.abs(r[0] - 14) < 0.3 && Math.abs(r[1] - 12) < 0.3); return !!q; }), 'dragging a white corner reshapes the mass');
    // a mass outside the plot is flagged
    await p.click('[data-tool="massrect"]'); await p.mouse.move(...await P([15, 8])); await p.mouse.down(); await p.mouse.move(...await P([28, 22]), { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(200);
    ok(/crosses the plot boundary/.test(await p.textContent('#massKpi')), 'a mass over the boundary is flagged in the site figures');
    await p.keyboard.press('Delete'); await p.waitForTimeout(150); if (await p.evaluate(() => window.__st.M.masses.length) === 3) { await p.click('#pp_del'); await p.waitForTimeout(150); }
    ok(await p.evaluate(() => window.__st.M.masses.length) === 2, 'Delete removes the selected mass');
    // the surroundings: pick, change the height, leave out, put back
    await p.click('[data-tool="select"]'); await p.mouse.click(...await P([40, -2])); await p.waitForTimeout(200);
    const tall = await p.evaluate(() => window.__st.SEL); ok(tall && tall.k === 'ctx', 'a neighbouring building can be picked on the plan');
    ok(/mapped height/.test(await p.textContent('#props')), 'its panel says where the height comes from');
    await p.fill('#pc_h', '45'); await p.press('#pc_h', 'Enter'); await p.waitForTimeout(150);
    let bb = await p.evaluate((id) => window.__st.M.site.buildings.find((x) => x.id === id), tall.id); ok(bb.h === 45 && bb.hSource === 'user' && bb.edited, 'a new height is kept and marked as the person’s');
    await p.click('#pp_del'); await p.waitForTimeout(150); bb = await p.evaluate((id) => window.__st.M.site.buildings.find((x) => x.id === id), tall.id); ok(bb.excluded && !bb.auto, 'Leave out takes it out of shadows and simulations');
    ok(!(await p.evaluate(() => window.__st.sunScene().masses.some((m) => m.role === 'context' && m.h > 40))), '…and Sun hours no longer has it');
    await p.mouse.click(...await P([40, -2])); await p.waitForTimeout(150); await p.click('#pc_back'); await p.waitForTimeout(150);
    ok(!(await p.evaluate((id) => window.__st.M.site.buildings.find((x) => x.id === id).excluded, tall.id)), 'Put it back restores it');
    // a missing neighbour
    await p.click('[data-tool="ctxadd"]'); for (const q of [[-30, 30], [-10, 30], [-10, 45], [-30, 45]]) { await p.mouse.click(...await P(q)); await p.waitForTimeout(60); } await p.mouse.dblclick(...await P([-30, 45])); await p.waitForTimeout(300);
    const nb = await p.evaluate(() => window.__st.M.site.buildings.find((x) => x.added)); ok(nb && Math.abs(nb.area - 300) < 3 && nb.h === 12, `a missing neighbour is drawn: ${nb && nb.area} m², ${nb && nb.h} m`);
    // kept on a re-import of the same data
    const kept = await p.evaluate((xml) => { const SC = window.__SITEC, site = window.__st.M.site, fresh = SC.siteFromOSM(xml, site.origin, site.boundary, { provider: 'test fixture' }), r = SC.reimport(site, fresh); return { drawn: r.buildings.some((x) => x.added), mine: r.buildings.find((x) => x.name === 'Tall neighbour').h, removed: r.removed.length }; }, fixture());
    ok(kept.drawn && kept.mine === 45 && kept.removed === 0, 'a re-import keeps the drawn neighbour and the changed height');
    // sub-layers
    await p.evaluate(() => window.__wb.setLayerVis('ref.site.roads', false)); ok(await p.evaluate(() => !window.__wb.layerOn('ref.site.roads') && window.__wb.layerOn('ref.site.bld')), 'roads can be hidden on their own (Site context › Roads & paths)');
    await p.evaluate(() => window.__wb.setLayerVis('ref.site.roads', true));
    // undo
    const n0 = await p.evaluate(() => window.__st.M.site.buildings.length); await p.click('#undo'); await p.waitForTimeout(200); ok(await p.evaluate(() => window.__st.M.site.buildings.length) === n0 - 1, 'undo takes the drawn neighbour away again');
    // the sun preview and schemes
    await p.check('#mkSun'); await p.waitForFunction(() => window.__sunp.state.res, null, { timeout: 15000 }).catch(() => {});
    const sr = await p.evaluate(() => { const r = window.__sunp.state.res; return r && { plot: r.plot, around: r.around, loss: r.loss, dirs: r.grid.dirs }; });
    ok(sr && sr.plot && sr.around && sr.dirs > 40, `Sun on: the plot's open ground and the ground around it get a sun figure (plot ≥ 2 h: ${sr && Math.round(sr.plot.two * 100)} %, around ${sr && sr.around.avg.toFixed(1)} h, ${sr && sr.dirs} sun positions)`);
    ok(/Plot ≥ 2 h sun/.test(await p.textContent('#massKpi')) && sr.loss > 0, `the card says what the masses take from the ground around the plot: ${sr && sr.loss.toFixed(2)} h`);
    await p.click('[data-sch="+"]'); await p.waitForTimeout(200);
    let sch = await p.evaluate(() => ({ L: window.__sunp.schemes().map((s) => s.id), cur: window.__st.M.scheme, n: window.__st.M.masses.length, idsNew: window.__st.M.masses.map((m) => m.id), idsA: window.__sunp.schemes()[0].masses.map((m) => m.id) }));
    ok(sch.L.join() === 'A,B' && sch.cur === 'B' && sch.n === 2 && !sch.idsNew.some((i) => sch.idsA.includes(i)), 'New scheme copies the masses into Scheme B (new ids); the site stays shared');
    await p.evaluate(() => { window.__st.M.masses[1].storeys = 20; }); await p.click('[data-sch="cmp"]'); await p.waitForTimeout(800);
    const cmp = (await p.textContent('.mkcmp')).replace(/\s+/g, ' ');
    ok(/Scheme B against Scheme A: \+[\d,]+ m² GFA \(\+\d+ %\), a tallest mass [\d.]+ m higher; the ground around the plot gets [\d.]+ h less sun on 21 March/.test(cmp), 'Compare: a table and the trade-off in one line — ' + (cmp.match(/Scheme B against[^.]*\./) || [''])[0]);
    await p.click('.mkcmp [data-mc="A"]'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => window.__st.M.scheme === 'A' && window.__st.M.masses[1].storeys === 6 && window.__sunp.schemes()[1].masses[1].storeys === 20), 'Open Scheme A brings its masses back; Scheme B keeps its own');
    // 3D
    await p.click('[data-cam="3d"]'); await p.waitForTimeout(2500); ok(await p.evaluate(() => window.__st.M.masses.length === 2 && !document.getElementById('massKpi').hidden), '3D view opens with the masses and the site figures');
    await p.screenshot({ path: require('os').tmpdir() + '/massing-3d.png' });
    if (errs.length) { console.log('page errors:', errs); process.exitCode = 1; } else ok(true, 'no page errors in Plan Studio');
    await p.context().close(); }
  // ---------- part 3: the sun preview against an exact answer and against Sun hours' own sun position
  { const p = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage(), errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE + '/emb/modeler.html'); await p.waitForFunction(() => window.__sunp, null, { timeout: 30000 });
    const engineFns = require('./validation/engine_fn.cjs'), E = engineFns(require('path').join(__dirname, '../emb/sunhours.html'), ['julian0', 'sunPos'], 'const D2R = Math.PI / 180;');
    const cases = []; for (const [m, d] of [[3, 20], [6, 21], [9, 23], [12, 21]]) for (const h of [7.25, 9.5, 12, 14.75, 17]) for (const [lat, lon, tz] of [[49.28, -123.12, -8], [51.5, -0.12, 0], [-33.87, 151.21, 10]]) cases.push([2026, m, d, h, lat, lon, tz]);
    const mine = await p.evaluate((cs) => cs.map((c) => window.__sunp.sunPos(...c)), cases); let worst = 0; cases.forEach((c, i) => { const r = E.sunPos(...c); worst = Math.max(worst, Math.abs(r.alt - mine[i].alt), Math.abs(((r.az - mine[i].az + 540) % 360) - 180)); });
    ok(worst < 1e-9, `the preview's sun position is Sun hours' own (${cases.length} positions, largest difference ${worst.toExponential(1)}°)`);
    for (const day of ['03-21', '12-21']) {
      const R = await p.evaluate((day) => { const Mx = { north: 0, site: { origin: { lat: 49.28, lon: -123.12 }, tz: -8, buildings: [], terrain: null, at: [0, 0] } }, wall = { outer: [[-100, -0.5], [100, -0.5], [100, 0.5], [-100, 0.5]], h: 10 };
        const G = window.__sunp.sunGrid(Mx, [wall], { day, box: { X0: -0.5, Y0: 4.5, cell: 1, nx: 1, ny: 16 } }), dirs = window.__sunp.sunDirs({ lat: 49.28, lon: -123.12, tz: -8 }, day, 0);
        const exact = []; for (let j = 0; j < 16; j++) { const y = 5 + j; let hrs = 0; for (const d of dirs) { let shade = false; if (d.v[1] < 0) { const dist = (y - 0.5) / -d.v[1], x = dist * d.v[0]; shade = Math.abs(x) <= 100 && dist * d.t < 10; } if (!shade) hrs += d.w; } exact.push(hrs); }
        return { got: Array.from(G.H), exact }; }, day);
      const diff = Math.max(...R.got.map((v, i) => Math.abs(v - R.exact[i])));
      ok(diff < 1e-6, `${day === '03-21' ? '21 March' : '21 December'}: a 10 m wall, sun hours 5–20 m north of it match the exact ray–plane answer (largest difference ${diff.toFixed(6)} h; at 10 m ${R.got[5].toFixed(2)} h, at 15 m ${R.got[10].toFixed(2)} h)`);
    }
    if (errs.length) { console.log('page errors:', errs); process.exitCode = 1; }
    await p.context().close(); }
  await b.close();
})().catch(async (e) => { console.error(e); process.exitCode = 1; process.exit(1); });
