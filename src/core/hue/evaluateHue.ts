import { clamp, normalizeHue } from '../color/oklch';
import { evaluateHermiteScalar } from '../interpolation/hermite';
import type { AnchorConfig, HueDirection, HuePreset, RampConfig } from '../types';
import { chooseHueShortestDirection, resolveHueSegmentDirections } from './hueDirection';
import { unwrapHue } from './unwrapHue';

export function hueForStop(index: number, ramp: RampConfig): number {
  if (!ramp.huePreset) return 0;
  return hueForProgress(index / 1000, ramp.huePreset, ramp.anchor);
}

export function hueForProgress(value: number, preset: HuePreset, anchor?: AnchorConfig): number {
  const t = clamp(value, 0, 1);
  const centerPosition = clamp(preset.centerPosition, 0.001, 0.999);
  const directions = resolveHueSegmentDirections(preset, anchor);
  const start = normalizeHue(preset.start);
  const center = unwrapHue(start, preset.center, directions.start);
  const end = unwrapHue(center, preset.end, directions.end);

  if (t <= centerPosition) {
    return normalizeHue(
      evaluateHueSegment(t / centerPosition, start, center, preset.startShape, false),
    );
  }

  return normalizeHue(
    evaluateHueSegment((t - centerPosition) / (1 - centerPosition), center, end, preset.endShape, true),
  );
}

export function evaluateHermiteHue(
  start: number,
  end: number,
  shape: number,
  isRightSegment: boolean,
  direction: Exclude<HueDirection, 'auto'>,
  t: number,
): number {
  const unwrappedEnd = unwrapHue(start, end, direction);
  return normalizeHue(evaluateHermiteScalar(start, unwrappedEnd, shape, isRightSegment, t));
}

export function hueDirectionForSegment(
  ramp: RampConfig,
  leftKind: 'start' | 'midpoint' | 'custom' | 'end',
  rightKind: 'start' | 'midpoint' | 'custom' | 'end',
  leftValue: number,
  rightValue: number,
): Exclude<HueDirection, 'auto'> {
  const preset = ramp.huePreset ?? {
    start: 0,
    center: 0,
    end: 0,
    centerPosition: 0.5,
    startShape: 0,
    endShape: 0,
    startDirection: 'auto' as const,
    endDirection: 'auto' as const,
  };

  if (leftKind === 'start') {
    return preset.startDirection === 'auto'
      ? chooseHueShortestDirection(leftValue, rightValue)
      : resolveHueSegmentDirections(preset, ramp.anchor).start;
  }

  if (rightKind === 'end') {
    return preset.endDirection === 'auto'
      ? chooseHueShortestDirection(leftValue, rightValue)
      : resolveHueSegmentDirections(preset, ramp.anchor).end;
  }

  return chooseHueShortestDirection(leftValue, rightValue);
}

function evaluateHueSegment(
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
