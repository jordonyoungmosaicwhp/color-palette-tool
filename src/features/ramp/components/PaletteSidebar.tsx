import { CirclePlus, GripVertical, Palette } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { ActionMenu, Button, IconButton } from '../../../design-system';
import type { PaletteGroup } from '../workspaceTypes';
import styles from '../RampWorkspace.module.scss';

interface PaletteSidebarProps {
  groups: PaletteGroup[];
  selectedRampId: string;
  onAddGroup: () => void;
  onSelectRamp: (id: string) => void;
  onMoveRamp?: (sourceRampId: string, targetGroupId: string, targetIndex: number) => void;
  collapsed?: boolean;
}

type DropTarget = {
  groupId: string;
  index: number;
  edge: 'before' | 'after' | 'into';
};

export function PaletteSidebar({
  groups,
  selectedRampId,
  onAddGroup,
  onSelectRamp,
  onMoveRamp = () => undefined,
  collapsed = false,
}: PaletteSidebarProps) {
  const [draggedRampId, setDraggedRampId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const moveTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (moveTimerRef.current !== null) {
        window.clearTimeout(moveTimerRef.current);
      }
    },
    [],
  );

  function startDrag(rampId: string, event: DragEvent<HTMLButtonElement>) {
    if (collapsed) return;
    setDraggedRampId(rampId);
    setDropTarget(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', rampId);
  }

  function endDrag() {
    setDraggedRampId(null);
    setDropTarget(null);
  }

  function updateDropTarget(groupId: string, index: number, edge: DropTarget['edge']) {
    if (!draggedRampId) return;
    setDropTarget((current) =>
      current?.groupId === groupId && current.index === index && current.edge === edge ? current : { groupId, index, edge },
    );
  }

  function moveDraggedRamp(groupId: string, index: number) {
    if (!draggedRampId) return;
    onMoveRamp(draggedRampId, groupId, index);
    endDrag();
  }

  function queueMenuMove(sourceRampId: string, targetGroupId: string, targetIndex: number) {
    if (moveTimerRef.current !== null) {
      window.clearTimeout(moveTimerRef.current);
    }

    moveTimerRef.current = window.setTimeout(() => {
      onMoveRamp(sourceRampId, targetGroupId, targetIndex);
      moveTimerRef.current = null;
    }, 0);
  }

  return (
    <aside className={styles.sidebar} data-collapsed={collapsed ? '' : undefined}>
      {!collapsed ? (
        <div className={styles.sidebarHeader}>
          <h2>Collections</h2>
        </div>
      ) : null}

      <nav className={styles.collectionNav} aria-label="Collections">
        {groups.map((group, groupIndex) => (
          <div key={group.id} className={styles.sidebarGroup}>
            <a className={styles.navGroup} href={`#${group.id}`}>
              <Palette size={18} />
              <span>{group.name}</span>
            </a>
            <div
              className={styles.subNav}
              data-group-dropzone={group.id}
              data-drop-target={dropTarget?.groupId === group.id && dropTarget.edge === 'into' ? '' : undefined}
              onDragOver={(event) => {
                if (!draggedRampId) return;
                event.preventDefault();
                updateDropTarget(group.id, group.ramps.length, 'into');
              }}
              onDrop={(event) => {
                if (!draggedRampId) return;
                event.preventDefault();
                moveDraggedRamp(group.id, dropTarget?.groupId === group.id ? dropTarget.index : group.ramps.length);
              }}
            >
              {group.ramps.length > 0 ? (
                group.ramps.map((ramp, rampIndex) => {
                  const isSelected = ramp.id === selectedRampId;
                  const isDragging = ramp.id === draggedRampId;
                  const showBefore = dropTarget?.groupId === group.id && dropTarget.edge === 'before' && dropTarget.index === rampIndex;
                  const showAfter = dropTarget?.groupId === group.id && dropTarget.edge === 'after' && dropTarget.index === rampIndex + 1;
                  const previousGroup = groups[groupIndex - 1];
                  const nextGroup = groups[groupIndex + 1];

                  return (
                    <div
                      key={ramp.id}
                      className={styles.sidebarRampRow}
                      data-ramp-id={ramp.id}
                      data-selected={isSelected ? '' : undefined}
                      data-dragging={isDragging ? '' : undefined}
                      data-drop-before={showBefore ? '' : undefined}
                      data-drop-after={showAfter ? '' : undefined}
                      onDragOver={(event) => {
                        if (!draggedRampId) return;
                        event.preventDefault();
                        event.stopPropagation();
                        const bounds = event.currentTarget.getBoundingClientRect();
                        const offset = bounds.height > 0 ? event.clientY - bounds.top : 0;
                        const edge = bounds.height > 0 && offset > bounds.height / 2 ? 'after' : 'before';
                        updateDropTarget(group.id, edge === 'after' ? rampIndex + 1 : rampIndex, edge);
                      }}
                      onDrop={(event) => {
                        if (!draggedRampId) return;
                        event.preventDefault();
                        event.stopPropagation();
                        moveDraggedRamp(group.id, dropTarget?.groupId === group.id ? dropTarget.index : rampIndex);
                      }}
                    >
                      {!collapsed ? (
                        <IconButton
                          label={`Drag ${ramp.name}`}
                          icon={<GripVertical size={14} />}
                          variant="ghost"
                          className={styles.sidebarDragHandle}
                          data-drag-handle={ramp.id}
                          draggable
                          onDragStart={(event) => startDrag(ramp.id, event)}
                          onDragEnd={endDrag}
                          onClick={(event) => event.preventDefault()}
                        />
                      ) : null}
                      <button
                        type="button"
                        aria-current={isSelected ? 'true' : undefined}
                        data-ramp-select={ramp.id}
                        className={`${styles.sidebarRampButton} ${isSelected ? styles.activeSubItem : ''}`.trim()}
                        onClick={() => onSelectRamp(ramp.id)}
                      >
                        {ramp.name}
                      </button>
                      {!collapsed ? (
                        <ActionMenu
                          label={`${ramp.name} reorder options`}
                          items={[
                            {
                              id: 'move-up',
                              label: 'Move up',
                              disabled: rampIndex === 0,
                              onSelect: () => queueMenuMove(ramp.id, group.id, rampIndex - 1),
                            },
                            {
                              id: 'move-down',
                              label: 'Move down',
                              disabled: rampIndex === group.ramps.length - 1,
                              onSelect: () => queueMenuMove(ramp.id, group.id, rampIndex + 2),
                            },
                            {
                              id: 'move-prev-group',
                              label: 'Move to previous group',
                              disabled: !previousGroup,
                              onSelect: () => previousGroup && queueMenuMove(ramp.id, previousGroup.id, previousGroup.ramps.length),
                            },
                            {
                              id: 'move-next-group',
                              label: 'Move to next group',
                              disabled: !nextGroup,
                              onSelect: () => nextGroup && queueMenuMove(ramp.id, nextGroup.id, nextGroup.ramps.length),
                            },
                          ]}
                        />
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <span data-empty-dropzone={draggedRampId ? '' : undefined}>No ramps yet</span>
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <Button variant="primary" icon={<CirclePlus size={16} />} onClick={onAddGroup}>
          New Group
        </Button>
      </div>
    </aside>
  );
}
