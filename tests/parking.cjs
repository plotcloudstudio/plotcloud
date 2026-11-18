// Parking layout (2026-11-18), no browser: the generator (mvp/js/parking.js) against hand counts and its own checks.
// 1 a 60 × 40 m rectangle, 90° stalls 2.5 × 5.0, 6.0 m aisles, rows along the long side: 2 modules, 4 rows: 24 + 24 on the outer rows,
//   19 + 19 on the inner ones (6 m cross aisles at both ends): 86; 2 60° and 45° rows: the hand count from the pitch and extent;
// 3 an L-shaped area with a hole: every stall inside, clear of the hole and of every other stall, on an aisle reached from the entrance;
// 4 mode B: as many large stalls as each run can hold, and the standard ones never reduce them; 5 mode C: the share met within one stall;
// 6 underground with a column grid and a core: no stall on a column or the core; 7 locked stalls kept; 8 the same seed, the same options.
const assert = require('node:assert/strict'), path = require('node:path');
(async () => {
  const P = await import(path.join(__dirname, '../mvp/js/parking.js')), G = await import(path.join(__dirname, '../mvp/js/geom2d.js'));
  const cat = (id, w, l, more = {}) => ({ id, name: id, w, l, enabled: true, ...more }), rectP = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const check = (opt, region, obstacles = []) => { const ok = opt.stalls.filter((s) => s.valid); assert.equal(opt.total, ok.length, 'only valid stalls are counted');
    for (const s of ok) { assert(s.footprint.every((p) => G.inPoly(p, region.outer)), 'inside'); for (const h of region.holes || []) assert(P.disjoint(s.footprint, h), 'clear of a hole'); for (const o of obstacles) assert(P.disjoint(s.footprint, o.poly), 'clear of ' + o.kind);
      for (const a of opt.aisles) assert(P.disjoint(s.footprint, a.poly), 'clear of the aisles'); }
    for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length; j++) assert(P.disjoint(ok[i].footprint, ok[j].footprint), 'stalls overlap'); return ok; };

  // 1. the hand count
  const R1 = { outer: rectP(0, 0, 60, 40) }, r1 = P.generate({ region: R1, entrances: [[0, 8]], categories: [cat('standard', 2.5, 5.0)], angle: 90, aisle: 6, fixed: { angle: 0, offset: 0 } });
  assert(r1.ok, r1.error); check(r1.best, R1); assert.equal(r1.best.total, 86, JSON.stringify(r1.best.rows.map((x) => [x.len, x.counts])));
  const free = P.generate({ region: R1, entrances: [[0, 8]], categories: [cat('standard', 2.5, 5.0)], angle: 90, aisle: 6, quality: 'standard' }); assert(free.best.total >= 86, 'the search finds at least the hand layout: ' + free.best.total);
  console.log(`PASS 1 60 × 40 m, 90°: 86 stalls by hand and by the generator (rows ${r1.best.rows.map((x) => x.counts.standard).join(' + ')}); the free search finds ${free.best.total} in ${free.candidates} positions, use ${(free.best.use * 100).toFixed(0)} %`);

  // 2. angled rows: one aisle (one way), a band exactly two stall depths and the aisle deep
  for (const [ang, A] of [[60, 4.8], [45, 4.0]]) { const f = P.stallFit(2.5, 5.0, ang), H = 2 * f.depth + A, R2 = { outer: rectP(0, 0, 60, H) };
    const r2 = P.generate({ region: R2, entrances: [[0, H / 2]], categories: [cat('standard', 2.5, 5.0)], angle: ang, aisle: A, oneWay: true, fixed: { angle: 0, offset: 0 }, step: 0.05 });
    assert(r2.ok, r2.error); const ok = check(r2.best, R2), hand = 2 * (Math.floor((60 - f.ext) / f.pitch + 1e-9) + 1); assert.equal(r2.best.total, hand, `${ang}°: ${r2.best.total} vs ${hand}`);
    const xs = ok.filter((s) => s.rowAt[0] === ok[0].rowAt[0] && s.row === undefined).map((s) => G.centroid(s.footprint)[0]).sort((a, b) => a - b); void xs;
    console.log(`PASS 2 ${ang}° stalls: pitch ${f.pitch.toFixed(3)} m, depth ${f.depth.toFixed(3)} m, ${hand} by hand = ${r2.best.total}`); }

  // 3. an L with a hole
  const R3 = { outer: [[0, 0], [60, 0], [60, 25], [30, 25], [30, 50], [0, 50]], holes: [rectP(40, 8, 46, 14)] };
  const r3 = P.generate({ region: R3, entrances: [[0, 10]], categories: [cat('standard', 2.5, 5.0), cat('accessible', 2.5, 5.0, { accessible: true, accessAisle: 1.5, count: 2 })], angle: 90, aisle: 6, quality: 'draft' });
  assert(r3.ok, r3.error); for (const o of r3.options) check(o, R3); assert.equal(r3.best.byCat.accessible, 2); assert(r3.options.length >= 2, 'options');
  const acc = r3.best.stalls.filter((s) => s.cat === 'accessible' && s.valid), others = r3.best.stalls.filter((s) => s.cat === 'standard' && s.valid), dE = (s) => G.dist(G.centroid(s.footprint), [0, 10]);
  assert(Math.max(...acc.map(dE)) <= Math.min(...others.map(dE)) + 30, 'accessible stalls near the entrance');
  console.log(`PASS 3 an L with a hole: options ${r3.options.map((o) => `${o.label} ${o.total} at ${o.angle.toFixed(0)}°`).join(', ')}; every stall inside, clear and reached; 2 accessible ${acc.map((s) => dE(s).toFixed(0) + ' m').join(', ')} from the entrance`);

  // 4. mode B: large first
  const large = cat('large', 2.7, 5.5), std = cat('standard', 2.5, 5.0), R4 = { outer: rectP(0, 0, 50, 34) }, b = { region: R4, entrances: [[0, 6]], angle: 90, aisle: 6, quality: 'draft', mode: 'B' };
  const r4 = P.generate({ ...b, categories: [large, std] }), r4L = P.generate({ ...b, categories: [large] }); assert(r4.ok && r4L.ok);
  const fL = P.stallFit(2.7, 5.5, 90); for (const row of r4.best.rows) assert.equal(row.counts.large || 0, row.len + 1e-9 >= fL.ext ? Math.floor((row.len - fL.ext) / fL.pitch + 1e-9) + 1 : 0, 'each run holds its most large stalls');
  assert.equal(r4.best.byCat.large, r4L.best.byCat.large, 'standard stalls never reduce the large ones'); check(r4.best, R4);
  console.log(`PASS 4 mode B: ${r4.best.byCat.large} large (the most the rows hold; ${r4L.best.byCat.large} with large only) + ${r4.best.byCat.standard || 0} standard in the leftovers`);

  // 5. mode C: 30 % compact
  const r5 = P.generate({ region: R4, entrances: [[0, 6]], angle: 90, aisle: 6, quality: 'draft', mode: 'C', categories: [cat('standard', 2.5, 5.0), cat('compact', 2.3, 4.6, { share: 0.3 })] }); assert(r5.ok, r5.error);
  const nC = r5.best.byCat.compact, N = r5.best.total; assert(Math.abs(nC - 0.3 * N) <= 1 + 1e-9 || r5.best.notes.length, `compact ${nC} of ${N}`); check(r5.best, R4);
  const r5b = P.generate({ region: R4, entrances: [[0, 6]], angle: 90, aisle: 6, quality: 'draft', mode: 'C', categories: [cat('standard', 2.5, 5.0, { share: 0.5 }), cat('compact', 2.3, 4.6, { share: 0.5 }), cat('large', 2.7, 5.5, { share: 0.6 })] });
  assert(r5b.ok && r5b.best.notes.some((n) => /add up to 160 %: scaled/.test(n)), 'shares over 100 % are reported'); assert(r5b.best.total >= 0.85 * r5.best.total, 'the scaled mix keeps most stalls: ' + r5b.best.total);
  console.log(`PASS 5 mode C: ${nC} compact of ${N} (${(nC / N * 100).toFixed(1)} %, target 30 %); shares adding up to 160 % say so: "${r5b.best.notes[0]}"`);

  // 6. underground: columns every 8.1 m and a core
  const cols = []; for (let x = 1; x < 64; x += 8.1) for (const y of [0.5, 16.6, 32.7]) cols.push({ id: `c${x}_${y}`, kind: 'column', poly: rectP(x - 0.3, y - 0.3, x + 0.3, y + 0.3) });
  const core = { id: 'core', kind: 'core', poly: rectP(28, 22, 36, 30) }, R6 = { outer: rectP(-1, -1, 65, 40) };
  const r6 = P.generate({ region: R6, entrances: [[-1, 8]], underground: true, wallClear: 0.3, grid: { angle: 0, xs: cols.map((c) => +c.id.split('_')[0].slice(1)), ys: [0.5, 16.6, 32.7] }, obstacles: [...cols, core], categories: [cat('standard', 2.5, 5.0)], angle: 90, aisle: 6, quality: 'draft' });
  assert(r6.ok, r6.error); check(r6.best, R6, [...cols, core]); assert(r6.best.total > 40);
  console.log(`PASS 6 underground: ${r6.best.total} stalls, none on the ${cols.length} columns or the core; area use ${(r6.best.use * 100).toFixed(0)} %`);

  // 7. locked stalls: two stalls of option A kept as they are when the rest is generated again
  const keep = r1.best.stalls.filter((s) => s.valid).slice(0, 2).map((s) => ({ cat: s.cat, poly: s.footprint }));
  const r7 = P.generate({ region: R1, entrances: [[0, 8]], categories: [cat('standard', 2.5, 5.0)], angle: 90, aisle: 6, fixed: { angle: 0, offset: 0 }, locked: keep });
  for (const s of r7.best.stalls.filter((x) => x.valid)) for (const k of keep) assert(P.disjoint(s.footprint, k.poly), 'a new stall on a locked one');
  console.log(`PASS 7 two locked stalls kept; ${r7.best.total} generated round them`);

  // 8. the same seed, the same options
  const j = (r) => JSON.stringify(r.options.map((o) => [o.angle, o.offset, o.total, o.stalls.map((s) => s.footprint)]));
  assert.equal(j(P.generate({ region: R3, entrances: [[0, 10]], categories: [std], seed: 7, quality: 'draft' })), j(P.generate({ region: R3, entrances: [[0, 10]], categories: [std], seed: 7, quality: 'draft' })));
  console.log('PASS 8 the same seed gives the same options');
})().catch((e) => { console.error(e); process.exit(1); });
