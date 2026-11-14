import { reducedMotion, qualityTier, cappedDpr, cursorGuard, frameLoop, usePoster, isPhone } from '../../shared/base.js';
import { createHerd } from './herd.js';
import { sampleInk, drawWords, drawRing } from './formations.js';

const canvas = document.getElementById('field');
const bell = document.querySelector('.bell');
const tier = qualityTier();
const still = reducedMotion();
const phone = isPhone();

const FONT = '"Bowlby One"';
const TRAVEL = 50; // world units of field per screen of scroll

async function start() {
  if (tier === 0) return usePoster(canvas);
  let herd = null;
  try {
    herd = await createHerd(canvas, {
      count: phone ? 210 : tier === 2 ? 520 : 300,
      dpr: cappedDpr(tier),
      onLost: () => usePoster(canvas),
    });
  } catch (err) {
    console.error(err);
  }
  if (!herd) return usePoster(canvas);
  window.__herd = herd;
  try {
    await document.fonts.load(`400 120px ${FONT}`);
  } catch {}

  const aspect = () => window.innerWidth / window.innerHeight;
  const places = herd.count - 14; // a few goats are left to graze at the edges

  // the stops along the field: each has a view height, a place north, and a drawing
  const stops = [
    {
      height: 60,
      draw: () =>
        aspect() > 1.15
          ? drawWords(['HACK', 'THE WU'], { font: FONT, box: [0.05, 0.1, 0.9, 0.72], lineHeight: 0.98 })
          : drawWords(['HACK', 'THE', 'WU'], { font: FONT, box: [0.07, 0.16, 0.86, 0.6], lineHeight: 0.98 }),
    },
    {
      height: 40,
      draw: () => drawRing({ cx: aspect() > 1.15 ? 0.68 : 0.5, cy: aspect() > 1.15 ? 0.5 : 0.68, r: 0.2, thickness: 0.085, squash: 1.25 }),
    },
  ];
  let current = -1;
  function goTo(i) {
    if (i === current) return;
    current = i;
    const s = stops[i];
    const { points, spacing } = sampleInk({ aspect: aspect(), count: places, draw: s.draw(), jitter: 0.1 });
    herd.setFormation(points, { north: i * TRAVEL, height: s.height, spacing, aspect: aspect() });
  }

  function follow() {
    const y = window.scrollY / window.innerHeight;
    const i = Math.min(stops.length - 1, Math.max(0, Math.round(y)));
    // the view height eases between the two stops you are between
    const a = Math.min(stops.length - 1, Math.floor(y));
    const b = Math.min(stops.length - 1, a + 1);
    const f = Math.min(1, Math.max(0, y - a));
    herd.setView({ north: y * TRAVEL, height: stops[a].height + (stops[b].height - stops[a].height) * f });
    goTo(i);
  }

  herd.resize();
  follow();
  window.addEventListener('scroll', follow, { passive: true });
  window.addEventListener('resize', () => {
    herd.resize();
    current = -1;
    follow();
  });

  // pointer: the lead goat, with its bell
  const guard = cursorGuard();
  let downAt = 0;
  let downXY = [0, 0];
  window.addEventListener(
    'pointermove',
    (e) => {
      herd.pointer(e.clientX, e.clientY, e.buttons > 0 || (e.pointerType === 'touch' && e.pressure > 0));
      if (e.pointerType !== 'touch' && guard()) {
        bell.classList.add('is-on');
        bell.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
        bell.classList.toggle('is-link', !!(e.target instanceof Element && e.target.closest('a, button, summary')));
      }
    },
    { passive: true },
  );
  window.addEventListener(
    'pointerdown',
    (e) => {
      downAt = performance.now();
      downXY = [e.clientX, e.clientY];
      herd.pointer(e.clientX, e.clientY, true);
      bell.classList.add('is-down');
    },
    { passive: true },
  );
  const lift = (e) => {
    bell.classList.remove('is-down');
    herd.pointer(e.clientX, e.clientY, false);
    herd.pointerGone();
    const quick = performance.now() - downAt < 260;
    const stayed = Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]) < 12;
    const onControl = e.target instanceof Element && e.target.closest('a, button, summary, input');
    if (quick && stayed && !onControl) herd.whistle(e.clientX, e.clientY);
  };
  window.addEventListener('pointerup', lift, { passive: true });
  window.addEventListener('pointercancel', () => herd.pointerGone(), { passive: true });

  if (still) {
    // a composed still: every goat already in place, redrawn only when you scroll
    const draw = () => {
      follow();
      herd.settle();
      herd.setView({ immediate: true });
      herd.render(0, 0.016, { simulate: true });
      herd.settle();
      herd.render(0, 0.016, { simulate: false });
    };
    draw();
    window.addEventListener('scroll', draw, { passive: true });
  } else {
    frameLoop(canvas, (t, dt) => herd.render(t, dt));
  }
}

start();
