// Wayfinding Phase 3 (2026-11-19), signs proposed and laid out, on the test floor (tests/fixtures/wayfinding-floor.cjs), no browser:
// 1 the three layouts: Minimum ≤ Balanced ≤ Maximum signs; Minimum guides at least 80 % of the decisions and every High point;
//   each figure is a count (decisions guided / decisions, routes with every decision guided / routes, High points guided / High)
// 2 the arrows are the walker's: at the crossing, Reception (up the north arm) is Right for people heading west and Left on the
//   back face for people heading east, from the geometry, not the screen
// 3 a sign moved behind a wall is flagged (Visibility issue) and is fine again when moved back (case 11 and 12)
// 4 a wall sign turned to face away is flagged (case 8)
// 5 Before / After: the points left without a sign and the decisions guided, with the existing signs only and with the proposal
// 6 Maximum adds one identification sign per hard-to-spot destination entrance; the same input gives the same layouts
const assert = require('node:assert/strict'), path = require('node:path'), floor = require('./fixtures/wayfinding-floor.cjs');
(async () => {
  const W = await import(path.join(__dirname, '../mvp/js/interior/wayfinding-signage.js'));
  const B = (sc) => ({ levels: [{ id: 'L1', name: 'Level 1', z: 0, h: 3, sc }], stairs: [] }), A = W.analyse(B(floor()), { level: 'L1' }), L = W.layouts(A), [a, b, c] = L;
  // 1
  assert.deepEqual(L.map((x) => x.key), ['A', 'B', 'C']); assert(a.ev.total <= b.ev.total && b.ev.total <= c.ev.total, L.map((x) => x.ev.total).join(' ≤ '));
  assert(a.ev.clarity >= 0.8 && a.ev.highCovered === a.ev.high, JSON.stringify(a.ev)); for (const x of L) { assert.equal(x.ev.clarity, x.ev.guided / x.ev.events); assert.equal(x.ev.routeCoverage, x.ev.routesOK / x.ev.routes); }
  console.log('PASS 1 layouts: ' + L.map((x) => `${x.key} ${x.name}: ${x.ev.total} signs, ${x.ev.guided}/${x.ev.events} decisions guided, ${x.ev.routesOK}/${x.ev.routes} routes, High ${x.ev.highCovered}/${x.ev.high}, visibility ${x.ev.avgVis.toFixed(2)}`).join(' · '));
  // 2
  const X = A.nodes.find((n) => n.br.length === 4), g = b.signs.find((s) => s.node === X.no), rec = A.F.rooms.find((r) => r.name === 'Reception'), rc = rec.rects[0], toR = [rc[0] + rc[2] / 2 - X.p[0], rc[1] + rc[3] / 2 - X.p[1]], head = X.approach.v;
  const leftOfHead = head[0] * toR[1] - head[1] * toR[0] > 0, side = (ws) => ws.find((w) => w.to.includes('Reception')).arrow;
  assert.equal(side(g.ways), leftOfHead ? 'Left' : 'Right'); assert.equal(g.mount, 'hung'); assert.equal(side(g.waysB), leftOfHead ? 'Right' : 'Left');
  console.log(`PASS 2 the crossing's hung sign: Reception ${side(g.ways)} for people heading ${head[0] < 0 ? 'west' : 'east'}, ${side(g.waysB)} on the back face (from the geometry)`);
  // 3
  const behind = { ...g, p: [rc[0] + 2, rc[1] + 2] }, e3 = W.evaluate(A, [behind]); assert.match(e3.signs[0].issue || '', /Visibility issue|not at a decision point/);
  const back = W.evaluate(A, [g]); assert.equal(back.signs[0].issue, null); assert(back.signs[0].vis >= 0.5);
  console.log(`PASS 3 moved into Reception: "${e3.signs[0].issue}"; moved back: seen by ${Math.round(back.signs[0].vis * 100)} % of its routes`);
  // 4 a wall sign (the lift exit's) turned to face away
  const w = b.signs.find((s) => s.mount === 'wall') || b.signs.find((s) => s.type === 'Elevator lobby directory'), ok4 = W.evaluate(A, [w]).signs[0], bad4 = W.evaluate(A, [{ ...w, face: (w.face + 180) % 360, sides: 1 }]).signs[0];
  assert(ok4.vis >= 0.5 && /Visibility issue/.test(bad4.issue || ''), JSON.stringify([ok4.vis, bad4.issue])); console.log(`PASS 4 ${w.id} (${w.mount}) facing the people: seen by ${Math.round(ok4.vis * 100)} %; turned away: "${bad4.issue}"`);
  // 5
  const ba = W.beforeAfter(B(floor()), { level: 'L1' }, b.signs); assert(ba.before.recommended > ba.after.recommended && ba.after.clarity > ba.before.clarity, JSON.stringify(ba));
  console.log(`PASS 5 Before / After (Balanced): points needing a sign ${ba.before.recommended} → ${ba.after.recommended}; decisions guided ${Math.round(ba.before.clarity * 100)} % → ${Math.round(ba.after.clarity * 100)} %`);
  // 6
  const ids = c.signs.filter((s) => s.type === 'Identification'); assert(ids.length >= 1 && new Set(ids.map((s) => s.room)).size === ids.length);
  assert.equal(JSON.stringify(W.layouts(W.analyse(B(floor()), { level: 'L1' })).map((x) => x.signs)), JSON.stringify(L.map((x) => x.signs)));
  console.log(`PASS 6 Maximum adds ${ids.length} identification signs, one per room (${ids.slice(0, 3).map((s) => s.room).join(', ')}…); the same input gives the same layouts`);
  // 7 (Phase 4) the walk from the lift to Reception: its decisions in order; without signs none guided, with layout B every one, each by a sign that names Reception
  const WK = await import(path.join(__dirname, '../mvp/js/wayfinding-walk.js')), rR = A.routes.find((x) => x.room.name === 'Reception' && x.start.kind === 'lift');
  const w0 = W.walkCheck(A, rR, []), w1 = W.walkCheck(A, rR, b.signs); assert(w0.decisions.length >= 2 && w0.guided === 0, JSON.stringify(w0.decisions.map((d) => d.note)));
  assert.equal(w1.guided, w1.decisions.length); assert(w1.decisions.every((d) => d.seen.some((x) => x.mine))); assert.deepEqual(w1.decisions.map((d) => d.s), w1.decisions.map((d) => d.s).slice().sort((x, y) => x - y));
  const X1 = w1.decisions.find((d) => d.no === X.no); assert.equal(X1.take, 'Left', 'heading east from the lift, Reception is up the north arm: Left'); assert.equal(X1.seen.find((x) => x.mine).mine, 'Left');
  console.log(`PASS 7 the walk lift → Reception: ${w1.decisions.length} decisions; without signs ${w0.guided} guided ("${w0.decisions[0].note}"); with B all guided (${w1.decisions.map((d) => d.note).join('; ')})`);
  // 8 (Phase 5) the schedule and the drawing
  const evB = W.evaluate(A, b.signs), rows = WK.schedule(A, { opt: 'B' }, evB), csv = WK.scheduleCSV(rows), lines = csv.trim().split('\r\n');
  assert.equal(lines.length, b.signs.length + 1); assert.match(lines[0], /Sign ID,Floor,x \(m\),y \(m\),Decision point,Location,Sign type,Mounting,Direction it faces,Destinations \(front\),Destinations \(back\),Priority,Seen by routes,Visibility status/);
  assert(rows.every((r) => r.status === 'OK' && /°/.test(r.faces))); assert(rows.every((r) => /corridor/i.test(r.where)), rows.map((r) => r.where).join());
  const svg = WK.drawingSVG(A, { opt: 'B' }, evB, { project: 'Test' }); for (const g of b.signs) assert(svg.includes(`>${g.id}</text>`), 'sign ' + g.id + ' on the drawing'); assert.match(svg, /Signage schedule \(\d+\)/); assert.match(svg, /Legend/);
  const dxf = WK.drawingDXF(A, { opt: 'B' }, evB); for (const L of ['WALLS', 'ROUTES', 'POINTS', 'SIGNS', 'SIGN_FACING', 'TEXT']) assert(dxf.includes(`\n8\n${L}\n`), 'DXF layer ' + L); assert.match(dxf, /EOF\n$/);
  const high = WK.schedule(A, { opt: 'C' }, W.evaluate(A, c.signs), { highOnly: true }); assert(high.length >= 1 && high.every((r) => /^High/.test(r.priority)));
  console.log(`PASS 8 the schedule: ${rows.length} rows (${Object.keys(rows[0]).length} columns); the SVG draws every sign with its number, the legend and the schedule; DXF layers WALLS ROUTES POINTS SIGNS SIGN_FACING TEXT; High only: ${high.length} of ${c.signs.length}`);
})().catch((e) => { console.error(e); process.exit(1); });
