import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './utils';
import styles from './Panel.module.scss';

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function Panel({ title, eyebrow, action, className, children, ...props }: PanelProps) {
  return (
    <section className={cx(styles.panel, className)} {...props}>
      {title || action ? (
        <header className={styles.header}>
          <div>
            {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
            {title ? <h2>{title}</h2> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}
