// The public homepage (2026-10-31): a floating pill nav, a short direct headline over an interactive site model, and a grid of
// cards that each show one thing PlotCloud does, animated and answering the pointer. Every card is drawn in code (SVG), so it
// works with no images; a card can also show a picture from mvp/img/home/ (prompts in docs/home-image-prompts.md) when one exists.
// The earlier homepage stays at #/home-classic. Signed in, the nav offers the Dashboard; signed out, Log in and Get started.
import * as S from '../store.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const RAMP = ['#26306b', '#2f6db3', '#3fa6a0', '#9ccf6b', '#f2d44a', '#f08a2c'];
const ramp = (t) => RAMP[Math.max(0, Math.min(RAMP.length - 1, Math.round(t * (RAMP.length - 1))))];
// isometric projection of (x, y, z) metres-ish units into the card's SVG space
const iso = (x, y, z, s = 1, ox = 0, oy = 0) => [ox + (x - y) * 0.866 * s, oy + (x + y) * 0.5 * s - z * s];
const pts = (a) => a.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');
function box(x, y, w, d, h, s, ox, oy, cls = '') {   // an extruded block: top, left and right faces
  const P = (a, b, c) => iso(a, b, c, s, ox, oy), t = [P(x, y, h), P(x + w, y, h), P(x + w, y + d, h), P(x, y + d, h)];
  return `<g class="${cls}"><polygon class="f-l" points="${pts([P(x, y + d, 0), P(x + w, y + d, 0), P(x + w, y + d, h), P(x, y + d, h)])}"/><polygon class="f-r" points="${pts([P(x + w, y, 0), P(x + w, y + d, 0), P(x + w, y + d, h), P(x + w, y, h)])}"/><polygon class="f-t" points="${pts(t)}"/></g>`;
}

