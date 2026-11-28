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
    ...[
      ['sprint100', '100M DASH', 'ALTERNATE THUMBS - FLICK: DIP'],
      ['javelin', 'JAVELIN', 'SWIPE: RUN - HOLD AND TILT'],
      ['highJump', 'HIGH JUMP', 'RUN - TILT THE CURVE - FLICK'],
      ['poleVault', 'POLE VAULT', 'RUN - HOLD: PLANT - LIFT'],
      ['discus', 'DISCUS', 'TWIST OR CIRCLES - FLICK'],
      ['hammer', 'HAMMER', 'ROLL OR CIRCLES - TAP'],
      ['swimming', '100M FREESTYLE', 'STROKES - TILT: BREATHE'],
      ['diving', 'DIVING', 'FLICK - SWIPE - HOLD TO OPEN'],
      ['rowing', 'ROWING', 'TWO FINGERS DOWN ON THE BEAT'],
      ['canoe', 'CANOE SLALOM', 'TAP SIDES - TILT: STEER'],
      ['surfing', 'SURFING', 'TILT: RIDE - FLICK: JUMP'],
      ['cycling', 'TRACK CYCLING', 'CIRCLES: PEDAL - TILT: LANE'],
      ['climbing', 'SPEED CLIMBING', 'TAP THE SIDE OF THE HOLD'],
      ['beam', 'BALANCE BEAM', 'TILT: BALANCE - SWIPE: MOVES'],
      ['trap', 'TRAP SHOOTING', 'MOVE THE PHONE - TAP: SHOOT'],
      ['tableTennis', 'TABLE TENNIS', 'SWIPE: HIT - TILT: SPIN'],
      ['penalty', 'PENALTY KICKS', 'SWIPE: SHOOT - TILT: SAVE'],
      ['fencing', 'FENCING', 'TILT: PARRY - FLICK: LUNGE'],
    ].map(([id, name, hint]) => ({ id, name, available: true, hint })),
  ];
  // The event grid shows one group at a time, six events each.
  const PAGE = 6;
  const PAGES = ['CLASSICS', 'TRACK AND FIELD', 'WATER AND WHEELS', 'SKILL AND DUELS'];

  const inside = (b, x, y) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  const box = (x, y, w, h) => ({ x, y, w, h });

  // Hit boxes and positions in logical coordinates.
  function titleBoxes({ w: W, h: H, portrait, top, bottom }) {
    if (!portrait) {
      return {
        title: [{ text: 'FINGER PODIUM', x: W / 2, y: 10, size: 4 }],
        podium: { cx: W / 2, base: 126, step: 50, height: 32, scale: 0.8 },
        modes: [box(4, 146, 75, 22), box(241, 146, 75, 22)],
        extras: [box(83, 146, 75, 22), box(162, 146, 75, 22)],
        tally: box(70, 130, 180, 13),
        hint: { x: W / 2, y: 172 },
      };
    }
    const hint = H - bottom - 10;
    const multi = box(10, hint - 34, W - 20, 24);
    const half = (W - 26) / 2;
    const extras = [box(10, multi.y - 32, half, 26), box(16 + half, multi.y - 32, half, 26)];
    const single = box(10, extras[0].y - 36, W - 20, 30);
    const tally = box(10, single.y - 19, W - 20, 15);
    const titleY = top + 14;
    const free = tally.y - (titleY + 70); // room between the title and the buttons
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
      extras,
      tally,
      hint: { x: W / 2, y: hint },
    };
  }

  function eventBoxes({ w: W, h: H, portrait, top, bottom }) {
    const cols = portrait ? 2 : 3;
    const rows = Math.ceil(PAGE / cols);
    const gap = portrait ? 4 : 6;
    const first = portrait ? top + 24 : 22;
    const end = portrait ? H - bottom - 36 : 154;
    const pager = portrait ? H - bottom - 31 : 158;
    const side = portrait ? 4 : 10;
    const w = Math.floor((W - side * 2 - gap * (cols - 1)) / cols);
    const h = Math.floor((end - first - gap * (rows - 1)) / rows);
    return {
      cols,
      back: box(4, portrait ? top + 3 : 4, 30, 13),
      title: { x: portrait ? W / 2 + 14 : W / 2, y: portrait ? top + 7 : 6, size: portrait ? 1 : 2 },
      // Card of the event i, on its own page.
      card: (i) => box(side + ((i % PAGE) % cols) * (w + gap), first + Math.floor((i % PAGE) / cols) * (h + gap), w, h),
      previous: box(side, pager, 40, portrait ? 20 : 12),
      next: box(W - side - 40, pager, 40, portrait ? 20 : 12),
      group: { x: W / 2, y: pager + (portrait ? 4 : 0) },
      hint: { x: W / 2, y: portrait ? H - bottom - 8 : 172 },
    };
  }

  // The athlete's menus, reached from the title screen.
  const EXTRAS = [
    { id: 'athlete', name: 'MY ATHLETE', key: 'a' },
    { id: 'training', name: 'TRAINING', key: 't' },
  ];

  // art: createArt() result; only needed by the draw functions.
  // medals: () => {eventId: 'gold' | 'silver' | 'bronze'} won so far.
  function createHome(view, art, medals = () => ({})) {
    const { rect, text } = view;
    let focus = 0; // keyboard focus on the event grid
    let page = 0;

    // Shows another group; the focus keeps its place in the grid.
    function turn(step) {
      page = (page + step + PAGES.length) % PAGES.length;
      focus = page * PAGE + (focus % PAGE);
      return { type: 'changed' };
    }

    const golds = () => Object.values(medals()).filter((m) => m === 'gold').length;
    const champion = () => golds() === EVENTS.length; // the final is open

    // Actions: {type: 'mode', id}, {type: 'event', id}, {type: 'screen', id},
    // {type: 'back'}, {type: 'changed'} or null.
    const pick = (list, i, type) => (list[i] && list[i].available ? { type, id: list[i].id } : null);

    function titleKey(e) {
      if (e.key === 'Enter') return pick(MODES, 0, 'mode');
      const key = String(e.key).toLowerCase();
      const extra = EXTRAS.find((x) => x.key === key);
      if (extra) return { type: 'screen', id: extra.id };
      return key === 'f' && champion() ? { type: 'screen', id: 'champion' } : null;
    }

    function titleClick(x, y) {
      const boxes = titleBoxes(view.layout);
      const extra = boxes.extras.findIndex((b) => inside(b, x, y));
      if (extra >= 0) return { type: 'screen', id: EXTRAS[extra].id };
      if (champion() && inside(boxes.tally, x, y)) return { type: 'screen', id: 'champion' };
      return pick(MODES, boxes.modes.findIndex((b) => inside(b, x, y)), 'mode');
    }

    function eventKey(e) {
      if (e.key === 'PageDown') return turn(1);
      if (e.key === 'PageUp') return turn(-1);
      if (e.key === 'Escape' || e.key === 'Backspace') return { type: 'back' };
      if (e.key === 'Enter') return pick(EVENTS, focus, 'event');
      const { cols } = eventBoxes(view.layout);
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
      if (!step) return null;
      focus = (focus + step + EVENTS.length) % EVENTS.length;
      page = Math.floor(focus / PAGE);
      return { type: 'changed' };
    }

    function eventClick(x, y) {
      const boxes = eventBoxes(view.layout);
      if (inside(boxes.back, x, y)) return { type: 'back' };
      if (inside(boxes.previous, x, y)) return turn(-1);
      if (inside(boxes.next, x, y)) return turn(1);
      return pick(EVENTS, cardAt(x, y), 'event');
    }

    // Event whose card on this page holds the point, or -1.
    function cardAt(x, y) {
      const { card } = eventBoxes(view.layout);
      return EVENTS.findIndex((_, n) => Math.floor(n / PAGE) === page && inside(card(n), x, y));
    }

    const titleHovering = (x, y) => titleClick(x, y) !== null;
    // Only looks: pointing at an arrow must not turn the page.
    const eventHovering = (x, y) => {
      const b = eventBoxes(view.layout);
      return [b.back, b.previous, b.next].some((box_) => inside(box_, x, y)) ||
        pick(EVENTS, cardAt(x, y), 'event') !== null;
    };

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
      EXTRAS.forEach((extra, i) => {
        const b = boxes.extras[i];
        rect(b.x, b.y, b.w, b.h, '#f9d56e');
        text(extra.name, b.x + b.w / 2, middle(b), '#14142a', 1, 'center');
      });
      const t = boxes.tally;
      if (champion()) {
        rect(t.x, t.y, t.w, t.h, Math.floor(now / 400) % 2 ? '#f9d56e' : '#ffffff');
        text('PLAY THE FINAL!', t.x + t.w / 2, middle(t), '#14142a', 1, 'center');
      } else {
        text(`GOLD ${golds()}/${EVENTS.length} - WIN ALL FOR THE FINAL`, t.x + t.w / 2, middle(t), '#f9d56e', 1, 'center');
      }
      if (!touch) text('ENTER: PLAY - A: ATHLETE - T: TRAINING', boxes.hint.x, boxes.hint.y, '#667', 1, 'center');
    }

    function drawEvents(touch) {
      const boxes = eventBoxes(view.layout);
      const { ctx } = view;
      background();
      const back = boxes.back;
      rect(back.x, back.y, back.w, back.h, '#2b2b4a');
      text('BACK', back.x + back.w / 2, middle(back), '#fff', 1, 'center');
      text('CHOOSE YOUR EVENT', boxes.title.x, boxes.title.y, '#f9d56e', boxes.title.size, 'center');
      const { portrait, top } = view.layout;
      const tally = `GOLD ${golds()}/${EVENTS.length}`;
      if (portrait) text(tally, view.W / 2, top + 16, '#fff', 1, 'center');
      else text(tally, view.W - 6, 8, '#fff', 1, 'right');

      for (const [b, label] of [[boxes.previous, '<'], [boxes.next, '>']]) {
        rect(b.x, b.y, b.w, b.h, '#f9d56e');
        text(label, b.x + b.w / 2, middle(b, 2), '#14142a', 2, 'center');
      }
      text(PAGES[page], boxes.group.x, boxes.group.y, '#fff', 1, 'center');
      PAGES.forEach((_, i) => rect(boxes.group.x - 17 + i * 9, boxes.group.y + 8, 5, 3, i === page ? '#f9d56e' : '#556'));

      EVENTS.forEach((event, i) => {
        if (Math.floor(i / PAGE) !== page) return;
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
        const won = medals()[event.id];
        if (won) root.CareerUi.medal(rect, won, c.x + c.w - 9, c.y + 2);
      });
      if (!touch) {
        text('ARROWS: MOVE - PAGE UP/DOWN - ENTER - ESC', boxes.hint.x, boxes.hint.y, '#667', 1, 'center');
      }
    }

    return {
      title: { key: titleKey, click: titleClick, hovering: titleHovering, draw: drawTitle },
      events: { key: eventKey, click: eventClick, hovering: eventHovering, draw: drawEvents },
    };
  }

  const api = { MODES, EXTRAS, EVENTS, PAGE, PAGES, createHome, titleBoxes, eventBoxes };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Home = api;
})(this);
