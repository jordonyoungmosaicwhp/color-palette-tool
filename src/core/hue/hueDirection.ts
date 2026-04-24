import { normalizeHue } from '../color/oklch';
import type { AnchorConfig, HueDirection, HuePreset } from '../types';

export function normalizeHueDirection(preset: HuePreset, anchor?: AnchorConfig): HueDirection {
  return normalizeHueSegmentDirection(preset, 'start', anchor);
}

export function resolveHuePathDirection(preset: HuePreset, anchor?: AnchorConfig): Exclude<HueDirection, 'auto'> {
  return resolveHueSegmentDirection(preset, 'start', anchor);
}

export function resolveHueSegmentDirections(
  preset: HuePreset,
  anchor?: AnchorConfig,
): { start: Exclude<HueDirection, 'auto'>; end: Exclude<HueDirection, 'auto'> } {
  return {
    start: resolveHueSegmentDirection(preset, 'start', anchor),
    end: resolveHueSegmentDirection(preset, 'end', anchor),
  };
}

export function resolveHueSegmentDirection(
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

function huePathContainsMidpoint(
  preset: HuePreset,
  direction: Exclude<HueDirection, 'auto'>,
  _anchor?: AnchorConfig,
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

export function chooseHueShortestDirection(from: number, to: number): Exclude<HueDirection, 'auto'> {
  const clockwise = hueDirectedDelta(from, to, 'clockwise');
  const counterclockwise = hueDirectedDelta(from, to, 'counterclockwise');

  return Math.abs(clockwise) <= Math.abs(counterclockwise) ? 'clockwise' : 'counterclockwise';
}

export function hueDirectedDelta(from: number, to: number, direction: Exclude<HueDirection, 'auto'>): number {
  const normalizedFrom = normalizeHue(from);
  const normalizedTo = normalizeHue(to);
  if (direction === 'clockwise') {
    return (normalizedTo - normalizedFrom + 360) % 360;
  }

  return -((normalizedFrom - normalizedTo + 360) % 360);
}
