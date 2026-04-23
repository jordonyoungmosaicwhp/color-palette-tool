import { formatOklch } from './generator';
import type { ExportBundle, GeneratedStop, PaletteConfig } from './types';

export function createExportBundle(config: PaletteConfig, stops: GeneratedStop[]): ExportBundle {
  const visibleStops = stops.filter((stop) => stop.visible);

  return {
    cssVariables: createCssVariables(config.ramp.name, visibleStops),
    table: createTable(visibleStops),
  };
}

export function createCssVariables(rampName: string, stops: GeneratedStop[]): string {
  const prefix = rampName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return stops
    .map((stop) => `--color-${prefix}-${stop.index}: ${formatOklch(stop.oklch)}; /* ${stop.hex} */`)
    .join('\n');
}

export function createTable(stops: GeneratedStop[]): string {
  return stops.map((stop) => `${stop.index}\t${stop.hex}\t${formatOklch(stop.oklch)}`).join('\n');
}
