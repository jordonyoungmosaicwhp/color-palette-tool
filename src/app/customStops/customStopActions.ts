import type { CustomStopConfig, RampConfig, ThemeSettings } from '../../lib/color';

interface SyncedCustomStopsResult {
  ramp: RampConfig;
  focusIndex: number;
}

interface CustomStopActionContext {
  selectedRampConfig: RampConfig | undefined;
  selectedConfig: RampConfig;
  theme: ThemeSettings;
}

type SyncCustomStops = (
  ramp: RampConfig,
  customStops: CustomStopConfig[],
  theme: ThemeSettings,
) => SyncedCustomStopsResult;

type ClearCustomStops = (ramp: RampConfig) => RampConfig;

export function addCustomStop(
  context: CustomStopActionContext,
  nextCustomStopId: string,
  syncCustomStopsToHueEndpoints: SyncCustomStops,
): { ramp: RampConfig; pendingCustomStopFocusId: string } {
  const nextCustomStops = [...(context.selectedRampConfig?.customStops ?? []), { id: nextCustomStopId, color: '' }];
  const sync = syncCustomStopsToHueEndpoints(context.selectedRampConfig ?? context.selectedConfig, nextCustomStops, context.theme);

  return {
    ramp: sync.ramp,
    pendingCustomStopFocusId: nextCustomStopId,
  };
}

export function updateCustomStopColor(
  context: CustomStopActionContext,
  stopId: string,
  color: string,
  syncCustomStopsToHueEndpoints: SyncCustomStops,
): { ramp: RampConfig; focusIndex: number; pendingCustomStopFocusId: null } {
  const nextCustomStops = (context.selectedRampConfig?.customStops ?? []).map((stop) => (stop.id === stopId ? { ...stop, color } : stop));
  const sync = syncCustomStopsToHueEndpoints(context.selectedRampConfig ?? context.selectedConfig, nextCustomStops, context.theme);

  return {
    ramp: sync.ramp,
    focusIndex: sync.focusIndex,
    pendingCustomStopFocusId: null,
  };
}

export function removeCustomStop(
  context: CustomStopActionContext,
  stopId: string,
  pendingCustomStopFocusId: string | null,
  syncCustomStopsToHueEndpoints: SyncCustomStops,
  clearCustomStopSync: ClearCustomStops,
): { ramp: RampConfig; focusIndex: number; pendingCustomStopFocusId: string | null } {
  const nextCustomStops = (context.selectedRampConfig?.customStops ?? []).filter((stop) => stop.id !== stopId);

  if (nextCustomStops.length === 0) {
    return {
      ramp: clearCustomStopSync(context.selectedRampConfig ?? context.selectedConfig),
      focusIndex: 500,
      pendingCustomStopFocusId: pendingCustomStopFocusId === stopId ? null : pendingCustomStopFocusId,
    };
  }

  const sync = syncCustomStopsToHueEndpoints(context.selectedRampConfig ?? context.selectedConfig, nextCustomStops, context.theme);

  return {
    ramp: sync.ramp,
    focusIndex: sync.focusIndex,
    pendingCustomStopFocusId: pendingCustomStopFocusId === stopId ? null : pendingCustomStopFocusId,
  };
}
