// Reading a CAD floor plan (2026-11-27): mvp/js/dxf-read.js on drawings made here, as CAD programs write them.
// 1 a 9 × 6 m room in millimetres ($INSUNITS 4): walls drawn as double lines 200 mm apart on A-WALL, a 900 mm door opening in the
//   south wall, a door block inserted rotated (an arc and a leaf), a sofa as a closed LWPOLYLINE with a rounded corner (bulge), a
//   room name as MTEXT → metres, layers, text; walls found: five pieces (the south wall either side of the door), 0.2 m thick, on the
//   wall centrelines, corners joined;
// 2 the same in metres with no $INSUNITS: the units guessed as metres and said to be guessed; an override scale;
// 3 POLYLINE/VERTEX with a bulge, an arc in a mirrored (Z down) coordinate system, a nested block and an array insert;
// 4 DWG, binary DXF and a file with no lines are refused with what to do.
import assert from 'node:assert/strict';
import { parseDXF, wallsFromLines, wallLayers } from '../mvp/js/dxf-read.js';

const dxf = (ents, { units = 4, blocks = '', layers = ['A-WALL', 'A-DOOR', 'FURN', 'TEXT'] } = {}) => [
  '0', 'SECTION', '2', 'HEADER', ...(units != null ? ['9', '$INSUNITS', '70', String(units)] : []), '0', 'ENDSEC',
  '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', ...layers.flatMap((n) => ['0', 'LAYER', '2', n, '70', '0', '62', n === 'TEXT' ? '-7' : '7']), '0', 'ENDTAB', '0', 'ENDSEC',
  '0', 'SECTION', '2', 'BLOCKS', blocks, '0', 'ENDSEC',
  '0', 'SECTION', '2', 'ENTITIES', ents, '0', 'ENDSEC', '0', 'EOF'].filter((x) => x !== '').join('\n');
const line = (ly, a, b) => ['0', 'LINE', '8', ly, '10', a[0], '20', a[1], '11', b[0], '21', b[1]].join('\n');
const near = (p, q, tol = 0.002) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= tol;
const len = (w) => Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);

// 1 · a room in millimetres: outer face 0..9000 × 0..6000, inner face 200 in; a door opening 900 wide from x = 2000 on the south wall
{ const W = 'A-WALL', o = [[0, 0], [9000, 0], [9000, 6000], [0, 6000]], n = [[200, 200], [8800, 200], [8800, 5800], [200, 5800]];
  const ents = [
    line(W, [0, 0], [2000, 0]), line(W, [2900, 0], [9000, 0]), line(W, [200, 200], [2000, 200]), line(W, [2900, 200], [8800, 200]),   // south, with the opening
    line(W, [2000, 0], [2000, 200]), line(W, [2900, 0], [2900, 200]),   // the opening's jambs
    line(W, o[1], o[2]), line(W, o[2], o[3]), line(W, o[3], o[0]), line(W, n[1], n[2]), line(W, n[2], n[3]), line(W, n[3], n[0]),
    ['0', 'INSERT', '8', 'A-DOOR', '2', 'DOOR900', '10', '2000', '20', '200', '50', '0'].join('\n'),
    ['0', 'LWPOLYLINE', '8', 'FURN', '90', '4', '70', '1', '10', '5000', '20', '3000', '10', '7000', '20', '3000', '42', '0.414214', '10', '7000', '20', '3900', '10', '5000', '20', '3900'].join('\n'),
    ['0', 'MTEXT', '8', 'TEXT', '10', '4500', '20', '3000', '40', '250', '1', '{\\fArial;Living\\Proom}'].join('\n')].join('\n');
  const blocks = ['0', 'BLOCK', '8', '0', '2', 'DOOR900', '10', '0', '20', '0', '0', 'LINE', '8', '0', '10', '0', '20', '0', '11', '0', '21', '900', '0', 'ARC', '8', '0', '10', '0', '20', '0', '40', '900', '50', '0', '51', '90', '0', 'ENDBLK'].join('\n');
  const r = parseDXF(dxf(ents, { blocks }));
  assert(r.ok, r.error); assert.equal(r.units.name, 'millimetres'); assert.equal(r.units.guessed, false);
  assert(near([r.bounds.x0, r.bounds.y0], [0, 0]) && near([r.bounds.x1, r.bounds.y1], [9, 6]), 'bounds in metres ' + JSON.stringify(r.bounds));
  assert.deepEqual(Object.keys(r.layers).sort(), ['0', 'A-DOOR', 'A-WALL', 'FURN', 'TEXT'].filter((x) => x !== '0' || r.layers['0']).sort());
  assert.equal(r.layers.TEXT.off, true, 'a layer with a negative colour is off');
  const door = r.segs.filter((s) => s.layer === 'A-DOOR'); assert(door.length >= 8, 'the door block, on the insert\'s layer: ' + door.length);
  assert(door.some((s) => near(s.b, [2, 1.1]) || near(s.a, [2, 1.1])), 'the leaf from the hinge, 900 mm long');
  const sofa = r.segs.filter((s) => s.layer === 'FURN'); assert(sofa.length > 5, 'the sofa with its rounded corner: ' + sofa.length);
  assert(sofa.some((s) => s.a[0] > 7.0 + 0.1), 'the bulge bows outwards (counter-clockwise from (7,3) to (7,3.9))');
  assert.equal(r.texts[0].s, 'Living room'); assert(near(r.texts[0].p, [4.5, 3]));
  assert.deepEqual(wallLayers(r), ['A-WALL'], 'the wall layer found by its name');
  const w = wallsFromLines(r.segs.filter((s) => s.layer === 'A-WALL'));
  assert.equal(w.length, 5, 'five walls: ' + JSON.stringify(w)); assert(w.every((x) => Math.abs(x.t - 0.2) < 1e-6), 'all 0.2 m thick');
  const south = w.filter((x) => Math.abs(x.a[1] - 0.1) < 1e-6 && Math.abs(x.b[1] - 0.1) < 1e-6).sort((p, q) => Math.min(p.a[0], p.b[0]) - Math.min(q.a[0], q.b[0]));
  assert.equal(south.length, 2, 'the south wall either side of the door');
  assert(Math.abs(Math.max(south[0].a[0], south[0].b[0]) - 2) < 1e-6 && Math.abs(Math.min(south[1].a[0], south[1].b[0]) - 2.9) < 1e-6, 'the opening kept: 2.0 to 2.9 m');
  assert(Math.abs(Math.min(south[0].a[0], south[0].b[0]) - 0.1) < 1e-6, 'the corner joined on the centrelines (0.1 m in)');
  const east = w.find((x) => Math.abs(x.a[0] - 8.9) < 1e-6 && Math.abs(x.b[0] - 8.9) < 1e-6); assert(east && Math.abs(len(east) - 5.8) < 1e-6, 'the east wall from centreline to centreline: ' + JSON.stringify(east));
  console.log(`PASS a 9 × 6 m room in millimetres: ${r.segs.length} lines on ${Object.keys(r.layers).length} layers, "${r.texts[0].s}"; ${w.length} walls 0.2 m thick, the door opening kept, corners joined`); }

