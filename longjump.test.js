'use strict';
const test = require('node:test');
const assert = require('node:assert');
const LongJump = require('./longjump.js');

const DT = 1 / 60;
const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const contest = (options) => LongJump.createContest({ rng: seeded(), ...options });

const runTo = (c, s, speed = 12) => {
  while (c.phase === 'run' && c.jumper.s < s) LongJump.step(c, DT, speed);
};
const until = (c, phase, speed = 0) => {
  for (let i = 0; i < 2000 && c.phase !== phase; i++) LongJump.step(c, DT, speed);
  assert.strictEqual(c.phase, phase);
};

// Runs, takes off `gap` meters before the board and releases at `angle`.
function jump(c, { gap = 0.3, angle = LongJump.BEST_ANGLE, stretchAt = null, speed = 12 } = {}) {
  runTo(c, LongJump.BOARD - gap, speed);
  assert.ok(LongJump.takeOff(c));
  while (c.phase === 'angle' && c.angle < angle) LongJump.step(c, DT, 0);
  LongJump.release(c);
  while (c.phase === 'flight') {
    if (stretchAt !== null && c.time / LongJump.FLIGHT_TIME >= stretchAt) LongJump.stretch(c);
    LongJump.step(c, DT, 0);
  }
  return c.result;
}

test('a good jump gets a realistic mark', () => {
  const result = jump(contest());
  assert.strictEqual(result.reason, null);
  assert.ok(result.mark > 5.5 && result.mark < 8, String(result.mark));
});

test('speed, angle, board accuracy and landing all matter', () => {
  const base = jump(contest()).mark;
  assert.ok(jump(contest(), { speed: 14 }).mark > base);
  assert.ok(jump(contest(), { angle: 5 }).mark < base);
  assert.ok(jump(contest(), { angle: 45 }).mark < base);
  assert.ok(jump(contest(), { gap: 1.5 }).mark < base);
  assert.ok(jump(contest(), { stretchAt: LongJump.STRETCH_AT }).mark > base + 0.3);
  assert.ok(jump(contest(), { stretchAt: 0.1 }).mark <= base + 0.05);
});

test('stretching works once, only in the air', () => {
  const c = contest();
  assert.ok(!LongJump.stretch(c));
  runTo(c, LongJump.BOARD - 0.3);
  LongJump.takeOff(c);
  LongJump.release(c);
  while (c.time < LongJump.FLIGHT_TIME * 0.5) LongJump.step(c, DT, 0);
  assert.ok(LongJump.stretch(c));
  assert.ok(!LongJump.stretch(c));
});

test('a swipe right after setting the angle is ignored and costs nothing', () => {
  const c = contest();
  runTo(c, LongJump.BOARD - 0.3);
  LongJump.takeOff(c);
  LongJump.release(c);
  LongJump.step(c, DT, 0);
  assert.ok(!LongJump.stretch(c), 'the finger drifting after the click');
  assert.strictEqual(c.stretch, null);
  while (c.time < LongJump.FLIGHT_TIME * LongJump.STRETCH_AT) LongJump.step(c, DT, 0);
  assert.ok(LongJump.stretch(c));
  assert.ok(c.stretch.bonus > 0.4);
});

test('take-offs far from the board are ignored', () => {
  const c = contest();
  runTo(c, LongJump.BOARD - LongJump.TAKEOFF_ZONE - 5);
  assert.ok(!LongJump.takeOff(c));
  assert.strictEqual(c.phase, 'run');
});

test('crossing the board is a foul, jumping or not', () => {
  const through = contest();
  until(through, 'landed', 12);
  assert.deepStrictEqual([through.result.mark, through.result.reason], [null, 'FOUL']);

  const late = contest();
  runTo(late, LongJump.BOARD + 0.05);
  LongJump.takeOff(late);
  LongJump.release(late);
  until(late, 'landed');
  assert.strictEqual(late.result.reason, 'FOUL');
});

test('the angle locks by itself at the top of the meter', () => {
  const c = contest();
  runTo(c, LongJump.BOARD - 0.3);
  LongJump.takeOff(c);
  until(c, 'flight');
  assert.strictEqual(c.angle, LongJump.MAX_ANGLE);
});

test('three attempts, rivals revealed round by round, then it is over', () => {
  const c = contest();
  assert.ok(!LongJump.nextAttempt(c));
  for (let i = 1; i <= LongJump.ATTEMPTS; i++) {
    jump(c);
    assert.ok(c.athletes.every((a) => a.marks.length === i));
    assert.strictEqual(LongJump.isOver(c), i === LongJump.ATTEMPTS);
    assert.strictEqual(LongJump.nextAttempt(c), i < LongJump.ATTEMPTS);
  }
});

test('standings use the best mark, then the second best', () => {
  const c = contest();
  const marks = [[7, 5, null], [7, 6, 5], [null, null, null], [8, null, null], [6, 6, 6], [5, 5, 5]];
  c.athletes.forEach((a, i) => { a.marks = marks[i]; });
  assert.deepStrictEqual(LongJump.standings(c).map((a) => c.athletes.indexOf(a)), [3, 1, 0, 4, 5, 2]);
  assert.strictEqual(LongJump.best(c.athletes[2]), null);
});

test('rivals are stronger on harder levels and never wear the player colors', () => {
  const total = (difficulty) => contest({ difficulty, country: 'BRA' }).athletes.slice(1)
    .reduce((sum, a) => sum + a.plan.reduce((s, m) => s + (m || 0), 0), 0);
  assert.ok(total('easy') < total('normal') && total('normal') < total('hard'));
  assert.ok(contest({ country: 'BRA' }).athletes.slice(1).every((a) => a.country !== 'BRA'));
});
