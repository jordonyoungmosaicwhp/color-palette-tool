import { Slider } from '@ark-ui/react/slider';
import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import styles from './InlineSliderField.module.scss';

export interface InlineSliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue?: string;
  suffix?: string;
  onValueChange: (value: number) => void;
}

export function InlineSliderField({
  label,
  value,
  min,
  max,
  step,
  displayValue,
  suffix,
  onValueChange,
}: InlineSliderFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayValue ?? String(value));

  const parsed = Number(draft);
  const shownValue = displayValue ?? String(value);
  const inputSize = Math.max(2, draft.trim().length || shownValue.length);

  function commit(nextValue: number) {
    const clamped = Math.min(max, Math.max(min, nextValue));
    onValueChange(clamped);
    setEditing(false);
  }

  function beginEditing() {
    setDraft(displayValue ?? String(value));
    setEditing(true);
  }

  function nudge(nextValue: number) {
    const clamped = Math.min(max, Math.max(min, nextValue));
    setDraft(String(clamped));
    onValueChange(clamped);
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button className={styles.labelButton} type="button" onClick={beginEditing}>
          {label}
        </button>
        {editing ? (
          <div className={styles.editor} role="group" aria-label={label}>
            <button
              className={styles.stepButton}
              type="button"
              aria-label={`Decrease ${label}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => nudge(value - step)}
            >
              <Minus size={12} />
            </button>
            <input
              className={styles.editorInput}
              type="text"
              inputMode="decimal"
              size={inputSize}
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              onBlur={() => {
                if (Number.isFinite(parsed)) {
                  commit(parsed);
                } else {
                  setDraft(displayValue ?? String(value));
                  setEditing(false);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur();
                }
                if (event.key === 'Escape') {
                  setDraft(displayValue ?? String(value));
                  setEditing(false);
                }
              }}
            />
            {suffix ? <span className={styles.suffix}>{suffix}</span> : null}
            <button
              className={styles.stepButton}
              type="button"
              aria-label={`Increase ${label}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => nudge(value + step)}
            >
              <Plus size={12} />
            </button>
          </div>
        ) : (
          <button className={styles.valueButton} type="button" onClick={beginEditing}>
            {shownValue}
            {suffix ? <span className={styles.suffix}>{suffix}</span> : null}
          </button>
        )}
      </div>
      <Slider.Root
        className={styles.sliderRoot}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(details) => onValueChange(details.value[0] ?? value)}
      >
        <Slider.Control className={styles.control}>
          <Slider.Track className={styles.track}>
            <Slider.Range className={styles.range} />
          </Slider.Track>
          <Slider.Thumb className={styles.thumb} index={0}>
            <Slider.HiddenInput />
          </Slider.Thumb>
        </Slider.Control>
      </Slider.Root>
    </div>
  );
}
