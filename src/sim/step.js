// One fixed step of the game: day and night, the hero (walk, gather, sell, pay into pads, fight), helpers, the horde, towers,
// arrows and coins. Pure: the screen reads the world and the events, tests and bots drive it headless.
import { BAL, wave, modeOf } from './config.js';
import { C, HOME, padCost, padNeed, total, count, unpaid, wallAt, rubbleAt, unlock } from './world.js';
import { buildFlow, nextTile } from './flow.js';

export const DT = 1 / 60;
// every building needs the hammer (Oleg, 2026-10-23: towers built by hand looked wrong)
export const needsHammer = (w) => !w.tools.hammer;
// what the dawn choices taken so far add to `id` (BAL.perks)
// a card's help: weaker in Hard, but the backpack's room and the coal price stay whole numbers
const cardScale = (w, id) => (id !== 'pockets' && id !== 'haggle' ? modeOf(w).cards : 1);
export const perk = (w, id) => (w.perks[id] || 0) * (BAL.perks.list[id] || 0) * cardScale(w, id);
export const cardValue = (w, id) => (BAL.perks.list[id] || 0) * cardScale(w, id);
// what the merchant pays for a lump of coal
export const coalPrice = (w) => modeOf(w).coalPrice + perk(w, 'haggle');
const ev = (w, type, data = {}) => w.events.push({ type, ...data });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function step(w, input, dt = DT) {
  if (w.over) return;
  w.t += dt;
  if (w.started || w.day > 1) w.phaseT += dt;   // day 1 waits for the first build
  if (w.flowDirty || !w.flow) buildFlow(w);
  phases(w);
  fire(w, dt);
  hero(w, input, dt);
  helpers(w, dt);
  spawns(w);
  enemies(w, dt);
  towers(w, dt);
  arrows(w, dt);
  coins(w, dt);
  regrow(w, dt);
}

function phases(w) {
  if (w.phase === 'day') {
    // dusk: the night is planned now, so the screen can show where its packs will come from (and whether a Brute comes)
    if (!w.duskWarned && w.phaseT >= w.dayLength - BAL.day.dusk) {
      w.duskWarned = true;
      planNight(w);
      ev(w, 'dusk', { night: w.day, packs: w.packs, brute: wave(w.day, modeOf(w)).brutes > 0 });
    }
    if (w.phaseT < w.dayLength) return;
    w.phase = 'night';
    w.phaseT = 0;
    w.duskWarned = false;
    if (!w.planned) planNight(w);
    w.planned = false;
    w.nightHits = 0;
    ev(w, 'night', { night: w.day, count: w.spawnQueue.length });
  } else if (w.phaseT >= BAL.night.minLength && !w.spawnQueue.length && !w.enemies.length) {
    w.phase = 'day';
    w.phaseT = 0;
    w.day++;
    w.dayLength = w.day <= BAL.day.earlyDays ? BAL.day.early : BAL.day.length;
    w.fire.hp = Math.min(w.fire.max, w.fire.hp + BAL.fire.dawnHeal);
    // what stands is mended by dawn; what broke waits for its repair (Oleg)
    for (const p of w.pads) if ((p.kind === 'wall' || p.kind === 'tower') && p.level > 0 && !p.broken) p.hp = p.maxHp;
    w.flowDirty = true;
    // a night held pays; a perfect night (the fire untouched) pays double
    const held = w.day - 1, perfect = w.nightHits === 0, reward = (BAL.dawn.coins[0] + BAL.dawn.coins[1] * held) * (perfect ? 2 : 1);
    w.coins += reward;
    w.earned += reward;
    ev(w, 'dawn', { day: w.day, held, reward, perfect });
    if (held === BAL.goal && !w.won) {
      w.won = true;
      ev(w, 'victory', { nights: held });
    }
    unlock(w);
    // a choice at every dawn: three, one to take (the screen waits for it; bots take one at once)
    if (w.day >= BAL.perks.from) {
      // not the last dawn's three (Leo: the same card three dawns running); a fire below half always gets its card (Dana's
      // playtest: her fire was nearly out and no fire card came)
      const ids = w.r.shuffle(Object.keys(BAL.perks.list).filter((id) => id !== 'fire' && !w.lastOffer.includes(id)));
      if (w.fire.hp < w.fire.max * 0.5) ids.unshift('fire');
      else if (!w.lastOffer.includes('fire')) ids.splice(w.r.int(ids.length + 1), 0, 'fire');
      // the tools come first: the pickaxe while it is missing, the hammer once an upgrade is open
      const open = w.pads.filter((p) => padCost(p) != null);
      if (!w.tools.pickaxe) ids.unshift('pickaxe');
      if (!w.tools.hammer) ids.unshift('hammer');   // nothing gets built without it: it leads
      w.offer = w.lastOffer = ids.slice(0, 3);
      // and for sale beside them: bags, the spin after night 3, the pistol after night 5 (Oleg)
      w.shop = Object.keys(BAL.shop).filter((id) => held >= BAL.shop[id].after && shopCost(w, id) != null);
      ev(w, 'offer', { perks: w.offer });
    }
  }
}

// what a shop item costs now: the next bag's price, the spin's and the pistol's once; null when there is nothing more to buy
export function shopCost(w, id) {
  const c = BAL.shop[id]?.cost;
  if (Array.isArray(c)) return c[w.owned[id]] ?? null;
  return c == null || w.owned[id] ? null : c;
}

// the lumps the merchant leaves for the fire: at night, or while it is under half
export const coalKeep = (w) => (w.phase === 'night' || w.fire.hp < w.fire.max * 0.5 ? BAL.coal.keep : 0);

