const target = Date.parse(document.getElementById("countdown-target").dateTime);
const clock = document.getElementById("countdown-clock");
const units = [
  [document.getElementById("days"), 86400, Infinity],
  [document.getElementById("hours"), 3600, 24],
  [document.getElementById("minutes"), 60, 60],
  [document.getElementById("seconds"), 1, 60],
];

function updateCountdown() {
  const remaining = Math.max(0, target - Date.now());
  const seconds = Math.ceil(remaining / 1000);

  for (const [element, duration, rollover] of units) {
    const value = Math.floor(seconds / duration) % rollover;
    element.textContent = String(value).padStart(2, "0");
  }

  clock.hidden = false;
  if (remaining > 0) {
    setTimeout(updateCountdown, remaining % 1000 || 1000);
  }
}

updateCountdown();
