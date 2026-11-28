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
