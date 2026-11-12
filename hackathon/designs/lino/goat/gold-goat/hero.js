import { createEye } from '../../kit/eye.js';
import { reducedMotion, finePointer, qualityTier, cappedDpr, usePoster } from '../../../shared/base.js';

const root = document.documentElement;
const canvas = document.getElementById('eye');
const goat = document.getElementById('goat');
const slot = document.getElementById('slot');
const A = 34, HX = 670, HY = 263;
const PAL = { paper: '#f6e7c3', ink: '#4a0d0a', block: '#c08a2e' };
const RED = '#8f1d14';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

const tier = qualityTier();
const still = reducedMotion();
let eye = null;
if (tier > 0) {
  try { eye = createEye(canvas, { palette: PAL, dpr: cappedDpr(tier), onLost: () => { eye = null; fallback(); } }); } catch (e) { eye = null; }
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
  let k0, c0, r0, barb;
  if (phone) {
    const yb = 0.52 * H;
    k0 = Math.min(0.85 * W / 705, (yb - 120) / 600);
    c0 = { cx: W / 2 + (670 - 458) * k0, cy: yb - 437 * k0 };
    const w = W - 48;
    r0 = { x: 24, y: yb, w, h: w / 4.8 };
  } else {
    const yb = 0.70 * H;
    k0 = Math.min(0.58 * H / 600, 0.42 * W / 705);
    const hoofX = 0.63 * W;
    c0 = { cx: hoofX + 34 * k0, cy: yb - 437 * k0 };
    const w = Math.max(420, Math.min(0.46 * W, 700));
    const right = hoofX + 96 * k0;
    r0 = { x: right - w, y: yb, w, h: Math.min(w / 5.4, 0.15 * H) };
  }
  barb = r0.y + r0.h;
  root.style.setProperty('--barb', barb.toFixed(0) + 'px');
  if (!phone) {
    const act = document.querySelector('.hero-actions');
    act.style.left = r0.x.toFixed(0) + 'px'; act.style.top = (barb + 22).toFixed(0) + 'px';
  } else { const act = document.querySelector('.hero-actions'); act.style.left = ''; act.style.top = ''; }
  const ew = 0.66 * M * Send, eh = 0.156 * M * Send;
  const re = { x: end.cx - ew / 2, y: end.cy - eh / 2, w: ew, h: eh };
  L = { k0, c0, kEnd, end, r0, re, Send };
}

function socketPath(w, h, m, s, c) {
  const Wd = 0.66, grow = 0.03;
  const X = (qx) => (w / 2 + (c[0] + qx * s) * m).toFixed(1) + 'px';
  const Y = (qy) => (h / 2 - (c[1] + qy * s) * m).toFixed(1) + 'px';
  const up = (xn) => { const k = 1 - xn * xn; return 0.292 * Math.pow(k, 0.7) + 0.04 * xn * k + grow; };
  const lo = (xn) => { const k = 1 - xn * xn; return -0.25 * Math.pow(k, 0.86) + 0.022 * xn * k - grow; };
  const pts = [`${X(-Wd - 0.02)} ${Y(0)}`];
  const N = 28;
  for (let i = 1; i < N; i++) { const xn = -1 + (2 * i) / N; pts.push(`${X(Wd * xn)} ${Y(up(xn))}`); }
  pts.push(`${X(Wd + 0.02)} ${Y(0)}`);
  for (let i = N - 1; i > 0; i--) { const xn = -1 + (2 * i) / N; pts.push(`${X(Wd * xn)} ${Y(lo(xn))}`); }
  return `polygon(${pts.join(', ')})`;
}

// seeded hand-cut roughening
(function rough() {
  let s = 20270326;
  const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  goat.querySelectorAll('polygon[data-r]').forEach((p) => {
    const pts = p.getAttribute('points').trim().split(/\s+/).map((q) => q.split(',').map(Number));
    p.setAttribute('points', pts.map(([x, y]) => `${(x + (rnd() - 0.5) * 3).toFixed(1)},${(y + (rnd() - 0.5) * 3).toFixed(1)}`).join(' '));
  });
})();

function headT(cx, cy, k, rot) {
  goat.style.transform = `translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px) rotate(${rot || 0}deg) scale(${k.toFixed(4)}) translate(${-HX}px,${-HY}px)`;
}

function setEye(cx, cy, k, step) {
  const sc = A * k / (0.66 * M), ce = [(cx - W / 2) / M, (H / 2 - cy) / M];
  canvas.style.setProperty('--socket', step >= 7 ? 'none' : socketPath(W, H, M, sc, ce));
  if (!eye) return;
  eye.state.lid = step === 0 ? 0.2 : 0; eye.state.passY = 1; eye.state.passK = 1;
  eye.state.scale = sc; eye.state.center = ce;
}

function placeSlot(r) {
  slot.style.left = r.x.toFixed(1) + 'px'; slot.style.top = r.y.toFixed(1) + 'px';
  slot.style.width = r.w.toFixed(1) + 'px'; slot.style.height = r.h.toFixed(1) + 'px';
}

function stepOf(y) {
  if (isStatic) return 0;
  const p = clamp(y / (0.95 * H), 0, 1);
  return p < 0.08 ? 0 : 7; /* one hard cut to the live eye */
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
  setEye(i === 6 ? end.cx : cx, i === 6 ? end.cy : cy, k, i);
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
  root.classList.toggle('hero-gone', f >= 0.25 || s >= 7);
  if (f !== lastFlood || force) {
    lastFlood = f;
    root.style.setProperty('--flood', f);
    root.classList.toggle('slot-off', f >= 0.98);
    root.classList.toggle('stage-off', f >= 0.98);
    if (eye) { eye.state.flood = f; eye.setPalette({ ...PAL, block: f > 0 ? RED : PAL.block }); }
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
