'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Boxing = require('./boxing.js');

const DT = 1 / 60;
const seeded = (seed = 3) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const run = (b, seconds) => { for (let i = 0; i < Math.round(seconds * 60); i++) Boxing.step(b, DT); };
const fight = (options) => {
  const b = Boxing.createBout({ rng: seeded(), ...options });
  run(b, Boxing.INTRO + 0.05);
  return b;
};
const until = (b, state) => {
  for (let i = 0; i < 600 && b.opponent.state !== state; i++) Boxing.step(b, DT);
  assert.strictEqual(b.opponent.state, state);
};

test('nothing happens before the bell', () => {
  const b = Boxing.createBout({ rng: seeded() });
  assert.ok(!Boxing.punch(b, 'left'));
  assert.ok(!Boxing.dodge(b, 'left'));
});

test('dodging to either side slips the punch and only costs him stamina', () => {
  for (const direction of ['left', 'right']) {
    for (const hand of ['left', 'right']) {
      const b = fight();
      until(b, 'strike');
      b.opponent.side = hand;
      assert.ok(Boxing.dodge(b, direction));
      const before = b.opponent.stamina;
      run(b, 0.35);
      assert.strictEqual(b.player.health, Boxing.HEALTH);
      assert.strictEqual(b.opponent.state, 'guard'); // back on guard, not dazed
      assert.ok(b.opponent.stamina < before - Boxing.SWING.miss + 8);
    }
  }
});

test('only a dodge that slips nothing costs stamina', () => {
  const b = fight();
  assert.ok(Boxing.dodge(b, 'left'));
  b.opponent.length = 10; // he waits on guard
  run(b, Boxing.DODGE_TIME - 0.02);
  assert.strictEqual(b.player.stamina, Boxing.STAMINA);
  run(b, 0.04);
  assert.ok(b.player.stamina < Boxing.STAMINA - Boxing.WHIFF_COST + 5);
  const c = fight();
  until(c, 'strike');
  Boxing.dodge(c, 'left');
  run(c, Boxing.DODGE_TIME + 0.05);
  assert.strictEqual(c.player.stamina, Boxing.STAMINA);
});

test('an exhausted boxer cannot dodge', () => {
  const b = fight();
  b.player.stamina = Boxing.DODGE_MIN - 1;
  assert.ok(!Boxing.dodge(b, 'left'));
});

test('standing still hurts', () => {
  const b = fight();
  until(b, 'strike');
  run(b, 0.2);
  assert.ok(b.player.health < Boxing.HEALTH);
});

test('the opponent can slip a punch, which tires whoever threw it', () => {
  const b = fight();
  const rolls = [0, 0.9]; // he defends, and does it by slipping
  b.rng = () => rolls.shift() ?? 0.9;
  b.opponent.length = 10;
  Boxing.punch(b, 'left', 'uppercut');
  run(b, 0.24);
  const spec = Boxing.PUNCH.uppercut;
  assert.strictEqual(b.opponent.health, Boxing.HEALTH);
  assert.deepStrictEqual(b.opponent.dodge.direction, 'right');
  assert.ok(b.player.stamina < Boxing.STAMINA - spec.cost - spec.miss + 8);
});

test('a tired opponent defends worse', () => {
  for (const [stamina, lands] of [[Boxing.STAMINA, false], [0, true]]) {
    const b = fight();
    b.rng = () => 0.4; // below his fresh defence, above his tired one
    b.opponent.length = 10;
    b.opponent.stamina = stamina;
    Boxing.punch(b, 'left');
    run(b, 0.12);
    assert.strictEqual(b.opponent.health < Boxing.HEALTH, lands);
  }
});

test('a winded opponent cannot start a punch', () => {
  const b = fight();
  b.opponent.stamina = 0;
  b.opponent.length = 0.1;
  run(b, 0.5);
  assert.strictEqual(b.opponent.state, 'guard');
  run(b, 3);
  assert.notStrictEqual(b.opponent.stamina, 0);
});

test('only a late uppercut stops a wind-up', () => {
  for (const late of [false, true]) {
    const b = fight();
    until(b, 'windup');
    if (late) b.opponent.t = b.opponent.length * 0.55;
    else b.opponent.length = 2;
    Boxing.punch(b, 'right', 'uppercut');
    run(b, 0.24);
    assert.strictEqual(b.opponent.state === 'guard', late);
    assert.strictEqual(b.opponent.health < Boxing.HEALTH, late);
  }
});

test('hammering the guard provokes an answer', () => {
  const b = fight({ difficulty: 'hard' });
  b.rng = () => 0; // every punch is blocked
  b.opponent.length = 30;
  for (let i = 0; i < 2; i++) {
    Boxing.punch(b, 'left');
    run(b, 0.3);
  }
  assert.strictEqual(b.opponent.state, 'windup');
});

test('one punch at a time, and stamina limits spamming', () => {
  const b = fight();
  assert.ok(Boxing.punch(b, 'left'));
  assert.ok(!Boxing.punch(b, 'right'));
  b.player.punch = null;
  b.player.stamina = 5;
  assert.ok(!Boxing.punch(b, 'right'));
  run(b, 1);
  assert.ok(Boxing.punch(b, 'right'));
});

test('knockout ends the bout', () => {
  const b = fight();
  b.opponent.health = 1;
  b.opponent.stamina = 0;
  b.opponent.length = 5;
  b.rng = () => 0.9; // too tired to defend
  Boxing.punch(b, 'left');
  run(b, 0.2);
  assert.deepStrictEqual(b.result, { winner: 'player', how: 'KO' });
  assert.strictEqual(b.opponent.state, 'down');
});

test('after the time limit the healthier boxer wins on points', () => {
  const b = fight();
  b.left = 0.05;
  b.opponent.health = 40;
  b.opponent.length = 10;
  b.player.health = 80;
  run(b, 0.1);
  assert.deepStrictEqual(b.result, { winner: 'player', how: 'POINTS' });
});

test('every bout ends', () => {
  const b = fight();
  run(b, Boxing.DURATION + 1);
  assert.strictEqual(b.phase, 'over');
});
