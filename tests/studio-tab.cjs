const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const G = require('../studio-geometry.js');
const source = fs.readFileSync(path.join(__dirname, '../emb/modeler.html'), 'utf8');
const cycleCode = source.slice(source.indexOf('const cycleSelection ='), source.indexOf("let LAYER = 'Wall'"));
const keysCode = source.slice(source.indexOf('// ---------- keys ----------'), source.indexOf("addEventListener('keyup'"));
function fixture() {
  const handlers = {}, hidden = new Set(), ctx = {
    Math, Set, window: {}, M: {walls: [], ops: [], furn: [], floors: [], fences: [], voids: []},
    LV: 'L1', LAYER: 'Wall', VIS: {Wall: true, Furniture: true, Floor: true},
    V: {s: 100}, VP: {d: 1}, S: {L: {L1: {}}, rooms: []}, HOV: null, SEL: null,
    CAM: 'plan', VIEW2D: 'plan', TOOL: 'select', drag: null, drawing: null, SPACE: false,
    LAYER_OF: {furn: 'Furniture', wall: 'Wall', op: 'Wall', fence: 'Wall', floor: 'Floor', void: 'Floor'},
    isHidden: id => hidden.has(id), furnOk: () => true, draw() {}, tipOff() {},
    tipAt(e, text) { ctx.tip = text; }, libOf: () => ['sofa', 'Sofa'],
    STC: {wallDir: w => {const d = [w.b[0] - w.a[0], w.b[1] - w.a[1]], n = Math.hypot(...d); return d.map(v => v / n);}, roomAtR: () => -1},
    addEventListener: (name, fn) => { handlers[name] = fn; },
    setLayer: name => { ctx.LAYER = name; }, changedSel() { ctx.confirmed = true; },
    applyTyped: () => false, evP: e => [e.clientX, e.clientY], S2W: (x, y) => [x / 100, y / 100],
    hitTest: () => ctx.front || null, hidden,
  };
  ctx.wallById = id => ctx.M.walls.find(w => w.id === id);
  ctx.lvWalls = () => ctx.M.walls.filter(w => w.lv === ctx.LV);
  ctx.selObj = c => { const list = {furn: 'furn', wall: 'walls', op: 'ops', fence: 'fences', floor: 'floors', void: 'voids'}; return ctx.M[list[c.k]]?.find(o => o.id === c.id); };
  ctx.floorContains = (f, p) => G.pointInPolygon(p, G.floorPoints(f)) && !(f.holes || []).some(h => G.pointInPolygon(p, h));
  vm.createContext(ctx);
  vm.runInContext(cycleCode + keysCode + ';this.api={state:cycleSelection,candidates:cycleCandidates2D,candidates3D:cycleCandidates3D,set:cycleSet,step:cycleStep,clear:cycleClear,refresh:cycleRefresh,current:cycleCurrent};', ctx);
  ctx.key = (key, more = {}) => { const e = {key, target: {matches: () => false}, preventDefault() {this.prevented = true;}, ...more}; handlers.keydown(e); return e; };
  return ctx;
}
const furniture = (id, extra = {}) => ({id, lv: 'L1', type: 'sofa', x: 0, y: 0, w: 4, d: 2, ...extra});
const ids = arr => Array.from(arr, c => c.id);

