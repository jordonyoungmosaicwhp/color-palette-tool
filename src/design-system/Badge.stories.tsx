import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';
import styles from './DesignSystemStories.module.scss';

const meta = {
  title: 'Design System/Badge',
  component: Badge,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'Default' },
  render: (args) => <Badge {...args} />,
};

export const Success: Story = {
  args: { tone: 'success', children: 'Export safe' },
  render: (args) => <Badge {...args} />,
};

export const Warning: Story = {
  args: { tone: 'warning', children: '3 warnings' },
  render: (args) => <Badge {...args} />,
};

export const Danger: Story = {
  args: { tone: 'danger', children: 'Out of gamut' },
  render: (args) => <Badge {...args} />,
};

export const All: Story = {
  args: { children: 'Default' },
  render: () => (
    <div className={styles.grid}>
      <Badge>Default</Badge>
      <Badge tone="success">Export safe</Badge>
      <Badge tone="warning">3 warnings</Badge>
      <Badge tone="danger">Out of gamut</Badge>
    </div>
  ),
};
