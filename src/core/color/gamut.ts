import Color from 'colorjs.io';

import type { OklchColor } from '../types';

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

export function fitToSrgb(color: OklchColor): OklchColor {
  const candidate = new Color('oklch', [color.l, color.c, color.h], color.alpha ?? 1);
  if (candidate.inGamut('srgb')) return color;

  return {
    ...color,
    c: Math.max(0, Math.min(color.c, maxInGamutChroma(color.l, color.h, 0.0001, color.c))),
  };
}
