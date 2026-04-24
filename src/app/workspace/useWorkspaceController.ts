import { useEffect, useMemo, useReducer, useState } from 'react';

import {
  createSeededRampConfig,
  clamp,
  customStopCollisionIndices,
  deleteStop,
  generateRamp,
  insertStopBetween,
  normalizeStops,
  parseOklchColor,
  resnapAnchorStops,
  round,
  sortCustomStopsByIndex,
  toggleStopVisibility,
  tryCustomStopIndex,
  updateRampStops,
  validateGeneratedStops,
} from '../../lib/color';
import type { ChromaPreset, HuePreset, RampConfig, CustomStopConfig, ThemeSettings } from '../../lib/color';
import { addCollection as addCollectionAction, deleteCollection as deleteCollectionAction, renameCollection as renameCollectionAction, selectCollection as selectCollectionAction } from '../collections/collectionActions';
import { addCustomStop as addCustomStopAction, removeCustomStop as removeCustomStopAction, updateCustomStopColor as updateCustomStopColorAction } from '../customStops/customStopActions';
import { addGroup as addGroupAction, deleteGroup as deleteGroupAction, renameGroup as renameGroupAction } from '../groups/groupActions';
import { applyImportedWorkspace as applyImportedWorkspaceAction, copyExport as copyExportAction, downloadConfig as downloadConfigAction } from '../io/workspaceIO';
import { addRamp as addRampAction, deleteRamp as deleteRampAction, duplicateRamp as duplicateRampAction, renameRamp as renameRampAction, updateRampConfig as updateRampConfigAction } from '../ramps/rampActions';
import { selectActiveCollection, selectRampById, selectSelectedConfig } from './workspaceSelectors';
import { type CopiedChromaState, initialCollections, initialWorkspaceViewState } from './workspaceState';
import { createInitialRampState, rampReducer } from '../../features/ramp/rampReducer';
import { createWorkspaceExportBundle, parseWorkspaceImport } from '../../features/ramp/workspaceSerialization';
import type { WorkspaceCollection, WorkspaceGroup, WorkspaceRamp } from '../../features/ramp/workspaceTypes';

