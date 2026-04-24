import { ChevronDown, ChevronRight, CirclePlus, File, Palette, SquareDashed } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import type { WorkspaceNode } from '../../../app/tree/treeTypes';
import { ActionMenu, Button } from '../../../design-system';
import type { WorkspaceCollection } from '../workspaceTypes';
import styles from './PaletteSidebar.module.scss';

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

  function renameCollectionFromMenu(collectionId: string, currentName: string) {
    const nextName = window.prompt('Rename collection', currentName);
    if (!nextName) return;
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === currentName) return;
    queueMove(() => onRenameCollection(collectionId, trimmed));
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
              <div className={styles.sidebarRowShell}>
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
                  onClick={() => {
                    onToggleCollection(collection.id);
                    const firstRampId = getFirstRampId(collection);
                    if (firstRampId) return onSelectRamp(firstRampId);
                    onSelectCollection(collection.id);
                  }}
                >
                  <span
                    className={styles.sidebarDisclosure}
                    aria-hidden="true"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  <span className={styles.sidebarRowIcon} aria-hidden="true">
                    <File size={15} />
                  </span>
                  <span className={styles.sidebarLabelText}>{collection.name}</span>
                </button>
                <div className={styles.sidebarMenu}>
                  <ActionMenu
                    label={`${collection.name} options`}
                    items={[
                      {
                        id: 'rename',
                        label: 'Rename collection',
                        onSelect: () => renameCollectionFromMenu(collection.id, collection.name),
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
                  {getCollectionChildren(collection).length > 0 ? (
                    getCollectionChildren(collection).map((node, nodeIndex) => {
                      if (node.type === 'ramp') {
                        const ramp = node.ramp;
                        const isSelected = ramp.id === selectedRampId;

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
                            aria-current={isSelected ? 'true' : undefined}
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
                              if (draggedItem?.type !== 'group') return;
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
                              if (draggedItem?.type !== 'group' || !dropTarget || dropTarget.type !== 'group') return;
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
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <span data-empty-dropzone={draggedItem?.type === 'group' ? '' : undefined}>No items yet</span>
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
