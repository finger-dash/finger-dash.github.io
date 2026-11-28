// The athlete's career: training bars, medals and the final. No DOM access.
(function (root) {
  'use strict';

  const STATS = [
    { id: 'speed', name: 'SPEED' },
    { id: 'strength', name: 'STRENGTH' },
    { id: 'jump', name: 'JUMP' },
    { id: 'stamina', name: 'STAMINA' },
    { id: 'aim', name: 'AIM' },
    { id: 'balance', name: 'BALANCE' },
    { id: 'reflexes', name: 'REFLEXES' },
  ];
  const MAX = 100;
  const START = 20;        // every bar of a new athlete
  const MAIN_SHARE = 0.7;  // weight of the main bar of an event; the other has the rest

  // Event: [short name, main bar, second bar].
  const EVENTS = {
    hurdles400: ['HURDLES', 'stamina', 'jump'],
    longJump: ['LONG JUMP', 'jump', 'speed'],
    shotPut: ['SHOT', 'strength', 'balance'],
    archery: ['ARCHERY', 'aim', 'balance'],
    boxing: ['BOXING', 'reflexes', 'strength'],
    weightlifting: ['WEIGHTS', 'strength', 'balance'],
    sprint100: ['100M', 'speed', 'reflexes'],
    javelin: ['JAVELIN', 'strength', 'speed'],
    highJump: ['HIGH JUMP', 'jump', 'balance'],
    poleVault: ['POLE', 'jump', 'strength'],
    discus: ['DISCUS', 'strength', 'balance'],
    hammer: ['HAMMER', 'strength', 'balance'],
    swimming: ['SWIM', 'stamina', 'speed'],
    diving: ['DIVING', 'balance', 'jump'],
    rowing: ['ROWING', 'stamina', 'strength'],
    canoe: ['CANOE', 'stamina', 'reflexes'],
    surfing: ['SURF', 'balance', 'reflexes'],
    cycling: ['CYCLING', 'stamina', 'speed'],
    climbing: ['CLIMB', 'speed', 'strength'],
    beam: ['BEAM', 'balance', 'jump'],
    trap: ['TRAP', 'aim', 'reflexes'],
    tableTennis: ['PING PONG', 'reflexes', 'aim'],
    penalty: ['PENALTY', 'aim', 'reflexes'],
    fencing: ['FENCING', 'reflexes', 'speed'],
  };

  // Free training. `gain` adds to bars; doping is a gamble.
  const ACTIONS = [
    { id: 'run', name: 'RUN', gain: { speed: 8, stamina: 5 } },
    { id: 'rope', name: 'JUMP ROPE', gain: { stamina: 8, jump: 5 } },
    { id: 'weights', name: 'LIFT WEIGHTS', gain: { strength: 10 } },
    { id: 'boxJumps', name: 'BOX JUMPS', gain: { jump: 8, speed: 4 } },
    { id: 'target', name: 'TARGET SHOOTING', gain: { aim: 10 } },
    { id: 'yoga', name: 'YOGA', gain: { balance: 10, aim: 3 } },
    { id: 'drills', name: 'REACTION BALL', gain: { reflexes: 10 } },
    { id: 'eat', name: 'EAT', gain: { strength: 5, stamina: 5 } },
    { id: 'rest', name: 'REST', gain: { reflexes: 5, balance: 4, stamina: 3 } },
    { id: 'doping', name: 'DOPING', risky: true, others: -10 },
  ];

  const MEDALS = ['bronze', 'silver', 'gold']; // worst to best
  const clamp = (v) => Math.max(0, Math.min(MAX, Math.round(v)));

  // saved: what toJSON returned before, possibly damaged or from an older version.
  function create(saved) {
    const data = saved && typeof saved === 'object' ? saved : {};
    const stats = {}, medals = {};
    for (const { id } of STATS) {
      const v = data.stats && data.stats[id];
      stats[id] = Number.isFinite(v) ? clamp(v) : START;
    }
    for (const id of Object.keys(EVENTS)) {
      if (data.medals && MEDALS.includes(data.medals[id])) medals[id] = data.medals[id];
    }
    return { stats, medals };
  }

  // Does an action. Returns {stat: change} with what actually moved.
  function train(career, id, rng = Math.random) {
    const action = ACTIONS.find((a) => a.id === id);
    if (!action) return null;
    let gain = action.gain;
    if (action.risky) {
      const lucky = STATS[Math.min(STATS.length - 1, Math.floor(rng() * STATS.length))].id;
      gain = {};
      for (const stat of STATS) gain[stat.id] = stat.id === lucky ? MAX : action.others;
    }
    const changes = {};
    for (const [stat, amount] of Object.entries(gain)) {
      const before = career.stats[stat];
      career.stats[stat] = clamp(before + amount);
      if (career.stats[stat] !== before) changes[stat] = career.stats[stat] - before;
    }
    return changes;
  }

  // The bars an event leans on: [{id, name, value, share}].
  function needs(career, event) {
    const [, main, second] = EVENTS[event];
    return [main, second].map((id, i) => ({
      id, name: STATS.find((s) => s.id === id).name, value: career.stats[id],
      share: i ? 1 - MAIN_SHARE : MAIN_SHARE,
    }));
  }

  // How fit the athlete is for an event, 0..1.
  const form = (career, event) =>
    needs(career, event).reduce((sum, n) => sum + (n.value / MAX) * n.share, 0);

  // What the form does to a competition: a factor for the strength of the rivals
  // and one for how forgiving the controls are. Both are 1 at a form of 0.4.
  function edge(career, event) {
    const f = form(career, event);
    return { rivals: 1.08 - 0.2 * f, ease: 0.8 + 0.5 * f };
  }

  // Keeps the best medal of each event. True when this one improves it.
  function award(career, event, medal) {
    if (!EVENTS[event] || !MEDALS.includes(medal)) return false;
    if (MEDALS.indexOf(medal) <= MEDALS.indexOf(career.medals[event])) return false;
    career.medals[event] = medal;
    return true;
  }

  const count = (career, medal) => Object.values(career.medals).filter((m) => m === medal).length;
  const total = Object.keys(EVENTS).length;
  // Gold in every event opens the final.
  const champion = (career) => count(career, 'gold') === total;

  // ---------- Medals from results ----------

  // Place in an individual event, from 0. No mark, no medal.
  const forPlace = (place) => ['gold', 'silver', 'bronze'][place] || null;
  // Duels have a single rival: losing narrowly still pays.
  function forDuel(mine, theirs) {
    if (mine > theirs) return 'gold';
    if (theirs - mine <= 1) return 'silver';
    return theirs - mine <= 3 ? 'bronze' : null;
  }

  const api = {
    STATS, MAX, START, EVENTS, ACTIONS, total,
    create, train, needs, form, edge, award, count, champion, forPlace, forDuel,
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Career = api;
})(this);
