// Rhino round trip (2026-10-25): the Workspace's model written as .3dm and read back gives the same objects (names, layers, triangles,
// positions); a .3dm in millimetres comes in in metres; the import keeps a Rhino layer the project has. Uses rhino3dm from jsDelivr.
// Run with a static server on 8765 (python3 -m http.server 8765 --bind 127.0.0.1); TEST_BASE overrides it.
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const B = (process.env.TEST_BASE || 'http://127.0.0.1:8765') + '/mvp/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }), p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(B); await p.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('plotcloud'); }); await p.goto(B + '#/'); await p.reload(); await p.waitForTimeout(600);
  await p.goto(B + '#/workspace'); for (let i = 0; i < 80; i++) { await p.waitForTimeout(400); if (await p.evaluate(() => window.__ws2 && window.__ws2.ready())) break; } await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const X = await import('./js/export3d.js'), V = await import('./js/viewport.js'), model = __ws2.renderModel(), src = X.items(model);
    const blob = await X.make('3dm', model, 'Round trip'), back = await V.importModel(new File([blob], 'roundtrip.3dm'));
    const bb = (pos) => { const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i + k]); mx[k] = Math.max(mx[k], pos[i + k]); } return { mn, mx }; };
    const S = src.map(({ c, pos }) => ({ name: c.name, layer: c.layer, tris: pos.length / 9, ...bb(pos) })), g0 = [0, 1, 2].map((k) => Math.min(...S.map((s) => s.mn[k])));
    let worst = 0, named = 0, layered = 0; S.forEach((s, i) => { const c = back.components[i]; if (!c || c.name !== s.name) return; named++; if (c.srcLayer === s.layer) layered++;   // the file keeps the order objects were written in
      worst = Math.max(worst, Math.abs(c.g.x - (s.mn[0] - g0[0])), Math.abs(c.g.y - (s.mn[1] - g0[1])), Math.abs(c.g.z - (s.mn[2] - g0[2])), Math.abs(c.g.h - (s.mx[2] - s.mn[2]))); });
    // a file in millimetres: a 1000 mm cube on a layer called Walls
    const rh = await X.loadRhino(), doc = new rh.File3dm(); doc.settings().modelUnitSystem = rh.UnitSystem.Millimeters; const ly = new rh.Layer(); ly.name = 'Walls'; const li = doc.layers().add(ly);
    const m = new rh.Mesh(), P = [[0, 0, 0], [1000, 0, 0], [1000, 1000, 0], [0, 1000, 0], [0, 0, 1000], [1000, 0, 1000], [1000, 1000, 1000], [0, 1000, 1000]]; for (const q of P) m.vertices().add(...q);
    for (const [a, c, d, e] of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) m.faces().addQuadFace(a, c, d, e); m.normals().computeNormals();
    const at = new rh.ObjectAttributes(); at.name = 'Test cube'; at.layerIndex = li; doc.objects().add(m, at); const mm = await V.importModel(new File([doc.toByteArray()], 'cube_mm.3dm')); doc.delete();
    return { n: S.length, tris: S.reduce((a, s) => a + s.tris, 0), backN: back.components.length, backTris: back.triangles, named, layered, worst, cube: mm.components[0] && { name: mm.components[0].name, layer: mm.components[0].srcLayer, g: mm.components[0].g } };
  });
  console.log('  ' + JSON.stringify(r).slice(0, 300));
  ok(r.backN === r.n && r.backTris === r.tris, `every object comes back: ${r.backN} of ${r.n} objects, ${r.backTris} of ${r.tris} triangles`);
  ok(r.named === r.n && r.layered === r.n, `with its name and its layer (${r.named} named, ${r.layered} on their layer)`);
  ok(r.worst < 0.002, `and where it was (largest difference ${(r.worst * 1000).toFixed(2)} mm)`);
  ok(r.cube && r.cube.name === 'Test cube' && r.cube.layer === 'Walls' && Math.abs(r.cube.g.w - 1) < 1e-6 && Math.abs(r.cube.g.h - 1) < 1e-6, 'a .3dm in millimetres comes in in metres, with its object name and Rhino layer');
  // the Workspace's own import keeps the Rhino layer when the project has it
  const fs = require('fs'), os = require('os'); const bytes = await p.evaluate(async () => { const X = await import('./js/export3d.js'), rh = await X.loadRhino(), doc = new rh.File3dm(); doc.settings().modelUnitSystem = rh.UnitSystem.Meters; const ly = new rh.Layer(); ly.name = 'Furniture'; const li = doc.layers().add(ly);
    const m = new rh.Mesh(); for (const q of [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]) m.vertices().add(...q); m.faces().addQuadFace(0, 1, 2, 3); const at = new rh.ObjectAttributes(); at.name = 'zz_panel'; at.layerIndex = li; doc.objects().add(m, at); return Array.from(doc.toByteArray()); });
  fs.writeFileSync(os.tmpdir() + '/panel.3dm', Buffer.from(bytes));
  await p.click('[data-panel="project"]'); await p.click('[data-pacc="import"]'); await p.setInputFiles('#file', os.tmpdir() + '/panel.3dm'); await p.waitForTimeout(1800);
  ok(await p.evaluate(() => (__ws2.model().studio.imports || []).some((o) => o.name === 'zz_panel' && o.layer === 'Furniture')), 'imported in the Workspace, an object on a Rhino layer the project has stays on it (zz_panel → Furniture)');
  if (errs.length) { console.log('page errors:', errs); process.exitCode = 1; } else ok(true, 'no page errors');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
