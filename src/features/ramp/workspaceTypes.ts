import type { RampConfig } from '../../lib/color';

export interface WorkspaceRamp {
  id: string;
  name: string;
  config: RampConfig;
}

export interface PaletteGroup {
  id: string;
  name: string;
  ramps: WorkspaceRamp[];
}
