import { Collapsible as ArkCollapsible } from '@ark-ui/react/collapsible';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './Collapsible.module.scss';

export interface CollapsibleProps {
  title: string;
  eyebrow?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function Collapsible({ title, eyebrow, defaultOpen = false, open, onOpenChange, children }: CollapsibleProps) {
  return (
    <ArkCollapsible.Root
      className={styles.root}
      defaultOpen={defaultOpen}
      open={open}
      onOpenChange={onOpenChange ? (details) => onOpenChange(details.open) : undefined}
    >
      <ArkCollapsible.Trigger className={styles.trigger}>
        <span>
          {eyebrow ? <small>{eyebrow}</small> : null}
          <strong>{title}</strong>
        </span>
        <ArkCollapsible.Indicator className={styles.indicator}>
          <ChevronDown size={16} />
        </ArkCollapsible.Indicator>
      </ArkCollapsible.Trigger>
      <ArkCollapsible.Content className={styles.content}>{children}</ArkCollapsible.Content>
    </ArkCollapsible.Root>
  );
}
