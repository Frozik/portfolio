import { useEffect } from 'react';
import { Outlet, useMatches } from 'react-router-dom';

import styles from './Root.module.scss';
import { SidebarNavigation } from './SidebarNavigation';

const APP_TITLE = 'Portfolio';

export const Root = () => {
  const matches = useMatches();
  const lastMatch = matches[matches.length - 1];
  const pageTitle = (lastMatch?.handle as { title?: string } | undefined)?.title;

  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} — ${APP_TITLE}` : APP_TITLE;
  }, [pageTitle]);

  return (
    <div className={styles.root}>
      <SidebarNavigation />
      <div className={styles.rootOverlay}>
        <Outlet />
      </div>
    </div>
  );
};
