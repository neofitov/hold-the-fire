// Drawing helpers shared by the menu and both prototypes
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(t, 0, 1))).toString(16).padStart(2, '0')).join('');
}
export const shade = (hex, k) => (k < 0 ? mix(hex, '#000000', -k) : mix(hex, '#ffffff', k));

export function text(ctx, str, x, y, { size = 16, color = '#ffffff', align = 'center', weight = 600, baseline = 'middle', shadow = true, alpha = 1 } = {}) {
  ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.globalAlpha = alpha;
  if (shadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillText(str, x + 1, y + 1.5);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.globalAlpha = 1;
}

// wrap a paragraph to a width; returns the y after the last line
export function para(ctx, str, x, y, width, opts = {}) {
  const size = opts.size || 15, lh = opts.lineHeight || size * 1.35;
  ctx.font = `${opts.weight || 500} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const words = str.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > width && line) {
      text(ctx, line, x, y, { ...opts, size });
      y += lh;
      line = w;
    } else line = test;
  }
  if (line) text(ctx, line, x, y, { ...opts, size });
  return y + lh;
}

export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export const hit = (b, p) => !!b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

export function button(ctx, b, { color = '#e0893a', textColor = '#ffffff', size = 17 } = {}) {
  ctx.save();
  rrect(ctx, b.x, b.y + 3, b.w, b.h, 12);
  ctx.fillStyle = shade(color, -0.35);
  ctx.fill();
  rrect(ctx, b.x, b.y, b.w, b.h, 12);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
  text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, { size, color: textColor, weight: 700 });
}

// a small round icon button (menu, restart, sound)
export function iconButton(ctx, b, glyph) {
  rrect(ctx, b.x, b.y, b.w, b.h, b.h / 2);
  ctx.fillStyle = 'rgba(20,24,40,0.45)';
  ctx.fill();
  text(ctx, glyph, b.x + b.w / 2, b.y + b.h / 2 + 1, { size: 18, shadow: false });
}

// a centred panel with a title, lines and buttons laid out under them; sets each button's rectangle for hit tests
export function panel(ctx, { title, lines = [], buttons = [], y = 250, color = '#fff6e3', cx = 210 }) {
  const w = 340, x = cx - w / 2, h = 110 + lines.length * 26 + buttons.length * 58;
  ctx.fillStyle = 'rgba(8,10,24,0.55)';
  ctx.fillRect(-4000, -4000, 9000, 9000);
  rrect(ctx, x, y, w, h, 18);
  ctx.fillStyle = 'rgba(38,30,48,0.94)';
  ctx.fill();
  text(ctx, title, cx, y + 42, { size: 24, color, weight: 800 });
  lines.forEach((l, i) => text(ctx, l, cx, y + 82 + i * 26, { size: 16, color: '#e8dcc8', weight: 500 }));
  buttons.forEach((b, i) => {
    Object.assign(b, { x: x + 30, y: y + 96 + lines.length * 26 + i * 58, w: w - 60, h: 46 });
    button(ctx, b, { color: b.color || '#e0893a' });
  });
}
