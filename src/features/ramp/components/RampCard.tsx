import { ActionMenu } from '../../../design-system';
import type { GeneratedStop } from '../../../lib/color';
import { EditableLabel } from './EditableLabel';
import { SwatchRow } from './SwatchRow';
import styles from '../RampWorkspace.module.scss';

export interface RampDisplayOptions {
  allowHiddenStops: boolean;
  showHex: boolean;
  showLightness: boolean;
  showChroma: boolean;
  showHue: boolean;
}

interface RampCardProps {
  id: string;
  name: string;
  selected?: boolean;
  orientation: 'column' | 'row';
  engineStops: GeneratedStop[];
  displayOptions: RampDisplayOptions;
  onSelectRamp: (id: string) => void;
  onRenameRamp: (id: string, name: string) => void;
  onSelectStop?: (index: number) => void;
  onInsertStop?: (rampId: string, start: number, end: number) => void;
  onToggleVisibility?: (rampId: string, index: number) => void;
  onDeleteStop?: (rampId: string, index: number) => void;
  onDeleteRamp: (id: string) => void;
  onDuplicateRamp: (id: string) => void;
  onClearMinorStops: (id: string) => void;
}

export function RampCard({
  id,
  name,
  selected,
  orientation,
  engineStops,
  displayOptions,
  onSelectRamp,
  onRenameRamp,
  onSelectStop,
  onInsertStop,
  onToggleVisibility,
  onDeleteStop,
  onDeleteRamp,
  onDuplicateRamp,
  onClearMinorStops,
}: RampCardProps) {
  const stops = [...engineStops].sort((a, b) => a.index - b.index);

  return (
    <article className={styles.rampCard} data-selected={selected ? '' : undefined} onClick={() => onSelectRamp(id)}>
      <header className={styles.rampCardHeader}>
        <EditableLabel
          value={name}
          className={styles.rampTitleButton}
          onChange={(value) => onRenameRamp(id, value)}
        />
        <ActionMenu
          label={`${name} options`}
          items={[
            { id: 'duplicate', label: 'Duplicate ramp', onSelect: () => onDuplicateRamp(id) },
            { id: 'clear', label: 'Clear minor stops', onSelect: () => onClearMinorStops(id) },
            { id: 'delete', label: 'Delete ramp', destructive: true, onSelect: () => onDeleteRamp(id) },
          ]}
        />
      </header>
      <main className={styles.rampCardMain}>
        <Ramp
          stops={stops}
          orientation={orientation}
          displayOptions={displayOptions}
          onSelectStop={onSelectStop}
          onInsertStop={(start, end) => onInsertStop?.(id, start, end)}
          onToggleVisibility={(index) => onToggleVisibility?.(id, index)}
          onDeleteStop={(index) => onDeleteStop?.(id, index)}
        />
      </main>
    </article>
  );
}

interface RampProps {
  stops: GeneratedStop[];
  orientation: 'column' | 'row';
  displayOptions: RampDisplayOptions;
  onSelectStop?: (index: number) => void;
  onInsertStop?: (start: number, end: number) => void;
  onToggleVisibility?: (index: number) => void;
  onDeleteStop?: (index: number) => void;
}

export function Ramp({ stops, orientation, displayOptions, onSelectStop, onInsertStop, onToggleVisibility, onDeleteStop }: RampProps) {
  const sortedStops = [...stops].sort((a, b) => a.index - b.index);
  const visibleStops = sortedStops.filter((stop) => !('oklch' in stop && stop.index === 0 && stop.oklch.l >= 0.995));

  return (
    <div className={styles.cardRamp} data-orientation={orientation}>
      {visibleStops.map((stop, index) => {
        const sourceIndex = sortedStops.findIndex((item) => item.index === stop.index);
        const previous = sortedStops[sourceIndex - 1];
        const next = sortedStops[sourceIndex + 1];
        const gap = next ? Math.abs(stop.index - next.index) : 0;
        const leadingGap = previous && index === 0 ? Math.abs(stop.index - previous.index) : 0;
        const generated = 'state' in stop ? stop : undefined;

        return (
          <SwatchRow
            key={stop.index}
            stop={stop}
            anchor={generated?.state === 'anchor'}
            selected={generated?.state === 'anchor'}
            visible={generated?.visible ?? true}
            canEditStops
            displayOptions={displayOptions}
            canToggleVisibility={displayOptions.allowHiddenStops}
            previousIndex={previous?.index}
            canInsertBefore={leadingGap > 25}
            nextIndex={next?.index}
            canInsertAfter={gap > 25}
            onSelect={onSelectStop}
            onInsertBefore={onInsertStop}
            onInsertAfter={onInsertStop}
            onToggleVisibility={onToggleVisibility}
            onDelete={onDeleteStop}
            orientation={orientation}
          />
        );
      })}
    </div>
  );
}
