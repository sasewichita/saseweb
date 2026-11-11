// Page motion, built on GSAP (loaded from the CDN before this module). Three layers only:
// the hero enters once on load, the membership steps follow the scroll inside their own section,
// and CSS handles hover and press. Without GSAP or under reduced motion everything stands as written.
const { gsap, SplitText, ScrollTrigger } = window;
const root = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!gsap || reduced) {
  root.classList.add("m-enter-done");
} else {
  gsap.registerPlugin(SplitText, ScrollTrigger);
  enter();
  chapters();
}

// The hero: h1 rises line by line out of masks, then the lead and buttons fade up, the picture settles.
async function enter() {
  const hero = document.querySelector("[data-enter]");
  if (!hero) return root.classList.add("m-enter-done");
  // Split after the display face has loaded so the lines break where they will stay.
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 500))]);
  const h1 = hero.querySelector("h1");
  const items = hero.querySelectorAll("[data-enter-item]");
  const media = hero.querySelector("[data-enter-media]");
  gsap.set([h1, ...items], { opacity: 1 });
  root.classList.add("m-enter-done");
  // The split stays in place after the entrance: reverting it re-lays the balanced h1 and makes the
  // lines jump. autoSplit re-splits on resize, and the returned tween keeps its finished state.
  SplitText.create(h1, {
    type: "lines", mask: "lines", maskClass: "line-mask", autoSplit: true,
    onSplit: (self) => gsap.from(self.lines, {
      yPercent: 110, duration: 0.7, ease: "expo.out", stagger: Math.min(0.08, 0.24 / self.lines.length),
    }),
  });
  const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
  if (items.length) tl.from(items, { y: 12, opacity: 0, duration: 0.52, stagger: 0.06 }, 0.35);
  if (media) tl.from(media.querySelector("img") || media, { scale: 1.05, duration: 1.1, ease: "power3.out" }, 0);
}

// How membership works: from 1024px the stage sticks for one screen of scroll; each step opens in turn
// while its window crossfades into the frame on the right. Smaller screens keep the static rows.
function chapters() {
  const section = document.querySelector("[data-chapters]");
  if (!section) return;
  const steps = [...section.querySelectorAll(".pc-step")];
  const figures = steps.map((s) => s.querySelector(".pc-visual"));
  const frame = section.querySelector(".pc-visuals");
  if (steps.length < 2 || !frame) return;
  const homes = figures.map((f) => f.parentElement);

  gsap.matchMedia().add("(min-width: 1024px) and (min-height: 640px)", () => {
    let current = -1;
    section.classList.add("is-live");
    figures.forEach((f) => frame.append(f));

    const show = (i) => {
      if (i === current) return;
      current = i;
      steps.forEach((s, n) => s.classList.toggle("is-on", n === i));
      figures.forEach((f, n) => {
        if (n === i) gsap.fromTo(f, { autoAlpha: 0, scale: 1.03, y: 0 }, { autoAlpha: 1, scale: 1, duration: 0.6, ease: "expo.out", overwrite: true });
        else gsap.to(f, { autoAlpha: 0, y: n < i ? -12 : 12, duration: 0.3, ease: "power2.out", overwrite: true });
      });
    };

    const st = ScrollTrigger.create({
      trigger: section,
      start: "top top+=72",
      end: "bottom bottom",
      onUpdate(self) {
        const p = self.progress * steps.length;
        const i = Math.min(steps.length - 1, Math.floor(p));
        steps.forEach((s, n) => s.style.setProperty("--p", n < i ? 1 : n === i ? Math.min(1, p - i) : 0));
        show(i);
      },
    });
    show(0);
    steps[0].style.setProperty("--p", 0);

    return () => {
      st.kill();
      section.classList.remove("is-live");
      figures.forEach((f, n) => { gsap.set(f, { clearProps: "all" }); homes[n].append(f); });
      steps.forEach((s) => { s.classList.remove("is-on"); s.style.removeProperty("--p"); });
    };
  });
}
