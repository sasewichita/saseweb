import { reducedMotion, qualityTier, cappedDpr, cursorGuard, frameLoop, usePoster, isPhone } from '../../shared/base.js';
import { createEye } from './eye.js';
import { barCursor } from './cursor.js';

const root = document.documentElement;
const canvas = document.getElementById('eye');
const tier = qualityTier();
const still = reducedMotion();

const eye = tier === 0 ? null : createEye(canvas, { dpr: cappedDpr(tier), onLost: () => usePoster(canvas) });
if (!eye) usePoster(canvas);

cursorGuard();
if (!still) barCursor();

// how far the big pupil has opened: the first screen of scroll opens it all the way
const openAt = () => Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.9)));

// the wall looks at a pointer; with no real pointer a ghost one drifts across it
let real = false;
let lastReal = -10;
function ghost(t) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return [w * (0.5 + 0.42 * Math.sin(t * 0.37)), h * (0.5 + 0.38 * Math.sin(t * 0.23 + 1.3))];
}
function point(x, y, t) {
  real = true;
  lastReal = t;
  eye.setPointer(x, y);
  eye.lookAt(x, y);
}

function place() {
  if (!eye) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const phone = isPhone() && w < h;
  const s = eye.state;
  s.scale = phone ? 0.85 : 0.74;
  s.center = phone ? [0, 0.1] : [0, 0.02];
  s.margin = phone ? 9 : 16;
  s.cornerRadius = phone ? 18 : 26;
  if (phone) {
    // two columns by five rows
    s.cell = [w / 2.05, h / 5];
    s.excl = [w * 0.5, h * 0.2];
  } else {
    s.cell = [w / 5, h / 4];
    s.excl = [w * 0.21, h * 0.2];
  }
  eye.resize();
}

function writePupil() {
  const r = eye.pupilRect();
  root.style.setProperty('--px', r.x.toFixed(1) + 'px');
  root.style.setProperty('--py', r.y.toFixed(1) + 'px');
  root.style.setProperty('--pw', r.w.toFixed(1) + 'px');
  root.style.setProperty('--ph', r.h.toFixed(1) + 'px');
  root.style.setProperty('--open', eye.state.open.toFixed(3));
}

// stub links in the strip go nowhere
document.querySelectorAll('[data-stub]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));

if (eye) {
  place();
  window.addEventListener('resize', place);
  window.addEventListener('pointermove', (e) => point(e.clientX, e.clientY, performance.now() / 1000), { passive: true });
  window.addEventListener('pointerdown', (e) => point(e.clientX, e.clientY, performance.now() / 1000), { passive: true });
  eye.state.still = still;

  if (still) {
    // one composed frame per scroll position; the wall looks toward the middle-left
    const draw = () => {
      eye.state.open = openAt();
      if (!real) eye.setPointer(window.innerWidth * 0.62, window.innerHeight * 0.42);
      eye.render(2.2, 0.016);
      writePupil();
    };
    draw();
    window.addEventListener('scroll', draw, { passive: true });
    window.addEventListener('resize', draw);
  } else {
    frameLoop(canvas, (t, dt) => {
      eye.state.open = openAt();
      if (!real || performance.now() / 1000 - lastReal > 5) {
        const g = ghost(t);
        eye.setPointer(g[0], g[1]);
      }
      eye.render(t, dt);
      writePupil();
    });
  }
}

window.__eye = eye;
