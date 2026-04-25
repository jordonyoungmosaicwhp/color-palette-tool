import { CirclePlus } from 'lucide-react';
import { ActionMenu, Button } from '../../../design-system';
import { generateRamp } from '../../../lib/color';
import type { GeneratedStop, ThemeSettings } from '../../../lib/color';
import type { RampDisplayOptions, WorkspaceGroup } from '../workspaceTypes';
import { EditableLabel } from './EditableLabel';
import { RampCard } from './RampCard';
import styles from '../RampWorkspace.module.scss';

interface PaletteGroupSectionProps {
  group: WorkspaceGroup;
  selectedRampId: string;
  theme: ThemeSettings;
  displayOptions: RampDisplayOptions;
  view: 'column' | 'row';
  onRenameGroup: (groupId: string, name: string) => void;
  onRenameRamp: (rampId: string, name: string) => void;
  onAddRamp: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onSelectRamp: (id: string) => void;
  onSelectStop: (index: number) => void;
  onInsertStop: (rampId: string, start: number, end: number) => void;
  onToggleVisibility: (rampId: string, index: number) => void;
  onDeleteStop: (rampId: string, index: number) => void;
  onDeleteRamp: (id: string) => void;
  onDuplicateRamp: (id: string) => void;
  onClearMinorStops: (id: string) => void;
  copiedChromaSourceId?: string | null;
  canPasteChroma?: boolean;
  onCopyChroma?: (rampId: string) => void;
  onPasteChroma?: (rampId: string) => void;
}

export function PaletteGroupSection({
  group,
  selectedRampId,
  theme,
  displayOptions,
  view,
  onRenameGroup,
  onRenameRamp,
  onAddRamp,
  onDeleteGroup,
  onSelectRamp,
  onSelectStop,
  onInsertStop,
  onToggleVisibility,
  onDeleteStop,
  onDeleteRamp,
  onDuplicateRamp,
  onClearMinorStops,
  copiedChromaSourceId = null,
  canPasteChroma = false,
  onCopyChroma = () => undefined,
  onPasteChroma = () => undefined,
}: PaletteGroupSectionProps) {
  return (
    <section id={group.id} className={styles.rampSection}>
      <header className={styles.sectionHeader}>
        <EditableLabel
          value={group.name}
          className={styles.groupTitleButton}
          onChange={(value) => onRenameGroup(group.id, value)}
        />
        <div className={styles.sectionActions}>
          <Button variant="ghost" size="md" icon={<CirclePlus size={15} />} onClick={() => onAddRamp(group.id)}>
            Add Ramp
          </Button>
          <ActionMenu
            label={`${group.name} options`}
            items={[
              {
                id: 'delete',
                label: 'Delete group',
                destructive: true,
                onSelect: () => onDeleteGroup(group.id),
              },
            ]}
          />
        </div>
      </header>

      <div className={styles.cardGridScroller} data-view={view}>
        <div className={styles.cardGrid} data-view={view}>
          {group.ramps.map((ramp) => {
            const engineStops: GeneratedStop[] = generateRamp(theme, ramp.config);
            return (
              <RampCard
                key={ramp.id}
                id={ramp.id}
                name={ramp.name}
                selected={ramp.id === selectedRampId}
                orientation={view}
                engineStops={engineStops}
                displayOptions={displayOptions}
                onSelectRamp={onSelectRamp}
                onRenameRamp={onRenameRamp}
                onSelectStop={onSelectStop}
                onInsertStop={onInsertStop}
                onToggleVisibility={onToggleVisibility}
                onDeleteStop={onDeleteStop}
                onDeleteRamp={onDeleteRamp}
                onDuplicateRamp={onDuplicateRamp}
                onClearMinorStops={onClearMinorStops}
                copiedChromaSourceId={copiedChromaSourceId}
                canPasteChroma={canPasteChroma}
                onCopyChroma={onCopyChroma}
                onPasteChroma={onPasteChroma}
              />
            );
          })}
          {group.ramps.length === 0 ? (
            <button type="button" className={styles.newRampCard} onClick={() => onAddRamp(group.id)}>
              <CirclePlus size={32} />
              <span>New Ramp</span>
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
