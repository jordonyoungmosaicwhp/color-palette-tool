import Color from 'colorjs.io';

import { getContrastMetrics } from '../color/contrast';
import { formatOklch } from '../color/format';
import { fitToSrgb } from '../color/gamut';
import { interpolateOklch, parseOklchColor } from '../color/oklch';
import { progress } from '../interpolation/progress';
import { hueForStop } from '../hue/evaluateHue';
import type { GeneratedStop, OklchColor, RampConfig, ThemeSettings } from '../types';
import { mergeCustomStopIndices, prepareCustomStops } from './customStops';
import { defaultColorForStop, lightnessForStop } from './defaultColorForStop';
import { buildChromaInterpolationPoints, buildHueInterpolationPoints, type NumericInterpolationPoint } from './interpolationPoints';
import { nearestCanonicalCeil, nearestCanonicalFloor } from './stopMath';
import { sampleSegmentedRampChannels } from './segmentedInterpolation';

export function generateRamp(theme: ThemeSettings, ramp: RampConfig): GeneratedStop[] {
  const { customStops, customStopIndices } = prepareCustomStops(theme, ramp);
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
      inGamut: color.inGamut('srgb'),
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

function colorForSegmentedInterpolationStop(
  index: number,
  theme: ThemeSettings,
  ramp: RampConfig,
  huePoints: NumericInterpolationPoint[],
  chromaPoints: NumericInterpolationPoint[],
): OklchColor {
  const channels = sampleSegmentedRampChannels(index, ramp, huePoints, chromaPoints);

  return {
    mode: 'oklch',
    l: lightnessForStop(index, theme),
    c: channels.c,
    h: channels.h,
  };
}
