// Sprites and sounds: Kenney's CC0 Survival Kit previews and RPG/Impact audio (assets/LICENSES.md). Sound starts only after the
// first tap (browser autoplay rules), never throws, and each sound is held to one play per short interval (hordes are loud)
import * as synth from './synth.js';
const SPRITES = ['tree', 'tree-tall', 'tree-autumn', 'rock-a', 'rock-b', 'rock-c', 'campfire', 'chest', 'tent', 'tent-canvas', 'wood', 'stone', 'axe', 'bedroll', 'barrel', 'workbench'];
const SOUNDS = ['chop', 'mine', 'coin', 'build', 'hit', 'die', 'night', 'dawn', 'lose', 'arrow'];
export const img = {};
const snd = {}, lastPlayed = {};
// the fallback <audio> element only where it can play .ogg at all (else every hit made a dead element: an iPhone in a fight)
const OGG = (() => {
  try {
    return !!new Audio().canPlayType('audio/ogg; codecs="vorbis"');
  } catch {
    return false;
  }
})();
let muted = false;
try {
  // a simulated playtest is silent (Oleg: several testers' tabs at once made a din); else as the player left it
  muted = new URLSearchParams(location.search).has('playtest') || localStorage.getItem('htf.muted') === '1';
} catch {}

export function loadMedia() {
  for (const n of SOUNDS) {
    try {
      synth.register(n, `assets/sfx/${n}.ogg`);   // played through Web Audio once the sound has started
      snd[n] = new Audio(`assets/sfx/${n}.ogg`);   // the fallback
      snd[n].preload = 'auto';
    } catch {}
  }
  return Promise.all(
    SPRITES.map((n) => new Promise((done) => {
      const i = new Image();
      i.onload = i.onerror = () => done();
      i.src = `assets/sprites/${n}.png`;
      img[n] = i;
    })),
  );
}

export function sprite(ctx, name, x, y, size, alpha = 1) {
  const i = img[name];
  if (!i || !i.complete || !i.naturalWidth) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(i, x - size / 2, y - size / 2, size, size);
  ctx.globalAlpha = 1;
}

export function play(name, volume = 0.5, gap = 0.07) {
  if (muted || !snd[name]) return;
  const now = performance.now() / 1000;
  if (now - (lastPlayed[name] || 0) < gap) return;
  lastPlayed[name] = now;
  if (synth.sample(name, volume) || !OGG) return;
  try {
    const a = snd[name].cloneNode();
    a.volume = volume;
    a.play().catch(() => {});
  } catch {}
}
export const isMuted = () => muted;
// the game's speed, 1x, 1.5x or 2x (Oleg: the game felt too fast, days and nights too short); 1x runs the world at two thirds
// of the pace it had before, 1.5x at that pace, 2x faster. Kept between visits
export const SPEEDS = [1, 1.5, 2];
let speed = 1;
try {
  speed = SPEEDS.includes(+localStorage.getItem('htf.speed')) ? +localStorage.getItem('htf.speed') : 1;
} catch {}
export const getSpeed = () => speed;
// the mode, easy, normal or hard (Oleg, 2026-10-23; normal by default); ?mode=easy|normal|hard picks it for a test and is
// remembered too
const MODES = ['easy', 'normal', 'hard'];
let mode = 'normal';
try {
  const asked = new URLSearchParams(location.search).get('mode'), kept = localStorage.getItem('htf.mode');
  mode = MODES.includes(asked) ? asked : MODES.includes(kept) ? kept : 'normal';
  if (asked) localStorage.setItem('htf.mode', mode);
} catch {}
export const getMode = () => mode;
export function setMode(m) {
  mode = m;
  try {
    localStorage.setItem('htf.mode', m);
  } catch {}
}
export const timeScale = () => (speed * 2) / 3;
export function cycleSpeed() {
  speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
  try {
    localStorage.setItem('htf.speed', String(speed));
  } catch {}
  return speed;
}

export function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem('htf.muted', muted ? '1' : '0');
  } catch {}
}

// a playtest keeps its stats to its own tab (testers playing at once in tabs of one browser would share a best score)
const store = () => (new URLSearchParams(location.search).has('playtest') ? sessionStorage : localStorage);
export function stats() {
  try {
    return JSON.parse(store().getItem('htf.stats')) || {};
  } catch {
    return {};
  }
}
export function bump(key, by = 1, mode = 'add') {
  const s = stats();
  s[key] = mode === 'max' ? Math.max(s[key] || 0, by) : (s[key] || 0) + by;
  try {
    store().setItem('htf.stats', JSON.stringify(s));
  } catch {}
}
