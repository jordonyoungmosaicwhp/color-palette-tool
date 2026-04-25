import { ChevronDown, ChevronRight, CirclePlus, File, Palette, SquareDashed } from 'lucide-react';
import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Button } from '../../../design-system';
import type { WorkspaceCollection } from '../workspaceTypes';
import styles from './PaletteSidebar.module.scss';

interface PaletteSidebarProps {
  collections: WorkspaceCollection[];
  activeCollectionId: string;
  expandedCollectionIds: string[];
  selectedRampId: string;
  onAddCollection: () => void;
  onSelectCollection: (collectionId: string) => void;
  onToggleCollection: (collectionId: string) => void;
  onSelectRamp: (rampId: string) => void;
  onMoveCollection: (sourceCollectionId: string, targetIndex: number) => void;
  onMoveGroup: (sourceGroupId: string, targetCollectionId: string, targetIndex: number) => void;
  onMoveRamp: (
    sourceRampId: string,
    target: { type: 'collection'; collectionId: string; index: number } | { type: 'group'; groupId: string; index: number },
  ) => void;
  collapsed?: boolean;
}

type DragItem =
  | { type: 'collection'; collectionId: string }
  | { type: 'group'; collectionId: string; groupId: string }
  | { type: 'ramp'; collectionId: string; rampId: string; groupId?: string };

type DropTarget =
  | { type: 'collection'; collectionId: string; index: number; edge: 'before' | 'after' }
  | { type: 'group'; collectionId: string; groupId?: string; index: number; edge: 'before' | 'after' | 'into' }
  | {
      type: 'ramp';
      collectionId: string;
      groupId?: string;
      rampId?: string;
      index: number;
      edge: 'before' | 'after' | 'into';
    };

