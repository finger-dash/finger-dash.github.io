// The archery sight, seen up close while aiming.
(function (root) {
  'use strict';

  const OUTLINE = '#14101c';
  const DARK = '#1d1d2b';
  const RED = '#c8202a', RED_LIGHT = '#e8505b';
  const STEEL = '#c9d1dc';

  function create(view) {
    const { rect } = view;
    const { disc, line } = Scene3d.create(view);

    // Hard edged polygon with a one pixel outline.
    function poly(points, color, outline = OUTLINE) {
      const ys = points.map((p) => p[1]);
      const from = Math.max(0, Math.floor(Math.min(...ys)));
      const to = Math.min(view.H - 1, Math.ceil(Math.max(...ys)));
      for (let y = from; y <= to; y++) {
        const cy = y + 0.5, xs = [];
        for (let i = 0; i < points.length; i++) {
          const a = points[i], b = points[(i + 1) % points.length];
          if ((a[1] <= cy) !== (b[1] <= cy)) xs.push(a[0] + ((cy - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) {
          const x = Math.round(xs[i]);
          rect(x, y, Math.round(xs[i + 1]) - x, 1, color);
        }
      }
      if (!outline) return;
      points.forEach((a, i) => {
        const b = points[(i + 1) % points.length];
        line(a[0], a[1], b[0], b[1], 1, outline);
      });
    }

    // A tapered bar between two points.
    function bar(a, b, from, to, color, outline) {
      const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length, ny = dx / length;
      poly([
        [a[0] + nx * from, a[1] + ny * from], [b[0] + nx * to, b[1] + ny * to],
        [b[0] - nx * to, b[1] - ny * to], [a[0] - nx * from, a[1] - ny * from],
      ], color, outline);
    }

    function ring(cx, cy, radius, thick, color) {
      const outer = radius + thick;
      for (let y = Math.floor(-outer); y < outer; y++) {
        const mid = y + 0.5;
        const a = Math.sqrt(Math.max(0, outer * outer - mid * mid));
        if (Math.abs(mid) < radius) {
          const b = Math.sqrt(radius * radius - mid * mid);
          rect(cx - a, cy + y, a - b, 1, color);
          rect(cx + b, cy + y, a - b, 1, color);
        } else rect(cx - a, cy + y, a * 2, 1, color);
      }
    }

    // The sight next to the eye. `at` is where the pin points.
    function sight(at, radius, full) {
      const { x, y } = at;
      const edge = view.W + 4;
      // Extension bar to the bow, out of view on the right.
      bar([x + radius + 4, y], [edge, y + 6], 3.5, 8, DARK);
      line(x + radius + 8, y - 1, edge, y + 2, 1, '#4a5266');
      const mount = Math.max(x + radius + 14, view.W - 16);
      poly([[mount, y - 12], [edge, y - 16], [edge, y + 26], [mount, y + 18]], RED);
      line(mount + 2, y - 10, edge, y - 13, 2, RED_LIGHT);
      disc(mount + 7, y + 4, 4, OUTLINE);
      disc(mount + 7, y + 4, 2.5, STEEL);
      // Housing.
      ring(x, y, radius - 1, 8, OUTLINE);
      ring(x, y, radius, 5, DARK);
      ring(x, y, radius + 3, 1, '#4a5266');
      ring(x, y, radius, 1, full ? '#5be37d' : RED_LIGHT);
      // Pin: a post from below ending in a fiber dot.
      rect(x - 1.5, y + 3, 3, radius - 3, OUTLINE);
      rect(x - 0.5, y + 4, 1, radius - 5, STEEL);
      disc(x, y, 3.5, OUTLINE);
      disc(x, y, 2.2, full ? '#5be37d' : '#f9d71c');
      rect(x - 1, y - 1, 1, 1, '#ffffff');
    }

    return { sight };
  }

  root.BowArt = { create };
})(this);
