// Phone support: touch swipes, system keyboard for the name, landscape handling.
(function (root) {
  'use strict';

  const TOUCH_TEXT_SIZE = 18; // 16px or more stops iOS from zooming into the field

  function createMobile({ canvas, detector, Font }) {
    const coarse = window.matchMedia('(pointer: coarse)');
    const portrait = window.matchMedia('(orientation: portrait)');
    let touch = coarse.matches;
    let lastTouchAt = -Infinity;
    const fingers = new Map(); // pointerId -> last clientY

    const form = document.getElementById('name-form');
    const field = document.getElementById('name-input');
    field.maxLength = Font.NAME_MAX;
    field.style.fontSize = `${TOUCH_TEXT_SIZE}px`;
    let onName = null;

    // Every finger is its own swipe stream, so alternating fingers adds up.
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') { touch = false; return; }
      touch = true;
      lastTouchAt = performance.now();
      fingers.set(e.pointerId, e.clientY);
    });
    window.addEventListener('pointermove', (e) => {
      if (!fingers.has(e.pointerId)) return;
      lastTouchAt = performance.now();
      detector.touch(e.pointerId, e.clientY - fingers.get(e.pointerId), lastTouchAt);
      fingers.set(e.pointerId, e.clientY);
    });
    const lift = (e) => {
      if (!fingers.delete(e.pointerId)) return;
      lastTouchAt = performance.now();
      detector.release(e.pointerId);
    };
    window.addEventListener('pointerup', lift);
    window.addEventListener('pointercancel', lift);

    // No scrolling, zooming or emulated mouse events over the game.
    for (const type of ['touchstart', 'touchmove', 'touchend']) {
      canvas.addEventListener(type, (e) => e.preventDefault(), { passive: false });
    }
    document.addEventListener('contextmenu', (e) => { if (touch) e.preventDefault(); });

    // Must be called from a tap handler, otherwise phones keep the keyboard closed.
    function editName(value, callback) {
      onName = callback;
      field.value = value;
      form.hidden = false;
      field.focus();
    }
    function closeName() {
      if (form.hidden) return;
      form.hidden = true;
      field.blur();
      window.scrollTo(0, 0);
    }
    field.addEventListener('input', () => {
      const clean = Font.cleanName(field.value);
      if (field.value !== clean) field.value = clean;
      if (onName) onName(clean);
    });
    field.addEventListener('blur', closeName);
    form.addEventListener('submit', (e) => { e.preventDefault(); closeName(); });

    // Android can go full screen and lock landscape; iPhone Safari cannot.
    function enterFullscreen() {
      const page = document.documentElement;
      if (!touch || !page.requestFullscreen || document.fullscreenElement) return;
      page.requestFullscreen({ navigationUI: 'hide' })
        .then(() => window.screen.orientation.lock('landscape'))
        .catch(() => {});
    }

    return {
      editName,
      closeName,
      enterFullscreen,
      isEditing: () => !form.hidden,
      isTouch: () => touch,
      // True while the phone is held upright: the game waits.
      needsRotation: () => touch && portrait.matches && form.hidden,
      // Mouse events that follow a touch must not count as mouse input.
      fromTouch: () => performance.now() - lastTouchAt < 800,
    };
  }

  root.Mobile = { createMobile };
})(this);
