// Last year: as each print reaches the middle of the screen, the goat ducks away and pops up
// at that mat's top edge, in the gap above it. Poses and sides are listed by photo number.
import { still, wait, pose, play } from './kit.js';

const goat = document.getElementById('lastyear-goat');
const wrap = document.querySelector('#last-year .mosaic-wrap');
const prints = wrap ? [...wrap.querySelectorAll('.mosaic > li')] : [];
// [pose, side of the mat, face left]
const SPOT = [
  ['peek', 'right', false], ['ears-up', 'right', false], ['wag', 'left', true],
  ['look-back', 'right', false], ['nudge', 'left', true], ['talk', 'right', false], ['wag', 'left', true],
];
let cur = 0;
let token = 0;

function spot(i) {
  const mat = prints[i].querySelector('.mat');
  const m = mat.getBoundingClientRect();
  const w = wrap.getBoundingClientRect();
  const g = goat.getBoundingClientRect();
  const left = SPOT[i][1] === 'left';
  const x = (left ? m.left : m.right - g.width) - w.left + (left ? 14 : -14);
  const y = m.top - w.top - g.height + 2;
  return { x: Math.round(x), y: Math.round(y) };
}
function put(i) {
  const s = spot(i);
  goat.style.setProperty('--lx', s.x + 'px');
  goat.style.setProperty('--ly', s.y + 'px');
  goat.classList.toggle('flip', SPOT[i][2]);
}

async function go(i) {
  const me = ++token;
  cur = i;
  if (still) { put(i); pose(goat, SPOT[i][0]); return; }
  await play(goat, ['crouch'], 0);
  await wait(120);
  if (me !== token) return;
  goat.classList.add('gone');
  await wait(140);
  if (me !== token) return;
  put(i);
  pose(goat, 'crouch');
  goat.classList.remove('gone');
  await wait(130);
  if (me !== token) return;
  pose(goat, SPOT[i][0]);
}

if (goat && prints.length) {
  put(0);
  pose(goat, SPOT[0][0]);
  addEventListener('resize', () => put(cur));
  addEventListener('load', () => put(cur));
  if (!still && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting) {
          const i = prints.indexOf(e.target);
          if (i >= 0 && i !== cur) go(i);
        }
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    prints.forEach((p) => io.observe(p));
  }
}
