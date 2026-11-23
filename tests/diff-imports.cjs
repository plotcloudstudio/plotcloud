// Version diff (2026-11-23), in the browser (diff.js uses three.js): a sample's boxes (ground, neighbouring blocks) that the Workspace
// moved into Plan Studio's imports under the same id are neither removed nor added; a box really deleted is still listed as removed.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }), p = await b.newPage(), base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
  try { await p.goto(base + '/mvp/');
    const r = await p.evaluate(async () => { const { diff } = await import('./js/diff.js');
      const box = (id, name) => ({ id, name, type: 'mass', layer: 'Context', g: { x: 0, y: 0, z: 0, w: 5, d: 5, h: 9 } }), scene = (comps, imports) => ({ studio: { levels: [{ id: 'L1', z: 0 }], walls: [], imports }, model: { units: 'm', layers: [], components: comps } });
      const a = scene([box('c1', 'Neighbour block east'), box('c2', 'Neighbour block north'), box('c3', 'Site ground')], []), L = (d) => (d.items || d).filter((x) => x.change !== 'modified').map((x) => x.change + ' ' + x.name);
      return { moved: L(diff(a, scene([], [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }]))), deleted: L(diff(a, scene([], [{ id: 'c1' }, { id: 'c3' }]))) }; });
    assert.deepEqual(r.moved, [], 'boxes moved into imports are not removed'); assert.deepEqual(r.deleted, ['removed Neighbour block north'], 'a box really deleted is removed');
    console.log('PASS boxes moved into Plan Studio imports are kept; a deleted one is still reported');
  } finally { await b.close(); } })().catch((e) => { console.error(e); process.exit(1); });
