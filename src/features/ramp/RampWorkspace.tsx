import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  Anchor,
  Copy,
  Download,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Settings,
  Share2,
  Upload,
  SunMedium,
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
  SelectField,
  ToggleButton,
  SwitchField,
  TextAreaField,
} from '../../design-system';
import {
  anchorHueIsOnPath,
  createDefaultConfig,
  createSeededRampConfig,
  deleteStop,
  generateRamp,
  insertStopBetween,
  parseOklchColor,
  resnapAnchorStops,
  setAnchor,
  stopResolution,
  toggleStopVisibility,
  updateRampStops,
  validateGeneratedStops,
} from '../../lib/color';
import type { ChromaPreset, CurveDirection, CurvePreset, DisplayMode, HuePreset, HueRotation, RampConfig } from '../../lib/color';
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
  const [midpointLocked, setMidpointLocked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [anchorHexDraft, setAnchorHexDraft] = useState('#af261d');
  const selectedRamp = groups.flatMap((group) => group.ramps).find((ramp) => ramp.id === selectedRampId);
  const selectedConfig = selectedRamp?.config ?? groups[0]?.ramps[0]?.config ?? createDefaultConfig().ramp;
  const selectedGeneratedStops = generateRamp(state.config.theme, selectedConfig);
  const validation = validateGeneratedStops(selectedGeneratedStops);
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
  const anchorPosition = selectedRamp?.config.anchor ? selectedRamp.config.anchor.stop / 1000 : undefined;
  const anchorChroma = selectedRamp?.config.anchor ? parseOklchColor(selectedRamp.config.anchor.color).c : undefined;
  useEffect(() => {
    document.documentElement.dataset.theme = uiTheme;
    document.documentElement.style.colorScheme = uiTheme;
    return () => {
      document.documentElement.dataset.theme = 'light';
      document.documentElement.style.colorScheme = 'light';
    };
  }, [uiTheme]);
  useEffect(() => {
    setMidpointLocked(false);
  }, [selectedRampId]);
  useEffect(() => {
    if (anchorPosition === undefined) {
      setMidpointLocked(false);
    }
  }, [anchorPosition]);
  useEffect(() => {
    if (!selectedRamp || anchorPosition === undefined || !midpointLocked) return;

    updateRampConfig(selectedRamp.id, (ramp) =>
      ramp.chromaPreset.centerPosition === anchorPosition && (anchorChroma === undefined || ramp.chromaPreset.center === anchorChroma)
        ? ramp
        : {
            ...ramp,
            chromaPreset: {
              ...ramp.chromaPreset,
              centerPosition: anchorPosition,
              ...(anchorChroma === undefined ? {} : { center: anchorChroma }),
            },
          },
    );
  }, [anchorChroma, anchorPosition, midpointLocked, selectedRamp]);
  const exportValue =
    state.exportFormat === 'css'
      ? exportBundle.cssVariables
      : state.exportFormat === 'json'
        ? exportBundle.jsonConfig
        : exportBundle.table;

  async function copyExport() {
    if (validation.hasBlockingIssues) return;
    await navigator.clipboard.writeText(exportValue);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  function downloadConfig() {
    if (validation.hasBlockingIssues) return;
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
    setAnchorHexDraft(nextSelectedRamp?.config.anchor?.color ?? '#af261d');
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

  function selectRamp(rampId: string) {
    const ramp = groups.flatMap((group) => group.ramps).find((item) => item.id === rampId);
    setSelectedRampId(rampId);
    setAnchorHexDraft(ramp?.config.anchor?.color ?? '#af261d');
    setInspectorOpen(true);
  }

  function addRamp(groupId: string) {
    const newRamp = createWorkspaceRamp(`ramp-${Date.now()}`, 'New Ramp', '#2563eb', 0.04, 0.16);
    setGroups((current) =>
      current.map((group) => (group.id === groupId ? { ...group, ramps: [...group.ramps, newRamp] } : group)),
    );
    setSelectedRampId(newRamp.id);
    setAnchorHexDraft(newRamp.config.anchor?.color ?? '#af261d');
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
            anchor: ramp.config.anchor ? { ...ramp.config.anchor } : undefined,
            chromaPreset: { ...ramp.config.chromaPreset },
            huePreset: ramp.config.huePreset ? { ...ramp.config.huePreset } : undefined,
          },
        };
        setSelectedRampId(duplicate.id);
        setAnchorHexDraft(duplicate.config.anchor?.color ?? '#af261d');
        setInspectorOpen(true);
        return { ...group, ramps: [...group.ramps, duplicate] };
      }),
    );
  }

  function clearMinorStops(rampId: string) {
    updateRampConfig(rampId, (ramp) =>
      updateRampStops(
        ramp,
        ramp.stops.filter((stop) => stop.index % 100 === 0 || stop.index === ramp.anchor?.stop),
      ),
    );
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

  function updateAnchorColor(value: string) {
    setAnchorHexDraft(value);
  }

  function applyAnchorColor() {
    const normalized = normalizeAnchorInput(anchorHexDraft);
    if (normalized && selectedRamp) {
      try {
        const anchorColor = parseOklchColor(normalized);
        const rawStop = ((state.config.theme.lMax - anchorColor.l) / (state.config.theme.lMax - state.config.theme.lMin)) * 1000;
        const snappedStop = Math.min(975, Math.max(25, Math.round(rawStop / 25) * 25));
        updateRampConfig(selectedRamp.id, (ramp) => setAnchor(ramp, normalized, snappedStop, stopResolution(snappedStop)));
        setAnchorHexDraft(normalized);
        return;
      } catch {
        // Fall through to reset invalid input.
      }
    }

    setAnchorHexDraft(selectedRamp?.config.anchor?.color ?? '#af261d');
  }

  function clearAnchorForRamp(rampId: string) {
    updateRampConfig(rampId, (ramp) =>
      updateRampStops(
        {
          ...ramp,
          anchor: undefined,
          stops: ramp.stops.filter((stop) => stop.origin !== 'anchor'),
        },
        ramp.stops.filter((stop) => stop.origin !== 'anchor'),
      ),
    );
    setMidpointLocked(false);
  }

  function rangeHuePreset(ramp: RampConfig): Extract<HuePreset, { type: 'range' }> {
    const fallbackHue = ramp.huePreset?.type === 'constant' ? ramp.huePreset.hue : ramp.hue;
    return ramp.huePreset?.type === 'range'
      ? ramp.huePreset
      : {
          type: 'range',
          start: fallbackHue,
          end: fallbackHue,
          rotation: 'clockwise',
          curve: 'linear',
          direction: 'easeInOut',
        };
  }

  function updateHueRange(rampId: string, next: Partial<Extract<HuePreset, { type: 'range' }>>) {
    updateRampConfig(rampId, (ramp) => ({
      ...ramp,
      huePreset: {
        ...rangeHuePreset(ramp),
        ...next,
        type: 'range',
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
              const nextTheme = { ...state.config.theme, lMax: value };
              setGroups((current) =>
                current.map((group) => ({
                  ...group,
                  ramps: group.ramps.map((ramp) => ({ ...ramp, config: resnapAnchorStops(ramp.config, nextTheme) })),
                })),
              );
              dispatch({ type: 'set-lmax', value });
            }}
            onLMinChange={(value) => {
              const nextTheme = { ...state.config.theme, lMin: value };
              setGroups((current) =>
                current.map((group) => ({
                  ...group,
                  ramps: group.ramps.map((ramp) => ({ ...ramp, config: resnapAnchorStops(ramp.config, nextTheme) })),
                })),
              );
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
                  <Collapsible title="Hue" defaultOpen>
                    <div className={styles.sectionControls}>
                      <HueControls
                        preset={rangeHuePreset(selectedRamp.config)}
                        hasAnchorWarning={!anchorHueIsOnPath(selectedRamp.config)}
                        onChange={(value) => updateHueRange(selectedRamp.id, value)}
                      />
                    </div>
                  </Collapsible>
                </section>

                <section className={styles.propertySection} data-section="chroma">
                  <Collapsible title="Chroma" defaultOpen>
                    <div className={styles.sectionControls}>
                      <ChromaControls
                        preset={selectedRamp.config.chromaPreset}
                        anchorPosition={anchorPosition}
                        anchorChroma={anchorChroma}
                        midpointLocked={midpointLocked}
                        onChange={(value) =>
                          updateRampConfig(selectedRamp.id, (ramp) => ({
                            ...ramp,
                            chromaPreset: { ...ramp.chromaPreset, ...value },
                          }))
                        }
                        onLockChange={setMidpointLocked}
                      />
                    </div>
                  </Collapsible>
                </section>

                <section className={styles.propertySection} data-section="anchor">
                  <Collapsible title="Custom anchor" defaultOpen>
                    <div className={styles.sectionControls}>
                      <div className={styles.anchorControl}>
                        <label htmlFor="anchor-color">Anchor color</label>
                        <div className={styles.anchorInputRow}>
                          <input
                            id="anchor-color"
                            className={styles.anchorColorInput}
                            type="color"
                            value={normalizeAnchorInput(anchorHexDraft) ?? selectedRamp.config.anchor?.color ?? '#af261d'}
                            onChange={(event) => updateAnchorColor(event.currentTarget.value)}
                          />
                          <input
                            className={styles.anchorHexInput}
                            aria-label="Anchor hex"
                            value={anchorHexDraft}
                            onChange={(event) => updateAnchorColor(event.currentTarget.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                applyAnchorColor();
                              }
                            }}
                          />
                        </div>
                      </div>
                      <div className={styles.anchorActions}>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!normalizeAnchorInput(anchorHexDraft)}
                          onClick={applyAnchorColor}
                        >
                          Apply Anchor
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!selectedRamp.config.anchor}
                          onClick={() => clearAnchorForRamp(selectedRamp.id)}
                        >
                          Clear Anchor
                        </Button>
                      </div>
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
  preset: Extract<HuePreset, { type: 'range' }>;
  hasAnchorWarning: boolean;
  onChange: (value: Partial<Extract<HuePreset, { type: 'range' }>>) => void;
}

function HueControls({ preset, hasAnchorWarning, onChange }: HueControlsProps) {
  return (
    <div className={styles.hueControls}>
      {hasAnchorWarning ? (
        <div className={styles.validationCallout} role="status">
          Anchor hue is outside this start/end path for the selected rotation. The anchor color is preserved, but the curve will bend through it locally.
        </div>
      ) : null}
      <InlineSliderField
        label="Start hue"
        value={Math.round(preset.start)}
        min={0}
        max={360}
        step={1}
        displayValue={String(Math.round(preset.start))}
        onValueChange={(value) => onChange({ start: value })}
      />
      <InlineSliderField
        label="End hue"
        value={Math.round(preset.end)}
        min={0}
        max={360}
        step={1}
        displayValue={String(Math.round(preset.end))}
        onValueChange={(value) => onChange({ end: value })}
      />
      <SegmentedControl<HueRotation>
        label="Hue rotation"
        value={preset.rotation}
        items={[
          { value: 'clockwise', label: 'Clockwise' },
          { value: 'counter', label: 'Counter' },
        ]}
        onValueChange={(value) => onChange({ rotation: value })}
      />
      <CurveDirectionRow
        curve={preset.curve}
        direction={preset.direction}
        onCurveChange={(curve) => onChange({ curve })}
        onDirectionChange={(direction) => onChange({ direction })}
      />
    </div>
  );
}

interface ChromaControlsProps {
  preset: ChromaPreset;
  anchorPosition?: number;
  anchorChroma?: number;
  midpointLocked: boolean;
  onChange: (value: Partial<ChromaPreset>) => void;
  onLockChange: (value: boolean) => void;
}

function ChromaControls({
  preset,
  anchorPosition,
  anchorChroma,
  midpointLocked,
  onChange,
  onLockChange,
}: ChromaControlsProps) {
  const effectiveCenterPosition = midpointLocked && anchorPosition !== undefined ? anchorPosition : preset.centerPosition;

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
          <span className={styles.chromaFieldsetDivider} aria-hidden="true" />
          <ToggleButton
            label={midpointLocked ? 'Unlock midpoint lock' : 'Lock midpoint to anchor'}
            pressed={midpointLocked}
            disabled={anchorPosition === undefined}
            variant="ghost"
            size="md"
            layout="inline"
            icon={<Anchor size={14} />}
            onPressedChange={(pressed) => {
              onLockChange(pressed);
              if (pressed && anchorPosition !== undefined) {
                onChange({
                  centerPosition: anchorPosition,
                  ...(anchorChroma === undefined ? {} : { center: anchorChroma }),
                });
              }
            }}
          />
        </legend>
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
            value={effectiveCenterPosition}
            min={0}
            max={1}
            step={0.01}
            displayValue={Math.round(effectiveCenterPosition * 100).toString()}
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

interface CurveDirectionRowProps {
  curve: CurvePreset;
  direction: CurveDirection;
  onCurveChange: (value: CurvePreset) => void;
  onDirectionChange: (value: CurveDirection) => void;
}

const curveItems: Array<{ value: CurvePreset; label: string }> = [
  { value: 'linear', label: 'Linear' },
  { value: 'sine', label: 'Sine' },
  { value: 'quad', label: 'Quad' },
];

const directionItems: Array<{ value: CurveDirection; label: string }> = [
  { value: 'easeIn', label: 'easeIn' },
  { value: 'easeOut', label: 'easeOut' },
  { value: 'easeInOut', label: 'easeInOut' },
];

function CurveDirectionRow({ curve, direction, onCurveChange, onDirectionChange }: CurveDirectionRowProps) {
  return (
    <div className={curve === 'linear' ? styles.curveDirectionRowSingle : styles.curveDirectionRow}>
      <SelectField<CurvePreset>
        label="Curve"
        value={curve}
        items={curveItems}
        onValueChange={onCurveChange}
      />
      {curve !== 'linear' ? (
        <SelectField<CurveDirection>
          label="Direction"
          value={direction}
          items={directionItems}
          onValueChange={onDirectionChange}
        />
      ) : null}
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
