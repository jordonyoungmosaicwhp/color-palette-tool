import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useWorkspaceController } from '../src/app/workspace/useWorkspaceController';

type Controller = ReturnType<typeof useWorkspaceController>;

function ControllerHarness(props: { onReady: (controller: Controller) => void }) {
  const controller = useWorkspaceController();
  props.onReady(controller);
  return null;
}

describe('workspace controller tree movement', () => {
  it('moves ramps between groups and preserves grouped ordering in collections state', async () => {
    let controller: Controller | null = null;

    render(<ControllerHarness onReady={(value) => void (controller = value)} />);

    await waitFor(() => {
      expect(controller).not.toBeNull();
    });

    if (!controller) {
      throw new Error('Controller missing.');
    }

    await act(async () => {
      controller!.actions.moveRamp('red', { type: 'group', groupId: 'utility', index: 4 });
    });

    await waitFor(() => {
      const yourBrand = controller!.collections.find((collection) => collection.id === 'brand-collection');
      const brand = yourBrand?.children.find((node) => node.type === 'group' && node.group.id === 'brand');
      const utility = yourBrand?.children.find((node) => node.type === 'group' && node.group.id === 'utility');
      expect(brand && brand.type === 'group' ? brand.group.ramps.map((ramp) => ramp.id) : []).toEqual(['cereal']);
      expect(utility && utility.type === 'group' ? utility.group.ramps.map((ramp) => ramp.id) : []).toEqual([
        'blue',
        'green',
        'yellow',
        'orange',
        'red',
      ]);
      });
  });
});
