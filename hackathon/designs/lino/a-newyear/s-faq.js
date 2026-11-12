// A · New Year Print: faq. A fuse line, four branches, a spark and a printed burst per question.
import { reducedMotion } from '../../shared/base.js';

const root = document.querySelector('#faq');
const list = root && root.querySelector('.crackers');
if (list) init();

function init() {
  const still = reducedMotion();
  const NS = 'http://www.w3.org/2000/svg';

  const line = document.createElement('span');
  line.className = 'fuse-line';
  line.setAttribute('aria-hidden', 'true');
  list.prepend(line);

  // small seeded random so each burst keeps its own shape
  const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647), (seed - 1) / 2147483646);

  function makeBurst(i) {
    const r = rng(97 + i * 31);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'burst');
    svg.setAttribute('viewBox', '-100 -100 200 200');
    svg.setAttribute('aria-hidden', 'true');
    const n = 18 + Math.floor(r() * 10);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + (r() - 0.5) * 0.18;
      const len = 40 + r() * 52;
      const w = 0.06 + r() * 0.07;
      const r0 = 12 + r() * 6;
      const p = (ang, rad) => `${(Math.cos(ang) * rad).toFixed(1)},${(Math.sin(ang) * rad).toFixed(1)}`;
      const poly = document.createElementNS(NS, 'polygon');
      poly.setAttribute('points', `${p(a - w, r0)} ${p(a, len)} ${p(a + w, r0)}`);
      poly.setAttribute('fill', k % 7 === 3 ? '#f0b90a' : '#121110');
      svg.appendChild(poly);
    }
    return svg;
  }

  [...list.querySelectorAll('.cracker')].forEach((c, i) => {
    const btn = c.querySelector('button');
    const ans = c.querySelector('.answer');
    if (!btn || !ans) return;

    const branch = document.createElement('span');
    branch.className = 'branch';
    branch.setAttribute('aria-hidden', 'true');
    const spark = document.createElement('i');
    spark.className = 'spark';
    branch.appendChild(spark);
    c.prepend(branch);

    btn.setAttribute('aria-expanded', 'false');
    ans.hidden = true;

    let burst = null;
    let timer = 0;

    const place = () => {
      if (!burst) return;
      const cr = c.getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      burst.style.left = br.right - cr.left - 10 + 'px';
      burst.style.top = br.top - cr.top + br.height / 2 + 'px';
    };
    const showAnswer = () => {
      if (burst) {
        place();
        if (!still) burst.classList.add('pop');
      }
      ans.hidden = false;
    };
    const close = () => {
      clearTimeout(timer);
      branch.classList.remove('run');
      if (burst) burst.remove();
      burst = null;
      ans.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    };
    const open = () => {
      btn.setAttribute('aria-expanded', 'true');
      burst = makeBurst(i);
      c.appendChild(burst);
      place();
      if (still) {
        showAnswer();
        return;
      }
      burst.style.visibility = 'hidden';
      branch.classList.remove('run');
      void branch.offsetWidth;
      branch.classList.add('run');
      timer = setTimeout(() => {
        branch.classList.remove('run');
        if (burst) burst.style.visibility = '';
        showAnswer();
      }, 200);
    };

    btn.addEventListener('click', () => {
      if (btn.getAttribute('aria-expanded') === 'true') close();
      else open();
    });
    addEventListener('resize', place, { passive: true });
  });
}
