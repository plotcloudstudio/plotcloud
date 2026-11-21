// Stormwater grid (2026-11-21): mass balance and fill-and-spill on a conical bowl whose filled floor drains through many branches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stormwater } from '../mvp/js/stormwater-grid.js';

const nx = 21, ny = 21, N = nx * ny, z = new Float32Array(N), solid = new Uint8Array(N), C = new Float32Array(N).fill(1);
for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const r = Math.hypot(i - 10, j - 10); z[j * nx + i] = r < 5 ? 0.5 * r / 5 : 0.5 + 0.001 * (r - 5); }
const bowl = (() => { let n = 0; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (Math.hypot(i - 10, j - 10) < 4.9) n++; return n; })();

test('runoff equals rain times the coefficient', () => { const r = stormwater({ nx, ny, cell: 1, z, solid }, C, 10); assert.ok(Math.abs(r.runV - r.rainV) < 1e-9); assert.ok(Math.abs(r.rainV - N * 0.01) < 1e-9); });
test('a hollow receives the rain of all its cells, not one flow branch', () => {
  const r = stormwater({ nx, ny, cell: 1, z, solid }, C, 10); assert.equal(r.hollows.length, 1);
  assert.ok(Math.abs(r.hollows[0].inflow - bowl * 0.01) < 1e-6, `inflow ${r.hollows[0].inflow} vs ${bowl * 0.01}`); assert.ok(Math.abs(r.pondV - bowl * 0.01) < 1e-3); });
test('a big storm fills the hollow to its spill level and no more', () => {
  const r = stormwater({ nx, ny, cell: 1, z, solid }, C, 400), h = r.hollows[0]; assert.ok(h.full); assert.ok(Math.abs(r.pondV - h.cap) < 0.01); assert.ok(h.cap > 12 && h.cap < 14.5); });
