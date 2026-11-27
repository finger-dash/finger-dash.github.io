// Game shell: input, state machine, HUD and main loop.
(function () {
  'use strict';

  const canvas = document.getElementById('game');
  const view = Renderer.createRenderer(canvas, Track, Race, Countries, Font, Avatar);
  const menu = Menu.createMenu(view, Avatar.createAvatar(Countries, Font, 4), Countries, Font);
  const { text, rect, ctx, W, H } = view;

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
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // Must run inside a click or key press so the pointer can be locked.
  function start() {
    newRace();
    state = 'countdown';
    countdown = 3;
    canvas.style.cursor = '';
    lockPointer();
  }

  function saveProfile() {
    save('hurdles.name', profile.name);
    save('hurdles.country', profile.country);
    save('hurdles.level', profile.difficulty);
  }

  function menuAction(action) {
    if (action === 'changed') saveProfile();
    if (action === 'start') start();
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
  window.addEventListener('mousemove', (e) => detector.move(e.movementY, performance.now()));

  // Ignores accidental taps right after the results show up.
  const resultsReady = () => performance.now() - resultsAt > 1500;

  // Keyboard fallback: alternate left/right to run, space to jump.
  let lastArrow = '';
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return; // keep browser shortcuts
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
    return [(e.clientX - box.left) * (W / box.width), (e.clientY - box.top) * (H / box.height)];
  }
  const RETRY = { x: 66, w: 90 }, MENU = { x: 164, w: 90 }, BUTTON_Y = 145, BUTTON_H = 15;
  const over = (b, x, y) => x >= b.x && x < b.x + b.w && y >= BUTTON_Y && y < BUTTON_Y + BUTTON_H;

  window.addEventListener('mousemove', (e) => {
    if (state === 'menu') canvas.style.cursor = menu.hovering(...point(e)) ? 'pointer' : 'default';
    else if (state === 'finished') canvas.style.cursor = 'default';
  });
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (state === 'menu') menuAction(menu.click(profile, ...point(e)));
    else if (state === 'finished') {
      const [x, y] = point(e);
      if (!resultsReady()) return;
      if (over(RETRY, x, y)) start();
      else if (over(MENU, x, y)) openMenu();
    } else if (!locked()) lockPointer();
  });

  // ---------- Simulation ----------

  function update(dt, now) {
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
    text(`TIME ${clock.toFixed(2)}`, 5, 5, '#fff');
    text(`BEST ${best ? best.toFixed(2) : '--'}`, 5, 13, '#f9d56e');
    text(`${Math.min(Race.DISTANCE, p.s).toFixed(0)}/${Race.DISTANCE}M`, W - 5, 5, '#fff', 1, 'right');
    text(`${(p.speed * 3.6).toFixed(0)} KM/H`, W - 5, 13, '#fff', 1, 'right');
    text(`${ordinal(order.indexOf(p) + 1)}/${order.length}`, W / 2, 4, '#f9d56e', 2, 'center');

    // Power meter, arcade style.
    text('POWER', 5, H - 19, '#fff');
    for (let i = 0; i < 16; i++) {
      const on = i < Math.round(detector.charge * 16);
      rect(5 + i * 5, H - 11, 4, 7, on ? (i < 8 ? '#5be37d' : i < 12 ? '#f9d56e' : '#e8505b') : '#222');
    }
    view.minimap(race);

    if (state === 'running') {
      const hurdle = Race.HURDLES[p.next];
      if (p.stumble > 0) text('OUCH!', W / 2, 36, '#e8505b', 3, 'center');
      else if (race.difficulty !== 'hard' && hurdle && hurdle - p.s < p.speed * 0.5 && p.jumpT < 0) {
        text('JUMP!', W / 2, 36, '#f9d56e', 3, 'center');
      }
      if (race.winner && !race.winner.isPlayer) {
        text(`${race.winner.name} WINS!`, W / 2, 18, '#fff', 2, 'center');
      }
    }

    if (debug) {
      const rows = [
        `CHARGE ${(detector.charge * 100).toFixed(0)}%`, `SWIPES ${detector.strokes}`,
        `SOURCE ${detector.lastSource}`, `NATURAL ${detector.naturalScroll ? 'ON' : 'OFF'}`,
        `LOCK ${locked() ? 'ON' : 'OFF'}`,
        `JUMP ${lastSource}`, `JUMPS ${jumps}`, `UP PEAK ${detector.upPeak.toFixed(0)}`,
      ];
      rows.forEach((r, i) => text(r, W - 5, 70 + i * 8, '#fff', 1, 'right'));
    }
  }

  function panel(x, y, w, h) {
    ctx.globalAlpha = 0.84;
    rect(x, y, w, h, '#10101c');
    ctx.globalAlpha = 1;
  }

  function drawResults() {
    panel(52, 14, 216, 152);
    const winner = race.winner;
    text(winner.isPlayer ? 'YOU WIN!' : `${winner.name} WINS!`, W / 2, 20, '#f9d56e', 3, 'center');
    text('POS', 66, 42, '#9ab');
    text('RUNNER', 90, 42, '#9ab');
    text('TIME', 254, 42, '#9ab', 1, 'right');
    Race.standings(race).forEach((r, i) => {
      const y = 53 + i * 13;
      if (r.isPlayer) rect(60, y - 3, 200, 11, '#2b4a78');
      const color = r.isPlayer ? '#fff' : '#d8d8e8';
      text(ordinal(i + 1), 66, y, color);
      Countries.drawFlag(ctx, r.country, 86, y - 1, 10.5, 7);
      text(r.name, 100, y, color);
      const result = r.finishTime !== null ? r.finishTime.toFixed(2)
        : r.isPlayer ? 'DNF' : 'RUNNING';
      text(result, 254, y, color, 1, 'right');
    });
    const cleared = Race.HURDLES.length - race.player.knocked.size;
    if (race.player.finishTime !== null) {
      text(`HURDLES CLEARED ${cleared}/${Race.HURDLES.length}`, W / 2, 134, '#9ab', 1, 'center');
    }
    for (const [button, label, color] of [[RETRY, 'RETRY - ENTER', '#5be37d'], [MENU, 'MENU - M', '#9ab']]) {
      rect(button.x, BUTTON_Y, button.w, BUTTON_H, color);
      text(label, button.x + button.w / 2, BUTTON_Y + 5, '#10101c', 1, 'center');
    }
  }

  function drawOverlay() {
    if ((state === 'running' || state === 'countdown') && !locked()) {
      text('CLICK TO CAPTURE THE POINTER', W / 2, H - 30, '#fff', 1, 'center');
    }
    if (state === 'countdown') text(Math.ceil(countdown), W / 2, 30, '#fff', 5, 'center');
    if (state === 'running' && race.time < 0.8) text('GO!', W / 2, 30, '#5be37d', 5, 'center');
    if (state === 'finished') drawResults();
  }

  let last = performance.now();
  function frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt, now);
    if (state === 'menu') {
      menu.draw(profile, now);
    } else {
      view.scene(race, now);
      if (state !== 'finished') drawHud();
      drawOverlay();
    }
    requestAnimationFrame(frame);
  }

  openMenu();
  requestAnimationFrame(frame);
})();
