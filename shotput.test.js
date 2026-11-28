'use strict';
const test = require('node:test');
const assert = require('node:assert');
const ShotPut = require('./shotput.js');

const seeded = (seed = 11) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const contest = () => ShotPut.createContest({ rng: seeded() });
const run = (c, seconds) => { for (let i = 0; i < seconds * 60; i++) ShotPut.step(c, 1 / 60); };

const throwIt = (c, power, facing = 0) => {
  assert.ok(ShotPut.throwShot(c, power, facing));
  run(c, ShotPut.FLIGHT_TIME + 0.1);
  return c.result;
};
const heading = (shot) => Math.atan2(shot.side, shot.forward) * 180 / Math.PI;

test('more power throws further, within realistic marks', () => {
  const weak = throwIt(contest(), 0.2).mark, strong = throwIt(contest(), 1).mark;
  assert.ok(weak > 9 && strong > weak && strong <= 22.01, `${weak} ${strong}`);
});

test('the shot leaves exactly where the athlete faces', () => {
  for (const facing of [0, 20, -40, 75, 135, -170, 380, -725]) {
    const c = contest();
    assert.ok(ShotPut.throwShot(c, 0.8, facing));
    assert.ok(Math.abs(Math.cos((heading(c.shot) - facing) * Math.PI / 180) - 1) < 1e-9, String(facing));
  }
});

test('crooked throws lose distance and leave the sector', () => {
  const straight = throwIt(contest(), 0.8).mark;
  assert.ok(throwIt(contest(), 0.8, 30).mark < straight);
  assert.deepStrictEqual(throwIt(contest(), 0.8, -70), { mark: null, reason: 'FOUL' });
});

test('releasing with the back to the field throws the wrong way', () => {
  for (const facing of [120, 180, -100]) {
    assert.deepStrictEqual(throwIt(contest(), 0.8, facing), { mark: null, reason: 'WRONG WAY' });
  }
});

test('facing the field counts, whatever the number of turns', () => {
  const straight = throwIt(contest(), 0.8).mark;
  assert.ok(Math.abs(throwIt(contest(), 0.8, 3 * 360).mark - straight) < 0.01);
});

test('harder levels have a narrower sector', () => {
  const foul = (difficulty) => {
    const c = ShotPut.createContest({ rng: seeded(), difficulty });
    ShotPut.throwShot(c, 0.8, 40);
    return c.shot.foul;
  };
  assert.deepStrictEqual(['easy', 'normal', 'hard'].map(foul), [false, false, true]);
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
