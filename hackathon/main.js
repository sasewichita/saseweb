// Hack the Wu page motion, built on GSAP (loaded from the CDN before this module).
// The hero enters once; the sky behind the page goes from night to sunrise with the scroll; the pitch
// lights up word by word; the lanterns swing in; the goat climbs through the weekend; the seal stamps the ticket; and a click
// on the hero sky sends up a firework. Without GSAP or under reduced motion everything stands finished.
const { gsap, ScrollTrigger, SplitText, MotionPathPlugin } = window;
const root = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const DISCORD = "https://discord.gg/VwQhFkzWNH";
$$("[data-discord]").forEach((a) => (a.href = DISCORD));

header();
stars();
clouds();
wheat();

if (!gsap || reduced) {
  root.classList.add("m-enter-done");
} else {
  gsap.registerPlugin(ScrollTrigger, SplitText, MotionPathPlugin);
  const launch = fireworks();
  enter(launch);
  heroScroll();
  words();
  lamps();
  climb();
  stamp();
  dawn();
}

// The header is clear at the top of the page and takes a dark ground once you scroll.
function header() {
  const top = $(".top");
  const set = () => top.classList.toggle("is-solid", scrollY > 24);
  addEventListener("scroll", set, { passive: true });
  set();
}

// Small seeded generator so the sky, the clouds and the field look the same on every load.
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

function stars() {
  const rand = rng(7);
  let html = "";
  for (let n = 0; n < 90; n++) {
    html += `<i style="left:${(rand() * 100).toFixed(2)}%;top:${(rand() * 80).toFixed(2)}%;--r:${(1 + rand() * 2.2).toFixed(1)}px;--o:${(0.2 + rand() * 0.5).toFixed(2)}"></i>`;
  }
  $("[data-stars]").innerHTML = html;
}

// The sea of clouds under the summit: three bands of overlapping discs, back to front.
function clouds() {
  const W = 3600, H = 240;
  const rand = rng(11);
  const bands = ["#6b1320", "#9c2228", "#d9472b"].map((fill, i) => {
    const y = H * (0.36 + 0.15 * i);
    let discs = "";
    for (let x = -80; x < W + 80;) {
      const r = H * (0.15 + rand() * 0.19);
      discs += `<circle cx="${x.toFixed(0)}" cy="${(y + (rand() - 0.5) * H * 0.1).toFixed(0)}" r="${r.toFixed(0)}"/>`;
      x += r * (0.9 + rand() * 0.7);
    }
    return `<g fill="${fill}"><rect x="-80" y="${y - H * 0.1}" width="${W + 160}" height="${H * 0.2}"/>${discs}</g>`;
  });
  $("[data-clouds]").innerHTML = `<svg viewBox="0 0 ${W} ${H}">${bands.join("")}</svg>`;
}

// A Kansas wheat field in silhouette against the sunrise: one stalk symbol, planted across the width.
function wheat() {
  const rand = rng(21);
  const inks = ["#1d0509", "#2b070d", "#1d0509", "#3a0a12"];
  const count = Math.round(Math.min(innerWidth, 2000) / 13);
  let html = "";
  for (let n = 0; n < count; n++) {
    const x = (n / count) * 100 + rand() * 1.4 - 1;
    html += `<svg style="--x:${x.toFixed(2)}%;--h:${(50 + rand() * 50).toFixed(0)}%;--c:${inks[n % 4]};--lean:${(rand() * 8 - 4).toFixed(1)}deg;--t:${(2.6 + rand() * 2).toFixed(2)}s;--d:${(-rand() * 4).toFixed(2)}s"><use href="#wheat"/></svg>`;
  }
  $("[data-wheat]").innerHTML = html;
}

