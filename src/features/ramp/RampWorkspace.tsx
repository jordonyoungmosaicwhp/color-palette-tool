import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  SunMedium,
} from 'lucide-react';
import {
  Collapsible,
  IconButton,
  SegmentedControl,
} from '../../design-system';
import {
  createDefaultConfig,
  createSeededRampConfig,
  clamp,
  deleteStop,
  generateRamp,
  customStopCollisionIndices,
  insertStopBetween,
  normalizeStops,
  parseOklchColor,
  resnapAnchorStops,
  round,
  toggleStopVisibility,
  updateRampStops,
  validateGeneratedStops,
  sortCustomStopsByIndex,
  tryCustomStopIndex,
} from '../../lib/color';
import type { ChromaPreset, DisplayMode, HuePreset, RampConfig, CustomStopConfig, ThemeSettings } from '../../lib/color';
import {
  type CopiedChromaState,
  initialWorkspaceViewState,
  initialCollections,
} from '../../app/workspace/workspaceState';
import { ChromaControls } from '../../ui/features/controls/ChromaControls';
import { CustomStopsControls } from '../../ui/features/controls/CustomStopsControls';
import { HueControls } from '../../ui/features/controls/HueControls';
import { ExportDialog } from '../../ui/features/export/ExportDialog';
import { ImportPopover } from '../../ui/features/export/ImportPopover';
import { SettingsPopover } from '../../ui/features/settings/SettingsPopover';
import { createInitialRampState, rampReducer } from './rampReducer';
import { PaletteGroupSection } from './components/PaletteGroupSection';
import { PaletteSidebar } from './components/PaletteSidebar';
import type { RampDisplayOptions, WorkspaceCollection, WorkspaceGroup, WorkspaceRamp } from './workspaceTypes';
import { createWorkspaceExportBundle, parseWorkspaceImport } from './workspaceSerialization';
import styles from './RampWorkspace.module.scss';

