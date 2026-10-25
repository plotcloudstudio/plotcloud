// From a mass to floors (2026-10-25): Make floors gives one level per storey with the outline as walls (a room each) and windows,
// the mass stays as the scheme's record (figures) but the walls stand for it in 3D and Sun hours, room simulations can run, Undo takes
// it back; the breadcrumb (Site › Mass › Level); the Workspace's rail points to the next step; simulations say what depth they need.
// Run with a static server on 8765 (python3 -m http.server 8765 --bind 127.0.0.1); TEST_BASE overrides it.
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const BASE = process.env.TEST_BASE || 'http://127.0.0.1:8765';
const LAT = 49.28, LON = -123.12, mLat = 1 / 111320, mLon = 1 / (111320 * Math.cos(LAT * Math.PI / 180));
function fixture() { let id = 1; const nodes = [], ways = [];
  const way = (pts, tags) => { const nd = pts.map(([x, y]) => { const n = id++; nodes.push(`<node id="${n}" lat="${(LAT + y * mLat).toFixed(7)}" lon="${(LON + x * mLon).toFixed(7)}"/>`); return n; }); if (tags.building) nd.push(nd[0]); ways.push(`<way id="${100 + ways.length}">${nd.map((n) => `<nd ref="${n}"/>`).join('')}${Object.entries(tags).map(([k, v]) => `<tag k="${k}" v="${v}"/>`).join('')}</way>`); };
  way([[40, -10], [60, -10], [60, 5], [40, 5]], { building: 'yes', height: '30' }); way([[-80, -25], [80, -25]], { highway: 'residential' });
  return `<?xml version="1.0"?><osm version="0.6">${nodes.join('')}${ways.join('')}</osm>`; }
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  { const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage(), errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE + '/emb/modeler.html'); await p.waitForFunction(() => window.__floors && window.__SITEC, null, { timeout: 30000 });
    await p.evaluate((xml) => { const SC = window.__SITEC, site = SC.siteFromOSM(xml, { lat: 49.28, lon: -123.12, label: 'Test fixture, Vancouver' }, { kind: 'radius', r: 120 }, { provider: 'test fixture' }); site.fixture = true; site.parcel = { pts: [[-15, -12], [15, -12], [15, 12], [-15, 12]] };
      const m = JSON.parse(JSON.stringify(window.__st.M)); for (const k of ['walls', 'ops', 'floors', 'furn', 'voids']) m[k] = []; m.levels = [{ id: 'L1', name: 'Ground', z: 0, h: 2.7 }]; m.site = site; m.name = 'Floors test'; window.__mass.load(m);
      window.__mass.addMass([[-10, -7.5], [10, -7.5], [10, 7.5], [-10, 7.5]]); }, fixture());
    await p.waitForTimeout(500); const sk = await p.$('text=Skip'); if (sk) await sk.click().catch(() => {});
    ok(/Floors test|Test fixture/.test(await p.textContent('.crumbs')) && /Mass 1/.test(await p.textContent('.crumbs')), 'the breadcrumb shows the site and the selected mass: ' + (await p.textContent('.crumbs')).replace(/\s+/g, ' '));
    ok(await p.isVisible('#pm_floors'), 'the mass panel offers Make floors');
    const sun0 = await p.evaluate(() => window.__st.sunScene().masses.filter((m) => m.role === 'proposed').map((m) => m.id));
    await p.click('#pm_floors'); await p.waitForTimeout(600);
    const R = await p.evaluate(() => { const M = window.__st.M, S = window.__st.S; return { lv: M.levels.map((l) => [l.z, l.h]), walls: M.walls.length, ops: M.ops.filter((o) => o.kind === 'win').length, rooms: S.rooms.length, floors: M.masses[0].floors, fig: window.__mass.siteFigures().gfa, ml: window.__mass.massList().length }; });
    ok(R.lv.length === 4 && R.lv.every(([z], i) => Math.abs(z - i * 3.2) < 1e-6) && R.lv.every(([, h]) => Math.abs(h - 2.9) < 1e-6), 'four levels, 3.2 m apart, ceilings 2.9 m: ' + JSON.stringify(R.lv));
    ok(R.walls === 16 && R.rooms === 4, `the outline is the outer walls on every level (${R.walls} walls), a room each (${R.rooms} rooms)`);
    ok(R.ops === 4 * (6 + 5 + 6 + 5), `windows along the walls, one per 3 m bay (${R.ops})`);
    ok(R.floors && R.floors.levels.length === 4 && Math.abs(R.fig - 1200) < 1 && R.ml === 0, 'the mass keeps its figures (GFA 1,200 m²) but no longer draws as a block');
    const sun1 = await p.evaluate(() => window.__st.sunScene().masses.filter((m) => m.role === 'proposed'));
    ok(sun0.length === 1 && sun1.length === 4 && !sun1.some((m) => /^mass_/.test(m.id)) && Math.abs(Math.max(...sun1.map((m) => m.h)) - 12.5) < 0.6, `Sun hours now takes the four storeys from the walls instead of the block (${sun1.length} blocks, top ${Math.max(...sun1.map((m) => m.h)).toFixed(1)} m)`);
    const dl = await p.evaluate(() => { const t = window.__pcWorkflow.toolScene('daylight', 'L1'); return { ok: t.ok, why: t.why }; });
    ok(dl.ok, 'room simulations can run now: Daylight takes the ground floor' + (dl.ok ? '' : ' — ' + JSON.stringify(dl.why)));
    await p.check('#mkSun').catch(() => {}); await p.waitForFunction(() => window.__sunp.state.res, null, { timeout: 15000 }).catch(() => {});
    ok(await p.evaluate(() => { const r = window.__sunp.state.res; return !!(r && r.loss > 0); }), 'the sun preview still has the building (it takes sun from the ground around)');
    const cr = (await p.textContent('.crumbs')).replace(/\s+/g, ' '); ok(/Mass 1 · 4 fl\./.test(cr) && await p.isVisible('.crumbs select'), 'breadcrumb: Site › Mass 1 · 4 fl. › level picker — ' + cr);
    const top = await p.evaluate(() => window.__st.M.levels.find((l) => l.z > 9).id); await p.selectOption('.crumbs select', top); await p.waitForTimeout(200);
    ok(await p.evaluate(() => window.__st.LV) === top, 'the level picker in the breadcrumb changes the level');
    await p.click('.crumbs [data-cr="site"]'); await p.waitForTimeout(200); ok(await p.evaluate(() => !window.__st.SEL), 'Site in the breadcrumb shows the whole site');
    await p.click('#undo'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => { const M = window.__st.M; return M.levels.length === 1 && M.walls.length === 0 && !M.masses[0].floors; }), 'Undo takes the floors back');
    if (errs.length) { console.log('page errors:', errs); process.exitCode = 1; } else ok(true, 'no page errors in Plan Studio');
    await p.context().close(); }
  // the Workspace and the simulations
  { const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage(), errs = [];
    p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept('Empty site'));
    const B = BASE + '/mvp/'; await p.goto(B); await p.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('plotcloud'); }); await p.goto(B + '#/'); await p.reload(); await p.waitForTimeout(600);
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.account().user = { name: 'T', email: 't@x.com', since: new Date().toISOString() }; S.save(); });
    await p.goto(B + '#/home'); await p.waitForTimeout(500); await p.click('#newBtn'); await p.click('[data-new="blank"]');
    for (let i = 0; i < 80; i++) { await p.waitForTimeout(400); if (await p.evaluate(() => window.__ws2 && window.__ws2.ready && window.__ws2.ready())) break; } await p.waitForTimeout(800);
    ok(await p.evaluate(() => document.querySelector('.w2-rail [data-panel="mass"]').classList.contains('w2-next')), 'an empty project: the rail marks Massing as the place to start');
    await p.evaluate(async () => { const w = document.getElementById('fPlan').contentWindow; w.__mass.addMass([[0, 0], [20, 0], [20, 12], [0, 12]]); }); await p.waitForTimeout(1500);
    ok(await p.evaluate(() => document.querySelector('.w2-rail [data-panel="draw"]').classList.contains('w2-next') && /Make floors/.test(document.querySelector('.w2-rail [data-panel="draw"]').title)), 'with a mass and no walls: the rail points to Make floors (Draw room)');
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.saveVersion(S.projects()[0], 'a mass'); });
    await p.goto(B + '#/simulations'); await p.waitForTimeout(800);
    const chips = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-sim]')].map((c) => [c.dataset.sim, (c.querySelector('.rdy') || {}).textContent || ''])));
    ok(/Ready/.test(chips.sunhours) && /rooms/i.test(chips.daylight), `the Simulations page says what each one needs from this project (Sun hours: "${chips.sunhours}", Daylight: "${chips.daylight}")`);
    await p.goto(B + '#/simulations/daylight'); await p.waitForFunction(() => /Make floors/.test(document.getElementById('shmsg')?.textContent || ''), null, { timeout: 40000 }).catch(() => {});
    ok(/Make floors/.test(await p.evaluate(() => document.getElementById('shmsg')?.textContent || '')), 'Daylight on a version with only a mass says how to get rooms: ' + (await p.evaluate(() => document.getElementById('shmsg')?.textContent || '')).slice(0, 140));
    if (errs.length) { console.log('page errors:', errs); process.exitCode = 1; } else ok(true, 'no page errors in the Workspace');
    await p.context().close(); }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
