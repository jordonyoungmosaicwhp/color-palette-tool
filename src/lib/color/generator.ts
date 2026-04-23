import Color from 'colorjs.io';
import { wcagContrast } from 'culori';
import {
  clamp,
  customStopIndex,
  dedupeCustomStops,
  maxInGamutChroma,
  nearestCanonicalCeil,
  nearestCanonicalFloor,
  normalizeHue,
  parseOklchColor,
  round,
  stopResolution,
  sortCustomStopsByIndex,
} from './model';
import type {
  AnchorConfig,
  ChromaPreset,
  CurveDirection,
  CurvePreset,
  GeneratedStop,
  HueDirection,
  HuePreset,
  OklchColor,
  RampConfig,
  StopResolution,
  ThemeSettings,
  ValidationResult,
} from './types';

const CANVAS_COLOR = '#f8fafc';

export function generateRamp(theme: ThemeSettings, ramp: RampConfig): GeneratedStop[] {
  const customStopPoints = ramp.customStops?.length ? buildCustomStopPoints(theme, ramp) : undefined;
  const anchorOklch = !customStopPoints && ramp.anchor ? parseOklchColor(ramp.anchor.color) : undefined;
  const sortedStops = customStopPoints
    ? mergeCustomStopIndices(ramp.stops, customStopPoints)
    : [...ramp.stops].sort((a, b) => a.index - b.index);

  return sortedStops.map((stop) => {
    const source = customStopPoints
      ? colorForCustomStop(stop.index, theme, ramp, customStopPoints)
      : colorForStop(stop.index, theme, ramp, anchorOklch);
    const oklch = fitToSrgb(source);
    const color = new Color('oklch', [oklch.l, oklch.c, oklch.h], oklch.alpha ?? 1);
    const srgb = color.to('srgb');
    const hex = srgb.toString({ format: 'hex' });
    const inGamut = color.inGamut('srgb');

    return {
      index: stop.index,
      resolution: stop.resolution,
      state: stop.state,
      custom: Boolean(customStopPoints?.some((point) => point.index === stop.index)),
      visible: stop.state !== 'hidden',
      oklch,
      cssOklch: formatOklch(oklch),
      hex,
      inGamut,
      labelColor: readableTextColor(hex),
      contrastOnWhite: round(wcagContrast(hex, '#ffffff'), 2),
      contrastOnBlack: round(wcagContrast(hex, '#000000'), 2),
      contrastOnCanvas: round(wcagContrast(hex, CANVAS_COLOR), 2),
    };
  });
}

export function validateGeneratedStops(stops: GeneratedStop[]): ValidationResult {
  const blockingStops = stops.filter((stop) => stop.visible && !stop.inGamut).map((stop) => stop.index);
  const warningStops = stops.filter((stop) => !stop.visible && !stop.inGamut).map((stop) => stop.index);

  return {
    hasBlockingIssues: blockingStops.length > 0,
    blockingStops,
    warningStops,
  };
}

export function formatOklch(color: OklchColor): string {
  return `oklch(${round(color.l * 100, 2)}% ${round(color.c, 4)} ${round(color.h, 2)})`;
}

export function readableTextColor(hex: string): '#111111' | '#ffffff' {
  const contrastOnLight = wcagContrast(hex, '#111111');
  const contrastOnDark = wcagContrast(hex, '#ffffff');
  return contrastOnLight >= contrastOnDark ? '#111111' : '#ffffff';
}

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

export function normalizeHueDirection(preset: HuePreset, anchor?: AnchorConfig): HueDirection {
  const explicit = preset.direction;
  if (explicit === 'clockwise' || explicit === 'counterclockwise') {
    return huePathContainsMidpoint(preset, explicit, anchor) ? explicit : 'auto';
  }

  return 'auto';
}

export function resolveHuePathDirection(preset: HuePreset, anchor?: AnchorConfig): Exclude<HueDirection, 'auto'> {
  const normalized = normalizeHueDirection(preset, anchor);
  if (normalized === 'clockwise' || normalized === 'counterclockwise') return normalized;

  if (huePathContainsMidpoint(preset, 'clockwise', anchor)) return 'clockwise';
  if (huePathContainsMidpoint(preset, 'counterclockwise', anchor)) return 'counterclockwise';
  return 'clockwise';
}

function resolveHueSegmentDirections(
  preset: HuePreset,
  anchor?: AnchorConfig,
): { start: Exclude<HueDirection, 'auto'>; end: Exclude<HueDirection, 'auto'> } {
  const explicit = normalizeHueDirection(preset, anchor);
  if (explicit === 'clockwise' || explicit === 'counterclockwise') {
    return { start: explicit, end: explicit };
  }

  return {
    start: chooseHueShortestDirection(preset.start, preset.center),
    end: chooseHueShortestDirection(preset.center, preset.end),
  };
}

export function shapedProgress(value: number, curve: CurvePreset, direction: CurveDirection): number {
  const t = clamp(value, 0, 1);
  if (curve === 'linear') return t;

  if (direction === 'easeIn') return easeIn(t, curve);
  if (direction === 'easeOut') return 1 - easeIn(1 - t, curve);

  return t < 0.5 ? easeIn(2 * t, curve) / 2 : 1 - easeIn(2 - 2 * t, curve) / 2;
}

