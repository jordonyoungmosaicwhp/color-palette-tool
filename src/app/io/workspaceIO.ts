import type { WorkspaceRamp } from '../../features/ramp/workspaceTypes';
import type { WorkspaceImportResult, WorkspaceSnapshot } from '../../features/ramp/workspaceSerialization';
import type { RampState } from '../../features/ramp/rampReducer';
import { findRampInTree } from '../tree/treeActions';

interface ApplyImportedWorkspaceSuccess {
  ok: true;
  workspace: WorkspaceSnapshot;
  activeCollectionId: string;
  expandedCollectionIds: string[];
  selectedRampId: string;
  selectedRamp?: WorkspaceRamp;
  rampReplacement: RampState['config']['ramp'] | undefined;
}

interface ApplyImportedWorkspaceFailure {
  ok: false;
  error: string;
}

export type ApplyImportedWorkspaceResult = ApplyImportedWorkspaceSuccess | ApplyImportedWorkspaceFailure;

export function applyImportedWorkspace(
  importDraft: string,
  parseWorkspaceImport: (text: string) => WorkspaceImportResult,
): ApplyImportedWorkspaceResult {
  const result = parseWorkspaceImport(importDraft);
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
    };
  }

  const nextWorkspace = result.value;
  const nextActiveCollection = nextWorkspace.collections[0];
  const nextSelectedRamp =
    findRampInTree(nextWorkspace.collections, nextWorkspace.selectedRampId) ??
    nextActiveCollection?.children.find((node) => node.type === 'ramp')?.ramp ??
    nextActiveCollection?.children.find((node) => node.type === 'group')?.group.ramps[0];

  return {
    ok: true,
    workspace: nextWorkspace,
    activeCollectionId: nextActiveCollection?.id ?? '',
    expandedCollectionIds: nextActiveCollection ? [nextActiveCollection.id] : [],
    selectedRampId: nextSelectedRamp?.id ?? '',
    selectedRamp: nextSelectedRamp,
    rampReplacement: nextSelectedRamp?.config,
  };
}

export async function copyExport(
  hasBlockingIssues: boolean,
  exportValue: string,
  writeText: (value: string) => Promise<void>,
  setCopied: (value: boolean) => void,
  scheduleReset: (callback: () => void, delayMs: number) => void,
): Promise<void> {
  if (hasBlockingIssues) return;

  await writeText(exportValue);
  setCopied(true);
  scheduleReset(() => setCopied(false), 1200);
}

export function downloadConfig(
  hasBlockingIssues: boolean,
  exportValue: string,
  exportFormat: RampState['exportFormat'],
  createObjectUrl: (blob: Blob) => string,
  revokeObjectUrl: (url: string) => void,
  createLink: () => HTMLAnchorElement,
): void {
  if (hasBlockingIssues) return;

  const extension = exportFormat === 'css' ? 'css' : exportFormat === 'table' ? 'txt' : 'json';
  const blob = new Blob([exportValue], {
    type: exportFormat === 'css' ? 'text/css' : exportFormat === 'table' ? 'text/plain' : 'application/json',
  });
  const url = createObjectUrl(blob);
  const link = createLink();
  link.href = url;
  link.download = `palette-ramp.${extension}`;
  link.click();
  revokeObjectUrl(url);
}
