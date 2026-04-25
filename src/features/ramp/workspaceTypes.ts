import type { RampConfig } from '../../lib/color';
import type { WorkspaceNode } from '../../app/tree/treeTypes';

export interface RampDisplayOptions {
  allowHiddenStops: boolean;
  showHex: boolean;
  showLightness: boolean;
  showChroma: boolean;
  showHue: boolean;
}

export interface WorkspaceRamp {
  id: string;
  name: string;
  config: RampConfig;
}

export interface WorkspaceGroup {
  id: string;
  name: string;
  ramps: WorkspaceRamp[];
}

export interface WorkspaceCollection {
  id: string;
  name: string;
  children: WorkspaceNode[];
}
