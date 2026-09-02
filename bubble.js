/**
 * bubble.js — the traveling particle orb.
 *
 * A single fixed WebGL layer. ~30k points on a Fibonacci sphere, displaced by
 * simplex "wobble" fields and curl-noise flow in the vertex shader, shaded by
 * depth so the orb reads as a solid body with a fine lattice skin. The page
 * moves; the orb stays anchored to a screen point (the active section's
 * aperture) and the camera view-offset does the travelling, so the opaque
 * page "floor" hides it everywhere except through the apertures.
 *
 * Section grammar (mirrors the reference's per-section states):
 *   hero     — morph path bubbly → preserved sphere → nebula filaments
 *   work     — curl-noise threads locked to the shell, tinted per case
 *   services — pulsing spike bursts, colour ramps to gold with progress
 *   about    — solar-corona spikes
 *   footer   — plain orb that explodes and disperses with scroll
 */
import * as THREE from './assets/three.module.js';

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uNoiseAmount;
  uniform float uCurlNoiseAmount;
  uniform float uCurlFrequency;
  uniform float uScale;
  uniform float uWobbleTypeFrom;
  uniform float uWobbleTypeTo;
  uniform float uWobbleBlend;
  uniform float uTurbulenceTangential;
  uniform float uLockShell;
  uniform float uExplode;
  uniform float uPointSize;
  uniform float uEntrance;

  attribute vec4 aRand;

  varying float vDepth;
  varying float vExplode;
  varying float vRand;
  varying float vFront;

  const float PI = 3.14159265359;

  // Simplex 4D noise — Ian McEwan, Ashima Arts (MIT)
  vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float permute(float x) { return floor(mod(((x * 34.0) + 1.0) * x, 289.0)); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float taylorInvSqrt(float r) { return 1.79284291400159 - 0.85373472095314 * r; }
  vec4 grad4(float j, vec4 ip) {
    const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
    vec4 p, s;
    p.xyz = floor(fract(vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
    p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
    s = vec4(lessThan(p, vec4(0.0)));
    p.xyz = p.xyz + (s.xyz * 2.0 - 1.0) * s.www;
    return p;
  }
  float snoise(vec4 v) {
    const vec2 C = vec2(0.138196601125010504, 0.309016994374947451);
    vec4 i = floor(v + dot(v, C.yyyy));
    vec4 x0 = v - i + dot(i, C.xxxx);
    vec4 i0;
    vec3 isX = step(x0.yzw, x0.xxx);
    vec3 isYZ = step(x0.zww, x0.yyz);
    i0.x = isX.x + isX.y + isX.z;
    i0.yzw = 1.0 - isX;
    i0.y += isYZ.x + isYZ.y;
    i0.zw += 1.0 - isYZ.xy;
    i0.z += isYZ.z;
    i0.w += 1.0 - isYZ.z;
    vec4 i3 = clamp(i0, 0.0, 1.0);
    vec4 i2 = clamp(i0 - 1.0, 0.0, 1.0);
    vec4 i1 = clamp(i0 - 2.0, 0.0, 1.0);
    vec4 x1 = x0 - i1 + 1.0 * C.xxxx;
    vec4 x2 = x0 - i2 + 2.0 * C.xxxx;
    vec4 x3 = x0 - i3 + 3.0 * C.xxxx;
    vec4 x4 = x0 - 1.0 + 4.0 * C.xxxx;
    i = mod(i, 289.0);
    float j0 = permute(permute(permute(permute(i.w) + i.z) + i.y) + i.x);
    vec4 j1 = permute(permute(permute(permute(i.w + vec4(i1.w, i2.w, i3.w, 1.0)) + i.z + vec4(i1.z, i2.z, i3.z, 1.0)) + i.y + vec4(i1.y, i2.y, i3.y, 1.0)) + i.x + vec4(i1.x, i2.x, i3.x, 1.0));
    vec4 ip = vec4(1.0 / 294.0, 1.0 / 49.0, 1.0 / 7.0, 0.0);
    vec4 p0 = grad4(j0, ip);
    vec4 p1 = grad4(j1.x, ip);
    vec4 p2 = grad4(j1.y, ip);
    vec4 p3 = grad4(j1.z, ip);
    vec4 p4 = grad4(j1.w, ip);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    p4 *= taylorInvSqrt(dot(p4, p4));
    vec3 m0 = max(0.6 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2)), 0.0);
    vec2 m1 = max(0.6 - vec2(dot(x3, x3), dot(x4, x4)), 0.0);
    m0 = m0 * m0; m1 = m1 * m1;
    return 49.0 * (dot(m0 * m0, vec3(dot(p0, x0), dot(p1, x1), dot(p2, x2))) + dot(m1 * m1, vec2(dot(p3, x3), dot(p4, x4))));
  }

  // Simplex 3D + curl
  vec3 mod289_3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289_4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute_curl(vec4 x) { return mod289_4(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt_curl(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise3(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289_3(i);
    vec4 p = permute_curl(permute_curl(permute_curl(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt_curl(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
  vec3 snoiseVec3(vec3 x) {
    float s = snoise3(vec3(x));
    float s1 = snoise3(vec3(x.y - 19.1, x.z + 33.4, x.x + 47.2));
    float s2 = snoise3(vec3(x.z + 74.2, x.x - 124.5, x.y + 99.4));
    return vec3(s, s1, s2);
  }
  vec3 curlNoise(vec3 p) {
    const float e = 0.1;
    vec3 dx = vec3(e, 0.0, 0.0);
    vec3 dy = vec3(0.0, e, 0.0);
    vec3 dz = vec3(0.0, 0.0, e);
    vec3 p_x0 = snoiseVec3(p - dx);
    vec3 p_x1 = snoiseVec3(p + dx);
    vec3 p_y0 = snoiseVec3(p - dy);
    vec3 p_y1 = snoiseVec3(p + dy);
    vec3 p_z0 = snoiseVec3(p - dz);
    vec3 p_z1 = snoiseVec3(p + dz);
    float x = p_y1.z - p_y0.z - p_z1.y + p_z0.y;
    float y = p_z1.x - p_z0.x - p_x1.z + p_x0.z;
    float z = p_x1.y - p_x0.y - p_y1.x + p_y0.x;
    const float divisor = 1.0 / (2.0 * e);
    return normalize(vec3(x, y, z) * divisor);
  }

  // Wobble fields
  float wobbleOrganic(vec3 pos, float time) { return snoise(vec4(pos / 1.5, time)); }
  float wobbleSpiky(vec3 pos, float time) {
    float noise = snoise(vec4(pos * 2.0, time * 0.5));
    return sign(noise) * pow(abs(noise), 0.3);
  }
  float wobbleSpikeBurst(vec3 pos, float time) {
    float baseNoise = snoise(vec4(pos * 3.0, time * 0.3));
    float spikeMask = smoothstep(0.6, 0.8, baseNoise);
    float spikeHeight = pow(spikeMask, 0.5) * 2.0;
    float smallSpikes = snoise(vec4(pos * 8.0, time * 0.5));
    smallSpikes = max(0.0, smallSpikes) * 0.3;
    float pulse = sin(time * 2.0) * 0.5 + 0.5;
    return spikeHeight * pulse + smallSpikes;
  }
  float wobbleCorona(vec3 pos, float time) {
    vec3 norm = normalize(pos);
    float theta = atan(norm.z, norm.x);
    float phi = asin(norm.y);
    float spikes1 = pow(max(0.0, sin(theta * 8.0 + time * 1.5)), 3.0) * 1.2;
    float spikes2 = pow(max(0.0, sin(theta * 12.0 - time * 2.0 + phi * 4.0)), 4.0) * 0.8;
    float spikes3 = pow(max(0.0, sin(theta * 6.0 + time * 0.8 - phi * 3.0)), 2.0) * 0.5;
    float eruption1 = snoise(vec4(norm * 2.0, time * 0.5));
    eruption1 = pow(max(0.0, eruption1), 2.0) * 1.5;
    float eruption2 = snoise(vec4(norm * 3.0, time * 0.3 + 50.0));
    eruption2 = pow(max(0.0, eruption2), 3.0) * 1.0;
    float pulse = 0.7 + 0.3 * sin(time * 2.0);
    return (spikes1 + spikes2 + spikes3) * pulse + eruption1 + eruption2;
  }
  float wobbleNebula(vec3 pos, float time) {
    vec3 n = normalize(pos);
    float flow1 = snoise(vec4(n * 2.5 + vec3(0.0, time * 0.2, 0.0), time * 0.15));
    float flow2 = snoise(vec4(n * 5.0 + vec3(time * 0.1, 0.0, 0.0), time * 0.25 + 50.0));
    float filament = pow(abs(flow1 + flow2 * 0.5), 0.55);
    float band = snoise(vec4(n * 1.2, time * 0.08));
    return band * 0.35 + filament * 0.75;
  }
  float getWobbleSingle(vec3 pos, float time, float wobbleType) {
    if (wobbleType < 0.5) return wobbleOrganic(pos, time);
    if (wobbleType < 1.5) return wobbleSpiky(pos, time);
    if (wobbleType < 3.5) return wobbleSpikeBurst(pos, time);
    if (wobbleType < 4.5) return wobbleCorona(pos, time);
    if (wobbleType < 9.5) return wobbleNebula(pos, time);
    return 0.0;
  }
  float getWobbleBlended(vec3 pos, float time, float typeFrom, float typeTo, float blend) {
    if (blend <= 0.001) return getWobbleSingle(pos, time, typeFrom);
    if (blend >= 0.999) return getWobbleSingle(pos, time, typeTo);
    return mix(getWobbleSingle(pos, time, typeFrom), getWobbleSingle(pos, time, typeTo), blend);
  }

  void main() {
    float time = uTime;
    vec3 scaledPosition = position * uScale * uEntrance;
    float particleRadius = length(scaledPosition);
    vec3 n = normalize(scaledPosition + vec3(0.0001));
    vec3 uPos = scaledPosition;

    float noise = 0.0;
    if (uNoiseAmount > 0.001) {
      noise = getWobbleBlended(position, time, uWobbleTypeFrom, uWobbleTypeTo, uWobbleBlend);
      uPos += n * noise * uNoiseAmount * uScale / 6.0;
    }
    if (uCurlNoiseAmount > 0.0) {
      vec3 curlPos = curlNoise(position * uCurlFrequency * 3.0 + time * 0.1);
      curlPos += curlNoise(position * uCurlFrequency * 6.0 + time * 0.15) * 0.5;
      if (uTurbulenceTangential > 0.5) curlPos -= n * dot(curlPos, n);
      uPos += curlPos * uCurlNoiseAmount * uScale * 0.35;
      if (uLockShell > 0.001) {
        vec3 locked = normalize(uPos) * particleRadius;
        uPos = mix(uPos, locked, clamp(uLockShell, 0.0, 1.0));
      }
    }

    float sizeMul = 1.0;
    vExplode = 0.0;
    if (uExplode > 0.0001) {
      float e = uExplode * uExplode;
      vec3 dir = normalize(n + aRand.xyz * 0.9);
      float speed = 0.35 + pow(aRand.w, 3.0) * 5.5;
      vec3 drift = curlNoise(position * 0.9 + time * 0.05) * 0.9;
      uPos += (dir * speed + drift) * e * uScale;
      sizeMul = 1.0 + e * (0.3 + pow(aRand.w, 4.0) * 2.4);
      vExplode = e;
    }
    vRand = aRand.w;

    vec4 modelPosition = modelMatrix * vec4(uPos, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;

    vDepth = -viewPosition.z;
    // front-ness: +1 towards the camera, -1 at the far side (in orb space)
    vec3 viewN = normalize((modelMatrix * vec4(n, 0.0)).xyz);
    vFront = viewN.z;

    gl_PointSize = (uPointSize / -viewPosition.z) * sizeMul;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform vec3 uTint;
  uniform float uTintMix;
  uniform vec3 uMixColor;
  uniform float uColorMix;
  uniform float uRimIntensity;
  uniform float uOpacity;
  uniform vec3 uExplodeA;
  uniform vec3 uExplodeB;

  varying float vDepth;
  varying float vExplode;
  varying float vRand;
  varying float vFront;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float soft = 1.0 - smoothstep(0.28, 0.5, d);

    float front = clamp(vFront, -1.0, 1.0);
    float shade = mix(0.10, 1.0, smoothstep(-1.0, 1.0, front));
    vec3 col = mix(uColor, uTint, uTintMix);
    col = mix(col, uMixColor, uColorMix * (0.4 + 0.6 * smoothstep(-0.3, 1.0, front)));
    float rim = pow(1.0 - abs(front), 3.0) * uRimIntensity;
    col += rim * 0.7;
    if (vExplode > 0.0) {
      vec3 ec = mix(uExplodeA, uExplodeB, smoothstep(0.2, 0.8, vRand));
      col = mix(col, ec, vExplode);
      shade = mix(shade, 0.75 + 0.25 * vRand, vExplode);
    }
    gl_FragColor = vec4(col * shade, soft * uOpacity);
  }
`;

// ---------- layouts ----------
function fibonacci(n) {
  const out = new Float32Array(n * 3);
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = ga * i;
    out[i * 3] = Math.cos(a) * r;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = Math.sin(a) * r;
  }
  return out;
}
function mulberry(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function jittered(n, seed = 4242, radius = 1) {
  const rnd = mulberry(seed);
  const base = fibonacci(n);
  for (let i = 0; i < n; i++) {
    const rr = radius * (1 + (rnd() - 0.5) * 0.12);
    const x = base[i * 3] + (rnd() - 0.5) * 0.08;
    const y = base[i * 3 + 1] + (rnd() - 0.5) * 0.08;
    const z = base[i * 3 + 2] + (rnd() - 0.5) * 0.08;
    const l = Math.hypot(x, y, z) || 1;
    base[i * 3] = (x / l) * rr;
    base[i * 3 + 1] = (y / l) * rr;
    base[i * 3 + 2] = (z / l) * rr;
  }
  return base;
}
/** Nested pair — a jittered shell around a denser inner sphere (footer). */
function nested(n) {
  const outerN = Math.floor(n * 0.72);
  const innerN = n - outerN;
  const outer = jittered(outerN, 777, 1);
  const inner = jittered(innerN, 999, 0.54);
  const out = new Float32Array(n * 3);
  out.set(outer, 0);
  out.set(inner, outerN * 3);
  return out;
}
const LAYOUTS = { sphere: fibonacci, sphereRandom: (n) => jittered(n, 4242, 1), nested };

const WOBBLE = { ORGANIC: 0, SPIKY: 1, SPIKE_BURST: 3, CORONA: 4, NEBULA: 9 };

const HERO_PATH = [
  { wobble: 1, wobbleType: WOBBLE.ORGANIC, curl: 0, curlFrequency: 0.05, lockShell: 0, tangential: 0 },
  { wobble: 0, wobbleType: WOBBLE.ORGANIC, curl: 0, curlFrequency: 0.05, lockShell: 1, tangential: 0 },
  { wobble: 0.56, wobbleType: WOBBLE.NEBULA, curl: 0, curlFrequency: 0.05, lockShell: 0, tangential: 0 },
];

const SECTION_STATES = {
  hero: { shape: 'sphere', wobble: 0.56, wobbleType: WOBBLE.NEBULA, curl: 0, curlFrequency: 0.05, lockShell: 0, tangential: 0, rotation: 0.3, scale: 1 },
  work: { shape: 'sphere', wobble: 0, wobbleType: WOBBLE.ORGANIC, curl: 0.98, curlFrequency: 0.36, lockShell: 1, tangential: 1, rotation: 0.4, scale: 1 },
  services: { shape: 'sphere', wobble: 1, wobbleType: WOBBLE.SPIKE_BURST, curl: 0, curlFrequency: 0.05, lockShell: 0, tangential: 0, rotation: 0.4, scale: 1 },
  about: { shape: 'sphere', wobble: 1, wobbleType: WOBBLE.CORONA, curl: 0, curlFrequency: 0.05, lockShell: 0, tangential: 0, rotation: 0.4, scale: 1 },
  footer: { shape: 'nested', wobble: 0, wobbleType: WOBBLE.ORGANIC, curl: 0, curlFrequency: 0.05, lockShell: 0, tangential: 0, rotation: 0.4, scale: 1.15 },
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function createBubble(canvas, opts = {}) {
  const COUNT = opts.count || 30000;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 8);
  const VISIBLE_H = 2 * Math.tan((50 * Math.PI) / 360) * 8; // world units spanning the viewport height

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(fibonacci(COUNT));
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const rand = new Float32Array(COUNT * 4);
  const rnd = mulberry(1337);
  for (let i = 0; i < COUNT; i++) {
    rand[i * 4] = rnd() * 2 - 1;
    rand[i * 4 + 1] = rnd() * 2 - 1;
    rand[i * 4 + 2] = rnd() * 2 - 1;
    rand[i * 4 + 3] = rnd();
  }
  geometry.setAttribute('aRand', new THREE.BufferAttribute(rand, 4));

  const uniforms = {
    uTime: { value: 0 },
    uNoiseAmount: { value: 0 },
    uCurlNoiseAmount: { value: 0 },
    uCurlFrequency: { value: 0.05 },
    uScale: { value: 1 },
    uWobbleTypeFrom: { value: 0 },
    uWobbleTypeTo: { value: 0 },
    uWobbleBlend: { value: 1 },
    uTurbulenceTangential: { value: 0 },
    uLockShell: { value: 1 },
    uExplode: { value: 0 },
    uPointSize: { value: 7.5 * dpr },
    uEntrance: { value: 0 },
    uColor: { value: new THREE.Color(0.85, 0.88, 0.92) },
    uTint: { value: new THREE.Color(0.85, 0.88, 0.92) },
    uTintMix: { value: 0 },
    uMixColor: { value: new THREE.Color(0.92, 0.66, 0.22) },
    uColorMix: { value: 0 },
    uRimIntensity: { value: 0 },
    uOpacity: { value: 1 },
    uExplodeA: { value: new THREE.Color(0.98, 0.62, 0.28) },
    uExplodeB: { value: new THREE.Color(0.36, 0.56, 1.0) },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  const group = new THREE.Group();
  group.add(points);
  scene.add(group);

  // ----- state -----
  let width = 1, height = 1;
  const target = { x: 0.5, y: 0.5, px: 200 };      // screen center (px) + pixel radius
  const shown = { x: 0.5, y: 0.5, px: 200 };
  let section = 'hero';
  let state = { ...SECTION_STATES.hero };
  let cur = { wobble: 0, curl: 0, curlFrequency: 0.05, lockShell: 1, tangential: 0 };
  let wobbleFrom = WOBBLE.ORGANIC, wobbleTo = WOBBLE.ORGANIC, wobbleBlend = 1;
  let heroPath = 0;          // 0..1 along HERO_PATH
  let heroPathTarget = 0;
  let heroTimeDriven = true; // until the user scrolls, the hero path plays on a clock
  let startTime = null;
  let entrance = 0;
  let explode = 0, explodeShown = 0;
  let tintTarget = null, tintMixTarget = 0;
  let colorMixTarget = 0, rimTarget = 0;
  let morph = null;          // {from, to, t, speed}
  let currentShape = 'sphere';
  let rotY = 0;
  let mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let glide = null;          // {from:{x,y,px}, to, t, dur}
  let lastT = 0;
  let visible = true;

  function resize() {
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => {
    mouse.tx = (e.clientX / width) * 2 - 1;
    mouse.ty = (e.clientY / height) * 2 - 1;
  }, { passive: true });

  function applyShape(name, speed = 1.5) {
    if (name === currentShape && !morph) return;
    const to = (LAYOUTS[name] || LAYOUTS.sphere)(COUNT);
    const from = new Float32Array(geometry.attributes.position.array);
    morph = { from, to, t: 0, speed };
    currentShape = name;
  }

  function setWobbleType(type) {
    if (type === wobbleTo) return;
    wobbleFrom = wobbleTo;
    wobbleTo = type;
    wobbleBlend = 0;
  }

  function resolveHero(p) {
    const segs = HERO_PATH.length - 1;
    const s = Math.min(segs - 1, Math.floor(p * segs));
    const local = clamp01(p * segs - s);
    const a = HERO_PATH[s], b = HERO_PATH[s + 1];
    return {
      wobble: lerp(a.wobble, b.wobble, local),
      curl: lerp(a.curl, b.curl, local),
      curlFrequency: lerp(a.curlFrequency, b.curlFrequency, local),
      lockShell: lerp(a.lockShell, b.lockShell, local),
      tangential: local > 0.5 ? b.tangential : a.tangential,
      from: a.wobbleType, to: b.wobbleType, blend: local,
    };
  }

  const api = {
    /** Screen anchor: center in px + the aperture size in px (sphere fits ~78% of it). */
    setTarget(cx, cy, boxPx, immediate = false) {
      const next = { x: cx, y: cy, px: boxPx * 0.35 };
      if (immediate || !startTime) {
        Object.assign(target, next); Object.assign(shown, next); glide = null; return;
      }
      if (Math.abs(next.x - target.x) > 40 || Math.abs(next.y - target.y) > 40 || Math.abs(next.px - target.px) > 20) {
        glide = { from: { ...shown }, to: next, t: 0, dur: 1.0 };
      } else {
        Object.assign(shown, next);
      }
      Object.assign(target, next);
    },
    /** Track the anchor continuously (pinned aperture that itself moves, e.g. a sliding strip). */
    trackTarget(cx, cy, boxPx) {
      const next = { x: cx, y: cy, px: boxPx * 0.35 };
      Object.assign(target, next);
      if (!glide) Object.assign(shown, next);
      else glide.to = next;
    },
    setSection(name) {
      if (name === section) return;
      section = name;
      state = { ...SECTION_STATES[name] };
      applyShape(state.shape, name === 'footer' ? 0.6 : 1.5);
      setWobbleType(state.wobbleType);
      heroTimeDriven = false;
    },
    setHeroPath(p) { heroPathTarget = clamp01(p); heroTimeDriven = false; },
    setTint(rgb, mix = 0.85) {
      if (!rgb) { tintMixTarget = 0; return; }
      tintTarget = new THREE.Color(rgb); tintMixTarget = mix;
    },
    setServicesMix(p) { colorMixTarget = clamp01(p); rimTarget = 0.6 * clamp01(p); },
    setExplode(p) { explode = clamp01(p); },
    setVisible(v) { visible = v; },
    get section() { return section; },
    render(nowMs) {
      if (startTime === null) startTime = nowMs;
      const t = (nowMs - startTime) / 1000;
      const dt = Math.min(0.05, lastT ? t - lastT : 0.016);
      lastT = t;

      // entrance: 0 → 1 over 1.2 s, expo-out
      const e = Math.min(1, t / 1.2);
      entrance = e >= 1 ? 1 : 1 - Math.pow(2, -10 * e);

      // hero path: on a 3.5 s clock until scroll takes over
      if (section === 'hero') {
        if (heroTimeDriven) heroPathTarget = Math.min(1, t / 3.5);
        heroPath = lerp(heroPath, heroPathTarget, 0.12);
        const h = resolveHero(heroPath);
        cur.wobble = lerp(cur.wobble, h.wobble, 0.1);
        cur.curl = lerp(cur.curl, h.curl, 0.1);
        cur.curlFrequency = lerp(cur.curlFrequency, h.curlFrequency, 0.1);
        cur.lockShell = lerp(cur.lockShell, h.lockShell, 0.15);
        cur.tangential = h.tangential;
        wobbleFrom = h.from; wobbleTo = h.to; wobbleBlend = h.blend;
      } else {
        cur.wobble = lerp(cur.wobble, state.wobble, 0.1);
        cur.curl = lerp(cur.curl, state.curl, 0.1);
        cur.curlFrequency = lerp(cur.curlFrequency, state.curlFrequency, 0.1);
        cur.lockShell = lerp(cur.lockShell, state.lockShell, 0.15);
        cur.tangential = state.tangential;
        wobbleBlend = Math.min(1, wobbleBlend + dt * 1.5);
      }

      // morph between layouts
      if (morph) {
        morph.t = Math.min(1, morph.t + dt * morph.speed);
        const k = morph.t < 1 ? 1 - Math.pow(1 - morph.t, 3) : 1;
        const arr = geometry.attributes.position.array;
        const { from, to } = morph;
        for (let i = 0; i < arr.length; i++) arr[i] = from[i] + (to[i] - from[i]) * k;
        geometry.attributes.position.needsUpdate = true;
        if (morph.t >= 1) morph = null;
      }

      // colour work
      const u = uniforms;
      if (tintTarget) u.uTint.value.lerp(tintTarget, 0.08);
      u.uTintMix.value = lerp(u.uTintMix.value, tintMixTarget, 0.08);
      u.uColorMix.value = lerp(u.uColorMix.value, colorMixTarget, 0.1);
      u.uRimIntensity.value = lerp(u.uRimIntensity.value, rimTarget, 0.1);
      explodeShown = lerp(explodeShown, explode, 0.12);

      u.uTime.value = t;
      u.uEntrance.value = entrance;
      u.uNoiseAmount.value = lerp(u.uNoiseAmount.value, cur.curl < 0.1 ? cur.wobble : 0, 0.2);
      u.uCurlNoiseAmount.value = lerp(u.uCurlNoiseAmount.value, cur.curl, 0.1);
      u.uCurlFrequency.value = lerp(u.uCurlFrequency.value, cur.curlFrequency, 0.1);
      u.uLockShell.value = cur.lockShell;
      u.uTurbulenceTangential.value = lerp(u.uTurbulenceTangential.value, cur.tangential, 0.15);
      u.uWobbleTypeFrom.value = wobbleFrom;
      u.uWobbleTypeTo.value = wobbleTo;
      u.uWobbleBlend.value = wobbleBlend;
      u.uExplode.value = explodeShown;
      u.uOpacity.value = lerp(u.uOpacity.value, visible ? 1 : 0, 0.15);

      // anchor glide
      if (glide) {
        glide.t = Math.min(1, glide.t + dt / glide.dur);
        const k = 1 - Math.pow(1 - glide.t, 3);
        shown.x = lerp(glide.from.x, glide.to.x, k);
        shown.y = lerp(glide.from.y, glide.to.y, k);
        shown.px = lerp(glide.from.px, glide.to.px, k);
        if (glide.t >= 1) glide = null;
      }
      const worldPerPx = VISIBLE_H / height;
      u.uScale.value = shown.px * worldPerPx * state.scale;
      camera.setViewOffset(width, height, Math.round(width / 2 - shown.x), Math.round(height / 2 - shown.y), width, height);
      camera.updateProjectionMatrix();

      // rotation + mouse tilt
      rotY += dt * state.rotation * 0.45 + dt * explodeShown * 1.2;
      mouse.x = lerp(mouse.x, mouse.tx, 0.05);
      mouse.y = lerp(mouse.y, mouse.ty, 0.05);
      group.rotation.y = rotY + mouse.x * 0.2;
      group.rotation.x = mouse.y * 0.12;

      renderer.render(scene, camera);
    },
    dispose() { renderer.dispose(); geometry.dispose(); material.dispose(); },
  };
  return api;
}
