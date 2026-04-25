import { formatOklch, generateRamp } from '../../lib/color';
import { addStop, createCanonicalStops, normalizeHue, normalizeStops, parseOklchColor, round } from '../../lib/color';
import type { ChromaPreset, DisplayMode, HueDirection, HuePreset, RampConfig, ThemeSettings } from '../../lib/color';
import type { WorkspaceNode } from '../../app/tree/treeTypes';
import type { RampDisplayOptions, WorkspaceCollection, WorkspaceGroup, WorkspaceRamp } from './workspaceTypes';

export interface WorkspaceSnapshot {
  theme: ThemeSettings;
  displayMode: DisplayMode;
  displayOptions: RampDisplayOptions;
  activeCollectionId: string;
  selectedRampId: string;
  selectedStop: number;
  collections: WorkspaceCollection[];
}

export interface WorkspaceExportV2 {
  version: 2;
  theme: ThemeSettings;
  collections: WorkspaceCollectionDocument[];
}

export interface WorkspaceCollectionDocument {
  name: string;
  children: WorkspaceNodeDocument[];
}

export type WorkspaceNodeDocument =
  | {
      type: 'ramp';
      id: string;
      ramp: WorkspaceRampDocument;
    }
  | {
      type: 'group';
      id: string;
      name: string;
      ramps: WorkspaceRampDocument[];
    };

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
  customStopsMidpointLocked?: boolean;
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
const CUSTOM_STOPS_RAMP_KEYS = ['mode', 'name', 'hue', 'chroma', 'customStops', 'customStopsMidpointLocked', 'stops'] as const;
const PRESET_HUE_KEYS = ['start', 'center', 'end', 'centerPosition', 'startShape', 'endShape', 'startDirection', 'endDirection'] as const;
const PRESET_CHROMA_KEYS = ['start', 'center', 'end', 'centerPosition', 'startShape', 'endShape'] as const;
const ENDPOINT_KEYS = ['start', 'end'] as const;
const SPARSE_STOP_KEYS = ['index', 'hidden'] as const;
const GROUP_KEYS = ['name', 'ramps'] as const;
const COLLECTION_CHILDREN_KEYS = ['name', 'children'] as const;
const COLLECTION_GROUP_KEYS = ['name', 'groups'] as const;
const ROOT_KEYS = ['version', 'theme', 'collections'] as const;
const THEME_KEYS = ['lMax', 'lMin'] as const;

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
    collections: snapshot.collections.map((collection) => ({
      name: collection.name,
      children: collection.children.map((node) => exportWorkspaceNode(node)),
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

  if (input.version !== 2) {
    throw new Error(`Unsupported workspace version: ${String(input.version ?? 'unknown')}`);
  }

  if ('groups' in input || 'ramp' in input) {
    throw new Error('Legacy collection-less imports are no longer supported.');
  }

  assertExactKeys(input, ROOT_KEYS, 'workspace');

  const theme = parseTheme(input.theme);
  const collections = parseCollections(input.collections);
  const firstCollection = collections[0];
  const firstRamp = firstRampInChildren(firstCollection?.children);

  return {
    theme,
    displayMode: DEFAULT_DISPLAY_MODE,
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
    activeCollectionId: firstCollection?.id ?? '',
    selectedRampId: firstRamp?.id ?? '',
    selectedStop: 500,
    collections,
  };
}

export function createWorkspaceCssVariables(snapshot: WorkspaceSnapshot): string {
  return snapshot.collections
    .flatMap((collection) => exportCollectionCssVariables(snapshot.theme, collection))
    .join('\n');
}

export function createWorkspaceTable(snapshot: WorkspaceSnapshot): string {
  const rows: string[] = ['Collection\tGroup\tRamp\tStop\tHex\tOKLCH'];

  for (const collection of snapshot.collections) {
    for (const row of exportCollectionRows(snapshot.theme, collection)) {
      rows.push(row);
    }
  }

  return rows.join('\n');
}

function exportWorkspaceNode(node: WorkspaceNode): WorkspaceNodeDocument {
  if (node.type === 'ramp') {
    return {
      type: 'ramp',
      id: node.id,
      ramp: exportWorkspaceRamp(node.ramp),
    };
  }

  return {
    type: 'group',
    id: node.id,
    name: node.group.name,
    ramps: node.group.ramps.map((ramp) => exportWorkspaceRamp(ramp)),
  };
}

function exportCollectionCssVariables(theme: ThemeSettings, collection: WorkspaceCollection): string[] {
  return collection.children.flatMap((node) => {
    if (node.type === 'ramp') {
      return exportRampCssVariables(theme, collection.name, '', node.ramp);
    }

    return node.group.ramps.flatMap((ramp) => exportRampCssVariables(theme, collection.name, node.group.name, ramp));
  });
}

function exportRampCssVariables(theme: ThemeSettings, collectionName: string, groupName: string, ramp: WorkspaceRamp): string[] {
  const rampStops = generateRamp(theme, ramp.config).filter((stop) => stop.visible);
  const prefix = groupName
    ? `--color-${slugify(collectionName)}-${slugify(groupName)}-${slugify(ramp.name)}`
    : `--color-${slugify(collectionName)}-${slugify(ramp.name)}`;

  return rampStops.map((stop) => `${prefix}-${stop.index}: ${formatOklch(stop.oklch)}; /* ${stop.hex} */`);
}

function exportCollectionRows(theme: ThemeSettings, collection: WorkspaceCollection): string[] {
  const rows: string[] = [];

  for (const node of collection.children) {
    if (node.type === 'ramp') {
      const rampStops = generateRamp(theme, node.ramp.config).filter((stop) => stop.visible);
      for (const stop of rampStops) {
        rows.push(`${collection.name}\t\t${node.ramp.name}\t${stop.index}\t${stop.hex}\t${formatOklch(stop.oklch)}`);
      }
      continue;
    }

    for (const ramp of node.group.ramps) {
      const rampStops = generateRamp(theme, ramp.config).filter((stop) => stop.visible);
      for (const stop of rampStops) {
        rows.push(`${collection.name}\t${node.group.name}\t${ramp.name}\t${stop.index}\t${stop.hex}\t${formatOklch(stop.oklch)}`);
      }
    }
  }

  return rows;
}

function firstRampInChildren(children?: WorkspaceNode[]): WorkspaceRamp | undefined {
  if (!children) {
    return undefined;
  }

  for (const node of children) {
    if (node.type === 'ramp') {
      return node.ramp;
    }

    if (node.type === 'group' && node.group.ramps[0]) {
      return node.group.ramps[0];
    }
  }

  return undefined;
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
      customStopsMidpointLocked: ramp.config.customStopsMidpointLocked ?? true,
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

function parseCollections(input: unknown): WorkspaceCollection[] {
  if (!Array.isArray(input)) {
    throw new Error('collections must be an array.');
  }

  const usedCollectionIds = new Set<string>();
  const usedGroupIds = new Set<string>();
  const usedRampIds = new Set<string>();

  return input.map((collectionInput, collectionIndex) => {
    if (!isRecord(collectionInput)) {
      throw new Error(`collections[${collectionIndex}] must be an object.`);
    }

    const name = parseNonEmptyString(collectionInput.name, `collections[${collectionIndex}].name`);
    const childrenInput = (collectionInput as { children?: unknown }).children;
    const groupsInput = (collectionInput as { groups?: unknown }).groups;
    let children: WorkspaceNode[] = [];

    if (Array.isArray(childrenInput)) {
      assertExactKeys(collectionInput, COLLECTION_CHILDREN_KEYS, `collections[${collectionIndex}]`);
      children = parseChildren(childrenInput, collectionIndex, name, usedGroupIds, usedRampIds);
    } else if (Array.isArray(groupsInput)) {
      assertExactKeys(collectionInput, COLLECTION_GROUP_KEYS, `collections[${collectionIndex}]`);
      children = parseChildrenFromGroups(groupsInput, collectionIndex, name, usedGroupIds, usedRampIds);
    }

    return {
      id: makeUniqueId(name, usedCollectionIds, `collection-${collectionIndex + 1}`),
      name,
      children,
    };
  });
}

function parseChildren(
  input: unknown,
  collectionIndex: number,
  collectionName: string,
  usedGroupIds: Set<string>,
  usedRampIds: Set<string>,
): WorkspaceNode[] {
  if (!Array.isArray(input)) {
    throw new Error(`collections[${collectionIndex}].children must be an array.`);
  }

  const children: WorkspaceNode[] = [];

  for (let childIndex = 0; childIndex < input.length; childIndex += 1) {
    const nodeInput = input[childIndex];
    if (!isRecord(nodeInput)) {
      throw new Error(`collections[${collectionIndex}].children[${childIndex}] must be an object.`);
    }

    const type = nodeInput.type;
    if (type === 'ramp') {
      const ramp = parseRampNode(nodeInput, collectionIndex, childIndex, collectionName, usedRampIds);
      if (ramp) {
        children.push({ type: 'ramp' as const, id: ramp.id, ramp });
      }
      continue;
    }

    if (type === 'group') {
      const group = parseGroupNode(nodeInput, collectionIndex, childIndex, collectionName, usedGroupIds, usedRampIds);
      if (group) {
        children.push({ type: 'group' as const, id: group.id, group });
      }
    }
  }

  return children;
}

function parseChildrenFromGroups(
  input: unknown,
  collectionIndex: number,
  collectionName: string,
  usedGroupIds: Set<string>,
  usedRampIds: Set<string>,
): WorkspaceNode[] {
  if (!Array.isArray(input)) {
    throw new Error(`collections[${collectionIndex}].groups must be an array.`);
  }

  const children: WorkspaceNode[] = [];

  for (let groupIndex = 0; groupIndex < input.length; groupIndex += 1) {
    const groupInput = input[groupIndex];
    if (!isRecord(groupInput)) {
      throw new Error(`collections[${collectionIndex}].groups[${groupIndex}] must be an object.`);
    }

    assertExactKeys(groupInput, GROUP_KEYS, `collections[${collectionIndex}].groups[${groupIndex}]`);

    const name = parseNonEmptyString(groupInput.name, `collections[${collectionIndex}].groups[${groupIndex}].name`);
    const ramps = parseRamps(groupInput.ramps, collectionIndex, groupIndex, collectionName, name, usedRampIds);

    const id = makeUniqueId(name, usedGroupIds, `${slugify(collectionName)}-group-${groupIndex + 1}`);
    children.push({
      type: 'group' as const,
      id,
      group: {
        id,
        name,
        ramps,
      },
    });
  }

  return children;
}

function parseGroupNode(
  input: Record<string, unknown>,
  collectionIndex: number,
  childIndex: number,
  collectionName: string,
  usedGroupIds: Set<string>,
  usedRampIds: Set<string>,
): WorkspaceGroup | undefined {
  assertExactKeys(input, ['type', 'id', 'name', 'ramps'] as const, `collections[${collectionIndex}].children[${childIndex}]`);
  const name = parseNonEmptyString(input.name, `collections[${collectionIndex}].children[${childIndex}].name`);
  const ramps = parseRamps(input.ramps, collectionIndex, childIndex, collectionName, name, usedRampIds);
  return {
    id:
      typeof input.id === 'string' && input.id.length > 0
        ? input.id
        : makeUniqueId(name, usedGroupIds, `${slugify(collectionName)}-group-${childIndex + 1}`),
    name,
    ramps,
  };
}

function parseRampNode(
  input: Record<string, unknown>,
  collectionIndex: number,
  childIndex: number,
  collectionName: string,
  usedRampIds: Set<string>,
): WorkspaceRamp | undefined {
  assertExactKeys(input, ['type', 'id', 'ramp'] as const, `collections[${collectionIndex}].children[${childIndex}]`);
  return parseRamp(input.ramp, collectionIndex, childIndex, 0, collectionName, String(input.id), usedRampIds);
}

function parseGroups(
  input: unknown,
  collectionIndex: number,
  collectionName: string,
  usedGroupIds: Set<string>,
  usedRampIds: Set<string>,
): WorkspaceGroup[] {
  if (!Array.isArray(input)) {
    throw new Error(`collections[${collectionIndex}].groups must be an array.`);
  }

  return input.map((groupInput, groupIndex) => {
    if (!isRecord(groupInput)) {
      throw new Error(`collections[${collectionIndex}].groups[${groupIndex}] must be an object.`);
    }

    assertExactKeys(groupInput, GROUP_KEYS, `collections[${collectionIndex}].groups[${groupIndex}]`);

    const name = parseNonEmptyString(groupInput.name, `collections[${collectionIndex}].groups[${groupIndex}].name`);
    const ramps = parseRamps(groupInput.ramps, collectionIndex, groupIndex, collectionName, name, usedRampIds);

    return {
      id: makeUniqueId(name, usedGroupIds, `${slugify(collectionName)}-group-${groupIndex + 1}`),
      name,
      ramps,
    };
  });
}

function parseRamps(
  input: unknown,
  collectionIndex: number,
  groupIndex: number,
  collectionName: string,
  groupName: string,
  usedRampIds: Set<string>,
): WorkspaceRamp[] {
  if (!Array.isArray(input)) {
    throw new Error(`collections[${collectionIndex}].groups[${groupIndex}].ramps must be an array.`);
  }

  return input.map((rampInput, rampIndex) =>
    parseRamp(rampInput, collectionIndex, groupIndex, rampIndex, collectionName, groupName, usedRampIds),
  );
}

function parseRamp(
  input: unknown,
  collectionIndex: number,
  groupIndex: number,
  rampIndex: number,
  collectionName: string,
  groupName: string,
  usedRampIds: Set<string>,
): WorkspaceRamp {
  const path = `collections[${collectionIndex}].groups[${groupIndex}].ramps[${rampIndex}]`;

  if (!isRecord(input)) {
    throw new Error(`${path} must be an object.`);
  }

  const mode = parseRampMode(input.mode, `${path}.mode`);
  const name = parseNonEmptyString(input.name, `${path}.name`);
  const stops = hydrateStops(parseSparseStops(input.stops, `${path}.stops`));

  if ('anchor' in input) {
    throw new Error(`${path} must not include anchor data.`);
  }

  const config: RampConfig =
    mode === 'preset'
      ? (() => {
          assertExactKeys(input, PRESET_RAMP_KEYS, path);
          return {
            name,
            huePreset: parsePresetHue(input.hue, `${path}.hue`),
            chromaPreset: parsePresetChroma(input.chroma, `${path}.chroma`),
            customStops: [],
            anchor: undefined,
            stops,
          };
        })()
      : (() => {
          assertExactKeys(input, CUSTOM_STOPS_RAMP_KEYS, path);
          const customStops = parseCustomStops(input.customStops, `${path}.customStops`);
          const hue = parseEndpointHue(input.hue, `${path}.hue`);
          const chroma = parseEndpointChroma(input.chroma, `${path}.chroma`);
          const customStopsMidpointLocked = parseOptionalBoolean(input.customStopsMidpointLocked, `${path}.customStopsMidpointLocked`);

          return {
            name,
            huePreset: hydrateCustomStopHuePreset(hue),
            chromaPreset: hydrateCustomStopChromaPreset(chroma),
            customStops: customStops.map((color, index) => ({
              id: `custom-stop-${index + 1}`,
              color,
            })),
            customStopsMidpointLocked: customStopsMidpointLocked ?? true,
            anchor: undefined,
            stops,
          };
        })();

  return {
    id: makeUniqueId(name, usedRampIds, `${slugify(collectionName)}-${slugify(groupName)}-ramp-${rampIndex + 1}`),
    name,
    config,
  };
}

function parsePresetHue(input: unknown, path: string): HuePreset {
  if (!isRecord(input)) {
    throw new Error(`${path} must be an object.`);
  }

  const keys = Object.keys(input).sort();
  const allowedNew = [...PRESET_HUE_KEYS].sort();
  const allowedLegacy = ['center', 'centerPosition', 'direction', 'end', 'endShape', 'start', 'startShape'].sort();
  const isNewShape = JSON.stringify(keys) === JSON.stringify(allowedNew);
  const isLegacyShape = JSON.stringify(keys) === JSON.stringify(allowedLegacy);

  if (!isNewShape && !isLegacyShape) {
    assertExactKeys(input, PRESET_HUE_KEYS, path);
  }

  const legacyDirection = 'direction' in input ? parseHueDirection(input.direction, `${path}.direction`) : undefined;

  return {
    start: parseHue(input.start, `${path}.start`),
    center: parseHue(input.center, `${path}.center`),
    end: parseHue(input.end, `${path}.end`),
    centerPosition: parseNumberInRange(input.centerPosition, `${path}.centerPosition`, 0, 1),
    startShape: parseNumberInRange(input.startShape, `${path}.startShape`, 0, 1),
    endShape: parseNumberInRange(input.endShape, `${path}.endShape`, 0, 1),
    startDirection: 'startDirection' in input
      ? parseHueDirection(input.startDirection, `${path}.startDirection`)
      : legacyDirection ?? 'auto',
    endDirection: 'endDirection' in input
      ? parseHueDirection(input.endDirection, `${path}.endDirection`)
      : legacyDirection ?? 'auto',
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
    startDirection: 'auto',
    endDirection: 'auto',
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

function parseOptionalBoolean(input: unknown, path: string): boolean | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (typeof input === 'boolean') {
    return input;
  }

  throw new Error(`${path} must be a boolean when provided.`);
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
