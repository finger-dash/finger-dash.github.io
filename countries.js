// Selectable countries: runner outfit and pixel flag (drawn on a 24x16 grid).
(function (root) {
  'use strict';

  // r(x, y, w, h, color) paints on the 24x16 flag grid.
  const rows = (r, colors) => colors.forEach((c, i) =>
    r(0, (16 / colors.length) * i, 24, 16 / colors.length, c));
  const cols = (r, colors) => colors.forEach((c, i) =>
    r((24 / colors.length) * i, 0, 24 / colors.length, 16, c));
  const disc = (r, cx, cy, radius, c) => {
    for (let y = -radius; y < radius; y++) {
      const half = Math.round(Math.sqrt(radius * radius - (y + 0.5) * (y + 0.5)));
      r(cx - half, cy + y, half * 2, 1, c);
    }
  };
  const star = (r, x, y, c) => { r(x + 1, y, 1, 1, c); r(x, y + 1, 3, 1, c); r(x, y + 2, 1, 1, c); r(x + 2, y + 2, 1, 1, c); };

  // kit: shirt, stripe, short, shoe, ink (name and number on the shirt)
  const k = (shirt, stripe, short, shoe, ink) => ({ shirt, stripe, short, shoe, ink });

  const COUNTRIES = [
    { id: 'ARG', name: 'ARGENTINA', kit: k('#74acdf', '#f4f4f4', '#1c2340', '#f9d56e', '#10182c'),
      flag(r) { rows(r, ['#74acdf', '#ffffff', '#74acdf']); disc(r, 12, 8, 2, '#f6b40e'); } },
    { id: 'BRA', name: 'BRAZIL', kit: k('#f9d71c', '#1f9d45', '#1f4fb0', '#ffffff', '#0b5a26'),
      flag(r) {
        r(0, 0, 24, 16, '#1f9d45');
        for (let y = 0; y < 12; y++) { const h = 10 - Math.floor(Math.abs(y - 5.5)) * 2 + 1; r(12 - h, 2 + y, h * 2, 1, '#f9d71c'); }
        disc(r, 12, 8, 3, '#1f3f99');
      } },
    { id: 'URU', name: 'URUGUAY', kit: k('#5bb4e8', '#5bb4e8', '#15151c', '#f4f4f4', '#0d1a2a'),
      flag(r) { r(0, 0, 24, 16, '#ffffff'); for (let i = 0; i < 4; i++) r(0, 2 + i * 4, 24, 2, '#2b62c9'); r(0, 0, 10, 9, '#ffffff'); disc(r, 5, 4, 3, '#f6b40e'); } },
    { id: 'CHI', name: 'CHILE', kit: k('#d52b1e', '#d52b1e', '#1f3f99', '#f4f4f4', '#ffffff'),
      flag(r) { rows(r, ['#ffffff', '#d52b1e']); r(0, 0, 8, 8, '#1f3f99'); star(r, 3, 3, '#ffffff'); } },
    { id: 'COL', name: 'COLOMBIA', kit: k('#fcd116', '#1f3f99', '#ce1126', '#1f3f99', '#10182c'),
      flag(r) { r(0, 0, 24, 8, '#fcd116'); r(0, 8, 24, 4, '#1f3f99'); r(0, 12, 24, 4, '#ce1126'); } },
    { id: 'MEX', name: 'MEXICO', kit: k('#0d7a4a', '#f4f4f4', '#f4f4f4', '#ce1126', '#06351f'),
      flag(r) { cols(r, ['#0d7a4a', '#ffffff', '#ce1126']); disc(r, 12, 8, 2, '#8a5a2b'); } },
    { id: 'USA', name: 'USA', kit: k('#1f3470', '#c8102e', '#c8102e', '#f4f4f4', '#ffffff'),
      flag(r) { for (let i = 0; i < 8; i++) r(0, i * 2, 24, 2, i % 2 ? '#ffffff' : '#c8102e'); r(0, 0, 11, 8, '#1f3470'); for (let y = 1; y < 8; y += 2) for (let x = 1 + (y % 4 > 1); x < 10; x += 2) r(x, y, 1, 1, '#ffffff'); } },
    { id: 'ESP', name: 'SPAIN', kit: k('#c60b1e', '#ffc400', '#1f2a5c', '#ffc400', '#ffffff'),
      flag(r) { r(0, 0, 24, 16, '#c60b1e'); r(0, 4, 24, 8, '#ffc400'); r(5, 6, 3, 4, '#c60b1e'); } },
    { id: 'FRA', name: 'FRANCE', kit: k('#1f3f99', '#ffffff', '#ffffff', '#e1000f', '#10182c'),
      flag(r) { cols(r, ['#1f3f99', '#ffffff', '#e1000f']); } },
    { id: 'ITA', name: 'ITALY', kit: k('#1668c4', '#1668c4', '#f4f4f4', '#009246', '#ffffff'),
      flag(r) { cols(r, ['#009246', '#ffffff', '#ce2b37']); } },
    { id: 'JPN', name: 'JAPAN', kit: k('#f4f4f4', '#bc002d', '#bc002d', '#15151c', '#15151c'),
      flag(r) { r(0, 0, 24, 16, '#ffffff'); disc(r, 12, 8, 5, '#bc002d'); } },
    { id: 'JAM', name: 'JAMAICA', kit: k('#fed100', '#009b3a', '#15151c', '#009b3a', '#0b3d1c'),
      flag(r) {
        for (let y = 0; y < 16; y++) {
          const d = y < 8 ? y : 15 - y, x = Math.round(d * 1.5);
          r(0, y, 24, 1, '#009b3a'); r(0, y, x, 1, '#15151c'); r(24 - x, y, x, 1, '#15151c');
          r(x, y, 3, 1, '#fed100'); r(21 - x, y, 3, 1, '#fed100');
        }
      } },
  ];

  const byId = (id) => COUNTRIES.find((c) => c.id === id) || COUNTRIES[0];

  // Draws a flag scaled into the rectangle (x, y, w, h) of a 2D context.
  function drawFlag(ctx, id, x, y, w, h) {
    const sx = w / 24, sy = h / 16;
    byId(id).flag((fx, fy, fw, fh, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x + fx * sx, y + fy * sy, fw * sx, fh * sy);
    });
  }

  const api = { COUNTRIES, byId, drawFlag };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Countries = api;
})(this);
