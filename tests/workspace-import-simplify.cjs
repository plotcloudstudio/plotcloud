// Large files 7 (2026-11-19): optional simplification in the import preview.
//  1 an OBJ of 4,600 objects (496,800 triangles): the simplify option is there and off; turned on with a target of 100,000 and a 2 cm
//    limit, the preview says what it reached and how far the surface moved; confirmed, the project holds that many triangles, the
//    import record says it was simplified, the Workspace note says so, and every object keeps its place and size;
//  2 a sphere (curved, 20,000 triangles): the reported largest change is checked against the distance measured from every original
//    vertex to the simplified surface; a 1 mm limit stops short of the target and says so; no limit reaches it;
//  3 with the option left off the model comes in as it was; no page errors.
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 960 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const objOf = (N) => { const out = []; let vn = 0; const side = Math.ceil(Math.sqrt(N)), s = 3;
      const faces = [[[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, 0], [1, 0, 0], [0, 0, 1]], [[0, 1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 0], [0, 1, 0], [0, 0, 1]], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]];
      for (let k = 0; k < N; k++) { const x = (k % side) * 1.5, y = Math.floor(k / side) * 1.5, z = (k % 7) * 3; out.push(`o piece_${k}`);
        for (const [o, u, v] of faces) { const st = vn; for (let j = 0; j <= s; j++) for (let i = 0; i <= s; i++) { out.push(`v ${x + o[0] + u[0] * i / s + v[0] * j / s} ${y + o[1] + u[1] * i / s + v[1] * j / s} ${z + o[2] + u[2] * i / s + v[2] * j / s}`); vn++; }
          for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) { const q = st + j * (s + 1) + i + 1; out.push(`f ${q} ${q + 1} ${q + s + 2} ${q + s + 1}`); } } }
      return out.join('\n') + '\n'; };
    const big = path.join(os.tmpdir(), 'simplify-4600.obj'); fs.writeFileSync(big, objOf(4600));
    const small = path.join(os.tmpdir(), 'simplify-60.obj'); fs.writeFileSync(small, objOf(60));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    const mk = (name) => p.evaluate(async (n) => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'plan' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); return S.createProject(n, { units: 'm', layers: [], components: [] }).id; }, name);
    const open = async (id) => { await p.goto(base + '/mvp/#/workspace/' + id); await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2.inst.plan.ready, null, { timeout: 300000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(800); };
    const pick = async (file) => { await p.evaluate(() => { const u = document.querySelector('#up'); if (u) u.value = 'z'; }); await p.setInputFiles('#file', file); await p.locator('.ipv [data-ipv=ok]').waitFor({ timeout: 300000 }); };
    // 1. the big model, simplified to 100,000 triangles within 2 cm
    await open(await mk('Simplify')); await pick(big);
    const box = await p.evaluate(() => ({ shown: !document.querySelector('[data-ipv-simpbox]').hidden, on: document.querySelector('[data-ipv-simp]').checked, target: document.querySelector('[data-ipv-target]').value, size: document.querySelector('[data-ipv-size]').textContent }));
    assert(box.shown && !box.on, 'the option is there and off: ' + JSON.stringify(box)); assert.match(box.size, /496,800 triangles/);
    await p.fill('[data-ipv-target]', '100000'); const t0 = Date.now(); await p.check('[data-ipv-simp]');
    await p.waitForFunction(() => /^Simplified:/.test(document.querySelector('[data-ipv-simpmsg]').textContent), null, { timeout: 120000 }); const ms = Date.now() - t0;
    const msg = await p.textContent('[data-ipv-simpmsg]'), size = await p.textContent('[data-ipv-size]'); const to = +msg.match(/→ ([\d,]+) triangles/)[1].replace(/,/g, '');
    assert(to <= 102000 && to > 40000, msg); assert.match(size, /Simplified from 496,800/); assert.match(msg, /moved (less than 0\.1 mm|[\d.]+ (mm|cm)) at most/);
    console.log(`  preview: "${msg}" (${(ms / 1000).toFixed(1)} s)`);
    await p.click('.ipv [data-ipv=ok]'); await p.waitForFunction(() => (__ws2.model().studio.imports || []).length >= 4600, null, { timeout: 300000 }); await p.waitForTimeout(1500);
    const got = await p.evaluate(() => { const M = __ws2.model(), L = M.studio.imports; let tris = 0, moved = 0; for (const c of L) { const m = M.meshes[c.id]; tris += m.length / 9; let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < m.length; i += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], m[i + a]); mx[a] = Math.max(mx[a], m[i + a]); } if (Math.max(...mn.map(Math.abs)) > 1e-6 || Math.abs(mx[0] - 1) > 1e-6 || Math.abs(mx[1] - 1) > 1e-6 || Math.abs(mx[2] - 1) > 1e-6) moved++; }
      return { n: L.length, tris, moved, audit: M.importAudit?.simplified, total: M.importAudit?.triangles, note: [...document.querySelectorAll('p.note')].map((e) => e.textContent).find((t) => /Last import/.test(t)) || '' }; });
    assert.equal(got.n, 4600); assert.equal(got.tris, to, 'the project holds what the preview said'); assert.equal(got.moved, 0, 'every object keeps its place and size');
    assert(got.audit && got.audit.from === 496800 && got.audit.to === to && got.audit.limitM === 0.02 && /meshoptimizer/.test(got.audit.method), JSON.stringify(got.audit)); assert.equal(got.total, to);
    if (got.note) assert.match(got.note, /Simplified at import from 496,800 triangles/);
    console.log(`PASS 1 496,800 → ${to.toLocaleString('en')} triangles in the preview (${(ms / 1000).toFixed(1)} s), within the 2 cm limit (largest change ${(got.audit.maxChangeM * 100).toFixed(2)} cm); the project holds ${got.tris.toLocaleString('en')}, the import record says simplified; all 4,600 objects keep their place and size${got.note ? '; the Workspace note says so' : ''}`);
    // 2. a sphere: the reported change against the measured one; a 1 mm limit stops short and says so
    const sph = await p.evaluate(async () => { const { simplifyComponents } = await import('./js/mesh-simplify.js?v=simplify-20261119-1');
      const R = 5, nu = 100, nv = 100, mesh = [], P = (i, j) => { const u = i / nu * 2 * Math.PI, v = j / nv * Math.PI; return [R + R * Math.sin(v) * Math.cos(u), R + R * Math.sin(v) * Math.sin(u), R + R * Math.cos(v)]; };
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = P(i, j), b2 = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1); if (j > 0) mesh.push(...a, ...b2, ...c); if (j < nv - 1) mesh.push(...a, ...c, ...d); }
      const comp = [{ mesh, g: { x: 0, y: 0, z: 0, w: 10, d: 10, h: 10 } }], t = mesh.length / 9;
      const dist = (p, m) => { let best = Infinity; for (let i = 0; i < m.length; i += 9) { // point to triangle distance
          const a = [m[i], m[i + 1], m[i + 2]], b = [m[i + 3], m[i + 4], m[i + 5]], c = [m[i + 6], m[i + 7], m[i + 8]], sub = (x, y) => [x[0] - y[0], x[1] - y[1], x[2] - y[2]], dot = (x, y) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
          const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap); let q;
          if (d1 <= 0 && d2 <= 0) q = a; else { const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) q = b; else { const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp); if (d6 >= 0 && d5 <= d6) q = c; else {
            const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4;
            if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); q = [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]; }
            else if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); q = [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]; }
            else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); q = [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]; }
            else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; q = [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]; } } } }
          const e = sub(p, q), dd = dot(e, e); if (dd < best) best = dd; } return Math.sqrt(best); };
      const measure = (m) => { let worst = 0; for (let i = 0; i < mesh.length; i += 9 * 7) worst = Math.max(worst, dist([mesh[i], mesh[i + 1], mesh[i + 2]], m)); return worst; };
      const free = await simplifyComponents(comp, { target: 1000, maxError: Infinity }), tight = await simplifyComponents(comp, { target: 1000, maxError: 0.001 }), cm2 = await simplifyComponents(comp, { target: 1000, maxError: 0.02 });
      return { t, free: { after: free.after, rep: free.maxError, meas: measure(free.components[0].mesh) }, tight: { after: tight.after, rep: tight.maxError, meas: measure(tight.components[0].mesh) }, cm2: { after: cm2.after, rep: cm2.maxError, meas: measure(cm2.components[0].mesh) } }; });
    assert(sph.free.after <= 1020, JSON.stringify(sph.free)); assert(sph.tight.after > 1500, 'a 1 mm limit stops short: ' + JSON.stringify(sph.tight)); assert(sph.tight.rep <= 0.001 + 1e-6);
    for (const k of ['free', 'tight', 'cm2']) assert(sph[k].meas <= sph[k].rep * 1.5 + 0.002, `${k}: measured ${sph[k].meas} against reported ${sph[k].rep}`);
    console.log(`PASS 2 a sphere of ${sph.t.toLocaleString('en')} triangles (5 m radius): no limit → ${sph.free.after} triangles, reported ${(sph.free.rep * 100).toFixed(1)} cm, measured ${(sph.free.meas * 100).toFixed(1)} cm; 2 cm → ${sph.cm2.after}, reported ${(sph.cm2.rep * 100).toFixed(2)}, measured ${(sph.cm2.meas * 100).toFixed(2)} cm; 1 mm → stops at ${sph.tight.after} (measured ${(sph.tight.meas * 1000).toFixed(2)} mm)`);
    // 3. left off: as it was
    await open(await mk('Plain')); await pick(small);
    const hid = await p.evaluate(() => document.querySelector('[data-ipv-simpbox]').hidden); await p.click('.ipv [data-ipv=ok]'); await p.waitForFunction(() => (__ws2.model().studio.imports || []).length >= 60, null, { timeout: 60000 }); await p.waitForTimeout(800);
    const pl = await p.evaluate(() => { const M = __ws2.model(); return { tris: M.studio.imports.reduce((s, c) => s + M.meshes[c.id].length / 9, 0), simp: M.importAudit?.simplified }; });
    assert.equal(pl.tris, 60 * 108); assert.equal(pl.simp, undefined); assert.equal(hid, false);
    console.log(`PASS 3 left off, the model comes in as it was (${pl.tris.toLocaleString('en')} triangles, no simplification recorded)`);
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
