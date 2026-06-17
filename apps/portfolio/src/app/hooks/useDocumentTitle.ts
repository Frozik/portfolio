import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { getCurrentLanguage } from '../../shared/i18n/locale';
import { ROUTE_METADATA } from '../routeMetadata';
import { appT } from '../translations';

function resolveTitle(pathname: string): string | undefined {
  const firstSegment = pathname.split('/')[1] ?? '';
  const metadata = ROUTE_METADATA.find(entry => entry.segment === firstSegment);
  return metadata ? appT.pageTitles[metadata.titleKey] : undefined;
}

/**
 * Keeps `document.title` in sync with the current pathname and sets
 * `document.documentElement.lang` from the i18n locale.
 */
export function useDocumentTitle(): void {
  const { pathname } = useLocation();
  const pageTitle = resolveTitle(pathname);

  useEffect(() => {
    document.documentElement.lang = getCurrentLanguage();
  }, []);

  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} — ${appT.appTitle}` : appT.appTitle;
  }, [pageTitle]);
}
