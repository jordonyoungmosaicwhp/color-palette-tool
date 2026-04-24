import { chromaForProgress } from '../chroma/evaluateChroma';
import type { OklchColor, RampConfig, ThemeSettings } from '../types';

export function lightnessForStop(index: number, theme: ThemeSettings): number {
  return Math.min(1, Math.max(0, theme.lMax + (theme.lMin - theme.lMax) * (index / 1000)));
}

export function defaultColorForStop(index: number, theme: ThemeSettings, ramp: RampConfig, hue: number): OklchColor {
  const t = index / 1000;
  return {
    mode: 'oklch',
    l: lightnessForStop(index, theme),
    c: chromaForProgress(t, ramp.chromaPreset),
    h: hue,
  };
}
