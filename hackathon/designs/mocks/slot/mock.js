// SLOT: a pupil-shaped window onto a printed landscape that pans with the pointer.
import { reducedMotion, isPhone, cursorGuard, frameLoop, usePoster } from '../../shared/base.js';
import { barCursor } from './cursor.js';

const INK = '#0f0f13';
const YEL = '#f2c40a';
const BLU = '#2645cc';
const BONE = '#ece6d6';
const NS = 'http://www.w3.org/2000/svg';

const root = document.documentElement;
const eye = document.getElementById('eye');
const clip = eye.querySelector('.clip');
const world = document.getElementById('world');
const ref = document.querySelector('.slot-ref');
const under = document.getElementById('hero-under');
const L = {
  sky: document.getElementById('l-sky'),
  field: document.getElementById('l-field'),
  sil: document.getElementById('l-sil'),
  title: document.getElementById('l-title'),
};
const still = reducedMotion();

// rates: how far each layer travels across one full pan
const RATE = { sky: 0.3, title: 0.6, field: 1, sil: 1 };

let W0 = 0; // resting slot width
let H0 = 0; // resting slot height
let R0 = { x: 0, y: 0 };
const lw = {};

function svg(w, h, inner) {
  return `<svg xmlns="${NS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="visible">${inner}</svg>`;
}

// ---- sky: bone, blue ruled lines that bunch up toward the horizon, flat sun
function buildSky(w, h) {
  const hz = h * 0.58;
  let s = `<rect width="${w}" height="${hz + 2}" fill="${BONE}"/>`;
  const n = 24;
  for (let i = 1; i < n; i++) {
    const u = i / n;
    const y = hz * (1 - Math.pow(1 - u, 2));
    s += `<line x1="0" x2="${w}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${BLU}" stroke-width="1.4"/>`;
  }
  const r = h * 0.2;
  const cx = w * 0.56;
  s += `<circle cx="${cx}" cy="${hz}" r="${r}" fill="${YEL}"/>`;
  s += `<circle cx="${cx + 5}" cy="${hz - 4}" r="${r}" fill="none" stroke="${INK}" stroke-width="1.6"/>`;
  return svg(w, h, s);
}

// ---- field: flat yellow with black lines running to a vanishing point on the horizon
function buildField(w, h) {
  const hz = h * 0.58;
  let s = `<rect y="${hz}" width="${w}" height="${h - hz + 2}" fill="${YEL}"/>`;
  s += `<rect x="3" y="${hz + 3}" width="${w}" height="${h - hz}" fill="none"/>`;
  const vx = w / 2;
  const step = Math.max(34, w / 120);
  const reach = (h - hz) * 14;
  for (let x = vx - w; x <= vx + w; x += step) {
    const bx = vx + (x - vx) * (reach / (h - hz)) * 0.12;
    s += `<line x1="${vx}" y1="${hz}" x2="${bx.toFixed(1)}" y2="${h}" stroke="${INK}" stroke-width="1.3"/>`;
  }
  // plough rows across the field, wider apart toward the viewer
  for (let i = 1; i < 7; i++) {
    const y = hz + (h - hz) * Math.pow(i / 7, 1.9);
    s += `<line x1="0" x2="${w}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${INK}" stroke-width="1"/>`;
  }
  s += `<line x1="0" x2="${w}" y1="${hz}" y2="${hz}" stroke="${INK}" stroke-width="2.4"/>`;
  return svg(w, h, s);
}

