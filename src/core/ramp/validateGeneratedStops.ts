import type { GeneratedStop, ValidationResult } from '../types';

export function validateGeneratedStops(stops: GeneratedStop[]): ValidationResult {
  const blockingStops = stops.filter((stop) => stop.visible && !stop.inGamut).map((stop) => stop.index);
  const warningStops = stops.filter((stop) => !stop.visible && !stop.inGamut).map((stop) => stop.index);

  return {
    hasBlockingIssues: blockingStops.length > 0,
    blockingStops,
    warningStops,
  };
}
