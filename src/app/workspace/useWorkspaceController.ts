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
import { applyImportedWorkspace as applyImportedWorkspaceAction, copyExport as copyExportAction, downloadConfig as downloadConfigAction } from '../io/workspaceIO';
import {
  type AddRampTarget,
  addRampToTree,
  findCollectionIdForRampInTree,
  findRampInTree,
  moveGroupInTree,
  moveRampInTree,
  removeRampFromTree,
} from '../tree/treeActions';
import { migrateCollectionToTree } from '../tree/treeMigration';
import { selectActiveCollection, selectSelectedConfig } from './workspaceSelectors';
import { type CopiedChromaState, initialCollections, initialWorkspaceViewState } from './workspaceState';
import { createInitialRampState, rampReducer } from '../../features/ramp/rampReducer';
import { createWorkspaceExportBundle, parseWorkspaceImport } from '../../features/ramp/workspaceSerialization';
import type { WorkspaceCollection, WorkspaceGroup, WorkspaceRamp } from '../../features/ramp/workspaceTypes';

export function useWorkspaceController() {
  const [state, dispatch] = useReducer(rampReducer, undefined, createInitialRampState);
  const [collections, setCollections] = useState<WorkspaceCollection[]>(() => initialCollections.map(migrateCollectionToTree));
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
  const normalizedCollections = useMemo(() => collections.map(migrateCollectionToTree), [collections]);
  const activeCollection = selectActiveCollection(normalizedCollections, activeCollectionId);
  const selectedRamp = findRampInTree(normalizedCollections, selectedRampId);
  const selectedConfig = selectedRamp?.config ?? selectSelectedConfig(normalizedCollections, activeCollectionId, selectedRampId);
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

    setCollections(result.workspace.collections.map(migrateCollectionToTree));
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
    setCollections(result.collections.map(migrateCollectionToTree));
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

    setCollections(result.collections.map(migrateCollectionToTree));
    setActiveCollectionId(result.activeCollectionId);
    setExpandedCollectionIds(result.expandedCollectionIds);
    setSelectedRampId(result.selectedRampId);
  }

  function renameCollection(collectionId: string, name: string) {
    setCollections((current) => renameCollectionAction(current, collectionId, name).map(migrateCollectionToTree));
  }

  function addGroup() {
    if (!activeCollectionId) return;
    const nextGroupId = `group-${Date.now()}`;
    setCollections((current) =>
      current.map((collection) =>
        collection.id === activeCollectionId
          ? {
              ...collection,
              children: [
                ...getCollectionChildren(collection),
                {
                  type: 'group',
                  id: nextGroupId,
                  group: { id: nextGroupId, name: `New Group ${groupCountInCollection(collection) + 1}`, ramps: [] },
                },
              ],
            }
          : collection,
      ),
    );
  }

  function deleteGroup(groupId: string) {
    setCollections((current) => {
      const nextCollections = current.map((collection) => ({
        ...collection,
        children: getCollectionChildren(collection).filter((node) => !(node.type === 'group' && node.group.id === groupId)),
      }));

      if (findGroupForRamp(current, selectedRampId)?.id === groupId) {
        setSelectedRampId(firstRampId(nextCollections, activeCollectionId));
      }

      return nextCollections;
    });
  }

  function renameGroup(groupId: string, name: string) {
    setCollections((current) =>
      current.map((collection) => ({
        ...collection,
        children: getCollectionChildren(collection).map((node) =>
          node.type === 'group' && node.group.id === groupId ? { ...node, group: { ...node.group, name } } : node,
        ),
      })),
    );
  }

  function renameRamp(rampId: string, name: string) {
    setCollections((current) =>
      current.map((collection) => ({
        ...collection,
        children: getCollectionChildren(collection).map((node) => renameRampNode(node, rampId, name)),
      })),
    );
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

  function addRamp(target: string | AddRampTarget) {
    const newRampId = `ramp-${Date.now()}`;
    const newRamp: WorkspaceRamp = {
      id: newRampId,
      name: 'New Ramp',
      config: createSeededRampConfig('New Ramp', '#2563eb', 0.04, 0.16),
    };
    const resolvedTarget: AddRampTarget = typeof target === 'string' ? { type: 'group', groupId: target } : target;
    setCollections((current) => addRampToTree(current, resolvedTarget, newRamp));
    setSelectedRampId(newRampId);
    const nextCollectionId =
      resolvedTarget.type === 'collection' ? resolvedTarget.collectionId : findCollectionIdForGroup(collections, resolvedTarget.groupId);
    if (nextCollectionId) {
      setActiveCollectionId(nextCollectionId);
      setExpandedCollectionIds((current) => Array.from(new Set([...current, nextCollectionId])));
    }
    setInspectorOpen(true);
  }

  function deleteRamp(rampId: string) {
    setCollections((current) => {
      const nextCollections = removeRampFromTree(current, rampId);
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
      const movedGroup = findGroupLocation(current, sourceGroupId)?.group;
      const nextCollections = moveGroupInTree(current, sourceGroupId, {
        type: 'collection',
        collectionId: targetCollectionId,
        index: targetIndex,
      });
      if (!movedGroup) {
        return current;
      }

      announcement = `Moved ${movedGroup.name} to ${nextCollections.find((collection) => collection.id === targetCollectionId)?.name ?? ''}, position ${targetIndex + 1}.`;
      if (findGroupForRamp(current, selectedRampId)?.id === sourceGroupId) {
        setActiveCollectionId(targetCollectionId);
        setExpandedCollectionIds((expanded) => Array.from(new Set([...expanded, targetCollectionId])));
      }
      return nextCollections;
    });

    if (announcement) {
      setMoveAnnouncement('');
      window.setTimeout(() => setMoveAnnouncement(announcement), 0);
    }
  }

  function moveRamp(sourceRampId: string, target: { type: 'collection'; collectionId: string; index: number } | { type: 'group'; groupId: string; index: number }) {
    let announcement = '';

    setCollections((current) => {
      const movedRamp = findRampInTree(current, sourceRampId);
      const nextCollections = moveRampInTree(current, sourceRampId, target);
      if (!movedRamp) {
        return current;
      }
      const nextCollectionId =
        target.type === 'collection'
          ? target.collectionId
          : findCollectionIdForGroup(nextCollections, target.groupId) ?? findCollectionIdForRampInTree(nextCollections, sourceRampId) ?? '';
      const targetLabel =
        target.type === 'collection'
          ? nextCollections.find((collection) => collection.id === target.collectionId)?.name ?? 'collection'
          : findGroupById(nextCollections, target.groupId)?.name ?? 'group';
      announcement = `Moved ${movedRamp.name} to ${targetLabel}, position ${target.index + 1}.`;
      if (selectedRampId === sourceRampId && nextCollectionId) {
        setActiveCollectionId(nextCollectionId);
        setExpandedCollectionIds((expanded) => Array.from(new Set([...expanded, nextCollectionId])));
      }
      return nextCollections;
    });

    if (announcement) {
      setMoveAnnouncement('');
      window.setTimeout(() => setMoveAnnouncement(announcement), 0);
    }
  }

  function duplicateRamp(rampId: string) {
    const duplicateId = `ramp-${Date.now()}`;
    setCollections((current) => duplicateRampInCollections(current, rampId, duplicateId));
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
    setCollections((current) => updateRampConfigInCollections(current, rampId, updater));
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
        children: getCollectionChildren(collection).map((node) => resyncTreeNodeToTheme(node, nextTheme)),
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
  childIndex: number;
  group: WorkspaceGroup;
}

interface RampLocation {
  collectionIndex: number;
  childIndex: number;
  parentType: 'collection' | 'group';
  parentId: string;
  rampIndex: number;
  ramp: WorkspaceRamp;
}

interface MoveCollectionResult {
  collections: WorkspaceCollection[];
  movedCollection?: WorkspaceCollection;
  targetIndex?: number;
}

function firstRampId(nextCollections: WorkspaceCollection[], collectionId?: string): string {
  const targetCollection = collectionId
    ? nextCollections.find((collection) => collection.id === collectionId)
    : nextCollections[0];
  const fromTarget = firstRampIdInCollection(targetCollection);
  return fromTarget ?? nextCollections.map(firstRampIdInCollection).find(Boolean) ?? '';
}

function findRampById(collections: WorkspaceCollection[], rampId: string): WorkspaceRamp | undefined {
  return findRampInTree(collections, rampId) ?? findRampLocation(collections, rampId)?.ramp;
}

function findCollectionIdForRamp(collections: WorkspaceCollection[], rampId: string): string | undefined {
  const treeCollectionId = findCollectionIdForRampInTree(collections, rampId);
  if (treeCollectionId) {
    return treeCollectionId;
  }

  const location = findRampLocation(collections, rampId);
  return location ? collections[location.collectionIndex]?.id : undefined;
}

function findCollectionIdForGroup(collections: WorkspaceCollection[], groupId: string): string | undefined {
  const location = findGroupLocation(collections, groupId);
  return location ? collections[location.collectionIndex]?.id : undefined;
}

function findGroupForRamp(collections: WorkspaceCollection[], rampId: string): WorkspaceGroup | undefined {
  const location = findRampLocation(collections, rampId);
  if (!location || location.parentType !== 'group') {
    return undefined;
  }

  const collection = collections[location.collectionIndex];
  if (!collection) {
    return undefined;
  }

  return findGroupById(collection, location.parentId);
}

function firstRampIdInCollection(collection?: WorkspaceCollection): string | undefined {
  if (!collection) return undefined;

  for (const node of collection.children ?? []) {
    if (node.type === 'ramp') {
      return node.ramp.id;
    }

    if (node.type === 'group' && node.group.ramps[0]) {
      return node.group.ramps[0].id;
    }
  }

  return undefined;
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

function findGroupLocation(collections: WorkspaceCollection[], groupId: string): GroupLocation | undefined {
  for (let collectionIndex = 0; collectionIndex < collections.length; collectionIndex += 1) {
    const children = getCollectionChildren(collections[collectionIndex]);
    const childIndex = children.findIndex((node) => node.type === 'group' && node.group.id === groupId);
    if (childIndex >= 0) {
      const node = children[childIndex];
      if (node.type !== 'group') {
        continue;
      }
      return {
        collectionIndex,
        childIndex,
        group: node.group,
      };
    }
  }

  return undefined;
}

function findRampLocation(collections: WorkspaceCollection[], rampId: string): RampLocation | undefined {
  for (let collectionIndex = 0; collectionIndex < collections.length; collectionIndex += 1) {
    const collection = collections[collectionIndex];
    const children = getCollectionChildren(collection);
    for (let childIndex = 0; childIndex < children.length; childIndex += 1) {
      const node = children[childIndex];

      if (node.type === 'ramp' && node.ramp.id === rampId) {
        return {
          collectionIndex,
          childIndex,
          parentType: 'collection',
          parentId: collection.id,
          rampIndex: -1,
          ramp: node.ramp,
        };
      }

      if (node.type === 'group') {
        const rampIndex = node.group.ramps.findIndex((ramp) => ramp.id === rampId);
        if (rampIndex >= 0) {
          return {
            collectionIndex,
            childIndex,
            parentType: 'group',
            parentId: node.group.id,
            rampIndex,
            ramp: node.group.ramps[rampIndex],
          };
        }
      }
    }
  }

  return undefined;
}

function findGroupById(collection: WorkspaceCollection, groupId: string): WorkspaceGroup | undefined {
  for (const node of getCollectionChildren(collection)) {
    if (node.type === 'group' && node.group.id === groupId) {
      return node.group;
    }
  }

  return undefined;
}

function groupCountInCollection(collection: WorkspaceCollection): number {
  return getCollectionChildren(collection).filter((node) => node.type === 'group').length;
}

function renameRampNode(node: WorkspaceNode, rampId: string, name: string): WorkspaceNode {
  if (node.type === 'ramp' && node.ramp.id === rampId) {
    return {
      ...node,
      ramp: {
        ...node.ramp,
        name,
        config: { ...node.ramp.config, name },
      },
    };
  }

  if (node.type === 'group') {
    return {
      ...node,
      group: {
        ...node.group,
        ramps: node.group.ramps.map((ramp) =>
          ramp.id === rampId ? { ...ramp, name, config: { ...ramp.config, name } } : ramp,
        ),
      },
    };
  }

  return node;
}

function updateRampConfigInCollections(
  collections: WorkspaceCollection[],
  rampId: string,
  updater: (ramp: RampConfig) => RampConfig,
): WorkspaceCollection[] {
  return collections.map((collection) => ({
    ...collection,
    children: getCollectionChildren(collection).map((node) => updateRampConfigNode(node, rampId, updater)),
  }));
}

function updateRampConfigNode(
  node: WorkspaceNode,
  rampId: string,
  updater: (ramp: RampConfig) => RampConfig,
): WorkspaceNode {
  if (node.type === 'ramp' && node.ramp.id === rampId) {
    return {
      ...node,
      ramp: {
        ...node.ramp,
        config: updater(node.ramp.config),
      },
    };
  }

  if (node.type === 'group') {
    return {
      ...node,
      group: {
        ...node.group,
        ramps: node.group.ramps.map((ramp) => (ramp.id === rampId ? { ...ramp, config: updater(ramp.config) } : ramp)),
      },
    };
  }

  return node;
}

function duplicateRampInCollections(
  collections: WorkspaceCollection[],
  rampId: string,
  duplicateRampId: string,
): WorkspaceCollection[] {
  const sourceRamp = findRampInTree(collections, rampId);
  if (!sourceRamp) {
    return collections;
  }

  const duplicate: WorkspaceRamp = {
    ...sourceRamp,
    id: duplicateRampId,
    name: `${sourceRamp.name} Copy`,
    config: {
      ...sourceRamp.config,
      name: `${sourceRamp.name} Copy`,
      stops: [...sourceRamp.config.stops],
      customStops: [...(sourceRamp.config.customStops ?? [])],
      chromaPreset: { ...sourceRamp.config.chromaPreset },
      huePreset: sourceRamp.config.huePreset ? { ...sourceRamp.config.huePreset } : undefined,
    },
  };

  return collections.map((collection) => ({
    ...collection,
    children: duplicateRampNodeInChildren(getCollectionChildren(collection), rampId, duplicate),
  }));
}

function duplicateRampNodeInChildren(children: WorkspaceNode[], rampId: string, duplicate: WorkspaceRamp): WorkspaceNode[] {
  const nextChildren: WorkspaceNode[] = [];

  for (const node of children) {
    if (node.type === 'ramp') {
      nextChildren.push(node);
      if (node.ramp.id === rampId) {
        nextChildren.push({ type: 'ramp', id: duplicate.id, ramp: duplicate });
      }
      continue;
    }

    if (node.type === 'group') {
      const group = {
        ...node.group,
      };
      const rampIndex = node.group.ramps.findIndex((ramp) => ramp.id === rampId);
      if (rampIndex >= 0) {
        group.ramps = [
          ...node.group.ramps.slice(0, rampIndex + 1),
          duplicate,
          ...node.group.ramps.slice(rampIndex + 1),
        ];
      } else {
        group.ramps = [...node.group.ramps];
      }
      nextChildren.push({ type: 'group', id: node.id, group });
    }
  }

  return nextChildren;
}

function cloneChromaPreset(preset: ChromaPreset): ChromaPreset {
  return { ...preset };
}

function getCollectionChildren(collection: WorkspaceCollection) {
  return Array.isArray(collection.children) ? collection.children : [];
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
