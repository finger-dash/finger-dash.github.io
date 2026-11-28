// Turns raw pointer samples into the actions of the events: press, release, tap,
// swipe, flick, stroke (a circle) and circles. Positions are logical pixels, times milliseconds.
// No DOM access.
(function (root) {
  'use strict';

  const TAP_SLOP = 8;        // px a tap may travel
  const TAP_TIME = 350;      // ms a tap may last
  const SWIPE_MIN = 16;      // px a swipe must travel
  const FLICK_TRAVEL = 30;   // px upwards...
  const FLICK_WINDOW = 120;  // ...within this time
  const STILL = 10;          // px a held finger may drift
  const LOOP = 5.5;          // radians that make a circle
  const CURLED = 2.5;        // radians after which a path is no longer straight

  // emit(action) receives {type, id, side, x, y, ...}. width() gives the screen width.
  function create(emit, width) {
    const fingers = new Map();
    let turned = 0; // radians drawn in circles since read

    const side = (x) => (x < width() / 2 ? 'left' : 'right');

    function down(p) {
      const f = {
        id: p.id, x0: p.x, y0: p.y, x: p.x, y: p.y, t0: p.t, side: side(p.x),
        path: [{ x: p.x, y: p.y, t: p.t }], heading: null, flicked: false, far: 0,
        turn: 0, loop: 0,
      };
      fingers.set(p.id, f);
      emit({ type: 'press', id: p.id, side: f.side, x: p.x, y: p.y, t: p.t });
    }

    function move(p) {
      const f = fingers.get(p.id);
      if (!f) return;
      const dx = p.x - f.x, dy = p.y - f.y;
      f.far = Math.max(f.far, Math.hypot(p.x - f.x0, p.y - f.y0));
      // Circles: how much the direction of travel keeps turning.
      if (Math.hypot(dx, dy) >= 2) {
        const heading = Math.atan2(dy, dx);
        if (f.heading !== null) {
          const turn = Math.atan2(Math.sin(heading - f.heading), Math.cos(heading - f.heading));
          if (Math.abs(turn) < 2) { // a reversal is not a circle
            turned += turn;
            f.turn += Math.abs(turn);
            f.loop += Math.abs(turn);
            if (f.loop > LOOP) { // one stroke per circle, without lifting
              f.loop = 0;
              emit({ type: 'stroke', id: f.id, side: f.side, x: p.x, y: p.y, t: p.t });
            }
          }
        }
        f.heading = heading;
        f.x = p.x; f.y = p.y;
        f.path.push({ x: p.x, y: p.y, t: p.t });
        if (f.path.length > 60) f.path.shift();
      }
      if (!f.flicked && f.turn < CURLED) { // not a part of a circle
        const from = f.path.find((s) => s.t >= p.t - FLICK_WINDOW);
        if (from && from.y - p.y >= FLICK_TRAVEL && Math.abs(p.x - from.x) < from.y - p.y) {
          f.flicked = true;
          emit({ type: 'flick', id: f.id, side: f.side, x: p.x, y: p.y, t: p.t });
        }
      }
    }

    // How far the path bends away from the straight line: positive bends right of travel.
    function curve(f, end) {
      const dx = end.x - f.x0, dy = end.y - f.y0, length = Math.hypot(dx, dy) || 1;
      let worst = 0;
      for (const s of f.path) {
        const off = (dx * (s.y - f.y0) - dy * (s.x - f.x0)) / length;
        if (Math.abs(off) > Math.abs(worst)) worst = off;
      }
      return Math.max(-1, Math.min(1, (-worst / length) * 4));
    }

    function up(p) {
      const f = fingers.get(p.id);
      if (!f) return;
      move(p);
      fingers.delete(p.id);
      const dx = p.x - f.x0, dy = p.y - f.y0, length = Math.hypot(dx, dy), ms = p.t - f.t0;
      emit({ type: 'release', id: f.id, side: f.side, x: p.x, y: p.y, t: p.t, ms });
      if (f.far < TAP_SLOP) {
        if (ms <= TAP_TIME) emit({ type: 'tap', id: f.id, side: f.side, x: p.x, y: p.y, t: p.t });
        return;
      }
      if (length < SWIPE_MIN) return;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      emit({
        type: 'swipe', id: f.id, side: f.side, x: p.x, y: p.y, t: p.t, dir, dx, dy, length,
        speed: length / Math.max(16, ms), curve: curve(f, p),
      });
    }

    return {
      down, move, up,
      reset() { fingers.clear(); turned = 0; },
      // Seconds the longest still finger has been held, 0 if none.
      held(t) {
        let best = 0;
        for (const f of fingers.values()) if (f.far < STILL) best = Math.max(best, (t - f.t0) / 1000);
        return best;
      },
      fingers: () => [...fingers.values()],
      // Radians drawn in circles since the last call (sign: clockwise positive).
      spin() {
        const total = turned;
        turned = 0;
        return total;
      },
    };
  }

  const api = { create };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Touch = api;
})(this);
