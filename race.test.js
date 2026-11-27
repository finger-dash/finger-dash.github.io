// Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const Track = require('./track.js');
const Race = require('./race.js');

function seeded(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

// Runs a race; the player holds `speed` and optionally jumps every hurdle.
function run({ speed, jumps = true, difficulty = 'normal', seed = 7 }) {
  const race = Race.createRace({ difficulty, rng: seeded(seed) });
  const p = race.player;
  for (let i = 0; i < 60 * 300 && !race.over; i++) {
    const ahead = Race.HURDLES[p.next] - p.s;
    if (jumps && ahead <= p.speed * Race.JUMP_TIME * 0.5) Race.jump(p);
    Race.step(race, 1 / 60, speed);
  }
  return race;
}

test('track coordinates round trip all around the oval', () => {
  const out = {};
  for (let s = 0.5; s < Track.LENGTH; s += 3.7) {
    for (const n of [-9, -3, 0, 3, 9]) {
      const p = Track.pointAt(s, n);
      Track.locate(p.x, p.y, out);
      assert.ok(Math.abs(out.s - s) < 1e-6 && Math.abs(out.n - n) < 1e-6, `s=${s} n=${n}`);
    }
  }
});

test('track is closed and continuous', () => {
  for (let s = 0; s < Track.LENGTH; s += 0.5) {
    const a = Track.pointAt(s, 0), b = Track.pointAt(s + 0.5, 0);
    assert.ok(Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - 0.5) < 0.01, `s=${s}`);
  }
});

test('a fast clean player wins', () => {
  const race = run({ speed: 15 });
  assert.strictEqual(race.winner, race.player);
  assert.strictEqual(Race.standings(race)[0], race.player);
  assert.strictEqual(race.player.knocked.size, 0);
});

test('a slow player loses and standings are ordered', () => {
  const race = run({ speed: 7 });
  assert.notStrictEqual(race.winner, race.player);
  const order = Race.standings(race);
  assert.strictEqual(order[5], race.player);
  const times = order.map((r) => r.finishTime);
  assert.deepStrictEqual(times, times.slice().sort((a, b) => a - b));
});

test('not jumping knocks every hurdle down', () => {
  assert.strictEqual(run({ speed: 12, jumps: false }).player.knocked.size, 10);
});

test('an idle player ends as DNF', () => {
  const race = run({ speed: 0 });
  assert.ok(race.over);
  assert.strictEqual(race.player.finishTime, null);
});

test('harder levels have faster winners', () => {
  const win = (difficulty) => run({ speed: 0, difficulty }).winner.finishTime;
  assert.ok(win('hard') < win('normal') && win('normal') < win('easy'));
});


test('the player keeps name and country, rivals wear other colors', () => {
  const race = Race.createRace({ playerName: 'BRIAN', country: 'JPN', rng: seeded(3) });
  assert.strictEqual(race.player.name, 'BRIAN');
  assert.strictEqual(race.player.country, 'JPN');
  const ids = race.runners.map((r) => r.country);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('names are limited to what the font can draw', () => {
  const { cleanName, GLYPHS } = require('./font.js');
  assert.strictEqual(cleanName(' josé_perez!!'), 'JOSEPERE');
  for (const ch of cleanName('ABCXYZ09')) assert.ok(GLYPHS[ch]);
});
