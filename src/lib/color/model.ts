import Color from 'colorjs.io';
import type {
  AnchorConfig,
  OklchColor,
  PaletteConfig,
  RampConfig,
  StopConfig,
  StopOrigin,
  StopResolution,
  ThemeSettings,
  CustomStopConfig,
} from './types';

export function maxInGamutChroma(l: number, h: number, precision = 0.001, cMax = 0.5): number {
  let low = 0;
  let high = cMax;
  let best = 0;

  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    const color = new Color('oklch', [l, mid, h]);

    if (color.inGamut('srgb')) {
      best = mid;
      low = mid;
    } else {
      high = mid;
    }

    if (high - low < precision) break;
  }

  return best;
}

export const CANONICAL_STOPS = Object.freeze([
  0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
]);

export const DEFAULT_THEME = {
  lMax: 1,
  lMin: 0.2,
};

export const DEFAULT_SEED_COLOR = '#af261d';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, precision = 4): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

export function parseOklchColor(input: string): OklchColor {
  const color = new Color(input).to('oklch');
  const [l, c, h] = color.coords;
  if (typeof l !== 'number') {
    throw new Error(`Could not parse color: ${input}`);
  }

  return {
    mode: 'oklch',
    l: clamp(l, 0, 1),
    c: Math.max(0, c ?? 0),
    h: normalizeHue(h ?? 0),
    alpha: color.alpha ?? undefined,
  };
}

export function stopResolution(index: number): StopResolution {
  if (index % 100 === 0) return 100;
  if (index % 50 === 0) return 50;
  return 25;
}

export function createCanonicalStops(): StopConfig[] {
  return CANONICAL_STOPS.map((index) => ({
    index,
    resolution: 100,
    state: 'default',
    origin: 'canonical',
  }));
}

export function sortStops(stops: StopConfig[]): StopConfig[] {
  return [...stops].sort((a, b) => a.index - b.index);
}

export function normalizeStops(stops: StopConfig[], anchor?: AnchorConfig): StopConfig[] {
  const byIndex = new Map<number, StopConfig>();

  for (const stop of createCanonicalStops()) {
    byIndex.set(stop.index, stop);
  }

  for (const stop of stops) {
    if (!isValidStopIndex(stop.index)) continue;
    byIndex.set(stop.index, {
      index: stop.index,
      resolution: stopResolution(stop.index),
      state: stop.state,
      origin: normalizeStopOrigin(stop.origin, stop.index, anchor?.stop),
    });
  }

  if (anchor) {
    ensureStopWithParents(byIndex, anchor.stop, 'anchor');
  }

  for (const [index, stop] of byIndex) {
    const isAnchor = anchor?.stop === index;
    byIndex.set(index, {
      ...stop,
      state: isAnchor ? 'anchor' : stop.state === 'anchor' ? 'default' : stop.state,
      origin: isAnchor ? (stop.origin === 'user' ? 'user' : 'anchor') : stop.origin ?? (index % 100 === 0 ? 'canonical' : 'user'),
    });
  }

  return sortStops([...byIndex.values()]);
}

export function createDefaultConfig(): PaletteConfig {
  return {
    theme: DEFAULT_THEME,
    displayMode: 'column',
    ramp: createSeededRampConfig('Brand', DEFAULT_SEED_COLOR, 0.05, 0.18),
  };
}

export function createSeededRampConfig(name: string, seedColor: string, chromaStart: number, chromaEnd: number): RampConfig {
  const seedOklch = parseOklchColor(seedColor);
  const center = round(chromaStart + (chromaEnd - chromaStart) * 0.5, 4);

  return {
    name,
    huePreset: {
      start: round(seedOklch.h, 2),
      center: round(seedOklch.h, 2),
      end: round(seedOklch.h, 2),
      centerPosition: 0.5,
      startShape: 0,
      endShape: 0,
      direction: 'auto',
    },
    chromaPreset: {
      start: chromaStart,
      center,
      end: chromaEnd,
      centerPosition: 0.5,
      startShape: 0,
      endShape: 0,
    },
    customStops: [],
    customStopsMidpointLocked: true,
    stops: normalizeStops(createCanonicalStops()),
  };
}

export function updateRampStops(ramp: RampConfig, stops: StopConfig[]): RampConfig {
  return {
    ...ramp,
    stops: normalizeStops(stops, ramp.anchor),
  };
}

