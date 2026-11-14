// THE HERD: turning a drawing into places for goats to stand.
//
// sampleInk() paints white shapes or text on a hidden canvas, then lays an even honeycomb of
// points over the white parts. The spacing is searched so the number of points matches the
// number of goats asked for. Points come back in "view units": x and y each run -0.5..0.5
// across the viewport, with y pointing up.

/**
 * @param {object} o
 * @param {number} o.aspect   viewport width / height
 * @param {number} o.count    how many points to aim for
 * @param {(ctx: CanvasRenderingContext2D, w: number, h: number) => void} o.draw  paint in white
 * @param {number} [o.jitter] how far a point may wander from its honeycomb cell, in cells
 * @returns {{points: number[][], spacing: number}} spacing is a fraction of the viewport width
 */
export function sampleInk({ aspect, count, draw, jitter = 0.16 }) {
  const w = 900;
  const h = Math.max(200, Math.round(w / aspect));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(ctx, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const ink = (x, y) => data[(Math.floor(y) * w + Math.floor(x)) * 4] > 127;

  const collect = (s) => {
    const pts = [];
    let row = 0;
    for (let y = s * 0.5; y < h; y += s * 0.866, row++) {
      for (let x = row % 2 ? s : s * 0.5; x < w; x += s) {
        if (ink(x, y)) pts.push([x, y]);
      }
    }
    return pts;
  };

  // binary search the spacing: the largest spacing that still gives at least `count` points
  let lo = 1.5;
  let hi = w / 2;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (collect(mid).length >= count) lo = mid;
    else hi = mid;
  }
  let pts = collect(lo);
  // a few too many: drop evenly so no letter loses a whole corner
  if (pts.length > count) {
    const keep = [];
    const stepSize = pts.length / count;
    for (let i = 0; i < count; i++) keep.push(pts[Math.floor(i * stepSize)]);
    pts = keep;
  }
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  return {
    points: pts.map(([x, y]) => [(x + rnd() * lo * jitter) / w - 0.5, 0.5 - (y + rnd() * lo * jitter) / h]),
    spacing: lo / w,
  };
}

/**
 * Draw lines of text, centred, as large as fits the given box (fractions of the canvas).
 * tracking: extra space between letters, in ems. thin: how much to shave off every edge, in ems,
 * so the gaps inside heavy letters stay open when the letters are made of goats.
 */
export function drawWords(lines, { font, box = [0.08, 0.1, 0.84, 0.8], lineHeight = 0.92, weight = '400', tracking = 0.06, thin = 0.035 }) {
  return (ctx, w, h) => {
    const [bx, by, bw, bh] = [box[0] * w, box[1] * h, box[2] * w, box[3] * h];
    const probe = 200;
    ctx.font = `${weight} ${probe}px ${font}`;
    const lineWidth = (line, size) => {
      let total = 0;
      for (const chr of line) total += (ctx.measureText(chr).width * size) / probe + tracking * size;
      return total - tracking * size;
    };
    const widest = Math.max(...lines.map((l) => lineWidth(l, probe)));
    const size = Math.min((probe * bw) / widest, bh / (lines.length * lineHeight));
    const widths = lines.map((l) => lineWidth(l, size));
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const cap = ctx.measureText('H').actualBoundingBoxAscent || size * 0.72;
    const total = cap + (lines.length - 1) * size * lineHeight;
    let y = by + (bh - total) / 2 + cap;
    ctx.lineWidth = thin * size * 2;
    ctx.strokeStyle = '#000';
    lines.forEach((line, n) => {
      let x = bx + (bw - widths[n]) / 2;
      for (const chr of line) {
        ctx.fillText(chr, x, y);
        if (thin > 0) ctx.strokeText(chr, x, y);
        x += ctx.measureText(chr).width + tracking * size;
      }
      y += size * lineHeight;
    });
    ctx.strokeStyle = '#fff';
  };
}

/** A ring, as a share of the viewport height. Good for gathering round something. */
export function drawRing({ cx = 0.5, cy = 0.5, r = 0.3, thickness = 0.06, squash = 1 }) {
  return (ctx, w, h) => {
    ctx.lineWidth = thickness * h;
    ctx.beginPath();
    ctx.ellipse(cx * w, cy * h, r * h * squash, r * h, 0, 0, Math.PI * 2);
    ctx.stroke();
  };
}

/** Several round groups: [[cx, cy, r], ...] with r as a share of the viewport height. */
export function drawGroups(groups) {
  return (ctx, w, h) => {
    for (const [cx, cy, r] of groups) {
      ctx.beginPath();
      ctx.arc(cx * w, cy * h, r * h, 0, Math.PI * 2);
      ctx.fill();
    }
  };
}

/** A path through points [[x, y], ...] (fractions of the canvas), drawn as a thick line. */
export function drawTrail(points, thickness = 0.05) {
  return (ctx, w, h) => {
    ctx.lineWidth = thickness * h;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
    ctx.stroke();
  };
}
