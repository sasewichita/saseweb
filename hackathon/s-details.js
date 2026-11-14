// details countdown
import { still, frames, play } from './kit.js';
import { countdown } from './designs/shared/base.js';

const TARGET = '2027-03-26T17:00:00-05:00';
const goat = document.getElementById('details-goat');
const clock = document.querySelector('#details .clock');
if (clock) {
  const units = ['days', 'hours', 'minutes', 'seconds'];
  const dd = {};
  units.forEach((u) => { dd[u] = clock.querySelector(`[data-unit="${u}"]`); });
  const prev = {};
  const pad = (n) => String(Math.max(0, n)).padStart(2, '0');

  countdown(TARGET, (t) => {
    const vals = t.done ? { days: 0, hours: 0, minutes: 0, seconds: 0 } : t;
    const first = prev.seconds === undefined;
    units.forEach((u) => {
      const v = pad(vals[u]);
      if (dd[u].textContent === v) { prev[u] = v; return; }
      dd[u].textContent = v;
      if (!first && !still) frames(dd[u], 'drop');
      prev[u] = v;
    });
    // each new minute: goat nudges, minutes numeral shifts
    if (!first && !still && !t.done && minuteChanged(vals.minutes)) {
      frames(dd.minutes, 'shift');
      play(goat, ['nudge', 'stand'], 260);
    }
  });

  let lastMin = null;
  function minuteChanged(m) {
    const changed = lastMin !== null && lastMin !== m;
    lastMin = m;
    return changed;
  }
}
