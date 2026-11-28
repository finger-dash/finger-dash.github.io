// Long jump simulation: run-up, take-off, angle, flight, landing and standings.
// No DOM access.
//
// Phases of one attempt: run -> angle -> flight -> landed.
(function (root) {
  'use strict';

  const node = typeof require === 'function';
  const Contest = node ? require('./contest.js') : root.Contest;
  const { round } = Contest;

  const BOARD = 40;             // m from the start of the run-up to the foul line
  const ATTEMPTS = 3;
  const TAKEOFF_ZONE = 8;       // take-offs further than this from the board are ignored
  const RUN_THROUGH = 0.8;      // m past the board without jumping
  const BEST_ANGLE = 22;        // degrees
  const GOOD_ANGLE = 4;         // half width of the sweet spot
  const MAX_ANGLE = 55;
  const TAP_DELAY = 0.3;        // seconds the meter waits for the finger that has to tap
  const FLIGHT_TIME = 1.4;      // seconds on screen
  const STRETCH_AT = 0.75;      // ideal moment of the flight to stretch the legs
  const STRETCH_WINDOW = 0.25;
  const STRETCH_FROM = 0.3;     // earlier swipes are the finger leaving the angle click
  const STRETCH_BONUS = 0.5;    // m
  const REACH = 0.58;           // m of flight per m/s of take-off speed
  const MIN_MARK = 1;
  const LANE = 2;

  // sweep: angle meter speed in degrees per second. rivals: strength factor.
  const DIFFICULTY = {
    easy: { sweep: 34, rivals: 0.9 },
    normal: { sweep: 44, rivals: 1 },
    hard: { sweep: 58, rivals: 1.07 },
  };
  const BASE_MARKS = [5.9, 6.4, 6.9, 7.4, 7.9];

  function createContest({
    difficulty = 'normal', rng = Math.random, playerName = 'YOU', country = 'ARG', tapAngle = false,
  } = {}) {
    const level = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    const athletes = Contest.athletes({
      rng, country, playerName, bases: BASE_MARKS,
      plan: (base) => Array.from({ length: ATTEMPTS }, () =>
        (rng() < 0.12 ? null : round((base + (rng() - 0.5) * 0.7) * level.rivals))),
    });
    const angleDelay = tapAngle ? TAP_DELAY : 0;
    const contest = { difficulty, level, angleDelay, athletes, player: athletes[0], attempt: 0 };
    startAttempt(contest);
    return contest;
  }

  function startAttempt(c) {
    c.phase = 'run';
    c.time = 0; // seconds in the current phase
    c.angle = 0;
    c.result = null;
    c.takeoff = null;
    c.stretch = null;
    // Shaped like a race runner, so the renderer can draw it.
    c.jumper = {
      name: c.player.name, country: c.player.country, isPlayer: true, lane: LANE,
      s: 0, speed: 0, cycle: 0, jumpT: -1, stumble: 0, height: 0,
    };
  }

  function setPhase(c, phase) {
    c.phase = phase;
    c.time = 0;
  }

  function finishAttempt(c, mark, reason) {
    c.result = {
      mark, reason,
      angle: c.takeoff ? Math.round(c.angle) : null,
      gap: c.takeoff ? round(BOARD - c.takeoff.s) : null, // negative: over the line
      bonus: c.stretch ? round(c.stretch.bonus) : 0,
    };
    Contest.record(c.athletes, c.attempt, mark);
    setPhase(c, 'landed');
  }

  // Take-off: allowed only close to the board.
  function takeOff(c) {
    const j = c.jumper;
    if (c.phase !== 'run' || j.s < BOARD - TAKEOFF_ZONE) return false;
    c.takeoff = { s: j.s, speed: j.speed };
    j.jumpT = 0;
    j.height = 0.25;
    setPhase(c, 'angle');
    return true;
  }

  const angleFactor = (angle) => Math.max(0.35, 1 - ((angle - BEST_ANGLE) / 38) ** 2);

  // Locks the angle shown by the meter and starts the flight.
  function release(c) {
    if (c.phase !== 'angle') return false;
    c.takeoff.reach = c.takeoff.speed * REACH * angleFactor(c.angle);
    setPhase(c, 'flight');
    return true;
  }

  // Throwing the legs forward adds distance when well timed. One chance per jump.
  function stretch(c) {
    if (c.phase !== 'flight' || c.stretch) return false;
    const at = c.time / FLIGHT_TIME;
    if (at < STRETCH_FROM) return false; // ignored: the chance is still there
    const quality = Math.max(0, 1 - Math.abs(at - STRETCH_AT) / STRETCH_WINDOW);
    c.stretch = { at, bonus: STRETCH_BONUS * quality };
    return true;
  }

  // targetSpeed: what the power bar asks for during the run-up.
  function step(c, dt, targetSpeed) {
    const j = c.jumper;
    c.time += dt;

    if (c.phase === 'run') {
      const rate = targetSpeed > j.speed ? 3.2 : 2;
      j.speed += (targetSpeed - j.speed) * Math.min(1, rate * dt);
      j.s += j.speed * dt;
      j.cycle += j.speed * dt * 0.34;
      if (j.s > BOARD + RUN_THROUGH) finishAttempt(c, null, 'FOUL');
    } else if (c.phase === 'angle') {
      // The world holds still while the player picks the angle.
      const moving = Math.max(0, Math.min(dt, c.time - c.angleDelay));
      c.angle = Math.min(MAX_ANGLE, c.angle + c.level.sweep * moving);
      if (c.angle >= MAX_ANGLE) release(c);
    } else if (c.phase === 'flight') {
      const p = Math.min(1, c.time / FLIGHT_TIME);
      const { s, reach } = c.takeoff;
      const extra = c.stretch
        ? c.stretch.bonus * Math.min(1, Math.max(0, (p - c.stretch.at) / (1 - c.stretch.at || 1)))
        : 0;
      j.s = s + reach * p + extra;
      j.height = Math.sin(Math.PI * p) * (0.45 + c.angle / 40);
      if (p >= 1) {
        j.speed = 0;
        j.height = 0;
        j.jumpT = -1;
        const total = reach + (c.stretch ? c.stretch.bonus : 0);
        const mark = round(total - (BOARD - s));
        if (s > BOARD) finishAttempt(c, null, 'FOUL');
        else if (mark < MIN_MARK) finishAttempt(c, null, 'NO MARK');
        else finishAttempt(c, mark, null);
      }
    } else if (j.speed > 0) { // running through after a foul
      j.speed = Math.max(0, j.speed - 8 * dt);
      j.s += j.speed * dt;
      j.cycle += j.speed * dt * 0.34;
    }
  }

  const isOver = (c) => c.phase === 'landed' && c.attempt === ATTEMPTS - 1;

  function nextAttempt(c) {
    if (c.phase !== 'landed' || isOver(c)) return false;
    c.attempt++;
    startAttempt(c);
    return true;
  }

  const { best } = Contest;
  const standings = (c) => Contest.byBest(c.athletes);

  const api = {
    BOARD, ATTEMPTS, TAKEOFF_ZONE, BEST_ANGLE, GOOD_ANGLE, MAX_ANGLE, TAP_DELAY, FLIGHT_TIME, STRETCH_AT, STRETCH_FROM, DIFFICULTY,
    createContest, step, takeOff, release, stretch, nextAttempt, isOver, best, standings,
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.LongJump = api;
})(this);
