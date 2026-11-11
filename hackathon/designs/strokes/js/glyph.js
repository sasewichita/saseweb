// SIX STROKES: one glyph, six materials, one flame.
//
// 羊 is loaded as six masks (glyphs/masks.png), turned into distance fields when the page loads,
// and drawn by a single shader. Because every form is a distance field, the glyph can melt from
// one script into the next. The only light is a flame at the pointer.
//
//   era 0 oracle bone, carved      era 3 clerical, brush ink on paper
//   era 1 bronze, cast relief      era 4 modern, neon tube
//   era 2 small seal, cinnabar     era 5 pixel, phosphor dots
//
// Use:
//   const glyph = await createGlyph(canvas, { dpr });   // null when WebGL2 is missing
//   glyph.state.era = 2.4;                 // 0..5; a fraction is a morph between two eras
//   glyph.state.center = [0.3, 0];         // slab centre, in units of the short side, +y up
//   glyph.state.scale = 0.8;               // size of the glyph cell, in units of the short side
//   glyph.state.bounds = [-0.56, 9, -9, 9];// slab edges left, right, bottom, top (cell units)
//   glyph.setLight(clientX, clientY);
//   glyph.render(timeSeconds, deltaSeconds);

const CELL = 384;
const LAYERS = 6;

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
precision highp sampler2DArray;
out vec4 outColor;

uniform sampler2DArray u_sdf;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_center;
uniform float u_scale;
uniform vec4 u_bounds;   // slab edges: left, right, bottom, top
uniform float u_era;
uniform vec2 u_light;    // flame position, cell units
uniform float u_power;   // flame strength, flicker included
uniform float u_neon;    // 0 dark tube .. 1 lit
uniform float u_flameSize;

float gA, gB, gK;        // the two eras being mixed, and how far

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
float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// distance to one form of the glyph; negative inside. g is in cell units, the cell is -0.5..0.5
float sdLayer(vec2 g, float layer) {
  vec2 uv = g + 0.5;
  vec2 cl = clamp(uv, 0.004, 0.996);
  return texture(u_sdf, vec3(cl.x, 1.0 - cl.y, layer)).r + length(uv - cl);
}
float sd(vec2 g) {
  float a = sdLayer(g, gA);
  if (gK < 0.001) return a;
  return mix(a, sdLayer(g, gB), gK);
}
// distance and its slope
vec3 sdGrad(vec2 g) {
  const float E = 0.0045;
  float d = sd(g);
  vec2 n = vec2(sd(g + vec2(E, 0.0)) - sd(g - vec2(E, 0.0)), sd(g + vec2(0.0, E)) - sd(g - vec2(0.0, E))) / (2.0 * E);
  return vec3(d, n);
}

const float LIGHT_H = 0.085;
// one small warm light close to the surface, so it rakes across every bump
vec3 shade(vec3 albedo, vec3 N, vec2 g, float h, float rough, float specAmt, vec3 specTint, float ambient) {
  vec3 to = vec3(u_light - g, LIGHT_H - h);
  float d2 = dot(to, to);
  vec3 L = to * inversesqrt(d2);
  float att = u_power / (1.0 + d2 / 0.050);
  float bounce = u_power * 0.16 / (1.0 + d2 / 0.9);
  float diff = max(dot(N, L), 0.0);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(N, H), 0.0), mix(110.0, 7.0, rough)) * specAmt;
  vec3 flame = vec3(1.0, 0.70, 0.40);
  return albedo * (ambient + flame * (diff * att * 2.1 + bounce)) + specTint * flame * spec * att * 1.7;
}

// ---- 0: oracle bone. The glyph is cut into the bone with a knife: a sharp V groove.
vec3 matBone(vec2 g, vec3 s, float px) {
  float d = s.x + (fbm(g * 46.0) - 0.5) * 0.006;
  const float W = 0.017;
  float cut = clamp(-d / W, 0.0, 1.0);
  float prof = cut * cut * (3.0 - 2.0 * cut);
  const float DEPTH = 0.024;
  float h = -DEPTH * prof;
  float dh = (cut > 0.0 && cut < 1.0) ? DEPTH * 6.0 * cut * (1.0 - cut) / W : 0.0;
  float swell = fbm(g * 2.3 + 7.0);
  float pores = vnoise(g * 210.0);
  float scratch = fbm(vec2(g.x * 18.0 + g.y * 3.0, g.y * 160.0));
  float hn = 0.014 * swell + 0.0011 * pores + 0.0011 * scratch;
  vec2 gn = vec2(dFdx(hn), dFdy(hn)) / px;
  vec3 N = normalize(vec3(-(dh * s.yz + gn), 1.0));
  vec3 ivory = vec3(0.84, 0.78, 0.64);
  vec3 stain = vec3(0.55, 0.42, 0.28);
  vec3 alb = mix(ivory, stain, 0.6 * smoothstep(0.35, 0.80, fbm(g * 3.1 + 20.0)));
  float crack = 1.0 - smoothstep(0.0, 0.0045, abs(fbm(g * 5.5 + 3.0) - 0.5));
  alb *= 1.0 - 0.55 * crack;
  alb = mix(alb, vec3(0.19, 0.12, 0.07), prof * 0.85);
  alb *= 0.92 + 0.16 * pores;
  return shade(alb, N, g, h, 0.78, 0.22, vec3(1.0), 0.06);
}

