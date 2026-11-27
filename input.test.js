// Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const { GestureDetector } = require('./input.js');

function setup() {
  const jumps = [];
  const detector = new GestureDetector((s) => jumps.push(s));
  return { detector, jumps };
}

const swipe = [4, 10, 18, 22, 16, 8];

// Feeds downward pointer movement every 16 ms and returns the last timestamp.
function point(detector, deltas, t) {
  for (const d of deltas) detector.move(d, (t += 16));
  return t;
}

// Two-finger scroll with natural scrolling: downward fingers => negative deltaY.
function scroll(detector, deltas, t) {
  for (const d of deltas) detector.wheel({ deltaX: 0, deltaY: -d, deltaMode: 0 }, (t += 16));
  return t;
}

test('each separated downward swipe charges the bar once', () => {
  const { detector } = setup();
  let t = 0;
  for (let i = 0; i < 5; i++) t = point(detector, swipe, t + 100);
  assert.strictEqual(detector.strokes, 5);
  assert.ok(Math.abs(detector.charge - 0.4) < 1e-9);
});

test('upward movement and tiny nudges do not charge', () => {
  const { detector } = setup();
  const t = point(detector, swipe.map((d) => -d), 0);
  point(detector, [3, 4, 3], t + 100);
  assert.strictEqual(detector.strokes, 0);
});

test('two-finger swipes charge, momentum adds nothing', () => {
  const { detector } = setup();
  const momentum = Array.from({ length: 60 }, (_, i) => Math.max(1, Math.round(70 * 0.92 ** i)));
  const t = scroll(detector, [8, 30, 60, ...momentum], 0);
  assert.strictEqual(detector.strokes, 1);
  scroll(detector, swipe, t); // new swipe right on top of the tail
  assert.strictEqual(detector.strokes, 2);
});

test('scroll direction can be inverted', () => {
  const { detector } = setup();
  detector.naturalScroll = false;
  scroll(detector, swipe.map((d) => -d), 0);
  assert.strictEqual(detector.strokes, 1);
});

test('faster swiping sustains more charge', () => {
  const run = (periodMs) => {
    const { detector } = setup();
    for (let t = 0; t < 8000; t += 10) {
      if (t % periodMs < 60) detector.move(10, t);
      detector.update(t);
    }
    return detector.charge;
  };
  const slow = run(500), medium = run(250), fast = run(140);
  assert.ok(slow < medium && medium < fast, `${slow} ${medium} ${fast}`);
  assert.ok(fast > 0.85);
});

test('charge leaks unless frozen', () => {
  const { detector } = setup();
  detector.addStroke('key');
  detector.update(0);
  detector.update(100, true);
  assert.strictEqual(detector.charge, 0.08);
  detector.update(200);
  assert.ok(detector.charge < 0.08);
});

test('a quick upward flick jumps once, with either input', () => {
  const flick = [-10, -30, -45, -35, -28, -20, -14, -9, -5];
  for (const feed of [point, scroll]) {
    const { detector, jumps } = setup();
    feed(detector, flick, 1000);
    assert.deepStrictEqual(jumps, ['flick']);
  }
});

test('slow or short upward movement does not jump', () => {
  const { detector, jumps } = setup();
  const t = point(detector, Array(40).fill(-5), 0); // slow reposition
  point(detector, [-15, -20, -10], t + 200);        // short nudge
  assert.deepStrictEqual(jumps, []);
});

test('running swipes never jump', () => {
  const { detector, jumps } = setup();
  let t = 0;
  for (let i = 0; i < 30; i++) t = point(detector, [...swipe, -1, -2], t + 80);
  assert.deepStrictEqual(jumps, []);
});
