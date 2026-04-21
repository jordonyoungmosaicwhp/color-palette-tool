import { useState } from 'react';
import styles from '../RampWorkspace.module.scss';

interface EditableLabelProps {
  value: string;
  className?: string;
  onChange: (value: string) => void;
}

export function EditableLabel({ value, className, onChange }: EditableLabelProps) {
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
    <button className={className ?? styles.editableLabelButton} onClick={() => setEditing(true)}>
      {value}
    </button>
  );
}
