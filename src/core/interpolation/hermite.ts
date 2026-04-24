import { clamp } from '../color/oklch';

export function limitMonotoneTangents(delta: number, m0: number, m1: number): { m0: number; m1: number } {
  const sign = Math.sign(delta);
  if (sign === 0) return { m0: 0, m1: 0 };

  const s0 = m0 * sign;
  const s1 = m1 * sign;
  if (s0 < 0 || s1 < 0) return { m0: 0, m1: 0 };

  const total = s0 + s1;
  if (total > 3) {
    const scale = 3 / total;
    return { m0: m0 * scale, m1: m1 * scale };
  }

  return { m0, m1 };
}

export function hermite(p0: number, p1: number, m0: number, m1: number, t: number): number {
  const tt = clamp(t, 0, 1);
  const tt2 = tt * tt;
  const tt3 = tt2 * tt;
  const h00 = 2 * tt3 - 3 * tt2 + 1;
  const h10 = tt3 - 2 * tt2 + tt;
  const h01 = -2 * tt3 + 3 * tt2;
  const h11 = tt3 - tt2;
  const value = h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
  return clamp(value, Math.min(p0, p1), Math.max(p0, p1));
}

export function evaluateHermiteScalar(start: number, end: number, shape: number, isRightSegment: boolean, t: number): number {
  const delta = end - start;
  if (delta === 0) return start;

  const tangent = delta * clamp(shape, 0, 1) * 3;
  const limited = limitMonotoneTangents(delta, isRightSegment ? 0 : tangent, isRightSegment ? tangent : 0);
  return hermite(start, end, limited.m0, limited.m1, clamp(t, 0, 1));
}
