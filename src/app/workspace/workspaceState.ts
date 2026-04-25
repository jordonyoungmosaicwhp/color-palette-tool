import { createSeededRampConfig } from '../../lib/color';
import type { ChromaPreset } from '../../lib/color';
import { migrateCollectionToTree } from '../tree/treeMigration';
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
    children: [],
    groups: [
      {
        id: 'neutral',
        name: 'Neutral',
        ramps: [
          {
            id: 'neutral-ramp',
            name: 'Neutral',
            config: createSeededRampConfig('Neutral', '#5e5e5e', 0.02, 0.05),
          },
        ],
      },
    ],
  },
  {
    id: 'brand-collection',
    name: 'Brand Collection',
    children: [],
    groups: [
      {
        id: 'brand',
        name: 'Brand',
        ramps: [
          {
            id: 'red',
            name: 'Red',
            config: createSeededRampConfig('Red', '#C41230', 0.05, 0.18),
          },
        ],
      },
      {
        id: 'utility',
        name: 'Utility',
        ramps: [
          {
            id: 'blue',
            name: 'Blue',
            config: createSeededRampConfig('Blue', '#2563eb', 0.04, 0.16),
          },
          {
            id: 'green',
            name: 'Green',
            config: createSeededRampConfig('Green', '#16a34a', 0.04, 0.16),
          },
          {
            id: 'yellow',
            name: 'Yellow',
            config: createSeededRampConfig('Yellow', '#ca8a04', 0.04, 0.16),
          },
          {
            id: 'orange',
            name: 'Orange',
            config: createSeededRampConfig('Orange', '#ea580c', 0.04, 0.16),
          },
        ],
      },
    ],
  },
];

export const initialCollections: WorkspaceCollection[] = baseInitialCollections.map(migrateCollectionToTree);

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