// buy what is for sale at this dawn (it does not use up the free card)
export function buy(w, id) {
  const cost = shopCost(w, id);
  if (!w.shop.includes(id) || cost == null || w.coins < cost) return false;
  w.coins -= cost;
  if (id === 'bag') {
    w.owned.bag++;
    w.hero.cap += BAL.carry.perUpgrade;
  } else w.owned[id] = true;
  if (shopCost(w, id) == null) w.shop = w.shop.filter((x) => x !== id);
  ev(w, 'bought', { id });
  return true;
}

// the player takes one of the dawn's three
export function choosePerk(w, id) {
  if (!w.offer || !w.offer.includes(id)) return false;
  w.perks[id] = (w.perks[id] || 0) + 1;
  w.offer = null;
  w.shop = [];   // the dawn screen closes
  if (BAL.tools.includes(id)) w.tools[id] = true;
  // day 1's pick without the hammer: nothing can be built, so day 1's clock starts now (Oleg's choice: a lost day, the hammer
  // leads the next dawn)
  if (w.day === 1 && !w.started && !w.tools.hammer) w.started = true;
  const add = cardValue(w, id);
  if (id === 'fire') {
    w.fire.max += add;
    w.fire.hp += add;
  }
  if (id === 'pockets') w.hero.cap += add;
  if (id === 'walls') {
    for (const p of w.pads) {
      if (p.kind !== 'wall' || p.level <= 0) continue;
      const k = p.hp / p.maxHp;
      p.maxHp = BAL.wall.hp[p.level - 1] * (1 + perk(w, 'walls'));
      p.hp = p.maxHp * k;
    }
  }
  ev(w, 'perk', { id });
  return true;
}

// the night's horde, its packs and where each comes from: one point on one edge, its members a moment apart
function planNight(w) {
  const wv = wave(w.day, modeOf(w)), list = [];
  for (let i = 0; i < wv.hollows; i++) list.push('hollow');
  for (let i = 0; i < wv.brutes; i++) list.push('brute');
  for (let i = 0; i < wv.runners; i++) list.push('runner');
  w.r.shuffle(list);
  const size = Math.max(1, Math.floor(BAL.night.pack[0] + BAL.night.pack[1] * w.day)), packs = Math.ceil(list.length / size);
  // Hard, from night twinFrom: the packs come two at once, from two sides
  const twin = w.day >= modeOf(w).twinFrom, slots = twin ? Math.ceil(packs / 2) : packs;
  w.spawnQueue = list.map((kind, i) => {
    const k = Math.floor(i / size), slot = twin ? Math.floor(k / 2) : k;
    return { kind, pack: k, at: 0.5 + (BAL.night.spawnSeconds * slot) / Math.max(1, slots - 1) + (i % size) * 0.25 };
  }).sort((a, b) => a.at - b.at);
  w.packs = Array.from({ length: packs }, () => ({ side: w.r.int(4), u: 2 + w.r.next() * (BAL.map.w - 4) }));
  w.planned = true;
}

// the fire burns down by itself once the camp is started (Oleg's play: then coal matters); night 1 keeps its floor
function fire(w, dt) {
  if (!w.started) return;
  const floor = w.day <= BAL.fire.floorNights ? BAL.fire.floorHp : 0;
  const burn = w.phase === 'night' ? modeOf(w).burnNight : BAL.fire.burnDay;
  w.fire.hp = Math.max(Math.min(w.fire.hp, floor), w.fire.hp - burn * dt);
  if (w.fire.hp <= 0) burnOut(w);
}

// rocks, trees, the fire and towers stop the hero and helpers. Palisades let them through (a gate for their own side): with the
// market inside and the trees outside, walking round by the corners on every trip was a chore (a slow bot got stuck behind one)
function blocked(w, x, y, r) {
  if (x < r || y < r || x > BAL.map.w - r || y > BAL.map.h - r) return true;
  if (Math.hypot(x - w.fire.x, y - w.fire.y) < 0.55 + r) return true;
  for (const n of w.nodes) if (n.items > 0 && Math.hypot(x - n.x, y - n.y) < 0.42 + r) return true;
  for (const p of w.pads) if (p.kind === 'tower' && p.level > 0 && !p.broken && Math.hypot(x - p.x, y - p.y) < 0.5 + r) return true;
  return false;
}
// the nearest free spot on rings around o
function free(w, o, r) {
  if (!blocked(w, o.x, o.y, r)) return;
  for (let d = 0.3; d < 4; d += 0.3)
    for (let a = 0; a < 16; a++) {
      const x = o.x + Math.cos((a * Math.PI) / 8) * d, y = o.y + Math.sin((a * Math.PI) / 8) * d;
      if (!blocked(w, x, y, r)) { o.x = x; o.y = y; return; }
    }
}

// walk a step toward (gx, gy); when the straight line is blocked, try angled directions, keeping to the side that worked last
// (a helper with a full load sat against the first tower on his way to the market: Oleg's play, the woodcutter's load never
// emptied)
function steer(w, o, gx, gy, len, r) {
  const a0 = Math.atan2(gy - o.y, gx - o.x), side = o.turn || 1;
  for (const da of [0, 0.5, 1, 1.5, 2.1, -0.5, -1, -1.5, -2.1]) {
    const a = a0 + da * side, nx = o.x + Math.cos(a) * len, ny = o.y + Math.sin(a) * len;
    if (blocked(w, nx, ny, r)) continue;
    if (da < 0) o.turn = -side;
    o.x = nx;
    o.y = ny;
    return len;
  }
  return 0;
}