function huePathContainsMidpoint(preset: HuePreset, direction: Exclude<HueDirection, 'auto'>, anchor?: AnchorConfig, tolerance = 0.5): boolean {
  const start = normalizeHue(preset.start);
  const center = normalizeHue(preset.center);
  const end = normalizeHue(preset.end);
  const total = hueDirectedDelta(start, end, direction);
  const throughCenter = hueDirectedDelta(start, center, direction);

  if (Math.abs(total) <= tolerance) {
    return true;
  }

  return direction === 'clockwise'
    ? throughCenter >= -tolerance && throughCenter <= total + tolerance
    : throughCenter <= tolerance && throughCenter >= total - tolerance;
}

function unwrapHue(reference: number, value: number, direction: Exclude<HueDirection, 'auto'>): number {
  const start = reference;
  const target = normalizeHue(value);
  return direction === 'clockwise' ? start + hueDirectedDelta(start, target, direction) : start + hueDirectedDelta(start, target, direction);
}

function chooseHueShortestDirection(from: number, to: number): Exclude<HueDirection, 'auto'> {
  const clockwise = hueDirectedDelta(from, to, 'clockwise');
  const counterclockwise = hueDirectedDelta(from, to, 'counterclockwise');

  return Math.abs(clockwise) <= Math.abs(counterclockwise) ? 'clockwise' : 'counterclockwise';
}

