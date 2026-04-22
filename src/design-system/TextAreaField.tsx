import type { TextareaHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import { cx } from './utils';
import styles from './Field.module.scss';

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ label, hint, error, className, id, rows = 10, ...props }, ref) => {
    const inputId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');

    return (
      <label className={styles.field} htmlFor={inputId}>
        <span className={styles.label}>{label}</span>
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          className={cx(styles.input, styles.textarea, className)}
          aria-invalid={Boolean(error)}
          {...props}
        />
        {hint ? <span className={styles.hint}>{hint}</span> : null}
        {error ? <span className={styles.error}>{error}</span> : null}
      </label>
    );
  },
);

TextAreaField.displayName = 'TextAreaField';
