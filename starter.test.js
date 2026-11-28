// Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const Starter = require('./starter.js');

// Advances the start and returns the calls with the moment of each one.
function calls(s, seconds) {
  const heard = [];
  for (let t = 0; t < seconds; t += 0.01) {
    const call = Starter.step(s, 0.01);
    if (call) heard.push([call, t]);
  }
  return heard;
}

test('the starter calls marks, set and go in order, each once', () => {
  const heard = calls(Starter.create({ rng: () => 0.5 }), 8);
  assert.deepStrictEqual(heard.map(([c]) => c), ['marks', 'set', 'go']);
  assert.ok(Math.abs(heard[1][1] - Starter.SET_AT) < 0.05);
  assert.ok(Math.abs(heard[2][1] - heard[1][1] - 1.5) < 0.05);
});

test('the wait before the go is random, between its limits', () => {
  assert.strictEqual(Starter.create({ rng: () => 0 }).wait, Starter.WAIT_MIN);
  assert.ok(Math.abs(Starter.create({ rng: () => 0.999 }).wait - Starter.WAIT_MAX) < 0.01);
});

test('a swipe right after the first call is forgiven', () => {
  const s = Starter.create();
  calls(s, Starter.GUARD / 2);
  assert.strictEqual(Starter.jumpTheGun(s), null);
  assert.strictEqual(s.faults, 0);
});

test('the first false start repeats the start and the second one is out', () => {
  const s = Starter.create({ rng: () => 0 });
  calls(s, 1);
  assert.strictEqual(Starter.jumpTheGun(s), 'warning');
  assert.strictEqual(Starter.banner(s, 'IS A FOUL').note, 'NEXT ONE IS A FOUL');
  assert.strictEqual(Starter.jumpTheGun(s), null); // not counted twice
  assert.deepStrictEqual(calls(s, Starter.FALSE_TIME + 0.1).map(([c]) => c), ['marks']);
  calls(s, Starter.SET_AT);
  assert.strictEqual(s.phase, 'set');
  assert.strictEqual(Starter.jumpTheGun(s), 'out');
  assert.deepStrictEqual(calls(s, 8), []);
  assert.strictEqual(Starter.banner(s), null);
});

test('after the go there are no false starts', () => {
  const s = Starter.create({ rng: () => 0 });
  calls(s, 8);
  assert.strictEqual(s.phase, 'go');
  assert.strictEqual(Starter.jumpTheGun(s), null);
});
