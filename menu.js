// Runner selection screen: flags on the left, rotating runner on the right.
(function (root) {
  'use strict';

  const LEVELS = ['easy', 'normal', 'hard'];
  const inside = (b, x, y) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  const box = (x, y, w, h) => ({ x, y, w, h });

  // Hit boxes and positions in logical coordinates.
  function landscapeBoxes() {
    return {
      cols: 3,
      flag: (i) => box(10 + (i % 3) * 54, 22 + Math.floor(i / 3) * 28, 50, 26),
      name: box(10, 137, 158, 12),
      level: (i) => box(10 + i * 54, 153, 50, 11),
      start: box(190, 156, 120, 18),
      title: { x: 10, y: 6, align: 'left' },
      preview: box(180, 4, 130, 150),
      hint: { x: 10, y: 170, align: 'left' },
    };
  }

  // Upright phones: preview on top, controls stacked from the bottom.
  function portraitBoxes(W, H, top, bottom) {
    const end = H - bottom - 4;
    const hint = end - 6;
    const start = box(4, hint - 27, W - 8, 23);
    const levelY = start.y - 19;
    const nameY = levelY - 20;
    const flagsY = nameY - 3 * 29 - 2;
    return {
      cols: 4,
      flag: (i) => box(4 + (i % 4) * 49, flagsY + Math.floor(i / 4) * 29, 45, 27),
      name: box(4, nameY, W - 8, 16),
      level: (i) => box(4 + i * 65, levelY, 62, 15),
      start,
      title: { x: W / 2, y: top + 5, align: 'center' },
      preview: box(4, top + 19, W - 8, flagsY - top - 23),
      hint: { x: W / 2, y: hint, align: 'center' },
    };
  }

  function createMenu(view, avatar, Countries, Font) {
    const { ctx, rect, text } = view;
    const list = Countries.COUNTRIES;
    const boxes = () => {
      const l = view.layout;
      return l.portrait ? portraitBoxes(l.w, l.h, l.top, l.bottom) : landscapeBoxes();
    };

    // Keyboard handling. Returns 'start', 'changed' or null.
    function key(model, e) {
      const i = list.findIndex((c) => c.id === model.country);
      const move = (step) => {
        model.country = list[(i + step + list.length) % list.length].id;
        return 'changed';
      };
      if (e.key === 'ArrowLeft') return move(-1);
      if (e.key === 'ArrowRight') return move(1);
      if (e.key === 'ArrowUp') return move(-boxes().cols);
      if (e.key === 'ArrowDown') return move(boxes().cols);
      if (e.key === 'Enter') return 'start';
      if (e.key === 'Tab') {
        model.difficulty = LEVELS[(LEVELS.indexOf(model.difficulty) + 1) % LEVELS.length];
        return 'changed';
      }
      if (e.key === 'Backspace') {
        model.name = model.name.slice(0, -1);
        return 'changed';
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        model.name = Font.cleanName(model.name + e.key);
        return 'changed';
      }
      return null;
    }

    function click(model, x, y) {
      const b = boxes();
      const flag = list.findIndex((_, i) => inside(b.flag(i), x, y));
      if (flag >= 0) { model.country = list[flag].id; return 'changed'; }
      const level = LEVELS.findIndex((_, i) => inside(b.level(i), x, y));
      if (level >= 0) { model.difficulty = LEVELS[level]; return 'changed'; }
      if (inside(b.name, x, y)) return 'name';
      return inside(b.start, x, y) ? 'start' : null;
    }

    const hovering = (x, y) => {
      const b = boxes();
      return inside(b.start, x, y) || inside(b.name, x, y) ||
        list.some((_, i) => inside(b.flag(i), x, y)) || LEVELS.some((_, i) => inside(b.level(i), x, y));
    };

    function draw(model, now, touch) {
      const b = boxes(), W = view.W, H = view.H;
      rect(0, 0, W, H, '#14142a');
      for (let y = 0; y < H; y += 6) rect(0, y, W, 1, '#1b1b38');
      text('FINGER DASH', b.title.x, b.title.y, '#f9d56e', 2, b.title.align);

      list.forEach((c, i) => {
        const f = b.flag(i), selected = c.id === model.country;
        rect(f.x, f.y, f.w, f.h, selected ? '#f9d56e' : '#2b2b4a');
        rect(f.x + 1, f.y + 1, f.w - 2, f.h - 2, selected ? '#2b4a78' : '#1f1f3a');
        Countries.drawFlag(ctx, c.id, f.x + (f.w - 24) / 2, f.y + 2, 24, 16);
        text(c.name, f.x + f.w / 2, f.y + f.h - 7, selected ? '#fff' : '#9ab', 1, 'center');
      });

      const n = b.name, textY = n.y + Math.floor((n.h - 5) / 2);
      rect(n.x, n.y, n.w, n.h, '#05050f');
      text('NAME:', n.x + 4, textY, '#9ab');
      const cursor = Math.floor(now / 400) % 2 && model.name.length < Font.NAME_MAX ? '_' : '';
      if (model.name) text(model.name + cursor, n.x + 30, textY, '#fff');
      else text(`${touch ? 'TAP TO TYPE' : 'TYPE YOUR NAME'}${cursor}`, n.x + 30, textY, '#667');

      LEVELS.forEach((level, i) => {
        const l = b.level(i), selected = level === model.difficulty;
        rect(l.x, l.y, l.w, l.h, selected ? '#f9d56e' : '#2b2b4a');
        text(level, l.x + l.w / 2, l.y + Math.floor((l.h - 5) / 2), selected ? '#14142a' : '#9ab', 1, 'center');
      });
      text(touch ? 'SWIPE DOWN: RUN - FLICK UP: JUMP' : 'ARROWS: COUNTRY - TAB: LEVEL',
        b.hint.x, b.hint.y, '#667', 1, b.hint.align);

      // Preview: running on the spot while turning around.
      const p = b.preview, cx = p.x + p.w / 2;
      rect(p.x, p.y, p.w, p.h, '#0d0d1f');
      // The runner shrinks on short screens; the model is 66 units tall.
      const scale = Math.min(2, (p.h - 18) / 68);
      const feet = Math.round(p.y + (p.h + 10 + 66 * scale) / 2);
      for (let i = 0; i < 4; i++) rect(cx - 40 + i * 4, feet - 4 + i * 2, 80 - i * 8, 2, '#bd4d33');
      const country = Countries.byId(model.country);
      const look = {
        skin: '#e0a070', hair: '#3a2418', kit: country.kit, name: model.name,
        number: '10', country: country.id, headband: true,
      };
      const t = now / 1000;
      avatar.draw(ctx, cx, feet, scale, look, { speed: 6, cycle: t * 2.6, air: false }, t * 1.1);
      text(country.name, cx, p.y + 4, '#fff', 1, 'center');

      const s = b.start;
      rect(s.x, s.y, s.w, s.h, '#5be37d');
      text(touch ? 'START' : 'START - ENTER', s.x + s.w / 2, s.y + Math.floor((s.h - 5) / 2), '#10300f', 1, 'center');
    }

    return { draw, key, click, hovering };
  }

  root.Menu = { createMenu };
})(this);
