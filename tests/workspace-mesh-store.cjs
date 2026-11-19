// Large files 5 (2026-11-19): imported meshes kept apart from the project text. An OBJ of 4,600 objects (496,800 triangles) imported:
//  1 once their records are stored, the store's text holds only references (it shrinks from tens of MB to well under 1 MB) and a
//    save takes a small part of the time that writing every mesh into the text takes (both printed);
//  2 after a reload every mesh is back, number for number, and the 3D view draws every piece;
//  3 a saved version shares the draft's mesh records (no second copy); pieces with the same mesh share one record; storage use is
//    the text plus every distinct mesh once; no page errors.
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
    const big = path.join(os.tmpdir(), 'mesh-store-4600.obj'); fs.writeFileSync(big, objOf(4600));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    const id = await p.evaluate(async () => { localStorage.clear(); await new Promise((r) => { const q = indexedDB.deleteDatabase('plotcloud-mesh'); q.onsuccess = q.onerror = q.onblocked = () => r(); });
      localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'persp' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); return S.createProject('Large', { units: 'm', layers: [], components: [] }).id; });
    const ready = async () => { await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2.inst.plan.ready, null, { timeout: 300000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(800); };
    await p.goto(base + '/mvp/#/workspace/' + id); await ready();
    await p.evaluate(() => { const u = document.querySelector('#up'); if (u) u.value = 'z'; }); await p.setInputFiles('#file', big); await p.locator('.ipv [data-ipv=ok]').waitFor({ timeout: 300000 });
    await p.click('.ipv [data-ipv=ok]'); await p.waitForFunction(() => (__ws2.model().studio.imports || []).length >= 4600, null, { timeout: 300000 }); await p.waitForTimeout(2500);
    // 1. the text holds references once the records are stored; a save's time
    const before = await p.evaluate(async () => { const S = await import('./js/store.js'), ms = []; for (let k = 0; k < 3; k++) { const t = performance.now(); JSON.stringify(S.load()); ms.push(performance.now() - t); }   /* what each save did before: the whole store as text, every mesh in it */
      const pr = S.project(location.hash.split('/').pop()); return { n: Object.keys(pr.draft.meshes).length, ms, text: JSON.stringify(S.load()).length }; });
    await p.waitForFunction(async () => { const S = await import('./js/store.js'); const pr = S.project(location.hash.split('/').pop()); return Object.values(pr.draft.meshes).every((a) => S.meshStore.has(a)); }, null, { timeout: 120000, polling: 500 }); await p.waitForTimeout(500);
    const after = await p.evaluate(async () => { const S = await import('./js/store.js'), ms = []; for (let k = 0; k < 5; k++) { const t = performance.now(); S.save(); ms.push(performance.now() - t); }
      const raw = localStorage.getItem('pc-mvp-v1') || ''; return { ms, raw: raw.length, refs: (raw.match(/"\$m":/g) || []).length, mode: localStorage.getItem('pc-mvp-store'), use: S.storageUse(), recs: S.meshStore.stored() }; });
    const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
    assert.equal(before.n, 4600); assert(after.refs >= 4600, 'every mesh a reference: ' + after.refs); assert(after.raw > 0 && after.raw < 2e6, 'the text is small: ' + after.raw); assert.equal(after.mode, 'mirror'); assert(after.recs < 400, 'only the meshes in use written: ' + after.recs);
    assert(med(after.ms) < med(before.ms) / 3, `a save is much faster than writing every mesh: ${med(before.ms).toFixed(0)} → ${med(after.ms).toFixed(0)} ms`);
    console.log(`PASS 1 ${after.refs} meshes kept apart; the store's text ${(before.text / 1e6).toFixed(1)} MB → ${(after.raw / 1e6).toFixed(2)} MB (back in this browser's quick copy), in ${after.recs} records; a save ${med(after.ms).toFixed(0)} ms, where writing the meshes into the text took ${med(before.ms).toFixed(0)} ms`);
    // 2. reload: every mesh back, the same numbers; the 3D view draws every piece
    const sig = () => p.evaluate(async () => { const S = await import('./js/store.js'), pr = S.project(location.hash.split('/').pop()), M = pr.draft.meshes, ks = Object.keys(M).sort(); let n = 0, h = 0, bad = 0;
      for (const k of ks) { const a = M[k]; if (!Array.isArray(a)) { bad++; continue; } n += a.length; for (let i = 0; i < a.length; i += 97) h = (h * 31 + Math.round(a[i] * 1e4)) | 0; } return { k: ks.length, n, h, bad }; });
    const s0 = await sig(); await p.reload(); await ready(); await p.waitForTimeout(1500); const s1 = await sig();
    assert.deepEqual(s1, s0, 'the meshes after a reload'); assert.equal(s1.bad, 0);
    const im = await p.evaluate(() => { const w = __ws2.inst.persp.win, s = w.S3.api || w.S3; return s._imp(); }); assert.equal(im.pieces + im.single, 4600, JSON.stringify(im));
    console.log(`PASS 2 after a reload all ${s1.k} meshes are back (${s1.n.toLocaleString('en')} numbers, the same); the 3D view draws ${im.pieces + im.single} pieces in ${im.batches} batches`);
    // 3. a saved version shares the records; storage use counts the meshes
    const v = await p.evaluate(async () => { const S = await import('./js/store.js'), pr = S.project(location.hash.split('/').pop()), n0 = S.meshStore.stored(); S.saveVersion(pr, 'with the model'); await new Promise((r) => setTimeout(r, 1500)); S.save();
      const raw = localStorage.getItem('pc-mvp-v1') || '', u = new Map(); for (const a of Object.values(pr.draft.meshes)) u.set(S.meshStore.keyOf(a), a.length);
      return { n0, n1: S.meshStore.stored(), raw: raw.length, refs: (raw.match(/"\$m":/g) || []).length, use: S.storageUse(), uniq: u.size, bytes: [...u.values()].reduce((s, n) => s + n * 8, 0) }; });
    assert.equal(v.n1, v.n0, 'no new records for the version'); assert(v.refs >= 9200 && v.raw < 4e6, JSON.stringify(v)); assert.equal(v.use, v.raw + v.bytes, 'storage use: the text and every distinct mesh once');
    console.log(`PASS 3 a saved version refers to the same records (no new ones; the text ${(v.raw / 1e6).toFixed(2)} MB); the 4,600 pieces have ${v.uniq} distinct meshes, each kept once; storage use ${(v.use / 1e6).toFixed(1)} MB = the text + those meshes`);
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