// ---- 1: bronze. The glyph stands up from the metal with a round shoulder; patina sits in the low places.
vec3 matBronze(vec2 g, vec3 s, float px) {
  float d = s.x;
  const float W = 0.030;
  float t = clamp(-d / W + 0.18, 0.0, 1.0);
  float prof = sqrt(max(1.0 - (1.0 - t) * (1.0 - t), 0.0));
  const float HGT = 0.028;
  float h = HGT * prof;
  float dh = (t > 0.001 && t < 0.999) ? -HGT * (1.0 - t) / max(prof, 0.10) / W : 0.0;
  float skin = fbm(g * 26.0);
  float pits = smoothstep(0.62, 0.90, vnoise(g * 120.0));
  float hn = 0.0024 * skin - 0.0016 * pits;
  vec2 gn = vec2(dFdx(hn), dFdy(hn)) / px;
  vec3 N = normalize(vec3(-(dh * s.yz + gn), 1.0));
  vec3 metal = vec3(0.45, 0.28, 0.12);
  vec3 dark = vec3(0.11, 0.075, 0.05);
  vec3 verdigris = vec3(0.21, 0.52, 0.43);
  float foot = smoothstep(0.055, 0.0, d) * (1.0 - prof);
  float low = smoothstep(0.42, 0.72, fbm(g * 4.2 + 11.0));
  float pat = clamp(0.8 * foot + 0.85 * low * (1.0 - 0.75 * prof), 0.0, 1.0) * (0.55 + 0.45 * vnoise(g * 60.0));
  vec3 alb = mix(mix(dark, metal, 0.30 + 0.70 * prof), verdigris, pat);
  return shade(alb, N, g, h, mix(0.32, 0.92, pat), mix(0.95, 0.06, pat), vec3(1.0, 0.82, 0.55), 0.05);
}

// ---- 2: seal. A square stamp in cinnabar paste; the glyph is the paper left bare.
vec3 matSeal(vec2 g, vec3 s, float px) {
  float fibre = fbm(vec2(g.x * 70.0 + g.y * 9.0, g.y * 14.0));
  float tooth = vnoise(g * 300.0);
  vec3 paper = vec3(0.90, 0.86, 0.76) * (0.92 + 0.10 * fibre);
  float rough = (fbm(g * 30.0) - 0.5) * 0.020 + (vnoise(g * 140.0) - 0.5) * 0.006;
  float square = sdBox(g, vec2(0.415)) - 0.014 + rough;
  float glyph = s.x - 0.003 + rough * 0.55;
  float ink = smoothstep(px * 1.5, -px * 1.5, square) * smoothstep(-px * 1.5, px * 1.5, glyph);
  float took = smoothstep(0.14, 0.40, fbm(g * 9.0 + 4.0) + 0.25 * tooth);
  float speck = smoothstep(0.80, 0.88, vnoise(g * 95.0));
  ink *= took * (1.0 - 0.8 * speck);
  vec3 cinnabar = mix(vec3(0.70, 0.10, 0.06), vec3(0.87, 0.21, 0.09), fbm(g * 13.0));
  vec3 alb = mix(paper, cinnabar, ink * 0.95);
  float hn = 0.0010 * tooth + 0.0016 * fibre + 0.0024 * ink;
  vec2 gn = vec2(dFdx(hn), dFdy(hn)) / px;
  vec3 N = normalize(vec3(-gn, 1.0));
  return shade(alb, N, g, 0.0, mix(0.95, 0.38, ink), 0.40 * ink, vec3(1.0), 0.07);
}

