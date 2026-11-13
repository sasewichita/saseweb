// About: the goat hops onto the first card, walks along the three cards and bites each once.
import { still, wait, pose, play, frames, once } from './kit.js';

const goat = document.getElementById('about-goat');
const list = document.querySelector('.about-cards');
const cards = list ? [...list.querySelectorAll('.card')] : [];
const phone = () => matchMedia('(max-width: 760px)').matches;
let gx = 0;       // current x offset of the goat, px
let at = 0;       // card the goat stands over
let busy = false;

// x offset that puts the goat over the right end of card i (where the bite is)
function targetX(i) {
  const g = goat.getBoundingClientRect();
  const c = cards[i].getBoundingClientRect();
  const base = g.left - gx;
  return Math.round(c.right - g.width * 0.62 - base - g.width / 2 + g.width / 2 - 0);
}
function park(i) {
  at = i;
  if (phone()) return;
  gx = targetX(i);
  goat.style.setProperty('--gx', gx + 'px');
}

function crumbs(card) {
  const made = [0, 1, 2].map(() => {
    const s = document.createElement('span');
    s.className = 'crumb';
    s.setAttribute('aria-hidden', 'true');
    card.appendChild(s);
    return s;
  });
  made.forEach((s, k) => setTimeout(() => {
    frames(s, 'fall');
    setTimeout(() => s.remove(), 400);
  }, k * 70));
}

async function bite(i) {
  const card = cards[i];
  await play(goat, ['graze'], 0);
  await wait(260);
  card.classList.add('bite-1');
  crumbs(card);
  await wait(260);
  pose(goat, 'stand');
  await wait(140);
  await play(goat, ['graze'], 0);
  await wait(260);
  card.classList.add('bite-2');
  crumbs(card);
  await wait(200);
  pose(goat, 'stand');
}

async function walkTo(x) {
  const step = 24;
  let k = 0;
  while (gx < x) {
    gx = Math.min(x, gx + step);
    goat.style.setProperty('--gx', gx + 'px');
    pose(goat, k++ % 2 ? 'walk-b' : 'walk-a');
    await wait(110);
  }
  pose(goat, 'stand');
}

async function run() {
  if (busy) return;
  busy = true;
  for (let i = 0; i < cards.length; i++) {
    if (i === 0) {
      park(0);
      await play(goat, ['crouch', 'air', 'stand'], 130);
      await wait(150);
    } else {
      await walkTo(targetX(i));
      at = i;
    }
    await bite(i);
  }
  busy = false;
}

function endState() {
  cards.forEach((c) => c.classList.add('bite-2'));
  park(cards.length - 1);
  pose(goat, 'stand');
}

if (goat && cards.length) {
  if (still) {
    endState();
  } else {
    park(0);
    addEventListener('resize', () => { if (!busy) park(at); });
    once(list, (past) => {
      if (past) endState(); else run();
    }, 0.7);
  }
}
