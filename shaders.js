/* Acid Warp HD - Pattern Catalog & WebGL2 Shaders */
(function () {
  'use strict';

  /**
   * 24 Mathematical & GPU-Evolved Patterns.
   * Indices match the switch statement in PATTERN_FRAGMENT_SHADER.
   */
  const PATTERNS = [
    // Classic Acid Warp inspirations (0..11)
    { id: 0,  name: 'Acid Eye',          category: 'Classic', desc: 'Iconic hypnotic iris & polar vortex' },
    { id: 1,  name: 'Polar Ripples',     category: 'Classic', desc: 'Radial waves twisted by angular sines' },
    { id: 2,  name: 'Spiral Vortex',     category: 'Classic', desc: 'Multi-arm logarithmic spiral interference' },
    { id: 3,  name: 'Interference Grid', category: 'Classic', desc: 'Classic sinusoidal plasma wave lattice' },
    { id: 4,  name: 'Pinwheel Star',     category: 'Classic', desc: 'Twisted harmonic radial blades' },
    { id: 5,  name: 'Hyper Tunnel',      category: 'Classic', desc: 'Infinite reciprocal warp conduit' },
    { id: 6,  name: 'Twin Dipole',       category: 'Classic', desc: 'Dual orbiting magnetic wave sources' },
    { id: 7,  name: 'Quadripole Field',  category: 'Classic', desc: 'Four-pole harmonic phase tapestry' },
    { id: 8,  name: 'Concentric Bloom',  category: 'Classic', desc: 'Petal-modulated concentric rings' },
    { id: 9,  name: 'Torsion Checker',   category: 'Classic', desc: 'Warped non-linear polar checkerboard' },
    { id: 10, name: 'Rose Mandala',      category: 'Classic', desc: 'Rhodonea floral harmonic contours' },
    { id: 11, name: 'Lissajous Weave',   category: 'Classic', desc: 'Interwoven sine ribbon geometry' },

    // Modern GPU Evolution patterns (12..23)
    { id: 12, name: 'Liquid Plasma',     category: 'Modern',  desc: 'Domain-warped fluid harmonic eddies' },
    { id: 13, name: 'Julia Fractal',     category: 'Modern',  desc: 'Smooth-escaped animated Julia set' },
    { id: 14, name: 'Seahorse Valley',   category: 'Modern',  desc: 'Deep Mandelbrot fractal spiral' },
    { id: 15, name: 'Voronoi Cells',     category: 'Modern',  desc: 'Organic glowing cellular membranes' },
    { id: 16, name: 'Kaleido Crystal',   category: 'Modern',  desc: 'Recursive folded prismatic geometry' },
    { id: 17, name: 'Mobius Torus',      category: 'Modern',  desc: 'Conformal Mobius bipolar transformation' },
    { id: 18, name: 'Electric Arcs',     category: 'Modern',  desc: 'Ridged multifractal plasma currents' },
    { id: 19, name: 'Quasicrystal',      category: 'Modern',  desc: '7-fold Penrose wave interference' },
    { id: 20, name: 'Gravity Well',      category: 'Modern',  desc: 'Twin black-hole gravitational lensing' },
    { id: 21, name: 'Silk Curtains',     category: 'Modern',  desc: 'Flowing folded iridescent light ribbons' },
    { id: 22, name: 'Hexa Hive',         category: 'Modern',  desc: 'Pulsing hexagonal distance contours' },
    { id: 23, name: 'Cosmic Nebula',     category: 'Modern',  desc: 'Multi-octave warped astral clouds' }
  ];

  const FULLSCREEN_VERTEX_SHADER = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  // Fullscreen triangle without vertex buffer
  vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = pos;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}
`;

  const PATTERN_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;           // Field motion time (scales with motion slider)
uniform float uCyclePhase;     // Continuous palette cycling offset
uniform float uColorScale;     // Palette band frequency
uniform float uWarpAmount;     // Organic domain warp amount (0..1)
uniform float uKaleido;        // Kaleidoscope fold segments (0 = off, >= 3 = active)
uniform float uSheen;          // Subtle 3D specular contour sheen (0..1)
uniform int uPatternA;
uniform int uPatternB;
uniform float uPatternMix;     // 0 = A, 1 = B
uniform sampler2D uPaletteTex; // 256x1 RGBA seamless cyclic palette

const float PI = 3.14159265359;
const float TAU = 6.28318530718;

// Safe helpers
float safeAtan(float y, float x) {
  return atan(y, abs(x) < 1e-5 && abs(y) < 1e-5 ? 1e-5 : x);
}

mat2 rot2(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

// Fast 2D hash & value noise for modern GPU patterns
vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = m * p * 2.02 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

float ridgedFbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  mat2 m = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    float n = 1.0 - abs(vnoise(p) * 2.0 - 1.0);
    v += a * n * n;
    p = m * p * 2.05 + vec2(3.1, 5.7);
    a *= 0.5;
  }
  return v;
}

// Apply optional kaleidoscopic symmetry folding
vec2 applyKaleido(vec2 p, float segments) {
  if (segments < 2.5) return p;
  float r = length(p);
  float a = safeAtan(p.y, p.x);
  float sector = TAU / segments;
  a = mod(a, sector);
  a = abs(a - sector * 0.5);
  return vec2(cos(a), sin(a)) * r;
}

// Apply smooth liquid domain warping
vec2 applyWarp(vec2 p, float amount, float t) {
  if (amount <= 0.001) return p;
  vec2 q = p;
  float wx = sin(q.y * 2.3 + t * 0.7) * cos(q.x * 1.9 - t * 0.5);
  float wy = cos(q.x * 2.1 + t * 0.6) * sin(q.y * 2.4 + t * 0.4);
  vec2 p1 = p + vec2(wx, wy) * (0.28 * amount);
  float wx2 = sin(p1.y * 4.1 - t * 0.9 + p1.x * 1.7);
  float wy2 = cos(p1.x * 3.9 + t * 0.8 - p1.y * 1.5);
  return p1 + vec2(wx2, wy2) * (0.12 * amount);
}

// Evaluate any of the 24 patterns -> continuous scalar field
float evalPattern(int id, vec2 p, float t) {
  float r = length(p);
  float a = safeAtan(p.y, p.x);

  // 0: Acid Eye - Iconic concentric iris + radial waves
  if (id == 0) {
    vec2 q = p * vec2(0.82, 1.18);
    float eye = length(vec2(q.x, q.y * (1.0 + 0.35 * cos(q.x * 1.8))));
    float iris = sin(eye * 9.0 - t * 0.8) * 0.35 + eye * 1.8;
    float rays = 0.25 * sin(a * 12.0 + sin(r * 5.0 - t * 0.6) * 2.0);
    float pupil = exp(-r * r * 14.0) * 1.8;
    return iris + rays - pupil + 0.3 * cos(r * 4.0 + a * 3.0);
  }

  // 1: Polar Ripples - Classic Acid Warp distance + angular sine
  if (id == 1) {
    float wave = r * 2.2 + 0.55 * sin(a * 5.0 + t * 0.5) + 0.35 * cos(r * 6.0 - a * 3.0 + t * 0.7);
    return wave + 0.25 * sin(p.x * 3.5) * cos(p.y * 3.5);
  }

  // 2: Spiral Vortex - Multi-arm logarithmic spiral
  if (id == 2) {
    float lr = log(max(r, 0.004));
    float s1 = a * 3.0 / TAU + lr * 0.95 - t * 0.12;
    float s2 = 0.35 * sin(lr * 6.0 - a * 4.0 + t * 0.6);
    return s1 * 1.6 + s2 + 0.3 * sin(r * 5.0 - t * 0.5);
  }

  // 3: Interference Grid - Classic multi-wave plasma lattice
  if (id == 3) {
    float v = 0.0;
    v += sin(p.x * 4.2 + t * 0.7);
    v += sin(p.y * 4.2 - t * 0.6);
    v += sin((p.x + p.y) * 3.1 + t * 0.5);
    v += sin(length(p + vec2(sin(t * 0.4), cos(t * 0.3)) * 0.45) * 6.0);
    return v * 0.45;
  }

  // 4: Pinwheel Starburst - Twisted harmonic blades
  if (id == 4) {
    float twist = a + r * 1.35 * sin(t * 0.25 + 1.0) + 0.5 * r;
    float blades = sin(twist * 7.0) * 0.55 + cos(a * 14.0 - r * 4.0 + t * 0.5) * 0.28;
    return blades + r * 1.45;
  }

  // 5: Hyper Tunnel - Infinite 1/r warp tunnel
  if (id == 5) {
    float invR = 0.55 / (r + 0.14);
    float ribs = 0.32 * sin(a * 8.0 + invR * 2.2 - t * 0.8);
    float swirl = 0.25 * cos(a * 4.0 - invR * 3.0 + t * 0.5);
    return invR * 0.95 - t * 0.35 + ribs + swirl;
  }

  // 6: Twin Dipole - Dual orbiting wave interference
  if (id == 6) {
    vec2 c1 = vec2(cos(t * 0.35), sin(t * 0.35)) * 0.52;
    vec2 c2 = -c1;
    float d1 = length(p - c1);
    float d2 = length(p - c2);
    float a1 = safeAtan(p.y - c1.y, p.x - c1.x);
    float a2 = safeAtan(p.y - c2.y, p.x - c2.x);
    return (d1 + d2) * 1.1 + 0.45 * sin((d1 - d2) * 10.0) + (a1 - a2) / TAU * 1.5;
  }

  // 7: Quadripole Field - Four-source phase interference
  if (id == 7) {
    float rot = t * 0.22;
    float sum = 0.0;
    for (int i = 0; i < 4; i++) {
      float ang = rot + float(i) * (PI * 0.5);
      vec2 c = vec2(cos(ang), sin(ang)) * 0.58;
      float d = length(p - c);
      sum += sin(d * 8.5 - t * 0.6 + float(i) * 1.57) * 0.35 + d * 0.45;
    }
    return sum;
  }

  // 8: Concentric Bloom - Petal-modulated ripples
  if (id == 8) {
    float petals = 0.28 * sin(a * 6.0 + t * 0.4) + 0.14 * cos(a * 12.0 - t * 0.6);
    float rad = r + petals * (0.6 + 0.4 * sin(r * 4.0));
    return rad * 2.3 + 0.4 * sin(rad * 11.0 - t * 0.9);
  }

  // 9: Torsion Checker - Non-linear polar checkerboard
  if (id == 9) {
    float tw = a + sin(r * 3.0 - t * 0.4) * 0.65;
    float cx = sin(tw * 8.0);
    float cy = sin(log(max(r, 0.005)) * 7.0 - t * 0.7);
    return cx * cy * 0.9 + r * 1.1 + 0.3 * cos(a * 4.0 + r * 5.0);
  }

  // 10: Rose Mandala - Rhodonea floral interference
  if (id == 10) {
    float k = 5.0;
    float rose1 = abs(r - 0.65 * abs(cos(k * a + t * 0.25)));
    float rose2 = abs(r - 0.55 * abs(sin(3.0 * a - t * 0.3)));
    return (rose1 + rose2) * 2.2 + 0.35 * sin((rose1 - rose2) * 14.0);
  }

  // 11: Lissajous Weave - Woven harmonic sine ribbons
  if (id == 11) {
    vec2 q = rot2(t * 0.12) * p;
    float w1 = sin(q.x * 5.0 + sin(q.y * 4.0 + t * 0.5) * 1.8);
    float w2 = cos(q.y * 5.0 + cos(q.x * 4.0 - t * 0.4) * 1.8);
    float w3 = sin((q.x * q.y) * 5.5 + t * 0.3);
    return (w1 + w2) * 0.55 + w3 * 0.4 + r * 0.75;
  }

  // 12: Liquid Plasma - Layered trigonometric domain-warped fluid
  if (id == 12) {
    vec2 q = p * 1.8;
    for (int i = 1; i <= 4; i++) {
      float fi = float(i);
      q.x += 0.45 / fi * sin(fi * 2.1 * q.y + t * 0.45 + fi * 1.3);
      q.y += 0.45 / fi * cos(fi * 2.1 * q.x - t * 0.38 + fi * 2.1);
    }
    return sin(q.x * 1.6 + q.y * 1.4) * 0.75 + length(q) * 0.45;
  }

  // 13: Julia Fractal - Smooth-iteration animated Julia set
  if (id == 13) {
    vec2 z = p * 1.32;
    vec2 c = vec2(-0.745, 0.186) + 0.085 * vec2(cos(t * 0.31), sin(t * 0.27));
    float iter = 0.0;
    float maxIter = 44.0;
    for (int i = 0; i < 44; i++) {
      z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
      if (dot(z, z) > 16.0) break;
      iter += 1.0;
    }
    if (iter < maxIter) {
      float logZn = log(dot(z, z)) * 0.5;
      float nu = log(max(logZn / log(2.0), 1e-4)) / log(2.0);
      iter = iter + 1.0 - nu;
      return iter * 0.11;
    }
    return length(z) * 0.6 + 2.4;
  }

  // 14: Seahorse Valley - Smooth Mandelbrot zoom orbit
  if (id == 14) {
    float zoom = 0.36 + 0.18 * sin(t * 0.18);
    vec2 center = vec2(-0.743643, 0.131825);
    vec2 c = center + rot2(t * 0.08) * p * zoom;
    vec2 z = vec2(0.0);
    float iter = 0.0;
    float trap = 10.0;
    float maxIter = 52.0;
    for (int i = 0; i < 52; i++) {
      z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
      float d2 = dot(z, z);
      trap = min(trap, abs(length(z) - 0.5));
      if (d2 > 16.0) break;
      iter += 1.0;
    }
    if (iter < maxIter) {
      float logZn = log(dot(z, z)) * 0.5;
      float nu = log(max(logZn / log(2.0), 1e-4)) / log(2.0);
      return (iter + 1.0 - nu) * 0.095;
    }
    return trap * 2.5 + 3.0;
  }

  // 15: Voronoi Cells - Organic glowing cellular membranes
  if (id == 15) {
    vec2 g = p * 3.1;
    vec2 n = floor(g);
    vec2 f = fract(g);
    float d1 = 8.0;
    float d2 = 8.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 b = vec2(float(i), float(j));
        vec2 rnd = hash22(n + b);
        vec2 pt = b + 0.5 + 0.42 * sin(t * 0.55 + TAU * rnd) - f;
        float d = length(pt);
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
    float edge = d2 - d1;
    return d1 * 1.65 + exp(-edge * 6.0) * 0.75 + 0.35 * sin(d1 * 10.0 - t * 0.8);
  }

  // 16: Kaleido Crystal - Recursive space-folding prismatic mandala
  if (id == 16) {
    vec2 q = p * 1.15;
    float acc = 0.0;
    for (int i = 0; i < 5; i++) {
      q = abs(q) - vec2(0.42, 0.36);
      q = rot2(0.65 + t * 0.09 + float(i) * 0.25) * q;
      q *= 1.28;
      acc += exp(-abs(length(q) - 0.55) * 4.0) * 0.45;
    }
    return acc + length(q) * 0.32 + sin(q.x * 2.5 - q.y * 2.5) * 0.35;
  }

  // 17: Mobius Torus - Conformal Mobius transformation
  if (id == 17) {
    // w = (z - a) / (z + a)
    vec2 aPole = vec2(0.55 * cos(t * 0.25), 0.55 * sin(t * 0.25));
    vec2 num = p - aPole;
    vec2 den = p + aPole;
    float den2 = max(dot(den, den), 0.002);
    vec2 w = vec2(num.x * den.x + num.y * den.y, num.y * den.x - num.x * den.y) / den2;
    float lr = log(max(length(w), 0.004));
    float ang = safeAtan(w.y, w.x);
    return lr * 0.65 + ang / TAU * 2.0 + 0.35 * sin(lr * 5.0 - ang * 3.0 + t * 0.7);
  }

  // 18: Electric Arcs - Ridged multifractal plasma veins
  if (id == 18) {
    vec2 q = p * 2.2;
    float n1 = ridgedFbm(q + vec2(t * 0.18, -t * 0.14));
    float n2 = ridgedFbm(q * 1.45 + vec2(n1 * 1.6, -n1 * 1.2) - t * 0.2);
    return n1 * 1.2 + n2 * 1.65;
  }

  // 19: Quasicrystal - 7-fold Penrose wave interference
  if (id == 19) {
    vec2 q = p * 8.5;
    float sum = 0.0;
    for (int i = 0; i < 7; i++) {
      float ang = float(i) * (PI / 7.0) + t * 0.05;
      vec2 dir = vec2(cos(ang), sin(ang));
      sum += cos(dot(q, dir) + t * 0.55);
    }
    return sum * 0.38 + r * 0.6;
  }

  // 20: Gravity Well - Warped spacetime rings & twin black-hole lensing
  if (id == 20) {
    vec2 b1 = vec2(cos(t * 0.32), sin(t * 0.32)) * 0.45;
    vec2 b2 = -b1;
    vec2 d1 = p - b1;
    vec2 d2 = p - b2;
    float r1 = max(length(d1), 0.04);
    float r2 = max(length(d2), 0.04);
    vec2 lensed = p + d1 * (0.09 / (r1 * r1 + 0.04)) + d2 * (0.09 / (r2 * r2 + 0.04));
    float grid = sin(lensed.x * 7.0) * sin(lensed.y * 7.0);
    return grid * 0.55 + 0.45 / (r1 + 0.15) + 0.45 / (r2 + 0.15);
  }

  // 21: Silk Curtains - Flowing folded iridescent light ribbons
  if (id == 21) {
    vec2 q = p;
    float v = 0.0;
    for (int i = 1; i <= 5; i++) {
      float fi = float(i);
      float wave = sin(q.x * (2.0 + fi * 0.8) + t * 0.35 * fi + sin(q.y * 2.5 - t * 0.25) * 1.4);
      v += abs(q.y - wave * 0.38) * (0.55 / fi);
      q = rot2(0.45) * q;
    }
    return v * 2.1 + 0.35 * sin(r * 5.0 - t * 0.5);
  }

  // 22: Hexa Hive - Pulsing hexagonal grid distance contours
  if (id == 22) {
    vec2 q = rot2(t * 0.08) * p * 3.6;
    const vec2 s = vec2(1.0, 1.7320508);
    vec2 aHex = mod(q, s) - s * 0.5;
    vec2 bHex = mod(q - s * 0.5, s) - s * 0.5;
    vec2 gv = dot(aHex, aHex) < dot(bHex, bHex) ? aHex : bHex;
    vec2 idHex = q - gv;
    vec2 av = abs(gv);
    float hexDist = max(dot(av, normalize(s)), av.x);
    float pulse = 0.35 * sin(length(idHex) * 1.4 - t * 0.9);
    return hexDist * 3.2 + pulse + length(idHex) * 0.28;
  }

  // 23: Cosmic Nebula - Multi-octave domain-warped clouds
  vec2 q = p * 1.9;
  vec2 w1 = vec2(fbm(q + vec2(0.0, t * 0.12)), fbm(q + vec2(5.2, 1.3 - t * 0.1)));
  vec2 w2 = vec2(fbm(q + 3.2 * w1 + vec2(1.7, 9.2 + t * 0.08)), fbm(q + 3.2 * w1 + vec2(8.3, 2.8 - t * 0.09)));
  float neb = fbm(q + 2.8 * w2);
  return neb * 3.2 + length(w2) * 0.9;
}

float evalScene(vec2 p) {
  vec2 q = applyKaleido(p, uKaleido);
  q = applyWarp(q, uWarpAmount, uTime);

  if (uPatternMix <= 0.001) {
    return evalPattern(uPatternA, q, uTime);
  } else if (uPatternMix >= 0.999) {
    return evalPattern(uPatternB, q, uTime);
  } else {
    float vA = evalPattern(uPatternA, q, uTime);
    float vB = evalPattern(uPatternB, q, uTime);
    // Smooth hermite crossfade of scalar fields -> genuine morphing!
    float m = smoothstep(0.0, 1.0, uPatternMix);
    return mix(vA, vB, m);
  }
}

void main() {
  vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  vec2 p = (vUv * 2.0 - 1.0) * aspect;

  float field = evalScene(p);

  // Sample cyclic palette texture with smooth wrapping
  float palCoord = fract(field * uColorScale + uCyclePhase);
  vec3 col = texture(uPaletteTex, vec2(palCoord, 0.5)).rgb;

  // Optional subtle 3D iridescent relief shading via screen-space derivatives
  if (uSheen > 0.001) {
    float dx = dFdx(field);
    float dy = dFdy(field);
    vec3 nrm = normalize(vec3(-dx * 28.0, -dy * 28.0, 1.0));
    vec3 lightDir = normalize(vec3(0.45, 0.55, 0.72));
    float spec = pow(max(dot(nrm, lightDir), 0.0), 14.0);
    float diff = 0.85 + 0.25 * max(dot(nrm, lightDir), 0.0);
    col = col * mix(1.0, diff, uSheen * 0.65) + vec3(spec * uSheen * 0.42);
  }

  fragColor = vec4(col, 1.0);
}
`;

  const POST_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSceneTex;
uniform vec2 uResolution;
uniform float uTime;
uniform float uBloom;      // 0..1 glow halo intensity
uniform float uChroma;     // 0..1 radial chromatic prism dispersion
uniform float uPixelSize;  // 0 = crisp HD, >1 = retro pixelation block size
uniform float uVignette;   // 0..1 subtle cinema edge framing
uniform int uEdgeMaskMode; // 0=Off, 1=Organic Cloud, 2=Liquid Wave, 3=Soft Oval, 4=Petal Halo
uniform float uEdgeInset;  // 0..1 how far inward black border extends
uniform float uEdgeSoft;   // 0..1 edge feather softness

vec3 sampleScene(vec2 uv) {
  return texture(uSceneTex, clamp(uv, vec2(0.001), vec2(0.999))).rgb;
}

float computeProjectionMask(vec2 uv, float t, int mode, float inset, float soft) {
  if (mode == 0) return 1.0;

  vec2 c = (uv - 0.5) * 2.0; // -1..1 on both axes
  float r = length(c);
  float ang = atan(c.y, abs(c.x) < 1e-5 && abs(c.y) < 1e-5 ? 1e-5 : c.x);
  float edgeBox = max(abs(c.x), abs(c.y));

  // Guarantee zero straight-edge light at the physical projector rectangle
  float safety = 1.0 - smoothstep(0.91, 0.995, edgeBox);

  float feather = mix(0.035, 0.42, soft);
  float d = 0.0;

  if (mode == 1) {
    // Organic Cloud: asymmetric undulating irregular silhouette
    float w = 0.0;
    w += 0.075 * sin(ang * 3.0 + t * 0.24);
    w += 0.055 * cos(ang * 5.0 - t * 0.19 + 1.1);
    w += 0.038 * sin(ang * 7.0 + t * 0.15 + 2.3);
    w += 0.045 * sin(c.x * 3.4 + t * 0.21) * cos(c.y * 3.1 - t * 0.17);
    float radius = mix(0.90, 0.48, inset);
    d = (r + w) - radius;
  } else if (mode == 2) {
    // Liquid Wave: wide wall-filling irregular bays & curved cutouts along all 4 sides
    float wx = 0.105 * sin(c.y * 3.6 + t * 0.28) + 0.065 * cos(c.y * 6.4 - t * 0.22 + 0.8);
    float wy = 0.105 * cos(c.x * 3.4 - t * 0.25) + 0.065 * sin(c.x * 6.2 + t * 0.19 + 1.5);
    float bx = abs(c.x) + wx;
    float by = abs(c.y) + wy;
    // Smooth superellipse blend eliminates sharp rectangular corners
    float shaped = pow(pow(max(bx, 0.001), 2.8) + pow(max(by, 0.001), 2.8), 1.0 / 2.8);
    float radius = mix(0.93, 0.54, inset);
    d = shaped - radius;
  } else if (mode == 3) {
    // Soft Oval: clean elliptical pure-black wall portal
    float radius = mix(0.96, 0.52, inset);
    d = r - radius;
  } else {
    // Petal Halo: slowly rotating psychedelic floral border
    float w = 0.095 * cos(ang * 5.0 + t * 0.18) + 0.05 * sin(ang * 3.0 - t * 0.23) + 0.03 * cos(ang * 9.0 + t * 0.12);
    float radius = mix(0.88, 0.48, inset);
    d = (r + w) - radius;
  }

  float mask = 1.0 - smoothstep(-feather, feather * 0.45, d);
  return mask * safety;
}

void main() {
  vec2 uv = vUv;

  // Optional retro VGA pixelation mode
  float scanline = 1.0;
  if (uPixelSize > 1.5) {
    vec2 grid = max(vec2(16.0), floor(uResolution / uPixelSize));
    uv = (floor(uv * grid) + 0.5) / grid;
    // Subtle retro CRT scanline shimmer when heavily pixelated
    float scanStrength = clamp((uPixelSize - 2.0) / 10.0, 0.0, 0.16);
    scanline = 1.0 - scanStrength * (0.5 + 0.5 * sin(vUv.y * uResolution.y * 3.14159 / max(uPixelSize * 0.5, 1.0)));
  }

  vec2 centered = uv - 0.5;
  float dist = length(centered);

  // Chromatic prism dispersion
  vec3 baseCol;
  if (uChroma > 0.001) {
    vec2 dir = centered * (0.014 * uChroma * (0.4 + dist * 1.4));
    float r = sampleScene(uv + dir).r;
    float g = sampleScene(uv).g;
    float b = sampleScene(uv - dir).b;
    baseCol = vec3(r, g, b);
  } else {
    baseCol = sampleScene(uv);
  }

  // Dual-ring soft neon bloom/glow
  if (uBloom > 0.001) {
    vec2 texel = 1.0 / max(uResolution, vec2(1.0));
    vec3 glow = vec3(0.0);
    float totalW = 0.0;

    // 12-tap dual-radius golden-angle blur kernel
    const float RAD1 = 4.5;
    const float RAD2 = 12.0;
    for (int i = 0; i < 6; i++) {
      float a = float(i) * 1.04719755;
      vec2 d = vec2(cos(a), sin(a));
      vec3 s1 = sampleScene(uv + d * texel * RAD1);
      vec3 s2 = sampleScene(uv + d * texel * RAD2);
      // Extract bright highlights for soft neon halo
      float l1 = dot(s1, vec3(0.299, 0.587, 0.114));
      float l2 = dot(s2, vec3(0.299, 0.587, 0.114));
      glow += s1 * smoothstep(0.32, 1.0, l1) * 1.1;
      glow += s2 * smoothstep(0.28, 1.0, l2) * 0.75;
      totalW += 1.85;
    }
    glow /= totalW;
    baseCol += glow * (uBloom * 0.95);
    // Soft filmic rolloff to prevent harsh clipping
    baseCol = baseCol / (1.0 + max(baseCol - 0.85, vec3(0.0)) * 0.45);
  }

  // Apply scanlines if retro mode active
  baseCol *= scanline;

  // Subtle vignette
  if (uVignette > 0.001) {
    float vig = 1.0 - smoothstep(0.42, 1.05, dist) * (0.42 * uVignette);
    baseCol *= vig;
  }

  // Projection non-straight pure-black edge mask (applied last so zero bloom bleeds to edges)
  if (uEdgeMaskMode > 0) {
    float projMask = computeProjectionMask(vUv, uTime, uEdgeMaskMode, uEdgeInset, uEdgeSoft);
    baseCol *= projMask;
  }

  fragColor = vec4(clamp(baseCol, 0.0, 1.0), 1.0);
}
`;

  window.AcidWarp = window.AcidWarp || {};
  window.AcidWarp.Shaders = {
    PATTERNS,
    FULLSCREEN_VERTEX_SHADER,
    PATTERN_FRAGMENT_SHADER,
    POST_FRAGMENT_SHADER
  };
})();
