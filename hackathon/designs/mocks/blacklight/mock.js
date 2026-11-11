// BLACKLIGHT: the second print.
// The page rests as a black outline print. A soft light reveals the full colour plates,
// the hidden notes, and the lit words on the black frame. The reveal fades slowly behind it.
import { reducedMotion, qualityTier, cappedDpr, cursorGuard, frameLoop, usePoster, isPhone } from '../../shared/base.js';
import { createEye } from './eye.js';

const root = document.documentElement;
const canvas = document.getElementById('eye');
const lamp = document.querySelector('.lamp');
const notes = [...document.querySelectorAll('.note')];
const lits = [...document.querySelectorAll('[data-lit]')];
const aboutLink = document.querySelector('.strip a[href="#about"]');
const aboutSection = document.getElementById('about');
const tier = qualityTier();
const still = reducedMotion();

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

const eye = tier === 0 ? null : createEye(canvas, { dpr: cappedDpr(tier), onLost: () => allLit() });
if (!eye) usePoster(canvas);
cursorGuard();

// everything revealed: reduced motion, no WebGL, or tier 0
function allLit() {
  usePoster(canvas);
  root.classList.add('all-lit');
}
if (!eye || still) root.classList.add('all-lit');

const openAt = () => clamp(window.scrollY / (window.innerHeight * 0.9), 0, 1);

function place() {
  if (!eye) return;
  const phone = isPhone() && window.innerWidth < window.innerHeight;
  eye.state.scale = phone ? 1.32 : 1;
  eye.state.center = phone ? [0, 0.16] : [0, 0.02];
  eye.state.margin = phone ? 9 : 16;
  eye.state.cornerRadius = phone ? 18 : 26;
  eye.resize();
}

function writeVars(x, y, w, h, open) {
  root.style.setProperty('--px', x.toFixed(1) + 'px');
  root.style.setProperty('--py', y.toFixed(1) + 'px');
  root.style.setProperty('--pw', w.toFixed(1) + 'px');
  root.style.setProperty('--ph', h.toFixed(1) + 'px');
  root.style.setProperty('--open', open.toFixed(3));
}

// with no shader the pupil bar is drawn by CSS, so work out its box here
function writeFallback() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const m = Math.min(w, h);
  const phone = w < 600;
  const sc = phone ? 1.32 : 1;
  const e = openAt();
  const k = e * e * (3 - 2 * e);
  const hw = lerp(0.33 * m * sc, w / 2 - 12, k);
  const hh = lerp(0.078 * m * sc, h / 2 - 12, k);
  const cy = lerp(h / 2 - (phone ? 0.16 : 0.02) * m, h / 2, k);
  writeVars(w / 2 - hw, cy - hh, hw * 2, hh * 2, e);
}

// ---------- the light and its memory ----------
const MW = 256;
const mask = document.createElement('canvas');
const mctx = mask.getContext('2d');
let mh = 1;
const light = { x: 0, y: 0, px: null, py: null };
let target = { x: 0, y: 0 };
let lastMove = -100;
let sawPointer = false;
let radius = 190;

function sizeMask() {
  mh = Math.max(1, Math.round((MW * window.innerHeight) / window.innerWidth));
  mask.width = MW;
  mask.height = mh;
  mctx.fillStyle = '#000';
  mctx.fillRect(0, 0, MW, mh);
  radius = window.innerWidth < 600 ? 140 : 190;
  light.px = null;
}

// one soft stamp; 'lighten' keeps the brightest value so the pool has no halo
function stamp(x, y) {
  const s = MW / window.innerWidth;
  const r = radius * s;
  const g = mctx.createRadialGradient(x * s, y * s, 0, x * s, y * s, r);
  g.addColorStop(0, 'rgb(255,255,255)');
  g.addColorStop(0.5, 'rgb(250,250,250)');
  g.addColorStop(0.78, 'rgb(150,150,150)');
  g.addColorStop(1, 'rgb(0,0,0)');
  mctx.globalCompositeOperation = 'lighten';
  mctx.fillStyle = g;
  mctx.fillRect(x * s - r, y * s - r, r * 2, r * 2);
  mctx.globalCompositeOperation = 'source-over';
}

function stampLine(x, y) {
  if (light.px === null) {
    stamp(x, y);
  } else {
    const d = Math.hypot(x - light.px, y - light.py);
    const n = Math.max(1, Math.ceil(d / (radius * 0.14)));
    for (let i = 1; i <= n; i++) stamp(lerp(light.px, x, i / n), lerp(light.py, y, i / n));
  }
  light.px = x;
  light.py = y;
}

