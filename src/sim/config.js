// Every balance number in one place (tuned with tools/bots.mjs). Distances are in tiles, times in seconds.
export const BAL = {
  map: { w: 34, h: 34 },
  // daylight, the last `dusk` seconds of it warn that night is coming. Day 1's clock starts only once the first tower is built
  // (expert review: a stranger must never meet a night before the first build); `first` is what is left of it then
  // the first days are longer (early: days 2 to earlyDays; Mia's playtest: night came before a 9-year-old had worked anything out)
  day: { first: 35, length: 42, early: 52, earlyDays: 3, dusk: 8 },
  // the horde comes over spawnSeconds in packs of pack[0] + pack[1] * night from one side each (packs make the leaks that
  // give a night its close calls; one at a time, the towers either held everything or collapsed); dawn needs every enemy dead
  night: { spawnSeconds: 24, minLength: 28, pack: [2, 1], spawnRadius: 12 },
  // respawn: seconds out after falling (Oleg's play: 4 felt like no penalty; the backpack is lost too). regen: health a second
  // beside the fire, within regenReach (Oleg's play)
  // speed 5.2 (Sam's playtest: walking felt slow next to the games kids know)
  // hitScale: the share of a blow the hero takes (Leo's playtest: a pack of five felled him before his health looked low)
  hero: { speed: 5.2, radius: 0.35, hp: 40, dmg: 7, rate: 2.2, reach: 1.3, respawn: 6, regen: 6, regenReach: 2.6, hitScale: 0.45, shield: 2 },   // shield: untouchable this long after coming back (Leo's round 6)   // 0.45 (Leo's round 5: a pack of seven, 80% to nothing in 2 s)
  carry: { start: 12, perUpgrade: 6 },   // one backpack for wood, stone and coal together (Oleg's play)
  // the camp's pile, east of the fire: the hero drops his wood and stone there (they are not for sale: a full bag of them would
  // stall him), woodcutters stack their wood there, and builds take from it when the backpack has none. dropRate: items a second
  woodpile: { x: 21.4, y: 18.8, reach: 1.0, dropRate: 12 },
  harvest: { interval: 0.28, reach: 1.3 },   // a bit slower (Oleg, 2026-10-22; was 0.24)
  // regrow: seconds until a felled tree, an emptied rock or a dug-out coal seam is back (Oleg's play: too fast, the camp's own
  // trees were enough; now the near ones run out and the hero walks further). Coal is the valuable one (Oleg): fewer seams, further
  // out (`count` of them, at least `minDist` from the fire)
  nodes: {
    tree: { items: 5, res: 'wood', regrow: 80 },
    rock: { items: 4, res: 'stone', regrow: 110 },
    coal: { items: 3, res: 'coal', regrow: 75, count: 10, minDist: 9 },
  },
  // the merchant is a coal merchant (Oleg): he buys coal only, `price` coins a lump, `sellRate` lumps a second while the hero
  // stands at his cart (so stepping away keeps the rest for the fire). Wood and stone are for building only
  price: { coal: 4 },
  sellRate: 6,   // lumps a second (Oleg: 2.5 was too slow; the stop needed before selling keeps a walk-through from selling)
  payRate: 30,           // wood, stone or coins a second into a pad
  payDelay: 0.45,        // standing on a pad this long before paying starts (walking across one costs nothing)
  payDelayBig: 1.5,      // ... on one asking payBigFrom coins or more (Leo's rounds 6 and 7: walking onto spots cost him 8-69 coins)
  payBigFrom: 40,
  sellReach: 1.3,        // how near the cart's spot he stands to sell (1.05 was missed again and again: round 10)        // (the woodcutter's house, 40, sits by the fire where he passes all the time)
  startCoins: 6,         // with 6 wood from the first trees, the first tower (the tutorial's goal)
  coinMagnet: 3.2,
  // the fire burns down by itself (`burn` a second, from the first build on; Oleg's play: coal only matters if the fire needs
  // it), nothing heals it at dawn. It cannot drop below floorHp on the first floorNights nights (night 1 unlosable). hitScale:
  // an enemy at the fire does this share of its damage
  // hitScale 0.4 (was 0.6: eight monsters at the fire took it from 100 to 0 in 6 s, no time to answer the alarm). By day it
  // burns slower, `burnDay` (Dana's playtest: the fire was red at the start of every day from day 4, never a calm moment)
  fire: { hp: 120, burn: 0.4, burnDay: 0.2, dawnHeal: 0, floorNights: 1, floorHp: 30, hitScale: 0.4 },
  // coal: the fire's fuel. A Hollow drops a lump with chance `hollow`, a Brute with chance `brute` (Oleg's play: too many
  // drops). It goes into the backpack (walk over it), and into the fire beside it, each lump healing `heal`
  // feedReach: anywhere by the fire (a bot stood 1.96 from it with 5 lumps, outside the old 1.8, and the fire went out)
  // coal is both the fire's fuel and the coins to build with (Oleg): burn it or sell it
  // keep: lumps the merchant leaves in the bag at night or while the fire is under half (round 8: all three sold every lump,
  // then lost the fire with none to feed it)
  coal: { hollow: 0.25, brute: 1, runner: 0.25, heal: 10, pickReach: 0.85, feedReach: 2.4, feedInterval: 0.3, keep: 2 },
  // dawn: a night held pays coins[0] + coins[1] x its number, doubled when the fire took no hit (a perfect night). Kills and
  // dawns paid 87% of the coins in v0.7 and they piled up unspent (Mia's playtest: 183 coins on day 6, nothing to buy), so
  // coal is now the main income: kills drop 0-1 coin and coal more often, dawns pay less, a lump sells for 4
  dawn: { coins: [3, 1] },
  goal: 10,   // nights for the victory; the run goes on after it
  // a choice at dawn from day `from` on: three of these, the player takes one, any can come again (Leo's playtests: no real
  // choices, the ring decided everything). What one pick adds: towers' damage (share), the fire's size, the hero's speed and
  // blow (shares), coins for a lump of coal, backpack room, coal from kills (chance), gathering speed and walls (shares)
  // and three that change how a night goes (Leo's round 4: the cards repeated and changed nothing): arrows slow what they hit
  // (share of its speed), the fire burns what touches it (damage a second), the fire heals the hero faster (share). A card
  // offered at one dawn is not offered at the next
  // Oleg's review (2026-10-22: icon consistency and usefulness): the three weakest (more loot, faster gathering, a warm fire)
  // are gone and the rest are stronger
  // a power-up a day (Oleg, 2026-10-23): one at the start of day 1 (the pickaxe and two of `first`, the early helps), then one
  // at every dawn
  perks: { from: 2, first: ['fire', 'speed', 'pockets', 'haggle', 'axe'], list: { arrows: 0.25, frost: 0.4, fire: 30, sparks: 6, pockets: 6, speed: 0.12, axe: 0.4, haggle: 1, walls: 0.4 } },
  // tools (Oleg, 2026-10-22): the hero has an axe for trees; a pickaxe for rocks and coal and a hammer for upgrades (towers and
  // walls past their first level) come from dawn cards: the pickaxe alone at the first dawn (coal is the money and the fuel),
  // the hammer first once an upgrade is open
  tools: ['pickaxe', 'hammer'],
  // the spin: a blow all round for `dmg` times the hero's, then `cooldown` seconds to recharge; it throws them back `knock`
  // (Leo's playtests, rounds 2-4: at night he only stood and watched)
  spin: { dmg: 2, reach: 1.7, cooldown: 10, knock: 1.2 },   // weaker (Oleg, 2026-10-23: was 3x, 7 s)
  // variant B: the first time the fire dies it relights at this share of its health, the player keeps this share of the coins,
  // and the flare clears the night
  relight: { hp: 0.4, keepCoins: 0.5 },
  // building costs per level as [wood, stone, coins] (Oleg's play: part wood, part stone, part coin)
  // prices for a game whose coins come mostly from coal (4 a lump), then dawn rewards and a few from kills
  // the second level takes wood, not stone, so the hammer comes first (day 3) and the pickaxe later (stone walls, third levels)
  tower: { cost: [[6, 0, 6], [12, 0, 15], [16, 16, 33]], range: [5.5, 6, 6.5],   // 5.5: a corner tower reaches the far side of the fire
           dmg: [5, 8, 12], rate: [1.2, 1.5, 1.9],
           // a Giant inside the ring smashes the towers within `smash` of it (Oleg: broken towers need a repair); hp by level
           hp: [60, 110, 170], smash: 4 },
  // a palisade, then stone. The ring closes with its corners (Oleg's play: with open corners the horde walked round the walls and
  // never hit one); now it has to break through, under the towers' fire. A fallen piece is built again
  // A broken wall is rubble till it is repaired (Oleg: broken walls and towers need a repair, by day or by night; it used to
  // stand again at dawn by itself): the horde climbs through it slowly (rubbleSlow of its speed;
  // rubbleCost on its way), one by one under the towers. (A wall that simply fell let every pack walk round the ring to the one
  // gap and rush the fire together: bots lost 76 fire in 4 s, and runs ended 3 nights sooner than with no corners at all.)
  // a palisade takes coins too (Sam's playtest: walls cost only wood, so wood held everything up while 70-130 coins piled up)
  wall: { cost: [[6, 0, 3], [0, 6, 8]], hp: [70, 180], rubbleSlow: 0.35, rubbleCost: 4 },
  // a repair costs this share of what its level cost to build, all in coins (rounded up), paid on its spot like a build
  repair: 0.5,
  // the woodcutter's hut: each level hires one more woodcutter (Oleg's play: he did not see where the worker came from). By
  // day they chop wood and stack it on the camp's woodpile (the merchant buys no wood); at night they fight Hollows near the
  // fire, weakly (dmg, rate, reach; within `guard` of it)
  helper: { cost: [[0, 0, 40], [0, 0, 80], [0, 0, 140]], speed: 3.1, carry: 6, interval: 0.55, dmg: 3, rate: 1.2, reach: 1.2, guard: 3.6 },
  enemy: {
    hollow: { hp: 10, perNight: 2, speed: 1.35, dmg: 5, rate: 1, radius: 0.32, coins: [0, 1] },
    // a Brute every `every` nights: the first on night 3 is the first scare (bots: the fire dips to about 98 of 120)
    brute: { hp: 60, perNight: 20, speed: 0.85, dmg: 18, rate: 0.7, radius: 0.55, coins: [6, 8], every: 3 },
    // Hard's ember thief: fast and frail, leaps the walls and runs straight for the fire
    runner: { hp: 8, perNight: 2, speed: 2.7, dmg: 6, rate: 1.2, radius: 0.28, coins: [0, 1] },
  },
  // Hard (Oleg, 2026-10-23: night 10 with almost no effort): 1.5 times the horde, two packs at once from night `twinFrom`, a giant
  // every second night from night `giantsFrom` too, ember thieves from night `thievesFrom` (half the night's number of them), a
  // fire of `fireMax` that burns `burnNight` a second by night and takes `fireHit` times a blow, coal for `coalPrice`, and cards at
  // `cards` of their help (the backpack's room and the coal price stay whole)
  // three modes (Oleg, 2026-10-23: the first two were really easy and normal; add a hard one): easy is the old normal, normal
  // the old hard, hard harder still (2x the horde and a little faster, all from night 4, thieves from night 2)
  modes: {
    easy: { horde: 1, twinFrom: 99, giantsFrom: 99, thievesFrom: 99, thiefShare: 0, fireMax: 120, burnNight: 0.4, fireHit: 1, coalPrice: 4, cards: 1, speed: 1 },
    normal: { horde: 1.5, twinFrom: 5, giantsFrom: 6, thievesFrom: 3, thiefShare: 0.5, fireMax: 100, burnNight: 0.55, fireHit: 1.5, coalPrice: 3, cards: 0.7, speed: 1 },
    hard: { horde: 1.7, twinFrom: 5, giantsFrom: 5, thievesFrom: 3, thiefShare: 0.65, fireMax: 95, burnNight: 0.6, fireHit: 1.65, coalPrice: 3, cards: 0.6, speed: 1.06 },
  },
  // for sale on the dawn screen, beside the free cards, and on day 1's (Oleg): from the dawn after night `after`, for `cost`
  // coins. The bag is bought there three times, bigger each time (Oleg's phone test: 12 coins paid on a spot in the camp seemed
  // to build nothing; a bag is bought, like the pistol)
  shop: { bag: { cost: [12, 30, 60], after: 0 }, spin: { cost: 100, after: 3 }, pistol: { cost: 200, after: 5 } },
  // the pistol: shoots what is out of the axe's reach, `rate` a second, up to `range`
  pistol: { range: 5.5, rate: 1.1, dmg: 10, speed: 22 },
};

