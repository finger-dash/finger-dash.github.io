// Screen pieces shared by the events: banners, hints and the results table.
(function (root) {
  'use strict';

  const ordinal = (n) => n + (['ST', 'ND', 'RD'][n - 1] || 'TH');

  function create({ view, mobile, shell }) {
    const { ctx, rect, text } = view;

    // Translucent box behind text.
    function shade(x, y, w, h, alpha = 0.75) {
      ctx.globalAlpha = alpha;
      rect(x, y, w, h, '#10101c');
      ctx.globalAlpha = 1;
    }

    // Centred lines of small text on a translucent box.
    function lines(list, y) {
      const w = Math.max(...list.map((l) => l.length)) * 4 + 12;
      shade(view.W / 2 - w / 2, y - 4, w, list.length * 9 + 4);
      list.forEach((l, i) => text(l, view.W / 2, y + i * 9, '#fff', 1, 'center'));
    }

    function topLeft(first, second) {
      text(first, 5, 5 + view.layout.top, '#fff');
      text(second, 5, 13 + view.layout.top, '#f9d56e');
    }

    function topRight(first, second) {
      text(first, view.W - 5, 5 + view.layout.top, '#fff', 1, 'right');
      text(second, view.W - 5, 13 + view.layout.top, '#fff', 1, 'right');
    }

    // Quit button on touch screens, or the pointer capture reminder.
    function footer(capture) {
      if (mobile.isTouch()) {
        const quit = shell.quitBox();
        rect(quit.x, quit.y, quit.w, quit.h, '#10101c');
        text('MENU', quit.x + quit.w / 2, quit.y + 4, '#fff', 1, 'center');
      } else if (capture && !shell.locked() && !shell.paused()) {
        // At the very bottom, clear of the instructions.
        shade(view.W / 2 - 60, view.H - 12, 120, 11);
        text('CLICK TO CAPTURE THE POINTER', view.W / 2, view.H - 9, '#fff', 1, 'center');
      }
    }

    // table: athletes in finishing order. columns: {labels, width, cell(athlete, i)}
    // where cell returns [text, highlighted].
    function results({ title, role, table, columns, note, next }) {
      const { panel, retry, menu } = shell.resultsBoxes();
      const W = view.W;
      shell.panel(panel.x, panel.y, panel.w, panel.h);
      text(title, W / 2, panel.y + 6, '#f9d56e', 3, 'center');

      const left = panel.x + 8, right = panel.x + panel.w - 8;
      const column = (i) => right - (columns.labels.length - 1 - i) * columns.width;
      const head = panel.y + 28;
      text('POS', left, head, '#9ab');
      text(role, left + 18, head, '#9ab');
      columns.labels.forEach((label, i) => text(label, column(i), head, '#9ab', 1, 'right'));
      table.forEach((a, row) => {
        const y = panel.y + 39 + row * 13;
        if (a.isPlayer) rect(panel.x + 4, y - 3, panel.w - 8, 11, '#2b4a78');
        text(ordinal(row + 1), left, y, '#fff');
        Countries.drawFlag(ctx, a.country, left + 18, y - 1, 10.5, 7);
        text(a.name, left + 31, y, a.isPlayer ? '#fff' : '#d8d8e8');
        columns.labels.forEach((_, i) => {
          const [value, highlight] = columns.cell(a, i);
          text(value, column(i), y, highlight ? '#f9d56e' : '#d8d8e8', 1, 'right');
        });
      });
      text(note, W / 2, panel.y + 120, '#9ab', 1, 'center');
      const touch = mobile.isTouch();
      shell.button(retry, touch ? next : `${next} - ENTER`, '#5be37d');
      shell.button(menu, touch ? 'MENU' : 'MENU - M', '#9ab');
    }

    return { shade, lines, topLeft, topRight, footer, results };
  }

  root.FieldUi = { create, ordinal };
})(this);
