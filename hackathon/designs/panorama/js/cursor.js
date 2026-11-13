// PANORAMA: the bar cursor.
// A horizontal bar, like a goat's pupil and like a text caret. It blinks when it rests and
// snaps under links and buttons as an underline. Only runs for a real pointer (html.has-cursor).

const SNAP = 'a[href], button, summary, [role="button"], input, select, textarea, label[for]';

export function barCursor() {
  const bar = document.createElement('div');
  bar.className = 'bar-cursor';
  bar.setAttribute('aria-hidden', 'true');
  document.body.append(bar);

  const REST = { w: 30, h: 5 };
  const cur = { x: -100, y: -100, w: REST.w, h: REST.h };
  const to = { x: -100, y: -100, w: REST.w, h: REST.h };
  let pointer = { x: -100, y: -100 };
  let snapped = null;
  let idleTimer = 0;
  let raf = 0;
  let shown = false;

  const active = () => document.documentElement.classList.contains('has-cursor');

  function aim() {
    if (snapped && snapped.isConnected) {
      const r = snapped.getBoundingClientRect();
      // sit under the element, like an underline
      to.w = Math.max(18, r.width);
      to.h = 4;
      to.x = r.left;
      to.y = r.bottom + 3;
    } else {
      snapped = null;
      to.w = REST.w;
      to.h = REST.h;
      to.x = pointer.x - REST.w / 2;
      to.y = pointer.y - REST.h / 2;
    }
  }

  function frame() {
    raf = 0;
    aim();
    const k = snapped ? 0.3 : 0.5;
    cur.x += (to.x - cur.x) * k;
    cur.y += (to.y - cur.y) * k;
    cur.w += (to.w - cur.w) * 0.3;
    cur.h += (to.h - cur.h) * 0.3;
    bar.style.transform = `translate3d(${cur.x.toFixed(1)}px, ${cur.y.toFixed(1)}px, 0)`;
    bar.style.width = cur.w.toFixed(1) + 'px';
    bar.style.height = cur.h.toFixed(1) + 'px';
    const settled =
      Math.abs(to.x - cur.x) + Math.abs(to.y - cur.y) + Math.abs(to.w - cur.w) + Math.abs(to.h - cur.h) < 0.4;
    if (!settled) raf = requestAnimationFrame(frame);
  }
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  function wake() {
    bar.classList.remove('is-idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => bar.classList.add('is-idle'), 900);
  }

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch' || !active()) {
        bar.classList.remove('is-on');
        shown = false;
        return;
      }
      pointer = { x: e.clientX, y: e.clientY };
      if (!shown) {
        // first sighting: appear in place, do not fly in from a corner
        cur.x = pointer.x - REST.w / 2;
        cur.y = pointer.y - REST.h / 2;
        shown = true;
        bar.classList.add('is-on');
      }
      const hit = e.target instanceof Element ? e.target.closest(SNAP) : null;
      snapped = hit;
      bar.classList.toggle('is-snapped', !!hit);
      wake();
      kick();
    },
    { passive: true },
  );
  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('pointerdown', () => bar.classList.add('is-down'), { passive: true });
  window.addEventListener('pointerup', () => bar.classList.remove('is-down'), { passive: true });
  document.addEventListener('pointerleave', () => {
    bar.classList.remove('is-on');
    shown = false;
  });
  return bar;
}
