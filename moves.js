// What the athlete on the setup screen does for each event, as joint positions.
// x is to the athlete's right, y up and z forward, in model units.
(function (root) {
  'use strict';

  const clamp = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
  const ease = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  // 0 -> 1 -> 0 bump between two moments.
  const bump = (t, from, to) => (t < from || t > to ? 0 : Math.sin((Math.PI * (t - from)) / (to - from)));
  const phase = (t, from, to) => ease((t - from) / (to - from));

  // Standing still. Index 0 is the left side, 1 the right one.
  function rest() {
    const both = (fn) => [-1, 1].map(fn);
    return {
      lift: 0, sway: 0, lean: 0, spin: 0,
      legs: both((s) => ({ knee: [s * 5, 12, 0], foot: [s * 5, 2, 0] })),
      arms: both((s) => ({ elbow: [s * 13.5, 37, 0], hand: [s * 14, 30, 0] })),
      gloves: false, props: [],
    };
  }

  function run(pose, t) {
    const a = Math.sin(t * Math.PI * 2.8);
    pose.lift = Math.abs(Math.cos(t * Math.PI * 2.8)) * 2;
    [-1, 1].forEach((s, i) => {
      const f = a * s;
      pose.legs[i] = { knee: [s * 5, 13 + Math.max(0, f) * 5, f * 7], foot: [s * 5, 2 + Math.max(0, f) * 9, f * 7 - Math.max(0, -f) * 4 - 2] };
      pose.arms[i] = { elbow: [s * 13.5, 39, -f * 7], hand: [s * 12.5, 38 - f * 2 + Math.abs(f) * 2, -f * 7 + 8] };
    });
  }

  const blend = (pose, other, k) => {
    pose.lift = lerp(pose.lift, other.lift, k);
    pose.legs.forEach((l, i) => { l.knee = mix(l.knee, other.legs[i].knee, k); l.foot = mix(l.foot, other.legs[i].foot, k); });
    pose.arms.forEach((a, i) => { a.elbow = mix(a.elbow, other.arms[i].elbow, k); a.hand = mix(a.hand, other.arms[i].hand, k); });
  };

  const MOVES = {
    hurdles400(t) {
      const T = 2.2, u = t % T, pose = rest();
      run(pose, t);
      const k = bump(u, 0.75, 1.55);
      const air = rest();
      air.lift = 15;
      air.legs = [ // lead leg straight ahead, trail leg folded to the side
        { knee: [-5, 31, 9], foot: [-5, 29, 20] },
        { knee: [14, 30, -3], foot: [15, 21, -13] },
      ];
      air.arms = [
        { elbow: [-15, 40, -7], hand: [-16, 34, -11] },
        { elbow: [8, 42, 9], hand: [-2, 38, 17] },
      ];
      blend(pose, air, ease(k * 1.4));
      pose.lean = 4 * k;
      const z = lerp(46, -46, clamp((u - 0.55) / 1.2)); // the hurdle comes by
      if (u > 0.55 && u < 1.75) pose.props.push({ type: 'hurdle', z });
      return pose;
    },

    longJump(t) {
      const T = 3, u = t % T, pose = rest();
      run(pose, t);
      if (u < 1.2) {
        blend(pose, rest(), 1 - phase(u, 0, 0.25)); // from the landing back into the run
        return pose;
      }
      const air = rest();
      const hang = phase(u, 1.55, 2.0); // arms up first, then legs thrown ahead
      air.lift = lerp(8, 16, bump(u, 1.2, 2.2));
      air.legs = [-1, 1].map((s) => ({
        knee: mix([s * 5, 22 + (s < 0 ? 8 : 0), s < 0 ? 8 : -6], [s * 5, 29, 11], hang),
        foot: mix([s * 5, 10 + (s < 0 ? 8 : 0), s < 0 ? 4 : -12], [s * 5, 27, 22], hang),
      }));
      air.arms = [-1, 1].map((s) => ({
        elbow: mix([s * 15, 56, 3], [s * 12, 42, 9], hang), hand: mix([s * 14, 65, 6], [s * 9, 36, 19], hang),
      }));
      blend(pose, air, phase(u, 1.2, 1.4));
      const land = rest();
      land.lift = -9;
      land.legs = [-1, 1].map((s) => ({ knee: [s * 6, 13, 11], foot: [s * 6, 2, 8] }));
      land.arms = [-1, 1].map((s) => ({ elbow: [s * 13, 31, 9], hand: [s * 10, 27, 18] }));
      blend(pose, land, phase(u, 2.1, 2.3));
      blend(pose, rest(), phase(u, 2.7, 3));
      pose.lean = 3 * phase(u, 2.1, 2.3) * (1 - phase(u, 2.7, 3));
      if (u > 2.15 && u < 2.75) pose.props.push({ type: 'sand', t: (u - 2.15) / 0.6 });
      return pose;
    },

    shotPut(t) {
      const T = 3.2, u = t % T, pose = rest();
      const crouch = phase(u, 0, 0.5) * (1 - phase(u, 1.5, 1.8));
      const push = phase(u, 1.55, 1.8) * (1 - phase(u, 2.7, 3.1));
      pose.lift = -7 * crouch + 3 * push;
      pose.spin = phase(u, 0.5, 1.55) * Math.PI * 2;
      pose.legs = [-1, 1].map((s) => ({ knee: [s * 8, 13 - crouch * 2, crouch * 7 + s * 2], foot: [s * 9, 2, s * 4] }));
      // Right hand: shot against the neck, then driven up and out.
      const hold = { elbow: [18, 41, 0], hand: [11, 51, 2] }, out = { elbow: [10, 56, 10], hand: [7, 64, 19] };
      pose.arms[1] = { elbow: mix(hold.elbow, out.elbow, push), hand: mix(hold.hand, out.hand, push) };
      pose.arms[0] = { elbow: mix([-16, 46, 5], [-15, 38, -7], push), hand: mix([-20, 47, 11], [-14, 30, -11], push) };
      const fly = clamp((u - 1.75) / 0.6);
      const hand = pose.arms[1].hand;
      if (u < 1.75 || u > 2.85) pose.props.push({ type: 'shot', at: [hand[0], hand[1] + pose.lift + 4, hand[2]] });
      else if (fly < 1) pose.props.push({ type: 'shot', at: [7 - fly * 2, 70 + fly * 26 - fly * fly * 14, 21 + fly * 26] });
      return pose;
    },

    archery(t) {
      const T = 3.4, u = t % T, pose = rest();
      const raise = phase(u, 0.1, 0.6) * (1 - phase(u, 2.7, 3.2));
      const draw = phase(u, 0.7, 1.5);
      const loose = u > 2.1;
      pose.legs = [-1, 1].map((s) => ({ knee: [s * 7, 12, -s * 2], foot: [s * 8, 2, -s * 4] }));
      pose.arms[0] = { elbow: mix([-13.5, 37, 0], [-9, 47, 10], raise), hand: mix([-14, 30, 4], [-5, 48, 20], raise) };
      const grip = pose.arms[0].hand;
      const nock = mix([grip[0] + 2, grip[1], grip[2] - 5], [2, 52, 5], draw);
      const after = { elbow: [20, 47, -8], hand: [13, 50, -4] };
      const pulling = { elbow: mix([15, 40, 6], [19, 50, -5], draw), hand: nock };
      const release = phase(u, 2.1, 2.22); // the hand flies back
      pose.arms[1] = {
        elbow: mix([13.5, 37, 0], mix(pulling.elbow, after.elbow, release), raise),
        hand: mix([14, 30, 0], mix(pulling.hand, after.hand, release), raise),
      };
      pose.props.push({ type: 'bow', grip, nock: !loose && raise > 0.9 ? nock : null, lift: pose.lift });
      if (loose && u < 2.45) pose.props.push({ type: 'arrow', from: [-3, 49, 18 + (u - 2.1) * 110], to: [-3, 49, 34 + (u - 2.1) * 110] });
      return pose;
    },

    boxing(t) {
      const T = 3.6, u = t % T, pose = rest();
      pose.gloves = true;
      pose.lift = -3 + Math.abs(Math.sin(t * Math.PI * 2)) * 1.6;
      pose.legs = [-1, 1].map((s) => ({ knee: [s * 7, 12, 3 - s * 3], foot: [s * 8, 2, -s * 4] }));
      pose.arms = [-1, 1].map((s) => ({ elbow: [s * 13, 37, 4], hand: [s * 7, 48, 11] }));
      const punch = (i, k, to) => {
        const a = pose.arms[i];
        a.elbow = mix(a.elbow, to.elbow, k); a.hand = mix(a.hand, to.hand, k);
      };
      punch(0, bump(u, 0.4, 0.8), { elbow: [-8, 46, 13], hand: [-3, 49, 25] });
      punch(1, bump(u, 0.9, 1.3), { elbow: [8, 46, 13], hand: [3, 49, 25] });
      const up = bump(u, 1.6, 2.2);
      punch(1, up, { elbow: [11, 41, 12], hand: [4, 62, 16] });
      pose.lift -= 3 * bump(u, 1.45, 1.75);
      const duck = bump(u, 2.5, 3.3);
      pose.sway = 9 * duck; pose.lift -= 6 * duck;
      pose.arms.forEach((a) => { a.elbow[0] += 7 * duck; a.hand[0] += 9 * duck; });
      return pose;
    },

    weightlifting(t) {
      const T = 4.4, u = t % T, pose = rest();
      // [seconds, hips, knees forward, bar height, bar depth, elbow spread, elbow height, elbow depth]
      const KEYS = [
        [0, -9, 9, 10, 9, 14, 23, 7], // gripping the bar
        [0.5, -9, 9, 10, 9, 14, 23, 7],
        [1.1, -1, 2, 28, 8, 17, 36, 5], // pull
        [1.4, -9, 10, 41, 8, 17, 36, 12], // under the bar
        [1.95, 0, 1, 47, 7, 17, 42, 11],
        [2.2, -5, 6, 42, 7, 17, 37, 11], // dip
        [2.5, 0, 1, 71, 1, 18, 57, 1], // jerk
        [3.5, 0, 1, 71, 1, 18, 57, 1],
        [3.85, -3, 3, 10, 10, 15, 33, 6], // the bar is dropped
        [4.4, -9, 9, 10, 9, 14, 23, 7],
      ];
      let i = 0;
      while (i + 2 < KEYS.length && u >= KEYS[i + 1][0]) i++;
      const from = KEYS[i], to = KEYS[i + 1];
      const [, lift, knees, bar, depth, spread, high, forward] =
        mix(from, to, ease((u - from[0]) / (to[0] - from[0])));
      const dropped = phase(u, 3.5, 3.65) * (1 - phase(u, 3.95, 4.2)); // hands let go
      pose.lift = lift;
      pose.legs = [-1, 1].map((s) => ({ knee: [s * 8, 12 + lift * 0.3, knees], foot: [s * 8, 2, 0] }));
      pose.arms = [-1, 1].map((s) => ({
        elbow: [s * spread, high - lift, forward],
        hand: [s * 13, lerp(bar, 36, dropped) - lift, depth],
      }));
      pose.props.push({ type: 'barbell', at: [0, bar, depth] });
      return pose;
    },
  };

  // The athlete's pose `t` seconds into the demonstration of an event.
  function pose(event, t) {
    return (MOVES[event] || MOVES.hurdles400)(t);
  }

  const api = { pose };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Moves = api;
})(this);
