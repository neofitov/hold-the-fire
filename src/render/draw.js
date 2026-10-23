// Drawing the world, top-down with a little height: the ground (pre-rendered once), pads, the camp, trees and rocks, towers
// and palisades, the hero with his stack, helpers, the horde, arrows and coins, then the night: darkness with pools of light.
import { BAL } from '../sim/config.js';
import { C, padCost, padNeed, total } from '../sim/world.js';
import { sprite, img } from '../lib/media.js';
import { rng } from '../lib/rng.js';
import { rrect, text, mix, shade } from '../lib/ui.js';
import { icon, backpack } from './icons.js';

export const T = 32;   // pixels (virtual) per tile

export function makeView(full, cam) {
  return {
    sx: (x) => full.x + full.w / 2 + (x - cam.x) * T,
    sy: (y) => full.y + full.h / 2 + (y - cam.y) * T,
    full,
  };
}

// the camera follows the hero but keeps the map's edge at the window's edge; at the top it may go `top` tiles past it, so the
// hero is never under the HUD (Mia's playtest: at the map's top he vanished under the coin, backpack and heart bars)
export function clampCam(cam, full, top = 0) {
  const hw = full.w / 2 / T, hh = full.h / 2 / T, { w, h } = BAL.map;
  cam.x = hw * 2 >= w ? w / 2 : Math.min(Math.max(cam.x, hw), w - hw);
  cam.y = hh * 2 >= h + top ? (h - top) / 2 : Math.min(Math.max(cam.y, hh - top), h - hh);
}

let ground = null;
export function groundCanvas(world) {
  if (ground && ground.seed === world.seed) return ground.canvas;
  const { w, h } = BAL.map, cv = document.createElement('canvas');
  cv.width = w * T;
  cv.height = h * T;
  const g = cv.getContext('2d'), r = rng(world.seed + 7);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      g.fillStyle = mix('#6e9f4b', '#5e8f41', r.next() * 0.9);
      g.fillRect(x * T, y * T, T, T);
    }
  // grass tufts and flowers
  for (let k = 0; k < 900; k++) {
    const x = r.next() * w * T, y = r.next() * h * T;
    g.fillStyle = r.next() < 0.06 ? (r.next() < 0.5 ? '#f3e27a' : '#f2f2f2') : 'rgba(40,80,30,0.35)';
    g.fillRect(x, y, 2, r.next() < 0.06 ? 2 : 4);
  }
  // the camp's trodden earth
  const grad = g.createRadialGradient(C.x * T, C.y * T, 2 * T, C.x * T, C.y * T, 6.6 * T);
  grad.addColorStop(0, '#c8a76e');
  grad.addColorStop(0.75, 'rgba(176,146,92,0.9)');
  grad.addColorStop(1, 'rgba(176,146,92,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(C.x * T, C.y * T, 6.6 * T, 0, Math.PI * 2);
  g.fill();
  for (let k = 0; k < 160; k++) {
    const a = r.next() * Math.PI * 2, d = r.next() * 5.5 * T;
    g.fillStyle = 'rgba(120,92,52,0.35)';
    g.fillRect(C.x * T + Math.cos(a) * d, C.y * T + Math.sin(a) * d, 3, 2);
  }
  // the map's edge fades into forest shade
  const edge = g.createLinearGradient(0, 0, 0, T * 1.5);
  edge.addColorStop(0, 'rgba(20,40,20,0.5)');
  edge.addColorStop(1, 'rgba(20,40,20,0)');
  g.fillStyle = edge;
  g.fillRect(0, 0, w * T, T * 1.5);
  ground = { seed: world.seed, canvas: cv };
  return cv;
}

const KIND_ICON = { tower: 'tower', wall: 'wall', helper: 'axe' };

function padIcon(ctx, kind, x, y, s, job) {
  if (kind === 'helper' && job !== 'wood') return icon(ctx, job === 'stone' ? 'pickaxe' : 'coal', x, y, s * 0.9, job === 'coal' ? '#ff8a3a' : undefined);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#fff6e0';
  ctx.strokeStyle = '#fff6e0';
  ctx.lineWidth = 2;
  if (kind === 'tower') {
    ctx.fillRect(-s * 0.22, -s * 0.2, s * 0.44, s * 0.55);
    ctx.beginPath();
    ctx.moveTo(-s * 0.36, -s * 0.18);
    ctx.lineTo(0, -s * 0.5);
    ctx.lineTo(s * 0.36, -s * 0.18);
    ctx.fill();
  } else if (kind === 'wall') {
    for (let k = -2; k <= 2; k++) {
      ctx.fillRect(k * s * 0.16 - s * 0.06, -s * 0.3, s * 0.12, s * 0.62);
      ctx.beginPath();
      ctx.moveTo(k * s * 0.16 - s * 0.06, -s * 0.3);
      ctx.lineTo(k * s * 0.16, -s * 0.42);
      ctx.lineTo(k * s * 0.16 + s * 0.06, -s * 0.3);
      ctx.fill();
    }
  } else sprite(ctx, 'axe', 0, 0, s * 0.95);
  ctx.restore();
}

