// The web portal's SDK, whichever one the page loaded: index.html loads Poki's; the CrazyGames build (tools/build.mjs) swaps in
// CrazyGames' v3 SDK; neither is there offline or when an ad blocker stops it. What the game tells them: loading done, gameplay
// starting and stopping, an ad break before each new run (both portals' rule: between runs, never during play), and a
// celebration at the win (CrazyGames' happytime). Every call is guarded and never throws, and gameplayStart/Stop never fire
// twice in a row (Poki's rule).
let playing = false;
const poki = () => window.PokiSDK;
const crazy = () => window.CrazyGames?.SDK;
const PLAYTEST = new URLSearchParams(location.search).has('playtest');
const timeout = (ms) => new Promise((done) => setTimeout(done, ms));

export function init() {
  try {
    // CrazyGames wants loadingStart once its SDK is ready, and loadingStop when the game can be played
    const ready = poki() ? poki().init() : crazy() ? crazy().init().then(() => crazy().game.loadingStart()) : null;
    if (!ready) return Promise.resolve();
    // the docs say to start the game on either branch; the timeout keeps a stuck init from holding the game back
    return Promise.race([ready.catch(() => {}), timeout(3000)]);
  } catch {
    return Promise.resolve();
  }
}
export function loadingFinished() {
  try {
    poki()?.gameLoadingFinished();
    crazy()?.game.loadingStop();
  } catch {}
}
// on the player's first input of a run (not on load)
export function gameplayStart() {
  if (playing) return;
  playing = true;
  try {
    poki()?.gameplayStart();
    crazy()?.game.gameplayStart();
  } catch {}
}
// the run is over (or any other break in play)
export function gameplayStop() {
  if (!playing) return;
  playing = false;
  try {
    poki()?.gameplayStop();
    crazy()?.game.gameplayStop();
  } catch {}
}
// whether an ad break can happen here at all (else "play again" starts at once, not a moment later: round 9's second tap
// landed on the new game's cards); never in a ?playtest (in a background tab the SDK's break never ended)
export const canBreak = () => !!(poki() || crazy()) && !PLAYTEST;
// an ad break, before a new run: resolves when it is over (at once where none can play); `onStart` runs if an ad really starts
export function commercialBreak(onStart = () => {}) {
  try {
    if (!canBreak()) return Promise.resolve();
    const ad = poki()
      ? poki().commercialBreak(onStart)
      : new Promise((done) => crazy().ad.requestAd('midgame', { adStarted: onStart, adFinished: done, adError: done }));
    return Promise.race([ad.catch(() => {}), timeout(20000)]);
  } catch {
    return Promise.resolve();
  }
}
// the win: the portal's page celebrates too (CrazyGames: confetti; their docs ask to keep it for special moments)
export function happytime() {
  try {
    crazy()?.game.happytime();
  } catch {}
}
