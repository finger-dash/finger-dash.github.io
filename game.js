// Game shell: input, state machine, HUD and main loop.
(function () {
  'use strict';

  const canvas = document.getElementById('game');
  const view = Renderer.createRenderer(canvas, Track, Race, Countries, Font, Avatar, Layout);
  const menu = Menu.createMenu(view, Avatar.createAvatar(Countries, Font, 4), Countries, Font);
  const { text, rect, ctx } = view;

  let state, race, countdown, resultsAt, jumps, lastSource;
  let debug = false;
  let best = null;
  const profile = { name: '', country: 'ARG', difficulty: 'normal' };
  try {
    profile.name = Font.cleanName(localStorage.getItem('hurdles.name'));
    profile.country = Countries.byId(localStorage.getItem('hurdles.country')).id;
    profile.difficulty = localStorage.getItem('hurdles.level') || 'normal';
    best = Number(localStorage.getItem('hurdles.best400v2')) || null;
  } catch (_) {}
  if (!Race.DIFFICULTY[profile.difficulty]) profile.difficulty = 'normal';
  const save = (key, value) => { try { localStorage.setItem(key, String(value)); } catch (_) {} };

  const detector = new Gestures.GestureDetector((source) => {
    lastSource = source;
    jump();
  });
  try {
    detector.naturalScroll = localStorage.getItem('hurdles.natural') !== '0';
  } catch (_) {}

  const mobile = Mobile.createMobile({ canvas, detector, Font, Layout });

  function newRace() {
    detector.reset();
    race = Race.createRace({
      difficulty: profile.difficulty, country: profile.country, playerName: profile.name.trim(),
    });
    countdown = 0; jumps = 0; lastSource = '-';
  }

  function openMenu() {
    newRace();
    state = 'menu';
    mobile.closeName();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // Must run inside a click or key press so the pointer can be locked.
  function start() {
    newRace();
    state = 'countdown';
    countdown = 3;
    canvas.style.cursor = '';
    mobile.closeName();
    if (mobile.isTouch()) mobile.enterFullscreen();
    else lockPointer();
  }

  function saveProfile() {
    save('hurdles.name', profile.name);
    save('hurdles.country', profile.country);
    save('hurdles.level', profile.difficulty);
  }

  function menuAction(action) {
    if (action === 'changed') saveProfile();
    if (action === 'start') start();
    if (action === 'name' && mobile.isTouch()) {
      mobile.editName(profile.name, (name) => {
        profile.name = name;
        saveProfile();
      });
    }
  }

  function jump() {
    if (state === 'running' && Race.jump(race.player)) jumps++;
  }

  // ---------- Input ----------

  window.addEventListener('wheel', (e) => {
    e.preventDefault(); // blocks page zoom and back/forward swipe
    // Safari tells whether the scroll direction is inverted.
    if (typeof e.webkitDirectionInvertedFromDevice === 'boolean') {
      detector.naturalScroll = e.webkitDirectionInvertedFromDevice;
    }
    detector.wheel(e, performance.now());
  }, { passive: false });

  // One finger: pointer movement. Pointer Lock removes the screen edges.
  const locked = () => document.pointerLockElement === canvas;
  function lockPointer() {
    try {
      const request = canvas.requestPointerLock();
      if (request) request.catch(() => {});
    } catch (_) {}
  }
  window.addEventListener('mousemove', (e) => {
    if (!mobile.fromTouch()) detector.move(e.movementY, performance.now());
  });

  // Ignores accidental taps right after the results show up.
  const resultsReady = () => performance.now() - resultsAt > 1500;

  // Keyboard fallback: alternate left/right to run, space to jump.
  let lastArrow = '';
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return; // keep browser shortcuts
    if (mobile.isEditing()) return; // the text field handles its own keys
    if (state === 'menu') {
      const action = menu.key(profile, e);
      if (action) e.preventDefault();
      menuAction(action);
      return;
    }
    if (e.repeat) return;
    if (state === 'finished') {
      if (e.code === 'Enter' && resultsReady()) start();
      else if (e.code === 'KeyM' || e.code === 'Escape') openMenu();
      return;
    }
    if (e.code === 'KeyR') openMenu();
    else if (e.code === 'KeyD') debug = !debug;
    else if (e.code === 'KeyI') {
      detector.naturalScroll = !detector.naturalScroll;
      save('hurdles.natural', detector.naturalScroll ? '1' : '0');
    } else if (e.code === 'Space') { e.preventDefault(); jump(); lastSource = 'key'; }
    else if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && e.code !== lastArrow) {
      lastArrow = e.code;
      detector.addStroke('key');
    }
  });

  // Mouse position in logical canvas coordinates.
  function point(e) {
    const box = canvas.getBoundingClientRect();
    return [(e.clientX - box.left) * (view.W / box.width), (e.clientY - box.top) * (view.H / box.height)];
  }
  // Positions that depend on the screen layout.
  function resultsBoxes() {
    const { w, h, portrait } = view.layout;
    const panel = portrait
      ? { x: 5, y: Math.round((h - 172) / 2), w: w - 10, h: 172 }
      : { x: 52, y: 14, w: 216, h: 152 };
    const bw = portrait ? 83 : 90, bh = portrait ? 22 : 15;
    const by = panel.y + panel.h - bh - 6;
    return {
      panel,
      retry: { x: w / 2 - bw - 4, y: by, w: bw, h: bh },
      menu: { x: w / 2 + 4, y: by, w: bw, h: bh },
    };
  }
  // Touch only: button to leave the race.
  const quitBox = () => ({ x: 5, y: 24 + view.layout.top, w: 30, h: 13 });
  const over = (b, x, y) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;

  window.addEventListener('mousemove', (e) => {
    if (state === 'menu') canvas.style.cursor = menu.hovering(...point(e)) ? 'pointer' : 'default';
    else if (state === 'finished') canvas.style.cursor = 'default';
  });

  // Clicks and taps. Taps act on release, which lets phones open the keyboard.
  // A press that travels is a swipe, so it never presses a button.
  const TAP_SLOP = 12; // CSS px
  const presses = new Map();
  canvas.addEventListener('pointerdown', (e) => presses.set(e.pointerId, [e.clientX, e.clientY]));
  canvas.addEventListener('pointercancel', (e) => presses.delete(e.pointerId));
  canvas.addEventListener('pointerup', (e) => {
    const from = presses.get(e.pointerId);
    presses.delete(e.pointerId);
    if (e.button !== 0 || mobile.needsRotation() || !from) return;
    if (e.pointerType !== 'mouse' &&
        Math.hypot(e.clientX - from[0], e.clientY - from[1]) > TAP_SLOP) return;
    const [x, y] = point(e);
    if (state === 'menu') menuAction(menu.click(profile, x, y));
    else if (state === 'finished') {
      if (!resultsReady()) return;
      const boxes = resultsBoxes();
      if (over(boxes.retry, x, y)) start();
      else if (over(boxes.menu, x, y)) openMenu();
    } else if (e.pointerType !== 'mouse') {
      if (over(quitBox(), x, y)) openMenu();
    } else if (!locked()) lockPointer();
  });

  // ---------- Simulation ----------

  function update(dt, now) {
    if (mobile.needsRotation()) {
      detector.update(now, true);
      return;
    }
    detector.update(now, state === 'running' && race.player.jumpT >= 0);

    if (state === 'countdown') {
      countdown -= dt;
      if (countdown <= 0) {
        state = 'running';
        detector.reset(); // no head start
      }
      return;
    }
    if (state === 'menu') return;

    // The simulation keeps going behind the results so late rivals can finish.
    Race.step(race, dt, detector.charge * Race.MAX_SPEED);

    if (state === 'running' && race.over) {
      state = 'finished';
      resultsAt = now;
      if (document.pointerLockElement) document.exitPointerLock(); // free the cursor
      const t = race.player.finishTime;
      if (t !== null && (!best || t < best)) {
        best = t;
        save('hurdles.best400v2', best);
      }
    }
  }

  // ---------- HUD ----------

  const ordinal = (n) => n + (['ST', 'ND', 'RD'][n - 1] || 'TH');

  function drawHud() {
    const p = race.player;
    const order = Race.standings(race);
    const clock = p.finishTime !== null ? p.finishTime : race.time;
    const { w: W, h: H, horizon, portrait, top, bottom } = view.layout;
    text(`TIME ${clock.toFixed(2)}`, 5, 5 + top, '#fff');
    text(`BEST ${best ? best.toFixed(2) : '--'}`, 5, 13 + top, '#f9d56e');
    text(`${Math.min(Race.DISTANCE, p.s).toFixed(0)}/${Race.DISTANCE}M`, W - 5, 5 + top, '#fff', 1, 'right');
    text(`${(p.speed * 3.6).toFixed(0)} KM/H`, W - 5, 13 + top, '#fff', 1, 'right');
    text(`${ordinal(order.indexOf(p) + 1)}/${order.length}`, W / 2, 4 + top, '#f9d56e', 2, 'center');

    // Power meter, arcade style. Wide and centred on upright phones.
    const step = portrait ? 11 : 5, tall = portrait ? 10 : 7;
    const left = portrait ? (W - 16 * step + 1) / 2 : 5;
    const meterY = H - bottom - tall - 4;
    text('POWER', left, meterY - 8, '#fff');
    for (let i = 0; i < 16; i++) {
      const on = i < Math.round(detector.charge * 16);
      rect(left + i * step, meterY, step - 1, tall, on ? (i < 8 ? '#5be37d' : i < 12 ? '#f9d56e' : '#e8505b') : '#222');
    }
    view.minimap(race);

    if (state === 'running') {
      const hurdle = Race.HURDLES[p.next];
      const alertY = horizon - 26;
      if (p.stumble > 0) text('OUCH!', W / 2, alertY, '#e8505b', 3, 'center');
      else if (race.difficulty !== 'hard' && hurdle && hurdle - p.s < p.speed * 0.5 && p.jumpT < 0) {
        text('JUMP!', W / 2, alertY, '#f9d56e', 3, 'center');
      }
      if (race.winner && !race.winner.isPlayer) {
        const winnerY = portrait ? top + 62 : 18;
        text(`${race.winner.name} WINS!`, W / 2, winnerY, '#fff', 2, 'center');
      }
    }

    if (debug) {
      const rows = [
        `CHARGE ${(detector.charge * 100).toFixed(0)}%`, `SWIPES ${detector.strokes}`,
        `SOURCE ${detector.lastSource}`, `NATURAL ${detector.naturalScroll ? 'ON' : 'OFF'}`,
        `LOCK ${locked() ? 'ON' : 'OFF'}`,
        `JUMP ${lastSource}`, `JUMPS ${jumps}`, `UP PEAK ${detector.upPeak.toFixed(0)}`,
      ];
      rows.forEach((r, i) => text(r, W - 5, 70 + top + i * 8, '#fff', 1, 'right'));
    }
  }

  function panel(x, y, w, h) {
    ctx.globalAlpha = 0.84;
    rect(x, y, w, h, '#10101c');
    ctx.globalAlpha = 1;
  }

  function drawResults() {
    const { panel: box, retry, menu: toMenu } = resultsBoxes();
    const W = view.W;
    panel(box.x, box.y, box.w, box.h);
    const winner = race.winner;
    text(winner.isPlayer ? 'YOU WIN!' : `${winner.name} WINS!`, W / 2, box.y + 6, '#f9d56e', 3, 'center');
    const left = box.x + 14, right = box.x + box.w - 14;
    text('POS', left, box.y + 28, '#9ab');
    text('RUNNER', left + 24, box.y + 28, '#9ab');
    text('TIME', right, box.y + 28, '#9ab', 1, 'right');
    Race.standings(race).forEach((r, i) => {
      const y = box.y + 39 + i * 13;
      if (r.isPlayer) rect(box.x + 8, y - 3, box.w - 16, 11, '#2b4a78');
      const color = r.isPlayer ? '#fff' : '#d8d8e8';
      text(ordinal(i + 1), left, y, color);
      Countries.drawFlag(ctx, r.country, left + 20, y - 1, 10.5, 7);
      text(r.name, left + 34, y, color);
      const result = r.finishTime !== null ? r.finishTime.toFixed(2)
        : r.isPlayer ? 'DNF' : 'RUNNING';
      text(result, right, y, color, 1, 'right');
    });
    const cleared = Race.HURDLES.length - race.player.knocked.size;
    if (race.player.finishTime !== null) {
      text(`HURDLES CLEARED ${cleared}/${Race.HURDLES.length}`, W / 2, box.y + 120, '#9ab', 1, 'center');
    }
    for (const [button, label, color] of [
      [retry, mobile.isTouch() ? 'RETRY' : 'RETRY - ENTER', '#5be37d'],
      [toMenu, mobile.isTouch() ? 'MENU' : 'MENU - M', '#9ab'],
    ]) {
      rect(button.x, button.y, button.w, button.h, color);
      text(label, button.x + button.w / 2, button.y + Math.floor((button.h - 5) / 2), '#10101c', 1, 'center');
    }
  }

  function drawOverlay() {
    const { w: W, h: H, horizon } = view.layout;
    const racing = state === 'running' || state === 'countdown';
    if (racing && mobile.isTouch()) {
      const quit = quitBox();
      rect(quit.x, quit.y, quit.w, quit.h, '#10101c');
      text('MENU', quit.x + quit.w / 2, quit.y + 4, '#fff', 1, 'center');
      if (state === 'countdown') {
        rect(W / 2 - 78, horizon - 3, 156, 11, '#10101c');
        text('SWIPE DOWN TO RUN - FLICK UP TO JUMP', W / 2, horizon, '#fff', 1, 'center');
      }
    } else if (racing && !locked()) {
      text('CLICK TO CAPTURE THE POINTER', W / 2, H - 30, '#fff', 1, 'center');
    }
    if (state === 'countdown') text(Math.ceil(countdown), W / 2, horizon - 32, '#fff', 5, 'center');
    if (state === 'running' && race.time < 0.8) text('GO!', W / 2, horizon - 32, '#5be37d', 5, 'center');
    if (state === 'finished') drawResults();
  }

  let last = performance.now();
  function frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    mobile.syncLayout(view.resize);
    update(dt, now);
    if (state === 'menu') {
      menu.draw(profile, now, mobile.isTouch());
    } else {
      view.scene(race, now);
      if (state !== 'finished') drawHud();
      drawOverlay();
    }
    document.body.classList.toggle('rotate', mobile.needsRotation());
    requestAnimationFrame(frame);
  }

  openMenu();
  requestAnimationFrame(frame);
})();
