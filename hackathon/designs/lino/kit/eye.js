// LINO KIT: the goat eye as a block print. Shared by every Lino site.
// One fragment shader: a key block (ink) and one colour block on paper, cut by hand.
// The pupil is a horizontal rounded bar. It follows the pointer and blinks.
//
// Use:
//   const eye = createEye(canvas, { dpr, palette });  // returns null when WebGL2 is missing
//   eye.setPalette({ paper: '#ebe3cf', ink: '#121110', block: '#E0301E' });
//   eye.lookAt(clientX, clientY);                // css pixels
//   eye.blink();
//   eye.render(timeSeconds, deltaSeconds);       // call every frame, or once per change
//   eye.pupilRect();                             // {x, y, w, h, r} in css pixels, for DOM overlays
//
// eye.state, all plain numbers you set before render():
//   open   0..1  the pupil bar widens until it frames the page (the ink roller of the mock)
//   flood  0..1  the colour block grows from the pupil until it covers the screen; the pupil bar
//                and its bare outline stay on top
//   lid    0..1  forced closure. 1 is the eye shut (pupil and iris hidden)
//   passY  0..1  how far the colour block has been rolled on, left to right (1 = fully printed)
//   passK  0..1  the same for the key block
//   lineGain     1 normal. Below 1 thins the bare lines carved in the skin (Night reverse)
//   scleraShade  0 normal. Above 0 lays a hatch over the white of the eye (Night reverse)
//   center, scale, tilt, still, autoBlink: as before
//
// Builders: call this module, do not edit it. Changes go through the main thread.

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 u_res;
uniform vec2 u_center;
uniform float u_scale;
uniform vec2 u_iris;
uniform vec2 u_pupilC;
uniform vec2 u_pupilH;
uniform float u_pupilR;
uniform float u_blink;
uniform float u_open;
uniform float u_tilt;
uniform float u_seed;
uniform vec3 u_paper;
uniform vec3 u_ink;
uniform vec3 u_block;
uniform float u_floodR;
uniform float u_passY;
uniform float u_passK;
uniform float u_lineGain;
uniform float u_sclera;

const float TAU = 6.28318530718;
const float RI = 0.43;

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

// A ruled line screen: c in line units, duty is the share removed or inked, aa one pixel in line units.
float lineScreen(float c, float duty, float aa) {
  if (duty <= 0.001) return 0.0;
  if (duty >= 0.999) return 1.0;
  float f = abs(fract(c) - 0.5);
  aa = min(aa, 0.5);
  return 1.0 - smoothstep(duty * 0.5 - aa, duty * 0.5 + aa, f);
}

// Eyelids. Returns the distance outside the eye opening (negative inside).
float lids(vec2 q, out float dUp, out float dLo, out float k) {
  const float W = 0.66;
  float xn = clamp(q.x / W, -1.0, 1.0);
  k = 1.0 - xn * xn;
  float upOpen = 0.292 * pow(k, 0.70) + 0.040 * xn * k;
  float loOpen = -0.250 * pow(k, 0.86) + 0.022 * xn * k;
  float meet = -0.035 * k;
  float up = mix(upOpen, meet + 0.002, u_blink);
  float lo = mix(loOpen, meet - 0.002, u_blink);
  float side = max(abs(q.x) - W, 0.0);
  dUp = q.y - up;
  dLo = lo - q.y;
  float lidGap = max(dUp, dLo);
  return side > 0.0 ? length(vec2(side, lidGap)) : lidGap;
}

// The pupil bar and the bare gap cut around it, both with a rough hand edge.
// knock is everything inside the outer edge of the gap, plus a small trap: the colour block is
// cut away there, so no colour can show as a rim round the bar.
void pupilMasks(vec2 q, float px, float outside, out float pupil, out float hair, out float knock) {
  // the lids hide the pupil at rest; once the bar opens or the colour floods, it sits on top
  float lidCover = outside > 0.0 ? (1.0 - smoothstep(0.02, 0.16, u_open)) * (1.0 - smoothstep(0.0, 0.05, u_floodR)) : 0.0;
  vec2 qp = rot(u_tilt) * (q - u_pupilC);
  float dp = sdRoundBox(qp, u_pupilH, u_pupilR) + 0.0045 * (vnoise(qp * 34.0) - 0.5) + 0.005 * (vnoise(qp * 8.0 + 3.0) - 0.5);
  pupil = (1.0 - smoothstep(-px, px, dp)) * (1.0 - lidCover);
  float hw = 0.0055 + 0.0020 * u_open;
  hair = (1.0 - smoothstep(-px, px, abs(dp - (0.014 + hw)) - hw)) * (1.0 - lidCover);
  knock = (1.0 - smoothstep(-px, px, dp - (0.014 + 2.0 * hw) - 0.0025)) * (1.0 - lidCover);
}

