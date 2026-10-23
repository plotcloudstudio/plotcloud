// Plan Studio's plan annotations for Workspace v2 plan views: the selected piece's outline and turn handle,
// its clear distance to the nearest wall face on each side (click a number to type a new one), and clearance outlines.
// measure / clampGap / gapMove are ported from Plan Studio (emb/modeler.html, WBP); walls here are box components.
import { furnMesh } from './furn3d.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// the four faces of each wall box, as plan segments
export function wallFaces(walls) {
  const segs = [];
  for (const w of walls) { const { x, y, w: W, d: D } = w.g, q = [[x, y], [x + W, y], [x + W, y + D], [x, y + D]]; for (let i = 0; i < 4; i++) segs.push([q[i], q[(i + 1) % 4], w.id]); }
  return segs;
}
// for each side of a box, the clear distance from that edge to the nearest wall face beyond it (metres; Infinity when none)
export function measure(bb, segs) {
  const E = 5e-4, out = {};
  const run = (side) => {
    const map = { top: (p) => [p[0], p[1]], bottom: (p) => [-p[0], -p[1]], right: (p) => [-p[1], p[0]], left: (p) => [p[1], -p[0]] }[side];
    const unmapU = { top: (u, v) => [u, v], bottom: (u, v) => [-u, -v], right: (u, v) => [v, -u], left: (u, v) => [-v, u] }[side];
    const c = [map([bb.x0, bb.y0]), map([bb.x1, bb.y1])], u0 = Math.min(c[0][0], c[1][0]) + E, u1 = Math.max(c[0][0], c[1][0]) - E, v0 = Math.max(c[0][1], c[1][1]);
    let best = Infinity, at = null, wall = null;
    for (const [A0, B0, id] of segs) {
      let A = map(A0), B = map(B0); if (A[0] > B[0]) [A, B] = [B, A];
      if (B[0] < u0 || A[0] > u1) continue;
      const du = B[0] - A[0]; let P, Q;
      if (du < 1e-9) { P = A; Q = B; } else { const vAt = (u) => A[1] + (B[1] - A[1]) * (u - A[0]) / du, pa = Math.max(u0, A[0]), pb = Math.min(u1, B[0]); P = [pa, vAt(pa)]; Q = [pb, vAt(pb)]; }
      const lo = Math.min(P[1], Q[1]), hi = Math.max(P[1], Q[1]); if (hi < v0 - E) continue;
      let d, uu;
      if (lo >= v0 - E) { d = Math.max(0, lo - v0); uu = Math.abs(P[1] - Q[1]) < 1e-9 ? clamp((u0 + u1) / 2, P[0], Q[0]) : (P[1] < Q[1] ? P[0] : Q[0]); }
      else { d = 0; uu = (P[0] + Q[0]) / 2; }
      if (d < best - 1e-12) { best = d; at = uu; wall = id; }
    }
    if (!isFinite(best)) return { d: Infinity, from: null, to: null, wall: null };
    return { d: best, from: unmapU(at, v0), to: unmapU(at, v0 + best), wall };
  };
  for (const s of ['top', 'bottom', 'left', 'right']) out[s] = run(s);
  return out;
}
const OPP = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
export function clampGap(side, mm, res) {
  const cur = res[side].d, opp = res[OPP[side]].d, max = isFinite(opp) ? (cur + opp) * 1000 : Infinity;
  const v = +mm; if (!isFinite(v)) return { ok: false };
  const c = clamp(v, 0, max); return { ok: true, mm: c, clamped: Math.abs(c - v) > 1e-9, max };
}
export function gapMove(side, mm, res) { const dv = mm / 1000 - res[side].d; return { top: [0, -dv], bottom: [0, dv], right: [-dv, 0], left: [dv, 0] }[side]; }

// a piece's real footprint: the unrotated size turned by its rotation about the centre of its box
export function footprint(c) {
  const cx = c.g.x + c.g.w / 2, cy = c.g.y + c.g.d / 2; let W = c.g.w, D = c.g.d;
  if (c.furn) { const k = furnMesh({ ...c, rot: 0 }); if (k) { W = k.w; D = k.d; } }
  const r = (c.rot || 0) * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
  const at = (u, v) => [cx + u * cs - v * sn, cy + u * sn + v * cs];
  return { cx, cy, W, D, r, at, corners: [at(-W / 2, -D / 2), at(W / 2, -D / 2), at(W / 2, D / 2), at(-W / 2, D / 2)] };
}
export const boxOf = (pts) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }; };

