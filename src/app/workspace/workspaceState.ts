import { createSeededRampConfig } from '../../lib/color';
import type { ChromaPreset } from '../../lib/color';
import type { RampDisplayOptions, WorkspaceCollection } from '../../features/ramp/workspaceTypes';

export type WorkspaceUiTheme = 'light' | 'dark';

export type WorkspaceAccordionSection = 'hue' | 'chroma' | 'customStops' | null;

export interface CopiedChromaState {
  sourceRampId: string;
  preset: ChromaPreset;
}

export interface WorkspaceViewState {
  collections: WorkspaceCollection[];
  activeCollectionId: string;
  expandedCollectionIds: string[];
  selectedRampId: string;
  sidebarCollapsed: boolean;
  inspectorOpen: boolean;
  uiTheme: WorkspaceUiTheme;
  importOpen: boolean;
  importDraft: string;
  importError: string | null;
  displayOptions: RampDisplayOptions;
  accordionSection: WorkspaceAccordionSection;
  copied: boolean;
  copiedChroma: CopiedChromaState | null;
  moveAnnouncement: string;
  pendingCustomStopFocusId: string | null;
}

const baseInitialCollections: WorkspaceCollection[] = [
  {
    id: 'core',
    name: 'Core',
    children: [
      {
        type: 'ramp',
        id: 'neutral-ramp',
        ramp: {
          id: 'neutral-ramp',
          name: 'Neutral',
          config: createSeededRampConfig('Neutral', '#5e5e5e', 0, 0),
        },
      },
    ],
  },
  {
    id: 'brand-collection',
    name: 'Brand Collection',
    children: [
      {
        type: 'group',
        id: 'brand',
        group: {
          id: 'brand',
          name: 'Brand',
          ramps: [
            {
              id: 'red',
              name: 'Red',
              config: {
                ...createSeededRampConfig('Red', '#C41230', 0.05, 0.18),
                huePreset: {
                  start: 21.59,
                  center: 21.59,
                  end: 21.59,
                  centerPosition: 0.5,
                  startShape: 0,
                  endShape: 0,
                  startDirection: 'auto',
                  endDirection: 'auto',
                },
                chromaPreset: {
                  start: 0.05,
                  center: 0.115,
                  end: 0.18,
                  centerPosition: 0.5,
                  startShape: 0,
                  endShape: 0,
                },
              },
            },
            {
              id: 'cereal',
              name: 'Cereal',
              config: {
                ...createSeededRampConfig('Cereal', '#EBE5DE', 0.0115, 0.02),
                huePreset: {
                  start: 71.89,
                  center: 71.89,
                  end: 90,
                  centerPosition: 0.5,
                  startShape: 0,
                  endShape: 0,
                  startDirection: 'auto',
                  endDirection: 'auto',
                },
                chromaPreset: {
                  start: 0.0115,
                  center: 0.0158,
                  end: 0.02,
                  centerPosition: 0.5,
                  startShape: 0,
                  endShape: 0,
                },
                customStops: [{ id: 'custom-stop-1', color: '#EBE5DE' }],
                customStopsMidpointLocked: true,
              },
            },
          ],
        },
      },
      {
        type: 'group',
        id: 'utility',
        group: {
          id: 'utility',
          name: 'Utility',
          ramps: [
            {
              id: 'blue',
              name: 'Blue',
              config: {
                ...createSeededRampConfig('Blue', '#2563eb', 0.04, 0.16),
                huePreset: {
                  start: 262.88,
                  center: 262.88,
                  end: 262.88,
                  centerPosition: 0.5,
                  startShape: 0,
                  endShape: 0,
                  startDirection: 'auto',
                  endDirection: 'auto',
                },
                chromaPreset: {
                  start: 0.04,
                  center: 0.1,
                  end: 0.16,
                  centerPosition: 0.5,
                  startShape: 0,
                  endShape: 0,
                },
              },
            },
            {
              id: 'green',
              name: 'Green',
              config: {
                ...createSeededRampConfig('Green', '#16a34a', 0.04, 0.16),
                huePreset: {
                  start: 149.21,
                  center: 149.21,
                  end: 149.21,
                  centerPosition: 0.5,
                  startShape: 0,
                  endShape: 0,
                  startDirection: 'auto',
                  endDirection: 'auto',
                },
                chromaPreset: {
                  start: 0.04,
                  center: 0.1,
                  end: 0.16,
                  centerPosition: 0.5,
                  startShape: 0,
                  endShape: 0,
                },
              },
            },
            {
              id: 'yellow',
              name: 'Yellow',
              config: {
                ...createSeededRampConfig('Yellow', '#ca8a04', 0.04, 0.16),
                huePreset: {
                  start: 75.83,
                  center: 75.83,
                  end: 75.83,
                  centerPosition: 0.5,
                  startShape: 0,
                  endShape: 0,
                  startDirection: 'auto',
                  endDirection: 'auto',
                },
                chromaPreset: {
                  start: 0.04,
                  center: 0.1,
                  end: 0.16,
                  centerPosition: 0.5,
                  startShape: 0,
                  endShape: 0,
                },
              },
            },
            {
              id: 'orange',
              name: 'Orange',
              config: {
                ...createSeededRampConfig('Orange', '#ea580c', 0.04, 0.16),
                huePreset: {
                  start: 41.12,
                  center: 41.12,
                  end: 41.12,
                  centerPosition: 0.5,
                  startShape: 0,
                  endShape: 0,
                  startDirection: 'auto',
                  endDirection: 'auto',
                },
                chromaPreset: {
                  start: 0.04,
                  center: 0.1,
                  end: 0.16,
                  centerPosition: 0.5,
                  startShape: 0,
                  endShape: 0,
                },
              },
            },
          ],
        },
      },
    ],
  },
];

export const initialCollections: WorkspaceCollection[] = baseInitialCollections;

export const initialDisplayOptions: RampDisplayOptions = {
  allowHiddenStops: true,
  showHex: false,
  showLightness: false,
  showChroma: false,
  showHue: false,
};

export const initialWorkspaceViewState: WorkspaceViewState = {
  collections: initialCollections,
  activeCollectionId: 'core',
  expandedCollectionIds: ['core'],
  selectedRampId: 'red',
  sidebarCollapsed: false,
  inspectorOpen: true,
  uiTheme: 'light',
  importOpen: false,
  importDraft: '',
  importError: null,
  displayOptions: initialDisplayOptions,
  accordionSection: 'hue',
  copied: false,
  copiedChroma: null,
  moveAnnouncement: '',
  pendingCustomStopFocusId: null,
};