export function useWorkspaceController() {
  const [state, dispatch] = useReducer(rampReducer, undefined, createInitialRampState);
  const [collections, setCollections] = useState<WorkspaceCollection[]>(initialCollections);
  const [activeCollectionId, setActiveCollectionId] = useState(initialWorkspaceViewState.activeCollectionId);
  const [expandedCollectionIds, setExpandedCollectionIds] = useState<string[]>(initialWorkspaceViewState.expandedCollectionIds);
  const [selectedRampId, setSelectedRampId] = useState(initialWorkspaceViewState.selectedRampId);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialWorkspaceViewState.sidebarCollapsed);
  const [inspectorOpen, setInspectorOpen] = useState(initialWorkspaceViewState.inspectorOpen);
  const [uiTheme, setUiTheme] = useState(initialWorkspaceViewState.uiTheme);
  const [importOpen, setImportOpen] = useState(initialWorkspaceViewState.importOpen);
  const [importDraft, setImportDraft] = useState(initialWorkspaceViewState.importDraft);
  const [importError, setImportError] = useState<string | null>(initialWorkspaceViewState.importError);
  const [displayOptions, setDisplayOptions] = useState(initialWorkspaceViewState.displayOptions);
  const [accordionSection, setAccordionSection] = useState(initialWorkspaceViewState.accordionSection);
  const [copied, setCopied] = useState(initialWorkspaceViewState.copied);
  const [copiedChroma, setCopiedChroma] = useState<CopiedChromaState | null>(initialWorkspaceViewState.copiedChroma);
  const [moveAnnouncement, setMoveAnnouncement] = useState(initialWorkspaceViewState.moveAnnouncement);
  const [pendingCustomStopFocusId, setPendingCustomStopFocusId] = useState<string | null>(
    initialWorkspaceViewState.pendingCustomStopFocusId,
  );
  const activeCollection = selectActiveCollection(collections, activeCollectionId);
  const selectedRamp = selectRampById(collections, selectedRampId);
  const selectedConfig = selectSelectedConfig(collections, activeCollectionId, selectedRampId);
  const selectedGeneratedStops = generateRamp(state.config.theme, selectedConfig);
  const validation = validateGeneratedStops(selectedGeneratedStops);
  const customStops = selectedRamp?.config.customStops ?? [];
  const customStopsActive = customStops.length > 0;
  const customStopsMidpointLocked = customStopsActive ? selectedRamp?.config.customStopsMidpointLocked ?? true : false;
  const selectedCustomStopCollisions = customStopCollisionIndices(customStops, state.config.theme);
  const hasCustomStopCollisions = selectedCustomStopCollisions.length > 0;
  const hasBlockingIssues = validation.hasBlockingIssues || hasCustomStopCollisions;
  const exportBundle = useMemo(
    () =>
      createWorkspaceExportBundle({
        theme: state.config.theme,
        displayMode: state.config.displayMode,
        displayOptions,
        activeCollectionId,
        selectedRampId,
        selectedStop: state.selectedStop,
        collections,
      }),
    [activeCollectionId, collections, displayOptions, selectedRampId, state.config.displayMode, state.config.theme, state.selectedStop],
  );
  const selectedName = selectedRamp?.name ?? 'No Ramp Selected';

  useEffect(() => {
    document.documentElement.dataset.theme = uiTheme;
    document.documentElement.style.colorScheme = uiTheme;
    return () => {
      document.documentElement.dataset.theme = 'light';
      document.documentElement.style.colorScheme = 'light';
    };
  }, [uiTheme]);

  const exportValue =
    state.exportFormat === 'css'
      ? exportBundle.cssVariables
      : state.exportFormat === 'json'
        ? exportBundle.jsonConfig
        : exportBundle.table;

  async function copyExport() {
    await copyExportAction(
      hasBlockingIssues,
      exportValue,
      (value) => navigator.clipboard.writeText(value),
      setCopied,
      (callback, delayMs) => {
        window.setTimeout(callback, delayMs);
      },
    );
  }

  function downloadConfig() {
    downloadConfigAction(
      hasBlockingIssues,
      exportValue,
      state.exportFormat,
      (blob) => URL.createObjectURL(blob),
      (url) => URL.revokeObjectURL(url),
      () => document.createElement('a'),
    );
  }

  function applyImportedWorkspace() {
    const result = applyImportedWorkspaceAction(importDraft, parseWorkspaceImport);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }

    setCollections(result.workspace.collections);
    setActiveCollectionId(result.activeCollectionId);
    setExpandedCollectionIds(result.expandedCollectionIds);
    setSelectedRampId(result.selectedRampId);
    setDisplayOptions(result.workspace.displayOptions);
    dispatch({
      type: 'replace-workspace',
      value: {
        theme: result.workspace.theme,
        displayMode: result.workspace.displayMode,
        selectedStop: result.workspace.selectedStop,
        showHiddenStops: result.workspace.displayOptions.allowHiddenStops,
        ramp: result.rampReplacement,
      },
    });
    setImportError(null);
    setImportOpen(false);
  }

  function addCollection() {
    const result = addCollectionAction(collections, expandedCollectionIds, `collection-${Date.now()}`);
    setCollections(result.collections);
    setActiveCollectionId(result.activeCollectionId);
    setExpandedCollectionIds(result.expandedCollectionIds);
    setSelectedRampId(result.selectedRampId);
  }

  function selectCollection(collectionId: string) {
    const result = selectCollectionAction(expandedCollectionIds, collectionId);
    setActiveCollectionId(result.activeCollectionId);
    setExpandedCollectionIds(result.expandedCollectionIds);
    setSelectedRampId(result.selectedRampId);
    setInspectorOpen(result.inspectorOpen);
  }

  function toggleCollection(collectionId: string) {
    setExpandedCollectionIds((current) =>
      current.includes(collectionId) ? current.filter((id) => id !== collectionId) : [...current, collectionId],
    );
  }

  function deleteCollection(collectionId: string) {
    const selectedCollectionId = selectedRampId ? findCollectionIdForRamp(collections, selectedRampId) : undefined;
    const result = deleteCollectionAction(
      collections,
      collectionId,
      activeCollectionId,
      expandedCollectionIds,
      selectedCollectionId,
      selectedRampId,
    );

    setCollections(result.collections);
    setActiveCollectionId(result.activeCollectionId);
    setExpandedCollectionIds(result.expandedCollectionIds);
    setSelectedRampId(result.selectedRampId);
  }

  function renameCollection(collectionId: string, name: string) {
    setCollections((current) => renameCollectionAction(current, collectionId, name));
  }

  function addGroup() {
    if (!activeCollectionId) return;
    setCollections((current) => addGroupAction(current, activeCollectionId, `group-${Date.now()}`));
  }

  function deleteGroup(groupId: string) {
    setCollections((current) => {
      const nextCollections = deleteGroupAction(current, groupId);

      if (findGroupForRamp(current, selectedRampId)?.id === groupId) {
        setSelectedRampId(firstRampId(nextCollections, activeCollectionId));
      }

      return nextCollections;
    });
  }

  function renameGroup(groupId: string, name: string) {
    setCollections((current) => renameGroupAction(current, groupId, name));
  }

  function renameRamp(rampId: string, name: string) {
    setCollections((current) => renameRampAction(current, rampId, name));
  }

  function copyChroma(rampId: string) {
    const ramp = findRampById(collections, rampId);
    if (!ramp) return;

    setCopiedChroma({
      sourceRampId: rampId,
      preset: cloneChromaPreset(ramp.config.chromaPreset),
    });
  }

  function pasteChroma(rampId: string) {
    if (!copiedChroma) return;

    updateRampConfig(rampId, (ramp) => ({
      ...ramp,
      chromaPreset: cloneChromaPreset(copiedChroma.preset),
    }));
  }

  function selectRamp(rampId: string) {
    const nextCollectionId = findCollectionIdForRamp(collections, rampId);
    if (nextCollectionId) {
      setActiveCollectionId(nextCollectionId);
      setExpandedCollectionIds((current) => Array.from(new Set([...current, nextCollectionId])));
    }
    setSelectedRampId(rampId);
    setInspectorOpen(true);
  }

  function addRamp(groupId: string) {
    const newRampId = `ramp-${Date.now()}`;
    setCollections((current) => addRampAction(current, groupId, newRampId));
    setSelectedRampId(newRampId);
    const nextCollectionId = findCollectionIdForGroup(collections, groupId);
    if (nextCollectionId) {
      setActiveCollectionId(nextCollectionId);
      setExpandedCollectionIds((current) => Array.from(new Set([...current, nextCollectionId])));
    }
    setInspectorOpen(true);
  }

  function deleteRamp(rampId: string) {
    setCollections((current) => {
      const nextCollections = deleteRampAction(current, rampId);
      if (selectedRampId === rampId) setSelectedRampId(firstRampId(nextCollections, activeCollectionId));
      return nextCollections;
    });
  }

  function moveCollection(sourceCollectionId: string, targetIndex: number) {
    let announcement = '';

    setCollections((current) => {
      const result = moveCollectionInCollections(current, sourceCollectionId, targetIndex);
      if (!result.movedCollection || result.targetIndex === undefined) {
        return current;
      }

      announcement = `Moved ${result.movedCollection.name} to position ${result.targetIndex + 1}.`;
      return result.collections;
    });

    if (announcement) {
      setMoveAnnouncement('');
      window.setTimeout(() => setMoveAnnouncement(announcement), 0);
    }
  }

  function moveGroup(sourceGroupId: string, targetCollectionId: string, targetIndex: number) {
    let announcement = '';

    setCollections((current) => {
      const result = moveGroupInCollections(current, sourceGroupId, targetCollectionId, targetIndex);
      if (!result.movedGroup || result.targetCollectionId === undefined || result.targetIndex === undefined) {
        return current;
      }

      announcement = `Moved ${result.movedGroup.name} to ${result.targetCollectionName}, position ${result.targetIndex + 1}.`;
      if (findGroupForRamp(current, selectedRampId)?.id === sourceGroupId) {
        setActiveCollectionId(result.targetCollectionId);
        setExpandedCollectionIds((expanded) => Array.from(new Set([...expanded, result.targetCollectionId!])));
      }
      return result.collections;
    });

    if (announcement) {
      setMoveAnnouncement('');
      window.setTimeout(() => setMoveAnnouncement(announcement), 0);
    }
  }

  function moveRamp(sourceRampId: string, targetGroupId: string, targetIndex: number) {
    let announcement = '';

    setCollections((current) => {
      const result = moveRampInCollections(current, sourceRampId, targetGroupId, targetIndex);
      if (!result.movedRamp || result.targetGroupName === undefined || result.targetIndex === undefined) {
        return current;
      }

      announcement = `Moved ${result.movedRamp.name} to ${result.targetGroupName}, position ${result.targetIndex + 1}.`;
      if (selectedRampId === sourceRampId && result.targetCollectionId) {
        setActiveCollectionId(result.targetCollectionId);
        setExpandedCollectionIds((expanded) => Array.from(new Set([...expanded, result.targetCollectionId!])));
      }
      return result.collections;
    });

    if (announcement) {
      setMoveAnnouncement('');
      window.setTimeout(() => setMoveAnnouncement(announcement), 0);
    }
  }

  function duplicateRamp(rampId: string) {
    const duplicateId = `ramp-${Date.now()}`;
    setCollections((current) => duplicateRampAction(current, rampId, duplicateId).collections);
    setSelectedRampId(duplicateId);
    setInspectorOpen(true);
  }

  function clearMinorStops(rampId: string) {
    updateRampConfig(rampId, (ramp) => updateRampStops(ramp, ramp.stops.filter((stop) => stop.index % 100 === 0)));
  }

  function insertStopForRamp(rampId: string, start: number, end: number) {
    updateRampConfig(rampId, (ramp) => updateRampStops(ramp, insertStopBetween(ramp.stops, start, end)));
  }

  function deleteStopForRamp(rampId: string, index: number) {
    updateRampConfig(rampId, (ramp) => updateRampStops(ramp, deleteStop(ramp.stops, index)));
  }

  function toggleStopForRamp(rampId: string, index: number) {
    if (!displayOptions.allowHiddenStops) return;
    updateRampConfig(rampId, (ramp) => updateRampStops(ramp, toggleStopVisibility(ramp.stops, index)));
  }

  function updateRampConfig(rampId: string, updater: (ramp: RampConfig) => RampConfig) {
    setCollections((current) => updateRampConfigAction(current, rampId, updater));
  }

  function addCustomStop(rampId: string) {
    const nextCustomStopId = `custom-stop-${Date.now()}`;
    const result = addCustomStopAction(
      {
        selectedRampConfig: selectedRamp?.config,
        selectedConfig,
        theme: state.config.theme,
      },
      nextCustomStopId,
      syncCustomStopsToHueEndpoints,
    );
    updateRampConfig(rampId, () => result.ramp);
    setPendingCustomStopFocusId(result.pendingCustomStopFocusId);
  }

  function updateCustomStopColor(rampId: string, stopId: string, color: string) {
    const result = updateCustomStopColorAction(
      {
        selectedRampConfig: selectedRamp?.config,
        selectedConfig,
        theme: state.config.theme,
      },
      stopId,
      color,
      syncCustomStopsToHueEndpoints,
    );
    updateRampConfig(rampId, () => result.ramp);
    dispatch({ type: 'select-stop', index: result.focusIndex });
    setPendingCustomStopFocusId(result.pendingCustomStopFocusId);
  }

  function removeCustomStop(rampId: string, stopId: string) {
    const result = removeCustomStopAction(
      {
        selectedRampConfig: selectedRamp?.config,
        selectedConfig,
        theme: state.config.theme,
      },
      stopId,
      pendingCustomStopFocusId,
      syncCustomStopsToHueEndpoints,
      clearCustomStopSync,
    );
    updateRampConfig(rampId, () => result.ramp);
    dispatch({ type: 'select-stop', index: result.focusIndex });
    setPendingCustomStopFocusId(result.pendingCustomStopFocusId);
  }

  function updateHuePreset(rampId: string, next: Partial<HuePreset>) {
    updateRampConfig(rampId, (ramp) => ({
      ...ramp,
      huePreset: {
        start: next.start ?? huePresetForRamp(ramp).start,
        center: next.center ?? huePresetForRamp(ramp).center,
        end: next.end ?? huePresetForRamp(ramp).end,
        centerPosition: next.centerPosition ?? huePresetForRamp(ramp).centerPosition,
        startShape: next.startShape ?? huePresetForRamp(ramp).startShape,
        endShape: next.endShape ?? huePresetForRamp(ramp).endShape,
        startDirection: next.startDirection ?? huePresetForRamp(ramp).startDirection,
        endDirection: next.endDirection ?? huePresetForRamp(ramp).endDirection,
      },
    }));
  }

  function applyThemeChange(nextTheme: ThemeSettings) {
    setCollections((current) =>
      current.map((collection) => ({
        ...collection,
        groups: collection.groups.map((group) => ({
          ...group,
          ramps: group.ramps.map((ramp) => ({
            ...ramp,
            config: resyncRampToTheme(ramp.config, nextTheme),
          })),
        })),
      })),
    );

    if (selectedRamp?.config.customStops?.length) {
      const sync = syncCustomStopsToHueEndpoints(selectedRamp.config, selectedRamp.config.customStops, nextTheme);
      dispatch({ type: 'select-stop', index: sync.focusIndex });
    } else if (selectedRamp?.config.anchor) {
      const resnapped = resnapAnchorStops(selectedRamp.config, nextTheme);
      dispatch({ type: 'select-stop', index: resnapped.anchor?.stop ?? state.selectedStop });
    }
  }

  function toggleUiTheme() {
    setUiTheme((theme) => (theme === 'light' ? 'dark' : 'light'));
  }

  function toggleSidebar() {
    setSidebarCollapsed((collapsed) => !collapsed);
  }

  function toggleInspector() {
    setInspectorOpen((open) => !open);
    if (inspectorOpen) setSelectedRampId('');
  }

  function onLMaxChange(value: number) {
    const nextTheme = {
      ...state.config.theme,
      lMax: clamp(value, state.config.theme.lMin + 0.01, 1),
    };
    dispatch({ type: 'set-lmax', value });
    applyThemeChange(nextTheme);
  }

  function onLMinChange(value: number) {
    const nextTheme = {
      ...state.config.theme,
      lMin: clamp(value, 0, state.config.theme.lMax - 0.01),
    };
    dispatch({ type: 'set-lmin', value });
    applyThemeChange(nextTheme);
  }

  function onImportOpenChange(open: boolean) {
    setImportOpen(open);
    setImportError(null);
  }

  function onFocusStopIdConsumed() {
    setPendingCustomStopFocusId(null);
  }

  function onSelectStop(index: number) {
    dispatch({ type: 'select-stop', index });
  }

  function onDisplayModeChange(value: 'column' | 'row') {
    dispatch({ type: 'set-display-mode', value });
  }

  function onExportFormatChange(value: 'css' | 'json' | 'table') {
    dispatch({ type: 'set-export-format', value });
  }

  return {
    state,
    collections,
    activeCollection,
    selectedRamp,
    selectedConfig,
    selectedGeneratedStops,
    selectedName,
    displayOptions,
    expandedCollectionIds,
    selectedRampId,
    inspectorOpen,
    sidebarCollapsed,
    uiTheme,
    importOpen,
    importDraft,
    importError,
    copied,
    copiedChroma,
    accordionSection,
    moveAnnouncement,
    pendingCustomStopFocusId,
    validation,
    customStops,
    customStopsMidpointLocked,
    selectedCustomStopCollisions,
    exportValue,
    actions: {
      copyExport,
      downloadConfig,
      applyImportedWorkspace,
      addCollection,
      selectCollection,
      toggleCollection,
      deleteCollection,
      renameCollection,
      addGroup,
      deleteGroup,
      renameGroup,
      renameRamp,
      copyChroma,
      pasteChroma,
      selectRamp,
      addRamp,
      deleteRamp,
      moveCollection,
      moveGroup,
      moveRamp,
      duplicateRamp,
      clearMinorStops,
      insertStopForRamp,
      deleteStopForRamp,
      toggleStopForRamp,
      updateRampConfig,
      addCustomStop,
      updateCustomStopColor,
      removeCustomStop,
      updateHuePreset,
      toggleUiTheme,
      toggleSidebar,
      toggleInspector,
      onLMaxChange,
      onLMinChange,
      onImportOpenChange,
      onFocusStopIdConsumed,
      onSelectStop,
      onDisplayModeChange,
      onExportFormatChange,
      setImportDraft,
      setDisplayOptions,
      setAccordionSection,
      getHuePresetForRamp: huePresetForRamp,
    },
  };
}

