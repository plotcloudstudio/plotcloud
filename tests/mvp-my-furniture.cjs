// My furniture (2026-10-25): import a piece (an OBJ in centimetres), it joins My furniture with a picture like the library's, is placed
// by clicking in the Plan (two of them share one mesh), turns, sits on the level, is in Perspective and in a saved version, survives a
// reload, and can be removed from the list. No network needed.
// Run with a static server on 8765 (python3 -m http.server 8765 --bind 127.0.0.1); TEST_BASE overrides it.
const { chromium } = require('playwright'); const fs = require('fs'), os = require('os');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const B = (process.env.TEST_BASE || 'http://127.0.0.1:8765') + '/mvp/';
function stool() { const v = [], f = []; const box = (x0, y0, z0, x1, y1, z1) => { const b = v.length; for (const p of [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]) v.push(p); for (const q of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) f.push(q.map((i) => b + i + 1)); };
  box(0, 42, 0, 60, 46, 40); for (const [x, z] of [[2, 2], [54, 2], [2, 34], [54, 34]]) box(x, 0, z, x + 4, 42, z + 4);   // y up, centimetres: a 60 × 40 cm bench, 46 cm high
  return 'o bench\n' + v.map((p) => `v ${p.join(' ')}`).join('\n') + '\n' + f.map((q) => `f ${q.join(' ')}`).join('\n') + '\n'; }
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }), p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  const W = (role, fn, arg) => p.evaluate(([role, fn, arg]) => { const w = document.getElementById({ plan: 'fPlan', persp: 'fPersp', props: 'fProps' }[role]).contentWindow; return (new Function('w', 'arg', 'return (' + fn + ')(w, arg)'))(w, arg); }, [role, fn.toString(), arg]);
  const P = (x, y) => p.evaluate(([x, y]) => { const f = document.getElementById('fPlan'), w = f.contentWindow, fr = f.getBoundingClientRect(), cv = w.document.getElementById('cv').getBoundingClientRect(), q = w.__st.toPx([x, y]); return [fr.left + cv.left + q[0], fr.top + cv.top + q[1]]; }, [x, y]);
  const open = async () => { for (let i = 0; i < 80; i++) { await p.waitForTimeout(400); if (await p.evaluate(() => window.__ws2 && window.__ws2.ready())) break; } await p.waitForTimeout(800); };
  await p.goto(B); await p.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('plotcloud'); }); await p.goto(B + '#/'); await p.reload(); await p.waitForTimeout(600);
  await p.goto(B + '#/workspace'); await open();
  await p.click('[data-panel="furniture"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => /My furniture/.test(document.querySelector('#panelBody').textContent) && !!document.querySelector('[data-impfurn]')), 'Furniture opens with My furniture and an Import furniture card');
  fs.writeFileSync(os.tmpdir() + '/garden_bench.obj', stool());
  await p.setInputFiles('#furnFile', os.tmpdir() + '/garden_bench.obj'); await p.waitForFunction(() => document.querySelector('[data-myfurn]'), null, { timeout: 20000 }).catch(() => {});
  const lib = await p.evaluate(async () => { const S = await import('./js/store.js'); return (S.account().furniture || []).map(({ mesh, thumb, ...x }) => ({ ...x, thumb: (thumb || '').slice(0, 22), tl: (thumb || '').length })); });
  console.log('  ' + JSON.stringify(lib[0]) + ' · ' + (await p.textContent('#toolMsg')));
  ok(lib.length === 1 && lib[0].name === 'Garden bench' && lib[0].unit === 'centimetres' && Math.abs(lib[0].w - 0.6) < 1e-6 && Math.abs(lib[0].d - 0.4) < 1e-6 && Math.abs(lib[0].h - 0.46) < 1e-6, 'the piece joins My furniture, read as centimetres: 0.6 × 0.4 × 0.46 m');
  ok(lib[0].thumb.startsWith('data:image/png') && lib[0].tl > 2000, 'with a picture made like the library’s (260 × 200 PNG)');
  const card = await p.evaluate(() => { const im = document.querySelector('[data-myfurn] img'); return im && [im.naturalWidth, im.naturalHeight]; }); ok(card && card[0] === 260 && card[1] === 200, 'the card shows it at the library’s size: ' + JSON.stringify(card));
  await p.screenshot({ path: os.tmpdir() + '/myfurn-panel.png', clip: { x: 0, y: 40, width: 420, height: 520 } });
  // place two
  await p.click('[data-myfurn]'); await p.waitForTimeout(300); ok(await W('plan', (w) => w.__ws.state().impPend) === lib[0].id, 'clicking the card starts placing it');
  for (const [x, y] of [[-3, 3], [-3, 5]]) { await p.mouse.click(...await P(x, y)); await p.waitForTimeout(500); }
  await p.keyboard.press('Escape'); await p.waitForTimeout(800); await p.click('#vBtn'); await p.click('#vMenu [data-view="persp"]'); await p.waitForTimeout(1500); await p.screenshot({ path: os.tmpdir() + '/myfurn-3d.png' }); await p.click('#vBtn'); await p.click('#vMenu [data-view="plan"]'); await p.waitForTimeout(600);
  const placed = await p.evaluate((ref) => { const m = __ws2.model(); return { list: (m.studio.imports || []).filter((o) => o.ref === ref), meshes: Object.keys(m.meshes || {}).filter((k) => k === ref).length, comps: m.components.filter((c) => /^ps:imp:/.test(c.id) && c.layer === 'Furniture').length }; }, lib[0].id);
  ok(placed.list.length === 2 && placed.meshes === 1, `two benches placed, sharing one mesh in the project (${placed.list.length} placed, ${placed.meshes} mesh)`);
  ok(placed.list.every((o) => o.lv === 'L1' && o.g.z === 0 && o.layer === 'Furniture') && Math.abs(placed.list[0].g.x + placed.list[0].g.w / 2 + 3) < 0.06, 'each on the level’s floor, centred where it was clicked, on the Furniture layer');
  ok(placed.comps >= 2, 'the layer tree lists them under Furniture');
  ok(await W('plan', (w) => w.__ws.state().impPend) === null, 'Esc stops placing');
  // turn one
  const id = placed.list[1].id; await p.evaluate((id) => __ws2.hub.select('test', { k: 'imp', id }), id); await p.waitForTimeout(600);
  await p.frameLocator('#fProps').locator('#pi_turn').click(); await p.waitForTimeout(900);
  const t = await p.evaluate((id) => __ws2.model().studio.imports.find((o) => o.id === id), id);
  ok(t.rot === 1 && Math.abs(t.g.w - 0.4) < 1e-6 && Math.abs(t.g.d - 0.6) < 1e-6, `Turn 90° turns it (now ${t.g.w} × ${t.g.d} m)`);
  ok(await W('persp', (w, id) => { const o = w.__imp.list.find((q) => q.id === id); return !!(o && w.__imp.meshOf(o) && o.rot === 1); }, id), 'Perspective has it, turned, with the shared mesh');
  // a version keeps the pieces and the mesh; a reload brings everything back
  await p.evaluate(async () => { const S = await import('./js/store.js'); S.saveVersion(S.projects()[0], 'benches'); });
  ok(await p.evaluate(async (ref) => { const S = await import('./js/store.js'), v = S.projects()[0].versions.at(-1).model; return v.studio.imports.filter((o) => o.ref === ref).length === 2 && Array.isArray(v.meshes[ref]); }, lib[0].id), 'a saved version keeps both benches and their mesh');
  await p.reload(); await open(); await p.click('[data-panel="furniture"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !!document.querySelector('[data-myfurn]')) && await W('plan', (w) => w.__imp.list.filter((o) => o.ref).every((o) => w.__imp.meshOf(o))), 'after a reload: still in My furniture, and the placed benches have their mesh');
  // remove from the list: the placed ones stay
  await p.click('[data-myfx]'); await p.waitForTimeout(400);
  ok(await p.evaluate(async () => { const S = await import('./js/store.js'); return !(S.account().furniture || []).length && !document.querySelector('[data-myfurn]') && __ws2.model().studio.imports.filter((o) => o.ref).length === 2; }), 'removing it from My furniture keeps the benches already placed');
  if (errs.length) { console.log('page errors:', errs); process.exitCode = 1; } else ok(true, 'no page errors');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