export async function render(app, rest, params, context = {}) {
  const user = S.account().user, alive = () => (context.isCurrent ? context.isCurrent() : true);
  document.body.classList.add('lp-full');
  const start = user ? '#/new-project' : '#/login?next=new-project';
  app.innerHTML = `<div class="lp">
  <nav class="lp-nav" aria-label="Main"><a class="lp-logo" href="#/">plot<b>cloud</b></a>
    <div class="lp-links"><a href="#lp-studies">Studies</a><a href="#/resources">Resources</a><a href="#/pricing">Pricing</a></div>
    <div class="lp-cta">${user ? `<a class="lp-btn" href="#/home">Open Dashboard</a>` : `<a class="lp-login" href="#/login">Log in</a><a class="lp-btn" href="#/login?next=new-project">Get started</a>`}</div></nav>

  <header class="lp-hero">
    <div class="lp-copy"><h1>Design on the real site.<br><span>Test it as you draw.</span></h1>
      <p>Type an address and start on the terrain and the buildings around it. Mass, plan and test sun, daylight, wind and noise in one model, then compare sketches side by side.</p>
      <div class="lp-actions"><a class="lp-btn lp-big" href="${start}">Start a project</a><a class="lp-ghost" href="#lp-studies">See what it does</a></div></div>
    <div class="lp-stage" id="lpHero" aria-label="A site with sun hours on the ground; move the pointer to move the sun"><svg viewBox="0 0 640 420" role="img" aria-label="Sun hours on a site"></svg><span class="lp-hint">Move to move the sun</span></div>
  </header>

  <section class="lp-grid" id="lp-studies">
    <article class="lp-card lp-c1" data-card="figures"><div class="lp-vis" id="lpFigures"></div><h3>Figures as you design</h3><p>Floor area, footprint and storeys update with every edit. No take-offs, no waiting for a rebuild.</p></article>
    <article class="lp-card lp-c2" data-card="massing"><div class="lp-vis" id="lpMassing"><svg viewBox="0 0 760 330"></svg><div class="lp-tip" id="lpTip"><small>Drag to change storeys</small><b>Height 18.0 m</b><b>6 storeys</b></div></div><h3>Fast massing iterations</h3><p>Push and pull masses straight in the model. Storeys and heights change in seconds, so you compare options instead of committing to one.</p></article>
    <article class="lp-card lp-c3" data-card="site"><div class="lp-vis" id="lpSite"><div class="lp-type"><span id="lpAddr"></span><i></i></div><svg viewBox="0 0 400 260"></svg></div><h3>The site from an address</h3><p>Terrain, surrounding buildings, roads and weather are fetched for the address you type, ready before the first study.</p></article>
    <article class="lp-card lp-c4" data-card="compare"><div class="lp-vis" id="lpCompare"></div><h3>Compare sketches</h3><p>Every saved version is a sketch. See floor area and study results side by side and export them to Excel.</p></article>
    <article class="lp-card lp-c5" data-card="studies"><div class="lp-vis" id="lpStudies"></div><h3>Every study in one place</h3><p>Building and interior studies open inside the Workspace and run on the version you are drawing.</p></article>
    <article class="lp-card lp-c6" data-card="drawings"><div class="lp-vis" id="lpDraw"><svg viewBox="0 0 400 240"></svg></div><h3>Plans out to DXF</h3><p>Levels go out as DXF with dimensions, room names and areas, for the CAD drawings you already make.</p></article>
  </section>

  <section class="lp-band"><h2>Screening for early design.</h2><p>Studies are estimates for comparing options, with their method and inputs kept with every result. They are not code compliance.</p><a class="lp-btn lp-big" href="${start}">Start a project</a></section>
  <footer class="lp-foot"><span>plot<b>cloud</b></span><a href="#/pricing">Pricing</a><a href="#/resources">Resources</a><a href="#/legal">Legal</a><a href="#/home-classic">Earlier homepage</a></footer>
</div>`;
  const stops = [hero(app), figures(app), massing(app), site(app), compare(app), studies(app), drawings(app)];
  // optional pictures (generated from docs/home-image-prompts.md): shown only when the file exists
  for (const [k, file] of [['massing', 'massing'], ['site', 'site'], ['drawings', 'drawings']]) { const im = new Image(); im.onload = () => { if (!alive()) return; const v = app.querySelector(`[data-card="${k}"] .lp-vis`); if (v) { im.className = 'lp-photo'; im.alt = ''; v.prepend(im); v.classList.add('has-photo'); } }; im.src = `img/home/${file}.webp`; }
  return () => { stops.forEach((f) => f?.()); document.body.classList.remove('lp-full'); };
}

