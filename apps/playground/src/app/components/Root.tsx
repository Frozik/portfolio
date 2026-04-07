import { Outlet } from 'react-router-dom';

import styles from './Root.module.scss';
import { SidebarNavigation } from './SidebarNavigation';

export const Root = () => (
  <div className={styles.root}>
    <SidebarNavigation />
    <div className={styles.rootOverlay}>
      <Outlet />
    </div>
  </div>
);
