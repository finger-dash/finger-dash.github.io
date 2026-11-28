'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Events = require('./events.js');
require('./rules-race.js');
require('./rules-field.js');
require('./rules-skill.js');

const ids = Object.keys(Events.specs);
const DT = 1 / 60;
const IDLE = { tiltX: null, tiltY: null, charge: 0, spin: 0, twist: 0, held: 0 };

// A repeatable random source.
const seeded = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

// Plays a whole match; with `idle` nobody touches anything.
function play(id, { idle = false, seed = 1, difficulty = 'normal' } = {}) {
  const m = Events.createMatch(id, { rng: seeded(seed), difficulty });
  for (let n = 0; n < 60 * 60 * 20; n++) {
    let input = IDLE;
    if (m.phase === 'play' && !idle) {
      const move = m.spec.bot(m.state, DT);
      input = { ...IDLE, ...move.input };
      for (const a of move.actions) Events.act(m, a);
    }
    Events.step(m, DT, input);
    if (Events.isOver(m)) return m;
    if (m.phase === 'done') Events.next(m);
  }
  throw new Error(`${id} never ends`);
}

test('there are eighteen new events', () => assert.strictEqual(ids.length, 18));

for (const id of ids) {
  test(`${id}: a player can finish it and get a mark`, () => {
    const m = play(id);
    const mark = Events.result(m, m.player);
    assert.ok(Number.isFinite(mark), `no mark: ${m.state.note}`);
    assert.strictEqual(Events.standings(m).length, m.spec.kind === 'duel' ? 2 : 6);
  });

  test(`${id}: playing well can win`, () => {
    const wins = [1, 2, 3, 4, 5, 6, 7, 8].filter((seed) =>
      Events.won(play(id, { seed, difficulty: 'easy' }))).length;
    assert.ok(wins >= 2, `won ${wins} of 8`);
  });

  test(`${id}: it ends even if nobody plays, and that does not win`, () => {
    const m = play(id, { idle: true });
    assert.ok(!Events.won(m));
  });
}

test('races allow one false start', () => {
  const m = Events.createMatch('sprint100', { rng: seeded(3) });
  for (let t = 0; t < 1; t += DT) Events.step(m, DT);
  assert.strictEqual(Events.jumpTheGun(m), 'warning');
  for (let t = 0; t < 3; t += DT) Events.step(m, DT);
  assert.strictEqual(Events.jumpTheGun(m), 'out');
  assert.ok(Events.isOver(m));
  assert.strictEqual(m.state.note, 'FALSE START');
});

test('three misses in a row end a high jump', () => {
  const m = play('highJump', { idle: true });
  assert.strictEqual(m.misses, 3);
});
