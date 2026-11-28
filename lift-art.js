// Weightlifting art: the hall, the platform, the keycaps and the arcade buttons of touch
// screens. The lifter and the barbell are the athlete model of avatar.js.
//
// Everything but the hall and the arcade buttons is drawn in "stage" units: x = 0 is the middle of the platform and
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

    // A solid ellipse in pixel rows, `grow` larger on every side.
    function oval(cx, cy, rx, ry, color, grow = 0) {
      const a = rx + grow, b = ry + grow, px = 1 / view.layout.res * 2;
      for (let v = -b; v < b; v += px) {
        const half = a * Math.sqrt(Math.max(0, 1 - ((v + px / 2) / b) ** 2));
        rect(Math.round(cx - half), cy + v, Math.round(half * 2), px, color);
      }
    }

    // A cylinder seen from above and in front: its top is `tall` over the base at (x, y).
    function drum(x, y, rx, ry, tall, top, side) {
      oval(x, y, rx, ry, OUTLINE, 1.5);
      oval(x, y - tall, rx, ry, OUTLINE, 1.5);
      rect(x - rx - 1.5, y - tall, rx * 2 + 3, tall, OUTLINE);
      oval(x, y, rx, ry, side);
      rect(x - rx, y - tall, rx * 2, tall, side);
      oval(x, y - tall, rx, ry, top);
    }

    const COLORS = { // cap top, cap side, shine
      red: ['#ee3b45', '#a31d2c', '#ff9aa0'],
      blue: ['#2f86f0', '#1b4fa8', '#a5d0ff'],
      green: ['#46d368', '#23883d', '#b4f7c4'],
      off: ['#77728c', '#4c485e', '#a9a5bc'],
    };

    // An arcade button whose base is centred at (x, y). `press` goes from 0 (up) to 1
    // (all the way in); `alert` flashes its rim; `burst` (0 to 1) is the ring of a tap.
    function arcadeButton(x, y, r, color, { press = 0, alert = false, burst = null } = {}) {
      const [top, side, shine] = COLORS[color];
      const ry = r * 0.56;
      ctx.globalAlpha = 0.35;
      oval(x, y + 5, r * 1.3, ry * 1.3, '#000000');
      ctx.globalAlpha = 1;
      // housing and its chrome rim
      drum(x, y, r * 1.24, ry * 1.24, 5, alert ? '#ffd54a' : '#c9cede', alert ? '#c9780f' : '#6d7288');
      oval(x, y - 5, r * 1.06, ry * 1.06, '#1d1a2b');
      // plunger
      const tall = Math.round(r * 0.46 * (1 - press) + 2);
      const lit = press > 0.5;
      drum(x, y - 5, r * 0.92, ry * 0.92, tall, lit ? shine : top, lit ? top : side);
      const cy = y - 5 - tall;
      oval(x, cy + 1, r * 0.7, ry * 0.66, lit ? '#ffffff' : top);
      if (!lit) oval(x - r * 0.34, cy - ry * 0.3, r * 0.3, ry * 0.2, shine);
      if (burst !== null) {
        ctx.globalAlpha = 1 - burst;
        for (let i = 0; i < 9; i++) { // sparks leaving the upper half
          const a = Math.PI * (1.05 + (i * 0.9) / 8), d = 1.38 + burst * 0.5;
          const sx = x + Math.cos(a) * r * d, sy = y - 5 + Math.sin(a) * r * d * 0.82;
          rect(sx - 1.5, sy - 1.5, 3, 3, i % 2 ? '#ffd54a' : '#ffffff');
        }
        ctx.globalAlpha = 1;
      }
    }

    return { hall, platform, keycap, barAt, arcadeButton };
  }

  root.LiftArt = { create, FLOOR };
})(this);
