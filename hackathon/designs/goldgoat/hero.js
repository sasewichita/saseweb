// HERO: the scroll zoom into the goat's eye, a short hold, then the exit: the page rises, the
// view pulls back out of the eye and the whole goat lands on the page's top edge, where About's
// own goat takes over. Main thread only.
//
// Classes on <html>, for every other module:
//   hero-gone  the zoom has begun (captions, chop and frame hide)
//   hero-out   the hero's own Register button is no longer on screen (show the fixed one)
//   hero-done  the page covers the stage; About's goat stands on the page's top edge
import { still, onScroll } from './kit.js';

const root = document.documentElement;
const hero = document.getElementById('top');
const goat = document.getElementById('goat');
const slot = document.getElementById('slot');
const lid = document.getElementById('lid');
const pupil = goat.querySelector('.pupil');
const actions = document.querySelector('.hero-actions');
const HX = 670, HY = 263; // the eye, in the goat's own units
const RIG_X = 80, RIG_W = 760, HOOF_Y = 700; // the rig actor's box: left edge, width, hoof line
const LIFT = 11; // --edge-lift in kit.css: the hoof line sits this far above the page's top
const QLEN = 0.6; // the exit runs over this many screen heights
const QFIT = 0.6; // share of the exit after which the hooves ride the page's edge
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const PB = pupil.getBBox();
const PCX = PB.x + PB.width / 2, PCY = PB.y + PB.height / 2;

let W, H, phone, L, heroH, pLen;

function geom() {
  W = innerWidth; H = innerHeight;
  phone = W <= 760 && H > W;
  heroH = hero.offsetHeight;
  // the zoom ends a little before the page starts to rise, whatever the browser bars do
  pLen = Math.max(0.5 * H, Math.min(H, heroH - 1.05 * H));
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
  // the exit: where the goat lands, and the size at which it first fits above the page
  const gut = phone ? 24 : 52;
  const kL = (phone ? 150 : 240) / RIG_W;
  const kFit = Math.min(0.62, (W - 2 * gut) / RIG_W);
  const xFit = (W - RIG_W * kFit) / 2;
  L = { k0, c0, kEnd, end, r0, re, ax0: r0.x, ax1: (W - ax) / 2, gut, kL, kFit, xFit };
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

function place(k, cx, cy) {
  goat.style.transform = `translate(${cx.toFixed(2)}px,${cy.toFixed(2)}px) scale(${k.toFixed(4)}) translate(${-HX}px,${-HY}px)`;
}
function placeSlot(r) {
  slot.style.left = r.x.toFixed(1) + 'px'; slot.style.top = r.y.toFixed(1) + 'px';
  slot.style.width = r.w.toFixed(1) + 'px'; slot.style.height = r.h.toFixed(1) + 'px';
}
function setLid(open) {
  lid.setAttribute('transform', `translate(0,${(-34 * open).toFixed(2)})`);
}

// 0 to 1: from the whole goat on its title bar into the pupil
function zoom(p) {
  const { k0, c0, kEnd, end, r0, re } = L;
  const e = ease(p);
  const k = k0 * Math.pow(kEnd / k0, e);
  const cx = lerp(c0.cx, end.cx, e), cy = lerp(c0.cy, end.cy, e);
  place(k, cx, cy);
  setLid(clamp(p * 3, 0, 1));
  const r = { x: lerp(r0.x, re.x, e), y: lerp(r0.y, re.y, e), w: lerp(r0.w, re.w, e), h: lerp(r0.h, re.h, e) };
  placeSlot(r);
  // hard toggle once the title box sits inside the real pupil
  const px = cx + (PB.x - HX) * k, py = cy + (PB.y - HY) * k, pw = PB.width * k, ph = PB.height * k, t = 2;
  const inside = r.x >= px - t && r.y >= py - t && r.x + r.w <= px + pw + t && r.y + r.h <= py + ph + t;
  root.classList.toggle('in-pupil', inside || p >= 1);
  // buttons ride just under the title box
  // (on phones they start lower, clear of the pitch line, and close up as the zoom begins)
  const top = r.y + r.h + (phone ? lerp(86, 22, clamp(p * 8, 0, 1)) : 22);
  actions.style.top = top.toFixed(0) + 'px';
  if (!phone) actions.style.left = lerp(L.ax0, L.ax1, e).toFixed(0) + 'px'; else actions.style.left = '';
  return top;
}

// 0 to 1: back out of the eye. First the goat shrinks nearly in place until it fits above the
// page; from QFIT on its hooves ride the page's top edge while it settles at the left gutter.
function exit(q, edgeY) {
  const { kEnd, end, kL, kFit, xFit, gut } = L;
  let k, cx, cy;
  if (q < QFIT) {
    const t = q / QFIT;
    k = kEnd * Math.pow(kFit / kEnd, t);
    const edgeFit = H - QFIT * QLEN * H - LIFT; // where the edge will be at QFIT
    const fx = xFit + (HX - RIG_X) * kFit, fy = edgeFit - (HOOF_Y - HY) * kFit;
    const e = ease(t);
    cx = lerp(end.cx, fx, e); cy = lerp(end.cy, fy, e);
  } else {
    const t = (q - QFIT) / (1 - QFIT);
    k = kFit * Math.pow(kL / kFit, t);
    const x = lerp(xFit, gut, ease(t));
    cx = x + (HX - RIG_X) * k; cy = edgeY - (HOOF_Y - HY) * k;
  }
  place(k, cx, cy);
  setLid(1 - clamp(q * 4, 0, 1));
}

function update() {
  const y = scrollY;
  const mainTop = heroH - y; // the page's top edge on screen
  if (still) {
    const actionsTop = zoom(0);
    root.classList.toggle('hero-out', mainTop < actionsTop + 48);
    root.classList.toggle('hero-done', mainTop <= 0);
    return;
  }
  const p = clamp(y / pLen, 0, 1);
  const q = clamp((H - mainTop) / (QLEN * H), 0, 1);
  zoom(p);
  if (q > 0) exit(q, mainTop - LIFT);
  root.classList.toggle('hero-gone', p > 0.002);
  root.classList.toggle('hero-out', q > 0);
  root.classList.toggle('hero-done', q >= 1);
}

addEventListener('resize', () => { geom(); update(); });
geom();
onScroll(update);
update();
