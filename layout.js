// Screen layout: which logical canvas size and camera framing each device gets.
// Pure functions, so they can be tested without a browser.
(function (root) {
  'use strict';

  const PHONE_MAX_SIDE = 600; // CSS px: shorter screen side below this is a phone

  const LANDSCAPE = { w: 320, h: 180, res: 2, horizon: 62, ppm: 40, camH: 2.55 };

  const isPhone = (touch, screenMin) => touch && screenMin < PHONE_MAX_SIDE;

  // width/height: viewport in CSS px. inset: safe areas in CSS px.
  function compute({ touch, screenMin, width, height, inset = { top: 0, bottom: 0 } }) {
    const phone = isPhone(touch, screenMin);
    const upright = height > width;
    if (!phone || !upright) {
      // Desktop, tablets and phones turned sideways: 16:9. Tablets must be sideways.
      return { ...LANDSCAPE, portrait: false, rotate: touch && !phone && upright, top: 0, bottom: 0 };
    }
    // Upright phone: fixed width, height follows the screen so nothing is letterboxed.
    const w = 200;
    const h = Math.round((w * height) / width);
    const horizon = Math.round(h * 0.36);
    const ppm = 58; // pixels per meter at the player's depth: close to the athlete
    return {
      w, h, res: 3, horizon, ppm,
      camH: (h * 0.74 - horizon) / ppm, // keeps the feet at 74% of the height
      portrait: true, rotate: false,
      top: Math.ceil((inset.top * w) / width),
      bottom: Math.ceil((inset.bottom * w) / width),
    };
  }

  const api = { compute, isPhone, LANDSCAPE };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Layout = api;
})(this);
