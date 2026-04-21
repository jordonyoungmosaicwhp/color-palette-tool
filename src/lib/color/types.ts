export type StopState = 'default' | 'anchor' | 'hidden';
export type StopResolution = 100 | 50 | 25;
export type DisplayMode = 'row' | 'column';

export interface ThemeSettings {
  lMax: number;
  lMin: number;
}

export type HueRotation = 'clockwise' | 'counter';
export type CurvePreset = 'linear' | 'sine' | 'quad' | 'cubic' | 'quart' | 'quint' | 'expo' | 'circ' | 'back';
export type CurveDirection = 'easeIn' | 'easeOut' | 'easeInOut';

export interface ChromaPreset {
  type: 'range';
  start: number;
  end: number;
  rate: number;
  curve: CurvePreset;
  direction: CurveDirection;
}

export type HuePreset =
  | {
      type: 'constant';
      hue: number;
    }
  | {
      type: 'range';
      start: number;
      end: number;
      rotation: HueRotation;
      curve: CurvePreset;
      direction: CurveDirection;
    };

export interface StopConfig {
  index: number;
  resolution: StopResolution;
  state: StopState;
}

export interface AnchorConfig {
  color: string;
  stop: number;
  resolution: StopResolution;
}

export interface RampConfig {
  version: 1;
  name: string;
  hue: number;
  huePreset?: HuePreset;
  chromaPreset: ChromaPreset;
  stops: StopConfig[];
  anchor?: AnchorConfig;
}

export interface PaletteConfig {
  version: 1;
  theme: ThemeSettings;
  ramp: RampConfig;
  displayMode: DisplayMode;
}

export interface OklchColor {
  mode: 'oklch';
  l: number;
  c: number;
  h: number;
  alpha?: number;
}

export interface GeneratedStop {
  index: number;
  resolution: StopResolution;
  state: StopState;
  visible: boolean;
  oklch: OklchColor;
  cssOklch: string;
  hex: string;
  inGamut: boolean;
  labelColor: '#111111' | '#ffffff';
  contrastOnWhite: number;
  contrastOnBlack: number;
  contrastOnCanvas: number;
}

export interface ValidationResult {
  hasBlockingIssues: boolean;
  blockingStops: number[];
  warningStops: number[];
}

export interface ExportBundle {
  cssVariables: string;
  jsonConfig: string;
  table: string;
}
