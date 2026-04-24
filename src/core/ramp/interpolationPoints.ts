import { normalizeHue, parseOklchColor } from '../color/oklch';
import { hueForStop } from '../hue/evaluateHue';
import type { CustomStopConfig, RampConfig, ThemeSettings } from '../types';
import { customStopIndex } from './stopMath';

export type InterpolationPointKind = 'start' | 'midpoint' | 'custom' | 'end';

export interface NumericInterpolationPoint {
  kind: InterpolationPointKind;
  position: number;
  value: number;
}

const INTERPOLATION_KIND_ORDER = {
  start: 0,
  custom: 1,
  midpoint: 2,
  end: 3,
} as const satisfies Record<InterpolationPointKind, number>;

export function buildHueInterpolationPoints(
  theme: ThemeSettings,
  ramp: RampConfig,
  customStops: CustomStopConfig[],
): NumericInterpolationPoint[] {
  const midpointLocked = ramp.customStopsMidpointLocked ?? true;
  const preset = ramp.huePreset;
  const midpointPosition = clampPointPosition((preset?.centerPosition ?? 0.5) * 1000);
  const points: NumericInterpolationPoint[] = [
    {
      kind: 'start',
      position: 0,
      value: normalizeHue(preset?.start ?? hueForStop(0, ramp)),
    },
    ...(midpointLocked
      ? []
      : [
          {
            kind: 'midpoint' as const,
            position: midpointPosition,
            value: normalizeHue(preset?.center ?? hueForStop(midpointPosition, ramp)),
          },
        ]),
    ...(customStops.map((stop) => ({
      kind: 'custom' as const,
      position: customStopIndex(stop.color, theme),
      value: parseOklchColor(stop.color).h,
    })) satisfies Array<NumericInterpolationPoint>),
    {
      kind: 'end',
      position: 1000,
      value: normalizeHue(preset?.end ?? hueForStop(1000, ramp)),
    },
  ];

  return sortNumericInterpolationPoints(points);
}

export function buildChromaInterpolationPoints(
  theme: ThemeSettings,
  ramp: RampConfig,
  customStops: CustomStopConfig[],
): NumericInterpolationPoint[] {
  const midpointLocked = ramp.customStopsMidpointLocked ?? true;
  const preset = ramp.chromaPreset;
  const points: NumericInterpolationPoint[] = [
    {
      kind: 'start',
      position: 0,
      value: preset.start,
    },
    ...(midpointLocked
      ? []
      : [
          {
            kind: 'midpoint' as const,
            position: clampPointPosition(preset.centerPosition * 1000),
            value: preset.center,
          },
        ]),
    ...(customStops.map((stop) => ({
      kind: 'custom' as const,
      position: customStopIndex(stop.color, theme),
      value: parseOklchColor(stop.color).c,
    })) satisfies Array<NumericInterpolationPoint>),
    {
      kind: 'end',
      position: 1000,
      value: preset.end,
    },
  ];

  return sortNumericInterpolationPoints(points);
}

export function sortNumericInterpolationPoints(points: NumericInterpolationPoint[]): NumericInterpolationPoint[] {
  return [...points].sort((left, right) => {
    if (left.position !== right.position) return left.position - right.position;
    return INTERPOLATION_KIND_ORDER[left.kind] - INTERPOLATION_KIND_ORDER[right.kind];
  });
}

function clampPointPosition(position: number): number {
  return Math.min(1000, Math.max(0, position));
}