export function customStopIndex(color: string, theme: ThemeSettings): number {
  const oklch = parseOklchColor(color);
  const rawStop = ((theme.lMax - oklch.l) / (theme.lMax - theme.lMin)) * 1000;
  return allowedAnchorStop(rawStop, stopResolution(Math.round(rawStop)));
}

export function tryCustomStopIndex(color: string, theme: ThemeSettings): number | null {
  try {
    return customStopIndex(color, theme);
  } catch {
    return null;
  }
}

export function sortCustomStopsByIndex(stops: CustomStopConfig[], theme: ThemeSettings): CustomStopConfig[] {
  return [...stops]
    .map((stop, order) => ({
      stop,
      index: tryCustomStopIndex(stop.color, theme),
      order,
    }))
    .sort((left, right) => {
      const leftValid = left.index !== null;
      const rightValid = right.index !== null;
      if (leftValid !== rightValid) return leftValid ? -1 : 1;
      if (!leftValid && !rightValid) return left.order - right.order;
      if (left.index !== right.index) return (left.index ?? 0) - (right.index ?? 0);
      const idComparison = left.stop.id.localeCompare(right.stop.id);
      if (idComparison !== 0) return idComparison;
      return left.order - right.order;
    })
    .map(({ stop }) => stop);
}

export function normalizeCustomStopColor(input: unknown, fallback = DEFAULT_SEED_COLOR): string {
  if (typeof input !== 'string') return fallback;
  try {
    parseOklchColor(input);
    return input;
  } catch {
    return fallback;
  }
}

export function normalizeCustomStopList(stops: unknown): CustomStopConfig[] {
  if (!Array.isArray(stops)) return [];

  const usedIds = new Set<string>();

  return stops
    .map((stop, index) => {
      const record = stop && typeof stop === 'object' ? (stop as Record<string, unknown>) : {};
      const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : `custom-stop-${index + 1}`;
      const normalizedId = makeUniqueCustomStopId(id, usedIds, index);
      const color = normalizeCustomStopColor(record.color ?? record.hex ?? record.value, DEFAULT_SEED_COLOR);
      return { id: normalizedId, color };
    })
    .filter((stop) => Boolean(stop.color));
}

export function dedupeCustomStops(stops: CustomStopConfig[], theme: ThemeSettings): CustomStopConfig[] {
  const byIndex = new Map<number, CustomStopConfig>();
  const invalidStops: CustomStopConfig[] = [];

  for (const stop of stops) {
    const index = tryCustomStopIndex(stop.color, theme);
    if (index === null) {
      invalidStops.push(stop);
      continue;
    }

    byIndex.set(index, stop);
  }

  return [...byIndex.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([, stop]) => stop)
    .concat(invalidStops);
}

export function customStopCollisionIndices(stops: CustomStopConfig[], theme: ThemeSettings): number[] {
  const seen = new Set<number>();
  const collisions = new Set<number>();

  for (const stop of stops) {
    const index = tryCustomStopIndex(stop.color, theme);
    if (index === null) continue;
    if (seen.has(index)) {
      collisions.add(index);
    } else {
      seen.add(index);
    }
  }

  return [...collisions].sort((a, b) => a - b);
}

export function resnapAnchorStops(ramp: RampConfig, theme: ThemeSettings): RampConfig {
  if (!ramp.anchor) return ramp;

  const anchorColor = parseOklchColor(ramp.anchor.color);
  const rawStop = ((theme.lMax - anchorColor.l) / (theme.lMax - theme.lMin)) * 1000;
  const snappedStop = allowedAnchorStop(rawStop, stopResolution(Math.round(rawStop)));
  return setAnchor(ramp, ramp.anchor.color, snappedStop, stopResolution(snappedStop));
}

export function isCanonicalStop(index: number): boolean {
  return index % 100 === 0;
}

export function isValidStopIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index <= 1000 && index % 25 === 0;
}

export function nearestCanonicalFloor(index: number): number {
  return clamp(Math.floor(index / 100) * 100, 0, 1000);
}

export function nearestCanonicalCeil(index: number): number {
  return clamp(Math.ceil(index / 100) * 100, 0, 1000);
}

export function allowedAnchorStop(rawStop: number, resolution: StopResolution): number {
  const snapped = Math.round(rawStop / resolution) * resolution;
  return clamp(snapped, resolution, 1000 - resolution);
}

export function addStop(stops: StopConfig[], index: number, origin: StopOrigin = 'user'): StopConfig[] {
  const byIndex = new Map(sortStops(stops).map((stop) => [stop.index, stop]));
  ensureStopWithParents(byIndex, index, origin);
  return sortStops([...byIndex.values()]);
}

