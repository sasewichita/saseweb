// Last year: as each print reaches the middle of the screen, the goat ducks away and pops up
// at that mat's top edge, in the gap above it. Poses and sides are listed by photo number.
import { still, wait, pose, play, onScroll } from './kit.js';

const goat = document.getElementById('lastyear-goat');
const wrap = document.querySelector('#last-year .mosaic-wrap');
const prints = wrap ? [...wrap.querySelectorAll('.mosaic > li')] : [];
// [pose, side of the mat, face left]. Desktop: each photo its own spot, no two neighbours alike.
const SPOT_D = [
  ['peek', 'right', false], ['sit', 'left', true], ['look-back', 'right', false],
  ['peek', 'left', true], ['sit', 'right', false], ['look-back', 'left', true], ['peek', 'right', false],
];
// Phone: one column, six distinct poses.
const SPOT_M = [
  ['peek', 'right', false], ['ears-up', 'right', false], ['wag', 'left', true],
  ['look-back', 'right', false], ['nudge', 'left', true], ['talk', 'right', false], ['wag', 'left', true],
];
const phoneMq = matchMedia('(max-width: 760px)');
const spots = () => (phoneMq.matches ? SPOT_M : SPOT_D);
let cur = 0;
let token = 0;

function spot(i) {
  const mat = prints[i].querySelector('.mat');
  const m = mat.getBoundingClientRect();
  const w = wrap.getBoundingClientRect();
  const g = goat.getBoundingClientRect();
  const left = spots()[i][1] === 'left';
  const x = (left ? m.left : m.right - g.width) - w.left + (left ? 14 : -14);
  const y = m.top - w.top - g.height + 2;
  return { x: Math.round(x), y: Math.round(y) };
}
function put(i) {
  const s = spot(i);
  goat.style.setProperty('--lx', s.x + 'px');
  goat.style.setProperty('--ly', s.y + 'px');
  goat.classList.toggle('flip', spots()[i][2]);
}

async function go(i) {
  const me = ++token;
  cur = i;
  if (still) { put(i); pose(goat, spots()[i][0]); return; }
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
  pose(goat, spots()[i][0]);
}

if (goat && prints.length) {
  put(0);
  pose(goat, spots()[0][0]);
  addEventListener('resize', () => put(cur));
  addEventListener('load', () => put(cur));
  if (!still) {
    // the print whose middle is nearest the middle of the screen gets the goat
    onScroll((H) => {
      let best = -1, bd = Infinity;
      prints.forEach((p, i) => {
        const r = p.querySelector('.mat').getBoundingClientRect();
        const d = Math.abs((r.top + r.bottom) / 2 - H / 2);
        if (d < bd) { bd = d; best = i; }
      });
      if (best >= 0 && best !== cur) go(best);
    });
  }
}
