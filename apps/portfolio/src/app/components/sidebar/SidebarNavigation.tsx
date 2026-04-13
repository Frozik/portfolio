import { useFunction } from '@frozik/components';
import { memo } from 'react';
import { useLocation } from 'react-router-dom';
import { useToggle } from 'usehooks-ts';
import { Drawer, QRCode } from '../../../shared/ui';
import { appT } from '../../translations';
import { DrawerTitle } from './DrawerTitle';
import { MenuButton } from './MenuButton';
import { NavigationLinks } from './NavigationLinks';
import styles from './SidebarNavigation.module.scss';

export const SidebarNavigation = memo(() => {
  const [visible, toggleVisible, setVisible] = useToggle(false);
  const [showQR, toggleQR, setShowQR] = useToggle(false);
  const location = useLocation();

  const handleClose = useFunction(() => {
    setVisible(false);
    setShowQR(false);
  });

  const currentUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${location.pathname}`;

  return (
    <>
      <Drawer
        title={<DrawerTitle onToggleQR={toggleQR} />}
        className={styles.sidebar}
        placement="left"
        open={visible}
        onClose={handleClose}
      >
        {showQR ? (
          <div className="flex flex-col items-center gap-3 pt-4">
            <QRCode value={currentUrl} size={200} />
            <p className="text-center text-sm text-text-secondary">{appT.sidebar.scanToOpen}</p>
          </div>
        ) : (
          <NavigationLinks onNavigate={handleClose} />
        )}
      </Drawer>

      <MenuButton onOpen={toggleVisible} hidden={visible} />
    </>
  );
});