function hueDirectedDelta(from: number, to: number, direction: Exclude<HueDirection, 'auto'>): number {
  const normalizedFrom = normalizeHue(from);
  const normalizedTo = normalizeHue(to);
  if (direction === 'clockwise') {
    return (normalizedTo - normalizedFrom + 360) % 360;
  }

  return -((normalizedFrom - normalizedTo + 360) % 360);
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

  const tangent = delta * clamp(shape, 0, 1) * 3;
  const limited = limitMonotoneTangents(delta, isRightSegment ? 0 : tangent, isRightSegment ? tangent : 0);
  return hermite(start, end, limited.m0, limited.m1, t);
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

function buildCustomStopPoints(theme: ThemeSettings, ramp: RampConfig): Array<{ index: number; color: OklchColor }> {
  const sortedStops = sortCustomStopsByIndex(dedupeCustomStops(ramp.customStops ?? [], theme), theme);
  const points = [
    {
      index: 0,
      color: defaultColorForStop(0, theme, ramp, hueForStop(0, ramp)),
    },
    ...(sortedStops.map((stop) => ({
      index: customStopIndex(stop.color, theme),
      color: parseOklchColor(stop.color),
    })) satisfies Array<{ index: number; color: OklchColor }>),
    {
      index: 1000,
      color: defaultColorForStop(1000, theme, ramp, hueForStop(1000, ramp)),
    },
  ];

  return uniqueByIndex(points).sort((a, b) => a.index - b.index);
}

function colorForCustomStop(
  index: number,
  theme: ThemeSettings,
  ramp: RampConfig,
  points: Array<{ index: number; color: OklchColor }>,
): OklchColor {
  const exact = points.find((point) => point.index === index);
  if (exact) return exact.color;

  const sample = sampleCustomStopSpline(points, index);
  if (!sample) return defaultColorForStop(index, theme, ramp, hueForStop(index, ramp));

  return sample;
}

function mergeCustomStopIndices(
  stops: Array<{ index: number; resolution: StopResolution; state: 'default' | 'anchor' | 'hidden' }>,
  points: Array<{ index: number; color: OklchColor }>,
): Array<{ index: number; resolution: StopResolution; state: 'default' | 'anchor' | 'hidden' }> {
  const byIndex = new Map(stops.map((stop) => [stop.index, stop]));

  for (const point of points) {
    if (!byIndex.has(point.index)) {
      byIndex.set(point.index, {
        index: point.index,
        resolution: stopResolution(point.index),
        state: 'default',
      });
    }
  }

  return [...byIndex.values()].sort((left, right) => left.index - right.index);
}

function sampleCustomStopSpline(points: Array<{ index: number; color: OklchColor }>, index: number): OklchColor | undefined {
  if (points.length === 0) return undefined;
  if (points.length === 1) return points[0].color;
  const l = sampleSpline(
    points.map((point) => ({ x: point.index, y: point.color.l })),
    index,
  );
  const c = sampleSpline(
    points.map((point) => ({ x: point.index, y: point.color.c })),
    index,
  );
  const h = normalizeHue(
    sampleSpline(
      unwrapHueSeries(points.map((point) => ({ x: point.index, y: point.color.h }))),
      index,
    ),
  );

  return {
    mode: 'oklch',
    l,
    c,
    h,
  };
}

function unwrapHueSeries(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
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

function sampleSpline(points: Array<{ x: number; y: number }>, x: number): number {
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
  const pointsForDerivatives = deduped;
  const derivatives = computePchipDerivatives(pointsForDerivatives);
  const left = deduped[i];
  const right = deduped[i + 1];
  const amount = progress(x, left.x, right.x);
  const segmentLength = right.x - left.x;
  const delta = right.y - left.y;
  const limited = limitMonotoneTangents(delta, derivatives[i] * segmentLength, derivatives[i + 1] * segmentLength);
  return hermite(left.y, right.y, limited.m0, limited.m1, amount);
}

function computePchipDerivatives(points: Array<{ x: number; y: number }>): number[] {
  const n = points.length;
  if (n === 0) return [];
  if (n === 1) return [0];
  if (n === 2) {
    const slope = (points[1].y - points[0].y) / (points[1].x - points[0].x);
    return [slope, slope];
  }

  const h: number[] = [];
  const delta: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const spacing = points[i + 1].x - points[i].x;
    h.push(spacing);
    delta.push((points[i + 1].y - points[i].y) / spacing);
  }

  const derivatives = new Array<number>(n).fill(0);
  derivatives[0] = endpointDerivative(h[0], h[1], delta[0], delta[1]);
  derivatives[n - 1] = endpointDerivative(h[n - 2], h[n - 3] ?? h[n - 2], delta[n - 2], delta[n - 3] ?? delta[n - 2]);

  for (let i = 1; i < n - 1; i++) {
    const prev = delta[i - 1];
    const next = delta[i];
    if (prev === 0 || next === 0 || Math.sign(prev) !== Math.sign(next)) {
      derivatives[i] = 0;
      continue;
    }

    const w1 = 2 * h[i] + h[i - 1];
    const w2 = h[i] + 2 * h[i - 1];
    derivatives[i] = (w1 + w2) / (w1 / prev + w2 / next);
  }

  return derivatives;
}

function endpointDerivative(h0: number, h1: number, d0: number, d1: number): number {
  const derivative = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
  if (Math.sign(derivative) !== Math.sign(d0)) return 0;
  if (Math.sign(d0) !== Math.sign(d1) && Math.abs(derivative) > Math.abs(3 * d0)) return 3 * d0;
  return derivative;
}

function uniqueByIndex(points: Array<{ index: number; color: OklchColor }>): Array<{ index: number; color: OklchColor }> {
  const byIndex = new Map<number, { index: number; color: OklchColor }>();
  for (const point of points) {
    byIndex.set(point.index, point);
  }
  return [...byIndex.values()];
}

function defaultColorForStop(index: number, theme: ThemeSettings, ramp: RampConfig, hue: number): OklchColor {
  const t = index / 1000;
  const l = clamp(theme.lMax + (theme.lMin - theme.lMax) * t, 0, 1);
  return {
    mode: 'oklch',
    l,
    c: chromaForProgress(t, ramp.chromaPreset),
    h: hue,
  };
}

export function chromaForProgress(value: number, preset: ChromaPreset): number {
  const t = clamp(value, 0, 1);
  const centerPosition = clamp(preset.centerPosition, 0.001, 0.999);

  if (t <= centerPosition) {
    return round(
      evaluateChromaSegment(
        t / centerPosition,
        preset.start,
        preset.center,
        preset.startShape,
        false,
      ),
      4,
    );
  }

  return round(
    evaluateChromaSegment(
      (t - centerPosition) / (1 - centerPosition),
      preset.center,
      preset.end,
      preset.endShape,
      true,
    ),
    4,
  );
}

function evaluateChromaSegment(
  value: number,
  start: number,
  end: number,
  shape: number,
  isRightSegment: boolean,
): number {
  const t = clamp(value, 0, 1);
  const delta = end - start;
  if (delta === 0) return start;

  const tangent = delta * clamp(shape, 0, 1) * 3;
  const limited = limitMonotoneTangents(delta, isRightSegment ? 0 : tangent, isRightSegment ? tangent : 0);
  return hermite(start, end, limited.m0, limited.m1, t);
}

function limitMonotoneTangents(delta: number, m0: number, m1: number): { m0: number; m1: number } {
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

function hermite(p0: number, p1: number, m0: number, m1: number, t: number): number {
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

function easeIn(t: number, curve: CurvePreset): number {
  if (curve === 'linear') return t;
  if (curve === 'sine') return 1 - Math.cos((t * Math.PI) / 2);
  if (curve === 'quad') return t ** 2;
  return t ** 2;
}

function interpolateOklch(from: OklchColor, to: OklchColor, amount: number, hue: number): OklchColor {
  const t = clamp(amount, 0, 1);

  return {
    mode: 'oklch',
    l: from.l + (to.l - from.l) * t,
    c: from.c + (to.c - from.c) * t,
    h: hue,
  };
}

function progress(value: number, start: number, end: number): number {
  if (start === end) return 0;
  return (value - start) / (end - start);
}

function fitToSrgb(color: OklchColor): OklchColor {
  const candidate = new Color('oklch', [color.l, color.c, color.h], color.alpha ?? 1);
  if (candidate.inGamut('srgb')) return color;

  return {
    ...color,
    c: Math.max(0, Math.min(color.c, maxInGamutChroma(color.l, color.h, 0.0001, color.c))),
  };
}
