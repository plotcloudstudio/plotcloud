// Sunshine share (2026-11-23): the WMO sunshine threshold (direct normal irradiance ≥ 120 W/m²) applied to hourly weather rows.
// A March of 31 days at Toronto: every daylit hour of the first 10 days at 119 W/m² (just under), the next 10 at 120 (exactly the
// threshold) and the last 11 at 800; night hours at 500 must be ignored. Expected share: the daylit hours of days 11–31 over all.
import test from 'node:test'; import assert from 'node:assert/strict';
import { sunshineShare, sunPosition, WMO_SUNSHINE_WM2 } from '../mvp/js/environment/analysis.js';
test('WMO sunshine share from hourly rows', () => {
  assert.equal(WMO_SUNSHINE_WM2, 120);
  const lat = 43.65, lon = -79.38, tz = -5, rows = [];
  for (let d = 1; d <= 31; d++) for (let h = 1; h <= 24; h++) { const up = sunPosition(2026, 3, d, h - 0.5, lat, lon, tz).alt > 0; rows.push({ m: 3, d, h, dni: up ? (d <= 10 ? 119 : d <= 20 ? 120 : 800) : 500 }); }
  rows.push({ m: 4, d: 1, h: 12, dni: 900 });   // another month: ignored
  const up = rows.filter((q) => q.m === 3 && sunPosition(2026, 3, q.d, q.h - 0.5, lat, lon, tz).alt > 0), want = up.filter((q) => q.d > 10).length;
  const r = sunshineShare(rows, 3, lat, lon, tz);
  assert.equal(r.n, up.length); assert.equal(r.k, want, '120 W/m² counts as sunshine, 119 does not, night hours are ignored'); assert.ok(Math.abs(r.f - want / up.length) < 1e-12);
  assert.ok(r.n > 31 * 10 && r.n < 31 * 14, 'about 12 daylit hours a day at the equinox: ' + r.n);
  assert.equal(sunshineShare(rows, 7, lat, lon, tz), null, 'no rows for the month');
});
