import { chromaForProgress } from '../chroma/evaluateChroma';
import { normalizeHue } from '../color/oklch';
import { evaluateHermiteScalar } from '../interpolation/hermite';
import { progress } from '../interpolation/progress';
import { sampleSpline } from '../interpolation/spline';
import { evaluateHermiteHue, hueDirectionForSegment, hueForStop } from '../hue/evaluateHue';
import { unwrapHueSeries } from '../hue/unwrapHue';
import type { RampConfig } from '../types';
import type { NumericInterpolationPoint } from './interpolationPoints';
import { findInterpolationSegment, shapeForSegment, touchesEndpoint } from './segmentRouting';

export function sampleChannelInterpolation(
  points: NumericInterpolationPoint[],
  index: number,
  ramp: RampConfig,
  mode: 'hue' | 'chroma',
): number | undefined {
  if (points.length === 0) return undefined;

  const exact = points.find((point) => point.position === index);
  if (exact) {
    return mode === 'hue' ? normalizeHue(exact.value) : exact.value;
  }

  if (points.length === 1) {
    return mode === 'hue' ? normalizeHue(points[0].value) : points[0].value;
  }

  const segment = findInterpolationSegment(points, index);
  if (!segment) return undefined;

  const { left, right } = segment;
  const amount = progress(index, left.position, right.position);

  if (touchesEndpoint(left.kind, right.kind)) {
    const shape = shapeForSegment(ramp, mode, left.kind, right.kind);

    if (mode === 'hue') {
      return evaluateHermiteHue(
        left.value,
        right.value,
        shape,
        right.kind === 'end',
        hueDirectionForSegment(ramp, left.kind, right.kind),
        amount,
      );
    }

    return evaluateHermiteScalar(
      left.value,
      right.value,
      shape,
      right.kind === 'end',
      amount,
    );
  }

  if (mode === 'hue') {
    return normalizeHue(sampleSpline(unwrapHueSeries(points.map((point) => ({ x: point.position, y: point.value }))), index));
  }

  return sampleSpline(points.map((point) => ({ x: point.position, y: point.value })), index);
}

export function sampleSegmentedRampChannels(
  index: number,
  ramp: RampConfig,
  huePoints: NumericInterpolationPoint[],
  chromaPoints: NumericInterpolationPoint[],
): { c: number; h: number } {
  return {
    c: sampleChannelInterpolation(chromaPoints, index, ramp, 'chroma') ?? chromaForProgress(index / 1000, ramp.chromaPreset),
    h: sampleChannelInterpolation(huePoints, index, ramp, 'hue') ?? hueForStop(index, ramp),
  };
}
