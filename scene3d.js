// Small pinhole camera for the events held on the infield. The camera looks
// towards +z; x grows to the right and h is the height above the ground.
(function (root) {
  'use strict';

  const NEAR = 0.5;

  function create(view) {
    const { ctx, rect } = view;
    const camera = { x: 0, h: 2, z: 0, focal: 160 };
    const horizon = () => view.layout.horizon;

    // World point -> screen position and pixels per meter; null behind the camera.
    function project(x, h, z) {
      const d = z - camera.z;
      if (d < NEAR) return null;
      const s = camera.focal / d;
      return { x: view.W / 2 + (x - camera.x) * s, y: horizon() + (camera.h - h) * s, s, d };
    }

    // Filled polygon of [x, h, z] points, clipped against the near plane.
    function poly(points, color) {
      // The margin keeps clipped points projectable despite rounding.
      const near = camera.z + NEAR + 1e-6;
      const out = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        if (a[2] >= near) out.push(a);
        if ((a[2] >= near) !== (b[2] >= near)) {
          const k = (near - a[2]) / (b[2] - a[2]);
          out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, near]);
        }
      }
      if (out.length < 3) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      out.forEach(([x, h, z], i) => {
        const p = project(x, h, z);
        if (i) ctx.lineTo(Math.round(p.x), Math.round(p.y));
        else ctx.moveTo(Math.round(p.x), Math.round(p.y));
      });
      ctx.closePath();
      ctx.fill();
    }

    // Pixel disc.
    function disc(cx, cy, radius, color) {
      const r = Math.max(0.5, radius);
      const from = Math.round(cy - r), to = Math.round(cy + r);
      for (let y = from; y < to; y++) {
        const half = Math.sqrt(Math.max(0, r * r - (y + 0.5 - cy) ** 2));
        rect(cx - half, y, half * 2, 1, color);
      }
    }

    // Thick pixel line between two screen points.
    function line(x0, y0, x1, y1, size, color) {
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      for (let i = 0; i <= steps; i++) {
        const x = x0 + ((x1 - x0) * i) / steps, y = y0 + ((y1 - y0) * i) / steps;
        rect(x - size / 2, y - size / 2, size, size, color);
      }
    }

    const FANS = ['#e8505b', '#f9d56e', '#4ac6d4', '#f4f4f4', '#8a5cc4', '#f39c4a'];
    const noise = (a, b) => Math.abs(Math.sin(a * 12.9 + b * 78.2) * 43758.5) % 1;

    // Sky, stands on the horizon and a mown grass field.
    function backdrop() {
      const W = view.W, H = view.H, y = horizon();
      rect(0, 0, W, y, '#3b6fd4');
      rect(0, y * 0.5, W, y * 0.5, '#6fa8ee');
      const shift = -camera.x * 2;
      for (let i = 0; i < 6; i++) {
        const x = ((i * 67 + shift) % (W + 60) + W + 60) % (W + 60) - 30;
        const cy = 8 + view.layout.top + ((i * 11) % Math.max(10, y * 0.35));
        rect(x, cy, 30, 4, '#fff'); rect(x + 6, cy - 3, 16, 3, '#fff');
      }
      rect(0, y - 18, W, 18, '#2b2b45');
      for (let row = 0; row < 5; row++) {
        for (let x = -2; x < W; x += 4) {
          rect(x + (row % 2) * 2 + (shift % 4), y - 16 + row * 3, 2, 2, FANS[Math.floor(noise(row, x) * FANS.length)]);
        }
      }
      rect(0, y - 2, W, 2, '#f4f4f4');
      rect(0, y, W, H - y, '#3f9e45');
      for (let z = Math.floor(camera.z / 8) * 8; z < camera.z + 90; z += 8) { // mow stripes
        poly([[-80, 0, z], [80, 0, z], [80, 0, z + 4], [-80, 0, z + 4]], '#358a3c');
      }
    }

    return { camera, project, poly, disc, line, backdrop };
  }

  root.Scene3d = { create };
})(this);