// the hero's walk: straight if it can, else sliding round whatever is in the way (Sam's playtest: touching the fire from the
// lower right, W, A or both moved him nothing and he lost most of a day; now he slips round it)
function slide(w, o, dx, dy, r) {
  const len = Math.hypot(dx, dy);
  if (move(w, o, dx, dy, r) > len * 0.5) return;
  const a0 = Math.atan2(dy, dx);
  for (const da of [0.5, -0.5, 1, -1, 1.4, -1.4, 1.62, -1.62, 1.9, -1.9]) {   // up to just past sideways: pushing straight at a round thing slides along it
    const nx = o.x + Math.cos(a0 + da) * len, ny = o.y + Math.sin(a0 + da) * len;
    if (!blocked(w, nx, ny, r)) {
      o.x = nx;
      o.y = ny;
      return;
    }
  }
}

export function move(w, o, dx, dy, r) {
  const x0 = o.x, y0 = o.y;
  if (!blocked(w, o.x + dx, o.y, r)) o.x += dx;
  if (!blocked(w, o.x, o.y + dy, r)) o.y += dy;
  return Math.hypot(o.x - x0, o.y - y0);
}

// how close the hero must be to pay: measured from the middle of his body, not his feet, and generous (Mia's playtest: a
// 9-year-old lines the body up with the circle; at 0.8 from the feet she stood "on" a pad that never took her coins). Built
// towers and walls are solid: their upgrade is paid standing next to them
// 1.2 on a new pad: anywhere on its ring (Mia's playtest: standing on the glowing spot sometimes did nothing until she
// nudged him)
// a built wall's upgrade is paid from 1.75 (Dana's playtest: standing on its price tag, just under the wall, did nothing)
export const padReach = (p) => (p.level === 0 ? 1.2 : p.kind === 'tower' ? 1.4 : p.kind === 'wall' ? 1.75 : 1.05);
const padDist = (h, p) => Math.hypot(h.x - p.x, h.y - 0.3 - p.y);
// how long he stands on a pad before it takes anything: longer for a dear one (the screen fills a bar meanwhile)
export const payDelay = (p) => (padCost(p).coins >= BAL.payBigFrom ? BAL.payDelayBig : BAL.payDelay);

