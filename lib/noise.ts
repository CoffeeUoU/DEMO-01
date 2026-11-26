/**
 * Deterministic 2D Perlin Gradient Noise, Fractal Brownian Motion (FBM),
 * and Ridged Multifractal Noise for organic procedural terrain, mountains, and wind fields.
 */

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Fast deterministic integer hash -> gradient index in [0..7]
function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) & 7;
}

const GRADS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.70710678, 0.70710678],
  [-0.70710678, 0.70710678],
  [0.70710678, -0.70710678],
  [-0.70710678, -0.70710678],
];

function gradDot(ix: number, iy: number, dx: number, dy: number, seed: number): number {
  const g = GRADS[hash2(ix, iy, seed)];
  return g[0] * dx + g[1] * dy;
}

/** Classic 2D Perlin Gradient Noise returning smooth values in roughly [-1, 1] */
export function perlin2D(x: number, y: number, seed = 1): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const u = fade(fx);
  const v = fade(fy);

  const n00 = gradDot(x0, y0, fx, fy, seed);
  const n10 = gradDot(x0 + 1, y0, fx - 1, fy, seed);
  const n01 = gradDot(x0, y0 + 1, fx, fy - 1, seed);
  const n11 = gradDot(x0 + 1, y0 + 1, fx - 1, fy - 1, seed);

  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
}

/**
 * 2D Fractal Brownian Motion (FBM): stacks multiple octaves of Perlin noise
 * to produce natural macro-hills + fine organic micro-relief in [-1, 1].
 */
export function fbm2D(
  x: number,
  y: number,
  octaves = 3,
  seed = 1,
  lacunarity = 2.05,
  gain = 0.5,
): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1.0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += perlin2D(x * freq, y * freq, seed + i * 31) * amp;
    norm += amp;
    freq *= lacunarity;
    amp *= gain;
  }
  return norm > 0 ? sum / norm : 0;
}

/**
 * 2D Ridged Multifractal Noise in [0, 1]: turns Perlin zero-crossings into
 * crisp alpine mountain ridges & snow crests.
 */
export function ridged2D(x: number, y: number, octaves = 3, seed = 7): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1.0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const r = 1 - Math.abs(perlin2D(x * freq, y * freq, seed + i * 47));
    sum += r * r * amp;
    norm += amp;
    freq *= 2.1;
    amp *= 0.48;
  }
  return norm > 0 ? sum / norm : 0;
}