// ---- silhouettes standing on the horizon
function buildSil(w, h) {
  const hz = h * 0.58;
  const u = h / 100; // unit
  let g = '';
  // fence posts with wire
  const fence = (x0, x1) => {
    let f = '';
    const gap = 9 * u;
    const ph = 7 * u;
    let px = [];
    for (let x = x0; x <= x1; x += gap) px.push(x);
    px.forEach((x) => (f += `<rect x="${x - 0.6 * u}" y="${hz - ph}" width="${1.2 * u}" height="${ph + 1}"/>`));
    for (let k = 0; k < 3; k++) {
      const yy = hz - ph + (k + 0.6) * 1.7 * u;
      let d = `M${px[0]} ${yy}`;
      for (let i = 1; i < px.length; i++) d += ` Q${(px[i - 1] + px[i]) / 2} ${yy + 1.4 * u} ${px[i]} ${yy}`;
      f += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${0.35 * u}"/>`;
    }
    return f;
  };
  const windmill = (x) => {
    const th = 30 * u;
    const top = hz - th;
    let m = `<path d="M${x - 3 * u} ${hz} L${x - 1 * u} ${top} L${x + 1 * u} ${top} L${x + 3 * u} ${hz}Z"/>`;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + 0.5;
      const bx = x + Math.cos(a) * 10 * u;
      const by = top + Math.sin(a) * 10 * u;
      const nx = -Math.sin(a) * 1.4 * u;
      const ny = Math.cos(a) * 1.4 * u;
      m += `<path d="M${x} ${top} L${bx + nx} ${by + ny} L${bx - nx} ${by - ny}Z"/>`;
    }
    return m + `<circle cx="${x}" cy="${top}" r="${1.4 * u}"/>`;
  };
  const tower = (x) => {
    const t = 22 * u;
    return (
      `<rect x="${x - 5 * u}" y="${hz - t - 9 * u}" width="${10 * u}" height="${9 * u}"/>` +
      `<path d="M${x - 5 * u} ${hz - t - 9 * u} L${x} ${hz - t - 13 * u} L${x + 5 * u} ${hz - t - 9 * u}Z"/>` +
      `<path d="M${x - 4 * u} ${hz - t} L${x - 5 * u} ${hz} M${x + 4 * u} ${hz - t} L${x + 5 * u} ${hz} M${x - 4 * u} ${hz - t} L${x + 5 * u} ${hz} M${x + 4 * u} ${hz - t} L${x - 5 * u} ${hz}" stroke="${INK}" stroke-width="${0.9 * u}" fill="none"/>`
    );
  };
  const trees = (x0, x1) => {
    let t = '';
    let i = 0;
    for (let x = x0; x <= x1; x += 7 * u, i++) {
      const th = (13 + ((i * 7) % 9)) * u;
      t += `<rect x="${x - 0.5 * u}" y="${hz - th * 0.45}" width="${u}" height="${th * 0.45}"/>`;
      t += `<ellipse cx="${x}" cy="${hz - th * 0.7}" rx="${4.4 * u}" ry="${th * 0.4}"/>`;
    }
    return t;
  };
  const elevator = (x) => {
    let e = '';
    [0, 5.5, 11, 16.5].forEach((o, i) => {
      e += `<rect x="${x + o * u}" y="${hz - 26 * u}" width="${5 * u}" height="${26 * u}"/>`;
      e += `<path d="M${x + o * u} ${hz - 26 * u} L${x + (o + 2.5) * u} ${hz - 29 * u} L${x + (o + 5) * u} ${hz - 26 * u}Z"/>`;
    });
    e += `<rect x="${x - 3 * u}" y="${hz - 12 * u}" width="${28 * u}" height="${12 * u}"/>`;
    e += `<rect x="${x + 6 * u}" y="${hz - 36 * u}" width="${8 * u}" height="${10 * u}"/>`;
    return e;
  };
  g += fence(w * 0.04, w * 0.22);
  g += tower(w * 0.28);
  g += windmill(w * 0.4);
  g += trees(w * 0.5, w * 0.62);
  g += fence(w * 0.64, w * 0.74);
  g += elevator(w * 0.8);
  g += fence(w * 0.9, w * 0.97);
  const base = `<rect x="0" y="${hz - 0.4}" width="${w}" height="3"/>`;
  return svg(
    w,
    h,
    `<g fill="${BLU}" opacity="0.85" transform="translate(-4 2.5)">${g}</g><g fill="${INK}" stroke="none">${g}${base}</g>`
  );
}

// ---- the giant title, only part of it fits at a time
function buildTitle(w, h) {
  const cap = h * 0.8;
  const fs = cap / 0.7;
  const by = h * 0.5 + cap / 2;
  const txt = (x, y, fill, stroke) =>
    `<text x="${x}" y="${y}" textLength="${w - 12}" lengthAdjust="spacingAndGlyphs" fill="${fill}" ${
      stroke ? `stroke="${stroke}" stroke-width="${Math.max(3, h * 0.012)}" paint-order="stroke" stroke-linejoin="round"` : ''
    } style="font-family:Anybody,'Arial Black',Impact,sans-serif;font-weight:900;font-size:${fs}px;font-variation-settings:'wdth' 150;font-stretch:150%">HACK THE WU</text>`;
  return svg(w, h, `<g>${txt(6 + h * 0.025, by + h * 0.02, BLU)}${txt(6, by, BONE, INK)}</g>`);
}

function build() {
  const r = ref.getBoundingClientRect();
  W0 = Math.round(r.width);
  H0 = Math.round(r.height);
  R0 = { x: r.left, y: r.top };
  world.style.width = W0 + 'px';
  world.style.height = H0 + 'px';
  world.style.setProperty('--wh', H0 + 'px');
  for (const k of Object.keys(L)) {
    lw[k] = Math.round(W0 * (1 + 2 * RATE[k] * (k === 'title' ? 2.2 / 2.2 : 1)));
  }
  lw.title = Math.round(Math.max(W0 * 2.2, H0 * 7));
  lw.sky = Math.round(W0 * 1.6);
  lw.field = lw.sil = W0 * 3;
  L.sky.innerHTML = buildSky(lw.sky, H0);
  L.field.innerHTML = buildField(lw.field, H0);
  L.sil.innerHTML = buildSil(lw.sil, H0);
  L.title.innerHTML = buildTitle(lw.title, H0);
  for (const k of Object.keys(L)) L[k].style.width = lw[k] + 'px';
  for (const k of Object.keys(L)) L[k].style.height = H0 + 'px';
}