interface GroupLocation {
  collectionIndex: number;
  groupIndex: number;
  group: WorkspaceGroup;
}

interface RampLocation {
  collectionIndex: number;
  groupIndex: number;
  rampIndex: number;
  ramp: WorkspaceRamp;
}

interface MoveCollectionResult {
  collections: WorkspaceCollection[];
  movedCollection?: WorkspaceCollection;
  targetIndex?: number;
}

interface MoveGroupResult {
  collections: WorkspaceCollection[];
  movedGroup?: WorkspaceGroup;
  targetCollectionId?: string;
  targetCollectionName?: string;
  targetIndex?: number;
}

interface MoveRampResult {
  collections: WorkspaceCollection[];
  movedRamp?: WorkspaceRamp;
  targetCollectionId?: string;
  targetGroupName?: string;
  targetIndex?: number;
}

function firstRampId(nextCollections: WorkspaceCollection[], collectionId?: string): string {
  const targetCollection = collectionId
    ? nextCollections.find((collection) => collection.id === collectionId)
    : nextCollections[0];
  const fromTarget = targetCollection?.groups.flatMap((group) => group.ramps)[0]?.id;
  return fromTarget ?? nextCollections.flatMap((collection) => collection.groups.flatMap((group) => group.ramps))[0]?.id ?? '';
}