function hero(w, input, dt) {
  const h = w.hero;
  if (h.dead > 0) {
    h.dead -= dt;
    if (h.dead <= 0) {
      Object.assign(h, { dead: 0, hp: BAL.hero.hp, x: HOME.x, y: HOME.y, shield: BAL.hero.shield });
      ev(w, 'respawn');
    }
    return;
  }
  h.shield = Math.max(0, h.shield - dt);
  // the fire's warmth heals (Oleg's play)
  if (dist(h, w.fire) < BAL.hero.regenReach) h.hp = Math.min(BAL.hero.hp, h.hp + BAL.hero.regen * dt);
  let mx = (input && input.x) || 0, my = (input && input.y) || 0;
  const m = Math.hypot(mx, my);
  if (m > 1) { mx /= m; my /= m; }
  h.moving = m > 0.15;
  h.walking = false;   // really getting somewhere (pushing into a tree is not)
  if (h.moving) {
    const sp = BAL.hero.speed * (1 + perk(w, 'speed'));
    const x0 = h.x, y0 = h.y;
    slide(w, h, mx * sp * dt, my * sp * dt, BAL.hero.radius);
    h.walking = Math.hypot(h.x - x0, h.y - y0) > sp * dt * 0.3;
    if (Math.abs(mx) > 0.2) h.face = Math.sign(mx);
  }
  // gather from the nearest tree or rock in reach once he stops there, not while walking past (Oleg's phone test: passing
  // trees filled the bag with wood he did not want; like the fire, the merchant and the pads); not on a pad still to be built
  // (Leo's playtest: by a tree, a corner wall's pad never took his wood); rocks only with the pickaxe (Oleg: rocks that gave
  // nothing until a build wanted stone were frustrating; now a tool from a dawn card says why)
  h.harvesting = null;
  const onNewPad = w.pads.some((p) => p.level === 0 && padCost(p) != null && padDist(h, p) < padReach(p));
  if (h.walking) h.harvestT = Math.max(h.harvestT, BAL.harvest.interval * 0.5);   // a short beat after he stops
  else if (h.stack.length < h.cap && !onNewPad) {
    let node = null, nd = BAL.harvest.reach + 0.45;
    for (const n of w.nodes) {
      if (n.items <= 0 || (n.kind !== 'tree' && !w.tools.pickaxe)) continue;   // rocks and coal need the pickaxe (Oleg)
      const d = dist(n, h);
      if (d < nd) { nd = d; node = n; }
    }
    if (node) {
      h.harvesting = node;
      h.face = Math.sign(node.x - h.x) || h.face;   // turned to the tree or rock he works on
      h.harvestT -= dt;
      if (h.harvestT <= 0) {
        h.harvestT = BAL.harvest.interval;
        node.items--;
        node.shake = 0.15;
        h.stack.push(BAL.nodes[node.kind].res);
        if (node.items <= 0) node.regrow = BAL.nodes[node.kind].regrow;
        ev(w, node.kind === 'tree' ? 'chop' : 'mine', { x: node.x, y: node.y, coal: node.kind === 'coal' });
      }
    } else h.harvestT = Math.min(h.harvestT, BAL.harvest.interval * 0.5);
  }
  // the coal merchant buys coal, a lump at a time while the hero stands at his cart (stepping away keeps the rest for the
  // fire); wood and stone are not for sale, they are for building (Oleg: coal is the valuable one: burn it or sell it)
  // ... and only when he stops there: walking past sells nothing (Leo's playtest: the stall sold his things on the way past)
  // ... and not the fire's last lumps at night or while it is under half (coalKeep)
  const keep = coalKeep(w);
  if (count(h.stack, 'coal') > keep && dist(h, w.market) < 1.05 && !h.moving && (h.sellT = (h.sellT || 0) + dt) >= BAL.payDelay) {
    h.sellAcc += dt * BAL.sellRate;
    while (h.sellAcc >= 1) {
      const i = h.stack.lastIndexOf('coal');
      if (i < 0 || count(h.stack, 'coal') <= keep) break;
      h.sellAcc--;
      const res = h.stack.splice(i, 1)[0], v = coalPrice(w);
      w.coins += v;
      w.earned += v;
      ev(w, 'sell', { res, v });
    }
  } else {
    h.sellAcc = 0;
    if (h.moving || dist(h, w.market) >= 1.05) h.sellT = 0;
  }
  // wood and stone go onto the camp's pile when the hero stands at it (coal stays: it is for the fire or the merchant)
  // ... when he stops there, like everything that takes from the backpack (Mia's playtest: the pile, the fire and the walls
  // took her things as she walked past)
  if (!h.moving && dist(h, BAL.woodpile) < BAL.woodpile.reach && (h.stack.includes('wood') || h.stack.includes('stone'))) {
    h.dropAcc = (h.dropAcc || 0) + dt * BAL.woodpile.dropRate;
    while (h.dropAcc >= 1) {
      let i = h.stack.length - 1;
      while (i >= 0 && h.stack[i] === 'coal') i--;
      if (i < 0) break;
      h.dropAcc--;
      const res = h.stack.splice(i, 1)[0];
      w.stock[res]++;
      ev(w, 'stack', { x: BAL.woodpile.x, y: BAL.woodpile.y, res });
    }
  } else h.dropAcc = 0;
  // coal goes into the fire when the hero stops beside it, a piece at a time; walking past keeps it (Dana's playtest: coal she
  // was taking to the merchant went into the fire on the way)
  h.feedT -= dt;
  const coalAt = h.stack.lastIndexOf('coal');
  // ... and only while the fire has room for a whole lump (Dana's playtest: three lumps went into a fire at 95%)
  if (coalAt >= 0 && !h.moving && dist(h, w.fire) < BAL.coal.feedReach && h.feedT <= 0 && w.fire.hp <= w.fire.max - BAL.coal.heal) {
    h.feedT = BAL.coal.feedInterval;
    h.stack.splice(coalAt, 1);
    w.fire.hp = Math.min(w.fire.max, w.fire.hp + BAL.coal.heal);
    ev(w, 'feed', { x: w.fire.x, y: w.fire.y });
  }
  // pay into the pad underfoot: the wood and stone it needs from the backpack, then coins (Oleg's play: buildings take part
  // wood, part stone, part coin); when it is all there, it builds (or upgrades)
  // the nearest one in reach (two in reach paid into the first on the list: a bot stood at a broken corner and paid the side)
  let pad = null;
  for (const p of w.pads) if (padCost(p) != null && !needsHammer(w, p) && padDist(h, p) < padReach(p) && (!pad || padDist(h, p) < padDist(h, pad))) pad = p;
  if (pad !== h.pad) {
    h.pad = pad;
    h.padT = 0;
    h.payAcc = 0;
  }
  // not while chopping or mining (browser check: gathering beside the east wall paid into it), and only once he stops there
  // (Mia's playtest: walking past a wall took her stone and coins for an upgrade she never chose)
  if (h.moving) h.padT = Math.min(h.padT, 0);
  // ... and never with a monster close by (Dana's round 6: fighting on a dear spot drained 83 coins into it)
  const danger = w.enemies.some((e) => !e.dead && dist(e, h) < 3);
  if (pad && !h.harvesting && !h.moving && !danger) {
    h.padT += dt;
    h.face = Math.sign(pad.x - h.x) || h.face;   // turned to what he builds
    if (h.padT >= payDelay(pad)) {
      h.payAcc += dt * BAL.payRate;
      while (h.payAcc >= 1) {
        const need = padNeed(pad);
        let res = null;
        // wood and stone from the backpack, else from the camp's pile
        for (const r of ['wood', 'stone']) if (!res && need[r] > 0 && (h.stack.includes(r) || w.stock[r] > 0)) res = r;
        if (!res && need.coins > 0 && w.coins > 0) res = 'coins';
        if (!res) {
          h.payAcc = 0;
          break;
        }
        h.payAcc--;
        // coins go in bigger steps for bigger prices: any price is paid in about a second (200 coins at one a step took 7 s)
        const n = res === 'coins' ? Math.min(w.coins, need.coins, Math.max(1, Math.ceil(padCost(pad).coins / 30))) : 1;
        if (res === 'coins') w.coins -= n;
        else if (h.stack.includes(res)) h.stack.splice(h.stack.lastIndexOf(res), 1);
        else w.stock[res]--;
        pad.paid[res] += n;
        ev(w, 'pay', { pad: pad.id, res, n });
        if (total(padNeed(pad)) === 0) {
          pad.paid = unpaid();
          if (pad.broken) repair(w, pad);
          else {
            pad.level++;
            build(w, pad);
          }
          h.padT = -0.6;   // a breath before the next level starts filling
          break;
        }
      }
    }
  }
  // fight: the nearest enemy in reach
  h.attackT -= dt;
  h.swing = Math.max(0, (h.swing || 0) - dt);
  if (h.attackT <= 0) {
    let target = null, td = BAL.hero.reach;
    for (const e of w.enemies) {
      const d = dist(h, e) - e.radius;
      if (!e.dead && d < td) { td = d; target = e; }
    }
    if (target) {
      h.attackT = 1 / BAL.hero.rate;
      h.swing = 0.2;
      h.face = Math.sign(target.x - h.x) || h.face;
      const dmg = BAL.hero.dmg * (1 + perk(w, 'axe'));
      hurt(w, target, dmg);
      ev(w, 'swing', { x: target.x, y: target.y, dmg });
    }
  }
  // the pistol: a shot at the nearest one out of the axe's reach (bought at a dawn after night 5: Oleg)
  h.shotT -= dt;
  if (w.owned.pistol && h.shotT <= 0) {
    let target = null, td = BAL.pistol.range;
    for (const e of w.enemies) {
      const d = dist(h, e);
      if (!e.dead && d - e.radius > BAL.hero.reach && d < td) { td = d; target = e; }
    }
    if (target) {
      h.shotT = 1 / BAL.pistol.rate;
      h.face = Math.sign(target.x - h.x) || h.face;
      w.arrows.push({ x: h.x + h.face * 0.4, y: h.y - 0.5, target, dmg: BAL.pistol.dmg, speed: BAL.pistol.speed, ang: 0, bullet: true });
      ev(w, 'shot', { x: h.x + h.face * 0.45, y: h.y - 0.5, tx: target.x, ty: target.y });
    }
  }
  // the spin: a blow all round, then it recharges
  h.spinT = Math.max(0, h.spinT - dt);
  if (input && input.spin && h.spinT <= 0 && w.owned.spin) {
    h.spinT = BAL.spin.cooldown;
    const dmg = BAL.hero.dmg * (1 + perk(w, 'axe')) * BAL.spin.dmg;
    let hits = 0;
    const at = [];
    for (const e of w.enemies) {
      const d = dist(h, e);
      if (e.dead || d - e.radius > BAL.spin.reach) continue;
      hits++;
      at.push([e.x, e.y]);
      hurt(w, e, dmg);
      if (!e.dead && d > 0.01) move(w, e, ((e.x - h.x) / d) * BAL.spin.knock, ((e.y - h.y) / d) * BAL.spin.knock, e.radius);
    }
    ev(w, 'spin', { x: h.x, y: h.y, hits, at });
  }
}

