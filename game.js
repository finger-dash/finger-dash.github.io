// Game shell: input, state machine, HUD and main loop.
(function () {
  'use strict';

  const canvas = document.getElementById('game');
  const view = Renderer.createRenderer(canvas, Track, Race, Countries, Font, Avatar, Layout);
  const menu = Menu.createMenu(view, Avatar.createAvatar(Countries, Font, 4), Countries, Font);
  const { text, rect, ctx } = view;
  const art = Art.createArt(view, Avatar.createAvatar(Countries, Font, 4), Countries);
  // Training bars and medals, kept between visits.
  const store = {
    career: null,
    save: () => save('career', JSON.stringify(store.career)),
  };
  try { store.career = Career.create(JSON.parse(localStorage.getItem('career'))); } catch (_) {}
  if (!store.career) store.career = Career.create();
  const home = Home.createHome(view, art, () => store.career.medals);
  const careerUi = CareerUi.create({
    view, store, avatar: Avatar.createAvatar(Countries, Font, 4),
    look: () => ({
      skin: '#e0a070', hair: '#3a2418', kit: Countries.byId(profile.country).kit,
      name: profile.name, number: '10', country: profile.country, headband: true,
    }),
  });
  let awarded = null; // medal of the final table on screen: {medal, fresh}

  let state, race, starter, resultsAt, jumps, lastSource;
  let eventId = 'hurdles400';
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

  const detector = new Gestures.GestureDetector((kind, source) => {
    lastSource = kind;
    if (state !== 'event') jump();
    else if (active.flick) active.flick(source);
  });
  try {
    detector.naturalScroll = localStorage.getItem('hurdles.natural') !== '0';
  } catch (_) {}

  const mobile = Mobile.createMobile({ canvas, detector, Font, Layout });
  const sound = Sound.createAudio();
  let heard = null; // outcome the crowd has already reacted to

  // Every event but the hurdles lives in its own screen with a common interface:
  // lock, start, update, draw, key, click and optionally keyUp, flick, down, move, up, wheel,
  // pause (forget held inputs). outcome says whether the final table shows a win or a loss.
  const shell = {
    power: drawPower, panel, button: drawButton, resultsBoxes, quitBox, over,
    startBanner: drawStart, call: (name) => sound.call(name),
    save: (key, value) => save(key, value),
    exit: openMenu,
    restart: start,
    relock: () => { if (!mobile.isTouch() && active && active.lock) lockPointer(); },
    unlock: () => { if (document.pointerLockElement) document.exitPointerLock(); },
    locked: () => locked(),
    paused: () => paused,
    arrowStroke,
  };
  const parts = { view, detector, mobile, shell };
  const screens = {
    longJump: LongJumpUi.create(parts),
    shotPut: ShotPutUi.create(parts),
    archery: ArcheryUi.create(parts),
    boxing: BoxingUi.create(parts),
    weightlifting: WeightliftingUi.create(parts),
  };
  const motion = Motion.create(window);
  const athlete = Avatar.createAvatar(Countries, Font, 4);
  for (const id of Object.keys(Events.specs)) {
    screens[id] = EventUi.create(id, { ...parts, avatar: athlete, motion });
  }
  let active = null; // screen of the event being played, null for the hurdles

  // ---------- Pause (computers) ----------

  const HURDLE_BUZZ = 180; // ms the phone vibrates when a hurdle is knocked down
  const ESC_GUARD = 300; // ms; one Escape may arrive both as a key and as a lost pointer
  let paused = false, pausedAt = 0;

  // A competition is on and its results are not up yet.
  const inPlay = () => state === 'start' || state === 'running' ||
    (state === 'event' && !active.resultsShown());

  function pause() {
    if (paused || mobile.isTouch() || !inPlay()) return;
    paused = true;
    pausedAt = performance.now();
    if (active && active.pause) active.pause();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // Must run inside a click or key press so the pointer can be locked.
  function resume() {
    paused = false;
    if (!active || active.lock) lockPointer();
  }

  // Browsers use Escape to free the pointer without telling the page about the key.
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement) pause();
  });

  function pauseBoxes() {
    const { w, h } = view.layout;
    const results = resultsBoxes();
    const height = results.retry.h + 46;
    const box = { x: results.panel.x, y: Math.round((h - height) / 2), w: results.panel.w, h: height };
    const by = box.y + box.h - results.retry.h - 6;
    return {
      panel: box,
      resume: { ...results.retry, y: by },
      menu: { ...results.menu, y: by },
    };
  }

  function drawPause() {
    const { panel: box, resume: back, menu: toMenu } = pauseBoxes();
    const { w: W, h: H } = view.layout;
    ctx.globalAlpha = 0.45;
    rect(0, 0, W, H, '#10101c');
    ctx.globalAlpha = 1;
    panel(box.x, box.y, box.w, box.h);
    text('PAUSED', W / 2, box.y + 12, '#f9d56e', 3, 'center');
    drawButton(back, 'RESUME - ENTER', '#5be37d');
    drawButton(toMenu, 'MENU - M', '#9ab');
  }

  function newRace() {
    detector.reset();
    race = Race.createRace({
      difficulty: profile.difficulty, country: profile.country, playerName: profile.name.trim(),
      edge: Career.edge(store.career, 'hurdles400'),
    });
    starter = Starter.create();
    jumps = 0; lastSource = '-';
  }

  // Screens: title -> events -> menu (runner setup) -> start -> running -> finished.
  const racing = () => state === 'running' || state === 'finished';
  const homeScreen = () => (state === 'title' ? home.title : state === 'events' ? home.events : null);
  const careerScreen = () => state === 'athlete' || state === 'training' || state === 'champion';

  function show(screen) {
    state = screen;
    paused = false;
    canvas.style.cursor = '';
    mobile.closeName();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function openMenu() {
    newRace();
    show('menu');
  }

  function homeAction(action) {
    if (!action) return;
    if (action.type === 'mode') show('events');
    else if (action.type === 'event') {
      eventId = action.id;
      openMenu();
    }
    else if (action.type === 'screen') show(action.id);
    else if (action.type === 'back') show('title');
  }

  // Must run inside a click or key press so the pointer can be locked.
  function start() {
    paused = false;
    newRace();
    active = screens[eventId] || null;
    if (active) {
      profile.edge = Career.edge(store.career, eventId);
      active.start(profile);
      state = 'event';
    } else {
      state = 'start';
    }
    canvas.style.cursor = '';
    mobile.closeName();
    if (mobile.isTouch()) mobile.enterFullscreen();
    else if (!active || active.lock) lockPointer();
  }

  function saveProfile() {
    save('hurdles.name', profile.name);
    save('hurdles.country', profile.country);
    save('hurdles.level', profile.difficulty);
  }

  function menuAction(action) {
    if (action === 'changed') saveProfile();
    if (action === 'start') start();
    if (action === 'back') show('events');
    if (action === 'name' && mobile.isTouch()) {
      mobile.editName(profile.name, (name) => {
        profile.name = name;
        saveProfile();
      });
    }
  }

  function jump() {
    if (state === 'start') jumpTheGun();
    else if (state === 'running' && Race.jump(race.player)) jumps++;
  }

  // Running or jumping before the "go": a warning first, then disqualification.
  function jumpTheGun() {
    const result = Starter.jumpTheGun(starter);
    if (!result) return;
    sound.call('foul');
    if (result === 'out') {
      race.disqualified = true;
      finish(performance.now());
    }
  }

  function finish(now) {
    state = 'finished';
    resultsAt = now;
    if (document.pointerLockElement) document.exitPointerLock(); // free the cursor
  }

  // ---------- Input ----------

  window.addEventListener('wheel', (e) => {
    e.preventDefault(); // blocks page zoom and back/forward swipe
    // Safari tells whether the scroll direction is inverted.
    if (typeof e.webkitDirectionInvertedFromDevice === 'boolean') {
      detector.naturalScroll = e.webkitDirectionInvertedFromDevice;
    }
    if (paused) return;
    detector.wheel(e, performance.now());
    if (state === 'event' && active.wheel) {
      const sign = detector.naturalScroll ? -1 : 1; // finger direction
      const unit = e.deltaMode === 1 ? 16 : 1;
      active.wheel(e.deltaX * unit * sign, e.deltaY * unit * sign, performance.now());
    }
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
    if (!paused && !mobile.fromTouch()) detector.move(e.movementY, performance.now());
  });

  // Ignores accidental taps right after the results show up.
  const resultsReady = () => performance.now() - resultsAt > 1500;

  // Keyboard fallback: alternate left/right to run, space to jump.
  let lastArrow = '';
  function arrowStroke(code) {
    if ((code !== 'ArrowLeft' && code !== 'ArrowRight') || code === lastArrow) return;
    lastArrow = code;
    detector.addStroke('key');
  }
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return; // keep browser shortcuts
    if (mobile.isEditing()) return; // the text field handles its own keys
    if (homeScreen()) {
      const action = e.repeat ? null : homeScreen().key(e);
      if (action) {
        e.preventDefault();
        homeAction(action);
      }
      return;
    }
    if (careerScreen()) {
      const action = e.repeat ? null : careerUi.key(state, e, performance.now());
      if (action) {
        e.preventDefault();
        homeAction(action);
      }
      return;
    }
    if (state === 'menu') {
      const action = menu.key(profile, e);
      if (action) e.preventDefault();
      menuAction(action);
      return;
    }
    if (paused) {
      e.preventDefault();
      if (e.repeat) return;
      const again = e.code === 'Escape' && performance.now() - pausedAt > ESC_GUARD;
      if (again || e.code === 'Enter') resume();
      else if (e.code === 'KeyM') openMenu();
      return;
    }
    if (e.repeat) return;
    if (e.code === 'Escape' && inPlay()) {
      e.preventDefault();
      pause();
      return;
    }
    if (state === 'finished') {
      if (e.code === 'Enter' && resultsReady()) start();
      else if (e.code === 'KeyM' || e.code === 'Escape') openMenu();
      return;
    }
    if (e.code === 'KeyR') openMenu();
    else if (e.code === 'KeyI') {
      detector.naturalScroll = !detector.naturalScroll;
      save('hurdles.natural', detector.naturalScroll ? '1' : '0');
    } else if (state === 'event') active.key(e);
    else if (e.code === 'KeyD') debug = !debug;
    else if (e.code === 'Space') { e.preventDefault(); jump(); lastSource = 'key'; }
    else arrowStroke(e.code);
  });
  window.addEventListener('keyup', (e) => {
    if (!paused && state === 'event' && active.keyUp) active.keyUp(e);
  });

  // Raw pointer streams for the event screens: logical position, CSS position and
  // movement since the previous sample (also valid while the pointer is locked).
  const lastSeen = new Map();
  for (const [type, handler] of [
    ['pointerdown', 'down'], ['pointermove', 'move'], ['pointerup', 'up'], ['pointercancel', 'up'],
  ]) {
    window.addEventListener(type, (e) => {
      const mouse = e.pointerType === 'mouse';
      const previous = lastSeen.get(e.pointerId);
      const dx = mouse ? e.movementX : previous ? e.clientX - previous[0] : 0;
      const dy = mouse ? e.movementY : previous ? e.clientY - previous[1] : 0;
      if (handler === 'up') lastSeen.delete(e.pointerId);
      else lastSeen.set(e.pointerId, [e.clientX, e.clientY]);
      if (paused || state !== 'event' || !active[handler] || mobile.needsRotation()) return;
      const [x, y] = point(e);
      active[handler]({
        id: e.pointerId, mouse, x, y, cx: e.clientX, cy: e.clientY,
        dx: handler === 'down' ? 0 : dx, dy: handler === 'down' ? 0 : dy, t: performance.now(),
      });
    });
  }

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
  function quitBox() {
    return { x: 5, y: 24 + view.layout.top, w: 30, h: 13 };
  }
  function over(b, x, y) {
    return x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  }

  window.addEventListener('mousemove', (e) => {
    const screen = state === 'menu' ? menu : homeScreen();
    if (!paused && state === 'event' && active.hover) active.hover(...point(e));
    if (paused) {
      const boxes = pauseBoxes(), at = point(e);
      canvas.style.cursor = over(boxes.resume, ...at) || over(boxes.menu, ...at) ? 'pointer' : 'default';
    } else if (screen) canvas.style.cursor = screen.hovering(...point(e)) ? 'pointer' : 'default';
    else if (careerScreen()) canvas.style.cursor = careerUi.hovering(state, ...point(e)) ? 'pointer' : 'default';
    else if (state === 'finished' || state === 'event') canvas.style.cursor = 'default';
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
    if (paused) {
      const boxes = pauseBoxes();
      if (over(boxes.resume, x, y)) resume();
      else if (over(boxes.menu, x, y)) openMenu();
      return;
    }
    if (homeScreen()) homeAction(homeScreen().click(x, y));
    else if (careerScreen()) homeAction(careerUi.click(state, x, y, performance.now()));
    else if (state === 'menu') menuAction(menu.click(profile, x, y));
    else if (state === 'event') active.click(x, y, e.pointerType);
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
    if (paused || mobile.needsRotation()) {
      detector.update(now, true);
      return;
    }
    if (state === 'event') {
      active.update(dt, now);
      return;
    }
    if (state === 'start') {
      if (detector.strokes > 0) {
        jumpTheGun();
        detector.reset(); // forgiven or not, it gives no head start
      }
      if (state !== 'start') return;
      detector.update(now, false);
      const call = Starter.step(starter, dt);
      if (call) sound.call(call);
      if (call === 'go') {
        state = 'running';
        detector.reset(); // no head start
      }
      return;
    }
    detector.update(now, state === 'running' && race.player.jumpT >= 0);
    if (!racing()) return;

    // The simulation keeps going behind the results so late rivals can finish.
    const knocked = race.player.knocked.size;
    // A disqualified runner stays at the start while the others run.
    Race.step(race, dt, race.disqualified ? 0 : detector.charge * Race.MAX_SPEED);
    if (race.player.knocked.size > knocked) mobile.buzz(HURDLE_BUZZ);

    if (state === 'running' && race.over) {
      finish(now);
      const t = race.player.finishTime;
      if (t !== null && (!best || t < best)) {
        best = t;
        save('hurdles.best400v2', best);
      }
    }
  }

  // ---------- HUD ----------

  const ordinal = (n) => n + (['ST', 'ND', 'RD'][n - 1] || 'TH');

  // Power meter, arcade style. Wide and centred on upright phones.
  function drawPower(power = detector.charge) {
    const { h: H, w: W, portrait, bottom } = view.layout;
    const step = portrait ? 11 : 5, tall = portrait ? 10 : 7;
    const left = portrait ? (W - 16 * step + 1) / 2 : 5;
    const meterY = H - bottom - tall - 4;
    text('POWER', left, meterY - 8, '#fff');
    for (let i = 0; i < 16; i++) {
      const on = i < Math.round(power * 16);
      rect(left + i * step, meterY, step - 1, tall, on ? (i < 8 ? '#5be37d' : i < 12 ? '#f9d56e' : '#e8505b') : '#222');
    }
  }

  function drawHud() {
    const p = race.player;
    const order = Race.standings(race);
    const clock = p.finishTime !== null ? p.finishTime : race.time;
    const { w: W, horizon, portrait, top } = view.layout;
    text(`TIME ${clock.toFixed(2)}`, 5, 5 + top, '#fff');
    text(`BEST ${best ? best.toFixed(2) : '--'}`, 5, 13 + top, '#f9d56e');
    text(`${Math.min(Race.DISTANCE, p.s).toFixed(0)}/${Race.DISTANCE}M`, W - 5, 5 + top, '#fff', 1, 'right');
    text(`${(p.speed * 3.6).toFixed(0)} KM/H`, W - 5, 13 + top, '#fff', 1, 'right');
    text(`${ordinal(order.indexOf(p) + 1)}/${order.length}`, W / 2, 4 + top, '#f9d56e', 2, 'center');
    drawPower();
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
    // After a disqualification the results come up before anyone has finished.
    if (race.disqualified) text('DISQUALIFIED', W / 2, box.y + 6, '#e8505b', 3, 'center');
    else text(winner.isPlayer ? 'YOU WIN!' : `${winner.name} WINS!`, W / 2, box.y + 6, '#f9d56e', 3, 'center');
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
        : r.isPlayer ? (race.disqualified ? 'DQ' : 'DNF') : 'RUNNING';
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
      drawButton(button, label, color);
    }
  }

  function drawButton(b, label, color) {
    rect(b.x, b.y, b.w, b.h, color);
    text(label, b.x + b.w / 2, b.y + Math.floor((b.h - 5) / 2), '#10101c', 1, 'center');
  }

  // The starter's calls, in the middle of the sky.
  function drawStart(start, penalty) {
    const banner = Starter.banner(start, penalty);
    if (!banner) return;
    const { w: W, horizon } = view.layout;
    const y = horizon - 34;
    text(banner.text, W / 2, y, banner.color, banner.size, 'center');
    if (banner.note) text(banner.note, W / 2, y + 19, '#fff', 1, 'center');
  }

  function drawOverlay() {
    const { w: W, h: H, horizon } = view.layout;
    const live = state === 'running' || state === 'start';
    if (live && mobile.isTouch()) {
      const quit = quitBox();
      rect(quit.x, quit.y, quit.w, quit.h, '#10101c');
      text('MENU', quit.x + quit.w / 2, quit.y + 4, '#fff', 1, 'center');
      if (state === 'start') {
        rect(W / 2 - 78, horizon - 3, 156, 11, '#10101c');
        text('SWIPE DOWN TO RUN - FLICK UP TO JUMP', W / 2, horizon, '#fff', 1, 'center');
      }
    } else if (live && !locked() && !paused) {
      text('CLICK TO CAPTURE THE POINTER', W / 2, H - 30, '#fff', 1, 'center');
    }
    if (state === 'start') drawStart(starter, 'DISQUALIFIES');
    if (state === 'running' && race.time < 0.8) text('GO!', W / 2, horizon - 32, '#5be37d', 5, 'center');
    if (state === 'finished') drawResults();
  }

  // Music in the menus. In a competition, the crowd cheers or boos when the final table
  // comes up, and hushes when it goes away.
  function soundtrack() {
    sound.menu(state === 'title' || state === 'events' || state === 'menu' || careerScreen());
    let outcome = null;
    if (state === 'finished') outcome = race.winner && race.winner.isPlayer ? 'win' : 'loss';
    else if (state === 'event') outcome = active.outcome();
    if (outcome === heard) return;
    heard = outcome;
    sound.react(outcome);
  }

  // Medal for the final table on screen, or null.
  function medalNow() {
    if (state === 'event') return active.medal();
    if (state !== 'finished' || race.disqualified || race.player.finishTime === null) return null;
    return Career.forPlace(Race.standings(race).indexOf(race.player));
  }

  function award() {
    const medal = medalNow();
    if (!medal) { awarded = null; return; }
    if (awarded) return;
    const event = active ? eventId : 'hurdles400';
    awarded = { medal, fresh: Career.award(store.career, event, medal) };
    if (awarded.fresh) store.save();
  }

  // Announced above the final table.
  function drawMedal() {
    const { panel: table } = resultsBoxes();
    const y = Math.max(0, table.y - 19);
    const label = Career.champion(store.career) && awarded.fresh ? 'THE FINAL IS OPEN!'
      : `${awarded.fresh ? 'NEW ' : ''}${awarded.medal.toUpperCase()} MEDAL!`;
    const wide = label.length * 4 + 28, x = Math.round((view.layout.w - wide) / 2);
    panel(x, y, wide, 17);
    CareerUi.medal(rect, awarded.medal, x + 10, y + 1);
    text(label, x + 21, y + 6, CareerUi.MEDAL_COLORS[awarded.medal]);
  }

  let last = performance.now();
  function frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    mobile.syncLayout(view.resize);
    update(dt, now);
    soundtrack();
    award();
    const shown = paused ? pausedAt : now; // animations stop too
    if (state === 'title') {
      home.title.draw(profile.country, now, mobile.isTouch());
    } else if (state === 'events') {
      home.events.draw(mobile.isTouch());
    } else if (state === 'menu') {
      menu.draw(profile, now, mobile.isTouch(), {
        ...Home.EVENTS.find((ev) => ev.id === eventId),
        needs: Career.needs(store.career, eventId), medal: store.career.medals[eventId],
      });
    } else if (careerScreen()) {
      careerUi.draw(state, now, mobile.isTouch(), art);
    } else if (state === 'event') {
      active.draw(shown);
    } else {
      view.scene(race, shown);
      if (state !== 'finished') drawHud();
      drawOverlay();
    }
    if (awarded) drawMedal();
    if (paused) drawPause();
    document.body.classList.toggle('rotate', mobile.needsRotation());
    requestAnimationFrame(frame);
  }

  show('title');
  requestAnimationFrame(frame);
})();
