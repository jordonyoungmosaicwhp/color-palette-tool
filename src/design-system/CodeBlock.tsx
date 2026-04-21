import type { HTMLAttributes } from 'react';
import { cx } from './utils';
import styles from './CodeBlock.module.scss';

export interface CodeBlockProps extends HTMLAttributes<HTMLPreElement> {
  value: string;
}

export function CodeBlock({ value, className, ...props }: CodeBlockProps) {
  return (
    <pre className={cx(styles.codeBlock, className)} {...props}>
      <code>{value}</code>
    </pre>
  );
}