// The hero: the moon swells in, the crag and the clouds come up, the title rises letter by letter,
// and three fireworks go off over it.
async function enter(launch) {
  const hero = $("[data-enter]");
  const title = $(".h1-main", hero);
  const items = $$("[data-enter-item]", hero);
  gsap.timeline({ defaults: { ease: "expo.out" } })
    .from(".peak-moon", { scale: 0.8, opacity: 0, svgOrigin: "350 330", duration: 1.4 }, 0)
    .from(".peak-crag", { yPercent: 14, duration: 1.3 }, 0.05)
    .from(".clouds svg", { yPercent: 45, duration: 1.4 }, 0.1);

  // Split after the display face has loaded so the letters are measured at their real widths.
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 700))]);
  gsap.set([title, ...items], { opacity: 1 });
  root.classList.add("m-enter-done");
  const split = SplitText.create(title, { type: "words,chars", mask: "chars", wordsClass: "word", aria: "none" });
  gsap.from(split.chars, { yPercent: 105, duration: 0.9, ease: "expo.out", stagger: 0.045 });
  gsap.from(items, { y: 14, opacity: 0, duration: 0.6, stagger: 0.07, ease: "expo.out", delay: 0.5 });

  const { width, height } = hero.getBoundingClientRect();
  [[0.16, 0.5], [0.85, 0.42], [0.72, 0.68]].forEach(([x, y], n) => setTimeout(() => launch(width * x, height * y), 900 + n * 380));

  // Click the goat and it hops.
  const goat = $("[data-goat] use");
  $("[data-goat]").addEventListener("click", (e) => {
    e.stopPropagation();
    if (gsap.isTweening(goat)) return;
    gsap.timeline()
      .to(goat, { y: -46, rotation: -6, svgOrigin: "362 560", duration: 0.28, ease: "power2.out" })
      .to(goat, { y: 0, rotation: 0, duration: 0.5, ease: "bounce.out" });
  });
}

// Leaving the hero: the moon lags behind the crag and the cloud bands slide past each other.
function heroScroll() {
  const st = { trigger: ".hero", start: "top top", end: "bottom top", scrub: true };
  gsap.to(".peak-moon", { y: 170, ease: "none", scrollTrigger: st });
  const drift = { trigger: ".clouds", start: "top bottom", end: "bottom top", scrub: true };
  $$(".clouds g").forEach((g, i) => gsap.fromTo(g, { x: (i - 1) * 90 - 60 }, { x: (1 - i) * 90 + 60, ease: "none", scrollTrigger: drift }));
}

// The pitch lights up word by word as it crosses the screen.
function words() {
  const el = $("[data-words]");
  document.fonts.ready.then(() => {
    const split = SplitText.create(el, { type: "words", aria: "none" });
    gsap.fromTo(split.words, { opacity: 0.22 }, {
      opacity: 1, ease: "none", stagger: 0.1,
      scrollTrigger: { trigger: el, start: "top 82%", end: "bottom 45%", scrub: 0.4 },
    });
  });
}

// The lanterns swing on their cords as they come into view, and again when the pointer brushes one.
function lamps() {
  const all = $$(".lamp");
  gsap.from(all, {
    rotation: (i) => (i % 2 ? -9 : 9), duration: 3.2, ease: "elastic.out(1, 0.22)", stagger: 0.12,
    scrollTrigger: { trigger: "[data-garland]", start: "top 78%", once: true },
  });
  all.forEach((lamp) => lamp.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse" || gsap.isTweening(lamp)) return;
    gsap.fromTo(lamp, { rotation: e.offsetX < lamp.offsetWidth / 2 ? 4 : -4 }, { rotation: 0, duration: 2.2, ease: "elastic.out(1, 0.25)" });
  }));
}

