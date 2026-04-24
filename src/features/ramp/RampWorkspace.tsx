import {
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  SunMedium,
} from 'lucide-react';

import { useWorkspaceController } from '../../app/workspace/useWorkspaceController';
import { Collapsible, IconButton, SegmentedControl } from '../../design-system';
import type { DisplayMode } from '../../lib/color';
import { ChromaControls } from '../../ui/features/controls/ChromaControls';
import { CustomStopsControls } from '../../ui/features/controls/CustomStopsControls';
import { HueControls } from '../../ui/features/controls/HueControls';
import { ExportDialog } from '../../ui/features/export/ExportDialog';
import { ImportPopover } from '../../ui/features/export/ImportPopover';
import { SettingsPopover } from '../../ui/features/settings/SettingsPopover';
import { PaletteGroupSection } from './components/PaletteGroupSection';
import { PaletteSidebar } from './components/PaletteSidebar';
import styles from './RampWorkspace.module.scss';

export function RampWorkspace() {
  const workspace = useWorkspaceController();
  const {
    state,
    collections,
    activeCollection,
    selectedRamp,
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
    actions,
  } = workspace;

  return (
    <div className={styles.appFrame} data-theme={uiTheme}>
      <header className={styles.topNav}>
        <div className={styles.topTitleRow}>
          <IconButton
            label={sidebarCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
            icon={sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            variant="ghost"
            size="md"
            onClick={actions.toggleSidebar}
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
            onValueChange={actions.onDisplayModeChange}
          />
          <IconButton
            label={uiTheme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            icon={uiTheme === 'light' ? <Moon size={17} /> : <SunMedium size={17} />}
            variant="ghost"
            size="md"
            onClick={actions.toggleUiTheme}
          />
          <SettingsPopover
            lMax={state.config.theme.lMax}
            lMin={state.config.theme.lMin}
            displayOptions={displayOptions}
            onLMaxChange={actions.onLMaxChange}
            onLMinChange={actions.onLMinChange}
            onDisplayOptionsChange={actions.setDisplayOptions}
          />
          <ImportPopover
            open={importOpen}
            value={importDraft}
            error={importError}
            onOpenChange={actions.onImportOpenChange}
            onValueChange={actions.setImportDraft}
            onApply={actions.applyImportedWorkspace}
          />
          <ExportDialog
            exportValue={exportValue}
            validation={validation}
            exportFormat={state.exportFormat}
            copied={copied}
            onCopy={actions.copyExport}
            onDownload={actions.downloadConfig}
            onFormatChange={actions.onExportFormatChange}
          />
          <IconButton
            label={inspectorOpen ? 'Collapse ramp properties' : 'Open ramp properties'}
            icon={inspectorOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
            variant="ghost"
            size="md"
            onClick={actions.toggleInspector}
          />
        </div>
      </header>

      <div
        className={styles.productShell}
        data-inspector={inspectorOpen ? 'open' : 'closed'}
        data-sidebar={sidebarCollapsed ? 'collapsed' : 'open'}
      >
        <PaletteSidebar
          collections={collections}
          activeCollectionId={activeCollection?.id ?? ''}
          expandedCollectionIds={expandedCollectionIds}
          selectedRampId={selectedRampId}
          onAddCollection={actions.addCollection}
          onRenameCollection={actions.renameCollection}
          onDeleteCollection={actions.deleteCollection}
          onSelectCollection={actions.selectCollection}
          onToggleCollection={actions.toggleCollection}
          onSelectRamp={actions.selectRamp}
          onMoveCollection={actions.moveCollection}
          onMoveGroup={actions.moveGroup}
          onMoveRamp={actions.moveRamp}
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
              onRenameGroup={actions.renameGroup}
              onRenameRamp={actions.renameRamp}
              onAddRamp={actions.addRamp}
              onDeleteGroup={actions.deleteGroup}
              onSelectRamp={actions.selectRamp}
              onSelectStop={actions.onSelectStop}
              onInsertStop={actions.insertStopForRamp}
              onToggleVisibility={actions.toggleStopForRamp}
              onDeleteStop={actions.deleteStopForRamp}
              onDeleteRamp={actions.deleteRamp}
              onDuplicateRamp={actions.duplicateRamp}
              onClearMinorStops={actions.clearMinorStops}
              copiedChromaSourceId={copiedChroma?.sourceRampId ?? null}
              canPasteChroma={Boolean(copiedChroma)}
              onCopyChroma={actions.copyChroma}
              onPasteChroma={actions.pasteChroma}
            />
          ))}

          <button className={styles.addSection} onClick={actions.addGroup}>
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
                      actions.setAccordionSection(open ? 'hue' : null);
                    }}
                  >
                    <div className={styles.sectionControls}>
                      <HueControls
                        preset={actions.getHuePresetForRamp(selectedRamp.config)}
                        customStopCount={customStops.length}
                        midpointLocked={customStopsMidpointLocked}
                        onChange={(value) => actions.updateHuePreset(selectedRamp.id, value)}
                        onMidpointLockChange={(locked) =>
                          actions.updateRampConfig(selectedRamp.id, (ramp) => ({
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
                      actions.setAccordionSection(open ? 'chroma' : null);
                    }}
                  >
                    <div className={styles.sectionControls}>
                      <ChromaControls
                        preset={selectedRamp.config.chromaPreset}
                        customStopCount={customStops.length}
                        midpointLocked={customStopsMidpointLocked}
                        onChange={(value) =>
                          actions.updateRampConfig(selectedRamp.id, (ramp) => ({
                            ...ramp,
                            chromaPreset: { ...ramp.chromaPreset, ...value },
                          }))
                        }
                        onMidpointLockChange={(locked) =>
                          actions.updateRampConfig(selectedRamp.id, (ramp) => ({
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
                      actions.setAccordionSection(open ? 'customStops' : null);
                    }}
                  >
                    <div className={styles.sectionControls}>
                      <CustomStopsControls
                        theme={state.config.theme}
                        customStops={customStops}
                        collisions={selectedCustomStopCollisions}
                        focusStopId={pendingCustomStopFocusId}
                        onFocusStopIdConsumed={actions.onFocusStopIdConsumed}
                        onAddStop={() => actions.addCustomStop(selectedRamp.id)}
                        onUpdateStop={(stopId, color) => actions.updateCustomStopColor(selectedRamp.id, stopId, color)}
                        onDeleteStop={(stopId) => actions.removeCustomStop(selectedRamp.id, stopId)}
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
