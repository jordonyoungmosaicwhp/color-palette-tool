import { createSeededRampConfig } from '../../lib/color';
import type { RampConfig } from '../../lib/color';
import type { WorkspaceCollection, WorkspaceRamp } from '../../features/ramp/workspaceTypes';
import type { WorkspaceNode } from '../tree/treeTypes';
import { findRampInTree } from '../tree/treeActions';

export function addRamp(collections: WorkspaceCollection[], rampId: string, name: string): WorkspaceCollection[] {
  const newRamp = createWorkspaceRamp(rampId, name, '#2563eb', 0.04, 0.16);
  const nextCollections = cloneCollections(collections);

  if (!nextCollections.length) {
    return nextCollections;
  }

  nextCollections[0].children = [...nextCollections[0].children, { type: 'ramp', id: newRamp.id, ramp: newRamp }];
  return nextCollections;
}

export function deleteRamp(collections: WorkspaceCollection[], rampId: string): WorkspaceCollection[] {
  return collections.map((collection) => ({
    ...collection,
    children: collection.children.filter((node) => removeRampNode(node, rampId)),
  }));
}

export function duplicateRamp(
  collections: WorkspaceCollection[],
  rampId: string,
  duplicateRampId: string,
): { collections: WorkspaceCollection[]; duplicateRamp?: WorkspaceRamp } {
  const sourceRamp = findRampInTree(collections, rampId);
  if (!sourceRamp) {
    return { collections };
  }

  const nextDuplicate: WorkspaceRamp = {
    ...sourceRamp,
    id: duplicateRampId,
    name: `${sourceRamp.name} Copy`,
    config: {
      ...sourceRamp.config,
      name: `${sourceRamp.name} Copy`,
      stops: [...sourceRamp.config.stops],
      customStops: [...(sourceRamp.config.customStops ?? [])],
      chromaPreset: { ...sourceRamp.config.chromaPreset },
      huePreset: sourceRamp.config.huePreset ? { ...sourceRamp.config.huePreset } : undefined,
    },
  };

  return {
    collections: collections.map((collection) => ({
      ...collection,
      children: duplicateRampInCollection(collection.children, sourceRamp.id, nextDuplicate),
    })),
    duplicateRamp: nextDuplicate,
  };
}

export function renameRamp(collections: WorkspaceCollection[], rampId: string, name: string): WorkspaceCollection[] {
  return collections.map((collection) => ({
    ...collection,
    children: collection.children.map((node) => renameRampNode(node, rampId, name)),
  }));
}

export function updateRampConfig(
  collections: WorkspaceCollection[],
  rampId: string,
  updater: (ramp: RampConfig) => RampConfig,
): WorkspaceCollection[] {
  return collections.map((collection) => ({
    ...collection,
    children: collection.children.map((node) => updateRampConfigNode(node, rampId, updater)),
  }));
}

function duplicateRampInCollection(children: WorkspaceNode[], rampId: string, duplicateRampValue: WorkspaceRamp): WorkspaceNode[] {
  const nextChildren: WorkspaceNode[] = [];

  for (const node of children) {
    nextChildren.push(cloneNode(node));

    if (node.type === 'ramp' && node.ramp.id === rampId) {
      nextChildren.push({
        type: 'ramp',
        id: duplicateRampValue.id,
        ramp: duplicateRampValue,
      });
      continue;
    }

    if (node.type === 'group') {
      const rampIndex = node.group.ramps.findIndex((item) => item.id === rampId);
      if (rampIndex >= 0) {
        nextChildren[nextChildren.length - 1] = {
          type: 'group',
          id: node.id,
          group: {
            ...node.group,
            ramps: [...node.group.ramps, duplicateRampValue],
          },
        };
      }
    }
  }

  return nextChildren;
}

function removeRampNode(node: WorkspaceNode, rampId: string): boolean {
  if (node.type === 'ramp') {
    return node.ramp.id !== rampId;
  }

  return node.group.ramps.every((ramp) => ramp.id !== rampId);
}

function renameRampNode(node: WorkspaceNode, rampId: string, name: string): WorkspaceNode {
  if (node.type === 'ramp' && node.ramp.id === rampId) {
    return {
      ...node,
      ramp: {
        ...node.ramp,
        name,
        config: { ...node.ramp.config, name },
      },
    };
  }

  if (node.type === 'group') {
    return {
      ...node,
      group: {
        ...node.group,
        ramps: node.group.ramps.map((ramp) =>
          ramp.id === rampId ? { ...ramp, name, config: { ...ramp.config, name } } : ramp,
        ),
      },
    };
  }

  return node;
}

function updateRampConfigNode(
  node: WorkspaceNode,
  rampId: string,
  updater: (ramp: RampConfig) => RampConfig,
): WorkspaceNode {
  if (node.type === 'ramp' && node.ramp.id === rampId) {
    return {
      ...node,
      ramp: {
        ...node.ramp,
        config: updater(node.ramp.config),
      },
    };
  }

  if (node.type === 'group') {
    return {
      ...node,
      group: {
        ...node.group,
        ramps: node.group.ramps.map((ramp) => (ramp.id === rampId ? { ...ramp, config: updater(ramp.config) } : ramp)),
      },
    };
  }

  return node;
}

function cloneCollections(collections: WorkspaceCollection[]): WorkspaceCollection[] {
  return collections.map((collection) => ({
    ...collection,
    children: collection.children.map(cloneNode),
  }));
}

function cloneNode(node: WorkspaceNode): WorkspaceNode {
  return node.type === 'ramp'
    ? { type: 'ramp', id: node.id, ramp: cloneRamp(node.ramp) }
    : {
        type: 'group',
        id: node.id,
        group: {
          ...node.group,
          ramps: node.group.ramps.map(cloneRamp),
        },
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

function createWorkspaceRamp(id: string, name: string, color: string, chromaStart: number, chromaEnd: number): WorkspaceRamp {
  return {
    id,
    name,
    config: createSeededRampConfig(name, color, chromaStart, chromaEnd),
  };
}
