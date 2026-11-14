import { reducedMotion } from '../../../shared/base.js';

const root = document.documentElement;
const goat = document.getElementById('goat');
const slot = document.getElementById('slot');
const lid = document.getElementById('lid');
const pupil = goat.querySelector('.pupil');
const actions = document.querySelector('.hero-actions');
const HX = 670, HY = 263;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const still = reducedMotion();
if (still) root.classList.add('static');

const PB = pupil.getBBox();
const PCX = PB.x + PB.width / 2, PCY = PB.y + PB.height / 2;

let W, H, phone, L;

function geom() {
  W = innerWidth; H = innerHeight;
  phone = W <= 760 && H > W;
  let k0, c0, r0;
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
  const kEnd = (phone ? 0.86 : 0.60) * W / PB.width;
  const end = { cx: W / 2 - (PCX - HX) * kEnd, cy: (phone ? 0.38 : 0.43) * H - (PCY - HY) * kEnd };
  const re = { x: end.cx + (PB.x - HX) * kEnd, y: end.cy + (PB.y - HY) * kEnd, w: PB.width * kEnd, h: PB.height * kEnd };
  const ax = actions.offsetWidth;
  L = { k0, c0, kEnd, end, r0, re, ax0: r0.x, ax1: (W - ax) / 2 };
  root.style.setProperty('--barb', (r0.y + r0.h).toFixed(0) + 'px');
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

function placeSlot(r) {
  slot.style.left = r.x.toFixed(1) + 'px'; slot.style.top = r.y.toFixed(1) + 'px';
  slot.style.width = r.w.toFixed(1) + 'px'; slot.style.height = r.h.toFixed(1) + 'px';
}

function apply(p) {
  const { k0, c0, kEnd, end, r0, re } = L;
  const e = ease(p);
  const k = k0 * Math.pow(kEnd / k0, e);
  const cx = lerp(c0.cx, end.cx, e), cy = lerp(c0.cy, end.cy, e);
  goat.style.transform = `translate(${cx.toFixed(2)}px,${cy.toFixed(2)}px) scale(${k.toFixed(4)}) translate(${-HX}px,${-HY}px)`;
  lid.setAttribute('transform', `translate(0,${(-34 * clamp(p * 3, 0, 1)).toFixed(2)})`);
  const r = { x: lerp(r0.x, re.x, e), y: lerp(r0.y, re.y, e), w: lerp(r0.w, re.w, e), h: lerp(r0.h, re.h, e) };
  placeSlot(r);
  // hard toggle once the title box sits inside the real pupil
  const px = cx + (PB.x - HX) * k, py = cy + (PB.y - HY) * k, pw = PB.width * k, ph = PB.height * k, t = 2;
  const inside = r.x >= px - t && r.y >= py - t && r.x + r.w <= px + pw + t && r.y + r.h <= py + ph + t;
  root.classList.toggle('in-pupil', inside || p >= 1);
  root.classList.toggle('hero-gone', p > 0.002);
  // buttons ride just under the title box
  actions.style.top = (r.y + r.h + 22).toFixed(0) + 'px';
  if (!phone) actions.style.left = lerp(L.ax0, L.ax1, e).toFixed(0) + 'px'; else actions.style.left = '';
}

function progress() { return still ? 0 : clamp(scrollY / H, 0, 1); }
function update() { apply(progress()); }

addEventListener('scroll', update, { passive: true });
addEventListener('resize', () => { geom(); update(); });
geom();
update();
