// Shared rules of the newer events: registry, attempts, rivals and standings.
// No DOM access.
//
// Every event is a spec added with `define`:
//   id, name, kind      'time' | 'distance' | 'height' | 'score' | 'duel'
//   attempts            tries per match ('distance' and 'score')
//   create(env)         state of one attempt; env: {rng, level, bar}
//   step(s, dt, input)  advances it; sets s.done, s.mark (null: no mark) and s.note
//   act(s, action)      a press, release, tap, swipe or flick
//   rival(rng, level)   the mark of one rival attempt
//   bot(s, dt)          plays by itself: {input, actions}; used by the tests
// input: {tiltX, tiltY (degrees or null), charge (power bar 0..1), spin (radians),
//         twist (degrees), held (seconds a finger is still)}
(function (root) {
  'use strict';

  const node = typeof require === 'function';
  const Contest = node ? require('./contest.js') : root.Contest;
  const Starter = node ? require('./starter.js') : root.Starter;

  // Strength of the rivals and how forgiving the controls are.
  const DIFFICULTY = {
    easy: { name: 'easy', rivals: 0.9, ease: 1.35 },
    normal: { name: 'normal', rivals: 1, ease: 1 },
    hard: { name: 'hard', rivals: 1.07, ease: 0.75 },
  };

  const EVEN = { rivals: 1, ease: 1 }; // see career.js
  const specs = {};
  const define = (spec) => { specs[spec.id] = spec; return spec; };

  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const { round } = Contest;
  // Quality 0..1 of a value against an ideal: 1 on it, 0 `width` away or further.
  const near = (value, ideal, width) => clamp(1 - Math.abs(value - ideal) / width);

  // A match: the attempts of one event and the table.
  function createMatch(id, {
    difficulty = 'normal', rng = Math.random, playerName = 'YOU', country = 'ARG', starter = true,
    edge = EVEN,
  } = {}) {
    const spec = specs[id];
    const base = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    // The athlete's form shifts how strong the rivals are and how forgiving the controls.
    const level = { name: base.name, rivals: base.rivals * edge.rivals, ease: base.ease * edge.ease };
    const attempts = spec.kind === 'distance' || spec.kind === 'score' ? spec.attempts : 1;
    const athletes = Contest.athletes({
      rng, country, playerName, bases: [0, 1, 2, 3, 4],
      plan: () => Array.from({ length: attempts }, () => spec.rival && spec.rival(rng, level)),
    });
    if (spec.kind === 'duel') athletes.length = 2;
    const match = {
      spec, level, rng, athletes, player: athletes[0], attempts, attempt: 0,
      starter: spec.start && starter ? { rng } : null,
      // 'height': the bar goes up while the player clears it.
      bar: 0, misses: 0,
    };
    startAttempt(match);
    return match;
  }

  function startAttempt(m) {
    m.start = m.starter ? Starter.create(m.starter) : null;
    m.phase = m.start ? 'start' : 'play';
    m.call = null;
    m.time = 0; // seconds in the current phase
    m.state = m.spec.create({
      rng: m.rng, level: m.level, bar: m.spec.bars && m.spec.bars[m.bar],
      rivals: m.athletes.slice(1).map((a) => a.plan && a.plan[m.attempt]),
    });
  }

  const idle = { tiltX: null, tiltY: null, charge: 0, spin: 0, twist: 0, held: 0 };

  function step(m, dt, input = idle) {
    m.call = null;
    m.time += dt;
    if (m.phase === 'start') {
      m.call = Starter.step(m.start, dt);
      if (m.call === 'go') { m.phase = 'play'; m.time = 0; }
    } else if (m.phase === 'play') {
      m.spec.step(m.state, dt, input);
      if (m.state.done) finish(m);
    } else if (m.spec.after) m.spec.after(m.state, dt); // follow-through behind the mark
  }

  function act(m, action) {
    if (m.phase === 'play') {
      m.spec.act(m.state, action);
      if (m.state.done) finish(m);
    }
  }

  // Moving before the "go". Returns 'warning', 'out' or null.
  function jumpTheGun(m) {
    if (m.phase !== 'start') return null;
    const result = Starter.jumpTheGun(m.start);
    if (result === 'out') {
      Object.assign(m.state, { done: true, mark: null, note: 'FALSE START' });
      finish(m);
    }
    return result;
  }

  function finish(m) {
    const { mark } = m.state;
    const { spec, player } = m;
    if (spec.kind === 'height') {
      if (mark !== null) {
        player.marks.push(spec.bars[m.bar]);
        m.cleared = true;
        m.misses = 0;
      } else {
        m.cleared = false;
        m.misses++;
      }
      m.over = m.misses >= 3 || (m.cleared && m.bar === spec.bars.length - 1);
      if (m.over) for (const a of m.athletes.slice(1)) a.marks = [a.plan[0]];
    } else if (spec.kind === 'duel') {
      player.marks = [mark];
      m.athletes[1].marks = [m.state.theirs];
      m.over = true;
    } else {
      Contest.record(m.athletes, m.attempt, mark);
      m.over = m.attempt === m.attempts - 1;
    }
    m.phase = 'done';
    m.time = 0;
  }

  const isOver = (m) => m.phase === 'done' && m.over;

  function next(m) {
    if (m.phase !== 'done' || m.over) return false;
    if (m.spec.kind === 'height') {
      if (m.cleared) m.bar++;
    } else m.attempt++;
    startAttempt(m);
    return true;
  }

  // The single number an athlete is ranked by, or null.
  function result(m, a) {
    const marks = a.marks.filter((v) => v !== null && v !== undefined);
    if (!marks.length) return null;
    if (m.spec.kind === 'score') return round(marks.reduce((x, y) => x + y, 0));
    if (m.spec.kind === 'time') return Math.min(...marks);
    return Math.max(...marks);
  }

  // Best first; no mark goes last.
  function standings(m) {
    const sign = m.spec.kind === 'time' ? 1 : -1;
    const key = (a) => { const r = result(m, a); return r === null ? Infinity : sign * r; };
    return m.athletes.slice().sort((a, b) => (key(a) === key(b) ? 0 : key(a) - key(b)));
  }

  const won = (m) => {
    if (m.spec.kind === 'duel') return m.state.mark !== null && m.state.mark > m.state.theirs;
    return standings(m)[0] === m.player && result(m, m.player) !== null;
  };

  const format = (spec, value) => {
    if (value === null || value === undefined) return '--';
    if (spec.kind === 'duel') return String(value);
    if (spec.kind === 'score') return value.toFixed(1);
    return value.toFixed(2);
  };

  const api = {
    DIFFICULTY, specs, define, clamp, near, round, createMatch, step, act, jumpTheGun, isOver, next,
    result, standings, won, format,
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Events = api;
})(this);