// the hero: a topographic block with a building; the sun follows the pointer and the sun hours on the ground redraw
function hero(app) {
  const svg = app.querySelector('#lpHero svg'), N = 22, s = 12.5, ox = 320, oy = 92;
  const ground = (i, j) => 1.1 * Math.sin(i / 5) * Math.cos(j / 6) + 0.8 * Math.sin((i + j) / 9);   // gentle relief
  const B = [[8, 7, 4, 5, 5], [13, 9, 3, 3, 3], [6, 13, 3, 4, 2]];   // x, y, w, d, storeys (×3 units)
  const shadeAt = (i, j, sun) => { let h = 0; for (const [x, y, w, d, st] of B) { const H = st * 1.6; for (let k = 1; k < 14; k++) { const px = i - sun[0] * k * 0.6, py = j - sun[1] * k * 0.6; if (px >= x && px <= x + w && py >= y && py <= y + d && k * 0.6 * sun[2] < H) { h++; break; } } } return h; };
  let az = 0.6, raf = 0, tgt = 0.6;
  function draw() {
    const sun = [Math.cos(az), Math.sin(az), 0.55]; let out = '';
    for (let j = N - 1; j >= 0; j--) for (let i = N - 1; i >= 0; i--) { const z = ground(i, j), inB = B.some(([x, y, w, d]) => i >= x && i < x + w && j >= y && j < y + d); if (inB) continue;
      const v = 1 - shadeAt(i + 0.5, j + 0.5, sun) * 0.8 - 0.15 * Math.max(0, -Math.cos(az - Math.atan2(j - N / 2, i - N / 2))), q = [iso(i, j, z, s, ox, oy), iso(i + 1, j, ground(i + 1, j), s, ox, oy), iso(i + 1, j + 1, ground(i + 1, j + 1), s, ox, oy), iso(i, j + 1, ground(i, j + 1), s, ox, oy)];
      const fade = Math.max(0, 1 - Math.hypot(i - N / 2, j - N / 2) / (N * 0.62)); out += `<polygon points="${pts(q)}" fill="${ramp(v)}" fill-opacity="${(0.25 + 0.7 * fade).toFixed(2)}"/>`; }
    const side = [iso(N, 0, ground(N, 0), s, ox, oy), iso(N, N, ground(N, N), s, ox, oy), iso(N, N, -3, s, ox, oy), iso(N, 0, -3, s, ox, oy)], side2 = [iso(0, N, ground(0, N), s, ox, oy), iso(N, N, ground(N, N), s, ox, oy), iso(N, N, -3, s, ox, oy), iso(0, N, -3, s, ox, oy)];
    const bld = B.map(([x, y, w, d, st]) => box(x, y, w, d, st * 1.6 + ground(x, y), s, ox, oy, 'lp-bld')).join('');
    const sp = iso(N / 2 + Math.cos(az) * 13, N / 2 + Math.sin(az) * 13, 12, s, ox, oy);
    svg.innerHTML = `<polygon class="lp-side" points="${pts(side)}"/><polygon class="lp-side2" points="${pts(side2)}"/>${out}${bld}<circle cx="${sp[0].toFixed(1)}" cy="${sp[1].toFixed(1)}" r="11" class="lp-sun"/><line x1="${sp[0].toFixed(1)}" y1="${sp[1].toFixed(1)}" x2="${iso(N / 2, N / 2, 0, s, ox, oy)[0].toFixed(1)}" y2="${iso(N / 2, N / 2, 0, s, ox, oy)[1].toFixed(1)}" class="lp-ray"/>`;
  }
  const loop = () => { az += (tgt - az) * 0.12; draw(); if (Math.abs(tgt - az) > 0.002) raf = requestAnimationFrame(loop); else raf = 0; };
  const go = (t) => { tgt = t; if (!raf) raf = requestAnimationFrame(loop); };
  const stage = app.querySelector('#lpHero'), move = (e) => { const r = stage.getBoundingClientRect(); go(-0.4 + 2.6 * (e.clientX - r.left) / r.width); };
  stage.addEventListener('pointermove', move); draw();
  let t = 0; const idle = setInterval(() => { if (stage.matches(':hover')) return; t += 0.05; go(0.6 + Math.sin(t) * 1.1); }, 120);
  return () => { clearInterval(idle); cancelAnimationFrame(raf); };
}
// live figures: a table whose numbers move as storeys change, and a small bar chart beside it
function figures(app) {
  const host = app.querySelector('#lpFigures'); let st = 6, dir = 1;
  const draw = () => { const fp = 1450, gfa = fp * st, prev = fp * (st - dir);
    host.innerHTML = `<div class="lp-table"><div class="lp-tabs"><b>Building</b><span>Site</span><span>Space</span><span>Results</span></div>
      <div><span>Gross floor area</span><em class="${dir > 0 ? 'up' : 'down'}">${dir > 0 ? '+' : '−'}${(1450).toLocaleString('en')}</em><b>${gfa.toLocaleString('en')} m²</b></div><div><span>Footprint</span><b>${fp.toLocaleString('en')} m²</b></div><div><span>Storeys</span><b>${st}</b></div><div><span>Height</span><b>${(st * 3).toFixed(1)} m</b></div></div>
      <div class="lp-chart"><small><b>Ground with ≥ 2 h sun</b></small><div>${[30, 34, 41, 48, 56, 63, 72, 79, 88].map((h, i) => `<i style="height:${Math.max(6, h - st * 4 + 20)}%;background:${ramp(i / 8)}"></i>`).join('')}</div></div>`; void prev; };
  draw(); const t = setInterval(() => { if (st >= 9) dir = -1; if (st <= 4) dir = 1; st += dir; draw(); }, 1600);
  return () => clearInterval(t);
}
// massing: drag a block up and down; storeys and height follow, with a measurement tooltip
function massing(app) {
  const svg = app.querySelector('#lpMassing svg'), tip = app.querySelector('#lpTip'), s = 7.5, ox = 380, oy = 120; let st = 6, drag = null, phase = 0;
  const draw = () => { let g = `<polygon class="lp-plot" points="${pts([iso(0, 0, 0, s, ox, oy), iso(40, 0, 0, s, ox, oy), iso(40, 28, 0, s, ox, oy), iso(0, 28, 0, s, ox, oy)])}"/>`;
    for (let k = 0; k < 5; k++) g += box(3 + k * 7, 2, 5, 6, 6, s, ox, oy, 'lp-house');
    for (let k = 0; k < 4; k++) g += box(30, 10 + k * 4.5, 7, 3.5, 5, s, ox, oy, 'lp-house');
    g += box(8, 14, 16, 10, st * 2.2, s, ox, oy, 'lp-mass');
    for (let k = 1; k < st; k++) { const a = iso(8, 24, k * 2.2, s, ox, oy), b = iso(24, 24, k * 2.2, s, ox, oy), c = iso(24, 14, k * 2.2, s, ox, oy); g += `<polyline class="lp-floor" points="${pts([a, b, c])}"/>`; }
    const top = iso(16, 19, st * 2.2, s, ox, oy); g += `<circle class="lp-handle" cx="${top[0].toFixed(1)}" cy="${top[1].toFixed(1)}" r="7"/>`;
    svg.innerHTML = g; tip.style.left = (top[0] / 760 * 100 + 3) + '%'; tip.style.top = (top[1] / 330 * 100 - 6) + '%'; tip.querySelectorAll('b')[0].textContent = `Height ${(st * 3).toFixed(1)} m`; tip.querySelectorAll('b')[1].textContent = `${st} storeys`; };
  const yToSt = (y) => { const r = svg.getBoundingClientRect(), vy = (y - r.top) / r.height * 330, base = iso(16, 19, 0, s, ox, oy)[1]; return Math.max(1, Math.min(9, Math.round((base - vy) / (2.2 * s)))); };
  svg.addEventListener('pointerdown', (e) => { drag = true; svg.setPointerCapture(e.pointerId); st = yToSt(e.clientY); draw(); });
  svg.addEventListener('pointermove', (e) => { if (drag) { st = yToSt(e.clientY); draw(); } });
  svg.addEventListener('pointerup', () => { drag = false; });
  draw(); const t = setInterval(() => { if (drag || svg.matches(':hover')) return; phase += 1; st = Math.round(5 + 3 * Math.sin(phase / 2)); draw(); }, 900);
  return () => clearInterval(t);
}
// site from an address: the address types itself, then contours and buildings draw in
function site(app) {
  const addr = app.querySelector('#lpAddr'), svg = app.querySelector('#lpSite svg'), places = ['4371 Fir St, Burnaby', '1 Queen St W, Toronto', 'Kungsgatan 4, Stockholm', 'Shibuya 2-21, Tokyo'];
  let pi = 0, ci = 0, wait = 0, drawn = -1;
  const drawSite = (seed) => { const R = (n) => (Math.sin(seed * 99 + n * 7.13) + 1) / 2; let g = '';
    for (let k = 0; k < 7; k++) { let d = ''; for (let a = 0; a <= 64; a++) { const t = a / 64 * Math.PI * 2, r = 30 + k * 16 + 8 * Math.sin(t * 3 + seed + k) ; d += (a ? 'L' : 'M') + (200 + r * Math.cos(t) * 1.6).toFixed(1) + ',' + (130 + r * Math.sin(t) * 0.8).toFixed(1); } g += `<path d="${d}" class="lp-contour" style="animation-delay:${k * 80}ms"/>`; }
    g += `<path d="M0,${150 + 30 * R(1)} C120,${120 + 40 * R(2)} 260,${190 - 40 * R(3)} 400,${140 + 30 * R(4)}" class="lp-road"/>`;
    for (let k = 0; k < 16; k++) { const x = 40 + R(k + 5) * 320, y = 40 + R(k + 25) * 180, w = 12 + R(k + 45) * 22, h = 10 + R(k + 65) * 16; g += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" class="lp-bldg" style="animation-delay:${300 + k * 40}ms"/>`; }
    g += `<circle cx="200" cy="130" r="6" class="lp-pin"/>`; svg.innerHTML = g; };
  const t = setInterval(() => { const a = places[pi];
    if (ci <= a.length) { addr.textContent = a.slice(0, ci++); return; }
    if (drawn !== pi) { drawn = pi; drawSite(pi + 1); }
    if (++wait > 26) { wait = 0; ci = 0; pi = (pi + 1) % places.length; } }, 90);
  return () => clearInterval(t);
}
// compare sketches: three sketch columns; the current one moves along
function compare(app) {
  const host = app.querySelector('#lpCompare'), S3 = [['Sketch 1', 8700, 62], ['Sketch 2', 11600, 54], ['Sketch 3', 9900, 71]]; let cur = 0;
  const draw = () => { host.innerHTML = `<div class="lp-sk">${S3.map(([n, g, s], i) => `<div class="${i === cur ? 'cur' : ''}"><i style="--h:${30 + i * 18}%"></i><b>${n}</b><small>${i === cur ? 'Current' : 'v' + (i + 1)}</small><span>${g.toLocaleString('en')} m²</span><span>${s}% ≥ 2 h sun</span></div>`).join('')}</div>`; };
  draw(); const t = setInterval(() => { cur = (cur + 1) % 3; draw(); }, 2200);
  host.addEventListener('pointerover', (e) => { const d = e.target.closest('.lp-sk > div'); if (d) { cur = [...d.parentNode.children].indexOf(d); draw(); } });
  return () => clearInterval(t);
}
// every study in one place: the study list, one lit at a time
function studies(app) {
  const host = app.querySelector('#lpStudies'), L = [['Building', ['Sun hours', 'Solar radiation', 'Wind flow', 'Outdoor comfort', 'Daylight']], ['Interior', ['Room acoustics', 'Views', 'Natural ventilation', 'Evacuation', 'Space syntax']]];
  host.innerHTML = L.map(([c, xs]) => `<div><small>${c}</small>${xs.map((x) => `<span>${esc(x)}</span>`).join('')}</div>`).join('');
  const all = [...host.querySelectorAll('span')]; let k = 0; const t = setInterval(() => { all.forEach((s, i) => s.classList.toggle('on', i === k)); k = (k + 1) % all.length; }, 700);
  return () => clearInterval(t);
}
// plans out to DXF: a plan draws its walls, then its dimensions
function drawings(app) {
  const svg = app.querySelector('#lpDraw svg');
  svg.innerHTML = `<g class="lp-plan"><path d="M60,40 H300 V190 H60 Z M180,40 V120 M180,150 V190 M60,120 H140 M220,120 H300"/><path class="lp-dim" d="M60,210 H300 M60,204 V216 M300,204 V216"/><text x="180" y="226">15 750</text><text x="110" y="85">Living 42.0 m²</text><text x="230" y="85">Bed 18.4 m²</text><text x="110" y="165">Kitchen</text><text x="236" y="165">Bath</text></g>`;
  return () => { };
}
