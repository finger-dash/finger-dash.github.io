// Boxing rules: punches, dodges, the opponent's behaviour and the decision.
// No DOM access. Sides are screen sides: 'left' or 'right'. The opponent's side is
// the hand he throws with; every punch of his goes to the middle.
//
// Bout phases: intro -> fight -> over.
// Opponent cycle: guard -> windup -> strike -> guard.
// Both boxers spend stamina to punch, and more when the punch is slipped. A tired
// opponent defends worse and has to wait before attacking again.
(function (root) {
  'use strict';

  const node = typeof require === 'function';
  const Countries = node ? require('./countries.js') : root.Countries;

  const INTRO = 2.5;
  const DURATION = 60;
  const HEALTH = 100;
  const STAMINA = 100;
  const REGEN = 24;            // stamina per second
  const PUNCH = {
    // miss: extra stamina lost when the punch is slipped. block: how easy to stop.
    jab: { cost: 7, miss: 5, damage: 3, lands: 0.09, busy: 0.26, block: 1 },
    uppercut: { cost: 18, miss: 10, damage: 8, lands: 0.22, busy: 0.6, block: 0.85 },
  };
  // The opponent's punch, and what slipping it costs him on top.
  const SWING = { cost: 18, miss: 24 };
  const TIRED = 0.3;           // share of his defence left with no stamina
  const SLIP_TIME = 0.35;      // his dodge on screen
  const DODGE_TIME = 0.55;
  const DODGE_REST = 0.15;
  const DODGE_MIN = 20;        // stamina needed to dodge
  const WHIFF_COST = 50;       // stamina lost by dodging when no punch was coming
  const STRIKE = 0.3;
  const IMPACT = 0.12;         // moment of the strike that connects
  const LATE = 0.55;           // share of the wind-up after which an uppercut stops it

  const DIFFICULTY = {
    // block: chance of defending a punch while fresh and on guard. patience:
    // defended punches it takes before he answers. regen: his stamina per second.
    easy: { guard: [1.1, 2.1], windup: 0.8, block: 0.5, patience: 4, damage: 9, regen: 9 },
    normal: { guard: [0.8, 1.6], windup: 0.58, block: 0.7, patience: 3, damage: 13, regen: 12 },
    hard: { guard: [0.5, 1.2], windup: 0.43, block: 0.85, patience: 2, damage: 18, regen: 15 },
  };
  const RIVALS = ['VEGA', 'ROSSI', 'TANAKA', 'OKORO', 'SILVA'];

  function createBout({
    difficulty = 'normal', rng = Math.random, playerName = 'YOU', country = 'ARG',
    edge = { rivals: 1, ease: 1 },
  } = {}) {
    const others = Countries.COUNTRIES.map((c) => c.id).filter((id) => id !== country);
    const pick = (list) => list[Math.floor(rng() * list.length)];
    const set = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    // A fitter boxer sees the punches coming sooner and takes them better.
    const level = {
      ...set, windup: set.windup * edge.ease, damage: Math.round(set.damage / edge.ease),
      regen: set.regen / edge.ease,
    };
    const bout = {
      difficulty, level, rng,
      phase: 'intro', time: 0, left: DURATION, result: null,
      player: {
        name: playerName || 'YOU', country, health: HEALTH, stamina: STAMINA,
        punch: null, dodge: null, rest: 0, landed: 0,
      },
      opponent: {
        name: pick(RIVALS), country: pick(others), health: HEALTH,
        stamina: STAMINA, dodge: null,
        state: 'guard', t: 0, length: 1.2, side: 'left', flash: 0, landed: 0,
      },
      events: [], // what happened, for the screen to show
    };
    return bout;
  }

  const opposite = (side) => (side === 'left' ? 'right' : 'left');

  function enter(o, state, length) {
    o.state = state;
    o.t = 0;
    o.length = length;
  }

  function rest(bout) {
    bout.opponent.blocked = 0;
    const [min, max] = bout.level.guard;
    enter(bout.opponent, 'guard', min + bout.rng() * (max - min));
  }

  // type: 'jab' or 'uppercut'.
  function punch(bout, side, type = 'jab') {
    const p = bout.player, spec = PUNCH[type];
    if (bout.phase !== 'fight' || p.punch || p.dodge || p.stamina < spec.cost) return false;
    p.stamina -= spec.cost;
    p.punch = { side, type, t: 0, done: false };
    return true;
  }

  function dodge(bout, direction) {
    const p = bout.player;
    if (bout.phase !== 'fight' || p.dodge || p.rest > 0 || p.stamina < DODGE_MIN) return false;
    p.punch = null; // a dodge cancels the punch
    p.dodge = { direction, t: 0 };
    return true;
  }

  function finish(bout, winner, how) {
    bout.phase = 'over';
    bout.time = 0;
    bout.result = { winner, how };
    bout.player.punch = null;
    bout.player.dodge = null;
    const o = bout.opponent;
    if (winner === 'player' && how === 'KO') enter(o, 'down', 0);
  }

  const spend = (boxer, amount) => { boxer.stamina = Math.max(0, boxer.stamina - amount); };

  function land(bout) {
    const p = bout.player, o = bout.opponent;
    const { side, type } = p.punch;
    const spec = PUNCH[type];
    // A well timed uppercut catches the opponent as his punch is about to leave.
    const timed = o.state === 'windup' && type === 'uppercut' && o.t >= o.length * LATE;
    // A swinging opponent cannot be reached.
    if (o.state === 'strike' || (o.state === 'windup' && !timed)) {
      bout.events.push({ type: 'block', side });
      o.flash = 0;
      return;
    }
    const fitness = TIRED + (1 - TIRED) * (o.stamina / STAMINA);
    if (o.state === 'guard' && bout.rng() < bout.level.block * spec.block * fitness) {
      o.flash = 0;
      if (bout.rng() < 0.5) {
        bout.events.push({ type: 'block', side });
      } else { // he slips it, away from the glove
        o.dodge = { direction: opposite(side), t: 0 };
        spend(p, spec.miss);
        bout.events.push({ type: 'miss', side });
      }
      if (++o.blocked >= bout.level.patience) o.length = o.t; // answer now
      return;
    }
    o.health = Math.max(0, o.health - spec.damage);
    p.landed++;
    o.flash = 0.2;
    o.dodge = null;
    bout.events.push({ type: 'hit', side, punch: type, damage: spec.damage });
    if (timed) rest(bout); // his punch never leaves
    if (o.health === 0) finish(bout, 'player', 'KO');
  }

  function strike(bout) {
    const p = bout.player, o = bout.opponent;
    o.hit = true;
    if (p.dodge) { // punches come down the middle: slipping to either side works
      o.missed = true;
      p.dodge.slipped = true;
      spend(o, SWING.miss);
      bout.events.push({ type: 'dodged', side: p.dodge.direction });
      return;
    }
    p.health = Math.max(0, p.health - bout.level.damage);
    p.punch = null;
    o.landed++;
    bout.events.push({ type: 'hurt', side: o.side, damage: bout.level.damage });
    if (p.health === 0) finish(bout, 'opponent', 'KO');
  }

  function stepOpponent(bout, dt) {
    const o = bout.opponent;
    o.t += dt;
    o.flash = Math.max(0, o.flash - dt);
    o.stamina = Math.min(STAMINA, o.stamina + bout.level.regen * dt);
    if (o.dodge) {
      o.dodge.t += dt;
      if (o.dodge.t >= SLIP_TIME) o.dodge = null;
    }
    if (o.state === 'strike') {
      if (!o.hit && o.t >= IMPACT) strike(bout);
      if (bout.phase === 'fight' && o.t >= o.length) rest(bout);
    } else if (o.t >= o.length) {
      if (o.state === 'guard') {
        if (o.stamina < SWING.cost) return; // catching his breath
        o.side = bout.rng() < 0.5 ? 'left' : 'right';
        o.dodge = null;
        enter(o, 'windup', bout.level.windup * (0.85 + bout.rng() * 0.3));
      } else if (o.state === 'windup') {
        o.hit = false;
        o.missed = false;
        spend(o, SWING.cost);
        enter(o, 'strike', STRIKE);
      }
    }
  }

  function step(bout, dt) {
    bout.time += dt;
    if (bout.phase === 'intro') {
      if (bout.time >= INTRO) {
        bout.phase = 'fight';
        bout.time = 0;
        rest(bout);
      }
      return;
    }
    if (bout.phase !== 'fight') return;

    const p = bout.player;
    p.stamina = Math.min(STAMINA, p.stamina + REGEN * dt);
    p.rest = Math.max(0, p.rest - dt);
    if (p.dodge) {
      p.dodge.t += dt;
      if (p.dodge.t >= DODGE_TIME) {
        // Reading the punch is free; ducking at nothing tires.
        if (!p.dodge.slipped) p.stamina = Math.max(0, p.stamina - WHIFF_COST);
        p.dodge = null;
        p.rest = DODGE_REST;
      }
    }
    if (p.punch) {
      const spec = PUNCH[p.punch.type];
      p.punch.t += dt;
      if (!p.punch.done && p.punch.t >= spec.lands) {
        p.punch.done = true;
        land(bout);
      }
      if (p.punch && p.punch.t >= spec.busy) p.punch = null;
    }
    if (bout.phase !== 'fight') return;
    stepOpponent(bout, dt);
    if (bout.phase !== 'fight') return;

    bout.left = Math.max(0, bout.left - dt);
    if (bout.left === 0) {
      const diff = p.health - bout.opponent.health;
      finish(bout, diff > 0 ? 'player' : diff < 0 ? 'opponent' : 'draw', 'POINTS');
    }
  }

  const api = { INTRO, DURATION, HEALTH, STAMINA, PUNCH, SWING, SLIP_TIME, DODGE_TIME, DODGE_MIN, WHIFF_COST, DIFFICULTY, createBout, punch, dodge, step };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Boxing = api;
})(this);
