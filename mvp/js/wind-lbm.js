// Pedestrian-level wind for the Workspace (2026-10-31): a 2D lattice-Boltzmann flow (D2Q9, BGK) on a grid of the site at about
// 1.5 m, with buildings as solid cells (bounce-back) and the free stream held at the grid's edges. It gives, for one wind
// direction, the local speed over the free-stream speed at every cell. A 2D slice of flow: no flow over roofs or down
// facades, so it screens where buildings channel and shelter the wind (and overstates speed-up in narrow gaps, where real wind
// also goes over the roofs); it is not a 3D CFD result.
const E = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]], W = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36], OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6];
// solid: Uint8Array (1 = building); flow: [ux, uy] unit vector in grid axes (i to the east, j to the north); returns Float32Array ratio,
// with .cp the pressure coefficient at every cell ((p - p∞) / ½ρu∞²; NaN on solid)
export function speedRatio(solid, nx, ny, flow, { iters = 0, u0 = 0.08, tau = 0.7 } = {}) {
  const N = nx * ny, f = new Float32Array(9 * N), g = new Float32Array(9 * N), ux0 = flow[0] * u0, uy0 = flow[1] * u0, om = 1 / tau;
  const feq = (k, rho, ux, uy) => { const eu = E[k][0] * ux + E[k][1] * uy, uu = ux * ux + uy * uy; return W[k] * rho * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * uu); };
  const F0 = E.map((_, k) => feq(k, 1, ux0, uy0));
  for (let c = 0; c < N; c++) for (let k = 0; k < 9; k++) f[k * N + c] = solid[c] ? W[k] : F0[k];
  const steps = iters || Math.round(2.4 * Math.max(nx, ny));
  for (let t = 0; t < steps; t++) {
    // collide
    for (let c = 0; c < N; c++) { if (solid[c]) continue; let rho = 0, ux = 0, uy = 0; for (let k = 0; k < 9; k++) { const v = f[k * N + c]; rho += v; ux += v * E[k][0]; uy += v * E[k][1]; } ux /= rho; uy /= rho;
      const uu = ux * ux + uy * uy; for (let k = 0; k < 9; k++) { const eu = E[k][0] * ux + E[k][1] * uy, q = W[k] * rho * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * uu); f[k * N + c] += om * (q - f[k * N + c]); } }
    // stream, bouncing back off buildings
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const c = j * nx + i; if (solid[c]) continue;
      for (let k = 0; k < 9; k++) { const ii = i + E[k][0], jj = j + E[k][1]; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue; const d = jj * nx + ii; if (solid[d]) g[OPP[k] * N + c] = f[k * N + c]; else g[k * N + d] = f[k * N + c]; } }
    // the free stream at the edges
    for (let i = 0; i < nx; i++) for (const j of [0, ny - 1]) { const c = j * nx + i; for (let k = 0; k < 9; k++) g[k * N + c] = F0[k]; }
    for (let j = 0; j < ny; j++) for (const i of [0, nx - 1]) { const c = j * nx + i; for (let k = 0; k < 9; k++) g[k * N + c] = F0[k]; }
    f.set(g); for (let c = 0; c < N; c++) if (solid[c]) for (let k = 0; k < 9; k++) f[k * N + c] = W[k];
  }
  const out = new Float32Array(N), cp = new Float32Array(N); for (let c = 0; c < N; c++) { if (solid[c]) { out[c] = NaN; cp[c] = NaN; continue; } let rho = 0, ux = 0, uy = 0; for (let k = 0; k < 9; k++) { const v = f[k * N + c]; rho += v; ux += v * E[k][0]; uy += v * E[k][1]; } out[c] = Math.hypot(ux, uy) / rho / u0; cp[c] = (rho - 1) / 3 / (0.5 * u0 * u0); }
  out.cp = cp; return out;
}
