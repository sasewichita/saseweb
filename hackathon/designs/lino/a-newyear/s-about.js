// A · New Year Print: about. Gold blocks strike the numerals in turn as they enter.
import { reducedMotion } from '../../shared/base.js';

const sec = document.getElementById('about');
if (sec && !reducedMotion() && 'IntersectionObserver' in window) {
  const items = [...sec.querySelectorAll('.points li')];
  sec.classList.add('is-armed');
  let n = 0;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        // one strike after another
        setTimeout(() => e.target.classList.add('is-struck'), n++ * 260);
      });
    },
    { threshold: 0.45 },
  );
  items.forEach((li) => io.observe(li));
}
