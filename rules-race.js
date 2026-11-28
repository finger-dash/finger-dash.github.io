// The new races: 100 m, freestyle, rowing, track cycling, speed climbing and canoe
// slalom. No DOM access.
(function (root) {
  'use strict';

  const node = typeof require === 'function';
  const E = node ? require('./events.js') : root.Events;
  const { define, clamp, near, round } = E;

  // What every race keeps: distance, speed, clock and the rivals' times.
  const racer = (env, extra) => ({
    s: 0, speed: 0, time: 0, cycle: 0, done: false, mark: null, note: null, buzz: 0, flash: null,
    rivals: env.rivals, ease: env.level.ease, rng: env.rng, ...extra,
  });

  // Distance covered at `time` by a rival who finishes in `total`: slower at the start.
  const along = (distance, total, time) =>
    Math.min(distance, distance * ((time + 0.12 * total * (Math.exp((-6 * time) / total) - 1)) /
      (total + 0.12 * total * (Math.exp(-6) - 1))));

  const say = (s, text, good = true) => { s.flash = { text, good, left: 0.9 }; };

  // Moves a racer and closes the race at the line.
  function advance(s, dt, distance) {
    s.time += dt;
    const before = s.s;
    s.s += s.speed * dt;
    s.cycle += s.speed * dt * 0.34;
    if (s.flash && (s.flash.left -= dt) <= 0) s.flash = null;
    if (s.s >= distance) {
      const part = (distance - before) / (s.s - before || 1);
      s.s = distance;
      s.done = true;
      s.mark = round(s.time - dt * (1 - part) - (s.bonus || 0) + (s.penalty || 0));
    } else if (s.time > 180) Object.assign(s, { done: true, mark: null, note: 'TIME OUT' });
  }

  const times = (base, spread) => (rng, level) => round((base + (rng() - 0.5) * spread) / level.rivals);

  // ---------- 100 m ----------

  define({
    id: 'sprint100', name: '100M DASH', kind: 'time', start: true, distance: 100,
    run: true, // the power bar sets the speed
    rival: times(11.1, 1),
    create: (env) => racer(env, { bonus: 0, dipped: false }),
    step(s, dt, input) {
      const target = input.charge * 12.3;
      s.speed += (target - s.speed) * Math.min(1, (target > s.speed ? 3 : 1.6) * dt);
      advance(s, dt, 100);
    },
    act(s, a) {
      if (a.type !== 'flick' || s.dipped || s.s < 88) return;
      s.dipped = true; // one dip at the line
      s.bonus = 0.14 * near(s.s, 97.5, 6);
      say(s, s.bonus > 0.07 ? 'GREAT DIP!' : 'EARLY DIP', s.bonus > 0.07);
    },
    bot: (s) => ({ input: { charge: 0.82 }, actions: s.s > 97 && !s.dipped ? [{ type: 'flick' }] : [] }),
  });

  // ---------- 100 m freestyle ----------

  const POOL = 50;
  define({
    id: 'swimming', name: '100M FREESTYLE', kind: 'time', start: true, distance: 100,
    rival: times(25.8, 2.4),
    create: (env) => racer(env, {
      air: 1, last: null, circles: { left: 0, right: 0 }, turned: false, breathing: 0, arms: 0,
    }),
    // One arm stroke: alternating arms pulls twice as much as repeating one.
    stroke(s, side) {
      const alternate = s.last !== side;
      s.speed = Math.min(4.6, s.speed + (alternate ? 0.62 : 0.28));
      s.last = side;
      s.arms++;
    },
    step(s, dt, input) {
      // Breathing: tilt sideways. It fills the lungs but costs speed.
      s.breathing = input.tiltX !== null && Math.abs(input.tiltX) > 14 ? Math.sign(input.tiltX) : 0;
      s.air = clamp(s.air + (s.breathing ? 0.9 : -0.11 / s.ease) * dt);
      const drag = 0.55 + (s.breathing ? 0.45 : 0) + (s.air < 0.01 ? 1.6 : 0);
      s.speed = Math.max(0, s.speed - drag * dt * (0.5 + s.speed / 3));
      if (!s.turned && s.s >= POOL) { // touched the wall without a flip turn
        s.turned = true;
        s.speed *= 0.35;
        say(s, 'SLOW TURN', false);
      }
      advance(s, dt, 100);
    },
    act(s, a) {
      if (a.type === 'flick' && !s.turned && s.s > POOL - 6) {
        const q = near(s.s, POOL - 1.5, 4);
        s.turned = true;
        s.s = POOL + 0.01;
        s.speed = 2.4 + 2.2 * q;
        say(s, q > 0.5 ? 'GREAT TURN!' : 'OK TURN', q > 0.5);
      } else if (a.type === 'swipe' || a.type === 'stroke') this.stroke(s, a.side);
    },
    bot(s) {
      const actions = [];
      if (s.s > POOL - 2.5 && !s.turned) actions.push({ type: 'flick' });
      else if (Math.floor(s.time * 4.4) > s.arms) actions.push({ type: 'stroke', side: s.arms % 2 ? 'left' : 'right' });
      return { input: { tiltX: s.air < 0.35 ? 30 : 0 }, actions };
    },
  });

  // ---------- Rowing ----------

  const BEAT = 1.15; // seconds between strokes
  define({
    id: 'rowing', name: 'ROWING', kind: 'time', start: true, distance: 200,
    rival: times(39.4, 3),
    beat: BEAT,
    create: (env) => racer(env, { clock: 0, hands: {}, pulled: -1, stroke: 9, streak: 0 }),
    // One pull of both oars, `both` when the two hands came together.
    pull(s, both) {
      const beat = Math.round(s.clock / BEAT);
      if (beat === s.pulled) return; // one stroke per beat
      s.pulled = beat;
      s.stroke = 0;
      const timing = near(s.clock - beat * BEAT, 0, 0.32 * s.ease);
      s.streak = timing > 0.6 ? s.streak + 1 : 0;
      s.speed = Math.min(7.2, s.speed + (0.5 + 2.1 * timing) * (both ? 1 : 0.6) +
        Math.min(0.3, s.streak * 0.04));
      say(s, timing > 0.75 ? 'PERFECT' : timing > 0.35 ? 'GOOD' : 'OFF BEAT', timing > 0.35);
      if (timing > 0.75) s.buzz = 25;
    },
    step(s, dt) {
      s.clock += dt;
      s.stroke += dt;
      // A single hand waits a moment for the other one.
      const { left, right } = s.hands;
      const first = left !== undefined ? left : right;
      if (first !== undefined && ((left !== undefined && right !== undefined) || s.clock - first > 0.12)) {
        this.pull(s, left !== undefined && right !== undefined);
        s.hands = {};
      }
      s.speed = Math.max(0, s.speed - (0.25 + s.speed * s.speed * 0.045) * dt);
      advance(s, dt, 200);
    },
    act(s, a) {
      if (a.type === 'swipe' && a.dir === 'down') s.hands[a.side] = s.clock;
      if (a.type === 'both') { s.hands = {}; this.pull(s, true); }
    },
    bot: (s) => ({
      input: {},
      actions: Math.abs(s.clock - Math.round(s.clock / BEAT) * BEAT) < 0.05 ? [{ type: 'both' }] : [],
    }),
  });

  // ---------- Track cycling ----------

  const LANES = [-1, 0, 1];
  define({
    id: 'cycling', name: 'TRACK CYCLING', kind: 'time', start: true, distance: 500,
    rival: times(41.8, 3),
    create: (env) => racer(env, { power: 0, legs: 1, x: 0, draft: false }),
    step(s, dt, input) {
      // Pedalling: circles drawn per second; keys add through `pedal`.
      const turning = Math.min(1, Math.abs(input.spin || 0) / dt / 14);
      s.power += (turning - s.power) * Math.min(1, dt * (turning > s.power ? 6 : 1.6));
      s.power = clamp(s.power);
      s.x = clamp(s.x + ((input.tiltX || 0) / 22) * dt * 1.6, -1.2, 1.2);
      // Sheltered right behind a rival.
      s.draft = s.rivals.some((total, i) => {
        const gap = along(this.distance, total, s.time) - s.s;
        return gap > 0.5 && gap < 9 && Math.abs(LANES[i % 3] - s.x) < 0.45;
      });
      const effort = s.power * s.power;
      s.legs = clamp(s.legs + (0.05 + (s.draft ? 0.09 : 0) - 0.14 * effort) * dt);
      const top = (9 + 8 * s.power * (0.55 + 0.45 * s.legs)) * (s.power > 0.05 ? 1 : 0) +
        (s.draft ? 1.3 : 0);
      s.speed += (top - s.speed) * Math.min(1, dt * (top > s.speed ? 0.9 : 0.45));
      advance(s, dt, this.distance);
    },
    lane: (i) => LANES[i % 3],
    act(s, a) { if (a.type === 'pedal') s.power = clamp(s.power + 0.12); },
    bot: (s, dt) => ({ input: { spin: (s.legs > 0.3 ? 11.5 : 8) * dt, tiltX: -s.x * 10 }, actions: [] }),
  });

  // ---------- Speed climbing ----------

  const HOLDS = 30;
  define({
    id: 'climbing', name: 'SPEED CLIMBING', kind: 'time', start: true, distance: 15,
    rival: times(9.6, 1.4),
    create(env) {
      // Left and right holds; every sixth one needs both hands.
      const holds = Array.from({ length: HOLDS }, (_, i) =>
        (i % 6 === 5 ? 'both' : env.rng() < 0.5 ? 'left' : 'right'));
      return racer(env, { holds, next: 0, slip: 0, hands: {}, y: 0, wait: 0 });
    },
    grab(s, side) {
      if (s.slip > 0 || s.next >= HOLDS) return;
      const need = s.holds[s.next];
      if (need === 'both') {
        if (side !== 'both') {
          s.hands[side] = s.time;
          const other = s.hands[side === 'left' ? 'right' : 'left'];
          if (other === undefined || s.time - other > 0.18) return;
        }
        say(s, 'LEAP!');
      } else if (side !== need) {
        s.slip = 0.7 / s.ease;
        s.next = Math.max(0, s.next - 1);
        s.buzz = 120;
        say(s, 'SLIP!', false);
        return;
      }
      s.hands = {};
      s.next++;
    },
    step(s, dt) {
      s.slip = Math.max(0, s.slip - dt);
      const goal = (s.next / HOLDS) * 15;
      const before = s.y;
      s.y += (goal - s.y) * Math.min(1, dt * 14);
      s.speed = (s.y - before) / dt;
      s.time += dt;
      s.cycle += dt;
      if (s.flash && (s.flash.left -= dt) <= 0) s.flash = null;
      s.s = s.y;
      if (s.next >= HOLDS) Object.assign(s, { done: true, mark: round(s.time), s: 15, y: 15 });
      else if (s.time > 90) Object.assign(s, { done: true, mark: null, note: 'TIME OUT' });
    },
    act(s, a) {
      if (a.type === 'press') this.grab(s, a.side);
      if (a.type === 'both') this.grab(s, 'both');
    },
    bot(s) {
      s.wait = s.wait || 0.28;
      if (s.time < s.wait) return { input: {}, actions: [] };
      s.wait = s.time + 0.28;
      const need = s.holds[s.next];
      return { input: {}, actions: [need === 'both' ? { type: 'both' } : { type: 'press', side: need }] };
    },
  });

  // ---------- Canoe slalom ----------

  const COURSE = 150, GATES = 10, MISS = 2;
  define({
    id: 'canoe', name: 'CANOE SLALOM', kind: 'time', start: true, distance: COURSE,
    rival: times(29.5, 4),
    create(env) {
      const gates = Array.from({ length: GATES }, (_, i) => ({
        at: 16 + i * 13.5, x: (i % 2 ? 1 : -1) * (0.25 + env.rng() * 0.55), passed: null,
      }));
      return racer(env, { gates, x: 0, drift: 0, last: null, penalty: 0, paddle: 0 });
    },
    stroke(s, side) {
      const alternate = s.last !== side;
      s.speed = Math.min(6, s.speed + (alternate ? 0.9 : 0.4));
      s.drift += side === 'left' ? 0.12 : -0.12; // a stroke pushes the bow away
      s.last = side;
      s.paddle = 0.3;
    },
    step(s, dt, input) {
      s.paddle = Math.max(0, s.paddle - dt);
      const current = Math.sin(s.s / 9) * 0.12;
      s.drift *= Math.exp(-3 * dt);
      s.x = clamp(s.x + (((input.tiltX || 0) / 20) * 1.2 + s.drift + current) * dt, -1, 1);
      s.speed = Math.max(1.6, s.speed - (0.3 + s.speed * 0.22) * dt); // the river carries it
      for (const g of s.gates) {
        if (g.passed !== null || s.s + s.speed * dt < g.at) continue;
        g.passed = Math.abs(s.x - g.x) < 0.24 * s.ease;
        if (g.passed) say(s, 'CLEAN GATE');
        else { s.penalty += MISS; s.buzz = 150; say(s, `MISSED +${MISS}S`, false); }
      }
      advance(s, dt, COURSE);
    },
    act(s, a) {
      if (a.type === 'press' || a.type === 'stroke') this.stroke(s, a.side);
    },
    bot(s) {
      const gate = s.gates.find((g) => g.passed === null);
      s.beats = s.beats || 0;
      const actions = [];
      if (s.time > s.beats * 0.25) {
        actions.push({ type: 'stroke', side: s.beats % 2 ? 'left' : 'right' });
        s.beats++;
      }
      return { input: { tiltX: gate ? clamp((gate.x - s.x) * 60, -25, 25) : 0 }, actions };
    },
  });

  const api = { along };
  if (typeof module !== 'undefined') module.exports = api;
  else root.RaceRules = api;
})(this);
