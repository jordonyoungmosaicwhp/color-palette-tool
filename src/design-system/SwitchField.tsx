import { Switch } from '@ark-ui/react/switch';
import styles from './SwitchField.module.scss';

export interface SwitchFieldProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function SwitchField({ label, checked, onCheckedChange }: SwitchFieldProps) {
  return (
    <Switch.Root className={styles.root} checked={checked} onCheckedChange={(details) => onCheckedChange(details.checked)}>
      <Switch.Control className={styles.control}>
        <Switch.Thumb className={styles.thumb} />
      </Switch.Control>
      <Switch.Label className={styles.label}>{label}</Switch.Label>
      <Switch.HiddenInput />
    </Switch.Root>
  );
}
