import { createEye, PALETTES } from '../../kit/eye.js';
import { reducedMotion, finePointer, qualityTier, cappedDpr, usePoster } from '../../../shared/base.js';

const root = document.documentElement;
const canvas = document.getElementById('eye');
const goat = document.getElementById('goat');
const slot = document.getElementById('slot');
const A = 6, HX = 685, HY = 198; // the looking kid's live eye, in the svg's 770 x 430 box (feet line at y = 300)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

const goldway = root.classList.contains('c-gold');
const PAL_GOLD = { paper: '#f6e7c3', ink: '#4a0d0a', block: '#c08a2e' };
const tier = qualityTier();
const still = reducedMotion();
let eye = null;
if (tier > 0) {
  try { eye = createEye(canvas, { palette: goldway ? PAL_GOLD : PALETTES.newyear, dpr: cappedDpr(tier), onLost: () => { eye = null; fallback(); } }); } catch (e) { eye = null; }
}
function fallback() { usePoster(canvas); root.classList.remove('live'); layout(true); }
if (!eye) usePoster(canvas); else root.classList.add('live');
const isStatic = still || !eye;
if (isStatic) root.classList.add('static');
if (eye && still) eye.state.still = true;

let W, H, M, phone, L, lastStep = -1, lastFlood = -1;

function geom() {
  W = innerWidth; H = innerHeight; M = Math.min(W, H);
  phone = W <= 760 && H > W;
  const Send = phone ? 1.32 : 1;
  const end = { cx: W / 2, cy: H / 2 - (phone ? 0.16 : 0.02) * M };
  const kEnd = 0.66 * M * Send / A;
  let k0, c0, r0;
  if (phone) {
    k0 = (W - 16) / 770;
    const feet = 0.44 * H, w = W - 24;
    c0 = { cx: 8 + HX * k0, cy: feet - (300 - HY) * k0 };
    r0 = { x: 12, y: feet, w, h: w / 4.2 };
  } else {
    k0 = 0.9 * W / 770;
    const feet = Math.min(0.58 * H, H - 330);
    const w = Math.min(0.76 * W, 1120);
    c0 = { cx: (W - 0.9 * W) / 2 + HX * k0, cy: feet - (300 - HY) * k0 };
    r0 = { x: (W - w) / 2, y: feet, w, h: Math.min(w / 7, 0.17 * H) };
  }
  const ew = 0.66 * M * Send, eh = 0.156 * M * Send;
  const re = { x: end.cx - ew / 2, y: end.cy - eh / 2, w: ew, h: eh };
  L = { k0, c0, kEnd, end, r0, re, Send };
}

// the eye opening of kit/eye.js at rest (same cut as horned-mask), so only the eye prints over the bone paper
let cx0 = 0, cy0 = 0, ck = 1;
function socketPath() {
  const s = A * ck / (0.66 * M), c = [(cx0 - W / 2) / M, (H / 2 - cy0) / M];
  const Wd = 0.66, grow = 0.014;
  const X = (qx) => (W / 2 + (c[0] + qx * s) * M).toFixed(1) + 'px';
  const Y = (qy) => (H / 2 - (c[1] + qy * s) * M).toFixed(1) + 'px';
  const up = (xn) => { const k = 1 - xn * xn; return 0.292 * Math.pow(k, 0.7) + 0.04 * xn * k + grow; };
  const lo = (xn) => { const k = 1 - xn * xn; return -0.25 * Math.pow(k, 0.86) + 0.022 * xn * k - grow; };
  const pts = [`${X(-Wd - 0.02)} ${Y(0)}`];
  const N = 28;
  for (let i = 1; i < N; i++) { const xn = -1 + (2 * i) / N; pts.push(`${X(Wd * xn)} ${Y(up(xn))}`); }
  pts.push(`${X(Wd + 0.02)} ${Y(0)}`);
  for (let i = N - 1; i > 0; i--) { const xn = -1 + (2 * i) / N; pts.push(`${X(Wd * xn)} ${Y(lo(xn))}`); }
  return `polygon(${pts.join(', ')})`;
}

