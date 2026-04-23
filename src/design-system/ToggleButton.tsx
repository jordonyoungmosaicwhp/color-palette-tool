import { Toggle } from '@ark-ui/react/toggle';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import { cx } from './utils';
import styles from './Button.module.scss';

export interface ToggleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  icon: ReactNode;
  variant?: 'secondary' | 'ghost' | 'danger' | 'primary';
  size?: 'sm' | 'md';
  layout?: 'icon' | 'inline';
}

export const ToggleButton = forwardRef<HTMLButtonElement, ToggleButtonProps>(
  (
    { label, pressed, onPressedChange, icon, variant = 'ghost', size = 'sm', layout = 'icon', className, type, onClick, disabled, ...props },
    ref,
  ) => {
    return (
      <Toggle.Root
        ref={ref}
        aria-label={label}
        title={label}
        pressed={pressed}
        disabled={disabled}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented && !disabled) {
            onPressedChange(!pressed);
          }
        }}
        className={cx(styles.iconButton, styles[variant], styles[size], layout === 'inline' && styles.inline, className)}
        type={type ?? 'button'}
        {...props}
      >
        {icon}
      </Toggle.Root>
    );
  },
);

ToggleButton.displayName = 'ToggleButton';
