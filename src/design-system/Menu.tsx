import { Menu as ArkMenu } from '@ark-ui/react/menu';
import { Portal } from '@ark-ui/react/portal';
import { MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from './IconButton';
import styles from './Menu.module.scss';

export interface MenuItem {
  id: string;
  label: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  onSelect: () => void;
  onClick?: () => void;
}

export interface ActionMenuProps {
  label: string;
  items: MenuItem[];
}

export function ActionMenu({ label, items }: ActionMenuProps) {
  return (
    <ArkMenu.Root>
      <ArkMenu.Trigger asChild>
        <IconButton label={label} icon={<MoreHorizontal size={16} />} />
      </ArkMenu.Trigger>
      <Portal>
        <ArkMenu.Positioner>
          <ArkMenu.Content className={styles.content}>
            {items.map((item) => (
              <ArkMenu.Item
                key={item.id}
                value={item.id}
                disabled={item.disabled}
                className={styles.item}
                data-destructive={item.destructive ? '' : undefined}
                onSelect={item.onSelect}
                onClick={item.onClick}
              >
                {item.label}
              </ArkMenu.Item>
            ))}
          </ArkMenu.Content>
        </ArkMenu.Positioner>
      </Portal>
    </ArkMenu.Root>
  );
}
