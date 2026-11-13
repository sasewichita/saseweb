// A · New Year Print: details section. Carved month, struck days, clock with re-struck digits.
import { reducedMotion, countdown } from '../../shared/base.js';

const sec = document.getElementById('details');
if (sec) {
  const calm = reducedMotion();

  // head: group the h2 and lede so the grid can place them on top
  const h2 = sec.querySelector('h2');
  const lede = sec.querySelector(':scope > .lede');
  if (h2 && lede) {
    const head = document.createElement('div');
    head.className = 'details-head';
    sec.insertBefore(head, h2);
    head.append(h2, lede);
  }

  // month: wrap the table in one ink block so the caption is carved into it too
  const table = sec.querySelector('table.month');
  if (table) {
    const block = document.createElement('div');
    block.className = 'month-block';
    table.before(block);
    block.append(table);
    if (!calm && 'IntersectionObserver' in window) {
      block.classList.add('armed');
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            block.classList.add('is-in');
            io.disconnect();
          }
        },
        { threshold: 0.45 },
      );
      io.observe(block);
    }
  }

  // clock: a real-text dd for screen readers, an aria-hidden layer of single digits for the eye
  const clock = sec.querySelector('.clock');
  const time = sec.querySelector('.count-when time');
  if (clock && time) {
    const layers = {};
    for (const unit of ['days', 'hours', 'minutes', 'seconds']) {
      const dd = clock.querySelector(`[data-unit="${unit}"]`);
      if (!dd) continue;
      const layer = document.createElement('span');
      layer.className = 'digits';
      layer.setAttribute('aria-hidden', 'true');
      dd.after(layer);
      layers[unit] = { dd, layer, prev: '' };
    }
    clock.classList.add('has-digits');

    const strike = (el) => {
      el.classList.remove('hit');
      void el.offsetWidth; // restart the animation
      el.classList.add('hit');
    };
    const show = (unit, value) => {
      const u = layers[unit];
      if (!u) return;
      const text = String(value).padStart(2, '0');
      if (text === u.prev) return;
      u.dd.textContent = text;
      if (text.length !== u.prev.length) {
        u.layer.textContent = '';
        for (const ch of text) {
          const s = document.createElement('span');
          s.className = 'd';
          s.dataset.d = ch;
          s.textContent = ch;
          u.layer.append(s);
        }
      } else {
        [...u.layer.children].forEach((s, i) => {
          if (s.textContent === text[i]) return;
          s.textContent = text[i];
          s.dataset.d = text[i];
          if (!calm && u.prev) strike(s);
        });
      }
      u.prev = text;
    };

    let stop = null;
    const run = () => {
      if (stop) return;
      stop = countdown(time.getAttribute('datetime'), (t) => {
        show('days', t.days);
        show('hours', t.hours);
        show('minutes', t.minutes);
        show('seconds', t.seconds);
      });
    };
    const halt = () => {
      if (stop) stop();
      stop = null;
    };
    // run only while the clock is on screen
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => (e.isIntersecting ? run() : halt()), { rootMargin: '120px' }).observe(clock);
      run(); // fill at once so the first view is never empty
    } else run();
  }
}
