import { describe, expect, it } from 'vitest';
import { createSeededRampConfig } from '../src/lib/color';
import {
  addRampToTree,
  findCollectionIdForRampInTree,
  findParentForRampInTree,
  findRampInTree,
  moveGroupInTree,
  moveRampInTree,
  removeRampFromTree,
  syncCollectionChildrenFromGroups,
  syncCollectionGroupsFromChildren,
} from '../src/app/tree/treeActions';
import type { WorkspaceCollection, WorkspaceRamp } from '../src/features/ramp/workspaceTypes';

function createRamp(id: string, name: string, color: string): WorkspaceRamp {
  return {
    id,
    name,
    config: createSeededRampConfig(name, color, 0.04, 0.16),
  };
}

function createCollections(): WorkspaceCollection[] {
  const rootRamp = createRamp('root-ramp', 'Root Ramp', '#9333ea');
  const brandRamp = createRamp('brand-ramp', 'Brand Ramp', '#dc2626');
  const utilityRamp = createRamp('utility-ramp', 'Utility Ramp', '#2563eb');

  return [
    {
      id: 'collection-a',
      name: 'Collection A',
      groups: [
        { id: 'brand', name: 'Brand', ramps: [brandRamp] },
        { id: 'utility', name: 'Utility', ramps: [utilityRamp] },
      ],
      children: [
        { type: 'ramp', id: rootRamp.id, ramp: rootRamp },
        { type: 'group', id: 'stale-brand', group: { id: 'stale-brand', name: 'Old Brand', ramps: [] } },
      ],
    },
    {
      id: 'collection-b',
      name: 'Collection B',
      groups: [{ id: 'support', name: 'Support', ramps: [] }],
      children: [],
    },
  ];
}

