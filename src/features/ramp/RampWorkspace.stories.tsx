import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { createSeededRampConfig, generateRamp } from '../../lib/color';
import type { ThemeSettings } from '../../lib/color';
import { PaletteGroupSection } from './components/PaletteGroupSection';
import { PaletteSidebar } from './components/PaletteSidebar';
import { RampCard } from './components/RampCard';
import { RampWorkspace } from './RampWorkspace';
import type { PaletteGroup, RampDisplayOptions, WorkspaceRamp } from './workspaceTypes';
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
const groups = createTemplateGroups();
const redRamp = groups[0].ramps[1];

export const FullWorkspace: Story = {};

export const SidebarComposition: Story = {
  render: () => (
    <div style={{ height: '720px', maxWidth: '320px' }}>
      <PaletteSidebar
        groups={groups}
        selectedRampId="red"
        onAddGroup={() => undefined}
        onSelectRamp={() => undefined}
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
        group={groups[1]}
        selectedRampId="blue"
        theme={theme}
        displayOptions={displayOptions}
        view="column"
        canDeleteGroup
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

function createTemplateGroups(): PaletteGroup[] {
  return [
    {
      id: 'neutral-brand',
      name: 'Neutral & Brand',
      ramps: [createRamp('neutral', 'Neutral', '#5e5e5e', 0.02, 0.05), createRamp('red', 'Red', '#af261d', 0.05, 0.18)],
    },
    {
      id: 'utility',
      name: 'Utility',
      ramps: [
        createRamp('blue', 'Blue', '#2563eb', 0.04, 0.16),
        createRamp('green', 'Green', '#16a34a', 0.04, 0.16),
        createRamp('yellow', 'Yellow', '#ca8a04', 0.04, 0.16),
        createRamp('orange', 'Orange', '#ea580c', 0.04, 0.16),
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
