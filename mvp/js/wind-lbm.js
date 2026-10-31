// Pedestrian-level wind for the Workspace (2026-10-31): a 2D lattice-Boltzmann flow (D2Q9, BGK) on a grid of the site at about
// 1.5 m, with buildings as solid cells (bounce-back), the free stream coming in at the upwind edges and a pressure outlet downwind. It gives, for one wind
// direction, the local speed over the free-stream speed at every cell. A 2D slice of flow: no flow over roofs or down
// facades, so it screens where buildings channel and shelter the wind (and overstates speed-up in narrow gaps, where real wind
// also goes over the roofs); it is not a 3D CFD result.
const E = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]], W = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36], OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6];
// solid: Uint8Array (1 = building); flow: [ux, uy] unit vector in grid axes (i to the east, j to the north); returns Float32Array ratio,
// with .cp the pressure coefficient at every cell ((p - p∞) / ½ρu∞²; NaN on solid) and .vx, .vy the velocity over the free stream
export function speedRatio(solid, nx, ny, flow, { iters = 0, u0 = 0.08, tau = 0.7 } = {}) {
  const N = nx * ny, f = new Float32Array(9 * N), g = new Float32Array(9 * N), ux0 = flow[0] * u0, uy0 = flow[1] * u0, om = 1 / tau;
  const feq = (k, rho, ux, uy) => { const eu = E[k][0] * ux + E[k][1] * uy, uu = ux * ux + uy * uy; return W[k] * rho * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * uu); };
  const F0 = E.map((_, k) => feq(k, 1, ux0, uy0));
  for (let c = 0; c < N; c++) for (let k = 0; k < 9; k++) f[k * N + c] = solid[c] ? W[k] : F0[k];
  const steps = iters || Math.round(3.5 * Math.max(nx, ny));
  for (let t = 0; t < steps; t++) {
    // collide
    for (let c = 0; c < N; c++) { if (solid[c]) continue; let rho = 0, ux = 0, uy = 0; for (let k = 0; k < 9; k++) { const v = f[k * N + c]; rho += v; ux += v * E[k][0]; uy += v * E[k][1]; } ux /= rho; uy /= rho;
      const uu = ux * ux + uy * uy; for (let k = 0; k < 9; k++) { const eu = E[k][0] * ux + E[k][1] * uy, q = W[k] * rho * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * uu); f[k * N + c] += om * (q - f[k * N + c]); } }
    // stream, bouncing back off buildings
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const c = j * nx + i; if (solid[c]) continue;
      for (let k = 0; k < 9; k++) { const ii = i + E[k][0], jj = j + E[k][1]; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue; const d = jj * nx + ii; if (solid[d]) g[OPP[k] * N + c] = f[k * N + c]; else g[k * N + d] = f[k * N + c]; } }
    // the edges: the free stream where the wind comes in; where it leaves, the free-stream pressure with the neighbouring cell's
    // velocity (a pressure outlet), so the flow is not forced through the buildings
    const edge = (c, d, inflow) => { if (inflow || solid[d]) { for (let k = 0; k < 9; k++) g[k * N + c] = F0[k]; return; } let rho = 0, ux = 0, uy = 0; for (let k = 0; k < 9; k++) { const v = g[k * N + d]; rho += v; ux += v * E[k][0]; uy += v * E[k][1]; } ux /= rho; uy /= rho; for (let k = 0; k < 9; k++) g[k * N + c] = feq(k, 1, ux, uy); };
    for (let i = 0; i < nx; i++) { edge(i, nx + i, flow[1] > 0.05); edge((ny - 1) * nx + i, (ny - 2) * nx + i, flow[1] < -0.05); }
    for (let j = 1; j < ny - 1; j++) { edge(j * nx, j * nx + 1, flow[0] > 0.05); edge(j * nx + nx - 1, j * nx + nx - 2, flow[0] < -0.05); }
    f.set(g); for (let c = 0; c < N; c++) if (solid[c]) for (let k = 0; k < 9; k++) f[k * N + c] = W[k];
  }
  const out = new Float32Array(N), cp = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N); for (let c = 0; c < N; c++) { if (solid[c]) { out[c] = NaN; cp[c] = NaN; continue; } let rho = 0, ux = 0, uy = 0; for (let k = 0; k < 9; k++) { const v = f[k * N + c]; rho += v; ux += v * E[k][0]; uy += v * E[k][1]; } vx[c] = ux / rho / u0; vy[c] = uy / rho / u0; out[c] = Math.hypot(vx[c], vy[c]); cp[c] = (rho - 1) / 3 / (0.5 * u0 * u0); }
  // pressure relative to the undisturbed wind: the mean over the fluid cells just inside the upwind edges
  let ref = 0, nr = 0; for (let i = 1; i < nx - 1; i++) for (const [j, on] of [[1, flow[1] > 0.05], [ny - 2, flow[1] < -0.05]]) if (on && !solid[j * nx + i]) { ref += cp[j * nx + i]; nr++; }
  for (let j = 1; j < ny - 1; j++) for (const [i, on] of [[1, flow[0] > 0.05], [nx - 2, flow[0] < -0.05]]) if (on && !solid[j * nx + i]) { ref += cp[j * nx + i]; nr++; }
  if (nr) { ref /= nr; for (let c = 0; c < N; c++) cp[c] -= ref; }
  out.cp = cp; out.vx = vx; out.vy = vy; return out;
}