// The catchlight: two short slanted cuts. Both blocks are cut at this same place.
float highlight(vec2 q, float px) {
  mat2 lean = rot(0.95);
  vec2 a = lean * (q - vec2(-0.232, 0.150));
  float d1 = sdRoundBox(a, vec2(0.050, 0.0100), 0.0095) + 0.005 * (vnoise(q * 40.0) - 0.5);
  vec2 b = lean * (q - vec2(-0.176, 0.136));
  float d2 = sdRoundBox(b, vec2(0.025, 0.0075), 0.0070) + 0.004 * (vnoise(q * 52.0 + 9.0) - 0.5);
  return (1.0 - smoothstep(-px, px, min(d1, d2))) * (1.0 - smoothstep(0.0, 0.22, u_open));
}

// The flooding colour block: a rough disc that grows from the pupil. Negative inside.
float floodDist(vec2 q) {
  vec2 c = q - u_pupilC;
  float r = length(c);
  float a = atan(c.y, c.x);
  float rag = u_floodR * 0.06 * (anoise(a, 26.0, 5.0) - 0.5) + 0.034 * (fbm(q * 3.1 + 2.0) - 0.5) + 0.008 * (vnoise(q * 30.0) - 0.5);
  return r - u_floodR - rag * smoothstep(0.0, 0.12, u_floodR);
}

// One pull of the roller, left to right. Returns how much of the block is on the paper here;
// lead is 1 at the wet edge and 0 well behind it.
float rollOn(vec2 fc, float pass, float seed, out float lead) {
  float u = fc.x / u_res.x;
  float yy = fc.y / u_res.y;
  float rag = 0.030 * (vnoise(vec2(yy * 9.0, seed)) - 0.5) + 0.010 * (vnoise(vec2(yy * 60.0, seed + 3.0)) - 0.5);
  float e = pass * 1.10 - 0.05 + rag;
  lead = pass >= 0.999 ? 0.0 : 1.0 - smoothstep(0.0, 0.09, e - u);
  return 1.0 - smoothstep(-0.0012, 0.0012, u - e);
}

