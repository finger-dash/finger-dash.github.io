// Poses of the athlete in the newer events, used in the competition and on the setup
// screen. Same format as moves.js: x to the athlete's right, y up, z forward, in
// model units. `roll` turns the whole figure (radians, positive: head forward) and
// sticks are the long equipment. No DOM access.
(function (root) {
  'use strict';

  const clamp = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const wave = (t) => Math.sin(t * Math.PI * 2);
  const smooth = (t) => 0.5 - 0.5 * Math.cos(clamp(t) * Math.PI);
  const sides = (fn) => [-1, 1].map(fn);

  const limb = (a, b) => ({ knee: a, foot: b });
  const arm = (a, b) => ({ elbow: a, hand: b });
  const make = (o = {}) => ({
    lift: 0, sway: 0, lean: 0, spin: 0, roll: 0, gloves: false, props: [],
    legs: sides((s) => limb([s * 5, 12, 0], [s * 5, 2, 0])),
    arms: sides((s) => arm([s * 13.5, 37, 0], [s * 14, 30, 0])),
    ...o,
  });
  const stick = (from, to, color = '#f4f4f4', width = 1.4) => ({ type: 'stick', from, to, color, width });

  // Running; cycle advances one stride per unit.
  function run(cycle, effort = 1) {
    const a = Math.sin(cycle * Math.PI) * effort;
    const p = make({ lift: Math.abs(Math.cos(cycle * Math.PI)) * 2 * effort, lean: 3 * effort });
    [-1, 1].forEach((s, i) => {
      const f = a * s;
      p.legs[i] = limb([s * 5, 13 + Math.max(0, f) * 5, f * 7], [s * 5, 2 + Math.max(0, f) * 9, f * 7 - Math.max(0, -f) * 4 - 2 * effort]);
      p.arms[i] = arm([s * 13.5, 39, -f * 7], [s * 12.5, 38 - f * 2 + Math.abs(f) * 2, -f * 7 + 8]);
    });
    return p;
  }

  // Javelin: carried over the shoulder; `back` 0..1 arm drawn back, `out` 0..1 thrown.
  function javelin(cycle, back = 0, out = 0, angle = 20) {
    const p = run(cycle, 1 - out);
    const rad = (angle * Math.PI) / 180;
    const hand = [12, lerp(lerp(57, 52, back), 60, out), lerp(lerp(2, -15, back), 17, out)];
    p.arms[1] = arm([15, lerp(48, 50, out), lerp(2, -7, back) + out * 14], hand);
    const mix = (a, b) => a.map((v, i) => lerp(v, b[i], back));
    p.arms[0] = arm(mix(p.arms[0].elbow, [-12, 47, 9]), mix(p.arms[0].hand, [-10, 49, 19]));
    p.lean = lerp(3, -4, back) + out * 9;
    if (out < 0.5) {
      const dz = Math.cos(rad) * 28, dy = Math.sin(rad) * 28;
      p.props.push(stick([12, hand[1] - dy, hand[2] - dz], [12, hand[1] + dy * 0.8, hand[2] + dz * 0.8]));
    }
    return p;
  }

  // Discus and hammer: whirling; `turn` in radians.
  function discus(turn, release = 0) {
    const p = make({ spin: turn, lift: -4 });
    p.legs = sides((s) => limb([s * 9, 11, 2], [s * 10, 2, s * 3]));
    p.arms[1] = arm([19, lerp(42, 53, release), 0], [28, lerp(40, 62, release), release * 6]);
    p.arms[0] = arm([-15, 44, 7], [-9, 46, 15]);
    if (!release) p.props.push({ type: 'shot', at: [30, p.arms[1].hand[1] - 4, 0] });
    return p;
  }
  function hammer(turn, release = 0) {
    const p = make({ spin: turn, lift: -4, lean: -3 });
    p.legs = sides((s) => limb([s * 8, 11, 3], [s * 9, 2, s * 3]));
    const y = lerp(40, 60, release);
    p.arms = sides((s) => arm([s * 8, y, 9], [s * 2, y - 1, 18]));
    if (!release) {
      p.props.push(stick([0, y - 1, 18], [0, y - 5, 38], '#cfd3dc', 0.8));
      p.props.push({ type: 'shot', at: [0, y - 9, 40] });
    }
    return p;
  }

  // High jump and vault flights: `arch` 0..1 bends the back over the bar.
  function flop(arch, roll) {
    const p = make({ roll });
    p.legs = sides((s) => limb(
      [s * 5, lerp(14, 20, arch), lerp(3, -9, arch)], [s * 5, lerp(5, 18, arch), lerp(-2, -17, arch)]));
    p.arms = sides((s) => arm([s * 14, lerp(40, 54, arch), lerp(3, -5, arch)], [s * 13, lerp(32, 62, arch), lerp(6, -10, arch)]));
    return p;
  }

  // Both hands on the pole while it bends; feet leave the ground.
  function plant(bend) {
    const p = make({ lift: bend * 4, lean: bend * 3 });
    p.arms = sides((s) => arm([s * 9, 53, 8], [s * 3, 61, 12]));
    p.legs = sides((s) => limb([s * 5, 15 + (s > 0 ? bend * 10 : 0), (s > 0 ? 9 : -3) * (0.4 + bend)],
      [s * 5, 4 + bend * (s > 0 ? 9 : 4), s > 0 ? 4 : -9 * bend]));
    return p;
  }

  // Diving: straight body, or tucked for somersaults.
  function dive(tuck, roll) {
    const p = make({ roll });
    p.legs = sides((s) => limb([s * 4, lerp(12, 28, tuck), lerp(0, 11, tuck)], [s * 4, lerp(2, 18, tuck), lerp(0, 5, tuck)]));
    p.arms = sides((s) => arm([s * lerp(9, 10, tuck), lerp(62, 36, tuck), lerp(0, 9, tuck)], [s * lerp(3, 7, tuck), lerp(74, 24, tuck), lerp(0, 12, tuck)]));
    return p;
  }

  // Freestyle: lying face down, arms turning, legs fluttering.
  function swim(t, breathing = 0) {
    const p = make({ roll: Math.PI / 2, nod: breathing * 2 });
    p.arms = sides((s) => {
      const a = t * Math.PI * 2 + (s > 0 ? Math.PI : 0);
      return arm([s * 13, 46 + Math.cos(a) * 10, Math.sin(a) * 9], [s * 12, 46 + Math.cos(a) * 20, Math.sin(a) * 15]);
    });
    p.legs = sides((s) => {
      const f = Math.sin(t * Math.PI * 6) * s;
      return limb([s * 4, 12, f * 3], [s * 4, 2, f * 7]);
    });
    return p;
  }

  // Rowing: sitting backwards to the finish; `k` 0 reach forward, 1 pulled to the chest.
  function row(k) {
    const p = make({ lift: -9, lean: lerp(5, -5, k) });
    p.legs = sides((s) => limb([s * 6, lerp(31, 18, k), lerp(8, 12, k)], [s * 5, 11, lerp(16, 22, k)]));
    p.arms = sides((s) => arm([s * 13, 35, lerp(10, -5, k)], [s * 7, 36, lerp(20, 5, k)]));
    sides((s) => p.props.push(stick([s * 7, 27, lerp(20, 5, k)], [s * 26, lerp(8, 14, k), lerp(-4, 22, k)], '#d8b47a')));
    return p;
  }

  // Cycling: crouched on the bike, legs going round.
  function cycle(turn) {
    const p = make({ lift: -1, lean: 9 });
    p.legs = sides((s) => {
      const a = turn * Math.PI * 2 + (s > 0 ? Math.PI : 0);
      const foot = [s * 5, 11 + Math.sin(a) * 5, 4 + Math.cos(a) * 5];
      return limb([s * 5, 20 + Math.sin(a) * 4, 9 + Math.cos(a) * 3], foot);
    });
    p.arms = sides((s) => arm([s * 11, 33, 17], [s * 9, 28, 23]));
    return p;
  }

  // Climbing: `step` alternates which hand is high.
  function climb(step) {
    const high = Math.abs((((step % 2) + 2) % 2) - 1); // 0..1..0
    const p = make({ lift: bumpy(step) });
    p.arms = sides((s) => {
      const up = s < 0 ? high : 1 - high;
      return arm([s * 15, lerp(41, 57, up), 5], [s * 13, lerp(44, 72, up), 9]);
    });
    p.legs = sides((s) => {
      const up = s > 0 ? high : 1 - high;
      return limb([s * 13, lerp(12, 22, up), 5], [s * 10, lerp(2, 13, up), 7]);
    });
    return p;
  }
  const bumpy = (step) => Math.abs(Math.sin(step * Math.PI)) * 2;

  // Surfing: crouched, arms out.
  function surf(crouch, sway = 0) {
    const p = make({ lift: -3 - crouch * 6, sway });
    p.legs = sides((s) => limb([s * 11, 11 - crouch * 2, s * 6 + 3], [s * 10, 2, s * 9]));
    p.arms = sides((s) => arm([s * 19, 45 + s * sway, s * 5], [s * 28, 44 + s * sway * 2, s * 10]));
    return p;
  }

  // Beam: `lean` -1..1; `move` is the figure being shown.
  function balance(lean, move = null, k = 0) {
    const p = make({ sway: lean * 7 });
    p.arms = sides((s) => arm([s * 20, 45 - s * lean * 8, 0], [s * 30, 46 - s * lean * 15, 0]));
    p.legs = sides((s) => limb([s * 3, 12, 0], [s * 2, 2, 0]));
    if (move === 'up') p.arms = sides((s) => arm([s * 12, 45 + 14 * k, 0], [s * lerp(26, 6, k), 46 + 24 * k, 0]));
    if (move === 'down') {
      p.lift = -11 * k;
      p.legs = sides((s) => limb([s * 8, 12, 4 * k], [s * 3, 2, 0]));
    }
    if (move === 'left' || move === 'right') {
      const i = move === 'left' ? 0 : 1, s = i ? 1 : -1;
      p.legs[i] = limb([s * lerp(3, 14, k), lerp(12, 23, k), 0], [s * lerp(2, 27, k), lerp(2, 27, k), 0]);
    }
    return p;
  }

  // Shooting a shotgun; `lift` raises the barrel (-1..1).
  function shoot(raise, kick = 0) {
    const p = make({ lean: -kick * 3 });
    p.legs = sides((s) => limb([s * 6, 12, s * 2 + 2], [s * 7, 2, s * 6]));
    const y = 50 + raise * 5;
    p.arms = [arm([-7, 43, 11], [-1, y, 17 - kick * 3]), arm([16, 44, 1], [5, 48, 7 - kick * 3])];
    p.props.push(stick([5, 47, 3 - kick * 3], [-2, y + 3 + raise * 9, 33 - kick * 3], '#7a5a34', 2.4));
    return p;
  }

  // Table tennis seen from behind: `swing` 0..1, `reach` -1..1 sideways.
  function paddle(swing, reach = 0) {
    const p = make({ sway: reach * 5, lift: -4 });
    p.legs = sides((s) => limb([s * 9, 11, 3], [s * 11, 2, -2]));
    const hand = [lerp(18, -3, swing) + reach * 8, lerp(35, 49, swing), lerp(9, 17, swing)];
    p.arms = [arm([-16, 38, 5], [-13, 38, 13]), arm([17, 39, 6], hand)];
    p.props.push({ type: 'paddle', at: [hand[0], hand[1] + 5, hand[2]] });
    return p;
  }

  // Kicking a ball, `k` 0..1 through the swing.
  function kick(k) {
    const p = make({ lean: lerp(3, -4, k) });
    p.legs = [limb([-5, 12, 3], [-5, 2, 2]), limb([5, lerp(15, 21, k), lerp(-7, 13, k)], [5, lerp(11, 16, k), lerp(-17, 23, k)])];
    p.arms = [arm([-17, 42, 6], [-22, 40, 11]), arm([17, 42, -6], [21, 37, -9])];
    return p;
  }

  // Goalkeeper facing the camera; `k` 0..1 dive towards `side`.
  function keeper(k, side = 1, t = 0) {
    const p = make({ lift: -5 * (1 - k) + wave(t * 1.5) * (1 - k), roll: 0 });
    p.legs = sides((s) => limb([s * lerp(10, 7, k), 11, 3 * (1 - k)], [s * lerp(12, 8, k), 2, 0]));
    p.arms = sides((s) => arm([s * lerp(18, 9, k), lerp(40, 60, k), 7 * (1 - k)], [s * lerp(24, 5, k), lerp(42, 74, k), 10 * (1 - k)]));
    p.side = side;
    return p;
  }

  // Fencing: `lunge` 0..1; `line` of the blade.
  function fence(lunge, line = 'high') {
    const p = make({ lift: -6 - lunge * 4, lean: lunge * 8 });
    p.legs = [
      limb([-5, 10, lerp(-6, -10, lunge)], [-5, 2, lerp(-11, -20, lunge)]),
      limb([5, lerp(14, 11, lunge), lerp(9, 17, lunge)], [5, 2, lerp(10, 22, lunge)]),
    ];
    const y = line === 'high' ? 49 : 34;
    const hand = [8, lerp(y, 46, lunge) + 5, lerp(15, 25, lunge)];
    p.arms = [arm([-14, 47, -9], [-13, 59, -13]), arm([11, lerp(y, 47, lunge), lerp(7, 15, lunge)], hand)];
    const rise = line === 'high' ? 9 : -9;
    p.props.push(stick(hand, [3, hand[1] + rise * (1 - lunge * 0.7), hand[2] + 20], '#ffffff', 0.7));
    return p;
  }

  const kinds = {
    run, javelin, discus, hammer, flop, plant, dive, swim, row, cycle, climb, surf, balance,
    shoot, paddle, kick, keeper, fence,
  };

  // The loop shown on the setup screen of each event.
  const cycleOf = (t, T) => (t % T) / T;
  const demos = {
    sprint100: (t) => run(t * 3.4),
    swimming: (t) => swim(t * 0.8),
    rowing: (t) => row(smooth(Math.abs(cycleOf(t, 1.8) * 2 - 1))),
    cycling: (t) => cycle(t * 1.3),
    climbing: (t) => climb(t * 1.6),
    canoe: (t) => {
      const a = wave(t * 0.6);
      const p = row(0.5);
      p.props = [];
      p.arms = sides((s) => arm([s * 14, 40 + s * a * 6, 7], [s * 9, 43 + s * a * 9, 13]));
      p.props.push(stick([-24, 43 - a * 25, 13], [24, 43 + a * 25, 13], '#222222', 1.6));
      return p;
    },
    javelin: (t) => {
      const u = t % 3, rest = 1 - smooth((u - 2.4) / 0.6);
      return javelin(t * 2.6, smooth((u - 0.8) / 0.7) * rest, smooth((u - 1.7) / 0.45) * rest, 25);
    },
    discus: (t) => discus((t % 3) < 2.2 ? smooth((t % 3) / 2.2) * Math.PI * 4 : 0, smooth(((t % 3) - 2) / 0.3) * (1 - smooth(((t % 3) - 2.6) / 0.4))),
    hammer: (t) => hammer((t % 3) < 2.4 ? smooth((t % 3) / 2.4) * Math.PI * 6 : 0, 0),
    highJump: (t) => {
      const k = Math.sin(Math.PI * cycleOf(t, 2.4)) ** 2;
      const p = flop(k, -k * 1.3);
      p.lift = k * 8;
      return p;
    },
    poleVault: (t) => plant(smooth(Math.abs(cycleOf(t, 2.4) * 2 - 1))),
    diving: (t) => dive(Math.sin(Math.PI * cycleOf(t, 2.6)) ** 2, smooth(cycleOf(t, 2.6)) * Math.PI * 2),
    surfing: (t) => surf(0.5 + wave(t * 0.7) * 0.4, wave(t * 0.45) * 3),
    beam: (t) => {
      const u = t % 4;
      return balance(wave(t * 0.7) * 0.25, 'right', smooth((u - 1) / 0.6) * (1 - smooth((u - 2.6) / 0.6)));
    },
    trap: (t) => shoot(wave(t * 0.4) * 0.8, Math.max(0, Math.sin(t * 3)) ** 8),
    tableTennis: (t) => paddle(smooth(Math.abs(cycleOf(t, 1.4) * 2 - 1)), wave(t * 0.3)),
    penalty: (t) => {
      const u = t % 2.4;
      return kick(smooth((u - 0.8) / 0.35) * (1 - smooth((u - 1.6) / 0.6)));
    },
    fencing: (t) => {
      const u = t % 2.4;
      return fence(smooth((u - 0.8) / 0.35) * (1 - smooth((u - 1.5) / 0.5)));
    },
  };

  const api = { kinds, demos, make };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Poses = api;
})(this);
