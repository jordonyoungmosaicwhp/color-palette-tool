import { normalizeHue } from '../color/oklch';
import type { HueDirection } from '../types';
import { hueDirectedDelta } from './hueDirection';

export function unwrapHue(reference: number, value: number, direction: Exclude<HueDirection, 'auto'>): number {
  const start = reference;
  const target = normalizeHue(value);
  return direction === 'clockwise'
    ? start + hueDirectedDelta(start, target, direction)
    : start + hueDirectedDelta(start, target, direction);
}

export function unwrapHueSeries(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  if (points.length === 0) return [];

  const sorted = [...points].sort((a, b) => a.x - b.x);
  const unwrapped: Array<{ x: number; y: number }> = [{ ...sorted[0], y: normalizeHue(sorted[0].y) }];

  for (let index = 1; index < sorted.length; index++) {
    const previous = unwrapped[index - 1];
    const target = normalizeHue(sorted[index].y);
    const delta = ((target - previous.y + 540) % 360) - 180;
    unwrapped.push({
      x: sorted[index].x,
      y: previous.y + delta,
    });
  }

  return unwrapped;
}