// a broken wall or tower stands again, whole; whoever is on it steps out
// (what was paid toward its upgrade before it broke is kept for that upgrade: mixed into the repair it could never add up, and
// the repair never came: bots stood on a broken wall for a whole day with 49 coins)
function repair(w, p) {
  Object.assign(p, { broken: false, hp: p.maxHp, paid: p.upPaid || unpaid(), upPaid: null });
  if (p.kind === 'wall') w.flowDirty = true;
  for (const o of [w.hero, ...w.helpers]) free(w, o, o === w.hero ? BAL.hero.radius : 0.3);
  for (const e of w.enemies) if (wallAt(w, Math.floor(e.x), Math.floor(e.y)) === p || (p.kind === 'tower' && dist(e, p) < 0.5 + e.radius)) free(w, e, e.radius);
  ev(w, 'build', { pad: p.id, kind: p.kind, level: p.level, x: p.x, y: p.y, repair: true });
}

function build(w, p) {
  w.started = true;
  p.best = Math.max(p.best || 0, p.level);   // the highest level it ever stood at (unlocks go by it)
  if (p.kind === 'wall') {
    p.maxHp = BAL.wall.hp[p.level - 1] * (1 + perk(w, 'walls'));
    p.hp = p.maxHp;
    w.flowDirty = true;
  }
  if (p.kind === 'tower') p.hp = p.maxHp = BAL.tower.hp[p.level - 1];
  // whoever stood where it went up steps out of it (first bot runs: a tower built under the hero held him all night)
  for (const o of [w.hero, ...w.helpers]) free(w, o, o === w.hero ? BAL.hero.radius : 0.3);
  // the first helper chops wood, the second mines stone (Oleg: with two woodcutters he had 200 wood by night 10), the third
  // mines coal and sells it, or feeds the fire when it runs low (Oleg)
  if (p.kind === 'helper') w.helpers.push({ x: p.x, y: p.y + 0.6, stack: [], target: null, t: 0, stuck: 0, moving: false, face: 1, job: p.job || 'wood' });
  ev(w, 'build', { pad: p.id, kind: p.kind, level: p.level, x: p.x, y: p.y });
  unlock(w);
}

// the fire is out: variant B relights it once (half the coins lost, the flare clears the night); otherwise the run ends
function burnOut(w) {
  if (w.relightLeft > 0) {
    w.relightLeft--;
    w.fire.hp = Math.round(w.fire.max * BAL.relight.hp);
    const lost = w.coins - Math.floor(w.coins * BAL.relight.keepCoins);
    w.coins -= lost;
    for (const e of w.enemies) e.dead = true;
    w.spawnQueue = [];
    ev(w, 'relight', { lost, x: w.fire.x, y: w.fire.y });
    return;
  }
  w.fire.hp = 0;
  w.over = true;
  ev(w, 'lose', { nights: w.day - 1 });
}

