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

  return (
    <div className={styles.appFrame} data-theme={workspace.uiTheme}>
      <header className={styles.topNav}>
        <div className={styles.topTitleRow}>
          <IconButton
            label={workspace.sidebarCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
            icon={workspace.sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            variant="ghost"
            size="md"
            onClick={workspace.actions.toggleSidebar}
          />
          <h1>OKLCH Palette Tool</h1>
        </div>
        <div className={styles.topActions}>
          <SegmentedControl<DisplayMode>
            label="View mode"
            value={workspace.state.config.displayMode}
            items={[
              { value: 'column', label: <>Column</> },
              { value: 'row', label: <>Row</> },
            ]}
            onValueChange={workspace.actions.onDisplayModeChange}
          />
          <IconButton
            label={workspace.uiTheme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            icon={workspace.uiTheme === 'light' ? <Moon size={17} /> : <SunMedium size={17} />}
            variant="ghost"
            size="md"
            onClick={workspace.actions.toggleUiTheme}
          />
          <SettingsPopover
            lMax={workspace.state.config.theme.lMax}
            lMin={workspace.state.config.theme.lMin}
            displayOptions={workspace.displayOptions}
            onLMaxChange={workspace.actions.onLMaxChange}
            onLMinChange={workspace.actions.onLMinChange}
            onDisplayOptionsChange={workspace.actions.setDisplayOptions}
          />
          <ImportPopover
            open={workspace.importOpen}
            value={workspace.importDraft}
            error={workspace.importError}
            onOpenChange={workspace.actions.onImportOpenChange}
            onValueChange={workspace.actions.setImportDraft}
            onApply={workspace.actions.applyImportedWorkspace}
          />
          <ExportDialog
            exportValue={workspace.exportValue}
            validation={workspace.validation}
            exportFormat={workspace.state.exportFormat}
            copied={workspace.copied}
            onCopy={workspace.actions.copyExport}
            onDownload={workspace.actions.downloadConfig}
            onFormatChange={workspace.actions.onExportFormatChange}
          />
          <IconButton
            label={workspace.inspectorOpen ? 'Collapse ramp properties' : 'Open ramp properties'}
            icon={workspace.inspectorOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
            variant="ghost"
            size="md"
            onClick={workspace.actions.toggleInspector}
          />
        </div>
      </header>

      <div
        className={styles.productShell}
        data-inspector={workspace.inspectorOpen ? 'open' : 'closed'}
        data-sidebar={workspace.sidebarCollapsed ? 'collapsed' : 'open'}
      >
        <PaletteSidebar
          collections={workspace.collections}
          activeCollectionId={workspace.activeCollection?.id ?? ''}
          expandedCollectionIds={workspace.expandedCollectionIds}
          selectedRampId={workspace.selectedRampId}
          onAddCollection={workspace.actions.addCollection}
          onRenameCollection={workspace.actions.renameCollection}
          onDeleteCollection={workspace.actions.deleteCollection}
          onSelectCollection={workspace.actions.selectCollection}
          onToggleCollection={workspace.actions.toggleCollection}
          onSelectRamp={workspace.actions.selectRamp}
          onMoveCollection={workspace.actions.moveCollection}
          onMoveGroup={workspace.actions.moveGroup}
          onMoveRamp={workspace.actions.moveRamp}
          collapsed={workspace.sidebarCollapsed}
        />

        <main className={styles.workspace}>
          {(workspace.activeCollection?.groups ?? []).map((group) => (
            <PaletteGroupSection
              key={group.id}
              group={group}
              selectedRampId={workspace.selectedRampId}
              theme={workspace.state.config.theme}
              displayOptions={workspace.displayOptions}
              view={workspace.state.config.displayMode}
              canDeleteGroup={(workspace.activeCollection?.groups.length ?? 0) > 1}
              onRenameGroup={workspace.actions.renameGroup}
              onRenameRamp={workspace.actions.renameRamp}
              onAddRamp={workspace.actions.addRamp}
              onDeleteGroup={workspace.actions.deleteGroup}
              onSelectRamp={workspace.actions.selectRamp}
              onSelectStop={workspace.actions.onSelectStop}
              onInsertStop={workspace.actions.insertStopForRamp}
              onToggleVisibility={workspace.actions.toggleStopForRamp}
              onDeleteStop={workspace.actions.deleteStopForRamp}
              onDeleteRamp={workspace.actions.deleteRamp}
              onDuplicateRamp={workspace.actions.duplicateRamp}
              onClearMinorStops={workspace.actions.clearMinorStops}
              copiedChromaSourceId={workspace.copiedChroma?.sourceRampId ?? null}
              canPasteChroma={Boolean(workspace.copiedChroma)}
              onCopyChroma={workspace.actions.copyChroma}
              onPasteChroma={workspace.actions.pasteChroma}
            />
          ))}

          <button className={styles.addSection} onClick={workspace.actions.addGroup}>
            <span />
            <strong>New Group</strong>
            <span />
          </button>
        </main>

        {workspace.inspectorOpen ? (
          <aside className={styles.properties}>
            {workspace.selectedRamp ? (
              <div className={styles.propertiesInner}>
                <div>
                  <p className={styles.kicker}>Ramp Properties</p>
                  <h2>{workspace.selectedName}</h2>
                </div>

                <section className={styles.propertySection} data-section="hue">
                  <Collapsible
                    title="Hue"
                    open={workspace.accordionSection === 'hue'}
                    onOpenChange={(open) => {
                      workspace.actions.setAccordionSection(open ? 'hue' : null);
                    }}
                  >
                    <div className={styles.sectionControls}>
                      <HueControls
                        preset={workspace.actions.getHuePresetForRamp(workspace.selectedRamp.config)}
                        customStopCount={workspace.customStops.length}
                        midpointLocked={workspace.customStopsMidpointLocked}
                        onChange={(value) => workspace.actions.updateHuePreset(workspace.selectedRamp!.id, value)}
                        onMidpointLockChange={(locked) =>
                          workspace.actions.updateRampConfig(workspace.selectedRamp!.id, (ramp) => ({
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
                    open={workspace.accordionSection === 'chroma'}
                    onOpenChange={(open) => {
                      workspace.actions.setAccordionSection(open ? 'chroma' : null);
                    }}
                  >
                    <div className={styles.sectionControls}>
                      <ChromaControls
                        preset={workspace.selectedRamp.config.chromaPreset}
                        customStopCount={workspace.customStops.length}
                        midpointLocked={workspace.customStopsMidpointLocked}
                        onChange={(value) =>
                          workspace.actions.updateRampConfig(workspace.selectedRamp!.id, (ramp) => ({
                            ...ramp,
                            chromaPreset: { ...ramp.chromaPreset, ...value },
                          }))
                        }
                        onMidpointLockChange={(locked) =>
                          workspace.actions.updateRampConfig(workspace.selectedRamp!.id, (ramp) => ({
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
                    open={workspace.accordionSection === 'customStops'}
                    onOpenChange={(open) => {
                      workspace.actions.setAccordionSection(open ? 'customStops' : null);
                    }}
                  >
                    <div className={styles.sectionControls}>
                      <CustomStopsControls
                        theme={workspace.state.config.theme}
                        customStops={workspace.customStops}
                        collisions={workspace.selectedCustomStopCollisions}
                        focusStopId={workspace.pendingCustomStopFocusId}
                        onFocusStopIdConsumed={workspace.actions.onFocusStopIdConsumed}
                        onAddStop={() => workspace.actions.addCustomStop(workspace.selectedRamp!.id)}
                        onUpdateStop={(stopId, color) => workspace.actions.updateCustomStopColor(workspace.selectedRamp!.id, stopId, color)}
                        onDeleteStop={(stopId) => workspace.actions.removeCustomStop(workspace.selectedRamp!.id, stopId)}
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
        {workspace.moveAnnouncement}
      </div>
    </div>
  );
}
