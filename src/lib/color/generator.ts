import Color from 'colorjs.io';
import { wcagContrast } from 'culori';
import {
  clamp,
  nearestCanonicalCeil,
  nearestCanonicalFloor,
  normalizeHue,
  parseOklchColor,
  round,
} from './model';
import type { ChromaPreset, CurveDirection, CurvePreset, GeneratedStop, OklchColor, RampConfig, ThemeSettings, ValidationResult } from './types';

const CANVAS_COLOR = '#f8fafc';

export function generateRamp(theme: ThemeSettings, ramp: RampConfig): GeneratedStop[] {
  const anchorOklch = ramp.anchor ? parseOklchColor(ramp.anchor.color) : undefined;
  const sortedStops = [...ramp.stops].sort((a, b) => a.index - b.index);

  return sortedStops.map((stop) => {
    const oklch = colorForStop(stop.index, theme, ramp, anchorOklch);
    const mapped = toSrgb(oklch);
    const inGamut = mapped.inGamut('srgb');
    const hex = mapped.toString({ format: 'hex' });

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
  if (ramp.huePreset?.type === 'range') {
    const t = shapedProgress(index / 1000, ramp.huePreset.curve, ramp.huePreset.direction);
    const start = normalizeHue(ramp.huePreset.start);
    const end = normalizeHue(ramp.huePreset.end);
    const distance =
      ramp.huePreset.rotation === 'clockwise'
        ? (end - start + 360) % 360
        : -((start - end + 360) % 360);

    return normalizeHue(start + distance * t);
  }

  return normalizeHue(ramp.huePreset?.hue ?? ramp.hue);
}

export function shapedProgress(value: number, curve: CurvePreset, direction: CurveDirection): number {
  const t = clamp(value, 0, 1);
  if (curve === 'linear') return t;

  if (direction === 'easeIn') return easeIn(t, curve);
  if (direction === 'easeOut') return 1 - easeIn(1 - t, curve);

  return t < 0.5 ? easeIn(2 * t, curve) / 2 : 1 - easeIn(2 - 2 * t, curve) / 2;
}

export function anchorHueIsOnPath(ramp: RampConfig, tolerance = 0.5): boolean {
  if (!ramp.anchor || ramp.huePreset?.type !== 'range') return true;

  const anchorHue = parseOklchColor(ramp.anchor.color).h;
  const start = normalizeHue(ramp.huePreset.start);
  const end = normalizeHue(ramp.huePreset.end);

  if (Math.abs(start - end) <= tolerance) {
    const directDelta = Math.abs(normalizeHue(anchorHue) - start);
    return Math.min(directDelta, 360 - directDelta) <= tolerance;
  }

  if (ramp.huePreset.rotation === 'clockwise') {
    const total = (end - start + 360) % 360;
    const anchorDistance = (anchorHue - start + 360) % 360;
    return anchorDistance <= total + tolerance;
  }

  const total = (start - end + 360) % 360;
  const anchorDistance = (start - anchorHue + 360) % 360;
  return anchorDistance <= total + tolerance;
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
  const t = shapedProgress(value, preset.curve, preset.direction);
  const ratedProgress = t <= 0 ? 0 : t >= 1 ? 1 : t ** Math.max(0.05, preset.rate);
  return round(Math.max(0, preset.start + (preset.end - preset.start) * ratedProgress), 4);
}

function easeIn(t: number, curve: CurvePreset): number {
  if (curve === 'linear') return t;
  if (curve === 'sine') return 1 - Math.cos((t * Math.PI) / 2);
  if (curve === 'quad') return t ** 2;
  if (curve === 'cubic') return t ** 3;
  if (curve === 'quart') return t ** 4;
  if (curve === 'quint') return t ** 5;
  if (curve === 'expo') return t === 0 ? 0 : 2 ** (10 * t - 10);
  if (curve === 'circ') return 1 - Math.sqrt(1 - t ** 2);

  const overshoot = 1.70158;
  return (overshoot + 1) * t ** 3 - overshoot * t ** 2;
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

function toSrgb(color: OklchColor): Color {
  const next = new Color('oklch', [color.l, color.c, color.h], color.alpha ?? 1);
  return next.toGamut({ space: 'srgb', method: 'lch.c' });
}
