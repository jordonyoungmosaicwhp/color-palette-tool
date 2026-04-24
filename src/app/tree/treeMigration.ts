import type { WorkspaceCollection } from '../../features/ramp/workspaceTypes';

export function migrateCollectionToTree(collection: WorkspaceCollection): WorkspaceCollection {
  const groups = collection.groups ?? [];

  return {
    ...collection,
    groups,
    children:
      collection.children ??
      groups.map((group) => ({
        type: 'group' as const,
        id: group.id,
        group,
      })),
  };
}
