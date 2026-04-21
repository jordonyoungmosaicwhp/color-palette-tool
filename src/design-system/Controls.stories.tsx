import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SegmentedControl, SelectField, SliderField, SwitchField } from '.';
import styles from './DesignSystemStories.module.scss';

const meta = {
  title: 'Design System/Controls',
  parameters: { layout: 'centered' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Switch: Story = {
  render: () => <SwitchStory />,
};

export const Slider: Story = {
  render: () => <SliderStory />,
};

export const Segmented: Story = {
  render: () => <SegmentedStory />,
};

export const Select: Story = {
  render: () => <SelectStory />,
};

export const All: Story = {
  render: () => <AllControlsStory />,
};

function SwitchStory() {
  const [checked, setChecked] = useState(true);
  return <SwitchField label="Allow hidden stops" checked={checked} onCheckedChange={setChecked} />;
}

function SliderStory() {
  const [value, setValue] = useState(180);
  return <SliderField label="End chroma" value={value} min={0} max={500} step={5} displayValue="0.180" onValueChange={setValue} />;
}

function SegmentedStory() {
  const [mode, setMode] = useState<'column' | 'row'>('column');
  return (
    <SegmentedControl
      label="Display mode"
      value={mode}
      items={[
        { value: 'column', label: 'Column' },
        { value: 'row', label: 'Row' },
      ]}
      onValueChange={setMode}
    />
  );
}

function SelectStory() {
  const [curve, setCurve] = useState<'linear' | 'quad'>('linear');
  return (
    <SelectField
      label="Curve"
      value={curve}
      items={[
        { value: 'linear', label: 'Linear' },
        { value: 'quad', label: 'Quad' },
      ]}
      onValueChange={setCurve}
    />
  );
}

function AllControlsStory() {
  const [checked, setChecked] = useState(true);
  const [slider, setSlider] = useState(180);
  const [mode, setMode] = useState<'column' | 'row'>('column');
  const [curve, setCurve] = useState<'linear' | 'quad'>('linear');

  return (
    <div className={styles.grid}>
      <SwitchField label="Allow hidden stops" checked={checked} onCheckedChange={setChecked} />
      <SliderField label="End chroma" value={slider} min={0} max={500} step={5} displayValue="0.180" onValueChange={setSlider} />
      <SegmentedControl
        label="Display mode"
        value={mode}
        items={[
          { value: 'column', label: 'Column' },
          { value: 'row', label: 'Row' },
        ]}
        onValueChange={setMode}
      />
      <SelectField
        label="Curve"
        value={curve}
        items={[
          { value: 'linear', label: 'Linear' },
          { value: 'quad', label: 'Quad' },
        ]}
        onValueChange={setCurve}
      />
    </div>
  );
}
