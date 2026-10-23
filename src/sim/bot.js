// Bot players for tests, balance and the watch mode. 'plan' gathers what the next purchase needs, mines coal and sells it to
// the coal merchant for coins, buys everything in the order it unlocks, fetches coal and defends the fire at night; 'novice'
// buys everything too but walks slower and never fights (a stand-in for a stranger's first run); 'lazy' only buys the first
// three things and does not fight; 'one' buys only the first tower; 'idle' stands still. All but 'idle' feed the fire the coal
// they carry when it has room for a lump (the fire burns down by itself: a player who never fed it would not last).
import { C, HOME, padNeed, count } from './world.js';
import { nearestNode, padReach, needsHammer, shopCost } from './step.js';
import { BAL, UNLOCKS } from './config.js';

// the steps in order, the optional ones (stone walls) after the rest
export const PLAN = [...UNLOCKS.filter((u) => !u.optional), ...UNLOCKS.filter((u) => u.optional)].flatMap((u) => u.pads);
const LAZY = PLAN.slice(0, 3), ONE = PLAN.slice(0, 1);

const pad = (w, id) => w.pads.find((p) => p.id === id);

// the dawn choice bots take: the first of these on offer
const PERKS = ['arrows', 'fire', 'haggle', 'walls', 'frost', 'sparks', 'pockets', 'axe', 'speed'];
export const botPerk = (w) => ['hammer', 'pickaxe', ...PERKS].find((id) => w.offer.includes(id));
// what a bot buys in the shop at a dawn: the spin and the pistol once it has the coins; a bag from the days the bag's spot in
// the camp used to open (1, 3, 7), and only with the next build's coins still in hand (bags bought first thing at dawn held
// back the day's towers: Normal novices fell from 8 nights to 5)
const BAG_DAYS = [1, 3, 7];
export const botShop = (w) => w.shop.filter((id) => {
  if (id !== 'bag') return true;
  const next = nextBuild(w);
  return w.day >= BAG_DAYS[w.owned.bag] && w.coins >= shopCost(w, 'bag') + (next ? padNeed(next).coins : 0);
});
// a pad the bot cannot build yet: an upgrade without the hammer, or stone it has no pickaxe for
const blocked = (w, p) => needsHammer(w, p) || (!w.tools.pickaxe && padNeed(p).stone > w.stock.stone + count(w.hero.stack, 'stone'));

// a repair first (Oleg: broken walls and towers wait for one), then the first purchase on the list that is unlocked and not yet
// built
export function nextBuild(w, plan = PLAN) {
  const broken = w.pads.find((p) => p.broken && !blocked(w, p));
  if (broken) return broken;
  for (const [id, lvl] of plan) {
    const p = pad(w, id);
    if (p.level < lvl && p.cap >= lvl && !blocked(w, p)) return p;
  }
  return null;
}

// the planning bot spins when two or more are in reach
export function botInput(w, mode = 'plan', mem = {}) {
  const out = botMove(w, mode, mem), h = w.hero;
  if (mode === 'plan' && !h.dead && h.spinT <= 0 && w.owned.spin && w.enemies.filter((e) => !e.dead && Math.hypot(e.x - h.x, e.y - h.y) - e.radius < BAL.spin.reach).length >= 2) out.spin = true;
  return out;
}

