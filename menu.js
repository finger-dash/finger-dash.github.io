// Runner selection screen: flags on the left, rotating runner on the right.
(function (root) {
  'use strict';

  const COLS = 3;
  const LEVELS = ['easy', 'normal', 'hard'];

  // Hit boxes in logical (320x180) coordinates.
  const flagBox = (i) => ({ x: 10 + (i % COLS) * 54, y: 22 + Math.floor(i / COLS) * 28, w: 50, h: 26 });
  const nameBox = { x: 10, y: 137, w: 158, h: 12 };
  const levelBox = (i) => ({ x: 10 + i * 54, y: 153, w: 50, h: 11 });
  const startBox = { x: 190, y: 156, w: 120, h: 18 };
  const inside = (b, x, y) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;

  function createMenu(view, avatar, Countries, Font) {
    const { ctx, rect, text, W, H } = view;
    const list = Countries.COUNTRIES;

    // Keyboard handling. Returns 'start', 'changed' or null.
    function key(model, e) {
      const i = list.findIndex((c) => c.id === model.country);
      const move = (step) => {
        model.country = list[(i + step + list.length) % list.length].id;
        return 'changed';
      };
      if (e.key === 'ArrowLeft') return move(-1);
      if (e.key === 'ArrowRight') return move(1);
      if (e.key === 'ArrowUp') return move(-COLS);
      if (e.key === 'ArrowDown') return move(COLS);
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
      const flag = list.findIndex((_, i) => inside(flagBox(i), x, y));
      if (flag >= 0) { model.country = list[flag].id; return 'changed'; }
      const level = LEVELS.findIndex((_, i) => inside(levelBox(i), x, y));
      if (level >= 0) { model.difficulty = LEVELS[level]; return 'changed'; }
      if (inside(nameBox, x, y)) return 'name';
      return inside(startBox, x, y) ? 'start' : null;
    }

    const hovering = (x, y) => inside(startBox, x, y) || inside(nameBox, x, y) ||
      list.some((_, i) => inside(flagBox(i), x, y)) || LEVELS.some((_, i) => inside(levelBox(i), x, y));

    function draw(model, now, touch) {
      rect(0, 0, W, H, '#14142a');
      for (let y = 0; y < H; y += 6) rect(0, y, W, 1, '#1b1b38');
      text('FINGER DASH', 10, 6, '#f9d56e', 2);

      list.forEach((c, i) => {
        const b = flagBox(i), selected = c.id === model.country;
        rect(b.x, b.y, b.w, b.h, selected ? '#f9d56e' : '#2b2b4a');
        rect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, selected ? '#2b4a78' : '#1f1f3a');
        Countries.drawFlag(ctx, c.id, b.x + 13, b.y + 2, 24, 16);
        text(c.name, b.x + b.w / 2, b.y + 19, selected ? '#fff' : '#9ab', 1, 'center');
      });

      rect(nameBox.x, nameBox.y, nameBox.w, nameBox.h, '#05050f');
      text('NAME:', nameBox.x + 4, nameBox.y + 3, '#9ab');
      const cursor = Math.floor(now / 400) % 2 && model.name.length < Font.NAME_MAX ? '_' : '';
      if (model.name) text(model.name + cursor, nameBox.x + 30, nameBox.y + 3, '#fff');
      else text(`${touch ? 'TAP' : 'TYPE'}${touch ? ' TO TYPE' : ' YOUR NAME'}${cursor}`, nameBox.x + 30, nameBox.y + 3, '#667');

      LEVELS.forEach((level, i) => {
        const b = levelBox(i), selected = level === model.difficulty;
        rect(b.x, b.y, b.w, b.h, selected ? '#f9d56e' : '#2b2b4a');
        text(level, b.x + b.w / 2, b.y + 3, selected ? '#14142a' : '#9ab', 1, 'center');
      });
      text(touch ? 'SWIPE DOWN: RUN - FLICK UP: JUMP' : 'ARROWS: COUNTRY - TAB: LEVEL', 10, 170, '#667');

      // Preview: running on the spot while turning around.
      rect(180, 4, 130, 150, '#0d0d1f');
      for (let i = 0; i < 4; i++) rect(205 + i * 4, 146 + i * 2, 80 - i * 8, 2, '#bd4d33');
      const country = Countries.byId(model.country);
      const look = {
        skin: '#e0a070', hair: '#3a2418', kit: country.kit, name: model.name,
        number: '10', country: country.id, headband: true,
      };
      const t = now / 1000;
      avatar.draw(ctx, 245, 150, 2, look, { speed: 6, cycle: t * 2.6, air: false }, t * 1.1);
      text(country.name, 245, 8, '#fff', 1, 'center');

      rect(startBox.x, startBox.y, startBox.w, startBox.h, '#5be37d');
      text(touch ? 'START' : 'START - ENTER', startBox.x + startBox.w / 2, startBox.y + 7, '#10300f', 1, 'center');
    }

    return { draw, key, click, hovering };
  }

  root.Menu = { createMenu };
})(this);
