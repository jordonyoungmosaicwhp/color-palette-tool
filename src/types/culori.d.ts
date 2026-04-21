declare module 'culori' {
  export interface Color {
    mode: string;
    l?: number;
    c?: number;
    h?: number;
    r?: number;
    g?: number;
    b?: number;
    alpha?: number;
  }

  export type Converter = (color: string | Color) => Color | undefined;

  export function converter(mode: string): Converter;
  export function displayable(color: string | Color): boolean;
  export function formatHex(color: string | Color): string;
  export function wcagContrast(color1: string | Color, color2: string | Color): number;
}
