// Returns the maximum chroma for a given lightness and hue that is still in sRGB gamut
import { displayable } from 'culori';

export function maxInGamutChroma(l: number, h: number, precision = 0.001, cMax = 0.5): number {
  // Binary search for max chroma in [0, cMax]
  let low = 0;
  let high = cMax;
  let best = 0;
  for (let i = 0; i < 20; i++) { // 20 iterations is plenty for float precision
    const mid = (low + high) / 2;
    const color = { mode: 'oklch', l, c: mid, h };
    if (displayable(color)) {
      best = mid;
      low = mid;
    } else {
      high = mid;
    }
    if (high - low < precision) break;
  }
  return best;
}
import { converter } from 'culori';
import type {
  AnchorConfig,
  OklchColor,
  PaletteConfig,
  RampConfig,
  StopConfig,
  StopResolution,
} from './types';

const toOklch = converter('oklch');

export const CANONICAL_STOPS = Object.freeze([
  0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
]);

export const DEFAULT_THEME = {
  lMax: 1,
  lMin: 0.12,
};

export const DEFAULT_ANCHOR_COLOR = '#af261d';

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
  const color = toOklch(input);
  if (!color || typeof color.l !== 'number') {
    throw new Error(`Could not parse color: ${input}`);
  }

  return {
    mode: 'oklch',
    l: clamp(color.l, 0, 1),
    c: Math.max(0, color.c ?? 0),
    h: normalizeHue(color.h ?? 0),
    alpha: color.alpha,
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
    });
  }

  if (anchor) {
    ensureStopWithParents(byIndex, anchor.stop);
  }

  for (const [index, stop] of byIndex) {
    const isAnchor = anchor?.stop === index;
    byIndex.set(index, {
      ...stop,
      state: isAnchor ? 'anchor' : stop.state === 'anchor' ? 'default' : stop.state,
    });
  }

  return sortStops([...byIndex.values()]);
}

export function createDefaultConfig(): PaletteConfig {
  const anchorOklch = parseOklchColor(DEFAULT_ANCHOR_COLOR);
  const anchor: AnchorConfig = {
    color: DEFAULT_ANCHOR_COLOR,
    stop: 500,
    resolution: 100,
  };

  return {
    version: 1,
    theme: DEFAULT_THEME,
    displayMode: 'column',
    ramp: {
      version: 1,
      name: 'Brand',
      hue: round(anchorOklch.h, 2),
      huePreset: {
        type: 'constant',
        hue: round(anchorOklch.h, 2),
      },
      chromaPreset: {
        type: 'range',
        start: 0,
        end: 0.18,
        rate: 1,
        curve: 'sine',
        direction: 'easeInOut',
      },
      anchor,
      stops: normalizeStops(createCanonicalStops(), anchor),
    },
  };
}

export function updateRampStops(ramp: RampConfig, stops: StopConfig[]): RampConfig {
  return {
    ...ramp,
    stops: normalizeStops(stops, ramp.anchor),
  };
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

export function addStop(stops: StopConfig[], index: number): StopConfig[] {
  const byIndex = new Map(sortStops(stops).map((stop) => [stop.index, stop]));
  ensureStopWithParents(byIndex, index);
  return sortStops([...byIndex.values()]);
}

export function insertStopBetween(stops: StopConfig[], startIndex: number, endIndex: number): StopConfig[] {
  const gap = Math.abs(endIndex - startIndex);
  if (gap <= 25) return sortStops(stops);

  const midpoint = Math.min(startIndex, endIndex) + gap / 2;
  if (!isValidStopIndex(midpoint)) return sortStops(stops);

  return addStop(stops, midpoint);
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
  const anchor: AnchorConfig = {
    color,
    stop: anchorStop,
    resolution,
  };
  const anchorOklch = parseOklchColor(color);

  return {
    ...ramp,
    hue: round(anchorOklch.h, 2),
    huePreset:
      !ramp.huePreset || ramp.huePreset.type === 'constant'
        ? {
            type: 'constant',
            hue: round(anchorOklch.h, 2),
          }
        : ramp.huePreset,
    anchor,
    stops: normalizeStops(addStop(ramp.stops, anchorStop), anchor),
  };
}

function ensureStopWithParents(byIndex: Map<number, StopConfig>, index: number): void {
  if (!isValidStopIndex(index)) return;

  if (index % 100 !== 0) {
    const lower = nearestCanonicalFloor(index);
    if (index % 50 !== 0) {
      const parent = lower + (index < lower + 50 ? 50 : 50);
      byIndex.set(parent, {
        index: parent,
        resolution: 50,
        state: byIndex.get(parent)?.state ?? 'default',
      });
    }
  }

  byIndex.set(index, {
    index,
    resolution: stopResolution(index),
    state: byIndex.get(index)?.state ?? 'default',
  });
}
