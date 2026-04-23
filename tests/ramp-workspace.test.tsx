import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createCanonicalStops, createDefaultConfig, generateRamp, insertStopBetween, setAnchor } from '../src/lib/color';
import { RampCard } from '../src/features/ramp/components/RampCard';
import { RampWorkspace } from '../src/features/ramp/RampWorkspace';

describe('Ramp workspace UI', () => {
  it('uses the phase-two default template', () => {
    render(<RampWorkspace />);

    expect(screen.getAllByText('Neutral & Brand').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Utility').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Neutral').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Red').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Blue').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Green').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Yellow').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Orange').length).toBeGreaterThan(0);
  });

  it('can reopen the inspector with no selected ramp', () => {
    render(<RampWorkspace />);

    fireEvent.click(screen.getByLabelText('Collapse ramp properties'));
    fireEvent.click(screen.getByLabelText('Open ramp properties'));

    expect(screen.getByText('🎨 Select a ramp to customize')).toBeInTheDocument();
  });

  it('shows optional swatch metadata from global settings', () => {
    const config = createDefaultConfig();

    render(
      <RampCard
        id="red"
        name="Red"
        orientation="column"
        engineStops={generateRamp(config.theme, config.ramp)}
        displayOptions={{ allowHiddenStops: true, showHex: true, showLightness: true, showChroma: false, showHue: false }}
        onSelectRamp={() => undefined}
        onRenameRamp={() => undefined}
        onInsertStop={() => undefined}
        onToggleVisibility={() => undefined}
        onDeleteStop={() => undefined}
        onDeleteRamp={() => undefined}
        onDuplicateRamp={() => undefined}
        onClearMinorStops={() => undefined}
      />,
    );

    expect(screen.getAllByText(/^#[0-9a-f]{6}$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^L: /).length).toBeGreaterThan(0);
  });

  it('does not render disabled midpoint insert buttons at minimum resolution', () => {
    const config = createDefaultConfig();
    const ramp = setAnchor(
      {
        ...config.ramp,
        stops: insertStopBetween(insertStopBetween(config.ramp.stops, 100, 200), 100, 150),
      },
      '#af261d',
      500,
      100,
    );

    render(
      <RampCard
        id="red"
        name="Red"
        orientation="column"
        engineStops={generateRamp(config.theme, ramp)}
        displayOptions={{ allowHiddenStops: true, showHex: false, showLightness: false, showChroma: false, showHue: false }}
        onSelectRamp={() => undefined}
        onRenameRamp={() => undefined}
        onInsertStop={() => undefined}
        onToggleVisibility={() => undefined}
        onDeleteStop={() => undefined}
        onDeleteRamp={() => undefined}
        onDuplicateRamp={() => undefined}
        onClearMinorStops={() => undefined}
      />,
    );

    expect(screen.queryAllByLabelText('Insert stop').every((button) => !(button as HTMLButtonElement).disabled)).toBe(true);
  });

  it('renders the new chroma fieldsets without legacy rate controls', () => {
    const { container } = render(<RampWorkspace />);
    const chromaSection = container.querySelector<HTMLElement>('[data-section="chroma"]');

    expect(chromaSection).not.toBeNull();
    if (!chromaSection) throw new Error('Chroma section missing.');

    expect(within(chromaSection).getByText('Start')).toBeInTheDocument();
    expect(within(chromaSection).getByText('Midpoint')).toBeInTheDocument();
    expect(within(chromaSection).getByText('End')).toBeInTheDocument();
    expect(within(chromaSection).queryByLabelText('Rate')).not.toBeInTheDocument();
  });

  it('renders the new hue fieldsets and direction control', () => {
    const { container } = render(<RampWorkspace />);
    const hueSection = container.querySelector<HTMLElement>('[data-section="hue"]');

    expect(hueSection).not.toBeNull();
    if (!hueSection) throw new Error('Hue section missing.');

    expect(within(hueSection).getByText('Start')).toBeInTheDocument();
    expect(within(hueSection).getByText('Midpoint')).toBeInTheDocument();
    expect(within(hueSection).getByText('End')).toBeInTheDocument();
    expect(within(hueSection).getByText('Auto')).toBeInTheDocument();
    expect(within(hueSection).getByText('Clockwise')).toBeInTheDocument();
    expect(within(hueSection).getByText('Counterclockwise')).toBeInTheDocument();
    expect(within(hueSection).queryByRole('button', { name: 'Lock midpoint to anchor' })).not.toBeInTheDocument();
  });

  it('locks midpoint controls when custom stops are active', async () => {
    const { container } = render(<RampWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'Custom Stops' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Stop' }));

    const hueSection = container.querySelector<HTMLElement>('[data-section="hue"]');
    expect(hueSection).not.toBeNull();
    if (!hueSection) throw new Error('Hue section missing.');

    const hueTrigger = screen.getAllByRole('button', { name: 'Hue' }).find((button) => button.hasAttribute('aria-controls'));
    expect(hueTrigger).toBeDefined();
    if (!hueTrigger) throw new Error('Hue accordion trigger missing.');

    fireEvent.click(hueTrigger);
    await waitFor(() => expect(hueTrigger).toHaveAttribute('aria-expanded', 'true'));
    expect(within(hueSection).getByText('Midpoint is determined automatically when custom stops are active.')).toBeInTheDocument();
    expect(within(hueSection).getByRole('radio', { name: 'Auto' })).toBeDisabled();
    expect(screen.getByRole('radiogroup', { name: 'Hue direction' })).toBeInTheDocument();
  });

  it('keeps generated colors mapped into gamut', () => {
    const config = createDefaultConfig();
    const ramp = {
      ...config.ramp,
      chromaPreset: { start: 0, center: 0.25, end: 0.5, centerPosition: 0.5, startShape: 0.5, endShape: 0.5 },
    };

    render(
      <RampCard
        id="red"
        name="Red"
        orientation="column"
        engineStops={generateRamp(config.theme, ramp)}
        displayOptions={{ allowHiddenStops: true, showHex: false, showLightness: false, showChroma: false, showHue: false }}
        onSelectRamp={() => undefined}
        onRenameRamp={() => undefined}
        onInsertStop={() => undefined}
        onToggleVisibility={() => undefined}
        onDeleteStop={() => undefined}
        onDeleteRamp={() => undefined}
        onDuplicateRamp={() => undefined}
        onClearMinorStops={() => undefined}
      />,
    );

    expect(screen.queryAllByLabelText('Out of gamut')).toHaveLength(0);
  });

  it('global lightness changes affect multiple engine-backed ramps', () => {
    const theme = { lMax: 1, lMin: 0.2 };
    const red = setAnchor({ ...createDefaultConfig().ramp, stops: createCanonicalStops() }, '#af261d', 500, 100);
    const blue = setAnchor({ ...createDefaultConfig().ramp, stops: createCanonicalStops() }, '#2563eb', 500, 100);

    expect(generateRamp(theme, red)[0].oklch.l).toBeCloseTo(1);
    expect(generateRamp(theme, blue)[0].oklch.l).toBeCloseTo(1);
  });
});
