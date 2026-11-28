'use strict';
const test = require('node:test');
const assert = require('node:assert');
const ShotPut = require('./shotput.js');

const seeded = (seed = 11) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const contest = () => ShotPut.createContest({ rng: seeded() });
const run = (c, seconds) => { for (let i = 0; i < seconds * 60; i++) ShotPut.step(c, 1 / 60); };

const throwIt = (c, power, angle = 0) => {
  assert.ok(ShotPut.throwShot(c, power, angle));
  run(c, ShotPut.FLIGHT_TIME + 0.1);
  return c.result;
};

test('more power throws further, within realistic marks', () => {
  const weak = throwIt(contest(), 0.2).mark, strong = throwIt(contest(), 1).mark;
  assert.ok(weak > 9 && strong > weak && strong <= 22.01, `${weak} ${strong}`);
});

test('crooked throws lose distance and leave the sector', () => {
  const straight = throwIt(contest(), 0.8).mark;
  assert.ok(throwIt(contest(), 0.8, 25).mark < straight);
  assert.deepStrictEqual(throwIt(contest(), 0.8, -40), { mark: null, reason: 'FOUL' });
});

test('releasing while facing away throws the shot out', () => {
  for (const facing of [90, 180, -120]) {
    const c = contest();
    assert.ok(ShotPut.throwShot(c, 0.8, 0, facing));
    assert.ok(c.shot.foul && c.shot.wrongWay);
    const heading = Math.atan2(c.shot.side, c.shot.forward) * 180 / Math.PI;
    assert.ok(Math.abs(Math.cos((heading - facing) * Math.PI / 180) - 1) < 1e-9);
    run(c, ShotPut.FLIGHT_TIME + 0.1);
    assert.deepStrictEqual(c.result, { mark: null, reason: 'WRONG WAY' });
  }
});

test('facing the field counts, whatever the number of turns', () => {
  const straight = throwIt(contest(), 0.8).mark;
  const c = contest();
  ShotPut.throwShot(c, 0.8, 0, 3 * 360);
  assert.ok(!c.shot.foul);
  assert.ok(Math.abs(c.shot.distance - straight) < 0.01);
  const edge = contest();
  ShotPut.throwShot(edge, 0.8, 0, -360 - ShotPut.WINDOW.normal);
  assert.ok(!edge.shot.foul && edge.shot.side < 0);
});

test('harder levels ask for better timing', () => {
  const at = (difficulty) => {
    const c = ShotPut.createContest({ rng: seeded(), difficulty });
    ShotPut.throwShot(c, 0.8, 0, 55);
    return c.shot.wrongWay;
  };
  assert.deepStrictEqual(['easy', 'normal', 'hard'].map(at), [false, false, true]);
});

test('the clock only runs once the spin starts', () => {
  const c = contest();
  run(c, 20);
  assert.strictEqual(c.phase, 'spin');
  ShotPut.begin(c);
  run(c, ShotPut.TIME_LIMIT + 0.1);
  assert.strictEqual(c.result.reason, 'TIME OUT');
});

test('three attempts with rivals revealed round by round', () => {
  const c = contest();
  for (let i = 1; i <= ShotPut.ATTEMPTS; i++) {
    throwIt(c, 0.5);
    assert.ok(c.athletes.every((a) => a.marks.length === i));
    assert.strictEqual(ShotPut.nextAttempt(c), i < ShotPut.ATTEMPTS);
  }
  assert.ok(ShotPut.isOver(c));
});
