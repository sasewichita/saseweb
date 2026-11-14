// register: the bell rings, the goat pricks its ears
import { still, once, play, frames } from './kit.js';
import { isPhone } from './designs/shared/base.js';

const stage = document.querySelector('#register .reg-stage');
const bell = document.querySelector('#register .bell');
const goat = document.getElementById('register-goat');
let last = -Infinity;

function ring() {
  const now = performance.now();
  if (now - last < 2000) return;
  last = now;
  frames(bell, 'ringing');
  play(goat, ['stand', 'ears-up'], 140);
}

if (stage && bell) {
  stage.querySelectorAll('.reg-sheet .btn').forEach((b) => {
    ['pointerenter', 'focus', 'pointerdown'].forEach((e) => b.addEventListener(e, ring));
  });
  if (isPhone() && !still) once(stage, (past) => { if (!past) ring(); }, 0.5);
}