// Black block: everything left standing after the gouge.
float plateK(vec2 q, float px) {
  float dUp, dLo, k;
  float outside = lids(q, dUp, dLo, k);
  float pupil, hair, knock;
  pupilMasks(q, px, outside, pupil, hair, knock);
  float K = 0.0;

  if (outside > 0.0) {
    // skin: solid black, the contour lines are gouged out as bare paper
    float d = outside + 0.026 * (fbm(q * 2.3 + u_seed) - 0.5) + 0.006 * (vnoise(q * 14.0 + u_seed) - 0.5)
            + 0.004 * (vnoise(q * 48.0) - 0.5);
    float tone = d < 0.075 ? 0.0 : d < 0.17 ? 0.62 : d < 0.31 ? 0.50 : d < 0.49 ? 0.38 : 0.27;
    const float FREQ = 22.0;
    float c = d * FREQ;
    float id = floor(c);
    float lw = 0.65 + 0.75 * hash11(id + 3.0);
    float wob = 0.55 + 0.90 * fbm(q * 3.5 + 3.0);
    float brk = smoothstep(0.16, 0.34, vnoise(vec2(q.x * 5.0 + id * 5.3, id * 1.7)));
    float duty = min(tone * lw * wob * brk * u_lineGain, 0.92);
    float carve = lineScreen(c, duty, px * FREQ);
    // the first gouge near the lid, a bare line that frames the eye
    float gap = abs(d - 0.045) - 0.011 * mix(0.55, 1.0, clamp(u_lineGain, 0.0, 1.0)) * (0.7 + 0.6 * vnoise(q * 9.0));
    carve = max(carve, 1.0 - smoothstep(-px, px, gap));
    // the fold above the upper lid and a lighter one below
    float fold = abs(dUp - (0.110 + 0.030 * k)) - (0.011 * k * k);
    carve = max(carve, (1.0 - smoothstep(-px, px, fold)) * step(0.0, dUp) * step(0.12, k));
    float fold2 = abs(dLo - (0.085 + 0.018 * k)) - (0.006 * k * k);
    carve = max(carve, (1.0 - smoothstep(-px, px, fold2)) * step(0.0, dLo) * step(0.30, k));
    // chatter marks: short flecks left in the cleared paper, running along the cut
    float fleck = step(0.86, vnoise(vec2(q.x * 15.0, q.y * 140.0) + u_seed)) * step(0.40, vnoise(q * 4.0 + 7.0));
    K = max(1.0 - carve, fleck * carve);
  } else {
    float din = -outside;
    // shadow of the upper lid: coarse black hatch
    float under = -dUp;
    float tone = under < 0.040 ? 0.75 : under < 0.095 ? 0.40 : 0.0;
    float yy = q.y + 0.008 * (fbm(q * 9.0) - 0.5);
    K = lineScreen(yy * 30.0, tone * (0.7 + 0.6 * fbm(q * 5.0 + 1.0)), px * 30.0);
    vec2 qi = rot(u_tilt) * (q - u_iris);
    float r = length(qi);
    float a = atan(qi.y, qi.x);
    if (r < RI) {
      float inner = RI * (0.56 + 0.075 * anoise(a, 34.0, 9.0));
      // few fat rays, each tapering toward the pupil
      const float N = 64.0;
      float la = a / TAU * N;
      float id = mod(floor(la), N);
      float r1 = hash11(id + 11.0);
      float r2 = hash11(id + 57.0);
      float t = clamp((r - inner) / (RI - inner), 0.0, 1.0);
      float jit = 0.30 * (vnoise(vec2(r * 16.0, id)) - 0.5);
      float aaA = px / (max(r, 0.02) * TAU) * N;
      float duty = min((0.30 + 0.50 * r2) * mix(0.10, 1.0, t), 0.85);
      float ray = lineScreen(la + jit, duty, aaA);
      float lives = step(RI * (0.48 + 0.34 * r1), r);
      K = max(K, ray * lives);
      // fat limbal ring with a ragged inner edge
      float limb = RI * (0.80 - 0.05 * anoise(a, 60.0, 3.0)) + 0.010 * (vnoise(vec2(a * 7.0, r * 40.0)) - 0.5);
      K = max(K, smoothstep(limb - px, limb + px, r));
    } else if (u_sclera > 0.0) {
      // Night reverse: a dense slanted hatch over the white of the eye
      float sc = (q.y + q.x * 0.55) * 54.0 + 0.7 * fbm(q * 6.0);
      K = max(K, lineScreen(sc, u_sclera * (0.78 + 0.34 * fbm(q * 4.0 + 2.0)), px * 54.0 * 1.15));
    }
    // heavy inner edge of the lid
    float rim = din + 0.007 * (vnoise(q * 28.0) - 0.5);
    K = max(K, 1.0 - smoothstep(0.022 - px, 0.022 + px, rim));
    K *= 1.0 - highlight(q, px);
  }
  // the flooding colour block prints over the key block, with a bare cut line round its edge
  if (u_floodR > 0.0005) K *= smoothstep(-px, px, floodDist(q) - 0.013);
  K = max(K * (1.0 - hair), pupil);
  return K;
}

// Colour block: the iris disc, with a rough cut edge. q is where this block landed on the paper
// (a little off register), q0 is the true position: the cuts for the pupil and the catchlight
// use q0 so they line up with the key block.
float plateY(vec2 q, vec2 q0, float px) {
  float dUp, dLo, k;
  float outside = lids(q, dUp, dLo, k);
  vec2 qi = rot(u_tilt) * (q - u_iris);
  float r = length(qi);
  float a = atan(qi.y, qi.x);
  float ry = RI * 0.985 + RI * 0.07 * (anoise(a, 26.0, 5.0) - 0.5) + 0.010 * (vnoise(vec2(a * 6.0, r * 30.0)) - 0.5);
  float disc = 1.0 - smoothstep(ry - px, ry + px, r);
  float Y = disc * (1.0 - smoothstep(-px, px, outside)) * (1.0 - highlight(q0, px));
  if (u_floodR > 0.0005) Y = max(Y, 1.0 - smoothstep(-px, px, floodDist(q)));
  float dUp0, dLo0, k0;
  float outside0 = lids(q0, dUp0, dLo0, k0);
  float pupil, hair, knock;
  pupilMasks(q0, px, outside0, pupil, hair, knock);
  Y *= 1.0 - knock;
  return Y;
}

