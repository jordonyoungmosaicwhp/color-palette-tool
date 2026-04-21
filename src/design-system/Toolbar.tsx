import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './utils';
import styles from './Toolbar.module.scss';

export interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Toolbar({ className, children, ...props }: ToolbarProps) {
  return (
    <div className={cx(styles.toolbar, className)} {...props}>
      {children}
    </div>
  );
}
