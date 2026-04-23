import { AlertTriangle, Eye, EyeOff, Plus, Star, Trash2 } from 'lucide-react';
import { IconButton, Tooltip } from '../../../design-system';
import { cx } from '../../../design-system/utils';
import { isCanonicalStop, readableTextColor } from '../../../lib/color';
import type { GeneratedStop } from '../../../lib/color';
import type { RampDisplayOptions } from '../workspaceTypes';
import styles from '../RampWorkspace.module.scss';

interface SwatchRowProps {
  stop: GeneratedStop;
  selected?: boolean;
  anchor?: boolean;
  visible?: boolean;
  canEditStops?: boolean;
  canToggleVisibility?: boolean;
  displayOptions: RampDisplayOptions;
  orientation: 'column' | 'row';
  canInsertBefore?: boolean;
  previousIndex?: number;
  canInsertAfter?: boolean;
  nextIndex?: number;
  onSelect?: (index: number) => void;
  onInsertBefore?: (start: number, end: number) => void;
  onInsertAfter?: (start: number, end: number) => void;
  onToggleVisibility?: (index: number) => void;
  onDelete?: (index: number) => void;
}

export function SwatchRow({
  stop,
  selected,
  anchor,
  visible = true,
  canEditStops,
  canToggleVisibility,
  displayOptions,
  orientation,
  canInsertBefore,
  previousIndex,
  canInsertAfter,
  nextIndex,
  onSelect,
  onInsertBefore,
  onInsertAfter,
  onToggleVisibility,
  onDelete,
}: SwatchRowProps) {
  const canDelete = canEditStops && !isCanonicalStop(stop.index) && !anchor;
  const hasActions = Boolean(canEditStops && (canToggleVisibility || canDelete));
  const tooltip = stop.inGamut
    ? `${stop.hex} · ${stop.cssOklch}`
    : `${stop.hex} · ${stop.cssOklch} · Out of sRGB gamut. Preview is mapped; visible invalid stops block export.`;
  const labelColor = stop.labelColor ?? readableTextColor(stop.hex);
  const metaItems = metadataForStop(stop, displayOptions);

  return (
    <div className={styles.swatchRowWrap} data-orientation={orientation}>
      {canEditStops && previousIndex !== undefined && canInsertBefore ? (
        <MidpointInsert before onInsert={() => onInsertBefore?.(previousIndex, stop.index)} />
      ) : null}
      <Tooltip content={tooltip}>
        <div
          role="button"
          tabIndex={0}
          className={styles.cardStop}
          style={{ background: stop.hex, color: labelColor }}
          data-selected={selected || anchor ? '' : undefined}
          data-hidden={!visible ? '' : undefined}
          data-has-actions={hasActions ? '' : undefined}
          onClick={() => onSelect?.(stop.index)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect?.(stop.index);
            }
          }}
        >
          <span className={styles.stopLabel}>
            <span className={styles.stopIndex}>{stop.index}</span>
            {anchor ? <Star className={styles.anchorMarker} size={12} fill="currentColor" aria-label="Anchor stop" /> : null}
            {!stop.inGamut ? <AlertTriangle className={styles.gamutMarker} size={12} aria-label="Out of gamut" /> : null}
          </span>
          {metaItems.length > 0 ? (
            <span className={styles.stopMeta}>
              {metaItems.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </span>
          ) : null}
          {hasActions ? (
            <span className={styles.cardStopActions} onClick={(event) => event.stopPropagation()}>
              {canToggleVisibility ? (
                <IconButton
                  label={visible ? 'Hide stop' : 'Show stop'}
                  icon={visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  disabled={anchor}
                  onClick={() => onToggleVisibility?.(stop.index)}
                />
              ) : null}
              {canDelete ? (
                <IconButton
                  label="Delete stop"
                  icon={<Trash2 size={13} />}
                  variant="danger"
                  onClick={() => onDelete?.(stop.index)}
                />
              ) : null}
            </span>
          ) : null}
        </div>
      </Tooltip>
      {canEditStops && nextIndex !== undefined && canInsertAfter ? (
        <MidpointInsert
          onInsert={() => onInsertAfter?.(stop.index, nextIndex)}
        />
      ) : null}
    </div>
  );
}

interface MidpointInsertProps {
  before?: boolean;
  onInsert: () => void;
}

function MidpointInsert({ before, onInsert }: MidpointInsertProps) {
  return (
    <div className={cx(styles.insertBetween, before ? styles.insertBefore : undefined)}>
      <Tooltip content="Insert midpoint stop">
        <IconButton
          label="Insert stop"
          icon={<Plus size={13} />}
          className={styles.insertButton}
          onClick={(event) => {
            onInsert();
            event.currentTarget.blur();
          }}
        />
      </Tooltip>
    </div>
  );
}

function metadataForStop(stop: GeneratedStop, options: RampDisplayOptions): string[] {
  const items: string[] = [];
  if (options.showHex) items.push(stop.hex.toUpperCase());
  if (options.showLightness) items.push(`L: ${Math.round(stop.oklch.l * 100)}`);
  if (options.showChroma) items.push(`C: ${stop.oklch.c.toFixed(3)}`);
  if (options.showHue) items.push(`H: ${Math.round(stop.oklch.h)}`);
  return items;
}
