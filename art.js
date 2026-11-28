// Pixel illustrations for the title and event screens. Everything is drawn with
// rectangles, so there are no image files to load.
(function (root) {
  'use strict';

  const EVENT_ART = { w: 88, h: 48 };
  const SKIN = '#e0a070', HAIR = '#3a2418', SHIRT = '#74acdf', SHORT = '#1c2340', SHOE = '#f9d56e';

  function createArt(view, avatar, Countries) {
    const { rect, text } = view;

    // Thick pixel line.
    function line(x0, y0, x1, y1, size, color) {
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      for (let i = 0; i <= steps; i++) {
        const x = x0 + ((x1 - x0) * i) / steps, y = y0 + ((y1 - y0) * i) / steps;
        rect(x - size / 2, y - size / 2, size, size, color);
      }
    }
    const path = (points, size, color) => {
      for (let i = 1; i < points.length; i++) line(...points[i - 1], ...points[i], size, color);
    };

    // Side view athlete. Joints are [x, y]; legs are [knee, foot], arms [elbow, hand].
    function athlete(ox, oy, j) {
      const at = (p) => [ox + p[0], oy + p[1]];
      const hip = at(j.hip), neck = at(j.neck), head = at(j.head);
      const leg = ([knee, foot]) => {
        path([hip, at(knee), at(foot)], 3, SKIN);
        rect(ox + foot[0] - 2, oy + foot[1] - 1, 5, 3, SHOE);
      };
      const arm = ([elbow, hand]) => path([neck, at(elbow), at(hand)], 2, SKIN);
      arm(j.arms[0]);
      leg(j.legs[0]);
      line(...hip, ...neck, 6, SHIRT);
      rect(hip[0] - 3, hip[1] - 3, 6, 5, SHORT);
      leg(j.legs[1]);
      rect(head[0] - 3, head[1] - 3, 7, 7, SKIN);
      rect(head[0] - 3, head[1] - 4, 7, 3, HAIR);
      arm(j.arms[1]);
    }

    function backdrop(x, y, ground, groundHeight) {
      const { w, h } = EVENT_ART;
      rect(x, y, w, h, '#3b6fd4');
      rect(x, y + 18, w, h - 18, '#6fa8ee');
      for (let i = 0; i < 11; i++) { // stands
        rect(x + i * 8, y + h - groundHeight - 7 - (i % 3), 8, 7 + (i % 3), i % 2 ? '#51669c' : '#44588a');
      }
      rect(x, y + h - groundHeight, w, groundHeight, ground);
    }

    const SCENES = {
      hurdles400(x, y) {
        backdrop(x, y, '#cf5a3c', 10);
        rect(x, y + 43, 88, 1, '#f3e9dc');
        rect(x + 48, y + 27, 2, 16, '#f4f4f4'); // hurdle
        rect(x + 48, y + 42, 9, 2, '#f4f4f4');
        rect(x + 46, y + 25, 6, 4, '#e8505b');
        athlete(x, y, {
          hip: [38, 20], neck: [45, 12], head: [49, 7],
          legs: [[[31, 24], [27, 31]], [[50, 21], [62, 20]]],
          arms: [[[39, 11], [34, 15]], [[52, 15], [58, 12]]],
        });
      },
      longJump(x, y) {
        backdrop(x, y, '#cf5a3c', 10);
        rect(x + 34, y + 38, 3, 10, '#ffffff'); // take-off board
        rect(x + 37, y + 38, 51, 10, '#e8cf8a');
        for (let i = 0; i < 14; i++) rect(x + 40 + ((i * 23) % 46), y + 40 + ((i * 5) % 7), 1, 1, '#b99a55');
        athlete(x, y, {
          hip: [43, 23], neck: [39, 13], head: [39, 8],
          legs: [[[52, 21], [63, 24]], [[54, 25], [61, 31]]],
          arms: [[[34, 7], [38, 2]], [[48, 12], [55, 8]]],
        });
      },
      shotPut(x, y) {
        backdrop(x, y, '#3f9e45', 12);
        rect(x + 12, y + 41, 46, 3, '#c9c9d6'); // throwing circle
        athlete(x, y, {
          hip: [34, 27], neck: [33, 17], head: [37, 12],
          legs: [[[27, 33], [21, 40]], [[43, 32], [45, 40]]],
          arms: [[[23, 17], [15, 13]], [[42, 20], [43, 12]]],
        });
        for (const [sx, sy] of [[45, 10], [58, 6], [70, 8], [79, 14]]) rect(x + sx, y + sy, 2, 2, '#ffffff');
        rect(x + 40, y + 6, 6, 6, '#14101c');
        rect(x + 41, y + 7, 4, 4, '#c9d1dc');
      },
      archery(x, y) {
        backdrop(x, y, '#3f9e45', 12);
        const ring = (r, color) => {
          for (let dy = -r; dy < r; dy++) {
            const half = Math.round(Math.sqrt(r * r - (dy + 0.5) ** 2));
            rect(x + 66 - half, y + 22 + dy, half * 2, 1, color);
          }
        };
        line(x + 60, y + 30, x + 56, y + 45, 2, '#7a5a34');
        line(x + 72, y + 30, x + 76, y + 45, 2, '#7a5a34');
        ['#f4f4f4', '#222222', '#2b9ad6', '#e8404b', '#f9d71c'].forEach((c, i) => ring(15 - i * 3, c));
        athlete(x, y, {
          hip: [19, 29], neck: [19, 18], head: [20, 13],
          legs: [[[15, 35], [13, 41]], [[23, 35], [26, 41]]],
          arms: [[[10, 18], [18, 18]], [[26, 18], [31, 18]]],
        });
        path([[x + 30, y + 7], [x + 35, y + 18], [x + 30, y + 29]], 2, '#8a5a2b');
        path([[x + 30, y + 7], [x + 18, y + 18], [x + 30, y + 29]], 1, '#f4f4f4');
        line(x + 18, y + 18, x + 42, y + 18, 1, '#f9d56e');
      },
      boxing(x, y) {
        rect(x, y, 88, 48, '#241b38');
        for (let i = 0; i < 40; i++) rect(x + ((i * 37) % 88), y + ((i * 11) % 22), 2, 2, '#56407a');
        rect(x, y + 36, 88, 12, '#3f6aa8');
        ['#e8505b', '#f4f4f4', '#2b62c9'].forEach((c, i) => rect(x, y + 22 + i * 5, 88, 1, c));
        rect(x + 33, y + 24, 22, 20, SKIN);            // opponent
        rect(x + 33, y + 40, 22, 8, '#1f9d45');
        rect(x + 37, y + 11, 14, 13, SKIN);
        rect(x + 37, y + 10, 14, 4, HAIR);
        rect(x + 40, y + 16, 2, 2, '#14101c');
        rect(x + 46, y + 16, 2, 2, '#14101c');
        for (const [gx, gy, size, color] of [
          [28, 22, 10, '#f9d71c'], [50, 22, 10, '#f9d71c'], [6, 32, 20, '#d52b1e'], [62, 32, 20, '#d52b1e'],
        ]) {
          rect(x + gx - 1, y + gy + 1, size + 2, size - 2, '#14101c');
          rect(x + gx + 1, y + gy - 1, size - 2, size + 2, '#14101c');
          rect(x + gx, y + gy + 1, size, size - 2, color);
          rect(x + gx + 2, y + gy, size - 4, size, color);
          rect(x + gx + 3, y + gy + 2, 3, 2, '#ffffff');
        }
      },
      weightlifting(x, y) {
        rect(x, y, 88, 48, '#241b38');
        for (let i = 0; i < 40; i++) rect(x + ((i * 37) % 88), y + ((i * 11) % 24), 2, 2, '#56407a');
        rect(x, y + 36, 88, 12, '#4a3a33');
        rect(x + 14, y + 41, 60, 5, '#a9743f');
        for (const side of [-1, 1]) { // legs and raised arms, seen from the front
          path([[x + 44 + side * 3, y + 29], [x + 44 + side * 9, y + 35], [x + 44 + side * 10, y + 40]], 4, SKIN);
          rect(x + 41 + side * 10, y + 39, 7, 3, SHOE);
          path([[x + 44 + side * 5, y + 21], [x + 44 + side * 12, y + 17], [x + 44 + side * 13, y + 9]], 3, SKIN);
        }
        line(x + 44, y + 20, x + 44, y + 28, 11, SHIRT);
        rect(x + 39, y + 27, 11, 5, SHORT);
        rect(x + 40, y + 11, 9, 9, SKIN);
        rect(x + 40, y + 10, 9, 3, HAIR);
        rect(x + 42, y + 14, 1, 2, '#14101c');
        rect(x + 46, y + 14, 1, 2, '#14101c');
        rect(x + 10, y + 8, 68, 2, '#cfd3dc'); // barbell
        for (const side of [-1, 1]) {
          for (const [at, h, color] of [[27, 16, '#c8342f'], [31, 13, '#2f6fd0'], [35, 9, '#e8c23a']]) {
            rect(x + 42 + side * at, y + 8 - h / 2, 5, h + 2, '#14101c');
            rect(x + 43 + side * at, y + 9 - h / 2, 3, h, color);
          }
        }
      },
    };

    Object.assign(SCENES, root.ArtMore.cards({ rect, line, path }));

    function event(id, x, y) {
      x = Math.round(x); y = Math.round(y);
      const { ctx } = view;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, EVENT_ART.w, EVENT_ART.h);
      ctx.clip();
      SCENES[id](x, y);
      ctx.restore();
    }

    // Three runners on the podium, centred on cx and standing on baseY.
    // size: {step, height, scale}: step width, winner step height and runner scale.
    function podium(cx, baseY, size, winner, now) {
      const { step, height, scale } = size;
      const others = ['BRA', 'JAM', 'ARG'].filter((id) => id !== winner);
      const places = [
        { place: '2', dx: -1, h: Math.round(height * 0.7), color: '#c9d1dc', country: others[0] },
        { place: '1', dx: 0, h: height, color: '#f9d56e', country: winner },
        { place: '3', dx: 1, h: Math.round(height * 0.5), color: '#d08a52', country: others[1] },
      ];
      // Confetti keeps falling over the whole podium.
      const tall = height + Math.round(66 * scale);
      const colors = ['#f9d56e', '#5be37d', '#e8505b', '#74acdf', '#f4f4f4'];
      for (let i = 0; i < 28; i++) {
        const fall = (i * 29 + (now / 40) * (1 + (i % 3) * 0.4)) % tall;
        const drift = Math.sin(now / 500 + i) * 3;
        rect(cx - step * 1.5 + ((i * 47) % (step * 3)) + drift, baseY - tall + fall, 2, 2, colors[i % colors.length]);
      }
      places.forEach((p, i) => {
        const x = Math.round(cx + p.dx * step - step / 2);
        rect(x, baseY - p.h, step - 1, p.h, p.color);
        rect(x, baseY - p.h, step - 1, 2, '#ffffff');
        text(p.place, x + step / 2, baseY - p.h + Math.max(3, Math.floor((p.h - 10) / 2)), '#14142a', 2, 'center');
        const look = {
          skin: ['#c98a5c', '#e0a070', '#8d5a3b'][i], hair: ['#6b3e1d', HAIR, '#0d0a08'][i],
          kit: Countries.byId(p.country).kit, name: '', number: p.place,
          country: p.country, headband: i === 1,
        };
        const sway = Math.sin(now / 700 + i * 2) * 0.3;
        avatar.draw(view.ctx, x + step / 2, baseY - p.h, scale, look,
          { speed: 0, cycle: 0, air: false }, Math.PI + sway);
      });
      rect(cx - step * 1.6, baseY, step * 3.2, 2, '#5a5a80');
    }

    return { event, podium };
  }

  root.Art = { createArt, EVENT_ART };
})(this);
