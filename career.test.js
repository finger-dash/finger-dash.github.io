const test = require('node:test');
const assert = require('node:assert');
const Career = require('./career.js');
const Home = require('./home.js');
const Font = require('./font.js');

test('every event has bars and every bar helps some event', () => {
  assert.deepStrictEqual(Object.keys(Career.EVENTS).sort(), Home.EVENTS.map((e) => e.id).sort());
  const stats = Career.STATS.map((s) => s.id);
  const main = new Set(Object.values(Career.EVENTS).map((e) => e[1]));
  assert.deepStrictEqual([...main].sort(), stats.slice().sort());
  for (const [, a, b] of Object.values(Career.EVENTS)) assert.ok(stats.includes(a) && stats.includes(b) && a !== b);
});

test('every bar can be filled with free training', () => {
  const career = Career.create();
  for (let i = 0; i < 40; i++) {
    for (const action of Career.ACTIONS.filter((a) => !a.risky)) Career.train(career, action.id);
  }
  assert.ok(Object.values(career.stats).every((v) => v === Career.MAX));
});

test('doping fills one bar at random and lowers the others', () => {
  const career = Career.create();
  const changes = Career.train(career, 'doping', () => 0.99);
  assert.strictEqual(career.stats.reflexes, 100);
  assert.strictEqual(career.stats.speed, Career.START - 10);
  assert.strictEqual(changes.reflexes, 80);
  for (let i = 0; i < 5; i++) Career.train(career, 'doping', () => 0.99);
  assert.strictEqual(career.stats.speed, 0);
});

test('a fitter athlete meets weaker rivals and easier controls', () => {
  const weak = Career.create({ stats: { strength: 0, balance: 0 } });
  const fit = Career.create({ stats: { strength: 100, balance: 100 } });
  assert.strictEqual(Career.form(fit, 'shotPut'), 1);
  assert.ok(Career.edge(fit, 'shotPut').rivals < 1 && Career.edge(weak, 'shotPut').rivals > 1);
  assert.ok(Career.edge(fit, 'shotPut').ease > Career.edge(weak, 'shotPut').ease);
});

test('only a better medal replaces the one won', () => {
  const career = Career.create();
  assert.ok(Career.award(career, 'diving', 'silver'));
  assert.ok(!Career.award(career, 'diving', 'bronze'));
  assert.ok(!Career.award(career, 'diving', null));
  assert.ok(Career.award(career, 'diving', 'gold'));
  assert.strictEqual(Career.count(career, 'gold'), 1);
});

test('gold in every event makes a champion', () => {
  const career = Career.create();
  const ids = Object.keys(Career.EVENTS);
  ids.slice(1).forEach((id) => Career.award(career, id, 'gold'));
  assert.ok(!Career.champion(career));
  Career.award(career, ids[0], 'gold');
  assert.ok(Career.champion(career));
});

test('a saved career comes back and damaged data is ignored', () => {
  const career = Career.create();
  Career.train(career, 'run');
  Career.award(career, 'trap', 'bronze');
  assert.deepStrictEqual(Career.create(JSON.parse(JSON.stringify(career))), career);
  const broken = Career.create({ stats: { speed: 'x', jump: 900 }, medals: { trap: 'tin', nope: 'gold' } });
  assert.strictEqual(broken.stats.speed, Career.START);
  assert.strictEqual(broken.stats.jump, 100);
  assert.deepStrictEqual(broken.medals, {});
});

test('medals by place and by duel margin', () => {
  assert.deepStrictEqual([0, 1, 2, 3].map(Career.forPlace), ['gold', 'silver', 'bronze', null]);
  assert.deepStrictEqual([[5, 3], [4, 5], [2, 5], [0, 5]].map(([a, b]) => Career.forDuel(a, b)),
    ['gold', 'silver', 'bronze', null]);
});

test('the game font can draw the names', () => {
  const names = [...Career.STATS, ...Career.ACTIONS].map((x) => x.name)
    .concat(Object.values(Career.EVENTS).map((e) => e[0]));
  for (const name of names) {
    for (const c of name) assert.ok(c === ' ' || Font.GLYPHS[c], `${name}: ${c}`);
  }
});

test('every screen puts its buttons inside, without overlapping', () => {
  const CareerUi = require('./career-ui.js');
  const layouts = [
    { w: 320, h: 180, portrait: false, top: 0, bottom: 0 },
    { w: 200, h: 356, portrait: true, top: 0, bottom: 0 },
    { w: 200, h: 433, portrait: true, top: 20, bottom: 12 },
  ];
  for (const layout of layouts) {
    const b = CareerUi.boxes(layout);
    const training = [b.back, b.stage, b.other, ...Career.ACTIONS.map((_, i) => b.action(i))];
    const athlete = [b.back, b.link, ...Career.STATS.map((_, i) => b.stat(i))];
    for (const list of [training, athlete]) {
      list.forEach((a, i) => {
        assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= layout.w && a.y + a.h <= layout.h && a.h > 0, `${layout.h} ${i} ${JSON.stringify(a)}`);
        for (const c of list.slice(i + 1)) {
          assert.ok(a.x + a.w <= c.x || c.x + c.w <= a.x || a.y + a.h <= c.y || c.y + c.h <= a.y,
            `${layout.h}: ${JSON.stringify(a)} ${JSON.stringify(c)}`);
        }
      });
    }
    // The bars of the training room sit between the athlete and the exercises.
    const end = b.bars.y + 7 * b.bars.step;
    if (layout.portrait) assert.ok(b.bars.y >= b.stage.y + b.stage.h && end <= b.action(0).y);
    else assert.ok(b.bars.y >= b.stage.y + b.stage.h && end <= layout.h);
  }
});

test('training changes how strong the rivals of every event are', () => {
  const edge = { rivals: 1.1, ease: 0.8 };
  const seeded = () => { let s = 7; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; };
  const marks = (module, options) => require(module).createContest({ rng: seeded(), ...options }).athletes[1].plan;
  for (const module of ['./longjump.js', './shotput.js', './archery.js', './weightlifting.js']) {
    assert.notDeepStrictEqual(marks(module, { edge }), marks(module, {}), module);
  }
  const Race = require('./race.js');
  const pace = (o) => Race.createRace({ rng: seeded(), ...o }).runners.find((r) => !r.isPlayer).pace;
  assert.ok(pace({ edge }) > pace({}));
  const Boxing = require('./boxing.js');
  assert.ok(Boxing.createBout({ edge }).level.windup < Boxing.createBout().level.windup);
  const Events = require('./events.js');
  require('./rules-race.js');
  const dash = (o) => Events.createMatch('sprint100', { rng: seeded(), ...o }).athletes[1].plan[0];
  assert.ok(dash({ edge }) < dash({}));
});
