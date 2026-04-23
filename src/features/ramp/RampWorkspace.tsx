import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  Copy,
  Download,
  Lock,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Settings,
  Share2,
  Upload,
  SunMedium,
  Trash2,
} from 'lucide-react';
import {
  Button,
  CodeBlock,
  Collapsible,
  Dialog,
  IconButton,
  InlineSliderField,
  NumberField,
  Popover,
  SegmentedControl,
  ToggleButton,
  SwitchField,
  TextAreaField,
  TextField,
  Badge,
} from '../../design-system';
import {
  createDefaultConfig,
  createSeededRampConfig,
  deleteStop,
  generateRamp,
  customStopIndex,
  customStopCollisionIndices,
  insertStopBetween,
  toggleStopVisibility,
  updateRampStops,
  validateGeneratedStops,
  sortCustomStopsByIndex,
} from '../../lib/color';
import type { ChromaPreset, DisplayMode, HueDirection, HuePreset, RampConfig, CustomStopConfig, ThemeSettings } from '../../lib/color';
import { createInitialRampState, rampReducer } from './rampReducer';
import { PaletteGroupSection } from './components/PaletteGroupSection';
import { PaletteSidebar } from './components/PaletteSidebar';
import type { RampDisplayOptions, PaletteGroup, WorkspaceRamp } from './workspaceTypes';
import { createWorkspaceExportBundle, parseWorkspaceImport } from './workspaceSerialization';
import styles from './RampWorkspace.module.scss';

const initialGroups: PaletteGroup[] = [
  {
    id: 'neutral-brand',
    name: 'Neutral & Brand',
    ramps: [
      createWorkspaceRamp('neutral', 'Neutral', '#5e5e5e', 0.02, 0.05),
      createWorkspaceRamp('red', 'Red', '#af261d', 0.05, 0.18),
    ],
  },
  {
    id: 'utility',
    name: 'Utility',
    ramps: [
      createWorkspaceRamp('blue', 'Blue', '#2563eb', 0.04, 0.16),
      createWorkspaceRamp('green', 'Green', '#16a34a', 0.04, 0.16),
      createWorkspaceRamp('yellow', 'Yellow', '#ca8a04', 0.04, 0.16),
      createWorkspaceRamp('orange', 'Orange', '#ea580c', 0.04, 0.16),
    ],
  },
];

