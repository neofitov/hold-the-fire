// Hold the Fire on screen: the fixed-step simulation, one-thumb input, the camera (zoomed so a wide window never shows past the
// map), the HUD, effects from the simulation's events, the pointer that shows what to do next, and the game-over card. No
// title screen and no English in play (the expert review: a safe, wordless first two minutes). Watch mode (#watch) lets the
// planning bot play.
import { createWorld, padCost, padNeed, total, count, HOME } from './sim/world.js';
import { step, DT, nearestNode, choosePerk, needsHammer, perk, coalPrice, cardValue, buy, shopCost, payDelay } from './sim/step.js';
import { botInput, botPerk, botShop } from './sim/bot.js';
import { BAL } from './sim/config.js';
import { T, makeView, clampCam, groundCanvas, drawPad, drawMarket, drawScene, drawNight, drawHeroGhost, BOOTH_DY } from './render/draw.js';
import { icon } from './render/icons.js';
import { text, rrect, hit, iconButton, button, lerp } from './lib/ui.js';
import { sprite, play, isMuted, toggleMute, stats, bump, getSpeed, cycleSpeed, timeScale, getMode, setMode } from './lib/media.js';
import * as poki from './lib/poki.js';
import * as synth from './lib/synth.js';
import { t } from './lib/i18n.js';

const KEYS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };

