// Indoor acoustics, 3D view (emb/roomacoustics.html): one room of the plan with its surfaces, and a burst of sound particles from a
// source that fly at the speed of sound (slowed down to be seen), bounce off the walls, floor and ceiling, lose at each bounce the
// share the surface's finish absorbs in the chosen band (and a little to the air on the way), and fade as they lose it. The room's
// energy, summed over the particles, is drawn against the decay the reverberation formula gives. It is a picture of what the
// figures mean, not the calculation: the figures come from the formulas in the page.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const TRAIL = 7, HITS = 500, CELL = 0.05, SCATTER = 0.3, FLOOR_DB = -60;
// energy (dB below the start) → colour: white-hot, amber, coral, violet, deep blue
const STOPS = [[0, [1, 0.9, 0.62]], [-6, [1, 0.66, 0.22]], [-18, [1, 0.33, 0.38]], [-34, [0.55, 0.36, 1]], [-60, [0.12, 0.22, 0.6]]];
function heat(db) {
  if (db >= 0) return STOPS[0][1]; for (let i = 1; i < STOPS.length; i++) if (db >= STOPS[i][0]) { const [d0, c0] = STOPS[i - 1], [d1, c1] = STOPS[i], t = (db - d0) / (d1 - d0); return c0.map((v, k) => v + (c1[k] - v) * t); }
  return STOPS[STOPS.length - 1][1];
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.75)'); r.addColorStop(0.6, 'rgba(255,255,255,.18)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const distSeg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };

