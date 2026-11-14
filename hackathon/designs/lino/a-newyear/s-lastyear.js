// A · New Year Print: Last year. Each photo becomes a carved line print; a pupil-shaped lens shows the real photo.
import { reducedMotion } from '../../shared/base.js';

const sec = document.getElementById('last-year');
if (sec) {
  const make = (tag, cls) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (tag !== 'button') el.setAttribute('aria-hidden', 'true');
    return el;
  };

  const items = [...sec.querySelectorAll('.prints li')];
  items.forEach((li) => {
    const fig = li.querySelector('figure.print');
    const img = fig && fig.querySelector('img');
    const cap = fig && fig.querySelector('figcaption');
    if (!img) return;

    const plate = document.createElement('div');
    plate.className = 'plate';
    plate.dataset.cursor = 'none';
    const stack = document.createElement('div');
    stack.className = 'stack';
    const carve = make('div', 'carve');
    carve.removeAttribute('aria-hidden'); // the real image inside keeps its alt text

    fig.insertBefore(plate, img);
    carve.append(img, make('i', 'ln'));
    const real = img.cloneNode(false);
    real.className = 'real';
    real.alt = '';
    real.setAttribute('aria-hidden', 'true');
    real.removeAttribute('width');
    real.removeAttribute('height');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'flip';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', `Show the photo: ${cap ? cap.textContent.trim() : img.alt}`);
    btn.addEventListener('click', () => {
      const on = fig.classList.toggle('is-real');
      btn.setAttribute('aria-pressed', String(on));
      stack.classList.remove('is-lens');
    });

    stack.append(carve, make('i', 'tb'), make('i', 'ti'), real, make('i', 'key'), btn);
    plate.append(stack);

    // the lens follows a mouse over the print (offsetX is in the print's own tilted space)
    stack.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || fig.classList.contains('is-real') || e.target !== stack) return;
      const w = Math.min(240, stack.clientWidth * 0.7);
      stack.style.setProperty('--lw', `${w}px`);
      stack.style.setProperty('--lh', `${Math.round(w * 0.29)}px`);
      stack.style.setProperty('--lx', `${e.offsetX}px`);
      stack.style.setProperty('--ly', `${e.offsetY}px`);
      stack.classList.add('is-lens');
    });
    stack.addEventListener('pointerleave', () => stack.classList.remove('is-lens'));
  });

  sec.classList.add('ly-on');

  // pull the prints in as they enter: carved is the default, the script only adds a short "uncut" wait
  const show = (li, d) => {
    li.style.setProperty('--d', `${d}s`);
    li.classList.remove('ly-wait');
    li.classList.add('is-in');
  };
  if (!reducedMotion() && 'IntersectionObserver' in window) {
    let batch = 0;
    let timer = 0;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          show(e.target, batch * 0.08);
          batch += 1;
          io.unobserve(e.target);
        });
        clearTimeout(timer);
        timer = setTimeout(() => (batch = 0), 300);
      },
      // fire as the print's top edge is still 12% below the fold: carved well before a quarter is in view
      { threshold: 0, rootMargin: '0px 0px 12% 0px' },
    );
    items.forEach((li) => {
      const r = li.getBoundingClientRect();
      if (r.top < window.innerHeight * 1.12 && r.bottom > 0) return; // already near view: stay carved
      li.classList.add('ly-wait');
      io.observe(li);
    });
  }
}
