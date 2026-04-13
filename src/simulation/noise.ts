import { lerp, smoothstep } from './random';

const hash2d = (seed: number, x: number, y: number): number => {
  let value = seed ^ (x * 374761393) ^ (y * 668265263);
  value = (value ^ (value >> 13)) * 1274126177;
  return ((value ^ (value >> 16)) >>> 0) / 0xffffffff;
};

const gradient = (seed: number, x: number, y: number): { x: number; y: number } => {
  const angle = hash2d(seed, x, y) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
};

const dotGradient = (seed: number, ix: number, iy: number, x: number, y: number): number => {
  const grad = gradient(seed, ix, iy);
  return grad.x * (x - ix) + grad.y * (y - iy);
};

export const perlin2d = (seed: number, x: number, y: number): number => {
  const x0 = Math.floor(x);
  const x1 = x0 + 1;
  const y0 = Math.floor(y);
  const y1 = y0 + 1;

  const sx = smoothstep(x - x0);
  const sy = smoothstep(y - y0);

  const n0 = dotGradient(seed, x0, y0, x, y);
  const n1 = dotGradient(seed, x1, y0, x, y);
  const ix0 = lerp(n0, n1, sx);

  const n2 = dotGradient(seed, x0, y1, x, y);
  const n3 = dotGradient(seed, x1, y1, x, y);
  const ix1 = lerp(n2, n3, sx);

  return lerp(ix0, ix1, sy);
};

export const octavePerlin = (
  seed: number,
  x: number,
  y: number,
  octaves: number,
  persistence: number,
): number => {
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  let normalization = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    total += perlin2d(seed + octave * 97, x * frequency, y * frequency) * amplitude;
    normalization += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return normalization === 0 ? 0 : total / normalization;
};
