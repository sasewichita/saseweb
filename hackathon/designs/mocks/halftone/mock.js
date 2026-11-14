import { reducedMotion, qualityTier, cappedDpr, cursorGuard, frameLoop, usePoster, isPhone } from '../../shared/base.js';
import { createEye } from './eye.js';

const root = document.documentElement;
const canvas = document.getElementById('eye');
const tier = qualityTier();
const still = reducedMotion();

const eye = tier === 0 ? null : createEye(canvas, { dpr: cappedDpr(tier), onLost: () => usePoster(canvas) });
if (!eye) usePoster(canvas);

cursorGuard();

// ring cursor
const ring = document.querySelector('.ring');
if (!still) {
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      ring.classList.add('is-on');
      ring.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      ring.classList.toggle('is-big', !!e.target.closest('a, button, .point'));
    },
    { passive: true }
  );
  document.addEventListener('pointerleave', () => ring.classList.remove('is-on'));
}

const openAt = () => Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.9)));

function place() {
  if (!eye) return;
  const phone = isPhone() && window.innerWidth < window.innerHeight;
  eye.state.scale = phone ? 1.32 : 1;
  eye.state.center = phone ? [0, 0.16] : [0, 0.02];
  eye.state.margin = phone ? 9 : 16;
  eye.state.cornerRadius = phone ? 18 : 26;
  eye.state.period = window.innerWidth < 760 ? 7 : 9;
  eye.state.lensRadius = 170;
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

  // loupe target: the pointer or touch, else a slow drift
  let ptr = null;
  let lastMove = -99;
  const setPtr = (e) => {
    ptr = [e.clientX, e.clientY];
    lastMove = performance.now() / 1000;
    eye.lookAt(e.clientX, e.clientY);
  };
  window.addEventListener('pointermove', setPtr, { passive: true });
  window.addEventListener('pointerdown', setPtr, { passive: true });
  const lens = eye.state.lens;
  let lx = window.innerWidth * 0.5;
  let ly = window.innerHeight * 0.5;
  let k = 0;

  const updateLens = (t) => {
    const idle = t - lastMove > 2.5 || !ptr;
    let tx, ty;
    if (idle) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      tx = w * (0.5 + 0.22 * Math.sin(t * 0.31));
      ty = h * (0.5 + 0.16 * Math.sin(t * 0.23 + 1.3));
    } else {
      tx = ptr[0];
      ty = ptr[1];
    }
    const a = idle ? 0.03 : 0.22;
    lx += (tx - lx) * a;
    ly += (ty - ly) * a;
    // the lens fades out as the page opens up
    const target = 1 - Math.min(1, eye.state.open * 1.5);
    k += (target - k) * 0.12;
    lens[0] = lx;
    lens[1] = ly;
    lens[2] = k;
  };

  eye.state.still = still;
  if (still) {
    // one composed frame per scroll position
    lx = window.innerWidth * 0.5;
    ly = window.innerHeight * 0.5;
    const draw = () => {
      eye.state.open = openAt();
      lens[0] = lx;
      lens[1] = ly;
      lens[2] = 1 - Math.min(1, eye.state.open * 1.5);
      eye.render(0, 0.016);
      writePupil();
    };
    draw();
    window.addEventListener('scroll', draw, { passive: true });
    window.addEventListener('resize', draw);
  } else {
    frameLoop(canvas, (t, dt) => {
      eye.state.open = openAt();
      updateLens(t);
      eye.render(t, dt);
      writePupil();
    });
  }
}

// nav: mark the current dot
const links = [...document.querySelectorAll('.dots a')];
links.forEach((a) =>
  a.addEventListener('click', () => {
    links.forEach((b) => {
      b.classList.toggle('is-current', b === a);
      b.toggleAttribute('aria-current', b === a);
    });
  })
);

window.__eye = eye;
