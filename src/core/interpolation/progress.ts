import { clamp } from '../color/oklch';
import type { CurveDirection, CurvePreset } from '../types';

export function progress(value: number, start: number, end: number): number {
  if (start === end) return 0;
  return (value - start) / (end - start);
}

export function shapedProgress(value: number, curve: CurvePreset, direction: CurveDirection): number {
  const t = clamp(value, 0, 1);
  if (curve === 'linear') return t;

  if (direction === 'easeIn') return easeIn(t, curve);
  if (direction === 'easeOut') return 1 - easeIn(1 - t, curve);

  return t < 0.5 ? easeIn(2 * t, curve) / 2 : 1 - easeIn(2 - 2 * t, curve) / 2;
}

function easeIn(t: number, curve: CurvePreset): number {
  if (curve === 'linear') return t;
  if (curve === 'sine') return 1 - Math.cos((t * Math.PI) / 2);
  if (curve === 'quad') return t ** 2;
  return t ** 2;
}
