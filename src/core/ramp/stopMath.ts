import { clamp, parseOklchColor } from '../color/oklch';
import type { StopResolution, ThemeSettings } from '../types';

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
