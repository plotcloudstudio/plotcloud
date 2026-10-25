// The Sun hours engine (emb/sunhours.html) on a test mass, run the way a person runs it (file in, date, Calculate), in a real
// browser. Prints its ground samples, the hours it found at each, and the sun directions and weights it used. Server on 8765.
const { chromium } = require('playwright');
const scene = process.argv[2], day = process.argv[3] || '03-20';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }), p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto((process.env.TEST_BASE || 'http://127.0.0.1:8765') + '/emb/sunhours.html'); await p.waitForFunction(() => window.__sun && window.__sun.S, null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.setInputFiles('#file', { name: 'validation-wall.json', mimeType: 'application/json', buffer: Buffer.from(scene) });
  await p.waitForFunction(() => window.__sun.S.model && window.__sun.S.raw?.name !== 'sample', null, { timeout: 60000 });
  await p.evaluate((d) => { document.querySelector(`#daySeg [data-d="${d}"]`).click(); const st = document.getElementById('step'); st.value = '5'; st.dispatchEvent(new Event('change', { bubbles: true })); }, day);
  await p.evaluate(() => { window.__sun.S.lastR = null; document.getElementById('run').click(); });
  await p.waitForTimeout(800); if (await p.isVisible('#longGo')) await p.click('#longGo');
  await p.waitForFunction(() => window.__sun.S.lastR && !window.__sun.S.busy, null, { timeout: 300000 });
  const out = await p.evaluate(() => { const S = window.__sun.S, R = S.lastR, P = R.prep, pos = S.model.pos; let ex = Infinity, ey = Infinity; for (let i = 0; i < pos.length; i += 3) { ex = Math.min(ex, pos[i]); ey = Math.min(ey, pos[i + 1]); }
    const g = []; for (let k = 0; k < R.hours.length; k++) if (P.smpK[k] === 0) g.push([P.smpP[3 * k], P.smpP[3 * k + 1], P.smpP[3 * k + 2], R.hours[k]]);
    return { ground: g, suns: R.suns.map((v) => [v.x, v.y, v.z]), weights: R.weights, modelMin: [ex, ey], grid: P.s, loc: S.loc, date: S.date, north: S.north, step: S.step }; });
  console.log(JSON.stringify(out)); await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
