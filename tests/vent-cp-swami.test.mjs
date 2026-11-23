// Natural ventilation (2026-11-23): the Swami and Chandra (1988) surface-average wind pressure coefficient for low-rise buildings, as the
// EnergyPlus Engineering Reference (AirflowNetwork, wind pressure calculations) prints it, checked by hand:
// Cp = 0.6 ln[1.248 − 0.703 sin(α/2) − 1.175 sin²α + 0.131 sin³(2αG) + 0.769 cos(α/2) + 0.07 G² sin²(α/2) + 0.717 cos²(α/2)].
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const html = fs.readFileSync(new URL('../emb/modeler.html', import.meta.url), 'utf8'), start = html.indexOf('const STC = (() => {'), end = html.indexOf('\n})();', start) + 6;
const STC = Function(html.slice(start, end) + '\nreturn STC;')();
const hand = (deg, G) => { const a = deg * Math.PI / 180, s = Math.sin(a / 2), c = Math.cos(a / 2); return 0.6 * Math.log(1.248 - 0.703 * s - 1.175 * Math.sin(a) ** 2 + 0.131 * Math.sin(2 * a * G) ** 3 + 0.769 * c + 0.07 * G * G * s * s + 0.717 * c * c); };
test('Swami-Chandra Cp by hand', () => {
  const near = (x, y, t, m) => assert.ok(Math.abs(x - y) <= t, `${m}: ${x} vs ${y}`);
  near(STC.cpSwami(0, 0), 0.6 * Math.log(1.248 + 0.769 + 0.717), 1e-12, 'windward, 0°'); near(STC.cpSwami(0, 0), 0.603, 5e-4, 'about 0.603');
  near(STC.cpSwami(90, 0), -0.443, 5e-4, 'side wall, square plan'); near(STC.cpSwami(180, 0), -0.364, 5e-4, 'leeward, square plan');
  for (const deg of [15, 45, 75, 120, 165]) for (const G of [-1, -0.5, 0.5, 1, Math.log(3)]) near(STC.cpSwami(deg, G), hand(deg, G), 1e-12, `${deg}° G ${G.toFixed(2)}`);
  near(STC.cpSwami(-30, 0.5), STC.cpSwami(30, 0.5), 1e-12, 'the sign of the angle does not matter'); near(STC.cpSwami(330, 0.5), STC.cpSwami(30, 0.5), 1e-12, 'angles wrap at 360°');
  const rows = [0, 45, 90, 135, 180].map((d) => [d, +STC.cpSwami(d, 0).toFixed(3), +STC.cpWall(d, 'open').toFixed(3)]); console.log('angle, Swami-Chandra (square), AIVC exposed:', JSON.stringify(rows));
});
