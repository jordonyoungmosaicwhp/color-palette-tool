import '@testing-library/jest-dom/vitest';
import { createElement, forwardRef } from 'react';
import { vi } from 'vitest';

class ResizeObserverMock {
  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }
}

globalThis.ResizeObserver = ResizeObserverMock;

vi.mock('@ark-ui/react/segment-group', () => {
  const Root = forwardRef<HTMLDivElement, any>(({ children, value: _value, onValueChange: _onValueChange, ...props }, ref) =>
    createElement('div', { ref, role: 'radiogroup', ...props }, children),
  );

  const Indicator = forwardRef<HTMLSpanElement, any>((props, ref) => createElement('span', { ref, ...props }));
  const Item = forwardRef<HTMLButtonElement, any>(({ children, value, disabled, ...props }, ref) =>
    createElement(
      'button',
      { ref, type: 'button', role: 'radio', 'aria-checked': false, 'data-value': value, disabled, ...props },
      children,
    ),
  );
  const ItemControl = forwardRef<HTMLSpanElement, any>((props, ref) => createElement('span', { ref, ...props }));
  const ItemText = forwardRef<HTMLSpanElement, any>(({ children, ...props }, ref) => createElement('span', { ref, ...props }, children));
  const ItemHiddenInput = forwardRef<HTMLInputElement, any>((props, ref) => createElement('input', { ref, type: 'radio', hidden: true, ...props }));

  return {
    SegmentGroup: {
      Root,
      Indicator,
      Item,
      ItemControl,
      ItemText,
      ItemHiddenInput,
    },
  };
});

vi.mock('@ark-ui/react/slider', () => {
  const Root = forwardRef<HTMLDivElement, any>(
    ({ children, value: _value, min: _min, max: _max, step: _step, disabled: _disabled, onValueChange: _onValueChange, ...props }, ref) =>
      createElement('div', { ref, 'data-slider-root': true, ...props }, children),
  );
  const Control = forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) =>
    createElement('div', { ref, 'data-slider-control': true, ...props }, children),
  );
  const Track = forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) =>
    createElement('div', { ref, 'data-slider-track': true, ...props }, children),
  );
  const Range = forwardRef<HTMLDivElement, any>((props, ref) => createElement('div', { ref, 'data-slider-range': true, ...props }));
  const Thumb = forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) =>
    createElement('div', { ref, 'data-slider-thumb': true, ...props }, children),
  );
  const HiddenInput = forwardRef<HTMLInputElement, any>((props, ref) =>
    createElement('input', { ref, type: 'range', hidden: true, ...props }),
  );
  const Label = forwardRef<HTMLLabelElement, any>(({ children, ...props }, ref) => createElement('label', { ref, ...props }, children));

  return {
    Slider: {
      Root,
      Control,
      Track,
      Range,
      Thumb,
      HiddenInput,
      Label,
    },
  };
});
