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
    selectedRampId: 'manually-assigned-ramp-id',
    selectedStop: 300,
    collections: [
      {
        id: 'custom-collection-id',
        name: 'Core',
        children: [],
        groups: [
          {
            id: 'custom-group-id',
            name: 'Neutral',
            ramps: [{ id: 'custom-ramp-id', name: 'Red', config: red }],
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
        children: [],
        groups: [
          {
            id: 'custom-group-id',
            name: 'Imported Group',
            ramps: [{ id: 'custom-ramp-id', name: 'Teal', config: teal }],
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
          groups: [
            {
              name: 'Neutral',
              ramps: [
                {
                  mode: 'preset',
                  name: 'Red',
                  hue: snapshot.collections[0].groups[0].ramps[0].config.huePreset,
                  chroma: snapshot.collections[0].groups[0].ramps[0].config.chromaPreset,
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
    expect(bundle.jsonConfig).not.toContain('"id"');
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
    expect(imported.value.collections[0].groups[0].name).toBe(snapshot.collections[0].groups[0].name);
    expect(imported.value.collections[0].groups[0].id).not.toBe(snapshot.collections[0].groups[0].id);
    expect(imported.value.collections[0].groups[0].ramps[0].name).toBe('Red');
    expect(imported.value.collections[0].groups[0].ramps[0].id).not.toBe(snapshot.collections[0].groups[0].ramps[0].id);
    expect(imported.value.activeCollectionId).toBe(imported.value.collections[0].id);
    expect(imported.value.selectedRampId).toBe(imported.value.collections[0].groups[0].ramps[0].id);
    expect(imported.value.collections[0].groups[0].ramps[0].config.huePreset).toEqual(
      snapshot.collections[0].groups[0].ramps[0].config.huePreset,
    );
    expect(imported.value.collections[0].groups[0].ramps[0].config.chromaPreset).toEqual(
      snapshot.collections[0].groups[0].ramps[0].config.chromaPreset,
    );
    expect(imported.value.collections[0].groups[0].ramps[0].config.stops).toEqual(snapshot.collections[0].groups[0].ramps[0].config.stops);
    expect(imported.value.collections[0].groups[0].ramps[0].config.customStops).toEqual([]);
  });

  it('round-trips custom-stop ramps while omitting derived midpoint data', () => {
    const snapshot = createCustomStopsWorkspaceFixture();
    const bundle = createWorkspaceExportBundle(snapshot);
    const imported = parseWorkspaceImport(bundle.jsonConfig);
    const parsed = JSON.parse(bundle.jsonConfig) as {
      collections: Array<{ groups: Array<{ ramps: Array<Record<string, unknown>> }> }>;
    };

    expect(parsed.collections[0].groups[0].ramps[0]).toEqual({
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

    const ramp = imported.value.collections[0].groups[0].ramps[0];
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
          ramp: createSeededRampConfig('Legacy', '#af261d', 0.05, 0.18),
          displayMode: 'column',
        }),
      ),
    ).toEqual({ ok: false, error: expect.any(String) });
  });

  it('rejects unsupported anchor data and legacy hue or chroma shapes', () => {
    expect(() =>
      normalizeImportedWorkspace({
        version: 2,
        theme: { lMax: 0.96, lMin: 0.14 },
        collections: [
          {
            name: 'Collection A',
            groups: [
              {
                name: 'Group A',
                ramps: [
                  {
                    mode: 'preset',
                    name: 'Ramp A',
                    hue: {
                      start: 29,
                      center: 29,
                      end: 29,
                      centerPosition: 0.5,
                      startShape: 0,
                      endShape: 0,
                      startDirection: 'auto',
                      endDirection: 'auto',
                    },
                    chroma: {
                      start: 0.04,
                      center: 0.1,
                      end: 0.16,
                      centerPosition: 0.5,
                      startShape: 0,
                      endShape: 0,
                    },
                    anchor: {
                      color: '#dc2626',
                      stop: 450,
                    },
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toThrow(/anchor/i);

    expect(() =>
      normalizeImportedWorkspace({
        version: 2,
        theme: { lMax: 0.96, lMin: 0.14 },
        collections: [
          {
            name: 'Collection A',
            groups: [
              {
                name: 'Group A',
                ramps: [
                  {
                    mode: 'preset',
                    name: 'Ramp A',
                    hue: {
                      type: 'constant',
                      hue: 29,
                    },
                    chroma: {
                      start: 0.04,
                      end: 0.16,
                      rate: 1,
                      curve: 'linear',
                      direction: 'easeInOut',
                    },
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects invalid stop indices, missing required fields, and wrong field types', () => {
    expect(() =>
      normalizeImportedWorkspace({
        version: 2,
        theme: { lMax: 0.96, lMin: 0.14 },
        collections: [
          {
            name: 'Collection A',
            groups: [
              {
                name: 'Group A',
                ramps: [
                  {
                    mode: 'preset',
                    name: 'Ramp A',
                    hue: {
                      start: 29,
                      center: 29,
                      end: 29,
                      centerPosition: 0.5,
                      startShape: 0,
                      endShape: 0,
                      startDirection: 'auto',
                      endDirection: 'auto',
                    },
                    chroma: {
                      start: 0.04,
                      center: 0.1,
                      end: 0.16,
                      centerPosition: 0.5,
                      startShape: 0,
                      endShape: 0,
                    },
                    stops: [{ index: 123 }],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toThrow(/increments of 25/);

    expect(() =>
      normalizeImportedWorkspace({
        version: 2,
        theme: { lMax: 0.96, lMin: 0.14 },
        collections: [
          {
            name: 'Collection A',
            groups: [
              {
                name: 'Group A',
                ramps: [
                  {
                    mode: 'customStops',
                    name: 'Ramp A',
                    hue: {
                      start: 29,
                      end: 64,
                    },
                    chroma: {
                      start: 0.04,
                    },
                    customStops: ['#dc2626'],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toThrow(/end/);

    expect(() =>
      normalizeImportedWorkspace({
        version: 2,
        theme: { lMax: '1', lMin: 0.14 },
        collections: [],
      }),
    ).toThrow(/theme\.lMax/);
  });

  it('rejects malformed JSON input', () => {
    expect(parseWorkspaceImport('{')).toEqual({ ok: false, error: expect.any(String) });
  });
});
