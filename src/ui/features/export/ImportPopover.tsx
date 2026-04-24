import { Download } from 'lucide-react';

import { Button, Popover, TextAreaField } from '../../../design-system';
import styles from './ImportPopover.module.scss';

export interface ImportPopoverProps {
  open: boolean;
  value: string;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onValueChange: (value: string) => void;
  onApply: () => void;
}

export function ImportPopover({ open, value, error, onOpenChange, onValueChange, onApply }: ImportPopoverProps) {
  return (
    <Popover
      title="Import palette data"
      width="lg"
      open={open}
      onOpenChange={(details) => onOpenChange(details.open)}
      trigger={
        <Button size="sm" variant="secondary" icon={<Download size={14} />}>
          Import
        </Button>
      }
    >
      <div className={styles.importPanel}>
        <TextAreaField
          label="Palette JSON"
          value={value}
          placeholder="Paste exported palette JSON here"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          onChange={(event) => onValueChange(event.currentTarget.value)}
        />
        {error ? <div className={styles.validationCallout} role="alert">{error}</div> : null}
        <div className={styles.importActions}>
          <Button size="sm" variant="primary" onClick={onApply}>
            Apply
          </Button>
        </div>
      </div>
    </Popover>
  );
}
