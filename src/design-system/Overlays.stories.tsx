import type { Meta, StoryObj } from '@storybook/react-vite';
import { Plus } from 'lucide-react';
import { ActionMenu, Button, CodeBlock, Collapsible, Dialog, IconButton, Popover, SwitchField, TextField, Tooltip } from '.';
import styles from './DesignSystemStories.module.scss';

const meta = {
  title: 'Design System/Overlays',
  parameters: { layout: 'centered' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const TooltipStory: Story = {
  name: 'Tooltip',
  render: () => (
    <Tooltip content="Adds a midpoint stop when resolution allows.">
      <IconButton label="Insert stop" icon={<Plus size={16} />} variant="secondary" />
    </Tooltip>
  ),
};

export const PopoverStory: Story = {
  name: 'Popover',
  render: () => (
    <Popover title="Global settings" trigger={<Button variant="secondary">Open popover</Button>}>
      <div className={styles.stack}>
        <SwitchField label="Show hex" checked onCheckedChange={() => undefined} />
        <TextField label="Setting name" defaultValue="Ramp cards" />
      </div>
    </Popover>
  ),
};

export const DialogStory: Story = {
  name: 'Dialog',
  render: () => (
    <Dialog
      title="Export palette"
      trigger={<Button variant="secondary">Open dialog</Button>}
      footer={<Button size="sm">Copy</Button>}
    >
      <CodeBlock value="--color-red-500: oklch(54.6% 0.2152 27);" />
    </Dialog>
  ),
};

export const MenuStory: Story = {
  name: 'Menu',
  render: () => (
    <ActionMenu
      label="Ramp options"
      items={[
        { id: 'duplicate', label: 'Duplicate ramp', onSelect: () => undefined },
        { id: 'clear', label: 'Clear minor stops', onSelect: () => undefined },
        { id: 'delete', label: 'Delete ramp', destructive: true, onSelect: () => undefined },
      ]}
    />
  ),
};

export const CollapsibleStory: Story = {
  name: 'Collapsible',
  render: () => (
    <div className={styles.stack}>
      <Collapsible title="Custom anchor" defaultOpen>
        <TextField label="Hex" defaultValue="#af261d" />
      </Collapsible>
      <Collapsible title="Hue controls">
        <TextField label="Start" defaultValue="27" />
      </Collapsible>
    </div>
  ),
};
