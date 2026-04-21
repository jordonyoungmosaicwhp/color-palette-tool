import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './utils';
import styles from './Badge.module.scss';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
  children: ReactNode;
}

export function Badge({ tone = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[tone], className)} {...props}>
      {children}
    </span>
  );
}
