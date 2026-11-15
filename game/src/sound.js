// Tiny synthesized sound: every effect is an oscillator or a burst of noise
// through the Web Audio API, so the game ships no audio files. Everything is
// guarded — a browser without audio, or one that has not had a gesture yet,
// simply stays quiet instead of breaking the game.
export function createSound() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx !== null) return ctx;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, slideTo) {
    const ac = ensure();
    if (ac === null || master === null || muted) return;
    try {
      if (ac.state === 'suspended') void ac.resume();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ac.currentTime + dur);
      gain.gain.setValueAtTime(0.9, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ac.currentTime + dur);
    } catch {
      // Sound is garnish: never let it stop the game.
    }
  }

  function noise(dur) {
    const ac = ensure();
    if (ac === null || master === null || muted) return;
    try {
      if (ac.state === 'suspended') void ac.resume();
      const len = Math.max(1, Math.floor(ac.sampleRate * dur));
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const gain = ac.createGain();
      gain.gain.value = 0.7;
      src.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // Sound is garnish: never let it stop the game.
    }
  }

  return {
    unlock() {
      ensure();
    },
    shoot() {
      tone(880, 0.07, 'square', 440);
    },
    boom() {
      noise(0.25);
      tone(160, 0.22, 'sawtooth', 50);
    },
    hit() {
      tone(220, 0.18, 'sawtooth', 90);
      noise(0.12);
    },
    bomb() {
      noise(0.5);
      tone(90, 0.5, 'sine', 40);
    },
    wave() {
      tone(523, 0.12, 'triangle');
      setTimeout(() => tone(784, 0.16, 'triangle'), 110);
    },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle'), i * 130));
    },
    lose() {
      [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth'), i * 160));
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
  };
}
