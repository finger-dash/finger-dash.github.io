// Pixel-art renderer: chase camera over the oval.
(function (root) {
  'use strict';

  const NEAR = 0.8;
  const SPRITE_PPM = 40; // runner model units per meter

  function createRenderer(canvas, Track, Race, Countries, Font, Avatar, Layout) {
    const ctx = canvas.getContext('2d');
    const avatar = Avatar.createAvatar(Countries, Font);

    // Set by resize(): logical size, horizon line and camera framing.
    let screenLayout, W, H, HORIZON, BASE_CAM_H, groundCanvas, groundCtx, ground, pixels;
    // Lens: these change with speed (wider and lower when running fast).
    let FOCAL = 160, CAM_H, CAM_DIST, rush = 0;

    // Everything is laid out in logical pixels; the canvas has `res` times more.
    function resize(layout) {
      screenLayout = layout;
      ({ w: W, h: H, horizon: HORIZON, camH: BASE_CAM_H } = layout);
      CAM_H = BASE_CAM_H;
      CAM_DIST = FOCAL / layout.ppm;
      canvas.width = W * layout.res;
      canvas.height = H * layout.res;
      ctx.setTransform(layout.res, 0, 0, layout.res, 0, 0);
      ctx.imageSmoothingEnabled = false;
      groundCanvas = document.createElement('canvas');
      groundCanvas.width = W; groundCanvas.height = H - HORIZON;
      groundCtx = groundCanvas.getContext('2d');
      ground = ctx.createImageData(W, H - HORIZON);
      pixels = new Uint32Array(ground.data.buffer);
    }

    const rgb = (hex) => { // little-endian ABGR
      const v = parseInt(hex.slice(1), 16);
      return (0xff000000 | ((v & 255) << 16) | (v & 0xff00) | (v >> 16)) >>> 0;
    };
    const C = {
      track: rgb('#cf5a3c'), trackAlt: rgb('#bd4d33'), line: rgb('#f3e9dc'), dark: rgb('#222222'),
      sand: rgb('#e8cf8a'), sandLine: rgb('#b99a55'), foul: rgb('#d52b1e'), target: rgb('#f9d71c'),
      grass: rgb('#3f9e45'), grassAlt: rgb('#358a3c'), apron: rgb('#a9a9bd'), outer: rgb('#4b4b66'),
    };

    // The camera is rebuilt every frame from the player's position.
    const cam = { x: 0, y: 0, fx: 1, fy: 0, heading: 0 };
    function aim(player) {
      const target = Math.min(1, Math.max(0, (player.speed - 4) / 9));
      rush += (target - rush) * 0.08;
      FOCAL = 160 - 52 * rush;
      CAM_H = BASE_CAM_H * (1 - 0.16 * rush);
      CAM_DIST = FOCAL / screenLayout.ppm;
      const p = Track.pointAt(player.s, Track.laneOffset(player.lane));
      cam.heading = p.heading;
      cam.fx = Math.cos(p.heading); cam.fy = Math.sin(p.heading);
      cam.x = p.x - cam.fx * CAM_DIST; cam.y = p.y - cam.fy * CAM_DIST;
    }

    // World -> camera space: d forward, r to the right, h height.
    function view(s, n, h) {
      const p = Track.pointAt(s, n);
      const dx = p.x - cam.x, dy = p.y - cam.y;
      return { d: dx * cam.fx + dy * cam.fy, r: dx * cam.fy - dy * cam.fx, h };
    }
    const screen = (v) => ({
      x: W / 2 + (v.r * FOCAL) / v.d, y: HORIZON + ((CAM_H - v.h) * FOCAL) / v.d, s: FOCAL / v.d,
    });

    const rect = (x, y, w, h, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };

    // Filled polygon in camera space, clipped against the near plane.
    function poly(points, color) {
      const out = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        if (a.d >= NEAR) out.push(a);
        if ((a.d >= NEAR) !== (b.d >= NEAR)) {
          const k = (NEAR - a.d) / (b.d - a.d);
          out.push({ d: NEAR, r: a.r + (b.r - a.r) * k, h: a.h + (b.h - a.h) * k });
        }
      }
      if (out.length < 3) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      out.forEach((v, i) => {
        const p = screen(v);
        if (i) ctx.lineTo(Math.round(p.x), Math.round(p.y));
        else ctx.moveTo(Math.round(p.x), Math.round(p.y));
      });
      ctx.closePath();
      ctx.fill();
    }

    function text(str, x, y, color, size = 1, align = 'left') {
      str = String(str).toUpperCase();
      const width = str.length * 4 * size - size;
      if (align === 'center') x -= width / 2;
      if (align === 'right') x -= width;
      x = Math.round(x);
      // Drop shadow first, except behind dark text on light buttons.
      const dark = /^#[01]/.test(color);
      for (const [dx, c] of dark ? [[0, color]] : [[1, '#000'], [0, color]]) {
        for (let i = 0; i < str.length; i++) {
          const g = Font.GLYPHS[str[i]];
          if (!g) continue;
          for (let p = 0; p < 15; p++) {
            if (g[p] === '1') {
              rect(x + dx + i * 4 * size + (p % 3) * size, y + dx + Math.floor(p / 3) * size, size, size, c);
            }
          }
        }
      }
    }

    // ---------- Sky and ground ----------

    function drawSky() {
      const dy = HORIZON - 62; // taller skies push the scenery down
      rect(0, 0, W, 30 + dy, '#3b6fd4');
      rect(0, 30 + dy, W, HORIZON - 30 - dy, '#6fa8ee');
      // Scenery sits at fixed compass angles, so it slides as the camera turns.
      const place = (angle) => {
        let a = (cam.heading - angle) % (2 * Math.PI);
        if (a > Math.PI) a -= 2 * Math.PI;
        if (a < -Math.PI) a += 2 * Math.PI;
        return W / 2 + a * FOCAL;
      };
      for (let i = 0; i < 22; i++) { // skyline
        const tall = 6 + ((i * 37) % 13);
        const x = place((i / 22) * 2 * Math.PI);
        rect(x, HORIZON - tall, 22, tall, i % 2 ? '#51669c' : '#44588a');
      }
      for (let i = 0; i < 8; i++) {
        const x = place((i / 8) * 2 * Math.PI + 0.3), y = 7 + ((i * 7) % 17) + Math.round(dy * 0.7);
        rect(x, y, 30, 4, '#fff'); rect(x + 6, y - 3, 16, 3, '#fff');
      }
      for (let i = 0; i < 4; i++) { // floodlights
        const x = place((i / 4) * 2 * Math.PI + 0.9);
        rect(x, 24 + dy, 2, HORIZON - 24 - dy, '#222a44'); rect(x - 5, 18 + dy, 12, 7, '#222a44');
        for (let j = 0; j < 3; j++) rect(x - 3 + j * 3, 20 + dy, 2, 2, '#fff6b0');
      }
    }

    // Long jump area painted over the player's lane: board, foul line and sand.
    const PIT_HALF = 1.7, PIT_FROM = 1, PIT_TO = 11.5;
    function pitColor(pit, rel, depthStep) {
      if (rel > -0.4 && rel <= 0) return C.line;
      if (rel > 0 && rel <= 0.2) return C.foul;
      if (rel < PIT_FROM || rel > PIT_TO) return null;
      // Lines stay at least one screen row thick, so they do not flicker far away.
      const thick = Math.min(0.3, Math.max(0.07, depthStep));
      if (pit.target && Math.abs(rel - pit.target) < thick) return C.target;
      return rel % 1 < thick ? C.sandLine : C.sand;
    }

    const at = { s: 0, n: 0 };
    function drawGround(pit, centre) {
      const edge = Track.HALF_WIDTH, lane = Track.LANE_WIDTH;
      const rx = cam.fy, ry = -cam.fx;
      let i = 0;
      for (let y = HORIZON; y < H; y++) {
        const depth = (FOCAL * CAM_H) / (y - HORIZON + 0.5);
        const mpp = depth / FOCAL;                       // meters per pixel
        const half = Math.min(0.16, Math.max(0.035, mpp * 0.55)); // line half width
        let wx = cam.x + cam.fx * depth + rx * (-W / 2 + 0.5) * mpp;
        let wy = cam.y + cam.fy * depth + ry * (-W / 2 + 0.5) * mpp;
        const far = depth > 90;
        const depthStep = depth / (y - HORIZON + 0.5) / 2;
        for (let x = 0; x < W; x++, i++, wx += rx * mpp, wy += ry * mpp) {
          Track.locate(wx, wy, at);
          const n = at.n;
          const alt = !far && Math.floor(at.s / 2.5) % 2 === 0;
          const tick = !far && at.s % 5 < 0.5;
          let c;
          if (n >= -edge - half && n <= edge + half) {
            const off = ((n + edge) % lane + lane) % lane;
            if (mpp < 0.45 && (off < half || off > lane - half)) c = C.line;
            else if (at.s < 0.9) c = (Math.floor(at.s / 0.45) + Math.floor((n + edge) / 0.625)) % 2 ? C.dark : C.line;
            else c = alt ? C.track : C.trackAlt;
          } else if (n < 0) {
            c = n > -6.8 ? (tick && n > -5.4 ? C.line : C.apron) : alt ? C.grass : C.grassAlt;
          } else {
            c = n < 6 ? (tick && n < 5.4 ? C.line : C.apron) : n < 16 ? C.outer : alt ? C.grass : C.grassAlt;
          }
          if (pit && Math.abs(n - centre) < PIT_HALF) c = pitColor(pit, at.s - pit.board, depthStep) || c;
          pixels[i] = c;
        }
      }
      groundCtx.putImageData(ground, 0, 0);
      ctx.drawImage(groundCanvas, 0, HORIZON);
    }

    // ---------- Stands ----------

    const CROWD_COLORS = ['#e8505b', '#f9d56e', '#4ac6d4', '#f4f4f4', '#8a5cc4', '#f39c4a'];
    const AD_COLORS = ['#e8505b', '#f4f4f4', '#2b62c9', '#f9d56e'];
    const noise = (a, b) => Math.abs(Math.sin(a * 12.9 + b * 78.2) * 43758.5) % 1;
    const SEG = 4;
    const stands = [];
    // Tall stands outside, low ones inside so they never hide the bend ahead.
    for (const side of [
      { front: 6.6, back: 11.5, low: 1.0, high: 4.4, rows: 4, seats: 6 },
      { front: -7, back: -9.5, low: 0.6, high: 1.7, rows: 2, seats: 6 },
    ]) {
      for (let k = 0; k < Track.LENGTH / SEG; k++) {
        const fans = [];
        for (let row = 0; row < side.rows; row++) {
          for (let seat = 0; seat < side.seats; seat++) {
            const t = (row + 0.5) / side.rows;
            fans.unshift({
              s: k * SEG + ((seat + 0.5) / side.seats) * SEG,
              n: side.front + (side.back - side.front) * t,
              h: side.low + (side.high - side.low) * t,
              c: CROWD_COLORS[Math.floor(noise(k + side.front, row * 7 + seat) * CROWD_COLORS.length)],
              p: noise(seat, k + row) * 7,
            });
          }
        }
        stands.push({ ...side, k, s: k * SEG, fans });
      }
    }

    function standItems(items, now, excited) {
      for (const st of stands) {
        const mid = view(st.s + SEG / 2, st.front, 0);
        if (mid.d < -SEG || mid.d > 190 || Math.abs(mid.r) > mid.d * 1.3 + 12) continue;
        items.push({
          d: view(st.s + SEG / 2, (st.front + st.back) / 2, 0).d,
          draw() {
            const a = st.s, b = st.s + SEG;
            poly([view(a, st.front, st.low), view(b, st.front, st.low), view(b, st.back, st.high), view(a, st.back, st.high)],
              st.k % 2 ? '#2b2b45' : '#33334f');
            poly([view(a, st.front, 0), view(b, st.front, 0), view(b, st.front, st.low), view(a, st.front, st.low)],
              AD_COLORS[(st.k >> 1) % AD_COLORS.length]);
            const skip = mid.d > 90 ? 2 : 1;
            for (let i = 0; i < st.fans.length; i += skip) {
              const f = st.fans[i];
              const v = view(f.s, f.n, f.h);
              if (v.d < NEAR + 1) continue;
              const p = screen(v);
              const size = Math.max(1, 0.45 * p.s);
              const bob = excited && Math.sin(now / 130 + f.p) > 0.6 ? size * 0.4 : 0;
              rect(p.x - size / 2, p.y - size - bob, size, size, f.c);
            }
          },
        });
      }
    }

    // ---------- Hurdles and finish gantry ----------

    function hurdleItems(items, race) {
      const player = race.player;
      Race.HURDLES.forEach((s, index) => {
        if (s - player.s < -3 || s - player.s > 75) return;
        for (const runner of race.runners) {
          const n = Track.laneOffset(runner.lane), w = Track.LANE_WIDTH * 0.4;
          const base = view(s, n, 0);
          if (base.d < NEAR + 0.3) continue;
          const down = runner.knocked.has(index);
          items.push({
            d: base.d,
            draw() {
              const top = down ? 0.18 : 0.95;
              for (let i = 0; i < 5; i++) {
                const a = n - w + (2 * w * i) / 5, b = n - w + (2 * w * (i + 1)) / 5;
                poly([view(s, a, top - 0.2), view(s, b, top - 0.2), view(s, b, top), view(s, a, top)],
                  i % 2 ? '#fff' : '#222');
              }
              if (down) return;
              for (const side of [-w, w]) {
                const p = screen(view(s, n + side, top)), q = screen(view(s, n + side, 0));
                rect(p.x - 0.5, p.y, Math.max(1, 0.06 * p.s), q.y - p.y, '#333');
              }
            },
          });
        }
      });
    }

    function gantryItem(items) {
      const e = Track.HALF_WIDTH + 0.5;
      // High enough to start above the screen, whatever the layout.
      const low = BASE_CAM_H + (HORIZON + 20) / 30, high = low + 0.8;
      const mid = view(0.5, 0, 0);
      if (mid.d < NEAR + 0.5 || mid.d > 120) return;
      items.push({
        d: mid.d,
        draw() {
          for (const n of [-e, e]) {
            poly([view(0.5, n - 0.12, 0), view(0.5, n + 0.12, 0), view(0.5, n + 0.12, high), view(0.5, n - 0.12, high)], '#ddd');
          }
          poly([view(0.5, -e, low), view(0.5, e, low), view(0.5, e, high), view(0.5, -e, high)], '#f9d56e');
          const p = screen(view(0.5, 0, high - 0.2));
          if (p.s > 7 && p.y > 0) text('FINISH', p.x, p.y, '#222', Math.max(1, Math.floor(p.s / 14)), 'center');
        },
      });
    }

    // ---------- Long jump pit ----------

    // Distance signs on both sides of the sand, and sand thrown up on landing.
    function pitItems(items, world) {
      const centre = Track.laneOffset(world.player.lane);
      for (let m = 2; m <= 11; m++) {
        for (const side of [-PIT_HALF - 0.3, PIT_HALF + 0.3]) {
          const base = view(world.pit.board + m, centre + side, 0);
          if (base.d < NEAR + 0.4 || base.d > 22) continue;
          if (base.d > 9 && m % 3 !== 2) continue; // far signs would pile up
          items.push({
            d: base.d,
            draw() {
              const p = screen(view(world.pit.board + m, centre + side, 0.45));
              const size = Math.max(1, Math.min(2, Math.floor(p.s / 18)));
              const w = String(m).length * 4 * size + 1;
              rect(p.x - w / 2, p.y - 1, w, 5 * size + 2, '#f4f4f4');
              rect(p.x - 0.5, p.y + 5 * size, 1, screen(base).y - p.y - 5 * size, '#333');
              text(m, p.x, p.y, '#14142a', size, 'center');
            },
          });
        }
      }
      if (world.splash === null) return;
      const spot = view(world.player.s, centre, 0);
      items.push({
        d: spot.d - 0.05,
        draw() {
          const t = world.splash;
          for (let i = 0; i < 36; i++) {
            const spread = (noise(i, 1) - 0.5) * 2.6 * (0.3 + t);
            const lift = Math.sin(Math.PI * t) * (0.2 + noise(i, 2) * 0.9);
            const v = view(world.player.s + (noise(i, 3) - 0.5) * t, centre + spread, lift);
            if (v.d < NEAR) continue;
            const p = screen(v), size = Math.max(1, 0.07 * p.s);
            rect(p.x, p.y, size, size, i % 3 ? '#e8cf8a' : '#b99a55');
          }
        },
      });
    }

    // ---------- Speed cues ----------

    const POLE_GAP = 6;
    function poleItems(items, player) {
      const first = Math.ceil((player.s - 4) / POLE_GAP);
      for (let k = first; k < first + 12; k++) {
        for (const n of [-5.2, 5.2]) {
          const base = view(k * POLE_GAP, n, 0);
          if (base.d < NEAR + 0.2) continue;
          items.push({
            d: base.d,
            draw() {
              const p = screen(base), q = screen(view(k * POLE_GAP, n, 1.5));
              const w = Math.max(1, 0.12 * p.s);
              rect(p.x - w / 2, q.y, w, p.y - q.y, '#e8e8f0');
              rect(p.x - w, q.y, w * 2, Math.max(1, 0.3 * p.s),
                AD_COLORS[((k % 4) + 4) % 4]);
            },
          });
        }
      }
    }

    // Streaks flying out from the vanishing point.
    function speedLines(now) {
      const count = Math.round(Math.max(0, rush - 0.35) * 40);
      const frame = Math.floor(now / 45);
      // 1 on the 320x180 layout; narrow screens go by their width, or they miss them.
      const reach = screenLayout.portrait ? W / 320 : Math.hypot(W, H) / 367;
      const tall = 0.7 * (H / W) / (180 / 320);
      for (let i = 0; i < count; i++) {
        const a = noise(i, frame) * Math.PI * 2;
        const from = (105 + noise(frame, i) * 70) * reach, length = 10 + rush * 28;
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(W / 2 + Math.cos(a) * from, HORIZON + Math.sin(a) * from * tall);
        ctx.lineTo(W / 2 + Math.cos(a) * (from + length), HORIZON + Math.sin(a) * (from + length) * tall);
        ctx.stroke();
      }
    }

    // ---------- Runners ----------

    function runnerItems(items, race, now) {
      for (const r of race.runners) {
        const n = Track.laneOffset(r.lane);
        const spot = view(r.s, n, 0);
        if (spot.d < NEAR + 0.6 || spot.d > 140) continue;
        items.push({
          d: spot.d - 0.01,
          draw() {
            const p = screen(spot);
            const k = p.s / SPRITE_PPM;
            // The long jumper carries its own height; racers derive it from the jump.
            const height = r.height === undefined ? Race.jumpHeight(r) : r.height;
            const shadow = (22 - height * 7) * k;
            ctx.globalAlpha = 0.35;
            rect(p.x - shadow / 2, p.y - 2 * k, shadow, Math.max(1, 4 * k), '#000');
            ctx.globalAlpha = 1;
            if (r.stumble > 0 && Math.floor(now / 70) % 2) return; // blink after a hit
            const feetY = p.y - height * p.s;
            avatar.draw(ctx, p.x, feetY, k, Avatar.lookFor(r, Countries),
              { speed: r.speed, cycle: r.cycle, air: r.jumpT >= 0 });
            if (!r.isPlayer && spot.d < 35) {
              text(r.name, p.x, feetY - 68 * k - 7, '#fff', 1, 'center');
            }
          },
        });
      }
    }

    function scene(race, now) {
      aim(race.player);
      // Camera shake at high speed.
      const shake = rush > 0.6 && race.player.jumpT < 0 ? Math.round(Math.sin(now / 28)) : 0;
      ctx.save();
      ctx.translate(0, shake);
      drawSky();
      drawGround(race.pit, Track.laneOffset(race.player.lane));
      const items = [];
      standItems(items, now, race.player.speed > 5);
      poleItems(items, race.player);
      if (race.pit) pitItems(items, race);
      else {
        gantryItem(items);
        hurdleItems(items, race);
      }
      runnerItems(items, race, now);
      items.sort((a, b) => b.d - a.d); // painter's algorithm: far to near
      for (const item of items) item.draw();
      speedLines(now);
      ctx.restore();
    }

    function minimap(race) {
      const ox = W - 34, oy = 39 + screenLayout.top, k = 0.38;
      ctx.globalAlpha = 0.85;
      rect(ox - 32, oy - 17, 64, 34, '#10101c');
      ctx.globalAlpha = 1;
      for (let s = 0; s < Track.LENGTH; s += 3) {
        const p = Track.pointAt(s, 0);
        rect(ox + p.x * k, oy - p.y * k, 1, 1, '#999');
      }
      const order = race.runners.slice().sort((a, b) => a.isPlayer - b.isPlayer); // player on top
      for (const r of order) {
        const p = Track.pointAt(r.s, 0);
        const size = r.isPlayer ? 4 : 3;
        rect(ox + p.x * k - 1, oy - p.y * k - 1, size, size, r.isPlayer ? '#fff' : Countries.byId(r.country).kit.shirt);
      }
    }

    resize({ ...Layout.LANDSCAPE, top: 0, bottom: 0, portrait: false });
    return {
      scene, minimap, text, rect, ctx, resize,
      get W() { return W; },
      get H() { return H; },
      get layout() { return screenLayout; },
    };
  }

  root.Renderer = { createRenderer };
})(this);