export function RampWorkspace() {
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
  const [displayOptions, setDisplayOptions] = useState<RampDisplayOptions>(initialWorkspaceViewState.displayOptions);
  const [accordionSection, setAccordionSection] = useState(initialWorkspaceViewState.accordionSection);
  const [copied, setCopied] = useState(initialWorkspaceViewState.copied);
  const [copiedChroma, setCopiedChroma] = useState<CopiedChromaState | null>(initialWorkspaceViewState.copiedChroma);
  const [moveAnnouncement, setMoveAnnouncement] = useState(initialWorkspaceViewState.moveAnnouncement);
  const [pendingCustomStopFocusId, setPendingCustomStopFocusId] = useState<string | null>(
    initialWorkspaceViewState.pendingCustomStopFocusId,
  );
  const activeCollection = collections.find((collection) => collection.id === activeCollectionId) ?? collections[0];
  const selectedRamp = findRampById(collections, selectedRampId);
  const selectedConfig =
    selectedRamp?.config ??
    activeCollection?.groups.flatMap((group) => group.ramps)[0]?.config ??
    collections[0]?.groups.flatMap((group) => group.ramps)[0]?.config ??
    createDefaultConfig().ramp;
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
    if (hasBlockingIssues) return;
    await navigator.clipboard.writeText(exportValue);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  function downloadConfig() {
    if (hasBlockingIssues) return;
    const exportedValue = exportValue;
    const extension = state.exportFormat === 'css' ? 'css' : state.exportFormat === 'table' ? 'txt' : 'json';
    const blob = new Blob([exportedValue], {
      type: state.exportFormat === 'css' ? 'text/css' : state.exportFormat === 'table' ? 'text/plain' : 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `palette-ramp.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function applyImportedWorkspace() {
    const result = parseWorkspaceImport(importDraft);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }

    const nextWorkspace = result.value;
    const nextActiveCollection = nextWorkspace.collections[0];
    const nextSelectedRamp =
      nextActiveCollection?.groups.flatMap((group) => group.ramps).find((ramp) => ramp.id === nextWorkspace.selectedRampId) ??
      nextActiveCollection?.groups.flatMap((group) => group.ramps)[0];

    setCollections(nextWorkspace.collections);
    setActiveCollectionId(nextActiveCollection?.id ?? '');
    setExpandedCollectionIds(nextActiveCollection ? [nextActiveCollection.id] : []);
    setSelectedRampId(nextSelectedRamp?.id ?? '');
    setDisplayOptions(nextWorkspace.displayOptions);
    dispatch({
      type: 'replace-workspace',
      value: {
        theme: nextWorkspace.theme,
        displayMode: nextWorkspace.displayMode,
        selectedStop: nextWorkspace.selectedStop,
        showHiddenStops: nextWorkspace.displayOptions.allowHiddenStops,
        ramp: nextSelectedRamp?.config,
      },
    });
    setImportError(null);
    setImportOpen(false);
  }

  function addCollection() {
    const nextIndex = collections.length + 1;
    const nextCollection: WorkspaceCollection = {
      id: `collection-${Date.now()}`,
      name: `New Collection ${nextIndex}`,
      groups: [],
    };

    setCollections((current) => [...current, nextCollection]);
    setActiveCollectionId(nextCollection.id);
    setExpandedCollectionIds((current) => Array.from(new Set([...current, nextCollection.id])));
    setSelectedRampId('');
  }

  function firstRampId(nextCollections: WorkspaceCollection[], collectionId?: string): string {
    const targetCollection = collectionId
      ? nextCollections.find((collection) => collection.id === collectionId)
      : nextCollections[0];
    const fromTarget = targetCollection?.groups.flatMap((group) => group.ramps)[0]?.id;
    return fromTarget ?? nextCollections.flatMap((collection) => collection.groups.flatMap((group) => group.ramps))[0]?.id ?? '';
  }

  function selectCollection(collectionId: string) {
    setActiveCollectionId(collectionId);
    setExpandedCollectionIds((current) => Array.from(new Set([...current, collectionId])));
    setSelectedRampId('');
    setInspectorOpen(true);
  }

  function toggleCollection(collectionId: string) {
    setExpandedCollectionIds((current) =>
      current.includes(collectionId) ? current.filter((id) => id !== collectionId) : [...current, collectionId],
    );
  }

  function deleteCollection(collectionId: string) {
    setCollections((current) => {
      const nextCollections = current.filter((collection) => collection.id !== collectionId);
      const nextActiveCollectionId = activeCollectionId === collectionId ? nextCollections[0]?.id ?? '' : activeCollectionId;
      const selectedCollectionId = selectedRampId ? findCollectionIdForRamp(current, selectedRampId) : undefined;

      setActiveCollectionId(nextActiveCollectionId);
      setExpandedCollectionIds((expanded) => expanded.filter((id) => id !== collectionId));

      if (selectedCollectionId === collectionId) {
        setSelectedRampId(firstRampId(nextCollections, nextActiveCollectionId));
      }

      return nextCollections;
    });
  }

  function renameCollection(collectionId: string, name: string) {
    setCollections((current) => current.map((collection) => (collection.id === collectionId ? { ...collection, name } : collection)));
  }

  function addGroup() {
    if (!activeCollectionId) return;

    setCollections((current) =>
      current.map((collection) =>
        collection.id === activeCollectionId
          ? {
              ...collection,
              groups: [
                ...collection.groups,
                {
                  id: `group-${Date.now()}`,
                  name: `New Group ${collection.groups.length + 1}`,
                  ramps: [],
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
        groups: collection.groups.filter((group) => group.id !== groupId),
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
        groups: collection.groups.map((group) => (group.id === groupId ? { ...group, name } : group)),
      })),
    );
  }

  function renameRamp(rampId: string, name: string) {
    setCollections((current) =>
      current.map((collection) => ({
        ...collection,
        groups: collection.groups.map((group) => ({
          ...group,
          ramps: group.ramps.map((ramp) => (ramp.id === rampId ? { ...ramp, name, config: { ...ramp.config, name } } : ramp)),
        })),
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

  function addRamp(groupId: string) {
    const newRamp = createWorkspaceRamp(`ramp-${Date.now()}`, 'New Ramp', '#2563eb', 0.04, 0.16);
    setCollections((current) =>
      current.map((collection) => ({
        ...collection,
        groups: collection.groups.map((group) => (group.id === groupId ? { ...group, ramps: [...group.ramps, newRamp] } : group)),
      })),
    );
    setSelectedRampId(newRamp.id);
    const nextCollectionId = findCollectionIdForGroup(collections, groupId);
    if (nextCollectionId) {
      setActiveCollectionId(nextCollectionId);
      setExpandedCollectionIds((current) => Array.from(new Set([...current, nextCollectionId])));
    }
    setInspectorOpen(true);
  }

  function deleteRamp(rampId: string) {
    setCollections((current) => {
      const nextCollections = current.map((collection) => ({
        ...collection,
        groups: collection.groups.map((group) => ({
          ...group,
          ramps: group.ramps.filter((ramp) => ramp.id !== rampId),
        })),
      }));
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
    setCollections((current) =>
      current.map((collection) => ({
        ...collection,
        groups: collection.groups.map((group) => {
          const ramp = group.ramps.find((item) => item.id === rampId);
          if (!ramp) return group;
          const duplicate: WorkspaceRamp = {
            ...ramp,
            id: `ramp-${Date.now()}`,
            name: `${ramp.name} Copy`,
            config: {
              ...ramp.config,
              name: `${ramp.name} Copy`,
              stops: [...ramp.config.stops],
              customStops: [...(ramp.config.customStops ?? [])],
              chromaPreset: { ...ramp.config.chromaPreset },
              huePreset: ramp.config.huePreset ? { ...ramp.config.huePreset } : undefined,
            },
          };
          setSelectedRampId(duplicate.id);
          setInspectorOpen(true);
          return { ...group, ramps: [...group.ramps, duplicate] };
        }),
      })),
    );
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
    setCollections((current) =>
      current.map((collection) => ({
        ...collection,
        groups: collection.groups.map((group) => ({
          ...group,
          ramps: group.ramps.map((ramp) => (ramp.id === rampId ? { ...ramp, config: updater(ramp.config) } : ramp)),
        })),
      })),
    );
  }

  function addCustomStop(rampId: string) {
    const nextCustomStopId = `custom-stop-${Date.now()}`;
    const nextCustomStops = [...(selectedRamp?.config.customStops ?? []), { id: nextCustomStopId, color: '' }];
    const sync = syncCustomStopsToHueEndpoints(selectedRamp?.config ?? selectedConfig, nextCustomStops, state.config.theme);
    updateRampConfig(rampId, () => sync.ramp);
    setPendingCustomStopFocusId(nextCustomStopId);
  }

  function updateCustomStopColor(rampId: string, stopId: string, color: string) {
    const nextCustomStops = (selectedRamp?.config.customStops ?? []).map((stop) => (stop.id === stopId ? { ...stop, color } : stop));
    const sync = syncCustomStopsToHueEndpoints(selectedRamp?.config ?? selectedConfig, nextCustomStops, state.config.theme);
    updateRampConfig(rampId, () => sync.ramp);
    dispatch({ type: 'select-stop', index: sync.focusIndex });
    setPendingCustomStopFocusId(null);
  }

  function removeCustomStop(rampId: string, stopId: string) {
    const nextCustomStops = (selectedRamp?.config.customStops ?? []).filter((stop) => stop.id !== stopId);
    if (nextCustomStops.length === 0) {
      const nextRamp = clearCustomStopSync(selectedRamp?.config ?? selectedConfig);
      updateRampConfig(rampId, () => nextRamp);
      dispatch({ type: 'select-stop', index: 500 });
      setPendingCustomStopFocusId((current) => (current === stopId ? null : current));
      return;
    }

    const sync = syncCustomStopsToHueEndpoints(selectedRamp?.config ?? selectedConfig, nextCustomStops, state.config.theme);
    updateRampConfig(rampId, () => sync.ramp);
    dispatch({ type: 'select-stop', index: sync.focusIndex });
    setPendingCustomStopFocusId((current) => (current === stopId ? null : current));
  }

  function huePresetForRamp(ramp: RampConfig): HuePreset {
    return ramp.huePreset ?? createSeededRampConfig(ramp.name, '#af261d', 0.05, 0.18).huePreset!;
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

  return (
    <div className={styles.appFrame} data-theme={uiTheme}>
      <header className={styles.topNav}>
        <div className={styles.topTitleRow}>
          <IconButton
            label={sidebarCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
            icon={sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            variant="ghost"
            size="md"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          />
          <h1>OKLCH Palette Tool</h1>
        </div>
        <div className={styles.topActions}>
          <SegmentedControl<DisplayMode>
            label="View mode"
            value={state.config.displayMode}
            items={[
              { value: 'column', label: <>Column</> },
              { value: 'row', label: <>Row</> },
            ]}
            onValueChange={(value) => dispatch({ type: 'set-display-mode', value })}
          />
          <IconButton
            label={uiTheme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            icon={uiTheme === 'light' ? <Moon size={17} /> : <SunMedium size={17} />}
            variant="ghost"
            size="md"
            onClick={() => setUiTheme((theme) => (theme === 'light' ? 'dark' : 'light'))}
          />
          <SettingsPopover
            lMax={state.config.theme.lMax}
            lMin={state.config.theme.lMin}
            displayOptions={displayOptions}
            onLMaxChange={(value) => {
              const nextTheme = {
                ...state.config.theme,
                lMax: clamp(value, state.config.theme.lMin + 0.01, 1),
              };
              dispatch({ type: 'set-lmax', value });
              applyThemeChange(nextTheme);
            }}
            onLMinChange={(value) => {
              const nextTheme = {
                ...state.config.theme,
                lMin: clamp(value, 0, state.config.theme.lMax - 0.01),
              };
              dispatch({ type: 'set-lmin', value });
              applyThemeChange(nextTheme);
            }}
            onDisplayOptionsChange={setDisplayOptions}
          />
          <ImportPopover
            open={importOpen}
            value={importDraft}
            error={importError}
            onOpenChange={(open) => {
              setImportOpen(open);
              setImportError(null);
            }}
            onValueChange={setImportDraft}
            onApply={applyImportedWorkspace}
          />
          <ExportDialog
            exportValue={exportValue}
            validation={validation}
            exportFormat={state.exportFormat}
            copied={copied}
            onCopy={copyExport}
            onDownload={downloadConfig}
            onFormatChange={(value) => dispatch({ type: 'set-export-format', value })}
          />
          <IconButton
            label={inspectorOpen ? 'Collapse ramp properties' : 'Open ramp properties'}
            icon={inspectorOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
            variant="ghost"
            size="md"
            onClick={() => {
              setInspectorOpen((open) => !open);
              if (inspectorOpen) setSelectedRampId('');
            }}
          />
        </div>
      </header>

      <div className={styles.productShell} data-inspector={inspectorOpen ? 'open' : 'closed'} data-sidebar={sidebarCollapsed ? 'collapsed' : 'open'}>
        <PaletteSidebar
          collections={collections}
          activeCollectionId={activeCollection?.id ?? ''}
          expandedCollectionIds={expandedCollectionIds}
          selectedRampId={selectedRampId}
          onAddCollection={addCollection}
          onRenameCollection={renameCollection}
          onDeleteCollection={deleteCollection}
          onSelectCollection={selectCollection}
          onToggleCollection={toggleCollection}
          onSelectRamp={selectRamp}
          onMoveCollection={moveCollection}
          onMoveGroup={moveGroup}
          onMoveRamp={moveRamp}
          collapsed={sidebarCollapsed}
        />

        <main className={styles.workspace}>
          {(activeCollection?.groups ?? []).map((group) => (
            <PaletteGroupSection
              key={group.id}
              group={group}
              selectedRampId={selectedRampId}
              theme={state.config.theme}
              displayOptions={displayOptions}
              view={state.config.displayMode}
              canDeleteGroup={(activeCollection?.groups.length ?? 0) > 1}
              onRenameGroup={renameGroup}
              onRenameRamp={renameRamp}
              onAddRamp={addRamp}
              onDeleteGroup={deleteGroup}
              onSelectRamp={selectRamp}
              onSelectStop={(index) => dispatch({ type: 'select-stop', index })}
              onInsertStop={insertStopForRamp}
              onToggleVisibility={toggleStopForRamp}
              onDeleteStop={deleteStopForRamp}
              onDeleteRamp={deleteRamp}
              onDuplicateRamp={duplicateRamp}
              onClearMinorStops={clearMinorStops}
              copiedChromaSourceId={copiedChroma?.sourceRampId ?? null}
              canPasteChroma={Boolean(copiedChroma)}
              onCopyChroma={copyChroma}
              onPasteChroma={pasteChroma}
            />
          ))}

          <button className={styles.addSection} onClick={addGroup}>
            <span />
            <strong>New Group</strong>
            <span />
          </button>
        </main>

        {inspectorOpen ? (
          <aside className={styles.properties}>
            {selectedRamp ? (
              <div className={styles.propertiesInner}>
                <div>
                  <p className={styles.kicker}>Ramp Properties</p>
                  <h2>{selectedName}</h2>
                </div>

                <section className={styles.propertySection} data-section="hue">
                  <Collapsible
                    title="Hue"
                    open={accordionSection === 'hue'}
                    onOpenChange={(open) => {
                      setAccordionSection(open ? 'hue' : null);
                    }}
                  >
                    <div className={styles.sectionControls}>
                      <HueControls
                        preset={huePresetForRamp(selectedRamp.config)}
                        customStopCount={customStops.length}
                        midpointLocked={customStopsMidpointLocked}
                        onChange={(value) => updateHuePreset(selectedRamp.id, value)}
                        onMidpointLockChange={(locked) =>
                          updateRampConfig(selectedRamp.id, (ramp) => ({
                            ...ramp,
                            customStopsMidpointLocked: locked,
                          }))
                        }
                      />
                    </div>
                  </Collapsible>
                </section>

                <section className={styles.propertySection} data-section="chroma">
                  <Collapsible
                    title="Chroma"
                    open={accordionSection === 'chroma'}
                    onOpenChange={(open) => {
                      setAccordionSection(open ? 'chroma' : null);
                    }}
                  >
                    <div className={styles.sectionControls}>
                      <ChromaControls
                        preset={selectedRamp.config.chromaPreset}
                        customStopCount={customStops.length}
                        midpointLocked={customStopsMidpointLocked}
                        onChange={(value) =>
                          updateRampConfig(selectedRamp.id, (ramp) => ({
                            ...ramp,
                            chromaPreset: { ...ramp.chromaPreset, ...value },
                          }))
                        }
                        onMidpointLockChange={(locked) =>
                          updateRampConfig(selectedRamp.id, (ramp) => ({
                            ...ramp,
                            customStopsMidpointLocked: locked,
                          }))
                        }
                      />
                    </div>
                  </Collapsible>
                </section>

                <section className={styles.propertySection} data-section="custom-stops">
                  <Collapsible
                    title="Custom Stops"
                    open={accordionSection === 'customStops'}
                    onOpenChange={(open) => {
                      setAccordionSection(open ? 'customStops' : null);
                    }}
                  >
                    <div className={styles.sectionControls}>
                      <CustomStopsControls
                        theme={state.config.theme}
                        customStops={customStops}
                        collisions={selectedCustomStopCollisions}
                        focusStopId={pendingCustomStopFocusId}
                        onFocusStopIdConsumed={() => setPendingCustomStopFocusId(null)}
                        onAddStop={() => addCustomStop(selectedRamp.id)}
                        onUpdateStop={(stopId, color) => updateCustomStopColor(selectedRamp.id, stopId, color)}
                        onDeleteStop={(stopId) => removeCustomStop(selectedRamp.id, stopId)}
                      />
                    </div>
                  </Collapsible>
                </section>
              </div>
            ) : (
              <div className={styles.emptyInspector}>🎨 Select a ramp to customize</div>
            )}
          </aside>
        ) : null}
      </div>
      <div className={styles.visuallyHidden} aria-live="polite" aria-atomic="true">
        {moveAnnouncement}
      </div>
    </div>
  );
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

function createWorkspaceRamp(id: string, name: string, color: string, chromaStart: number, chromaEnd: number): WorkspaceRamp {
  return {
    id,
    name,
    config: createSeededRampConfig(name, color, chromaStart, chromaEnd),
  };
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
