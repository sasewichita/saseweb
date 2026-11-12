// A · New Year Print: register section. The press: lift on hover, slam on press, then go.
import { reducedMotion } from '../../shared/base.js';

const press = document.querySelector('#register .press');
const seal = press && press.querySelector('.press-seal');

if (press && seal) {
  // the print that waits under the seal (decoration only)
  const print = document.createElement('span');
  print.className = 'press-print';
  print.setAttribute('aria-hidden', 'true');
  print.setAttribute('lang', 'zh-Hant');
  print.textContent = seal.textContent;
  press.insertBefore(print, seal);

  let going = false;
  const strike = () => {
    if (!reducedMotion()) press.classList.add('is-struck');
  };
  press.addEventListener('pointerdown', (e) => {
    if (e.button === 0) strike();
  });
  press.addEventListener('click', (e) => {
    const plain =
      e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !press.target;
    if (!plain || reducedMotion() || going) return;
    e.preventDefault();
    going = true;
    strike();
    setTimeout(() => {
      location.href = press.href;
    }, 280);
  });
  // coming back from history: show the rest state
  window.addEventListener('pageshow', () => {
    going = false;
    press.classList.remove('is-struck');
  });
}
