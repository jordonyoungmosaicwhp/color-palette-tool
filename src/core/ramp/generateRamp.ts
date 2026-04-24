import Color from 'colorjs.io';

import { chromaForProgress } from '../chroma/evaluateChroma';
import { getContrastMetrics } from '../color/contrast';
import { formatOklch } from '../color/format';
import { fitToSrgb } from '../color/gamut';
import { interpolateOklch, normalizeHue, parseOklchColor } from '../color/oklch';
import { evaluateHermiteScalar } from '../interpolation/hermite';
import { progress } from '../interpolation/progress';
import { sampleSpline } from '../interpolation/spline';
import { evaluateHermiteHue, hueDirectionForSegment, hueForStop } from '../hue/evaluateHue';
import { unwrapHueSeries } from '../hue/unwrapHue';
import type {
  GeneratedStop,
  OklchColor,
  RampConfig,
  StopResolution,
  ThemeSettings,
} from '../types';
import { defaultColorForStop, lightnessForStop } from './defaultColorForStop';
import {
  customStopIndex,
  dedupeCustomStops,
  nearestCanonicalCeil,
  nearestCanonicalFloor,
  sortCustomStopsByIndex,
  stopResolution,
  tryCustomStopIndex,
} from './stopMath';

type InterpolationPointKind = 'start' | 'midpoint' | 'custom' | 'end';

const INTERPOLATION_KIND_ORDER = {
  start: 0,
  custom: 1,
  midpoint: 2,
  end: 3,
} as const satisfies Record<InterpolationPointKind, number>;

interface NumericInterpolationPoint {
  kind: InterpolationPointKind;
  position: number;
  value: number;
}

export function generateRamp(theme: ThemeSettings, ramp: RampConfig): GeneratedStop[] {
  const customStops = ramp.customStops?.length
    ? sortCustomStopsByIndex(
        dedupeCustomStops(ramp.customStops ?? [], theme).filter((stop) => tryCustomStopIndex(stop.color, theme) !== null),
        theme,
      )
    : [];
  const customStopIndices = new Set(customStops.map((stop) => customStopIndex(stop.color, theme)));
  const huePoints = customStops.length ? buildHueInterpolationPoints(theme, ramp, customStops) : undefined;
  const chromaPoints = customStops.length ? buildChromaInterpolationPoints(theme, ramp, customStops) : undefined;
  const anchorOklch = !huePoints && !chromaPoints && ramp.anchor ? parseOklchColor(ramp.anchor.color) : undefined;
  const sortedStops = huePoints && chromaPoints
    ? mergeCustomStopIndices(ramp.stops, customStops, theme)
    : [...ramp.stops].sort((a, b) => a.index - b.index);

  return sortedStops.map((stop) => {
    const source = huePoints && chromaPoints
      ? colorForSegmentedInterpolationStop(stop.index, theme, ramp, huePoints, chromaPoints)
      : colorForStop(stop.index, theme, ramp, anchorOklch);
    const oklch = fitToSrgb(source);
    const color = new Color('oklch', [oklch.l, oklch.c, oklch.h], oklch.alpha ?? 1);
    const srgb = color.to('srgb');
    const hex = srgb.toString({ format: 'hex' });
    const inGamut = color.inGamut('srgb');
    const contrast = getContrastMetrics(hex);

    return {
      index: stop.index,
      resolution: stop.resolution,
      state: stop.state,
      custom: customStopIndices.has(stop.index),
      visible: stop.state !== 'hidden',
      oklch,
      cssOklch: formatOklch(oklch),
      hex,
      inGamut,
      ...contrast,
    };
  });
}

function colorForStop(
  index: number,
  theme: ThemeSettings,
  ramp: RampConfig,
  anchorOklch?: OklchColor,
): OklchColor {
  if (ramp.anchor && anchorOklch && index === ramp.anchor.stop) {
    return anchorOklch;
  }

  const hue = hueForStop(index, ramp);
  const defaultColor = defaultColorForStop(index, theme, ramp, hue);
  if (!ramp.anchor || !anchorOklch) return defaultColor;

  const anchorIndex = ramp.anchor.stop;
  const isCanonicalAnchor = anchorIndex % 100 === 0;
  const lower = isCanonicalAnchor ? Math.max(0, anchorIndex - 100) : nearestCanonicalFloor(anchorIndex);
  const upper = isCanonicalAnchor ? Math.min(1000, anchorIndex + 100) : nearestCanonicalCeil(anchorIndex);

  if (index < lower || index > upper) return defaultColor;
  if (index === lower || index === upper) return defaultColor;

  const lowerColor = defaultColorForStop(lower, theme, ramp, hueForStop(lower, ramp));
  const upperColor = defaultColorForStop(upper, theme, ramp, hueForStop(upper, ramp));

  if (index < anchorIndex) {
    return interpolateOklch(lowerColor, anchorOklch, progress(index, lower, anchorIndex), hue);
  }

  return interpolateOklch(anchorOklch, upperColor, progress(index, anchorIndex, upper), hue);
}