// The climb: the goat hops from the foot of the mountain to each ledge and on to the summit as you
// scroll, and the matching step lights up. From 1024px the section holds in place while it plays.
function climb() {
  const section = $("[data-climb]");
  const steps = $$(".step", section);
  const stops = $$(".stop", section);
  const goat = $(".climber", section);
  const flip = $(".climber-flip", section);
  section.classList.add("is-live");

  const tl = gsap.timeline({ defaults: { ease: "none" }, paused: true });
  gsap.set(goat, { x: 90, y: 610 });
  gsap.set(flip, { scaleX: -1, svgOrigin: "0 0" });
  gsap.set(".trail-lit", { strokeDashoffset: 1, opacity: 0 });
  ["#hop1", "#hop2", "#hop3"].forEach((id, n) => {
    if (n === 2) tl.set(flip, { scaleX: 1 });
    tl.set(id, { opacity: 1 })
      .to(goat, { motionPath: { path: id }, duration: 1, ease: "sine.inOut" })
      .to(id, { strokeDashoffset: 0, duration: 1, ease: "sine.inOut" }, "<")
      .addLabel(`stop${n}`)
      .to({}, { duration: 0.35 });
  });

  let current = -1;
  const sync = () => {
    const t = tl.time();
    const reached = ["stop0", "stop1", "stop2"].filter((l) => t >= tl.labels[l] - 0.02).length;
    const active = Math.max(reached - 1, 0);
    stops.forEach((s, n) => s.classList.toggle("is-on", n < reached));
    if (active === current) return;
    current = active;
    steps.forEach((s, n) => s.classList.toggle("is-on", n === active));
  };
  tl.eventCallback("onUpdate", sync);
  sync();

  const mm = gsap.matchMedia();
  mm.add("(min-width: 1024px) and (min-height: 640px)", () => {
    ScrollTrigger.create({ trigger: section, start: "top top", end: "+=140%", pin: true, scrub: 0.6, animation: tl });
  });
  mm.add("(max-width: 1023px), (max-height: 639px)", () => {
    ScrollTrigger.create({ trigger: ".climb-art", start: "top 75%", end: "bottom 45%", scrub: 0.6, animation: tl });
  });
}

// The goat seal comes down on the ticket like a stamp.
function stamp() {
  const ticket = $("[data-ticket]");
  gsap.timeline({ scrollTrigger: { trigger: ticket, start: "top 62%", once: true } })
    .from(".seal", { scale: 2.4, rotation: -32, opacity: 0, duration: 0.45, ease: "power4.in" })
    .to(ticket, { y: 5, duration: 0.06, ease: "power1.out" })
    .to(ticket, { y: 0, duration: 0.5, ease: "elastic.out(1.2, 0.4)" });
}

// Sunrise: over the last stretch of the page the night sky gives way to dawn, the stars go out,
// and the sun comes up behind the wheat.
function dawn() {
  const st = { trigger: ".close", start: "top 85%", endTrigger: ".foot", end: "bottom bottom", scrub: true };
  gsap.to(".sky-dawn", { opacity: 1, ease: "none", scrollTrigger: st });
  gsap.to(".stars", { opacity: 0, ease: "none", scrollTrigger: st });
  gsap.from(".sun", { y: 250, ease: "none", scrollTrigger: { trigger: ".foot", start: "top bottom", end: "bottom bottom", scrub: true } });
}

// Fireworks in the hero sky: returns a launcher, and a click anywhere on the hero sends one up there.
function fireworks() {
  const section = $("[data-fireworks]");
  const canvas = $(".sparks", section);
  const ctx = canvas.getContext("2d");
  const colors = ["#ffc145", "#fff1c9", "#ff7a4d", "#ffd9c7", "#d9472b"];
  let sparks = [];
  let w = 0, h = 0, raf = 0;

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const frame = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";
    sparks = sparks.filter((s) => s.life > 0);
    for (const s of sparks) {
      s.px = s.x - s.vx * 5; s.py = s.y - s.vy * 5;
      s.x += s.vx; s.y += s.vy;
      s.vx *= 0.985; s.vy = s.vy * 0.985 + 0.028;
      s.life -= s.fade;
      ctx.globalAlpha = Math.min(Math.max(s.life, 0) * 1.6, 1);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1 + s.life * 2;
      ctx.beginPath(); ctx.moveTo(s.px, s.py); ctx.lineTo(s.x, s.y); ctx.stroke();
    }
    raf = sparks.length ? requestAnimationFrame(frame) : 0;
  };
  const launch = (x, y) => {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const count = 46 + Math.floor(Math.random() * 20);
    const power = 2.6 + Math.random() * 2.4;
    for (let n = 0; n < count; n++) {
      const a = (n / count) * Math.PI * 2 + Math.random() * 0.2;
      const v = power * (0.55 + Math.random() * 0.6);
      sparks.push({ x, y, px: x, py: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, fade: 0.007 + Math.random() * 0.008, color });
    }
    if (!raf) raf = requestAnimationFrame(frame);
  };

  new ResizeObserver(resize).observe(canvas);
  resize();
  section.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    const r = canvas.getBoundingClientRect();
    launch(e.clientX - r.left, e.clientY - r.top);
  });
  return launch;
}
