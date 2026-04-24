import { wcagContrast } from 'culori';

import { round } from './oklch';

const CANVAS_COLOR = '#f8fafc';

export function readableTextColor(hex: string): '#111111' | '#ffffff' {
  const contrastOnLight = wcagContrast(hex, '#111111');
  const contrastOnDark = wcagContrast(hex, '#ffffff');
  return contrastOnLight >= contrastOnDark ? '#111111' : '#ffffff';
}

export function contrastOnBackground(hex: string, background: string): number {
  return round(wcagContrast(hex, background), 2);
}

export function getContrastMetrics(hex: string) {
  return {
    labelColor: readableTextColor(hex),
    contrastOnWhite: contrastOnBackground(hex, '#ffffff'),
    contrastOnBlack: contrastOnBackground(hex, '#000000'),
    contrastOnCanvas: contrastOnBackground(hex, CANVAS_COLOR),
  };
}
