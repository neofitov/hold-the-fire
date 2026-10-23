// Music and stingers made in the browser (Web Audio; no files, nothing downloaded): a chiptune day theme and a tenser night theme
// (Oleg: a retro MIDI game tune), and short cues for nightfall, the night itself, dawn, a perfect night, the victory, the fire
// going out, the fire relit and a wall broken (Oleg: cool sound on surviving the night and on nightfall). Sound starts on the
// first input (browser rules); every call is safe without audio.
let ac = null, master, musicBus, sfxBus, noiseBuf, muted = false;

function audio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ac = new AC();
    } catch {
      return null;
    }
    master = ac.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ac.destination);
    // the music is quiet and its square waves softened; cues sit above it
    const soft = ac.createBiquadFilter();
    soft.type = 'lowpass';
    soft.frequency.value = 3200;
    soft.connect(master);
    musicBus = ac.createGain();
    musicBus.gain.value = 0.1;
    musicBus.connect(soft);
    sfxBus = ac.createGain();
    sfxBus.gain.value = 0.3;
    sfxBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    for (const [n, url] of Object.entries(urls)) decode(n, url);
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

export const start = () => audio();

// the sound files (media.js) through the same audio: each decoded once, then a cheap buffer source per play (a new <audio>
// element for every hit weighed on a phone in a giant's fight and after it: Oleg's phone test)
const urls = {}, samples = {};   // name: url; name: AudioBuffer, null while it loads, false if it cannot be decoded
function decode(name, url) {
  samples[name] = null;
  fetch(url).then((r) => r.arrayBuffer()).then((b) => new Promise((ok, no) => ac.decodeAudioData(b, ok, no)))
    .then((buf) => { samples[name] = buf; }, () => { samples[name] = false; });
}
export function register(name, url) {
  urls[name] = url;
  if (ac) decode(name, url);
}
// play a registered sound; false when this browser has no Web Audio for it (the caller falls back to an <audio> element)
export function sample(name, vol) {
  if (!ac || samples[name] === false || !(name in samples)) return false;
  const buf = samples[name];
  if (!buf || ac.state !== 'running') return true;   // still loading, or the audio is paused: this one is skipped
  const s = ac.createBufferSource(), g = ac.createGain();
  s.buffer = buf;
  g.gain.value = vol;
  s.connect(g).connect(master);
  s.start();
  return true;
}
export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 1;
}
export function pause(paused) {
  if (!ac) return;
  if (paused) ac.suspend().catch(() => {});
  else ac.resume().catch(() => {});
}

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// one note: an oscillator through an envelope
function tone(type, freq, t, dur, vol, bus, { to = null, attack = 0.005, release = 0.08, detune = 0, vibrato = 0 } = {}) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  o.detune.value = detune;
  if (vibrato) {
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = 6;
    lg.gain.value = vibrato;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur + release);
  }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
  g.gain.linearRampToValueAtTime(0, t + dur + release);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + release + 0.02);
}

