// The Daylight engine (emb/daylight.html) on the test room, in a real browser: its daylight factor at each point,
// split into the sky seen directly, outside reflections and inside reflections (all read from the engine itself).
// Run with the static server on 8765. Prints JSON.
const { chromium } = require('playwright');
const room = JSON.parse(process.argv[2]);
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); await p.goto((process.env.TEST_BASE || 'http://127.0.0.1:8765') + '/emb/daylight.html'); await p.waitForFunction(() => window.__day && window.__day.loadScene, null, { timeout: 30000 });
  // the engine runs its own sample first: wait until it is idle, so the test room is not overwritten by it
  await p.waitForFunction(() => window.__day.RES && !document.getElementById('run').disabled, null, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(800);
  const out = await p.evaluate(async (R) => {
    const D = window.__day, set = (id, v) => { const el = document.querySelector(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    const ox = R.opposite ? 21 : 1, oy = 1 + (R.opposite ? R.opposite.d + 1 : 0), W = R.width, Dp = R.depth, w0 = R.win[0], w1 = R.win[1];
    const wall = (a, b, h, glass = false) => ({ a: [a[0] + ox, a[1] + oy], b: [b[0] + ox, b[1] + oy], h, glass });
    const oy2 = R.opposite ? R.opposite.d + 1 : 0; D.loadScene({ name: 'validation room', bounds: { w: W + 2 * ox, h: Dp + 2 + oy2 }, walls: [wall([0, 0], [w0, 0], R.ceil), wall([w0, 0], [w1, 0], R.sill, true), wall([w1, 0], [W, 0], R.ceil), wall([W, 0], [W, Dp], R.ceil), wall([W, Dp], [0, Dp], R.ceil), wall([0, Dp], [0, 0], R.ceil), ...(R.opposite ? [wall([-20, -R.opposite.d], [W + 20, -R.opposite.d], R.opposite.h)] : [])], furn: [] });
    set('#head', R.head); set('#wp', R.wp); set('#tau', R.tau); set('#rf', R.rf); set('#rw', R.rw); set('#rc', R.rc);
    if (D.RES) return { error: 'the sample result was not cleared' };
    await D.runLevel('fine', true, true); for (let i = 0; i < 900 && !D.RES; i++) await new Promise((r) => setTimeout(r, 200));
    const res = D.RES; if (!res) return { error: 'no result' };
    if (Math.max(...res.pts.map((q) => q.y)) > Dp + oy + 0.5 || !res.pts.some((q) => Math.abs(q.y - oy - 0.5) < 0.2)) return { error: 'the result is not on the test room' };
    return R.points.map(([x, y]) => { let best = -1, bd = Infinity; res.pts.forEach((q, k) => { const d = Math.hypot(q.x - (x + ox), q.y - (y + oy)); if (d < bd) { bd = d; best = k; } });
      const e = res.ev[best], q = res.pts[best], outside = 100 * e.sk.erc * 0.15 / Math.PI, inside = 100 * e.ir;
      return { x: q.x - ox, y: q.y - oy, df: e.df, sky: e.df - outside - inside, outside, inside, spacing: res.spacing, bearings: res.nb }; });
  }, room);
  console.log(JSON.stringify(out)); await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
