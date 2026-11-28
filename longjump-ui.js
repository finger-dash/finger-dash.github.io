// Long jump screen: input, HUD, angle meter and results. The rules live in longjump.js.
(function (root) {
  'use strict';

  const BOARD_DELAY = 1.8; // seconds the mark stays on screen before the results
  const GUARD = 0.6;       // seconds before the results buttons react
  const LANE_SPEED = 15;   // m/s with a full power bar
  const TAP_GUARD = 0.15;  // s after the take-off in which a touch does not set the angle
  const LANDING_BUZZ = 700; // ms the phone vibrates on landing
  const GO_SHOWN = 0.8;     // seconds "GO!" stays on screen

  // shell: shared pieces of the game (HUD helpers and navigation).
  function create({ view, detector, mobile, shell }) {
    const { ctx, rect, text } = view;
    let contest = null;
    let held = false;   // Space is down since the take-off: releasing it sets the angle
    let seenStrokes = 0;
    let record = null;
    try { record = Number(localStorage.getItem('longjump.best')) || null; } catch (_) {}

    function newAttempt() {
      detector.reset();
      seenStrokes = 0;
      held = false;
    }

    function start(profile) {
      contest = LongJump.createContest({
        difficulty: profile.difficulty, country: profile.country, playerName: profile.name.trim(),
        tapAngle: mobile.isTouch(), starter: true,
      });
      newAttempt();
    }

    const resultsShown = () => contest.phase === 'landed' && contest.time > BOARD_DELAY;
    // 'win' or 'loss' while the final table is up, otherwise null.
    function outcome() {
      if (!resultsShown() || !LongJump.isOver(contest)) return null;
      const first = LongJump.standings(contest)[0];
      return first.isPlayer && LongJump.best(first) ? 'win' : 'loss';
    }
    const resultsReady = () => resultsShown() && contest.time > BOARD_DELAY + GUARD;

    // ---------- Input ----------

    // Upward flick or Space. After a flick, a tap or a click sets the angle.
    function flick(source) {
      if (contest.phase === 'start') jumpTheGun();
      else if (LongJump.takeOff(contest)) held = source === 'key';
    }

    // Running or jumping before the "go".
    function jumpTheGun() {
      if (LongJump.jumpTheGun(contest)) shell.call('foul');
    }

    function lockAngle() {
      held = false;
      LongJump.release(contest);
    }

    // A new touch, the mouse button or a trackpad click.
    function down(p) {
      if (contest.phase !== 'angle') return;
      if (!p.mouse && (contest.time < TAP_GUARD || shell.over(shell.quitBox(), p.x, p.y))) return;
      lockAngle();
    }

    function advance() {
      if (LongJump.isOver(contest)) shell.restart();
      else {
        LongJump.nextAttempt(contest);
        newAttempt();
        shell.relock();
      }
    }

    function key(e) {
      if (resultsShown()) {
        if (e.code === 'Enter' && resultsReady()) advance();
        else if (e.code === 'KeyM' || e.code === 'Escape') shell.exit();
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (contest.phase === 'run' || contest.phase === 'start') flick('key');
        else if (contest.phase === 'angle') lockAngle();
        else LongJump.stretch(contest);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        LongJump.stretch(contest);
      } else shell.arrowStroke(e.code);
    }

    function keyUp(e) {
      if (e.code === 'Space' && held && contest.phase === 'angle') lockAngle();
    }

    function click(x, y, pointerType) {
      if (resultsShown()) {
        if (!resultsReady()) return;
        const boxes = shell.resultsBoxes();
        if (shell.over(boxes.retry, x, y)) advance();
        else if (shell.over(boxes.menu, x, y)) shell.exit();
      } else if (pointerType !== 'mouse') {
        if (shell.over(shell.quitBox(), x, y)) shell.exit();
      } else if (!shell.locked()) shell.relock();
    }

    // ---------- Simulation ----------

    function update(dt, now) {
      const running = contest.phase === 'run';
      if (contest.phase === 'start' && detector.strokes > 0) {
        jumpTheGun();
        newAttempt(); // forgiven or not, it gives no head start
      }
      detector.update(now, !running);
      // A new downward swipe in the air stretches the legs.
      if (detector.strokes > seenStrokes) LongJump.stretch(contest);
      seenStrokes = detector.strokes;
      const before = contest.phase;
      LongJump.step(contest, dt, detector.charge * LANE_SPEED);
      if (contest.call) shell.call(contest.call);
      if (contest.call === 'go') newAttempt(); // no head start

      if (before === 'flight' && contest.phase === 'landed') mobile.buzz(LANDING_BUZZ);
      if (before !== 'landed' && contest.phase === 'landed') {
        const { mark } = contest.result;
        if (mark !== null && (!record || mark > record)) {
          record = mark;
          shell.save('longjump.best', record);
        }
      }
      if (resultsShown()) shell.unlock();
    }

    // What the renderer needs to draw the runway and the pit.
    function world() {
      const rivals = contest.athletes.filter((a) => !a.isPlayer);
      const target = Math.max(0, ...rivals.map((a) => LongJump.best(a) || 0));
      const landed = contest.phase === 'landed' && contest.takeoff;
      return {
        runners: [contest.jumper],
        player: contest.jumper,
        pit: { board: LongJump.BOARD, target: target || null },
        splash: landed && contest.time < 0.7 ? contest.time / 0.7 : null,
      };
    }

    // ---------- HUD ----------

    const ordinal = (n) => n + (['ST', 'ND', 'RD'][n - 1] || 'TH');
    const meters = (m) => (m === null ? '--' : m.toFixed(2));

    function shade(x, y, w, h) {
      ctx.globalAlpha = 0.75;
      rect(x, y, w, h, '#10101c');
      ctx.globalAlpha = 1;
    }

    function angleMeter() {
      const { w: W, h: H, portrait } = view.layout;
      const radius = portrait ? 50 : 60;
      const ox = portrait ? 14 : 38;
      const oy = portrait ? Math.round(H * 0.62) : 118;
      shade(ox - 10, oy - radius - 10, radius + 26, radius + 34);
      const dot = (angle, distance, size, color) => {
        const a = (angle * Math.PI) / 180;
        rect(ox + Math.cos(a) * distance - size / 2, oy - Math.sin(a) * distance - size / 2, size, size, color);
      };
      for (let a = 0; a <= LongJump.MAX_ANGLE; a += 2) {
        const good = contest.difficulty !== 'hard' &&
          Math.abs(a - LongJump.BEST_ANGLE) <= LongJump.GOOD_ANGLE;
        dot(a, radius, good ? 5 : 2, good ? '#5be37d' : '#9ab');
      }
      for (let d = 0; d < radius - 4; d += 2) dot(contest.angle, d, 2, '#f9d56e');
      rect(ox, oy, radius + 4, 1, '#9ab');
      text(`${Math.round(contest.angle)}`, ox + radius / 2, oy + 6, '#fff', 3, 'center');
    }

    function howTo() {
      const { w: W, horizon } = view.layout;
      const y = horizon - 4;
      const lines = mobile.isTouch()
        ? ['SWIPE DOWN TO RUN', 'AT THE BOARD: FLICK UP', 'THEN TAP TO SET THE ANGLE']
        : ['SWIPE DOWN TO RUN', 'AT THE BOARD: FLICK UP', 'CLICK TO SET THE ANGLE'];
      shade(W / 2 - 66, y - 4, 132, 31);
      lines.forEach((line, i) => text(line, W / 2, y + i * 9, '#fff', 1, 'center'));
    }

    function runHints() {
      const { w: W, horizon } = view.layout;
      const j = contest.jumper;
      const left = LongJump.BOARD - j.s;
      const y = horizon - 28;
      if (contest.time < GO_SHOWN) {
        text('GO!', W / 2, horizon - 32, '#5be37d', 5, 'center');
      } else if (contest.difficulty !== 'hard' && left < j.speed * 0.3 && left > 0.1) {
        text('JUMP!', W / 2, y, '#f9d56e', 3, 'center');
      } else if (left < 15 && left >= 0) {
        text(`${left.toFixed(0)}M`, W / 2, y, '#fff', 3, 'center');
      }
    }

    function flightHints() {
      const { w: W, horizon } = view.layout;
      const y = horizon - 28;
      const at = contest.time / LongJump.FLIGHT_TIME;
      if (contest.stretch) {
        const { bonus } = contest.stretch;
        text(bonus > 0.3 ? 'GREAT LEGS!' : bonus > 0 ? 'OK!' : 'TOO SOON', W / 2, y,
          bonus > 0 ? '#5be37d' : '#e8505b', 2, 'center');
      } else if (contest.difficulty !== 'hard' && at > LongJump.STRETCH_AT - 0.17 && at < LongJump.STRETCH_AT + 0.12) {
        text('SWIPE DOWN!', W / 2, y, '#f9d56e', 2, 'center');
      }
    }

    function landedMark() {
      const { w: W, horizon } = view.layout;
      const { mark, reason, angle, gap, bonus } = contest.result;
      const y = horizon - 34;
      shade(W / 2 - 74, y - 6, 148, angle === null ? 27 : 47);
      if (mark === null) text(`${reason}!`, W / 2, y, '#e8505b', 3, 'center');
      else text(`${meters(mark)} M`, W / 2, y, '#f9d56e', 3, 'center');
      if (angle === null) return;
      const board = gap < 0 ? `OVER BY ${(-gap).toFixed(2)}` : `BOARD -${gap.toFixed(2)}`;
      text(`ANGLE ${angle}  ${board}`, W / 2, y + 23, '#fff', 1, 'center');
      text(`LANDING +${bonus.toFixed(2)}`, W / 2, y + 32, '#fff', 1, 'center');
    }

    function results() {
      const { panel, retry, menu } = shell.resultsBoxes();
      const W = view.W;
      const over = LongJump.isOver(contest);
      const table = LongJump.standings(contest);
      shell.panel(panel.x, panel.y, panel.w, panel.h);

      const winner = table[0];
      const { mark, reason } = contest.result;
      const title = !over ? (mark === null ? `${reason}!` : `${meters(mark)} M`)
        : !LongJump.best(winner) ? 'NO WINNER'
          : winner.isPlayer ? 'YOU WIN!' : `${winner.name} WINS!`;
      text(title, W / 2, panel.y + 6, '#f9d56e', 3, 'center');

      const left = panel.x + 10, right = panel.x + panel.w - 10;
      const column = (i) => right - (LongJump.ATTEMPTS - 1 - i) * 24;
      text('POS', left, panel.y + 28, '#9ab');
      text('JUMPER', left + 18, panel.y + 28, '#9ab');
      for (let i = 0; i < LongJump.ATTEMPTS; i++) text(`J${i + 1}`, column(i), panel.y + 28, '#9ab', 1, 'right');
      table.forEach((a, row) => {
        const y = panel.y + 39 + row * 13;
        if (a.isPlayer) rect(panel.x + 5, y - 3, panel.w - 10, 11, '#2b4a78');
        text(ordinal(row + 1), left, y, '#fff');
        Countries.drawFlag(ctx, a.country, left + 18, y - 1, 10.5, 7);
        text(a.name, left + 32, y, a.isPlayer ? '#fff' : '#d8d8e8');
        const bestMark = LongJump.best(a);
        for (let i = 0; i < LongJump.ATTEMPTS; i++) {
          const m = a.marks[i];
          const value = m === undefined ? '-' : m === null ? 'X' : meters(m);
          text(value, column(i), y, m !== null && m === bestMark ? '#f9d56e' : '#d8d8e8', 1, 'right');
        }
      });
      text(over ? `YOUR RECORD ${meters(record)} M` : `ROUND ${contest.attempt + 1}/${LongJump.ATTEMPTS}`,
        W / 2, panel.y + 120, '#9ab', 1, 'center');
      const touch = mobile.isTouch();
      const next = over ? 'RETRY' : 'NEXT JUMP';
      shell.button(retry, touch ? next : `${next} - ENTER`, '#5be37d');
      shell.button(menu, touch ? 'MENU' : 'MENU - M', '#9ab');
    }

    function draw() {
      if (resultsShown()) {
        results();
        return;
      }
      const { w: W, h: H, horizon, top } = view.layout;
      const j = contest.jumper;
      const table = LongJump.standings(contest);
      const leader = LongJump.best(table[0]);
      text(`JUMP ${contest.attempt + 1}/${LongJump.ATTEMPTS}`, 5, 5 + top, '#fff');
      text(`BEST ${meters(record)}`, 5, 13 + top, '#f9d56e');
      text(`BOARD ${Math.max(0, LongJump.BOARD - j.s).toFixed(1)}M`, W - 5, 5 + top, '#fff', 1, 'right');
      text(`${(j.speed * 3.6).toFixed(0)} KM/H`, W - 5, 13 + top, '#fff', 1, 'right');
      if (leader) {
        text(`${ordinal(table.indexOf(contest.player) + 1)}/${table.length}`, W / 2, 4 + top, '#f9d56e', 2, 'center');
        text(`LEADER ${meters(leader)}`, W / 2, 17 + top, '#fff', 1, 'center');
      }
      shell.power();

      if (contest.phase === 'start') {
        shell.startBanner(contest.start, 'IS A FOUL');
        howTo();
      } else if (contest.phase === 'run') runHints();
      else if (contest.phase === 'angle') {
        angleMeter();
        const hint = held ? 'RELEASE SPACE!' : mobile.isTouch() ? 'TAP TO SET ANGLE' : 'CLICK TO SET ANGLE';
        text(hint, W / 2, horizon - 28, '#f9d56e', 2, 'center');
      } else if (contest.phase === 'flight') flightHints();
      else landedMark();

      if (mobile.isTouch()) {
        const quit = shell.quitBox();
        rect(quit.x, quit.y, quit.w, quit.h, '#10101c');
        text('MENU', quit.x + quit.w / 2, quit.y + 4, '#fff', 1, 'center');
      } else if (!shell.locked() && !shell.paused()) {
        text('CLICK TO CAPTURE THE POINTER', W / 2, H - 30, '#fff', 1, 'center');
      }
    }

    function render(now) {
      view.scene(world(), now);
      draw();
    }

    return { lock: true, start, update, draw: render, flick, down, key, keyUp, click, resultsShown, outcome };
  }

  root.LongJumpUi = { create };
})(this);