// the horde of night n
// after night 5 the horde grows faster: the dawn cards and the spin made a careful player too strong for the old curve (bots
// held all 15 nights), while nights 1-5 stay where the younger and casual testers were already stretched
export const wave = (n, m = BAL.modes.easy) => {
  const hollows = 4 + Math.round(n * 2.2 + n * n * 0.2 + Math.max(0, n - 5) ** 2 * 0.5), brutes = n % BAL.enemy.brute.every === 0 ? n / BAL.enemy.brute.every : 0;
  return { hollows: Math.round(hollows * m.horde), brutes: brutes + (n >= m.giantsFrom && n % 2 === 0 ? 1 : 0), runners: n >= m.thievesFrom ? Math.floor(n * m.thiefShare) : 0 };
};
// a world's mode's numbers
export const modeOf = (w) => BAL.modes[w.mode] || BAL.modes.easy;

// One new thing at a time (Oleg, after playing Zombit: too much at once; the ads he liked start simple and build up). Each
// step's pads appear once everything in the step before is built and the step's day has come; [pad, level] opens that level.
// Mostly the purchase opens the next step (always one thing to save for); the day gates hold back the bigger ideas. An optional
// step opens on its day whatever the chain does and never holds it back (stone walls held back the towers: bots spent nights
// 5-9 on 80 stone of walls with 500 coins and no tower to buy; and an optional step behind a step not yet done never opened).
export const UNLOCKS = [
  { day: 1, pads: [['tower-sw', 1]] },                       // the tutorial's goal: 6 wood and the 6 coins the game starts with
  { day: 1, pads: [['tower-ne', 1]] },
  { day: 2, pads: [['wall-n', 1], ['wall-s', 1], ['wall-w', 1], ['wall-e', 1]] },
  // the corners right after the sides (they waited behind the stone upgrade, so most players had a ring with four holes until
  // day 5-6 and found the walls useless: Dana's and Leo's playtests)
  { day: 2, pads: [['wall-nw', 1], ['wall-ne', 1], ['wall-sw', 1], ['wall-se', 1]] },   // the corners close the ring
  { day: 3, pads: [['tower-sw', 2]] },                       // upgrades: the first that needs stone
  { day: 3, pads: [['hut-wood', 1]] },                       // the woodcutter's hut (each helper has a house of his own: Oleg)
  { day: 3, pads: [['tower-ne', 2]] },
  { day: 4, pads: [['tower-nw', 1], ['tower-se', 1]] },
  { day: 5, pads: [['hut-stone', 1]] },                      // the stone miner's hut
  { day: 5, pads: [['tower-nw', 2], ['tower-se', 2]] },
  { day: 5, pads: [['wall-n', 2], ['wall-s', 2], ['wall-w', 2], ['wall-e', 2]], optional: true },   // stone walls
  { day: 6, pads: [['tower-sw', 3], ['tower-ne', 3]] },
  { day: 6, pads: [['wall-nw', 2], ['wall-ne', 2], ['wall-sw', 2], ['wall-se', 2]], optional: true },
  { day: 7, pads: [['hut-coal', 1]] },                       // the coal miner's hut
  { day: 7, pads: [['tower-nw', 3], ['tower-se', 3]] },
];
