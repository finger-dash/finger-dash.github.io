// Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const Layout = require('./layout.js');

const phone = { touch: true, screenMin: 390 };
const tablet = { touch: true, screenMin: 820 };

test('an upright phone fills the screen and never asks to rotate', () => {
  for (const [width, height] of [[390, 664], [375, 548], [360, 800], [430, 932]]) {
    const l = Layout.compute({ ...phone, width, height });
    assert.ok(l.portrait && !l.rotate);
    assert.ok(Math.abs(l.w / l.h - width / height) < 0.005, `${width}x${height}`);
  }
});

test('safe areas are converted to logical pixels', () => {
  const l = Layout.compute({ ...phone, width: 400, height: 860, inset: { top: 48, bottom: 34 } });
  assert.deepStrictEqual([l.top, l.bottom], [24, 17]);
});

test('only tablets are asked to rotate', () => {
  assert.ok(Layout.compute({ ...tablet, width: 820, height: 1180 }).rotate);
  assert.ok(!Layout.compute({ ...tablet, width: 1180, height: 820 }).rotate);
  assert.ok(!Layout.compute({ ...phone, width: 750, height: 342 }).rotate);
});

test('desktop keeps the 16:9 layout even in a narrow window', () => {
  const l = Layout.compute({ touch: false, screenMin: 900, width: 500, height: 900 });
  assert.deepStrictEqual([l.w, l.h, l.portrait, l.rotate], [320, 180, false, false]);
});
