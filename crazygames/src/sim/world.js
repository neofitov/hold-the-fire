// A new run: the map, the camp in the middle (campfire, market, build pads), trees and rocks around it, the hero at the fire.
// Positions are in tiles (x right, y down); an object at (x, y) stands on tile (floor x, floor y).
import { BAL, UNLOCKS } from './config.js';
import { rng } from '../lib/rng.js';

export const C = { x: 17.5, y: 17.5 };   // the campfire, the centre of the map
// where the hero starts, comes back after falling, and waits at night: beside the fire, clear of the booth
export const HOME = { x: C.x + 1.6, y: C.y + 0.5 };

// the palisade ring: four sides (5 tiles each), then four corners (5 tiles each, an L) that close it
const WALLS = [
  { id: 'wall-n', tiles: [[15, 12], [16, 12], [17, 12], [18, 12], [19, 12]] },
  { id: 'wall-s', tiles: [[15, 22], [16, 22], [17, 22], [18, 22], [19, 22]] },
  { id: 'wall-w', tiles: [[12, 15], [12, 16], [12, 17], [12, 18], [12, 19]] },
  { id: 'wall-e', tiles: [[22, 15], [22, 16], [22, 17], [22, 18], [22, 19]] },
  { id: 'wall-nw', tiles: [[12, 12], [13, 12], [14, 12], [12, 13], [12, 14]], corner: true },
  { id: 'wall-ne', tiles: [[20, 12], [21, 12], [22, 12], [22, 13], [22, 14]], corner: true },
  { id: 'wall-sw', tiles: [[12, 20], [12, 21], [12, 22], [13, 22], [14, 22]], corner: true },
  { id: 'wall-se', tiles: [[22, 20], [22, 21], [22, 22], [20, 22], [21, 22]], corner: true },
];

// opts.relight: variant B, the fire relights once
export function createWorld(seed = 1, opts = {}) {
  const r = rng(seed);
  const { w, h } = BAL.map;
  const pads = [
    // towers inside the camp's corners: they cover the open corners and the fire (first bot runs: towers out at the corners
    // could not reach the fire, 5.7 tiles away)
    { id: 'tower-nw', kind: 'tower', x: C.x - 3, y: C.y - 3 },
    { id: 'tower-se', kind: 'tower', x: C.x + 3, y: C.y + 3 },
    { id: 'tower-ne', kind: 'tower', x: C.x + 3, y: C.y - 3 },
    { id: 'tower-sw', kind: 'tower', x: C.x - 3, y: C.y + 3 },
    ...WALLS.map((wl) => {
      // the pad sits on the wall line (first bot runs: a pad just inside the south wall sat next to the market, and selling
      // there paid into the wall)
      // a corner's pad stands on its corner tile, inside the ring's light
      const cx = wl.corner ? wl.tiles[0][0] + (wl.tiles[0][0] < C.x ? 1.2 : -0.2) : wl.tiles.reduce((a, t) => a + t[0], 0) / wl.tiles.length + 0.5;
      const cy = wl.corner ? wl.tiles[0][1] + (wl.tiles[0][1] < C.y ? 1.2 : -0.2) : wl.tiles.reduce((a, t) => a + t[1], 0) / wl.tiles.length + 0.5;
      return { id: wl.id, kind: 'wall', x: cx, y: cy, tiles: wl.tiles };
    }),
    // a house for each helper (Oleg): the woodcutter east of the fire, the stone and the coal miners north of it, between the towers
    { id: 'hut-wood', kind: 'helper', job: 'wood', costs: [[0, 0, 40]], x: C.x + 2.6, y: C.y - 0.6 },
    { id: 'hut-stone', kind: 'helper', job: 'stone', costs: [[0, 0, 80]], x: C.x - 1.5, y: C.y - 3 },
    { id: 'hut-coal', kind: 'helper', job: 'coal', costs: [[0, 0, 140]], x: C.x + 1.5, y: C.y - 3 },
  ].map((p) => ({ ...p, level: 0, cap: 0, paid: unpaid(), hp: 0, maxHp: 0, cooldown: 0 }));   // cap: the highest level unlocked (0: hidden)

  // trees in the north and west, rocks in the south and east, none close to the camp
  const nodes = [];
  const free = (x, y, d) => nodes.every((n) => (n.x - x) ** 2 + (n.y - y) ** 2 >= d * d);
  for (let tries = 0; nodes.length < 54 && tries < 4000; tries++) {
    const x = 1.5 + r.int(w - 3), y = 1.5 + r.int(h - 3), dc = Math.hypot(x - C.x, y - C.y);
    if (dc < 7.3 || !free(x, y, 1.6)) continue;   // clear of the wall pads (5 tiles out)
    const rocky = (x - C.x) + (y - C.y) * 1.3 > 4 + r.next() * 6;   // south-east leans rocky
    const kind = rocky ? 'rock' : 'tree';
    if (kind === 'rock' && nodes.filter((n) => n.kind === 'rock').length >= 18) continue;
    nodes.push({ kind, x, y, items: BAL.nodes[kind].items, regrow: 0, look: r.int(3) });
  }
  // coal seams: few, far out, all round (the valuable one)
  for (let tries = 0, n = 0; n < BAL.nodes.coal.count && tries < 4000; tries++) {
    const x = 1.5 + r.int(w - 3), y = 1.5 + r.int(h - 3);
    if (Math.hypot(x - C.x, y - C.y) < BAL.nodes.coal.minDist || !free(x, y, 1.8)) continue;
    nodes.push({ kind: 'coal', x, y, items: BAL.nodes.coal.items, regrow: 0, look: r.int(3) });
    n++;
  }

  const world = {
    seed, r, t: 0, phase: 'day', phaseT: 0, day: 1, over: false,
    started: false,                               // the first build starts day 1's clock
    unlocked: -1, fresh: [], opened: [],          // the chain's last step shown; its pads (the newest thing); optional steps opened
    relightLeft: opts.relight ? 1 : 0,
    mode: BAL.modes[opts.mode] ? opts.mode : 'easy',   // easy, normal or hard (BAL.modes)
    owned: { bag: 0, spin: false, pistol: false }, shop: ['bag'],   // bought at dawn (bags: how many); on sale now
    nightHits: 0, won: false,                     // hits on the fire this night (none: a perfect night); the goal reached
    dayLength: BAL.day.first,
    coins: BAL.startCoins, earned: 0, kills: 0,
    fire: { x: C.x, y: C.y, hp: (BAL.modes[opts.mode] || BAL.modes.easy).fireMax, max: (BAL.modes[opts.mode] || BAL.modes.easy).fireMax },
    // where the hero stands to sell: in front of (south of) the merchant's booth, so the hero is drawn in front of it
    market: { x: C.x, y: C.y + 3.8 },
    // tiles the horde walks round: the merchant's cart (Oleg: monsters seemed to die inside the booth; they walked through it,
    // hidden behind its counter, and the towers shot them there)
    solid: [[16, 20], [17, 20], [18, 20]],
    stock: { wood: 0, stone: 0 },                 // the camp's pile: wood and stone dropped there; builds take from it
    perks: {}, offer: null, lastOffer: [],        // the dawn choices taken (id: times); the three on offer; the last three
    tools: { pickaxe: false, hammer: false },     // from dawn cards: rocks need the pickaxe, upgrades the hammer
    // stack: the backpack, 'wood', 'stone' and 'coal' together up to cap
    hero: { x: HOME.x, y: HOME.y, hp: BAL.hero.hp, dead: 0, stack: [], cap: BAL.carry.start, feedT: 0, harvestT: 0, attackT: 0, spinT: 0, shotT: 0, shield: 0, sellAcc: 0, pad: null, padT: 0, face: 1, moving: false },
    helpers: [],
    pads, nodes,
    enemies: [], arrows: [], coinsOnGround: [], coalOnGround: [],
    spawnQueue: [],
    flow: null, flowDirty: true,
    events: [],                                   // for sound and effects; the screen empties it every frame
  };
  unlock(world);
  // day 1 starts with a power-up to pick (Oleg, 2026-10-23): the hammer (every building needs it), the pickaxe (coal and rocks)
  // and an early help; one to take
  world.offer = world.lastOffer = ['hammer', 'pickaxe', r.pick(BAL.perks.first)];
  return world;
}