// rounded closed path through screen points (Plan Studio draws clearance with rounded corners)
function rounded(P, r) {
  const n = P.length, seg = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], L = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  let d = '';
  for (let i = 0; i < n; i++) { const p0 = P[(i + n - 1) % n], p1 = P[i], p2 = P[(i + 1) % n], rr = Math.min(r, L(p0, p1) / 2, L(p1, p2) / 2);
    const a = seg(p1, p0, rr / (L(p0, p1) || 1)), b = seg(p1, p2, rr / (L(p1, p2) || 1)); d += `${i ? 'L' : 'M'}${a[0].toFixed(1)},${a[1].toFixed(1)}Q${p1[0].toFixed(1)},${p1[1].toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}`; }
  return d + 'Z';
}

// draw the overlay for one frame. S = (x, y) → screen px
export function drawPlan(svg, { S, ppm, sel, walls, furniture, clearanceOf, showClearance }) {
  const out = [];
  if (showClearance) for (const c of furniture) {
    const r = clearanceOf(c); if (!r) continue; const F = footprint(c), hw = F.W / 2, hd = F.D / 2;
    const P = [F.at(-hw - r.left, -hd - r.front), F.at(hw + r.right, -hd - r.front), F.at(hw + r.right, hd + r.back), F.at(-hw - r.left, hd + r.back)].map((p) => S(...p));   // front is −y, as in Plan Studio's models
    out.push(`<path class="pl-clr" data-id="${c.id}" d="${rounded(P, 0.12 * ppm)}"/>`);
  }
  let dims = null;
  if (sel) {
    const F = footprint(sel), P = F.corners.map((p) => S(...p)), ctr = S(F.cx, F.cy);
    out.push(`<polygon class="pl-box" points="${P.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}"/>`);
    if (sel.furn) { const top = [(P[2][0] + P[3][0]) / 2, (P[2][1] + P[3][1]) / 2], dx = top[0] - ctr[0], dy = top[1] - ctr[1], L = Math.hypot(dx, dy) || 1, rh = [top[0] + dx / L * 26, top[1] + dy / L * 26];
      out.push(`<line class="pl-rl" x1="${top[0]}" y1="${top[1]}" x2="${rh[0]}" y2="${rh[1]}"/><circle class="pl-rot" cx="${rh[0]}" cy="${rh[1]}" r="6"><title>Drag to turn (snaps to 5°)</title></circle>`); }
    const res = measure(boxOf(F.corners), wallFaces(walls)); dims = res;
    for (const side of ['top', 'bottom', 'left', 'right']) {
      const g = res[side]; if (!isFinite(g.d)) continue; const a = S(...g.from), b = S(...g.to), mm = Math.round(g.d * 1000);
      const vx = b[0] - a[0], vy = b[1] - a[1], len = Math.hypot(vx, vy), nx = len ? -vy / len : 0, ny = len ? vx / len : 1, t = 5;
      const tw = String(mm).length * 7 + 12, side2 = side === 'left' || side === 'right', mx = (a[0] + b[0]) / 2 + (len < 30 && !side2 ? tw / 2 + 8 : 0), my = (a[1] + b[1]) / 2 - (len < 30 && side2 ? 16 : 0);
      out.push(`<g class="pl-dim" data-side="${side}" data-mm="${mm}"><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/><line x1="${a[0] - nx * t}" y1="${a[1] - ny * t}" x2="${a[0] + nx * t}" y2="${a[1] + ny * t}"/><line x1="${b[0] - nx * t}" y1="${b[1] - ny * t}" x2="${b[0] + nx * t}" y2="${b[1] + ny * t}"/>`
        + `<g class="pl-lab" data-side="${side}" tabindex="0" role="button" aria-label="${side} distance ${mm} millimetres, click to change"><rect x="${(mx - tw / 2).toFixed(1)}" y="${(my - 10).toFixed(1)}" width="${tw}" height="20" rx="5"/><text x="${mx.toFixed(1)}" y="${(my + 4.5).toFixed(1)}">${mm}</text></g></g>`);
    }
  }
  svg.innerHTML = out.join('');
  return dims;
}
