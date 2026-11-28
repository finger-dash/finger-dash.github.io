// Sound playback. Browsers only allow sound after the first tap, click or key press, so
// everything starts there: the music of the menus, then the announcer and then the crowd.
(function (root) {
  'use strict';

  // The crowd recordings are the loudest (-8 LUFS, the music is at -13.5), so that a
  // cheer takes over.
  const VOICE = 0.85;
  const CROWD = 0.9;
  const MUSIC = 0.7;
  const MUSIC_UNDER = 0.25;   // while the announcer speaks, so the name can be heard
  const MUSIC_CROWD = 0.12;   // while the crowd of the intro cheers
  const VOICE_DELAY = 1;      // s of music before the announcer
  const AFTER_VOICE = 2.75;   // s from the start of the announcer to the end of the name
  const MUSIC_LEAD = 1.5;     // s from the end of the name to the crowd
  const FADE = 0.35;          // s to silence a sound

  function createAudio({ Synth = root.Synth, target = root } = {}) {
    const Context = target.AudioContext || target.webkitAudioContext;
    let context = null, started = false;
    let inMenu = true;
    let music = null, reaction = null, intro = [];
    let duck = []; // [time, volume] of the music while the intro plays
    const buffers = {};

    function buffer(name) {
      if (!buffers[name]) {
        const { rate, samples } = Synth.render(name);
        buffers[name] = context.createBuffer(1, samples.length, rate);
        buffers[name].getChannelData(0).set(samples);
      }
      return buffers[name];
    }

    function play(name, volume, at = context.currentTime, loop = false) {
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer(name);
      source.loop = loop;
      gain.gain.value = volume;
      source.connect(gain).connect(context.destination);
      source.start(at);
      return { source, gain, ends: at + source.buffer.duration };
    }

    function silence(sound) {
      if (!sound) return;
      const { source, gain } = sound, now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + FADE);
      source.stop(now + FADE);
    }

    // The volume of the music at a given moment: straight lines between the points of
    // the intro, and full volume out of it.
    function level(time) {
      const next = duck.findIndex(([at]) => at > time);
      if (next < 1) return MUSIC;
      const [from, a] = duck[next - 1], [to, b] = duck[next];
      return a + (b - a) * (time - from) / (to - from);
    }

    // The tune from its start. In the intro it makes room for the announcer and then
    // for the crowd.
    function startMusic() {
      const now = context.currentTime, up = now + 0.3;
      music = play('music', 0, now, true);
      const volume = music.gain.gain;
      volume.setValueAtTime(0, now);
      volume.linearRampToValueAtTime(level(up), up);
      for (const [at, value] of duck) {
        if (at > up) volume.linearRampToValueAtTime(value, at);
      }
    }

    function begin() {
      started = true;
      if (inMenu) buffer('music'); // made ahead, so that it does not delay the voice
      const start = context.currentTime + 0.1;
      const nameStarts = start + VOICE_DELAY;
      const nameEnds = nameStarts + AFTER_VOICE;
      const cheers = nameEnds + MUSIC_LEAD;
      const crowd = play('cheer', CROWD, cheers);
      const voice = play('voice', VOICE, nameStarts);
      duck = [
        [nameStarts - FADE, MUSIC], [nameStarts, MUSIC_UNDER],
        [nameEnds - FADE, MUSIC_UNDER], [nameEnds + 0.2, MUSIC],
        [cheers - FADE, MUSIC], [cheers, MUSIC_CROWD],
        [crowd.ends - 0.7, MUSIC_CROWD], [crowd.ends + 0.2, MUSIC],
      ];
      intro = [voice, crowd];
      if (inMenu) startMusic();
    }

    // Must run inside a user gesture.
    function unlock() {
      if (!Context) return;
      try {
        if (!context) context = new Context();
        if (context.state !== 'running') {
          const resumed = context.resume();
          if (resumed) resumed.catch(() => {});
        }
        if (!started) begin();
      } catch (_) {} // the game goes on without sound
    }

    // The music belongs to the menus: it stops, along with the intro, when a competition
    // starts, and plays again from the top back in the menus.
    function menu(shown) {
      if (shown === inMenu) return;
      inMenu = shown;
      if (!started) return;
      if (shown) {
        startMusic();
        return;
      }
      intro.forEach(silence);
      intro = [];
      duck = [];
      silence(music);
      music = null;
    }

    // The crowd's answer to the final table: 'win' cheers, anything else boos and
    // null silences it.
    function react(outcome) {
      if (!started) return;
      silence(reaction);
      reaction = outcome ? play(outcome === 'win' ? 'cheer' : 'boo', CROWD) : null;
    }

    // Silence while the page is in the background.
    function hide(hidden) {
      if (!context) return;
      const done = hidden ? context.suspend() : context.resume();
      if (done) done.catch(() => {});
    }

    // Phones count the end of a touch as a gesture; computers, the press.
    for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown']) {
      target.addEventListener(type, unlock, true);
    }
    if (target.document) {
      target.document.addEventListener('visibilitychange', () => hide(target.document.hidden));
    }

    return { unlock, menu, react, hide };
  }

  const api = { createAudio, VOICE_DELAY, AFTER_VOICE, MUSIC_LEAD };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Sound = api;
})(this);
