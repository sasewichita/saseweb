import { createEye, PALETTES } from '../../kit/eye.js';
import { reducedMotion, finePointer, qualityTier, cappedDpr, usePoster } from '../../../shared/base.js';

const root = document.documentElement;
const canvas = document.getElementById('eye');
const goat = document.getElementById('goat');
const slot = document.getElementById('slot');
const A = 46, HX = 595, HY = 440, LID = 0.3;
const SOCKET = [[549,440],[553.6,436],[558.2,433.8],[562.8,432.1],[567.4,430.8],[572,429.6],[576.6,428.6],[581.2,427.8],[585.8,427.2],[590.4,426.7],[595,426.4],[599.6,426.3],[604.2,426.4],[608.8,426.8],[613.4,427.3],[618,428.1],[622.6,429.3],[627.2,430.7],[631.8,432.7],[636.4,435.3],[641,440],[636.4,442.9],[631.8,445.1],[627.2,446.9],[622.6,448.4],[618,449.7],[613.4,450.8],[608.8,451.7],[604.2,452.3],[599.6,452.8],[595,453],[590.4,453],[585.8,452.7],[581.2,452.2],[576.6,451.5],[572,450.5],[567.4,449.2],[562.8,447.6],[558.2,445.7],[553.6,443.3]];
const gold = new URLSearchParams(location.search).get('c') === 'gold';
if (gold) root.classList.add('c-gold');
const P_REST = gold ? { paper: '#f6e7c3', ink: '#4a0d0a', block: '#c08a2e' } : PALETTES.newyear;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

const tier = qualityTier();
const still = reducedMotion();
let eye = null;
if (tier > 0) {
  try { eye = createEye(canvas, { palette: P_REST, dpr: cappedDpr(tier), onLost: () => { eye = null; fallback(); } }); } catch (e) { eye = null; }
}
function fallback() { usePoster(canvas); root.classList.remove('live'); layout(true); }
if (!eye) usePoster(canvas); else root.classList.add('live');
const isStatic = still || !eye;
if (isStatic) root.classList.add('static');
if (eye && still) eye.state.still = true;

let W, H, M, phone, L, lastStep = -1, lastFlood = -1;

function geom() {
  W = innerWidth; H = innerHeight; M = Math.min(W, H);
  phone = W <= 760 && H > W;
  const Send = phone ? 1.32 : 1;
  const end = { cx: W / 2, cy: H / 2 - (phone ? 0.16 : 0.02) * M };
  const kEnd = 0.66 * M * Send / A;
  let k0, c0, r0;
  if (phone) {
    const th = (W - 24) / 4.2;
    const slotY = H - 266 - 10 - th;
    const top = 118, bot = slotY - 8;
    k0 = Math.min((W - 8) / 700, (bot - top) / 900);
    c0 = { cx: W / 2 + (500 - HX) * k0 * -1, cy: top + (440 - 125) * k0 };
    r0 = { x: 12, y: slotY, w: W - 24, h: th };
  } else {
    k0 = Math.min((H - 310) / 850, 0.6 * W / 700);
    c0 = { cx: 0.62 * W - (500 - HX) * k0, cy: 30 + (440 - 125) * k0 };
    const noseX = 0.62 * W - 345 * k0;
    const w = Math.max(200, Math.min(620, 0.46 * W, noseX - 150));
    r0 = { x: 26, y: 0.4 * H - w / 8.4, w, h: w / 4.2 };
  }
  const ew = 0.66 * M * Send, eh = 0.156 * M * Send;
  const re = { x: end.cx - ew / 2, y: end.cy - eh / 2, w: ew, h: eh };
  L = { k0, c0, kEnd, end, r0, re, Send };
}

function headT(cx, cy, k, rot) {
  goat.style.transform = `translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px) rotate(${rot || 0}deg) scale(${k.toFixed(4)}) translate(${-HX}px,${-HY}px)`;
}

