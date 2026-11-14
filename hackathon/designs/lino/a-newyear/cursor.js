// A · New Year Print: the site cursor. A solid cut shape that changes with the section.
// Modes come from the closest [data-cursor]: bar, strike, roller, lens, seal, spark, none.
import { cursorGuard, reducedMotion } from '../../shared/base.js';

const SNAP = 'a[href], button, summary, [role="button"], input, select, textarea, label[for]';
// width, height of each mode
const SIZE = { bar: [34, 8], lens: [34, 8], strike: [20, 20], roller: [120, 10], seal: [26, 26], spark: [24, 24] };

const root = document.documentElement;
const active = cursorGuard();
const cur = document.createElement('div');
cur.className = 'cur';
cur.setAttribute('aria-hidden', 'true');
cur.innerHTML = '<i class="cur-k"></i><i class="cur-m"></i>';
document.body.appendChild(cur);

let x = -100;
let y = -100;
let seen = false;
let queued = false;
let target = null;

function paint() {
  queued = false;
  if (!seen || !active() || reducedMotion()) return cur.classList.remove('is-on');
  const el = target && target.closest ? target : null;
  const host = el ? el.closest('[data-cursor]') : null;
  let mode = host ? host.dataset.cursor : 'bar';
  // lens hides itself over anything marked none, and so does every other mode
  if (mode === 'none') return cur.classList.remove('is-on');
  if (!SIZE[mode]) mode = 'bar';
  let [w, h] = SIZE[mode];
  let left = x - w / 2;
  let top = y - h / 2;
  // the bar snaps under a link like an underline
  if (mode === 'bar' || mode === 'lens') {
    const link = el && el.closest(SNAP);
    if (link) {
      const r = link.getBoundingClientRect();
      w = Math.max(24, Math.min(r.width, 340));
      h = 6;
      left = r.left;
      top = r.bottom - 5;
    } else {
      left = x - 4;
      top = y - 4;
    }
  }
  const diff = !!(el && el.closest('.hero')) && !root.classList.contains('hero-gone');
  cur.dataset.mode = mode;
  cur.classList.toggle('is-diff', diff);
  cur.style.width = w + 'px';
  cur.style.height = h + 'px';
  cur.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
  cur.classList.add('is-on');
}
function ask() {
  if (!queued) {
    queued = true;
    requestAnimationFrame(paint);
  }
}

window.addEventListener(
  'pointermove',
  (e) => {
    if (e.pointerType === 'touch') return;
    x = e.clientX;
    y = e.clientY;
    target = e.target;
    seen = true;
    ask();
  },
  { passive: true },
);
// when the page scrolls under a still pointer, look again at what is under it
window.addEventListener(
  'scroll',
  () => {
    if (!seen) return;
    target = document.elementFromPoint(x, y) || target;
    ask();
  },
  { passive: true },
);
document.addEventListener('pointerleave', () => cur.classList.remove('is-on'));
document.documentElement.addEventListener('mouseleave', () => cur.classList.remove('is-on'));
// a press: the shape lands a hair off register for a moment
window.addEventListener('pointerdown', () => cur.classList.add('is-hit'));
window.addEventListener('pointerup', () => cur.classList.remove('is-hit'));
