'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Touch = require('./touch.js');
const Motion = require('./motion.js');

function record() {
  const seen = [];
  const touch = Touch.create((a) => seen.push(a), () => 200);
  // Draws a path, one point every 16 ms.
  const draw = (points, id = 1) => {
    points.forEach(([x, y], i) => touch[i ? 'move' : 'down']({ id, x, y, t: i * 16 }));
    const [x, y] = points[points.length - 1];
    touch.up({ id, x, y, t: points.length * 16 });
  };
  return { seen, touch, draw, types: () => seen.map((a) => a.type) };
}

test('a short still press is a tap on its side', () => {
  const r = record();
  r.draw([[150, 100], [151, 101]]);
  assert.deepStrictEqual(r.types(), ['press', 'release', 'tap']);
  assert.strictEqual(r.seen[2].side, 'right');
});

test('a fast upward stroke flicks once and is also a swipe', () => {
  const r = record();
  r.draw([[50, 200], [50, 180], [50, 150], [50, 120], [50, 90]]);
  assert.deepStrictEqual(r.types(), ['press', 'flick', 'release', 'swipe']);
  assert.strictEqual(r.seen[3].dir, 'up');
});

test('a bent swipe reports its curve', () => {
  const r = record();
  r.draw([[50, 200], [70, 170], [74, 140], [65, 110], [50, 80]]);
  assert.ok(Math.abs(r.seen[r.seen.length - 1].curve) > 0.3);
});

test('circles add up', () => {
  const r = record();
  r.draw(Array.from({ length: 41 }, (_, i) =>
    [100 + 30 * Math.cos(i / 20 * Math.PI * 2), 100 + 30 * Math.sin(i / 20 * Math.PI * 2)]));
  assert.ok(r.touch.spin() > Math.PI * 3);
  assert.strictEqual(r.touch.spin(), 0);
});

test('tilt is measured from the first reading and survives the wrap', () => {
  const m = Motion.create(null);
  assert.strictEqual(m.tilt(), null);
  m.reading({ alpha: 359, beta: 40, gamma: 2 });
  m.reading({ alpha: 5, beta: 30, gamma: 17 });
  assert.deepStrictEqual(m.tilt(), { x: 15, y: -10 });
  assert.strictEqual(m.twist(), 6 + 15);
});