describe('tree actions', () => {
  it('sync preserves direct ramps while rebuilding group nodes from groups', () => {
    const [collection] = createCollections();

    const synced = syncCollectionChildrenFromGroups(collection);

    expect(synced.children.map((node) => node.id)).toEqual(['root-ramp', 'brand', 'utility']);
    expect(synced.children[0].type).toBe('ramp');
    expect(synced.children[1].type).toBe('group');
    expect(synced.children[2].type).toBe('group');
  });

  it('adds a ramp directly under a collection without touching groups', () => {
    const collections = createCollections();
    const directRamp = createRamp('direct-ramp', 'Direct Ramp', '#16a34a');

    const nextCollections = addRampToTree(collections, { type: 'collection', collectionId: 'collection-a' }, directRamp);
    const targetCollection = nextCollections[0];

    expect(targetCollection.groups[0].ramps.map((ramp) => ramp.id)).toEqual(['brand-ramp']);
    expect(targetCollection.children.filter((node) => node.type === 'ramp').map((node) => node.id)).toEqual([
      'root-ramp',
      'direct-ramp',
    ]);
  });

  it('adds a ramp to a group and syncs children from groups', () => {
    const collections = createCollections();
    const groupRamp = createRamp('group-ramp', 'Group Ramp', '#f59e0b');

    const nextCollections = addRampToTree(collections, { type: 'group', groupId: 'support' }, groupRamp);
    const targetCollection = nextCollections[1];

    expect(targetCollection.groups[0].ramps.map((ramp) => ramp.id)).toEqual(['group-ramp']);
    expect(targetCollection.children).toEqual([
      {
        type: 'group',
        id: 'support',
        group: targetCollection.groups[0],
      },
    ]);
  });

  it('removes a ramp from both collection-root and group contexts', () => {
    const collections = createCollections();

    const withoutRootRamp = removeRampFromTree(collections, 'root-ramp');
    expect(withoutRootRamp[0].children.some((node) => node.type === 'ramp' && node.id === 'root-ramp')).toBe(false);

    const withoutGroupedRamp = removeRampFromTree(collections, 'brand-ramp');
    expect(withoutGroupedRamp[0].groups[0].ramps).toEqual([]);
    expect(withoutGroupedRamp[0].children.some((node) => node.type === 'group' && node.id === 'brand')).toBe(true);
  });

  it('find helpers work for direct ramps and grouped ramps', () => {
    const collections = createCollections().map(syncCollectionChildrenFromGroups);

    expect(findRampInTree(collections, 'root-ramp')?.id).toBe('root-ramp');
    expect(findRampInTree(collections, 'utility-ramp')?.id).toBe('utility-ramp');
    expect(findCollectionIdForRampInTree(collections, 'utility-ramp')).toBe('collection-a');
    expect(findParentForRampInTree(collections, 'root-ramp')).toEqual({
      collectionId: 'collection-a',
      parentType: 'collection',
      parentId: 'collection-a',
    });
    expect(findParentForRampInTree(collections, 'utility-ramp')).toEqual({
      collectionId: 'collection-a',
      parentType: 'group',
      parentId: 'utility',
    });
  });

  it('moves ramps between group and collection-root contexts', () => {
    const collections = createCollections().map(syncCollectionChildrenFromGroups);

    const groupToCollection = moveRampInTree(collections, 'brand-ramp', {
      type: 'collection',
      collectionId: 'collection-b',
      index: 0,
    });
    expect(groupToCollection[0].groups[0].ramps).toEqual([]);
    expect(groupToCollection[1].children.some((node) => node.type === 'ramp' && node.id === 'brand-ramp')).toBe(true);

    const collectionToGroup = moveRampInTree(groupToCollection, 'root-ramp', {
      type: 'group',
      groupId: 'support',
      index: 0,
    });
    expect(collectionToGroup[0].children.some((node) => node.type === 'ramp' && node.id === 'root-ramp')).toBe(false);
    expect(collectionToGroup[1].groups[0].ramps.map((ramp) => ramp.id)).toContain('root-ramp');

    const groupToGroup = moveRampInTree(collectionToGroup, 'utility-ramp', {
      type: 'group',
      groupId: 'support',
      index: 1,
    });
    expect(groupToGroup[0].groups[1].ramps).toEqual([]);
    expect(groupToGroup[1].groups[0].ramps.map((ramp) => ramp.id)).toContain('utility-ramp');
  });

  it('reorders root ramps within a collection', () => {
    const collections = addRampToTree(createCollections().map(syncCollectionChildrenFromGroups), { type: 'collection', collectionId: 'collection-a' }, createRamp('root-ramp-2', 'Root Ramp 2', '#0f766e'));

    const reordered = moveRampInTree(collections, 'root-ramp-2', {
      type: 'collection',
      collectionId: 'collection-a',
      index: 0,
    });

    expect(
      reordered[0].children.filter((node) => node.type === 'ramp').map((node) => node.ramp.id),
    ).toEqual(['root-ramp-2', 'root-ramp']);
  });

  it('reorders ramps within the same group', () => {
    const collections = addRampToTree(
      addRampToTree(createCollections().map(syncCollectionChildrenFromGroups), { type: 'group', groupId: 'utility' }, createRamp('yellow-ramp', 'Yellow Ramp', '#facc15')),
      { type: 'group', groupId: 'utility' },
      createRamp('orange-ramp', 'Orange Ramp', '#f97316'),
    );

    const reordered = moveRampInTree(collections, 'yellow-ramp', {
      type: 'group',
      groupId: 'utility',
      index: 0,
    });

    expect(reordered[0].groups[1].ramps.map((ramp) => ramp.id)).toEqual([
      'yellow-ramp',
      'utility-ramp',
      'orange-ramp',
    ]);
    const utilityNode = reordered[0].children.find(
      (node): node is Extract<(typeof reordered)[0]['children'][number], { type: 'group' }> =>
        node.type === 'group' && node.id === 'utility',
    );
    expect(utilityNode?.group.ramps.map((ramp) => ramp.id)).toEqual(['yellow-ramp', 'utility-ramp', 'orange-ramp']);
  });

  it('moves groups within and between collections using child order', () => {
    const collections = addRampToTree(createCollections().map(syncCollectionChildrenFromGroups), { type: 'collection', collectionId: 'collection-a' }, createRamp('root-ramp-2', 'Root Ramp 2', '#0f766e'));

    const withinCollection = moveGroupInTree(collections, 'utility', {
      type: 'collection',
      collectionId: 'collection-a',
      index: 0,
    });
    expect(withinCollection[0].children.filter((node) => node.type === 'group').map((node) => node.group.id)).toEqual(['utility', 'brand']);

    const acrossCollections = moveGroupInTree(withinCollection, 'brand', {
      type: 'collection',
      collectionId: 'collection-b',
      index: 1,
    });
    expect(acrossCollections[0].groups.map((group) => group.id)).toEqual(['utility']);
    expect(acrossCollections[1].groups.map((group) => group.id)).toEqual(['support', 'brand']);
  });

  it('syncs legacy groups from children while preserving direct root ramps', () => {
    const collections = addRampToTree(createCollections().map(syncCollectionChildrenFromGroups), { type: 'collection', collectionId: 'collection-a' }, createRamp('direct-ramp', 'Direct Ramp', '#16a34a'));
    const collection = syncCollectionGroupsFromChildren(collections[0]);

    expect(collection.groups.map((group) => group.id)).toEqual(['brand', 'utility']);
    expect(collection.children.filter((node) => node.type === 'ramp').map((node) => node.id)).toEqual(['root-ramp', 'direct-ramp']);
  });
});
