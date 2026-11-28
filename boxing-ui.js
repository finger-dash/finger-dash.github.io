// Boxing screen: first person gloves, the opponent, touch, tilt and keyboard
// input, HUD and result.
(function (root) {
  'use strict';

  const BOARD_DELAY = 1.8;
  const GUARD = 0.6;
  const TAP_SLOP = 16;       // CSS px a tap may wander
  const UPPERCUT_SWIPE = 36; // CSS px upwards
  const DODGE_SWIPE = 50;    // CSS px sideways
  const HIT_BUZZ = 180;      // ms the phone vibrates when we are hit
  const TILT_ON = 14;        // degrees from the neutral position
  const TILT_OFF = 7;

  const lerp = (a, b, t) => a + (b - a) * t;

  function create({ view, mobile, shell }) {
    const { ctx, rect, text } = view;
    const scene = Scene3d.create(view);
    const ui = FieldUi.create({ view, mobile, shell });
    const avatar = Avatar.createAvatar(Countries, Font, 4);
    const { glove: boxingGlove } = Blocks.create(view);
    const { line } = scene;
    let bout = null, popups = [], shake = 0, lean = 0, slip = null;
    const presses = new Map();
    // Tilt: latest reading, neutral position and whether a new dodge is allowed.
    const tilt = { value: null, zero: null, armed: true, asked: false };

    // ---------- Tilt sensor ----------

    // Sideways tilt in degrees, whatever way the screen is turned.
    function sideways(e) {
      const angle = (window.screen.orientation && window.screen.orientation.angle) || window.orientation || 0;
      if (angle === 90) return e.beta;
      if (angle === -90 || angle === 270) return -e.beta;
      return e.gamma;
    }

    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma === null || e.gamma === undefined) return;
      tilt.value = sideways(e);
      if (!bout || bout.phase !== 'fight') return;
      if (tilt.zero === null) tilt.zero = tilt.value;
      const delta = tilt.value - tilt.zero;
      if (Math.abs(delta) < TILT_OFF) tilt.armed = true;
      else if (tilt.armed && Math.abs(delta) > TILT_ON) {
        if (Boxing.dodge(bout, delta > 0 ? 'right' : 'left')) tilt.armed = false;
      }
    });

    // iPhones only share the sensor after a permission asked from a tap.
    function askForTilt() {
      const api = window.DeviceOrientationEvent;
      if (tilt.asked || !api || typeof api.requestPermission !== 'function') return;
      tilt.asked = true;
      api.requestPermission().catch(() => { tilt.asked = false; });
    }

    function start(profile) {
      bout = Boxing.createBout({
        difficulty: profile.difficulty, country: profile.country, playerName: profile.name.trim(),
      });
      popups = []; shake = 0; lean = 0; slip = null;
      presses.clear();
      tilt.zero = null; tilt.armed = true;
      if (mobile.isTouch()) askForTilt();
    }

    const resultsShown = () => bout.phase === 'over' && bout.time > BOARD_DELAY;
    // 'win' or 'loss' (a draw too) while the final table is up, otherwise null.
    const outcome = () => (!resultsShown() ? null
      : bout.result.winner === 'player' ? 'win' : 'loss');
    const resultsReady = () => resultsShown() && bout.time > BOARD_DELAY + GUARD;

    // ---------- Input ----------

    const sideOf = (x) => (x < view.W / 2 ? 'left' : 'right');

    function down(p) {
      if (resultsShown() || (!p.mouse && shell.over(shell.quitBox(), p.x, p.y))) return;
      presses.set(p.id, { cx: p.cx, cy: p.cy, side: sideOf(p.x), used: false });
    }

    // Swipes act as soon as they are long enough, without waiting for the lift.
    function move(p) {
      const press = presses.get(p.id);
      if (!press || press.used) return;
      const dx = p.cx - press.cx, up = press.cy - p.cy;
      if (up > UPPERCUT_SWIPE && up > Math.abs(dx)) {
        press.used = true;
        Boxing.punch(bout, press.side, 'uppercut');
      } else if (Math.abs(dx) > DODGE_SWIPE && Math.abs(dx) > Math.abs(up) * 1.5) {
        press.used = true;
        Boxing.dodge(bout, dx > 0 ? 'right' : 'left');
      }
    }

    function up(p) {
      const press = presses.get(p.id);
      presses.delete(p.id);
      if (!press || press.used) return;
      if (Math.hypot(p.cx - press.cx, p.cy - press.cy) <= TAP_SLOP) Boxing.punch(bout, press.side, 'jab');
    }

    function pause() {
      presses.clear();
      mobile.buzz(0);
    }

    const KEYS = {
      KeyA: ['left', 'jab'], KeyD: ['right', 'jab'],
      KeyQ: ['left', 'uppercut'], KeyE: ['right', 'uppercut'],
    };

    function key(e) {
      if (resultsShown()) {
        if (e.code === 'Enter' && resultsReady()) shell.restart();
        else if (e.code === 'KeyM' || e.code === 'Escape') shell.exit();
        return;
      }
      if (KEYS[e.code]) Boxing.punch(bout, ...KEYS[e.code]);
      else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        Boxing.dodge(bout, e.code === 'ArrowLeft' ? 'left' : 'right');
      }
    }

    function click(x, y, pointerType) {
      if (pointerType !== 'mouse') askForTilt();
      if (resultsShown()) {
        if (!resultsReady()) return;
        const boxes = shell.resultsBoxes();
        if (shell.over(boxes.retry, x, y)) shell.restart();
        else if (shell.over(boxes.menu, x, y)) shell.exit();
      } else if (pointerType !== 'mouse' && shell.over(shell.quitBox(), x, y)) shell.exit();
    }

    // ---------- Simulation ----------

    function update(dt) {
      Boxing.step(bout, dt);
      for (const e of bout.events.splice(0)) {
        if (e.type === 'hit') {
          popups.push({ text: `${e.damage}`, side: e.side, color: '#f9d56e', t: 0 });
        } else if (e.type === 'block') popups.push({ text: 'BLOCKED', side: e.side, color: '#9ab', t: 0 });
        else if (e.type === 'miss') popups.push({ text: 'MISS', side: e.side, color: '#d8d8e8', t: 0 });
        else if (e.type === 'dodged') popups.push({ text: 'DODGED!', side: e.side, color: '#5be37d', t: 0 });
        else if (e.type === 'hurt') {
          shake = 0.35;
          mobile.buzz(HIT_BUZZ);
        }
      }
      popups.forEach((p) => { p.t += dt; });
      popups = popups.filter((p) => p.t < 0.7);
      shake = Math.max(0, shake - dt);
      const d = bout.player.dodge;
      const target = !d ? 0 : d.direction === 'left' ? -1 : 1;
      // Quick into the lean, a bit softer back up to guard.
      lean += (target - lean) * Math.min(1, dt * (d ? 18 : 11));
      if (bout.opponent.state !== 'strike') slip = null;
      if (!d && Math.abs(lean) < 0.01) lean = 0;
    }

    // ---------- Drawing ----------

    // Everything is placed around the opponent's feet and scaled by `k`.
    function stage() {
      const { w: W, h: H, portrait } = view.layout;
      const k = portrait ? Math.min(1.7, H / 215) : 1.2;
      return { W, H, k, x: W / 2, floor: portrait ? H * 0.72 : H * 0.88 };
    }

    // The player's eyes. Slipping a punch rolls the head to that side and ducks
    // under it, so the whole ring tilts, rises and gets closer.
    function camera(s) {
      const { W, H } = s;
      const { portrait } = view.layout;
      const amount = Math.abs(lean);
      const angle = -lean * (portrait ? 0.3 : 0.24);
      const zoom = 1 + 0.24 * amount;
      const cx = W / 2, cy = H * 0.62;
      const dx = -lean * W * 0.05, dy = -H * (portrait ? 0.075 : 0.05) * amount;
      const cos = Math.cos(angle) * zoom, sin = Math.sin(angle) * zoom;
      return {
        zoom,
        apply() {
          ctx.translate(cx + dx, cy + dy);
          ctx.rotate(angle);
          ctx.scale(zoom, zoom);
          ctx.translate(-cx, -cy);
        },
        // Where a point of the ring ends up on screen.
        at: (x, y) => ({
          x: cx + dx + (x - cx) * cos - (y - cy) * sin,
          y: cy + dy + (x - cx) * sin + (y - cy) * cos,
        }),
      };
    }

    // How far beyond the screen the ring is drawn, so no gap shows when it tilts.
    const margin = (s) => Math.ceil(Math.max(s.W, s.H) * 0.35);

    function ring(s) {
      const { W, H, k, floor } = s;
      const m = margin(s);
      const top = floor - 62 * k;
      rect(-m, -m, W + m * 2, H + m * 2, '#14101c');
      for (let row = -Math.ceil(m / 7); row * 7 < top; row++) { // crowd in the dark
        for (let x = -20 - Math.ceil(m / 7) * 7; x < W + m; x += 7) {
          const n = Math.abs(Math.sin(row * 7.3 + x * 3.1) * 999) % 1;
          const seat = x + (Math.abs(row) % 2) * 3;
          rect(seat, row * 7, 4, 4, ['#3a2f55', '#56407a', '#2b3a66', '#6a3b52'][Math.floor(n * 4)]);
          if (n > 0.985) rect(x, row * 7, 2, 2, '#fff6b0'); // camera flashes
        }
      }
      for (const side of [-1, 1]) { // corner posts
        const x = W / 2 + side * W * 0.46;
        rect(x - 3, top - 18 * k, 6, 62 * k, side < 0 ? '#c8102e' : '#2b62c9');
      }
      rect(-m, floor - 34 * k, W + m * 2, H - floor + 34 * k + m, '#3f6aa8'); // canvas
      rect(-m, floor - 34 * k, W + m * 2, 2, '#8fb4e8');
      ['#e8505b', '#f4f4f4', '#2b62c9'].forEach((color, i) => {
        rect(-m, top - 8 * k + i * 11 * k, W + m * 2, Math.max(1, 1.6 * k), color);
      });
    }

    const OPPONENT_SKIN = '#c98a5c', RED = '#d52b1e';
    const gloveOf = (kit) => (kit.shirt === '#f4f4f4' ? '#c8102e' : kit.shirt);
    const modelScale = (s) => s.k * 1.65; // canvas units for each unit of the athlete model

    // Draws the rival in the ring and returns a function that draws, on top and
    // upright, what must not be tilted: the punch and the cues.
    function opponent(s, now) {
      const { k, floor } = s;
      const o = bout.opponent;
      const country = Countries.byId(o.country);
      const unit = modelScale(s);
      const hit = o.flash > 0;
      // Out of breath he heaves, slower and deeper.
      const winded = o.stamina < 35;
      const bob = Math.sin(now / (winded ? 130 : 180)) * (winded ? 2 : 1);
      // Slipping one of our punches: his trunk and head go to that side and down.
      const slipping = o.dodge ? Math.sin(Math.PI * Math.min(1, o.dodge.t / Boxing.SLIP_TIME)) : 0;
      const away = o.dodge && o.dodge.direction === 'left' ? -1 : 1;
      // The model faces us, so its x is mirrored.
      const sway = -(away * slipping * 10 + bob * 0.4);
      const lift = -3 + bob - slipping * 6;
      let nod = 0, drop = 0;
      if (o.state === 'windup') nod = (o.side === 'left' ? -1 : 1) * 2;
      if (hit) nod += Math.sin(now / 20) * 2.5;
      if (o.state === 'down') drop = Math.min(46, o.t * 120 + bout.time * 90);

      const color = gloveOf(country.kit);
      let striking = null, flash = null;
      // Screen side -1 is the player's left, which is the model's right arm.
      const arms = [1, -1].map((side) => {
        const name = side < 0 ? 'left' : 'right', out = -side;
        const mine = o.side === name;
        let elbow = [out * 13, 37, 4], hand = [out * 7, winded && o.state === 'guard' ? 39 : 48, 11];
        if (o.state === 'down') { elbow = [out * 16, 34, 2]; hand = [out * 19, 25, 4]; }
        if (o.state === 'windup' && mine) {
          const t = Math.min(1, o.t / o.length);
          elbow = [out * (15 + 8 * t), 38 + 7 * t, 2];
          hand = [out * (13 + 9 * t), 48 + 8 * t, 6];
          if (Math.floor(now / 80) % 2) flash = hand;
        }
        if (o.state === 'strike' && mine) {
          striking = { side, t: Math.sin(Math.PI * Math.min(1, o.t / o.length)) };
          return { elbow, hand, hidden: true };
        }
        elbow[0] += sway * 0.35; hand[0] += sway * 0.5;
        return { elbow, hand };
      });
      const move = {
        lift, sway, nod, lean: 0, spin: 0, gloves: true, glove: color, props: [], arms,
        // Slipping, he bends his knees and carries them under the hips.
        legs: [-1, 1].map((i) => ({
          knee: [i * (7 + slipping * 3) + sway * 0.35, 12 - slipping * 2, 3 - i * 3], foot: [i * 8, 2, -i * 4],
        })),
      };
      const look = {
        skin: OPPONENT_SKIN, hair: '#241410', kit: country.kit, name: '', number: '1',
        country: country.id, headband: true, face: o.state === 'down' || hit ? 'dazed' : winded ? 'oh' : null,
      };
      ctx.save();
      ctx.beginPath();
      const m = margin(s);
      ctx.rect(-m, -m, s.W + m * 2, floor + 4 + m);
      ctx.clip();
      if (flash) {
        const x = s.x - (flash[0] + sway * 0.4) * unit, y = floor - (flash[1] + lift) * unit;
        const half = 8 * unit;
        rect(x - half, y - half + 3, half * 2, half * 2 - 6, '#f9d71c');
        rect(x - half + 3, y - half, half * 2 - 6, half * 2, '#f9d71c');
      }
      avatar.draw(ctx, s.x, floor + drop * k, unit, look, { move }, Math.PI);
      ctx.restore();

      return (eye) => {
        if (striking) punchAtUs(s, eye, striking, color, lift);
        if (o.state === 'windup') { // get ready to duck
          const at = eye.at(s.x, floor - 70 * unit);
          // Kept below the HUD while the view is tilted.
          text('!', at.x, Math.max(view.layout.top + 42, at.y), '#f9d71c', 3, 'center');
        }
      };
    }

    // A whole arm of the model ending in a glove, from points on the screen.
    function arm({ shoulder, elbow, glove, inner, thick, r, kit, color, skin, unit }) {
      const { chain } = avatar.parts(ctx, unit, view.layout.res);
      const between = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
      // The forearm swells under the elbow and narrows at the wrist.
      chain([shoulder, between(shoulder, elbow, 0.5), elbow, between(elbow, glove, 0.45), glove],
        [thick[0], thick[1], thick[2], thick[2] * 0.76], [kit.shirt, skin, skin, skin]);
      // A short cuff showing just under the glove.
      const reach = Math.hypot(elbow[0] - glove[0], elbow[1] - glove[1]) || 1;
      chain([between(glove, elbow, Math.min(0.8, (r * 1.15) / reach)), glove], [r], [Avatar.cuffColor(kit, color)]);
      boxingGlove(glove[0], glove[1], r, color, inner);
    }

    // The punch coming down the middle at the camera. Slipped, it flies past over
    // the head, on the side we left, instead of filling the view.
    function punchAtUs(s, eye, { side, t }, color, lift) {
      const { W, H, k, floor, x: cx } = s;
      const o = bout.opponent;
      // Once it has missed it stays past us, even as we come back up to guard.
      if (!slip || !o.missed || Math.abs(lean) > slip.amount) {
        slip = { amount: Math.abs(lean), away: lean > 0 ? -1 : 1 };
      }
      const slipped = o.hit && !o.missed ? 0 : Math.min(1, slip.amount);
      const { away } = slip;
      const mix = (a, b) => a + (b - a) * slipped;
      const unit = modelScale(s);
      const shoulder = eye.at(cx + side * 10.5 * unit, floor - (45.5 + lift) * unit);
      const from = eye.at(cx + side * 20 * unit, floor - (47 + lift) * unit);
      const straight = eye.at(cx + side * 6 * k, floor - 36 * k);
      // An arm reaching across his body goes lower, under the chin.
      const high = away === side ? 0.24 : 0.43;
      const to = { x: mix(straight.x, W / 2 + away * W * 0.44), y: mix(straight.y, H * high) };
      const x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t;
      const r = (11 + mix(22, 9) * t) * k;
      const bend = { x: lerp(shoulder.x, x, 0.45) + side * (13 - 6 * t) * k, y: lerp(shoulder.y, y, 0.45) + (13 - 5 * t) * k };
      const thick = (4.6 + 3 * t) * k;
      if (slipped > 0.5) { // air trailing the glove
        for (let i = 0; i < 4; i++) {
          const dy = (i * 0.45 - 0.7) * r;
          line(x - away * (r + 4), y + dy, x - away * (r + 14 + i * 2), y + dy + 2, 1, '#cfd6ee');
        }
      }
      arm({
        shoulder: [shoulder.x, shoulder.y], elbow: [bend.x, bend.y], glove: [x, y], inner: -side,
        thick: [6 * unit, thick * 1.25, thick * 1.45], r, color, skin: OPPONENT_SKIN,
        kit: Countries.byId(o.country).kit, unit,
      });
    }

    function gloves(s, now) {
      const { W, H, k } = s;
      const p = bout.player;
      const kit = Countries.byId(p.country).kit;
      const color = '#d52b1e';
      const bob = Math.sin(now / 220) * 3;
      const target = { x: s.x, y: s.floor - 70 * k };
      for (const side of [-1, 1]) {
        const name = side < 0 ? 'left' : 'right';
        // Leaning, the guard goes with the head: the outer hand ends up higher.
        const ducked = H * (-0.06 + side * lean * 0.04) * Math.abs(lean);
        // The wide screen is short, so the guard sits lower there.
        const raise = view.layout.portrait ? 48 : 36;
        const base = { x: W / 2 + side * W * 0.3 + lean * W * 0.02, y: H - raise * k + bob * side + ducked, r: 20 * k };
        let { x, y, r } = base;
        let extend = 0;
        if (p.punch && p.punch.side === name) {
          const spec = Boxing.PUNCH[p.punch.type];
          const t = p.punch.t < spec.lands ? p.punch.t / spec.lands
            : Math.max(0, 1 - (p.punch.t - spec.lands) / (spec.busy - spec.lands));
          if (p.punch.type === 'jab') {
            x += (target.x - base.x) * t;
            y += (target.y - base.y) * t;
          } else { // low and wide, then up into the chin
            x += (target.x - base.x) * t + side * Math.sin(Math.PI * t) * 18 * k;
            y += (target.y + 14 * k - base.y) * t + Math.sin(Math.PI * t) * 46 * k;
          }
          r = base.r * (1 - 0.45 * t);
          extend = t;
        }
        const R = base.r;
        const shoulder = { x: W / 2 + side * W * 0.5 + side * 6 * k, y: H + 34 * k };
        // On guard the elbow sticks out below the glove; punching, the arm unfolds.
        const folded = { x: base.x + side * R * 1.05, y: base.y + R * 2.05 };
        const straight = { x: lerp(shoulder.x, x, 0.5) + side * 20 * k, y: lerp(shoulder.y, y, 0.5) + 16 * k };
        arm({
          shoulder: [shoulder.x, shoulder.y],
          elbow: [lerp(folded.x, straight.x, extend), lerp(folded.y, straight.y, extend)], glove: [x, y], inner: -side,
          thick: [R * (1.05 - 0.25 * extend), R * (0.9 - 0.2 * extend), R * (0.95 - 0.25 * extend)],
          r, color, kit, skin: '#e0a070', unit: modelScale(s),
        });
      }
    }

    function bar(x, y, w, h, share, color, fromRight) {
      rect(x - 1, y - 1, w + 2, h + 2, '#14101c');
      rect(x, y, w, h, '#2b2b45');
      const fill = Math.round(w * share);
      rect(fromRight ? x + w - fill : x, y, fill, h, color);
    }

    function hud() {
      const { w: W, h: H, portrait, top, bottom } = view.layout;
      const p = bout.player, o = bout.opponent;
      const w = portrait ? 78 : 118, y = top + 13;
      text(p.name, 5, top + 4, '#fff');
      text(o.name, W - 5, top + 4, '#fff', 1, 'right');
      const health = (v) => (v > 50 ? '#5be37d' : v > 25 ? '#f9d56e' : '#e8505b');
      bar(5, y, w, 6, p.health / Boxing.HEALTH, health(p.health), false);
      bar(W - 5 - w, y, w, 6, o.health / Boxing.HEALTH, health(o.health), true);
      bar(W - 5 - w, y + 9, w, 3, o.stamina / Boxing.STAMINA, '#4ac6d4', true);
      text(Math.ceil(bout.left), W / 2, y - 2, '#fff', 2, 'center');
      const sw = portrait ? 90 : 80;
      bar((W - sw) / 2, H - bottom - 8, sw, 4, p.stamina / Boxing.STAMINA, '#4ac6d4', false);
      text('STAMINA', W / 2, H - bottom - 16, '#fff', 1, 'center');
    }

    // Shown over the opponent's legs so that his face stays visible.
    function help(s) {
      const y = Math.round(s.floor - 40 * s.k);
      if (!mobile.isTouch()) {
        ui.lines(['A / D: PUNCH', 'Q / E: UPPERCUT', 'ARROWS: DODGE', 'OR CLICK AND DRAG'], y);
        return;
      }
      ui.lines([
        'TAP LEFT OR RIGHT: PUNCH', 'SWIPE UP: UPPERCUT',
        tilt.value === null ? 'SWIPE SIDEWAYS: DODGE' : 'TILT THE PHONE: DODGE',
      ], y);
    }

    function draw(now) {
      const s = stage();
      ctx.save();
      if (shake > 0) ctx.translate(Math.round(Math.sin(now / 17) * shake * 14), Math.round(Math.cos(now / 13) * shake * 8));
      const eye = camera(s);
      ctx.save();
      eye.apply();
      ring(s);
      const overlay = opponent(s, now);
      ctx.restore();
      overlay(eye);
      gloves(s, now);
      ctx.restore();
      if (shake > 0.15) {
        ctx.globalAlpha = (shake - 0.15) * 1.6;
        rect(0, 0, s.W, s.H, '#e8101c');
        ctx.globalAlpha = 1;
      }
      for (const p of popups) {
        const x = s.x + (p.side === 'left' ? -1 : 1) * 34 * s.k;
        text(p.text, x, s.floor - 78 * s.k - p.t * 22, p.color, 2, 'center');
      }
      const { w: W, horizon } = view.layout;
      if (resultsShown()) {
        const { panel, retry, menu } = shell.resultsBoxes();
        const { winner, how } = bout.result;
        shell.panel(panel.x, panel.y, panel.w, panel.h);
        const title = winner === 'draw' ? 'DRAW' : winner === 'player' ? 'YOU WIN!' : `${bout.opponent.name} WINS!`;
        text(title, W / 2, panel.y + 12, '#f9d56e', 3, 'center');
        text(how === 'KO' ? 'KNOCKOUT' : 'ON POINTS', W / 2, panel.y + 38, '#fff', 2, 'center');
        [bout.player, bout.opponent].forEach((b, i) => {
          const y = panel.y + 68 + i * 18;
          Countries.drawFlag(ctx, b.country, panel.x + 16, y - 1, 10.5, 7);
          text(b.name, panel.x + 32, y, '#fff');
          text(`HEALTH ${b.health} - HITS ${b.landed}`, panel.x + panel.w - 12, y, '#d8d8e8', 1, 'right');
        });
        const touch = mobile.isTouch();
        shell.button(retry, touch ? 'REMATCH' : 'REMATCH - ENTER', '#5be37d');
        shell.button(menu, touch ? 'MENU' : 'MENU - M', '#9ab');
        return;
      }
      hud();
      if (bout.phase === 'intro') {
        help(s);
        if (bout.time > Boxing.INTRO - 0.8) text('FIGHT!', W / 2, horizon - 40, '#f9d56e', 4, 'center');
      } else if (bout.phase === 'over') {
        text(bout.result.how === 'KO' ? 'K.O.!' : 'TIME!', W / 2, horizon - 24, '#f9d56e', 6, 'center');
      }
      ui.footer(false);
    }

    return { lock: false, start, update, draw, key, click, down, move, up, pause, resultsShown, outcome };
  }

  root.BoxingUi = { create };
})(this);
