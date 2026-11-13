// sponsors: blocks set down, bottom row first
import { still, once, play, wait } from './kit.js';

const wrap = document.querySelector('#sponsors .wall-wrap');
const goat = document.getElementById('sponsors-goat');
const blocks = [...document.querySelectorAll('#sponsors .wall li')];

if (wrap && blocks.length) {
  if (!still) blocks.forEach((b) => b.classList.add('up'));
  once(wrap, async (past) => {
    if (past || still) { blocks.forEach((b) => b.classList.remove('up', 'mid')); return; }
    const order = blocks.map((b) => ({ b, r: b.getBoundingClientRect() }))
      .sort((a, c) => (Math.abs(c.r.top - a.r.top) > 4 ? c.r.top - a.r.top : a.r.left - c.r.left))
      .map((o) => o.b);
    for (const b of order) {
      b.classList.replace('up', 'mid');
      setTimeout(() => b.classList.remove('mid'), 80);
      await wait(120);
    }
    await wait(120);
    play(goat, ['ears-up', 'wag', 'stand'], 300);
  }, 0.5);
}