// pan p in 0..1, each layer travels its own distance
function paint(p) {
  for (const k of Object.keys(L)) {
    const dist = lw[k] - W0;
    L[k].style.transform = `translate3d(${(-p * dist).toFixed(2)}px,0,0)`;
  }
}

// grow the slot to the viewport (minus 16px) as the page scrolls
let s = 0;
let dx = 0;
let dy = 0;
function frame() {
  const vw = innerWidth;
  const vh = innerHeight;
  const m = 16;
  const x = R0.x + (m - R0.x) * s + dx * (1 - s);
  const y = R0.y + (m - R0.y) * s + dy * (1 - s);
  const w = W0 + (vw - 2 * m - W0) * s;
  const h = H0 + (vh - 2 * m - H0) * s;
  eye.style.left = x.toFixed(1) + 'px';
  eye.style.top = y.toFixed(1) + 'px';
  eye.style.width = w.toFixed(1) + 'px';
  eye.style.height = h.toFixed(1) + 'px';
  const rad = 60 + (8 - 60) * s;
  eye.style.setProperty('--r', Math.min(rad, h / 2).toFixed(1) + 'px');
  // keep the landscape at its own size, cover-scaled while growing
  const k = Math.max(w / W0, h / H0);
  world.style.transform = `translateX(-50%) scale(${k.toFixed(3)})`;
  // landscape fully visible to 15 percent, fully black by 75 percent
  const fade = Math.min(1, Math.max(0, (s - 0.15) / 0.6));
  world.style.opacity = (1 - fade).toFixed(3);
  root.classList.toggle('mid-grow', s > 0.05 && s < 0.7);
}

function onScroll() {
  s = Math.min(1, Math.max(0, scrollY / (innerHeight * 0.9)));
  root.style.setProperty('--s', s.toFixed(3));
  under.classList.toggle('is-gone', s > 0.25);
  under.style.pointerEvents = s > 0.25 ? 'none' : '';
  if (still) frame();
}

// ---- blink
let shutTimer = 0;
function blink() {
  if (still) return;
  eye.classList.add('is-shut');
  clearTimeout(shutTimer);
  shutTimer = setTimeout(() => eye.classList.remove('is-shut'), 170);
}
function scheduleBlink() {
  setTimeout(() => {
    blink();
    scheduleBlink();
  }, 4000 + Math.random() * 4000);
}

// ---- nav
function setupNav() {
  const links = [...document.querySelectorAll('.bearing a')];
  links.forEach((a, i) => {
    a.addEventListener('click', (e) => {
      blink();
      root.style.setProperty('--idx', i);
      links.forEach((l) => l.removeAttribute('aria-current'));
      a.setAttribute('aria-current', 'true');
      if (a.hasAttribute('data-stub')) e.preventDefault();
      if (a.getAttribute('href') === '#about') {
        e.preventDefault();
        document.getElementById('about').scrollIntoView({ behavior: still ? 'auto' : 'smooth' });
      }
    });
  });
}

// ---- run
cursorGuard();
if (!still) barCursor();
setupNav();

let target = 0.5;
let pan = 0.5;
let lastMove = -1e9;
let dragging = false;
let dragX = 0;
let dragP = 0;

function init() {
  build();
  onScroll();
  frame();
  paint(0.5);
}
init();
addEventListener('resize', () => {
  init();
});
addEventListener('scroll', onScroll, { passive: true });

if (still) {
  // composed still: centred on THE
  pan = 0.5;
  paint(pan);
  frame();
} else {
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    lastMove = performance.now();
    target = e.clientX / innerWidth;
    dx = (e.clientX / innerWidth - 0.5) * 12;
    dy = (e.clientY / innerHeight - 0.5) * 6;
  });
  eye.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    dragging = true;
    dragX = e.clientX;
    dragP = target;
    lastMove = performance.now();
  });
  addEventListener('pointermove', (e) => {
    if (!dragging) return;
    lastMove = performance.now();
    target = Math.min(1, Math.max(0, dragP - (e.clientX - dragX) / (W0 * 1.2)));
  });
  addEventListener('pointerup', () => (dragging = false));
  addEventListener('pointercancel', () => (dragging = false));
  scheduleBlink();
  let prev = performance.now();
  const tick = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    if (now - lastMove > 2500 && !dragging) {
      target = 0.5 + 0.38 * Math.sin(now / 1000 * 0.22);
    }
    pan += (target - pan) * (1 - Math.exp(-dt * 4));
    paint(pan);
    frame();
  };
  try {
    frameLoop(eye, tick);
  } catch (err) {
    const loop = () => {
      tick();
      requestAnimationFrame(loop);
    };
    loop();
  }
}
void isPhone;
void usePoster;
