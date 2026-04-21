import type { Meta, StoryObj } from '@storybook/react-vite';
import { Download, Plus, Trash2 } from 'lucide-react';
import { Button } from './Button';
import styles from './DesignSystemStories.module.scss';

const meta = {
  title: 'Design System/Button',
  component: Button,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: 'primary', children: 'Add ramp', icon: <Plus size={14} /> },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Export', icon: <Download size={14} /> },
};

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Dismiss' },
};

export const Danger: Story = {
  args: { variant: 'danger', children: 'Delete', icon: <Trash2 size={14} /> },
};

export const Disabled: Story = {
  args: { variant: 'secondary', children: 'Disabled', disabled: true },
};

export const All: Story = {
  render: () => (
    <div className={styles.grid}>
      <Button variant="primary" icon={<Plus size={14} />}>Add ramp</Button>
      <Button variant="secondary" icon={<Download size={14} />}>Export</Button>
      <Button variant="ghost">Dismiss</Button>
      <Button variant="danger" icon={<Trash2 size={14} />}>Delete</Button>
      <Button disabled>Disabled</Button>
    </div>
  ),
};
