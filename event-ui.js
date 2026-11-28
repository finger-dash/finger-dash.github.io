// Screen of the newer events: gathers touch, tilt, mouse and keyboard, feeds the
// rules and shows the HUD and the table. Drawings live in scenes.js.
(function (root) {
  'use strict';

  const DONE_DELAY = 1.4;  // seconds the mark stays on screen before the table
  const GUARD = 0.6;       // seconds before the table buttons react
  const KEY_TILT = 22;     // degrees an arrow key leans
  const DRAG_TILT = 36;    // logical px of drag that lean the same, without a sensor
  const HOWTO_TIME = 4;    // seconds the controls stay up in events without a start

  // For each event: what to write on the setup screen, how to play with the phone
  // and with a computer, and the keys. `run`: arrows (or `runKeys`) fill the power
  // bar. Keys map to a rule action on press, `up` on release; a function gets the state.
  const arrows = ['ArrowLeft', 'ArrowRight'];
  const tap = (side) => ({ type: 'press', side });
  const stroke = (side) => ({ type: 'stroke', side });
  const move = (dir) => ({ type: 'move', dir });

  const GUIDES = {
    sprint100: {
      touch: ['ALTERNATE YOUR THUMBS DOWN', 'AT THE LINE: FLICK UP TO DIP'],
      keys: ['ARROWS ALTERNATE: RUN', 'SPACE: DIP'], runKeys: arrows,
      press: { Space: { type: 'flick' } },
    },
    swimming: {
      touch: ['SWIPE OR CIRCLE: LEFT - RIGHT', 'TILT SIDEWAYS: BREATHE', 'AT THE WALL: FLICK UP'],
      keys: ['A AND L: ARMS', 'ARROWS: BREATHE', 'SPACE: TURN'], tilt: true,
      press: { KeyA: stroke('left'), KeyL: stroke('right'), Space: { type: 'flick' } },
    },
    rowing: {
      touch: ['SWIPE DOWN WITH TWO FINGERS', 'ONE PULL ON EVERY BEAT'],
      keys: ['SPACE ON EVERY BEAT'], press: { Space: { type: 'both' } },
    },
    cycling: {
      touch: ['DRAW CIRCLES: PEDAL', 'TILT: CHANGE LANE', 'STAY BEHIND A RIVAL TO REST'],
      keys: ['A AND L ALTERNATE: PEDAL', 'ARROWS: CHANGE LANE'], tilt: true,
      press: { KeyA: { type: 'pedal', side: 'left' }, KeyL: { type: 'pedal', side: 'right' } },
    },
    climbing: {
      touch: ['TAP THE SIDE OF THE LIT HOLD', 'RED HOLDS: BOTH SIDES AT ONCE'],
      keys: ['A: LEFT  L: RIGHT', 'SPACE: BOTH'],
      press: { KeyA: tap('left'), KeyL: tap('right'), ArrowLeft: tap('left'), ArrowRight: tap('right'), Space: { type: 'both' } },
    },
    canoe: {
      touch: ['TAP LEFT AND RIGHT: PADDLE', 'TILT: STEER THROUGH THE GATES'],
      keys: ['A AND L: PADDLE', 'ARROWS: STEER'], tilt: true,
      press: { KeyA: stroke('left'), KeyL: stroke('right') },
    },
    javelin: {
      touch: ['SWIPE DOWN: RUN', 'HOLD A FINGER STILL: ARM BACK', 'TILT: ANGLE - LIFT: THROW'],
      keys: ['ARROWS ALTERNATE: RUN', 'HOLD SPACE - RELEASE TO THROW', 'UP AND DOWN: ANGLE'],
      runKeys: arrows, tilt: true,
      press: { Space: { type: 'arm' } }, release: { Space: { type: 'release' } },
    },
    discus: {
      touch: ['TWIST YOUR WRIST - HOLD TIGHT!', 'OR DRAW CIRCLES', 'FLICK UP: THROW IN THE GREEN'],
      keys: ['ARROWS ALTERNATE: SPIN', 'SPACE: THROW'],
      press: { ArrowLeft: { type: 'wind' }, ArrowRight: { type: 'wind' }, Space: { type: 'throw' } },
    },
    hammer: {
      touch: ['ROLL THE PHONE - HOLD TIGHT!', 'OR DRAW CIRCLES', 'TAP: THROW IN THE GREEN'],
      keys: ['ARROWS ALTERNATE: SPIN', 'SPACE: THROW'],
      press: { ArrowLeft: { type: 'wind' }, ArrowRight: { type: 'wind' }, Space: { type: 'throw' } },
    },
    highJump: {
      touch: ['SWIPE DOWN: RUN', 'TILT: FOLLOW THE CURVE', 'FLICK UP: JUMP - THEN TILT BACK'],
      keys: ['A AND D ALTERNATE: RUN', 'ARROWS: CURVE', 'SPACE: JUMP - THEN ARCH'],
      runKeys: ['KeyA', 'KeyD'], tilt: true,
      press: { Space: (s) => ({ type: s.phase === 'run' ? 'jump' : 'arch' }) },
    },
    poleVault: {
      touch: ['SWIPE DOWN: RUN', 'AT THE BOX: HOLD A FINGER', 'LIFT IT - THEN TILT OR TAP'],
      keys: ['ARROWS ALTERNATE: RUN', 'HOLD SPACE: PLANT - RELEASE', 'SPACE AGAIN: CLEAR THE BAR'],
      runKeys: arrows,
      press: { Space: (s) => ({ type: s.phase === 'air' ? 'push' : 'plant' }) },
      release: { Space: { type: 'let' } },
    },
    diving: {
      touch: ['FLICK UP: DIVE', 'SWIPE: SOMERSAULTS', 'HOLD: OPEN - TILT: STRAIGHTEN'],
      keys: ['SPACE: DIVE', 'UP: SOMERSAULT', 'DOWN: OPEN - SIDES: ADJUST'], tilt: true,
      press: { Space: { type: 'jump' }, ArrowUp: { type: 'spin' }, ArrowDown: { type: 'open' },
        ArrowLeft: { type: 'nudge', dir: -1 }, ArrowRight: { type: 'nudge', dir: 1 } },
    },
    surfing: {
      touch: ['TILT: RIDE THE WAVE', 'AT THE TOP: FLICK UP', 'IN THE AIR: DRAW CIRCLES'],
      keys: ['ARROWS: RIDE', 'SPACE: JUMP', 'A AND L: SPIN'], tilt: true,
      press: { Space: { type: 'jump' }, KeyA: { type: 'trick', dir: -1 }, KeyL: { type: 'trick', dir: 1 } },
    },
    beam: {
      touch: ['TILT TO KEEP YOUR BALANCE', 'SWIPE WHERE THE ARROW POINTS'],
      keys: ['A AND D: BALANCE', 'ARROWS: THE MOVES'], tilt: ['KeyA', 'KeyD'],
      press: { ArrowUp: move('up'), ArrowDown: move('down'), ArrowLeft: move('left'), ArrowRight: move('right') },
    },
    trap: {
      touch: ['MOVE THE PHONE TO AIM', 'TAP: SHOOT'],
      keys: ['MOUSE OR ARROWS: AIM', 'CLICK OR SPACE: SHOOT'], tilt: true,
      press: { Space: { type: 'shoot' } },
    },
    tableTennis: {
      touch: ['SWIPE UP AS THE BALL ARRIVES', 'SWIPE SIDEWAYS TO PLACE IT', 'TILT: SPIN'],
      keys: ['SPACE AS THE BALL ARRIVES', 'ARROWS: WHERE TO SEND IT'], tilt: true,
      press: { Space: (s, tilt) => ({ type: 'hit', aim: tilt.x, power: 0.65, spin: 0 }) },
    },
    penalty: {
      touch: ['SHOOT: SWIPE - CURVE IT', 'SAVE: TILT OR SWIPE SIDEWAYS'],
      keys: ['SHOOT: HOLD ARROWS + SPACE', 'SAVE: LEFT OR RIGHT'], tilt: true,
      press: {
        Space: (s, tilt) => ({ type: 'kick', x: tilt.x * 0.9, y: 0.45 - tilt.y * 0.35, power: 0.75, curve: 0 }),
        ArrowLeft: (s) => (s.turn === 'keep' ? { type: 'dive', side: -1 } : null),
        ArrowRight: (s) => (s.turn === 'keep' ? { type: 'dive', side: 1 } : null),
      },
    },
    fencing: {
      touch: ['MATCH THE ATTACK: HIGH OR LOW', 'TILT THE PHONE OR TAP', 'THEN FLICK UP: LUNGE'],
      keys: ['UP AND DOWN: GUARD', 'SPACE: LUNGE'],
      press: { ArrowUp: { type: 'parry', line: 'high' }, ArrowDown: { type: 'parry', line: 'low' }, Space: { type: 'lunge' } },
    },
  };

  const UNITS = { time: 'S', distance: 'M', height: 'M', score: 'PTS', duel: '' };

  // shell: shared pieces of the game (HUD helpers and navigation).
  function create(id, { view, detector, mobile, shell, avatar, motion }) {
    const { text } = view;
    const spec = Events.specs[id], guide = GUIDES[id];
    const field = FieldUi.create({ view, mobile, shell });
    const scenes = Scenes.create({ view, avatar });
    const touch = Touch.create((a) => act(a), () => view.W);
    const keys = new Map();    // code -> time it went down
    let match = null, record = null, pointer = null, usedKeys = false;

    try { record = Number(localStorage.getItem(`event.${id}.best`)) || null; } catch (_) {}

    function newAttempt() {
      detector.reset();
      touch.reset();
      keys.clear();
      motion.calibrate();
      motion.twist();
      pointer = null;
    }

    function start(profile) {
      match = Events.createMatch(id, {
        difficulty: profile.difficulty, country: profile.country, playerName: profile.name.trim(),
        edge: profile.edge,
      });
      motion.ask();
      newAttempt();
    }

    const resultsShown = () => match.phase === 'done' && match.time > DONE_DELAY;
    const resultsReady = () => resultsShown() && match.time > DONE_DELAY + GUARD;
    function outcome() {
      if (!resultsShown() || !Events.isOver(match)) return null;
      return Events.won(match) ? 'win' : 'loss';
    }

    function medal() {
      if (outcome() === null) return null;
      const s = match.state;
      if (spec.kind === 'duel') return s.mark === null ? null : Career.forDuel(s.mark, s.theirs);
      if (Events.result(match, match.player) === null) return null;
      return Career.forPlace(Events.standings(match).indexOf(match.player));
    }

    // ---------- Input ----------

    // Moving before the "go".
    function jumpTheGun() {
      if (Events.jumpTheGun(match)) shell.call('foul');
    }

    // Position on the field of the aiming events, 0..1.
    function onField(x, y) {
      const f = scenes.range();
      return { x: (x - f.x) / f.w, y: (y - f.y) / f.h };
    }

    function act(a) {
      if (!match || resultsShown()) return;
      if (match.phase === 'start') {
        // Running events count strides; the others any touch.
        if (!spec.run && (a.type === 'press' || a.type === 'stroke' || a.type === 'both')) jumpTheGun();
        else if (spec.run && a.type === 'flick') jumpTheGun();
        return;
      }
      if (match.phase !== 'play') return;
      if (a.type === 'swipe' && spec.id === 'tableTennis') {
        const t = motion.tilt();
        a.spin = t ? t.x / 25 : a.curve;
      }
      if (spec.aims && a.type === 'tap' && !motion.tilt()) match.state.aim = onField(a.x, a.y);
      Events.act(match, a);
    }

    function down(p) {
      if (resultsShown() || (!p.mouse && shell.over(shell.quitBox(), p.x, p.y))) return;
      motion.ask();
      pointer = { x: p.x, y: p.y };
      touch.down(p);
    }
    function pointerMove(p) {
      if (!resultsShown()) {
        pointer = { x: p.x, y: p.y };
        touch.move(p);
      }
    }
    function up(p) {
      if (!resultsShown()) touch.up(p);
      else touch.reset();
    }

    // Upward flicks of the trackpad; fingers on the screen have their own.
    function flick(source) {
      if (touch.fingers().length || String(source).startsWith('touch')) return;
      act({ type: 'flick' });
    }

    function advance() {
      if (Events.isOver(match)) shell.restart();
      else {
        Events.next(match);
        newAttempt();
      }
    }

    // How the arrows (or the keys of the event) lean the virtual phone, -1..1.
    function keyTilt() {
      const [left, right] = Array.isArray(guide.tilt) ? guide.tilt : arrows;
      const axis = (a, b) => (keys.has(b) ? 1 : 0) - (keys.has(a) ? 1 : 0);
      return { x: axis(left, right), y: axis('ArrowUp', 'ArrowDown') };
    }

    function key(e) {
      if (resultsShown()) {
        if (e.code === 'Enter' && resultsReady()) advance();
        else if (e.code === 'KeyM' || e.code === 'Escape') shell.exit();
        return;
      }
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      usedKeys = true;
      keys.set(e.code, performance.now());
      if (guide.runKeys && guide.runKeys.includes(e.code) &&
          (match.phase === 'start' || match.state.phase === undefined || match.state.phase === 'run')) {
        shell.arrowStroke(e.code === guide.runKeys[0] ? 'ArrowLeft' : 'ArrowRight');
      }
      if (match.phase === 'start' && !spec.run) { jumpTheGun(); return; }
      let action = guide.press && guide.press[e.code];
      if (typeof action === 'function') action = action(match.state, keyTilt());
      if (!action) return;
      act({ ...action });
    }

    function keyUp(e) {
      keys.delete(e.code);
      const action = guide.release && guide.release[e.code];
      if (action) act({ ...action });
    }

    function click(x, y, pointerType) {
      if (resultsShown()) {
        if (!resultsReady()) return;
        const boxes = shell.resultsBoxes();
        if (shell.over(boxes.retry, x, y)) advance();
        else if (shell.over(boxes.menu, x, y)) shell.exit();
      } else if (pointerType !== 'mouse' && shell.over(shell.quitBox(), x, y)) shell.exit();
    }

    // The mouse aims without pressing.
    function hover(x, y) {
      pointer = { x, y, hover: true };
    }

    // ---------- Simulation ----------

    // What the player is doing this frame.
    function gather(dt, now) {
      const spin = touch.spin();
      let tilt = motion.tilt();
      if (guide.tilt && usedKeys) {
        const k = keyTilt();
        if (k.x || k.y || !tilt) tilt = { x: k.x * KEY_TILT, y: k.y * KEY_TILT };
      }
      // Without a sensor, dragging a finger leans the phone.
      if (!tilt && guide.tilt && !spec.aims) {
        const finger = touch.fingers().find((f) => !f.flicked);
        if (finger) {
          tilt = {
            x: Events.clamp((finger.x - finger.x0) / DRAG_TILT, -1, 1) * KEY_TILT,
            y: Events.clamp((finger.y - finger.y0) / DRAG_TILT, -1, 1) * KEY_TILT,
          };
        }
      }
      let aim = null;
      if (spec.aims) {
        if (usedKeys && (keys.has('ArrowLeft') || keys.has('ArrowRight') || keys.has('ArrowUp') || keys.has('ArrowDown'))) {
          const k = keyTilt(), at = match.state.aim;
          aim = { x: at.x + k.x * dt * 0.9, y: at.y + k.y * dt * 0.9 };
          pointer = null;
        } else if (pointer) aim = onField(pointer.x, pointer.y);
        tilt = motion.tilt(); // keys and mouse aim by position instead
      }
      return {
        charge: detector.charge,
        tiltX: tilt ? tilt.x : null,
        tiltY: tilt ? tilt.y : null,
        spin, twist: motion.twist(), held: touch.held(now), aim,
      };
    }

    function update(dt, now) {
      if (match.phase === 'start' && spec.run && detector.strokes > 0) {
        jumpTheGun();
        detector.reset(); // forgiven or not, it gives no head start
      }
      const running = match.state.phase === undefined || match.state.phase === 'run';
      detector.update(now, !spec.run || !running);
      const before = match.phase;
      Events.step(match, dt, gather(dt, now));
      if (match.call) shell.call(match.call);
      if (match.call === 'go') newAttempt(); // no head start
      if (match.state.buzz) {
        mobile.buzz(match.state.buzz);
        match.state.buzz = 0;
      }
      if (before !== 'done' && match.phase === 'done') {
        const mark = spec.kind === 'duel' ? null : Events.result(match, match.player);
        const better = spec.kind === 'time' ? mark < record : mark > record;
        if (mark !== null && (!record || better)) {
          record = mark;
          shell.save(`event.${id}.best`, record);
        }
      }
    }

    // Forget held inputs (pause).
    function pause() {
      keys.clear();
      touch.reset();
    }

    // ---------- HUD ----------

    const fmt = (v) => Events.format(spec, v);

    function hud() {
      const s = match.state;
      const many = match.attempts > 1;
      const first = spec.kind === 'time' ? `TIME ${(s.done && s.mark !== null ? s.mark : s.time).toFixed(2)}`
        : spec.kind === 'height' ? `TRY ${match.misses + 1}/3`
          : many ? `TRY ${match.attempt + 1}/${match.attempts}` : spec.kind === 'duel' ? `FIRST TO ${spec.TOUCHES || spec.POINTS || spec.KICKS}` : 'ONE GO';
      field.topLeft(first, spec.kind === 'duel' ? '' : `BEST ${fmt(record)}`);
      if (spec.kind === 'time') {
        const rivals = match.athletes.slice(1);
        const placed = rivals.filter((a) => a.plan[0] < (s.done ? s.mark : Infinity) &&
          (s.done || RaceRules.along(spec.distance, a.plan[0], s.time) > s.s)).length;
        field.topRight(`${Math.min(spec.distance, s.s).toFixed(0)}/${spec.distance}M`, `${FieldUi.ordinal(placed + 1)}/${match.athletes.length}`);
      } else if (spec.run && s.phase !== 'flight') {
        field.topRight(`${(s.speed * 3.6).toFixed(0)} KM/H`, '');
      }
      if (spec.run && (s.phase === undefined || s.phase === 'run')) shell.power();
    }

    // Clear of the athlete: in the sky on upright phones, in a corner otherwise.
    function howTo(early) {
      const lines = mobile.isTouch() ? guide.touch : guide.keys;
      const { horizon, portrait } = view.layout;
      if (!portrait) {
        // The throwers have their compass on the right.
        const left = spec.id === 'discus' || spec.id === 'hammer';
        // Duels show the score, and its dots, in the middle of the top.
        // Penalties keep the goal in view, so theirs goes down to the grass.
        const y = spec.id === 'penalty' ? Math.round(view.H * 0.66) : early ? 62 : spec.kind === 'duel' ? 52 : 30;
        field.lines(lines, y, (w) => (left ? 5 + w / 2 : view.W - 5 - w / 2));
        return;
      }
      const above = spec.aims || ['discus', 'hammer', 'diving'].includes(spec.id);
      field.lines(lines, early ? horizon + 4 : above ? horizon + 30 : horizon - 66);
    }

    // The controls leave as soon as the player gets going.
    const busy = () => (spec.run && detector.charge > 0.2) || match.state.rate > 0.25 ||
      (match.state.phase !== undefined && !['run', 'ready', 'spin', 'play'].includes(match.state.phase));

    function mark() {
      const s = match.state, { W } = view;
      const { horizon, portrait } = view.layout;
      const y = portrait ? horizon - 30 : 36;
      let word;
      if (spec.kind === 'duel') word = s.mine > s.theirs ? 'YOU WIN!' : 'YOU LOSE';
      else if (spec.kind === 'height') word = match.cleared ? 'CLEARED!' : `${s.note || 'NO'}!`;
      else if (s.mark === null) word = `${s.note || 'NO MARK'}!`;
      else word = `${fmt(s.mark)} ${UNITS[spec.kind]}`;
      const size = word.length > 12 ? 2 : 3;
      field.shade(W / 2 - word.length * 2 * size - 6, y - 5, word.length * 4 * size + 12, 5 * size + 10);
      text(word, W / 2, y, s.mark === null && spec.kind !== 'duel' ? '#e8505b' : '#f9d56e', size, 'center');
    }

    function results() {
      const over = Events.isOver(match);
      const table = Events.standings(match);
      const winner = table[0];
      const s = match.state;
      let title;
      if (over) {
        title = Events.result(match, winner) === null ? 'NO WINNER'
          : Events.won(match) ? 'YOU WIN!' : `${winner.isPlayer ? match.athletes[1].name : winner.name} WINS!`;
        if (spec.kind === 'duel' && !Events.won(match)) title = `${match.athletes[1].name} WINS!`;
      } else if (spec.kind === 'height') title = match.cleared ? `${fmt(s.bar)} CLEARED` : 'BAR DOWN';
      else title = s.mark === null ? `${s.note || 'NO MARK'}!` : `${fmt(s.mark)} ${UNITS[spec.kind]}`;

      let columns;
      if (spec.kind === 'distance' || (spec.kind === 'score' && match.attempts > 1)) {
        const sum = spec.kind === 'score';
        const labels = Array.from({ length: match.attempts }, (_, i) => `${sum ? 'D' : 'T'}${i + 1}`);
        if (sum) labels.push('SUM');
        columns = {
          labels, width: 26,
          cell(a, i) {
            if (sum && i === match.attempts) return [fmt(Events.result(match, a)), true];
            const m = a.marks[i];
            const best = !sum && m !== null && m === Events.result(match, a);
            return [m === undefined ? '-' : m === null ? 'X' : fmt(m), best];
          },
        };
      } else if (spec.kind === 'height') {
        columns = {
          labels: ['HEIGHT'], width: 30,
          // The rivals' marks show up as the bar reaches them.
          cell(a) {
            if (a.isPlayer || over) return [fmt(Events.result(match, a)), a.isPlayer];
            const reached = spec.bars.slice(0, match.bar + 1).filter((b) => b <= a.plan[0]);
            return [reached.length ? fmt(reached[reached.length - 1]) : '-', false];
          },
        };
      } else {
        const label = { time: 'TIME', score: 'SCORE', duel: 'POINTS' }[spec.kind];
        columns = {
          labels: [label], width: 30,
          cell: (a) => {
            const v = Events.result(match, a);
            return [v === null ? (a.isPlayer ? 'DNF' : '-') : spec.id === 'trap' ? `${v}/15` : fmt(v), a.isPlayer];
          },
        };
      }
      const next = over ? 'RETRY' : spec.kind === 'height' ? 'NEXT JUMP' : 'NEXT TRY';
      field.results({
        title, role: 'ATHLETE', table, columns, next,
        note: spec.kind === 'duel' ? spec.name : `YOUR RECORD ${fmt(record)} ${UNITS[spec.kind]}`,
      });
    }

    function render() {
      scenes.draw(match, mobile.isTouch());
      if (resultsShown()) {
        results();
        return;
      }
      hud();
      if (match.phase === 'start') {
        shell.startBanner(match.start, 'IS A FOUL');
        howTo(true);
      } else if (match.phase === 'done') mark();
      else {
        if (spec.start && match.time < 0.8) {
          const { horizon } = view.layout;
          text('GO!', view.W / 2, horizon - 32, '#5be37d' - 5 - 'center');
        }
        if (!spec.start && match.time < HOWTO_TIME && !busy()) howTo(false);
      }
      field.footer(false);
    }

    return {
      lock: false, start, update, draw: render, flick, down, move: pointerMove, up, key, keyUp,
      click, hover, resultsShown, outcome, medal, pause,
    };
  }

  root.EventUi = { create, GUIDES };
})(this);
