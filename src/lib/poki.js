// The Poki SDK, loaded by index.html from Poki's CDN (absent offline or when an ad blocker stops it): the loading and gameplay
// events, and an ad break before each new run (Poki's rule: between runs, never during play). Every call is guarded and never throws, and gameplayStart/Stop never fire twice in a row (Poki's rule).
let playing = false;
const sdk = () => window.PokiSDK;

export function init() {
  try {
    if (!sdk()) return Promise.resolve();
    // the docs say to start the game on either branch; the timeout keeps a stuck init from holding the game back
    return Promise.race([sdk().init().catch(() => {}), new Promise((done) => setTimeout(done, 3000))]);
  } catch {
    return Promise.resolve();
  }
}
export function loadingFinished() {
  try {
    sdk()?.gameLoadingFinished();
  } catch {}
}
// on the player's first input of a run (not on load)
export function gameplayStart() {
  if (playing) return;
  playing = true;
  try {
    sdk()?.gameplayStart();
  } catch {}
}
// an ad break, before a new run: resolves when it is over (at once without the SDK, and in a ?playtest: in a background tab the
// SDK's break never ended and "play again" seemed dead to the testers); `onStart` runs if an ad really starts
const PLAYTEST = new URLSearchParams(location.search).has('playtest');
export function commercialBreak(onStart = () => {}) {
  try {
    if (!sdk() || PLAYTEST) return Promise.resolve();
    return Promise.race([sdk().commercialBreak(onStart).catch(() => {}), new Promise((done) => setTimeout(done, 20000))]);
  } catch {
    return Promise.resolve();
  }
}
// the run is over (or any other break in play)
export function gameplayStop() {
  if (!playing) return;
  playing = false;
  try {
    sdk()?.gameplayStop();
  } catch {}
}
