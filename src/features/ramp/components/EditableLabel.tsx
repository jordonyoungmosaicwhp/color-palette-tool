import { useState } from 'react';
import styles from '../RampWorkspace.module.scss';

interface EditableLabelProps {
  value: string;
  className?: string;
  onChange: (value: string) => void;
  onActivate?: () => void;
  editOnDoubleClick?: boolean;
}

export function EditableLabel({ value, className, onChange, onActivate, editOnDoubleClick = false }: EditableLabelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        className={styles.editableLabelInput}
        value={draft}
        autoFocus
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={() => {
          setEditing(false);
          onChange(draft.trim() || value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className={className ?? styles.editableLabelButton}
      onClick={() => {
        if (editOnDoubleClick) {
          onActivate?.();
          return;
        }

        setEditing(true);
      }}
      onDoubleClick={() => {
        if (!editOnDoubleClick) return;
        setDraft(value);
        setEditing(true);
      }}
    >
      {value}
    </button>
  );
}