// 2 · metres, no units given: guessed; an override
{ const ents = [line('W', [0, 0], [10, 0]), line('W', [0, 0.3], [10, 0.3])].join('\n'), r = parseDXF(dxf(ents, { units: null, layers: ['W'] }));
  assert(r.ok && r.units.guessed && r.units.name === 'metres' && near([r.bounds.x1, r.bounds.y1], [10, 0.3]), JSON.stringify(r.units));
  const w = wallsFromLines(r.segs); assert(w.length === 1 && Math.abs(w[0].t - 0.3) < 1e-6 && Math.abs(len(w[0]) - 10) < 1e-6, JSON.stringify(w));
  const r2 = parseDXF(dxf(ents, { units: null, layers: ['W'] }), { scale: 0.001 }); assert(near([r2.bounds.x1, r2.bounds.y1], [0.01, 0.0003], 1e-9) && r2.units.guessed === false, 'scale set by hand');
  console.log(`PASS no units in the file: guessed as ${r.units.name} and flagged; one 0.3 m wall 10 m long; a scale set by hand overrides it`); }

// 3 · POLYLINE with a bulge, a mirrored arc, a nested block, an array
{ const ents = [
    ['0', 'POLYLINE', '8', 'P', '66', '1', '70', '0', '0', 'VERTEX', '8', 'P', '10', '0', '20', '0', '42', '1', '0', 'VERTEX', '8', 'P', '10', '2', '20', '0', '0', 'SEQEND'].join('\n'),
    ['0', 'ARC', '8', 'M', '10', '5', '20', '0', '40', '1', '50', '0', '51', '90', '210', '0', '220', '0', '230', '-1'].join('\n'),
    ['0', 'INSERT', '8', 'N', '2', 'OUTER', '10', '100', '20', '0', '70', '3', '44', '10'].join('\n')].join('\n');
  const blocks = ['0', 'BLOCK', '2', 'INNER', '10', '0', '20', '0', '0', 'LINE', '8', '0', '10', '0', '20', '0', '11', '1', '21', '0', '0', 'ENDBLK',
    '0', 'BLOCK', '2', 'OUTER', '10', '0', '20', '0', '0', 'INSERT', '8', '0', '2', 'INNER', '10', '0', '20', '5', '41', '2', '0', 'ENDBLK'].join('\n');
  const r = parseDXF(dxf(ents, { units: 6, blocks, layers: ['P', 'M', 'N'] })); assert(r.ok, r.error);
  const P = r.segs.filter((s) => s.layer === 'P'), ys = P.flatMap((s) => [s.a[1], s.b[1]]); assert(Math.min(...ys) < -0.99 && Math.max(...ys) < 1e-9, 'a bulge of 1 from (0,0) to (2,0): a half circle below, counter-clockwise');
  const M = r.segs.filter((s) => s.layer === 'M'), xs = M.flatMap((s) => [s.a[0], s.b[0]]); assert(Math.max(...xs) <= -4 + 1e-9 && Math.min(...xs) >= -6 - 1e-9, 'the Z-down arc mirrored to x −5: ' + Math.min(...xs).toFixed(2));
  const N = r.segs.filter((s) => s.layer === 'N'); assert.equal(N.length, 3, 'a nested block in an array of three: ' + N.length); assert(N.some((s) => near(s.a, [120, 5]) && near(s.b, [122, 5])), 'scaled ×2 and placed: ' + JSON.stringify(N));
  console.log(`PASS a POLYLINE bulge as a half circle, a mirrored arc, a nested block in an array of three (scaled, placed)`); }

// 4 · refused, with what to do
assert.match(parseDXF('AC1032\u0000\u0000binary').error, /DWG.*save it as DXF/);
assert.match(parseDXF('AutoCAD Binary DXF\r\n\u001a\u0000').error, /binary DXF/);
assert.match(parseDXF('hello').error, /not a DXF/);
assert.match(parseDXF(dxf(['0', 'HATCH', '8', 'H'].join('\n'), { layers: ['H'] })).error, /No lines/);
console.log('PASS DWG, binary DXF, a file that is not a DXF and a drawing with no lines are refused, each with what to do');