function findRampById(collections: WorkspaceCollection[], rampId: string): WorkspaceRamp | undefined {
  return findRampLocation(collections, rampId)?.ramp;
}

function findCollectionIdForRamp(collections: WorkspaceCollection[], rampId: string): string | undefined {
  const location = findRampLocation(collections, rampId);
  return location ? collections[location.collectionIndex]?.id : undefined;
}

function findCollectionIdForGroup(collections: WorkspaceCollection[], groupId: string): string | undefined {
  const location = findGroupLocation(collections, groupId);
  return location ? collections[location.collectionIndex]?.id : undefined;
}

function findGroupForRamp(collections: WorkspaceCollection[], rampId: string): WorkspaceGroup | undefined {
  const location = findRampLocation(collections, rampId);
  return location ? collections[location.collectionIndex]?.groups[location.groupIndex] : undefined;
}

function moveCollectionInCollections(
  collections: WorkspaceCollection[],
  sourceCollectionId: string,
  targetIndex: number,
): MoveCollectionResult {
  const sourceIndex = collections.findIndex((collection) => collection.id === sourceCollectionId);
  if (sourceIndex < 0) return { collections };

  const nextCollections = [...collections];
  const [movedCollection] = nextCollections.splice(sourceIndex, 1);
  if (!movedCollection) return { collections };

  const clampedIndex = Math.max(0, Math.min(targetIndex, nextCollections.length + 1));
  const adjustedIndex = sourceIndex < clampedIndex ? clampedIndex - 1 : clampedIndex;

  if (adjustedIndex === sourceIndex) {
    return { collections };
  }

  nextCollections.splice(Math.max(0, Math.min(adjustedIndex, nextCollections.length)), 0, movedCollection);

  return {
    collections: nextCollections,
    movedCollection,
    targetIndex: Math.max(0, Math.min(adjustedIndex, nextCollections.length - 1)),
  };
}