function setEye(cx, cy, k, open) {
  if (!eye) return;
  eye.state.lid = open ? LID : 0; eye.state.passY = 1; eye.state.passK = 1;
  eye.state.scale = A * k / (0.66 * M);
  eye.state.center = [(cx - W / 2) / M, (H / 2 - cy) / M];
}

function setSocket(cx, cy, k, rot) {
  const a = (rot || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const pts = SOCKET.map(([x, y]) => {
    const dx = (x - HX) * k, dy = (y - HY) * k;
    return (cx + dx * ca - dy * sa).toFixed(1) + 'px ' + (cy + dx * sa + dy * ca).toFixed(1) + 'px';
  });
  root.style.setProperty('--socket', 'polygon(' + pts.join(',') + ')');
}

function placeSlot(r) {
  slot.style.left = r.x.toFixed(1) + 'px'; slot.style.top = r.y.toFixed(1) + 'px';
  slot.style.width = r.w.toFixed(1) + 'px'; slot.style.height = r.h.toFixed(1) + 'px';
}

function stepOf(y) {
  if (isStatic) return 0;
  const p = clamp(y / (0.95 * H), 0, 1);
  return p < 0.08 ? 0 : Math.min(7, 1 + Math.floor((p - 0.08) / 0.13));
}

function apply(i) {
  const { k0, c0, kEnd, end, r0, re } = L;
  let k, cx, cy, rot = 0;
  if (i <= 5) {
    const t = i / 5;
    k = k0 * Math.pow(kEnd / k0, t);
    cx = lerp(c0.cx, end.cx, t); cy = lerp(c0.cy, end.cy, t);
  } else { k = kEnd; cx = end.cx; cy = end.cy; }
  if (i === 6) { rot = -4; cx += 0.04 * W; cy -= 0.05 * H; }
  setEye(i === 6 ? end.cx : cx, i === 6 ? end.cy : cy, k, i < 6);
  setSocket(cx, cy, k, rot);
  headT(cx, cy, k, rot);
  root.classList.toggle('live-eye', i > 0);
  const gone = i >= 7;
  root.classList.toggle('head-gone', gone);
  if (!gone && gold && eye) eye.setPalette(P_REST);
  if (gone && eye) { eye.render(performance.now() / 1000, 0); const p = eye.pupilRect(); placeSlot({ x: p.x, y: p.y, w: p.w, h: p.h }); }
  else { const t = Math.min(i, 6) / 6; placeSlot({ x: lerp(r0.x, re.x, t), y: lerp(r0.y, re.y, t), w: lerp(r0.w, re.w, t), h: lerp(r0.h, re.h, t) }); }
}

function layout(force) {
  geom();
  if (eye) eye.resize();
  const y = isStatic ? 0 : scrollY;
  lastStep = stepOf(y); apply(lastStep);
  onScroll(true);
}

function onScroll(force) {
  if (isStatic) return;
  const y = scrollY;
  const s = stepOf(y);
  if (s !== lastStep || force) { lastStep = s; apply(s); }
  const f = clamp((y - H) / (0.4 * H), 0, 1);
  if (f !== lastFlood || force) {
    lastFlood = f;
    root.style.setProperty('--flood', f);
    root.classList.toggle('hero-gone', f >= 0.25);
    root.classList.toggle('slot-off', f >= 0.98);
    root.classList.toggle('stage-off', f >= 0.98);
    root.classList.toggle('flood-done', f > 0);
    if (eye) {
      eye.state.flood = f;
      if (gold) eye.setPalette(f > 0 ? { ...P_REST, block: '#8f1d14' } : P_REST);
    }
  }
}

addEventListener('scroll', () => onScroll(false), { passive: true });
addEventListener('resize', () => layout(true));
if (eye && finePointer()) addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') eye.lookAt(e.clientX, e.clientY); }, { passive: true });

layout(true);
if (eye) {
  if (still) eye.render(0, 0);
  else {
    let t0 = performance.now();
    const loop = (t) => { const dt = (t - t0) / 1000; t0 = t; eye && eye.render(t / 1000, dt); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
}
