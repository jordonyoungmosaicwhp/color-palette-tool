import { Popover as ArkPopover } from '@ark-ui/react/popover';
import { Portal } from '@ark-ui/react/portal';
import type { ReactElement, ReactNode } from 'react';
import styles from './Popover.module.scss';

export interface PopoverProps {
  title?: string;
  trigger: ReactElement;
  children: ReactNode;
  width?: 'sm' | 'md';
}

export function Popover({ title, trigger, children, width = 'md' }: PopoverProps) {
  return (
    <ArkPopover.Root positioning={{ placement: 'bottom-end', gutter: 8 }}>
      <ArkPopover.Trigger asChild>{trigger}</ArkPopover.Trigger>
      <Portal>
        <ArkPopover.Positioner>
          <ArkPopover.Content className={styles.content} data-width={width}>
            {title ? <ArkPopover.Title className={styles.title}>{title}</ArkPopover.Title> : null}
            <div className={styles.body}>{children}</div>
          </ArkPopover.Content>
        </ArkPopover.Positioner>
      </Portal>
    </ArkPopover.Root>
  );
}
