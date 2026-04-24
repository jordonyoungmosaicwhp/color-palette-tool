import type { WorkspaceCollection, WorkspaceRamp } from '../../features/ramp/workspaceTypes';
import type { WorkspaceNode } from './treeTypes';

export type AddRampTarget =
  | { type: 'collection'; collectionId: string }
  | { type: 'group'; groupId: string };

export interface TreeRampParentInfo {
  collectionId: string;
  parentType: 'collection' | 'group';
  parentId: string;
}

export function syncCollectionChildrenFromGroups(collection: WorkspaceCollection): WorkspaceCollection {
  const currentChildren = collection.children ?? [];
  const rebuiltGroupNodes = collection.groups.map((group) => ({
    type: 'group' as const,
    id: group.id,
    group,
  }));

  const nextChildren: WorkspaceNode[] = [];
  let rebuiltGroupIndex = 0;

  for (const node of currentChildren) {
    if (node.type === 'ramp') {
      nextChildren.push(node);
      continue;
    }

    const rebuiltGroup = rebuiltGroupNodes[rebuiltGroupIndex];
    if (rebuiltGroup) {
      nextChildren.push(rebuiltGroup);
      rebuiltGroupIndex += 1;
    }
  }

  while (rebuiltGroupIndex < rebuiltGroupNodes.length) {
    nextChildren.push(rebuiltGroupNodes[rebuiltGroupIndex]);
    rebuiltGroupIndex += 1;
  }

  return {
    ...collection,
    children: nextChildren,
  };
}

export function syncCollectionsChildrenFromGroups(collections: WorkspaceCollection[]): WorkspaceCollection[] {
  return collections.map(syncCollectionChildrenFromGroups);
}

export function addRampToTree(
  collections: WorkspaceCollection[],
  target: AddRampTarget,
  ramp: WorkspaceRamp,
): WorkspaceCollection[] {
  if (target.type === 'collection') {
    return collections.map((collection) =>
      collection.id === target.collectionId
        ? syncCollectionChildrenFromGroups({
            ...collection,
            children: [...(collection.children ?? []), { type: 'ramp', id: ramp.id, ramp }],
          })
        : syncCollectionChildrenFromGroups(collection),
    );
  }

  return collections.map((collection) => {
    const groupIndex = collection.groups.findIndex((group) => group.id === target.groupId);
    if (groupIndex < 0) {
      return syncCollectionChildrenFromGroups(collection);
    }

    const nextGroups = collection.groups.map((group) =>
      group.id === target.groupId ? { ...group, ramps: [...group.ramps, ramp] } : group,
    );

    return syncCollectionChildrenFromGroups({
      ...collection,
      groups: nextGroups,
    });
  });
}

export function removeRampFromTree(collections: WorkspaceCollection[], rampId: string): WorkspaceCollection[] {
  return collections.map((collection) =>
    syncCollectionChildrenFromGroups({
      ...collection,
      children: (collection.children ?? []).filter((node) => !(node.type === 'ramp' && node.ramp.id === rampId)),
      groups: collection.groups.map((group) => ({
        ...group,
        ramps: group.ramps.filter((ramp) => ramp.id !== rampId),
      })),
    }),
  );
}

export function findRampInTree(collections: WorkspaceCollection[], rampId: string): WorkspaceRamp | null {
  for (const collection of collections) {
    for (const node of collection.children ?? []) {
      if (node.type === 'ramp' && node.ramp.id === rampId) {
        return node.ramp;
      }

      if (node.type === 'group') {
        const found = node.group.ramps.find((ramp) => ramp.id === rampId);
        if (found) {
          return found;
        }
      }
    }
  }

  return null;
}

export function findCollectionIdForRampInTree(collections: WorkspaceCollection[], rampId: string): string | null {
  const parent = findParentForRampInTree(collections, rampId);
  return parent?.collectionId ?? null;
}

export function findParentForRampInTree(collections: WorkspaceCollection[], rampId: string): TreeRampParentInfo | null {
  for (const collection of collections) {
    for (const node of collection.children ?? []) {
      if (node.type === 'ramp' && node.ramp.id === rampId) {
        return {
          collectionId: collection.id,
          parentType: 'collection',
          parentId: collection.id,
        };
      }

      if (node.type === 'group') {
        if (node.group.ramps.some((ramp) => ramp.id === rampId)) {
          return {
            collectionId: collection.id,
            parentType: 'group',
            parentId: node.group.id,
          };
        }
      }
    }
  }

  return null;
}

export function moveRampInTree(
  collections: WorkspaceCollection[],
  rampId: string,
  target: AddRampTarget,
): WorkspaceCollection[] {
  const ramp = findRampInTree(collections, rampId);
  const sourceParent = findParentForRampInTree(collections, rampId);
  if (!ramp || !sourceParent) {
    return collections;
  }

  if (target.type === 'collection') {
    const targetCollection = collections.find((collection) => collection.id === target.collectionId);
    if (!targetCollection) {
      return collections;
    }

    if (sourceParent.parentType === 'collection' && sourceParent.collectionId === target.collectionId) {
      return collections;
    }
  }

  if (target.type === 'group') {
    const targetCollection = collections.find((collection) => collection.groups.some((group) => group.id === target.groupId));
    if (!targetCollection) {
      return collections;
    }

    if (sourceParent.parentType === 'group' && sourceParent.parentId === target.groupId) {
      return collections;
    }
  }

  return addRampToTree(removeRampFromTree(collections, rampId), target, ramp);
}
