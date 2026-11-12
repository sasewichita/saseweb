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
  const stepped = (v, n) => Math.round(v * n) / n;

  function cut() {
    const s = stage.getBoundingClientRect();
    const w = win.getBoundingClientRect();
    const hole = holePath(s.width, s.height, { x: w.left - s.left, y: w.top - s.top, w: w.width, h: w.height }, 3);
    red.style.clipPath = hole;
    paper.style.clipPath = hole;
  }

  function apply() {
    const rIn = clamp((p - 0.08) / 0.28, 0, 1);
    // the red rolls on from the left in hard steps
    roll.style.clipPath = `inset(0 ${(100 - stepped(rIn, 12) * 100).toFixed(1)}% 0 0)`;
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
  cut();
  read();
  apply();
  void root;
  void pulls;
}
