import type { WorkspaceCollection } from '../../features/ramp/workspaceTypes';

export function migrateCollectionToTree(collection: WorkspaceCollection): WorkspaceCollection {
  return {
    ...collection,
    children: collection.children ?? [],
  };
}
