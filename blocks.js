// Pixel boxes drawn flat on the screen: the boxing gloves that come close to the camera.
// The ones the athlete model wears have the same shape (see avatar.js).
(function (root) {
  'use strict';

  const OUTLINE = '#14101c';

  function create(view) {
    const { rect } = view;
    const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const hexed = (values) => '#' + values
      .map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    const shade = (hex, f) => hexed(channels(hex).map((v) => v * f));
    const tint = (hex, f) => hexed(channels(hex).map((v) => v + (255 - v) * f));

    // One outlined box; `side` darkens a strip on that edge (-1 left, 1 right).
    function box(x, y, w, h, color, side = 1, edge = 1) {
      const l = Math.round(x), t = Math.round(y), width = Math.round(w), tall = Math.round(h);
      rect(l - edge, t - edge, width + edge * 2, tall + edge * 2, OUTLINE);
      rect(l, t, width, tall, color);
      const strip = Math.max(1, Math.round(width * 0.24));
      rect(side < 0 ? l : l + width - strip, t, strip, tall, shade(color, 0.76));
    }

    // A rectangle without its corners, `grow` pixels larger on every side.
    function notched(x, y, w, h, notch, color, grow = 0) {
      const left = Math.round(x - w / 2) - grow, top = Math.round(y - h / 2) - grow;
      const width = Math.round(w) + grow * 2, tall = Math.round(h) + grow * 2;
      rect(left, top + notch, width, tall - notch * 2, color);
      rect(left + notch, top, width - notch * 2, tall, color);
    }

    // A boxing glove: a block with notched corners and its thumb on side `inner`.
    function glove(x, y, r, color, inner) {
      const notch = Math.max(1, Math.round(r * 0.28));
      const edge = Math.max(1, Math.round(r * 0.08));
      notched(x, y, r * 2, r * 1.85, notch, OUTLINE, edge);
      notched(x, y, r * 2, r * 1.85, notch, color);
      rect(x - r + notch, y + r * 0.45, r * 2 - notch * 2, r * 0.47, shade(color, 0.74));
      rect(x - r * 0.62, y - r * 0.66, r * 0.42, r * 0.3, tint(color, 0.45));
      box(x + inner * r * 0.68 - r * 0.34, y - r * 0.14, r * 0.68, r * 0.84, color, -inner, edge);
    }

    return { glove };
  }

  root.Blocks = { create };
})(this);
