// Weightlifting (clean and jerk) rules: weight choice, pull, hold and standings. No DOM access.
//
// Phases of one attempt: choose -> pull -> lift -> hold -> landed.
//   pull: each tap raises one side of the bar; it must stay level on the way up.
//   lift: the clean and the jerk play on their own.
//   hold: each side has a marker that must be stopped inside the green zone with one tap.
// A missed pull or hold drops the bar and goes straight to landed.
(function (root) {
  'use strict';

  const node = typeof require === 'function';
  const Contest = node ? require('./contest.js') : root.Contest;
  const { best } = Contest;

  const SIDES = ['left', 'right'];
  const ATTEMPTS = 3;
  const MIN_WEIGHT = 120, MAX_WEIGHT = 220, STEP = 5, FIRST_WEIGHT = 140;

  const GAIN = [0.076, 0.062];   // height added by a tap, light to heavy
  const SINK = [0.1, 0.19];     // height lost per second
  const WEAK = [0.16, 0.34];     // share of a tap lost on the weaker side
  const WEAK_TIME = [1.1, 2];    // seconds before the weaker side may change
  const TILT_MAX = 0.3;          // height difference that loses the bar
  const PULL_TIME = 8;           // seconds to finish the pull once it starts

  const LIFT_TIME = 2.4;         // clean and jerk
  const CATCH_AT = 0.55, JERK_AT = 1.75;

  const HOLD_GUARD = 0.5;        // taps still coming from the pull are ignored
  const HOLD_TIME = 6;           // seconds to stop both markers
  const GREEN = 0.63;            // centre of the green zone, 0..1
  const ZONE = [0.14, 0.09];     // half height of the green zone
  const PERIOD = [2, 1.3];       // seconds per swing of a marker
  const SWING = 0.43;

  const DIFFICULTY = {
    easy: { sink: 0.8, zone: 1.15, rivals: 0.92 },
    normal: { sink: 1, zone: 1, rivals: 1 },
    hard: { sink: 1.12, zone: 0.85, rivals: 1.05 },
  };
  const BASE_MARKS = [150, 158, 165, 172, 180];
  const MAKE_CHANCE = [0.88, 0.72, 0.52];

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (range, t) => range[0] + (range[1] - range[0]) * t;
  const toStep = (kg) => clamp(Math.round(kg / STEP) * STEP, MIN_WEIGHT, MAX_WEIGHT);
  // 0 for a light bar, 1 for a very heavy one (a little more beyond that).
  const heaviness = (kg) => clamp((kg - 130) / 70, 0, 1.25);

  function createContest({
    difficulty = 'normal', rng = Math.random, playerName = 'YOU', country = 'ARG',
  } = {}) {
    const spec = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    const athletes = Contest.athletes({
      rng, country, playerName, bases: BASE_MARKS,
      plan(base) {
        // A missed weight is tried again; a good one is raised.
        let weight = toStep(base * spec.rivals - 7 + (rng() - 0.5) * 8);
        return MAKE_CHANCE.map((chance) => {
          if (rng() >= chance) return null;
          const made = weight;
          weight = toStep(weight + STEP + Math.round(rng()) * STEP);
          return made;
        });
      },
    });
    const contest = {
      difficulty, spec, rng, athletes, player: athletes[0], attempt: 0, events: [],
      weight: FIRST_WEIGHT, floor: MIN_WEIGHT,
    };
    startAttempt(contest);
    return contest;
  }

  function startAttempt(c) {
    c.phase = 'choose';
    c.time = 0;           // seconds in the current phase
    c.started = false;    // the pull clock starts with the first tap
    c.heights = { left: 0, right: 0 };
    c.weak = null;        // {side, time}
    c.markers = null;     // {left: {offset, stopped}, right}
    c.result = null;      // {mark, reason, side}
  }

  function setPhase(c, phase) {
    c.phase = phase;
    c.time = 0;
  }

  // The bar can never be lighter than the last one asked for.
  function changeWeight(c, steps) {
    if (c.phase !== 'choose') return false;
    const weight = clamp(c.weight + steps * STEP, c.floor, MAX_WEIGHT);
    if (weight === c.weight) return false;
    c.weight = weight;
    return true;
  }

  function lift(c) {
    if (c.phase !== 'choose') return false;
    setPhase(c, 'pull');
    return true;
  }

  const height = (c) => (c.heights.left + c.heights.right) / 2;
  // Positive when the right side is lower.
  const tilt = (c) => c.heights.left - c.heights.right;

  const period = (c) => lerp(PERIOD, heaviness(c.weight));
  const zone = (c) => lerp(ZONE, heaviness(c.weight)) * c.spec.zone;

  // Where the marker of a side is, 0 (bottom) to 1 (top).
  function marker(c, side) {
    const m = c.markers[side];
    if (m.stopped !== null) return m.stopped;
    return 0.5 + SWING * Math.sin(m.offset + (c.time * Math.PI * 2) / period(c));
  }

  function finish(c, mark, reason = null, side = null) {
    c.result = { mark, reason, side };
    Contest.record(c.athletes, c.attempt, mark);
    c.floor = clamp(c.weight + (mark === null ? 0 : STEP), MIN_WEIGHT, MAX_WEIGHT);
    c.events.push({ type: mark === null ? 'fail' : 'good', side });
    setPhase(c, 'landed');
  }

  // One tap of a key or thumb. Returns true when it did something.
  function tap(c, side) {
    if (c.phase === 'pull') {
      c.started = true;
      const weak = c.weak && c.weak.side === side ? lerp(WEAK, heaviness(c.weight)) : 0;
      c.heights[side] = Math.min(1.08, c.heights[side] + lerp(GAIN, heaviness(c.weight)) * (1 - weak));
      c.events.push({ type: 'tap', side });
      if (Math.abs(tilt(c)) > TILT_MAX) {
        finish(c, null, 'LOST BALANCE', tilt(c) > 0 ? 'right' : 'left');
      } else if (height(c) >= 1) {
        setPhase(c, 'lift');
      }
      return true;
    }
    if (c.phase !== 'hold' || c.time < HOLD_GUARD || c.markers[side].stopped !== null) return false;
    const at = marker(c, side);
    c.markers[side].stopped = at;
    if (Math.abs(at - GREEN) > zone(c)) finish(c, null, 'MISSED', side);
    else {
      c.events.push({ type: 'ok', side });
      if (SIDES.every((s) => c.markers[s].stopped !== null)) finish(c, c.weight);
    }
    return true;
  }

  function stepPull(c, dt) {
    if (!c.started) return;
    c.time += dt;
    if (!c.weak || (c.weak.time -= dt) <= 0) {
      c.weak = { side: SIDES[c.rng() < 0.5 ? 0 : 1], time: lerp(WEAK_TIME, c.rng()) };
    }
    const sink = lerp(SINK, heaviness(c.weight)) * c.spec.sink * dt;
    for (const side of SIDES) c.heights[side] = Math.max(0, c.heights[side] - sink);
    if (c.time >= PULL_TIME) finish(c, null, 'TOO HEAVY');
  }

  function step(c, dt) {
    if (c.phase === 'pull') return stepPull(c, dt);
    const before = c.time;
    c.time += dt;
    if (c.phase === 'lift') {
      if (before < CATCH_AT && c.time >= CATCH_AT) c.events.push({ type: 'catch' });
      if (before < JERK_AT && c.time >= JERK_AT) c.events.push({ type: 'jerk' });
      if (c.time >= LIFT_TIME) {
        // Both markers start at the bottom half, out of step with each other.
        const offset = () => Math.PI * (1.15 + c.rng() * 0.7);
        c.markers = {
          left: { offset: offset(), stopped: null },
          right: { offset: offset(), stopped: null },
        };
        setPhase(c, 'hold');
      }
    } else if (c.phase === 'hold' && c.time >= HOLD_TIME) {
      const late = SIDES.find((s) => c.markers[s].stopped === null);
      finish(c, null, 'TOO LATE', late);
    }
    return undefined;
  }

  const isOver = (c) => c.phase === 'landed' && c.attempt === ATTEMPTS - 1;

  function nextAttempt(c) {
    if (c.phase !== 'landed' || isOver(c)) return false;
    c.attempt++;
    c.weight = c.floor;
    startAttempt(c);
    return true;
  }

  const standings = (c) => Contest.byBest(c.athletes);
  // Best weight any rival has lifted so far, or null.
  const toBeat = (c) => {
    const marks = c.athletes.filter((a) => !a.isPlayer).map(best).filter((m) => m !== null);
    return marks.length ? Math.max(...marks) : null;
  };

  const api = {
    SIDES, ATTEMPTS, MIN_WEIGHT, MAX_WEIGHT, STEP, TILT_MAX, PULL_TIME, LIFT_TIME, CATCH_AT,
    JERK_AT, HOLD_GUARD, HOLD_TIME, GREEN, DIFFICULTY,
    createContest, changeWeight, lift, tap, step, height, tilt, heaviness, marker, zone, period,
    nextAttempt, isOver, best, standings, toBeat,
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Weightlifting = api;
})(this);
