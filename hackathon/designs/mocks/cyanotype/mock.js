import { reducedMotion, qualityTier, cappedDpr, cursorGuard, frameLoop, usePoster, isPhone } from '../../shared/base.js';
import { createEye } from './eye.js';

const root = document.documentElement;
const canvas = document.getElementById('eye');
const stage = document.getElementById('stage');
const leaders = document.getElementById('leaders');
const regs = document.querySelector('.regs');
const sheet = document.getElementById('sheet');
const tier = qualityTier();
const still = reducedMotion();

const eye = tier === 0 ? null : createEye(canvas, { dpr: cappedDpr(tier), onLost: () => usePoster(canvas) });
if (!eye) usePoster(canvas);
cursorGuard();

const NS = 'http://www.w3.org/2000/svg';
const anns = {};
document.querySelectorAll('.ann').forEach((el) => {
  anns[el.dataset.k] = { el, w: 0, h: 0, path: document.createElementNS(NS, 'path'), dot: document.createElementNS(NS, 'circle') };
  leaders.append(anns[el.dataset.k].path, anns[el.dataset.k].dot);
  anns[el.dataset.k].dot.setAttribute('r', '2.5');
});

const isPhoneLayout = () => isPhone() && window.innerWidth < window.innerHeight;
const openAt = () => Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.9)));

function place() {
  if (eye) {
    const phone = isPhoneLayout();
    eye.state.scale = phone ? 1.32 : 1;
    eye.state.center = phone ? [0, 0.16] : [0, 0.02];
    eye.state.margin = phone ? 9 : 16;
    eye.state.cornerRadius = phone ? 18 : 26;
    eye.resize();
  }
  measure();
}

function measure() {
  for (const a of Object.values(anns)) {
    a.el.style.left = '0px';
    a.el.style.top = '0px';
    const r = a.el.getBoundingClientRect();
    a.w = r.width;
    a.h = r.height;
  }
}

// lid curves, same formulas as the shader
const upY = (xn) => { const k = 1 - xn * xn; return 0.292 * Math.pow(k, 0.7) + 0.04 * xn * k; };
const lowY = (xn) => { const k = 1 - xn * xn; return -0.25 * Math.pow(k, 0.86) + 0.022 * xn * k; };

function geometry() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  if (eye) {
    const [ex, ey, E] = eye.centerPx();
    return { W, H, ex, ey, E, p: eye.pupilRect() };
  }
  const E = Math.min(W, H) * 0.9;
  const ex = W / 2, ey = H * 0.45;
  return { W, H, ex, ey, E, p: { x: ex - 0.3 * E, y: ey - 0.09 * E, w: 0.6 * E, h: 0.18 * E } };
}

function writePupil(g) {
  const r = g.p;
  root.style.setProperty('--px', r.x.toFixed(1) + 'px');
  root.style.setProperty('--py', r.y.toFixed(1) + 'px');
  root.style.setProperty('--pw', r.w.toFixed(1) + 'px');
  root.style.setProperty('--ph', r.h.toFixed(1) + 'px');
}

function annotate(g) {
  const { W, ex, ey, E, p } = g;
  const phone = isPhoneLayout();
  const up = (xn) => [ex + xn * 0.66 * E, ey - upY(xn) * E];
  const lo = (xn) => [ex + xn * 0.66 * E, ey - lowY(xn) * E];
  const cfg = phone
    ? {
        edition: { x: 16, y: 18, right: false, t: up(-0.3) },
        dates: { x: W - 16, y: 70, right: true, t: up(0.35) },
        fig: { x: W - 16, y: 44, right: true, t: up(-0.05) },
        venue: { x: 16, y: ey + 0.2 * E, right: false, t: lo(-0.2) },
      }
    : {
        edition: { x: 16, y: 16, right: false, t: up(-0.3) },
        dates: { x: W - 16, y: 16, right: true, t: up(0.55) },
        fig: { x: 16, y: ey - 0.36 * E, right: false, t: [p.x, p.y + p.h / 2] },
        venue: { x: 16, y: ey + 0.12 * E, right: false, t: lo(-0.45) },
      };
  for (const [k, c] of Object.entries(cfg)) {
    const a = anns[k];
    const left = c.right ? c.x - a.w : c.x;
    a.el.style.left = left.toFixed(1) + 'px';
    a.el.style.top = c.y.toFixed(1) + 'px';
    const sy = c.y + a.h + 2;
    const mid = left + a.w / 2;
    const near = c.t[0] > mid ? left + a.w : left;
    const far = near === left ? left + a.w : left;
    a.path.setAttribute('d', `M${far.toFixed(1)} ${sy.toFixed(1)}L${near.toFixed(1)} ${sy.toFixed(1)}L${c.t[0].toFixed(1)} ${c.t[1].toFixed(1)}`);
    a.dot.setAttribute('cx', c.t[0].toFixed(1));
    a.dot.setAttribute('cy', c.t[1].toFixed(1));
  }
}

function update() {
  const open = eye ? eye.state.open : openAt();
  const g = geometry();
  writePupil(g);
  annotate(g);
  stage.style.opacity = String(Math.max(0, 1 - open * 2));
  stage.inert = open > 0.5;
  const done = open >= 0.97;
  regs.classList.toggle('on', done);
  sheet.textContent = done ? '02 of 07' : '01 of 07';
}

place();
window.addEventListener('resize', () => { place(); update(); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); update(); });

if (eye) {
  window.addEventListener('pointermove', (e) => eye.lookAt(e.clientX, e.clientY), { passive: true });
  window.addEventListener('pointerdown', (e) => eye.lookAt(e.clientX, e.clientY), { passive: true });
  eye.state.still = still;
  if (still) {
    const draw = () => { eye.state.open = openAt(); eye.render(0, 0.016); update(); };
    draw();
    window.addEventListener('scroll', draw, { passive: true });
    window.addEventListener('resize', draw);
  } else {
    frameLoop(canvas, (t, dt) => { eye.state.open = openAt(); eye.render(t, dt); update(); });
  }
} else {
  update();
  window.addEventListener('scroll', update, { passive: true });
}

// ruler tape: stub stops slide the index mark, About scrolls
const tape = document.querySelector('.tape');
tape.querySelectorAll('a').forEach((a) => {
  a.addEventListener('click', (e) => {
    tape.querySelectorAll('a').forEach((o) => o.removeAttribute('aria-current'));
    a.setAttribute('aria-current', 'true');
    tape.style.setProperty('--i', a.dataset.i);
    if (a.dataset.i !== '0') e.preventDefault();
  });
});

// crosshair with a bearing readout, only for a real mouse
const xh = document.querySelector('.xh');
const xv = xh.querySelector('.xv');
const xz = xh.querySelector('.xhz');
const xr = xh.querySelector('.xr');
window.addEventListener('pointermove', (e) => {
  if (!root.classList.contains('has-cursor')) return;
  xh.classList.add('live');
  const x = e.clientX, y = e.clientY;
  const g = geometry();
  const open = eye ? eye.state.open : openAt();
  const cx = open > 0.5 ? g.W / 2 : g.ex;
  const cy = open > 0.5 ? g.H / 2 : g.ey;
  const deg = Math.round((Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI + 360) % 360;
  xr.textContent = 'BRG ' + String(deg).padStart(3, '0') + '°';
  xv.style.transform = `translateX(${x}px)`;
  xz.style.transform = `translateY(${y}px)`;
  const rx = x + 14 + 90 > g.W ? x - 100 : x + 14;
  xr.style.transform = `translate(${rx}px, ${Math.min(y + 14, g.H - 60)}px)`;
}, { passive: true });

window.__eye = eye;
