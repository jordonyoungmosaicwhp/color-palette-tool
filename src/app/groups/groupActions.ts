import type { WorkspaceCollection } from '../../features/ramp/workspaceTypes';
import type { WorkspaceNode } from '../tree/treeTypes';

export function addGroup(
  collections: WorkspaceCollection[],
  activeCollectionId: string,
  groupId: string,
): WorkspaceCollection[] {
  return collections.map((collection) =>
    collection.id === activeCollectionId
      ? {
          ...collection,
          children: [
            ...collection.children,
            {
              type: 'group',
              id: groupId,
              group: {
                id: groupId,
                name: `New Group ${countGroups(collection.children) + 1}`,
                ramps: [],
              },
            },
          ],
        }
      : collection,
  );
}

export function deleteGroup(collections: WorkspaceCollection[], groupId: string): WorkspaceCollection[] {
  return collections.map((collection) => ({
    ...collection,
    children: collection.children.filter((node) => !(node.type === 'group' && node.group.id === groupId)),
  }));
}

export function renameGroup(
  collections: WorkspaceCollection[],
  groupId: string,
  name: string,
): WorkspaceCollection[] {
  return collections.map((collection) => ({
    ...collection,
    children: collection.children.map((node) =>
      node.type === 'group' && node.group.id === groupId ? { ...node, group: { ...node.group, name } } : node,
    ),
  }));
}

function countGroups(children: WorkspaceNode[]): number {
  return children.filter((node) => node.type === 'group').length;
}
