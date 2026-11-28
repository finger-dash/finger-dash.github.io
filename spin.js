// Circle gesture: drawing circles builds power, a straight swipe up throws.
// Works with any stream of movement deltas (finger, trackpad or wheel).
(function (root) {
  'use strict';

  const DEFAULTS = {
    segment: 6,        // px travelled between two direction samples
    gapMs: 200,        // silence that ends a movement
    maxTurn: 2.2,      // radians; sharper turns are reversals, not circles
    minCurve: 0.12,    // average turn per segment that counts as circling
    gain: 0.022,       // power per radian turned
    leakBase: 0.04,    // power lost per second...
    leakProportional: 0.1,
    minTurns: 1,       // circles needed before a throw can happen
    throwWindowMs: 120,
    throwTravel: 70,   // px upwards within the window
    throwAbove: 45,    // px above the top of the latest circles
    throwStraight: 0.95,
    swipeStraight: 0.95,  // how straight the last stretch of a movement is to be a swipe
    swipeMs: 250,         // a swipe is looked for in this much of the movement
    liftTravel: 50,       // px upwards that throw when the finger is lifted after them
    liftAbove: 10,        // ...if they leave the top of the circles by this many px,
    liftShare: 0.65,      // ...or are this long compared with the width of the circles
    liftWithinMs: 200,    // the lift has to follow the swipe this soon
    historyMs: 900,
    maxStep: 0.35,     // radians the animation may turn per sample
  };

  class SpinDetector {
    constructor(onThrow, options) {
      this.cfg = Object.assign({}, DEFAULTS, options);
      this.onThrow = onThrow || function () {};
      this.reset();
    }

    reset() {
      this.power = 0;
      this.turned = 0;       // radians of circling so far
      this.angle = 0;        // signed, drives the animation
      this.thrown = false;
      this.x = 0; this.y = 0;
      this.lastT = -Infinity;
      this._restart();
    }

    _restart() {
      this.points = [];
      this.anchor = null;
      this.heading = null;
      this.curve = 0;
    }

    // dx, dy in px; positive dy means downwards.
    feed(dx, dy, t) {
      if (this.thrown) return;
      if (t - this.lastT > this.cfg.gapMs) this._restart();
      this.lastT = t;
      if (!this.anchor) {
        this.anchor = { x: this.x, y: this.y };
        this.points.push({ x: this.x, y: this.y, t }); // where it starts
      }
      this.x += dx; this.y += dy;
      this.points.push({ x: this.x, y: this.y, t });
      while (this.points[0].t < t - this.cfg.historyMs) this.points.shift();
      this._turn();
      this._checkThrow(t);
    }

    _turn() {
      const sx = this.x - this.anchor.x, sy = this.y - this.anchor.y;
      if (Math.hypot(sx, sy) < this.cfg.segment) return;
      const heading = Math.atan2(sy, sx);
      this.anchor = { x: this.x, y: this.y };
      if (this.heading !== null) {
        let turn = heading - this.heading;
        if (turn > Math.PI) turn -= 2 * Math.PI;
        if (turn < -Math.PI) turn += 2 * Math.PI;
        if (Math.abs(turn) < this.cfg.maxTurn) {
          // Only a steady curve counts, so shaking the finger adds nothing.
          this.curve = this.curve * 0.75 + turn * 0.25;
          if (Math.abs(this.curve) > this.cfg.minCurve && Math.sign(turn) === Math.sign(this.curve)) {
            this.turned += Math.abs(turn);
            // Capped so the corner into the throwing swipe does not spin the athlete.
            this.angle += Math.max(-this.cfg.maxStep, Math.min(this.cfg.maxStep, turn));
            this.power = Math.min(1, this.power + Math.abs(turn) * this.cfg.gain);
          }
        } else this.curve = 0;
      }
      this.heading = heading;
    }

    _checkThrow(t) {
      const c = this.cfg;
      if (this.turned < c.minTurns * 2 * Math.PI) return;
      const from = t - c.throwWindowMs;
      const recent = this.points.filter((p) => p.t >= from);
      if (recent.length < 2) return;
      const first = recent[0];
      const up = first.y - this.y, side = this.x - first.x;
      if (up < c.throwTravel || Math.abs(side) > up * 0.8) return;
      let path = 0;
      for (let i = 1; i < recent.length; i++) {
        path += Math.hypot(recent[i].x - recent[i - 1].x, recent[i].y - recent[i - 1].y);
      }
      if (Math.hypot(side, up) / path < c.throwStraight) return;
      const earlier = this.points.filter((p) => p.t < from);
      if (earlier.length && this.y > Math.min(...earlier.map((p) => p.y)) - c.throwAbove) return;
      this._throw(side, up);
    }

    // The straight stretch that ends the movement: where it starts and how far it goes.
    _swipe() {
      const end = this.points[this.points.length - 1];
      let start = end, from = this.points.length - 1, path = 0;
      for (let i = this.points.length - 2; i >= 0; i--) {
        const p = this.points[i], next = this.points[i + 1];
        if (end.t - p.t > this.cfg.swipeMs) break;
        path += Math.hypot(next.x - p.x, next.y - p.y);
        if (Math.hypot(end.x - p.x, end.y - p.y) < path * this.cfg.swipeStraight) break;
        start = p;
        from = i;
      }
      return {
        up: start.y - end.y, side: end.x - start.x, before: this.points.slice(0, from),
      };
    }

    // The athlete lets go facing where he is seen at this moment (`facing`, radians).
    // The direction of the swipe itself does not aim the shot.
    _throw(side, up) {
      this.thrown = true;
      this.onThrow({
        power: this.power, angle: (Math.atan2(side, up) * 180) / Math.PI, facing: this.angle,
      });
    }

    // The finger was lifted. A swipe up that ends here throws, even a short one. Lifting
    // in the middle of a circle does not: that stretch neither leaves the circle nor is
    // long compared with it.
    lift(t) {
      const c = this.cfg;
      if (this.thrown || !this.points.length || t - this.lastT > c.liftWithinMs) return;
      if (this.turned < c.minTurns * 2 * Math.PI) return;
      const { up, side, before } = this._swipe();
      if (up < c.liftTravel || Math.abs(side) > up) return;
      if (before.length > 2) {
        const xs = before.map((p) => p.x), top = Math.min(...before.map((p) => p.y));
        const width = Math.max(...xs) - Math.min(...xs);
        if (this.y > top - c.liftAbove && up < width * c.liftShare) return;
      }
      this._throw(side, up);
    }

    update(dt) {
      if (this.thrown) return;
      const leak = this.cfg.leakBase + this.cfg.leakProportional * this.power;
      this.power = Math.max(0, this.power - leak * dt);
    }
  }

  const api = { SpinDetector, DEFAULTS };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Spin = api;
})(this);
