export type StopState = 'default' | 'anchor' | 'hidden';
export type StopResolution = 100 | 50 | 25;
export type DisplayMode = 'row' | 'column';
export type StopOrigin = 'canonical' | 'user' | 'anchor';

export interface ThemeSettings {
  lMax: number;
  lMin: number;
}

export type HueRotation = 'clockwise' | 'counter';
export type CurvePreset = 'linear' | 'sine' | 'quad';
export type CurveDirection = 'easeIn' | 'easeOut' | 'easeInOut';
export type HueDirection = 'auto' | 'clockwise' | 'counterclockwise';

export interface ChromaPreset {
  start: number;
  center: number;
  end: number;
  centerPosition: number;
  startShape: number;
  endShape: number;
}

export interface CustomStopConfig {
  id: string;
  color: string;
}

export interface HuePreset {
  start: number;
  center: number;
  end: number;
  centerPosition: number;
  startShape: number;
  endShape: number;
  direction: HueDirection;
}

export interface StopConfig {
  index: number;
  resolution: StopResolution;
  state: StopState;
  origin?: StopOrigin;
}

export interface AnchorConfig {
  color: string;
  stop: number;
  resolution: StopResolution;
}

export interface RampConfig {
  name: string;
  huePreset?: HuePreset;
  chromaPreset: ChromaPreset;
  stops: StopConfig[];
  customStops?: CustomStopConfig[];
  customStopsMidpointLocked?: boolean;
  anchor?: AnchorConfig;
}

export interface PaletteConfig {
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
  custom?: boolean;
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
  table: string;
}
