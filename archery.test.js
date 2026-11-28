'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Archery = require('./archery.js');

const seeded = (seed = 5) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const contest = (options) => Archery.createContest({ rng: seeded(), ...options });
const run = (c, seconds) => { for (let i = 0; i < seconds * 60; i++) Archery.step(c, 1 / 60); };

// Shoots with the sight exactly on (x, y).
function shoot(c, x = 0, y = 0, draw = 1) {
  Archery.pull(c, draw);
  const s = Archery.sway(c);
  c.aim = { x: x - s.x, y: y - s.y };
  assert.ok(Archery.loose(c));
  run(c, Archery.FLIGHT_TIME + 0.1);
  return c.result.points;
}

test('rings score from 10 in the middle to 0 off the face', () => {
  assert.strictEqual(Archery.score(0, 0), 10);
  assert.strictEqual(Archery.score(Archery.RING * 1.5, 0), 9);
  assert.strictEqual(Archery.score(0, -Archery.RADIUS + 0.001), 1);
  assert.strictEqual(Archery.score(Archery.RADIUS, 0.1), 0);
});

test('a fully drawn arrow on target scores 10', () => {
  assert.strictEqual(shoot(contest()), 10);
});

test('a weak draw drops the arrow', () => {
  assert.ok(shoot(contest(), 0, 0, 0.7) < 6);
});

test('the wind drags the sight downwind while aiming', () => {
  for (const base of [-3, 3]) {
    const c = contest();
    c.wind.base = base;
    c.aim = { x: 0, y: 0 };
    run(c, 2);
    assert.strictEqual(Math.sign(c.aim.x), Math.sign(base));
    assert.ok(Math.abs(c.aim.x) > Archery.RING * 2, `${c.aim.x}`);
    assert.strictEqual(c.aim.y, 0);
  }
});

test('gusts change the speed but never the direction', () => {
  const c = contest();
  c.wind.base = -2;
  const speeds = [];
  for (let i = 0; i < 600; i++) {
    Archery.step(c, 1 / 60);
    speeds.push(c.wind.speed);
  }
  assert.ok(speeds.every((v) => v <= -1 && v >= -3));
  assert.ok(Math.max(...speeds) - Math.min(...speeds) > 0.8);
});

test('there is always a fair share of wind, to either side', () => {
  for (const [difficulty, { wind }] of Object.entries(Archery.DIFFICULTY)) {
    const bases = Array.from({ length: 40 }, (_, i) => contest({ difficulty, rng: seeded(i + 1) }).wind.base);
    assert.ok(bases.every((v) => Math.abs(v) >= wind / 2 - 0.05 && Math.abs(v) <= wind), `${bases}`);
    assert.ok(bases.some((v) => v < 0) && bases.some((v) => v > 0));
  }
});

test('the wind makes the sight shudder around the aim', () => {
  const c = contest();
  c.wind.speed = 5;
  const offsets = Array.from({ length: 30 }, (_, i) => {
    c.time = i / 30;
    return Archery.sight(c).x - c.aim.x;
  });
  assert.ok(Math.max(...offsets) > 0.01 && Math.min(...offsets) < -0.01);
  assert.ok(offsets.every((v) => Math.abs(v) <= 5 * Archery.BUFFET + 1e-9));
});

test('the arrow lands where the sight points, with no extra push', () => {
  const c = contest();
  c.wind.speed = 4;
  Archery.pull(c, 1);
  const at = Archery.sight(c);
  Archery.loose(c);
  assert.deepStrictEqual(c.impact, at);
});

test('barely pulling the string cancels the shot', () => {
  const c = contest();
  Archery.pull(c, 0.1);
  assert.ok(!Archery.loose(c));
  assert.deepStrictEqual([c.phase, c.draw], ['aim', 0]);
});

test('the draw never goes back and the shake grows when held', () => {
  const c = contest();
  Archery.pull(c, 0.8);
  Archery.pull(c, 0.2);
  assert.strictEqual(c.draw, 0.8);
  const spread = () => {
    let max = 0;
    for (let i = 0; i < 200; i++) {
      Archery.step(c, 1 / 60);
      const s = Archery.sway(c);
      max = Math.max(max, Math.hypot(s.x, s.y));
    }
    return max;
  };
  const early = spread();
  run(c, 4);
  assert.ok(spread() > early * 2);
});

test('six arrows, then the highest total wins', () => {
  const c = contest();
  for (let i = 1; i <= Archery.ARROWS; i++) {
    shoot(c);
    assert.strictEqual(c.hits.length, i);
    assert.strictEqual(Archery.nextArrow(c), i < Archery.ARROWS);
  }
  assert.ok(Archery.isOver(c));
  assert.strictEqual(Archery.total(c.player), 60);
  assert.strictEqual(Archery.standings(c)[0], c.player);
});

test('pulling back like a cue can relax the string and cancel the shot', () => {
  const c = Archery.createContest({ rng: () => 0.5 });
  Archery.drawTo(c, 0.8);
  Archery.step(c, 1);
  Archery.drawTo(c, 0.5);
  assert.strictEqual(c.draw, 0.5);
  Archery.drawTo(c, -1);
  assert.strictEqual(c.draw, 0);
  assert.strictEqual(c.held, 0);
  assert.ok(!Archery.loose(c));
  assert.strictEqual(c.phase, 'aim');
});
