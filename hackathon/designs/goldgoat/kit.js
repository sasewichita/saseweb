// GOLD GOAT KIT. Shared helpers for every section module.
// Builders: import from this file, do not edit it. Ask the main thread for changes.
import { reducedMotion } from '../shared/base.js';

const root = document.documentElement;

// Reduced motion: every module shows its end state and runs no frames.
export const still = reducedMotion();
if (still) root.classList.add('static');

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Set a goat actor's pose. Names: stand, walk-a, walk-b, graze, crouch, air, sit, talk,
// ears-up, look-back, nudge, peek, wag.
export function pose(actor, name) {
  if (actor && actor.dataset.pose !== name) actor.dataset.pose = name;
}

// Play poses one after another as hard frames: play(goat, ['crouch', 'air', 'stand'], 130).
// A new play() on the same actor cancels the one running. Resolves true if it ran to the end.
// With reduced motion it jumps straight to the last pose.
const runs = new WeakMap();
export async function play(actor, names, ms = 130) {
  const token = {};
  runs.set(actor, token);
  if (still) { pose(actor, names[names.length - 1]); return true; }
  actor.dataset.busy = '';
  for (let i = 0; i < names.length; i++) {
    if (runs.get(actor) !== token) return false;
    pose(actor, names[i]);
    if (i < names.length - 1) await wait(ms);
  }
  const ok = runs.get(actor) === token;
  if (ok) delete actor.dataset.busy;
  return ok;
}

// Add a class that runs a CSS steps() animation, and drop it when the animation ends.
export function frames(el, cls) {
  if (still) return;
  el.classList.remove(cls);
  void el.getBoundingClientRect();
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

// ---- one shared scroll loop ----
const jobs = new Set();
let queued = false;
function tick() {
  queued = false;
  const H = innerHeight;
  jobs.forEach((job) => job(H));
}
function queue() {
  if (!queued) { queued = true; requestAnimationFrame(tick); }
}
addEventListener('scroll', queue, { passive: true });
addEventListener('resize', queue);
addEventListener('load', queue);

// Run fn every time the page scrolls or resizes (once per frame). fn(viewportHeight).
export function onScroll(fn) {
  jobs.add(fn);
  queue();
  return () => jobs.delete(fn);
}

// Fire fn once, when the element's top edge passes `line` (a share of the screen height,
// 0.6 = 60% down). fn(past): past is true when the element was already above the screen at
// that moment (a reload or a jump link), so apply the end state with no animation.
export function once(el, fn, line = 0.6) {
  const job = (H) => {
    const r = el.getBoundingClientRect();
    if (r.top <= line * H) {
      jobs.delete(job);
      fn(r.bottom < 0);
    }
  };
  jobs.add(job);
  queue();
}

// ---- the current section ----
// Every [data-sec] element is a stop: the hero, the seven sections, the footer. The current one
// is the last whose top has passed 60% of the screen height; the footer also wins at the very
// bottom of the page. It carries data-here, and a `here` event goes out on document with
// { id, index, el }. The nav and "one goat at a time" both read this.
const stops = [...document.querySelectorAll('[data-sec]')];
let hereEl = null;
export const here = () => hereEl;
function track(H) {
  let cur = stops[0];
  for (const el of stops) {
    if (el.getBoundingClientRect().top <= 0.6 * H) cur = el;
  }
  const last = stops[stops.length - 1];
  if (last && scrollY > 0 && scrollY + H >= root.scrollHeight - 2) cur = last;
  if (cur === hereEl) return;
  if (hereEl) hereEl.removeAttribute('data-here');
  hereEl = cur;
  if (!cur) return;
  cur.setAttribute('data-here', '');
  root.dataset.here = cur.id || '';
  document.dispatchEvent(new CustomEvent('here', { detail: { id: cur.id, index: stops.indexOf(cur), el: cur } }));
}
onScroll(track);
