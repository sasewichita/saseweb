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
    const n = 15 + Math.floor(r() * 3);
    const p = (ang, rad) => `${(Math.cos(ang) * rad).toFixed(1)},${(Math.sin(ang) * rad).toFixed(1)}`;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + (r() - 0.5) * 0.14;
      const long = k % 3 !== 1;
      const len = long ? 74 + r() * 26 : 40 + r() * 24;
      const w = 0.11 + r() * 0.1;
      const r0 = 6 + r() * 5;
      const poly = document.createElementNS(NS, 'polygon');
      poly.setAttribute('points', `${p(a - w, r0)} ${p(a - w * 0.3, len)} ${p(a + w * 0.5, len - 4)} ${p(a + w, r0)}`);
      poly.setAttribute('fill', k % 3 === 1 || k % 7 === 3 ? '#f0b90a' : '#121110');
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
      const half = burst.getBoundingClientRect().width ? parseFloat(getComputedStyle(burst).width) / 2 : 70;
      const narrow = innerWidth <= 900;
      // desktop: beside the question's right end; phone: tucked at its top right corner
      const cx = narrow ? Math.min(br.right - half * 0.35, innerWidth - half - 4) : br.right + half * 0.55;
      burst.style.left = cx - cr.left + 'px';
      burst.style.top = (narrow ? br.top - half * 0.1 : br.top + br.height / 2) - cr.top + 'px';
    };
    const showAnswer = () => {
      if (burst) {
        place();
        burst.classList.add(still ? 'rest' : 'pop');
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