function moveGroupInCollections(
  collections: WorkspaceCollection[],
  sourceGroupId: string,
  targetCollectionId: string,
  targetIndex: number,
): MoveGroupResult {
  const source = findGroupLocation(collections, sourceGroupId);
  if (!source) return { collections };

  const nextCollections = cloneCollections(collections);
  const [movedGroup] = nextCollections[source.collectionIndex].groups.splice(source.groupIndex, 1);
  if (!movedGroup) return { collections };

  const destinationCollectionIndex = nextCollections.findIndex((collection) => collection.id === targetCollectionId);
  if (destinationCollectionIndex < 0) return { collections };

  const destinationCollection = nextCollections[destinationCollectionIndex];
  const sameCollection = source.collectionIndex === destinationCollectionIndex;
  const clampedIndex = Math.max(0, Math.min(targetIndex, destinationCollection.groups.length + (sameCollection ? 1 : 0)));
  const adjustedIndex = sameCollection && source.groupIndex < clampedIndex ? clampedIndex - 1 : clampedIndex;

  if (sameCollection && adjustedIndex === source.groupIndex) {
    return { collections };
  }

  destinationCollection.groups.splice(Math.max(0, Math.min(adjustedIndex, destinationCollection.groups.length)), 0, movedGroup);

  return {
    collections: nextCollections,
    movedGroup,
    targetCollectionId: destinationCollection.id,
    targetCollectionName: destinationCollection.name,
    targetIndex: Math.max(0, Math.min(adjustedIndex, destinationCollection.groups.length - 1)),
  };
}