// ---- 3: brush. Ink on paper: it creeps out along the fibres and pools at the edge of the stroke.
vec3 matBrush(vec2 g, vec3 s, float px) {
  float fibreA = fbm(vec2(g.x * 16.0 + g.y * 5.0, g.y * 90.0));
  float fibreB = fbm(vec2(g.x * 90.0, g.y * 14.0 - g.x * 4.0));
  vec3 paper = vec3(0.89, 0.86, 0.78) * (0.91 + 0.11 * mix(fibreA, fibreB, 0.5));
  float creep = (fibreA - 0.5) * 0.020 + (fibreB - 0.5) * 0.014 + (fbm(g * 40.0) - 0.5) * 0.008;
  float e = s.x + creep;
  float ink = smoothstep(0.004, -0.004, e);
  float wash = smoothstep(0.034, 0.0, e) * 0.30;
  float density = (0.78 + 0.22 * smoothstep(-0.024, -0.002, e)) * (0.86 + 0.14 * fbm(g * 22.0));
  vec3 alb = mix(paper, vec3(0.045, 0.042, 0.050), clamp(ink * density + wash * (1.0 - ink), 0.0, 1.0));
  float hn = 0.0017 * fibreA + 0.0012 * fibreB;
  vec2 gn = vec2(dFdx(hn), dFdy(hn)) / px;
  vec3 N = normalize(vec3(-gn, 1.0));
  return shade(alb, N, g, 0.0, mix(0.95, 0.28, ink), 0.55 * ink, vec3(1.0), 0.07);
}

// ---- 4: neon. The thin modern form is a glass tube on a roller shutter. u_neon switches it on.
vec3 matNeon(vec2 g, vec3 s, float px) {
  float d = s.x;
  float rib = sin(g.y * 150.0);
  float grime = fbm(g * 6.0);
  vec3 wall = vec3(0.070, 0.076, 0.092) * (0.80 + 0.40 * grime);
  float hn = 0.0010 * fbm(g * 40.0);
  vec2 gw = vec2(0.0, 0.0034 * 150.0 * cos(g.y * 150.0)) + vec2(dFdx(hn), dFdy(hn)) / px;
  vec3 col = shade(wall, normalize(vec3(-gw, 1.0)), g, 0.0, 0.55, 0.30, vec3(1.0), 0.05);
  const float R = 0.016;
  float inside = clamp(-d / R, 0.0, 1.0);
  float x = 1.0 - inside;
  float tube = smoothstep(px, -px, d);
  vec3 Nt = normalize(vec3(s.yz * x, sqrt(max(1.0 - x * x, 0.03))));
  vec3 glass = shade(vec3(0.09, 0.09, 0.11), Nt, g, R * sqrt(max(1.0 - x * x, 0.0)), 0.06, 1.5, vec3(1.0), 0.05);
  col = mix(col, glass, tube);
  vec3 hue = vec3(1.0, 0.15, 0.30);
  float halo = exp(-max(d, 0.0) / 0.028) * 0.55 + exp(-max(d, 0.0) / 0.12) * 0.24;
  col += hue * halo * u_neon * (0.78 + 0.22 * rib) * (1.0 - tube);
  col += tube * u_neon * mix(hue * 1.5, vec3(1.0, 0.93, 0.95), smoothstep(0.30, 0.95, inside));
  return col;
}

// ---- 5: pixel. A grid of phosphor dots; a dot is lit when its centre is inside the glyph.
vec3 matPixel(vec2 g, float px) {
  const float CS = 0.72 / 16.0;
  vec2 gi = (g + 0.36) / CS;
  vec2 cell = floor(gi);
  vec2 f = fract(gi) - 0.5;
  float lit = step(sd((cell + 0.5) * CS - 0.36), 0.0);
  float aa = px / CS;
  float dotShape = 1.0 - smoothstep(0.38 - aa, 0.38 + aa, max(abs(f.x), abs(f.y)));
  vec3 phosphor = vec3(0.36, 1.0, 0.46);
  float hum = 0.93 + 0.07 * sin(u_time * 6.0 + cell.y * 1.7);
  vec3 col = vec3(0.010, 0.017, 0.013);
  col += phosphor * 0.030 * dotShape;
  col += phosphor * lit * dotShape * 1.05 * hum;
  col += phosphor * exp(-max(sd(g), 0.0) / 0.055) * 0.11;
  // the flame shows as a reflection in the glass
  col += shade(vec3(0.02, 0.03, 0.025), vec3(0.0, 0.0, 1.0), g, 0.0, 0.02, 0.9, vec3(1.0), 0.0);
  return col;
}

