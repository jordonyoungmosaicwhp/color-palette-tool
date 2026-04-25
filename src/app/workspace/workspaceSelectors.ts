import { createDefaultConfig } from '../../lib/color';
import type { RampConfig } from '../../lib/color';
import type { WorkspaceCollection, WorkspaceRamp } from '../../features/ramp/workspaceTypes';
import { findRampInTree } from '../tree/treeActions';

export function selectActiveCollection(
  collections: WorkspaceCollection[],
  activeCollectionId: string,
): WorkspaceCollection | undefined {
  return collections.find((collection) => collection.id === activeCollectionId) ?? collections[0];
}

export function selectRampById(collections: WorkspaceCollection[], rampId: string): WorkspaceRamp | undefined {
  return findRampInTree(collections, rampId) ?? undefined;
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
    firstRampConfigInCollection(activeCollection) ??
    firstRampConfigInCollection(collections[0]) ??
    createDefaultConfig().ramp
  );
}

function firstRampConfigInCollection(collection?: WorkspaceCollection): RampConfig | undefined {
  if (!collection) {
    return undefined;
  }

  for (const node of collection.children) {
    if (node.type === 'ramp') {
      return node.ramp.config;
    }

    if (node.type === 'group' && node.group.ramps[0]) {
      return node.group.ramps[0].config;
    }
  }

  return undefined;
}