function moveRampInCollections(
  collections: WorkspaceCollection[],
  sourceRampId: string,
  targetGroupId: string,
  targetIndex: number,
): MoveRampResult {
  const source = findRampLocation(collections, sourceRampId);
  if (!source) return { collections };

  const nextCollections = cloneCollections(collections);
  const [movedRamp] = nextCollections[source.collectionIndex].groups[source.groupIndex].ramps.splice(source.rampIndex, 1);
  if (!movedRamp) return { collections };

  const destination = findGroupLocation(nextCollections, targetGroupId);
  if (!destination) return { collections };

  const destinationGroup = nextCollections[destination.collectionIndex].groups[destination.groupIndex];
  const sameGroup = source.collectionIndex === destination.collectionIndex && source.groupIndex === destination.groupIndex;
  const clampedIndex = Math.max(0, Math.min(targetIndex, destinationGroup.ramps.length + (sameGroup ? 1 : 0)));
  const adjustedIndex = sameGroup && source.rampIndex < clampedIndex ? clampedIndex - 1 : clampedIndex;

  if (sameGroup && adjustedIndex === source.rampIndex) {
    return { collections };
  }

  destinationGroup.ramps.splice(Math.max(0, Math.min(adjustedIndex, destinationGroup.ramps.length)), 0, movedRamp);

  return {
    collections: nextCollections,
    movedRamp,
    targetCollectionId: nextCollections[destination.collectionIndex].id,
    targetGroupName: destinationGroup.name,
    targetIndex: Math.max(0, Math.min(adjustedIndex, destinationGroup.ramps.length - 1)),
  };
}

