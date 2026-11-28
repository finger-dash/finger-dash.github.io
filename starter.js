// The start of a race: "on your marks", "set" and "go", and the false starts of whoever
// runs before the "go". No DOM access.
//
// Phases: marks -> set -> go. A false start leads to 'false' and back to marks, or to
// 'out' the second time.
(function (root) {
  'use strict';

  const GUARD = 0.4;        // seconds after "on your marks" in which a swipe is forgiven
  const SET_AT = 2.4;       // seconds from "on your marks" to "set"
  const WAIT_MIN = 1;       // seconds from "set" to "go": at random, so it cannot
  const WAIT_MAX = 2;       // be anticipated
  const FALSE_TIME = 2;     // seconds the false start stays on screen
  const ALLOWED = 1;        // false starts forgiven

  function arm(s) {
    s.phase = 'marks';
    s.time = 0;             // seconds in the current phase
    s.wait = WAIT_MIN + s.rng() * (WAIT_MAX - WAIT_MIN);
    s.cue = 'marks';        // call still to be announced
  }

  function create({ rng = Math.random } = {}) {
    const s = { rng, faults: 0 };
    arm(s);
    return s;
  }

  function enter(s, phase) {
    s.phase = phase;
    s.time = 0;
    s.cue = phase;
  }

  // Advances the start. Returns the call to announce now ('marks', 'set' or 'go'), or null.
  function step(s, dt) {
    s.time += dt;
    if (s.phase === 'marks' && s.time >= SET_AT) enter(s, 'set');
    else if (s.phase === 'set' && s.time >= s.wait) enter(s, 'go');
    else if (s.phase === 'false' && s.time >= FALSE_TIME) arm(s);
    const cue = s.cue;
    s.cue = null;
    return cue;
  }

  // The athlete moved. Returns 'warning' or 'out' if that was a false start, otherwise null.
  function jumpTheGun(s) {
    const waiting = s.phase === 'set' || (s.phase === 'marks' && s.time >= GUARD);
    if (!waiting) return null;
    s.faults++;
    const out = s.faults > ALLOWED;
    s.phase = out ? 'out' : 'false';
    s.time = 0;
    s.cue = null;
    return out ? 'out' : 'warning';
  }

  // What to write on screen: { text, color, size, note }, or null. `penalty` says what the
  // next false start costs.
  function banner(s, penalty) {
    if (s.phase === 'marks') return { text: 'ON YOUR MARKS', color: '#fff', size: 3 };
    if (s.phase === 'set') return { text: 'SET', color: '#fff', size: 5 };
    if (s.phase === 'false') {
      return { text: 'FALSE START', color: '#e8505b', size: 3, note: `NEXT ONE ${penalty}` };
    }
    return null;
  }

  const api = { GUARD, SET_AT, WAIT_MIN, WAIT_MAX, FALSE_TIME, create, step, jumpTheGun, banner };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Starter = api;
})(this);
