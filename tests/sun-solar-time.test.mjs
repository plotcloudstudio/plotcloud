// The solar envelope takes its hours in apparent solar time: local mean time at the site's meridian less the equation of time.
// At 12:00 apparent solar time the sun stands due south (north of the tropic), whatever the date.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sunPosition } from '../mvp/js/environment/analysis.js';

test('12:00 apparent solar time puts the sun on the meridian on every date', () => {
  for (const [m, d] of [[2, 11], [5, 14], [7, 26], [11, 3], [12, 21]]) {
    const lon = -75, tz = lon / 15, eot = sunPosition(2026, m, d, 12, 40, lon, tz).eot, sp = sunPosition(2026, m, d, 12 - eot / 60, 40, lon, tz);
    assert.ok(Math.abs(sp.az - 180) < 0.05, `${m}/${d}: azimuth ${sp.az}`);
  }
});

test('the equation of time stays within its known range (about -14.6 to +16.5 minutes)', () => {
  let lo = Infinity, hi = -Infinity;
  for (let day = 0; day < 365; day++) { const t = new Date(Date.UTC(2026, 0, 1 + day)), e = sunPosition(2026, t.getUTCMonth() + 1, t.getUTCDate(), 12, 0, 0, 0).eot; lo = Math.min(lo, e); hi = Math.max(hi, e); }
  assert.ok(lo > -15 && lo < -14, `min ${lo}`); assert.ok(hi > 16 && hi < 17, `max ${hi}`);
});
