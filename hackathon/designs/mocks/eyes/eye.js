// EYES: a wall of goat eyes around one large eye.
// Derived from the Panorama eye. The big eye keeps the full baseline plates(); every other cell
// draws a simplified small eye, computed once per pixel.
// One fragment shader, drawn like a three-ink print (yellow, blue, black on bone paper).
// The pupil is a horizontal rounded bar. It follows the pointer, blinks, and can widen until it
// frames the whole page (state.open 0 -> 1).
//
// Use:
//   const eye = createEye(canvas, { dpr });      // returns null when WebGL2 is missing
//   eye.lookAt(clientX, clientY);                // css pixels
//   eye.state.open = 0.4;                        // 0 resting, 1 pupil is the page frame
//   eye.blink();
//   eye.render(timeSeconds, deltaSeconds);       // call every frame
//   eye.pupilRect();                             // {x, y, w, h, r} in css pixels, for DOM overlays

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 u_res;
uniform vec2 u_center;   // eye centre, in units of the short side, +y up
uniform float u_scale;   // zoom of the whole eye
uniform vec2 u_iris;     // iris centre in eye space (the gaze)
uniform vec2 u_pupilC;   // pupil centre in eye space
uniform vec2 u_pupilH;   // pupil half size in eye space
uniform float u_pupilR;  // pupil corner radius in eye space
uniform float u_blink;   // 0 open, 1 shut
uniform float u_open;    // 0 resting, 1 the pupil is the page frame
uniform float u_tilt;    // radians; the eyeball rolls so the pupil stays level
uniform float u_seed;
uniform float u_dpr;     // device pixels per css pixel
uniform vec2 u_cell;     // wall cell size, css px
uniform vec2 u_excl;     // half size kept clear for the big eye, css px
uniform vec2 u_ptr;      // pointer, css px, +y up
uniform float u_time;
uniform float u_skin;    // reach of the big eye's contour lines, eye space

const float TAU = 6.28318530718;
const vec3 PAPER = vec3(0.925, 0.902, 0.839);
const vec3 INK_Y = vec3(1.000, 0.800, 0.040);
const vec3 INK_B = vec3(0.150, 0.270, 0.800);
const vec3 INK_K = vec3(0.060, 0.060, 0.075);

float hash11(float n) { return fract(sin(n * 127.1) * 43758.5453123); }
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x),
             mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
// smooth noise around a circle: repeats exactly after one turn
float anoise(float a, float freq, float seed) {
  float x = a / TAU * freq;
  float i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash11(mod(i, freq) + seed), hash11(mod(i + 1.0, freq) + seed), f);
}
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 d = abs(p) - b + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// A ruled line screen. c is in line units (one line per unit), duty is the inked share 0..1,
// aa is one pixel in line units.
float lineScreen(float c, float duty, float aa) {
  if (duty <= 0.001) return 0.0;
  if (duty >= 0.999) return 1.0;
  float f = abs(fract(c) - 0.5);
  aa = min(aa, 0.5);
  return 1.0 - smoothstep(duty * 0.5 - aa, duty * 0.5 + aa, f);
}

