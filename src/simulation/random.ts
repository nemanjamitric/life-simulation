export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smoothstep = (value: number): number => value * value * (3 - 2 * value);

export const average = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  public next = (): number => {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0xffffffff;
  };

  public range = (min: number, max: number): number => min + this.next() * (max - min);

  public int = (min: number, max: number): number => Math.floor(this.range(min, max + 1));

  public pick = <T>(items: T[]): T => items[Math.floor(this.next() * items.length)];
}