export function gameScene(stage, { watch: watchStart = false, relight = false }) {
  let world, cam, acc, mem, state, watch, dark, joy, fx, flyers, banners, shake, hurtFlash, coinBump, best, begun, fallen, played = 0;
  let dawnFx, overFx, smokeT = 0, healT = 0;   // the dawn and game-over animations (Oleg's play: make them cool)
  let shouts = [], threats = null, fireworks = 0;   // the big words; where tonight's packs come from; the victory's fireworks
  let floats = [], alarmed = false;                 // little numbers that rise and fade (+10 fire, -7 hit); the low-fire alarm
  let walkTo = null, tap = null, moved0 = false;    // tap-to-walk: where to, the press being judged; has the player moved yet
  let fireHurt = 0, attackT = 0, taught = false, flare = 0;   // the fire under attack (flash, alarm); the coal lesson; a fed flare
  let lastView = null;                              // the last frame's camera, to turn a tap into a spot on the map
  let fullPress = false;                            // a press that began on the fullscreen button
  let packBump = 0;                                 // the backpack in the HUD swells when a bigger one is bought
  let fedOnce = false;                              // the first lump: the pointer leads to the fire until one goes in
  let fullT = 0;                                    // till the next MAX over a full fire
  let offerT = 0, cards = [], sel = 1;              // the dawn choice: how long it has shown, where its cards are, the one picked by keys
  let spinReq = false;                              // Space or the spin button was pressed: spin on the next step
  let paused = false;                               // the pause (Oleg: no way to pause): the button, P or Escape, or the window left
  let hitStop = 0;                                  // a few frames' freeze when the spin lands
  let slashes = [];                                 // the spin's glowing swoosh round the hero, drawn crisp over the world
  const keys = new Set();
  const setPause = (on) => {
    if (on === paused || (on && (state !== 'play' || watch))) return;
    paused = on;
    keys.clear();
    joy = null;
    if (on) poki.gameplayStop();   // Poki: play stops while paused
    else if (begun) poki.gameplayStart();
  };
  const onKey = (e) => {
    if (e.type === 'keydown' && (e.code === 'KeyP' || e.code === 'Escape')) {
      e.preventDefault();
      return setPause(!paused);
    }
    if (paused) return;
    // the game-over card: Enter or R plays again, once the card is up (Leo's round 6: only a click worked)
    if (state === 'over' && !watch && e.type === 'keydown' && ['Enter', 'NumpadEnter', 'KeyR'].includes(e.code)) {
      e.preventDefault();
      if (ui.replay) replay();
      return;
    }
    if (choosing() && e.type === 'keydown') {   // the dawn choice: 1 2 3, or arrows and Enter / Space
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
      if (n !== undefined) return pick(n);
      if (['ArrowLeft', 'KeyA'].includes(e.code)) sel = (sel + 2) % 3;
      if (['ArrowRight', 'KeyD'].includes(e.code)) sel = (sel + 1) % 3;
      if (['Enter', 'NumpadEnter'].includes(e.code)) return pick(sel);   // not Space: it is the spin (Leo's round 6)
      const b = { Digit4: 0, Digit5: 1, Digit6: 2, Numpad4: 0, Numpad5: 1, Numpad6: 2 }[e.code];
      if (b !== undefined && ui.wares?.[b]) return shopBuy(ui.wares[b].id);
      if (e.code === 'Space') return;
    }
    if (e.code === 'Space') {   // the spin
      e.preventDefault();
      if (e.type === 'keydown' && state === 'play') spinReq = true;
      return;
    }
    if (!KEYS[e.code]) return;
    e.preventDefault();
    if (e.type === 'keydown') {
      keys.add(e.code);
      if (state === 'play') begin();
    } else keys.delete(e.code);
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  // switching to another app while a key is down never sends its key-up here: let go of everything (Oleg's play: keys seemed
  // held after typing in other apps)
  const release = () => {
    keys.clear();
    joy = null;
  };
  window.addEventListener('blur', release);
  // leaving the window pauses a game under way (not a simulated playtest: its tabs are always in the background)
  const playtest = new URLSearchParams(location.search).has('playtest');
  window.addEventListener('blur', () => !playtest && begun && setPause(true));
  document.addEventListener('visibilitychange', () => document.visibilityState !== 'visible' && release());
  let ui = {};

  function start(asWatch, seed = (Date.now() & 0xfffff) + 1) {
    world = createWorld(seed, { relight, mode: getMode() });
    cam = { x: world.hero.x, y: world.hero.y };
    acc = 0;
    mem = {};
    watch = asWatch;
    state = 'play';
    begun = false;
    dark = 0;
    joy = null;
    fx = [];
    flyers = [];
    banners = [];
    shake = 0;
    hurtFlash = 0;
    coinBump = 0;
    fallen = null;
    dawnFx = overFx = threats = null;
    shouts = [];
    fireworks = 0;
    floats = [];
    alarmed = false;
    walkTo = tap = null;
    moved0 = false;
    fireHurt = attackT = flare = packBump = 0;
    fedOnce = false;
    paused = false;
    offerT = 0;
    cards = [];
    taught = false;
    best = stats().bestNights || 0;
  }

  // the player's first input of a run starts Poki's gameplay clock
  function begin() {
    if (begun || watch) return;
    begun = true;
    poki.gameplayStart();
    synth.start();
    synth.setMuted(isMuted());
    synth.music(world.phase === 'night' ? 'night' : 'day');
  }

  // the game-over card's play-again: a tap on its button, or Enter / R; Poki's ad break first, the sound off while it plays
  let breakOn = false;
  function replay() {
    if (breakOn) return;
    breakOn = true;
    poki.commercialBreak(() => synth.setMuted(true)).then(() => {
      breakOn = false;
      synth.setMuted(isMuted());
      start(false);
      begin();
      synth.music('day');
    });
  }

  // a shout: big words in the upper third (Oleg: cool text on nightfall and on a night survived), a style each
  function shout(msg, style, sub = '', fresh = false) {
    if (fresh) shouts = [];   // a new moment clears the last one's words
    shouts.push({ msg, style, sub, t: 0 });
    if (shouts.length > 3) shouts.shift();
  }

  // a banner is an icon and a number (night 3, day 4, -12 coins), never a sentence
  function banner(b) {
    banners.push({ t: 0, color: '#fff2c8', ...b });
    if (banners.length > 2) banners.shift();
  }

  function particles(x, y, color, n = 5, speed = 2.5, size = 3) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random());
      fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, life: 0.6, t: 0, color, size });
    }
  }

  function input() {
    if (watch) return botInput(world, 'plan', mem);
    const spin = spinReq;
    spinReq = false;
    let x = 0, y = 0;
    for (const k of keys) {
      x += KEYS[k][0];
      y += KEYS[k][1];
    }
    if (joy && joy.active) {
      const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy);
      if (d > 6) {
        const m = Math.min(1, d / 42);
        x += (dx / d) * m;
        y += (dy / d) * m;
      }
    }
    // a tap walks the hero to that spot (Mia's playtest: a 9-year-old taps first; tapping did nothing, so the game seemed broken)
    if (x || y) walkTo = null;
    else if (walkTo) {
      const h = world.hero, dx = walkTo.x - h.x, dy = walkTo.y - h.y, d = Math.hypot(dx, dy);
      if (d < 0.25 || (walkTo.t += 1 / 60) > 8) walkTo = null;
      else return { x: dx / d, y: dy / d, spin };
    }
    if (x || y) moved0 = true;
    return { x, y, spin };
  }

  // sv: world to screen (with the zoom); hudCoin: where coins fly to and from
  function handleEvents(sv, hudCoin) {
    for (const e of world.events) {
      switch (e.type) {
        case 'chop':
        case 'mine':
          particles(e.x, e.y - 0.3, e.type === 'chop' ? '#b07a42' : e.coal ? '#ff9a40' : '#a9adb3', e.coal ? 5 : 3, 2);
          play(e.type, e.helper ? 0.15 : 0.35, 0.09);
          break;
        case 'sell':
          if (!e.helper || Math.random() < 0.3) flyers.push({ x0: sv.sx(world.market.x), y0: sv.sy(world.market.y) - 10, x1: hudCoin.x, y1: hudCoin.y, t: 0 });
          play('coin', e.helper ? 0.12 : 0.3, 0.06);
          break;
        case 'pay': {
          const p = world.pads.find((q) => q.id === e.pad), h = world.hero;
          if (e.res === 'coins') flyers.push({ x0: hudCoin.x, y0: hudCoin.y, x1: sv.sx(p.x), y1: sv.sy(p.y), t: 0, out: true });
          else flyers.push({ x0: sv.sx(h.x), y0: sv.sy(h.y) - 24, x1: sv.sx(p.x), y1: sv.sy(p.y), t: 0, res: e.res });
          play(e.res === 'coins' ? 'coin' : e.res === 'wood' ? 'chop' : 'mine', 0.18, 0.09);
          break;
        }
        case 'build':
          // a built thing pops: a gold ring and stars (Mia's playtest: she paid 12 coins and saw nothing happen)
          particles(e.x, e.y, '#e8d8b0', 14, 3.5, 4);
          particles(e.x, e.y - 0.6, '#ffd34a', 12, 4.5, 4);
          fx.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.7, t: 0, color: '#ffd34a', size: 1.6, ring: true });
          shake = Math.max(shake, 0.1);
          play('build', 0.6, 0.1);
          break;
        case 'spin':
          // the spin, seen and heard (Oleg: drop it unless it gets a cool animation and its own sound): the axe's trail, a shock
          // ring and dust from his feet, sparks off each one struck, a freeze of a few frames when it lands, a whoosh and a thump
          slashes.push({ t: 0, life: 0.42 });
          fx.push({ x: e.x, y: e.y - 0.1, vx: 0, vy: 0, life: 0.45, t: 0, color: '#ffe9a8', size: BAL.spin.reach * 1.25, ring: true });
          fx.push({ x: e.x, y: e.y - 0.1, vx: 0, vy: 0, life: 0.3, t: -0.08, color: '#ffffff', size: BAL.spin.reach * 0.9, ring: true });
          particles(e.x, e.y + 0.1, '#b89a6a', 16, 4.5, 3);
          for (const [sx, sy] of e.at) {
            particles(sx, sy - 0.4, '#ffd34a', 8, 6, 3);
            particles(sx, sy - 0.4, '#ffffff', 4, 4, 2);
          }
          shake = Math.max(shake, e.hits ? 0.28 : 0.12);
          synth.cue('spin');
          if (e.hits) {
            hitStop = 0.07;
            setTimeout(() => synth.cue('spinHit'), 110);
          }
          break;
        case 'perk':
          synth.cue('perfect');
          floats.push({ text: perkText(e.id), wx: world.hero.x, wy: world.hero.y - 2.2, t: 0, color: '#ffe9a8', size: 26 });
          particles(world.hero.x, world.hero.y - 0.6, '#ffd34a', 16, 4, 4);
          break;
        case 'swing':
          // the hero's blow: a slash where it lands and the damage (Sam's playtest: fights were invisible)
          fx.push({ x: e.x, y: e.y - 0.4, vx: 0, vy: 0, life: 0.22, t: 0, color: '#ffffff', size: 18, slash: true, dir: Math.random() < 0.5 ? 1 : -1 });
          floats.push({ text: `${Math.round(e.dmg)}`, wx: e.x + (Math.random() - 0.5) * 0.4, wy: e.y - 1, t: 0, color: '#ffffff', size: 15 });
          break;
        case 'unlock':
          // a new pad: a burst of light where it appears (the pointer then leads to it)
          for (const id of e.pads) {
            const p = world.pads.find((q) => q.id === id);
            particles(p.x, p.y, '#ffe98c', 10, 3, 3);
          }
          if (world.t > 0.5) play('dawn', 0.25, 0.3);
          break;
        case 'dusk':
          // night falls: a horn, the words, and red arrows on the edges where tonight's packs will come from
          shout(t('dusk'), 'dusk', '', true);
          synth.cue('dusk');
          if (e.brute) {
            shout(t('brute'), 'brute', '@giant');   // with a picture of one (Mia: she cannot read GIANT)
            synth.cue('brute');
          }
          threats = { packs: e.packs, t: 0 };
          break;
        case 'night':
          shout(t('night', e.night), 'night', '', true);
          synth.cue('night');
          synth.music('night');
          play('night', 0.4, 0.5);
          break;
        case 'dawn':
          // the night is held: a sunrise sweeps the screen, rays turn behind the sun, the fire throws up sparks
          dawnFx = { t: 0 };
          particles(world.fire.x, world.fire.y - 0.6, '#ffe28a', 36, 6, 4);
          shout(t('held', e.held), 'dawn', `+${e.reward}`, true);
          if (e.perfect) shout(t('perfect'), 'perfect');
          synth.cue('dawn');
          if (e.perfect) synth.cue('perfect');
          synth.music('day');
          // the reward: coins burst from the fire to the counter
          for (let k = 0; k < Math.min(14, 4 + e.reward / 3); k++) flyers.push({ x0: sv.sx(world.fire.x) + (Math.random() - 0.5) * 60, y0: sv.sy(world.fire.y) - 30, x1: hudCoin.x, y1: hudCoin.y, t: -k * 0.06 });
          threats = null;
          play('dawn', 0.5, 0.5);
          if (!watch) bump('bestNights', e.day - 1, 'max');
          break;
        case 'relight':
          // variant B: the fire flares back to life, and the coins it cost fly away
          particles(e.x, e.y - 0.4, '#ffb347', 30, 5, 5);
          banner({ icon: 'coin', num: e.lost ? -e.lost : undefined, color: '#ff9f8a' });
          shout(t('relit'), 'dawn');
          synth.cue('relit');
          shake = 0.4;
          play('build', 0.8, 0.2);
          play('dawn', 0.6, 0.2);
          break;
        case 'kill':
          // a burst of shadow and a little light
          particles(e.x, e.y - 0.3, '#2a2236', e.kind === 'brute' ? 30 : 14, 3.5, 5);
          particles(e.x, e.y - 0.3, '#9ff6ff', e.kind === 'brute' ? 12 : 5, 2.5, 3);
          play('die', 0.25, 0.08);
          break;
        case 'hit':
          particles(e.x, e.y - 0.4, '#ffe08a', 3, 2, 2);
          break;
        case 'heroHit':
          shake = Math.max(shake, 0.18);
          play('hit', 0.35, 0.15);
          // low: the screen flashes red and the alarm sounds (Leo's playtest: he fell before his health looked low)
          if (world.hero.hp <= BAL.hero.hp * 0.4 && world.hero.hp > 0) {
            hurtFlash = Math.max(hurtFlash, 0.5);
            if (attackT <= 2) synth.cue('alarm');
          }
          break;
        case 'heroDown':
          hurtFlash = 1;
          shout(t('fell'), 'out');   // (Mia's and Leo's round 4: the grey heart and its count meant nothing to them)
          fallen = { x: e.x, y: e.y };
          particles(e.x, e.y - 0.4, '#d8e0ff', 14, 2.5, 3);
          play('lose', 0.35, 1);
          break;
        case 'respawn':
          fallen = null;
          particles(world.hero.x, world.hero.y - 0.4, '#ffe9a8', 12, 2.5, 3);
          break;
        case 'coal':
          particles(e.x, e.y - 0.2, '#ff8a3a', 4, 1.5, 2);
          play('mine', 0.3, 0.06);
          break;
        case 'feed':
          // a piece of coal goes into the fire: it flares, and the fire's meter shows the gain (Sam's playtest: a lump only nudged
          // a small bar far from the fire)
          particles(e.x, e.y - 0.6, '#ffb347', 14, 3.5, 3);
          floats.push({ text: `+${BAL.coal.heal}`, wx: e.x, wy: e.y - 1.6, t: 0, color: '#ffcf5a', size: 22 });
          // the lump flies from the backpack into the fire, and the fire flares up (Mia: she never saw that she was feeding it)
          flyers.push({ x0: sv.sx(e.hx ?? world.hero.x), y0: sv.sy(e.hy ?? world.hero.y) - 24, x1: sv.sx(e.x), y1: sv.sy(e.y) - 8, t: 0, res: 'coal' });
          flare = 1;
          if (!e.helper) fedOnce = true;   // the coal miner's lumps teach nothing
          play('build', 0.3, 0.12);
          break;
        case 'fireHit':
          // the fire is hit: its meter flashes red and shakes, the screen's edges pulse, an alarm now and then (Leo's playtest:
          // the fire went from half to out with no warning)
          shake = Math.max(shake, 0.12);
          fireHurt = 1;
          play('hit', 0.3, 0.2);
          if (attackT <= 0) {
            attackT = 4;
            synth.cue('alarm');
            shout(t('attack'), 'brute');
          }
          break;
        case 'stack':
          // the log or stone flies from the backpack onto the pile (Mia's playtest: her sticks just vanished)
          if (!e.helper) flyers.push({ x0: sv.sx(world.hero.x), y0: sv.sy(world.hero.y) - 24, x1: sv.sx(e.x), y1: sv.sy(e.y) - 6, t: 0, res: e.res });
          play('chop', 0.12, 0.05);
          break;
        case 'wallHit':
          particles(e.x, e.y, '#8a6239', 2, 2);
          break;
        case 'towerHit':
          particles(e.x, e.y - 0.8, '#9c7a52', 3, 2.5);
          shake = Math.max(shake, 0.06);
          break;
        case 'towerDown':   // a Giant smashed it: rubble till it is repaired
          particles(e.x, e.y - 0.8, '#9c7a52', 30, 5, 5);
          particles(e.x, e.y - 1.4, '#c0563b', 10, 4, 4);
          shake = Math.max(shake, 0.35);
          synth.cue('crash');
          break;
        case 'wallDown':
          // broken: rubble till it is repaired
          particles(e.x, e.y, '#8a6239', 22, 4, 4);
          shake = Math.max(shake, 0.25);
          synth.cue('crash');
          break;
        case 'victory':
          shout(t('victory'), 'victory', t('nights', e.nights), true);   // it takes the screen on its own
          synth.cue('victory');
          fireworks = 4;
          break;
        case 'arrow':
          play('arrow', 0.08, 0.15);
          break;
        case 'coin':
          coinBump = 1;
          play('coin', 0.12, 0.05);
          break;
        case 'lose':
          // the fire goes out: its flames sink, smoke rises, the dark closes in and the camera leans in; then the card
          state = 'over';
          overFx = { t: 0 };
          threats = null;
          shout(t('out'), 'out', '', true);
          synth.music(null);
          synth.cue('out');
          if (!watch) {
            poki.gameplayStop();
            bump('bestNights', e.nights, 'max');
            bump('runs');
          }
          break;
      }
    }
    world.events.length = 0;
  }

  // the dawn choice is on screen (after the sunrise); the game waits for it
  function choosing() {
    return state === 'play' && !!world.offer && !dawnFx && !watch;
  }
  // buy one of the dawn's wares (it does not use up the free card)
  function shopBuy(id) {
    if (!buy(world, id)) {
      play('hit', 0.2, 0.1);   // not enough coins
      return;
    }
    synth.cue('perfect');
    // a bigger bag shows what it changed (Sam's playtest: nothing showed it), and the HUD's backpack swells
    if (id === 'bag') {
      floats.push({ text: `+${BAL.carry.perUpgrade}`, wx: world.hero.x, wy: world.hero.y - 2.2, t: 0, color: '#ffe9a8', size: 26, icon: 'pack' });
      packBump = 1;
    } else floats.push({ text: t(`card_${id}`), wx: world.hero.x, wy: world.hero.y - 2.2, t: 0, color: '#ffe9a8', size: 22 });
    particles(world.hero.x, world.hero.y - 0.6, '#ffd34a', 18, 4, 4);
  }
  function pick(n) {
    const id = world.offer && world.offer[n];
    if (!id || !choosePerk(world, id)) return;
    offerT = 0;
    keys.clear();
    joy = null;
  }

  function update(dt) {
    if (paused) return;
    if (hitStop > 0) {
      hitStop -= dt;
      return;
    }
    for (const sl of slashes) sl.t += dt * timeScale();
    slashes = slashes.filter((sl) => sl.t < sl.life);
    dt *= timeScale();   // the speed setting: the whole game runs at it
    if (watch && world.offer && !dawnFx) {
      for (const id of botShop(world)) buy(world, id);
      choosePerk(world, botPerk(world));
    }
    if (choosing()) offerT += dt;
    if (state === 'play' && !world.over && !choosing()) {
      acc += dt;
      const inp = input();
      let stepped = false;
      for (let n = 0; acc >= DT && n < 6; n++) {
        step(world, inp, DT);
        acc -= DT;
        stepped = true;
        inp.spin = false;   // one spin a press
      }
      // a frame with no step (at 1x a frame is less than a step) keeps the press for the next (Leo's round 5: Space sometimes did
      // nothing though the button was ready)
      if (!stepped && inp.spin) spinReq = true;
      if (!watch) {
        played += dt;
        if (played >= 5) {   // the play-time counter, written every 5 s (it was every frame)
          bump('seconds', played);
          played = 0;
        }
      }
    }
    if (watch && world.over) {
      acc += dt;
      if (acc > 4) start(true);
    }
    // the evening: dusk warms and darkens, night is dark, dawn lifts it
    let target = 0;
    if (world.phase === 'night') target = 0.82;
    else if (world.started) {
      const u = (world.phaseT - (world.dayLength - BAL.day.dusk)) / BAL.day.dusk;
      if (u > 0) target = 0.12 + 0.5 * Math.min(1, u);
    }
    dark = lerp(dark, target, Math.min(1, dt * 1.6));
    const h = world.hero;
    cam.x = lerp(cam.x, h.x, Math.min(1, dt * 9));   // a tight follow (Dana's playtest: the hero ran to the screen's edge)
    cam.y = lerp(cam.y, h.y, Math.min(1, dt * 9));
    if (dawnFx && (dawnFx.t += dt) > 2.8) dawnFx = null;
    fireHurt = Math.max(0, fireHurt - dt * 2);
    attackT -= dt;
    flare = Math.max(0, flare - dt * 2);
    packBump = Math.max(0, packBump - dt * 1.5);
    // the coal lesson: the first time the fire runs low, say so (Leo's playtest: he learned the fire eats coal only on the card)
    const coalIn = world.hero.stack.includes('coal'), room = world.fire.hp <= world.fire.max - BAL.coal.heal;
    // ... once coal can be had: with no pickaxe and none in the bag it asked for what she could not get (Mia's round 7)
    if (state === 'play' && world.started && !taught && (coalIn || world.tools.pickaxe) && ((coalIn && room && !fedOnce) || world.fire.hp < world.fire.max * 0.6)) {
      taught = true;
      shout(t('feed'), 'dawn', '@coal');   // with coal -> fire under it (Dana's playtest: she stood at the fire holding wood)
    }
    // at the fire with coal it has no room for: MAX over it, now and then (Dana's and Leo's round 7: it took nothing, said nothing)
    fullT = Math.max(0, fullT - dt);
    if (state === 'play' && coalIn && !room && !world.hero.moving && fullT <= 0 && Math.hypot(world.hero.x - world.fire.x, world.hero.y - world.fire.y) < BAL.coal.feedReach) {
      fullT = 2.5;
      floats.push({ text: 'MAX', wx: world.fire.x, wy: world.fire.y - 2.7, t: 0, color: '#9be37a', size: 20 });
    }
    for (const f of floats) f.t += dt;
    floats = floats.filter((f) => f.t < 1.2);
    // the fire runs low: a shout and an alarm, once until it is fed back up (Sam's playtest: he lost twice without knowing)
    if (state === 'play' && world.started) {
      const k = world.fire.hp / world.fire.max;
      if (!alarmed && k < 0.3) {
        alarmed = true;
        shout(t('dying'), 'dusk');
        synth.cue('alarm');
      } else if (alarmed && k > 0.45) alarmed = false;
    }
    for (const sh of shouts) sh.t += dt;
    shouts = shouts.filter((sh) => sh.t < 2.6);
    if (threats && world.phase === 'night' && (threats.t += dt) > 8) threats = null;
    if (fireworks > 0) {
      fireworks -= dt;
      if (Math.random() < dt * 6) {   // a rocket bursts somewhere over the camp
        const fx0 = world.fire.x + (Math.random() - 0.5) * 12, fy0 = world.fire.y - 3 - Math.random() * 5, col = ['#ffd34a', '#ff6a4a', '#7fd36b', '#6ab0ff', '#ff8ae0'][Math.floor(Math.random() * 5)];
        for (let k = 0; k < 26; k++) {
          const a = (k / 26) * Math.PI * 2;
          fx.push({ x: fx0, y: fy0, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, life: 1.1, t: 0, color: col, size: 4, plus: false, spark: true });
        }
        play('arrow', 0.3, 0.05);
      }
    }
    if (overFx) {
      overFx.t += dt;
      world.flames = Math.max(0, 1 - overFx.t / 1.3);
      cam.x = lerp(cam.x, world.fire.x, Math.min(1, dt * 2));
      cam.y = lerp(cam.y, world.fire.y, Math.min(1, dt * 2));
      if ((smokeT -= dt) <= 0 && overFx.t < 4) {
        smokeT = 0.07;
        fx.push({ x: world.fire.x + (Math.random() - 0.5) * 0.5, y: world.fire.y - 0.4, vx: (Math.random() - 0.5) * 0.4, vy: -0.9 - Math.random() * 0.5, life: 2.2, t: 0, color: '#8c8c94', size: 10, smoke: true });
        if (Math.random() < 0.4) fx.push({ x: world.fire.x + (Math.random() - 0.5) * 0.6, y: world.fire.y - 0.3, vx: (Math.random() - 0.5) * 0.8, vy: -1.6, life: 1.4, t: 0, color: '#ff8a3a', size: 3, smoke: true, ember: true });
      }
    }
    if (!overFx) world.flames = 1 + 0.6 * flare;   // a fed fire flares up
    // the fire's warmth heals: green sparkles while it does
    const hh = world.hero;
    if (state === 'play' && !hh.dead && hh.hp < BAL.hero.hp && Math.hypot(hh.x - world.fire.x, hh.y - world.fire.y) < BAL.hero.regenReach && (healT -= dt) <= 0) {
      healT = 0.3;
      fx.push({ x: hh.x + (Math.random() - 0.5) * 0.6, y: hh.y - 1, vx: 0, vy: -1.2, life: 0.8, t: 0, color: '#7fe36b', size: 8, plus: true });
    }
    for (const p of fx) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (!p.smoke && !p.plus) p.vy += (p.spark ? 2 : 6) * dt;
    }
    fx = fx.filter((p) => p.t < p.life);
    for (const f of flyers) f.t += dt * 2.2;
    flyers = flyers.filter((f) => f.t < 1);
    for (const b of banners) b.t += dt;
    banners = banners.filter((b) => b.t < 2.4);
    shake = Math.max(0, shake - dt);
    hurtFlash = Math.max(0, hurtFlash - dt * 1.5);
    coinBump = Math.max(0, coinBump - dt * 4);
  }

  // what to do next, shown by a ring and an arrow, never a sentence. The fire first when it runs low (coal to it, coal on the
  // ground, or a rock: rocks give coal); then the newest thing to build: bring it the wood and stone it needs, gather what is
  // missing, sell for the coins, pay them
  function target() {
    if (watch || state !== 'play') return null;
    const h = world.hero;
    if (h.dead) return null;
    const coal = count(h.stack, 'coal'), wood = count(h.stack, 'wood'), stone = count(h.stack, 'stone'), room = h.stack.length < h.cap;
    const low = world.started && world.fire.hp < world.fire.max * 0.6;
    if (low && coal > 0) return world.fire;
    // the first lump of coal goes into the fire, so the rule is learnt on day 1 (Leo's playtest: he found out on night 2)
    if (!fedOnce && coal > 0 && world.started && world.fire.hp <= world.fire.max - BAL.coal.heal) return world.fire;
    if (low && room) {
      let c = null, cd = 8;
      for (const o of world.coalOnGround) {
        const d = Math.hypot(o.x - world.fire.x, o.y - world.fire.y);
        if (d < cd) { cd = d; c = o; }
      }
      if (c) return c;
    }
    // a low fire at night with no coal anywhere near: the nearest seam (Mia's playtest: "SAVE THE FIRE!" with an empty bag and
    // nothing said where to go)
    const pick = world.tools.pickaxe;   // coal and rocks need it
    if (low && room && pick && world.phase === 'night') return nearestNode(world, h, 'coal');
    if (world.phase === 'night') {
      const g = world.enemies.find((e) => e.kind === 'brute' && !e.dead && Math.hypot(e.x - world.fire.x, e.y - world.fire.y) < 7);
      if (g) return g;
    }
    if (world.phase === 'night') return null;
    // the day's last 14 seconds, and away from the fire: home (Mia: night caught her at the map's edge; Dana: the ring sent her
    // to far trees just as night fell)
    if (world.started && world.dayLength - world.phaseT < 14 && Math.hypot(h.x - world.fire.x, h.y - world.fire.y) > 5) return world.fire;
    if (low && room && pick) return nearestNode(world, h, 'coal');   // a low fire: dig coal
    // a bag full of things the next build does not need: wood and stone onto the camp's pile, coal to the merchant
    const pileWood = wood + world.stock.wood, pileStone = stone + world.stock.stone;
    // not what needs a tool not yet had: an upgrade without the hammer, stone without the pickaxe
    const open = world.pads.filter((p) => padCost(p) != null && !needsHammer(world, p) && (world.tools.pickaxe || padNeed(p).stone <= pileStone));
    const goal = open.find((p) => world.fresh.includes(p.id)) || open.sort((a, b) => total(padNeed(a)) - total(padNeed(b)))[0];
    if (goal) {
      const need = padNeed(goal), brings = (need.wood > 0 && wood > 0) || (need.stone > 0 && stone > 0);
      const hasAll = pileWood >= need.wood && pileStone >= need.stone;
      if (hasAll && world.coins >= need.coins) return goal;                                   // all there: build
      if (brings && (!room || hasAll)) return goal;                                            // bring what it needs
      if (need.coins > world.coins && coal > 0) return world.market;                         // coins come from coal
      if (!room) return wood + stone > 0 ? BAL.woodpile : world.market;
      if (need.stone > pileStone && pick) return nearestNode(world, h, 'rock');
      if (need.wood > pileWood) return nearestNode(world, h, 'tree');
      if (need.coins > world.coins && pick) return nearestNode(world, h, 'coal');
    }
    return room ? null : wood + stone > 0 ? BAL.woodpile : world.market;
  }

  function drawRing(ctx, view, t, now) {
    const x = view.sx(t.x), y = view.sy(t.y), r = 26 + Math.sin(now * 0.008) * 5;
    ctx.strokeStyle = 'rgba(255,233,140,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    const by = y - r - 16 - Math.abs(Math.sin(now * 0.008)) * 8;
    ctx.fillStyle = '#ffe98c';
    ctx.beginPath();
    ctx.moveTo(x, by + 14);
    ctx.lineTo(x - 11, by);
    ctx.lineTo(x + 11, by);
    ctx.fill();
  }

  // the target is off screen: an arrow on the screen's edge points the way
  function drawEdgeArrow(ctx, full, sx, sy, now) {
    const m = 46, x0 = full.x + m, y0 = full.y + m + (narrow(full) ? 170 : 110), x1 = full.x + full.w - m, y1 = full.y + full.h - m;
    // only when the target is really off screen (on screen its ring shows it, even under the HUD)
    if (sx >= full.x + 12 && sx <= full.x + full.w - 12 && sy >= full.y + 12 && sy <= full.y + full.h - 12) return;
    const cx = full.x + full.w / 2, cy = full.y + full.h / 2, dx = sx - cx, dy = sy - cy;
    const k = Math.min(dx ? Math.abs((dx > 0 ? x1 - cx : cx - x0) / dx) : Infinity, dy ? Math.abs((dy > 0 ? y1 - cy : cy - y0) / dy) : Infinity);
    const ax = cx + dx * k, ay = cy + dy * k, a = Math.atan2(dy, dx), pulse = 1 + 0.12 * Math.sin(now * 0.01);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(30,22,16,0.55)';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe98c';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-8, -12);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-8, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // the hero fell: a grave where it happened, and by the fire a ring that empties until he is back (8 s: a real penalty)
  function drawFallen(ctx, view, now) {
    if (fallen) {
      const x = view.sx(fallen.x), y = view.sy(fallen.y);
      ctx.fillStyle = '#8b8f99';
      rrect(ctx, x - 6, y - 14, 12, 16, 5);
      ctx.fill();
      ctx.fillStyle = '#5b5f69';
      ctx.fillRect(x - 1, y - 11, 2, 8);
      ctx.fillRect(x - 4, y - 8, 8, 2);
    }
    const x = view.sx(HOME.x), y = view.sy(HOME.y) - 14, k = world.hero.dead / BAL.hero.respawn;   // where he will be back
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
    ctx.stroke();
    text(ctx, `${Math.ceil(world.hero.dead)}`, x, y + 1, { size: 16, weight: 900 });
  }

  // where tonight's packs come from: red arrows on the screen's edges (or a red ring where the spot is on screen), from dusk
  // into the first seconds of the night
  // where tonight's packs come from (at dusk), or where the night's last few are (`spots`: Leo's round 5: he hunted the last
  // ghosts in the dark for half a minute each night)
  function drawThreats(ctx, full, sv, now, spots = null) {
    const { w: mw, h: mh } = BAL.map, a = spots ? 0.9 : Math.min(1, (8 - threats.t) / 2) * (0.75 + 0.25 * Math.sin(now * 0.012));
    spots = spots || threats.packs.map((pk) => [pk.side < 2 ? pk.u : pk.side === 2 ? 0.6 : mw - 0.6, pk.side === 0 ? 0.6 : pk.side === 1 ? mh - 0.6 : pk.u]);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    for (const [wx, wy] of spots) {
      const sx = sv.sx(wx), sy = sv.sy(wy), m = 40;
      if (sx > full.x + m && sx < full.x + full.w - m && sy > full.y + m + 100 && sy < full.y + full.h - m) {
        ctx.strokeStyle = '#ff4a3a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(sx, sy, 22 + 4 * Math.sin(now * 0.012), 0, Math.PI * 2);
        ctx.stroke();
        icon(ctx, 'hollow', sx, sy, 22);
        continue;
      }
      const cx = full.x + full.w / 2, cy = full.y + full.h / 2, dx = sx - cx, dy = sy - cy;
      const x0 = full.x + m, x1 = full.x + full.w - m, y0 = full.y + m + 100, y1 = full.y + full.h - m;
      const k = Math.min(dx ? Math.abs((dx > 0 ? x1 - cx : cx - x0) / dx) : Infinity, dy ? Math.abs((dy > 0 ? y1 - cy : cy - y0) / dy) : Infinity);
      ctx.save();
      ctx.translate(cx + dx * k, cy + dy * k);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.fillStyle = 'rgba(60,8,8,0.7)';
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff4a3a';
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.lineTo(4, -13);
      ctx.lineTo(8, 0);
      ctx.lineTo(4, 13);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      icon(ctx, 'hollow', cx + dx * k - Math.cos(Math.atan2(dy, dx)) * 8, cy + dy * k - Math.sin(Math.atan2(dy, dx)) * 8, 18, '#2c1020');
    }
    ctx.restore();
  }

  // big words: each style its colours and motion; they spring in, hold, and fade
  const SHOUT = {
    dusk: { fill: ['#ffb347', '#c0281e'], stroke: '#2a0606', size: 50, shake: 2 },
    brute: { fill: ['#ff7a5a', '#8a1010'], stroke: '#1a0404', size: 34, shake: 3 },
    night: { fill: ['#e8eeff', '#7f93ff'], stroke: '#0c1030', size: 46 },
    dawn: { fill: ['#fff4b0', '#ffb020'], stroke: '#4a2a00', size: 44 },
    perfect: { fill: ['#e8ffb0', '#3fbf3f'], stroke: '#0a3a10', size: 36 },
    victory: { fill: ['#fff6c0', '#ffc020'], stroke: '#5a3000', size: 66 },
    out: { fill: ['#d0d0d8', '#6a6a78'], stroke: '#101014', size: 40 },
    tip: { fill: ['#ffffff', '#cfd8ff'], stroke: '#101830', size: 26 },
  };
  function drawShouts(ctx, full, now) {
    const cx = full.x + full.w / 2;
    let y = full.y + full.h * 0.27;
    for (const sh of shouts) {
      const st = SHOUT[sh.style], life = 2.6, a = Math.min(1, sh.t * 5, (life - sh.t) * 2.5);
      const pop = sh.t < 0.25 ? 0.6 + 1.6 * sh.t + Math.sin(sh.t * 25) * 0.08 * (0.25 - sh.t) * 4 : 1;
      let size = st.size * pop;
      ctx.font = `900 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      const wmax = full.w * 0.92, tw = ctx.measureText(sh.msg).width;
      if (tw > wmax) {
        size *= wmax / tw;
        ctx.font = `900 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      }
      const jx = st.shake ? (Math.random() - 0.5) * st.shake : 0, jy = st.shake ? (Math.random() - 0.5) * st.shake : 0;
      const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
      g.addColorStop(0, st.fill[0]);
      g.addColorStop(1, st.fill[1]);
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      // the glow: a wide see-through stroke (it was a shadow blur, slow on a phone's big canvas: Oleg's phone test, giants)
      ctx.strokeStyle = st.fill[1];
      ctx.globalAlpha = Math.max(0, a) * 0.3;
      ctx.lineWidth = Math.max(4, size * 0.14) + size * 0.28;
      ctx.strokeText(sh.msg, cx + jx, y + jy);
      ctx.globalAlpha = Math.max(0, a);
      ctx.lineWidth = Math.max(4, size * 0.14);
      ctx.strokeStyle = st.stroke;
      ctx.strokeText(sh.msg, cx + jx, y + jy);
      ctx.fillStyle = g;
      ctx.fillText(sh.msg, cx + jx, y + jy);
      if (sh.sub === '@giant') {   // a picture: the horned giant
        const yy = y + size * 1.05, k = size / 34;
        ctx.fillStyle = '#d0423a';
        for (const sd of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx + sd * 10 * k, yy - 10 * k);
          ctx.lineTo(cx + sd * 20 * k, yy - 26 * k);
          ctx.lineTo(cx + sd * 4 * k, yy - 14 * k);
          ctx.fill();
        }
        icon(ctx, 'hollow', cx, yy, 40 * k, '#1a1426');
        ctx.fillStyle = '#ff3a2a';
        ctx.beginPath();
        ctx.arc(cx - 5.5 * k, yy - 2.5 * k, 3.2 * k, 0, Math.PI * 2);
        ctx.arc(cx + 5.5 * k, yy - 2.5 * k, 3.2 * k, 0, Math.PI * 2);
        ctx.fill();
      } else if (sh.sub === '@coal') {   // a picture: coal, an arrow, the fire
        const yy = y + size * 0.95, k = size / 44;
        icon(ctx, 'coal', cx - 40 * k, yy, 30 * k, '#ff8a3a');
        ctx.fillStyle = '#fff4d0';
        ctx.fillRect(cx - 14 * k, yy - 3 * k, 18 * k, 6 * k);
        ctx.beginPath();
        ctx.moveTo(cx + 2 * k, yy - 10 * k);
        ctx.lineTo(cx + 14 * k, yy);
        ctx.lineTo(cx + 2 * k, yy + 10 * k);
        ctx.fill();
        icon(ctx, 'fire', cx + 40 * k, yy, 34 * k);
      } else if (sh.sub) {   // a coin and the reward, or a smaller line
        const isCoins = sh.sub.startsWith('+');
        ctx.font = `900 ${size * 0.55}px system-ui, sans-serif`;
        ctx.lineWidth = Math.max(3, size * 0.08);
        ctx.strokeText(sh.sub, cx + (isCoins ? 12 : 0), y + size * 0.85);
        ctx.fillStyle = isCoins ? '#ffd34a' : '#fff4d0';
        ctx.fillText(sh.sub, cx + (isCoins ? 12 : 0), y + size * 0.85);
        if (isCoins) icon(ctx, 'coin', cx - ctx.measureText(sh.sub).width / 2 - 6, y + size * 0.85, size * 0.5);
      }
      ctx.restore();
      y += size * (sh.sub ? 1.75 : 1.2);
    }
  }

  // a pill of icons and numbers: [icon] value [icon] value
  function pill(ctx, cx, y, parts, bg) {
    ctx.font = '800 18px system-ui, sans-serif';
    const w = parts.reduce((a, p) => a + (p.icon ? 26 : 0) + (p.text != null ? ctx.measureText(String(p.text)).width + 10 : 0), 18);
    rrect(ctx, cx - w / 2, y, w, 36, 18);
    ctx.fillStyle = bg;
    ctx.fill();
    let x = cx - w / 2 + 12;
    for (const p of parts) {
      if (p.icon) {
        icon(ctx, p.icon, x + 11, y + 18, 24, p.color);
        x += 26;
      }
      if (p.text != null) {
        text(ctx, String(p.text), x + 2, y + 19, { size: 18, weight: 800, align: 'left', color: p.textColor || '#fff' });
        x += ctx.measureText(String(p.text)).width + 10;
      }
    }
  }

  // narrow (portrait) screens: Poki's own back button sits in the top-left corner on mobile, so coins and the stack go below it,
  // and the fire's bar goes under the day pill (browser check on a 375 x 812 phone: both overlapped)
  const narrow = (full) => full.w < 560;

  function drawHud(ctx, full, now) {
    const x0 = full.x + 12, y0 = full.y + 12, h = world.hero, yc = y0 + (narrow(full) ? 62 : 0);
    // coins
    const s = 1 + coinBump * 0.12;
    rrect(ctx, x0, yc, 120, 40, 20);
    ctx.fillStyle = 'rgba(20,16,28,0.6)';
    ctx.fill();
    icon(ctx, 'coin', x0 + 22, yc + 20, 24 * s);
    text(ctx, `${world.coins}`, x0 + 42, yc + 21, { size: 22 * s, weight: 800, align: 'left' });
    // the backpack: how full, then what is in it (Oleg's play: one log icon for wood and stone read as a branch)
    const full_ = h.stack.length >= h.cap, pulse = full_ ? 1 + 0.05 * Math.sin(now * 0.012) : 1;
    const wood = count(h.stack, 'wood'), stone = count(h.stack, 'stone');
    const parts = [{ icon: 'wood', text: wood }, { icon: 'stone', text: stone }];
    parts.push({ icon: 'coal', text: count(h.stack, 'coal') });   // coal: the fire's fuel and the merchant's money
    ctx.font = '800 15px system-ui, sans-serif';
    const pw = 92 + parts.reduce((a, q) => a + 26 + ctx.measureText(String(q.text)).width + 8, 0);
    rrect(ctx, x0, yc + 46, pw * pulse, 32, 16);
    ctx.fillStyle = full_ ? 'rgba(170,50,30,0.85)' : 'rgba(20,16,28,0.55)';
    ctx.fill();
    icon(ctx, 'pack', x0 + 17, yc + 62, 26 * (1 + 0.15 * (h.cap / BAL.carry.start - 1)) * (1 + 0.6 * packBump), full_ ? '#c0602c' : undefined);
    // the fill bar
    rrect(ctx, x0 + 33, yc + 56, 50, 12, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    rrect(ctx, x0 + 34, yc + 57, 48 * Math.min(1, h.stack.length / h.cap), 10, 5);
    ctx.fillStyle = full_ ? '#ffcf6a' : '#c9a36a';
    ctx.fill();
    let px = x0 + 92;
    for (const q of parts) {
      icon(ctx, q.icon, px + 10, yc + 62, 20);
      text(ctx, String(q.text), px + 23, yc + 63, { size: 15, weight: 800, align: 'left' });
      px += 26 + ctx.measureText(String(q.text)).width + 8;
    }
    // the hero: a heart and his health, or the seconds until he is back after falling
    rrect(ctx, x0, yc + 84, 120, 26, 13);
    ctx.fillStyle = h.dead ? 'rgba(120,30,30,0.75)' : 'rgba(20,16,28,0.5)';
    ctx.fill();
    const lowHp = !h.dead && h.hp <= BAL.hero.hp * 0.4;   // a big beating heart when low (Mia's round 4)
    icon(ctx, 'heart', x0 + 16, yc + 97, 18 * (lowHp ? 1.25 + 0.25 * Math.abs(Math.sin(now * 0.012)) : 1), h.dead ? '#8a8a8a' : undefined);
    if (h.dead) text(ctx, `${Math.ceil(h.dead)}`, x0 + 32, yc + 98, { size: 15, weight: 800, align: 'left' });
    else {
      rrect(ctx, x0 + 30, yc + 92, 80, 10, 5);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();
      rrect(ctx, x0 + 31, yc + 93, 78 * Math.max(0, h.hp / BAL.hero.hp), 8, 4);
      ctx.fillStyle = h.hp / BAL.hero.hp > 0.4 ? '#7fd36b' : '#ff6a4a';
      ctx.fill();
    }
    // the tools first, the axe he always has among them (Oleg: for consistency), then the dawn choices taken so far, small,
    // under the heart (each with how many times)
    let px0 = x0 + 4;
    const tools = ['hammer', 'pickaxe'].filter((id) => world.perks[id]).map((id) => [id, 1]);
    const rows = [['tool-axe', 1], ...tools, ...Object.entries(world.perks).filter(([id]) => !BAL.tools.includes(id)), ...['spin', 'pistol'].filter((id) => world.owned[id]).map((id) => [id, 1])];
    for (const [id, n] of rows) {
      rrect(ctx, px0, yc + 112, n > 1 ? 44 : 30, 28, 8);
      ctx.fillStyle = 'rgba(20,16,28,0.55)';
      ctx.fill();
      if (id === 'tool-axe') icon(ctx, 'axe', px0 + 15, yc + 126, 20);
      else if (id === 'spin' || id === 'pistol') icon(ctx, id, px0 + 15, yc + 126, 20);
      else perkIcon(ctx, id, px0 + 15, yc + 126, 20, false);
      if (n > 1) text(ctx, `${n}`, px0 + 34, yc + 127, { size: 12, weight: 900, align: 'left' });
      px0 += (n > 1 ? 44 : 30) + 4;
    }
    // day or night: the number of the day or night, then the time to dusk or the enemies left
    const night = world.phase === 'night', cx = full.x + full.w / 2;
    const nth = world.won ? `${world.day}` : `${world.day}/${BAL.goal}`;   // the goal: night 3 of 10
    if (night) pill(ctx, cx, y0, [{ icon: 'moon', text: nth }, { icon: 'hollow', color: '#8f86b0', text: world.enemies.length + world.spawnQueue.length }], 'rgba(30,36,80,0.82)');
    else {
      const left = Math.max(0, Math.ceil(world.dayLength - world.phaseT)), dusk = world.started && left <= BAL.day.dusk;
      const parts = [{ icon: 'sun', text: nth }];
      if (world.started) parts.push({ icon: 'moon', color: dusk ? '#ffb36b' : '#cfd8ff', text: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` });
      pill(ctx, cx, y0, parts, dusk ? 'rgba(170,80,30,0.85)' : 'rgba(20,16,28,0.55)');
    }
    // the fire's health
    const fw = narrow(full) ? 160 : 150, fx0 = narrow(full) ? cx - fw / 2 + 26 : full.x + full.w - fw - 64, fy = narrow(full) ? y0 + 44 : y0;
    const k = world.fire.hp / world.fire.max;
    rrect(ctx, fx0, fy + 8, fw, 18, 9);
    ctx.fillStyle = 'rgba(20,16,28,0.6)';
    ctx.fill();
    rrect(ctx, fx0 + 3, fy + 11, Math.max(0, (fw - 6) * k), 12, 6);
    ctx.fillStyle = k > 0.5 ? '#ffb347' : k > 0.25 ? '#ff8a3a' : '#ff4a2a';
    ctx.fill();
    icon(ctx, 'fire', fx0 - 14, fy + 17, 26);
    // variant B: the one relight still in hand
    if (world.relightLeft > 0) {
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.moveTo(fx0 + fw + 8, fy + 26);
      ctx.quadraticCurveTo(fx0 + fw + 1, fy + 16, fx0 + fw + 8, fy + 4);
      ctx.quadraticCurveTo(fx0 + fw + 15, fy + 16, fx0 + fw + 8, fy + 26);
      ctx.fill();
    }
    ui.sound = { x: full.x + full.w - 52, y: y0, w: 40, h: 40 };
    iconButton(ctx, ui.sound, isMuted() ? '♪̸' : '♪');
    ui.speed = { x: full.x + full.w - 52, y: y0 + 46, w: 40, h: 30 };   // 1x, 1.5x, 2x
    rrect(ctx, ui.speed.x, ui.speed.y, 40, 30, 15);
    ctx.fillStyle = 'rgba(20,16,28,0.6)';
    ctx.fill();
    text(ctx, `${getSpeed()}x`, ui.speed.x + 20, ui.speed.y + 15, { size: 14, weight: 900, color: getSpeed() > 1 ? '#ffd34a' : '#ffffff' });
    ui.pause = state === 'play' && !watch ? { x: full.x + full.w - 52, y: y0 + 82, w: 40, h: 30 } : null;   // pause
    if (ui.pause) {
      rrect(ctx, ui.pause.x, ui.pause.y, 40, 30, 15);
      ctx.fillStyle = 'rgba(20,16,28,0.6)';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ui.pause.x + 14, ui.pause.y + 8, 4, 14);
      ctx.fillRect(ui.pause.x + 22, ui.pause.y + 8, 4, 14);
    }
    // fullscreen, where the browser has it (Oleg's phone test): four corners, out to fill the screen, in to leave it
    ui.full = stage.fullButton && !watch ? { x: full.x + full.w - 52, y: y0 + (ui.pause ? 118 : 82), w: 40, h: 30 } : null;
    if (ui.full) {
      const { x, y } = ui.full, on = stage.isFull(), d = on ? 4 : 0;
      rrect(ctx, x, y, 40, 30, 15);
      ctx.fillStyle = 'rgba(20,16,28,0.6)';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {   // a corner each: the tip points out, or in when full
        const px = x + 20 + sx * 8, py = y + 15 + sy * 6, tx = px - sx * d, ty = py - sy * d;
        ctx.moveTo(tx - sx * (on ? -5 : 5), ty);
        ctx.lineTo(tx, ty);
        ctx.lineTo(tx, ty - sy * (on ? -5 : 5));
      }
      ctx.stroke();
    }
    // the spin button, at night: bright and pulsing when ready, a filling ring while it recharges
    ui.spin = null;
    if (state === 'play' && world.phase === 'night' && !h.dead && !watch && world.owned.spin) {
      const r = 36, bx = full.x + full.w - r - 22, by = full.y + full.h - r - (narrow(full) ? 120 : 26), k = 1 - h.spinT / BAL.spin.cooldown;
      ui.spin = { x: bx - r, y: by - r, w: 2 * r, h: 2 * r };
      const ready = h.spinT <= 0, pulse = ready ? 1 + 0.06 * Math.sin(now * 0.01) : 1;
      ctx.fillStyle = ready ? 'rgba(200,70,40,0.9)' : 'rgba(30,22,28,0.75)';
      ctx.beginPath();
      ctx.arc(bx, by, r * pulse, 0, Math.PI * 2);
      ctx.fill();
      if (!ready) {
        ctx.strokeStyle = '#ffd34a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(bx, by, r - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
        ctx.stroke();
      }
      icon(ctx, 'spin', bx, by, 44, ready ? '#ffffff' : 'rgba(255,255,255,0.45)');
      if (!matchMedia('(pointer: coarse)').matches) text(ctx, 'SPACE', bx, by + r + 11, { size: 11, weight: 800, color: 'rgba(255,255,255,0.7)' });
    }
    // banners: an icon and a number, large, in the upper third
    banners.forEach((b, i) => {
      const a = Math.min(1, b.t * 4, (2.4 - b.t) * 2), y = full.y + full.h * 0.3 + i * 64, sc = 1 + 0.25 * Math.max(0, 1 - b.t * 4);
      ctx.globalAlpha = a;
      const has = b.num != null, label = has ? (b.num > 0 && b.icon === 'coin' ? '+' : '') + b.num : '';
      ctx.font = '900 40px system-ui, sans-serif';
      const tw = has ? ctx.measureText(label).width + 12 : 0, w = 52 + tw;
      icon(ctx, b.icon, cx - w / 2 + 24, y, 48 * sc, b.icon === 'moon' || b.icon === 'sun' ? b.color : undefined);
      if (has) text(ctx, label, cx - w / 2 + 56, y + 2, { size: 40 * sc, weight: 900, align: 'left', color: b.color, alpha: a });
      ctx.globalAlpha = 1;
    });
  }

  function overCard(ctx, full) {
    const a = Math.min(1, Math.max(0, (overFx ? overFx.t : 9) - 2.2) / 0.5);
    if (a <= 0) return;
    const cx = full.x + full.w / 2, cy = full.y + full.h / 2 + (1 - a) * 40, n = world.day - 1, top = Math.max(best, n);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(8,10,24,0.45)';
    ctx.fillRect(full.x, full.y, full.w, full.h);
    rrect(ctx, cx - 150, cy - 170, 300, 320, 22);
    ctx.fillStyle = 'rgba(38,30,48,0.94)';
    ctx.fill();
    sprite(ctx, 'campfire', cx, cy - 112, 84, 0.45);
    // nights held, and the best
    if (world.won) icon(ctx, 'crown', cx + 62, cy - 136, 44);
    icon(ctx, 'moon', cx - 46, cy - 30, 44, '#cfd8ff');
    text(ctx, `${n}`, cx - 14, cy - 28, { size: 46, weight: 900, align: 'left' });
    icon(ctx, 'star', cx - 40, cy + 26, 28);
    text(ctx, `${t('best')} ${top}`, cx - 18, cy + 27, { size: 22, weight: 800, align: 'left', color: '#ffe9a8' });
    // why it ended, and what helps: coal into the fire (Sam's playtest: he lost twice without knowing why)
    icon(ctx, 'coal', cx + 80, cy - 108, 24, '#ff8a3a');
    ctx.fillStyle = '#ffe9a8';   // an arrow from the coal into the fire
    ctx.beginPath();
    ctx.moveTo(cx + 64, cy - 115);
    ctx.lineTo(cx + 50, cy - 108);
    ctx.lineTo(cx + 64, cy - 101);
    ctx.fill();
    text(ctx, t('hint'), cx, cy - 62, { size: 15, weight: 800, color: '#ffcf8a' });
    ui.replay = { x: cx - 52, y: cy + 60, w: 104, h: 64, label: '' };
    button(ctx, ui.replay, { color: '#e0893a' });
    icon(ctx, 'replay', cx, cy + 92, 44);
    ctx.restore();
  }

  // the fire's fuel, big, right over the flames (Sam's playtest: the bar in the corner was small and far away); it flashes red
  // when low
  // a small padlock: what needs a tool not had yet (Mia's and Dana's round 7 read the red cross as broken)
  function padlock(ctx, x, y, s) {
    ctx.save();
    ctx.strokeStyle = '#2a1e10';
    ctx.lineWidth = s * 0.42;
    ctx.beginPath();
    ctx.arc(x, y - s * 0.25, s * 0.42, Math.PI, 0);
    ctx.stroke();
    ctx.strokeStyle = '#e8e2d0';
    ctx.lineWidth = s * 0.2;
    ctx.stroke();
    rrect(ctx, x - s * 0.62, y - s * 0.25, s * 1.24, s * 0.95, s * 0.2);
    ctx.fillStyle = '#f2b632';
    ctx.fill();
    ctx.strokeStyle = '#2a1e10';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#2a1e10';
    ctx.fillRect(x - s * 0.08, y + s * 0.05, s * 0.16, s * 0.35);
    ctx.restore();
  }

  function drawFireMeter(ctx, sv, now) {
    if (!world.started || overFx) return;
    const k = world.fire.hp / world.fire.max, low = k < 0.3, jig = fireHurt * 4 * Math.sin(now * 0.08);
    const x = sv.sx(world.fire.x) + jig, y = sv.sy(world.fire.y) - 74, w = 76;
    const flash = low ? 0.5 + 0.5 * Math.sin(now * 0.015) : fireHurt;
    // not under the HUD's top row (it ran under the day's pill; the corner's bar shows the same)
    if (y > stage.full().y + 64) {
    rrect(ctx, x - w / 2 - 3, y - 3, w + 6, 14, 7);
    ctx.fillStyle = `rgba(20,12,8,${0.75})`;
    ctx.fill();
    if (low) {
      ctx.strokeStyle = `rgba(255,70,40,${0.5 + 0.5 * flash})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    rrect(ctx, x - w / 2, y, Math.max(0, w * k), 8, 4);
    ctx.fillStyle = k > 0.5 ? '#ffb347' : k > 0.3 ? '#ff8a3a' : `rgb(255,${Math.round(60 + 80 * flash)},40)`;
    ctx.fill();
    icon(ctx, 'fire', x - w / 2 - 14, y + 3, 20);
    if (k < 0.65) icon(ctx, 'coal', x + w / 2 + 14, y + 3, 16 + 3 * flash, '#ff8a3a');   // what it needs, from 65% down
    }
    if (fireHurt > 0) {   // under attack: the screen's edges pulse red
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const W = ctx.canvas.width, H = ctx.canvas.height, g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(255,0,0,0)');
      g.addColorStop(1, `rgba(220,20,10,${0.35 * fireHurt})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  // what an open pad still needs, large and crisp under it (Leo's playtest: the costs were tiny blobs, hidden under the hero),
  // a missing part in red; on the pad with something missing, the tag shakes (Mia: nothing said why a pad would not build).
  // Only the newest pads, the one the pointer leads to and those near the hero have one (seven at once was a mess by day 7)
  function drawPriceTags(ctx, sv, now, tg) {
    const h = world.hero, have = { wood: count(h.stack, 'wood') + world.stock.wood, stone: count(h.stack, 'stone') + world.stock.stone, coins: world.coins };
    for (const p of world.pads) {
      const need = padNeed(p);
      const near = Math.hypot(p.x - h.x, p.y - h.y) < (p.level ? 2.2 : 3.2);   // an upgrade's tag only right by it (Mia's round 4)
      if (!need || !(h.pad === p || p === tg || world.fresh.includes(p.id) || near)) continue;
      if (needsHammer(world, p)) {   // no hammer yet: a crossed hammer where the price would be
        const x = sv.sx(p.x), y = sv.sy(p.y + (p.kind === 'tower' ? 0.75 : 0.6)) + 16;
        rrect(ctx, x - 17, y - 15, 34, 30, 15);
        ctx.fillStyle = 'rgba(30,22,16,0.8)';
        ctx.fill();
        icon(ctx, 'hammer', x - 2, y + 1, 22);
        padlock(ctx, x + 9, y + 7, 11);
        continue;
      }
      const here = h.pad === p, short = ['wood', 'stone', 'coins'].some((r) => need[r] > have[r]);
      const x = sv.sx(p.x) + (here && short ? Math.sin(now * 0.05) * 3 : 0), y = sv.sy(p.y + (p.level === 0 ? 0.62 : p.kind === 'tower' ? 0.75 : 0.6)) + 16;   // under the pad, clear of the hero
      const parts = [['wood', need.wood], ['stone', need.stone], ['coin', need.coins]].filter(([, n]) => n > 0);
      ctx.font = '900 16px system-ui, sans-serif';
      const widths = parts.map(([, n]) => 22 + ctx.measureText(String(n)).width + 8), wsum = widths.reduce((a, b) => a + b, 0) + 10 + (p.broken ? 22 : p.level ? 16 : 0) + 26;
      // see-through while the hero walks behind it (Leo's playtest: labels hid his character)
      const hx = sv.sx(h.x), hy = sv.sy(h.y) - 18;
      ctx.globalAlpha = !here && Math.abs(hx - x) < wsum / 2 + 10 && Math.abs(hy - y) < 34 ? 0.35 : 1;
      rrect(ctx, x - wsum / 2, y - 13, wsum, 26, 13);
      ctx.fillStyle = here ? 'rgba(40,26,12,0.92)' : 'rgba(30,22,16,0.82)';
      ctx.fill();
      // on it: a monster within 3 tiles keeps it from taking anything, so a ghost says why (Mia's and Leo's round 7: standing on
      // a broken wall did nothing); else a bar fills while he stands before it takes anything (Leo: walk-overs cost him coins)
      const scared = here && world.enemies.some((e) => !e.dead && Math.hypot(e.x - h.x, e.y - h.y) < 3);
      if (here) {
        ctx.strokeStyle = short || scared ? '#ff6a4a' : '#ffd34a';
        ctx.lineWidth = 2;
        ctx.stroke();
        if (scared) icon(ctx, 'hollow', x + wsum / 2 + 14, y, 22, '#2c2340');
        else if (!h.moving && h.padT > 0 && h.padT < payDelay(p)) {
          rrect(ctx, x - wsum / 2 + 8, y + 15, (wsum - 16) * (h.padT / payDelay(p)), 4, 2);
          ctx.fillStyle = '#ffd34a';
          ctx.fill();
        }
      }
      let px = x - wsum / 2 + 6;
      // what it buys, first: a tower, a wall, or the house's helper (Leo's and Dana's round 6: a price alone said
      // nothing)
      const what = { tower: 'tower', wall: 'wall' }[p.kind] || { wood: 'axe', stone: 'pickaxe', coal: 'coal' }[p.job] || 'tower';
      icon(ctx, what, px + 11, y, 20, what === 'coal' ? '#ff8a3a' : undefined);
      px += 26;
      if (p.broken) {   // a repair: a hammer (Oleg: broken walls and towers need one)
        icon(ctx, 'hammer', px + 9, y, 18);
        px += 22;
      } else if (p.level) {   // an upgrade: an up-arrow first
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath();
        ctx.moveTo(px + 6, y - 7);
        ctx.lineTo(px + 12, y + 4);
        ctx.lineTo(px, y + 4);
        ctx.fill();
        px += 16;
      }
      parts.forEach(([res, n], i) => {
        icon(ctx, res, px + 10, y, res === 'coin' ? 15 : 20);
        const k = res === 'coin' ? 'coins' : res;
        text(ctx, String(n), px + 22, y + 1, { size: 16, weight: 900, align: 'left', color: need[k] > have[k] ? '#ff8a6a' : '#ffffff', alpha: ctx.globalAlpha });
        px += widths[i];
      });
      ctx.globalAlpha = 1;
    }
  }

  // the spin's swoosh: a thick glowing crescent chasing the blade one and a quarter turns round the hero, fading as it goes
  function drawSlashes(ctx, sv) {
    const h = world.hero;
    if (!slashes.length || h.dead) return;
    const face = h.face || 1, hx = sv.sx(h.x), hy = sv.sy(h.y + 0.05) - (sv.sy(h.y + 1) - sv.sy(h.y)) * 0.42, R = (sv.sx(h.x + 1) - sv.sx(h.x)) * 0.95;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const sl of slashes) {
      const k = Math.min(1, sl.t / sl.life), e = 1 - (1 - Math.min(1, sl.t / 0.4)) ** 2, a0 = e * Math.PI * 2.5 * face, fade = 1 - k;
      if (sl.t < 0.08) {   // the first instant: a flash round him
        ctx.fillStyle = `rgba(255,240,200,${0.35 * (1 - sl.t / 0.08)})`;
        ctx.beginPath();
        ctx.arc(hx, hy, R * 1.25, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowColor = '#ff9a30';
      for (let j = 0; j < 8; j++) {
        ctx.shadowBlur = j === 0 ? 14 : 0;   // one blurred arc, not eight (a blur is slow on a phone)
        const a = a0 - face * j * 0.28, al = fade * (1 - j / 8);
        ctx.strokeStyle = j < 2 ? `rgba(255,255,255,${al})` : `rgba(255,${200 - j * 12},${90 - j * 8},${al})`;
        ctx.lineWidth = (12 - j * 1.2) * (R / 34);
        ctx.beginPath();
        if (face > 0) ctx.arc(hx, hy, R, a - 0.3, a);
        else ctx.arc(hx, hy, R, a, a + 0.3);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // the coal merchant's sign over his cart, crisp: one coal buys BAL.price.coal coins (Oleg: make it plain he trades coal for
  // coins); it glows while the hero stands there with coal
  function drawCartSign(ctx, sv, now) {
    const h = world.hero, x = sv.sx(world.market.x + 0.45), y = sv.sy(world.market.y + BOOTH_DY - 2.05);
    const near = h.stack.includes('coal') && Math.hypot(h.x - world.market.x, h.y - world.market.y) < 1.05;
    const w = 86, hx = sv.sx(h.x), hy = sv.sy(h.y) - 18;
    ctx.save();
    // see-through while the hero is behind it (Dana's playtest: she lost him behind the sign in fights)
    if (Math.abs(hx - x) < w / 2 + 10 && Math.abs(hy - y) < 36) ctx.globalAlpha = 0.3;
    rrect(ctx, x - w / 2, y - 14, w, 28, 6);
    ctx.fillStyle = '#7a5230';
    ctx.fill();
    ctx.strokeStyle = near ? '#ffd34a' : '#4a3018';
    ctx.lineWidth = near ? 3 : 2;
    ctx.stroke();
    icon(ctx, 'coal', x - 28, y, 21, '#ff8a3a');
    ctx.fillStyle = '#ffe9a8';   // the arrow
    const ax = x - 13 + (near ? Math.sin(now * 0.012) * 2 : 0);
    ctx.fillRect(ax, y - 2, 12, 4);
    ctx.beginPath();
    ctx.moveTo(ax + 11, y - 7);
    ctx.lineTo(ax + 19, y);
    ctx.lineTo(ax + 11, y + 7);
    ctx.fill();
    text(ctx, String(coalPrice(world)), x + 17, y + 1, { size: 17, weight: 900, alpha: ctx.globalAlpha });   // with the coal-price card (Leo: the sign stayed at 4)
    icon(ctx, 'coin', x + 32, y, 16);
    ctx.restore();
  }

  // over the hero: a full backpack bobbing when there is no room (Mia's playtest: the bar only turned red, she kept getting
  // stuck); after a fall, a grey heart and the seconds left where he will be back (she did not know she had fallen)
  function drawHeroSigns(ctx, sv, now) {
    const h = world.hero;
    if (!world.tools.pickaxe && !h.dead) {   // rocks near the hero: a crossed pickaxe (Oleg: say why a rock gives nothing)
      for (const n of world.nodes) {
        if (n.kind === 'tree' || n.items <= 0 || Math.hypot(n.x - h.x, n.y - h.y) > 3.5) continue;
        const x = sv.sx(n.x), y = sv.sy(n.y) - 44 + Math.sin(now * 0.006 + n.x) * 2;
        ctx.fillStyle = 'rgba(30,22,16,0.7)';
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
        icon(ctx, 'pickaxe', x - 2, y + 1, 20);
        padlock(ctx, x + 8, y + 7, 10);
      }
    }
    if (h.dead > 0) {
      const x = sv.sx(HOME.x), y = sv.sy(HOME.y) - 64;
      rrect(ctx, x - 34, y - 18, 68, 36, 18);
      ctx.fillStyle = 'rgba(30,20,24,0.8)';
      ctx.fill();
      icon(ctx, 'heart', x - 14, y, 22, '#8a8a8a');
      text(ctx, `${Math.ceil(h.dead)}`, x + 12, y + 1, { size: 22, weight: 900 });
      return;
    }
    if (h.stack.length < h.cap || state !== 'play') return;
    const x = sv.sx(h.x), y = sv.sy(h.y) - 70 + Math.sin(now * 0.01) * 4;
    ctx.fillStyle = 'rgba(170,50,30,0.9)';
    ctx.beginPath();
    ctx.arc(x, y, 17, 0, Math.PI * 2);
    ctx.fill();
    icon(ctx, 'pack', x - 2, y + 1, 22, '#c0602c');
    text(ctx, '!', x + 11, y - 9, { size: 16, weight: 900, color: '#ffe9a8' });
  }

  // the camp's pile: what lies on it, over it
  function drawPileTag(ctx, sv) {
    const s = world.stock;
    if (!s.wood && !s.stone || world.phase === 'night') return;   // not at night (Leo's round 4: too many numbers at the camp)
    const x = sv.sx(BAL.woodpile.x), y = sv.sy(BAL.woodpile.y) - 40;
    ctx.font = '900 14px system-ui, sans-serif';
    const parts = [['wood', s.wood], ['stone', s.stone]].filter(([, n]) => n > 0);
    const w = parts.reduce((a, [, n]) => a + 20 + ctx.measureText(String(n)).width + 8, 8);
    rrect(ctx, x - w / 2, y - 11, w, 22, 11);
    ctx.fillStyle = 'rgba(30,22,16,0.75)';
    ctx.fill();
    let px = x - w / 2 + 5;
    for (const [res, n] of parts) {
      icon(ctx, res, px + 9, y, 17);
      text(ctx, String(n), px + 19, y + 1, { size: 14, weight: 900, align: 'left' });
      px += 20 + ctx.measureText(String(n)).width + 8;
    }
  }

  // until the first move: a finger sliding near the bottom (Mia: nothing showed you drag)
  function drawDragHint(ctx, full, now) {
    const cx = full.x + full.w / 2, y = full.y + full.h - 110, k = (now % 1600) / 1600, ox = Math.sin(k * Math.PI * 2) * 40;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, y, 44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';   // the fingertip
    ctx.beginPath();
    ctx.arc(cx + ox, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx + ox - 6, y + 6, 12, 26);   // the finger
    ctx.restore();
  }

  function drawFloats(ctx, sv) {
    for (const f of floats) {
      const a = Math.min(1, (1.2 - f.t) * 2.5), x = sv.sx(f.wx), y = sv.sy(f.wy) - f.t * 40;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `900 ${f.size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20,10,4,0.85)';
      ctx.strokeText(f.text, x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x, y);
      if (f.icon) icon(ctx, f.icon, x - ctx.measureText(f.text).width / 2 - 12, y, f.size);
      ctx.restore();
    }
  }

  // the night is held: a warm light from the top, and rays turning behind the sun banner
  function drawDawn(ctx, full) {
    const t = dawnFx.t, env = Math.min(1, t / 0.35) * Math.max(0, Math.min(1, (2.8 - t) / 1.3));
    const g = ctx.createLinearGradient(0, full.y, 0, full.y + full.h);
    g.addColorStop(0, `rgba(255,214,120,${0.5 * env})`);
    g.addColorStop(0.55, `rgba(255,190,90,${0.14 * env})`);
    g.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(full.x, full.y, full.w, full.h);
    const bx = full.x + full.w / 2, by = full.y + full.h * 0.3, len = 60 + 300 * Math.min(1, t / 0.8);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(t * 0.5);
    ctx.fillStyle = `rgba(255,236,170,${0.22 * env})`;
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.06) * 34, Math.sin(a - 0.06) * 34);
      ctx.lineTo(Math.cos(a - 0.11) * len, Math.sin(a - 0.11) * len);
      ctx.lineTo(Math.cos(a + 0.11) * len, Math.sin(a + 0.11) * len);
      ctx.lineTo(Math.cos(a + 0.06) * 34, Math.sin(a + 0.06) * 34);
      ctx.fill();
    }
    ctx.restore();
  }

  // the fire is out: the dark closes in around where it was
  function drawDying(ctx, full, fxs, fys) {
    const t = overFx.t, k = Math.min(1, t / 2);
    const g = ctx.createRadialGradient(fxs, fys, 40 + 120 * (1 - k), fxs, fys, Math.max(full.w, full.h) * (0.9 - 0.4 * k));
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(4,4,10,${0.88 * k})`);
    ctx.fillStyle = g;
    ctx.fillRect(full.x, full.y, full.w, full.h);
    ctx.fillStyle = `rgba(4,4,10,${0.35 * k})`;
    ctx.fillRect(full.x, full.y, full.w, full.h);
  }

  function draw() {
    const ctx = stage.ctx, full = stage.full(), now = performance.now();
    // a window with no size yet (a hidden pane or iframe at load) gives NaN sizes, and a NaN camera never recovers: wait for one
    if (!(full.w > 0 && full.h > 0)) return;
    stage.begin('#24361f');
    // zoom in until the map fills the window (a wide desktop frame showed empty background past the map's sides), and more
    // on a phone (stage.zoom)
    const lean = overFx ? 1 + 0.35 * (1 - (1 - Math.min(1, overFx.t / 2.2)) ** 2) : 1;
    const z = Math.max(stage.zoom, full.w / (BAL.map.w * T), full.h / (BAL.map.h * T)) * lean, cx = full.x + full.w / 2, cy = full.y + full.h / 2;
    const wfull = { x: cx - full.w / 2 / z, y: cy - full.h / 2 / z, w: full.w / z, h: full.h / z };
    clampCam(cam, wfull, (narrow(full) ? 200 : 140) / z / T);
    const shk = shake > 0 ? { x: (Math.random() - 0.5) * 8 * shake * 5, y: (Math.random() - 0.5) * 8 * shake * 5 } : { x: 0, y: 0 };
    const view = makeView(wfull, { x: cam.x + shk.x / T, y: cam.y + shk.y / T });
    const sv = { sx: (x) => cx + (view.sx(x) - cx) * z, sy: (y) => cy + (view.sy(y) - cy) * z };
    const hudCoin = { x: full.x + 34, y: full.y + 32 };
    if (state === 'play') handleEvents(sv, hudCoin);
    else world.events.length = 0;
    const tg = target();

    // the world: on its own small canvas in pixel mode, blown up with sharp pixels; the HUD and words stay crisp on top
    const wc = stage.beginWorld('#24361f');
    wc.save();
    wc.translate(cx, cy);
    wc.scale(z, z);
    wc.translate(-cx, -cy);
    wc.drawImage(groundCanvas(world), view.sx(0), view.sy(0));
    for (const p of world.pads) drawPad(wc, view, p, world, now);
    drawMarket(wc, view, world, now);
    drawScene(wc, view, world, now, world.phase === 'night');
    for (const p of fx) {
      if (p.smoke || p.plus) continue;
      if (p.ring) {   // a ring that spreads and fades: a building done, a tap
        if (p.t < 0) continue;   // one that starts a moment later
        const k = p.t / p.life;
        wc.globalAlpha = 1 - k;
        wc.strokeStyle = p.color;
        wc.lineWidth = 1 + 3 * (1 - k);
        wc.beginPath();
        wc.arc(view.sx(p.x), view.sy(p.y), p.size * T * (0.3 + 0.7 * k), 0, Math.PI * 2);
        wc.stroke();
        continue;
      }
      if (p.slash) {   // the hero's blow: a white arc
        const k = p.t / p.life;
        wc.globalAlpha = 1 - k;
        wc.strokeStyle = p.color;
        wc.lineWidth = 3;
        wc.beginPath();
        wc.arc(view.sx(p.x), view.sy(p.y), p.size * (0.6 + 0.6 * k), -1.2 * p.dir, 0.8 * p.dir, p.dir < 0);
        wc.stroke();
        continue;
      }
      wc.globalAlpha = 1 - p.t / p.life;
      wc.fillStyle = p.color;
      wc.fillRect(view.sx(p.x) - p.size / 2, view.sy(p.y) - p.size / 2, p.size, p.size);
    }
    wc.globalAlpha = 1;
    // dusk warms the light, then the night closes in
    if (world.phase === 'day' && dark > 0.05) {
      wc.fillStyle = `rgba(255,120,50,${Math.min(0.16, dark * 0.25)})`;
      wc.fillRect(wfull.x, wfull.y, wfull.w, wfull.h);
    }
    drawNight(wc, view, world, dark, now);
    drawHeroGhost(wc, view, world, now);
    // smoke, embers and healing sparkles show over the dark
    for (const p of fx) {
      if (!p.smoke && !p.plus) continue;
      const k = p.t / p.life, x = view.sx(p.x), y = view.sy(p.y);
      wc.globalAlpha = p.ember ? 1 - k : p.plus ? 1 - k : 0.45 * (1 - k);
      wc.fillStyle = p.color;
      if (p.plus) {
        wc.fillRect(x - p.size / 2, y - 1.5, p.size, 3);
        wc.fillRect(x - 1.5, y - p.size / 2, 3, p.size);
      } else {
        wc.beginPath();
        wc.arc(x, y, p.ember ? p.size : p.size * (0.6 + 1.6 * k), 0, Math.PI * 2);
        wc.fill();
      }
    }
    wc.globalAlpha = 1;
    if (tg) drawRing(wc, view, tg, now);
    if (world.hero.dead > 0) drawFallen(wc, view, now);
    wc.restore();
    stage.endWorld();
    drawSlashes(ctx, sv);
    // the world's signs and price tags, not under the dawn's cards (they showed through the dim between them)
    if (!choosing()) {
      drawCartSign(ctx, sv, now);
      drawPriceTags(ctx, sv, now, tg);
      drawPileTag(ctx, sv);
    }
    drawHeroSigns(ctx, sv, now);
    drawFireMeter(ctx, sv, now);
    drawFloats(ctx, sv);
    if (!moved0 && !watch && state === 'play') drawDragHint(ctx, full, now);
    lastView = { cx, cy, z, camX: cam.x, camY: cam.y };
    if (dawnFx) drawDawn(ctx, full);
    if (overFx) drawDying(ctx, full, sv.sx(world.fire.x), sv.sy(world.fire.y));
    if (threats) drawThreats(ctx, full, sv, now);
    else if (world.phase === 'night' && !world.spawnQueue.length && world.enemies.length && world.enemies.length <= 3) drawThreats(ctx, full, sv, now, world.enemies.map((e) => [e.x, e.y]));

    if (tg) drawEdgeArrow(ctx, full, sv.sx(tg.x), sv.sy(tg.y), now);
    // the hero fell: a red flash
    if (hurtFlash > 0) {
      ctx.fillStyle = `rgba(200,30,20,${0.35 * hurtFlash})`;
      ctx.fillRect(full.x, full.y, full.w, full.h);
    }
    // coins flying to and from the counter
    for (const f of flyers) {
      if (f.t < 0) continue;   // not launched yet (the dawn reward's coins leave one after another)
      const e = 1 - (1 - f.t) ** 2, x = lerp(f.x0, f.x1, e), y = lerp(f.y0, f.y1, e) - Math.sin(e * Math.PI) * 40;
      if (f.res) {
        icon(ctx, f.res, x, y, 16);   // a log or a stone from the backpack into the pad
        continue;
      }
      ctx.fillStyle = '#ffd34a';
      ctx.beginPath();
      ctx.arc(x, y, f.out ? 4 : 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // the thumbstick where the finger is
    if (joy && joy.active && !watch) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(joy.ox, joy.oy, 42, 0, Math.PI * 2);
      ctx.stroke();
      const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy), m = Math.min(1, 42 / Math.max(d, 1));
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(joy.ox + dx * m, joy.oy + dy * m, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    drawHud(ctx, full, now);
    drawShouts(ctx, full, now);
    ui.play = ui.replay = null;
    if (watch && state === 'play') {
      ui.play = { x: full.x + full.w / 2 - 80, y: full.y + full.h - 64, w: 160, h: 44, label: 'Play yourself' };
      button(ctx, ui.play, { color: '#e0893a' });
    }
    if (state === 'over' && !watch) overCard(ctx, full);
    if (choosing()) drawOffer(ctx, full, now);
    if (paused) {   // dimmed, with a big play button to go on
      ctx.fillStyle = 'rgba(10,8,20,0.6)';
      ctx.fillRect(full.x, full.y, full.w, full.h);
      const cx = full.x + full.w / 2, cy = full.y + full.h / 2;
      ctx.fillStyle = 'rgba(224,137,58,0.95)';
      ctx.beginPath();
      ctx.arc(cx, cy, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy - 22);
      ctx.lineTo(cx + 24, cy);
      ctx.lineTo(cx - 14, cy + 22);
      ctx.closePath();
      ctx.fill();
    }
  }

  // what a dawn choice adds, as a number: +15% for a share, +20 for an amount
  function perkText(id) {
    const v = cardValue(world, id);
    if (BAL.tools.includes(id)) return '';   // a tool: its picture and its word say it
    return ['fire', 'haggle', 'pockets', 'sparks'].includes(id) ? `+${Math.round(v * 10) / 10}` : `+${Math.round(v * 100)}%`;
  }
  // every card the same way: one object, the same size, and a corner badge for the kind of help (Oleg: icon consistency) -
  // green arrow: more of it; blue: slows them; red: burns them; gold coin: coins; gold star: a new tool
  const CARD = {
    arrows: ['tower', 'badge-up'], frost: ['tower', 'badge-frost'], fire: ['fire', 'badge-up'], sparks: ['fire', 'badge-burn'],
    pockets: ['pack', 'badge-up'], speed: ['boot', 'badge-up'], axe: ['axe', 'badge-up'], haggle: ['coal', 'badge-coin'],
    walls: ['wall', 'badge-up'], pickaxe: ['pickaxe', 'badge-new'], hammer: ['hammer', 'badge-new'],
  };
  function perkIcon(ctx, id, x, y, s, badge = true) {
    const [main, mark] = CARD[id] || ['star', null];
    icon(ctx, main, x, y, s * (main === 'pack' ? 0.9 : 1), main === 'coal' ? '#ff8a3a' : undefined);
    if (badge && mark) icon(ctx, mark, x + s * 0.38, y - s * 0.34, s * 0.42);
  }

  // the dawn choice: three cards, each a picture and a number, no words (Leo's playtests: no real choices). Tap or click one,
  // or 1 2 3, or the arrows and Enter
  function drawOffer(ctx, full, now) {
    const k = Math.min(1, offerT / 0.3), touch = matchMedia('(pointer: coarse)').matches;
    ctx.fillStyle = `rgba(10,8,20,${0.6 * k})`;
    ctx.fillRect(full.x, full.y, full.w, full.h);
    // day 1 opens with what to do, in three picture lines, then its power-up (Oleg, 2026-10-23: every new game; the power-up
    // pauses the start anyway, so the lines cost no extra tap). A dawn shows the sun
    const start = world.day === 1 && !world.started, intro = start;
    const cw = Math.min(124, (full.w - 48) / 3), ch = 156, gap = 12, cx = full.x + full.w / 2, cy = full.y + full.h * (intro ? 0.64 : 0.5);
    if (intro) {
      const lines = [[['wood', 'tower'], t('build')], [['coal', 'fire'], t('hint')], [['moon'], t('goal')]];
      const pw = Math.min(full.w - 28, 400), lh = 40, py = cy - ch / 2 - 58 - lines.length * lh;
      ctx.globalAlpha = k;
      rrect(ctx, cx - pw / 2, py - 12, pw, lines.length * lh + 16, 14);
      ctx.fillStyle = 'rgba(40,28,18,0.92)';
      ctx.fill();
      ctx.strokeStyle = '#a77a4a';
      ctx.lineWidth = 2;
      ctx.stroke();
      lines.forEach(([icons, words], i) => {
        const y = py + 8 + i * lh + lh / 2 - 4, x0 = cx - pw / 2 + 16;
        icons.forEach((ic, j) => {   // on a light disc, so dark coal shows on the dark panel
          ctx.fillStyle = 'rgba(255,240,210,0.16)';
          ctx.beginPath();
          ctx.arc(x0 + 14 + j * 30, y, 14, 0, Math.PI * 2);
          ctx.fill();
          icon(ctx, ic, x0 + 14 + j * 30, y, 24, ic === 'coal' ? '#ff8a3a' : undefined);
        });
        ctx.font = '900 16px system-ui, sans-serif';
        const room = pw - 32 - 76, fit = Math.min(16, (16 * room) / Math.max(1, ctx.measureText(words).width));
        text(ctx, words, x0 + 76, y + 1, { size: fit, weight: 900, align: 'left', color: '#fff4d0' });
      });
      ctx.globalAlpha = 1;
    }
    if (start) text(ctx, t('pick'), cx, cy - ch / 2 - 24, { size: 20, weight: 900, color: '#ffe9a8', alpha: k });
    // the mode, under day 1's cards: Normal or Hard (Hard red, with a horned head); a tap starts the run again in it
    ui.modes = [];
    if (start) {
      const py = cy + ch / 2 + 30, pw = Math.min(104, (full.w - 40) / 3);
      ['easy', 'normal', 'hard'].forEach((m, i) => {
        const on = getMode() === m, x = cx + (i - 1) * (pw + 8);
        const r = { x: x - pw / 2, y: py - 17, w: pw, h: 34, m };
        rrect(ctx, r.x, r.y, pw, 34, 17);
        ctx.fillStyle = on ? (m === 'hard' ? 'rgba(170,40,30,0.95)' : 'rgba(80,60,30,0.95)') : 'rgba(30,22,16,0.7)';
        ctx.fill();
        ctx.strokeStyle = on ? '#ffd34a' : 'rgba(255,233,168,0.35)';
        ctx.lineWidth = on ? 3 : 1.5;
        ctx.stroke();
        if (m === 'hard') icon(ctx, 'hollow', r.x + 20, py, 18, '#1a1426');
        text(ctx, t(m), x + (m === 'hard' ? 10 : 0), py + 1, { size: 15, weight: 900, color: on ? '#ffffff' : 'rgba(255,240,210,0.7)' });
        ui.modes.push(r);
      });
    }
    else icon(ctx, 'sun', cx, cy - ch / 2 - 44, 44 * k);
    const n = world.offer.length;
    cards = world.offer.map((id, i) => {
      const pop = Math.min(1, Math.max(0, (offerT - i * 0.08) / 0.25)), s = 0.6 + 0.4 * pop * (1 + 0.08 * Math.sin(pop * Math.PI));
      const x = cx + (i - (n - 1) / 2) * (cw + gap), r = { x: x - cw / 2, y: cy - ch / 2, w: cw, h: ch, id };
      ctx.save();
      ctx.globalAlpha = pop;
      ctx.translate(x, cy);
      ctx.scale(s, s);
      ctx.translate(-x, -cy);
      const on = i === sel && !touch;
      rrect(ctx, r.x, r.y, cw, ch, 14);
      ctx.fillStyle = on ? '#5a3f22' : '#3b2a1a';
      ctx.fill();
      ctx.strokeStyle = on ? '#ffd34a' : '#a77a4a';
      ctx.lineWidth = on ? 4 : 2.5;
      ctx.stroke();
      perkIcon(ctx, id, x, cy - 30 + (on ? Math.sin(now * 0.008) * 3 : 0), 56);
      if (id === 'pickaxe') {   // what the tool opens: coal and stone
        icon(ctx, 'coal', x - 16, cy + 24, 24, '#ff8a3a');
        icon(ctx, 'stone', x + 16, cy + 25, 24);
      } else if (id === 'hammer') icon(ctx, 'tower', x, cy + 24, 26);
      else text(ctx, perkText(id), x, cy + 26, { size: 26, weight: 900, color: '#ffe9a8' });
      const word = t(`card_${id}`);
      ctx.font = '800 13px system-ui, sans-serif';
      const fit = Math.min(13, (13 * (cw - 14)) / Math.max(1, ctx.measureText(word).width));
      text(ctx, word, x, cy + 56, { size: fit, weight: 800, color: '#fff4d0', shadow: false });
      if (!touch) text(ctx, String(i + 1), r.x + 14, r.y + 15, { size: 13, weight: 800, color: 'rgba(255,233,168,0.6)', shadow: false });
      ctx.restore();
      return r;
    });
    // the shop, under the cards from day 1 on (Oleg: where is the shop? show it from the start): a bigger bag (12, 30, 60),
    // the spin after night 3 for 100, the pistol after night 5 for 200. A picture, a word, the price; dim while the coins fall
    // short; one not open yet shows the night it opens after. Buying keeps the cards open
    ui.wares = [];
    const wares = Object.keys(BAL.shop).filter((id) => shopCost(world, id) != null);
    if (wares.length) {
      const wy = cy + ch / 2 + 34 + (start ? 52 : 0), ww = Math.min(150, (full.w - 40 - 10 * (wares.length - 1)) / wares.length);
      wares.forEach((id, i) => {
        const cost = shopCost(world, id), open = world.shop.includes(id), can = open && world.coins >= cost;
        const x = cx + (i - (wares.length - 1) / 2) * (ww + 10), r = { x: x - ww / 2, y: wy - 22, w: ww, h: 44, id };
        ctx.globalAlpha = k * (can ? 1 : open ? 0.6 : 0.4);
        rrect(ctx, r.x, r.y, ww, 44, 12);
        ctx.fillStyle = '#2a3a2a';
        ctx.fill();
        ctx.strokeStyle = can ? '#ffd34a' : 'rgba(255,233,168,0.4)';
        ctx.lineWidth = can ? 2.5 : 1.5;
        ctx.stroke();
        icon(ctx, id === 'bag' ? 'pack' : id, r.x + 22, wy, 28);
        const word = id === 'bag' ? `${t('card_pockets')} +${BAL.carry.perUpgrade}` : t(`card_${id}`);
        ctx.font = '900 13px system-ui, sans-serif';
        const fit = Math.min(13, (13 * (ww - 44 - (touch ? 6 : 20))) / Math.max(1, ctx.measureText(word).width));   // clear of the key's number
        text(ctx, word, r.x + 42, wy - 8, { size: fit, weight: 900, align: 'left', color: '#fff4d0' });
        if (open) {
          icon(ctx, 'coin', r.x + 50, wy + 10, 14);
          text(ctx, String(cost), r.x + 60, wy + 11, { size: 15, weight: 900, align: 'left', color: can ? '#ffd34a' : '#ff8a6a' });
        } else {   // not yet: after night N
          icon(ctx, 'moon', r.x + 50, wy + 10, 15, '#cfd8ff');
          text(ctx, String(BAL.shop[id].after), r.x + 61, wy + 11, { size: 15, weight: 900, align: 'left', color: '#cfd8ff' });
        }
        if (!touch && open) text(ctx, String(i + 4), r.x + ww - 12, r.y + 11, { size: 11, weight: 800, color: 'rgba(255,233,168,0.6)', shadow: false });
        ctx.globalAlpha = 1;
        ui.wares.push(r);
      });
    }
  }

  function pointerDown(p) {
    if (ui.full && hit(ui.full, p)) {   // switched on the lift (pointerUp): a phone allows fullscreen only then
      fullPress = true;
      return;
    }
    if (paused) return setPause(false);   // any tap goes on
    if (ui.pause && hit(ui.pause, p)) return setPause(true);
    if (choosing()) {
      const mp = (ui.modes || []).find((r) => hit(r, p));
      if (mp) {   // day 1's mode pills: a new run in that mode
        if (mp.m !== getMode()) {
          setMode(mp.m);
          start(false);
        }
        return;
      }
      const wr = (ui.wares || []).find((r) => hit(r, p));
      if (wr && offerT > 0.35) return shopBuy(wr.id);
      const i = cards.findIndex((r) => hit(r, p));
      if (i >= 0 && offerT > 0.35) pick(i);
      return;
    }
    if (hit(ui.speed, p)) {
      cycleSpeed();
      return;
    }
    if (ui.spin && hit(ui.spin, p)) {
      spinReq = true;
      begin();
      return;
    }
    if (hit(ui.sound, p)) {
      toggleMute();
      synth.setMuted(isMuted());
      return;
    }
    if (state === 'over' && !watch) {
      if (hit(ui.replay, p)) replay();
      return;
    }
    if (watch) {
      if (hit(ui.play, p)) start(false);
      return;
    }
    begin();
    joy = { ox: p.x, oy: p.y, x: p.x, y: p.y, active: true };
    tap = { x: p.x, y: p.y, t: performance.now() };
  }
  function pointerMove(p) {
    if (choosing()) {
      const i = cards.findIndex((r) => hit(r, p));
      if (i >= 0) sel = i;
      return;
    }
    if (joy) Object.assign(joy, { x: p.x, y: p.y });
    if (joy && Math.hypot(p.x - joy.ox, p.y - joy.oy) > 6) moved0 = true;
  }
  function pointerUp(p) {
    if (fullPress) {
      fullPress = false;
      if (p && ui.full && hit(ui.full, p)) {
        if (stage.canFull) stage.toggleFull();
        else shout(t(stage.ios ? 'full_ios' : 'full_app'), 'tip', '', true);   // no fullscreen here: how to get it
      }
      return;
    }
    // a short press that hardly moved is a tap: walk there
    if (tap && lastView && p && Math.hypot(p.x - tap.x, p.y - tap.y) < 10 && performance.now() - tap.t < 350 && state === 'play') {
      const v = lastView;
      walkTo = { x: v.camX + (p.x - v.cx) / v.z / T, y: v.camY + (p.y - v.cy) / v.z / T, t: 0 };
      fx.push({ x: walkTo.x, y: walkTo.y, vx: 0, vy: 0, life: 0.5, t: 0, color: '#ffffff', size: 0.7, ring: true });
      moved0 = true;
    }
    tap = null;
    joy = null;
  }

  start(watchStart);
  return {
    update, draw, pointerDown, pointerMove, pointerUp,
    debug: () => ({ state, watch, begun, cam, dark, shake, day: world.day, phase: world.phase, started: world.started, coins: world.coins, stack: world.hero.stack.length, fire: Math.round(world.fire.hp), enemies: world.enemies.length, built: world.pads.filter((p) => p.level).map((p) => p.id + p.level), shown: world.pads.filter((p) => padCost(p) != null).map((p) => p.id), hero: [world.hero.x.toFixed(1), world.hero.y.toFixed(1)], target: (() => { const t = target(); return t ? t.id || (t === world.market ? 'market' : t.kind) : null; })() }),
    world: () => world,
  };
}