export function makeRoom3D(host, { onSource } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.setClearColor(0x0a0e16, 1); host.appendChild(renderer.domElement); renderer.domElement.setAttribute('aria-label', 'Room in 3D with sound particles bouncing off its surfaces');
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x0a0e16, 18, 60);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 400); camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.08;
  const hud = document.createElement('canvas'); hud.className = 'v3hud'; host.appendChild(hud);
  const tex = glowTexture(), room = new THREE.Group(); scene.add(room);
  let R = null, P = null, trails = null, hits = null, src = null, ring = null, stats = null, raf = 0, on = false, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches, last = 0, slow = 1 / 40, N = 600, pause = 0, hitK = 0;

  // ---- the room: a raster for "inside", its outline as wall pieces with their finish, openings, furniture, the level around it in faint lines
  function build(ctx) {
    room.clear(); const r = ctx.room, h = r.h || 2.7; if (!r.rects?.length) return null;
    const x0 = Math.min(...r.rects.map((q) => q[0])), y0 = Math.min(...r.rects.map((q) => q[1])), x1 = Math.max(...r.rects.map((q) => q[0] + q[2])), y1 = Math.max(...r.rects.map((q) => q[1] + q[3]));
    const W = Math.ceil((x1 - x0) / CELL), H = Math.ceil((y1 - y0) / CELL), IN = new Uint8Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = x0 + (i + 0.5) * CELL, y = y0 + (j + 0.5) * CELL; if (r.rects.some(([a, b, w, d]) => x >= a && x <= a + w && y >= b && y <= b + d)) IN[j * W + i] = 1; }
    const inside = (x, y) => { const i = Math.floor((x - x0) / CELL), j = Math.floor((y - y0) / CELL); return i >= 0 && j >= 0 && i < W && j < H && IN[j * W + i] === 1; };
    // outline: runs of cell edges between inside and outside
    const segs = [];
    for (let j = 0; j <= H; j++) { let run = null; for (let i = 0; i <= W; i++) { const a = j < H && i < W && IN[j * W + i], b = j > 0 && i < W && IN[(j - 1) * W + i], s = i < W && a !== b ? (a ? 1 : -1) : 0;
      if (run && run.s !== s) { segs.push({ a: [x0 + run.i * CELL, y0 + j * CELL], b: [x0 + i * CELL, y0 + j * CELL], n: [0, run.s] }); run = null; } if (s && !run) run = { i, s }; } }
    for (let i = 0; i <= W; i++) { let run = null; for (let j = 0; j <= H; j++) { const a = i < W && j < H && IN[j * W + i], b = i > 0 && j < H && IN[j * W + i - 1], s = j < H && a !== b ? (a ? 1 : -1) : 0;
      if (run && run.s !== s) { segs.push({ a: [x0 + i * CELL, y0 + run.j * CELL], b: [x0 + i * CELL, y0 + j * CELL], n: [run.s, 0] }); run = null; } if (s && !run) run = { j, s }; } }
    const wallOf = (p) => { let best = null, bd = 0.5; for (const w of ctx.walls) { const d = distSeg(p, w.a, w.b) - (w.t || 0.2) / 2; if (d < bd) { bd = d; best = w; } } return best; };
    const opens = ctx.open.filter((o) => { const m = [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2]; return segs.some((s) => distSeg(m, s.a, s.b) < 0.4); });
    // floor, with a faint 0.5 m grid; ceiling outline
    const floorM = new THREE.MeshBasicMaterial({ color: 0x121a28, transparent: true, opacity: 0.95 });
    const gridPts = [];
    for (const [a, b, w, d] of r.rects) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorM); m.position.set(a + w / 2, b + d / 2, 0); room.add(m);
      for (let x = Math.ceil(a / 0.5) * 0.5; x <= a + w + 1e-6; x += 0.5) gridPts.push(x, b, 0.002, x, b + d, 0.002); for (let y = Math.ceil(b / 0.5) * 0.5; y <= b + d + 1e-6; y += 0.5) gridPts.push(a, y, 0.002, a + w, y, 0.002); }
    room.add(lines(gridPts, 0x1d2a40, 0.9));
    // walls coloured by how much they absorb: hard ones slate blue, absorbent ones teal
    const edge = [];
    for (const s of segs) { const mid = [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2], w = wallOf(mid); s.mat = w ? w.mat : null; s.al = ctx.alphaAt('wall', s.mat);
      const L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]), g = new THREE.PlaneGeometry(L, h), soft = Math.min(1, s.al / 0.6);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.17 + 0.0 * soft, 0.23 + 0.5 * soft, 0.36 + 0.25 * soft), transparent: true, opacity: 0.16 + 0.22 * soft, side: THREE.DoubleSide, depthWrite: false }));
      m.position.set(mid[0], mid[1], h / 2); m.rotation.set(Math.PI / 2, 0, Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]), 'ZXY'); room.add(m);
      edge.push(s.a[0], s.a[1], 0, s.b[0], s.b[1], 0, s.a[0], s.a[1], h, s.b[0], s.b[1], h, s.a[0], s.a[1], 0, s.a[0], s.a[1], h); }
    room.add(lines(edge, 0x6f93c9, 0.85));
    for (const o of opens) { const L = Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]), top = Math.min(o.head ?? 2.1, h), bot = o.kind === 'door' || o.kind === 'hole' ? 0 : (o.sill ?? 0.9), oh = Math.max(0.05, top - bot);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(L, oh), new THREE.MeshBasicMaterial({ color: o.kind === 'win' ? 0x58a8ff : o.kind === 'door' ? 0xc98d55 : 0x0a0e16, transparent: true, opacity: o.kind === 'hole' ? 0.9 : 0.42, side: THREE.DoubleSide, depthWrite: false }));
      m.position.set((o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2, bot + oh / 2); m.rotation.set(Math.PI / 2, 0, Math.atan2(o.b[1] - o.a[1], o.b[0] - o.a[0]), 'ZXY'); room.add(m); }
    // furniture as boxes
    const boxM = new THREE.MeshBasicMaterial({ color: 0x1e2a3e, transparent: true, opacity: 0.75 }), boxE = new THREE.LineBasicMaterial({ color: 0x7d8fac, transparent: true, opacity: 0.8 });
    for (const f of r.furn || []) { if (!f.c || !(f.w > 0) || !(f.d > 0)) continue; const hh = Math.max(0.05, f.h || 0.5), g = new THREE.BoxGeometry(f.w, f.d, hh), m = new THREE.Mesh(g, boxM), e = new THREE.LineSegments(new THREE.EdgesGeometry(g), boxE);
      for (const o of [m, e]) { o.position.set(f.c[0], f.c[1], hh / 2); o.rotation.z = f.rot || 0; room.add(o); } }
    // the rest of the level, faint
    const rest = []; for (const w of ctx.walls) rest.push(w.a[0], w.a[1], 0, w.b[0], w.b[1], 0); room.add(lines(rest, 0x2a3956, 0.7));
    return { r, h, x0, y0, x1, y1, inside, segs, opens, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  function lines(pts, color, opacity) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity })); }

  // ---- the particles
  function makeParticles() {
    for (const o of [P?.pts, trails, hits]) if (o) { scene.remove(o); o.geometry.dispose(); }
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.13, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    scene.add(pts);
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * (TRAIL - 1) * 6), 3)); tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * (TRAIL - 1) * 6), 3));
    trails = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 })); scene.add(trails);
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(HITS * 3).fill(-999), 3)); hg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(HITS * 3), 3));
    hits = new THREE.Points(hg, new THREE.PointsMaterial({ size: 0.32, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true })); scene.add(hits);
    P = { pts, p: new Float32Array(N * 3), d: new Float32Array(N * 3), e: new Float32Array(N), tr: new Float32Array(N * TRAIL * 3), hitLife: new Float32Array(HITS), hitCol: new Float32Array(HITS * 3), t: 0, curve: [], bounces: 0 };
  }
  function burst() {
    if (!R || !P) return; const s = src.position; hitK = 0; P.hitLife.fill(0); P.t = 0; P.tD = 0; P.curve = [[0, 0]]; P.bounces = 0; pause = 0;
    for (let k = 0; k < N; k++) { const u = 2 * Math.random() - 1, ph = 2 * Math.PI * Math.random(), q = Math.sqrt(1 - u * u);
      P.p.set([s.x, s.y, s.z], k * 3); P.d.set([q * Math.cos(ph), q * Math.sin(ph), u], k * 3); P.e[k] = 1; for (let j = 0; j < TRAIL; j++) P.tr.set([s.x, s.y, s.z], (k * TRAIL + j) * 3); }
  }
  // a bounce: what the surface at this point is, the share it keeps, a flash; specular with some scattering (Lambert about the normal)
  function bounce(k, kind, n, at) {
    let al;
    if (kind === 'wall') { const o = R.opens.find((q) => distSeg(at, q.a, q.b) < 0.25 && at[2] >= (q.kind === 'win' ? (q.sill ?? 0.9) : 0) && at[2] <= (q.head ?? 2.1));
      if (o && o.kind === 'hole') { P.e[k] = 0; return; } al = o ? ctx.alphaAt(o.kind === 'win' ? 'window' : 'door', o.kind === 'win' ? o.glaz : null) : ctx.alphaAt('wall', (R.segs.find((s) => distSeg(at, s.a, s.b) < 0.08) || {}).mat); }
    else al = ctx.alphaAt(kind, null);
    const e0 = P.e[k]; P.e[k] = e0 * (1 - al); P.bounces++;
    if (Math.random() < SCATTER) { const r1 = Math.random(), r2 = Math.random(), cz = Math.sqrt(1 - r1), sz = Math.sqrt(r1), a = 2 * Math.PI * r2, t1 = Math.abs(n[2]) > 0.5 ? [1, 0, 0] : [0, 0, 1];
      const b1 = [n[1] * t1[2] - n[2] * t1[1], n[2] * t1[0] - n[0] * t1[2], n[0] * t1[1] - n[1] * t1[0]], L = Math.hypot(...b1); b1[0] /= L; b1[1] /= L; b1[2] /= L; const b2 = [n[1] * b1[2] - n[2] * b1[1], n[2] * b1[0] - n[0] * b1[2], n[0] * b1[1] - n[1] * b1[0]];
      for (let i = 0; i < 3; i++) P.d[k * 3 + i] = n[i] * cz + b1[i] * sz * Math.cos(a) + b2[i] * sz * Math.sin(a); }
    if (e0 > 1e-3 && Math.random() < 0.5) { const i = hitK++ % HITS, db = 10 * Math.log10(e0), c = heat(db), soak = al;
      P.hitLife[i] = 1; hits.geometry.attributes.position.array.set(at, i * 3); P.hitCol.set([c[0] * (1 - soak) + 0.1 * soak, c[1] * (1 - soak) + 0.85 * soak, c[2] * (1 - soak) + 0.8 * soak].map((v) => v * Math.min(1, 0.35 + e0)), i * 3); }
  }
  let ctx = null;
  // slow at first (the wave leaving the source, the first reflections), then faster, so the whole decay plays in about ten seconds
  const speed = () => Math.min(Math.max(slow, ctx.T / 8), slow * Math.pow(2, (P.tD || 0) / 1.5));
  function step(dtD) {
    if (!R || !P) return; const now = speed(), dt = dtD * now, c = ctx.c, m = ctx.m, h = R.h; let left = c * dt; P.tD += dtD;
    while (left > 1e-9) { const ds = Math.min(0.06, left); left -= ds;
      for (let k = 0; k < N; k++) { if (P.e[k] < 1e-7) continue; const i = k * 3; let x = P.p[i] + P.d[i] * ds, y = P.p[i + 1] + P.d[i + 1] * ds, z = P.p[i + 2] + P.d[i + 2] * ds;
        P.e[k] *= Math.exp(-m * ds);
        if (z < 0) { z = -z; P.d[i + 2] = -P.d[i + 2]; bounce(k, 'floor', [0, 0, 1], [x, y, 0]); } else if (z > h) { z = 2 * h - z; P.d[i + 2] = -P.d[i + 2]; bounce(k, 'ceiling', [0, 0, -1], [x, y, h]); }
        if (!R.inside(x, y)) { const ox = P.p[i], oy = P.p[i + 1], bx = !R.inside(x, oy), by = !R.inside(ox, y), n = [0, 0, 0];
          if (bx || !by) { n[0] = -Math.sign(P.d[i]); P.d[i] = -P.d[i]; x = ox; } if (by || !bx) { n[1] = -Math.sign(P.d[i + 1]); P.d[i + 1] = -P.d[i + 1]; y = oy; }
          const L = Math.hypot(n[0], n[1]) || 1; bounce(k, 'wall', [n[0] / L, n[1] / L, 0], [x, y, z]); }
        P.p[i] = x; P.p[i + 1] = y; P.p[i + 2] = z; } }
    P.t += dt; let E = 0; for (let k = 0; k < N; k++) E += P.e[k]; const db = 10 * Math.log10(Math.max(1e-12, E / N)); P.curve.push([P.t, db]);
    if (db < FLOOR_DB || P.t > Math.max(0.4, ctx.T * 1.6)) { pause += dtD; if (pause > 1.2) burst(); }
  }
  function paint() {
    if (!P) return; const pos = P.pts.geometry.attributes.position.array, col = P.pts.geometry.attributes.color.array, tp = trails.geometry.attributes.position.array, tc = trails.geometry.attributes.color.array;
    for (let k = 0; k < N; k++) { const i = k * 3, e = P.e[k], db = e > 1e-7 ? 10 * Math.log10(e) : -99, c = heat(db), f = e > 1e-6 ? Math.min(1, 0.25 + 0.75 * Math.pow(e, 0.25)) : 0;
      for (let j = TRAIL - 1; j > 0; j--) P.tr.copyWithin((k * TRAIL + j) * 3, (k * TRAIL + j - 1) * 3, (k * TRAIL + j) * 3); P.tr.set([P.p[i], P.p[i + 1], P.p[i + 2]], k * TRAIL * 3);
      pos[i] = P.p[i]; pos[i + 1] = P.p[i + 1]; pos[i + 2] = f ? P.p[i + 2] : -999; col[i] = c[0] * f; col[i + 1] = c[1] * f; col[i + 2] = c[2] * f;
      for (let j = 0; j < TRAIL - 1; j++) { const o = (k * (TRAIL - 1) + j) * 6, a = (k * TRAIL + j) * 3, b = a + 3, fa = f * (1 - j / (TRAIL - 1)) * 0.32, fb = f * (1 - (j + 1) / (TRAIL - 1)) * 0.32;
        tp[o] = P.tr[a]; tp[o + 1] = P.tr[a + 1]; tp[o + 2] = P.tr[a + 2]; tp[o + 3] = P.tr[b]; tp[o + 4] = P.tr[b + 1]; tp[o + 5] = P.tr[b + 2];
        tc[o] = c[0] * fa; tc[o + 1] = c[1] * fa; tc[o + 2] = c[2] * fa; tc[o + 3] = c[0] * fb; tc[o + 4] = c[1] * fb; tc[o + 5] = c[2] * fb; } }
    const hc = hits.geometry.attributes.color.array; for (let i = 0; i < HITS; i++) { const l = P.hitLife[i]; for (let q = 0; q < 3; q++) hc[i * 3 + q] = P.hitCol[i * 3 + q] * l; }
    for (const g of [P.pts.geometry, trails.geometry, hits.geometry]) { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; }
    hits.geometry.attributes.position.needsUpdate = true;
  }
  // the room's energy against the formula's decay
  function drawHud() {
    const d = Math.min(2, devicePixelRatio || 1), W = hud.clientWidth, H = hud.clientHeight; if (!W || !H) return; if (hud.width !== W * d) { hud.width = W * d; hud.height = H * d; }
    const g = hud.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(10,14,22,.78)'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(111,147,201,.35)'; g.strokeRect(0.5, 0.5, W - 1, H - 1);
    const T = ctx.T, tMax = Math.max(0.3, T * 1.25), L = 34, Rr = W - 10, Tp = 40, B = H - 22, X = (t) => L + (Rr - L) * Math.min(1, t / tMax), Y = (db) => Tp + (B - Tp) * Math.min(1, -db / 60);
    g.font = '10px system-ui, sans-serif'; g.fillStyle = '#9fb3d1'; g.strokeStyle = 'rgba(111,147,201,.18)';
    for (const db of [0, -20, -40, -60]) { g.beginPath(); g.moveTo(L, Y(db)); g.lineTo(Rr, Y(db)); g.stroke(); g.fillText(String(db), 6, Y(db) + 3); }
    const tk = tMax > 2 ? 1 : tMax > 0.8 ? 0.5 : 0.1; for (let t = 0; t <= tMax + 1e-9; t += tk) g.fillText(t.toFixed(tk < 0.5 ? 1 : 1) + ' s', X(t) - 8, H - 7);
    g.strokeStyle = 'rgba(31,224,190,.9)'; g.setLineDash([5, 4]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(Math.min(T, tMax)), Y(-60 * Math.min(T, tMax) / T)); g.stroke(); g.setLineDash([]);
    if (P && P.curve.length > 1) { g.strokeStyle = '#ffb347'; g.lineWidth = 2; g.beginPath(); P.curve.forEach(([t, db], i) => { const x = X(t), y = Y(Math.max(-60, db)); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
    g.fillStyle = '#e8eef8'; g.font = '600 11px system-ui, sans-serif'; g.fillText(`Sound energy in the room · ${ctx.bandName}`, 8, 15);
    g.font = '10px system-ui, sans-serif'; g.fillStyle = '#ffb347'; g.fillText('— the particles', 8, 29); g.fillStyle = '#1fe0be'; g.fillText(`- - ${ctx.formula}: −60 dB in T = ${T.toFixed(2)} s`, 96, 29);
    if (stats) stats.textContent = P ? `${(P.t * 1000).toFixed(0)} ms after the sound · ${P.bounces.toLocaleString('en')} bounces · ${N} particles · slowed ${Math.max(1, Math.round(1 / speed()))}×` : '';
  }
  function frame(now) {
    raf = 0; if (!on) return; const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    if (playing) { step(dt); for (let i = 0; i < HITS; i++) P.hitLife[i] = Math.max(0, P.hitLife[i] - dt * 1.8); }
    if (src && ring) { const s = 1 + 0.25 * Math.sin(now / 260); ring.scale.set(s, s, s); }
    paint(); controls.update(); renderer.render(scene, camera); drawHud(); raf = requestAnimationFrame(frame);
  }
  function size() { const W = host.clientWidth || 300, H = host.clientHeight || 200; renderer.setSize(W, H, false); renderer.domElement.style.width = W + 'px'; renderer.domElement.style.height = H + 'px'; camera.aspect = W / H; camera.updateProjectionMatrix(); }
  new ResizeObserver(size).observe(host);
  // double-click the floor to move the source
  renderer.domElement.addEventListener('dblclick', (e) => { if (!R) return; const b = renderer.domElement.getBoundingClientRect(), v = new THREE.Vector2(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1), rc = new THREE.Raycaster(); rc.setFromCamera(v, camera);
    const hit = new THREE.Vector3(); if (!rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit) || !R.inside(hit.x, hit.y)) return; src.position.set(hit.x, hit.y, 1.2); ring.position.set(hit.x, hit.y, 0.01); onSource && onSource([hit.x, hit.y]); burst(); });

  const api = {
    // ctx: { room, walls, open, alphaAt(kind, mat) at the band, c (m/s), m (air, 1/m), T (s), formula, bandName, source? [x, y] }
    show(c, { keepView = false } = {}) {
      const same = R && ctx && ctx.room.id === c.room.id; ctx = c; R = build(c); if (!R) return;
      if (!src) { src = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff })); ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.27, 40), new THREE.MeshBasicMaterial({ color: 0xffd48a, transparent: true, opacity: 0.8, side: THREE.DoubleSide })); }
      room.add(src, ring); let s = c.source && R.inside(c.source[0], c.source[1]) ? c.source : null;
      if (!s) { const lb = c.room.label; s = lb && R.inside(lb[0], lb[1]) ? lb : [c.room.rects[0][0] + c.room.rects[0][2] / 2, c.room.rects[0][1] + c.room.rects[0][3] / 2]; }
      src.position.set(s[0], s[1], 1.2); ring.position.set(s[0], s[1], 0.01);
      if (!(keepView && same)) { const span = Math.max(R.x1 - R.x0, R.y1 - R.y0, R.h); controls.target.set(R.cx, R.cy, R.h * 0.4); camera.position.set(R.cx - span * 0.95, R.cy - span * 1.35, R.h + span * 0.85); controls.update(); }
      if (!P || P.e.length !== N) makeParticles(); burst();
    },
    setVisible(v) { on = v; host.hidden = !v; if (v) { size(); last = 0; if (!raf) raf = requestAnimationFrame(frame); } },
    play(v) { playing = v ?? !playing; return playing; }, get playing() { return playing; },
    replay() { burst(); }, setSlow(s) { slow = s; }, setCount(n) { N = n; makeParticles(); burst(); },
    bindStats(el) { stats = el; }, canvas: () => renderer.domElement,
    // for tests: advance the burst without frames
    advance(sec, dt = 1 / 60) { for (let t = 0; t < sec; t += dt) step(dt); paint(); renderer.render(scene, camera); drawHud(); return { t: P.t, bounces: P.bounces, db: P.curve.at(-1)[1], alive: [...P.e].filter((e) => e > 1e-6).length, curve: P.curve }; },
  };
  return api;
}
