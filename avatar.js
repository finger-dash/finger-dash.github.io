// Runner model made of upright boxes. It can be viewed from any angle around the
// vertical axis, so every face stays a pixel-aligned rectangle.
(function (root) {
  'use strict';

  const WIDTH = 48, HEIGHT = 80;           // model units
  const FEET_X = 24, FEET_Y = 72;
  const OUTLINE = '#14101c';

  const shade = (hex, k) => {
    const v = parseInt(hex.slice(1), 16);
    const c = (s) => Math.round(((v >> s) & 255) * k);
    return `rgb(${c(16)},${c(8)},${c(0)})`;
  };

  // Boxes: x to the runner's right, y up, z forward. Sizes in model units.
  function build(look, pose) {
    const { kit } = look;
    const moving = pose.speed > 0.4, air = pose.air;
    const phase = moving ? Math.sin(pose.cycle * Math.PI) : 0;
    const bob = moving && !air ? Math.abs(Math.cos(pose.cycle * Math.PI)) * 2 : 0;
    const boxes = [];
    const add = (x, y, z, w, h, d, color, decals) => {
      const box = { x, y: y + bob, z, w, h, d, color, decals };
      boxes.push(box);
      return box;
    };

    for (const side of [-1, 1]) {
      let lift = Math.max(0, phase * side);
      let reach = -phase * side * 3;
      if (air) { lift = side < 0 ? 1 : 0.55; reach = side * 6; }
      const x = side * 5;
      add(x, 10 + lift * 5, reach * 0.4, 6, 12 - lift * 4, 6, look.skin);          // thigh
      add(x, 2 + lift * 12, reach - lift * 3, 6, 9 - lift * 3, 5, look.skin);      // shin
      add(x, lift * 13, reach - lift * 4, 8, 3 + (lift > 0.4 ? 2 : 0), 8, kit.shoe);
    }

    add(0, 21, 0, 20, 9, 10, kit.short);

    // Shirt: stripe on both sides, name and number on the back, flag on the chest.
    add(0, 30, 0, 19, 19, 10, kit.shirt, {
      back(d) {
        d.rect(6.5, 0, 6, 19, kit.stripe);
        if (look.name) {
          const w = look.name.length * 2 - 0.5;
          d.rect((19 - w) / 2 - 0.5, 1.5, w + 1, 3.5, kit.shirt);
          d.text(look.name, 9.5, 2, kit.ink, 0.5);
        }
        d.rect(5.5, 7, 8, 7, kit.shirt);
        d.text(look.number, 9.5, 8, kit.ink, 1);
      },
      front(d) {
        d.rect(6.5, 0, 6, 19, kit.stripe);
        if (look.country) d.flag(look.country, 6.5, 4, 6, 4);
      },
    });

    for (const side of [-1, 1]) {
      const swing = air ? 6 : -phase * side * -5;
      const raise = air ? 6 : Math.abs(swing) * 0.4;
      const x = side * 11.5;
      add(x, 42, 0, 4, 6, 5, kit.shirt);
      add(x + side * 0.5, 33 + raise * 0.5, swing * 0.5, 4, 10 - raise * 0.3, 4, look.skin);
      add(x + side, 30 + raise, swing, 4, 5, 4, look.skin);
    }

    add(0, 49, 0, 6, 3, 6, look.skin);
    add(0, 51.5, 0.5, 12, 10, 10, look.skin, {
      front(d) {
        d.rect(0, 0, 12, 2.5, look.hair);
        d.rect(2.5, 4, 2, 2, OUTLINE); d.rect(7.5, 4, 2, 2, OUTLINE);
        d.rect(4, 7.5, 4, 1, OUTLINE);
        if (look.headband) d.rect(0, 1.5, 12, 1.5, '#ffffff');
      },
      back(d) {
        d.rect(0, 0, 12, 8.5, look.hair);
        if (look.headband) d.rect(0, 2.5, 12, 2, '#ffffff');
      },
      left(d) {
        d.rect(0, 0, 10, 3.5, look.hair); d.rect(6, 0, 4, 8, look.hair);
        if (look.headband) d.rect(0, 2, 10, 1.5, '#ffffff');
      },
      right(d) {
        d.rect(0, 0, 10, 3.5, look.hair); d.rect(0, 0, 4, 8, look.hair);
        if (look.headband) d.rect(0, 2, 10, 1.5, '#ffffff');
      },
    });
    add(0, 61.5, 0.5, 12, 2, 10, look.hair);
    return boxes;
  }

  // Each face: outward normal and its two ends, ordered left to right as seen.
  const FACES = {
    back: { n: [0, -1], a: [-1, -1], b: [1, -1] },
    front: { n: [0, 1], a: [1, 1], b: [-1, 1] },
    right: { n: [1, 0], a: [1, -1], b: [1, 1] },
    left: { n: [-1, 0], a: [-1, 1], b: [-1, -1] },
  };

  // res: sprite pixels per model unit.
  function createAvatar(Countries, Font, RES = 2) {
    const sprite = document.createElement('canvas');
    sprite.width = WIDTH * RES; sprite.height = HEIGHT * RES;
    const g = sprite.getContext('2d');

    // Rectangle in model units, snapped to sprite pixels.
    function fill(x, y, w, h, color) {
      const x0 = Math.round(x * RES), y0 = Math.round(y * RES);
      g.fillStyle = color;
      g.fillRect(x0, y0, Math.round((x + w) * RES) - x0, Math.round((y + h) * RES) - y0);
    }

    // look: {kit, skin, hair, name, number, country, headband}
    // pose: {speed, cycle, air}; yaw 0 shows the back, PI the front.
    function paint(look, pose, yaw) {
      g.clearRect(0, 0, sprite.width, sprite.height);
      const cos = Math.cos(yaw), sin = Math.sin(yaw);
      const screenX = (x, z) => FEET_X + x * cos + z * sin;
      const depth = (x, z) => -x * sin + z * cos;
      const boxes = build(look, pose).sort((p, q) => depth(q.x, q.z) - depth(p.x, p.z));

      for (const box of boxes) {
        const top = FEET_Y - box.y - box.h;
        const half = (Math.abs(box.w * cos) + Math.abs(box.d * sin)) / 2;
        const centre = screenX(box.x, box.z);
        fill(centre - half - 0.5, top - 0.5, half * 2 + 1, box.h + 1, OUTLINE);

        for (const [name, face] of Object.entries(FACES)) {
          const facing = depth(face.n[0], face.n[1]); // negative: towards the camera
          if (facing > -0.02) continue;
          const end = (p) => screenX(box.x + (p[0] * box.w) / 2, box.z + (p[1] * box.d) / 2);
          const from = end(face.a), to = end(face.b);
          const span = Math.abs(face.n[0] ? box.d : box.w);
          const k = (to - from) / span;
          const light = 0.65 + 0.35 * -facing;
          fill(from, top, to - from, box.h, shade(box.color, light));

          const decal = box.decals && box.decals[name];
          if (!decal || k < 0.12) continue;
          const d = {
            rect: (u, v, w, h, color) => fill(from + u * k, top + v, w * k,
              Math.min(h, box.h - v), shade(color, light)),
            text(str, u, v, color, size) { // centred on u
              str = String(str);
              let cx = u - (str.length * 4 * size - size) / 2;
              for (const ch of str) {
                const glyph = Font.GLYPHS[ch];
                for (let p = 0; glyph && p < 15; p++) {
                  if (glyph[p] === '1') d.rect(cx + (p % 3) * size, v + Math.floor(p / 3) * size, size, size, color);
                }
                cx += 4 * size;
              }
            },
            flag(id, u, v, w, h) {
              Countries.byId(id).flag((x, y, fw, fh, color) =>
                d.rect(u + (x * w) / 24, v + (y * h) / 16, (fw * w) / 24, (fh * h) / 16, color));
            },
          };
          decal(d);
        }
      }
      return sprite;
    }

    // Paints the runner with its feet at (x, y) on the target context.
    function draw(ctx, x, y, scale, look, pose, yaw = 0) {
      paint(look, pose, yaw);
      ctx.drawImage(sprite, x - FEET_X * scale, y - FEET_Y * scale, WIDTH * scale, HEIGHT * scale);
    }

    return { draw };
  }

  const LOOKS = [ // skin and hair per lane
    { skin: '#e0a070', hair: '#111111' }, { skin: '#c98a5c', hair: '#6b3e1d' },
    { skin: '#e0a070', hair: '#3a2418' }, { skin: '#f0c090', hair: '#222222' },
    { skin: '#8d5a3b', hair: '#0d0a08' }, { skin: '#d99a6c', hair: '#c9a227' },
  ];

  function lookFor(runner, Countries) {
    return {
      ...LOOKS[runner.lane],
      kit: Countries.byId(runner.country).kit,
      name: runner.name === 'YOU' ? '' : runner.name,
      number: String(runner.isPlayer ? 10 : runner.lane + 1),
      country: runner.country,
      headband: runner.isPlayer,
    };
  }

  root.Avatar = { createAvatar, lookFor };
})(this);
