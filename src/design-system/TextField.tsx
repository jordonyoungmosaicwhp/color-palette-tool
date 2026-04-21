import type { InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import { cx } from './utils';
import styles from './Field.module.scss';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, hint, error, className, id, ...props }, ref) => {
    const inputId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');

    return (
      <label className={styles.field} htmlFor={inputId}>
        <span className={styles.label}>{label}</span>
        <input ref={ref} id={inputId} className={cx(styles.input, className)} aria-invalid={Boolean(error)} {...props} />
        {hint ? <span className={styles.hint}>{hint}</span> : null}
        {error ? <span className={styles.error}>{error}</span> : null}
      </label>
    );
  },
);

TextField.displayName = 'TextField';
