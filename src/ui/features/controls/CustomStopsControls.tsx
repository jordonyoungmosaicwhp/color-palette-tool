import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Badge, Button, IconButton, TextField } from '../../../design-system';
import { sortCustomStopsByIndex, tryCustomStopIndex } from '../../../lib/color';
import type { CustomStopConfig, ThemeSettings } from '../../../lib/color';
import styles from './CustomStopsControls.module.scss';

export interface CustomStopsControlsProps {
  theme: ThemeSettings;
  customStops: CustomStopConfig[];
  collisions: number[];
  focusStopId: string | null;
  onFocusStopIdConsumed: () => void;
  onAddStop: () => void;
  onUpdateStop: (stopId: string, color: string) => void;
  onDeleteStop: (stopId: string) => void;
}

export function CustomStopsControls({
  theme,
  customStops,
  collisions,
  focusStopId,
  onFocusStopIdConsumed,
  onAddStop,
  onUpdateStop,
  onDeleteStop,
}: CustomStopsControlsProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const hexInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const colorInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- local draft state must stay aligned with externally edited stops.
    setDrafts((current) => {
      const next: Record<string, string> = {};
      for (const stop of customStops) {
        next[stop.id] = current[stop.id] ?? stop.color;
      }
      return next;
    });
  }, [customStops]);

  useEffect(() => {
    if (!focusStopId) return;

    const focusTarget = hexInputRefs.current[focusStopId];
    if (!focusTarget) return;

    focusTarget.focus();
    focusTarget.select();
    onFocusStopIdConsumed();
  }, [focusStopId, customStops, onFocusStopIdConsumed]);

  const sortedStops = sortCustomStopsByIndex(customStops, theme);
  const collisionSet = new Set(collisions);

  return (
    <div className={styles.customStopsControls}>
      {collisions.length > 0 ? (
        <div className={styles.validationCallout} role="alert">
          Multiple custom stops resolve to the same calculated stop: {collisions.join(', ')}.
        </div>
      ) : null}
      {sortedStops.length > 0 ? (
        <div className={styles.customStopsList}>
          {sortedStops.map((stop) => {
            const draft = drafts[stop.id] ?? stop.color;
            const normalized = normalizeAnchorInput(draft);
            const displayColor = normalized ?? stop.color;
            const index = tryCustomStopIndex(displayColor, theme);
            return (
              <div
                key={stop.id}
                className={styles.customStopCard}
                data-invalid={index !== null && collisionSet.has(index) ? '' : undefined}
                data-pending={!normalized ? '' : undefined}
                onBlurCapture={(event) => {
                  const relatedTarget = event.relatedTarget;
                  if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return;

                  const nextHex = normalizeAnchorInput(draft);
                  if (nextHex) {
                    setDrafts((current) => ({ ...current, [stop.id]: nextHex }));
                    if (nextHex !== stop.color) onUpdateStop(stop.id, nextHex);
                    return;
                  }

                  if (!stop.color) {
                    onDeleteStop(stop.id);
                    return;
                  }

                  setDrafts((current) => ({ ...current, [stop.id]: stop.color }));
                }}
              >
                <div className={styles.customStopHeader}>
                  <span className={styles.customStopTitle}>Stop</span>
                  <Badge tone={index !== null && collisionSet.has(index) ? 'warning' : normalized ? 'accent' : 'neutral'}>
                    {index ?? 'Draft'}
                  </Badge>
                  <IconButton label="Delete stop" icon={<Trash2 size={14} />} variant="ghost" onClick={() => onDeleteStop(stop.id)} />
                </div>
                <div className={styles.customStopFields}>
                  <label className={styles.customStopColorField}>
                    <span>Color</span>
                    <div className={styles.customStopColorControl}>
                      <button
                        type="button"
                        className={styles.customStopColorButton}
                        data-empty={!normalized ? '' : undefined}
                        style={normalized ? { background: normalized } : undefined}
                        onClick={() => colorInputRefs.current[stop.id]?.click()}
                      >
                        {!normalized ? <span className={styles.customStopColorPlaceholder}>Pick</span> : null}
                      </button>
                      <input
                        ref={(element) => {
                          colorInputRefs.current[stop.id] = element;
                        }}
                        className={styles.customStopColorPicker}
                        type="color"
                        value={normalized ?? '#ffffff'}
                        aria-hidden="true"
                        tabIndex={-1}
                        onChange={(event) => {
                          const next = event.currentTarget.value;
                          setDrafts((current) => ({ ...current, [stop.id]: next }));
                          onUpdateStop(stop.id, next);
                        }}
                      />
                    </div>
                  </label>
                  <TextField
                    ref={(element) => {
                      hexInputRefs.current[stop.id] = element;
                    }}
                    label="Hex"
                    value={draft}
                    placeholder="#RRGGBB"
                    onChange={(event) => {
                      const next = event.currentTarget.value;
                      setDrafts((current) => ({ ...current, [stop.id]: next }));
                      const nextHex = normalizeAnchorInput(next);
                      if (nextHex) onUpdateStop(stop.id, nextHex);
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.customStopsEmpty}>No custom stops yet. Add one to start experimenting.</div>
      )}
      <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={onAddStop}>
        Add Stop
      </Button>
    </div>
  );
}

function normalizeAnchorInput(value: string): string | null {
  const cleaned = value.trim().replace(/^#+/, '').toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(cleaned)) return null;
  return `#${cleaned}`;
}
