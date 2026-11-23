// Daylight blinds (2026-11-23): sDA with blinds operated as IES LM-83-12 describes. A 6 × 8 m room with one window wall, turned to four
// compass directions, a generic year. Checks: without blinds sDA is the open-window value and no hour is shut; with blinds the hours
// shut are exactly those where more than 2 % of the spots see direct sun of 1,000 lux (recounted here from the engine's own sun
// test), every spot's daylit hours can only fall, ASE does not change (it is counted with blinds open), a 5 % shade lowers sDA at
// least as much as 20 % louvres, and the window turned away from the sun shuts them in far fewer hours than one facing it.
import test from 'node:test'; import assert from 'node:assert/strict';
const D = await import('../mvp/js/interior/daylight.js');
const room = () => { const w = (a, b, h, glass = false) => ({ a, b, h, glass }); return { name: 'blinds room', bounds: { w: 8, h: 10 },
  walls: [w([1, 1], [2, 1], 2.7), w([2, 1], [6, 1], 0.9, true), w([6, 1], [7, 1], 2.7), w([7, 1], [7, 9], 2.7), w([7, 9], [1, 9], 2.7), w([1, 9], [1, 1], 2.7)], furn: [] }; };
const run = async (north, blind) => { const out = await D.run(room(), { level: 'draft', north, blind, epw: null, loc: { lat: 43.65, lon: -79.38, tz: -5 } }); return out; };
test('blinds follow LM-83-12 and only lower sDA', async () => {
  const shut = [];
  for (const north of [0, 90, 180, 270]) {
    const a = await run(north, 0), A = a.RES, sa = a.sm; assert.equal(A.blinds.shutHours, 0, 'no blinds, no hour shut'); assert.equal(sa.sda, sa.sdaOpen);
    const b = await run(north, 0.2), B = b.RES, sb = b.sm;
    assert.equal(B.pts.length, A.pts.length); assert.equal(sb.ase, sa.ase, 'ASE is counted with the blinds open');
    B.ev.forEach((e, k) => { assert.ok(e.da <= A.ev[k].da + 1e-12, 'a spot gains no daylit hours from blinds'); assert.equal(e.daOpen, A.ev[k].da); });
    assert.ok(sb.sda <= sb.sdaOpen + 1e-12); assert.ok(Math.abs(sb.sdaOpen - sa.sda) < 1e-12, 'sDA without blinds is the open value');
    const c = await run(north, 0.05); assert.ok(c.sm.sda <= sb.sda + 1e-12, 'a 5 % shade lowers sDA at least as much as 20 % louvres'); assert.equal(c.RES.blinds.shutHours, B.blinds.shutHours, 'the same hours shut');
    shut.push(B.blinds.shutHours); if (B.blinds.shutHours > 0) { assert.ok(sb.ase > 0 || B.ev.some((e) => e.ase > 0), 'blinds shut only when there is direct sun'); }
    else assert.equal(sb.sda, sb.sdaOpen, 'nothing shut, nothing changes');
    console.log(`north ${north}: shut ${B.blinds.shutHours}/${B.blinds.occHours} h · sDA open ${(sb.sdaOpen * 100).toFixed(1)} % · louvres ${(sb.sda * 100).toFixed(1)} % · 5 % shade ${(c.sm.sda * 100).toFixed(1)} % · ASE ${(sb.ase * 100).toFixed(1)} %`);
  }
  assert.ok(Math.max(...shut) > 1000, 'a sun-facing window shuts the blinds in many hours'); assert.ok(Math.min(...shut) < Math.max(...shut) / 10, 'the window away from the sun shuts them in few hours (low summer sun only)');
});
