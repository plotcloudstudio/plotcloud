// Parking (2026-11-21): the accessible access aisle and the 2010 ADA Standards 208.2 count.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, adaRequired } from '../mvp/js/parking.js';

test('the access aisle beside an accessible car space is at least 60 in (1.525 m), 502.3.1', () => {
  for (const c of CATEGORIES.filter((x) => x.accessible)) assert.ok(c.accessAisle >= 1.524, `${c.id}: ${c.accessAisle}`);
});

test('accessible spaces follow Table 208.2, one in six van accessible', () => {
  const cases = [[0, 0, 0], [1, 1, 1], [25, 1, 1], [26, 2, 1], [75, 3, 1], [100, 4, 1], [101, 5, 1], [200, 6, 1], [201, 7, 2], [500, 9, 2], [501, 11, 2], [1000, 20, 4], [1001, 21, 4], [1100, 21, 4], [1101, 22, 4]];
  for (const [n, a, v] of cases) assert.deepEqual(adaRequired(n), { accessible: a, van: v }, `total ${n}`);
});
