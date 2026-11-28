// Title screen (single player or multiplayer) and event selection.
(function (root) {
  'use strict';

  const MODES = [
    { id: 'single', name: 'SINGLE PLAYER', available: true },
    { id: 'multi', name: 'MULTIPLAYER', available: false },
  ];

  // To add an event: set `available`, give it a scene in art.js and register its
  // screen in game.js. `hint` is shown on the runner setup of touch devices.
  const EVENTS = [
    { id: 'hurdles400', name: '400M HURDLES', available: true, hint: 'SWIPE DOWN: RUN - FLICK UP: JUMP' },
    { id: 'longJump', name: 'LONG JUMP', available: true, hint: 'SWIPE DOWN: RUN - FLICK UP: JUMP' },
    { id: 'shotPut', name: 'SHOT PUT', available: true, hint: 'CIRCLES: SPIN - SWIPE UP: THROW' },
    { id: 'archery', name: 'ARCHERY', available: true, hint: 'PULL DOWN, AIM AND LIFT' },
    { id: 'boxing', name: 'BOXING', available: true, hint: 'TAP: PUNCH - TILT: DODGE' },
    { id: 'weightlifting', name: 'WEIGHTLIFTING', available: true, hint: 'TAP LEFT AND RIGHT TO LIFT' },
  ];

  const inside = (b, x, y) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  const box = (x, y, w, h) => ({ x, y, w, h });

  // Hit boxes and positions in logical coordinates.
  function titleBoxes({ w: W, h: H, portrait, top, bottom }) {
    if (!portrait) {
      return {
        title: [{ text: 'FINGER PODIUM', x: W / 2, y: 10, size: 4 }],
        podium: { cx: W / 2, base: 134, step: 50, height: 36, scale: 0.85 },
        modes: [box(18, 142, 138, 24), box(164, 142, 138, 24)],
        hint: { x: W / 2, y: 171 },
      };
    }
    const hint = H - bottom - 10;
    const multi = box(10, hint - 40, W - 20, 30);
    const single = box(10, multi.y - 36, W - 20, 30);
    const titleY = top + 14;
    const free = single.y - (titleY + 70); // room between the title and the buttons
    const height = Math.min(48, Math.round(free * 0.32));
    const scale = Math.min(1.2, (free - height - 14) / 66);
    return {
      title: [
        { text: 'FINGER', x: W / 2, y: titleY, size: 6 },
        { text: 'PODIUM', x: W / 2, y: titleY + 36, size: 6 },
      ],
      podium: {
        cx: W / 2, base: Math.round(titleY + 70 + (free + height + 66 * scale) / 2),
        step: 60, height, scale,
      },
      modes: [single, multi],
      hint: { x: W / 2, y: hint },
    };
  }

  function eventBoxes({ w: W, h: H, portrait, top, bottom }) {
    const cols = portrait ? 2 : 3;
    const rows = Math.ceil(EVENTS.length / cols);
    const gap = portrait ? 4 : 6;
    const first = portrait ? top + 24 : 22;
    const end = portrait ? H - bottom - 14 : 168;
    const side = portrait ? 4 : 10;
    const w = Math.floor((W - side * 2 - gap * (cols - 1)) / cols);
    const h = Math.floor((end - first - gap * (rows - 1)) / rows);
    return {
      cols,
      back: box(4, portrait ? top + 3 : 4, 30, 13),
      title: { x: portrait ? W / 2 + 14 : W / 2, y: portrait ? top + 7 : 6, size: portrait ? 1 : 2 },
      card: (i) => box(side + (i % cols) * (w + gap), first + Math.floor(i / cols) * (h + gap), w, h),
      hint: { x: W / 2, y: portrait ? H - bottom - 9 : 172 },
    };
  }

  // art: createArt() result; only needed by the draw functions.
  function createHome(view, art) {
    const { rect, text } = view;
    let focus = 0; // keyboard focus on the event grid

    // Actions: {type: 'mode', id}, {type: 'event', id}, {type: 'back'}, {type: 'changed'} or null.
    const pick = (list, i, type) => (list[i] && list[i].available ? { type, id: list[i].id } : null);

    function titleKey(e) {
      return e.key === 'Enter' ? pick(MODES, 0, 'mode') : null;
    }

    function titleClick(x, y) {
      const i = titleBoxes(view.layout).modes.findIndex((b) => inside(b, x, y));
      return pick(MODES, i, 'mode');
    }

    function eventKey(e) {
      if (e.key === 'Escape' || e.key === 'Backspace') return { type: 'back' };
      if (e.key === 'Enter') return pick(EVENTS, focus, 'event');
      const { cols } = eventBoxes(view.layout);
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
      if (!step) return null;
      focus = (focus + step + EVENTS.length) % EVENTS.length;
      return { type: 'changed' };
    }

    function eventClick(x, y) {
      const boxes = eventBoxes(view.layout);
      if (inside(boxes.back, x, y)) return { type: 'back' };
      const i = EVENTS.findIndex((_, n) => inside(boxes.card(n), x, y));
      return pick(EVENTS, i, 'event');
    }

    const titleHovering = (x, y) => titleClick(x, y) !== null;
    const eventHovering = (x, y) => eventClick(x, y) !== null;

    function background() {
      const { W, H } = view;
      rect(0, 0, W, H, '#14142a');
      for (let y = 0; y < H; y += 6) rect(0, y, W, 1, '#1b1b38');
    }

    const middle = (b, size = 1) => b.y + Math.floor((b.h - 5 * size) / 2);

    function drawTitle(country, now, touch) {
      const boxes = titleBoxes(view.layout);
      background();
      for (const line of boxes.title) text(line.text, line.x, line.y, '#f9d56e', line.size, 'center');
      const { cx, base, ...size } = boxes.podium;
      art.podium(cx, base, size, country, now);
      MODES.forEach((mode, i) => {
        const b = boxes.modes[i];
        rect(b.x, b.y, b.w, b.h, mode.available ? '#5be37d' : '#2b2b4a');
        if (mode.available) {
          text(mode.name, b.x + b.w / 2, middle(b), '#10300f', 1, 'center');
        } else {
          text(mode.name, b.x + b.w / 2, b.y + b.h / 2 - 7, '#8890b0', 1, 'center');
          text('COMING SOON', b.x + b.w / 2, b.y + b.h / 2 + 3, '#f9d56e', 1, 'center');
        }
      });
      if (!touch) text('ENTER: SINGLE PLAYER', boxes.hint.x, boxes.hint.y, '#667', 1, 'center');
    }

    function drawEvents(touch) {
      const boxes = eventBoxes(view.layout);
      const { ctx } = view;
      background();
      const back = boxes.back;
      rect(back.x, back.y, back.w, back.h, '#2b2b4a');
      text('BACK', back.x + back.w / 2, middle(back), '#fff', 1, 'center');
      text('CHOOSE YOUR EVENT', boxes.title.x, boxes.title.y, '#f9d56e', boxes.title.size, 'center');

      EVENTS.forEach((event, i) => {
        const c = boxes.card(i);
        const focused = !touch && i === focus;
        const border = focused ? '#ffffff' : event.available ? '#f9d56e' : '#2b2b4a';
        rect(c.x, c.y, c.w, c.h, border);
        rect(c.x + 1, c.y + 1, c.w - 2, c.h - 2, event.available ? '#2b4a78' : '#1f1f3a');

        // Picture and name, centred together in the card.
        const { w, h } = root.Art.EVENT_ART;
        const ax = c.x + Math.floor((c.w - w) / 2);
        const ay = c.y + Math.max(2, Math.floor((c.h - h - 11) / 2));
        art.event(event.id, ax, ay);
        if (!event.available) {
          ctx.globalAlpha = 0.45;
          rect(ax, ay, w, h, '#14142a');
          ctx.globalAlpha = 1;
          rect(ax + w - 23, ay + 2, 21, 9, '#10101c'); // badge in the corner
          text('SOON', ax + w - 12, ay + 4, '#f9d56e', 1, 'center');
        }
        text(event.name, c.x + c.w / 2, ay + h + 3, event.available ? '#fff' : '#8890b0', 1, 'center');
      });
      if (!touch) {
        text('ARROWS: MOVE - ENTER: SELECT - ESC: BACK', boxes.hint.x, boxes.hint.y, '#667', 1, 'center');
      }
    }

    return {
      title: { key: titleKey, click: titleClick, hovering: titleHovering, draw: drawTitle },
      events: { key: eventKey, click: eventClick, hovering: eventHovering, draw: drawEvents },
    };
  }

  const api = { MODES, EVENTS, createHome, titleBoxes, eventBoxes };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Home = api;
})(this);
