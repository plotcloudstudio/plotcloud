// Privacy window risk, the calculation alone (2026-11-19): one room 6 × 4 m with a 2 m window in the wall facing a street at the top
// of the plan, and a second window on the opposite (bottom) wall with no street. The score must follow the geometry: a bedroom
// scores higher than a store room behind the same glass; a sill above the passer-by's eye lowers it; a site building between the
// street and the window lowers it; people in a building nearby add to it; the window with no one in front scores 0; a window in an
// inside wall is not analysed; the classes come from the shared thresholds.
import assert from 'node:assert/strict';
globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };
const P = await import('../mvp/js/interior/privacy.js');

// the room: x 10–16, y 10–14 (scene metres); walls 0.2 thick; window W1 in the top wall (y 14), W2 in the bottom wall (y 10)
const scene = ({ name = 'Bedroom', sill = 0.9, head = 2.1, ctx = [], inner = false } = {}) => ({
  walls: [{ a: [10, 10], b: [16, 10], h: 3, t: 0.2 }, { a: [16, 10], b: [16, 14], h: 3, t: 0.2 }, { a: [16, 14], b: [10, 14], h: 3, t: 0.2 }, { a: [10, 14], b: [10, 10], h: 3, t: 0.2 }],
  open: [{ id: 'W1', a: [12, 14], b: [14, 14], kind: 'win', ext: true, sill, head, w: 2 }, { id: 'W2', a: [12, 10], b: [14, 10], kind: 'win', ext: true, sill: 0.9, head: 2.1, w: 2 },
    ...(inner ? [{ id: 'W3', a: [16, 11], b: [16, 12], kind: 'win', ext: false, sill: 0.9, head: 2.1, w: 1 }] : [])],
  rooms: [{ id: 'r1', name, rects: [[10, 10, 6, 4]] }], furn: [], ctx, bounds: { w: 26, h: 24 }, settings: { floorZ: 0 }, source: { project: 'qa-' + Math.random() } });
const opts = { sides: ['top'], dS: 4, eye: 1.6, dO: 0, hO: 0, doors: false, near: true };
const run = async (o = {}, op = {}) => { const r = await P.run(scene(o), { ...opts, ...op }); return Object.fromEntries(r.windows.map((w) => [w.id, w])); };

const bed = await run(), store = await run({ name: 'Store' });
assert(bed.W1.score > 0 && bed.W1.nSeen > 0, 'the street sees into the bedroom: ' + JSON.stringify(bed.W1));
assert.equal(bed.W1.risk, P.riskOf(bed.W1.score)); assert.equal(bed.W1.from.kind, 'street'); assert.equal(bed.W1.faces, 'top');
assert(store.W1.score < bed.W1.score, `a store room behind the same glass scores lower: ${store.W1.score} < ${bed.W1.score}`);
assert.equal(bed.W2.score, 0, 'no one in front of the bottom window: score 0'); assert.equal(bed.W2.risk, 'low');
console.log(`PASS street-side bedroom window ${bed.W1.score} (${bed.W1.risk}: ${bed.W1.seen}% of the onlookers in front see in, ${bed.W1.floor}% of the floor); the same glass to a store room ${store.W1.score}; the window with no one in front 0`);

const high = await run({ sill: 1.8, head: 2.4 });
assert(high.W1.score < bed.W1.score, `a sill at 1.8 m (above the 1.6 m eye) lowers the score: ${high.W1.score} < ${bed.W1.score}`);
console.log(`PASS a sill at 1.8 m: ${bed.W1.score} → ${high.W1.score}`);

// a site building 6 m tall between the street (y 18) and the window (y 14), the full width
const blk = await run({ ctx: [{ id: 'b1', pts: [[0, 15.5], [26, 15.5], [26, 16.5], [0, 16.5]], base: 0, h: 6 }] }, { near: false });   // its own occupants left out here (they are tested below)
assert(blk.W1.score < bed.W1.score, `a building between the street and the window lowers the score: ${blk.W1.score} < ${bed.W1.score}`);
console.log(`PASS a building between the street and the window: ${bed.W1.score} → ${blk.W1.score}`);

// people in a building 12 m beyond the top wall, 9 m tall, facing the room (the street switched off)
const nb = [{ id: 'b2', pts: [[6, 26], [20, 26], [20, 34], [6, 34]], base: 0, h: 9 }];
const noStreet = await run({ ctx: nb }, { sides: ['bottom'] }), noNear = await run({ ctx: nb }, { sides: ['bottom'], near: false });
assert(noStreet.W1.nSeen > 0 && noStreet.W1.from.kind === 'nearby', 'people in the nearby building see in: ' + JSON.stringify(noStreet.W1.from));
assert.equal(noNear.W1.nSeen, 0, 'without them, no one on that side');
console.log(`PASS people in a building 12 m away look in through the top window (score ${noStreet.W1.score}); switched off, ${noNear.W1.score}`);

// terrain: a bank 4 m high between the street and the window
const bank = []; for (let x = 0; x <= 26; x += 1) for (let y = 8; y <= 24; y += 1) bank.push([x, y, y >= 15.5 && y <= 16.5 ? 4 : 0]);
const r0 = await P.run({ ...scene(), terrain: { pts: bank } }, opts), t = Object.fromEntries(r0.windows.map((w) => [w.id, w]));
assert(t.W1.score < bed.W1.score, `a bank between the street and the window lowers the score: ${t.W1.score} < ${bed.W1.score}`);
console.log(`PASS a 4 m bank of ground between the street and the window: ${bed.W1.score} → ${t.W1.score}`);

const inner = await run({ inner: true });
assert.equal(inner.W3.risk, 'na'); assert.equal(inner.W3.score, null);
for (const s of [0, P.RISK_AT.medium - 1, P.RISK_AT.medium, P.RISK_AT.high - 1, P.RISK_AT.high, 100]) assert.equal(P.riskOf(s), s >= P.RISK_AT.high ? 'high' : s >= P.RISK_AT.medium ? 'medium' : 'low');
assert.equal(P.riskOf(null), 'na'); assert.deepEqual(Object.keys(P.RISK).sort(), ['high', 'low', 'medium', 'na']);
console.log(`PASS a window in an inside wall is not analysed; the classes: High from ${P.RISK_AT.high}, Medium from ${P.RISK_AT.medium}, Low below, grey not analysed`);
