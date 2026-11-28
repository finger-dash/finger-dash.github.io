// Phone orientation as a game input: sideways and front-back tilt from a neutral
// position, and how much the phone turned around each axis. No DOM access besides
// the window it is given.
(function (root) {
  'use strict';

  // Shortest signed difference between two angles in degrees.
  const delta = (to, from) => ((((to - from) % 360) + 540) % 360) - 180;

  // The reading as the player sees it, whatever way the screen is turned.
  // x grows when the right side goes down, y when the top comes towards the player.
  function upright(e, screenAngle = 0) {
    if (screenAngle === 90) return { x: e.beta, y: -e.gamma };
    if (screenAngle === -90 || screenAngle === 270) return { x: -e.beta, y: e.gamma };
    return { x: e.gamma, y: e.beta };
  }

  function create(win) {
    let value = null, zero = null, last = null, asked = false;
    let turned = 0; // degrees twisted around the screen axis and the vertical since read

    function reading(e) {
      if (e.gamma === null || e.gamma === undefined || e.beta === null) return;
      const screen = win && win.screen && win.screen.orientation ? win.screen.orientation.angle
        : win && win.orientation;
      value = upright(e, screen || 0);
      const alpha = e.alpha || 0;
      if (last) {
        turned += Math.abs(delta(alpha, last.alpha)) + Math.abs(delta(value.x, last.x));
      }
      last = { alpha, x: value.x };
      if (!zero) zero = value;
    }
    if (win) win.addEventListener('deviceorientation', reading);

    return {
      reading,
      // iPhones only share the sensor after a permission asked from a tap.
      ask() {
        const api = win && win.DeviceOrientationEvent;
        if (asked || !api || typeof api.requestPermission !== 'function') return;
        asked = true;
        api.requestPermission().catch(() => { asked = false; });
      },
      // The way the phone is held now becomes the neutral position.
      calibrate() { zero = value; turned = 0; },
      // Degrees from the neutral position, or null without a sensor.
      tilt() {
        return value ? { x: delta(value.x, zero.x), y: delta(value.y, zero.y) } : null;
      },
      // Degrees twisted since the last call.
      twist() {
        const total = turned;
        turned = 0;
        return total;
      },
    };
  }

  const api = { create, upright, delta };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Motion = api;
})(this);
