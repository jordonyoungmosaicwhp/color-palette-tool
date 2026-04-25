import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createSeededRampConfig } from '../src/lib/color';
import { PaletteSidebar } from '../src/features/ramp/components/PaletteSidebar';
import type { WorkspaceCollection, WorkspaceRamp } from '../src/features/ramp/workspaceTypes';

function createRamp(id: string, name: string, color: string): WorkspaceRamp {
  return {
    id,
    name,
    config: createSeededRampConfig(name, color, 0.04, 0.16),
  };
}

function createCollections(): WorkspaceCollection[] {
  const red = createRamp('red', 'Red', '#dc2626');
  const blue = createRamp('blue', 'Blue', '#2563eb');
  const green = createRamp('green', 'Green', '#16a34a');

  return [
    {
      id: 'your-brand',
      name: 'Your Brand',
      groups: [
        { id: 'brand', name: 'Brand', ramps: [red] },
        { id: 'utility', name: 'Utility', ramps: [blue, green] },
      ],
      children: [
        { type: 'group', id: 'brand', group: { id: 'brand', name: 'Brand', ramps: [red] } },
        { type: 'group', id: 'utility', group: { id: 'utility', name: 'Utility', ramps: [blue, green] } },
      ],
    },
  ];
}

function mockBounds(element: HTMLElement, height = 40) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      width: 200,
      height,
      top: 0,
      right: 200,
      bottom: height,
      left: 0,
      toJSON: () => ({}),
    }),
  });
}

