// A · New Year Print: Sponsors. Seals print in red, then show true colours on hover, focus or tap.
import { reducedMotion } from '../../shared/base.js';

const sec = document.getElementById('sponsors');
if (sec) {
  const items = [...sec.querySelectorAll('.seals li')];
  const touch = window.matchMedia('(hover: none)').matches;
  const still = reducedMotion();

  items.forEach((li) => {
    li.tabIndex = 0;
    li.addEventListener('click', () => {
      if (touch) li.classList.toggle('is-col');
    });
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        li.classList.toggle('is-col');
      }
    });
  });

  sec.classList.add('sl-on');

  const show = (li, d) => {
    li.style.setProperty('--d', `${d}s`);
    li.classList.add('is-in');
    // on touch the red stamp settles to true colours after a beat
    if (touch) setTimeout(() => li.classList.add('is-col'), (d + 0.42) * 1000 + 700);
  };

  if (still || !('IntersectionObserver' in window)) {
    items.forEach((li) => li.classList.add('is-in', 'is-col'));
  } else {
    let batch = 0;
    let timer = 0;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          show(e.target, batch * 0.25);
          batch += 1;
          io.unobserve(e.target);
        });
        clearTimeout(timer);
        timer = setTimeout(() => (batch = 0), 400);
      },
      { threshold: 0.2 },
    );
    items.forEach((li) => io.observe(li));
  }
}
