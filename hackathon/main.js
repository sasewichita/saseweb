// Hack the Wu page motion, built on GSAP (loaded from the CDN before this module).
// Four moments only: the hero enters once and its picture layers drift apart on scroll, the goat climbs
// with the scroll, the seal stamps the ticket, and a short volley of fireworks goes up over the last section.
// Without GSAP or under reduced motion everything stands in its finished state.
const { gsap, ScrollTrigger, SplitText, MotionPathPlugin } = window;
const root = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const DISCORD = "https://discord.gg/VwQhFkzWNH";
$$("[data-discord]").forEach((a) => (a.href = DISCORD));

header();
stars();
wheat();

if (!gsap || reduced) {
  root.classList.add("m-enter-done");
} else {
  gsap.registerPlugin(ScrollTrigger, SplitText, MotionPathPlugin);
  enter();
  heroScroll();
  climb();
  stamp();
  fireworks();
}

// The header is clear while the night hero is under it, solid after.
function header() {
  const top = $(".top");
  const hero = $(".hero");
  new IntersectionObserver(([e]) => top.classList.toggle("is-solid", !e.isIntersecting), {
    rootMargin: `-${top.offsetHeight}px 0px 0px 0px`,
  }).observe(hero);
}

// Small seeded generator so the sky and the field look the same on every load.
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

function stars() {
  const box = $("[data-stars]");
  const rand = rng(7);
  for (let n = 0; n < 70; n++) {
    const s = document.createElement("i");
    s.style.cssText = `left:${rand() * 100}%;top:${rand() * 62}%;--r:${1 + rand() * 2.2}px;--o:${(0.2 + rand() * 0.5).toFixed(2)}`;
    box.append(s);
  }
}

// A Kansas wheat field along the foot of the hero: one stalk symbol, planted across the width.
function wheat() {
  const box = $("[data-wheat]");
  const rand = rng(21);
  const golds = ["#e3a83b", "#c98a2a", "#f0c35a", "#b3761f"];
  const count = Math.round(Math.min(innerWidth, 2000) / 15);
  let html = "";
  for (let n = 0; n < count; n++) {
    const x = (n / count) * 100 + rand() * 1.4 - 1;
    html += `<svg style="--x:${x.toFixed(2)}%;--h:${(55 + rand() * 45).toFixed(0)}%;--c:${golds[n % 4]};--lean:${(rand() * 8 - 4).toFixed(1)}deg;--t:${(2.6 + rand() * 2).toFixed(2)}s;--d:${(-rand() * 4).toFixed(2)}s"><use href="#wheat"/></svg>`;
  }
  box.innerHTML = html;
}

// The hero: the moon comes up, the range and the goat settle, then the title rises line by line.
async function enter() {
  const hero = $("[data-enter]");
  const h1 = $("h1", hero);
  const items = $$("[data-enter-item]", hero);
  const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
  tl.from(".peak-moon", { scale: 0.86, opacity: 0, svgOrigin: "350 330", duration: 1.4 }, 0)
    .from(".ridge", { yPercent: 40, duration: 1.2, stagger: 0.08 }, 0)
    .from(".peak-crag", { yPercent: 12, duration: 1.2 }, 0.1)
    .from(".wheat", { yPercent: 100, duration: 1 }, 0.3)
    .from(".lantern", { opacity: 0, yPercent: 120, duration: 1.6, stagger: 0.07 }, 0.3);

  // Split after the display face has loaded so the lines break where they will stay.
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 500))]);
  gsap.set([h1, ...items], { opacity: 1 });
  root.classList.add("m-enter-done");
  SplitText.create(h1, {
    type: "lines", mask: "lines", maskClass: "line-mask", autoSplit: true,
    onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 0.8, ease: "expo.out", stagger: 0.09 }),
  });
  gsap.from(items, { y: 12, opacity: 0, duration: 0.52, stagger: 0.06, ease: "expo.out", delay: 0.35 });

  // Click the goat and it hops.
  const goat = $("[data-goat] use");
  $("[data-goat]").addEventListener("click", () => {
    if (gsap.isTweening(goat)) return;
    gsap.timeline()
      .to(goat, { y: -46, rotation: -6, svgOrigin: "362 560", duration: 0.28, ease: "power2.out" })
      .to(goat, { y: 0, rotation: 0, duration: 0.5, ease: "bounce.out" });
  });
}

// Scrolling out of the hero pulls the picture's layers apart: far things lag, lanterns rise. The words stay put.
// On a mouse, the layers also lean a little with the pointer.
function heroScroll() {
  const st = { trigger: ".hero", start: "top top", end: "bottom top", scrub: true };
  gsap.to(".peak-moon", { y: 150, ease: "none", scrollTrigger: st });
  gsap.to(".ridge-far", { y: 90, ease: "none", scrollTrigger: st });
  gsap.to(".ridge-mid", { y: 40, ease: "none", scrollTrigger: st });
  $$(".lantern").forEach((l) => gsap.to(l, { y: () => -innerHeight * 0.45 * l.dataset.depth, ease: "none", scrollTrigger: st }));

  gsap.matchMedia().add("(hover: hover) and (pointer: fine)", () => {
    const layers = [[".peak-moon", 14], [".ridge-far", 8], [".ridge-mid", 16], [".ridge-near", 26], [".stars", 5]]
      .map(([sel, amt]) => [gsap.quickTo(sel, "x", { duration: 0.9, ease: "power3.out" }), amt]);
    const lanterns = $$(".lantern").map((l) => [gsap.quickTo(l, "x", { duration: 1.2, ease: "power3.out" }), 30 * l.dataset.depth]);
    const move = (e) => {
      const dx = e.clientX / innerWidth - 0.5;
      [...layers, ...lanterns].forEach(([to, amt]) => to(-dx * amt));
    };
    const hero = $(".hero");
    hero.addEventListener("pointermove", move);
    return () => hero.removeEventListener("pointermove", move);
  });
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
    ScrollTrigger.create({
      trigger: section, start: "top top", end: "+=140%", pin: true, scrub: 0.6, animation: tl,
    });
  });
  mm.add("(max-width: 1023px), (max-height: 639px)", () => {
    ScrollTrigger.create({
      trigger: ".climb-art", start: "top 75%", end: "bottom 45%", scrub: 0.6, animation: tl,
    });
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

// Fireworks over the closing section: one short volley the first time it comes on screen,
// then one wherever you click.
function fireworks() {
  const section = $("[data-fireworks]");
  const canvas = $(".sparks", section);
  const ctx = canvas.getContext("2d");
  const colors = ["#f0c35a", "#fbe6a6", "#ff8a5c", "#ffd9c7", "#e3a83b"];
  let sparks = [];
  let w = 0, h = 0, raf = 0;

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const burst = (x, y) => {
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
  new ResizeObserver(resize).observe(canvas);
  const seen = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    seen.disconnect();
    // keep the shells to the right and the top so they stay clear of the words
    for (let n = 0; n < 5; n++) setTimeout(() => burst(w * (0.5 + Math.random() * 0.45), h * (0.14 + Math.random() * 0.4)), n * 420);
  }, { threshold: 0.4 });
  seen.observe(section);
  section.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    const r = canvas.getBoundingClientRect();
    burst(e.clientX - r.left, e.clientY - r.top);
  });
}
