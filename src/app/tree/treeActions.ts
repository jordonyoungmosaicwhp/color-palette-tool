import type { WorkspaceCollection, WorkspaceGroup, WorkspaceRamp } from '../../features/ramp/workspaceTypes';
import type { WorkspaceNode } from './treeTypes';

export type AddRampTarget =
  | { type: 'collection'; collectionId: string; index?: number }
  | { type: 'group'; groupId: string; index?: number };

export type RampMoveTarget =
  | { type: 'collection'; collectionId: string; index: number }
  | { type: 'group'; groupId: string; index: number };

export interface GroupMoveTarget {
  type: 'collection';
  collectionId: string;
  index: number;
}

export interface TreeRampParentInfo {
  collectionId: string;
  parentType: 'collection' | 'group';
  parentId: string;
}

interface TreeRampLocation extends TreeRampParentInfo {
  collectionIndex: number;
  index: number;
  ramp: WorkspaceRamp;
}

interface TreeGroupLocation {
  collectionId: string;
  collectionIndex: number;
  index: number;
  group: WorkspaceGroup;
}

export function syncCollectionChildrenFromGroups(collection: WorkspaceCollection): WorkspaceCollection {
  const currentChildren = collection.children ?? [];
  const rebuiltGroupNodes = collection.groups.map((group) => ({
    type: 'group' as const,
    id: group.id,
    group: cloneGroup(group),
  }));

  const nextChildren: WorkspaceNode[] = [];
  let rebuiltGroupIndex = 0;

  for (const node of currentChildren) {
    if (node.type === 'ramp') {
      nextChildren.push(cloneNode(node));
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
    groups: collection.groups.map(cloneGroup),
    children: nextChildren,
  };
}

export function syncCollectionsChildrenFromGroups(collections: WorkspaceCollection[]): WorkspaceCollection[] {
  return collections.map(syncCollectionChildrenFromGroups);
}

export function syncCollectionGroupsFromChildren(collection: WorkspaceCollection): WorkspaceCollection {
  return {
    ...collection,
    children: (collection.children ?? []).map(cloneNode),
    groups: (collection.children ?? [])
      .filter((node): node is Extract<WorkspaceNode, { type: 'group' }> => node.type === 'group')
      .map((node) => cloneGroup(node.group)),
  };
}

export function syncCollectionsGroupsFromChildren(collections: WorkspaceCollection[]): WorkspaceCollection[] {
  return collections.map(syncCollectionGroupsFromChildren);
}

export function addRampToTree(
  collections: WorkspaceCollection[],
  target: AddRampTarget,
  ramp: WorkspaceRamp,
): WorkspaceCollection[] {
  const nextCollections = syncCollectionsChildrenFromGroups(cloneCollections(collections));
  const nextNode: WorkspaceNode = {
    type: 'ramp',
    id: ramp.id,
    ramp: cloneRamp(ramp),
  };

  if (target.type === 'collection') {
    const collectionIndex = nextCollections.findIndex((collection) => collection.id === target.collectionId);
    if (collectionIndex < 0) {
      return collections;
    }

    const collection = nextCollections[collectionIndex];
    const insertIndex = clampIndex(target.index ?? collection.children.length, collection.children.length);
    collection.children.splice(insertIndex, 0, nextNode);
    return syncCollectionsGroupsFromChildren(nextCollections);
  }

  const groupLocation = findGroupLocationInTree(nextCollections, target.groupId);
  if (!groupLocation) {
    return collections;
  }

  const groupNode = nextCollections[groupLocation.collectionIndex].children[groupLocation.index];
  if (!groupNode || groupNode.type !== 'group') {
    return collections;
  }

  const insertIndex = clampIndex(target.index ?? groupNode.group.ramps.length, groupNode.group.ramps.length);
  groupNode.group.ramps.splice(insertIndex, 0, cloneRamp(ramp));
  return syncCollectionsGroupsFromChildren(nextCollections);
}

export function removeRampFromTree(collections: WorkspaceCollection[], rampId: string): WorkspaceCollection[] {
  const nextCollections = syncCollectionsChildrenFromGroups(cloneCollections(collections));

  for (const collection of nextCollections) {
    collection.children = collection.children.filter((node) => !(node.type === 'ramp' && node.ramp.id === rampId));

    for (const node of collection.children) {
      if (node.type === 'group') {
        node.group.ramps = node.group.ramps.filter((ramp) => ramp.id !== rampId);
      }
    }
  }

  return syncCollectionsGroupsFromChildren(nextCollections);
}

export function findRampInTree(collections: WorkspaceCollection[], rampId: string): WorkspaceRamp | null {
  const location = findRampLocationInTree(collections, rampId);
  return location ? location.ramp : null;
}

export function findCollectionIdForRampInTree(collections: WorkspaceCollection[], rampId: string): string | null {
  const parent = findParentForRampInTree(collections, rampId);
  return parent?.collectionId ?? null;
}

export function findParentForRampInTree(collections: WorkspaceCollection[], rampId: string): TreeRampParentInfo | null {
  const location = findRampLocationInTree(collections, rampId);
  if (!location) {
    return null;
  }

  return {
    collectionId: location.collectionId,
    parentType: location.parentType,
    parentId: location.parentId,
  };
}

export function moveRampInTree(
  collections: WorkspaceCollection[],
  sourceRampId: string,
  target: RampMoveTarget,
): WorkspaceCollection[] {
  const nextCollections = syncCollectionsChildrenFromGroups(cloneCollections(collections));
  const source = findRampLocationInTree(nextCollections, sourceRampId);
  if (!source) {
    return collections;
  }

  let movedRamp: WorkspaceRamp | undefined;

  if (source.parentType === 'collection') {
    const [removedNode] = nextCollections[source.collectionIndex].children.splice(source.index, 1);
    movedRamp = removedNode && removedNode.type === 'ramp' ? removedNode.ramp : undefined;
  } else {
    const groupNode = nextCollections[source.collectionIndex].children.find(
      (node): node is Extract<WorkspaceNode, { type: 'group' }> => node.type === 'group' && node.group.id === source.parentId,
    );
    if (!groupNode) {
      return collections;
    }

    [movedRamp] = groupNode.group.ramps.splice(source.index, 1);
  }

  if (!movedRamp) {
    return collections;
  }

  if (target.type === 'collection') {
    const targetCollectionIndex = nextCollections.findIndex((collection) => collection.id === target.collectionId);
    if (targetCollectionIndex < 0) {
      return collections;
    }

    const targetCollection = nextCollections[targetCollectionIndex];
    let insertIndex = clampIndex(target.index, targetCollection.children.length);

    if (source.parentType === 'collection' && source.collectionId === target.collectionId && source.index < insertIndex) {
      insertIndex -= 1;
    }

    if (source.parentType === 'collection' && source.collectionId === target.collectionId && source.index === insertIndex) {
      return collections;
    }

    targetCollection.children.splice(insertIndex, 0, {
      type: 'ramp',
      id: movedRamp.id,
      ramp: movedRamp,
    });
    return syncCollectionsGroupsFromChildren(nextCollections);
  }

  const targetGroupLocation = findGroupLocationInTree(nextCollections, target.groupId);
  if (!targetGroupLocation) {
    return collections;
  }

  const targetGroupNode = nextCollections[targetGroupLocation.collectionIndex].children[targetGroupLocation.index];
  if (!targetGroupNode || targetGroupNode.type !== 'group') {
    return collections;
  }

  let insertIndex = clampIndex(target.index, targetGroupNode.group.ramps.length);

  if (source.parentType === 'group' && source.parentId === target.groupId && source.index < insertIndex) {
    insertIndex -= 1;
  }

  if (source.parentType === 'group' && source.parentId === target.groupId && source.index === insertIndex) {
    return collections;
  }

  targetGroupNode.group.ramps.splice(insertIndex, 0, movedRamp);
  return syncCollectionsGroupsFromChildren(nextCollections);
}

export function moveGroupInTree(
  collections: WorkspaceCollection[],
  sourceGroupId: string,
  target: GroupMoveTarget,
): WorkspaceCollection[] {
  const nextCollections = syncCollectionsChildrenFromGroups(cloneCollections(collections));
  const source = findGroupLocationInTree(nextCollections, sourceGroupId);
  if (!source) {
    return collections;
  }

  const [removedNode] = nextCollections[source.collectionIndex].children.splice(source.index, 1);
  if (!removedNode || removedNode.type !== 'group') {
    return collections;
  }

  const targetCollectionIndex = nextCollections.findIndex((collection) => collection.id === target.collectionId);
  if (targetCollectionIndex < 0) {
    return collections;
  }

  const targetCollection = nextCollections[targetCollectionIndex];
  let insertIndex = clampIndex(target.index, targetCollection.children.length);

  if (source.collectionId === target.collectionId && source.index < insertIndex) {
    insertIndex -= 1;
  }

  if (source.collectionId === target.collectionId && source.index === insertIndex) {
    return collections;
  }

  targetCollection.children.splice(insertIndex, 0, removedNode);
  return syncCollectionsGroupsFromChildren(nextCollections);
}

function findRampLocationInTree(collections: WorkspaceCollection[], rampId: string): TreeRampLocation | null {
  for (let collectionIndex = 0; collectionIndex < collections.length; collectionIndex += 1) {
    const collection = collections[collectionIndex];

    for (let childIndex = 0; childIndex < collection.children.length; childIndex += 1) {
      const node = collection.children[childIndex];

      if (node.type === 'ramp' && node.ramp.id === rampId) {
        return {
          collectionId: collection.id,
          collectionIndex,
          parentType: 'collection',
          parentId: collection.id,
          index: childIndex,
          ramp: node.ramp,
        };
      }

      if (node.type === 'group') {
        const rampIndex = node.group.ramps.findIndex((ramp) => ramp.id === rampId);
        if (rampIndex >= 0) {
          return {
            collectionId: collection.id,
            collectionIndex,
            parentType: 'group',
            parentId: node.group.id,
            index: rampIndex,
            ramp: node.group.ramps[rampIndex],
          };
        }
      }
    }
  }

  return null;
}

function findGroupLocationInTree(collections: WorkspaceCollection[], groupId: string): TreeGroupLocation | null {
  for (let collectionIndex = 0; collectionIndex < collections.length; collectionIndex += 1) {
    const collection = collections[collectionIndex];
    const childIndex = collection.children.findIndex((node) => node.type === 'group' && node.group.id === groupId);
    if (childIndex >= 0) {
      const node = collection.children[childIndex];
      if (node.type === 'group') {
        return {
          collectionId: collection.id,
          collectionIndex,
          index: childIndex,
          group: node.group,
        };
      }
    }
  }

  return null;
}

function cloneCollections(collections: WorkspaceCollection[]): WorkspaceCollection[] {
  return collections.map((collection) => ({
    ...collection,
    groups: collection.groups.map(cloneGroup),
    children: (collection.children ?? []).map(cloneNode),
  }));
}

function cloneNode(node: WorkspaceNode): WorkspaceNode {
  return node.type === 'ramp'
    ? { type: 'ramp', id: node.id, ramp: cloneRamp(node.ramp) }
    : { type: 'group', id: node.id, group: cloneGroup(node.group) };
}

function cloneGroup(group: WorkspaceGroup): WorkspaceGroup {
  return {
    ...group,
    ramps: group.ramps.map(cloneRamp),
  };
}

function cloneRamp(ramp: WorkspaceRamp): WorkspaceRamp {
  return {
    ...ramp,
    config: {
      ...ramp.config,
      stops: [...ramp.config.stops],
      customStops: [...(ramp.config.customStops ?? [])],
      chromaPreset: { ...ramp.config.chromaPreset },
      huePreset: ramp.config.huePreset ? { ...ramp.config.huePreset } : undefined,
      anchor: ramp.config.anchor ? { ...ramp.config.anchor } : undefined,
    },
  };
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length));
}
