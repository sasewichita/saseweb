// footer: the goat walks in once, then wags twice
import { still, play, wait, once } from './kit.js';

const foot = document.getElementById('foot');
const goat = document.getElementById('foot-goat');

if (foot && goat && !still) {
  once(foot, async (past) => {
    if (past) return;
    const gut = parseFloat(getComputedStyle(foot).paddingLeft) || 24;
    const w = goat.getBoundingClientRect().width || 160;
    const end = foot.clientWidth - w / 2;
    const dist = Math.max(0, end - gut);
    const step = 36;
    const n = Math.ceil(dist / step);
    let x = -dist;
    goat.style.translate = x + 'px 0';
    for (let i = 0; i < n; i++) {
      x = Math.min(0, x + step);
      goat.style.translate = x + 'px 0';
      const ok = await play(goat, [i % 2 ? 'walk-b' : 'walk-a']);
      if (!ok) return;
      await wait(110);
    }
    goat.style.translate = '';
    for (let k = 0; k < 2; k++) {
      await play(goat, ['wag']);
      await wait(220);
      await play(goat, ['stand']);
      await wait(220);
    }
  }, 0.75);
}