// a burst of noise through a filter: hats, snares, crashes, whooshes
function noise(t, dur, vol, bus, { freq = 6000, type = 'highpass', to = null } = {}) {
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf;
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(bus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

const kick = (t, bus, vol = 0.9) => tone('sine', 150, t, 0.14, vol, bus, { to: 45, release: 0.05 });

// ---- the music: 32 eighth notes a loop, a lead, a bass and drums ('k' kick, 's' snare, 'h' hat)
const _ = null;
const THEMES = {
  // day: C major, an easy walk (C, Dm, Am, G)
  day: {
    bpm: 112,
    lead: [72, _, 76, 79, _, 76, 74, 72, 74, _, 77, 81, _, 79, 77, 76, 72, _, 76, 79, 84, _, 83, 79, 81, 79, 77, 76, 74, _, 72, _],
    bass: [48, _, 55, _, 48, _, 55, _, 50, _, 57, _, 50, _, 57, _, 45, _, 52, _, 45, _, 52, _, 43, _, 50, _, 43, _, 47, _],
    drums: 'k.h.k.h.k.h.k.h.k.h.k.h.k.h.k.h.k.h.k.h.k.h.k.h.k.h.k.hh',
    leadWave: 'square', bassWave: 'triangle',
  },
  // night: A minor, driving (Am, F, G, E)
  night: {
    bpm: 138,
    lead: [69, _, _, 72, _, _, 71, _, 65, _, _, 69, _, _, 67, _, 67, _, _, 71, _, _, 74, _, 76, _, 75, _, 71, _, 68, _],
    bass: [45, 45, 57, 45, 45, 57, 45, 57, 41, 41, 53, 41, 41, 53, 41, 53, 43, 43, 55, 43, 43, 55, 43, 55, 40, 40, 52, 40, 40, 52, 44, 52],
    drums: 'k.s.kks.k.s.kks.k.s.kks.k.s.kss.',
    leadWave: 'square', bassWave: 'square',
  },
};
let theme = null, stepN = 0, nextT = 0, timer = null;

export function music(name) {
  if (!audio()) return;
  theme = THEMES[name] || null;
  if (theme && !timer) {
    nextT = ac.currentTime + 0.06;
    stepN = 0;
    timer = setInterval(schedule, 25);
  }
}
function schedule() {
  if (!theme || !ac) return;
  const sd = 60 / theme.bpm / 2;
  while (nextT < ac.currentTime + 0.15) {
    const i = stepN % 32, l = theme.lead[i], b = theme.bass[i], d = theme.drums[i];
    if (l) tone(theme.leadWave, hz(l), nextT, sd * 0.85, 0.3, musicBus, { detune: 4 });
    if (b) tone(theme.bassWave, hz(b), nextT, sd * 0.9, theme.bassWave === 'square' ? 0.22 : 0.5, musicBus);
    if (d === 'k') kick(nextT, musicBus, 0.8);
    if (d === 's') noise(nextT, 0.12, 0.5, musicBus, { freq: 1800, type: 'bandpass' });
    if (d === 'h') noise(nextT, 0.04, 0.25, musicBus, { freq: 7000 });
    nextT += sd;
    stepN++;
  }
}

// ---- the cues
export function cue(name) {
  if (!audio()) return;
  const t = ac.currentTime + 0.02, b = sfxBus;
  switch (name) {
    case 'dusk': {   // a war horn: two low saws a little apart, and a fifth, opening up
      for (const [f, d] of [[110, 0], [110.7, 0], [165, 3]]) {
        const o = ac.createOscillator(), f1 = ac.createBiquadFilter(), g = ac.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(f * 0.97, t);
        o.frequency.linearRampToValueAtTime(f, t + 0.25);
        o.detune.value = d;
        f1.type = 'lowpass';
        f1.frequency.setValueAtTime(300, t);
        f1.frequency.linearRampToValueAtTime(1400, t + 0.5);
        f1.frequency.linearRampToValueAtTime(500, t + 1.8);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(f === 165 ? 0.18 : 0.32, t + 0.3);
        g.gain.linearRampToValueAtTime(0, t + 1.9);
        o.connect(f1).connect(g).connect(b);
        o.start(t);
        o.stop(t + 2);
      }
      break;
    }
    case 'spin':   // the spin: a whoosh that sweeps up and back down, a thin whistle riding it
      noise(t, 0.3, 0.6, b, { freq: 420, type: 'bandpass', to: 3400 });
      noise(t + 0.14, 0.24, 0.4, b, { freq: 3000, type: 'bandpass', to: 600 });
      tone('triangle', 330, t, 0.26, 0.07, b, { to: 990, release: 0.06 });
      break;
    case 'spinHit':   // it lands: a heavy thump and a crunch
      kick(t, b, 1);
      tone('sine', 90, t, 0.22, 0.5, b, { to: 40, release: 0.08 });
      noise(t, 0.14, 0.35, b, { freq: 1400, type: 'lowpass', to: 300 });
      break;
    case 'brute':   // a deeper, longer horn under the dusk one
      tone('sawtooth', 55, t + 0.2, 1.6, 0.35, b, { attack: 0.3, release: 0.4 });
      tone('sawtooth', 82.4, t + 0.2, 1.6, 0.2, b, { attack: 0.3, release: 0.4 });
      break;
    case 'night':   // war drums
      for (let k = 0; k < 4; k++) {
        kick(t + k * 0.22, b, k === 3 ? 1 : 0.8);
        noise(t + k * 0.22, 0.12, 0.25, b, { freq: 900, type: 'lowpass' });
      }
      break;
    case 'dawn': {  // a fanfare: up the chord, then hold it
      [72, 76, 79, 84].forEach((n, k) => tone('square', hz(n), t + k * 0.09, 0.11, 0.22, b));
      for (const n of [72, 76, 79, 84]) tone('square', hz(n), t + 0.4, 0.7, 0.12, b, { vibrato: 4, release: 0.3 });
      tone('triangle', hz(48), t + 0.4, 0.7, 0.4, b, { release: 0.3 });
      noise(t + 0.4, 0.5, 0.15, b, { freq: 5000 });
      break;
    }
    case 'perfect':  // a sparkle
      [88, 91, 95, 100].forEach((n, k) => tone('sine', hz(n), t + 0.9 + k * 0.07, 0.25, 0.15, b, { release: 0.25 }));
      break;
    case 'victory': {
      const line = [72, 72, 72, 76, 79, 79, 76, 79, 84];
      line.forEach((n, k) => tone('square', hz(n), t + k * 0.13, 0.12, 0.22, b));
      for (const n of [72, 76, 79, 84, 88]) tone('square', hz(n), t + 1.2, 1.4, 0.1, b, { vibrato: 5, release: 0.5 });
      tone('triangle', hz(36), t + 1.2, 1.4, 0.5, b, { release: 0.5 });
      for (let k = 0; k < 10; k++) noise(t + k * 0.06, 0.05, 0.2, b, { freq: 1500, type: 'bandpass' });   // a drum roll
      noise(t + 1.2, 1.4, 0.3, b, { freq: 6000 });   // a cymbal
      break;
    }
    case 'out':      // the fire dies: a falling tone, then a minor chord fading
      tone('square', 440, t, 1.1, 0.18, b, { to: 110, release: 0.2 });
      for (const n of [57, 60, 64]) tone('triangle', hz(n), t + 1.1, 1.6, 0.25, b, { release: 0.8 });
      noise(t, 1.5, 0.12, b, { freq: 800, type: 'lowpass', to: 200 });
      break;
    case 'relit':
      noise(t, 0.6, 0.3, b, { freq: 300, type: 'bandpass', to: 3000 });
      [64, 67, 71, 76].forEach((n, k) => tone('square', hz(n), t + 0.3 + k * 0.08, 0.12, 0.18, b));
      break;
    case 'alarm':    // the fire runs low: three urgent beeps
      for (let k = 0; k < 3; k++) tone('square', 880, t + k * 0.18, 0.09, 0.2, b, { release: 0.03 });
      break;
    case 'crash':    // a wall broken
      noise(t, 0.35, 0.5, b, { freq: 1200, type: 'lowpass', to: 200 });
      kick(t, b, 0.7);
      break;
  }
}