function hurt(w, e, dmg) {
  e.hp -= dmg;
  e.flash = 0.12;
  if (e.hp > 0 || e.dead) return;
  e.dead = true;
  w.kills++;
  const [a, b] = BAL.enemy[e.kind].coins, n = a + w.r.int(b - a + 1);
  for (let i = 0; i < n; i++) w.coinsOnGround.push({ x: e.x, y: e.y, vx: (w.r.next() - 0.5) * 4, vy: (w.r.next() - 0.5) * 4, t: 0 });
  if (w.r.next() < BAL.coal[e.kind]) w.coalOnGround.push({ x: e.x, y: e.y, vx: (w.r.next() - 0.5) * 3, vy: (w.r.next() - 0.5) * 3, t: 0 });
  ev(w, 'kill', { x: e.x, y: e.y, kind: e.kind });
}

export function nearestNode(w, from, kind = null, skip = null) {
  let best = null, bd = Infinity;
  for (const n of w.nodes) {
    if (n.items <= 0 || n === skip || (kind && n.kind !== kind)) continue;
    const d = dist(n, from);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

// woodcutters chop trees by day and stack the wood on the camp's woodpile (builds take from it); at night they keep by the
// fire and go for any Hollow that comes near it, with small blows (Oleg's play: make them fight a bit)
// where the coal miner stands to feed the fire: its west side (the hero comes back on its east side)
const FIRE_SIDE = { x: C.x - 1.6, y: C.y + 0.5 };

function helpers(w, dt) {
  w.helpers.forEach((hp, i) => {
    const night = w.phase === 'night', res = hp.job || 'wood', kind = { wood: 'tree', stone: 'rock', coal: 'coal' }[res];
    let goal;
    hp.attackT = (hp.attackT || 0) - dt;
    hp.swing = Math.max(0, (hp.swing || 0) - dt);
    if (night) {
      let foe = null, fd = BAL.helper.guard;
      for (const e of w.enemies) {
        const d = dist(e, w.fire);
        if (!e.dead && d < fd) { fd = d; foe = e; }
      }
      const a = -0.6 + i * 1.3;   // each his own spot by the fire
      goal = foe || { x: C.x + Math.cos(a) * 1.6, y: C.y + Math.sin(a) * 1.6 };
      if (foe && dist(hp, foe) - foe.radius < BAL.helper.reach && hp.attackT <= 0) {
        hp.attackT = 1 / BAL.helper.rate;
        hp.swing = 0.2;
        hp.face = Math.sign(foe.x - hp.x) || hp.face;
        hurt(w, foe, BAL.helper.dmg);
      }
    }
    // a full load goes to the woodpile and stays on that errand until all of it is stacked (a woodcutter once dropped one log,
    // turned back for a tree, chopped one, came back: Oleg's play, his load never emptied)
    else if (hp.selling || hp.stack.length >= BAL.helper.carry) {
      hp.selling = hp.stack.length > 0;
      // wood and stone onto the pile; coal into a low fire, else to the merchant
      goal = !hp.selling ? null : res !== 'coal' ? BAL.woodpile : w.fire.hp < w.fire.max * 0.6 ? FIRE_SIDE : w.market;
    }
    else {
      if (!hp.target || hp.target.items <= 0) hp.target = nearestNode(w, hp, kind);
      goal = hp.target;
    }
    if (!goal) return;
    const d = dist(hp, goal), stop = goal === hp.target ? 1.0 : goal.kind ? BAL.helper.reach * 0.8 : 0.6;
    hp.moving = d > stop;
    if (hp.moving) {
      const moved = steer(w, hp, goal.x, goal.y, Math.min(BAL.helper.speed * dt, d), 0.3);
      hp.face = Math.sign(goal.x - hp.x) || hp.face;
      hp.stuck = moved < BAL.helper.speed * dt * 0.2 ? hp.stuck + dt : 0;
      if (hp.stuck > 1.2 && goal === hp.target) {   // boxed in by trunks: pick another tree (or rock)
        hp.target = nearestNode(w, hp, kind, hp.target);
        hp.stuck = 0;
      }
    }
    if (!night && goal === hp.target && d <= 1.35 && hp.target.items > 0) {
      hp.t -= dt;
      if (hp.t <= 0) {
        hp.t = BAL.helper.interval;
        hp.target.items--;
        hp.target.shake = 0.15;
        hp.stack.push(res);
        if (hp.target.items <= 0) hp.target.regrow = BAL.nodes[kind].regrow;
        ev(w, res === 'wood' ? 'chop' : 'mine', { x: hp.target.x, y: hp.target.y, helper: true });
      }
    }
    if (goal === BAL.woodpile && d <= 1.05 && hp.stack.length) {
      const r = hp.stack.pop();
      w.stock[r]++;
      ev(w, 'stack', { x: BAL.woodpile.x, y: BAL.woodpile.y, res: r, helper: true });
    }
    hp.giveT = (hp.giveT || 0) - dt;
    if (goal === FIRE_SIDE && d <= 0.7 && hp.stack.length && hp.giveT <= 0 && w.fire.hp <= w.fire.max - BAL.coal.heal) {
      hp.giveT = BAL.coal.feedInterval;
      hp.stack.pop();
      w.fire.hp = Math.min(w.fire.max, w.fire.hp + BAL.coal.heal);
      ev(w, 'feed', { x: w.fire.x, y: w.fire.y, helper: true, hx: hp.x, hy: hp.y });
    }
    if (goal === w.market && d <= 0.9 && hp.stack.length && hp.giveT <= 0) {
      hp.giveT = 1 / BAL.sellRate;
      hp.stack.pop();
      const v = coalPrice(w);
      w.coins += v;
      w.earned += v;
      ev(w, 'sell', { res: 'coal', v, helper: true });
    }
  });
}

function spawns(w) {
  if (w.phase !== 'night') return;
  while (w.spawnQueue.length && w.spawnQueue[0].at <= w.phaseT) {
    const s = w.spawnQueue.shift(), k = BAL.enemy[s.kind], pk = w.packs[s.pack];
    const side = pk.side, u = pk.u + (w.r.next() - 0.5) * 1.6, edge = 0.6;
    let x = side < 2 ? u : side === 2 ? edge : BAL.map.w - edge, y = side === 0 ? edge : side === 1 ? BAL.map.h - edge : u;
    // no further than spawnRadius from the fire (Leo's round 5: each night began with a long wait for them to walk in)
    const dc = Math.hypot(x - C.x, y - C.y), R = BAL.night.spawnRadius;
    if (dc > R) {
      x = C.x + ((x - C.x) * R) / dc;
      y = C.y + ((y - C.y) * R) / dc;
    }
    const hp = k.hp + k.perNight * (w.day - 1);
    w.enemies.push({ kind: s.kind, x, y, hp, maxHp: hp, radius: k.radius, atkT: 0.5, flash: 0, wob: w.r.next() * 6 });
  }
}

// is there a standing wall on the straight line from a to b?
// the standing tower nearest a Giant, within BAL.tower.smash and with no wall between
function nearTower(w, e) {
  let best = null, bd = BAL.tower.smash;
  for (const p of w.pads) {
    if (p.kind !== 'tower' || p.level <= 0 || p.broken) continue;
    const d = dist(e, p);
    if (d < bd && !wallBetween(w, e, p)) { bd = d; best = p; }
  }
  return best;
}

function wallBetween(w, a, b) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 3);
  for (let i = 1; i <= n; i++) if (wallAt(w, Math.floor(a.x + ((b.x - a.x) * i) / n), Math.floor(a.y + ((b.y - a.y) * i) / n))) return true;
  return false;
}

