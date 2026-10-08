(function (root) {
  'use strict';

  // All sounds are synthesized with the Web Audio API, so nothing is downloaded.
  const MUTE_KEY = 'battleship-muted-v1';
  let ctx = null;
  let muted = false;
  try { muted = window.localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { muted = false; }
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch (e) {}

  function context() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended' || ctx.state === 'interrupted') ctx.resume().catch(() => {});
    return ctx;
  }

  function noiseBuffer(ac, seconds) {
    const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function envelope(ac, gainValue, attack, decay, start) {
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
    gain.connect(ac.destination);
    return gain;
  }

  function noise(ac, { duration, gain, type, from, to, q = 1, delay = 0 }) {
    const start = ac.currentTime + delay;
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac, duration);
    const filter = ac.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to, start + duration);
    src.connect(filter);
    filter.connect(envelope(ac, gain, 0.005, duration, start));
    src.start(start);
    src.stop(start + duration + 0.05);
  }

  function tone(ac, { duration, gain, type = 'sine', from, to = from, delay = 0 }) {
    const start = ac.currentTime + delay;
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(to, start + duration);
    osc.connect(envelope(ac, gain, 0.01, duration, start));
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  const SOUNDS = {
    fire(ac) {
      tone(ac, { duration: 0.25, gain: 0.5, from: 120, to: 40 });
      noise(ac, { duration: 0.2, gain: 0.25, type: 'lowpass', from: 2000, to: 200 });
    },
    miss(ac) {
      // Cannonball into water: deep plunk, rising bubble "bloop", splash, then droplets.
      tone(ac, { duration: 0.18, gain: 0.45, from: 170, to: 55 });
      tone(ac, { duration: 0.09, gain: 0.25, from: 280, to: 950, delay: 0.02 });
      noise(ac, { duration: 0.55, gain: 0.32, type: 'bandpass', from: 2600, to: 700, q: 0.6, delay: 0.03 });
      [0.22, 0.31, 0.38, 0.47].forEach((delay, i) => {
        tone(ac, { duration: 0.05, gain: 0.07, from: 900 + i * 250, to: 1800 + i * 300, delay });
      });
    },
    hit(ac) {
      noise(ac, { duration: 0.7, gain: 0.6, type: 'lowpass', from: 1800, to: 80 });
      tone(ac, { duration: 0.4, gain: 0.5, from: 90, to: 35 });
    },
    sunk(ac) {
      SOUNDS.hit(ac);
      tone(ac, { duration: 1.2, gain: 0.18, type: 'sawtooth', from: 320, to: 60, delay: 0.25 });
      noise(ac, { duration: 1.0, gain: 0.25, type: 'bandpass', from: 600, to: 150, delay: 0.4 });
    },
    victory(ac) {
      [523, 659, 784, 1047].forEach((f, i) => tone(ac, { duration: 0.35, gain: 0.2, type: 'triangle', from: f, delay: i * 0.15 }));
    },
    defeat(ac) {
      [392, 330, 262, 196].forEach((f, i) => tone(ac, { duration: 0.45, gain: 0.2, type: 'triangle', from: f, delay: i * 0.22 }));
    },
  };

  function play(name) {
    if (muted || !SOUNDS[name]) return;
    try {
      const ac = context();
      if (ac) SOUNDS[name](ac);
    } catch (e) {
      // Audio is optional; ignore failures.
    }
  }

  function setMuted(value) {
    muted = Boolean(value);
    try { window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  function unlock() {
    if (muted) return;
    try {
      const ac = context();
      if (ac && ac.state !== 'running') {
        const buffer = ac.createBuffer(1, 1, 22050);
        const source = ac.createBufferSource();
        source.buffer = buffer;
        source.connect(ac.destination);
        source.start(0);
        ac.resume().catch(() => {});
      }
    } catch (e) {}
  }

  root.BattleshipSound = { play, setMuted, unlock, isMuted: () => muted };
})(window);
