// NRCS curve numbers (2026-11-23): the runoff equation against TR-55 table 2-1 (runoff depths in inches, read from the 1986 manual),
// the composite of figure 2-3 against TR-55's own example (pervious CN 61, 20 % impervious → 68) and the commercial row of table
// 2-2a (85 % impervious over open space in good condition → 89, 92, 94, 95 for soil groups A–D).
import test from 'node:test'; import assert from 'node:assert/strict';
import { runoffCN, coefCN, compositeCN, CN_OPEN_GOOD } from '../mvp/js/stormwater-grid.js';
test('TR-55 table 2-1', () => {
  const T = [[1.0, 75, 0.03], [1.0, 90, 0.32], [2.0, 55, 0.02], [2.0, 80, 0.56], [3.0, 70, 0.71], [4.0, 60, 0.76], [5.0, 85, 3.37], [6.0, 40, 0.5], [10.0, 90, 8.78], [1.2, 70, 0.03], [1.0, 70, 0]];
  for (const [P, CN, Q] of T) { const q = runoffCN(P * 25.4, CN) / 25.4; assert.ok(Math.abs(q - Q) <= 0.006, `P ${P} in, CN ${CN}: ${q.toFixed(3)} vs table ${Q}`); }
  assert.equal(runoffCN(25, 100), 25, 'water runs off entirely'); assert.ok(Math.abs(coefCN(50, 98) - runoffCN(50, 98) / 50) < 1e-12);
});
test('TR-55 composites', () => {
  assert.equal(Math.round(compositeCN(61, 0.2)), 68, 'the worked example of chapter 2');
  assert.deepEqual(['A', 'B', 'C', 'D'].map((g) => Math.round(compositeCN(CN_OPEN_GOOD[g], 0.85))), [89, 92, 94, 95], 'commercial and business, 85 % impervious');
  assert.deepEqual(['A', 'B', 'C', 'D'].map((g) => Math.round(compositeCN(CN_OPEN_GOOD[g], 0.65))), [77, 85, 90, 92], 'town houses, 65 % impervious');
});
