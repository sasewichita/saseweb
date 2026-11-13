// faq: answers pop, goat talks
import { still, once, play } from './kit.js';

const goat = document.getElementById('faq-goat');
const exchanges = [...document.querySelectorAll('#faq .exchange')];

exchanges.forEach((ex) => {
  const a = ex.querySelector('.bubble--a');
  if (still) { ex.classList.add('said', 'now'); return; }
  once(a, (past) => {
    ex.classList.add('said');
    if (past) { ex.classList.add('now'); return; }
    play(goat, ['talk', 'sit', 'talk', 'sit', 'talk', 'sit'], 160);
  }, 0.55);
});
