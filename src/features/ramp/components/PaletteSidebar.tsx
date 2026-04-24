import { ChevronDown, ChevronRight, CirclePlus, File, Palette, SquareDashed } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { ActionMenu, Button } from '../../../design-system';
import type { WorkspaceCollection } from '../workspaceTypes';
import { EditableLabel } from './EditableLabel';
import styles from '../RampWorkspace.module.scss';

interface PaletteSidebarProps {
  collections: WorkspaceCollection[];
  activeCollectionId: string;
  expandedCollectionIds: string[];
  selectedRampId: string;
  onAddCollection: () => void;
  onRenameCollection: (collectionId: string, name: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  onSelectCollection: (collectionId: string) => void;
  onToggleCollection: (collectionId: string) => void;
  onSelectRamp: (rampId: string) => void;
  onMoveCollection: (sourceCollectionId: string, targetIndex: number) => void;
  onMoveGroup: (sourceGroupId: string, targetCollectionId: string, targetIndex: number) => void;
  onMoveRamp: (sourceRampId: string, targetGroupId: string, targetIndex: number) => void;
  collapsed?: boolean;
}

type DragItem =
  | { type: 'collection'; collectionId: string }
  | { type: 'group'; collectionId: string; groupId: string }
  | { type: 'ramp'; collectionId: string; groupId: string; rampId: string };

type DropTarget =
  | { type: 'collection'; collectionId: string; index: number; edge: 'before' | 'after' }
  | { type: 'group'; collectionId: string; groupId?: string; index: number; edge: 'before' | 'after' | 'into' }
  | { type: 'ramp'; collectionId: string; groupId: string; rampId?: string; index: number; edge: 'before' | 'after' | 'into' };

export function PaletteSidebar({
  collections,
  activeCollectionId,
  expandedCollectionIds,
  selectedRampId,
  onAddCollection,
  onRenameCollection,
  onDeleteCollection,
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
  const moveTimerRef = useRef<number | null>(null);
  const expandedCollectionSet = new Set(expandedCollectionIds);
  const flattenedGroups = collections.flatMap((collection) => collection.groups.map((group) => ({ collection, group })));

  useEffect(
    () => () => {
      if (moveTimerRef.current !== null) {
        window.clearTimeout(moveTimerRef.current);
      }
    },
    [],
  );

  function startDrag(item: DragItem, event: DragEvent<HTMLElement>) {
    if (collapsed) return;
    setDraggedItem(item);
    setDropTarget(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify(item));
  }

  function endDrag() {
    setDraggedItem(null);
    setDropTarget(null);
  }

  function queueMove(callback: () => void) {
    if (moveTimerRef.current !== null) {
      window.clearTimeout(moveTimerRef.current);
    }

    moveTimerRef.current = window.setTimeout(() => {
      callback();
      moveTimerRef.current = null;
    }, 0);
  }

  function moveDraggedItem(target: DropTarget) {
    if (!draggedItem) return;

    if (draggedItem.type === 'collection' && target.type === 'collection') {
      onMoveCollection(draggedItem.collectionId, target.index);
    }

    if (draggedItem.type === 'group' && target.type === 'group') {
      onMoveGroup(draggedItem.groupId, target.collectionId, target.index);
    }

    if (draggedItem.type === 'ramp' && target.type === 'ramp') {
      onMoveRamp(draggedItem.rampId, target.groupId, target.index);
    }

    endDrag();
  }

  function updateDropTarget(target: DropTarget) {
    if (!draggedItem || draggedItem.type !== target.type) return;
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

  function previousGroup(groupId: string) {
    const index = flattenedGroups.findIndex((entry) => entry.group.id === groupId);
    return index > 0 ? flattenedGroups[index - 1] : undefined;
  }

  function nextGroup(groupId: string) {
    const index = flattenedGroups.findIndex((entry) => entry.group.id === groupId);
    return index >= 0 && index < flattenedGroups.length - 1 ? flattenedGroups[index + 1] : undefined;
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
              <div
                className={styles.sidebarTreeRow}
                data-tree-row="collection"
                data-collection-row={collection.id}
                data-active={isActive ? '' : undefined}
                data-dragging={isDraggingCollection ? '' : undefined}
                data-drop-before={showCollectionBefore ? '' : undefined}
                data-drop-after={showCollectionAfter ? '' : undefined}
                draggable={!collapsed}
                onDragStart={(event) => startDrag({ type: 'collection', collectionId: collection.id }, event)}
                onDragEnd={endDrag}
                onDragOver={(event) => {
                  if (draggedItem?.type !== 'collection') return;
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
                  if (draggedItem?.type !== 'collection' || !dropTarget || dropTarget.type !== 'collection') return;
                  event.preventDefault();
                  moveDraggedItem(dropTarget);
                }}
              >
                <button
                  type="button"
                  className={styles.sidebarDisclosure}
                  aria-label={isExpanded ? `Collapse ${collection.name}` : `Expand ${collection.name}`}
                  aria-expanded={isExpanded}
                  onClick={() => onToggleCollection(collection.id)}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <div className={styles.sidebarTreeLabel}>
                  <button
                    type="button"
                    className={styles.sidebarIconButton}
                    data-collection-select={collection.id}
                    aria-label={`Select ${collection.name}`}
                    onClick={() => onSelectCollection(collection.id)}
                  >
                    <File size={15} />
                  </button>
                  <EditableLabel
                    value={collection.name}
                    className={`${styles.sidebarEditableLabel} ${isActive ? styles.activeSubItem : ''}`.trim()}
                    onChange={(value) => onRenameCollection(collection.id, value)}
                    onActivate={() => onSelectCollection(collection.id)}
                    editOnDoubleClick
                  />
                </div>
                <ActionMenu
                  label={`${collection.name} reorder options`}
                  items={[
                    {
                      id: 'move-up',
                      label: 'Move up',
                      disabled: collectionIndex === 0,
                      onSelect: () => queueMove(() => onMoveCollection(collection.id, collectionIndex - 1)),
                    },
                    {
                      id: 'move-down',
                      label: 'Move down',
                      disabled: collectionIndex === collections.length - 1,
                      onSelect: () => queueMove(() => onMoveCollection(collection.id, collectionIndex + 2)),
                    },
                    {
                      id: 'delete',
                      label: 'Delete collection',
                      destructive: true,
                      disabled: collections.length === 1,
                      onSelect: () => queueMove(() => onDeleteCollection(collection.id)),
                    },
                  ]}
                />
              </div>

              {isExpanded ? (
                <div
                  className={styles.sidebarBranch}
                  data-collection-dropzone={collection.id}
                  data-drop-target={dropTarget?.type === 'group' && dropTarget.collectionId === collection.id && dropTarget.edge === 'into' ? '' : undefined}
                  onDragOver={(event) => {
                    if (draggedItem?.type !== 'group') return;
                    event.preventDefault();
                    updateDropTarget({
                      type: 'group',
                      collectionId: collection.id,
                      index: collection.groups.length,
                      edge: 'into',
                    });
                  }}
                  onDrop={(event) => {
                    if (draggedItem?.type !== 'group' || !dropTarget || dropTarget.type !== 'group') return;
                    event.preventDefault();
                    moveDraggedItem(dropTarget);
                  }}
                >
                  {collection.groups.length > 0 ? (
                    collection.groups.map((group, groupIndex) => {
                      const isDraggingGroup = draggedItem?.type === 'group' && draggedItem.groupId === group.id;
                      const showGroupBefore =
                        dropTarget?.type === 'group' && dropTarget.groupId === group.id && dropTarget.edge === 'before';
                      const showGroupAfter =
                        dropTarget?.type === 'group' && dropTarget.groupId === group.id && dropTarget.edge === 'after';
                      const previousCollection = collections[collectionIndex - 1];
                      const nextCollection = collections[collectionIndex + 1];
                      const previousSibling = collection.groups[groupIndex - 1];
                      const nextSibling = collection.groups[groupIndex + 1];
                      const previousTreeGroup = previousGroup(group.id);
                      const nextTreeGroup = nextGroup(group.id);

                      return (
                        <div key={group.id} className={styles.sidebarTreeNode}>
                          <div
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
                              if (draggedItem?.type !== 'group') return;
                              event.preventDefault();
                              event.stopPropagation();
                              const bounds = event.currentTarget.getBoundingClientRect();
                              const edge = event.clientY - bounds.top > bounds.height / 2 ? 'after' : 'before';
                              updateDropTarget({
                                type: 'group',
                                collectionId: collection.id,
                                groupId: group.id,
                                index: edge === 'after' ? groupIndex + 1 : groupIndex,
                                edge,
                              });
                            }}
                            onDrop={(event) => {
                              if (draggedItem?.type !== 'group' || !dropTarget || dropTarget.type !== 'group') return;
                              event.preventDefault();
                              event.stopPropagation();
                              moveDraggedItem(dropTarget);
                            }}
                          >
                            <div className={styles.sidebarTreeLabel}>
                              <button type="button" className={styles.sidebarNodeButton} onClick={() => onSelectCollection(collection.id)}>
                                <SquareDashed size={15} />
                              </button>
                              <span className={styles.sidebarLabelText}>{group.name}</span>
                            </div>
                            <ActionMenu
                              label={`${group.name} reorder options`}
                              items={[
                                {
                                  id: 'move-up',
                                  label: 'Move up',
                                  disabled: !previousSibling,
                                  onSelect: () => queueMove(() => onMoveGroup(group.id, collection.id, groupIndex - 1)),
                                },
                                {
                                  id: 'move-down',
                                  label: 'Move down',
                                  disabled: !nextSibling,
                                  onSelect: () => queueMove(() => onMoveGroup(group.id, collection.id, groupIndex + 2)),
                                },
                                {
                                  id: 'move-prev-collection',
                                  label: 'Move to previous collection',
                                  disabled: !previousCollection,
                                  onSelect: () =>
                                    previousCollection && queueMove(() => onMoveGroup(group.id, previousCollection.id, previousCollection.groups.length)),
                                },
                                {
                                  id: 'move-next-collection',
                                  label: 'Move to next collection',
                                  disabled: !nextCollection,
                                  onSelect: () =>
                                    nextCollection && queueMove(() => onMoveGroup(group.id, nextCollection.id, nextCollection.groups.length)),
                                },
                              ]}
                            />
                          </div>

                          <div
                            className={styles.sidebarBranch}
                            data-group-dropzone={group.id}
                            data-drop-target={dropTarget?.type === 'ramp' && dropTarget.groupId === group.id && dropTarget.edge === 'into' ? '' : undefined}
                            onDragOver={(event) => {
                              if (draggedItem?.type !== 'ramp') return;
                              event.preventDefault();
                              event.stopPropagation();
                              updateDropTarget({
                                type: 'ramp',
                                collectionId: collection.id,
                                groupId: group.id,
                                index: group.ramps.length,
                                edge: 'into',
                              });
                            }}
                            onDrop={(event) => {
                              if (draggedItem?.type !== 'ramp' || !dropTarget || dropTarget.type !== 'ramp') return;
                              event.preventDefault();
                              event.stopPropagation();
                              moveDraggedItem(dropTarget);
                            }}
                          >
                            {group.ramps.length > 0 ? (
                              group.ramps.map((ramp, rampIndex) => {
                                const isSelected = ramp.id === selectedRampId;
                                const isDraggingRamp = draggedItem?.type === 'ramp' && draggedItem.rampId === ramp.id;
                                const showRampBefore =
                                  dropTarget?.type === 'ramp' && dropTarget.rampId === ramp.id && dropTarget.edge === 'before';
                                const showRampAfter =
                                  dropTarget?.type === 'ramp' && dropTarget.rampId === ramp.id && dropTarget.edge === 'after';
                                const previousRamp = group.ramps[rampIndex - 1];
                                const nextRamp = group.ramps[rampIndex + 1];

                                return (
                                  <div
                                    key={ramp.id}
                                    className={styles.sidebarTreeRow}
                                    data-tree-row="ramp"
                                    data-ramp-id={ramp.id}
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
                                      if (draggedItem?.type !== 'ramp') return;
                                      event.preventDefault();
                                      event.stopPropagation();
                                      const bounds = event.currentTarget.getBoundingClientRect();
                                      const edge = event.clientY - bounds.top > bounds.height / 2 ? 'after' : 'before';
                                      updateDropTarget({
                                        type: 'ramp',
                                        collectionId: collection.id,
                                        groupId: group.id,
                                        rampId: ramp.id,
                                        index: edge === 'after' ? rampIndex + 1 : rampIndex,
                                        edge,
                                      });
                                    }}
                                    onDrop={(event) => {
                                      if (draggedItem?.type !== 'ramp' || !dropTarget || dropTarget.type !== 'ramp') return;
                                      event.preventDefault();
                                      event.stopPropagation();
                                      moveDraggedItem(dropTarget);
                                    }}
                                  >
                                    <button
                                      type="button"
                                      className={`${styles.sidebarNodeButton} ${isSelected ? styles.activeSubItem : ''}`.trim()}
                                      data-ramp-select={ramp.id}
                                      aria-current={isSelected ? 'true' : undefined}
                                      onClick={() => onSelectRamp(ramp.id)}
                                    >
                                      <Palette size={15} />
                                      <span className={styles.sidebarLabelText}>{ramp.name}</span>
                                    </button>
                                    <ActionMenu
                                      label={`${ramp.name} reorder options`}
                                      items={[
                                        {
                                          id: 'move-up',
                                          label: 'Move up',
                                          disabled: !previousRamp,
                                          onSelect: () => queueMove(() => onMoveRamp(ramp.id, group.id, rampIndex - 1)),
                                        },
                                        {
                                          id: 'move-down',
                                          label: 'Move down',
                                          disabled: !nextRamp,
                                          onSelect: () => queueMove(() => onMoveRamp(ramp.id, group.id, rampIndex + 2)),
                                        },
                                        {
                                          id: 'move-prev-group',
                                          label: 'Move to previous group',
                                          disabled: !previousTreeGroup,
                                          onSelect: () =>
                                            previousTreeGroup &&
                                            queueMove(() => onMoveRamp(ramp.id, previousTreeGroup.group.id, previousTreeGroup.group.ramps.length)),
                                        },
                                        {
                                          id: 'move-next-group',
                                          label: 'Move to next group',
                                          disabled: !nextTreeGroup,
                                          onSelect: () =>
                                            nextTreeGroup &&
                                            queueMove(() => onMoveRamp(ramp.id, nextTreeGroup.group.id, nextTreeGroup.group.ramps.length)),
                                        },
                                      ]}
                                    />
                                  </div>
                                );
                              })
                            ) : (
                              <span data-empty-dropzone={draggedItem?.type === 'ramp' ? '' : undefined}>No ramps yet</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <span data-empty-dropzone={draggedItem?.type === 'group' ? '' : undefined}>No groups yet</span>
                  )}
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
