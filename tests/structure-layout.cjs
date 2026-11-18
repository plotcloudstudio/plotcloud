// The structure laid out from walls (2026-11-17), its rules on a small drawn building (no browser): a 20 × 10 m house with 400 mm
// stone outside walls, a stone spine wall at 10 m, gypsum partitions and a glass wall; a second floor whose one stone wall stands
// on nothing below. Checks: which walls carry, the grid lines (bearing walls first, a partition used to split a long bay, a line
// added where no wall is), columns only where no bearing wall stands, the transfer flagged, the wall thickness check, a wall made
// a partition by the person, beams only in steel and timber, sizes from the rules of thumb, and ideas with numbers.
const assert = require('node:assert/strict'), path = require('node:path');
(async () => {
  const SL = await import(path.join(__dirname, '../mvp/js/structure-layout.js'));
  const W = (id, lv, a, b, t, mat) => ({ id, lv, a, b, t, h: 3, mat });
  const levels = [{ id: 'L1', z: 0, h: 3, name: 'Ground' }, { id: 'L2', z: 3, h: 3, name: 'Upper' }];
  const box = (lv, p) => [W(p + 's', lv, [0, 0], [20, 0], 0.4, 'stone'), W(p + 'e', lv, [20, 0], [20, 10], 0.4, 'stone'), W(p + 'n', lv, [20, 10], [0, 10], 0.4, 'stone'), W(p + 'w', lv, [0, 10], [0, 0], 0.4, 'stone')];
  const walls = [...box('L1', 'a'), W('spine', 'L1', [10, 0], [10, 10], 0.3, 'stone'), W('part', 'L1', [4.6, 0], [4.6, 10], 0.1, 'gypsum'), W('glass', 'L1', [14, 0], [14, 4], 0.12, 'glass'),
    ...box('L2', 'b'), W('up', 'L2', [16, 0], [16, 10], 0.3, 'stone')];
  const opts = { levels, walls, span: 7.5, system: 'concrete', loads: { dead: (sp) => 24 * Math.max(0.2, sp / 30) + 1.5, live: 1.9, snow: 1.0 }, fcol: 20 };
  let L = SL.layoutStructure(opts);
  // roles
  assert.equal(L.roles.spine.role, 'bearing'); assert.equal(L.roles.as.role, 'bearing'); assert.equal(L.roles.part.role, 'partition'); assert.equal(L.roles.glass.role, 'partition');
  assert.match(L.roles.part.why, /gypsum|under 150/); assert.equal(L.walls.length, 10, 'eight outside walls, the spine and the upper wall');
  console.log('PASS roles: 400 mm stone outside walls and the 300 mm stone spine carry; gypsum and glass walls are partitions');
  // grid: along x the outside walls (0, 20), the spine (10) and the upper stone wall (16) are lines; 0–10 is 10 m > 7.5 m: the
  // partition at 4.6 splits it; along y the outside walls 10 m apart get one added line (no wall runs along x inside)
  const ux = L.axes.u.map((a) => +a.c.toFixed(2)), uk = L.axes.u.map((a) => a.kind);
  const vx = L.axes.v.map((a) => +a.c.toFixed(2)), vk = L.axes.v.map((a) => a.kind);
  // the main angle may make u the y direction: read both ways
  const xs = Math.abs(L.angle) < 0.01 ? [ux, uk, vx, vk] : [vx, vk, ux, uk];
  assert.deepEqual(xs[0], [0, 4.6, 10, 16, 20], 'x lines: ' + xs[0]); assert.equal(xs[1][1], 'wall', 'the partition line used');
  assert.deepEqual(xs[2], [0, 5, 10], 'y lines: ' + xs[2]); assert.equal(xs[3][1], 'added');
  assert.deepEqual([...L.spansU, ...L.spansV].every((s) => s <= 7.55), true);
  console.log('PASS grid: bearing wall lines first (0, 10, 16, 20 m), a partition line to split the 10 m bay (4.6 m), one line added where no wall is (y = 5 m)');
  // columns: where lines cross and no bearing wall stands; none on the outside walls or the spine
  // (the spine stands on the ground floor only: above it a column carries the roof; the upper stone wall at 16 m has a column under it)
  const where = L.cols.map((c) => `${+c.x.toFixed(2)},${+c.y.toFixed(2)} ${c.z0}-${c.z1}`).sort();
  assert.deepEqual(where, ['10,5 3-6', '16,5 0-3', '4.6,5 0-6'], 'columns only where no bearing wall stands: ' + where.join(' | '));
  const c46 = L.cols.find((c) => Math.abs(c.x - 4.6) < 0.01 && Math.abs(c.y - 5) < 0.01); assert(c46, 'a column at 4.6/5');
  assert(c46.inWall, 'it stands in the partition'); assert(c46.N > 0 && c46.size >= 0.3);
  // its load: a quarter of each of the four bays around it, per floor, factored (1.25 D + 1.5 L), roof on top
  const sp = (a, b) => Math.max(a, b), dead = opts.loads.dead, bays = [[4.6, 5], [5.4, 5], [4.6, 5], [5.4, 5]], wf = (s) => 1.25 * dead(s) + 1.5 * 1.9, wr = (s) => 1.25 * dead(s) + 1.5 * 1.0;
  const want = bays.reduce((s, [a, b]) => s + (wf(sp(a, b)) + wr(sp(a, b))) * a * b / 4, 0); assert(Math.abs(c46.N - want) < 1e-6, `column load ${c46.N} vs ${want}`);
  console.log(`PASS columns: ${L.cols.length}, none on a bearing wall; the one at 4.6/5 stands in the partition and carries ${c46.N.toFixed(0)} kN (two floors of four quarter-bays, factored)`);
  // transfer: the upper stone wall at x = 16 has no bearing wall under it
  const t = L.flags.find((f) => f.kind === 'transfer' && f.what === 'wall' && f.id === 'up'); assert(t, 'transfer flagged: ' + JSON.stringify(L.flags));
  // wall check: a ground stone wall carries its half-bays and its own weight; a 400 mm wall is enough here
  const ws = L.walls.find((w) => w.id === 'spine'); assert(ws.ok && ws.tReq >= 0.19 && ws.q > 0); assert.equal(ws.kind, 'stone');
  console.log(`PASS the upper stone wall over nothing is flagged; the spine needs ${Math.round(ws.tReq * 1000)} mm for ${ws.q.toFixed(0)} kN/m and has 300`);
  // flat plate: no beams; steel: beams sized span/20; timber: glulam widths
  assert.equal(L.beams.length, 0);
  const Ls = SL.layoutStructure({ ...opts, system: 'steel' }); assert(Ls.beams.length > 0 && Ls.beams.every((b) => Math.abs(b.h - Math.ceil(b.span / 20 / 0.01 - 1e-9) * 0.01) < 1e-9));
  assert(Ls.beams.every((b) => !(Math.abs(b.a[0] - 10) < 0.01 && Math.abs(b.b[0] - 10) < 0.01 && b.level === 'L1')), 'no beam along the spine wall');
  const Lt = SL.layoutStructure({ ...opts, system: 'timber' }); assert(Lt.beams.every((b) => [0.13, 0.175, 0.215, 0.265, 0.315, 0.365].includes(b.w)));
  console.log(`PASS beams: none in a flat plate; ${Ls.beams.length} steel beams at span/20, none along a bearing wall; glulam beams in stock widths`);
  // the person's choice: the spine as a partition: columns appear along it
  const Lp = SL.layoutStructure({ ...opts, roles: { spine: 'partition' } }); assert.equal(Lp.roles.spine.role, 'partition'); assert.equal(Lp.roles.spine.why, 'set by you');
  assert(Lp.cols.some((c) => Math.abs(c.x - 10) < 0.01 && Math.abs(c.y - 5) < 0.01), 'a column on the spine line once it is a partition');
  console.log('PASS a wall set as a partition: it no longer carries, a column stands on its line');
  // ideas
  const ideas = SL.structureIdeas(L, { bearing: 150 }); const ids = ideas.map((i) => i.id);
  assert(ids.includes('transfer-walls') && ids.includes('footings') && ids.includes('added-lines'), ids.join(','));
  assert(ideas.every((i) => /\d/.test(i.text)), 'every idea has numbers');
  // a 20 x 16 m box at a 6 m grid: two lines added across the 16 m; a steel frame on 9 m needs one, so it is offered (with the same 10 m case: no offer)
  assert.equal(SL.structureIdeas(SL.layoutStructure({ ...opts, span: 6 }), {}).find((i) => i.id === 'added-lines').action, null, 'no offer when 9 m needs as many lines');
  const deep = [W('s', 'L1', [0, 0], [20, 0], 0.4, 'stone'), W('e', 'L1', [20, 0], [20, 16], 0.4, 'stone'), W('n', 'L1', [20, 16], [0, 16], 0.4, 'stone'), W('w', 'L1', [0, 16], [0, 0], 0.4, 'stone')];
  const L6 = SL.layoutStructure({ ...opts, levels: [levels[0]], walls: deep, span: 6 }), I6 = SL.structureIdeas(L6, {}).find((i) => i.id === 'added-lines');
  assert(I6 && I6.action && I6.action.system === 'steel' && I6.action.span === '9', 'at 6 m a steel frame on 9 m needs fewer added lines: ' + JSON.stringify(I6));
  console.log(`PASS ideas: ${ids.join(', ')}; at a 6 m grid the steel 9 m frame is offered as something to try`);
  // footing sizes
  assert(Math.abs(SL.padSide(1400, 100) - Math.sqrt(10)) < 1e-9 && Math.abs(SL.stripWidth(140, 100) - 1) < 1e-9);
  console.log('PASS footings: pad side √(N/1.4/q), strip width q/1.4/q_a');
})().catch((e) => { console.error(e); process.exit(1); });
