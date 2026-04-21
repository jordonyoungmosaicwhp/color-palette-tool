import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, CodeBlock, Panel, Toolbar } from '.';
import styles from './DesignSystemStories.module.scss';

const meta = {
  title: 'Design System/Layout',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const PanelStory: Story = {
  name: 'Panel',
  render: () => (
    <main className={styles.audit}>
      <Panel title="Ramp properties">
        <div className={styles.stack}>
          <CodeBlock value="oklch(55% 0.18 27)" />
        </div>
      </Panel>
    </main>
  ),
};

export const ToolbarStory: Story = {
  name: 'Toolbar',
  render: () => (
    <main className={styles.audit}>
      <Toolbar>
        <Button size="sm" variant="secondary">Column</Button>
        <Button size="sm" variant="ghost">Row</Button>
      </Toolbar>
    </main>
  ),
};