function cloneCollections(collections: WorkspaceCollection[]): WorkspaceCollection[] {
  return collections.map((collection) => ({
    ...collection,
    groups: collection.groups.map((group) => ({
      ...group,
      ramps: [...group.ramps],
    })),
  }));
}

function findGroupLocation(collections: WorkspaceCollection[], groupId: string): GroupLocation | undefined {
  for (let collectionIndex = 0; collectionIndex < collections.length; collectionIndex += 1) {
    const groupIndex = collections[collectionIndex].groups.findIndex((group) => group.id === groupId);
    if (groupIndex >= 0) {
      return {
        collectionIndex,
        groupIndex,
        group: collections[collectionIndex].groups[groupIndex],
      };
    }
  }

  return undefined;
}

function findRampLocation(collections: WorkspaceCollection[], rampId: string): RampLocation | undefined {
  for (let collectionIndex = 0; collectionIndex < collections.length; collectionIndex += 1) {
    for (let groupIndex = 0; groupIndex < collections[collectionIndex].groups.length; groupIndex += 1) {
      const rampIndex = collections[collectionIndex].groups[groupIndex].ramps.findIndex((ramp) => ramp.id === rampId);
      if (rampIndex >= 0) {
        return {
          collectionIndex,
          groupIndex,
          rampIndex,
          ramp: collections[collectionIndex].groups[groupIndex].ramps[rampIndex],
        };
      }
    }
  }

  return undefined;
}