describe('PaletteSidebar drag and drop', () => {
  it('emits ramp move callbacks for same-group reorder and group drop targets', () => {
    const onMoveRamp = vi.fn();

    render(
      <PaletteSidebar
        collections={createCollections()}
        activeCollectionId="your-brand"
        expandedCollectionIds={['your-brand']}
        selectedRampId="red"
        onAddCollection={() => undefined}
        onSelectCollection={() => undefined}
        onToggleCollection={() => undefined}
        onSelectRamp={() => undefined}
        onMoveCollection={() => undefined}
        onMoveGroup={() => undefined}
        onMoveRamp={onMoveRamp}
      />,
    );

    const greenRow = document.querySelector<HTMLElement>('[data-ramp-select="green"]');
    const blueRow = document.querySelector<HTMLElement>('[data-ramp-select="blue"]');
    const redRow = document.querySelector<HTMLElement>('[data-ramp-select="red"]');
    const utilityDropzone = document.querySelector<HTMLElement>('[data-group-dropzone="utility"]');
    if (!greenRow || !blueRow || !redRow || !utilityDropzone) {
      throw new Error('Sidebar nodes missing.');
    }

    mockBounds(blueRow);

    const dataTransfer = {
      effectAllowed: 'move',
      setData: () => undefined,
      getData: () => 'green',
    } as unknown as DataTransfer;

    fireEvent.dragStart(greenRow, { dataTransfer });
    fireEvent.dragOver(blueRow, { dataTransfer, clientY: 4 });
    fireEvent.drop(blueRow, { dataTransfer, clientY: 4 });
    fireEvent.dragEnd(greenRow, { dataTransfer });

    expect(onMoveRamp).toHaveBeenCalledWith('green', { type: 'group', groupId: 'utility', index: 0 });

    const secondTransfer = {
      effectAllowed: 'move',
      setData: () => undefined,
      getData: () => 'red',
    } as unknown as DataTransfer;

    fireEvent.dragStart(redRow, { dataTransfer: secondTransfer });
    fireEvent.dragOver(utilityDropzone, { dataTransfer: secondTransfer });
    fireEvent.drop(utilityDropzone, { dataTransfer: secondTransfer });
    fireEvent.dragEnd(redRow, { dataTransfer: secondTransfer });

    expect(onMoveRamp).toHaveBeenNthCalledWith(2, 'red', { type: 'group', groupId: 'utility', index: 2 });
  });

  it('emits top and bottom insertion targets for collection and group drop zones', () => {
    const onMoveRamp = vi.fn();
    const onMoveGroup = vi.fn();

    render(
      <PaletteSidebar
        collections={createCollections()}
        activeCollectionId="your-brand"
        expandedCollectionIds={['your-brand']}
        selectedRampId="red"
        onAddCollection={() => undefined}
        onSelectCollection={() => undefined}
        onToggleCollection={() => undefined}
        onSelectRamp={() => undefined}
        onMoveCollection={() => undefined}
        onMoveGroup={onMoveGroup}
        onMoveRamp={onMoveRamp}
      />,
    );

    const redRow = document.querySelector<HTMLElement>('[data-ramp-select="red"]');
    const collectionStart = document.querySelector<HTMLElement>(
      '[data-dropzone-scope="collection"][data-dropzone-id="your-brand"][data-dropzone-position="start"]',
    );
    const collectionEnd = document.querySelector<HTMLElement>(
      '[data-dropzone-scope="collection"][data-dropzone-id="your-brand"][data-dropzone-position="end"]',
    );
    const groupStart = document.querySelector<HTMLElement>(
      '[data-dropzone-scope="group"][data-dropzone-id="utility"][data-dropzone-position="start"]',
    );
    const groupEnd = document.querySelector<HTMLElement>(
      '[data-dropzone-scope="group"][data-dropzone-id="utility"][data-dropzone-position="end"]',
    );
    const brandGroupRow = document.querySelector<HTMLElement>('[data-group-row="brand"]');

    if (!redRow || !collectionStart || !collectionEnd || !groupStart || !groupEnd || !brandGroupRow) {
      throw new Error('Sidebar drop targets missing.');
    }

    const rampTransfer = {
      effectAllowed: 'move',
      setData: () => undefined,
      getData: () => 'red',
    } as unknown as DataTransfer;

    fireEvent.dragStart(redRow, { dataTransfer: rampTransfer });
    fireEvent.dragOver(collectionStart, { dataTransfer: rampTransfer });
    fireEvent.drop(collectionStart, { dataTransfer: rampTransfer });
    fireEvent.dragEnd(redRow, { dataTransfer: rampTransfer });
    expect(onMoveRamp).toHaveBeenNthCalledWith(1, 'red', { type: 'collection', collectionId: 'your-brand', index: 0 });

    fireEvent.dragStart(redRow, { dataTransfer: rampTransfer });
    fireEvent.dragOver(collectionEnd, { dataTransfer: rampTransfer });
    fireEvent.drop(collectionEnd, { dataTransfer: rampTransfer });
    fireEvent.dragEnd(redRow, { dataTransfer: rampTransfer });
    expect(onMoveRamp).toHaveBeenNthCalledWith(2, 'red', { type: 'collection', collectionId: 'your-brand', index: 2 });

    fireEvent.dragStart(redRow, { dataTransfer: rampTransfer });
    fireEvent.dragOver(groupStart, { dataTransfer: rampTransfer });
    fireEvent.drop(groupStart, { dataTransfer: rampTransfer });
    fireEvent.dragEnd(redRow, { dataTransfer: rampTransfer });
    expect(onMoveRamp).toHaveBeenNthCalledWith(3, 'red', { type: 'group', groupId: 'utility', index: 0 });

    fireEvent.dragStart(redRow, { dataTransfer: rampTransfer });
    fireEvent.dragOver(groupEnd, { dataTransfer: rampTransfer });
    fireEvent.drop(groupEnd, { dataTransfer: rampTransfer });
    fireEvent.dragEnd(redRow, { dataTransfer: rampTransfer });
    expect(onMoveRamp).toHaveBeenNthCalledWith(4, 'red', { type: 'group', groupId: 'utility', index: 2 });

    const groupTransfer = {
      effectAllowed: 'move',
      setData: () => undefined,
      getData: () => 'brand',
    } as unknown as DataTransfer;

    fireEvent.dragStart(brandGroupRow, { dataTransfer: groupTransfer });
    fireEvent.dragOver(collectionStart, { dataTransfer: groupTransfer });
    fireEvent.drop(collectionStart, { dataTransfer: groupTransfer });
    fireEvent.dragEnd(brandGroupRow, { dataTransfer: groupTransfer });
    expect(onMoveGroup).toHaveBeenNthCalledWith(1, 'brand', 'your-brand', 0);

    fireEvent.dragStart(brandGroupRow, { dataTransfer: groupTransfer });
    fireEvent.dragOver(collectionEnd, { dataTransfer: groupTransfer });
    fireEvent.drop(collectionEnd, { dataTransfer: groupTransfer });
    fireEvent.dragEnd(brandGroupRow, { dataTransfer: groupTransfer });
    expect(onMoveGroup).toHaveBeenNthCalledWith(2, 'brand', 'your-brand', 2);
  });
});
