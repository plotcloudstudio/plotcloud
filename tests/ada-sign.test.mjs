// ADA 2010 Standards Table 703.5.5, turned round (2026-11-24): the farthest viewing distance at which letters of a given height
// meet the table, for each tier of baseline height, the tier boundaries, and 703.5.6 (no visual characters below 1015 mm).
import assert from 'node:assert/strict';
import { adaMaxDistance, ADA_TIERS } from '../mvp/js/interior/wayfinding-signage.js';
const near = (a, b, msg) => assert(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);
// tier 1 (1015–1780 mm): 16 mm up to 1830 mm; each 3.2 mm more buys 305 mm
near(adaMaxDistance(16, 1500), 1.83, '16 mm on a wall'); near(adaMaxDistance(19.2, 1500), 1.83 + 0.305, '+3.2 mm');
near(adaMaxDistance(75, 1500), 1.83 + (75 - 16) / 3.2 * 0.305, '75 mm on a wall');
assert.equal(adaMaxDistance(15, 1500), 0, 'below the tier minimum');
// the boundaries: 1780 mm is still tier 1, just above it tier 2 (51 mm below 4570 mm)
near(adaMaxDistance(51, 1780), 1.83 + (51 - 16) / 3.2 * 0.305, '1780 mm is tier 1'); near(adaMaxDistance(51, 1781), 4.57, '1781 mm is tier 2');
near(adaMaxDistance(75, 2300), 4.57 + (75 - 51) / 3.2 * 0.305, '75 mm hung'); assert.equal(adaMaxDistance(50, 2300), 0, 'tier 2 needs 51 mm');
// tier 3 (above 3050 mm): 75 mm below 6400 mm
near(adaMaxDistance(75, 3050), 4.57 + (75 - 51) / 3.2 * 0.305, '3050 mm is tier 2'); near(adaMaxDistance(75, 3051), 6.4, '3051 mm is tier 3'); near(adaMaxDistance(100, 4000), 6.4 + 25 / 3.2 * 0.305, '100 mm high up');
// 703.5.6: visual characters at least 1015 mm above the floor
assert.equal(adaMaxDistance(75, 1000), 0, 'below 1015 mm'); near(adaMaxDistance(16, 1015), 1.83, 'at 1015 mm');
assert.deepEqual(ADA_TIERS.map((t) => t.slice(1)), [[1830, 16], [4570, 51], [6400, 75]], 'the table values');
console.log('PASS ADA Table 703.5.5: tiers, boundaries, 3.2 mm per 305 mm, 703.5.6 floor; 75 mm letters on a wall 7.45 m, hung 6.86 m');
