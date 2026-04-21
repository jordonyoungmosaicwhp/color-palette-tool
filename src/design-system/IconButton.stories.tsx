import type { Meta, StoryObj } from '@storybook/react-vite';
import { MoreHorizontal, Plus, Settings, Trash2 } from 'lucide-react';
import { IconButton } from './IconButton';
import styles from './DesignSystemStories.module.scss';

const meta = {
  title: 'Design System/IconButton',
  component: IconButton,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Secondary: Story = {
  args: { label: 'More', icon: <MoreHorizontal size={16} />, variant: 'secondary' },
};

export const Ghost: Story = {
  args: { label: 'Settings', icon: <Settings size={16} />, variant: 'ghost' },
};

export const Danger: Story = {
  args: { label: 'Delete', icon: <Trash2 size={16} />, variant: 'danger' },
};

export const Disabled: Story = {
  args: { label: 'Add stop', icon: <Plus size={16} />, disabled: true },
};

export const All: Story = {
  args: { label: 'More', icon: <MoreHorizontal size={16} /> },
  render: () => (
    <div className={styles.grid}>
      <IconButton label="More" icon={<MoreHorizontal size={16} />} variant="secondary" />
      <IconButton label="Settings" icon={<Settings size={16} />} variant="ghost" />
      <IconButton label="Delete" icon={<Trash2 size={16} />} variant="danger" />
      <IconButton label="Disabled" icon={<Plus size={16} />} disabled />
    </div>
  ),
};