function botMove(w, mode, mem) {
  const h = w.hero;
  if (h.dead || mode === 'idle') return { x: 0, y: 0 };
  let goal = null, stop = 0.25;
  const coal = count(h.stack, 'coal');
  // the fire first: carry coal to it when it has room for a lump
  if (coal > 0 && w.fire.hp < w.fire.max - BAL.coal.heal) { goal = HOME; stop = 0.4; }
  if (!goal && mode === 'plan' && h.stack.length < h.cap) {
    // coal on the ground: near the camp at night, near the hero by day
    let c = null, cd = w.phase === 'night' ? 6 : 4;
    for (const o of w.coalOnGround) {
      const d = w.phase === 'night' ? Math.hypot(o.x - C.x, o.y - C.y) : Math.hypot(o.x - h.x, o.y - h.y);
      if (d < cd && !w.enemies.some((e) => Math.hypot(e.x - o.x, e.y - o.y) < 1.5)) { cd = d; c = o; }
    }
    if (c) { goal = c; stop = 0.3; }
  }
  if (w.phase === 'night' && mode === 'plan') {
    // defend: the enemy nearest the fire, if it is inside the camp's reach
    let e = null, ed = 7;
    for (const o of w.enemies) {
      const d = Math.hypot(o.x - C.x, o.y - C.y);
      if (d < ed) { ed = d; e = o; }
    }
    if (e && (!goal || ed < 3)) { goal = e; stop = 0.9; }
  }
  if (!goal) {
    const next = nextBuild(w, mode === 'plan' || mode === 'novice' ? PLAN : mode === 'lazy' ? LAZY : ONE);
    const need = next ? padNeed(next) : null;
    const wood = count(h.stack, 'wood') + w.stock.wood, stone = count(h.stack, 'stone') + w.stock.stone;
    const full = h.stack.length >= h.cap, dayLeft = w.phase === 'day' && w.started ? w.dayLength - w.phaseT : Infinity;
    const brings = need && ((need.wood > 0 && count(h.stack, 'wood') > 0) || (need.stone > 0 && count(h.stack, 'stone') > 0));
    const hasAll = need && wood >= need.wood && stone >= need.stone;
    const coinsShort = need && w.coins < need.coins;
    // stop well inside the pad's paying reach (the bot used to park 0.95 from a built backpack, which paid within 0.8)
    const toPad = () => { goal = next; stop = next.level === 0 ? 0.15 : padReach(next) - 0.55; };
    if (need && hasAll && !coinsShort) toPad();                                           // everything it needs: build it
    else if (brings && (full || hasAll)) toPad();                                          // drop off the wood and stone it needs
    else if (coal > 0 && (coinsShort || full || (dayLeft < 7 && coinsShort))) { goal = w.market; stop = 0.6; }   // sell coal
    else if (full) { goal = BAL.woodpile; stop = 0.5; }                                    // a bag of spare wood and stone: the pile
    else if (w.phase === 'night') { goal = HOME; stop = 0.4; }
    else {
      // gather what the purchase lacks (stone first, it is further); coins come from coal; a low fire and no coal: coal too
      const lowFire = w.fire.hp < w.fire.max * 0.6 && coal === 0;
      const kind = lowFire || coinsShort ? 'coal' : need && need.stone > stone ? 'rock' : need && need.wood > wood ? 'tree' : 'coal';
      goal = nearestNode(w, h, kind) || nearestNode(w, h);
      stop = BAL.harvest.reach - 0.15;
    }
  }
  if (!goal) return { x: 0, y: 0 };
  // on the pad it is heading for: stop, so it pays (paying needs the hero to stand still; round a solid tower the bot could
  // never get as close as its stop distance and circled it for good)
  if (goal === h.pad) return { x: 0, y: 0 };
  const dx = goal.x - h.x, dy = goal.y - h.y, d = Math.hypot(dx, dy);
  if (d <= stop) return { x: 0, y: 0 };
  // a trunk or a tower in the way: sidestep for a moment, to the other side each time (always the same side pinned a bot
  // against the first tower for a whole run)
  const moved = mem.last ? Math.hypot(h.x - mem.last.x, h.y - mem.last.y) : 1;
  mem.last = { x: h.x, y: h.y };
  mem.stuck = moved < 0.01 ? (mem.stuck || 0) + 1 : 0;
  if (mem.stuck > 20) {
    mem.side = 30;
    mem.sideDir = -(mem.sideDir || -1);
  }
  if (mem.side > 0) {
    mem.side--;
    return { x: (-dy / d) * mem.sideDir, y: (dx / d) * mem.sideDir };
  }
  const k = mode === 'novice' ? 0.7 : 1;
  return { x: (dx / d) * k, y: (dy / d) * k };
}
