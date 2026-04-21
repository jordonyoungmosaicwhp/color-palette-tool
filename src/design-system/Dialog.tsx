import { Dialog as ArkDialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import { X } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { IconButton } from './IconButton';
import styles from './Dialog.module.scss';

export interface DialogProps {
  title: string;
  trigger: ReactElement;
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ title, trigger, children, footer }: DialogProps) {
  return (
    <ArkDialog.Root>
      <ArkDialog.Trigger asChild>{trigger}</ArkDialog.Trigger>
      <Portal>
        <ArkDialog.Backdrop className={styles.backdrop} />
        <ArkDialog.Positioner className={styles.positioner}>
          <ArkDialog.Content className={styles.content}>
            <header className={styles.header}>
              <ArkDialog.Title className={styles.title}>{title}</ArkDialog.Title>
              <ArkDialog.CloseTrigger asChild>
                <IconButton label="Close dialog" icon={<X size={16} />} />
              </ArkDialog.CloseTrigger>
            </header>
            <div className={styles.body}>{children}</div>
            {footer ? <footer className={styles.footer}>{footer}</footer> : null}
          </ArkDialog.Content>
        </ArkDialog.Positioner>
      </Portal>
    </ArkDialog.Root>
  );
}
