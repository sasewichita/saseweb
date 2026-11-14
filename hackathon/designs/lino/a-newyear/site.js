// A · New Year Print: the shell. One fixed eye, three scenes, the fuse nav, the shut-eye footer.
import { createEye, PALETTES } from '../kit/eye.js';
import { reducedMotion, qualityTier, cappedDpr, usePoster } from '../../shared/base.js';
import './cursor.js';

const root = document.documentElement;
root.classList.add('js');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const still = reducedMotion();

// a small seeded random so the hand-cut edges stay the same on every load
function seeded(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/* A clip-path that is a red sheet with a ragged hole. r is the window rect inside the sheet. */
export function holePath(W, H, r, seed = 1) {
  const rnd = seeded(seed);
  const j = (n) => (rnd() - 0.5) * n;
  const pts = [];
  const edge = (x0, y0, x1, y1) => {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 44));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      pts.push([x0 + (x1 - x0) * t + j(8), y0 + (y1 - y0) * t + j(8)]);
    }
  };
  const x0 = r.x;
  const y0 = r.y;
  const x1 = r.x + r.w;
  const y1 = r.y + r.h;
  // the four sides sit a little crooked
  edge(x0, y0 + 3, x1, y0 - 2);
  edge(x1 + 2, y0, x1 - 3, y1);
  edge(x1, y1 - 2, x0, y1 + 3);
  edge(x0 - 2, y1, x0 + 3, y0);
  const f = (n) => Math.round(n * 10) / 10;
  const hole = pts.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1])).join('') + 'Z';
  return `path(evenodd, 'M0 0H${W}V${H}H0Z${hole}')`;
}

/* ---------------- scroll values: flood, hero-gone, nav-on ---------------- */
let flood = 0;
function updateFlood() {
  flood = clamp(window.scrollY / (0.85 * window.innerHeight), 0, 1);
  root.style.setProperty('--flood', flood.toFixed(3));
  root.classList.toggle('hero-gone', flood >= 0.25);
  root.classList.toggle('nav-on', flood >= 0.9);
}

/* ---------------- the eye and its scenes ---------------- */
const canvas = document.getElementById('eye');
const tier = qualityTier();
let eye = null;
if (canvas && tier > 0) {
  try {
    eye = createEye(canvas, { dpr: cappedDpr(tier), palette: PALETTES.newyear, onLost: () => usePoster(canvas) });
  } catch (err) {
    eye = null;
  }
}
if (!eye && canvas) usePoster(canvas);

const heroEl = document.querySelector('.hero');
const pullsEl = document.querySelector('[data-window="pulls"]');
const shutEl = document.querySelector('[data-window="shut"]');
const vis = { hero: true, pulls: false, shut: false };
let scene = 'hero';

function pickScene() {
  scene = vis.pulls ? 'pulls' : vis.shut ? 'shut' : vis.hero ? 'hero' : null;
}

function fitWindow(el, wide) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const m = Math.min(w, h);
  const r = el.getBoundingClientRect();
  eye.state.center = [(r.left + r.width / 2 - w / 2) / m, (h / 2 - (r.top + r.height / 2)) / m];
  const fit = Math.min(r.width / (1.5 * m), r.height / ((wide ? 0.3 : 0.75) * m));
  eye.state.scale = Math.max(0.15, fit);
}

function setScene() {
  const s = eye.state;
  if (scene === 'hero') {
    const phone = window.innerWidth <= 760 && window.innerHeight > window.innerWidth;
    s.flood = flood;
    s.lid = 0;
    s.passY = 1;
    s.passK = 1;
    s.scale = phone ? 1.32 : 1;
    s.center = phone ? [0, 0.16] : [0, 0.02];
  } else if (scene === 'pulls' && pullsEl) {
    const p = typeof window.__pullP === 'number' ? window.__pullP : 1;
    s.flood = 0;
    s.lid = 0;
    s.passY = smooth(clamp((p - 0.08) / 0.28, 0, 1));
    s.passK = smooth(clamp((p - 0.4) / 0.28, 0, 1));
    fitWindow(pullsEl, false);
  } else if (scene === 'shut' && shutEl) {
    s.flood = 0;
    s.lid = 1;
    s.passY = 1;
    s.passK = 1;
    fitWindow(shutEl, true);
  }
}

