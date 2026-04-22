import {
  clamp,
  createDefaultConfig,
  deleteStop,
  insertStopBetween,
  parseOklchColor,
  setAnchor,
  stopResolution,
  toggleStopVisibility,
  updateRampStops,
} from '../../lib/color';
import type { DisplayMode, PaletteConfig, RampConfig } from '../../lib/color';

export interface RampState {
  config: PaletteConfig;
  selectedStop: number;
  showHiddenStops: boolean;
  exportFormat: 'css' | 'json' | 'table';
}

export type RampAction =
  | { type: 'set-lmax'; value: number }
  | { type: 'set-lmin'; value: number }
  | { type: 'set-display-mode'; value: DisplayMode }
  | { type: 'set-peak-chroma'; value: number }
  | { type: 'set-anchor-color'; value: string }
  | { type: 'insert-stop'; start: number; end: number }
  | { type: 'delete-stop'; index: number }
  | { type: 'clear-minor-stops' }
  | { type: 'toggle-stop-visibility'; index: number }
  | { type: 'select-stop'; index: number }
  | { type: 'set-show-hidden'; value: boolean }
  | {
      type: 'replace-workspace';
      value: {
        theme: PaletteConfig['theme'];
        displayMode: DisplayMode;
        selectedStop: number;
        showHiddenStops: boolean;
        ramp?: RampConfig;
      };
    }
  | { type: 'set-export-format'; value: RampState['exportFormat'] };

export function createInitialRampState(): RampState {
  const config = createDefaultConfig();

  return {
    config,
    selectedStop: config.ramp.anchor?.stop ?? 500,
    showHiddenStops: true,
    exportFormat: 'json',
  };
}

export function rampReducer(state: RampState, action: RampAction): RampState {
  switch (action.type) {
    case 'set-lmax':
      return {
        ...state,
        config: {
          ...state.config,
          theme: {
            ...state.config.theme,
            lMax: clamp(action.value, state.config.theme.lMin + 0.01, 1),
          },
        },
      };
    case 'set-lmin':
      return {
        ...state,
        config: {
          ...state.config,
          theme: {
            ...state.config.theme,
            lMin: clamp(action.value, 0, state.config.theme.lMax - 0.01),
          },
        },
      };
    case 'set-display-mode':
      return {
        ...state,
        config: {
          ...state.config,
          displayMode: action.value,
        },
      };
    case 'set-peak-chroma':
      return {
        ...state,
        config: {
          ...state.config,
          ramp: {
            ...state.config.ramp,
            chromaPreset: {
              ...state.config.ramp.chromaPreset,
              type: 'range',
              end: clamp(action.value, 0, 0.5),
            },
          },
        },
      };
    case 'set-anchor-color': {
      try {
        const anchorColor = parseOklchColor(action.value);
        const rawStop =
          ((state.config.theme.lMax - anchorColor.l) / (state.config.theme.lMax - state.config.theme.lMin)) * 1000;
        const snappedStop = clamp(Math.round(rawStop / 25) * 25, 25, 975);
        const ramp = setAnchor(state.config.ramp, action.value, snappedStop, stopResolution(snappedStop));
        return {
          ...state,
          selectedStop: ramp.anchor?.stop ?? state.selectedStop,
          config: {
            ...state.config,
            ramp,
          },
        };
      } catch {
        return state;
      }
    }
    case 'insert-stop': {
      const stops = insertStopBetween(state.config.ramp.stops, action.start, action.end);
      return {
        ...state,
        config: {
          ...state.config,
          ramp: updateRampStops(state.config.ramp, stops),
        },
      };
    }
    case 'delete-stop': {
      const stops = deleteStop(state.config.ramp.stops, action.index);
      const selectedStop = state.selectedStop === action.index ? state.config.ramp.anchor?.stop ?? 500 : state.selectedStop;
      return {
        ...state,
        selectedStop,
        config: {
          ...state.config,
          ramp: updateRampStops(state.config.ramp, stops),
        },
      };
    }
    case 'clear-minor-stops': {
      const stops = state.config.ramp.stops.filter(
        (stop) => stop.index % 100 === 0 || stop.index === state.config.ramp.anchor?.stop,
      );
      return {
        ...state,
        config: {
          ...state.config,
          ramp: updateRampStops(state.config.ramp, stops),
        },
      };
    }
    case 'toggle-stop-visibility': {
      const stops = toggleStopVisibility(state.config.ramp.stops, action.index);
      return {
        ...state,
        config: {
          ...state.config,
          ramp: updateRampStops(state.config.ramp, stops),
        },
      };
    }
    case 'select-stop':
      return {
        ...state,
        selectedStop: action.index,
      };
    case 'set-show-hidden':
      return {
        ...state,
        showHiddenStops: action.value,
      };
    case 'replace-workspace':
      return {
        ...state,
        config: {
          ...state.config,
          theme: action.value.theme,
          displayMode: action.value.displayMode,
          ramp: action.value.ramp ?? state.config.ramp,
        },
        selectedStop: action.value.selectedStop,
        showHiddenStops: action.value.showHiddenStops,
      };
    case 'set-export-format':
      return {
        ...state,
        exportFormat: action.value,
      };
    default:
      return state;
  }
}
