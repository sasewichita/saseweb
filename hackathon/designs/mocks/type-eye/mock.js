// Read the eye: a goat's eye drawn only with text, in one SVG. No canvas, no WebGL.
import { reducedMotion, cursorGuard } from '../../shared/base.js';
import { barCursor } from './cursor.js';

const NS = 'http://www.w3.org/2000/svg';
const still = reducedMotion();
cursorGuard();
if (!still) barCursor();

const svg = document.getElementById('eye');
const hero = document.getElementById('hero');
const title = document.getElementById('title');
const root = document.documentElement;

const LID_TEXT = 'HACK THE WU · YEAR OF THE GOAT · ';
const RING_TEXT = 'SASE AT WICHITA STATE · 2ND ANNUAL HACKATHON · ';
const PHRASES = ['MARCH 26–28', 'WICHITA STATE', 'BEGINNER FRIENDLY', 'EVERY MAJOR', 'OPEN TO ALL STUDENTS',
  '2ND ANNUAL', 'TEAM UP', 'BUILD SOMETHING NEW', 'SHOW IT OFF'];

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const el = (name, attrs = {}, parent) => {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.append(n);
  return n;
};

// Lid curves, taken from the baseline eye (units of the half width).
function openings(xn) {
  const k = 1 - xn * xn;
  return {
    up: 0.292 * Math.pow(k, 0.7) + 0.04 * xn * k,
    lo: -0.25 * Math.pow(k, 0.86) + 0.022 * xn * k,
  };
}

const S = { w: 0, h: 0, cx: 0, cy: 0, A: 0, RI: 0, bar: { hw: 0, hh: 0 }, lines: [] };
const gaze = { x: 0, y: 0, tx: 0, ty: 0 };
const pointer = { x: 0, y: 0, has: false };
let pupil, irisG, eyeG, scrollP = 0, dirty = true, blinkT = -1;

