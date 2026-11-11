import { reducedMotion, qualityTier, cappedDpr, cursorGuard, frameLoop, usePoster, isPhone } from '../../shared/base.js';
import { createEye } from './eye.js';

const root = document.documentElement;
const canvas = document.getElementById('eye');
const tier = qualityTier();
const still = reducedMotion();
const touch = isPhone() || window.matchMedia('(hover: none)').matches;

const eye = tier === 0 ? null : createEye(canvas, { dpr: cappedDpr(tier), onLost: () => usePoster(canvas) });
if (!eye) usePoster(canvas);

cursorGuard();

// touch and reduced motion: all text at full brightness
if (still || touch) root.classList.add('full');

const near = [...document.querySelectorAll('[data-near]')];
const NEAR_PX = 260;

// stub links go nowhere
document.querySelectorAll('[data-stub]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));

const openAt = () => Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.9)));

function place() {
  if (!eye) return;
  const phone = isPhone() && window.innerWidth < window.innerHeight;
  eye.state.scale = phone ? 1.32 : 1;
  eye.state.center = phone ? [0, 0.16] : [0, 0.02];
  eye.state.margin = phone ? 9 : 16;
  eye.state.cornerRadius = phone ? 18 : 26;
  eye.resize();
}

function writePupil() {
  const r = eye.pupilRect();
  root.style.setProperty('--px', r.x.toFixed(1) + 'px');
  root.style.setProperty('--py', r.y.toFixed(1) + 'px');
  root.style.setProperty('--pw', r.w.toFixed(1) + 'px');
  root.style.setProperty('--ph', r.h.toFixed(1) + 'px');
  root.style.setProperty('--open', eye.state.open.toFixed(3));
  root.classList.toggle('is-open', eye.state.open > 0.5);
}

// brighten text and lamps near the flame
let fallback = null;
function lightText() {
  if (root.classList.contains('full') && !touch) return;
  const l = eye ? eye.getLight() : fallback;
  for (const el of near) {
    let b = 0;
    if (l) {
      const r = el.getBoundingClientRect();
      const dx = Math.max(r.left - l[0], 0, l[0] - r.right);
      const dy = Math.max(r.top - l[1], 0, l[1] - r.bottom);
      b = Math.max(0, 1 - Math.hypot(dx, dy) / NEAR_PX);
    }
    el.style.setProperty('--b', b.toFixed(2));
    if (el.hasAttribute('data-lamp')) el.classList.toggle('lit', b > 0.55);
  }
}

if (eye) {
  place();
  window.addEventListener('resize', place);
  const move = (e) => eye.setLight(e.clientX, e.clientY);
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerdown', move, { passive: true });
  window.addEventListener(
    'touchmove',
    (e) => e.touches[0] && eye.setLight(e.touches[0].clientX, e.touches[0].clientY),
    { passive: true }
  );
  eye.state.still = still;

  if (still) {
    const draw = () => {
      eye.state.open = openAt();
      eye.render(0, 0.016);
      writePupil();
    };
    draw();
    window.addEventListener('scroll', draw, { passive: true });
    window.addEventListener('resize', draw);
  } else {
    frameLoop(canvas, (t, dt) => {
      eye.state.open = openAt();
      eye.render(t, dt);
      writePupil();
      lightText();
    });
  }
} else {
  // no WebGL: keep the pointer for text brightening only
  window.addEventListener('pointermove', (e) => {
    fallback = [e.clientX, e.clientY];
    lightText();
  }, { passive: true });
  window.addEventListener('scroll', () => root.classList.toggle('is-open', openAt() > 0.5), { passive: true });
}

window.__eye = eye;
