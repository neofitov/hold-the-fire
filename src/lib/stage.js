// The canvas and its virtual space: every scene draws and hit-tests in these units. Portrait fits a 420 x 780 box; a landscape
// window (Poki's 16:9 desktop frame, a phone on its side) is 560 units tall, so the HUD stays readable in a short frame
export const VW = 420, VH = 780, LANDSCAPE_H = 560;
// pixel mode (the default; ?pixel=0 turns it off, ?pixel=3 fixes the size): the WORLD is drawn into a small canvas, about 270 art
// pixels on the short side, and blown up by a whole number of screen pixels, so every art pixel is a sharp square; the HUD and
// the words are drawn on top at full resolution (Oleg: the first pixel look blurred everything, the backpack's counts too)
const args = new URLSearchParams(location.search);
const q = args.get('pixel'), PIXEL_ARG = q == null ? 1 : Number(q) || 0;   // on unless ?pixel=0
// a phone (a touch screen under 600 on its short side) sees the world 1.5x bigger (Oleg's phone test: objects too small);
// ?zoom=1.5 forces it anywhere
const ZOOM_ARG = Number(args.get('zoom')) || 0, PHONE_ZOOM = 1.5;
const touchy = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

export function createStage(canvas) {
  const ctx = canvas.getContext('2d');
  const s = { canvas, ctx, dpr: 1, scale: 1, ox: 0, oy: 0, w: 0, h: 0, pixel: 0, zoom: 1, low: null, lctx: null };
  // the canvas fills the window by CSS (index.html), and its size is read from the canvas itself: a phone turned upright
  // still reported the old, wider window for a moment and the game was cut off on the right (Oleg's phone test)
  const resize = () => {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(r.width) || window.innerWidth, h = Math.round(r.height) || window.innerHeight;
    if (w === s.w && h === s.h && dpr === s.dpr) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    Object.assign(s, { dpr, w, h, scale: w > h ? h / LANDSCAPE_H : Math.min(w / VW, h / VH) });
    s.zoom = ZOOM_ARG || (touchy() && Math.min(w, h) < 600 ? PHONE_ZOOM : 1);
    s.ox = (w - VW * s.scale) / 2;
    s.oy = (h - VH * s.scale) / 2;
    // screen pixels per art pixel: a whole number
    s.pixel = PIXEL_ARG >= 2 ? Math.round(Math.min(8, PIXEL_ARG) * dpr) : PIXEL_ARG ? Math.max(2, Math.round(Math.min(canvas.width, canvas.height) / 270)) : 0;
    if (s.pixel) {
      s.low = s.low || document.createElement('canvas');
      s.low.width = Math.ceil(canvas.width / s.pixel);
      s.low.height = Math.ceil(canvas.height / s.pixel);
      s.lctx = s.low.getContext('2d');
    }
  };
  window.addEventListener('resize', resize);
  // a turn of the phone settles over a few frames: look again once it has
  window.addEventListener('orientationchange', () => [100, 300, 700].forEach((ms) => setTimeout(resize, ms)));
  window.visualViewport?.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  resize();
  // fullscreen, where the browser allows it (not an iPhone, nor a frame that forbids it); asked for on a finger's lift,
  // which is when a phone's browser lets a page go fullscreen
  const doc = document, el = doc.documentElement;
  s.canFull = !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
  // a phone page of its own without it (an iPhone, a chat app's browser) still gets the button, which then says how; not in a
  // frame (Poki has its own fullscreen) nor when started from the home screen (already full)
  s.ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const framed = (() => { try { return window.top !== window.self; } catch { return true; } })();
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  s.fullButton = !framed && (s.canFull || (touchy() && !standalone));   // in a frame (Poki's) its player has its own
  s.isFull = () => !!(doc.fullscreenElement || doc.webkitFullscreenElement);
  s.toggleFull = () => {
    try {
      if (s.isFull()) (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
      else (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' })?.catch?.(() => {});
    } catch {}
  };
  // clear the whole window, then draw in virtual units
  s.begin = (fill) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const k = s.dpr * s.scale;
    ctx.setTransform(k, 0, 0, k, s.dpr * s.ox, s.dpr * s.oy);
  };
  // where the world is drawn: the small canvas in pixel mode (same virtual units), else the screen itself
  s.beginWorld = (fill) => {
    if (!s.pixel) return ctx;
    const l = s.lctx, k = (s.dpr * s.scale) / s.pixel;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.fillStyle = fill;
    l.fillRect(0, 0, s.low.width, s.low.height);
    l.setTransform(k, 0, 0, k, (s.dpr * s.ox) / s.pixel, (s.dpr * s.oy) / s.pixel);
    return l;
  };
  // the world onto the screen, each art pixel a sharp square
  s.endWorld = () => {
    if (!s.pixel) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(s.low, 0, 0, s.low.width * s.pixel, s.low.height * s.pixel);
    ctx.restore();
  };
  s.toVirtual = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left - s.ox) / s.scale, y: (e.clientY - r.top - s.oy) / s.scale, touch: e.pointerType === 'touch' };
  };
  // the virtual rectangle that covers the whole window (backgrounds bleed past the letterbox)
  s.full = () => ({ x: -s.ox / s.scale, y: -s.oy / s.scale, w: s.w / s.scale, h: s.h / s.scale });
  return s;
}
