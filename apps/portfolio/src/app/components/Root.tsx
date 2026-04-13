import { useEffect } from 'react';
import { Outlet, useMatches } from 'react-router-dom';

import { getCurrentLanguage } from '../../shared/i18n';
import { appT } from '../translations';
import styles from './Root.module.scss';
import { SidebarNavigation } from './sidebar/SidebarNavigation';

export const Root = () => {
  const matches = useMatches();
  const lastMatch = matches[matches.length - 1];
  const pageTitle = (lastMatch?.handle as { title?: string } | undefined)?.title;

  useEffect(() => {
    document.documentElement.lang = getCurrentLanguage();
  }, []);

  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} — ${appT.appTitle}` : appT.appTitle;
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
