// Weekend: the goat stands on the ledge that has reached the middle of the screen and hops
// to the next one as you scroll. Three hard frames per hop. Two small hops in place on the last.
import { still, wait, pose, play, frames, onScroll } from './kit.js';

const goat = document.getElementById('weekend-goat');
const stairs = document.querySelector('#weekend .stairs');
const ledges = stairs ? [...stairs.querySelectorAll('.ledge')] : [];
let cur = -1;
let token = 0;

function anchor(i) {
  const l = ledges[i];
  const w = goat.getBoundingClientRect().width;
  const x = l.offsetLeft + l.offsetWidth - w - (matchMedia('(max-width: 760px)').matches ? 18 : 40);
  const h = goat.getBoundingClientRect().height;
  const y = l.offsetTop - h + 2;
  return { x: Math.round(x), y: Math.round(y) };
}
function put(i) {
  const a = anchor(i);
  goat.style.setProperty('--wx', a.x + 'px');
  goat.style.setProperty('--wy', a.y + 'px');
  return a;
}

async function hopTo(i) {
  const me = ++token;
  const from = cur;
  cur = i;
  if (from < 0 || still) {
    put(i);
    pose(goat, 'stand');
    return;
  }
  const before = anchor(from).x;
  const after = anchor(i).x;
  goat.classList.toggle('flip', after < before);
  await play(goat, ['crouch'], 0);
  await wait(130);
  if (me !== token) return;
  pose(goat, 'air');
  put(i);
  await wait(150);
  if (me !== token) return;
  pose(goat, 'stand');
  frames(ledges[i], 'sink');
  if (i === ledges.length - 1) {
    for (let k = 0; k < 2; k++) {
      await wait(200);
      if (me !== token) return;
      pose(goat, 'air');
      await wait(130);
      if (me !== token) return;
      pose(goat, 'stand');
      frames(ledges[i], 'sink');
    }
  }
}

function pick(H) {
  let idx = 0;
  ledges.forEach((l, i) => { if (l.getBoundingClientRect().top <= 0.55 * H) idx = i; });
  if (idx !== cur) hopTo(idx);
}

if (goat && ledges.length) {
  if (still) {
    cur = ledges.length - 1;
    put(cur);
    pose(goat, 'stand');
    addEventListener('resize', () => put(cur));
  } else {
    put(0);
    cur = 0;
    pose(goat, 'stand');
    addEventListener('resize', () => put(cur));
    onScroll(pick);
  }
}
