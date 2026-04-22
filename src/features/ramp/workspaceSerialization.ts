import { generateRamp, formatOklch } from '../../lib/color';
import {
  allowedAnchorStop,
  clamp,
  createCanonicalStops,
  createSeededRampConfig,
  normalizeStops,
  round,
  stopResolution,
} from '../../lib/color';
import type {
  AnchorConfig,
  ChromaPreset,
  DisplayMode,
  HuePreset,
  RampConfig,
  StopConfig,
  ThemeSettings,
} from '../../lib/color';
import type { RampDisplayOptions, PaletteGroup, WorkspaceRamp } from './workspaceTypes';

export interface WorkspaceSnapshot {
  theme: ThemeSettings;
  displayMode: DisplayMode;
  displayOptions: RampDisplayOptions;
  selectedRampId: string;
  selectedStop: number;
  groups: PaletteGroup[];
}

export interface WorkspaceExportV2 extends WorkspaceSnapshot {
  version: 2;
}

export type WorkspaceImportResult =
  | { ok: true; value: WorkspaceSnapshot }
  | { ok: false; error: string };

export interface WorkspaceExportBundle {
  cssVariables: string;
  jsonConfig: string;
  table: string;
}

const DEFAULT_DISPLAY_OPTIONS: RampDisplayOptions = {
  allowHiddenStops: true,
  showHex: false,
  showLightness: false,
  showChroma: false,
  showHue: false,
};

export function createWorkspaceExportBundle(snapshot: WorkspaceSnapshot): WorkspaceExportBundle {
  return {
    cssVariables: createWorkspaceCssVariables(snapshot),
    jsonConfig: JSON.stringify(createWorkspaceExport(snapshot), null, 2),
    table: createWorkspaceTable(snapshot),
  };
}

export function createWorkspaceExport(snapshot: WorkspaceSnapshot): WorkspaceExportV2 {
  return {
    version: 2,
    theme: snapshot.theme,
    displayMode: snapshot.displayMode,
    displayOptions: snapshot.displayOptions,
    selectedRampId: snapshot.selectedRampId,
    selectedStop: snapshot.selectedStop,
    groups: snapshot.groups.map((group) => ({
      id: group.id,
      name: group.name,
      ramps: group.ramps.map((ramp) => ({
        id: ramp.id,
        name: ramp.name,
        config: ramp.config,
      })),
    })),
  };
}

