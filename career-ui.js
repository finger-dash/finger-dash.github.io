// The athlete's menus: the training bars, the training room and the champion's
// screen once every gold is won.
(function (root) {
  'use strict';

  const ACTION_TIME = 4000; // ms an exercise is shown
  const COLORS = {
    speed: '#74acdf', strength: '#e8505b', jump: '#5be37d', stamina: '#f9d56e',
    aim: '#f39c4a', balance: '#b58cf0', reflexes: '#6fe0d0',
  };
  const MEDAL_COLORS = { gold: '#f9d56e', silver: '#c9d1dc', bronze: '#d08a52' };
  const SIDE = Math.PI / 2;

  const box = (x, y, w, h) => ({ x, y, w, h });
  const Back = typeof module !== 'undefined' ? require('./layout.js') : root.Layout;
  // Minutes and seconds, rounded up so that it never shows 0:00 while waiting.
  const clock = (ms) => {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
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
    const back = Back.backBox({ portrait, top });
    const title = { x: portrait ? (W + back.x + back.w) / 2 : W / 2, y: portrait ? top + 11 : 9 };
    if (!portrait) {
      return {
        back, title,
        stage: box(10, 26, 108, 76),
        bars: { x: 10, y: 107, w: 108, step: 9 },
        action: (i) => box(126 + (i % 2) * 94, 26 + Math.floor(i / 2) * 26, 90, 23),
        other: box(126, 158, 184, 14),
        stat: (i) => box(10, 26 + i * 18, W - 20, 17),
        link: box(100, 158, 120, 14),
      };
    }
    const link = box(10, H - bottom - 26, W - 20, 21);
    const actions = link.y - 5 * 23 - 4;
    const step = 10;
    const bars = { x: 8, y: actions - 7 * step - 6, w: W - 16, step };
    const first = top + 27;
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
      Back.drawBack(view, b.back);
      text(title, b.title.x, b.title.y, '#f9d56e', view.layout.portrait ? 1 : 2, 'center');
    }
    function bar(x, y, w, id, tall = 5) {
      const value = store.career.stats[id];
      rect(x, y, w, tall, '#05050f');
      rect(x, y, Math.round((w * value) / Career.MAX), tall, COLORS[id]);
      for (let i = 1; i < 5; i++) rect(x + Math.round((w * i) / 5), y, 1, tall, '#14142a');
      // What the events ask for.
      rect(x + Math.round((w * Career.MIN) / Career.MAX), y - 1, 1, tall + 2, '#ffffff');
    }

    function train(id, now) {
      const changes = Career.train(store.career, id);
      if (!changes) return null;
      busy = { id, since: now, changes };
      store.save();
      return { type: 'trained', id };
    }

    // ---------- Training room ----------

    // A round target on a stand, with the holes of the shots so far.
    function target(cx, floor, cy, shots) {
      rect(cx - 1, cy, 3, floor - cy, '#a9743f');
      for (const [r, color] of [[12, '#10101c'], [11, '#f4f4f4'], [8, '#e8505b'], [5, '#f4f4f4'], [2.5, '#e8505b']]) {
        for (let v = -r; v < r; v++) {
          const half = Math.round(Math.sqrt(r * r - (v + 0.5) ** 2));
          rect(cx - half, Math.round(cy) + v, half * 2, 1, color);
        }
      }
      for (const [dx, dy] of [[1, -2], [-4, 3], [3, 4], [-1, 0]].slice(0, shots)) {
        rect(cx + dx, Math.round(cy) + dy, 2, 2, '#10101c');
      }
    }

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
        // Down, up, press the bar overhead and bring it back: one rep every 2 s.
        const p = ((now - busy.since) / 2000) % 1;
        const ramp = (from, to) => Math.max(0, Math.min(1, (p - from) / (to - from)));
        const squat = ramp(0, 0.2) - ramp(0.2, 0.4);
        const press = ramp(0.42, 0.62) - ramp(0.82, 1);
        move = kinds.press(squat, press); yaw = Math.PI - 0.35;
        move.face = press > 0.5 ? 'strain' : null;
      } else if (doing === 'boxJumps') {
        const p = (t * 1.6) % 1, hop = Math.sin(Math.PI * p);
        rect(cx + 6, floor - 18 * scale, 28 * scale, 18 * scale, '#a9743f');
        move = kinds.climb(p * 2); x = cx - 24 * scale + p * 42 * scale; y = floor - hop * 30 * scale; yaw = SIDE;
      } else if (doing === 'target') {
        const p = ((now - busy.since) / 1000) % 1; // one shot a second
        const kick = p > 0.55 && p < 0.72 ? 1 - (p - 0.55) / 0.34 : 0;
        move = kinds.rifle(kick); yaw = SIDE; x = s.x + s.w * 0.34;
        target(s.x + s.w - 14, floor, floor - 52 * scale, Math.floor((now - busy.since) / 1000 + 0.45));
      } else if (doing === 'yoga') {
        rect(cx - 30 * scale, floor - 3, 60 * scale, 3, '#7a4bb0');
        move = kinds.lotus(Math.sin(t * 2)); y = floor - 2;
      } else if (doing === 'juggle') {
        move = kinds.juggle((now - busy.since) / 520);
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
      avatar.draw(ctx, x, y, scale, move.face ? { ...look(), face: move.face } : look(), { move }, yaw);
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
      const wait = Career.wait(store.career);
      ACTIONS.forEach((a, i) => {
        const c = b.action(i);
        if (!touch && !wait && i === focus) rect(c.x - 1, c.y - 1, c.w + 2, c.h + 2, '#ffffff');
        rect(c.x, c.y, c.w, c.h, a.risky ? '#5a2b6e' : '#2b4a78');
        const gives = a.risky ? 'ONE FULL - REST DOWN'
          : Object.keys(a.gain).map((id) => id.slice(0, 3).toUpperCase()).join(' ');
        text(a.name, c.x + c.w / 2, c.y + c.h / 2 - 7, '#fff', 1, 'center');
        text(gives, c.x + c.w / 2, c.y + c.h / 2 + 2, a.risky ? '#f9d56e' : '#74acdf', 1, 'center');
      });
      if (wait) resting(wait);
      button(b.other, 'SEE MY ATHLETE', '#f9d56e');
    }

    // A see-through window over the buttons until the next session.
    function resting(left) {
      const b = layout();
      const first = b.action(0), last = b.action(ACTIONS.length - 1);
      const area = box(first.x - 2, first.y - 2, last.x + last.w - first.x + 4, last.y + last.h - first.y + 4);
      ctx.globalAlpha = 0.82;
      rect(area.x, area.y, area.w, area.h, '#05050f');
      ctx.globalAlpha = 1;
      for (const [x, y, w, h] of [[0, 0, area.w, 1], [0, area.h - 1, area.w, 1], [0, 0, 1, area.h], [area.w - 1, 0, 1, area.h]]) {
        rect(area.x + x, area.y + y, w, h, '#f9d56e');
      }
      const cx = area.x + area.w / 2, cy = Math.round(area.y + area.h / 2);
      text('RESTING', cx, cy - 36, '#f9d56e', 2, 'center');
      text('YOU HAVE TO WAIT 1 HOUR', cx, cy - 18, '#fff', 1, 'center');
      text('TO TRAIN AGAIN', cx, cy - 10, '#fff', 1, 'center');
      text(clock(left), cx, cy + 4, '#5be37d', 4, 'center');
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
          const locked = Career.missing(career, id).length > 0;
          const wide = short.length * 4 + 5;
          if (x + wide > r.x + r.w - 2) { x = r.x + 4; y += 8; }
          if (y + 5 > r.y + r.h) break;
          text(short, x, y, locked ? '#a85060' : MEDAL_COLORS[career.medals[id]] || '#bbc');
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
      return screen === 'training' && (inside(b.other, x, y) ||
        (!Career.wait(store.career) && ACTIONS.some((_, i) => inside(b.action(i), x, y))));
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
