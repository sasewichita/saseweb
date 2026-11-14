// footer: when the footer becomes the current section the goat walks in once, then wags twice
import { still, play, wait, pose, here } from './kit.js';

const foot = document.getElementById('foot');
const goat = document.getElementById('foot-goat');

if (foot && goat && !still) {
  let started = false;
  let away = false;

  const rest = () => {
    goat.style.translate = '';
    pose(goat, 'stand');
  };

  const walk = async () => {
    const gut = parseFloat(getComputedStyle(foot).paddingLeft) || 24;
    const w = goat.getBoundingClientRect().width || 160;
    const end = foot.clientWidth - w / 2;
    const step = 36;
    const dist = Math.min(12 * step, Math.max(0, end - gut));
    const n = Math.ceil(dist / step);
    let x = -dist;
    goat.style.translate = x + 'px 0';
    for (let i = 0; i < n; i++) {
      x = Math.min(0, x + dist / n);
      goat.style.translate = x + 'px 0';
      const ok = await play(goat, [i % 2 ? 'walk-b' : 'walk-a']);
      if (!ok || away) return rest();
      await wait(190);
      if (away) return rest();
    }
    goat.style.translate = '';
    for (let k = 0; k < 2; k++) {
      await play(goat, ['wag']);
      await wait(220);
      if (away) return rest();
      await play(goat, ['stand']);
      await wait(220);
      if (away) return rest();
    }
  };

  const onHere = (id) => {
    if (id === 'foot') {
      away = false;
      if (!started) { started = true; walk(); }
    } else if (started) {
      away = true;
      rest();
    }
  };

  document.addEventListener('here', (e) => onHere(e.detail && e.detail.id));
  if (here() === foot) onHere('foot');
}
