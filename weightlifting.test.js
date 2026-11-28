'use strict';
const test = require('node:test');
const assert = require('node:assert');
const W = require('./weightlifting.js');

const DT = 1 / 60;
// Repeats the same numbers, so every contest in a test behaves alike.
const rng = () => 0.4;
const contest = () => W.createContest({ rng });

function wait(c, seconds) {
  for (let t = 0; t < seconds - 1e-9; t += DT) W.step(c, DT);
}

// Taps the lower side `rate` times a second until the pull is over.
function pull(c, rate = 14) {
  while (c.phase === 'pull') {
    W.tap(c, W.tilt(c) > 0 ? 'right' : 'left');
    wait(c, 1 / rate);
  }
}

function toHold(c) {
  W.lift(c);
  pull(c);
  wait(c, W.LIFT_TIME + DT);
}

// Waits for a marker to be inside (or well outside) the green zone and taps it.
function tapWhen(c, side, inside) {
  for (let i = 0; i < 600; i++) {
    const off = Math.abs(W.marker(c, side) - W.GREEN);
    if (c.time >= W.HOLD_GUARD && (inside ? off < W.zone(c) * 0.8 : off > W.zone(c) * 1.2)) break;
    W.step(c, DT);
  }
  return W.tap(c, side);
}

test('the weight moves in steps and never goes below the last one asked for', () => {
  const c = contest();
  assert.strictEqual(c.weight, 140);
  W.changeWeight(c, 3);
  assert.strictEqual(c.weight, 155);
  W.changeWeight(c, -100);
  assert.strictEqual(c.weight, W.MIN_WEIGHT);
  W.changeWeight(c, 100);
  assert.strictEqual(c.weight, W.MAX_WEIGHT);
});

test('a level pull goes on to the clean and jerk and then the hold', () => {
  const c = contest();
  W.lift(c);
  pull(c);
  assert.strictEqual(c.phase, 'lift');
  assert.strictEqual(W.tap(c, 'left'), false, 'the jerk needs no keys');
  wait(c, W.LIFT_TIME + DT);
  assert.strictEqual(c.phase, 'hold');
  assert.deepStrictEqual(c.events.map((e) => e.type).filter((t) => t !== 'tap'), ['catch', 'jerk']);
});

test('tapping only one side drops the bar on the other', () => {
  const c = contest();
  W.lift(c);
  while (c.phase === 'pull') W.tap(c, 'left');
  assert.deepStrictEqual(c.result, { mark: null, reason: 'LOST BALANCE', side: 'right' });
});

test('slow tapping runs out of time and the clock waits for the first tap', () => {
  const c = contest();
  W.lift(c);
  wait(c, W.PULL_TIME * 2);
  assert.strictEqual(c.phase, 'pull');
  for (let i = 0; c.phase === 'pull'; i++) {
    W.tap(c, i % 2 ? 'left' : 'right');
    wait(c, 0.5);
  }
  assert.strictEqual(c.result.reason, 'TOO HEAVY');
});

test('a heavier bar needs more taps and gives a smaller target', () => {
  const light = contest(), heavy = contest();
  W.changeWeight(heavy, 10);
  const taps = (c) => {
    W.lift(c);
    pull(c);
    return c.events.filter((e) => e.type === 'tap').length;
  };
  assert.ok(taps(heavy) > taps(light));
  assert.ok(W.zone(heavy) < W.zone(light));
  assert.ok(W.period(heavy) < W.period(light));
});

test('stopping both markers on green is a good lift', () => {
  const c = contest();
  toHold(c);
  assert.strictEqual(tapWhen(c, 'right', true), true);
  assert.strictEqual(c.phase, 'hold');
  assert.strictEqual(W.tap(c, 'right'), false, 'one tap per side');
  tapWhen(c, 'left', true);
  assert.deepStrictEqual(c.result, { mark: 140, reason: null, side: null });
  assert.strictEqual(W.best(c.player), 140);
});

test('one tap off the green drops the bar on that side', () => {
  const c = contest();
  toHold(c);
  tapWhen(c, 'right', false);
  assert.deepStrictEqual(c.result, { mark: null, reason: 'MISSED', side: 'right' });
});

test('taps left over from the pull do not count in the hold', () => {
  const c = contest();
  toHold(c);
  assert.strictEqual(W.tap(c, 'left'), false);
  assert.strictEqual(c.markers.left.stopped, null);
});

test('waiting too long in the hold loses the lift', () => {
  const c = contest();
  toHold(c);
  wait(c, W.HOLD_TIME + DT);
  assert.strictEqual(c.result.reason, 'TOO LATE');
});

test('three attempts: the next one asks for more after a good lift', () => {
  const c = contest();
  toHold(c);
  tapWhen(c, 'left', true);
  tapWhen(c, 'right', true);
  assert.ok(W.nextAttempt(c));
  assert.strictEqual(c.weight, 145);
  assert.strictEqual(W.changeWeight(c, -1), false);
  W.lift(c);
  while (c.phase === 'pull') W.tap(c, 'left');
  assert.ok(W.nextAttempt(c));
  assert.strictEqual(c.weight, 145, 'a missed weight may be tried again');
  W.lift(c);
  while (c.phase === 'pull') W.tap(c, 'left');
  assert.ok(W.isOver(c));
  assert.strictEqual(W.nextAttempt(c), false);
});

test('rivals lift whole steps that never go down, and the best one leads', () => {
  const c = W.createContest();
  for (const rival of c.athletes.slice(1)) {
    const made = rival.plan.filter((m) => m !== null);
    made.forEach((m, i) => {
      assert.strictEqual(m % W.STEP, 0);
      if (i) assert.ok(m > made[i - 1]);
    });
  }
  assert.strictEqual(W.toBeat(c), null);
  W.lift(c);
  while (c.phase === 'pull') W.tap(c, 'left');
  const table = W.standings(c);
  assert.strictEqual(W.best(table[0]), W.toBeat(c));
});
