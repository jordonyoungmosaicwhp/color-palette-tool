import '@testing-library/jest-dom/vitest';
import { cloneElement, createContext, createElement, forwardRef, Fragment, isValidElement, useContext, useState } from 'react';
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

const MenuContext = createContext<{
  open: boolean;
  setOpen: (value: boolean) => void;
} | null>(null);

vi.mock('@ark-ui/react/menu', () => {
  const Root = ({ children }: any) => {
    const [open, setOpen] = useState(false);
    return createElement(MenuContext.Provider, { value: { open, setOpen } }, children);
  };

  const Trigger = ({ children }: any) => {
    const context = useContext(MenuContext);
    if (!context || !isValidElement(children)) return children;

    return cloneElement(children as any, {
      onClick: (...args: any[]) => {
        (children as any).props?.onClick?.(...args);
        context.setOpen(!context.open);
      },
    });
  };

  const Positioner = ({ children }: any) => createElement(Fragment, null, children);

  const Content = ({ children, ...props }: any) => {
    const context = useContext(MenuContext);
    if (!context?.open) return null;
    return createElement('div', { role: 'menu', ...props }, children);
  };

  const Item = forwardRef<HTMLDivElement, any>(({ children, disabled, onSelect, ...props }, ref) => {
    const context = useContext(MenuContext);
    return createElement(
      'div',
      {
        ref,
        role: 'menuitem',
        tabIndex: -1,
        'aria-disabled': disabled ? 'true' : undefined,
        'data-disabled': disabled ? '' : undefined,
        ...props,
        onClick: (event: React.MouseEvent<HTMLDivElement>) => {
          if (disabled) return;
          onSelect?.(event);
          context?.setOpen(false);
        },
      },
      children,
    );
  });

  return {
    Menu: {
      Root,
      Trigger,
      Positioner,
      Content,
      Item,
    },
  };
});
