import { Slider } from '@ark-ui/react/slider';
import styles from './SliderField.module.scss';

export interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue?: string;
  onValueChange: (value: number) => void;
}

export function SliderField({ label, value, min, max, step, displayValue, onValueChange }: SliderFieldProps) {
  return (
    <Slider.Root
      className={styles.root}
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(details) => onValueChange(details.value[0] ?? value)}
    >
      <div className={styles.header}>
        <Slider.Label className={styles.label}>{label}</Slider.Label>
        <span className={styles.value}>{displayValue ?? value}</span>
      </div>
      <Slider.Control className={styles.control}>
        <Slider.Track className={styles.track}>
          <Slider.Range className={styles.range} />
        </Slider.Track>
        <Slider.Thumb className={styles.thumb} index={0}>
          <Slider.HiddenInput />
        </Slider.Thumb>
      </Slider.Control>
    </Slider.Root>
  );
}
