import { describe, expect, it } from 'vitest';
import { createSeededRampConfig, insertStopBetween, toggleStopVisibility } from '../src/lib/color';
import {
  createWorkspaceExport,
  createWorkspaceExportBundle,
  normalizeImportedWorkspace,
  parseWorkspaceImport,
  type WorkspaceSnapshot,
} from '../src/features/ramp/workspaceSerialization';

const DEFAULT_DISPLAY_OPTIONS = {
  allowHiddenStops: true,
  showHex: false,
  showLightness: false,
  showChroma: false,
  showHue: false,
};

function createPresetWorkspaceFixture(): WorkspaceSnapshot {
  const redBase = createSeededRampConfig('Red', '#af261d', 0.05, 0.18);
  const red = {
    ...redBase,
    huePreset: {
      start: 18,
      center: 52,
      end: 126,
      centerPosition: 0.4,
      startShape: 0.2,
      endShape: 0.8,
      startDirection: 'clockwise' as const,
      endDirection: 'clockwise' as const,
    },
    chromaPreset: {
      start: 0.03,
      center: 0.11,
      end: 0.2,
      centerPosition: 0.35,
      startShape: 0.15,
      endShape: 0.65,
    },
    stops: toggleStopVisibility(insertStopBetween(redBase.stops, 100, 200), 300),
  };

  return {
    theme: { lMax: 0.98, lMin: 0.12 },
    displayMode: 'row',
    displayOptions: {
      allowHiddenStops: false,
      showHex: true,
      showLightness: true,
      showChroma: true,
      showHue: true,
    },
    activeCollectionId: 'custom-collection-id',
    selectedRampId: 'custom-ramp-id',
    selectedStop: 300,
    collections: [
      {
        id: 'custom-collection-id',
        name: 'Core',
        children: [
          {
            type: 'group',
            id: 'custom-group-id',
            group: {
              id: 'custom-group-id',
              name: 'Neutral',
              ramps: [{ id: 'custom-ramp-id', name: 'Red', config: red }],
            },
          },
        ],
      },
    ],
  };
}

function createCustomStopsWorkspaceFixture(): WorkspaceSnapshot {
  const tealBase = createSeededRampConfig('Teal', '#0f766e', 0.04, 0.16);
  const teal = {
    ...tealBase,
    huePreset: {
      start: 170,
      center: 240,
      end: 310,
      centerPosition: 0.2,
      startShape: 0.9,
      endShape: 0.4,
      startDirection: 'counterclockwise' as const,
      endDirection: 'counterclockwise' as const,
    },
    chromaPreset: {
      start: 0.02,
      center: 0.22,
      end: 0.12,
      centerPosition: 0.75,
      startShape: 0.85,
      endShape: 0.35,
    },
    customStops: ['#0f766e', 'oklch(0.63 0.11 210)'].map((color, index) => ({
      id: `custom-stop-${index + 1}`,
      color,
    })),
    customStopsMidpointLocked: false,
  };

  return {
    theme: { lMax: 0.96, lMin: 0.14 },
    displayMode: 'row',
    displayOptions: {
      allowHiddenStops: false,
      showHex: true,
      showLightness: true,
      showChroma: false,
      showHue: true,
    },
    activeCollectionId: 'custom-collection-id',
    selectedRampId: 'custom-ramp-id',
    selectedStop: 425,
    collections: [
      {
        id: 'custom-collection-id',
        name: 'Imported Collection',
        children: [
          {
            type: 'group',
            id: 'custom-group-id',
            group: {
              id: 'custom-group-id',
              name: 'Imported Group',
              ramps: [{ id: 'custom-ramp-id', name: 'Teal', config: teal }],
            },
          },
        ],
      },
    ],
  };
}

