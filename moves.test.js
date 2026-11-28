'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Moves = require('./moves.js');
const Home = require('./home.js');

const events = Home.EVENTS.map((e) => e.id);
const numbers = (value) => (typeof value === 'number' ? [value]
  : value && typeof value === 'object' ? Object.values(value).flatMap(numbers) : []);

test('every event has its own movements', () => {
  const shapes = events.map((id) => JSON.stringify([0.3, 1.2, 1.8].map((t) => Moves.pose(id, t))));
  assert.strictEqual(new Set(shapes).size, events.length);
});

test('every pose is complete at any moment', () => {
  for (const id of events) {
    for (let t = 0; t < 12; t += 0.05) {
      const pose = Moves.pose(id, t);
      assert.strictEqual(pose.legs.length, 2);
      assert.strictEqual(pose.arms.length, 2);
      assert.ok(numbers(pose).every(Number.isFinite), `${id} at ${t.toFixed(2)}`);
    }
  }
});

test('the movements flow without jumps', () => {
  for (const id of events) {
    let last = Moves.pose(id, 0);
    for (let t = 1 / 60; t < 14; t += 1 / 60) {
      const pose = Moves.pose(id, t);
      pose.arms.forEach((arm, i) => {
        const step = Math.hypot(...arm.hand.map((v, k) => v - last.arms[i].hand[k]));
        assert.ok(step < 9, `${id}: hand jumps ${step.toFixed(1)} at ${t.toFixed(2)}`);
      });
      last = pose;
    }
  }
});
