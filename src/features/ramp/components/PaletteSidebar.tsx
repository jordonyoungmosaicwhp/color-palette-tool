import { CirclePlus, Palette } from 'lucide-react';
import { Button } from '../../../design-system';
import type { PaletteGroup } from '../workspaceTypes';
import styles from '../RampWorkspace.module.scss';

interface PaletteSidebarProps {
  groups: PaletteGroup[];
  selectedRampId: string;
  onAddGroup: () => void;
  onSelectRamp: (id: string) => void;
}

export function PaletteSidebar({ groups, selectedRampId, onAddGroup, onSelectRamp }: PaletteSidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div>
        <h2>Collections</h2>
        <p>Design System v2</p>
      </div>

      <nav className={styles.collectionNav} aria-label="Collections">
        {groups.map((group) => (
          <div key={group.id} className={styles.sidebarGroup}>
            <a className={styles.navGroup} href={`#${group.id}`}>
              <Palette size={18} />
              <span>{group.name}</span>
            </a>
            <div className={styles.subNav}>
              {group.ramps.length > 0 ? (
                group.ramps.map((ramp) => (
                  <button
                    key={ramp.id}
                    className={ramp.id === selectedRampId ? styles.activeSubItem : undefined}
                    onClick={() => onSelectRamp(ramp.id)}
                  >
                    {ramp.name}
                  </button>
                ))
              ) : (
                <span>No ramps yet</span>
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <Button variant="primary" icon={<CirclePlus size={16} />} onClick={onAddGroup}>
          New Group
        </Button>
      </div>
    </aside>
  );
}
