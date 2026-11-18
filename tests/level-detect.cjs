// Floors of an imported building, read from its geometry (2026-11-17), on generated models (no browser):
// a tower from B2 to 11F with a roof (30 x 20 m slabs, 3.0 m storeys, a 4.5 m ground floor), with walls, tables and a stair that
// must not count as floors. Checks: 13 floors and a roof at the right heights; the two basements read from the layer names; with
// no names, the floor at the file's height 0 is the ground; with neither, the lowest; moving the ground renames the floors and
// gives the offset; a one-storey box is one floor and a roof.
const assert = require('node:assert/strict'), path = require('node:path');
(async () => {
  const L = await import(path.join(__dirname, '../mvp/js/level-detect.js'));
  // a box as an imported object: 12 triangles, local to its corner
  const box = (name, x, y, z, w, d, h, srcLayer) => { const P = [[0, 0, 0], [w, 0, 0], [w, d, 0], [0, d, 0], [0, 0, h], [w, 0, h], [w, d, h], [0, d, h]], F = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
    return { name, srcLayer, g: { x, y, z, w, d, h }, mesh: F.flatMap((f) => f.flatMap((i) => P[i])) }; };
  const names = ['B2', 'B1', '1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F', '9F', '10F', '11F'], lv = []; let z = 0;
  for (let i = 0; i < names.length; i++) { lv.push(z); z += names[i] === '1F' ? 4.5 : 3.0; } const roofZ = z;   // B2 at 0 … 11F at 37.5, roof at 40.5
  const tower = (named) => { const out = [];
    lv.forEach((e, i) => { const tag = named ? names[i] + ' slab' : 'Slab ' + i; out.push(box(tag, 0, 0, e - 0.25, 30, 20, 0.25, named ? 'Level ' + names[i] : 'Floors'));
      const hh = (i < lv.length - 1 ? lv[i + 1] : roofZ) - e - 0.25; out.push(box('Wall', 0, 0, e, 0.3, 20, hh, 'Walls'), box('Wall', 29.7, 0, e, 0.3, 20, hh, 'Walls'));
      for (let t = 0; t < 6; t++) out.push(box('Table', 3 + t * 4, 5, e + 0.72, 1.6, 0.8, 0.03, 'Furniture'));
      for (let s = 0; s < 8; s++) out.push(box('Tread', 25, 2 + s * 0.28, e + s * 0.18, 1.2, 0.28, 0.04, 'Stairs')); });
    out.push(box('Roof slab', 0, 0, roofZ - 0.3, 30, 20, 0.3, 'Roof')); return out; };
  // 1. named basements
  let d = L.detectFloors(tower(true), {});
  assert.deepEqual(d.floors.map((f) => f.name), [...names, 'Roof']); assert.deepEqual(d.floors.map((f) => f.z), [...lv, roofZ]);
  assert.equal(d.ground, 2, 'two basements named'); assert.equal(d.floors[2].h, 4.5); assert.equal(d.floors[3].h, 3); assert.equal(d.floors[0].h, 3);
  assert.match(d.note, /13 floors and a roof, 3\.0–4\.5 m apart; ground floor: 1F \(2 basement floors named in the model\)/);
  console.log('PASS a B2–11F tower: 13 floors and a roof at their heights (tables and stair treads ignored); B2 and B1 below the ground from the layer names');
  // 2. no names: the file had 1F at height 0 (its lowest point, the B2 slab underside, at -6.25 m)
  d = L.detectFloors(tower(false), { sourceBounds: { min: [0, 0, -6.25], max: [30, 20, 34.25] }, unitScale: 1, importedUp: 'z' });
  assert.equal(d.ground, 2); assert.equal(d.floors[2].name, '1F'); assert.match(d.note, /the floor at height 0 in the file/);
  // 3. neither: the lowest floor is the ground; the person moves it to the third floor up
  d = L.detectFloors(tower(false), { sourceBounds: { min: [0, 0, -0.25], max: [30, 20, 40.5] }, unitScale: 1, importedUp: 'z' });
  assert.equal(d.ground, 0); assert.equal(d.floors[0].name, '1F'); assert.equal(d.floors[12].name, '13F');
  const g = L.withGround(d, 2); assert.equal(g.offset, -6); assert.deepEqual(g.floors.slice(0, 4).map((f) => [f.name, f.z]), [['B2', -6], ['B1', -3], ['1F', 0], ['2F', 4.5]]); assert.equal(g.floors.at(-1).name, 'Roof');
  console.log('PASS the ground floor: from the file\'s own height 0 when nothing is named; otherwise the lowest; choosing another renames them (B2, B1, 1F…) and moves the model by -6 m');
  // 4. a one-storey box: one floor and its roof
  d = L.detectFloors([box('Floor', 0, 0, -0.2, 12, 8, 0.2), box('Wall', 0, 0, 0, 0.2, 8, 3), box('Roof', 0, 0, 3, 12, 8, 0.25)], {});
  assert.deepEqual(d.floors.map((f) => [f.name, f.z]), [['1F', 0], ['Roof', 3.25]]); assert.equal(d.floors[0].h, 3.25);
  // 5. basement names in other forms
  for (const [n, want] of [['-2F slab', 2], ['Basement 3', 3], ['地下1层', 1], ['Level -2', 2], ['B1', 1], ['Bench', 0]]) assert.equal(L.basementCount([{ name: n }]), want, n);
  console.log('PASS a one-storey box: one floor and a roof; basement names: -2F, Basement 3, 地下1层, Level -2, B1 (not "Bench")');
})().catch((e) => { console.error(e); process.exit(1); });
