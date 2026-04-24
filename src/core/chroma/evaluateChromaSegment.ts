import { clamp } from '../color/oklch';
import { evaluateHermiteScalar } from '../interpolation/hermite';

export function evaluateChromaSegment(
  value: number,
  start: number,
  end: number,
  shape: number,
  isRightSegment: boolean,
): number {
  const t = clamp(value, 0, 1);
  const delta = end - start;
  if (delta === 0) return start;

  return evaluateHermiteScalar(start, end, shape, isRightSegment, t);
}
