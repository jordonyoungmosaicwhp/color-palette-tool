import { NumberInput } from '@ark-ui/react/number-input';
import { ChevronDown, ChevronUp } from 'lucide-react';
import styles from './Field.module.scss';

export interface NumberFieldProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onValueChange: (value: number) => void;
}

export function NumberField({ label, value, min, max, step = 1, suffix, onValueChange }: NumberFieldProps) {
  return (
    <NumberInput.Root
      className={styles.numberRoot}
      value={String(value)}
      min={min}
      max={max}
      step={step}
      onValueChange={(details) => {
        if (Number.isFinite(details.valueAsNumber)) onValueChange(details.valueAsNumber);
      }}
    >
      <NumberInput.Label className={styles.label}>{label}</NumberInput.Label>
      <div className={styles.numberControl}>
        <NumberInput.Input className={styles.input} />
        {suffix ? <span className={styles.suffix}>{suffix}</span> : null}
        <div className={styles.steppers}>
          <NumberInput.IncrementTrigger className={styles.stepper} aria-label={`Increase ${label}`}>
            <ChevronUp size={12} />
          </NumberInput.IncrementTrigger>
          <NumberInput.DecrementTrigger className={styles.stepper} aria-label={`Decrease ${label}`}>
            <ChevronDown size={12} />
          </NumberInput.DecrementTrigger>
        </div>
      </div>
    </NumberInput.Root>
  );
}
