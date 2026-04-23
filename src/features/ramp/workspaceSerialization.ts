import { formatOklch, generateRamp } from '../../lib/color';
import { addStop, createCanonicalStops, normalizeHue, normalizeStops, parseOklchColor, round } from '../../lib/color';
import type { ChromaPreset, DisplayMode, HueDirection, HuePreset, RampConfig, ThemeSettings } from '../../lib/color';
import type { PaletteGroup, RampDisplayOptions, WorkspaceRamp } from './workspaceTypes';

export interface WorkspaceSnapshot {
  theme: ThemeSettings;
  displayMode: DisplayMode;
  displayOptions: RampDisplayOptions;
  selectedRampId: string;
  selectedStop: number;
  groups: PaletteGroup[];
}

export interface WorkspaceExportV1 {
  version: 1;
  theme: ThemeSettings;
  groups: WorkspaceGroupDocument[];
}

export interface WorkspaceGroupDocument {
  name: string;
  ramps: WorkspaceRampDocument[];
}

export type WorkspaceRampDocument = PresetRampDocument | CustomStopsRampDocument;

export interface PresetRampDocument {
  mode: 'preset';
  name: string;
  hue: HuePreset;
  chroma: ChromaPreset;
  stops?: SparseStopDocument[];
}

export interface CustomStopsRampDocument {
  mode: 'customStops';
  name: string;
  hue: EndpointHueDocument;
  chroma: EndpointChromaDocument;
  customStops: string[];
  stops?: SparseStopDocument[];
}

export interface EndpointHueDocument {
  start: number;
  end: number;
}

export interface EndpointChromaDocument {
  start: number;
  end: number;
}

export interface SparseStopDocument {
  index: number;
  hidden?: true;
}

export type WorkspaceImportResult =
  | { ok: true; value: WorkspaceSnapshot }
  | { ok: false; error: string };

export interface WorkspaceExportBundle {
  cssVariables: string;
  jsonConfig: string;
  table: string;
}

const DEFAULT_DISPLAY_MODE: DisplayMode = 'column';

const DEFAULT_DISPLAY_OPTIONS: RampDisplayOptions = {
  allowHiddenStops: true,
  showHex: false,
  showLightness: false,
  showChroma: false,
  showHue: false,
};

const PRESET_RAMP_KEYS = ['mode', 'name', 'hue', 'chroma', 'stops'] as const;
const CUSTOM_STOPS_RAMP_KEYS = ['mode', 'name', 'hue', 'chroma', 'customStops', 'stops'] as const;
const PRESET_HUE_KEYS = ['start', 'center', 'end', 'centerPosition', 'startShape', 'endShape', 'direction'] as const;
const PRESET_CHROMA_KEYS = ['start', 'center', 'end', 'centerPosition', 'startShape', 'endShape'] as const;
const ENDPOINT_KEYS = ['start', 'end'] as const;
const SPARSE_STOP_KEYS = ['index', 'hidden'] as const;
const GROUP_KEYS = ['name', 'ramps'] as const;
const ROOT_KEYS = ['version', 'theme', 'groups'] as const;
const THEME_KEYS = ['lMax', 'lMin'] as const;

export function createWorkspaceExportBundle(snapshot: WorkspaceSnapshot): WorkspaceExportBundle {
  return {
    cssVariables: createWorkspaceCssVariables(snapshot),
    jsonConfig: JSON.stringify(createWorkspaceExport(snapshot), null, 2),
    table: createWorkspaceTable(snapshot),
  };
}

