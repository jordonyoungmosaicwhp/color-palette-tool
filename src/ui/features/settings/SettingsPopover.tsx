import { Settings } from 'lucide-react';

import { IconButton, NumberField, Popover, SwitchField } from '../../../design-system';
import type { RampDisplayOptions } from '../../../features/ramp/workspaceTypes';
import styles from './SettingsPopover.module.scss';

export interface SettingsPopoverProps {
  lMax: number;
  lMin: number;
  displayOptions: RampDisplayOptions;
  onLMaxChange: (value: number) => void;
  onLMinChange: (value: number) => void;
  onDisplayOptionsChange: (value: RampDisplayOptions) => void;
}

export function SettingsPopover({
  lMax,
  lMin,
  displayOptions,
  onLMaxChange,
  onLMinChange,
  onDisplayOptionsChange,
}: SettingsPopoverProps) {
  const updateOption = (key: keyof RampDisplayOptions, value: boolean) => {
    onDisplayOptionsChange({ ...displayOptions, [key]: value });
  };

  return (
    <Popover
      title="Global settings"
      width="sm"
      trigger={<IconButton label="Open settings" icon={<Settings size={17} />} variant="ghost" size="md" />}
    >
      <div className={styles.settingsPanel}>
        <div className={styles.sectionHeading}>
          <h3>Lightness endpoints</h3>
        </div>
        <div className={styles.lightnessFields}>
          <NumberField
            label="L max"
            value={Math.round(lMax * 100)}
            min={1}
            max={100}
            step={1}
            suffix="%"
            onValueChange={(value) => onLMaxChange(value / 100)}
          />
          <NumberField
            label="L min"
            value={Math.round(lMin * 100)}
            min={0}
            max={99}
            step={1}
            suffix="%"
            onValueChange={(value) => onLMinChange(value / 100)}
          />
        </div>
        <div className={styles.settingsDivider} />
        <div className={styles.sectionHeading}>
          <h3>Visible details</h3>
        </div>
        <div className={styles.settingsToggles}>
          <SwitchField
            label="Allow hidden stops"
            checked={displayOptions.allowHiddenStops}
            onCheckedChange={(value) => updateOption('allowHiddenStops', value)}
          />
          <SwitchField label="Show hex" checked={displayOptions.showHex} onCheckedChange={(value) => updateOption('showHex', value)} />
          <SwitchField
            label="Show lightness"
            checked={displayOptions.showLightness}
            onCheckedChange={(value) => updateOption('showLightness', value)}
          />
          <SwitchField
            label="Show chroma"
            checked={displayOptions.showChroma}
            onCheckedChange={(value) => updateOption('showChroma', value)}
          />
          <SwitchField label="Show hue" checked={displayOptions.showHue} onCheckedChange={(value) => updateOption('showHue', value)} />
        </div>
      </div>
    </Popover>
  );
}