// Ink coverage of the three plates at eye-space point q: x yellow, y blue, z black.
vec3 plates(vec2 q, float px) {
  float Y = 0.0, B = 0.0, K = 0.0;

  // ---- eyelids: two arcs that meet at the corners
  const float W = 0.66;
  float xn = clamp(q.x / W, -1.0, 1.0);
  float k = 1.0 - xn * xn;
  float upOpen = 0.292 * pow(k, 0.70) + 0.040 * xn * k;
  float loOpen = -0.250 * pow(k, 0.86) + 0.022 * xn * k;
  float meet = -0.035 * k;
  float up = mix(upOpen, meet + 0.002, u_blink);
  float lo = mix(loOpen, meet - 0.002, u_blink);
  float side = max(abs(q.x) - W, 0.0);
  float dUp = q.y - up;
  float dLo = lo - q.y;
  float lidGap = max(dUp, dLo);
  // past the corners the contour lines turn around the corner point in smooth arcs
  float outside = side > 0.0 ? length(vec2(side, lidGap)) : lidGap;

  if (outside > 0.0) {
    // ---- skin: engraved contour lines in blue, in flat steps of weight
    float d = outside + 0.016 * (fbm(q * 3.1 + u_seed) - 0.5);
    float tone = d < 0.050 ? 0.0 : d < 0.135 ? 0.80 : d < u_skin ? 0.56 : 0.0;
    const float FREQ = 56.0;
    B = lineScreen(d * FREQ, tone, px * FREQ);
    // lid margin
    K = 1.0 - smoothstep(0.016 - px, 0.016 + px, outside);
    // the fold above the upper lid, thick in the middle and gone at the corners
    float fold = abs(dUp - (0.092 + 0.030 * k)) - (0.0075 * k * k);
    K = max(K, (1.0 - smoothstep(-px, px, fold)) * step(0.0, dUp) * step(0.12, k));
    // a lighter fold under the lower lid
    float fold2 = abs(dLo - (0.070 + 0.018 * k)) - (0.0034 * k * k);
    K = max(K, (1.0 - smoothstep(-px, px, fold2)) * step(0.0, dLo) * step(0.30, k));
    // lashes: short strokes leaning outward from the upper lid
    float lx = q.x * 34.0 + 0.5;
    float lid = floor(lx);
    float lrnd = hash11(lid + 5.0);
    float lean = (fract(lx) - 0.5) - dUp * (7.0 * xn + (lrnd - 0.5) * 3.0);
    float lash = abs(lean) - 0.13 * (1.0 - dUp / (0.030 + 0.030 * lrnd));
    float lashMask = (1.0 - smoothstep(-px * 34.0, px * 34.0, lash)) * step(0.0, dUp) * step(dUp, 0.060) * step(0.10, k);
    K = max(K, lashMask * (1.0 - u_open));
  } else {
    float din = -outside;
    vec2 qi = rot(u_tilt) * (q - u_iris);
    float r = length(qi);
    float a = atan(qi.y, qi.x);
    const float RI = 0.43;
    if (r < RI) {
      // ---- iris: solid yellow outside, a ruled half tone around the pupil
      float inner = RI * (0.56 + 0.075 * anoise(a, 34.0, 9.0));
      float full = smoothstep(inner - px, inner + px, r);
      float pale = lineScreen((qi.x - qi.y) * 105.0, 0.50, px * 105.0);
      Y = mix(pale, 1.0, full);
      // fibres: thin black rays, each with its own length and weight
      const float N = 250.0;
      float la = a / TAU * N;
      float id = mod(floor(la), N);
      float r1 = hash11(id + 11.0);
      float r2 = hash11(id + 57.0);
      float aaA = px / (max(r, 0.02) * TAU) * N;
      float ray = lineScreen(la, 0.14 + 0.24 * r2, aaA);
      float outerStart = RI * (0.60 + 0.30 * r1);
      float innerEnd = RI * (0.30 + 0.24 * r2);
      float lives = max(step(outerStart, r), (1.0 - step(innerEnd, r)) * step(0.45, r1));
      K = ray * lives;
      // limbal ring with a ragged inner edge
      float limb = RI * (0.925 - 0.030 * anoise(a, 96.0, 3.0));
      K = max(K, smoothstep(limb - px, limb + px, r));
      // a blue ring of short dashes halfway out
      float ring = abs(r - RI * 0.74) - 0.010;
      float dash = step(0.5, fract(la * 0.25 + 0.3 * r1));
      B = (1.0 - smoothstep(-px, px, ring)) * dash;
    } else {
      // ---- the white of the eye: paper with a few blue lines
      B = lineScreen(q.y * 64.0, 0.30, px * 64.0);
    }
    // shadow of the upper lid on the eyeball: two flat bands of blue hatch
    float under = -dUp;
    float tone = under < 0.034 ? 0.78 : under < 0.074 ? 0.42 : 0.0;
    B = max(B, lineScreen(q.y * 88.0, tone, px * 88.0));
    // inner edge of the lid margin
    K = max(K, 1.0 - smoothstep(0.007 - px, 0.007 + px, din));
    // highlight: a flat window shape, fixed to the lens rather than the iris
    vec2 hq = q - vec2(-0.200, 0.158);
    hq = mat2(1.0, 0.0, 0.30, 1.0) * hq;
    float dh = sdRoundBox(hq, vec2(0.070, 0.044), 0.014);
    float dh2 = length(q - vec2(-0.095, 0.085)) - 0.014;
    float hl = (1.0 - smoothstep(-px, px, min(dh, dh2))) * (1.0 - smoothstep(0.0, 0.22, u_open));
    Y *= 1.0 - hl; B *= 1.0 - hl; K *= 1.0 - hl;
  }

  // ---- pupil: a horizontal rounded bar, with a hairline of bare paper around it
  float lidCover = outside > 0.0 ? 1.0 - smoothstep(0.02, 0.16, u_open) : 0.0;
  vec2 qp = rot(u_tilt) * (q - u_pupilC);
  float dp = sdRoundBox(qp, u_pupilH, u_pupilR);
  float pupil = (1.0 - smoothstep(-px, px, dp)) * (1.0 - lidCover);
  float hairW = 0.0030 + 0.0012 * u_open;
  float hair = (1.0 - smoothstep(-px, px, abs(dp - (0.010 + hairW)) - hairW)) * (1.0 - lidCover);
  // nothing prints under the pupil, so the black stays one flat black behind the text
  Y *= (1.0 - hair) * (1.0 - pupil); B *= (1.0 - hair) * (1.0 - pupil);
  K = max(K * (1.0 - hair), pupil);
  return vec3(Y, B, K);
}

