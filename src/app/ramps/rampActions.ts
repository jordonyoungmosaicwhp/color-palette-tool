import { createSeededRampConfig } from '../../lib/color';
import type { RampConfig } from '../../lib/color';
import type { WorkspaceCollection, WorkspaceRamp } from '../../features/ramp/workspaceTypes';

export function addRamp(collections: WorkspaceCollection[], groupId: string, rampId: string): WorkspaceCollection[] {
  const newRamp = createWorkspaceRamp(rampId, 'New Ramp', '#2563eb', 0.04, 0.16);

  return collections.map((collection) => ({
    ...collection,
    groups: collection.groups.map((group) => (group.id === groupId ? { ...group, ramps: [...group.ramps, newRamp] } : group)),
  }));
}

export function deleteRamp(collections: WorkspaceCollection[], rampId: string): WorkspaceCollection[] {
  return collections.map((collection) => ({
    ...collection,
    groups: collection.groups.map((group) => ({
      ...group,
      ramps: group.ramps.filter((ramp) => ramp.id !== rampId),
    })),
  }));
}

export function duplicateRamp(
  collections: WorkspaceCollection[],
  rampId: string,
  duplicateRampId: string,
): { collections: WorkspaceCollection[]; duplicateRamp?: WorkspaceRamp } {
  let nextDuplicate: WorkspaceRamp | undefined;

  const nextCollections = collections.map((collection) => ({
    ...collection,
    groups: collection.groups.map((group) => {
      const ramp = group.ramps.find((item) => item.id === rampId);
      if (!ramp) return group;

      nextDuplicate = {
        ...ramp,
        id: duplicateRampId,
        name: `${ramp.name} Copy`,
        config: {
          ...ramp.config,
          name: `${ramp.name} Copy`,
          stops: [...ramp.config.stops],
          customStops: [...(ramp.config.customStops ?? [])],
          chromaPreset: { ...ramp.config.chromaPreset },
          huePreset: ramp.config.huePreset ? { ...ramp.config.huePreset } : undefined,
        },
      };

      return { ...group, ramps: [...group.ramps, nextDuplicate] };
    }),
  }));

  return {
    collections: nextCollections,
    duplicateRamp: nextDuplicate,
  };
}

export function renameRamp(collections: WorkspaceCollection[], rampId: string, name: string): WorkspaceCollection[] {
  return collections.map((collection) => ({
    ...collection,
    groups: collection.groups.map((group) => ({
      ...group,
      ramps: group.ramps.map((ramp) => (ramp.id === rampId ? { ...ramp, name, config: { ...ramp.config, name } } : ramp)),
    })),
  }));
}

export function updateRampConfig(
  collections: WorkspaceCollection[],
  rampId: string,
  updater: (ramp: RampConfig) => RampConfig,
): WorkspaceCollection[] {
  return collections.map((collection) => ({
    ...collection,
    groups: collection.groups.map((group) => ({
      ...group,
      ramps: group.ramps.map((ramp) => (ramp.id === rampId ? { ...ramp, config: updater(ramp.config) } : ramp)),
    })),
  }));
}

function createWorkspaceRamp(id: string, name: string, color: string, chromaStart: number, chromaEnd: number): WorkspaceRamp {
  return {
    id,
    name,
    config: createSeededRampConfig(name, color, chromaStart, chromaEnd),
  };
}
