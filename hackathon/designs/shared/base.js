// Shared helpers for the three Hack the Wu designs. No dependencies.

const mq = (q) => (typeof matchMedia === 'function' ? matchMedia(q) : { matches: false, addEventListener() {} });

/** True when the visitor asked for less motion. Each design shows a composed still then. */
export const reducedMotion = () => mq('(prefers-reduced-motion: reduce)').matches;

/** True for a mouse or trackpad. Custom cursors are only allowed when this is true. */
export const finePointer = () => mq('(hover: hover) and (pointer: fine)').matches;

/** Phone-sized or touch-first device. */
export const isPhone = () => mq('(max-width: 760px)').matches || mq('(pointer: coarse)').matches;

/**
 * Rough quality tier: 0 = show the poster, 1 = phone or weak laptop, 2 = desktop.
 * Add ?q=0, ?q=1 or ?q=2 to the URL to force one while testing.
 */
export function qualityTier() {
  const forced = new URLSearchParams(location.search).get('q');
  if (forced !== null && /^[012]$/.test(forced)) return Number(forced);
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (cores <= 2 || mem <= 1) return 0;
  if (isPhone() || cores <= 4 || mem <= 4) return 1;
  return 2;
}

/** Device pixel ratio capped so phones do not melt: 2 on desktop, 1.5 on phones. */
export const cappedDpr = (tier = qualityTier()) => Math.min(window.devicePixelRatio || 1, tier >= 2 ? 2 : 1.5);

/**
 * Turn on a design's custom cursor only for a real pointer, and turn it off again the moment
 * a finger touches the screen. The design's CSS hides the system cursor under html.has-cursor.
 */
export function cursorGuard() {
  const root = document.documentElement;
  const set = (on) => root.classList.toggle('has-cursor', on);
  set(finePointer() && !reducedMotion());
  window.addEventListener('touchstart', () => set(false), { passive: true });
  window.addEventListener('mousemove', () => set(finePointer() && !reducedMotion()), { passive: true });
  return () => root.classList.contains('has-cursor');
}

/**
 * Live countdown. Calls onTick({days, hours, minutes, seconds, done}) now and every second.
 * Returns a function that stops it.
 */
export function countdown(targetIso, onTick) {
  const target = new Date(targetIso).getTime();
  const tick = () => {
    const ms = Math.max(0, target - Date.now());
    const s = Math.floor(ms / 1000);
    onTick({
      days: Math.floor(s / 86400),
      hours: Math.floor((s % 86400) / 3600),
      minutes: Math.floor((s % 3600) / 60),
      seconds: s % 60,
      done: ms === 0,
    });
  };
  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}

/** Fill every [data-countdown] block that has [data-unit="days|hours|minutes|seconds"] children. */
export function mountCountdowns(targetIso) {
  const blocks = [...document.querySelectorAll('[data-countdown]')];
  if (!blocks.length) return () => {};
  const pad = (n) => String(n).padStart(2, '0');
  return countdown(targetIso, (t) => {
    for (const b of blocks) {
      for (const unit of ['days', 'hours', 'minutes', 'seconds']) {
        const el = b.querySelector(`[data-unit="${unit}"]`);
        if (el) el.textContent = unit === 'days' ? String(t.days) : pad(t[unit]);
      }
      b.classList.toggle('is-done', t.done);
    }
  });
}

/**
 * A render loop that stops when the tab is hidden or the canvas is off screen.
 * fn(timeSeconds, deltaSeconds). Returns { stop, start }.
 */
export function frameLoop(canvas, fn) {
  let raf = 0;
  let last = 0;
  let onScreen = true;
  let wanted = true;
  const frame = (ms) => {
    raf = 0;
    const t = ms / 1000;
    const dt = last ? Math.min(0.05, t - last) : 0.016;
    last = t;
    fn(t, dt);
    schedule();
  };
  const schedule = () => {
    if (!raf && wanted && onScreen && !document.hidden) raf = requestAnimationFrame(frame);
  };
  const halt = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  };
  document.addEventListener('visibilitychange', () => (document.hidden ? halt() : schedule()));
  if (canvas && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      onScreen ? schedule() : halt();
    }).observe(canvas);
  }
  schedule();
  return {
    stop() {
      wanted = false;
      halt();
    },
    start() {
      wanted = true;
      schedule();
    },
  };
}

/**
 * Show the poster instead of the canvas. Used when WebGL is missing, the context is lost,
 * or the quality tier is 0. The poster is a plain <img class="poster"> placed next to the canvas.
 */
export function usePoster(canvas) {
  document.documentElement.classList.add('no-webgl');
  if (canvas) canvas.hidden = true;
}

/** Pointer position that also follows a finger. Coordinates are 0..1 of the viewport. */
export function trackPointer() {
  const p = { x: 0.5, y: 0.5, down: false, seen: false, touch: false };
  const set = (e, touch) => {
    p.x = e.clientX / window.innerWidth;
    p.y = e.clientY / window.innerHeight;
    p.seen = true;
    p.touch = touch;
  };
  window.addEventListener('pointermove', (e) => set(e, e.pointerType === 'touch'), { passive: true });
  window.addEventListener(
    'pointerdown',
    (e) => {
      set(e, e.pointerType === 'touch');
      p.down = true;
    },
    { passive: true },
  );
  const up = () => (p.down = false);
  window.addEventListener('pointerup', up, { passive: true });
  window.addEventListener('pointercancel', up, { passive: true });
  return p;
}