float sm01(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }

// A small eye for the wall: lids, iris with 60 rays, limbal ring, pupil bar, highlight and a few
// contour lines. gz is the iris offset, blink 0..1, wide scales the lid opening.
vec3 smallEye(vec2 q, float px, vec2 gz, float blink, float wide, float seed) {
  const float W = 0.66;
  float xn = clamp(q.x / W, -1.0, 1.0);
  float k = 1.0 - xn * xn;
  float upOpen = 0.292 * pow(k, 0.70) * wide + 0.040 * xn * k;
  float loOpen = -0.250 * pow(k, 0.86) * wide + 0.022 * xn * k;
  float meet = -0.035 * k;
  float up = mix(upOpen, meet + 0.002, blink);
  float lo = mix(loOpen, meet - 0.002, blink);
  float side = max(abs(q.x) - W, 0.0);
  float dUp = q.y - up;
  float lidGap = max(dUp, lo - q.y);
  float outside = side > 0.0 ? length(vec2(side, lidGap)) : lidGap;
  float Y = 0.0, B = 0.0, K = 0.0;
  if (outside > 0.0) {
    // four contour lines hugging the lids, then bare paper
    const float F = 34.0;
    float line = lineScreen(outside * F, 0.55, px * F);
    B = line * smoothstep(0.030 - px, 0.030 + px, outside) * (1.0 - smoothstep(0.145 - px, 0.145 + px, outside));
    K = 1.0 - smoothstep(0.020 - px, 0.020 + px, outside);
  } else {
    float din = -outside;
    vec2 qi = q - gz;
    float r = length(qi);
    float a = atan(qi.y, qi.x);
    const float RI = 0.43;
    if (r < RI) {
      float inner = RI * 0.58;
      float full = smoothstep(inner - px, inner + px, r);
      float pale = lineScreen((qi.x - qi.y) * 42.0, 0.5, px * 42.0);
      Y = mix(pale, 1.0, full);
      const float N = 60.0;
      float la = a / TAU * N;
      float id = mod(floor(la), N);
      float r1 = hash11(id + 11.0 + seed);
      float r2 = hash11(id + 57.0);
      float ray = lineScreen(la, 0.20 + 0.28 * r2, px / (max(r, 0.02) * TAU) * N);
      K = ray * step(RI * (0.60 + 0.28 * r1), r);
      float limb = RI * 0.90;
      K = max(K, smoothstep(limb - px, limb + px, r));
    }
    // shadow of the upper lid: one band of blue hatch
    float under = -dUp;
    B = lineScreen(q.y * 56.0, under < 0.06 ? 0.70 : 0.0, px * 56.0);
    K = max(K, 1.0 - smoothstep(0.012 - px, 0.012 + px, din));
    // highlight
    vec2 hq = mat2(1.0, 0.0, 0.30, 1.0) * (q - vec2(-0.200, 0.158));
    float hl = 1.0 - smoothstep(-px, px, sdRoundBox(hq, vec2(0.070, 0.044), 0.014));
    Y *= 1.0 - hl; B *= 1.0 - hl; K *= 1.0 - hl;
    // pupil bar with a hairline of bare paper
    float dp = sdRoundBox(q - gz * 1.1, vec2(0.30, 0.075), 0.035);
    float pupil = 1.0 - smoothstep(-px, px, dp);
    float hair = 1.0 - smoothstep(-px, px, abs(dp - 0.024) - 0.011);
    Y *= (1.0 - hair) * (1.0 - pupil); B *= (1.0 - hair) * (1.0 - pupil);
    K = max(K * (1.0 - hair), pupil);
  }
  return vec3(Y, B, K);
}