function headT(cx, cy, k, rot) {
  goat.style.transform = `translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px) rotate(${rot || 0}deg) scale(${k.toFixed(4)}) translate(${-HX}px,${-HY}px)`;
}

function setEye(cx, cy, k) {
  cx0 = cx; cy0 = cy; ck = k;
  canvas.style.setProperty('--socket', socketPath());
  if (!eye) return;
  eye.state.lid = 0; eye.state.passY = 1; eye.state.passK = 1;
  eye.state.scale = A * k / (0.66 * M);
  eye.state.center = [(cx - W / 2) / M, (H / 2 - cy) / M];
}

function placeSlot(r) {
  slot.style.left = r.x.toFixed(1) + 'px'; slot.style.top = r.y.toFixed(1) + 'px';
  slot.style.width = r.w.toFixed(1) + 'px'; slot.style.height = r.h.toFixed(1) + 'px';
}

function stepOf(y) {
  if (isStatic) return 0;
  const p = clamp(y / (0.95 * H), 0, 1);
  return p < 0.08 ? 0 : Math.min(7, 1 + Math.floor((p - 0.08) / 0.13));
}

function apply(i) {
  const { k0, c0, kEnd, end, r0, re } = L;
  let k, cx, cy, rot = 0;
  if (i <= 5) {
    const t = i / 5;
    k = k0 * Math.pow(kEnd / k0, t);
    cx = lerp(c0.cx, end.cx, t); cy = lerp(c0.cy, end.cy, t);
  } else { k = kEnd; cx = end.cx; cy = end.cy; }
  if (i === 6) { rot = -4; cx += 0.04 * W; cy -= 0.05 * H; }
  setEye(i === 6 ? end.cx : cx, i === 6 ? end.cy : cy, k);
  headT(cx, cy, k, rot);
  const gone = i >= 7;
  root.classList.toggle('head-gone', gone);
  if (gone && eye) { eye.render(performance.now() / 1000, 0); const p = eye.pupilRect(); placeSlot({ x: p.x, y: p.y, w: p.w, h: p.h }); }
  else { const t = Math.min(i, 6) / 6; placeSlot({ x: lerp(r0.x, re.x, t), y: lerp(r0.y, re.y, t), w: lerp(r0.w, re.w, t), h: lerp(r0.h, re.h, t) }); }
}

function layout(force) {
  geom();
  if (eye) eye.resize();
  const y = isStatic ? 0 : scrollY;
  lastStep = stepOf(y); apply(lastStep);
  onScroll(true);
}

function onScroll(force) {
  if (isStatic) return;
  const y = scrollY;
  const s = stepOf(y);
  if (s !== lastStep || force) { lastStep = s; apply(s); }
  const f = clamp((y - H) / (0.4 * H), 0, 1);
  if (f !== lastFlood || force) {
    lastFlood = f;
    root.style.setProperty('--flood', f);
    root.classList.toggle('flood-done', f > 0.01);
    root.classList.toggle('hero-gone', f >= 0.25);
    root.classList.toggle('slot-off', f >= 0.98);
    root.classList.toggle('stage-off', f >= 0.98);
    if (eye && goldway) eye.setPalette({ ...PAL_GOLD, block: f > 0.01 ? '#8f1d14' : '#c08a2e' });
    if (eye) eye.state.flood = f;
  }
}

addEventListener('scroll', () => onScroll(false), { passive: true });
addEventListener('resize', () => layout(true));
if (eye && finePointer()) addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') eye.lookAt(e.clientX, e.clientY); }, { passive: true });

layout(true);
if (eye) {
  if (still) eye.render(0, 0);
  else {
    let t0 = performance.now();
    const loop = (t) => { const dt = (t - t0) / 1000; t0 = t; eye && eye.render(t / 1000, dt); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
}
