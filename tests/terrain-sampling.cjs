// Terrain sampling (2026-10-25): heights are read between pixel centres (bilinear), across tile edges, not snapped to a pixel.
// A synthetic ground that is a plane must come back exact anywhere; a ridge must not jump at a tile edge. No network needed.
// Run with a static server on 8765 (python3 -m http.server 8765 --bind 127.0.0.1); TEST_BASE overrides it.
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); await p.goto((process.env.TEST_BASE || 'http://127.0.0.1:8765') + '/mvp/');
  const r = await p.evaluate(async () => { const { sampleAt } = await import('./js/sitedata.js');
    const plane = (gx, gy) => 12 + 0.3 * (gx + 0.5) - 0.2 * (gy + 0.5);   // height of a pixel centre on a tilted plane
    let worst = 0; for (let k = 0; k < 500; k++) { const tx = 5000 + Math.random() * 3, ty = 7000 + Math.random() * 3, want = 12 + 0.3 * tx * 256 - 0.2 * ty * 256; worst = Math.max(worst, Math.abs(sampleAt(plane, tx, ty) - want)); }
    const nearest = (f, tx, ty) => f(Math.floor(tx * 256), Math.floor(ty * 256));   // what the earlier sampler did
    let jumpB = 0, jumpN = 0; const ridge = (gx, gy) => 100 * Math.sin(gx / 40);
    for (let k = -20; k < 20; k++) { const a = 5001 + k / 2560, c = a + 1 / 2560; jumpB = Math.max(jumpB, Math.abs(sampleAt(ridge, c, 9000.5) - sampleAt(ridge, a, 9000.5))); jumpN = Math.max(jumpN, Math.abs(nearest(ridge, c, 9000.5) - nearest(ridge, a, 9000.5))); }
    return { worst, jumpB, jumpN }; });
  ok(r.worst < 1e-6, `a plane comes back exact between pixels (largest error ${r.worst.toExponential(1)} m)`);
  ok(r.jumpB < r.jumpN && r.jumpB < 0.3, `steps of 1/10 pixel across a tile edge change smoothly (largest step ${r.jumpB.toFixed(3)} m; nearest pixel: ${r.jumpN.toFixed(3)} m)`);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
