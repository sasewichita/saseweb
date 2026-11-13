// TORCH: the goat eye as a relief in the dark, lit only by one small flame at the pointer.
// The print plates become a height map: black marks are ridges, blue lines are shallow grooves,
// the iris is a slight dome, the pupil is a deep slot.
// Extra use: eye.setLight(clientX, clientY); eye.getLight() gives the smoothed flame in css px.
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
uniform vec2 u_light;    // the flame, in units of the short side from the screen centre, +y up
uniform float u_power;   // flame flicker
uniform float u_time;

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
vec3 plates(vec2 q, float px, out float dome, out float pup) {
  float Y = 0.0, B = 0.0, K = 0.0;
  dome = 0.0;

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
    float tone = d < 0.050 ? 0.0 : d < 0.135 ? 0.80 : d < 0.270 ? 0.56 : d < 0.440 ? 0.33 : 0.15;
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
      dome = 1.0 - (r / RI) * (r / RI);
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
  pup = pupil;
  return vec3(Y, B, K);
}

const float LIGHT_H = 0.085;

// raking point light at the flame; p and the light are in screen short-side units
vec3 shade(vec3 albedo, vec3 N, vec2 g, float h, float ambient) {
  vec3 to = vec3(u_light - g, LIGHT_H - h);
  float d2 = dot(to, to);
  vec3 L = to * inversesqrt(d2);
  float att = u_power / (1.0 + d2 / 0.045);
  float bounce = u_power * 0.20 / (1.0 + d2 / 0.60);
  float diff = max(dot(N, L), 0.0);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(N, H), 0.0), 28.0);
  vec3 fl = vec3(1.0, 0.70, 0.40);
  return albedo * (ambient + fl * (diff * att * 3.4 + bounce)) + vec3(0.8, 0.6, 0.4) * fl * spec * att * 0.9;
}

float hgt(vec3 c, float dome, float pup) {
  return 0.0042 * c.z * (1.0 - pup) - 0.0016 * c.y + 0.006 * dome - 0.007 * pup;
}

// the flame sprite, wick at the light
vec3 flame(vec2 g) {
  float size = 0.058;
  vec2 q = (g - u_light) / size;
  q.y += 0.25;
  float t = u_time;
  q.x += (vnoise(vec2(q.y * 1.4 - t * 3.4, t * 1.1)) - 0.5) * 0.42 * smoothstep(-0.3, 1.1, q.y);
  float rise = clamp(q.y / 1.35, 0.0, 1.0);
  float halfW = q.y < 0.0 ? 0.40 * sqrt(max(1.0 - (q.y * q.y) / 0.16, 0.0)) : 0.40 * pow(1.0 - rise, 1.35);
  float inY = step(-0.40, q.y) * step(q.y, 1.35);
  float body = (halfW - abs(q.x)) * inY;
  float outer = smoothstep(0.0, 0.10, body);
  float mid = smoothstep(0.10, 0.24, body) * (1.0 - smoothstep(0.55, 1.0, rise));
  float core = smoothstep(0.20, 0.34, body) * (1.0 - smoothstep(0.20, 0.62, rise));
  vec3 c = vec3(1.0, 0.42, 0.06) * outer;
  c = mix(c, vec3(1.0, 0.80, 0.28), mid);
  c = mix(c, vec3(1.0, 0.97, 0.86), core);
  c = mix(c, vec3(0.20, 0.34, 1.0), outer * (1.0 - smoothstep(-0.38, -0.12, q.y)) * 0.8);
  float glow = exp(-dot(q * vec2(1.0, 0.62), q * vec2(1.0, 0.62)) * 0.55) * 0.20;
  return (c + vec3(1.0, 0.55, 0.20) * glow) * min(u_power, 1.2);
}

