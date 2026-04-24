import { createDefaultConfig } from '../../lib/color';
import type { RampConfig } from '../../lib/color';
import type { WorkspaceCollection, WorkspaceRamp } from '../../features/ramp/workspaceTypes';

export function selectActiveCollection(
  collections: WorkspaceCollection[],
  activeCollectionId: string,
): WorkspaceCollection | undefined {
  return collections.find((collection) => collection.id === activeCollectionId) ?? collections[0];
}

export function selectRampById(collections: WorkspaceCollection[], rampId: string): WorkspaceRamp | undefined {
  for (const collection of collections) {
    for (const group of collection.groups) {
      const ramp = group.ramps.find((candidate) => candidate.id === rampId);
      if (ramp) return ramp;
    }
  }

  return undefined;
}

export function selectSelectedConfig(
  collections: WorkspaceCollection[],
  activeCollectionId: string,
  selectedRampId: string,
): RampConfig {
  const activeCollection = selectActiveCollection(collections, activeCollectionId);
  const selectedRamp = selectRampById(collections, selectedRampId);

  return (
    selectedRamp?.config ??
    activeCollection?.groups.flatMap((group) => group.ramps)[0]?.config ??
    collections[0]?.groups.flatMap((group) => group.ramps)[0]?.config ??
    createDefaultConfig().ramp
  );
}
