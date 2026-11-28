// Weightlifting screen: weight choice, F and J keys (or each half of a phone), vibration,
// referee lights and results.
(function (root) {
  'use strict';

  const BOARD_DELAY = 2;
  const GUARD = 0.6;
  const PRESS_TIME = 90;   // ms a key stays down after a tap
  const IDLE_HINT = 700;   // ms without taps before the keys press themselves again
  const KEYS = { KeyF: 'left', KeyJ: 'right' };

  const UNIT = 1.5; // stage units for each unit of the athlete model
  // Poses of the athlete model: bar height, hips, knees forward, bar depth, then the
  // elbows' spread, height and depth.
  const pose = (bar, lift, knees, depth, spread, high, forward) =>
    ({ bar, lift, knees, depth, spread, high, forward });
  const FLOOR_BAR = pose(10, 0, 1, 9, 14, 37, 0);              // standing behind the bar
  const PULL = [                                               // by height of the pull
    pose(10, -9, 9, 9, 14, 23, 7), pose(20, -5, 5, 8.5, 15.5, 30, 6), pose(28, -1, 2, 8, 17, 36, 5),
  ];
  const OVERHEAD = pose(71, 0, 1, 1, 18, 57, 1);
  const LIFT = [                                               // [seconds, pose]
    [0, PULL[2]],
    [0.55, pose(41, -9, 10, 8, 17, 36, 12)],                   // under the bar
    [1.1, pose(47, 0, 1, 7, 17, 42, 11)],                      // up from the squat
    [1.45, pose(42, -5, 6, 7, 17, 37, 11)],                    // dip
    [1.75, OVERHEAD],                                          // jerk
  ];

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const ease = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  function mix(a, b, t) {
    return Object.fromEntries(Object.keys(OVERHEAD).map((key) => [key, lerp(a[key], b[key], t)]));
  }

  function create({ view, mobile, shell }) {
    const { ctx, rect, text } = view;
    const art = LiftArt.create(view);
    const avatar = Avatar.createAvatar(Countries, Font, 4);
    const ui = FieldUi.create({ view, mobile, shell });
    let contest = null, record = null;
    let held, pressedAt, lastTapAt, buzzIn, shown;
    try { record = Number(localStorage.getItem('weightlifting.best')) || null; } catch (_) {}

    function newAttempt() {
      held = { left: false, right: false };
      pressedAt = { left: -Infinity, right: -Infinity };
      lastTapAt = -Infinity;
      buzzIn = 0;
      shown = { ...FLOOR_BAR, tilt: 0 }; // the pose on screen, where a drop starts from
    }

    function start(profile) {
      contest = Weightlifting.createContest({
        difficulty: profile.difficulty, country: profile.country, playerName: profile.name.trim(),
      });
      newAttempt();
    }

    const resultsShown = () => contest.phase === 'landed' && contest.time > BOARD_DELAY;
    const resultsReady = () => resultsShown() && contest.time > BOARD_DELAY + GUARD;

    // Android phones; iPhone Safari has no vibration for web pages.
    function buzz(pattern) {
      if (!mobile.isTouch() || !navigator.vibrate) return;
      try { navigator.vibrate(pattern); } catch (_) {}
    }

    // ---------- Layout ----------

    // Where the stage goes and where the controls around it are.
    function places() {
      const { w: W, h: H, portrait, top, bottom } = view.layout;
      if (!portrait) {
        return {
          k: 1, ox: W / 2, oy: 0, half: 84,
          title: 5, gauge: 33, bars: { x: [44, 276], y: 46, h: 96 }, meter: { x: 299, y: 48, h: 90 },
          buttons: { y: 157, h: 17 },
        };
      }
      const k = H >= 380 ? 4 / 3 : 1;
      const tallPhone = H >= 380;
      const feet = Math.round(H - bottom - Math.max(36, H * (tallPhone ? 0.17 : 0.12)));
      const oy = feet - LiftArt.FLOOR * k;
      const y = top + (tallPhone ? 84 : 72);
      const tall = Math.max(36, Math.min(110, oy + 30 * k - 8 - y));
      return {
        k, ox: W / 2, oy, half: k > 1 ? 62 : 84,
        title: top + 40, gauge: top + 67, bars: { x: [30, W - 30], y, h: tall },
        meter: { x: W - 11, y, h: tall }, buttons: { y: feet + 9, h: 22 },
      };
    }

    function chooseBoxes() {
      const { buttons } = places();
      const mid = view.W / 2;
      return {
        less: { x: mid - 78, y: buttons.y, w: 40, h: buttons.h },
        lift: { x: mid - 32, y: buttons.y, w: 64, h: buttons.h },
        more: { x: mid + 38, y: buttons.y, w: 40, h: buttons.h },
      };
    }

    // ---------- Input ----------

    function press(side) {
      const now = performance.now();
      pressedAt[side] = now;
      lastTapAt = now;
      Weightlifting.tap(contest, side);
    }

    function advance() {
      if (Weightlifting.isOver(contest)) shell.restart();
      else {
        Weightlifting.nextAttempt(contest);
        newAttempt();
      }
    }

    function key(e) {
      if (e.code === 'Space') e.preventDefault();
      if (resultsShown()) {
        if (e.code === 'Enter' && resultsReady()) advance();
        else if (e.code === 'KeyM' || e.code === 'Escape') shell.exit();
        return;
      }
      if (contest.phase === 'choose') {
        if (['KeyF', 'ArrowLeft', 'ArrowDown'].includes(e.code)) Weightlifting.changeWeight(contest, -1);
        else if (['KeyJ', 'ArrowRight', 'ArrowUp'].includes(e.code)) Weightlifting.changeWeight(contest, 1);
        else if (e.code === 'Enter' || e.code === 'Space') Weightlifting.lift(contest);
      } else if (KEYS[e.code]) {
        held[KEYS[e.code]] = true;
        press(KEYS[e.code]);
      }
    }

    function keyUp(e) {
      if (KEYS[e.code]) held[KEYS[e.code]] = false;
    }

    // Thumbs act as soon as they touch: each half of the screen is one key.
    function down(p) {
      if (p.mouse || shell.over(shell.quitBox(), p.x, p.y)) return;
      if (contest.phase === 'pull' || contest.phase === 'hold') {
        press(p.x < view.W / 2 ? 'left' : 'right');
      }
    }

    function click(x, y, pointerType) {
      if (resultsShown()) {
        if (!resultsReady()) return;
        const boxes = shell.resultsBoxes();
        if (shell.over(boxes.retry, x, y)) advance();
        else if (shell.over(boxes.menu, x, y)) shell.exit();
        return;
      }
      if (pointerType !== 'mouse' && shell.over(shell.quitBox(), x, y)) {
        shell.exit();
        return;
      }
      if (contest.phase !== 'choose') return;
      const boxes = chooseBoxes();
      if (shell.over(boxes.less, x, y)) Weightlifting.changeWeight(contest, -1);
      else if (shell.over(boxes.more, x, y)) Weightlifting.changeWeight(contest, 1);
      else if (shell.over(boxes.lift, x, y)) Weightlifting.lift(contest);
    }

    // Releases are not reported while paused.
    function pause() {
      held = { left: false, right: false };
      buzz(0);
    }

    // ---------- Simulation ----------

    const unstable = () => Math.abs(Weightlifting.tilt(contest)) > Weightlifting.TILT_MAX * 0.45;

    // The phone shakes with the effort: quicker pulses as the bar goes up.
    function effort(dt) {
      const { phase, started } = contest;
      if (!(phase === 'pull' && started) && phase !== 'hold') return;
      buzzIn -= dt;
      if (buzzIn > 0) return;
      const load = Weightlifting.heaviness(contest.weight);
      if (phase === 'hold') {
        buzz([25, 70, 25]);
        buzzIn = 0.65;
      } else if (unstable()) {
        buzz(110);
        buzzIn = 0.13;
      } else {
        buzz(Math.round(20 + 30 * load));
        buzzIn = lerp(0.45, 0.17, clamp(Weightlifting.height(contest)));
      }
    }

    function update(dt) {
      Weightlifting.step(contest, dt);
      effort(dt);
      const patterns = { catch: 90, jerk: 60, ok: 45, fail: 450, good: [60, 60, 60, 60, 180] };
      for (const event of contest.events.splice(0)) {
        if (patterns[event.type]) buzz(patterns[event.type]);
        if (event.type === 'good' && (!record || contest.weight > record)) {
          record = contest.weight;
          shell.save('weightlifting.best', record);
        }
      }
    }

    // ---------- Drawing ----------

    // The lifter's pose for the current moment.
    function currentPose(now) {
      const { phase, time } = contest;
      const load = Weightlifting.heaviness(contest.weight);
      const shake = Math.sin(now / 28) * (0.4 + load);
      if (phase === 'choose') return { ...FLOOR_BAR, tilt: 0, free: true, face: 'calm' };
      if (phase === 'pull') {
        const k = clamp(Weightlifting.height(contest)) * 2;
        const i = Math.min(1, Math.floor(k));
        const tilt = Weightlifting.tilt(contest) * 75;
        const bounce = now - lastTapAt < PRESS_TIME ? -1 : 0;
        const base = mix(PULL[i], PULL[i + 1], k - i);
        return { ...base, bar: base.bar - bounce * 0.7, tilt, lean: tilt * 0.3, face: unstable() ? 'oh' : 'strain' };
      }
      if (phase === 'lift') {
        let i = 0;
        while (i + 1 < LIFT.length && time >= LIFT[i + 1][0]) i++;
        const next = LIFT[Math.min(i + 1, LIFT.length - 1)];
        const span = next[0] - LIFT[i][0];
        return { ...mix(LIFT[i][1], next[1], span ? ease((time - LIFT[i][0]) / span) : 1), tilt: 0, face: 'strain' };
      }
      if (phase === 'hold') return { ...OVERHEAD, bar: OVERHEAD.bar - shake * 0.7, tilt: shake * 0.6, face: 'strain' };

      const { mark, side } = contest.result;
      if (mark !== null) return { ...OVERHEAD, tilt: 0, face: 'happy' };
      // The bar falls towards the side that failed.
      const sign = side === 'left' ? -1 : side === 'right' ? 1 : 0;
      const t = ease(time / 0.55);
      const from = shown; // the last pose before the miss
      const high = from.bar > 43;
      const end = high ? pose(45, -7, 8, 7, 18, 40, 9) : pose(11, -9, 9, 9, 14, 23, 7);
      return {
        ...mix(from, end, t * t),
        tilt: lerp(from.tilt, sign * (high ? 42 : 14), t),
        x: sign * (view.layout.portrait ? 3 : 10) * t, lean: sign * 16 * t, face: 'oh',
      };
    }

    // Height of the bar on the stage.
    const barY = (p) => LiftArt.FLOOR - p.bar * UNIT;

    // The athlete model in the pose, seen from the front (its x is mirrored).
    function lifter(p, half) {
      const country = Countries.byId(contest.player.country);
      const look = {
        skin: '#e0a070', hair: '#3a2418', kit: country.kit, name: '',
        number: '10', country: country.id, headband: true, face: p.face,
      };
      const span = half / UNIT, sag = 5 / UNIT, tilt = p.tilt / UNIT;
      const sway = -(p.lean || 0) / UNIT, x = -(p.x || 0) / UNIT;
      const grip = Math.min(13, span * 0.48);
      const barAt = (from) => p.bar + (tilt * from) / span - sag * (from / span) ** 2;
      const move = {
        lift: p.lift, sway, lean: 0, spin: 0, gloves: false,
        // Seen from the front, a squat shows by the knees opening.
        legs: [-1, 1].map((s) => ({
          knee: [s * (8 + Math.max(0, -p.lift) * 0.9), 12 + p.lift * 0.4, 1], foot: [s * (9 + Math.max(0, -p.lift) * 0.7), 2, 3],
        })),
        arms: [-1, 1].map((s) => (p.free
          ? { elbow: [s * 13.5, 37, 0], hand: [s * 14, 30, 0] }
          : {
            elbow: [s * p.spread, p.high - p.lift, p.forward],
            hand: [x + s * grip - sway * 0.4, barAt(s * grip) - p.lift, p.depth],
          })),
        props: [{ type: 'barbell', at: [x, p.bar, p.depth], half: span, tilt, sag }],
      };
      avatar.draw(ctx, 0, LiftArt.FLOOR, UNIT, look, { move }, Math.PI);
    }

    // F and J under the plates, moving with the bar.
    function keys(p, half, now) {
      const { phase, started, result } = contest;
      if (phase === 'choose' || phase === 'lift') return;
      if (phase === 'landed' && result.mark !== null) return;
      const tilt = Weightlifting.tilt(contest);
      // Until the player taps, the keys show what to do by pressing themselves.
      const hint = phase === 'pull' && (!started || now - lastTapAt > IDLE_HINT) && Math.floor(now / 110) % 2 === 0;
      for (const [sign, side, letter] of [[-1, 'left', 'F'], [1, 'right', 'J']]) {
        const edge = view.layout.portrait ? view.W / 2 / places().k - 14 : Infinity;
        const x = Math.max(-edge, Math.min(edge, (p.x || 0) + sign * (half * 0.86 + 8)));
        const y = Math.min(152, art.barAt(barY(p), p.tilt, sign * 0.86) + 21);
        const down = phase !== 'landed' && (held[side] || now - pressedAt[side] < PRESS_TIME || hint);
        let mood = 'idle';
        if (phase === 'landed') mood = 'off';
        else if (phase === 'pull' && unstable() && Math.sign(tilt) === sign) mood = 'alert';
        else if (phase === 'hold' && contest.markers[side].stopped !== null) mood = 'off';
        art.keycap(x, y, letter, { down, mood });
      }
    }

    function stage(now) {
      const at = places(), { res } = view.layout;
      art.hall(Math.round(at.oy + 90 * at.k));
      const p = currentPose(now);
      p.x = p.x || 0;
      if (contest.phase !== 'landed') shown = p;
      ctx.save();
      const jolt = contest.phase === 'landed' && contest.result.mark === null &&
        contest.time > 0.5 && contest.time < 0.75 ? Math.sin(now / 12) * 2 : 0;
      ctx.setTransform(res * at.k, 0, 0, res * at.k, Math.round(res * at.ox), Math.round(res * (at.oy + jolt)));
      art.platform(at.k > 1 ? 130 : view.layout.portrait ? 180 : 200);
      lifter(p, at.half);
      keys(p, at.half, now);
      ctx.restore();
    }

    function heading(title, subtitle, color = '#ffffff') {
      const { title: y } = places();
      ui.shade(view.W / 2 - 66, y - 3, 132, 27);
      text(title, view.W / 2, y, color, 2, 'center');
      text(subtitle, view.W / 2, y + 15, '#bdb6e0', 1, 'center');
    }

    // How level the bar is: the marker moves towards the side that is lower.
    function stability() {
      const y = places().gauge, mid = view.W / 2;
      rect(mid - 51, y, 102, 9, '#14101c');
      rect(mid - 50, y + 1, 100, 7, '#8c2f35');
      rect(mid - 33, y + 1, 66, 7, '#c9a227');
      rect(mid - 17, y + 1, 34, 7, '#3fb858');
      const x = mid + Math.max(-1, Math.min(1, Weightlifting.tilt(contest) / Weightlifting.TILT_MAX)) * 47;
      rect(x - 2, y - 2, 5, 13, '#14101c');
      rect(x - 1, y - 1, 3, 11, '#ffffff');
    }

    function meter() {
      const { x, y, h } = places().meter;
      const fill = Math.round((h - 2) * clamp(Weightlifting.height(contest)));
      rect(x, y, 11, h, '#14101c');
      rect(x + 1, y + 1, 9, h - 2, '#2d2850');
      rect(x + 1, y + h - 1 - fill, 9, fill, '#4fc3f7');
      text('UP', x + 5, y - 8, '#bdb6e0', 1, 'center');
    }

    // The two bars of the hold, each with a marker swinging over a green zone.
    function timing() {
      const { bars } = places();
      const range = bars.h - 2;
      const at = (v) => Math.round(bars.y + bars.h - 1 - range * v);
      Weightlifting.SIDES.forEach((side, i) => {
        const x = bars.x[i], letter = i ? 'J' : 'F';
        const { stopped } = contest.markers[side];
        const missed = contest.result && contest.result.mark === null && contest.result.side === side;
        const done = stopped !== null && !missed;
        const size = Weightlifting.zone(contest);
        const top = at(Weightlifting.GREEN + size), tall = at(Weightlifting.GREEN - size) - top;
        rect(x - 9, bars.y - 1, 18, bars.h + 2, '#14101c');
        rect(x - 8, bars.y, 16, bars.h, missed ? '#8a4050' : '#39334f');
        rect(x - 8, top, 16, tall, missed ? '#8a8050' : '#3fb858');
        rect(x - 8, top, 16, 2, missed ? '#b0a468' : '#8af09a');
        if (done && performance.now() - pressedAt[side] < 220) {
          ctx.globalAlpha = 0.35;
          rect(x - 15, top - 3, 30, tall + 6, '#ffffff');
          ctx.globalAlpha = 1;
        }
        const y = at(Weightlifting.marker(contest, side));
        rect(x - 13, y - 3, 26, 7, '#14101c');
        rect(x - 12, y - 2, 24, 5, missed ? '#ff6b6b' : '#ffffff');
        for (const s of [-1, 1]) {
          for (let n = 0; n < 4; n++) rect(x + s * (17 - n) - (s < 0 ? 0 : 1), y - 3 + n, 1, 7 - n * 2, '#ffffff');
        }
        const label = missed ? 'MISS' : done ? 'OK' : mobile.isTouch() ? 'TAP' : `TAP ${letter}`;
        text(label, x, bars.y - 9, missed ? '#ff6b6b' : done ? '#8af09a' : '#ffd54a', 1, 'center');
      });
    }

    // The three referees decide one after the other: white is good, red is not.
    function lights() {
      const y = places().gauge, good = contest.result.mark !== null;
      for (let i = 0; i < 3; i++) {
        const x = view.W / 2 - 37 + i * 28;
        const on = contest.time > 0.5 + i * 0.22;
        rect(x, y - 1, 18, 12, '#14101c');
        rect(x + 2, y + 1, 14, 8, !on ? '#39334f' : good ? '#ffffff' : '#e0353b');
      }
    }

    function drawChoose() {
      const touch = mobile.isTouch(), boxes = chooseBoxes();
      const { title: y } = places();
      const rival = Weightlifting.toBeat(contest);
      ui.shade(view.W / 2 - 66, y - 3, 132, 36);
      text(`${contest.weight} KG`, view.W / 2, y, '#ffd54a', 3, 'center');
      text(rival ? `TO BEAT: ${rival} KG` : 'CHOOSE YOUR WEIGHT', view.W / 2, y + 19, '#ffffff', 1, 'center');
      if (!touch) text('F / J: WEIGHT - ENTER: LIFT', view.W / 2, y + 27, '#bdb6e0', 1, 'center');
      shell.button(boxes.less, '- 5', contest.weight > contest.floor ? '#9ab' : '#556');
      shell.button(boxes.lift, 'LIFT', '#5be37d');
      shell.button(boxes.more, '+ 5', contest.weight < Weightlifting.MAX_WEIGHT ? '#9ab' : '#556');
    }

    function drawResults() {
      const table = Weightlifting.standings(contest);
      const over = Weightlifting.isOver(contest);
      const { mark, reason } = contest.result;
      ui.results({
        title: !over ? (mark === null ? 'NO LIFT' : `${mark} KG!`)
          : !Weightlifting.best(table[0]) ? 'NO WINNER' : table[0].isPlayer ? 'YOU WIN!' : `${table[0].name} WINS!`,
        role: 'LIFTER', table,
        columns: {
          labels: ['L1', 'L2', 'L3'], width: 24,
          cell(a, i) {
            const m = a.marks[i];
            return [m === undefined ? '-' : m === null ? 'X' : String(m), m != null && m === Weightlifting.best(a)];
          },
        },
        note: over ? `YOUR RECORD ${record || '--'} KG`
          : mark === null ? reason : `LIFT ${contest.attempt + 1}/${Weightlifting.ATTEMPTS}`,
        next: over ? 'RETRY' : 'NEXT LIFT',
      });
    }

    function draw(now) {
      stage(now);
      if (resultsShown()) {
        drawResults();
        return;
      }
      const { phase, time } = contest;
      const touch = mobile.isTouch();
      ui.topLeft(`LIFT ${contest.attempt + 1}/${Weightlifting.ATTEMPTS}`, `BEST ${record || '--'}`);
      if (phase === 'choose') drawChoose();
      else {
        const rival = Weightlifting.toBeat(contest);
        ui.topRight(`${contest.weight} KG`, rival ? `BEAT ${rival}` : '');
      }
      if (phase === 'pull') {
        if (unstable()) {
          const low = Weightlifting.tilt(contest) > 0 ? (touch ? 'RIGHT' : 'J') : (touch ? 'LEFT' : 'F');
          heading('UNSTABLE!', `TAP ${low} FASTER`, '#ff9d3d');
        } else heading('PULL!', touch ? 'TAP LEFT + RIGHT EVENLY' : 'TAP F + J EVENLY');
        stability();
        meter();
      } else if (phase === 'lift') {
        heading(time < Weightlifting.JERK_AT - 0.45 ? 'GET UNDER!' : 'JERK!', 'WATCH', '#ffd54a');
      } else if (phase === 'hold') {
        heading('HOLD IT!', 'ONE TAP PER SIDE ON GREEN');
        timing();
      } else if (phase === 'landed') {
        const { mark, reason } = contest.result;
        if (mark !== null) heading('GOOD LIFT!', `${mark} KG`, '#8af09a');
        else heading('NO LIFT', reason, '#ff6b6b');
        if (contest.markers) timing();
        lights();
      }
      ui.footer(false);
    }

    return { lock: false, start, update, draw, key, keyUp, click, down, pause, resultsShown };
  }

  root.WeightliftingUi = { create };
})(this);
