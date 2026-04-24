import type { WorkspaceCollection } from '../../features/ramp/workspaceTypes';

export interface AddCollectionResult {
  collections: WorkspaceCollection[];
  activeCollectionId: string;
  expandedCollectionIds: string[];
  selectedRampId: string;
}

export interface DeleteCollectionResult {
  collections: WorkspaceCollection[];
  activeCollectionId: string;
  expandedCollectionIds: string[];
  selectedRampId: string;
}

export interface SelectCollectionResult {
  activeCollectionId: string;
  expandedCollectionIds: string[];
  selectedRampId: string;
  inspectorOpen: boolean;
}

export function addCollection(
  collections: WorkspaceCollection[],
  expandedCollectionIds: string[],
  collectionId: string,
): AddCollectionResult {
  const nextIndex = collections.length + 1;
  const nextCollection: WorkspaceCollection = {
    id: collectionId,
    name: `New Collection ${nextIndex}`,
    groups: [],
  };

  return {
    collections: [...collections, nextCollection],
    activeCollectionId: nextCollection.id,
    expandedCollectionIds: Array.from(new Set([...expandedCollectionIds, nextCollection.id])),
    selectedRampId: '',
  };
}

export function deleteCollection(
  collections: WorkspaceCollection[],
  collectionId: string,
  activeCollectionId: string,
  expandedCollectionIds: string[],
  selectedCollectionId: string | undefined,
  selectedRampId: string,
): DeleteCollectionResult {
  const nextCollections = collections.filter((collection) => collection.id !== collectionId);
  const nextActiveCollectionId = activeCollectionId === collectionId ? nextCollections[0]?.id ?? '' : activeCollectionId;

  return {
    collections: nextCollections,
    activeCollectionId: nextActiveCollectionId,
    expandedCollectionIds: expandedCollectionIds.filter((id) => id !== collectionId),
    selectedRampId:
      selectedCollectionId === collectionId ? firstRampId(nextCollections, nextActiveCollectionId) : selectedRampId,
  };
}

export function renameCollection(
  collections: WorkspaceCollection[],
  collectionId: string,
  name: string,
): WorkspaceCollection[] {
  return collections.map((collection) => (collection.id === collectionId ? { ...collection, name } : collection));
}

export function selectCollection(
  expandedCollectionIds: string[],
  collectionId: string,
): SelectCollectionResult {
  return {
    activeCollectionId: collectionId,
    expandedCollectionIds: Array.from(new Set([...expandedCollectionIds, collectionId])),
    selectedRampId: '',
    inspectorOpen: true,
  };
}

function firstRampId(nextCollections: WorkspaceCollection[], collectionId?: string): string {
  const targetCollection = collectionId
    ? nextCollections.find((collection) => collection.id === collectionId)
    : nextCollections[0];
  const fromTarget = targetCollection?.groups.flatMap((group) => group.ramps)[0]?.id;
  return fromTarget ?? nextCollections.flatMap((collection) => collection.groups.flatMap((group) => group.ramps))[0]?.id ?? '';
}
