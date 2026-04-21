import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { NumberField, TextField } from '.';
import styles from './DesignSystemStories.module.scss';

const meta = {
  title: 'Design System/Fields',
  parameters: { layout: 'centered' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {
  render: () => <TextField label="Ramp name" defaultValue="Red" />,
};

export const Hex: Story = {
  render: () => <TextField label="Hex" defaultValue="#af261d" />,
};

export const Color: Story = {
  render: () => <TextField label="Anchor color" type="color" defaultValue="#af261d" />,
};

export const Number: Story = {
  render: () => <NumberStory />,
};

export const All: Story = {
  render: () => <AllFieldsStory />,
};

function NumberStory() {
  const [value, setValue] = useState(100);
  return <NumberField label="L max" value={value} min={0} max={100} suffix="%" onValueChange={setValue} />;
}

function AllFieldsStory() {
  const [value, setValue] = useState(100);
  return (
    <div className={styles.grid}>
      <TextField label="Ramp name" defaultValue="Red" />
      <TextField label="Hex" defaultValue="#af261d" />
      <TextField label="Anchor color" type="color" defaultValue="#af261d" />
      <NumberField label="L max" value={value} min={0} max={100} suffix="%" onValueChange={setValue} />
    </div>
  );
}
