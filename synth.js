// The game's sounds as samples between -1 and 1: the menu music, made from scratch, and the
// recordings in sounds.js. No DOM or audio access.
(function (root) {
  'use strict';

  const Sounds = typeof require === 'function' ? require('./sounds.js') : root.Sounds;

  function decode(base64) {
    if (typeof atob === 'function') return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return Buffer.from(base64, 'base64');
  }

  function recording(name) {
    const { rate, data } = Sounds[name];
    return { rate, samples: Float32Array.from(decode(data), (v) => (v - 128) / 127) };
  }

  // ---------- Music ----------

  const RATE = 22050;
  const BPM = 156;
  const STEP = 60 / BPM / 4; // a sixteenth note, in seconds
  const TAU = Math.PI * 2;
  const NOTES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  // 'C4' -> Hz
  const frequency = (name) =>
    440 * 2 ** ((NOTES[name[0]] + 12 * (Number(name.slice(-1)) + 1) - 69) / 12);

  // An original tune: one string per bar, as note:sixteenths ('-' is a rest).
  const MELODY = [
    'E5:2 G5:2 C6:2 G5:1 E5:3 G5:2 A5:2 G5:2', 'F5:2 A5:2 C6:2 A5:1 F5:3 A5:2 B5:2 C6:2',
    'D6:3 B5:3 G5:2 A5:2 B5:2 D6:2 B5:2', 'C6:3 G5:3 E5:2 C5:4 -:2 G5:2',
    'A5:2 A5:1 A5:1 -:2 C6:2 B5:2 A5:2 G5:4', 'F5:2 F5:1 F5:1 -:2 A5:2 G5:2 F5:2 E5:4',
    'D5:2 E5:2 F5:2 G5:2 A5:2 B5:2 C6:2 D6:2', 'C6:4 G5:2 C6:2 -:2 G5:2 C6:4',
    'A5:3 C6:3 A5:2 F5:2 A5:2 C6:4', 'G5:3 C6:3 G5:2 E5:2 G5:2 C6:4',
    'F5:3 A5:3 D6:2 C6:2 A5:2 F5:4', 'G5:2 B5:2 D6:4 -:2 D6:2 B5:2 G5:2',
    'A5:2 -:1 A5:1 C6:2 A5:2 F5:2 A5:2 C6:4', 'E6:4 D6:2 C6:2 G5:4 E5:4',
    'F5:2 A5:2 G5:2 B5:2 A5:2 C6:2 B5:2 D6:2', 'C6:2 -:2 C6:2 -:2 C6:4 G5:1 A5:1 B5:2',
  ];
  const CHORDS = ['C', 'F', 'G', 'C', 'Am', 'F', 'G', 'C', 'F', 'C', 'Dm', 'G', 'F', 'C', 'G', 'C'];
  const TRIADS = {
    C: ['C', 'E', 'G'], F: ['F', 'A', 'C'], G: ['G', 'B', 'D'],
    Am: ['A', 'C', 'E'], Dm: ['D', 'F', 'A'],
  };

  const pulse = (duty, low) => (phase) => (phase < duty ? 1 : low);
  const WAVES = {
    thin: pulse(0.125, -0.14),
    lead: pulse(0.25, -0.33),
    square: pulse(0.5, -1),
    triangle: (phase) => Math.round((4 * Math.abs(phase - 0.5) - 1) * 7.5) / 7.5,
  };

  // Adds sample `i` of a sound starting at sixteenth `at`; the end wraps to the start, so
  // the loop has no seam.
  const add = (out, at, i, v) => { out[(Math.round(at * STEP * RATE) + i) % out.length] += v; };

  function tone(out, at, steps, name, wave, gain, { gate, decay = 0.35, vibrato = 0 }) {
    const seconds = steps * STEP * gate, pitch = frequency(name);
    const length = Math.floor(seconds * RATE);
    let phase = 0;
    for (let i = 0; i < length; i++) {
      const t = i / RATE;
      const depth = vibrato * Math.min(1, Math.max(0, (t - 0.12) / 0.15));
      phase = (phase + (pitch * (1 + depth * Math.sin(TAU * 5.5 * t))) / RATE) % 1;
      const edge = Math.max(0, Math.min(1, t / 0.004, (seconds - t) / 0.025));
      add(out, at, i, WAVES[wave](phase) * gain * edge * (1 - (decay * t) / seconds));
    }
  }

  const DRUMS = { kick: 0.12, snare: 0.11, hat: 0.03, open: 0.12 }; // seconds

  function drum(out, rng, at, kind, gain = 1) {
    const length = Math.floor(DRUMS[kind] * RATE);
    let phase = 0, noise = 0;
    for (let i = 0; i < length; i++) {
      const k = i / length;
      if (i % (kind === 'snare' ? 3 : 1) === 0) noise = rng() < 0.5 ? -1 : 1;
      let v;
      if (kind === 'kick') {
        phase += (140 - 95 * k) / RATE;
        v = (Math.round(Math.sin(TAU * phase) * 7) / 7) * 0.5;
      } else v = noise * (kind === 'snare' ? 0.2 : 0.07);
      add(out, at, i, v * (1 - k) ** 2 * gain);
    }
  }

  // Rounds to 8 bits at the given peak. `drive` presses the loud parts together, so that
  // the tune is as loud as the crowd.
  function crush(samples, peak = 0.9, drive = 2.5) {
    let max = 0;
    for (const v of samples) max = Math.max(max, Math.abs(v));
    const scale = max ? 1 / max : 0, limit = Math.tanh(drive);
    for (let i = 0; i < samples.length; i++) {
      const v = (Math.tanh(samples[i] * scale * drive) / limit) * peak;
      samples[i] = Math.round(v * 127) / 127;
    }
    return samples;
  }

  // One round of the menu tune, made to be looped.
  function music() {
    let seed = 5;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const out = new Float32Array(Math.round(MELODY.length * 16 * STEP * RATE));
    MELODY.forEach((bar, b) => {
      let at = b * 16;
      for (const part of bar.split(' ')) {
        const [name, length] = part.split(':');
        if (name !== '-') {
          tone(out, at, Number(length), name, 'lead', 0.19, { gate: 0.85, vibrato: 0.004 });
        }
        at += Number(length);
      }
      const [root1, third, fifth] = TRIADS[CHORDS[b]];
      const bass = [`${root1}2`, `${root1}3`, `${fifth}2`, `${root1}3`];
      for (let i = 0; i < 8; i++) {
        tone(out, b * 16 + i * 2, 2, bass[i % 4], 'triangle', 0.32, { gate: 0.75, decay: 0.1 });
      }
      for (let i = 0; i < 16; i++) {
        const here = b * 16 + i;
        tone(out, here, 1, `${[root1, third, fifth, third][i % 4]}5`, 'square', 0.03, { gate: 0.7 });
        if (i % 4 === 0 || i === 10) drum(out, rng, here, 'kick');
        if (i % 8 === 4 || (b % 4 === 3 && i >= 13)) drum(out, rng, here, 'snare');
        if (i % 2 === 0) drum(out, rng, here, i % 4 === 2 ? 'open' : 'hat', 0.8);
      }
    });
    return { rate: RATE, samples: crush(out) };
  }

  // The false start signal: two low, harsh beeps.
  function foul() {
    const beep = 0.16, gap = 0.08;
    const out = new Float32Array(Math.round((2 * beep + 2 * gap) * RATE));
    for (const from of [0, beep + gap]) {
      for (let i = 0; i < Math.round(beep * RATE); i++) {
        const t = i / RATE;
        const v = 0.6 * WAVES.square((220 * t) % 1) + 0.4 * WAVES.square((233 * t) % 1);
        out[Math.round(from * RATE) + i] = v * Math.max(0, Math.min(1, t / 0.005, (beep - t) / 0.01));
      }
    }
    return { rate: RATE, samples: crush(out, 0.8, 1) };
  }

  // 'music', 'foul', or a recording ('voice', 'cheer', 'boo', 'marks', 'set', 'go')
  // -> { rate, samples }
  const MADE = { music, foul };
  const render = (name) => (MADE[name] ? MADE[name]() : recording(name));

  const api = { RATE, BPM, MELODY, CHORDS, render, frequency };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Synth = api;
})(this);
