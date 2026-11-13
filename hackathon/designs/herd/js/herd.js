// THE HERD: a few hundred goats on a wheat field at golden hour, seen from above.
// One instanced mesh for the goats, one for their long shadows, and a flocking simulation on
// the CPU. Goats walk to "formations" (see formations.js), part around the pointer, follow it
// while it is held, and hop when you whistle.
//
// Use:
//   const herd = await createHerd(canvas, { count: 480, dpr });   // null when WebGL is missing
//   herd.setView({ height: 60, north: 0 });          // how much field is in view, and where
//   herd.setFormation(points, { north: 0, height: 60, spacing });  // points from sampleInk()
//   herd.pointer(clientX, clientY, isDown);
//   herd.whistle(clientX, clientY);
//   herd.render(timeSeconds, deltaSeconds);

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PITCH = (58 * Math.PI) / 180; // camera angle above the ground
const SIN_P = Math.sin(PITCH);
const COS_P = Math.cos(PITCH);
const SUN_ELEVATION = (31 * Math.PI) / 180; // low sun: long shadows
const SHADOW_DIR = [0.829, -0.559]; // where shadows fall on the ground (x, z): right and away
const SHADOW_LEN = 1 / Math.tan(SUN_ELEVATION);
const GOAT_LENGTH = 1.5; // model units, tail to muzzle

const GOAT_VERT = /* glsl */ `
attribute vec4 aA; // x, z, heading, gait
attribute vec4 aB; // phase, hop height, scale, coat
attribute float aC; // grazing 0..1
uniform float uShadow;
uniform vec2 uShadowDir;
uniform float uShadowLen;
varying vec3 vWorld;
varying float vPart;
varying float vCoat;

void main() {
  vec3 p = position; // +X forward, +Y up
  float gait = aA.w;
  float phase = aB.x;

  // head down to graze: the neck, head and horns swing about the shoulder
  float neck = smoothstep(0.30, 0.50, p.x) * smoothstep(0.55, 0.78, p.y);
  float ga = -1.05 * aC * neck;
  vec2 nk = p.xy - vec2(0.34, 0.74);
  p.xy = mix(p.xy, vec2(cos(ga) * nk.x - sin(ga) * nk.y, sin(ga) * nk.x + cos(ga) * nk.y) + vec2(0.34, 0.74), step(0.001, neck));

  // legs: front pair and back pair swing against each other, like a bounding run
  const float HIP = 0.50;
  float leg = clamp((HIP - p.y) / HIP, 0.0, 1.0);
  float front = step(0.0, p.x);
  float sw = phase + front * 3.14159;
  p.x += sin(sw) * leg * 0.26 * gait;
  p.y += max(0.0, cos(sw)) * leg * 0.08 * gait;

  // the body rocks and bounces
  float rock = sin(phase + 1.2) * 0.14 * gait;
  vec2 b = p.xy - vec2(0.0, 0.55);
  p.xy = vec2(cos(rock) * b.x - sin(rock) * b.y, sin(rock) * b.x + cos(rock) * b.y) + vec2(0.0, 0.55);
  p.y += abs(sin(phase)) * 0.17 * gait + aB.y;

  p *= aB.z;
  float ch = cos(aA.z), sh = sin(aA.z);
  vec3 wp = vec3(aA.x + p.x * ch - p.z * sh, p.y, aA.y + p.x * sh + p.z * ch);
  if (uShadow > 0.5) {
    wp.xz += uShadowDir * wp.y * uShadowLen;
    wp.y = 0.02;
  }
  vWorld = wp;
  vPart = uv.x * 8.0;
  vCoat = aB.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

const GOAT_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uSunCol;
uniform vec3 uAmb;
uniform vec3 uCoat[4];
varying vec3 vWorld;
varying float vPart;
varying float vCoat;

void main() {
  // flat facets, from the screen-space slope of the surface
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  float lit = max(dot(n, uSun), 0.0);
  vec3 coat = vCoat < 0.5 ? uCoat[0] : vCoat < 1.5 ? uCoat[1] : vCoat < 2.5 ? uCoat[2] : uCoat[3];
  vec3 base = coat;
  float dark = step(dot(coat, vec3(0.333)), 0.4);
  if (vPart > 1.0 && vPart < 2.0) base = mix(vec3(0.34, 0.30, 0.27), vec3(0.80, 0.72, 0.56), dark); // horns
  if (vPart > 3.0) base = vec3(0.10, 0.09, 0.09); // hooves
  vec3 col = base * (uAmb + uSunCol * lit);
  gl_FragColor = vec4(col, 1.0);
}`;

