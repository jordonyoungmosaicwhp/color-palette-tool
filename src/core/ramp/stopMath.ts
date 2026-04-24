import { clamp, parseOklchColor } from '../color/oklch';
import type { CustomStopConfig, StopResolution, ThemeSettings } from '../types';

export function stopResolution(index: number): StopResolution {
  if (index % 100 === 0) return 100;
  if (index % 50 === 0) return 50;
  return 25;
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
