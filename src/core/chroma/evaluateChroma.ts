import { clamp, round } from '../color/oklch';
import type { ChromaPreset } from '../types';
import { evaluateChromaSegment } from './evaluateChromaSegment';

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
