import { Menu } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { FloatingButton, FloatingButtonGroup } from '../../../shared/ui';
import { useRootStore } from '../../stores';
import { ICON_SIZE } from './constants';
import { MenuActionIcon } from './MenuActionIcon';
import styles from './SidebarNavigation.module.scss';

export const MenuButton = observer(
  ({ onOpen, hidden }: { onOpen: () => void; hidden: boolean }) => {
    const menuActions = useRootStore().commonStore.menuActions;

    if (hidden) {
      return null;
    }

    if (menuActions.length === 0) {
      return (
        <FloatingButton
          className={styles.sidebarMenuOpener}
          icon={<Menu size={ICON_SIZE} />}
          type="primary"
          onClick={onOpen}
        />
      );
    }

    return (
      <FloatingButtonGroup
        className={styles.sidebarMenuOpener}
        icon={<Menu size={ICON_SIZE} />}
        trigger="hover"
        type="primary"
        onClick={onOpen}
      >
        {menuActions.map(action => (
          <MenuActionIcon key={action.name} action={action} />
        ))}
      </FloatingButtonGroup>
    );
  }
);