function drawOnce(t, dt) {
  if (!eye || !scene) return;
  setScene();
  eye.render(t, dt);
  if (scene === 'hero') {
    const r = eye.pupilRect();
    const st = root.style;
    st.setProperty('--px', r.x.toFixed(1) + 'px');
    st.setProperty('--py', r.y.toFixed(1) + 'px');
    st.setProperty('--pw', r.w.toFixed(1) + 'px');
    st.setProperty('--ph', r.h.toFixed(1) + 'px');
  }
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
  if (still || !eye || !scene || document.hidden || raf) return;
  raf = requestAnimationFrame(frame);
}
// reduced motion: draw only when something changed
let queued = false;
function drawSoon() {
  if (!eye) return;
  if (!still) return wake();
  if (queued) return;
  queued = true;
  requestAnimationFrame((ms) => {
    queued = false;
    drawOnce(ms / 1000, 0.016);
  });
}

if (eye) {
  if (still) eye.state.still = true;
  const watch = (el, key) => {
    if (!el) return;
    new IntersectionObserver(([e]) => {
      vis[key] = e.isIntersecting;
      pickScene();
      if (!scene) last = 0;
      drawSoon();
    }).observe(el);
  };
  watch(heroEl, 'hero');
  watch(pullsEl, 'pulls');
  watch(shutEl, 'shut');
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'touch') eye.lookAt(e.clientX, e.clientY);
    },
    { passive: true },
  );
  window.addEventListener('resize', () => {
    eye.resize();
    drawSoon();
  });
  window.addEventListener('scroll', drawSoon, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      last = 0;
      wake();
    }
  });
  window.addEventListener('weekend-pull', drawSoon);
  window.__eye = eye;
  pickScene();
  drawSoon();
}
// the slot and captions follow the hero even when the eye is off
if (heroEl && 'IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => root.classList.toggle('hero-off', !e.isIntersecting)).observe(heroEl);
}
updateFlood();
window.addEventListener('scroll', updateFlood, { passive: true });
window.addEventListener('resize', updateFlood);

/* ---------------- footer: the eye shut, seen through a ragged hole ---------------- */
const foot = document.querySelector('.foot');
if (foot && shutEl) {
  const red = document.createElement('div');
  red.className = 'red';
  red.setAttribute('aria-hidden', 'true');
  foot.prepend(red);
  foot.classList.add('has-hole');
  const cut = () => {
    const f = foot.getBoundingClientRect();
    const w = shutEl.getBoundingClientRect();
    red.style.clipPath = holePath(f.width, f.height, { x: w.left - f.left, y: w.top - f.top, w: w.width, h: w.height }, 7);
  };
  cut();
  window.addEventListener('resize', cut);
  if ('ResizeObserver' in window) new ResizeObserver(cut).observe(foot);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(cut);
}

/* ---------------- navigation: the fuse ---------------- */
const nav = document.querySelector('nav.fuse');
if (nav) buildFuse(nav);

