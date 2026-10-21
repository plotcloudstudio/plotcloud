const test = require('node:test');
const assert = require('node:assert/strict');
const {baseline} = require('../render-compare.js');
const version = (source, context = {}) => ({request: {source_image: source}, sourceContext: context});
test('unknown input never claims matching camera', () => {
  assert.equal(baseline(version('a'), version('b')).kind, 'unknown');
  assert.equal(baseline(version('a'), version('a')).kind, 'same-image');
});
test('capture identity and actual image both needed for controlled Studio comparison', () => {
  const c = {project: 'p', sourceRecordId: 'capture'};
  assert.equal(baseline(version('a', c), version('a', c)).kind, 'same');
  assert.equal(baseline(version('a', c), version('refined', c)).kind, 'related');
  assert.equal(baseline(version('a', c), version('a', {...c, sourceRecordId: 'other'})).kind, 'different');
  assert.equal(baseline(version('a', c), version('a', {...c, project: 'other'})).kind, 'different');
});
