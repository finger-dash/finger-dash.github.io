// Archery rules: draw, aim, wind, sway, scoring and standings. No DOM access.
// Positions on the target are in meters from its center, x to the right and y up.
//
// Phases of one arrow: aim -> flight -> landed.
(function (root) {
  'use strict';

  const node = typeof require === 'function';
  const Contest = node ? require('./contest.js') : root.Contest;

  const ARROWS = 6;
  const DISTANCE = 70;      // m
  const RADIUS = 0.61;      // m, 122 cm face
  const RING = RADIUS / 10;
  const MIN_DRAW = 0.3;     // weaker pulls are cancelled
  const DROP = 1.3;         // m lost at zero draw; nothing at full draw
  const PUSH = 0.065;       // m per second the sight drifts for each m/s of wind
  const BUFFET = 0.004;     // m of shudder on the sight for each m/s of wind
  const CALMEST = 0.5;      // share of the level's wind that always blows
  const STEADY = 2.5;       // seconds before the arm starts to tire
  const REACH = 1.2;        // m the aim can move from the center
  const FLIGHT_TIME = 2.2;  // seconds on screen

  const DIFFICULTY = {
    easy: { wind: 3, sway: 0.025, rivals: -0.8 },
    normal: { wind: 4.5, sway: 0.045, rivals: 0 },
    hard: { wind: 6, sway: 0.07, rivals: 0.5 },
  };
  const BASE_SCORES = [6.4, 7.1, 7.7, 8.3, 8.9]; // average per arrow

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  // 10 in the middle down to 1 on the outer ring, 0 off the face.
  function score(x, y) {
    const r = Math.hypot(x, y);
    return r > RADIUS ? 0 : Math.max(1, 10 - Math.floor(r / RING));
  }

  function createContest({
    difficulty = 'normal', rng = Math.random, playerName = 'YOU', country = 'ARG',
  } = {}) {
    const level = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    const athletes = Contest.athletes({
      rng, country, playerName, bases: BASE_SCORES,
      plan: (base) => Array.from({ length: ARROWS }, () =>
        clamp(Math.round(base + level.rivals + (rng() - 0.5) * 3.4), 0, 10)),
    });
    const contest = { difficulty, level, rng, athletes, player: athletes[0], attempt: 0, hits: [] };
    startArrow(contest);
    return contest;
  }

  function startArrow(c) {
    const { rng, level } = c;
    c.phase = 'aim';
    c.time = 0;
    c.draw = 0;
    c.held = 0; // seconds with the bow drawn
    const side = rng() < 0.5 ? -1 : 1; // positive blows right
    const base = side * Math.round((CALMEST + rng() * (1 - CALMEST)) * level.wind * 10) / 10;
    c.wind = { base, speed: base, phase: rng() * 6 }; // speed follows the gusts
    // The bow never starts on target.
    c.aim = { x: (rng() < 0.5 ? -1 : 1) * (0.25 + rng() * 0.35), y: 0.2 + rng() * 0.5 };
    c.impact = null;
    c.result = null;
  }

  // Draws the bow. The string stays at the furthest point reached.
  function pull(c, draw) {
    if (c.phase === 'aim') c.draw = clamp(Math.max(c.draw, draw), 0, 1);
  }

  // Draws or relaxes the string to exactly this point, like pulling back a cue.
  function drawTo(c, draw) {
    if (c.phase !== 'aim') return;
    c.draw = clamp(draw, 0, 1);
    if (c.draw === 0) c.held = 0;
  }

  function moveAim(c, dx, dy) {
    if (c.phase !== 'aim') return;
    c.aim.x = clamp(c.aim.x + dx, -REACH, REACH);
    c.aim.y = clamp(c.aim.y + dy, -REACH, REACH);
  }

  // Hand shake around the aim; it grows when the bow is held too long.
  function sway(c) {
    if (c.draw === 0) return { x: 0, y: 0 };
    const amount = c.level.sway * (1 + Math.max(0, c.held - STEADY) * 0.7);
    const t = c.held;
    return {
      x: amount * (Math.sin(t * 2.3) + 0.5 * Math.sin(t * 3.7 + 1)) / 1.5,
      y: amount * (Math.cos(t * 1.9) + 0.5 * Math.sin(t * 4.3)) / 1.5,
    };
  }

  // Where the sight points right now.
  function sight(c) {
    const s = sway(c);
    const shudder = c.phase === 'aim' ? c.wind.speed * BUFFET : 0;
    return {
      x: c.aim.x + s.x + shudder * Math.sin(c.time * 17),
      y: c.aim.y + s.y + shudder * 0.7 * Math.sin(c.time * 23 + 1),
    };
  }

  // Releases the string. Returns false (and relaxes) if it was barely drawn.
  function loose(c) {
    if (c.phase !== 'aim') return false;
    if (c.draw < MIN_DRAW) {
      c.draw = 0;
      c.held = 0;
      return false;
    }
    const at = sight(c);
    c.impact = { x: at.x, y: at.y - (1 - c.draw) * DROP };
    c.phase = 'flight';
    c.time = 0;
    return true;
  }

  // Wind speed after `t` seconds: between half and one and a half times the base.
  const gust = ({ base, phase }, t) =>
    base * (1 + 0.35 * Math.sin(t * 1.6 + phase) + 0.15 * Math.sin(t * 4.1));

  function step(c, dt) {
    c.time += dt;
    if (c.phase === 'aim') {
      c.wind.speed = gust(c.wind, c.time);
      moveAim(c, c.wind.speed * PUSH * dt, 0); // the wind drags the sight along
    }
    if (c.phase === 'aim' && c.draw > 0) c.held += dt;
    if (c.phase === 'flight' && c.time >= FLIGHT_TIME) {
      const points = score(c.impact.x, c.impact.y);
      c.hits.push(c.impact);
      c.result = { points };
      Contest.record(c.athletes, c.attempt, points);
      c.phase = 'landed';
      c.time = 0;
    }
  }

  const isOver = (c) => c.phase === 'landed' && c.attempt === ARROWS - 1;

  function nextArrow(c) {
    if (c.phase !== 'landed' || isOver(c)) return false;
    c.attempt++;
    startArrow(c);
    return true;
  }

  const standings = (c) => Contest.byTotal(c.athletes);

  const api = {
    ARROWS, DISTANCE, RADIUS, RING, MIN_DRAW, FLIGHT_TIME, PUSH, BUFFET, REACH, DIFFICULTY,
    score, createContest, pull, drawTo, moveAim, sway, sight, loose, step, nextArrow, isOver, standings,
    total: Contest.total,
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Archery = api;
})(this);
