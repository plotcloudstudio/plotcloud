// One model (2026-10-25): the Workspace has no Shaded view; imported meshes and the earlier Workspace's boxes live in Plan Studio's model
// (studio.imports, with their triangles in draft.meshes), every pane draws them, they can be picked, moved, hidden by layer and deleted,
// a saved draft stays saved after the move, versions keep them, and the context blocks still cast shadows in Sun hours.
// Run with a static server on 8765 (python3 -m http.server 8765 --bind 127.0.0.1); TEST_BASE overrides it.
const { chromium } = require('playwright'); const fs = require('fs'), os = require('os');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const B = (process.env.TEST_BASE || 'http://127.0.0.1:8765') + '/mvp/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }), p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const W = (role, fn, arg) => p.evaluate(([role, fn, arg]) => { const w = document.getElementById({ plan: 'fPlan', persp: 'fPersp', props: 'fProps' }[role]).contentWindow; return (new Function('w', 'arg', 'return (' + fn + ')(w, arg)'))(w, arg); }, [role, fn.toString(), arg]);
  const P = (x, y) => p.evaluate(([x, y]) => { const f = document.getElementById('fPlan'), w = f.contentWindow, fr = f.getBoundingClientRect(), cv = w.document.getElementById('cv').getBoundingClientRect(), q = w.__st.toPx([x, y]); return [fr.left + cv.left + q[0], fr.top + cv.top + q[1]]; }, [x, y]);
  const open = async () => { for (let i = 0; i < 80; i++) { await p.waitForTimeout(400); if (await p.evaluate(() => window.__ws2 && window.__ws2.ready())) break; } await p.waitForTimeout(800); };
  await p.goto(B); await p.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('plotcloud'); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ view: 'shaded', ws3: 1 })); }); await p.goto(B + '#/'); await p.reload(); await p.waitForTimeout(600);
  const before = await p.evaluate(async () => { const S = await import('./js/store.js'), pr = S.projects()[0]; return { boxes: pr.draft.components.filter((c) => ['mass', 'terrain'].includes(c.type)).map((c) => c.name), clean: JSON.stringify(pr.versions.at(-1).model) === JSON.stringify(pr.draft) }; });
  await p.goto(B + '#/workspace'); await open();
  ok(await p.evaluate(() => document.querySelector('.w3-pane.on').dataset.pane) === 'persp', 'a Workspace remembered on the Shaded view opens on Perspective');
  ok(await p.evaluate(() => { document.getElementById('vBtn').click(); const r = [...document.querySelectorAll('#vMenu [data-view]')].map((x) => x.dataset.view); document.getElementById('vBtn').click(); return !r.includes('shaded') && r.includes('persp'); }), 'the view menu has no Shaded model');
  const after = await p.evaluate(async () => { const S = await import('./js/store.js'), pr = S.projects()[0], m = pr.draft; return { imps: (m.studio.imports || []).map((o) => [o.name, o.type, o.layer]), left: m.components.filter((c) => !/^ps:/.test(c.id) && ['mass', 'terrain'].includes(c.type)).length, meshes: Object.keys(m.meshes || {}).length, clean: JSON.stringify(pr.versions.at(-1).model) === JSON.stringify(pr.draft) }; });
  ok(before.boxes.length >= 3 && before.boxes.every((n) => after.imps.some((i) => i[0] === n)) && after.left === 0 && after.meshes >= before.boxes.length, `the earlier Workspace's boxes (${before.boxes.join(', ')}) moved into Plan Studio's model as box meshes`);
  ok(await W('persp', (w) => w.__imp.list.length >= 3 && w.__imp.list.every((o) => w.__imp.meshOf(o))), 'Perspective has them with their triangles');
  // the context blocks still cast shadows (the Workspace scene for Sun hours, wind, noise)
  const ctx = await p.evaluate(async () => { const S = await import('./js/store.js'), { sunScene } = await import('./js/sunscene.js'), pr = S.projects()[0]; return sunScene(pr.draft, S.siteOf(pr)).masses.filter((m) => m.role === 'context').map((m) => m.id).length; });
  ok(ctx === 2, `the two neighbouring blocks are still context in the Workspace's scene (${ctx})`);
  ok(await W('plan', (w) => w.__st.sunScene().masses.filter((m) => m.role === 'context').length) === 2, '…and in Plan Studio’s own Sun hours scene');
  // an older project with a box kept beside Plan Studio's model, saved: it moves in and stays saved
  await p.evaluate(async () => { const S = await import('./js/store.js'), pr = S.projects()[0]; S.saveVersion(pr, 'clean'); const box = { id: 'c_old_box', name: 'Old shed', type: 'mass', layer: 'Context', g: { x: -6, y: -6, z: 0, w: 3, d: 2, h: 2.5 }, mat: 'Context' };
    pr.draft.components.push(JSON.parse(JSON.stringify(box))); pr.versions.at(-1).model.components.push(JSON.parse(JSON.stringify(box))); S.save(); });
  await p.goto(B + '#/home'); await p.waitForTimeout(300); await p.goto(B + '#/workspace'); await open();
  const shed = await p.evaluate(async () => { const S = await import('./js/store.js'), pr = S.projects()[0]; return { moved: !!(pr.draft.studio.imports || []).find((o) => o.id === 'c_old_box') && !pr.draft.components.find((c) => c.id === 'c_old_box'), clean: JSON.stringify(pr.versions.at(-1).model.studio.imports) === JSON.stringify(pr.draft.studio.imports) && !!(pr.versions.at(-1).model.meshes || {}).c_old_box }; });
  ok(shed.moved && shed.clean, 'an older box moves into Plan Studio’s model, and a saved draft’s version moves with it (it stays saved)');
  // import an OBJ: it goes into Plan Studio's model
  const obj = 'o crate_box\nv 0 0 0\nv 2 0 0\nv 2 1 0\nv 0 1 0\nv 0 0 1\nv 2 0 1\nv 2 1 1\nv 0 1 1\nf 1 2 3 4\nf 5 6 7 8\nf 1 2 6 5\nf 2 3 7 6\nf 3 4 8 7\nf 4 1 5 8\n'; fs.writeFileSync(os.tmpdir() + '/crate.obj', obj);
  await p.click('[data-panel="project"]'); await p.click('[data-pacc="import"]'); await p.selectOption('#up', 'z'); await p.setInputFiles('#file', os.tmpdir() + '/crate.obj'); await p.waitForTimeout(1800);
  const crate = await p.evaluate(() => { const m = __ws2.model(), o = (m.studio.imports || []).find((x) => x.name === 'crate_box'); return o && { o, mesh: (m.meshes || {})[o.id]?.length, comp: m.components.some((c) => c.id === 'ps:imp:' + o.id) }; });
  ok(crate && crate.mesh === 12 * 9 && crate.comp, `an imported OBJ is in Plan Studio's model (${crate && crate.o.tris} triangles, on ${crate && crate.o.layer}) and in the layer tree`);
  ok(await W('persp', (w, id) => !!w.__imp.list.find((o) => o.id === id && w.__imp.meshOf(o)), crate.o.id), '…and the Perspective pane has it');
  // pick and move it in the Plan
  await p.click('[data-panel="mass"]'); await W('plan', (w) => w.document.querySelector('[data-tool="select"]').click());
  await p.click('#vBtn'); await p.click('#vMenu [data-view="plan"]'); await p.waitForTimeout(800);   // the Plan view (the Workspace opened on Perspective)
  await W('plan', (w) => { const f = w.document.getElementById('fitBtn'); if (f) f.click(); }); await p.waitForTimeout(500);
  // it landed on the house (imports drop at the origin): put it beside it from the Properties pane, then drag it
  await p.evaluate((id) => __ws2.hub.select('test', { k: 'imp', id }), crate.o.id); await p.waitForTimeout(800);
  const fp = p.frameLocator('#fProps'); await fp.locator('#pi_x').fill('-12'); await fp.locator('#pi_x').press('Enter'); await p.waitForTimeout(700); await fp.locator('#pi_y').fill('-4'); await fp.locator('#pi_y').press('Enter'); await p.waitForTimeout(1200);
  crate.o.g = await p.evaluate((id) => __ws2.model().studio.imports.find((o) => o.id === id).g, crate.o.id); ok(crate.o.g.x === -12 && crate.o.g.y === -4, 'its position can be typed in the Properties pane');
  const g0 = crate.o.g, c0 = await P(g0.x + 1, g0.y + 0.5), c1 = await P(g0.x + 4, g0.y + 0.5);
  await p.mouse.move(...c0); await p.mouse.down(); await p.mouse.move(...c1, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(1200);
  const g1 = await p.evaluate((id) => __ws2.model().studio.imports.find((o) => o.id === id).g, crate.o.id);
  ok(Math.abs(g1.x - g0.x - 3) < 0.1 && Math.abs(g1.y - g0.y) < 0.1, `it can be dragged in the Plan: x ${g0.x} → ${g1.x}`);
  ok(await W('persp', (w, id) => w.__imp.list.find((o) => o.id === id).g.x, crate.o.id) === g1.x, '…and Perspective follows');
  // the layer's eye hides it in the panes
  const li = await p.evaluate((L) => __ws2.model().layers.findIndex((l) => l.name === L), crate.o.layer);
  await p.evaluate((i) => document.querySelectorAll('#layers [data-vis]')[i].click(), li); await p.waitForTimeout(600);
  ok(await W('plan', (w, g) => { const h = w.__mass.hit([g.x + 1, g.y + 0.5]); return !h || h.k !== 'imp'; }, g1), `turning off the ${crate.o.layer} layer hides it (it cannot be picked)`);
  await p.evaluate((i) => document.querySelectorAll('#layers [data-vis]')[i].click(), li); await p.waitForTimeout(600);
  // save a version: the version keeps it and its triangles
  await p.evaluate(async () => { const S = await import('./js/store.js'); S.saveVersion(S.projects()[0], 'With a crate'); });
  ok(await p.evaluate(async (id) => { const S = await import('./js/store.js'), v = S.projects()[0].versions.at(-1).model; return !!v.studio.imports.find((o) => o.id === id) && v.meshes[id].length === 108; }, crate.o.id), 'a saved version keeps the import and its triangles');
  // delete it from Plan Studio's panel
  await p.mouse.click(...await P(g1.x + 1, g1.y + 0.5)); await p.waitForTimeout(500);
  const selk = await W('plan', (w) => w.__st.SEL && w.__st.SEL.k); ok(selk === 'imp', 'clicking it selects it in Plan Studio');
  await p.evaluate(() => { const f = document.getElementById('fProps').contentWindow.document.getElementById('pp_del') || document.getElementById('fPlan').contentWindow.document.getElementById('pp_del'); if (f) f.click(); }); await p.waitForTimeout(1200);
  ok(await p.evaluate((id) => !__ws2.model().studio.imports.find((o) => o.id === id), crate.o.id), 'Delete removes it from the model');
  // reload: everything is still there
  await p.reload(); await open();
  ok(await W('persp', (w) => w.__imp.list.length >= 3 && w.__imp.list.every((o) => w.__imp.meshOf(o))), 'after a reload the panes have the imports and their triangles again');
  if (errs.length) { console.log('page errors:', errs); process.exitCode = 1; } else ok(true, 'no page errors');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
