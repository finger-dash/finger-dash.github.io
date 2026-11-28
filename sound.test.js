'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Synth = require('./synth.js');
const { createAudio, VOICE_DELAY, AFTER_VOICE, MUSIC_LEAD } = require('./audio.js');

const seconds = ({ rate, samples }) => samples.length / rate;

test('every sound is audible, in range and in 8 bits', () => {
  for (const name of ['voice', 'cheer', 'boo', 'music']) {
    const { samples } = Synth.render(name);
    let peak = 0, energy = 0;
    for (const v of samples) {
      assert.ok(Math.abs(v) <= 128 / 127 + 1e-6);
      assert.ok(Math.abs(v * 127 - Math.round(v * 127)) < 1e-4, `${name} ${v}`);
      peak = Math.max(peak, Math.abs(v));
      energy += v * v;
    }
    assert.ok(peak > 0.7 && Math.sqrt(energy / samples.length) > 0.05, name);
  }
});

test('the recordings have their length and the music loops over whole bars', () => {
  assert.ok(seconds(Synth.render('voice')) > AFTER_VOICE);
  assert.strictEqual(Math.round(seconds(Synth.render('cheer'))), 4);
  assert.strictEqual(Math.round(seconds(Synth.render('boo'))), 4);
  const loop = seconds(Synth.render('music'));
  assert.ok(Math.abs(loop - (Synth.MELODY.length * 4 * 60) / Synth.BPM) < 0.01, String(loop));
});

test('every bar of the tune lasts four beats and has a chord', () => {
  assert.strictEqual(Synth.CHORDS.length, Synth.MELODY.length);
  for (const bar of Synth.MELODY) {
    assert.strictEqual(bar.split(' ').reduce((n, part) => n + Number(part.split(':')[1]), 0), 16, bar);
  }
  assert.ok(Math.abs(Synth.frequency('A4') - 440) < 1e-9);
});

// A stand-in for the browser that writes down what is played.
function fakeBrowser() {
  const played = [], listeners = {};
  const param = () => ({
    value: 0, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {},
  });
  const clock = { now: 0 };
  class AudioContext {
    constructor() { this.state = 'suspended'; this.destination = {}; }
    get currentTime() { return clock.now; }
    resume() { this.state = 'running'; }
    suspend() { this.state = 'suspended'; }
    createBuffer(_, length, rate) {
      const data = new Float32Array(length);
      return { duration: length / rate, getChannelData: () => data };
    }
    createGain() { return { gain: param(), connect: (to) => to }; }
    createBufferSource() {
      const source = {
        connect: (to) => to,
        start(at) { source.at = at; played.push(source); },
        stop() { source.stopped = true; },
      };
      return source;
    }
  }
  const target = { AudioContext, addEventListener: (type, fn) => { listeners[type] = fn; } };
  const LENGTH = { music: 30, voice: 4, cheer: 5, boo: 6 };
  const render = (name) => ({ rate: 100, samples: new Float32Array(LENGTH[name] * 100) });
  const sound = createAudio({ Synth: { render }, target });
  const names = (list = played) => list.map((s) =>
    Object.keys(LENGTH).find((n) => LENGTH[n] === s.buffer.duration));
  return { played, listeners, sound, clock, names };
}

test('the first gesture plays the music, then the announcer, then the crowd, only once', () => {
  const { played, listeners, sound, names } = fakeBrowser();
  sound.react('win'); // nothing before a gesture
  assert.strictEqual(played.length, 0);
  listeners.pointerup();
  listeners.keydown();
  assert.deepStrictEqual(names(), ['cheer', 'voice', 'music']);
  const [cheer, voice, music] = played;
  // The music from the very beginning, the announcer a while later.
  assert.ok(VOICE_DELAY >= 1 && voice.at - music.at >= VOICE_DELAY);
  assert.ok(Math.abs(cheer.at - voice.at - AFTER_VOICE - MUSIC_LEAD) < 1e-9);
  assert.ok(music.loop && !voice.loop && !cheer.loop);
});

test('the music plays in the menus and not in the competitions', () => {
  const { played, listeners, sound, clock, names } = fakeBrowser();
  listeners.keydown();
  clock.now = 20;
  sound.menu(true); // no change
  sound.menu(false);
  assert.ok(played.every((s) => s.stopped), 'music and intro stop');
  assert.strictEqual(played.length, 3);
  sound.menu(false);
  sound.menu(true);
  assert.deepStrictEqual(names(played.slice(3)), ['music']);
  assert.ok(played[3].at === 20 && !played[3].stopped);
});

test('going back to the menu before the name ends does not talk over it', () => {
  const { played, listeners, sound } = fakeBrowser();
  sound.menu(false); // a competition before any gesture: no music with the intro
  listeners.keydown();
  assert.strictEqual(played.length, 2);
});

test('the crowd cheers a win, boos a loss and hushes when the table goes', () => {
  const { played, listeners, sound, names } = fakeBrowser();
  listeners.keydown();
  sound.menu(false);
  sound.react('win');
  sound.react(null);
  sound.react('loss');
  assert.deepStrictEqual(names(played.slice(3)), ['cheer', 'boo']);
  assert.ok(played[3].stopped && !played[4].stopped);
});
