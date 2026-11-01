// The Daylight engine on the test room: the Workspace's Daylight module (mvp/js/interior/daylight.js, the engine of the former
// emb/daylight.html, unchanged), run directly in Node: its daylight factor at each point, split into the sky seen directly,
// outside reflections and inside reflections (all read from the engine itself). Prints JSON. (2026-11-01: was the study page in
// a browser; the page is retired and its engine moved into the module.)
const path = require('node:path'), { pathToFileURL } = require('node:url');
const room = JSON.parse(process.argv[2]);
(async () => {
  const D = await import(pathToFileURL(path.join(__dirname, '../../mvp/js/interior/daylight.js')).href), R = room;
  const ox = R.opposite ? 21 : 1, oy = 1 + (R.opposite ? R.opposite.d + 1 : 0), W = R.width, Dp = R.depth, w0 = R.win[0], w1 = R.win[1];
  const wall = (a, b, h, glass = false) => ({ a: [a[0] + ox, a[1] + oy], b: [b[0] + ox, b[1] + oy], h, glass });
  const oy2 = R.opposite ? R.opposite.d + 1 : 0, scene = { name: 'validation room', bounds: { w: W + 2 * ox, h: Dp + 2 + oy2 }, walls: [wall([0, 0], [w0, 0], R.ceil), wall([w0, 0], [w1, 0], R.sill, true), wall([w1, 0], [W, 0], R.ceil), wall([W, 0], [W, Dp], R.ceil), wall([W, Dp], [0, Dp], R.ceil), wall([0, Dp], [0, 0], R.ceil), ...(R.opposite ? [wall([-20, -R.opposite.d], [W + 20, -R.opposite.d], R.opposite.h)] : [])], furn: [] };
  // the study's Fine detail, as the page ran it: its candidates against the page's default speed (no learned speed in Node)
  const out = await D.run(scene, { level: 'fine', head: R.head, wp: R.wp, tau: R.tau, rf: R.rf, rw: R.rw, rc: R.rc, epw: null }), res = out.RES;
  if (Math.max(...res.pts.map((q) => q.y)) > Dp + oy + 0.5 || !res.pts.some((q) => Math.abs(q.y - oy - 0.5) < 0.2)) { console.log(JSON.stringify({ error: 'the result is not on the test room' })); return; }
  console.log(JSON.stringify(R.points.map(([x, y]) => { let best = -1, bd = Infinity; res.pts.forEach((q, k) => { const d = Math.hypot(q.x - (x + ox), q.y - (y + oy)); if (d < bd) { bd = d; best = k; } });
    const e = res.ev[best], q = res.pts[best], outside = 100 * e.sk.erc * 0.15 / Math.PI, inside = 100 * e.ir;
    return { x: q.x - ox, y: q.y - oy, df: e.df, sky: e.df - outside - inside, outside, inside, spacing: res.spacing, bearings: res.nb }; })));
})().catch((e) => { console.error(e); process.exit(1); });
