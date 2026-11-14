// cursor: the goat in this section turns its head toward the pointer
import { still, pose, here } from './kit.js';

const fine = matchMedia('(pointer: fine)').matches;
const mine = new WeakSet();
let px = -1, py = -1, queued = false;

function check() {
  queued = false;
  const sec = here();
  if (!sec || px < 0) return;
  const actor = sec.querySelector('.goat-actor');
  if (!actor) return;
  const r = actor.getBoundingClientRect();
  if (!r.width) return;
  const mid = r.left + r.width / 2;
  const flip = actor.classList.contains('flip');
  const behind = flip ? px > mid : px < mid;
  const cur = actor.dataset.pose;
  if (behind && cur === 'stand') { pose(actor, 'look-back'); mine.add(actor); }
  else if (!behind && cur === 'look-back' && mine.has(actor)) { pose(actor, 'stand'); mine.delete(actor); }
}

if (fine && !still) {
  addEventListener('pointermove', (e) => {
    px = e.clientX; py = e.clientY;
    if (!queued) { queued = true; requestAnimationFrame(check); }
  }, { passive: true });
  document.addEventListener('here', () => { if (!queued) { queued = true; requestAnimationFrame(check); } });
}
