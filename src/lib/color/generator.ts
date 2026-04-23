import Color from 'colorjs.io';
import { wcagContrast } from 'culori';
import {
  clamp,
  maxInGamutChroma,
  nearestCanonicalCeil,
  nearestCanonicalFloor,
  normalizeHue,
  parseOklchColor,
  round,
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
  ThemeSettings,
  ValidationResult,
} from './types';

const CANVAS_COLOR = '#f8fafc';

export function generateRamp(theme: ThemeSettings, ramp: RampConfig): GeneratedStop[] {
  const anchorOklch = ramp.anchor ? parseOklchColor(ramp.anchor.color) : undefined;
  const sortedStops = [...ramp.stops].sort((a, b) => a.index - b.index);

  return sortedStops.map((stop) => {
    const source = colorForStop(stop.index, theme, ramp, anchorOklch);
    const oklch = fitToSrgb(source);
    const color = new Color('oklch', [oklch.l, oklch.c, oklch.h], oklch.alpha ?? 1);
    const srgb = color.to('srgb');
    const hex = srgb.toString({ format: 'hex' });
    const inGamut = color.inGamut('srgb');

    return {
      index: stop.index,
      resolution: stop.resolution,
      state: stop.state,
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
