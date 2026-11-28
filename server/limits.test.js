// Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const { originAllowed, createBucket, parseMessage } = require('./limits.js');

test('only listed origins are accepted', () => {
  const allowed = ['https://game.example'];
  assert.ok(originAllowed('https://game.example', allowed));
  assert.ok(!originAllowed('https://game.example.evil.test', allowed));
  assert.ok(!originAllowed(undefined, allowed));
});

test('the bucket allows a burst, then refills over time', () => {
  const take = createBucket(10, 3, 0);
  assert.deepStrictEqual([take(0), take(0), take(0), take(0)], [true, true, true, false]);
  assert.ok(take(100));
  assert.ok(!take(100));
});

test('only JSON objects with a type are messages', () => {
  assert.deepStrictEqual(parseMessage('{"type":"ping"}'), { type: 'ping' });
  for (const bad of ['', 'nope', '[]', 'null', '1', '{"type":3}']) {
    assert.strictEqual(parseMessage(bad), null, bad);
  }
});
