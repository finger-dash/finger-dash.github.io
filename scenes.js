// What the newer events look like: one drawing function per event, with its own
// gauges. The rules live in rules-*.js.
(function (root) {
  'use strict';

  const SKINS = [['#e0a070', '#3a2418'], ['#c98a5c', '#6b3e1d'], ['#e0a070', '#111111'],
    ['#f0c090', '#222222'], ['#8d5a3b', '#0d0a08'], ['#d99a6c', '#c9a227']];
  const SIDE = Math.PI / 2;   // yaw of an athlete heading right
  const FRONT = Math.PI;
  const TAU = Math.PI * 2;

  function create({ view, avatar }) {
    const { ctx, rect, text } = view;
    const { kinds } = Poses;
    const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
    const lerp = (a, b, t) => a + (b - a) * t;

    // Sizes that depend on the screen.
    function stage() {
      const { w, h, horizon, portrait, top, bottom } = view.layout;
      const scale = portrait ? 1.25 : 1;
      return {
        w, h, top, bottom, portrait, horizon, scale, ppm: 40 * scale,
        ground: portrait ? Math.round(h * 0.72) : 142,
        hud: top + 24, // first free row under the HUD
      };
    }

    // ---------- Drawing helpers ----------

    function line(x0, y0, x1, y1, size, color) {
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let i = 0; i <= steps; i++) {
        rect(x0 + ((x1 - x0) * i) / steps - size / 2, y0 + ((y1 - y0) * i) / steps - size / 2, size, size, color);
      }
    }
    function disc(cx, cy, r, color) {
      for (let dy = -r; dy < r; dy++) {
        const half = Math.round(Math.sqrt(r * r - (dy + 0.5) ** 2));
        rect(cx - half, cy + dy, half * 2, 1, color);
      }
    }
    function poly(points, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      points.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](Math.round(x), Math.round(y)));
      ctx.closePath();
      ctx.fill();
    }
    function shade(x, y, w, h, alpha = 0.72) {
      ctx.globalAlpha = alpha;
      rect(x, y, w, h, '#10101c');
      ctx.globalAlpha = 1;
    }
    const wrap = (v, size) => ((v % size) + size) % size;

    // Sky with stands down to `base`, scrolled by `scroll` pixels.
    function outdoors(base, scroll = 0) {
      const { w, h } = stage();
      rect(0, 0, w, Math.max(0, base * 0.55), '#3b6fd4');
      rect(0, base * 0.55, w, Math.max(0, h - base * 0.55), '#6fa8ee');
      for (let i = -1; i < w / 16 + 1; i++) {
        const n = i + Math.floor(scroll / 16);
        const x = i * 16 - wrap(scroll, 16), tall = 24 + wrap(n * 7, 13);
        rect(x, base - tall, 16, tall, n % 2 ? '#51669c' : '#44588a');
        for (let k = 0; k < 8; k++) {
          rect(x + 2 + wrap(k * 5 + n * 3, 12), base - tall + 3 + wrap(k * 7 + n, tall - 6), 2, 2,
            ['#f9d56e', '#f4f4f4', '#e8505b', '#5be37d'][wrap(n + k, 4)]);
        }
      }
    }
    function indoors(base) {
      const { w, h } = stage();
      rect(0, 0, w, h, '#241b38');
      for (let i = 0; i < 160; i++) rect(wrap(i * 37, w), wrap(i * 23, Math.max(10, base - 8)), 2, 2, '#56407a');
    }
    // Ripples on water between two heights, sliding with `scroll`.
    function water(from, to, scroll = 0) {
      const { w } = stage();
      rect(0, from, w, to - from, '#2b7fc9');
      for (let i = 0; i < (to - from) * w / 700; i++) {
        rect(wrap(i * 53 - scroll * (0.4 + (i % 3) * 0.3), w + 12) - 12, from + 2 + wrap(i * 17, Math.max(1, to - from - 4)), 7, 1, '#8fd0f4');
      }
    }

    let touching = true;
    // Prompts name the finger gesture on phones and the key on computers.
    const say = (finger, key) => (touching ? finger : key);

    const looks = new Map();
    function lookOf(a, i) {
      const key = `${a.country}${i}${a.name}`;
      if (!looks.has(key)) {
        looks.set(key, {
          skin: SKINS[i % 6][0], hair: SKINS[i % 6][1], kit: Countries.byId(a.country).kit,
          name: a.name === 'YOU' ? '' : a.name, number: String(a.isPlayer ? 10 : i + 1),
          country: a.country, headband: a.isPlayer,
        });
      }
      return looks.get(key);
    }
    const person = (look, move, x, y, scale, yaw = SIDE) =>
      avatar.draw(ctx, x, y, scale, look, { move }, yaw);

    // A gauge: label, bar filled to `value` and an optional sweet range.
    function gauge(label, value, x, y, w, good, color = '#f9d56e') {
      shade(x - 3, y - 9, w + 6, 19);
      text(label, x, y - 7, '#fff');
      rect(x, y, w, 6, '#333');
      if (good) rect(x + good[0] * w, y, (good[1] - good[0]) * w, 6, '#1f6f3a');
      const inside = good && value >= good[0] && value <= good[1];
      rect(x, y + 1, clamp(value) * w, 4, inside ? '#5be37d' : color);
    }
    // A marker that moves along a bar from -1 to 1, with a target.
    function needle(label, value, x, y, w, target = null) {
      shade(x - 3, y - 9, w + 6, 20);
      text(label, x + w / 2, y - 7, '#fff', 1, 'center');
      rect(x, y + 2, w, 3, '#333');
      rect(x + w / 2, y, 1, 7, '#9ab');
      if (target !== null) rect(x + ((clamp(target, -1, 1) + 1) / 2) * w - 4, y, 9, 7, '#1f6f3a');
      rect(x + ((clamp(value, -1, 1) + 1) / 2) * w - 1, y - 1, 3, 9, '#f9d56e');
    }
    // Gauges stack at the bottom of the screen; slot 0 is the lowest.
    function slot(n = 0, width = null) {
      const { w, h, bottom, portrait } = stage();
      const size = width || (portrait ? 150 : 110);
      return [portrait ? Math.round((w - size) / 2) : w - size - 8, h - bottom - 12 - n * 23, size];
    }
    function banner(str, color, size = 2, dy = 0) {
      const { w, horizon, portrait } = stage();
      text(str, w / 2, (portrait ? horizon - 14 : 40) + dy, color, size, 'center');
    }
    function arrow(dir, x, y, color) {
      const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      line(x - dx * 14, y - dy * 14, x + dx * 14, y + dy * 14, 5, color);
      for (const side of [-1, 1]) line(x + dx * 15, y + dy * 15, x + dx * 4 + dy * 10 * side, y + dy * 4 + dx * 10 * side, 5, color);
    }

    // Where everybody is in a race.
    function course(m, distance) {
      const { w, hud, portrait } = stage();
      const x = portrait ? 8 : 90, y = hud + (portrait ? 22 : -14), len = portrait ? w - 16 : w - 180;
      shade(x - 4, y - 7, len + 8, 17);
      rect(x, y + 3, len, 1, '#9ab');
      rect(x + len, y - 2, 2, 10, '#fff');
      for (let i = m.athletes.length - 1; i >= 0; i--) {
        const a = m.athletes[i];
        const s = a.isPlayer ? m.state.s : a.plan[0] ? RaceRules.along(distance, a.plan[0], m.state.time) : 0;
        const px = x + (s / distance) * len;
        Countries.drawFlag(ctx, a.country, px - 5, y + (a.isPlayer ? -3 : 0), 10.5, 7);
        if (a.isPlayer) rect(px - 1, y + 5, 3, 3, '#f9d56e');
      }
    }
    const ahead = (m, i, distance) => RaceRules.along(distance, m.athletes[i].plan[0], m.state.time);

    // A track seen from the side, with metre marks; returns x of a position.
    // `deep` is how far the track reaches behind the athlete.
    function track(s, anchor = 0.34, color = '#cf5a3c', deep = 34) {
      const { w, h, ground, ppm } = stage();
      const left = w * anchor;
      const at = (metres) => left + (metres - s) * ppm;
      outdoors(ground - deep, s * ppm * 0.35);
      rect(0, ground - deep, w, h - ground + deep, color);
      const lanes = deep > 34 ? [-deep, -56, -32, -8, 16] : [-34, -20, -3, 16];
      for (const dy of lanes) rect(0, ground + dy, w, 1, '#f3e9dc');
      for (let m = Math.floor((s - 8) / 5) * 5; m < s + w / ppm + 5; m += 5) {
        if (m < 0) continue;
        rect(at(m), ground + 17, 1, 4, '#f3e9dc');
        text(`${m}`, at(m), ground + 24, '#f3e9dc', 1, 'center');
      }
      return at;
    }

    // ---------- Races ----------

    function sprint100(m, look) {
      const s = m.state, { scale, ground, w } = stage();
      const at = track(s.s, 0.34, '#cf5a3c', 82);
      rect(at(100), ground - 82, 3, 98, '#fff');
      for (const [i, lane] of [[1, -64], [2, -42], [3, -20]]) {
        const x = at(ahead(m, i, 100));
        if (x > -40 && x < w + 40) {
          person(lookOf(m.athletes[i], i), kinds.run(ahead(m, i, 100) * 0.34 + i), x, ground + lane, scale * (0.62 + i * 0.07));
        }
      }
      const move = s.speed < 0.4 ? kinds.run(0, 0) : kinds.run(s.cycle);
      if (s.dipped) move.lean = 12;
      person(look, move, at(s.s), ground + 6, scale);
      course(m, 100);
      if (!s.dipped && s.s > 92) banner(say('FLICK UP: DIP!', 'SPACE: DIP!'), '#f9d56e');
    }

    function swimming(m, look) {
      const s = m.state, { w, h, ground, scale, horizon } = stage();
      const surface = ground - 20, ppm = 30 * scale;
      const at = (metres) => w * 0.4 + (metres - s.s) * ppm;
      outdoors(horizon + 10, s.s * 8);
      water(horizon + 10, h, s.s * ppm);
      const rope = (y) => {
        for (let x = -wrap(s.s * ppm, 12); x < w; x += 12) rect(x, y, 8, 3, '#e8505b');
        for (let x = 8 - wrap(s.s * ppm, 12); x < w; x += 12) rect(x, y, 4, 3, '#f4f4f4');
      };
      const swimmer = (who, metres, y, size, arms, breathing) => {
        const x = at(metres), move = kinds.swim(arms, breathing);
        person(who, move, x, y + 34 * size, size); // the middle of the body at the surface
        ctx.globalAlpha = 0.55;
        rect(x - 44 * size, y + 2, 88 * size, 14 * size, '#2b7fc9');
        ctx.globalAlpha = 1;
        for (let i = 0; i < 6; i++) rect(x - (34 + wrap(metres * 31 + i * 9, 22)) * size, y - 4 + wrap(i * 7 + metres * 11, 9), 2, 2, '#e8f8ff');
      };
      rope(surface - 52);
      for (const [i, dy] of [[1, -70], [2, -32]]) {
        const metres = ahead(m, i, 100);
        swimmer(lookOf(m.athletes[i], i), metres, surface + dy, scale * 0.6, metres * 0.45, 0);
      }
      rope(surface - 18);
      swimmer(look, s.s, surface + 12, scale, s.arms * 0.5 + s.time * 0.1, s.breathing);
      rope(surface + 44);
      for (const wall of [0, 50]) {
        const here = wall === 50 ? (s.turned ? null : 50) : s.turned ? 100 : 0;
        if (here !== null) rect(at(here) + (wall === 50 ? 30 : 0), horizon + 10, 5, h, '#c9c9d6');
      }
      course(m, 100);
      gauge(say('AIR - TILT TO BREATHE', 'AIR - ARROWS: BREATHE'), s.air, ...slot(0), null, s.air < 0.3 ? '#e8505b' : '#74acdf');
      if (!s.turned && s.s > 44) banner(say('FLICK UP: TURN!', 'SPACE: TURN!'), '#f9d56e');
      else if (s.air < 0.2) banner('BREATHE!', '#e8505b');
    }

    function boat(x, y, size, color) {
      poly([[x - 42 * size, y - 4 * size], [x - 26 * size, y + 6 * size], [x + 28 * size, y + 6 * size], [x + 46 * size, y - 4 * size]], '#14101c');
      poly([[x - 39 * size, y - 3 * size], [x - 25 * size, y + 4 * size], [x + 27 * size, y + 4 * size], [x + 43 * size, y - 3 * size]], color);
    }

    function rowing(m, look) {
      const s = m.state, { w, h, ground, scale, horizon } = stage();
      outdoors(horizon + 14, s.s * 6);
      water(horizon + 14, h, s.s * 24);
      const k = s.stroke < 0.4 ? s.stroke / 0.4 : Math.max(0, 1 - (s.stroke - 0.4) / 0.6);
      const crew = (who, x, y, size, pull) => {
        person(who, kinds.row(pull), x, y + 8 * size, size, -SIDE);
        boat(x, y, size, '#a9743f');
      };
      for (const [i, y] of [[1, horizon + 40], [2, (horizon + ground) / 2 + 14]]) {
        const x = w / 2 + (ahead(m, i, 200) - s.s) * 9;
        if (x > -60 && x < w + 60) crew(lookOf(m.athletes[i], i), x, y, scale * 0.55, 0.5 - 0.5 * Math.cos((s.time / 1.15) * TAU));
      }
      crew(look, w / 2, ground + 6, scale, k);
      course(m, 200);
      // The beat comes in from both sides and meets in the middle.
      const [x, y, size] = slot(0);
      const to = 1 - wrap(s.clock / 1.15, 1);
      shade(x - 3, y - 9, size + 6, 20);
      text('PULL ON THE BEAT', x + size / 2, y - 7, '#fff', 1, 'center');
      rect(x + size / 2 - 5, y, 11, 8, to < 0.12 || to > 0.88 ? '#5be37d' : '#1f6f3a');
      for (const side of [-1, 1]) rect(x + size / 2 + side * to * (size / 2 - 2) - 1, y, 3, 8, '#f9d56e');
    }

    function bike(who, x, y, size, turn) {
      for (const dx of [-24, 24]) {
        disc(x + dx * size, y - 13 * size, Math.round(13 * size), '#f4f4f4');
        disc(x + dx * size, y - 13 * size, Math.round(11 * size), '#2a2140');
        for (let i = 0; i < 3; i++) {
          const a = turn * 4 + (i * Math.PI) / 3;
          line(x + (dx - Math.cos(a) * 10) * size, y - (13 - Math.sin(a) * 10) * size,
            x + (dx + Math.cos(a) * 10) * size, y - (13 + Math.sin(a) * 10) * size, 0.7, '#778');
        }
      }
      const p = (a, b) => [x + a * size, y - b * size];
      for (const [a, b] of [[p(-24, 13), p(-6, 27)], [p(-6, 27), p(14, 27)], [p(14, 27), p(24, 13)], [p(-2, 13), p(-6, 27)], [p(-2, 13), p(14, 27)], [p(-24, 13), p(-2, 13)]]) {
        line(...a, ...b, 2.5 * size, who.kit.stripe === who.kit.shirt ? who.kit.short : '#e8505b');
      }
      person(who, kinds.cycle(turn), x - 3 * size, y - 5 * size, size);
    }

    function cycling(m, look) {
      const s = m.state, { w, h, ground, scale, horizon } = stage();
      indoors(horizon + 10);
      const far = horizon + 18;
      rect(0, far, w, h - far, '#a9743f');
      for (let x = -wrap(s.s * 22, 28); x < w + 40; x += 28) line(x, far, x - 36, h, 0.8, '#8a5a2b');
      rect(0, far + 6, w, 2, '#2b62c9');
      rect(0, ground + 20, w, 2, '#e8505b');
      const row = (lane) => ground - 20 + lane * 24;
      const all = [1, 2, 3, 4, 5].map((i) => ({ i, lane: [-1, 0, 1][(i - 1) % 3], x: w * 0.4 + (ahead(m, i, 500) - s.s) * 14 }));
      all.push({ me: true, lane: s.x, x: w * 0.4 });
      for (const r of all.sort((a, b) => a.lane - b.lane)) {
        if (r.x < -60 || r.x > w + 60) continue;
        const size = scale * (0.8 + r.lane * 0.1);
        if (r.me) {
          if (s.draft) for (let i = 0; i < 6; i++) rect(r.x + 36 + wrap(i * 13 - s.time * 90, 34), row(r.lane) - 40 + i * 6, 9, 1, '#fff');
          bike(look, r.x, row(r.lane), size, s.s * 0.4);
          rect(r.x - 3, row(r.lane) + 4, 7, 3, '#f9d56e');
        } else bike(lookOf(m.athletes[r.i], r.i), r.x, row(r.lane), size, ahead(m, r.i, 500) * 0.4);
      }
      course(m, 500);
      gauge('PEDALLING', s.power, ...slot(1));
      gauge('LEGS', s.legs, ...slot(0), null, s.legs < 0.3 ? '#e8505b' : '#74acdf');
      if (s.draft) banner('SLIPSTREAM!', '#5be37d');
    }

    function climbing(m, look) {
      const s = m.state, { w, h, ground, scale } = stage();
      const ppm = 62 * scale;
      const camera = Math.max(0, s.y - 0.4);
      const at = (metres) => ground - (metres - camera) * ppm;
      outdoors(at(0) - 4);
      rect(0, at(0), w, h, '#3f9e45');
      const wall = Math.min(w - 20, 150), x0 = (w - wall) / 2;
      rect(x0, Math.max(0, at(15.6)), wall, at(0) - Math.max(0, at(15.6)), '#b8683c');
      for (let i = 0; i < 90; i++) rect(x0 + wrap(i * 41, wall - 4), at(wrap(i * 1.7, 15.4)), 3, 2, '#9a5230');
      rect(x0, at(15), wall, 4, '#f9d56e');
      // One hold per move, at the height the hands reach.
      s.holds.forEach((need, i) => {
        const y = at((i / 30) * 15 + 1.75);
        if (y < -10 || y > h + 10) return;
        const next = i === s.next;
        for (const side of need === 'both' ? [-1, 1] : [need === 'left' ? -1 : 1]) {
          const x = w / 2 + side * 26 * scale;
          if (next) disc(x, y, 9, Math.floor(s.time * 8) % 2 ? '#ffffff' : '#f9d56e');
          disc(x, y, next ? 6 : 4, i < s.next ? '#7a5a34' : need === 'both' ? '#e8505b' : '#5be37d');
        }
      });
      person(look, kinds.climb(s.next + (s.slip > 0 ? 0.3 : 0)), w / 2, at(s.y), scale, 0);
      course(m, 15);
      const need = s.holds[s.next];
      if (need) {
        const [x, y, size] = slot(0);
        shade(x - 3, y - 9, size + 6, 20);
        text(need === 'both' ? say('BOTH SIDES TOGETHER!', 'PRESS SPACE!')
          : say(`TAP ${need.toUpperCase()}`, `PRESS ${need === 'left' ? 'A' : 'L'}`), x + size / 2, y - 2,
          need === 'both' ? '#e8505b' : '#5be37d', 1, 'center');
      }
    }

    function canoe(m, look) {
      const s = m.state, { w, h, ground, scale } = stage();
      const ppm = 17 * scale, river = Math.min(w * 0.86, 190), centre = w / 2, mine = ground;
      const across = (x) => centre + x * (river / 2 - 16);
      rect(0, 0, w, h, '#3f9e45');
      for (let i = 0; i < 60; i++) {
        const y = wrap(i * 47 + s.s * ppm, h + 10) - 5;
        disc(i % 2 ? wrap(i * 13, (w - river) / 2 + 1) : w - wrap(i * 13, (w - river) / 2 + 1), y, 4, '#2c7a33');
      }
      rect(centre - river / 2, 0, river, h, '#2b7fc9');
      for (let i = 0; i < 70; i++) {
        rect(centre - river / 2 + wrap(i * 37, river - 8), wrap(i * 29 + s.s * ppm * 1.1, h), 2, 7, '#8fd0f4');
      }
      for (const g of s.gates) {
        const y = mine - (g.at - s.s) * ppm;
        if (y < -10 || y > h + 10) continue;
        const color = g.passed === null ? '#1f9d45' : g.passed ? '#5be37d' : '#e8505b';
        for (const side of [-1, 1]) {
          const x = across(g.x) + side * 24;
          disc(x, y, 6, '#14101c'); disc(x, y, 5, color); disc(x, y, 2, '#f4f4f4');
        }
        for (let d = -17; d <= 17; d += 6) rect(across(g.x) + d, y, 3, 1, color);
      }
      const y = mine - (150 - s.s) * ppm;
      if (y > -10) for (let x = 0; x < river; x += 12) rect(centre - river / 2 + x, y, 6, 4, '#fff');
      const x = across(s.x);
      poly([[x, mine - 30], [x + 10, mine - 8], [x + 8, mine + 18], [x, mine + 28], [x - 8, mine + 18], [x - 10, mine - 8]], '#14101c');
      poly([[x, mine - 27], [x + 8, mine - 7], [x + 6, mine + 17], [x, mine + 25], [x - 6, mine + 17], [x - 8, mine - 7]], '#f9d71c');
      const dip = s.paddle > 0 ? (s.last === 'left' ? -1 : 1) : 0;
      line(x - 24, mine + dip * -7, x + 24, mine + dip * 7, 2, '#222');
      for (const side of [-1, 1]) disc(x + side * 25, mine + side * dip * 7, 4, '#e8505b');
      if (dip) disc(x + dip * 29, mine + 9, 3, '#e8f8ff');
      disc(x, mine + 2, 7, look.kit.shirt); disc(x, mine - 1, 5, look.kit.stripe === look.kit.shirt ? look.kit.short : look.kit.stripe);
      course(m, 150);
    }

    // ---------- Field ----------

    function flying(s, kind) {
      const { w, h, ground, horizon } = stage();
      const p = clamp(s.time / 1.8), { mark } = s.flight;
      const metres = mark * p, tall = (ground - horizon + 10) * Math.sin(Math.PI * p);
      const at = (d) => w * 0.45 + (d - metres) * 14;
      outdoors(ground - 34, metres * 6);
      rect(0, ground - 34, w, h, '#3f9e45');
      for (let d = Math.floor(metres / 10) * 10 - 30; d < metres + 40; d += 10) {
        if (d < 0) continue;
        rect(at(d), ground - 8, 1, 22, '#f4f4f4');
        text(`${d}`, at(d), ground + 18, '#fff', 1, 'center');
      }
      const x = w * 0.45, y = ground - 6 - tall;
      if (kind === 'javelin') {
        const angle = Math.cos(Math.PI * p) * 0.6;
        const dx = Math.cos(angle) * 26, dy = -Math.sin(angle) * 26;
        line(x - dx, y - dy, x + dx, y + dy, 2, '#f4f4f4');
        rect(x + dx - 2, y + dy - 2, 4, 4, '#f9d56e');
      } else {
        if (kind === 'hammer') line(x - 16, y + 6, x, y, 1, '#cfd3dc');
        disc(x, y, 6, '#14101c'); disc(x, y, 5, '#c9d1dc');
      }
      if (!s.foul && !s.done) text(`${metres.toFixed(1)} M`, w / 2, horizon - 20, '#fff', 2, 'center');
    }

    function angleDial(angle, best, show) {
      const { portrait, h } = stage();
      const r = portrait ? 46 : 42, x = 14, y = portrait ? h - 40 : h - 12;
      shade(x - 8, y - r - 16, r + 22, r + 22);
      text('ANGLE', x - 4, y - r - 12, '#fff');
      for (let a = 0; a <= 60; a += 3) {
        const good = show && Math.abs(a - best) <= 6;
        const rad = (a * Math.PI) / 180;
        rect(x + Math.cos(rad) * r - 1, y - Math.sin(rad) * r - 1, good ? 4 : 2, good ? 4 : 2, good ? '#5be37d' : '#9ab');
      }
      const rad = (angle * Math.PI) / 180;
      line(x, y, x + Math.cos(rad) * (r - 5), y - Math.sin(rad) * (r - 5), 2, '#f9d56e');
      text(`${Math.round(angle)}`, x + r * 0.6, y - 5, '#fff', 2);
    }

    function javelin(m, look) {
      const s = m.state, spec = m.spec, { ground, scale, w } = stage();
      if (s.phase === 'flight') return flying(s, 'javelin');
      const at = track(s.s, 0.4);
      rect(at(spec.LINE), ground - 18, 3, 36, '#e8505b');
      rect(at(spec.LINE) + 3, ground - 34, w, 50, '#3f9e45');
      rect(at(spec.LINE - spec.ARM_ZONE), ground - 3, 3, 6, '#f9d56e');
      const move = s.phase === 'armed' ? kinds.javelin(s.cycle, 1, 0, s.angle)
        : s.speed < 0.4 ? kinds.javelin(0, 0, 0, 8) : kinds.javelin(s.cycle, 0, 0, 8);
      person(look, move, at(s.s), ground + 6, scale);
      if (s.phase === 'armed') {
        angleDial(s.angle, spec.BEST_THROW, m.level.name !== 'hard');
        banner(say('LIFT TO THROW!', 'RELEASE TO THROW!'), '#f9d56e');
      } else if (s.s > spec.LINE - spec.ARM_ZONE) banner(say('HOLD A FINGER STILL', 'HOLD SPACE'), '#f9d56e');
      return null;
    }

    // Seen from above: where the thrower is facing and the sector to throw into.
    function compass(s, sector) {
      const { portrait, w } = stage();
      const r = portrait ? 32 : 26, x = portrait ? w / 2 : w - r - 14, y = stage().hud + r + (portrait ? 14 : 4);
      shade(x - r - 6, y - r - 6, r * 2 + 12, r * 2 + 12);
      for (let a = -sector; a <= sector; a += 0.06) line(x + Math.sin(a) * (r - 7), y - Math.cos(a) * (r - 7), x + Math.sin(a) * r, y - Math.cos(a) * r, 2, '#1f9d45');
      for (let a = 0; a < TAU; a += 0.25) rect(x + Math.sin(a) * r, y - Math.cos(a) * r, 2, 2, '#9ab');
      const inside = Math.abs(FieldRules.aimError(s.turn)) <= sector;
      line(x, y, x + Math.sin(s.turn) * (r - 4), y - Math.cos(s.turn) * (r - 4), 3, inside ? '#5be37d' : '#f9d56e');
    }

    function thrower(m, look, kind) {
      const s = m.state, { ground, scale, w, h } = stage();
      if (s.phase === 'flight' && s.time > 0.35 && !s.foul) return flying(s, kind);
      outdoors(ground - 44);
      rect(0, ground - 44, w, h, '#3f9e45');
      disc(w / 2, ground + 2, Math.round(10 * scale), '#c9c9d6');
      rect(w / 2 - 38 * scale, ground - 2, 76 * scale, 8, '#c9c9d6');
      const move = kinds[kind](0, s.phase === 'flight' ? 1 : 0);
      person(look, move, w / 2, ground + 4, scale * 1.15, SIDE + s.turn);
      if (s.phase === 'spin') {
        for (let i = 0; i < s.rate * 22; i++) {
          const a = s.turn - i * 0.22;
          rect(w / 2 + Math.sin(a + SIDE) * 46 * scale, ground - 36 * scale + Math.cos(a + SIDE) * 12 * scale, 2, 2, '#fff');
        }
        compass(s, m.spec.SECTOR);
        gauge('SPIN', s.rate, ...slot(0), [0.8, 1]);
        if (s.rate > 0.8) banner('THROW IN THE GREEN!', '#f9d56e');
      }
      return null;
    }

    function crossbar(x, y, knocked) {
      rect(x - 1, y, 3, 2000, '#ddd');
      if (knocked) line(x - 20, y + 18, x + 18, y + 30, 2, '#e8505b');
      else rect(x - 14, y - 2, 28, 3, '#f9d56e');
    }

    function highJump(m, look) {
      const s = m.state, spec = m.spec, { ground, scale, w, ppm } = stage();
      const flight = s.phase === 'air' ? clamp(s.time / 1.5, 0, 1.15) : 0;
      const metres = s.phase === 'air' ? s.s + flight * 2.2 : s.s;
      const anchor = 0.35;
      // The camera stops before the bar, so the jump moves across the screen.
      const camera = Math.min(metres, spec.JUMP_AT - 0.8);
      const at = track(camera, anchor);
      const bar = at(spec.JUMP_AT + 0.6), high = ground + 6 - s.bar * ppm;
      rect(bar + 4, ground - 12, 90 * scale, 20, '#2b62c9');
      rect(bar + 4, ground - 12, 90 * scale, 4, '#74acdf');
      crossbar(bar, high, s.judged && s.clear < s.bar);
      if (s.phase === 'air') {
        const peak = (s.clear || s.jump.peak + 0.16 * s.arch) + 0.12;
        const body = lerp(0.85, peak, Math.sin(Math.PI * clamp(flight)));
        const landed = flight > 0.9;
        person(look, kinds.flop(s.arch, Math.min(1, flight * 2) * 1.5), at(metres),
          Math.min(ground - (landed ? 10 : -6), ground + 6 - (body - 0.85) * ppm), scale);
      } else person(look, s.speed < 0.4 ? kinds.run(0, 0) : kinds.run(s.cycle), at(s.s), ground + 6, scale);
      text(`BAR ${s.bar.toFixed(2)}`, w / 2, stage().hud, '#f9d56e', 2, 'center');
      if (s.phase === 'run') {
        needle(say('CURVE: TILT TO THE MARK', 'CURVE: ARROWS'), s.lean, ...slot(1), spec.curve(s.s) * 0.8);
        if (s.s > spec.JUMP_AT - 4) banner(say('FLICK UP: JUMP!', 'SPACE: JUMP!'), '#f9d56e');
      } else if (!s.arch && flight < 0.5) banner(say('TILT BACK OR TAP!', 'SPACE: ARCH!'), '#f9d56e');
    }

    function poleVault(m, look) {
      const s = m.state, spec = m.spec, { ground, scale, w, ppm } = stage();
      const flight = s.phase === 'air' ? clamp(s.time / 1.7, 0, 1.15) : 0;
      const metres = s.phase === 'air' ? spec.BOX + flight * 2.4 : s.s;
      const peak = s.phase === 'air' ? (s.clear || s.jump.peak + 0.22 * s.push) + 0.15 : 0;
      const body = s.phase === 'air' ? lerp(0.85, peak, Math.sin(Math.PI * clamp(flight))) : 0.85;
      // The camera follows the vaulter up.
      const lift = s.phase === 'air' ? Math.max(0, body * ppm - (ground - 80)) : 0;
      ctx.save();
      const camera = Math.min(metres, spec.BOX - 0.4);
      outdoors(ground - 34, camera * ppm * 0.35);
      ctx.translate(0, Math.round(lift));
      const at = (d) => w * 0.34 + (d - camera) * ppm;
      rect(0, ground - 34, w, 600, '#cf5a3c');
      rect(0, ground - 3, w, 1, '#f3e9dc');
      const box = at(spec.BOX), bar = box + 26, high = ground + 6 - s.bar * ppm;
      rect(box + 6, ground - 14, 100 * scale, 22, '#2b62c9');
      rect(box + 6, ground - 14, 100 * scale, 4, '#74acdf');
      crossbar(bar, high, s.judged && s.clear < s.bar);
      const x = at(metres), y = ground + 6 - (body - 0.85) * ppm;
      if (s.phase === 'run') {
        const move = s.speed < 0.4 ? kinds.run(0, 0) : kinds.run(s.cycle);
        line(x - 30 * scale, ground - 18 * scale, x + 44 * scale, ground - 50 * scale, 2, '#f4f4f4');
        person(look, move, x, ground + 6, scale);
        if (s.s > spec.BOX - 5) banner(say('HOLD A FINGER: PLANT!', 'HOLD SPACE: PLANT!'), '#f9d56e');
      } else if (s.phase === 'bend') {
        const hands = [x + 12 * scale, ground - 58 * scale - s.bend * 10];
        const knee = [(box + hands[0]) / 2 + s.bend * 26, (ground + hands[1]) / 2 + s.bend * 6];
        line(box, ground, ...knee, 2.5, '#f4f4f4');
        line(...knee, ...hands, 2.5, '#f4f4f4');
        person(look, kinds.plant(clamp(s.bend)), x, ground + 6 - s.bend * 12, scale);
      } else {
        if (flight < 0.5) line(box, ground, x, y - 20 * scale, 2.5, '#f4f4f4');
        else line(box, ground, box - 20, ground - 150, 2.5, '#f4f4f4');
        person(look, kinds.flop(s.push, Math.min(1, flight * 1.6) * (s.push ? 1.9 : 2.6)), x, Math.min(ground, y), scale);
      }
      ctx.restore();
      text(`BAR ${s.bar.toFixed(2)}`, w / 2, stage().hud, '#f9d56e', 2, 'center');
      if (s.phase === 'bend') {
        gauge(say('LIFT THE FINGER IN THE GREEN', 'RELEASE SPACE IN THE GREEN'), s.bend / 1.25, ...slot(0), [0.58, 0.74]);
      } else if (s.phase === 'air' && !s.push && flight < 0.5) banner(say('TILT OR TAP: CLEAR IT!', 'SPACE: CLEAR IT!'), '#f9d56e');
    }

    function diving(m, look) {
      const s = m.state, spec = m.spec, { w, h, ground, scale, portrait } = stage();
      const ppm = 22 * scale;
      const p = s.phase === 'air' ? clamp(s.time / spec.FALL) : s.phase === 'water' ? 1 : 0;
      const height = s.phase === 'ready' ? 10 : Math.max(0, 10 + 5 * p - 15 * p * p);
      const camera = Math.max(0, height - (ground - stage().horizon - 10) / ppm);
      const surface = ground + camera * ppm;
      outdoors(surface - 6);
      water(surface, h + 10, s.time * 6);
      const board = surface - 10 * ppm, edge = w * 0.4;
      rect(8, board, 6, surface - board, '#9a9ab0');
      rect(0, board, edge, 5, '#c9c9d6');
      const x = s.phase === 'ready' ? edge - 14 : edge + 4 + p * 30;
      const y = surface - height * ppm;
      if (s.phase === 'water') {
        const size = 10 + s.splash * 50;
        for (let i = 0; i < 30; i++) {
          const a = i * 2.4, d = ((i % 5) / 5 + 0.3) * size * Math.min(1, s.time * 2);
          rect(x + Math.cos(a) * d, surface - Math.abs(Math.sin(a)) * d * Math.max(0, 1 - s.time / 1.4), 3, 3, '#e8f8ff');
        }
        const { somersaults, difficulty, judges } = s.score;
        const yy = stage().horizon - 22;
        shade(w / 2 - 66, yy - 4, 132, 29);
        text(`${somersaults} SOMERSAULT${somersaults === 1 ? '' : 'S'}`, w / 2, yy, '#fff', 1, 'center');
        text(`JUDGES ${judges.toFixed(1)}  X ${difficulty.toFixed(1)}`, w / 2, yy + 9, '#f9d56e', 1, 'center');
      } else if (s.phase === 'air') {
        const tuck = s.open ? 0 : clamp(s.rate / 8);
        person(look, kinds.dive(tuck, s.angle), x, y + 34 * scale, scale);
        needle('ENTRY: HEAD DOWN', Math.sin(s.angle), ...slot(0), 0);
        if (s.rate === 0 && p < 0.3) banner(say('SWIPE: SOMERSAULT', 'UP: SOMERSAULT'), '#f9d56e');
        else if (!s.open) banner(say('HOLD: OPEN', 'DOWN: OPEN'), '#f9d56e');
      } else {
        person(look, kinds.dive(0, 0), x, y, scale);
        banner(say('FLICK UP TO DIVE', 'SPACE TO DIVE'), '#f9d56e', 2, portrait ? 96 : 60);
      }
    }

    // ---------- Balance, aim and duels ----------

    function surfing(m, look) {
      const s = m.state, { w, h, ground, scale, horizon } = stage();
      outdoors(horizon + 6, s.time * 5);
      const base = ground + 24, crest = horizon - 14;
      const foam = 18;
      const faceY = (x) => crest + (base - crest) * clamp((x - foam) / (w * 0.95)) ** 0.7;
      water(horizon + 6, h, s.time * 40);
      const points = [[0, h]];
      for (let x = 0; x <= w; x += 4) points.push([x, faceY(x) + Math.sin(x / 11 + s.time * 6) * 2]);
      points.push([w, h]);
      poly(points, '#1f66a8');
      for (let x = foam; x < w; x += 9) {
        const y = faceY(x) + 12 + wrap(x * 3 + s.time * 80, Math.max(4, base - faceY(x)));
        rect(x, y, 6, 1, '#6fc0ee');
      }
      for (let i = 0; i < 70; i++) {
        const x = wrap(i * 17, foam + 34) - 6 + Math.sin(s.time * 5 + i) * 3;
        disc(x, crest - 6 + wrap(i * 29, base - crest + 20), 3 + (i % 3), i % 4 ? '#ffffff' : '#cfeaff');
      }
      const x = foam + 30 + s.x * (w - foam - 60);
      const low = base + 6, high = faceY(x) + 8;
      let y = low + (high - low) * s.h;
      if (s.air) y -= Math.sin((Math.PI * s.air.t) / 1.1) * 60 * scale;
      if (s.down > 0) {
        for (let i = 0; i < 26; i++) disc(x + Math.cos(i * 2.4) * (i % 7) * 4, low - 10 + Math.sin(i * 1.7) * 18, 4, '#fff');
      } else {
        const spin = s.air ? s.air.angle : 0;
        const half = 26 * scale * Math.max(0.15, Math.abs(Math.cos(spin)));
        line(x - half, y + 3, x + half, y - 3, 4, '#f9d56e');
        person(look, kinds.surf(s.air ? 1 : 1 - s.h, clamp(s.vx * 8, -4, 4)), x, y, scale, FRONT + spin);
        if (s.pocket && !s.air) for (let i = 0; i < 5; i++) rect(x - 30 - i * 5, y + 4 + (i % 2) * 3, 4, 2, '#fff');
      }
      text(`${Math.round(s.points)} PTS`, w / 2, stage().hud, '#f9d56e', 2, 'center');
      text(`${Math.max(0, Math.ceil(m.spec.WAVE - s.time))}S`, w / 2, stage().hud + 13, '#fff', 1, 'center');
      if (s.pocket && !s.air) text('IN THE POCKET', w / 2, stage().hud + 23, '#5be37d', 1, 'center');
      if (s.air) text(say('DRAW CIRCLES: SPIN', 'A AND L: SPIN'), w / 2, stage().hud + 23, '#f9d56e', 1, 'center');
    }

    function beam(m, look) {
      const s = m.state, { w, h, ground, scale, horizon } = stage();
      indoors(ground - 20);
      rect(0, ground + 14, w, h, '#2b62c9');
      const deck = ground - 14;
      rect(20, deck, w - 40, 9, '#d9a86a');
      rect(20, deck + 7, w - 40, 2, '#a9743f');
      for (const x of [34, w - 40]) rect(x, deck + 9, 6, 36, '#9a9ab0');
      if (s.down > 0) {
        person(look, kinds.balance(Math.sign(s.lean || 1)), w / 2 + Math.sign(s.lean || 1) * 36, ground + 30, scale * 1.1, FRONT);
      } else {
        const k = s.doing ? Math.sin(Math.PI * clamp(s.doing.t / 0.8)) : 0;
        const move = kinds.balance(s.lean, s.doing && s.doing.dir, k);
        move.roll = s.lean * 0.45;
        person(look, move, w / 2, deck + 1, scale * 1.15, FRONT);
      }
      needle('BALANCE: KEEP IT IN THE MIDDLE', s.lean, ...slot(0), 0);
      if (s.cue) {
        const y = horizon - 4;
        shade(w / 2 - 24, y - 24, 48, 52);
        arrow(s.cue.dir, w / 2, y - 2, '#f9d56e');
        rect(w / 2 - 20, y + 22, 40 * clamp(s.cue.left / 1.8), 3, '#5be37d');
      }
      text(`MOVES ${s.hit}/${s.asked}`, w / 2, stage().hud, '#f9d56e', 2, 'center');
      text(`${Math.max(0, Math.ceil(m.spec.ROUTINE - s.time))}S`, w / 2, stage().hud + 13, '#fff', 1, 'center');
    }

    // The part of the screen the clays fly over.
    function range() {
      const { w, ground, hud } = stage();
      return { x: 0, y: hud + 18, w, h: ground - hud - 18 };
    }

    function trap(m, look) {
      const s = m.state, { w, h, ground, scale } = stage();
      const f = range();
      outdoors(ground - 8);
      rect(0, ground - 8, w, h, '#3f9e45');
      rect(w / 2 - 18, ground - 10, 36, 8, '#55556a');
      const px = (p) => f.x + p.x * f.w, py = (p) => f.y + p.y * f.h;
      const c = s.clay;
      if (c) {
        if (c.broken) {
          for (let i = 0; i < 14; i++) rect(px(c) + Math.cos(i * 2.4) * c.broken * (30 + (i % 4) * 18), py(c) + Math.sin(i * 2.4) * c.broken * 40 + c.broken ** 2 * 60, 3, 3, '#f39c4a');
        } else {
          rect(px(c) - 7, py(c) - 2, 14, 5, '#14101c');
          rect(px(c) - 6, py(c) - 1, 12, 3, '#f39c4a');
          rect(px(c) - 3, py(c) - 3, 6, 2, '#f39c4a');
        }
      }
      const move = kinds.shoot(clamp((0.5 - s.aim.y) * 1.6, -1, 1), s.shot ? 1 - s.shot.t * 4 : 0);
      person(look, move, w / 2, ground + 30 * scale, scale * 1.2, (s.aim.x - 0.5) * 1.1);
      const x = px(s.aim), y = py(s.aim), color = s.shot ? '#fff' : '#e8505b';
      for (let a = 0; a < TAU; a += 0.2) rect(x + Math.cos(a) * 13, y + Math.sin(a) * 13, 1, 1, color);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) line(x + dx * 5, y + dy * 5, x + dx * 18, y + dy * 18, 1, color);
      if (s.shot) disc(x, y, Math.round(3 + s.shot.t * 30), '#fff4');
      for (let i = 0; i < 15; i++) {
        const [bx, by] = [w / 2 - 74 + i * 10, h - stage().bottom - 12];
        rect(bx, by, 8, 8, '#10101c');
        if (i < s.results.length) rect(bx + 1, by + 1, 6, 6, s.results[i] ? '#f39c4a' : '#555');
      }
      text(`${s.hits} HITS`, w / 2, stage().hud, '#f9d56e', 2, 'center');
    }

    function tableTennis(m) {
      const s = m.state, { w, h, ground, scale, horizon } = stage();
      indoors(horizon);
      rect(0, horizon + 4, w, h, '#4a3a33');
      const near = { y: ground, half: Math.min(w * 0.46, 120) };
      const far = { y: horizon + 26, half: near.half * 0.5 };
      const spot = (x, depth) => {
        const k = depth / (1 + (1 - depth) * 0.45); // closer points spread more
        const y = near.y + (far.y - near.y) * k;
        return [w / 2 + x * (near.half + (far.half - near.half) * k) * 0.82, y];
      };
      const foe = lookOf(m.athletes[1], 1);
      person(foe, kinds.paddle(s.ball && s.ball.dir > 0 && s.ball.depth > 0.8 ? 1 : 0, 0),
        w / 2 + s.rivalX * far.half * 0.8, far.y + 8, scale * 0.8, FRONT);
      poly([[w / 2 - far.half, far.y], [w / 2 + far.half, far.y], [w / 2 + near.half, near.y], [w / 2 - near.half, near.y]], '#1f9d45');
      line(w / 2 - far.half, far.y, w / 2 + far.half, far.y, 1, '#fff');
      line(w / 2 - near.half, near.y, w / 2 + near.half, near.y, 2, '#fff');
      for (const side of [-1, 1]) line(w / 2 + side * far.half, far.y, w / 2 + side * near.half, near.y, 1, '#fff');
      line(w / 2, far.y, w / 2, near.y, 1, '#9fd8ac');
      rect(w / 2 - near.half, near.y + 2, near.half * 2, 5, '#14663a');
      const [, zone] = spot(0, 0.09);
      ctx.globalAlpha = 0.25;
      rect(w / 2 - near.half, zone, near.half * 2, near.y - zone, '#f9d56e');
      ctx.globalAlpha = 1;
      const net = spot(0, 0.5)[1], half = (near.half + far.half) / 2 + 8;
      rect(w / 2 - half, net - 10, half * 2, 2, '#fff');
      for (let x = -half; x < half; x += 6) rect(w / 2 + x, net - 8, 1, 9, '#ccd');
      const b = s.ball;
      let px = w / 2 + 30;
      if (b) {
        const depth = clamp(b.depth, -0.25, 1);
        const [x, y] = spot(b.x, depth);
        const hop = Math.abs(Math.sin(depth * Math.PI * 1.5 + 0.3)) * 22;
        rect(x - 3, y - 1, 6, 2, '#14663a');
        disc(x, y - 8 - hop, Math.max(2, Math.round(5 - depth * 2.5)), '#fff');
        px = w / 2 + clamp(b.dir < 0 ? b.x : 0, -1, 1) * near.half * 0.7 + 14;
      }
      const py = ground + 18 - (s.swing > 0 ? 18 : 0);
      line(px + 4, py + 6, px + 14, py + 24, 6, '#7a5a34');
      disc(px, py, 12, '#14101c'); disc(px, py, 11, '#d52b1e');
      duelScore(m, s);
      if (b && b.dir < 0 && b.depth < 0.2) banner(say('SWIPE NOW!', 'SPACE NOW!'), '#f9d56e', 2, 4);
    }

    function duelScore(m, s) {
      const { w, hud } = stage();
      const [me, foe] = m.athletes;
      shade(w / 2 - 46, hud - 3, 92, 17);
      Countries.drawFlag(ctx, me.country, w / 2 - 42, hud + 1, 12, 8);
      Countries.drawFlag(ctx, foe.country, w / 2 + 30, hud + 1, 12, 8);
      text(`${s.mine} - ${s.theirs}`, w / 2, hud, '#f9d56e', 2, 'center');
    }

    function penalty(m, look) {
      const s = m.state, { w, h, ground, scale, horizon } = stage();
      const half = Math.min(w * 0.42, 100), mouth = Math.round(horizon + (ground - horizon) * 0.42);
      const tall = Math.round(half * 0.7);
      outdoors(mouth - 20);
      rect(0, mouth - 6, w, h, '#3f9e45');
      for (let y = mouth + 6; y < h; y += 26) rect(0, y, w, 12, '#399040');
      for (let x = -half; x <= half; x += 9) rect(w / 2 + x, mouth - tall, 1, tall, '#aab4c8');
      for (let y = 0; y < tall; y += 9) rect(w / 2 - half, mouth - tall + y, half * 2, 1, '#aab4c8');
      rect(w / 2 - half - 3, mouth - tall - 3, half * 2 + 6, 3, '#fff');
      for (const side of [-1, 1]) rect(w / 2 + side * half - (side < 0 ? 3 : 0), mouth - tall - 3, 3, tall + 3, '#fff');
      const mine = s.turn === 'shoot';
      const foe = lookOf(m.athletes[1], 1);
      const goalie = mine ? foe : look, shooter = mine ? look : foe;
      const spot = { x: w / 2, y: ground + 4 };
      // Keeper: follows the guess, or leans with the player's dive.
      let kx = mine ? s.keeper.x : 0, k = mine ? clamp(Math.abs(s.keeper.x) * 1.5) : 0;
      if (!mine && s.dive) {
        const p = s.shot ? clamp(s.shot.t / s.shot.time) : 0.4;
        k = p; kx = s.dive.side * 0.7 * p;
      }
      const move = kinds.keeper(k, 1, s.time);
      move.roll = Math.sign(kx) * k * 1.15;
      person(goalie, move, w / 2 + kx * half, mouth + 2 - k * 12, scale * 0.9, FRONT);
      let bx = spot.x, by = spot.y, size = 7, swing = 0;
      if (s.shot) {
        const p = clamp(s.shot.t / s.shot.time);
        swing = 1;
        const tx = w / 2 + s.shot.x * half, ty = mouth - s.shot.y * tall;
        bx = lerp(spot.x, tx, p) - Math.sin(Math.PI * p) * (s.shot.curve || 0) * 30;
        by = lerp(spot.y, ty, p) - Math.sin(Math.PI * p) * 14;
        size = lerp(7, 4, p);
      }
      if (!mine && s.incoming && !s.shot) swing = clamp((s.incoming.t - 1.3) / 0.4) * 0.4;
      const kicker = kinds.kick(swing);
      // The shooter's body gives away a side, truthfully or not.
      if (!mine && s.incoming && s.incoming.t > 0.7) kicker.sway = -s.incoming.hint * 9;
      person(shooter, kicker, spot.x - 22 * scale, ground + 22 * scale, scale, 0.25);
      disc(bx, by, Math.round(size), '#14101c'); disc(bx, by, Math.round(size) - 1, '#fff'); rect(bx - 1, by - 1, 3, 3, '#14101c');
      duelScore(m, s);
      for (const [row, list] of [[0, s.log.mine], [1, s.log.theirs]]) {
        list.slice(-8).forEach((goal, i) => disc(w / 2 + (row ? 14 : -14) + (row ? 1 : -1) * i * 8, stage().hud + 21, 3, goal ? '#5be37d' : '#e8505b'));
      }
      if (!s.shot) {
        text(mine ? say('SHOOT: SWIPE TO THE GOAL', 'SHOOT: ARROWS AND SPACE') : say('SAVE: TILT OR SWIPE SIDEWAYS', 'SAVE: LEFT OR RIGHT'),
          w / 2, Math.min(ground + 40 * scale, h - 10), '#fff', 1, 'center');
      }
    }

    function fencing(m, look) {
      const s = m.state, { w, h, ground, scale } = stage();
      indoors(ground - 20);
      rect(0, ground + 4, w, h, '#4a3a33');
      rect(8, ground, w - 16, 9, '#9a9ab0');
      for (let x = 20; x < w - 16; x += 30) rect(x, ground, 1, 9, '#667');
      const size = scale * 1.1, gap = 31 * size;
      const mine = s.me.move === 'lunge' ? Math.sin(Math.PI * clamp(s.me.t / 0.6)) : 0;
      const attack = s.foe.move === 'attack' ? clamp(s.foe.t / 0.75) : 0;
      const theirs = attack > 0.55 ? (attack - 0.55) / 0.45 : 0;
      person(look, kinds.fence(mine, s.me.line), w / 2 - gap + mine * 12 * size, ground + 3, size);
      const foe = { ...lookOf(m.athletes[1], 1) };
      person(foe, kinds.fence(theirs, s.foe.line), w / 2 + gap - theirs * 12 * size, ground + 3, size, -SIDE);
      if (s.foe.move === 'attack' && s.pause <= 0) {
        const y = ground - (s.foe.line === 'high' ? 78 : 18) * size;
        shade(w / 2 + gap - 22, y - 5, 44, 15);
        text(s.foe.line.toUpperCase(), w / 2 + gap, y - 2, '#e8505b', 2, 'center');
      }
      duelScore(m, s);
      const [x, y, width] = slot(0);
      shade(x - 3, y - 9, width + 6, 20);
      text(`YOUR GUARD: ${s.me.line.toUpperCase()}`, x + width / 2, y - 2, '#74acdf', 1, 'center');
      if (s.riposte > 0 && s.me.move === 'guard') banner('LUNGE NOW!', '#5be37d', 2, 14);
    }

    const scenes = {
      sprint100, swimming, rowing, cycling, climbing, canoe, javelin, highJump, poleVault, diving,
      discus: (m, look) => thrower(m, look, 'discus'),
      hammer: (m, look) => thrower(m, look, 'hammer'),
      surfing, beam, trap, tableTennis, penalty, fencing,
    };

    return {
      draw(m, touch = true) {
        touching = touch;
        scenes[m.spec.id](m, lookOf(m.player, 0));
        const flash = m.state.flash;
        if (flash && m.phase === 'play') {
          const { w, horizon, portrait } = stage();
          text(flash.text, w / 2, portrait ? horizon + 12 : 66, flash.good ? '#5be37d' : '#e8505b', 2, 'center');
        }
      },
      range,
      stage,
    };
  }

  root.Scenes = { create };
})(this);
