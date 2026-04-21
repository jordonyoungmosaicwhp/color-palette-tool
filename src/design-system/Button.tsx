import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import { cx } from './utils';
import styles from './Button.module.scss';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', icon, className, children, ...props }, ref) => {
    return (
      <button ref={ref} className={cx(styles.button, styles[variant], styles[size], className)} {...props}>
        {icon ? <span className={styles.iconSlot}>{icon}</span> : null}
        <span>{children}</span>
      </button>
    );
  },
);

Button.displayName = 'Button';