function cloneChromaPreset(preset: ChromaPreset): ChromaPreset {
  return { ...preset };
}

function clearCustomStopSync(ramp: RampConfig): RampConfig {
  return {
    ...ramp,
    customStops: [],
    customStopsMidpointLocked: true,
    stops: normalizeStops(ramp.stops),
  };
}

function resyncRampToTheme(ramp: RampConfig, theme: ThemeSettings): RampConfig {
  if (ramp.customStops?.length) {
    return syncCustomStopsToHueEndpoints(ramp, ramp.customStops, theme).ramp;
  }

  if (ramp.anchor) {
    return resnapAnchorStops(ramp, theme);
  }

  return ramp;
}

function syncCustomStopsToHueEndpoints(
  ramp: RampConfig,
  customStops: CustomStopConfig[],
  theme: ThemeSettings,
): { ramp: RampConfig; focusIndex: number } {
  if (customStops.length === 0) {
    return {
      ramp: {
        ...ramp,
        customStops,
        customStopsMidpointLocked: ramp.customStopsMidpointLocked ?? true,
      },
      focusIndex: ramp.anchor?.stop ?? 500,
    };
  }

  const validStops = sortCustomStopsByIndex(
    customStops.filter((stop) => tryCustomStopIndex(stop.color, theme) !== null),
    theme,
  );

  if (validStops.length === 0) {
    return {
      ramp: {
        ...ramp,
        customStops,
        customStopsMidpointLocked: ramp.customStopsMidpointLocked ?? true,
      },
      focusIndex: ramp.anchor?.stop ?? 500,
    };
  }

  const midpointReference = 500;
  const midpointTarget = validStops.reduce((best, stop) => {
    const bestIndex = tryCustomStopIndex(best.color, theme) ?? midpointReference;
    const currentIndex = tryCustomStopIndex(stop.color, theme) ?? midpointReference;
    return Math.abs(currentIndex - midpointReference) < Math.abs(bestIndex - midpointReference) ? stop : best;
  });
  const first = parseOklchColor(validStops[0].color);
  const middle = parseOklchColor(midpointTarget.color);
  const last = parseOklchColor(validStops.at(-1)?.color ?? validStops[0].color);
  const focusStop = clamp(Math.round((tryCustomStopIndex(midpointTarget.color, theme) ?? midpointReference) / 25) * 25, 25, 975);
  return {
    ramp: {
      ...ramp,
      customStops,
      customStopsMidpointLocked: ramp.customStopsMidpointLocked ?? true,
      huePreset: ramp.huePreset
        ? {
            ...ramp.huePreset,
            start: round(first.h, 2),
            center: round(middle.h, 2),
            end: round(last.h, 2),
            centerPosition: clamp((tryCustomStopIndex(midpointTarget.color, theme) ?? midpointReference) / 1000, 0, 1),
            startDirection: 'auto',
            endDirection: 'auto',
          }
        : ramp.huePreset,
      chromaPreset: {
        ...ramp.chromaPreset,
        start: round(first.c, 4),
        center: round(middle.c, 4),
        end: round(last.c, 4),
        centerPosition: clamp((tryCustomStopIndex(midpointTarget.color, theme) ?? midpointReference) / 1000, 0, 1),
      },
    },
    focusIndex: focusStop,
  };
}

function huePresetForRamp(ramp: RampConfig): HuePreset {
  return ramp.huePreset ?? createSeededRampConfig(ramp.name, '#af261d', 0.05, 0.18).huePreset!;
}