// a pad on the ground: a ring that fills as it is paid, an icon, the price still missing in wood, stone and coins
export function drawPad(ctx, v, p, world, now) {
  const cost = padCost(p);
  // once the ring's first walls are open, the pieces still to come show as faint outlines, so the whole ring is plain from the
  // start (Leo's playtest: four corner gaps appeared after he had "finished" the walls)
  // a broken wall glows red till it is repaired, so a leak shows where it is (Leo's round 4: ghosts came in through a wall he did not
  // know was down)
  if (p.kind === 'wall' && p.broken) {
    ctx.strokeStyle = `rgba(255,70,50,${0.55 + 0.35 * Math.sin(now * 0.01)})`;
    ctx.lineWidth = 3;
    for (const [tx, ty] of p.tiles) ctx.strokeRect(v.sx(tx) + 2, v.sy(ty) + 2, T - 4, T - 4);
  }
  if (cost == null && p.kind === 'wall' && p.level === 0 && world.pads.some((q) => q.kind === 'wall' && q.cap > 0)) {
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = world.phase === 'night' ? 'rgba(255,110,80,0.4)' : 'rgba(255,240,200,0.3)';
    ctx.lineWidth = 2;
    for (const [tx, ty] of p.tiles) ctx.strokeRect(v.sx(tx) + 4, v.sy(ty) + 4, T - 8, T - 8);
    ctx.setLineDash([]);
  }
  if (cost == null) return;
  const need = padNeed(p), done = 1 - total(need) / total(cost);
  const x = v.sx(p.x), y = v.sy(p.y), night = world.phase === 'night';
  const here = world.hero.pad === p, pulse = here ? 1 + 0.06 * Math.sin(now * 0.02) : 1;
  // the newest thing glows (one new thing at a time)
  if (world.fresh.includes(p.id)) {
    const r = (p.level === 0 ? 0.62 : 0.9) * T + 6 + 4 * Math.sin(now * 0.006), gl = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 1.5);
    gl.addColorStop(0, 'rgba(255,233,140,0)');
    gl.addColorStop(0.6, `rgba(255,233,140,${0.35 + 0.15 * Math.sin(now * 0.006)})`);
    gl.addColorStop(1, 'rgba(255,233,140,0)');
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (p.level === 0) {
    if (p.kind === 'wall') {   // where the palisade will stand, tile by tile (the corners are L-shaped)
      ctx.setLineDash([5, 4]);
      // red at night: a gap the horde walks through (Dana's playtest: with the four sides up she could not see how they got in)
      ctx.strokeStyle = night ? 'rgba(255,110,80,0.7)' : 'rgba(255,240,200,0.55)';
      ctx.lineWidth = 2;
      for (const [tx, ty] of p.tiles) ctx.strokeRect(v.sx(tx) + 3, v.sy(ty) + 3, T - 6, T - 6);
      ctx.setLineDash([]);
    }
    const R = 0.62 * T * pulse;
    ctx.fillStyle = 'rgba(40,30,20,0.42)';   // the same by night: a pad never looks closed (Sam's playtest thought it did)
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,240,200,0.75)';
    ctx.stroke();
    if (done > 0) {
      ctx.strokeStyle = '#ffd34a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * done);
      ctx.stroke();
    }
    padIcon(ctx, p.kind, x, y - 2, R * 1.1, p.job);
  } else if (done > 0) {
    // an upgrade under way: how much of it is paid, under the building (its price is on the crisp tag, game.js)
    const ty = p.kind === 'tower' ? y + 0.75 * T : y + 0.85 * T;
    ctx.fillStyle = 'rgba(30,22,16,0.7)';
    ctx.fillRect(x - 19, ty - 2, 38, 5);
    ctx.fillStyle = '#ffd34a';
    ctx.fillRect(x - 18, ty - 1, 36 * done, 3);
  }
}

// the spot in front of the booth where the hero stands to sell
export function drawMarket(ctx, v, world, now) {
  const x = v.sx(world.market.x), y = v.sy(world.market.y);
  const busy = world.hero.stack.includes('coal') && Math.hypot(world.hero.x - world.market.x, world.hero.y - world.market.y) < 1.05;
  ctx.fillStyle = busy ? 'rgba(255,211,74,0.32)' : 'rgba(255,211,74,0.14)';
  ctx.beginPath();
  ctx.ellipse(x, y, 0.8 * T, 0.45 * T, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,211,74,0.7)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
}

