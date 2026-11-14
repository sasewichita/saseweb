// A · New Year Print: weekend, three pulls. Scroll drives the print: paper, red, key, seal.
import { reducedMotion } from '../../shared/base.js';
import { holePath } from './site.js';

const sec = document.getElementById('weekend');
const win = sec && sec.querySelector('[data-window="pulls"]');
if (sec && win) {
  const still = reducedMotion();
  const root = document.documentElement;
  const pulls = sec.querySelector('.pulls');
  const seal = sec.querySelector('.pull-seal');
  const steps = [...sec.querySelectorAll('.pulls li')];
  const h2 = sec.querySelector('h2');
  // wrap everything in one stage, add the paper and red layers under it
  const stage = document.createElement('div');
  stage.className = 'wk-stage';
  const paper = document.createElement('div');
  paper.className = 'wk-paper';
  const roll = document.createElement('div');
  roll.className = 'wk-roll';
  const red = document.createElement('div');
  red.className = 'red';
  roll.append(red);
  [paper, roll].forEach((l) => l.setAttribute('aria-hidden', 'true'));
  while (sec.firstChild) stage.append(sec.firstChild);
  stage.prepend(paper, roll);
  sec.append(stage);
  sec.classList.add('wk-on');
  if (!still) sec.classList.add('wk-track');
  void h2;

  let p = still ? 1 : 0;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (t) => t * t * (3 - 2 * t);

  // a tiny seeded random so the roller edge is the same every frame and load
  function seeded(seed) {
    let s = seed * 9301 + 49297;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  // the wet edge of the roller: one offset per row, depends only on y
  const ROW = 4.5;
  let prof = [];
  let stageW = 1;
  let stageH = 1;
  let lastEdge = null;

  function buildProfile(W, H) {
    const rnd = seeded(7);
    const n = Math.ceil(H / ROW) + 1;
    const knotGap = 100;
    const knots = [];
    for (let i = 0; i < Math.ceil(H / knotGap) + 3; i++) knots.push((rnd() * 2 - 1) * 0.015 * W);
    prof = [];
    let streak = 0;
    let left = 0;
    for (let i = 0; i < n; i++) {
      const y = i * ROW;
      const k = y / knotGap;
      const k0 = Math.floor(k);
      const t = smooth(k - k0);
      const slow = knots[k0] * (1 - t) + knots[k0 + 1] * t;
      const fine = (rnd() * 2 - 1) * 0.005 * W;
      if (left <= 0) {
        left = 1 + Math.floor(rnd() * 3);
        streak = rnd() < 0.5 ? 0 : (0.15 + rnd() * 0.85) * 0.09 * W;
      }
      left--;
      prof.push(slow + fine - streak);
    }
  }

  function cut() {
    const s = stage.getBoundingClientRect();
    const w = win.getBoundingClientRect();
    const hole = holePath(s.width, s.height, { x: w.left - s.left, y: w.top - s.top, w: w.width, h: w.height }, 3);
    red.style.clipPath = hole;
    paper.style.clipPath = hole;
    stage.style.setProperty('--wx', (w.left - s.left).toFixed(1) + 'px');
    stage.style.setProperty('--wy', (w.top - s.top).toFixed(1) + 'px');
    stage.style.setProperty('--ww', w.width.toFixed(1) + 'px');
    stage.style.setProperty('--wh', w.height.toFixed(1) + 'px');
    stageW = s.width;
    stageH = s.height;
    buildProfile(s.width, s.height);
    lastEdge = null;
    if (typeof apply === 'function' && ready) apply();
  }

  let ready = false;

  function applyRoll() {
    const pass = smooth(clamp((p - 0.08) / 0.28, 0, 1));
    if (pass <= 0) {
      if (lastEdge !== -1) roll.style.clipPath = 'inset(0 100% 0 0)';
      lastEdge = -1;
      return;
    }
    if (pass >= 0.999) {
      if (lastEdge !== -2) roll.style.clipPath = 'none';
      lastEdge = -2;
      return;
    }
    const edge = (pass * 1.1 - 0.05) * stageW;
    if (lastEdge !== null && Math.abs(edge - lastEdge) < 1) return;
    lastEdge = edge;
    const f = (v) => v.toFixed(1);
    let pts = '0px 0px';
    for (let i = 0; i < prof.length; i++) {
      const x = Math.max(0, edge + prof[i]);
      pts += `,${f(x)}px ${f(i * ROW)}px,${f(x)}px ${f(Math.min(stageH, (i + 1) * ROW))}px`;
    }
    pts += `,0px ${f(stageH)}px`;
    roll.style.clipPath = `polygon(${pts})`;
  }

  function apply() {
    applyRoll();
    const on = p < 0.36 ? 0 : p < 0.7 ? 1 : 2;
    steps.forEach((li, i) => li.classList.toggle('is-on', i === (p < 0.36 ? 0 : on)));
    if (seal) seal.classList.toggle('is-stamped', p >= 0.72);
    window.__pullP = p;
    window.dispatchEvent(new Event('weekend-pull'));
  }

  function read() {
    if (still) return;
    const r = sec.getBoundingClientRect();
    const total = Math.max(1, r.height - window.innerHeight);
    p = clamp(-r.top / total, 0, 1);
  }

  let asked = false;
  function ask() {
    if (asked) return;
    asked = true;
    requestAnimationFrame(() => {
      asked = false;
      read();
      apply();
    });
  }
  window.addEventListener('scroll', ask, { passive: true });
  window.addEventListener('resize', () => {
    cut();
    ask();
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(cut);
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => cut());
    ro.observe(win);
    ro.observe(stage);
  }
  cut();
  read();
  ready = true;
  apply();
  void root;
  void pulls;
}
