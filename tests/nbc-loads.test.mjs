// NBC 2020 roof snow and wind (2026-11-23), against the code's own table and by hand from its formulas (NR24-28/2020E-PDF, Division B):
// Table 4.1.6.2.-B gives C_b for l_c C_w² > 70 at C_w 1.0, 0.75 and 0.5; Sentence 4.1.6.2.(1) caps S_r; Sentence 4.1.7.3.(5) gives
// C_e and its lower limits; Sentence 4.1.7.5.(2) gives windward and leeward C_p by H/D.
import test from 'node:test'; import assert from 'node:assert/strict';
import * as N from '../mvp/js/nbc-loads.js';
const near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);
test('C_b against Table 4.1.6.2.-B', () => {
  // rows (l_c C_w², C_b at C_w 1.0, 0.75, 0.5), from the table
  const T = [[70, 0.80, 0.80, 0.80], [100, 0.85, 0.94, 1.11], [140, 0.90, 1.07, 1.40], [200, 0.95, 1.19, 1.67], [300, 0.98, 1.28, 1.88], [440, 1.00, 1.32, 1.97], [620, 1.00, 1.33, 2.00]];
  for (const [x, ...cb] of T) [1, 0.75, 0.5].forEach((Cw, k) => near(N.basicRoofFactor(x / (Cw * Cw), Cw), cb[k], 0.006, `l_c C_w² ${x}, C_w ${Cw}`));
  assert.equal(N.basicRoofFactor(30, 1), 0.8, 'small roofs: 0.8');
  near(N.charLength(20, 50), 2 * 20 - 400 / 50, 1e-12, 'l_c = 2w − w²/l');
});
test('roof snow S and the S_r cap', () => {
  let r = N.roofSnow({ Ss: 2.0, Sr: 0.4, roofW: 20, roofL: 40 }); near(r.S, 1 * (2.0 * 0.8 + 0.4), 1e-12, 'Normal, small flat roof'); assert.equal(r.Cb, 0.8);
  r = N.roofSnow({ Ss: 0.5, Sr: 0.6, roofW: 20, roofL: 40 }); near(r.S, 0.8, 1e-12, 'S_r not greater than S_s C_b C_w C_s C_a'); assert.equal(r.SrCapped, true);
  r = N.roofSnow({ Ss: 2.0, Sr: 0.4, Is: 1.15, roofW: 20, roofL: 40 }); near(r.S, 1.15 * 2.0, 1e-12, 'High importance');
  near(N.slopeFactor(50), 0.5, 1e-12, '(70 − 50)/40'); assert.equal(N.slopeFactor(80), 0);
});
test('wind: C_e, C_p and the net pressure', () => {
  near(N.exposureCe(5, 'open'), 0.9, 1e-12, 'open, h 5 m: the 0.9 floor'); near(N.exposureCe(6, 'open'), Math.pow(0.6, 0.2), 1e-12, 'open, h 6 m: 0.903'); near(N.exposureCe(40, 'open'), Math.pow(4, 0.2), 1e-12, '(h/10)^0.2');
  near(N.exposureCe(10, 'rough'), 0.7, 1e-12, 'rough, low: 0.7 floor'); near(N.exposureCe(48, 'rough'), 0.7 * Math.pow(4, 0.3), 1e-12, '0.7(h/12)^0.3');
  assert.deepEqual([N.cpWindward(0.2), N.cpLeeward(0.2), N.cpWindward(1.5), N.cpLeeward(1.5)], [0.6, -0.3, 0.8, -0.5]);
  near(N.cpWindward(0.5), 0.27 * 2.5, 1e-12, '0.27(H/D + 2)'); near(N.cpLeeward(0.5), -0.27 * 1.38, 1e-12, '−0.27(H/D + 0.88)');
  // an 8 m building, 30 m deep, 20 m wide, in open terrain, q 0.45 kPa: h = max(6, 8) = 8, C_e = 0.8^0.2, H/D 0.27
  const w = N.netWind({ q: 0.45, H: 8, D: 30, smallerPlan: 20, terrain: 'open' }), HD = 8 / 30;
  near(w.p, 0.45 * Math.pow(0.8, 0.2) * 2 * (0.27 * (HD + 2) + 0.27 * (HD + 0.88)), 1e-12, 'p = I_w q C_e C_t C_g (C_p,w − C_p,l)');
  assert.equal(N.NBC_TERRAIN.suburban, 'rough', 'suburban terrain is rough terrain (Clause 4.1.7.3.(5)(b))');
  assert.equal(N.importanceOf('Education'), 'High'); assert.equal(N.IMPORTANCE.High.Iw, 1.15);
});
