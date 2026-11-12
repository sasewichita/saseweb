import { createEye, PALETTES } from '../../kit/eye.js';
import { reducedMotion, finePointer, qualityTier, cappedDpr, usePoster } from '../../../shared/base.js';

const root = document.documentElement;
const canvas = document.getElementById('eye');
const goat = document.getElementById('goat');
const slot = document.getElementById('slot');
const A = 27, HX = 290, HY = 222; // eye centre in goat-element units (svg y offset 100)
const gold = root.classList.contains('c-gold');
const PAL_REST = gold ? { ...PALETTES.newyear, paper: '#f6e7c3', ink: '#4a0d0a', block: '#c08a2e' } : { ...PALETTES.newyear, block: '#f0b90a' };
const PAL_FLOOD = gold ? '#8f1d14' : PALETTES.newyear.block;
let irisRed = false;
let hopDy = 0;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

const tier = qualityTier();
const still = reducedMotion();
let eye = null;
if (tier > 0) {
  try { eye = createEye(canvas, { palette: PAL_REST, dpr: cappedDpr(tier), onLost: () => { eye = null; fallback(); } }); } catch (e) { eye = null; }
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
    const th = (W - 24) / 4.2;
    const slotY = H - 266 - 10 - th;
    const top = 124, bot = slotY - 8;
    k0 = Math.min(0.8 * W / 780, (bot - top) / 450);
    const gt = top + (bot - top - 450 * k0) / 2;
    c0 = { cx: W - 14 - 650 * k0, cy: 0 };
    c0.cy = gt + (322 - 150) * k0;
    r0 = { x: 12, y: slotY, w: W - 24, h: th };
  } else {
    k0 = Math.min(0.45 * W / 780, 0.5 * H / 450);
    c0 = { cx: W - 36 - 650 * k0, cy: 0.12 * H + 56 + (322 - 150) * k0 };
    const w = Math.max(200, Math.min(620, 0.46 * W));
    r0 = { x: 26, y: Math.min(0.56 * H, H - 196 - w / 4.2 - 24), w, h: w / 4.2 };
  }
  const ew = 0.66 * M * Send, eh = 0.156 * M * Send;
  const re = { x: end.cx - ew / 2, y: end.cy - eh / 2, w: ew, h: eh };
  L = { k0, c0, kEnd, end, r0, re, Send };
}

function socketPath(cx, cy, k) {
  const s = A * k / (0.66 * M), c = [(cx - W / 2) / M, (H / 2 - cy) / M], Wd = 0.66, grow = 0.014;
  const X = (q) => (W / 2 + (c[0] + q * s) * M).toFixed(1) + 'px';
  const Y = (q) => (H / 2 - (c[1] + q * s) * M).toFixed(1) + 'px';
  const up = (x) => { const t = 1 - x * x; return 0.292 * Math.pow(t, 0.7) + 0.04 * x * t + grow; };
  const lo = (x) => { const t = 1 - x * x; return -0.25 * Math.pow(t, 0.86) + 0.022 * x * t - grow; };
  const pts = [`${X(-Wd - 0.02)} ${Y(0)}`], N = 28;
  for (let i = 1; i < N; i++) { const x = -1 + 2 * i / N; pts.push(`${X(Wd * x)} ${Y(up(x))}`); }
  pts.push(`${X(Wd + 0.02)} ${Y(0)}`);
  for (let i = N - 1; i > 0; i--) { const x = -1 + 2 * i / N; pts.push(`${X(Wd * x)} ${Y(lo(x))}`); }
  return `polygon(${pts.join(',')})`;
}

function headT(cx, cy, k, rot) {
  goat.style.transform = `translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px) rotate(${rot || 0}deg) scale(${k.toFixed(4)}) translate(${-HX}px,${-HY}px)`;
}

function setEye(cx, cy, k) {
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
  return p < 0.1 ? 0 : 1;
}

function apply(i) {
  const { k0, c0, kEnd, end, r0, re } = L;
  if (i === 0) {
    const cy = c0.cy + hopDy * k0;
    headT(c0.cx, cy, k0, 0);
    setEye(c0.cx, cy, k0);
    canvas.style.setProperty('--socket', socketPath(c0.cx, cy, k0));
    root.classList.remove('head-gone');
    placeSlot(r0);
    return;
  }
  canvas.style.removeProperty('--socket');
  setEye(end.cx, end.cy, kEnd);
  headT(c0.cx, c0.cy, k0, 0);
  root.classList.add('head-gone');
  if (eye) { eye.render(performance.now() / 1000, 0); const p = eye.pupilRect(); placeSlot({ x: p.x, y: p.y, w: p.w, h: p.h }); }
  else placeSlot(re);
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
    root.classList.toggle('hero-gone', f >= 0.25);
    root.classList.toggle('slot-off', f >= 0.98);
    root.classList.toggle('stage-off', f >= 0.98);
    if (eye) { eye.state.flood = f; const red = f > 0.004; if (red !== irisRed) { irisRed = red; eye.setPalette({ block: red ? PAL_FLOOD : PAL_REST.block }); } }
  }
}

addEventListener('scroll', () => onScroll(false), { passive: true });
addEventListener('resize', () => layout(true));
if (eye && finePointer()) addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') eye.lookAt(e.clientX, e.clientY); }, { passive: true });

layout(true);
if (!isStatic) {
  const frames = [0, -34, -52, -14]; let n = 0;
  const hop = () => {
    hopDy = frames[n]; if (lastStep === 0) apply(0);
    const wait = n === 0 ? 1100 : 150; n = (n + 1) % frames.length;
    setTimeout(hop, wait);
  };
  setTimeout(hop, 1100);
}
if (eye) {
  if (still) eye.render(0, 0);
  else {
    let t0 = performance.now();
    const loop = (t) => { const dt = (t - t0) / 1000; t0 = t; eye && eye.render(t / 1000, dt); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
}
