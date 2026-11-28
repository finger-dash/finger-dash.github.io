// Weightlifting art: the hall, the platform and the keycaps. The lifter and the barbell are
// the athlete model of avatar.js.
//
// Everything but the hall is drawn in "stage" units: x = 0 is the middle of the platform and
// the lifter's feet are at y = FLOOR. The screen decides where the stage goes and its scale.
(function (root) {
  'use strict';

  const FLOOR = 150;
  const OUTLINE = '#14101c';
  const BEND = 5; // how much the loaded bar sags

  function create(view) {
    const { rect, text, ctx } = view;

    // Crowd, wall trim and floor over the whole screen; `ground` is the screen y of the trim.
    function hall(ground) {
      const { W, H } = view;
      rect(0, 0, W, H, '#1b1830');
      rect(0, 0, W, ground + 2, '#221e3d');
      const shades = ['#3a3560', '#453d6e', '#32305a', '#514574', '#3d3a66'];
      for (let row = 0, y = ground - 6; y > 30; row++, y -= 7) {
        for (let x = (row % 2) * 4; x < W; x += 8) rect(x, y, 4, 4, shades[(x * 7 + y * 13) % 5]);
      }
      rect(0, ground, W, 4, '#c9a227');
      rect(0, ground + 4, W, H - ground - 4, '#4a3a33');
    }

    function platform(width = 200) {
      const left = -width / 2, side = width * 0.17, top = FLOOR - 8;
      rect(left, top, width, 22, '#a9743f');
      rect(left, top, width, 3, '#c98f55');
      rect(left, top + 19, width, 3, OUTLINE);
      rect(left, top, side, 22, '#2b2733');
      rect(-left - side, top, side, 22, '#2b2733');
    }

    // Screen of the bar: its height at `t` (-1 left end, 1 right end) for a centre `y`.
    const barAt = (y, tilt, t) => y + t * tilt + BEND * t * t;

    // A keyboard key whose top is at y. state: {down, mood: 'idle' | 'alert' | 'off'}.
    function keycap(x, y, letter, { down = false, mood = 'idle' } = {}) {
      const sink = down ? 4 : 0;
      const [face, side] = mood === 'off' ? ['#b9b5c9', '#6f6a86']
        : down ? ['#ffd54a', '#b88a14'] : mood === 'alert' ? ['#ffb36b', '#c25f1d'] : ['#f2f0f8', '#8d88a8'];
      const box = (bx, by, w, h, color) => {
        rect(bx + 2, by, w - 4, h, color);
        rect(bx + 1, by + 1, w - 2, h - 2, color);
        rect(bx, by + 2, w, h - 4, color);
      };
      ctx.globalAlpha = 0.35;
      box(x - 13, y + 18, 26, 8, '#000000');
      ctx.globalAlpha = 1;
      box(x - 13, y + sink, 26, 24 - sink, OUTLINE);
      box(x - 12, y + sink + 1, 24, 22 - sink, side);
      box(x - 9, y + sink + 2, 18, 16, face);
      rect(x - 8, y + sink + 3, 16, 1, '#ffffff');
      text(letter, x, y + sink + 5, '#2c2745', 2, 'center');
      if (down) { // sparks
        for (const s of [-1, 1]) {
          rect(x + s * 17 - 1, y + 8, 2, 6, '#ffffff');
          rect(x + s * 20 - 1, y + 2, 2, 5, '#b9b5c9');
        }
      }
    }

    return { hall, platform, keycap, barAt };
  }

  root.LiftArt = { create, FLOOR };
})(this);