function fade(dt) {
  const a = Math.max(0.025, dt / 0.9);
  mctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
  mctx.fillRect(0, 0, MW, mh);
}

function onPointer(e) {
  target.x = e.clientX;
  target.y = e.clientY;
  lastMove = performance.now() / 1000;
  if (!sawPointer) {
    sawPointer = true;
    light.x = e.clientX;
    light.y = e.clientY;
  }
  eye.lookAt(e.clientX, e.clientY);
}

// the wandering light: a slow loop across the eye
function wander(t) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const m = Math.min(w, h);
  const cx = w / 2 + eye.state.center[0] * m;
  const cy = h / 2 - eye.state.center[1] * m;
  return {
    x: cx + Math.sin(t * 0.5) * w * 0.4,
    y: cy + Math.sin(t * 0.37 + 1.3) * Math.min(h * 0.3, m * 0.42),
  };
}

// ---------- lit words, notes, nav ----------
function nearest(r, x, y) {
  const dx = Math.max(r.left - x, 0, x - r.right);
  const dy = Math.max(r.top - y, 0, y - r.bottom);
  return Math.hypot(dx, dy);
}

// value follows its target: quick up, slow down (about 2.5 s)
function follow(v, goal, dt) {
  const k = goal > v ? 1 - Math.exp(-dt * 14) : 1 - Math.exp(-dt / 0.9);
  return v + (goal - v) * k;
}

const litVal = new Map();
const noteVal = new Map();

function updateDom(dt) {
  const open = parseFloat(root.style.getPropertyValue('--open')) || 0;
  for (const n of notes) {
    const r = n.getBoundingClientRect();
    const d = Math.hypot((r.left + r.right) / 2 - light.x, (r.top + r.bottom) / 2 - light.y);
    const goal = clamp(1 - (d - radius * 0.45) / (radius * 0.6), 0, 1);
    const v = follow(noteVal.get(n) || 0, goal, dt);
    noteVal.set(n, v);
    n.style.opacity = v < 0.01 ? '0' : v.toFixed(3);
  }
  const vh = window.innerHeight;
  for (const el of lits) {
    const r = el.getBoundingClientRect();
    let v = 0;
    if (r.bottom > -50 && r.top < vh + 50) {
      const d = nearest(r, light.x, light.y);
      const goal = clamp(1 - d / (radius * 0.9), 0, 1);
      v = follow(litVal.get(el) || 0, goal, dt);
    }
    litVal.set(el, v);
    if (el === aboutLink && aboutSection.getBoundingClientRect().top < vh * 0.6) v = 1;
    el.style.setProperty('--lit', v.toFixed(3));
  }
  void open;
}

// ---------- run ----------
if (eye && !still) {
  place();
  sizeMask();
  eye.setMask(mask);
  light.x = target.x = window.innerWidth / 2;
  light.y = target.y = window.innerHeight * 0.46;
  stampLine(light.x, light.y);
  window.addEventListener('resize', () => {
    place();
    sizeMask();
  });
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('pointerdown', onPointer, { passive: true });

  frameLoop(canvas, (t, dt) => {
    const now = performance.now() / 1000;
    const idle = !sawPointer || now - lastMove > 3;
    if (idle) target = wander(t);
    const k = 1 - Math.exp(-dt * (idle ? 5 : 40));
    light.x = lerp(light.x, target.x, k);
    light.y = lerp(light.y, target.y, k);
    fade(dt);
    stampLine(light.x, light.y);
    eye.state.open = openAt();
    eye.render(t, dt);
    const r = eye.pupilRect();
    writeVars(r.x, r.y, r.w, r.h, eye.state.open);
    if (lamp) lamp.style.transform = `translate3d(${light.x}px, ${light.y}px, 0)`;
    updateDom(dt);
  });
} else if (eye && still) {
  place();
  eye.state.still = true;
  eye.state.reveal = 1;
  const draw = () => {
    eye.state.open = openAt();
    eye.render(0, 0.016);
    const r = eye.pupilRect();
    writeVars(r.x, r.y, r.w, r.h, eye.state.open);
  };
  draw();
  window.addEventListener('scroll', draw, { passive: true });
  window.addEventListener('resize', () => {
    place();
    draw();
  });
} else {
  writeFallback();
  window.addEventListener('scroll', writeFallback, { passive: true });
  window.addEventListener('resize', writeFallback);
}

window.__eye = eye;
