// Trackpad gesture detection.
//
// Every downward swipe adds a fixed amount of charge to the power bar, which
// leaks over time. Browsers expose no raw touches, so swipes come from:
//   - one finger:  pointer movement (use Pointer Lock so it never hits an edge)
//   - two fingers: `wheel` events
//   - touch screens: one stream per finger
// A quick upward flick triggers a jump.
(function (root) {
  'use strict';

  const DEFAULTS = {
    strokeGapMs: 55,       // silence that separates two swipes
    minStroke: 25,         // px a swipe must travel to count
    minIntervalMs: 70,     // per stream, ignores jitter counted as extra swipes
    upTolerance: 2,        // upward px ignored as noise
    gain: 0.08,            // charge added per swipe (bar is 0..1)
    leakBase: 0.16,        // charge lost per second...
    leakProportional: 0.36, // ...plus this times the current charge
    flickDistance: 60,     // upward px needed to jump...
    flickWindowMs: 100,    // ...within this time window
    jumpCooldownMs: 350,
  };

  class GestureDetector {
    constructor(onJump, options) {
      this.cfg = Object.assign({}, DEFAULTS, options);
      this.onJump = onJump || function () {};
      // macOS "natural scrolling" (default): fingers moving down => deltaY < 0.
      this.naturalScroll = true;
      this.lastJumpT = -Infinity;
      this.reset();
    }

    reset() {
      this.charge = 0;
      this.strokes = 0;
      this.lastSource = '-';
      this.lastUpdate = null;
      this.streams = {};
      this.flicks = {};
      this.upPeak = 0; // largest upward travel seen in a window (calibration aid)
    }

    wheel(e, t) {
      if (e.ctrlKey) return; // pinch gesture
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      // deltaMode 1 = lines (some mice / Firefox configurations).
      const unit = e.deltaMode === 1 ? 16 : 1;
      this._feed('wheel', e.deltaY * unit * (this.naturalScroll ? -1 : 1), t);
    }

    // Pointer movement; positive dy means downwards.
    move(dy, t) {
      this._feed('pointer', dy, t);
    }

    // Touch screens: each finger is tracked separately.
    touch(id, dy, t) {
      this._feed(`touch:${id}`, dy, t);
    }

    // Finger lifted: forget its streams.
    release(id) {
      delete this.streams[`touch:${id}`];
      delete this.flicks[`touch:${id}`];
    }

    // A swipe is counted once. It ends on silence, on upward movement, or when
    // the speed picks up again after dropping (next finger, or a new flick on
    // top of the momentum tail). A momentum tail alone never adds swipes.
    _feed(source, down, t) {
      this._flick(source, down, t);
      const s = this.streams[source] ||
        (this.streams[source] = { active: false, lastT: -Infinity, chargedT: -Infinity });
      if (down <= 0) {
        if (down < -this.cfg.upTolerance) s.active = false;
        return;
      }
      const reaccelerated = s.active && s.counted &&
        s.valley < s.peak * 0.5 && down > s.valley * 2 + 6;
      if (!s.active || t - s.lastT > this.cfg.strokeGapMs || reaccelerated) {
        Object.assign(s, { active: true, counted: false, distance: 0, peak: 0, valley: Infinity });
      }
      s.lastT = t;
      s.distance += down;
      if (down >= s.peak) {
        s.peak = down;
        s.valley = down;
      } else {
        s.valley = Math.min(s.valley, down);
      }
      if (!s.counted && s.distance >= this.cfg.minStroke &&
          t - s.chargedT >= this.cfg.minIntervalMs) {
        s.counted = true;
        s.chargedT = t;
        this.addStroke(source);
      }
    }

    addStroke(source) {
      this.strokes++;
      this.lastSource = source;
      this.charge = Math.min(1, this.charge + this.cfg.gain);
    }

    // Must be called once per frame. `frozen` keeps the charge (while airborne).
    update(t, frozen) {
      const dt = this.lastUpdate === null ? 0 : Math.min(0.1, (t - this.lastUpdate) / 1000);
      this.lastUpdate = t;
      if (frozen) return;
      const leak = this.cfg.leakBase + this.cfg.leakProportional * this.charge;
      this.charge = Math.max(0, this.charge - leak * dt);
    }

    // Fires once per upward movement. It re-arms after silence or downward
    // movement, so the momentum tail of a flick cannot jump again.
    _flick(source, down, t) {
      const f = this.flicks[source] ||
        (this.flicks[source] = { samples: [], fired: false, lastT: -Infinity });
      if (t - f.lastT > this.cfg.strokeGapMs || down > this.cfg.upTolerance) {
        f.samples = [];
        f.fired = false;
      }
      f.lastT = t;
      if (down >= 0) return;
      f.samples.push({ t, up: -down });
      while (f.samples[0].t < t - this.cfg.flickWindowMs) f.samples.shift();
      const travel = f.samples.reduce((sum, s) => sum + s.up, 0);
      this.upPeak = Math.max(this.upPeak, travel);
      if (f.fired || travel < this.cfg.flickDistance) return;
      f.fired = true;
      if (t - this.lastJumpT < this.cfg.jumpCooldownMs) return;
      this.lastJumpT = t;
      this.onJump('flick', source);
    }
  }

  const api = { GestureDetector, DEFAULTS };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Gestures = api;
})(this);
