// Water bodies as static site elements (2026-11-18), no browser: emb/lib/water.js.
// 1 a level pond on a slope stays horizontal at its lowest shore; 2 a level set above the shore is reported (spill) and drawn at the
// shore, never floating; set below it, it is kept; 3 'follow the ground': every sample on the ground; 4 the old 'drape' reads as
// follow the ground; 5 the sound of a rill and a fountain from octave bands, A-weighted, by hand; 6 a rill's long axis.
const assert = require('node:assert/strict'), path = require('node:path');
(async () => {
  const W = await import(path.join(__dirname, '../emb/lib/water.js'));
  const slope = (x, y) => 2 + 0.1 * x + 0.05 * y, P = [[0, 0], [12, 0], [12, 8], [0, 8]];
  // 1. level: the lowest shore point is the corner (0, 0) at 2.0 m; every point of the surface there
  const o1 = W.spec({ id: 'a', pts: P }, slope); assert.equal(o1.place, 'level'); assert.equal(o1.shore, 2); assert.equal(o1.level, 2); assert.equal(o1.spill, 0);
  for (const [x, y] of [[1, 1], [6, 4], [11, 7]]) assert.equal(W.sample(o1, x, y).z, 2, 'horizontal');
  console.log('PASS 1 a level pond on a 1-in-10 slope: horizontal at its lowest shore, 2.00 m');
  // 2. a level set at 2.6 m: the shore at 2.0 m is lower, so it would spill by 0.6 m; drawn at 2.0 m. Set at 1.8 m: kept
  const o2 = W.spec({ id: 'a', pts: P, water: { level: 2.6 } }, slope); assert.equal(o2.spill, 0.6); assert.equal(o2.level, 2.6); assert.equal(W.sample(o2, 6, 4).z, 2);
  const o2b = W.spec({ id: 'a', pts: P, water: { level: 1.8 } }, slope); assert.equal(o2b.spill, 0); assert.equal(W.sample(o2b, 6, 4).z, 1.8);
  console.log(`PASS 2 a level 0.6 m above the shore: reported (spill ${o2.spill} m), drawn at the shore; a level below the shore is kept`);
  // 3. follow the ground: on the slope at every point
  const o3 = W.spec({ id: 'a', pts: P, water: { place: 'ground' } }, slope); assert.equal(o3.place, 'ground');
  for (const [x, y] of [[1, 1], [6, 4], [11.5, 7.5]]) assert(Math.abs(W.sample(o3, x, y).z - slope(x, y)) < 1e-9, 'on the ground');
  console.log('PASS 3 follow the ground: every point on the ground');
  // 4. old projects: 'drape' is follow the ground
  const o4 = W.spec({ id: 'a', pts: P, water: { type: 'drape' } }, slope); assert.equal(o4.place, 'ground'); assert.equal(o4.type, 'pond');
  console.log('PASS 4 an old drape body reads as follow the ground');
  // 5. sound: a rill at 70 dB in every band and the fountain of the reference, A-weighted (−16.1, −8.6, −3.2, 0, +1.2, +1.0 dB)
  const hand = (b) => 10 * Math.log10(b.reduce((s, L, i) => s + 10 ** ((L + [-16.1, -8.6, -3.2, 0, 1.2, 1.0][i]) / 10), 0));
  assert(Math.abs(W.dBA(W.SOUND.rill.bands) - hand([70, 70, 70, 70, 70, 70])) < 1e-9 && Math.abs(W.dBA(W.SOUND.rill.bands) - 76.25) < 0.01);
  assert(Math.abs(W.dBA(W.SOUND.fountain.bands) - hand([50, 55, 50, 52, 55, 52])) < 1e-9);
  console.log(`PASS 5 rill ${W.dBA(W.SOUND.rill.bands).toFixed(1)} dB(A), fountain ${W.dBA(W.SOUND.fountain.bands).toFixed(1)} dB(A) from their octave bands`);
  // 6. a long thin rill's axis runs along it
  const ax = W.mainAxis([[0, 0], [20, 0], [20, 1], [0, 1]]); assert(Math.abs(Math.hypot(ax[1][0] - ax[0][0], ax[1][1] - ax[0][1]) - 20) < 1e-9);
  console.log('PASS 6 a 20 × 1 m rill: its axis is 20 m along it');
})().catch((e) => { console.error(e); process.exit(1); });
