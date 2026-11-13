// Horned mask hero: the kit eye, set into a block print of a goat's head.
import { createEye, PALETTES } from '../../kit/eye.js';
import { reducedMotion, qualityTier, cappedDpr, usePoster } from '../../../shared/base.js';

// Where the eye sits, in units of the short side of the screen (+y up), and how big it is.
// The drawings in index.html are built round these: keep each placement's
// <g transform="translate(x y) scale(k)"> at x = center[0] * 1000, y = -center[1] * 1000, k = scale / 0.4.
const EYE = {
  desk: { scale: 0.38, center: [-0.19, 0.075] },
  phone: { scale: 0.36, center: [-0.04, 0.304] },
};
// A goat's eye is gold. The red comes in with the flood.
const IRIS_REST = '#f0b90a';
const IRIS_FLOOD = PALETTES.newyear.block;

const root = document.documentElement;
root.classList.add('js');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const still = reducedMotion();

let flood = 0;
function updateFlood() {
  flood = clamp(window.scrollY / (0.85 * window.innerHeight), 0, 1);
  root.style.setProperty('--flood', flood.toFixed(3));
  root.classList.toggle('hero-gone', flood >= 0.25);
  // the print: whole, then knocked apart in one hard step while the red floods out of the eye
  // over it; without the live eye the paper itself turns red at step 2
  root.classList.toggle('mask-step-1', flood >= 0.12);
  root.classList.toggle('mask-step-2', flood >= 0.3);
  root.classList.toggle('flood-done', flood >= 0.95);
}

function frameOf() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const phone = h >= w; // matches the CSS (orientation: portrait)
  const e = phone ? EYE.phone : EYE.desk;
  // the portrait drawing is made for a phone (height about 1.7 widths); on squatter portrait
  // screens it shrinks and drops a little so it clears the captions. The CSS reads --fit and --fit-dy.
  const fit = phone ? Math.min(1, h / w / 1.7) : 1;
  const dy = (1 - fit) * 150;
  root.style.setProperty('--fit', fit.toFixed(4));
  root.style.setProperty('--fit-dy', (dy / 10).toFixed(2) + 'vmin');
  return { w, h, m: Math.min(w, h), scale: e.scale * fit, center: [e.center[0] * fit, e.center[1] * fit - dy / 1000] };
}

// The eye opening of kit/eye.js (its lids() at rest), grown a hair so the cut lands in its black rim.
function socketPath(f) {
  const { w, h, m, scale: s, center: c } = f;
  const W = 0.66;
  const grow = 0.014;
  const X = (qx) => (w / 2 + (c[0] + qx * s) * m).toFixed(1) + 'px';
  const Y = (qy) => (h / 2 - (c[1] + qy * s) * m).toFixed(1) + 'px';
  const up = (xn) => {
    const k = 1 - xn * xn;
    return 0.292 * Math.pow(k, 0.7) + 0.04 * xn * k + grow;
  };
  const lo = (xn) => {
    const k = 1 - xn * xn;
    return -0.25 * Math.pow(k, 0.86) + 0.022 * xn * k - grow;
  };
  const pts = [`${X(-W - 0.02)} ${Y(0)}`];
  const N = 28;
  for (let i = 1; i < N; i++) {
    const xn = -1 + (2 * i) / N;
    pts.push(`${X(W * xn)} ${Y(up(xn))}`);
  }
  pts.push(`${X(W + 0.02)} ${Y(0)}`);
  for (let i = N - 1; i > 0; i--) {
    const xn = -1 + (2 * i) / N;
    pts.push(`${X(W * xn)} ${Y(lo(xn))}`);
  }
  return `polygon(${pts.join(', ')})`;
}

// The flood of kit/eye.js is a rough red disc round the pupil. Once it outgrows the eye opening,
// the canvas is cut to a lobed, hand-cut blot inside that disc, grown in hard steps, so the red
// spills over the print in a few pulls rather than as a smooth circle.
function floodPath(f, r) {
  const { w, h, m, scale: s } = f;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) / (m * s);
  const R = flood > 0 ? far * 1.16 * Math.pow(flood, 1.35) : 0;
  if (R < 0.3) return null;
  const STEP = 0.55;
  const n = Math.floor((R - 0.3) / STEP);
  const rad = ((0.3 + n * STEP) * 0.968 - 0.024) * m * s;
  const turn = n * 1.7;
  const pts = [];
  const N = 120;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const nick = (((Math.sin(i * 12.9898 + n) * 43758.5453) % 1) + 1) % 1;
    const lobe = (0.5 + 0.5 * Math.sin(3 * a + turn)) * (0.65 + 0.35 * Math.sin(5 * a + 2.1 + turn));
    const k = 0.8 + 0.18 * lobe + 0.012 * nick;
    pts.push(`${(cx + Math.cos(a) * rad * k).toFixed(1)}px ${(cy + Math.sin(a) * rad * k).toFixed(1)}px`);
  }
  return `polygon(${pts.join(', ')})`;
}

