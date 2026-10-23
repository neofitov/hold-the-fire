// Hold the Fire: the loop and pointer input. #watch starts in watch mode (the bot plays); ?variant=b plays variant B locally.
// ?playtest: the game's clock moves only while a simulated tester acts (HTF.run), so the game never runs on while the tester
// looks at a screenshot, and a hidden or background tab (where the browser stops drawing) changes nothing: several testers can
// play at once in their own tabs.
import { createStage } from './lib/stage.js';
import { loadMedia } from './lib/media.js';
import * as synth from './lib/synth.js';
import { pickLanguage } from './lib/i18n.js';
import { VARIANT } from './variant.js';
import { gameScene } from './game.js';

const stage = createStage(document.getElementById('game'));
let scene = null;

const canvas = stage.canvas;
canvas.addEventListener('pointerdown', (e) => {
  try {
    canvas.setPointerCapture(e.pointerId);   // keeps the thumbstick when the finger leaves the canvas
  } catch {}
  scene?.pointerDown(stage.toVirtual(e));
});
canvas.addEventListener('pointermove', (e) => scene?.pointerMove(stage.toVirtual(e)));
canvas.addEventListener('pointerup', (e) => scene?.pointerUp(stage.toVirtual(e)));
canvas.addEventListener('pointercancel', () => scene?.pointerUp());   // a cancelled press is never a tap
// a finger held still on the thumbstick is a long press to a phone's browser: no text selection, magnifier or menu from it
// (Oleg's phone test: Chrome showed a magnifier); the pointer events above still come
canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
window.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('selectstart', (e) => e.preventDefault());
// arrows, space and the wheel must not scroll the page around the game (Poki's page integration)
window.addEventListener('keydown', (ev) => {
  if (['ArrowDown', 'ArrowUp', ' '].includes(ev.key)) ev.preventDefault();
});
window.addEventListener('wheel', (ev) => ev.preventDefault(), { passive: false });

const playtest = new URLSearchParams(location.search).has('playtest');
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!playtest && document.visibilityState === 'visible') scene.update(dt);
  scene.draw();
  requestAnimationFrame(frame);
}

// run the game `ms` milliseconds of game time, now, whatever the browser is drawing (the playtest clock; at most 10 s a call)
function run(ms) {
  const n = Math.round(Math.min(ms, 10000) / (1000 / 60));
  for (let i = 0; i < n; i++) {
    scene.update(1 / 60);
    if (i % 3 === 2) scene.draw();
  }
  scene.draw();
  return n / 60;
}

window.HTF = { scene: () => scene, stage, run };   // a handle for automated checks and playtests in the browser

const variant = (new URLSearchParams(location.search).get('variant') || VARIANT).toUpperCase();
// the music and cues rest while the tab is hidden
document.addEventListener('visibilitychange', () => synth.pause(document.visibilityState !== 'visible'));
// ... and iOS, which suspends the audio when the app is left or a call comes in, lets it resume only within a touch or a click
for (const type of ['touchend', 'pointerup', 'keydown']) document.addEventListener(type, () => synth.wake(), { passive: true });

loadMedia().then(() => {
  pickLanguage();
  scene = gameScene(stage, { watch: location.hash === '#watch', relight: variant === 'B' });
  requestAnimationFrame(frame);
});
