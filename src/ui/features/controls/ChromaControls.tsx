import { Lock } from 'lucide-react';

import { InlineSliderField, ToggleButton } from '../../../design-system';
import type { ChromaPreset } from '../../../lib/color';
import styles from './ChromaControls.module.scss';

export interface ChromaControlsProps {
  preset: ChromaPreset;
  customStopCount: number;
  midpointLocked: boolean;
  onChange: (value: Partial<ChromaPreset>) => void;
  onMidpointLockChange: (value: boolean) => void;
}

export function ChromaControls({ preset, customStopCount, midpointLocked, onChange, onMidpointLockChange }: ChromaControlsProps) {
  const midpointHelp =
    customStopCount === 0
      ? null
      : midpointLocked
        ? customStopCount === 1
          ? 'This custom stop defines the midpoint while locked.'
          : 'Midpoint is locked while custom stops define the ramp shape.'
        : 'Midpoint is unlocked and participates as an interior control point.';

  return (
    <div className={styles.chromaControls}>
      <fieldset className={styles.chromaFieldset}>
        <legend>Start</legend>
        <div className={styles.chromaFieldsetControls}>
          <InlineSliderField
            label="Chroma"
            value={preset.start}
            min={0}
            max={0.5}
            step={0.001}
            displayValue={preset.start.toFixed(3)}
            onValueChange={(value) => onChange({ start: value })}
          />
          <InlineSliderField
            label="Shape"
            value={preset.startShape}
            min={0}
            max={1}
            step={0.01}
            displayValue={preset.startShape.toFixed(2)}
            onValueChange={(value) => onChange({ startShape: value })}
          />
        </div>
      </fieldset>
      <fieldset className={styles.chromaFieldset}>
        <legend className={styles.chromaFieldsetLegend}>
          <span>Midpoint</span>
          <span className={styles.chromaFieldsetDivider} aria-hidden="true" />
          {customStopCount > 0 ? (
            <ToggleButton
              label={midpointLocked ? 'Unlock midpoint' : 'Lock midpoint'}
              pressed={midpointLocked}
              variant="ghost"
              size="md"
              layout="inline"
              icon={<Lock size={14} />}
              onPressedChange={onMidpointLockChange}
            />
          ) : null}
        </legend>
        {midpointHelp ? <p className={styles.chromaFieldsetHint}>{midpointHelp}</p> : null}
        <div className={styles.chromaFieldsetControls}>
          <InlineSliderField
            label="Chroma"
            value={preset.center}
            min={0}
            max={0.5}
            step={0.001}
            displayValue={preset.center.toFixed(3)}
            readOnly={midpointLocked}
            disabled={midpointLocked}
            onValueChange={(value) => onChange({ center: value })}
          />
          <InlineSliderField
            label="Position"
            value={preset.centerPosition}
            min={0}
            max={1}
            step={0.01}
            displayValue={Math.round(preset.centerPosition * 100).toString()}
            suffix="%"
            readOnly={midpointLocked}
            disabled={midpointLocked}
            onValueChange={(value) => onChange({ centerPosition: value })}
          />
        </div>
      </fieldset>
      <fieldset className={styles.chromaFieldset}>
        <legend>End</legend>
        <div className={styles.chromaFieldsetControls}>
          <InlineSliderField
            label="Chroma"
            value={preset.end}
            min={0}
            max={0.5}
            step={0.001}
            displayValue={preset.end.toFixed(3)}
            onValueChange={(value) => onChange({ end: value })}
          />
          <InlineSliderField
            label="Shape"
            value={preset.endShape}
            min={0}
            max={1}
            step={0.01}
            displayValue={preset.endShape.toFixed(2)}
            onValueChange={(value) => onChange({ endShape: value })}
          />
        </div>
      </fieldset>
    </div>
  );
}
