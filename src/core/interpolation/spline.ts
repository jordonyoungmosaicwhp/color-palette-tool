import { hermite, limitMonotoneTangents } from './hermite';
import { computePchipDerivatives } from './pchip';
import { progress } from './progress';

export function sampleSpline(points: Array<{ x: number; y: number }>, x: number): number {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0].y;

  const deduped: Array<{ x: number; y: number }> = [];
  for (const point of sorted) {
    if (deduped.at(-1)?.x === point.x) {
      deduped[deduped.length - 1] = point;
    } else {
      deduped.push(point);
    }
  }

  if (deduped.length === 1) return deduped[0].y;
  if (x <= deduped[0].x) return deduped[0].y;
  if (x >= deduped[deduped.length - 1].x) return deduped[deduped.length - 1].y;

  const segmentIndex = deduped.findIndex((point, index) => index < deduped.length - 1 && x >= point.x && x <= deduped[index + 1].x);
  const i = segmentIndex >= 0 ? segmentIndex : deduped.length - 2;
  const derivatives = computePchipDerivatives(deduped);
  const left = deduped[i];
  const right = deduped[i + 1];
  const amount = progress(x, left.x, right.x);
  const segmentLength = right.x - left.x;
  const delta = right.y - left.y;
  const limited = limitMonotoneTangents(delta, derivatives[i] * segmentLength, derivatives[i + 1] * segmentLength);
  return hermite(left.y, right.y, limited.m0, limited.m1, amount);
}
