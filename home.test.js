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
  Home.EVENTS.forEach((event, i) => {
    assert.deepStrictEqual(home.events.click(...centre(card(i))), { type: 'event', id: event.id });
  });
});

test('keyboard moves over the events and wraps around', () => {
  const { home } = make();
  home.events.key({ key: 'ArrowLeft' }); // wraps to the last one
  assert.deepStrictEqual(home.events.key({ key: 'Enter' }), { type: 'event', id: 'weightlifting' });
  home.events.key({ key: 'ArrowRight' });
  assert.deepStrictEqual(home.events.key({ key: 'Enter' }), { type: 'event', id: 'hurdles400' });
  home.events.key({ key: 'ArrowRight' });
  assert.deepStrictEqual(home.events.key({ key: 'Enter' }), { type: 'event', id: 'longJump' });
  assert.deepStrictEqual(home.events.key({ key: 'Escape' }), { type: 'back' });
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
    const boxes = [...Home.titleBoxes(view.layout).modes, events.back,
      ...Home.EVENTS.map((_, i) => events.card(i))];
    for (const b of boxes) {
      assert.ok(b.x >= 0 && b.x + b.w <= w, `${name}: horizontal overflow`);
      assert.ok(b.y >= 0 && b.y + b.h <= h - bottom, `${name}: vertical overflow`);
    }
    const card = events.card(0);
    assert.ok(card.w >= 90 && card.h >= 61, `${name}: card too small (${card.w}x${card.h})`);
  }
});
