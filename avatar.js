// Runner model made of upright boxes. It can be viewed from any angle around the
// vertical axis, so every face stays a pixel-aligned rectangle.
(function (root) {
  'use strict';

  const WIDTH = 132, HEIGHT = 112;         // model units
  const FEET_X = 66, FEET_Y = 104;
  const OUTLINE = '#14101c';

  const shade = (hex, k) => {
    const v = parseInt(hex.slice(1), 16);
    const c = (s) => Math.round(((v >> s) & 255) * k);
    return `rgb(${c(16)},${c(8)},${c(0)})`;
  };

  // The colour `f` of the way to white.
  function tint(hex, f) {
    return '#' + [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
      .map((v) => Math.round(v + (255 - v) * f).toString(16).padStart(2, '0')).join('');
  }

  // Eyes and mouth; `mood` is strain, oh, happy, dazed or none.
  function face(d, mood) {
    for (const u of [2.5, 7.5]) {
      if (mood !== 'dazed') d.rect(u, 4, 2, 2, OUTLINE);
      else for (const [du, dv] of [[-0.5, -0.5], [1.5, -0.5], [0.5, 0.5], [-0.5, 1.5], [1.5, 1.5]]) d.rect(u + du, 4 + dv, 1, 1, OUTLINE);
    }
    if (mood === 'strain' || mood === 'happy') {
      d.rect(3.5, 7, 5, 2, OUTLINE);
      d.rect(4, mood === 'happy' ? 7 : 7.5, 4, 0.75, '#ffffff');
    } else if (mood === 'oh' || mood === 'dazed') d.rect(4.5, 7, 3, 2.5, OUTLINE);
    else d.rect(4, 7.5, 4, 1, OUTLINE);
  }

  // The cuff colour that stands out under a glove.
  function cuffColor(kit, glove) {
    return kit.shirt !== glove ? kit.shirt : '#f4f4f4';
  }

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
      if (pose.hold) { // shot putter's guard
        if (side > 0) { // elbow out, hand above the shoulder with the shot on it
          add(13, 43, 0, 7, 5, 5, look.kit.shirt);
          add(15.5, 46, 0, 4, 10, 4, look.skin);
          add(14.5, 55, 0, 6, 4, 5, look.skin);
          add(14.5, 58.5, 0, 9, 9, 9, '#8890a0').round = true;
        } else { // free arm stretched out for balance
          add(-12.5, 43, 0, 6, 5, 5, kit.shirt);
          add(-18, 43.5, 1, 6, 4, 4, look.skin);
        }
        continue;
      }
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
        face(d, look.face);
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

  // The athlete performing a move (see moves.js): upright boxes for the trunk and head,
  // jointed limbs between the given points, and the equipment of the event.
  function athlete(look, move) {
    const { kit } = look;
    const still = build(look, { speed: 0, cycle: 0, air: false });
    const items = [];
    const dy = move.lift, dx = move.sway, dz = move.lean;
    const up = ([x, y, z]) => [x, y + dy, z];
    // Trunk and head are the still model's, shifted.
    for (const box of still) {
      if (box.y < 20 || (Math.abs(box.x) > 9 && box.y < 50)) continue;
      const share = box.y < 29 ? 0.3 : box.y < 48 ? 0.75 : 1;
      const nod = share === 1 ? move.nod || 0 : 0;
      items.push({ ...box, x: box.x + dx * share + nod, y: box.y + dy, z: box.z + dz * share });
    }
    [-1, 1].forEach((side, i) => {
      const leg = move.legs[i], arm = move.arms[i];
      const hip = [side * 5 + dx * 0.3, 22 + dy, dz * 0.3];
      items.push({ chain: [hip, leg.knee, leg.foot], widths: [6, 5], colors: [look.skin, look.skin], bias: 1 });
      items.push({ x: leg.foot[0], y: leg.foot[1] - 2, z: leg.foot[2] + 1.5, w: 7, h: 4, d: 8, color: kit.shoe, bias: -4 });
      if (arm.hidden) return; // drawn by the screen, as it comes at the camera
      const shoulder = [side * 10.5 + dx * 0.75, 45.5 + dy, dz * 0.75];
      const elbow = up([arm.elbow[0] + dx * 0.4, arm.elbow[1], arm.elbow[2] + dz * 0.5]);
      const hand = up([arm.hand[0] + dx * 0.4, arm.hand[1], arm.hand[2] + dz * 0.5]);
      const sleeve = shoulder.map((v, k) => v + (elbow[k] - v) * 0.5);
      items.push({ chain: [shoulder, sleeve, elbow, hand], widths: [5.5, 4.5, 4], colors: [kit.shirt, look.skin, look.skin] });
      const size = move.gloves ? 10.5 : 5;
      if (move.gloves) {
        const color = move.glove || '#d52b1e';
        const wrist = hand.map((v, k) => v + (elbow[k] - v) * 0.5);
        items.push({ chain: [wrist, hand], widths: [6.5], colors: [cuffColor(kit, color)], bias: -1.5 });
        const r = size / 2, inward = -Math.sign(hand[0] || side);
        items.push({ x: hand[0], y: hand[1], z: hand[2], w: size, h: size, d: size, color, glove: r, bias: -9 });
        items.push({
          x: hand[0] + inward * r * 0.68, y: hand[1] - r * 0.28, z: hand[2] + 1.5, of: hand[0],
          w: r, h: r, d: r, color, thumb: r, bias: -10,
        });
      } else items.push({ x: hand[0], y: hand[1] - 2.5, z: hand[2], w: 4.5, h: 4.5, d: 4.5, color: look.skin, bias: -1 });
    });
    for (const p of move.props) {
      if (p.type === 'shot') items.push({ x: p.at[0], y: p.at[1] - 4.5, z: p.at[2], w: 9, h: 9, d: 9, color: '#8890a0', round: true, bias: -3 });
      if (p.type === 'hurdle') {
        for (const x of [-15, 15]) items.push({ chain: [[x, 1, p.z], [x, 19, p.z]], widths: [2], colors: ['#f4f4f4'] });
        for (let x = -15; x < 15; x += 6) items.push({ chain: [[x, 19, p.z], [x + 6, 19, p.z]], widths: [4], colors: [((x + 15) / 6) % 2 ? '#e8505b' : '#f4f4f4'], plain: true });
      }
      if (p.type === 'sand') for (let n = 0; n < 14; n++) {
        const a = n * 2.4, d = 6 + p.t * (10 + (n % 4) * 3);
        items.push({ x: Math.cos(a) * d, y: Math.max(0, Math.sin(p.t * Math.PI) * (5 + (n % 5) * 2)), z: 18 + Math.sin(a) * d * 0.6, w: 2.5, h: 2.5, d: 2.5, color: '#e8cf8a' });
      }
      if (p.type === 'bow') {
        const [x, y, z] = [p.grip[0], p.grip[1] + dy, p.grip[2] + 1];
        const limbTop = [[x, y, z], [x, y + 9, z], [x, y + 17, z - 5]], limbLow = [[x, y, z], [x, y - 9, z], [x, y - 17, z - 5]];
        items.push({ chain: limbTop, widths: [2.5, 1.8], colors: ['#c8202a', '#c8202a'], bias: -1 });
        items.push({ chain: limbLow, widths: [2.5, 1.8], colors: ['#c8202a', '#c8202a'], bias: -1 });
        const nock = p.nock ? [p.nock[0], p.nock[1] + dy, p.nock[2]] : [x, y, z - 5];
        items.push({ chain: [limbTop[2], nock, limbLow[2]], widths: [0.5, 0.5], colors: ['#e8ecf4', '#e8ecf4'], plain: true, bias: -2 });
        if (p.nock) items.push({ chain: [nock, [x, y + 0.5, z + 7]], widths: [1.2], colors: ['#d8b47a'], bias: -4 });
      }
      if (p.type === 'arrow') items.push({ chain: [p.from, p.to], widths: [1.4], colors: ['#d8b47a'] });
      if (p.type === 'barbell') {
        // `tilt` raises the end on the athlete's right, `sag` bends both ends down.
        const { at: [x, y, z], half = 27, tilt = 0, sag = 0 } = p;
        const height = (from) => y + (tilt * from) / half - sag * (from / half) ** 2;
        const end = half - 7; // the inner plates
        const points = Array.from({ length: 9 }, (_, i) => -end + (i * end) / 4);
        items.push({
          chain: points.map((from) => [x + from, height(from), z]),
          widths: points.slice(1).map(() => 1.8), colors: points.slice(1).map(() => '#cfd3dc'), bias: -2,
        });
        for (const side of [-1, 1]) {
          for (const [at, r, color] of [[7, 10, '#c8342f'], [3.5, 8, '#2f6fd0'], [0.5, 5.5, '#e8c23a']]) {
            const from = side * (half - at);
            items.push({ disc: [x + from, height(from), z], r, color, bias: -2.6 });
          }
        }
      }
    }
    return items;
  }

  // Each face: outward normal and its two ends, ordered left to right as seen.
  const FACES = {
    back: { n: [0, -1], a: [-1, -1], b: [1, -1] },
    front: { n: [0, 1], a: [1, 1], b: [-1, 1] },
    right: { n: [1, 0], a: [1, -1], b: [1, 1] },
    left: { n: [-1, 0], a: [-1, 1], b: [-1, -1] },
  };

  // The round and jointed parts, painted through `fill` with pixels of size `px`.
  function painter(fill, px) {
    // A ball: same look from every angle.
    function ball(cx, top, size, color) {
      const r = size / 2, cy = top + r;
      for (let v = -r - 0.5; v < r + 0.5; v += px) {
        const mid = v + px / 2;
        const outer = Math.sqrt(Math.max(0, (r + 0.5) ** 2 - mid ** 2));
        fill(cx - outer, cy + v, outer * 2, px, OUTLINE);
        const inner = Math.sqrt(Math.max(0, r ** 2 - mid ** 2));
        if (inner) fill(cx - inner, cy + v, inner * 2, px, shade(color, mid > r * 0.35 ? 0.72 : 1));
      }
      fill(cx - r * 0.5, cy - r * 0.55, r * 0.45, r * 0.45, '#e8ecf4');
    }

    // A jointed limb: thick lines through projected points, one outline around all.
    function chain(points, widths, colors, plain) {
      for (const pass of plain ? [1] : [0, 1]) {
        for (let i = 0; i + 1 < points.length; i++) {
          const [a, b] = [points[i], points[i + 1]], w = widths[i];
          const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / px));
          for (let j = 0; j <= n; j++) {
            const x = a[0] + ((b[0] - a[0]) * j) / n, y = a[1] + ((b[1] - a[1]) * j) / n;
            if (pass) fill(x - w / 2, y - w / 2, w, w, colors[i]);
            else fill(x - w / 2 - 0.5, y - w / 2 - 0.5, w + 1, w + 1, OUTLINE);
          }
        }
      }
    }

    // A weight plate: `face` is half the width of its round side as seen and `thick`
    // the width of its edge, so head-on it is a slab and sideways a disc.
    function plate(cx, cy, face, thick, r, color) {
      for (let v = -r - 0.5; v < r + 0.5; v += px) {
        const mid = v + px / 2;
        const across = (radius) => face * Math.sqrt(Math.max(0, 1 - (mid / radius) ** 2)) + thick / 2;
        const corner = Math.abs(mid) > r - 0.5 ? 0.5 : 0;
        const outer = across(r + 0.5) + 0.5 - corner;
        fill(cx - outer, cy + v, outer * 2, px, OUTLINE);
        if (Math.abs(mid) >= r) continue;
        const inner = across(r) - corner;
        fill(cx - inner, cy + v, inner * 2, px, shade(color, mid > r * 0.45 ? 0.75 : 1));
        if (Math.abs(mid) < r * 0.75) fill(cx - inner, cy + v, Math.min(0.75, inner), px, tint(color, 0.3));
      }
    }

    // A rectangle with notched corners.
    function notched(x, y, w, h, notch, color, grow) {
      fill(x - w / 2 - grow, y - h / 2 - grow + notch, w + grow * 2, h + grow * 2 - notch * 2, color);
      fill(x - w / 2 - grow + notch, y - h / 2 - grow, w + grow * 2 - notch * 2, h + grow * 2, color);
    }

    // A boxing glove of radius `r`: a block with notched corners.
    function glove(x, y, r, color) {
      const notch = r * 0.28;
      notched(x, y, r * 2, r * 1.85, notch, OUTLINE, 0.5);
      notched(x, y, r * 2, r * 1.85, notch, color, 0);
      fill(x - r + notch, y + r * 0.45, r * 2 - notch * 2, r * 0.47, shade(color, 0.74));
      fill(x - r * 0.62, y - r * 0.66, r * 0.42, r * 0.3, tint(color, 0.45));
    }

    // Its thumb, a smaller block on the inner side; `edge` is the side it shades.
    function thumb(x, y, r, color, edge) {
      const w = r * 0.68, h = r * 0.84;
      fill(x - w / 2 - 0.5, y - h / 2 - 0.5, w + 1, h + 1, OUTLINE);
      fill(x - w / 2, y - h / 2, w, h, color);
      fill(edge < 0 ? x - w / 2 : x + w / 2 - w * 0.24, y - h / 2, w * 0.24, h, shade(color, 0.76));
    }

    return { ball, chain, plate, glove, thumb };
  }

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

    const { ball, chain, plate, glove, thumb } = painter(fill, 1 / RES);

    // look: {kit, skin, hair, name, number, country, headband}
    // pose: {speed, cycle, air, hold} or {move}; yaw 0 shows the back, PI the front.
    function paint(look, pose, yaw) {
      g.clearRect(0, 0, sprite.width, sprite.height);
      if (pose.move) yaw += pose.move.spin;
      const cos = Math.cos(yaw), sin = Math.sin(yaw);
      const screenX = (x, z) => FEET_X + x * cos + z * sin;
      const depth = (x, z) => -x * sin + z * cos;
      const far = (item) => (item.bias || 0) * 0.5 + (item.chain
        ? item.chain.reduce((sum, p) => sum + depth(p[0], p[2]), 0) / item.chain.length
        : item.disc ? depth(item.disc[0], item.disc[2]) : depth(item.x, item.z));
      const boxes = (pose.move ? athlete(look, pose.move) : build(look, pose)).sort((p, q) => far(q) - far(p));

      for (const box of boxes) {
        if (box.chain) {
          chain(box.chain.map(([x, y, z]) => [screenX(x, z), FEET_Y - y]), box.widths, box.colors, box.plain);
          continue;
        }
        if (box.disc) {
          const [x, y, z] = box.disc;
          plate(screenX(x, z), FEET_Y - y, box.r * Math.abs(sin), 3 * Math.abs(cos), box.r, box.color);
          continue;
        }
        const top = FEET_Y - box.y - box.h;
        const half = (Math.abs(box.w * cos) + Math.abs(box.d * sin)) / 2;
        const centre = screenX(box.x, box.z);
        if (box.glove) {
          glove(centre, FEET_Y - box.y, box.glove, box.color);
          continue;
        }
        if (box.thumb) {
          thumb(centre, FEET_Y - box.y, box.thumb, box.color, centre < screenX(box.of, box.z) ? 1 : -1);
          continue;
        }
        if (box.round) {
          ball(centre, top, box.w, box.color);
          continue;
        }
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

    // The same limbs painted straight on a context, for the ones that come
    // close to the camera. Coordinates are the context's; `unit` is the model scale.
    function parts(ctx, unit, res) {
      const snap = (v) => Math.round(v * res) / res; // whole screen pixels
      const flat = painter((x, y, w, h, color) => {
        const left = snap(x * unit), top = snap(y * unit);
        ctx.fillStyle = color;
        ctx.fillRect(left, top, snap((x + w) * unit) - left, snap((y + h) * unit) - top);
      }, 1 / (res * unit));
      const down = (v) => v / unit;
      return {
        chain: (points, widths, colors) => flat.chain(points.map((p) => p.map(down)), widths.map(down), colors),
      };
    }

    return { draw, parts };
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

  root.Avatar = { createAvatar, lookFor, cuffColor };
})(this);
