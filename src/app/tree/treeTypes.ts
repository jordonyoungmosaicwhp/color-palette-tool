import type { WorkspaceCollection, WorkspaceGroup, WorkspaceRamp } from '../../features/ramp/workspaceTypes';

export type WorkspaceNode =
  | {
      type: 'ramp';
      id: string;
      ramp: WorkspaceRamp;
    }
  | {
      type: 'group';
      id: string;
      group: WorkspaceGroup;
    };

export interface TreeCollection {
  id: string;
  name: string;
  children: WorkspaceNode[];
}

export function collectionToTree(collection: WorkspaceCollection): TreeCollection {
  return {
    id: collection.id,
    name: collection.name,
    children: collection.children ?? [],
  };
}

export function isRampNode(node: WorkspaceNode): node is Extract<WorkspaceNode, { type: 'ramp' }> {
  return node.type === 'ramp';
}

export function isGroupNode(node: WorkspaceNode): node is Extract<WorkspaceNode, { type: 'group' }> {
  return node.type === 'group';
}