describe('workspace serialization', () => {
  it('round-trips preset ramps through the new v2 design document', () => {
    const snapshot = createPresetWorkspaceFixture();
    const document = createWorkspaceExport(snapshot);
    const bundle = createWorkspaceExportBundle(snapshot);
    const imported = parseWorkspaceImport(bundle.jsonConfig);

    expect(document).toEqual({
      version: 2,
      theme: snapshot.theme,
      collections: [
        {
          name: 'Core',
          children: [
            {
              type: 'group',
              id: 'custom-group-id',
              name: 'Neutral',
              ramps: [
                {
                  mode: 'preset',
                  name: 'Red',
                  hue: snapshot.collections[0].children[0].type === 'group' ? snapshot.collections[0].children[0].group.ramps[0].config.huePreset : undefined,
                  chroma: snapshot.collections[0].children[0].type === 'group' ? snapshot.collections[0].children[0].group.ramps[0].config.chromaPreset : undefined,
                  stops: [{ index: 150 }, { index: 300, hidden: true }],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(bundle.jsonConfig).toContain('"version": 2');
    expect(bundle.jsonConfig).not.toContain('"displayMode"');
    expect(bundle.jsonConfig).not.toContain('"displayOptions"');
    expect(bundle.jsonConfig).not.toContain('"activeCollectionId"');
    expect(bundle.jsonConfig).not.toContain('"selectedRampId"');
    expect(bundle.jsonConfig).not.toContain('"selectedStop"');
    expect(bundle.jsonConfig).not.toContain('"origin"');
    expect(bundle.jsonConfig).not.toContain('"resolution"');
    expect(bundle.jsonConfig).not.toContain('"anchor"');

    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error(imported.error);

    expect(imported.value.theme).toEqual(snapshot.theme);
    expect(imported.value.displayMode).toBe('column');
    expect(imported.value.displayOptions).toEqual(DEFAULT_DISPLAY_OPTIONS);
    expect(imported.value.selectedStop).toBe(500);
    expect(imported.value.collections[0].name).toBe(snapshot.collections[0].name);
    expect(imported.value.collections[0].id).not.toBe(snapshot.collections[0].id);
    const importedGroup = imported.value.collections[0].children[0];
    expect(importedGroup.type).toBe('group');
    if (importedGroup.type !== 'group') throw new Error('Expected group node.');
    expect(importedGroup.group.name).toBe('Neutral');
    expect(importedGroup.group.ramps[0].name).toBe('Red');
    expect(imported.value.activeCollectionId).toBe(imported.value.collections[0].id);
    expect(imported.value.selectedRampId).toBe(importedGroup.group.ramps[0].id);
    expect(importedGroup.group.ramps[0].config.huePreset).toEqual(
      snapshot.collections[0].children[0].type === 'group' ? snapshot.collections[0].children[0].group.ramps[0].config.huePreset : undefined,
    );
    expect(importedGroup.group.ramps[0].config.chromaPreset).toEqual(
      snapshot.collections[0].children[0].type === 'group' ? snapshot.collections[0].children[0].group.ramps[0].config.chromaPreset : undefined,
    );
    expect(importedGroup.group.ramps[0].config.stops).toEqual(
      snapshot.collections[0].children[0].type === 'group' ? snapshot.collections[0].children[0].group.ramps[0].config.stops : [],
    );
    expect(importedGroup.group.ramps[0].config.customStops).toEqual([]);
  });

  it('round-trips custom-stop ramps while omitting derived midpoint data', () => {
    const snapshot = createCustomStopsWorkspaceFixture();
    const bundle = createWorkspaceExportBundle(snapshot);
    const imported = parseWorkspaceImport(bundle.jsonConfig);
    const parsed = JSON.parse(bundle.jsonConfig) as {
      collections: Array<{ children: Array<{ type: string; group?: { ramps: Array<Record<string, unknown>> } }> }>;
    };

    expect(parsed.collections[0].children[0].type).toBe('group');
    expect((parsed.collections[0].children[0] as { ramps?: Array<Record<string, unknown>> }).ramps?.[0]).toEqual({
      mode: 'customStops',
      name: 'Teal',
      hue: {
        start: 170,
        end: 310,
      },
      chroma: {
        start: 0.02,
        end: 0.12,
      },
      customStops: ['#0f766e', 'oklch(0.63 0.11 210)'],
      customStopsMidpointLocked: false,
    });
    expect(bundle.jsonConfig).not.toContain('"center"');
    expect(bundle.jsonConfig).not.toContain('"centerPosition"');
    expect(bundle.jsonConfig).not.toContain('"startShape"');
    expect(bundle.jsonConfig).not.toContain('"endShape"');
    expect(bundle.jsonConfig).not.toContain('"direction"');

    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error(imported.error);

    const groupNode = imported.value.collections[0].children[0];
    expect(groupNode.type).toBe('group');
    if (groupNode.type !== 'group') throw new Error('Expected group node.');
    const ramp = groupNode.group.ramps[0];
    expect(ramp.config.customStops).toEqual([
      { id: 'custom-stop-1', color: '#0f766e' },
      { id: 'custom-stop-2', color: 'oklch(0.63 0.11 210)' },
    ]);
    expect(ramp.config.huePreset?.start).toBe(170);
    expect(ramp.config.huePreset?.end).toBe(310);
    expect(ramp.config.chromaPreset.start).toBe(0.02);
    expect(ramp.config.chromaPreset.end).toBe(0.12);
    expect(ramp.config.customStopsMidpointLocked).toBe(false);
    expect(imported.value.displayMode).toBe('column');
    expect(imported.value.displayOptions).toEqual(DEFAULT_DISPLAY_OPTIONS);
    expect(imported.value.selectedStop).toBe(500);
    expect(imported.value.activeCollectionId).toBe(imported.value.collections[0].id);
    expect(imported.value.selectedRampId).toBe(ramp.id);
  });

  it('rejects legacy workspace snapshots and the old single-ramp v1 format', () => {
    expect(
      parseWorkspaceImport(
        JSON.stringify({
          version: 1,
          theme: { lMax: 1, lMin: 0.2 },
          groups: [],
        }),
      ),
    ).toEqual({ ok: false, error: expect.any(String) });

    expect(
      parseWorkspaceImport(
        JSON.stringify({
          version: 1,
          theme: { lMax: 1, lMin: 0.2 },
          ramp: {},
        }),
      ),
    ).toEqual({ ok: false, error: expect.any(String) });
  });

  it('normalizes invalid JSON input to a failure result', () => {
    expect(parseWorkspaceImport('{')).toEqual({ ok: false, error: expect.any(String) });
  });

  it('rejects malformed exported collections', () => {
    expect(() =>
      normalizeImportedWorkspace({
        version: 2,
        theme: { lMax: 1, lMin: 0.2 },
        collections: [
          {
            name: 'Broken',
            children: [],
            extra: true,
          },
        ],
      }),
    ).toThrow(/collections\[0\]/);
  });
});
