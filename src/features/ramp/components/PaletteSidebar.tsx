import { ChevronDown, ChevronRight, CirclePlus, File, Palette, SquareDashed } from 'lucide-react';
import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import type { WorkspaceNode } from '../../../app/tree/treeTypes';
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

    if (activeDraggedItem.type === 'group' && target.type === 'group') {
      onMoveGroup(activeDraggedItem.groupId, target.collectionId, target.index);
    }

    if (activeDraggedItem.type === 'ramp' && target.type === 'ramp') {
      onMoveRamp(
        activeDraggedItem.rampId,
        target.groupId
          ? { type: 'group', groupId: target.groupId, index: target.index }
          : { type: 'collection', collectionId: target.collectionId, index: target.index },
      );
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

  function getCollectionChildren(collection: WorkspaceCollection): WorkspaceNode[] {
    return collection.children?.length
      ? collection.children
      : collection.groups.map((group) => ({
          type: 'group' as const,
          id: group.id,
          group,
        }));
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
    if (activeDraggedItem?.type === 'group') {
      return {
        type: 'group',
        collectionId: collection.id,
        index,
        edge: index <= 0 ? 'before' : index >= getCollectionChildren(collection).length ? 'after' : 'into',
      };
    }

    if (activeDraggedItem?.type === 'ramp') {
      return {
        type: 'ramp',
        collectionId: collection.id,
        index,
        edge: index <= 0 ? 'before' : index >= getCollectionChildren(collection).length ? 'after' : 'into',
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
                  if (getDraggedItem()?.type !== 'collection') return;
                  event.preventDefault();
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const edge = event.clientY - bounds.top > bounds.height / 2 ? 'after' : 'before';
                  updateDropTarget({
                    type: 'collection',
                    collectionId: collection.id,
                    index: edge === 'after' ? collectionIndex + 1 : collectionIndex,
                    edge,
                  });
                }}
                onDrop={(event) => {
                  if (getDraggedItem()?.type !== 'collection' || !dropTarget || dropTarget.type !== 'collection') return;
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
                    (dropTarget?.type === 'group' && dropTarget.collectionId === collection.id && dropTarget.edge === 'into') ||
                    (dropTarget?.type === 'ramp' &&
                      dropTarget.collectionId === collection.id &&
                      !dropTarget.groupId &&
                      dropTarget.edge === 'into')
                      ? ''
                      : undefined
                  }
                  onDragOver={(event) => {
                    const activeDraggedItem = getDraggedItem();
                    if (activeDraggedItem?.type !== 'group' && activeDraggedItem?.type !== 'ramp') return;
                    event.preventDefault();
                    if (activeDraggedItem?.type === 'group') {
                      updateDropTarget({
                        type: 'group',
                        collectionId: collection.id,
                        index: getCollectionChildren(collection).length,
                        edge: 'into',
                      });
                    }

                    if (activeDraggedItem?.type === 'ramp') {
                      updateDropTarget(getRampContainerDropTarget(collection.id, getCollectionChildren(collection).length));
                    }
                  }}
                  onDrop={(event) => {
                    if (getDraggedItem()?.type === 'group' && dropTarget?.type === 'group') {
                      event.preventDefault();
                      moveDraggedItem(dropTarget);
                      return;
                    }
                    if (getDraggedItem()?.type === 'ramp') {
                      event.preventDefault();
                      moveDraggedItem(getRampContainerDropTarget(collection.id, getCollectionChildren(collection).length));
                    }
                  }}
                >
                  <div
                    className={styles.sidebarDropZone}
                    data-dropzone-scope="collection"
                    data-dropzone-id={collection.id}
                    data-dropzone-position="start"
                    data-drop-visible={
                      (dropTarget?.type === 'group' && dropTarget.collectionId === collection.id && dropTarget.index === 0) ||
                      (dropTarget?.type === 'ramp' &&
                        dropTarget.collectionId === collection.id &&
                        !dropTarget.groupId &&
                        dropTarget.index === 0)
                        ? ''
                        : undefined
                    }
                    onDragOver={(event) => {
                      const target = getCollectionDropTarget(collection, 0);
                      if (!target) return;
                      event.preventDefault();
                      event.stopPropagation();
                      updateDropTarget(target);
                    }}
                    onDrop={(event) => {
                      const target = getCollectionDropTarget(collection, 0);
                      if (!target) return;
                      event.preventDefault();
                      event.stopPropagation();
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
                          <button
                            type="button"
                            className={styles.sidebarTreeRow}
                            data-tree-row="group"
                            data-group-row={group.id}
                            data-dragging={isDraggingGroup ? '' : undefined}
                            data-drop-before={showGroupBefore ? '' : undefined}
                            data-drop-after={showGroupAfter ? '' : undefined}
                            draggable={!collapsed}
                            onDragStart={(event) => startDrag({ type: 'group', collectionId: collection.id, groupId: group.id }, event)}
                            onDragEnd={endDrag}
                            onDragOver={(event) => {
                              if (getDraggedItem()?.type !== 'group') return;
                              event.preventDefault();
                              event.stopPropagation();
                              const bounds = event.currentTarget.getBoundingClientRect();
                              const edge = event.clientY - bounds.top > bounds.height / 2 ? 'after' : 'before';
                              updateDropTarget({
                                type: 'group',
                                collectionId: collection.id,
                                groupId: group.id,
                                index: edge === 'after' ? nodeIndex + 1 : nodeIndex,
                                edge,
                              });
                            }}
                            onDrop={(event) => {
                              if (getDraggedItem()?.type !== 'group' || !dropTarget || dropTarget.type !== 'group') return;
                              event.preventDefault();
                              event.stopPropagation();
                              moveDraggedItem(dropTarget);
                            }}
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
                              <span data-empty-dropzone={draggedItem?.type === 'ramp' ? '' : undefined}>No ramps yet</span>
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
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <span data-empty-dropzone={draggedItem?.type === 'group' ? '' : undefined}>No items yet</span>
                  )}
                  {getCollectionChildren(collection).length > 0 ? (
                    <div
                      className={styles.sidebarDropZone}
                      data-dropzone-scope="collection"
                      data-dropzone-id={collection.id}
                      data-dropzone-position="end"
                      data-drop-visible={
                        (dropTarget?.type === 'group' &&
                          dropTarget.collectionId === collection.id &&
                          dropTarget.index === getCollectionChildren(collection).length) ||
                        (dropTarget?.type === 'ramp' &&
                          dropTarget.collectionId === collection.id &&
                          !dropTarget.groupId &&
                          dropTarget.index === getCollectionChildren(collection).length)
                          ? ''
                          : undefined
                      }
                      onDragOver={(event) => {
                        const target = getCollectionDropTarget(collection, getCollectionChildren(collection).length);
                        if (!target) return;
                        event.preventDefault();
                        event.stopPropagation();
                        updateDropTarget(target);
                      }}
                      onDrop={(event) => {
                        const target = getCollectionDropTarget(collection, getCollectionChildren(collection).length);
                        if (!target) return;
                        event.preventDefault();
                        event.stopPropagation();
                        moveDraggedItem(target);
                      }}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className={styles.sidebarFooter}>
        <Button variant="primary" icon={<CirclePlus size={16} />} onClick={onAddCollection}>
          Add New Collection
        </Button>
      </div>
    </aside>
  );
}
