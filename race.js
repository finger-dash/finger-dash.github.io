// Race simulation: player, rivals, hurdles and standings. No DOM access.
(function (root) {
  'use strict';

  const node = typeof require === 'function';
  const Track = node ? require('./track.js') : root.Track;
  const Countries = node ? require('./countries.js') : root.Countries;

  const DISTANCE = Track.LENGTH;
  const MAX_SPEED = 15;          // m/s
  const JUMP_TIME = 0.62;        // seconds
  const JUMP_HEIGHT = 1.35;      // meters
  const CLEAR_HEIGHT = 0.5;      // minimum feet height to clear a hurdle
  const DNF_AFTER = 25;          // seconds the player gets once every rival is done
  const PLAYER_LANE = 2;
  // 400 m hurdles layout: first at 45 m, then every 35 m.
  const HURDLES = Array.from({ length: 10 }, (_, i) => 45 + i * 35);

  const DIFFICULTY = { easy: 0.96, normal: 1.06, hard: 1.13 };
  const RIVALS = ['VEGA', 'ROSSI', 'TANAKA', 'OKORO', 'SILVA'];
  const BASE_SPEEDS = [8.6, 9.5, 10.4, 11.3, 12.2];

  function createRunner(name, lane, isPlayer, country) {
    return {
      name, lane, isPlayer, country,
      s: 0, speed: 0, jumpT: -1, stumble: 0, cycle: 0,
      next: 0, knocked: new Set(), finishTime: null,
    };
  }

  function shuffle(list, rng) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function createRace({
    difficulty = 'normal', rng = Math.random, playerName = 'YOU', country = 'ARG',
    edge = { rivals: 1 },
  } = {}) {
    const speeds = shuffle(BASE_SPEEDS.slice(), rng); // who is fast today
    // Rivals never wear the player's colors.
    const others = shuffle(Countries.COUNTRIES.map((c) => c.id).filter((id) => id !== country), rng);
    let k = 0;
    const runners = [];
    for (let lane = 0; lane < Track.LANES; lane++) {
      if (lane === PLAYER_LANE) {
        runners.push(createRunner(playerName || 'YOU', lane, true, country));
        continue;
      }
      const r = createRunner(RIVALS[k], lane, false, others[k]);
      r.pace = (speeds[k] + (rng() - 0.5) * 0.4) * DIFFICULTY[difficulty] * edge.rivals;
      r.reaction = 0.15 + rng() * 0.35;
      r.wave = 0.3 + rng() * 0.5;
      r.phase = rng() * 6.28;
      r.misses = HURDLES.map(() => rng() < 0.07); // hurdles this rival will hit
      runners.push(r);
      k++;
    }
    return {
      runners, player: runners[PLAYER_LANE], difficulty,
      time: 0, winner: null, allRivalsAt: null, over: false,
    };
  }

  const jumpHeight = (r) =>
    (r.jumpT < 0 ? 0 : Math.sin(Math.PI * r.jumpT / JUMP_TIME) * JUMP_HEIGHT);

  function jump(r) {
    if (r.jumpT >= 0 || r.stumble > 0 || r.finishTime !== null) return false;
    r.jumpT = 0;
    return true;
  }

  function accelerate(r, target, rate, dt) {
    r.speed += (target - r.speed) * Math.min(1, rate * dt);
  }

  function stepRunner(race, r, dt, playerTarget) {
    if (r.jumpT >= 0) {
      r.jumpT += dt; // speed is kept while airborne
      if (r.jumpT >= JUMP_TIME) r.jumpT = -1;
    } else if (r.finishTime !== null) {
      r.speed = Math.max(0, r.speed - 3.5 * dt);
    } else if (r.isPlayer) {
      accelerate(r, playerTarget, playerTarget > r.speed ? 3.2 : 2, dt);
    } else if (race.time > r.reaction) {
      accelerate(r, r.pace * (1 + 0.05 * Math.sin(race.time * r.wave + r.phase)), 1.6, dt);
    }

    if (!r.isPlayer && r.next < HURDLES.length && !r.misses[r.next]) {
      const ahead = HURDLES[r.next] - r.s;
      if (ahead > 0 && ahead <= r.speed * JUMP_TIME * 0.5) jump(r);
    }
    if (r.stumble > 0) {
      r.stumble -= dt;
      r.speed = Math.min(r.speed, 2.5);
    }

    const before = r.s;
    r.s += r.speed * dt;
    r.cycle += r.speed * dt * 0.34;

    if (r.next < HURDLES.length && r.s >= HURDLES[r.next]) {
      if (jumpHeight(r) < CLEAR_HEIGHT) {
        r.knocked.add(r.next);
        r.stumble = 0.8;
        r.speed *= 0.3;
        r.jumpT = -1;
      }
      r.next++;
    }

    if (r.finishTime === null && r.s >= DISTANCE) {
      // Interpolate within the step for a fair photo finish.
      r.finishTime = race.time - dt * (r.s - DISTANCE) / (r.s - before);
    }
  }

  function step(race, dt, playerTarget) {
    race.time += dt;
    for (const r of race.runners) stepRunner(race, r, dt, playerTarget);

    if (!race.winner) {
      const done = race.runners.filter((r) => r.finishTime !== null);
      if (done.length) race.winner = done.sort((a, b) => a.finishTime - b.finishTime)[0];
    }
    if (race.allRivalsAt === null &&
        race.runners.every((r) => r.isPlayer || r.finishTime !== null)) {
      race.allRivalsAt = race.time;
    }
    // The race is decided for the player once they finish or run out of time.
    race.over = race.player.finishTime !== null ||
      (race.allRivalsAt !== null && race.time - race.allRivalsAt > DNF_AFTER);
  }

  // Finished runners by time, then the rest by distance covered.
  function standings(race) {
    return race.runners.slice().sort((a, b) => {
      if (a.finishTime !== null && b.finishTime !== null) return a.finishTime - b.finishTime;
      if (a.finishTime !== null) return -1;
      if (b.finishTime !== null) return 1;
      return b.s - a.s;
    });
  }

  const api = {
    DISTANCE, MAX_SPEED, JUMP_TIME, HURDLES, DIFFICULTY,
    createRace, step, jump, jumpHeight, standings,
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Race = api;
})(this);
