// Shot put screen: circle gesture, throwing circle, flying shot and results.
(function (root) {
  'use strict';

  const BOARD_DELAY = 1.8;
  const GUARD = 0.6;
  const ARROWS = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];

  function create({ view, mobile, shell }) {
    const { ctx, rect, text } = view;
    const scene = Scene3d.create(view);
    const ui = FieldUi.create({ view, mobile, shell });
    const avatar = Avatar.createAvatar(Countries, Font, 4);
    let contest = null, finger = null, trail = [], nextArrow = 0, turn = 0, power = 0;
    let record = null;
    try { record = Number(localStorage.getItem('shotput.best')) || null; } catch (_) {}

    // The shot leaves towards wherever the athlete is seen facing at the release.
    const release = (p, angle) => ShotPut.throwShot(contest, p, angle, (turn * 180) / Math.PI);
    const spin = new Spin.SpinDetector(({ power: p, angle }) => release(p, angle));

    function newAttempt() {
      spin.reset();
      finger = null; trail = []; nextArrow = 0; turn = 0; power = 0;
    }

    function start(profile) {
      contest = ShotPut.createContest({
        difficulty: profile.difficulty, country: profile.country, playerName: profile.name.trim(),
      });
      newAttempt();
    }

    const resultsShown = () => contest.phase === 'landed' && contest.time > BOARD_DELAY;
    const resultsReady = () => resultsShown() && contest.time > BOARD_DELAY + GUARD;

    // ---------- Input ----------

    function feed(dx, dy, t) {
      if (contest.phase !== 'spin' || (!dx && !dy)) return;
      ShotPut.begin(contest);
      spin.feed(dx, dy, t);
      trail.push({ x: spin.x, y: spin.y, t });
    }

    function down(p) {
      if (!p.mouse && finger === null) finger = p.id;
    }
    function move(p) {
      // One finger draws the circles; the trackpad pointer needs no button.
      if (p.mouse ? shell.locked() : p.id === finger) feed(p.dx, p.dy, p.t);
    }
    function up(p) {
      if (p.id === finger) finger = null;
    }
    // Lifts are not reported while paused.
    function pause() {
      finger = null;
    }
    const wheel = (dx, dy, t) => feed(dx, dy, t);

    function advance() {
      if (ShotPut.isOver(contest)) shell.restart();
      else {
        ShotPut.nextAttempt(contest);
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
      // Keyboard fallback: arrows in clockwise order, then Space.
      if (ARROWS.includes(e.code)) {
        e.preventDefault();
        if (contest.phase !== 'spin' || e.code !== ARROWS[nextArrow]) return;
        nextArrow = (nextArrow + 1) % ARROWS.length;
        ShotPut.begin(contest);
        spin.power = Math.min(1, spin.power + 0.035);
        spin.angle += Math.PI / 2;
        spin.turned += Math.PI / 2;
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (spin.turned > 0) release(spin.power, 0);
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
      if (contest.phase === 'spin') {
        spin.update(dt);
        power = spin.power;
        // The thrower keeps turning in the direction of the circles.
        turn += (spin.angle - turn) * Math.min(1, dt * 30);
      }
      const before = contest.phase;
      ShotPut.step(contest, dt);
      if (before !== 'landed' && contest.phase === 'landed') {
        const { mark } = contest.result;
        if (mark !== null && (!record || mark > record)) {
          record = mark;
          shell.save('shotput.best', record);
        }
      }
      if (resultsShown()) shell.unlock();
    }

    // ---------- Drawing ----------

    function field() {
      const { poly, project } = scene;
      scene.backdrop();
      const edge = Math.tan((ShotPut.SECTOR * Math.PI) / 180);
      poly([[0, 0, 1.2], [-26 * edge, 0, 27], [26 * edge, 0, 27]], '#4fae52');
      for (const side of [-edge, edge]) { // sector lines
        poly([[-0.05, 0, 1.2], [0.05, 0, 1.2], [side * 26 + 0.12, 0, 27], [side * 26 - 0.12, 0, 27]], '#f4f4f4');
      }
      const arc = (radius, thick, color) => {
        const from = -ShotPut.SECTOR, step = ShotPut.SECTOR / 5;
        for (let a = from; a < ShotPut.SECTOR; a += step) {
          const at = (deg, r) => [Math.sin(deg * Math.PI / 180) * r, 0, Math.cos(deg * Math.PI / 180) * r];
          poly([at(a, radius), at(a + step, radius), at(a + step, radius + thick), at(a, radius + thick)], color);
        }
      };
      for (let m = 10; m <= 22; m += 2) arc(m, 0.1, '#cfe8cf');
      const rivals = contest.athletes.filter((a) => !a.isPlayer);
      const leader = Math.max(0, ...rivals.map((a) => ShotPut.best(a) || 0));
      if (leader) arc(leader, 0.22, '#f9d71c'); // mark to beat
      for (const side of [-1, 1]) {
        let above = Infinity; // top of the previous (nearer) sign
        for (let m = 10; m <= 22; m += 2) {
          const p = project(side * (m * edge + 0.6), 0.6, m * 0.87);
          if (!p || p.s < 3 || p.y > above - 10) continue; // far signs would pile up
          above = p.y;
          const w = String(m).length * 4 + 1;
          rect(p.x - w / 2, p.y - 1, w, 7, '#f4f4f4');
          text(m, p.x, p.y, '#14142a', 1, 'center');
        }
      }
    }

    function throwingCircle() {
      const ring = (r, color) => {
        const points = [];
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          points.push([Math.cos(a) * r, 0, Math.sin(a) * r]);
        }
        scene.poly(points, color);
      };
      ring(1.2, '#f4f4f4');
      ring(1.08, '#9a9aaa');
    }

    function thrower() {
      const feet = scene.project(0, 0, 0);
      if (!feet) return;
      const holding = !contest.shot;
      const country = Countries.byId(contest.player.country);
      const look = {
        skin: '#e0a070', hair: '#3a2418', kit: country.kit, name: contest.player.name === 'YOU' ? '' : contest.player.name,
        number: '10', country: country.id, headband: true,
      };
      const scale = feet.s / 40;
      ctx.globalAlpha = 0.35;
      rect(feet.x - 11 * scale, feet.y - 2 * scale, 22 * scale, 4 * scale, '#000');
      ctx.globalAlpha = 1;
      avatar.draw(ctx, feet.x, feet.y, scale, look,
        { speed: 0, cycle: 0, air: !holding, hold: holding }, turn);
    }

    function flyingShot() {
      const { shot } = contest;
      const k = contest.phase === 'flight' ? contest.time / ShotPut.FLIGHT_TIME : 1;
      const x = shot.side * k, z = shot.forward * k;
      const h = 1.9 * (1 - k) + Math.sin(Math.PI * k) * shot.distance * 0.2;
      const ground = scene.project(x, 0, z);
      if (ground) {
        ctx.globalAlpha = 0.35;
        scene.disc(ground.x, ground.y, Math.max(1.5, 0.14 * ground.s), '#000');
        ctx.globalAlpha = 1;
      }
      const p = scene.project(x, Math.max(0.1, h), z);
      if (p) {
        const r = Math.max(2, 0.13 * p.s);
        scene.disc(p.x, p.y, r + 1, '#14101c');
        scene.disc(p.x, p.y, r, '#8890a0');
        rect(p.x - r * 0.4, p.y - r * 0.6, r * 0.4, r * 0.4, '#e8ecf4');
      }
      if (contest.phase === 'landed' && contest.time < 0.7 && ground) { // dust
        for (let i = 0; i < 20; i++) {
          const a = i * 2.4, spread = contest.time * (14 + (i % 5) * 6);
          rect(ground.x + Math.cos(a) * spread, ground.y - Math.abs(Math.sin(a)) * spread * 0.6, 2, 2, '#8a6a3a');
        }
      }
    }

    function drawScene() {
      const cam = scene.camera;
      const flying = contest.shot && contest.phase !== 'spin';
      const k = !flying ? 0 : contest.phase === 'flight' ? contest.time / ShotPut.FLIGHT_TIME : 1;
      // The camera stays behind the thrower, then chases the shot. When the shot goes
      // the wrong way it backs off instead, to show where it ends up.
      const arc = flying ? Math.sin(Math.PI * Math.min(1, k)) : 0;
      cam.z = -4.4;
      cam.x = 0;
      cam.h = 2.3 + arc * 2;
      if (flying && contest.shot.wrongWay) {
        const { side, forward } = contest.shot;
        cam.z -= (Math.max(0, -forward) + Math.abs(side) * 0.8) * k;
        cam.x = side * k * 0.3;
      } else if (flying) {
        cam.z += Math.max(0, contest.shot.forward * k - 5);
        cam.x = contest.shot.side * k * 0.8;
      }
      field();
      throwingCircle();
      if (cam.z < -1) thrower();
      if (flying) flyingShot();
    }

    // The path of the finger, so the player sees the circles being drawn.
    function drawTrail(now) {
      trail = trail.filter((p) => now - p.t < 450);
      if (!trail.length) return;
      const head = trail[trail.length - 1];
      let cx = 0, cy = 0;
      for (const p of trail) { cx += p.x / trail.length; cy += p.y / trail.length; }
      const { w: W, h: H, portrait } = view.layout;
      const ox = portrait ? W / 2 : W - 52, oy = portrait ? H * 0.82 : H * 0.7;
      const clamp = (v) => Math.max(-36, Math.min(36, v * 0.3));
      for (const p of trail) {
        const size = p === head ? 5 : 2;
        rect(ox + clamp(p.x - cx) - size / 2, oy + clamp(p.y - cy) - size / 2, size, size,
          p === head ? '#fff' : '#f9d56e');
      }
    }

    function draw(now) {
      drawScene();
      if (resultsShown()) {
        const table = ShotPut.standings(contest);
        const over = ShotPut.isOver(contest);
        const { mark, reason } = contest.result;
        ui.results({
          title: !over ? (mark === null ? `${reason}!` : `${mark.toFixed(2)} M`)
            : !ShotPut.best(table[0]) ? 'NO WINNER' : table[0].isPlayer ? 'YOU WIN!' : `${table[0].name} WINS!`,
          role: 'THROWER', table,
          columns: {
            labels: ['T1', 'T2', 'T3'], width: 24,
            cell(a, i) {
              const m = a.marks[i];
              return [m === undefined ? '-' : m === null ? 'X' : m.toFixed(1), m != null && m === ShotPut.best(a)];
            },
          },
          note: over ? `YOUR RECORD ${record ? record.toFixed(2) : '--'} M` : `ROUND ${contest.attempt + 1}/${ShotPut.ATTEMPTS}`,
          next: over ? 'RETRY' : 'NEXT THROW',
        });
        return;
      }
      const { w: W, horizon } = view.layout;
      const left = Math.max(0, ShotPut.TIME_LIMIT - (contest.phase === 'spin' && contest.started ? contest.time : 0));
      ui.topLeft(`THROW ${contest.attempt + 1}/${ShotPut.ATTEMPTS}`, `BEST ${record ? record.toFixed(2) : '--'}`);
      if (contest.phase === 'spin') {
        ui.topRight(`TIME ${left.toFixed(1)}`, '');
        shell.power(power);
        drawTrail(now);
        if (!contest.started) {
          const y = Math.round(view.H * (view.layout.portrait ? 0.72 : 0.8)); // below the circle
          ui.lines(mobile.isTouch()
            ? ['DRAW CIRCLES TO SPIN', 'SWIPE UP FACING THE FIELD']
            : ['MOVE IN CIRCLES TO SPIN', 'SWIPE UP FACING THE FIELD'], y);
        } else if (power > 0.55 || left < 3) {
          text('SWIPE UP!', W / 2, horizon - 34, '#f9d56e', 3, 'center');
          text('FACING THE FIELD', W / 2, horizon - 17, '#fff', 1, 'center');
        }
      } else if (contest.phase === 'flight') {
        if (contest.shot.foul) text(contest.shot.wrongWay ? 'WRONG WAY!' : 'OUT OF THE SECTOR', W / 2, horizon - 30, '#e8505b', 2, 'center');
      } else {
        const { mark, reason } = contest.result;
        ui.shade(W / 2 - 66, horizon - 40, 132, 27);
        text(mark === null ? `${reason}!` : `${mark.toFixed(2)} M`, W / 2, horizon - 34,
          mark === null ? '#e8505b' : '#f9d56e', 3, 'center');
      }
      ui.footer(true);
    }

    return { lock: true, start, update, draw, key, click, down, move, up, wheel, pause, resultsShown };
  }

  root.ShotPutUi = { create };
})(this);
