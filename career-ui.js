// The athlete's menus: the training bars, the training room and the champion's
// screen once every gold is won.
(function (root) {
  'use strict';

  const ACTION_TIME = 1100; // ms an exercise lasts; no other can start meanwhile
  const COLORS = {
    speed: '#74acdf', strength: '#e8505b', jump: '#5be37d', stamina: '#f9d56e',
    aim: '#f39c4a', balance: '#b58cf0', reflexes: '#6fe0d0',
  };
  const MEDAL_COLORS = { gold: '#f9d56e', silver: '#c9d1dc', bronze: '#d08a52' };
  const SIDE = Math.PI / 2;

  const box = (x, y, w, h) => ({ x, y, w, h });
  const inside = (b, x, y) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;

  // A medal with its ribbon, 11x15 around (cx, top).
  function medal(rect, kind, cx, top) {
    rect(cx - 4, top, 3, 6, '#2b62c9');
    rect(cx + 1, top, 3, 6, '#e8505b');
    rect(cx - 4, top + 5, 8, 10, '#10101c');
    rect(cx - 6, top + 7, 12, 6, '#10101c');
    rect(cx - 3, top + 6, 6, 8, MEDAL_COLORS[kind]);
    rect(cx - 5, top + 8, 10, 4, MEDAL_COLORS[kind]);
    rect(cx - 2, top + 7, 2, 2, '#ffffff');
  }

  // Hit boxes of the athlete menus.
  function boxes({ w: W, h: H, portrait, top, bottom }) {
    const back = box(4, portrait ? top + 3 : 4, 30, 13);
    const title = { x: portrait ? W / 2 + 14 : W / 2, y: portrait ? top + 7 : 6 };
    if (!portrait) {
      return {
        back, title,
        stage: box(10, 20, 108, 82),
        bars: { x: 10, y: 107, w: 108, step: 9 },
        action: (i) => box(126 + (i % 2) * 94, 20 + Math.floor(i / 2) * 27, 90, 24),
        other: box(126, 158, 184, 14),
        stat: (i) => box(10, 20 + i * 19, W - 20, 18),
        link: box(100, 158, 120, 14),
      };
    }
    const link = box(10, H - bottom - 26, W - 20, 21);
    const actions = link.y - 5 * 23 - 4;
    const step = 10;
    const bars = { x: 8, y: actions - 7 * step - 6, w: W - 16, step };
    const first = top + 21;
    const row = Math.floor((link.y - first - 4) / 7);
    return {
      back, title,
      stage: box(4, first, W - 8, bars.y - first - 4),
      bars,
      action: (i) => box(4 + (i % 2) * 98, actions + Math.floor(i / 2) * 23, 94, 20),
      other: link,
      stat: (i) => box(4, first + i * row, W - 8, row - 3),
      link,
    };
  }

  // store: {career, save()}; avatar: createAvatar result; look: () => shirt and face.
  function create({ view, avatar, store, look }) {
    const { ctx, rect, text } = view;
    let busy = null;      // {id, since, changes} exercise under way
    let focus = 0;
    const layout = () => boxes(view.layout);
    const { ACTIONS, STATS } = Career;

    const background = () => {
      rect(0, 0, view.W, view.H, '#14142a');
      for (let y = 0; y < view.H; y += 6) rect(0, y, view.W, 1, '#1b1b38');
    };
    const button = (b, label, color, ink = '#14142a') => {
      rect(b.x, b.y, b.w, b.h, color);
      text(label, b.x + b.w / 2, b.y + Math.floor((b.h - 5) / 2), ink, 1, 'center');
    };
    function header(title) {
      const b = layout();
      background();
      button(b.back, 'BACK', '#2b2b4a', '#fff');
      text(title, b.title.x, b.title.y, '#f9d56e', view.layout.portrait ? 1 : 2, 'center');
    }
    function bar(x, y, w, id, tall = 5) {
      const value = store.career.stats[id];
      rect(x, y, w, tall, '#05050f');
      rect(x, y, Math.round((w * value) / Career.MAX), tall, COLORS[id]);
      for (let i = 1; i < 5; i++) rect(x + Math.round((w * i) / 5), y, 1, tall, '#14142a');
    }

    function train(id, now) {
      if (busy && now - busy.since < ACTION_TIME) return null;
      const changes = Career.train(store.career, id);
      if (!changes) return null;
      busy = { id, since: now, changes };
      store.save();
      return { type: 'trained', id };
    }

    // ---------- Training room ----------

    // The athlete doing the exercise, standing when there is none.
    function exercise(b, now) {
      const s = b.stage;
      rect(s.x, s.y, s.w, s.h, '#0d0d1f');
      const cx = s.x + s.w / 2;
      const scale = Math.min(1.3, (s.h - 14) / 96);
      const floor = Math.round(s.y + s.h - 6);
      const doing = busy && now - busy.since < ACTION_TIME ? busy.id : null;
      const t = now / 1000;
      const { kinds } = Poses;
      ctx.save();
      ctx.beginPath();
      ctx.rect(s.x, s.y, s.w, s.h);
      ctx.clip();
      rect(s.x, floor, s.w, 2, '#5a5a80');
      let move = kinds.run(0, 0), yaw = Math.PI, x = cx, y = floor;
      if (doing === 'run') {
        move = kinds.run(t * 3); yaw = SIDE;
        for (let i = 0; i < 6; i++) rect(s.x + ((i * 41 - now / 4) % s.w + s.w) % s.w, floor + 3, 12, 1, '#9ab');
      } else if (doing === 'rope') {
        const turn = t * 11, hop = Math.max(0, Math.sin(turn));
        move = kinds.run(0, 0); y = floor - hop * 10 * scale;
        for (let a = -1; a <= 1; a += 0.04) {
          const ry = floor - (34 - Math.cos(turn) * 36 * (1 - a * a)) * scale - 2;
          rect(x + a * 30 * scale, ry, 2, 2, '#f4f4f4');
        }
      } else if (doing === 'weights') {
        const up = 0.5 - 0.5 * Math.cos(t * 6);
        move = kinds.keeper(0, 1, t);
        const lift = y - (40 + up * 42) * scale;
        rect(x - 30 * scale, lift, 60 * scale, 2, '#c9d1dc');
        for (const side of [-1, 1]) rect(x + side * 30 * scale - 3, lift - 8, 6, 18, '#e8505b');
      } else if (doing === 'boxJumps') {
        const p = (t * 1.6) % 1, hop = Math.sin(Math.PI * p);
        rect(cx + 6, floor - 18 * scale, 28 * scale, 18 * scale, '#a9743f');
        move = kinds.climb(p * 2); x = cx - 24 * scale + p * 42 * scale; y = floor - hop * 30 * scale; yaw = SIDE;
      } else if (doing === 'target') {
        move = kinds.shoot(0.3, (t * 2) % 1 < 0.2 ? 1 : 0); x = cx - 22; yaw = SIDE;
        for (const [r, color] of [[10, '#f4f4f4'], [7, '#e8505b'], [4, '#f4f4f4'], [2, '#e8505b']]) {
          rect(s.x + s.w - 16 - r, floor - 50 * scale - r, r * 2, r * 2, color);
        }
      } else if (doing === 'yoga') {
        move = kinds.balance(Math.sin(t * 2) * 0.12, 'up', 1);
      } else if (doing === 'drills') {
        move = kinds.keeper(0.3 + 0.2 * Math.sin(t * 9), Math.sin(t * 5) > 0 ? 1 : -1, t);
        rect(cx + Math.sin(t * 7) * 36, floor - 40 * scale + Math.cos(t * 11) * 26 * scale, 5, 5, '#f39c4a');
      } else if (doing === 'eat') {
        move = kinds.shoot(0.9, 0); yaw = SIDE; x = cx - 12;
        move.props = [];
        rect(cx + 12, floor - 26 * scale, 26 * scale, 3, '#a9743f');
        rect(cx + 23, floor - 26 * scale, 3, 26 * scale, '#a9743f');
        const bite = Math.floor(t * 5) % 3;
        for (let i = 0; i < 3 - bite; i++) rect(cx + 16 + i * 6, floor - 26 * scale - 5, 5, 5, ['#e8505b', '#5be37d', '#f9d56e'][i]);
      } else if (doing === 'rest') {
        move = kinds.dive(0, 0); move.roll = SIDE; y = floor + 24 * scale; yaw = SIDE;
        rect(cx - 52 * scale, floor - 8, 104 * scale, 8, '#2b62c9');
        for (let i = 0; i < 3; i++) {
          const p = (t * 0.8 + i / 3) % 1;
          text('Z', cx + 30 + p * 18, floor - 34 - p * 22, '#fff', 1, 'center');
        }
      } else if (doing === 'doping') {
        move = kinds.keeper(0, 1, t * 5);
        x = cx + Math.sin(t * 40) * 2;
        for (let i = 0; i < 18; i++) {
          rect(cx + Math.cos(i * 2.4 + t * 4) * (20 + (i % 5) * 7), floor - 30 * scale + Math.sin(i * 1.7 + t * 5) * 30 * scale, 2, 2, '#b58cf0');
        }
      }
      avatar.draw(ctx, x, y, scale, look(), { move }, yaw);
      ctx.restore();

      // What the exercise did.
      if (busy) {
        const rows = Object.entries(busy.changes);
        const name = (id) => STATS.find((x2) => x2.id === id).name;
        const gains = rows.filter(([, v]) => v > 0);
        const losses = rows.filter(([, v]) => v < 0);
        const lines = gains.map(([id, v]) => [`+${v} ${name(id)}`, '#5be37d']);
        if (losses.length) lines.push([`THE REST ${losses[0][1]}`, '#e8505b']);
        if (!rows.length) lines.push(['ALREADY FULL', '#9ab']);
        lines.forEach(([str, color], i) => text(str, s.x + 4, s.y + 4 + i * 8, color));
      } else text('FREE TRAINING', s.x + s.w / 2, s.y + 4, '#9ab', 1, 'center');
    }

    function drawTraining(now, touch) {
      const b = layout();
      header('TRAINING');
      exercise(b, now);
      STATS.forEach((stat, i) => {
        const y = b.bars.y + i * b.bars.step;
        text(stat.name, b.bars.x, y, '#9ab');
        bar(b.bars.x + 38, y, b.bars.w - 56, stat.id);
        text(`${store.career.stats[stat.id]}`, b.bars.x + b.bars.w, y, '#fff', 1, 'right');
      });
      const wait = busy && now - busy.since < ACTION_TIME;
      ACTIONS.forEach((a, i) => {
        const c = b.action(i);
        if (!touch && i === focus) rect(c.x - 1, c.y - 1, c.w + 2, c.h + 2, '#ffffff');
        rect(c.x, c.y, c.w, c.h, a.risky ? '#5a2b6e' : wait ? '#24304a' : '#2b4a78');
        const gives = a.risky ? 'ONE FULL - REST DOWN'
          : Object.keys(a.gain).map((id) => id.slice(0, 3).toUpperCase()).join(' ');
        text(a.name, c.x + c.w / 2, c.y + c.h / 2 - 7, '#fff', 1, 'center');
        text(gives, c.x + c.w / 2, c.y + c.h / 2 + 2, a.risky ? '#f9d56e' : '#74acdf', 1, 'center');
      });
      button(b.other, 'SEE MY ATHLETE', '#f9d56e');
    }

    // ---------- Athlete ----------

    function drawAthlete() {
      const b = layout(), career = store.career;
      const { portrait } = view.layout;
      header('MY ATHLETE');
      STATS.forEach((stat, i) => {
        const r = b.stat(i);
        const helps = Object.entries(Career.EVENTS).filter(([, e]) => e[1] === stat.id);
        rect(r.x, r.y, r.w, r.h, '#1f1f3a');
        text(stat.name, r.x + 4, r.y + 3, '#fff');
        text(`${career.stats[stat.id]}%`, r.x + r.w - 4, r.y + 3, COLORS[stat.id], 1, 'right');
        if (portrait) bar(r.x + 4, r.y + 11, r.w - 8, stat.id, 6);
        else bar(r.x + 48, r.y + 2, r.w - 76, stat.id, 6);
        // The events this bar matters most to, gold ones lit.
        let x = r.x + 4, y = r.y + (portrait ? 20 : 11);
        for (const [id, [short]] of helps) {
          const wide = short.length * 4 + 5;
          if (x + wide > r.x + r.w - 2) { x = r.x + 4; y += 8; }
          if (y + 5 > r.y + r.h) break;
          text(short, x, y, MEDAL_COLORS[career.medals[id]] || '#778');
          x += wide;
        }
      });
      button(b.link, 'GO TRAIN', '#5be37d', '#10300f');
    }

    // ---------- Champion ----------

    function drawChampion(now, art) {
      const { w: W, h: H, portrait, top } = view.layout;
      header('THE FINAL');
      const y = portrait ? top + 40 : 20;
      text('OLYMPIC', W / 2, y, '#f9d56e', 4, 'center');
      text('CHAMPION!', W / 2, y + 26, '#f9d56e', portrait ? 4 : 3, 'center');
      art.podium(W / 2, portrait ? Math.round(H * 0.72) : 150,
        portrait ? { step: 60, height: 48, scale: 1.2 } : { step: 50, height: 32, scale: 0.8 }, look().country, now);
      for (let i = 0; i < 5; i++) medal(rect, 'gold', W / 2 - 40 + i * 20, portrait ? Math.round(H * 0.76) : 154);
      text(`${Career.total} GOLD MEDALS`, W / 2, portrait ? Math.round(H * 0.76) + 24 : 172, '#fff', 1, 'center');
    }

    // ---------- Input ----------
    // Screens: 'athlete', 'training' and 'champion'. Actions: {type: 'screen', id},
    // {type: 'back'}, {type: 'trained'} or null.

    function click(screen, x, y, now) {
      const b = layout();
      if (inside(b.back, x, y)) return { type: 'back' };
      if (screen === 'athlete') {
        return inside(b.link, x, y) ? { type: 'screen', id: 'training' } : null;
      }
      if (screen !== 'training') return null;
      if (inside(b.other, x, y)) return { type: 'screen', id: 'athlete' };
      const i = ACTIONS.findIndex((_, n) => inside(b.action(n), x, y));
      return i < 0 ? null : train(ACTIONS[i].id, now);
    }

    function key(screen, e, now) {
      if (e.key === 'Escape' || e.key === 'Backspace') return { type: 'back' };
      if (screen === 'athlete') return e.key === 'Enter' ? { type: 'screen', id: 'training' } : null;
      if (screen !== 'training') return null;
      if (e.key === 'Enter' || e.key === ' ') return train(ACTIONS[focus].id, now);
      if (e.key === 'Tab') return { type: 'screen', id: 'athlete' };
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 }[e.key];
      if (!step) return null;
      focus = (focus + step + ACTIONS.length) % ACTIONS.length;
      return { type: 'changed' };
    }

    const hovering = (screen, x, y) => {
      const b = layout();
      if (inside(b.back, x, y)) return true;
      if (screen === 'athlete') return inside(b.link, x, y);
      return screen === 'training' && (inside(b.other, x, y) || ACTIONS.some((_, i) => inside(b.action(i), x, y)));
    };

    function draw(screen, now, touch, art) {
      if (screen === 'athlete') drawAthlete();
      else if (screen === 'training') drawTraining(now, touch);
      else drawChampion(now, art);
    }

    return { click, key, hovering, draw };
  }

  const api = { create, boxes, medal, MEDAL_COLORS };
  if (typeof module !== 'undefined') module.exports = api;
  else root.CareerUi = api;
})(this);
