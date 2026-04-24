import { round } from './oklch';
import type { OklchColor } from '../types';

export function formatOklch(color: OklchColor): string {
  return `oklch(${round(color.l * 100, 2)}% ${round(color.c, 4)} ${round(color.h, 2)})`;
}
