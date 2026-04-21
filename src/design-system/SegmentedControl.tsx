import { SegmentGroup } from '@ark-ui/react/segment-group';
import type { ReactNode } from 'react';
import styles from './SegmentedControl.module.scss';

export interface SegmentItem<TValue extends string> {
  value: TValue;
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<TValue extends string> {
  value: TValue;
  items: Array<SegmentItem<TValue>>;
  label: string;
  onValueChange: (value: TValue) => void;
}

export function SegmentedControl<TValue extends string>({
  value,
  items,
  label,
  onValueChange,
}: SegmentedControlProps<TValue>) {
  return (
    <SegmentGroup.Root
      className={styles.root}
      value={value}
      aria-label={label}
      onValueChange={(details) => {
        if (details.value) onValueChange(details.value as TValue);
      }}
    >
      <SegmentGroup.Indicator className={styles.indicator} />
      {items.map((item) => (
        <SegmentGroup.Item key={item.value} value={item.value} disabled={item.disabled} className={styles.item}>
          <SegmentGroup.ItemControl className={styles.itemControl} />
          <SegmentGroup.ItemText className={styles.itemText}>{item.label}</SegmentGroup.ItemText>
          <SegmentGroup.ItemHiddenInput />
        </SegmentGroup.Item>
      ))}
    </SegmentGroup.Root>
  );
}