vec3 material(float era, vec2 g, vec3 s, float px) {
  if (era < 0.5) return matBone(g, s, px);
  if (era < 1.5) return matBronze(g, s, px);
  if (era < 2.5) return matSeal(g, s, px);
  if (era < 3.5) return matBrush(g, s, px);
  if (era < 4.5) return matNeon(g, s, px);
  return matPixel(g, px);
}
// how ragged the edge of the slab is: a bone fragment, a cast plaque, torn paper, a wall, a screen
float edgeRough(float era) {
  if (era < 0.5) return 0.060;
  if (era < 1.5) return 0.006;
  if (era < 3.5) return 0.012;
  return 0.0;
}

vec3 flame(vec2 g) {
  float size = 0.050 * u_flameSize;
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
  vec2 g = (p - u_center) / u_scale;
  float px = 1.0 / (m * u_scale);

  gA = clamp(floor(u_era), 0.0, 5.0);
  gB = min(gA + 1.0, 5.0);
  gK = smoothstep(0.0, 1.0, clamp(u_era - gA, 0.0, 1.0));

  // the slab the glyph lives on, with the dark beyond its edge
  float rough = mix(edgeRough(gA), edgeRough(gB), gK);
  vec2 mid = 0.5 * (u_bounds.xz + u_bounds.yw);
  vec2 halfSize = 0.5 * (u_bounds.yw - u_bounds.xz);
  float slab = sdBox(g - mid, halfSize) + (fbm(g * 3.3 + 50.0) - 0.5) * rough * 2.6 + (fbm(g * 21.0) - 0.5) * rough * 0.5;

  vec3 col = vec3(0.016, 0.014, 0.013);
  if (slab < px * 2.0) {
    vec3 s = sdGrad(g);
    vec3 surface = material(gA, g, s, px);
    if (gK > 0.001) {
      // the next material grows in from patches rather than fading evenly
      float grow = smoothstep(0.0, 0.14, gK * 1.26 - 0.13 - fbm(g * 4.0 + gA * 9.0));
      if (grow > 0.001) surface = mix(surface, material(gB, g, s, px), grow);
    }
    // a thin lit edge where the slab ends
    surface *= 1.0 - 0.5 * smoothstep(-0.012, 0.0, slab);
    col = mix(surface, col, smoothstep(-px, px, slab));
  } else {
    // just past the edge: the slab's shadow, and a breath of light on the dust
    float d2 = dot(u_light - g, u_light - g);
    col += vec3(1.0, 0.62, 0.34) * u_power * 0.012 / (1.0 + d2 / 0.02);
  }

  col += flame(g);
  col *= 1.0 - 0.30 * dot(p, p);
  col = col / (1.0 + 0.12 * col);
  col += (hash21(gl_FragCoord.xy + fract(u_time)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;

// ---- distance fields from masks (after Felzenszwalb and Huttenlocher; edge handling as in Mapbox TinySDF)
const INF = 1e20;
function edt1d(grid, offset, stride, length, f, v, z) {
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  f[0] = grid[offset];
  for (let q = 1, k = 0, s = 0; q < length; q++) {
    f[q] = grid[offset + q * stride];
    const q2 = q * q;
    do {
      const r = v[k];
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
    } while (s <= z[k] && --k > -1);
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  for (let q = 0, k = 0; q < length; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k];
    const qr = q - r;
    grid[offset + q * stride] = f[r] + qr * qr;
  }
}
function edt(grid, size, f, v, z) {
  for (let x = 0; x < size; x++) edt1d(grid, x, size, size, f, v, z);
  for (let y = 0; y < size; y++) edt1d(grid, y * size, 1, size, f, v, z);
}

/** Read the mask atlas and return one Float32Array of signed distances per layer, in cell units. */
function distanceFields(image) {
  const cols = Math.round(image.width / CELL);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const out = new Float32Array(CELL * CELL * LAYERS);
  const outer = new Float64Array(CELL * CELL);
  const inner = new Float64Array(CELL * CELL);
  const f = new Float64Array(CELL);
  const z = new Float64Array(CELL + 1);
  const v = new Uint16Array(CELL);
  for (let n = 0; n < LAYERS; n++) {
    const data = ctx.getImageData((n % cols) * CELL, Math.floor(n / cols) * CELL, CELL, CELL).data;
    for (let i = 0; i < CELL * CELL; i++) {
      const a = data[i * 4] / 255;
      if (a >= 0.999) {
        outer[i] = 0;
        inner[i] = INF;
      } else if (a <= 0.001) {
        outer[i] = INF;
        inner[i] = 0;
      } else {
        const d = 0.5 - a;
        outer[i] = d > 0 ? d * d : 0;
        inner[i] = d < 0 ? d * d : 0;
      }
    }
    edt(outer, CELL, f, v, z);
    edt(inner, CELL, f, v, z);
    const base = n * CELL * CELL;
    for (let i = 0; i < CELL * CELL; i++) out[base + i] = (Math.sqrt(outer[i]) - Math.sqrt(inner[i])) / CELL;
  }
  return out;
}

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('could not load ' + src));
    im.src = src;
  });

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export async function createGlyph(canvas, { dpr = 1, atlas = 'glyphs/masks.png', onLost } = {}) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false });
  if (!gl) return null;

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('glyph shader: ' + gl.getShaderInfoLog(sh));
    return sh;
  };
  let prog;
  let fields;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('glyph link: ' + gl.getProgramInfoLog(prog));
    fields = distanceFields(await loadImage(atlas));
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

  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
  gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R16F, CELL, CELL, LAYERS, 0, gl.RED, gl.FLOAT, fields);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const U = {};
  for (const n of ['sdf', 'res', 'time', 'center', 'scale', 'bounds', 'era', 'light', 'power', 'neon', 'flameSize']) {
    U[n] = gl.getUniformLocation(prog, 'u_' + n);
  }
  gl.uniform1i(U.sdf, 0);

  const state = {
    era: 0,
    center: [0, 0],
    scale: 0.8,
    bounds: [-9, 9, -9, 9],
    neon: 1,
    flameSize: 1,
    still: false, // reduced motion: a fixed light, no flicker
    restLight: [-0.16, 0.2], // where the light sits when nobody is steering it (cell units)
  };
  let w = 1;
  let h = 1;
  let lost = false;
  let now = 0;
  const light = [-0.16, 0.2];
  const want = [-0.16, 0.2];
  let steeredAt = -100;

  function resize() {
    w = canvas.clientWidth || window.innerWidth;
    h = canvas.clientHeight || window.innerHeight;
    const pw = Math.max(1, Math.round(w * dpr));
    const ph = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    gl.viewport(0, 0, pw, ph);
  }

  /** css pixels -> cell units */
  function toCell(clientX, clientY) {
    const m = Math.min(w, h);
    return [((clientX - w / 2) / m - state.center[0]) / state.scale, ((h / 2 - clientY) / m - state.center[1]) / state.scale];
  }
  /** cell units -> css pixels */
  function toScreen(gx, gy) {
    const m = Math.min(w, h);
    return [w / 2 + (state.center[0] + gx * state.scale) * m, h / 2 - (state.center[1] + gy * state.scale) * m];
  }

  function setLight(clientX, clientY) {
    const [gx, gy] = toCell(clientX, clientY);
    want[0] = gx;
    // the pointer is the wick; the light is the flame just above it
    want[1] = gy + 0.02;
    steeredAt = now;
  }

  function render(t = 0, dt = 0.016) {
    if (lost) return;
    now = t;
    let power = 1;
    if (state.still) {
      light[0] = state.restLight[0];
      light[1] = state.restLight[1];
    } else {
      // left alone, the flame drifts round the glyph by itself
      if (t - steeredAt > 3.5) {
        want[0] = state.restLight[0] + Math.sin(t * 0.43) * 0.24;
        want[1] = state.restLight[1] - 0.16 + Math.sin(t * 0.61 + 1.3) * 0.22;
      }
      const k = 1 - Math.exp(-dt * (t - steeredAt > 3.5 ? 2.2 : 14));
      light[0] += (want[0] - light[0]) * k;
      light[1] += (want[1] - light[1]) * k;
      power = 1 + 0.07 * Math.sin(t * 17.3) + 0.05 * Math.sin(t * 31.7 + 1.0) + 0.04 * Math.sin(t * 7.1 + 2.0);
    }
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform1f(U.time, state.still ? 0 : t);
    gl.uniform2f(U.center, state.center[0], state.center[1]);
    gl.uniform1f(U.scale, state.scale);
    gl.uniform4f(U.bounds, state.bounds[0], state.bounds[1], state.bounds[2], state.bounds[3]);
    gl.uniform1f(U.era, clamp(state.era, 0, 5));
    gl.uniform2f(U.light, light[0], light[1]);
    gl.uniform1f(U.power, power);
    gl.uniform1f(U.neon, state.neon);
    gl.uniform1f(U.flameSize, state.flameSize);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    if (onLost) onLost();
  });

  resize();
  return { state, resize, render, setLight, toCell, toScreen };
}