function build() {
  const w = innerWidth, h = innerHeight, phone = w <= 760;
  Object.assign(S, { w, h });
  S.cx = w / 2;
  S.cy = phone ? h * 0.4 : h * 0.47;
  S.A = phone ? w / 2 - 6 : Math.min(w * 0.47, h * 0.78);
  S.RI = S.A * (phone ? 0.78 : 0.65);
  S.bar = phone ? { hw: S.RI * 1.0, hh: S.RI * 0.26 } : { hw: S.RI * 0.62, hh: S.RI * 0.17 };
  S.phone = phone;
  S.lines = [];
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

  const { cx, cy, A, RI } = S;
  const sc = A / 0.66;
  const N = 56;
  const xs = Array.from({ length: N + 1 }, (_, i) => -1 + (2 * i) / N);
  const upY = xs.map((x) => cy - openings(x).up * sc);
  const loY = xs.map((x) => cy - openings(x).lo * sc);
  const px = xs.map((x) => cx + x * A);
  const poly = (ys, dy = 0) => px.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${(ys[i] + dy).toFixed(1)}`).join('');
  const defs = el('defs', {}, svg);

  // almond opening, used to clip the iris
  const almond = px.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${upY[i].toFixed(1)}`).join('') +
    px.map((x, i) => `L${px[N - i].toFixed(1)} ${loY[N - i].toFixed(1)}`).join('') + 'Z';
  const clip = el('clipPath', { id: 'open' }, defs);
  el('path', { d: almond }, clip);

  eyeG = el('g', {}, svg);

  // text along a path, repeated until the path is full
  const pathLen = (ys) => {
    let L = 0;
    for (let i = 1; i < px.length; i++) L += Math.hypot(px[i] - px[i - 1], ys[i] - ys[i - 1]);
    return L;
  };
  const addLine = (id, ys, dy, fs, cls, lead) => {
    const p = el('path', { id, d: poly(ys, dy) }, defs);
    const t = el('text', { class: cls, 'font-size': fs.toFixed(1) }, eyeG);
    const tp = el('textPath', { href: '#' + id }, t);
    const n = Math.ceil(pathLen(ys) / (fs * 0.42 * LID_TEXT.length)) + 1;
    tp.textContent = LID_TEXT.repeat(n);
    S.lines.push({ t, ys, w: 100, pts: [0.25, 0.5, 0.75].map((f) => [cx + (f * 2 - 1) * A, ys[Math.round(f * N)] + dy]) });
    return p;
  };

  // contour lines first (behind), then the two lids
  const lidFs = A * 0.062;
  const sizes = [0.82, 0.68, 0.55];
  let off = lidFs * 0.35;
  sizes.forEach((s, i) => {
    const fs = lidFs * s;
    off += fs * 1.08;
    addLine('cu' + i, upY, -off, fs, 'contour');
  });
  off = lidFs * 0.9;
  [0.8, 0.62].forEach((s, i) => {
    const fs = lidFs * s;
    off += fs * 1.12;
    addLine('cl' + i, loY, off, fs, 'contour');
  });
  addLine('lu', upY, -3, lidFs, 'lid');
  addLine('ll', loY, lidFs * 0.78, lidFs, 'lid');

  // iris, clipped by the opening
  const clipped = el('g', { 'clip-path': 'url(#open)' }, eyeG);
  irisG = el('g', {}, clipped);
  el('circle', { cx: cx + 3, cy: cy + 3, r: RI, fill: '#f2c40a' }, irisG);
  const spokes = el('g', {}, irisG);
  const count = phone ? 44 : 72;
  const r1 = RI * (phone ? 0.42 : 0.68), r2 = RI * 0.9;
  const sfs = RI * (phone ? 0.052 : 0.036);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * 360 + 90 / count;
    const flip = a > 90 && a < 270;
    const t = el('text', {
      class: 'spoke', 'font-size': sfs.toFixed(1), 'dominant-baseline': 'central',
      textLength: (r2 - r1).toFixed(1), lengthAdjust: 'spacingAndGlyphs',
      transform: flip
        ? `translate(${cx} ${cy}) rotate(${(a + 180).toFixed(2)}) translate(${(-r2).toFixed(1)} 0)`
        : `translate(${cx} ${cy}) rotate(${a.toFixed(2)}) translate(${r1.toFixed(1)} 0)`,
    }, spokes);
    t.textContent = PHRASES[i % PHRASES.length];
  }

  // limbal ring: one circular line, sized so the text closes the circle
  const rr = RI * 0.915;
  el('path', { id: 'ringp', d: `M${cx - rr} ${cy}a${rr} ${rr} 0 1 1 ${2 * rr} 0a${rr} ${rr} 0 1 1 ${-2 * rr} 0` }, defs);
  const circ = 2 * Math.PI * rr;
  const fs0 = RI * 0.06;
  const probe = el('text', { class: 'ring', 'font-size': fs0 }, svg);
  probe.textContent = RING_TEXT;
  const len0 = probe.getComputedTextLength() || fs0 * 0.7 * RING_TEXT.length;
  probe.remove();
  const reps = Math.max(1, Math.round(circ / len0));
  const ring = el('text', { class: 'ring', 'font-size': (fs0 * circ / (reps * len0)).toFixed(2) }, irisG);
  el('textPath', { href: '#ringp' }, ring).textContent = RING_TEXT.repeat(reps);

  // pupil: a solid bar, drawn above everything so it can grow to fill the screen
  pupil = el('rect', { fill: '#0f0f13' }, svg);
  dirty = true;
  S.fonts = false;
}

// Set the width axis of each lid line from its distance to the pointer, only on a step change.
function setWidths() {
  const mx = pointer.has ? pointer.x : S.w * 0.62;
  const my = pointer.has ? pointer.y : S.h * 0.4;
  const far = Math.hypot(S.w, S.h) * 0.55;
  for (const L of S.lines) {
    const d = Math.min(...L.pts.map(([x, y]) => Math.hypot(x - mx, y - my)));
    const w = Math.round((150 - 90 * clamp(d / far)) / 10) * 10;
    if (w !== L.w) {
      L.w = w;
      L.t.style.fontVariationSettings = `'wdth' ${w}`;
    }
  }
}

