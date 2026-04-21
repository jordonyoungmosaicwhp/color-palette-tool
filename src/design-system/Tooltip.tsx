import { Tooltip as ArkTooltip } from '@ark-ui/react/tooltip';
import { Portal } from '@ark-ui/react/portal';
import type { ReactElement, ReactNode } from 'react';
import styles from './Tooltip.module.scss';

export interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <ArkTooltip.Root openDelay={250} closeDelay={100}>
      <ArkTooltip.Trigger asChild>{children}</ArkTooltip.Trigger>
      <Portal>
        <ArkTooltip.Positioner>
          <ArkTooltip.Content className={styles.content}>{content}</ArkTooltip.Content>
        </ArkTooltip.Positioner>
      </Portal>
    </ArkTooltip.Root>
  );
}
