import { describe, expect, it } from 'vitest';
import { createDefaultConfig, createSeededRampConfig, insertStopBetween } from '../src/lib/color';
import {
  createWorkspaceExportBundle,
  normalizeImportedWorkspace,
  parseWorkspaceImport,
  type WorkspaceSnapshot,
} from '../src/features/ramp/workspaceSerialization';

function createWorkspaceFixture(): WorkspaceSnapshot {
  const redBase = createSeededRampConfig('Red', '#af261d', 0.05, 0.18);
  const redWithMinorStops = insertStopBetween(redBase.stops, 100, 200);
  const red = {
    ...redBase,
    customStops: [{ id: 'custom-stop-1', color: '#dc2626' }],
    stops: redWithMinorStops,
    name: 'Red',
  };

  const blue = {
    ...createSeededRampConfig('Blue', '#2563eb', 0.04, 0.16),
    name: 'Blue',
  };

  return {
    theme: { lMax: 1, lMin: 0.2 },
    displayMode: 'row',
    displayOptions: {
      allowHiddenStops: false,
      showHex: true,
      showLightness: true,
      showChroma: false,
      showHue: true,
    },
    selectedRampId: 'blue-ramp',
    selectedStop: 400,
    groups: [
      {
        id: 'neutral-brand',
        name: 'Neutral & Brand',
        ramps: [
          { id: 'red-ramp', name: 'Red', config: red },
        ],
      },
      {
        id: 'utility',
        name: 'Utility',
        ramps: [
          { id: 'blue-ramp', name: 'Blue', config: blue },
        ],
      },
    ],
  };
}

describe('workspace serialization', () => {
  it('round-trips workspace export and import state', () => {
    const snapshot = createWorkspaceFixture();
    const bundle = createWorkspaceExportBundle(snapshot);
    const imported = parseWorkspaceImport(bundle.jsonConfig);

    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error(imported.error);

    expect(imported.value.theme).toEqual(snapshot.theme);
    expect(imported.value.displayMode).toBe(snapshot.displayMode);
    expect(imported.value.displayOptions).toEqual(snapshot.displayOptions);
    expect(imported.value.selectedRampId).toBe(snapshot.selectedRampId);
    expect(imported.value.selectedStop).toBe(snapshot.selectedStop);
    expect(imported.value.groups.map((group) => group.id)).toEqual(snapshot.groups.map((group) => group.id));
    expect(imported.value.groups.map((group) => group.name)).toEqual(snapshot.groups.map((group) => group.name));
    expect(imported.value.groups[0].ramps.map((ramp) => ramp.id)).toEqual(snapshot.groups[0].ramps.map((ramp) => ramp.id));
    expect(imported.value.groups[1].ramps[0].config.name).toBe('Blue');
    expect(imported.value.groups[0].ramps[0].config.huePreset).toEqual(snapshot.groups[0].ramps[0].config.huePreset);
    expect(imported.value.groups[0].ramps[0].config.chromaPreset).toEqual(snapshot.groups[0].ramps[0].config.chromaPreset);
    expect(imported.value.groups[0].ramps[0].config.stops).toHaveLength(snapshot.groups[0].ramps[0].config.stops.length);
    expect(imported.value.groups[0].ramps[0].config.customStops).toEqual(snapshot.groups[0].ramps[0].config.customStops);
    expect(bundle.jsonConfig).toContain('"version": 5');
    expect(bundle.jsonConfig).toContain('"selectedRampId": "blue-ramp"');
  });

  it('imports the legacy single-ramp export into one group', () => {
    const legacy = createDefaultConfig();
    const imported = parseWorkspaceImport(JSON.stringify(legacy));

    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error(imported.error);

    expect(imported.value.groups).toHaveLength(1);
    expect(imported.value.groups[0].ramps).toHaveLength(1);
    expect(imported.value.groups[0].ramps[0].name).toBe(legacy.ramp.name);
    expect(imported.value.selectedRampId).toBe(imported.value.groups[0].ramps[0].id);
    expect(imported.value.theme).toEqual(legacy.theme);
    expect(imported.value.displayMode).toBe(legacy.displayMode);
  });

  it('rejects malformed or unknown imports without mutating state', () => {
    expect(parseWorkspaceImport('{')).toEqual({ ok: false, error: expect.any(String) });
    expect(parseWorkspaceImport(JSON.stringify({ version: 99 }))).toEqual({ ok: false, error: expect.any(String) });
  });

  it('normalizes imported ramps through existing stop helpers', () => {
    const imported = normalizeImportedWorkspace({
      version: 2,
      theme: { lMax: 0.97, lMin: 0.14 },
      displayMode: 'column',
      displayOptions: { allowHiddenStops: true, showHex: false, showLightness: false, showChroma: false, showHue: false },
      selectedRampId: 'missing',
      selectedStop: 123,
      groups: [
        {
          id: 'group-a',
          name: 'Group A',
          ramps: [
            {
              id: 'ramp-a',
              name: 'Ramp A',
              config: {
                version: 1,
                name: 'Ramp A',
                hue: 29,
                chromaPreset: {
                  type: 'range',
                  start: 0.04,
                  end: 0.16,
                  rate: 1,
                  curve: 'linear',
                  direction: 'easeInOut',
                },
                anchor: {
                  color: '#dc2626',
                  stop: 450,
                  resolution: 50,
                },
                stops: [{ index: 123, state: 'hidden' }],
              },
            },
          ],
        },
      ],
    });

    const ramp = imported.groups[0].ramps[0];

    expect(ramp.config.customStops).toEqual([{ id: 'custom-stop-1', color: '#dc2626' }]);
    expect(ramp.config.stops.some((stop) => stop.index === 0)).toBe(true);
    expect(ramp.config.stops.some((stop) => stop.index === 1000)).toBe(true);
    expect(ramp.config.huePreset).toEqual({
      start: 29,
      center: 29,
      end: 29,
      centerPosition: 0.5,
      startShape: 0,
      endShape: 0,
      direction: 'auto',
    });
    expect(ramp.config.chromaPreset).toEqual({
      start: 0.04,
      center: 0.1,
      end: 0.16,
      centerPosition: 0.5,
      startShape: 0,
      endShape: 0,
    });
    expect(imported.selectedRampId).toBe('ramp-a');
    expect(imported.selectedStop).toBe(0);
  });
});
