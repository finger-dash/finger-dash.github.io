'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { SpinDetector } = require('./spin.js');

const STEP = 16; // ms between samples

// Feeds circles of the given radius; returns the time after the last sample.
function circles(d, { radius = 60, turns = 4, perSecond = 2, clockwise = true, from = 0 } = {}) {
  const samples = Math.round((turns / perSecond) * 1000 / STEP);
  let t = from, px = radius, py = 0;
  for (let i = 1; i <= samples; i++) {
    const a = (clockwise ? 1 : -1) * 2 * Math.PI * turns * (i / samples);
    const x = radius * Math.cos(a), y = radius * Math.sin(a);
    t += STEP;
    d.feed(x - px, y - py, t);
    px = x; py = y;
  }
  return t;
}

function swipeUp(d, t, { side = 0, steps = 10, size = 25 } = {}) {
  for (let i = 0; i < steps; i++) d.feed(side, -size, (t += STEP));
}

const detector = () => {
  const throws = [];
  const d = new SpinDetector((result) => throws.push(result));
  return { d, throws };
};

test('circles of any size build power in both directions without throwing', () => {
  for (const radius of [25, 60, 110, 160]) {
    for (const clockwise of [true, false]) {
      const { d, throws } = detector();
      circles(d, { radius, clockwise, turns: 5 });
      assert.ok(d.power > 0.4, `radius ${radius}: ${d.power}`);
      assert.strictEqual(throws.length, 0, `radius ${radius} threw by itself`);
    }
  }
});

test('more and faster circles give more power', () => {
  const slow = detector().d, fast = detector().d;
  circles(slow, { turns: 3 });
  circles(fast, { turns: 7, perSecond: 3 });
  assert.ok(fast.power > slow.power + 0.2);
});

test('shaking back and forth adds nothing', () => {
  const { d } = detector();
  for (let i = 0; i < 200; i++) d.feed(0, i % 12 < 6 ? 15 : -15, i * STEP);
  assert.ok(d.power < 0.05, String(d.power));
});

test('a straight swipe up after circling throws once, with its direction', () => {
  for (const radius of [40, 80, 120]) {
    const { d, throws } = detector();
    let t = circles(d, { radius });
    swipeUp(d, t, { side: 5 });
    swipeUp(d, t + 400);
    assert.strictEqual(throws.length, 1, `radius ${radius}`);
    assert.ok(throws[0].angle > 3 && throws[0].angle < 25, String(throws[0].angle));
    assert.ok(throws[0].power > 0.3);
  }
});

test('a swipe up on a new touch also throws', () => {
  const { d, throws } = detector();
  const t = circles(d);
  swipeUp(d, t + 400);
  assert.strictEqual(throws.length, 1);
});

test('swiping up without spinning does nothing', () => {
  const { d, throws } = detector();
  swipeUp(d, 0);
  assert.strictEqual(throws.length, 0);
});

test('power leaks while resting', () => {
  const { d } = detector();
  circles(d);
  const before = d.power;
  for (let i = 0; i < 60; i++) d.update(1 / 60);
  assert.ok(d.power < before);
});

// A short swipe, too short to throw before the finger leaves the screen.
const shortSwipe = (d, t) => { swipeUp(d, t, { steps: 4, size: 16 }); return t + 4 * STEP; };

test('lifting the finger after a short swipe up throws', () => {
  // Straight out of small circles, or on a new touch after circles of any size.
  for (const [radius, pause] of [[30, 0], [45, 0], [60, 400], [120, 400]]) {
    for (const clockwise of [true, false]) {
      const { d, throws } = detector();
      const end = shortSwipe(d, circles(d, { radius, clockwise }) + pause);
      assert.strictEqual(throws.length, 0);
      d.lift(end + 10);
      assert.strictEqual(throws.length, 1, `radius ${radius} ${clockwise}`);
    }
  }
});

test('a slow swipe up also throws when the finger leaves', () => {
  const { d, throws } = detector();
  let t = circles(d) + 400;
  for (let i = 0; i < 12; i++) d.feed(1, -7, (t += STEP));
  d.lift(t + 10);
  assert.strictEqual(throws.length, 1);
});

test('lifting after resting, going down or without spinning does nothing', () => {
  const rested = detector();
  rested.d.lift(shortSwipe(rested.d, circles(rested.d)) + 500);
  const down = detector();
  let t = circles(down.d) + 400;
  for (let i = 0; i < 8; i++) down.d.feed(0, 15, (t += STEP));
  down.d.lift(t + 10);
  const still = detector();
  still.d.lift(shortSwipe(still.d, 0));
  assert.strictEqual(rested.throws.length + down.throws.length + still.throws.length, 0);
});

test('the throw faces where the athlete is, and the swipe barely turns him', () => {
  for (const clockwise of [true, false]) {
    for (const long of [true, false]) {
      const { d, throws } = detector();
      const t = circles(d, { clockwise });
      const before = d.angle;
      if (long) swipeUp(d, t + 400);
      else d.lift(shortSwipe(d, t + 400) + 10);
      assert.strictEqual(throws.length, 1);
      assert.strictEqual(throws[0].facing, d.angle);
      assert.ok(Math.abs(d.angle - before) <= 2 * d.cfg.maxStep, `${d.angle} ${before}`);
    }
  }
});

test('lifting the finger in the middle of a circle does not throw', () => {
  for (const radius of [30, 60, 100, 150]) {
    for (const clockwise of [true, false]) {
      for (let phase = 0; phase < 1; phase += 0.05) {
        const { d, throws } = detector();
        const t = circles(d, { radius, clockwise, turns: 4 + phase });
        d.lift(t + 10);
        assert.strictEqual(throws.length, 0, `radius ${radius} ${clockwise} ${phase.toFixed(2)}`);
      }
    }
  }
});
