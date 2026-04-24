import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createCanonicalStops, createDefaultConfig, generateRamp, insertStopBetween, setAnchor } from '../src/lib/color';
import { RampCard } from '../src/features/ramp/components/RampCard';
import { RampWorkspace } from '../src/features/ramp/RampWorkspace';

function getSidebarGroup(groupId: string): HTMLElement {
  const group = document.querySelector<HTMLElement>(`[data-group-dropzone="${groupId}"]`);
  if (!group) throw new Error(`Sidebar group ${groupId} not found.`);
  return group;
}

function getSidebarRampNames(groupId: string): string[] {
  return Array.from(getSidebarGroup(groupId).querySelectorAll<HTMLElement>('[data-ramp-select]')).map((button) => button.textContent ?? '');
}

function getSidebarRampButton(rampId: string): HTMLElement {
  const button = document.querySelector<HTMLElement>(`[data-ramp-select="${rampId}"]`);
  if (!button) throw new Error(`Sidebar ramp ${rampId} not found.`);
  return button;
}

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

  it('renders swatch surface, content, and actions as separate layers', () => {
    const config = createDefaultConfig();
    const { container } = render(
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

    const stopCard = container.querySelector<HTMLElement>('[role="button"].cardStop, [class*="cardStop"]');
    expect(stopCard).not.toBeNull();
    if (!stopCard) throw new Error('Swatch card missing.');

    expect(stopCard.querySelector('[class*="cardStopSurface"]')).not.toBeNull();
    expect(stopCard.querySelector('[class*="cardStopContent"]')).not.toBeNull();
    expect(stopCard.querySelector('[class*="cardStopActions"]')).not.toBeNull();
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
    expect(within(hueSection).getByText('Clockwise')).toBeInTheDocument();
    expect(within(hueSection).getByText('Counterclockwise')).toBeInTheDocument();
    expect(within(hueSection).queryByRole('button', { name: /midpoint/i })).not.toBeInTheDocument();
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
    expect(within(hueSection).getByText('This custom stop defines the midpoint while locked.')).toBeInTheDocument();
    const lockToggle = within(hueSection).getByRole('button', { name: 'Unlock midpoint' });
    expect(lockToggle).toBeEnabled();
    fireEvent.click(lockToggle);
    expect(within(hueSection).queryByText('This custom stop defines the midpoint while locked.')).not.toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Hue direction' })).toBeInTheDocument();
  });

  it('syncs both hue endpoints from a single custom stop', async () => {
    const { container } = render(<RampWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'Custom Stops' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Stop' }));

    const customStopsSection = container.querySelector<HTMLElement>('[data-section="custom-stops"]');
    expect(customStopsSection).not.toBeNull();
    if (!customStopsSection) throw new Error('Custom stops section missing.');

    const hexField = within(customStopsSection).getByLabelText('Hex');
    fireEvent.change(hexField, { target: { value: '#FAF6EF' } });
    fireEvent.blur(hexField);

    const hueSection = container.querySelector<HTMLElement>('[data-section="hue"]');
    expect(hueSection).not.toBeNull();
    if (!hueSection) throw new Error('Hue section missing.');

    await waitFor(() => {
      expect(within(hueSection).getAllByText('82').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('syncs hue start and end from the outer custom stops', async () => {
    const { container } = render(<RampWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'Custom Stops' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Stop' }));

    const customStopsSection = container.querySelector<HTMLElement>('[data-section="custom-stops"]');
    expect(customStopsSection).not.toBeNull();
    if (!customStopsSection) throw new Error('Custom stops section missing.');

    const hexFields = within(customStopsSection).getAllByLabelText('Hex');
    fireEvent.change(hexFields[0], { target: { value: '#FAF6EF' } });
    fireEvent.blur(hexFields[0]);

    fireEvent.click(within(customStopsSection).getByRole('button', { name: 'Add Stop' }));
    const secondHexField = within(customStopsSection).getAllByLabelText('Hex')[1];
    fireEvent.change(secondHexField, { target: { value: '#AF261D' } });
    fireEvent.blur(secondHexField);

    const hueSection = container.querySelector<HTMLElement>('[data-section="hue"]');
    expect(hueSection).not.toBeNull();
    if (!hueSection) throw new Error('Hue section missing.');

    await waitFor(() => {
      expect(within(hueSection).getAllByText('82').length).toBeGreaterThanOrEqual(1);
      expect(within(hueSection).getAllByText('29').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('includes an unlocked midpoint as an interpolation control point', async () => {
    const { container } = render(<RampWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'Custom Stops' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Stop' }));

    const customStopsSection = container.querySelector<HTMLElement>('[data-section="custom-stops"]');
    expect(customStopsSection).not.toBeNull();
    if (!customStopsSection) throw new Error('Custom stops section missing.');

    const hexField = within(customStopsSection).getByLabelText('Hex');
    fireEvent.change(hexField, { target: { value: '#FAF6EF' } });
    fireEvent.blur(hexField);

    const hueTrigger = screen.getAllByRole('button', { name: 'Hue' }).find((button) => button.hasAttribute('aria-controls'));
    expect(hueTrigger).toBeDefined();
    if (!hueTrigger) throw new Error('Hue accordion trigger missing.');

    fireEvent.click(hueTrigger);
    await waitFor(() => expect(hueTrigger).toHaveAttribute('aria-expanded', 'true'));

    const hueSection = container.querySelector<HTMLElement>('[data-section="hue"]');
    expect(hueSection).not.toBeNull();
    if (!hueSection) throw new Error('Hue section missing.');

    const unlockToggle = within(hueSection).getByRole('button', { name: 'Unlock midpoint' });
    fireEvent.click(unlockToggle);

    await waitFor(() => {
      expect(within(hueSection).queryByText('This custom stop defines the midpoint while locked.')).not.toBeInTheDocument();
      expect(within(hueSection).getByText('Midpoint is unlocked and participates as an interior control point.')).toBeInTheDocument();
    });
  });

  it('removes the derived stop when the last custom stop is deleted', async () => {
    const { container } = render(<RampWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'Custom Stops' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Stop' }));

    const customStopsSection = container.querySelector<HTMLElement>('[data-section="custom-stops"]');
    expect(customStopsSection).not.toBeNull();
    if (!customStopsSection) throw new Error('Custom stops section missing.');

    fireEvent.click(within(customStopsSection).getByRole('button', { name: 'Delete stop' }));

    await waitFor(() => {
      expect(within(customStopsSection).getByText('No custom stops yet. Add one to start experimenting.')).toBeInTheDocument();
      expect(screen.queryByLabelText('Anchor stop')).not.toBeInTheDocument();
    });
  });

  it('discards a blank custom stop when focus leaves before a color is entered', async () => {
    const { container } = render(<RampWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'Custom Stops' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Stop' }));

    const customStopsSection = container.querySelector<HTMLElement>('[data-section="custom-stops"]');
    expect(customStopsSection).not.toBeNull();
    if (!customStopsSection) throw new Error('Custom stops section missing.');

    const hexField = within(customStopsSection).getByLabelText('Hex');
    expect((hexField as HTMLInputElement).value).toBe('');

    fireEvent.blur(hexField);

    await waitFor(() => {
      expect(within(customStopsSection).getByText('No custom stops yet. Add one to start experimenting.')).toBeInTheDocument();
    });
  });

  it('recalculates custom stop positions when global lightness changes', async () => {
    const user = userEvent.setup();
    const { container } = render(<RampWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'Custom Stops' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Stop' }));

    const customStopsSection = container.querySelector<HTMLElement>('[data-section="custom-stops"]');
    expect(customStopsSection).not.toBeNull();
    if (!customStopsSection) throw new Error('Custom stops section missing.');

    const hexField = within(customStopsSection).getByLabelText('Hex');
    fireEvent.change(hexField, { target: { value: '#FAF6EF' } });
    fireEvent.blur(hexField);

    await waitFor(() => {
      expect(within(customStopsSection).getByText('25')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Open settings'));
    const lMinInput = await screen.findByLabelText('L min');
    await user.clear(lMinInput);
    await user.type(lMinInput, '60');
    fireEvent.blur(lMinInput);

    await waitFor(() => {
      expect(within(customStopsSection).getByText('75')).toBeInTheDocument();
    });
  });

  it('reorders ramps within a group from the sidebar drag handle', () => {
    render(<RampWorkspace />);

    const dragHandle = screen.getByLabelText('Drag Red');
    const neutralRow = document.querySelector<HTMLElement>('[data-ramp-id="neutral"]');
    expect(neutralRow).not.toBeNull();
    if (!neutralRow) throw new Error('Neutral row missing.');

    Object.defineProperty(neutralRow, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        width: 200,
        height: 40,
        top: 0,
        right: 200,
        bottom: 40,
        left: 0,
        toJSON: () => ({}),
      }),
    });

    const dataTransfer = {
      effectAllowed: 'move',
      setData: () => undefined,
      getData: () => 'red',
    } as unknown as DataTransfer;

    fireEvent.dragStart(dragHandle, { dataTransfer });
    fireEvent.dragOver(neutralRow, { dataTransfer, clientY: 4 });
    fireEvent.drop(neutralRow, { dataTransfer, clientY: 4 });
    fireEvent.dragEnd(dragHandle, { dataTransfer });

    expect(getSidebarRampNames('neutral-brand')).toEqual(['Red', 'Neutral']);
    expect(getSidebarRampButton('red')).toHaveAttribute('aria-current', 'true');
  });

  it('moves a ramp into another group from the sidebar reorder menu', async () => {
    const user = userEvent.setup();
    render(<RampWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'Red reorder options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move to next group' }));

    await waitFor(() => {
      expect(getSidebarRampNames('neutral-brand')).toEqual(['Neutral']);
      expect(getSidebarRampNames('utility')).toEqual(['Blue', 'Green', 'Yellow', 'Orange', 'Red']);
    });
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Move to next group' })).not.toBeInTheDocument());
  });

  it('moves a ramp into an empty group from the sidebar reorder menu', async () => {
    const user = userEvent.setup();
    render(<RampWorkspace />);

    const existingGroupIds = Array.from(document.querySelectorAll<HTMLElement>('[data-group-dropzone]')).map((group) =>
      group.getAttribute('data-group-dropzone'),
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'New Group' })[0]);
    const newGroupId = Array.from(document.querySelectorAll<HTMLElement>('[data-group-dropzone]'))
      .map((group) => group.getAttribute('data-group-dropzone'))
      .find((groupId) => groupId && !existingGroupIds.includes(groupId));

    expect(newGroupId).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Blue reorder options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move to next group' }));

    await waitFor(() => {
      expect(getSidebarRampNames('utility')).toEqual(['Green', 'Yellow', 'Orange']);
      expect(getSidebarRampNames(newGroupId!)).toEqual(['Blue']);
    });
  });

  it('copies chroma between ramps through the ramp action menu', async () => {
    const user = userEvent.setup();
    const { container } = render(<RampWorkspace />);
    const collectionsNav = screen.getByRole('navigation', { name: 'Collections' });

    fireEvent.click(within(collectionsNav).getByRole('button', { name: 'Blue' }));

    const blueMenuTrigger = screen.getByRole('button', { name: 'Blue options' });
    fireEvent.click(blueMenuTrigger);
    expect(await screen.findByRole('menuitem', { name: 'Paste Chroma' })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(blueMenuTrigger);

    fireEvent.click(screen.getByRole('button', { name: 'Red options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Copy Chroma' }));

    fireEvent.click(blueMenuTrigger);
    const pasteItem = await screen.findByRole('menuitem', { name: 'Paste Chroma' });
    expect(pasteItem).toBeEnabled();
    await user.click(pasteItem);

    const chromaTrigger = screen.getAllByRole('button', { name: 'Chroma' }).find((button) => button.hasAttribute('aria-controls'));
    expect(chromaTrigger).toBeDefined();
    if (!chromaTrigger) throw new Error('Chroma accordion trigger missing.');

    fireEvent.click(chromaTrigger);
    const chromaSection = container.querySelector<HTMLElement>('[data-section="chroma"]');
    expect(chromaSection).not.toBeNull();
    if (!chromaSection) throw new Error('Chroma section missing.');

    await waitFor(() => {
      expect(within(chromaSection).getByText('0.050')).toBeInTheDocument();
      expect(within(chromaSection).getByText('0.115')).toBeInTheDocument();
      expect(within(chromaSection).getByText('0.180')).toBeInTheDocument();
    });
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

  it('preserves selection when a selected ramp moves between groups', async () => {
    const user = userEvent.setup();
    render(<RampWorkspace />);

    fireEvent.click(getSidebarRampButton('blue'));
    fireEvent.click(screen.getByRole('button', { name: 'Blue reorder options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move to previous group' }));

    await waitFor(() => {
      expect(getSidebarRampNames('neutral-brand')).toEqual(['Neutral', 'Red', 'Blue']);
      expect(getSidebarRampButton('blue')).toHaveAttribute('aria-current', 'true');
      expect(screen.getByRole('heading', { name: 'Blue' })).toBeInTheDocument();
    });
  });

  it('disables keyboard move actions at list boundaries', async () => {
    render(<RampWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'Neutral reorder options' }));
    expect(await screen.findByRole('menuitem', { name: 'Move up' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: 'Move to previous group' })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Neutral reorder options' }));

    fireEvent.click(screen.getByRole('button', { name: 'Orange reorder options' }));
    expect(await screen.findByRole('menuitem', { name: 'Move down' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: 'Move to next group' })).toHaveAttribute('aria-disabled', 'true');
  });
});