test('overlapping furniture is selectable at its centre and inside a rotated footprint', () => {
  const c = fixture(); c.M.furn = [furniture('sofa'), furniture('table', {w: 1, d: 1}), furniture('rotated', {rot: Math.PI / 2})];
  assert.deepEqual(ids(c.api.candidates([0, 0])).sort(), ['rotated', 'sofa', 'table']);
  assert(ids(c.api.candidates([0, 1.8])).includes('rotated'));
  assert(!ids(c.api.candidates([1.8, 0])).includes('rotated'));
});
test('nearby selection uses CSS pixels consistently on high DPI displays', () => {
  const c = fixture(); c.M.furn = [furniture('sofa')];
  assert(ids(c.api.candidates([2.15, 0])).includes('sofa'));
  assert(!ids(c.api.candidates([2.17, 0])).includes('sofa'));
  c.V.s = 200; c.VP.d = 2;
  assert(ids(c.api.candidates([2.15, 0])).includes('sofa'));
  assert(!ids(c.api.candidates([2.17, 0])).includes('sofa'));
});
test('hidden objects, hidden layers, other levels and distant objects are excluded', () => {
  const c = fixture(); c.M.furn = [furniture('visible'), furniture('hidden'), furniture('upstairs', {lv: 'L2'}), furniture('distant', {x: 20})]; c.hidden.add('hidden');
  assert.deepEqual(ids(c.api.candidates([0, 0])), ['visible']);
  c.VIS.Furniture = false; assert.equal(c.api.candidates([0, 0]).length, 0);
});
test('wall thickness and openings participate without duplicate wall candidates', () => {
  const c = fixture(); c.M.walls = [{id: 'wall', lv: 'L1', a: [-3, 0], b: [3, 0], t: 1}]; c.M.ops = [{id: 'door', wall: 'wall', pos: 3, w: 1}];
  assert.deepEqual(ids(c.api.candidates([0, .49])).sort(), ['door', 'wall']);
  c.hidden.add('wall'); assert.equal(c.api.candidates([0, .49]).length, 0);
});
test('slabs respect their concave outline and holes; fences and openings participate', () => {
  const c = fixture(); c.M.floors = [{id: 'slab', lv: 'L1', points: [[0,0],[6,0],[6,2],[2,2],[2,6],[0,6]], holes: [[[.5,.5],[1.5,.5],[1.5,1.5],[.5,1.5]]]}];
  assert(ids(c.api.candidates([1, 3])).includes('slab'));
  assert(!ids(c.api.candidates([4, 4])).includes('slab'));
  assert(!ids(c.api.candidates([1, 1])).includes('slab'));
  c.M.fences = [{id: 'fence', lv: 'L1', points: [[0,0],[2,0],[2,2]]}];
  c.M.voids = [{id: 'opening', lv: 'L1', x: 0, y: 0, w: 1, d: 1}];
  assert(ids(c.api.candidates([.5, .05])).includes('fence'));
  assert(ids(c.api.candidates([.5, .5])).includes('opening'));
});
test('Tab and Shift+Tab wrap, update the tooltip and confirm the highlighted furniture', () => {
  const c = fixture(); c.M.furn = [furniture('a'), furniture('b')]; c.front = {k: 'furn', id: 'b'};
  c.api.refresh({clientX: 0, clientY: 0}); assert.equal(c.api.current().id, 'b');
  assert(c.key('Tab').prevented); assert.equal(c.api.current().id, 'a'); assert.match(c.tip, /2 of 2/);
  c.key('Tab', {shiftKey: true}); assert.equal(c.api.current().id, 'b'); assert.match(c.tip, /1 of 2/);
  c.key('Tab'); c.key('Enter'); assert.equal(c.SEL.id, 'a'); assert.equal(c.LAYER, 'Furniture'); assert(c.confirmed); assert.equal(c.api.state.active, false);
});
test('Tab leaves form fields, browser shortcuts, drawing and off-canvas focus alone', () => {
  const c = fixture(); c.M.furn = [furniture('a'), furniture('b')]; c.api.refresh({clientX: 0, clientY: 0});
  const before = c.api.state.index;
  assert(!c.key('Tab', {target: {matches: () => true}}).prevented);
  assert(!c.key('Tab', {ctrlKey: true}).prevented);
  c.TOOL = 'wall'; assert(!c.key('Tab').prevented); c.TOOL = 'select';
  c.drawing = {kind: 'wall'}; assert(!c.key('Tab').prevented); c.drawing = null;
  c.api.state.pointer = null; assert(!c.key('Tab').prevented); assert.equal(c.api.state.index, before);
});
test('Escape clears the preview without changing selection or model', () => {
  const c = fixture(); c.M.furn = [furniture('a'), furniture('b')]; c.SEL = {k: 'furn', id: 'a'};
  const before = JSON.stringify(c.M); c.api.refresh({clientX: 0, clientY: 0}); c.key('Tab'); c.key('Escape');
  assert.equal(c.api.state.active, false); assert.equal(c.SEL.id, 'a'); assert.equal(JSON.stringify(c.M), before);
});
test('all nearby candidates remain reachable when more than twenty objects overlap', () => {
  const c = fixture(); c.M.furn = Array.from({length: 25}, (_, i) => furniture('f' + i)); c.api.refresh({clientX: 0, clientY: 0});
  const seen = new Set(); for(let i=0;i<25;i++){seen.add(c.api.current().id);c.key('Tab');} assert.equal(seen.size, 25);
});
test('3D cycles raycast objects and updates the actual hover target', () => {
  const c = fixture(); c.CAM = '3d'; c.M.furn = [furniture('front'), furniture('behind'), furniture('hidden')]; c.hidden.add('hidden');
  c.S3 = c.window.S3 = {on: true, hits: () => ['front', 'hidden', 'behind'].map(id => ({ud: {k: 'furn', id}})).concat([{ud: {k: 'site', id: 'context'}}]), hover: target => {c.hover = target;}};
  c.api.refresh({clientX: 10, clientY: 10}); assert.deepEqual(ids(c.api.state.candidates), ['front', 'behind']);
  c.key('Tab'); assert.equal(c.hover.id, 'behind'); c.key('Enter'); assert.equal(c.SEL.id, 'behind');
});