export function insertStopBetween(stops: StopConfig[], startIndex: number, endIndex: number): StopConfig[] {
  const gap = Math.abs(endIndex - startIndex);
  if (gap <= 25) return sortStops(stops);

  const midpoint = Math.min(startIndex, endIndex) + gap / 2;
  const snappedMidpoint = Math.round(midpoint / 25) * 25;
  if (!isValidStopIndex(snappedMidpoint)) return sortStops(stops);
  if (snappedMidpoint <= Math.min(startIndex, endIndex) || snappedMidpoint >= Math.max(startIndex, endIndex)) {
    return sortStops(stops);
  }

  return addStop(stops, snappedMidpoint);
}

export function deleteStop(stops: StopConfig[], index: number): StopConfig[] {
  if (isCanonicalStop(index)) return sortStops(stops);

  const resolution = stopResolution(index);
  const shouldDelete = (stop: StopConfig) => {
    if (stop.index === index) return true;
  if (resolution === 50 && stop.resolution === 25) {
        return Math.floor(stop.index / 100) * 100 === Math.floor(index / 100) * 100;
      }
      return false;
    };

  return normalizeStops(stops.filter((stop) => !shouldDelete(stop)));
}

export function toggleStopVisibility(stops: StopConfig[], index: number): StopConfig[] {
  return normalizeStops(
    stops.map((stop) => {
      if (stop.index !== index || stop.state === 'anchor') return stop;
      return {
        ...stop,
        state: stop.state === 'hidden' ? 'default' : 'hidden',
      };
    }),
  );
}

export function setAnchor(ramp: RampConfig, color: string, rawStop: number, resolution: StopResolution): RampConfig {
  const anchorStop = allowedAnchorStop(rawStop, resolution);
  const anchorColor = parseOklchColor(color);
  const anchor: AnchorConfig = {
    color,
    stop: anchorStop,
    resolution,
  };
  const nextStops = reconcileAnchorStops(ramp.stops, ramp.anchor?.stop, anchorStop);

  return {
    ...ramp,
    anchor,
    huePreset: ramp.huePreset
      ? {
          ...ramp.huePreset,
          start: round(anchorColor.h, 2),
          center: round(anchorColor.h, 2),
          end: round(anchorColor.h, 2),
          centerPosition: anchorStop / 1000,
        }
      : ramp.huePreset,
    stops: normalizeStops(nextStops, anchor),
  };
}

function reconcileAnchorStops(stops: StopConfig[], previousAnchorStop: number | undefined, nextAnchorStop: number): StopConfig[] {
  const byIndex = new Map<number, StopConfig>();

  for (const stop of sortStops(stops)) {
    byIndex.set(stop.index, { ...stop });
  }

  if (previousAnchorStop !== undefined && previousAnchorStop !== nextAnchorStop) {
    for (const [index, stop] of [...byIndex.entries()]) {
      if (stop.origin === 'anchor') {
        byIndex.delete(index);
      }
    }
  }

  ensureStopWithParents(byIndex, nextAnchorStop, 'anchor');
  return [...byIndex.values()];
}

function ensureStopWithParents(byIndex: Map<number, StopConfig>, index: number, origin: StopOrigin): void {
  if (!isValidStopIndex(index)) return;

  if (index % 100 !== 0) {
    const lower = nearestCanonicalFloor(index);
    if (index % 50 !== 0) {
      const parent = lower + (index < lower + 50 ? 50 : 50);
      byIndex.set(parent, {
        index: parent,
        resolution: 50,
        state: byIndex.get(parent)?.state ?? 'default',
        origin: byIndex.get(parent)?.origin ?? origin,
      });
    }
  }

  byIndex.set(index, {
    index,
    resolution: stopResolution(index),
    state: byIndex.get(index)?.state ?? 'default',
    origin: byIndex.get(index)?.origin ?? origin,
  });
}

function normalizeStopOrigin(origin: unknown, index: number, anchorStop?: number): StopOrigin {
  if (origin === 'canonical' || origin === 'user' || origin === 'anchor') return origin;
  if (anchorStop === index) return 'anchor';
  if (index % 100 === 0) return 'canonical';
  return 'user';
}

function makeUniqueCustomStopId(base: string, used: Set<string>, index: number): string {
  let candidate = base.trim() || `custom-stop-${index + 1}`;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base.trim() || `custom-stop-${index + 1}`}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}
