// Event cards of the newer events, added to the ones in art.js. Rectangles only.
(function (root) {
  'use strict';

  const SKIN = '#e0a070', HAIR = '#3a2418', SHIRT = '#74acdf', SHORT = '#1c2340', SHOE = '#f9d56e', INK = '#14101c';

  // rect, line and path: drawing helpers of art.js.
  function cards({ rect, line, path }) {
    function disc(cx, cy, r, color) {
      for (let dy = -r; dy < r; dy++) {
        const half = Math.round(Math.sqrt(r * r - (dy + 0.5) ** 2));
        rect(cx - half, cy + dy, half * 2, 1, color);
      }
    }
    // Side view athlete. Joints are [x, y]; legs are [knee, foot], arms [elbow, hand].
    function athlete(x, y, j, shirt = SHIRT) {
      const at = ([a, b]) => [x + a, y + b];
      const hip = at(j.hip), neck = at(j.neck), head = at(j.head);
      const leg = ([knee, foot]) => {
        path([hip, at(knee), at(foot)], 3, SKIN);
        rect(x + foot[0] - 2, y + foot[1] - 1, 5, 3, SHOE);
      };
      const arm = ([elbow, hand]) => path([neck, at(elbow), at(hand)], 2, SKIN);
      arm(j.arms[0]); leg(j.legs[0]);
      line(...hip, ...neck, 6, shirt);
      rect(hip[0] - 3, hip[1] - 3, 6, 5, SHORT);
      leg(j.legs[1]);
      rect(head[0] - 3, head[1] - 3, 7, 7, SKIN);
      rect(head[0] - 3, head[1] - 4, 7, 3, HAIR);
      arm(j.arms[1]);
    }

  function sky(x, y, ground, gh) {
    rect(x, y, 88, 48, '#3b6fd4'); rect(x, y + 18, 88, 30, '#6fa8ee');
    for (let i = 0; i < 11; i++) rect(x + i * 8, y + 48 - gh - 7 - (i % 3), 8, 7 + (i % 3), i % 2 ? '#51669c' : '#44588a');
    rect(x, y + 48 - gh, 88, gh, ground);
  }
  function hall(x, y, floor) {
    rect(x, y, 88, 48, '#241b38');
    for (let i = 0; i < 40; i++) rect(x + (i * 37) % 88, y + (i * 11) % 22, 2, 2, '#56407a');
    rect(x, y + 36, 88, 12, floor);
  }
  function water(x, y, from) {
    rect(x, y + from, 88, 48 - from, '#2b7fc9');
    for (let i = 0; i < 26; i++) rect(x + (i * 31) % 84, y + from + 2 + (i * 7) % (44 - from), 4, 1, '#8fd0f4');
  }
  const standing = { hip: [30, 28], neck: [30, 18], head: [30, 12], legs: [[[26, 35], [24, 41]], [[34, 35], [36, 41]]], arms: [[[24, 22], [22, 28]], [[36, 22], [38, 28]]] };
  const CARDS = {
    sprint100(x, y) { sky(x, y, '#cf5a3c', 10); rect(x, y + 43, 88, 1, '#f3e9dc');
      athlete(x, y, { hip: [47, 26], neck: [58, 19], head: [63, 15], legs: [[[39, 32], [28, 32]], [[55, 31], [53, 41]]], arms: [[[49, 19], [43, 24]], [[66, 24], [70, 17]]] });
      for (const [a, b] of [[8, 16], [14, 24], [4, 32]]) rect(x + a, y + b, 16, 1, '#fff'); },
    javelin(x, y) { sky(x, y, '#3f9e45', 11);
      athlete(x, y, { hip: [36, 28], neck: [31, 19], head: [34, 13], legs: [[[28, 34], [18, 40]], [[46, 32], [50, 41]]], arms: [[[22, 15], [15, 13]], [[41, 18], [49, 16]]] });
      line(x + 6, y + 18, x + 62, y + 2, 1, '#f4f4f4'); rect(x + 61, y + 1, 4, 2, '#f9d56e'); },
    highJump(x, y) { sky(x, y, '#cf5a3c', 8); rect(x + 28, y + 40, 52, 8, '#2b62c9'); rect(x + 28, y + 40, 52, 2, '#74acdf');
      rect(x + 22, y + 14, 2, 30, '#ddd'); rect(x + 66, y + 14, 2, 30, '#ddd'); line(x + 22, y + 20, x + 68, y + 20, 1, '#f9d56e');
      athlete(x, y, { hip: [45, 12], neck: [35, 14], head: [29, 17], legs: [[[53, 14], [55, 24]], [[55, 9], [61, 18]]], arms: [[[31, 22], [27, 26]], [[40, 20], [44, 24]]] }); },
    poleVault(x, y) { sky(x, y, '#cf5a3c', 8); rect(x + 50, y + 40, 38, 8, '#2b62c9');
      rect(x + 56, y + 8, 2, 34, '#ddd'); line(x + 50, y + 11, x + 66, y + 11, 1, '#f9d56e');
      path([[x + 52, y + 42], [x + 40, y + 32], [x + 37, y + 20], [x + 40, y + 10]], 1, '#f4f4f4');
      athlete(x, y, { hip: [48, 5], neck: [40, 10], head: [35, 12], legs: [[[56, 3], [63, 6]], [[54, 8], [62, 10]]], arms: [[[39, 14], [38, 18]], [[44, 9], [40, 10]]] }); },
    discus(x, y) { sky(x, y, '#3f9e45', 11); rect(x + 12, y + 41, 48, 3, '#c9c9d6');
      athlete(x, y, { hip: [34, 28], neck: [34, 18], head: [37, 12], legs: [[[26, 34], [22, 41]], [[43, 33], [46, 41]]], arms: [[[22, 20], [13, 24]], [[44, 15], [52, 12]]] });
      disc(x + 12, y + 25, 4, INK); disc(x + 12, y + 25, 3, '#c9d1dc'); for (const [a, b] of [[8, 14], [16, 8], [28, 5]]) rect(x + a, y + b, 2, 2, '#fff'); },
    hammer(x, y) { sky(x, y, '#3f9e45', 11); rect(x + 14, y + 41, 46, 3, '#c9c9d6');
      athlete(x, y, { hip: [32, 28], neck: [27, 19], head: [26, 13], legs: [[[27, 35], [23, 41]], [[40, 33], [42, 41]]], arms: [[[37, 21], [46, 20]], [[38, 23], [46, 20]]] });
      line(x + 46, y + 20, x + 70, y + 14, 1, '#f4f4f4'); disc(x + 72, y + 13, 4, INK); disc(x + 72, y + 13, 3, '#c9d1dc');
      for (let i = 0; i < 20; i++) rect(x + 44 + Math.cos(i / 3.4) * 32, y + 20 + Math.sin(i / 3.4) * 13, 1, 1, '#fff'); },
    swimming(x, y) { rect(x, y, 88, 48, '#2b7fc9'); water(x, y, 0);
      for (const ly of [8, 38]) for (let i = 0; i < 22; i++) rect(x + i * 4, y + ly, 3, 2, i % 2 ? '#e8505b' : '#f4f4f4');
      line(x + 28, y + 25, x + 50, y + 24, 7, SKIN); rect(x + 28, y + 22, 8, 7, SHORT); disc(x + 55, y + 22, 5, SKIN); rect(x + 52, y + 17, 8, 3, '#f9d56e');
      path([[x + 50, y + 22], [x + 62, y + 14], [x + 72, y + 22]], 2, SKIN);
      for (let i = 0; i < 18; i++) rect(x + 8 + (i * 13) % 20, y + 18 + (i * 5) % 14, 2, 2, '#e8f8ff'); },
    diving(x, y) { sky(x, y, '#2b7fc9', 10); water(x, y, 38); rect(x, y + 10, 20, 3, '#c9c9d6'); rect(x + 3, y + 13, 3, 26, '#9a9ab0');
      athlete(x, y, { hip: [46, 17], neck: [51, 25], head: [54, 30], legs: [[[41, 11], [36, 5]], [[44, 10], [40, 4]]], arms: [[[54, 29], [58, 35]], [[55, 28], [60, 34]]] });
      for (const [a, b] of [[27, 6], [32, 14], [34, 22]]) rect(x + a, y + b, 2, 2, '#fff'); },
    rowing(x, y) { sky(x, y, '#2b7fc9', 16); water(x, y, 32);
      path([[x + 8, y + 33], [x + 18, y + 38], [x + 70, y + 38], [x + 82, y + 33]], 3, '#a9743f');
      athlete(x, y, { hip: [40, 33], neck: [34, 24], head: [32, 18], legs: [[[50, 27], [58, 34]], [[52, 29], [60, 35]]], arms: [[[43, 28], [49, 26]], [[44, 29], [50, 27]]] });
      line(x + 49, y + 26, x + 24, y + 44, 1, '#f4f4f4'); rect(x + 19, y + 42, 7, 4, '#e8505b'); },
    canoe(x, y) { sky(x, y, '#2b7fc9', 20); water(x, y, 26);
      for (const [gx, col] of [[14, '#1f9d45'], [68, '#e8505b']]) { rect(x + gx, y + 6, 2, 26, '#f4f4f4'); for (let i = 0; i < 4; i++) rect(x + gx, y + 8 + i * 7, 2, 4, col); }
      path([[x + 22, y + 35], [x + 32, y + 40], [x + 56, y + 40], [x + 66, y + 35]], 4, '#f9d71c');
      line(x + 44, y + 36, x + 44, y + 26, 7, SHIRT); rect(x + 40, y + 16, 8, 8, SKIN); rect(x + 39, y + 14, 10, 4, '#e8505b');
      line(x + 30, y + 22, x + 60, y + 34, 1, '#222'); rect(x + 25, y + 18, 6, 6, '#e8505b'); rect(x + 59, y + 32, 6, 6, '#e8505b');
      for (let i = 0; i < 12; i++) rect(x + 20 + (i * 23) % 50, y + 41 + (i % 3) * 2, 3, 2, '#fff'); },
    surfing(x, y) { sky(x, y, '#2b7fc9', 12);
      for (let i = 0; i < 40; i++) rect(x + i, y + 48 - Math.max(6, 40 - i * i / 26), 1, Math.max(6, 40 - i * i / 26), '#2b7fc9');
      water(x, y, 40); for (let i = 0; i < 16; i++) rect(x + i * 2, y + 7 + (i * i) / 8 + (i % 3), 3, 3, '#fff');
      line(x + 34, y + 38, x + 66, y + 31, 3, '#f9d56e');
      athlete(x, y, { hip: [50, 24], neck: [47, 15], head: [49, 9], legs: [[[42, 28], [43, 35]], [[58, 27], [57, 32]]], arms: [[[38, 15], [31, 19]], [[56, 13], [64, 10]]] }); },
    cycling(x, y) { hall(x, y, '#a9743f'); rect(x, y + 42, 88, 1, '#e8505b'); rect(x, y + 39, 88, 1, '#2b62c9');
      for (const wx of [24, 62]) { disc(x + wx, y + 33, 11, '#f4f4f4'); disc(x + wx, y + 33, 9, '#241b38'); rect(x + wx - 1, y + 25, 1, 16, '#888'); rect(x + wx - 8, y + 32, 16, 1, '#888'); }
      path([[x + 24, y + 33], [x + 38, y + 22], [x + 54, y + 22], [x + 42, y + 34], [x + 24, y + 33]], 2, '#e8505b'); line(x + 54, y + 22, x + 62, y + 33, 2, '#e8505b');
      athlete(x, y, { hip: [37, 18], neck: [51, 13], head: [57, 9], legs: [[[47, 22], [43, 32]], [[46, 26], [38, 34]]], arms: [[[54, 18], [57, 21]], [[55, 18], [58, 21]]] }); },
    climbing(x, y) { sky(x, y, '#3f9e45', 5); rect(x + 20, y, 48, 43, '#b8683c');
      for (let i = 0; i < 22; i++) rect(x + 23 + (i * 17) % 40, y + 2 + (i * 11) % 38, 4, 3, ['#f9d56e', '#5be37d', '#f4f4f4'][i % 3]);
      athlete(x, y, { hip: [43, 27], neck: [43, 17], head: [43, 11], legs: [[[33, 29], [32, 38]], [[52, 31], [50, 40]]], arms: [[[34, 14], [33, 5]], [[53, 19], [55, 12]]] }); },
    beam(x, y) { hall(x, y, '#2b62c9'); rect(x + 8, y + 33, 72, 4, '#d9a86a'); rect(x + 14, y + 37, 3, 9, '#9a9ab0'); rect(x + 70, y + 37, 3, 9, '#9a9ab0');
      athlete(x, y, { hip: [43, 20], neck: [43, 11], head: [43, 6], legs: [[[41, 26], [40, 31]], [[54, 20], [65, 17]]], arms: [[[33, 11], [23, 9]], [[53, 9], [62, 4]]] }, '#e8505b'); },
    trap(x, y) { sky(x, y, '#3f9e45', 12);
      athlete(x, y, standing); line(x + 31, y + 20, x + 51, y + 10, 2, '#7a5a34'); line(x + 44, y + 14, x + 55, y + 8, 1, '#cfd3dc');
      disc(x + 73, y + 8, 4, '#f39c4a'); for (const [a, b] of [[66, 12], [61, 17], [78, 16], [69, 2]]) rect(x + a, y + b, 2, 2, '#f39c4a');
      for (const [a, b] of [[69, 8], [76, 8], [73, 4], [73, 11]]) rect(x + a, y + b, 1, 2, '#fff'); },
    tableTennis(x, y) { hall(x, y, '#4a3a33'); rect(x + 24, y + 30, 56, 3, '#1f9d45'); rect(x + 24, y + 29, 56, 1, '#f4f4f4'); rect(x + 52, y + 23, 2, 7, '#f4f4f4');
      rect(x + 30, y + 33, 2, 12, '#888'); rect(x + 74, y + 33, 2, 12, '#888');
      athlete(x, y, { hip: [12, 28], neck: [14, 18], head: [15, 12], legs: [[[8, 35], [6, 42]], [[18, 35], [18, 42]]], arms: [[[8, 23], [8, 29]], [[22, 22], [27, 21]]] });
      disc(x + 31, y + 18, 5, '#d52b1e'); rect(x + 27, y + 21, 3, 3, '#7a5a34'); disc(x + 63, y + 14, 2, '#fff'); for (const a of [57, 50, 44]) rect(x + a, y + 15 + (63 - a) / 5, 2, 1, '#fff'); },
    penalty(x, y) { sky(x, y, '#3f9e45', 16);
      for (let i = 0; i <= 12; i++) rect(x + 28 + i * 4.5, y + 10, 1, 22, '#9ab'); for (let i = 0; i < 5; i++) rect(x + 28, y + 14 + i * 4, 55, 1, '#9ab');
      rect(x + 26, y + 8, 59, 2, '#fff'); rect(x + 26, y + 8, 2, 25, '#fff'); rect(x + 83, y + 8, 2, 25, '#fff');
      athlete(x, y, { hip: [58, 23], neck: [66, 18], head: [71, 15], legs: [[[53, 29], [47, 31]], [[57, 30], [53, 36]]], arms: [[[72, 13], [79, 11]], [[70, 21], [76, 20]]] }, '#1f9d45');
      athlete(x, y, { hip: [14, 30], neck: [13, 20], head: [15, 15], legs: [[[9, 36], [5, 42]], [[23, 33], [27, 40]]], arms: [[[6, 22], [3, 27]], [[21, 22], [25, 18]]] });
      disc(x + 34, y + 38, 4, INK); disc(x + 34, y + 38, 3, '#fff'); rect(x + 33, y + 37, 2, 2, INK); },
    fencing(x, y) { hall(x, y, '#4a3a33'); rect(x + 4, y + 41, 80, 4, '#9a9ab0');
      const f = (flip) => { const m = (a) => (flip ? 88 - a : a), p = ([a, b]) => [m(a), b];
        athlete(x, y, { hip: p([22, 29]), neck: p([25, 19]), head: p([26, 13]), legs: [[p([13, 33]), p([9, 40])], [p([32, 33]), p([33, 40])]], arms: [[p([17, 17]), p([14, 11])], [p([31, 22]), p([36, 20])]] }, '#e8e8f0');
        rect(x + m(26) - 4, y + 9, 8, 8, '#555a70'); line(x + m(36), y + 20, x + m(flip ? 38 : 52), y + (flip ? 25 : 18), 1, '#fff'); };
      f(false); f(true); disc(x + 54, y + 18, 2, '#f9d56e'); },
  };

    return CARDS;
  }

  root.ArtMore = { cards };
})(this);
