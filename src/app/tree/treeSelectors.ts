import type { TreeCollection, WorkspaceNode } from './treeTypes';

export function getAllRamps(collection: TreeCollection) {
  const ramps = [];

  for (const node of collection.children) {
    if (node.type === 'ramp') {
      ramps.push(node.ramp);
    }

    if (node.type === 'group') {
      ramps.push(...node.group.ramps);
    }
  }

  return ramps;
}

export function findNodeById(collection: TreeCollection, nodeId: string) {
  for (const node of collection.children) {
    if (node.id === nodeId) return node;

    if (node.type === 'group') {
      for (const ramp of node.group.ramps) {
        if (ramp.id === nodeId) {
          return {
            type: 'ramp' as const,
            id: ramp.id,
            ramp,
          };
        }
      }
    }
  }

  return null;
}

export function findRampById(collection: TreeCollection, rampId: string) {
  for (const node of collection.children) {
    if (node.type === 'ramp' && node.ramp.id === rampId) {
      return node.ramp;
    }

    if (node.type === 'group') {
      const found = node.group.ramps.find((r) => r.id === rampId);
      if (found) return found;
    }
  }

  return null;
}

export function getParentInfo(collection: TreeCollection, rampId: string) {
  for (const node of collection.children) {
    if (node.type === 'ramp' && node.ramp.id === rampId) {
      return { parentType: 'collection' as const, parentId: collection.id };
    }

    if (node.type === 'group') {
      if (node.group.ramps.some((r) => r.id === rampId)) {
        return { parentType: 'group' as const, parentId: node.group.id };
      }
    }
  }

  return null;
}

export function getCollectionNodes(collection: TreeCollection): WorkspaceNode[] {
  return collection.children;
}
