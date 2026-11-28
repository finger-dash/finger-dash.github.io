// Archery screen: first person aiming, the camera that follows the arrow and results.
(function (root) {
  'use strict';

  const BOARD_DELAY = 2.2;
  const GUARD = 0.6;
  const PULL = 0.2;          // share of the screen height that draws the bow fully
  const AIM_PER_PX = 0.004;  // meters on the target per CSS px moved
  const KEY_STEP = 0.04;
  const CENTER_H = 1.4;      // height of the target center
  const FACE = ['#f4f4f4', '#f4f4f4', '#222222', '#222222', '#2b9ad6',
    '#2b9ad6', '#e8404b', '#e8404b', '#f9d71c', '#f9d71c']; // outer to inner

  function create({ view, mobile, shell }) {
    const { ctx, rect, text } = view;
    const scene = Scene3d.create(view);
    const gear = BowArt.create(view);
    const ui = FieldUi.create({ view, mobile, shell });
    const { disc, line } = scene;
    let contest = null, finger = null, charging = false, record = null;
    let pulled = 0; // px the mouse has been dragged back
    const keys = new Set();
    try { record = Number(localStorage.getItem('archery.best')) || null; } catch (_) {}

    function newArrow() {
      finger = null; charging = false;
      keys.clear();
    }

    function start(profile) {
      contest = Archery.createContest({
        difficulty: profile.difficulty, country: profile.country, playerName: profile.name.trim(),
      });
      newArrow();
    }

    const resultsShown = () => contest.phase === 'landed' && contest.time > BOARD_DELAY;
    const resultsReady = () => resultsShown() && contest.time > BOARD_DELAY + GUARD;

    // ---------- Input ----------

    // Touch: put a finger down. Mouse and trackpad: press the button.
    function down(p) {
      if (contest.phase !== 'aim' || finger !== null) return;
      if (p.mouse && !shell.locked()) return;
      if (!p.mouse && shell.over(shell.quitBox(), p.x, p.y)) return;
      finger = p.id;
      pulled = 0;
    }

    // Mouse and trackpad work like a cue: moving aims, and dragging back with the
    // button held draws the bow, while sideways movement still corrects the aim.
    // Touch: pulling down draws the bow; every other movement of that finger aims.
    function move(p) {
      if (contest.phase !== 'aim') return;
      const full = Math.max(90, window.innerHeight * PULL);
      if (p.mouse) {
        if (!shell.locked()) return;
        if (finger === null) Archery.moveAim(contest, p.dx * AIM_PER_PX, -p.dy * AIM_PER_PX);
        else if (p.id === finger) {
          pulled = Math.max(0, Math.min(full, pulled + p.dy));
          Archery.drawTo(contest, pulled / full);
          Archery.moveAim(contest, p.dx * AIM_PER_PX, 0);
        }
        return;
      }
      if (p.id !== finger) return;
      let dy = p.dy;
      if (dy > 0 && contest.draw < 1) {
        const used = Math.min(dy, (1 - contest.draw) * full);
        Archery.pull(contest, contest.draw + used / full);
        dy -= used;
      }
      Archery.moveAim(contest, p.dx * AIM_PER_PX, -dy * AIM_PER_PX);
    }

    function up(p) {
      if (p.id !== finger) return;
      finger = null;
      Archery.loose(contest);
    }

    // Releases are not reported while paused: relax the bow instead of shooting.
    function pause() {
      finger = null;
      charging = false;
      keys.clear();
      Archery.drawTo(contest, 0);
    }

    function advance() {
      if (Archery.isOver(contest)) shell.restart();
      else {
        Archery.nextArrow(contest);
        newArrow();
        shell.relock();
      }
    }

    function key(e) {
      if (resultsShown()) {
        if (e.code === 'Enter' && resultsReady()) advance();
        else if (e.code === 'KeyM' || e.code === 'Escape') shell.exit();
        return;
      }
      if (e.code === 'Space') { e.preventDefault(); charging = true; }
      else if (e.code.startsWith('Arrow')) { e.preventDefault(); keys.add(e.code); }
    }

    function keyUp(e) {
      keys.delete(e.code);
      if (e.code === 'Space' && charging) {
        charging = false;
        Archery.loose(contest);
      }
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

    function update(dt) {
      if (contest.phase === 'aim') {
        if (charging) Archery.pull(contest, contest.draw + dt * 1.1);
        const speed = KEY_STEP * dt * 12;
        Archery.moveAim(contest,
          (keys.has('ArrowRight') - keys.has('ArrowLeft')) * speed,
          (keys.has('ArrowUp') - keys.has('ArrowDown')) * speed);
      }
      const over = Archery.isOver(contest);
      Archery.step(contest, dt);
      if (!over && Archery.isOver(contest)) {
        const sum = Archery.total(contest.player);
        if (!record || sum > record) {
          record = sum;
          shell.save('archery.best', record);
        }
      }
      if (resultsShown()) shell.unlock();
    }

    // ---------- Drawing ----------

    // Target face as rings of pixels, with the arrows already on it.
    function face(cx, cy, radius, hits) {
      disc(cx, cy, radius + 1.5, '#14101c');
      FACE.forEach((color, i) => disc(cx, cy, radius * (1 - i / 10), color));
      const k = radius / Archery.RADIUS;
      for (const hit of hits) {
        const x = cx + hit.x * k, y = cy - hit.y * k;
        const size = Math.max(2, radius / 16);
        rect(x - size / 2 - 1, y - size / 2 - 1, size + 2, size + 2, '#f4f4f4');
        rect(x - size / 2, y - size / 2, size, size, '#14101c');
      }
    }

    function stand(x, y, s) {
      for (const side of [-1, 1]) {
        line(x + side * 0.35 * s, y, x + side * 0.75 * s, y + 1.45 * s, Math.max(1, 0.06 * s), '#7a5a34');
      }
      disc(x, y, 0.78 * s, '#c9a96a');
    }

    // The wind rocks the whole view: it leans downwind and shudders in the gusts. The
    // picture is enlarged just enough to keep its edges off screen.
    const buffer = document.createElement('canvas');
    function rock(cx, cy) {
      const { speed } = contest.wind, t = contest.time, { W, H } = view;
      const strength = Math.abs(speed), unit = W / 320;
      const dx = (speed * 1.2 + strength * (0.45 * Math.sin(t * 13) + 0.25 * Math.sin(t * 29))) * unit;
      const dy = strength * (0.35 * Math.sin(t * 17 + 2) + 0.2 * Math.sin(t * 7)) * unit;
      const roll = speed * 0.0035 + strength * 0.0012 * Math.sin(t * 11);
      const peak = Math.abs(contest.wind.base) * 1.5;
      const zoom = 1 + (peak * 1.9 * unit) / (W / 2) + peak * 0.0047 * Math.max(W / H, H / W);
      const { canvas } = ctx, res = canvas.width / W;
      if (buffer.width !== canvas.width || buffer.height !== canvas.height) {
        buffer.width = canvas.width;
        buffer.height = canvas.height;
      }
      buffer.getContext('2d').drawImage(canvas, 0, 0);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.translate(Math.round((cx + dx) * res), Math.round((cy + dy) * res));
      ctx.rotate(roll);
      ctx.scale(zoom, zoom);
      ctx.drawImage(buffer, -cx * res, -cy * res);
      ctx.restore();
    }

    // Where the target center is on screen while aiming, and the sizes around it.
    function mark() {
      const { w: W, h: H, portrait } = view.layout;
      return portrait
        ? { x: W / 2, y: Math.round(H * 0.42), r: 36, scope: 48 }
        : { x: W / 2, y: 90, r: 30, scope: 38 };
    }

    // The range from the shooting line, with only the sight in front of the eye.
    function aimView() {
      const cam = scene.camera;
      cam.x = 0; cam.h = 1.7; cam.z = 0;
      scene.backdrop();
      const { x, y, r, scope } = mark();
      const k = r / Archery.RADIUS;
      stand(x, y, k);
      face(x, y, r, contest.hits);
      flag(x + (view.layout.portrait ? 66 : 96), y - 22);
      gusts();
      const at = Archery.sight(contest);
      gear.sight({ x: x + at.x * k, y: y - at.y * k }, scope, contest.draw >= 1);
      rock(x, y);
    }

    // The camera chases the arrow and stops in front of the target.
    function flightView() {
      const cam = scene.camera;
      const k = contest.phase === 'flight' ? contest.time / Archery.FLIGHT_TIME : 1;
      // Fast at first, slow motion on the approach.
      const travel = 1 - (1 - k) ** 2.2;
      const z = 1 + travel * (Archery.DISTANCE - 1);
      const hit = contest.impact;
      const x = hit.x * travel;
      const h = 1.45 + (CENTER_H + hit.y - 1.45) * travel + Math.sin(Math.PI * travel) * 1.6;
      cam.z = Math.min(z - 2.6, Archery.DISTANCE - 2.5);
      cam.x = x * 0.5 * (1 - travel);
      cam.h = CENTER_H + (h - CENTER_H) * (1 - travel) + 0.25 * (1 - travel);
      scene.backdrop();
      const target = scene.project(0, CENTER_H, Archery.DISTANCE);
      stand(target.x, target.y, target.s);
      const radius = Math.max(2, Archery.RADIUS * target.s);
      face(target.x, target.y, radius, contest.phase === 'landed' ? contest.hits : contest.hits.slice());
      if (contest.phase !== 'flight') return;
      const tip = scene.project(x, h, z), tail = scene.project(x + 0.06, h + 0.05, z - 0.8);
      if (tip && tail) {
        line(tail.x, tail.y, tip.x, tip.y, Math.max(1, 0.025 * tip.s), '#d8b47a');
        disc(tail.x, tail.y, Math.max(1.5, 0.05 * tail.s), '#e8505b');
        disc(tip.x, tip.y, Math.max(1, 0.025 * tip.s), '#c9d1dc');
      }
    }

    const tone = (strength) => (strength < 2 ? '#5be37d' : strength < 4 ? '#f9d71c' : '#ff6a4d');

    // A chevron pointing to side `dir`, 7 wide and 13 tall.
    function chevron(x, y, dir, color) {
      for (let i = -6; i <= 6; i++) {
        const px = x + dir * (4 - Math.abs(i) * 0.7) - 2;
        rect(px - 1, y + i - 1, 6, 3, '#14101c');
      }
      for (let i = -6; i <= 6; i++) rect(x + dir * (4 - Math.abs(i) * 0.7) - 2, y + i, 4, 1, color);
    }

    // The wind sign: which way, how hard. The chevrons run faster with more wind.
    function wind(y) {
      const { speed } = contest.wind;
      const strength = Math.abs(speed), dir = speed < 0 ? -1 : 1, color = tone(strength);
      const mid = view.W / 2, w = 150, h = 34;
      rect(mid - w / 2 - 2, y - 2, w + 4, h + 4, color);
      rect(mid - w / 2, y, w, h, '#14101c');
      const side = strength < 0.2 ? 'CALM' : dir < 0 ? 'WIND TO THE LEFT' : 'WIND TO THE RIGHT';
      text(side, mid, y + 3, color, 1, 'center');
      // The number sits opposite to where the arrows point.
      const nx = mid - dir * 36;
      text(strength.toFixed(1), nx, y + 13, '#fff', 3, 'center');
      text('M/S', nx + 21, y + 22, '#9ab');
      const count = strength < 0.2 ? 0 : strength < 2 ? 2 : strength < 4 ? 3 : 4;
      const lit = Math.floor(contest.time * (2 + strength * 2.2)) % Math.max(1, count);
      for (let i = 0; i < count; i++) {
        const x = mid + dir * (10 + i * 15);
        chevron(x, y + 21, dir, i === lit ? '#ffffff' : color);
      }
    }

    // Streaks crossing the field with the wind.
    function gusts() {
      const { speed } = contest.wind;
      const strength = Math.abs(speed), { W, H } = view;
      const count = Math.round(strength * 7);
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < count; i++) {
        const y = 48 + ((i * 53) % Math.max(20, H - 80));
        const run = contest.time * (40 + (i % 4) * 14) * Math.sign(speed) * (0.5 + strength / 3);
        const x = ((((i * 89 + run) % (W + 40)) + W + 40) % (W + 40)) - 20;
        rect(x, y, 6 + strength * 3, 1, '#ffffff');
      }
      ctx.globalAlpha = 1;
    }

    // A flag by the target: it stretches further out the harder the wind blows.
    function flag(x, y) {
      const { speed } = contest.wind;
      const strength = Math.abs(speed), dir = speed < 0 ? -1 : 1;
      rect(x - 1, y, 2, 56, '#e8ecf4');
      const reach = Math.round(6 + strength * 6);
      for (let i = 0; i < reach; i++) {
        const wave = Math.round(Math.sin(i * 0.5 - contest.time * (6 + strength * 2)) * 2);
        const sag = Math.round((i * i) / (14 + strength * strength * 9));
        rect(x + dir * (i + 1), y + wave + Math.min(14, sag), 1, 9, i % 8 < 4 ? tone(strength) : '#ffffff');
      }
    }

    function aimHud() {
      const { w: W, h: H, portrait, top, bottom } = view.layout;
      const { x, y, scope } = mark();
      wind(portrait ? y - scope - 44 : top + 4);
      // Draw meter.
      const tall = portrait ? 90 : 70;
      const mx = 7, my = H - bottom - tall - 16;
      rect(mx - 1, my - 1, 9, tall + 2, '#14101c');
      const fill = Math.round(tall * contest.draw);
      rect(mx, my + tall - fill, 7, fill, contest.draw >= 1 ? '#5be37d' : '#f9d56e');
      text('DRAW', mx - 1, my + tall + 4, '#fff');
      if (contest.draw === 0) {
        const lines = mobile.isTouch()
          ? ['PULL DOWN TO DRAW', 'MOVE TO AIM - LIFT TO SHOOT']
          : ['MOVE THE MOUSE TO AIM', 'HOLD CLICK AND PULL BACK', 'LET GO TO SHOOT'];
        ui.lines(lines, portrait ? y + scope + 18 : y + scope + 12);
      } else if (contest.held > 3) {
        text('YOUR ARM IS SHAKING!', x, y + scope + 14, '#e8505b', 1, 'center');
      }
    }

    function draw() {
      if (contest.phase === 'aim') aimView();
      else flightView();
      if (resultsShown()) {
        const table = Archery.standings(contest);
        const over = Archery.isOver(contest);
        ui.results({
          title: !over ? `${contest.result.points} PTS`
            : table[0].isPlayer ? 'YOU WIN!' : `${table[0].name} WINS!`,
          role: 'ARCHER', table,
          columns: {
            labels: ['1', '2', '3', '4', '5', '6', 'TOT'], width: 14,
            cell(a, i) {
              if (i === Archery.ARROWS) return [Archery.total(a), true];
              const m = a.marks[i];
              return [m === undefined ? '-' : m, m === 10];
            },
          },
          note: over ? `YOUR RECORD ${record} PTS` : `ARROW ${contest.attempt + 1}/${Archery.ARROWS}`,
          next: over ? 'RETRY' : 'NEXT ARROW',
        });
        return;
      }
      const { w: W, top } = view.layout;
      if (contest.phase === 'aim') { // keeps the clouds from washing out the scores
        ui.shade(2, 2 + top, 48, 20, 0.45);
        ui.shade(W - 50, 2 + top, 48, 20, 0.45);
      }
      ui.topLeft(`ARROW ${contest.attempt + 1}/${Archery.ARROWS}`, `BEST ${record || '--'}`);
      const leader = Math.max(...contest.athletes.filter((a) => !a.isPlayer).map(Archery.total));
      ui.topRight(`TOTAL ${Archery.total(contest.player)}`, `LEADER ${leader}`);
      if (contest.phase === 'aim') aimHud();
      else if (contest.phase === 'landed') {
        const { points } = contest.result;
        const y = top + 28;
        ui.shade(W / 2 - 52, y - 6, 104, 37);
        text(points ? `${points}` : 'MISS', W / 2, y, points >= 9 ? '#f9d56e' : '#fff', 4, 'center');
        text(points === 10 ? 'PERFECT!' : points ? 'POINTS' : 'OFF THE TARGET', W / 2, y + 23, '#fff', 1, 'center');
      } else if (contest.time < 0.5) text('SHOT!', W / 2, view.layout.horizon - 40, '#fff', 3, 'center');
      ui.footer(contest.phase === 'aim');
    }

    return { lock: true, start, update, draw, key, keyUp, click, down, move, up, pause, resultsShown };
  }

  root.ArcheryUi = { create };
})(this);
