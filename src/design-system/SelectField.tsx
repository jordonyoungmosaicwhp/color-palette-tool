import { Portal } from '@ark-ui/react/portal';
import { Select, createListCollection } from '@ark-ui/react/select';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useMemo } from 'react';
import styles from './SelectField.module.scss';

export interface SelectItem<TValue extends string> {
  value: TValue;
  label: string;
}

export interface SelectFieldProps<TValue extends string> {
  label: string;
  value: TValue;
  items: Array<SelectItem<TValue>>;
  onValueChange: (value: TValue) => void;
}

export function SelectField<TValue extends string>({ label, value, items, onValueChange }: SelectFieldProps<TValue>) {
  const collection = useMemo(() => createListCollection({ items }), [items]);

  return (
    <Select.Root
      className={styles.root}
      collection={collection}
      value={[value]}
      onValueChange={(details) => {
        const nextValue = details.value[0];
        if (nextValue) onValueChange(nextValue as TValue);
      }}
    >
      <Select.Label className={styles.label}>{label}</Select.Label>
      <Select.Control className={styles.control}>
        <Select.Trigger className={styles.trigger}>
          <Select.ValueText placeholder="Select" />
          <ChevronsUpDown size={14} />
        </Select.Trigger>
      </Select.Control>
      <Portal>
        <Select.Positioner>
          <Select.Content className={styles.content}>
            {collection.items.map((item) => (
              <Select.Item key={item.value} item={item} className={styles.item}>
                <Select.ItemText>{item.label}</Select.ItemText>
                <Select.ItemIndicator className={styles.itemIndicator}>
                  <Check size={14} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Portal>
      <Select.HiddenSelect />
    </Select.Root>
  );
}