const padById = (w, id) => w.pads.find((p) => p.id === id);

const CHAIN = UNLOCKS.filter((u) => !u.optional), OPTIONAL = UNLOCKS.filter((u) => u.optional);
const open = (w, step) => {
  for (const [id, lvl] of step.pads) {
    const p = padById(w, id);
    p.cap = Math.max(p.cap, lvl);
  }
  w.fresh = step.pads.map(([id]) => id);
  w.events.push({ type: 'unlock', pads: w.fresh });
};

// the chain: its next step appears once everything in the last one is built and its day has come (a wall counts once it stood,
// even if the horde broke it since: a fallen wall froze every unlock after it). Optional steps open on their day
export function unlock(w) {
  OPTIONAL.forEach((step, i) => {
    if (step.day <= w.day && !w.opened.includes(i)) {
      w.opened.push(i);
      open(w, step);
    }
  });
  for (;;) {
    const cur = CHAIN[w.unlocked], next = CHAIN[w.unlocked + 1];
    if (!next || next.day > w.day) return;
    // a step waiting for a tool not yet had (the hammer for an upgrade, the pickaxe for stone) holds nothing back
    const waits = ([id, lvl]) => {
      const p = padById(w, id);
      if (Math.max(p.level, p.best || 0) >= lvl) return false;
      const c = BAL[p.kind]?.cost?.[lvl - 1];
      return !(c && c[1] > 0 && !w.tools.pickaxe);   // waiting for the hammer holds the rest (nothing else could be built either)
    };
    if (cur && cur.pads.some(waits)) return;
    w.unlocked++;
    open(w, next);
  }
}

export const unpaid = () => ({ wood: 0, stone: 0, coins: 0 });

// the next level's price as { wood, stone, coins }; null: fully built, or the next level is still locked
export const padCost = (p) => {
  const c = p.costs || BAL[p.kind].cost;
  // a broken wall or tower: its repair, in coins only (it can be done by night, with no wood or stone in the bag)
  if (p.broken) return { wood: 0, stone: 0, coins: Math.ceil(c[p.level - 1].reduce((a, n) => a + n, 0) * BAL.repair) };
  if (p.level >= Math.min(c.length, p.cap)) return null;
  const [wood, stone, coins] = c[p.level];
  return { wood, stone, coins };
};
// what is still missing of that price
export const padNeed = (p) => {
  const c = padCost(p);
  return c && { wood: c.wood - p.paid.wood, stone: c.stone - p.paid.stone, coins: c.coins - p.paid.coins };
};
export const total = (o) => o.wood + o.stone + o.coins;
export const count = (stack, res) => stack.reduce((a, r) => a + (r === res), 0);

// a standing wall on that tile (rubble does not stand); rubbleAt: a broken one
export const wallAt = (world, tx, ty) => world.pads.find((p) => p.kind === 'wall' && p.level > 0 && !p.broken && p.tiles.some(([x, y]) => x === tx && y === ty));
export const rubbleAt = (world, tx, ty) => world.pads.find((p) => p.kind === 'wall' && p.level > 0 && p.broken && p.tiles.some(([x, y]) => x === tx && y === ty));