const SHADOW_FRAG = /* glsl */ `
uniform vec3 uShadowCol;
uniform float uShadowAlpha;
void main() { gl_FragColor = vec4(uShadowCol, uShadowAlpha); }`;

const FIELD_VERT = /* glsl */ `
varying vec2 vXZ;
varying vec2 vScreen;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vXZ = wp.xz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  vScreen = gl_Position.xy;
}`;

const FIELD_FRAG = /* glsl */ `
varying vec2 vXZ;
varying vec2 vScreen;
uniform float uTime;
uniform vec4 uRipple; // x, z, start time, strength
uniform float uUnitPx; // screen pixels per world unit

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.07 + 13.7; a *= 0.5; }
  return s;
}

void main() {
  // the field was cut in long passes that run a little off north
  vec2 r = mat2(0.974, -0.225, 0.225, 0.974) * vXZ;
  const float PASS = 7.5; // width of one pass of the combine
  float lane = floor(r.x / PASS);
  float inLane = fract(r.x / PASS);

  vec3 wheat = vec3(0.890, 0.705, 0.270);
  vec3 wheatLight = vec3(0.945, 0.790, 0.370);
  vec3 wheatDeep = vec3(0.800, 0.585, 0.200);

  // every other pass lies the other way, so it catches the light differently
  float lay = mod(lane, 2.0);
  vec3 col = mix(wheat, wheatLight, lay * 0.55);
  // a thin dark seam between passes
  float seam = smoothstep(0.0, 0.035, inLane) * smoothstep(1.0, 0.965, inLane);
  col = mix(wheatDeep, col, 0.35 + 0.65 * seam);

  // stubble rows inside a pass: fade them out before they get thinner than a pixel
  float rows = sin(r.x * 6.2831853 * 2.4);
  float rowFade = clamp(uUnitPx / 14.0 - 0.35, 0.0, 1.0);
  col *= 1.0 + 0.045 * rows * rowFade;

  // patchy ground: slow changes in how thick the crop grew
  float crop = fbm(vXZ * 0.045 + 3.0);
  col *= 0.90 + 0.20 * crop;
  float thin = smoothstep(0.62, 0.80, fbm(vXZ * 0.11 + 40.0));
  col = mix(col, wheatDeep * 0.93, thin * 0.45);

  // two wheel tracks crossing the field
  vec2 t = mat2(0.342, -0.940, 0.940, 0.342) * vXZ;
  float track = abs(abs(mod(t.x + 30.0, 120.0) - 60.0) - 1.1) - 0.22;
  col = mix(col, wheatDeep * 0.82, (1.0 - smoothstep(0.0, 0.12, track)) * 0.55);

  // fine grain
  col *= 0.97 + 0.06 * hash(floor(vXZ * uUnitPx * 0.9));

  // the whistle: a ring of bent stalks running outward
  float age = uTime - uRipple.z;
  if (age > 0.0 && age < 2.4) {
    float d = distance(vXZ, uRipple.xy);
    float ring = abs(d - age * 26.0) - 0.5;
    float fade = (1.0 - age / 2.4) * uRipple.w;
    col = mix(col, vec3(1.0, 0.93, 0.66), (1.0 - smoothstep(0.0, 0.5, ring)) * fade * 0.7);
  }

  // low sun from the left: warm near it, cooler far away
  col *= mix(vec3(1.06, 1.02, 0.94), vec3(0.93, 0.93, 0.99), smoothstep(-1.0, 1.0, vScreen.x * 0.8 + vScreen.y * 0.4));
  gl_FragColor = vec4(col, 1.0);
}`;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export async function createHerd(canvas, { count = 480, dpr = 1, glb = 'assets/goat.glb', onLost } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true, alpha: false, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0xe3b445, 1);

  const gltf = await new GLTFLoader().loadAsync(glb);
  let src = null;
  gltf.scene.traverse((o) => {
    if (o.isMesh && !src) src = o.geometry;
  });
  if (!src) throw new Error('goat.glb has no mesh');

  const N = Math.max(8, count);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = src.index;
  geo.setAttribute('position', src.attributes.position);
  geo.setAttribute('uv', src.attributes.uv);
  const bufA = new Float32Array(N * 4);
  const bufB = new Float32Array(N * 4);
  const bufC = new Float32Array(N);
  const attrA = new THREE.InstancedBufferAttribute(bufA, 4).setUsage(THREE.DynamicDrawUsage);
  const attrB = new THREE.InstancedBufferAttribute(bufB, 4).setUsage(THREE.DynamicDrawUsage);
  const attrC = new THREE.InstancedBufferAttribute(bufC, 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aA', attrA);
  geo.setAttribute('aB', attrB);
  geo.setAttribute('aC', attrC);
  geo.instanceCount = N;

  const sunFlat = Math.cos(SUN_ELEVATION);
  const shared = {
    uShadowDir: { value: new THREE.Vector2(SHADOW_DIR[0], SHADOW_DIR[1]) },
    uShadowLen: { value: SHADOW_LEN },
  };
  const goatMat = new THREE.ShaderMaterial({
    vertexShader: GOAT_VERT,
    fragmentShader: GOAT_FRAG,
    uniforms: {
      ...shared,
      uShadow: { value: 0 },
      uSun: { value: new THREE.Vector3(-SHADOW_DIR[0] * sunFlat, Math.sin(SUN_ELEVATION), -SHADOW_DIR[1] * sunFlat) },
      uSunCol: { value: new THREE.Vector3(1.5, 1.16, 0.7) },
      uAmb: { value: new THREE.Vector3(0.62, 0.64, 0.86) },
      // black coat, white coat, the odd one out, the lead goat
      uCoat: {
        value: [
          new THREE.Vector3(0.105, 0.09, 0.105),
          new THREE.Vector3(0.93, 0.9, 0.84),
          new THREE.Vector3(0.2, 0.55, 0.96),
          new THREE.Vector3(0.97, 0.95, 0.9),
        ],
      },
    },
  });
  const shadowMat = new THREE.ShaderMaterial({
    vertexShader: GOAT_VERT,
    fragmentShader: SHADOW_FRAG,
    uniforms: {
      ...shared,
      uShadow: { value: 1 },
      uShadowCol: { value: new THREE.Vector3(0.2, 0.13, 0.4) },
      uShadowAlpha: { value: 0.4 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    // each pixel of shadow is darkened once, however many shadows overlap there
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilZPass: THREE.ReplaceStencilOp,
  });
  const fieldMat = new THREE.ShaderMaterial({
    vertexShader: FIELD_VERT,
    fragmentShader: FIELD_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uRipple: { value: new THREE.Vector4(0, 0, -100, 0) },
      uUnitPx: { value: 15 },
    },
    depthWrite: false,
  });

  const scene = new THREE.Scene();
  const field = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), fieldMat);
  field.renderOrder = 0;
  field.frustumCulled = false;
  const shadows = new THREE.Mesh(geo, shadowMat);
  shadows.renderOrder = 1;
  shadows.frustumCulled = false;
  const goats = new THREE.Mesh(geo, goatMat);
  goats.renderOrder = 2;
  goats.frustumCulled = false;
  scene.add(field, shadows, goats);

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 600);

  // ---- the view: how much field is on screen and where the camera is over it
  const view = { h: 60, w: 96, x: 0, z: 0, toH: 60, toZ: 0 };
  let cw = 1;
  let ch = 1;
  function resize() {
    cw = canvas.clientWidth || window.innerWidth;
    ch = canvas.clientHeight || window.innerHeight;
    renderer.setSize(cw, ch, false);
  }
  function placeCamera() {
    view.w = (view.h * cw) / ch;
    cam.left = -view.w / 2;
    cam.right = view.w / 2;
    cam.top = view.h / 2;
    cam.bottom = -view.h / 2;
    cam.updateProjectionMatrix();
    cam.position.set(view.x, SIN_P * 200, view.z + COS_P * 200);
    cam.lookAt(view.x, 0, view.z);
    field.scale.set(view.w * 1.3, 1, (view.h / SIN_P) * 1.5 + 12);
    field.position.set(view.x, 0, view.z);
    fieldMat.uniforms.uUnitPx.value = ch / view.h;
  }
  const toGround = (clientX, clientY) => [
    view.x + (clientX / cw - 0.5) * view.w,
    view.z - ((0.5 - clientY / ch) * view.h) / SIN_P,
  ];
  const toScreen = (x, z, y = 0) => [
    ((x - view.x) / view.w + 0.5) * cw,
    (0.5 - (-(z - view.z) * SIN_P + y * COS_P) / view.h) * ch,
  ];

  // ---- the animals
  const px = new Float32Array(N);
  const pz = new Float32Array(N);
  const vx = new Float32Array(N);
  const vz = new Float32Array(N);
  const head = new Float32Array(N);
  const rest = new Float32Array(N);
  const phase = new Float32Array(N);
  const gait = new Float32Array(N);
  const hop = new Float32Array(N);
  const hopV = new Float32Array(N);
  const hopAt = new Float32Array(N);
  const tx = new Float32Array(N);
  const tz = new Float32Array(N);
  const has = new Uint8Array(N); // 0 wander, 1 has a place in the formation, 2 loose place nearby
  const wait = new Float32Array(N);
  const size = new Float32Array(N);
  const sizeTo = new Float32Array(N);
  const grazing = new Float32Array(N);
  const grazeTo = new Float32Array(N);
  const grazeAt = new Float32Array(N);
  const coat = new Float32Array(N);
  const LEAD = 0;
  const ODD = 1;
  for (let i = 0; i < N; i++) {
    // start out of sight below the bottom edge, so the herd runs in
    px[i] = (Math.random() - 0.5) * view.w * 1.3;
    pz[i] = view.h / SIN_P / 2 + 4 + Math.random() * 26;
    head[i] = -Math.PI / 2;
    // settled goats mostly stand side-on to the camera, which is the view that reads as a goat
    rest[i] = Math.random() < 0.86 ? (Math.random() - 0.5) * 0.9 : Math.random() * Math.PI * 2;
    phase[i] = Math.random() * 6.28;
    size[i] = sizeTo[i] = 1;
    coat[i] = Math.random() < 0.2 ? 1 : 0;
    wait[i] = Math.random() * 0.9;
    grazeAt[i] = 2 + Math.random() * 6;
  }
  coat[LEAD] = 3;
  coat[ODD] = 2;
  wait[ODD] = 0.5;

  const lead = { x: 0, z: 0, tx: 0, tz: 0, seen: false, down: false, downAt: 0, held: false };
  let scaleNow = 1; // goat scale of the current formation
  let now = 0;

  // spatial hash, rebuilt every step
  let cellStart = new Int32Array(1);
  const order = new Int32Array(N);
  const cellOfGoat = new Int32Array(N);

  function step(t, dt) {
    now = t;
    const sep = GOAT_LENGTH * 0.74 * scaleNow; // closest two goats like to stand
    const cs = Math.max(sep * 1.6, 0.5);
    let minX = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < N; i++) {
      if (px[i] < minX) minX = px[i];
      if (px[i] > maxX) maxX = px[i];
      if (pz[i] < minZ) minZ = pz[i];
      if (pz[i] > maxZ) maxZ = pz[i];
    }
    const cols = Math.min(200, Math.floor((maxX - minX) / cs) + 1);
    const rows = Math.min(200, Math.floor((maxZ - minZ) / cs) + 1);
    const nCells = cols * rows;
    if (cellStart.length < nCells + 1) cellStart = new Int32Array(nCells + 1);
    cellStart.fill(0, 0, nCells + 1);
    for (let i = 0; i < N; i++) {
      const cx = clamp(Math.floor((px[i] - minX) / cs), 0, cols - 1);
      const cz = clamp(Math.floor((pz[i] - minZ) / cs), 0, rows - 1);
      const c = cx + cz * cols;
      cellOfGoat[i] = c;
      cellStart[c + 1]++;
    }
    for (let c = 0; c < nCells; c++) cellStart[c + 1] += cellStart[c];
    const fill = cellStart.slice(0, nCells);
    for (let i = 0; i < N; i++) order[fill[cellOfGoat[i]]++] = i;

    // the lead goat walks under the pointer
    if (lead.seen) {
      const k = 1 - Math.exp(-dt * 10);
      const ox = lead.x;
      const oz = lead.z;
      lead.x += (lead.tx - lead.x) * k;
      lead.z += (lead.tz - lead.z) * k;
      vx[LEAD] = (lead.x - ox) / Math.max(dt, 0.001);
      vz[LEAD] = (lead.z - oz) / Math.max(dt, 0.001);
      px[LEAD] = lead.x;
      pz[LEAD] = lead.z;
    }
    lead.held = lead.down && t - lead.downAt > 0.22;
    const partR = view.h * 0.085; // how wide the herd parts round the pointer
    const followR = view.h * 0.42;
    const halfW = view.w / 2;
    const halfD = view.h / SIN_P / 2;

    for (let i = 0; i < N; i++) {
      const isLead = i === LEAD && lead.seen;
      let ax = 0;
      let az = 0;
      let sp = Math.hypot(vx[i], vz[i]);
      if (!isLead) {
        if (wait[i] > 0) {
          wait[i] -= dt;
        } else {
          // keep clear of neighbours
          const cx = cellOfGoat[i] % cols;
          const cz = (cellOfGoat[i] / cols) | 0;
          let sx = 0;
          let sz = 0;
          let avx = 0;
          let avz = 0;
          let near = 0;
          for (let dz = -1; dz <= 1; dz++) {
            const zz = cz + dz;
            if (zz < 0 || zz >= rows) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const xx = cx + dx;
              if (xx < 0 || xx >= cols) continue;
              const c = xx + zz * cols;
              for (let k = cellStart[c]; k < cellStart[c + 1]; k++) {
                const j = order[k];
                if (j === i) continue;
                const ddx = px[i] - px[j];
                const ddz = pz[i] - pz[j];
                const d2 = ddx * ddx + ddz * ddz;
                if (d2 < sep * sep && d2 > 1e-6) {
                  const d = Math.sqrt(d2);
                  const f = 1 - d / sep;
                  sx += (ddx / d) * f;
                  sz += (ddz / d) * f;
                }
                avx += vx[j];
                avz += vz[j];
                near++;
              }
            }
          }

          let toX = tx[i];
          let toZ = tz[i];
          let mode = has[i];
          // held pointer: everyone within reach comes to the lead goat
          if (lead.held) {
            const d = Math.hypot(px[i] - lead.x, pz[i] - lead.z);
            if (d < followR) {
              toX = lead.x;
              toZ = lead.z;
              mode = 3;
            }
          }
          let dist = 0;
          if (mode) {
            const ddx = toX - px[i];
            const ddz = toZ - pz[i];
            dist = Math.hypot(ddx, ddz);
            // far from its place a goat sprints, so the herd keeps up with a fast scroll
            const top = mode === 3 ? 13 : 12 + dist * 0.95;
            const want = Math.min(top, dist * (mode === 2 ? 1.2 : 2.6));
            if (dist > 0.001) {
              ax += ((ddx / dist) * want - vx[i]) * 5.5;
              az += ((ddz / dist) * want - vz[i]) * 5.5;
            }
          } else {
            // loose: drift with the neighbours, stay in view
            if (near) {
              ax += (avx / near - vx[i]) * 0.8;
              az += (avz / near - vz[i]) * 0.8;
            }
            const wob = t * 0.3 + i * 1.7;
            ax += Math.cos(wob) * 0.8 - vx[i] * 0.6;
            az += Math.sin(wob * 1.3) * 0.8 - vz[i] * 0.6;
            const ex = px[i] - view.x;
            const ez = pz[i] - view.z;
            if (Math.abs(ex) > halfW * 0.9) ax -= Math.sign(ex) * 6;
            if (Math.abs(ez) > halfD * 0.9) az -= Math.sign(ez) * 6;
          }
          // settled goats barely push each other, so a formation stands still
          const push = mode === 1 ? clamp(0.12 + dist / (sep * 1.4), 0.12, 1) : 1;
          ax += sx * 46 * push;
          az += sz * 46 * push;

          // part around the pointer
          if (lead.seen && !lead.held) {
            const ddx = px[i] - lead.x;
            const ddz = pz[i] - lead.z;
            const d2 = ddx * ddx + ddz * ddz;
            if (d2 < partR * partR && d2 > 1e-6) {
              const d = Math.sqrt(d2);
              const f = (1 - d / partR) ** 2;
              ax += (ddx / d) * f * 190;
              az += (ddz / d) * f * 190;
            }
          }
          vx[i] += ax * dt;
          vz[i] += az * dt;
          sp = Math.hypot(vx[i], vz[i]);
          const cap = 90;
          if (sp > cap) {
            vx[i] *= cap / sp;
            vz[i] *= cap / sp;
            sp = cap;
          }
          px[i] += vx[i] * dt;
          pz[i] += vz[i] * dt;
        }
      }

      // facing: along the run, or back to the resting direction once settled
      const moving = sp > 0.45 * scaleNow;
      const wantHead = moving ? Math.atan2(vz[i], vx[i]) : rest[i];
      const turn = (moving ? 9 : 2.2) * dt;
      head[i] += clamp(wrapAngle(wantHead - head[i]), -turn, turn);

      const g = clamp(sp / (2.6 * Math.max(size[i], 0.2)), 0, 1);
      gait[i] += (g - gait[i]) * Math.min(1, dt * 9);
      if (gait[i] > 0.02) phase[i] += dt * Math.min(19, 6.5 + sp * 0.9);

      // whistle hop
      if (hopAt[i] > 0 && t >= hopAt[i]) {
        hopV[i] = 3.6 + Math.random() * 1.6;
        hopAt[i] = 0;
      }
      if (hopV[i] !== 0 || hop[i] > 0) {
        hop[i] += hopV[i] * dt;
        hopV[i] -= 17 * dt;
        if (hop[i] <= 0) {
          hop[i] = 0;
          hopV[i] = 0;
        }
      }

      // grazing: now and then a standing goat puts its head down
      if (moving || isLead) {
        grazeTo[i] = 0;
        grazeAt[i] = t + 1.5 + Math.random() * 4;
      } else if (t > grazeAt[i]) {
        grazeTo[i] = grazeTo[i] > 0.5 ? 0 : Math.random() < 0.6 ? 1 : 0;
        grazeAt[i] = t + 1.8 + Math.random() * 5.5;
      }
      grazing[i] += (grazeTo[i] - grazing[i]) * Math.min(1, dt * 3.5);
      size[i] += (sizeTo[i] - size[i]) * Math.min(1, dt * 2.5);

      const a = i * 4;
      bufA[a] = px[i];
      bufA[a + 1] = pz[i];
      bufA[a + 2] = head[i];
      bufA[a + 3] = gait[i];
      bufB[a] = phase[i];
      bufB[a + 1] = hop[i];
      bufB[a + 2] = size[i];
      bufB[a + 3] = coat[i];
      bufC[i] = grazing[i];
    }
    attrA.needsUpdate = true;
    attrB.needsUpdate = true;
    attrC.needsUpdate = true;
  }

  /**
   * Send the herd to a formation.
   * points: [[x, y], ...] in view units (-0.5..0.5, y up), from sampleInk().
   * north: where the camera will be when this formation is on screen (world units, 0 = start).
   * height: the view height the formation was drawn for.
   * spacing: sampleInk's spacing; goats shrink to fit a tight formation.
   */
  function setFormation(points, { north = view.toZ, height = view.toH, spacing = 0, maxScale = 1.15, aspect = cw / ch } = {}) {
    const vw = height * aspect;
    const spots = points.map(([x, y]) => [x * vw, -north - (y * height) / SIN_P]);
    const gap = spacing ? spacing * vw : GOAT_LENGTH;
    const s = clamp(gap / (GOAT_LENGTH * 1.2), 0.3, maxScale);
    scaleNow = s;

    // goats and places are both sorted left to right and paired up in strips, so paths cross little
    const flock = [];
    for (let i = 0; i < N; i++) if (i !== LEAD || !lead.seen) flock.push(i);
    const strips = Math.max(1, Math.round(Math.sqrt(spots.length / 6)));
    const byX = (arr, get) => arr.sort((a, b) => get(a)[0] - get(b)[0]);
    byX(spots, (p) => p);
    byX(flock, (i) => [px[i]]);
    const used = Math.min(flock.length, spots.length);
    const perStrip = Math.ceil(used / strips);
    for (let s0 = 0; s0 < used; s0 += perStrip) {
      const e = Math.min(used, s0 + perStrip);
      const ps = spots.slice(s0, e).sort((a, b) => a[1] - b[1]);
      const gs = flock.slice(s0, e).sort((a, b) => pz[a] - pz[b]);
      for (let k = 0; k < ps.length; k++) {
        const i = gs[k];
        tx[i] = ps[k][0];
        tz[i] = ps[k][1];
        has[i] = 1;
        sizeTo[i] = s * (0.9 + ((i * 7919) % 100) / 500);
      }
    }
    // goats without a place graze loosely round the edges of the view
    for (let k = used; k < flock.length; k++) {
      const i = flock[k];
      const side = k % 2 ? 1 : -1;
      tx[i] = side * vw * (0.36 + Math.random() * 0.12);
      tz[i] = -north + (Math.random() - 0.5) * (height / SIN_P) * 0.9;
      has[i] = 2;
      sizeTo[i] = s;
    }
    if (lead.seen) sizeTo[LEAD] = s * 1.5;
    return { scale: s, placed: used };
  }

  /** Let the herd wander. */
  function release() {
    has.fill(0);
  }

  function setView({ height, north, immediate = false } = {}) {
    if (height !== undefined) view.toH = height;
    if (north !== undefined) view.toZ = -north;
    if (immediate) {
      view.h = view.toH;
      view.z = view.toZ;
    }
  }

  function pointer(clientX, clientY, down = false) {
    const [gx, gz] = toGround(clientX, clientY);
    if (!lead.seen) {
      lead.x = gx;
      lead.z = gz;
      has[LEAD] = 0;
      sizeTo[LEAD] = scaleNow * 1.5;
    }
    lead.seen = true;
    lead.tx = gx;
    lead.tz = gz;
    if (down && !lead.down) lead.downAt = now;
    lead.down = down;
  }
  /** The pointer left (or the finger lifted): the lead goat is just a goat again. */
  function pointerGone() {
    lead.down = false;
    lead.held = false;
  }

  /** Every goat hops, in a wave running out from the point. */
  function whistle(clientX, clientY) {
    const [gx, gz] = clientX === undefined ? [view.x, view.z] : toGround(clientX, clientY);
    for (let i = 0; i < N; i++) {
      const d = Math.hypot(px[i] - gx, pz[i] - gz);
      hopAt[i] = now + 0.02 + d / 26;
    }
    fieldMat.uniforms.uRipple.value.set(gx, gz, now, 1);
  }

  /** Screen position of the odd-coloured goat, for the one Easter egg. */
  const oddOnScreen = () => toScreen(px[ODD], pz[ODD], 0.6 * size[ODD]);
  const leadOnScreen = () => toScreen(px[LEAD], pz[LEAD], 0.6 * size[LEAD]);

  function render(t = 0, dt = 0.016, { simulate = true } = {}) {
    const k = 1 - Math.exp(-dt * 3.2);
    view.h += (view.toH - view.h) * k;
    view.z += (view.toZ - view.z) * k;
    placeCamera();
    if (simulate) step(t, Math.min(dt, 1 / 30));
    fieldMat.uniforms.uTime.value = t;
    renderer.render(scene, cam);
  }

  /** Jump every goat straight to its place. Used for the still, reduced-motion picture. */
  function settle() {
    for (let i = 0; i < N; i++) {
      if (has[i]) {
        px[i] = tx[i];
        pz[i] = tz[i];
      }
      vx[i] = vz[i] = 0;
      wait[i] = 0;
      head[i] = rest[i];
      size[i] = sizeTo[i];
    }
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    if (onLost) onLost();
  });

  resize();
  placeCamera();
  return {
    count: N,
    view,
    resize,
    render,
    setView,
    setFormation,
    release,
    settle,
    pointer,
    pointerGone,
    whistle,
    oddOnScreen,
    leadOnScreen,
    toGround,
    toScreen,
  };
}
