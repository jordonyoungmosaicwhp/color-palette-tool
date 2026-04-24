import type { RampConfig } from '../types';
import type { InterpolationPointKind, NumericInterpolationPoint } from './interpolationPoints';

export interface InterpolationSegment {
  left: NumericInterpolationPoint;
  right: NumericInterpolationPoint;
}

export function findInterpolationSegment(points: NumericInterpolationPoint[], index: number): InterpolationSegment | undefined {
  for (let i = 0; i < points.length - 1; i++) {
    const left = points[i];
    const right = points[i + 1];
    if (right.position <= left.position) continue;
    if (index >= left.position && index <= right.position) {
      return { left, right };
    }
  }

  return undefined;
}

export function touchesEndpoint(leftKind: InterpolationPointKind, rightKind: InterpolationPointKind): boolean {
  return leftKind === 'start' || rightKind === 'end';
}

export function shapeForSegment(
  ramp: RampConfig,
  mode: 'hue' | 'chroma',
  leftKind: InterpolationPointKind,
  rightKind: InterpolationPointKind,
): number {
  if (mode === 'hue') {
    const startShape = ramp.huePreset?.startShape ?? 0;
    const endShape = ramp.huePreset?.endShape ?? 0;

    if (leftKind === 'start') return startShape;
    if (rightKind === 'end') return endShape;
    return 0;
  }

  const startShape = ramp.chromaPreset.startShape;
  const endShape = ramp.chromaPreset.endShape;

  if (leftKind === 'start') return startShape;
  if (rightKind === 'end') return endShape;
  return 0;
}
