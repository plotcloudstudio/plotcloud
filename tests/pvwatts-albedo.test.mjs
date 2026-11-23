// Solar radiation (2026-11-23): the weather file's albedo and the PVWatts V5 equations, checked by hand. Albedo: the ground-reflected
// term is ρ·GHI each hour, so the period's GHI-weighted albedo must reproduce Σ ρ_h·GHI_h exactly; the fixed 0.2 is used when the file
// lacks albedo. PVWatts V5 (Dobos 2014): eq. (8) DC power with γ = −0.47 %/°C (standard module, table 3), 14 % losses (table 6),
// inverter eq. (10) with η_nom 0.96, η_ref 0.9637, DC/AC 1.1 and clipping eq. (11); cell temperature T_air + (45 − 20)·I/800.
import test from 'node:test'; import assert from 'node:assert/strict';
import { albedoEff, pvwattsFlat, PV_MODULES } from '../emb/lib/climate.js';
const E = (rows) => ({ GHR: rows.map((r) => r.g), T: rows.map((r) => r.t ?? 20), ALB: rows.map((r) => r.a ?? NaN) });
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
test('albedo from the weather file', () => {
  const e = E([{ g: 100, a: 0.2 }, { g: 300, a: 0.8 }, { g: 0, a: 0.5 }]); const r = albedoEff(e, [0, 1, 2]);
  assert.equal(r.fromFile, true); close(r.rho, (100 * 0.2 + 300 * 0.8) / 400, 1e-12, 'GHI-weighted');
  const m = albedoEff(E([{ g: 100, a: 0.3 }, { g: 300 }]), [0, 1]); assert.equal(m.fromFile, false); assert.equal(m.rho, 0.2, 'too little albedo data: the fixed 0.2');
});
test('PVWatts V5 equations by hand', () => {
  assert.deepEqual([PV_MODULES.standard.gamma, PV_MODULES.premium.gamma, PV_MODULES.thin.gamma], [-0.0047, -0.0035, -0.0020], 'table 3');
  // 1,000 W/m² with the cell at 25 °C: air at 25 − 25·1000/800 = −6.25 °C
  let r = pvwattsFlat(E([{ g: 1000, t: -6.25 }]), [0]); const pdc = 0.86, pdc0i = 1 / 1.1 / 0.96, z = pdc / pdc0i, eta = 0.96 / 0.9637 * (-0.0162 * z - 0.0059 / z + 0.9858);
  close(r.acPerKw, eta * pdc, 1e-9, 'AC at STC with 14 % losses'); close(eta, 0.9609, 5e-4, 'part-load inverter efficiency near 0.96');
  // the same hour without losses clips at the AC rating 1/1.1 kW
  r = pvwattsFlat(E([{ g: 1000, t: -6.25 }]), [0], { losses: 0 }); close(r.acPerKw, 1 / 1.1, 1e-9, 'clipped at P_ac0');
  // 800 W/m² at 20 °C air: cell 45 °C, DC 0.8·(1 − 0.0047·20)·0.86
  r = pvwattsFlat(E([{ g: 800, t: 20 }]), [0]); const d2 = 0.8 * (1 - 0.0047 * 20) * 0.86, z2 = d2 / pdc0i; close(r.acPerKw, d2 * 0.96 / 0.9637 * (-0.0162 * z2 - 0.0059 / z2 + 0.9858), 1e-9, 'hot cell');
  close(r.pr, r.acPerKw / 0.8, 1e-12, 'PR = AC energy / plane irradiation');
  assert.ok(pvwattsFlat(E([{ g: 800, t: 20 }]), [0], { module: 'thin' }).acPerKw > r.acPerKw, 'thin film loses less to heat');
});
