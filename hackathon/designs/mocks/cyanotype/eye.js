// CYANOTYPE: the goat eye as a blueprint plate (thin white drafting lines on Prussian blue).
// One fragment shader, drawn as a technical drawing.
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
uniform float u_dpr;

const float TAU = 6.28318530718;
const vec3 LINE = vec3(0.875, 0.933, 1.0);
const vec3 NAVY_C = vec3(0.043, 0.165, 0.400);
const vec3 NAVY_E = vec3(0.027, 0.114, 0.290);
const vec3 PUPIL = vec3(0.016, 0.071, 0.200);
const float RI = 0.43;
float HW;

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
  for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s / 0.875;
}
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 d = abs(p) - b + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// coverage of a thin line, given the signed distance in device pixels
float cov(float dpx) { return 1.0 - smoothstep(HW - 0.55, HW + 0.55, abs(dpx)); }
// distance in device pixels from a smooth field d (eye units)
float dpxOf(float d) {
  float g = max(length(vec2(dFdx(d), dFdy(d))), 1e-7);
  return d / g;
}
// one grid line family, spacing sp in css px
float gridLine(float c, float sp) {
  float d = abs(mod(c + sp * 0.5, sp) - sp * 0.5);
  return 1.0 - smoothstep(0.5 - 0.5 / u_dpr, 0.5 + 0.5 / u_dpr, d);
}

