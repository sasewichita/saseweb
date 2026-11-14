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

// how far the pupil has opened: the first screen of scroll opens it all the way
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
}

if (eye) {
  place();
  window.addEventListener('resize', place);
  window.addEventListener('pointermove', (e) => eye.lookAt(e.clientX, e.clientY), { passive: true });
  window.addEventListener('pointerdown', (e) => eye.lookAt(e.clientX, e.clientY), { passive: true });
  eye.state.still = still;

  if (still) {
    // one composed frame per scroll position, nothing moves by itself
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
    });
  }
}

// for the capture tool and for QA
window.__eye = eye;
