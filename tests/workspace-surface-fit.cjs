// Results on the building fit the model (2026-11-13), on the Fallingwater case: Sun hours and Wind flow paint the facades and roofs
// with pieces of the model's own faces, so no colour runs past a wall, a parapet or a rail:
// · every sample is a triangle of a real face, drawn 1.5 cm off it
// · no drawn corner lies outside the model (walls, masses, imported parts) by more than 5 cm
// · on a drawn wall the colour stops at the wall's own top (a low wall or parapet is not painted to the storey height)
const { chromium } = require('playwright'), assert = require('node:assert/strict'), os = require('node:os');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || os.tmpdir();
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    const pid = await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); const m = await import('./js/fallingwater-dashboard.js'), q = m.openCase(); try { localStorage.setItem('pc-mvp-current', q.id); localStorage.setItem('pc-water-anim', 'off'); } catch { } return q.id; });
    await p.goto(base + '/mvp/#/workspace/' + pid); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 240000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(2000);
    const run = async (id) => { await p.evaluate((i) => window.__wsStudy.open(i), id); await p.waitForTimeout(1200); await p.click('.sp-studycard [data-st=run]'); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 900000 });
      return p.evaluate(() => { const s = window.__wsStudy.state(); return { err: s.err, n: s.res?.svals?.length || 0, fin: s.res?.svals ? Array.from(s.res.svals).filter(Number.isFinite).length : 0 }; }); };
    // the check, in the page: the samples against the model
    const check = () => p.evaluate(() => { const w = __ws2.inst.persp.ws, L = w.surfaceList(true), M = JSON.parse(w.model()), lv = Object.fromEntries(M.levels.map((l) => [l.id, l]));
      const missing = L.filter((x) => !x.tri).length; let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      const grow = (x, y, z) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z); };
      for (const x of L.filter((s) => s.imp)) for (let v = 0; v < 3; v++) grow(x.tri[v * 3], x.tri[v * 3 + 1], x.tri[v * 3 + 2]);
      const zs = M.levels.map((l) => l.z).sort((a, b) => a - b), top = (wl) => { const L2 = lv[wl.lv], above = zs.find((z) => z > L2.z + 0.05); return L2.z + (wl.h || Math.max(L2.h, above != null ? above - L2.z : L2.h)); };   // up to the slab above where no own height
      for (const wl of M.walls) { grow(wl.a[0], wl.a[1], lv[wl.lv].z); grow(wl.b[0], wl.b[1], top(wl)); }
      for (const m of M.masses || []) for (const q of m.outer || []) grow(q[0], q[1], (m.base || 0) + (m.h || 0));
      let out = 0, worst = 0; for (const x of L) for (let v = 0; v < 3; v++) { const X = x.tri[v * 3], Y = x.tri[v * 3 + 1], Z = x.tri[v * 3 + 2], d = Math.max(x0 - X, X - x1, y0 - Y, Y - y1, z0 - Z, Z - z1, 0); if (d > 0.05) out++; worst = Math.max(worst, d); }
      // on straight drawn walls: no corner above the wall's own top (with its arcs and imports left aside)
      let over = 0, overMax = 0; const st = M.walls.filter((wl) => !wl.bulge);
      for (const x of L.filter((s) => !s.imp)) { const c = [(x.tri[0] + x.tri[3] + x.tri[6]) / 3, (x.tri[1] + x.tri[4] + x.tri[7]) / 3], zc = (x.tri[2] + x.tri[5] + x.tri[8]) / 3, zLv = Math.max(...zs.filter((z) => z <= Math.min(x.tri[2], x.tri[5], x.tri[8]) + 0.02)); let best = null, bd = Infinity;
        for (const wl of st) { const dx = wl.b[0] - wl.a[0], dy = wl.b[1] - wl.a[1], L2 = Math.hypot(dx, dy); if (L2 < 0.05) continue; const t = ((c[0] - wl.a[0]) * dx + (c[1] - wl.a[1]) * dy) / (L2 * L2); if (t < 0 || t > 1) continue; const d = Math.abs((c[0] - wl.a[0]) * dy - (c[1] - wl.a[1]) * dx) / L2; if (d <= (wl.t || 0.2) / 2 + 0.03 && Math.abs(lv[wl.lv].z - zLv) < 0.01 && d < bd) { bd = d; best = wl; } }   /* a wall of the sample's own floor */
        if (!best) continue; const zt = Math.max(...[2, 5, 8].map((i) => x.tri[i])) - top(best); if (zt > 0.03) { over++; overMax = Math.max(overMax, zt); if (over <= 4) (window.__ov ||= []).push({ c: c.map((v) => +v.toFixed(2)), z: +zc.toFixed(2), zmax: +Math.max(...[2, 5, 8].map((i) => x.tri[i])).toFixed(2), top: +top(best).toFixed(2), wall: best.id, h: best.h, lv: best.lv, roof: x.roof, glass: x.glass }); } }
      return { ov: window.__ov || [], n: L.length, missing, imp: L.filter((s) => s.imp).length, roofs: L.filter((s) => s.roof).length, out, worst: +worst.toFixed(3), over, overMax: +overMax.toFixed(2) }; });
    for (const id of ['sunhours', 'wind']) { const r = await run(id); assert.equal(r.err, '', id + ': ' + r.err); assert(r.n > 500 && r.fin > 100, id + ' values: ' + JSON.stringify(r));
      const c = await check(); assert.equal(c.missing, 0, 'every sample is a piece of a face'); assert(c.imp > 100 && c.roofs > 50, JSON.stringify(c)); assert.equal(c.out, 0, 'no corner outside the model: ' + JSON.stringify(c)); assert.equal(c.over, 0, 'no colour above a wall top: ' + JSON.stringify(c));
      await p.screenshot({ path: `${out}/surface-fit-${id}.png` }); console.log(`PASS ${id}: ${r.n} samples (${r.fin} with a value) fit the model:`, JSON.stringify(c)); }
    await p.evaluate(() => __ws2.inst.persp.ws.camMove({ orbit: [0.35, 0.12], zoom: 0.3 })); await p.waitForTimeout(800); await p.screenshot({ path: `${out}/surface-fit-close.png` });   // a close look at the terraces and rails
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
