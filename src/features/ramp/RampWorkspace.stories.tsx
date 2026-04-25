import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { createSeededRampConfig, generateRamp } from '../../lib/color';
import type { ThemeSettings } from '../../lib/color';
import { PaletteGroupSection } from './components/PaletteGroupSection';
import { PaletteSidebar } from './components/PaletteSidebar';
import { RampCard } from './components/RampCard';
import { RampWorkspace } from './RampWorkspace';
import type { RampDisplayOptions, WorkspaceCollection, WorkspaceGroup, WorkspaceRamp } from './workspaceTypes';
import styles from './RampWorkspace.module.scss';

const meta = {
  title: 'Product/Ramp Workspace',
  component: RampWorkspace,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof RampWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

const theme: ThemeSettings = { lMax: 1, lMin: 0.2 };
const displayOptions: RampDisplayOptions = {
  allowHiddenStops: true,
  showHex: true,
  showLightness: true,
  showChroma: true,
  showHue: false,
};
const collections = createTemplateCollections();
const coreGroup = getGroupNode(collections[0]);
const redRamp = coreGroup.ramps.find((ramp) => ramp.id === 'red')!;
const utilityGroup = getGroupNode(collections[1]);

export const FullWorkspace: Story = {};

export const SidebarComposition: Story = {
  render: () => (
    <div style={{ height: '720px', maxWidth: '320px' }}>
      <PaletteSidebar
        collections={collections}
        activeCollectionId="core"
        expandedCollectionIds={['core']}
        selectedRampId="red"
        onAddCollection={() => undefined}
        onSelectCollection={() => undefined}
        onToggleCollection={() => undefined}
        onSelectRamp={() => undefined}
        onMoveCollection={() => undefined}
        onMoveGroup={() => undefined}
        onMoveRamp={() => undefined}
        collapsed={false}
      />
    </div>
  ),
};

export const RampCardColumn: Story = {
  render: () => (
    <StoryCanvas>
      <div style={{ width: '280px' }}>
        <RampCard
          id={redRamp.id}
          name={redRamp.name}
          selected
          orientation="column"
          engineStops={generateRamp(theme, redRamp.config)}
          displayOptions={displayOptions}
          onSelectRamp={() => undefined}
          onRenameRamp={() => undefined}
          onInsertStop={() => undefined}
          onToggleVisibility={() => undefined}
          onDeleteStop={() => undefined}
          onDeleteRamp={() => undefined}
          onDuplicateRamp={() => undefined}
          onClearMinorStops={() => undefined}
        />
      </div>
    </StoryCanvas>
  ),
};

export const RampCardRow: Story = {
  render: () => (
    <StoryCanvas>
      <RampCard
        id={redRamp.id}
        name={redRamp.name}
        selected
        orientation="row"
        engineStops={generateRamp(theme, redRamp.config)}
        displayOptions={displayOptions}
        onSelectRamp={() => undefined}
        onRenameRamp={() => undefined}
        onInsertStop={() => undefined}
        onToggleVisibility={() => undefined}
        onDeleteStop={() => undefined}
        onDeleteRamp={() => undefined}
        onDuplicateRamp={() => undefined}
        onClearMinorStops={() => undefined}
      />
    </StoryCanvas>
  ),
};

export const GroupSectionComposition: Story = {
  render: () => (
    <StoryCanvas>
      <PaletteGroupSection
        group={utilityGroup}
        selectedRampId="blue"
        theme={theme}
        displayOptions={displayOptions}
        view="column"
        onRenameGroup={() => undefined}
        onRenameRamp={() => undefined}
        onAddRamp={() => undefined}
        onDeleteGroup={() => undefined}
        onSelectRamp={() => undefined}
        onSelectStop={() => undefined}
        onInsertStop={() => undefined}
        onToggleVisibility={() => undefined}
        onDeleteStop={() => undefined}
        onDeleteRamp={() => undefined}
        onDuplicateRamp={() => undefined}
        onClearMinorStops={() => undefined}
      />
    </StoryCanvas>
  ),
};

function StoryCanvas({ children }: { children: ReactNode }) {
  return <main className={styles.workspace}>{children}</main>;
}

function createTemplateCollections(): WorkspaceCollection[] {
  return [
    {
      id: 'core',
      name: 'Core',
      children: [
        {
          type: 'group',
          id: 'neutral',
          group: {
            id: 'neutral',
            name: 'Neutral',
            ramps: [createRamp('neutral-ramp', 'Neutral', '#5e5e5e', 0.02, 0.05), createRamp('red', 'Red', '#af261d', 0.05, 0.18)],
          },
        },
      ],
    },
    {
      id: 'openai',
      name: 'OpenAI',
      children: [
        {
          type: 'group',
          id: 'utility',
          group: {
            id: 'utility',
            name: 'Utility',
            ramps: [
              createRamp('blue', 'Blue', '#2563eb', 0.04, 0.16),
              createRamp('green', 'Green', '#16a34a', 0.04, 0.16),
              createRamp('yellow', 'Yellow', '#ca8a04', 0.04, 0.16),
              createRamp('orange', 'Orange', '#ea580c', 0.04, 0.16),
            ],
          },
        },
      ],
    },
  ];
}

function createRamp(id: string, name: string, seedColor: string, chromaStart: number, chromaEnd: number): WorkspaceRamp {
  return {
    id,
    name,
    config: createSeededRampConfig(name, seedColor, chromaStart, chromaEnd),
  };
}

function getGroupNode(collection: WorkspaceCollection): WorkspaceGroup {
  const node = collection.children[0];
  if (!node || node.type !== 'group') {
    throw new Error('Expected a group node.');
  }

  return node.group;
}
