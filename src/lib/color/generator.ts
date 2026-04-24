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
  tryCustomStopIndex,
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
type InterpolationPointKind = 'start' | 'midpoint' | 'custom' | 'end';

const INTERPOLATION_KIND_ORDER = {
  start: 0,
  custom: 1,
  midpoint: 2,
  end: 3,
} as const satisfies Record<InterpolationPointKind, number>;

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
  return normalizeHueSegmentDirection(preset, 'start', anchor);
}

export function resolveHuePathDirection(preset: HuePreset, anchor?: AnchorConfig): Exclude<HueDirection, 'auto'> {
  return resolveHueSegmentDirection(preset, 'start', anchor);
}

function resolveHueSegmentDirections(
  preset: HuePreset,
  anchor?: AnchorConfig,
): { start: Exclude<HueDirection, 'auto'>; end: Exclude<HueDirection, 'auto'> } {
  return {
    start: resolveHueSegmentDirection(preset, 'start', anchor),
    end: resolveHueSegmentDirection(preset, 'end', anchor),
  };
}

function normalizeHueSegmentDirection(
  preset: HuePreset,
  segment: 'start' | 'end',
  anchor?: AnchorConfig,
): HueDirection {
  const explicit = segment === 'start' ? preset.startDirection : preset.endDirection;
  if (explicit === 'clockwise' || explicit === 'counterclockwise') {
    return huePathContainsMidpoint(preset, explicit, anchor, segment) ? explicit : 'auto';
  }

  return 'auto';
}

function resolveHueSegmentDirection(
  preset: HuePreset,
  segment: 'start' | 'end',
  anchor?: AnchorConfig,
): Exclude<HueDirection, 'auto'> {
  const normalized = normalizeHueSegmentDirection(preset, segment, anchor);
  if (normalized === 'clockwise' || normalized === 'counterclockwise') return normalized;

  const from = segment === 'start' ? preset.start : preset.center;
  const to = segment === 'start' ? preset.center : preset.end;
  return chooseHueShortestDirection(from, to);
}

export function shapedProgress(value: number, curve: CurvePreset, direction: CurveDirection): number {
  const t = clamp(value, 0, 1);
  if (curve === 'linear') return t;

  if (direction === 'easeIn') return easeIn(t, curve);
  if (direction === 'easeOut') return 1 - easeIn(1 - t, curve);

  return t < 0.5 ? easeIn(2 * t, curve) / 2 : 1 - easeIn(2 - 2 * t, curve) / 2;
}

function huePathContainsMidpoint(
  preset: HuePreset,
  direction: Exclude<HueDirection, 'auto'>,
  anchor?: AnchorConfig,
  segment: 'start' | 'end' = 'start',
  tolerance = 0.5,
): boolean {
  const from = normalizeHue(segment === 'start' ? preset.start : preset.center);
  const through = normalizeHue(segment === 'start' ? preset.center : preset.end);
  const to = through;
  const total = hueDirectedDelta(from, to, direction);
  const throughCenter = hueDirectedDelta(from, through, direction);

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

interface NumericInterpolationPoint {
  kind: InterpolationPointKind;
  position: number;
  value: number;
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
            position: clamp((preset?.centerPosition ?? 0.5) * 1000, 0, 1000),
            value: normalizeHue(preset?.center ?? hueForStop(clamp((preset?.centerPosition ?? 0.5) * 1000, 0, 1000), ramp)),
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
            position: clamp(preset.centerPosition * 1000, 0, 1000),
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

function evaluateHermiteScalar(start: number, end: number, shape: number, isRightSegment: boolean, t: number): number {
  const delta = end - start;
  if (delta === 0) return start;

  const tangent = delta * clamp(shape, 0, 1) * 3;
  const limited = limitMonotoneTangents(delta, isRightSegment ? 0 : tangent, isRightSegment ? tangent : 0);
  return hermite(start, end, limited.m0, limited.m1, clamp(t, 0, 1));
}

function hueDirectionForSegment(
  ramp: RampConfig,
  leftKind: InterpolationPointKind,
  rightKind: InterpolationPointKind,
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
    return resolveHueSegmentDirection(preset, 'start', ramp.anchor);
  }

  if (rightKind === 'end') {
    return resolveHueSegmentDirection(preset, 'end', ramp.anchor);
  }

  return chooseHueShortestDirection(preset.center, preset.center);
}

function evaluateHermiteHue(
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

function lightnessForStop(index: number, theme: ThemeSettings): number {
  return clamp(theme.lMax + (theme.lMin - theme.lMax) * (index / 1000), 0, 1);
}

function defaultColorForStop(index: number, theme: ThemeSettings, ramp: RampConfig, hue: number): OklchColor {
  const t = index / 1000;
  return {
    mode: 'oklch',
    l: lightnessForStop(index, theme),
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
