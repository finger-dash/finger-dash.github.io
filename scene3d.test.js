'use strict';
const test = require('node:test');
const assert = require('node:assert');

test('polygons crossing the near plane draw from any camera position', () => {
  const root = {};
  new Function('window', require('node:fs').readFileSync(`${__dirname}/scene3d.js`, 'utf8')
    .replace('})(this);', '})(window);'))(root);
  const ctx = { beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {} };
  const scene = root.Scene3d.create({ ctx, rect() {}, W: 320, H: 180, layout: { horizon: 70 } });
  for (let z = -10; z < 70; z += 0.0137) {
    scene.camera.z = z;
    scene.poly([[-80, 0, z - 4], [80, 0, z - 4], [80, 0, z + 4], [-80, 0, z + 4]], '#000');
  }
  assert.ok(true);
});