void main() {
  float m = min(u_res.x, u_res.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / m;
  vec2 q = (p - u_center) / u_scale;
  float px = 1.0 / (m * u_scale);

  // the colour block is printed 3 to 4 pixels off register from the key block
  float reg = 3.5 * px * clamp(m / 800.0, 0.9, 1.6);
  float Y = plateY(q + vec2(reg * 0.9, -reg * 0.5), q, px);
  float K = plateK(q, px);

  vec2 fc = gl_FragCoord.xy;
  // roller passes: each block can be part way on, with dry streaks at the wet edge
  float leadY, leadK;
  Y *= rollOn(fc, u_passY, 3.0, leadY);
  K *= rollOn(fc, u_passK, 11.0, leadK);
  Y *= 1.0 - 0.85 * leadY * step(0.52, vnoise(vec2(fc.x * 0.012, fc.y * 0.55) + 3.0));
  K *= 1.0 - 0.85 * leadK * step(0.52, vnoise(vec2(fc.x * 0.012, fc.y * 0.55) + 11.0));

  // bone paper with fibre grain
  vec2 fa = vec2(dot(fc, vec2(0.97, 0.26)), dot(fc, vec2(-0.26, 0.97)));
  float fibre = vnoise(vec2(fa.x * 0.035, fa.y * 0.85));
  float fibre2 = vnoise(vec2(fa.x * 0.9, fa.y * 0.05) + 19.0);
  vec3 col = u_paper * (0.945 + 0.050 * fbm(fc * 0.30) + 0.045 * fibre - 0.030 * fibre2);
  col *= 1.0 - 0.10 * step(0.985, hash21(floor(fc * vec2(0.5, 0.5)))) * step(0.5, fibre);

  // the colour block, a little uneven
  col = mix(col, u_block, Y * (0.90 + 0.10 * vnoise(fc * 0.7)));

  // black: mottled, with salt (specks of paper through solid ink)
  float mot = mix(0.86, 1.0, clamp(0.55 * fbm(fc * 0.045 + 5.0) + 0.45 * vnoise(fc * 0.35) + 0.15, 0.0, 1.0));
  float salt = step(0.972, hash21(floor(fc * 0.8) + 3.0));
  salt = max(salt, step(0.955, vnoise(fc * 0.22 + 40.0)) * step(0.45, hash21(floor(fc * 0.6))));
  col = mix(col, u_ink, K * mot * (1.0 - salt));
  outColor = vec4(col, 1.0);
}`;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

// resting pupil half size and iris travel, in units of the short side
const PUPIL_HALF = [0.33, 0.078];
const GAZE_REACH = [0.07, 0.042];
const ZOOM_WHEN_OPEN = 2.7;

// '#rrggbb' or [r, g, b] in 0..1
function rgb(c) {
  if (Array.isArray(c)) return c;
  const n = parseInt(String(c).replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export const PALETTES = {
  original: { paper: '#ebe3cf', ink: '#121110', block: '#f0b90a' },
  newyear: { paper: '#ebe3cf', ink: '#121110', block: '#E0301E' },
  indigo: { paper: '#ebe3cf', ink: '#1B2C6B', block: '#f0b90a' },
  gold: { paper: '#f0b90a', ink: '#121110', block: '#E0301E' },
};

export function createEye(canvas, { dpr = 1, onLost, palette = PALETTES.original } = {}) {
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
  for (const n of ['res', 'center', 'scale', 'iris', 'pupilC', 'pupilH', 'pupilR', 'blink', 'open', 'tilt', 'seed',
    'paper', 'ink', 'block', 'floodR', 'passY', 'passK', 'lineGain', 'sclera']) {
    U[n] = gl.getUniformLocation(prog, 'u_' + n);
  }
  gl.uniform1f(U.seed, 3.7);

  function setPalette(p = {}) {
    if (p.paper) gl.uniform3fv(U.paper, rgb(p.paper));
    if (p.ink) gl.uniform3fv(U.ink, rgb(p.ink));
    if (p.block) gl.uniform3fv(U.block, rgb(p.block));
  }
  setPalette({ ...PALETTES.original, ...palette });

  const state = {
    open: 0, // 0 resting eye, 1 pupil frames the page
    flood: 0, // 0 resting eye, 1 the colour block covers the screen
    lid: 0, // 1 holds the eye shut
    passY: 1, // colour block rolled on, 0..1
    passK: 1, // key block rolled on, 0..1
    lineGain: 1, // below 1 thins the carved skin lines
    scleraShade: 0, // above 0 hatches the white of the eye
    tilt: 0, // radians
    center: [0, 0], // eye centre in units of the short side, +y up
    scale: 1, // resting size of the eye
    margin: 16, // css px of iris left showing around the fully open pupil
    cornerRadius: 26, // css px, corner of the fully open pupil
    autoBlink: true,
    still: false, // true freezes gaze wander and blinking (reduced motion)
  };
  let w = 1;
  let h = 1;
  let lost = false;
  const gaze = [0, 0];
  const look = [0, 0];
  const micro = [0, 0];
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
  }

  function blink() {
    if (blinkStart < 0) blinkStart = now;
  }

  function stepBlink(t) {
    if (state.still) return 0;
    if (state.autoBlink && blinkStart < 0 && t > nextBlink && state.open < 0.04 && state.flood < 0.02 && state.lid < 0.02) {
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
    const e = clamp(state.open, 0, 1);
    // ink roller: first the bar runs out to the full width, then it grows in height
    const e1 = smooth(clamp(e / 0.5, 0, 1));
    const e2 = smooth(clamp((e - 0.5) / 0.5, 0, 1));
    const f = clamp(state.flood, 0, 1);
    // the gaze settles to the middle as the colour floods, so the bar holds still
    const hold = (1 - e1) * (1 - smooth(clamp(f / 0.35, 0, 1)));
    const scale = state.scale * lerp(1, 1.25, e);
    const cx = state.center[0] * (1 - e);
    const cy = state.center[1] * (1 - e);
    const ix = gaze[0] * GAZE_REACH[0] * hold;
    const iy = gaze[1] * GAZE_REACH[1] * hold;
    const restHalf = [PUPIL_HALF[0] * m * state.scale, PUPIL_HALF[1] * m * state.scale];
    const restC = [w / 2 + (state.center[0] + ix * 1.1 * state.scale) * m, h / 2 - (state.center[1] + iy * 1.1 * state.scale) * m];
    const half = [lerp(restHalf[0], w / 2 + 40, e1), lerp(restHalf[1], h / 2 + 40, e2)];
    const c = [lerp(restC[0], w / 2, e1), lerp(restC[1], h / 2, e2)];
    const radius = 3;
    rect = { x: c[0] - half[0], y: c[1] - half[1], w: half[0] * 2, h: half[1] * 2, r: radius };
    // flood radius: far enough at 1 to pass the farthest corner, slow to start
    const far = Math.hypot(Math.max(c[0], w - c[0]), Math.max(c[1], h - c[1])) / (m * scale);
    const floodR = f <= 0 ? 0 : far * 1.16 * Math.pow(f, 1.35);
    return {
      floodR,
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
    gl.uniform1f(U.blink, Math.max(blinkValue, clamp(state.lid, 0, 1)));
    gl.uniform1f(U.open, clamp(state.open, 0, 1));
    gl.uniform1f(U.floodR, L.floodR);
    gl.uniform1f(U.passY, clamp(state.passY, 0, 1));
    gl.uniform1f(U.passK, clamp(state.passK, 0, 1));
    gl.uniform1f(U.lineGain, Math.max(0, state.lineGain));
    gl.uniform1f(U.sclera, clamp(state.scleraShade, 0, 1));
    gl.uniform1f(U.tilt, state.tilt);
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
    setPalette,
    lookAt,
    blink,
    pupilRect: () => rect,
    blinkAmount: () => blinkValue,
  };
}