// the coal merchant's cart just north of the sell spot (Oleg: the merchant trades coal for coins and nothing else, and his cart
// should say so): a handcart heaped with coal on two wheels, the merchant behind it with his money pouch, coins in a dish on the
// cart's corner; the sign over it (coal -> coins) is drawn crisp in game.js
export const BOOTH_DY = -0.55;
function drawBooth(ctx, v, world, now) {
  const x = v.sx(world.market.x), base = v.sy(world.market.y + BOOTH_DY), w = 1.9 * T, h = world.hero;
  const selling = h.stack.includes('coal') && Math.hypot(h.x - world.market.x, h.y - world.market.y) < 1.05;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, base + 2, w * 0.6, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // the sign's pole, stuck in the cart (the board itself is crisp, drawn over the world in game.js)
  ctx.fillStyle = '#6b4a2c';
  ctx.fillRect(x + 12, base - 58, 4, 50);
  // the merchant at the cart's handles, clear of the sign, turned to whoever is selling: sooty apron, money pouch
  const face = h.x < world.market.x - 1 ? -1 : 1, bounce = selling ? Math.abs(Math.sin(now * 0.02)) * 3 : 0;
  drawPerson(ctx, x - w / 2 - 12, base - 2 - bounce, { face, moving: false }, now, { tunic: '#8a4a2a', hat: '#2c2620', tool: 'pouch', apron: '#3b3733' });
  // the cart's bed: planks
  const bx = x - w / 2 + 2, bw = w - 12, by = base - 26;
  ctx.fillStyle = '#8a5f36';
  rrect(ctx, bx, by, bw, 16, 2);
  ctx.fill();
  ctx.strokeStyle = '#5a3a1c';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx, by + 8);
  ctx.lineTo(bx + bw, by + 8);
  ctx.stroke();
  // the heap of coal on it, lumps catching the light
  const lumps = [[-20, -2, 6], [-11, -5, 7], [-2, -6, 7], [7, -5, 7], [15, -2, 6], [-15, -9, 5], [-6, -11, 6], [3, -11, 6], [11, -8, 5], [-2, -15, 5]];
  for (const [dx, dy, r] of lumps) {
    ctx.fillStyle = '#26242a';
    ctx.beginPath();
    ctx.moveTo(x - 6 + dx - r, by + dy + 2);
    ctx.lineTo(x - 6 + dx - r * 0.4, by + dy - r * 0.8);
    ctx.lineTo(x - 6 + dx + r * 0.6, by + dy - r * 0.7);
    ctx.lineTo(x - 6 + dx + r, by + dy + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4a4752';
    ctx.fillRect(x - 6 + dx - r * 0.3, by + dy - r * 0.6, r * 0.5, 2);
  }
  const glint = 0.5 + 0.5 * Math.sin(now * 0.005);
  ctx.fillStyle = `rgba(255,150,60,${0.5 + 0.4 * glint})`;
  for (const [dx, dy] of [[-12, -6], [4, -9], [12, -4], [-4, -13]]) ctx.fillRect(x - 6 + dx, by + dy, 2, 2);
  // a dish of coins on the corner
  for (const [dx, dy] of [[0, 0], [5, -1], [2, -3]]) icon(ctx, 'coin', bx + bw - 7 + dx, by - 3 + dy, 8);
  // the wheels, spoked, and the handles reaching out to the left
  for (const wx of [bx + 9, bx + bw - 11]) {
    ctx.fillStyle = '#5a3a1c';
    ctx.beginPath();
    ctx.arc(wx, base - 6, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9c7445';
    ctx.beginPath();
    ctx.arc(wx, base - 6, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a3a1c';
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(wx - Math.cos(a) * 5.5, base - 6 - Math.sin(a) * 5.5);
      ctx.lineTo(wx + Math.cos(a) * 5.5, base - 6 + Math.sin(a) * 5.5);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = '#6b4a2c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bx, by + 10);
  ctx.lineTo(bx - 12, by + 16);
  ctx.stroke();
}

// a coal seam: a dark boulder with glowing orange veins (coal is the precious thing: it feeds the fire or buys the builds)
function drawSeam(ctx, x, base, now, seed) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x + 3, base, 17, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [dx, dy, r, c] of [[-7, -8, 9, '#232127'], [7, -7, 8, '#2a282f'], [0, -15, 9, '#2f2c34'], [-2, -6, 8, '#26242a']]) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x + dx, base + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#4b4853';
  ctx.fillRect(x - 6, base - 21, 6, 2);
  ctx.fillRect(x - 13, base - 12, 4, 2);
  const glow = 0.55 + 0.45 * Math.sin(now * 0.004 + seed);
  ctx.strokeStyle = `rgba(255,${Math.round(110 + 50 * glow)},40,${0.6 + 0.4 * glow})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 10, base - 9);
  ctx.lineTo(x - 4, base - 12);
  ctx.lineTo(x + 1, base - 9);
  ctx.moveTo(x + 3, base - 18);
  ctx.lineTo(x + 6, base - 13);
  ctx.lineTo(x + 11, base - 11);
  ctx.stroke();
  ctx.fillStyle = `rgba(255,200,90,${glow})`;
  ctx.fillRect(x - 5, base - 13, 2, 2);
  ctx.fillRect(x + 6, base - 14, 2, 2);
}

// the camp's pile: logs stacked crosswise and stones beside them, as many as lie there; empty, a bare pallet shows where it is
function drawPile(ctx, v, world, now) {
  const x = v.sx(BAL.woodpile.x), base = v.sy(BAL.woodpile.y) + 6, s = world.stock;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x, base, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a5a36';   // the pallet
  ctx.fillRect(x - 17, base - 5, 34, 5);
  ctx.fillStyle = '#5e4227';
  for (const dx of [-14, -2, 10]) ctx.fillRect(x + dx, base - 5, 4, 5);
  const logs = Math.min(s.wood, 10);
  for (let k = 0, row = 0, inRow = 4, n = 0; k < logs; k++) {   // rows of 4, 3, 2, 1 logs, ends towards us
    const lx = x - 13 + (4 - inRow) * 3.5 + n * 7, ly = base - 9 - row * 6;
    ctx.fillStyle = '#9c6b3a';
    ctx.beginPath();
    ctx.arc(lx, ly, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9b07a';
    ctx.beginPath();
    ctx.arc(lx, ly, 2, 0, Math.PI * 2);
    ctx.fill();
    if (++n >= inRow) { n = 0; row++; inRow--; }
  }
  const stones = Math.min(s.stone, 6);
  for (let k = 0; k < stones; k++) {
    const sx = x + 10 + (k % 3) * 5 - (k >= 3 ? 2.5 : 0), sy = base - 7 - (k >= 3 ? 5 : 0);
    ctx.fillStyle = '#9a9a96';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 3.6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c4c4bf';
    ctx.fillRect(sx - 2, sy - 2, 2, 1.5);
  }
}

// the sprites' visible bottom is at 78% of the picture: put it on the ground at `base` (Oleg's play: trees and rocks looked
// like they hovered, their shadow ten pixels below the trunk), with a soft shadow and a dark contact patch where it stands
const BOTTOM = 0.78;
function standing(ctx, name, x, base, size, rx) {
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  ctx.ellipse(x + rx * 0.25, base, rx * 1.15, rx * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,14,8,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, base - 1, rx * 0.55, rx * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  sprite(ctx, name, x, base - size * (BOTTOM - 0.5), size);
}

function drawNode(ctx, v, n, now) {
  const x = v.sx(n.x) + (n.shake ? Math.sin(now * 0.12) * 2.5 : 0), base = v.sy(n.y) + 6;
  if (n.items <= 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(x, base, n.kind === 'tree' ? 9 : 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = n.kind === 'tree' ? '#7a5a36' : n.kind === 'coal' ? '#3a3836' : '#8b8b86';
    ctx.beginPath();
    ctx.ellipse(x, base - 2, n.kind === 'tree' ? 6 : 8, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (n.kind === 'tree') standing(ctx, ['tree', 'tree-tall', 'tree-autumn'][n.look], x, base, 72, 12);
  else if (n.kind === 'coal') drawSeam(ctx, x, base, now, n.x * 7 + n.y);
  else standing(ctx, ['rock-a', 'rock-b', 'rock-c'][n.look], x, base, 46, 15);
}

// a tower a Giant smashed: the stump of its base, the fallen roof and planks, till it is repaired (Oleg)
function drawTowerRubble(ctx, x, y, L) {
  const wall = L >= 3 ? '#8f939a' : '#9c7a52', roof = ['#c0563b', '#3b7bc0', '#d1a12a'][L - 1];
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 20, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = wall;   // the stump, its top jagged
  ctx.beginPath();
  ctx.moveTo(x - 13, y + 10);
  ctx.lineTo(x - 13, y - 6);
  ctx.lineTo(x - 7, y - 11);
  ctx.lineTo(x - 2, y - 4);
  ctx.lineTo(x + 4, y - 13);
  ctx.lineTo(x + 13, y - 3);
  ctx.lineTo(x + 13, y + 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(wall, -0.35);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();   // the roof, fallen on its side
  ctx.translate(x + 16, y + 6);
  ctx.rotate(0.9);
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(-12, 4);
  ctx.lineTo(0, -10);
  ctx.lineTo(12, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = shade(wall, -0.2);   // planks
  ctx.save();
  ctx.translate(x - 16, y + 8);
  ctx.rotate(-0.4);
  ctx.fillRect(-9, -2, 18, 4);
  ctx.restore();
}

function drawTower(ctx, v, p, now, night) {
  const x = v.sx(p.x), y = v.sy(p.y), L = p.level, h = 30 + L * 6;
  if (p.broken) return drawTowerRubble(ctx, x, y, L);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // stone base and wooden posts
  ctx.fillStyle = L >= 3 ? '#8f939a' : '#9c7a52';
  rrect(ctx, x - 13, y - h + 10, 26, h, 4);
  ctx.fill();
  ctx.strokeStyle = shade(L >= 3 ? '#8f939a' : '#9c7a52', -0.35);
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let k = 1; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(x - 13, y - h + 10 + (k * h) / 4);
    ctx.lineTo(x + 13, y - h + 10 + (k * h) / 4);
    ctx.stroke();
  }
  // the platform and roof, coloured by level
  const roof = ['#c0563b', '#3b7bc0', '#d1a12a'][L - 1];
  ctx.fillStyle = '#6b4a2c';
  ctx.fillRect(x - 17, y - h + 4, 34, 8);
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - 19, y - h + 4);
  ctx.lineTo(x, y - h - 16);
  ctx.lineTo(x + 19, y - h + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(roof, -0.3);
  ctx.fillRect(x - 1, y - h - 26, 2, 12);
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x + 1, y - h - 26);
  ctx.lineTo(x + 11, y - h - 22 + Math.sin(now * 0.008) * 2);
  ctx.lineTo(x + 1, y - h - 18);
  ctx.fill();
  if (night) {
    ctx.fillStyle = 'rgba(255,190,90,0.9)';
    ctx.beginPath();
    ctx.arc(x + 9, y - h + 8, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // level pips
  for (let k = 0; k < L; k++) {
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(x - 6 + k * 6, y - 4, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// the woodcutter's hut (Oleg's play: he could not tell where the worker came from): a log cabin with a roof, a door, and an axe
// in a stump by it; one window lit per woodcutter hired
// each helper's house (Oleg: a house for each): the woodcutter's log cabin, the stone miner's stone hut with a slate roof and
// a pickaxe by a heap of stones, the coal miner's sooty hut with a black roof, a lantern and coal sacks
function drawHut(ctx, x, y, level, job = 'wood', now = 0) {
  if (job === 'stone') return drawStoneHut(ctx, x, y);
  if (job === 'coal') return drawCoalHut(ctx, x, y, now);
  const w = 44, h = 26, base = y + 6;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, base + 2, w * 0.62, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a5a30';
  rrect(ctx, x - w / 2, base - h, w, h, 3);
  ctx.fill();
  ctx.strokeStyle = '#5e3c1e';
  ctx.lineWidth = 1.5;
  for (let k = 1; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, base - (k * h) / 4);
    ctx.lineTo(x + w / 2, base - (k * h) / 4);
    ctx.stroke();
  }
  ctx.fillStyle = '#4a2f18';   // the door
  rrect(ctx, x - 6, base - 16, 12, 16, 3);
  ctx.fill();
  for (let k = 0; k < 3; k++) {   // windows: lit for each woodcutter hired
    ctx.fillStyle = k < level ? '#ffd27a' : '#3a2a1a';
    ctx.fillRect(x - w / 2 + 5 + (k === 2 ? w - 18 : k * 0), base - h + 6 + (k === 1 ? 9 : 0), 8, 6);
  }
  ctx.fillStyle = '#7a2e22';   // the roof
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 6, base - h + 2);
  ctx.lineTo(x, base - h - 18);
  ctx.lineTo(x + w / 2 + 6, base - h + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x - w / 2 - 6, base - h + 1, w + 12, 3);
  // a stump with an axe in it
  ctx.fillStyle = '#9c7a52';
  ctx.beginPath();
  ctx.ellipse(x + w / 2 + 10, base - 2, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  sprite(ctx, 'axe', x + w / 2 + 11, base - 11, 20);
}

function drawStoneHut(ctx, x, y) {
  const w = 42, h = 24, base = y + 6;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, base + 2, w * 0.62, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8d8f96';   // walls of stone blocks
  rrect(ctx, x - w / 2, base - h, w, h, 2);
  ctx.fill();
  ctx.strokeStyle = '#5d6068';
  ctx.lineWidth = 1.2;
  for (let r = 0; r < 3; r++) {
    const yy = base - h + 8 * r;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, yy);
    ctx.lineTo(x + w / 2, yy);
    ctx.stroke();
    for (let c = (r % 2) * 5; c < w; c += 10) {
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + c, yy);
      ctx.lineTo(x - w / 2 + c, yy + 8);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#3a3c42';   // the door
  rrect(ctx, x - 5, base - 15, 10, 15, 3);
  ctx.fill();
  ctx.fillStyle = '#ffd27a';   // a lit window
  ctx.fillRect(x + 9, base - h + 6, 7, 6);
  ctx.fillStyle = '#4e5566';   // a slate roof
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 5, base - h + 2);
  ctx.lineTo(x - w / 2 + 6, base - h - 14);
  ctx.lineTo(x + w / 2 - 6, base - h - 14);
  ctx.lineTo(x + w / 2 + 5, base - h + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x - w / 2 + 6, base - h - 14, w - 12, 3);
  for (const [dx, dy, r] of [[-w / 2 - 8, -3, 4], [-w / 2 - 3, -2, 3.5], [-w / 2 - 6, -7, 3]]) {   // a heap of stones
    ctx.fillStyle = '#9fa3a8';
    ctx.beginPath();
    ctx.arc(x + dx, base + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  icon(ctx, 'pickaxe', x + w / 2 + 8, base - 8, 16);
}

function drawCoalHut(ctx, x, y, now) {
  const w = 42, h = 24, base = y + 6;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, base + 2, w * 0.62, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a3f3c';   // sooty planks
  rrect(ctx, x - w / 2, base - h, w, h, 2);
  ctx.fill();
  ctx.strokeStyle = '#2c2523';
  ctx.lineWidth = 1.2;
  for (let k = 1; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, base - (k * h) / 3);
    ctx.lineTo(x + w / 2, base - (k * h) / 3);
    ctx.stroke();
  }
  ctx.fillStyle = '#1e1a19';   // the door
  rrect(ctx, x - 5, base - 15, 10, 15, 3);
  ctx.fill();
  ctx.fillStyle = '#22201f';   // a black roof
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 5, base - h + 2);
  ctx.lineTo(x, base - h - 16);
  ctx.lineTo(x + w / 2 + 5, base - h + 2);
  ctx.closePath();
  ctx.fill();
  const glow = 0.6 + 0.3 * Math.sin(now * 0.006);   // a lantern by the door
  ctx.fillStyle = `rgba(255,190,80,${0.25 * glow})`;
  ctx.beginPath();
  ctx.arc(x + 12, base - 14, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,214,120,${glow})`;
  ctx.fillRect(x + 10, base - 17, 4, 5);
  for (const dx of [w / 2 + 6, w / 2 + 14]) {   // coal sacks
    ctx.fillStyle = '#6b5a44';
    ctx.beginPath();
    ctx.ellipse(x + dx, base - 4, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#26221f';
    ctx.beginPath();
    ctx.ellipse(x + dx, base - 9, 3.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWallTile(ctx, v, p, tx, ty, k) {
  const x = v.sx(tx), y = v.sy(ty), dmg = 1 - p.hp / p.maxHp, stone = p.level >= 2;
  if (p.broken) {   // rubble till dawn: stumps and fallen pieces the horde climbs through slowly
    const base = stone ? '#8a8c8e' : '#7a5530';
    for (let s = 0; s < 3; s++) {
      ctx.fillStyle = shade(base, -0.15 * (s % 2));
      rrect(ctx, x + 3 + s * 9.5, y + T - 12 - ((k + s) % 3) * 2, 8, 9 + ((k + s) % 3) * 2, 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(x + T / 2, y + T - 6);
    ctx.rotate(((k % 3) - 1) * 0.5);
    ctx.fillStyle = base;
    ctx.fillRect(-12, -3, 24, 6);
    ctx.restore();
    return;
  }
  const base = stone ? '#9a9c9e' : '#8a6239';
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x, y + T - 6, T, 6);
  for (let s = 0; s < 3; s++) {
    const sx = x + 3 + s * 9.5, hh = stone ? 22 : 26 + ((k + s) % 2) * 3;
    ctx.fillStyle = mix(base, '#3a2a1c', dmg * 0.6);
    rrect(ctx, sx, y + T - 4 - hh, 8, hh, stone ? 2 : 3);
    ctx.fill();
    ctx.strokeStyle = shade(base, -0.4);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    if (!stone) {
      ctx.fillStyle = shade(base, 0.15);
      ctx.beginPath();
      ctx.moveTo(sx, y + T - 4 - hh);
      ctx.lineTo(sx + 4, y + T - 10 - hh);
      ctx.lineTo(sx + 8, y + T - 4 - hh);
      ctx.fill();
    }
  }
}

// what the hero holds and whether he is at work (Oleg: no axe by default; the axe only for trees, the pickaxe for rocks and
// coal, the hammer for upgrades, hands for everything else: walking, coins, selling, feeding, first builds); fights with the axe
export function heroTool(world) {
  const h = world.hero;
  // the chop follows the gathering: one wind-up and strike per piece, landing as it comes off (Oleg: the swing was far too fast)
  const since = BAL.spin.cooldown - h.spinT;   // the spin: a whirl of the axe, its first 0.4 s
  if (h.spinT > 0 && since < 0.4) return { tool: 'axe', busy: true, spin: since / 0.4 };
  if (world.owned.pistol && h.shotT > 1 / BAL.pistol.rate - 0.3) return { tool: 'pistol', busy: false };
  if (h.harvesting) return { tool: h.harvesting.kind === 'tree' ? 'axe' : 'pickaxe', busy: !h.moving, phase: 1 - Math.max(0, h.harvestT) / BAL.harvest.interval };
  if ((h.swing || 0) > 0) return { tool: 'axe', busy: true };
  if (h.pad && !h.moving && h.padT > 0) return { tool: 'hammer', busy: true };
  const coal = h.stack.includes('coal'), still = !h.moving;
  const selling = still && coal && Math.hypot(h.x - world.market.x, h.y - world.market.y) < 1.05;
  const feeding = still && coal && Math.hypot(h.x - world.fire.x, h.y - world.fire.y) < BAL.coal.feedReach && world.fire.hp <= world.fire.max - BAL.coal.heal;
  return { tool: 'hands', busy: selling || feeding };
}

function drawPerson(ctx, x, y, o, now, { tunic = '#3f78c8', small = false, carrying = null, cap = 12, hp = 1, hat = null, tool = 'axe', apron = null } = {}) {
  const s = small ? 0.8 : 1, bob = o.moving ? Math.sin(now * 0.025) * 2 : 0;
  // the backpack on the back (Oleg's play: wood piled on the head read badly): it grows with the load and with each bigger
  // backpack bought, and what is in it peeks out of the top, logs and stones in their shares
  if (carrying) {
    const fill = Math.min(1, carrying.length / cap), big = Math.sqrt(cap / 12), face = o.face || 1;
    const bw = (8 + 3 * big + 4 * fill) * s, bh = (11 + 4 * big + 5 * fill) * s, bx = x - face * (7 + bw * 0.25) * s, by = y - 16 * s + bob;
    const n = carrying.length || 1, shown = Math.min(4, Math.ceil(fill * 4));
    const logs = Math.round((shown * carrying.filter((r) => r === 'wood').length) / n);
    const coals = Math.min(shown - logs, Math.round((shown * carrying.filter((r) => r === 'coal').length) / n));
    for (let k = 0; k < shown; k++) {
      const px = bx - bw * 0.3 + (shown > 1 ? (k * bw * 0.6) / (shown - 1) : bw * 0.3);
      if (k < logs) {
        ctx.fillStyle = '#a8733f';
        rrect(ctx, px - 1.5, by - bh / 2 - 6 * s, 3.5, 8 * s, 1.5);
        ctx.fill();
      } else {
        ctx.fillStyle = k < logs + coals ? '#26221f' : '#9fa3a8';   // coal black, stone grey
        ctx.beginPath();
        ctx.arc(px, by - bh / 2 - 1, 2.8 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    backpack(ctx, bx, by, bw, bh, fill >= 1 ? '#b0582c' : '#9a6233');
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + 6 * s, 10 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // legs
  ctx.fillStyle = '#4a3a2c';
  const step = o.moving ? Math.sin(now * 0.025) * 3 : 0;
  ctx.fillRect(x - 5 * s, y - 6 * s + step * 0.3, 4 * s, 10 * s);
  ctx.fillRect(x + 1 * s, y - 6 * s - step * 0.3, 4 * s, 10 * s);
  // body and head
  ctx.fillStyle = tunic;
  rrect(ctx, x - 8 * s, y - 22 * s + bob, 16 * s, 18 * s, 5 * s);
  ctx.fill();
  ctx.fillStyle = '#f1c79a';
  ctx.beginPath();
  ctx.arc(x, y - 28 * s + bob, 7 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hat || '#6b4226';
  ctx.beginPath();
  ctx.arc(x, y - 30 * s + bob, 7 * s, Math.PI, 0);
  ctx.fill();
  if (hat) ctx.fillRect(x - 9 * s, y - 31 * s + bob, 18 * s, 2.5 * s);   // a brim
  ctx.fillStyle = '#222';
  ctx.fillRect(x + (o.face || 1) * 2.5 * s - 1, y - 28 * s + bob, 2, 2);
  if (apron) {
    ctx.fillStyle = apron;
    rrect(ctx, x - 6 * s, y - 15 * s + bob, 12 * s, 12 * s, 2);
    ctx.fill();
  }
  // the tool: a swing when fighting or chopping; a merchant holds a coin pouch instead (Oleg's play: he had an axe)
  if (tool === 'pouch') {
    const px = x + (o.face || 1) * 9 * s, py = y - 12 * s + bob;
    ctx.fillStyle = '#c9a25a';
    ctx.beginPath();
    ctx.arc(px, py, 4.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a6a2a';
    ctx.fillRect(px - 2 * s, py - 6 * s, 4 * s, 2.5 * s);
    ctx.fillStyle = '#ffd34a';
    ctx.beginPath();
    ctx.arc(px, py + 0.5, 1.8 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  const swinging = (o.swing || 0) > 0 || o.chop;
  // gathering: wind up for most of the beat, then strike; other swings (a fight, the hammer, a woodcutter) at a steady pace,
  // less than half the speed they had (Oleg: the axe swung far too fast)
  const ph = o.phase, face = o.face || 1;
  const ang = swinging && ph != null ? (ph < 0.7 ? 0.5 - 1.9 * (ph / 0.7) : -1.4 + 2.0 * ((ph - 0.7) / 0.3))
    : swinging ? -1.2 + Math.sin(now * (tool === 'hammer' ? 0.022 : 0.016)) * 1.1 : 0.5;
  if (tool === 'hands') {
    // two hands: swinging as he walks; the front one working (digging, offering, building) when he is busy
    const swing = o.moving ? Math.sin(now * 0.025) * 3 : 0, work = swinging ? Math.sin(now * 0.014) * 4 : 0;
    ctx.fillStyle = '#f1c79a';
    ctx.beginPath();
    ctx.arc(x - face * 8 * s, y - 11 * s + bob - swing, 2.6 * s, 0, Math.PI * 2);
    ctx.arc(x + face * (9 + (swinging ? 2 : 0)) * s, y - (swinging ? 14 : 11) * s + bob + swing + work, 2.6 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  if (tool === 'pistol') {   // the arm out, the pistol pointed
    ctx.fillStyle = '#f1c79a';
    ctx.beginPath();
    ctx.arc(x + face * 10 * s, y - 15 * s + bob, 2.6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x + face * 15 * s, y - 16 * s + bob);
    ctx.scale(face, 1);
    icon(ctx, 'pistol', 0, 0, 14 * s);
    ctx.restore();
  }
  if (tool === 'pickaxe' || tool === 'hammer') {
    ctx.save();
    ctx.translate(x + face * 8 * s, y - 14 * s + bob);
    ctx.rotate(ang * face);
    ctx.fillStyle = '#7a5a36';
    ctx.fillRect(-1.5, -14 * s, 3, 16 * s);
    ctx.fillStyle = '#c9ced6';
    if (tool === 'hammer') ctx.fillRect(-5 * s, -17 * s, 10 * s, 5 * s);
    else {
      ctx.strokeStyle = '#c9ced6';
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath();
      ctx.arc(0, -6 * s, 9 * s, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (tool === 'axe' && o.spin != null) {
    // the whirl: arm and axe straight out, swung round one and a quarter turns, easing out
    const e = 1 - (1 - o.spin) ** 2, a = e * Math.PI * 2.5 * face;
    ctx.save();
    ctx.translate(x, y - 13 * s + bob);
    ctx.rotate(a);
    ctx.fillStyle = '#f1c79a';
    ctx.beginPath();
    ctx.arc(7 * s, 0, 2.6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5a36';
    ctx.fillRect(6 * s, -1.5, 17 * s, 3);
    ctx.fillStyle = '#e4e8ee';
    ctx.beginPath();
    ctx.moveTo(19 * s, -2);
    ctx.lineTo(25 * s, -8 * s);
    ctx.quadraticCurveTo(29 * s, 0, 25 * s, 8 * s);
    ctx.lineTo(19 * s, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (tool === 'axe') {
  ctx.save();
  ctx.translate(x + (o.face || 1) * 8 * s, y - 14 * s + bob);
  ctx.rotate(ang * (o.face || 1));
  ctx.fillStyle = '#7a5a36';
  ctx.fillRect(-1.5, -14 * s, 3, 16 * s);
  ctx.fillStyle = '#c9ced6';
  ctx.fillRect(-1.5 + (o.face || 1) * 1, -16 * s, (o.face || 1) * 7 * s, 6 * s);
  ctx.restore();
  }
  if (hp < 1) {
    const low = hp <= 0.4, blink = low && Math.sin(now * 0.025) > 0;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 15, y + 9, 30, 6);
    ctx.fillStyle = low ? (blink ? '#ffffff' : '#ff4a3a') : '#7fd36b';
    ctx.fillRect(x - 14, y + 10, 28 * Math.max(0, hp), 4);
  }
}

function drawEnemy(ctx, x, y, e, now, night) {
  const brute = e.kind === 'brute', thief = e.kind === 'runner', s = brute ? 1.7 : thief ? 0.85 : 1, wob = Math.sin(now * 0.012 + e.wob) * 2;
  if (thief) {   // the ember thief: a smouldering glow round it and sparks trailing
    const g = ctx.createRadialGradient(x, y - 10, 2, x, y - 10, 22);
    g.addColorStop(0, `rgba(255,140,40,${0.55 + 0.2 * Math.sin(now * 0.02 + e.wob)})`);
    g.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y - 10, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffb347';
    for (let k = 0; k < 3; k++) {
      const t = (now * 0.004 + k / 3 + e.wob) % 1;
      ctx.fillRect(x - (e.face || 1) * (6 + t * 14), y - 8 - t * 10 + k * 3, 2.5, 2.5);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + 5 * s, 10 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = e.flash > 0 ? '#ffffff' : brute ? '#3b1f2e' : thief ? '#5a2410' : '#2c2340';
  ctx.beginPath();
  ctx.moveTo(x - 10 * s, y + 4 * s);
  ctx.quadraticCurveTo(x - 12 * s, y - 20 * s + wob, x, y - 24 * s + wob);
  ctx.quadraticCurveTo(x + 12 * s, y - 20 * s + wob, x + 10 * s, y + 4 * s);
  // ragged hem
  for (let k = 3; k >= -3; k--) ctx.lineTo(x + k * 3 * s, y + (k % 2 ? 1 : 5) * s + Math.sin(now * 0.02 + k) * 1.5);
  ctx.closePath();
  ctx.fill();
  if (brute) {
    ctx.fillStyle = '#d8d0c0';
    ctx.beginPath();
    ctx.moveTo(x - 9 * s, y - 18 * s + wob);
    ctx.lineTo(x - 14 * s, y - 30 * s + wob);
    ctx.lineTo(x - 5 * s, y - 21 * s + wob);
    ctx.moveTo(x + 9 * s, y - 18 * s + wob);
    ctx.lineTo(x + 14 * s, y - 30 * s + wob);
    ctx.lineTo(x + 5 * s, y - 21 * s + wob);
    ctx.fill();
  }
  ctx.fillStyle = brute ? '#ff5a3c' : thief ? '#ffe14a' : night ? '#9ff6ff' : '#cfe8ff';
  const ex = (e.face || 1) * 2 * s;
  ctx.beginPath();
  ctx.arc(x - 4 * s + ex, y - 14 * s + wob, 2.2 * s, 0, Math.PI * 2);
  ctx.arc(x + 4 * s + ex, y - 14 * s + wob, 2.2 * s, 0, Math.PI * 2);
  ctx.fill();
  if (e.hp < e.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 11 * s, y - 32 * s, 22 * s, 3.5);
    ctx.fillStyle = '#ff6a4a';
    ctx.fillRect(x - 11 * s, y - 32 * s, 22 * s * Math.max(0, e.hp / e.maxHp), 3.5);
  }
}

export function drawFire(ctx, v, world, now, flames = 1) {
  const f = world.fire, x = v.sx(f.x), y = v.sy(f.y), k = f.hp / f.max;
  const glow = ctx.createRadialGradient(x, y - 6, 4, x, y - 6, 60 + 30 * k);
  glow.addColorStop(0, `rgba(255,180,80,${0.25 + 0.3 * k})`);
  glow.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 100, y - 100, 200, 200);
  sprite(ctx, 'campfire', x, y + 2, 52);
  const flick = (fq) => 1 + 0.13 * Math.sin(now * 0.018 * fq) + 0.07 * Math.sin(now * 0.043 * fq);
  const s = (0.55 + 0.6 * k) * flames;
  for (const [col, w, h, fq] of [['#ff7a2e', 13, 34, 1], ['#ffb43c', 9, 25, 1.3], ['#fff1b0', 4.5, 13, 1.7]]) {
    const hh = h * s * flick(fq), ww = w * s;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - ww, y - 2);
    ctx.quadraticCurveTo(x - ww * 0.9, y - hh * 0.6, x, y - 2 - hh);
    ctx.quadraticCurveTo(x + ww * 0.9, y - hh * 0.6, x + ww, y - 2);
    ctx.closePath();
    ctx.fill();
  }
}

// everything that stands on the ground, back to front
// the hero once more, faintly, over everything (Mia's playtest: at night she lost him behind the fire and the cart)
export function drawHeroGhost(ctx, v, world, now) {
  const h = world.hero;
  if (h.dead) return;
  ctx.save();
  ctx.globalAlpha = 0.35;
  const ht = heroTool(world);
  drawPerson(ctx, v.sx(h.x), v.sy(h.y), { ...h, chop: ht.busy, phase: ht.phase, spin: ht.spin }, now, { carrying: h.stack, cap: h.cap, hp: h.hp / BAL.hero.hp, tool: ht.tool });
  ctx.restore();
}

export function drawScene(ctx, v, world, now, night) {
  const items = [];
  for (const n of world.nodes) items.push([n.y + 0.3, () => drawNode(ctx, v, n, now)]);
  for (const p of world.pads) {
    if (p.level <= 0) continue;
    if (p.kind === 'tower') items.push([p.y + 0.3, () => drawTower(ctx, v, p, now, night)]);
    if (p.kind === 'wall') p.tiles.forEach(([tx, ty], k) => items.push([ty + 0.95, () => drawWallTile(ctx, v, p, tx, ty, k)]));
    if (p.kind === 'helper') items.push([p.y, () => drawHut(ctx, v.sx(p.x), v.sy(p.y), p.level, p.job, now)]);
  }
  items.push([world.market.y + BOOTH_DY, () => drawBooth(ctx, v, world, now)]);
  items.push([BAL.woodpile.y + 0.2, () => drawPile(ctx, v, world, now)]);
  items.push([world.fire.y + 0.2, () => drawFire(ctx, v, world, now, world.flames ?? 1)]);
  const h = world.hero;
  const ht = heroTool(world);
  if (!h.dead) items.push([h.y, () => drawPerson(ctx, v.sx(h.x), v.sy(h.y), { ...h, chop: ht.busy, phase: ht.phase, spin: ht.spin }, now, { carrying: h.stack, cap: h.cap, hp: h.hp / BAL.hero.hp, tool: ht.tool })]);
  for (const hp of world.helpers) items.push([hp.y, () => drawPerson(ctx, v.sx(hp.x), v.sy(hp.y), { ...hp, chop: !hp.moving && world.phase === 'day' }, now, hp.job === 'stone' || hp.job === 'coal' ? { tunic: hp.job === 'coal' ? '#3a3a46' : '#7a6a8a', hat: '#d0a020', small: true, carrying: hp.stack, cap: BAL.helper.carry, tool: 'pickaxe' } : { tunic: '#7a9a3a', small: true, carrying: hp.stack, cap: BAL.helper.carry, tool: 'axe' })]);
  for (const e of world.enemies) items.push([e.y, () => drawEnemy(ctx, v.sx(e.x), v.sy(e.y), e, now, night)]);
  // what the horde drops lies on the ground, sorted with the rest (Oleg's play: coal drew over the hero): coal (walk over it,
  // then feed the fire) and coins (they fly to the hero)
  for (const c of world.coalOnGround) items.push([c.y - 0.3, () => {
    const x = v.sx(c.x), y = v.sy(c.y) - 4 - Math.abs(Math.sin(c.t * 9)) * 4 * Math.max(0, 1 - c.t);
    icon(ctx, 'coal', x, y, 13, `rgb(255,${Math.round(120 + 60 * Math.sin(now * 0.008 + c.x))},40)`);
  }]);
  for (const c of world.coinsOnGround) items.push([c.y - 0.3, () => {
    const x = v.sx(c.x), y = v.sy(c.y) - 6 - Math.abs(Math.sin(c.t * 9)) * 4 * Math.max(0, 1 - c.t);
    ctx.fillStyle = '#ffd34a';
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(x - 2, y - 3, 2.5, 2.5);
  }]);
  items.sort((a, b) => a[0] - b[0]);
  for (const [, f] of items) f();

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#f5e6c8';
  for (const a of world.arrows) {
    const x = v.sx(a.x), y = v.sy(a.y);
    if (a.bullet) {   // the pistol's shot: a short bright tracer
      ctx.strokeStyle = '#ffe9a0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a.ang) * 7, y - Math.sin(a.ang) * 7);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.strokeStyle = '#f5e6c8';
      ctx.lineWidth = 2;
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a.ang) * 9, y - Math.sin(a.ang) * 9);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
}

// the night: a dark layer with pools of light cut out (fire, towers, hero, helpers), drawn at half resolution
let light = null;
export function drawNight(ctx, v, world, dark, now) {
  if (dark <= 0.01) return;
  const { full } = v, k = 0.5, W = Math.ceil(full.w * k), H = Math.ceil(full.h * k);
  if (!light || light.width !== W || light.height !== H) {
    light = document.createElement('canvas');
    light.width = W;
    light.height = H;
  }
  const g = light.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, W, H);
  g.fillStyle = `rgba(6,9,28,${dark})`;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a = 1) => {
    const lx = (v.sx(x) - full.x) * k, ly = (v.sy(y) - full.y) * k, R = r * T * k;
    const gr = g.createRadialGradient(lx, ly, R * 0.15, lx, ly, R);
    gr.addColorStop(0, `rgba(0,0,0,${a})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(lx - R, ly - R, R * 2, R * 2);
  };
  const f = world.fire, flick = 1 + 0.04 * Math.sin(now * 0.02) + 0.03 * Math.sin(now * 0.051);
  hole(f.x, f.y, (3.6 + 2.6 * (f.hp / f.max)) * flick, 1);
  for (const p of world.pads) if (p.kind === 'tower' && p.level > 0 && !p.broken) hole(p.x, p.y - 0.6, 2.4, 0.85);
  if (!world.hero.dead) hole(world.hero.x, world.hero.y, 2.7, 0.8);
  for (const hp of world.helpers) hole(hp.x, hp.y, 1.6, 0.6);
  hole(world.market.x, world.market.y - 1, 1.7, 0.55);
  // pads on offer glow, so they read as open by night too
  for (const p of world.pads) if (padCost(p) != null) hole(p.x, p.y, 1.1, 0.75);
  // drops glow in the dark (Oleg's play: kills seemed to drop nothing)
  for (const c of world.coinsOnGround) hole(c.x, c.y, 0.55, 0.7);
  for (const c of world.coalOnGround) hole(c.x, c.y, 0.7, 0.75);
  ctx.drawImage(light, full.x, full.y, full.w, full.h);
}
