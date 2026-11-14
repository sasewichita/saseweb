// nav: marks the trail and phone bar from the kit's here event
const ids = ['top', 'about', 'weekend', 'last-year', 'details', 'sponsors', 'faq', 'register', 'foot'];
const lis = [...document.querySelectorAll('.trail li')];
const barPrints = [...document.querySelectorAll('.bar-prints svg')];
const here = document.querySelector('.bar-here');
const menu = document.querySelector('.bar-menu');
let last = -1;

document.addEventListener('here', (e) => {
  const at = ids.indexOf(e.detail && e.detail.id);
  if (at < 0 || at === last) return;
  last = at;
  const foot = at === ids.length - 1;
  document.documentElement.classList.toggle('at-foot', foot);
  lis.forEach((li, k) => {
    const i = k + 1;
    const state = foot || i < at ? 'behind' : i === at ? 'here' : 'ahead';
    li.classList.toggle('is-behind', state === 'behind');
    li.classList.toggle('is-here', state === 'here');
    li.classList.remove('stamp');
    const a = li.querySelector('a');
    if (state === 'here') {
      a.setAttribute('aria-current', 'true');
      void li.offsetWidth;
      li.classList.add('stamp');
    } else a.removeAttribute('aria-current');
    const p = barPrints[k];
    if (p) {
      p.classList.toggle('is-behind', state === 'behind');
      p.classList.toggle('is-here', state === 'here');
    }
  });
  if (here) {
    const a = lis[at - 1] && lis[at - 1].querySelector('span');
    here.textContent = a && at < ids.length - 1 ? a.textContent : 'Sections';
  }
});

if (menu) {
  menu.addEventListener('click', (e) => { if (e.target.closest('li a')) menu.open = false; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.open = false; });
}