void main() {
  HW = 0.62 * u_dpr;
  float m = min(u_res.x, u_res.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / m;
  vec2 q = (p - u_center) / u_scale;
  float px = 1.0 / (m * u_scale);

  // ---- ground: Prussian blue, uneven exposure, drafting grid
  vec2 sp = (gl_FragCoord.xy - 0.5 * u_res) / u_res;
  vec3 bg = mix(NAVY_C, NAVY_E, smoothstep(0.12, 0.78, length(sp)));
  vec2 cp = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) / u_dpr;
  bg *= 1.0 + 0.24 * (fbm(cp * 0.0038 + u_seed) - 0.5);
  float gm = max(gridLine(cp.x, 24.0), gridLine(cp.y, 24.0)) * 0.06;
  float gM = max(gridLine(cp.x, 120.0), gridLine(cp.y, 120.0)) * 0.12;
  bg = mix(bg, LINE, max(gm, gM));

  // ---- eyelid curves (same geometry as the baseline)
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
  float outside = side > 0.0 ? length(vec2(side, lidGap)) : lidGap;
  float inLid = 1.0 - smoothstep(-px, px, outside);
  float onX = step(abs(q.x), W + 2.0 * px);

  float L = 0.0;
  L = max(L, cov(dpxOf(dUp)) * onX);
  L = max(L, cov(dpxOf(dLo)) * onX);
  // creases above and below the lids
  float fU = dUp - (0.092 + 0.030 * k);
  float fL = dLo - (0.070 + 0.018 * k);
  L = max(L, 0.5 * cov(dpxOf(fU)) * step(0.12, k) * step(0.0, dUp) * onX);
  L = max(L, 0.4 * cov(dpxOf(fL)) * step(0.30, k) * step(0.0, dLo) * onX);

  // ---- iris: circles, compass ticks, rays, hatching
  vec2 qi = rot(u_tilt) * (q - u_iris);
  float r = length(qi);
  float a01 = atan(qi.y, qi.x) / TAU + 0.5;

  // outer circle: solid inside the lids, dashed construction circle outside
  float dash = step(fract(a01 * 90.0), 0.58);
  L = max(L, cov((r - RI) / px) * mix(dash * 0.6, 1.0, inLid));
  float cin = max(max(cov((r - RI * 0.915) / px), cov((r - RI * 0.79) / px)), cov((r - RI * 0.66) / px));
  L = max(L, cin * inLid * 0.9);

  // compass card: tick every 5 degrees, longer every 15, longest every 45
  float t = a01 * 72.0;
  float tid = floor(t + 0.5);
  float tidm = mod(tid, 72.0);
  float tda = (t - tid) * (TAU / 72.0);
  float is45 = step(mod(tidm, 9.0), 0.5);
  float is15 = step(mod(tidm, 3.0), 0.5);
  float tl = mix(mix(0.012, 0.026, is15), 0.046, is45);
  float trad = smoothstep(RI - tl - px, RI - tl, r) * (1.0 - smoothstep(RI, RI + px, r));
  L = max(L, cov(tda * r / px) * trad * mix(0.3, 1.0, inLid));

  // rays of varied length
  float rt = a01 * 60.0;
  float rid = floor(rt + 0.5);
  float rda = (rt - rid) * (TAU / 60.0);
  float ridm = mod(rid, 60.0);
  float r0 = RI * (0.66 + 0.04 * hash11(ridm + 3.0));
  float r1 = RI * (0.80 + 0.09 * hash11(ridm + 19.0));
  L = max(L, 0.8 * cov(rda * r / px) * step(r0, r) * step(r, r1) * inLid);

  // 45 degree hatching between the pupil and the first circle
  float hv = (qi.x - qi.y) * 0.70710678;
  const float HS = 0.0125;
  float hd = abs(fract(hv / HS + 0.5) - 0.5) * HS;
  L = max(L, 0.6 * cov(hd / px) * (1.0 - smoothstep(RI * 0.66 - px, RI * 0.66, r)) * inLid);

  // ---- construction lines: dash-dot centre lines
  float hp = mod(q.x + 2.0, 0.09);
  float hon = max(step(hp, 0.05), step(0.060, hp) * step(hp, 0.066));
  float cH = cov(q.y / px) * hon * step(abs(q.x), 0.96);
  float vp = mod(q.y + 2.0, 0.09);
  float von = max(step(vp, 0.05), step(0.060, vp) * step(vp, 0.066));
  float cV = cov((q.x - u_iris.x) / px) * von * step(abs(q.y), 0.64);
  L = max(L, 0.7 * max(cH, cV));

  // ---- lashes become a ruler scale along the upper lid
  const float LD = 0.0205;
  float lean = dUp * xn * 0.9;
  float lx = (q.x - lean) / LD;
  float lid = floor(lx + 0.5);
  float lda = (lx - lid) * LD;
  float five = step(mod(lid + 400.0, 5.0), 0.5);
  float llen = mix(0.026, 0.050, five);
  float lm = cov(lda / px) * step(0.0, dUp) * (1.0 - smoothstep(llen - px, llen, dUp));
  lm *= step(abs(q.x), W - 0.02) * step(0.08, k);
  L = max(L, lm * (1.0 - smoothstep(0.0, 0.25, u_open)));

  // ---- pupil: dark navy bar with a white outline
  float lidCover = (1.0 - inLid) * (1.0 - smoothstep(0.02, 0.16, u_open));
  vec2 qp = rot(u_tilt) * (q - u_pupilC);
  float dp = sdRoundBox(qp, u_pupilH, u_pupilR);
  float fill = (1.0 - smoothstep(-px, px, dp)) * (1.0 - lidCover);
  float outline = cov(dp / px) * (1.0 - lidCover);

  L *= 1.0 - fill;
  vec3 col = mix(bg, PUPIL, fill);
  col = mix(col, LINE, L * 0.96);
  col = mix(col, LINE, outline);
  outColor = vec4(col, 1.0);
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
  for (const n of ['res', 'center', 'scale', 'iris', 'pupilC', 'pupilH', 'pupilR', 'blink', 'open', 'tilt', 'seed', 'dpr']) {
    U[n] = gl.getUniformLocation(prog, 'u_' + n);
  }
  gl.uniform1f(U.seed, 3.7);
  gl.uniform1f(U.dpr, dpr);

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
  let centerPx = [0, 0, 1]; // eye centre and size in css px, for DOM overlays

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
    const restHalf = [PUPIL_HALF[0] * m * state.scale, PUPIL_HALF[1] * m * state.scale];
    const restC = [w / 2 + (cx + ix * 1.1 * scale) * m, h / 2 - (cy + iy * 1.1 * scale) * m];
    const half = [lerp(restHalf[0], w / 2 - state.margin, e), lerp(restHalf[1], h / 2 - state.margin, e)];
    const c = [lerp(restC[0], w / 2, e), lerp(restC[1], h / 2, e)];
    const radius = lerp(restHalf[1] * 0.52, state.cornerRadius, e);
    rect = { x: c[0] - half[0], y: c[1] - half[1], w: half[0] * 2, h: half[1] * 2, r: radius };
    centerPx = [w / 2 + cx * m, h / 2 - cy * m, scale * m];
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
    pupilRect: () => rect,
    centerPx: () => centerPx,
    blinkAmount: () => blinkValue,
  };
}
