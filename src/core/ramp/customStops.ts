import type { CustomStopConfig, RampConfig, StopResolution, ThemeSettings } from '../types';
import { customStopIndex, stopResolution, tryCustomStopIndex } from './stopMath';

export interface PreparedCustomStops {
  customStops: CustomStopConfig[];
  customStopIndices: Set<number>;
}

export function prepareCustomStops(theme: ThemeSettings, ramp: RampConfig): PreparedCustomStops {
  const customStops = ramp.customStops?.length
    ? sortCustomStopsByIndex(
        dedupeCustomStops(ramp.customStops ?? [], theme).filter((stop) => tryCustomStopIndex(stop.color, theme) !== null),
        theme,
      )
    : [];

  return {
    customStops,
    customStopIndices: new Set(customStops.map((stop) => customStopIndex(stop.color, theme))),
  };
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

export function mergeCustomStopIndices(
  stops: Array<{ index: number; resolution: StopResolution; state: 'default' | 'anchor' | 'hidden' }>,
  customStops: CustomStopConfig[],
  theme: ThemeSettings,
): Array<{ index: number; resolution: StopResolution; state: 'default' | 'anchor' | 'hidden' }> {
  const byIndex = new Map(stops.map((stop) => [stop.index, stop]));

  for (const point of customStops) {
    const index = customStopIndex(point.color, theme);
    if (!byIndex.has(index)) {
      byIndex.set(index, {
        index,
        resolution: stopResolution(index),
        state: 'default',
      });
    }
  }

  return [...byIndex.values()].sort((left, right) => left.index - right.index);
}