void main() {
  float m = min(u_res.x, u_res.y);
  vec3 ink = vec3(0.0);

  // ---- the big eye: full detail, only where it can draw something
  vec2 q = ((gl_FragCoord.xy - 0.5 * u_res) / m - u_center) / u_scale;
  float px = 1.0 / (m * u_scale);
  if ((abs(q.x) < 0.95 && abs(q.y) < 0.62) || u_open > 0.3) {
    float reg = 1.5 * px * m / 900.0;
    ink.x = plates(q + vec2(reg, -0.6 * reg), px).x;
    ink.y = plates(q + vec2(-0.8 * reg, reg), px).y;
    ink.z = plates(q, px).z;
  }

  // ---- the wall: a staggered grid, one small eye per cell, nothing under the big eye
  vec2 fc = gl_FragCoord.xy / u_dpr;
  float W = u_res.x / u_dpr, H = u_res.y / u_dpr;
  float row = floor((H - fc.y) / u_cell.y);
  float off = 0.5 * W - 0.5 * u_cell.x + mod(row, 2.0) * 0.5 * u_cell.x;
  float colI = floor((fc.x - off) / u_cell.x);
  vec2 cc = vec2((colI + 0.5) * u_cell.x + off, H - (row + 0.5) * u_cell.y);
  vec2 half_ = 0.5 * vec2(W, H);
  vec2 dc = abs(cc - half_);
  if (!(dc.x < u_excl.x && dc.y < u_excl.y)) {
    float sc = u_cell.x * 0.575;
    vec2 q2 = (fc - cc) / sc;
    if (abs(q2.x) < 0.83 && abs(q2.y) < 0.50) {
      vec2 id = vec2(colI, row);
      float h1 = hash21(id + vec2(1.7, 3.1));
      float h2 = hash21(id + vec2(8.3, 2.9));
      float h3 = hash21(id + vec2(5.1, 9.7));
      float h4 = hash21(id + vec2(2.3, 6.1));
      // blink: a quick one every 3 to 7 seconds, on its own clock
      float T = 3.0 + 4.0 * h1;
      float ph = mod(u_time + h2 * T, T);
      float bl = ph < 0.09 ? sm01(ph / 0.09) : ph < 0.14 ? 1.0 : ph < 0.40 ? 1.0 - sm01((ph - 0.14) / 0.26) : 0.0;
      float droop = 0.03 + 0.20 * h3 * h3;
      // the wave that shuts the wall from the edges inward as the page opens
      float e = clamp(length((cc - half_) / half_) / 1.1, 0.0, 1.0);
      float wave = clamp(u_open * 2.0 - (1.0 - e), 0.0, 1.0);
      float blink = max(max(bl, droop), wave);
      // every eye looks toward the pointer from where it sits
      vec2 dv = u_ptr - cc;
      float dist = length(dv);
      vec2 g = dv / max(dist, 1.0) * min(dist / 260.0, 1.0);
      float wide = 1.0 + 0.35 * smoothstep(170.0, 40.0, dist);
      vec3 s = smallEye(q2, 1.0 / (sc * u_dpr), g * vec2(0.27, 0.11), blink, wide, h4 * 40.0);
      if (h4 < 0.25) s.xy = s.yx;
      ink = max(ink, s);
    }
  }

  vec2 fp = gl_FragCoord.xy;
  vec3 col = PAPER * (0.955 + 0.060 * fbm(fp * 0.35));
  col *= mix(vec3(1.0), INK_Y, ink.x * (0.90 + 0.10 * vnoise(fp * 0.80)));
  col *= mix(vec3(1.0), INK_B, ink.y * (0.84 + 0.16 * vnoise(fp * 0.55 + 31.0)));
  col *= mix(vec3(1.0), INK_K, ink.z);
  outColor = vec4(col, 1.0);
}`;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

// resting pupil half size and iris travel, in units of the short side
const GAZE_REACH = [0.07, 0.042];
const ZOOM_WHEN_OPEN = 2.7;

export function createEye(canvas, { dpr = 1, onLost } = {}) {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  });
  if (!gl) return null;

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error('eye shader: ' + log);
    }
    return sh;
  };
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('eye link: ' + gl.getProgramInfoLog(prog));
  } catch (err) {
    console.error(err);
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  for (const n of ['res', 'center', 'scale', 'iris', 'pupilC', 'pupilH', 'pupilR', 'blink', 'open', 'tilt', 'seed', 'dpr', 'cell', 'excl', 'ptr', 'time', 'skin']) {
    U[n] = gl.getUniformLocation(prog, 'u_' + n);
  }
  gl.uniform1f(U.seed, 3.7);

  const state = {
    open: 0, // 0 resting eye, 1 pupil frames the page
    tilt: 0, // radians
    center: [0, 0], // eye centre in units of the short side, +y up
    scale: 1, // resting size of the eye
    margin: 16, // css px of iris left showing around the fully open pupil
    cornerRadius: 26, // css px, corner of the fully open pupil
    autoBlink: true,
    pupilHalf: [0.42, 0.1],
    cell: [290, 230],
    excl: [350, 190],
    skin: 0.2,
    still: false, // true freezes gaze wander and blinking (reduced motion)
  };
  let w = 1;
  let h = 1;
  let lost = false;
  const gaze = [0, 0];
  const look = [0, 0];
  const micro = [0, 0];
  const ptr = [0, 0];
  let nextMicro = 0;
  let hasPointer = false;
  let lastPointerAt = -10;
  let nextWander = 0;
  let blinkStart = -1;
  let nextBlink = 2.2;
  let blinkValue = 0;
  let rect = { x: 0, y: 0, w: 0, h: 0, r: 0 };
  let now = 0;

  function resize() {
    const cw = canvas.clientWidth || window.innerWidth;
    const ch = canvas.clientHeight || window.innerHeight;
    w = cw;
    h = ch;
    const pw = Math.max(1, Math.round(cw * dpr));
    const ph = Math.max(1, Math.round(ch * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    gl.viewport(0, 0, pw, ph);
  }

  function lookAt(clientX, clientY) {
    const m = Math.min(w, h);
    const ex = w / 2 + state.center[0] * m;
    const ey = h / 2 - state.center[1] * m;
    look[0] = clamp((clientX - ex) / (0.55 * m), -1, 1);
    look[1] = clamp(-(clientY - ey) / (0.55 * m), -1, 1);
    hasPointer = true;
    lastPointerAt = now;
    ptr[0] = clientX;
    ptr[1] = clientY;
  }

  function blink() {
    if (blinkStart < 0) blinkStart = now;
  }

  function stepBlink(t) {
    if (state.still) return 0;
    if (state.autoBlink && blinkStart < 0 && t > nextBlink && state.open < 0.04) {
      blinkStart = t;
      nextBlink = t + (Math.random() < 0.18 ? 0.42 : 2.6 + Math.random() * 4.6);
    }
    if (blinkStart < 0) return 0;
    const x = t - blinkStart;
    if (x < 0.075) return smooth(x / 0.075);
    if (x < 0.115) return 1;
    if (x < 0.3) return 1 - smooth((x - 0.115) / 0.185);
    blinkStart = -1;
    return 0;
  }

  function stepGaze(t, dt) {
    if (state.still) return;
    // with no pointer (phones, or a mouse left alone) the eye looks around by itself
    if (!hasPointer || t - lastPointerAt > 4) {
      if (t > nextWander) {
        look[0] = (Math.random() * 2 - 1) * 0.8;
        look[1] = (Math.random() * 2 - 1) * 0.45;
        nextWander = t + 0.9 + Math.random() * 2.4;
      }
    }
    // small saccades on top of the main gaze
    if (t > nextMicro) {
      micro[0] = (Math.random() * 2 - 1) * 0.07;
      micro[1] = (Math.random() * 2 - 1) * 0.05;
      nextMicro = t + 0.5 + Math.random() * 1.9;
    }
    const k = 1 - Math.exp(-dt * 16);
    gaze[0] += (look[0] + micro[0] - gaze[0]) * k;
    gaze[1] += (look[1] + micro[1] - gaze[1]) * k;
  }

  function layout() {
    const m = Math.min(w, h);
    const e = smooth(clamp(state.open, 0, 1));
    const scale = state.scale * lerp(1, ZOOM_WHEN_OPEN, e);
    const cx = state.center[0] * (1 - e);
    const cy = state.center[1] * (1 - e);
    const ix = gaze[0] * GAZE_REACH[0] * (1 - e);
    const iy = gaze[1] * GAZE_REACH[1] * (1 - e);
    // pupil in css px: resting inside the iris, fully open it is the viewport minus a margin
    const restHalf = [state.pupilHalf[0] * m * state.scale, state.pupilHalf[1] * m * state.scale];
    const restC = [w / 2 + (cx + ix * 1.1 * scale) * m, h / 2 - (cy + iy * 1.1 * scale) * m];
    const half = [lerp(restHalf[0], w / 2 - state.margin, e), lerp(restHalf[1], h / 2 - state.margin, e)];
    const c = [lerp(restC[0], w / 2, e), lerp(restC[1], h / 2, e)];
    const radius = lerp(restHalf[1] * 0.52, state.cornerRadius, e);
    rect = { x: c[0] - half[0], y: c[1] - half[1], w: half[0] * 2, h: half[1] * 2, r: radius };
    return {
      scale,
      center: [cx, cy],
      iris: [ix, iy],
      pupilC: [((c[0] - w / 2) / m - cx) / scale, ((h / 2 - c[1]) / m - cy) / scale],
      pupilH: [half[0] / (m * scale), half[1] / (m * scale)],
      pupilR: radius / (m * scale),
    };
  }

  function render(t = 0, dt = 0.016) {
    if (lost) return;
    now = t;
    stepGaze(t, dt);
    blinkValue = stepBlink(t);
    const L = layout();
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform2f(U.center, L.center[0], L.center[1]);
    gl.uniform1f(U.scale, L.scale);
    gl.uniform2f(U.iris, L.iris[0], L.iris[1]);
    gl.uniform2f(U.pupilC, L.pupilC[0], L.pupilC[1]);
    gl.uniform2f(U.pupilH, L.pupilH[0], L.pupilH[1]);
    gl.uniform1f(U.pupilR, L.pupilR);
    gl.uniform1f(U.blink, blinkValue);
    gl.uniform1f(U.open, clamp(state.open, 0, 1));
    gl.uniform1f(U.tilt, state.tilt);
    gl.uniform1f(U.dpr, canvas.width / w);
    gl.uniform2f(U.cell, state.cell[0], state.cell[1]);
    gl.uniform2f(U.excl, state.excl[0], state.excl[1]);
    gl.uniform2f(U.ptr, ptr[0], h - ptr[1]);
    gl.uniform1f(U.time, t);
    gl.uniform1f(U.skin, state.skin);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    if (onLost) onLost();
  });

  resize();
  return {
    state,
    resize,
    render,
    lookAt,
    blink,
    setPointer: (x, y) => { ptr[0] = x; ptr[1] = y; },
    pupilRect: () => rect,
    blinkAmount: () => blinkValue,
  };
}