export function PaletteSidebar({
  collections,
  activeCollectionId,
  expandedCollectionIds,
  selectedRampId,
  onAddCollection,
  onSelectCollection,
  onToggleCollection,
  onSelectRamp,
  onMoveCollection,
  onMoveGroup,
  onMoveRamp,
  collapsed = false,
}: PaletteSidebarProps) {
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const draggedItemRef = useRef<DragItem | null>(null);
  const expandedCollectionSet = new Set(expandedCollectionIds);

  function startDrag(item: DragItem, event: DragEvent<HTMLElement>) {
    if (collapsed) return;
    draggedItemRef.current = item;
    setDraggedItem(item);
    setDropTarget(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify(item));
  }

  function endDrag() {
    draggedItemRef.current = null;
    setDraggedItem(null);
    setDropTarget(null);
  }

  function getDraggedItem() {
    return draggedItemRef.current ?? draggedItem;
  }

  function moveDraggedItem(target: DropTarget) {
    const activeDraggedItem = getDraggedItem();
    if (!activeDraggedItem) return;

    if (activeDraggedItem.type === 'collection' && target.type === 'collection') {
      onMoveCollection(activeDraggedItem.collectionId, target.index);
    }

    if (activeDraggedItem.type === 'group' && (target.type === 'group' || target.type === 'collection')) {
      onMoveGroup(activeDraggedItem.groupId, target.collectionId, target.index);
    }

    if (activeDraggedItem.type === 'ramp') {
      if (target.type === 'ramp') {
        onMoveRamp(
          activeDraggedItem.rampId,
          target.groupId
            ? { type: 'group', groupId: target.groupId, index: target.index }
            : { type: 'collection', collectionId: target.collectionId, index: target.index },
        );
      } else if (target.type === 'collection') {
        onMoveRamp(activeDraggedItem.rampId, { type: 'collection', collectionId: target.collectionId, index: target.index });
      } else if (target.type === 'group') {
        onMoveRamp(activeDraggedItem.rampId, { type: 'group', groupId: target.groupId!, index: target.index });
      }
    }

    endDrag();
  }

  function updateDropTarget(target: DropTarget) {
    const activeDraggedItem = getDraggedItem();
    if (!activeDraggedItem || activeDraggedItem.type !== target.type) return;
    setDropTarget((current) => {
      if (!current || current.type !== target.type) return target;

      if (
        current.collectionId === target.collectionId &&
        current.index === target.index &&
        current.edge === target.edge &&
        ('groupId' in current ? current.groupId : undefined) === ('groupId' in target ? target.groupId : undefined) &&
        ('rampId' in current ? current.rampId : undefined) === ('rampId' in target ? target.rampId : undefined)
      ) {
        return current;
      }

      return target;
    });
  }

  function getRampRowDropTarget(
    event: DragEvent<HTMLElement>,
    collectionId: string,
    index: number,
    rampId?: string,
    groupId?: string,
  ): DropTarget {
    const bounds = event.currentTarget.getBoundingClientRect();
    const edge = event.clientY - bounds.top > bounds.height / 2 ? 'after' : 'before';
    return {
      type: 'ramp',
      collectionId,
      groupId,
      rampId,
      index: edge === 'after' ? index + 1 : index,
      edge,
    };
  }

  function getRampContainerDropTarget(collectionId: string, index: number, groupId?: string): DropTarget {
    return {
      type: 'ramp',
      collectionId,
      groupId,
      index,
      edge: 'into',
    };
  }

  function getCollectionChildren(collection: WorkspaceCollection) {
    return collection.children ?? [];
  }

  function getFirstRampId(collection: WorkspaceCollection): string | undefined {
    for (const node of getCollectionChildren(collection)) {
      if (node.type === 'ramp') return node.ramp.id;
      if (node.type === 'group' && node.group.ramps[0]) return node.group.ramps[0].id;
    }

    return undefined;
  }

  function getCollectionDropTarget(collection: WorkspaceCollection, index: number): DropTarget | null {
    const activeDraggedItem = getDraggedItem();
    if (!activeDraggedItem) return null;

    const edge = index <= 0 ? 'before' : index >= getCollectionChildren(collection).length ? 'after' : 'into';

    if (activeDraggedItem.type === 'collection') {
      return {
        type: 'collection',
        collectionId: collection.id,
        index,
        edge: index <= 0 ? 'before' : 'after',
      };
    }

    if (activeDraggedItem.type === 'group') {
      return {
        type: 'group',
        collectionId: collection.id,
        index,
        edge,
      };
    }

    if (activeDraggedItem.type === 'ramp') {
      return {
        type: 'ramp',
        collectionId: collection.id,
        index,
        edge,
      };
    }

    return null;
  }

  function getGroupDropTarget(collectionId: string, groupId: string, index: number, length: number): DropTarget | null {
    if (getDraggedItem()?.type !== 'ramp') return null;
    return {
      type: 'ramp',
      collectionId,
      groupId,
      index,
      edge: index <= 0 ? 'before' : index >= length ? 'after' : 'into',
    };
  }

  return (
    <aside className={styles.sidebar} data-collapsed={collapsed ? '' : undefined}>
      {!collapsed ? (
        <div className={styles.sidebarHeader}>
          <h2>Collections</h2>
        </div>
      ) : null}

      <nav className={styles.collectionNav} aria-label="Collections">
        <div
          className={styles.sidebarDropZone}
          data-dropzone-scope="collections"
          data-dropzone-position="start"
          data-drop-visible={
            dropTarget?.type === 'collection' && collections[0] && dropTarget.collectionId === collections[0].id && dropTarget.index === 0
              ? ''
              : undefined
          }
          onDragOver={(event) => {
            if (getDraggedItem()?.type !== 'collection') return;
            event.preventDefault();
            updateDropTarget({
              type: 'collection',
              collectionId: collections[0]?.id ?? '',
              index: 0,
              edge: 'before',
            });
          }}
          onDrop={(event) => {
            if (getDraggedItem()?.type !== 'collection' || !collections[0]) return;
            event.preventDefault();
            moveDraggedItem({
              type: 'collection',
              collectionId: collections[0].id,
              index: 0,
              edge: 'before',
            });
          }}
        />
        {collections.map((collection, collectionIndex) => {
          const isExpanded = expandedCollectionSet.has(collection.id);
          const isActive = collection.id === activeCollectionId;
          const isDraggingCollection = draggedItem?.type === 'collection' && draggedItem.collectionId === collection.id;
          const showCollectionBefore =
            dropTarget?.type === 'collection' && dropTarget.collectionId === collection.id && dropTarget.edge === 'before';
          const showCollectionAfter =
            dropTarget?.type === 'collection' && dropTarget.collectionId === collection.id && dropTarget.edge === 'after';

          return (
            <div key={collection.id} className={styles.sidebarCollection}>
              <button
                type="button"
                className={styles.sidebarTreeRow}
                data-tree-row="collection"
                data-collection-row={collection.id}
                data-collection-select={collection.id}
                data-active={isActive ? '' : undefined}
                data-dragging={isDraggingCollection ? '' : undefined}
                data-drop-before={showCollectionBefore ? '' : undefined}
                data-drop-after={showCollectionAfter ? '' : undefined}
                aria-expanded={isExpanded}
                draggable={!collapsed}
                onDragStart={(event) => startDrag({ type: 'collection', collectionId: collection.id }, event)}
                onDragEnd={endDrag}
                onDragOver={(event) => {
                  if (!getDraggedItem()) return;
                  event.preventDefault();
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const edge = event.clientY - bounds.top > bounds.height / 2 ? 'after' : 'before';
                  const target = getCollectionDropTarget(collection, edge === 'after' ? collectionIndex + 1 : collectionIndex);
                  if (target) updateDropTarget(target);
                }}
                onDrop={(event) => {
                  if (!getDraggedItem() || !dropTarget) return;
                  event.preventDefault();
                  moveDraggedItem(dropTarget);
                }}
                onClick={() => {
                  const willExpand = !isExpanded;
                  onToggleCollection(collection.id);
                  if (!willExpand) {
                    if (!isActive) onSelectCollection(collection.id);
                    return;
                  }

                  const firstRampId = getFirstRampId(collection);
                  if (firstRampId) {
                    onSelectRamp(firstRampId);
                    return;
                  }

                  onSelectCollection(collection.id);
                }}
              >
                <span className={styles.sidebarDisclosure} aria-hidden="true">
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                <span className={styles.sidebarRowIcon} aria-hidden="true">
                  <File size={15} />
                </span>
                <span className={styles.sidebarLabelText}>{collection.name}</span>
              </button>

              {isExpanded ? (
                <div
                  className={styles.sidebarBranch}
                  data-collection-dropzone={collection.id}
                  data-drop-target={
                    (dropTarget?.collectionId === collection.id && dropTarget.edge === 'into')
                      ? ''
                      : undefined
                  }
                  onDragOver={(event) => {
                    const activeDraggedItem = getDraggedItem();
                    if (!activeDraggedItem) return;
                    event.preventDefault();
                    if (activeDraggedItem.type === 'collection') {
                      updateDropTarget({
                        type: 'collection',
                        collectionId: collection.id,
                        index: getCollectionChildren(collection).length,
                        edge: 'after',
                      });
                      return;
                    }

                    const target = getCollectionDropTarget(collection, getCollectionChildren(collection).length);
                    if (target) updateDropTarget(target);
                  }}
                  onDrop={(event) => {
                    const activeDraggedItem = getDraggedItem();
                    if (!activeDraggedItem) return;
                    event.preventDefault();
                    if (activeDraggedItem.type === 'collection') {
                      moveDraggedItem({
                        type: 'collection',
                        collectionId: collection.id,
                        index: getCollectionChildren(collection).length,
                        edge: 'after',
                      });
                      return;
                    }

                    const target = getCollectionDropTarget(collection, getCollectionChildren(collection).length);
                    if (target) moveDraggedItem(target);
                  }}
                >
                  <div
                    className={styles.sidebarDropZone}
                    data-dropzone-scope="collection"
                    data-dropzone-id={collection.id}
                    data-dropzone-position="start"
                    data-drop-visible={dropTarget?.collectionId === collection.id && dropTarget.index === 0 ? '' : undefined}
                    onDragOver={(event) => {
                      const activeDraggedItem = getDraggedItem();
                      if (!activeDraggedItem) return;
                      event.preventDefault();
                      event.stopPropagation();
                      if (activeDraggedItem.type === 'collection') {
                        updateDropTarget({
                          type: 'collection',
                          collectionId: collection.id,
                          index: 0,
                          edge: 'before',
                        });
                        return;
                      }

                      const target = getCollectionDropTarget(collection, 0);
                      if (!target) return;
                      updateDropTarget(target);
                    }}
                    onDrop={(event) => {
                      const activeDraggedItem = getDraggedItem();
                      if (!activeDraggedItem) return;
                      event.preventDefault();
                      event.stopPropagation();
                      if (activeDraggedItem.type === 'collection') {
                        moveDraggedItem({
                          type: 'collection',
                          collectionId: collection.id,
                          index: 0,
                          edge: 'before',
                        });
                        return;
                      }

                      const target = getCollectionDropTarget(collection, 0);
                      if (!target) return;
                      moveDraggedItem(target);
                    }}
                  />
                  {getCollectionChildren(collection).length > 0 ? (
                    getCollectionChildren(collection).map((node, nodeIndex) => {
                      if (node.type === 'ramp') {
                        const ramp = node.ramp;
                        const isSelected = ramp.id === selectedRampId;
                        const isDraggingRamp = draggedItem?.type === 'ramp' && draggedItem.rampId === ramp.id;
                        const showRampBefore =
                          dropTarget?.type === 'ramp' && dropTarget.rampId === ramp.id && dropTarget.edge === 'before';
                        const showRampAfter =
                          dropTarget?.type === 'ramp' && dropTarget.rampId === ramp.id && dropTarget.edge === 'after';

                        return (
                          <button
                            key={ramp.id}
                            type="button"
                            className={styles.sidebarTreeRow}
                            data-tree-row="ramp"
                            data-ramp-depth="root"
                            data-ramp-id={ramp.id}
                            data-ramp-select={ramp.id}
                            data-selected={isSelected ? '' : undefined}
                            data-dragging={isDraggingRamp ? '' : undefined}
                            data-drop-before={showRampBefore ? '' : undefined}
                            data-drop-after={showRampAfter ? '' : undefined}
                            aria-current={isSelected ? 'true' : undefined}
                            draggable={!collapsed}
                            onDragStart={(event) => startDrag({ type: 'ramp', collectionId: collection.id, rampId: ramp.id }, event)}
                            onDragEnd={endDrag}
                            onDragOver={(event) => {
                              if (getDraggedItem()?.type !== 'ramp') return;
                              event.preventDefault();
                              event.stopPropagation();
                              updateDropTarget(getRampRowDropTarget(event, collection.id, nodeIndex, ramp.id));
                            }}
                            onDrop={(event) => {
                              if (getDraggedItem()?.type !== 'ramp') return;
                              event.preventDefault();
                              event.stopPropagation();
                              moveDraggedItem(getRampRowDropTarget(event, collection.id, nodeIndex, ramp.id));
                            }}
                            onClick={() => onSelectRamp(ramp.id)}
                          >
                            <span className={styles.sidebarRowIcon} aria-hidden="true">
                              <Palette size={15} />
                            </span>
                            <span className={styles.sidebarLabelText}>{ramp.name}</span>
                          </button>
                        );
                      }

                      const group = node.group;
                      const isDraggingGroup = draggedItem?.type === 'group' && draggedItem.groupId === group.id;
                      const showGroupBefore =
                        dropTarget?.type === 'group' && dropTarget.groupId === group.id && dropTarget.edge === 'before';
                      const showGroupAfter =
                        dropTarget?.type === 'group' && dropTarget.groupId === group.id && dropTarget.edge === 'after';
                      const firstRampInGroup = group.ramps[0];

                      return (
                        <div key={group.id} className={styles.sidebarTreeNode}>
                          <div
                            className={styles.sidebarDropZone}
                            data-dropzone-scope="group"
                            data-dropzone-id={group.id}
                            data-dropzone-position="before"
                            data-drop-visible={showGroupBefore ? '' : undefined}
                            onDragOver={(event) => {
                              if (getDraggedItem()?.type !== 'group') return;
                              event.preventDefault();
                              event.stopPropagation();
                              updateDropTarget({
                                type: 'group',
                                collectionId: collection.id,
                                groupId: group.id,
                                index: nodeIndex,
                                edge: 'before',
                              });
                            }}
                            onDrop={(event) => {
                              if (getDraggedItem()?.type !== 'group') return;
                              event.preventDefault();
                              event.stopPropagation();
                              moveDraggedItem({
                                type: 'group',
                                collectionId: collection.id,
                                groupId: group.id,
                                index: nodeIndex,
                                edge: 'before',
                              });
                            }}
                          />
                          <button
                            type="button"
                            className={styles.sidebarTreeRow}
                            data-tree-row="group"
                            data-group-row={group.id}
                            data-dragging={isDraggingGroup ? '' : undefined}
                            draggable={!collapsed}
                            onDragStart={(event) => startDrag({ type: 'group', collectionId: collection.id, groupId: group.id }, event)}
                            onDragEnd={endDrag}
                            onClick={() => {
                              if (firstRampInGroup) return onSelectRamp(firstRampInGroup.id);
                              onSelectCollection(collection.id);
                            }}
                          >
                            <span className={styles.sidebarRowIcon} aria-hidden="true">
                              <SquareDashed size={15} />
                            </span>
                            <span className={styles.sidebarLabelText}>{group.name}</span>
                          </button>

                          <div
                            className={styles.sidebarBranch}
                            data-group-dropzone={group.id}
                            data-drop-target={dropTarget?.type === 'ramp' && dropTarget.groupId === group.id && dropTarget.edge === 'into' ? '' : undefined}
                            onDragOver={(event) => {
                              if (getDraggedItem()?.type !== 'ramp') return;
                              event.preventDefault();
                              event.stopPropagation();
                              updateDropTarget(getRampContainerDropTarget(collection.id, group.ramps.length, group.id));
                            }}
                            onDrop={(event) => {
                              if (getDraggedItem()?.type !== 'ramp') return;
                              event.preventDefault();
                              event.stopPropagation();
                              moveDraggedItem(getRampContainerDropTarget(collection.id, group.ramps.length, group.id));
                            }}
                          >
                            {group.ramps.length > 0 ? (
                              <div
                                className={styles.sidebarDropZone}
                                data-dropzone-scope="group"
                                data-dropzone-id={group.id}
                                data-dropzone-position="start"
                                data-drop-visible={
                                  dropTarget?.type === 'ramp' && dropTarget.groupId === group.id && dropTarget.index === 0 ? '' : undefined
                                }
                                onDragOver={(event) => {
                                  const target = getGroupDropTarget(collection.id, group.id, 0, group.ramps.length);
                                  if (!target) return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  updateDropTarget(target);
                                }}
                                onDrop={(event) => {
                                  const target = getGroupDropTarget(collection.id, group.id, 0, group.ramps.length);
                                  if (!target) return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  moveDraggedItem(target);
                                }}
                              />
                            ) : null}
                            {group.ramps.length > 0 ? (
                              group.ramps.map((ramp, rampIndex) => {
                                const isSelected = ramp.id === selectedRampId;
                                const isDraggingRamp = draggedItem?.type === 'ramp' && draggedItem.rampId === ramp.id;
                                const showRampBefore =
                                  dropTarget?.type === 'ramp' && dropTarget.rampId === ramp.id && dropTarget.edge === 'before';
                                const showRampAfter =
                                  dropTarget?.type === 'ramp' && dropTarget.rampId === ramp.id && dropTarget.edge === 'after';
                                return (
                                  <button
                                    key={ramp.id}
                                    type="button"
                                    className={styles.sidebarTreeRow}
                                    data-tree-row="ramp"
                                    data-ramp-depth="group"
                                    data-ramp-id={ramp.id}
                                    data-ramp-select={ramp.id}
                                    data-selected={isSelected ? '' : undefined}
                                    data-dragging={isDraggingRamp ? '' : undefined}
                                    data-drop-before={showRampBefore ? '' : undefined}
                                    data-drop-after={showRampAfter ? '' : undefined}
                                    draggable={!collapsed}
                                    onDragStart={(event) =>
                                      startDrag({ type: 'ramp', collectionId: collection.id, groupId: group.id, rampId: ramp.id }, event)
                                    }
                                    onDragEnd={endDrag}
                                    onDragOver={(event) => {
                                      if (getDraggedItem()?.type !== 'ramp') return;
                                      event.preventDefault();
                                      event.stopPropagation();
                                      updateDropTarget(getRampRowDropTarget(event, collection.id, rampIndex, ramp.id, group.id));
                                    }}
                                    onDrop={(event) => {
                                      if (getDraggedItem()?.type !== 'ramp') return;
                                      event.preventDefault();
                                      event.stopPropagation();
                                      moveDraggedItem(getRampRowDropTarget(event, collection.id, rampIndex, ramp.id, group.id));
                                    }}
                                    aria-current={isSelected ? 'true' : undefined}
                                    onClick={() => onSelectRamp(ramp.id)}
                                  >
                                    <span className={styles.sidebarRowIcon} aria-hidden="true">
                                      <Palette size={15} />
                                    </span>
                                    <span className={styles.sidebarLabelText}>{ramp.name}</span>
                                  </button>
                                );
                              })
                            ) : (
                              <div
                                className={styles.sidebarEmptyRow}
                                data-empty-dropzone={draggedItem?.type === 'ramp' ? '' : undefined}
                                onDragOver={(event) => {
                                  if (getDraggedItem()?.type !== 'ramp') return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  const target = getGroupDropTarget(collection.id, group.id, 0, group.ramps.length);
                                  if (target) updateDropTarget(target);
                                }}
                                onDrop={(event) => {
                                  if (getDraggedItem()?.type !== 'ramp') return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  const target = getGroupDropTarget(collection.id, group.id, 0, group.ramps.length);
                                  if (!target) return;
                                  moveDraggedItem(target);
                                }}
                              >
                                <span className={styles.sidebarRowIcon} aria-hidden="true">
                                  <span className={styles.sidebarRowSpacer} />
                                </span>
                                <span className={styles.sidebarLabelText}>No ramps yet</span>
                              </div>
                            )}
                            {group.ramps.length > 0 ? (
                              <div
                                className={styles.sidebarDropZone}
                                data-dropzone-scope="group"
                                data-dropzone-id={group.id}
                                data-dropzone-position="end"
                                data-drop-visible={
                                  dropTarget?.type === 'ramp' &&
                                  dropTarget.groupId === group.id &&
                                  dropTarget.index === group.ramps.length
                                    ? ''
                                    : undefined
                                }
                                onDragOver={(event) => {
                                  const target = getGroupDropTarget(collection.id, group.id, group.ramps.length, group.ramps.length);
                                  if (!target) return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  updateDropTarget(target);
                                }}
                                onDrop={(event) => {
                                  const target = getGroupDropTarget(collection.id, group.id, group.ramps.length, group.ramps.length);
                                  if (!target) return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  moveDraggedItem(target);
                                }}
                              />
                            ) : null}
                          <div
                            className={styles.sidebarDropZone}
                            data-dropzone-scope="group"
                            data-dropzone-id={group.id}
                            data-dropzone-position="after"
                            data-drop-visible={showGroupAfter ? '' : undefined}
                            onDragOver={(event) => {
                              if (getDraggedItem()?.type !== 'group') return;
                              event.preventDefault();
                              event.stopPropagation();
                              updateDropTarget({
                                type: 'group',
                                collectionId: collection.id,
                                groupId: group.id,
                                index: nodeIndex + 1,
                                edge: 'after',
                              });
                            }}
                            onDrop={(event) => {
                              if (getDraggedItem()?.type !== 'group') return;
                              event.preventDefault();
                              event.stopPropagation();
                              moveDraggedItem({
                                type: 'group',
                                collectionId: collection.id,
                                groupId: group.id,
                                index: nodeIndex + 1,
                                edge: 'after',
                              });
                            }}
                          />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div
                      className={styles.sidebarEmptyRow}
                      data-empty-dropzone={draggedItem?.type === 'ramp' ? '' : undefined}
                      onDragOver={(event) => {
                        const activeDraggedItem = getDraggedItem();
                        if (activeDraggedItem?.type !== 'group' && activeDraggedItem?.type !== 'ramp') return;
                        event.preventDefault();
                        event.stopPropagation();
                        if (activeDraggedItem?.type === 'group') {
                          updateDropTarget({
                            type: 'group',
                            collectionId: collection.id,
                            index: 0,
                            edge: 'into',
                          });
                        }
                        if (activeDraggedItem?.type === 'ramp') {
                          updateDropTarget(getRampContainerDropTarget(collection.id, 0));
                        }
                      }}
                      onDrop={(event) => {
                        const activeDraggedItem = getDraggedItem();
                        if (activeDraggedItem?.type === 'group') {
                          event.preventDefault();
                          event.stopPropagation();
                          moveDraggedItem({
                            type: 'group',
                            collectionId: collection.id,
                            index: 0,
                            edge: 'into',
                          });
                          return;
                        }
                        if (activeDraggedItem?.type === 'ramp') {
                          event.preventDefault();
                          event.stopPropagation();
                          moveDraggedItem(getRampContainerDropTarget(collection.id, 0));
                        }
                      }}
                    >
                      <span className={styles.sidebarRowIcon} aria-hidden="true">
                        <span className={styles.sidebarRowSpacer} />
                      </span>
                      <span className={styles.sidebarLabelText}>No items yet</span>
                    </div>
                  )}
                  {getCollectionChildren(collection).length > 0 ? (
                    <div
                      className={styles.sidebarDropZone}
                      data-dropzone-scope="collection"
                      data-dropzone-id={collection.id}
                      data-dropzone-position="end"
                      data-drop-visible={
                        dropTarget?.collectionId === collection.id &&
                        dropTarget.index === getCollectionChildren(collection).length
                          ? ''
                          : undefined
                      }
                      onDragOver={(event) => {
                        const activeDraggedItem = getDraggedItem();
                        if (!activeDraggedItem) return;
                        event.preventDefault();
                        event.stopPropagation();
                        if (activeDraggedItem.type === 'collection') {
                          updateDropTarget({
                            type: 'collection',
                            collectionId: collection.id,
                            index: getCollectionChildren(collection).length,
                            edge: 'after',
                          });
                          return;
                        }

                        const target = getCollectionDropTarget(collection, getCollectionChildren(collection).length);
                        if (!target) return;
                        updateDropTarget(target);
                      }}
                      onDrop={(event) => {
                        const activeDraggedItem = getDraggedItem();
                        if (!activeDraggedItem) return;
                        event.preventDefault();
                        event.stopPropagation();
                        if (activeDraggedItem.type === 'collection') {
                          moveDraggedItem({
                            type: 'collection',
                            collectionId: collection.id,
                            index: getCollectionChildren(collection).length,
                            edge: 'after',
                          });
                          return;
                        }

                        const target = getCollectionDropTarget(collection, getCollectionChildren(collection).length);
                        if (!target) return;
                        moveDraggedItem(target);
                      }}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        <div
          className={styles.sidebarDropZone}
          data-dropzone-scope="collections"
          data-dropzone-position="end"
          data-drop-visible={
            dropTarget?.type === 'collection' &&
            collections[collections.length - 1] &&
            dropTarget.collectionId === collections[collections.length - 1].id &&
            dropTarget.index === collections.length
              ? ''
              : undefined
          }
          onDragOver={(event) => {
            if (getDraggedItem()?.type !== 'collection') return;
            event.preventDefault();
            updateDropTarget({
              type: 'collection',
              collectionId: collections[collections.length - 1]?.id ?? '',
              index: collections.length,
              edge: 'after',
            });
          }}
          onDrop={(event) => {
            if (getDraggedItem()?.type !== 'collection' || !collections[collections.length - 1]) return;
            event.preventDefault();
            moveDraggedItem({
              type: 'collection',
              collectionId: collections[collections.length - 1].id,
              index: collections.length,
              edge: 'after',
            });
          }}
        />
      </nav>

      <div className={styles.sidebarFooter}>
        <Button variant="primary" icon={<CirclePlus size={16} />} onClick={onAddCollection}>
          Add New Collection
        </Button>
      </div>
    </aside>
  );
}