export function parseWorkspaceImport(text: string): WorkspaceImportResult {
  try {
    const parsed = JSON.parse(text) as unknown;
    return { ok: true, value: normalizeImportedWorkspace(parsed) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not parse workspace JSON.' };
  }
}

export function normalizeImportedWorkspace(input: unknown): WorkspaceSnapshot {
  if (!isRecord(input)) {
    throw new Error('Unsupported workspace JSON.');
  }

  if (input.version === 2) {
    return normalizeWorkspaceExport(input);
  }

  if (input.version === 1 && isRecord(input.ramp) && isRecord(input.theme)) {
    return normalizeLegacyExport(input);
  }

  throw new Error(`Unsupported workspace version: ${String(input.version ?? 'unknown')}`);
}

export function createWorkspaceCssVariables(snapshot: WorkspaceSnapshot): string {
  return snapshot.groups
    .flatMap((group) =>
      group.ramps.flatMap((ramp) => {
        const rampStops = generateRamp(snapshot.theme, ramp.config).filter((stop) => stop.visible);
        const prefix = `--color-${slugify(group.name)}-${slugify(ramp.name)}`;

        return rampStops.map((stop) => `${prefix}-${stop.index}: ${formatOklch(stop.oklch)}; /* ${stop.hex} */`);
      }),
    )
    .join('\n');
}

export function createWorkspaceTable(snapshot: WorkspaceSnapshot): string {
  const rows: string[] = ['Group\tRamp\tStop\tHex\tOKLCH'];

  for (const group of snapshot.groups) {
    for (const ramp of group.ramps) {
      const rampStops = generateRamp(snapshot.theme, ramp.config).filter((stop) => stop.visible);
      for (const stop of rampStops) {
        rows.push(`${group.name}\t${ramp.name}\t${stop.index}\t${stop.hex}\t${formatOklch(stop.oklch)}`);
      }
    }
  }

  return rows.join('\n');
}

function normalizeWorkspaceExport(input: Record<string, unknown>): WorkspaceSnapshot {
  const groups = normalizeGroups(input.groups);
  const selectedRampId = typeof input.selectedRampId === 'string' ? input.selectedRampId : '';
  const theme = normalizeTheme(input.theme);
  const displayMode = input.displayMode === 'row' ? 'row' : 'column';
  const displayOptions = normalizeDisplayOptions(input.displayOptions);
  const selectedRamp = findRampById(groups, selectedRampId) ?? groups.flatMap((group) => group.ramps)[0];
  const resolvedSelectedRampId = selectedRamp?.id ?? '';
  const selectedStop = resolveSelectedStop(input.selectedStop, selectedRamp);

  return {
    theme,
    displayMode,
    displayOptions,
    selectedRampId: resolvedSelectedRampId,
    selectedStop,
    groups,
  };
}

function normalizeLegacyExport(input: Record<string, unknown>): WorkspaceSnapshot {
  const theme = normalizeTheme(input.theme);
  const displayMode = input.displayMode === 'row' ? 'row' : 'column';
  const displayOptions = { ...DEFAULT_DISPLAY_OPTIONS };
  const rampRecord = isRecord(input.ramp) ? input.ramp : {};
  const rampName = normalizeName(rampRecord.name, 'Brand');
  const ramp = normalizeRampConfig(input.ramp, rampName);
  const groupId = makeUniqueId('group', new Set<string>(), 'group-1');
  const rampId = makeUniqueId('ramp', new Set<string>([groupId]), rampName);
  const group: PaletteGroup = {
    id: groupId,
    name: 'Imported',
    ramps: [{ id: rampId, name: rampName, config: { ...ramp, name: rampName } }],
  };

  return {
    theme,
    displayMode,
    displayOptions,
    selectedRampId: rampId,
    selectedStop: resolveSelectedStop(undefined, group.ramps[0]),
    groups: [group],
  };
}

function normalizeGroups(input: unknown): PaletteGroup[] {
  if (!Array.isArray(input)) return [];

  const usedGroupIds = new Set<string>();
  const usedRampIds = new Set<string>();

  return input.map((groupInput, groupIndex) => {
    const groupRecord = isRecord(groupInput) ? groupInput : {};
    const groupName = normalizeName(groupRecord.name, `Group ${groupIndex + 1}`);
    const groupId = makeUniqueId(groupRecord.id, usedGroupIds, slugify(groupName) || `group-${groupIndex + 1}`);

    const ramps = Array.isArray(groupRecord.ramps)
      ? groupRecord.ramps.map((rampInput, rampIndex) => normalizeWorkspaceRamp(rampInput, groupName, rampIndex, usedRampIds))
      : [];

    return {
      id: groupId,
      name: groupName,
      ramps,
    };
  });
}

function normalizeWorkspaceRamp(input: unknown, groupName: string, rampIndex: number, usedRampIds: Set<string>): WorkspaceRamp {
  const rampRecord = isRecord(input) ? input : {};
  const rampName = normalizeName(rampRecord.name, `${groupName} Ramp ${rampIndex + 1}`);
  const rampId = makeUniqueId(rampRecord.id, usedRampIds, slugify(rampName) || `ramp-${rampIndex + 1}`);
  const config = normalizeRampConfig(rampRecord.config ?? rampRecord, rampName);

  return {
    id: rampId,
    name: rampName,
    config: {
      ...config,
      name: rampName,
    },
  };
}

function normalizeRampConfig(input: unknown, fallbackName: string): RampConfig {
  const fallback = createSeededRampConfig(fallbackName, '#af261d', 0.04, 0.16);
  const record = isRecord(input) ? input : {};
  const fallbackHuePreset: HuePreset =
    fallback.huePreset ?? {
      type: 'constant',
      hue: fallback.hue,
    };
  const huePreset = normalizeHuePreset(record.huePreset, fallbackHuePreset);
  const chromaPreset = normalizeChromaPreset(record.chromaPreset, fallback.chromaPreset);
  const hue = typeof record.hue === 'number' && Number.isFinite(record.hue) ? record.hue : huePreset.type === 'constant' ? huePreset.hue : huePreset.start;
  const anchor = normalizeAnchor(record.anchor);
  const stops = normalizeStops(normalizeStopList(record.stops), anchor);

  return {
    version: 1,
    name: normalizeName(record.name, fallbackName),
    hue: round(hue, 2),
    huePreset,
    chromaPreset,
    anchor,
    stops,
  };
}

function normalizeTheme(input: unknown): ThemeSettings {
  const theme = isRecord(input) ? input : {};
  const lMax = typeof theme.lMax === 'number' && Number.isFinite(theme.lMax) ? clamp(theme.lMax, 0, 1) : 1;
  const lMin = typeof theme.lMin === 'number' && Number.isFinite(theme.lMin) ? clamp(theme.lMin, 0, lMax - 0.01) : 0.12;

  return {
    lMax: clamp(lMax, lMin + 0.01, 1),
    lMin: clamp(lMin, 0, 0.99),
  };
}

function normalizeDisplayOptions(input: unknown): RampDisplayOptions {
  const options = isRecord(input) ? input : {};
  return {
    allowHiddenStops: typeof options.allowHiddenStops === 'boolean' ? options.allowHiddenStops : DEFAULT_DISPLAY_OPTIONS.allowHiddenStops,
    showHex: typeof options.showHex === 'boolean' ? options.showHex : DEFAULT_DISPLAY_OPTIONS.showHex,
    showLightness: typeof options.showLightness === 'boolean' ? options.showLightness : DEFAULT_DISPLAY_OPTIONS.showLightness,
    showChroma: typeof options.showChroma === 'boolean' ? options.showChroma : DEFAULT_DISPLAY_OPTIONS.showChroma,
    showHue: typeof options.showHue === 'boolean' ? options.showHue : DEFAULT_DISPLAY_OPTIONS.showHue,
  };
}

function normalizeStopList(input: unknown): StopConfig[] {
  if (!Array.isArray(input) || input.length === 0) return createCanonicalStops();

  return input
    .map((stopInput) => {
      const stop = isRecord(stopInput) ? stopInput : {};
      const index = typeof stop.index === 'number' && Number.isInteger(stop.index) ? clamp(stop.index, 0, 1000) : undefined;
      if (index === undefined || index % 25 !== 0) return null;
      return {
        index,
        resolution: stopResolution(index),
        state: stop.state === 'anchor' || stop.state === 'hidden' ? stop.state : 'default',
      } satisfies StopConfig;
    })
    .filter((stop): stop is StopConfig => Boolean(stop));
}

function normalizeAnchor(input: unknown): AnchorConfig | undefined {
  if (!isRecord(input) || typeof input.color !== 'string') return undefined;
  const stop = typeof input.stop === 'number' && Number.isFinite(input.stop) ? allowedAnchorStop(input.stop, stopResolution(input.stop)) : undefined;
  if (stop === undefined) return undefined;

  return {
    color: input.color,
    stop,
    resolution: stopResolution(stop),
  };
}

function normalizeHuePreset(input: unknown, fallback: HuePreset): HuePreset {
  if (!isRecord(input)) return fallback;

  if (input.type === 'constant') {
    return {
      type: 'constant',
      hue: normalizeHueValue(input.hue, fallback.type === 'constant' ? fallback.hue : fallback.start),
    };
  }

  if (input.type === 'range') {
    return {
      type: 'range',
      start: normalizeHueValue(input.start, fallback.type === 'range' ? fallback.start : fallback.hue),
      end: normalizeHueValue(input.end, fallback.type === 'range' ? fallback.end : fallback.hue),
      rotation: input.rotation === 'counter' ? 'counter' : 'clockwise',
      curve: normalizeCurvePreset(input.curve, fallback.type === 'range' ? fallback.curve : 'linear'),
      direction: normalizeCurveDirection(input.direction, fallback.type === 'range' ? fallback.direction : 'easeInOut'),
    };
  }

  return fallback;
}

function normalizeChromaPreset(input: unknown, fallback: ChromaPreset): ChromaPreset {
  if (!isRecord(input) || input.type !== 'range') return fallback;

  return {
    type: 'range',
    start: normalizeChromaValue(input.start, fallback.start),
    end: normalizeChromaValue(input.end, fallback.end),
    rate: normalizeChromaValue(input.rate, fallback.rate, 0.1, 3),
    curve: normalizeCurvePreset(input.curve, fallback.curve),
    direction: normalizeCurveDirection(input.direction, fallback.direction),
  };
}

function normalizeCurvePreset(input: unknown, fallback: 'linear' | 'sine' | 'quad'): 'linear' | 'sine' | 'quad' {
  return input === 'sine' || input === 'quad' || input === 'linear' ? input : fallback;
}

function normalizeCurveDirection(input: unknown, fallback: 'easeIn' | 'easeOut' | 'easeInOut'): 'easeIn' | 'easeOut' | 'easeInOut' {
  return input === 'easeIn' || input === 'easeOut' || input === 'easeInOut' ? input : fallback;
}

function normalizeHueValue(input: unknown, fallback: number): number {
  return typeof input === 'number' && Number.isFinite(input) ? round(((input % 360) + 360) % 360, 2) : fallback;
}

function normalizeChromaValue(input: unknown, fallback: number, min = 0, max = 0.5): number {
  return typeof input === 'number' && Number.isFinite(input) ? round(clamp(input, min, max), 4) : fallback;
}

function resolveSelectedStop(input: unknown, ramp?: WorkspaceRamp): number {
  if (typeof input === 'number' && ramp?.config.stops.some((stop) => stop.index === input)) {
    return input;
  }

  return ramp?.config.anchor?.stop ?? ramp?.config.stops[0]?.index ?? 500;
}

function normalizeName(input: unknown, fallback: string): string {
  if (typeof input === 'string' && input.trim()) return input.trim();
  return fallback;
}

function findRampById(groups: PaletteGroup[], id: string): WorkspaceRamp | undefined {
  for (const group of groups) {
    const match = group.ramps.find((ramp) => ramp.id === id);
    if (match) return match;
  }

  return undefined;
}

function makeUniqueId(input: unknown, used: Set<string>, fallback: string): string {
  const base = typeof input === 'string' && input.trim() ? input.trim() : fallback;
  const initial = slugify(base) || fallback;
  let candidate = initial;
  let suffix = 2;

  while (used.has(candidate)) {
    candidate = `${initial}-${suffix}`;
    suffix += 1;
  }

  used.add(candidate);
  return candidate;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
