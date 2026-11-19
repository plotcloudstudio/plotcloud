// The structure frame analysis (2026-11-18), checked by hand (no browser): the solver keeps each piece's end forces; the
// stations along a member give the internal forces of textbook cases (a cantilever column with a tip load: base moment P·L and
// tip deflection P·L³/3EI; a simply supported beam with a uniform load: w·L²/8 at mid-span); a laid-out two-storey building
// analysed as a frame (equilibrium in every combination, members of every kind, wall supports), and bracing it cuts the drift
// under wind by more than 70 %.
const assert = require('node:assert/strict');
(async () => {
  await import('../emb/lib/structural-solver.js'); const SA = globalThis.PlotCloudStructuralSolver;
  const F = await import('../mvp/js/structure-frame.js'), SL = await import('../mvp/js/structure-layout.js');
  const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);
  const sec = SA.secById('rhs150x150x8'), E = SA.MATERIALS.steel.E;
  // 1. a cantilever column, 3 m, fixed at the base, 10 kN sideways at the top (case Wx)
  let M = { nodes: [[0, 0, 0], [0, 0, 3]], members: [{ a: 0, b: 1, g: 0 }], groups: [{ kind: 'frame', sec, mat: SA.MATERIALS.steel }], supports: [[0, 'fixed']], faces: [], area: { D: 0, L: 0, S: 0 }, point: [{ n: 1, c: 'Wx', F: [10, 0, 0] }], self: false };
  let r = SA.linear(M, { nSub: 4, pieces: true }), c = r.cases.Wx; assert(c.pieces && c.pieces.length === 4, 'pieces kept');
  let st = F.stations(r, 0, c); assert.equal(st.length, 5);
  near(st[0].M, 30, 0.01, 'base moment P·L'); near(st[4].M, 0, 0.01, 'no moment at the tip'); near(st[2].M, 15, 0.01, 'mid-height moment');
  near(st[4].d[0], 10 * 27 / (3 * E * sec.Iy), 0.02, 'tip deflection P·L³/3EI'); near(st[0].V, 10, 0.01, 'shear P');
  console.log(`PASS cantilever: base M ${st[0].M.toFixed(2)} kN·m (30), tip ${(st[4].d[0] * 1000).toFixed(2)} mm (${(10 * 27 / (3 * E * sec.Iy) * 1000).toFixed(2)})`);
  // 2. a 6 m beam on two supports, 5 kN/m dead load (no self-weight)
  M = { nodes: [[0, 0, 0], [6, 0, 0]], members: [{ a: 0, b: 1, g: 0, w: { D: 5 } }], groups: [{ kind: 'frame', sec: SA.secById('w310x60'), mat: SA.MATERIALS.steel }], supports: [[0, 'pinned'], [1, [0, 1, 1, 1, 0, 0]]], faces: [], area: { D: 0, L: 0, S: 0 }, point: [], self: false };
  r = SA.linear(M, { nSub: 4, pieces: true }); st = F.stations(r, 0, r.cases.D);
  near(st[2].M, 5 * 36 / 8, 0.02, 'mid-span w·L²/8'); near(st[0].M, 0, 0.02, 'no moment at the support'); near(st[0].V, 15, 0.02, 'end shear w·L/2');
  assert(st[2].side[2] !== 0 || st[2].side[1] !== 0, 'the diagram has a side');
  console.log(`PASS simply supported beam: mid-span M ${st[2].M.toFixed(2)} kN·m (22.50), end shear ${st[0].V.toFixed(2)} kN (15)`);
  // 3. a laid-out two-storey building: 20 × 12 m, concrete walls round it, columns inside, analysed as a frame
  const W = (id, lv, a, b, t, mat) => ({ id, lv, a, b, t, h: 3, mat });
  const levels = [{ id: 'L1', z: 0, h: 3.5, name: 'Ground' }, { id: 'L2', z: 3.5, h: 3.2, name: 'Upper' }];
  const box = (lv, p) => [W(p + 's', lv, [0, 0], [20, 0], 0.12, 'gypsum'), W(p + 'e', lv, [20, 0], [20, 12], 0.12, 'gypsum'), W(p + 'n', lv, [20, 12], [0, 12], 0.12, 'gypsum'), W(p + 'w', lv, [0, 12], [0, 0], 0.12, 'gypsum')];
  const lay = SL.layoutStructure({ levels, walls: [...box('L1', 'a'), ...box('L2', 'b')], span: 7.5, system: 'steel', loads: { live: 2.4, snow: 1 }, fcol: 190 });
  const base = { system: 'steel', live: 2.4, snow: 1, wind: { q: 0.8 } };
  const A0 = F.analyseFrame(lay, base, SA);
  assert(A0.counts.columns > 0 && A0.counts.beams > 0 && A0.counts.braces === 0, JSON.stringify(A0.counts)); assert(A0.eq.err < 1e-6, 'equilibrium ' + A0.eq.err);
  assert(A0.members.every((m) => Object.keys(m.stations).length >= 2), 'stations for the shown combinations'); assert(A0.drift && A0.drift.ratio > 0, 'drift under wind');
  console.log(`PASS frame of the laid-out building: ${A0.counts.columns} columns, ${A0.counts.beams} beams, ${A0.counts.unknowns} unknowns, equilibrium ${A0.eq.err.toExponential(1)}, wind drift h/${A0.drift.hOver} on ${A0.drift.level}`);
  // 4. braced: X braces in an end bay of each outside line, both storeys
  const bays = F.braceBays(lay), pickB = (dir, line) => bays.filter((b) => b.dir === dir && b.line === line && b.bay === 0).map((b) => ({ ...b, kind: 'X' }));
  const lines = { u: [lay.axes.u[0].name, lay.axes.u.at(-1).name], v: [lay.axes.v[0].name, lay.axes.v.at(-1).name] };
  const braces = [...lines.u.flatMap((l) => pickB('u', l)), ...lines.v.flatMap((l) => pickB('v', l))]; assert(braces.length >= 8, 'braces ' + braces.length);
  const A1 = F.analyseFrame(lay, { ...base, braces }, SA);
  assert(A1.counts.braces === braces.length * 2, 'X braces: two members each'); assert(A1.drift.ratio < 0.3 * A0.drift.ratio, `bracing cuts drift by over 70 %: h/${A0.drift.hOver} → h/${A1.drift.hOver}`);
  assert(A1.members.filter((m) => m.kind === 'brace').every((m) => Math.abs(m.M) < 1e-6), 'braces carry no moment (pinned ends)');
  console.log(`PASS braced: ${braces.length} X braces cut the wind drift from h/${A0.drift.hOver} to h/${A1.drift.hOver}; braces carry axial force only`);
  // 5. a concrete flat plate: slab strips; and bearing walls as supports
  const lay2 = SL.layoutStructure({ levels, walls: [...box('L1', 'a').map((w) => ({ ...w, t: 0.3, mat: 'concrete' })), ...box('L2', 'b').map((w) => ({ ...w, t: 0.3, mat: 'concrete' }))], span: 7.5, system: 'concrete', loads: { live: 2.4, snow: 1 }, fcol: 20 });
  const A2 = F.analyseFrame(lay2, { system: 'concrete', live: 2.4, snow: 1 }, SA);
  assert(A2.members.some((m) => m.kind === 'strip') && A2.supports.some((s) => s.t === 'wall'), 'strips and wall supports'); assert(A2.eq.err < 1e-6);
  console.log(`PASS flat plate: ${A2.members.filter((m) => m.kind === 'strip').length} slab strips, ${A2.supports.filter((s) => s.t === 'wall').length} wall supports; equilibrium`);
})().catch((e) => { console.error(e); process.exit(1); });
