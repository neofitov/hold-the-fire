// Wordless icons for the HUD, the banners and the game-over card (the expert review: icons and arrows instead of English, for
// a young, worldwide audience). Each draws centred on (x, y), about s pixels across.
import { sprite } from '../lib/media.js';

export function icon(ctx, kind, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  switch (kind) {
    case 'sun': {
      ctx.fillStyle = color || '#ffd25a';
      ctx.strokeStyle = color || '#ffd25a';
      ctx.lineWidth = Math.max(1.5, s * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.26, 0, Math.PI * 2);
      ctx.fill();
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * s * 0.36, Math.sin(a) * s * 0.36);
        ctx.lineTo(Math.cos(a) * s * 0.48, Math.sin(a) * s * 0.48);
        ctx.stroke();
      }
      break;
    }
    case 'moon': {
      ctx.fillStyle = color || '#dfe6ff';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2);
      ctx.arc(s * 0.2, -s * 0.12, s * 0.34, 0, Math.PI * 2, true);
      ctx.fill('evenodd');
      break;
    }
    case 'coin': {
      ctx.fillStyle = '#ffd34a';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b8860b';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'hollow': {   // the enemy's hooded head with its two eyes
      ctx.fillStyle = color || '#2c2340';
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, s * 0.42);
      ctx.quadraticCurveTo(-s * 0.48, -s * 0.38, 0, -s * 0.46);
      ctx.quadraticCurveTo(s * 0.48, -s * 0.38, s * 0.4, s * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#9ff6ff';
      ctx.beginPath();
      ctx.arc(-s * 0.14, -s * 0.06, s * 0.08, 0, Math.PI * 2);
      ctx.arc(s * 0.14, -s * 0.06, s * 0.08, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'fire': {
      // a flame (Dana's playtest: the little campfire picture by the fire's bar read as "a pink brain")
      ctx.fillStyle = '#ff7a1a';
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.5);
      ctx.bezierCurveTo(s * 0.18, -s * 0.22, s * 0.42, -s * 0.05, s * 0.34, s * 0.2);
      ctx.bezierCurveTo(s * 0.28, s * 0.42, -s * 0.28, s * 0.42, -s * 0.34, s * 0.2);
      ctx.bezierCurveTo(-s * 0.4, -s * 0.02, -s * 0.12, -s * 0.18, 0, -s * 0.5);
      ctx.fill();
      ctx.fillStyle = '#ffd34a';
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.18);
      ctx.bezierCurveTo(s * 0.12, -s * 0.02, s * 0.2, s * 0.1, s * 0.16, s * 0.24);
      ctx.bezierCurveTo(s * 0.1, s * 0.34, -s * 0.12, s * 0.34, -s * 0.16, s * 0.24);
      ctx.bezierCurveTo(-s * 0.2, s * 0.1, -s * 0.06, s * 0.0, 0, -s * 0.18);
      ctx.fill();
      break;
    }
    case 'wood':
      sprite(ctx, 'wood', 0, 0, s * 1.1);
      break;
    case 'stone': {
      // a grey stone, like the rocks it comes from (Mia's playtest: the pink stone picture looked like ham)
      ctx.fillStyle = '#6f727a';
      ctx.beginPath();
      ctx.moveTo(-s * 0.44, s * 0.28);
      ctx.lineTo(-s * 0.36, -s * 0.12);
      ctx.lineTo(-s * 0.08, -s * 0.36);
      ctx.lineTo(s * 0.3, -s * 0.28);
      ctx.lineTo(s * 0.46, s * 0.06);
      ctx.lineTo(s * 0.36, s * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#a3a6ae';
      ctx.beginPath();
      ctx.moveTo(-s * 0.34, s * 0.14);
      ctx.lineTo(-s * 0.28, -s * 0.1);
      ctx.lineTo(-s * 0.06, -s * 0.28);
      ctx.lineTo(s * 0.26, -s * 0.2);
      ctx.lineTo(s * 0.34, s * 0.04);
      ctx.lineTo(s * 0.04, s * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#d2d4da';
      ctx.fillRect(-s * 0.14, -s * 0.22, s * 0.18, s * 0.08);
      break;
    }
    case 'pack':
      backpack(ctx, 0, s * 0.05, s * 0.62, s * 0.78, color);
      break;
    case 'coal': {
      ctx.fillStyle = '#26221f';
      ctx.beginPath();
      ctx.moveTo(-s * 0.42, s * 0.2);
      ctx.lineTo(-s * 0.25, -s * 0.3);
      ctx.lineTo(s * 0.15, -s * 0.38);
      ctx.lineTo(s * 0.42, -s * 0.05);
      ctx.lineTo(s * 0.3, s * 0.32);
      ctx.lineTo(-s * 0.1, s * 0.38);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = color || '#ff8a3a';
      ctx.fillRect(-s * 0.12, -s * 0.1, s * 0.12, s * 0.08);
      ctx.fillRect(s * 0.1, s * 0.08, s * 0.1, s * 0.07);
      break;
    }
    case 'crown': {
      ctx.fillStyle = color || '#ffd34a';
      ctx.beginPath();
      ctx.moveTo(-s * 0.45, s * 0.3);
      ctx.lineTo(-s * 0.45, -s * 0.2);
      ctx.lineTo(-s * 0.22, s * 0.02);
      ctx.lineTo(0, -s * 0.38);
      ctx.lineTo(s * 0.22, s * 0.02);
      ctx.lineTo(s * 0.45, -s * 0.2);
      ctx.lineTo(s * 0.45, s * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e0503a';
      ctx.beginPath();
      ctx.arc(0, s * 0.12, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'heart': {
      ctx.fillStyle = color || '#ff5a5a';
      ctx.beginPath();
      ctx.moveTo(0, s * 0.38);
      ctx.bezierCurveTo(-s * 0.55, s * 0.0, -s * 0.42, -s * 0.48, 0, -s * 0.18);
      ctx.bezierCurveTo(s * 0.42, -s * 0.48, s * 0.55, s * 0.0, 0, s * 0.38);
      ctx.fill();
      break;
    }
    case 'star': {
      ctx.fillStyle = color || '#ffe9a8';
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? s * 0.2 : s * 0.48;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'tower': {   // an arrow tower: planks, a red roof, a flag, an arrow flying off
      ctx.fillStyle = '#9c7445';
      ctx.fillRect(-s * 0.2, -s * 0.12, s * 0.4, s * 0.5);
      ctx.fillStyle = '#5e3c1e';
      for (const y of [0.04, 0.2]) ctx.fillRect(-s * 0.2, s * y, s * 0.4, s * 0.04);
      ctx.fillRect(-s * 0.26, -s * 0.16, s * 0.52, s * 0.08);
      ctx.fillStyle = '#c8473b';
      ctx.beginPath();
      ctx.moveTo(-s * 0.3, -s * 0.16);
      ctx.lineTo(0, -s * 0.44);
      ctx.lineTo(s * 0.3, -s * 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffe9a8';   // the arrow
      ctx.fillRect(s * 0.16, -s * 0.36, s * 0.3, s * 0.05);
      ctx.beginPath();
      ctx.moveTo(s * 0.5, -s * 0.335);
      ctx.lineTo(s * 0.4, -s * 0.4);
      ctx.lineTo(s * 0.4, -s * 0.27);
      ctx.fill();
      break;
    }
    case 'wall': {   // palisade stakes
      for (let k = -2; k <= 2; k++) {
        ctx.fillStyle = k % 2 ? '#8a5f36' : '#9c7445';
        ctx.fillRect(k * s * 0.17 - s * 0.075, -s * 0.22, s * 0.15, s * 0.58);
        ctx.beginPath();
        ctx.moveTo(k * s * 0.17 - s * 0.075, -s * 0.22);
        ctx.lineTo(k * s * 0.17, -s * 0.38);
        ctx.lineTo(k * s * 0.17 + s * 0.075, -s * 0.22);
        ctx.fill();
      }
      ctx.fillStyle = '#5e3c1e';
      ctx.fillRect(-s * 0.46, s * 0.02, s * 0.92, s * 0.06);
      break;
    }
    case 'pistol': {   // a flintlock pistol: a wooden grip, a dark barrel
      ctx.save();
      ctx.rotate(-0.15);
      ctx.fillStyle = color || '#3a3d44';
      ctx.fillRect(-s * 0.36, -s * 0.2, s * 0.78, s * 0.14);
      ctx.fillStyle = '#9c6b3a';
      ctx.beginPath();
      ctx.moveTo(-s * 0.36, -s * 0.08);
      ctx.lineTo(-s * 0.08, -s * 0.08);
      ctx.lineTo(-s * 0.18, s * 0.36);
      ctx.lineTo(-s * 0.42, s * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#3a3d44';
      ctx.lineWidth = Math.max(1.5, s * 0.05);
      ctx.beginPath();
      ctx.arc(-s * 0.04, s * 0.02, s * 0.09, 0, Math.PI);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'pickaxe': {   // a pickaxe: a handle and a curved double point
      ctx.save();
      ctx.rotate(-0.6);
      ctx.fillStyle = '#9c6b3a';
      ctx.fillRect(-s * 0.05, -s * 0.3, s * 0.1, s * 0.75);
      ctx.strokeStyle = color || '#c9ced6';
      ctx.lineWidth = s * 0.12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, s * 0.05, s * 0.42, -Math.PI * 0.82, -Math.PI * 0.18);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'axe': {   // an axe: a handle and a broad blade, flat like the pickaxe and the hammer
      ctx.save();
      ctx.rotate(-0.6);
      ctx.fillStyle = '#9c6b3a';
      ctx.fillRect(-s * 0.05, -s * 0.36, s * 0.1, s * 0.8);
      ctx.fillStyle = color || '#c9ced6';   // the head: narrow at the handle, a broad curved edge
      ctx.beginPath();
      ctx.moveTo(s * 0.04, -s * 0.34);
      ctx.lineTo(s * 0.26, -s * 0.44);
      ctx.quadraticCurveTo(s * 0.42, -s * 0.26, s * 0.26, -s * 0.06);
      ctx.lineTo(s * 0.04, -s * 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(s * 0.27, -s * 0.36, s * 0.05, s * 0.22);
      ctx.restore();
      break;
    }
    case 'badge-up': case 'badge-frost': case 'badge-burn': case 'badge-coin': case 'badge-new': {
      // a card's corner badge: what kind of help it is (green: more; blue: slows; red: burns; gold: coins; gold star: a tool)
      const bg = { 'badge-up': '#3a9a4a', 'badge-frost': '#3a78c0', 'badge-burn': '#c0442e', 'badge-coin': '#b8860b', 'badge-new': '#d09a1a' }[kind];
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1.5, s * 0.08);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      if (kind === 'badge-up') {
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.3);
        ctx.lineTo(s * 0.26, 0);
        ctx.lineTo(s * 0.1, 0);
        ctx.lineTo(s * 0.1, s * 0.28);
        ctx.lineTo(-s * 0.1, s * 0.28);
        ctx.lineTo(-s * 0.1, 0);
        ctx.lineTo(-s * 0.26, 0);
        ctx.closePath();
        ctx.fill();
      } else if (kind === 'badge-new') {
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? s * 0.13 : s * 0.32;
          ctx[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
      } else if (kind === 'badge-frost') icon(ctx, 'snow', 0, 0, s * 0.72, '#ffffff');
      else if (kind === 'badge-burn') icon(ctx, 'hollow', 0, s * 0.04, s * 0.62, '#ffffff');   // it hurts the monsters
      else if (kind === 'badge-coin') {
        ctx.fillStyle = '#ffd34a';
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b8860b';
        ctx.fillRect(-s * 0.04, -s * 0.15, s * 0.08, s * 0.3);
      }
      break;
    }
    case 'hammer': {   // a hammer: a handle and a square head
      ctx.save();
      ctx.rotate(-0.6);
      ctx.fillStyle = '#9c6b3a';
      ctx.fillRect(-s * 0.05, -s * 0.2, s * 0.1, s * 0.66);
      ctx.fillStyle = color || '#8f939a';
      ctx.fillRect(-s * 0.3, -s * 0.38, s * 0.6, s * 0.24);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(-s * 0.3, -s * 0.38, s * 0.6, s * 0.06);
      ctx.restore();
      break;
    }
    case 'no': {   // a red circle with a slash, drawn over another icon
      ctx.strokeStyle = '#ff4a3a';
      ctx.lineWidth = Math.max(2.5, s * 0.1);
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2);
      ctx.moveTo(-s * 0.3, s * 0.3);
      ctx.lineTo(s * 0.3, -s * 0.3);
      ctx.stroke();
      break;
    }
    case 'snow': {   // a snowflake: six arms with little branches
      ctx.strokeStyle = color || '#bfe8ff';
      ctx.lineWidth = Math.max(2, s * 0.07);
      ctx.lineCap = 'round';
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3, c = Math.cos(a), d = Math.sin(a);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(c * s * 0.44, d * s * 0.44);
        for (const r of [0.2, 0.32]) {
          ctx.moveTo(c * s * r, d * s * r);
          ctx.lineTo(c * s * r + Math.cos(a + 0.8) * s * 0.1, d * s * r + Math.sin(a + 0.8) * s * 0.1);
          ctx.moveTo(c * s * r, d * s * r);
          ctx.lineTo(c * s * r + Math.cos(a - 0.8) * s * 0.1, d * s * r + Math.sin(a - 0.8) * s * 0.1);
        }
        ctx.stroke();
      }
      break;
    }
    case 'spin': {   // the spin attack: an axe ringed by two chasing arrows
      icon(ctx, 'axe', 0, s * 0.02, s * 0.62);
      ctx.strokeStyle = color || '#ffffff';
      ctx.fillStyle = color || '#ffffff';
      ctx.lineWidth = Math.max(3, s * 0.09);
      for (const a0 of [0, Math.PI]) {
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.44, a0 + 0.3, a0 + 2.5);
        ctx.stroke();
        const a = a0 + 2.5, x = Math.cos(a) * s * 0.44, y = Math.sin(a) * s * 0.44, tx = -Math.sin(a), ty = Math.cos(a);
        ctx.beginPath();
        ctx.moveTo(x + tx * s * 0.16, y + ty * s * 0.16);
        ctx.lineTo(x + Math.cos(a) * s * 0.12, y + Math.sin(a) * s * 0.12);
        ctx.lineTo(x - Math.cos(a) * s * 0.12, y - Math.sin(a) * s * 0.12);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'boot': {   // a boot with speed lines
      ctx.fillStyle = '#9c6b3a';
      ctx.beginPath();
      ctx.moveTo(-s * 0.12, -s * 0.42);
      ctx.lineTo(s * 0.14, -s * 0.42);
      ctx.lineTo(s * 0.14, s * 0.08);
      ctx.lineTo(s * 0.44, s * 0.16);
      ctx.lineTo(s * 0.44, s * 0.34);
      ctx.lineTo(-s * 0.12, s * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5e3c1e';
      ctx.fillRect(-s * 0.12, s * 0.26, s * 0.56, s * 0.08);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (const [y, w] of [[-0.24, 0.26], [-0.06, 0.34], [0.12, 0.22]]) ctx.fillRect(-s * 0.2 - s * w, s * y, s * w, s * 0.06);
      break;
    }
    case 'replay': {   // a circular arrow
      ctx.strokeStyle = color || '#ffffff';
      ctx.fillStyle = color || '#ffffff';
      ctx.lineWidth = s * 0.13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.32, -Math.PI * 0.35, Math.PI * 1.35);
      ctx.stroke();
      const a = -Math.PI * 0.35, ex = Math.cos(a) * s * 0.32, ey = Math.sin(a) * s * 0.32;
      ctx.beginPath();
      ctx.moveTo(ex + s * 0.2, ey - s * 0.02);
      ctx.lineTo(ex - s * 0.04, ey - s * 0.2);
      ctx.lineTo(ex - s * 0.02, ey + s * 0.12);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

// a leather backpack w x h, centred on (x, y): the hero's load (Oleg's play: wood piled on the head read badly), also the HUD icon
export function backpack(ctx, x, y, w, h, color = '#9a6233') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,24,10,0.65)';
  ctx.lineWidth = Math.max(1, w * 0.08);
  ctx.stroke();
  // the flap and its buckle
  ctx.fillStyle = 'rgba(60,34,14,0.45)';
  ctx.beginPath();
  ctx.roundRect(x - w * 0.42, y - h * 0.48, w * 0.84, h * 0.42, Math.min(w, h) * 0.22);
  ctx.fill();
  ctx.fillStyle = '#e2c27a';
  ctx.fillRect(x - w * 0.08, y - h * 0.1, w * 0.16, h * 0.12);
  // a pocket
  ctx.strokeStyle = 'rgba(40,24,10,0.45)';
  ctx.strokeRect(x - w * 0.28, y + h * 0.12, w * 0.56, h * 0.26);
  ctx.restore();
}
