import { CirclePlus, Trash2 } from 'lucide-react';
import { Button, IconButton } from '../../../design-system';
import { generateRamp } from '../../../lib/color';
import type { GeneratedStop, ThemeSettings } from '../../../lib/color';
import type { PaletteGroup, RampDisplayOptions } from '../workspaceTypes';
import { EditableLabel } from './EditableLabel';
import { RampCard } from './RampCard';
import styles from '../RampWorkspace.module.scss';

interface PaletteGroupSectionProps {
  group: PaletteGroup;
  selectedRampId: string;
  theme: ThemeSettings;
  displayOptions: RampDisplayOptions;
  view: 'column' | 'row';
  canDeleteGroup: boolean;
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
}

export function PaletteGroupSection({
  group,
  selectedRampId,
  theme,
  displayOptions,
  view,
  canDeleteGroup,
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
          {canDeleteGroup ? (
            <IconButton label="Delete group" icon={<Trash2 size={15} />} variant="ghost" onClick={() => onDeleteGroup(group.id)} />
          ) : null}
          <Button variant="ghost" size="sm" icon={<CirclePlus size={15} />} onClick={() => onAddRamp(group.id)}>
            Add Ramp
          </Button>
        </div>
      </header>

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
    </section>
  );
}