void main() {
  float m = min(u_res.x, u_res.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / m;
  vec2 q = (p - u_center) / u_scale;
  float px = 1.0 / (m * u_scale);
  float d = 1.5 * px;

  // height by central differences, plates sampled once per tap
  float dm, pm, d1, p1, d2, p2, d3, p3, d4, p4;
  vec3 c0 = plates(q, px, dm, pm);
  vec3 c1 = plates(q + vec2(d, 0.0), px, d1, p1);
  vec3 c2 = plates(q - vec2(d, 0.0), px, d2, p2);
  vec3 c3 = plates(q + vec2(0.0, d), px, d3, p3);
  vec3 c4 = plates(q - vec2(0.0, d), px, d4, p4);
  float h0 = hgt(c0, dm, pm);
  float dhx = (hgt(c1, d1, p1) - hgt(c2, d2, p2)) / (2.0 * d);
  float dhy = (hgt(c3, d3, p3) - hgt(c4, d4, p4)) / (2.0 * d);
  vec3 N = normalize(vec3(-dhx, -dhy, 1.0));

  // albedo: near-black blue slate, darker in grooves; the iris is the only colour
  vec3 slate = vec3(0.050, 0.070, 0.150);
  vec3 alb = slate * (1.0 - 0.55 * c0.y) * (1.0 + 0.30 * c0.z);
  float irisM = smoothstep(0.0, 0.04, dm);
  vec3 yel = vec3(1.0, 0.66, 0.03) * 1.3;
  alb = mix(alb, yel * (1.0 - 0.80 * c0.z), c0.x * irisM);
  vec3 lit = shade(alb, N, p, h0 * u_scale, 0.05) + vec3(0.004, 0.006, 0.014);

  // pupil: pure black, with a faint eyeshine when the flame is close
  vec2 lq = (u_light - u_center) / u_scale;
  float near = smoothstep(0.25, 0.07, length(lq - u_pupilC)) * (1.0 - u_open) * (1.0 - u_blink);
  vec2 qp = rot(u_tilt) * (q - u_pupilC);
  vec2 ps = qp / max(u_pupilH, vec2(0.0001));
  float shine = exp(-ps.x * ps.x * 2.4) * (0.5 + 0.5 * (1.0 - ps.y * ps.y)) * near * 0.35;
  vec3 pupCol = vec3(0.008, 0.011, 0.022) + vec3(0.80, 0.88, 0.42) * shine;
  // carried inside: when the pupil is the page, a pool of warm light stays on the dark
  vec2 dl = p - u_light;
  pupCol += vec3(1.0, 0.60, 0.28) * 0.07 * u_open / (1.0 + dot(dl, dl) / 0.04);

  vec3 col = mix(lit, pupCol, pm);
  col += flame(p);
  outColor = vec4(min(col, vec3(1.0)), 1.0);
}`;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

// resting pupil half size and iris travel, in units of the short side
const PUPIL_HALF = [0.33, 0.078];
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
  for (const n of ['res', 'center', 'scale', 'iris', 'pupilC', 'pupilH', 'pupilR', 'blink', 'open', 'tilt', 'seed', 'light', 'power', 'time']) {
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

  // the flame: follows the pointer, drifts on its own when idle, flickers
  let lightPx = [0, 0];
  let lightGoal = null;
  let lightSeen = -10;
  let lightInit = false;
  let power = 1;
  function setLight(clientX, clientY) {
    lightGoal = [clientX, clientY];
    lightSeen = now;
    if (!lightInit) {
      lightPx = [clientX, clientY];
      lightInit = true;
    }
  }
  function getLight() {
    return lightPx;
  }
  function stepLight(t, dt) {
    const m = Math.min(w, h);
    if (state.still) {
      // composed still frame: the flame rests to the left of the pupil
      lightPx = [w * 0.5 - m * 0.52 * state.scale, h * 0.5 - state.center[1] * m + m * 0.06];
      power = 1;
      return;
    }
    let goal = lightGoal;
    if (!goal || t - lightSeen > 3.5) {
      // idle: a slow loop around the eye
      const cx = w / 2 + state.center[0] * m;
      const cy = h / 2 - state.center[1] * m;
      const e = smooth(clamp(state.open, 0, 1));
      const rx = lerp(0.46 * m * state.scale, w * 0.36, e);
      const ry = lerp(0.27 * m * state.scale, h * 0.30, e);
      goal = [cx + Math.cos(t * 0.31) * rx, cy + Math.sin(t * 0.47 + 1) * ry];
    }
    if (!lightInit) {
      lightPx = goal.slice();
      lightInit = true;
    }
    const k = 1 - Math.exp(-dt * 7);
    lightPx[0] += (goal[0] - lightPx[0]) * k;
    lightPx[1] += (goal[1] - lightPx[1]) * k;
    power = 0.9 + 0.1 * Math.sin(t * 13.1) * Math.sin(t * 7.3 + 1.7) + 0.05 * Math.sin(t * 31.0);
  }

  function stepGaze(t, dt) {
    if (state.still) return;
    // the eye watches the flame
    const m = Math.min(w, h);
    const ex = w / 2 + state.center[0] * m;
    const ey = h / 2 - state.center[1] * m;
    look[0] = clamp((lightPx[0] - ex) / (0.55 * m), -1, 1);
    look[1] = clamp(-(lightPx[1] - ey) / (0.55 * m), -1, 1);
    if (t > nextMicro) {
      micro[0] = (Math.random() * 2 - 1) * 0.05;
      micro[1] = (Math.random() * 2 - 1) * 0.04;
      nextMicro = t + 0.5 + Math.random() * 1.9;
    }
    const k = 1 - Math.exp(-dt * 10);
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
    const restHalf = [PUPIL_HALF[0] * m * state.scale, PUPIL_HALF[1] * m * state.scale];
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
    stepLight(t, dt);
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
    const mm = Math.min(canvas.width, canvas.height) / dpr;
    gl.uniform2f(U.light, (lightPx[0] - w / 2) / mm, (h / 2 - lightPx[1]) / mm);
    gl.uniform1f(U.power, power);
    gl.uniform1f(U.time, t);
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
    setLight,
    getLight,
    blink,
    pupilRect: () => rect,
    blinkAmount: () => blinkValue,
  };
}