function buildFuse(nav) {
  const links = [...nav.querySelectorAll('li > a')];
  const items = links.map((a) => {
    const id = (a.getAttribute('href') || '').replace('#', '');
    return { a, li: a.parentElement, sec: document.getElementById(id), name: a.textContent.trim() };
  });
  const n = items.length;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const pBone = document.createElementNS(NS, 'path');
  const pTick = document.createElementNS(NS, 'path');
  const pBurnt = document.createElementNS(NS, 'path');
  pBone.setAttribute('class', 'f-bone');
  pTick.setAttribute('class', 'f-ticks');
  pBurnt.setAttribute('class', 'f-burnt');
  svg.append(pBone, pTick, pBurnt);
  nav.prepend(svg);
  const spark = document.createElement('span');
  spark.className = 'spark';
  spark.setAttribute('aria-hidden', 'true');
  const now = document.createElement('span');
  now.className = 'now';
  now.setAttribute('aria-hidden', 'true');
  nav.append(spark, now);
  items.forEach((it) => {
    const stop = document.createElement('span');
    stop.className = 'stop';
    stop.setAttribute('aria-hidden', 'true');
    const lab = document.createElement('span');
    lab.className = 'lab';
    lab.textContent = it.name;
    it.a.textContent = '';
    it.a.append(stop, lab);
  });
  nav.classList.add('is-built');

  let pts = [];
  let stopS = [];
  let horizontal = false;
  const N = 44;

  function layout() {
    horizontal = window.matchMedia('(max-width: 900px)').matches;
    const W = nav.clientWidth;
    const H = nav.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const rnd = seeded(11);
    pts = [];
    for (let k = 0; k < N; k++) {
      const t = k / (N - 1);
      const wob = (rnd() - 0.5) * (horizontal ? 3 : 5);
      pts.push(horizontal ? [t * W, 22.5 + wob] : [W / 2 + wob, t * H]);
    }
    stopS = items.map((_, i) => (i + 0.5) / n);
    items.forEach((it, i) => {
      const s = stopS[i];
      it.li.style.top = horizontal ? '' : s * H + 'px';
      it.li.style.left = horizontal ? s * W + 'px' : '';
    });
    place();
  }

  // point along the wobble line at s in 0..1
  function at(s) {
    const f = clamp(s, 0, 1) * (N - 1);
    const i = Math.min(N - 2, Math.floor(f));
    const k = f - i;
    return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
  }
  const poly = (from, to) => {
    const a = from * (N - 1);
    const b = to * (N - 1);
    const out = [at(from)];
    for (let i = Math.ceil(a + 0.0001); i < b; i++) out.push(pts[i]);
    out.push(at(to));
    return out.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  };

  let cur = -2;
  function place() {
    const y = window.scrollY + window.innerHeight * 0.35;
    const tops = items.map((it) => (it.sec ? it.sec.getBoundingClientRect().top + window.scrollY : 0));
    let i = -1;
    for (let k = 0; k < n; k++) if (tops[k] <= y) i = k;
    const docH = document.documentElement.scrollHeight;
    let s;
    if (i < 0) s = stopS[0] * clamp(y / Math.max(1, tops[0]), 0, 1);
    else if (i < n - 1) s = stopS[i] + (stopS[i + 1] - stopS[i]) * clamp((y - tops[i]) / Math.max(1, tops[i + 1] - tops[i]), 0, 1);
    else s = stopS[n - 1] + (1 - stopS[n - 1]) * clamp((y - tops[i]) / Math.max(1, docH - tops[i]), 0, 1);
    s = clamp(s, 0.001, 0.999);
    pBurnt.setAttribute('d', poly(0, s));
    const rest = poly(s, 1);
    pBone.setAttribute('d', rest);
    pTick.setAttribute('d', rest);
    const sp = at(s);
    // the spark steps along in small hops
    spark.style.left = Math.round(sp[0]) + 'px';
    spark.style.top = Math.round(sp[1]) + 'px';
    items.forEach((it, k) => it.li.classList.toggle('is-burnt', k <= i));
    if (i !== cur) {
      cur = i;
      items.forEach((it, k) => (k === i ? it.a.setAttribute('aria-current', 'location') : it.a.removeAttribute('aria-current')));
      now.textContent = i >= 0 ? items[i].name : '';
    }
  }

  let asked = false;
  const ask = () => {
    if (asked) return;
    asked = true;
    requestAnimationFrame(() => {
      asked = false;
      place();
    });
  };
  window.addEventListener('scroll', ask, { passive: true });
  window.addEventListener('resize', layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  layout();
}
