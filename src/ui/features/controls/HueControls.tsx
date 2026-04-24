import { Lock } from 'lucide-react';

import { InlineSliderField, SegmentedControl, ToggleButton } from '../../../design-system';
import type { HueDirection, HuePreset } from '../../../lib/color';
import styles from './HueControls.module.scss';

export interface HueControlsProps {
  preset: HuePreset;
  customStopCount: number;
  midpointLocked: boolean;
  onChange: (value: Partial<HuePreset>) => void;
  onMidpointLockChange: (value: boolean) => void;
}

export function HueControls({ preset, customStopCount, midpointLocked, onChange, onMidpointLockChange }: HueControlsProps) {
  const midpointHelp =
    customStopCount === 0
      ? null
      : midpointLocked
        ? customStopCount === 1
          ? 'This custom stop defines the midpoint while locked.'
          : 'Midpoint is locked while custom stops define the ramp shape.'
        : 'Midpoint is unlocked and participates as an interior control point.';

  return (
    <div className={styles.hueControls}>
      <fieldset className={styles.chromaFieldset}>
        <legend>Start</legend>
        <div className={styles.chromaFieldsetControls}>
          <InlineSliderField
            label="Hue"
            value={Math.round(preset.start)}
            min={0}
            max={360}
            step={1}
            displayValue={String(Math.round(preset.start))}
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
            label="Hue"
            value={Math.round(preset.center)}
            min={0}
            max={360}
            step={1}
            displayValue={String(Math.round(preset.center))}
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
            label="Hue"
            value={Math.round(preset.end)}
            min={0}
            max={360}
            step={1}
            displayValue={String(Math.round(preset.end))}
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
      <fieldset className={styles.chromaFieldset}>
        <legend>Direction</legend>
        <div className={styles.hueDirectionFieldset}>
          <div className={styles.hueDirectionControl}>
            <div className={styles.hueDirectionLabel}>Start</div>
            <SegmentedControl<HueDirection>
              label="Hue start direction"
              value={preset.startDirection}
              items={[
                { value: 'auto', label: 'Auto' },
                { value: 'clockwise', label: 'Clockwise' },
                { value: 'counterclockwise', label: 'Counterclockwise' },
              ]}
              onValueChange={(value) => onChange({ startDirection: value })}
            />
          </div>
          <div className={styles.hueDirectionControl}>
            <div className={styles.hueDirectionLabel}>End</div>
            <SegmentedControl<HueDirection>
              label="Hue end direction"
              value={preset.endDirection}
              items={[
                { value: 'auto', label: 'Auto' },
                { value: 'clockwise', label: 'Clockwise' },
                { value: 'counterclockwise', label: 'Counterclockwise' },
              ]}
              onValueChange={(value) => onChange({ endDirection: value })}
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
