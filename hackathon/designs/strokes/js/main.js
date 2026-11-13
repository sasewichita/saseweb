import { reducedMotion, qualityTier, cappedDpr, cursorGuard, frameLoop, usePoster } from '../../shared/base.js';
import { createGlyph } from './glyph.js';

const canvas = document.getElementById('glyph');
const tier = qualityTier();
const still = reducedMotion();

async function start() {
  if (tier === 0) return usePoster(canvas);
  const glyph = await createGlyph(canvas, { dpr: cappedDpr(tier), onLost: () => usePoster(canvas) });
  if (!glyph) return usePoster(canvas);
  window.__glyph = glyph;
  glyph.state.still = still;
  cursorGuard();

  const plates = [...document.querySelectorAll('.plate')];

  function place() {
    const tall = window.innerWidth < 760 || window.innerWidth < window.innerHeight * 0.9;
    if (tall) {
      // phone: the slab fills the top of the screen and ends above the words
      glyph.state.center = [0, 0.5 * (window.innerHeight / window.innerWidth) - 0.56];
      glyph.state.scale = 0.94;
      glyph.state.bounds = [-9, 9, -0.52, 9];
      glyph.state.flameSize = 1.25;
    } else {
      // desktop: the slab bleeds off the right, top and bottom; the words sit in the dark on the left
      const halfW = (0.5 * window.innerWidth) / window.innerHeight;
      glyph.state.scale = 0.84;
      glyph.state.center = [halfW - 0.50, 0];
      glyph.state.bounds = [-0.62, 9, -9, 9];
      glyph.state.flameSize = 1;
    }
    glyph.resize();
  }

  // which era: each plate holds its material while it is centred, and melts into the next between
  function eraAt() {
    const mid = window.scrollY + window.innerHeight / 2;
    for (let i = 0; i < plates.length; i++) {
      const top = plates[i].offsetTop;
      const bottom = top + plates[i].offsetHeight;
      if (mid < bottom || i === plates.length - 1) {
        const f = Math.min(1, Math.max(0, (mid - top) / (bottom - top)));
        const melt = Math.min(1, Math.max(0, (f - 0.72) / 0.28)); // the last quarter of a plate is the melt
        return Math.min(plates.length - 1, i + (i < plates.length - 1 ? melt : 0));
      }
    }
    return 0;
  }

  // the neon stutters when it first comes on
  let neonSince = -1;
  function neonAt(t, era) {
    if (era < 3.4 || era > 4.6) {
      neonSince = -1;
      return 0.0;
    }
    if (neonSince < 0) neonSince = t;
    const age = t - neonSince;
    if (still) return 1;
    if (age < 1.1) return Math.sin(age * 61) * Math.sin(age * 23) > 0.1 ? 1 : 0.08;
    return 0.94 + 0.06 * Math.sin(t * 47);
  }

  place();
  window.addEventListener('resize', place);
  const steer = (e) => glyph.setLight(e.clientX, e.clientY);
  window.addEventListener('pointermove', steer, { passive: true });
  window.addEventListener('pointerdown', steer, { passive: true });

  const draw = (t, dt) => {
    const era = eraAt();
    glyph.state.era = era;
    glyph.state.neon = neonAt(t, era);
    glyph.render(t, dt);
  };
  if (still) {
    draw(0, 0.016);
    window.addEventListener('scroll', () => draw(0, 0.016), { passive: true });
    window.addEventListener('resize', () => draw(0, 0.016));
  } else {
    frameLoop(canvas, draw);
  }
}

start();
