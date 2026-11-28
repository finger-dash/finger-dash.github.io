// Javelin, discus, hammer, high jump, pole vault and diving. No DOM access.
(function (root) {
  'use strict';

  const node = typeof require === 'function';
  const E = node ? require('./events.js') : root.Events;
  const { define, clamp, near, round } = E;

  const attempt = (env, extra) => ({
    phase: 'ready', time: 0, total: 0, done: false, mark: null, note: null, buzz: 0, flash: null,
    ease: env.level.ease, rng: env.rng, ...extra,
  });
  const go = (s, phase) => { s.phase = phase; s.time = 0; };
  const say = (s, text, good = true) => { s.flash = { text, good, left: 1 }; };
  function tick(s, dt) {
    s.time += dt;
    s.total += dt;
    if (s.flash && (s.flash.left -= dt) <= 0) s.flash = null;
  }
  const end = (s, mark, note = null) => Object.assign(s, { done: true, mark, note });
  const marks = (base, spread, fouls = 0.12) => (rng, level) =>
    (rng() < fouls ? null : round((base + (rng() - 0.5) * spread) * level.rivals));

  // Run-up shared by the jumps and the javelin.
  function runUp(s, dt, input) {
    const target = input.charge * 10.5;
    s.speed += (target - s.speed) * Math.min(1, (target > s.speed ? 3.2 : 2) * dt);
    s.s += s.speed * dt;
    s.cycle += s.speed * dt * 0.34;
  }
  // Without a sensor a meter sweeps between two values.
  const sweep = (time, lo, hi, period) => lo + (hi - lo) * (0.5 - 0.5 * Math.cos((time / period) * Math.PI * 2));

  // ---------- Javelin ----------

  const LINE = 32, ARM_ZONE = 18, BEST_THROW = 36, ARM_HOLD = 0.18;
  define({
    id: 'javelin', name: 'JAVELIN', kind: 'distance', attempts: 3, run: true,
    LINE, ARM_ZONE, BEST_THROW,
    rival: marks(66, 12),
    create: (env) => attempt(env, { phase: 'run', s: 0, speed: 0, cycle: 0, angle: 20, armed: 0, flight: null }),
    arm(s) {
      if (s.phase !== 'run' || s.s < LINE - ARM_ZONE) return;
      go(s, 'armed');
      say(s, 'ARM BACK');
    },
    release(s) {
      if (s.phase !== 'armed') return;
      const q = 1 - ((s.angle - BEST_THROW) / 34) ** 2;
      const mark = round(8.6 * s.speed * Math.max(0.3, q) + 3 * near(s.s, LINE - 1.5, 7));
      s.flight = { from: s.s, mark: Math.max(5, mark), angle: s.angle };
      go(s, 'flight');
    },
    step(s, dt, input) {
      tick(s, dt);
      if (s.phase === 'run' || s.phase === 'armed') {
        if (s.phase === 'run') {
          runUp(s, dt, input);
          if (input.held > ARM_HOLD) this.arm(s);
        } else {
          s.speed = Math.max(2, s.speed - 0.9 * dt); // crossover steps
          s.s += s.speed * dt;
          s.cycle += s.speed * dt * 0.34;
          s.angle = input.tiltY !== null ? clamp(20 + input.tiltY * 0.9, 5, 60)
            : sweep(s.time, 15, 55, 1.8 * s.ease);
        }
        if (s.s > LINE) end(s, null, 'FOUL');
        else if (s.total > 40) end(s, null, 'NO THROW');
      } else if (s.phase === 'flight') {
        if (s.time >= 2) end(s, s.flight.mark);
      }
    },
    act(s, a) {
      if (a.type === 'arm') this.arm(s);
      if (a.type === 'release' || a.type === 'throw') this.release(s);
    },
    bot(s) {
      const actions = [];
      if (s.phase === 'run' && s.s > LINE - 12) actions.push({ type: 'arm' });
      if (s.phase === 'armed' && s.s > LINE - 3) actions.push({ type: 'throw' });
      return { input: { charge: 0.85, tiltY: 18, held: 0 }, actions };
    },
  });

  // ---------- Discus ----------

  const SECTOR = Math.PI * 0.28; // half width of the throwing sector
  const aimError = (turn) => Math.atan2(Math.sin(turn), Math.cos(turn)); // 0: facing the field
  // Spin shared by discus and hammer: `work` is the effort of this step.
  function whirl(s, dt, work) {
    s.rate = clamp(s.rate + work - dt * (0.05 + s.rate * 0.12), 0, 1);
    if (s.rate > 0.04) s.turn += dt * (1.6 + s.rate * 7 / (0.7 + 0.3 * s.ease));
  }
  function sling(s, reach) {
    const off = Math.abs(aimError(s.turn));
    if (off > SECTOR) { go(s, 'flight'); s.flight = { mark: 0, off }; say(s, 'OUT OF SECTOR', false); s.foul = true; return; }
    const q = 1 - (off / SECTOR) * 0.28;
    s.flight = { mark: round(4 + reach * s.rate * q), off };
    go(s, 'flight');
  }
  const thrown = (s, dt) => {
    s.turn += dt * 2 * Math.max(0, 1 - s.time);
    if (s.time >= 2) end(s, s.foul ? null : s.flight.mark, s.foul ? 'FOUL' : null);
  };

  define({
    id: 'discus', name: 'DISCUS', kind: 'distance', attempts: 3, SECTOR, twist: true,
    rival: marks(55, 9),
    create: (env) => attempt(env, { phase: 'spin', rate: 0, turn: Math.PI, flight: null, foul: false }),
    step(s, dt, input) {
      tick(s, dt);
      if (s.phase === 'spin') {
        // Twisting the wrist, or circles on the screen.
        const work = Math.min(0.03, (input.twist || 0) / 1500 + Math.abs(input.spin || 0) / 75);
        whirl(s, dt, work);
        if (s.total > 25) end(s, null, 'NO THROW');
      } else thrown(s, dt);
    },
    act(s, a) {
      if (s.phase === 'spin' && (a.type === 'flick' || a.type === 'throw') && s.rate > 0.1) sling(s, 68);
      if (s.phase === 'spin' && a.type === 'wind') s.rate = clamp(s.rate + 0.07);
    },
    bot(s, dt) {
      const ready = s.rate > 0.8 && Math.abs(aimError(s.turn)) < 0.15;
      return { input: { twist: 2200 * dt }, actions: ready ? [{ type: 'throw' }] : [] };
    },
  });

  // ---------- Hammer ----------

  define({
    id: 'hammer', name: 'HAMMER', kind: 'distance', attempts: 3, SECTOR,
    rival: marks(65, 12),
    create: (env) => attempt(env, { phase: 'spin', rate: 0, turn: Math.PI, roll: null, flight: null, foul: false }),
    step(s, dt, input) {
      tick(s, dt);
      if (s.phase !== 'spin') return thrown(s, dt);
      // Rolling the phone: its tilt goes around like a marble on a plate.
      let work = Math.abs(input.spin || 0) / 75;
      if (input.tiltX !== null && Math.hypot(input.tiltX, input.tiltY) > 9) {
        const at = Math.atan2(input.tiltY, input.tiltX);
        if (s.roll !== null) {
          const moved = Math.abs(Math.atan2(Math.sin(at - s.roll), Math.cos(at - s.roll)));
          if (moved < 2) work += moved / 48;
        }
        s.roll = at;
      } else s.roll = null;
      whirl(s, dt, Math.min(0.035, work));
      if (s.total > 25) end(s, null, 'NO THROW');
    },
    act(s, a) {
      if (s.phase === 'spin' && (a.type === 'tap' || a.type === 'throw') && s.rate > 0.15) sling(s, 84);
      if (s.phase === 'spin' && a.type === 'wind') s.rate = clamp(s.rate + 0.07);
    },
    bot(s, dt) {
      const ready = s.rate > 0.8 && Math.abs(aimError(s.turn)) < 0.15;
      return { input: { spin: 3 * dt * Math.PI * 2, tiltX: null }, actions: ready ? [{ type: 'throw' }] : [] };
    },
  });

  // ---------- High jump ----------

  const JUMP_AT = 18; // m of the take-off spot
  define({
    id: 'highJump', name: 'HIGH JUMP', kind: 'height', run: true, JUMP_AT,
    bars: [1.9, 2.0, 2.1, 2.18, 2.24, 2.28, 2.32, 2.36, 2.4, 2.45],
    rival: (rng, level) => {
      const bars = [2.0, 2.1, 2.18, 2.24, 2.28, 2.32];
      return bars[clamp(Math.floor((rng() * 5 + 0.5) * level.rivals), 0, 5)];
    },
    // Where the curve asks the phone to lean, -1..1.
    curve: (m) => (m < 8 ? 0 : clamp((m - 8) / 6)),
    create: (env) => attempt(env, {
      phase: 'run', s: 0, speed: 0, cycle: 0, bar: env.bar, lean: 0, held: 0, samples: 0,
      jump: null, arch: 0, y: 0,
    }),
    step(s, dt, input) {
      tick(s, dt);
      if (s.phase === 'run') {
        runUp(s, dt, input);
        s.lean = input.tiltX === null ? this.curve(s.s) * 0.7 : clamp(input.tiltX / 22, -1, 1);
        if (s.s > 8) {
          s.samples += s.speed * dt;
          s.held += near(s.lean, this.curve(s.s) * 0.8, 0.7) * s.speed * dt;
        }
        if (s.s > JUMP_AT + 2) end(s, null, 'RAN PAST');
        else if (s.total > 40) end(s, null, 'NO JUMP');
      } else if (s.phase === 'air') {
        const p = s.time / 1.5;
        // Arch the back as the body reaches the bar.
        const arching = input.tiltY !== null ? input.tiltY > 12 : s.pressed;
        if (arching && !s.arch && p > 0.15) {
          s.arch = Math.max(0.05, near(p, 0.45, 0.28 * s.ease));
          say(s, s.arch > 0.6 ? 'GREAT ARCH!' : 'OK', s.arch > 0.6);
        }
        s.y = s.jump.peak * Math.sin(Math.PI * clamp(p));
        if (p >= 0.5 && !s.judged) {
          s.judged = true;
          s.clear = s.jump.peak + 0.16 * s.arch;
          if (s.clear < s.bar) { s.buzz = 200; say(s, 'BAR DOWN', false); }
        }
        if (p >= 1.15) end(s, s.clear >= s.bar ? s.bar : null, s.clear >= s.bar ? null : 'NO');
      }
    },
    act(s, a) {
      if (s.phase === 'run' && (a.type === 'flick' || a.type === 'jump') && s.s > JUMP_AT - 5) {
        const curve = s.samples ? s.held / s.samples : 0;
        const timing = near(s.s, JUMP_AT - 0.6, 3.4 * s.ease);
        s.jump = { peak: 1.35 + Math.min(1, s.speed / 8.2) * 0.5 + 0.32 * curve + 0.3 * timing, curve, timing };
        go(s, 'air');
      } else if (s.phase === 'air' && (a.type === 'press' || a.type === 'arch')) s.pressed = true;
    },
    bot(s) {
      const actions = [];
      if (s.phase === 'run' && s.s > JUMP_AT - 0.8) actions.push({ type: 'jump' });
      if (s.phase === 'air' && s.time > 0.65) actions.push({ type: 'arch' });
      return { input: { charge: 0.85, tiltX: this.curve(s.s || 0) * 0.8 * 22 }, actions };
    },
  });

  // ---------- Pole vault ----------

  const BOX = 30;
  define({
    id: 'poleVault', name: 'POLE VAULT', kind: 'height', run: true, BOX,
    bars: [4.5, 4.8, 5.05, 5.25, 5.45, 5.6, 5.75, 5.9, 6.0, 6.1],
    rival: (rng, level) => {
      const bars = [4.8, 5.05, 5.25, 5.45, 5.6, 5.75];
      return bars[clamp(Math.floor((rng() * 5 + 0.5) * level.rivals), 0, 5)];
    },
    create: (env) => attempt(env, {
      phase: 'run', s: 0, speed: 0, cycle: 0, bar: env.bar, bend: 0, y: 0, jump: null, push: 0,
    }),
    plant(s) {
      if (s.phase !== 'run' || s.s < BOX - 5) return;
      s.plant = near(s.s, BOX - 1, 3.5 * s.ease);
      go(s, 'bend');
    },
    letGo(s) {
      if (s.phase !== 'bend') return;
      const bend = near(s.bend, 0.82, 0.5 * s.ease);
      const peak = 2.9 + Math.min(1, s.speed0 / 8.2) * 1.7 + 0.5 * s.plant + 0.85 * bend;
      s.jump = { peak, bend };
      go(s, 'air');
      say(s, bend > 0.7 ? 'GREAT RELEASE!' : 'OK', bend > 0.4);
    },
    step(s, dt, input) {
      tick(s, dt);
      if (s.phase === 'run') {
        runUp(s, dt, input);
        s.speed0 = s.speed;
        if (input.held > ARM_HOLD) this.plant(s);
        if (s.phase !== 'run') return;
        if (s.s > BOX + 0.8) end(s, null, 'RAN PAST');
        else if (s.total > 40) end(s, null, 'NO JUMP');
      } else if (s.phase === 'bend') {
        s.bend += dt * 1.25;
        s.s += (BOX - s.s) * Math.min(1, dt * 3);
        if (s.bend >= 1.25) this.letGo(s); // the pole throws the athlete back
      } else if (s.phase === 'air') {
        const p = s.time / 1.7;
        s.y = s.jump.peak * Math.sin(Math.PI * clamp(p));
        const tipping = input.tiltY !== null ? Math.abs(input.tiltY) > 14 : s.tapped;
        if (tipping && !s.push && p > 0.15) {
          s.push = Math.max(0.05, near(p, 0.46, 0.26 * s.ease));
          say(s, s.push > 0.6 ? 'CLEAN!' : 'PUSH', s.push > 0.6);
        }
        if (p >= 0.52 && !s.judged) {
          s.judged = true;
          s.clear = s.jump.peak + 0.22 * s.push;
          if (s.clear < s.bar) { s.buzz = 200; say(s, 'BAR DOWN', false); }
        }
        if (p >= 1.15) end(s, s.clear >= s.bar ? s.bar : null, s.clear >= s.bar ? null : 'NO');
      }
    },
    act(s, a) {
      if (s.phase === 'run' && a.type === 'plant') this.plant(s);
      else if (s.phase === 'bend' && (a.type === 'release' || a.type === 'let')) this.letGo(s);
      else if (s.phase === 'air' && (a.type === 'press' || a.type === 'push') && s.time > 0.1) s.tapped = true;
    },
    bot(s) {
      const actions = [];
      if (s.phase === 'run' && s.s > BOX - 1.2) actions.push({ type: 'plant' });
      if (s.phase === 'bend' && s.bend > 0.8) actions.push({ type: 'let' });
      if (s.phase === 'air' && s.time > 0.75) actions.push({ type: 'push' });
      return { input: { charge: 0.85 }, actions };
    },
  });

  // ---------- Diving ----------

  const FALL = 2.1; // seconds from the board to the water
  define({
    id: 'diving', name: 'DIVING', kind: 'score', attempts: 3,
    FALL,
    rival: (rng, level) => round((52 + (rng() - 0.5) * 24) * level.rivals),
    create: (env) => attempt(env, { angle: 0, rate: 0, open: false, jump: 0, twists: 0, splash: 0 }),
    step(s, dt, input) {
      tick(s, dt);
      if (s.phase === 'ready') {
        if (s.total > 20) end(s, null, 'NO DIVE');
      } else if (s.phase === 'air') {
        // Holding opens the body: the spin almost stops and the phone corrects the angle.
        s.open = input.held > 0.12 || s.opened;
        if (s.open) {
          s.rate += (0 - s.rate) * Math.min(1, dt * 7);
          s.angle += ((input.tiltX || 0) / 20) * 1.6 * dt + s.nudge * dt;
        } else {
          // Straightened out, a half turn enters head first.
          s.angle += s.rate * dt;
        }
        if (s.time >= FALL) {
          const halves = Math.max(1, Math.round((s.angle - Math.PI) / (Math.PI * 2)) * 2 + 1);
          const target = halves * Math.PI;
          const off = Math.abs(s.angle - target);
          const entry = near(off, 0, 0.9 * s.ease);
          const somersaults = (halves - 1) / 2;
          const difficulty = 1.6 + 0.55 * somersaults;
          const judges = clamp(3.5 + 6.2 * entry + 0.3 * s.jump, 0, 10);
          s.score = { somersaults, difficulty: round(difficulty), judges: round(judges), entry };
          s.splash = 1 - entry;
          s.buzz = off > 0.6 ? 300 : 60;
          say(s, entry > 0.8 ? 'RIP ENTRY!' : entry > 0.4 ? 'OK ENTRY' : 'BIG SPLASH', entry > 0.4);
          go(s, 'water');
        }
      } else if (s.time >= 1.6) end(s, round(s.score.judges * 3 * s.score.difficulty));
    },
    act(s, a) {
      if (s.phase === 'ready' && (a.type === 'flick' || a.type === 'jump')) {
        s.jump = 1;
        s.nudge = 0;
        go(s, 'air');
      } else if (s.phase === 'air') {
        if ((a.type === 'swipe' && !s.opened && s.time > 0.2) || a.type === 'spin') s.rate = Math.min(13, s.rate + 4.2);
        if (a.type === 'open') s.opened = true;
        if (a.type === 'nudge') s.nudge = a.dir * 1.4;
      }
    },
    bot(s) {
      const actions = [];
      if (s.phase === 'ready' && s.total > 0.3) actions.push({ type: 'jump' });
      if (s.phase === 'air') {
        if (s.rate === 0 && s.time < 0.1) actions.push({ type: 'spin' }, { type: 'spin' });
        if (s.angle >= Math.PI * 3 - 0.45) actions.push({ type: 'open' });
      }
      return { input: { tiltX: s.phase === 'air' && s.opened ? clamp((Math.PI * 3 - s.angle) * 40, -20, 20) : 0 }, actions };
    },
  });

  const api = { aimError, sweep };
  if (typeof module !== 'undefined') module.exports = api;
  else root.FieldRules = api;
})(this);
