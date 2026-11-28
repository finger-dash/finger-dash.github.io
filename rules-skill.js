// Surfing, balance beam, trap shooting, table tennis, penalty kicks and fencing.
// No DOM access.
(function (root) {
  'use strict';

  const node = typeof require === 'function';
  const E = node ? require('./events.js') : root.Events;
  const { define, clamp, near, round } = E;

  const base = (env, extra) => ({
    phase: 'play', time: 0, done: false, mark: null, note: null, buzz: 0, flash: null,
    ease: env.level.ease, strength: env.level.rivals, rng: env.rng, ...extra,
  });
  const say = (s, text, good = true) => { s.flash = { text, good, left: 0.9 }; };
  function tick(s, dt) {
    s.time += dt;
    if (s.flash && (s.flash.left -= dt) <= 0) s.flash = null;
  }
  const end = (s, mark, note = null) => Object.assign(s, { done: true, mark, note });
  const scores = (base_, spread) => (rng, level) => round((base_ + (rng() - 0.5) * spread) * level.rivals);
  const duelEnd = (s) => Object.assign(s, { done: true, mark: s.mine, theirs: s.theirs });

  // ---------- Surfing ----------

  const WAVE = 35;
  define({
    id: 'surfing', name: 'SURFING', kind: 'score', attempts: 1, WAVE,
    rival: scores(250, 80),
    // x: distance ahead of the foam (0 caught, 1 far out). h: height on the wave 0..1.
    create: (env) => base(env, {
      x: 0.35, h: 0.45, vx: 0, points: 0, air: null, trick: 0, combo: 0, falls: 0, down: 0,
    }),
    step(s, dt, input) {
      tick(s, dt);
      if (s.down > 0) {
        s.down -= dt;
        if (s.down <= 0) { s.x = 0.4; s.h = 0.4; s.vx = 0; }
      } else if (s.air) {
        s.air.t += dt;
        s.air.angle += (input.spin || 0) + s.air.rate * dt;
        s.air.rate *= Math.exp(-0.4 * dt);
        if (s.air.t >= 1.1) {
          // Land with the board back where it started.
          const turns = Math.round(s.air.angle / (Math.PI * 2));
          const off = Math.abs(s.air.angle - turns * Math.PI * 2);
          if (off < 0.9 * s.ease) {
            const points = Math.round(15 + 25 * Math.min(2, Math.abs(turns)) + 10 * near(off, 0, 0.9));
            s.points += points;
            say(s, `${turns ? `${Math.abs(turns) * 360} ` : ''}AIR +${points}`);
            s.air = null;
            s.h = 0.7;
          } else this.wipeout(s);
        }
      } else {
        const lean = (input.tiltX || 0) / 22, rise = (input.tiltY || 0) / 22;
        s.vx += (lean * 0.9 + (s.h - 0.5) * 0.35 - 0.22) * dt; // the foam keeps coming
        s.vx *= Math.exp(-1.4 * dt);
        s.x = clamp(s.x + s.vx * dt, 0, 1);
        s.h = clamp(s.h - rise * 0.8 * dt + Math.sin(s.time * 1.7) * 0.05 * dt, 0.05, 1);
        // The pocket, close to the foam, is worth the most.
        s.pocket = s.x < 0.42 && s.h > 0.3 && s.h < 0.85;
        s.points += (s.pocket ? 4.5 : 1) * dt;
        if (s.x <= 0.02) this.wipeout(s);
      }
      if (s.time >= WAVE) end(s, round(s.points));
    },
    wipeout(s) {
      s.air = null;
      s.down = 2;
      s.falls++;
      s.buzz = 400;
      say(s, 'WIPEOUT!', false);
    },
    act(s, a) {
      if (s.down > 0) return;
      if ((a.type === 'flick' || a.type === 'jump') && !s.air) {
        if (s.h < 0.62) say(s, 'CLIMB TO THE LIP', false);
        else s.air = { t: 0, angle: 0, rate: 0 };
      } else if (a.type === 'trick' && s.air) s.air.rate += a.dir * 6.6;
    },
    bot(s) {
      const actions = [];
      if (!s.air && s.down <= 0 && s.h > 0.72 && s.x > 0.25 && Math.floor(s.time) % 4 === 0) actions.push({ type: 'jump' });
      const rise = s.air ? 0 : Math.floor(s.time) % 4 === 3 || Math.floor(s.time) % 4 === 0 ? 0.8 : 0.6;
      return { input: { tiltX: clamp((0.3 - s.x) * 90 + 6, -22, 22), tiltY: clamp((s.h - rise) * 80, -20, 20) }, actions };
    },
  });

  // ---------- Balance beam ----------

  const ROUTINE = 30, MOVES = ['up', 'down', 'left', 'right'];
  define({
    id: 'beam', name: 'BALANCE BEAM', kind: 'score', attempts: 1, ROUTINE,
    rival: (rng, level) => round(clamp((12.8 + (rng() - 0.5) * 2.2) * level.rivals, 5, 15.5)),
    create: (env) => base(env, {
      lean: 0, vel: 0, push: 0, cue: null, next: 2.5, hit: 0, asked: 0, wobble: 0, falls: 0,
      down: 0, doing: null,
    }),
    step(s, dt, input) {
      tick(s, dt);
      if (s.doing && (s.doing.t += dt) > 0.8) s.doing = null;
      if (s.down > 0) {
        s.down -= dt;
        if (s.down <= 0) { s.lean = 0; s.vel = 0; }
      } else {
        // An upside-down pendulum: it keeps falling to the side it leans to.
        s.push += (s.rng() - 0.5) * 3.2 * dt;
        s.push *= Math.exp(-0.7 * dt);
        s.vel += (s.lean * 1.5 + s.push / s.ease + ((input.tiltX || 0) / 18) * 3.2) * dt;
        s.vel *= Math.exp(-1.6 * dt);
        s.lean += s.vel * dt;
        s.wobble += Math.max(0, Math.abs(s.lean) - 0.25) * dt;
        if (Math.abs(s.lean) >= 1) {
          s.down = 2;
          s.falls++;
          s.cue = null;
          s.buzz = 400;
          say(s, 'FALL!', false);
        }
      }
      if (s.cue && (s.cue.left -= dt) <= 0) { s.cue = null; say(s, 'MISSED', false); }
      if (!s.cue && s.time >= s.next && s.time < ROUTINE - 2 && s.down <= 0) {
        s.cue = { dir: MOVES[Math.floor(s.rng() * 4)], left: 1.8 * s.ease };
        s.asked++;
        s.next = s.time + 3.2;
      }
      if (s.time >= ROUTINE) {
        const moves = s.asked ? s.hit / s.asked : 0;
        end(s, round(clamp(6 + 9.5 * moves - s.wobble * 0.35 - s.falls, 0, 16)));
      }
    },
    act(s, a) {
      if (!s.cue || a.type !== 'swipe' && a.type !== 'move') return;
      if (a.dir === s.cue.dir) {
        s.hit++;
        s.doing = { dir: a.dir, t: 0 };
        s.vel += (s.rng() - 0.5) * 0.8; // every move shakes the balance
        say(s, 'NICE!');
      } else say(s, 'WRONG MOVE', false);
      s.cue = null;
    },
    bot: (s) => ({
      input: { tiltX: clamp(-(s.lean * 22 + s.vel * 12), -22, 22) },
      actions: s.cue && s.cue.left < 1.2 ? [{ type: 'move', dir: s.cue.dir }] : [],
    }),
  });

  // ---------- Trap shooting ----------

  const CLAYS = 15;
  // The field is 1 wide and 1 high; y grows downwards.
  define({
    id: 'trap', name: 'TRAP SHOOTING', kind: 'score', attempts: 1, CLAYS, aims: true,
    rival: (rng, level) => clamp(Math.round((11.2 + (rng() - 0.5) * 4) * level.rivals), 0, CLAYS),
    create: (env) => base(env, {
      aim: { x: 0.5, y: 0.45 }, clay: null, thrown: 0, hits: 0, wait: 1.2, shot: null, results: [],
    }),
    launch(s) {
      const dir = s.rng() < 0.5 ? 1 : -1;
      s.clay = {
        x: 0.5 - dir * (0.1 + s.rng() * 0.25), y: 0.9,
        vx: dir * (0.18 + s.rng() * 0.26), vy: -(0.62 + s.rng() * 0.24), t: 0, broken: 0, shot: false,
      };
      s.thrown++;
    },
    // input.aim {x, y}: where a finger or the mouse points, when there is no sensor.
    step(s, dt, input) {
      tick(s, dt);
      if (input.tiltX !== null) {
        s.aim.x = clamp(0.5 + input.tiltX / 34);
        s.aim.y = clamp(0.45 + input.tiltY / 34);
      } else if (input.aim) s.aim = { x: clamp(input.aim.x), y: clamp(input.aim.y) };
      if (s.shot && (s.shot.t += dt) > 0.25) s.shot = null;
      const c = s.clay;
      if (!c) {
        if ((s.wait -= dt) <= 0) {
          if (s.thrown >= CLAYS) end(s, s.hits);
          else this.launch(s);
        }
        return;
      }
      c.t += dt;
      if (c.broken) c.broken += dt;
      else { c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 0.34 * dt; }
      if (c.broken > 0.5 || c.t > 2.8 || c.y > 1 || c.x < -0.05 || c.x > 1.05) {
        if (!c.broken) say(s, 'LOST', false);
        s.results.push(!!c.broken);
        s.clay = null;
        s.wait = 0.9;
      }
    },
    act(s, a) {
      const c = s.clay;
      if (a.type !== 'tap' && a.type !== 'shoot' || !c || c.shot) return;
      c.shot = true; // one cartridge per clay
      s.shot = { t: 0 };
      s.buzz = 60;
      if (Math.hypot((c.x - s.aim.x) * 1.1, c.y - s.aim.y) < 0.085 * s.ease) {
        c.broken = 0.001;
        s.hits++;
        say(s, 'HIT!');
      } else say(s, 'MISS', false);
    },
    bot(s) {
      const c = s.clay;
      return {
        input: { tiltX: c ? (c.x - 0.5) * 34 : 0, tiltY: c ? (c.y - 0.45) * 34 : 0 },
        actions: c && c.t > 0.6 ? [{ type: 'shoot' }] : [],
      };
    },
  });

  // ---------- Table tennis ----------

  const POINTS = 7;
  // The ball goes from depth 0 (the player's end) to 1 (the rival's end); x -1..1.
  define({
    id: 'tableTennis', name: 'TABLE TENNIS', kind: 'duel', POINTS,
    create: (env) => base(env, {
      mine: 0, theirs: 0, ball: null, rivalX: 0, wait: 1, rally: 0, swing: 0,
    }),
    serve(s) {
      s.rally = 0;
      s.ball = { depth: 1, dir: -1, x: 0, from: 0, to: (s.rng() - 0.5) * 1.4, time: 1.15, spin: 0, hit: false };
    },
    point(s, mine, why) {
      if (mine) s.mine++; else { s.theirs++; s.buzz = 180; }
      say(s, why, mine);
      s.ball = null;
      s.wait = 1.1;
      if (s.mine >= POINTS || s.theirs >= POINTS) duelEnd(s);
    },
    step(s, dt) {
      tick(s, dt);
      s.swing = Math.max(0, s.swing - dt);
      const b = s.ball;
      if (!b) {
        if ((s.wait -= dt) <= 0 && !s.done) this.serve(s);
        return;
      }
      b.depth += (b.dir * dt) / b.time;
      const travel = b.dir < 0 ? 1 - b.depth : b.depth;
      b.x = b.from + (b.to - b.from) * travel + b.spin * Math.sin(Math.PI * clamp(travel)) * 0.35;
      const wanted = b.dir > 0 ? b.x : 0;
      s.rivalX += clamp(wanted - s.rivalX, -dt * 1.5 * s.strength, dt * 1.5 * s.strength);
      if (b.dir < 0 && b.depth < -0.22) this.point(s, false, 'TOO LATE');
      if (b.dir > 0 && b.depth >= 1) {
        // The rival misses balls that are wide, fast, spinning, or late in a long rally.
        const reach = Math.abs(b.to - s.rivalX) * 0.55 + Math.abs(b.spin) * 0.25 +
          Math.max(0, 1 - b.time) * 0.8 + s.rally * 0.03;
        if (s.rng() < clamp((reach - 0.18) / s.strength ** 3, 0.04, 0.85)) this.point(s, true, 'POINT!');
        else {
          Object.assign(b, { dir: -1, depth: 1, from: b.to, to: (s.rng() - 0.5) * 1.6, spin: 0,
            time: Math.max(0.55, (1.02 - s.rally * 0.045) / s.strength) });
        }
      }
    },
    // A swipe hits: sideways aims, speed drives, the tilted phone adds spin.
    act(s, a) {
      const b = s.ball;
      if (a.type !== 'swipe' && a.type !== 'hit') return;
      s.swing = 0.2;
      if (!b || b.dir > 0 || b.depth > 0.35) return;
      const timing = near(b.depth, 0.04, 0.3 * s.ease);
      if (timing <= 0.05) { this.point(s, false, b.depth > 0.04 ? 'TOO SOON' : 'TOO LATE'); return; }
      const aim = a.type === 'hit' ? a.aim : clamp(a.dx / Math.max(30, -a.dy || 30), -1, 1);
      const power = a.type === 'hit' ? a.power : clamp((a.speed - 0.3) / 1.2);
      if (power > 0.9 && timing < 0.45) { this.point(s, false, 'OUT'); return; }
      s.rally++;
      Object.assign(b, {
        dir: 1, depth: Math.max(0, b.depth), from: b.x,
        to: clamp(aim + (1 - timing) * (s.rng() - 0.5) * 0.4, -1, 1),
        spin: clamp((a.spin || 0), -1, 1), time: 1.05 - 0.5 * power * timing,
      });
      say(s, timing > 0.7 ? 'SWEET SPOT' : 'OK');
    },
    bot(s) {
      const b = s.ball;
      const ready = b && b.dir < 0 && b.depth < 0.07;
      return { input: {}, actions: ready ? [{ type: 'hit', aim: s.rivalX > 0 ? -0.95 : 0.95, power: 0.75, spin: 0.5 }] : [] };
    },
  });

  // ---------- Penalty kicks ----------

  const KICKS = 5;
  // The goal is -1..1 wide and 0..1 high (0 on the grass).
  define({
    id: 'penalty', name: 'PENALTY KICKS', kind: 'duel', KICKS,
    create: (env) => base(env, {
      mine: 0, theirs: 0, turn: 'shoot', round: 0, shot: null, keeper: { x: 0, y: 0.3 },
      wait: 1, dive: null, clock: 0, log: { mine: [], theirs: [] },
    }),
    // The rival telegraphs a side with the body, and sometimes lies.
    prepare(s) {
      const x = (s.rng() < 0.5 ? -1 : 1) * (0.35 + s.rng() * 0.55);
      s.incoming = { x, y: 0.15 + s.rng() * 0.6, hint: s.rng() < 0.75 ? Math.sign(x) : -Math.sign(x), t: 0 };
    },
    step(s, dt, input) {
      tick(s, dt);
      // Tilting the phone leans; passing the mark commits to the dive.
      if (s.turn === 'keep' && input.tiltX !== null && Math.abs(input.tiltX) > 16) {
        this.diveTo(s, Math.sign(input.tiltX));
      }
      if (s.shot) {
        s.shot.t += dt;
        const p = clamp(s.shot.t / s.shot.time);
        if (s.turn === 'shoot') {
          s.keeper.x += (s.shot.keeper * p - s.keeper.x) * Math.min(1, dt * 7);
        }
        if (p >= 1 && !s.shot.judged) this.judge(s);
        if (s.shot.t >= s.shot.time + 1.2) this.change(s);
        return;
      }
      if (s.turn === 'keep') {
        s.incoming.t += dt;
        if (s.incoming.t >= 1.7) {
          s.shot = { x: s.incoming.x, y: s.incoming.y, t: 0, time: 0.55 * s.ease / s.strength, curve: 0 };
        }
      } else if ((s.clock += dt) > 9) { // taking too long: a weak shot
        s.shot = { x: 0, y: 0.1, power: 0, curve: 0, keeper: 0, t: 0, time: 0.9 };
      }
    },
    diveTo(s, side, y = 0.35) {
      if (s.turn !== 'keep' || s.dive || (s.shot && s.shot.judged)) return;
      s.dive = { side, y, early: !s.shot && s.incoming && s.incoming.t < 1.2 };
    },
    judge(s) {
      const shot = s.shot;
      shot.judged = true;
      let goal;
      if (s.turn === 'shoot') {
        const wide = Math.abs(shot.x) > 1 || shot.y > 1;
        const saved = !wide && Math.abs(shot.keeper - shot.x) < 0.26 && shot.y < 0.8 && shot.power < 0.92;
        goal = !wide && !saved;
        say(s, goal ? 'GOAL!' : wide ? 'WIDE!' : 'SAVED!', goal);
        if (goal) s.mine++;
        s.log.mine.push(goal);
      } else {
        // Diving too soon lets the shooter change side.
        const covers = s.dive && s.dive.side === Math.sign(shot.x) && !s.dive.early;
        const saved = covers && (Math.abs(shot.x) < 0.78 || s.rng() < 0.5);
        goal = !saved;
        say(s, saved ? 'GREAT SAVE!' : 'GOAL AGAINST', saved);
        if (goal) s.theirs++;
        s.log.theirs.push(goal);
      }
      s.buzz = 120;
    },
    change(s) {
      s.shot = null;
      s.dive = null;
      s.clock = 0;
      s.keeper = { x: 0, y: 0.3 };
      if (s.turn === 'shoot') {
        s.turn = 'keep';
        this.prepare(s);
      } else {
        s.turn = 'shoot';
        s.round++;
        s.incoming = null;
      }
      // Over when nobody can catch up, or after sudden death.
      const left = (n) => Math.max(0, KICKS - n);
      const m = s.log.mine.length, t = s.log.theirs.length;
      const settled = (m <= KICKS && t <= KICKS)
        ? s.mine > s.theirs + left(t) || s.theirs > s.mine + left(m)
        : m === t && s.mine !== s.theirs;
      if (settled || s.round >= 15) duelEnd(s);
    },
    act(s, a) {
      if (s.shot && s.turn === 'shoot') return;
      if (s.turn === 'shoot' && (a.type === 'swipe' || a.type === 'kick')) {
        let x, y, power, curve;
        if (a.type === 'kick') ({ x, y, power, curve } = a);
        else {
          if (a.dy > -20) return;
          x = clamp((a.dx / -a.dy) * 1.5, -1.5, 1.5);
          y = clamp((-a.dy - 25) / 100, 0.05, 1.3);
          power = clamp(a.speed / 1.8);
          curve = a.curve;
          x = clamp(x + curve * 0.25, -1.5, 1.5);
        }
        // The keeper guesses; he reads soft shots, and a curve fools him.
        const reads = s.rng() < clamp((0.3 + (1 - power) * 0.45 - Math.abs(curve) * 0.25) * s.strength);
        const keeper = reads ? x : [-0.65, 0, 0.65][Math.floor(s.rng() * 3)];
        s.shot = { x, y, power, curve, keeper, t: 0, time: 0.9 - 0.45 * power };
      } else if (s.turn === 'keep') {
        if (a.type === 'swipe' && (a.dir === 'left' || a.dir === 'right')) this.diveTo(s, a.dir === 'left' ? -1 : 1);
        if (a.type === 'dive') this.diveTo(s, a.side);
      }
    },
    bot(s) {
      if (s.turn === 'shoot') {
        return { input: {}, actions: !s.shot && s.time % 1 < 0.05 ? [{ type: 'kick', x: s.round % 2 ? 0.8 : -0.8, y: 0.6, power: 0.8, curve: 0.5 }] : [] };
      }
      const diving = s.shot && !s.dive;
      return { input: {}, actions: diving ? [{ type: 'dive', side: Math.sign(s.shot.x) }] : [] };
    },
  });

  // ---------- Fencing ----------

  const TOUCHES = 5;
  define({
    id: 'fencing', name: 'FENCING', kind: 'duel', TOUCHES,
    create: (env) => base(env, {
      mine: 0, theirs: 0, foe: { move: 'guard', t: 0, wait: 1.4, line: 'high' },
      me: { move: 'guard', t: 0, line: 'high' }, pause: 0, riposte: 0,
    }),
    touch(s, mine) {
      if (mine) s.mine++; else { s.theirs++; s.buzz = 250; }
      say(s, mine ? 'TOUCH!' : 'HIT!', mine);
      s.pause = 1.1;
      s.riposte = 0;
      if (s.mine >= TOUCHES || s.theirs >= TOUCHES) duelEnd(s);
    },
    step(s, dt, input) {
      tick(s, dt);
      if (input.tiltY !== null && Math.abs(input.tiltY) > 12) s.me.line = input.tiltY < 0 ? 'high' : 'low';
      if (s.pause > 0) {
        s.pause -= dt;
        if (s.pause <= 0) {
          s.me.move = 'guard';
          s.foe = { move: 'guard', t: 0, wait: 0.8 + s.rng() * 1.4, line: s.foe.line };
        }
        return;
      }
      s.riposte = Math.max(0, s.riposte - dt);
      const f = s.foe, me = s.me;
      f.t += dt;
      if (me.move !== 'guard') {
        me.t += dt;
        if (me.move === 'lunge' && me.t >= 0.22 && !me.judged) {
          me.judged = true;
          // The foe parries a lunge it has time to read.
          const open = s.riposte > 0 || f.move === 'recover' || f.move === 'attack' && f.t < 0.3;
          if (s.rng() < clamp(open ? 0.95 : 0.38 / s.strength ** 3)) return this.touch(s, true);
          say(s, 'PARRIED', false);
          Object.assign(f, { move: 'attack', t: 0.25, line: s.rng() < 0.5 ? 'high' : 'low' }); // riposte
        }
        if (me.t >= 0.6) me.move = 'guard';
      }
      if (f.move === 'guard' && f.t >= f.wait) {
        Object.assign(f, { move: 'attack', t: 0, line: s.rng() < 0.5 ? 'high' : 'low' });
      } else if (f.move === 'attack' && f.t >= 0.68 * s.ease / s.strength) {
        if (me.line === f.line && me.move !== 'lunge') {
          Object.assign(f, { move: 'recover', t: 0 });
          s.riposte = 0.8 * s.ease;
          s.buzz = 40;
          say(s, 'PARRY! LUNGE NOW');
        } else this.touch(s, false);
      } else if (f.move === 'recover' && f.t >= 0.8) {
        Object.assign(f, { move: 'guard', t: 0, wait: 0.6 + s.rng() * 1.4 });
      }
    },
    act(s, a) {
      if (s.pause > 0) return;
      if (a.type === 'parry') s.me.line = a.line;
      else if (a.type === 'swipe' && a.dir === 'down') s.me.line = 'low';
      else if ((a.type === 'flick' || a.type === 'lunge') && s.me.move === 'guard') {
        Object.assign(s.me, { move: 'lunge', t: 0, judged: false });
      } else if (a.type === 'tap') s.me.line = s.me.line === 'high' ? 'low' : 'high';
    },
    bot(s) {
      const actions = [];
      if (s.foe.move === 'attack' && s.me.line !== s.foe.line) actions.push({ type: 'parry', line: s.foe.line });
      if (s.riposte > 0 && s.me.move === 'guard') actions.push({ type: 'lunge' });
      return { input: { tiltY: null }, actions };
    },
  });

  const api = {};
  if (typeof module !== 'undefined') module.exports = api;
  else root.SkillRules = api;
})(this);