// The resting pupil bar of kit/eye.js, for the title when there is no live eye.
function setStillPupil(f) {
  const { w, h, m, scale: s, center: c } = f;
  const hw = 0.33 * m * s;
  const hh = 0.078 * m * s;
  const st = root.style;
  st.setProperty('--px', (w / 2 + c[0] * m - hw).toFixed(1) + 'px');
  st.setProperty('--py', (h / 2 - c[1] * m - hh).toFixed(1) + 'px');
  st.setProperty('--pw', (hw * 2).toFixed(1) + 'px');
  st.setProperty('--ph', (hh * 2).toFixed(1) + 'px');
}

const canvas = document.getElementById('eye');
const tier = qualityTier();
let eye = null;
if (canvas && tier > 0) {
  try {
    eye = createEye(canvas, { dpr: cappedDpr(tier), palette: { ...PALETTES.newyear, block: IRIS_REST }, onLost: () => lose() });
  } catch (err) {
    eye = null;
  }
}
function lose() {
  usePoster(canvas);
  eye = null;
  setStillPupil(frameOf());
}
if (!eye && canvas) usePoster(canvas);

let socket = '';
function placeSocket() {
  const f = frameOf();
  socket = socketPath(f);
  if (canvas) canvas.style.setProperty('--socket', socket);
  if (!eye) setStillPupil(f);
}
placeSocket();

const heroEl = document.querySelector('.hero');
let heroVisible = true;
let irisRed = false;

function drawOnce(t, dt) {
  if (!eye || !heroVisible) return;
  const f = frameOf();
  const s = eye.state;
  s.flood = flood;
  s.lid = 0;
  s.passY = 1;
  s.passK = 1;
  s.scale = f.scale;
  s.center = f.center;
  const red = flood > 0.004;
  if (red !== irisRed) {
    eye.setPalette({ block: red ? IRIS_FLOOD : IRIS_REST });
    irisRed = red;
  }
  eye.render(t, dt);
  const r = eye.pupilRect();
  const st = root.style;
  st.setProperty('--px', r.x.toFixed(1) + 'px');
  st.setProperty('--py', r.y.toFixed(1) + 'px');
  st.setProperty('--pw', r.w.toFixed(1) + 'px');
  st.setProperty('--ph', r.h.toFixed(1) + 'px');
  canvas.style.setProperty('--socket', floodPath(f, r) || socket);
}

let raf = 0;
let last = 0;
function frame(ms) {
  raf = 0;
  const t = ms / 1000;
  const dt = last ? Math.min(0.05, t - last) : 0.016;
  last = t;
  updateFlood();
  drawOnce(t, dt);
  wake();
}
function wake() {
  if (still || !eye || !heroVisible || document.hidden || raf) return;
  raf = requestAnimationFrame(frame);
}
let queued = false;
function drawSoon() {
  if (!eye) return;
  if (!still) return wake();
  if (queued) return;
  queued = true;
  requestAnimationFrame((ms) => {
    queued = false;
    updateFlood();
    drawOnce(ms / 1000, 0.016);
  });
}

if (eye) {
  if (still) eye.state.still = true;
  new IntersectionObserver(([e]) => {
    heroVisible = e.isIntersecting;
    if (!heroVisible) last = 0;
    drawSoon();
  }).observe(heroEl);
  window.addEventListener(
    'pointermove',
    (e) => {
      if (eye && e.pointerType !== 'touch') eye.lookAt(e.clientX, e.clientY);
    },
    { passive: true },
  );
  window.addEventListener('scroll', drawSoon, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      last = 0;
      wake();
    }
  });
  drawSoon();
}
window.addEventListener('resize', () => {
  if (eye) eye.resize();
  placeSocket();
  drawSoon();
});
if (heroEl && 'IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => root.classList.toggle('hero-off', !e.isIntersecting)).observe(heroEl);
}
updateFlood();
window.addEventListener('scroll', updateFlood, { passive: true });
window.addEventListener('resize', updateFlood);
