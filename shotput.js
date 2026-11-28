// Shot put rules: spin, throw, flight, landing and standings. No DOM access.
//
// Phases of one attempt: spin -> flight -> landed.
(function (root) {
  'use strict';

  const node = typeof require === 'function';
  const Contest = node ? require('./contest.js') : root.Contest;
  const { round, best } = Contest;

  const ATTEMPTS = 3;
  const TIME_LIMIT = 8;     // seconds to throw once the spin starts
  // Degrees to each side of straight ahead where a shot counts.
  const SECTOR = { easy: 60, normal: 45, hard: 35 };
  const MIN_DISTANCE = 8;
  const RANGE = 14;         // m added by a full power bar
  const FLIGHT_TIME = 1.7;  // seconds on screen
  const DIFFICULTY = { easy: 0.9, normal: 1, hard: 1.06 };
  const BASE_MARKS = [15.2, 16.4, 17.5, 18.5, 19.6];

  function createContest({
    difficulty = 'normal', rng = Math.random, playerName = 'YOU', country = 'ARG',
  } = {}) {
    const factor = DIFFICULTY[difficulty] || 1;
    const athletes = Contest.athletes({
      rng, country, playerName, bases: BASE_MARKS,
      plan: (base) => Array.from({ length: ATTEMPTS }, () =>
        (rng() < 0.1 ? null : round((base + (rng() - 0.5) * 1.4) * factor))),
    });
    const contest = { difficulty, athletes, player: athletes[0], attempt: 0 };
    startAttempt(contest);
    return contest;
  }

  function startAttempt(c) {
    c.phase = 'spin';
    c.time = 0;       // seconds in the current phase
    c.started = false;
    c.shot = null;    // {distance, side, forward, foul}
    c.result = null;
  }

  function setPhase(c, phase) {
    c.phase = phase;
    c.time = 0;
  }

  function finish(c, mark, reason) {
    c.result = { mark, reason };
    Contest.record(c.athletes, c.attempt, mark);
    setPhase(c, 'landed');
  }

  // The clock starts with the first movement.
  function begin(c) {
    if (c.phase === 'spin' && !c.started) {
      c.started = true;
      c.time = 0;
    }
  }

  const sector = (c) => SECTOR[c.difficulty] || SECTOR.normal;

  // power: 0..1. facing: degrees the athlete is turned away from the field at the
  // release, positive to the right. The shot leaves exactly that way.
  function throwShot(c, power, facing = 0) {
    if (c.phase !== 'spin') return false;
    const off = facing - 360 * Math.round(facing / 360); // -180..180
    const reach = MIN_DISTANCE + RANGE * Math.max(0, Math.min(1, power)) ** 0.85;
    const crooked = Math.min(60, Math.abs(off));
    const distance = reach * Math.cos((crooked * Math.PI) / 450); // slightly less when crooked
    const rad = (off * Math.PI) / 180;
    c.shot = {
      distance, side: Math.sin(rad) * distance, forward: Math.cos(rad) * distance,
      foul: Math.abs(off) > sector(c), wrongWay: Math.abs(off) > 90,
    };
    setPhase(c, 'flight');
    return true;
  }

  function step(c, dt) {
    if (c.phase !== 'spin' || c.started) c.time += dt;
    if (c.phase === 'spin' && c.started && c.time >= TIME_LIMIT) finish(c, null, 'TIME OUT');
    else if (c.phase === 'flight' && c.time >= FLIGHT_TIME) {
      if (c.shot.foul) finish(c, null, c.shot.wrongWay ? 'WRONG WAY' : 'FOUL');
      else finish(c, round(c.shot.distance), null);
    }
  }

  const isOver = (c) => c.phase === 'landed' && c.attempt === ATTEMPTS - 1;

  function nextAttempt(c) {
    if (c.phase !== 'landed' || isOver(c)) return false;
    c.attempt++;
    startAttempt(c);
    return true;
  }

  const standings = (c) => Contest.byBest(c.athletes);

  const api = {
    ATTEMPTS, TIME_LIMIT, SECTOR, FLIGHT_TIME, DIFFICULTY,
    createContest, sector, begin, throwShot, step, nextAttempt, isOver, best, standings,
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.ShotPut = api;
})(this);