function enemies(w, dt) {
  const h = w.hero;
  for (const e of w.enemies) {
    if (e.dead) continue;
    const k = BAL.enemy[e.kind];
    e.atkT -= dt;
    e.slowT = Math.max(0, (e.slowT || 0) - dt);
    e.flash = Math.max(0, e.flash - dt);
    const dh = h.dead ? Infinity : dist(e, h), df = dist(e, w.fire);
    if (dh < e.radius + BAL.hero.radius + 0.25 && h.shield <= 0) {
      if (e.atkT <= 0) {
        e.atkT = 1 / k.rate;
        h.hp -= k.dmg * BAL.hero.hitScale;
        ev(w, 'heroHit', { x: h.x, y: h.y });
        if (h.hp <= 0) {
          h.dead = BAL.hero.respawn;
          // the coal falls where he fell, to be picked up again; wood and stone stay in the backpack (Leo's playtest: a quick fall
          // that took the whole bag felt cheap)
          for (const r of h.stack) if (r === 'coal') w.coalOnGround.push({ x: h.x, y: h.y, vx: (w.r.next() - 0.5) * 3, vy: (w.r.next() - 0.5) * 3, t: 0 });
          h.stack = h.stack.filter((r) => r !== 'coal');
          ev(w, 'heroDown', { x: h.x, y: h.y });
        }
      }
      continue;
    }
    if (df < e.radius + 0.62) {
      if (perk(w, 'sparks')) hurt(w, e, perk(w, 'sparks') * dt);   // the fire burns what touches it
      if (e.dead) continue;
      if (e.atkT <= 0) {
        e.atkT = 1 / k.rate;
        const floor = w.day <= BAL.fire.floorNights ? BAL.fire.floorHp : 0;
        w.fire.hp = Math.max(Math.min(w.fire.hp, floor), w.fire.hp - k.dmg * BAL.fire.hitScale * modeOf(w).fireHit);
        w.nightHits++;
        ev(w, 'fireHit', { x: w.fire.x, y: w.fire.y });
        if (w.fire.hp <= 0) burnOut(w);
      }
      continue;
    }
    // a Giant inside the ring smashes the nearest tower within reach (Oleg: broken towers need a repair)
    const tw = e.kind === 'brute' ? nearTower(w, e) : null;
    if (tw && dist(e, tw) < 0.5 + e.radius + 0.35) {
      if (e.atkT <= 0) {
        e.atkT = 1 / k.rate;
        tw.hp -= k.dmg;
        ev(w, 'towerHit', { x: tw.x, y: tw.y });
        if (tw.hp <= 0) {
          Object.assign(tw, { hp: 0, broken: true, upPaid: tw.paid, paid: unpaid() });
          ev(w, 'towerDown', { pad: tw.id, x: tw.x, y: tw.y });
        }
      }
      continue;
    }
    // the hero when close and not behind a wall, else the way to the fire (breaking a wall that stands on it); an ember thief
    // goes straight for the fire, over the walls
    let gx, gy;
    if (e.kind === 'runner') { gx = w.fire.x; gy = w.fire.y; }
    else if (dh < 3.2 && !wallBetween(w, e, h)) { gx = h.x; gy = h.y; }
    else if (tw) { gx = tw.x; gy = tw.y; }
    else {
      const nt = nextTile(w, Math.floor(e.x), Math.floor(e.y));
      if (!nt) { gx = w.fire.x; gy = w.fire.y; }
      else {
        const wall = wallAt(w, nt[0], nt[1]);
        if (wall) {
          if (e.atkT <= 0) {
            e.atkT = 1 / k.rate;
            wall.hp -= k.dmg;
            ev(w, 'wallHit', { x: nt[0] + 0.5, y: nt[1] + 0.5 });
            if (wall.hp <= 0) {
              Object.assign(wall, { hp: 0, broken: true, upPaid: wall.paid, paid: unpaid() });   // an upgrade's part payment waits
              w.flowDirty = true;
              ev(w, 'wallDown', { pad: wall.id, x: nt[0] + 0.5, y: nt[1] + 0.5 });
            }
          }
          continue;
        }
        gx = nt[0] + 0.5;
        gy = nt[1] + 0.5;
      }
    }
    const d = Math.hypot(gx - e.x, gy - e.y) || 1;
    // the night's last three hurry in (Mia's playtest: "2 monsters left", none on screen, nothing to do)
    const hurry = !w.spawnQueue.length && w.enemies.length <= 3 && w.phaseT > BAL.night.minLength ? 1.8 : 1;
    const slow = e.slowT > 0 ? 1 - Math.min(0.6, perk(w, 'frost')) : 1;   // a frost arrow's chill
    const sp = k.speed * hurry * slow * modeOf(w).speed;
    let vx = ((gx - e.x) / d) * sp, vy = ((gy - e.y) / d) * sp;
    for (const o of w.enemies) {   // keep a little apart
      if (o === e || o.dead) continue;
      const dx = e.x - o.x, dy = e.y - o.y, dd = dx * dx + dy * dy, min = e.radius + o.radius;
      if (dd < min * min && dd > 1e-6) {
        const s = ((min - Math.sqrt(dd)) / Math.sqrt(dd)) * 2;
        vx += dx * s;
        vy += dy * s;
      }
    }
    if (rubbleAt(w, Math.floor(e.x), Math.floor(e.y))) {   // climbing through rubble
      vx *= BAL.wall.rubbleSlow;
      vy *= BAL.wall.rubbleSlow;
    }
    const nx = e.x + vx * dt, ny = e.y + vy * dt;
    if (e.kind === 'runner' || !wallAt(w, Math.floor(nx), Math.floor(ny))) {   // the shove never pushes one into a palisade
      e.x = nx;
      e.y = ny;
    }
    e.face = Math.sign(vx) || e.face || 1;
  }
  w.enemies = w.enemies.filter((e) => !e.dead);
}

