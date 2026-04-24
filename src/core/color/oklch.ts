import Color from 'colorjs.io';

import type { OklchColor } from '../types';

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

export function interpolateOklch(from: OklchColor, to: OklchColor, amount: number, hue: number): OklchColor {
  const t = clamp(amount, 0, 1);

  return {
    mode: 'oklch',
    l: from.l + (to.l - from.l) * t,
    c: from.c + (to.c - from.c) * t,
    h: hue,
  };
}