export function createWorkspaceExport(snapshot: WorkspaceSnapshot): WorkspaceExportV1 {
  return {
    version: 1,
    theme: snapshot.theme,
    groups: snapshot.groups.map((group) => ({
      name: group.name,
      ramps: group.ramps.map((ramp) => exportWorkspaceRamp(ramp)),
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

  if (input.version !== 1) {
    throw new Error(`Unsupported workspace version: ${String(input.version ?? 'unknown')}`);
  }

  if ('ramp' in input) {
    throw new Error('Legacy single-ramp imports are no longer supported.');
  }

  assertExactKeys(input, ROOT_KEYS, 'workspace');

  const theme = parseTheme(input.theme);
  const groups = parseGroups(input.groups);
  const selectedRampId = groups.flatMap((group) => group.ramps)[0]?.id ?? '';

  return {
    theme,
    displayMode: DEFAULT_DISPLAY_MODE,
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
    selectedRampId,
    selectedStop: 500,
    groups,
  };
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

function exportWorkspaceRamp(ramp: WorkspaceRamp): WorkspaceRampDocument {
  const sparseStops = exportSparseStops(ramp.config);
  const stops = sparseStops.length > 0 ? { stops: sparseStops } : {};
  const huePreset = requireHuePreset(ramp.config);

  if ((ramp.config.customStops?.length ?? 0) > 0) {
    return {
      mode: 'customStops',
      name: ramp.name,
      hue: {
        start: huePreset.start,
        end: huePreset.end,
      },
      chroma: {
        start: ramp.config.chromaPreset.start,
        end: ramp.config.chromaPreset.end,
      },
      customStops: (ramp.config.customStops ?? []).map((stop) => stop.color),
      ...stops,
    };
  }

  return {
    mode: 'preset',
    name: ramp.name,
    hue: { ...huePreset },
    chroma: { ...ramp.config.chromaPreset },
    ...stops,
  };
}

function exportSparseStops(ramp: RampConfig): SparseStopDocument[] {
  return normalizeStops(ramp.stops)
    .filter((stop) => stop.state !== 'anchor')
    .flatMap((stop) => {
      const isCanonical = stop.index % 100 === 0;
      const isHidden = stop.state === 'hidden';

      if (isCanonical && !isHidden) {
        return [];
      }

      return [
        {
          index: stop.index,
          ...(isHidden ? { hidden: true as const } : {}),
        },
      ];
    });
}

function parseTheme(input: unknown): ThemeSettings {
  if (!isRecord(input)) {
    throw new Error('theme must be an object.');
  }

  assertExactKeys(input, THEME_KEYS, 'theme');

  const lMax = parseNumberInRange(input.lMax, 'theme.lMax', 0, 1);
  const lMin = parseNumberInRange(input.lMin, 'theme.lMin', 0, 1);

  if (lMin >= lMax) {
    throw new Error('theme.lMin must be less than theme.lMax.');
  }

  return { lMax, lMin };
}

function parseGroups(input: unknown): PaletteGroup[] {
  if (!Array.isArray(input)) {
    throw new Error('groups must be an array.');
  }

  const usedGroupIds = new Set<string>();
  const usedRampIds = new Set<string>();

  return input.map((groupInput, groupIndex) => {
    if (!isRecord(groupInput)) {
      throw new Error(`groups[${groupIndex}] must be an object.`);
    }

    assertExactKeys(groupInput, GROUP_KEYS, `groups[${groupIndex}]`);

    const name = parseNonEmptyString(groupInput.name, `groups[${groupIndex}].name`);
    const ramps = parseRamps(groupInput.ramps, groupIndex, name, usedRampIds);

    return {
      id: makeUniqueId(name, usedGroupIds, `group-${groupIndex + 1}`),
      name,
      ramps,
    };
  });
}

function parseRamps(input: unknown, groupIndex: number, groupName: string, usedRampIds: Set<string>): WorkspaceRamp[] {
  if (!Array.isArray(input)) {
    throw new Error(`groups[${groupIndex}].ramps must be an array.`);
  }

  return input.map((rampInput, rampIndex) => parseRamp(rampInput, groupIndex, groupName, rampIndex, usedRampIds));
}

function parseRamp(
  input: unknown,
  groupIndex: number,
  groupName: string,
  rampIndex: number,
  usedRampIds: Set<string>,
): WorkspaceRamp {
  if (!isRecord(input)) {
    throw new Error(`groups[${groupIndex}].ramps[${rampIndex}] must be an object.`);
  }

  const mode = parseRampMode(input.mode, `groups[${groupIndex}].ramps[${rampIndex}].mode`);
  const name = parseNonEmptyString(input.name, `groups[${groupIndex}].ramps[${rampIndex}].name`);
  const stops = hydrateStops(parseSparseStops(input.stops, `groups[${groupIndex}].ramps[${rampIndex}].stops`));

  if ('anchor' in input) {
    throw new Error(`groups[${groupIndex}].ramps[${rampIndex}] must not include anchor data.`);
  }

  const config: RampConfig =
    mode === 'preset'
      ? (() => {
          assertExactKeys(input, PRESET_RAMP_KEYS, `groups[${groupIndex}].ramps[${rampIndex}]`);
          return {
            name,
            huePreset: parsePresetHue(input.hue, `groups[${groupIndex}].ramps[${rampIndex}].hue`),
            chromaPreset: parsePresetChroma(input.chroma, `groups[${groupIndex}].ramps[${rampIndex}].chroma`),
            customStops: [],
            anchor: undefined,
            stops,
          };
        })()
      : (() => {
          assertExactKeys(input, CUSTOM_STOPS_RAMP_KEYS, `groups[${groupIndex}].ramps[${rampIndex}]`);
          const customStops = parseCustomStops(input.customStops, `groups[${groupIndex}].ramps[${rampIndex}].customStops`);
          const hue = parseEndpointHue(input.hue, `groups[${groupIndex}].ramps[${rampIndex}].hue`);
          const chroma = parseEndpointChroma(input.chroma, `groups[${groupIndex}].ramps[${rampIndex}].chroma`);

          return {
            name,
            huePreset: hydrateCustomStopHuePreset(hue),
            chromaPreset: hydrateCustomStopChromaPreset(chroma),
            customStops: customStops.map((color, index) => ({
              id: `custom-stop-${index + 1}`,
              color,
            })),
            anchor: undefined,
            stops,
          };
        })();

  return {
    id: makeUniqueId(name, usedRampIds, `${slugify(groupName)}-ramp-${rampIndex + 1}`),
    name,
    config,
  };
}

function parsePresetHue(input: unknown, path: string): HuePreset {
  if (!isRecord(input)) {
    throw new Error(`${path} must be an object.`);
  }

  assertExactKeys(input, PRESET_HUE_KEYS, path);

  return {
    start: parseHue(input.start, `${path}.start`),
    center: parseHue(input.center, `${path}.center`),
    end: parseHue(input.end, `${path}.end`),
    centerPosition: parseNumberInRange(input.centerPosition, `${path}.centerPosition`, 0, 1),
    startShape: parseNumberInRange(input.startShape, `${path}.startShape`, 0, 1),
    endShape: parseNumberInRange(input.endShape, `${path}.endShape`, 0, 1),
    direction: parseHueDirection(input.direction, `${path}.direction`),
  };
}

function parsePresetChroma(input: unknown, path: string): ChromaPreset {
  if (!isRecord(input)) {
    throw new Error(`${path} must be an object.`);
  }

  assertExactKeys(input, PRESET_CHROMA_KEYS, path);

  return {
    start: parseNumberInRange(input.start, `${path}.start`, 0, 0.5),
    center: parseNumberInRange(input.center, `${path}.center`, 0, 0.5),
    end: parseNumberInRange(input.end, `${path}.end`, 0, 0.5),
    centerPosition: parseNumberInRange(input.centerPosition, `${path}.centerPosition`, 0, 1),
    startShape: parseNumberInRange(input.startShape, `${path}.startShape`, 0, 1),
    endShape: parseNumberInRange(input.endShape, `${path}.endShape`, 0, 1),
  };
}

function parseEndpointHue(input: unknown, path: string): EndpointHueDocument {
  if (!isRecord(input)) {
    throw new Error(`${path} must be an object.`);
  }

  assertExactKeys(input, ENDPOINT_KEYS, path);

  return {
    start: parseHue(input.start, `${path}.start`),
    end: parseHue(input.end, `${path}.end`),
  };
}

function parseEndpointChroma(input: unknown, path: string): EndpointChromaDocument {
  if (!isRecord(input)) {
    throw new Error(`${path} must be an object.`);
  }

  assertExactKeys(input, ENDPOINT_KEYS, path);

  return {
    start: parseNumberInRange(input.start, `${path}.start`, 0, 0.5),
    end: parseNumberInRange(input.end, `${path}.end`, 0, 0.5),
  };
}

function parseCustomStops(input: unknown, path: string): string[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error(`${path} must be a non-empty array.`);
  }

  return input.map((value, index) => {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${path}[${index}] must be a non-empty color string.`);
    }

    try {
      parseOklchColor(value);
    } catch {
      throw new Error(`${path}[${index}] must be a valid color.`);
    }

    return value;
  });
}

function parseSparseStops(input: unknown, path: string): SparseStopDocument[] {
  if (input === undefined) {
    return [];
  }

  if (!Array.isArray(input)) {
    throw new Error(`${path} must be an array.`);
  }

  const seen = new Set<number>();

  return input.map((stopInput, index) => {
    if (!isRecord(stopInput)) {
      throw new Error(`${path}[${index}] must be an object.`);
    }

    assertExactKeys(stopInput, SPARSE_STOP_KEYS, `${path}[${index}]`);

    const parsedIndex = parseStopIndex(stopInput.index, `${path}[${index}].index`);
    const hidden = parseOptionalHidden(stopInput.hidden, `${path}[${index}].hidden`);
    const isCanonical = parsedIndex % 100 === 0;

    if (isCanonical && hidden !== true) {
      throw new Error(`${path}[${index}] is not a relevant stop deviation.`);
    }

    if (seen.has(parsedIndex)) {
      throw new Error(`${path}[${index}].index is duplicated.`);
    }

    seen.add(parsedIndex);
    return hidden ? { index: parsedIndex, hidden: true as const } : { index: parsedIndex };
  });
}

function hydrateStops(sparseStops: SparseStopDocument[]) {
  let stops = createCanonicalStops();

  for (const stop of sparseStops.filter((entry) => entry.index % 100 !== 0).sort((left, right) => left.index - right.index)) {
    stops = addStop(stops, stop.index);
  }

  const hiddenIndices = new Set(sparseStops.filter((entry) => entry.hidden).map((entry) => entry.index));

  return normalizeStops(
    stops.map((stop) => ({
      ...stop,
      state: hiddenIndices.has(stop.index) ? 'hidden' : 'default',
    })),
  );
}

function hydrateCustomStopHuePreset(input: EndpointHueDocument): HuePreset {
  const delta = ((input.end - input.start + 540) % 360) - 180;
  return {
    start: input.start,
    center: normalizeHue(input.start + delta * 0.5),
    end: input.end,
    centerPosition: 0.5,
    startShape: 0,
    endShape: 0,
    direction: 'auto',
  };
}

function hydrateCustomStopChromaPreset(input: EndpointChromaDocument): ChromaPreset {
  return {
    start: input.start,
    center: round(input.start + (input.end - input.start) * 0.5, 4),
    end: input.end,
    centerPosition: 0.5,
    startShape: 0,
    endShape: 0,
  };
}

function requireHuePreset(ramp: RampConfig): HuePreset {
  if (!ramp.huePreset) {
    throw new Error(`Ramp "${ramp.name}" is missing a hue preset.`);
  }

  return ramp.huePreset;
}

function parseRampMode(input: unknown, path: string): WorkspaceRampDocument['mode'] {
  if (input === 'preset' || input === 'customStops') {
    return input;
  }

  throw new Error(`${path} must be "preset" or "customStops".`);
}

function parseHueDirection(input: unknown, path: string): HueDirection {
  if (input === 'auto' || input === 'clockwise' || input === 'counterclockwise') {
    return input;
  }

  throw new Error(`${path} must be "auto", "clockwise", or "counterclockwise".`);
}

function parseHue(input: unknown, path: string): number {
  const value = parseNumberInRange(input, path, 0, 360);
  return normalizeHue(value);
}

function parseStopIndex(input: unknown, path: string): number {
  if (typeof input !== 'number' || !Number.isInteger(input) || input < 0 || input > 1000 || input % 25 !== 0) {
    throw new Error(`${path} must be an integer stop from 0 to 1000 in increments of 25.`);
  }

  return input;
}

function parseOptionalHidden(input: unknown, path: string): true | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (input === true) {
    return true;
  }

  throw new Error(`${path} may only be true when provided.`);
}

function parseNumberInRange(input: unknown, path: string, min: number, max: number): number {
  if (typeof input !== 'number' || !Number.isFinite(input) || input < min || input > max) {
    throw new Error(`${path} must be a finite number between ${min} and ${max}.`);
  }

  return input;
}

function parseNonEmptyString(input: unknown, path: string): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string.`);
  }

  return input.trim();
}

function assertExactKeys(record: Record<string, unknown>, allowedKeys: readonly string[], path: string): void {
  const extras = Object.keys(record).filter((key) => !allowedKeys.includes(key));
  if (extras.length > 0) {
    throw new Error(`${path} contains unsupported keys: ${extras.join(', ')}.`);
  }
}

function makeUniqueId(input: string, used: Set<string>, fallback: string): string {
  const initial = slugify(input) || fallback;
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