// Place the pupil, the iris and the title for the current gaze and scroll.
function paint() {
  const { cx, cy, A, bar, w, h } = S;
  const e = scrollP * scrollP * (3 - 2 * scrollP);
  const gx = gaze.x * A * 0.08, gy = gaze.y * A * 0.05;
  irisG.setAttribute('transform', `translate(${gx.toFixed(2)} ${gy.toFixed(2)})`);
  const bx = cx + gx * 1.3 - bar.hw, by = cy + gy * 1.3 - bar.hh;
  const rect = {
    x: lerp(bx, 8, e), y: lerp(by, 8, e),
    w: lerp(bar.hw * 2, w - 16, e), h: lerp(bar.hh * 2, h - 16, e),
  };
  pupil.setAttribute('x', rect.x.toFixed(1));
  pupil.setAttribute('y', rect.y.toFixed(1));
  pupil.setAttribute('width', rect.w.toFixed(1));
  pupil.setAttribute('height', rect.h.toFixed(1));
  pupil.setAttribute('rx', lerp(bar.hh * 0.35, 0, e).toFixed(1));
  const st = title.style;
  st.setProperty('--px', rect.x + 'px');
  st.setProperty('--py', rect.y + 'px');
  st.setProperty('--ph', rect.h + 'px');
  // the title is sized from the bar, not from the growing frame
  st.setProperty('--pw', lerp(bar.hw * 2, bar.hw * 2.6, e) + 'px');
  st.width = rect.w + 'px';
  st.opacity = 1 - clamp((scrollP - 0.25) * 4);
  hero.style.opacity = 1 - clamp(scrollP * 3);
  hero.style.visibility = scrollP > 0.4 ? 'hidden' : 'visible';
  document.body.classList.toggle('framed', scrollP > 0.6);
}

function onScroll() {
  scrollP = clamp(scrollY / (innerHeight * 0.9));
  svg.style.visibility = scrollY > innerHeight * 1.95 ? 'hidden' : 'visible';
  dirty = true;
  if (still) frame();
}

// Pull the lids and iris flat for a moment, then open again.
function blinkStep(now) {
  if (blinkT < 0) return;
  const t = (now - blinkT) / 120;
  const s = t >= 1 ? 1 : 1 - 0.94 * Math.sin(Math.PI * t);
  eyeG.setAttribute('transform', `translate(0 ${S.cy}) scale(1 ${s.toFixed(3)}) translate(0 ${-S.cy})`);
  if (t >= 1) { blinkT = -1; eyeG.removeAttribute('transform'); }
}
function scheduleBlink() {
  setTimeout(() => {
    if (scrollP < 0.05 && !document.hidden) blinkT = performance.now();
    scheduleBlink();
  }, 3000 + Math.random() * 4000);
}

function frame() {
  if (scrollP >= 1 && !dirty) return;
  const k = still ? 1 : 0.12;
  const dx = gaze.tx - gaze.x, dy = gaze.ty - gaze.y;
  if (Math.abs(dx) > 0.0005 || Math.abs(dy) > 0.0005) {
    gaze.x += dx * k; gaze.y += dy * k; dirty = true;
  }
  if (dirty) { paint(); dirty = false; }
}
function tick(now) {
  blinkStep(now);
  frame();
  requestAnimationFrame(tick);
}

// Seven section links along a gentle arc, the ends lifted.
function arc() {
  const nav = document.getElementById('arc');
  const lift = S.phone ? 10 : 18;
  for (const a of nav.children) {
    const r = a.getBoundingClientRect();
    const xn = ((r.left + r.width / 2) - innerWidth / 2) / (innerWidth / 2);
    a.style.setProperty('--dy', (-xn * xn * lift).toFixed(1) + 'px');
  }
}

function start() {
  build();
  setWidths();
  paint();
  arc();
}

addEventListener('pointermove', (e) => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.has = true;
  if (still) return;
  gaze.tx = clamp((e.clientX - S.cx) / (S.w / 2), -1, 1);
  gaze.ty = clamp((e.clientY - S.cy) / (S.h / 2), -1, 1);
  setWidths();
}, { passive: true });
addEventListener('scroll', onScroll, { passive: true });
let rt = 0;
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { start(); onScroll(); }, 120); });

start();
onScroll();
// rebuild once the fonts are in so the ring measures true
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { start(); onScroll(); });
if (!still) {
  scheduleBlink();
  requestAnimationFrame(tick);
}
