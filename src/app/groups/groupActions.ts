import type { WorkspaceCollection } from '../../features/ramp/workspaceTypes';

export function addGroup(
  collections: WorkspaceCollection[],
  activeCollectionId: string,
  groupId: string,
): WorkspaceCollection[] {
  return collections.map((collection) =>
    collection.id === activeCollectionId
      ? {
          ...collection,
          groups: [
            ...collection.groups,
            {
              id: groupId,
              name: `New Group ${collection.groups.length + 1}`,
              ramps: [],
            },
          ],
        }
      : collection,
  );
}

export function deleteGroup(collections: WorkspaceCollection[], groupId: string): WorkspaceCollection[] {
  return collections.map((collection) => ({
    ...collection,
    groups: collection.groups.filter((group) => group.id !== groupId),
  }));
}

export function renameGroup(
  collections: WorkspaceCollection[],
  groupId: string,
  name: string,
): WorkspaceCollection[] {
  return collections.map((collection) => ({
    ...collection,
    groups: collection.groups.map((group) => (group.id === groupId ? { ...group, name } : group)),
  }));
}
