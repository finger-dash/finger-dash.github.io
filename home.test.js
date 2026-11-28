'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Home = require('./home.js');
const Layout = require('./layout.js');

const DEVICES = {
  desktop: { touch: false, screenMin: 900, width: 1440, height: 900 },
  smallPhone: { touch: true, screenMin: 375, width: 375, height: 548 },
  notchPhone: { touch: true, screenMin: 390, width: 390, height: 844, inset: { top: 47, bottom: 34 } },
};

const make = (device = DEVICES.desktop) => {
  const view = { layout: Layout.compute(device), rect() {}, text() {} };
  return { view, home: Home.createHome(view) };
};
const centre = (b) => [b.x + b.w / 2, b.y + b.h / 2];

test('only single player can be chosen on the title screen', () => {
  const { view, home } = make();
  const [single, multi] = Home.titleBoxes(view.layout).modes;
  assert.deepStrictEqual(home.title.click(...centre(single)), { type: 'mode', id: 'single' });
  assert.strictEqual(home.title.click(...centre(multi)), null);
  assert.deepStrictEqual(home.title.key({ key: 'Enter' }), { type: 'mode', id: 'single' });
});

test('only the finished events can be chosen', () => {
  const { view, home } = make();
  const { card } = Home.eventBoxes(view.layout);
  const { next } = Home.eventBoxes(view.layout);
  Home.EVENTS.forEach((event, i) => {
    if (i && i % Home.PAGE === 0) home.events.click(...centre(next));
    assert.deepStrictEqual(home.events.click(...centre(card(i))), { type: 'event', id: event.id });
  });
});

test('keyboard moves over the events and wraps around', () => {
  const { home } = make();
  home.events.key({ key: 'ArrowLeft' }); // wraps to the last one
  assert.deepStrictEqual(home.events.key({ key: 'Enter' }), { type: 'event', id: 'fencing' });
  home.events.key({ key: 'ArrowRight' });
  assert.deepStrictEqual(home.events.key({ key: 'Enter' }), { type: 'event', id: 'hurdles400' });
  home.events.key({ key: 'ArrowRight' });
  assert.deepStrictEqual(home.events.key({ key: 'Enter' }), { type: 'event', id: 'longJump' });
  assert.deepStrictEqual(home.events.key({ key: 'Escape' }), { type: 'back' });
});

test('there are four full groups of events', () => {
  assert.strictEqual(Home.EVENTS.length, Home.PAGES.length * Home.PAGE);
});

test('the pages turn both ways', () => {
  const { view, home } = make();
  const { previous, card } = Home.eventBoxes(view.layout);
  home.events.click(...centre(previous));
  assert.deepStrictEqual(home.events.click(...centre(card(0))), { type: 'event', id: 'climbing' });
  home.events.key({ key: 'PageDown' });
  assert.deepStrictEqual(home.events.key({ key: 'Enter' }), { type: 'event', id: 'hurdles400' });
});

test('the back button returns to the title', () => {
  const { view, home } = make();
  assert.deepStrictEqual(home.events.click(...centre(Home.eventBoxes(view.layout).back)), { type: 'back' });
});

test('every box fits on screen and event cards hold their picture', () => {
  for (const [name, device] of Object.entries(DEVICES)) {
    const { view } = make(device);
    const { w, h, bottom } = view.layout;
    const events = Home.eventBoxes(view.layout);
    const title = Home.titleBoxes(view.layout);
    const boxes = [...title.modes, ...title.extras, title.tally, events.back, events.previous, events.next,
      ...Home.EVENTS.map((_, i) => events.card(i))];
    for (const b of boxes) {
      assert.ok(b.x >= 0 && b.x + b.w <= w, `${name}: horizontal overflow`);
      assert.ok(b.y >= 0 && b.y + b.h <= h - bottom, `${name}: vertical overflow`);
    }
    const card = events.card(0);
    assert.ok(card.w >= 90 && card.h >= 61, `${name}: card too small (${card.w}x${card.h})`);
  }
});

test('the athlete menus open from the title screen', () => {
  const { view, home } = make();
  const { extras } = Home.titleBoxes(view.layout);
  assert.deepStrictEqual(home.title.click(...centre(extras[0])), { type: 'screen', id: 'athlete' });
  assert.deepStrictEqual(home.title.key({ key: 't' }), { type: 'screen', id: 'training' });
});

test('the final opens only with every gold', () => {
  const medals = {};
  const { view } = make();
  const home = Home.createHome(view, null, () => medals);
  const { tally } = Home.titleBoxes(view.layout);
  assert.strictEqual(home.title.click(...centre(tally)), null);
  for (const event of Home.EVENTS) medals[event.id] = 'gold';
  assert.deepStrictEqual(home.title.click(...centre(tally)), { type: 'screen', id: 'champion' });
});

test('pointing at the arrows does not turn the page', () => {
  const { view, home } = make();
  const { next, card } = Home.eventBoxes(view.layout);
  assert.ok(home.events.hovering(...centre(next)));
  assert.deepStrictEqual(home.events.click(...centre(card(0))), { type: 'event', id: 'hurdles400' });
});

test('a locked event explains itself and leads to training', () => {
  const { view } = make();
  const home = Home.createHome(view, null, undefined,
    (id) => (id === 'hurdles400' ? [{ name: 'JUMP', value: 40, min: 50 }] : []));
  const boxes = Home.eventBoxes(view.layout);
  assert.deepStrictEqual(home.events.click(...centre(boxes.card(0))), { type: 'changed' });
  assert.strictEqual(home.events.click(...centre(boxes.card(1))), null); // the window is on top
  assert.deepStrictEqual(home.events.click(...centre(boxes.locked.close)), { type: 'changed' });
  assert.deepStrictEqual(home.events.click(...centre(boxes.card(1))), { type: 'event', id: 'longJump' });
  home.events.click(...centre(boxes.card(0)));
  assert.deepStrictEqual(home.events.click(...centre(boxes.locked.train)), { type: 'screen', id: 'training' });
  home.events.key({ key: 'ArrowLeft' });
  home.events.key({ key: 'ArrowRight' });
});

test('the locked window fits on screen', () => {
  for (const device of Object.values(DEVICES)) {
    const { view } = make(device);
    const { panel } = Home.eventBoxes(view.layout).locked;
    assert.ok(panel.x >= 0 && panel.x + panel.w <= view.layout.w && panel.y >= 0);
  }
});

test('a tired athlete is shown what to train', () => {
  const { view } = make();
  const home = Home.createHome(view, null, undefined,
    (id) => (id === 'fencing' ? [{ name: 'REFLEXES', value: 40, min: 50 }] : []));
  home.events.explain('fencing');
  assert.deepStrictEqual(home.events.key({ key: 'Enter' }), { type: 'screen', id: 'training' });
});
