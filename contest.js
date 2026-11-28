// What field events share: athletes, attempts and standings. No DOM access.
(function (root) {
  'use strict';

  const node = typeof require === 'function';
  const Countries = node ? require('./countries.js') : root.Countries;

  const RIVALS = ['VEGA', 'ROSSI', 'TANAKA', 'OKORO', 'SILVA'];

  const round = (m) => Math.round(m * 100) / 100;

  function shuffle(list, rng) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  // The player first, then five rivals who never wear the player's colors.
  // plan(i) returns the marks of rival i, revealed one attempt at a time.
  function athletes({ rng, country, playerName, bases, plan }) {
    const others = shuffle(Countries.COUNTRIES.map((c) => c.id).filter((id) => id !== country), rng);
    const skill = shuffle(bases.slice(), rng); // who is good today
    return [
      { name: playerName || 'YOU', country, isPlayer: true, marks: [] },
      ...RIVALS.map((name, i) => ({
        name, country: others[i], isPlayer: false, marks: [], plan: plan(skill[i]),
      })),
    ];
  }

  // Stores the player's mark for this attempt and reveals the rivals'.
  function record(list, attempt, mark) {
    for (const a of list) a.marks.push(a.isPlayer ? mark : a.plan[attempt]);
  }

  const bestFirst = (athlete) => athlete.marks.filter((m) => m !== null).sort((a, b) => b - a);
  const best = (athlete) => (bestFirst(athlete).length ? bestFirst(athlete)[0] : null);
  const total = (athlete) => athlete.marks.reduce((sum, m) => sum + (m || 0), 0);

  // Best mark first; ties are broken by the next best. No mark goes last.
  function byBest(list) {
    return list.slice().sort((a, b) => {
      const x = bestFirst(a), y = bestFirst(b);
      for (let i = 0; i < Math.max(x.length, y.length); i++) {
        const diff = (y[i] || 0) - (x[i] || 0);
        if (diff) return diff;
      }
      return 0;
    });
  }

  // Highest sum first; ties are broken by the number of tens.
  function byTotal(list) {
    const tens = (a) => a.marks.filter((m) => m === 10).length;
    return list.slice().sort((a, b) => total(b) - total(a) || tens(b) - tens(a));
  }

  const api = { round, athletes, record, best, total, byBest, byTotal };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Contest = api;
})(this);