// towers shoot the enemy in range that is closest to the fire
function towers(w, dt) {
  for (const p of w.pads) {
    if (p.kind !== 'tower' || p.level <= 0 || p.broken) continue;
    p.cooldown -= dt;
    if (p.cooldown > 0) continue;
    const L = p.level - 1;
    let target = null, td = Infinity;
    for (const e of w.enemies) {
      if (e.dead || dist(p, e) > BAL.tower.range[L]) continue;
      const d = dist(e, w.fire);
      if (d < td) { td = d; target = e; }
    }
    if (!target) continue;
    p.cooldown = 1 / BAL.tower.rate[L];
    w.arrows.push({ x: p.x, y: p.y - 1.1, target, dmg: BAL.tower.dmg[L] * (1 + perk(w, 'arrows')), speed: 14, ang: 0 });
    ev(w, 'arrow', { x: p.x, y: p.y });
  }
}

function arrows(w, dt) {
  for (const a of w.arrows) {
    if (a.target.dead) { a.done = true; continue; }
    const dx = a.target.x - a.x, dy = a.target.y - a.y, d = Math.hypot(dx, dy), s = a.speed * dt;
    a.ang = Math.atan2(dy, dx);
    if (d <= s + a.target.radius * 0.5) {
      a.done = true;
      hurt(w, a.target, a.dmg);
      if (perk(w, 'frost')) a.target.slowT = 1.5;
      ev(w, 'hit', { x: a.target.x, y: a.target.y });
    } else {
      a.x += (dx / d) * s;
      a.y += (dy / d) * s;
    }
  }
  w.arrows = w.arrows.filter((a) => !a.done);
}

// dropped coins burst out, then fly to the hero when close (or anyway after 15 s)
function coins(w, dt) {
  const h = w.hero;
  for (const c of w.coinsOnGround) {
    c.t += dt;
    if (c.t < 0.35) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      continue;
    }
    const d = h.dead ? Infinity : dist(c, h);
    if (d < BAL.coinMagnet || c.t > 15) {
      const s = Math.min(1, (12 * dt) / Math.max(d, 0.01));
      c.x += (h.x - c.x) * s;
      c.y += (h.y - c.y) * s;
      if (d < 0.4 || (c.t > 15 && h.dead)) {
        c.done = true;
        w.coins++;
        w.earned++;
        ev(w, 'coin');
      }
    }
  }
  w.coinsOnGround = w.coinsOnGround.filter((c) => !c.done);
  for (const c of w.coalOnGround) {
    c.t += dt;
    if (c.t < 0.35) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      continue;
    }
    if (!h.dead && h.stack.length < h.cap && dist(c, h) < BAL.coal.pickReach) {
      c.done = true;
      h.stack.push('coal');
      ev(w, 'coal', { x: c.x, y: c.y });
    }
  }
  w.coalOnGround = w.coalOnGround.filter((c) => !c.done);
}

function regrow(w, dt) {
  for (const n of w.nodes) {
    if (n.shake) n.shake = Math.max(0, n.shake - dt);
    if (n.items > 0) continue;
    n.regrow -= dt;
    // not under someone's feet (it would trap them)
    if (n.regrow <= 0 && dist(n, w.hero) > 1 && w.helpers.every((hp) => dist(n, hp) > 1)) n.items = BAL.nodes[n.kind].items;
  }
}