export function RampWorkspace() {
  const [state, dispatch] = useReducer(rampReducer, undefined, createInitialRampState);
  const [groups, setGroups] = useState<PaletteGroup[]>(initialGroups);
  const [selectedRampId, setSelectedRampId] = useState('red');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [uiTheme, setUiTheme] = useState<'light' | 'dark'>('light');
  const [importOpen, setImportOpen] = useState(false);
  const [importDraft, setImportDraft] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [displayOptions, setDisplayOptions] = useState<RampDisplayOptions>({
    allowHiddenStops: true,
    showHex: false,
    showLightness: false,
    showChroma: false,
    showHue: false,
  });
  const [accordionSection, setAccordionSection] = useState<'hue' | 'chroma' | 'customStops' | null>('hue');
  const [copied, setCopied] = useState(false);
  const [copiedChroma, setCopiedChroma] = useState<{ sourceRampId: string; preset: ChromaPreset } | null>(null);
  const selectedRamp = groups.flatMap((group) => group.ramps).find((ramp) => ramp.id === selectedRampId);
  const selectedConfig = selectedRamp?.config ?? groups[0]?.ramps[0]?.config ?? createDefaultConfig().ramp;
  const selectedGeneratedStops = generateRamp(state.config.theme, selectedConfig);
  const validation = validateGeneratedStops(selectedGeneratedStops);
  const customStops = selectedRamp?.config.customStops ?? [];
  const customStopsActive = customStops.length > 0;
  const selectedCustomStopCollisions = customStopCollisionIndices(customStops, state.config.theme);
  const hasCustomStopCollisions = selectedCustomStopCollisions.length > 0;
  const hasBlockingIssues = validation.hasBlockingIssues || hasCustomStopCollisions;
  const exportBundle = useMemo(
    () =>
      createWorkspaceExportBundle({
        theme: state.config.theme,
        displayMode: state.config.displayMode,
        displayOptions,
        selectedRampId,
        selectedStop: state.selectedStop,
        groups,
      }),
    [displayOptions, groups, selectedRampId, state.config.displayMode, state.config.theme, state.selectedStop],
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
    const nextSelectedRamp =
      nextWorkspace.groups.flatMap((group) => group.ramps).find((ramp) => ramp.id === nextWorkspace.selectedRampId) ??
      nextWorkspace.groups.flatMap((group) => group.ramps)[0];

    setGroups(nextWorkspace.groups);
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

  function addGroup() {
    const nextIndex = groups.length + 1;
    setGroups((current) => [
      ...current,
      {
        id: `group-${Date.now()}`,
        name: `New Group ${nextIndex}`,
        ramps: [],
      },
    ]);
  }

  function firstRampId(nextGroups: PaletteGroup[]): string {
    return nextGroups.flatMap((group) => group.ramps)[0]?.id ?? '';
  }

  function deleteGroup(groupId: string) {
    setGroups((current) => {
      const nextGroups = current.filter((group) => group.id !== groupId);
      if (current.find((group) => group.id === groupId)?.ramps.some((ramp) => ramp.id === selectedRampId)) {
        setSelectedRampId(firstRampId(nextGroups));
      }
      return nextGroups;
    });
  }

  function renameGroup(groupId: string, name: string) {
    setGroups((current) => current.map((group) => (group.id === groupId ? { ...group, name } : group)));
  }

  function renameRamp(rampId: string, name: string) {
    setGroups((current) =>
      current.map((group) => ({
        ...group,
        ramps: group.ramps.map((ramp) => (ramp.id === rampId ? { ...ramp, name, config: { ...ramp.config, name } } : ramp)),
      })),
    );
  }

  function copyChroma(rampId: string) {
    const ramp = groups.flatMap((group) => group.ramps).find((item) => item.id === rampId);
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
    setSelectedRampId(rampId);
    setInspectorOpen(true);
  }

  function addRamp(groupId: string) {
    const newRamp = createWorkspaceRamp(`ramp-${Date.now()}`, 'New Ramp', '#2563eb', 0.04, 0.16);
    setGroups((current) =>
      current.map((group) => (group.id === groupId ? { ...group, ramps: [...group.ramps, newRamp] } : group)),
    );
    setSelectedRampId(newRamp.id);
    setInspectorOpen(true);
  }

  function deleteRamp(rampId: string) {
    setGroups((current) => {
      const nextGroups = current.map((group) => ({ ...group, ramps: group.ramps.filter((ramp) => ramp.id !== rampId) }));
      if (selectedRampId === rampId) setSelectedRampId(firstRampId(nextGroups));
      return nextGroups;
    });
  }

  function duplicateRamp(rampId: string) {
    setGroups((current) =>
      current.map((group) => {
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
    setGroups((current) =>
      current.map((group) => ({
        ...group,
        ramps: group.ramps.map((ramp) => (ramp.id === rampId ? { ...ramp, config: updater(ramp.config) } : ramp)),
      })),
    );
  }

  function addCustomStop(rampId: string) {
    updateRampConfig(rampId, (ramp) => ({
      ...ramp,
      huePreset: ramp.huePreset ? { ...ramp.huePreset, direction: 'auto' } : ramp.huePreset,
      customStops: [...(ramp.customStops ?? []), { id: `custom-stop-${Date.now()}`, color: '#af261d' }],
    }));
  }

  function updateCustomStopColor(rampId: string, stopId: string, color: string) {
    updateRampConfig(rampId, (ramp) => ({
      ...ramp,
      customStops: (ramp.customStops ?? []).map((stop) => (stop.id === stopId ? { ...stop, color } : stop)),
    }));
  }

  function removeCustomStop(rampId: string, stopId: string) {
    updateRampConfig(rampId, (ramp) => ({
      ...ramp,
      customStops: (ramp.customStops ?? []).filter((stop) => stop.id !== stopId),
    }));
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
        direction: next.direction ?? huePresetForRamp(ramp).direction,
      },
    }));
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
              dispatch({ type: 'set-lmax', value });
            }}
            onLMinChange={(value) => {
              dispatch({ type: 'set-lmin', value });
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
          groups={groups}
          selectedRampId={selectedRampId}
          onAddGroup={addGroup}
          onSelectRamp={selectRamp}
          collapsed={sidebarCollapsed}
        />

        <main className={styles.workspace}>
          {groups.map((group) => (
            <PaletteGroupSection
              key={group.id}
              group={group}
              selectedRampId={selectedRampId}
              theme={state.config.theme}
              displayOptions={displayOptions}
              view={state.config.displayMode}
              canDeleteGroup={groups.length > 1}
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
                        midpointLocked={customStopsActive}
                        onChange={(value) => updateHuePreset(selectedRamp.id, value)}
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
                        midpointLocked={customStopsActive}
                        onChange={(value) =>
                          updateRampConfig(selectedRamp.id, (ramp) => ({
                            ...ramp,
                            chromaPreset: { ...ramp.chromaPreset, ...value },
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
    </div>
  );
}

interface ImportPopoverProps {
  open: boolean;
  value: string;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onValueChange: (value: string) => void;
  onApply: () => void;
}

function ImportPopover({ open, value, error, onOpenChange, onValueChange, onApply }: ImportPopoverProps) {
  return (
    <Popover
      title="Import workspace"
      width="lg"
      open={open}
      onOpenChange={(details) => onOpenChange(details.open)}
      trigger={
        <Button size="sm" variant="secondary" icon={<Upload size={14} />}>
          Import
        </Button>
      }
    >
      <div className={styles.importPanel}>
        <TextAreaField
          label="Workspace JSON"
          value={value}
          placeholder="Paste exported workspace JSON here"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          onChange={(event) => onValueChange(event.currentTarget.value)}
        />
        {error ? (
          <div className={styles.validationCallout} role="alert">
            {error}
          </div>
        ) : null}
        <div className={styles.importActions}>
          <Button size="sm" variant="primary" onClick={onApply}>
            Apply
          </Button>
        </div>
      </div>
    </Popover>
  );
}

interface HueControlsProps {
  preset: HuePreset;
  midpointLocked: boolean;
  onChange: (value: Partial<HuePreset>) => void;
}

function HueControls({ preset, midpointLocked, onChange }: HueControlsProps) {
  return (
    <div className={styles.hueControls}>
      <fieldset className={styles.chromaFieldset}>
        <legend>Start</legend>
        <div className={styles.chromaFieldsetControls}>
          <InlineSliderField
            label="Hue"
            value={Math.round(preset.start)}
            min={0}
            max={360}
            step={1}
            displayValue={String(Math.round(preset.start))}
            onValueChange={(value) => onChange({ start: value })}
          />
          <InlineSliderField
            label="Shape"
            value={preset.startShape}
            min={0}
            max={1}
            step={0.01}
            displayValue={preset.startShape.toFixed(2)}
            onValueChange={(value) => onChange({ startShape: value })}
          />
        </div>
      </fieldset>
      <fieldset className={styles.chromaFieldset}>
        <legend className={styles.chromaFieldsetLegend}>
          <span>Midpoint</span>
          {midpointLocked ? (
            <>
              <span className={styles.chromaFieldsetDivider} aria-hidden="true" />
              <span className={styles.chromaFieldsetLock}>
                <Lock size={14} />
                Auto
              </span>
            </>
          ) : null}
        </legend>
        {midpointLocked ? (
          <p className={styles.chromaFieldsetHint}>Midpoint is determined automatically when custom stops are active.</p>
        ) : null}
        <div className={styles.chromaFieldsetControls}>
          <InlineSliderField
            label="Hue"
            value={Math.round(preset.center)}
            min={0}
            max={360}
            step={1}
            displayValue={String(Math.round(preset.center))}
            readOnly={midpointLocked}
            disabled={midpointLocked}
            onValueChange={(value) => onChange({ center: value })}
          />
          <InlineSliderField
            label="Position"
            value={preset.centerPosition}
            min={0}
            max={1}
            step={0.01}
            displayValue={Math.round(preset.centerPosition * 100).toString()}
            suffix="%"
            readOnly={midpointLocked}
            disabled={midpointLocked}
            onValueChange={(value) => onChange({ centerPosition: value })}
          />
        </div>
      </fieldset>
      <fieldset className={styles.chromaFieldset}>
        <legend>End</legend>
        <div className={styles.chromaFieldsetControls}>
          <InlineSliderField
            label="Hue"
            value={Math.round(preset.end)}
            min={0}
            max={360}
            step={1}
            displayValue={String(Math.round(preset.end))}
            onValueChange={(value) => onChange({ end: value })}
          />
          <InlineSliderField
            label="Shape"
            value={preset.endShape}
            min={0}
            max={1}
            step={0.01}
            displayValue={preset.endShape.toFixed(2)}
            onValueChange={(value) => onChange({ endShape: value })}
          />
        </div>
      </fieldset>
      <div className={styles.hueDirectionControl}>
        <div className={styles.hueDirectionLabel}>Direction</div>
        <SegmentedControl<HueDirection>
          label="Hue direction"
          value={midpointLocked ? 'auto' : preset.direction}
          items={[
            { value: 'auto', label: 'Auto', disabled: midpointLocked },
            { value: 'clockwise', label: 'Clockwise', disabled: midpointLocked },
            { value: 'counterclockwise', label: 'Counterclockwise', disabled: midpointLocked },
          ]}
          onValueChange={(value) => {
            if (!midpointLocked) onChange({ direction: value });
          }}
        />
      </div>
    </div>
  );
}

interface ChromaControlsProps {
  preset: ChromaPreset;
  midpointLocked: boolean;
  onChange: (value: Partial<ChromaPreset>) => void;
}

function ChromaControls({ preset, midpointLocked, onChange }: ChromaControlsProps) {
  return (
    <div className={styles.chromaControls}>
      <fieldset className={styles.chromaFieldset}>
        <legend>Start</legend>
        <div className={styles.chromaFieldsetControls}>
          <InlineSliderField
            label="Chroma"
            value={preset.start}
            min={0}
            max={0.5}
            step={0.001}
            displayValue={preset.start.toFixed(3)}
            onValueChange={(value) => onChange({ start: value })}
          />
          <InlineSliderField
            label="Shape"
            value={preset.startShape}
            min={0}
            max={1}
            step={0.01}
            displayValue={preset.startShape.toFixed(2)}
            onValueChange={(value) => onChange({ startShape: value })}
          />
        </div>
      </fieldset>
      <fieldset className={styles.chromaFieldset}>
        <legend className={styles.chromaFieldsetLegend}>
          <span>Midpoint</span>
          {midpointLocked ? (
            <>
              <span className={styles.chromaFieldsetDivider} aria-hidden="true" />
              <span className={styles.chromaFieldsetLock}>
                <Lock size={14} />
                Auto
              </span>
            </>
          ) : null}
        </legend>
        {midpointLocked ? (
          <p className={styles.chromaFieldsetHint}>Midpoint is determined automatically when custom stops are active.</p>
        ) : null}
        <div className={styles.chromaFieldsetControls}>
          <InlineSliderField
            label="Chroma"
            value={preset.center}
            min={0}
            max={0.5}
            step={0.001}
            displayValue={preset.center.toFixed(3)}
            readOnly={midpointLocked}
            disabled={midpointLocked}
            onValueChange={(value) => onChange({ center: value })}
          />
          <InlineSliderField
            label="Position"
            value={preset.centerPosition}
            min={0}
            max={1}
            step={0.01}
            displayValue={Math.round(preset.centerPosition * 100).toString()}
            suffix="%"
            readOnly={midpointLocked}
            disabled={midpointLocked}
            onValueChange={(value) => onChange({ centerPosition: value })}
          />
        </div>
      </fieldset>
      <fieldset className={styles.chromaFieldset}>
        <legend>End</legend>
        <div className={styles.chromaFieldsetControls}>
          <InlineSliderField
            label="Chroma"
            value={preset.end}
            min={0}
            max={0.5}
            step={0.001}
            displayValue={preset.end.toFixed(3)}
            onValueChange={(value) => onChange({ end: value })}
          />
          <InlineSliderField
            label="Shape"
            value={preset.endShape}
            min={0}
            max={1}
            step={0.01}
            displayValue={preset.endShape.toFixed(2)}
            onValueChange={(value) => onChange({ endShape: value })}
          />
        </div>
      </fieldset>
    </div>
  );
}

interface CustomStopsControlsProps {
  theme: ThemeSettings;
  customStops: CustomStopConfig[];
  collisions: number[];
  onAddStop: () => void;
  onUpdateStop: (stopId: string, color: string) => void;
  onDeleteStop: (stopId: string) => void;
}

function CustomStopsControls({ theme, customStops, collisions, onAddStop, onUpdateStop, onDeleteStop }: CustomStopsControlsProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setDrafts((current) => {
      const next: Record<string, string> = {};
      for (const stop of customStops) {
        next[stop.id] = current[stop.id] ?? stop.color;
      }
      return next;
    });
  }, [customStops]);

  const sortedStops = sortCustomStopsByIndex(customStops, theme);
  const collisionSet = new Set(collisions);

  return (
    <div className={styles.customStopsControls}>
      {collisions.length > 0 ? (
        <div className={styles.validationCallout} role="alert">
          Multiple custom stops resolve to the same calculated stop: {collisions.join(', ')}.
        </div>
      ) : null}
      {sortedStops.length > 0 ? (
        <div className={styles.customStopsList}>
          {sortedStops.map((stop) => {
            const index = customStopIndex(stop.color, theme);
            const draft = drafts[stop.id] ?? stop.color;
            const normalized = normalizeAnchorInput(draft);
            return (
              <div key={stop.id} className={styles.customStopCard} data-invalid={collisionSet.has(index) ? '' : undefined}>
                <div className={styles.customStopHeader}>
                  <span className={styles.customStopTitle}>Stop</span>
                  <Badge tone={collisionSet.has(index) ? 'warning' : 'accent'}>{index}</Badge>
                  <IconButton label="Delete stop" icon={<Trash2 size={14} />} variant="ghost" onClick={() => onDeleteStop(stop.id)} />
                </div>
                <div className={styles.customStopFields}>
                  <label className={styles.customStopColorField}>
                    <span>Color</span>
                    <input
                      className={styles.customStopColorInput}
                      type="color"
                      value={normalized ?? '#af261d'}
                      onChange={(event) => {
                        const next = event.currentTarget.value;
                        setDrafts((current) => ({ ...current, [stop.id]: next }));
                        onUpdateStop(stop.id, next);
                      }}
                    />
                  </label>
                  <TextField
                    label="Hex"
                    value={draft}
                    onChange={(event) => {
                      const next = event.currentTarget.value;
                      setDrafts((current) => ({ ...current, [stop.id]: next }));
                      const nextHex = normalizeAnchorInput(next);
                      if (nextHex) onUpdateStop(stop.id, nextHex);
                    }}
                    onBlur={() => {
                      const nextHex = normalizeAnchorInput(draft) ?? stop.color;
                      setDrafts((current) => ({ ...current, [stop.id]: nextHex }));
                      onUpdateStop(stop.id, nextHex);
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.customStopsEmpty}>No custom stops yet. Add one to start experimenting.</div>
      )}
      <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={onAddStop}>
        Add Stop
      </Button>
    </div>
  );
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

function normalizeAnchorInput(value: string): string | null {
  const cleaned = value.trim().replace(/^#+/, '').toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(cleaned)) return null;
  return `#${cleaned}`;
}

interface SettingsPopoverProps {
  lMax: number;
  lMin: number;
  displayOptions: RampDisplayOptions;
  onLMaxChange: (value: number) => void;
  onLMinChange: (value: number) => void;
  onDisplayOptionsChange: (value: RampDisplayOptions) => void;
}

function SettingsPopover({ lMax, lMin, displayOptions, onLMaxChange, onLMinChange, onDisplayOptionsChange }: SettingsPopoverProps) {
  const updateOption = (key: keyof RampDisplayOptions, value: boolean) => {
    onDisplayOptionsChange({ ...displayOptions, [key]: value });
  };

  return (
    <Popover
      title="Global settings"
      width="sm"
      trigger={<IconButton label="Open settings" icon={<Settings size={17} />} variant="ghost" size="md" />}
    >
      <div className={styles.settingsPanel}>
        <div className={styles.sectionHeading}>
          <h3>Lightness endpoints</h3>
        </div>
        <div className={styles.lightnessFields}>
          <NumberField
            label="L max"
            value={Math.round(lMax * 100)}
            min={1}
            max={100}
            step={1}
            suffix="%"
            onValueChange={(value) => onLMaxChange(value / 100)}
          />
          <NumberField
            label="L min"
            value={Math.round(lMin * 100)}
            min={0}
            max={99}
            step={1}
            suffix="%"
            onValueChange={(value) => onLMinChange(value / 100)}
          />
        </div>
        <div className={styles.settingsDivider} />
        <div className={styles.sectionHeading}>
          <h3>Visible details</h3>
        </div>
        <div className={styles.settingsToggles}>
          <SwitchField
            label="Allow hidden stops"
            checked={displayOptions.allowHiddenStops}
            onCheckedChange={(value) => updateOption('allowHiddenStops', value)}
          />
          <SwitchField label="Show hex" checked={displayOptions.showHex} onCheckedChange={(value) => updateOption('showHex', value)} />
          <SwitchField
            label="Show lightness"
            checked={displayOptions.showLightness}
            onCheckedChange={(value) => updateOption('showLightness', value)}
          />
          <SwitchField
            label="Show chroma"
            checked={displayOptions.showChroma}
            onCheckedChange={(value) => updateOption('showChroma', value)}
          />
          <SwitchField label="Show hue" checked={displayOptions.showHue} onCheckedChange={(value) => updateOption('showHue', value)} />
        </div>
      </div>
    </Popover>
  );
}

interface ExportDialogProps {
  exportValue: string;
  validation: ReturnType<typeof validateGeneratedStops>;
  exportFormat: 'css' | 'json' | 'table';
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onFormatChange: (value: 'css' | 'json' | 'table') => void;
}

function ExportDialog({
  exportValue,
  validation,
  exportFormat,
  copied,
  onCopy,
  onDownload,
  onFormatChange,
}: ExportDialogProps) {
  return (
    <Dialog
      title="Export palette"
      trigger={
        <Button size="sm" variant="secondary" icon={<Share2 size={14} />}>
          Export Palette
        </Button>
      }
      footer={
        <>
        <Button size="sm" variant="secondary" icon={<Copy size={14} />} disabled={validation.hasBlockingIssues} onClick={onCopy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button size="sm" variant="primary" icon={<Download size={14} />} disabled={validation.hasBlockingIssues} onClick={onDownload}>
          Download
        </Button>
      </>
    }
    >
      <div className={styles.exportDialogBody}>
        <SegmentedControl
          label="Export format"
          value={exportFormat}
          items={[
            { value: 'css', label: 'CSS' },
            { value: 'json', label: 'JSON' },
            { value: 'table', label: 'Table' },
          ]}
          onValueChange={onFormatChange}
        />
        {validation.hasBlockingIssues ? (
          <div className={styles.validationCallout} role="alert">
            Visible stops {validation.blockingStops.join(', ')} are out of sRGB gamut.
          </div>
        ) : null}
        <CodeBlock value={exportValue} />
      </div>
    </Dialog>
  );
}