function buildHueInterpolationPoints(
  theme: ThemeSettings,
  ramp: RampConfig,
  sortedStops: ReturnType<typeof sortCustomStopsByIndex>,
): NumericInterpolationPoint[] {
  const midpointLocked = ramp.customStopsMidpointLocked ?? true;
  const preset = ramp.huePreset;
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
            position: Math.min(1000, Math.max(0, (preset?.centerPosition ?? 0.5) * 1000)),
            value: normalizeHue(preset?.center ?? hueForStop(Math.min(1000, Math.max(0, (preset?.centerPosition ?? 0.5) * 1000)), ramp)),
          },
        ]),
    ...(sortedStops.map((stop) => ({
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

function buildChromaInterpolationPoints(
  theme: ThemeSettings,
  ramp: RampConfig,
  sortedStops: ReturnType<typeof sortCustomStopsByIndex>,
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
            position: Math.min(1000, Math.max(0, preset.centerPosition * 1000)),
            value: preset.center,
          },
        ]),
    ...(sortedStops.map((stop) => ({
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

function mergeCustomStopIndices(
  stops: Array<{ index: number; resolution: StopResolution; state: 'default' | 'anchor' | 'hidden' }>,
  customStops: ReturnType<typeof sortCustomStopsByIndex>,
  theme: ThemeSettings,
): Array<{ index: number; resolution: StopResolution; state: 'default' | 'anchor' | 'hidden' }> {
  const byIndex = new Map(stops.map((stop) => [stop.index, stop]));

  for (const point of customStops) {
    const index = customStopIndex(point.color, theme);
    if (!byIndex.has(index)) {
      byIndex.set(index, {
        index,
        resolution: stopResolution(index),
        state: 'default',
      });
    }
  }

  return [...byIndex.values()].sort((left, right) => left.index - right.index);
}

function sortNumericInterpolationPoints(points: NumericInterpolationPoint[]): NumericInterpolationPoint[] {
  return [...points].sort((left, right) => {
    if (left.position !== right.position) return left.position - right.position;
    return INTERPOLATION_KIND_ORDER[left.kind] - INTERPOLATION_KIND_ORDER[right.kind];
  });
}

function findInterpolationSegment(points: NumericInterpolationPoint[], index: number): { left: NumericInterpolationPoint; right: NumericInterpolationPoint } | undefined {
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

function touchesEndpoint(leftKind: InterpolationPointKind, rightKind: InterpolationPointKind): boolean {
  return leftKind === 'start' || rightKind === 'end';
}

function hueShapeForSegment(ramp: RampConfig, leftKind: InterpolationPointKind, rightKind: InterpolationPointKind): number {
  const startShape = ramp.huePreset?.startShape ?? 0;
  const endShape = ramp.huePreset?.endShape ?? 0;

  if (leftKind === 'start') return startShape;
  if (rightKind === 'end') return endShape;
  return 0;
}

function chromaShapeForSegment(ramp: RampConfig, leftKind: InterpolationPointKind, rightKind: InterpolationPointKind): number {
  const startShape = ramp.chromaPreset.startShape;
  const endShape = ramp.chromaPreset.endShape;

  if (leftKind === 'start') return startShape;
  if (rightKind === 'end') return endShape;
  return 0;
}

function sampleChannelInterpolation(
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

  const ordered = sortNumericInterpolationPoints(points);
  const segment = findInterpolationSegment(ordered, index);
  if (!segment) return undefined;

  const { left, right } = segment;
  const amount = progress(index, left.position, right.position);

  if (touchesEndpoint(left.kind, right.kind)) {
    if (mode === 'hue') {
      return evaluateHermiteHue(
        left.value,
        right.value,
        hueShapeForSegment(ramp, left.kind, right.kind),
        right.kind === 'end',
        hueDirectionForSegment(ramp, left.kind, right.kind),
        amount,
      );
    }

    return evaluateHermiteScalar(
      left.value,
      right.value,
      chromaShapeForSegment(ramp, left.kind, right.kind),
      right.kind === 'end',
      amount,
    );
  }

  if (mode === 'hue') {
    return normalizeHue(sampleSpline(unwrapHueSeries(ordered.map((point) => ({ x: point.position, y: point.value }))), index));
  }

  return sampleSpline(ordered.map((point) => ({ x: point.position, y: point.value })), index);
}

function colorForSegmentedInterpolationStop(
  index: number,
  theme: ThemeSettings,
  ramp: RampConfig,
  huePoints: NumericInterpolationPoint[],
  chromaPoints: NumericInterpolationPoint[],
): OklchColor {
  return {
    mode: 'oklch',
    l: lightnessForStop(index, theme),
    c: sampleChannelInterpolation(chromaPoints, index, ramp, 'chroma') ?? chromaForProgress(index / 1000, ramp.chromaPreset),
    h: sampleChannelInterpolation(huePoints, index, ramp, 'hue') ?? hueForStop(index, ramp),
  };
}
