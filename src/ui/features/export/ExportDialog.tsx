import { Copy, Download, Share } from 'lucide-react';

import { Button, CodeBlock, Dialog, SegmentedControl } from '../../../design-system';
import type { ValidationResult } from '../../../lib/color';
import styles from './ExportDialog.module.scss';

export interface ExportDialogProps {
  exportValue: string;
  validation: ValidationResult;
  exportFormat: 'css' | 'json' | 'table';
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onFormatChange: (value: 'css' | 'json' | 'table') => void;
}

export function ExportDialog({
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
        <Button size="sm" variant="secondary" icon={<Share size={14} />}>
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
